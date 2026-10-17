# SketchDraw feature audit

Reviewed: 17 October 2026
App versions: Windows 12.3.0; Android 7.3.0

This is a source-level audit of the app UI, document model, project workspace, file handling, platform code, README, and existing screenshots. It describes features present in the code and identifies gaps against Excalidraw, draw.io, and collaborative planning boards. The listed gaps are recommendations, not claims that the features are already underway.

## Features in the app

- **Local sketch files:** Create, open, rename, save, and close portable `.sketch` documents stored in a folder chosen by the user. Files can live in OneDrive, Dropbox, Google Drive, or another synced folder.
- **Canvas and Planning workspaces:** Each sketch keeps its drawing pages and planning information in one document.
- **Canvas pages:** Create, name, duplicate, reorder, and delete pages. A document supports up to 100 pages.
- **Recent files and desktop tabs:** Home lists recent sketches. Windows supports multiple open sketch tabs.
- **Autosave and recovery:** Choose a 5- or 10-second autosave interval. Recover changes after an interrupted session.
- **Older-file support:** Read SketchDraw document versions 1–8 and migrate them to the current version when saved.
- **Drawing tools:** Use pen, fine pen, pencil, soft brush, marker, highlighter, chalk, laser pointer, eraser, bucket fill, and image crop tools.
- **Touch and stylus input:** Draw and navigate with touch; supported styluses can provide pressure, tilt, and eraser-end input. Touch gestures can be configured.
- **Shapes and symbols:** Add geometric shapes and a broad built-in set of flowchart, process, database, network, UML, ER, C4, BPMN, cloud, software, chart, and wireframe components.
- **Connectors:** Create straight, curved, multi-point, elbow, forked, loop, and jagged connectors. Attach ends to shapes, edit route points, and choose line and arrowhead styles. Windows also has obstacle-aware connector routing.
- **Edit and arrange:** Select, move, resize, rotate, group, duplicate, align, and distribute objects. Copy, cut, and paste objects or copy their style.
- **Layers and history:** Hide, lock, and reorder layers. Each drawing tool has one layer containing all objects drawn with that tool. Undo and redo are available per page during the current session.
- **Canvas navigation:** Pan, zoom, fit the drawing, zoom to a selection, and use optional grid, snapping, alignment guides, and minimap. Choose a board color and paper pattern.
- **Text and cards:** Add plain text, Markdown, tables, code notes, notes, sticky notes, and checklists. Edit cards on the canvas, change their formatting, resize or collapse them, and expand them to continue editing.
- **Mermaid flowcharts:** Turn supported Mermaid flowchart source into editable shapes and connectors. The source is saved with the diagram for later editing.
- **Database diagrams:** Turn SQL `CREATE TABLE` statements or JSON schema input into editable table cards and foreign-key connectors.
- **Editable modeling components:** Add and configure UML, sequence, ER, C4, BPMN, cloud, software, network, chart, and wireframe components.
- **Project overview:** Keep a project name, description, project notes, tasks, a checklist, milestones, decisions, questions, risks, links, and file attachments alongside the canvas.
- **Project views:** Review and edit tasks in a task list or three-column Kanban board. Set priority, status, start and due dates, and task dependencies; keep a separate project checklist. See tasks and milestones in a timeline or day, week, and month calendar.
- **Import:** Import common raster images and SVG artwork. Images are stored in the sketch file. Imported SVG artwork is converted to a raster image. Mermaid, SQL, and JSON inputs can generate editable diagrams.
- **Export and printing:** Preview and export PNG, SVG, and PDF. PDF supports selected pages, page ranges or all pages; standard or custom paper sizes; fit-to-page or tiled output; margins, headers, footers, bleed, crop marks, and RGB, CMYK, or grayscale output. PNG and SVG can have transparent backgrounds. Older retired Library collections can be exported to JSON and removed from the sketch after it saves.
- **View and presentation modes:** Open a local sketch in view-only mode, or hide editing controls and present its pages with next and previous navigation.
- **Desktop tools:** Windows has a command palette, customizable shortcuts, and a full-screen focus mode.
- **Appearance and settings:** Choose light, dark, or system theme; set accent and toolbar colors using compact color swatches; choose component appearance; adjust interface scale and supported mobile orientation and toolbar position. The Help and updates menu shows the installed app version below the update control. The light and dark palettes are centralized in one theme file.
- **Help and updates:** The app includes a feature guide and shortcut help. Windows checks for signed app updates; Android can download a matching release and open the system installer for the user to approve.
- **Shared-folder update merging:** On Windows, SketchDraw detects edits to an open file after the sync provider updates it. It merges independent record changes and resolves same-record conflicts with edit timestamps. This depends on file sync and is not live collaboration.

