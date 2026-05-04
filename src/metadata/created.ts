import type { App, TFile } from "obsidian";

function parseCreatedFrontmatterValue(value: unknown): number | null {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}

	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) return null;

		// Your existing workflow stores millisecond timestamps as strings.
		if (/^\d+$/.test(trimmed)) {
			const asInt = Number.parseInt(trimmed, 10);
			return Number.isFinite(asInt) ? asInt : null;
		}

		const asFloat = Number.parseFloat(trimmed);
		if (Number.isFinite(asFloat) && `${asFloat}` === trimmed) return asFloat;

		const asDate = Date.parse(trimmed);
		return Number.isFinite(asDate) ? asDate : null;
	}

	return null;
}

export function readCreatedFromMetadataCache(app: App, file: TFile): number | null {
	const cache = app.metadataCache.getFileCache(file);
	const rawValue = cache?.frontmatter?.created;
	return parseCreatedFrontmatterValue(rawValue);
}

export function readCreatedForAboveBelowFromMetadataCache(
	app: App,
	params: { aboveFile: TFile | null; belowFile: TFile | null }
): { aboveCreated: number | null; belowCreated: number | null } {
	return {
		aboveCreated: params.aboveFile ? readCreatedFromMetadataCache(app, params.aboveFile) : null,
		belowCreated: params.belowFile ? readCreatedFromMetadataCache(app, params.belowFile) : null,
	};
}

export function computeDividerCreatedTimestamp(params: {
	abovePath: string | null;
	belowPath: string | null;
	aboveCreated: number | null;
	belowCreated: number | null;
}): number | null {
	// Invalid case: no surrounding files to base the divider on.
	if (params.abovePath === null && params.belowPath === null) return null;

	if (params.abovePath === null) {
		if (params.belowCreated === null) return null;
		return Math.round(params.belowCreated + 1);
	}

	if (params.belowPath === null) {
		if (params.aboveCreated === null) return null;
		return Math.round(params.aboveCreated - 1);
	}

	if (params.aboveCreated === null || params.belowCreated === null) return null;
	return Math.round((params.aboveCreated + params.belowCreated) / 2);
}

export async function writeCreatedToFrontmatter(app: App, file: TFile, created: number): Promise<void> {
	await app.fileManager.processFrontMatter(file, (frontmatter) => {
		frontmatter.created = String(created);
	});
}
