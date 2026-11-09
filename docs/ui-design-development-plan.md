# UI Design workspace

**Status:** Independent UI editor with an infinite page canvas and nested screen/container frames. The .sdui schema is version 1.

UI Design is a separate top-level workspace beside Canvas and Planning. The application shell provides workspace navigation and native file access. UI Design owns its model, hierarchy, geometry, rendering, interactions, history, recovery, assets, prototype preview, and .sdui codec. It does not depend on Canvas or Planning feature code.

## Document and scene model

A document contains pages. Each page stores elements in one bounded flat array; parentId and order define the shared tree. Screen frames use named device/desktop presets. Container frames use custom dimensions. Both are the same hierarchy node type: either can contain shapes, text, images, components, groups, and nested frames. A nested frame is transparent in the parent and groups its children. Frame children use local coordinates; the hierarchy index resolves world transforms, bounds, ancestry, visibility, locking, order, and safe reparenting.

## Implemented workflows

- Welcome screen with create/open, recent designs, recovery restore/discard, and continue editing.
- Single-row editor topbar with selection, drawing tools, fit/selection/100%/zoom controls, frame presets, undo/redo, save, and presentation actions.
- Pages panel with Pages, Prototype flows, and Frames sections. Pages can be created, renamed, duplicated, deleted, and used as prototype destinations. Screen frames and custom container frames can be created, nested, resized, renamed, clipped, and configured with child constraints.
- Shared hierarchy across frames, groups, shapes, text, images, and component instances. Layer tree supports nested collapse, search, drag reorder/reparent, visibility, locking, multi-selection, grouping, ungrouping, duplication, deletion, and double-click rename. Groups are transparent containers whose bounds refit around their children while preserving child placement.
- Selection and marquee, move/resize, basic polygon point editing, and whole-pixel geometry. Per-page manual guides can be added from the Guides menu or canvas context menu, moved, positioned numerically, hidden, locked, and removed. Temporary alignment and equal-spacing lines guide movement and resize; optional snapping targets objects, manual guides, and a configurable grid step. Distance labels appear while moving/resizing or holding Alt, including gaps between objects and distances to a parent frame. Guide annotations are editor-only and are excluded from exports. Rulers are not included.
- Nested horizontal, vertical, and grid auto layout with live gap and independent padding, spacing-token reflow, wrapping, alignment, justification, fixed/hug/fill sizing, fixed and weighted fractional grid tracks, explicit placement and spans, absolute children, clipping, and recursive frame resize constraints.
- Reusable local components with master-to-instance propagation, nested component variants, component swap, detach, whole-instance reset, and per-child property overrides/reset. Stable component-scoped source identities preserve nested component membership alongside the containing component.
- UI pattern assets in a compact, searchable tile grid grouped into Basics, Controls, Forms, Patterns, Navigation, Data, and Components. Basics includes editable rectangles, ellipses, text labels, dividers, image placeholders, and avatars. Color, typography, spacing, radius, and effect tokens support editable aliases and mode values; JSON token import/export preserves these values, and cyclic alias graphs are rejected on import. Presets and custom token values remain editable.
- Raster and basic SVG import/export, image fit/crop, fills/strokes, typography, opacity, radius, preset/custom/token shadows, and inspectable CSS output. Appearance properties apply to the selected canvas node; frame clipping supports rounded corners.
- Prototype links and preview with navigation, back, overlays, click/hover/press/keyboard/timed triggers, variable conditions/actions, scroll overflow, fixed-on-scroll elements, and basic transitions.
- Inspect includes object geometry and style details. SVG/PNG export is available; PDF export lays out visible screen frames across pages.
- Find/replace, initial accessibility/style lint checks, undo/redo, local draft recovery, recent files, and .sdui save/open.

## File validation

Version 1 .sdui files store page metadata, hierarchical elements, component definitions, asset-library metadata, design tokens, responsive breakpoints, prototype variables, and links. Parsing enforces file-size, page-count, element-count, unique-identity, parent-kind, hierarchy, enum, and bounds limits. A malformed page rejects the entire document instead of being silently dropped. Unknown schema versions are rejected; no earlier .sdui versions are supported.

The format is separate from .sketch and .sdplan. Keep UI Design persistence and feature logic independent of those workspaces.

## Current implementation status and remaining backlog

This is the single source of truth for follow-up work. It distinguishes implemented model/editor paths from work that still needs deeper interaction coverage or new functionality.

### Implemented and covered by fixtures

