import type { ArrowHead, ArrowRoute, LineRoute, Point, ShapeElement } from "../../model";
import { strokeStyleLineGap } from "../canvas/stroke-style";

type Route = ArrowRoute | LineRoute;
type HeadEntry = { tip: Point; angle: number; kind: ArrowHead };

const endpointPair = (element: ShapeElement) => ({
  start: { x: element.x, y: element.y },
  end: { x: element.x + element.w, y: element.y + element.h },
});

function routeFor(element: ShapeElement): Route {
  return element.straightOnly ? "straight" : element.type === "arrow" ? element.arrowRoute ?? "straight" : element.lineRoute ?? "straight";
}

export function evenlyDivideConnectorPoints(element: ShapeElement, count: number): Point[] {
  const { start, end } = endpointPair(element);
  return Array.from({ length: count }, (_, index) => {
    const ratio = (index + 1) / (count + 1);
    return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
  });
}

/** Starts curves with evenly spaced nodes offset from the straight baseline. */
export function defaultCurveControlPoints(element: ShapeElement, count: number): Point[] {
  const { start, end } = endpointPair(element);
  const dx = end.x - start.x; const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const normal = length > 0.001 ? { x: -dy / length, y: dx / length } : { x: 0, y: 1 };
  const bend = Math.min(64, length * .24);
  return evenlyDivideConnectorPoints(element, count).map((point, index) => {
    const ratio = (index + 1) / (count + 1);
    const offset = bend * Math.sin(Math.PI * ratio);
    return { x: point.x + normal.x * offset, y: point.y + normal.y * offset };
  });
}

/** Returns curve nodes, including evenly spaced defaults for older sketches. */
export function connectorControlPoints(element: ShapeElement, route: Route = routeFor(element)): Point[] {
  if (element.routePoints !== undefined) return element.routePoints.map(point => ({ ...point }));
  const count = route === "curve" ? 1 : route === "loop" ? 2 : 0;
  return route === "loop" ? [connectorControls(element, true).c1, connectorControls(element, true).c2] : route === "curve" ? defaultCurveControlPoints(element, count) : [];
}

/** Kept as a geometry alias for sketch-file normalization during migration. */
export function curveControlPoints(element: ShapeElement, route: Route): Point[] {
  return connectorControlPoints(element, route);
}

export function connectorControls(element: ShapeElement, loop = false) {
  const { start, end } = endpointPair(element);
  const dx = end.x - start.x; const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy)); const normal = { x: -dy / length, y: dx / length };
  const bend = (loop ? .72 : .3) * length;
  const collapsed = loop && Math.hypot(dx, dy) < 1;
  return {
    start, end, dx, dy, normal,
    c1: collapsed ? { x: start.x + 24, y: start.y - 24 } : { x: start.x + dx / 3 + normal.x * bend, y: start.y + dy / 3 + normal.y * bend },
    c2: collapsed ? { x: end.x - 24, y: end.y - 24 } : { x: start.x + dx * 2 / 3 + normal.x * bend, y: start.y + dy * 2 / 3 + normal.y * bend },
  };
}

function lerp(from: Point, to: Point, ratio: number): Point {
  return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
}

function sampleCubic(start: Point, first: Point, second: Point, end: Point, count: number): Point[] {
  const result: Point[] = [];
  for (let index = 0; index <= count; index++) {
    const t = index / count; const u = 1 - t;
    result.push({
      x: u ** 3 * start.x + 3 * u ** 2 * t * first.x + 3 * u * t ** 2 * second.x + t ** 3 * end.x,
      y: u ** 3 * start.y + 3 * u ** 2 * t * first.y + 3 * u * t ** 2 * second.y + t ** 3 * end.y,
    });
  }
  return result;
}

