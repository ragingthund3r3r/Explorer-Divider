import { Plugin } from "obsidian";
import {
	DEFAULT_SETTINGS,
	ExplorerDividerSettings,
	ExplorerDividerSettingTab,
} from "./settings";
import { registerCommands } from "./commands";
import { DividerDndManager } from "./dnd/DividerDndManager";

export default class ExplorerDividerPlugin extends Plugin {
	settings: ExplorerDividerSettings;
	private dividerDndManager: DividerDndManager | null = null;
	private isEnablingDnd = false;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new ExplorerDividerSettingTab(this.app, this));
		registerCommands(this);

		// The file explorer leaf can be created after plugin onload.
		// Enable DnD once the layout is ready, and retry on later layout changes.
		this.app.workspace.onLayoutReady(() => {
			void this.maybeEnableDividerDnd();
		});
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				void this.maybeEnableDividerDnd();
			})
		);
	}

	onunload() {
		this.dividerDndManager?.disable();
		this.dividerDndManager = null;
	}

	private async maybeEnableDividerDnd(): Promise<void> {
		if (this.dividerDndManager) return;
		if (this.isEnablingDnd) return;
		this.isEnablingDnd = true;
		try {
			const manager = new DividerDndManager(this);
			await manager.enable();
			this.dividerDndManager = manager;
			this.register(() => this.dividerDndManager?.disable());
		} catch (error) {
			// Don't spam; this can happen if the user has the file explorer closed.
			console.warn("Explorer-Divider: failed to enable divider DnD", error);
		} finally {
			this.isEnablingDnd = false;
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<ExplorerDividerSettings>
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
