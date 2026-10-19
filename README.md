# SketchDraw

`This app is made entirely using AI. Use at your own risk.`

SketchDraw is an offline-first drawing and planning app for Windows and Android. Canvas drawings and pages are stored in `.sketch` files; Planning notes, tasks, milestones, and project records are stored separately in `.sdplan` files. Switch between Canvas and Planning without closing the open sketch. Save either file locally or in a folder managed by OneDrive, Dropbox, Google Drive, or another sync service.

**App versions: Windows 13.0.0 | Android 8.0.0 | Document format: v10 | Copyright (c) 2026 Toushal Sampat**

> SketchDraw saves version 10 `.sketch` documents for Canvas and version 1 `.sdplan` documents for Planning. New and opened sketches start on Canvas; Planning opens or creates its own file and leaves the sketch open. Sketch versions 1-9 remain readable. Opening an older editable sketch shows a confirmation before replacing it with a canvas-only file; declining closes it without saving.

## Screenshots and previews

The launch and workspace SVGs are hand-drawn previews rather than runtime captures, so mobile tool visibility and spacing can vary with screen size. Board artwork and recent-file names are examples, not user data.

![SketchDraw desktop launch screen with welcome actions and recent sketches](docs/screenshots/home-screen-current.svg)

*Launch screen: create or reopen a `.sketch` canvas file, or create/open a separate `.sdplan` Planning file. The recent sketches and recent plans are listed separately.*

![SketchDraw Windows workspace with grouped toolbar, direct canvas actions, contextual Properties, and flowchart](docs/screenshots/workspace-current.svg)

*Windows workspace preview: a flat, grouped toolbar, direct canvas actions, and a simpler contextual Properties panel.*

![Portrait SketchDraw mobile home with File and Menu controls, new/open actions, and recent sketches](docs/screenshots/mobile-home-preview.svg)

*Mobile home preview: create or open a `.sketch` canvas file, or create/open a separate `.sdplan` Planning file. Recent sketches and plans remain separate.*

![SketchDraw landscape tablet workspace with vertical dock, quick-style strip, color dropdown, and zoom reset](docs/screenshots/mobile-workspace-preview.svg)

![SketchDraw portrait mobile workspace with compact header, responsive top tool rail, and quick styles](docs/screenshots/mobile-portrait-preview.svg)

*Mobile and tablet workspaces: toolbars and quick-style controls stay separate and adapt to the chosen toolbar position and screen orientation. Choose an orientation and toolbar location in App Settings on supported devices.*

![Project Home with prioritized tasks, recent notes, and project tool shortcuts](docs/screenshots/project-home-preview.svg)

*Planning Home for the standalone `Northstar launch.sdplan` file. Its Canvas tab returns to the still-open whiteboard; saving Planning updates the `.sdplan` file.*

![View-only sketch with laser pointer and expandable note cards](docs/screenshots/view-only-preview.svg)

*View-only preview: inspect a `.sketch` file with the laser pointer while expanding or collapsing note, sticky-note, and checklist cards.*

![Compact Layers panel with tool groups and named layers](docs/screenshots/layers-panel-preview.svg)

*Layers group objects by tool by default. Create a named layer from a selection when you need to organize objects across tools.*

![View settings with Auto, named, and custom toolbar surface choices and light/dark examples](docs/screenshots/toolbar-auto-preview.svg)

*Toolbar appearance preview: choose Auto to follow light and dark mode, or set a named or custom surface color.*

![PDF export preview showing paper size, orientation, layout, print quality, margins, and page preview](docs/screenshots/pdf-pages-preview.svg)

*PDF export preview: standard paper sizes, custom dimensions, portrait or landscape, fit-to-page or tiled pages, overlap, margins, and print quality.*

![SketchDraw flowchart preview with editable connectors and flowchart shapes](docs/screenshots/flowchart-board-preview.svg)

*Diagram preview: editable flowchart shapes, labels, filled symbols, and attached connectors.*

![Mermaid code generated into a native editable flowchart](docs/screenshots/diagram-as-code-preview.svg)

*Diagram as code: generate an editable Mermaid flowchart and keep its source with the group for later editing. Mermaid, DOT, CSV, and a PlantUML subset can import or export editable diagram data; SQL and JSON Schema can generate editable database table cards and be exported again.*

![Connector routing and line style gallery](docs/screenshots/connector-routes.svg)

*Connector examples: straight, elbow, forked, loop, and jagged routes, plus varied line styles.*

![Flowchart symbol collection](docs/screenshots/flowchart-symbols.svg)

