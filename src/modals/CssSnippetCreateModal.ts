import { App, Modal, TextComponent } from "obsidian";
import CssEditorPlugin from "src/main";
import { ErrorNotice } from "../obsidian/Notice";

export class CssSnippetCreateModal extends Modal {
	private value: string;
	private plugin: CssEditorPlugin;

	constructor(app: App, plugin: CssEditorPlugin) {
		super(app);
		this.value = "";
		this.plugin = plugin;
	}

	onOpen(): void {
		super.onOpen();
		this.titleEl.setText("Create CSS Snippet");
		this.containerEl.addClass("css-editor-create-modal");
		this.buildForm();
	}

	private buildForm() {
		const textInput = new TextComponent(this.contentEl);
		textInput.setPlaceholder("CSS snippet file name (ex: snippet.css)");
		textInput.onChange((val) => (this.value = val));
		textInput.inputEl.addEventListener("keydown", (evt) => {
			this.handleKeydown(evt);
		});
	}

	private async handleKeydown(evt: KeyboardEvent) {
		if (evt.key === "Escape") {
			this.close();
		} else if (evt.key === "Enter") {
			try {
				const openInNewTab = evt.metaKey;
				const file = await this.plugin.createAndOpenSnippet(
					this.value,
					openInNewTab
				);
				this.close();
				if (this.plugin.settings.useExternalEditor) {
					const filePath = `${getSnippetDirectory(this.app)}${file.name}`;
					this.plugin.openInExternalEditor(filePath).catch(error => {
						new ErrorNotice('无法打开外部编辑器，请检查设置');
						console.error('Failed to open external editor:', error);
					});
				}
			} catch (err) {
				if (err instanceof Error) {
					new ErrorNotice(err.message);
				} else {
					new ErrorNotice("Failed to create file. Reason unknown.");
				}
			}
		}
	}
}
