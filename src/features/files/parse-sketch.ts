import { SKETCH_FORMAT_VERSION } from "../../model";
import type { ArrowHead, ArrowRoute, Binding, EdgeStyle, Element, FlowchartShape, FontFamily, LayerFlags, LineRoute, NoteKind, Point, SchemaField, ShapeElement, ShapeLabel, SketchFile, SketchPage, StrokeStyle, StrokePoint } from "../../model";
import { validReferences } from "../../operations";
import { curveControlPoints } from "../canvas/geometry";
import { FLOWCHART_SHAPES } from "../diagrams/config";
import { normalizeProjectWorkspace } from "../project/project-data";
import { normalizePersonalLibrary } from "../library/library-data";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isColor(value: unknown): value is string {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value);
}

export function isEmbeddedRasterImage(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z\d+/]+={0,2}$/i.test(value);
}

export function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
const MAX_ELEMENT_DEPTH = 64;
const MAX_ELEMENTS_PER_PAGE = 20_000;
const MAX_DOCUMENT_ELEMENT_NODES = 100_000;
type ElementParseBudget = { remaining: number };

export function normalizeElement(value: unknown): Element | undefined {
  return normalizeElementWithinBudget(value, 0, { remaining: MAX_DOCUMENT_ELEMENT_NODES });
}

