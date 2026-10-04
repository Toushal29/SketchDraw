# SketchDraw

`This app is made entirely using AI. Use at your own risk.`

SketchDraw is a local-first whiteboard for Windows, Android, and iOS, with a responsive workspace for desktop, tablet, and phone screens. Use it for flowcharts, diagrams, and visual notes. Each project is a portable `.sketch` file you choose where to save. Keep it on your device or in a folder managed by OneDrive, iCloud Drive, Dropbox, Google Drive, or another sync service.

**Current release: 5.0.0 · Document format: version 7 · Copyright © 2026 Toushal Sampat**

> SketchDraw 5.0.0 saves version 7 `.sketch` documents. Recognizable earlier SketchDraw JSON versions (1-6) are migrated to v7 when opened and saved back to the same `.sketch` file; unrelated or malformed files remain unsupported. The `.sketch` extension stays the same.

## Screenshots and previews

The following hand-authored SVGs illustrate the current tools and workflows. They are feature previews rather than pixel-perfect captures of the installed app, and the diagrams are example artwork rather than a user's private work.

![SketchDraw welcome screen with create/open actions and recent sketches](docs/screenshots/home-screen-current.svg)

*Launch screen: start a new file, browse for one, or reopen a recent sketch.*

![SketchDraw workspace preview with its tool bar, quick style rail, advanced inspector, and flowchart](docs/screenshots/workspace-current.svg)

*Workspace preview: compact drawing tools, direct canvas actions, quick styles, and contextual properties.*

![Advanced properties inspector with grouped controls and a separate Layers panel](docs/screenshots/advanced-inspector-preview.svg)

*Advanced inspector preview: compact controls and app-aware card colors beside the persistent quick-style rail; Layers opens separately from the canvas toolbar.*

![Standalone Layers panel with up and down arrow controls](docs/screenshots/layers-panel-preview.svg)

*Layers preview: move an object forward or backward with the row arrows, with visibility and lock controls beside each layer.*

![Toolbar surface matching the light and dark application themes](docs/screenshots/toolbar-auto-preview.svg)

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

*The library includes cloud, star, lightning, heart, and callout symbols.*

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

