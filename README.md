# SketchDraw

`This app is made entirely using AI. Use at your own risk.`

SketchDraw is an offline-first project workspace for Windows, Android, and iOS. Draw diagrams, plan work, and keep notes and tasks together in one portable `.sketch` file. Save locally or in a folder managed by OneDrive, iCloud Drive, Dropbox, Google Drive, or another sync service.

**Current release: Windows 9.0.0 | Android 4.0.0 | Document format: v9 | Copyright (c) 2026 Toushal Sampat**

> SketchDraw saves version 9 `.sketch` documents on both platforms. New and opened sketches start on Canvas, with Planning and Notebook available from the workspace tabs. V9 stores Notebook notes separately and keeps retired Library records in an archive section. Versions 1-8 remain readable and migrate to v9 when opened and saved.

## Screenshots and previews

The launch and workspace SVGs have been reviewed against the current desktop and touch components. They are drawn previews rather than runtime captures, so touch tool visibility and spacing can vary with screen size. Board artwork and recent-file names are examples, not user data.

![SketchDraw desktop launch screen with welcome actions and recent sketches](docs/screenshots/home-screen-current.svg)

*Launch screen: create a sketch, browse for a file, or reopen a recent sketch.*

![SketchDraw Windows workspace with grouped toolbar, direct canvas actions, contextual Properties, and flowchart](docs/screenshots/workspace-current.svg)

*Windows workspace preview: a flat, grouped toolbar, direct canvas actions, and a simpler contextual Properties panel.*

![Portrait SketchDraw mobile home with File and Menu controls, new/open actions, and recent sketches](docs/screenshots/mobile-home-preview.svg)

*Mobile home preview: create or open a sketch and browse recent files in a touch-friendly layout.*

![SketchDraw landscape tablet workspace with vertical dock, quick-style strip, color dropdown, and zoom reset](docs/screenshots/mobile-workspace-preview.svg)

![SketchDraw portrait mobile workspace with compact header, responsive top tool rail, and quick styles](docs/screenshots/mobile-portrait-preview.svg)

*Mobile and tablet workspaces: Landscape uses a vertical tool dock with a horizontal quick-style strip immediately left of the zoom reset button, a drop-down row of color presets, and a visible stroke control; Portrait moves the tools into a responsive horizontal rail at the top of the canvas, puts quick controls beside the advanced style button, and groups non-File menus under Menu. Choose an orientation in App Settings on supported devices.*

![Project Home with prioritized tasks, recent notes, and project tool shortcuts](docs/screenshots/project-home-preview.svg)

*Project Home brings next actions, recent notes, project dates, and shortcuts together. Task priority and due dates stay visible in the overview.*

![SketchDraw Notebook with the note editor, note list, and export controls](docs/screenshots/notebook-preview.svg)

*Notebook keeps quick notes with the sketch. Open the notes list to select, delete, or export notes without a second writing area.*

![Markdown text editor, insert-table action, and rendered editable table card](docs/screenshots/markdown-tables-preview.svg)

*Markdown text preview: edit headings, lists, code, and tables in a collapsible card; start a table from the Text menu or insert one into an existing Markdown card.*

![View-only sketch with laser pointer and expandable note cards](docs/screenshots/view-only-preview.svg)

*View-only preview: inspect a `.sketch` file with the laser pointer while expanding or collapsing note, sticky-note, and checklist cards.*

![Contextual Properties panel for a selected Markdown card with collapse, title, and conversion controls](docs/screenshots/advanced-inspector-preview.svg)

*Properties preview: focused controls for the selected item; Layers opens in a separate panel from the canvas toolbar.*

![Compact Layers panel with one grouped layer per drawing tool](docs/screenshots/layers-panel-preview.svg)

*Layers now show one row for each tool type in use. Selecting, reordering, hiding, or locking a row applies to every object made with that tool.*

