# SketchDraw feature inventory and code audit

Reviewed: 19 October 2026
App versions in source: Windows 12.4.0; Android 7.4.0
Base source revision: a662f08; this audit update is uncommitted.

This document records features implemented in the current source and a static review of the application, platform adapters, document handling, styles, build configuration, README, and canvas-performance code. It distinguishes current behavior from suggested work. See [the v12.4.0 / 7.4.0 release notes](docs/release-notes-v12.4.0.md) for this release's summary.

## Features available in the app

### Documents and files

- **Local sketch documents:** Create, open, save, rename, and close portable SketchDraw files. Files are stored at a location chosen by the user.
- **Separate canvas and planning files:** Whiteboards use `.sketch` files and plans use `.sdplan` files. Switching workspaces keeps the open sketch available. Older sketches with embedded planning data require the user to accept a one-time refactor before their canvas-only save.
- **Pages:** Create, rename, duplicate, reorder, and delete drawing pages. A sketch can contain up to 100 pages.
- **Recent files:** Home shows up to eight recent file locations. Windows also supports multiple open documents in tabs.
- **Autosave and recovery:** Choose a 5- or 10-second autosave interval. Recover edits from a local recovery snapshot after an interrupted session.
- **Older file migration:** Read SketchDraw file versions 1 through 9. On opening an older editable `.sketch`, ask before replacing it with the current canvas-only format; declining closes the file without writing.
- **Windows sketch-file update merging:** Detect changes delivered to an open `.sketch` file by a synced folder, merge independent record changes, and resolve same-record conflicts using edit timestamps. Standalone `.sdplan` files use explicit saves; Windows compares the on-disk contents before replacing a changed plan.
- **Legacy non-canvas data:** Planning, notebook, and retired Library records in older sketches are removed only after the user accepts the canvas-only refactor.

### Canvas and drawing

- **Freehand tools:** Draw with Pen, Fine Pen, Pencil, Soft Brush, Marker, Highlighter, and Chalk. Each completed stroke is stored as one freehand object with sampled points and available pressure, tilt, and orientation data. Conservative online simplification removes only samples that stay within a small visual and stylus-attribute tolerance.
- **Laser pointer:** Point at canvas content with adjustable color, thickness, fade duration, and optional rainbow trails.
- **Other canvas tools:** Select, pan, draw geometric shapes, add text, fill shapes, erase, and crop imported images.
- **Touch and stylus input:** Draw and navigate with touch. Compatible styluses can provide pressure, tilt, orientation, and eraser-end input. Android uses a native ink preview and passes stylus samples into the canvas.
- **Shapes and symbols:** Add rectangles, circles, diamonds, triangles, and built-in flowchart symbols, including process, decision, document, database, cloud, and other common shapes.
- **Connectors:** Draw straight, curved, multi-point, elbow, forked, loop, or jagged connectors. Set line styles and arrowheads, attach endpoints to shapes, and edit route points. Windows also provides automatic obstacle-aware routing with editable waypoints.
- **Modeling components:** Insert editable UML, sequence, ER, C4, BPMN, cloud, software, network, chart, form-control, wireframe, general-purpose frame, and swimlane components. Modeling objects use one simple visual style; visualization graphs always use the modern style. Page links and nested diagrams remain available in a collapsed inspector section; architecture analysis, catalog, service metadata, and STRIDE tools are removed.
- **Selection and editing:** Move, resize, rotate, group, duplicate, copy, cut, paste, delete, and clear canvas objects. Align and distribute selections, copy object styles, and edit object properties.
- **Tool and named layers:** Objects are grouped by drawing tool by default. Create a named layer from a selection; layers can be reordered, hidden, or locked.
- **Undo and redo:** Undo and redo changes on the active page during the current editing session.
- **Canvas navigation:** Pan, zoom, fit the drawing, zoom to a selection, use an optional minimap, and enable grid snapping alongside object alignment snapping or alignment guides.
- **Board appearance:** Choose a board color and paper pattern. Board color can follow the selected app theme.

### Text, notes, and diagrams

