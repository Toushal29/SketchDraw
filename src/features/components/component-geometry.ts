import type { GroupElement, Point } from "../../model";
import { cloudNeutralComponent } from "../diagrams/cloud-providers";
import { proposalComponentForKind } from "./proposal-components";

export type ComponentPortStrategy =
  | { type: "outline-projected" }
  | { type: "per-row"; edge: "left" | "right"; inset: number }
  | { type: "along-the-line"; axis: "horizontal" | "vertical"; inset: number }
  | { type: "per-lane"; axis: "horizontal" | "vertical" }
  | { type: "none" };

export type ComponentGeometryContract = {
  /** SVG path in a normalized 100 by 100 local coordinate box. */
  outlinePath: string;
  labelBox: { x: number; y: number; w: number; h: number };
  resize: {
    aspectLock: boolean;
    minSize: { w: number; h: number };
    nineSlice: { fixed: string[]; stretch: string[] };
  };
  portStrategy: ComponentPortStrategy;
  lod: { detailsBelow: number; labelsBelow: number; outlineBelow: number };
};

export type ComponentGeometryDefinition = ComponentGeometryContract & {
  kind: string;
  referenceSize: { w: number; h: number };
};

export const COMPONENT_SIZE_GRID = 25;

const RECT = "M 0 0 H 100 V 100 H 0 Z";
const DIAMOND = "M 50 0 L 100 50 L 50 100 L 0 50 Z";
const ELLIPSE = "M 50 1 C 77.062 1 99 22.938 99 50 C 99 77.062 77.062 99 50 99 C 22.938 99 1 77.062 1 50 C 1 22.938 22.938 1 50 1 Z";
const AVATAR = "M 50 7 C 73.748 7 93 26.252 93 50 C 93 73.748 73.748 93 50 93 C 26.252 93 7 73.748 7 50 C 7 26.252 26.252 7 50 7 Z";
const pathPoint = (x: number, y: number, width: number, height: number) => `${Number((x / Math.max(1, width) * 100).toFixed(4))} ${Number((y / Math.max(1, height) * 100).toFixed(4))}`;

const ROW_COMPONENTS = new Set(["uml-class", "uml-object", "uml-interface", "uml-enumeration", "er-table", "db-view", "db-index", "db-procedure", "form-checkbox", "form-radio", "gui-list", "gui-table"]);
const LINE_COMPONENTS = new Set(["uml-inheritance", "uml-realization", "uml-aggregation", "uml-composition", "uml-association", "uml-dependency", "uml-include", "uml-extend", "uml-fork", "uml-join", "sequence-sync", "sequence-async", "er-one-one", "er-one-many", "er-many-one", "er-many-many", "data-flow"]);
const ER_RELATIONSHIP_SHAPES = new Set(["er-relationship", "er-identifying-relationship"]);

export function componentPortStrategy(kind: string): ComponentPortStrategy {
  const proposal = proposalComponentForKind(kind);
  if (proposal?.archetype === "connector") return { type: "along-the-line", axis: "horizontal", inset: 0.04 };
  if (proposal?.archetype === "table") return { type: "per-row", edge: "right", inset: 0.04 };
  if (LINE_COMPONENTS.has(kind)) return { type: "along-the-line", axis: "horizontal", inset: 0.04 };
  if (kind === "uml-lifeline" || kind === "uml-activation") return { type: "along-the-line", axis: "vertical", inset: 0.04 };
  if (kind === "gui-divider") return { type: "none" };
  if (kind === "diagram-swimlane" || kind === "bpmn-pool") return { type: "per-lane", axis: "horizontal" };
  if (ROW_COMPONENTS.has(kind)) return { type: "per-row", edge: "right", inset: 0.04 };
  return { type: "outline-projected" };
}

