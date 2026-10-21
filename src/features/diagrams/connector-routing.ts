import type { Bounds, Element, Point, ShapeElement } from "../../model";
import { elementBounds } from "../../features/canvas/bounds";
import { ElementSpatialIndex } from "../canvas/spatial-index";

type Rect = { left: number; top: number; right: number; bottom: number };
type CachedRoute = { key: string; points: Point[] };
const routeCache = new WeakMap<ShapeElement, CachedRoute>();
export type AutoRouteContext = { flatItems: Element[]; candidates: Map<Element, Bounds>; index: ElementSpatialIndex };

const isRouteObstacle = (item: Element) => item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "triangle" || item.type === "flowchart" || item.type === "svgPath" || item.type === "text" || item.type === "image" || item.type === "schemaTable" || item.type === "group" && (!!item.componentBounds || !!item.libraryComponent || !!item.note || !!item.mermaid);

export function createAutoRouteContext(items: Element[], isHidden: (item: Element) => boolean = item => !!item.hidden): AutoRouteContext {
  const flatItems = flat(items, isHidden);
  const candidates = new Map(flatItems.filter(isRouteObstacle).map(item => [item, elementBounds(item)] as const));
  return { flatItems, candidates, index: new ElementSpatialIndex(flatItems) };
}

function flat(items: Element[], isHidden: (item: Element) => boolean, parentHidden = false): Element[] {
  return items.flatMap(item => {
    if (parentHidden || isHidden(item)) return [];
    return item.type === "group" && !item.componentBounds && !item.libraryComponent && !item.note && !item.mermaid
      ? flat(item.elements, isHidden, parentHidden || isHidden(item))
      : [item];
  });
}

function isConnector(element: Element): element is ShapeElement & { type: "line" | "arrow" } {
  return element.type === "line" || element.type === "arrow";
}

function isRouteableConnector(element: Element): element is ShapeElement & { type: "line" | "arrow" } {
  return isConnector(element) && !element.straightOnly && !(element.type === "arrow" && element.arrowRoute === "forked");
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
  // A leg may deliberately terminate at a user placed waypoint on a shape.
  // Allow that endpoint through its containing obstacle, while still routing
  // around every other shape on the way to it.
  const contains = (rect: Rect, point: Point) => point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
  rects = rects.filter(rect => !contains(rect, start) && !contains(rect, end));
  let margin = 32; let minX = Math.min(start.x, end.x); let maxX = Math.max(start.x, end.x); let minY = Math.min(start.y, end.y); let maxY = Math.max(start.y, end.y);
  for (const rect of rects) {
    margin = Math.max(margin, Math.min(120, Math.max(rect.right - rect.left, rect.bottom - rect.top) * .2));
    minX = Math.min(minX, rect.left); maxX = Math.max(maxX, rect.right); minY = Math.min(minY, rect.top); maxY = Math.max(maxY, rect.bottom);
  }
  minX -= margin; maxX += margin; minY -= margin; maxY += margin;
  // The outer rails give A* a guaranteed way around a wall of overlapping
  // obstacle rectangles instead of forcing it to take a path through a node.
  const xs = [...new Set([start.x, end.x, minX, maxX, ...rects.flatMap(rect => [rect.left, rect.right])])].sort((a, b) => a - b);
  const ys = [...new Set([start.y, end.y, minY, maxY, ...rects.flatMap(rect => [rect.top, rect.bottom])])].sort((a, b) => a - b);
  const width = xs.length; const height = ys.length; const nodeCount = width * height;
  const pointAt = (node: number): Point => ({ x: xs[Math.floor(node / height)], y: ys[node % height] });
  const nodeAt = (x: number, y: number) => xs.indexOf(x) * height + ys.indexOf(y);
  const startNode = nodeAt(start.x, start.y); const endNode = nodeAt(end.x, end.y);
  const stateCount = nodeCount * 3; const costs = new Float64Array(stateCount); costs.fill(Infinity);
  const previous = new Int32Array(stateCount); previous.fill(-1);
  const open: { state: number; cost: number; score: number }[] = [];
  const push = (state: number, cost: number, score: number) => {
    let index = open.length; open.push({ state, cost, score });
    while (index > 0) { const parent = (index - 1) >> 1; if (open[parent].score <= score) break; open[index] = open[parent]; index = parent; }
    open[index] = { state, cost, score };
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
  const initial = startNode * 3 + 2; costs[initial] = 0; push(initial, 0, heuristic(startNode));
  let found = -1;
  while (open.length) {
    const { state, cost: queuedCost } = pop(); if (queuedCost !== costs[state]) continue;
    const node = Math.floor(state / 3); const direction = state % 3;
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
      costs[nextState] = cost; previous[nextState] = state; push(nextState, cost, cost + heuristic(neighbor.node));
    }
  }
  if (found < 0) return undefined;
  const path: Point[] = [];
  for (let state = found; state >= 0; state = previous[state]) { path.push(pointAt(Math.floor(state / 3))); if (state === initial) break; }
  path.reverse();
  return path.filter((point, index) => index === 0 || index === path.length - 1 || !((point.x === path[index - 1].x && point.x === path[index + 1].x) || (point.y === path[index - 1].y && point.y === path[index + 1].y)));
}

