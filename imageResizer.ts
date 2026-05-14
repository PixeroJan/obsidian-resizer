import { App, MarkdownPostProcessorContext, Notice, Plugin, MarkdownView } from 'obsidian';
import { ImageScaleSettings } from './settings';

type ResizableElement = HTMLImageElement | HTMLIFrameElement | HTMLDivElement;

interface ResizeHandle {
	element: HTMLElement;
	position: 'nw' | 'ne' | 'sw' | 'se';
}

export class ImageResizer {
	private app: App;
	private plugin: Plugin;
	private settings: ImageScaleSettings;
	private activeImage: ResizableElement | null = null;
	private handles: ResizeHandle[] = [];
	private overlay: HTMLElement | null = null;
	private dimensionDisplay: HTMLElement | null = null;
	private isResizing = false;
	private startX = 0;
	private startY = 0;
	private startWidth = 0;
	private startHeight = 0;
	private aspectRatio = 1;
	private currentHandle: string | null = null;
	private processedImages = new WeakSet<Element>();
	private finalWidth = 0;
	private finalHeight = 0;

	constructor(app: App, plugin: Plugin, settings: ImageScaleSettings) {
		this.app = app;
		this.plugin = plugin;
		this.settings = settings;
		this.addStyles();
	}

	cleanup() {
		this.deactivateResize();
	}

	private addStyles() {
		// Detect if device has touch support (iPad, mobile, etc.)
		const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

		// Use larger handles on touch devices for easier grabbing
		const handleSize = isTouchDevice ? Math.max(this.settings.handleSize, 15) : this.settings.handleSize;

		// Set CSS variables for dynamic settings
		activeDocument.body.setCssProps({
			'--handle-color': this.settings.handleColor,
			'--handle-size': `${handleSize}px`,
		});
	}

	toggleImageResize(img: ResizableElement) {
		// If this image is already active, deactivate
		if (this.activeImage === img) {
			this.deactivateResize();
		} else {
			// Activate this image
			this.activateResize(img, null);
		}
	}

	makeImageResizable(img: ResizableElement, context: MarkdownPostProcessorContext | null) {
		// Skip if already processed
		if (this.processedImages.has(img)) {
			return;
		}

		// Mark as processed
		this.processedImages.add(img);
		img.dataset.imageScaleProcessed = 'true';

		// Store the source info for later use in updating markdown
		const src = img.getAttribute('src') || (img instanceof HTMLImageElement ? img.src : '') || '';
		if (src) {
			// Extract just the filename
			const filename = src.split('/').pop()?.split('?')[0]?.split('#')[0];
			if (filename) {
				img.dataset.imageFilename = filename;
			}
		}

		// Determine element type
		const isPdfDiv = !!img.classList?.contains('pdf-embed') || !!img.classList?.contains('internal-embed');
		const isImage = img.tagName === 'IMG';

		// For PDF divs, check for scale stored in markdown HTML comment
		if (isPdfDiv) {
			// Get the current file and read it directly
			const file = this.app.workspace.getActiveFile();
			if (file) {
				this.app.vault.read(file).then(content => {
					const lines = content.split('\n');

					// Get the PDF source
					const pdfSrc = img.getAttribute('src') || '';
					const cleanSrc = pdfSrc.split('#')[0];
					const srcFilename = cleanSrc.split('/').pop()?.split('?')[0];

					// Find the line that contains this PDF embed with scale comment
					for (const line of lines) {
						if (line.includes(srcFilename || '') && line.includes('<!-- pdf-scale:')) {
							// Extract scale from comment
							const scaleMatch = line.match(/<!-- pdf-scale:([\d.]+) -->/);

							if (scaleMatch) {
								const scale = parseFloat(scaleMatch[1]);
								this.applyPdfScale(img as HTMLDivElement, scale);
							}
							break;
						}
					}
				}).catch(err => {
					console.error('Error reading file for PDF scale:', err);
				});
			}
		}

		// Wait for image to load (skip for iframes and divs)
		if (isImage && !(img as HTMLImageElement).complete) {
			img.addEventListener('load', () => {
				this.processedImages.delete(img);
				delete img.dataset.imageScaleProcessed;
				this.makeImageResizable(img, context);
			}, { once: true });
			return;
		}

		// Skip if image has no dimensions (doesn't apply to iframes or divs)
		if (isImage && (!(img as HTMLImageElement).naturalWidth || !(img as HTMLImageElement).naturalHeight)) {
			return;
		}

		// Add a visual indicator on hover
		img.classList.add('image-scale-clickable');
		img.title = 'Click to resize';
	}

