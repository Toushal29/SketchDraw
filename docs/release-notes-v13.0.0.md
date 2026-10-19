# SketchDraw 13.0.0 (Windows) / 8.0.0 (Android)

## What's new

- Rebuilt editable charts around a shared vector renderer, with additional chart types and controls for data, series, colors, labels, legends, grids, and line appearance.
- Moved Markdown, table, code note, sticky note, and checklist editing into a compact right-side editor and simplified their canvas cards.
- Expanded architecture, cloud, network, BPMN, UML, and ER modeling components, with improved provider artwork, label placement, and component specimen sheets.
- Expanded diagram interchange and infrastructure imports, including draw.io, Excalidraw, Mermaid, DOT, CSV, PlantUML, Kubernetes, Terraform, and cloud templates.
- Added separate `.sdplan` planning files and file associations while keeping sketch pages in portable `.sketch` documents.

## Improvements

- Improved freehand rendering, stroke caching, and incremental spatial indexing to keep drawing responsive while preserving editable strokes.
- Refined connector routing, canvas snapping, model labels, and component rendering across canvas and vector exports.
- Kept Android on a separate release version sequence and advanced its version code to `8000000`.

## Compatibility

- Windows version: `13.0.0`.
- Android version: `8.0.0` (version code `8000000`).
- `.sketch` format remains version 10; `.sdplan` format remains version 1.
- Windows updater artifacts use the configured v2 updater public key. The Android release workflow signs the APK with the existing Android release keystore.

## Downloads

- Windows: signed installer, MSI, updater signatures, and updater manifest are attached.
- Android: signed arm64 APK is attached.