/** Finds an orthogonal route and caches it until an obstacle or waypoint changes. */
export function autoRoutePoints(connector: ShapeElement, items: Element[] | AutoRouteContext, isHidden: (item: Element) => boolean = item => !!item.hidden): Point[] {
  const start = { x: connector.x, y: connector.y };
  const end = { x: connector.x + connector.w, y: connector.y + connector.h };
  const pins = connector.routeWaypoints ?? [];
  const context = Array.isArray(items) ? createAutoRouteContext(items, isHidden) : items;
  const flatItems = context.flatItems;
  const excluded = new Set([connector.id].filter(Boolean));
  const queryBounds = { x: Math.min(start.x, end.x) - 240, y: Math.min(start.y, end.y) - 240, w: Math.abs(end.x - start.x) + 480, h: Math.abs(end.y - start.y) + 480 };
  const nearbyItems = context.index.query(queryBounds).map(index => flatItems[index]);
  const nearby = nearbyItems.flatMap(item => {
    const bounds = context.candidates.get(item);
    if (!bounds || excluded.has(item.id)) return [];
    const radius = Math.hypot(bounds.w, bounds.h) / 2;
    return { item, bounds, distance: Math.max(0, distanceToSegment({ x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }, start, end) - radius) };
  }).sort((a, b) => a.distance - b.distance).slice(0, 28);
  const padding = Math.max(10, Math.min(24, connector.thickness * 2));
  const sharedTargets = new Set([connector.startBinding?.elementId, connector.endBinding?.elementId].filter(Boolean));
  const nodeRects = nearby.filter(({ item }) => !sharedTargets.has(item.id)).map(({ bounds }) => ({ left: bounds.x - padding, top: bounds.y - padding, right: bounds.x + bounds.w + padding, bottom: bounds.y + bounds.h + padding }));
  const routeClearance = Math.max(6, padding * .65);
  const routeObstacles = nearbyItems.filter((item): item is ShapeElement => isConnector(item) && item.id !== connector.id && item.autoRoute === true && !item.hidden && ![item.startBinding?.elementId, item.endBinding?.elementId].some(id => id && sharedTargets.has(id)) && item.routePoints !== undefined)
    .flatMap(item => {
      const points = [{ x: item.x, y: item.y }, ...(item.routePoints ?? []), { x: item.x + item.w, y: item.y + item.h }];
      return points.slice(1).map((point, index) => {
        const previous = points[index];
        return {
          left: Math.min(previous.x, point.x) - routeClearance,
          top: Math.min(previous.y, point.y) - routeClearance,
          right: Math.max(previous.x, point.x) + routeClearance,
          bottom: Math.max(previous.y, point.y) + routeClearance,
        };
      });
    });
  const nearbyRouteObstacles = routeObstacles
    .sort((left, right) => distanceToSegment({ x: (left.left + left.right) / 2, y: (left.top + left.bottom) / 2 }, start, end) - distanceToSegment({ x: (right.left + right.right) / 2, y: (right.top + right.bottom) / 2 }, start, end))
    .slice(0, 32);
  const rects = [...nodeRects, ...nearbyRouteObstacles];
  const key = JSON.stringify([start, end, connector.startBinding, connector.endBinding, connector.thickness, pins, nearby.map(({ item, bounds }) => [item.id, bounds.x, bounds.y, bounds.w, bounds.h]), nearbyRouteObstacles]);
  const cached = routeCache.get(connector);
  if (cached?.key === key) return cached.points;
  // Keep bound tables in the obstacle set and route from a short stub outside their edge.
  const endpointStub = (endpoint: Point, other: Point, binding: ShapeElement["startBinding"] | ShapeElement["endBinding"]): Point => {
    if (!binding) return endpoint;
    const target = flatItems.find(item => item.id === binding.elementId);
    const bounds = target && context.candidates.get(target);
    if (!target || !bounds) return endpoint;
    const anchor = binding.anchor ?? { x: .5, y: .5 };
    let nx = anchor.x - .5; let ny = anchor.y - .5;
    if (Math.abs(nx) < .001 && Math.abs(ny) < .001) { nx = other.x - endpoint.x; ny = other.y - endpoint.y; }
    if (Math.abs(nx) * bounds.w >= Math.abs(ny) * bounds.h) ny = 0;
    else nx = 0;
    const directionLength = Math.hypot(nx, ny);
    if (directionLength < .001) return endpoint;
    nx /= directionLength; ny /= directionLength;
    const edgeDistance = nx > 0 ? bounds.x + bounds.w - endpoint.x : nx < 0 ? endpoint.x - bounds.x : ny > 0 ? bounds.y + bounds.h - endpoint.y : endpoint.y - bounds.y;
    const distance = Math.max(0, edgeDistance) + padding + 8;
    return { x: endpoint.x + nx * distance, y: endpoint.y + ny * distance };
  };
  const startStub = endpointStub(start, end, connector.startBinding);
  const endStub = endpointStub(end, start, connector.endBinding);
  const waypoints = [start, ...(startStub === start ? [] : [startStub]), ...pins, ...(endStub === end ? [] : [endStub]), end]; const full: Point[] = [];
  for (let index = 1; index < waypoints.length; index++) {
    const from = waypoints[index - 1]; const to = waypoints[index];
    const segmentRects = rects.filter(rect => rect.right >= Math.min(from.x, to.x) - 240 && rect.left <= Math.max(from.x, to.x) + 240 && rect.bottom >= Math.min(from.y, to.y) - 240 && rect.top <= Math.max(from.y, to.y) + 240);
    const routed = routeLeg(from, to, segmentRects) ?? detourLeg(from, to, segmentRects);
    full.push(...(index === 1 ? routed : routed.slice(1)));
  }
  const simplified = full.filter((point, index) => index === 0 || index === full.length - 1 || !((point.x === full[index - 1].x && point.x === full[index + 1].x) || (point.y === full[index - 1].y && point.y === full[index + 1].y)));
  const points = simplified.slice(1, -1);
  routeCache.set(connector, { key, points });
  return points;
}