	private applyPdfScale(pdfDiv: HTMLDivElement, scale: number) {
		pdfDiv.classList.add('image-scale-pdf-scaled');
		pdfDiv.setCssProps({ '--pdf-scale': String(scale) });
	}

	private activateResize(img: ResizableElement, context: MarkdownPostProcessorContext | null) {
		// Deactivate previous image if any
		if (this.activeImage && this.activeImage !== img) {
			this.deactivateResize();
		}

		this.activeImage = img;
		img.classList.add('image-scale-active');

		// Store aspect ratio
		const isIframeOrPdf = img.tagName === 'IFRAME' || !!img.classList?.contains('pdf-embed');

		if (isIframeOrPdf) {
			this.aspectRatio = img.clientWidth / img.clientHeight || 16 / 9; // Default to 16:9 for PDFs
		} else {
			const image = img as HTMLImageElement;
			this.aspectRatio = image.naturalWidth / image.naturalHeight;
		}

		const doc = activeDocument;
		const win = activeWindow;

		// Create overlay as a sibling to body (fixed positioning)
		this.overlay = doc.createElement('div');
		this.overlay.classList.add('image-scale-overlay');
		doc.body.appendChild(this.overlay);

		// Position overlay over the image
		this.positionOverlay(img);

		// Create resize handles
		const positions: Array<'nw' | 'ne' | 'sw' | 'se'> = ['nw', 'ne', 'sw', 'se'];
		positions.forEach(pos => {
			const handle = doc.createElement('div');
			handle.classList.add('image-scale-handle', pos);

			// Mouse events
			handle.addEventListener('mousedown', (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.startResize(e, pos, img, context);
			});

			// Touch events for mobile/tablet
			handle.addEventListener('touchstart', (e) => {
				e.preventDefault();
				e.stopPropagation();
				// Convert touch event to mouse-like event
				const touch = e.touches[0];
				const mouseEvent = new MouseEvent('mousedown', {
					clientX: touch.clientX,
					clientY: touch.clientY,
					bubbles: true,
					cancelable: true
				});
				this.startResize(mouseEvent, pos, img, context);
			}, { passive: false });

			// Prevent default touch behavior on handles
			handle.addEventListener('touchmove', (e) => {
				e.preventDefault();
			}, { passive: false });

			this.overlay?.appendChild(handle);
			this.handles.push({ element: handle, position: pos });
		});

		// Create dimension display if enabled
		if (this.settings.showDimensionsWhileResizing) {
			this.dimensionDisplay = doc.createElement('div');
			this.dimensionDisplay.classList.add('image-scale-dimension-display');
			const width = (img instanceof HTMLImageElement ? img.width : 0) || img.clientWidth;
			const height = (img instanceof HTMLImageElement ? img.height : 0) || img.clientHeight;
			this.updateDimensionDisplay(width, height);
			this.overlay?.appendChild(this.dimensionDisplay);
		}

		// Add click outside to deactivate
		const deactivateHandler = (e: MouseEvent) => {
			const target = e.target as Node;
			if (!img.contains(target) && !this.overlay?.contains(target)) {
				this.deactivateResize();
				doc.removeEventListener('click', deactivateHandler);
			}
		};
		win.setTimeout(() => {
			doc.addEventListener('click', deactivateHandler);
		}, 0);
	}

