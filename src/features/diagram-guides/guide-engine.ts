import type { Element, GroupElement, Point, ShapeElement } from "../../model";
import { anchorPoint, resolveBindings } from "../../operations";
import { buildLibraryComponent, LIBRARY_COMPONENTS } from "../components/library-components";
import { DIAGRAM_GUIDES, type DiagramGuide, type DiagramGuideId, type GuideEdge, type GuideNode } from "./guide-diagrams";

const GUIDE_FRAME_PADDING = 28;
const GUIDE_NODE_STYLE = { stroke: "#53677b", fill: "#f5f8fc", text: "#263747", edge: "#72859a", edgeText: "#53677b" } as const;

export type GuideEdgeLayout = {
  definition: GuideEdge;
  index: number;
  start: Point;
  end: Point;
  label?: Point;
};

export type GuideLayout = {
  guide: DiagramGuide;
  frame: { width: number; height: number };
  nodes: GuideNode[];
  nodeElements: (GroupElement | ShapeElement)[];
  backgroundNodes: GuideNode[];
  foregroundNodes: GuideNode[];
  edges: GuideEdgeLayout[];
};

function guideById(id: DiagramGuideId): DiagramGuide {
  const guide = DIAGRAM_GUIDES.find(item => item.id === id);
  if (!guide) throw new Error(`Diagram guide "${id}" is unavailable.`);
  return guide;
}

function validateGuide(guide: DiagramGuide): void {
  const fail = (message: string): never => { throw new Error(`Invalid diagram guide "${guide.id}": ${message}`); };
  if (!Number.isFinite(guide.width) || guide.width <= 0 || !Number.isFinite(guide.height) || guide.height <= 0) fail("the drawing frame must have positive dimensions.");
  if (!guide.nodes.length) fail("at least one shape is required.");

  guide.nodes.forEach((node, index) => {
    if (!node.title.trim()) fail(`shape ${index + 1} has no label.`);
    if (![node.x, node.y, node.w, node.h].every(Number.isFinite) || node.w <= 0 || node.h <= 0) fail(`shape ${index + 1} has invalid geometry.`);
    if (node.component && !LIBRARY_COMPONENTS.some(item => item.kind === node.component)) fail(`shape ${index + 1} uses an unknown component "${node.component}".`);
    if (node.flowchartShape && node.shape !== "flowchart") fail(`shape ${index + 1} has a flowchart symbol without a flowchart shape.`);
    if (node.fillOpacity !== undefined && (!Number.isFinite(node.fillOpacity) || node.fillOpacity < 0 || node.fillOpacity > 1)) fail(`shape ${index + 1} has invalid fill opacity.`);
  });

  guide.edges.forEach((edge, index) => {
    if (!Number.isInteger(edge.from) || !Number.isInteger(edge.to) || !guide.nodes[edge.from] || !guide.nodes[edge.to]) fail(`connection ${index + 1} points to a missing shape.`);
    if (edge.from === edge.to) fail(`connection ${index + 1} loops back to the same shape.`);
    if (edge.atY !== undefined && !Number.isFinite(edge.atY)) fail(`connection ${index + 1} has an invalid height.`);
    if (edge.atY !== undefined) {
      const from = guide.nodes[edge.from];
      const to = guide.nodes[edge.to];
      if (edge.atY < Math.max(from.y, to.y) || edge.atY > Math.min(from.y + from.h, to.y + to.h)) fail(`connection ${index + 1} sits outside its participant shapes.`);
    }
    if (edge.labelOffset !== undefined && (!Number.isFinite(edge.labelOffset) || edge.labelOffset < 0)) fail(`connection ${index + 1} has an invalid label offset.`);
  });
}

function center(node: GuideNode): Point {
  return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
}

