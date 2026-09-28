# SketchDraw

`This app is made entirely using AI. Use at your own risk.`

SketchDraw is a local-first desktop whiteboard for flowcharts, diagrams, and visual notes. Each project is a portable `.sketch` file you choose where to save. Keep it on your computer or in a folder managed by OneDrive, iCloud Drive, Dropbox, Google Drive, or another sync service.

**Current release: 3.0.0 · Document format: version 6 · Copyright © 2026 Toushal Sampat**

> SketchDraw 3.0.0 opens and saves only version 6 `.sketch` documents. Version 5 and earlier documents, as well as `.sketchdraw` files, are unsupported. Changing a file extension does not convert a document.

## Screenshots and previews

The following hand-authored SVGs illustrate the current tools and workflows. They are feature previews rather than pixel-perfect captures of the installed app, and the diagrams are example artwork rather than a user's private work.

![SketchDraw welcome screen with create/open actions and recent sketches](docs/screenshots/home-screen-current.svg)

*Launch screen: start a new file, browse for one, or reopen a recent sketch.*

![SketchDraw workspace preview with its tool bar, quick style rail, advanced inspector, and flowchart](docs/screenshots/workspace-current.svg)

*Workspace preview: compact drawing tools, direct canvas actions, quick styles, and contextual properties.*

![PDF export preview showing paper size, orientation, layout, print quality, margins, and page preview](docs/screenshots/pdf-pages-preview.svg)

*PDF export preview: standard paper sizes, custom dimensions, portrait or landscape, fit-to-page or tiled pages, overlap, margins, and print quality.*

![SketchDraw flowchart preview with editable connectors and flowchart shapes](docs/screenshots/flowchart-board-preview.svg)

*Diagram preview: editable flowchart shapes, labels, filled symbols, and attached connectors.*

![Connector routing and line style gallery](docs/screenshots/connector-routes.svg)

*Connector examples: straight, elbow, forked, loop, and jagged routes, plus varied line styles.*

![Flowchart symbol collection](docs/screenshots/flowchart-symbols.svg)

*Flowchart symbol gallery, including database, decision, document, and process symbols.*

![New productivity symbols and elements](docs/screenshots/symbols-elements-preview.svg)

*New symbols include cloud, star, lightning, heart, callout, and gear.*

![In-place note, sticky note, and checklist editing on the canvas](docs/screenshots/canvas-notes-preview.svg)

*Notes, sticky notes, and checklists open as writing surfaces directly on the whiteboard.*

![Database schema visualizer generating linked tables](docs/screenshots/database-schema-preview.svg)

*Paste SQL `CREATE TABLE` statements or JSON and generate table cards with foreign-key links attached to field rows.*

![UML, ER, and architecture component palette](docs/screenshots/modeling-components-preview.svg)

*Insert individual class, sequence, ER, and C4 architecture components instead of a prefilled diagram.*

![Windows pen pressure and tilt controls](docs/screenshots/windows-pen-preview.svg)

*Windows pen input uses pressure, tilt, and eraser-end data from WebView2 pointer events.*

![Complex local-first document workflow diagram](docs/screenshots/complex-workflow-preview.svg)

*A larger example combines decision branches, database storage, retries, attached connectors, and multi-stage process lanes.*

## Features