	private positionOverlay(img: ResizableElement) {
		if (!this.overlay) return;

		const rect = img.getBoundingClientRect();
		const isPdfDiv = !!img.classList?.contains('pdf-embed') || !!img.classList?.contains('internal-embed');

		// Always update position
		this.overlay.setCssStyles({
			top: rect.top + 'px',
			left: rect.left + 'px',
		});

		// For PDFs during resize, don't update size (it's being controlled by onResize)
		// For images and initial setup, update size from the element
		if (!isPdfDiv || !this.isResizing) {
			this.overlay.setCssStyles({
				width: rect.width + 'px',
				height: rect.height + 'px',
			});
		}
	}

	private deactivateResize() {
		if (this.activeImage) {
			this.activeImage.classList.remove('image-scale-active');
			this.activeImage = null;
		}

		if (this.overlay) {
			this.overlay.remove();
			this.overlay = null;
		}

		if (this.dimensionDisplay) {
			this.dimensionDisplay.remove();
			this.dimensionDisplay = null;
		}

		this.handles = [];
	}

	private startResize(e: MouseEvent, handle: string, img: ResizableElement, context: MarkdownPostProcessorContext | null) {
		e.preventDefault();
		this.isResizing = true;
		this.currentHandle = handle;
		this.startX = e.clientX;
		this.startY = e.clientY;

		// Get dimensions - handle different element types
		if (img instanceof HTMLImageElement) {
			this.startWidth = img.width;
			this.startHeight = img.height;
		} else {
			// For divs and iframes, use clientWidth/clientHeight
			this.startWidth = img.clientWidth;
			this.startHeight = img.clientHeight;
		}

		const doc = activeDocument;
		const win = activeWindow;

		const mouseMoveHandler = (ev: MouseEvent) => this.onResize(ev, img);
		const touchMoveHandler = (ev: TouchEvent) => {
			ev.preventDefault();
			const touch = ev.touches[0];
			const mouseEvent = new MouseEvent('mousemove', {
				clientX: touch.clientX,
				clientY: touch.clientY,
				bubbles: true,
				cancelable: true
			});
			this.onResize(mouseEvent, img);
		};

		const mouseUpHandler = (_ev: MouseEvent | TouchEvent) => {
			void (async () => {
				this.isResizing = false;
				doc.removeEventListener('mousemove', mouseMoveHandler);
				doc.removeEventListener('mouseup', mouseUpHandler);
				doc.removeEventListener('touchmove', touchMoveHandler);
				doc.removeEventListener('touchend', mouseUpHandler);
				doc.removeEventListener('touchcancel', mouseUpHandler);

				// Show that we're attempting to save
				new Notice('Saving resize...');

				// Small delay to ensure all DOM updates complete, especially important on iPad
				await new Promise(resolve => win.setTimeout(resolve, 100));

				// Update markdown for both images and PDFs
				try {
					if (img instanceof HTMLImageElement) {
						await this.updateMarkdown(img, context);
					} else if (img.classList?.contains('pdf-embed')) {
						await this.updatePdfMarkdown(img as HTMLDivElement, context);
					}
				} catch (error) {
					new Notice('Error saving resize: ' + (error as Error).message);
				}
			})();
		};

		doc.addEventListener('mousemove', mouseMoveHandler);
		doc.addEventListener('mouseup', mouseUpHandler);
		doc.addEventListener('touchmove', touchMoveHandler, { passive: false });
		doc.addEventListener('touchend', mouseUpHandler);
		doc.addEventListener('touchcancel', mouseUpHandler);
	}

