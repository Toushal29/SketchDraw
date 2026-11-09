# UI Design inspector research and rebuild

## Research summary

Reviewed Figma's official guidance for its right properties panel, variables and modes, Auto Layout, and prototype interactions on 2026-11-09.

- Figma uses a contextual right properties panel. With a selected layer it exposes properties for that layer. With no selection it exposes the local styles and variables library. Design and Prototype are separate editor contexts, while Inspect is aimed at design handoff.
- Position, dimensions, rotation, and alignment are grouped together near the top of the Design panel. Auto Layout exposes flow, spacing, padding, sizing, and alignment together because those values change child layout as one system.
- Variables can be applied to supported layer properties. Variable modes change the effective value on the canvas, and aliases allow one token to derive from another. These are connected editing behaviors, not just library metadata.
- Prototype interactions are described through trigger, action, destination, and animation details. Connections may start from an individual object or a frame.
- The properties panel supports direct edits to a selected layer and changes when selection changes. Its layer name and kind provide context for the values below.

Sources:

- [Design, prototype, and explore layer properties in the right sidebar](https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar)
- [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions)
- [Guide to Auto Layout](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma)
- [Variables, collections, and modes](https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes)
- [Connect your prototype](https://help.figma.com/hc/en-us/articles/360040315773-Connect-your-prototype)
- [Guide to Dev Mode](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma)

## SketchDraw inspector contract

The SketchDraw inspector remains local-first and preserves its Design, Prototype, and Inspect tabs. Its implementation is rebuilt as a contextual panel with these rules:

1. Keep the inspector compact and start with the Design, Prototype, and Inspect tabs; do not reserve a separate title row for the selected layer. Property controls remain contextual to the canvas and layer-tree selection.
2. Put transform, size, rotation, and parent constraints first. Keep world-space X/Y values consistent with the shared hierarchy engine.
3. Show only controls that apply to the selected kind. Frame, text, image, component, and layout controls are contextual; common appearance controls remain available where meaningful.
4. Keep each property section expanded on first use. A user can collapse or reopen sections; one section's state does not toggle another section.
5. Keep Design, Prototype, and Inspect workflows separate. Prototype controls edit interactions and flows. Inspect exposes measurements, computed values, and export actions.
6. Expose document styles and tokens in the Design panel without mixing their editing controls into a selected object's transform controls. Keep the local styles and token library in a distinct Design section, separate from layer properties. Keep responsive breakpoint management beside Frames in the navigation panel. Do not reintroduce the removed Page or Quality checks sections.
7. Every control must update the document model through its existing update/history path and reflect the effective value in the canvas or generated output. Token modes, aliases, presets, and custom values must use the same resolution functions as rendering and export.
8. Keep the panel scrollable at narrow window sizes. Avoid nested cards and excess padding; use compact, aligned fields and explicit labels.

## Rebuild notes

The SolidJS inspector shell, tab semantics, and panel styles are owned by `src/features/ui-design/inspector/`. The workspace supplies three named content slots and keeps document edits on the existing session/history path. Tab panels stay mounted while hidden so local subsection state survives tab changes. Property editors continue to use the existing hierarchy, rendering, and update callbacks; the inspector does not create a second document state. The panel tabs are the first inspector row; there is no extra "Properties / No selection" header.

The old right-panel wrapper and tab styling are replaced by the new inspector shell. Existing property field styles remain reusable, with compact inspector-specific overrides. Canvas geometry, node rendering, persistence, and the left navigation panel remain outside this refactor.
