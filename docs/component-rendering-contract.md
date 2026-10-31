# Component rendering contract

This note describes the shared geometry and rendering rules for library components. The catalog attaches a `ComponentGeometryDefinition` to every entry in `src/features/components/library-components.ts`; the implementation lives in `src/features/components/component-geometry.ts`.

## Geometry contract

Each definition stores:

- `outlinePath`: a local SVG path in a normalized 100 by 100 reference box, scaled from the component's actual bounds.
- `labelBox`: normalized label area for placement and wrapping.
- `resize`: aspect lock, minimum dimensions, and fixed or stretch regions for icon and header layouts.
- `portStrategy`: outline projection, per row, along the line, per lane, or no generated ports.
- `lod`: declared detail, label, and outline thresholds. The current renderer intentionally ignores these thresholds and draws the full component at every zoom level.

Connector projection uses the existing `closestOutlineAnchor` helper in `src/operations.ts`. A proxy `svgPath` feeds the same SVG contour sampling and nearest-point calculation used by irregular primitive shapes. The returned normalized anchors then drive connector endpoints. Per-row ports follow the form option rows and list/table rows; lane ports follow the lane count. Existing custom ports and old cardinal port IDs remain valid when a component has no generated ports.

Canvas hit testing checks the same contour path and label box. Open contours, such as actors, are hit by their stroked segments. Lasso selection samples the contour path. Connector endpoints project to the contour before binding. SVG artwork is clipped to the component bounds so internal marks do not spill outside the object. The extra hover and selection contour has been removed at the user's request; resize and rotation handles remain visible. Selection bounds continue to use the component bounds.

The contract reuses shape path caches and outline projection rather than adding another independent geometry system. The catalog currently gives irregular outlines to the BPMN event and gateway families, UML actors and markers, C4 people, ER relationships and attributes, provider neutral clouds, internet clouds, and annotations. Other entries use a rectangular outline until their visible contour needs a specialized path.

## Six geometry spot checks

Before values are the old shared box-midpoint ports, normalized to the component bounds. After values describe the new default cardinal points from the visible contour; actor and person ports land on their nearest visible stroke. The exact sampled point on a symmetric stick figure can choose either leg.

| Kind | Size before → after | Ports before | Ports after (north, east, south, west) | Label before → after |
|---|---:|---|---|---|
| `bpmn-start` | 96×92 → 100×100 | (.5,0), (1,.5), (.5,1), (0,.5) | (.5,.051), (.749,.30), (~.5,.549), (.251,.30) | 7.68 px, one line → 9 px minimum, event detail and title use the label area |
| `bpmn-gateway` | 58×58 → 75×75 | (.5,0), (1,.5), (.5,1), (0,.5) | (.5,0), (.887,.387), (.5,.773), (.113,.387) | 7 px and “Exclusive…” → 9 px minimum, up to two lines |
| `uml-actor` | 76×116 → 75×125 | shared box midpoints | (.5,.024), (.774,.40), (~.284,.69), (.226,.40) | label could collide with figure → label sits below figure and wraps to two lines |
| `c4-person` | 126×122 → 125×125 | shared box midpoints | (.5,.112), (.66,.336), (~.38,.656), (.34,.336) | single-line title and role → title, role, and goal share the lower label area |
| `aws-dynamodb` | 176×108 → 175×100 | shared box midpoints | (.5,0), (1,.5), (.5,1), (0,.5) | “Amazon…” at 7–7.9 px → title wraps at 9 px minimum beside the icon |
| `form-checkbox` | 150×75 → 150×75 | shared box midpoints | header north; row-aware east, south, and west; plus `row-1` to `row-3` | option rows remain one line where they fit; minimum height now accounts for the actual row pitch |

The port coordinates are normalized to bounds, so instance placement does not affect them. BPMN event bounds include their label area; the circle ports therefore sit on the circle rather than at the outer card midpoint. The `form-checkbox` row positions follow the default vertical layout: about `.328`, `.557`, and `.787` of its height.

## Default size grid

New catalog instances snap to 25-unit increments. These examples keep the current family proportions while making neighboring shapes line up more easily.

| Family | Representative defaults after snapping |
|---|---|
| UML | Actor 75×125; class 225×150; lifeline 150×250 |
| ER | Entity 150×75; relationship 150×100; attribute 150×75 |
| C4 | Person 125×125; software system 225×125 |
| BPMN | Start event 100×100; gateway 75×75; task 175×75 |
| Cloud | AWS DynamoDB 175×100; provider service cards retain their nearest 25-unit size |
| Network | Router 100×75; server and switch cards use their nearest 25-unit size |
| GUI and forms | Input 175×50; checkbox group 150×75; card 175×125 |
| Data visualization | Bar chart 250×175; radar chart 275×200; heatmap 300×200 |

Chart resize limits are 150×100, or 125×75 for KPI cards, to keep axes and labels readable. Existing saved bounds are not rewritten on load.

## Text and appearance

`component-text.ts` is the shared canvas/SVG font mapping and baseline metric helper. Text uses measured alphabetic baselines, wraps to two lines where the renderer has a width, then adds an ellipsis. Component text has a 9 px minimum. SVG text normalization removes `dominant-baseline`, adjusts the baseline from canvas metrics, and rounds numeric SVG values to two decimals. GUI forms use the same font mapping and baseline helper.

The repository has no bundled font asset. The shared default is `system-ui, 'Segoe UI', sans-serif`; explicit component font-family choices are resolved through the same `fontCss` mapping for both measurement and output. A bundled font can replace this mapping later without changing the geometry contract.

Component palette tokens are defined in `src/styles/app/theme.css` and read for the requested light or dark theme. Provider brand marks and user-selected colors remain explicit. Component strokes use 1, 1.5, or 2 px; aligned rectangles snap to device-pixel edges. GUI form surfaces honor an explicit transparent fill.

## Caching and deterministic output

- Component raster cache keys include kind, size, style, theme, zoom bucket, and a hash of fields and icon state. Full vector detail is rasterized for the cache; no white LOD stand-ins replace components when zooming out. Coarse-pointer devices use a smaller cache budget.
- Primitive and component contours reuse cached `Path2D` objects. Material Design icon paths already have a local path cache.
- SVG export writes identical component renderings once as `<symbol>` and references them with `<use>`. Component SVG no longer emits random data IDs.
- Provider artwork is decoded from local embedded SVG data and packed into a reusable sprite. Coarse-pointer devices cap the sprite to 64 entries.
- ECharts output is retained as a bitmap per component identity, options, size, theme, and device-pixel scale. Editing, resizing, theme changes, or scale changes rebuild the affected cache entry.
- SVG geometry numbers are rounded to two decimal places. Component output contains no random identifiers.

## Storage compatibility

The `.sketch` version remains v2. Serialization omits catalog-owned labels, hints, default fields, default chart data, and default GUI properties. It retains component kind, bounds, field values, custom fields, appearance, and overrides. On load, the catalog restores those defaults and validates saved values using the existing parser; legacy v2 documents remain readable and retain their identifiers and bindings.

Legacy child-drawn model groups are still readable. The renderer retirement sequence is:

1. On open, identify legacy groups by their serialized kind and record any conversion diagnostics without changing IDs, bounds, fields, or connector references.
2. Convert eligible groups to the catalog-backed component representation and verify references before saving; preserve unconvertible groups in their original representation.
3. Keep the old reader for one release after the migration ships.
4. Remove the old renderer only after the compatibility release and after fixture documents prove that IDs, bounds, labels, fields, and bindings survive round trips.

No migration is applied to a document merely because it is opened; this release changes serialization of current catalog metadata without changing the format version.
