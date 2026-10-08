# Platform-specific changes

- Put Windows-only components and styles in `windows/`; put mobile and tablet components and styles in `mobile/`.
- Gate Windows-only rendering and behavior with `isWindowsPlatform()` from `runtime.ts`. The app shell also exposes the `platform-windows` class for scoped styles.
- Keep Windows-only styles in `windows/windows.css` or a stylesheet in `windows/`, never in the mobile stylesheets.
- Keep the current mobile and tablet behavior unchanged when adding Windows-only features. Edit files under `mobile/` only when a task explicitly asks for a mobile or tablet change.
- Put code in shared `src/` modules only when it is intended to behave the same on Windows and mobile/tablet.