## Performance review

### Work already completed

The repository contains a canvas performance audit dated 10 October 2026: [canvas performance audit](docs/audits/canvas-performance-2026-10-10.md). It records improvements already present in the code, including cached rendering for pressure strokes, reuse of the scene during live drawing, indexed visible-object rendering, deferred background snapshot work, and reduced minimap and grid work.

That audit measured panning 160 pressure strokes at a median of 104.5 ms before and 0.8 ms after the rendering changes, once the cache was warm. It also notes that long live strokes still redraw their current geometry. The measurement is for the stroke-rendering workload, not full app input latency or physical-device frame rate.

This audit also replaced the post-save full-document comparison with a document revision check. A snapshot is cached for the current revision, and Windows sync observation is skipped when the path and revision have not changed. The retired Library archive JSON and Windows sync JSON entries are cached by immutable library data reference, so normal edits do not re-encode those collections. Users can export the old collections as a separate JSON file on Windows or Android, then save the sketch without the retired copy.

PDF and SVG element rendering now live in separate feature modules and load only when those export formats are used. The stylesheet imports are listed in order in `src/App.css`. The theme cleanup removed duplicate color declarations and empty override rules; the current production CSS bundle is 389.44 KB (53.36 KB gzip), down from 421.17 KB.

### Remaining performance work

1. **Profile opening and switching large documents.** Opening parses and normalizes the whole file, and activating it deep-copies every page and its elements. Measure load time and memory with large multi-page sketches and embedded images. If those measurements show a problem, load or clone page content on demand and avoid keeping redundant copies of embedded image data.
2. **Keep large exports responsive.** PDF export is now loaded on demand, but tiled PDF rendering still prepares rasterized pages and builds the file on the app thread. Profile large multi-page exports and consider worker rendering with progress and cancellation if it blocks editing.
3. **Measure long-stroke latency on actual Android devices.** The earlier performance audit identifies repainting the full active stroke as a remaining limit. If device profiling confirms it is noticeable, evaluate dirty-region rendering while checking that pressure, opacity, caps, and stroke appearance stay the same.

These remaining opportunities come from reading the implementation; their benefit has not been measured in this audit.

## Code cleanup, redundant code, and wiring review

### Findings

- **No confirmed unused TypeScript locals or parameters were found.** The static check `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` completed without diagnostics. The project, document, canvas, and platform components checked are imported or called by the app.
- **Retired Library data now has an export-and-prune path.** The old collections remain in the v9 compatibility shape until the user exports them. Windows and Android provide native JSON save dialogs; after export, the app clears the archived collections and saves the sketch. The serializer reuses the archived JSON for an unchanged library object. Old-file readers remain intact during the compatibility period in the migration plan.
- **Color ownership is centralized and duplicate assignments are removed.** `theme.css` contains the light and dark palette. The other app stylesheets use semantic tokens; a scan found no remaining literal CSS colors outside the palette file. Superseded color declarations were removed from identical selector, state, and property groups. The ordered stylesheet manifest remains in `App.css`; separate hover, selected, responsive, and platform states still have their own rules.
- **The app shell is smaller and has clearer feature boundaries, but remains large.** PDF and SVG serializers moved to lazy-loaded export modules, and document snapshot plus Windows sync tracking moved to a coordinator. `src/App.tsx` is still 4,578 lines and contains substantial canvas interaction and UI wiring. Continue extracting cohesive canvas and menu behavior when those areas are changed; the build still reports a large main chunk.
- **Restored toolbar dropdown styling and corrected the Canvas popup.** Text, line, arrow, and brush menus use their original option layout again. Modeling keeps its categorized card grid. The Canvas popup has one token-based stylesheet with its original compact proportions; its paper-pattern swatches now have visible marks in both themes. No additional broken document or project data wiring was confirmed; device-specific interactions still need a manual Windows and Android pass.

