import { App, PluginSettingTab, Setting } from 'obsidian';
import ImageScalePlugin from './main';

export interface ImageScaleSettings {
	maintainAspectRatio: boolean;
	showDimensionsWhileResizing: boolean;
	minWidth: number;
	minHeight: number;
	handleSize: number;
	handleColor: string;
}

export const DEFAULT_SETTINGS: ImageScaleSettings = {
	maintainAspectRatio: true,
	showDimensionsWhileResizing: true,
	minWidth: 50,
	minHeight: 50,
	handleSize: 10,
	handleColor: '#4A9EFF'
}

export class ImageScaleSettingTab extends PluginSettingTab {
	plugin: ImageScalePlugin;

	constructor(app: App, plugin: ImageScalePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Maintain aspect ratio')
			.setDesc('Keep the image proportions when resizing')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.maintainAspectRatio)
				.onChange(async (value) => {
					this.plugin.settings.maintainAspectRatio = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show dimensions while resizing')
			.setDesc('Display image dimensions during resize operation')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showDimensionsWhileResizing)
				.onChange(async (value) => {
					this.plugin.settings.showDimensionsWhileResizing = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Minimum width')
			.setDesc('Minimum width for resized images (in pixels)')
			.addText(text => text
				.setPlaceholder('50')
				.setValue(this.plugin.settings.minWidth.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.minWidth = numValue;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Minimum height')
			.setDesc('Minimum height for resized images (in pixels)')
			.addText(text => text
				.setPlaceholder('50')
				.setValue(this.plugin.settings.minHeight.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.minHeight = numValue;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Handle size')
			.setDesc('Size of the resize handles (in pixels)')
			.addText(text => text
				.setPlaceholder('10')
				.setValue(this.plugin.settings.handleSize.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.handleSize = numValue;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Handle color')
			.setDesc('Color of the resize handles (hex color)')
			.addText(text => text
				.setPlaceholder('#4A9EFF')
				.setValue(this.plugin.settings.handleColor)
				.onChange(async (value) => {
					if (/^#[0-9A-F]{6}$/i.test(value)) {
						this.plugin.settings.handleColor = value;
						await this.plugin.saveSettings();
					}
				}));
	}
}
