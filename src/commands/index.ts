import type ExplorerDividerPlugin from "../main";
import { registerCreateDividerCommand } from "./registerCreateDividerCommand";

export function registerCommands(plugin: ExplorerDividerPlugin) {
	registerCreateDividerCommand(plugin);
}