![View settings with Auto, named, and custom toolbar surface choices and light/dark examples](docs/screenshots/toolbar-auto-preview.svg)

*Toolbar appearance preview: choose Auto to follow light and dark mode, or set a named or custom surface color.*

![PDF export preview showing paper size, orientation, layout, print quality, margins, and page preview](docs/screenshots/pdf-pages-preview.svg)

*PDF export preview: standard paper sizes, custom dimensions, portrait or landscape, fit-to-page or tiled pages, overlap, margins, and print quality.*

![SketchDraw flowchart preview with editable connectors and flowchart shapes](docs/screenshots/flowchart-board-preview.svg)

*Diagram preview: editable flowchart shapes, labels, filled symbols, and attached connectors.*

![Mermaid code generated into a native editable flowchart](docs/screenshots/diagram-as-code-preview.svg)

*Diagram as code: paste a Mermaid flowchart, save its source with the diagram, and double-click it later to edit and regenerate it in place.*

![Connector routing and line style gallery](docs/screenshots/connector-routes.svg)

*Connector examples: straight, elbow, forked, loop, and jagged routes, plus varied line styles.*

![Flowchart symbol collection](docs/screenshots/flowchart-symbols.svg)

*Flowchart symbol gallery, including database, decision, document, and process symbols.*

![New productivity symbols and elements](docs/screenshots/symbols-elements-preview.svg)

*The flowchart palette includes cloud, star, lightning, heart, and callout symbols.*

![In-place note, sticky note, and checklist editing on the canvas](docs/screenshots/canvas-notes-preview.svg)

*Notes, sticky notes, and checklists open as writing surfaces directly on the whiteboard.*

![Database schema visualizer generating linked tables](docs/screenshots/database-schema-preview.svg)

*Paste SQL `CREATE TABLE` statements or JSON and generate table cards with foreign-key links attached to field rows.*

![UML, ER, and architecture component palette](docs/screenshots/modeling-components-preview.svg)

*Insert individual class, sequence, ER, and C4 architecture components instead of a prefilled diagram.*

![Windows pen pressure and tilt controls](docs/screenshots/windows-pen-preview.svg)

*Compatible styluses can provide pressure, tilt, and eraser-end data through platform pointer events.*

![Laser pointer colors, rainbow mode, and reusable paint brush tools](docs/screenshots/laser-and-brush-preview.svg)

*Fine pen is a standalone toolbar tool. The Paint brushes menu includes pencil, soft brush, marker, highlighter, and chalk; laser settings control line thickness, fade duration, color, and rainbow trails.*

![Modern and simple component appearances](docs/screenshots/component-appearance-preview.svg)

*Switch class cards, schema tables, notes, sticky notes, and checklists between the current treatment and a compact monochrome style.*

![Complex local-first document workflow diagram](docs/screenshots/complex-workflow-preview.svg)

*A larger example combines decision branches, database storage, retries, attached connectors, and multi-stage process lanes.*

## Features

