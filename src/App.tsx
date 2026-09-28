import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from "solid-js";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, readTextFile, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import sketchDrawMark from "../icons/sketchdraw-mark.svg";

import type { Point, StrokePoint, ArrowHead, FlowchartShape, ArrowRoute, LineRoute, StrokeStyle, LayerFlags, ShapeElement, TextElement, ImageElement, Element, GroupElement, Tool, CanvasState, SketchPage, SketchFile, Preview, Bounds, TextDraft, Theme, ThemeMode, Binding, ShapeLabel, EdgeStyle, FontFamily } from "./model";
import { ensureIds, resolveBindings, copyElements, isConnector, isLabelShape, anchorPoint, nearestBinding, validReferences, textLayout, labelBox, textFont, extraFlowchartPath } from "./operations";
import type { NoteKind } from "./model";
import { buildLibraryComponent, buildNoteGroup, checklistIndexAt, normalizeNoteContent, noteCollapseHit, EXTRA_FLOWCHART_SHAPES, LIBRARY_COMPONENTS, toggleChecklistContent, type LibraryComponentKind } from "./notes";
import { parseSchema } from "./schema";

type PdfRasterPage = { jpeg: Uint8Array; imageWidth: number; imageHeight: number; pageWidth: number; pageHeight: number; x: number; y: number; drawWidth: number; drawHeight: number; bleedPt: number; grayscale: boolean };

const fontCss = (family?: FontFamily) => family === "hand" ? "cursive" : family === "serif" ? "Georgia, serif" : family === "mono" ? "'Cascadia Mono', Consolas, monospace" : "'DM Sans', sans-serif";

const RELEASES_API = "https://api.github.com/repos/Toushal29/SketchDraw/releases/latest";

function compareReleaseVersions(left: string, right: string): number {
  const parse = (version: string) => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());
    return match ? match.slice(1, 4).map(Number) : undefined;
  };
  const a = parse(left); const b = parse(right);
  if (!a || !b) throw new Error("GitHub returned a release tag that is not a three-part version.");
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  return 0;
}