- **Writing and schema editing:** Resize note, sticky-note, and checklist cards from their canvas handles. Give each card a custom title; card colors follow the app light/dark appearance. Set text size from 8-32 px; it stays fixed when resizing, collapsing, and reopening, and the quick-style font controls update the selected card. Collapsed cards keep their title and show a short content or task-progress summary. Cards render their content in one grouped canvas object to keep dense boards lighter. `Tab` and `Shift+Tab` indent or outdent selected lines in these editors, including fenced code, and in the SQL/JSON schema input.
- **File-based projects:** Create, open, and automatically save version 7 `.sketch` files. Choose a 5- or 10-second autosave interval from the File menu; manual saves remain immediate. Opening a recognized version 1-6 SketchDraw file migrates it to v7 and saves it to the same `.sketch` path, unless a recovery copy or external file change needs attention. Native saves write and flush a temporary file beside the destination before replacing it. Up to eight recent file paths are remembered on the device. Opening a document restores the saved center of the view at 100% zoom; use Fit drawing when you want to frame every object.
- **Drawing tools:** Fine pen is an independent toolbar tool. The Paint brushes menu offers pencil, soft brush, marker, highlighter, and chalk presets. The transient laser pointer has adjustable thickness, fade duration, preset or custom color, and rainbow trails. Draw lines, arrows, rectangles, circles, diamonds, triangles, flowchart symbols, and formatted text; fill shapes with the bucket, erase marks, and import/crop images. Rectangles support sharp, rounded, pill, and cut corners with adjustable radius or cut size. The Shape & Component Library adds cloud, star, lightning, heart, and callout symbols alongside UML, ER, and architecture building blocks.
- **Flowchart symbols:** Process, Terminator, Decision, Input/Output, Document, Database, Predefined Process, Preparation, Manual Input, On-page Connector, Off-page Connector, Delay, Manual Operation, Stored Data, and Cloud. Star, Lightning, Heart, and Callout are available from the Shape & Component Library.
- **Connectors:** Straight lines, one-, two-, and three-control-point curves, and multi-point lines with four editable interior points; straight, elbow, forked, loop, and jagged arrows; solid, dashed, dotted, or double strokes; configurable arrowheads on lines and arrows; shape attachment points; and draggable route handles. Forked arrows have independent branch endpoints, routes, arrowheads, and shape attachments. Newly drawn connectors show their handles while keeping the current drawing tool active.
- **Object editing:** Select, move, resize, rotate, group, copy, cut, paste, duplicate, align, distribute, and reorder objects. Lock or hide layers, use precision controls, and access commands from the right-click menu.
- **Canvas controls:** Pan and zoom, fit the drawing, zoom to selection, use a grid, and snap to grid or nearby objects. The compact Canvas options menu groups view, snapping, and selection actions, with active states and shortcut hints. Undo, redo, and canvas lock are available directly on the tool bar.
- **Text, notes, and checklists:** Text starts at 16px. Choose sans-serif, handwritten, serif, or monospaced text with color, bold, italic, underline, lists, alignment, and wrapping. The five-item Text tool menu includes plain text, note + code, sticky note, checklist, and Diagram as code. Choose a card and click the canvas to write directly on the whiteboard; double-click a note to edit it. The inline editor keeps focus while typing and saves on Done, clicking away, or `Ctrl/⌘ + Enter`. Edit card titles in the editor or advanced properties; card surfaces follow the app light/dark appearance. Notes support Markdown-style headings and language-tagged fenced code blocks with syntax colors in both modern and simple appearance. Click checklist boxes to track progress. These cards and their code metadata are stored in the current v7 `.sketch` format.
- **Mermaid diagram as code:** Paste Mermaid flowchart code and see a live preview before generating native shapes and attached connectors. Its source is saved inside the diagram component in the `.sketch` file; double-click the diagram to reopen, edit, preview, and regenerate the code in place. The importer supports common flowchart directions, node labels and shapes, nested subgraphs, labeled connectors, and solid, dashed, dotted, thick, bidirectional, circle-end, and cross-end connectors.
- **Modeling components:** UML class cards open an editor for the class name, attributes, and methods. Their compartments grow as content is added, double-click opens the editor, and quick-style font controls resize their text. Table schema cards open the SQL/JSON schema editor and generate native linked table elements; stencil text is no longer prefilled. A standalone Layers panel in the canvas toolbar supports up/down layer controls, visibility, and lock controls outside the properties pane.
- **Database Schema Visualizer:** Paste SQL `CREATE TABLE` statements or JSON table definitions to create individual native table cards, rather than groups of text and shapes. Primary and foreign-key badges, column names, and data types render as one resizable canvas element; foreign-key connectors attach to their field rows and follow tables when they move. Double-click any generated card to reopen the saved raw SQL or JSON, edit it, and regenerate the complete linked diagram. Existing grouped schema cards remain loadable.
- **UML, ER, and architecture components:** The library inserts individual UML class cards with name, attribute, and method compartments; participant lifelines, activation bars, sync/async message arrows, and inheritance/realization/aggregation/composition presets; ER table cards and crow's-foot relationship examples; and C4 boundary frames, technology-tagged database/cloud/service nodes, data-flow arrows, and network-zone enclosures. Connector motifs move as a single group so arrowheads and lines stay together; ungroup them when you need to edit their pieces. Other component shapes remain individually editable. These are reusable parts rather than prefilled diagram templates.
- **Stylus input:** The Pen tool reads pressure and tilt when the platform reports compatible stylus pointer events, including Windows WebView2 and supported tablet webviews. Enable or disable pressure width, tilt shaping, and eraser-end support from the Pen quick-style controls. Stylus pressure and tilt values travel with freehand points in the `.sketch` document.
- **Touch navigation:** Draw and edit with one finger or a compatible stylus. Use two fingers to pan and zoom; configure two- and three-finger taps in the Gestures menu.
- **Compact touch controls:** Phones and tablets start with a compact tool dock on the left; tap **More** to open the full tool dock. The home screen keeps Create and Open close at hand and makes recent sketches easy to browse.
- **Whiteboard paper:** Choose a plain, dotted, or lined canvas from View settings on Windows, phones, and tablets.
- **Group erase:** Select several objects and use the floating **Delete** action, the Selection inspector, or the Delete key to remove them together in one undoable operation.
- **Images:** Imported images are embedded in the project file and can be cropped on the canvas.
- **Pages and history:** Add, rename, duplicate, reorder, and delete pages. Undo and redo history is maintained per page during the session.
- **Recovery and conflict checks:** Unsaved work is recoverable from local app storage. Before autosaving, SketchDraw checks for external changes to the open file and offers conflict choices.
- **Export:** Review a live preview before exporting PNG, SVG, or PDF. Fit-to-page PDFs keep diagram paths vector-native and text selectable, embed imported images, and preserve open, solid, dot, bar, diamond, and fork arrowheads. They support current page, all pages, or a chosen page range. Configure A4, Letter, A3, Legal, Tabloid, or custom page sizes; orientation; margins; headers, footers, page numbers, bleed, crop marks; RGB, CMYK, or grayscale output. Tiled poster PDFs use high-resolution raster pages with 150/300 DPI and adjustable overlap. PNG and SVG support transparent backgrounds.
- **Appearance and accents:** Follow the system light/dark appearance or choose a mode and whiteboard color. The View menu groups application theme, component style, toolbar surface, tool accent, and canvas colors in one compact panel. Set the toolbar surface to Auto to follow light/dark mode, or choose a fixed preset or custom color. Switch diagram and note cards between modern and simple monochrome styling. Whiteboard colors appear as compact named swatches. Neutral black and white strokes adapt to the active theme.
- **Focused interface:** A compact floating tool bar includes direct undo, redo, and lock controls. Tool dropdowns use a tighter layout, and a persistent vertical quick-style rail keeps common options close by, with an expandable contextual inspector for advanced settings.
- **In-app help:** Open the Guide or Keyboard shortcuts from separate Help menu actions. The guide covers drawing, selection, file handling, pages, and exporting.
- **Release checks:** Choose **Help → Check for updates** to compare your installed version with the latest public GitHub release. SketchDraw only reports whether a newer version is available; downloads and installation remain manual.

