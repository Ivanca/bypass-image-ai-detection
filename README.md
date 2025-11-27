## Deform and Back (Static Site)

This project is now a plain HTML/JS site. No browser extension, permissions, or install steps are required—everything runs in your browser.

### Quick Start
1. Download or clone this repository.
2. Open `index.html` in any modern browser **or** serve the folder locally (e.g. `npx serve .`).
3. Drag an image into the **Deform** drop-zone, then drop the transformed result into **Restore** to undo it.

Sample assets live in `test-images/` if you want something to try immediately.

### Notes
- All processing happens locally via Canvas APIs.
- The UI works offline; a web server is optional but avoids browser security warnings for local file URLs.
- If you previously loaded this as a Chrome extension, you can safely remove that setup—the manifest and background files are gone now.
