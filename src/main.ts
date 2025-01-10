import { Plugin, PluginSettingTab, Setting, App } from "obsidian";
import { CssEditorView, VIEW_TYPE_CSS } from "src/views/CssEditorView";
import { CssSnippetFuzzySuggestModal } from "src/modals/CssSnippetFuzzySuggestModal";
import { ignoreObsidianHotkey } from "src/obsidian/ignore-obsidian-hotkey";
import {
	createSnippetFile,
	deleteSnippetFile,
	toggleSnippetFileState,
} from "./obsidian/file-system-helpers";
import { detachCssFileLeaves, openView } from "./obsidian/workspace-helpers";
import { InfoNotice, ErrorNotice } from "./obsidian/Notice";
import { CssSnippetCreateModal } from "./modals/CssSnippetCreateModal";
import { CssFile } from "./CssFile";
import { exec } from 'child_process';
import { promisify } from 'util';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface CssEditorPluginSettings {
	useExternalEditor: boolean;
	externalEditorPath: string;
}

const DEFAULT_SETTINGS: CssEditorPluginSettings = {
	useExternalEditor: false,
	externalEditorPath: ''
};

class CssEditorSettingTab extends PluginSettingTab {
	plugin: CssEditorPlugin;

	constructor(app: App, plugin: CssEditorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('使用外部编辑器')
			.setDesc('启用后，按下 Enter 键时将使用外部编辑器打开 CSS 文件')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useExternalEditor)
				.onChange(async (value) => {
					this.plugin.settings.useExternalEditor = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('外部编辑器路径')
			.setDesc('设置外部编辑器的可执行文件路径')
			.addText(text => text
				.setPlaceholder('例如: code, notepad++, vim')
				.setValue(this.plugin.settings.externalEditorPath)
				.onChange(async (value) => {
					this.plugin.settings.externalEditorPath = value;
					await this.plugin.saveSettings();
				}));
	}
}

export default class CssEditorPlugin extends Plugin {
	settings: CssEditorPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new CssEditorSettingTab(this.app, this));
		this.addCommand({
			id: "create-css-snippet",
			name: "Create CSS Snippet",
			callback: async () => {
				new CssSnippetCreateModal(this.app, this).open();
			},
		});
		this.addCommand({
			id: "open-quick-switcher",
			name: "Open quick switcher",
			callback: async () => {
				new CssSnippetFuzzySuggestModal(this.app, this).open();
			},
		});
		this.addCommand({
			id: "delete-css-snippet",
			name: "Delete current CSS Snippet",
			checkCallback: (checking) => {
				const activeCssEditorView =
					this.app.workspace.getActiveViewOfType(CssEditorView);
				if (!activeCssEditorView) return false;
				if (checking) return true;
				const { file } = activeCssEditorView.getState();
				if (!file) return;
				const cssFile = new CssFile(file);
				detachCssFileLeaves(this.app.workspace, cssFile).then(
					async () => {
						await deleteSnippetFile(this.app, cssFile);
						new InfoNotice(`"${cssFile.name}" was deleted.`);
					}
				);
			},
		});
		this.addCommand({
			id: "toggle-css-snippet-enabled-status",
			name: "Toggle the enabled/disabled state of current CSS snippet",
			checkCallback: (checking) => {
				const activeCssEditorView =
					this.app.workspace.getActiveViewOfType(CssEditorView);
				if (!activeCssEditorView) return false;
				if (checking) return true;
				const { file } = activeCssEditorView.getState();
				if (!file) return;
				const cssFile = new CssFile(file);
				const isEnabled = toggleSnippetFileState(this.app, cssFile);
				new InfoNotice(
					`"${cssFile.name}" is now ${
						isEnabled ? "enabled" : "disabled"
					}.`
				);
			},
		});

		this.register(
			ignoreObsidianHotkey(
				{ key: "/", modifiers: "Meta" },
				() => !!this.app.workspace.getActiveViewOfType(CssEditorView)
			)
		);

		this.registerView(VIEW_TYPE_CSS, (leaf) => new CssEditorView(leaf, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async createAndOpenSnippet(filename: string, openInNewTab: boolean): Promise<CssFile> {
		const file = await createSnippetFile(this.app, filename, "");
		this.app.customCss?.setCssEnabledStatus?.(file.basename, true);
		new InfoNotice(`${file.name} was created.`);
		if (!this.settings.useExternalEditor) {
			openView(this.app.workspace, VIEW_TYPE_CSS, openInNewTab, {
				file,
			});
		}
		return file;
	}

	async openInExternalEditor(filePath: string): Promise<void> {
		if (!this.settings.useExternalEditor || !this.settings.externalEditorPath) {
			return;
		}

		try {
			const execAsync = promisify(exec);
			await execAsync(`${this.settings.externalEditorPath} "${filePath}"`);
		} catch (error) {
			new ErrorNotice('无法打开外部编辑器，请检查设置');
			console.error('Failed to open external editor:', error);
		}
	}
}
