import type { Element as CanvasElement, FreehandElement, ImageElement, Point, ShapeElement, TextElement } from "../../model";
import { elementBounds } from "../canvas/bounds";
import { ALL_FLOWCHART_SHAPES } from "./config";

const MAX_IMPORT_BYTES = 25_000_000;
const MAX_IMPORTED_POINTS = 250_000;
const MAX_IMPORT_LABEL = 50_000;
const FLOWCHART_SHAPES = new Set<string>(ALL_FLOWCHART_SHAPES.map(shape => shape.value));
const DRAWIO_FLOWCHART_SHAPES: Record<string, NonNullable<ShapeElement["flowchartShape"]>> = {
  parallelogram: "data", cylinder: "database", cloud: "cloud", document: "document", hexagon: "hexagon", callout: "callout",
  "mxgraph.flowchart.decision": "decision", "mxgraph.flowchart.terminator": "terminator", "mxgraph.flowchart.process": "process", "mxgraph.flowchart.database": "database", "mxgraph.flowchart.document": "document", "mxgraph.flowchart.data": "data",
  "mxgraph.flowchart.internalStorage": "internal-storage", "mxgraph.flowchart.multiDocument": "multi-document", "mxgraph.flowchart.merge": "merge", "mxgraph.flowchart.extract": "extract", "mxgraph.flowchart.collate": "collate", "mxgraph.flowchart.sort": "sort", "mxgraph.flowchart.summingJunction": "summing-junction", "mxgraph.flowchart.or": "or", "mxgraph.flowchart.loopLimit": "loop-limit", "mxgraph.flowchart.loopStart": "loop-start", "mxgraph.flowchart.loopEnd": "loop-end", "mxgraph.flowchart.alternateProcess": "alternate-process", "mxgraph.flowchart.card": "card", "mxgraph.flowchart.punchedTape": "punched-tape", "mxgraph.flowchart.sequentialData": "sequential-data", "mxgraph.flowchart.directData": "direct-data", "mxgraph.flowchart.display": "display",
};
const id = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
const finite = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const safeColor = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;
  const color = value.trim();
  if (/^#[\da-f]{6}$/i.test(color)) return color;
  if (/^#[\da-f]{3}$/i.test(color)) return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  if (/^#[\da-f]{8}$/i.test(color)) return color.slice(0, 7);
  if (/^#[\da-f]{4}$/i.test(color)) return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  if (/^rgba?\(/i.test(color)) { const values = color.match(/[\d.]+%?/g)?.map(part => part.endsWith("%") ? Number.parseFloat(part) * 2.55 : Number.parseFloat(part)); if (values && values.length >= 3 && values.slice(0, 3).every(Number.isFinite)) return `#${values.slice(0, 3).map(value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0")).join("")}`; }
  return fallback;
};
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
type CanvasPrimitive = Exclude<CanvasElement, { type: "group" }>;
type GroupedPrimitive = { element: CanvasPrimitive; groups: string[] };
function flattenWithGroups(elements: CanvasElement[], groupIds = new Map<CanvasElement & { type: "group" }, string>(), parentGroups: string[] = []): GroupedPrimitive[] {
  return elements.flatMap(element => {
    if (element.hidden) return [];
    if (element.type === "group") {
      let groupId = groupIds.get(element);
      if (!groupId) { groupId = id("group"); groupIds.set(element, groupId); }
      return flattenWithGroups(element.elements, groupIds, [...parentGroups, groupId]);
    }
    return [{ element, groups: parentGroups }];
  });
}
function pointBounds(points: Point[]): { x: number; y: number; w: number; h: number } {
  if (!points.length) return { x: 0, y: 0, w: 1, h: 1 };
  let minX = points[0].x; let minY = points[0].y; let maxX = minX; let maxY = minY;
  for (let index = 1; index < points.length; index++) { const point = points[index]; minX = Math.min(minX, point.x); minY = Math.min(minY, point.y); maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y); }
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

function plainLabel(value: string): string {
  const html = value.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p\s*>/gi, "\n").replace(/<[^>]*>/g, "");
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const text = (doc.body.textContent ?? html).replace(/\u00a0/g, " ").trim();
  if (text.length > MAX_IMPORT_LABEL) throw new Error("Diagram labels are limited to 50,000 characters.");
  return text;
}

function validText(value: unknown, max = 50_000): value is string {
  return typeof value === "string" && value.length <= max;
}

function drawioLineStyle(style: Record<string, string>): "solid" | "dashed" | "dotted" {
  if (style.dashed !== "1") return "solid";
  return /^(?:1\s+1|1\s+2|2\s+2|3\s+1)$/.test(style.dashPattern?.trim() ?? "") ? "dotted" : "dashed";
}

function drawioHead(value: string | undefined): ShapeElement["startHead"] {
  if (!value || value === "none") return "none";
  if (value === "open") return "open";
  if (value === "diamond") return "diamond";
  if (value === "oval") return "dot";
  if (value === "ERone") return "bar";
  if (value === "ERmany") return "crow";
  if (value === "block") return "thick";
  return "solid";
}

function mxHead(value: ShapeElement["startHead"]): string {
  if (!value || value === "none") return "none";
  if (value === "open") return "open";
  if (value === "diamond" || value === "open-diamond") return "diamond";
  if (value === "dot") return "oval";
  if (value === "bar") return "ERone";
  if (value === "crow") return "ERmany";
  if (value === "thick") return "block";
  return "classic";
}

function shapeFromExternal(record: Record<string, unknown>, kind: string, files?: Record<string, unknown>): CanvasElement | undefined {
  const type = kind.toLowerCase();
  const x = finite(record.x); const y = finite(record.y);
  const w = Math.max(1, Math.abs(finite(record.width ?? record.w, type === "text" ? 160 : 120)));
  const h = Math.max(1, Math.abs(finite(record.height ?? record.h, type === "text" ? 44 : 72)));
  const color = safeColor(record.strokeColor ?? record.color, "#374151");
  const rawFill = record.backgroundColor ?? record.fillColor;
  const fill = typeof rawFill === "string" && (/^none$/i.test(rawFill) || /^#[\da-f]{3}0$/i.test(rawFill) || /^#[\da-f]{6}00$/i.test(rawFill)) ? "transparent" : safeColor(rawFill, "transparent");
  const thickness = clamp(finite(record.strokeWidth ?? record.thickness, 2), 0.5, 24);
  const opacity = clamp(finite(record.opacity, 100) / (finite(record.opacity, 100) > 1 ? 100 : 1), 0, 1);
  const elementId = typeof record.id === "string" && record.id.length <= 160 ? record.id : id("import");
  const strokeStyle = record.strokeStyle === "dashed" ? "dashed" : record.strokeStyle === "dotted" ? "dotted" : "solid";
  const rotation = finite(record.angle) * 180 / Math.PI;
  if (type === "text") {
    if (!validText(record.text)) return undefined;
    const fontSize = clamp(finite(record.fontSize, 20), 8, 160);
    const externalFont = finite(record.fontFamily, 2);
    const element: TextElement = { type: "text", id: elementId, x, y, text: record.text, color, fontSize, bold: record.bold === true || record.fontWeight === "bold" || finite(record.fontWeight) >= 600, italic: record.italic === true || record.fontStyle === "italic", textAlign: record.textAlign === "center" || record.textAlign === "right" || record.textAlign === "justify" ? record.textAlign : "left", fontFamily: externalFont === 1 ? "hand" : externalFont === 3 ? "mono" : "sans", opacity, ...(rotation ? { rotation } : {}) };
    return element;
  }
  if (type === "image") {
    const fileId = typeof record.fileId === "string" ? record.fileId : "";
    const file = files && fileId ? files[fileId] : undefined;
    const dataUrl = typeof file === "string" ? file : file && typeof file === "object" && typeof (file as Record<string, unknown>).dataURL === "string" ? (file as Record<string, unknown>).dataURL as string : undefined;
    if (!dataUrl || !/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(dataUrl)) return undefined;
    let previewUrl: string | undefined;
    try { const url = new URL(String(record.link ?? "")); if (url.protocol === "https:" && !url.username && !url.password) previewUrl = url.toString(); } catch { /* Regular image elements do not have a preview URL. */ }
    return { type: "image", id: elementId, x, y, w, h, dataUrl, ...(rotation ? { rotation } : {}), ...(previewUrl ? { previewUrl } : {}) };
  }
  if (type === "freedraw" || type === "freehand") {
    if (!Array.isArray(record.points) || record.points.length < 2 || record.points.length > 100_000) return undefined;
    const pressures = Array.isArray(record.pressures) ? record.pressures : [];
    const points = record.points.flatMap((raw, index): { x: number; y: number; pressure?: number }[] => {
      const pressure = finite(pressures[index], 0);
      const pressureData = pressure > 0 ? { pressure: clamp(pressure, 0, 1) } : {};
      if (Array.isArray(raw) && Number.isFinite(raw[0]) && Number.isFinite(raw[1])) return [{ x: x + Number(raw[0]), y: y + Number(raw[1]), ...pressureData }];
      if (raw && typeof raw === "object" && Number.isFinite((raw as Record<string, unknown>).x) && Number.isFinite((raw as Record<string, unknown>).y)) return [{ x: x + Number((raw as Record<string, unknown>).x), y: y + Number((raw as Record<string, unknown>).y), ...pressureData }];
      return [];
    });
    if (points.length < 2) return undefined;
    return { type: "freehand", id: elementId, points, color, thickness, opacity };
  }
  if (type === "svgpath") {
    const custom = record.customData && typeof record.customData === "object" ? record.customData as Record<string, unknown> : {};
    const pathData = custom.svgPathData; const pathWidth = finite(custom.svgPathWidth); const pathHeight = finite(custom.svgPathHeight);
    if (typeof pathData !== "string" || pathData.length > 500_000 || !/^[\d\s.,+\-eEmlhvcsqtazMLHVCSQTAZ]+$/.test(pathData) || pathWidth <= 0 || pathHeight <= 0 || pathWidth > 100_000 || pathHeight > 100_000) return undefined;
    return { type: "svgPath", id: elementId, x, y, w, h, color, thickness, pathData, pathWidth, pathHeight, fillRule: custom.svgFillRule === "evenodd" ? "evenodd" : "nonzero", svgStroke: custom.svgStroke !== false, ...(fill !== "transparent" ? { fillColor: fill, fillOpacity: clamp(finite(custom.svgFillOpacity, 1), 0, 1) } : {}), opacity, ...(rotation ? { rotation } : {}) };
  }
  if (["rectangle", "ellipse", "diamond", "triangle", "flowchart", "line", "arrow"].includes(type)) {
    const pointsRaw = Array.isArray(record.points) ? record.points : undefined;
    let routePoints: Point[] | undefined;
    if (pointsRaw && pointsRaw.length > 100_000) return undefined;
    if (pointsRaw) routePoints = pointsRaw.flatMap((point): Point[] => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]) ? [{ x: x + Number(point[0]), y: y + Number(point[1]) }] : []);
    let elementType: ShapeElement["type"] = type === "ellipse" ? "circle" : type as ShapeElement["type"];
    if (elementType === "line" || elementType === "arrow") {
      if (routePoints && routePoints.length >= 2) {
        const start = routePoints[0]; const end = routePoints[routePoints.length - 1];
        return { type: elementType, id: elementId, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color, thickness, lineStyle: strokeStyle, startHead: headFromExcalidraw(record.startArrowhead), endHead: headFromExcalidraw(record.endArrowhead) ?? (elementType === "arrow" ? "solid" : "none"), ...(routePoints.length > 2 ? { routePoints: routePoints.slice(1, -1) } : {}), opacity, ...(rotation ? { rotation } : {}) };
      }
    }
    const backgroundColor = fill === "transparent" || fill === "#ffffff00" || fill === "#FFFFFF00" ? undefined : fill;
    const label = validText(record.label) ? record.label : undefined;
    const flowchartShape = record.customData && typeof record.customData === "object" ? (record.customData as Record<string, unknown>).flowchartShape : undefined;
    return { type: elementType, id: elementId, x, y, w, h, color, thickness, ...(backgroundColor && backgroundColor !== "transparent" ? { fillColor: backgroundColor } : {}), lineStyle: strokeStyle, ...(elementType === "flowchart" ? { flowchartShape: FLOWCHART_SHAPES.has(String(flowchartShape)) ? flowchartShape as ShapeElement["flowchartShape"] : "process" } : {}), opacity, ...(rotation ? { rotation } : {}), ...(label ? { label: { text: label, color: safeColor(record.textColor, "#111827"), fontSize: clamp(finite(record.fontSize, 16), 8, 100), fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } } : {}) } as ShapeElement;
  }
  return undefined;
}

