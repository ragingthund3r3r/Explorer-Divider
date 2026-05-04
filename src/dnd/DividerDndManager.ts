import { Platform, TFile } from "obsidian";
import type ExplorerDividerPlugin from "../main";
import { waitForFileExplorerEl } from "../utils/fileExplorer";
import {
	computeDividerCreatedTimestamp,
	readCreatedForAboveBelowFromMetadataCache,
	writeCreatedToFrontmatter,
} from "../metadata/created";
import { tryExecuteCommand } from "../utils/commands";

type DropPosition = "before" | "after";

export class DividerDndManager {
	private explorerEl!: HTMLElement;
	private mutationObserver: MutationObserver | null = null;

	private dragStartHandler: ((e: DragEvent | TouchEvent) => void) | null = null;
	private mouseDownHandler: ((e: MouseEvent) => void) | null = null;
	private mouseUpHandler: ((e: MouseEvent) => void) | null = null;
	private clickBlockHandler: ((e: MouseEvent) => void) | null = null;

	private dragStartEventType: "dragstart" | "touchstart" = Platform.isMobile ? "touchstart" : "dragstart";
	private dragEventType: "drag" | "touchmove" = Platform.isMobile ? "touchmove" : "drag";
	private dropEventType: "dragend" | "touchend" = Platform.isMobile ? "touchend" : "dragend";

	private rafId = 0;
	private dropZonesActivationDelay = 250;
	private dropZonesActivationTimeout: number | null = null;
	private dragZoneWidth = 36;

	constructor(private plugin: ExplorerDividerPlugin) {}

	async enable() {
		this.explorerEl = await waitForFileExplorerEl(this.plugin.app);

		// Make sure divider items remain draggable as the explorer re-renders.
		this.refreshDividerDraggables();
		this.mutationObserver = new MutationObserver(() => this.refreshDividerDraggables());
		this.mutationObserver.observe(this.explorerEl, { childList: true, subtree: true });

		let futureSibling: HTMLElement | null = null;
		let dropPosition: DropPosition = "before";

		this.dragStartHandler = (e) => {
			const draggedEl = (e.target as HTMLElement).closest<HTMLElement>(".tree-item-self");
			if (!draggedEl) return;

			const sourcePath = draggedEl.dataset.path;
			if (!sourcePath) return;
			if (!this.isDividerPath(sourcePath)) return;

			const pointer = e instanceof DragEvent ? e : e.touches[0];
			if (!pointer) return;
			const distanceFromRight = draggedEl.getBoundingClientRect().right - pointer.clientX;
			if (Platform.isMobile) {
				if (distanceFromRight > this.dragZoneWidth) return;
				e.preventDefault();
			}


			const explorerRect = this.explorerEl.getBoundingClientRect();
			let isOutsideExplorer = false;

			this.explorerEl.dataset.dragActive = "";
			draggedEl.dataset.isBeingDragged = "";

			let lastClientX = 0;
			let lastClientY = 0;

			const onDrag = (moveEvent: DragEvent | TouchEvent) => {
				if (Platform.isMobile) {
					moveEvent.stopPropagation();
					moveEvent.preventDefault();
				}

				cancelAnimationFrame(this.rafId);
				this.rafId = requestAnimationFrame(() => {
					const movePointer = moveEvent instanceof DragEvent ? moveEvent : moveEvent.touches[0];
					if (!movePointer) return;
					let currentX = movePointer.clientX;
					let currentY = movePointer.clientY;

					if (currentX === 0 && currentY === 0) {
						currentX = lastClientX;
						currentY = lastClientY;
					} else {
						lastClientX = currentX;
						lastClientY = currentY;
					}

					isOutsideExplorer =
						currentX < explorerRect.left ||
						currentX > explorerRect.right ||
						currentY < explorerRect.top ||
						currentY > explorerRect.bottom;

					if (isOutsideExplorer) {
						this.clearDropIndicators();
						return;
					}

					({ futureSibling, dropPosition } = this.findDropTarget(currentY));
					if (futureSibling) this.updateDropIndicators(futureSibling, dropPosition);
					else this.clearDropIndicators();
				});
			};

			const onDrop = async () => {
				cancelAnimationFrame(this.rafId);
				draggedEl.removeEventListener(this.dragEventType, onDrag);

				const dropSummary = this.summarizeDropTarget(futureSibling, dropPosition);
				this.clearDropIndicators();
				delete this.explorerEl.dataset.dragActive;
				draggedEl.removeAttribute("data-is-being-dragged");

				if (isOutsideExplorer) {
					return;
				}


				const dividerFile = this.getTFileFromPath(sourcePath);
				if (!dividerFile) {
					futureSibling = null;
					return;
				}
				const aboveFile = dropSummary.abovePath ? this.getTFileFromPath(dropSummary.abovePath) : null;
				const belowFile = dropSummary.belowPath ? this.getTFileFromPath(dropSummary.belowPath) : null;

				const { aboveCreated, belowCreated } = readCreatedForAboveBelowFromMetadataCache(this.plugin.app, {
					aboveFile,
					belowFile,
				});

				const nextCreated = computeDividerCreatedTimestamp({
					abovePath: dropSummary.abovePath,
					belowPath: dropSummary.belowPath,
					aboveCreated,
					belowCreated,
				});

				if (nextCreated === null) {
					futureSibling = null;
					return;
				}

				try {
					await writeCreatedToFrontmatter(this.plugin.app, dividerFile, nextCreated);
				} catch (error) {
					console.warn("Explorer-Divider: failed to update divider created", error);
					futureSibling = null;
					return;
				}

				const refreshIdOrSuffix = this.plugin.settings.sortRefreshCommandIdOrSuffix;
				if (refreshIdOrSuffix) {
					try {
						const ok = await tryExecuteCommand(this.plugin.app, refreshIdOrSuffix);
					} catch (error) {
						console.warn("Explorer-Divider: failed to execute sort refresh command", error);
					}
				}

				futureSibling = null;
			};

			draggedEl.addEventListener(this.dragEventType, onDrag);
			draggedEl.addEventListener(this.dropEventType, onDrop, { once: true });
		};

		this.mouseDownHandler = (e) => {
			if (e.button !== 0) return;
			this.dropZonesActivationTimeout = window.setTimeout(() => {
				if (this.explorerEl.dataset.dragActive === undefined) {
					this.explorerEl.dataset.dragActive = "";
				}
				this.dropZonesActivationTimeout = null;
			}, this.dropZonesActivationDelay);
		};

		this.mouseUpHandler = () => {
			delete this.explorerEl.dataset.dragActive;
			if (this.dropZonesActivationTimeout) {
				clearTimeout(this.dropZonesActivationTimeout);
				this.dropZonesActivationTimeout = null;
			}
		};

		this.clickBlockHandler = (e) => {
			// Only block plain left-clicks. Keep context menu, modifier-click, etc.
			if (e.button !== 0) return;
			if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

			const target = e.target as HTMLElement | null;
			const dividerEl = target?.closest<HTMLElement>(".tree-item-self[data-explorer-divider='true']");
			if (!dividerEl) return;

			e.preventDefault();
			e.stopPropagation();
		};

		this.explorerEl.addEventListener("mousedown", this.mouseDownHandler);
		window.addEventListener("mouseup", this.mouseUpHandler);
		this.explorerEl.addEventListener(this.dragStartEventType, this.dragStartHandler);
		this.explorerEl.addEventListener("click", this.clickBlockHandler, { capture: true });

		console.log("DnD enabled");
	}