- **Text:** Add formatted text with font family, size, emphasis, alignment, and list styles.
- **Canvas cards:** Add notes, sticky notes, checklists, Markdown, tables, and code notes. Edit, format, resize, collapse, and expand cards in place.
- **Mermaid diagrams:** Convert supported Mermaid flowchart source into editable shapes and connectors. Keep the source with the diagram for later editing.
- **Graphviz DOT diagrams:** Import a practical DOT subset with graph direction, node labels and shapes, edge chains, and edge labels into editable cards and connectors.
- **Database diagrams:** Convert SQL CREATE TABLE statements, table-definition JSON, or JSON Schema object definitions into editable table cards and foreign-key connectors. JSON Schema export uses standard `$defs` with SketchDraw `x-` extensions for SQL types and key metadata.
- **Schema editing:** Edit generated table fields and relationship endpoints; generated connectors can attach to matching field rows.
- **BPMN review:** Set conditions and a default path on sequence flows, add duration estimates to tasks, simulate parallel paths through gateways and modeled joins, and validate BPMN flow structure.
- **Diagram validation:** Check dangling references, schema relationships, object overlap, and BPMN flow rules with general, BPMN, or ERD profiles.
- **Simple inspector:** Everyday drawing and shape controls remain visible. Page links and nested diagrams are available in a collapsed section at the bottom. The inspector uses a single compact layout; quick styles remain on the left.

### Project planning

- **Standalone planning files:** Create and open plans separately from whiteboard documents. Planning files use the `.sdplan` extension; opening Planning keeps the current `.sketch` file available for returning to it.
- **Project overview:** Keep a project name, description, and notes in a plan file.
- **Tasks:** Create tasks with descriptions, configurable workflow stages, priorities, dates, estimates, recurring schedules, dependencies, and checklists.
- **Task views and filters:** Search and filter the task list; move tasks between workflow columns; review dates in a draggable timeline and day, week, or month calendar. Large lists show tasks in batches.
- **Scheduling:** Show dependency links and schedule warnings, identify the longest dependency path, configure working weekdays, and compare current dates with a saved baseline.
- **Plan library:** Add recently opened or selected `.sdplan` files to one searchable overview with project, task, and milestone summaries.
- **Planning exchange and reports:** Import and export tasks and milestones as CSV or iCalendar; export a project report as HTML or print it.
- **Project checklist:** Maintain checklist items separately from task checklists.
- **Project records:** Keep milestones, decisions, questions, and risks with owner, next step, status, and risk level fields.
- **Project files and links:** Attach files or save links beside the project. The attachment reader enforces an 8 MB file limit.

### Import, export, and viewing

- **Image import:** Import common raster formats and embed the image data in the sketch. SVG paths, common shapes, nested groups, transforms, and gradient paints become editable vector objects. Gradients are sampled as representative solid colors; clipping, masks, filters, and other unsupported SVG features fall back to embedded raster images.
- **Editable diagram interchange:** Import the first page of draw.io XML and Excalidraw JSON, then export the active canvas page to either format. Common shapes, text, connectors, freehand paths, and embedded raster images remain editable. Unsupported items may be skipped, while schema tables and component groups flatten to basic shapes and labels.
- **Data imports:** Import CSV as editable cards and, when `from`/`to` columns are present, connectors. Import a supported Graphviz DOT subset with nodes, edges, labels, basic shapes, and graph direction.
- **Live web previews:** Place an HTTPS link card on the canvas and double-click it to load a preview. YouTube, Vimeo, Google Drive, and Google Docs links are converted to preview URLs. Other pages work when their server permits embedding; the card also offers an external browser link.
- **Diagram generation and source export:** Import Mermaid, DOT, CSV, and a supported PlantUML class/object subset as editable shapes and connectors. Export editable shape labels and basic relationships as Mermaid, DOT, CSV, or PlantUML. Generate database table cards from SQL or JSON Schema and export those cards as SQL or JSON Schema. SketchDraw `x-` extensions preserve SQL types and key metadata. Styling and format-specific details are simplified.
- **Image export:** Preview and export PNG, with transparent-background support.
- **SVG export:** Export canvas objects as SVG, with transparent-background support.
- **Named versions:** Save, export, import, compare, and restore up to ten snapshots for a sketch. Snapshot contents are stored in this device's local browser storage until exported; comparisons include rendered page previews and page/object changes.
- **PDF and printing:** Preview and export the current page, all pages, or a selected range. Configure standard or custom paper sizes, orientation, margins, fit-to-page or tiled output, headers, footers, bleed, crop marks, and RGB, CMYK, or grayscale output.
- **View-only mode:** Open a sketch without editing or saving it.
- **Presentation mode:** Hide editing controls and move between drawing pages with previous/next navigation.