*Flowchart symbol gallery, including database, decision, document, and process symbols.*

![New productivity symbols and elements](docs/screenshots/symbols-elements-preview.svg)

*The flowchart palette includes cloud, star, lightning, heart, and callout symbols.*

![Database schema visualizer generating linked tables](docs/screenshots/database-schema-preview.svg)

*Paste SQL `CREATE TABLE` statements or JSON Schema and generate editable table cards with key links attached to field rows.*

![UML, ER, and architecture component palette](docs/screenshots/modeling-components-preview.svg)

*Insert individual class, sequence, ER, and C4 architecture components instead of a prefilled diagram.*

![Windows pen pressure and tilt controls](docs/screenshots/windows-pen-preview.svg)

*Compatible styluses can provide pressure, tilt, and eraser-end data through platform pointer events.*

![Laser pointer colors, rainbow mode, and reusable paint brush tools](docs/screenshots/laser-and-brush-preview.svg)

*Fine pen is a standalone toolbar tool. The Paint brushes menu includes pencil, soft brush, marker, highlighter, and chalk; laser settings control line thickness, fade duration, color, and rainbow trails.*


*Modeling cards use the selected component treatment; graphs keep their modern visual style. Text cards use the same compact boundary style across themes.*

![Complex local-first document workflow diagram](docs/screenshots/complex-workflow-preview.svg)

*A larger example combines decision branches, database storage, retries, attached connectors, and multi-stage process lanes.*

## Features