const GRID_SIZE = 24;
const stylusStrokeWidth = (point: StrokePoint, thickness: number) => thickness * (point.pressure === undefined ? 1 : .2 + Math.max(0, Math.min(1, point.pressure)) * 1.6) * (1 + Math.min(1, Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0) / 90) * .28);
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
  { value: "cloud", label: "Cloud / external service", path: "M5 17a4 4 0 0 1 1-8 6 6 0 0 1 11-1 4.5 4.5 0 0 1 1 9z" },
  { value: "star", label: "Star", path: "m12 2 3 7h7l-5.5 4.5 2 8L12 17l-6.5 4.5 2-8L2 9h7z" },
  { value: "lightning", label: "Lightning", path: "m14 2-9 12h6l-1 8 9-12h-6z" },
  { value: "heart", label: "Heart", path: "M12 21S3 15 3 8a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 7-9 13-9 13z" },
  { value: "callout", label: "Callout", path: "M3 4h18v13H12l-5 4v-4H3z" },
  { value: "gear", label: "Gear", path: "M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" },
);
const ARROW_ROUTES: { value: ArrowRoute; label: string; path: string }[] = [
  { value: "straight", label: "Straight", path: "M3 12h17m-6-6 6 6-6 6" }, { value: "elbow", label: "Elbow", path: "M4 5v14h15m-6-6 6 6-6 6" },
  { value: "forked", label: "Forked", path: "M3 12h8m0 0V5h9m-4-3 4 3-4 3m-5 4v7h9m-4-3 4 3-4 3" },
  { value: "loop", label: "Loop", path: "M4 17c0-10 16-10 16 0m-6-4 6 4-6 4" }, { value: "jagged", label: "Jagged", path: "M3 12h4l3-5 4 10 3-5h3m-4-4 4 4-4 4" },
];
const LINE_ROUTES: { value: LineRoute; label: string; path: string }[] = [
  { value: "straight", label: "Straight", path: "M4 19 20 5" }, { value: "curve", label: "Curve · 1 point", path: "M3 18Q12 2 21 18" },
  { value: "curve2", label: "Curve · 2 points", path: "M3 18C7 2 17 2 21 18" }, { value: "curve3", label: "Curve · 3 points", path: "M3 18C6 2 9 21 12 10S18 2 21 18" },
  { value: "multi", label: "Multi-point", path: "M3 18 7 6l4 12 4-12 3 9 3-6" },
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
function arrowHeadSvgPath(tip: Point, angle: number, type: ArrowHead, thickness: number): string {
  const points = arrowHeadPoints(tip, angle, type, thickness);
  if (type === "open") return `M ${tip.x} ${tip.y} L ${points[0].x} ${points[0].y} M ${tip.x} ${tip.y} L ${points[1].x} ${points[1].y}`;
  if (type === "dot") { const radius = Math.max(3, thickness * 1.15); return `M ${tip.x - radius} ${tip.y} A ${radius} ${radius} 0 1 0 ${tip.x + radius} ${tip.y} A ${radius} ${radius} 0 1 0 ${tip.x - radius} ${tip.y} Z`; }
  if (!points.length) return "";
  return `M ${points.map(point => `${point.x} ${point.y}`).join(" L ")}${["solid", "thick", "diamond"].includes(type) ? " Z" : ""}`;
}
function pointInPolygon(point: Point, points: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]; const b = points[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function themeInk(color: string, activeTheme: Theme): string {
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color);
  if (!match) return color;
  const hex = match[1].length === 3 ? [...match[1]].map((part) => part + part).join("") : match[1];
  const channels = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  const [red, green, blue] = channels;
  const isNeutral = Math.max(red, green, blue) - Math.min(red, green, blue) < 22;
  if (!isNeutral) return color;
  const luminance = red * .2126 + green * .7152 + blue * .0722;
  if (activeTheme === "dark" && luminance < 105) return "#f4f4f2";
  if (activeTheme === "light" && luminance > 235) return "#252525";
  return color;
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
function flowchartPathObject(shape: FlowchartShape, x: number, y: number, w: number, h: number) {
  const left = Math.min(x, x + w); const top = Math.min(y, y + h);
  const source = extraFlowchartPath(shape, left, top, Math.abs(w), Math.abs(h));
  return source ? new Path2D(source) : undefined;
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
function curveControlPoints(element: ShapeElement, route: LineRoute | ArrowRoute): Point[] {
  const defaults = connectorControls({ ...element, routePoints: undefined }, route === "loop");
  const count = route === "curve" ? 1 : route === "curve2" ? 2 : route === "curve3" ? 3 : route === "loop" ? 2 : 0;
  if (!count) return [];
  const fallback = route === "curve" ? [defaults.c1] : route === "curve2" || route === "loop" ? [defaults.c1, defaults.c2] : [0.25, 0.5, 0.75].map((ratio) => ({ x: defaults.start.x + defaults.dx * ratio + defaults.normal.x * Math.max(1, Math.hypot(defaults.dx, defaults.dy) * 0.3), y: defaults.start.y + defaults.dy * ratio + defaults.normal.y * Math.max(1, Math.hypot(defaults.dx, defaults.dy) * 0.3) }));
  return fallback.slice(0, count).map((point, index) => element.routePoints?.[index] ?? point);
}
function evaluateBezier(points: Point[], t: number): Point {
  const work = points.map((point) => ({ ...point }));
  for (let count = work.length - 1; count > 0; count--) for (let index = 0; index < count; index++) {
    work[index] = { x: work[index].x + (work[index + 1].x - work[index].x) * t, y: work[index].y + (work[index + 1].y - work[index].y) * t };
  }
  return work[0];
}
function forkGeometry(element: ShapeElement) {
  const { start, end, dx, dy, normal } = connectorControls(element);
  const length = Math.max(1, Math.hypot(dx, dy)); const spread = Math.max(24, Math.min(36, length * .16));
  const junction = element.routePoints?.[0] ?? { x: start.x + dx * .62, y: start.y + dy * .62 };
  const upper = element.forkUpper?.end ?? { x: end.x + normal.x * spread, y: end.y + normal.y * spread };
  const lower = element.forkLower?.end ?? { x: end.x - normal.x * spread, y: end.y - normal.y * spread };
  const upperPath = [junction, ...(element.forkUpper?.routePoints ?? []), upper];
  const lowerPath = [junction, ...(element.forkLower?.routePoints ?? []), lower];
  return { start, end, junction, upper, lower, upperPath, lowerPath, normal };
}
function jaggedVertices(element: ShapeElement): Point[] {
  const { start, end, normal } = connectorControls(element); const length = Math.hypot(element.w, element.h); const amplitude = Math.min(18, length * .13);
  return [start, ...[.2, .4, .6, .8].map((t, index) => ({ x: start.x + element.w * t + normal.x * amplitude * (index % 2 ? -1 : 1), y: start.y + element.h * t + normal.y * amplitude * (index % 2 ? -1 : 1) })), end];
}
function connectorPolylines(element: ShapeElement, route: ArrowRoute | LineRoute, sampleCount = 49): Point[][] {
  const key = `${route}:${sampleCount}`; const cache = connectorCache.get(element); const existing = cache?.get(key); if (existing) return existing;
  const points = element.routePoints?.length && !["curve", "curve2", "curve3", "loop", "forked"].includes(route) ? [[{ x: element.x, y: element.y }, ...element.routePoints, { x: element.x + element.w, y: element.y + element.h }]] : route === "forked"
    ? (() => { const fork = forkGeometry(element); return [[fork.start, fork.junction], fork.upperPath, fork.lowerPath]; })()
    : route === "jagged" ? [jaggedVertices(element)]
      : [Array.from({ length: sampleCount }, (_, index) => connectorPoint(element, route, index / (sampleCount - 1)))];
  if (cache) cache.set(key, points); else connectorCache.set(element, new Map([[key, points]]));
  return points;
}
function arrowHeadEntries(element: ShapeElement, route: ArrowRoute | LineRoute): { tip: Point; angle: number; kind: ArrowHead }[] {
  const fork = element.type === "arrow" && route === "forked" ? forkGeometry(element) : undefined;
  const entries: { tip: Point; angle: number; kind: ArrowHead }[] = [];
  if ((element.startHead ?? "none") !== "none") {
    const start = fork?.start ?? { x: element.x, y: element.y };
    const angle = fork ? Math.atan2(fork.junction.y - start.y, fork.junction.x - start.x) + Math.PI : connectorTangent(element, route, false) + Math.PI;
    entries.push({ tip: start, angle, kind: element.startHead ?? "none" });
  }
  if (fork) {
    for (const [branch, points] of [[element.forkUpper, fork.upperPath], [element.forkLower, fork.lowerPath]] as const) {
      const previous = points[points.length - 2] ?? fork.junction; const tip = points[points.length - 1];
      entries.push({ tip, angle: Math.atan2(tip.y - previous.y, tip.x - previous.x), kind: branch?.endHead ?? element.endHead ?? "open" });
    }
  } else {
    entries.push({ tip: { x: element.x + element.w, y: element.y + element.h }, angle: connectorTangent(element, route, true), kind: element.endHead ?? (element.type === "arrow" ? "open" : "none") });
  }
  return entries;
}
function connectorPoint(element: ShapeElement, route: ArrowRoute | LineRoute, t: number): Point {
  const { start, end } = connectorControls(element, route === "loop");
  if (route === "elbow") { const middle = { x: end.x, y: start.y }; return t < .5 ? { x: start.x + (middle.x - start.x) * t * 2, y: start.y } : { x: middle.x, y: middle.y + (end.y - middle.y) * (t - .5) * 2 }; }
  if (route === "jagged") { const points = jaggedVertices(element); const scaled = t * (points.length - 1); const segment = Math.min(points.length - 2, Math.floor(scaled)); const local = scaled - segment; return { x: points[segment].x + (points[segment + 1].x - points[segment].x) * local, y: points[segment].y + (points[segment + 1].y - points[segment].y) * local }; }
  if (route === "curve" || route === "curve2" || route === "curve3" || route === "loop") return evaluateBezier([start, ...curveControlPoints(element, route), end], t);
  return { x: start.x + element.w * t, y: start.y + element.h * t };
}
function connectorTangent(element: ShapeElement, route: ArrowRoute | LineRoute, atEnd: boolean): number {
  if (element.routePoints?.length && !["curve", "curve2", "curve3", "loop", "forked"].includes(route)) { const a = atEnd ? element.routePoints[element.routePoints.length - 1] : { x: element.x, y: element.y }; const b = atEnd ? { x: element.x + element.w, y: element.y + element.h } : element.routePoints[0]; return Math.atan2(b.y - a.y, b.x - a.x); }
  if (route === "curve" || route === "curve2" || route === "curve3" || route === "loop") {
    const controls = curveControlPoints(element, route); const a = atEnd ? controls[controls.length - 1] : { x: element.x, y: element.y }; const b = atEnd ? { x: element.x + element.w, y: element.y + element.h } : controls[0];
    return Math.atan2(b.y - a.y, b.x - a.x);
  }
  if (route === "straight" || route === "forked") return Math.atan2(element.h, element.w);
  if (route === "elbow") return atEnd ? Math.PI / 2 * Math.sign(element.h || 1) : element.w < 0 ? Math.PI : 0;
  const before = connectorPoint(element, route, atEnd ? .99 : .01); const after = connectorPoint(element, route, atEnd ? 1 : .02);
  return Math.atan2(after.y - before.y, after.x - before.x);
}
function traceConnector(ctx: CanvasRenderingContext2D, element: ShapeElement) {
  const route: ArrowRoute | LineRoute = element.type === "arrow" ? element.arrowRoute ?? "straight" : element.lineRoute ?? "straight";
  const { start, end, c1, c2 } = connectorControls(element, route === "loop");
  ctx.beginPath(); ctx.moveTo(start.x, start.y);
  if (element.routePoints?.length && !["curve", "curve2", "curve3", "loop", "forked"].includes(route)) { for (const point of element.routePoints) ctx.lineTo(point.x, point.y); ctx.lineTo(end.x, end.y); return; }
  if (route === "curve") ctx.quadraticCurveTo(c1.x, c1.y, end.x, end.y);
  else if (route === "curve2") { const [first, second] = curveControlPoints(element, route); ctx.bezierCurveTo(first.x, first.y, second.x, second.y, end.x, end.y); }
  else if (route === "curve3") { for (let index = 1; index <= 64; index++) { const point = connectorPoint(element, route, index / 64); ctx.lineTo(point.x, point.y); } }
  else if (route === "loop") ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
  else if (route === "elbow") { ctx.lineTo(end.x, start.y); ctx.lineTo(end.x, end.y); }
  else if (route === "jagged") { for (const point of jaggedVertices(element).slice(1)) ctx.lineTo(point.x, point.y); }
  else if (route === "forked") { const fork = forkGeometry(element); ctx.lineTo(fork.junction.x, fork.junction.y); for (const branch of [fork.upperPath, fork.lowerPath]) { ctx.moveTo(branch[0].x, branch[0].y); for (const point of branch.slice(1)) ctx.lineTo(point.x, point.y); } }
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
function vectorFlowchartPath(element: ShapeElement): string {
  const x=element.x,y=element.y,w=element.w,h=element.h; const left=Math.min(x,x+w),top=Math.min(y,y+h),width=Math.abs(w),height=Math.abs(h),right=left+width,bottom=top+height,middle=left+width/2;
  if(element.flowchartShape==="terminator"){const r=Math.min(width/2,height/2);return `M ${left+r} ${top} H ${right-r} Q ${right} ${top} ${right} ${top+r} V ${bottom-r} Q ${right} ${bottom} ${right-r} ${bottom} H ${left+r} Q ${left} ${bottom} ${left} ${bottom-r} V ${top+r} Q ${left} ${top} ${left+r} ${top} Z`;}
  if(element.flowchartShape==="connector"){const rx=width/2,ry=height/2,k=.55228475;return `M ${middle+rx} ${top+ry} C ${middle+rx} ${top+ry+k*ry} ${middle+k*rx} ${top+height} ${middle} ${top+height} C ${middle-k*rx} ${top+height} ${left} ${top+ry+k*ry} ${left} ${top+ry} C ${left} ${top+ry-k*ry} ${middle-k*rx} ${top} ${middle} ${top} C ${middle+k*rx} ${top} ${right} ${top+ry-k*ry} ${right} ${top+ry} Z`;}
  return flowchartSvgPath(element);
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

function indentTextarea(event: KeyboardEvent, setValue: (value: string) => void) {
  const textarea = event.currentTarget as HTMLTextAreaElement;
  if (!(textarea instanceof HTMLTextAreaElement)) return;
  event.preventDefault();
  const value = textarea.value; const start = textarea.selectionStart; const end = textarea.selectionEnd;
  const unit = "  ";
  if (start === end) {
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    let next = value; let caret = start;
    if (event.shiftKey) {
      const lineEndAt = value.indexOf("\n", start); const lineEnd = lineEndAt < 0 ? value.length : lineEndAt;
      const line = value.slice(lineStart, lineEnd); const match = /^(\t| {1,2})/.exec(line); const remove = match?.[0].length ?? 0;
      if (remove) { next = value.slice(0, lineStart) + line.slice(remove) + value.slice(lineEnd); caret -= Math.min(remove, Math.max(0, start - lineStart)); }
    } else { next = value.slice(0, start) + unit + value.slice(end); caret += unit.length; }
    setValue(next);
    requestAnimationFrame(() => { if (textarea.isConnected) textarea.setSelectionRange(caret, caret); });
    return;
  }
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const blockEnd = end > lineStart && value[end - 1] === "\n" ? end - 1 : (value.indexOf("\n", end) < 0 ? value.length : value.indexOf("\n", end));
  const lines = value.slice(lineStart, blockEnd).split("\n"); let firstDelta = 0; let totalDelta = 0;
  const changed = lines.map((line, index) => {
    if (event.shiftKey) {
      const match = /^(\t| {1,2})/.exec(line); const next = match ? line.slice(match[0].length) : line; const delta = line.length - next.length;
      if (index === 0) firstDelta = -delta; totalDelta -= delta; return next;
    }
    if (index === 0) firstDelta = unit.length; totalDelta += unit.length; return unit + line;
  }).join("\n");
  const next = value.slice(0, lineStart) + changed + value.slice(blockEnd);
  setValue(next);
  requestAnimationFrame(() => { if (textarea.isConnected) textarea.setSelectionRange(Math.max(lineStart, start + firstDelta), Math.max(lineStart, end + totalDelta)); });
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
    const note = isRecord(value.note) && ["note", "sticky", "checklist"].includes(String(value.note.kind)) && typeof value.note.content === "string" && value.note.content.length <= 50000
      && (value.note.width === undefined || finite(value.note.width) && value.note.width >= 180 && value.note.width <= 4000)
      && (value.note.height === undefined || finite(value.note.height) && value.note.height >= 100 && value.note.height <= 1_000_000)
      && (value.note.fontSize === undefined || finite(value.note.fontSize) && value.note.fontSize >= 8 && value.note.fontSize <= 32)
      && (value.note.collapsed === undefined || typeof value.note.collapsed === "boolean")
      ? { kind: value.note.kind as NoteKind, content: value.note.content, ...(finite(value.note.width) ? { width: value.note.width } : {}), ...(finite(value.note.height) ? { height: value.note.height } : {}), ...(finite(value.note.fontSize) ? { fontSize: Math.round(value.note.fontSize) } : {}), ...(typeof value.note.collapsed === "boolean" ? { collapsed: value.note.collapsed } : {}) } : undefined;
    if (value.note !== undefined && !note) return undefined;
    return { type: "group", ...flags, elements: children as Element[], note };
  }
  if (value.type === "freehand") {
    if (!Array.isArray(value.points) || !value.points.every((point) => isRecord(point) && finite(point.x) && finite(point.y)) || !isColor(value.color) || !finite(value.thickness) || value.thickness <= 0) return undefined;
    const points: StrokePoint[] = value.points.map((point) => ({ x: (point as Record<string, unknown>).x as number, y: (point as Record<string, unknown>).y as number, ...(finite((point as Record<string, unknown>).pressure) ? { pressure: Math.max(0, Math.min(1, (point as Record<string, unknown>).pressure as number)) } : {}), ...(finite((point as Record<string, unknown>).tiltX) ? { tiltX: Math.max(-90, Math.min(90, (point as Record<string, unknown>).tiltX as number)) } : {}), ...(finite((point as Record<string, unknown>).tiltY) ? { tiltY: Math.max(-90, Math.min(90, (point as Record<string, unknown>).tiltY as number)) } : {}) }));
    return { type: "freehand", ...flags, points, color: value.color, thickness: value.thickness, opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1 };
  }
  if (value.type === "text") {
    if (!finite(value.x) || !finite(value.y) || typeof value.text !== "string" || !isColor(value.color) || !finite(value.fontSize) || value.fontSize < 8) return undefined;
    const fontFamily: FontFamily = ["hand", "serif", "mono"].includes(String(value.fontFamily)) ? value.fontFamily as FontFamily : "sans";
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
  if (["rectangle", "circle", "diamond", "triangle", "flowchart", "line", "arrow"].includes(value.type)) {
    if (!finite(value.x) || !finite(value.y) || !finite(value.w) || !finite(value.h) || !isColor(value.color) || !finite(value.thickness) || value.thickness <= 0) return undefined;
    const lineStyle: StrokeStyle = ["dashed", "dotted", "double"].includes(String(value.lineStyle)) ? value.lineStyle as StrokeStyle : "solid";
    const edgeStyle: EdgeStyle = ["rounded", "pill", "cut"].includes(String(value.edgeStyle)) ? value.edgeStyle as EdgeStyle : "sharp";
    const fillColor = isColor(value.fillColor) ? value.fillColor : undefined;
    const fillOpacity = finite(value.fillOpacity) ? Math.max(0, Math.min(1, value.fillOpacity)) : 0.2;
    const validHead = (head: unknown): head is ArrowHead => ["none", "open", "solid", "thick", "dot", "diamond", "bar"].includes(String(head));
    const flowchartShape: FlowchartShape = FLOWCHART_SHAPES.some(shape => shape.value === value.flowchartShape) ? value.flowchartShape as FlowchartShape : "process";
    const lineRoute: LineRoute = ["curve", "curve2", "curve3", "multi"].includes(String(value.lineRoute)) ? value.lineRoute as LineRoute : "straight";
    const cornerRadius = finite(value.cornerRadius) ? Math.max(0, Math.min(100, value.cornerRadius)) : undefined;
    const arrowRoute: ArrowRoute = ["elbow", "forked", "loop", "jagged"].includes(String(value.arrowRoute)) ? value.arrowRoute as ArrowRoute : "straight";
    const binding = (raw: unknown): Binding | undefined => isRecord(raw) && typeof raw.elementId === "string" && isRecord(raw.anchor) && finite(raw.anchor.x) && finite(raw.anchor.y) && raw.anchor.x >= 0 && raw.anchor.x <= 1 && raw.anchor.y >= 0 && raw.anchor.y <= 1 ? { elementId: raw.elementId, anchor: { x: raw.anchor.x, y: raw.anchor.y } } : undefined;
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
    const labelText = value.label === undefined ? undefined : normalizeElement({ ...(isRecord(value.label) ? value.label : {}), type: "text", id: "label", x: 0, y: 0 });
    if (value.label !== undefined && labelText?.type !== "text") return undefined;
    const label: ShapeLabel | undefined = labelText?.type === "text" ? { ...labelText, verticalAlign: isRecord(value.label) && (value.label.verticalAlign === "top" || value.label.verticalAlign === "bottom") ? value.label.verticalAlign : "middle" } : undefined;
    const storedRoutePoints = value.routePoints as Point[] | undefined;
    const x = value.x as number; const y = value.y as number; const w = value.w as number; const h = value.h as number;
    const controlBase: ShapeElement = { type: "line", x, y, w, h, color: value.color as string, thickness: value.thickness as number, lineRoute };
    const normalizedRoutePoints = value.type !== "line" ? storedRoutePoints
      : lineRoute === "multi" ? [0.2, 0.4, 0.6, 0.8].map((ratio, index) => storedRoutePoints?.[index] ?? { x: x + w * ratio, y: y + h * ratio })
      : ["curve", "curve2", "curve3"].includes(lineRoute) ? curveControlPoints(controlBase, lineRoute).map((point, index) => storedRoutePoints?.[index] ?? point)
      : storedRoutePoints;
    return { type: value.type as ShapeElement["type"], ...flags, startBinding: binding(value.startBinding), endBinding: binding(value.endBinding), routePoints: normalizedRoutePoints, forkUpper: forkUpper ?? undefined, forkLower: forkLower ?? undefined, label, x: value.x, y: value.y, w: value.w, h: value.h, color: value.color, thickness: value.thickness, fillColor, fillOpacity, lineStyle, edgeStyle, cornerRadius, flowchartShape: value.type === "flowchart" ? flowchartShape : undefined, lineRoute: value.type === "line" ? lineRoute : undefined, arrowRoute: value.type === "arrow" ? arrowRoute : undefined, startHead: value.type === "arrow" || value.type === "line" ? validHead(value.startHead) ? value.startHead : "none" : undefined, endHead: value.type === "arrow" || value.type === "line" ? validHead(value.endHead) ? value.endHead : value.type === "arrow" ? "open" : "none" : undefined, opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1 };
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
  if (value.version !== 6 || !Array.isArray(value.pages) || value.pages.length < 1 || value.pages.length > 100) return undefined;
  const pages = value.pages.map((page, index) => isRecord(page) ? normalizePage(page.id, page.name ?? `Page ${index + 1}`, page.canvasState, page.elements) : undefined);
  if (pages.some((page) => !page)) return undefined;
  const normalized = pages as SketchPage[];
  if (new Set(normalized.map((page) => page.id)).size !== normalized.length) return undefined;
  const activePageId = normalized.some((page) => page.id === value.activePageId) ? String(value.activePageId) : normalized[0].id;
  return { format: "SketchDraw", version: 6, activePageId, pages: normalized };
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
    if (textMeasureContext) textMeasureContext.font = `${element.italic ? "italic " : ""}${element.bold ? "700 " : "400 "}${element.fontSize}px ${fontCss(element.fontFamily)}`;
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
    for (const head of arrowHeadEntries(element, route)) {
      points.push(...arrowHeadPoints(head.tip, head.angle, head.kind, element.thickness));
      if (head.kind === "dot") { const radius = Math.max(3, element.thickness * 1.15); points.push({ x: head.tip.x - radius, y: head.tip.y - radius }, { x: head.tip.x + radius, y: head.tip.y + radius }); }
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
  const [penPressure, setPenPressure] = createSignal(true);
  const [penTilt, setPenTilt] = createSignal(true);
  const [penEraser, setPenEraser] = createSignal(true);
  const [dirty, setDirty] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [savedAt, setSavedAt] = createSignal("");
  const [error, setError] = createSignal("");
  const [preview, setPreview] = createSignal<Preview>();
  const [selectedIndices, setSelectedIndices] = createSignal<number[]>([]);
  const [hoveredIndex, setHoveredIndex] = createSignal<number>();
  const [noteToggleHovered, setNoteToggleHovered] = createSignal(false);
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
  const [edgeStyle, setEdgeStyle] = createSignal<EdgeStyle>("sharp");
  const [cornerRadius, setCornerRadius] = createSignal(14);
  const [defaultStartHead, setDefaultStartHead] = createSignal<ArrowHead>("none");
  const [defaultEndHead, setDefaultEndHead] = createSignal<ArrowHead>("open");
  const [defaultLineStartHead, setDefaultLineStartHead] = createSignal<ArrowHead>("none");
  const [defaultLineEndHead, setDefaultLineEndHead] = createSignal<ArrowHead>("none");
  const [defaultForkUpperHead, setDefaultForkUpperHead] = createSignal<ArrowHead>("open");
  const [defaultForkLowerHead, setDefaultForkLowerHead] = createSignal<ArrowHead>("open");
  const [boardColor, setBoardColor] = createSignal("#ffffff");
  const [boardColorFollowsTheme, setBoardColorFollowsTheme] = createSignal(true);
  const [boardLocked, setBoardLocked] = createSignal(false);
  const [sidebarTab, setSidebarTab] = createSignal<"properties" | "layers">("properties");
  const [styleMenuMode, setStyleMenuMode] = createSignal<"quick" | "full">("quick");
  const [quickStylePopover, setQuickStylePopover] = createSignal<"color" | "thickness" | "fill" | "route" | "lineStyle" | "heads" | "penInput">();
  const [helpOpen, setHelpOpen] = createSignal(false);
  const [updateCheck, setUpdateCheck] = createSignal<"idle" | "checking" | "current" | "available" | "error">("idle");
  const [updateVersion, setUpdateVersion] = createSignal<string>();
  const [helpSection, setHelpSection] = createSignal<"guide" | "shortcuts">("guide");
  const [defaultFontSize, setDefaultFontSize] = createSignal(16);
  const [defaultFontFamily, setDefaultFontFamily] = createSignal<FontFamily>("sans");
  const [defaultBold, setDefaultBold] = createSignal(false);
  const [defaultItalic, setDefaultItalic] = createSignal(false);
  const [defaultUnderline, setDefaultUnderline] = createSignal(false);
  const [defaultTextAlign, setDefaultTextAlign] = createSignal<"left" | "center" | "right">("left");
  const [defaultListType, setDefaultListType] = createSignal<"none" | "bullet" | "number">("none");
  const [showAdvancedThickness, setShowAdvancedThickness] = createSignal(false);
  const [toolBarOpen, setToolBarOpen] = createSignal(true);
  const [showClearConfirm, setShowClearConfirm] = createSignal(false);
  const [recoveryPrompt, setRecoveryPrompt] = createSignal<{ path: string; snapshot: SketchFile; baselineRaw?: string }>();
  const [syncConflict, setSyncConflict] = createSignal<{ path: string; remote: string }>();
  const [exportOptionsOpen, setExportOptionsOpen] = createSignal(false);
  const [canvasOptionsOpen, setCanvasOptionsOpen] = createSignal(false);
  const [exportFormat, setExportFormat] = createSignal<"png" | "svg" | "pdf">("png");
  const [exportWidth, setExportWidth] = createSignal(1600);
  const [exportHeight, setExportHeight] = createSignal(1000);
  const [exportTransparent, setExportTransparent] = createSignal(false);
  const [textDraft, setTextDraft] = createSignal<TextDraft>();
  const [textMode, setTextMode] = createSignal<"text" | NoteKind>("text");
  const [noteEditor, setNoteEditor] = createSignal<{ x: number; y: number; width: number; height: number; fontSize: number; kind: NoteKind; content: string; editingIndex?: number }>();
  const [noteEditorSession, setNoteEditorSession] = createSignal(0);
  let noteEditorTextarea: HTMLTextAreaElement | undefined;
  let resizingNoteEditor = false;
  const [schemaDialog, setSchemaDialog] = createSignal(false);
  const [schemaInput, setSchemaInput] = createSignal("");
  const [schemaError, setSchemaError] = createSignal("");
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
    try { const value: unknown = JSON.parse(localStorage.getItem("sketchdraw-v6-recent-files") ?? "[]"); return Array.isArray(value) ? value.filter((path): path is string => typeof path === "string" && path.toLowerCase().endsWith(".sketch")).slice(0, 8) : []; }
    catch { return []; }
  })());
  createEffect(() => {
    selectedIndices();
    tool();
    setStyleMenuMode("quick");
    setQuickStylePopover(undefined);
  });
  const [marquee, setMarquee] = createSignal<{ start: Point; end: Point }>();
  const [laserTrail, setLaserTrail] = createSignal<{ points: Point[]; opacity: number }>();
  let undoStack: Element[][] = [];
  let redoStack: Element[][] = [];
  let canvas!: HTMLCanvasElement;
  let exportPreviewCanvas!: HTMLCanvasElement;
  let exportPreviewVersion = 0;
  let canvasWrap!: HTMLElement;
  let menu!: HTMLDetailsElement;
  let viewMenu!: HTMLDetailsElement;
  let helpMenu!: HTMLDetailsElement;
  let drawing = false;
  let activeDrawingTool: Preview["type"] = "pen";
  let currentPoints: StrokePoint[] = [];
  let penEraserDrawing = false;
  let laserTimer: number | undefined;
  let saveInFlight = false;
  let lastSavedRaw: string | undefined;
  let panOrigin: { x: number; y: number; panX: number; panY: number } | undefined;
  let moveOrigin: { indices: number[]; point: Point; before: Element[]; moved: boolean } | undefined;
  let marqueeOrigin: { point: Point; additive: boolean; moved: boolean; cropIndex?: number } | undefined;
  let resizeOrigin: { index: number; handle: string; start: Point; original: Element; before: Element[]; moved: boolean } | undefined;
  const [nativeBusy, setNativeBusy] = createSignal(false);
  const [documentBusy, setDocumentBusy] = createSignal(false);
  const [openToolOptions, setOpenToolOptions] = createSignal<Tool>();
  const [stencilMenuOpen, setStencilMenuOpen] = createSignal(false);
  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number; world: Point }>();
  const [pageDialog, setPageDialog] = createSignal<"rename" | "delete">();
  const [pageName, setPageName] = createSignal("");
  const [exportScope, setExportScope] = createSignal<"drawing" | "selection" | "viewport">("drawing");
  const [exportGrid, setExportGrid] = createSignal(false);
  const [pdfPaper, setPdfPaper] = createSignal<"a4" | "letter" | "a3" | "legal" | "tabloid" | "custom">("a4");
  const [pdfPageSet, setPdfPageSet] = createSignal<"current" | "all" | "range">("current");
  const [pdfRangeStart, setPdfRangeStart] = createSignal(1);
  const [pdfRangeEnd, setPdfRangeEnd] = createSignal(1);
  const [pdfOrientation, setPdfOrientation] = createSignal<"portrait" | "landscape">("landscape");
  const [pdfLayout, setPdfLayout] = createSignal<"fit" | "tiled">("fit");
  const [pdfDpi, setPdfDpi] = createSignal<150 | 300>(150);
  const [pdfMarginMm, setPdfMarginMm] = createSignal(10);
  const [pdfOverlapMm, setPdfOverlapMm] = createSignal(5);
  const [pdfCustomWidthMm, setPdfCustomWidthMm] = createSignal(210);
  const [pdfCustomHeightMm, setPdfCustomHeightMm] = createSignal(297);
  const [pdfPreviewPage, setPdfPreviewPage] = createSignal(1);
  const [pdfColorMode, setPdfColorMode] = createSignal<"rgb" | "cmyk" | "grayscale">("rgb");
  const [pdfBleedMm, setPdfBleedMm] = createSignal(0);
  const [pdfCropMarks, setPdfCropMarks] = createSignal(false);
  const [pdfHeader, setPdfHeader] = createSignal("");
  const [pdfFooter, setPdfFooter] = createSignal("");
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
  function clipboardPayload() { return JSON.stringify({ format: "SketchDrawClipboard", version: 6, elements: copyElements(selectedElements(), 0, 0) }); }
  function pastePayload(raw: string, at?: Point) {
    if (!activePath() || boardLocked()) return;
    try {
      const payload: unknown = JSON.parse(raw);
      if (!isRecord(payload) || payload.format !== "SketchDrawClipboard" || payload.version !== 6 || !Array.isArray(payload.elements)) throw new Error("Copy objects from this version of SketchDraw first.");
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
    if (item.type === "arrow" && route === "forked") {
      const fork = forkGeometry(item);
      return [
        { id: "start", x: item.x, y: item.y },
        { id: "end", x: item.x + item.w, y: item.y + item.h },
        { id: "route:0", x: fork.junction.x, y: fork.junction.y },
        ...(item.forkUpper?.routePoints ?? []).map((point, index) => ({ ...point, id: `fork:upper:route:${index}` })),
        { id: "fork:upper:end", x: fork.upper.x, y: fork.upper.y },
        ...(item.forkLower?.routePoints ?? []).map((point, index) => ({ ...point, id: `fork:lower:route:${index}` })),
        { id: "fork:lower:end", x: fork.lower.x, y: fork.lower.y },
      ];
    }
    const points = item.routePoints?.length ? item.routePoints : route === "multi" ? [0.2, 0.4, 0.6, 0.8].map((ratio) => ({ x: item.x + item.w * ratio, y: item.y + item.h * ratio })) : route === "straight" ? [{ x: item.x + item.w / 2, y: item.y + item.h / 2 }] : route === "elbow" ? [{ x: item.x + item.w, y: item.y }] : route === "jagged" ? jaggedVertices(item).slice(1, -1) : route === "curve" || route === "curve2" || route === "curve3" || route === "loop" ? curveControlPoints(item, route) : [forkGeometry(item).junction];
    return [{ id: "start", x: item.x, y: item.y }, { id: "end", x: item.x + item.w, y: item.y + item.h }, ...points.map((point, index) => ({ ...point, id: `route:${index}` }))];
  }
  function resizeConnector(item: ShapeElement, handle: string, point: Point): ShapeElement {
    const port = nearestBinding(elements(), point, 18 / canvasState().zoom); setAttachmentHint(port?.point);
    const target = port?.point ?? snap(point);
    if (handle === "start") return { ...item, x: target.x, y: target.y, w: item.x + item.w - target.x, h: item.y + item.h - target.y, startBinding: port?.binding, rotation: 0 };
    if (handle === "end") return { ...item, w: target.x - item.x, h: target.y - item.y, endBinding: port?.binding, rotation: 0 };
    const branchMatch = /^fork:(upper|lower):(end|route)(?::(\d+))?$/.exec(handle);
    if (branchMatch) {
      const name = branchMatch[1] as "upper" | "lower"; const branchKey = name === "upper" ? "forkUpper" : "forkLower";
      const branch = { ...(item[branchKey] ?? {}) };
      if (branchMatch[2] === "end") return { ...item, [branchKey]: { ...branch, end: target, endBinding: port?.binding } };
      const points = [...(branch.routePoints ?? [])]; points[Number(branchMatch[3])] = snap(point);
      return { ...item, [branchKey]: { ...branch, routePoints: points } };
    }
    if (item.type === "arrow" && item.arrowRoute === "forked" && handle === "route:0") return { ...item, routePoints: [snap(point)] };
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
  function setForkEndpoint(branchName: "upper" | "lower", axis: "x" | "y", value: number) {
    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000) return;
    changeSelected(item => {
      if (item.type !== "arrow" || item.arrowRoute !== "forked") return item;
      const geometry = forkGeometry(item); const current = branchName === "upper" ? geometry.upper : geometry.lower;
      const end = { ...current, [axis]: value };
      const key = branchName === "upper" ? "forkUpper" : "forkLower";
      return { ...item, [key]: { ...(item[key] ?? {}), end, endBinding: undefined } };
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
    ctx.save(); ctx.font = textFont(label); ctx.fillStyle = themeInk(label.color, theme()); ctx.globalAlpha = (shape.opacity ?? 1) * (label.opacity ?? 1); ctx.textBaseline = "top"; ctx.textAlign = "left";
    const box = labelBox(shape); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
    for (const run of textLayout(ctx, shape)) { ctx.fillText(run.text, run.x, run.y); if (label.underline) ctx.fillRect(run.x, run.y + label.fontSize * 1.06, ctx.measureText(run.text).width, Math.max(1, label.fontSize / 18)); }
    ctx.restore();
  }
  function labelSvg(shape: ShapeElement) {
    const label = shape.label; const ctx = canvas.getContext("2d"); if (!label?.text || !ctx) return "";
    return `<g fill="${escapeXml(themeInk(label.color, theme()))}" opacity="${(shape.opacity ?? 1) * (label.opacity ?? 1)}" font-size="${label.fontSize}" font-family="${label.fontFamily === "hand" ? "cursive" : "sans-serif"}" font-weight="${label.bold ? 700 : 400}" font-style="${label.italic ? "italic" : "normal"}" text-decoration="${label.underline ? "underline" : "none"}">${textLayout(ctx, shape).map(run => `<text x="${run.x}" y="${run.y + label.fontSize * .8}">${escapeXml(run.text)}</text>`).join("")}</g>`;
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
  const styleTargetElement = () => { const focused = focusedElement(); return tool() === "select" || focused?.type === tool() ? focused : undefined; };
  const hasStyleSelection = () => !!styleTargetElement() && selectedIndices().length > 0;
  const selectedColor = () => { const draft = textDraft(); if (draft) return draft.color; const element = styleTargetElement(); return element && "color" in element ? element.color : color(); };
  const selectedThickness = () => { const element = styleTargetElement(); return element && "thickness" in element ? element.thickness : thickness(); };
  const selectedOpacity = () => { const element = focusedElement(); return element && "opacity" in element ? element.opacity ?? 1 : 1; };
  const selectedFillColor = () => { const element = styleTargetElement(); return element && "fillColor" in element ? element.fillColor : undefined; };
  const sidebarVisible = () => !!activePath();
  const showStrokeControls = () => { const focused = focusedElement(); return tool() !== "bucket" && (
    tool() === "pen" || tool() === "rectangle" || tool() === "circle" || tool() === "diamond" || tool() === "triangle" || tool() === "flowchart" || tool() === "line" || tool() === "arrow" || tool() === "text" ||
    (tool() === "select" && !!focused && "color" in focused)
  ); };
  const showThicknessControls = () => { const focused = focusedElement(); return tool() !== "bucket" && tool() !== "text" && (
    tool() === "pen" || tool() === "rectangle" || tool() === "circle" || tool() === "diamond" || tool() === "triangle" || tool() === "flowchart" || tool() === "line" || tool() === "arrow" || tool() === "eraser" ||
    (tool() === "select" && !!focused && "thickness" in focused)
  ); };
  const quickElementType = () => tool() === "select" ? focusedElement()?.type ?? "select" : tool();
  const quickHasShapeFill = () => ["rectangle", "circle", "diamond", "triangle", "flowchart"].includes(quickElementType());
  const quickHasText = () => quickElementType() === "text" || !!(styleTargetElement() && isLabelShape(styleTargetElement()!));
  const quickIsConnector = () => quickElementType() === "line" || quickElementType() === "arrow";
  const quickRouteChoices = () => quickElementType() === "arrow" ? ARROW_ROUTES : LINE_ROUTES;
  const quickCurrentRoute = () => { const focused = styleTargetElement(); if (quickElementType() === "arrow") return focused?.type === "arrow" ? focused.arrowRoute ?? "straight" : arrowRoute(); return focused?.type === "line" ? focused.lineRoute ?? "straight" : lineRoute(); };
  const quickCurrentLineStyle = () => { const focused = styleTargetElement(); return focused && "lineStyle" in focused ? focused.lineStyle ?? "solid" : lineStyle(); };
  const quickFocusedHasLineStyle = () => { const focused = styleTargetElement(); return !!focused && "lineStyle" in focused; };
  const quickArrowHead = (end: "start" | "end") => { const focused = styleTargetElement(); if (focused && isConnector(focused)) return (end === "start" ? focused.startHead : focused.endHead) ?? (focused.type === "arrow" && end === "end" ? "open" : "none"); if (tool() === "line") return end === "start" ? defaultLineStartHead() : defaultLineEndHead(); return end === "start" ? defaultStartHead() : defaultEndHead(); };
  const renderedBoardColor = () => boardColorFollowsTheme() ? theme() === "dark" ? "#17191f" : "#ffffff" : boardColor();
  const updateStrokeColor = (value: string) => { const selected = styleTargetElement(); if (boardLocked() || selected?.locked) return; if (textDraft()?.shapeLabel) { updateLabel("color", value); return; } setColor(value); setTextDraft((draft) => draft ? { ...draft, color: value } : undefined); if (hasStyleSelection()) updateProperty("color", value); };
  const updateThickness = (value: number) => { setThickness(value); if (hasStyleSelection()) updateProperty("thickness", value); };
  const status = () => !activePath() ? "No file selected" : saving() ? "Saving…" : (dirty() || textDraft()) ? "Unsaved changes" : savedAt() ? `Saved ${savedAt()}` : "Saved locally";
  function documentSnapshot(): SketchFile {
    const sourcePages = pages().length ? pages() : [{ id: "page-1", name: "Page 1", canvasState: canvasState(), elements: elements() }];
    const serializedPages = sourcePages.map((page) => {
      const isCurrent = page.id === activePageId() || (!activePageId() && sourcePages.length === 1);
      const pageElements = isCurrent ? elements() : page.elements;
      const normalized = pageElements.map(normalizeElement);
      if (normalized.some((element) => !element)) throw new Error("The drawing contains an element that cannot be saved in SketchDraw format v6.");
      const state = isCurrent ? canvasState() : page.canvasState;
      return { id: page.id, name: page.name, canvasState: { ...state, backgroundColor: isCurrent ? renderedBoardColor() : (state.boardColorFollowsTheme ? (theme() === "dark" ? "#17191f" : "#ffffff") : state.backgroundColor), boardColorFollowsTheme: state.boardColorFollowsTheme ?? true }, elements: normalized as Element[] };
    });
    return { format: "SketchDraw", version: 6, activePageId: activePageId() || serializedPages[0].id, pages: serializedPages };
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
  const strokePointFromPointer = (event: PointerEvent, point: Point): StrokePoint => event.pointerType !== "pen" ? point : {
    ...point,
    ...(penPressure() ? { pressure: Math.max(0, Math.min(1, event.pressure)) } : {}),
    ...(penTilt() ? { tiltX: Math.max(-90, Math.min(90, event.tiltX)), tiltY: Math.max(-90, Math.min(90, event.tiltY)) } : {}),
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

  function updateProperty(property: "color" | "thickness" | "opacity" | "fontSize" | "fontFamily" | "fillColor" | "fillOpacity" | "bold" | "italic" | "underline" | "textAlign" | "listType" | "lineStyle" | "lineRoute" | "arrowRoute" | "flowchartShape" | "edgeStyle" | "cornerRadius" | "startHead" | "endHead" | "forkUpperHead" | "forkLowerHead", value: string | number | boolean | undefined) {
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
      if (element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "triangle" || element.type === "flowchart") {
        if (property === "fillColor") return { ...element, fillColor: value ? String(value) : undefined };
        if (property === "fillOpacity") return { ...element, fillOpacity: Number(value) };
        if (property === "lineStyle") return { ...element, lineStyle: value as ShapeElement["lineStyle"] };
        if (property === "edgeStyle") return { ...element, edgeStyle: value as ShapeElement["edgeStyle"] };
        if (property === "cornerRadius") return { ...element, cornerRadius: Math.max(0, Math.min(100, Number(value))) };
      }
      if ((element.type === "line" || element.type === "arrow") && property === "lineStyle") return { ...element, lineStyle: value as ShapeElement["lineStyle"] };
      if (element.type === "line" && property === "lineRoute") {
        const route = value as LineRoute;
        const base = { ...element, routePoints: undefined };
        const points = route === "multi" ? [0.2, 0.4, 0.6, 0.8].map((ratio) => ({ x: element.x + element.w * ratio, y: element.y + element.h * ratio })) : ["curve", "curve2", "curve3"].includes(route) ? curveControlPoints(base, route) : undefined;
        return { ...element, lineRoute: route, routePoints: points };
      }
      if (element.type === "arrow" && property === "arrowRoute") return { ...element, arrowRoute: value as ArrowRoute, routePoints: undefined };
      if (element.type === "arrow" && property === "forkUpperHead") return { ...element, forkUpper: { ...(element.forkUpper ?? {}), endHead: value as ArrowHead } };
      if (element.type === "arrow" && property === "forkLowerHead") return { ...element, forkLower: { ...(element.forkLower ?? {}), endHead: value as ArrowHead } };
      if (element.type === "flowchart" && property === "flowchartShape") return { ...element, flowchartShape: value as FlowchartShape };
      if (isConnector(element) && (property === "startHead" || property === "endHead")) return { ...element, [property]: value as ArrowHead };
      return element;
    };
    setElements((items) => items.map((element, index) => indices.has(index) ? update(element) : element));
    pushUndo(before); setDirty(true);
  }

  function setConnectorHead(end: "start" | "end", value: ArrowHead) {
    const selected = focusedElement();
    if (selected && isConnector(selected)) { updateProperty(end === "start" ? "startHead" : "endHead", value); return; }
    if (tool() === "line") { (end === "start" ? setDefaultLineStartHead : setDefaultLineEndHead)(value); return; }
    (end === "start" ? setDefaultStartHead : setDefaultEndHead)(value);
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

  function openNoteEditor(point: Point, kind: NoteKind, editingIndex?: number) {
    if (boardLocked()) return;
    const existing = editingIndex === undefined ? undefined : elements()[editingIndex];
    if (existing?.locked) return;
    const group = existing?.type === "group" ? existing : undefined;
    const bounds = group ? elementBounds(group) : undefined;
    setNoteEditor({ x: bounds?.x ?? point.x, y: bounds?.y ?? point.y, width: group?.note?.width ?? bounds?.w ?? (kind === "sticky" ? 296 : 340), height: group?.note?.height ?? bounds?.h ?? 190, fontSize: group?.note?.fontSize ?? 14, kind, content: group?.note?.content ?? (kind === "checklist" ? "- [ ] New task" : ""), editingIndex });
    setNoteEditorSession(session => session + 1);
  }

  function saveNoteEditor() {
    const draft = noteEditor();
    if (!draft || boardLocked()) return;
    if (draft.content.length > 50000) { setError("Notes and checklists are limited to 50,000 characters."); return; }
    const content = draft.kind === "checklist" && !draft.content.trim() ? "- [ ] New task" : draft.content;
    if (!content.trim()) { setNoteEditor(undefined); return; }
    if (normalizeNoteContent(content, draft.kind).length > 50000) {
      setError("Checklist task markers count toward the 50,000-character save limit. Shorten the checklist before saving it.");
      return;
    }
    const previous = draft.editingIndex === undefined ? undefined : elements()[draft.editingIndex];
    let group = buildNoteGroup(draft.x, draft.y, draft.kind, content, { width: draft.width, height: draft.height, fontSize: draft.fontSize });
    if (previous?.type === "group") {
      group = { ...group, ...previous, note: { ...group.note, kind: draft.kind, content: group.note?.content ?? content }, elements: group.elements.map((child, index) => previous.elements[index]?.id ? { ...child, id: previous.elements[index].id } as Element : child) };
    }
    const before = cloneElements(elements());
    let index = draft.editingIndex;
    if (index === undefined) { index = elements().length; setElements(items => [...items, group]); }
    else setElements(items => items.map((item, i) => i === index ? group : item));
    pushUndo(before); setSelectedIndices([index]); setTool("select"); setTextMode("text"); setDirty(true); setNoteEditor(undefined);
  }

  function toggleChecklist(index: number, row: number) {
    const previous = elements()[index];
    if (previous?.type !== "group" || previous.note?.kind !== "checklist" || boardLocked() || previous.locked) return;
    const before = cloneElements(elements());
    const content = toggleChecklistContent(previous.note.content, row);
    const rebuilt = buildNoteGroup(elementBounds(previous).x, elementBounds(previous).y, "checklist", content, { width: previous.note.width, height: previous.note.height, fontSize: previous.note.fontSize });
    const replacement: Element = { ...rebuilt, ...previous, note: { ...rebuilt.note, kind: "checklist", content }, elements: rebuilt.elements.map((child, childIndex) => previous.elements[childIndex]?.id ? { ...child, id: previous.elements[childIndex].id } as Element : child) };
    setElements(items => items.map((item, current) => current === index ? replacement : item)); pushUndo(before); setDirty(true);
  }

  function toggleNoteCollapsed(index: number) {
    const previous = elements()[index];
    if (previous?.type !== "group" || !previous.note || boardLocked() || previous.locked) return;
    const bounds = elementBounds(previous); const before = cloneElements(elements());
    const next = buildNoteGroup(bounds.x, bounds.y, previous.note.kind, previous.note.content, {
      width: previous.note.width ?? bounds.w,
      height: previous.note.height ?? Math.max(100, bounds.h),
      fontSize: previous.note.fontSize,
      collapsed: !previous.note.collapsed,
    });
    const replacement: Element = { ...next, ...previous, note: next.note, elements: next.elements.map((child, childIndex) => previous.elements[childIndex]?.id ? { ...child, id: previous.elements[childIndex].id } as Element : child) };
    setElements(items => items.map((item, current) => current === index ? replacement : item));
    pushUndo(before); setSelectedIndices([index]); setDirty(true);
  }

  function handleCanvasDoubleClick(event: MouseEvent) {
    if (boardLocked() || tool() === "text") return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect(); const view = canvasState();
    const point = { x: (event.clientX - rect.left - view.panX) / view.zoom, y: (event.clientY - rect.top - view.panY) / view.zoom };
    const hit = hitTest(point) ?? hitInterior(point); const target = hit === undefined ? undefined : elements()[hit];
    if (target?.type === "group" && target.note) { if (!noteCollapseHit(target, point)) openNoteEditor(point, target.note.kind, hit); return; }
    if (hit !== undefined && isLabelShape(elements()[hit])) editShapeLabel(hit);
    else startTextDraft(point, hit !== undefined && elements()[hit]?.type === "text" ? hit : undefined);
  }

  function insertLibraryComponent(kind: LibraryComponentKind) {
    if (!activePath() || boardLocked() || !canvas) return;
    const item = LIBRARY_COMPONENTS.find(component => component.kind === kind); if (!item) return;
    const rect = canvas.getBoundingClientRect(); const view = canvasState();
    const x = (rect.width / 2 - view.panX) / view.zoom - item.width / 2;
    const y = (rect.height / 2 - view.panY) / view.zoom - item.height / 2;
    const group = buildLibraryComponent(kind, x, y); const index = elements().length;
    pushUndo(cloneElements(elements())); setElements(items => [...items, group]); setSelectedIndices([index]); setTool("select"); setStencilMenuOpen(false); setDirty(true);
  }

  function libraryIcon(kind: LibraryComponentKind) {
    const base = { viewBox: "0 0 32 32", "aria-hidden": true as const, focusable: false as const };
    if (kind === "uml-class") return <svg {...base}><rect x="5" y="4" width="22" height="24" rx="2"/><path d="M5 11h22M5 19h22M9 15h10M9 23h13"/></svg>;
    if (kind === "uml-lifeline") return <svg {...base}><rect x="8" y="3" width="16" height="7" rx="2"/><path d="M16 10v19" stroke-dasharray="2 2"/><circle cx="16" cy="6.5" r="1" fill="currentColor"/></svg>;
    if (kind === "uml-activation") return <svg {...base}><path d="M16 2v4m0 20v4"/><rect x="12" y="6" width="8" height="20" rx="1.5" fill="currentColor" fill-opacity=".16"/></svg>;
    if (kind === "sequence-sync" || kind === "sequence-async") return <svg {...base}><path d="M4 10h24M4 22h24"/>{kind === "sequence-sync" ? <path d="m22 18 6 4-6 4z" fill="currentColor"/> : <path d="m23 18 6 4-6 4"/>}<rect x="14" y="11" width="4" height="6" rx="1" fill="currentColor" fill-opacity=".18"/></svg>;
    if (kind === "uml-inheritance" || kind === "uml-realization") return <svg {...base}><path d="M4 16h21" stroke-dasharray={kind === "uml-realization" ? "3 2" : undefined}/><path d="m24 11 5 5-5 5z" fill="var(--menu-bg, #fff)"/></svg>;
    if (kind === "uml-aggregation" || kind === "uml-composition") return <svg {...base}><path d="M10 16h19"/><path d="m5 16 5-5 5 5-5 5z" fill={kind === "uml-composition" ? "currentColor" : "var(--menu-bg, #fff)"}/></svg>;
    if (kind === "er-table") return <svg {...base}><rect x="4" y="4" width="24" height="24" rx="2"/><path d="M4 11h24M14 11v17M14 17h14M14 23h14"/><path d="M7 15h4m-4 7h4" stroke-width="2"/></svg>;
    if (kind === "er-one-many") return <svg {...base}><path d="M3 16h20m0-6v12m0-12 6 6-6 6m0-6 6-6m-6 6 6 6"/><path d="M6 12v8" stroke-width="2"/></svg>;
    if (kind === "er-many-many") return <svg {...base}><path d="M9 10 3 16l6 6m0-12-6 6 6 6m14-12 6 6-6 6m0-12 6 6-6 6M9 16h14"/></svg>;
    if (kind === "c4-system") return <svg {...base}><circle cx="5" cy="16" r="2"/><circle cx="27" cy="16" r="2"/><rect x="8" y="5" width="16" height="22" rx="3" stroke-dasharray="3 2"/><rect x="11" y="11" width="10" height="10" rx="2"/><path d="M13 15h6m-6 3h4"/></svg>;
    if (kind === "c4-container") return <svg {...base}><rect x="4" y="4" width="24" height="24" rx="3" stroke-dasharray="3 2"/><rect x="7" y="9" width="8" height="12" rx="2"/><rect x="18" y="9" width="7" height="5" rx="1"/><rect x="18" y="17" width="7" height="5" rx="1"/></svg>;
    if (kind === "c4-component") return <svg {...base}><rect x="4" y="4" width="24" height="24" rx="3"/><rect x="8" y="9" width="7" height="6" rx="1"/><rect x="17" y="9" width="7" height="6" rx="1"/><rect x="8" y="17" width="16" height="6" rx="1"/></svg>;
    if (kind === "tech-database") return <svg {...base}><ellipse cx="16" cy="7" rx="10" ry="4"/><path d="M6 7v17c0 2.2 4.5 4 10 4s10-1.8 10-4V7M6 15c0 2.2 4.5 4 10 4s10-1.8 10-4"/></svg>;
    if (kind === "tech-cloud") return <svg {...base}><path d="M9 24h15a5 5 0 0 0 .7-10A8 8 0 0 0 9 11a6.5 6.5 0 0 0 0 13Z"/><path d="M13 18h6m-3-3v6"/></svg>;
    if (kind === "tech-service") return <svg {...base}><rect x="5" y="5" width="22" height="22" rx="5"/><path d="M16 10v3m0 6v3m-6-6h3m6 0h3m-10-4 2 2m4 4 2 2m0-8-2 2m-4 4-2 2"/><circle cx="16" cy="16" r="3"/></svg>;
    if (kind === "data-flow") return <svg {...base}><path d="M3 12h18M3 20h18" stroke-width="3" stroke-dasharray="3 2"/><path d="m20 7 8 9-8 9z" fill="currentColor"/></svg>;
    if (kind === "network-zone") return <svg {...base}><rect x="3" y="4" width="26" height="24" rx="4" stroke-dasharray="3 2"/><rect x="7" y="9" width="7" height="6" rx="1"/><rect x="18" y="17" width="7" height="6" rx="1"/><path d="m14 12 5 6"/></svg>;
    return <svg {...base}><path d="M5 5h22v22H5zM9 11h14M9 16h14M9 21h9"/></svg>;
  }

  function insertSchemaVisual() {
    if (!activePath() || boardLocked() || !canvas) return;
    try {
      const tables = parseSchema(schemaInput()); const width = 252; const header = 40; const rowHeight = 29; const gapX = 72; const gapY = 68;
      const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(tables.length))));
      const rowHeights = Array.from({ length: Math.ceil(tables.length / columns) }, (_, row) => Math.max(...tables.slice(row * columns, (row + 1) * columns).map(table => header + Math.max(1, table.columns.length) * rowHeight + 12)));
      const totalWidth = columns * width + (columns - 1) * gapX; const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0) + (rowHeights.length - 1) * gapY;
      const rect = canvas.getBoundingClientRect(); const view = canvasState(); const centerX = (rect.width / 2 - view.panX) / view.zoom; const centerY = (rect.height / 2 - view.panY) / view.zoom;
      const originX = centerX - totalWidth / 2; const originY = centerY - totalHeight / 2;
      const groups: GroupElement[] = []; const anchors = new Map<string, { id: string; x: number; y: number }>();
      tables.forEach((table, tableIndex) => {
        const row = Math.floor(tableIndex / columns); const col = tableIndex % columns; const x = originX + col * (width + gapX); const y = originY + rowHeights.slice(0, row).reduce((sum, height) => sum + height + gapY, 0);
        const tableHeight = header + Math.max(1, table.columns.length) * rowHeight + 12;
        const background: ShapeElement = { type: "rectangle", x, y, w: width, h: tableHeight, color: "#8a9caf", thickness: 1.4, fillColor: "#fbfcfe", fillOpacity: 1, edgeStyle: "rounded", cornerRadius: 10 };
        const topBand: ShapeElement = { type: "rectangle", x, y, w: width, h: header, color: "#8a9caf", thickness: 1.2, fillColor: "#e8f0f7", fillOpacity: 1, edgeStyle: "rounded", cornerRadius: 10 };
        const children: Element[] = [background, topBand, { type: "text", x: x + 12, y: y + 11, text: table.name, color: "#36556e", fontSize: 13, fontFamily: "sans", bold: true, textAlign: "left", listType: "none" }];
        table.columns.forEach((column, columnIndex) => {
          const itemY = y + header + columnIndex * rowHeight; const badge = column.primaryKey ? "PK" : column.foreignTable ? "FK" : "";
          children.push({ type: "text", x: x + 10, y: itemY + 8, text: badge, color: column.primaryKey ? "#7d672a" : "#436e85", fontSize: 9, fontFamily: "sans", bold: true, textAlign: "left", listType: "none" });
          children.push({ type: "text", x: x + 38, y: itemY + 7, text: column.name, color: "#354759", fontSize: 11, fontFamily: "mono", bold: false, textAlign: "left", listType: "none" });
          children.push({ type: "text", x: x + 156, y: itemY + 7, text: column.type || "type", color: "#768493", fontSize: 10, fontFamily: "mono", bold: false, textAlign: "left", listType: "none" });
          const rightId = crypto.randomUUID(); const leftId = crypto.randomUUID();
          children.push({ type: "rectangle", id: rightId, x: x + width - 4, y: itemY + 3, w: 4, h: rowHeight - 6, color: "#ffffff", thickness: 1, fillColor: "#ffffff", fillOpacity: 0, opacity: 0 });
          children.push({ type: "rectangle", id: leftId, x, y: itemY + 3, w: 4, h: rowHeight - 6, color: "#ffffff", thickness: 1, fillColor: "#ffffff", fillOpacity: 0, opacity: 0 });
          anchors.set(`${table.name.toLowerCase()}.${column.name.toLowerCase()}.right`, { id: rightId, x: x + width, y: itemY + rowHeight / 2 });
          anchors.set(`${table.name.toLowerCase()}.${column.name.toLowerCase()}.left`, { id: leftId, x, y: itemY + rowHeight / 2 });
        });
        groups.push({ type: "group", elements: children });
      });
      const byName = new Map(tables.map(table => [table.name.toLowerCase(), table])); const relations: ShapeElement[] = [];
      tables.forEach(table => table.columns.forEach(column => {
        if (!column.foreignTable) return;
        const targetName = column.foreignTable.toLowerCase(); const target = byName.get(targetName); if (!target) return;
        const sourceAnchor = anchors.get(`${table.name.toLowerCase()}.${column.name.toLowerCase()}.right`);
        const targetColumn = column.foreignColumn ? target.columns.find(value => value.name.toLowerCase() === column.foreignColumn!.toLowerCase()) : target.columns.find(value => value.primaryKey) ?? target.columns[0];
        const targetAnchor = targetColumn ? anchors.get(`${target.name.toLowerCase()}.${targetColumn.name.toLowerCase()}.left`) : undefined;
        if (!sourceAnchor || !targetAnchor) return;
        relations.push({ type: "line", x: sourceAnchor.x, y: sourceAnchor.y, w: targetAnchor.x - sourceAnchor.x, h: targetAnchor.y - sourceAnchor.y, color: "#63859d", thickness: 1.6, lineStyle: "solid", startHead: "none", endHead: "open", startBinding: { elementId: sourceAnchor.id, anchor: { x: 1, y: .5 } }, endBinding: { elementId: targetAnchor.id, anchor: { x: 0, y: .5 } } });
      }));
      const before = cloneElements(elements()); const firstIndex = elements().length; const imported: Element[] = [...groups, ...relations];
      setElements(items => [...items, ...imported]); pushUndo(before); setSelectedIndices(imported.map((_item, index) => firstIndex + index)); setTool("select"); setTextMode("text"); setDirty(true);
      setSchemaDialog(false); setSchemaInput(""); setSchemaError("");
    } catch (cause) { setSchemaError(cause instanceof Error ? cause.message : String(cause)); }
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
      for (const { tip, angle: direction, kind } of arrowHeadEntries(element, route)) {
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
      const left = Math.min(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const width = Math.abs(element.w); const height = Math.abs(element.h);
      const radius = element.edgeStyle === "pill" ? Math.min(width, height) / 2 : element.edgeStyle === "rounded" ? Math.min(element.cornerRadius ?? 14, width / 2, height / 2) : 0;
      if (radius > 0 && canvas) { const context = canvas.getContext("2d"); if (context) { context.save(); context.setTransform(1, 0, 0, 1, 0, 0); context.beginPath(); context.roundRect(left, top, width, height, radius); const inside = !!element.fillColor && context.isPointInPath(point.x, point.y); context.lineWidth = tolerance * 2; const border = context.isPointInStroke(point.x, point.y); context.restore(); return inside || border; } }
      if (element.fillColor && point.x >= left && point.x <= left + width && point.y >= top && point.y <= top + height) return true;
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
    if (element.type === "triangle") {
      const left = Math.min(element.x, element.x + element.w); const right = Math.max(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const bottom = Math.max(element.y, element.y + element.h);
      const points = [{ x: (left + right) / 2, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
      if (element.fillColor && pointInPolygon(point, points)) return true;
      for (let i = 0; i < points.length; i++) if (distanceToSegment(point, points[i], points[(i + 1) % points.length]) <= tolerance) return true;
      return false;
    }
    if (element.type === "flowchart") {
      const context = canvas?.getContext("2d"); if (!context) return false;
      context.save(); context.setTransform(1, 0, 0, 1, 0, 0); const symbolPath = flowchartPathObject(element.flowchartShape ?? "process", element.x, element.y, element.w, element.h);
      if (!symbolPath) traceFlowchart(context, element.flowchartShape ?? "process", element.x, element.y, element.w, element.h);
      const inside = element.fillColor ? symbolPath ? context.isPointInPath(symbolPath, point.x, point.y) : context.isPointInPath(point.x, point.y) : false; context.lineWidth = tolerance * 2; let border = symbolPath ? context.isPointInStroke(symbolPath, point.x, point.y) : context.isPointInStroke(point.x, point.y);
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
      ctx.save(); ctx.globalAlpha = element.opacity ?? 1; ctx.fillStyle = themeInk(element.color, theme());
      ctx.font = (element.italic ? "italic " : "") + (element.bold ? "700 " : "400 ") + element.fontSize + "px " + fontCss(element.fontFamily); ctx.textBaseline = "top"; ctx.textAlign = element.textAlign === "justify" ? "left" : element.textAlign ?? "left";
      const lines = element.text.split(/\r?\n/).map((line, index) => element.listType === "bullet" ? "• " + line : element.listType === "number" ? (index + 1) + ". " + line : line);
      lines.forEach((line, index) => { const y = element.y + index * element.fontSize * 1.25; ctx.fillText(line, element.x, y); if (element.underline) { const measured = ctx.measureText(line).width; const startX = element.textAlign === "center" ? element.x - measured / 2 : element.textAlign === "right" ? element.x - measured : element.x; ctx.fillRect(startX, y + element.fontSize * 1.06, measured, Math.max(1, element.fontSize / 18)); } }); ctx.restore(); if (element.rotation) ctx.restore(); return;
    }
    ctx.save(); ctx.globalAlpha = element.opacity ?? 1;
    const renderedInk = themeInk(element.color, theme());
    ctx.strokeStyle = renderedInk; ctx.lineWidth = element.thickness; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
    if ("lineStyle" in element) ctx.setLineDash(element.lineStyle === "dashed" ? [element.thickness * 4, element.thickness * 2.5] : element.lineStyle === "dotted" ? [element.thickness, element.thickness * 2.2] : []);
    if (element.type === "line" || element.type === "arrow") {
      const route = element.type === "arrow" ? element.arrowRoute ?? "straight" : element.lineRoute ?? "straight";
      if (element.lineStyle === "double") {
        const angle = Math.atan2(element.h, element.w); const offset = Math.max(2.5, element.thickness * 1.2);
        for (const side of [-1, 1]) { ctx.save(); ctx.translate(-Math.sin(angle) * offset * side, Math.cos(angle) * offset * side); traceConnector(ctx, element); ctx.stroke(); ctx.restore(); }
      } else { traceConnector(ctx, element); ctx.stroke(); }
      if (element.type === "arrow" || element.type === "line") {
        for (const { tip, angle: direction, kind } of arrowHeadEntries(element, route)) {
          if (kind === "none") continue;
          if (kind === "dot") { ctx.beginPath(); ctx.arc(tip.x, tip.y, Math.max(3, element.thickness * 1.15), 0, Math.PI * 2); ctx.fillStyle = renderedInk; ctx.fill(); continue; }
          const points = arrowHeadPoints(tip, direction, kind, element.thickness); ctx.beginPath();
          if (kind === "open") { ctx.moveTo(tip.x, tip.y); ctx.lineTo(points[0].x, points[0].y); ctx.moveTo(tip.x, tip.y); ctx.lineTo(points[1].x, points[1].y); }
          else { ctx.moveTo(points[0].x, points[0].y); for (let index = 1; index < points.length; index++) ctx.lineTo(points[index].x, points[index].y); if (["solid", "thick", "diamond"].includes(kind)) ctx.closePath(); }
          if (["solid", "thick", "diamond"].includes(kind)) { ctx.fillStyle = renderedInk; ctx.fill(); }
          ctx.stroke();
        }
      }
      ctx.restore(); if (element.rotation) ctx.restore(); return;
    }
    if (element.type === "freehand") {
      if (!element.points.length) { ctx.restore(); return; }
      const pressureAware = element.points.some(point => point.pressure !== undefined || point.tiltX !== undefined || point.tiltY !== undefined);
      if (pressureAware) {
        const pointWidth = (point: StrokePoint) => stylusStrokeWidth(point, element.thickness);
        const stamp = (point: StrokePoint) => {
          const tilt = Math.min(1, Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0) / 90); const width = pointWidth(point);
          ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(Math.atan2(point.tiltY ?? 0, point.tiltX ?? 0)); ctx.beginPath(); ctx.ellipse(0, 0, Math.max(.25, width * (.5 + tilt * .35)), Math.max(.25, width * .5), 0, 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill(); ctx.restore();
        };
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        if (element.points.length === 1) stamp(element.points[0]);
        for (let index = 1; index < element.points.length; index++) {
          const previous = element.points[index - 1]; const point = element.points[index]; ctx.beginPath(); ctx.lineWidth = (pointWidth(previous) + pointWidth(point)) / 2; ctx.moveTo(previous.x, previous.y); ctx.lineTo(point.x, point.y); ctx.stroke(); stamp(point);
        }
        stamp(element.points[0]);
      } else {
        ctx.beginPath(); ctx.moveTo(element.points[0].x, element.points[0].y);
        for (let i = 1; i < element.points.length; i++) {
          const previous = element.points[i - 1]; const point = element.points[i];
          const mid = { x: (previous.x + point.x) / 2, y: (previous.y + point.y) / 2 };
          ctx.quadraticCurveTo(previous.x, previous.y, mid.x, mid.y);
        }
        const last = element.points[element.points.length - 1]; ctx.lineTo(last.x, last.y); ctx.stroke();
      }
      ctx.restore(); if (element.rotation) ctx.restore(); return;
    } else if (element.type === "rectangle") {
      const left = Math.min(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const width = Math.abs(element.w); const height = Math.abs(element.h);
      if ((element.edgeStyle === "rounded" || element.edgeStyle === "pill") && typeof ctx.roundRect === "function") ctx.roundRect(left, top, width, height, element.edgeStyle === "pill" ? Math.min(width, height) / 2 : Math.min(element.cornerRadius ?? 14, width / 2, height / 2));
      else if (element.edgeStyle === "cut") { const c = Math.min(element.cornerRadius ?? 12, width / 2, height / 2); ctx.moveTo(left + c, top); ctx.lineTo(left + width - c, top); ctx.lineTo(left + width, top + c); ctx.lineTo(left + width, top + height - c); ctx.lineTo(left + width - c, top + height); ctx.lineTo(left + c, top + height); ctx.lineTo(left, top + height - c); ctx.lineTo(left, top + c); ctx.closePath(); }
      else ctx.rect(left, top, width, height);
    } else if (element.type === "triangle") {
      const left = Math.min(element.x, element.x + element.w); const right = Math.max(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const bottom = Math.max(element.y, element.y + element.h);
      ctx.moveTo((left + right) / 2, top); ctx.lineTo(right, bottom); ctx.lineTo(left, bottom); ctx.closePath();
    } else if (element.type === "diamond") {
      const left = Math.min(element.x, element.x + element.w); const right = Math.max(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const bottom = Math.max(element.y, element.y + element.h);
      ctx.moveTo((left + right) / 2, top); ctx.lineTo(right, (top + bottom) / 2); ctx.lineTo((left + right) / 2, bottom); ctx.lineTo(left, (top + bottom) / 2); ctx.closePath();
    } else if (element.type === "circle") {
      const rx = Math.abs(element.w / 2); const ry = Math.abs(element.h / 2); const cx = element.x + element.w / 2; const cy = element.y + element.h / 2;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    } else if (element.type === "flowchart") {
      const symbolPath = flowchartPathObject(element.flowchartShape ?? "process", element.x, element.y, element.w, element.h);
      if (symbolPath) {
        if (element.fillColor) { ctx.save(); ctx.globalAlpha = (element.opacity ?? 1) * (element.fillOpacity ?? fillOpacity()); ctx.fillStyle = element.fillColor; ctx.fill(symbolPath); ctx.restore(); }
        ctx.stroke(symbolPath); traceFlowchartDetails(ctx, element.flowchartShape ?? "process", element.x, element.y, element.w, element.h);
        ctx.restore(); if (isLabelShape(element) && !(textDraft()?.shapeLabel && elements()[textDraft()!.editingIndex!]?.id === element.id)) drawLabel(ctx, element); if (element.rotation) ctx.restore(); return;
      }
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

  function transformHandlePoints(bounds: Bounds, includeRotate = true) {
    const midX = bounds.x + bounds.w / 2; const midY = bounds.y + bounds.h / 2; const offset = 24 / canvasState().zoom;
    const handles = [{ id: "nw", x: bounds.x, y: bounds.y }, { id: "n", x: midX, y: bounds.y }, { id: "ne", x: bounds.x + bounds.w, y: bounds.y }, { id: "e", x: bounds.x + bounds.w, y: midY }, { id: "se", x: bounds.x + bounds.w, y: bounds.y + bounds.h }, { id: "s", x: midX, y: bounds.y + bounds.h }, { id: "sw", x: bounds.x, y: bounds.y + bounds.h }, { id: "w", x: bounds.x, y: midY }];
    return includeRotate ? [...handles, { id: "rotate", x: midX, y: bounds.y - offset }] : handles;
  }

  function drawTransformHandles(ctx: CanvasRenderingContext2D, bounds: Bounds, zoom: number, includeRotate = true) {
    const handles = transformHandlePoints(bounds, includeRotate); const rotate = includeRotate ? handles.pop() : undefined; const top = { x: bounds.x + bounds.w / 2, y: bounds.y };
    ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = "#547bb1"; ctx.fillStyle = "#ffffff"; ctx.lineWidth = 1 / zoom;
    if (rotate) { ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(rotate.x, rotate.y); ctx.stroke(); }
    for (const handle of handles) { ctx.beginPath(); ctx.rect(handle.x - 4 / zoom, handle.y - 4 / zoom, 8 / zoom, 8 / zoom); ctx.fill(); ctx.stroke(); }
    if (rotate) { ctx.beginPath(); ctx.arc(rotate.x, rotate.y, 5 / zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } ctx.restore();
  }

  function findTransformHandle(point: Point): { index: number; handle: string } | undefined {
    if (selectedIndices().length !== 1) return undefined;
    const index = selectedIndices()[0]; const element = elements()[index]; if (!element || element.locked || element.type === "freehand" || element.type === "group" && (!element.note || element.note.collapsed)) return undefined;
    const canRotate = element.type !== "group";
    for (const handle of isConnector(element) ? connectorHandles(element) : transformHandlePoints(elementBounds(element), canRotate)) if (Math.hypot(point.x - handle.x, point.y - handle.y) <= 9 / canvasState().zoom) return { index, handle: handle.id };
    return undefined;
  }

  function resizeElement(element: Element, handle: string, start: Point, point: Point): Element {
    if (element.type === "freehand") return element;
    if (element.type === "line" || element.type === "arrow") return resizeConnector(element, handle, point);
    if (element.type === "group") {
      if (!element.note) return element;
      const before = elementBounds(element); let { x, y, w, h } = before; const dx = point.x - start.x; const dy = point.y - start.y;
      if (handle.includes("w")) { x += dx; w -= dx; } if (handle.includes("e")) w += dx;
      if (handle.includes("n")) { y += dy; h -= dy; } if (handle.includes("s")) h += dy;
      const next = { x, y, w: Math.max(180, Math.min(4000, w)), h: Math.max(100, Math.min(1_000_000, h)) };
      const rebuilt = buildNoteGroup(next.x, next.y, element.note.kind, element.note.content, { width: next.w, height: next.h, fontSize: element.note.fontSize });
      return { ...rebuilt, ...element, note: rebuilt.note, elements: rebuilt.elements.map((child, index) => element.elements[index]?.id ? { ...child, id: element.elements[index].id } as Element : child) };
    }
    if (handle === "rotate") {
      const bounds = elementBounds(element); const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
      const a = Math.atan2(start.y - center.y, start.x - center.x); const b = Math.atan2(point.y - center.y, point.x - center.x);
      return { ...element, rotation: (element.rotation ?? 0) + (b - a) * 180 / Math.PI };
    }
    if (element.type === "text") { const delta = handle.includes("e") || handle.includes("w") ? point.x - start.x : point.y - start.y; return { ...element, fontSize: Math.max(8, Math.min(160, element.fontSize + delta * 0.3)) }; }
    const bounds = { x: Math.min(element.x, element.x + element.w), y: Math.min(element.y, element.y + element.h), w: Math.abs(element.w), h: Math.abs(element.h) }; let { x, y, w, h } = bounds; const dx = point.x - start.x; const dy = point.y - start.y;
    if (handle.includes("w")) { x += dx; w -= dx; } if (handle.includes("e")) w += dx;
    if (handle.includes("n")) { y += dy; h -= dy; } if (handle.includes("s")) h += dy;
    const nextW = Math.max(2, w); const nextH = Math.max(2, h);
    if (element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "triangle" || element.type === "flowchart") {
      return { ...element, x, y, w: nextW, h: nextH };
    }
    return { ...element, x, y, w: nextW, h: nextH };
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
        if (isSelected && selected.size === 1 && !element.locked && !boardLocked()) for (const handle of connectorHandles(element)) { const routeHandle = handle.id.startsWith("route") || handle.id.includes(":route:"); ctx.beginPath(); ctx.fillStyle = routeHandle ? "#dbeafe" : "#ffffff"; ctx.arc(handle.x, handle.y, (routeHandle ? 4 : 6) / state.zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        ctx.restore();
      } else if (includeSelection && (isSelected || hoveredIndex() === index)) {
        const bounds = elementBounds(element); const padding = 5 / state.zoom;
        ctx.save(); ctx.strokeStyle = isSelected ? "#547bb1" : "#8298b8"; ctx.globalAlpha = isSelected ? 1 : 0.62; ctx.lineWidth = 1 / state.zoom; ctx.setLineDash([4 / state.zoom, 3 / state.zoom]);
        ctx.strokeRect(bounds.x - padding, bounds.y - padding, Math.max(bounds.w + padding * 2, 2 / state.zoom), Math.max(bounds.h + padding * 2, 2 / state.zoom)); ctx.restore();
        if (isSelected && !element.locked && selected.size === 1 && tool() === "select" && (element.type !== "group" || !!element.note && !element.note.collapsed) && element.type !== "freehand") drawTransformHandles(ctx, bounds, state.zoom, element.type !== "group");
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
    const transientLaser = laserTrail();
    if (includeSelection && transientLaser) {
      ctx.save(); ctx.shadowColor = "#ff3265"; ctx.shadowBlur = 8 / state.zoom;
      drawElement(ctx, { type: "freehand", points: transientLaser.points, color: "#ff3265", thickness: 4 / state.zoom, opacity: transientLaser.opacity });
      ctx.restore();
    }
    const activePreview = preview();
    if (includeSelection && activePreview) {
      const { start, end, type, color: stroke, thickness: widthPx } = activePreview;
      if (type === "pen") { ctx.save(); if (tool() === "laser") { ctx.shadowColor = "#ff3265"; ctx.shadowBlur = widthPx * 2.5; } drawElement(ctx, { type: "freehand", points: currentPoints, color: stroke, thickness: widthPx }); ctx.restore(); }
      else drawElement(ctx, { type, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color: stroke, thickness: widthPx, flowchartShape: activePreview.flowchartShape, lineRoute: activePreview.lineRoute, arrowRoute: activePreview.arrowRoute, edgeStyle: edgeStyle(), cornerRadius: cornerRadius(), ...(fillEnabled() && (type === "rectangle" || type === "circle" || type === "diamond" || type === "triangle" || type === "flowchart") ? { fillColor: fillColor(), fillOpacity: fillOpacity() } : {}), ...(type === "line" ? { startHead: defaultLineStartHead(), endHead: defaultLineEndHead() } : {}), ...(type === "arrow" ? { startHead: defaultStartHead(), endHead: defaultEndHead() } : {}) });
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

  createEffect(() => { elements(); canvasState(); preview(); laserTrail(); attachmentHint(); tool(); textDraft(); selectedIndices(); hoveredIndex(); showGrid(); marquee(); alignmentGuides(); theme(); boardColor(); boardColorFollowsTheme(); fillOpacity(); renderCanvas(); });
  createEffect(() => { const session = noteEditorSession(); if (!session) return; requestAnimationFrame(() => { if (noteEditorTextarea?.isConnected) noteEditorTextarea.focus(); }); });
  createEffect(() => { exportOptionsOpen(); exportFormat(); exportScope(); exportGrid(); exportTransparent(); exportWidth(); exportHeight(); pdfPaper(); pdfPageSet(); pdfRangeStart(); pdfRangeEnd(); pdfOrientation(); pdfLayout(); pages(); pdfDpi(); pdfMarginMm(); pdfOverlapMm(); pdfCustomWidthMm(); pdfCustomHeightMm(); pdfPreviewPage(); pdfColorMode(); pdfBleedMm(); pdfCropMarks(); pdfHeader(); pdfFooter(); elements(); selectedIndices(); canvasState(); theme(); boardColor(); renderExportPreview(); });
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
    if (syncConflict() || recoveryPrompt()) { setExportOptionsOpen(false); setPageDialog(undefined); setSchemaDialog(false); setShowClearConfirm(false); setContextMenu(undefined); closeToolOptions(); if (menu) menu.open = false; if (viewMenu) viewMenu.open = false; }
  });
  createEffect(() => {
    const open = pageDialog() || schemaDialog() || exportOptionsOpen() || showClearConfirm() || recoveryPrompt() || syncConflict() || helpOpen();
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => { const dialog = document.querySelector<HTMLElement>("[aria-modal='true']"); (dialog?.querySelector<HTMLElement>("[autofocus], input, button") ?? dialog)?.focus(); });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>("[aria-modal='true']"); const controls = [...dialog?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex='0']") ?? []];
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
        if (noteEditor()) { event.preventDefault(); saveNoteEditor(); return; }
        if (schemaDialog()) { event.preventDefault(); setSchemaDialog(false); return; }
        if (pageDialog()) { event.preventDefault(); setPageDialog(undefined); return; }
        if (helpOpen()) { event.preventDefault(); setHelpOpen(false); return; }
        if (contextMenu()) { event.preventDefault(); setContextMenu(undefined); return; }
        if (canvasOptionsOpen()) { setCanvasOptionsOpen(false); return; }
        if (openToolOptions()) { closeToolOptions(); return; }
        document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(detail => detail.open = false);
        if (showClearConfirm()) { event.preventDefault(); setShowClearConfirm(false); return; }
        if (exportOptionsOpen()) { event.preventDefault(); setExportOptionsOpen(false); return; }
        if (recoveryPrompt() || syncConflict()) return;
        if (textDraft()) commitTextDraft();
        event.preventDefault(); setTool("select"); setSelectedIndices([]); setHoveredIndex(undefined); setMarquee(undefined); marqueeOrigin = undefined; resizeOrigin = undefined; moveOrigin = undefined; setPreview(undefined); drawing = false; setSpaceDown(false); setIsPanning(false); panOrigin = undefined;
        if (menu) menu.open = false; if (viewMenu) viewMenu.open = false; return;
      }
      if (event.key === "F1") { event.preventDefault(); setHelpOpen(true); return; }
      if (recoveryPrompt() || syncConflict() || exportOptionsOpen() || showClearConfirm() || pageDialog() || schemaDialog() || noteEditor() || contextMenu()) return;
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
      if (key === "v") setTool("select"); else if (key === "p") activateTool("pen"); else if (key === "y") activateTool("laser"); else if (key === "r") activateTool("rectangle"); else if (key === "c" || key === "o") activateTool("circle"); else if (key === "d") activateTool("diamond"); else if (key === "n") activateTool("triangle"); else if (key === "l") activateTool("line"); else if (key === "a") activateTool("arrow"); else if (key === "f") activateTool("flowchart"); else if (key === "t") activateTool("text"); else if (key === "b") activateTool("bucket"); else if (key === "e") activateTool("eraser"); else if (key === "x") activateTool("crop");
      else if (key === "delete" || key === "backspace") { event.preventDefault(); deleteSelected(); }
    };
    const clipboardAllowed = (target: EventTarget | null) => activePath() && !pageDialog() && !schemaDialog() && !exportOptionsOpen() && !showClearConfirm() && !recoveryPrompt() && !syncConflict() && !noteEditor() && !(target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea")));
    const copy = (event: ClipboardEvent) => { if (!clipboardAllowed(event.target) || !selectedElements().length) return; event.preventDefault(); event.clipboardData?.setData("text/plain", clipboardPayload()); clipboardItems = copyElements(selectedElements(), 0, 0); };
    const paste = (event: ClipboardEvent) => { if (!clipboardAllowed(event.target) || boardLocked()) return; const raw = event.clipboardData?.getData("text/plain"); if (raw) { event.preventDefault(); pastePayload(raw); } };
    const cut = (event: ClipboardEvent) => { if (!clipboardAllowed(event.target) || boardLocked()) return; copy(event); if (event.defaultPrevented) deleteSelected(); };
    document.addEventListener("copy", copy); document.addEventListener("paste", paste); document.addEventListener("cut", cut);
    onCleanup(() => { document.removeEventListener("copy", copy); document.removeEventListener("paste", paste); document.removeEventListener("cut", cut); });
    const keyUp = (event: KeyboardEvent) => { if (event.code === "Space") setSpaceDown(false); };
    const blur = () => { setSpaceDown(false); setIsPanning(false); panOrigin = undefined; };
    const outsideClick = (event: PointerEvent) => { document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(detail => { if (!detail.contains(event.target as Node)) detail.open = false; }); if (!(event.target instanceof HTMLElement && event.target.closest(".tool-family"))) { closeToolOptions(); setStencilMenuOpen(false); } if (!(event.target instanceof HTMLElement && event.target.closest(".canvas-options-family"))) setCanvasOptionsOpen(false); if (!(event.target instanceof HTMLElement && event.target.closest(".quick-style-panel"))) setQuickStylePopover(undefined); if (!(event.target instanceof HTMLElement && event.target.closest(".canvas-context-menu"))) setContextMenu(undefined); if (textDraft() && event.target instanceof HTMLElement && !event.target.closest(".canvas-text-editor, .style-pane, .drawing-canvas")) commitTextDraft(); if (menu?.open && !menu.contains(event.target as Node)) menu.open = false; if (viewMenu?.open && !viewMenu.contains(event.target as Node)) viewMenu.open = false; };
    const closeMenuOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setQuickStylePopover(undefined); if (menu?.open) menu.open = false; if (viewMenu?.open) viewMenu.open = false; } };
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
    onCleanup(() => { unlistenClose?.(); window.clearInterval(laserTimer); window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", blur); document.removeEventListener("pointerdown", outsideClick); document.removeEventListener("keydown", closeMenuOnEscape); colorScheme.removeEventListener("change", updateSystemTheme); window.clearInterval(timer); });
  });

  function setThemePreference(mode: ThemeMode) {
    setThemeMode(mode);
    try { if (mode === "system") localStorage.removeItem("sketchdraw-theme"); else localStorage.setItem("sketchdraw-theme", mode); } catch { /* Theme still applies for this session. */ }
  }

  const recoveryKey = (path: string) => `sketchdraw-v6-recovery:${encodeURIComponent(path)}`;
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

  function restoreOpenedViewAt100(path: string, pageId: string) {
    requestAnimationFrame(() => {
      if (activePath() !== path || activePageId() !== pageId || !canvas) return;
      const viewport = canvas.getBoundingClientRect();
      const saved = canvasState();
      const focusX = (viewport.width / 2 - saved.panX) / saved.zoom;
      const focusY = (viewport.height / 2 - saved.panY) / saved.zoom;
      const restored = { ...saved, zoom: 1, panX: viewport.width / 2 - focusX, panY: viewport.height / 2 - focusY };
      setCanvasState(restored);
      setPages((items) => items.map((page) => page.id === pageId ? { ...page, canvasState: restored } : page));
    });
  }

  function restoreRecovery() {
    const recovery = recoveryPrompt(); if (!recovery) return;
    const baseline = lastSavedRaw ?? "";
    applySnapshot(recovery.snapshot, recovery.path, baseline);
    try { localStorage.removeItem(recoveryKey(recovery.path)); } catch { /* Best effort. */ }
    setDirty(true); setRecoveryPrompt(undefined);
    if (recovery.baselineRaw !== undefined && recovery.baselineRaw !== baseline) { setSyncConflict({ path: recovery.path, remote: baseline }); return; }
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
    try { localStorage.setItem("sketchdraw-v6-recent-files", JSON.stringify(updated)); } catch { /* Local storage may be disabled by the host. */ }
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
      if (!parsed) throw new Error("This file is invalid or is not a SketchDraw v6 document. Older formats are unsupported; create a new sketch.");
      applySnapshot(parsed, authorizedPath, rawText);
      restoreOpenedViewAt100(authorizedPath, parsed.activePageId);
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

  async function checkForUpdates() {
    if (updateCheck() === "checking") return;
    setUpdateCheck("checking"); setUpdateVersion(undefined); setError("");
    try {
      const response = await fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } });
      if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}.`);
      const release: unknown = await response.json();
      if (!isRecord(release) || typeof release.tag_name !== "string") throw new Error("GitHub returned an incomplete release record.");
      const currentVersion = await getVersion();
      setUpdateVersion(release.tag_name);
      setUpdateCheck(compareReleaseVersions(release.tag_name, currentVersion) > 0 ? "available" : "current");
    } catch (cause) { setUpdateCheck("error"); setError(`Update check failed: ${String(cause)}`); }
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
      const document: SketchFile = { format: "SketchDraw", version: 6, activePageId: page.id, pages: [page] };
      const contents = JSON.stringify(document, null, 2);
      await invoke("atomic_save_sketch", { path, contents, expected: null });
      pageHistories.clear(); setPages([page]); setActivePageId(page.id); setElements([]); setCanvasState(emptyCanvas()); setBoardColor("#ffffff"); setBoardColorFollowsTheme(true); setSelectedIndices([]); setHoveredIndex(undefined); setActivePath(path); rememberFile(path); setDirty(false); setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })); setBoardLocked(false); setError(""); lastSavedRaw = contents;
      undoStack = []; redoStack = []; setHistoryVersion((version) => version + 1);
    } catch (cause) { setError(`Could not create SketchDraw file: ${String(cause)}`); } finally { setNativeBusy(false); }
  }

  function openExportOptions(format: "png" | "svg" | "pdf") {
    setExportFormat(format);
    setExportOptionsOpen(true);
    requestAnimationFrame(renderExportPreview);
  }

  function pdfPageSpec() {
    const preset: Record<"a4" | "letter" | "a3" | "legal" | "tabloid", readonly [number, number]> = { a4: [210, 297], letter: [215.9, 279.4], a3: [297, 420], legal: [215.9, 355.6], tabloid: [279.4, 431.8] };
    const paper = pdfPaper();
    let [widthMm, heightMm] = paper === "custom"
      ? [pdfCustomWidthMm(), pdfCustomHeightMm()]
      : preset[paper];
    widthMm = Math.max(25, Math.min(1000, Number.isFinite(widthMm) ? widthMm : 210));
    heightMm = Math.max(25, Math.min(1000, Number.isFinite(heightMm) ? heightMm : 297));
    if (pdfOrientation() === "landscape" && heightMm > widthMm || pdfOrientation() === "portrait" && widthMm > heightMm) [widthMm, heightMm] = [heightMm, widthMm];
    return { widthMm, heightMm, widthPt: widthMm * 72 / 25.4, heightPt: heightMm * 72 / 25.4 };
  }

  function pdfMetrics() {
    const page = pdfPageSpec();
    const marginMm = Math.max(0, Math.min(50, Number.isFinite(pdfMarginMm()) ? pdfMarginMm() : 0));
    const dpi = pdfDpi();
    const innerWidthPx = Math.max(1, Math.floor((page.widthMm - marginMm * 2) * dpi / 25.4));
    const innerHeightPx = Math.max(1, Math.floor((page.heightMm - marginMm * 2) * dpi / 25.4));
    const overlapPx = pdfLayout() === "tiled" ? Math.max(0, Math.min(Math.floor(Math.min(innerWidthPx, innerHeightPx) / 3), Math.floor(Math.max(0, pdfOverlapMm()) * dpi / 25.4))) : 0;
    const stepX = Math.max(1, innerWidthPx - overlapPx); const stepY = Math.max(1, innerHeightPx - overlapPx);
    const columns = pdfLayout() === "fit" ? 1 : Math.max(1, Math.ceil(Math.max(1, exportWidth() - overlapPx) / stepX));
    const rows = pdfLayout() === "fit" ? 1 : Math.max(1, Math.ceil(Math.max(1, exportHeight() - overlapPx) / stepY));
    const pageCount = pdfPageSet() === "current" ? columns * rows : selectedPdfPages().length;
    return { page, marginMm, dpi, innerWidthPx, innerHeightPx, overlapPx, stepX, stepY, columns, rows, pageCount };
  }

  function selectedPdfPages() {
    if (pdfPageSet() === "current") return currentPage() ? [currentPage()!] : [];
    if (pdfPageSet() === "all") return pages();
    const start = Math.max(1, Math.min(pages().length, Math.floor(pdfRangeStart())));
    const end = Math.max(start, Math.min(pages().length, Math.floor(pdfRangeEnd())));
    return pages().slice(start - 1, end);
  }

  function pageOffsets(length: number, tileSize: number, step: number) {
    const offsets: number[] = [];
    for (let offset = 0; offset < length; offset += step) {
      offsets.push(offset);
      if (offset + tileSize >= length) break;
      if (offsets.length > 1000) break;
    }
    return offsets.length ? offsets : [0];
  }

  function renderExportPreview() {
    const ticket = ++exportPreviewVersion;
    const target = exportPreviewCanvas;
    if (!target || !exportOptionsOpen() || !canvas) return;
    const format = exportFormat();
    const metrics = format === "pdf" ? pdfMetrics() : undefined;
    const aspect = metrics ? metrics.page.widthMm / metrics.page.heightMm : Math.max(0.05, exportWidth()) / Math.max(1, exportHeight());
    let previewWidth = 640; let previewHeight = previewWidth / aspect;
    if (previewHeight > 400) { previewHeight = 400; previewWidth = previewHeight * aspect; }
    target.width = Math.max(1, Math.round(previewWidth)); target.height = Math.max(1, Math.round(previewHeight));
    const ctx = target.getContext("2d"); if (!ctx) return;
    const pdfPage = metrics && pdfPageSet() !== "current" ? selectedPdfPages()[Math.max(0, Math.min(selectedPdfPages().length - 1, pdfPreviewPage() - 1))] : undefined;
    const selected = pdfPage ? pdfPage.elements : exportScope() === "selection" ? selectedElements() : elements();
    const items = cloneElements(selected).filter(item => !item.hidden);
    const rect = canvas.getBoundingClientRect(); const view = { ...(pdfPage?.canvasState ?? canvasState()) };
    const rawBounds = !pdfPage && exportScope() === "viewport"
      ? { x: -view.panX / view.zoom, y: -view.panY / view.zoom, w: rect.width / view.zoom, h: rect.height / view.zoom }
      : unionBounds(items.map(elementBounds)) ?? { x: 0, y: 0, w: 800, h: 600 };
    const padding = !pdfPage && exportScope() === "viewport" ? 0 : 24;
    const bounds = { x: rawBounds.x - padding, y: rawBounds.y - padding, w: Math.max(1, rawBounds.w + padding * 2), h: Math.max(1, rawBounds.h + padding * 2) };
    const exportViewFor = (width: number, height: number) => { const zoom = Math.min(width / bounds.w, height / bounds.h); return { ...view, zoom, panX: (width - bounds.w * zoom) / 2 - bounds.x * zoom, panY: (height - bounds.h * zoom) / 2 - bounds.y * zoom }; };
    if (metrics) setPdfPreviewPage(value => Math.max(1, Math.min(metrics.pageCount, value)));
    void (async () => {
      const prepare = async (list: Element[]): Promise<void> => { await Promise.all(list.map(async item => { if (item.type === "group") await prepare(item.elements); else if (item.type === "image") { let image = imageCache.get(item.dataUrl); if (!image) { image = new Image(); image.src = item.dataUrl; imageCache.set(item.dataUrl, image); } try { await image.decode(); } catch { /* Keep a preview even if an image cannot be decoded. */ } } })); };
      await prepare(items);
      if (ticket !== exportPreviewVersion || !exportOptionsOpen() || target !== exportPreviewCanvas) return;
      if (!metrics) { drawScene(ctx, target.width, target.height, 1, false, exportTransparent(), exportViewFor(target.width, target.height), items, exportGrid() && !exportTransparent()); return; }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, target.width, target.height); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, target.width, target.height);
      const marginX = target.width * metrics.marginMm / metrics.page.widthMm; const marginY = target.height * metrics.marginMm / metrics.page.heightMm;
      const innerW = Math.max(1, target.width - marginX * 2); const innerH = Math.max(1, target.height - marginY * 2);
      const pageNumber = pdfPreviewPage() - 1;
      if (pdfLayout() === "fit") {
        const content = document.createElement("canvas"); content.width = Math.max(1, Math.round(innerW)); content.height = Math.max(1, Math.round(innerH));
        const contentCtx = content.getContext("2d");
        if (contentCtx) drawScene(contentCtx, content.width, content.height, 1, false, false, exportViewFor(content.width, content.height), items, exportGrid());
        ctx.drawImage(content, marginX, marginY, innerW, innerH);
      } else {
        const source = document.createElement("canvas"); source.width = Math.max(1, Math.floor(exportWidth())); source.height = Math.max(1, Math.floor(exportHeight()));
        const sourceCtx = source.getContext("2d");
        if (sourceCtx) drawScene(sourceCtx, source.width, source.height, 1, false, false, exportViewFor(source.width, source.height), items, exportGrid());
        const xs = pageOffsets(source.width, metrics.innerWidthPx, metrics.stepX); const ys = pageOffsets(source.height, metrics.innerHeightPx, metrics.stepY);
        const column = pageNumber % xs.length; const row = Math.floor(pageNumber / xs.length);
        if (row < ys.length) {
          const sx = xs[column] ?? 0; const sy = ys[row] ?? 0; const cropW = Math.min(metrics.innerWidthPx, source.width - sx); const cropH = Math.min(metrics.innerHeightPx, source.height - sy);
          ctx.drawImage(source, sx, sy, cropW, cropH, marginX, marginY, cropW * innerW / metrics.innerWidthPx, cropH * innerH / metrics.innerHeightPx);
        }
      }
      ctx.strokeStyle = "#d8d8d3"; ctx.lineWidth = 1; ctx.strokeRect(.5, .5, target.width - 1, target.height - 1);
      if (pdfHeader().trim() || pdfFooter().trim()) { ctx.fillStyle = "#343434"; ctx.font = "10px sans-serif"; ctx.textAlign = "left"; if (pdfHeader().trim()) ctx.fillText(pdfHeader(), marginX + 6, Math.max(12, marginY / 2)); if (pdfFooter().trim()) ctx.fillText(pdfFooter(), marginX + 6, target.height - Math.max(6, marginY / 2)); }
      if (pdfCropMarks()) { ctx.strokeStyle = "#222"; ctx.lineWidth = 1; const x=marginX,y=marginY,w=innerW,h=innerH; ctx.beginPath(); [[x-7,y,x-2,y],[x,y-7,x,y-2],[x+w+2,y,x+w+7,y],[x+w,y-7,x+w,y-2],[x-7,y+h,x-2,y+h],[x,y+h+2,x,y+h+7],[x+w+2,y+h,x+w+7,y+h],[x+w,y+h+2,x+w,y+h+7]].forEach(([x1,y1,x2,y2])=>{ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);});ctx.stroke(); }
      if (pdfColorMode() === "grayscale") { const pixels=ctx.getImageData(0,0,target.width,target.height);for(let i=0;i<pixels.data.length;i+=4){const value=Math.round(pixels.data[i]*.2126+pixels.data[i+1]*.7152+pixels.data[i+2]*.0722);pixels.data[i]=value;pixels.data[i+1]=value;pixels.data[i+2]=value;}ctx.putImageData(pixels,0,0); }
    })();
  }

  function imagePdfPages(pages: PdfRasterPage[]): Uint8Array {
    const encoder = new TextEncoder(); const parts: Uint8Array[] = []; const offsets: number[] = []; let size = 0;
    const add = (part: Uint8Array) => { parts.push(part); size += part.length; };
    const ascii = (text: string) => encoder.encode(text);
    const object = (id: number, body: Uint8Array) => { offsets[id] = size; add(ascii(`${id} 0 obj\n`)); add(body); add(ascii("\nendobj\n")); };
    const pageIds = pages.map((_, index) => 4 + index * 3);
    const maxId = 3 + pages.length * 3;
    add(ascii("%PDF-1.4\n%SketchDraw\n"));
    object(1, ascii("<< /Type /Catalog /Pages 2 0 R >>"));
    object(2, ascii(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`));
    object(3, ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"));
    pages.forEach((page, index) => {
      const pageId = pageIds[index]; const imageId = pageId + 1; const contentId = pageId + 2; const imageName = `Im${index}`; const bleed = page.bleedPt;
      const width = page.pageWidth + bleed * 2; const height = page.pageHeight + bleed * 2;
      object(pageId, ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /TrimBox [${bleed} ${bleed} ${bleed + page.pageWidth} ${bleed + page.pageHeight}] /Resources << /Font << /F1 3 0 R >> /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`));
      offsets[imageId] = size; add(ascii(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.imageWidth} /Height ${page.imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Interpolate true /Length ${page.jpeg.length} >>\nstream\n`)); add(page.jpeg); add(ascii("\nendstream\nendobj\n"));
      const escapePdf = (value: string) => value.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7e]/g, "?");
      const header = pdfHeader().trim() ? `BT /F1 9 Tf ${bleed + 18} ${height - bleed - 16} Td (${escapePdf(pdfHeader())}) Tj ET\n` : "";
      const footer = pdfFooter().trim() ? `BT /F1 9 Tf ${bleed + 18} ${bleed + 8} Td (${escapePdf(pdfFooter())}) Tj ET\n` : "";
      const pageNo = `BT /F1 9 Tf ${width - bleed - 52} ${bleed + 8} Td (Page ${index + 1} of ${pages.length}) Tj ET\n`;
      const t = bleed; const marks = pdfCropMarks() ? `0 G .35 w ${t - 7} ${t} m ${t - 2} ${t} l S ${t} ${t - 7} m ${t} ${t - 2} l S ${width - t + 2} ${t} m ${width - t + 7} ${t} l S ${width - t} ${t - 7} m ${width - t} ${t - 2} l S ${t - 7} ${height - t} m ${t - 2} ${height - t} l S ${t} ${height - t + 2} m ${t} ${height - t + 7} l S ${width - t + 2} ${height - t} m ${width - t + 7} ${height - t} l S ${width - t} ${height - t + 2} m ${width - t} ${height - t + 7} l S\n` : "";
      const content = ascii(`q\n${page.drawWidth} 0 0 ${page.drawHeight} ${page.x + bleed} ${page.y + bleed} cm\n/${imageName} Do\nQ\n${header}${footer}${pageNo}${marks}`);
      object(contentId, new Uint8Array([...ascii(`<< /Length ${content.length} >>\nstream\n`), ...content, ...ascii("\nendstream")]));
    });
    const xrefStart = size; let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
    for (let id = 1; id <= maxId; id++) xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    add(ascii(`${xref}trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`));
    const output = new Uint8Array(size); let cursor = 0; for (const part of parts) { output.set(part, cursor); cursor += part.length; } return output;
  }

  async function makeVectorPdf(scenes: { items: Element[]; view: CanvasState }[], output: { widthPt: number; heightPt: number }, marginMm: number) {
    const { PDFDocument, StandardFonts, LineCapStyle, degrees, rgb, cmyk, pushGraphicsState, popGraphicsState, translate, rotateDegrees } = await import("pdf-lib");
    const pdfColor = (color: string, mode: "rgb" | "cmyk" | "grayscale") => { const match=/^#([\da-f]{6})$/i.exec(color);if(!match)return rgb(.12,.12,.12);const channels=[0,2,4].map(i=>parseInt(match[1].slice(i,i+2),16)/255);if(mode==="grayscale"){const gray=channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;return rgb(gray,gray,gray);}if(mode==="cmyk"){const black=1-Math.max(...channels);const divisor=1-black||1;return cmyk((1-channels[0]-black)/divisor,(1-channels[1]-black)/divisor,(1-channels[2]-black)/divisor,black);}return rgb(channels[0],channels[1],channels[2]);};
    const doc = await PDFDocument.create();
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica); const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique); const fontBoldItalic = await doc.embedFont(StandardFonts.HelveticaBoldOblique); const fontMono = await doc.embedFont(StandardFonts.Courier);
    const fontSerif = await doc.embedFont(StandardFonts.TimesRoman); const fontSerifBold = await doc.embedFont(StandardFonts.TimesRomanBold); const fontSerifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic); const fontSerifBoldItalic = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);
    const grayscale = pdfColorMode() === "grayscale"; const bleed = Math.max(0, Math.min(20, pdfBleedMm())) * 72 / 25.4; const margin = marginMm * 72 / 25.4; textMeasureContext ??= document.createElement("canvas").getContext("2d");
    const paperW = output.widthPt + bleed * 2; const paperH = output.heightPt + bleed * 2;
    const readImage = async (element: ImageElement) => {
      let image = imageCache.get(element.dataUrl);
      if (!image) { image = new Image(); image.src = element.dataUrl; imageCache.set(element.dataUrl, image); }
      await image.decode();
      const cropX=element.cropX??0,cropY=element.cropY??0,cropW=element.cropW??image.naturalWidth,cropH=element.cropH??image.naturalHeight; const cropped=cropX!==0||cropY!==0||cropW!==image.naturalWidth||cropH!==image.naturalHeight; if(grayscale||cropped){const gray=document.createElement("canvas");gray.width=Math.max(1,Math.round(cropW));gray.height=Math.max(1,Math.round(cropH));const context=gray.getContext("2d");if(context){context.drawImage(image,cropX,cropY,cropW,cropH,0,0,gray.width,gray.height);if(grayscale){const pixels=context.getImageData(0,0,gray.width,gray.height);for(let i=0;i<pixels.data.length;i+=4){const value=Math.round(pixels.data[i]*.2126+pixels.data[i+1]*.7152+pixels.data[i+2]*.0722);pixels.data[i]=value;pixels.data[i+1]=value;pixels.data[i+2]=value;}context.putImageData(pixels,0,0);}const blob=await new Promise<Blob>((resolve,reject)=>gray.toBlob(value=>value?resolve(value):reject(new Error("Could not prepare an imported image for PDF.")),"image/png"));return doc.embedPng(new Uint8Array(await blob.arrayBuffer()));}}
      const data = element.dataUrl.slice(0, element.dataUrl.indexOf(",")); const bytes = Uint8Array.from(atob(element.dataUrl.slice(element.dataUrl.indexOf(",") + 1)), char => char.charCodeAt(0));
      if (data.includes("image/png")) return doc.embedPng(bytes);
      if (data.includes("image/jpeg")) return doc.embedJpg(bytes);
      const temp = document.createElement("canvas"); temp.width = image.naturalWidth; temp.height = image.naturalHeight; temp.getContext("2d")!.drawImage(image, 0, 0); const blob = await new Promise<Blob>((resolve, reject) => temp.toBlob(value => value ? resolve(value) : reject(new Error("Could not encode an imported image for PDF.")), "image/png")); return doc.embedPng(new Uint8Array(await blob.arrayBuffer()));
    };
    const pathStyle = (page: import("pdf-lib").PDFPage, path: string, element: ShapeElement, scale: number, originX: number, originY: number, fill?: string, fillAlpha?: number) => {
      const dash = element.lineStyle === "dashed" ? [element.thickness * scale * 4, element.thickness * scale * 2.5] : element.lineStyle === "dotted" ? [element.thickness * scale, element.thickness * scale * 2.2] : undefined;
      const centerX=originX+(element.x+element.w/2)*scale; const centerY=originY-(element.y+element.h/2)*scale; const rotated=!!element.rotation;
      if(rotated)page.pushOperators(pushGraphicsState(),translate(centerX,centerY),rotateDegrees(-(element.rotation??0)),translate(-centerX,-centerY));
      page.drawSvgPath(path, { x: originX, y: originY, scale, color: fill ? pdfColor(fill, pdfColorMode()) : undefined, opacity: fill ? fillAlpha ?? (element.opacity ?? 1) * (element.fillOpacity ?? .2) : 1, borderColor: pdfColor(themeInk(element.color, theme()), pdfColorMode()), borderWidth: element.thickness * scale, borderOpacity: element.opacity ?? 1, borderDashArray: dash, borderLineCap: LineCapStyle.Round });
      if(rotated)page.pushOperators(popGraphicsState());
    };
    for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
      const scene = scenes[sceneIndex]; const visible = scene.items.filter(item => !item.hidden); const raw = unionBounds(visible.map(elementBounds)) ?? { x: 0, y: 0, w: 800, h: 600 }; const padding = 24; const bounds = { x: raw.x - padding, y: raw.y - padding, w: Math.max(1, raw.w + padding * 2), h: Math.max(1, raw.h + padding * 2) };
      const usableW = output.widthPt - margin * 2; const usableH = output.heightPt - margin * 2; const scale = Math.max(.001, Math.min(usableW / bounds.w, usableH / bounds.h)); const x0 = bleed + margin - bounds.x * scale; const yTop = paperH - bleed - margin + bounds.y * scale;
      const page = doc.addPage([paperW, paperH]); page.setTrimBox(bleed, bleed, output.widthPt, output.heightPt); page.setBleedBox(0, 0, paperW, paperH);
      const drawText = (text: string, x: number, y: number, color: string, size: number, family: FontFamily | undefined, bold: boolean, italic: boolean, opacity: number, rotation = 0, rotationCenter?: Point, align: TextElement["textAlign"] = "left") => {
        const font = family === "mono" ? fontMono : family === "serif" ? bold && italic ? fontSerifBoldItalic : bold ? fontSerifBold : italic ? fontSerifItalic : fontSerif : family === "hand" ? bold ? fontBoldItalic : fontItalic : bold && italic ? fontBoldItalic : bold ? fontBold : italic ? fontItalic : fontRegular;
        let tx=x,ty=y;const textWidth=font.widthOfTextAtSize(text,size*scale)/scale;if(align==="center")tx-=textWidth/2;else if(align==="right")tx-=textWidth;if(rotation&&rotationCenter){const angle=rotation*Math.PI/180,dx=tx-rotationCenter.x,dy=y-rotationCenter.y;tx=rotationCenter.x+dx*Math.cos(angle)-dy*Math.sin(angle);ty=rotationCenter.y+dx*Math.sin(angle)+dy*Math.cos(angle);}
        page.drawText(text.replace(/[^\x20-\xff]/g, "?"), { x: x0 + tx * scale, y: paperH - (bleed + margin + (ty - bounds.y) * scale) - size * scale, size: size * scale, font, color: pdfColor(themeInk(color, theme()), pdfColorMode()), opacity, rotate: degrees(-rotation) });
      };
      const drawItem = async (element: Element): Promise<void> => {
        if (element.hidden) return;
        if (element.type === "group") { for (const child of element.elements) await drawItem(child); return; }
        if (element.type === "image") { try { const embedded = await readImage(element); const cropX = element.cropX ?? 0; const cropY = element.cropY ?? 0; const cropW = element.cropW ?? element.sourceWidth ?? element.w; const cropH = element.cropH ?? element.sourceHeight ?? element.h; void cropX; void cropY; void cropW; void cropH; const centerX=x0+(element.x+element.w/2)*scale,centerY=paperH-(bleed+margin+(element.y+element.h/2-bounds.y)*scale),rotated=!!element.rotation;if(rotated)page.pushOperators(pushGraphicsState(),translate(centerX,centerY),rotateDegrees(-(element.rotation??0)),translate(-centerX,-centerY));page.drawImage(embedded, { x: x0 + element.x * scale, y: paperH - (bleed + margin + (element.y - bounds.y + element.h) * scale), width: element.w * scale, height: element.h * scale, opacity: element.opacity ?? 1 });if(rotated)page.pushOperators(popGraphicsState()); } catch { /* Keep other vector content even if an embedded image cannot be decoded. */ } return; }
        if (element.type === "text") { const lines = element.text.split(/\r?\n/).map((line,index)=>element.listType==="bullet"?`• ${line}`:element.listType==="number"?`${index+1}. ${line}`:line); const textBox=elementBounds(element); const center={x:textBox.x+textBox.w/2,y:textBox.y+textBox.h/2}; lines.forEach((line, index) => drawText(line, element.x, element.y + index * element.fontSize * 1.25, element.color, element.fontSize, element.fontFamily, !!element.bold, !!element.italic, element.opacity ?? 1, element.rotation ?? 0, center, element.textAlign)); if (element.underline) { const font = element.fontFamily === "mono" ? fontMono : element.fontFamily === "serif" ? fontSerif : element.fontFamily === "hand" || element.italic ? fontItalic : element.bold ? fontBold : fontRegular; const width = font.widthOfTextAtSize(lines[0] ?? "", element.fontSize) * scale; page.drawLine({ start: { x: x0 + element.x * scale, y: paperH - (bleed + margin + (element.y + element.fontSize) * scale) }, end: { x: x0 + element.x * scale + width, y: paperH - (bleed + margin + (element.y + element.fontSize) * scale) }, thickness: Math.max(.5, scale), color: pdfColor(themeInk(element.color, theme()), pdfColorMode()) }); } return; }
        if (element.type === "freehand") {
          if (element.points.length < 2) return;
          const points = element.points;
          if (points.some(point => point.pressure !== undefined || point.tiltX !== undefined || point.tiltY !== undefined)) {
            const box = elementBounds(element); const centerX = x0 + (box.x + box.w / 2) * scale; const centerY = yTop - (box.y + box.h / 2) * scale; const rotated = !!element.rotation;
            if (rotated) page.pushOperators(pushGraphicsState(), translate(centerX, centerY), rotateDegrees(-(element.rotation ?? 0)), translate(-centerX, -centerY));
            const ink = pdfColor(themeInk(element.color, theme()), pdfColorMode());
            for (let index = 1; index < points.length; index++) { const a = points[index - 1]; const b = points[index]; const width = (stylusStrokeWidth(a, element.thickness) + stylusStrokeWidth(b, element.thickness)) / 2; page.drawSvgPath(`M ${a.x} ${a.y} L ${b.x} ${b.y}`, { x: x0, y: yTop, scale, borderColor: ink, borderWidth: width * scale, borderOpacity: element.opacity ?? 1, borderLineCap: LineCapStyle.Round }); }
            if (rotated) page.pushOperators(popGraphicsState()); return;
          }
          let d = `M ${points[0].x} ${points[0].y}`;
          for (let i=1;i<points.length;i++){const a=points[i-1],b=points[i];const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};d+=` Q ${a.x} ${a.y} ${mid.x} ${mid.y}`;} const last=points[points.length-1];d+=` L ${last.x} ${last.y}`;
          const box = elementBounds(element); const centerX = x0 + (box.x + box.w / 2) * scale; const centerY = yTop - (box.y + box.h / 2) * scale; const rotated = !!element.rotation;
          if (rotated) page.pushOperators(pushGraphicsState(), translate(centerX, centerY), rotateDegrees(-(element.rotation ?? 0)), translate(-centerX, -centerY));
          const ink = pdfColor(themeInk(element.color, theme()), pdfColorMode());
          page.drawSvgPath(d, { x: x0, y: yTop, scale, borderColor: ink, borderWidth: element.thickness * scale, borderOpacity: element.opacity ?? 1, borderLineCap: LineCapStyle.Round });
          if (rotated) page.pushOperators(popGraphicsState()); return;
        }
        const x=element.x,y=element.y,w=element.w,h=element.h; let path="";
        if(element.type==="rectangle") { const l=Math.min(x,x+w),t=Math.min(y,y+h),ww=Math.abs(w),hh=Math.abs(h); const r=element.edgeStyle==="pill"?Math.min(ww,hh)/2:element.edgeStyle==="rounded"?Math.min(element.cornerRadius??14,ww/2,hh/2):0; const c=Math.min(element.cornerRadius??12,ww/2,hh/2); path=element.edgeStyle==="cut"?`M ${l+c} ${t} H ${l+ww-c} L ${l+ww} ${t+c} V ${t+hh-c} L ${l+ww-c} ${t+hh} H ${l+c} L ${l} ${t+hh-c} V ${t+c} Z`:r?`M ${l+r} ${t} H ${l+ww-r} Q ${l+ww} ${t} ${l+ww} ${t+r} V ${t+hh-r} Q ${l+ww} ${t+hh} ${l+ww-r} ${t+hh} H ${l+r} Q ${l} ${t+hh} ${l} ${t+hh-r} V ${t+r} Q ${l} ${t} ${l+r} ${t} Z`:`M ${l} ${t} H ${l+ww} V ${t+hh} H ${l} Z`; }
        else if(element.type==="circle"){const cx=x+w/2,cy=y+h/2,rx=Math.abs(w)/2,ry=Math.abs(h)/2,k=.55228475;path=`M ${cx+rx} ${cy} C ${cx+rx} ${cy+k*ry} ${cx+k*rx} ${cy+ry} ${cx} ${cy+ry} C ${cx-k*rx} ${cy+ry} ${cx-rx} ${cy+k*ry} ${cx-rx} ${cy} C ${cx-rx} ${cy-k*ry} ${cx-k*rx} ${cy-ry} ${cx} ${cy-ry} C ${cx+k*rx} ${cy-ry} ${cx+rx} ${cy-k*ry} ${cx+rx} ${cy} Z`; }
        else if(element.type==="diamond")path=`M ${x+w/2} ${y} L ${x+w} ${y+h/2} L ${x+w/2} ${y+h} L ${x} ${y+h/2} Z`;
        else if(element.type==="triangle"){const l=Math.min(x,x+w),r=Math.max(x,x+w),t=Math.min(y,y+h),b=Math.max(y,y+h);path=`M ${(l+r)/2} ${t} L ${r} ${b} L ${l} ${b} Z`;}
        else if(element.type==="flowchart")path=vectorFlowchartPath(element);
        else {
          const route = element.type === "arrow" ? element.arrowRoute ?? "straight" : element.lineRoute ?? "straight";
          path = connectorSvgPath(element);
          if (element.lineStyle === "double") {
            const normal = { x: -h / Math.max(1, Math.hypot(w, h)), y: w / Math.max(1, Math.hypot(w, h)) };
            const offset = Math.max(2.5, element.thickness * 1.2);
            for (const side of [-1, 1]) {
              const shifted = path.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_match, a, b) => `${Number(a) + normal.x * offset * side} ${Number(b) + normal.y * offset * side}`);
              pathStyle(page, shifted, element, scale, x0, yTop);
            }
          } else pathStyle(page, path, element, scale, x0, yTop);
          if (element.type === "arrow" || element.type === "line") for (const head of arrowHeadEntries(element, route)) {
            const radius = Math.max(3, element.thickness * 1.15);
            if (head.kind === "dot") {
              page.drawEllipse({ x: bleed + margin + (head.tip.x - bounds.x) * scale, y: paperH - bleed - margin - (head.tip.y - bounds.y) * scale, xScale: radius * scale, yScale: radius * scale, color: pdfColor(themeInk(element.color, theme()), pdfColorMode()), opacity: element.opacity ?? 1 });
              continue;
            }
            const headPath = arrowHeadSvgPath(head.tip, head.angle, head.kind, element.thickness);
            if (!headPath) continue;
            const filled = ["solid", "thick", "diamond"].includes(head.kind);
            pathStyle(page, headPath, element, scale, x0, yTop, filled ? themeInk(element.color, theme()) : undefined, element.opacity ?? 1);
          }
          if (isLabelShape(element)) drawShapeLabel(element, drawText);
          return;
        }
        if(path)pathStyle(page,path,element,scale,x0,yTop,element.fillColor);
        if(element.type==="flowchart"&&element.flowchartShape==="database"){const detail=flowchartSvgDetailPath(element);if(detail)pathStyle(page,detail,element,scale,x0,yTop);}
        if(isLabelShape(element))drawShapeLabel(element,drawText);
      };
      const drawShapeLabel=(shape:ShapeElement,draw:(text:string,x:number,y:number,color:string,size:number,family:FontFamily|undefined,bold:boolean,italic:boolean,opacity:number,rotation?:number,rotationCenter?:Point)=>void)=>{if(!shape.label||!textMeasureContext)return;const bounds=elementBounds(shape),center={x:bounds.x+bounds.w/2,y:bounds.y+bounds.h/2};for(const run of textLayout(textMeasureContext,shape))draw(run.text,run.x,run.y,shape.label.color,shape.label.fontSize,shape.label.fontFamily,!!shape.label.bold,!!shape.label.italic,shape.label.opacity??1,shape.rotation??0,center);};
      for(const item of visible)await drawItem(item);
      if(pdfHeader().trim())page.drawText(pdfHeader(),{x:bleed+margin,y:paperH-bleed-margin+4,size:9,font:fontBold,color:pdfColor("#333333",pdfColorMode())});
      if(pdfFooter().trim())page.drawText(pdfFooter(),{x:bleed+margin,y:bleed+margin/2,size:9,font:fontRegular,color:pdfColor("#333333",pdfColorMode())});
      page.drawText(`Page ${sceneIndex+1} of ${scenes.length}`,{x:paperW-bleed-margin-56,y:bleed+margin/2,size:9,font:fontRegular,color:pdfColor("#333333",pdfColorMode())});
      if(pdfCropMarks()){const t=bleed;const marks:{start:{x:number;y:number};end:{x:number;y:number}}[]=[{start:{x:t-7,y:t},end:{x:t-2,y:t}},{start:{x:t,y:t-7},end:{x:t,y:t-2}},{start:{x:paperW-t+2,y:t},end:{x:paperW-t+7,y:t}},{start:{x:paperW-t,y:t-7},end:{x:paperW-t,y:t-2}},{start:{x:t-7,y:paperH-t},end:{x:t-2,y:paperH-t}},{start:{x:t,y:paperH-t+2},end:{x:t,y:paperH-t+7}},{start:{x:paperW-t+2,y:paperH-t},end:{x:paperW-t+7,y:paperH-t}},{start:{x:paperW-t,y:paperH-t+2},end:{x:paperW-t,y:paperH-t+7}}];for(const mark of marks)page.drawLine({...mark,thickness:.35,color:rgb(0,0,0)});}
    }
    return doc.save();
  }

  async function exportAs(format: "png" | "svg" | "pdf") {
    if (!canvas || nativeBusy() || documentBusy()) return;
    setNativeBusy(true);
    try {
      if ((!Number.isFinite(exportWidth()) || !Number.isFinite(exportHeight()) || exportWidth() < 1 || exportHeight() < 1 || exportWidth() > 12000 || exportHeight() > 12000 || exportWidth() * exportHeight() > 60_000_000)) throw new Error("Choose dimensions between 1 and 12,000 pixels, totaling no more than 60 megapixels.");
      commitTextDraft();
      const exportItems = cloneElements(exportScope() === "selection" ? selectedElements() : elements()).filter(item => !item.hidden);
      if (exportScope() === "selection" && !exportItems.length) throw new Error("Select one or more visible objects to export.");
      if (format === "pdf" && pdfPageSet() !== "current" && !selectedPdfPages().length) throw new Error("There are no sketch pages in the selected export range.");
      const rect = canvas.getBoundingClientRect(); const view = { ...canvasState() };
      const prepareImages = async (items: Element[]): Promise<void> => { await Promise.all(items.map(async item => { if (item.type === "group") await prepareImages(item.elements); else if (item.type === "image") { let bitmap = imageCache.get(item.dataUrl); if (!bitmap) { bitmap = new Image(); bitmap.src = item.dataUrl; imageCache.set(item.dataUrl, bitmap); } await bitmap.decode(); } })); };
      await prepareImages(format === "pdf" && pdfPageSet() !== "current" ? selectedPdfPages().flatMap(page => page.elements) : exportItems);
      const rawBounds = exportScope() === "viewport" ? { x: -view.panX / view.zoom, y: -view.panY / view.zoom, w: rect.width / view.zoom, h: rect.height / view.zoom } : unionBounds(exportItems.map(elementBounds)) ?? { x: 0, y: 0, w: 800, h: 600 };
      const padding = exportScope() === "viewport" ? 0 : 24;
      const bounds = { x: rawBounds.x - padding, y: rawBounds.y - padding, w: Math.max(1, rawBounds.w + padding * 2), h: Math.max(1, rawBounds.h + padding * 2) };
      const exportViewFor = (width: number, height: number) => { const zoom = Math.min(width / bounds.w, height / bounds.h); return { ...view, zoom, panX: (width - bounds.w * zoom) / 2 - bounds.x * zoom, panY: (height - bounds.h * zoom) / 2 - bounds.y * zoom }; };
      const exportViewForPage = (items: Element[], width: number, height: number, pageView: CanvasState) => { const pageBounds = unionBounds(items.map(elementBounds)) ?? { x: 0, y: 0, w: 800, h: 600 }; const pagePadding = 24; const content = { x: pageBounds.x - pagePadding, y: pageBounds.y - pagePadding, w: Math.max(1, pageBounds.w + pagePadding * 2), h: Math.max(1, pageBounds.h + pagePadding * 2) }; const zoom = Math.min(width / content.w, height / content.h); return { ...pageView, zoom, panX: (width - content.w * zoom) / 2 - content.x * zoom, panY: (height - content.h * zoom) / 2 - content.y * zoom }; };
      const path = await save({ title: `Export SketchDraw as ${format.toUpperCase()}`, defaultPath: `SketchDraw.${format}`, filters: [{ name: format.toUpperCase(), extensions: [format] }] });
      if (!path) return;
      const target = path.toLowerCase().endsWith(`.${format}`) ? path : `${path}.${format}`;

      if (format === "pdf") {
        const metrics = pdfMetrics();
        if (metrics.pageCount > 1000) throw new Error("This layout would create more than 1,000 PDF pages. Increase the page size, reduce the artwork dimensions, or lower the overlap.");
        if (metrics.innerWidthPx * metrics.innerHeightPx > 60_000_000 || (pdfLayout() === "tiled" && exportWidth() * exportHeight() > 60_000_000)) throw new Error("PDF raster dimensions exceed 60 megapixels. Reduce the page DPI or artwork size.");
        if (metrics.pageCount * metrics.innerWidthPx * metrics.innerHeightPx > 240_000_000) throw new Error("This PDF would exceed the 240-megapixel output budget. Lower print quality, reduce the page count, or use a smaller paper size.");
        if (pdfLayout() === "fit") {
          const scenes = pdfPageSet() === "current" ? [{ items: exportItems, view }] : selectedPdfPages().map(page => ({ items: cloneElements(page.elements).filter(item => !item.hidden), view: page.canvasState }));
          await writeFile(target, await makeVectorPdf(scenes, { widthPt: metrics.page.widthPt, heightPt: metrics.page.heightPt }, metrics.marginMm));
          return;
        }
        const marginPt = metrics.marginMm * 72 / 25.4;
        const toJpeg = async (source: HTMLCanvasElement): Promise<Uint8Array> => {
          if (pdfColorMode() === "grayscale") {
            const ctx = source.getContext("2d");
            if (ctx) { const image = ctx.getImageData(0, 0, source.width, source.height); for (let i = 0; i < image.data.length; i += 4) { const gray = Math.round(image.data[i] * .2126 + image.data[i + 1] * .7152 + image.data[i + 2] * .0722); image.data[i] = gray; image.data[i + 1] = gray; image.data[i + 2] = gray; } ctx.putImageData(image, 0, 0); }
          }
          const blob = await new Promise<Blob>((resolve, reject) => source.toBlob(value => value ? resolve(value) : reject(new Error("PDF page image encoding failed.")), "image/jpeg", .94));
          return new Uint8Array(await blob.arrayBuffer());
        };
        const rasterPages: PdfRasterPage[] = [];
        if (pdfLayout() === "fit") {
          const scenes = pdfPageSet() !== "current" ? selectedPdfPages().map(page => ({ items: cloneElements(page.elements).filter(item => !item.hidden), view: page.canvasState })) : [{ items: exportItems, view }];
          for (const scene of scenes) {
            const output = document.createElement("canvas"); output.width = metrics.innerWidthPx; output.height = metrics.innerHeightPx;
            const ctx = output.getContext("2d"); if (!ctx) throw new Error("Could not create a PDF page image.");
            const pageView = pdfPageSet() !== "current" ? exportViewForPage(scene.items, output.width, output.height, scene.view) : exportViewFor(output.width, output.height);
            drawScene(ctx, output.width, output.height, 1, false, false, pageView, scene.items, exportGrid());
            rasterPages.push({ jpeg: await toJpeg(output), imageWidth: output.width, imageHeight: output.height, pageWidth: metrics.page.widthPt, pageHeight: metrics.page.heightPt, x: marginPt, y: marginPt, drawWidth: output.width * 72 / metrics.dpi, drawHeight: output.height * 72 / metrics.dpi, bleedPt: pdfBleedMm() * 72 / 25.4, grayscale: pdfColorMode() === "grayscale" });
          }
        } else {
          const source = document.createElement("canvas"); source.width = Math.floor(exportWidth()); source.height = Math.floor(exportHeight());
          const sourceCtx = source.getContext("2d"); if (!sourceCtx) throw new Error("Could not create the tiled PDF source image.");
          drawScene(sourceCtx, source.width, source.height, 1, false, false, exportViewFor(source.width, source.height), exportItems, exportGrid());
          const xs = pageOffsets(source.width, metrics.innerWidthPx, metrics.stepX); const ys = pageOffsets(source.height, metrics.innerHeightPx, metrics.stepY);
          for (const y of ys) for (const x of xs) {
            const width = Math.min(metrics.innerWidthPx, source.width - x); const height = Math.min(metrics.innerHeightPx, source.height - y);
            const tile = document.createElement("canvas"); tile.width = width; tile.height = height;
            const tileCtx = tile.getContext("2d"); if (!tileCtx) throw new Error("Could not create a tiled PDF page.");
            tileCtx.drawImage(source, x, y, width, height, 0, 0, width, height);
            rasterPages.push({ jpeg: await toJpeg(tile), imageWidth: width, imageHeight: height, pageWidth: metrics.page.widthPt, pageHeight: metrics.page.heightPt, x: marginPt, y: marginPt, drawWidth: width * 72 / metrics.dpi, drawHeight: height * 72 / metrics.dpi, bleedPt: pdfBleedMm() * 72 / 25.4, grayscale: pdfColorMode() === "grayscale" });
          }
        }
        await writeFile(target, imagePdfPages(rasterPages));
      } else if (format === "png") {
        const width = Math.max(1, Math.min(12000, Math.floor(exportWidth()))); const height = Math.max(1, Math.min(12000, Math.floor(exportHeight())));
        if (width * height > 60_000_000) throw new Error("Export is too large. Choose dimensions totaling no more than 60 megapixels.");
        const output = document.createElement("canvas"); output.width = width; output.height = height;
        const ctx = output.getContext("2d"); if (!ctx) throw new Error("Could not create PNG image.");
        drawScene(ctx, width, height, 1, false, exportTransparent(), exportViewFor(width, height), exportItems, exportGrid());
        const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(value => value ? resolve(value) : reject(new Error("PNG image encoding failed.")), "image/png"));
        await writeFile(target, new Uint8Array(await blob.arrayBuffer()));
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
      const family = fontCss(element.fontFamily);
      const lines = element.text.split(/\r?\n/).map((line, index) => { const formatted = element.listType === "bullet" ? `• ${line}` : element.listType === "number" ? `${index + 1}. ${line}` : line; return `<tspan x="${element.x}" dy="${index === 0 ? 0 : element.fontSize * 1.25}">${escapeXml(formatted)}</tspan>`; }).join("");
      return `<text x="${element.x}" y="${element.y + element.fontSize}" fill="${escapeXml(themeInk(element.color, theme()))}" opacity="${element.opacity ?? 1}" font-size="${element.fontSize}" font-family="${family}" font-weight="${element.bold ? "700" : "400"}" font-style="${element.italic ? "italic" : "normal"}" text-decoration="${element.underline ? "underline" : "none"}" text-anchor="${element.textAlign === "center" ? "middle" : element.textAlign === "right" ? "end" : "start"}">${lines}</text>`;
    }
    const fillColor = "fillColor" in element ? element.fillColor : undefined;
    const dash = "lineStyle" in element && element.lineStyle === "dashed" ? `${element.thickness * 4} ${element.thickness * 2.5}` : "lineStyle" in element && element.lineStyle === "dotted" ? `${element.thickness} ${element.thickness * 2.2}` : "";
    const fillOpacity = "fillOpacity" in element ? element.fillOpacity ?? 0.2 : 0.2;
    const ink = themeInk(element.color, theme());
    const strokeWidth = element.thickness;
    const strokeOpacity = element.opacity ?? 1;
    const style = `fill="${fillColor ? escapeXml(fillColor) : "none"}"${fillColor ? ` fill-opacity="${fillOpacity}"` : ""} stroke="${escapeXml(ink)}" opacity="${strokeOpacity}" stroke-width="${strokeWidth}" stroke-dasharray="${dash}" stroke-linecap="round" stroke-linejoin="round"`;
    if (element.type === "freehand") {
      if (!element.points.length) return "";
      const points = element.points;
      if (points.some(point => point.pressure !== undefined || point.tiltX !== undefined || point.tiltY !== undefined)) {
        const ink = escapeXml(themeInk(element.color, theme())); const marks = points.map((point, index) => {
          const width = stylusStrokeWidth(point, element.thickness); const tilt = Math.min(1, Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0) / 90); const angle = Math.atan2(point.tiltY ?? 0, point.tiltX ?? 0) * 180 / Math.PI;
          const stamp = `<ellipse cx="${point.x}" cy="${point.y}" rx="${Math.max(.25, width * (.5 + tilt * .35))}" ry="${Math.max(.25, width * .5)}" transform="rotate(${angle} ${point.x} ${point.y})" fill="${ink}" opacity="${strokeOpacity}"/>`;
          if (index === 0) return stamp;
          const previous = points[index - 1]; const segmentWidth = (stylusStrokeWidth(previous, element.thickness) + width) / 2;
          return `<path d="M ${previous.x} ${previous.y} L ${point.x} ${point.y}" fill="none" stroke="${ink}" opacity="${strokeOpacity}" stroke-width="${segmentWidth}" stroke-linecap="round"/>${stamp}`;
        }).join("");
        return `<g>${marks}</g>`;
      }
      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]; const b = points[i]; const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        d += ` Q ${a.x} ${a.y} ${mid.x} ${mid.y}`;
      }
      const last = points[points.length - 1]; d += ` L ${last.x} ${last.y}`;
      return `<path d="${d}" ${style}/>`;
    }
    if (element.type === "rectangle") { const width = Math.abs(element.w); const height = Math.abs(element.h); const radius = element.edgeStyle === "pill" ? Math.min(width, height) / 2 : element.edgeStyle === "rounded" ? Math.min(element.cornerRadius ?? 14, width / 2, height / 2) : 0; if (element.edgeStyle === "cut") { const x = Math.min(element.x, element.x + element.w); const y = Math.min(element.y, element.y + element.h); const c = Math.min(element.cornerRadius ?? 12, width / 2, height / 2); return `<path d="M ${x + c} ${y} H ${x + width - c} L ${x + width} ${y + c} V ${y + height - c} L ${x + width - c} ${y + height} H ${x + c} L ${x} ${y + height - c} V ${y + c} Z" ${style}/>`; } return `<rect x="${Math.min(element.x, element.x + element.w)}" y="${Math.min(element.y, element.y + element.h)}" width="${width}" height="${height}" rx="${radius}" ${style}/>`; }
    if (element.type === "diamond") return `<path d="M ${element.x + element.w / 2} ${element.y} L ${element.x + element.w} ${element.y + element.h / 2} L ${element.x + element.w / 2} ${element.y + element.h} L ${element.x} ${element.y + element.h / 2} Z" ${style}/>`;
    if (element.type === "triangle") { const left = Math.min(element.x, element.x + element.w); const right = Math.max(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const bottom = Math.max(element.y, element.y + element.h); return `<path d="M ${(left + right) / 2} ${top} L ${right} ${bottom} L ${left} ${bottom} Z" ${style}/>`; }
    if (element.type === "circle") return `<ellipse cx="${element.x + element.w / 2}" cy="${element.y + element.h / 2}" rx="${Math.abs(element.w / 2)}" ry="${Math.abs(element.h / 2)}" ${style}/>`;
    if (element.type === "flowchart") {
      const detail = flowchartSvgDetailPath(element);
      const detailStyle = `fill="none" stroke="${escapeXml(ink)}" opacity="${element.opacity ?? 1}" stroke-width="${element.thickness}" stroke-dasharray="${dash}" stroke-linecap="round" stroke-linejoin="round"`;
      return `<path d="${flowchartSvgPath(element)}" ${style}/>${detail ? `<path d="${detail}" ${detailStyle}/>` : ""}`;
    }
    if (element.type === "line" || element.type === "arrow") {
      const path = connectorSvgPath(element); const route = element.type === "arrow" ? element.arrowRoute ?? "straight" : element.lineRoute ?? "straight";
      const shift = element.lineStyle === "double" ? Math.max(2.5, element.thickness * 1.2) : 0; const normal = { x: -element.h / Math.max(1, Math.hypot(element.w, element.h)), y: element.w / Math.max(1, Math.hypot(element.w, element.h)) };
      const paths = shift ? `<path d="${path}" transform="translate(${normal.x * shift} ${normal.y * shift})" ${style}/><path d="${path}" transform="translate(${-normal.x * shift} ${-normal.y * shift})" ${style}/>` : `<path d="${path}" ${style}/>`;
      const headSvg = (tip: Point, direction: number, kind: ArrowHead) => {
        if (kind === "none") return "";
        if (kind === "dot") return `<circle cx="${tip.x}" cy="${tip.y}" r="${Math.max(3, element.thickness * 1.15)}" fill="${ink}" opacity="${element.opacity ?? 1}"/>`;
        const points = arrowHeadPoints(tip, direction, kind, element.thickness); const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");
        if (kind === "solid" || kind === "thick" || kind === "diamond") return `<polygon points="${polygon}" fill="${ink}" stroke="${ink}" stroke-width="${element.thickness}" opacity="${element.opacity ?? 1}"/>`;
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
    if (noteEditor()) saveNoteEditor();
    setContextMenu(undefined); penEraserDrawing = false;
    if (textDraft()) { commitTextDraft(); if (tool() === "text") return; }
    if (event.button === 1 || spaceDown() || tool() === "pan") {
      event.preventDefault(); setIsPanning(true); panOrigin = { x: event.clientX, y: event.clientY, panX: canvasState().panX, panY: canvasState().panY }; canvas.setPointerCapture(event.pointerId); return;
    }
    const isPenEraser = penEraser() && event.pointerType === "pen" && (event.button === 5 || (event.buttons & 32) !== 0);
    if (event.button !== 0 && !isPenEraser) return;
    const point = toWorld(event);
    if (boardLocked()) return;
    if (isPenEraser) { event.preventDefault(); penEraserDrawing = true; drawing = true; eraseAtPoint(point); canvas.setPointerCapture(event.pointerId); return; }
    if (tool() === "select") {
      const handle = findTransformHandle(point);
      if (handle) { const original = elements()[handle.index]; resizeOrigin = { ...handle, start: point, original: cloneElements([original])[0], before: cloneElements(elements()), moved: false }; canvas.setPointerCapture(event.pointerId); return; }
      const hit = hitTest(point);
      if (hit !== undefined) {
        const target = elements()[hit];
        if (target?.type === "group" && target.note && noteCollapseHit(target, point)) { toggleNoteCollapsed(hit); canvas.setPointerCapture(event.pointerId); return; }
        if (target?.type === "group" && target.note?.kind === "checklist") {
          const row = checklistIndexAt(target, point);
          if (row !== undefined) { toggleChecklist(hit, row); canvas.setPointerCapture(event.pointerId); return; }
        }
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
    if (tool() === "line" || tool() === "arrow") {
      const handle = findTransformHandle(point);
      if (handle && isConnector(elements()[handle.index])) {
        const original = elements()[handle.index];
        resizeOrigin = { ...handle, start: point, original: cloneElements([original])[0], before: cloneElements(elements()), moved: false };
        canvas.setPointerCapture(event.pointerId); return;
      }
    }
    if (tool() === "text") {
      if (textDraft()) { commitTextDraft(); return; }
      const activeTextMode = textMode();
      if (activeTextMode !== "text") {
        const hit = hitTest(point); const element = hit === undefined ? undefined : elements()[hit];
        if (element?.type === "group" && element.note?.kind === activeTextMode) openNoteEditor(point, element.note.kind, hit);
        else openNoteEditor(point, activeTextMode);
        return;
      }
      const hit = hitTest(point) ?? hitInterior(point); if (hit !== undefined && isLabelShape(elements()[hit])) editShapeLabel(hit); else startTextDraft(point, hit !== undefined && elements()[hit]?.type === "text" ? hit : undefined); return;
    }
    if (tool() === "bucket") { const hit = hitInterior(point); if (hit !== undefined) updatePropertyForIndex(hit, fillColor()); return; }
    if (tool() === "eraser") { eraseAtPoint(point); drawing = true; canvas.setPointerCapture(event.pointerId); return; }
    if (tool() === "crop") { const hit = hitTest(point); if (hit !== undefined && elements()[hit].type === "image") { setSelectedIndices([hit]); marqueeOrigin = { point, additive: false, moved: false, cropIndex: hit }; setMarquee({ start: point, end: point }); canvas.setPointerCapture(event.pointerId); } return; }
    drawing = true; canvas.setPointerCapture(event.pointerId);
    activeDrawingTool = tool() === "laser" ? "pen" : tool() as Preview["type"];
    const start = activeDrawingTool === "line" || activeDrawingTool === "arrow" ? nearestBinding(elements(), point, 18 / canvasState().zoom)?.point ?? snap(point) : activeDrawingTool === "pen" ? point : snap(point);
    if (activeDrawingTool === "pen") { const strokePoint = tool() === "pen" ? strokePointFromPointer(event, point) : point; currentPoints = [strokePoint]; setPreview({ type: "pen", start: point, end: point, color: tool() === "laser" ? "#ff3265" : color(), thickness: tool() === "laser" ? Math.max(4, thickness() * 1.5) : thickness() }); }
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
      const point = toWorld(event); const hit = tool() === "select" ? hitTest(point) : undefined;
      setHoveredIndex(hit);
      const target = hit === undefined ? undefined : elements()[hit];
      setNoteToggleHovered(target?.type === "group" && !!target.note && noteCollapseHit(target, point));
      return;
    }
    if (penEraserDrawing || tool() === "eraser") { eraseAtPoint(toWorld(event)); return; }
    const raw = toWorld(event); const port = activeDrawingTool === "line" || activeDrawingTool === "arrow" ? nearestBinding(elements(), raw, 18 / canvasState().zoom) : undefined; setAttachmentHint(port?.point); const point = port?.point ?? (activeDrawingTool === "pen" ? raw : snap(raw));
    if (activeDrawingTool === "pen") currentPoints.push(tool() === "pen" ? strokePointFromPointer(event, point) : point);
    setPreview((previous) => previous ? { ...previous, end: point } : undefined);
  }

  function moveElement(element: Element, dx: number, dy: number): Element {
    if (element.locked) return element;
    if (element.type === "group") return { ...element, elements: element.elements.map((child) => moveElement(child, dx, dy)) };
    if (element.type === "freehand") return { ...element, points: element.points.map((point) => ({ ...point, x: point.x + dx, y: point.y + dy })) };
    if (isConnector(element)) {
      const shiftBranch = (branch: ShapeElement["forkUpper"]) => branch ? { ...branch, end: branch.end ? { x: branch.end.x + dx, y: branch.end.y + dy } : undefined, routePoints: branch.routePoints?.map(point => ({ x: point.x + dx, y: point.y + dy })) } : undefined;
      return { ...element, x: element.x + dx, y: element.y + dy, routePoints: element.routePoints?.map(p => ({ x: p.x + dx, y: p.y + dy })), forkUpper: shiftBranch(element.forkUpper), forkLower: shiftBranch(element.forkLower) };
    }
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
      else if (shape.type === "triangle") { context.moveTo(cx, top); context.lineTo(left + width, top + height); context.lineTo(left, top + height); context.closePath(); }
      else if (shape.type === "flowchart") traceFlowchart(context, shape.flowchartShape ?? "process", shape.x, shape.y, shape.w, shape.h);
      else if (shape.edgeStyle === "rounded" || shape.edgeStyle === "pill") context.roundRect(left, top, width, height, shape.edgeStyle === "pill" ? Math.min(width, height) / 2 : Math.min(shape.cornerRadius ?? 14, width / 2, height / 2));
      else if (shape.edgeStyle === "cut") { const c=Math.min(shape.cornerRadius ?? 12,width/2,height/2);context.moveTo(left+c,top);context.lineTo(left+width-c,top);context.lineTo(left+width,top+c);context.lineTo(left+width,top+height-c);context.lineTo(left+width-c,top+height);context.lineTo(left+c,top+height);context.lineTo(left,top+height-c);context.lineTo(left,top+c);context.closePath(); }
      else context.rect(left, top, width, height);
      const inside = context.isPointInPath(local.x, local.y); context.restore(); if (inside) return index;
    }
    return undefined;
  }

  function updatePropertyForIndex(index: number, value: string) {
    const before = cloneElements(elements()); setElements((items) => items.map((element, current) => current === index && (element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "triangle" || element.type === "flowchart") ? { ...element, fillColor: value, fillOpacity: 1 } : element)); pushUndo(before); setDirty(true);
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
    if (penEraserDrawing) { penEraserDrawing = false; drawing = false; return; }
    if (tool() === "eraser") { drawing = false; return; }
    drawing = false; const activePreview = preview();
    if (tool() === "laser") {
      if (activePreview && currentPoints.length) {
        setLaserTrail({ points: [...currentPoints], opacity: 1 });
        window.clearInterval(laserTimer);
        const startedAt = Date.now();
        laserTimer = window.setInterval(() => setLaserTrail((trail) => {
          if (!trail) return undefined;
          const opacity = 1 - (Date.now() - startedAt) / 1100;
          if (opacity <= 0) { window.clearInterval(laserTimer); laserTimer = undefined; return undefined; }
          return { ...trail, opacity };
        }), 32);
      }
      currentPoints = []; setPreview(undefined); return;
    }
    if (activePreview) {
      const item: Element = activePreview.type === "pen"
        ? { type: "freehand", points: [...currentPoints], color: activePreview.color, thickness: activePreview.thickness }
        : { type: activePreview.type, x: activePreview.start.x, y: activePreview.start.y, w: activePreview.end.x - activePreview.start.x, h: activePreview.end.y - activePreview.start.y, color: activePreview.color, thickness: activePreview.thickness, lineStyle: lineStyle(), edgeStyle: edgeStyle(), cornerRadius: cornerRadius(), flowchartShape: activePreview.type === "flowchart" ? activePreview.flowchartShape : undefined, lineRoute: activePreview.type === "line" ? activePreview.lineRoute : undefined, routePoints: activePreview.type === "line" && activePreview.lineRoute === "multi" ? [0.2, 0.4, 0.6, 0.8].map((ratio) => ({ x: activePreview.start.x + (activePreview.end.x - activePreview.start.x) * ratio, y: activePreview.start.y + (activePreview.end.y - activePreview.start.y) * ratio })) : undefined, arrowRoute: activePreview.type === "arrow" ? activePreview.arrowRoute : undefined, ...(fillEnabled() && (activePreview.type === "rectangle" || activePreview.type === "circle" || activePreview.type === "diamond" || activePreview.type === "triangle" || activePreview.type === "flowchart") ? { fillColor: fillColor(), fillOpacity: fillOpacity() } : {}), ...(activePreview.type === "line" ? { startHead: defaultLineStartHead(), endHead: defaultLineEndHead() } : {}), ...(activePreview.type === "arrow" ? { startHead: defaultStartHead(), endHead: defaultEndHead(), ...(activePreview.arrowRoute === "forked" ? { forkUpper: { endHead: defaultForkUpperHead() }, forkLower: { endHead: defaultForkLowerHead() } } : {}) } : {}) } as ShapeElement;
      const valid = activePreview.type === "pen" ? currentPoints.length > 0 : Math.hypot(activePreview.end.x - activePreview.start.x, activePreview.end.y - activePreview.start.y) > 1;
      if (isConnector(item)) {
        item.startBinding = nearestBinding(elements(), activePreview.start, 18 / canvasState().zoom)?.binding;
        item.endBinding = nearestBinding(elements(), activePreview.end, 18 / canvasState().zoom)?.binding;
        if (item.type === "arrow" && item.arrowRoute === "forked") {
          const fork = forkGeometry(item); const upper = nearestBinding(elements(), fork.upper, 18 / canvasState().zoom); const lower = nearestBinding(elements(), fork.lower, 18 / canvasState().zoom);
          if (upper) item.forkUpper = { ...(item.forkUpper ?? {}), end: upper.point, endBinding: upper.binding };
          if (lower) item.forkLower = { ...(item.forkLower ?? {}), end: lower.point, endBinding: lower.binding };
        }
      }
      if (valid) {
        const newIndex = elements().length;
        pushUndo(cloneElements(elements())); setElements((items) => [...items, item]); setDirty(true);
        if (isConnector(item)) { setSelectedIndices([newIndex]); setSidebarTab("properties"); }
      }
    }
    currentPoints = []; setPreview(undefined);
  }

  const tools: { value: Tool; label: string; key: string; path: string }[] = [
    { value: "select", label: "Select", key: "V", path: "M5 3l14 11-7 .8-3 6z" },
    { value: "pan", label: "Hand / Pan", key: "Space", path: "M8 11V5a1.5 1.5 0 0 1 3 0v5-6a1.5 1.5 0 0 1 3 0v6-5a1.5 1.5 0 0 1 3 0v7-3a1.5 1.5 0 0 1 3 0v5c0 5-3 8-8 8h-1c-3 0-5-2-6-4l-2-4a1.5 1.5 0 0 1 2.5-1.5L8 15" },
    { value: "pen", label: "Pen", key: "P", path: "M4 20l4.5-1 10.8-10.8a2.2 2.2 0 0 0-3.1-3.1L5.4 15.9 4 20zM14.8 6.3l3 3" },
    { value: "laser", label: "Laser pointer", key: "Y", path: "M5 19 17 7m-8 0 8 0 0 8M5 5l1 1M19 19l-1-1" },
    { value: "line", label: "Line", key: "L", path: "M4 20L20 4" },
    { value: "arrow", label: "Arrow", key: "A", path: "M4 19L19 4M9 4h10v10" },
    { value: "rectangle", label: "Rectangle", key: "R", path: "M5 5h14v14H5z" },
    { value: "circle", label: "Circle", key: "C", path: "M19.5 12a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0z" },
    { value: "diamond", label: "Diamond", key: "D", path: "M12 3 21 12 12 21 3 12z" },
    { value: "triangle", label: "Triangle", key: "N", path: "M12 4 21 20H3z" },
    { value: "flowchart", label: "Flowchart shapes", key: "F", path: "M4 4h6v6H4zM14 4h6v6h-6zM9 14l4 0 3 3-3 3H9l-3-3z" },
    { value: "text", label: "Text", key: "T", path: "M5 6h14M12 6v13M8 19h8" },
    { value: "bucket", label: "Fill bucket", key: "B", path: "M4 14l6-6 8 8-6 6H4zM10 8l3-3 8 8-3 3M18 19h.01" },
    { value: "eraser", label: "Eraser", key: "E", path: "M3 14l9-10 9 9-8 8H7zM12 18l5-5" },
    { value: "crop", label: "Crop image", key: "X", path: "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 8h8v8H8z" },
  ];
  const toolGroups: { id: string; label: string; tools: Tool[] }[] = [
    { id: "navigation", label: "Navigation", tools: ["select", "pan"] },
    { id: "drawing", label: "Drawing", tools: ["pen", "laser"] },
    { id: "connectors", label: "Connectors", tools: ["line", "arrow"] },
    { id: "shapes", label: "Shapes", tools: ["rectangle", "circle", "diamond", "triangle", "flowchart"] },
    { id: "content", label: "Text and image tools", tools: ["text", "bucket", "eraser", "crop"] },
  ];
  const swatches = ["#252525", "#e76b62", "#6b91c9", "#74a582", "#d8a448", "#a581bb", "#e5915b"];
  const helpShortcuts: [string, string][] = [["V", "Select tool"], ["Space", "Hold to pan"], ["P", "Pen"], ["Y", "Laser pointer"], ["R", "Rectangle"], ["C / O", "Circle"], ["D", "Diamond"], ["N", "Triangle"], ["L", "Line"], ["A", "Arrow"], ["F", "Flowchart symbol"], ["T", "Text"], ["B", "Fill bucket"], ["E", "Eraser"], ["X", "Image crop"], ["Esc", "Select tool and clear selection"], ["G", "Toggle grid"], ["Shift+G", "Snap to grid"], ["Shift+O", "Snap to objects"], ["K", "Lock canvas"], ["0", "Center view at 100%"], ["1 / 2", "Fit drawing / selection"], ["Ctrl / Cmd + N", "New sketch"], ["Ctrl / Cmd + O", "Open sketch"], ["Ctrl / Cmd + S", "Save"], ["Ctrl / Cmd + Z", "Undo"], ["Ctrl / Cmd + Y", "Redo"], ["Ctrl / Cmd + C / X / V", "Copy / cut / paste"], ["Ctrl / Cmd + D", "Duplicate selection"], ["Ctrl / Cmd + A", "Select all"], ["Ctrl / Cmd + G", "Group selection"], ["Ctrl / Cmd + Shift + G", "Ungroup"], ["Delete / Backspace", "Delete selection"], ["Arrow keys", "Nudge by 1 px"], ["Shift+Arrow", "Nudge by 10 px"], ["F1", "Open Help"]];
  const updateTextDraft = (value: string) => setTextDraft((draft) => draft ? { ...draft, value } : undefined);
  const setTextFormat = (property: "bold" | "italic" | "underline" | "textAlign" | "listType" | "fontSize" | "fontFamily", value: boolean | string | number) => {
    if (boardLocked() || focusedElement()?.locked) return;
    if (property === "fontSize" && (!Number.isFinite(Number(value)) || Number(value) < 8 || Number(value) > 160)) return;
    if (focusedElement() && isLabelShape(focusedElement()!)) updateLabel(property, value);
    else if (selectedText() && !textDraft()) updateProperty(property, value);
    else {
      if (property === "bold") setDefaultBold(Boolean(value)); else if (property === "italic") setDefaultItalic(Boolean(value)); else if (property === "underline") setDefaultUnderline(Boolean(value));
      else if (property === "textAlign") setDefaultTextAlign(value as "left" | "center" | "right"); else if (property === "listType") setDefaultListType(value as "none" | "bullet" | "number");
      else if (property === "fontSize") setDefaultFontSize(Number(value)); else if (property === "fontFamily") setDefaultFontFamily(value as FontFamily);
    }
    setTextDraft((draft) => draft ? { ...draft, [property]: value } : undefined);
  };
  const rotateSelection = (delta: number) => { if (boardLocked()) return; const index = primarySelection(); const item = index === undefined ? undefined : elements()[index]; if (!item || item.locked || item.type === "group" || isConnector(item)) return; const before = cloneElements(elements()); setElements((items) => items.map((element, i) => i === index ? { ...element, rotation: (element.rotation ?? 0) + delta } as Element : element)); pushUndo(before); setDirty(true); };
  const resetSelectionRotation = () => { const index = primarySelection(); const item = index === undefined ? undefined : elements()[index]; if (boardLocked() || !item || item.locked || item.type === "group" || (item.rotation ?? 0) === 0) return; const before = cloneElements(elements()); setElements((items) => items.map((element, i) => i === index ? { ...element, rotation: 0 } as Element : element)); pushUndo(before); setDirty(true); };
  const closeSystemMenu = (action: () => void) => { if (menu) menu.open = false; if (viewMenu) viewMenu.open = false; if (helpMenu) helpMenu.open = false; action(); };
  const toggleSidebar = () => {
    setQuickStylePopover(undefined);
    if (styleMenuMode() === "quick") { setStyleMenuMode("full"); }
    else setStyleMenuMode("quick");
  };
  const showToolOptions = (value: Tool) => setOpenToolOptions(value);
  const closeToolOptions = () => setOpenToolOptions(undefined);
  const activateTool = (next: Tool) => { commitTextDraft(); setQuickStylePopover(undefined); setStyleMenuMode("quick"); closeToolOptions(); if (next === "text") setTextMode("text"); const chosen = tool() === next && next !== "select" ? "select" : next; setTool(chosen); if (chosen !== "select" && chosen !== "pan") { setSelectedIndices([]); setSidebarTab("properties"); } };
  const renderToolbarTool = ({ value, label, key, path }: typeof tools[number]) => {
    const active = tool() === value || (value === "pan" && spaceDown());
    const hasOptions = value === "flowchart" || value === "line" || value === "arrow" || value === "text";
    const button = <button class={`tool-icon-button ${active ? "selected" : ""} ${hasOptions ? "has-options" : ""}`} title={`${label} (${key})${hasOptions ? " · click or hover for options" : ""}`} aria-label={label} aria-haspopup={hasOptions ? "menu" : undefined} aria-pressed={active} aria-expanded={hasOptions ? openToolOptions() === value : undefined} onFocus={() => { if (hasOptions) showToolOptions(value); }} onClick={(event) => { if (hasOptions && (event.target as HTMLElement).closest?.(".tool-family-caret")) { showToolOptions(value); return; } closeToolOptions(); activateTool(value); }}><svg viewBox="0 0 24 24" aria-hidden="true">{value === "flowchart" ? <><path d="M12 8v3m0 3v2m-1.5-5h3"/><rect x="9.5" y="2.5" width="5" height="5" rx="1"/><path d="m12 14 3 3-3 3-3-3z"/><rect x="9.5" y="15.5" width="5" height="5" rx="1"/></> : <path d={path} />}</svg><kbd>{key}</kbd>{hasOptions && <svg class="tool-family-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3"/></svg>}</button>;
    if (value === "flowchart") return <div class="tool-family flowchart-family" classList={{ "options-open": openToolOptions() === value }} onPointerEnter={() => showToolOptions(value)} onPointerLeave={closeToolOptions} onFocusOut={(event) => { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) closeToolOptions(); }}>{button}<div class="tool-options flowchart-options" role="menu" aria-label="Flowchart symbols">{FLOWCHART_SHAPES.map((shape) => <button class={flowchartShape() === shape.value ? "active" : ""} role="menuitem" title={shape.label} aria-label={shape.label} onClick={() => { closeToolOptions(); setFlowchartShape(shape.value); setTool("flowchart"); setSidebarTab("properties"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d={shape.path} /></svg><span>{shape.label}</span></button>)}</div></div>;
    if (value === "text") return <div class="tool-family text-family" classList={{ "options-open": openToolOptions() === value }} onPointerEnter={() => showToolOptions(value)} onPointerLeave={closeToolOptions} onFocusOut={(event) => { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) closeToolOptions(); }}>{button}<div class="tool-options text-options" role="menu" aria-label="Text and note tools">
      <button role="menuitem" title="Place plain text" onClick={() => { closeToolOptions(); setTextMode("text"); setTool("text"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d="M4 6h16M12 6v13m-4 0h8"/></svg><span>Text</span></button>
      <button role="menuitem" title="Add a note; supports fenced, syntax-highlighted code blocks" onClick={() => { closeToolOptions(); setTextMode("note"); setTool("text"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d="M5 4h14v13l-4 3H5zM8 9h8M8 13h6"/></svg><span>Note + code</span></button>
      <button role="menuitem" title="Add a sticky note" onClick={() => { closeToolOptions(); setTextMode("sticky"); setTool("text"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d="M5 4h14v12l-5 5H5zM14 16v5m-6-12h8m-8 4h6"/></svg><span>Sticky note</span></button>
      <button role="menuitem" title="Add an interactive checklist" onClick={() => { closeToolOptions(); setTextMode("checklist"); setTool("text"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d="m4 6 2 2 3-4M12 6h8M4 14l2 2 3-4m3 2h8"/></svg><span>Checklist</span></button>
    </div></div>;
    if (value === "line") return <div class="tool-family route-family" classList={{ "options-open": openToolOptions() === value }} onPointerEnter={() => showToolOptions(value)} onPointerLeave={closeToolOptions} onFocusOut={(event) => { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) closeToolOptions(); }}>{button}<div class="tool-options route-options" role="menu" aria-label="Line routes">{LINE_ROUTES.map((route) => <button class={lineRoute() === route.value ? "active" : ""} role="menuitem" title={route.label} aria-label={route.label} onClick={() => { closeToolOptions(); setLineRoute(route.value); setTool("line"); setSidebarTab("properties"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d={route.path} /></svg><span>{route.label}</span></button>)}</div></div>;
    if (value === "arrow") return <div class="tool-family route-family" classList={{ "options-open": openToolOptions() === value }} onPointerEnter={() => showToolOptions(value)} onPointerLeave={closeToolOptions} onFocusOut={(event) => { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) closeToolOptions(); }}>{button}<div class="tool-options route-options" role="menu" aria-label="Arrow routes">{ARROW_ROUTES.map((route) => <button class={arrowRoute() === route.value ? "active" : ""} role="menuitem" title={route.label} aria-label={route.label} onClick={() => { closeToolOptions(); setArrowRoute(route.value); setTool("arrow"); setSidebarTab("properties"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d={route.path} /></svg><span>{route.label}</span></button>)}</div></div>;
    return button;
  };
  return (
    <main class={`app-shell theme-${theme()}`}>
      <header class="topbar">
        <div class="header-leading"><div class="brand"><img class="brand-mark-image" src={sketchDrawMark} alt="" /><span>{activePath() ? fileName() : "SketchDraw"}</span></div></div>
        <nav class="app-menus" aria-label="Application menus">
          <details class="menu-dropdown" ref={menu}><summary>File<svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg></summary><div class="system-menu-popover"><div class="menu-file-label">{activePath() ? fileName() : "No file open"}</div>
            <button onClick={() => closeSystemMenu(() => void createFile())}>New sketch <kbd>Ctrl+N</kbd></button><button onClick={() => closeSystemMenu(() => void openFile())}>Open sketch <kbd>Ctrl+O</kbd></button><button disabled={!activePath()} onClick={() => closeSystemMenu(() => { if (activePath()) void saveToPath(activePath()!); })}>Save <kbd>Ctrl+S</kbd></button><button disabled={!activePath()} onClick={() => closeSystemMenu(() => { if (activePath()) void saveAs(); })}>Save as...</button><button disabled={!activePath()} onClick={() => closeSystemMenu(() => { if (activePath()) void importImage(); })}>Import image...</button><div class="menu-separator" /><button disabled={!activePath()} onClick={() => closeSystemMenu(() => { if (activePath()) openExportOptions("png"); })}>Export PNG...</button><button disabled={!activePath()} onClick={() => closeSystemMenu(() => { if (activePath()) openExportOptions("pdf"); })}>Export PDF...</button><button disabled={!activePath()} onClick={() => closeSystemMenu(() => { if (activePath()) openExportOptions("svg"); })}>Export SVG...</button><button disabled={!activePath() || !elements().length || boardLocked()} onClick={() => closeSystemMenu(() => setShowClearConfirm(true))}>Clear canvas</button>
          </div></details>
          <details class="menu-dropdown" ref={viewMenu}><summary>View<svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg></summary><div class="system-menu-popover view-popover"><span class="menu-section-title">Appearance</span><div class="theme-options"><button class={themeMode() === "system" ? "active" : ""} onClick={() => closeSystemMenu(() => setThemePreference("system"))} title="Use system theme"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z"/></svg><span>System</span></button><button class={themeMode() === "light" ? "active" : ""} onClick={() => closeSystemMenu(() => setThemePreference("light"))} title="Light theme"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><span>Light</span></button><button class={themeMode() === "dark" ? "active" : ""} onClick={() => closeSystemMenu(() => setThemePreference("dark"))} title="Dark theme"><svg viewBox="0 0 24 24"><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5z"/></svg><span>Dark</span></button></div><div class="menu-separator" /><span class="menu-section-title">Whiteboard</span><div class="view-colors"><button class={`board-auto-button ${boardColorFollowsTheme() ? "active" : ""}`} title="Match the canvas to the active theme" disabled={boardLocked()} onClick={() => closeSystemMenu(() => { setBoardColorFollowsTheme(true); setCanvasState({ ...canvasState(), boardColorFollowsTheme: true }); setDirty(true); })}>Auto</button>{BOARD_COLORS.map((value) => <button class={`color-swatch ${!boardColorFollowsTheme() && boardColor() === value ? "active" : ""}`} style={{ background: value }} aria-label={`Whiteboard ${value}`} title={value} disabled={boardLocked()} onClick={() => closeSystemMenu(() => { if (!boardLocked()) { setBoardColor(value); setBoardColorFollowsTheme(false); setCanvasState({ ...canvasState(), backgroundColor: value, boardColorFollowsTheme: false }); setDirty(true); } })} />)}<label class="custom-color-swatch" title="Custom whiteboard color"><input aria-label="Custom whiteboard color" type="color" value={renderedBoardColor()} disabled={boardLocked()} onInput={(event) => { if (!boardLocked()) { setBoardColor(event.currentTarget.value); setBoardColorFollowsTheme(false); setCanvasState({ ...canvasState(), backgroundColor: event.currentTarget.value, boardColorFollowsTheme: false }); setDirty(true); } }} /></label></div></div></details>
          <details class="menu-dropdown help-menu" ref={helpMenu}><summary>Help<svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg></summary><div class="system-menu-popover"><button onClick={() => closeSystemMenu(() => { setHelpSection("guide"); setHelpOpen(true); })}>Guide</button><button onClick={() => closeSystemMenu(() => { setHelpSection("shortcuts"); setHelpOpen(true); })}>Keyboard shortcuts <kbd>F1</kbd></button><div class="menu-separator" /><button disabled={updateCheck() === "checking"} onClick={() => void checkForUpdates()}>{updateCheck() === "checking" ? "Checking for updates..." : "Check for updates"}</button><Show when={updateCheck() === "current"}><span class="update-menu-status current">No newer release is available.</span></Show><Show when={updateCheck() === "available"}><span class="update-menu-status available">New version {updateVersion()} is available.</span></Show><Show when={updateCheck() === "error"}><span class="update-menu-status error">Could not check for a newer version.</span></Show></div></details>
        </nav>

        <Show when={activePath()}><div class="top-actions"><span class={`save-status ${saving() ? "is-saving" : (dirty() || textDraft()) ? "is-dirty" : "is-saved"}`} role="status" aria-live="polite" aria-label={status()} title={status()}><i /><time>{savedAt() || "—"}</time></span></div></Show>
      </header>
      <Show when={activePath()} fallback={<section class="welcome-screen">
  <div class="welcome-card">
    <div class="welcome-intro">
      <div class="welcome-symbol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" /></svg></div>
      <p class="eyebrow">YOUR IDEAS, ON ONE CANVAS</p>
      <h1>Think it through.<br /><em>Draw it out.</em></h1>
      <p class="welcome-copy">A calm, capable space for diagrams, plans, and the ideas in between. Start a sketch or pick up where you left off.</p>
      <div class="welcome-actions"><button class="save-button large" onClick={createFile}>Create a sketch <span aria-hidden="true">&rarr;</span></button><button class="quiet-button large" onClick={openFile}>Open a file</button></div>
      <div class="file-hint"><span class="file-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h5" /></svg></span><span><strong>Private by design</strong><br />Your portable .sketch files stay in folders you choose.</span></div>
      <small class="copyright-notice">&copy; 2026 Toushal Sampat. All rights reserved.</small>
    </div>
    <div class="welcome-visual" aria-hidden="true">
      <div class="welcome-visual-topline"><span><i></i> SKETCHDRAW CANVAS</span><b>FLOW 01</b></div>
      <svg viewBox="0 0 440 350" role="presentation">
        <defs><filter id="welcome-card-shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="7" stdDeviation="8" flood-color="#3b493f" flood-opacity=".12" /></filter></defs>
        <path class="welcome-wire" d="M116 111h53m62 0h46m-77 25v52m93-52v52m-93 0h-90m90 0h94m-184 0v32m184-32v32" />
        <path class="welcome-wire-arrow" d="m163 106 7 5-7 5m47 65 5 7 5-7m87-65 7 5-7 5m-200 63-5 7 5 7m99 15 5 7 5-7m85-29 5 7 5-7" />
        <g filter="url(#welcome-card-shadow)"><rect class="welcome-node welcome-node-lilac" x="26" y="78" width="90" height="66" rx="16" /><rect class="welcome-node welcome-node-sun" x="169" y="78" width="92" height="66" rx="16" /><rect class="welcome-node welcome-node-mint" x="277" y="78" width="104" height="66" rx="16" /><rect class="welcome-node welcome-node-paper" x="26" y="198" width="100" height="64" rx="16" /><rect class="welcome-node welcome-node-blue" x="169" y="198" width="92" height="64" rx="16" /><rect class="welcome-node welcome-node-paper" x="277" y="198" width="104" height="64" rx="16" /></g>
        <g class="welcome-node-icon"><circle cx="48" cy="101" r="7" /><path d="M62 99h38M62 106h27" /><circle cx="191" cy="101" r="7" /><path d="M205 99h40M205 106h28" /><circle cx="299" cy="101" r="7" /><path d="M313 99h52M313 106h35" /><circle cx="48" cy="220" r="7" /><path d="M62 218h42M62 225h30" /><circle cx="191" cy="220" r="7" /><path d="M205 218h40M205 225h28" /><circle cx="299" cy="220" r="7" /><path d="M313 218h52M313 225h35" /></g>
        <circle class="welcome-spark" cx="365" cy="53" r="13" /><path class="welcome-spark-line" d="M365 45v16m-8-8h16m-13-5 10 10m0-10-10 10" />
        <circle class="welcome-dot" cx="80" cy="290" r="4" /><circle class="welcome-dot" cx="96" cy="290" r="4" /><circle class="welcome-dot" cx="112" cy="290" r="4" />
      </svg>
      <div class="welcome-visual-caption"><span>&#10022;</span> A little clarity, one connection at a time.</div>
    </div>
  </div>
  <div class="recent-dashboard">
    <div class="recent-heading"><span class="eyebrow">YOUR WORKSPACE</span><div class="recent-heading-row"><h2>Recent sketches</h2><span class="recent-count">{recentFiles().length}</span></div><p>Pick up right where you left off.</p></div>
    <Show when={recentFiles().length > 0} fallback={<div class="recent-empty"><div class="recent-empty-icon"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h5" /></svg></div><strong>Your next idea starts here</strong><span>Open a sketch from your device to see it in this list.</span><button class="quiet-button" onClick={openFile}>Browse sketches <span aria-hidden="true">&rarr;</span></button></div>}>
      <div class="recent-list">{recentFiles().map((path) => <button class="recent-file" onClick={() => void loadFile(path)}><span class="recent-file-icon"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h5" /></svg></span><span class="recent-file-name">{path.split(/[\\/]/).pop()}</span><span class="recent-file-path">{path}</span><span class="recent-open">Open <span aria-hidden="true">&rarr;</span></span></button>)}</div>
    </Show>
    <div class="recent-footnote"><span class="recent-footnote-dot"></span> Saved on this device</div>
  </div>
</section>}>
        <>
          <section class="canvas-wrap" ref={canvasWrap}>
            <Show when={noteEditor()}>{draft => <div class={`canvas-note-editor ${draft().kind}`} role="group" aria-label={`${draft().kind} canvas editor`} style={{ left: `${canvasState().panX + draft().x * canvasState().zoom}px`, top: `${canvasState().panY + draft().y * canvasState().zoom}px`, width: `${Math.max(220, draft().width * canvasState().zoom)}px`, height: `${Math.max(130, draft().height * canvasState().zoom)}px` }} onPointerDown={event => { const rect = event.currentTarget.getBoundingClientRect(); resizingNoteEditor = event.clientX >= rect.right - 22 && event.clientY >= rect.bottom - 22; event.stopPropagation(); }} onPointerUp={event => { if (resizingNoteEditor) { const rect = event.currentTarget.getBoundingClientRect(); const zoom = canvasState().zoom; setNoteEditor(current => current ? { ...current, width: Math.max(180, Math.min(4000, rect.width / zoom)), height: Math.max(100, Math.min(1_000_000, rect.height / zoom)) } : current); } resizingNoteEditor = false; }}>
              <header><span>{draft().kind === "sticky" ? "STICKY NOTE" : draft().kind === "checklist" ? "CHECKLIST" : "NOTE + CODE"}</span><small class="editor-key-hint">Tab indents</small><button type="button" onClick={saveNoteEditor} title="Save to canvas" aria-label="Save note to canvas">Done &#10003;</button></header>
              <div class="note-font-control" aria-label="Card font size">
                <span>Text size</span>
                <button type="button" aria-label="Decrease card font size" title="Decrease font size" disabled={draft().fontSize <= 8} onClick={() => setNoteEditor(current => current ? { ...current, fontSize: Math.max(8, current.fontSize - 1) } : undefined)}>&#8722;</button>
                <input aria-label="Card font size in pixels" type="range" min="8" max="32" step="1" value={draft().fontSize} onInput={event => setNoteEditor(current => current ? { ...current, fontSize: Number(event.currentTarget.value) } : undefined)} />
                <output>{draft().fontSize}px</output>
                <button type="button" aria-label="Increase card font size" title="Increase font size" disabled={draft().fontSize >= 32} onClick={() => setNoteEditor(current => current ? { ...current, fontSize: Math.min(32, current.fontSize + 1) } : undefined)}>+</button>
              </div>
              <textarea ref={element => { noteEditorTextarea = element; }} class="canvas-note-input" aria-label={draft().kind === "checklist" ? "Checklist items" : draft().kind === "sticky" ? "Sticky note text" : "Note and code content"} maxlength="50000" value={draft().content} placeholder={draft().kind === "checklist" ? "- [ ] Plan the next step" : "Write here…\n\nUse fenced code blocks such as ```ts"} onInput={event => setNoteEditor(current => current ? { ...current, content: event.currentTarget.value } : undefined)} onBlur={event => { if (!(event.relatedTarget instanceof HTMLElement && event.relatedTarget.closest(".canvas-note-editor"))) saveNoteEditor(); }} onKeyDown={event => { event.stopPropagation(); if (event.key === "Tab") { indentTextarea(event, value => setNoteEditor(current => current ? { ...current, content: value } : current)); return; } if ((event.key === "Enter" && (event.ctrlKey || event.metaKey)) || event.key === "Escape") { event.preventDefault(); saveNoteEditor(); } }} />
            </div>}</Show>
            <canvas ref={canvas} class="drawing-canvas" style={{ cursor: isPanning() ? "grabbing" : spaceDown() || tool() === "pan" ? "grab" : boardLocked() ? "not-allowed" : tool() === "select" ? noteToggleHovered() ? "pointer" : hoveredIndex() !== undefined ? "move" : "default" : tool() === "text" ? "text" : tool() === "eraser" ? "cell" : tool() === "bucket" ? "copy" : tool() === "crop" ? "crosshair" : "crosshair" }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { penEraserDrawing = false; if (resizeOrigin) setElements(resizeOrigin.before); if (moveOrigin) setElements(moveOrigin.before); drawing = false; setPreview(undefined); setMarquee(undefined); setAttachmentHint(undefined); resizeOrigin = undefined; moveOrigin = undefined; marqueeOrigin = undefined; panOrigin = undefined; setIsPanning(false); }} onPointerLeave={() => { if (!moveOrigin && !resizeOrigin) setHoveredIndex(undefined); setNoteToggleHovered(false); }} onDblClick={handleCanvasDoubleClick} onContextMenu={onContextMenu} /><button class="canvas-zoom-reset" title="Center view and reset zoom to 100% (0)" aria-label={`Center view and reset zoom, currently ${Math.round(canvasState().zoom * 100)} percent`} onClick={resetZoomAndCenter}><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M10.5 7v7m-3.5-3.5h7"/></svg><kbd>{Math.round(canvasState().zoom * 100)}%</kbd></button>
            <nav class="page-tabs" aria-label="Sketch pages">
              <div class="page-tab-list">{pages().map((page, index) => <button class={`page-tab ${page.id === activePageId() ? "active" : ""}`} aria-current={page.id === activePageId() ? "page" : undefined} title={`${page.name} — double-click to rename`} onClick={() => switchPage(page.id)} onDblClick={() => { switchPage(page.id); openPageDialog("rename"); }}><small>{index + 1}</small> {page.name}</button>)}</div>
              <button title="Add page" aria-label="Add page" disabled={boardLocked() || pages().length >= 100} onClick={addPage}>+</button>
              <details class="page-menu"><summary aria-label="Page actions">•••</summary><div class="page-actions" onClick={event => { const parent = event.currentTarget.parentElement as HTMLDetailsElement; parent.open = false; }}>
                <button disabled={boardLocked()} onClick={() => openPageDialog("rename")}>Rename page</button><button disabled={boardLocked() || pages().length >= 100} onClick={duplicatePage}>Duplicate page</button>
                <button disabled={boardLocked() || pages()[0]?.id === activePageId()} onClick={() => reorderPage(-1)}>Move page left</button><button disabled={boardLocked() || pages()[pages().length - 1]?.id === activePageId()} onClick={() => reorderPage(1)}>Move page right</button>
                <button disabled={boardLocked() || pages().length <= 1} onClick={() => openPageDialog("delete")}>Delete page…</button>
              </div></details>
            </nav>
            <Show when={toolBarOpen()} fallback={<button class="tool-deck-reopen" title="Show tools" aria-label="Show tools" onClick={() => setToolBarOpen(true)}><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg></button>}><nav class="tool-deck" aria-label="Canvas tools">
              <div class="tool-cluster tool-cluster-canvas" role="group" aria-label="Canvas view">
              <div class="canvas-options-family" classList={{ "options-open": canvasOptionsOpen() }}>
              <button class={`canvas-options-trigger ${canvasOptionsOpen() ? "active" : ""}`} aria-label="Canvas options" aria-haspopup="menu" aria-expanded={canvasOptionsOpen()} title="Canvas options" onClick={() => { setCanvasOptionsOpen(value => !value); closeToolOptions(); }}><svg viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg></button>
              <div class="canvas-options-menu" role="menu" aria-label="Canvas options">
                <span class="canvas-options-title">Canvas</span>
                <div class="canvas-options-grid">
                  <button role="menuitem" disabled={!elements().length} title="Fit drawing (1)" onClick={() => { setCanvasOptionsOpen(false); fitDocumentToViewport(elements()); }}><svg viewBox="0 0 24 24"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8z"/></svg><span>Fit drawing</span></button>
                  <button role="menuitem" disabled={!selectedIndices().length} title="Zoom to selection (2)" onClick={() => { setCanvasOptionsOpen(false); fitDocumentToViewport(selectedElements()); }}><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><span>Fit selection</span></button>
                  <button role="menuitem" class={showGrid() ? "active" : ""} title="Toggle grid (G)" onClick={() => setShowGrid(value => !value)}><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM4 10h16M10 4v16"/></svg><span>Grid</span><kbd>G</kbd></button>
                  <button role="menuitem" class={snapToGrid() ? "active" : ""} title="Snap to grid (Shift+G)" onClick={() => setSnapToGrid(value => !value)}><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM8 8h8v8H8z"/></svg><span>Snap to grid</span><kbd>Shift+G</kbd></button>
                  <button role="menuitem" class={snapToObjects() ? "active" : ""} title="Snap to objects (Shift+O)" onClick={() => setSnapToObjects(value => !value)}><svg viewBox="0 0 24 24"><path d="M5 5h5v5H5zM14 14h5v5h-5zM10 7.5h4M16.5 10v4"/></svg><span>Snap to objects</span><kbd>Shift+O</kbd></button>
                  <button role="menuitem" disabled={!groupActionEnabled() || boardLocked()} class={groupSelected() ? "active" : ""} title="Group / ungroup (Ctrl+G)" onClick={groupSelection}><svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="9" height="9" rx="1.5"/><rect x="11.5" y="11" width="9" height="9" rx="1.5"/></svg><span>{groupSelected() ? "Ungroup" : "Group"}</span><kbd>Ctrl G</kbd></button>
                </div>
              </div>
              </div></div>
              {toolGroups.map((group) => <div class={`tool-cluster tool-cluster-${group.id}`} role="group" aria-label={group.label}>{tools.filter((item) => group.tools.includes(item.value)).map(renderToolbarTool)}</div>)}
              <div class="tool-family stencil-family" classList={{ "options-open": stencilMenuOpen() }} onPointerEnter={() => setStencilMenuOpen(true)} onPointerLeave={() => setStencilMenuOpen(false)}>
                <button class="tool-icon-button has-options" title="Symbols and modeling components" aria-label="Symbols and modeling components" aria-haspopup="menu" aria-expanded={stencilMenuOpen()} onClick={() => setStencilMenuOpen(value => !value)}><svg viewBox="0 0 24 24"><path d="M3 5h7v7H3zM14 4l7 4-4 7-7-4zM4 16h7v5H4zM15 17h6v4h-6z"/></svg><kbd>LIB</kbd><svg class="tool-family-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3"/></svg></button>
                <div class="tool-options stencil-options" role="menu" aria-label="Symbols and diagram components">
                  <strong class="tool-options-heading">Symbols &amp; elements</strong>
                  {EXTRA_FLOWCHART_SHAPES.map(shape => <button role="menuitem" title={shape.label} onClick={() => { setFlowchartShape(shape.value); setTool("flowchart"); setSelectedIndices([]); setSidebarTab("properties"); setStencilMenuOpen(false); }}><svg viewBox="0 0 24 24"><path d={FLOWCHART_SHAPES.find(item => item.value === shape.value)?.path ?? "M4 4h16v16H4z"}/></svg><span>{shape.label}</span></button>)}
                  {[...new Set(LIBRARY_COMPONENTS.map(component => component.section))].map(section => <><strong class="tool-options-heading stencil-heading">{section}</strong>{LIBRARY_COMPONENTS.filter(component => component.section === section).map(component => <button class="stencil-template" role="menuitem" title={component.description} onClick={() => insertLibraryComponent(component.kind)}>{libraryIcon(component.kind)}<span>{component.label}</span></button>)}</>)}
                  <strong class="tool-options-heading stencil-heading">Database schema</strong>
                  <button class="stencil-template" role="menuitem" title="Paste SQL CREATE TABLE statements or a JSON schema and generate linked table cards" onClick={() => { setSchemaError(""); setSchemaDialog(true); setStencilMenuOpen(false); }}><svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg><span>Visualize schema</span></button>
                </div>
              </div>
              <div class="tool-cluster tool-cluster-history" role="group" aria-label="History and canvas state">
                <button class="tool-icon-button canvas-utility-button" disabled={!canUndo() || boardLocked()} title="Undo (Ctrl+Z)" aria-label="Undo" onClick={undo}><svg viewBox="0 0 24 24"><path d="M9 7 4 12l5 5M5 12h8a6 6 0 0 1 6 6"/></svg><kbd>Ctrl+Z</kbd></button>
                <button class="tool-icon-button canvas-utility-button" disabled={!canRedo() || boardLocked()} title="Redo (Ctrl+Y)" aria-label="Redo" onClick={redo}><svg viewBox="0 0 24 24"><path d="m15 7 5 5-5 5m4-5h-8a6 6 0 0 0-6 6"/></svg><kbd>Ctrl+Y</kbd></button>
                <button class={`tool-icon-button canvas-utility-button ${boardLocked() ? "selected" : ""}`} title={`Canvas ${boardLocked() ? "locked" : "unlocked"} (K)`} aria-label={boardLocked() ? "Unlock canvas" : "Lock canvas"} aria-pressed={boardLocked()} onClick={() => setBoardLocked(value => !value)}><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d={boardLocked() ? "M8 10V7a4 4 0 1 1 8 0v3" : "M8 10V7a4 4 0 0 1 8 0"}/></svg><kbd>K</kbd></button>
              </div>
              <button class="tool-collapse" title="Hide tools" aria-label="Hide tools" onClick={() => setToolBarOpen(false)}><svg viewBox="0 0 24 24"><path d="m7 14 5-5 5 5" /></svg></button></nav></Show>
            <Show when={sidebarVisible()}><aside class="style-pane" classList={{ "quick-style-mode": styleMenuMode() === "quick", "full-style-mode": styleMenuMode() === "full" }} aria-label="Properties and layers">
              <div class="quick-style-panel">
                <div class="quick-style-heading"><button onClick={toggleSidebar} title={styleMenuMode() === "full" ? "Close properties" : "Open properties"} aria-label={styleMenuMode() === "full" ? "Close properties" : "Open properties"} aria-expanded={styleMenuMode() === "full"}><svg viewBox="0 0 24 24"><path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg></button></div>
                <Show when={sidebarTab() === "properties"}>
                  <div class="quick-style-controls">
                    <Show when={tool() === "bucket"}>
                      <button class="quick-style-icon" onClick={() => setQuickStylePopover(quickStylePopover() === "fill" ? undefined : "fill")} aria-label="Bucket fill color" title="Fill color" aria-expanded={quickStylePopover() === "fill"}><i class="quick-color-mark" style={{ background: fillColor() }} /></button>
                    </Show>
                    <Show when={tool() !== "bucket" && showStrokeControls()}>
                      <button class="quick-style-icon" onClick={() => setQuickStylePopover(quickStylePopover() === "color" ? undefined : "color")} aria-label={quickElementType() === "text" ? "Text color" : "Stroke color"} title={quickElementType() === "text" ? "Text color" : "Stroke color"} aria-expanded={quickStylePopover() === "color"}><i class="quick-color-mark" style={{ background: themeInk(selectedColor(), theme()) }} /></button>
                    </Show>
                    <Show when={tool() !== "bucket" && showThicknessControls()}>
                      <button class="quick-style-icon quick-width-icon" onClick={() => setQuickStylePopover(quickStylePopover() === "thickness" ? undefined : "thickness")} aria-label={tool() === "eraser" ? "Eraser size" : "Stroke width"} title={tool() === "eraser" ? "Eraser size" : `Stroke width ${selectedThickness()}px`} aria-expanded={quickStylePopover() === "thickness"}><i style={{ height: `${Math.max(1, selectedThickness())}px`, background: themeInk(selectedColor(), theme()) }} /><small>{selectedThickness()}</small></button>
                    </Show>
                    <Show when={tool() === "pen"}><button class={`quick-style-icon ${quickStylePopover() === "penInput" ? "active" : ""}`} onClick={() => setQuickStylePopover(quickStylePopover() === "penInput" ? undefined : "penInput")} aria-label="Stylus input options" title="Stylus pressure, tilt, and eraser" aria-expanded={quickStylePopover() === "penInput"}><svg viewBox="0 0 24 24"><path d="m5 19 3.5-.8L19 7.7 16.3 5 5.8 15.5 5 19Zm9.8-12 2.7 2.7M4 22h16"/></svg></button></Show>
                    <Show when={quickHasShapeFill()}>
                      <button class={`quick-style-icon ${fillEnabled() || !!selectedFillColor() ? "active" : ""}`} onClick={() => setQuickStylePopover(quickStylePopover() === "fill" ? undefined : "fill")} aria-label="Shape fill" title="Shape fill" aria-expanded={quickStylePopover() === "fill"}><svg class="quick-fill-preview-icon" viewBox="0 0 24 24"><path d="M4 4h16v16H4z" style={{ fill: selectedFillColor() ?? (fillEnabled() ? fillColor() : "#ffffff") }} /><path d="M4 4h16v16H4z" /></svg></button>
                    </Show>
                    <Show when={quickIsConnector()}>
                      <button class="quick-style-icon" onClick={() => setQuickStylePopover(quickStylePopover() === "lineStyle" ? undefined : "lineStyle")} aria-label="Line style" title="Line style" aria-expanded={quickStylePopover() === "lineStyle"}><svg viewBox="0 0 24 24" class={`line-preview ${quickCurrentLineStyle()}`}><path d="M3 12h18" /></svg></button>
                      <button class="quick-style-icon" onClick={() => setQuickStylePopover(quickStylePopover() === "route" ? undefined : "route")} aria-label="Connector route" title="Connector route" aria-expanded={quickStylePopover() === "route"}><svg viewBox="0 0 24 24"><path d={(quickRouteChoices().find(route => route.value === quickCurrentRoute()) ?? quickRouteChoices()[0]).path} /></svg></button>
                    </Show>
                    <Show when={quickIsConnector()}>
                      <button class="quick-style-icon" onClick={() => setQuickStylePopover(quickStylePopover() === "heads" ? undefined : "heads")} aria-label="Connector arrowheads" title="Connector arrowheads" aria-expanded={quickStylePopover() === "heads"}><ArrowHeadIcon kind={quickArrowHead("end")} /></button>
                    </Show>
                    <Show when={quickHasText()}>
                      <div class="quick-text-size"><button aria-label="Decrease font size" title="Decrease font size" onClick={() => setTextFormat("fontSize", Math.max(8, (selectedText()?.fontSize ?? defaultFontSize()) - 1))}>-</button><span>{selectedText()?.fontSize ?? defaultFontSize()}</span><button aria-label="Increase font size" title="Increase font size" onClick={() => setTextFormat("fontSize", Math.min(160, (selectedText()?.fontSize ?? defaultFontSize()) + 1))}>+</button></div>
                      <div class="quick-text-format"><button class={(selectedText()?.bold ?? defaultBold()) ? "active" : ""} aria-label="Bold" title="Bold" onClick={() => setTextFormat("bold", !(selectedText()?.bold ?? defaultBold()))}><b>B</b></button><button class={(selectedText()?.italic ?? defaultItalic()) ? "active" : ""} aria-label="Italic" title="Italic" onClick={() => setTextFormat("italic", !(selectedText()?.italic ?? defaultItalic()))}><i>I</i></button><button class={(selectedText()?.underline ?? defaultUnderline()) ? "active" : ""} aria-label="Underline" title="Underline" onClick={() => setTextFormat("underline", !(selectedText()?.underline ?? defaultUnderline()))}><u>U</u></button><button class={`quick-font-toggle ${(selectedText()?.fontFamily ?? defaultFontFamily()) === "hand" ? "active" : ""}`} aria-label="Toggle text font family" title="Toggle text font family" onClick={() => setTextFormat("fontFamily", (selectedText()?.fontFamily ?? defaultFontFamily()) === "hand" ? "sans" : "hand")}>Aa</button></div>
                    </Show>
                    <Show when={quickStylePopover() === "color" || quickStylePopover() === "fill"}>
                      <div class="quick-style-popover quick-color-popover" aria-label={quickStylePopover() === "fill" ? "Fill colors" : "Stroke colors"}>
                        <div class="quick-style-swatches">{swatches.map((swatch) => <button class={`color-swatch ${((quickStylePopover() === "fill" ? (quickHasShapeFill() ? selectedFillColor() ?? (fillEnabled() ? fillColor() : "") : fillColor()) : selectedColor()) === swatch) ? "active" : ""}`} style={{ background: swatch }} aria-label={`Choose ${swatch}`} title={swatch} onClick={() => { if (quickStylePopover() === "fill" && tool() === "bucket") setFillColor(swatch); else if (quickStylePopover() === "fill") { setFillColor(swatch); setFillEnabled(true); if (hasStyleSelection()) updateProperty("fillColor", swatch); } else updateStrokeColor(swatch); setQuickStylePopover(undefined); }} />)}
                          <label class="custom-color-swatch" title="Custom color"><input aria-label="Custom color" type="color" value={quickStylePopover() === "fill" ? fillColor() : selectedColor()} onInput={(event) => { const value = event.currentTarget.value; if (quickStylePopover() === "fill" && tool() === "bucket") setFillColor(value); else if (quickStylePopover() === "fill") { setFillColor(value); setFillEnabled(true); if (hasStyleSelection()) updateProperty("fillColor", value); } else updateStrokeColor(value); }} /></label>
                        </div>
                        <Show when={quickStylePopover() === "fill" && quickHasShapeFill()}><button class="quick-fill-toggle" onClick={() => { const enabled = !fillEnabled() && !selectedFillColor(); setFillEnabled(enabled); if (hasStyleSelection()) updateProperty("fillColor", enabled ? fillColor() : undefined); }}>{fillEnabled() || !!selectedFillColor() ? "Remove fill" : "Enable fill"}</button></Show>
                      </div>
                    </Show>
                    <Show when={quickStylePopover() === "thickness"}>
                      <div class="quick-style-popover thickness-popover" aria-label={tool() === "eraser" ? "Eraser size" : "Stroke width"}>
                        <div class="quick-thickness-presets">{([[1, "Ultra-thin"], [2, "Thin"], [4, "Default"], [5, "Medium"], [10, "Bold"]] as const).map(([value, label]) => <button class={selectedThickness() === value ? "active" : ""} aria-label={`${label} ${value} pixels`} title={`${label}, ${value}px`} onClick={() => { updateThickness(value); setQuickStylePopover(undefined); }}><i style={{ height: `${value}px` }} /></button>)}</div>
                        <input aria-label="Custom size" type="range" min="1" max="20" step="1" value={selectedThickness()} onInput={(event) => updateThickness(Number(event.currentTarget.value))} />
                      </div>
                    </Show>
                    <Show when={quickStylePopover() === "penInput" && tool() === "pen"}><div class="quick-style-popover pen-input-popover" aria-label="Stylus input options"><strong>Windows pen</strong><label><input type="checkbox" checked={penPressure()} onChange={event => setPenPressure(event.currentTarget.checked)} /> Pressure width</label><label><input type="checkbox" checked={penTilt()} onChange={event => setPenTilt(event.currentTarget.checked)} /> Tilt shaping</label><label><input type="checkbox" checked={penEraser()} onChange={event => setPenEraser(event.currentTarget.checked)} /> Eraser end</label><small>Uses native WebView2 pointer data when a pen is connected.</small></div></Show>
                    <Show when={quickStylePopover() === "lineStyle"}>
                      <div class="quick-style-popover quick-line-styles">{(["solid", "dashed", "dotted", "double"] as const).map(value => <button class={quickCurrentLineStyle() === value ? "active" : ""} aria-label={`${value} line`} title={`${value} line`} onClick={() => { if (quickFocusedHasLineStyle()) updateProperty("lineStyle", value); else setLineStyle(value); setQuickStylePopover(undefined); }}><svg viewBox="0 0 24 24" class={`line-preview ${value}`}><path d={value === "double" ? "M3 9h18M3 15h18" : "M3 12h18"} /></svg></button>)}</div>
                    </Show>
                    <Show when={quickStylePopover() === "route"}>
                      <div class="quick-style-popover quick-routes">{quickRouteChoices().map(route => <button class={quickCurrentRoute() === route.value ? "active" : ""} aria-label={route.label} title={route.label} onClick={() => { if (quickElementType() === "arrow") { if (styleTargetElement()?.type === "arrow") updateProperty("arrowRoute", route.value); else setArrowRoute(route.value as ArrowRoute); } else { if (styleTargetElement()?.type === "line") updateProperty("lineRoute", route.value); else setLineRoute(route.value as LineRoute); } setQuickStylePopover(undefined); }}><svg viewBox="0 0 24 24"><path d={route.path} /></svg></button>)}</div>
                    </Show>
                    <Show when={quickStylePopover() === "heads" && quickIsConnector()}>
                      <div class="quick-style-popover quick-arrow-heads" aria-label="Connector arrowhead styles">{(["start", "end"] as const).map(end => <div><span>{end}</span><div>{ARROW_HEADS.map(({ value, label }) => <button class={quickArrowHead(end) === value ? "active" : ""} title={`${label} ${end} head`} aria-label={`${label} ${end} arrowhead`} onClick={() => setConnectorHead(end, value)}><ArrowHeadIcon kind={value} /></button>)}</div></div>)}</div>
                    </Show>
                  </div>
                </Show>
                <Show when={sidebarTab() === "layers"}><button class="quick-layers-button" onClick={() => { setStyleMenuMode("full"); setQuickStylePopover(undefined); }}>Open layers panel ?</button></Show>
              </div>
              <div class="full-inspector">
              <div class="full-style-heading"><strong>Properties</strong><button onClick={() => { setStyleMenuMode("quick"); setQuickStylePopover(undefined); }}>Quick style</button></div>
              <nav class="sidebar-tabs"><button class={sidebarTab() === "properties" ? "active" : ""} onClick={() => setSidebarTab("properties")}>Properties</button><button class={sidebarTab() === "layers" ? "active" : ""} onClick={() => setSidebarTab("layers")}>Layers <span>{elements().length}</span></button></nav>
              <Show when={sidebarTab() === "properties"}>
                <Show when={showStrokeControls()}><section class="pane-section"><div class="pane-heading">{tool() === "text" || focusedElement()?.type === "text" ? "Text color" : "Stroke color"}</div><div class="swatch-list stroke-swatches">{swatches.map((swatch) => <button class={`color-swatch ${selectedColor() === swatch ? "active" : ""}`} style={{ background: swatch }} aria-label={`Set color ${swatch}`} title={swatch} onClick={() => updateStrokeColor(swatch)} />)}<label class="custom-color-swatch stroke-custom-swatch" title="Custom stroke color"><input aria-label="Custom stroke color" type="color" value={selectedColor()} onInput={(event) => updateStrokeColor(event.currentTarget.value)} /></label></div></section></Show>
                <Show when={showThicknessControls()}><section class="pane-section"><div class="pane-heading">Stroke width <span>{selectedThickness()} px</span></div><div class="preset-list">{([[1, "Ultra-thin"], [2, "Thin"], [5, "Medium"], [10, "Bold"]] as const).map(([value, label]) => <button class={`preset-button ${selectedThickness() === value ? "active" : ""}`} onClick={() => updateThickness(value)} title={`${label}, ${value}px`}><span class="stroke-indicator" style={{ height: `${Math.max(1, value)}px` }} /><small>{label}</small><small>{value}px</small></button>)}</div><button class="advanced-toggle" aria-expanded={showAdvancedThickness()} onClick={() => setShowAdvancedThickness((visible) => !visible)}>Custom width <span>{showAdvancedThickness() ? "−" : "+"}</span></button><Show when={showAdvancedThickness()}><input class="pane-slider" aria-label="Custom stroke thickness" type="range" min="1" max="24" value={selectedThickness()} onInput={(event) => updateThickness(Number(event.currentTarget.value))} /></Show></section></Show>
                <Show when={tool() === "text" || selectedText() || focusedElement() && isLabelShape(focusedElement()!)}><section class="pane-section"><div class="pane-heading">Text formatting</div><div class="format-row"><button class={(selectedText()?.bold ?? defaultBold()) ? "active" : ""} aria-label="Bold" title="Bold" onClick={() => setTextFormat("bold", !(selectedText()?.bold ?? defaultBold()))}><b>B</b></button><button class={(selectedText()?.italic ?? defaultItalic()) ? "active" : ""} aria-label="Italic" title="Italic" onClick={() => setTextFormat("italic", !(selectedText()?.italic ?? defaultItalic()))}><i>I</i></button><button class={(selectedText()?.underline ?? defaultUnderline()) ? "active" : ""} aria-label="Underline" title="Underline" onClick={() => setTextFormat("underline", !(selectedText()?.underline ?? defaultUnderline()))}><u>U</u></button></div><label class="property-label">Font size<input type="number" min="8" max="160" value={selectedText()?.fontSize ?? defaultFontSize()} onInput={(event) => setTextFormat("fontSize", Number(event.currentTarget.value))} /></label><div class="property-label">Font family<div class="choice-deck"><button class={(selectedText()?.fontFamily ?? defaultFontFamily()) === "sans" ? "active" : ""} title="Modern sans-serif" aria-label="Modern sans-serif font" onClick={() => setTextFormat("fontFamily", "sans")}><span class="font-sans-icon">Aa</span><small>Sans</small></button><button class={(selectedText()?.fontFamily ?? defaultFontFamily()) === "hand" ? "active" : ""} title="Handwritten" aria-label="Handwritten font" onClick={() => setTextFormat("fontFamily", "hand")}><span class="font-hand-icon">Aa</span><small>Hand</small></button><button class={(selectedText()?.fontFamily ?? defaultFontFamily()) === "serif" ? "active" : ""} title="Serif" aria-label="Serif font" onClick={() => setTextFormat("fontFamily", "serif")}><span style={{ "font-family": "Georgia,serif" }}>Aa</span><small>Serif</small></button><button class={(selectedText()?.fontFamily ?? defaultFontFamily()) === "mono" ? "active" : ""} title="Monospaced" aria-label="Monospaced font" onClick={() => setTextFormat("fontFamily", "mono")}><span style={{ "font-family": "monospace" }}>Aa</span><small>Mono</small></button></div></div><div class="property-label">Alignment<div class="choice-deck compact"><button class={(selectedText()?.textAlign ?? defaultTextAlign()) === "left" ? "active" : ""} title="Align left" aria-label="Align left" onClick={() => setTextFormat("textAlign", "left")}><svg viewBox="0 0 24 24"><path d="M4 5h16M4 10h11M4 15h16M4 20h11"/></svg></button><button class={(selectedText()?.textAlign ?? defaultTextAlign()) === "center" ? "active" : ""} title="Align center" aria-label="Align center" onClick={() => setTextFormat("textAlign", "center")}><svg viewBox="0 0 24 24"><path d="M4 5h16M7 10h10M4 15h16M7 20h10"/></svg></button><button class={(selectedText()?.textAlign ?? defaultTextAlign()) === "right" ? "active" : ""} title="Align right" aria-label="Align right" onClick={() => setTextFormat("textAlign", "right")}><svg viewBox="0 0 24 24"><path d="M4 5h16M9 10h11M4 15h16M9 20h11"/></svg></button></div></div><div class="property-label">Paragraphs<div class="choice-deck compact"><button class={(selectedText()?.listType ?? defaultListType()) === "none" ? "active" : ""} title="Plain paragraphs" aria-label="Plain paragraphs" onClick={() => setTextFormat("listType", "none")}><svg viewBox="0 0 24 24"><path d="M5 6h15M5 12h15M5 18h15"/></svg></button><button class={(selectedText()?.listType ?? defaultListType()) === "bullet" ? "active" : ""} title="Bulleted list" aria-label="Bulleted list" onClick={() => setTextFormat("listType", "bullet")}><svg viewBox="0 0 24 24"><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/><path d="M9 6h11M9 12h11M9 18h11"/></svg></button><button class={(selectedText()?.listType ?? defaultListType()) === "number" ? "active" : ""} title="Numbered list" aria-label="Numbered list" onClick={() => setTextFormat("listType", "number")}><svg viewBox="0 0 24 24"><path d="M4 5h2v3M4 8h3M4 12h3l-3 3h3M10 6h10M10 12h10M10 18h10"/></svg></button></div></div></section></Show>
                <Show when={focusedElement() && isLabelShape(focusedElement()!)}><section class="pane-section"><div class="pane-heading">Shape label</div>
                  <button class="quiet-button" disabled={boardLocked() || focusedElement()?.locked} onClick={() => { const index = primarySelection(); if (index !== undefined) editShapeLabel(index); }}>Edit label</button>
                  <label class="property-label">Font color<input type="color" value={textDraft()?.shapeLabel ? textDraft()!.color : selectedLabel()?.color ?? color()} onInput={event => updateLabel("color", event.currentTarget.value)} /></label>
                  <div class="property-label">Vertical alignment<div class="choice-deck">{(["top", "middle", "bottom"] as const).map((alignment, index) => <button title={`Align ${alignment}`} aria-label={`Align ${alignment}`} class={(textDraft()?.verticalAlign ?? selectedLabel()?.verticalAlign ?? "middle") === alignment ? "active" : ""} onClick={() => updateLabel("verticalAlign", alignment)}><svg viewBox="0 0 24 24"><path d={`M3 ${index === 0 ? 4 : index === 1 ? 12 : 20}h18M8 ${6 + index * 2}v6m8-6v6`}/></svg><small>{alignment}</small></button>)}</div></div>
                  <button class={`quiet-button ${selectedText()?.textAlign === "justify" ? "active" : ""}`} onClick={() => setTextFormat("textAlign", "justify")}>Justify text</button><p class="bucket-help">Double-click a shape to edit its label. Text wraps inside the shape.</p>
                </section></Show>
                <Show when={tool() === "line" || tool() === "arrow" || tool() === "rectangle" || tool() === "circle" || tool() === "diamond" || tool() === "triangle" || tool() === "flowchart" || ["line", "arrow", "rectangle", "circle", "diamond", "triangle", "flowchart"].includes(focusedElement()?.type ?? "")}><section class="pane-section"><div class="pane-heading">Line style</div><div class="choice-deck line-choices"><button class={((focusedElement() as ShapeElement | undefined)?.lineStyle ?? lineStyle()) === "solid" ? "active" : ""} title="Solid line" aria-label="Solid line" onClick={() => focusedElement() ? updateProperty("lineStyle", "solid") : setLineStyle("solid")}><svg viewBox="0 0 24 24"><path d="M3 12h18"/></svg><small>Solid</small></button><button class={((focusedElement() as ShapeElement | undefined)?.lineStyle ?? lineStyle()) === "dashed" ? "active" : ""} title="Dashed line" aria-label="Dashed line" onClick={() => focusedElement() ? updateProperty("lineStyle", "dashed") : setLineStyle("dashed")}><svg viewBox="0 0 24 24" class="dash-icon"><path d="M3 12h18"/></svg><small>Dash</small></button><button class={((focusedElement() as ShapeElement | undefined)?.lineStyle ?? lineStyle()) === "dotted" ? "active" : ""} title="Dotted line" aria-label="Dotted line" onClick={() => focusedElement() ? updateProperty("lineStyle", "dotted") : setLineStyle("dotted")}><svg viewBox="0 0 24 24" class="dot-icon"><path d="M3 12h18"/></svg><small>Dot</small></button><Show when={tool() === "line" || tool() === "arrow" || focusedElement()?.type === "line" || focusedElement()?.type === "arrow"}><button class={((focusedElement() as ShapeElement | undefined)?.lineStyle ?? lineStyle()) === "double" ? "active" : ""} title="Double line" aria-label="Double line" onClick={() => focusedElement() ? updateProperty("lineStyle", "double") : setLineStyle("double")}><svg viewBox="0 0 24 24"><path d="M3 9h18M3 15h18"/></svg><small>Double</small></button></Show></div><Show when={focusedElement()?.type === "rectangle" || tool() === "rectangle"}><div class="property-label">Corners<div class="choice-deck compact"><button class={((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "sharp" ? "active" : ""} title="Square corners" aria-label="Square corners" onClick={() => focusedElement() ? updateProperty("edgeStyle", "sharp") : setEdgeStyle("sharp")}><svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14"/></svg></button><button class={((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "rounded" ? "active" : ""} title="Rounded corners" aria-label="Rounded corners" onClick={() => focusedElement() ? updateProperty("edgeStyle", "rounded") : setEdgeStyle("rounded")}><svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="4"/></svg></button><button class={((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "pill" ? "active" : ""} title="Pill corners" aria-label="Pill corners" onClick={() => focusedElement() ? updateProperty("edgeStyle", "pill") : setEdgeStyle("pill")}><svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="8" rx="4"/></svg></button><button class={((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "cut" ? "active" : ""} title="Cut corners" aria-label="Cut corners" onClick={() => focusedElement() ? updateProperty("edgeStyle", "cut") : setEdgeStyle("cut")}><svg viewBox="0 0 24 24"><path d="m8 4h8l4 4v8l-4 4H8l-4-4V8z"/></svg></button></div></div></Show><Show when={tool() === "rectangle" || focusedElement()?.type === "rectangle"}><Show when={((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "rounded" || ((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "cut"}><label class="property-label">{((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "cut" ? "Corner cut" : "Corner radius"}<input type="range" min="0" max="64" value={focusedElement()?.type === "rectangle" ? (focusedElement() as ShapeElement).cornerRadius ?? 14 : cornerRadius()} onInput={event => { const radius = Number(event.currentTarget.value); setCornerRadius(radius); if (focusedElement()?.type === "rectangle") updateProperty("cornerRadius", radius); }} /><span>{focusedElement()?.type === "rectangle" ? (focusedElement() as ShapeElement).cornerRadius ?? 14 : cornerRadius()} px</span></label></Show></Show><Show when={tool() === "arrow" || tool() === "line" || focusedElement()?.type === "arrow" || focusedElement()?.type === "line"}><div class="arrow-head-config"><span>Start head</span><div class="choice-deck arrow-head-choices">{ARROW_HEADS.map(({ value, label }) => <button class={quickArrowHead("start") === value ? "active" : ""} title={`${label} start`} aria-label={`${label} start head`} onClick={() => setConnectorHead("start", value)}><ArrowHeadIcon kind={value} /></button>)}</div><span>End head</span><div class="choice-deck arrow-head-choices">{ARROW_HEADS.map(({ value, label }) => <button class={quickArrowHead("end") === value ? "active" : ""} title={`${label} end`} aria-label={`${label} end head`} onClick={() => setConnectorHead("end", value)}><ArrowHeadIcon kind={value} /></button>)}</div></div></Show></section></Show>
                <Show when={(tool() === "arrow" || focusedElement()?.type === "arrow") && (focusedElement()?.type === "arrow" ? (focusedElement() as ShapeElement).arrowRoute : arrowRoute()) === "forked"}><section class="pane-section"><div class="pane-heading">Fork branch heads</div><div class="fork-head-config"><span>Upper branch</span><div class="choice-deck arrow-head-choices">{ARROW_HEADS.map(({ value, label }) => <button class={((focusedElement()?.type === "arrow" ? (focusedElement() as ShapeElement).forkUpper?.endHead : undefined) ?? defaultForkUpperHead()) === value ? "active" : ""} title={`${label} upper branch head`} aria-label={`${label} upper branch head`} onClick={() => focusedElement()?.type === "arrow" ? updateProperty("forkUpperHead", value) : setDefaultForkUpperHead(value)}><ArrowHeadIcon kind={value} /></button>)}</div><span>Lower branch</span><div class="choice-deck arrow-head-choices">{ARROW_HEADS.map(({ value, label }) => <button class={((focusedElement()?.type === "arrow" ? (focusedElement() as ShapeElement).forkLower?.endHead : undefined) ?? defaultForkLowerHead()) === value ? "active" : ""} title={`${label} lower branch head`} aria-label={`${label} lower branch head`} onClick={() => focusedElement()?.type === "arrow" ? updateProperty("forkLowerHead", value) : setDefaultForkLowerHead(value)}><ArrowHeadIcon kind={value} /></button>)}</div></div><p class="bucket-help">Each branch has a separate endpoint handle. Drag either endpoint to move it or attach it to a shape.</p></section></Show>
            <Show when={tool() === "bucket"}><section class="pane-section"><div class="pane-heading">Bucket fill</div><p class="bucket-help">Click a closed shape to apply a solid color.</p><div class="fill-palette">{FILL_SWATCHES.map((swatch) => <button class={`color-swatch ${fillColor() === swatch ? "active" : ""}`} style={{ background: swatch }} aria-label={`Bucket color ${swatch}`} title={`Use ${swatch}`} onClick={() => setFillColor(swatch)} />)}<label class="custom-color-swatch" title="Choose custom bucket color"><input aria-label="Custom bucket color" type="color" value={fillColor()} onInput={(event) => setFillColor(event.currentTarget.value)} /></label></div></section></Show>
            <Show when={tool() === "line" || focusedElement()?.type === "line"}><section class="pane-section"><div class="pane-heading">Line route</div><div class="connector-route-buttons">{LINE_ROUTES.map((route) => <button class={(focusedElement()?.type === "line" ? (focusedElement() as ShapeElement).lineRoute : lineRoute()) === route.value ? "active" : ""} title={route.label} aria-label={`${route.label} line`} onClick={() => focusedElement()?.type === "line" ? updateProperty("lineRoute", route.value) : setLineRoute(route.value)}><svg viewBox="0 0 24 24"><path d={route.path} /></svg><small>{route.label}</small></button>)}</div></section></Show>
<Show when={tool() === "arrow" || focusedElement()?.type === "arrow"}><section class="pane-section"><div class="pane-heading">Arrow route</div><div class="connector-route-buttons">{ARROW_ROUTES.map((route) => <button class={(focusedElement()?.type === "arrow" ? (focusedElement() as ShapeElement).arrowRoute : arrowRoute()) === route.value ? "active" : ""} title={route.label} aria-label={`${route.label} arrow`} onClick={() => focusedElement()?.type === "arrow" ? updateProperty("arrowRoute", route.value) : setArrowRoute(route.value)}><svg viewBox="0 0 24 24"><path d={route.path} /></svg><small>{route.label}</small></button>)}</div></section></Show><Show when={tool() === "rectangle" || tool() === "circle" || tool() === "diamond" || tool() === "triangle" || tool() === "flowchart" || focusedElement()?.type === "rectangle" || focusedElement()?.type === "circle" || focusedElement()?.type === "diamond" || focusedElement()?.type === "triangle" || focusedElement()?.type === "flowchart"}><section class="pane-section"><div class="pane-heading">Fill</div><div class="fill-options"><button class={!(selectedFillColor()) && !fillEnabled() ? "active" : ""} onClick={() => { setFillEnabled(false); if (selectedIndices().length) updateProperty("fillColor", undefined); }}>None</button><button class={fillEnabled() || !!selectedFillColor() ? "active" : ""} onClick={() => { setFillEnabled(true); if (selectedIndices().length) updateProperty("fillColor", fillColor()); }}>Solid</button></div><div class="fill-style-row"><label class="fill-color-chip" title="Fill color"><input aria-label="Fill color" type="color" value={selectedFillColor() ?? fillColor()} onInput={(event) => { const value = event.currentTarget.value; setFillColor(value); if (hasStyleSelection()) updateProperty("fillColor", value); }} /></label><label class="fill-opacity-control">Opacity<input aria-label="Fill opacity" type="range" min="5" max="100" value={Math.round(((focusedElement() as ShapeElement | undefined)?.fillOpacity ?? fillOpacity()) * 100)} onInput={(event) => { const value = Number(event.currentTarget.value) / 100; setFillOpacity(value); if (selectedIndices().length) updateProperty("fillOpacity", value); }} /><span>{Math.round(((focusedElement() as ShapeElement | undefined)?.fillOpacity ?? fillOpacity()) * 100)}%</span></label></div></section></Show>
                <Show when={selectedIndices().length === 1 && !groupSelected()}><section class="pane-section"><div class="pane-heading">Precision</div><div class="precision-grid">{(["x", "y", "w", "h", "rotation"] as const).map(property => <label>{property === "rotation" ? "Angle °" : property.toUpperCase()}<input aria-label={`Selection ${property}`} type="number" step="1" disabled={boardLocked() || focusedElement()?.locked || (!!focusedElement() && isConnector(focusedElement()!) && (property === "w" || property === "h" || property === "rotation"))} value={Math.round((property === "rotation" ? focusedElement()?.rotation ?? 0 : focusedElement() ? elementBounds(focusedElement()!)[property] : 0) * 100) / 100} onChange={event => precision(property, Number(event.currentTarget.value))} /></label>)}</div>
                  <Show when={focusedElement() && isConnector(focusedElement()!)}><div class="precision-grid">{(["start", "end"] as const).flatMap(end => (["x", "y"] as const).map(axis => <label>{end} {axis.toUpperCase()}<input type="number" disabled={boardLocked() || focusedElement()?.locked} value={Math.round(((focusedElement() as ShapeElement)[axis] + (end === "end" ? (focusedElement() as ShapeElement)[axis === "x" ? "w" : "h"] : 0)) * 100) / 100} onChange={event => setEndpoint(end, axis, Number(event.currentTarget.value))} /></label>))}</div><Show when={focusedElement()?.type === "arrow" && (focusedElement() as ShapeElement).arrowRoute === "forked"}><div class="precision-grid">{(["upper", "lower"] as const).flatMap(branch => (["x", "y"] as const).map(axis => <label>{branch} {axis.toUpperCase()}<input type="number" disabled={boardLocked() || focusedElement()?.locked} value={Math.round(forkGeometry(focusedElement() as ShapeElement)[branch] [axis] * 100) / 100} onChange={event => setForkEndpoint(branch, axis, Number(event.currentTarget.value))} /></label>))}</div></Show><p class="bucket-help">Drag the circular endpoints to resize or attach. Fork branches have separate endpoints and attachment points.</p><button class="quiet-button" onClick={() => changeSelected(item => isConnector(item) ? { ...item, startBinding: undefined, endBinding: undefined, forkUpper: item.forkUpper ? { ...item.forkUpper, endBinding: undefined } : undefined, forkLower: item.forkLower ? { ...item.forkLower, endBinding: undefined } : undefined } : item)}>Detach endpoints</button><button class="quiet-button" onClick={() => changeSelected(item => isConnector(item) ? { ...item, routePoints: undefined, forkUpper: item.forkUpper ? { ...item.forkUpper, routePoints: undefined } : undefined, forkLower: item.forkLower ? { ...item.forkLower, routePoints: undefined } : undefined } : item)}>Reset route</button></Show>
                </section></Show>
                <Show when={selectedIndices().length > 1}><section class="pane-section"><div class="pane-heading">Align & distribute</div><div class="alignment-grid">{(["left", "center", "right", "top", "middle", "bottom", "horizontal", "vertical"] as const).map(command => <button disabled={boardLocked() || ((command === "horizontal" || command === "vertical") && selectedIndices().length < 3)} title={command === "horizontal" || command === "vertical" ? `Distribute ${command} gaps` : `Align ${command}`} onClick={() => alignSelection(command)}>{command}</button>)}</div></section></Show>
                <Show when={!!selectedIndices().length}><section class="pane-section"><div class="pane-heading">Selection</div><label class="property-label">Opacity <input disabled={selectedIndices().every((index) => !elements()[index] || elements()[index].locked)} type="range" min="10" max="100" value={Math.round(selectedOpacity() * 100)} onInput={(event) => updateProperty("opacity", Number(event.currentTarget.value) / 100)} /></label><Show when={!groupSelected() && !(focusedElement() && isConnector(focusedElement()!))}><div class="rotation-controls"><button disabled={focusedElement()?.locked} onClick={() => rotateSelection(-15)} title="Rotate counterclockwise by 15 degrees">−15°</button><button disabled={focusedElement()?.locked} onClick={resetSelectionRotation} title="Reset rotation to zero">Reset 0°</button><button disabled={focusedElement()?.locked} onClick={() => rotateSelection(15)} title="Rotate clockwise by 15 degrees">+15°</button></div></Show></section></Show>
                <Show when={selectedIndices().length > 1 && !groupSelected()}><button class="pane-group-button" onClick={groupSelection}>Group {selectedIndices().length} elements <kbd>Ctrl+G</kbd></button></Show>
              </Show>
              <Show when={sidebarTab() === "layers"}><div class="layer-list">{[...elements().keys()].reverse().map((index) => { const element = elements()[index]; const label = element.type === "text" ? `Text: ${element.text.slice(0, 18) || "Empty"}` : element.type === "group" ? `Group (${element.elements.length})` : element.type[0].toUpperCase() + element.type.slice(1); return <div class={`layer-row ${selectedSet().has(index) ? "selected" : ""}`}><button class="layer-name" onClick={() => setSelectedIndices([index])}>{label}</button><button title="Move layer up" aria-label="Move layer up" onClick={() => moveLayer(index, 1)}>↑</button><button title="Move layer down" aria-label="Move layer down" onClick={() => moveLayer(index, -1)}>↓</button><button title={element.hidden ? "Show layer" : "Hide layer"} aria-label="Toggle layer visibility" onClick={() => toggleLayer(index, "hidden")}>{element.hidden ? "Show" : "Hide"}</button><button title={element.locked ? "Unlock layer" : "Lock layer"} aria-label="Toggle layer lock" onClick={() => toggleLayer(index, "locked")}>{element.locked ? "Unlock" : "Lock"}</button></div>; })}</div></Show>
              </div>
            </aside></Show>
            <Show when={textDraft()}>{draft => <div class="text-editor-frame" style={{ left: `${canvasState().panX + editorLeft(draft()) * canvasState().zoom}px`, top: `${canvasState().panY + draft().y * canvasState().zoom}px`, width: `${editorWidth(draft()) * canvasState().zoom}px`, height: draft().height ? `${draft().height! * canvasState().zoom}px` : undefined, transform: `rotate(${draft().rotation ?? 0}deg)`, "justify-content": draft().verticalAlign === "bottom" ? "flex-end" : draft().verticalAlign === "middle" ? "center" : "flex-start", "font-size": `${draft().fontSize * canvasState().zoom}px`, "font-family": fontCss(draft().fontFamily), "font-weight": draft().bold ? 700 : 400, "font-style": draft().italic ? "italic" : "normal", "text-decoration": draft().underline ? "underline" : "none", "text-align": draft().textAlign, color: themeInk(draft().color, theme()), opacity: draft().opacity }}>
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
      <Show when={schemaDialog()}><div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setSchemaDialog(false); }}><section class="confirm-dialog schema-dialog" role="dialog" aria-modal="true" aria-labelledby="schema-title"><header><div><span class="eyebrow">DATABASE SCHEMA VISUALIZER</span><h2 id="schema-title">Generate linked table cards</h2></div><button class="help-close" aria-label="Close schema visualizer" onClick={() => setSchemaDialog(false)}>&times;</button></header><p>Paste SQL <code>CREATE TABLE</code> statements or JSON with a <code>tables</code> array. Primary and foreign keys become labeled rows with connectors anchored to those rows. Press Tab to indent and Shift+Tab to outdent.</p><textarea autofocus class="schema-input" aria-label="SQL or JSON schema" value={schemaInput()} placeholder={'CREATE TABLE users (\n  id INTEGER PRIMARY KEY,\n  name VARCHAR(80) NOT NULL\n);\n\nCREATE TABLE orders (\n  id INTEGER PRIMARY KEY,\n  user_id INTEGER REFERENCES users(id)\n);'} onInput={event => { setSchemaInput(event.currentTarget.value); setSchemaError(""); }} onKeyDown={event => { if (event.key === "Tab") indentTextarea(event, setSchemaInput); }} /><Show when={schemaError()}><p class="schema-error" role="alert">{schemaError()}</p></Show><div class="schema-dialog-footer"><span>Up to 50 tables per import</span><div><button class="quiet-button" onClick={() => setSchemaDialog(false)}>Cancel</button><button class="save-button" disabled={boardLocked()} onClick={insertSchemaVisual}>Add to canvas</button></div></div></section></div></Show>
      <Show when={pageDialog()}><div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setPageDialog(undefined); }}><section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="page-dialog-title"><h2 id="page-dialog-title">{pageDialog() === "rename" ? "Rename page" : "Delete page?"}</h2><Show when={pageDialog() === "rename"} fallback={<p>Delete “{currentPage()?.name}” and its contents? This page deletion cannot be undone.</p>}><label>Page name<input autofocus maxlength="80" value={pageName()} onInput={event => setPageName(event.currentTarget.value)} onKeyDown={event => { if (event.key === "Enter" && pageName().trim()) confirmPageDialog(); }} /></label></Show><div><button class="quiet-button" onClick={() => setPageDialog(undefined)}>Cancel</button><button class={pageDialog() === "delete" ? "danger-button" : "save-button"} disabled={boardLocked() || (pageDialog() === "rename" && !pageName().trim())} onClick={confirmPageDialog}>{pageDialog() === "rename" ? "Rename" : "Delete page"}</button></div></section></div></Show>
      <Show when={exportOptionsOpen()}><div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setExportOptionsOpen(false); }}><section class="confirm-dialog export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <header class="export-heading"><div><span class="eyebrow">EXPORT PREVIEW</span><h2 id="export-title">Export {exportFormat().toUpperCase()}</h2></div><button class="help-close" aria-label="Close export dialog" onClick={() => setExportOptionsOpen(false)}>&times;</button></header>
        <div class="export-layout"><div class="export-controls"><p>Choose what to export and review the result before saving.</p>
          <div class="export-scope">{(["drawing", "selection", "viewport"] as const).map(scope => <button class={exportScope() === scope ? "active" : ""} disabled={(scope === "selection" && !selectedIndices().length) || (exportFormat() === "pdf" && pdfPageSet() !== "current" && scope !== "drawing")} onClick={() => setExportScope(scope)}>{scope === "drawing" ? "Whole drawing" : scope === "selection" ? "Selection" : "Viewport"}</button>)}</div>
          <label class="export-transparent"><input type="checkbox" checked={exportGrid()} onChange={event => setExportGrid(event.currentTarget.checked)} /> Include visible grid</label>
          <Show when={exportFormat() === "pdf"}>
            <section class="pdf-settings"><div class="pdf-setting-heading">Sketch pages</div><div class="pdf-choice-row"><button class={pdfPageSet() === "current" ? "active" : ""} onClick={() => { setPdfPageSet("current"); setPdfPreviewPage(1); }}>Current page</button><button class={pdfPageSet() === "all" ? "active" : ""} onClick={() => { setPdfPageSet("all"); setExportScope("drawing"); setPdfLayout("fit"); setPdfPreviewPage(1); }}>All pages ({pages().length})</button><button class={pdfPageSet() === "range" ? "active" : ""} onClick={() => { setPdfPageSet("range"); setExportScope("drawing"); setPdfLayout("fit"); setPdfRangeStart(value => Math.min(value, pages().length)); setPdfRangeEnd(pages().length); setPdfPreviewPage(1); }}>Page range</button></div><Show when={pdfPageSet() === "range"}><div class="pdf-custom-size"><label>From page<input type="number" min="1" max={pages().length} value={pdfRangeStart()} onInput={event => setPdfRangeStart(Math.max(1, Math.min(pages().length, Number(event.currentTarget.value))))} /></label><label>To page<input type="number" min={pdfRangeStart()} max={pages().length} value={pdfRangeEnd()} onInput={event => setPdfRangeEnd(Math.max(pdfRangeStart(), Math.min(pages().length, Number(event.currentTarget.value))))} /></label></div></Show><div class="pdf-setting-heading">Paper size</div><div class="pdf-paper-grid">{([{ id: "a4", label: "A4" }, { id: "letter", label: "Letter" }, { id: "a3", label: "A3" }, { id: "legal", label: "Legal" }, { id: "tabloid", label: "Tabloid" }, { id: "custom", label: "Custom" }] as const).map(({ id, label }) => <button class={pdfPaper() === id ? "active" : ""} onClick={() => setPdfPaper(id)}>{label}</button>)}</div>
              <Show when={pdfPaper() === "custom"}><div class="pdf-custom-size"><label>Width (mm)<input type="number" min="25" max="1000" value={pdfCustomWidthMm()} onInput={event => setPdfCustomWidthMm(Number(event.currentTarget.value))} /></label><label>Height (mm)<input type="number" min="25" max="1000" value={pdfCustomHeightMm()} onInput={event => setPdfCustomHeightMm(Number(event.currentTarget.value))} /></label></div></Show>
              <div class="pdf-setting-heading">Orientation</div><div class="pdf-choice-row"><button class={pdfOrientation() === "portrait" ? "active" : ""} onClick={() => setPdfOrientation("portrait")}><svg viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="1"/></svg><span>Portrait</span></button><button class={pdfOrientation() === "landscape" ? "active" : ""} onClick={() => setPdfOrientation("landscape")}><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="1"/></svg><span>Landscape</span></button></div>
              <div class="pdf-setting-heading">Page layout</div><div class="pdf-choice-row"><button class={pdfLayout() === "fit" ? "active" : ""} onClick={() => { setPdfLayout("fit"); setPdfPreviewPage(1); }}><svg viewBox="0 0 24 24"><path d="M6 4h12v16H6zM9 8h6m-6 4h6m-6 4h4"/></svg><span>Fit on one page</span></button><button disabled={pdfPageSet() !== "current" || pdfColorMode() === "cmyk"} class={pdfLayout() === "tiled" ? "active" : ""} onClick={() => { setPdfLayout("tiled"); setPdfPreviewPage(1); }}><svg viewBox="0 0 24 24"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></svg><span>Multiple pages</span></button></div>
              <div class="pdf-custom-size pdf-output-settings"><label>Print quality<select value={pdfDpi()} onChange={event => setPdfDpi(Number(event.currentTarget.value) as 150 | 300)}><option value="150">150 DPI - standard</option><option value="300">300 DPI - high quality</option></select></label><label>Margins (mm)<input type="number" min="0" max="50" value={pdfMarginMm()} onInput={event => setPdfMarginMm(Number(event.currentTarget.value))} /></label></div>
              <Show when={pdfLayout() === "tiled"}><div class="pdf-custom-size pdf-output-settings"><label>Artwork width (px)<input type="number" min="1" max="12000" value={exportWidth()} onInput={event => setExportWidth(Number(event.currentTarget.value))} /></label><label>Artwork height (px)<input type="number" min="1" max="12000" value={exportHeight()} onInput={event => setExportHeight(Number(event.currentTarget.value))} /></label></div><label class="pdf-overlap-control">Page overlap <input type="range" min="0" max="20" value={pdfOverlapMm()} onInput={event => setPdfOverlapMm(Number(event.currentTarget.value))} /><span>{pdfOverlapMm()} mm</span></label></Show>
              <div class="pdf-custom-size pdf-output-settings"><label>Print color mode<select value={pdfColorMode()} disabled={pdfLayout() === "tiled"} onChange={event => setPdfColorMode(event.currentTarget.value as "rgb" | "cmyk" | "grayscale")}><option value="rgb">RGB color</option><option value="cmyk">CMYK press colors</option><option value="grayscale">Grayscale</option></select></label><label>Bleed (mm)<input type="number" min="0" max="20" value={pdfBleedMm()} onInput={event => setPdfBleedMm(Math.max(0, Math.min(20, Number(event.currentTarget.value))))} /></label></div><div class="pdf-custom-size pdf-output-settings"><label>PDF header<input maxlength="100" value={pdfHeader()} onInput={event => setPdfHeader(event.currentTarget.value)} placeholder="Optional header" /></label><label>PDF footer<input maxlength="100" value={pdfFooter()} onInput={event => setPdfFooter(event.currentTarget.value)} placeholder="Optional footer" /></label></div><label class="export-transparent"><input type="checkbox" checked={pdfCropMarks()} onChange={event => setPdfCropMarks(event.currentTarget.checked)} /> Add crop marks</label><div class="pdf-page-count"><strong>{pdfMetrics().pageCount} {pdfMetrics().pageCount === 1 ? "page" : "pages"}</strong><span>{pdfLayout() === "fit" ? "Vector shapes, selectable text, and images fit the printable area." : `${pdfMetrics().columns} columns by ${pdfMetrics().rows} rows, with matching edges overlapping.`}</span></div>
            </section>
          </Show>
          <Show when={exportFormat() !== "pdf"}><div class="export-dimensions"><label>Width<input type="number" min="1" max="12000" value={exportWidth()} onInput={event => setExportWidth(Number(event.currentTarget.value))} /></label><span>&times;</span><label>Height<input type="number" min="1" max="12000" value={exportHeight()} onInput={event => setExportHeight(Number(event.currentTarget.value))} /></label></div><label class="export-transparent"><input type="checkbox" checked={exportTransparent()} onChange={event => setExportTransparent(event.currentTarget.checked)} /> Transparent background</label></Show>
          <div class="export-actions"><button class="quiet-button" onClick={() => setExportOptionsOpen(false)}>Cancel</button><button class="save-button" onClick={() => { const format = exportFormat(); setExportOptionsOpen(false); void exportAs(format); }}>Export {exportFormat().toUpperCase()}{exportFormat() === "pdf" ? ` (${pdfMetrics().pageCount} pages)` : ""}</button></div>
        </div><div class="export-preview-panel"><div class="export-preview-label"><strong>Preview</strong><Show when={exportFormat() === "pdf"} fallback={<span>{exportWidth()} &times; {exportHeight()} px</span>}><div class="pdf-preview-pages"><button disabled={pdfPreviewPage() <= 1} aria-label="Previous PDF page" onClick={() => setPdfPreviewPage(value => Math.max(1, value - 1))}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10 3-5 5 5 5"/></svg></button><span>Page {pdfPreviewPage()} of {pdfMetrics().pageCount}</span><button disabled={pdfPreviewPage() >= pdfMetrics().pageCount} aria-label="Next PDF page" onClick={() => setPdfPreviewPage(value => Math.min(pdfMetrics().pageCount, value + 1))}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg></button></div></Show></div><div class="export-preview-frame" classList={{ transparent: exportFormat() !== "pdf" && exportTransparent() }}><canvas ref={exportPreviewCanvas} aria-label={`${exportFormat().toUpperCase()} export preview`} /></div><small>{exportFormat() === "pdf" && pdfPageSet() === "all" ? `Sketch page ${pdfPreviewPage()} of ${pages().length}` : exportScope() === "drawing" ? "Whole drawing" : exportScope() === "selection" ? "Selected objects" : "Current viewport"}{exportFormat() === "pdf" ? ` / ${pdfPageSpec().widthMm.toFixed(0)} x ${pdfPageSpec().heightMm.toFixed(0)} mm / ${pdfDpi()} DPI` : exportTransparent() ? " / transparent" : " / whiteboard background"}</small></div></div>
      </section></div></Show>
      <Show when={recoveryPrompt()}>{(recovery) => <div class="confirm-backdrop"><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="recovery-title"><h2 id="recovery-title">Recover unsaved work?</h2><p>SketchDraw found a local recovery copy for <strong>{recovery().path.split(/[\\/]/).pop()}</strong>. Restore it or continue with the saved file.</p><div><button class="quiet-button" onClick={discardRecovery}>Use saved file</button><button class="save-button" onClick={restoreRecovery}>Restore recovery</button></div></section></div>}</Show>
      <Show when={syncConflict()}>{(conflict) => <div class="confirm-backdrop"><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="conflict-title"><h2 id="conflict-title">File changed elsewhere</h2><p><strong>{conflict().path.split(/[\\/]/).pop()}</strong> was updated outside SketchDraw. Autosave is paused so neither version is overwritten without your choice.</p><div class="conflict-actions"><button class="quiet-button" onClick={() => void saveAs()}>Save my version as…</button><button class="quiet-button" onClick={reloadConflictingFile}>Load disk version</button><button class="danger-button" onClick={overwriteConflictingFile}>Overwrite disk version</button></div></section></div>}</Show>
      <Show when={showClearConfirm()}><div class="confirm-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setShowClearConfirm(false); }}><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="clear-title"><h2 id="clear-title">Clear this canvas?</h2><p>This will remove all {elements().length} items from the open sketch. You can undo this action.</p><div><button class="quiet-button" onClick={() => setShowClearConfirm(false)}>Cancel</button><button class="danger-button" onClick={() => { if (elements().length && !boardLocked()) { pushUndo(cloneElements(elements())); setElements([]); setSelectedIndices([]); setDirty(true); } setShowClearConfirm(false); }}>Clear canvas</button></div></section></div></Show>
      <Show when={helpOpen()}><div class="confirm-backdrop help-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setHelpOpen(false); }}><section class="confirm-dialog help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title"><header><div><span class="eyebrow">SKETCHDRAW GUIDE</span><h2 id="help-title">Help</h2></div><button class="help-close" aria-label="Close help" onClick={() => setHelpOpen(false)}>&times;</button></header><nav class="help-tabs" aria-label="Help sections"><button class={helpSection() === "guide" ? "active" : ""} onClick={() => setHelpSection("guide")}>Guide</button><button class={helpSection() === "shortcuts" ? "active" : ""} onClick={() => setHelpSection("shortcuts")}>Keyboard shortcuts</button></nav><div class="help-content"><Show when={helpSection() === "guide"} fallback={<section class="help-shortcuts-section"><h3>Keyboard shortcuts</h3><p>Use these shortcuts while the canvas is active. Text fields keep their standard editing shortcuts.</p><table class="shortcut-table"><thead><tr><th scope="col">Shortcut</th><th scope="col">Action</th></tr></thead><tbody>{helpShortcuts.map(([key, action]) => <tr><th scope="row"><kbd>{key}</kbd></th><td>{action}</td></tr>)}</tbody></table></section>}><div class="help-guide"><section><h3>Start a sketch</h3><p>Create a new file or open a version 6 <code>.sketch</code> document. SketchDraw saves edits to the active file automatically. The save dot and time show whether changes are saved or still being written.</p></section><section><h3>Draw and style</h3><p>Choose a tool from the floating toolbar, then click or drag on the canvas. The vertical quick-style rail holds common settings. Use its arrow to show the full properties panel. Line options include one-, two-, and three-control-point curves plus a four-point editable line; lines and arrows both support arrowheads. Newly drawn connectors keep their tool active and show draggable route handles. Hold Space or choose Hand to pan; use the mouse wheel to zoom around the pointer.</p></section><section><h3>Select and edit</h3><p>Use Select to click an object or drag a marquee around objects. Drag selected items to move them. Use handles to resize or rotate, and double-click a shape to edit its label. Select Text and single-click once to place text. The bucket fills a closed shape without selecting it. Right-click the canvas for object commands.</p></section><section><h3>Files, pages, and export</h3><p>Use File to create, open, save, import images, export PNG/SVG/PDF, or clear the canvas. Export opens a preview before writing the file. Add and manage pages from the page strip. Use View to change theme and whiteboard color. Autosave watches for outside file changes and asks before resolving conflicts.</p></section></div></Show></div><footer><span>&copy; 2026 Toushal Sampat. See the README and version 6 file format guide for details.</span><button class="save-button" onClick={() => setHelpOpen(false)}>Close</button></footer></section></div></Show>
      <Show when={error()}><div class="error-toast" role="alert">{error()}<button onClick={() => setError("")}>Dismiss</button></div></Show>
    </main>
  );
}

export default App;

