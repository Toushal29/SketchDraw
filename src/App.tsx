import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from "solid-js";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, readTextFile, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import sketchDrawMark from "../icons/sketchdraw-mark.svg";

type Point = { x: number; y: number };
type ArrowHead = "none" | "open" | "solid" | "thick" | "dot" | "diamond" | "bar";
type FlowchartShape = "process" | "terminator" | "decision" | "data" | "document" | "database" | "predefined-process" | "preparation" | "manual-input";
type ArrowRoute = "straight" | "elbow" | "forked" | "loop" | "jagged";
type LineRoute = "straight" | "curve";
type StrokeStyle = "solid" | "dashed" | "dotted" | "double";
type LayerFlags = { hidden?: boolean; locked?: boolean; rotation?: number };
type FreehandElement = LayerFlags & { type: "freehand"; points: Point[]; color: string; thickness: number; opacity?: number };
type ShapeElement = LayerFlags & { type: "rectangle" | "circle" | "diamond" | "flowchart" | "line" | "arrow"; x: number; y: number; w: number; h: number; color: string; thickness: number; fillColor?: string; fillOpacity?: number; opacity?: number; lineStyle?: StrokeStyle; edgeStyle?: "sharp" | "rounded"; flowchartShape?: FlowchartShape; lineRoute?: LineRoute; arrowRoute?: ArrowRoute; startHead?: ArrowHead; endHead?: ArrowHead };
type TextElement = LayerFlags & { type: "text"; x: number; y: number; text: string; color: string; fontSize: number; fontFamily?: "sans" | "hand"; bold?: boolean; italic?: boolean; underline?: boolean; textAlign?: "left" | "center" | "right"; listType?: "none" | "bullet" | "number"; opacity?: number };
type ImageElement = LayerFlags & { type: "image"; x: number; y: number; w: number; h: number; dataUrl: string; sourceWidth?: number; sourceHeight?: number; cropX?: number; cropY?: number; cropW?: number; cropH?: number; opacity?: number };
type GroupElement = LayerFlags & { type: "group"; elements: Element[] };
type Element = FreehandElement | ShapeElement | TextElement | ImageElement | GroupElement;
type Tool = "select" | "pan" | "pen" | "rectangle" | "circle" | "diamond" | "flowchart" | "line" | "arrow" | "text" | "bucket" | "eraser" | "crop";
type CanvasState = { zoom: number; panX: number; panY: number; backgroundColor: string; boardColorFollowsTheme?: boolean };
type SketchPage = { id: string; name: string; canvasState: CanvasState; elements: Element[] };
type SketchFile = { format: "SketchDraw"; version: 4; activePageId: string; pages: SketchPage[] };
type Preview = { type: Exclude<Tool, "select" | "pan" | "text" | "bucket" | "eraser" | "crop">; start: Point; end: Point; color: string; thickness: number; flowchartShape?: FlowchartShape; lineRoute?: LineRoute; arrowRoute?: ArrowRoute };
type Bounds = { x: number; y: number; w: number; h: number };
type TextDraft = { x: number; y: number; value: string; editingIndex?: number; color: string; opacity: number; fontSize: number; fontFamily: "sans" | "hand"; bold: boolean; italic: boolean; underline: boolean; textAlign: "left" | "center" | "right"; listType: "none" | "bullet" | "number" };
type Theme = "light" | "dark";
type ThemeMode = Theme | "system";

