# ToDo capability review

`ToDo.txt` is product input, not repository or coding-agent policy. The requested live collaboration features are excluded. The review below records what the app already had, what this implementation added, and the remaining boundaries.

## Coverage

| ToDo capability | Current coverage | Status |
| --- | --- | --- |
| UML, ERD, cloud, network, and BPMN libraries | Searchable built-in libraries, custom stencils, reusable component masters, and architecture symbols | Existing coverage retained. |
| Smart anchors, dynamic connectors, and obstacle routing | Bound connectors, named ports, dangling-connector repair, automatic routing, and route checks | Existing coverage retained. |
| Containers, swimlanes, grids, snapping, and alignment | Frames, containers, BPMN swimlanes, grid patterns, isometric paper, snapping guides, and auto-layout | Existing coverage retained. |
| Infinite canvas | World-space canvas without fixed board bounds | Existing coverage retained. |
| Data linking and refresh | Bind a selected canvas object to a row and value in a local CSV snapshot or a public HTTPS JSON API snapshot; refresh on request. SQL/schema import remains text based. | Local CSV and read-only public API snapshots added. API links require CORS, contain no credentials, and do not poll. Direct SQL connections remain unsupported. |
| Named current/future visibility states | Save, apply, and delete up to 24 per-page presets of hidden layers | Added and serialized with the sketch page. |
| Diagram as code | Mermaid, PlantUML, DOT, D2, CSV, SQL, and JSON Schema import/export | Existing coverage retained. |
| Canvas-to-planning task bridge | Create a Planning task from selected canvas objects, persist the task ID in the sketch, and show a completion check when that task is complete | Added. The sketch reference is one-way; completion is reflected from the linked Planning task. |
| Canvas plus project notebook | Edit an active `.sdplan` note beside the canvas; select a `[[Component name]]` line to select its matching canvas object | Added. Requires an open Planning file. |
| Interactive prototype/run mode | Run mode routes clicks to linked pages and built-in form controls. Form changes are temporary and reset when run mode ends. | Added for the built-in controls and page links. It does not provide a general variable/expression engine or arbitrary user-defined triggers. |
| UML/database code blueprints | Generate Java or Python class starter files from UML cards, or a Prisma schema from database cards, in a local ZIP | Added. Output is a scaffold and needs review for application-specific types and relationships. |
| Planning burndown/velocity | Planning Home graphs remaining tasks from creation/completion timestamps and reports tasks completed in the last week | Added. Historical data begins when a task's dates are available; older tasks without completion timestamps use their last update as an approximation. |
| Weekly local archive and 30-day rotation | On desktop, create a ZIP of clean open sketch/Planning documents weekly in app-local `.sdbackup` storage and remove archives older than 30 days | Added. This is local-only, excludes Android, and does not back up unsaved changes. |
| Resizable component editor | Drag the dock's side or use arrow keys to set its width; the preference persists locally and is capped for the current viewport | Added for the component and note editor dock. |

## Design boundary

SketchDraw remains local-first. CSV data and public API responses are embedded as bounded snapshots in `.sketch`; API refresh is user initiated, uses read-only HTTPS without credentials, and requires the endpoint to allow CORS. Direct database connections and live API polling are not included. Live collaboration and shared workspaces remain out of scope.