	private onResize(e: MouseEvent, img: ResizableElement) {
		if (!this.isResizing || !this.currentHandle) return;

		const deltaX = e.clientX - this.startX;
		const deltaY = e.clientY - this.startY;

		let newWidth = this.startWidth;
		let newHeight = this.startHeight;

		// Calculate new dimensions based on handle position
		switch (this.currentHandle) {
			case 'se':
				newWidth = this.startWidth + deltaX;
				newHeight = this.startHeight + deltaY;
				break;
			case 'sw':
				newWidth = this.startWidth - deltaX;
				newHeight = this.startHeight + deltaY;
				break;
			case 'ne':
				newWidth = this.startWidth + deltaX;
				newHeight = this.startHeight - deltaY;
				break;
			case 'nw':
				newWidth = this.startWidth - deltaX;
				newHeight = this.startHeight - deltaY;
				break;
		}

		// Maintain aspect ratio if enabled
		if (this.settings.maintainAspectRatio) {
			// Use the larger dimension change to maintain aspect ratio
			const widthChange = Math.abs(newWidth - this.startWidth);
			const heightChange = Math.abs(newHeight - this.startHeight);

			if (widthChange > heightChange) {
				newHeight = newWidth / this.aspectRatio;
			} else {
				newWidth = newHeight * this.aspectRatio;
			}
		}

		// Apply minimum constraints
		newWidth = Math.max(newWidth, this.settings.minWidth);
		newHeight = Math.max(newHeight, this.settings.minHeight);

		// Store final dimensions for saving
		this.finalWidth = Math.round(newWidth);
		this.finalHeight = Math.round(newHeight);

		// Check if this is a PDF div
		const isPdfDiv = !!img.classList?.contains('pdf-embed') || !!img.classList?.contains('internal-embed');

		// For PDFs, don't apply inline styles (they cause scrollbars)
		// Just update the overlay size to show the preview
		if (!isPdfDiv) {
			// Apply new dimensions for images and iframes only
			img.setCssStyles({
				width: `${newWidth}px`,
				height: `${newHeight}px`,
			});

			// For images, also set the width/height attributes
			if (img instanceof HTMLImageElement) {
				img.width = Math.round(newWidth);
				img.height = Math.round(newHeight);
			}
		}

		// Update overlay size to show the new dimensions visually
		if (this.overlay && isPdfDiv) {
			// For PDFs, resize the overlay itself to show the preview
			this.overlay.setCssStyles({
				width: `${newWidth}px`,
				height: `${newHeight}px`,
			});
		}

		// Update overlay position to follow the resized image
		this.positionOverlay(img);

		// Update dimension display
		if (this.dimensionDisplay) {
			this.updateDimensionDisplay(Math.round(newWidth), Math.round(newHeight));
		}
	}

	private updateDimensionDisplay(width: number, height: number) {
		if (this.dimensionDisplay) {
			this.dimensionDisplay.textContent = `${width} × ${height}`;
		}
	}

	private async updateMarkdown(img: HTMLImageElement, context: MarkdownPostProcessorContext | null) {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice('No active file found');
			return;
		}

		// Use stored final dimensions
		const width = this.finalWidth || Math.round(img.width);
		const height = this.finalHeight || Math.round(img.height);