- **Document workspaces:** Each `.sketch` file includes a Canvas, Planning, and Notebook. New and opened sketches go straight to Canvas; switch to planning or notes without closing the file. All three stay in the same offline document.
- **Project planning:** Keep project notes, prioritized and dated tasks, dependencies, milestones, decisions, risks, links, and attachments together. Use the Kanban board, drag tasks between stages, reorder cards, and review dates in Timeline or Calendar.
- **Notebook:** Keep quick notes with a sketch, then select, delete, or export them as Markdown. Notebook notes stay separate from project notes and canvas note cards.
- **Shared-file updates:** Open copies check a shared `.sketch` file every 1.6 seconds. Once OneDrive or another provider syncs a change, independent edits to pages, objects, notes, and tasks are merged; when the same item changes on two devices, the later edit wins. SketchDraw does not host files or live collaboration.
- **Drawing tools:** Draw with pen, fine pen, pencil, soft brush, marker, highlighter, chalk, or a temporary laser pointer. Create and fill geometric shapes, crop imported images, and adjust stroke, fill, opacity, corners, and text styling.
- **Flowchart symbols:** Build diagrams with process, terminator, decision, input/output, document, database, preparation, manual input, connector, delay, stored-data, and cloud shapes. Symbols remain editable after placement.
- **Connectors:** Draw straight or curved lines, multi-point lines, and straight, elbow, forked, loop, or jagged arrows. Attach endpoints to shapes, choose line and arrowhead styles, and drag route handles. Windows also offers automatic obstacle routing with editable waypoints.
- **Selection and layers:** Move, resize, rotate, group, duplicate, align, and distribute objects. Copy and paste objects or their styles, and edit precise values. Layers group all objects by drawing tool, so each tool has one selectable, reorderable, hideable, and lockable layer. Undo and redo history is kept per page for the current session.
- **Canvas navigation:** Pan, zoom, fit the full drawing, or zoom to a selection. Set the board color and paper pattern, use grid and object snapping, and open Canvas options for rulers, alignment guides, and an optional minimap.
- **Pages and project files:** Keep up to 100 named canvas pages plus planning and notebook records in one portable version 9 `.sketch` file. Older personal-library records are preserved when a file is opened and saved. Rename a sketch from the File menu; the open document, tabs, recent list, and autosave follow its new name. Autosave runs at the chosen 5- or 10-second interval, recovery can restore interrupted edits, and up to eight recent file paths appear on Home. Recognized version 1-8 SketchDraw files are migrated when opened and saved.
- **Text and note cards:** Add plain text, Markdown, tables, code notes, notes, sticky notes, and checklists to the canvas. Markdown supports headings, lists, tables, and syntax-colored code blocks. Resize, title, format, collapse, expand, and edit cards in place; collapsed cards retain a short content or progress summary.
- **Diagram as code:** Paste Mermaid flowchart code, preview it, and generate native shapes and attached connectors. The source stays with the diagram, so it can be reopened, edited, and regenerated later.
- **Database schema visualizer:** Paste SQL `CREATE TABLE` statements or JSON table definitions to create editable table cards with primary- and foreign-key fields. Generated connectors attach to matching field rows, and each card can reopen its saved source for editing.
- **Modeling components:** Insert individual UML class cards, sequence lifelines and messages, ER tables and relationship motifs, or C4 architecture parts. Components can be edited separately; connector motifs stay grouped so their lines and arrowheads move together.
- **Import formats:** Import common raster images and SVG artwork. Images are embedded in the `.sketch` file; SVG artwork is rasterized for display. Mermaid, SQL, and JSON inputs can also generate editable diagrams or schema cards.
- **Print preview:** Review page size, orientation, margins, page breaks, and tiled layout before printing or saving as PDF. Fit-to-page and poster layouts make it easier to check how a large sketch will be split across sheets.
- **Export:** Review a live preview before exporting PNG, SVG, or PDF. PDFs support the current page, all pages, or a selected range, with fit-to-page or tiled output; configure page dimensions, headers, footers, crop marks, bleed, and RGB, CMYK, or grayscale output. PNG and SVG can use transparent backgrounds.
- **Windows workspace:** Windows adds multiple open sketch tabs, customizable shortcuts, the `Ctrl+K` command palette, and a full-screen focus mode. The palette searches tools, actions, settings, and symbols; the desktop toolbar groups common tools and keeps object properties close to the canvas.
- **Phone and tablet workspace:** Touch layouts adapt to portrait and landscape. Portrait keeps a compact horizontal tool rail at the top of the canvas; landscape uses a side dock. Common style controls, canvas options, page controls, and menus remain reachable by touch.
- **Touch and stylus input:** Draw and edit with a finger or compatible stylus. Use two fingers to pan and zoom, configure gesture actions, and use stylus pressure, tilt, and eraser-end input when the device reports them.
- **Appearance:** Follow the system theme or choose light or dark mode, set accent and toolbar colors, and switch diagram and note components between modern and simple appearances.
- **Presentation mode:** Hide the editing interface to present the canvas. Use the mouse, keyboard, or touch to move between sketch pages.
- **View-only mode and help:** Open a sketch without editing or saving it; the laser pointer and note-card expand/collapse controls remain available. The in-app guide and shortcut reference explain drawing, selection, files, pages, and export.
- **Release checks:** Use Help to compare the installed version with the latest public GitHub release. SketchDraw reports whether an update is available; downloads and installation remain manual.