function boundaryPoint(node: GuideNode, target: GuideNode): Point {
  const origin = center(node);
  const targetCenter = center(target);
  let dx = targetCenter.x - origin.x;
  let dy = targetCenter.y - origin.y;
  if (!dx && !dy) { dx = 1; }

  const halfWidth = node.w / 2;
  const halfHeight = node.h / 2;
  let distance: number;

  if (node.shape === "circle") {
    const ellipseDistance = Math.sqrt((dx / halfWidth) ** 2 + (dy / halfHeight) ** 2) || 1;
    distance = 1 / ellipseDistance;
  } else if (node.shape === "diamond" || node.flowchartShape === "decision") {
    distance = 1 / (Math.abs(dx) / halfWidth + Math.abs(dy) / halfHeight || 1);
  } else {
    distance = Math.min(halfWidth / Math.abs(dx || Number.EPSILON), halfHeight / Math.abs(dy || Number.EPSILON));
  }

  return { x: origin.x + dx * distance, y: origin.y + dy * distance };
}

function roughEdgePoints(edge: GuideEdge, nodes: GuideNode[]): { start: Point; end: Point } {
  const from = nodes[edge.from];
  const to = nodes[edge.to];
  if (edge.atY !== undefined) {
    // Sequence messages connect to the participant lifelines at the authored message row.
    return { start: { x: center(from).x, y: edge.atY }, end: { x: center(to).x, y: edge.atY } };
  }
  return { start: boundaryPoint(from, to), end: boundaryPoint(to, from) };
}

function labelPosition(edge: GuideEdge, start: Point, end: Point): Point | undefined {
  if (!edge.label) return undefined;
  const offset = edge.labelOffset ?? 12;
  const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
  return horizontal
    ? { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - offset }
    : { x: (start.x + end.x) / 2 + offset, y: (start.y + end.y) / 2 };
}

/** Calculate the single, validated geometry plan consumed by both previews and insertion. */
export function layoutDiagramGuide(id: DiagramGuideId): GuideLayout {
  const guide = guideById(id);
  validateGuide(guide);

  const minX = Math.min(...guide.nodes.map(node => node.x));
  const minY = Math.min(...guide.nodes.map(node => node.y));
  const shiftX = Math.max(0, GUIDE_FRAME_PADDING - minX);
  const shiftY = Math.max(0, GUIDE_FRAME_PADDING - minY);
  const nodes = guide.nodes.map(node => ({ ...node, x: node.x + shiftX, y: node.y + shiftY }));
  const nodeElements = nodes.map(makeGuideNode);
  const edges = guide.edges.map((definition, index) => {
    const adjusted = definition.atY === undefined ? definition : { ...definition, atY: definition.atY + shiftY };
    const rough = roughEdgePoints(adjusted, nodes);
    const fromElement = nodeElements[definition.from];
    const toElement = nodeElements[definition.to];
    const start = definition.atY === undefined
      ? anchorPoint(fromElement, normalizedAnchor(nodes[definition.from], rough.start))
      : rough.start;
    const end = definition.atY === undefined
      ? anchorPoint(toElement, normalizedAnchor(nodes[definition.to], rough.end))
      : rough.end;
    return { definition, index, start, end, label: labelPosition(definition, start, end) };
  });
  const farRight = Math.max(...nodes.map(node => node.x + node.w));
  const farBottom = Math.max(...nodes.map(node => node.y + node.h));
  const width = Math.max(guide.width + shiftX, farRight + GUIDE_FRAME_PADDING);
  const height = Math.max(guide.height + shiftY, farBottom + GUIDE_FRAME_PADDING);

  return {
    guide,
    frame: { width, height },
    nodes,
    nodeElements,
    backgroundNodes: nodes.filter(node => node.background),
    foregroundNodes: nodes.filter(node => !node.background),
    edges,
  };
}

