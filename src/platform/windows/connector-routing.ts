import type { Element, Point, ShapeElement } from "../../model";
import { elementBounds } from "../../features/canvas/bounds";

type Rect = { left: number; top: number; right: number; bottom: number };
type CachedRoute = { key: string; points: Point[] };
const routeCache = new WeakMap<ShapeElement, CachedRoute>();

function flat(items: Element[]): Element[] {
  return items.flatMap(item => item.type === "group" ? flat(item.elements) : [item]);
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x; const dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length)) : 0;
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

function blockedPoint(point: Point, rects: Rect[]) {
  return rects.some(rect => point.x > rect.left + 1e-5 && point.x < rect.right - 1e-5 && point.y > rect.top + 1e-5 && point.y < rect.bottom - 1e-5);
}

function blockedSegment(a: Point, b: Point, rects: Rect[]) {
  return rects.some(rect => {
    if (Math.abs(a.y - b.y) < 1e-6) return a.y > rect.top + 1e-5 && a.y < rect.bottom - 1e-5 && Math.max(Math.min(a.x, b.x), rect.left + 1e-5) < Math.min(Math.max(a.x, b.x), rect.right - 1e-5);
    return a.x > rect.left + 1e-5 && a.x < rect.right - 1e-5 && Math.max(Math.min(a.y, b.y), rect.top + 1e-5) < Math.min(Math.max(a.y, b.y), rect.bottom - 1e-5);
  });
}

function routeLeg(start: Point, end: Point, rects: Rect[]): Point[] | undefined {
  if (start.x === end.x && start.y === end.y) return [start, end];
  const xs = [...new Set([start.x, end.x, ...rects.flatMap(rect => [rect.left, rect.right])])].sort((a, b) => a - b);
  const ys = [...new Set([start.y, end.y, ...rects.flatMap(rect => [rect.top, rect.bottom])])].sort((a, b) => a - b);
  const width = xs.length; const height = ys.length; const nodeCount = width * height;
  const pointAt = (node: number): Point => ({ x: xs[Math.floor(node / height)], y: ys[node % height] });
  const nodeAt = (x: number, y: number) => xs.indexOf(x) * height + ys.indexOf(y);
  const startNode = nodeAt(start.x, start.y); const endNode = nodeAt(end.x, end.y);
  const stateCount = nodeCount * 3; const costs = new Float64Array(stateCount); costs.fill(Infinity);
  const previous = new Int32Array(stateCount); previous.fill(-1);
  const open: { state: number; score: number }[] = [];
  const push = (state: number, score: number) => {
    let index = open.length; open.push({ state, score });
    while (index > 0) { const parent = (index - 1) >> 1; if (open[parent].score <= score) break; open[index] = open[parent]; index = parent; }
    open[index] = { state, score };
  };
  const pop = () => {
    const first = open[0]; const last = open.pop()!;
    if (open.length) {
      let index = 0;
      while (true) { const left = index * 2 + 1; const right = left + 1; if (left >= open.length) break; const child = right < open.length && open[right].score < open[left].score ? right : left; if (open[child].score >= last.score) break; open[index] = open[child]; index = child; }
      open[index] = last;
    }
    return first;
  };
  const heuristic = (node: number) => { const point = pointAt(node); return Math.abs(point.x - end.x) + Math.abs(point.y - end.y); };
  const initial = startNode * 3 + 2; costs[initial] = 0; push(initial, heuristic(startNode));
  let found = -1;
  while (open.length) {
    const { state } = pop(); const node = Math.floor(state / 3); const direction = state % 3;
    if (node === endNode) { found = state; break; }
    const ix = Math.floor(node / height); const iy = node % height; const here = pointAt(node);
    const neighbors: { node: number; direction: number }[] = [];
    if (ix > 0) neighbors.push({ node: (ix - 1) * height + iy, direction: 0 });
    if (ix + 1 < width) neighbors.push({ node: (ix + 1) * height + iy, direction: 0 });
    if (iy > 0) neighbors.push({ node: ix * height + iy - 1, direction: 1 });
    if (iy + 1 < height) neighbors.push({ node: ix * height + iy + 1, direction: 1 });
    for (const neighbor of neighbors) {
      const next = pointAt(neighbor.node);
      if (blockedPoint(next, rects) || blockedSegment(here, next, rects)) continue;
      const edge = Math.abs(next.x - here.x) + Math.abs(next.y - here.y);
      const nextState = neighbor.node * 3 + neighbor.direction;
      const cost = costs[state] + edge + (direction !== 2 && direction !== neighbor.direction ? 28 : 0);
      if (cost >= costs[nextState]) continue;
      costs[nextState] = cost; previous[nextState] = state; push(nextState, cost + heuristic(neighbor.node));
    }
  }
  if (found < 0) return undefined;
  const path: Point[] = [];
  for (let state = found; state >= 0; state = previous[state]) { path.push(pointAt(Math.floor(state / 3))); if (state === initial) break; }
  path.reverse();
  return path.filter((point, index) => index === 0 || index === path.length - 1 || !((point.x === path[index - 1].x && point.x === path[index + 1].x) || (point.y === path[index - 1].y && point.y === path[index + 1].y)));
}