## Modeling component follow-ups

Planned modeling improvements include:

- **UML:** Add semantic relationship controls and class-editor support for visibility modifiers.
- **ER diagrams:** Edit relationship cardinality and optionality, data types, and automatic foreign-key-to-primary-key matching for hand-drawn connectors.
- **Sequence diagrams:** Keep message connectors attached to their lifelines when either is moved.
- **C4 architecture:** Search and filter technology tags on component nodes.
- **Data flows:** Add optional animated indicators to show direction through architecture diagrams.
## File format

SketchDraw uses a JSON-based **version 9** format in `.sketch` files. Versions 1-8 are normalized to v9 when opened and saved back to their existing `.sketch` path. Version 9 stores `canvas`, `planning`, and `notebook` sections, with the retired Library collections held in `retiredLibraryArchive`. Version 8 and older Library collections are migrated into those v9 sections without dropping records. Edit-clock metadata supports shared-folder updates. Windows, phone, and tablet apps preserve the sections in the same document. `.sketchdraw` files and malformed or unrelated files remain unsupported.

To convert a file outside the app, run `npm run convert:sketch -- old.sketch converted.sketch`. The converter accepts supported SketchDraw versions 1-9, writes a v9 file to the requested destination, and refuses to overwrite the source or an existing destination.

SketchDraw does not host online workspaces or live cursors. Shared-file updates use the local file or provider URI and the sync service managing that folder; there is no SketchDraw server or cloud account. Conflicts use last-edit-wins metadata, so devices should have reasonably accurate system clocks. Offline changes merge after the provider delivers them.


## License

SketchDraw is distributed under the [End User License Agreement](LICENSE), not an open-source license. The application copyright belongs to Toushal Sampat; you retain rights to drawings and files you create. Third-party components remain under their respective licenses.

## Privacy and local data

SketchDraw has no account system, analytics, telemetry, or application service that uploads documents. The app uses Tauri's local filesystem and dialog APIs to open and save files selected by you. It does not send drawing content to SketchDraw servers.

Some app data is kept in local WebView storage on this device:

- Up to eight recent `.sketch` file paths, to populate the launch screen.
- Theme and tool accent preferences.
- A recovery snapshot for an open document when it has unsaved changes. Recovery data is removed after the document is saved or recovery is discarded; if neither happens, it remains in local app storage.

The recovery snapshot can contain the document's text, shapes, and embedded image data. It is stored locally so an interrupted session can be recovered. Other apps or accounts on this device may have access according to the operating system's user-account and device security.

If you save a project inside a cloud-sync folder, that folder's provider may upload and process the file under its own terms and settings. SketchDraw does not control that service. Exported files are written to the location you choose. The installer and operating system also have their own download, security, and update behavior; this project does not receive those reports.

The optional **Check for updates** action contacts GitHub's public Releases API only when you select it. SketchDraw compares the returned release version with its local version and reports whether a newer version is available. It does not open a browser, download an installer, or install an update. The request does not include sketch content, file paths, or drawing data; GitHub receives the ordinary network request under its own privacy terms.

PDF output supports RGB, process CMYK, and grayscale values. It does not currently embed or select a calibrated ICC press profile; confirm color conversion requirements with your print provider.

This description is not a legal certification for every jurisdiction or distribution setup. Data protection obligations can include transparency, purpose limitation, data minimization, retention, and security requirements.