export function componentOutlinePath(kind: string, width = 100, height = 100): string {
  const proposal = proposalComponentForKind(kind);
  if (proposal) {
    if (proposal.archetype === "decision") return DIAMOND;
    if (proposal.archetype === "event") return ELLIPSE;
    if (proposal.archetype === "connector") return "M 0 50 H 100";
    if (proposal.archetype === "database") return "M 8 12 C 8 1 92 1 92 12 V 88 C 92 99 8 99 8 88 Z M 8 12 C 8 23 92 23 92 12";
    if (proposal.archetype === "document") return "M 4 2 H 76 L 96 22 V 98 H 4 Z M 76 2 V 22 H 96";
    if (proposal.archetype === "screen") return "M 2 8 Q 2 2 8 2 H 92 Q 98 2 98 8 V 92 Q 98 98 92 98 H 8 Q 2 98 2 92 Z M 2 18 H 98";
    if (proposal.archetype === "sticky") return "M 3 3 H 97 V 82 L 82 97 H 3 Z M 82 97 V 82 H 97";
    return RECT;
  }
  if (kind === "bpmn-gateway" || kind === "bpmn-parallel-gateway" || kind === "bpmn-inclusive-gateway" || kind === "bpmn-event-gateway") {
    const side = Math.max(0, Math.min(width, height - 12, 58)); const cx = width / 2; const cy = side / 2;
    return `M ${pathPoint(cx, 0, width, height)} L ${pathPoint(cx + side / 2, cy, width, height)} L ${pathPoint(cx, side, width, height)} L ${pathPoint(cx - side / 2, cy, width, height)} Z`;
  }
  if (kind.startsWith("bpmn-") && /(?:start|event|end|boundary)/.test(kind)) {
    const diameter = Math.max(0, height >= 72 ? Math.min(58, width, height - 38) : Math.min(width, height - 14)); const cx = width / 2; const cy = diameter / 2 + 1; const radius = diameter * .43;
    const left = pathPoint(cx - radius, cy, width, height); const right = pathPoint(cx + radius, cy, width, height); const top = pathPoint(cx, cy - radius, width, height); const bottom = pathPoint(cx, cy + radius, width, height);
    const controlX = radius * .55228475;
    return `M ${left} C ${pathPoint(cx - radius, cy - controlX, width, height)} ${pathPoint(cx - controlX, cy - radius, width, height)} ${top} C ${pathPoint(cx + controlX, cy - radius, width, height)} ${pathPoint(cx + radius, cy - controlX, width, height)} ${right} C ${pathPoint(cx + radius, cy + controlX, width, height)} ${pathPoint(cx + controlX, cy + radius, width, height)} ${bottom} C ${pathPoint(cx - controlX, cy + radius, width, height)} ${pathPoint(cx - radius, cy + controlX, width, height)} ${left} Z`;
  }
  if (kind === "uml-actor") {
    const cx = width / 2; const head = Math.min(12, height * .11); const figureWidth = Math.min(58, width * .72); const centerY = head + 3;
    const l = (x: number, y: number) => pathPoint(x, y, width, height);
    return `M ${l(cx, centerY - head)} C ${l(cx + head * .73, centerY - head)} ${l(cx + head, centerY - head * .27)} ${l(cx + head, centerY)} C ${l(cx + head, centerY + head * .73)} ${l(cx + head * .27, centerY + head)} ${l(cx, centerY + head)} C ${l(cx - head * .73, centerY + head)} ${l(cx - head, centerY + head * .27)} ${l(cx - head, centerY)} C ${l(cx - head, centerY - head * .73)} ${l(cx - head * .27, centerY - head)} ${l(cx, centerY - head)} M ${l(cx, head * 2 + 3)} V ${l(cx, height * .58)} M ${l(cx - figureWidth * .38, height * .4)} H ${l(cx + figureWidth * .38, height * .4)} M ${l(cx, height * .58)} L ${l(cx - figureWidth * .3, height * .69)} M ${l(cx, height * .58)} L ${l(cx + figureWidth * .3, height * .69)}`;
  }
  if (kind === "uml-activity-decision") return DIAMOND;
  if (kind === "gui-avatar") return AVATAR;
  if (["uml-initial-state", "uml-final-state", "uml-activity-initial", "uml-activity-final"].includes(kind)) return ELLIPSE;
  if (kind === "c4-person") {
    const cx = width / 2; const l = (x: number, y: number) => pathPoint(x, y, width, height);
    return `M ${l(cx, 14)} C ${l(cx + 5.5, 14)} ${l(cx + 10, 18.5)} ${l(cx + 10, 24)} C ${l(cx + 10, 29.5)} ${l(cx + 5.5, 34)} ${l(cx, 34)} C ${l(cx - 5.5, 34)} ${l(cx - 10, 29.5)} ${l(cx - 10, 24)} C ${l(cx - 10, 18.5)} ${l(cx - 5.5, 14)} ${l(cx, 14)} M ${l(cx, 35)} L ${l(cx, 63)} M ${l(cx - 20, 42)} L ${l(cx + 20, 42)} M ${l(cx, 63)} L ${l(cx - 15, 82)} M ${l(cx, 63)} L ${l(cx + 15, 82)}`;
  }
  if (kind === "bpmn-text-annotation") return "M 14 0 H 4 V 100 H 14";
  if (kind === "uml-activity-action") {
    const radius = Math.min(15, width / 2, height / 2); const rx = Number((radius / Math.max(1, width) * 100).toFixed(4)); const ry = Number((radius / Math.max(1, height) * 100).toFixed(4)); const p = (x: number, y: number) => pathPoint(x, y, width, height);
    return `M ${p(radius, 0)} L ${p(width - radius, 0)} A ${rx} ${ry} 0 0 1 ${p(width, radius)} L ${p(width, height - radius)} A ${rx} ${ry} 0 0 1 ${p(width - radius, height)} L ${p(radius, height)} A ${rx} ${ry} 0 0 1 ${p(0, height - radius)} L ${p(0, radius)} A ${rx} ${ry} 0 0 1 ${p(radius, 0)} Z`;
  }
  if (kind === "uml-package") {
    const tabW = Math.min(width * .42, 86); const tabH = Math.min(22, height * .22); const p = (x: number, y: number) => pathPoint(x, y, width, height);
    return `M ${p(0, tabH)} L ${p(0, 2)} L ${p(tabW, 2)} L ${p(tabW + 12, tabH)} L ${p(width - 2, tabH)} L ${p(width - 2, height - 2)} L ${p(2, height - 2)} Z`;
  }
  if (kind === "uml-artifact") {
    const fold = Math.min(20, width * .18); const p = (x: number, y: number) => pathPoint(x, y, width, height);
    return `M ${p(0, 0)} L ${p(width - fold, 0)} L ${p(width, fold)} L ${p(width, height)} L ${p(0, height)} Z M ${p(width - fold, 0)} L ${p(width - fold, fold)} L ${p(width, fold)}`;
  }
  if (kind === "uml-node") {
    const dx = Math.min(18, width * .12); const dy = Math.min(15, height * .12); const p = (x: number, y: number) => pathPoint(x, y, width, height);
    return `M ${p(dx, dy)} L ${p(dx + 10, 0)} L ${p(width, 0)} L ${p(width, height)} L ${p(dx, height)} Z M ${p(width - dx, dy)} L ${p(width, 0)}`;
  }
  if (kind === "bpmn-data") return "M 1 1 H 99 V 88 Q 75 100 50 88 Q 25 76 1 88 Z";
  if (kind === "bpmn-data-store" || kind === "software-database" || kind === "cloud-database") return "M 7 12 C 7 1 93 1 93 12 V 88 C 93 99 7 99 7 88 Z M 7 12 C 7 23 93 23 93 12 M 7 50 C 7 61 93 61 93 50";
  if (kind === "uml-use-case" || kind === "er-attribute" || kind === "er-key-attribute" || kind === "er-partial-key-attribute" || kind === "er-multivalued-attribute" || kind === "er-derived-attribute") return ELLIPSE;
  if (kind === "er-composite-attribute") return "M 50 6 C 67 6 82 13 82 22 C 82 31 67 38 50 38 C 33 38 18 31 18 22 C 18 13 33 6 50 6 Z M 50 38 L 25 61 M 50 38 L 75 61 M 25 61 C 45 61 48 68 48 77 C 48 86 45 93 25 93 C 5 93 2 86 2 77 C 2 68 5 61 25 61 Z M 75 61 C 95 61 98 68 98 77 C 98 86 95 93 75 93 C 55 93 52 86 52 77 C 52 68 55 61 75 61 Z";
  if (ER_RELATIONSHIP_SHAPES.has(kind)) return DIAMOND;
  if (kind === "cloud-boundary" || kind === "network-internet") return "M 15 80 C 4 80 4 65 10 56 C 13 45 22 42 25 44 C 25 22 40 12 53 23 C 66 5 85 12 87 36 C 97 38 99 49 96 59 C 99 72 90 81 81 80 Z";
  return RECT;
}

