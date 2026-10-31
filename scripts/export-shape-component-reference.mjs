import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const outputPath = resolve(root, "docs/shape-component-geometry.json");
const server = await createServer({
  configFile: false,
  root,
  appType: "custom",
  server: { middlewareMode: true, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});

const elementTypes = new Set(["freehand", "rectangle", "circle", "diamond", "triangle", "flowchart", "line", "arrow", "svgPath", "text", "image", "schemaTable", "group"]);

function stableGeometry(value) {
  const ids = new Map(); let nextId = 1;
  const collect = item => {
    if (Array.isArray(item)) { item.forEach(collect); return; }
    if (!item || typeof item !== "object") return;
    if (elementTypes.has(item.type) && typeof item.id === "string") ids.set(item.id, `${item.type}-${nextId++}`);
    Object.values(item).forEach(collect);
  };
  collect(value);
  const normalize = item => {
    if (Array.isArray(item)) return item.map(normalize);
    if (!item || typeof item !== "object") return item;
    const isElement = elementTypes.has(item.type);
    return Object.fromEntries(Object.entries(item)
      .filter(([, entry]) => entry !== undefined && typeof entry !== "function")
      .map(([key, entry]) => [key, key === "id" && isElement ? ids.get(entry) ?? entry : key === "elementId" && typeof entry === "string" ? ids.get(entry) ?? entry : normalize(entry)]));
  };
  return normalize(value);
}

try {
  const [catalog, geometry, library, modelRenderer, gui] = await Promise.all([
    server.ssrLoadModule("/src/features/shapes/shape-catalog.ts"),
    server.ssrLoadModule("/src/features/shapes/geometry.ts"),
    server.ssrLoadModule("/src/features/components/library-components.ts"),
    server.ssrLoadModule("/src/features/components/model-component-renderer.ts"),
    server.ssrLoadModule("/src/features/components/gui-components.ts"),
  ]);

  const shapeElement = (type, extra = {}) => ({
    type, x: 0, y: 0, w: 100, h: 100, color: "#34495e", thickness: 2,
    ...extra,
  });
  const shapeDefinitions = [
    ...catalog.BASIC_SHAPES.map(item => ({ ...item, category: "basic", type: item.value })),
    ...catalog.FLOWCHART_SHAPES.map(item => ({ ...item, category: "flowchart", type: "flowchart" })),
    ...catalog.GENERAL_SHAPES.map(item => ({ ...item, category: "general", type: "flowchart" })),
  ].map(item => {
    const element = shapeElement(item.type, item.type === "flowchart" ? { flowchartShape: item.value } : {});
    return {
      kind: item.category === "flowchart" ? item.value : item.type,
      value: item.value,
      label: item.label,
      category: item.category,
      coordinateBase: { x: 0, y: 0, width: 100, height: 100 },
      connectorAnchorTargets: [
        { id: "north", name: "North", x: 0.5, y: 0 },
        { id: "east", name: "East", x: 1, y: 0.5 },
        { id: "south", name: "South", x: 0.5, y: 1 },
        { id: "west", name: "West", x: 0, y: 0.5 },
      ],
      outlinePath: geometry.shapePathData(element) ?? null,
      detailPath: geometry.shapeDetailPathData(element) || null,
      defaultAdjustments: item.category === "general" && ["right-arrow", "left-arrow", "double-arrow", "up-arrow", "down-arrow"].includes(item.value)
        ? { shaft: 0.4, head: item.value === "double-arrow" ? 0.35 : 0.4 }
        : item.value === "star" ? { inset: 0.23 } : undefined,
    };
  });

  shapeDefinitions.push({
    kind: "line", value: "line", category: "connector",
    coordinateBase: { origin: "element top-left", width: "element.w", height: "element.h", endpoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
    defaults: { lineRoute: "straight", lineStyle: "solid", startHead: "none", endHead: "none", thickness: 2 },
  }, {
    kind: "arrow", value: "arrow", category: "connector",
    coordinateBase: { origin: "element top-left", width: "element.w", height: "element.h", endpoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
    defaults: { arrowRoute: "straight", lineStyle: "solid", startHead: "none", endHead: "solid", thickness: 2 },
  }, {
    kind: "svgPath", value: "svgPath", category: "path",
    coordinateBase: { origin: "path-local", pathWidth: 100, pathHeight: 100, normalizedAnchorRange: { x: [0, 1], y: [0, 1] } },
    examplePath: "M 8 50 C 28 8 72 92 92 50",
    defaults: { fillRule: "nonzero", svgStroke: true, svgNonScalingStroke: false, fillColor: null },
  });

  const standardPorts = [
    { id: "north", name: "North", anchor: { x: 0.5, y: 0 } },
    { id: "east", name: "East", anchor: { x: 1, y: 0.5 } },
    { id: "south", name: "South", anchor: { x: 0.5, y: 1 } },
    { id: "west", name: "West", anchor: { x: 0, y: 0.5 } },
  ];
  const componentDefinitions = library.LIBRARY_COMPONENTS.map(definition => {
    const component = library.buildLibraryComponent(definition.kind, 0, 0);
    const legacy = library.buildLibraryComponent(definition.kind, 0, 0, { forceLegacyGeometry: true });
    const renderedSvg = gui.isGuiComponentKind(definition.kind)
      ? gui.guiComponentSvg(component)
      : modelRenderer.modelComponentSvg(component);
    const relationship = library.buildLibraryRelationship(definition.kind, 0, 0);
    return {
      ...definition,
      coordinateBase: {
        origin: "component top-left",
        width: definition.width,
        height: definition.height,
        childElements: "absolute canvas units from component top-left",
        portAnchors: "normalized component coordinates in the 0..1 range",
      },
      defaultPorts: standardPorts,
      defaultInstance: stableGeometry(component),
      legacyGeometry: stableGeometry(legacy.elements ?? []),
      relationshipElement: relationship ? stableGeometry(relationship) : undefined,
      renderedSvg: renderedSvg ?? undefined,
    };
  });

  const reference = {
    format: "SketchDrawShapeComponentReference",
    version: 1,
    units: "canvas document units",
    generatedFrom: [
      "src/features/shapes/shape-catalog.ts",
      "src/features/shapes/geometry.ts",
      "src/features/components/library-components.ts",
      "src/features/components/model-component-renderer.ts",
      "src/features/components/gui-components.ts",
    ],
    coordinateConventions: {
      shapePaths: "SVG path data in the shape's local bounding box; this file uses a 100 by 100 reference box unless a component specifies its own dimensions.",
      componentGeometry: "Component builder coordinates are local to an insertion origin at x=0,y=0. Component bounds give the reference width and height.",
      connectorAnchors: "Normalized x/y fractions of a component's bounds. Standard ports are included for every catalog component; explicit per-instance ports are stored in libraryComponent.connectionPoints or group.connectionPoints.",
      pathElements: "SVG path nodes use pathWidth/pathHeight as their local coordinate base. Element x/y/w/h place and scale that path on the canvas.",
    },
    primitiveShapes: shapeDefinitions,
    modelingComponents: componentDefinitions,
    notes: [
      "The default instance metadata and rendered SVG show the modern component renderer; legacyGeometry lists editable child primitives when that component has a legacy primitive construction path.",
      "Blank editable labels and field values are intentional defaults. The associated componentFields, guiProperties, formOptions, and chartData metadata define the component's editable content.",
      "Connection points on irregular primitive outlines are projected onto their actual path at runtime; the path and normalized coordinate base are the source for reproducing that projection.",
    ],
  };
  await writeFile(outputPath, `${JSON.stringify(reference, null, 2)}\n`, "utf8");
  process.stdout.write(`Wrote ${componentDefinitions.length} modeling components and ${shapeDefinitions.length} primitive/path definitions to ${outputPath}\n`);
} finally {
  await server.close();
}
