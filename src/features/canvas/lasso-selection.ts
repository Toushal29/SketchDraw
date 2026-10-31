import type { Element, Point } from "../../model";
import { elementBounds } from "./bounds";
import { componentLabelSamples, componentOutlineSamples } from "../components/component-geometry";

const MAX_SAMPLES_PER_ELEMENT = 96;

/** Appends a lasso vertex only when it moved far enough to matter. */
export function appendLassoPoint(path: Point[], point: Point, minDistance: number): boolean {
  const last = path[path.length - 1];
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < minDistance) return false;
  path.push(point);
  return true;
}

/** Even-odd point-in-polygon test. The polygon closes from its last vertex to its first. */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index]; const b = polygon[previous];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function strided<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items;
  const stride = items.length / limit;
  return Array.from({ length: limit }, (_, index) => items[Math.floor(index * stride)]);
}

function boundsGrid(element: Element): Point[] {
  const box = elementBounds(element);
  const xs = [box.x, box.x + box.w / 2, box.x + box.w]; const ys = [box.y, box.y + box.h / 2, box.y + box.h];
  return ys.flatMap(y => xs.map(x => ({ x, y })));
}

/** Representative points of an element: its ink for strokes, its outline area otherwise. */
export function elementSamplePoints(element: Element): Point[] {
  if (element.type === "freehand") return strided(element.points, MAX_SAMPLES_PER_ELEMENT).map(point => ({ x: point.x, y: point.y }));
  if (element.type === "line" || element.type === "arrow") return [0, .25, .5, .75, 1].map(ratio => ({ x: element.x + element.w * ratio, y: element.y + element.h * ratio }));
  if (element.type === "group" && element.libraryComponent) {
    const outline = componentOutlineSamples(element, MAX_SAMPLES_PER_ELEMENT);
    if (outline.length) return outline;
  }
  if (element.type === "group" && !element.note && !element.libraryComponent && !element.container && !element.componentBounds) {
    const children = element.elements.flatMap(elementSamplePoints);
    return children.length ? strided(children, MAX_SAMPLES_PER_ELEMENT) : boundsGrid(element);
  }
  return boundsGrid(element);
}

/**
 * Indices of selectable elements whose representative points are mostly inside
 * the lasso. A stroke is picked when most of its ink is enclosed, so a loop
 * around a doodle selects it without grabbing neighbors it merely touches.
 */
export function lassoSelectIndices(elements: Element[], polygon: Point[], isSelectable: (element: Element) => boolean, coverage = .5): number[] {
  if (polygon.length < 3) return [];
  const result: number[] = [];
  elements.forEach((element, index) => {
    if (!isSelectable(element)) return;
    if (element.type === "group" && element.libraryComponent) {
      const labelSamples = componentLabelSamples(element);
      const labelCoverage = labelSamples.length
        ? labelSamples.reduce((count, point) => count + (pointInPolygon(point, polygon) ? 1 : 0), 0) / labelSamples.length
        : 0;
      if (labelCoverage >= coverage) { result.push(index); return; }
    }
    const samples = elementSamplePoints(element);
    if (!samples.length) return;
    const enclosed = samples.reduce((count, point) => count + (pointInPolygon(point, polygon) ? 1 : 0), 0);
    if (enclosed / samples.length >= coverage) result.push(index);
  });
  return result;
}
