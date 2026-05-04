import { App, Notice, TFile, TFolder, normalizePath } from "obsidian";

function buildChildPath(parent: TFolder, childName: string): string {
	const parentPath = parent.path;
	return normalizePath(parentPath ? `${parentPath}/${childName}` : childName);
}

export function getActiveParentFolder(app: App): TFolder {
	const activeFile = app.workspace.getActiveFile();
	if (activeFile?.parent) return activeFile.parent;
	return app.vault.getRoot();
}

export async function createDividerFileInFolder(
	app: App,
	folder: TFolder,
	dividerFileName: string
): Promise<TFile> {
	const filePath = buildChildPath(folder, dividerFileName);
	const existing = app.vault.getAbstractFileByPath(filePath);

	if (existing instanceof TFile) {
		new Notice(`Divider already exists in folder: ${dividerFileName}`);
		return existing;
	}

	if (existing instanceof TFolder) {
		throw new Error(`A folder already exists at path: ${filePath}`);
	}

	const now = Date.now().toString();
	const initialContent = `---\ncreated: "${now}"\nmodified: "${now}"\n---\n`;

	const createdFile = await app.vault.create(filePath, initialContent);
	new Notice(`Created divider: ${dividerFileName}`);
	return createdFile;
}