	disable() {
		if (this.dragStartHandler) this.explorerEl.removeEventListener(this.dragStartEventType, this.dragStartHandler);
		if (this.mouseDownHandler) this.explorerEl.removeEventListener("mousedown", this.mouseDownHandler);
		if (this.mouseUpHandler) window.removeEventListener("mouseup", this.mouseUpHandler);
		if (this.clickBlockHandler) this.explorerEl.removeEventListener("click", this.clickBlockHandler, { capture: true });
		if (this.mutationObserver) this.mutationObserver.disconnect();

		this.dragStartHandler = null;
		this.mouseDownHandler = null;
		this.mouseUpHandler = null;
		this.clickBlockHandler = null;
		this.mutationObserver = null;

		this.clearDropIndicators();
		console.log("DnD disabled");
	}

	private isDividerPath(path: string): boolean {
		const dividerName = this.plugin.settings.dividerFileName;
		return path === dividerName || path.endsWith(`/${dividerName}`);
	}

	private refreshDividerDraggables() {
		const dividerName = this.plugin.settings.dividerFileName;
		this.explorerEl
			.querySelectorAll<HTMLElement>(".tree-item-self[data-path]")
			.forEach((el) => {
				const path = el.dataset.path;
				if (!path) return;

				if (path === dividerName || path.endsWith(`/${dividerName}`)) {
					el.setAttribute("draggable", "true");
					el.dataset.explorerDivider = "true";
				} else {
					delete el.dataset.explorerDivider;
				}
			});
	}