function headFromExcalidraw(value: unknown): ShapeElement["startHead"] {
  if (value === "triangle") return "solid";
  if (value === "dot" || value === "bar") return value;
  if (value === "arrow") return "open";
  return undefined;
}

function excalidrawBounds(element: CanvasElement): { x: number; y: number; w: number; h: number } | undefined {
  if (element.type === "text") return { x: element.x, y: element.y, w: Math.max(80, element.text.length * element.fontSize * 0.56), h: Math.max(24, element.fontSize * 1.4) };
  if (element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "triangle" || element.type === "flowchart" || element.type === "svgPath") return { x: element.x, y: element.y, w: element.w, h: element.h };
  return undefined;
}

function excalidrawAnchorToward(element: CanvasElement, x: number, y: number): Point | undefined {
  const bounds = excalidrawBounds(element); if (!bounds) return undefined;
  const dx = x - (bounds.x + bounds.w / 2); const dy = y - (bounds.y + bounds.h / 2);
  return Math.abs(dx) > Math.abs(dy) ? { x: dx > 0 ? 1 : 0, y: 0.5 } : { x: 0.5, y: dy > 0 ? 1 : 0 };
}

/** Import the editable Excalidraw JSON subset represented by SketchDraw primitives. */
export function importExcalidraw(source: string): CanvasElement[] {
  if (source.length > MAX_IMPORT_BYTES) throw new Error("The diagram file exceeds the 25 MB import limit.");
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { throw new Error("The Excalidraw file is not valid JSON."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The Excalidraw file must contain a JSON object.");
  const root = parsed as Record<string, unknown>;
  if (root.type !== "excalidraw" || !Array.isArray(root.elements)) throw new Error("This is not an Excalidraw scene file.");
  if (root.elements.length > 20_000) throw new Error("A diagram import can include up to 20,000 elements.");
  const files = root.files && typeof root.files === "object" ? root.files as Record<string, unknown> : undefined;
  const records = root.elements.filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === "object" && !Array.isArray(raw)).filter(record => record.isDeleted !== true);
  let remainingPoints = MAX_IMPORTED_POINTS;
  const imported = records.flatMap((record): CanvasElement[] => {
    if (record.isDeleted === true || record.type === "selection" || record.type === "frame" || record.type === "magicframe") return [];
    if (typeof record.containerId === "string") return [];
    if ((record.type === "freedraw" || record.type === "freehand" || record.type === "line" || record.type === "arrow") && Array.isArray(record.points)) {
      remainingPoints -= record.points.length;
      if (remainingPoints < 0) throw new Error("The Excalidraw scene exceeds the 250,000 point import limit.");
    }
    const customData = record.customData && typeof record.customData === "object" ? record.customData as Record<string, unknown> : undefined;
    const customType = customData?.sketchDrawType;
    const kind = customType === "triangle" || customType === "flowchart" || customType === "svgPath" ? customType : String(record.type ?? "");
    const element = shapeFromExternal(record, kind, files);
    return element ? [element] : [];
  });
  const byId = new Map(imported.flatMap(element => element.id ? [[element.id, element] as const] : []));
  for (const record of records) {
    if (record.type !== "line" && record.type !== "arrow") continue;
    const connector = typeof record.id === "string" ? byId.get(record.id) : undefined;
    if (!connector || connector.type !== "line" && connector.type !== "arrow") continue;
    const startBinding = record.startBinding && typeof record.startBinding === "object" ? record.startBinding as Record<string, unknown> : undefined;
    const endBinding = record.endBinding && typeof record.endBinding === "object" ? record.endBinding as Record<string, unknown> : undefined;
    const startId = typeof startBinding?.elementId === "string" ? startBinding.elementId : undefined;
    const endId = typeof endBinding?.elementId === "string" ? endBinding.elementId : undefined;
    const startTarget = startId ? byId.get(startId) : undefined; const endTarget = endId ? byId.get(endId) : undefined;
    const startAnchor = startTarget ? excalidrawAnchorToward(startTarget, connector.x + connector.w, connector.y + connector.h) : undefined;
    const endAnchor = endTarget ? excalidrawAnchorToward(endTarget, connector.x, connector.y) : undefined;
    connector.startBinding = startId && startAnchor ? { elementId: startId, anchor: startAnchor } : undefined;
    connector.endBinding = endId && endAnchor ? { elementId: endId, anchor: endAnchor } : undefined;
  }
  for (const record of records) {
    if (typeof record.containerId !== "string" || record.type !== "text" || !validText(record.text)) continue;
    const container = byId.get(record.containerId);
    if (container && (container.type === "rectangle" || container.type === "circle" || container.type === "diamond" || container.type === "triangle" || container.type === "flowchart")) {
      container.label = { text: record.text, color: safeColor(record.strokeColor, "#111827"), fontSize: clamp(finite(record.fontSize, 16), 8, 100), fontFamily: "sans", bold: record.fontWeight === "bold", italic: record.fontStyle === "italic", underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" };
    }
  }
  const importedById = new Map(imported.flatMap(item => item.id ? [[item.id, item] as const] : []));
  const groupNodes = new Map<string, Extract<CanvasElement, { type: "group" }>>();
  const output: CanvasElement[] = []; const placed = new Set<CanvasElement>();
  for (const record of records) {
    const item = typeof record.id === "string" ? importedById.get(record.id) : undefined;
    if (!item || placed.has(item)) continue;
    const groupPath = Array.isArray(record.groupIds) ? record.groupIds.filter((value): value is string => typeof value === "string" && value.length <= 160).slice(0, 16) : [];
    if (!groupPath.length) { output.push(item); placed.add(item); continue; }
    let children = output;
    for (const groupId of groupPath) {
      let group = groupNodes.get(groupId);
      if (!group) { group = { type: "group", id: id("excalidraw-group"), elements: [] }; groupNodes.set(groupId, group); children.push(group); }
      children = group.elements;
    }
    children.push(item); placed.add(item);
  }
  for (const item of imported) if (!placed.has(item)) output.push(item);
  return output;
}

function externalStyle(element: CanvasPrimitive): { stroke: string; fill: string; strokeWidth: number; opacity: number } {
  if (element.type === "freehand") return { stroke: element.color, fill: "transparent", strokeWidth: element.thickness, opacity: element.opacity ?? 1 };
  if (element.type === "text") return { stroke: element.color, fill: "transparent", strokeWidth: 1, opacity: element.opacity ?? 1 };
  if (element.type === "schemaTable") return { stroke: "#9ca3af", fill: "#ffffff", strokeWidth: 1, opacity: element.opacity ?? 1 };
  if (element.type === "image") return { stroke: "#6b7280", fill: "transparent", strokeWidth: 1, opacity: element.opacity ?? 1 };
  return { stroke: element.color, fill: element.fillColor ?? "transparent", strokeWidth: element.thickness, opacity: element.opacity ?? 1 };
}

function textForShape(element: ShapeElement): string | undefined { return element.label?.text; }

/** Export supported SketchDraw primitives as editable Excalidraw elements. */
export function exportExcalidraw(elements: CanvasElement[]): string {
  const external: Record<string, unknown>[] = [];
  const elementIds = new Map<string, string>();
  const labelIds = new Map<string, string>();
  const grouped = flattenWithGroups(elements);
  const visible = grouped.map(entry => entry.element);
  const groupIdsByElement = new Map(grouped.flatMap(entry => entry.element.id ? [[entry.element.id, entry.groups] as const] : []));
  for (const element of visible) if (element.id) elementIds.set(element.id, id("excalidraw"));
  for (const element of visible) if (element.id && (element.type === "schemaTable" || element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "triangle" || element.type === "flowchart" || element.type === "svgPath") && (element.type === "schemaTable" || !!element.label?.text)) labelIds.set(element.id, id("excalidraw-text"));
  const connectorBounds = new Map<string, { id: string; type: "arrow" }[]>();
  for (const element of visible) if ((element.type === "line" || element.type === "arrow") && element.id) {
    const externalId = elementIds.get(element.id); if (!externalId) continue;
    for (const binding of [element.startBinding, element.endBinding]) {
      const targetId = binding ? elementIds.get(binding.elementId) : undefined;
      if (targetId) connectorBounds.set(binding!.elementId, [...(connectorBounds.get(binding!.elementId) ?? []), { id: externalId, type: "arrow" }]);
    }
  }
  const arrowhead = (head: ShapeElement["startHead"]): string | null => !head || head === "none" ? null : head === "dot" ? "dot" : head === "bar" ? "bar" : ["solid", "hollow", "thick", "diamond", "open-diamond"].includes(head) ? "triangle" : "arrow";
  for (const element of visible) {
    const strokeBounds = element.type === "freehand" ? pointBounds(element.points) : undefined;
    const base = element.type === "freehand" ? { x: strokeBounds!.x, y: strokeBounds!.y, width: strokeBounds!.w, height: strokeBounds!.h }
      : element.type === "line" || element.type === "arrow" ? { x: Math.min(element.x, element.x + element.w), y: Math.min(element.y, element.y + element.h), width: Math.max(1, Math.abs(element.w)), height: Math.max(1, Math.abs(element.h)) }
      : element.type === "text" ? { x: element.x, y: element.y, width: Math.max(80, element.text.length * element.fontSize * 0.56), height: Math.max(24, element.fontSize * 1.4) }
        : element.type === "schemaTable" ? { x: element.x, y: element.y, width: element.w, height: element.h }
          : element.type === "image" ? { x: element.x, y: element.y, width: element.w, height: element.h }
            : { x: element.x, y: element.y, width: element.w, height: element.h };
    const style = externalStyle(element);
    const type = element.type === "freehand" ? "freedraw" : element.type === "schemaTable" || element.type === "flowchart" || element.type === "triangle" || element.type === "svgPath" ? "rectangle" : element.type === "image" ? "image" : element.type === "circle" ? "ellipse" : element.type;
    const labelId = element.id ? labelIds.get(element.id) : undefined;
    const boundElements = [...(element.id ? connectorBounds.get(element.id) ?? [] : []), ...(labelId ? [{ id: labelId, type: "text" as const }] : [])];
    const common: Record<string, unknown> = {
      id: element.id ? elementIds.get(element.id) : id("excalidraw"), type, ...base,
      angle: (element.rotation ?? 0) * Math.PI / 180, strokeColor: style.stroke, backgroundColor: style.fill,
       fillStyle: "solid", strokeWidth: style.strokeWidth, strokeStyle: "lineStyle" in element && (element.lineStyle === "dashed" || element.lineStyle === "dotted") ? element.lineStyle : "solid", roughness: 0,
      opacity: Math.round(style.opacity * 100), groupIds: element.id ? groupIdsByElement.get(element.id) ?? [] : [], frameId: null, roundness: null,
      seed: Math.floor(Math.random() * 2_147_483_647), version: 1, versionNonce: Math.floor(Math.random() * 2_147_483_647),
      isDeleted: false, boundElements: boundElements.length ? boundElements : null, updated: Date.now(), link: element.type === "image" ? element.previewUrl ?? null : null, locked: element.locked ?? false,
    };
    if (element.type === "freehand") { common.points = element.points.map(point => [point.x - base.x, point.y - base.y]); common.pressures = element.points.map(point => point.pressure ?? 0); }
    if (element.type === "line" || element.type === "arrow") {
      const points = [{ x: element.x, y: element.y }, ...(element.routePoints ?? []), { x: element.x + element.w, y: element.y + element.h }];
      common.points = points.map(point => [point.x - base.x, point.y - base.y]);
      common.startArrowhead = arrowhead(element.startHead);
      common.endArrowhead = arrowhead(element.endHead ?? (element.type === "arrow" ? "solid" : "none"));
      common.startBinding = element.startBinding && elementIds.has(element.startBinding.elementId) ? { elementId: elementIds.get(element.startBinding.elementId), focus: 0, gap: 1 } : null;
      common.endBinding = element.endBinding && elementIds.has(element.endBinding.elementId) ? { elementId: elementIds.get(element.endBinding.elementId), focus: 0, gap: 1 } : null;
    }
    if (element.type === "text") {
      common.text = element.text; common.originalText = element.text; common.fontSize = element.fontSize; common.fontFamily = element.fontFamily === "hand" ? 1 : element.fontFamily === "mono" ? 3 : 2;
      common.textAlign = element.textAlign ?? "left"; common.verticalAlign = "top"; common.baseline = element.fontSize; common.containerId = null; common.autoResize = true; common.lineHeight = 1.25;
      common.strokeColor = element.color; common.backgroundColor = "transparent";
      common.fontWeight = element.bold ? "bold" : "normal"; common.fontStyle = element.italic ? "italic" : "normal";
    }
    if (element.type === "flowchart") common.customData = { sketchDrawType: element.type, flowchartShape: element.flowchartShape };
    else if (element.type === "triangle") common.customData = { sketchDrawType: element.type };
    else if (element.type === "svgPath") common.customData = { sketchDrawType: element.type, svgPathData: element.pathData, svgPathWidth: element.pathWidth, svgPathHeight: element.pathHeight, svgFillRule: element.fillRule, svgFillOpacity: element.fillOpacity, svgStroke: element.svgStroke };
    if (element.type === "image") {
      const fileId = id("file"); common.fileId = fileId;
      common.status = "saved"; common.scale = [1, 1]; common.crop = null;
      (common as Record<string, unknown>).__fileData = element.dataUrl;
    } else if (element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "triangle" || element.type === "flowchart" || element.type === "svgPath") {
      if (element.type === "diamond") common.type = "diamond";
    }
    external.push(common);
    const shapeElement = element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "triangle" || element.type === "flowchart" || element.type === "svgPath" ? element : undefined;
    const label = element.type === "schemaTable" ? [element.name, ...element.columns.map(column => `${column.primaryKey ? "◆ " : ""}${column.name}: ${column.dataType}`)].join("\n") : shapeElement ? textForShape(shapeElement) : undefined;
    if (label && labelId) external.push({
      id: labelId, type: "text", x: base.x, y: base.y, width: base.width, height: base.height,
      angle: common.angle, strokeColor: element.type === "schemaTable" ? "#111827" : shapeElement?.label?.color ?? "#111827", backgroundColor: "transparent",
      fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid", roughness: 0, opacity: Math.round(style.opacity * 100),
      groupIds: common.groupIds, frameId: null, roundness: null, seed: Math.floor(Math.random() * 2_147_483_647), version: 1,
      versionNonce: Math.floor(Math.random() * 2_147_483_647), isDeleted: false, boundElements: null, updated: Date.now(),
      link: null, locked: element.locked ?? false, text: label, originalText: label,
      fontSize: element.type === "schemaTable" ? element.fontSize ?? 14 : shapeElement?.label?.fontSize ?? 16,
      fontFamily: shapeElement?.label?.fontFamily === "hand" ? 1 : shapeElement?.label?.fontFamily === "mono" ? 3 : 2, fontWeight: shapeElement?.label?.bold ? "bold" : "normal", fontStyle: shapeElement?.label?.italic ? "italic" : "normal", textAlign: shapeElement?.label?.textAlign ?? "center", verticalAlign: shapeElement?.label?.verticalAlign === "top" ? "top" : shapeElement?.label?.verticalAlign === "bottom" ? "bottom" : "middle", baseline: element.type === "schemaTable" ? element.fontSize ?? 14 : shapeElement?.label?.fontSize ?? 16,
      containerId: common.id, autoResize: false, lineHeight: 1.25,
    });
  }
  const files: Record<string, unknown> = {};
  for (const item of external) {
    const dataUrl = item.__fileData; delete item.__fileData;
    if (typeof item.fileId === "string" && typeof dataUrl === "string") files[item.fileId] = { mimeType: dataUrl.match(/^data:([^;,]+)/)?.[1] ?? "image/png", id: item.fileId, dataURL: dataUrl, created: Date.now(), lastRetrieved: Date.now() };
  }
  const scene = { type: "excalidraw", version: 2, source: "https://excalidraw.com", elements: external, appState: { viewBackgroundColor: "transparent", gridSize: null, zoom: { value: 1 } }, files };
  return JSON.stringify(scene, null, 2);
}

async function decodeCompressedDiagram(encoded: string): Promise<string> {
  const binary = atob(encoded.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  if (typeof DecompressionStream === "undefined") throw new Error("This webview cannot open compressed draw.io pages. Save the page as uncompressed XML and import it again.");
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat));
    const decoded = await new Response(stream).text();
    return decodeURIComponent(decoded);
  } catch { throw new Error("This compressed draw.io page could not be decoded. Export it as uncompressed XML from draw.io and retry."); }
}

