import type { Point, ArrowHead, FlowchartShape, ArrowRoute, LineRoute, ShapeElement } from "../../model";
import { extraFlowchartPath } from "../../operations";

const connectorCache = new WeakMap<ShapeElement, Map<string, Point[][]>>();

export function arrowHeadPoints(tip: Point, angle: number, type: ArrowHead, thickness: number): Point[] {
  const length = Math.max(10, thickness * (type === "thick" ? 5 : 3.5));
  const pointAt = (distance: number, rotation: number): Point => ({ x: tip.x + Math.cos(angle + rotation) * distance, y: tip.y + Math.sin(angle + rotation) * distance });
  if (type === "solid" || type === "hollow" || type === "thick") return [tip, pointAt(length, Math.PI - Math.PI / (type === "thick" ? 4 : 6)), pointAt(length, Math.PI + Math.PI / (type === "thick" ? 4 : 6))];
  if (type === "diamond" || type === "open-diamond") return [tip, pointAt(length * .55, Math.PI - .45), pointAt(length, Math.PI), pointAt(length * .55, Math.PI + .45)];
  if (type === "crow") return [pointAt(length, Math.PI - Math.PI / 5), pointAt(length, Math.PI), pointAt(length, Math.PI + Math.PI / 5)];
  if (type === "open" || type === "bar") return type === "bar" ? [pointAt(length * .45, Math.PI / 2), pointAt(length * .45, -Math.PI / 2)] : [pointAt(length, Math.PI - Math.PI / 6), pointAt(length, Math.PI + Math.PI / 6)];
  return [];
}
export function arrowHeadSvgPath(tip: Point, angle: number, type: ArrowHead, thickness: number): string {
  const points = arrowHeadPoints(tip, angle, type, thickness);
  if (type === "open") return `M ${tip.x} ${tip.y} L ${points[0].x} ${points[0].y} M ${tip.x} ${tip.y} L ${points[1].x} ${points[1].y}`;
  if (type === "crow") return points.map(point => `M ${tip.x} ${tip.y} L ${point.x} ${point.y}`).join(" ");
  if (type === "dot") { const radius = Math.max(3, thickness * 1.15); return `M ${tip.x - radius} ${tip.y} A ${radius} ${radius} 0 1 0 ${tip.x + radius} ${tip.y} A ${radius} ${radius} 0 1 0 ${tip.x - radius} ${tip.y} Z`; }
  if (!points.length) return "";
  return `M ${points.map(point => `${point.x} ${point.y}`).join(" L ")}${["solid", "hollow", "thick", "diamond", "open-diamond"].includes(type) ? " Z" : ""}`;
}
export function pointInPolygon(point: Point, points: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]; const b = points[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export function traceFlowchart(ctx: CanvasRenderingContext2D, shape: FlowchartShape, x: number, y: number, w: number, h: number) {
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
export function flowchartPathObject(shape: FlowchartShape, x: number, y: number, w: number, h: number) {
  const left = Math.min(x, x + w); const top = Math.min(y, y + h);
  const source = extraFlowchartPath(shape, left, top, Math.abs(w), Math.abs(h));
  return source ? new Path2D(source) : undefined;
}
export function traceFlowchartDetails(ctx: CanvasRenderingContext2D, shape: FlowchartShape, x: number, y: number, w: number, h: number) {
  if (shape !== "database") return;
  const left = Math.min(x, x + w); const top = Math.min(y, y + h); const width = Math.abs(w); const height = Math.abs(h);
  if (width < 1 || height < 1) return;
  const rim = flowchartDatabaseRimPath(left, top, width, height);
  // Rendering uses a Path2D so the rim never replaces the current canvas path.
  ctx.save();
  ctx.stroke(rim);
  ctx.restore();
}
export function flowchartDatabaseRimPath(left: number, top: number, width: number, height: number): Path2D {
  const ry = Math.min(height * .18, width * .25); const mid = left + width / 2; const right = left + width; const rx = width / 2; const k = .55228475;
  const rim = new Path2D();
  rim.moveTo(left, top + ry);
  rim.bezierCurveTo(left, top + ry + k * ry, mid - k * rx, top + 2 * ry, mid, top + 2 * ry);
  rim.bezierCurveTo(mid + k * rx, top + 2 * ry, right, top + ry + k * ry, right, top + ry);
  return rim;
}
export function connectorControls(element: ShapeElement, loop = false) {
  const start = { x: element.x, y: element.y }; const end = { x: element.x + element.w, y: element.y + element.h };
  const dx = end.x - start.x; const dy = end.y - start.y; const length = Math.max(1, Math.hypot(dx, dy)); const normal = { x: -dy / length, y: dx / length };
  const bend = (loop ? .72 : .3) * length;
  return { start, end, dx, dy, c1: element.routePoints?.[0] ?? { x: start.x + dx / 3 + normal.x * bend, y: start.y + dy / 3 + normal.y * bend }, c2: element.routePoints?.[1] ?? { x: start.x + dx * 2 / 3 + normal.x * bend, y: start.y + dy * 2 / 3 + normal.y * bend }, normal };
}
export function curveControlPoints(element: ShapeElement, route: LineRoute | ArrowRoute): Point[] {
  const defaults = connectorControls({ ...element, routePoints: undefined }, route === "loop");
  const count = route === "curve" ? 1 : route === "curve2" ? 2 : route === "curve3" ? 3 : route === "loop" ? 2 : 0;
  if (!count) return [];
  const fallback = route === "curve" ? [defaults.c1] : route === "curve2" || route === "loop" ? [defaults.c1, defaults.c2] : [0.25, 0.5, 0.75].map((ratio) => ({ x: defaults.start.x + defaults.dx * ratio + defaults.normal.x * Math.max(1, Math.hypot(defaults.dx, defaults.dy) * 0.3), y: defaults.start.y + defaults.dy * ratio + defaults.normal.y * Math.max(1, Math.hypot(defaults.dx, defaults.dy) * 0.3) }));
  return fallback.slice(0, count).map((point, index) => element.routePoints?.[index] ?? point);
}
export function evaluateBezier(points: Point[], t: number): Point {
  const work = points.map((point) => ({ ...point }));
  for (let count = work.length - 1; count > 0; count--) for (let index = 0; index < count; index++) {
    work[index] = { x: work[index].x + (work[index + 1].x - work[index].x) * t, y: work[index].y + (work[index + 1].y - work[index].y) * t };
  }
  return work[0];
}
export function forkGeometry(element: ShapeElement) {
  const { start, end, dx, dy, normal } = connectorControls(element);
  const length = Math.max(1, Math.hypot(dx, dy)); const spread = Math.max(24, Math.min(36, length * .16));
  const junction = element.routePoints?.[0] ?? { x: start.x + dx * .62, y: start.y + dy * .62 };
  const upper = element.forkUpper?.end ?? { x: end.x + normal.x * spread, y: end.y + normal.y * spread };
  const lower = element.forkLower?.end ?? { x: end.x - normal.x * spread, y: end.y - normal.y * spread };
  const upperPath = [junction, ...(element.forkUpper?.routePoints ?? []), upper];
  const lowerPath = [junction, ...(element.forkLower?.routePoints ?? []), lower];
  return { start, end, junction, upper, lower, upperPath, lowerPath, normal };
}
export function jaggedVertices(element: ShapeElement): Point[] {
  const { start, end, normal } = connectorControls(element); const length = Math.hypot(element.w, element.h); const amplitude = Math.min(18, length * .13);
  return [start, ...[.2, .4, .6, .8].map((t, index) => ({ x: start.x + element.w * t + normal.x * amplitude * (index % 2 ? -1 : 1), y: start.y + element.h * t + normal.y * amplitude * (index % 2 ? -1 : 1) })), end];
}
export function connectorPolylines(element: ShapeElement, route: ArrowRoute | LineRoute, sampleCount = 49): Point[][] {
  if (element.straightOnly) return [[{ x: element.x, y: element.y }, { x: element.x + element.w, y: element.y + element.h }]];
  const key = `${route}:${sampleCount}`; const cache = connectorCache.get(element); const existing = cache?.get(key); if (existing) return existing;
  const points = element.routePoints?.length && !["curve", "curve2", "curve3", "loop", "forked"].includes(route) ? [[{ x: element.x, y: element.y }, ...element.routePoints, { x: element.x + element.w, y: element.y + element.h }]] : route === "forked"
    ? (() => { const fork = forkGeometry(element); return [[fork.start, fork.junction], fork.upperPath, fork.lowerPath]; })()
    : route === "jagged" ? [jaggedVertices(element)]
      : [Array.from({ length: sampleCount }, (_, index) => connectorPoint(element, route, index / (sampleCount - 1)))];
  if (cache) cache.set(key, points); else connectorCache.set(element, new Map([[key, points]]));
  return points;
}
export function arrowHeadLength(kind: ArrowHead, thickness: number) {
  if (kind === "dot") return Math.max(3, thickness * 1.15);
  const length = Math.max(10, thickness * (kind === "thick" ? 5 : 3.5));
  return kind === "bar" ? length * .45 : length;
}
export function trimPolyline(points: Point[], distance: number, fromStart: boolean): Point[] {
  if (points.length < 2 || distance <= 0) return points;
  const output = points.map(point => ({ ...point }));
  let remaining = distance;
  if (fromStart) {
    while (output.length > 1 && remaining > 0) {
      const first = output[0], second = output[1]; const length = Math.hypot(second.x - first.x, second.y - first.y);
      if (length <= remaining) { remaining -= length; output.shift(); continue; }
      const ratio = remaining / length; output[0] = { x: first.x + (second.x - first.x) * ratio, y: first.y + (second.y - first.y) * ratio }; remaining = 0;
    }
  } else {
    while (output.length > 1 && remaining > 0) {
      const last = output[output.length - 1], previous = output[output.length - 2]; const length = Math.hypot(last.x - previous.x, last.y - previous.y);
      if (length <= remaining) { remaining -= length; output.pop(); continue; }
      const ratio = remaining / length; output[output.length - 1] = { x: last.x + (previous.x - last.x) * ratio, y: last.y + (previous.y - last.y) * ratio }; remaining = 0;
    }
  }
  return output;
}
function straightConnectorPolyline(element: ShapeElement): Point[] {
  let points: Point[] = [{ x: element.x, y: element.y }, { x: element.x + element.w, y: element.y + element.h }];
  if (element.startHead && element.startHead !== "none") points = trimPolyline(points, arrowHeadLength(element.startHead, element.thickness), true);
  const endHead = element.endHead ?? (element.type === "arrow" ? "open" : "none");
  if (endHead !== "none") points = trimPolyline(points, arrowHeadLength(endHead, element.thickness), false);
  return points;
}
export function doubleConnectorPolylines(element: ShapeElement): Point[][] {
  const route = element.straightOnly ? "straight" : element.type === "arrow" ? element.arrowRoute ?? "straight" : element.lineRoute ?? "straight";
  const paths = connectorPolylines(element, route).map(points => [...points]);
  if (!paths.length) return paths;
  if (element.startHead && element.startHead !== "none") paths[0] = trimPolyline(paths[0], arrowHeadLength(element.startHead, element.thickness), true);
  if (route === "forked" && element.type === "arrow") {
    const upper = element.forkUpper?.endHead ?? element.endHead ?? "open";
    const lower = element.forkLower?.endHead ?? element.endHead ?? "open";
    if (upper !== "none" && paths[1]) paths[1] = trimPolyline(paths[1], arrowHeadLength(upper, element.thickness), false);
    if (lower !== "none" && paths[2]) paths[2] = trimPolyline(paths[2], arrowHeadLength(lower, element.thickness), false);
  } else {
    const end = element.endHead ?? (element.type === "arrow" ? "open" : "none");
    if (end !== "none") paths[0] = trimPolyline(paths[0], arrowHeadLength(end, element.thickness), false);
  }
  return paths;
}
export function arrowHeadEntries(element: ShapeElement, route: ArrowRoute | LineRoute): { tip: Point; angle: number; kind: ArrowHead }[] {
  if (element.straightOnly) route = "straight";
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
export function connectorPoint(element: ShapeElement, route: ArrowRoute | LineRoute, t: number): Point {
  if (element.straightOnly) route = "straight";
  const { start, end } = connectorControls(element, route === "loop");
  if (route === "elbow") { const middle = { x: end.x, y: start.y }; return t < .5 ? { x: start.x + (middle.x - start.x) * t * 2, y: start.y } : { x: middle.x, y: middle.y + (end.y - middle.y) * (t - .5) * 2 }; }
  if (route === "jagged") { const points = jaggedVertices(element); const scaled = t * (points.length - 1); const segment = Math.min(points.length - 2, Math.floor(scaled)); const local = scaled - segment; return { x: points[segment].x + (points[segment + 1].x - points[segment].x) * local, y: points[segment].y + (points[segment + 1].y - points[segment].y) * local }; }
  if (route === "curve" || route === "curve2" || route === "curve3" || route === "loop") return evaluateBezier([start, ...curveControlPoints(element, route), end], t);
  return { x: start.x + element.w * t, y: start.y + element.h * t };
}
export function connectorTangent(element: ShapeElement, route: ArrowRoute | LineRoute, atEnd: boolean): number {
  if (element.straightOnly) route = "straight";
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
export function traceConnector(ctx: CanvasRenderingContext2D, element: ShapeElement) {
  const route: ArrowRoute | LineRoute = element.straightOnly ? "straight" : element.type === "arrow" ? element.arrowRoute ?? "straight" : element.lineRoute ?? "straight";
  const { start, end, c1, c2 } = connectorControls(element, route === "loop");
  ctx.beginPath();
  if (element.straightOnly) { const points = straightConnectorPolyline(element); if (points.length) { ctx.moveTo(points[0].x, points[0].y); for (const point of points.slice(1)) ctx.lineTo(point.x, point.y); } return; }
  ctx.moveTo(start.x, start.y);
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
export function connectorSvgPath(element: ShapeElement): string {
  const route = element.straightOnly ? "straight" : element.type === "arrow" ? element.arrowRoute ?? "straight" : element.lineRoute ?? "straight";
  const straight = element.straightOnly ? straightConnectorPolyline(element) : undefined;
  const paths = element.lineStyle === "double" ? doubleConnectorPolylines(element) : straight ? [straight] : connectorPolylines(element, route);
  return paths.map((points) => `M ${points.map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" L ")}`).join(" ");
}
export function flowchartSvgPath(element: ShapeElement): string {
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
export function vectorFlowchartPath(element: ShapeElement): string {
  const x=element.x,y=element.y,w=element.w,h=element.h; const left=Math.min(x,x+w),top=Math.min(y,y+h),width=Math.abs(w),height=Math.abs(h),right=left+width,bottom=top+height,middle=left+width/2;
  if(element.flowchartShape==="terminator"){const r=Math.min(width/2,height/2);return `M ${left+r} ${top} H ${right-r} Q ${right} ${top} ${right} ${top+r} V ${bottom-r} Q ${right} ${bottom} ${right-r} ${bottom} H ${left+r} Q ${left} ${bottom} ${left} ${bottom-r} V ${top+r} Q ${left} ${top} ${left+r} ${top} Z`;}
  if(element.flowchartShape==="connector"){const rx=width/2,ry=height/2,k=.55228475;return `M ${middle+rx} ${top+ry} C ${middle+rx} ${top+ry+k*ry} ${middle+k*rx} ${top+height} ${middle} ${top+height} C ${middle-k*rx} ${top+height} ${left} ${top+ry+k*ry} ${left} ${top+ry} C ${left} ${top+ry-k*ry} ${middle-k*rx} ${top} ${middle} ${top} C ${middle+k*rx} ${top} ${right} ${top+ry-k*ry} ${right} ${top+ry} Z`;}
  return flowchartSvgPath(element);
}
export function flowchartSvgDetailPath(element: ShapeElement): string {
  if ((element.flowchartShape ?? "process") !== "database") return "";
  const left = Math.min(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const width = Math.abs(element.w); const height = Math.abs(element.h); const ry = Math.min(height * .18, width * .25);
  if (width < 1 || height < 1) return "";
  const middle = left + width / 2; const right = left + width; const rx = width / 2; const k = .55228475;
  return `M ${left} ${top + ry} C ${left} ${top + ry + k * ry}, ${middle - k * rx} ${top + 2 * ry}, ${middle} ${top + 2 * ry} C ${middle + k * rx} ${top + 2 * ry}, ${right} ${top + ry + k * ry}, ${right} ${top + ry}`;
}