	private findDropTarget(mouseY: number): { futureSibling: HTMLElement | null; dropPosition: DropPosition } {
		const treeItems = Array.from<HTMLElement>(
			this.explorerEl.querySelectorAll(
				".tree-item:not(:has(> [data-is-being-dragged]))"
			)
		);

		const firstTreeItem = treeItems[0];
		if (!firstTreeItem) return { futureSibling: null, dropPosition: "before" };

		let futureSibling: HTMLElement = firstTreeItem;
		let dropPosition: DropPosition = firstTreeItem.matches(".tree-item:nth-child(1 of .tree-item)") ? "before" : "after";

		treeItems.forEach((item) => {
			const itemRect = item.getBoundingClientRect();
			const itemTop = itemRect.top;
			let itemBottom = itemRect.bottom;

			// Avoid a 0-sized gap at the last child edge.
			if (item.matches(".tree-item-children .tree-item:nth-last-child(1 of .tree-item)")) itemBottom -= 0.01;

			const futureSiblingEdgeY = futureSibling.getBoundingClientRect()[dropPosition === "before" ? "top" : "bottom"];
			const futureSiblingDist = Math.abs(futureSiblingEdgeY - mouseY);
			const itemBottomDist = Math.abs(itemBottom - mouseY);

			if (itemBottomDist < futureSiblingDist) {
				futureSibling = item;
				dropPosition = "after";
			}

			if (item.matches(".tree-item:nth-child(1 of .tree-item)")) {
				const itemTopDist = Math.abs(itemTop - mouseY);
				if (itemTopDist < futureSiblingDist && itemTopDist < itemBottomDist) {
					futureSibling = item;
					dropPosition = "before";
				}
			}
		});

		return { futureSibling, dropPosition };
	}

	private updateDropIndicators(futureSibling: HTMLElement, dropPosition: DropPosition) {
		document.querySelectorAll(".tree-item[data-drop-position]").forEach((el) => el.removeAttribute("data-drop-position"));
		futureSibling.dataset.dropPosition = dropPosition;

		document.querySelectorAll(".nav-folder.is-drop-target").forEach((el) => el.classList.remove("is-drop-target"));
		const parentFolder = futureSibling.parentElement?.closest(
			'.nav-folder, [data-type="file-explorer"] > .nav-files-container > div'
		);
		if (parentFolder) parentFolder.classList.add("is-drop-target");
	}

	private clearDropIndicators() {
		if (this.dropZonesActivationTimeout) {
			clearTimeout(this.dropZonesActivationTimeout);
			this.dropZonesActivationTimeout = null;
		}
		document.querySelectorAll("[data-drop-position]").forEach((el) => el.removeAttribute("data-drop-position"));
		document.querySelectorAll(".is-drop-target").forEach((el) => el.classList.remove("is-drop-target"));
	}

	private getPathFromTreeItem(treeItem: HTMLElement | null): string | null {
		if (!treeItem) return null;
		const selfEl =
			treeItem.querySelector<HTMLElement>(":scope > .tree-item-self") ??
			treeItem.querySelector<HTMLElement>(".tree-item-self");
		const path = selfEl?.dataset.path ?? null;
		if (!path) return null;

		const abstract = this.plugin.app.vault.getAbstractFileByPath(path);
		return abstract instanceof TFile ? path : null;
	}

	private getTFileFromPath(path: string): TFile | null {
		const abstract = this.plugin.app.vault.getAbstractFileByPath(path);
		return abstract instanceof TFile ? abstract : null;
	}

	private getAboveBelowPathsAtDrop(futureSibling: HTMLElement, dropPosition: DropPosition) {
		const parent = futureSibling.parentElement;
		if (!parent) return { abovePath: null as string | null, belowPath: null as string | null };

		const siblings = Array.from(parent.children).filter((el): el is HTMLElement =>
			el instanceof HTMLElement && el.classList.contains("tree-item")
		);
		const index = siblings.indexOf(futureSibling);
		if (index < 0) return { abovePath: null as string | null, belowPath: null as string | null };

		const aboveEl = dropPosition === "before" ? siblings[index - 1] ?? null : futureSibling;
		const belowEl = dropPosition === "before" ? futureSibling : siblings[index + 1] ?? null;

		return {
			abovePath: this.getPathFromTreeItem(aboveEl),
			belowPath: this.getPathFromTreeItem(belowEl),
		};
	}

	private summarizeDropTarget(futureSibling: HTMLElement | null, dropPosition: DropPosition) {
		if (!futureSibling) {
			return {
				dropPosition,
				siblingPath: null as string | null,
				abovePath: null as string | null,
				belowPath: null as string | null,
			};
		}

		const siblingPath =
			futureSibling.querySelector<HTMLElement>(":scope > .tree-item-self")?.dataset.path ??
			futureSibling.querySelector<HTMLElement>(".tree-item-self")?.dataset.path ??
			null;

		const { abovePath, belowPath } = this.getAboveBelowPathsAtDrop(futureSibling, dropPosition);
		return { dropPosition, siblingPath, abovePath, belowPath };
	}
}
