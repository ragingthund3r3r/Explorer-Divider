import type { App, WorkspaceLeaf } from "obsidian";

function getFileExplorerLeaf(app: App): WorkspaceLeaf | undefined {
	return app.workspace.getLeavesOfType("file-explorer")[0];
}

export async function waitForFileExplorerEl(app: App, timeoutMs = 10_000): Promise<HTMLElement> {
	const start = Date.now();

	return await new Promise<HTMLElement>((resolve, reject) => {
		const tick = () => {
			// Fast-path: if the explorer is already in the DOM, use it.
			const domEl = document.querySelector<HTMLElement>("[data-type='file-explorer'] .nav-files-container");
			if (domEl) return resolve(domEl);

			const leaf = getFileExplorerLeaf(app);
			const containerEl = leaf?.view?.containerEl;

			const navFilesContainer = containerEl?.querySelector<HTMLElement>(".nav-files-container");
			if (navFilesContainer) return resolve(navFilesContainer);

			if (Date.now() - start > timeoutMs) {
				return reject(new Error("Timed out waiting for file explorer element"));
			}

			window.setTimeout(tick, 100);
		};

		tick();
	});
}