/** Samples a smooth curve through its editable nodes with one consistent spline rule. */
function sampleSpline(nodes: Point[], sampleCount: number): Point[] {
  if (nodes.length < 3) return nodes.map(point => ({ ...point }));
  const output: Point[] = [{ ...nodes[0] }];
  const perSegment = Math.max(4, Math.ceil(sampleCount / (nodes.length - 1)));
  for (let segment = 0; segment < nodes.length - 1; segment++) {
    const previous = nodes[Math.max(0, segment - 1)];
    const start = nodes[segment]; const end = nodes[segment + 1];
    const next = nodes[Math.min(nodes.length - 1, segment + 2)];
    const first = { x: start.x + (end.x - previous.x) / 6, y: start.y + (end.y - previous.y) / 6 };
    const second = { x: end.x - (next.x - start.x) / 6, y: end.y - (next.y - start.y) / 6 };
    output.push(...sampleCubic(start, first, second, end, perSegment).slice(1));
  }
  return output;
}

function polylineTangent(points: Point[], atEnd: boolean): number {
  if (points.length < 2) return 0;
  const origin = atEnd ? points[points.length - 1] : points[0];
  const indices = atEnd ? [...points.keys()].reverse().slice(1) : [...points.keys()].slice(1);
  for (const index of indices) {
    const candidate = points[index];
    const dx = atEnd ? origin.x - candidate.x : candidate.x - origin.x;
    const dy = atEnd ? origin.y - candidate.y : candidate.y - origin.y;
    if (Math.hypot(dx, dy) > .001) return Math.atan2(dy, dx);
  }
  return 0;
}

/** Returns the visible three branches of a fork connector. */
export function forkGeometry(element: ShapeElement) {
  const { start, end, dx, dy, normal } = connectorControls(element);
  const spread = Math.max(24, Math.min(36, Math.hypot(dx, dy) * .16));
  const junction = element.routePoints?.[0] ?? lerp(start, end, .62);
  const upper = element.forkUpper?.end ?? { x: end.x + normal.x * spread, y: end.y + normal.y * spread };
  const lower = element.forkLower?.end ?? { x: end.x - normal.x * spread, y: end.y - normal.y * spread };
  const upperPath = [junction, ...(element.forkUpper?.routePoints ?? []), upper];
  const lowerPath = [junction, ...(element.forkLower?.routePoints ?? []), lower];
  return { start, end, junction, upper, lower, upperPath, lowerPath, normal };
}

export function jaggedVertices(element: ShapeElement): Point[] {
  const { start, end, normal } = connectorControls(element);
  const amplitude = Math.min(18, Math.hypot(element.w, element.h) * .13);
  return [start, ...[.2, .4, .6, .8].map((ratio, index) => ({
    x: start.x + element.w * ratio + normal.x * amplitude * (index % 2 ? -1 : 1),
    y: start.y + element.h * ratio + normal.y * amplitude * (index % 2 ? -1 : 1),
  })), end];
}

/** Produces the source path once for drawing, hit testing, bounds, and exports. */
export function connectorPolylines(element: ShapeElement, route: Route = routeFor(element), sampleCount = 49): Point[][] {
  const { start, end } = endpointPair(element);
  if (element.straightOnly) return [[start, end]];
  if (route === "forked" && element.type === "arrow") {
    const fork = forkGeometry(element);
    return [[fork.start, fork.junction], fork.upperPath, fork.lowerPath];
  }
  if (route === "jagged") return [jaggedVertices(element)];
  if (route === "elbow") {
    const points = element.routePoints?.length ? element.routePoints : [{ x: end.x, y: start.y }];
    return [[start, ...points, end]];
  }
  if (route === "loop") {
    const controls = connectorControlPoints(element, route);
    const { c1, c2 } = connectorControls(element, true);
    const first = controls[0] ?? c1; const second = controls[1] ?? c2;
    return [sampleCubic(start, first, second, end, sampleCount)];
  }
  if (route === "curve") {
    const points = connectorControlPoints(element, route);
    return [sampleSpline([start, ...points, end], sampleCount)];
  }
  const points = element.routePoints?.length ? element.routePoints : [];
  return [[start, ...points, end]];
}