export function snapComponentDimension(value: number): number {
  return Math.max(COMPONENT_SIZE_GRID, Math.round(value / COMPONENT_SIZE_GRID) * COMPONENT_SIZE_GRID);
}

export function componentMinimumSize(kind: string): { w: number; h: number } {
  const proposal = proposalComponentForKind(kind);
  if (proposal) return { w: proposal.archetype === "connector" ? 80 : proposal.archetype === "event" || proposal.archetype === "decision" ? 65 : 100, h: proposal.archetype === "connector" ? 22 : proposal.archetype === "event" || proposal.archetype === "decision" ? 56 : 60 };
  if (cloudNeutralComponent(kind)) return { w: 90, h: 48 };
  if (kind.startsWith("viz-")) return kind === "viz-kpi" ? { w: 125, h: 75 } : { w: 150, h: 100 };
  if (["bpmn-gateway", "bpmn-parallel-gateway", "bpmn-inclusive-gateway", "bpmn-event-gateway"].includes(kind)) return { w: 75, h: 75 };
  if (kind === "uml-actor") return { w: 75, h: 75 };
  if (kind === "c4-person") return { w: 75, h: 75 };
  if (kind.startsWith("form-")) return kind === "form-button" ? { w: 50, h: 25 }
    : kind === "form-toggle" ? { w: 75, h: 25 }
      : kind === "form-checkbox" || kind === "form-radio" ? { w: 75, h: 70 }
        : kind === "form-slider" ? { w: 80, h: 35 }
          : kind === "form-textarea" ? { w: 75, h: 45 }
            : { w: 75, h: 25 };
  const minimums: Record<string, { w: number; h: number }> = {
    "uml-class": { w: 180, h: 110 }, "uml-object": { w: 150, h: 96 }, "uml-activity-action": { w: 140, h: 72 },
    "uml-activity-decision": { w: 76, h: 76 }, "uml-activity-initial": { w: 38, h: 38 }, "uml-activity-final": { w: 46, h: 46 },
    "db-view": { w: 150, h: 96 }, "db-index": { w: 160, h: 92 }, "db-procedure": { w: 164, h: 104 },
    "c4-container-instance": { w: 160, h: 96 }, "c4-component-instance": { w: 150, h: 92 }, "bpmn-group": { w: 150, h: 90 },
    "gui-card": { w: 120, h: 25 }, "gui-app-bar": { w: 60, h: 25 }, "gui-navigation": { w: 50, h: 52 },
    "gui-tabs": { w: 60, h: 25 }, "gui-image": { w: 40, h: 25 }, "gui-alert": { w: 90, h: 36 }, "gui-modal": { w: 150, h: 90 },
    "gui-breadcrumbs": { w: 80, h: 25 }, "gui-badge": { w: 38, h: 20 }, "gui-progress": { w: 80, h: 30 },
    "gui-list": { w: 80, h: 72 }, "gui-table": { w: 90, h: 40 }, "gui-accordion": { w: 80, h: 72 }, "gui-menu": { w: 72, h: 72 },
    "gui-toast": { w: 150, h: 50 }, "gui-pagination": { w: 148, h: 30 }, "gui-divider": { w: 30, h: 8 }, "gui-footer": { w: 150, h: 30 },
  };
  if (minimums[kind]) return minimums[kind];
  return { w: 25, h: 25 };
}

