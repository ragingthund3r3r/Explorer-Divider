import { App, PluginSettingTab, Setting } from "obsidian";
import ExplorerDividerPlugin from "./main";

export interface ExplorerDividerSettings {
	dividerFileName: string;
	sortRefreshCommandIdOrSuffix: string;
}

export const DEFAULT_SETTINGS: ExplorerDividerSettings = {
	dividerFileName: "--------------.md",
	sortRefreshCommandIdOrSuffix: "enable-custom-sorting",
};

export class ExplorerDividerSettingTab extends PluginSettingTab {
	plugin: ExplorerDividerPlugin;

	constructor(app: App, plugin: ExplorerDividerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Divider file name")
			.setDesc('Default: "--------------.md"')
			.addText((text) =>
				text
					.setPlaceholder("--------------.md")
					.setValue(this.plugin.settings.dividerFileName)
					.onChange(async (value) => {
						this.plugin.settings.dividerFileName = value.trim() || "--------------.md";
						await this.plugin.saveSettings();
					})
			);

			new Setting(containerEl)
				.setName("Sorting refresh command")
				.setDesc("Executed after dropping a divider to force the other sorting plugin to refresh.")
				.addText((text) =>
					text
						.setPlaceholder("enable-custom-sorting")
						.setValue(this.plugin.settings.sortRefreshCommandIdOrSuffix)
						.onChange(async (value) => {
							this.plugin.settings.sortRefreshCommandIdOrSuffix = value.trim();
							await this.plugin.saveSettings();
						})
				);
	}
}
