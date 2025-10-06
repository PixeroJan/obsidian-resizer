# Resizer Plugin for Obsidian

Scale and resize embedded images and PDFs in Obsidian by dragging corners. The plugin automatically updates the markdown with the correct dimensions.

## Features

-  **Drag to Resize**: Click on any embedded image or PDF and drag the corner handles to resize
-  **Proportional Scaling**: Maintains aspect ratio while resizing (can be disabled in settings)
-  **Auto-update Markdown**: Automatically updates your markdown with the correct dimensions
-  **PDF Support**: Resize embedded PDFs with CSS transform scaling
-  **Persistent Scaling**: PDF scales stored in markdown as HTML comments for cross-device sync
-  **Customizable**: Adjust handle size, color, and minimum dimensions in settings
-  **Live Dimensions**: See the dimensions while resizing (optional)
-  **Reset Command**: Command to reset image to original size

## Usage

### Resizing Images

1. Click on any embedded image in Live Preview mode
2. Resize handles will appear at the four corners
3. Drag any corner handle to resize the image
4. Release to apply - the markdown will be automatically updated

### Resizing PDFs

1. Click on any embedded PDF in Live Preview mode
2. Resize handles will appear at the four corners
3. Drag any corner handle to scale the PDF
4. Release to apply - the scale is saved as an HTML comment in markdown

### Markdown Format

**Images** are updated with Obsidian's native syntax:

```markdown
![[image.png|width]]
![alt text](image.png|width)
```

**PDFs** are scaled using HTML comments:

```markdown
![[document.pdf]]<!-- pdf-scale:0.75 -->
```

The HTML comment stores the scale factor (e.g., 0.75 = 75% of original size) and syncs across devices.

### Commands

- **Reset size to original**: Removes size specifications from the image at cursor

## Settings

- **Maintain aspect ratio**: Keep image/PDF proportions when resizing
- **Show dimensions while resizing**: Display dimensions during resize
- **Minimum width/height**: Set minimum constraints for resizing
- **Handle size**: Customize resize handle size (default: 12px)
- **Handle color**: Customize resize handle color (default: #4a9eff)

## Installation

### From Obsidian

1. Open Settings → Community Plugins
2. Disable Safe Mode
3. Click Browse and search for "Resizer"
4. Install and enable the plugin

### Manual Installation

1. Download the latest release
2. Extract to your vault's `.obsidian/plugins/resizer/` directory
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

## How It Works

### Images

- Detects clicks on embedded images in Live Preview mode
- Creates a fixed-position overlay with corner handles
- Updates image dimensions using Obsidian's native `|width` syntax
- Changes persist in the markdown file

### PDFs

- Detects clicks on PDF viewer elements (text layer, toolbar, canvas)
- Applies CSS `transform: scale()` to the PDF container
- Stores scale factor as HTML comment: `<!-- pdf-scale:0.75 -->`
- Scale is restored when reopening the note (cross-device compatible)

## Development

```bash
# Install dependencies
npm install

# Run in development mode (auto-rebuild on changes)
npm run dev

# Build for production
npm run build
```

## Technical Details

- **Build**: ESBuild + TypeScript
- **Editor Mode**: Live Preview (CodeMirror 6)
- **Event Handling**: Capture phase click listeners to intercept before Obsidian
- **Positioning**: Fixed positioning overlay on document.body to avoid layout conflicts
- **PDF Scaling**: CSS transform instead of markdown syntax (which doesn't work for PDFs)
- **Persistence**: Images use `|width`, PDFs use HTML comments

## Known Limitations

- Only works in Live Preview mode (not Reading mode)
- PDF scaling uses CSS transform, so original PDF size determines scroll area
- Minimum dimensions apply to prevent accidental over-shrinking

## License

MIT

## Limitations

- The crop function is experimental as Markdown doesn't natively support image cropping
- Works best in reading mode; live preview support is limited

## Support

If you encounter any issues or have feature requests, please file them on the [GitHub repository](https://github.com/yourusername/obsidian-image-scale).

## License

MIT License
