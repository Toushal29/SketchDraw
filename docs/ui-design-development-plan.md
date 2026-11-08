# UI Design workspace

**Status:** Independent UI editor with an infinite page canvas and nested screen/container frames. The `.sdui` schema is version 1.

UI Design is a separate top-level workspace beside Canvas and Planning. The application shell provides workspace navigation and native file access. UI Design owns its model, hierarchy, geometry, rendering, interactions, history, recovery, assets, prototype preview, and `.sdui` codec. It does not depend on Canvas or Planning feature code.

## Document and scene model

A document contains pages. Each page stores elements in one bounded flat array; `parentId` and `order` define the shared tree. Screen frames use named device/desktop presets. Container frames use custom dimensions. Both are the same hierarchy node type: either can contain shapes, text, images, components, groups, and nested frames. A nested frame is transparent in the parent and groups its children. Frame children use local coordinates; the hierarchy index resolves world transforms, bounds, ancestry, visibility, locking, order, and safe reparenting.

## Implemented workflows

- Welcome screen with create/open, recent designs, recovery restore/discard, and continue editing.
- Single-row editor topbar with selection, drawing tools, fit/selection/100%/zoom controls, frame presets, undo/redo, save, and presentation actions.
- The Pages panel restores distinct Pages, Prototype flows, and Frames sections. Pages can be created, renamed, duplicated, deleted, and used as prototype destinations. Screen frames and custom container frames can be created, nested, resized, renamed, clipped, and configured with child constraints.
- Shared hierarchy across frames, groups, shapes, text, images, and component instances. Layer tree supports nested collapse, search, drag reorder/reparent, visibility, locking, multi-selection, grouping, ungrouping, duplication, deletion, and double-click rename. Groups are transparent containers whose bounds refit around their children after edits while preserving child placement.
- Selection and marquee, move/resize, basic polygon point editing, and whole-pixel geometry. UI Design does not render a canvas grid, alignment guides, snap targets, or spacing-measurement overlays.
- Nested horizontal, vertical, and grid auto layout with live gap and independent padding, spacing-token reflow, wrapping, alignment, justification, fixed/hug/fill sizing, clipping, and recursive frame resize constraints. The inspector reports effective child count, gap, and padding; changing these properties reflows the canvas.
- Reusable local components with nested child content, default/compact variants, instance override reset, and detach. Components can be inserted from the asset panel.
- UI pattern assets in a compact, searchable tile grid with collapsible Basics, Controls, Forms, Patterns, Navigation, Data, and Components groups. Basics includes editable rectangles, ellipses, text labels, dividers, image placeholders, and avatars; local components appear in their own group. Color and typography/spacing/radius/effect token collections live in the Design inspector with color aliases/modes and JSON token import/export. Each token section offers curated presets and a custom-token action; inserted values remain editable, including typography family, size, weight, line height, and letter spacing.
- Raster and basic SVG import, basic SVG export, image fit/crop, fills/strokes, typography, opacity, radius, preset/custom/token shadows, and inspectable CSS output. Appearance properties apply to the selected canvas node; frame clipping supports rounded corners. Arbitrary vector masks are not available yet.
- Prototype links with click/hover/press triggers, page or frame navigation, back, overlays, and instant/dissolve/slide transitions. A presentation preview scales the selected screen to the viewport.
- Find/replace, accessibility/style lint checks, undo/redo, local draft recovery, recent files, and `.sdui` save/open.

## File validation

Version 1 `.sdui` files store page metadata, hierarchical elements, component definitions, asset-library metadata, design tokens, and prototype links. Parsing enforces the file-size, page-count, element-count, unique-identity, parent-kind, hierarchy, enum, and bounds limits. A malformed page rejects the entire document instead of being silently dropped. Unknown schema versions are rejected; no earlier `.sdui` versions are supported.

The format is separate from `.sketch` and `.sdplan`. Keep UI Design persistence and feature logic independent of those workspaces.

## Known follow-up work

- Component definitions are currently local snapshots. Add robust master editing/live instance updates, nested variant properties, component swapping, and finer-grained overrides.
- Expand asset libraries from document metadata and built-in patterns into editable user libraries with importable component kits and searchable SVG/icon catalogs.
- Expand vector editing with Bézier handles, open paths, stroke caps/joins, boolean operations, and complete SVG import/export for transforms, text, gradients, and embedded assets.
- Add prototype conditions, variables, scroll containers, richer overlay settings, flow diagnostics, and exportable presentation links.
- Add richer multi-edit, bulk rename, component dependency inspection, design lint rules, contrast analysis, and touch-target accessibility checks.
- Add token alias/mode editing workflows for all token families and validate imported token JSON before applying it.
- Review interaction and layout behavior at minimum/maximum supported window sizes, high-DPI scaling, and the Android companion shell.

### Backlog audit: still outstanding

- **Components:** definitions are local snapshots. Add editable masters with live instance propagation, nested variant properties, component swapping, and per-child overrides/reset.
- **Assets:** expand built-in patterns into editable, importable user libraries and searchable SVG/icon/component catalogs.
- **Vectors:** add Bézier handle editing, open paths, stroke caps/joins, boolean operations, arbitrary masks, gradients, and broader SVG support for transforms, text, and embedded assets.
- **Prototype:** add keyboard/timed triggers, conditions and variables, scroll containers/fixed layers, richer overlays/transitions, link validation, flow diagnostics, and a more complete presentation export.
- **Inspect/export:** add computed layout-rule inspection, multi-frame export, PNG/PDF export, and HTML/CSS or component scaffolds.
- **Productivity/accessibility:** add robust multi-edit, bulk rename, component dependency inspection, find/replace across the whole document, design lint, contrast checks, and touch-target checks.
- **Tokens:** add aliases and modes to typography, spacing, radius, and effects (color modes are currently the only mode-aware token family), plus stronger import validation and library-level token sharing.
- **Hierarchy regression coverage:** the shared tree drives scene rendering, world bounds, selection, visibility/locking inheritance, connector placement, and group reparenting. Continue coverage for nested clipping, rotated-parent resize, group/ungroup/duplicate/reorder, and ancestor lock/visibility interactions.
- **Platform/layout:** review interaction and panel behavior at minimum/maximum supported window sizes, high-DPI scaling, and the Android companion shell.

`npm run test:ui-design` covers `.sdui` parsing and limits, hierarchy transforms/reparenting, viewport indexing, whole-pixel resize, auto-layout flow/wrapping/fill, spacing-token reflow, and recursive nested-frame constraints. It does not exercise browser pointer interactions, visual clipping, or prototype preview; those still need manual interaction review. Grid, snapping, alignment-guide, and spacing-measurement tests were removed because those editor features were intentionally removed.

## Verification

- `npm run typecheck`
- `npm run test:ui-design`
- Run the Canvas browser audit only when shared Canvas code changes. Do not use an app build as a substitute for editor interaction review.

## References

Feature behavior is informed by [Figma design files](https://help.figma.com/hc/en-us/articles/15297425105303-Explore-design-files), [Figma layer measurements](https://help.figma.com/hc/en-us/articles/360039956974-Measure-distances-between-layers), [Figma Auto Layout](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma), [Figma components](https://help.figma.com/hc/en-us/articles/39747637290263-Components-collection-Tips-for-component-management), [Figma prototyping](https://help.figma.com/hc/en-us/articles/360040315773-Connect-your-prototype), [Penpot flexible layouts](https://help.penpot.app/user-guide/designing/flexible-layouts/), and [Penpot design tokens](https://help.penpot.app/user-guide/design-systems/design-tokens/). These sources describe expected interaction patterns; they do not define a copied interface.