- **Writing and schema editing:** Resize note, sticky-note, and checklist cards from their canvas handles. Set each card's text size from 8–32 px; the chosen size stays with the card when resizing, collapsing, and reopening it. `Tab` and `Shift+Tab` indent or outdent selected lines in those editors, including fenced code, and in the SQL/JSON schema input.
- **File-based projects:** Create, open, and automatically save version 6 `.sketch` files. Native saves write and flush a temporary file beside the destination before replacing it. Up to eight recent file paths are remembered on the device. Opening a document restores the saved center of the view at 100% zoom; use Fit drawing when you want to frame every object.
- **Drawing tools:** Smooth freehand pen and a transient laser pointer. Draw lines, arrows, rectangles, circles, diamonds, triangles, flowchart symbols, and formatted text; fill shapes with the bucket, erase marks, and import/crop images. Rectangles support sharp, rounded, pill, and cut corners with adjustable radius or cut size. The Shape & Component Library adds new cloud, star, lightning, heart, callout, and gear symbols alongside UML, ER, and architecture building blocks.
- **Flowchart symbols:** Process, Terminator, Decision, Input/Output, Document, Database, Predefined Process, Preparation, Manual Input, On-page Connector, Off-page Connector, Delay, Manual Operation, Stored Data, Cloud, Star, Lightning, Heart, Callout, and Gear.
- **Connectors:** Straight lines, one-, two-, and three-control-point curves, and multi-point lines with four editable interior points; straight, elbow, forked, loop, and jagged arrows; solid, dashed, dotted, or double strokes; configurable arrowheads on lines and arrows; shape attachment points; and draggable route handles. Forked arrows have independent branch endpoints, routes, arrowheads, and shape attachments. Newly drawn connectors show their handles while keeping the current drawing tool active.
- **Object editing:** Select, move, resize, rotate, group, copy, cut, paste, duplicate, align, distribute, and reorder objects. Lock or hide layers, use precision controls, and access commands from the right-click menu.
- **Canvas controls:** Pan and zoom, fit the drawing, zoom to selection, use a grid, and snap to grid or nearby objects. Undo, redo, and canvas lock are available directly on the tool bar; other view and grouping controls are in the canvas options grid.
- **Text, notes, and checklists:** Text starts at 16px. Choose sans-serif, handwritten, serif, or monospaced text with color, bold, italic, underline, lists, alignment, and wrapping. The Text tool menu includes notes, sticky notes, and interactive checklists. Choose a note tool and click the canvas to write directly on the whiteboard; double-click a note to edit it. The inline editor keeps focus while typing and saves on Done, clicking away, or `Ctrl/⌘ + Enter`. Notes support Markdown-style headings and language-tagged fenced code blocks, with syntax colors on the canvas. Click checklist boxes directly to track progress. Notes and checklists are saved with the drawing in the existing `.sketch` format.
- **Database Schema Visualizer:** Paste SQL `CREATE TABLE` statements or JSON table definitions to create a set of editable table cards. Primary and foreign-key badges, column names, and data types are drawn on each card. Foreign-key connectors attach to the matching field-row anchors, and keep following rows when tables move.
- **UML, ER, and architecture components:** The library inserts individual UML class cards with name, attribute, and method compartments; participant lifelines, activation bars, sync/async message arrows, and inheritance/realization/aggregation/composition presets; ER table cards and crow's-foot relationship examples; and C4 boundary frames, technology-tagged database/cloud/service nodes, data-flow arrows, and network-zone enclosures. Components are grouped ordinary SketchDraw shapes and text, so they can be moved, ungrouped, and customized. These are reusable parts rather than prefilled diagram templates.
- **Windows stylus input:** On Windows, the Pen tool reads pressure and tilt from WebView2 pointer events. Enable or disable pressure width, tilt shaping, and the compatible pen's eraser end from the Pen quick-style controls. Stylus pressure and tilt values travel with freehand points in the existing version 6 `.sketch` document.
- **Images:** Imported images are embedded in the project file and can be cropped on the canvas.
- **Pages and history:** Add, rename, duplicate, reorder, and delete pages. Undo and redo history is maintained per page during the session.
- **Recovery and conflict checks:** Unsaved work is recoverable from local app storage. Before autosaving, SketchDraw checks for external changes to the open file and offers conflict choices.
- **Export:** Review a live preview before exporting PNG, SVG, or PDF. Fit-to-page PDFs keep diagram paths vector-native and text selectable, embed imported images, and preserve open, solid, dot, bar, diamond, and fork arrowheads. They support current page, all pages, or a chosen page range. Configure A4, Letter, A3, Legal, Tabloid, or custom page sizes; orientation; margins; headers, footers, page numbers, bleed, crop marks; RGB, CMYK, or grayscale output. Tiled poster PDFs use high-resolution raster pages with 150/300 DPI and adjustable overlap. PNG and SVG support transparent backgrounds.
- **Themes:** Follow the system light/dark appearance or choose a theme and canvas color. Neutral black and white strokes adapt to the active theme.
- **Focused interface:** A compact floating tool bar includes direct undo, redo, and lock controls. A persistent vertical quick-style rail keeps common options close by, with an expandable contextual inspector for advanced settings.
- **In-app help:** Open the Guide or Keyboard shortcuts from separate Help menu actions. The guide covers drawing, selection, file handling, pages, and exporting.
- **Release checks:** Choose **Help → Check for updates** to compare your installed version with the latest public GitHub release. SketchDraw only reports whether a newer version is available; downloads and installation remain manual.