/** Finds an orthogonal route and caches it until an obstacle or waypoint changes. */
export function autoRoutePoints(connector: ShapeElement, items: Element[]): Point[] {
  const start = { x: connector.x, y: connector.y };
  const end = { x: connector.x + connector.w, y: connector.y + connector.h };
  const pins = connector.routeWaypoints ?? [];
  const flatItems = flat(items);
  const excluded = new Set([connector.id, connector.startBinding?.elementId, connector.endBinding?.elementId].filter(Boolean));
  const candidates = flatItems.filter(item => !item.hidden && !excluded.has(item.id) && ["rectangle", "circle", "diamond", "triangle", "flowchart", "text", "image", "schemaTable"].includes(item.type));
  const nearby = candidates.map(item => {
    const bounds = elementBounds(item); const radius = Math.hypot(bounds.w, bounds.h) / 2;
    return { item, bounds, distance: Math.max(0, distanceToSegment({ x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }, start, end) - radius) };
  }).sort((a, b) => a.distance - b.distance).slice(0, 28);
  const padding = Math.max(10, Math.min(24, connector.thickness * 2));
  const rects = nearby.map(({ bounds }) => ({ left: bounds.x - padding, top: bounds.y - padding, right: bounds.x + bounds.w + padding, bottom: bounds.y + bounds.h + padding }));
  const key = JSON.stringify([start, end, pins, nearby.map(({ item, bounds }) => [item.id, bounds.x, bounds.y, bounds.w, bounds.h])]);
  const cached = routeCache.get(connector);
  if (cached?.key === key) return cached.points;
  const waypoints = [start, ...pins, end]; const full: Point[] = [];
  for (let index = 1; index < waypoints.length; index++) {
    const from = waypoints[index - 1]; const to = waypoints[index];
    const segmentRects = rects.filter(rect => rect.right >= Math.min(from.x, to.x) - 240 && rect.left <= Math.max(from.x, to.x) + 240 && rect.bottom >= Math.min(from.y, to.y) - 240 && rect.top <= Math.max(from.y, to.y) + 240);
    const routed = routeLeg(from, to, segmentRects) ?? [from, { x: to.x, y: from.y }, to];
    full.push(...(index === 1 ? routed : routed.slice(1)));
  }
  const simplified = full.filter((point, index) => index === 0 || index === full.length - 1 || !((point.x === full[index - 1].x && point.x === full[index + 1].x) || (point.y === full[index - 1].y && point.y === full[index + 1].y)));
  const points = simplified.slice(1, -1);
  routeCache.set(connector, { key, points });
  return points;
}
