# Pen, brush, and canvas performance audit

Date: 10 October 2026

## Scope

Reviewed pointer-down, raw/coalesced pointer input, Android MotionEvent delivery into the WebView, preview drawing, pen-up, history, scene rendering, panning, minimap updates, and background document observation. Preserved the approved stroke geometry, pressure response, rounded ends, and single-pass opacity.

## Findings and changes

| Finding | Change |
| --- | --- |
| Raw pointer updates, coalesced pointer moves, and native Android samples could replay earlier positions or interleave incompatible clocks. | Added an ordered sample gate. Each stroke uses the first available sample stream; duplicate/older timestamps are rejected. Native Ink preview remains enabled. |
| Every pen movement invalidated the whole scene and reactive preview state. | Stroke samples now request a preview frame directly. A temporary background image preserves the scene during drawing; document, style, viewport, image-load, and selection changes still invalidate it. |
| Active strokes triggered repeated full point-array bounds scans. | Preview drawing calls the stroke renderer directly. Ordinary unrotated drawing no longer computes unused rotation bounds. |
| Panning repainted all pressure segments of each visible completed stroke. | Added reusable stroke rasters at the current rendering scale. The cache has a 24 MiB pixel budget, a 256-entry limit, and a 4 MiB per-entry limit. Oversized strokes use the existing clipped path renderer. Hot entries are retained when the working set exceeds the budget, preventing eviction/rebuild loops. |
| Panning rebuilt simplified modeling components, invalidating their geometry and text caches. | Memoized styled components by immutable element identity, theme, and component appearance. |
| Every viewport update normalized the whole document immediately, even though sync observation was debounced. | Deferred snapshot construction as well as observation. Active drawing, panning, moving, and resizing postpone this background work. Explicit save/recovery still prepare current snapshots. Background autosave and sync polling also wait while panning. |
| Pen-up deep-copied all existing geometry for undo, then discarded the live stroke's path-cache identity. | Stroke append history retains the immutable prior elements. The completed stroke takes ownership of its point array. Undo/redo regression coverage checks later edits and restoration. |
| Dotted grids submitted a separate fill per dot. | Batched the grid dots into one fill operation. |
| The minimap scanned every element and invalidated all object markers on each pan. | Cached content bounds and retained equal minimap bounds. Only viewport-dependent work updates during a pan within existing content bounds. |

The temporary drawing background is released at pen-up, when its canvas disappears, or on disposal. Stroke raster caches clear on file/page/theme changes. They are disposable rendering data and are never saved to `.sketch` files.

## Measurements

Local headless Chromium, software rendering, 1200 × 800 canvas. The baseline was copied from the working implementation before this audit's edits. Paint completion was forced with a canvas readback; initial warm-up frames were excluded from the panning measurements.

| Workload | Before median / p95 | After median / p95 |
| --- | --- | --- |
| Panning 160 visible pressure strokes, 240 samples each | 104.5 / 165.3 ms | 0.8 / 1.1 ms |
| Live 3,200-sample pressure stroke, final half of drawing | 9.9 / 12.6 ms | 9.6 / 12.7 ms |

The panning result measures the stroke-rendering workload after the cache warms up, not full-application input latency or device FPS. Long live-stroke rasterization is essentially unchanged. The authoring improvement comes from removing unrelated scene painting, repeated input processing, document work, and copying around it.

## Validation

- 41 browser checks passed: round-cap opacity, all six brush opacities, mouse/touch and pressure rendering, thickness/color/sample/zoom invalidation, bounded point reads, input ordering, background reuse/invalidation, resize, pen-up, and cache saturation.
- Pressure-rendered fixture alpha values matched the pre-change renderer exactly. Nonpressure fixtures differed by at most 1 of 255 alpha levels after raster caching.
- 16 focused persistence, sync, history, spatial-index, and component tests passed.
- TypeScript check and production build passed. Existing App.tsx/Babel and bundle-size warnings remain.

Repeat browser checks with `npm run test:canvas`. Set `CANVAS_TEST_BROWSER` to a Chromium executable if it is not installed in the standard Windows Edge/Chrome locations. For an explicit before/after comparison, set `BASELINE_STROKE_RENDERER` to a saved copy of the previous `freehand-rendering.ts`. The runner uses and removes its own temporary browser profile.

## Remaining limits

- Physical S Pen / touch hardware latency and the native Android compositor were not measured; no Android native code was changed in this audit.
- Scenes exceeding the raster budget use vector fallback for overflow. First paint and zoom changes still need to build paths/rasters.
- Very long live strokes still repaint their full current geometry. If device profiling shows this is the next bottleneck, a dirty-region renderer should be evaluated against the same cap/opacity checks before changing stroke geometry.