- **Document workspaces:** `.sketch` stores the Canvas and its pages. `.sdplan` stores Planning data in its own versioned file. Switch between Canvas and Planning without closing the open sketch; create or open plans from Home, and open `.sdplan` files directly from Windows or Android when SketchDraw is registered for that extension.
- **Project planning:** Keep project notes, prioritized and dated tasks, task checklists, dependencies, milestones, decisions, risks, links, and attachments in a `.sdplan` file. Use the Kanban board, drag tasks between stages, reorder cards, and review dates in Timeline or Calendar.
- **File updates:** On Windows, file-watch events detect outside changes to an open `.sketch` file, with a 30-second polling fallback for cloud folders and removable drives. Independent Canvas page and object edits can merge after a provider syncs the changed file; conflicting edits use edit clocks. `.sdplan` files are saved with a baseline check to detect external changes, but they do not use the Canvas background watcher or merge. Android document-provider files do not use background polling. SketchDraw does not host files or live collaboration.
- **Drawing tools:** Draw with pen, fine pen, pencil, soft brush, marker, highlighter, chalk, or a temporary laser pointer. Create and fill geometric shapes, crop imported images, and adjust stroke, fill, opacity, corners, and text styling.
- **Flowchart symbols:** Build diagrams with process, terminator, decision, input/output, document, database, preparation, manual input, connector, delay, stored-data, and cloud shapes. Symbols remain editable after placement.
- **Connectors:** Draw straight or curved lines, multi-point lines, and straight, elbow, forked, loop, or jagged arrows. Attach endpoints to shapes, choose line and arrowhead styles, and drag route handles. Automatic obstacle routing and route optimization are available from connector properties; routing uses the shared diagram geometry on desktop and mobile.
- **Selection and layers:** Move, resize, rotate, group, duplicate, align, and distribute objects. Copy and paste objects or their styles, and edit precise values. Objects are grouped by drawing tool by default; create named layers from a selection, then reorder, hide, or lock layers. Undo and redo history is kept per page for the current session.
- **Canvas navigation:** Pan, zoom, fit the full drawing, or zoom to a selection. Set the board color and paper pattern, use grid and object snapping together, and open Canvas options for alignment guides and an optional minimap. Square grid marks, paper patterns, and grid snapping share an evenly spaced, pixel-aligned lattice. Automatic layout is available on desktop and mobile; touch layouts keep it under the collapsed More canvas tools section.
- **Pages and project files:** Keep up to 100 named Canvas pages in a version 10 `.sketch` file. Planning records live in a version 1 `.sdplan` file; up to 100 recent plan paths are remembered separately from up to eight recent sketch paths. Recent sketch entries are deduplicated across Windows extended-path forms and shown with readable names and locations. Older sketches can be opened and refactored after confirmation; the replacement keeps canvas pages and removes planning, notebook, and retired Library records. Rename a sketch from the File menu; the open document, tabs, recent list, and autosave follow its new name. Autosave runs at the chosen 5- or 10-second interval, and Canvas recovery can restore interrupted edits.
- **Text and note cards:** Add plain text, Markdown, tables, code notes, sticky notes, and checklists to the canvas. Markdown supports headings, lists, tables, and syntax-colored code blocks. Select a card or place a new one to edit its content in the compact right-side dock. Resize cards on the canvas, and collapse or expand them with the small card control; collapsed cards retain a short content or task summary.
- **Diagram as code:** Paste Mermaid flowchart code, preview it, and generate native shapes and attached connectors. Mermaid and PlantUML groups keep their source for later editing and regeneration. Import supported Mermaid, DOT, CSV, and PlantUML subsets from files. Export editable diagram labels and relationships as Mermaid, DOT, CSV, or PlantUML. Format-specific constructs and visual styling beyond the supported subset are simplified.
- **Database schema visualizer:** Paste SQL `CREATE TABLE` statements, JSON table definitions, or JSON Schema object definitions to create editable table cards. Primary- and foreign-key fields, common constraints, and indexes are retained in schema cards and supported exports. Each card can reopen its saved source for editing. Export table cards as SQL or Draft 2020-12 JSON Schema. SketchDraw `x-` extensions preserve SQL types and key metadata for re-import. This imports schema text; it does not connect to a live database.
- **Modeling components and graphs:** Insert editable UML, sequence, ER, C4, cloud, software, BPMN, and network shapes, plus general-purpose frames and swimlanes. AWS, Azure, and Google Cloud libraries include common compute, storage, database, messaging, security, and network services. Provider symbols show labels and readable icon fallbacks while their provider glyphs load, and retain provider artwork in SVG export. Network symbols include gateways, DNS, VPN, internet, modem, and wireless access points; BPMN includes boundary and event gateways and subprocesses. Use **Spawn all components** to place a neatly spaced, labeled specimen sheet on the canvas. Component labels wrap within their symbols with consistent padding. Page links and nested diagrams remain available in a collapsed inspector section; links inside grouped objects can be opened directly from the selection. BPMN flows support conditions and default paths; the token simulator follows parallel paths through gateways and waits at modeled joins. Diagram checks include general, BPMN, and ERD profiles. Editable charts include bar, horizontal and stacked bar, line, area, scatter, pie, doughnut, radar, gauge, funnel, heatmap, treemap, and metric cards. Change chart data, series, palette, legend, grid, value labels, line smoothness, line width, and point size from the component editor. Graphs render directly as shared vectors on the canvas and in SVG export, staying sharp while zooming and updating immediately when values change.
- **Import formats:** Import common raster images and SVG artwork. Images are embedded in the `.sketch` file. SVG paths, common shapes, transforms, nested groups, and gradients import as editable vectors; gradients become representative solid colors, and artwork using clipping, masks, filters, or other unsupported SVG features falls back to an embedded raster image. Import draw.io XML, Excalidraw JSON, CSV, JSON records or graph data, Kubernetes YAML manifests, Terraform resources and module blocks (`.tf` or `.tf.json`), Terraform plan/state JSON, Docker Compose, Ansible, OpenAPI, DOT, Mermaid, supported PlantUML diagrams, CloudFormation/CDK templates, and Azure ARM/Bicep templates as editable canvas objects. Kubernetes policies, ingress resources, and storage references are included where recognized. Infrastructure imports create editable cards and supported dependency links; they do not run the source configuration or deploy resources.
- **Canvas tools:** Search canvas objects with Ctrl+F, link an object to another page, validate dangling connector bindings and schema references, save tagged stencil libraries for reuse or export, insert an editable legend or callout, and number selected connectors from top to bottom.
- **Named versions:** Save up to ten snapshots per sketch in local app storage, export or import them as portable files, compare visual page previews and object counts, or restore one as an unsaved change. Snapshots do not sync automatically with the `.sketch` file.
- **Print preview:** Review page size, orientation, margins, page breaks, and tiled layout before printing or saving as PDF. Fit-to-page and poster layouts make it easier to check how a large sketch will be split across sheets.
- **Export:** Review a live preview before exporting PNG, SVG, or PDF. PDFs support the current page, all pages, or a selected range, with fit-to-page or tiled output; configure page dimensions, headers, footers, crop marks, bleed, and RGB, CMYK, or grayscale output. PNG and SVG can use transparent backgrounds.
- **Windows workspace:** Windows adds multiple open sketch tabs, customizable shortcuts, the `Ctrl+K` command palette, and a full-screen focus mode. The palette searches tools, actions, settings, and symbols; the desktop toolbar groups common tools and keeps object properties close to the canvas.
- **Phone and tablet workspace:** Touch layouts adapt to portrait and landscape and to the chosen toolbar position. Basic tools stay on screen; advanced canvas actions stay collapsed until opened. Tool controls, quick styles, canvas options, page controls, and menus remain reachable by touch.
- **Touch and stylus input:** Draw and edit with a finger or compatible stylus. Use two fingers to pan and zoom, configure gesture actions, and use stylus pressure, tilt, and eraser-end input when the device reports them.
- **Canvas interaction audit:** Run `npm run test:canvas` to exercise drawing and stroke rendering, stylus and touch event handling, anchored zoom and pinch gestures, label bounds, component creation/resizing/serialization/export, vector chart output and chart customization, connector routing, and layout behavior in a local headless Chromium browser. Set `CANVAS_TEST_BROWSER` if Chromium or Edge is installed outside the script's default locations. Stylus and touch checks use synthetic browser pointer input and do not replace testing with physical hardware.
- **Appearance:** Follow the system theme or choose light or dark mode, set accent and toolbar colors from the app-wide View menu, and use the plain style for modeling components. Visualization graphs always use the modern style.
- **Presentation mode:** Hide the editing interface to present the canvas. Use the mouse, keyboard, or touch to move between sketch pages.
- **View-only mode and help:** Open a sketch without editing or saving it; the laser pointer and note-card expand/collapse controls remain available. New sketches always start blank. Diagram guides are read-only references and cannot be changed or spawned onto a canvas. The in-app guide and shortcut reference explain drawing, selection, files, pages, export, and diagram ideas.
- **App updates:** SketchDraw automatically checks for updates after startup and notifies you when a newer release is available; you can choose Update or Later. You can also check manually. Windows checks the signed Tauri updater manifest on GitHub. Android checks for a matching arm64 APK, downloads it into app cache if you choose, verifies its package, version code, and signing certificate, then opens Android's installer for your approval. Android does not install updates silently.