export function snapComponentSize(kind: string, width: number, height: number) {
  const minimum = componentMinimumSize(kind);
  return { w: Math.max(minimum.w, snapComponentDimension(width)), h: Math.max(minimum.h, snapComponentDimension(height)) };
}

export function componentGeometry(kind: string, width: number, height: number): ComponentGeometryDefinition {
  const proposal = proposalComponentForKind(kind);
  const aspectLock = kind === "bpmn-start" || kind === "bpmn-gateway" || kind === "uml-initial-state" || kind === "uml-final-state" || kind === "uml-actor" || kind === "c4-person" || kind === "gui-avatar" || proposal?.archetype === "event" || proposal?.archetype === "decision";
  const minSize = componentMinimumSize(kind);
  const fixed = kind.startsWith("aws-") || kind.startsWith("azure-") || kind.startsWith("gcp-") ? ["icon"] : kind.startsWith("uml-") ? ["header"] : [];
  const gateway = kind === "bpmn-gateway" || kind === "bpmn-parallel-gateway" || kind === "bpmn-inclusive-gateway" || kind === "bpmn-event-gateway";
  const event = kind.startsWith("bpmn-") && /(?:start|event|end|boundary)/.test(kind);
  const labelBox = proposal?.archetype === "event" || proposal?.archetype === "decision" ? { x: 0.14, y: 0.32, w: 0.72, h: 0.5 }
    : kind === "uml-actor" ? { x: 0.08, y: 0.76, w: 0.84, h: 0.22 }
    : kind === "c4-person" ? { x: 0.08, y: 0.7, w: 0.84, h: 0.28 }
      : kind.startsWith("aws-") || kind.startsWith("azure-") || kind.startsWith("gcp-") ? { x: 0.42, y: 0.25, w: 0.53, h: 0.7 }
        : kind === "form-checkbox" || kind === "form-radio" ? { x: 0.03, y: 0.03, w: 0.94, h: 0.2 }
          : { x: 0.08, y: gateway ? 0.68 : event ? 0.62 : 0.08, w: 0.84, h: gateway ? 0.3 : event ? 0.34 : 0.84 };
  return {
    kind,
    referenceSize: { w: width, h: height },
    outlinePath: componentOutlinePath(kind, width, height),
    labelBox,
    resize: { aspectLock, minSize, nineSlice: { fixed, stretch: ["body", "labelBox"] } },
    portStrategy: componentPortStrategy(kind),
    lod: { detailsBelow: 0.55, labelsBelow: 0.28, outlineBelow: 0.12 },
  };
}

