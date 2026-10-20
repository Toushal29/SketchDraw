# SketchDraw 14.0.0 (Windows) / 9.0.0 (Android)

## What's new

- Added structural diagram tools: named frames and containers, owned child objects, nested page layers, named connection ports with optional relationship rules, and commands for selecting connected objects and repairing connector routes.
- Improved precision editing with fixed 25-unit grid snapping, rulers, page-local guides, distance measurement, alignment feedback, path-node editing, stroke cleanup, and aspect-aware resizing.
- Expanded diagram and data workflows with D2 support, diagram-source editing, chart creation from CSV and selected tables, mixed chart series, secondary axes, and point annotations.
- Made GUI and reusable components more compact and configurable, including editable text-field properties, group alignment controls, and page links for presentation flows.
- Improved export and presentation workflows for selected regions and frames, multi-frame output, and page transitions.

## Compatibility

- Windows version: `14.0.0`.
- Android version: `9.0.0` (version code `9000000`).
- `.sketch` format remains version 10; `.sdplan` format remains version 1.
- Windows updater artifacts use the configured Tauri updater public key. Android updates must keep using the existing Android release keystore.

## Release validation

- TypeScript typecheck, frontend production build, diagram fixtures, and all 297 canvas browser checks passed.
- Windows executable, NSIS installer, and MSI installer were built. Tauri requested the updater signing-key password before producing update signatures; it is not stored in the local credential backup.
- The Android arm64 release APK was built with version `9.0.0` and version code `9000000`. It is unsigned because the Android release keystore password is not available in the local build configuration.
- These local packages still need release signing before distribution or Android installation.
