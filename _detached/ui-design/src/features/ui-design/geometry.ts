import type { UIElement } from "./model";
import { UIHierarchyIndex } from "./hierarchy";

export type UIRect = { x: number; y: number; width: number; height: number };

export function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }): UIRect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

export function unionRects(rects: UIRect[]): UIRect | undefined {
  if (!rects.length) return undefined;
  const left = Math.min(...rects.map(item => item.x));
  const top = Math.min(...rects.map(item => item.y));
  const right = Math.max(...rects.map(item => item.x + item.width));
  const bottom = Math.max(...rects.map(item => item.y + item.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Refit transparent group bounds around their direct children without moving the artwork. */
export function fitGroupBounds(pageId: string, elements: readonly UIElement[]): UIElement[] {
  let fitted = [...elements];
  const initial = new UIHierarchyIndex<UIElement>(pageId, elements);
  // Auto-layout groups own a meaningful container size: their padding and
  // fixed dimensions are part of the layout contract. Fitting them to the
  // children's raw bounds would erase that space and shift the group origin.
  const groupIds = initial.all().filter(node => node.kind === "group" && !node.autoLayout.enabled)
    .sort((a, b) => initial.ancestors(b.id).length - initial.ancestors(a.id).length)
    .map(node => node.id);

  for (const groupId of groupIds) {
    // Rebuild after fitting each nested group so every parent uses the child's
    // updated local bounds instead of a stale snapshot from before the edit.
    const hierarchy = new UIHierarchyIndex<UIElement>(pageId, fitted);
    const group = hierarchy.get(groupId);
    const children = hierarchy.children(groupId);
    if (!group || !children.length) continue;

    const childBounds = children.map(child => {
      const angle = child.rotation * Math.PI / 180;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      const corners = [
        { x: 0, y: 0 }, { x: child.width, y: 0 },
        { x: child.width, y: child.height }, { x: 0, y: child.height },
      ].map(point => ({
        x: child.x + point.x * cosine - point.y * sine,
        y: child.y + point.x * sine + point.y * cosine,
      }));
      // Ignore floating-point residue at exact rotated edges (for example, cos(90°)).
      const epsilon = 1e-7;
      const left = Math.floor(Math.min(...corners.map(point => point.x)) + epsilon);
      const top = Math.floor(Math.min(...corners.map(point => point.y)) + epsilon);
      const right = Math.ceil(Math.max(...corners.map(point => point.x)) - epsilon);
      const bottom = Math.ceil(Math.max(...corners.map(point => point.y)) - epsilon);
      return { x: left, y: top, width: right - left, height: bottom - top };
    });
    const bounds = unionRects(childBounds);
    if (!bounds) continue;

    const angle = group.rotation * Math.PI / 180;
    const shiftX = bounds.x * Math.cos(angle) - bounds.y * Math.sin(angle);
    const shiftY = bounds.x * Math.sin(angle) + bounds.y * Math.cos(angle);
    const nextGroup = {
      ...group,
      x: group.x + shiftX,
      y: group.y + shiftY,
      width: Math.max(1, bounds.width),
      height: Math.max(1, bounds.height),
    };
    const shiftedChildren = new Map(children.map(child => [child.id, { ...child, x: child.x - bounds.x, y: child.y - bounds.y }]));
    fitted = fitted.map(node => node.id === groupId ? nextGroup : shiftedChildren.get(node.id) ?? node);
  }
  return fitted;
}

export function resizeElement(element: UIElement, handle: string, dx: number, dy: number): UIRect {
  const left = handle.includes("w");
  const right = handle.includes("e");
  const top = handle.includes("n");
  const bottom = handle.includes("s");
  let x = element.x;
  let y = element.y;
  let width = element.width;
  let height = element.height;
  const minimum = 1;
  let shiftX = 0;
  let shiftY = 0;
  if (left) { const next = width - dx; shiftX = width - Math.max(minimum, next); width = Math.max(minimum, next); }
  if (right) width = Math.max(minimum, width + dx);
  if (top) { const next = height - dy; shiftY = height - Math.max(minimum, next); height = Math.max(minimum, next); }
  if (bottom) height = Math.max(minimum, height + dy);
  const radians = element.rotation * Math.PI / 180;
  x += shiftX * Math.cos(radians) - shiftY * Math.sin(radians);
  y += shiftX * Math.sin(radians) + shiftY * Math.cos(radians);
  const leftEdge = Math.round(x);
  const topEdge = Math.round(y);
  const rightEdge = Math.round(x + width);
  const bottomEdge = Math.round(y + height);
  return { x: leftEdge, y: topEdge, width: Math.max(1, rightEdge - leftEdge), height: Math.max(1, bottomEdge - topEdge) };
}