function drawioStyle(style: string): Record<string, string> {
  const output: Record<string, string> = {};
  const keys = [...style.matchAll(/(?:^|;)([\w-]+)=/g)];
  for (let index = 0; index < keys.length; index++) {
    const match = keys[index]; const key = match[1];
    const valueStart = match.index! + match[0].length;
    const valueEnd = index + 1 < keys.length ? keys[index + 1].index! : style.length;
    output[key] = style.slice(valueStart, valueEnd).replace(/;$/, "");
  }
  return output;
}

function numberAttr(element: Element | null | undefined, name: string, fallback: number): number {
  const value = Number(element?.getAttribute(name));
  return Number.isFinite(value) ? value : fallback;
}

/** Import uncompressed draw.io XML and its standard compressed mxfile pages. */
export async function importDrawio(source: string): Promise<CanvasElement[]> {
  if (source.length > MAX_IMPORT_BYTES) throw new Error("The diagram file exceeds the 25 MB import limit.");
  let parsed = new DOMParser().parseFromString(source, "application/xml");
  if (parsed.querySelector("parsererror")) throw new Error("The selected file is not valid draw.io XML.");
  let model = parsed.querySelector("mxGraphModel");
  if (!model) {
    const diagram = parsed.querySelector("mxfile > diagram, mxfile diagram");
    if (!diagram) throw new Error("No draw.io page was found in this file.");
    const content = diagram.textContent?.trim() ?? "";
    if (!content.startsWith("<")) {
      const decoded = await decodeCompressedDiagram(content);
      parsed = new DOMParser().parseFromString(decoded, "application/xml");
      if (parsed.querySelector("parsererror")) throw new Error("The compressed draw.io page did not decode into valid XML.");
      model = parsed.querySelector("mxGraphModel");
    } else model = diagram.querySelector("mxGraphModel");
  }
  const root = model?.querySelector("root");
  if (!root) throw new Error("The draw.io page has no editable graph model.");
  const cells = [...root.querySelectorAll(":scope > mxCell")];
  if (cells.length > 20_000) throw new Error("A diagram import can include up to 20,000 objects.");
  let importedPointCount = 0;
  const groupCells = new Map(cells.flatMap(cell => {
    if (cell.getAttribute("vertex") !== "1" || drawioStyle(cell.getAttribute("style") ?? "").shape !== "group" || !cell.getAttribute("id")) return [];
    return [[cell.getAttribute("id")!, cell] as const];
  }));
  const globalGroupOffset = (groupId: string, visiting = new Set<string>()): Point => {
    const group = groupCells.get(groupId);
    if (!group || visiting.has(groupId) || visiting.size > 32) return { x: 0, y: 0 };
    const nextVisiting = new Set(visiting); nextVisiting.add(groupId);
    const geometry = group.querySelector(":scope > mxGeometry");
    const parent = group.getAttribute("parent") ?? "1";
    const parentOffset = globalGroupOffset(parent, nextVisiting);
    return { x: parentOffset.x + numberAttr(geometry, "x", 0), y: parentOffset.y + numberAttr(geometry, "y", 0) };
  };
  const cellOffset = (cell: Element) => globalGroupOffset(cell.getAttribute("parent") ?? "1");
  const vertices = new Map<string, CanvasPrimitive>(); const pendingEdges: { cell: Element; style: Record<string, string>; geo: Element | null }[] = [];
  const imported: CanvasElement[] = [];
  for (const cell of cells) {
    if (cell.getAttribute("vertex") !== "1" && cell.getAttribute("edge") !== "1") continue;
    const style = drawioStyle(cell.getAttribute("style") ?? "");
    const geo = cell.querySelector(":scope > mxGeometry");
    const label = plainLabel(cell.getAttribute("value") ?? "");
    if (cell.getAttribute("edge") === "1") { pendingEdges.push({ cell, style, geo: cell.querySelector(":scope > mxGeometry") }); continue; }
    if (style.shape === "group") continue;
    const offset = cellOffset(cell);
    const x = numberAttr(geo, "x", 0) + offset.x; const y = numberAttr(geo, "y", 0) + offset.y; const w = clamp(numberAttr(geo, "width", 120), 1, 20_000); const h = clamp(numberAttr(geo, "height", 72), 1, 20_000);
    const shape = style.shape ?? "rectangle";
    if (shape === "polyline") {
      const pointNodes = [...(geo?.querySelectorAll("Array > mxPoint") ?? [])]; importedPointCount += pointNodes.length;
      if (importedPointCount > MAX_IMPORTED_POINTS) throw new Error("The draw.io page exceeds the 250,000 point import limit.");
      const points = pointNodes.map(point => ({ x: numberAttr(point, "x", 0) + offset.x, y: numberAttr(point, "y", 0) + offset.y }));
      if (points.length >= 2) {
        const stroke: FreehandElement = { type: "freehand", id: cell.getAttribute("id") || id("drawio-stroke"), points, color: safeColor(style.strokeColor, "#374151"), thickness: clamp(Number(style.strokeWidth) || 2, 0.5, 24), opacity: clamp((Number(style.opacity) || 100) / 100, 0, 1) };
        vertices.set(cell.getAttribute("id") || stroke.id!, stroke); imported.push(stroke);
      }
      continue;
    }
    if (shape === "image") {
      const rawImage = style.image;
      const dataUrl = rawImage?.match(/^(data:image\/(?:png|jpeg|webp|gif))(?:;base64)?,([\da-z+/]+=*)$/i);
      if (dataUrl && rawImage!.length <= MAX_IMPORT_BYTES) {
        const normalizedDataUrl = `${dataUrl[1]};base64,${dataUrl[2]}`;
        const image: ImageElement = { type: "image", id: cell.getAttribute("id") || id("drawio-image"), x, y, w, h, dataUrl: normalizedDataUrl, sourceWidth: w, sourceHeight: h };
        vertices.set(cell.getAttribute("id") || image.id!, image); imported.push(image);
      }
      continue;
    }
    if (shape === "text" || shape === "none") {
      const fontStyle = Number(style.fontStyle) || 0; const textRotation = Number(style.rotation ?? geo?.getAttribute("rotation")); const textOpacity = Number(style.opacity);
      const text: TextElement = { type: "text", id: cell.getAttribute("id") || id("drawio-text"), x, y, text: label, color: safeColor(style.fontColor, "#111827"), fontSize: clamp(Number(style.fontSize) || 16, 8, 100), fontFamily: /courier|mono/i.test(style.fontFamily ?? "") ? "mono" : /serif|georgia|times/i.test(style.fontFamily ?? "") ? "serif" : "sans", bold: (fontStyle & 1) !== 0, italic: (fontStyle & 2) !== 0, underline: (fontStyle & 4) !== 0, textAlign: style.align === "center" || style.align === "right" || style.align === "justify" ? style.align : "left", opacity: clamp(Number.isFinite(textOpacity) ? textOpacity / 100 : 1, 0, 1), ...(Number.isFinite(textRotation) && textRotation ? { rotation: textRotation } : {}) };
      vertices.set(cell.getAttribute("id") || text.id!, text); imported.push(text); continue;
    }
    const flowchartShape = DRAWIO_FLOWCHART_SHAPES[shape];
    const type: ShapeElement["type"] = shape === "ellipse" || shape === "doubleEllipse" ? "circle" : shape === "rhombus" ? "diamond" : shape === "triangle" ? "triangle" : flowchartShape ? "flowchart" : "rectangle";
    const stroke = safeColor(style.strokeColor, "#374151"); const fill = /^none$/i.test(style.fillColor ?? "") || /^#[\da-f]{6}00$/i.test(style.fillColor ?? "") ? "transparent" : safeColor(style.fillColor, "transparent");
    const opacityValue = Number(style.opacity); const fillOpacityValue = Number(style.fillOpacity); const fontStyle = Number(style.fontStyle) || 0; const rotation = Number(style.rotation ?? geo?.getAttribute("rotation"));
    const element: ShapeElement = { type, id: cell.getAttribute("id") || id("drawio"), x, y, w, h, color: stroke, thickness: clamp(Number(style.strokeWidth) || 2, 0.5, 24), ...(fill === "transparent" ? {} : { fillColor: fill }), ...(Number.isFinite(fillOpacityValue) ? { fillOpacity: clamp(fillOpacityValue / 100, 0, 1) } : {}), opacity: clamp(Number.isFinite(opacityValue) ? opacityValue / 100 : 1, 0, 1), lineStyle: drawioLineStyle(style), ...(type === "flowchart" ? { flowchartShape } : {}), ...(Number.isFinite(rotation) && rotation ? { rotation } : {}), ...(label ? { label: { text: label, color: safeColor(style.fontColor, "#111827"), fontSize: clamp(Number(style.fontSize) || 16, 8, 100), fontFamily: "sans", bold: (fontStyle & 1) !== 0, italic: (fontStyle & 2) !== 0, underline: (fontStyle & 4) !== 0, textAlign: style.align === "left" ? "left" : style.align === "right" ? "right" : "center", listType: "none", verticalAlign: style.verticalAlign === "top" || style.verticalAlign === "bottom" ? style.verticalAlign : "middle" } } : {}) };
    vertices.set(cell.getAttribute("id") || element.id!, element); imported.push(element);
  }
  for (const { cell, style, geo } of pendingEdges) {
    const sourceId = cell.getAttribute("source") ?? ""; const targetId = cell.getAttribute("target") ?? "";
    const sourceElement = vertices.get(sourceId); const targetElement = vertices.get(targetId);
    const sourceBounds = sourceElement && (sourceElement.type === "rectangle" || sourceElement.type === "circle" || sourceElement.type === "diamond" || sourceElement.type === "triangle" || sourceElement.type === "flowchart") ? sourceElement : undefined;
    const targetBounds = targetElement && (targetElement.type === "rectangle" || targetElement.type === "circle" || targetElement.type === "diamond" || targetElement.type === "triangle" || targetElement.type === "flowchart") ? targetElement : undefined;
    const pointNodes = [...(geo?.querySelectorAll("Array > mxPoint") ?? [])]; importedPointCount += pointNodes.length;
    if (importedPointCount > MAX_IMPORTED_POINTS) throw new Error("The draw.io page exceeds the 250,000 point import limit.");
    const offset = cellOffset(cell);
    const points = pointNodes.map(point => ({ x: numberAttr(point, "x", 0) + offset.x, y: numberAttr(point, "y", 0) + offset.y }));
    const label = plainLabel(cell.getAttribute("value") ?? "");
    const sourcePoint = geo?.querySelector(':scope > mxPoint[as="sourcePoint"]'); const targetPoint = geo?.querySelector(':scope > mxPoint[as="targetPoint"]');
    const x = numberAttr(sourcePoint, "x", sourceBounds ? sourceBounds.x + sourceBounds.w / 2 : points[0]?.x ?? 0) + (sourcePoint ? offset.x : 0); const y = numberAttr(sourcePoint, "y", sourceBounds ? sourceBounds.y + sourceBounds.h / 2 : points[0]?.y ?? 0) + (sourcePoint ? offset.y : 0);
    const lastPoint = points[points.length - 1];
    const endX = numberAttr(targetPoint, "x", targetBounds ? targetBounds.x + targetBounds.w / 2 : lastPoint?.x ?? x + 120) + (targetPoint ? offset.x : 0); const endY = numberAttr(targetPoint, "y", targetBounds ? targetBounds.y + targetBounds.h / 2 : lastPoint?.y ?? y + 60) + (targetPoint ? offset.y : 0);
    const type: ShapeElement["type"] = style.endArrow && style.endArrow !== "none" ? "arrow" : "line";
    const anchorToward = (from: ShapeElement, toX: number, toY: number) => { const dx = toX - (from.x + from.w / 2); const dy = toY - (from.y + from.h / 2); return Math.abs(dx) > Math.abs(dy) ? { x: dx > 0 ? 1 : 0, y: 0.5 } : { x: 0.5, y: dy > 0 ? 1 : 0 }; };
    const element: ShapeElement = { type, id: cell.getAttribute("id") || id("drawio-edge"), x, y, w: endX - x, h: endY - y, color: safeColor(style.strokeColor, "#374151"), thickness: clamp(Number(style.strokeWidth) || 2, 0.5, 24), lineStyle: drawioLineStyle(style), startHead: drawioHead(style.startArrow), endHead: drawioHead(style.endArrow), ...(points.length ? { routePoints: points } : {}), ...(sourceBounds ? { startBinding: { elementId: sourceBounds.id!, anchor: anchorToward(sourceBounds, endX, endY) } } : {}), ...(targetBounds ? { endBinding: { elementId: targetBounds.id!, anchor: anchorToward(targetBounds, x, y) } } : {}), ...(label ? { label: { text: label, color: safeColor(style.fontColor, "#374151"), fontSize: clamp(Number(style.fontSize) || 14, 8, 80), fontFamily: "sans", bold: (Number(style.fontStyle) & 1) !== 0, italic: (Number(style.fontStyle) & 2) !== 0, underline: (Number(style.fontStyle) & 4) !== 0, textAlign: style.align === "left" ? "left" : style.align === "right" ? "right" : "center", listType: "none", verticalAlign: "top" } } : {}) };
    imported.push(element);
  }
  if (!imported.length) throw new Error("No supported editable shapes or connectors were found in this draw.io page.");
  const sourceIdToElement = new Map(imported.flatMap(item => item.id ? [[item.id, item] as const] : []));
  const directChildren = new Map<string, Element[]>();
  for (const cell of cells) {
    const parentId = cell.getAttribute("parent"); const sourceId = cell.getAttribute("id");
    if (!parentId || !groupCells.has(parentId) || !sourceId) continue;
    const children = directChildren.get(parentId) ?? []; children.push(cell); directChildren.set(parentId, children);
  }
  const groupChildren = (groupId: string, visiting = new Set<string>()): CanvasElement[] => {
    if (visiting.has(groupId) || visiting.size > 32) return [];
    const nextVisiting = new Set(visiting); nextVisiting.add(groupId);
    return (directChildren.get(groupId) ?? []).flatMap(cell => {
      const childId = cell.getAttribute("id");
      if (!childId) return [];
      if (groupCells.has(childId)) {
        const children = groupChildren(childId, nextVisiting);
        return children.length ? [{ type: "group" as const, id: childId, elements: children }] : [];
      }
      const item = sourceIdToElement.get(childId);
      return item ? [item] : [];
    });
  };
  const consumed = new Set<string>();
  const consumeGroup = (groupId: string, visiting = new Set<string>()) => {
    if (visiting.has(groupId) || visiting.size > 32) return;
    const nextVisiting = new Set(visiting); nextVisiting.add(groupId);
    for (const child of directChildren.get(groupId) ?? []) {
      const childId = child.getAttribute("id");
      if (!childId) continue;
      consumed.add(childId);
      if (groupCells.has(childId)) consumeGroup(childId, nextVisiting);
    }
  };
  for (const groupId of groupCells.keys()) consumeGroup(groupId);
  const grouped = new Map<string, CanvasElement>();
  for (const [groupId] of groupCells) {
    const children = groupChildren(groupId);
    if (children.length) grouped.set(groupId, { type: "group", id: groupId, elements: children });
  }
  const output: CanvasElement[] = [];
  for (const cell of cells) {
    const sourceId = cell.getAttribute("id"); const parentId = cell.getAttribute("parent");
    if (!sourceId || parentId && groupCells.has(parentId) || consumed.has(sourceId)) continue;
    const container = grouped.get(sourceId);
    if (container) output.push(container);
    else {
      const item = sourceIdToElement.get(sourceId);
      if (item) output.push(item);
    }
  }
  return output.length ? output : imported;
}