const componentPathCache = new Map<string, Path2D>();
const componentOutlineSampleCache = new Map<string, Point[]>();
export function componentPathObject(kind: string, width = 100, height = 100): Path2D | undefined {
  const path = componentOutlinePath(kind, width, height);
  if (typeof Path2D === "undefined") return undefined;
  let cached = componentPathCache.get(path);
  if (!cached) {
    try { cached = new Path2D(path); } catch { return undefined; }
    if (componentPathCache.size >= 128) componentPathCache.delete(componentPathCache.keys().next().value!);
    componentPathCache.set(path, cached);
  }
  return cached;
}

export function componentOutlineSamples(group: GroupElement, count = 32): Point[] {
  const bounds = group.componentBounds; const kind = group.libraryComponent?.kind;
  if (!bounds || !kind || typeof document === "undefined") return [];
  const pathData = componentOutlinePath(kind, bounds.w, bounds.h);
  const cacheKey = `${count}:${pathData}`;
  let localSamples = componentOutlineSampleCache.get(cacheKey);
  if (!localSamples) {
  try {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    const length = path.getTotalLength();
    if (!Number.isFinite(length) || length <= 0) return [];
      localSamples = Array.from({ length: Math.max(4, count) }, (_, index) => {
      const point = path.getPointAtLength(length * index / Math.max(4, count));
        return { x: point.x / 100, y: point.y / 100 };
    });
      if (componentOutlineSampleCache.size >= 256) componentOutlineSampleCache.delete(componentOutlineSampleCache.keys().next().value!);
      componentOutlineSampleCache.set(cacheKey, localSamples);
    } catch { return []; }
  }
  return localSamples.map(point => ({ x: bounds.x + point.x * bounds.w, y: bounds.y + point.y * bounds.h }));
}