### Platform, settings, and help

- **Windows desktop:** Multiple document tabs, a command palette, customizable keyboard and mouse shortcuts, full-screen focus mode, automatic diagram layout, and obstacle-aware connector routing.
- **Android touch layout:** Touch-focused toolbar and controls, configurable gesture actions, portrait/landscape and toolbar-position settings, and automatic layout. Basic drawing controls remain visible while advanced canvas actions are collapsed under More canvas tools.
- **Cloud and infrastructure imports:** Import CloudFormation/CDK and ARM/Bicep templates, plus Kubernetes policies, ingress, and storage references where recognized. Imports create editable diagrams and do not deploy infrastructure.
- **Themes and appearance:** Choose light, dark, or system theme and set accent and toolbar colors from View. Adjust interface scale in Settings; visualization graphs always use the modern style.
- **Help:** Open the in-app guide and keyboard-shortcut reference.
- **App version and updates:** Find the installed version under the update control in Help. Windows installs signed Tauri updates. Android downloads a matching signed APK and opens Android's installer for the user to approve.

## Code and maintenance audit

### Confirmed strengths and improvements already present

- **Central theme palette:** Light and dark theme hex colors are defined in `src/styles/app/theme.css`. The CSS scan found no hex color literals outside that file. No CSS transition, animation, or keyframe declarations were found. A few canvas-renderer overlay colors remain hard-coded in TypeScript and are separate from CSS theme tokens.
- **Canvas rendering:** The renderer queries visible objects through a spatial index and caches settled canvas regions as bounded 512-unit tiles. Editing invalidates tiles that intersect changed object bounds; complex scenes, high zoom, and active interactions fall back to direct rendering.
- **Incremental spatial index:** The active page index retains bounds and grid membership for unchanged objects. Appends, removals, same-size replacements, and explicitly identified live resize/label changes update affected entries; reordered scenes refresh the affected scene cache.
- **Page-aware document work:** Page element arrays are reused across page switches and opening a document no longer deep-clones every page. Snapshot normalization and page JSON serialization use bounded caches, so unchanged page element arrays can reuse their normalized and encoded data.
- **Incremental live drawing:** Live pen previews extend cached geometry; pressure strokes use a bounded preview surface and reuse the same geometry on pen-up when the view is unchanged. A 24 MiB LRU bounds settled-stroke rasters.
- **Document snapshot and sync work:** A coordinator caches snapshots by path and document revision, and skips repeated Windows sync observation for unchanged revisions.
- **Save efficiency:** The document controller can compare revisions after an asynchronous save instead of serializing the entire document again just to detect later edits. A bounded cache reuses unchanged serialized page blocks and element JSON when page metadata alone changes.
- **Lazy feature code:** PDF and SVG renderers load only when those export formats are requested. Windows automatic layout uses a separate ELK worker asset. Diagram interchange, CSV/DOT conversion, and some other feature utilities are imported eagerly from `src/App.tsx`.
- **Android stylus batching:** The native bridge reuses view geometry for a batch of stylus samples instead of looking it up for every sample.
- **File safety checks:** The document parser validates object data and bounds nesting, page size, object counts, stroke points, and text size before accepting a file.
- **Planning separation:** New `.sketch` saves contain canvas pages and canvas sync data only. Planning data has its own versioned `.sdplan` format, save/open controller, native file commands, and lazily loaded workspace UI. Accepting an older sketch refactor removes its embedded planning, notebook, and retired Library data from the replacement file; declining closes it without writing.
- **Planning workspace:** The redesigned Planning views use one component stylesheet with theme tokens and scoped touch behavior. The old duplicate mobile Planning overrides and Planning-specific `!important` declarations were removed. Task warnings, task lookup, timeline ranges, dependencies, and critical-path calculations reuse memoized data; task lists, boards, and timelines render in batches, and dependency choices load only when opened. The plan library still reads and parses each indexed plan to generate its summary.
- **README, screenshots, and file association:** The README describes separate `.sketch` and `.sdplan` files, local-data behavior, diagram import/export limits, and separate recent lists. Windows and Android file-open associations include `.sdplan`; the startup handler routes planning files to the Planning workspace while retaining the open sketch.