## Full code and platform audit

### Platform wiring

| Area | Windows | Android | Audit result |
|---|---|---|---|
| Sketch files | Native file picker and filesystem APIs; Rust validates and atomically replaces local `.sketch` files. | Android document picker returns Storage Access Framework URIs; Kotlin reads and writes through the selected provider. | Separate adapters feed the shared document controller. Android provider files correctly avoid Windows-style background polling. |
| Shared-folder changes | Filesystem watch events plus a 30-second fallback check; independent records are merged. | No background merge loop for provider URIs. | Intentional platform difference, documented in the feature list. |
| Stylus | Browser pointer input supplies supported pressure, tilt, and eraser data. | Native Ink overlay renders the wet stroke; Kotlin sends batched MotionEvent samples into the shared canvas input path. | The data path is connected. The Android bridge did unnecessary per-sample view lookup and screen-coordinate queries; this was reduced to one geometry lookup per event batch. |
| Automatic layout | Windows command dynamically loads ELK and arranges eligible objects. | No automatic-layout command is exposed. | Confirmed platform gap, already listed under missing features. The ELK engine now runs in a separate worker asset. |
| Updates | Signed Tauri updater plugin. | GitHub release lookup, APK package/version/signature checks, and Android's installer confirmation. | Separate implementations are expected and are connected to the same update controls. |
| Workspace | Desktop tabs, keyboard shortcuts, command palette, focus mode, and desktop menus. | Touch toolbar, gestures, mobile navigation, orientation, and touch-focused controls. | Shared document and project data sit behind platform-specific presentation layers. |

### Code changes made during this audit

1. **Reduced Android stylus coordinate work.** A MotionEvent may contain several historical samples. The Kotlin bridge previously searched the view tree and allocated coordinate arrays for each sample. It now finds the WebView and reads the root/WebView locations once, then applies the same offset to the whole batch. This preserves the existing coordinate transform and sample order.
2. **Moved automatic layout off the UI thread.** The app imported ELK's workerless bundle. It now imports ELK's worker API and emits the ELK worker as a separate asset, loading it only when the existing Windows auto-layout action is used. The auto-layout module dropped from about 1,434 KB to 7 KB in the production build; the worker remains a separate 1,595 KB raw asset.
3. **Removed repeated graph searches from layout result mapping.** ELK results were matched to input nodes with repeated linear searches. ID and index maps now perform these lookups directly, changing that mapping step from quadratic to linear work as the graph grows.
4. **Avoided the second full serialization after save.** The document controller captures a revision with the saved snapshot and compares it after the asynchronous write to see whether later edits remain. It uses the old serialized comparison only when a caller does not provide revisions.
5. **Moved snapshot and sync coordination behind a module boundary.** The coordinator caches the document snapshot by path and revision, and avoids repeat sync observation when neither changed. This prevents repeated JSON serialization during idle polling and duplicate snapshot callers.
6. **Added a safe retired Library archive export.** Windows and Android can save legacy collections into a standalone JSON file. After the archive is written, the app clears those collections from the in-memory sketch and saves the sketch; if that save fails, the exported copy remains and the sketch stays dirty.
7. **Separated and deferred export rendering.** PDF and SVG serializers were extracted from `App.tsx` and split into lazy chunks, reducing the main app chunk from about 634 KB to 571.14 KB. Removing the unused motion preference and related settings wiring brought it to 570.36 KB.
8. **Made the stylesheet cascade easier to inspect.** App-wide CSS imports now appear in their existing order in `App.css`. Two same-file selector rules that were fully superseded or duplicated were removed without changing final values.
9. **Rebuilt the application theme around one palette file.** `src/styles/app/theme.css` now owns the supplied light and dark colors, derived status colors, shared surface colors, and compatibility aliases. Repeated declarations for identical CSS selectors, states, and color properties were removed. The CSS audit found 144 duplicate groups before cleanup and none after.
10. **Removed UI motion and reclaimed settings space.** Removed 35 CSS transition and animation declarations, all keyframes, 36 backdrop blur declarations, and 11 hover or press shifts. Removed the unused “Reduce motion” setting from desktop and mobile settings. Removed two explanatory paragraphs from the settings UI and tightened the remaining settings spacing.
11. **Made paint brush, text, line, and arrow menus compact horizontal lists.** Each subtool uses the same 68-by-52-pixel box in one row, with its icon above its name. Long menus scroll horizontally on narrow screens, and clipped labels retain their full accessible names.
12. **Fixed the accent restored by Reset settings.** Reset now selects the first preset, Indigo, which is also the app's default accent.
13. **Restored the Modeling components dropdown layout.** The searchable component library uses its original categorized card grid again. Its explicit grid rule wins over the shared toolbar layout, and shared option sizing no longer changes the search, filters, schema action, or cards.
14. **Restored the Canvas popup's original compact layout.** It uses the original menu width and action rows while sharing the theme palette. Paper-pattern swatches now have visible marks and borders in both themes.
15. **Restored the original toolbar dropdowns.** Removed the horizontal-only menu styling for text, line, arrow, and brush subtools. Their original desktop and touch layouts are back, with the existing Modeling card grid preserved. Toolbar and popup colors still come from the shared theme tokens.
16. **Removed canvas rulers and their controls.** Removed the ruler display, setting, command, and popup action; restored the original toolbar and quick-style placement without ruler-specific spacing. Ruled paper remains a separate background pattern.
17. **Tightened color settings.** Reduced accent and toolbar surface swatches to compact sizes and added a more visible, theme-aware background pattern to the welcome screen.
18. **Reduced live drawing work per frame.** Pan and zoom keep the existing viewport index and cached stroke rasters. Live pen previews now extend a cached path instead of rebuilding or copying the full stroke each pointer frame; the pressure-shaped outline is built on pen-up and uses the stroke's selected thickness.