/** Greedily routes longer links first so later connections can avoid their paths. */
export function autoRouteConnectorSet(
  items: Element[],
  isHidden: (item: Element) => boolean = item => !!item.hidden,
  isLocked: (item: Element) => boolean = item => !!item.locked,
): Element[] {
  const entries: { path: number[]; length: number }[] = [];
  const collect = (children: Element[], parentPath: number[] = [], parentUnavailable = false) => {
    children.forEach((item, index) => {
      const path = [...parentPath, index];
      const unavailable = parentUnavailable || isHidden(item) || isLocked(item);
      if (!unavailable && isRouteableConnector(item)) entries.push({ path, length: Math.hypot(item.w, item.h) });
      if (item.type === "group" && !unavailable) collect(item.elements, path, unavailable);
    });
  };
  collect(items);
  if (!entries.length) return items;
  entries.sort((a, b) => b.length - a.length);

  const replaceAtPath = (children: Element[], path: number[], replacement: Element): Element[] => {
    const [index, ...rest] = path;
    const next = [...children];
    if (!rest.length) { next[index] = replacement; return next; }
    const parent = next[index];
    if (parent?.type !== "group") return children;
    next[index] = { ...parent, elements: replaceAtPath(parent.elements, rest, replacement) };
    return next;
  };
  const getAtPath = (source: Element[], path: number[]): Element | undefined => {
    let current: Element | undefined;
    for (const [depth, index] of path.entries()) {
      current = depth === 0 ? source[index] : current?.type === "group" ? current.elements[index] : undefined;
      if (!current) return undefined;
    }
    return current;
  };

  let result = items;
  for (const { path } of entries) {
    const item = getAtPath(result, path);
    if (!item || !isRouteableConnector(item)) continue;
    result = replaceAtPath(result, path, { ...item, autoRoute: true, routePoints: undefined, routeWaypoints: [] });
  }
  for (const { path } of entries) {
    const connector = getAtPath(result, path);
    if (!connector || !isRouteableConnector(connector)) continue;
    const routePoints = autoRoutePoints(connector, result, isHidden);
    result = replaceAtPath(result, path, { ...connector, routePoints, routeWaypoints: [], ...(connector.type === "line" ? { lineRoute: "straight" as const } : { arrowRoute: "straight" as const }) });
  }
  return result;
}

function detourLeg(start: Point, end: Point, rects: Rect[]): Point[] {
  const margin = 24;
  const top = Math.min(start.y, end.y, ...rects.map(rect => rect.top)) - margin;
  const bottom = Math.max(start.y, end.y, ...rects.map(rect => rect.bottom)) + margin;
  const left = Math.min(start.x, end.x, ...rects.map(rect => rect.left)) - margin;
  const right = Math.max(start.x, end.x, ...rects.map(rect => rect.right)) + margin;
  const paths = [
    [start, { x: start.x, y: top }, { x: end.x, y: top }, end],
    [start, { x: start.x, y: bottom }, { x: end.x, y: bottom }, end],
    [start, { x: left, y: start.y }, { x: left, y: end.y }, end],
    [start, { x: right, y: start.y }, { x: right, y: end.y }, end],
  ];
  const clear = paths.filter(path => path.slice(1).every((point, index) => !blockedSegment(path[index], point, rects)));
  const score = (path: Point[]) => path.slice(1).reduce((total, point, index) => total + Math.abs(point.x - path[index].x) + Math.abs(point.y - path[index].y), 0);
  return (clear.sort((a, b) => score(a) - score(b))[0] ?? [start, { x: start.x, y: top }, { x: end.x, y: top }, end]).filter((point, index, path) => index === 0 || index === path.length - 1 || !((point.x === path[index - 1].x && point.x === path[index + 1].x) || (point.y === path[index - 1].y && point.y === path[index + 1].y)));
}
