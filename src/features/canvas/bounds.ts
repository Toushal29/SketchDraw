import type { Point, Element, Bounds, ShapeElement } from "../../model";
import { labelBox, textElementBox } from "../../operations";
import { connectorPolylines, arrowHeadEntries, arrowHeadPoints } from "../connectors/geometry";
import { stylusStrokeWidth } from "./freehand-rendering";
import { relationshipDisplayElement } from "../diagrams/relationships";
import { strokeStyleLineGap } from "./stroke-style";

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

/** Resize a rectangle while preserving its original ratio and the opposite anchor. */
export function lockAspectResizeBounds(before: Bounds, requested: Bounds, handle: string, minimumWidth = 1, minimumHeight = 1): Bounds {
  if (before.w <= 0 || before.h <= 0) return requested;
  const ratio = before.w / before.h;
  const horizontal = handle.includes("e") || handle.includes("w");
  const vertical = handle.includes("n") || handle.includes("s");
  let width = requested.w;
  let height = requested.h;
  let x = requested.x;
  let y = requested.y;
  if (horizontal && vertical) {
    const widthScale = Math.abs(width / before.w - 1);
    const heightScale = Math.abs(height / before.h - 1);
    if (widthScale >= heightScale) height = width / ratio;
    else width = height * ratio;
    const minimumScale = Math.max(minimumWidth / before.w, minimumHeight / before.h);
    const scale = Math.max(minimumScale, width / before.w, height / before.h);
    width = before.w * scale; height = before.h * scale;
    if (handle.includes("w")) x = before.x + before.w - width;
    if (handle.includes("n")) y = before.y + before.h - height;
  } else if (horizontal) {
    width = Math.max(minimumWidth, width);
    height = Math.max(minimumHeight, width / ratio);
    width = height * ratio;
    x = handle.includes("w") ? before.x + before.w - width : before.x;
    y = before.y + (before.h - height) / 2;
  } else if (vertical) {
    height = Math.max(minimumHeight, height);
    width = Math.max(minimumWidth, height * ratio);
    height = width / ratio;
    y = handle.includes("n") ? before.y + before.h - height : before.y;
    x = before.x + (before.w - width) / 2;
  }
  return { x, y, w: width, h: height };
}

export function elementBounds(element: Element): Bounds {
  const cached = boundsCache.get(element); if (cached) return cached;
  if (element.type === "group") {
    if (element.componentBounds) return cacheBounds(element, rotatedBounds(element.componentBounds, element.rotation ?? 0));
    if (element.note) {
      const surface = element.elements.find((child): child is ShapeElement => child.type === "rectangle");
      if (surface) return cacheBounds(element, rotatedBounds({ x: surface.x, y: surface.y, w: Math.abs(surface.w), h: Math.abs(surface.h) }, element.rotation ?? 0));
    }
    const bounds = unionBounds(element.elements.filter((child) => !child.hidden).map(elementBounds)) ?? { x: 0, y: 0, w: 0, h: 0 };
    return cacheBounds(element, element.libraryComponent ? rotatedBounds(bounds, element.rotation ?? 0) : bounds);
  }
  if (element.type === "image") return cacheBounds(element, rotatedBounds({ x: element.x, y: element.y, w: element.w, h: element.h }, element.rotation ?? 0));
  if (element.type === "schemaTable") return cacheBounds(element, rotatedBounds({ x: element.x, y: element.y, w: element.w, h: element.h }, element.rotation ?? 0));
  if (element.type === "text") {
    return cacheBounds(element, rotatedBounds(textElementBox(element), element.rotation ?? 0));
  }
  if (element.type === "freehand") {
    let padding = Math.max(.25, element.thickness / 2);
    for (const point of element.points) {
      const tilt = element.points.length === 1 ? Math.min(1, Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0) / 90) : 0;
      padding = Math.max(padding, stylusStrokeWidth(point, element.thickness) * (.5 + tilt * .35));
    }
    return cacheBounds(element, rotatedBounds(boundsOfPoints(element.points, padding), element.rotation ?? 0));
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
    const doubleOffset = strokeStyleLineGap(element.lineStyle, element.thickness);
    const routeBounds = rotatedBounds(boundsOfPoints(points, element.thickness / 2 + doubleOffset), element.rotation ?? 0);
    const displayElement = relationshipDisplayElement(element);
    const labelBounds = displayElement.label?.text ? rotatedBounds(labelBox(displayElement), element.rotation ?? 0) : undefined;
    return cacheBounds(element, labelBounds ? unionBounds([routeBounds, labelBounds])! : routeBounds);
  }
  return cacheBounds(element, rotatedBounds({ x, y, w, h }, element.rotation ?? 0));
}