function normalizeElementWithinBudget(value: unknown, depth: number, budget: ElementParseBudget): Element | undefined {
  if (depth > MAX_ELEMENT_DEPTH || budget.remaining <= 0) return undefined;
  budget.remaining -= 1;
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.id !== "string" || !value.id || value.id.length > 100) return undefined;
  const flags: LayerFlags = {
    id: value.id,
    hidden: typeof value.hidden === "boolean" ? value.hidden : false,
    locked: typeof value.locked === "boolean" ? value.locked : false,
    rotation: finite(value.rotation) ? value.rotation : 0,
    ...(typeof value.componentId === "string" ? { componentId: value.componentId } : {}),
    ...(typeof value.componentRole === "string" ? { componentRole: value.componentRole } : {}),
  };
  if (value.type === "group") {
    if (!Array.isArray(value.elements) || value.elements.length > MAX_ELEMENTS_PER_PAGE) return undefined;
    const children = value.elements.map(child => normalizeElementWithinBudget(child, depth + 1, budget));
    if (children.some((child) => !child)) return undefined;
    const note = isRecord(value.note) && ["note", "sticky", "checklist"].includes(String(value.note.kind)) && typeof value.note.content === "string" && value.note.content.length <= 50000
      && (value.note.title === undefined || typeof value.note.title === "string" && value.note.title.length <= 120)
      && (value.note.width === undefined || finite(value.note.width) && value.note.width >= 180 && value.note.width <= 4000)
      && (value.note.height === undefined || finite(value.note.height) && value.note.height >= 100 && value.note.height <= 1_000_000)
      && (value.note.fontSize === undefined || finite(value.note.fontSize) && value.note.fontSize >= 8 && value.note.fontSize <= 32)
      && (value.note.collapsed === undefined || typeof value.note.collapsed === "boolean")
      ? { kind: value.note.kind as NoteKind, content: value.note.content, ...(typeof value.note.title === "string" ? { title: value.note.title } : {}), ...(finite(value.note.width) ? { width: value.note.width } : {}), ...(finite(value.note.height) ? { height: value.note.height } : {}), ...(finite(value.note.fontSize) ? { fontSize: Math.round(value.note.fontSize) } : {}), ...(typeof value.note.collapsed === "boolean" ? { collapsed: value.note.collapsed } : {}) } : undefined;
    const mermaid = isRecord(value.mermaid) && typeof value.mermaid.source === "string" && value.mermaid.source.length <= 100_000
      ? { source: value.mermaid.source } : undefined;
    if ((value.note !== undefined && !note) || (value.mermaid !== undefined && !mermaid) || (note && mermaid)) return undefined;
    return { type: "group", ...flags, elements: children as Element[], note, mermaid };
  }
  if (value.type === "freehand") {
    if (!Array.isArray(value.points) || !value.points.every((point) => isRecord(point) && finite(point.x) && finite(point.y)) || !isColor(value.color) || !finite(value.thickness) || value.thickness <= 0) return undefined;
    const thickness = Math.max(1, Math.round(value.thickness));
    const points: StrokePoint[] = value.points.map((point) => ({ x: (point as Record<string, unknown>).x as number, y: (point as Record<string, unknown>).y as number, ...(finite((point as Record<string, unknown>).pressure) ? { pressure: Math.max(0, Math.min(1, (point as Record<string, unknown>).pressure as number)) } : {}), ...(finite((point as Record<string, unknown>).tiltX) ? { tiltX: Math.max(-90, Math.min(90, (point as Record<string, unknown>).tiltX as number)) } : {}), ...(finite((point as Record<string, unknown>).tiltY) ? { tiltY: Math.max(-90, Math.min(90, (point as Record<string, unknown>).tiltY as number)) } : {}) }));
    return { type: "freehand", ...flags, points, color: value.color, thickness, opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1 };
  }
  if (value.type === "text") {
    if (!finite(value.x) || !finite(value.y) || typeof value.text !== "string" || !isColor(value.color) || !finite(value.fontSize) || value.fontSize < 8) return undefined;
    const fontFamily: FontFamily = ["hand", "serif", "mono"].includes(String(value.fontFamily)) ? value.fontFamily as FontFamily : "sans";
    const textAlign = value.textAlign === "center" || value.textAlign === "right" || value.textAlign === "justify" ? value.textAlign : "left";
    const listType = value.listType === "bullet" || value.listType === "number" ? value.listType : "none";
    return { type: "text", ...flags, x: value.x, y: value.y, text: value.text, color: value.color, fontSize: Math.round(value.fontSize), fontFamily, bold: value.bold === true, italic: value.italic === true, underline: value.underline === true, textAlign, listType, opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1 };
  }
  if (value.type === "image") {
    if (!finite(value.x) || !finite(value.y) || !finite(value.w) || value.w <= 0 || !finite(value.h) || value.h <= 0 || !isEmbeddedRasterImage(value.dataUrl) || !finite(value.sourceWidth) || value.sourceWidth <= 0 || !finite(value.sourceHeight) || value.sourceHeight <= 0) return undefined;
    const cropX = finite(value.cropX) ? value.cropX : 0; const cropY = finite(value.cropY) ? value.cropY : 0;
    const cropW = finite(value.cropW) ? value.cropW : value.sourceWidth; const cropH = finite(value.cropH) ? value.cropH : value.sourceHeight;
    if (cropX < 0 || cropY < 0 || cropW <= 0 || cropH <= 0 || cropX + cropW > value.sourceWidth || cropY + cropH > value.sourceHeight) return undefined;
    return { type: "image", ...flags, x: value.x, y: value.y, w: value.w, h: value.h, dataUrl: value.dataUrl, sourceWidth: value.sourceWidth, sourceHeight: value.sourceHeight, cropX, cropY, cropW, cropH, opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1 };
  }
  if (value.type === "schemaTable") {
    if (!finite(value.x) || !finite(value.y) || !finite(value.w) || value.w < 120 || !finite(value.h) || value.h < 45 || typeof value.name !== "string" || !value.name.trim() || value.name.length > 200 || typeof value.schemaDiagramId !== "string" || !value.schemaDiagramId || typeof value.schemaSource !== "string" || value.schemaSource.length > 500_000 || !Array.isArray(value.columns) || !value.columns.length || value.columns.length > 500) return undefined;
    const columns: SchemaField[] = [];
    for (let index = 0; index < value.columns.length; index++) {
      const raw = value.columns[index];
      if (!isRecord(raw) || typeof raw.name !== "string" || !raw.name.trim() || raw.name.length > 200 || typeof raw.dataType !== "string" || raw.dataType.length > 200) return undefined;
      const id = typeof raw.id === "string" && raw.id.length <= 100 ? raw.id : `${value.id}:column:${index}`;
      columns.push({ id, name: raw.name, dataType: raw.dataType, primaryKey: raw.primaryKey === true, foreignTable: typeof raw.foreignTable === "string" ? raw.foreignTable.slice(0, 200) : undefined, foreignColumn: typeof raw.foreignColumn === "string" ? raw.foreignColumn.slice(0, 200) : undefined, nullable: raw.nullable !== false });
    }
    const fontSize = finite(value.fontSize) ? Math.max(8, Math.min(48, Math.round(value.fontSize))) : 14; const neededHeight = Math.max(42, fontSize * 2.8) + columns.length * Math.max(30, fontSize * 1.8);
    const neededWidth = Math.max(180, ...columns.map(column => (column.name.length + (column.dataType ?? "type").length) * fontSize * .36 + 80));
    return { type: "schemaTable", ...flags, x: value.x, y: value.y, w: Math.max(value.w, neededWidth), h: Math.max(value.h, neededHeight), name: value.name, columns, schemaDiagramId: value.schemaDiagramId, schemaSource: value.schemaSource, fontSize, opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1 };
  }
  if (["rectangle", "circle", "diamond", "triangle", "flowchart", "line", "arrow"].includes(value.type)) {
    if (!finite(value.x) || !finite(value.y) || !finite(value.w) || !finite(value.h) || !isColor(value.color) || !finite(value.thickness) || value.thickness <= 0) return undefined;
    if (value.schemaDiagramId !== undefined && typeof value.schemaDiagramId !== "string") return undefined;
    const lineStyle: StrokeStyle = ["dashed", "dotted", "double"].includes(String(value.lineStyle)) ? value.lineStyle as StrokeStyle : "solid";
    const edgeStyle: EdgeStyle = ["rounded", "pill", "cut"].includes(String(value.edgeStyle)) ? value.edgeStyle as EdgeStyle : "sharp";
    const fillColor = isColor(value.fillColor) ? value.fillColor : undefined;
    const fillOpacity = finite(value.fillOpacity) ? Math.max(0, Math.min(1, value.fillOpacity)) : 0.2;
    const validHead = (head: unknown): head is ArrowHead => ["none", "open", "solid", "thick", "dot", "diamond", "bar"].includes(String(head));
    const flowchartShape: FlowchartShape = FLOWCHART_SHAPES.some(shape => shape.value === value.flowchartShape) ? value.flowchartShape as FlowchartShape : "process";
    const lineRoute: LineRoute = ["curve", "curve2", "curve3", "multi"].includes(String(value.lineRoute)) ? value.lineRoute as LineRoute : "straight";
    const thickness = Math.max(1, Math.round(value.thickness));
    const cornerRadius = finite(value.cornerRadius) ? Math.max(0, Math.min(100, value.cornerRadius)) : undefined;
    const arrowRoute: ArrowRoute = ["elbow", "forked", "loop", "jagged"].includes(String(value.arrowRoute)) ? value.arrowRoute as ArrowRoute : "straight";
    const binding = (raw: unknown): Binding | undefined => isRecord(raw) && typeof raw.elementId === "string" && isRecord(raw.anchor) && finite(raw.anchor.x) && finite(raw.anchor.y) && raw.anchor.x >= 0 && raw.anchor.x <= 1 && raw.anchor.y >= 0 && raw.anchor.y <= 1 && (raw.rowId === undefined || typeof raw.rowId === "string") ? { elementId: raw.elementId, anchor: { x: raw.anchor.x, y: raw.anchor.y }, ...(typeof raw.rowId === "string" ? { rowId: raw.rowId } : {}) } : undefined;
    if ((value.startBinding && !binding(value.startBinding)) || (value.endBinding && !binding(value.endBinding))) return undefined;
    const forkBranch = (raw: unknown) => {
      if (raw === undefined) return undefined;
      if (!isRecord(raw)) return null;
      const end = raw.end === undefined ? undefined : isRecord(raw.end) && finite(raw.end.x) && finite(raw.end.y) ? { x: raw.end.x, y: raw.end.y } : null;
      const routePoints = raw.routePoints === undefined ? undefined : Array.isArray(raw.routePoints) && raw.routePoints.length <= 100 && raw.routePoints.every(p => isRecord(p) && finite(p.x) && finite(p.y)) ? raw.routePoints as Point[] : null;
      const endBinding = raw.endBinding === undefined ? undefined : binding(raw.endBinding) ?? null;
      if (end === null || routePoints === null || endBinding === null) return null;
      if (raw.endHead !== undefined && !validHead(raw.endHead)) return null;
      return { end, routePoints, endHead: raw.endHead as ArrowHead | undefined, endBinding: endBinding as Binding | undefined };
    };
    const forkUpper = forkBranch(value.forkUpper); const forkLower = forkBranch(value.forkLower);
    if (forkUpper === null || forkLower === null) return undefined;
    if (value.routePoints !== undefined && (!Array.isArray(value.routePoints) || value.routePoints.length > 100 || !value.routePoints.every(p => isRecord(p) && finite(p.x) && finite(p.y)))) return undefined;
    if (value.routeWaypoints !== undefined && (!Array.isArray(value.routeWaypoints) || value.routeWaypoints.length > 100 || !value.routeWaypoints.every(p => isRecord(p) && finite(p.x) && finite(p.y)))) return undefined;
    const labelText = value.label === undefined ? undefined : normalizeElementWithinBudget({ ...(isRecord(value.label) ? value.label : {}), type: "text", id: "label", x: 0, y: 0 }, depth + 1, budget);
    if (value.label !== undefined && labelText?.type !== "text") return undefined;
    const label: ShapeLabel | undefined = labelText?.type === "text" ? { ...labelText, verticalAlign: isRecord(value.label) && (value.label.verticalAlign === "top" || value.label.verticalAlign === "bottom") ? value.label.verticalAlign : "middle" } : undefined;
    const storedRoutePoints = value.routePoints as Point[] | undefined;
    const autoRoute = (value.type === "line" || value.type === "arrow") && value.autoRoute === true;
    const x = value.x as number; const y = value.y as number; const w = value.w as number; const h = value.h as number;
    const controlBase: ShapeElement = { type: "line", x, y, w, h, color: value.color as string, thickness, lineRoute };
    const normalizedRoutePoints = autoRoute ? storedRoutePoints : value.type !== "line" ? storedRoutePoints
      : lineRoute === "multi" ? [0.2, 0.4, 0.6, 0.8].map((ratio, index) => storedRoutePoints?.[index] ?? { x: x + w * ratio, y: y + h * ratio })
      : ["curve", "curve2", "curve3"].includes(lineRoute) ? curveControlPoints(controlBase, lineRoute).map((point, index) => storedRoutePoints?.[index] ?? point)
      : storedRoutePoints;
    return { type: value.type as ShapeElement["type"], ...flags, startBinding: binding(value.startBinding), endBinding: binding(value.endBinding), routePoints: normalizedRoutePoints, ...(autoRoute ? { autoRoute: true, routeWaypoints: value.routeWaypoints as Point[] | undefined } : {}), forkUpper: forkUpper ?? undefined, forkLower: forkLower ?? undefined, label, x: value.x, y: value.y, w: value.w, h: value.h, color: value.color, thickness, fillColor, fillOpacity, lineStyle, edgeStyle, cornerRadius, flowchartShape: value.type === "flowchart" ? flowchartShape : undefined, lineRoute: value.type === "line" ? lineRoute : undefined, arrowRoute: value.type === "arrow" ? arrowRoute : undefined, startHead: value.type === "arrow" || value.type === "line" ? validHead(value.startHead) ? value.startHead : "none" : undefined, endHead: value.type === "arrow" || value.type === "line" ? validHead(value.endHead) ? value.endHead : value.type === "arrow" ? "open" : "none" : undefined, opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1, ...(typeof value.schemaDiagramId === "string" ? { schemaDiagramId: value.schemaDiagramId } : {}) };
  }
  return undefined;
}

