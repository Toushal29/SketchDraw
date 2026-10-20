import type { FreehandElement, Point } from "../../model";
import { boundsOfPoints } from "./bounds";

export type RecognizedStroke = { type: "rectangle" | "circle" | "line" | "arrow"; bounds: { x: number; y: number; w: number; h: number }; start?: Point; end?: Point };

function distanceToEdge(point: Point, bounds: RecognizedStroke["bounds"]) {
  return Math.min(Math.abs(point.x - bounds.x), Math.abs(point.x - bounds.x - bounds.w), Math.abs(point.y - bounds.y), Math.abs(point.y - bounds.y - bounds.h));
}

export function recognizeStroke(stroke: FreehandElement): RecognizedStroke | undefined {
  if (stroke.points.length < 8) return undefined;
  const points = stroke.points;
  const bounds = boundsOfPoints(points);
  const tolerance = Math.max(4, Math.min(14, Math.min(bounds.w, bounds.h) * 0.08));
  const first = points[0]; const last = points[points.length - 1];
  const closeEnough = Math.hypot(first.x - last.x, first.y - last.y) <= Math.max(10, Math.hypot(bounds.w, bounds.h) * 0.12);
  if (closeEnough && bounds.w >= 25 && bounds.h >= 25) {
    if (points.every(point => distanceToEdge(point, bounds) <= tolerance)) {
      const sides = new Set(points.map(point => {
        const distances = [Math.abs(point.y - bounds.y), Math.abs(point.x - bounds.x - bounds.w), Math.abs(point.y - bounds.y - bounds.h), Math.abs(point.x - bounds.x)];
        return distances.indexOf(Math.min(...distances));
      }));
      if (sides.size === 4) return { type: "rectangle", bounds };
    }
    const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
    const radialErrors = points.map(point => Math.abs(Math.hypot((point.x - center.x) / (bounds.w / 2), (point.y - center.y) / (bounds.h / 2)) - 1));
    const quadrants = new Set(points.map(point => `${point.x >= center.x ? 1 : 0}:${point.y >= center.y ? 1 : 0}`));
    if (quadrants.size === 4 && radialErrors.reduce((sum, error) => sum + error, 0) / radialErrors.length <= 0.13) return { type: "circle", bounds };
    return undefined;
  }
  const distanceToSegment = (point: Point, start: Point, end: Point) => {
    const dx = end.x - start.x; const dy = end.y - start.y; const denominator = dx * dx + dy * dy;
    if (!denominator) return Math.hypot(point.x - start.x, point.y - start.y);
    const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / denominator));
    return Math.hypot(point.x - start.x - ratio * dx, point.y - start.y - ratio * dy);
  };
  const lineLength = Math.hypot(last.x - first.x, last.y - first.y);
  if (lineLength >= 25 && points.every(point => distanceToSegment(point, first, last) <= Math.max(3, lineLength * 0.045))) return { type: "line", bounds, start: first, end: last };
  let tipIndex = 0; let farthest = 0;
  for (let index = 2; index < points.length - 1; index++) {
    const distance = Math.hypot(points[index].x - first.x, points[index].y - first.y);
    if (distance > farthest) { farthest = distance; tipIndex = index; }
  }
  if (tipIndex < 2 || tipIndex >= points.length - 2 || farthest < 25 || farthest < lineLength * 0.55) return undefined;
  const tip = points[tipIndex]; const shaftLength = Math.hypot(tip.x - first.x, tip.y - first.y);
  const shaftIsStraight = points.slice(0, tipIndex + 1).every(point => distanceToSegment(point, first, tip) <= Math.max(3, shaftLength * 0.045));
  const branchLength = Math.hypot(last.x - tip.x, last.y - tip.y);
  const cross = Math.abs((tip.x - first.x) * (last.y - tip.y) - (tip.y - first.y) * (last.x - tip.x));
  if (shaftIsStraight && branchLength >= shaftLength * 0.12 && branchLength <= shaftLength * 0.65 && cross / (shaftLength * branchLength) >= Math.sin(Math.PI / 7)) return { type: "arrow", bounds, start: first, end: tip };
  return undefined;
}
