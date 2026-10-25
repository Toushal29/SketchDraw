# Sketch file format v2

`.sketch` is a portable JSON document. Its current remastered format is version 2. The new envelope places canvas data directly under `canvas` and writes compact JSON:

```json
{
  "format": "SketchDraw",
  "version": 2,
  "canvas": {
    "activePageId": "page-id",
    "pages": [],
    "componentMasters": []
  }
}
```

`componentMasters` and `windowsSync` are omitted when they have no data. Pages keep their canvas state, layers, and elements together. Master definitions are deduplicated by ID at the canvas level; component instances stay with their page so their geometry, child IDs, bindings, and per-instance overrides remain intact. Self-contained Library component metadata stays with its group element. The serializer reuses cached JSON for unchanged page elements and component master definitions, then inserts those chunks into the compact document. This avoids re-encoding unchanged content while keeping files standard JSON that users can inspect and move between platforms.

## Supported input

- Version 2 files use the remastered root `canvas` envelope.
- Legacy version 9 files use `sections.canvas`, `sections.notebook`, and `sections.retiredLibraryArchive`. Notebook notes are imported into Planning during the existing confirmation flow.
- Legacy version 10 files use `sections.canvas` and may include canvas component masters.
- Versions 1–8 and other versions are rejected. The version 2 root envelope is required, so this remaster does not accept the unrelated historic version 2 layout.

Opening an editable v9 or v10 file presents the existing refactor confirmation. Accepting it saves a new v2 canvas document; declining closes the source without saving. The source is not replaced before the user accepts. Read-only opens do not start the conversion flow.

## Validation and size limits

Both new and legacy documents pass through the same element, reference, layer, component-master, and resource-limit validation before entering the canvas. A document can contain up to 100 component masters. Saving rejects conflicting definitions that reuse one master ID instead of silently losing one. The limits are enforced during both loading and saving so a file the app writes can be reopened safely. Keep format dispatch and legacy extraction in `src/features/files/parse-sketch.ts`, and keep the v2 envelope and compact page and master encoding in `src/features/files/document-codec.ts`.