SketchDraw does not host online workspaces or live cursors. Canvas file updates use the local `.sketch` path or provider URI and the sync service managing that folder; there is no SketchDraw server or cloud account. Canvas conflicts use last-edit-wins metadata, so devices should have reasonably accurate system clocks. Planning files do not merge offline edits; a save checks whether the `.sdplan` file changed since it was opened.


## License

SketchDraw is distributed under the [End User License Agreement](LICENSE), not an open-source license. The application copyright belongs to Toushal Sampat; you retain rights to drawings and files you create. Third-party components remain under their respective licenses.

## Privacy and local data

SketchDraw has no account system, analytics, telemetry, or application service that uploads documents. The app uses Tauri's local filesystem and dialog APIs to open and save files selected by you. It does not send drawing content to SketchDraw servers.

Some app data is kept in local WebView storage on this device:

- Up to eight recent `.sketch` paths and up to 100 recent `.sdplan` paths or Android document-provider URIs, so the launch screen and Planning overview can reopen those files.
- Theme and tool accent preferences.
- Up to ten named snapshots per sketch path, stored locally for comparison and restore.
- A recovery snapshot for an open `.sketch` canvas document when it has unsaved changes. Recovery data is removed after the document is saved or recovery is discarded; if neither happens, it remains in local app storage. Planning files do not use this Canvas recovery snapshot.

Named versions and recovery snapshots can contain the document's text, shapes, and embedded image data. They are stored locally so a version can be restored or an interrupted session recovered. Other apps or accounts on this device may have access according to the operating system's user-account and device security.

If you save a `.sketch` or `.sdplan` file inside a cloud-sync folder, that folder's provider may upload and process the file under its own terms and settings. SketchDraw does not control that service. Windows can merge independent Canvas edits after a provider syncs them; Planning files use a save-time baseline check and do not receive automatic background merging. Exported files are written to the location you choose. The installer and operating system also have their own download, security, and update behavior; this project does not receive those reports.

The automatic startup check and manual **Check for updates** action contact GitHub for public release metadata. Windows checks the signed updater manifest. Android queries the public Releases API; if a newer APK is available and you choose to install it, the app downloads that release asset to its private cache and hands it to Android's package installer. These requests do not include sketch content, file paths, or drawing data; GitHub receives ordinary network requests under its own privacy terms.

PDF output supports RGB, process CMYK, and grayscale values. It does not currently embed or select a calibrated ICC press profile; confirm color conversion requirements with your print provider.

This description is not a legal certification for every jurisdiction or distribution setup. Data protection obligations can include transparency, purpose limitation, data minimization, retention, and security requirements.