- One hierarchy model is used for frames, groups, shapes, text, images, and component instances. It resolves local/world transforms, ancestry, clipping bounds, visibility, locking, constraints, reparenting, and prototype endpoint bounds.
- Group, ungroup, duplicate, and reorder operations use that hierarchy. Grouping reparents existing nodes; it does not clone their layer records. Fixtures cover rotated parents, world-transform preservation, internal-link remapping, and cycle prevention.
- Nested auto layout supports horizontal, vertical, and grid flow; fixed, weighted fractional, intrinsic, and minmax tracks; explicit row/column placement and spans; absolute children; wrapping; alignment; gap and independent padding; fixed/hug/fill sizing; and recursive frame constraints. Named breakpoint ranges, per-node responsive overrides, and side-by-side responsive frame previews are available in the UI Design editor.
- Color, typography, spacing, radius, and effect token values resolve against the active mode in rendering, layout, inspector editing, and exports. Every token family supports alias editing and resolution; invalid references are cleared and cyclic alias graphs are rejected during document normalization. Token import/export preserves aliases and mode values.
- Component master edits propagate bottom-up through nested component instances and across pages while preserving explicit per-child overrides. Variants can change root/descendant values and select variants on nested instances; the inspector records child edits as scoped overrides and can reset one child or the full instance. Fixtures cover nested variant precedence, nested master propagation, and master child insertion, removal, and reorder across multiple pages.
- Prototype model and preview include navigation, back, overlays, click/hover/press/keyboard/timed triggers, variable conditions/actions, scroll overflow, fixed-on-scroll elements, and basic transitions.
- Inspect includes geometry/style details and code output. SVG and PNG export are available, and PDF export lays out visible screen frames across pages.

### Remaining work

- **Hierarchy/editor regression coverage:** fixtures cover rotated nested transforms, clipping, ancestor visibility and locking, resize constraints, group/ungroup/duplicate/reorder, and internal-link remapping. Browser-level pointer checks are still needed for marquee, hit testing, drag reparenting, nested resize, connector placement, and presentation under transformed/clipped ancestors.
- **Components:** add browser-level interaction coverage for editing nested instances, switching their variants, saving/reopening those overrides, and synchronizing masters while nested instances are locally overridden. Cross-document component libraries and update notifications remain part of the asset-library backlog.
- **Tokens:** improve import conflict/merge feedback and provide clearer diagnostics for mode references filtered during document normalization.
- **Auto Layout/responsive:** fixed pixel, weighted fractional, intrinsic, and configurable `minmax(min, max)` grid tracks are supported. Breakpoint names and non-overlapping width ranges can be managed in the inspector; per-node position, size, and visibility overrides are editable by breakpoint. Responsive Preview compares a selected screen frame across the configured breakpoints, applying overrides and reflowing constraints and auto layout. Breakpoint-specific editing directly on the canvas and interactive drag resizing of preview widths remain follow-up work.
- **Prototype:** flow diagnostics, navigation/overlay controls, offline HTML presentation export, triggers, conditions, variables, scroll overflow, and fixed-on-scroll behavior have editor paths. Focused preview checks are still needed for conditions, timed/keyboard events, scroll containers, fixed children, and transformed/clipped parents; richer transitions and overlay behavior remain.
- **Assets/vectors:** searchable built-in assets and import/export of user component libraries are implemented. Larger SVG/icon catalogs remain. Path editing supports anchor and Bézier-handle adjustment; open paths, boolean operations, and general-purpose masks are not implemented. Gradient fills exist for shapes, but broader SVG fidelity for text, transforms, gradients, and embedded assets needs expansion.
- **Inspect/export:** SVG and PNG export, multi-screen PDF export, offline HTML presentation export, CSS/HTML/SolidJS scaffolds, and accessibility JSON reports have visible editor actions. Export workflows need manual review across nested/clipped content and image-heavy documents; richer computed-layout-rule inspection remains.
- **Productivity/accessibility:** text find/replace and initial lint checks exist. Robust mixed-value multi-edit, bulk rename, component dependency inspection, document-wide property replacement, broader contrast analysis, and touch-target checks need more coverage and controls.
- **Platform/layout:** desktop windows have a 960 × 640 logical-pixel minimum and no application maximum; responsive CSS handles narrower panel layouts. High-DPI rendering and Android companion workflows still need manual checks on supported devices. The Android welcome screen and shared editor route exist, but full touch interaction parity is not claimed.

npm run test:ui-design covers .sdui parsing and limits, hierarchy transforms and operations, clipping, ancestor visibility/locking, constraints, prototype links, viewport indexing, whole-pixel resize, auto-layout flow/wrapping/fill/grid/weighted tracks/absolute children, spacing-token reflow, mode-aware token resolution, nested component variants and master propagation, per-child override reset, and multi-page component structure synchronization. It is a model/geometry fixture suite, not a browser interaction test. Manual-guide, snapping, and measurement behavior is implemented in the editor but still needs browser-level pointer interaction coverage.

## Verification

- npm run typecheck
- npm run test:ui-design
- Run the Canvas browser audit only when shared Canvas code changes. Do not use an app build as a substitute for editor interaction review.

## References

Feature behavior is informed by [Figma design files](https://help.figma.com/hc/en-us/articles/15297425105303-Explore-design-files), [Figma layer measurements](https://help.figma.com/hc/en-us/articles/360039956974-Measure-distances-between-layers), [Figma Auto Layout](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma), [Figma components](https://help.figma.com/hc/en-us/articles/39747637290263-Components-collection-Tips-for-component-management), [Figma prototyping](https://help.figma.com/hc/en-us/articles/360040315773-Connect-your-prototype), [Penpot flexible layouts](https://help.penpot.app/user-guide/designing/flexible-layouts/), and [Penpot design tokens](https://help.penpot.app/user-guide/design-systems/design-tokens/). These sources describe expected interaction patterns; they do not define a copied interface.
