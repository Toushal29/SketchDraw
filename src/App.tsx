import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from "solid-js";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, readTextFile, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import sketchDrawMark from "../icons/sketchdraw-mark.svg";

import type { Point, ArrowHead, FlowchartShape, ArrowRoute, LineRoute, StrokeStyle, LayerFlags, ShapeElement, TextElement, ImageElement, Element, Tool, CanvasState, SketchPage, SketchFile, Preview, Bounds, TextDraft, Theme, ThemeMode, Binding, ShapeLabel } from "./model";
import { ensureIds, resolveBindings, copyElements, isConnector, isLabelShape, anchorPoint, nearestBinding, validReferences, textLayout, labelBox, textFont, extraFlowchartPath } from "./operations";

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
FLOWCHART_SHAPES.push(
  { value: "connector", label: "On-page connector", path: "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0" },
  { value: "off-page", label: "Off-page connector", path: "M4 4h16v11l-8 6-8-6z" },
  { value: "delay", label: "Delay", path: "M4 4h8a8 8 0 0 1 0 16H4z" },
  { value: "manual-operation", label: "Manual operation", path: "M3 5h18l-4 14H7z" },
  { value: "stored-data", label: "Stored data", path: "M7 5h14q-5 7 0 14H7C1 19 1 5 7 5z" },
);
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
  if (shape === "connector") ctx.ellipse(mid, top + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  else if (shape === "off-page") { ctx.moveTo(left, top); ctx.lineTo(right, top); ctx.lineTo(right, top + height * .65); ctx.lineTo(mid, bottom); ctx.lineTo(left, top + height * .65); ctx.closePath(); }
  else if (shape === "manual-operation") { ctx.moveTo(left, top); ctx.lineTo(right, top); ctx.lineTo(right - width * .2, bottom); ctx.lineTo(left + width * .2, bottom); ctx.closePath(); }
  else if (shape === "delay") { ctx.moveTo(left, top); ctx.lineTo(mid, top); ctx.bezierCurveTo(right + width / 6, top, right + width / 6, bottom, mid, bottom); ctx.lineTo(left, bottom); ctx.closePath(); }
  else if (shape === "stored-data") { ctx.moveTo(left + width * .2, top); ctx.lineTo(right, top); ctx.bezierCurveTo(right - width * .25, top + height / 3, right - width * .25, bottom - height / 3, right, bottom); ctx.lineTo(left + width * .2, bottom); ctx.bezierCurveTo(left - width * .06, bottom, left - width * .06, top, left + width * .2, top); ctx.closePath(); }
  else if (shape === "process") ctx.rect(left, top, width, height);
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
  return { start, end, dx, dy, c1: element.routePoints?.[0] ?? { x: start.x + dx / 3 + normal.x * bend, y: start.y + dy / 3 + normal.y * bend }, c2: element.routePoints?.[1] ?? { x: start.x + dx * 2 / 3 + normal.x * bend, y: start.y + dy * 2 / 3 + normal.y * bend }, normal };
}
function forkGeometry(element: ShapeElement) {
  const { start, end, dx, dy, normal } = connectorControls(element);
  const length = Math.max(1, Math.hypot(dx, dy)); const spread = Math.min(18, length * .14);
  const junction = element.routePoints?.[0] ?? { x: start.x + dx * .62, y: start.y + dy * .62 };
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
  const points = element.routePoints?.length && !["curve", "loop", "forked"].includes(route) ? [[{ x: element.x, y: element.y }, ...element.routePoints, { x: element.x + element.w, y: element.y + element.h }]] : route === "forked"
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
  if (element.routePoints?.length && !["loop", "forked"].includes(route)) { const a = atEnd ? element.routePoints[element.routePoints.length - 1] : { x: element.x, y: element.y }; const b = atEnd ? { x: element.x + element.w, y: element.y + element.h } : element.routePoints[0]; return Math.atan2(b.y - a.y, b.x - a.x); }
  if (route === "straight" || route === "forked") return Math.atan2(element.h, element.w);
  if (route === "elbow") return atEnd ? Math.PI / 2 * Math.sign(element.h || 1) : element.w < 0 ? Math.PI : 0;
  const before = connectorPoint(element, route, atEnd ? .99 : .01); const after = connectorPoint(element, route, atEnd ? 1 : .02);
  return Math.atan2(after.y - before.y, after.x - before.x);
}
function traceConnector(ctx: CanvasRenderingContext2D, element: ShapeElement) {
  const route: ArrowRoute | LineRoute = element.type === "arrow" ? element.arrowRoute ?? "straight" : element.lineRoute ?? "straight";
  const { start, end, c1, c2 } = connectorControls(element, route === "loop");
  ctx.beginPath(); ctx.moveTo(start.x, start.y);
  if (element.routePoints?.length && !["curve", "loop", "forked"].includes(route)) { for (const point of element.routePoints) ctx.lineTo(point.x, point.y); ctx.lineTo(end.x, end.y); return; }
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
  const extra = extraFlowchartPath(shape, left, top, width, height); if (extra) return extra;
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
let textMeasureContext: CanvasRenderingContext2D | null | undefined;
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
  if (!path.toLowerCase().endsWith(".sketch")) throw new Error("Choose a filename ending in .sketch in the save dialog.");
  return path;
}

function normalizeElement(value: unknown): Element | undefined {
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.id !== "string" || !value.id || value.id.length > 100) return undefined;
  const flags: LayerFlags = {
    id: value.id,
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
    const textAlign = value.textAlign === "center" || value.textAlign === "right" || value.textAlign === "justify" ? value.textAlign : "left";
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
    const flowchartShape: FlowchartShape = FLOWCHART_SHAPES.some(shape => shape.value === value.flowchartShape) ? value.flowchartShape as FlowchartShape : "process";
    const lineRoute: LineRoute = value.lineRoute === "curve" ? "curve" : "straight";
    const arrowRoute: ArrowRoute = ["elbow", "forked", "loop", "jagged"].includes(String(value.arrowRoute)) ? value.arrowRoute as ArrowRoute : "straight";
    const binding = (raw: unknown): Binding | undefined => isRecord(raw) && typeof raw.elementId === "string" && isRecord(raw.anchor) && finite(raw.anchor.x) && finite(raw.anchor.y) && raw.anchor.x >= 0 && raw.anchor.x <= 1 && raw.anchor.y >= 0 && raw.anchor.y <= 1 ? { elementId: raw.elementId, anchor: { x: raw.anchor.x, y: raw.anchor.y } } : undefined;
    if ((value.startBinding && !binding(value.startBinding)) || (value.endBinding && !binding(value.endBinding))) return undefined;
    if (value.routePoints !== undefined && (!Array.isArray(value.routePoints) || value.routePoints.length > 100 || !value.routePoints.every(p => isRecord(p) && finite(p.x) && finite(p.y)))) return undefined;
    const labelText = value.label === undefined ? undefined : normalizeElement({ ...(isRecord(value.label) ? value.label : {}), type: "text", id: "label", x: 0, y: 0 });
    if (value.label !== undefined && labelText?.type !== "text") return undefined;
    const label: ShapeLabel | undefined = labelText?.type === "text" ? { ...labelText, verticalAlign: isRecord(value.label) && (value.label.verticalAlign === "top" || value.label.verticalAlign === "bottom") ? value.label.verticalAlign : "middle" } : undefined;
    return { type: value.type as ShapeElement["type"], ...flags, startBinding: binding(value.startBinding), endBinding: binding(value.endBinding), routePoints: value.routePoints as Point[] | undefined, label, x: value.x, y: value.y, w: value.w, h: value.h, color: value.color, thickness: value.thickness, fillColor, fillOpacity, lineStyle, edgeStyle, flowchartShape: value.type === "flowchart" ? flowchartShape : undefined, lineRoute: value.type === "line" ? lineRoute : undefined, arrowRoute: value.type === "arrow" ? arrowRoute : undefined, startHead: value.type === "arrow" ? validHead(value.startHead) ? value.startHead : "none" : undefined, endHead: value.type === "arrow" ? validHead(value.endHead) ? value.endHead : "open" : undefined, opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1 };
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
    if (elements.some((element) => !element) || !validReferences(elements as Element[])) return undefined;
    return { id, name: name.slice(0, 80), canvasState: { zoom: state.zoom, panX: state.panX, panY: state.panY, backgroundColor: state.backgroundColor, boardColorFollowsTheme: typeof state.boardColorFollowsTheme === "boolean" ? state.boardColorFollowsTheme : state.backgroundColor === "#ffffff" }, elements: elements as Element[] };
  };
  if (value.version !== 5 || !Array.isArray(value.pages) || value.pages.length < 1 || value.pages.length > 100) return undefined;
  const pages = value.pages.map((page, index) => isRecord(page) ? normalizePage(page.id, page.name ?? `Page ${index + 1}`, page.canvasState, page.elements) : undefined);
  if (pages.some((page) => !page)) return undefined;
  const normalized = pages as SketchPage[];
  if (new Set(normalized.map((page) => page.id)).size !== normalized.length) return undefined;
  const activePageId = normalized.some((page) => page.id === value.activePageId) ? String(value.activePageId) : normalized[0].id;
  return { format: "SketchDraw", version: 5, activePageId, pages: normalized };
}

