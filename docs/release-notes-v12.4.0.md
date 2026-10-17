# SketchDraw 12.4.0 (Windows) / 7.4.0 (Android)

## What's new

- Kept Canvas and Planning in separate `.sketch` and `.sdplan` files, with file-open associations for Planning files on Windows and Android.
- Added editable draw.io and Excalidraw interchange, CSV and Graphviz DOT diagrams, PlantUML class/object diagrams, and reverse diagram-code exports for Mermaid, DOT, CSV, PlantUML, SQL, and JSON Schema.
- Added embedded web previews for supported HTTPS links on the canvas.
- Expanded Planning with reports, print support, CSV and calendar exchange, multiple-plan browsing, task estimates and recurrence, filters, workflow columns, and a more complete timeline.

## Improvements

- Added bounded canvas tile caching and incremental spatial-index updates so edits and viewport changes can redraw only affected canvas areas.
- Kept each pen stroke as one editable object and reduced redundant live-stroke rendering work.
- Reduced repeated full-document serialization and Windows sync observation work.
- Fixed returning from Planning to Canvas so the canvas redraws immediately without waiting for pointer input.
- Corrected light and dark theme tokens and refreshed the welcome and Planning surfaces.
- Updated release signing to the current Windows updater key and incremented the Android version code to `7040000`.

## Downloads

- Windows: signed SketchDraw installer and updater artifacts attached to the GitHub release.
- Android: signed arm64 APK attached to the GitHub release.
