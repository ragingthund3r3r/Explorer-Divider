import type { App } from "obsidian";

export function resolveCommandId(app: App, idOrSuffix: string): string | null {
	const trimmed = idOrSuffix.trim();
	if (!trimmed) return null;

	const commands = app.commands.listCommands();

	const exact = commands.find((c) => c.id === trimmed);
	if (exact) return exact.id;

	// Many plugin commands are registered as `<plugin-id>:<command-id>`.
	// If the user provides only the command-id suffix (e.g. `enable-custom-sorting`), resolve it.
	if (!trimmed.includes(":")) {
		const suffix = `:${trimmed}`;
		const matches = commands.filter((c) => c.id.endsWith(suffix));
		if (matches.length === 1) return matches[0].id;
		if (matches.length > 1) return matches[0].id;
	}

	return null;
}

export async function tryExecuteCommand(app: App, idOrSuffix: string): Promise<boolean> {
	const resolved = resolveCommandId(app, idOrSuffix);
	if (!resolved) return false;

	await app.commands.executeCommandById(resolved);
	return true;
}
