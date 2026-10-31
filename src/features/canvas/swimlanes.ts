import type { GroupElement, Point } from "../../model";
import { elementBounds } from "./bounds";

export type SwimlaneLayout = { count: number; header: number; contentTop: number; contentHeight: number; labelWidth: number; weights: number[]; boundaries: number[] };

export function swimlaneLayout(group: GroupElement): SwimlaneLayout | undefined {
  if (group.libraryComponent?.kind !== "diagram-swimlane") return undefined;
  const bounds = elementBounds(group);
  const count = Math.max(2, Math.min(8, Math.round(group.libraryComponent.laneCount ?? 3)));
  const header = Math.min(32, Math.max(24, bounds.h * .12));
  const contentHeight = Math.max(1, bounds.h - header);
  const raw = group.libraryComponent.laneWeights?.slice(0, count) ?? [];
  const weights = Array.from({ length: count }, (_, index) => {
    const value = raw[index]; return Number.isFinite(value) && value! > 0 ? value! : 1;
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  const normalized = weights.map(value => value / total);
  const boundaries: number[] = [];
  let offset = 0;
  for (let index = 0; index < count - 1; index++) { offset += normalized[index]!; boundaries.push(bounds.y + header + contentHeight * offset); }
  return { count, header, contentTop: bounds.y + header, contentHeight, labelWidth: Math.min(132, Math.max(84, bounds.w * .22)), weights: normalized, boundaries };
}

function rotate(point: Point, center: Point, degrees: number): Point {
  const angle = degrees * Math.PI / 180; const dx = point.x - center.x; const dy = point.y - center.y;
  return { x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle) };
}

export function swimlaneDividerHandles(group: GroupElement): Array<{ index: number; point: Point }> {
  const layout = swimlaneLayout(group); if (!layout) return [];
  const bounds = elementBounds(group); const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
  return layout.boundaries.map((y, index) => ({ index, point: rotate({ x: bounds.x + layout.labelWidth + (bounds.w - layout.labelWidth) / 2, y }, center, group.rotation ?? 0) }));
}

export function resizeSwimlaneDivider(group: GroupElement, dividerIndex: number, y: number): GroupElement {
  const layout = swimlaneLayout(group); if (!layout || dividerIndex < 0 || dividerIndex >= layout.count - 1) return group;
  const before = layout.weights.slice(0, dividerIndex).reduce((sum, value) => sum + value, 0);
  const pairTotal = layout.weights[dividerIndex]! + layout.weights[dividerIndex + 1]!;
  const minShare = Math.min(.24, Math.max(.04, 28 / layout.contentHeight));
  if (pairTotal < minShare * 2) return group;
  const first = Math.max(minShare, Math.min(pairTotal - minShare, (y - layout.contentTop) / layout.contentHeight - before));
  const weights = [...layout.weights]; weights[dividerIndex] = first; weights[dividerIndex + 1] = pairTotal - first;
  return { ...group, libraryComponent: { ...group.libraryComponent!, laneWeights: weights } };
}

export function swimlaneIndexAtY(layout: SwimlaneLayout, y: number): number {
  const relative = Math.max(0, Math.min(1, (y - layout.contentTop) / layout.contentHeight));
  let accumulated = 0;
  for (let index = 0; index < layout.count - 1; index++) { accumulated += layout.weights[index]!; if (relative < accumulated) return index; }
  return layout.count - 1;
}

export function swimlaneCenterY(layout: SwimlaneLayout, index: number): number {
  const preceding = layout.weights.slice(0, index).reduce((sum, value) => sum + value, 0);
  return layout.contentTop + layout.contentHeight * (preceding + layout.weights[index]! / 2);
}