## Modeling component follow-ups

The current library provides reusable component presets. Deeper modeling interactions are planned next: a UML class editor that inserts visibility modifiers while typing; selectable semantic UML relationship and Crow's Foot cardinality/optionality controls; message connectors that lock to lifelines; editable ER data-type controls and automatic FK-to-PK detection for hand-drawn connectors; searchable C4 technology tags; and animated data-flow indicators. Generated schema references already connect at their PK/FK field rows, and manual connectors can attach to those same row anchors.

## File format

SketchDraw 5.0.0 uses a JSON-based **version 7** format in `.sketch` files. Recognizable version 1-6 SketchDraw JSON documents are normalized to v7 when opened and saved back to their existing `.sketch` path. Missing page settings and legacy element IDs receive safe defaults. Version 7 adds stored Mermaid source to editable flowchart components. The loader retains support for the existing elements and groups from older files. `.sketchdraw` files and malformed or unrelated files remain unsupported. Renaming an old file does not convert it; opening it in SketchDraw does. The file extension remains `.sketch`.

SketchDraw has no shared online workspaces, collaborative sessions, live cursors, or background document uploads. If you place a `.sketch` file inside a cloud-sync folder, synchronization is handled by that provider; conflict checks reduce accidental overwrites but do not provide distributed locking.

## Download and install