export function arrowHeadLength(kind: ArrowHead, thickness: number): number {
  if (kind === "dot") return Math.max(3, thickness * 1.15);
  const length = Math.max(10, thickness * (kind === "thick" ? 5 : 3.5));
  return kind === "bar" ? length * .45 : length;
}

/** Trims only the route stroke, leaving its endpoint and arrowhead anchored. */
export function trimPolyline(points: Point[], distance: number, fromStart: boolean): Point[] {
  if (points.length < 2 || distance <= 0) return points;
  const result = points.map(point => ({ ...point }));
  let remaining = distance;
  while (result.length > 1 && remaining > 0) {
    const firstIndex = fromStart ? 0 : result.length - 1;
    const secondIndex = fromStart ? 1 : result.length - 2;
    const first = result[firstIndex]; const second = result[secondIndex];
    const length = Math.hypot(second.x - first.x, second.y - first.y);
    if (length <= remaining) { remaining -= length; result.splice(firstIndex, 1); continue; }
    const ratio = remaining / length;
    result[firstIndex] = lerp(first, second, ratio);
    remaining = 0;
  }
  return result;
}

/** Defines arrowhead vertices from the final path tangent instead of the box angle. */
export function arrowHeadPoints(tip: Point, angle: number, kind: ArrowHead, thickness: number): Point[] {
  const length = arrowHeadLength(kind, thickness);
  const direction = { x: Math.cos(angle), y: Math.sin(angle) };
  const normal = { x: -direction.y, y: direction.x };
  const back = (distance: number, side = 0) => ({ x: tip.x - direction.x * distance + normal.x * side, y: tip.y - direction.y * distance + normal.y * side });
  const width = length * (kind === "thick" ? .48 : .34);
  if (kind === "dot") { const radius = Math.max(3, thickness * 1.15); return [{ x: tip.x - radius, y: tip.y - radius }, { x: tip.x + radius, y: tip.y + radius }]; }
  if (kind === "bar") return [back(length, -width), back(length, width)];
  if (kind === "crow") return [back(length, -width), back(length, 0), back(length, width)];
  if (kind === "diamond" || kind === "open-diamond") return [tip, back(length * .55, width), back(length, 0), back(length * .55, -width)];
  if (kind === "open") return [back(length, width), back(length, -width)];
  return [tip, back(length, width), back(length, -width)];
}

export function arrowHeadSvgPath(tip: Point, angle: number, kind: ArrowHead, thickness: number): string {
  const points = arrowHeadPoints(tip, angle, kind, thickness);
  if (kind === "none" || kind === "dot") return "";
  if (kind === "open") return `M ${tip.x} ${tip.y} L ${points[0].x} ${points[0].y} M ${tip.x} ${tip.y} L ${points[1].x} ${points[1].y}`;
  if (kind === "crow") return points.map(point => `M ${tip.x} ${tip.y} L ${point.x} ${point.y}`).join(" ");
  if (kind === "bar") return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  return `M ${points.map(point => `${point.x} ${point.y}`).join(" L ")}${["solid", "hollow", "thick", "diamond", "open-diamond"].includes(kind) ? " Z" : ""}`;
}

function routeHeadEntries(element: ShapeElement, route: Route): HeadEntry[] {
  const paths = connectorPolylines(element, route);
  const entries: HeadEntry[] = [];
  const startKind = element.startHead ?? "none";
  if (startKind !== "none" && paths[0]?.length) entries.push({ tip: paths[0][0], angle: polylineTangent(paths[0], false) + Math.PI, kind: startKind });
  if (route === "forked" && element.type === "arrow") {
    const fork = forkGeometry(element);
    const upper = fork.upperPath; const lower = fork.lowerPath;
    for (const [branch, path] of [[element.forkUpper, upper], [element.forkLower, lower]] as const) {
      const kind = branch?.endHead ?? element.endHead ?? "open";
      if (kind !== "none" && path.length) entries.push({ tip: path[path.length - 1], angle: polylineTangent(path, true), kind });
    }
  } else {
    const endKind = element.endHead ?? (element.type === "arrow" ? "open" : "none");
    const path = paths[0];
    if (endKind !== "none" && path?.length) entries.push({ tip: path[path.length - 1], angle: polylineTangent(path, true), kind: endKind });
  }
  return entries;
}