## Modeling component follow-ups

The current library provides reusable component presets. Deeper modeling interactions are planned next: a UML class editor that inserts visibility modifiers while typing; selectable semantic UML relationship and Crow's Foot cardinality/optionality controls; message connectors that lock to lifelines; editable ER data-type controls and automatic FK-to-PK detection for hand-drawn connectors; searchable C4 technology tags; and animated data-flow indicators. Generated schema references already connect at their PK/FK field rows, and manual connectors can attach to those same row anchors.

## File format

SketchDraw 3.0.0 uses a JSON-based **version 6** format in `.sketch` files. Version 5 and earlier documents, `.sketchdraw` files, and unrelated files with a `.sketch` extension are rejected. Renaming an old file does not convert it. Notes add optional metadata to existing group objects; their visible content, schema cards, and component library items use regular version 6 shapes and text. Freehand points can also carry optional pressure and tilt values. No new file extension or document version is introduced. Keep a backup of older projects before upgrading; they must be recreated in SketchDraw 3.0.0.

SketchDraw has no shared online workspaces, collaborative sessions, live cursors, or background document uploads. If you place a `.sketch` file inside a cloud-sync folder, synchronization is handled by that provider; conflict checks reduce accidental overwrites but do not provide distributed locking.

## Download and install

The Windows setup installer is not Authenticode-signed. Package metadata names **Toushal Sampat** as publisher, but that metadata does not authenticate the installer. Windows may show a SmartScreen warning for an unrecognized download. To install an update, visit the GitHub release page and run its setup file manually.

For a Windows x64 NSIS installer, run the build command below with `--bundles nsis` and publish it manually through GitHub Releases.

## Changing the app version

Before making another release, update the app version in `package.json`, the root package entry in `package-lock.json`, `[package].version` in `src-tauri/Cargo.toml`, and the top-level `version` in `src-tauri/tauri.conf.json`. Regenerate the lock files with `npm install --package-lock-only` and `cargo check --manifest-path src-tauri/Cargo.toml` rather than editing generated dependency data by hand. Update the release tag and current release details. The document format version is independent of the app version; change it only when intentionally introducing a new file schema. The [release guide](docs/release-3.0.0.md) lists the build and publishing steps.

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
- A theme preference.
- A recovery snapshot for an open document when it has unsaved changes. Recovery data is removed after the document is saved or recovery is discarded; if neither happens, it remains in local app storage.

The recovery snapshot can contain the document's text, shapes, and embedded image data. It is stored locally so an interrupted session can be recovered. Other apps or accounts on this device may have access according to the operating system's user-account and device security.

If you save a project inside a cloud-sync folder, that folder's provider may upload and process the file under its own terms and settings. SketchDraw does not control that service. Exported files are written to the location you choose. The installer and operating system also have their own download, security, and update behavior; this project does not receive those reports.

The optional **Check for updates** action contacts GitHub's public Releases API only when you select it. SketchDraw compares the returned release version with its local version and reports whether a newer version is available. It does not open a browser, download an installer, or install an update. The request does not include sketch content, file paths, or drawing data; GitHub receives the ordinary network request under its own privacy terms.

PDF output supports RGB, process CMYK, and grayscale values. It does not currently embed or select a calibrated ICC press profile; confirm color conversion requirements with your print provider.

This description is not a legal certification for every jurisdiction or distribution setup. Data protection obligations can include transparency, purpose limitation, data minimization, retention, and security requirements.