const GRID_SIZE = 24;
const BOARD_COLORS = ["#ffffff", "#fffdf7", "#f4f7fb", "#fbf2ed", "#f1f5ed", "#f3f0fa"];
const FILL_SWATCHES = ["#f4a6a0", "#ffd166", "#b7e4c7", "#a8dadc", "#a0c4ff", "#cdb4db"];
const FLOWCHART_SHAPES: { value: FlowchartShape; label: string; path: string }[] = [
  { value: "process", label: "Process", path: "M5 5h14v14H5z" }, { value: "terminator", label: "Terminator", path: "M8 5h8a7 7 0 0 1 0 14H8A7 7 0 0 1 8 5z" },
  { value: "decision", label: "Decision", path: "m12 3 9 9-9 9-9-9z" }, { value: "data", label: "Input / Output", path: "m8 5h13l-5 14H3z" },
  { value: "document", label: "Document", path: "M5 5h14v12q-4-4-7 0t-7 0z" }, { value: "database", label: "Database", path: "M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3v10c0 1.7-3.6 3-8 3s-8-1.3-8-3V7m0 0c0 1.7 3.6 3 8 3s8-1.3 8-3" },
  { value: "predefined-process", label: "Predefined process", path: "M6 5h12v14H6zM9 5v14m6-14v14" }, { value: "preparation", label: "Preparation", path: "M7 5h10l5 7-5 7H7l-5-7z" },
  { value: "manual-input", label: "Manual input", path: "m4 8 3-3h13v14H4z" },
];
const ARROW_ROUTES: { value: ArrowRoute; label: string; path: string }[] = [
  { value: "straight", label: "Straight", path: "M3 12h17m-6-6 6 6-6 6" }, { value: "elbow", label: "Elbow", path: "M4 5v14h15m-6-6 6 6-6 6" },
  { value: "forked", label: "Forked", path: "M3 12h8m0 0V5h9m-4-3 4 3-4 3m-5 4v7h9m-4-3 4 3-4 3" },
  { value: "loop", label: "Loop", path: "M4 17c0-10 16-10 16 0m-6-4 6 4-6 4" }, { value: "jagged", label: "Jagged", path: "M3 12h4l3-5 4 10 3-5h3m-4-4 4 4-4 4" },
];
const LINE_ROUTES: { value: LineRoute; label: string; path: string }[] = [
  { value: "straight", label: "Straight", path: "M4 19 20 5" }, { value: "curve", label: "Curve", path: "M4 18c4-13 12 13 16-12" },
];
const ARROW_HEADS: { value: ArrowHead; label: string }[] = [
  { value: "none", label: "None" }, { value: "open", label: "Open" }, { value: "solid", label: "Solid" },
  { value: "thick", label: "Thick" }, { value: "dot", label: "Dot" }, { value: "diamond", label: "Diamond" }, { value: "bar", label: "Bar" },
];
function arrowHeadPoints(tip: Point, angle: number, type: ArrowHead, thickness: number): Point[] {
  const length = Math.max(10, thickness * (type === "thick" ? 5 : 3.5));
  const pointAt = (distance: number, rotation: number): Point => ({ x: tip.x + Math.cos(angle + rotation) * distance, y: tip.y + Math.sin(angle + rotation) * distance });
  if (type === "solid" || type === "thick") return [tip, pointAt(length, Math.PI - Math.PI / (type === "thick" ? 4 : 6)), pointAt(length, Math.PI + Math.PI / (type === "thick" ? 4 : 6))];
  if (type === "diamond") return [tip, pointAt(length * .55, Math.PI - .45), pointAt(length, Math.PI), pointAt(length * .55, Math.PI + .45)];
  if (type === "open" || type === "bar") return type === "bar" ? [pointAt(length * .45, Math.PI / 2), pointAt(length * .45, -Math.PI / 2)] : [pointAt(length, Math.PI - Math.PI / 6), pointAt(length, Math.PI + Math.PI / 6)];
  return [];
}
function pointInPolygon(point: Point, points: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]; const b = points[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function ArrowHeadIcon(props: { kind: ArrowHead }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h12" />{props.kind === "open" && <path d="m12 7 5 5-5 5" />}{props.kind === "solid" && <path d="m12 7 6 5-6 5z" fill="currentColor" />}{props.kind === "thick" && <path d="m10 5 9 7-9 7z" fill="currentColor" />}{props.kind === "dot" && <circle cx="17" cy="12" r="3" fill="currentColor" />}{props.kind === "diamond" && <path d="m17 7 5 5-5 5-5-5z" fill="currentColor" />}{props.kind === "bar" && <path d="M17 6v12" />}</svg>;
}
function traceFlowchart(ctx: CanvasRenderingContext2D, shape: FlowchartShape, x: number, y: number, w: number, h: number) {
  const left = Math.min(x, x + w); const top = Math.min(y, y + h); const width = Math.abs(w); const height = Math.abs(h); const right = left + width; const bottom = top + height; const mid = (left + right) / 2;
  ctx.beginPath();
  if (width < 1 || height < 1) { ctx.rect(left, top, width, height); return; }
  if (shape === "process") ctx.rect(left, top, width, height);
  else if (shape === "terminator") { if (typeof ctx.roundRect === "function") ctx.roundRect(left, top, width, height, Math.min(height / 2, width / 2)); else ctx.ellipse(mid, top + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2); }
  else if (shape === "decision") { ctx.moveTo(mid, top); ctx.lineTo(right, top + height / 2); ctx.lineTo(mid, bottom); ctx.lineTo(left, top + height / 2); ctx.closePath(); }
  else if (shape === "data") { const inset = Math.min(width * .22, height * .42); ctx.moveTo(left + inset, top); ctx.lineTo(right, top); ctx.lineTo(right - inset, bottom); ctx.lineTo(left, bottom); ctx.closePath(); }
  else if (shape === "document") { ctx.moveTo(left, top); ctx.lineTo(right, top); ctx.lineTo(right, bottom - height * .14); ctx.bezierCurveTo(right - width * .28, bottom - height * .32, left + width * .28, bottom - height * .01, left, bottom - height * .14); ctx.closePath(); }
  else if (shape === "database") {
    // Use explicit cubic curves rather than ellipse() here. The cylinder is
    // redrawn for every preview/zoom frame; a self-contained path avoids the
    // database's extra rim arc affecting the following canvas operation.
    const ry = Math.min(height * .18, width * .25); const rx = width / 2; const k = .55228475;
    ctx.moveTo(left, top + ry);
    ctx.bezierCurveTo(left, top + ry - k * ry, mid - k * rx, top, mid, top);
    ctx.bezierCurveTo(mid + k * rx, top, right, top + ry - k * ry, right, top + ry);
    ctx.lineTo(right, bottom - ry);
    ctx.bezierCurveTo(right, bottom - ry + k * ry, mid + k * rx, bottom, mid, bottom);
    ctx.bezierCurveTo(mid - k * rx, bottom, left, bottom - ry + k * ry, left, bottom - ry);
    ctx.closePath();
  }
  else if (shape === "predefined-process") { const inset = Math.min(width * .18, 12); ctx.rect(left, top, width, height); ctx.moveTo(left + inset, top); ctx.lineTo(left + inset, bottom); ctx.moveTo(right - inset, top); ctx.lineTo(right - inset, bottom); }
  else if (shape === "preparation") { const inset = Math.min(width * .2, 18); ctx.moveTo(left + inset, top); ctx.lineTo(right - inset, top); ctx.lineTo(right, top + height / 2); ctx.lineTo(right - inset, bottom); ctx.lineTo(left + inset, bottom); ctx.lineTo(left, top + height / 2); ctx.closePath(); }
  else { const inset = Math.min(width * .22, height * .45); ctx.moveTo(left + inset, top); ctx.lineTo(right, top); ctx.lineTo(right, bottom); ctx.lineTo(left, bottom); ctx.closePath(); }
}
function traceFlowchartDetails(ctx: CanvasRenderingContext2D, shape: FlowchartShape, x: number, y: number, w: number, h: number) {
  if (shape !== "database") return;
  const left = Math.min(x, x + w); const top = Math.min(y, y + h); const width = Math.abs(w); const height = Math.abs(h);
  if (width < 1 || height < 1) return;
  const rim = flowchartDatabaseRimPath(left, top, width, height);
  // Rendering uses a Path2D so the rim never replaces the current canvas path.
  ctx.save();
  ctx.stroke(rim);
  ctx.restore();
}
function flowchartDatabaseRimPath(left: number, top: number, width: number, height: number): Path2D {
  const ry = Math.min(height * .18, width * .25); const mid = left + width / 2; const right = left + width; const rx = width / 2; const k = .55228475;
  const rim = new Path2D();
  rim.moveTo(left, top + ry);
  rim.bezierCurveTo(left, top + ry + k * ry, mid - k * rx, top + 2 * ry, mid, top + 2 * ry);
  rim.bezierCurveTo(mid + k * rx, top + 2 * ry, right, top + ry + k * ry, right, top + ry);
  return rim;
}
function connectorControls(element: ShapeElement, loop = false) {
  const start = { x: element.x, y: element.y }; const end = { x: element.x + element.w, y: element.y + element.h };
  const dx = end.x - start.x; const dy = end.y - start.y; const length = Math.max(1, Math.hypot(dx, dy)); const normal = { x: -dy / length, y: dx / length };
  const bend = (loop ? .72 : .3) * length;
  return { start, end, dx, dy, c1: { x: start.x + dx / 3 + normal.x * bend, y: start.y + dy / 3 + normal.y * bend }, c2: { x: start.x + dx * 2 / 3 + normal.x * bend, y: start.y + dy * 2 / 3 + normal.y * bend }, normal };
}
function forkGeometry(element: ShapeElement) {
  const { start, end, dx, dy, normal } = connectorControls(element);
  const length = Math.max(1, Math.hypot(dx, dy)); const spread = Math.min(18, length * .14);
  const junction = { x: start.x + dx * .62, y: start.y + dy * .62 };
  const upper = { x: end.x + normal.x * spread, y: end.y + normal.y * spread };
  const lower = { x: end.x - normal.x * spread, y: end.y - normal.y * spread };
  return { start, end, junction, upper, lower, normal };
}
function jaggedVertices(element: ShapeElement): Point[] {
  const { start, end, normal } = connectorControls(element); const length = Math.hypot(element.w, element.h); const amplitude = Math.min(18, length * .13);
  return [start, ...[.2, .4, .6, .8].map((t, index) => ({ x: start.x + element.w * t + normal.x * amplitude * (index % 2 ? -1 : 1), y: start.y + element.h * t + normal.y * amplitude * (index % 2 ? -1 : 1) })), end];
}
function connectorPolylines(element: ShapeElement, route: ArrowRoute | LineRoute, sampleCount = 49): Point[][] {
  const key = `${route}:${sampleCount}`; const cache = connectorCache.get(element); const existing = cache?.get(key); if (existing) return existing;
  const points = route === "forked"
    ? (() => { const fork = forkGeometry(element); return [[fork.start, fork.junction], [fork.junction, fork.upper], [fork.junction, fork.lower]]; })()
    : route === "jagged" ? [jaggedVertices(element)]
      : [Array.from({ length: sampleCount }, (_, index) => connectorPoint(element, route, index / (sampleCount - 1)))];
  if (cache) cache.set(key, points); else connectorCache.set(element, new Map([[key, points]]));
  return points;
}
function arrowHeadEntries(element: ShapeElement, route: ArrowRoute): { tip: Point; angle: number; kind: ArrowHead }[] {
  const fork = route === "forked" ? forkGeometry(element) : undefined;
  const entries: { tip: Point; angle: number; kind: ArrowHead }[] = [];
  if ((element.startHead ?? "none") !== "none") {
    const start = fork?.start ?? { x: element.x, y: element.y };
    const angle = fork ? Math.atan2(fork.junction.y - start.y, fork.junction.x - start.x) + Math.PI : connectorTangent(element, route, false) + Math.PI;
    entries.push({ tip: start, angle, kind: element.startHead ?? "none" });
  }
  if (fork) {
    const kind = element.endHead ?? "open";
    for (const tip of [fork.upper, fork.lower]) entries.push({ tip, angle: Math.atan2(tip.y - fork.junction.y, tip.x - fork.junction.x), kind });
  } else {
    entries.push({ tip: { x: element.x + element.w, y: element.y + element.h }, angle: connectorTangent(element, route, true), kind: element.endHead ?? "open" });
  }
  return entries;
}
function connectorPoint(element: ShapeElement, route: ArrowRoute | LineRoute, t: number): Point {
  const { start, end, c1, c2 } = connectorControls(element, route === "loop");
  if (route === "elbow") { const middle = { x: end.x, y: start.y }; return t < .5 ? { x: start.x + (middle.x - start.x) * t * 2, y: start.y } : { x: middle.x, y: middle.y + (end.y - middle.y) * (t - .5) * 2 }; }
  if (route === "jagged") { const points = jaggedVertices(element); const scaled = t * (points.length - 1); const segment = Math.min(points.length - 2, Math.floor(scaled)); const local = scaled - segment; return { x: points[segment].x + (points[segment + 1].x - points[segment].x) * local, y: points[segment].y + (points[segment + 1].y - points[segment].y) * local }; }
  if (route === "curve" || route === "loop") { const u = 1 - t; if (route === "loop") return { x: u ** 3 * start.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * end.x, y: u ** 3 * start.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * end.y }; return { x: u * u * start.x + 2 * u * t * c1.x + t * t * end.x, y: u * u * start.y + 2 * u * t * c1.y + t * t * end.y }; }
  return { x: start.x + element.w * t, y: start.y + element.h * t };
}
function connectorTangent(element: ShapeElement, route: ArrowRoute, atEnd: boolean): number {
  if (route === "straight" || route === "forked") return Math.atan2(element.h, element.w);
  if (route === "elbow") return atEnd ? Math.PI / 2 * Math.sign(element.h || 1) : element.w < 0 ? Math.PI : 0;
  const before = connectorPoint(element, route, atEnd ? .99 : .01); const after = connectorPoint(element, route, atEnd ? 1 : .02);
  return Math.atan2(after.y - before.y, after.x - before.x);
}
function traceConnector(ctx: CanvasRenderingContext2D, element: ShapeElement) {
  const route: ArrowRoute | LineRoute = element.type === "arrow" ? element.arrowRoute ?? "straight" : element.lineRoute ?? "straight";
  const { start, end, c1, c2 } = connectorControls(element, route === "loop");
  ctx.beginPath(); ctx.moveTo(start.x, start.y);
  if (route === "curve") ctx.quadraticCurveTo(c1.x, c1.y, end.x, end.y);
  else if (route === "loop") ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
  else if (route === "elbow") { ctx.lineTo(end.x, start.y); ctx.lineTo(end.x, end.y); }
  else if (route === "jagged") { for (const point of jaggedVertices(element).slice(1)) ctx.lineTo(point.x, point.y); }
  else if (route === "forked") { const fork = forkGeometry(element); ctx.lineTo(fork.junction.x, fork.junction.y); ctx.moveTo(fork.junction.x, fork.junction.y); ctx.lineTo(fork.upper.x, fork.upper.y); ctx.moveTo(fork.junction.x, fork.junction.y); ctx.lineTo(fork.lower.x, fork.lower.y); }
  else ctx.lineTo(end.x, end.y);
}
function connectorSvgPath(element: ShapeElement): string {
  const route = element.type === "arrow" ? element.arrowRoute ?? "straight" : element.lineRoute ?? "straight";
  return connectorPolylines(element, route).map((points) => `M ${points.map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" L ")}`).join(" ");
}
function flowchartSvgPath(element: ShapeElement): string {
  const left = Math.min(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const width = Math.abs(element.w); const height = Math.abs(element.h); const right = left + width; const bottom = top + height; const middle = (left + right) / 2; const shape = element.flowchartShape ?? "process";
  if (shape === "terminator") { const radius = Math.min(width / 2, height / 2); return `M ${left + radius} ${top} H ${right - radius} A ${radius} ${radius} 0 0 1 ${right - radius} ${bottom} H ${left + radius} A ${radius} ${radius} 0 0 1 ${left + radius} ${top} Z`; }
  if (shape === "decision") return `M ${middle} ${top} L ${right} ${top + height / 2} L ${middle} ${bottom} L ${left} ${top + height / 2} Z`;
  if (shape === "data") { const inset = Math.min(width * .22, height * .42); return `M ${left + inset} ${top} H ${right} L ${right - inset} ${bottom} H ${left} Z`; }
  if (shape === "document") return `M ${left} ${top} H ${right} V ${bottom - height * .14} C ${right - width * .28} ${bottom - height * .32}, ${left + width * .28} ${bottom - height * .01}, ${left} ${bottom - height * .14} Z`;
  if (shape === "database") {
    const ry = Math.min(height * .18, width * .25); const rx = width / 2; const k = .55228475;
    return `M ${left} ${top + ry} C ${left} ${top + ry - k * ry}, ${middle - k * rx} ${top}, ${middle} ${top} C ${middle + k * rx} ${top}, ${right} ${top + ry - k * ry}, ${right} ${top + ry} V ${bottom - ry} C ${right} ${bottom - ry + k * ry}, ${middle + k * rx} ${bottom}, ${middle} ${bottom} C ${middle - k * rx} ${bottom}, ${left} ${bottom - ry + k * ry}, ${left} ${bottom - ry} Z`;
  }
  if (shape === "predefined-process") { const inset = Math.min(width * .18, 12); return `M ${left} ${top} H ${right} V ${bottom} H ${left} Z M ${left + inset} ${top} V ${bottom} M ${right - inset} ${top} V ${bottom}`; }
  if (shape === "preparation") { const inset = Math.min(width * .2, 18); return `M ${left + inset} ${top} H ${right - inset} L ${right} ${top + height / 2} L ${right - inset} ${bottom} H ${left + inset} L ${left} ${top + height / 2} Z`; }
  if (shape === "manual-input") return `M ${left + Math.min(width * .22, height * .45)} ${top} H ${right} V ${bottom} H ${left} V ${top + Math.min(width * .22, height * .45)} Z`;
  return `M ${left} ${top} H ${right} V ${bottom} H ${left} Z`;
}
function flowchartSvgDetailPath(element: ShapeElement): string {
  if ((element.flowchartShape ?? "process") !== "database") return "";
  const left = Math.min(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const width = Math.abs(element.w); const height = Math.abs(element.h); const ry = Math.min(height * .18, width * .25);
  if (width < 1 || height < 1) return "";
  const middle = left + width / 2; const right = left + width; const rx = width / 2; const k = .55228475;
  return `M ${left} ${top + ry} C ${left} ${top + ry + k * ry}, ${middle - k * rx} ${top + 2 * ry}, ${middle} ${top + 2 * ry} C ${middle + k * rx} ${top + 2 * ry}, ${right} ${top + ry + k * ry}, ${right} ${top + ry}`;
}
const emptyCanvas = (): CanvasState => ({ zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff", boardColorFollowsTheme: true });
const cloneElements = (items: Element[]): Element[] => JSON.parse(JSON.stringify(items)) as Element[];
const boundsCache = new WeakMap<Element, Bounds>();
const connectorCache = new WeakMap<ShapeElement, Map<string, Point[][]>>();
const cacheBounds = (element: Element, bounds: Bounds): Bounds => { boundsCache.set(element, bounds); return bounds; };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isColor(value: unknown): value is string {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value);
}

function isEmbeddedRasterImage(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z\d+/]+={0,2}$/i.test(value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function boundsOfPoints(points: Point[], padding = 0): Bounds {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let left = Infinity; let top = Infinity; let right = -Infinity; let bottom = -Infinity;
  for (const point of points) { left = Math.min(left, point.x); top = Math.min(top, point.y); right = Math.max(right, point.x); bottom = Math.max(bottom, point.y); }
  return { x: left - padding, y: top - padding, w: right - left + padding * 2, h: bottom - top + padding * 2 };
}

function unionBounds(boxes: Bounds[]): Bounds | undefined {
  if (boxes.length === 0) return undefined;
  let left = Infinity; let top = Infinity; let right = -Infinity; let bottom = -Infinity;
  for (const box of boxes) { left = Math.min(left, box.x); top = Math.min(top, box.y); right = Math.max(right, box.x + box.w); bottom = Math.max(bottom, box.y + box.h); }
  return { x: left, y: top, w: right - left, h: bottom - top };
}

function withSketchExtension(path: string): string {
  const trimmed = path.trim();
  if (/\.sketch$/i.test(trimmed)) return trimmed;
  const separator = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  const extension = trimmed.lastIndexOf(".");
  return extension > separator ? `${trimmed.slice(0, extension)}.sketch` : `${trimmed}.sketch`;
}

function normalizeElement(value: unknown): Element | undefined {
  if (!isRecord(value) || typeof value.type !== "string") return undefined;
  const flags: LayerFlags = {
    hidden: typeof value.hidden === "boolean" ? value.hidden : false,
    locked: typeof value.locked === "boolean" ? value.locked : false,
    rotation: finite(value.rotation) ? value.rotation : 0,
  };
  if (value.type === "group") {
    if (!Array.isArray(value.elements)) return undefined;
    const children = value.elements.map(normalizeElement);
    if (children.some((child) => !child)) return undefined;
    return { type: "group", ...flags, elements: children as Element[] };
  }
  if (value.type === "freehand") {
    if (!Array.isArray(value.points) || !value.points.every((point) => isRecord(point) && finite(point.x) && finite(point.y)) || !isColor(value.color) || !finite(value.thickness) || value.thickness <= 0) return undefined;
    return { type: "freehand", ...flags, points: value.points as Point[], color: value.color, thickness: value.thickness, opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1 };
  }
  if (value.type === "text") {
    if (!finite(value.x) || !finite(value.y) || typeof value.text !== "string" || !isColor(value.color) || !finite(value.fontSize) || value.fontSize < 8) return undefined;
    const fontFamily = value.fontFamily === "hand" ? "hand" : "sans";
    const textAlign = value.textAlign === "center" || value.textAlign === "right" ? value.textAlign : "left";
    const listType = value.listType === "bullet" || value.listType === "number" ? value.listType : "none";
    return { type: "text", ...flags, x: value.x, y: value.y, text: value.text, color: value.color, fontSize: value.fontSize, fontFamily, bold: value.bold === true, italic: value.italic === true, underline: value.underline === true, textAlign, listType, opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1 };
  }
  if (value.type === "image") {
    if (!finite(value.x) || !finite(value.y) || !finite(value.w) || value.w <= 0 || !finite(value.h) || value.h <= 0 || !isEmbeddedRasterImage(value.dataUrl) || !finite(value.sourceWidth) || value.sourceWidth <= 0 || !finite(value.sourceHeight) || value.sourceHeight <= 0) return undefined;
    const cropX = finite(value.cropX) ? value.cropX : 0; const cropY = finite(value.cropY) ? value.cropY : 0;
    const cropW = finite(value.cropW) ? value.cropW : value.sourceWidth; const cropH = finite(value.cropH) ? value.cropH : value.sourceHeight;
    if (cropX < 0 || cropY < 0 || cropW <= 0 || cropH <= 0 || cropX + cropW > value.sourceWidth || cropY + cropH > value.sourceHeight) return undefined;
    return { type: "image", ...flags, x: value.x, y: value.y, w: value.w, h: value.h, dataUrl: value.dataUrl, sourceWidth: value.sourceWidth, sourceHeight: value.sourceHeight, cropX, cropY, cropW, cropH, opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1 };
  }
  if (["rectangle", "circle", "diamond", "flowchart", "line", "arrow"].includes(value.type)) {
    if (!finite(value.x) || !finite(value.y) || !finite(value.w) || !finite(value.h) || !isColor(value.color) || !finite(value.thickness) || value.thickness <= 0) return undefined;
    const lineStyle: StrokeStyle = ["dashed", "dotted", "double"].includes(String(value.lineStyle)) ? value.lineStyle as StrokeStyle : "solid";
    const edgeStyle = value.edgeStyle === "rounded" ? "rounded" : "sharp";
    const fillColor = isColor(value.fillColor) ? value.fillColor : undefined;
    const fillOpacity = finite(value.fillOpacity) ? Math.max(0, Math.min(1, value.fillOpacity)) : 0.2;
    const validHead = (head: unknown): head is ArrowHead => ["none", "open", "solid", "thick", "dot", "diamond", "bar"].includes(String(head));
    const flowchartShape: FlowchartShape = ["process", "terminator", "decision", "data", "document", "database", "predefined-process", "preparation", "manual-input"].includes(String(value.flowchartShape)) ? value.flowchartShape as FlowchartShape : "process";
    const lineRoute: LineRoute = value.lineRoute === "curve" ? "curve" : "straight";
    const arrowRoute: ArrowRoute = ["elbow", "forked", "loop", "jagged"].includes(String(value.arrowRoute)) ? value.arrowRoute as ArrowRoute : "straight";
    return { type: value.type as ShapeElement["type"], ...flags, x: value.x, y: value.y, w: value.w, h: value.h, color: value.color, thickness: value.thickness, fillColor, fillOpacity, lineStyle, edgeStyle, flowchartShape: value.type === "flowchart" ? flowchartShape : undefined, lineRoute: value.type === "line" ? lineRoute : undefined, arrowRoute: value.type === "arrow" ? arrowRoute : undefined, startHead: value.type === "arrow" ? validHead(value.startHead) ? value.startHead : "none" : undefined, endHead: value.type === "arrow" ? validHead(value.endHead) ? value.endHead : "open" : undefined, opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1 };
  }
  return undefined;
}

function parseSketchFile(value: unknown): SketchFile | undefined {
  if (!isRecord(value) || value.format !== "SketchDraw") return undefined;
  const normalizePage = (id: unknown, name: unknown, stateValue: unknown, elementsValue: unknown): SketchPage | undefined => {
    if (typeof id !== "string" || typeof name !== "string" || !isRecord(stateValue) || !Array.isArray(elementsValue)) return undefined;
    const state = stateValue;
    if (!finite(state.zoom) || state.zoom <= 0 || !finite(state.panX) || !finite(state.panY) || !isColor(state.backgroundColor)) return undefined;
    const elements = elementsValue.map(normalizeElement);
    if (elements.some((element) => !element)) return undefined;
    return { id, name: name.slice(0, 80), canvasState: { zoom: state.zoom, panX: state.panX, panY: state.panY, backgroundColor: state.backgroundColor, boardColorFollowsTheme: typeof state.boardColorFollowsTheme === "boolean" ? state.boardColorFollowsTheme : state.backgroundColor === "#ffffff" }, elements: elements as Element[] };
  };
  if (value.version !== 4 || !Array.isArray(value.pages) || value.pages.length < 1 || value.pages.length > 100) return undefined;
  const pages = value.pages.map((page, index) => isRecord(page) ? normalizePage(page.id, page.name ?? `Page ${index + 1}`, page.canvasState, page.elements) : undefined);
  if (pages.some((page) => !page)) return undefined;
  const normalized = pages as SketchPage[];
  if (new Set(normalized.map((page) => page.id)).size !== normalized.length) return undefined;
  const activePageId = normalized.some((page) => page.id === value.activePageId) ? String(value.activePageId) : normalized[0].id;
  return { format: "SketchDraw", version: 4, activePageId, pages: normalized };
}

function elementBounds(element: Element): Bounds {
  const cached = boundsCache.get(element); if (cached) return cached;
  if (element.type === "group") {
    return cacheBounds(element, unionBounds(element.elements.filter((child) => !child.hidden).map(elementBounds)) ?? { x: 0, y: 0, w: 0, h: 0 });
  }
  if (element.type === "image") return cacheBounds(element, rotatedBounds({ x: element.x, y: element.y, w: element.w, h: element.h }, element.rotation ?? 0));
  if (element.type === "text") {
    const lines = element.text.split(/\r?\n/);
    const width = Math.max(element.fontSize * 0.5, ...lines.map((line) => line.length * element.fontSize * 0.58));
    const x = element.textAlign === "center" ? element.x - width / 2 : element.textAlign === "right" ? element.x - width : element.x;
    return cacheBounds(element, rotatedBounds({ x, y: element.y, w: width, h: lines.length * element.fontSize * 1.25 }, element.rotation ?? 0));
  }
  if (element.type === "freehand") {
    return cacheBounds(element, rotatedBounds(boundsOfPoints(element.points, element.thickness / 2), element.rotation ?? 0));
  }
  const x = Math.min(element.x, element.x + element.w);
  const y = Math.min(element.y, element.y + element.h);
  const w = Math.abs(element.w); const h = Math.abs(element.h);
  if (element.type === "line" || element.type === "arrow") {
    const route = element.type === "arrow" ? element.arrowRoute ?? "straight" : element.lineRoute ?? "straight";
    const points = connectorPolylines(element, route, 33).flat();
    if (element.type === "arrow") {
      for (const head of arrowHeadEntries(element, route as ArrowRoute)) {
        points.push(...arrowHeadPoints(head.tip, head.angle, head.kind, element.thickness));
        if (head.kind === "dot") { const radius = Math.max(3, element.thickness * 1.15); points.push({ x: head.tip.x - radius, y: head.tip.y - radius }, { x: head.tip.x + radius, y: head.tip.y + radius }); }
      }
    }
    const doubleOffset = element.lineStyle === "double" ? Math.max(2.5, element.thickness * 1.2) : 0;
    return cacheBounds(element, rotatedBounds(boundsOfPoints(points, element.thickness / 2 + doubleOffset), element.rotation ?? 0));
  }
  return cacheBounds(element, rotatedBounds({ x, y, w, h }, element.rotation ?? 0));
}

function rotatedBounds(bounds: Bounds, degrees: number): Bounds {
  if (!degrees) return bounds;
  const angle = degrees * Math.PI / 180; const cx = bounds.x + bounds.w / 2; const cy = bounds.y + bounds.h / 2;
  const corners = [{ x: bounds.x, y: bounds.y }, { x: bounds.x + bounds.w, y: bounds.y }, { x: bounds.x + bounds.w, y: bounds.y + bounds.h }, { x: bounds.x, y: bounds.y + bounds.h }].map((point) => ({ x: cx + (point.x - cx) * Math.cos(angle) - (point.y - cy) * Math.sin(angle), y: cy + (point.x - cx) * Math.sin(angle) + (point.y - cy) * Math.cos(angle) }));
  const xs = corners.map((point) => point.x); const ys = corners.map((point) => point.y); const x = Math.min(...xs); const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x; const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function App() {
  const [elements, setElements] = createSignal<Element[]>([]);
  const [canvasState, setCanvasState] = createSignal<CanvasState>(emptyCanvas());
  const [pages, setPages] = createSignal<SketchPage[]>([]);
  const [activePageId, setActivePageId] = createSignal("");
  const [activePath, setActivePath] = createSignal<string>();
  const [tool, setTool] = createSignal<Tool>("pen");
  const [color, setColor] = createSignal("#252525");
  const [thickness, setThickness] = createSignal(4);
  const [dirty, setDirty] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [savedAt, setSavedAt] = createSignal("");
  const [error, setError] = createSignal("");
  const [preview, setPreview] = createSignal<Preview>();
  const [selectedIndices, setSelectedIndices] = createSignal<number[]>([]);
  const [hoveredIndex, setHoveredIndex] = createSignal<number>();
  const [showGrid, setShowGrid] = createSignal(true);
  const [snapToGrid, setSnapToGrid] = createSignal(false);
  const [snapToObjects, setSnapToObjects] = createSignal(true);
  const [alignmentGuides, setAlignmentGuides] = createSignal<{ x?: number; y?: number }>();
  const [fillEnabled, setFillEnabled] = createSignal(false);
  const [fillColor, setFillColor] = createSignal("#6b91c9");
  const [fillOpacity, setFillOpacity] = createSignal(0.2);
  const [lineStyle, setLineStyle] = createSignal<StrokeStyle>("solid");
  const [lineRoute, setLineRoute] = createSignal<LineRoute>("straight");
  const [arrowRoute, setArrowRoute] = createSignal<ArrowRoute>("straight");
  const [flowchartShape, setFlowchartShape] = createSignal<FlowchartShape>("process");
  const [edgeStyle, setEdgeStyle] = createSignal<"sharp" | "rounded">("sharp");
  const [defaultStartHead, setDefaultStartHead] = createSignal<ArrowHead>("none");
  const [defaultEndHead, setDefaultEndHead] = createSignal<ArrowHead>("open");
  const [boardColor, setBoardColor] = createSignal("#ffffff");
  const [boardColorFollowsTheme, setBoardColorFollowsTheme] = createSignal(true);
  const [boardLocked, setBoardLocked] = createSignal(false);
  const [sidebarTab, setSidebarTab] = createSignal<"properties" | "layers">("properties");
  const [defaultFontSize, setDefaultFontSize] = createSignal(24);
  const [defaultFontFamily, setDefaultFontFamily] = createSignal<"sans" | "hand">("sans");
  const [defaultBold, setDefaultBold] = createSignal(false);
  const [defaultItalic, setDefaultItalic] = createSignal(false);
  const [defaultUnderline, setDefaultUnderline] = createSignal(false);
  const [defaultTextAlign, setDefaultTextAlign] = createSignal<"left" | "center" | "right">("left");
  const [defaultListType, setDefaultListType] = createSignal<"none" | "bullet" | "number">("none");
  const [showAdvancedThickness, setShowAdvancedThickness] = createSignal(false);
  const [sidebarOpen, setSidebarOpen] = createSignal(true);
  const [toolBarOpen, setToolBarOpen] = createSignal(true);
  const [showClearConfirm, setShowClearConfirm] = createSignal(false);
  const [recoveryPrompt, setRecoveryPrompt] = createSignal<{ path: string; snapshot: SketchFile; baselineRaw?: string }>();
  const [syncConflict, setSyncConflict] = createSignal<{ path: string; remote: string }>();
  const [exportOptionsOpen, setExportOptionsOpen] = createSignal(false);
  const [exportFormat, setExportFormat] = createSignal<"png" | "pdf">("png");
  const [exportWidth, setExportWidth] = createSignal(1600);
  const [exportHeight, setExportHeight] = createSignal(1000);
  const [exportTransparent, setExportTransparent] = createSignal(false);
  const [textDraft, setTextDraft] = createSignal<TextDraft>();
  const [isPanning, setIsPanning] = createSignal(false);
  const [spaceDown, setSpaceDown] = createSignal(false);
  const [historyVersion, setHistoryVersion] = createSignal(0);
  const imageCache = new Map<string, HTMLImageElement>();
  const [themeMode, setThemeMode] = createSignal<ThemeMode>((() => {
    try { const saved = localStorage.getItem("sketchdraw-theme"); return saved === "light" || saved === "dark" ? saved : "system"; }
    catch { return "system"; }
  })());
  const [systemDark, setSystemDark] = createSignal(window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
  const [recentFiles, setRecentFiles] = createSignal<string[]>((() => {
    try { const value: unknown = JSON.parse(localStorage.getItem("sketchdraw-recent-files") ?? "[]"); return Array.isArray(value) ? value.filter((path): path is string => typeof path === "string" && path.toLowerCase().endsWith(".sketch")).slice(0, 8) : []; }
    catch { return []; }
  })());
  const [marquee, setMarquee] = createSignal<{ start: Point; end: Point }>();
  let undoStack: Element[][] = [];
  let redoStack: Element[][] = [];
  let canvas!: HTMLCanvasElement;
  let canvasWrap!: HTMLElement;
  let textInput!: HTMLElement;
  let menu!: HTMLDetailsElement;
  let viewMenu!: HTMLDetailsElement;
  let drawing = false;
  let activeDrawingTool: Preview["type"] = "pen";
  let currentPoints: Point[] = [];
  let saveInFlight = false;
  let lastSavedRaw: string | undefined;
  let panOrigin: { x: number; y: number; panX: number; panY: number } | undefined;
  let moveOrigin: { indices: number[]; point: Point; before: Element[]; moved: boolean } | undefined;
  let marqueeOrigin: { point: Point; additive: boolean; moved: boolean; cropIndex?: number } | undefined;
  let resizeOrigin: { index: number; handle: string; start: Point; original: Element; before: Element[]; moved: boolean } | undefined;

  const fileName = () => activePath()?.split(/[\\/]/).pop() ?? "Untitled sketch";
  const currentPage = () => pages().find((page) => page.id === activePageId());
  const theme = (): Theme => themeMode() === "system" ? systemDark() ? "dark" : "light" : themeMode() as Theme;
  const selectedSet = createMemo(() => new Set(selectedIndices()));
  const selectedElements = () => selectedIndices().flatMap((index) => elements()[index] ? [elements()[index]] : []);
  const primarySelection = () => selectedIndices()[selectedIndices().length - 1];
  const groupSelected = () => selectedElements().length === 1 && selectedElements()[0]?.type === "group";
  const groupActionEnabled = () => groupSelected() ? !selectedElements()[0]?.locked : selectedElements().filter((element) => !element.locked).length >= 2;
  const focusedElement = (): Element | undefined => {
    let element = primarySelection() === undefined ? undefined : elements()[primarySelection()!];
    while (element?.type === "group") element = element.elements[element.elements.length - 1];
    return element;
  };
  const selectedText = (): TextElement | undefined => { const element = focusedElement(); return element?.type === "text" ? element : undefined; };
  const selectedColor = () => { const draft = textDraft(); if (draft) return draft.color; const element = focusedElement(); return element && "color" in element ? element.color : color(); };
  const selectedThickness = () => { const element = focusedElement(); return element && "thickness" in element ? element.thickness : thickness(); };
  const selectedOpacity = () => { const element = focusedElement(); return element && "opacity" in element ? element.opacity ?? 1 : 1; };
  const selectedFillColor = () => { const element = focusedElement(); return element && "fillColor" in element ? element.fillColor : undefined; };
  const renderedBoardColor = () => boardColorFollowsTheme() ? theme() === "dark" ? "#17191f" : "#ffffff" : boardColor();
  const updateStrokeColor = (value: string) => { setColor(value); setTextDraft((draft) => draft ? { ...draft, color: value } : undefined); if (selectedIndices().length) updateProperty("color", value); };
  const updateThickness = (value: number) => { setThickness(value); if (selectedIndices().length) updateProperty("thickness", value); };
  const status = () => !activePath() ? "No file selected" : saving() ? "Saving…" : dirty() ? "Unsaved changes" : savedAt() ? `Saved ${savedAt()}` : "Saved locally";
  function documentSnapshot(): SketchFile {
    const sourcePages = pages().length ? pages() : [{ id: "page-1", name: "Page 1", canvasState: canvasState(), elements: elements() }];
    const serializedPages = sourcePages.map((page) => {
      const isCurrent = page.id === activePageId() || (!activePageId() && sourcePages.length === 1);
      const pageElements = isCurrent ? elements() : page.elements;
      const normalized = pageElements.map(normalizeElement);
      if (normalized.some((element) => !element)) throw new Error("The drawing contains an element that cannot be saved in SketchDraw format v4.");
      const state = isCurrent ? canvasState() : page.canvasState;
      return { id: page.id, name: page.name, canvasState: { ...state, backgroundColor: isCurrent ? renderedBoardColor() : (state.boardColorFollowsTheme ? (theme() === "dark" ? "#17191f" : "#ffffff") : state.backgroundColor), boardColorFollowsTheme: state.boardColorFollowsTheme ?? true }, elements: normalized as Element[] };
    });
    return { format: "SketchDraw", version: 4, activePageId: activePageId() || serializedPages[0].id, pages: serializedPages };
  }
  function snapshotRaw(snapshot: SketchFile) { return JSON.stringify(snapshot, null, 2); }
  function storeCurrentPage() {
    const id = activePageId();
    if (!id) return;
    setPages((items) => items.map((page) => page.id === id ? { ...page, elements: cloneElements(elements()), canvasState: { ...canvasState(), backgroundColor: renderedBoardColor(), boardColorFollowsTheme: boardColorFollowsTheme() } } : page));
  }
  function switchPage(id: string) {
    if (id === activePageId()) return;
    const target = pages().find((page) => page.id === id);
    if (!target) return;
    storeCurrentPage();
    setElements(cloneElements(target.elements)); setCanvasState({ ...target.canvasState }); setBoardColor(target.canvasState.backgroundColor); setBoardColorFollowsTheme(target.canvasState.boardColorFollowsTheme ?? false);
    setActivePageId(id); setSelectedIndices([]); setHoveredIndex(undefined); setTextDraft(undefined); setMarquee(undefined);
    undoStack = []; redoStack = []; setHistoryVersion((version) => version + 1); setDirty(true);
  }
  function addPage() {
    if (boardLocked()) return;
    if (pages().length >= 100) { setError("A sketch can contain up to 100 pages."); return; }
    storeCurrentPage();
    const number = pages().length + 1; const page: SketchPage = { id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: `Page ${number}`, canvasState: emptyCanvas(), elements: [] };
    setPages((items) => [...items, page]); setActivePageId(page.id); setElements([]); setCanvasState(emptyCanvas()); setBoardColor("#ffffff"); setBoardColorFollowsTheme(true); setSelectedIndices([]); setDirty(true);
    undoStack = []; redoStack = []; setHistoryVersion((version) => version + 1);
  }
  function deleteCurrentPage() {
    if (boardLocked() || pages().length <= 1) return;
    const nextPages = pages().filter((page) => page.id !== activePageId()); const target = nextPages[Math.max(0, pages().findIndex((page) => page.id === activePageId()) - 1)] ?? nextPages[0];
    setPages(nextPages); setActivePageId(target.id); setElements(cloneElements(target.elements)); setCanvasState({ ...target.canvasState }); setBoardColor(target.canvasState.backgroundColor); setBoardColorFollowsTheme(target.canvasState.boardColorFollowsTheme ?? false); setSelectedIndices([]); setTextDraft(undefined); setHoveredIndex(undefined); setMarquee(undefined); undoStack = []; redoStack = []; setHistoryVersion((version) => version + 1); setDirty(true);
  }
  const canUndo = () => { historyVersion(); return undoStack.length > 0; };
  const canRedo = () => { historyVersion(); return redoStack.length > 0; };
  const toWorld = (event: PointerEvent): Point => {
    const rect = canvas.getBoundingClientRect(); const state = canvasState();
    return { x: (event.clientX - rect.left - state.panX) / state.zoom, y: (event.clientY - rect.top - state.panY) / state.zoom };
  };
  const snap = (point: Point): Point => snapToGrid() ? { x: Math.round(point.x / GRID_SIZE) * GRID_SIZE, y: Math.round(point.y / GRID_SIZE) * GRID_SIZE } : point;

  function pushUndo(before: Element[]) {
    undoStack.push(before);
    if (undoStack.length > 100) undoStack.shift();
    redoStack = [];
    setHistoryVersion((version) => version + 1);
  }
  function undo() {
    if (boardLocked()) return;
    if (!undoStack.length) return;
    redoStack.push(cloneElements(elements()));
    setElements(undoStack.pop()!); setSelectedIndices([]); setDirty(true); setHistoryVersion((version) => version + 1);
  }
  function redo() {
    if (boardLocked()) return;
    if (!redoStack.length) return;
    undoStack.push(cloneElements(elements()));
    setElements(redoStack.pop()!); setSelectedIndices([]); setDirty(true); setHistoryVersion((version) => version + 1);
  }
  function deleteSelected() {
    if (boardLocked()) return;
    const indices = selectedIndices().filter((index) => { const element = elements()[index]; return !!element && canMoveElement(element); });
    if (!indices.length) return;
    const before = cloneElements(elements());
    const selected = new Set(indices);
    const removed = [...selected].sort((a, b) => a - b);
    setElements((items) => items.filter((_, itemIndex) => !selected.has(itemIndex)));
    pushUndo(before); setSelectedIndices((current) => current.filter((index) => !selected.has(index)).map((index) => index - removed.filter((deleted) => deleted < index).length)); setDirty(true);
  }

  function groupSelection() {
    if (boardLocked()) return;
    const indices = [...new Set(selectedIndices())].filter((index) => !!elements()[index] && !elements()[index].locked).sort((a, b) => a - b);
    if (indices.length === 1 && elements()[indices[0]]?.type === "group") { ungroupSelection(); return; }
    if (indices.length < 2) return;
    const before = cloneElements(elements()); const selected = new Set(indices); const first = indices[0];
    const children = indices.map((index) => elements()[index]); const grouped: Element[] = [];
    elements().forEach((element, index) => { if (index === first) grouped.push({ type: "group", elements: children }); if (!selected.has(index)) grouped.push(element); });
    setElements(grouped); pushUndo(before); setSelectedIndices([first]); setDirty(true);
  }

  function ungroupSelection() {
    if (boardLocked()) return;
    const indices = new Set(selectedIndices().filter((index) => !!elements()[index] && !elements()[index].locked)); if (!indices.size) return;
    const before = cloneElements(elements()); const next: Element[] = []; const selectedAfter: number[] = []; let changed = false;
    elements().forEach((element, index) => {
      if (indices.has(index) && element.type === "group" && !element.locked) {
        changed = true;
        const start = next.length; next.push(...element.elements);
        for (let offset = 0; offset < element.elements.length; offset++) selectedAfter.push(start + offset);
      } else next.push(element);
    });
    if (!changed) return;
    setElements(next); pushUndo(before); setSelectedIndices(selectedAfter); setDirty(true);
  }

  function updateProperty(property: "color" | "thickness" | "opacity" | "fontSize" | "fontFamily" | "fillColor" | "fillOpacity" | "bold" | "italic" | "underline" | "textAlign" | "listType" | "lineStyle" | "lineRoute" | "arrowRoute" | "flowchartShape" | "edgeStyle" | "startHead" | "endHead", value: string | number | boolean | undefined) {
    if (boardLocked()) return;
    const indices = new Set(selectedIndices().filter((index) => !!elements()[index] && !elements()[index].locked)); if (!indices.size) return;
    const before = cloneElements(elements());
    const update = (element: Element): Element => {
      if (element.locked) return element;
      if (element.type === "group") return { ...element, elements: element.elements.map(update) };
      if (property === "color") return { ...element, color: String(value) } as Element;
      if (property === "opacity") return { ...element, opacity: Number(value) } as Element;
      if (property === "thickness" && "thickness" in element) return { ...element, thickness: Number(value) } as Element;
      if (element.type === "text" && property === "fontSize") return { ...element, fontSize: Number(value) };
      if (element.type === "text" && property === "fontFamily") return { ...element, fontFamily: value as TextElement["fontFamily"] };
      if (element.type === "text" && ["bold", "italic", "underline", "textAlign", "listType"].includes(property)) return { ...element, [property]: value } as Element;
      if (element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "flowchart") {
        if (property === "fillColor") return { ...element, fillColor: value ? String(value) : undefined };
        if (property === "fillOpacity") return { ...element, fillOpacity: Number(value) };
        if (property === "lineStyle") return { ...element, lineStyle: value as ShapeElement["lineStyle"] };
        if (property === "edgeStyle") return { ...element, edgeStyle: value as ShapeElement["edgeStyle"] };
      }
      if ((element.type === "line" || element.type === "arrow") && property === "lineStyle") return { ...element, lineStyle: value as ShapeElement["lineStyle"] };
      if (element.type === "line" && property === "lineRoute") return { ...element, lineRoute: value as LineRoute };
      if (element.type === "arrow" && property === "arrowRoute") return { ...element, arrowRoute: value as ArrowRoute };
      if (element.type === "flowchart" && property === "flowchartShape") return { ...element, flowchartShape: value as FlowchartShape };
      if (element.type === "arrow" && (property === "startHead" || property === "endHead")) return { ...element, [property]: value as ArrowHead };
      return element;
    };
    setElements((items) => items.map((element, index) => indices.has(index) ? update(element) : element));
    pushUndo(before); setDirty(true);
  }

  function commitTextDraft() {
    const draft = textDraft();
    if (draft) {
      const existing = draft.editingIndex === undefined ? undefined : elements()[draft.editingIndex];
      if (draft.editingIndex !== undefined && existing?.type === "text" && !draft.value.trim()) {
        pushUndo(cloneElements(elements()));
        const removedIndex = draft.editingIndex;
        setElements((items) => items.filter((_, index) => index !== removedIndex));
        setSelectedIndices((indices) => indices.filter((index) => index !== removedIndex).map((index) => index > removedIndex ? index - 1 : index));
        setDirty(true);
      } else if (draft.value.trim()) {
        const item: TextElement = { type: "text", x: draft.x, y: draft.y, text: draft.value, color: draft.color, opacity: draft.opacity, fontSize: draft.fontSize, fontFamily: draft.fontFamily, bold: draft.bold, italic: draft.italic, underline: draft.underline, textAlign: draft.textAlign, listType: draft.listType };
        const before = cloneElements(elements());
        if (draft.editingIndex !== undefined) setElements((items) => items.map((element, index) => index === draft.editingIndex && element.type === "text" ? { ...element, ...item } : element));
        else setElements((items) => [...items, item]);
        pushUndo(before); setDirty(true);
      }
    }
    setTextDraft(undefined);
  }

  function startTextDraft(point: Point, editingIndex?: number) {
    const existing = editingIndex === undefined ? undefined : elements()[editingIndex];
    const text = existing?.type === "text" ? existing : undefined;
    setTextDraft({ x: text?.x ?? point.x, y: text?.y ?? point.y, value: text?.text ?? "", editingIndex, color: text?.color ?? color(), opacity: text?.opacity ?? 1, fontSize: text?.fontSize ?? defaultFontSize(), fontFamily: text?.fontFamily ?? defaultFontFamily(), bold: text?.bold ?? defaultBold(), italic: text?.italic ?? defaultItalic(), underline: text?.underline ?? defaultUnderline(), textAlign: text?.textAlign ?? defaultTextAlign(), listType: text?.listType ?? defaultListType() });
  }

  function fitDocumentToViewport(items: Element[]) {
    if (!canvas || items.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    const bounds = unionBounds(items.filter((element) => !element.hidden).map(elementBounds)); if (!bounds) return;
    const { x: left, y: top } = bounds; const right = left + bounds.w; const bottom = top + bounds.h;
    const width = Math.max(1, right - left); const height = Math.max(1, bottom - top);
    const zoom = Math.max(0.02, Math.min(1.25, (rect.width - 100) / width, (rect.height - 100) / height));
    setCanvasState({ zoom, panX: (rect.width - width * zoom) / 2 - left * zoom, panY: (rect.height - height * zoom) / 2 - top * zoom, backgroundColor: renderedBoardColor(), boardColorFollowsTheme: boardColorFollowsTheme() });
    setDirty(true);
  }

  function resetZoomAndCenter() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); const boxes = elements().filter((element) => !element.hidden).map(elementBounds);
    const center = boxes.length
      ? { x: boxes.reduce((sum, box) => sum + box.x + box.w / 2, 0) / boxes.length, y: boxes.reduce((sum, box) => sum + box.y + box.h / 2, 0) / boxes.length }
      : { x: 0, y: 0 };
    setCanvasState({ zoom: 1, panX: rect.width / 2 - center.x, panY: rect.height / 2 - center.y, backgroundColor: renderedBoardColor(), boardColorFollowsTheme: boardColorFollowsTheme() }); setDirty(true);
  }

  function rectanglePathPoints(element: ShapeElement): Point[] {
    const left = Math.min(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h);
    const width = Math.max(0, Math.abs(element.w)); const height = Math.max(0, Math.abs(element.h));
    const right = left + width; const bottom = top + height;
    return [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
  }

  function hitElement(element: Element, point: Point, zoom: number): boolean {
    if (element.hidden || element.locked) return false;
    if (element.type === "group") return element.elements.some((child) => hitElement(child, point, zoom));
    const box = elementBounds(element); const center = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    if (element.rotation) { const angle = -element.rotation * Math.PI / 180; const dx = point.x - center.x; const dy = point.y - center.y; point = { x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle) }; }
    const tolerance = Math.max(5 / zoom, "thickness" in element ? element.thickness / 2 + 2 / zoom : 2 / zoom);
    if (element.type === "image") return point.x >= element.x - tolerance && point.x <= element.x + element.w + tolerance && point.y >= element.y - tolerance && point.y <= element.y + element.h + tolerance;
    if (element.type === "text") {
      const bounds = elementBounds(element);
      return point.x >= bounds.x - tolerance && point.x <= bounds.x + bounds.w + tolerance && point.y >= bounds.y - tolerance && point.y <= bounds.y + bounds.h + tolerance;
    }
    if (element.type === "line" || element.type === "arrow") {
      const route = element.type === "arrow" ? element.arrowRoute ?? "straight" : element.lineRoute ?? "straight";
      for (const samples of connectorPolylines(element, route, 33)) for (let index = 1; index < samples.length; index++) if (distanceToSegment(point, samples[index - 1], samples[index]) <= tolerance + (element.lineStyle === "double" ? 3 : 0)) return true;
      if (element.type !== "arrow") return false;
      for (const { tip, angle: direction, kind } of arrowHeadEntries(element, route as ArrowRoute)) {
        if (kind === "dot" && Math.hypot(point.x - tip.x, point.y - tip.y) <= Math.max(4, element.thickness * 1.5) + tolerance) return true;
        const points = arrowHeadPoints(tip, direction, kind, element.thickness);
        if ((kind === "solid" || kind === "thick" || kind === "diamond") && pointInPolygon(point, points)) return true;
        for (let i = 0; i < points.length; i += kind === "open" ? 1 : 2) {
          const a = kind === "open" ? tip : points[i]; const b = kind === "open" ? points[i] : points[(i + 1) % points.length];
          if (distanceToSegment(point, a, b) <= tolerance) return true;
        }
      }
      return false;
    }
    if (element.type === "freehand") {
      for (let i = 1; i < element.points.length; i++) if (distanceToSegment(point, element.points[i - 1], element.points[i]) <= tolerance) return true;
      return element.points.length === 1 && Math.hypot(point.x - element.points[0].x, point.y - element.points[0].y) <= tolerance;
    }
    if (element.type === "rectangle") {
      if (element.fillColor && point.x >= Math.min(element.x, element.x + element.w) && point.x <= Math.max(element.x, element.x + element.w) && point.y >= Math.min(element.y, element.y + element.h) && point.y <= Math.max(element.y, element.y + element.h)) return true;
      const points = rectanglePathPoints(element);
      for (let i = 0; i < points.length; i++) if (distanceToSegment(point, points[i], points[(i + 1) % points.length]) <= tolerance) return true;
      return false;
    }
    if (element.type === "diamond") {
      const left = Math.min(element.x, element.x + element.w); const right = Math.max(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const bottom = Math.max(element.y, element.y + element.h);
      const points = [{ x: (left + right) / 2, y: top }, { x: right, y: (top + bottom) / 2 }, { x: (left + right) / 2, y: bottom }, { x: left, y: (top + bottom) / 2 }];
      if (element.fillColor && pointInPolygon(point, points)) return true;
      for (let i = 0; i < points.length; i++) if (distanceToSegment(point, points[i], points[(i + 1) % points.length]) <= tolerance) return true;
      return false;
    }
    if (element.type === "flowchart") {
      const context = canvas?.getContext("2d"); if (!context) return false;
      context.save(); context.setTransform(1, 0, 0, 1, 0, 0); traceFlowchart(context, element.flowchartShape ?? "process", element.x, element.y, element.w, element.h);
      const inside = element.fillColor ? context.isPointInPath(point.x, point.y) : false; context.lineWidth = tolerance * 2; let border = context.isPointInStroke(point.x, point.y);
      if ((element.flowchartShape ?? "process") === "database") {
        const left = Math.min(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const width = Math.abs(element.w); const height = Math.abs(element.h);
        if (width >= 1 && height >= 1) border ||= context.isPointInStroke(flowchartDatabaseRimPath(left, top, width, height), point.x, point.y);
      }
      context.restore();
      return inside || border;
    }
    const rx = Math.abs(element.w / 2); const ry = Math.abs(element.h / 2);
    if (rx < 0.01 || ry < 0.01) return false;
    const nx = (point.x - element.x - element.w / 2) / rx; const ny = (point.y - element.y - element.h / 2) / ry;
    if (element.fillColor && nx * nx + ny * ny <= 1) return true;
    const radialError = Math.abs(Math.hypot(nx, ny) - 1) * Math.min(rx, ry);
    return radialError <= tolerance;
  }

  function hitTest(point: Point): number | undefined {
    const zoom = canvasState().zoom;
    for (let index = elements().length - 1; index >= 0; index--) if (hitElement(elements()[index], point, zoom)) return index;
    return undefined;
  }

  function drawElement(ctx: CanvasRenderingContext2D, element: Element) {
    if (element.hidden) return;
    if (element.type === "group") { for (const child of element.elements) drawElement(ctx, child); return; }
    const elementBox = elementBounds(element); const centerX = elementBox.x + elementBox.w / 2; const centerY = elementBox.y + elementBox.h / 2;
    if (element.rotation) { ctx.save(); ctx.translate(centerX, centerY); ctx.rotate(element.rotation * Math.PI / 180); ctx.translate(-centerX, -centerY); }
    if (element.type === "image") {
      const image = imageCache.get(element.dataUrl);
      ctx.save(); ctx.globalAlpha = element.opacity ?? 1;
      if (image?.complete && image.naturalWidth) {
        const sx = element.cropX ?? 0; const sy = element.cropY ?? 0; const sw = element.cropW ?? image.naturalWidth; const sh = element.cropH ?? image.naturalHeight;
        ctx.drawImage(image, sx, sy, sw, sh, element.x, element.y, element.w, element.h);
      }
      ctx.restore(); if (element.rotation) ctx.restore(); return;
    }
    if (element.type === "text") {
      ctx.save(); ctx.globalAlpha = element.opacity ?? 1; ctx.fillStyle = element.color;
      ctx.font = (element.italic ? "italic " : "") + (element.bold ? "700 " : "400 ") + element.fontSize + "px " + (element.fontFamily === "hand" ? "cursive" : "'DM Sans', sans-serif"); ctx.textBaseline = "top"; ctx.textAlign = element.textAlign ?? "left";
      const lines = element.text.split(/\r?\n/).map((line, index) => element.listType === "bullet" ? "• " + line : element.listType === "number" ? (index + 1) + ". " + line : line);
      lines.forEach((line, index) => { const y = element.y + index * element.fontSize * 1.25; ctx.fillText(line, element.x, y); if (element.underline) { const measured = ctx.measureText(line).width; const startX = element.textAlign === "center" ? element.x - measured / 2 : element.textAlign === "right" ? element.x - measured : element.x; ctx.fillRect(startX, y + element.fontSize * 1.06, measured, Math.max(1, element.fontSize / 18)); } }); ctx.restore(); if (element.rotation) ctx.restore(); return;
    }
    ctx.save(); ctx.globalAlpha = element.opacity ?? 1;
    ctx.strokeStyle = element.color; ctx.lineWidth = element.thickness; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
    if ("lineStyle" in element) ctx.setLineDash(element.lineStyle === "dashed" ? [element.thickness * 4, element.thickness * 2.5] : element.lineStyle === "dotted" ? [element.thickness, element.thickness * 2.2] : []);
    if (element.type === "line" || element.type === "arrow") {
      const route = element.type === "arrow" ? element.arrowRoute ?? "straight" : element.lineRoute ?? "straight";
      if (element.lineStyle === "double") {
        const angle = Math.atan2(element.h, element.w); const offset = Math.max(2.5, element.thickness * 1.2);
        for (const side of [-1, 1]) { ctx.save(); ctx.translate(-Math.sin(angle) * offset * side, Math.cos(angle) * offset * side); traceConnector(ctx, element); ctx.stroke(); ctx.restore(); }
      } else { traceConnector(ctx, element); ctx.stroke(); }
      if (element.type === "arrow") {
        for (const { tip, angle: direction, kind } of arrowHeadEntries(element, route as ArrowRoute)) {
          if (kind === "none") continue;
          if (kind === "dot") { ctx.beginPath(); ctx.arc(tip.x, tip.y, Math.max(3, element.thickness * 1.15), 0, Math.PI * 2); ctx.fillStyle = element.color; ctx.fill(); continue; }
          const points = arrowHeadPoints(tip, direction, kind, element.thickness); ctx.beginPath();
          if (kind === "open") { ctx.moveTo(tip.x, tip.y); ctx.lineTo(points[0].x, points[0].y); ctx.moveTo(tip.x, tip.y); ctx.lineTo(points[1].x, points[1].y); }
          else { ctx.moveTo(points[0].x, points[0].y); for (let index = 1; index < points.length; index++) ctx.lineTo(points[index].x, points[index].y); if (["solid", "thick", "diamond"].includes(kind)) ctx.closePath(); }
          if (["solid", "thick", "diamond"].includes(kind)) { ctx.fillStyle = element.color; ctx.fill(); }
          ctx.stroke();
        }
      }
      ctx.restore(); if (element.rotation) ctx.restore(); return;
    }
    if (element.type === "freehand") {
      if (!element.points.length) { ctx.restore(); return; }
      ctx.moveTo(element.points[0].x, element.points[0].y);
      for (let i = 1; i < element.points.length; i++) {
        const previous = element.points[i - 1]; const point = element.points[i];
        const mid = { x: (previous.x + point.x) / 2, y: (previous.y + point.y) / 2 };
        ctx.quadraticCurveTo(previous.x, previous.y, mid.x, mid.y);
      }
      const last = element.points[element.points.length - 1]; ctx.lineTo(last.x, last.y);
    } else if (element.type === "rectangle") {
      const left = Math.min(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const width = Math.abs(element.w); const height = Math.abs(element.h);
      if (element.edgeStyle === "rounded" && typeof ctx.roundRect === "function") ctx.roundRect(left, top, width, height, Math.min(14, width / 4, height / 4)); else ctx.rect(left, top, width, height);
    } else if (element.type === "diamond") {
      const left = Math.min(element.x, element.x + element.w); const right = Math.max(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const bottom = Math.max(element.y, element.y + element.h);
      ctx.moveTo((left + right) / 2, top); ctx.lineTo(right, (top + bottom) / 2); ctx.lineTo((left + right) / 2, bottom); ctx.lineTo(left, (top + bottom) / 2); ctx.closePath();
    } else if (element.type === "circle") {
      const rx = Math.abs(element.w / 2); const ry = Math.abs(element.h / 2); const cx = element.x + element.w / 2; const cy = element.y + element.h / 2;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    } else if (element.type === "flowchart") {
      traceFlowchart(ctx, element.flowchartShape ?? "process", element.x, element.y, element.w, element.h);
    }
    if ("fillColor" in element && element.fillColor) { ctx.fillStyle = element.fillColor; ctx.globalAlpha = (element.opacity ?? 1) * (element.fillOpacity ?? fillOpacity()); ctx.fill(); ctx.globalAlpha = element.opacity ?? 1; }
    ctx.stroke();
    if (element.type === "flowchart") traceFlowchartDetails(ctx, element.flowchartShape ?? "process", element.x, element.y, element.w, element.h);
    ctx.restore(); if (element.rotation) ctx.restore();
  }

  function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, state: CanvasState) {
    if (!showGrid()) return;
    const multiplier = Math.max(1, 2 ** Math.max(0, Math.ceil(Math.log2(0.65 / state.zoom))));
    const step = GRID_SIZE * multiplier; const left = -state.panX / state.zoom; const top = -state.panY / state.zoom;
    const right = (width - state.panX) / state.zoom; const bottom = (height - state.panY) / state.zoom;
    const hex = renderedBoardColor().replace("#", ""); const rgb = Number.parseInt(hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex, 16); const luminance = (0.2126 * ((rgb >> 16) & 255)) + (0.7152 * ((rgb >> 8) & 255)) + (0.0722 * (rgb & 255));
    ctx.save(); ctx.translate(state.panX, state.panY); ctx.scale(state.zoom, state.zoom); ctx.fillStyle = luminance < 130 ? "#414653" : "#deddd6";
    const startX = Math.floor(left / step) * step; const startY = Math.floor(top / step) * step; const radius = 0.85 / state.zoom;
    for (let x = startX; x <= right; x += step) for (let y = startY; y <= bottom; y += step) { ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function transformHandlePoints(bounds: Bounds) {
    const midX = bounds.x + bounds.w / 2; const midY = bounds.y + bounds.h / 2; const offset = 24 / canvasState().zoom;
    return [{ id: "nw", x: bounds.x, y: bounds.y }, { id: "n", x: midX, y: bounds.y }, { id: "ne", x: bounds.x + bounds.w, y: bounds.y }, { id: "e", x: bounds.x + bounds.w, y: midY }, { id: "se", x: bounds.x + bounds.w, y: bounds.y + bounds.h }, { id: "s", x: midX, y: bounds.y + bounds.h }, { id: "sw", x: bounds.x, y: bounds.y + bounds.h }, { id: "w", x: bounds.x, y: midY }, { id: "rotate", x: midX, y: bounds.y - offset }];
  }

  function drawTransformHandles(ctx: CanvasRenderingContext2D, bounds: Bounds, zoom: number) {
    const handles = transformHandlePoints(bounds); const rotate = handles.pop()!; const top = { x: bounds.x + bounds.w / 2, y: bounds.y };
    ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = "#547bb1"; ctx.fillStyle = "#ffffff"; ctx.lineWidth = 1 / zoom;
    ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(rotate.x, rotate.y); ctx.stroke();
    for (const handle of handles) { ctx.beginPath(); ctx.rect(handle.x - 4 / zoom, handle.y - 4 / zoom, 8 / zoom, 8 / zoom); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(rotate.x, rotate.y, 5 / zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  }

  function findTransformHandle(point: Point): { index: number; handle: string } | undefined {
    if (selectedIndices().length !== 1) return undefined;
    const index = selectedIndices()[0]; const element = elements()[index]; if (!element || element.locked || element.type === "group" || element.type === "freehand") return undefined;
    for (const handle of transformHandlePoints(elementBounds(element))) if (Math.hypot(point.x - handle.x, point.y - handle.y) <= 9 / canvasState().zoom) return { index, handle: handle.id };
    return undefined;
  }

  function resizeElement(element: Element, handle: string, start: Point, point: Point): Element {
    if (element.type === "group" || element.type === "freehand") return element;
    if (handle === "rotate") {
      const bounds = elementBounds(element); const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
      const a = Math.atan2(start.y - center.y, start.x - center.x); const b = Math.atan2(point.y - center.y, point.x - center.x);
      return { ...element, rotation: (element.rotation ?? 0) + (b - a) * 180 / Math.PI };
    }
    if (element.type === "text") { const delta = handle.includes("e") || handle.includes("w") ? point.x - start.x : point.y - start.y; return { ...element, fontSize: Math.max(8, Math.min(160, element.fontSize + delta * 0.3)) }; }
    const bounds = { x: element.x, y: element.y, w: element.w, h: element.h }; let { x, y, w, h } = bounds; const dx = point.x - start.x; const dy = point.y - start.y;
    if (handle.includes("w")) { x += dx; w -= dx; } if (handle.includes("e")) w += dx;
    if (handle.includes("n")) { y += dy; h -= dy; } if (handle.includes("s")) h += dy;
    return { ...element, x, y, w: Math.max(2, w), h: Math.max(2, h) };
  }

  function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number, includeSelection: boolean, transparent = false, viewOverride?: CanvasState) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    if (!transparent) { ctx.fillStyle = renderedBoardColor(); ctx.fillRect(0, 0, width, height); }
    const state = viewOverride ?? canvasState(); if (!transparent) drawGrid(ctx, width, height, state);
    ctx.save(); ctx.translate(state.panX, state.panY); ctx.scale(state.zoom, state.zoom);
    const selected = selectedSet();
    elements().forEach((element, index) => {
      if (element.hidden) return;
      drawElement(ctx, element);
      const isSelected = selected.has(index);
      if (includeSelection && (isSelected || hoveredIndex() === index)) {
        const bounds = elementBounds(element); const padding = 5 / state.zoom;
        ctx.save(); ctx.strokeStyle = isSelected ? "#547bb1" : "#8298b8"; ctx.globalAlpha = isSelected ? 1 : 0.62; ctx.lineWidth = 1 / state.zoom; ctx.setLineDash([4 / state.zoom, 3 / state.zoom]);
        ctx.strokeRect(bounds.x - padding, bounds.y - padding, Math.max(bounds.w + padding * 2, 2 / state.zoom), Math.max(bounds.h + padding * 2, 2 / state.zoom)); ctx.restore();
        if (isSelected && !element.locked && selected.size === 1 && tool() === "select" && element.type !== "group" && element.type !== "freehand") drawTransformHandles(ctx, bounds, state.zoom);
      }
    });
    const guides = alignmentGuides();
    if (includeSelection && guides) {
      const left = -state.panX / state.zoom; const top = -state.panY / state.zoom; const right = (width - state.panX) / state.zoom; const bottom = (height - state.panY) / state.zoom;
      ctx.save(); ctx.strokeStyle = "#668fd0"; ctx.globalAlpha = .85; ctx.lineWidth = 1 / state.zoom; ctx.setLineDash([5 / state.zoom, 4 / state.zoom]); ctx.beginPath();
      if (guides.x !== undefined) { ctx.moveTo(guides.x, top); ctx.lineTo(guides.x, bottom); }
      if (guides.y !== undefined) { ctx.moveTo(left, guides.y); ctx.lineTo(right, guides.y); }
      ctx.stroke(); ctx.restore();
    }
    const activePreview = preview();
    if (activePreview) {
      const { start, end, type, color: stroke, thickness: widthPx } = activePreview;
      if (type === "pen") drawElement(ctx, { type: "freehand", points: currentPoints, color: stroke, thickness: widthPx });
      else drawElement(ctx, { type, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color: stroke, thickness: widthPx, flowchartShape: activePreview.flowchartShape, lineRoute: activePreview.lineRoute, arrowRoute: activePreview.arrowRoute, ...(fillEnabled() && (type === "rectangle" || type === "circle" || type === "diamond" || type === "flowchart") ? { fillColor: fillColor(), fillOpacity: fillOpacity() } : {}), ...(type === "arrow" ? { startHead: defaultStartHead(), endHead: defaultEndHead() } : {}) });
    }
    ctx.restore();
    if (includeSelection && marquee()) {
      const { start, end } = marquee()!; const left = Math.min(start.x, end.x) * state.zoom + state.panX; const top = Math.min(start.y, end.y) * state.zoom + state.panY;
      const width = Math.abs(end.x - start.x) * state.zoom; const height = Math.abs(end.y - start.y) * state.zoom;
      ctx.save(); ctx.strokeStyle = "#5888c5"; ctx.fillStyle = "#76a7e51a"; ctx.lineWidth = 1; ctx.setLineDash([5, 4]); ctx.fillRect(left, top, width, height); ctx.strokeRect(left, top, width, height); ctx.restore();
    }
  }

  function renderCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) { canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr); }
    const ctx = canvas.getContext("2d"); if (ctx) drawScene(ctx, rect.width, rect.height, dpr, true);
  }

  createEffect(() => { elements(); canvasState(); preview(); selectedIndices(); hoveredIndex(); showGrid(); marquee(); alignmentGuides(); theme(); boardColor(); boardColorFollowsTheme(); fillOpacity(); renderCanvas(); });
  createEffect(() => {
    if (!activePath() || !canvas) return;
    const resize = new ResizeObserver(renderCanvas); resize.observe(canvas);
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); const bounds = canvas.getBoundingClientRect(); const px = event.clientX - bounds.left; const py = event.clientY - bounds.top;
      const old = canvasState(); const nextZoom = Math.max(0.02, Math.min(8, old.zoom * Math.exp(-event.deltaY * 0.001)));
      const worldX = (px - old.panX) / old.zoom; const worldY = (py - old.panY) / old.zoom;
      setCanvasState({ zoom: nextZoom, panX: px - worldX * nextZoom, panY: py - worldY * nextZoom, backgroundColor: old.backgroundColor }); setDirty(true);
    };
    canvas.addEventListener("wheel", wheel, { passive: false });
    onCleanup(() => { resize.disconnect(); canvas.removeEventListener("wheel", wheel); });
  });
  createEffect(() => {
    const items = elements();
    const retained = new Set<string>();
    const visit = (children: Element[]) => { for (const child of children) { if (child.type === "image") retained.add(child.dataUrl); else if (child.type === "group") visit(child.elements); } };
    visit(items);
    for (const key of imageCache.keys()) if (!retained.has(key)) imageCache.delete(key);
    for (const key of retained) if (!imageCache.has(key)) { const image = new Image(); image.onload = () => { if (imageCache.get(key) === image) renderCanvas(); }; image.src = key; imageCache.set(key, image); }
  });
  createEffect(() => {
    if (!activePath() || !canvasWrap) return;
    const resize = new ResizeObserver(() => { setHistoryVersion((version) => version + 1); });
    resize.observe(canvasWrap);
    onCleanup(() => resize.disconnect());
  });

  onMount(() => {
    void invoke<string[]>("take_startup_files").then((paths) => {
      const path = paths.find((candidate) => candidate.toLowerCase().endsWith(".sketch"));
      if (path) void loadFile(path);
    }).catch((cause) => setError(`Could not check for a SketchDraw file to open: ${String(cause)}`));
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showClearConfirm()) { event.preventDefault(); setShowClearConfirm(false); return; }
        if (exportOptionsOpen()) { event.preventDefault(); setExportOptionsOpen(false); return; }
        if (recoveryPrompt() || syncConflict()) return;
        if (textDraft()) commitTextDraft();
        event.preventDefault(); setTool("select"); setSelectedIndices([]); setHoveredIndex(undefined); setMarquee(undefined); marqueeOrigin = undefined; resizeOrigin = undefined; moveOrigin = undefined; setPreview(undefined); drawing = false; setSpaceDown(false); setIsPanning(false); panOrigin = undefined;
        if (menu) menu.open = false; if (viewMenu) viewMenu.open = false; return;
      }
      if (recoveryPrompt() || syncConflict() || exportOptionsOpen() || showClearConfirm()) return;
      if (!activePath() || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return;
      if (event.code === "Space" && event.target instanceof HTMLElement && event.target.closest("button, summary, select, [role='menuitem']")) return;
      if (event.code === "Space") { if (!event.repeat) { event.preventDefault(); setSpaceDown(true); } return; }
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "n") { event.preventDefault(); void createFile(); return; }
      if ((event.ctrlKey || event.metaKey) && key === "o") { event.preventDefault(); void openFile(); return; }
      if ((event.ctrlKey || event.metaKey) && key === "s") { event.preventDefault(); if (activePath()) void saveToPath(activePath()!); else void saveAs(); return; }
      if ((event.ctrlKey || event.metaKey) && key === "g") { event.preventDefault(); if (event.shiftKey) ungroupSelection(); else groupSelection(); return; }
      if ((event.ctrlKey || event.metaKey) && key === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
      if ((event.ctrlKey || event.metaKey) && key === "y") { event.preventDefault(); redo(); return; }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (key === "g" && event.shiftKey) { setSnapToGrid((enabled) => !enabled); return; }
      if (key === "o" && event.shiftKey) { setSnapToObjects((enabled) => !enabled); return; }
      if (key === "g") { setShowGrid((visible) => !visible); return; }
      if (key === "k") { setBoardLocked((locked) => !locked); return; }
      if (key === "0") { resetZoomAndCenter(); return; }
      if (key === "v") setTool("select"); else if (key === "p") activateTool("pen"); else if (key === "r") activateTool("rectangle"); else if (key === "c" || key === "o") activateTool("circle"); else if (key === "d") activateTool("diamond"); else if (key === "l") activateTool("line"); else if (key === "a") activateTool("arrow"); else if (key === "f") activateTool("flowchart"); else if (key === "t") activateTool("text"); else if (key === "b") activateTool("bucket"); else if (key === "e") activateTool("eraser"); else if (key === "x") activateTool("crop");
      else if (key === "delete" || key === "backspace") { event.preventDefault(); deleteSelected(); }
    };
    const keyUp = (event: KeyboardEvent) => { if (event.code === "Space") setSpaceDown(false); };
    const blur = () => { setSpaceDown(false); setIsPanning(false); panOrigin = undefined; };
    const outsideClick = (event: PointerEvent) => { if (menu?.open && !menu.contains(event.target as Node)) menu.open = false; if (viewMenu?.open && !viewMenu.contains(event.target as Node)) viewMenu.open = false; };
    const closeMenuOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { if (menu?.open) menu.open = false; if (viewMenu?.open) viewMenu.open = false; } };
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    setSystemDark(colorScheme.matches); colorScheme.addEventListener("change", updateSystemTheme);
    let closeInProgress = false;
    let unlistenClose: (() => void) | undefined;
    void getCurrentWindow().onCloseRequested(async (event) => {
      if (!dirty() && !textDraft() && !saving()) return;
      event.preventDefault();
      if (closeInProgress) return;
      closeInProgress = true;
      try {
        if (textDraft()) commitTextDraft();
        persistRecovery();
        while (saveInFlight) await new Promise<void>((resolve) => window.setTimeout(resolve, 30));
        const path = activePath();
        if (path && dirty() && !syncConflict()) await saveToPath(path);
        // The original close request was prevented while the async save ran.
        // Remove this listener before requesting close again so it cannot
        // intercept its own retry. Recovery data has already been persisted
        // if the save failed or a cloud-sync conflict blocked it.
        unlistenClose?.();
        unlistenClose = undefined;
        await getCurrentWindow().destroy();
      } catch (cause) {
        setError(`Could not close SketchDraw: ${String(cause)}`);
        closeInProgress = false;
      }
    }).then((unlisten) => { unlistenClose = unlisten; }).catch((cause) => setError(`Could not prepare safe closing: ${String(cause)}`));
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp); window.addEventListener("blur", blur);
    document.addEventListener("pointerdown", outsideClick); document.addEventListener("keydown", closeMenuOnEscape);
    const timer = window.setInterval(() => { if (activePath() && dirty() && !recoveryPrompt()) { persistRecovery(); if (!syncConflict() && !saveInFlight) void saveToPath(activePath()!); } }, 1750);
    onCleanup(() => { unlistenClose?.(); window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", blur); document.removeEventListener("pointerdown", outsideClick); document.removeEventListener("keydown", closeMenuOnEscape); colorScheme.removeEventListener("change", updateSystemTheme); window.clearInterval(timer); });
  });

  function setThemePreference(mode: ThemeMode) {
    setThemeMode(mode);
    try { if (mode === "system") localStorage.removeItem("sketchdraw-theme"); else localStorage.setItem("sketchdraw-theme", mode); } catch { /* Theme still applies for this session. */ }
  }

  const recoveryKey = (path: string) => `sketchdraw-recovery:${encodeURIComponent(path)}`;
  function persistRecovery() {
    if (!activePath() || !dirty()) return;
    try { localStorage.setItem(recoveryKey(activePath()!), JSON.stringify({ savedAt: Date.now(), baselineRaw: lastSavedRaw, snapshot: documentSnapshot() })); } catch { /* Recovery is best-effort if browser storage is unavailable. */ }
  }

  function applySnapshot(snapshot: SketchFile, path: string, rawText: string) {
    const currentPage = snapshot.pages.find((page) => page.id === snapshot.activePageId) ?? snapshot.pages[0];
    setPages(snapshot.pages.map((page) => ({ ...page, elements: cloneElements(page.elements) })));
    setActivePageId(currentPage.id); setElements(cloneElements(currentPage.elements)); setCanvasState({ ...currentPage.canvasState });
    setBoardColor(currentPage.canvasState.backgroundColor); setBoardColorFollowsTheme(currentPage.canvasState.boardColorFollowsTheme ?? false);
    setActivePath(path); rememberFile(path); setDirty(false); setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })); setSelectedIndices([]); setHoveredIndex(undefined); setBoardLocked(false); lastSavedRaw = rawText;
    undoStack = []; redoStack = []; setHistoryVersion((version) => version + 1); setError("");
  }

  function restoreRecovery() {
    const recovery = recoveryPrompt(); if (!recovery) return;
    const baseline = lastSavedRaw ?? "";
    applySnapshot(recovery.snapshot, recovery.path, baseline);
    try { localStorage.removeItem(recoveryKey(recovery.path)); } catch { /* Best effort. */ }
    setDirty(true); setRecoveryPrompt(undefined);
    if (recovery.baselineRaw !== undefined && recovery.baselineRaw !== baseline) { setSyncConflict({ path: recovery.path, remote: baseline }); return; }
    if (elements().length) requestAnimationFrame(() => fitDocumentToViewport(elements()));
  }
  function discardRecovery() {
    const recovery = recoveryPrompt(); if (!recovery) return;
    try { localStorage.removeItem(recoveryKey(recovery.path)); } catch { /* Best effort. */ }
    setRecoveryPrompt(undefined);
  }
  function reloadConflictingFile() {
    const conflict = syncConflict(); if (!conflict) return;
    try {
      const parsed = parseSketchFile(JSON.parse(conflict.remote));
      if (!parsed) throw new Error("The updated file is not a valid SketchDraw document.");
      applySnapshot(parsed, conflict.path, conflict.remote); setSyncConflict(undefined);
      try { localStorage.removeItem(recoveryKey(conflict.path)); } catch { /* Best effort. */ }
      if (elements().length) requestAnimationFrame(() => fitDocumentToViewport(elements()));
    } catch (cause) { setError(`Could not reload the synchronized file: ${String(cause)}`); }
  }
  function overwriteConflictingFile() {
    const conflict = syncConflict(); if (!conflict) return;
    setSyncConflict(undefined); void saveToPath(conflict.path, true);
  }

  async function saveToPath(path: string, force = false) {
    if (saveInFlight || recoveryPrompt()) return;
    saveInFlight = true; setSaving(true);
    try {
      const snapshot = documentSnapshot();
      const encodedSnapshot = snapshotRaw(snapshot);
      const isNewPath = activePath() !== path;
      if (!isNewPath && !force && lastSavedRaw !== undefined) {
        const diskRaw = await readTextFile(path);
        if (diskRaw !== lastSavedRaw) { setSyncConflict({ path, remote: diskRaw }); return; }
      }
      await writeTextFile(path, encodedSnapshot); setActivePath(path); if (isNewPath) rememberFile(path);
      lastSavedRaw = encodedSnapshot;
      setSyncConflict(undefined);
      try { localStorage.removeItem(recoveryKey(path)); } catch { /* Recovery cleanup is best-effort. */ }
      setDirty(snapshotRaw(documentSnapshot()) !== encodedSnapshot);
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })); setError("");
    } catch (cause) { setError(`Could not save file: ${String(cause)}`); }
    finally { saveInFlight = false; setSaving(false); }
  }

  async function saveAs() {
    try {
      const path = await save({ title: "Save SketchDraw file", defaultPath: "Untitled.sketch", filters: [{ name: "SketchDraw", extensions: ["sketch"] }] });
      if (path) await saveToPath(withSketchExtension(path));
    } catch (cause) { setError(`Could not choose save location: ${String(cause)}`); }
  }

  function rememberFile(path: string) {
    const updated = [path, ...recentFiles().filter((recent) => recent !== path)].slice(0, 8);
    setRecentFiles(updated);
    try { localStorage.setItem("sketchdraw-recent-files", JSON.stringify(updated)); } catch { /* Local storage may be disabled by the host. */ }
  }

  async function saveBeforeReplacingDocument(): Promise<boolean> {
    const path = activePath();
    if (!path) return true;
    if (syncConflict()) return false;
    if (dirty()) {
      while (saveInFlight) await new Promise<void>((resolve) => window.setTimeout(resolve, 30));
      if (activePath() !== path || syncConflict()) return false;
      if (dirty()) await saveToPath(path);
      if (dirty() || syncConflict()) { setError("The current sketch could not be saved, so it was kept open."); return false; }
    }
    return true;
  }

  async function loadFile(path: string) {
    try {
      if (!path.toLowerCase().endsWith(".sketch")) throw new Error("Only .sketch documents are supported.");
      if (!await saveBeforeReplacingDocument()) return;
      // Recent paths survive app restarts, but Tauri's file-dialog scope does
      // not. Re-authorize this one existing SketchDraw file before reading it.
      const authorizedPath = await invoke<string>("authorize_sketch_file", { path });
      const rawText = await readTextFile(authorizedPath);
      const raw: unknown = JSON.parse(rawText);
      const parsed = parseSketchFile(raw);
      if (!parsed) throw new Error("This file is invalid or is not a SketchDraw v4 document.");
      applySnapshot(parsed, authorizedPath, rawText);
      try {
        const stored = localStorage.getItem(recoveryKey(authorizedPath));
        if (stored) {
          const entry: unknown = JSON.parse(stored);
          const recovered = isRecord(entry) ? parseSketchFile(entry.snapshot) : undefined;
          const baselineRaw = isRecord(entry) && typeof entry.baselineRaw === "string" ? entry.baselineRaw : undefined;
          if (recovered && snapshotRaw(recovered) !== snapshotRaw(parsed)) setRecoveryPrompt({ path: authorizedPath, snapshot: recovered, baselineRaw });
          else localStorage.removeItem(recoveryKey(authorizedPath));
        }
      } catch { /* Ignore malformed recovery data and leave the source file untouched. */ }
      if (elements().length) requestAnimationFrame(() => fitDocumentToViewport(elements()));
    } catch (cause) { setError(`Could not open file: ${String(cause)}`); }
  }

  async function openFile() {
    try {
      const selected = await open({ title: "Open SketchDraw file", multiple: false, filters: [{ name: "SketchDraw", extensions: ["sketch"] }] });
      if (!selected || Array.isArray(selected)) return;
      await loadFile(selected);
    } catch (cause) { setError(`Could not choose file: ${String(cause)}`); }
  }

  async function importImage() {
    if (boardLocked()) return;
    try {
      const selected = await open({ title: "Import image", multiple: false, filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }] });
      if (!selected || Array.isArray(selected)) return;
      const bytes = await readFile(selected); let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const extension = selected.split(".").pop()?.toLowerCase(); const mime = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : extension === "webp" ? "image/webp" : extension === "gif" ? "image/gif" : "image/png";
      const dataUrl = `data:${mime};base64,${btoa(binary)}`; const image = new Image(); image.src = dataUrl;
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Could not load image.")); });
      const width = Math.min(700, image.naturalWidth); const height = image.naturalHeight * width / image.naturalWidth; const rect = canvas.getBoundingClientRect(); const view = canvasState();
      const item: ImageElement = { type: "image", x: (rect.width / 2 - view.panX) / view.zoom - width / 2, y: (rect.height / 2 - view.panY) / view.zoom - height / 2, w: width, h: height, dataUrl, sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight };
      pushUndo(cloneElements(elements())); setElements((items) => [...items, item]); imageCache.set(dataUrl, image); setSelectedIndices([elements().length]); setDirty(true);
    } catch (cause) { setError(`Could not import image: ${String(cause)}`); }
  }

  function toggleLayer(index: number, property: "hidden" | "locked") {
    if (boardLocked()) return;
    const before = cloneElements(elements()); setElements((items) => items.map((element, current) => current === index ? { ...element, [property]: !element[property] } as Element : element)); pushUndo(before); setDirty(true);
  }

  function moveLayer(index: number, direction: -1 | 1) {
    if (boardLocked()) return;
    const target = index + direction; if (target < 0 || target >= elements().length || !elements()[index] || !elements()[target] || !canMoveElement(elements()[index]) || !canMoveElement(elements()[target])) return;
    const before = cloneElements(elements()); const items = [...elements()]; [items[index], items[target]] = [items[target], items[index]];
    setElements(items); setSelectedIndices(selectedIndices().map((selected) => selected === index ? target : selected === target ? index : selected)); pushUndo(before); setDirty(true);
  }

  async function createFile() {
    try {
      const selected = await save({ title: "Create SketchDraw file", defaultPath: "Untitled.sketch", filters: [{ name: "SketchDraw", extensions: ["sketch"] }] });
      if (!selected) return;
      if (!await saveBeforeReplacingDocument()) return;
      const path = withSketchExtension(selected);
      const page: SketchPage = { id: "page-1", name: "Page 1", canvasState: emptyCanvas(), elements: [] };
      const document: SketchFile = { format: "SketchDraw", version: 4, activePageId: page.id, pages: [page] };
      const contents = JSON.stringify(document, null, 2);
      await writeTextFile(path, contents);
      setPages([page]); setActivePageId(page.id); setElements([]); setCanvasState(emptyCanvas()); setBoardColor("#ffffff"); setBoardColorFollowsTheme(true); setSelectedIndices([]); setHoveredIndex(undefined); setActivePath(path); rememberFile(path); setDirty(false); setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })); setBoardLocked(false); setError(""); lastSavedRaw = contents;
      undoStack = []; redoStack = []; setHistoryVersion((version) => version + 1);
    } catch (cause) { setError(`Could not create SketchDraw file: ${String(cause)}`); }
  }

  function openExportOptions(format: "png" | "pdf") { setExportFormat(format); setExportOptionsOpen(true); }

  function imagePdf(jpeg: Uint8Array, width: number, height: number): Uint8Array {
    const encoder = new TextEncoder(); const parts: Uint8Array[] = []; const offsets: number[] = []; let size = 0;
    const add = (part: Uint8Array) => { parts.push(part); size += part.length; };
    const ascii = (text: string) => encoder.encode(text);
    add(ascii("%PDF-1.4\n%SketchDraw\n"));
    const object = (id: number, body: Uint8Array) => { offsets[id] = size; add(ascii(`${id} 0 obj\n`)); add(body); add(ascii("\nendobj\n")); };
    object(1, ascii("<< /Type /Catalog /Pages 2 0 R >>"));
    object(2, ascii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"));
    object(3, ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
    offsets[4] = size; add(ascii(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`)); add(jpeg); add(ascii("\nendstream\nendobj\n"));
    const content = ascii(`q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ`);
    object(5, new Uint8Array([...ascii(`<< /Length ${content.length} >>\nstream\n`), ...content, ...ascii("\nendstream")]));
    const xrefStart = size; let xref = "xref\n0 6\n0000000000 65535 f \n";
    for (let id = 1; id <= 5; id++) xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    add(ascii(`${xref}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`));
    const output = new Uint8Array(size); let cursor = 0; for (const part of parts) { output.set(part, cursor); cursor += part.length; } return output;
  }

  async function exportAs(format: "png" | "svg" | "pdf") {
    if (!canvas) return;
    try {
      if ((format === "png" || format === "pdf") && (!Number.isFinite(exportWidth()) || !Number.isFinite(exportHeight()) || exportWidth() < 1 || exportHeight() < 1 || exportWidth() > 12000 || exportHeight() > 12000 || exportWidth() * exportHeight() > 60_000_000)) throw new Error("Choose dimensions between 1 and 12,000 pixels, totaling no more than 60 megapixels.");
      const path = await save({ title: `Export SketchDraw as ${format.toUpperCase()}`, defaultPath: `SketchDraw.${format}`, filters: [{ name: format.toUpperCase(), extensions: [format] }] });
      if (!path) return;
      const target = path.toLowerCase().endsWith(`.${format}`) ? path : `${path}.${format}`;
      const rect = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
      if (format === "png" || format === "pdf") {
        const width = Math.max(1, Math.min(12000, Math.floor(exportWidth()))); const height = Math.max(1, Math.min(12000, Math.floor(exportHeight())));
        if (width * height > 60_000_000) throw new Error("Export is too large. Choose dimensions totaling no more than 60 megapixels.");
        const output = document.createElement("canvas"); output.width = width; output.height = height;
        const ctx = output.getContext("2d"); if (!ctx) throw new Error("Could not create PNG image.");
        const scale = Math.min(width / rect.width, height / rect.height); const view = canvasState();
        const exportView = { ...view, zoom: view.zoom * scale, panX: view.panX * scale + (width - rect.width * scale) / 2, panY: view.panY * scale + (height - rect.height * scale) / 2 };
        drawScene(ctx, width, height, 1, false, format === "png" && exportTransparent(), exportView);
        const mime = format === "pdf" ? "image/jpeg" : "image/png";
        const blob = await new Promise<Blob>((resolve, reject) => output.toBlob((value) => value ? resolve(value) : reject(new Error(`${format.toUpperCase()} image encoding failed.`)), mime, .94));
        if (format === "png") await writeFile(target, new Uint8Array(await blob.arrayBuffer()));
        else await writeFile(target, imagePdf(new Uint8Array(await blob.arrayBuffer()), width, height));
      } else {
        const state = canvasState();
        const shapes = elements().map(elementToSvg).join("\n");
        const grid = showGrid() ? `<pattern id="grid" width="${GRID_SIZE * state.zoom}" height="${GRID_SIZE * state.zoom}" patternUnits="userSpaceOnUse" x="${state.panX}" y="${state.panY}"><circle cx="1" cy="1" r="1" fill="#deddd6"/></pattern><rect width="100%" height="100%" fill="url(#grid)"/>` : "";
        const svgBackground = renderedBoardColor();
        const svgGrid = theme() === "dark" ? "#414653" : "#deddd6";
        const themedGrid = grid.replace("#deddd6", svgGrid);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(rect.width * dpr)}" height="${Math.round(rect.height * dpr)}" viewBox="0 0 ${rect.width} ${rect.height}"><rect width="100%" height="100%" fill="${svgBackground}"/>${themedGrid}<g transform="translate(${state.panX} ${state.panY}) scale(${state.zoom})">${shapes}</g></svg>`;
        await writeTextFile(target, svg);
      }
      setError("");
    } catch (cause) { setError(`Could not export image: ${String(cause)}`); }
  }

  function elementToSvg(element: Element): string {
    if (element.hidden) return "";
    if (element.type === "group") return `<g>${element.elements.map(elementToSvg).join("")}</g>`;
    const bounds = elementBounds(element); const cx = bounds.x + bounds.w / 2; const cy = bounds.y + bounds.h / 2;
    const content = elementSvgBody(element);
    return element.rotation ? `<g transform="rotate(${element.rotation} ${cx} ${cy})">${content}</g>` : content;
  }

  function elementSvgBody(element: Element): string {
    if (element.type === "group") return `<g>${element.elements.map(elementToSvg).join("")}</g>`;
    if (element.hidden) return "";
    if (element.type === "image") { const sx = element.cropX ?? 0; const sy = element.cropY ?? 0; const sw = element.cropW ?? element.sourceWidth ?? element.w; const sh = element.cropH ?? element.sourceHeight ?? element.h; return `<svg x="${element.x}" y="${element.y}" width="${element.w}" height="${element.h}" viewBox="${sx} ${sy} ${sw} ${sh}" preserveAspectRatio="none" opacity="${element.opacity ?? 1}"><image width="${element.sourceWidth ?? sw}" height="${element.sourceHeight ?? sh}" href="${element.dataUrl}"/></svg>`; }
    if (element.type === "text") {
      const family = element.fontFamily === "hand" ? "cursive" : "sans-serif";
      const lines = element.text.split(/\r?\n/).map((line, index) => { const formatted = element.listType === "bullet" ? `• ${line}` : element.listType === "number" ? `${index + 1}. ${line}` : line; return `<tspan x="${element.x}" dy="${index === 0 ? 0 : element.fontSize * 1.25}">${escapeXml(formatted)}</tspan>`; }).join("");
      return `<text x="${element.x}" y="${element.y + element.fontSize}" fill="${escapeXml(element.color)}" opacity="${element.opacity ?? 1}" font-size="${element.fontSize}" font-family="${family}" font-weight="${element.bold ? "700" : "400"}" font-style="${element.italic ? "italic" : "normal"}" text-decoration="${element.underline ? "underline" : "none"}" text-anchor="${element.textAlign === "center" ? "middle" : element.textAlign === "right" ? "end" : "start"}">${lines}</text>`;
    }
    const fillColor = "fillColor" in element ? element.fillColor : undefined;
    const dash = "lineStyle" in element && element.lineStyle === "dashed" ? `${element.thickness * 4} ${element.thickness * 2.5}` : "lineStyle" in element && element.lineStyle === "dotted" ? `${element.thickness} ${element.thickness * 2.2}` : "";
    const fillOpacity = "fillOpacity" in element ? element.fillOpacity ?? 0.2 : 0.2;
    const style = `fill="${fillColor ? escapeXml(fillColor) : "none"}"${fillColor ? ` fill-opacity="${fillOpacity}"` : ""} stroke="${escapeXml(element.color)}" stroke-opacity="${element.opacity ?? 1}" stroke-width="${element.thickness}" stroke-dasharray="${dash}" stroke-linecap="round" stroke-linejoin="round"`;
    if (element.type === "freehand") {
      if (!element.points.length) return "";
      let d = `M ${element.points[0].x} ${element.points[0].y}`;
      for (let i = 1; i < element.points.length; i++) {
        const a = element.points[i - 1]; const b = element.points[i]; const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        d += ` Q ${a.x} ${a.y} ${mid.x} ${mid.y}`;
      }
      const last = element.points[element.points.length - 1]; d += ` L ${last.x} ${last.y}`;
      return `<path d="${d}" ${style}/>`;
    }
    if (element.type === "rectangle") return `<rect x="${Math.min(element.x, element.x + element.w)}" y="${Math.min(element.y, element.y + element.h)}" width="${Math.abs(element.w)}" height="${Math.abs(element.h)}" ${style}/>`;
    if (element.type === "diamond") return `<path d="M ${element.x + element.w / 2} ${element.y} L ${element.x + element.w} ${element.y + element.h / 2} L ${element.x + element.w / 2} ${element.y + element.h} L ${element.x} ${element.y + element.h / 2} Z" ${style}/>`;
    if (element.type === "circle") return `<ellipse cx="${element.x + element.w / 2}" cy="${element.y + element.h / 2}" rx="${Math.abs(element.w / 2)}" ry="${Math.abs(element.h / 2)}" ${style}/>`;
    if (element.type === "flowchart") {
      const detail = flowchartSvgDetailPath(element);
      const detailStyle = `fill="none" stroke="${escapeXml(element.color)}" stroke-opacity="${element.opacity ?? 1}" stroke-width="${element.thickness}" stroke-dasharray="${dash}" stroke-linecap="round" stroke-linejoin="round"`;
      return `<path d="${flowchartSvgPath(element)}" ${style}/>${detail ? `<path d="${detail}" ${detailStyle}/>` : ""}`;
    }
    if (element.type === "line" || element.type === "arrow") {
      const path = connectorSvgPath(element); const route = element.arrowRoute ?? "straight";
      const shift = element.lineStyle === "double" ? Math.max(2.5, element.thickness * 1.2) : 0; const normal = { x: -element.h / Math.max(1, Math.hypot(element.w, element.h)), y: element.w / Math.max(1, Math.hypot(element.w, element.h)) };
      const paths = shift ? `<path d="${path}" transform="translate(${normal.x * shift} ${normal.y * shift})" ${style}/><path d="${path}" transform="translate(${-normal.x * shift} ${-normal.y * shift})" ${style}/>` : `<path d="${path}" ${style}/>`;
      if (element.type !== "arrow") return paths;
      const headSvg = (tip: Point, direction: number, kind: ArrowHead) => {
        if (kind === "none") return "";
        if (kind === "dot") return `<circle cx="${tip.x}" cy="${tip.y}" r="${Math.max(3, element.thickness * 1.15)}" fill="${element.color}"/>`;
        const points = arrowHeadPoints(tip, direction, kind, element.thickness); const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");
        if (kind === "solid" || kind === "thick" || kind === "diamond") return `<polygon points="${polygon}" fill="${element.color}" stroke="${element.color}" stroke-width="${element.thickness}"/>`;
        if (kind === "open") return `<path d="M ${tip.x} ${tip.y} L ${points[0].x} ${points[0].y} M ${tip.x} ${tip.y} L ${points[1].x} ${points[1].y}" ${style}/>`;
        return `<path d="M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}" ${style}/>`;
      };
      return `${paths}${arrowHeadEntries(element, route).map(({ tip, angle: direction, kind }) => headSvg(tip, direction, kind)).join("")}`;
    }
    return "";
  }

  function escapeXml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" })[char]!); }

  function pointerDown(event: PointerEvent) {
    if (!activePath()) return;
    if (event.button === 1 || spaceDown() || tool() === "pan") {
      event.preventDefault(); setIsPanning(true); panOrigin = { x: event.clientX, y: event.clientY, panX: canvasState().panX, panY: canvasState().panY }; canvas.setPointerCapture(event.pointerId); return;
    }
    if (event.button !== 0) return;
    const point = toWorld(event);
    if (boardLocked()) return;
    if (tool() === "select") {
      const handle = findTransformHandle(point);
      if (handle) { const original = elements()[handle.index]; resizeOrigin = { ...handle, start: point, original: cloneElements([original])[0], before: cloneElements(elements()), moved: false }; canvas.setPointerCapture(event.pointerId); return; }
      const hit = hitTest(point);
      if (hit !== undefined) {
        const current = selectedIndices();
        const next = event.shiftKey
          ? current.includes(hit) ? current.filter((index) => index !== hit) : [...current, hit]
          : current.includes(hit) ? current : [hit];
        setSelectedIndices(next);
        const movable = next.filter((index) => { const element = elements()[index]; return !!element && canMoveElement(element); });
        if (movable.includes(hit)) moveOrigin = { indices: movable, point, before: cloneElements(elements()), moved: false };
      } else {
        if (!event.shiftKey) setSelectedIndices([]);
        marqueeOrigin = { point, additive: event.shiftKey, moved: false };
        setMarquee({ start: point, end: point });
      }
      canvas.setPointerCapture(event.pointerId); return;
    }
    if (tool() === "text") {
      if (textDraft()) { commitTextDraft(); return; }
      const hit = hitTest(point); startTextDraft(point, hit !== undefined && elements()[hit]?.type === "text" ? hit : undefined); return;
    }
    if (tool() === "bucket") { const hit = hitInterior(point); if (hit !== undefined) { setSelectedIndices([hit]); updatePropertyForIndex(hit, fillColor()); } return; }
    if (tool() === "eraser") { eraseAtPoint(point); drawing = true; canvas.setPointerCapture(event.pointerId); return; }
    if (tool() === "crop") { const hit = hitTest(point); if (hit !== undefined && elements()[hit].type === "image") { setSelectedIndices([hit]); marqueeOrigin = { point, additive: false, moved: false, cropIndex: hit }; setMarquee({ start: point, end: point }); canvas.setPointerCapture(event.pointerId); } return; }
    drawing = true; canvas.setPointerCapture(event.pointerId);
    activeDrawingTool = tool() as Preview["type"];
    const start = activeDrawingTool === "pen" ? point : snap(point);
    if (activeDrawingTool === "pen") { currentPoints = [point]; setPreview({ type: "pen", start: point, end: point, color: color(), thickness: thickness() }); }
    else setPreview({ type: activeDrawingTool, start, end: start, color: color(), thickness: thickness(), ...(activeDrawingTool === "flowchart" ? { flowchartShape: flowchartShape() } : {}), ...(activeDrawingTool === "line" ? { lineRoute: lineRoute() } : {}), ...(activeDrawingTool === "arrow" ? { arrowRoute: arrowRoute() } : {}) });
  }

  function pointerMove(event: PointerEvent) {
    if (marqueeOrigin) {
      const end = toWorld(event);
      if (Math.hypot(end.x - marqueeOrigin.point.x, end.y - marqueeOrigin.point.y) > 2 / canvasState().zoom) marqueeOrigin.moved = true;
      setMarquee((current) => current ? { ...current, end } : undefined); return;
    }
    if (panOrigin) {
      setCanvasState({ ...canvasState(), panX: panOrigin.panX + event.clientX - panOrigin.x, panY: panOrigin.panY + event.clientY - panOrigin.y }); setDirty(true);
      return;
    }
    if (resizeOrigin) {
      const point = toWorld(event); if (Math.hypot(point.x - resizeOrigin.start.x, point.y - resizeOrigin.start.y) > 0.5) resizeOrigin.moved = true;
      const resized = resizeElement(resizeOrigin.original, resizeOrigin.handle, resizeOrigin.start, point);
      setElements(resizeOrigin.before.map((element, index) => index === resizeOrigin!.index ? resized : element)); setDirty(true); return;
    }
    if (moveOrigin) {
      const point = toWorld(event); const dx = point.x - moveOrigin.point.x; const dy = point.y - moveOrigin.point.y;
      if (Math.hypot(dx, dy) > 0.5) moveOrigin.moved = true;
      if (moveOrigin.moved) {
        const { indices, before } = moveOrigin; const selected = new Set(indices);
        const snapped = snapTranslation(indices, before, dx, dy);
        setElements(before.map((element, itemIndex) => selected.has(itemIndex) ? moveElement(element, snapped.dx, snapped.dy) : element)); setDirty(true);
      }
      return;
    }
    if (!drawing) {
      setHoveredIndex(tool() === "select" ? hitTest(toWorld(event)) : undefined);
      return;
    }
    if (tool() === "eraser") { eraseAtPoint(toWorld(event)); return; }
    const raw = toWorld(event); const point = activeDrawingTool === "pen" ? raw : snap(raw);
    if (activeDrawingTool === "pen") currentPoints.push(point);
    setPreview((previous) => previous ? { ...previous, end: point } : undefined);
  }

  function moveElement(element: Element, dx: number, dy: number): Element {
    if (element.locked) return element;
    if (element.type === "group") return { ...element, elements: element.elements.map((child) => moveElement(child, dx, dy)) };
    if (element.type === "freehand") return { ...element, points: element.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
    return { ...element, x: element.x + dx, y: element.y + dy };
  }

  function canMoveElement(element: Element): boolean {
    return !element.locked && (element.type !== "group" || element.elements.every(canMoveElement));
  }

  function snapTranslation(indices: number[], before: Element[], dx: number, dy: number) {
    if (!snapToObjects()) { setAlignmentGuides(undefined); return { dx, dy }; }
    const selected = new Set(indices); const moving = unionBounds(before.flatMap((element, index) => selected.has(index) && !element.hidden ? [elementBounds(element)] : []));
    if (!moving || !before.some((element, index) => !selected.has(index) && !element.hidden)) { setAlignmentGuides(undefined); return { dx, dy }; }
    const left = moving.x; const top = moving.y; const right = moving.x + moving.w; const bottom = moving.y + moving.h;
    const movingX = [left, (left + right) / 2, right]; const movingY = [top, (top + bottom) / 2, bottom];
    const threshold = 8 / canvasState().zoom;
    const closest = (axis: "x" | "y", movingValues: number[], delta: number) => {
      let best: { correction: number; guide: number } | undefined;
      for (let index = 0; index < before.length; index++) {
        const element = before[index]; if (selected.has(index) || element.hidden) continue;
        const box = elementBounds(element); const targets = axis === "x" ? [box.x, box.x + box.w / 2, box.x + box.w] : [box.y, box.y + box.h / 2, box.y + box.h];
        for (const source of movingValues) for (const target of targets) {
          const correction = target - (source + delta);
          if (Math.abs(correction) <= threshold && (!best || Math.abs(correction) < Math.abs(best.correction))) best = { correction, guide: target };
        }
      }
      return best;
    };
    const x = closest("x", movingX, dx); const y = closest("y", movingY, dy);
    setAlignmentGuides(x || y ? { x: x?.guide, y: y?.guide } : undefined);
    return { dx: dx + (x?.correction ?? 0), dy: dy + (y?.correction ?? 0) };
  }

  function hitInterior(point: Point): number | undefined {
    for (let index = elements().length - 1; index >= 0; index--) {
      const element = elements()[index]; if (element.hidden || element.locked) continue;
      if (element.type === "rectangle" && point.x >= Math.min(element.x, element.x + element.w) && point.x <= Math.max(element.x, element.x + element.w) && point.y >= Math.min(element.y, element.y + element.h) && point.y <= Math.max(element.y, element.y + element.h)) return index;
      if (element.type === "circle") { const rx = Math.abs(element.w / 2); const ry = Math.abs(element.h / 2); if (rx && ry && ((point.x - element.x - element.w / 2) / rx) ** 2 + ((point.y - element.y - element.h / 2) / ry) ** 2 <= 1) return index; }
      if (element.type === "diamond") { const left = Math.min(element.x, element.x + element.w); const right = Math.max(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const bottom = Math.max(element.y, element.y + element.h); if (pointInPolygon(point, [{ x: (left + right) / 2, y: top }, { x: right, y: (top + bottom) / 2 }, { x: (left + right) / 2, y: bottom }, { x: left, y: (top + bottom) / 2 }])) return index; }
      if (element.type === "flowchart") { const context = canvas?.getContext("2d"); if (context) { context.save(); context.setTransform(1, 0, 0, 1, 0, 0); traceFlowchart(context, element.flowchartShape ?? "process", element.x, element.y, element.w, element.h); const inside = context.isPointInPath(point.x, point.y); context.restore(); if (inside) return index; } }
    }
    return undefined;
  }

  function updatePropertyForIndex(index: number, value: string) {
    const before = cloneElements(elements()); setElements((items) => items.map((element, current) => current === index && (element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "flowchart") ? { ...element, fillColor: value, fillOpacity: 1 } : element)); pushUndo(before); setDirty(true);
  }

  function eraseAtPoint(point: Point) {
    const hit = hitTest(point); if (hit === undefined) return;
    const before = cloneElements(elements()); setElements((items) => items.filter((_, index) => index !== hit)); setSelectedIndices((indices) => indices.filter((index) => index !== hit).map((index) => index > hit ? index - 1 : index)); pushUndo(before); setDirty(true);
  }

  function pointerUp() {
    if (panOrigin) { panOrigin = undefined; setIsPanning(false); return; }
    if (marqueeOrigin) {
      const activeMarquee = marquee();
      if (activeMarquee && marqueeOrigin.moved) {
        const box = { x: Math.min(activeMarquee.start.x, activeMarquee.end.x), y: Math.min(activeMarquee.start.y, activeMarquee.end.y), w: Math.abs(activeMarquee.end.x - activeMarquee.start.x), h: Math.abs(activeMarquee.end.y - activeMarquee.start.y) };
        if (marqueeOrigin.cropIndex !== undefined) {
          const index = marqueeOrigin.cropIndex; const image = elements()[index]; const bitmap = image?.type === "image" ? imageCache.get(image.dataUrl) : undefined;
          if (image?.type === "image" && bitmap?.naturalWidth && box.w > 2 && box.h > 2) {
            const sourceX = image.cropX ?? 0; const sourceY = image.cropY ?? 0; const sourceW = image.cropW ?? bitmap.naturalWidth; const sourceH = image.cropH ?? bitmap.naturalHeight;
            const left = Math.max(image.x, box.x); const top = Math.max(image.y, box.y); const right = Math.min(image.x + image.w, box.x + box.w); const bottom = Math.min(image.y + image.h, box.y + box.h);
            if (right > left && bottom > top) { const before = cloneElements(elements()); const sx = sourceX + (left - image.x) / image.w * sourceW; const sy = sourceY + (top - image.y) / image.h * sourceH; const sw = (right - left) / image.w * sourceW; const sh = (bottom - top) / image.h * sourceH; setElements((items) => items.map((element, current) => current === index && element.type === "image" ? { ...element, x: left, y: top, w: right - left, h: bottom - top, cropX: sx, cropY: sy, cropW: sw, cropH: sh } : element)); pushUndo(before); setDirty(true); }
          }
          marqueeOrigin = undefined; setMarquee(undefined); return;
        }
        const overlaps: number[] = [];
        elements().forEach((element, index) => {
          if (element.hidden || element.locked) return;
          const bounds = elementBounds(element);
          if (bounds.x >= box.x && bounds.y >= box.y && bounds.x + bounds.w <= box.x + box.w && bounds.y + bounds.h <= box.y + box.h) overlaps.push(index);
        });
        setSelectedIndices(marqueeOrigin.additive ? [...new Set([...selectedIndices(), ...overlaps])] : overlaps);
      }
      marqueeOrigin = undefined; setMarquee(undefined); return;
    }
    if (resizeOrigin) { if (resizeOrigin.moved) pushUndo(resizeOrigin.before); resizeOrigin = undefined; return; }
    if (moveOrigin) { if (moveOrigin.moved) pushUndo(moveOrigin.before); moveOrigin = undefined; setAlignmentGuides(undefined); return; }
    if (!drawing) return;
    if (tool() === "eraser") { drawing = false; return; }
    drawing = false; const activePreview = preview();
    if (activePreview) {
      const item: Element = activePreview.type === "pen"
        ? { type: "freehand", points: [...currentPoints], color: activePreview.color, thickness: activePreview.thickness }
        : { type: activePreview.type, x: activePreview.start.x, y: activePreview.start.y, w: activePreview.end.x - activePreview.start.x, h: activePreview.end.y - activePreview.start.y, color: activePreview.color, thickness: activePreview.thickness, lineStyle: lineStyle(), edgeStyle: edgeStyle(), flowchartShape: activePreview.type === "flowchart" ? activePreview.flowchartShape : undefined, lineRoute: activePreview.type === "line" ? activePreview.lineRoute : undefined, arrowRoute: activePreview.type === "arrow" ? activePreview.arrowRoute : undefined, ...(fillEnabled() && (activePreview.type === "rectangle" || activePreview.type === "circle" || activePreview.type === "diamond" || activePreview.type === "flowchart") ? { fillColor: fillColor(), fillOpacity: fillOpacity() } : {}), ...(activePreview.type === "arrow" ? { startHead: defaultStartHead(), endHead: defaultEndHead() } : {}) } as ShapeElement;
      const valid = activePreview.type === "pen" ? currentPoints.length > 0 : Math.hypot(activePreview.end.x - activePreview.start.x, activePreview.end.y - activePreview.start.y) > 1;
      if (valid) { pushUndo(cloneElements(elements())); setElements((items) => [...items, item]); setDirty(true); }
    }
    currentPoints = []; setPreview(undefined);
  }

  const tools: { value: Tool; label: string; key: string; path: string }[] = [
    { value: "select", label: "Select", key: "V", path: "M5 3l14 11-7 .8-3 6z" },
    { value: "pan", label: "Hand / Pan", key: "Space", path: "M8 11V5a1.5 1.5 0 0 1 3 0v5-6a1.5 1.5 0 0 1 3 0v6-5a1.5 1.5 0 0 1 3 0v7-3a1.5 1.5 0 0 1 3 0v5c0 5-3 8-8 8h-1c-3 0-5-2-6-4l-2-4a1.5 1.5 0 0 1 2.5-1.5L8 15" },
    { value: "pen", label: "Pen", key: "P", path: "M4 20l4.5-1 10.8-10.8a2.2 2.2 0 0 0-3.1-3.1L5.4 15.9 4 20zM14.8 6.3l3 3" },
    { value: "line", label: "Line", key: "L", path: "M4 20L20 4" },
    { value: "arrow", label: "Arrow", key: "A", path: "M4 19L19 4M9 4h10v10" },
    { value: "rectangle", label: "Rectangle", key: "R", path: "M5 5h14v14H5z" },
    { value: "circle", label: "Circle", key: "C", path: "M19.5 12a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0z" },
    { value: "diamond", label: "Diamond", key: "D", path: "M12 3 21 12 12 21 3 12z" },
    { value: "flowchart", label: "Flowchart shapes", key: "F", path: "M4 4h6v6H4zM14 4h6v6h-6zM9 14l4 0 3 3-3 3H9l-3-3z" },
    { value: "text", label: "Text", key: "T", path: "M5 6h14M12 6v13M8 19h8" },
    { value: "bucket", label: "Fill bucket", key: "B", path: "M4 14l6-6 8 8-6 6H4zM10 8l3-3 8 8-3 3M18 19h.01" },
    { value: "eraser", label: "Eraser", key: "E", path: "M3 14l9-10 9 9-8 8H7zM12 18l5-5" },
    { value: "crop", label: "Crop image", key: "X", path: "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 8h8v8H8z" },
  ];
  const swatches = ["#252525", "#e76b62", "#6b91c9", "#74a582", "#d8a448", "#a581bb", "#e5915b"];
  const updateTextDraft = (value: string) => setTextDraft((draft) => draft ? { ...draft, value } : undefined);
  const setTextFormat = (property: "bold" | "italic" | "underline" | "textAlign" | "listType" | "fontSize" | "fontFamily", value: boolean | string | number) => {
    if (selectedText()) updateProperty(property, value);
    else {
      if (property === "bold") setDefaultBold(Boolean(value)); else if (property === "italic") setDefaultItalic(Boolean(value)); else if (property === "underline") setDefaultUnderline(Boolean(value));
      else if (property === "textAlign") setDefaultTextAlign(value as "left" | "center" | "right"); else if (property === "listType") setDefaultListType(value as "none" | "bullet" | "number");
      else if (property === "fontSize") setDefaultFontSize(Number(value)); else if (property === "fontFamily") setDefaultFontFamily(value as "sans" | "hand");
    }
    setTextDraft((draft) => draft ? { ...draft, [property]: value } : undefined);
  };
  const rotateSelection = (delta: number) => { if (boardLocked()) return; const index = primarySelection(); const item = index === undefined ? undefined : elements()[index]; if (!item || item.locked || item.type === "group") return; const before = cloneElements(elements()); setElements((items) => items.map((element, i) => i === index ? { ...element, rotation: (element.rotation ?? 0) + delta } as Element : element)); pushUndo(before); setDirty(true); };
  const resetSelectionRotation = () => { const index = primarySelection(); const item = index === undefined ? undefined : elements()[index]; if (boardLocked() || !item || item.locked || item.type === "group" || (item.rotation ?? 0) === 0) return; const before = cloneElements(elements()); setElements((items) => items.map((element, i) => i === index ? { ...element, rotation: 0 } as Element : element)); pushUndo(before); setDirty(true); };
  const closeSystemMenu = (action: () => void) => { if (menu) menu.open = false; if (viewMenu) viewMenu.open = false; action(); };
  const activateTool = (next: Tool) => { const chosen = tool() === next && next !== "select" ? "select" : next; setTool(chosen); if (chosen !== "select" && chosen !== "pan") setSelectedIndices([]); };
  return (
    <main class={`app-shell theme-${theme()}`}>
      <header class="topbar">
        <div class="header-leading"><div class="brand"><img class="brand-mark-image" src={sketchDrawMark} alt="" /><span>{activePath() ? fileName() : "SketchDraw"}</span></div></div>
        <nav class="app-menus" aria-label="Application menus">
          <details class="menu-dropdown" ref={menu}><summary>File<svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg></summary><div class="system-menu-popover"><div class="menu-file-label">{activePath() ? fileName() : "No file open"}</div>
            <button onClick={() => closeSystemMenu(() => void createFile())}>New sketch <kbd>Ctrl+N</kbd></button><button onClick={() => closeSystemMenu(() => void openFile())}>Open sketch <kbd>Ctrl+O</kbd></button><button onClick={() => closeSystemMenu(() => { if (activePath()) void saveToPath(activePath()!); else void saveAs(); })}>Save <kbd>Ctrl+S</kbd></button><button onClick={() => closeSystemMenu(() => void saveAs())}>Save as...</button><button onClick={() => closeSystemMenu(() => void importImage())}>Import image...</button><div class="menu-separator" /><button onClick={() => closeSystemMenu(() => openExportOptions("png"))}>Export PNG...</button><button onClick={() => closeSystemMenu(() => openExportOptions("pdf"))}>Export PDF...</button><button onClick={() => closeSystemMenu(() => void exportAs("svg"))}>Export SVG...</button><button disabled={!elements().length || boardLocked()} onClick={() => closeSystemMenu(() => setShowClearConfirm(true))}>Clear canvas</button>
          </div></details>
          <details class="menu-dropdown" ref={viewMenu}><summary>View<svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg></summary><div class="system-menu-popover view-popover"><span class="menu-section-title">Appearance</span><div class="theme-options"><button class={themeMode() === "system" ? "active" : ""} onClick={() => closeSystemMenu(() => setThemePreference("system"))} title="Use system theme"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z"/></svg><span>System</span></button><button class={themeMode() === "light" ? "active" : ""} onClick={() => closeSystemMenu(() => setThemePreference("light"))} title="Light theme"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><span>Light</span></button><button class={themeMode() === "dark" ? "active" : ""} onClick={() => closeSystemMenu(() => setThemePreference("dark"))} title="Dark theme"><svg viewBox="0 0 24 24"><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5z"/></svg><span>Dark</span></button></div><div class="menu-separator" /><span class="menu-section-title">Whiteboard</span><div class="view-colors"><button class={`board-auto-button ${boardColorFollowsTheme() ? "active" : ""}`} title="Match the canvas to the active theme" disabled={boardLocked()} onClick={() => closeSystemMenu(() => { setBoardColorFollowsTheme(true); setCanvasState({ ...canvasState(), boardColorFollowsTheme: true }); setDirty(true); })}>Auto</button>{BOARD_COLORS.map((value) => <button class={`color-swatch ${!boardColorFollowsTheme() && boardColor() === value ? "active" : ""}`} style={{ background: value }} aria-label={`Whiteboard ${value}`} title={value} disabled={boardLocked()} onClick={() => closeSystemMenu(() => { if (!boardLocked()) { setBoardColor(value); setBoardColorFollowsTheme(false); setCanvasState({ ...canvasState(), backgroundColor: value, boardColorFollowsTheme: false }); setDirty(true); } })} />)}<label class="custom-color-swatch" title="Custom whiteboard color"><input aria-label="Custom whiteboard color" type="color" value={renderedBoardColor()} disabled={boardLocked()} onInput={(event) => { if (!boardLocked()) { setBoardColor(event.currentTarget.value); setBoardColorFollowsTheme(false); setCanvasState({ ...canvasState(), backgroundColor: event.currentTarget.value, boardColorFollowsTheme: false }); setDirty(true); } }} /></label></div></div></details>
        </nav>
        <div class="canvas-toolbar" aria-label="Canvas actions"><button class={`header-control ${showGrid() ? "active" : ""}`} title="Toggle grid (G)" aria-label="Toggle grid (G)" onClick={() => setShowGrid((visible) => !visible)}><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM4 10h16M10 4v16"/></svg><kbd>G</kbd></button><button class={`header-control ${snapToObjects() ? "active" : ""}`} title="Snap to other objects (Shift+O)" aria-label="Snap to other objects (Shift+O)" onClick={() => setSnapToObjects((enabled) => !enabled)}><svg viewBox="0 0 24 24"><path d="M5 5h5v5H5zM14 14h5v5h-5zM10 7.5h4M16.5 10v4"/></svg><kbd>⇧O</kbd></button><button class={`header-control ${snapToGrid() ? "active" : ""}`} title="Toggle snap to grid (Shift+G)" aria-label="Toggle snap to grid (Shift+G)" onClick={() => setSnapToGrid((enabled) => !enabled)}><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM8 8h8v8H8z"/></svg><kbd>⇧G</kbd></button><button class="header-control" disabled={!canUndo() || boardLocked()} title="Undo (Ctrl/Cmd+Z)" aria-label="Undo" onClick={undo}><svg viewBox="0 0 24 24"><path d="M9 7 4 12l5 5M5 12h8a6 6 0 0 1 6 6"/></svg><kbd>Ctrl Z</kbd></button><button class="header-control" disabled={!canRedo() || boardLocked()} title="Redo (Ctrl/Cmd+Y)" aria-label="Redo" onClick={redo}><svg viewBox="0 0 24 24"><path d="m15 7 5 5-5 5m4-5h-8a6 6 0 0 0-6 6"/></svg><kbd>Ctrl Y</kbd></button><button class={`header-control group-control ${groupSelected() ? "active" : ""}`} disabled={!groupActionEnabled() || boardLocked()} title="Group / ungroup (Ctrl/Cmd+G)" aria-label="Group or ungroup" onClick={groupSelection}><svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="9" height="9" rx="1.5"/><rect x="11.5" y="11" width="9" height="9" rx="1.5"/></svg><kbd>Ctrl G</kbd></button><button class={`header-control ${boardLocked() ? "active" : ""}`} title="Toggle canvas lock (K)" aria-label="Toggle canvas lock" onClick={() => setBoardLocked((locked) => !locked)}><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d={boardLocked() ? "M8 10V7a4 4 0 1 1 8 0v3" : "M8 10V7a4 4 0 0 1 8 0"}/></svg><kbd>K</kbd></button><button class="header-control reset-zoom" title="Center drawing and reset zoom to 100% (0)" aria-label={`Center drawing and reset zoom, currently ${Math.round(canvasState().zoom * 100)} percent`} onClick={resetZoomAndCenter}><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M10.5 7v7m-3.5-3.5h7"/></svg><kbd>{Math.round(canvasState().zoom * 100)}%</kbd></button></div>
        <div class="top-actions"><span class={`save-status ${saving() ? "is-saving" : dirty() ? "is-dirty" : "is-saved"}`} role="status" aria-live="polite" aria-label={status()} title={status()}><i /><time>{savedAt() || "—"}</time></span></div>
      </header>
      <Show when={activePath()} fallback={<section class="welcome-screen"><div class="welcome-card"><div class="welcome-symbol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" /></svg></div><p class="eyebrow">A quiet place to think</p><h1>Make space for<br /><em>your next idea.</em></h1><p class="welcome-copy">A simple, private canvas saved as a file on your device. Keep it in any folder, including your cloud drive.</p><div class="welcome-actions"><button class="save-button large" onClick={createFile}>Create new file <span aria-hidden="true">→</span></button><button class="quiet-button large" onClick={openFile}>Open a sketch</button></div><div class="file-hint"><span class="file-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h5" /></svg></span><span><strong>Your work stays yours</strong><br />Saved locally as a portable .sketch file.</span></div></div><div class="recent-dashboard"><div class="recent-heading"><span class="eyebrow">FILE BROWSER</span><h2>Recent sketches</h2></div><Show when={recentFiles().length > 0} fallback={<div class="recent-empty"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h5" /></svg><strong>No recent sketches yet</strong><span>Open a .sketch file or create a new one.</span><button class="quiet-button" onClick={openFile}>Browse for a file</button></div>}><div class="recent-list">{recentFiles().map((path) => <button class="recent-file" onClick={() => void loadFile(path)}><span class="recent-file-icon"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h5" /></svg></span><span class="recent-file-name">{path.split(/[\\/]/).pop()}</span><span class="recent-file-path">{path}</span><span class="recent-open">Open →</span></button>)}</div></Show></div></section>}>
        <>
          <section class="canvas-wrap" ref={canvasWrap}>
            <canvas ref={canvas} class="drawing-canvas" style={{ cursor: isPanning() ? "grabbing" : spaceDown() || tool() === "pan" ? "grab" : boardLocked() ? "not-allowed" : tool() === "select" ? hoveredIndex() !== undefined ? "move" : "default" : tool() === "text" ? "text" : tool() === "eraser" ? "cell" : tool() === "bucket" ? "copy" : tool() === "crop" ? "crosshair" : "crosshair" }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onPointerLeave={() => { if (!moveOrigin && !resizeOrigin) setHoveredIndex(undefined); }} onDblClick={(event) => { if (boardLocked()) return; event.preventDefault(); const rect = canvas.getBoundingClientRect(); const view = canvasState(); const point = { x: (event.clientX - rect.left - view.panX) / view.zoom, y: (event.clientY - rect.top - view.panY) / view.zoom }; const hit = hitTest(point); startTextDraft(point, hit !== undefined && elements()[hit]?.type === "text" ? hit : undefined); }} onContextMenu={(event) => event.preventDefault()} />
            <nav class="page-tabs" aria-label="Sketch pages"><div class="page-tab-list">{pages().map((page) => <button class={`page-tab ${page.id === activePageId() ? "active" : ""}`} title={page.name} onClick={() => switchPage(page.id)} onDblClick={() => { if (boardLocked()) return; const name = window.prompt("Rename page", page.name)?.trim(); if (name) { setPages((items) => items.map((item) => item.id === page.id ? { ...item, name: name.slice(0, 80) } : item)); setDirty(true); } }}>{page.name}</button>)}</div><button class="page-tab-add" title="Add page" aria-label="Add page" disabled={boardLocked() || pages().length >= 100} onClick={addPage}>+</button><button class="page-tab-delete" title="Delete current page" aria-label="Delete current page" disabled={boardLocked() || pages().length <= 1} onClick={() => { if (window.confirm(`Delete “${currentPage()?.name ?? "Page"}”?`)) deleteCurrentPage(); }}>×</button></nav>
            <Show when={toolBarOpen()} fallback={<button class="tool-deck-reopen" title="Show tools" aria-label="Show tools" onClick={() => setToolBarOpen(true)}><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg></button>}><nav class="tool-deck" aria-label="Canvas tools">{tools.map(({ value, label, key, path }) => { const active = tool() === value || (value === "pan" && spaceDown()); const hasOptions = value === "flowchart" || value === "line" || value === "arrow"; const button = <button class={`tool-icon-button ${active ? "selected" : ""} ${hasOptions ? "has-options" : ""}`} title={`${label} (${key})${hasOptions ? " · hover for more options" : ""}`} aria-label={label} aria-haspopup={hasOptions ? "menu" : undefined} aria-pressed={active} onClick={() => activateTool(value)}><svg viewBox="0 0 24 24" aria-hidden="true">{value === "flowchart" ? <><path d="M12 8v3m0 3v2m-1.5-5h3"/><rect x="9.5" y="2.5" width="5" height="5" rx="1"/><path d="m12 14 3 3-3 3-3-3z"/><rect x="9.5" y="15.5" width="5" height="5" rx="1"/></> : <path d={path} />}</svg><kbd>{key}</kbd>{hasOptions && <svg class="tool-family-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3"/></svg>}</button>;
              if (value === "flowchart") return <div class="tool-family flowchart-family">{button}<div class="tool-options flowchart-options" role="menu" aria-label="Flowchart symbols">{FLOWCHART_SHAPES.map((shape) => <button class={flowchartShape() === shape.value ? "active" : ""} role="menuitem" title={shape.label} aria-label={shape.label} onClick={() => { setFlowchartShape(shape.value); setTool("flowchart"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d={shape.path} /></svg><span>{shape.label}</span></button>)}</div></div>;
              if (value === "line") return <div class="tool-family route-family">{button}<div class="tool-options route-options" role="menu" aria-label="Line routes">{LINE_ROUTES.map((route) => <button class={lineRoute() === route.value ? "active" : ""} role="menuitem" title={route.label} aria-label={route.label} onClick={() => { setLineRoute(route.value); setTool("line"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d={route.path} /></svg><span>{route.label}</span></button>)}</div></div>;
              if (value === "arrow") return <div class="tool-family route-family">{button}<div class="tool-options route-options" role="menu" aria-label="Arrow routes">{ARROW_ROUTES.map((route) => <button class={arrowRoute() === route.value ? "active" : ""} role="menuitem" title={route.label} aria-label={route.label} onClick={() => { setArrowRoute(route.value); setTool("arrow"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d={route.path} /></svg><span>{route.label}</span></button>)}</div></div>;
              return button; })}<button class="tool-collapse" title="Hide tools" aria-label="Hide tools" onClick={() => setToolBarOpen(false)}><svg viewBox="0 0 24 24"><path d="m7 14 5-5 5 5" /></svg></button></nav></Show>
            <button class={`sidebar-toggle ${sidebarOpen() ? "open" : "closed"}`} title={sidebarOpen() ? "Collapse sidebar" : "Expand sidebar"} aria-label={sidebarOpen() ? "Collapse sidebar" : "Expand sidebar"} onClick={() => setSidebarOpen((value) => !value)}><svg viewBox="0 0 24 24"><path d={sidebarOpen() ? "m14 5-7 7 7 7" : "m10 5 7 7-7 7"} /></svg></button>
            <aside class={`style-pane ${sidebarOpen() ? "" : "collapsed"}`} aria-label="Properties and layers">
              <nav class="sidebar-tabs"><button class={sidebarTab() === "properties" ? "active" : ""} onClick={() => setSidebarTab("properties")}>Properties</button><button class={sidebarTab() === "layers" ? "active" : ""} onClick={() => setSidebarTab("layers")}>Layers <span>{elements().length}</span></button></nav>
              <Show when={sidebarTab() === "properties"}>
                <section class="pane-section"><div class="pane-heading">Stroke color</div><div class="swatch-list stroke-swatches">{swatches.map((swatch) => <button class={`color-swatch ${selectedColor() === swatch ? "active" : ""}`} style={{ background: swatch }} aria-label={`Set color ${swatch}`} title={swatch} onClick={() => updateStrokeColor(swatch)} />)}<label class="custom-color-swatch stroke-custom-swatch" title="Custom stroke color"><input aria-label="Custom stroke color" type="color" value={selectedColor()} onInput={(event) => updateStrokeColor(event.currentTarget.value)} /></label></div></section>
                <Show when={focusedElement()?.type !== "text" && focusedElement()?.type !== "image"}><section class="pane-section"><div class="pane-heading">Stroke width <span>{selectedThickness()} px</span></div><div class="preset-list">{([[1, "Ultra-thin"], [2, "Thin"], [4, "Default"], [5, "Medium"], [10, "Bold"]] as const).map(([value, label]) => <button class={`preset-button ${selectedThickness() === value ? "active" : ""}`} onClick={() => updateThickness(value)} title={`${label}, ${value}px`}><span class="stroke-indicator" style={{ height: `${Math.max(1, value)}px` }} /><small>{label}</small><small>{value}px</small></button>)}</div><button class="advanced-toggle" aria-expanded={showAdvancedThickness()} onClick={() => setShowAdvancedThickness((visible) => !visible)}>Custom width <span>{showAdvancedThickness() ? "−" : "+"}</span></button><Show when={showAdvancedThickness()}><input class="pane-slider" aria-label="Custom stroke thickness" type="range" min="1" max="24" value={selectedThickness()} onInput={(event) => updateThickness(Number(event.currentTarget.value))} /></Show></section></Show>
                <Show when={tool() === "text" || selectedText()}><section class="pane-section"><div class="pane-heading">Text formatting</div><div class="format-row"><button class={(selectedText()?.bold ?? defaultBold()) ? "active" : ""} aria-label="Bold" title="Bold" onClick={() => setTextFormat("bold", !(selectedText()?.bold ?? defaultBold()))}><b>B</b></button><button class={(selectedText()?.italic ?? defaultItalic()) ? "active" : ""} aria-label="Italic" title="Italic" onClick={() => setTextFormat("italic", !(selectedText()?.italic ?? defaultItalic()))}><i>I</i></button><button class={(selectedText()?.underline ?? defaultUnderline()) ? "active" : ""} aria-label="Underline" title="Underline" onClick={() => setTextFormat("underline", !(selectedText()?.underline ?? defaultUnderline()))}><u>U</u></button></div><label class="property-label">Font size<input type="number" min="8" max="160" value={selectedText()?.fontSize ?? defaultFontSize()} onInput={(event) => setTextFormat("fontSize", Number(event.currentTarget.value))} /></label><div class="property-label">Font family<div class="choice-deck"><button class={(selectedText()?.fontFamily ?? defaultFontFamily()) === "sans" ? "active" : ""} title="Modern sans-serif" aria-label="Modern sans-serif font" onClick={() => setTextFormat("fontFamily", "sans")}><span class="font-sans-icon">Aa</span><small>Sans</small></button><button class={(selectedText()?.fontFamily ?? defaultFontFamily()) === "hand" ? "active" : ""} title="Handwritten font" aria-label="Handwritten font" onClick={() => setTextFormat("fontFamily", "hand")}><span class="font-hand-icon">Aa</span><small>Hand</small></button></div></div><div class="property-label">Alignment<div class="choice-deck compact"><button class={(selectedText()?.textAlign ?? defaultTextAlign()) === "left" ? "active" : ""} title="Align left" aria-label="Align left" onClick={() => setTextFormat("textAlign", "left")}><svg viewBox="0 0 24 24"><path d="M4 5h16M4 10h11M4 15h16M4 20h11"/></svg></button><button class={(selectedText()?.textAlign ?? defaultTextAlign()) === "center" ? "active" : ""} title="Align center" aria-label="Align center" onClick={() => setTextFormat("textAlign", "center")}><svg viewBox="0 0 24 24"><path d="M4 5h16M7 10h10M4 15h16M7 20h10"/></svg></button><button class={(selectedText()?.textAlign ?? defaultTextAlign()) === "right" ? "active" : ""} title="Align right" aria-label="Align right" onClick={() => setTextFormat("textAlign", "right")}><svg viewBox="0 0 24 24"><path d="M4 5h16M9 10h11M4 15h16M9 20h11"/></svg></button></div></div><div class="property-label">Paragraphs<div class="choice-deck compact"><button class={(selectedText()?.listType ?? defaultListType()) === "none" ? "active" : ""} title="Plain paragraphs" aria-label="Plain paragraphs" onClick={() => setTextFormat("listType", "none")}><svg viewBox="0 0 24 24"><path d="M5 6h15M5 12h15M5 18h15"/></svg></button><button class={(selectedText()?.listType ?? defaultListType()) === "bullet" ? "active" : ""} title="Bulleted list" aria-label="Bulleted list" onClick={() => setTextFormat("listType", "bullet")}><svg viewBox="0 0 24 24"><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/><path d="M9 6h11M9 12h11M9 18h11"/></svg></button><button class={(selectedText()?.listType ?? defaultListType()) === "number" ? "active" : ""} title="Numbered list" aria-label="Numbered list" onClick={() => setTextFormat("listType", "number")}><svg viewBox="0 0 24 24"><path d="M4 5h2v3M4 8h3M4 12h3l-3 3h3M10 6h10M10 12h10M10 18h10"/></svg></button></div></div></section></Show>
                <Show when={tool() === "line" || tool() === "arrow" || tool() === "rectangle" || tool() === "circle" || tool() === "diamond" || tool() === "flowchart" || ["line", "arrow", "rectangle", "circle", "diamond", "flowchart"].includes(focusedElement()?.type ?? "")}><section class="pane-section"><div class="pane-heading">Line style</div><div class="choice-deck line-choices"><button class={((focusedElement() as ShapeElement | undefined)?.lineStyle ?? lineStyle()) === "solid" ? "active" : ""} title="Solid line" aria-label="Solid line" onClick={() => focusedElement() ? updateProperty("lineStyle", "solid") : setLineStyle("solid")}><svg viewBox="0 0 24 24"><path d="M3 12h18"/></svg><small>Solid</small></button><button class={((focusedElement() as ShapeElement | undefined)?.lineStyle ?? lineStyle()) === "dashed" ? "active" : ""} title="Dashed line" aria-label="Dashed line" onClick={() => focusedElement() ? updateProperty("lineStyle", "dashed") : setLineStyle("dashed")}><svg viewBox="0 0 24 24" class="dash-icon"><path d="M3 12h18"/></svg><small>Dash</small></button><button class={((focusedElement() as ShapeElement | undefined)?.lineStyle ?? lineStyle()) === "dotted" ? "active" : ""} title="Dotted line" aria-label="Dotted line" onClick={() => focusedElement() ? updateProperty("lineStyle", "dotted") : setLineStyle("dotted")}><svg viewBox="0 0 24 24" class="dot-icon"><path d="M3 12h18"/></svg><small>Dot</small></button><Show when={tool() === "line" || tool() === "arrow" || focusedElement()?.type === "line" || focusedElement()?.type === "arrow"}><button class={((focusedElement() as ShapeElement | undefined)?.lineStyle ?? lineStyle()) === "double" ? "active" : ""} title="Double line" aria-label="Double line" onClick={() => focusedElement() ? updateProperty("lineStyle", "double") : setLineStyle("double")}><svg viewBox="0 0 24 24"><path d="M3 9h18M3 15h18"/></svg><small>Double</small></button></Show></div><Show when={focusedElement()?.type === "rectangle" || tool() === "rectangle"}><div class="property-label">Corners<div class="choice-deck compact"><button class={((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "sharp" ? "active" : ""} title="Square corners" aria-label="Square corners" onClick={() => focusedElement() ? updateProperty("edgeStyle", "sharp") : setEdgeStyle("sharp")}><svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14"/></svg></button><button class={((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "rounded" ? "active" : ""} title="Rounded corners" aria-label="Rounded corners" onClick={() => focusedElement() ? updateProperty("edgeStyle", "rounded") : setEdgeStyle("rounded")}><svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="4"/></svg></button></div></div></Show><Show when={tool() === "arrow" || focusedElement()?.type === "arrow"}><div class="arrow-head-config"><span>Start head</span><div class="choice-deck arrow-head-choices">{ARROW_HEADS.map(({ value, label }) => <button class={((focusedElement() as ShapeElement | undefined)?.startHead ?? defaultStartHead()) === value ? "active" : ""} title={`${label} start`} aria-label={`${label} start head`} onClick={() => focusedElement()?.type === "arrow" ? updateProperty("startHead", value) : setDefaultStartHead(value)}><ArrowHeadIcon kind={value} /></button>)}</div><span>End head</span><div class="choice-deck arrow-head-choices">{ARROW_HEADS.map(({ value, label }) => <button class={((focusedElement() as ShapeElement | undefined)?.endHead ?? defaultEndHead()) === value ? "active" : ""} title={`${label} end`} aria-label={`${label} end head`} onClick={() => focusedElement()?.type === "arrow" ? updateProperty("endHead", value) : setDefaultEndHead(value)}><ArrowHeadIcon kind={value} /></button>)}</div></div></Show></section></Show>
            <Show when={tool() === "bucket"}><section class="pane-section"><div class="pane-heading">Bucket fill</div><p class="bucket-help">Click a closed shape to apply a solid color.</p><div class="fill-palette">{FILL_SWATCHES.map((swatch) => <button class={`color-swatch ${fillColor() === swatch ? "active" : ""}`} style={{ background: swatch }} aria-label={`Bucket color ${swatch}`} title={`Use ${swatch}`} onClick={() => setFillColor(swatch)} />)}<label class="custom-color-swatch" title="Choose custom bucket color"><input aria-label="Custom bucket color" type="color" value={fillColor()} onInput={(event) => setFillColor(event.currentTarget.value)} /></label></div></section></Show>
            <Show when={tool() === "line" || focusedElement()?.type === "line"}><section class="pane-section"><div class="pane-heading">Line route</div><div class="connector-route-buttons">{LINE_ROUTES.map((route) => <button class={(focusedElement()?.type === "line" ? (focusedElement() as ShapeElement).lineRoute : lineRoute()) === route.value ? "active" : ""} title={route.label} aria-label={`${route.label} line`} onClick={() => focusedElement()?.type === "line" ? updateProperty("lineRoute", route.value) : setLineRoute(route.value)}><svg viewBox="0 0 24 24"><path d={route.path} /></svg><small>{route.label}</small></button>)}</div></section></Show>
<Show when={tool() === "arrow" || focusedElement()?.type === "arrow"}><section class="pane-section"><div class="pane-heading">Arrow route</div><div class="connector-route-buttons">{ARROW_ROUTES.map((route) => <button class={(focusedElement()?.type === "arrow" ? (focusedElement() as ShapeElement).arrowRoute : arrowRoute()) === route.value ? "active" : ""} title={route.label} aria-label={`${route.label} arrow`} onClick={() => focusedElement()?.type === "arrow" ? updateProperty("arrowRoute", route.value) : setArrowRoute(route.value)}><svg viewBox="0 0 24 24"><path d={route.path} /></svg><small>{route.label}</small></button>)}</div></section></Show><Show when={tool() === "rectangle" || tool() === "circle" || tool() === "diamond" || tool() === "flowchart" || focusedElement()?.type === "rectangle" || focusedElement()?.type === "circle" || focusedElement()?.type === "diamond" || focusedElement()?.type === "flowchart"}><section class="pane-section"><div class="pane-heading">Fill</div><div class="fill-options"><button class={!(selectedFillColor()) && !fillEnabled() ? "active" : ""} onClick={() => { setFillEnabled(false); if (selectedIndices().length) updateProperty("fillColor", undefined); }}>None</button><button class={fillEnabled() || !!selectedFillColor() ? "active" : ""} onClick={() => { setFillEnabled(true); if (selectedIndices().length) updateProperty("fillColor", fillColor()); }}>Solid</button></div><div class="fill-style-row"><label class="fill-color-chip" title="Fill color"><input aria-label="Fill color" type="color" value={selectedFillColor() ?? fillColor()} onInput={(event) => { const value = event.currentTarget.value; setFillColor(value); if (selectedIndices().length) updateProperty("fillColor", value); }} /></label><label class="fill-opacity-control">Opacity<input aria-label="Fill opacity" type="range" min="5" max="100" value={Math.round(((focusedElement() as ShapeElement | undefined)?.fillOpacity ?? fillOpacity()) * 100)} onInput={(event) => { const value = Number(event.currentTarget.value) / 100; setFillOpacity(value); if (selectedIndices().length) updateProperty("fillOpacity", value); }} /><span>{Math.round(((focusedElement() as ShapeElement | undefined)?.fillOpacity ?? fillOpacity()) * 100)}%</span></label></div></section></Show>
                <Show when={!!selectedIndices().length}><section class="pane-section"><div class="pane-heading">Selection</div><label class="property-label">Opacity <input disabled={selectedIndices().every((index) => !elements()[index] || elements()[index].locked)} type="range" min="10" max="100" value={Math.round(selectedOpacity() * 100)} onInput={(event) => updateProperty("opacity", Number(event.currentTarget.value) / 100)} /></label><Show when={!groupSelected()}><div class="rotation-controls"><button disabled={focusedElement()?.locked} onClick={() => rotateSelection(-15)} title="Rotate counterclockwise by 15 degrees">−15°</button><button disabled={focusedElement()?.locked} onClick={resetSelectionRotation} title="Reset rotation to zero">Reset 0°</button><button disabled={focusedElement()?.locked} onClick={() => rotateSelection(15)} title="Rotate clockwise by 15 degrees">+15°</button></div></Show></section></Show>
                <Show when={selectedIndices().length > 1 && !groupSelected()}><button class="pane-group-button" onClick={groupSelection}>Group {selectedIndices().length} elements <kbd>Ctrl+G</kbd></button></Show>
              </Show>
              <Show when={sidebarTab() === "layers"}><div class="layer-list">{[...elements().keys()].reverse().map((index) => { const element = elements()[index]; const label = element.type === "text" ? `Text: ${element.text.slice(0, 18) || "Empty"}` : element.type === "group" ? `Group (${element.elements.length})` : element.type[0].toUpperCase() + element.type.slice(1); return <div class={`layer-row ${selectedSet().has(index) ? "selected" : ""}`}><button class="layer-name" onClick={() => setSelectedIndices([index])}>{label}</button><button title="Move layer up" aria-label="Move layer up" onClick={() => moveLayer(index, 1)}>↑</button><button title="Move layer down" aria-label="Move layer down" onClick={() => moveLayer(index, -1)}>↓</button><button title={element.hidden ? "Show layer" : "Hide layer"} aria-label="Toggle layer visibility" onClick={() => toggleLayer(index, "hidden")}>{element.hidden ? "Show" : "Hide"}</button><button title={element.locked ? "Unlock layer" : "Lock layer"} aria-label="Toggle layer lock" onClick={() => toggleLayer(index, "locked")}>{element.locked ? "Unlock" : "Lock"}</button></div>; })}</div></Show>
            </aside>
            <Show when={textDraft()}>{(draft) => <div ref={(element) => { textInput = element; requestAnimationFrame(() => { if (textInput && !textInput.innerText) textInput.innerText = draft().value; textInput?.focus(); }); }} class="canvas-text-editor" contentEditable={true} role="textbox" aria-label="Canvas text" aria-multiline="true" data-placeholder="Type here..." style={`left:${canvasState().panX + draft().x * canvasState().zoom}px;top:${canvasState().panY + draft().y * canvasState().zoom}px;width:${Math.max(160, Math.min(480, draft().value.length * 14 + 20))}px;font-size:${draft().fontSize * canvasState().zoom}px;color:${draft().color};opacity:${draft().opacity};font-family:${draft().fontFamily === "hand" ? "cursive" : "'DM Sans',sans-serif"};font-weight:${draft().bold ? 700 : 400};font-style:${draft().italic ? "italic" : "normal"};text-decoration:${draft().underline ? "underline" : "none"};text-align:${draft().textAlign}`} onInput={(event) => updateTextDraft(event.currentTarget.innerText)} onBlur={commitTextDraft} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape" || (event.key === "Enter" && (event.ctrlKey || event.metaKey))) { event.preventDefault(); commitTextDraft(); if (event.key === "Escape") { setTool("select"); setSelectedIndices([]); setHoveredIndex(undefined); } } }} />}</Show>
            <div class="canvas-help">Wheel to zoom <span>|</span> Hold Space or select the hand tool to pan <span>|</span> V to select and drag to move</div>
          </section>
        </>
      </Show>
      <Show when={exportOptionsOpen()}><div class="confirm-backdrop"><section class="confirm-dialog export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title"><h2 id="export-title">Export {exportFormat().toUpperCase()}</h2><p>Choose the output dimensions. Maximum 60 megapixels. PDF is exported as a raster snapshot.</p><div class="export-dimensions"><label>Width<input type="number" min="1" max="12000" value={exportWidth()} onInput={(event) => setExportWidth(Number(event.currentTarget.value))} /></label><span>×</span><label>Height<input type="number" min="1" max="12000" value={exportHeight()} onInput={(event) => setExportHeight(Number(event.currentTarget.value))} /></label></div><Show when={exportFormat() === "png"}><label class="export-transparent"><input type="checkbox" checked={exportTransparent()} onChange={(event) => setExportTransparent(event.currentTarget.checked)} /> Transparent background</label></Show><div><button class="quiet-button" onClick={() => setExportOptionsOpen(false)}>Cancel</button><button class="save-button" onClick={() => { const format = exportFormat(); setExportOptionsOpen(false); void exportAs(format); }}>Export {exportFormat().toUpperCase()}</button></div></section></div></Show>
      <Show when={recoveryPrompt()}>{(recovery) => <div class="confirm-backdrop"><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="recovery-title"><h2 id="recovery-title">Recover unsaved work?</h2><p>SketchDraw found a local recovery copy for <strong>{recovery().path.split(/[\\/]/).pop()}</strong>. Restore it or continue with the saved file.</p><div><button class="quiet-button" onClick={discardRecovery}>Use saved file</button><button class="save-button" onClick={restoreRecovery}>Restore recovery</button></div></section></div>}</Show>
      <Show when={syncConflict()}>{(conflict) => <div class="confirm-backdrop"><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="conflict-title"><h2 id="conflict-title">File changed elsewhere</h2><p><strong>{conflict().path.split(/[\\/]/).pop()}</strong> was updated outside SketchDraw. Autosave is paused so neither version is overwritten without your choice.</p><div class="conflict-actions"><button class="quiet-button" onClick={() => void saveAs()}>Save my version as…</button><button class="quiet-button" onClick={reloadConflictingFile}>Load disk version</button><button class="danger-button" onClick={overwriteConflictingFile}>Overwrite disk version</button></div></section></div>}</Show>
      <Show when={showClearConfirm()}><div class="confirm-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setShowClearConfirm(false); }}><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="clear-title"><h2 id="clear-title">Clear this canvas?</h2><p>This will remove all {elements().length} items from the open sketch. You can undo this action.</p><div><button class="quiet-button" onClick={() => setShowClearConfirm(false)}>Cancel</button><button class="danger-button" onClick={() => { if (elements().length && !boardLocked()) { pushUndo(cloneElements(elements())); setElements([]); setSelectedIndices([]); setDirty(true); } setShowClearConfirm(false); }}>Clear canvas</button></div></section></div></Show>
      <Show when={error()}><div class="error-toast" role="alert">{error()}<button onClick={() => setError("")}>Dismiss</button></div></Show>
    </main>
  );
}

export default App;