The Windows setup installer is not Authenticode-signed. Package metadata names **Toushal Sampat** as publisher, but that metadata does not authenticate the installer. Windows may show a SmartScreen warning for an unrecognized download. To install an update, visit the GitHub release page and run its setup file manually.

For a Windows x64 NSIS installer, run the build command below with `--bundles nsis` and publish it manually through GitHub Releases.

## Changing the app version

Before making another release, update the app version in `package.json`, the root package entry in `package-lock.json`, `[package].version` in `src-tauri/Cargo.toml`, and the top-level `version` in `src-tauri/tauri.conf.json`. Regenerate the lock files with `npm install --package-lock-only` and `cargo check --manifest-path src-tauri/Cargo.toml` rather than editing generated dependency data by hand. Update the release tag and current release details. The document format version is independent of the app version; change it only when intentionally introducing a new file schema.

## Copyright and ownership

SketchDraw, its original application code, interface design, and SketchDraw brand assets are © 2026 **Toushal Sampat**. All rights reserved, subject to the [End User License Agreement](LICENSE). Third-party libraries and bundled components remain the property of their respective authors and are governed by their own licenses. Drawings created by users remain theirs.

## Build from source

### Requirements

- Node.js and npm
- Rust toolchain
- Tauri v2 system dependencies for your operating system

See the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for platform-specific setup.

### Run the desktop app

```sh
npm ci
npm run tauri -- dev
```

Build the frontend with `npm run build`, or create a desktop bundle with:

```sh
npm run tauri -- build
```

To build the Windows x64 NSIS installer:

```powershell
npm run tauri -- build --bundles nsis
```

The resulting setup installer is unsigned, so SmartScreen warnings may appear on other computers.

### Android and iOS

Tauri mobile targets need their platform toolchains and a one-time native project setup. Follow the [Tauri mobile prerequisites](https://v2.tauri.app/start/prerequisites/) first, then initialize and run Android from this repository. The Android app opens in landscape and hides the system bars during use; swipe from an edge to reveal them temporarily.

```sh
npm run tauri -- android init
npm run tauri -- android dev
```

Build an Android package with `npm run tauri -- android build`. iOS setup and builds require macOS with Xcode:

```sh
npm run tauri -- ios init
npm run tauri -- ios dev
```

Build an iOS package with `npm run tauri -- ios build`.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `V` | Select tool |
| `P` | Pen |
| `Y` | Laser pointer (temporary, not saved) |
| `R` | Rectangle |
| `C` or `O` | Circle |
| `D` | Diamond |
| `N` | Triangle |
| `L` | Line |
| `A` | Arrow |
| `F` | Flowchart symbols |
| `T` | Text |
| `B` | Fill bucket |
| `E` | Eraser |
| `X` | Image crop |
| Hold `Space` | Temporarily pan the canvas |
| `G` | Toggle grid |
| `Shift+G` | Toggle grid snapping |
| `Shift+O` | Toggle object snapping |
| `K` | Lock or unlock the canvas |
| `0` | Reset zoom and center view |
| `1` / `2` | Fit drawing / zoom to selection |
| `Ctrl/Cmd+C`, `X`, `V` | Copy, cut, paste objects |
| `Ctrl/Cmd+D` | Duplicate selection |
| `Ctrl/Cmd+A` | Select all visible, unlocked objects |
| Arrow keys / `Shift`+Arrow | Nudge selection by 1 / 10 units |
| `Ctrl/Cmd+N` | New document |
| `Ctrl/Cmd+O` | Open document |
| `Ctrl/Cmd+S` | Save document |
| `Ctrl/Cmd+Z` | Undo |
| `Ctrl/Cmd+Y` or `Ctrl/Cmd+Shift+Z` | Redo |
| `Ctrl/Cmd+G` | Group selected objects |
| `Ctrl/Cmd+Shift+G` | Ungroup selection |
| `Escape` | Return to Select and clear selection |

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
