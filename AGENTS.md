# SketchDraw coding-agent instructions

This file is the project-specific working guide for AI coding agents. Read it before changing source files. Keep it current when the project's purpose or working rules change.

- SketchDraw is a local-first canvas drawing and diagramming app. Keep drawing and simple diagrams approachable; mobile keeps advanced tools collapsed. Live collaboration is out of scope.
- Preserve unrelated work and existing `.sketch` data. Inspect shared geometry, rendering, input, and export paths together before changing canvas behavior.
- Prefer small fixes and existing helpers. Keep platform styles in their owning folders and follow `src/platform/AGENTS.md` for platform-specific code.
- Keep README.md current when user-visible behavior changes.
- **Bug / defect:** existing or directly requested behavior fails. **Visual / layout defect:** content is clipped, misaligned, unreadable, inconsistently spaced, or obscured. **Regression:** a previously working behavior breaks. **Execution / build defect:** parse, type, build, import, runtime, save, or export errors block a workflow. **Enhancement:** a new capability; do not report it as a defect.
- Run `npm run typecheck` and `npm run build` for source changes when possible. Run `npm run test:canvas` when tests or verification are requested. Report only checks that actually ran.

The detailed definitions, repository map, and change workflow live in [AGENT.md](./AGENT.md).

## Project scope

SketchDraw is a local-first drawing and diagramming application. Its primary work happens on a canvas: sketching, general diagrams, software and cloud architecture, network diagrams, BPMN, and related modeling. Sketch files should remain portable and backward-compatible where practical.

Keep the everyday interface approachable for drawing and simple diagramming. Mobile and tablet layouts should show basic tools first and keep advanced controls collapsed. There is no live collaboration feature or planned live-collaboration scope.

## Working rules

- Read the relevant source and nearby helpers before changing behavior. Prefer a small, targeted fix over a broad rewrite.
- Preserve unrelated user changes. The working tree may already contain intentional edits; never reset or replace files just to simplify a change.
- Reuse the app's existing canvas geometry, rendering, file, and history helpers. Avoid introducing parallel implementations of the same behavior.
- Keep canvas rendering, hit testing, selection bounds, snapping, and export geometry consistent. When changing one path, inspect the others that represent the same feature.
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
