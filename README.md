# SketchDraw

SketchDraw is a Windows desktop sketching studio for diagrams, whiteboards, and visual notes. The editor runs locally and works with files the user chooses through the Windows file picker.

**Application version 10.0.0 | Document format v10 | Windows only**

## Canvas

- Draw with a pressure-sensitive pen, shapes, connectors, text, sticky notes, and checklists.
- Organize a drawing into pages; use selection, layers, alignment, snapping, undo and redo, and keyboard or mouse shortcuts.
- Import raster and SVG images. Export PNG, SVG, or PDF.
- Save portable `.sketchdraw` files to a local folder or a user-selected sync folder. Shared copies can merge independent page and object changes.
- Choose light or dark appearance, canvas patterns, and editor colors in the settings menu.

Canvas note cards stay on the drawing as editable objects. SketchDraw is a canvas-only Windows application.

## File format

Version 10 uses a new JSON-based, canvas-only format. `.sketchdraw` is the only supported document extension. Older document formats are unsupported.

## Architecture

- `src/App.tsx` composes the Windows shell, canvas editing operations, menus, and dialogs.
- `src/features/document/` owns the active document session, lifecycle, conflict handling, and recovery.
- `src/features/files/` owns v10 encoding, validation, and scoped file access.
- `src/features/canvas/` contains input transforms, rendering, hit testing, spatial indexing, selection, and history.
- `src/platform/windows/` contains Windows shortcuts, document tabs, command palette, sync metadata, and the Windows studio presentation.
- `src-tauri/src/lib.rs` provides picker-scoped access, atomic saves, recent file paths, and file rename commands. The native layer does not request broad storage access.

The document model is the stable boundary between the editor and file services. Canvas interaction uses shared pointer samples so mouse and Windows pen input follow the same editor path. File writes are checked against the last read baseline and use a same-directory temporary file for replacement.

## Development

```powershell
npm install
npm run dev:windows
```

`npm run build` builds the frontend; `npm run test:focused` runs the focused suite.
