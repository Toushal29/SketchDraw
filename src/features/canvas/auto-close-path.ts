import type { StrokePoint, FreehandElement } from "../../model";

const CLOSE_DISTANCE_THRESHOLD = 18;
const MIN_POINTS_FOR_CLOSE = 8;

export function shouldAutoClose(points: StrokePoint[], zoom: number): boolean {
  if (points.length < MIN_POINTS_FOR_CLOSE) return false;
  const first = points[0];
  const last = points[points.length - 1];
  const distance = Math.hypot(last.x - first.x, last.y - first.y);
  const threshold = CLOSE_DISTANCE_THRESHOLD / Math.max(0.1, zoom);
  return distance < threshold;
}

export function closePathPoints(points: StrokePoint[]): StrokePoint[] {
  if (points.length < MIN_POINTS_FOR_CLOSE) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first.x === last.x && first.y === last.y) return points;
  const blend = (a: number, b: number, t: number) => a + (b - a) * t;
  const count = Math.min(4, Math.floor(points.length * 0.1));
  const closed = [...points];
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1);
    const index = closed.length - count + i;
    if (index < 0 || index >= closed.length) continue;
    const point = closed[index];
    closed[index] = {
      ...point,
      x: blend(point.x, first.x, t),
      y: blend(point.y, first.y, t),
    };
  }
  closed.push({ ...first, pressure: first.pressure });
  return closed;
}

export function applyAutoClose(element: FreehandElement, zoom: number): FreehandElement {
  if (element.closedPath) return element;
  if (!shouldAutoClose(element.points, zoom)) return element;
  return { ...element, points: closePathPoints(element.points), closedPath: true };
}