export type ImportFidelityReport = { kept: number; simplified: number; skipped: number };

/** Import draw.io and report the number of cells preserved closely, simplified, or skipped. */
export async function importDrawioWithReport(source: string): Promise<{ elements: CanvasElement[]; report: ImportFidelityReport }> {
  const elements = await importDrawio(source);
  let parsed = new DOMParser().parseFromString(source, "application/xml");
  let model = parsed.querySelector("mxGraphModel");
  if (!model) {
    const diagram = parsed.querySelector("mxfile > diagram, mxfile diagram");
    const content = diagram?.textContent?.trim() ?? "";
    if (!content.startsWith("<") && content) parsed = new DOMParser().parseFromString(await decodeCompressedDiagram(content), "application/xml");
    else if (diagram) parsed = new DOMParser().parseFromString(diagram.innerHTML, "application/xml");
    model = parsed.querySelector("mxGraphModel");
  }
  const cells = [...(model?.querySelector("root")?.querySelectorAll(":scope > mxCell") ?? [])]
    .filter(cell => cell.getAttribute("vertex") === "1" || cell.getAttribute("edge") === "1");
  const importedIds = new Set<string>();
  const collectImportedIds = (items: CanvasElement[]) => items.forEach(item => { if (item.id) importedIds.add(item.id); if (item.type === "group") collectImportedIds(item.elements); });
  collectImportedIds(elements);
  const groupIds = new Set<string>([...(model?.querySelector("root")?.querySelectorAll(":scope > mxCell[vertex='1']") ?? [])].flatMap(cell => drawioStyle(cell.getAttribute("style") ?? "").shape === "group" && cell.getAttribute("id") ? [cell.getAttribute("id")!] : []));
  const simpleShapes = new Set(["rectangle", "ellipse", "doubleEllipse", "rhombus", "triangle", "hexagon", "cloud", "document", "parallelogram", "cylinder", "callout", "text", "none", "polyline", "image", "group"]);
  let simplified = 0; let recognized = 0;
  for (const cell of cells) {
    if (cell.getAttribute("id") && !importedIds.has(cell.getAttribute("id")!)) continue;
    recognized++;
    const style = drawioStyle(cell.getAttribute("style") ?? "");
    const parentId = cell.getAttribute("parent") ?? "1";
    const nested = parentId !== "1" && !groupIds.has(parentId);
    if (nested || cell.getAttribute("vertex") === "1" && !simpleShapes.has(style.shape ?? "rectangle") && !DRAWIO_FLOWCHART_SHAPES[style.shape ?? ""]) simplified++;
  }
  simplified = Math.min(recognized, simplified);
  const skipped = Math.max(0, cells.length - recognized);
  return { elements, report: { kept: Math.max(0, recognized - simplified), simplified, skipped } };
}