		// Get the active markdown view to access the editor
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) {
			new Notice('No active markdown view');
			return;
		}

		const editor = view.editor;
		const content = editor.getValue();
		const lines = content.split('\n');
		
		// Search through all lines for image syntax and update ALL of them with new size
		// This is safer than trying to find the exact one, especially if there's only one image
		let updated = false;
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			let newLine = line;
			
			// Try wikilink style: ![[filename|size]]
			newLine = newLine.replace(/!\[\[([^\]]+?)(?:\|\d+(?:x\d+)?)?\]\]/g, (_match, path: string) => {
				updated = true;
				return `![[${path}|${width}]]`;
			});
			
			// If not updated, try standard markdown: ![alt](path|size)
			if (newLine === line) {
				newLine = newLine.replace(/!\[([^\]]*)\]\(([^)]+?)(?:\|\d+(?:x\d+)?)?\)/g, (_match, alt: string, path: string) => {
					updated = true;
					const newSize = this.settings.maintainAspectRatio ? width : `${width}x${height}`;
					return `![${alt}](${path}|${newSize})`;
				});
			}
			
			if (newLine !== line) {
				lines[i] = newLine;
			}
		}
		
		if (updated) {
			try {
				const newContent = lines.join('\n');
				editor.setValue(newContent);
				new Notice(`Image resized to ${width}×${height}px`);
			} catch (error) {
				new Notice('Error saving: ' + (error as Error).message);
			}
		} else {
			new Notice('No image syntax found in file');
		}
	}

	private async updatePdfMarkdown(pdfDiv: HTMLDivElement, context: MarkdownPostProcessorContext | null) {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice('No active file found');
			return;
		}

		// For PDFs, get the size from the overlay (since we don't resize the PDF div itself)
		let width: number;
		let height: number;
		
		if (this.overlay) {
			// Get size from overlay
			width = Math.round(parseFloat(this.overlay.style.width) || pdfDiv.clientWidth);
			height = Math.round(parseFloat(this.overlay.style.height) || pdfDiv.clientHeight);
		} else {
			// Fallback to PDF div size
			width = Math.round(pdfDiv.clientWidth);
			height = Math.round(pdfDiv.clientHeight);
		}

		// Get the PDF source
		const src = pdfDiv.getAttribute('src') || '';
		const cleanSrc = src.split('#')[0];

		// Calculate scale factor
		const originalWidth = pdfDiv.scrollWidth;
		const originalHeight = pdfDiv.scrollHeight;
		const baseWidth = originalWidth || pdfDiv.clientWidth;
		const baseHeight = originalHeight || pdfDiv.clientHeight;
		const scaleX = width / baseWidth;
		const scaleY = height / baseHeight;
		const scale = Math.min(scaleX, scaleY);

		// Read file content
		const content = await this.app.vault.read(file);
		const lines = content.split('\n');

		// Find and update the PDF embed line with an HTML comment for scale
		let updated = false;
		const newContent = lines.map(line => {
			if (updated) return line;

			// Check if line contains our PDF
			if (line.toLowerCase().includes('.pdf')) {
				// Pattern for wikilink style PDF embeds, optionally followed by existing scale comment
				// Matches: ![[file.pdf]] or ![[file.pdf]]<!-- pdf-scale:0.75 -->
				const wikilinkPattern = /!\[\[([^#|\]]+\.pdf)(?:#[^\]]+)?(?:\|[^\]]+)?\]\](?:<!--\s*pdf-scale:[\d.]+\s*-->)?/gi;
				
				const newLine = line.replace(wikilinkPattern, (match, pdfPath: string) => {
					// Check if this is our PDF
					if (cleanSrc) {
						const srcFilename = cleanSrc.split('/').pop()?.split('?')[0];
						const pathFilename = pdfPath.split('/').pop()?.split('?')[0];

						if (srcFilename !== pathFilename && pdfPath !== cleanSrc && decodeURIComponent(pdfPath) !== cleanSrc) {
							return match;
						}
					}

					updated = true;

					// Add HTML comment with scale right after the embed
					// Format: ![[file.pdf]]<!-- pdf-scale:0.75 -->
					return `![[${pdfPath}]]<!-- pdf-scale:${scale.toFixed(3)} -->`;
				});

				if (updated) {
					return newLine;
				}
			}
			return line;
		}).join('\n');

		if (updated) {
			try {
				await this.app.vault.modify(file, newContent);
				
				// Apply the scale immediately
				this.applyPdfScale(pdfDiv, scale);
				
				this.deactivateResize();
				
				new Notice(`PDF scaled to ${Math.round(scale * 100)}%`);
			} catch (error) {
				new Notice('Error saving PDF resize: ' + (error as Error).message);
			}
		} else {
			new Notice('Could not update markdown - PDF not found in file');
		}
	}

	private escapeRegExp(string: string): string {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}
}