### Remaining maintenance and performance findings

- **The main application shell remains large.** Export rendering and document snapshot/sync work now sit in focused modules, and export code is loaded on demand. `src/App.tsx` is still 4,578 lines, mainly because it owns canvas interaction and much of the app UI. The production app chunk is 570.46 KB (160.24 KB gzip); continue extracting cohesive canvas and menu behavior as those features are changed.
- **Opening and large-document activation still duplicate page data.** The app normalizes the file and clones pages into the active session. Profile this with large boards and embedded images before changing the storage model.
- **Repeated sync observations no longer rebuild snapshots or stringify Library records.** The coordinator caches the document snapshot by path and revision, and the tracker runs once per observed revision. Library entries reuse their encoded JSON while that data object is unchanged. Changed revisions still rebuild the sync map and serialize canvas and project records, so a changed-record queue could further reduce work for very large projects.
- **Platform checks rely on user-agent text.** Windows and Android detection checks for `windows` or `android` in the WebView user agent. That works for the current targets but can silently choose the wrong UI or native bridge if a WebView changes its user-agent string. Prefer a single native platform value if the app adds more targets or sees detection failures.
- **Android's checked-in Gradle project needs Tauri's generated settings file.** `settings.gradle` applies `tauri.settings.gradle`, and `.gitignore` excludes that generated file. The file is absent in this checkout, so Gradle stops before compiling the Kotlin changes. Run the Android initialization step before building from a fresh checkout and document it alongside development setup; do not commit a machine-specific generated file.
- **Very long stroke finalization still needs device profiling.** Live preview work now grows with new pointer samples rather than rebuilding the whole stroke each frame. Pen-up still creates the detailed pressure outline once; profile that single finalization on low-memory Android devices before introducing background workers or changing stroke geometry.

### Redundancy, conflicts, and wiring conclusions

- The strict TypeScript check reports no unused locals or parameters. No safely removable dead TypeScript code was confirmed.
- Old Library fields and platform no-op Tauri plugin shims are deliberate compatibility/wiring code, not dead code: they preserve older project data and keep shared command registration compilable across Windows and Android.
- No confirmed mismatch was found between the shared document controller, Windows filesystem store, Android document-provider bridge, and the corresponding UI entry points.
- The source audit did not prove every interaction works on hardware. The Android build could not compile because the ignored Tauri-generated settings file is missing, and the canvas browser benchmark could not launch Chromium in this sandbox (`spawn EPERM`).

### Validation performed