function elementBounds(element: Element): Bounds {
  const cached = boundsCache.get(element); if (cached) return cached;
  if (element.type === "group") {
    return cacheBounds(element, unionBounds(element.elements.filter((child) => !child.hidden).map(elementBounds)) ?? { x: 0, y: 0, w: 0, h: 0 });
  }
  if (element.type === "image") return cacheBounds(element, rotatedBounds({ x: element.x, y: element.y, w: element.w, h: element.h }, element.rotation ?? 0));
  if (element.type === "text") {
    const lines = element.text.split(/\r?\n/).map((line, index) => element.listType === "bullet" ? "• " + line : element.listType === "number" ? `${index + 1}. ${line}` : line);
    textMeasureContext ??= document.createElement("canvas").getContext("2d");
    if (textMeasureContext) textMeasureContext.font = `${element.italic ? "italic " : ""}${element.bold ? "700" : "400"} ${element.fontSize}px ${element.fontFamily === "hand" ? "cursive" : "sans-serif"}`;
    const width = Math.max(element.fontSize * .5, ...lines.map(line => textMeasureContext?.measureText(line).width ?? line.length * element.fontSize * .6));
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
  const [elements, setElementsSignal] = createSignal<Element[]>([]);
  function setElements(next: Element[] | ((previous: Element[]) => Element[])) { return setElementsSignal(previous => resolveBindings(ensureIds(typeof next === "function" ? next(previous) : next))); }
  const [canvasState, setCanvasState] = createSignal<CanvasState>(emptyCanvas());
  const [pages, setPages] = createSignal<SketchPage[]>([]);
  const [activePageId, setActivePageId] = createSignal("");
  const [activePath, setActivePath] = createSignal<string>();
  const [tool, setTool] = createSignal<Tool>("pen");
  const [color, setColor] = createSignal("#252525");
  const [thickness, setThickness] = createSignal(2);
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
  const [defaultFontSize, setDefaultFontSize] = createSignal(16);
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
  const [exportFormat, setExportFormat] = createSignal<"png" | "svg" | "pdf">("png");
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
    try { const value: unknown = JSON.parse(localStorage.getItem("sketchdraw-v5-recent-files") ?? "[]"); return Array.isArray(value) ? value.filter((path): path is string => typeof path === "string" && path.toLowerCase().endsWith(".sketch")).slice(0, 8) : []; }
    catch { return []; }
  })());
  const [marquee, setMarquee] = createSignal<{ start: Point; end: Point }>();
  let undoStack: Element[][] = [];
  let redoStack: Element[][] = [];
  let canvas!: HTMLCanvasElement;
  let canvasWrap!: HTMLElement;
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

  const [nativeBusy, setNativeBusy] = createSignal(false);
  const [documentBusy, setDocumentBusy] = createSignal(false);
  const [openToolOptions, setOpenToolOptions] = createSignal<Tool>();
  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number; world: Point }>();
  const [pageDialog, setPageDialog] = createSignal<"rename" | "delete">();
  const [pageName, setPageName] = createSignal("");
  const [exportScope, setExportScope] = createSignal<"drawing" | "selection" | "viewport">("drawing");
  const [exportGrid, setExportGrid] = createSignal(false);
  const [attachmentHint, setAttachmentHint] = createSignal<Point>();
  let clipboardItems: Element[] = [];
  const pageHistories = new Map<string, { undo: Element[][]; redo: Element[][] }>();

  function rememberPageHistory() { pageHistories.set(activePageId(), { undo: undoStack, redo: redoStack }); }
  function restorePageHistory() { const history = pageHistories.get(activePageId()); undoStack = history?.undo ?? []; redoStack = history?.redo ?? []; setHistoryVersion(v => v + 1); }
  function duplicatePage() {
    if (boardLocked() || pages().length >= 100) return;
    commitTextDraft(); storeCurrentPage(); rememberPageHistory();
    const source = pages().find(p => p.id === activePageId()); if (!source) return;
    const page = { ...source, id: crypto.randomUUID(), name: `${source.name} copy`.slice(0, 80), elements: copyElements(source.elements, 0, 0) };
    const index = pages().findIndex(p => p.id === source.id);
    setPages(items => [...items.slice(0, index + 1), page, ...items.slice(index + 1)]);
    switchPage(page.id); setDirty(true);
  }
  function reorderPage(direction: number) {
    if (boardLocked()) return;
    const index = pages().findIndex(p => p.id === activePageId()); const next = index + direction;
    if (next < 0 || next >= pages().length) return;
    const items = [...pages()]; [items[index], items[next]] = [items[next], items[index]]; setPages(items); setDirty(true);
  }
  function openPageDialog(action: "rename" | "delete") {
    commitTextDraft(); setPageName(currentPage()?.name ?? "Page"); setPageDialog(action);
  }
  function confirmPageDialog() {
    if (boardLocked()) return;
    if (pageDialog() === "rename" && pageName().trim()) { setPages(items => items.map(page => page.id === activePageId() ? { ...page, name: pageName().trim().slice(0, 80) } : page)); setDirty(true); }
    else if (pageDialog() === "delete") deleteCurrentPage();
    setPageDialog(undefined);
  }
  function changeSelected(operation: (element: Element) => Element) {
    if (boardLocked()) return;
    const selected = new Set(selectedIndices()); const before = cloneElements(elements());
    setElements(items => items.map((item, index) => selected.has(index) && canMoveElement(item) ? operation(item) : item));
    if (JSON.stringify(before) !== JSON.stringify(elements())) { pushUndo(before); setDirty(true); }
  }
  function precision(property: "x" | "y" | "w" | "h" | "rotation", value: number) {
    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000) return;
    changeSelected(item => {
      const bounds = elementBounds(item);
      if (property === "x" || property === "y") return moveElement(item, property === "x" ? value - bounds.x : 0, property === "y" ? value - bounds.y : 0);
      if (property === "rotation") return isConnector(item) || item.type === "group" ? item : { ...item, rotation: value % 360 };
      if (item.type === "text") return { ...item, fontSize: Math.max(8, Math.min(160, item.fontSize * value / Math.max(1, bounds[property]))) };
      if (item.type === "group" || item.type === "freehand" || isConnector(item)) return item;
      return { ...item, [property]: Math.max(2, value) };
    });
  }
  function alignSelection(command: "left" | "center" | "right" | "top" | "middle" | "bottom" | "horizontal" | "vertical") {
    if (boardLocked()) return;
    const selected = selectedIndices().filter(i => elements()[i] && canMoveElement(elements()[i]));
    if (selected.length < 2) return;
    const boxes = selected.map(index => ({ index, box: elementBounds(elements()[index]) })); const all = unionBounds(boxes.map(item => item.box))!;
    const translations = new Map<number, Point>();
    if (command === "horizontal" || command === "vertical") {
      if (selected.length < 3) return;
      const axis = command === "horizontal" ? "x" : "y"; const size = axis === "x" ? "w" : "h";
      boxes.sort((a, b) => a.box[axis] - b.box[axis]);
      const start = boxes[0].box[axis]; const last = boxes[boxes.length - 1].box;
      const gap = (last[axis] + last[size] - start - boxes.reduce((total, { box }) => total + box[size], 0)) / (boxes.length - 1);
      let position = start;
      for (const { index, box } of boxes) { translations.set(index, { x: axis === "x" ? position - box.x : 0, y: axis === "y" ? position - box.y : 0 }); position += box[size] + gap; }
    } else for (const { index, box } of boxes) translations.set(index, {
      x: command === "left" ? all.x - box.x : command === "center" ? all.x + all.w / 2 - box.x - box.w / 2 : command === "right" ? all.x + all.w - box.x - box.w : 0,
      y: command === "top" ? all.y - box.y : command === "middle" ? all.y + all.h / 2 - box.y - box.h / 2 : command === "bottom" ? all.y + all.h - box.y - box.h : 0,
    });
    const before = cloneElements(elements()); setElements(items => items.map((item, index) => { const delta = translations.get(index); return delta ? moveElement(item, delta.x, delta.y) : item; })); pushUndo(before); setDirty(true);
  }
  function clipboardPayload() { return JSON.stringify({ format: "SketchDrawClipboard", version: 5, elements: copyElements(selectedElements(), 0, 0) }); }
  function pastePayload(raw: string, at?: Point) {
    if (!activePath() || boardLocked()) return;
    try {
      const payload: unknown = JSON.parse(raw);
      if (!isRecord(payload) || payload.format !== "SketchDrawClipboard" || payload.version !== 5 || !Array.isArray(payload.elements)) throw new Error("Copy objects from this version of SketchDraw first.");
      const items = payload.elements.map(normalizeElement);
      if (!items.length || items.some(item => !item) || !validReferences(items as Element[])) throw new Error("The clipboard objects are invalid.");
      insertCopies(items as Element[], at);
    } catch (cause) { setError(`Could not paste: ${String(cause)}`); }
  }
  function insertCopies(items: Element[], at?: Point) {
    if (!activePath() || boardLocked() || !items.length) return;
    const box = unionBounds(items.map(elementBounds));
    const copies = copyElements(items, at && box ? at.x - box.x : 24, at && box ? at.y - box.y : 24); const start = elements().length;
    pushUndo(cloneElements(elements())); setElements(current => [...current, ...copies]); setSelectedIndices(copies.map((_, index) => start + index)); setTool("select"); setDirty(true);
  }
  async function copySelection() {
    if (!selectedElements().length) return;
    clipboardItems = copyElements(selectedElements(), 0, 0);
    try { await navigator.clipboard.writeText(clipboardPayload()); } catch { /* The in-app clipboard remains available. */ }
  }
  async function pasteSelection(at?: Point) {
    try { const text = await navigator.clipboard.readText(); pastePayload(text, at); }
    catch { if (clipboardItems.length) insertCopies(clipboardItems, at); else setError("Press Ctrl/Cmd+V to grant clipboard access."); }
  }
  function onContextMenu(event: MouseEvent) {
    event.preventDefault(); if (!activePath()) return;
    commitTextDraft(); const rect = canvas.getBoundingClientRect(); const view = canvasState(); const point = { x: (event.clientX - rect.left - view.panX) / view.zoom, y: (event.clientY - rect.top - view.panY) / view.zoom };
    const hit = hitTest(point); if (hit !== undefined && !selectedIndices().includes(hit)) setSelectedIndices([hit]);
    if (menu) menu.open = false; if (viewMenu) viewMenu.open = false;
    setContextMenu({ x: Math.max(8, Math.min(event.clientX, window.innerWidth - 252)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - 510)), world: point });
  }
  function connectorHandles(item: ShapeElement) {
    const route = item.type === "arrow" ? item.arrowRoute ?? "straight" : item.lineRoute ?? "straight";
    const points = item.routePoints?.length ? item.routePoints : route === "straight" ? [{ x: item.x + item.w / 2, y: item.y + item.h / 2 }] : route === "elbow" ? [{ x: item.x + item.w, y: item.y }] : route === "jagged" ? jaggedVertices(item).slice(1, -1) : route === "curve" || route === "loop" ? (() => { const controls = connectorControls(item, route === "loop"); return route === "curve" ? [controls.c1] : [controls.c1, controls.c2]; })() : [forkGeometry(item).junction];
    return [{ id: "start", x: item.x, y: item.y }, { id: "end", x: item.x + item.w, y: item.y + item.h }, ...points.map((point, index) => ({ ...point, id: `route:${index}` }))];
  }
  function resizeConnector(item: ShapeElement, handle: string, point: Point): ShapeElement {
    const port = nearestBinding(elements(), point, 18 / canvasState().zoom); setAttachmentHint(port?.point);
    const target = port?.point ?? snap(point);
    if (handle === "start") return { ...item, x: target.x, y: target.y, w: item.x + item.w - target.x, h: item.y + item.h - target.y, startBinding: port?.binding, rotation: 0 };
    if (handle === "end") return { ...item, w: target.x - item.x, h: target.y - item.y, endBinding: port?.binding, rotation: 0 };
    const points = item.routePoints?.length ? [...item.routePoints] : connectorHandles(item).slice(2).map(({ x, y }) => ({ x, y }));
    points[Number(handle.split(":")[1])] = snap(point); return { ...item, routePoints: points };
  }
  function setEndpoint(end: "start" | "end", axis: "x" | "y", value: number) {
    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000) return;
    changeSelected(item => {
      if (!isConnector(item)) return item;
      const start = { x: item.x, y: item.y }; const finish = { x: item.x + item.w, y: item.y + item.h };
      (end === "start" ? start : finish)[axis] = value;
      return { ...item, x: start.x, y: start.y, w: finish.x - start.x, h: finish.y - start.y, [end === "start" ? "startBinding" : "endBinding"]: undefined };
    });
  }
  function editShapeLabel(index: number) {
    const shape = elements()[index]; if (!shape || !isLabelShape(shape) || shape.locked || boardLocked()) return;
    commitTextDraft(); setSelectedIndices([index]); setTool("select");
    const box = labelBox(shape); const label = shape.label;
    setTextDraft({ x: box.x, y: box.y, width: box.w, height: box.h, rotation: shape.rotation ?? 0, value: label?.text ?? "", editingIndex: index, shapeLabel: true, color: label?.color ?? color(), opacity: label?.opacity ?? 1, fontSize: label?.fontSize ?? defaultFontSize(), fontFamily: label?.fontFamily ?? defaultFontFamily(), bold: label?.bold ?? defaultBold(), italic: label?.italic ?? defaultItalic(), underline: label?.underline ?? defaultUnderline(), textAlign: label?.textAlign ?? "center", listType: label?.listType ?? "none", verticalAlign: label?.verticalAlign ?? "middle" });
  }
  function editorWidth(draft: TextDraft) {
    if (draft.width !== undefined) return draft.width;
    const bounds = elementBounds({ type: "text", x: 0, y: 0, text: draft.value, color: draft.color, fontSize: draft.fontSize, fontFamily: draft.fontFamily, bold: draft.bold, italic: draft.italic });
    return Math.max(160, bounds.w + 16);
  }
  function editorLeft(draft: TextDraft) {
    return draft.x - (draft.shapeLabel ? 0 : draft.textAlign === "center" ? editorWidth(draft) / 2 : draft.textAlign === "right" ? editorWidth(draft) : 0);
  }
  function updateLabel(property: keyof ShapeLabel, value: string | number | boolean) {
    if (boardLocked() || focusedElement()?.locked) return;
    setTextDraft(draft => draft?.shapeLabel ? { ...draft, [property]: value } : draft);
    changeSelected(item => isLabelShape(item) ? { ...item, label: { text: "", color: color(), fontSize: 16, verticalAlign: "middle", ...item.label, [property]: value } } : item);
  }
  function drawLabel(ctx: CanvasRenderingContext2D, shape: ShapeElement) {
    const label = shape.label; if (!label?.text) return;
    ctx.save(); ctx.font = textFont(label); ctx.fillStyle = label.color; ctx.globalAlpha = (shape.opacity ?? 1) * (label.opacity ?? 1); ctx.textBaseline = "top"; ctx.textAlign = "left";
    const box = labelBox(shape); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
    for (const run of textLayout(ctx, shape)) { ctx.fillText(run.text, run.x, run.y); if (label.underline) ctx.fillRect(run.x, run.y + label.fontSize * 1.06, ctx.measureText(run.text).width, Math.max(1, label.fontSize / 18)); }
    ctx.restore();
  }
  function labelSvg(shape: ShapeElement) {
    const label = shape.label; const ctx = canvas.getContext("2d"); if (!label?.text || !ctx) return "";
    return `<g fill="${escapeXml(label.color)}" opacity="${(shape.opacity ?? 1) * (label.opacity ?? 1)}" font-size="${label.fontSize}" font-family="${label.fontFamily === "hand" ? "cursive" : "sans-serif"}" font-weight="${label.bold ? 700 : 400}" font-style="${label.italic ? "italic" : "normal"}" text-decoration="${label.underline ? "underline" : "none"}">${textLayout(ctx, shape).map(run => `<text x="${run.x}" y="${run.y + label.fontSize * .8}">${escapeXml(run.text)}</text>`).join("")}</g>`;
  }

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
  const selectedLabel = () => { const item = focusedElement(); return item && isLabelShape(item) ? item.label : undefined; };
  const selectedText = () => textDraft() ?? (() => { const item = focusedElement(); return item?.type === "text" ? item : selectedLabel(); })();
  const selectedColor = () => { const draft = textDraft(); if (draft) return draft.color; const element = focusedElement(); return element && "color" in element ? element.color : color(); };
  const selectedThickness = () => { const element = focusedElement(); return element && "thickness" in element ? element.thickness : thickness(); };
  const selectedOpacity = () => { const element = focusedElement(); return element && "opacity" in element ? element.opacity ?? 1 : 1; };
  const selectedFillColor = () => { const element = focusedElement(); return element && "fillColor" in element ? element.fillColor : undefined; };
  const sidebarVisible = () => sidebarOpen() && (
    sidebarTab() === "layers" ||
    (tool() === "select" ? selectedIndices().length > 0 :
      ["pen", "rectangle", "circle", "diamond", "flowchart", "line", "arrow", "text", "bucket"].includes(tool()))
  );
  const showStrokeControls = () => { const focused = focusedElement(); return tool() !== "bucket" && (
    tool() === "pen" || tool() === "rectangle" || tool() === "circle" || tool() === "diamond" || tool() === "flowchart" || tool() === "line" || tool() === "arrow" || tool() === "text" ||
    (tool() === "select" && !!focused && "color" in focused)
  ); };
  const showThicknessControls = () => { const focused = focusedElement(); return tool() !== "bucket" && tool() !== "text" && (
    tool() === "pen" || tool() === "rectangle" || tool() === "circle" || tool() === "diamond" || tool() === "flowchart" || tool() === "line" || tool() === "arrow" ||
    (tool() === "select" && !!focused && "thickness" in focused)
  ); };
  const renderedBoardColor = () => boardColorFollowsTheme() ? theme() === "dark" ? "#17191f" : "#ffffff" : boardColor();
  const updateStrokeColor = (value: string) => { if (boardLocked() || focusedElement()?.locked) return; if (textDraft()?.shapeLabel) { updateLabel("color", value); return; } setColor(value); setTextDraft((draft) => draft ? { ...draft, color: value } : undefined); if (selectedIndices().length) updateProperty("color", value); };
  const updateThickness = (value: number) => { setThickness(value); if (selectedIndices().length) updateProperty("thickness", value); };
  const status = () => !activePath() ? "No file selected" : saving() ? "Saving…" : (dirty() || textDraft()) ? "Unsaved changes" : savedAt() ? `Saved ${savedAt()}` : "Saved locally";
  function documentSnapshot(): SketchFile {
    const sourcePages = pages().length ? pages() : [{ id: "page-1", name: "Page 1", canvasState: canvasState(), elements: elements() }];
    const serializedPages = sourcePages.map((page) => {
      const isCurrent = page.id === activePageId() || (!activePageId() && sourcePages.length === 1);
      const pageElements = isCurrent ? elements() : page.elements;
      const normalized = pageElements.map(normalizeElement);
      if (normalized.some((element) => !element)) throw new Error("The drawing contains an element that cannot be saved in SketchDraw format v5.");
      const state = isCurrent ? canvasState() : page.canvasState;
      return { id: page.id, name: page.name, canvasState: { ...state, backgroundColor: isCurrent ? renderedBoardColor() : (state.boardColorFollowsTheme ? (theme() === "dark" ? "#17191f" : "#ffffff") : state.backgroundColor), boardColorFollowsTheme: state.boardColorFollowsTheme ?? true }, elements: normalized as Element[] };
    });
    return { format: "SketchDraw", version: 5, activePageId: activePageId() || serializedPages[0].id, pages: serializedPages };
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
    commitTextDraft(); rememberPageHistory(); storeCurrentPage();
    setElements(cloneElements(target.elements)); setCanvasState({ ...target.canvasState }); setBoardColor(target.canvasState.backgroundColor); setBoardColorFollowsTheme(target.canvasState.boardColorFollowsTheme ?? false);
    setActivePageId(id); setSelectedIndices([]); setHoveredIndex(undefined); setTextDraft(undefined); setMarquee(undefined);
    restorePageHistory(); setDirty(true);
  }
  function addPage() {
    if (boardLocked()) return;
    if (pages().length >= 100) { setError("A sketch can contain up to 100 pages."); return; }
    commitTextDraft(); storeCurrentPage(); rememberPageHistory();
    const number = pages().length + 1; const page: SketchPage = { id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: `Page ${number}`, canvasState: emptyCanvas(), elements: [] };
    setPages((items) => [...items, page]); setActivePageId(page.id); setElements([]); setCanvasState(emptyCanvas()); setBoardColor("#ffffff"); setBoardColorFollowsTheme(true); setSelectedIndices([]); setDirty(true);
    undoStack = []; redoStack = []; setHistoryVersion((version) => version + 1);
  }
  function deleteCurrentPage() {
    if (boardLocked() || pages().length <= 1) return;
    const nextPages = pages().filter((page) => page.id !== activePageId()); const target = nextPages[Math.max(0, pages().findIndex((page) => page.id === activePageId()) - 1)] ?? nextPages[0];
    setPages(nextPages); setActivePageId(target.id); setElements(cloneElements(target.elements)); setCanvasState({ ...target.canvasState }); setBoardColor(target.canvasState.backgroundColor); setBoardColorFollowsTheme(target.canvasState.boardColorFollowsTheme ?? false); setSelectedIndices([]); setTextDraft(undefined); setHoveredIndex(undefined); setMarquee(undefined); restorePageHistory(); setDirty(true);
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
      if (element.type === "line" && property === "lineRoute") return { ...element, lineRoute: value as LineRoute, routePoints: undefined };
      if (element.type === "arrow" && property === "arrowRoute") return { ...element, arrowRoute: value as ArrowRoute, routePoints: undefined };
      if (element.type === "flowchart" && property === "flowchartShape") return { ...element, flowchartShape: value as FlowchartShape };
      if (element.type === "arrow" && (property === "startHead" || property === "endHead")) return { ...element, [property]: value as ArrowHead };
      return element;
    };
    setElements((items) => items.map((element, index) => indices.has(index) ? update(element) : element));
    pushUndo(before); setDirty(true);
  }

  function commitTextDraft() {
    const draft = textDraft();
    if (draft?.shapeLabel && draft.editingIndex !== undefined) {
      const index = draft.editingIndex; const item = elements()[index];
      if (item && isLabelShape(item) && !item.locked && !boardLocked()) {
        const before = cloneElements(elements());
        const label: ShapeLabel = { text: draft.value, color: draft.color, opacity: draft.opacity, fontSize: draft.fontSize, fontFamily: draft.fontFamily, bold: draft.bold, italic: draft.italic, underline: draft.underline, textAlign: draft.textAlign, listType: draft.listType, verticalAlign: draft.verticalAlign ?? "middle" };
        setElements(items => items.map((element, i) => i === index ? { ...item, label: draft.value.trim() ? label : undefined } : element));
        if (JSON.stringify(before) !== JSON.stringify(elements())) { pushUndo(before); setDirty(true); }
      }
      setTextDraft(undefined); return;
    }
    if (draft && !boardLocked()) {
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
    if (textDraft()) commitTextDraft();
    const existing = editingIndex === undefined ? undefined : elements()[editingIndex];
    if (existing?.locked) return;
    setSelectedIndices(editingIndex === undefined ? [] : [editingIndex]);
    setTool("text");
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
    const inset = sidebarVisible() ? 330 : 40; const availableWidth = Math.max(100, rect.width - inset - 40); const availableHeight = Math.max(100, rect.height - 180);
    const zoom = Math.max(0.02, Math.min(4, availableWidth / width, availableHeight / height));
    setCanvasState({ zoom, panX: inset + (availableWidth - width * zoom) / 2 - left * zoom, panY: 90 + (availableHeight - height * zoom) / 2 - top * zoom, backgroundColor: renderedBoardColor(), boardColorFollowsTheme: boardColorFollowsTheme() });
    setDirty(true);
  }

  function resetZoomAndCenter() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); const current = canvasState();
    const centerWorld = { x: (rect.width / 2 - current.panX) / current.zoom, y: (rect.height / 2 - current.panY) / current.zoom };
    setCanvasState({ zoom: 1, panX: rect.width / 2 - centerWorld.x, panY: rect.height / 2 - centerWorld.y, backgroundColor: renderedBoardColor(), boardColorFollowsTheme: boardColorFollowsTheme() }); setDirty(true);
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
    if (isLabelShape(element) && element.label?.text) { const box = labelBox(element); if (point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h) return true; }
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
      if (textDraft()?.editingIndex !== undefined && elements()[textDraft()!.editingIndex!]?.id === element.id) { if (element.rotation) ctx.restore(); return; }
      ctx.save(); ctx.globalAlpha = element.opacity ?? 1; ctx.fillStyle = element.color;
      ctx.font = (element.italic ? "italic " : "") + (element.bold ? "700 " : "400 ") + element.fontSize + "px " + (element.fontFamily === "hand" ? "cursive" : "'DM Sans', sans-serif"); ctx.textBaseline = "top"; ctx.textAlign = element.textAlign === "justify" ? "left" : element.textAlign ?? "left";
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
    ctx.restore(); if (isLabelShape(element) && !(textDraft()?.shapeLabel && elements()[textDraft()!.editingIndex!]?.id === element.id)) drawLabel(ctx, element); if (element.rotation) ctx.restore();
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
    for (const handle of isConnector(element) ? connectorHandles(element) : transformHandlePoints(elementBounds(element))) if (Math.hypot(point.x - handle.x, point.y - handle.y) <= 9 / canvasState().zoom) return { index, handle: handle.id };
    return undefined;
  }

  function resizeElement(element: Element, handle: string, start: Point, point: Point): Element {
    if (element.type === "group" || element.type === "freehand") return element;
    if (isConnector(element)) return resizeConnector(element, handle, point);
    if (handle === "rotate") {
      const bounds = elementBounds(element); const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
      const a = Math.atan2(start.y - center.y, start.x - center.x); const b = Math.atan2(point.y - center.y, point.x - center.x);
      return { ...element, rotation: (element.rotation ?? 0) + (b - a) * 180 / Math.PI };
    }
    if (element.type === "text") { const delta = handle.includes("e") || handle.includes("w") ? point.x - start.x : point.y - start.y; return { ...element, fontSize: Math.max(8, Math.min(160, element.fontSize + delta * 0.3)) }; }
    const bounds = { x: Math.min(element.x, element.x + element.w), y: Math.min(element.y, element.y + element.h), w: Math.abs(element.w), h: Math.abs(element.h) }; let { x, y, w, h } = bounds; const dx = point.x - start.x; const dy = point.y - start.y;
    if (handle.includes("w")) { x += dx; w -= dx; } if (handle.includes("e")) w += dx;
    if (handle.includes("n")) { y += dy; h -= dy; } if (handle.includes("s")) h += dy;
    return { ...element, x, y, w: Math.max(2, w), h: Math.max(2, h) };
  }

  function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number, includeSelection: boolean, transparent = false, viewOverride?: CanvasState, sourceItems = elements(), includeGrid = true) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    if (!transparent) { ctx.fillStyle = renderedBoardColor(); ctx.fillRect(0, 0, width, height); }
    const state = viewOverride ?? canvasState(); if (!transparent && includeGrid) drawGrid(ctx, width, height, state);
    ctx.save(); ctx.translate(state.panX, state.panY); ctx.scale(state.zoom, state.zoom);
    const selected = selectedSet();
    sourceItems.forEach((element, index) => {
      if (element.hidden) return;
      drawElement(ctx, element);
      const isSelected = selected.has(index);
      if (includeSelection && (isSelected || hoveredIndex() === index) && isConnector(element)) {
        ctx.save(); ctx.strokeStyle = "#548ce8"; ctx.globalAlpha = .65; ctx.lineWidth = (isSelected ? 2 : 1) / state.zoom; traceConnector(ctx, element); ctx.stroke();
        if (isSelected && selected.size === 1 && !element.locked && !boardLocked()) for (const handle of connectorHandles(element)) { ctx.beginPath(); ctx.fillStyle = handle.id.startsWith("route") ? "#dbeafe" : "#ffffff"; ctx.arc(handle.x, handle.y, (handle.id.startsWith("route") ? 4 : 6) / state.zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        ctx.restore();
      } else if (includeSelection && (isSelected || hoveredIndex() === index)) {
        const bounds = elementBounds(element); const padding = 5 / state.zoom;
        ctx.save(); ctx.strokeStyle = isSelected ? "#547bb1" : "#8298b8"; ctx.globalAlpha = isSelected ? 1 : 0.62; ctx.lineWidth = 1 / state.zoom; ctx.setLineDash([4 / state.zoom, 3 / state.zoom]);
        ctx.strokeRect(bounds.x - padding, bounds.y - padding, Math.max(bounds.w + padding * 2, 2 / state.zoom), Math.max(bounds.h + padding * 2, 2 / state.zoom)); ctx.restore();
        if (isSelected && !element.locked && selected.size === 1 && tool() === "select" && element.type !== "group" && element.type !== "freehand") drawTransformHandles(ctx, bounds, state.zoom);
      }
    });
    if (includeSelection && (tool() === "arrow" || tool() === "line" || resizeOrigin && isConnector(resizeOrigin.original))) {
      const ports = (items: Element[]) => { for (const item of items) { if (item.hidden || item.locked) continue; if (item.type === "group") { ports(item.elements); continue; } if (!isLabelShape(item)) continue;
        for (const anchor of [{ x: .5, y: 0 }, { x: 1, y: .5 }, { x: .5, y: 1 }, { x: 0, y: .5 }]) { const point = anchorPoint(item, anchor); ctx.beginPath(); ctx.arc(point.x, point.y, 4 / state.zoom, 0, Math.PI * 2); ctx.fill(); }
      } }; ctx.save(); ctx.fillStyle = "#5d94e7"; ctx.globalAlpha = .7; ports(elements()); const hint = attachmentHint(); if (hint) { ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(hint.x, hint.y, 8 / state.zoom, 0, Math.PI * 2); ctx.strokeStyle = "#2675f5"; ctx.lineWidth = 2 / state.zoom; ctx.stroke(); } ctx.restore();
    }
    const guides = alignmentGuides();
    if (includeSelection && guides) {
      const left = -state.panX / state.zoom; const top = -state.panY / state.zoom; const right = (width - state.panX) / state.zoom; const bottom = (height - state.panY) / state.zoom;
      ctx.save(); ctx.strokeStyle = "#668fd0"; ctx.globalAlpha = .85; ctx.lineWidth = 1 / state.zoom; ctx.setLineDash([5 / state.zoom, 4 / state.zoom]); ctx.beginPath();
      if (guides.x !== undefined) { ctx.moveTo(guides.x, top); ctx.lineTo(guides.x, bottom); }
      if (guides.y !== undefined) { ctx.moveTo(left, guides.y); ctx.lineTo(right, guides.y); }
      ctx.stroke(); ctx.restore();
    }
    const activePreview = preview();
    if (includeSelection && activePreview) {
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

  createEffect(() => { elements(); canvasState(); preview(); attachmentHint(); tool(); textDraft(); selectedIndices(); hoveredIndex(); showGrid(); marquee(); alignmentGuides(); theme(); boardColor(); boardColorFollowsTheme(); fillOpacity(); renderCanvas(); });
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

  createEffect(() => {
    if (syncConflict() || recoveryPrompt()) { setExportOptionsOpen(false); setPageDialog(undefined); setShowClearConfirm(false); setContextMenu(undefined); setOpenToolOptions(undefined); if (menu) menu.open = false; if (viewMenu) viewMenu.open = false; }
  });
  createEffect(() => {
    const open = pageDialog() || exportOptionsOpen() || showClearConfirm() || recoveryPrompt() || syncConflict();
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => { const dialog = document.querySelector<HTMLElement>("[aria-modal='true']"); (dialog?.querySelector<HTMLElement>("[autofocus], input, button") ?? dialog)?.focus(); });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>("[aria-modal='true']"); const controls = [...dialog?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), [tabindex='0']") ?? []];
      if (!controls.length) return; const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", trap, true);
    onCleanup(() => { cancelAnimationFrame(frame); document.removeEventListener("keydown", trap, true); if (previous?.isConnected) previous.focus(); });
  });

  onMount(() => {
    void invoke<string[]>("take_startup_files").then((paths) => {
      const path = paths.find((candidate) => candidate.toLowerCase().endsWith(".sketch"));
      if (path) void loadFile(path);
    }).catch((cause) => setError(`Could not check for a SketchDraw file to open: ${String(cause)}`));
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (pageDialog()) { event.preventDefault(); setPageDialog(undefined); return; }
        if (contextMenu()) { event.preventDefault(); setContextMenu(undefined); return; }
        if (openToolOptions()) { setOpenToolOptions(undefined); return; }
        document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(detail => detail.open = false);
        if (showClearConfirm()) { event.preventDefault(); setShowClearConfirm(false); return; }
        if (exportOptionsOpen()) { event.preventDefault(); setExportOptionsOpen(false); return; }
        if (recoveryPrompt() || syncConflict()) return;
        if (textDraft()) commitTextDraft();
        event.preventDefault(); setTool("select"); setSelectedIndices([]); setHoveredIndex(undefined); setMarquee(undefined); marqueeOrigin = undefined; resizeOrigin = undefined; moveOrigin = undefined; setPreview(undefined); drawing = false; setSpaceDown(false); setIsPanning(false); panOrigin = undefined;
        if (menu) menu.open = false; if (viewMenu) viewMenu.open = false; return;
      }
      if (recoveryPrompt() || syncConflict() || exportOptionsOpen() || showClearConfirm() || pageDialog() || contextMenu()) return;
      if (event.target instanceof HTMLElement && event.target.closest("details[open], .tool-options")) return;
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
      if ((event.ctrlKey || event.metaKey) && key === "d") { event.preventDefault(); insertCopies(selectedElements()); return; }
      if ((event.ctrlKey || event.metaKey) && key === "a") { event.preventDefault(); setSelectedIndices(elements().flatMap((item, index) => !item.hidden && !item.locked ? [index] : [])); return; }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (key === "1") { fitDocumentToViewport(elements()); return; }
      if (key === "2") { fitDocumentToViewport(selectedElements()); return; }
      if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) { event.preventDefault(); const step = event.shiftKey ? 10 : 1; changeSelected(item => moveElement(item, key === "arrowleft" ? -step : key === "arrowright" ? step : 0, key === "arrowup" ? -step : key === "arrowdown" ? step : 0)); return; }
      if (key === "g" && event.shiftKey) { setSnapToGrid((enabled) => !enabled); return; }
      if (key === "o" && event.shiftKey) { setSnapToObjects((enabled) => !enabled); return; }
      if (key === "g") { setShowGrid((visible) => !visible); return; }
      if (key === "k") { setBoardLocked((locked) => !locked); return; }
      if (key === "0") { resetZoomAndCenter(); return; }
      if (key === "v") setTool("select"); else if (key === "p") activateTool("pen"); else if (key === "r") activateTool("rectangle"); else if (key === "c" || key === "o") activateTool("circle"); else if (key === "d") activateTool("diamond"); else if (key === "l") activateTool("line"); else if (key === "a") activateTool("arrow"); else if (key === "f") activateTool("flowchart"); else if (key === "t") activateTool("text"); else if (key === "b") activateTool("bucket"); else if (key === "e") activateTool("eraser"); else if (key === "x") activateTool("crop");
      else if (key === "delete" || key === "backspace") { event.preventDefault(); deleteSelected(); }
    };
    const clipboardAllowed = (target: EventTarget | null) => activePath() && !pageDialog() && !exportOptionsOpen() && !showClearConfirm() && !recoveryPrompt() && !syncConflict() && !(target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea")));
    const copy = (event: ClipboardEvent) => { if (!clipboardAllowed(event.target) || !selectedElements().length) return; event.preventDefault(); event.clipboardData?.setData("text/plain", clipboardPayload()); clipboardItems = copyElements(selectedElements(), 0, 0); };
    const paste = (event: ClipboardEvent) => { if (!clipboardAllowed(event.target) || boardLocked()) return; const raw = event.clipboardData?.getData("text/plain"); if (raw) { event.preventDefault(); pastePayload(raw); } };
    const cut = (event: ClipboardEvent) => { if (!clipboardAllowed(event.target) || boardLocked()) return; copy(event); if (event.defaultPrevented) deleteSelected(); };
    document.addEventListener("copy", copy); document.addEventListener("paste", paste); document.addEventListener("cut", cut);
    onCleanup(() => { document.removeEventListener("copy", copy); document.removeEventListener("paste", paste); document.removeEventListener("cut", cut); });
    const keyUp = (event: KeyboardEvent) => { if (event.code === "Space") setSpaceDown(false); };
    const blur = () => { setSpaceDown(false); setIsPanning(false); panOrigin = undefined; };
    const outsideClick = (event: PointerEvent) => { document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(detail => { if (!detail.contains(event.target as Node)) detail.open = false; }); if (!(event.target instanceof HTMLElement && event.target.closest(".tool-family"))) setOpenToolOptions(undefined); if (!(event.target instanceof HTMLElement && event.target.closest(".canvas-context-menu"))) setContextMenu(undefined); if (textDraft() && event.target instanceof HTMLElement && !event.target.closest(".canvas-text-editor, .style-pane")) commitTextDraft(); if (menu?.open && !menu.contains(event.target as Node)) menu.open = false; if (viewMenu?.open && !viewMenu.contains(event.target as Node)) viewMenu.open = false; };
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
    const timer = window.setInterval(() => { if (textDraft() && !recoveryPrompt() && !syncConflict()) persistRecovery(); if (activePath() && dirty() && !recoveryPrompt() && !textDraft() && !drawing && !resizeOrigin && !moveOrigin) { persistRecovery(); if (!syncConflict() && !saveInFlight) void saveToPath(activePath()!); } }, 1750);
    onCleanup(() => { unlistenClose?.(); window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", blur); document.removeEventListener("pointerdown", outsideClick); document.removeEventListener("keydown", closeMenuOnEscape); colorScheme.removeEventListener("change", updateSystemTheme); window.clearInterval(timer); });
  });

  function setThemePreference(mode: ThemeMode) {
    setThemeMode(mode);
    try { if (mode === "system") localStorage.removeItem("sketchdraw-theme"); else localStorage.setItem("sketchdraw-theme", mode); } catch { /* Theme still applies for this session. */ }
  }

  const recoveryKey = (path: string) => `sketchdraw-v5-recovery:${encodeURIComponent(path)}`;
  function recoverySnapshot(): SketchFile {
    const snapshot = documentSnapshot(); const draft = textDraft(); if (!draft) return snapshot;
    const page = snapshot.pages.find(p => p.id === snapshot.activePageId); if (!page) return snapshot;
    const style = { color: draft.color, opacity: draft.opacity, fontSize: draft.fontSize, fontFamily: draft.fontFamily, bold: draft.bold, italic: draft.italic, underline: draft.underline, textAlign: draft.textAlign, listType: draft.listType };
    if (draft.shapeLabel && draft.editingIndex !== undefined) { const item = page.elements[draft.editingIndex]; if (item && isLabelShape(item)) item.label = { ...style, text: draft.value, verticalAlign: draft.verticalAlign ?? "middle" }; }
    else { const item: TextElement = { ...style, type: "text", x: draft.x, y: draft.y, text: draft.value, id: draft.editingIndex !== undefined ? page.elements[draft.editingIndex]?.id : crypto.randomUUID() }; if (draft.editingIndex !== undefined) page.elements[draft.editingIndex] = item; else if (draft.value.trim()) page.elements.push(item); }
    return snapshot;
  }
  function persistRecovery() {
    if (!activePath() || (!dirty() && !textDraft())) return;
    try { localStorage.setItem(recoveryKey(activePath()!), JSON.stringify({ savedAt: Date.now(), baselineRaw: lastSavedRaw, snapshot: recoverySnapshot() })); } catch { /* Recovery is best-effort if browser storage is unavailable. */ }
  }

  function applySnapshot(snapshot: SketchFile, path: string, rawText: string) {
    pageHistories.clear(); setTextDraft(undefined); setPreview(undefined); setMarquee(undefined); drawing = false; moveOrigin = undefined; resizeOrigin = undefined;
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
    commitTextDraft(); saveInFlight = true; setSaving(true);
    try {
      const snapshot = documentSnapshot();
      const encodedSnapshot = snapshotRaw(snapshot);
      const isNewPath = activePath() !== path;
      if (!isNewPath && !force && lastSavedRaw !== undefined) {
        const diskRaw = await readTextFile(path);
        if (diskRaw !== lastSavedRaw) { setSyncConflict({ path, remote: diskRaw }); return; }
      }
      await invoke("atomic_save_sketch", { path, contents: encodedSnapshot, expected: !force && !isNewPath ? lastSavedRaw ?? null : null }); setActivePath(path); if (isNewPath) rememberFile(path);
      lastSavedRaw = encodedSnapshot;
      setSyncConflict(undefined);
      try { localStorage.removeItem(recoveryKey(path)); } catch { /* Recovery cleanup is best-effort. */ }
      setDirty(snapshotRaw(documentSnapshot()) !== encodedSnapshot);
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })); setError("");
    } catch (cause) { if (String(cause).includes("CONFLICT:")) { try { setSyncConflict({ path, remote: await readTextFile(path) }); } catch { /* Preserve recovery if disk is unavailable. */ } } setError(`Could not save file: ${String(cause)}`); }
    finally { saveInFlight = false; setSaving(false); }
  }

  async function saveAs() {
    if (!activePath()) { await createFile(); return; }
    if (nativeBusy() || documentBusy()) return;
    setNativeBusy(true);
    try {
      const path = await save({ title: "Save SketchDraw file", defaultPath: "Untitled.sketch", filters: [{ name: "SketchDraw", extensions: ["sketch"] }] });
      if (path) await saveToPath(withSketchExtension(path));
    } catch (cause) { setError(`Could not choose save location: ${String(cause)}`); } finally { setNativeBusy(false); }
  }

  function rememberFile(path: string) {
    const updated = [path, ...recentFiles().filter((recent) => recent !== path)].slice(0, 8);
    setRecentFiles(updated);
    try { localStorage.setItem("sketchdraw-v5-recent-files", JSON.stringify(updated)); } catch { /* Local storage may be disabled by the host. */ }
  }

  async function saveBeforeReplacingDocument(): Promise<boolean> {
    commitTextDraft();
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
    if (documentBusy()) return;
    setDocumentBusy(true);
    try {
      if (!path.toLowerCase().endsWith(".sketch")) throw new Error("Only .sketch documents are supported.");
      if (!await saveBeforeReplacingDocument()) return;
      // Recent paths survive app restarts, but Tauri's file-dialog scope does
      // not. Re-authorize this one existing SketchDraw file before reading it.
      const authorizedPath = await invoke<string>("authorize_sketch_file", { path });
      const rawText = await readTextFile(authorizedPath);
      const raw: unknown = JSON.parse(rawText);
      const parsed = parseSketchFile(raw);
      if (!parsed) throw new Error("This file is invalid or is not a SketchDraw v5 document. Older formats are unsupported; create a new sketch.");
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
    } catch (cause) { setError(`Could not open file: ${String(cause)}`); } finally { setDocumentBusy(false); }
  }

  async function openFile() {
    if (nativeBusy() || documentBusy()) return;
    setNativeBusy(true);
    try {
      const selected = await open({ title: "Open SketchDraw file", multiple: false, filters: [{ name: "SketchDraw", extensions: ["sketch"] }] });
      if (!selected || Array.isArray(selected)) return;
      await loadFile(selected);
    } catch (cause) { setError(`Could not choose file: ${String(cause)}`); } finally { setNativeBusy(false); }
  }

  async function importImage() {
    if (!activePath()) return;
    if (nativeBusy() || documentBusy()) return;
    setNativeBusy(true);
    if (boardLocked()) { setNativeBusy(false); return; }
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
      pushUndo(cloneElements(elements())); setElements((items) => [...items, item]); imageCache.set(dataUrl, image); setSelectedIndices([elements().length - 1]); setDirty(true);
    } catch (cause) { setError(`Could not import image: ${String(cause)}`); } finally { setNativeBusy(false); }
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
    if (nativeBusy() || documentBusy()) return;
    setNativeBusy(true);
    try {
      const selected = await save({ title: "Create SketchDraw file", defaultPath: "Untitled.sketch", filters: [{ name: "SketchDraw", extensions: ["sketch"] }] });
      if (!selected) return;
      if (!await saveBeforeReplacingDocument()) return;
      const path = withSketchExtension(selected);
      const page: SketchPage = { id: "page-1", name: "Page 1", canvasState: emptyCanvas(), elements: [] };
      const document: SketchFile = { format: "SketchDraw", version: 5, activePageId: page.id, pages: [page] };
      const contents = JSON.stringify(document, null, 2);
      await invoke("atomic_save_sketch", { path, contents, expected: null });
      pageHistories.clear(); setPages([page]); setActivePageId(page.id); setElements([]); setCanvasState(emptyCanvas()); setBoardColor("#ffffff"); setBoardColorFollowsTheme(true); setSelectedIndices([]); setHoveredIndex(undefined); setActivePath(path); rememberFile(path); setDirty(false); setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })); setBoardLocked(false); setError(""); lastSavedRaw = contents;
      undoStack = []; redoStack = []; setHistoryVersion((version) => version + 1);
    } catch (cause) { setError(`Could not create SketchDraw file: ${String(cause)}`); } finally { setNativeBusy(false); }
  }

  function openExportOptions(format: "png" | "svg" | "pdf") { setExportFormat(format); setExportOptionsOpen(true); }

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
    if (!canvas || nativeBusy() || documentBusy()) return;
    setNativeBusy(true);
    try {
      if ((!Number.isFinite(exportWidth()) || !Number.isFinite(exportHeight()) || exportWidth() < 1 || exportHeight() < 1 || exportWidth() > 12000 || exportHeight() > 12000 || exportWidth() * exportHeight() > 60_000_000)) throw new Error("Choose dimensions between 1 and 12,000 pixels, totaling no more than 60 megapixels.");
      commitTextDraft();
      const exportItems = cloneElements(exportScope() === "selection" ? selectedElements() : elements()).filter(item => !item.hidden);
      if (exportScope() === "selection" && !exportItems.length) throw new Error("Select one or more visible objects to export.");
      const rect = canvas.getBoundingClientRect(); const view = { ...canvasState() };
      const prepareImages = async (items: Element[]): Promise<void> => { await Promise.all(items.map(async item => { if (item.type === "group") await prepareImages(item.elements); else if (item.type === "image") { let bitmap = imageCache.get(item.dataUrl); if (!bitmap) { bitmap = new Image(); bitmap.src = item.dataUrl; imageCache.set(item.dataUrl, bitmap); } await bitmap.decode(); } })); };
      await prepareImages(exportItems);
      const rawBounds = exportScope() === "viewport" ? { x: -view.panX / view.zoom, y: -view.panY / view.zoom, w: rect.width / view.zoom, h: rect.height / view.zoom } : unionBounds(exportItems.map(elementBounds)) ?? { x: 0, y: 0, w: 800, h: 600 };
      const padding = exportScope() === "viewport" ? 0 : 24;
      const bounds = { x: rawBounds.x - padding, y: rawBounds.y - padding, w: Math.max(1, rawBounds.w + padding * 2), h: Math.max(1, rawBounds.h + padding * 2) };
      const exportViewFor = (width: number, height: number) => { const zoom = Math.min(width / bounds.w, height / bounds.h); return { ...view, zoom, panX: (width - bounds.w * zoom) / 2 - bounds.x * zoom, panY: (height - bounds.h * zoom) / 2 - bounds.y * zoom }; };
      const path = await save({ title: `Export SketchDraw as ${format.toUpperCase()}`, defaultPath: `SketchDraw.${format}`, filters: [{ name: format.toUpperCase(), extensions: [format] }] });
      if (!path) return;
      const target = path.toLowerCase().endsWith(`.${format}`) ? path : `${path}.${format}`;

      if (format === "png" || format === "pdf") {
        const width = Math.max(1, Math.min(12000, Math.floor(exportWidth()))); const height = Math.max(1, Math.min(12000, Math.floor(exportHeight())));
        if (width * height > 60_000_000) throw new Error("Export is too large. Choose dimensions totaling no more than 60 megapixels.");
        const output = document.createElement("canvas"); output.width = width; output.height = height;
        const ctx = output.getContext("2d"); if (!ctx) throw new Error("Could not create PNG image.");
        const exportView = exportViewFor(width, height);
        drawScene(ctx, width, height, 1, false, format === "png" && exportTransparent(), exportView, exportItems, exportGrid());
        const mime = format === "pdf" ? "image/jpeg" : "image/png";
        const blob = await new Promise<Blob>((resolve, reject) => output.toBlob((value) => value ? resolve(value) : reject(new Error(`${format.toUpperCase()} image encoding failed.`)), mime, .94));
        if (format === "png") await writeFile(target, new Uint8Array(await blob.arrayBuffer()));
        else await writeFile(target, imagePdf(new Uint8Array(await blob.arrayBuffer()), width, height));
      } else {
        const state = exportViewFor(exportWidth(), exportHeight());
        const shapes = exportItems.map(elementToSvg).join("\n");
        const grid = exportGrid() && !exportTransparent() ? `<pattern id="grid" width="${GRID_SIZE * state.zoom}" height="${GRID_SIZE * state.zoom}" patternUnits="userSpaceOnUse" x="${state.panX}" y="${state.panY}"><circle cx="1" cy="1" r="1" fill="#deddd6"/></pattern><rect width="100%" height="100%" fill="url(#grid)"/>` : "";
        const svgBackground = renderedBoardColor();
        const svgGrid = theme() === "dark" ? "#414653" : "#deddd6";
        const themedGrid = grid.replace("#deddd6", svgGrid);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${exportWidth()}" height="${exportHeight()}" viewBox="0 0 ${exportWidth()} ${exportHeight()}">${exportTransparent() ? "" : `<rect width="100%" height="100%" fill="${svgBackground}"/>`}${themedGrid}<g transform="translate(${state.panX} ${state.panY}) scale(${state.zoom})">${shapes}</g></svg>`;
        await writeTextFile(target, svg);
      }
      setError("");
    } catch (cause) { setError(`Could not export image: ${String(cause)}`); } finally { setNativeBusy(false); }
  }

  function elementToSvg(element: Element): string {
    if (element.hidden) return "";
    if (element.type === "group") return `<g>${element.elements.map(elementToSvg).join("")}</g>`;
    const bounds = elementBounds(element); const cx = bounds.x + bounds.w / 2; const cy = bounds.y + bounds.h / 2;
    const content = elementSvgBody(element) + (isLabelShape(element) ? labelSvg(element) : "");
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
    const style = `fill="${fillColor ? escapeXml(fillColor) : "none"}"${fillColor ? ` fill-opacity="${fillOpacity}"` : ""} stroke="${escapeXml(element.color)}" opacity="${element.opacity ?? 1}" stroke-width="${element.thickness}" stroke-dasharray="${dash}" stroke-linecap="round" stroke-linejoin="round"`;
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
    if (element.type === "rectangle") return `<rect x="${Math.min(element.x, element.x + element.w)}" y="${Math.min(element.y, element.y + element.h)}" width="${Math.abs(element.w)}" height="${Math.abs(element.h)}" rx="${element.edgeStyle === "rounded" ? Math.min(14, Math.abs(element.w) / 4, Math.abs(element.h) / 4) : 0}" ${style}/>`;
    if (element.type === "diamond") return `<path d="M ${element.x + element.w / 2} ${element.y} L ${element.x + element.w} ${element.y + element.h / 2} L ${element.x + element.w / 2} ${element.y + element.h} L ${element.x} ${element.y + element.h / 2} Z" ${style}/>`;
    if (element.type === "circle") return `<ellipse cx="${element.x + element.w / 2}" cy="${element.y + element.h / 2}" rx="${Math.abs(element.w / 2)}" ry="${Math.abs(element.h / 2)}" ${style}/>`;
    if (element.type === "flowchart") {
      const detail = flowchartSvgDetailPath(element);
      const detailStyle = `fill="none" stroke="${escapeXml(element.color)}" opacity="${element.opacity ?? 1}" stroke-width="${element.thickness}" stroke-dasharray="${dash}" stroke-linecap="round" stroke-linejoin="round"`;
      return `<path d="${flowchartSvgPath(element)}" ${style}/>${detail ? `<path d="${detail}" ${detailStyle}/>` : ""}`;
    }
    if (element.type === "line" || element.type === "arrow") {
      const path = connectorSvgPath(element); const route = element.arrowRoute ?? "straight";
      const shift = element.lineStyle === "double" ? Math.max(2.5, element.thickness * 1.2) : 0; const normal = { x: -element.h / Math.max(1, Math.hypot(element.w, element.h)), y: element.w / Math.max(1, Math.hypot(element.w, element.h)) };
      const paths = shift ? `<path d="${path}" transform="translate(${normal.x * shift} ${normal.y * shift})" ${style}/><path d="${path}" transform="translate(${-normal.x * shift} ${-normal.y * shift})" ${style}/>` : `<path d="${path}" ${style}/>`;
      if (element.type !== "arrow") return paths;
      const headSvg = (tip: Point, direction: number, kind: ArrowHead) => {
        if (kind === "none") return "";
        if (kind === "dot") return `<circle cx="${tip.x}" cy="${tip.y}" r="${Math.max(3, element.thickness * 1.15)}" fill="${element.color}" opacity="${element.opacity ?? 1}"/>`;
        const points = arrowHeadPoints(tip, direction, kind, element.thickness); const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");
        if (kind === "solid" || kind === "thick" || kind === "diamond") return `<polygon points="${polygon}" fill="${element.color}" stroke="${element.color}" stroke-width="${element.thickness}" opacity="${element.opacity ?? 1}"/>`;
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
    setContextMenu(undefined); if (textDraft()) commitTextDraft();
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
        setSidebarTab("properties");
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
      const hit = hitTest(point) ?? hitInterior(point); if (hit !== undefined && isLabelShape(elements()[hit])) editShapeLabel(hit); else startTextDraft(point, hit !== undefined && elements()[hit]?.type === "text" ? hit : undefined); return;
    }
    if (tool() === "bucket") { const hit = hitInterior(point); if (hit !== undefined) updatePropertyForIndex(hit, fillColor()); return; }
    if (tool() === "eraser") { eraseAtPoint(point); drawing = true; canvas.setPointerCapture(event.pointerId); return; }
    if (tool() === "crop") { const hit = hitTest(point); if (hit !== undefined && elements()[hit].type === "image") { setSelectedIndices([hit]); marqueeOrigin = { point, additive: false, moved: false, cropIndex: hit }; setMarquee({ start: point, end: point }); canvas.setPointerCapture(event.pointerId); } return; }
    drawing = true; canvas.setPointerCapture(event.pointerId);
    activeDrawingTool = tool() as Preview["type"];
    const start = activeDrawingTool === "line" || activeDrawingTool === "arrow" ? nearestBinding(elements(), point, 18 / canvasState().zoom)?.point ?? snap(point) : activeDrawingTool === "pen" ? point : snap(point);
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
    const raw = toWorld(event); const port = activeDrawingTool === "line" || activeDrawingTool === "arrow" ? nearestBinding(elements(), raw, 18 / canvasState().zoom) : undefined; setAttachmentHint(port?.point); const point = port?.point ?? (activeDrawingTool === "pen" ? raw : snap(raw));
    if (activeDrawingTool === "pen") currentPoints.push(point);
    setPreview((previous) => previous ? { ...previous, end: point } : undefined);
  }

  function moveElement(element: Element, dx: number, dy: number): Element {
    if (element.locked) return element;
    if (element.type === "group") return { ...element, elements: element.elements.map((child) => moveElement(child, dx, dy)) };
    if (element.type === "freehand") return { ...element, points: element.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
    if (isConnector(element)) return { ...element, x: element.x + dx, y: element.y + dy, routePoints: element.routePoints?.map(p => ({ x: p.x + dx, y: p.y + dy })) };
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
    const context = canvas?.getContext("2d"); if (!context) return undefined;
    for (let index = elements().length - 1; index >= 0; index--) {
      const shape = elements()[index]; if (!isLabelShape(shape) || shape.hidden || shape.locked) continue;
      const cx = shape.x + shape.w / 2; const cy = shape.y + shape.h / 2; const angle = -(shape.rotation ?? 0) * Math.PI / 180;
      const local = { x: cx + (point.x - cx) * Math.cos(angle) - (point.y - cy) * Math.sin(angle), y: cy + (point.x - cx) * Math.sin(angle) + (point.y - cy) * Math.cos(angle) };
      context.save(); context.setTransform(1, 0, 0, 1, 0, 0); context.beginPath();
      const left = Math.min(shape.x, shape.x + shape.w); const top = Math.min(shape.y, shape.y + shape.h); const width = Math.abs(shape.w); const height = Math.abs(shape.h);
      if (shape.type === "circle") context.ellipse(cx, cy, width / 2, height / 2, 0, 0, Math.PI * 2);
      else if (shape.type === "diamond") { context.moveTo(cx, top); context.lineTo(left + width, cy); context.lineTo(cx, top + height); context.lineTo(left, cy); context.closePath(); }
      else if (shape.type === "flowchart") traceFlowchart(context, shape.flowchartShape ?? "process", shape.x, shape.y, shape.w, shape.h);
      else if (shape.edgeStyle === "rounded") context.roundRect(left, top, width, height, Math.min(14, width / 4, height / 4));
      else context.rect(left, top, width, height);
      const inside = context.isPointInPath(local.x, local.y); context.restore(); if (inside) return index;
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
    setAttachmentHint(undefined);
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
        setSidebarTab("properties");
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
      if (isConnector(item)) { item.startBinding = nearestBinding(elements(), activePreview.start, 18 / canvasState().zoom)?.binding; item.endBinding = nearestBinding(elements(), activePreview.end, 18 / canvasState().zoom)?.binding; }
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
    if (boardLocked() || focusedElement()?.locked) return;
    if (property === "fontSize" && (!Number.isFinite(Number(value)) || Number(value) < 8 || Number(value) > 160)) return;
    if (focusedElement() && isLabelShape(focusedElement()!)) updateLabel(property, value);
    else if (selectedText() && !textDraft()) updateProperty(property, value);
    else {
      if (property === "bold") setDefaultBold(Boolean(value)); else if (property === "italic") setDefaultItalic(Boolean(value)); else if (property === "underline") setDefaultUnderline(Boolean(value));
      else if (property === "textAlign") setDefaultTextAlign(value as "left" | "center" | "right"); else if (property === "listType") setDefaultListType(value as "none" | "bullet" | "number");
      else if (property === "fontSize") setDefaultFontSize(Number(value)); else if (property === "fontFamily") setDefaultFontFamily(value as "sans" | "hand");
    }
    setTextDraft((draft) => draft ? { ...draft, [property]: value } : undefined);
  };
  const rotateSelection = (delta: number) => { if (boardLocked()) return; const index = primarySelection(); const item = index === undefined ? undefined : elements()[index]; if (!item || item.locked || item.type === "group" || isConnector(item)) return; const before = cloneElements(elements()); setElements((items) => items.map((element, i) => i === index ? { ...element, rotation: (element.rotation ?? 0) + delta } as Element : element)); pushUndo(before); setDirty(true); };
  const resetSelectionRotation = () => { const index = primarySelection(); const item = index === undefined ? undefined : elements()[index]; if (boardLocked() || !item || item.locked || item.type === "group" || (item.rotation ?? 0) === 0) return; const before = cloneElements(elements()); setElements((items) => items.map((element, i) => i === index ? { ...element, rotation: 0 } as Element : element)); pushUndo(before); setDirty(true); };
  const closeSystemMenu = (action: () => void) => { if (menu) menu.open = false; if (viewMenu) viewMenu.open = false; action(); };
  const toggleSidebar = () => {
    if (!sidebarOpen()) { setSidebarOpen(true); if (tool() === "select" && selectedIndices().length === 0) setSidebarTab("layers"); return; }
    if (tool() === "select" && selectedIndices().length === 0 && sidebarTab() !== "layers") { setSidebarTab("layers"); return; }
    setSidebarOpen(false);
  };
  const activateTool = (next: Tool) => { commitTextDraft(); setOpenToolOptions(undefined); const chosen = tool() === next && next !== "select" ? "select" : next; setTool(chosen); if (chosen !== "select" && chosen !== "pan") { setSelectedIndices([]); setSidebarTab("properties"); } };
  return (
    <main class={`app-shell theme-${theme()}`}>
      <header class="topbar">
        <div class="header-leading"><div class="brand"><img class="brand-mark-image" src={sketchDrawMark} alt="" /><span>{activePath() ? fileName() : "SketchDraw"}</span></div></div>
        <nav class="app-menus" aria-label="Application menus">
          <details class="menu-dropdown" ref={menu}><summary>File<svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg></summary><div class="system-menu-popover"><div class="menu-file-label">{activePath() ? fileName() : "No file open"}</div>
            <button onClick={() => closeSystemMenu(() => void createFile())}>New sketch <kbd>Ctrl+N</kbd></button><button onClick={() => closeSystemMenu(() => void openFile())}>Open sketch <kbd>Ctrl+O</kbd></button><button onClick={() => closeSystemMenu(() => { if (activePath()) void saveToPath(activePath()!); else void saveAs(); })}>Save <kbd>Ctrl+S</kbd></button><button onClick={() => closeSystemMenu(() => void saveAs())}>Save as...</button><button onClick={() => closeSystemMenu(() => void importImage())}>Import image...</button><div class="menu-separator" /><button onClick={() => closeSystemMenu(() => openExportOptions("png"))}>Export PNG...</button><button onClick={() => closeSystemMenu(() => openExportOptions("pdf"))}>Export PDF...</button><button onClick={() => closeSystemMenu(() => openExportOptions("svg"))}>Export SVG...</button><button disabled={!elements().length || boardLocked()} onClick={() => closeSystemMenu(() => setShowClearConfirm(true))}>Clear canvas</button>
          </div></details>
          <details class="menu-dropdown" ref={viewMenu}><summary>View<svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg></summary><div class="system-menu-popover view-popover"><span class="menu-section-title">Appearance</span><div class="theme-options"><button class={themeMode() === "system" ? "active" : ""} onClick={() => closeSystemMenu(() => setThemePreference("system"))} title="Use system theme"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z"/></svg><span>System</span></button><button class={themeMode() === "light" ? "active" : ""} onClick={() => closeSystemMenu(() => setThemePreference("light"))} title="Light theme"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><span>Light</span></button><button class={themeMode() === "dark" ? "active" : ""} onClick={() => closeSystemMenu(() => setThemePreference("dark"))} title="Dark theme"><svg viewBox="0 0 24 24"><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5z"/></svg><span>Dark</span></button></div><div class="menu-separator" /><span class="menu-section-title">Whiteboard</span><div class="view-colors"><button class={`board-auto-button ${boardColorFollowsTheme() ? "active" : ""}`} title="Match the canvas to the active theme" disabled={boardLocked()} onClick={() => closeSystemMenu(() => { setBoardColorFollowsTheme(true); setCanvasState({ ...canvasState(), boardColorFollowsTheme: true }); setDirty(true); })}>Auto</button>{BOARD_COLORS.map((value) => <button class={`color-swatch ${!boardColorFollowsTheme() && boardColor() === value ? "active" : ""}`} style={{ background: value }} aria-label={`Whiteboard ${value}`} title={value} disabled={boardLocked()} onClick={() => closeSystemMenu(() => { if (!boardLocked()) { setBoardColor(value); setBoardColorFollowsTheme(false); setCanvasState({ ...canvasState(), backgroundColor: value, boardColorFollowsTheme: false }); setDirty(true); } })} />)}<label class="custom-color-swatch" title="Custom whiteboard color"><input aria-label="Custom whiteboard color" type="color" value={renderedBoardColor()} disabled={boardLocked()} onInput={(event) => { if (!boardLocked()) { setBoardColor(event.currentTarget.value); setBoardColorFollowsTheme(false); setCanvasState({ ...canvasState(), backgroundColor: event.currentTarget.value, boardColorFollowsTheme: false }); setDirty(true); } }} /></label></div></div></details>
        </nav>
        <div class="canvas-toolbar" aria-label="Canvas actions"><button class="header-control" title="Fit drawing (1)" aria-label="Fit drawing" onClick={() => fitDocumentToViewport(elements())}><svg viewBox="0 0 24 24"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8z"/></svg><kbd>1</kbd></button><button class="header-control" disabled={!selectedIndices().length} title="Zoom to selection (2)" aria-label="Zoom to selection" onClick={() => fitDocumentToViewport(selectedElements())}><svg viewBox="0 0 24 24"><path d="M3 3h7M3 3v7m18-7h-7m7-0v7M3 21h7m-7 0v-7m18 7h-7m7 0v-7"/><circle cx="12" cy="12" r="3"/></svg><kbd>2</kbd></button><button class={`header-control ${showGrid() ? "active" : ""}`} title="Toggle grid (G)" aria-label="Toggle grid (G)" onClick={() => setShowGrid((visible) => !visible)}><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM4 10h16M10 4v16"/></svg><kbd>G</kbd></button><button class={`header-control ${snapToObjects() ? "active" : ""}`} title="Snap to other objects (Shift+O)" aria-label="Snap to other objects (Shift+O)" onClick={() => setSnapToObjects((enabled) => !enabled)}><svg viewBox="0 0 24 24"><path d="M5 5h5v5H5zM14 14h5v5h-5zM10 7.5h4M16.5 10v4"/></svg><kbd>⇧O</kbd></button><button class={`header-control ${snapToGrid() ? "active" : ""}`} title="Toggle snap to grid (Shift+G)" aria-label="Toggle snap to grid (Shift+G)" onClick={() => setSnapToGrid((enabled) => !enabled)}><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM8 8h8v8H8z"/></svg><kbd>⇧G</kbd></button><button class="header-control" disabled={!canUndo() || boardLocked()} title="Undo (Ctrl/Cmd+Z)" aria-label="Undo" onClick={undo}><svg viewBox="0 0 24 24"><path d="M9 7 4 12l5 5M5 12h8a6 6 0 0 1 6 6"/></svg><kbd>Ctrl Z</kbd></button><button class="header-control" disabled={!canRedo() || boardLocked()} title="Redo (Ctrl/Cmd+Y)" aria-label="Redo" onClick={redo}><svg viewBox="0 0 24 24"><path d="m15 7 5 5-5 5m4-5h-8a6 6 0 0 0-6 6"/></svg><kbd>Ctrl Y</kbd></button><button class={`header-control group-control ${groupSelected() ? "active" : ""}`} disabled={!groupActionEnabled() || boardLocked()} title="Group / ungroup (Ctrl/Cmd+G)" aria-label="Group or ungroup" onClick={groupSelection}><svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="9" height="9" rx="1.5"/><rect x="11.5" y="11" width="9" height="9" rx="1.5"/></svg><kbd>Ctrl G</kbd></button><button class={`header-control ${boardLocked() ? "active" : ""}`} title="Toggle canvas lock (K)" aria-label="Toggle canvas lock" onClick={() => setBoardLocked((locked) => !locked)}><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d={boardLocked() ? "M8 10V7a4 4 0 1 1 8 0v3" : "M8 10V7a4 4 0 0 1 8 0"}/></svg><kbd>K</kbd></button><button class="header-control reset-zoom" title="Center drawing and reset zoom to 100% (0)" aria-label={`Center drawing and reset zoom, currently ${Math.round(canvasState().zoom * 100)} percent`} onClick={resetZoomAndCenter}><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M10.5 7v7m-3.5-3.5h7"/></svg><kbd>{Math.round(canvasState().zoom * 100)}%</kbd></button></div>
        <div class="top-actions"><span class={`save-status ${saving() ? "is-saving" : (dirty() || textDraft()) ? "is-dirty" : "is-saved"}`} role="status" aria-live="polite" aria-label={status()} title={status()}><i /><time>{savedAt() || "—"}</time></span></div>
      </header>
      <Show when={activePath()} fallback={<section class="welcome-screen"><div class="welcome-card"><div class="welcome-symbol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" /></svg></div><p class="eyebrow">A quiet place to think</p><h1>Make space for<br /><em>your next idea.</em></h1><p class="welcome-copy">A simple, private canvas saved as a file on your device. Keep it in any folder, including your cloud drive.</p><div class="welcome-actions"><button class="save-button large" onClick={createFile}>Create new file <span aria-hidden="true">→</span></button><button class="quiet-button large" onClick={openFile}>Open a sketch</button></div><div class="file-hint"><span class="file-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h5" /></svg></span><span><strong>Your work stays yours</strong><br />Saved locally as a portable .sketch file.</span></div></div><div class="recent-dashboard"><div class="recent-heading"><span class="eyebrow">FILE BROWSER</span><h2>Recent sketches</h2></div><Show when={recentFiles().length > 0} fallback={<div class="recent-empty"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h5" /></svg><strong>No recent sketches yet</strong><span>Open a .sketch file or create a new one.</span><button class="quiet-button" onClick={openFile}>Browse for a file</button></div>}><div class="recent-list">{recentFiles().map((path) => <button class="recent-file" onClick={() => void loadFile(path)}><span class="recent-file-icon"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h5" /></svg></span><span class="recent-file-name">{path.split(/[\\/]/).pop()}</span><span class="recent-file-path">{path}</span><span class="recent-open">Open →</span></button>)}</div></Show></div></section>}>
        <>
          <section class="canvas-wrap" ref={canvasWrap}>
            <canvas ref={canvas} class="drawing-canvas" style={{ cursor: isPanning() ? "grabbing" : spaceDown() || tool() === "pan" ? "grab" : boardLocked() ? "not-allowed" : tool() === "select" ? hoveredIndex() !== undefined ? "move" : "default" : tool() === "text" ? "text" : tool() === "eraser" ? "cell" : tool() === "bucket" ? "copy" : tool() === "crop" ? "crosshair" : "crosshair" }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { if (resizeOrigin) setElements(resizeOrigin.before); if (moveOrigin) setElements(moveOrigin.before); drawing = false; setPreview(undefined); setMarquee(undefined); setAttachmentHint(undefined); resizeOrigin = undefined; moveOrigin = undefined; marqueeOrigin = undefined; panOrigin = undefined; setIsPanning(false); }} onPointerLeave={() => { if (!moveOrigin && !resizeOrigin) setHoveredIndex(undefined); }} onDblClick={(event) => { if (boardLocked()) return; event.preventDefault(); const rect = canvas.getBoundingClientRect(); const view = canvasState(); const point = { x: (event.clientX - rect.left - view.panX) / view.zoom, y: (event.clientY - rect.top - view.panY) / view.zoom }; const hit = hitTest(point) ?? hitInterior(point); if (hit !== undefined && isLabelShape(elements()[hit])) editShapeLabel(hit); else startTextDraft(point, hit !== undefined && elements()[hit]?.type === "text" ? hit : undefined); }} onContextMenu={onContextMenu} />
            <nav class="page-tabs" aria-label="Sketch pages">
              <div class="page-tab-list">{pages().map((page, index) => <button class={`page-tab ${page.id === activePageId() ? "active" : ""}`} aria-current={page.id === activePageId() ? "page" : undefined} title={`${page.name} — double-click to rename`} onClick={() => switchPage(page.id)} onDblClick={() => { switchPage(page.id); openPageDialog("rename"); }}><small>{index + 1}</small> {page.name}</button>)}</div>
              <button title="Add page" aria-label="Add page" disabled={boardLocked() || pages().length >= 100} onClick={addPage}>+</button>
              <details class="page-menu"><summary aria-label="Page actions">•••</summary><div class="page-actions" onClick={event => { const parent = event.currentTarget.parentElement as HTMLDetailsElement; parent.open = false; }}>
                <button disabled={boardLocked()} onClick={() => openPageDialog("rename")}>Rename page</button><button disabled={boardLocked() || pages().length >= 100} onClick={duplicatePage}>Duplicate page</button>
                <button disabled={boardLocked() || pages()[0]?.id === activePageId()} onClick={() => reorderPage(-1)}>Move page left</button><button disabled={boardLocked() || pages()[pages().length - 1]?.id === activePageId()} onClick={() => reorderPage(1)}>Move page right</button>
                <button disabled={boardLocked() || pages().length <= 1} onClick={() => openPageDialog("delete")}>Delete page…</button>
              </div></details>
            </nav>
            <Show when={toolBarOpen()} fallback={<button class="tool-deck-reopen" title="Show tools" aria-label="Show tools" onClick={() => setToolBarOpen(true)}><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg></button>}><nav class="tool-deck" aria-label="Canvas tools">{tools.map(({ value, label, key, path }) => { const active = tool() === value || (value === "pan" && spaceDown()); const hasOptions = value === "flowchart" || value === "line" || value === "arrow"; const button = <button class={`tool-icon-button ${active ? "selected" : ""} ${hasOptions ? "has-options" : ""}`} title={`${label} (${key})${hasOptions ? " · hover for more options" : ""}`} aria-label={label} aria-haspopup={hasOptions ? "menu" : undefined} aria-pressed={active} onClick={() => activateTool(value)}><svg viewBox="0 0 24 24" aria-hidden="true">{value === "flowchart" ? <><path d="M12 8v3m0 3v2m-1.5-5h3"/><rect x="9.5" y="2.5" width="5" height="5" rx="1"/><path d="m12 14 3 3-3 3-3-3z"/><rect x="9.5" y="15.5" width="5" height="5" rx="1"/></> : <path d={path} />}</svg><kbd>{key}</kbd>{hasOptions && <svg class="tool-family-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3"/></svg>}</button>;
              if (value === "flowchart") return <div class="tool-family flowchart-family" classList={{ "options-open": openToolOptions() === value }} onMouseEnter={() => setOpenToolOptions(value)} onMouseLeave={() => setOpenToolOptions(undefined)}>{button}<button class="family-expander" title="More options" aria-label={`More ${label.toLowerCase()} options`} aria-expanded={openToolOptions() === value} onClick={() => setOpenToolOptions(openToolOptions() === value ? undefined : value)}><svg viewBox="0 0 12 12"><path d="m3 4 3 3 3-3" /></svg></button><div class="tool-options flowchart-options" role="menu" aria-label="Flowchart symbols">{FLOWCHART_SHAPES.map((shape) => <button class={flowchartShape() === shape.value ? "active" : ""} role="menuitem" title={shape.label} aria-label={shape.label} onClick={() => { setOpenToolOptions(undefined); setFlowchartShape(shape.value); setTool("flowchart"); setSidebarTab("properties"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d={shape.path} /></svg><span>{shape.label}</span></button>)}</div></div>;
              if (value === "line") return <div class="tool-family route-family" classList={{ "options-open": openToolOptions() === value }} onMouseEnter={() => setOpenToolOptions(value)} onMouseLeave={() => setOpenToolOptions(undefined)}>{button}<button class="family-expander" title="More options" aria-label={`More ${label.toLowerCase()} options`} aria-expanded={openToolOptions() === value} onClick={() => setOpenToolOptions(openToolOptions() === value ? undefined : value)}><svg viewBox="0 0 12 12"><path d="m3 4 3 3 3-3" /></svg></button><div class="tool-options route-options" role="menu" aria-label="Line routes">{LINE_ROUTES.map((route) => <button class={lineRoute() === route.value ? "active" : ""} role="menuitem" title={route.label} aria-label={route.label} onClick={() => { setOpenToolOptions(undefined); setLineRoute(route.value); setTool("line"); setSidebarTab("properties"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d={route.path} /></svg><span>{route.label}</span></button>)}</div></div>;
              if (value === "arrow") return <div class="tool-family route-family" classList={{ "options-open": openToolOptions() === value }} onMouseEnter={() => setOpenToolOptions(value)} onMouseLeave={() => setOpenToolOptions(undefined)}>{button}<button class="family-expander" title="More options" aria-label={`More ${label.toLowerCase()} options`} aria-expanded={openToolOptions() === value} onClick={() => setOpenToolOptions(openToolOptions() === value ? undefined : value)}><svg viewBox="0 0 12 12"><path d="m3 4 3 3 3-3" /></svg></button><div class="tool-options route-options" role="menu" aria-label="Arrow routes">{ARROW_ROUTES.map((route) => <button class={arrowRoute() === route.value ? "active" : ""} role="menuitem" title={route.label} aria-label={route.label} onClick={() => { setOpenToolOptions(undefined); setArrowRoute(route.value); setTool("arrow"); setSidebarTab("properties"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d={route.path} /></svg><span>{route.label}</span></button>)}</div></div>;
              return button; })}<button class="tool-collapse" title="Hide tools" aria-label="Hide tools" onClick={() => setToolBarOpen(false)}><svg viewBox="0 0 24 24"><path d="m7 14 5-5 5 5" /></svg></button></nav></Show>
            <button class={`sidebar-toggle ${sidebarVisible() ? "open" : "closed"}`} title={sidebarVisible() ? "Collapse sidebar" : "Show contextual properties or layers"} aria-label={sidebarVisible() ? "Collapse sidebar" : "Show contextual properties or layers"} onClick={toggleSidebar}><svg viewBox="0 0 24 24"><path d={sidebarVisible() ? "m14 5-7 7 7 7" : "m10 5 7 7-7 7"} /></svg></button>
            <Show when={sidebarVisible()}><aside class="style-pane" aria-label="Properties and layers">
              <nav class="sidebar-tabs"><button class={sidebarTab() === "properties" ? "active" : ""} onClick={() => setSidebarTab("properties")}>Properties</button><button class={sidebarTab() === "layers" ? "active" : ""} onClick={() => setSidebarTab("layers")}>Layers <span>{elements().length}</span></button></nav>
              <Show when={sidebarTab() === "properties"}>
                <Show when={showStrokeControls()}><section class="pane-section"><div class="pane-heading">{tool() === "text" || focusedElement()?.type === "text" ? "Text color" : "Stroke color"}</div><div class="swatch-list stroke-swatches">{swatches.map((swatch) => <button class={`color-swatch ${selectedColor() === swatch ? "active" : ""}`} style={{ background: swatch }} aria-label={`Set color ${swatch}`} title={swatch} onClick={() => updateStrokeColor(swatch)} />)}<label class="custom-color-swatch stroke-custom-swatch" title="Custom stroke color"><input aria-label="Custom stroke color" type="color" value={selectedColor()} onInput={(event) => updateStrokeColor(event.currentTarget.value)} /></label></div></section></Show>
                <Show when={showThicknessControls()}><section class="pane-section"><div class="pane-heading">Stroke width <span>{selectedThickness()} px</span></div><div class="preset-list">{([[1, "Ultra-thin"], [2, "Thin"], [5, "Medium"], [10, "Bold"]] as const).map(([value, label]) => <button class={`preset-button ${selectedThickness() === value ? "active" : ""}`} onClick={() => updateThickness(value)} title={`${label}, ${value}px`}><span class="stroke-indicator" style={{ height: `${Math.max(1, value)}px` }} /><small>{label}</small><small>{value}px</small></button>)}</div><button class="advanced-toggle" aria-expanded={showAdvancedThickness()} onClick={() => setShowAdvancedThickness((visible) => !visible)}>Custom width <span>{showAdvancedThickness() ? "−" : "+"}</span></button><Show when={showAdvancedThickness()}><input class="pane-slider" aria-label="Custom stroke thickness" type="range" min="1" max="24" value={selectedThickness()} onInput={(event) => updateThickness(Number(event.currentTarget.value))} /></Show></section></Show>
                <Show when={tool() === "text" || selectedText() || focusedElement() && isLabelShape(focusedElement()!)}><section class="pane-section"><div class="pane-heading">Text formatting</div><div class="format-row"><button class={(selectedText()?.bold ?? defaultBold()) ? "active" : ""} aria-label="Bold" title="Bold" onClick={() => setTextFormat("bold", !(selectedText()?.bold ?? defaultBold()))}><b>B</b></button><button class={(selectedText()?.italic ?? defaultItalic()) ? "active" : ""} aria-label="Italic" title="Italic" onClick={() => setTextFormat("italic", !(selectedText()?.italic ?? defaultItalic()))}><i>I</i></button><button class={(selectedText()?.underline ?? defaultUnderline()) ? "active" : ""} aria-label="Underline" title="Underline" onClick={() => setTextFormat("underline", !(selectedText()?.underline ?? defaultUnderline()))}><u>U</u></button></div><label class="property-label">Font size<input type="number" min="8" max="160" value={selectedText()?.fontSize ?? defaultFontSize()} onInput={(event) => setTextFormat("fontSize", Number(event.currentTarget.value))} /></label><div class="property-label">Font family<div class="choice-deck"><button class={(selectedText()?.fontFamily ?? defaultFontFamily()) === "sans" ? "active" : ""} title="Modern sans-serif" aria-label="Modern sans-serif font" onClick={() => setTextFormat("fontFamily", "sans")}><span class="font-sans-icon">Aa</span><small>Sans</small></button><button class={(selectedText()?.fontFamily ?? defaultFontFamily()) === "hand" ? "active" : ""} title="Handwritten font" aria-label="Handwritten font" onClick={() => setTextFormat("fontFamily", "hand")}><span class="font-hand-icon">Aa</span><small>Hand</small></button></div></div><div class="property-label">Alignment<div class="choice-deck compact"><button class={(selectedText()?.textAlign ?? defaultTextAlign()) === "left" ? "active" : ""} title="Align left" aria-label="Align left" onClick={() => setTextFormat("textAlign", "left")}><svg viewBox="0 0 24 24"><path d="M4 5h16M4 10h11M4 15h16M4 20h11"/></svg></button><button class={(selectedText()?.textAlign ?? defaultTextAlign()) === "center" ? "active" : ""} title="Align center" aria-label="Align center" onClick={() => setTextFormat("textAlign", "center")}><svg viewBox="0 0 24 24"><path d="M4 5h16M7 10h10M4 15h16M7 20h10"/></svg></button><button class={(selectedText()?.textAlign ?? defaultTextAlign()) === "right" ? "active" : ""} title="Align right" aria-label="Align right" onClick={() => setTextFormat("textAlign", "right")}><svg viewBox="0 0 24 24"><path d="M4 5h16M9 10h11M4 15h16M9 20h11"/></svg></button></div></div><div class="property-label">Paragraphs<div class="choice-deck compact"><button class={(selectedText()?.listType ?? defaultListType()) === "none" ? "active" : ""} title="Plain paragraphs" aria-label="Plain paragraphs" onClick={() => setTextFormat("listType", "none")}><svg viewBox="0 0 24 24"><path d="M5 6h15M5 12h15M5 18h15"/></svg></button><button class={(selectedText()?.listType ?? defaultListType()) === "bullet" ? "active" : ""} title="Bulleted list" aria-label="Bulleted list" onClick={() => setTextFormat("listType", "bullet")}><svg viewBox="0 0 24 24"><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/><path d="M9 6h11M9 12h11M9 18h11"/></svg></button><button class={(selectedText()?.listType ?? defaultListType()) === "number" ? "active" : ""} title="Numbered list" aria-label="Numbered list" onClick={() => setTextFormat("listType", "number")}><svg viewBox="0 0 24 24"><path d="M4 5h2v3M4 8h3M4 12h3l-3 3h3M10 6h10M10 12h10M10 18h10"/></svg></button></div></div></section></Show>
                <Show when={focusedElement() && isLabelShape(focusedElement()!)}><section class="pane-section"><div class="pane-heading">Shape label</div>
                  <button class="quiet-button" disabled={boardLocked() || focusedElement()?.locked} onClick={() => { const index = primarySelection(); if (index !== undefined) editShapeLabel(index); }}>Edit label</button>
                  <label class="property-label">Font color<input type="color" value={textDraft()?.shapeLabel ? textDraft()!.color : selectedLabel()?.color ?? color()} onInput={event => updateLabel("color", event.currentTarget.value)} /></label>
                  <div class="property-label">Vertical alignment<div class="choice-deck">{(["top", "middle", "bottom"] as const).map((alignment, index) => <button title={`Align ${alignment}`} aria-label={`Align ${alignment}`} class={(textDraft()?.verticalAlign ?? selectedLabel()?.verticalAlign ?? "middle") === alignment ? "active" : ""} onClick={() => updateLabel("verticalAlign", alignment)}><svg viewBox="0 0 24 24"><path d={`M3 ${index === 0 ? 4 : index === 1 ? 12 : 20}h18M8 ${6 + index * 2}v6m8-6v6`}/></svg><small>{alignment}</small></button>)}</div></div>
                  <button class={`quiet-button ${selectedText()?.textAlign === "justify" ? "active" : ""}`} onClick={() => setTextFormat("textAlign", "justify")}>Justify text</button><p class="bucket-help">Double-click a shape to edit its label. Text wraps inside the shape.</p>
                </section></Show>
                <Show when={tool() === "line" || tool() === "arrow" || tool() === "rectangle" || tool() === "circle" || tool() === "diamond" || tool() === "flowchart" || ["line", "arrow", "rectangle", "circle", "diamond", "flowchart"].includes(focusedElement()?.type ?? "")}><section class="pane-section"><div class="pane-heading">Line style</div><div class="choice-deck line-choices"><button class={((focusedElement() as ShapeElement | undefined)?.lineStyle ?? lineStyle()) === "solid" ? "active" : ""} title="Solid line" aria-label="Solid line" onClick={() => focusedElement() ? updateProperty("lineStyle", "solid") : setLineStyle("solid")}><svg viewBox="0 0 24 24"><path d="M3 12h18"/></svg><small>Solid</small></button><button class={((focusedElement() as ShapeElement | undefined)?.lineStyle ?? lineStyle()) === "dashed" ? "active" : ""} title="Dashed line" aria-label="Dashed line" onClick={() => focusedElement() ? updateProperty("lineStyle", "dashed") : setLineStyle("dashed")}><svg viewBox="0 0 24 24" class="dash-icon"><path d="M3 12h18"/></svg><small>Dash</small></button><button class={((focusedElement() as ShapeElement | undefined)?.lineStyle ?? lineStyle()) === "dotted" ? "active" : ""} title="Dotted line" aria-label="Dotted line" onClick={() => focusedElement() ? updateProperty("lineStyle", "dotted") : setLineStyle("dotted")}><svg viewBox="0 0 24 24" class="dot-icon"><path d="M3 12h18"/></svg><small>Dot</small></button><Show when={tool() === "line" || tool() === "arrow" || focusedElement()?.type === "line" || focusedElement()?.type === "arrow"}><button class={((focusedElement() as ShapeElement | undefined)?.lineStyle ?? lineStyle()) === "double" ? "active" : ""} title="Double line" aria-label="Double line" onClick={() => focusedElement() ? updateProperty("lineStyle", "double") : setLineStyle("double")}><svg viewBox="0 0 24 24"><path d="M3 9h18M3 15h18"/></svg><small>Double</small></button></Show></div><Show when={focusedElement()?.type === "rectangle" || tool() === "rectangle"}><div class="property-label">Corners<div class="choice-deck compact"><button class={((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "sharp" ? "active" : ""} title="Square corners" aria-label="Square corners" onClick={() => focusedElement() ? updateProperty("edgeStyle", "sharp") : setEdgeStyle("sharp")}><svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14"/></svg></button><button class={((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "rounded" ? "active" : ""} title="Rounded corners" aria-label="Rounded corners" onClick={() => focusedElement() ? updateProperty("edgeStyle", "rounded") : setEdgeStyle("rounded")}><svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="4"/></svg></button></div></div></Show><Show when={tool() === "arrow" || focusedElement()?.type === "arrow"}><div class="arrow-head-config"><span>Start head</span><div class="choice-deck arrow-head-choices">{ARROW_HEADS.map(({ value, label }) => <button class={((focusedElement() as ShapeElement | undefined)?.startHead ?? defaultStartHead()) === value ? "active" : ""} title={`${label} start`} aria-label={`${label} start head`} onClick={() => focusedElement()?.type === "arrow" ? updateProperty("startHead", value) : setDefaultStartHead(value)}><ArrowHeadIcon kind={value} /></button>)}</div><span>End head</span><div class="choice-deck arrow-head-choices">{ARROW_HEADS.map(({ value, label }) => <button class={((focusedElement() as ShapeElement | undefined)?.endHead ?? defaultEndHead()) === value ? "active" : ""} title={`${label} end`} aria-label={`${label} end head`} onClick={() => focusedElement()?.type === "arrow" ? updateProperty("endHead", value) : setDefaultEndHead(value)}><ArrowHeadIcon kind={value} /></button>)}</div></div></Show></section></Show>
            <Show when={tool() === "bucket"}><section class="pane-section"><div class="pane-heading">Bucket fill</div><p class="bucket-help">Click a closed shape to apply a solid color.</p><div class="fill-palette">{FILL_SWATCHES.map((swatch) => <button class={`color-swatch ${fillColor() === swatch ? "active" : ""}`} style={{ background: swatch }} aria-label={`Bucket color ${swatch}`} title={`Use ${swatch}`} onClick={() => setFillColor(swatch)} />)}<label class="custom-color-swatch" title="Choose custom bucket color"><input aria-label="Custom bucket color" type="color" value={fillColor()} onInput={(event) => setFillColor(event.currentTarget.value)} /></label></div></section></Show>
            <Show when={tool() === "line" || focusedElement()?.type === "line"}><section class="pane-section"><div class="pane-heading">Line route</div><div class="connector-route-buttons">{LINE_ROUTES.map((route) => <button class={(focusedElement()?.type === "line" ? (focusedElement() as ShapeElement).lineRoute : lineRoute()) === route.value ? "active" : ""} title={route.label} aria-label={`${route.label} line`} onClick={() => focusedElement()?.type === "line" ? updateProperty("lineRoute", route.value) : setLineRoute(route.value)}><svg viewBox="0 0 24 24"><path d={route.path} /></svg><small>{route.label}</small></button>)}</div></section></Show>
<Show when={tool() === "arrow" || focusedElement()?.type === "arrow"}><section class="pane-section"><div class="pane-heading">Arrow route</div><div class="connector-route-buttons">{ARROW_ROUTES.map((route) => <button class={(focusedElement()?.type === "arrow" ? (focusedElement() as ShapeElement).arrowRoute : arrowRoute()) === route.value ? "active" : ""} title={route.label} aria-label={`${route.label} arrow`} onClick={() => focusedElement()?.type === "arrow" ? updateProperty("arrowRoute", route.value) : setArrowRoute(route.value)}><svg viewBox="0 0 24 24"><path d={route.path} /></svg><small>{route.label}</small></button>)}</div></section></Show><Show when={tool() === "rectangle" || tool() === "circle" || tool() === "diamond" || tool() === "flowchart" || focusedElement()?.type === "rectangle" || focusedElement()?.type === "circle" || focusedElement()?.type === "diamond" || focusedElement()?.type === "flowchart"}><section class="pane-section"><div class="pane-heading">Fill</div><div class="fill-options"><button class={!(selectedFillColor()) && !fillEnabled() ? "active" : ""} onClick={() => { setFillEnabled(false); if (selectedIndices().length) updateProperty("fillColor", undefined); }}>None</button><button class={fillEnabled() || !!selectedFillColor() ? "active" : ""} onClick={() => { setFillEnabled(true); if (selectedIndices().length) updateProperty("fillColor", fillColor()); }}>Solid</button></div><div class="fill-style-row"><label class="fill-color-chip" title="Fill color"><input aria-label="Fill color" type="color" value={selectedFillColor() ?? fillColor()} onInput={(event) => { const value = event.currentTarget.value; setFillColor(value); if (selectedIndices().length) updateProperty("fillColor", value); }} /></label><label class="fill-opacity-control">Opacity<input aria-label="Fill opacity" type="range" min="5" max="100" value={Math.round(((focusedElement() as ShapeElement | undefined)?.fillOpacity ?? fillOpacity()) * 100)} onInput={(event) => { const value = Number(event.currentTarget.value) / 100; setFillOpacity(value); if (selectedIndices().length) updateProperty("fillOpacity", value); }} /><span>{Math.round(((focusedElement() as ShapeElement | undefined)?.fillOpacity ?? fillOpacity()) * 100)}%</span></label></div></section></Show>
                <Show when={selectedIndices().length === 1 && !groupSelected()}><section class="pane-section"><div class="pane-heading">Precision</div><div class="precision-grid">{(["x", "y", "w", "h", "rotation"] as const).map(property => <label>{property === "rotation" ? "Angle °" : property.toUpperCase()}<input aria-label={`Selection ${property}`} type="number" step="1" disabled={boardLocked() || focusedElement()?.locked || (!!focusedElement() && isConnector(focusedElement()!) && (property === "w" || property === "h" || property === "rotation"))} value={Math.round((property === "rotation" ? focusedElement()?.rotation ?? 0 : focusedElement() ? elementBounds(focusedElement()!)[property] : 0) * 100) / 100} onChange={event => precision(property, Number(event.currentTarget.value))} /></label>)}</div>
                  <Show when={focusedElement() && isConnector(focusedElement()!)}><div class="precision-grid">{(["start", "end"] as const).flatMap(end => (["x", "y"] as const).map(axis => <label>{end} {axis.toUpperCase()}<input type="number" disabled={boardLocked() || focusedElement()?.locked} value={Math.round(((focusedElement() as ShapeElement)[axis] + (end === "end" ? (focusedElement() as ShapeElement)[axis === "x" ? "w" : "h"] : 0)) * 100) / 100} onChange={event => setEndpoint(end, axis, Number(event.currentTarget.value))} /></label>))}</div><p class="bucket-help">Drag the circular endpoints to resize or attach. Drag a small route handle to bend the connector.</p><button class="quiet-button" onClick={() => changeSelected(item => isConnector(item) ? { ...item, startBinding: undefined, endBinding: undefined } : item)}>Detach endpoints</button><button class="quiet-button" onClick={() => changeSelected(item => isConnector(item) ? { ...item, routePoints: undefined } : item)}>Reset route</button></Show>
                </section></Show>
                <Show when={selectedIndices().length > 1}><section class="pane-section"><div class="pane-heading">Align & distribute</div><div class="alignment-grid">{(["left", "center", "right", "top", "middle", "bottom", "horizontal", "vertical"] as const).map(command => <button disabled={boardLocked() || ((command === "horizontal" || command === "vertical") && selectedIndices().length < 3)} title={command === "horizontal" || command === "vertical" ? `Distribute ${command} gaps` : `Align ${command}`} onClick={() => alignSelection(command)}>{command}</button>)}</div></section></Show>
                <Show when={!!selectedIndices().length}><section class="pane-section"><div class="pane-heading">Selection</div><label class="property-label">Opacity <input disabled={selectedIndices().every((index) => !elements()[index] || elements()[index].locked)} type="range" min="10" max="100" value={Math.round(selectedOpacity() * 100)} onInput={(event) => updateProperty("opacity", Number(event.currentTarget.value) / 100)} /></label><Show when={!groupSelected() && !(focusedElement() && isConnector(focusedElement()!))}><div class="rotation-controls"><button disabled={focusedElement()?.locked} onClick={() => rotateSelection(-15)} title="Rotate counterclockwise by 15 degrees">−15°</button><button disabled={focusedElement()?.locked} onClick={resetSelectionRotation} title="Reset rotation to zero">Reset 0°</button><button disabled={focusedElement()?.locked} onClick={() => rotateSelection(15)} title="Rotate clockwise by 15 degrees">+15°</button></div></Show></section></Show>
                <Show when={selectedIndices().length > 1 && !groupSelected()}><button class="pane-group-button" onClick={groupSelection}>Group {selectedIndices().length} elements <kbd>Ctrl+G</kbd></button></Show>
              </Show>
              <Show when={sidebarTab() === "layers"}><div class="layer-list">{[...elements().keys()].reverse().map((index) => { const element = elements()[index]; const label = element.type === "text" ? `Text: ${element.text.slice(0, 18) || "Empty"}` : element.type === "group" ? `Group (${element.elements.length})` : element.type[0].toUpperCase() + element.type.slice(1); return <div class={`layer-row ${selectedSet().has(index) ? "selected" : ""}`}><button class="layer-name" onClick={() => setSelectedIndices([index])}>{label}</button><button title="Move layer up" aria-label="Move layer up" onClick={() => moveLayer(index, 1)}>↑</button><button title="Move layer down" aria-label="Move layer down" onClick={() => moveLayer(index, -1)}>↓</button><button title={element.hidden ? "Show layer" : "Hide layer"} aria-label="Toggle layer visibility" onClick={() => toggleLayer(index, "hidden")}>{element.hidden ? "Show" : "Hide"}</button><button title={element.locked ? "Unlock layer" : "Lock layer"} aria-label="Toggle layer lock" onClick={() => toggleLayer(index, "locked")}>{element.locked ? "Unlock" : "Lock"}</button></div>; })}</div></Show>
            </aside></Show>
            <Show when={textDraft()}>{draft => <div class="text-editor-frame" style={{ left: `${canvasState().panX + editorLeft(draft()) * canvasState().zoom}px`, top: `${canvasState().panY + draft().y * canvasState().zoom}px`, width: `${editorWidth(draft()) * canvasState().zoom}px`, height: draft().height ? `${draft().height! * canvasState().zoom}px` : undefined, transform: `rotate(${draft().rotation ?? 0}deg)`, "justify-content": draft().verticalAlign === "bottom" ? "flex-end" : draft().verticalAlign === "middle" ? "center" : "flex-start", "font-size": `${draft().fontSize * canvasState().zoom}px`, "font-family": draft().fontFamily === "hand" ? "cursive" : "sans-serif", "font-weight": draft().bold ? 700 : 400, "font-style": draft().italic ? "italic" : "normal", "text-decoration": draft().underline ? "underline" : "none", "text-align": draft().textAlign, color: draft().color, opacity: draft().opacity }}>
              <div ref={element => { requestAnimationFrame(() => { if (element.isConnected) { element.innerText = draft().value; element.focus(); const range = document.createRange(); range.selectNodeContents(element); range.collapse(false); const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); } }); }} class="canvas-text-editor" contentEditable={true} role="textbox" aria-label="Canvas text" aria-multiline="true" data-placeholder="Type here…" onInput={event => updateTextDraft(event.currentTarget.innerText)} onBlur={event => { const next = event.relatedTarget; if (!(next instanceof HTMLElement && next.closest(".style-pane"))) commitTextDraft(); }} onPointerDown={event => event.stopPropagation()} onPaste={event => { event.preventDefault(); const text = event.clipboardData?.getData("text/plain") ?? ""; const selection = window.getSelection(); if (selection?.rangeCount) { const range = selection.getRangeAt(0); range.deleteContents(); const node = document.createTextNode(text); range.insertNode(node); range.setStartAfter(node); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); updateTextDraft(event.currentTarget.innerText); } }} onKeyDown={event => { event.stopPropagation(); if (event.key === "Escape" || (event.key === "Enter" && (event.ctrlKey || event.metaKey))) { event.preventDefault(); commitTextDraft(); if (event.key === "Escape") { setTool("select"); setSelectedIndices([]); setHoveredIndex(undefined); } } }} />
            </div>}</Show>
            <div class="canvas-help">Wheel to zoom <span>|</span> Hold Space or select the hand tool to pan <span>|</span> V to select and drag to move</div>
          </section>
        </>
      </Show>
      <Show when={contextMenu()}>{position => <div class="canvas-context-menu" role="menu" aria-label="Canvas context menu" style={{ left: `${position().x}px`, top: `${position().y}px` }} onClick={() => setContextMenu(undefined)} onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")]; const index = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus(); } }} ref={element => requestAnimationFrame(() => element.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus())}>
        <button role="menuitem" disabled={!selectedIndices().length} onClick={() => void copySelection()}>Copy <kbd>Ctrl C</kbd></button>
        <button role="menuitem" disabled={boardLocked()} onClick={() => void pasteSelection(position().world)}>Paste here <kbd>Ctrl V</kbd></button>
        <button role="menuitem" disabled={boardLocked() || !selectedIndices().length} onClick={() => insertCopies(selectedElements())}>Duplicate <kbd>Ctrl D</kbd></button>
        <button role="menuitem" disabled={boardLocked() || !groupActionEnabled()} onClick={groupSelection}>{groupSelected() ? "Ungroup" : "Group"} <kbd>Ctrl G</kbd></button>
        <button role="menuitem" disabled={!selectedIndices().length} onClick={() => fitDocumentToViewport(selectedElements())}>Zoom to selection <kbd>2</kbd></button>
        <button role="menuitem" onClick={() => fitDocumentToViewport(elements())}>Fit drawing <kbd>1</kbd></button>
        <button role="menuitem" disabled={!selectedIndices().length} onClick={() => { setExportScope("selection"); openExportOptions("png"); }}>Export selection…</button>
        <button role="menuitem" disabled={boardLocked() || !selectedIndices().length} onClick={deleteSelected}>Delete <kbd>Del</kbd></button>
      </div>}</Show>
      <Show when={pageDialog()}><div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setPageDialog(undefined); }}><section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="page-dialog-title"><h2 id="page-dialog-title">{pageDialog() === "rename" ? "Rename page" : "Delete page?"}</h2><Show when={pageDialog() === "rename"} fallback={<p>Delete “{currentPage()?.name}” and its contents? This page deletion cannot be undone.</p>}><label>Page name<input autofocus maxlength="80" value={pageName()} onInput={event => setPageName(event.currentTarget.value)} onKeyDown={event => { if (event.key === "Enter" && pageName().trim()) confirmPageDialog(); }} /></label></Show><div><button class="quiet-button" onClick={() => setPageDialog(undefined)}>Cancel</button><button class={pageDialog() === "delete" ? "danger-button" : "save-button"} disabled={boardLocked() || (pageDialog() === "rename" && !pageName().trim())} onClick={confirmPageDialog}>{pageDialog() === "rename" ? "Rename" : "Delete page"}</button></div></section></div></Show>
      <Show when={exportOptionsOpen()}><div class="confirm-backdrop"><section class="confirm-dialog export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title"><h2 id="export-title">Export {exportFormat().toUpperCase()}</h2><p>Export the current page, its selection, or the viewport. PDF is a raster snapshot.</p><div class="export-scope">{(["drawing", "selection", "viewport"] as const).map(scope => <button class={exportScope() === scope ? "active" : ""} disabled={scope === "selection" && !selectedIndices().length} onClick={() => setExportScope(scope)}>{scope === "drawing" ? "Whole drawing" : scope === "selection" ? "Selection" : "Viewport"}</button>)}</div><label class="export-transparent"><input type="checkbox" checked={exportGrid()} onChange={event => setExportGrid(event.currentTarget.checked)} /> Include visible grid</label><div class="export-dimensions"><label>Width<input type="number" min="1" max="12000" value={exportWidth()} onInput={(event) => setExportWidth(Number(event.currentTarget.value))} /></label><span>×</span><label>Height<input type="number" min="1" max="12000" value={exportHeight()} onInput={(event) => setExportHeight(Number(event.currentTarget.value))} /></label></div><Show when={exportFormat() !== "pdf"}><label class="export-transparent"><input type="checkbox" checked={exportTransparent()} onChange={(event) => setExportTransparent(event.currentTarget.checked)} /> Transparent background</label></Show><div><button class="quiet-button" onClick={() => setExportOptionsOpen(false)}>Cancel</button><button class="save-button" onClick={() => { const format = exportFormat(); setExportOptionsOpen(false); void exportAs(format); }}>Export {exportFormat().toUpperCase()}</button></div></section></div></Show>
      <Show when={recoveryPrompt()}>{(recovery) => <div class="confirm-backdrop"><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="recovery-title"><h2 id="recovery-title">Recover unsaved work?</h2><p>SketchDraw found a local recovery copy for <strong>{recovery().path.split(/[\\/]/).pop()}</strong>. Restore it or continue with the saved file.</p><div><button class="quiet-button" onClick={discardRecovery}>Use saved file</button><button class="save-button" onClick={restoreRecovery}>Restore recovery</button></div></section></div>}</Show>
      <Show when={syncConflict()}>{(conflict) => <div class="confirm-backdrop"><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="conflict-title"><h2 id="conflict-title">File changed elsewhere</h2><p><strong>{conflict().path.split(/[\\/]/).pop()}</strong> was updated outside SketchDraw. Autosave is paused so neither version is overwritten without your choice.</p><div class="conflict-actions"><button class="quiet-button" onClick={() => void saveAs()}>Save my version as…</button><button class="quiet-button" onClick={reloadConflictingFile}>Load disk version</button><button class="danger-button" onClick={overwriteConflictingFile}>Overwrite disk version</button></div></section></div>}</Show>
      <Show when={showClearConfirm()}><div class="confirm-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setShowClearConfirm(false); }}><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="clear-title"><h2 id="clear-title">Clear this canvas?</h2><p>This will remove all {elements().length} items from the open sketch. You can undo this action.</p><div><button class="quiet-button" onClick={() => setShowClearConfirm(false)}>Cancel</button><button class="danger-button" onClick={() => { if (elements().length && !boardLocked()) { pushUndo(cloneElements(elements())); setElements([]); setSelectedIndices([]); setDirty(true); } setShowClearConfirm(false); }}>Clear canvas</button></div></section></div></Show>
      <Show when={error()}><div class="error-toast" role="alert">{error()}<button onClick={() => setError("")}>Dismiss</button></div></Show>
    </main>
  );
}

export default App;

