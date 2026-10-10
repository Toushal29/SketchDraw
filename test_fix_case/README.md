# Test fix case

This folder contains review copies of the current stylus input path.

- `AndroidStylusInkController.copy.kt` copies the Android `MotionEvent` listener, pressure/tilt/orientation sampling, and Jetpack Ink in-progress stroke preview.
- `AndroidStylusPlugin.copy.kt` copies the Tauri bridge that configures the native preview.
- `MainActivity.copy.kt` copies the activity hooks that forward stylus events and dispose the preview.
- `canvas-stylus-input.copy.ts` copies the Web PointerEvent pressure, tilt, and orientation adapter.
- `stylus-event-handling.copy.md` assembles the related App and UI excerpts, including pressure-width rendering, and points to the Android bridge.

The `.copy` files are snapshots of the application sources. They live outside the configured Android and TypeScript source roots, so they are not added to the app build or loaded at runtime. Refresh these copies when the corresponding application files change.