### Findings and recommended maintenance

| Priority | Finding | Recommended update |
| --- | --- | --- |
| Medium | The source now has a TypeScript check in CI, but there is no dedicated lint configuration. | Add linting if the project adopts a maintained lint configuration. |
| Medium | `src/App.tsx` is 5,629 lines and owns much of the canvas interaction, menu state, and feature wiring. The current build emits an 845.07 kB main application chunk, a 1,595.33 kB ELK worker, and a 1,810.74 kB largest cloud-provider icon pack. Provider packs are dynamically loaded, but the build still warns about chunks over 500 kB. | Continue extracting canvas interaction, document commands, and menu flows. Split infrequent import/export and modeling features further, and profile startup and first-use loading. |
| Medium | Planning and canvas use separate files, but the app shell still coordinates workspace switching and the old sketch refactor prompt. | Keep file lifecycle and validation in `src/features/project/`; keep `App.tsx` limited to workspace and document-session integration. |
| Medium | Styles remain spread across 37 ordered imports in `src/App.css`, plus the separately imported web-preview sheet. `src/platform/windows/windows.css` is 1,144 lines and `src/styles/app/ui-overrides.css` is 1,063 lines. Ten `!important` declarations remain in the CSS scan. Later refinement layers still make the cascade difficult to trace. | Keep component rules in the owners listed in [the stylesheet map](docs/architecture/styles.md), then remove superseded refinements as components are reviewed. No incorrect CSS color token was confirmed in this static scan. |
| Low | Android Planning writes use a native command named `write_sketch_document`, even though it writes selected Planning document URIs too. | Rename or wrap it as a generic selected-document write command so platform routing is clearer. |
| Medium | Windows `.sdplan` saves compare the saved baseline before replacement. Android document-provider plan saves write directly and do not compare the expected baseline, so an external edit may be overwritten by a later save. | Add a provider-aware baseline check where Android document providers support reliable rereads, or warn users before overwriting a plan that changed outside the app. |
| Medium | Platform selection checks whether the WebView user-agent contains “windows” or “android”. A future WebView change could select the wrong UI or native bridge without a compile-time error. | Use a native platform value from Tauri where available, keeping a browser fallback only if browser use is intended. |
| Medium | Android generated Gradle settings are not part of the tracked source and are produced by Android initialization. A clean checkout depends on running that initialization before an Android build. | Document and automate the Android initialization step for fresh developer checkouts; do not commit machine-specific generated output. |
| Medium | Opening a `.sketch` still reads and parses the complete JSON file and normalizes every page. Saving still constructs and writes a complete JSON string; page caching avoids re-encoding unchanged pages but does not provide disk-level delta writes. Undo history and recovery snapshots can also clone large element arrays. | Introduce a backward-compatible, versioned page-chunk container with lazy page decoding and streaming or range-based platform file adapters. Preserve a recovery path that can export or migrate to ordinary `.sketch` JSON, and coordinate the change with Android SAF, Windows atomic saves, conflict checks, recovery, and sync merge. Profile large documents before choosing chunk size and caching limits. |
| Medium | General element-array updates still compare element references across the page to discover changed entries. Known live resize and connector-label edits can supply their changed index directly, while other edits use the reference-diff path. | Extend explicit change hints to high-frequency and large-page edit commands where profiling shows the reference scan is material. Keep a safe full-diff fallback for reorder, import, undo, and bulk operations. |
| Medium | Windows automatic routing considers nearby obstacle shapes when an element update runs. Connector identity is now preserved when the computed route is unchanged, but route candidate discovery still runs for each auto connector during Windows document updates. | Track which connectors can be affected by changed obstacle bounds and recompute only those routes if routing shows up in large-diagram profiles. |
| Medium | Browser benchmark on the current renderer covers software-rendered drawing and panning, preview-to-final alpha differences, and pen-up finalization, but no physical Android device was connected. The pan workload was 160 strokes × 240 points at 1200×800 (median 1.2 ms, p95 1.7 ms); a live 3,200-point pressure stroke measured median 3.6 ms, p95 4.3 ms. Preview-to-final maximum alpha difference was 0 for non-pressure and 1 for pressure, with zero pixels differing by more than 2. Pen-up finalization at 180/800/3,200 samples measured p95 1.1/0.9/1.6 ms. These are renderer microbenchmarks, not full-scene or device measurements. | Repeat with the full application on representative low-end Android hardware and measure end-to-end input-to-display latency, pan/zoom redraw, and stylus pen-up delay. |
| Low | PDF generation uses DOM canvas surfaces and pdf-lib while processing page elements on the app thread. Large, tiled, image-heavy exports may interrupt editing. | Measure large exports first. Add progress, cancellation, or worker rendering if profiling shows visible stalls. |
| Low | Windows sync conflict ordering uses device timestamps. Clock drift can make a stale `.sketch` record appear newer. Android document-provider files do not have the Windows background watcher and merge loop. | Keep the platform difference visible in help. Consider logical clocks or explicit conflict review if timestamp conflicts become a reported data-loss issue. |
| Low | CI now runs the browser canvas/input and diagram-import checks, and inspects names and keyboard focus for Canvas view controls. It does not yet run a full-screen-reader or end-to-end file dialog suite. | Add broader accessibility-tree and file workflow coverage when a stable browser/Tauri automation harness is available; keep physical-device checks for stylus and document-provider behavior. |

