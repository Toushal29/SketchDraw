# Stylesheet ownership

SketchDraw currently targets Windows desktop. `src/App.css` is the global stylesheet manifest; its import order still affects the cascade. Component styles loaded from their owning TSX files stay beside those components.

| Area | Owning styles |
| --- | --- |
| Interface tokens and shell | `src/styles/app/theme.css`, `src/styles/app/foundation.css`, and `src/features/workspace/workspace-shell.css` |
| Windows chrome and tool deck | `src/platform/windows/windows.css`; toolbar structure also uses `src/styles/tools.css` and `src/styles/app/toolbar-polish.css` |
| Canvas navigation and tools | `src/styles/canvas-navigation.css`, `src/styles/app/canvas-tools.css`, and `src/styles/canvas-features.css` |
| Properties and editors | `src/styles/app/inspector.css`, `src/styles/full-inspector.css`, `src/styles/schema-editor.css`, and `src/styles/property-panel-redesign.css` |
| Menus and dialogs | `src/styles/app/menus.css`, `src/styles/toolbar-and-view-popovers.css`, `src/styles/workspace-view-panel.css`, `src/styles/app/dialogs.css`, and `src/styles/app/export-pages.css` |
| Welcome screen | `src/styles/app/home.css` |
| Planning workspace | `src/features/project/project-workspace.css` |
| Diagram shape library | `src/features/workspace/database-workspace.css` |
| Diagram guide gallery | `src/features/diagram-guides/gallery/diagram-guide-gallery.css` |
| Canvas web preview | `src/styles/app/web-preview.css`, imported directly by `src/App.tsx` |

Keep Windows-specific rules under `src/platform/windows/` and scope them to `.platform-windows` where the selector could affect another shell. Keep feature-specific rules with their owning feature. Preserve the existing token palette in `src/styles/app/theme.css` and use those tokens for new controls. `src/styles/app/ui-overrides.css`, `toolbar-polish.css`, `canvas-polish.css`, and `property-panel-redesign.css` are existing refinement layers; edit the component owner when a targeted rule can replace an override safely.
