import { Notice } from "obsidian";
import type ExplorerDividerPlugin from "../main";
import { createDividerFileInFolder, getActiveParentFolder } from "../divider/createDividerFile";

export function registerCreateDividerCommand(plugin: ExplorerDividerPlugin) {
	plugin.addCommand({
		id: "create-divider-in-active-file-folder",
		name: "Create divider in active file's folder",
		callback: async () => {
			const folder = getActiveParentFolder(plugin.app);
			const dividerFileName = plugin.settings.dividerFileName;

			try {
				const dividerFile = await createDividerFileInFolder(plugin.app, folder, dividerFileName);
				await plugin.app.workspace.getLeaf(false).openFile(dividerFile);
			} catch (error) {
				console.error("Explorer-Divider: failed to create divider", error);
				new Notice("Failed to create divider file. See console for details.");
			}
		},
	});
}