export function arrowHeadEntries(element: ShapeElement, route: Route): HeadEntry[] {
  return routeHeadEntries(element, route);
}

function trimByHeads(element: ShapeElement, route: Route, paths: Point[][]): Point[][] {
  const startHead = element.startHead ?? "none";
  if (route === "forked" && element.type === "arrow") {
    const output = paths.map(path => path.map(point => ({ ...point })));
    if (startHead !== "none" && output[0]) output[0] = trimPolyline(output[0], arrowHeadLength(startHead, element.thickness), true);
    for (const [index, kind] of [element.forkUpper?.endHead ?? element.endHead ?? "open", element.forkLower?.endHead ?? element.endHead ?? "open"].entries()) {
      if (kind !== "none" && output[index + 1]) output[index + 1] = trimPolyline(output[index + 1], arrowHeadLength(kind, element.thickness), false);
    }
    return output;
  }
  const endHead = element.endHead ?? (element.type === "arrow" ? "open" : "none");
  return paths.map((path, index) => {
    let result = path;
    if (index === 0 && startHead !== "none") result = trimPolyline(result, arrowHeadLength(startHead, element.thickness), true);
    if (index === 0 && endHead !== "none") result = trimPolyline(result, arrowHeadLength(endHead, element.thickness), false);
    return result;
  });
}

export function doubleConnectorPolylines(element: ShapeElement): Point[][] {
  const route = routeFor(element); const offset = strokeStyleLineGap("double", element.thickness);
  const paths = connectorPolylines(element, route);
  const offsetPath = (path: Point[], direction: -1 | 1) => path.map((point, index) => {
    const before = path[Math.max(0, index - 1)]; const after = path[Math.min(path.length - 1, index + 1)];
    const dx = after.x - before.x; const dy = after.y - before.y; const length = Math.max(.001, Math.hypot(dx, dy));
    return { x: point.x - dy / length * offset * direction, y: point.y + dx / length * offset * direction };
  });
  return [...trimByHeads(element, route, paths.map(path => offsetPath(path, 1))), ...trimByHeads(element, route, paths.map(path => offsetPath(path, -1)))];
}

export function connectorPoint(element: ShapeElement, route: Route, t: number): Point {
  const path = connectorPolylines(element, route, 96)[0] ?? [];
  if (!path.length) return { x: element.x, y: element.y };
  const lengths = [0];
  for (let index = 1; index < path.length; index++) lengths.push(lengths[index - 1] + Math.hypot(path[index].x - path[index - 1].x, path[index].y - path[index - 1].y));
  const target = Math.max(0, Math.min(1, t)) * (lengths[lengths.length - 1] || 1);
  const segment = Math.max(1, lengths.findIndex(length => length >= target));
  const span = lengths[segment] - lengths[segment - 1] || 1;
  return lerp(path[segment - 1], path[segment], (target - lengths[segment - 1]) / span);
}

export function connectorTangent(element: ShapeElement, route: Route, atEnd: boolean): number {
  return polylineTangent(connectorPolylines(element, route, 96)[0] ?? [], atEnd);
}

function drawnPolylines(element: ShapeElement): Point[][] {
  const route = routeFor(element);
  return trimByHeads(element, route, connectorPolylines(element, route));
}

export function traceConnector(ctx: CanvasRenderingContext2D, element: ShapeElement): void {
  ctx.beginPath();
  for (const path of drawnPolylines(element)) {
    if (!path.length) continue;
    ctx.moveTo(path[0].x, path[0].y);
    for (const point of path.slice(1)) ctx.lineTo(point.x, point.y);
  }
}

export function connectorSvgPath(element: ShapeElement): string {
  const paths = element.lineStyle === "double" ? doubleConnectorPolylines(element) : drawnPolylines(element);
  return paths.map(path => path.length ? `M ${path.map(point => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" L ")}` : "").filter(Boolean).join(" ");
}