export function parseSketchFile(value: unknown): SketchFile | undefined {
  if (!isRecord(value) || value.format !== "SketchDraw") return undefined;
  const version = Number(value.version);
  const sections = isRecord(value.sections) ? value.sections : undefined;
  if (sections && (!isRecord(sections.canvas) || !isRecord(sections.planning) || !isRecord(sections.library))) return undefined;
  const canvasSection = sections ? sections.canvas as Record<string, unknown> : value;
  const planningValue = sections ? sections.planning : value.project;
  const libraryValue = sections ? sections.library : value.library;
  const addLegacyElementIds = (item: unknown, depth = 0, budget: ElementParseBudget = { remaining: MAX_DOCUMENT_ELEMENT_NODES }): unknown => {
    if (!isRecord(item)) return item;
    if (depth > MAX_ELEMENT_DEPTH || budget.remaining <= 0) return {};
    budget.remaining -= 1;
    const next: Record<string, unknown> = { ...item, id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID() };
    if (Array.isArray(item.elements)) {
      if (item.elements.length > MAX_ELEMENTS_PER_PAGE) return {};
      next.elements = item.elements.map(child => addLegacyElementIds(child, depth + 1, budget));
    }
    return next;
  };
  const normalizePage = (id: unknown, name: unknown, stateValue: unknown, elementsValue: unknown, legacy: boolean, budget: ElementParseBudget): SketchPage | undefined => {
    if (typeof id !== "string" || typeof name !== "string" || !isRecord(stateValue) || !Array.isArray(elementsValue) || elementsValue.length > MAX_ELEMENTS_PER_PAGE) return undefined;
    const state = stateValue;
    if (!finite(state.zoom) || state.zoom <= 0 || !finite(state.panX) || !finite(state.panY) || !isColor(state.backgroundColor)) return undefined;
    const legacyBudget = { remaining: MAX_DOCUMENT_ELEMENT_NODES };
    const elements = elementsValue.map(element => normalizeElementWithinBudget(legacy ? addLegacyElementIds(element, 0, legacyBudget) : element, 0, budget));
    if (elements.some((element) => !element) || !validReferences(elements as Element[])) return undefined;
    return { id, name: name.slice(0, 80), canvasState: { zoom: state.zoom, panX: state.panX, panY: state.panY, backgroundColor: state.backgroundColor, boardColorFollowsTheme: typeof state.boardColorFollowsTheme === "boolean" ? state.boardColorFollowsTheme : state.backgroundColor === "#ffffff" }, elements: elements as Element[] };
  };
  const sourcePages = Array.isArray(canvasSection.pages) ? canvasSection.pages : Array.isArray(canvasSection.elements) ? [{ id: crypto.randomUUID(), name: "Page 1", canvasState: canvasSection.canvasState, elements: canvasSection.elements }] : undefined;
  if (!sourcePages || sourcePages.length < 1 || sourcePages.length > 100 || !Number.isInteger(version) || version < 1 || version > SKETCH_FORMAT_VERSION || (sections && version < 8)) return undefined;
  const elementBudget = { remaining: MAX_DOCUMENT_ELEMENT_NODES };
  const pages = sourcePages.map((page, index) => {
    if (!isRecord(page)) return undefined;
    const state = isRecord(page.canvasState) ? page.canvasState : {};
    const migratedState = version < SKETCH_FORMAT_VERSION ? { zoom: finite(state.zoom) && state.zoom > 0 ? state.zoom : 1, panX: finite(state.panX) ? state.panX : 0, panY: finite(state.panY) ? state.panY : 0, backgroundColor: isColor(state.backgroundColor) ? state.backgroundColor : "#ffffff", ...(typeof state.boardColorFollowsTheme === "boolean" ? { boardColorFollowsTheme: state.boardColorFollowsTheme } : {}) } : state;
    return normalizePage(typeof page.id === "string" ? page.id : crypto.randomUUID(), typeof page.name === "string" ? page.name : "Page " + (index + 1), migratedState, page.elements, version < 6, elementBudget);
  });
  if (pages.some((page) => !page)) return undefined;
  const normalized = pages as SketchPage[];
  if (new Set(normalized.map((page) => page.id)).size !== normalized.length) return undefined;
  const requestedPageId = canvasSection.activePageId;
  const activePageId = normalized.some((page) => page.id === requestedPageId) ? String(requestedPageId) : normalized[0].id;
  const sync = isRecord(value.windowsSync) ? value.windowsSync : undefined;
  const validClockMap = (raw: unknown) => {
    if (!isRecord(raw) || Object.keys(raw).length > 100_000) return {};
    return Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, number] => entry[0].length <= 240 && finite(entry[1]) && entry[1] >= 0));
  };
  const windowsSync = sync?.version === 1 && finite(sync.updatedAt) && sync.updatedAt >= 0 && typeof sync.deviceId === "string" && sync.deviceId.length <= 100
    ? { version: 1 as const, updatedAt: sync.updatedAt, deviceId: sync.deviceId, clocks: validClockMap(sync.clocks), tombstones: validClockMap(sync.tombstones) }
    : undefined;
  const project = planningValue === undefined ? undefined : normalizeProjectWorkspace(planningValue);
  if (planningValue !== undefined && !project) return undefined;
  const library = normalizePersonalLibrary(libraryValue, sections ? undefined : value.project);
  if (!library) return undefined;
  return { format: "SketchDraw", version: SKETCH_FORMAT_VERSION, activePageId, pages: normalized, ...(project ? { project } : {}), library, ...(windowsSync ? { windowsSync } : {}) };
}