### Broken-code status

Switching from Planning back to Canvas could leave the renderer idle until the user interacted with the canvas. The render effect now schedules a frame when the workspace changes. This audit also removed a duplicate BPMN simulation dialog and corrected the connector-routing import that prevented code splitting. It fixed TypeScript errors in canvas menu props, SVG import typing, BPMN flow narrowing, optional route flags, and file parsing. `npx tsc --noEmit --pretty false`, `npm run build`, and `cargo check --manifest-path src-tauri/Cargo.toml` pass. The frontend build still reports large-chunk warnings. Local Markdown links in `README.md` and this inventory resolve. No physical Android device was available, so device-specific drawing behavior remains unverified.

### Document and platform limits

- Current `.sketch` format is version 10; versions 1 through 9 are accepted for migration. New sketch files contain canvas pages and canvas sync data only. Older editable files show a confirmation before the original file is replaced; declining closes the file without saving.
- Planning files use the separate `SketchDrawPlanning` format version 1 with the `.sdplan` extension.
- Windows saves `.sdplan` atomically with an on-disk baseline check. Android saves through the selected document-provider URI without a baseline comparison or background watcher.
- Planning schedules use date-only values, Monday-to-Sunday working-day selections, and daily, weekly, or monthly repeats. Holiday calendars, working hours, time zones, and custom recurrence rules are not included.
- The plan index searches up to 100 recently opened or selected files. It currently reads and parses each plan file to build its summary.
- `.sketch` and `.sdplan` are registered as Windows and Android file types. Android's open-file event is routed to the matching workspace; actual file-manager behavior can depend on the installed app registration and the content provider's MIME type.
- A sketch supports up to 100 pages, 20,000 direct elements per page or group, 100,000 total element nodes, 64 levels of grouping, 100,000 points per stroke, 1,000,000 stroke points per document, and 100,000 characters per canvas text item.
- Project-file attachments are limited to 8 MB each.
- Android uses the system package installer for app updates; the app does not silently install APKs.
- The published native release targets are Windows desktop and Android.

## Missing features and recommended updates

The following gaps are grounded in the current implementation and reviewed against the product’s planning and diagramming goals.

### Diagramming and whiteboarding

