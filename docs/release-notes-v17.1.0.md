# SketchDraw 17.1.0 (Windows) / 17.1.0 (Android)

## Fixes and improvements

- Reopen `.sketch` files whose canvas background uses valid three-digit hexadecimal color notation.
- Keep horizontal and vertical edge resizing on one axis when component handles overlap; corner handles continue to resize on both axes.
- Add inline bold, italic, underline, highlight, strikethrough, and code formatting to note, sticky-note, and checklist content, with Ctrl/⌘ shortcuts for bold, italic, and underline.
- Allow checklist section headings written as `**Section title**` without turning them into checkbox items.
- Use measured text width and tighter right padding so note and checklist lines use more of their available space before wrapping.

## Compatibility

- Windows version: `17.1.0`.
- Android version: `17.1.0` (version code `17010000`).
- New `.sketch` files use format version 2. Legacy `.sketch` versions 9 and 10 can be opened and converted after confirmation.
- `.sdplan` format remains version 1.
- Windows updater bundles and the Android APK are signed by the GitHub release workflow.
