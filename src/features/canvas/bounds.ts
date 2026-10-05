import type { Point, Element, Bounds, ShapeElement } from "../../model";
import { textElementBox } from "../../operations";
import { connectorPolylines, arrowHeadEntries, arrowHeadPoints } from "./geometry";

const boundsCache = new WeakMap<Element, Bounds>();
const cacheBounds = (element: Element, bounds: Bounds): Bounds => { boundsCache.set(element, bounds); return bounds; };

export function boundsOfPoints(points: Point[], padding = 0): Bounds {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let left = Infinity; let top = Infinity; let right = -Infinity; let bottom = -Infinity;
  for (const point of points) { left = Math.min(left, point.x); top = Math.min(top, point.y); right = Math.max(right, point.x); bottom = Math.max(bottom, point.y); }
  return { x: left - padding, y: top - padding, w: right - left + padding * 2, h: bottom - top + padding * 2 };
}

export function unionBounds(boxes: Bounds[]): Bounds | undefined {
  if (boxes.length === 0) return undefined;
  let left = Infinity; let top = Infinity; let right = -Infinity; let bottom = -Infinity;
  for (const box of boxes) { left = Math.min(left, box.x); top = Math.min(top, box.y); right = Math.max(right, box.x + box.w); bottom = Math.max(bottom, box.y + box.h); }
  return { x: left, y: top, w: right - left, h: bottom - top };
}
export function elementBounds(element: Element): Bounds {
  const cached = boundsCache.get(element); if (cached) return cached;
  if (element.type === "group") {
    if (element.note) {
      const surface = element.elements.find((child): child is ShapeElement => child.type === "rectangle");
      if (surface) return cacheBounds(element, rotatedBounds({ x: surface.x, y: surface.y, w: Math.abs(surface.w), h: Math.abs(surface.h) }, element.rotation ?? 0));
    }
    return cacheBounds(element, unionBounds(element.elements.filter((child) => !child.hidden).map(elementBounds)) ?? { x: 0, y: 0, w: 0, h: 0 });
  }
  if (element.type === "image") return cacheBounds(element, rotatedBounds({ x: element.x, y: element.y, w: element.w, h: element.h }, element.rotation ?? 0));
  if (element.type === "schemaTable") return cacheBounds(element, rotatedBounds({ x: element.x, y: element.y, w: element.w, h: element.h }, element.rotation ?? 0));
  if (element.type === "text") {
    return cacheBounds(element, rotatedBounds(textElementBox(element), element.rotation ?? 0));
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

export function rotatedBounds(bounds: Bounds, degrees: number): Bounds {
  if (!degrees) return bounds;
  const angle = degrees * Math.PI / 180; const cx = bounds.x + bounds.w / 2; const cy = bounds.y + bounds.h / 2;
  const corners = [{ x: bounds.x, y: bounds.y }, { x: bounds.x + bounds.w, y: bounds.y }, { x: bounds.x + bounds.w, y: bounds.y + bounds.h }, { x: bounds.x, y: bounds.y + bounds.h }].map((point) => ({ x: cx + (point.x - cx) * Math.cos(angle) - (point.y - cy) * Math.sin(angle), y: cy + (point.x - cx) * Math.sin(angle) + (point.y - cy) * Math.cos(angle) }));
  const xs = corners.map((point) => point.x); const ys = corners.map((point) => point.y); const x = Math.min(...xs); const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x; const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}