- **Interchange fidelity:** Expand draw.io and Excalidraw coverage for advanced routing, styles, custom shapes, groups, schema metadata, and diagram-specific behaviors. Add round-trip examples for supported objects and make simplified conversions visible during import/export.
- **SVG fidelity:** Extend path editing and import fidelity for clipping paths, masks, filters, text layout, gradient transforms, and non-scaling strokes. These features currently fall back to raster or use simplified solid-color/transform handling.
- **Custom shape library:** Expand the existing reusable stencil library with richer component authoring and user-authored fields. Named component ports and connection-rule editing have been removed from the current scope; ordinary shape and schema-row connector anchors remain.
- **Layer hierarchy:** Named layers can hold selected objects and be reordered, hidden, or locked. Add nested layers, multi-select layer moves, and layer organization across pages.
- **Canvas search and replace:** Search currently finds objects on the active page. Add cross-page result navigation and safe replace across labels, notes, and component metadata.
- **Diagram structure tools:** General-purpose frames and swimlanes are available. Add object-to-object links, more diagram-specific editing for UML/ER/BPMN, and deeper C4 model editing while keeping architecture analysis and metadata tools out of the core workflow.
- **More layout choices:** Automatic arrangement currently uses a layered layout. Add a simple way to choose force, stress, tree, or radial layouts, preserve locked regions, and arrange around existing placements.
- **Diagram-code round-trip fidelity:** Reverse exports now cover Mermaid, DOT, CSV, PlantUML, SQL, and JSON Schema. Expand import/export fidelity for connector types, groups, schema metadata, styling, and external CSV conventions. Add D2 or broader PlantUML constructs and verify round trips with representative fixtures.
- **Database access and SQL objects:** Schema text import currently creates table cards and preserves common constraints and indexes. Add read-only PostgreSQL/MySQL/SQLite introspection, richer SQL view/trigger/procedure objects, and dialect-aware schema export.
- **Selection and region export:** Export selected objects or a chosen board region directly, instead of exporting only a page or page range.

### Documents and interoperability

- **Large-document storage:** Add versioned page/chunk storage and lazy page decoding. Opening and saving currently read/write the full JSON document even though cached page serialization avoids some repeat work.
- **More interchange coverage:** Add tested round trips for groups, embedded assets, connector attachment semantics, and imported diagram-specific metadata. The current interchange implementation covers common objects and may simplify or skip advanced items.
- **Scalable embedded assets:** Support linked or separately stored large images and vector assets, with clear portability and missing-file handling.

### Planning and project work

- **Advanced scheduling rules:** Add public holiday calendars, working hours, time zones, arbitrary recurrence rules, and schedule-level critical-path slack calculations.
- **Task ownership and workload:** Add assignees, labels, actual time tracking, and capacity/workload views. Tasks currently have estimates but no owner or actual-effort fields.
- **Plan library scale:** Index plan summaries without reading each entire `.sdplan` file, and let users organize saved groups, folders, or tags of plans. The current library scans up to 100 recently opened or selected plans and parses each full file.
- **Planning exchange fidelity:** Preserve custom workflow metadata and richer recurrence/dependency data across CSV and calendar exchange, and provide field mapping for external CSV schemas.
- **Planning lifecycle tools:** Add archive/restore, duplicate-plan, and plan rename actions that work consistently across Windows paths and Android document-provider URIs.
- **Canvas-to-plan links:** Connect a canvas object or note to its related task, milestone, decision, or project file.

### Presentation, history, and platform reach

- **Presentation authoring:** Add frames or slide regions, speaker notes, reveal steps, and presentation-file export.
- **Portable version history:** Named snapshots support export/import and visual comparison. Add path-rename migration and durable history. Undo and redo still cover the active session rather than durable document history.
- **Accessibility and regression coverage:** CI checks TypeScript, production builds, canvas input/rendering, representative diagram imports/round trips, accessible names, and keyboard focus for Canvas view controls. Expand coverage to full keyboard-only workflows, screen-reader accessibility trees, contrast, import edge cases, and low-end-device interactions.
- **Additional native platforms:** Provide and document supported macOS and Linux releases if those targets are in scope.

## Review scope

This audit covers the source prepared for Windows 12.4.0 and Android 7.4.0. The production build and `cargo check --manifest-path src-tauri/Cargo.toml` pass. The 41-check canvas renderer benchmark passed. `npx tsc --noEmit` passes after the fixes noted above. No physical Android device was connected (`adb devices -l` returned no devices), so stylus latency and pan behavior on low-end hardware could not be measured.