export function componentLabelSamples(group: GroupElement): Point[] {
  const bounds = group.componentBounds; const kind = group.libraryComponent?.kind;
  if (!bounds || !kind) return [];
  const label = componentGeometry(kind, bounds.w, bounds.h).labelBox;
  return [0.2, 0.5, 0.8].flatMap(y => [0.2, 0.5, 0.8].map(x => ({
    x: bounds.x + (label.x + label.w * x) * bounds.w,
    y: bounds.y + (label.y + label.h * y) * bounds.h,
  })));
}

const CARDINAL_PORTS: readonly { id: string; name: string; anchor: Point }[] = [
  { id: "north", name: "North", anchor: { x: 0.5, y: 0 } },
  { id: "east", name: "East", anchor: { x: 1, y: 0.5 } },
  { id: "south", name: "South", anchor: { x: 0.5, y: 1 } },
  { id: "west", name: "West", anchor: { x: 0, y: 0.5 } },
];

/** Resolves default ports from the same catalog outline used by primitive shape projection. */
export function componentDefaultPorts(group: GroupElement, project: (path: string, anchor: Point, width: number, height: number) => Point): { id: string; name: string; anchor: Point }[] {
  const bounds = group.componentBounds; const kind = group.libraryComponent?.kind;
  if (!bounds || !kind) return [];
  const strategy = componentPortStrategy(kind);
  if (strategy.type === "none") return [];
  const cardinal = CARDINAL_PORTS.map(port => ({ ...port, anchor: project(componentOutlinePath(kind, bounds.w, bounds.h), port.anchor, bounds.w, bounds.h) }));
  if (strategy.type === "per-row") {
    const options = group.libraryComponent?.formOptions ?? [];
    const fields = group.libraryComponent?.componentFields ?? [];
    const items = group.libraryComponent?.guiProperties?.items ?? [];
    const isTable = kind === "gui-table";
    const isList = kind === "gui-list" || kind === "gui-menu" || kind === "gui-accordion";
    const itemCount = items.length || (kind === "gui-table" ? 6 : kind === "gui-list" || kind === "gui-menu" || kind === "gui-accordion" ? 3 : 0);
    const count = isTable ? Math.max(1, Math.ceil(itemCount / 3)) : Math.max(1, Math.min(isList ? 12 : 8, options.length || itemCount || fields.length || (kind.startsWith("form-") ? 3 : 4)));
    const isChoice = kind === "form-checkbox" || kind === "form-radio";
    const properties = group.libraryComponent?.guiProperties;
    const titlePosition = properties?.titlePosition ?? "top";
    const horizontalTitle = isChoice && (titlePosition === "left" || titlePosition === "right");
    const titleHeight = !isChoice ? 0 : horizontalTitle ? 0 : titlePosition === "bottom" ? 15 : Math.min(18, bounds.h * .28);
    const fontSize = Math.max(9, Math.min(14, group.libraryComponent?.textStyle?.fontSize ?? 11, bounds.h * .32));
    const titleWidth = horizontalTitle ? Math.min(bounds.w * .38, Math.max(30, (group.libraryComponent?.formTitle ?? "Choose an option").length * fontSize * .55)) : bounds.w;
    const contentWidth = horizontalTitle ? Math.max(20, bounds.w - titleWidth - 6) : bounds.w - 4;
    const columnGap = Math.max(0, Math.min(40, properties?.optionColumnGap ?? properties?.optionGap ?? 4));
    const layout = properties?.optionLayout ?? "vertical";
    const fittingColumns = Math.max(1, Math.floor((contentWidth + columnGap) / (36 + columnGap)));
    const requestedColumns = layout === "horizontal" ? count : Math.max(1, Math.round(properties?.optionColumns ?? 2));
    const columns = isChoice ? Math.max(1, Math.min(count, fittingColumns, layout === "vertical" ? 1 : requestedColumns)) : 1;
    const rowCount = Math.ceil(count / columns);
    const rowGap = Math.max(0, Math.min(40, properties?.optionRowGap ?? properties?.optionGap ?? 4));
    const itemHeight = Math.max(11, fontSize * 1.2);
    const listGap = Math.max(0, Math.min(40, properties?.optionRowGap ?? properties?.optionGap ?? 3));
    const listRowHeight = Math.min(24, Math.max(13, (bounds.h - 28 - listGap * (count - 1)) / count));
    const rowPitch = isChoice ? itemHeight + rowGap
      : isTable ? bounds.h / rowCount
        : isList ? listRowHeight + listGap
          : Math.max(1, (bounds.h - titleHeight - 8) / rowCount);
    const contentY = titlePosition === "bottom" ? 2 : titleHeight;
    const origin = isChoice ? contentY + itemHeight / 2
      : isTable ? rowPitch / 2
        : isList ? 27 + listRowHeight / 2
          : titleHeight + rowPitch / 2;
    const markerSize = Math.min(10, Math.max(5, rowPitch * .62));
    const rowPorts = Array.from({ length: count }, (_, index) => {
      const row = Math.floor(index / columns); const column = index % columns;
      const text = options[index] ?? items[index] ?? fields[index]?.value ?? "";
      const cellWidth = (contentWidth - rowGap * (columns - 1)) / columns;
      const labelWidth = Math.max(1, cellWidth - markerSize - 8);
      const contentLeft = horizontalTitle && titlePosition === "left" ? titleWidth + 4 : 2;
      const labelEnd = contentLeft + column * (cellWidth + rowGap) + markerSize + 6 + Math.min(labelWidth, text.length * fontSize * .56);
      const x = isChoice ? Math.min(bounds.w - 1, Math.max(1, labelEnd)) / bounds.w : strategy.edge === "right" ? 1 - strategy.inset : strategy.inset;
      return {
        id: `row-${index + 1}`, name: `Row ${index + 1}`,
        anchor: { x, y: Math.max(0, Math.min(1, (origin + row * rowPitch) / bounds.h)) },
      };
    });
    const choiceCardinals = isChoice ? [
      { id: "north", name: "North", anchor: { x: .5, y: Math.min(.99, contentY / bounds.h) } },
      { id: "east", name: "East", anchor: rowPorts[Math.floor((rowPorts.length - 1) / 2)]?.anchor ?? { x: .75, y: .5 } },
      { id: "south", name: "South", anchor: rowPorts[rowPorts.length - 1]?.anchor ?? { x: .5, y: .9 } },
      { id: "west", name: "West", anchor: { x: .03, y: rowPorts[Math.floor((rowPorts.length - 1) / 2)]?.anchor.y ?? .5 } },
    ] : cardinal;
    return [...choiceCardinals, ...rowPorts];
  }
  if (strategy.type === "along-the-line") return [...cardinal, ...(strategy.axis === "horizontal" ? [
    { id: "line-start", name: "Start", anchor: { x: strategy.inset, y: 0.5 } },
    { id: "line-end", name: "End", anchor: { x: 1 - strategy.inset, y: 0.5 } },
  ] : [
    { id: "line-start", name: "Start", anchor: { x: 0.5, y: strategy.inset } },
    { id: "line-end", name: "End", anchor: { x: 0.5, y: 1 - strategy.inset } },
  ])];
  if (strategy.type === "per-lane") {
    const count = Math.max(2, Math.min(8, group.libraryComponent?.laneCount ?? 3));
    return [...cardinal, ...Array.from({ length: count }, (_, index) => ({
      id: `lane-${index + 1}`, name: `Lane ${index + 1}`,
      anchor: strategy.axis === "horizontal" ? { x: 1, y: (index + 0.5) / count } : { x: (index + 0.5) / count, y: 1 },
    }))];
  }
  return cardinal;
}
