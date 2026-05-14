import { Plugin, MarkdownView, Notice, Editor } from "obsidian";
import { ImageScaleSettings, DEFAULT_SETTINGS, ImageScaleSettingTab } from "./settings";
import { ImageResizer } from "./imageResizer";

export default class ImageScalePlugin extends Plugin {
settings!: ImageScaleSettings;
private resizer!: ImageResizer;
private observer: MutationObserver | null = null;

async onload() {
await this.loadSettings();
this.resizer = new ImageResizer(this.app, this, this.settings);
this.addSettingTab(new ImageScaleSettingTab(this.app, this));

this.registerMarkdownPostProcessor((element, context) => {
const images = element.querySelectorAll("img");
images.forEach((img: HTMLImageElement) => {
this.resizer.makeImageResizable(img, context);
});

// For PDFs, look for the .pdf-embed container divs
const pdfEmbeds = element.querySelectorAll<HTMLDivElement>(".pdf-embed, .internal-embed.pdf-embed");
pdfEmbeds.forEach((pdfDiv) => {
this.resizer.makeImageResizable(pdfDiv, context);
});
});

this.app.workspace.onLayoutReady(() => {
this.startObserving();
this.processAllImages();
});

this.registerEvent(
this.app.workspace.on("active-leaf-change", () => {
this.processAllImages();
})
);


		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			const target = evt.target as HTMLElement;

			if (target.tagName === "IMG") {
				const img = target as HTMLImageElement;
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView && markdownView.contentEl.contains(img)) {
					evt.preventDefault();
					evt.stopPropagation();
					this.resizer.toggleImageResize(img);
					return false;
				}
			}
			// PDF detection - Obsidian uses div-based PDF viewer, not iframes
			// Check for clicks on PDF elements: textLayer, toolbar, viewer, canvas, etc.
			if (target.classList.contains('textLayerNode') || 
			    target.classList.contains('textLayer') ||
			    target.classList.contains('pdf-toolbar') ||
			    target.classList.contains('pdfViewer') ||
			    target.classList.contains('pdf-container') ||
			    target.tagName === 'CANVAS' ||
			    target.closest('.textLayer, .pdf-toolbar, .pdfViewer, .pdf-container')) {

				// Look for the .internal-embed.pdf-embed container
				const pdfEmbed = target.closest('.internal-embed.pdf-embed, .pdf-embed');
				if (pdfEmbed) {
					const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
					if (markdownView && markdownView.contentEl.contains(pdfEmbed as HTMLElement)) {
						evt.preventDefault();
						evt.stopPropagation();
						// Treat the PDF embed div as the resizable element
						this.resizer.toggleImageResize(pdfEmbed as HTMLDivElement);
						return false;
					}
				}
			}
		}, true);this.addCommand({
id: "reset-image-size",
name: "Reset size to original",
editorCallback: (editor: Editor) => {
const cursor = editor.getCursor();
const line = editor.getLine(cursor.line);
const imageRegex = /!\[([^\]]*)\]\(([^)]+?)(?:\s*\|(\d+)(?:x(\d+))?)?\)/g;
let match;
while ((match = imageRegex.exec(line)) !== null) {
const start = match.index;
const end = start + match[0].length;
if (cursor.ch >= start && cursor.ch <= end) {
const alt = match[1];
const url = match[2];
const newImageMd = `![${alt}](${url})`;
editor.replaceRange(newImageMd,
{ line: cursor.line, ch: start },
{ line: cursor.line, ch: end }
);
new Notice("Image size reset");
return;
}
}
new Notice("No image found at cursor");
}
});
}

onunload() {
if (this.observer) {
this.observer.disconnect();
}
}

async loadSettings() {
this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
}

async saveSettings() {
await this.saveData(this.settings);
}

private startObserving() {
	this.observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.addedNodes.length > 0) {
				mutation.addedNodes.forEach((node) => {
					if (node.instanceOf(HTMLElement)) {
						const images = node.querySelectorAll("img");
						images.forEach((img: HTMLImageElement) => {
							this.resizer.makeImageResizable(img, null);
						});
						if (node.tagName === "IMG") {
							this.resizer.makeImageResizable(node as HTMLImageElement, null);
						}

						// Look for PDF embed divs
						const pdfEmbeds = node.querySelectorAll<HTMLDivElement>(".pdf-embed, .internal-embed.pdf-embed");
						pdfEmbeds.forEach((pdfDiv) => {
							this.resizer.makeImageResizable(pdfDiv, null);
						});
						if (node.classList.contains("pdf-embed")) {
							this.resizer.makeImageResizable(node as HTMLDivElement, null);
						}
					}
				});
			}
		}
	});
	this.observer.observe(activeDocument.body, {
		childList: true,
		subtree: true
	});
}

private processAllImages() {
	const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
	if (!activeView) return;
	const container = activeView.contentEl;
	
	const images = container.querySelectorAll("img");
images.forEach((img: HTMLImageElement) => {
if (!img.dataset.imageScaleProcessed) {
this.resizer.makeImageResizable(img, null);
}
});

// Look for PDF embed divs
const pdfEmbeds = container.querySelectorAll<HTMLDivElement>(".pdf-embed, .internal-embed.pdf-embed");
pdfEmbeds.forEach((pdfDiv) => {
if (!pdfDiv.dataset.imageScaleProcessed) {
this.resizer.makeImageResizable(pdfDiv, null);
}
});
}
}
