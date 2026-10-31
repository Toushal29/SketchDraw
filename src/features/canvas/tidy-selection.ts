import type { Bounds, Element, Point, ShapeElement, ShapeLabel } from "../../model";
import { flatten, isConnector, resolveBindings } from "../../operations";
import { elementBounds, unionBounds } from "./bounds";
import { translateElement } from "./translate";
import { autoRouteConnectorSet } from "../diagrams/connector-routing";

export type TidyMove = { id: string; label: string; from: Point; to: Point; width: number; height: number };
export type TidyConnectorPreview = { id: string; before: Point[]; after: Point[] };
export type TidyPreview = { sourceElements: Element[]; sourceSelection: number[]; elements: Element[]; moves: TidyMove[]; connectors: TidyConnectorPreview[]; bounds?: Bounds };
type ConnectorElement = ShapeElement & { type: "line" | "arrow" };
const isTidyConnector = (item: Element): item is ConnectorElement => item.type === "line" || item.type === "arrow";

function connectorPoints(item: ConnectorElement): Point[] {
  if (item.routePoints?.length) return item.routePoints;
  return [{ x: item.x, y: item.y }, { x: item.x + item.w, y: item.y + item.h }];
}

/** Arrange only selected objects into compact graph columns. The source array and unselected objects stay untouched. */
export function previewTidySelection(items: Element[], selectedIndices: number[], gap = 32): TidyPreview {
  const selected = [...new Set(selectedIndices)].filter(index => Number.isInteger(index) && index >= 0 && index < items.length);
  const nodes = selected.flatMap(index => {
    const element = items[index];
    if (!element || isConnector(element) || element.type === "freehand" || element.locked || element.hidden || !element.id) return [];
    const bounds = elementBounds(element);
    return [{ index, element, bounds }];
  });
  const bounds = unionBounds(nodes.map(node => node.bounds));
  if (nodes.length < 2 || !bounds) return { sourceElements: items, sourceSelection: selected, elements: items, moves: [], connectors: [], bounds };

  const ids = new Set(nodes.map(node => node.element.id!));
  const outgoing = new Map(nodes.map(node => [node.element.id!, new Set<string>()]));
  const incoming = new Map(nodes.map(node => [node.element.id!, 0]));
  for (const connector of items.filter(isConnector)) {
    const from = connector.startBinding?.elementId; const to = connector.endBinding?.elementId;
    if (from && to && from !== to && ids.has(from) && ids.has(to) && !outgoing.get(from)!.has(to)) {
      outgoing.get(from)!.add(to); incoming.set(to, (incoming.get(to) ?? 0) + 1);
    }
  }

  const rank = new Map(nodes.map(node => [node.element.id!, 0]));
  const remaining = new Map(incoming); const queue = nodes.filter(node => remaining.get(node.element.id!) === 0).map(node => node.element.id!);
  const visited = new Set<string>();
  for (let at = 0; at < queue.length; at++) {
    const current = queue[at]; visited.add(current);
    for (const target of outgoing.get(current) ?? []) {
      rank.set(target, Math.max(rank.get(target) ?? 0, (rank.get(current) ?? 0) + 1));
      remaining.set(target, (remaining.get(target) ?? 1) - 1);
      if (remaining.get(target) === 0) queue.push(target);
    }
  }

  const hasEdges = [...outgoing.values()].some(targets => targets.size > 0);
  const columns = new Map<number, typeof nodes>();
  if (hasEdges) {
    for (const node of nodes) { const level = visited.has(node.element.id!) ? rank.get(node.element.id!) ?? 0 : 0; columns.set(level, [...(columns.get(level) ?? []), node]); }
  } else {
    const ordered = [...nodes].sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x);
    const columnCount = Math.max(1, Math.ceil(Math.sqrt(ordered.length)));
    ordered.forEach((node, index) => { const level = index % columnCount; columns.set(level, [...(columns.get(level) ?? []), node]); });
  }

  const entries = [...columns.entries()].sort(([a], [b]) => a - b).map(([level, members]) => ({ level, members: members.sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x), width: Math.max(...members.map(member => member.bounds.w)) }));
  const availableWidth = Math.max(0, bounds.w - entries.reduce((sum, column) => sum + column.width, 0));
  const columnGap = Math.max(20, Math.min(64, entries.length > 1 ? availableWidth / (entries.length - 1) : 20));
  const positions = new Map<number, Point>(); let x = bounds.x;
  for (const column of entries) {
    let y = bounds.y;
    for (const node of column.members) {
      positions.set(node.index, { x: x + (column.width - node.bounds.w) / 2, y });
      y += node.bounds.h + Math.max(18, Math.min(gap, 64));
    }
    x += column.width + columnGap;
  }
  // A disconnected set is better represented as a compact reading-order grid.
  if (!hasEdges) {
    const ordered = [...nodes].sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x);
    const columnCount = Math.max(1, Math.ceil(Math.sqrt(ordered.length))); const rowHeights: number[] = [];
    ordered.forEach((node, index) => { const row = Math.floor(index / columnCount); rowHeights[row] = Math.max(rowHeights[row] ?? 0, node.bounds.h); });
    const columnWidths = Array.from({ length: columnCount }, (_, column) => Math.max(...ordered.filter((_, index) => index % columnCount === column).map(node => node.bounds.w)));
    const xStarts: number[] = []; let xCursor = bounds.x; columnWidths.forEach(width => { xStarts.push(xCursor); xCursor += width + columnGap; });
    const yStarts: number[] = []; let yCursor = bounds.y; rowHeights.forEach(height => { yStarts.push(yCursor); yCursor += height + Math.max(18, Math.min(gap, 64)); });
    ordered.forEach((node, index) => { const column = index % columnCount; const row = Math.floor(index / columnCount); positions.set(node.index, { x: xStarts[column] + (columnWidths[column] - node.bounds.w) / 2, y: yStarts[row] }); });
  }

  const next = [...items]; const moves: TidyMove[] = [];
  for (const node of nodes) {
    const target = positions.get(node.index); if (!target) continue;
    const dx = target.x - node.bounds.x; const dy = target.y - node.bounds.y;
    if (Math.abs(dx) < .01 && Math.abs(dy) < .01) continue;
    next[node.index] = translateElement(node.element, dx, dy);
    const element = node.element;
    const label = element.type === "group" ? element.note?.title ?? element.libraryComponent?.label ?? "Group" : element.type === "schemaTable" ? element.name : element.type === "text" ? element.text.slice(0, 36) : "label" in element ? ((element as unknown as ShapeElement).label as ShapeLabel | undefined)?.text || element.type : element.type;
    moves.push({ id: element.id!, label, from: { x: node.bounds.x, y: node.bounds.y }, to: target, width: node.bounds.w, height: node.bounds.h });
  }
  if (!moves.length) return { sourceElements: items, sourceSelection: selected, elements: items, moves, connectors: [], bounds };
  const movedIds = new Set(moves.map(move => move.id));
  const routeIds = new Set(flatten(items).filter(isTidyConnector).filter(item => movedIds.has(item.startBinding?.elementId ?? "") || movedIds.has(item.endBinding?.elementId ?? "")).flatMap(item => item.id ? [item.id] : []));
  const routed = autoRouteConnectorSet(resolveBindings(next), item => !!item.hidden, item => !!item.locked || isTidyConnector(item) && !routeIds.has(item.id ?? ""));
  const beforeById = new Map(flatten(items).filter(isTidyConnector).flatMap(item => item.id ? [[item.id, item] as const] : []));
  const connectors = flatten(routed).filter(isTidyConnector).flatMap(item => {
    const before = item.id ? beforeById.get(item.id) : undefined;
    return before && routeIds.has(item.id!) ? [{ id: item.id!, before: connectorPoints(before), after: connectorPoints(item) }] : [];
  });
  return { sourceElements: items, sourceSelection: selected, elements: routed, moves, connectors, bounds };
}