function makeGuideNode(node: GuideNode): GroupElement | ShapeElement {
  if (node.component) {
    const group = buildLibraryComponent(node.component, node.x, node.y);
    group.componentBounds = { x: node.x, y: node.y, w: node.w, h: node.h };
    const currentStyle = group.libraryComponent?.styleOverrides ?? {};
    group.libraryComponent = {
      ...group.libraryComponent!,
      label: node.title,
      ...(node.fill || node.fillOpacity !== undefined ? {
        styleOverrides: {
          ...currentStyle,
          ...(node.fill ? { fillColor: node.fill } : {}),
          ...(node.fillOpacity !== undefined ? { fillOpacity: node.fillOpacity } : {}),
        },
      } : {}),
    };
    return group;
  }

  return {
    type: node.shape ?? "rectangle",
    id: crypto.randomUUID(),
    x: node.x,
    y: node.y,
    w: node.w,
    h: node.h,
    color: GUIDE_NODE_STYLE.stroke,
    thickness: 2,
    fillColor: node.fill ?? GUIDE_NODE_STYLE.fill,
    ...(node.fillOpacity === undefined ? {} : { fillOpacity: node.fillOpacity }),
    ...(node.flowchartShape ? { flowchartShape: node.flowchartShape } : {}),
    label: {
      text: node.title,
      color: GUIDE_NODE_STYLE.text,
      fontSize: 15,
      fontFamily: "sans",
      bold: true,
      italic: false,
      underline: false,
      textAlign: "center",
      listType: "none",
      verticalAlign: "middle",
    },
  } as ShapeElement;
}

function normalizedAnchor(node: GuideNode, point: Point): Point {
  return {
    x: Math.max(0, Math.min(1, (point.x - node.x) / node.w)),
    y: Math.max(0, Math.min(1, (point.y - node.y) / node.h)),
  };
}

function makeGuideEdge(layout: GuideEdgeLayout, nodes: GuideNode[], elements: (GroupElement | ShapeElement)[]): ShapeElement {
  const { definition: edge, start, end, label } = layout;
  const from = nodes[edge.from];
  const to = nodes[edge.to];
  const fromElement = elements[edge.from];
  const toElement = elements[edge.to];
  const canBind = edge.atY === undefined && !!fromElement.id && !!toElement.id;
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  return {
    type: edge.arrow === false ? "line" : "arrow",
    id: crypto.randomUUID(),
    x: start.x,
    y: start.y,
    w: end.x - start.x,
    h: end.y - start.y,
    color: GUIDE_NODE_STYLE.edge,
    thickness: 2,
    lineStyle: edge.dashed ? "dashed" : "solid",
    ...(edge.arrow === false
      ? { lineRoute: "straight" as const }
      : { arrowRoute: "straight" as const, startHead: "none" as const, endHead: "open" as const }),
    ...(canBind ? {
      startBinding: { elementId: fromElement.id!, anchor: normalizedAnchor(from, start) },
      endBinding: { elementId: toElement.id!, anchor: normalizedAnchor(to, end) },
    } : {}),
    ...(edge.label ? {
      label: {
        text: edge.label,
        color: GUIDE_NODE_STYLE.edgeText,
        fontSize: 12,
        fontFamily: "sans" as const,
        bold: true,
        italic: false,
        underline: false,
        textAlign: "center" as const,
        listType: "none" as const,
        verticalAlign: "top" as const,
        offsetX: (label?.x ?? midpoint.x) - midpoint.x,
        offsetY: (label?.y ?? midpoint.y) - midpoint.y,
      },
    } : {}),
  };
}

/** Build editable canvas elements from the same geometry plan shown in the gallery. */
export function buildGuideDiagram(id: DiagramGuideId): Element[] {
  const layout = layoutDiagramGuide(id);
  const nodeElements = layout.nodeElements;
  const edgeElements = layout.edges.map(edge => makeGuideEdge(edge, layout.nodes, nodeElements));
  const orderedNodes = [
    ...layout.nodes.flatMap((node, index) => node.background ? [nodeElements[index]] : []),
    ...layout.nodes.flatMap((node, index) => node.background ? [] : [nodeElements[index]]),
  ];
  const backgroundCount = layout.backgroundNodes.length;
  const backgrounds = orderedNodes.slice(0, backgroundCount);
  const foreground = orderedNodes.slice(backgroundCount);
  return resolveBindings([...backgrounds, ...edgeElements, ...foreground]);
}
