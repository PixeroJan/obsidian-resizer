# Changelog

All notable changes to the Resizer plugin will be documented in this file.

## 1.0.3 - 2026-06-07

### Fixed

- Fixed shell-style comments disappearing in `bash`, `shell`, `sh`, and `zsh` fenced code blocks when Resizer is enabled.
- Scoped PDF scale metadata hiding to only `<!-- pdf-scale:... -->` comments instead of all CodeMirror comment tokens.

## 1.0.0 - Initial Release

### Added

- Added drag-to-resize support for embedded images and PDFs.
- Added automatic markdown updates for resized images.
- Added PDF scaling persistence through `<!-- pdf-scale:... -->` metadata comments.
- Added settings for aspect ratio, live dimensions, minimum size, handle size, and handle color.
- Added a command to reset image size to the original markdown syntax.