- `npx tsc --noEmit` — passed after the refactors.
- `npm run build` — passed after the toolbar and paper-pattern styling updates. The main app chunk is 570.36 KB (160.22 KB gzip); the PDF renderer is a 14.49 KB lazy chunk and the SVG renderer is 10.79 KB. The app chunk still exceeds Vite's 500 KB warning threshold. CSS is 389.44 KB (53.36 KB gzip).
- `cargo check --manifest-path src-tauri/Cargo.toml` — passed for the current Windows host target.
- `git diff --check` — passed.
- `npm run test:canvas` — could not run because Chromium process launch returned `EPERM`.
- Android `:app:compileDebugKotlin` — blocked before compilation because `src-tauri/gen/android/tauri.settings.gradle` is absent and ignored by Git.

## Comparison references

The comparison uses public feature descriptions for [Excalidraw+](https://plus.excalidraw.com/excalidraw-for-teams), [draw.io](https://www.drawio.com/docs/features/), and [Miro](https://miro.com/features/). Their feature sets can vary by plan and integration.

## Missing features and recommended updates

### Collaboration and sharing

1. **Live collaboration is missing.** Add simultaneous editing, presence, live cursors, and a reliable way to merge offline edits.
2. **Comments and review are missing.** Add comments anchored to canvas objects, tasks, or regions, with replies and resolved states.
3. **Share links and access controls are missing.** Add optional hosted workspaces, view-only and edit links, invite controls, and clear permissions. The current view-only mode opens a file the user can already access.
4. **Remote access to a shared project is missing.** A synced folder is the current way to move files between devices. Add browser access or an optional service that can open a project without manually locating its file.

### Diagramming and whiteboarding

5. **Starter templates are missing.** Add ready-to-edit boards for common flowcharts, architecture diagrams, brainstorming sessions, project plans, and retrospectives.
6. **User-managed and community libraries are missing.** Let users save, search, import, export, and share their own components and symbol collections.
7. **Common diagram formats are not supported as editable files.** Add import and export for draw.io and Excalidraw documents, then evaluate Visio and other common formats. Imported SVG artwork is currently rasterized.
8. **Some advanced diagram structures need dedicated tools.** Add editable swimlanes, custom shapes, shape tags and metadata, and clickable links attached to canvas objects.
9. **Diagram search is missing.** Add find-in-canvas for text, labels, notes, and symbols, with a way to jump to a result.
10. **Automatic layout is platform-limited.** Windows has automatic diagram arrangement; Android has no equivalent in its code path. Bring layout actions to mobile and add more layout choices for large graphs.
11. **More data-to-diagram options are missing.** Add CSV-based diagram generation and broader diagram-code support. An optional text-to-diagram generator could help users start a board quickly.
12. **Embedded web content is missing.** Add live previews for useful links, such as videos, documents, and spreadsheets, alongside the existing image and file attachments.

### Planning and project work

13. **A multi-project overview is missing.** Each project lives in its own sketch file. Add a project library with folders or collections, search, and an overview of active projects.
14. **Team task ownership is missing.** Add task assignees, labels, watchers, custom workflow columns, recurring tasks, and effort estimates.
15. **The timeline is not a full scheduling tool.** Add movable task bars, visual dependency links, working-day calendars, critical-path highlighting, and baseline comparison.
16. **External planning integrations are missing.** Add CSV import and export, calendar export or sync, and connections to commonly used task-planning tools.
17. **Canvas objects and planning items are separate.** Add links between a shape or note and its related task, milestone, decision, or project file.
18. **Project reporting and export are missing.** Add a printable project summary and exports for tasks, milestones, and decision records. Current PNG, SVG, and PDF export covers the canvas.

### Presentations and workshops

19. **Presentation controls are basic.** Add frames or slide regions, speaker notes, reveal steps, and a presentation export such as PowerPoint.
20. **Workshop facilitation tools are missing.** Add a session timer, voting, participant follow mode, and tools for grouping or summarizing sticky-note ideas.

### History and platform reach

21. **Saved version history is missing.** Add named snapshots and a way to compare or restore older saved versions. Current undo and redo history lasts only for the page's active session.
22. **Broader platform builds are not present in the repository documentation.** The documented releases target Windows and Android. Add browser, macOS, or Linux builds if SketchDraw is meant to be available across the same range of devices as its references.
