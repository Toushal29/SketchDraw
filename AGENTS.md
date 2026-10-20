# SketchDraw coding-agent instructions

This file is the project-specific working guide for AI coding agents. Read it before changing source files. Keep it current when the project's purpose or working rules change.

- SketchDraw is a local-first canvas drawing and diagramming app. Keep drawing and simple diagrams approachable; mobile keeps advanced tools collapsed. Live collaboration is out of scope.
- Preserve unrelated work and existing `.sketch` data. Inspect shared geometry, rendering, input, and export paths together before changing canvas behavior.
- Prefer small fixes and existing helpers. Keep platform styles in their owning folders and follow `src/platform/AGENTS.md` for platform-specific code.
- Keep README.md current when user-visible behavior changes.
- **Bug / defect:** existing or directly requested behavior fails. **Visual / layout defect:** content is clipped, misaligned, unreadable, inconsistently spaced, or obscured. **Regression:** a previously working behavior breaks. **Execution / build defect:** parse, type, build, import, runtime, save, or export errors block a workflow. **Enhancement:** a new capability; do not report it as a defect.
- Run `npm run typecheck` and `npm run build` for source changes when possible. Run `npm run test:canvas` when tests or verification are requested. Report only checks that actually ran.

## Project scope

SketchDraw is a local-first drawing and diagramming application. Its primary work happens on a canvas: sketching, general diagrams, software and cloud architecture, network diagrams, BPMN, and related modeling. Sketch files should remain portable and backward-compatible where practical.

Keep the everyday interface approachable for drawing and simple diagramming. Mobile and tablet layouts should show basic tools first and keep advanced controls collapsed. There is no live collaboration feature or planned live-collaboration scope.

## Working rules

- Read the relevant source and nearby helpers before changing behavior. Prefer a small, targeted fix over a broad rewrite.
- Preserve unrelated user changes. The working tree may already contain intentional edits; never reset or replace files just to simplify a change.
- Reuse the app's existing canvas geometry, rendering, file, and history helpers. Avoid introducing parallel implementations of the same behavior.
- Keep canvas rendering, hit testing, selection bounds, snapping, and export geometry consistent. When changing one path, inspect the others that represent the same feature.
- Keep `.component-editor-dock` on a solid `--theme-surface-elevated` background with a subtle outline so it stays readable over the canvas. Keep its contents visually plain, like `.component-editor-content`: no nested card surfaces, decorative borders, or shadows. Use compact type and spacing; reserve simple borders for editable fields and clear control states.
- Preserve existing `.sketch` documents and their references when editing file or model code. Validate old data at import boundaries rather than silently discarding it.
- Keep styles scoped to the owning component or platform. Follow `src/platform/AGENTS.md` for platform-specific work.
- Keep README.md accurate when user-visible features or workflows change.
- Do not add live collaboration, planning, or notebook behavior to the canvas application unless the user explicitly changes project scope.
- Do not run external communication, publish, deploy, or release actions unless explicitly requested.

## What counts as broken

Use these labels when reporting issues so behavior defects stay distinct from new feature requests:

- **Bug / defect:** The app behaves differently from its existing contract or the user's direct action, such as a control that does nothing, navigation that cannot reach an available target, or saving that loses valid canvas data.
- **Visual / layout defect:** Content is clipped, misaligned, hard to read, obscured by the theme, spaced inconsistently, or placed incorrectly at a supported screen size.
- **Regression:** A behavior that worked before a change no longer works, including file compatibility or interactions on another platform.
- **Execution / build defect:** A parse, type, build, import, runtime, save, or export failure prevents an expected workflow from completing.
- **Enhancement:** A capability or workflow that was not previously promised. Record it as an improvement request rather than calling it a defect.

## Change and verification workflow

1. Identify the owner modules and check for existing project or platform instructions.
2. Reproduce or trace the reported behavior, then fix the cause at the narrowest shared layer that is correct.
3. Review linked paths such as pointer input, rendering, hit testing, resizing, serialization, and export where relevant.
4. Update README.md for visible workflow changes.
5. Run `npm run typecheck` and `npm run build` for source changes when the environment permits. Run the browser canvas audit (`npm run test:canvas`) when the user asks for tests or verification, or when the task specifically adds or repairs that audit.
6. Report what changed and which checks actually ran. Do not claim a test passed if it was not run.

## Repository map

- `src/App.tsx`: application state and canvas interaction wiring.
- `src/features/canvas/`: rendering, geometry, pointer input, selection, snapping, and history.
- `src/features/diagrams/`: import/export formats, modeling, layout, routing, and validation.
- `src/features/files/` and `src/features/document/`: Sketch file handling and document lifecycle.
- `src/platform/mobile/` and `src/platform/windows/`: platform-specific UI and behavior.
- `scripts/canvas-performance.browser.ts`: browser-based canvas and interaction checks, run through `npm run test:canvas`.


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

-------------

*.tauri contains the keys for signing*
