# SketchDraw repository guide

This guide is the short map for coding agents working in SketchDraw. Read it with `AGENTS.md` before changing source.

## Product scope

SketchDraw is a local-first drawing and diagramming app for Windows and Android. Its canvas supports freehand sketching, general diagrams, software and cloud architecture, network diagrams, BPMN, and related modeling. Canvas documents use the portable `.sketch` format; separate Planning files use `.sdplan`. Keep the everyday interface simple, keep advanced mobile tools collapsed, and preserve compatibility with existing files. Live collaboration is out of scope.

## Issue labels

- **Bug / defect:** Existing or directly requested behavior fails.
- **Visual / layout defect:** Content is clipped, misaligned, unreadable, inconsistently spaced, or obscured.
- **Regression:** Previously working behavior breaks, including across supported platforms or file versions.
- **Execution / build defect:** A parse, type, build, import, runtime, save, or export error blocks an expected workflow.
- **Enhancement:** A new capability or workflow that was not already promised.

Use these labels in audits and release reports so defects stay distinct from feature requests.

## Repository map

- `src/App.tsx`: application state and canvas interaction wiring.
- `src/features/canvas/`: rendering, geometry, pointer input, selection, snapping, and history.
- `src/features/components/`: canvas component and chart rendering.
- `src/features/diagrams/`: modeling, import/export formats, layout, routing, and validation.
- `src/features/files/` and `src/features/document/`: Sketch file parsing, serialization, and document lifecycle.
- `src/features/project/`: separate `.sdplan` planning workflows.
- `src/platform/mobile/` and `src/platform/windows/`: platform-specific UI and behavior. Follow `src/platform/AGENTS.md` for platform changes.
- `src-tauri/`: native Windows and Android configuration and code.
- `scripts/canvas-performance.browser.ts`: optional browser-based canvas interaction checks.

## Change workflow

1. Read `AGENTS.md` and any nearby platform instructions. Check the working tree and preserve unrelated edits.
2. Trace the owning code and shared geometry, rendering, input, history, persistence, and export paths before changing canvas behavior.
3. Fix the cause at the narrowest shared layer. Validate older file data at import boundaries; do not silently discard valid content.
4. Keep styles in their owning component or platform folders. Keep mobile tools approachable and advanced controls collapsed.
5. Update `README.md` when user-visible behavior changes. Update release notes and all platform version fields for releases.
6. Run `npm run typecheck` and `npm run build` for source changes when possible. Run `npm run test:canvas` when requested or when changing that audit; report only checks that actually ran.
7. Do not publish, deploy, send external communications, or release unless the user explicitly requests it.

## Canvas consistency

When changing a canvas feature, keep rendering, hit testing, selection bounds, snapping, resize behavior, and export geometry consistent. Use existing shared helpers instead of creating parallel implementations. Preserve pen and stylus smoothness while optimizing rendering.