function drawioShape(element: CanvasElement): string {
  if (element.type === "circle") return "ellipse";
  if (element.type === "diamond") return "rhombus";
  if (element.type === "triangle") return "triangle";
  if (element.type === "flowchart") {
    const shapes: Partial<Record<NonNullable<ShapeElement["flowchartShape"]>, string>> = { decision: "rhombus", data: "parallelogram", database: "cylinder", cloud: "cloud", document: "document", hexagon: "hexagon", callout: "callout", terminator: "ellipse" };
    return shapes[element.flowchartShape ?? "process"] ?? "rectangle";
  }
  return "rectangle";
}

/** Export SketchDraw shapes and connectors as editable mxGraph cells in draw.io XML. */
export function exportDrawio(elements: CanvasElement[]): string {
  const groups: Array<{ key: string; element: Extract<CanvasElement, { type: "group" }>; parent?: string }> = [];
  const leaves: Array<{ element: CanvasPrimitive; parent?: string }> = [];
  const collect = (items: CanvasElement[], parent?: string) => items.forEach(element => {
    if (element.hidden) return;
    if (element.type === "group") {
      const key = element.id ?? id("sketchdraw-group");
      groups.push({ key, element, parent }); collect(element.elements, key);
    } else leaves.push({ element, parent });
  });
  collect(elements);
  const visible = leaves.map(item => item.element);
  const cells: string[] = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>'];
  let next = 2;
  const cellIds = new Map<string, string>();
  for (const group of groups) cellIds.set(group.key, String(next++));
  for (const element of visible) if (element.id) cellIds.set(element.id, String(next++));
  const groupBounds = new Map(groups.map(group => [group.key, elementBounds(group.element)] as const));
  const groupCell = (key: string | undefined) => key ? cellIds.get(key) ?? "1" : "1";
  const groupOrigin = (key: string | undefined) => key ? groupBounds.get(key) ?? { x: 0, y: 0, w: 0, h: 0 } : { x: 0, y: 0, w: 0, h: 0 };
  for (const group of groups) {
    const bounds = groupBounds.get(group.key)!; const parentBounds = groupOrigin(group.parent);
    const value = group.element.container?.name ?? "";
    cells.push(`<mxCell id="${cellIds.get(group.key)}" value="${escapeXml(value)}" style="shape=group;" vertex="1" parent="${groupCell(group.parent)}"><mxGeometry x="${bounds.x - parentBounds.x}" y="${bounds.y - parentBounds.y}" width="${Math.max(1, bounds.w)}" height="${Math.max(1, bounds.h)}" as="geometry"/></mxCell>`);
  }
  for (const { element, parent } of leaves) {
    const mxId = element.id ? cellIds.get(element.id)! : String(next++);
    const parentId = groupCell(parent); const offset = groupOrigin(parent);
    const style = externalStyle(element);
    const safeOpacity = Math.round(style.opacity * 100);
    if (element.type === "line" || element.type === "arrow") {
      const source = element.startBinding ? cellIds.get(element.startBinding.elementId) : undefined;
      const target = element.endBinding ? cellIds.get(element.endBinding.elementId) : undefined;
      const points = element.routePoints?.length ? element.routePoints : undefined;
      const pointsXml = points ? `<Array as="points">${points.map(point => `<mxPoint x="${point.x - offset.x}" y="${point.y - offset.y}"/>`).join("")}</Array>` : "";
      const value = element.label ? escapeXml(element.label.text).replace(/\n/g, "&#xa;") : "";
      const dashPattern = element.lineStyle === "dotted" ? "1 2" : "8 4";
      const edgeLabel = element.label;
      const edgeFontStyle = (edgeLabel?.bold ? 1 : 0) + (edgeLabel?.italic ? 2 : 0) + (edgeLabel?.underline ? 4 : 0);
      const edgeStyle = `edgeStyle=none;rounded=0;strokeColor=${escapeXml(style.stroke)};strokeWidth=${style.strokeWidth};opacity=${safeOpacity};dashed=${element.lineStyle === "dashed" || element.lineStyle === "dotted" ? 1 : 0};${element.lineStyle === "solid" ? "" : `dashPattern=${dashPattern};`}startArrow=${mxHead(element.startHead)};endArrow=${mxHead(element.endHead ?? (element.type === "arrow" ? "solid" : "none"))};${edgeLabel ? `fontColor=${escapeXml(edgeLabel.color)};fontSize=${edgeLabel.fontSize};fontStyle=${edgeFontStyle};align=${edgeLabel.textAlign};verticalAlign=${edgeLabel.verticalAlign};` : ""}`;
      const sourcePoint = source ? "" : `<mxPoint x="${element.x - offset.x}" y="${element.y - offset.y}" as="sourcePoint"/>`;
      const targetPoint = target ? "" : `<mxPoint x="${element.x + element.w - offset.x}" y="${element.y + element.h - offset.y}" as="targetPoint"/>`;
      cells.push(`<mxCell id="${mxId}" value="${value}" style="${edgeStyle}" edge="1" parent="${parentId}"${source ? ` source="${source}"` : ""}${target ? ` target="${target}"` : ""}><mxGeometry relative="1" as="geometry">${sourcePoint}${targetPoint}${pointsXml}</mxGeometry></mxCell>`);
      continue;
    }
    if (element.type === "image") {
      const drawioImage = element.dataUrl.replace(/^(data:image\/(?:png|jpeg|webp|gif));base64,/i, "$1,");
      const imageStyle = `shape=image;image=${drawioImage};aspect=fixed;strokeColor=${escapeXml(style.stroke)};strokeWidth=${style.strokeWidth};opacity=${safeOpacity};`;
      cells.push(`<mxCell id="${mxId}" value="" style="${escapeXml(imageStyle)}" vertex="1" parent="${parentId}"><mxGeometry x="${element.x - offset.x}" y="${element.y - offset.y}" width="${element.w}" height="${element.h}" as="geometry"/></mxCell>`);
      continue;
    }
    if (element.type === "freehand") {
      const bounds = pointBounds(element.points);
      const pointsXml = `<Array as="points">${element.points.map(point => `<mxPoint x="${point.x - offset.x}" y="${point.y - offset.y}"/>`).join("")}</Array>`;
      cells.push(`<mxCell id="${mxId}" value="" style="shape=polyline;strokeColor=${escapeXml(style.stroke)};strokeWidth=${style.strokeWidth};fillColor=none;" vertex="1" parent="${parentId}"><mxGeometry x="${bounds.x - offset.x}" y="${bounds.y - offset.y}" width="${bounds.w}" height="${bounds.h}" as="geometry">${pointsXml}</mxGeometry></mxCell>`);
      continue;
    }
    let bounds: { x: number; y: number; w: number; h: number }; let label = ""; let shape = "rectangle"; let color = style.stroke; let fill = style.fill; let fontColor = "#111827"; let fontSize = 16; let bold = false; let italic = false; let underline = false; let align = "center"; let verticalAlign = "middle"; let rotation = 0;
    if (element.type === "schemaTable") { bounds = { x: element.x, y: element.y, w: element.w, h: element.h }; label = [element.name, ...element.columns.map(column => `${column.primaryKey ? "◆ " : ""}${column.name}: ${column.dataType}`)].join("\n"); }
    else if (element.type === "text") { bounds = { x: element.x, y: element.y, w: Math.max(80, element.text.length * element.fontSize * 0.56), h: Math.max(24, element.fontSize * 1.4) }; label = element.text; shape = "text"; color = element.color; fontColor = element.color; fontSize = element.fontSize; bold = !!element.bold; italic = !!element.italic; underline = !!element.underline; align = element.textAlign ?? "left"; rotation = element.rotation ?? 0; }
    else { bounds = { x: element.x, y: element.y, w: element.w, h: element.h }; label = element.label?.text ?? ""; shape = drawioShape(element); fontSize = element.label?.fontSize ?? 16; color = element.color; fontColor = element.label?.color ?? "#111827"; fill = element.fillColor ?? "none"; bold = element.label?.bold ?? false; italic = element.label?.italic ?? false; underline = element.label?.underline ?? false; align = element.label?.textAlign ?? "center"; verticalAlign = element.label?.verticalAlign ?? "middle"; rotation = element.rotation ?? 0; }
    const fillOpacityValue = element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "triangle" || element.type === "flowchart" ? element.fillOpacity : undefined;
    const fillOpacity = fillOpacityValue === undefined ? "" : `fillOpacity=${Math.round(fillOpacityValue * 100)};`;
    const styleString = `shape=${shape};whiteSpace=wrap;html=0;rounded=0;rotation=${rotation};strokeColor=${escapeXml(color)};strokeWidth=${style.strokeWidth};fillColor=${escapeXml(fill === "transparent" ? "none" : fill)};${fillOpacity}opacity=${safeOpacity};fontColor=${escapeXml(fontColor)};fontSize=${fontSize};fontStyle=${(bold ? 1 : 0) + (italic ? 2 : 0) + (underline ? 4 : 0)};align=${align};verticalAlign=${verticalAlign};`;
    cells.push(`<mxCell id="${mxId}" value="${escapeXml(label).replace(/\n/g, "&#xa;")}" style="${styleString}" vertex="1" parent="${parentId}"><mxGeometry x="${bounds.x - offset.x}" y="${bounds.y - offset.y}" width="${bounds.w}" height="${bounds.h}" as="geometry"/></mxCell>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?><mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="SketchDraw" version="24.7.17" type="device"><diagram id="sketchdraw-page" name="Page-1"><mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1200" pageHeight="800" math="0" shadow="0"><root>${cells.join("")}</root></mxGraphModel></diagram></mxfile>`;
}