/** Bounds for content that will actually be drawn, including inherited visibility and unclipped group children. */
export function visibleElementBounds(element: Element, isHidden: (element: Element) => boolean = item => !!item.hidden): Bounds[] {
  if (isHidden(element)) return [];
  if (element.type !== "group") return [elementBounds(element)];
  const ownBounds = element.note || element.componentBounds ? [elementBounds(element)] : [];
  if (element.container?.showLabel !== false && element.container?.name.trim()) {
    const box = elementBounds(element);
    const label = { x: box.x + 8, y: box.y - 22, w: element.container.name.length * 10, h: 18 };
    const rotation = element.rotation ?? 0;
    if (rotation) {
      const centerX = box.x + box.w / 2; const centerY = box.y + box.h / 2; const angle = rotation * Math.PI / 180;
      const corners = [{ x: label.x, y: label.y }, { x: label.x + label.w, y: label.y }, { x: label.x + label.w, y: label.y + label.h }, { x: label.x, y: label.y + label.h }];
      ownBounds.push(boundsOfPoints(corners.map(point => ({ x: centerX + (point.x - centerX) * Math.cos(angle) - (point.y - centerY) * Math.sin(angle), y: centerY + (point.x - centerX) * Math.sin(angle) + (point.y - centerY) * Math.cos(angle) }))));
    } else ownBounds.push(label);
  }
  if (element.note || element.container?.clipChildren && element.componentBounds || element.componentBounds && element.libraryComponent && !element.container) return ownBounds;
  return [...ownBounds, ...element.elements.flatMap(child => visibleElementBounds(child, isHidden))];
}

/** Returns the item's geometric bounds without stroke, shadow, or arrowhead padding. */
export function elementGridBounds(element: Element): Bounds | undefined {
  if (element.type === "group") {
    if (element.componentBounds) return { ...element.componentBounds };
    return unionBounds(element.elements.filter(child => !child.hidden).flatMap(child => {
      const bounds = elementGridBounds(child);
      return bounds ? [bounds] : [];
    }));
  }
  if (element.type === "freehand") return boundsOfPoints(element.points);
  if (element.type === "line" || element.type === "arrow") {
    const points: Point[] = [
      { x: element.x, y: element.y },
      { x: element.x + element.w, y: element.y + element.h },
      ...(element.routePoints ?? []),
      ...(element.routeWaypoints ?? []),
      ...(element.forkUpper?.end ? [element.forkUpper.end] : []),
      ...(element.forkUpper?.routePoints ?? []),
      ...(element.forkLower?.end ? [element.forkLower.end] : []),
      ...(element.forkLower?.routePoints ?? []),
    ];
    return boundsOfPoints(points);
  }
  if (element.type === "text") return { x: element.x, y: element.y, w: 0, h: 0 };
  if ("x" in element && "y" in element) {
    const width = "w" in element ? element.w : 0;
    const height = "h" in element ? element.h : 0;
    const x = Math.min(element.x, element.x + width);
    const y = Math.min(element.y, element.y + height);
    return { x, y, w: Math.abs(width), h: Math.abs(height) };
  }
  return undefined;
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
