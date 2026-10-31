import type { Bounds, Element, Point, ShapeElement } from "../../model";
import { resolveBindings } from "../../operations";
import { elementBounds } from "../canvas/bounds";
import { translateElement } from "../canvas/translate";

/** Mind-map nodes and branches are ordinary shapes and curves tagged with these roles, so they stay editable everywhere. */
export const MIND_MAP_NODE_ROLE = "mindmap-node";
export const MIND_MAP_EDGE_ROLE = "mindmap-edge";
export const MIND_MAP_NODE_SIZE = { w: 150, h: 44 };
const HORIZONTAL_GAP = 56;
const VERTICAL_GAP = 14;

type Side = "left" | "right";
export const isMindMapNode = (element: Element | undefined): element is ShapeElement => !!element && element.type === "rectangle" && element.componentRole === MIND_MAP_NODE_ROLE && !!element.id;
const isMindMapEdge = (element: Element): element is ShapeElement => element.type === "line" && element.componentRole === MIND_MAP_EDGE_ROLE;

function edgesOf(elements: Element[]) { return elements.filter(isMindMapEdge); }
export function mindMapParentId(elements: Element[], nodeId: string): string | undefined {
  return edgesOf(elements).find(edge => edge.endBinding?.elementId === nodeId)?.startBinding?.elementId;
}
export function mindMapChildIds(elements: Element[], nodeId: string): string[] {
  return edgesOf(elements).flatMap(edge => edge.startBinding?.elementId === nodeId && edge.endBinding ? [edge.endBinding.elementId] : []);
}
export function mindMapRootId(elements: Element[], nodeId: string): string {
  let current = nodeId; const seen = new Set<string>();
  while (!seen.has(current)) { seen.add(current); const parent = mindMapParentId(elements, current); if (!parent) break; current = parent; }
  return current;
}
/** The node and everything below it. */
export function mindMapBranchIds(elements: Element[], nodeId: string): string[] {
  const ids: string[] = []; const queue = [nodeId];
  while (queue.length && ids.length < 5000) { const id = queue.shift()!; if (ids.includes(id)) continue; ids.push(id); queue.push(...mindMapChildIds(elements, id)); }
  return ids;
}

export function createMindMapNode(id: string, at: Point, text: string, depth: number): ShapeElement {
  const palette = ["#2468a0", "#2f8f6b", "#b9771d", "#8a4fa8"];
  const color = palette[Math.min(depth, palette.length - 1)];
  return {
    type: "rectangle", id, x: at.x, y: at.y, w: MIND_MAP_NODE_SIZE.w, h: MIND_MAP_NODE_SIZE.h, color, thickness: 2, edgeStyle: "pill",
    fillColor: depth === 0 ? color : "#ffffff", fillOpacity: 1, componentRole: MIND_MAP_NODE_ROLE,
    label: { text, color: depth === 0 ? "#ffffff" : "#1f2933", fontSize: depth === 0 ? 18 : 15, fontFamily: "sans", bold: depth === 0, textAlign: "center", verticalAlign: "middle" },
  };
}
function createEdge(id: string, parentId: string, childId: string, color: string): ShapeElement {
  return {
    type: "line", id, x: 0, y: 0, w: 1, h: 0, color, thickness: 2, lineRoute: "curve", componentRole: MIND_MAP_EDGE_ROLE,
    startBinding: { elementId: parentId, anchor: { x: 1, y: .5 } }, endBinding: { elementId: childId, anchor: { x: 0, y: .5 } },
  };
}

function depthOf(elements: Element[], nodeId: string): number {
  let depth = 0; let current = nodeId; const seen = new Set<string>();
  while (!seen.has(current)) { seen.add(current); const parent = mindMapParentId(elements, current); if (!parent) break; depth++; current = parent; }
  return depth;
}

const centerX = (element: Element | undefined) => { if (!element) return 0; const box = elementBounds(element); return box.x + box.w / 2; };
/** A branch keeps the side it is on; the side is read from where its first-level ancestor sits relative to the central idea. */
function sideOfNode(elements: Element[], nodeId: string): Side {
  const rootId = mindMapRootId(elements, nodeId); const byId = (id: string) => elements.find(element => element.id === id);
  let current = nodeId;
  while (mindMapParentId(elements, current) && mindMapParentId(elements, current) !== rootId) current = mindMapParentId(elements, current)!;
  return centerX(byId(current)) < centerX(byId(rootId)) ? "left" : "right";
}

/** Adds a child under `parentId` and re-arranges the whole map. First-level ideas fill the lighter side. */
export function addMindMapChild(elements: Element[], parentId: string, ids: { node: string; edge: string }, text = "New idea"): { elements: Element[]; nodeId: string } | undefined {
  const parent = elements.find(element => element.id === parentId);
  if (!isMindMapNode(parent)) return undefined;
  const bounds = elementBounds(parent); const rootId = mindMapRootId(elements, parentId);
  let side: Side;
  if (parentId === rootId) {
    const kids = mindMapChildIds(elements, rootId); const left = kids.filter(kid => sideOfNode(elements, kid) === "left").length;
    side = left < kids.length - left ? "left" : "right";
  } else side = sideOfNode(elements, parentId);
  const node = createMindMapNode(ids.node, { x: side === "right" ? bounds.x + bounds.w + HORIZONTAL_GAP : bounds.x - HORIZONTAL_GAP - MIND_MAP_NODE_SIZE.w, y: bounds.y }, text, depthOf(elements, parentId) + 1);
  const edge = createEdge(ids.edge, parentId, ids.node, parent.color);
  return { elements: layoutMindMap([...elements, node, edge], mindMapRootId(elements, parentId)), nodeId: ids.node };
}

/** Adds a sibling after `nodeId`. The central idea has no siblings, so it gets a child instead. */
export function addMindMapSibling(elements: Element[], nodeId: string, ids: { node: string; edge: string }, text = "New idea"): { elements: Element[]; nodeId: string } | undefined {
  const parentId = mindMapParentId(elements, nodeId);
  if (!parentId) return addMindMapChild(elements, nodeId, ids, text);
  const parent = elements.find(element => element.id === parentId);
  if (!isMindMapNode(parent)) return undefined;
  const sibling = elements.find(element => element.id === nodeId);
  const node = createMindMapNode(ids.node, { x: sibling ? elementBounds(sibling).x : 0, y: sibling ? elementBounds(sibling).y : 0 }, text, depthOf(elements, nodeId));
  const edge = createEdge(ids.edge, parentId, ids.node, parent.color);
  // Insert the new branch right after the sibling's own branch so reading order matches the canvas.
  const siblingEdgeIndex = elements.findIndex(item => isMindMapEdge(item) && item.endBinding?.elementId === nodeId);
  const next = [...elements]; next.splice(siblingEdgeIndex >= 0 ? siblingEdgeIndex + 1 : next.length, 0, edge); next.push(node);
  return { elements: layoutMindMap(next, mindMapRootId(next, parentId)), nodeId: ids.node };
}

/** Removes a node, its descendants, and their branches. The central idea stays as an empty map. */
export function removeMindMapBranch(elements: Element[], nodeId: string): Element[] {
  const doomed = new Set(mindMapBranchIds(elements, nodeId));
  const remaining = elements.filter(element => !(element.id && doomed.has(element.id)) && !(isMindMapEdge(element) && (doomed.has(element.startBinding?.elementId ?? "") || doomed.has(element.endBinding?.elementId ?? ""))));
  const parent = mindMapParentId(elements, nodeId);
  return parent ? layoutMindMap(remaining, mindMapRootId(remaining, parent)) : remaining;
}

/**
 * Tidy tree layout around the central idea: first-level branches alternate right and left, and each subtree is
 * centered on its parent. Branch curves are re-anchored to the side facing the parent.
 */
export function layoutMindMap(elements: Element[], rootId: string): Element[] {
  const byId = new Map(elements.flatMap(element => element.id ? [[element.id, element] as const] : []));
  const root = byId.get(rootId);
  if (!isMindMapNode(root)) return elements;
  const size = (id: string) => { const node = byId.get(id); const box = node ? elementBounds(node) : MIND_MAP_NODE_SIZE; return { w: box.w, h: box.h }; };
  const heights = new Map<string, number>();
  const kidsOf = (id: string) => mindMapChildIds(elements, id).filter(kid => isMindMapNode(byId.get(kid)));
  const subtreeHeight = (id: string, guard = new Set<string>()): number => {
    if (guard.has(id)) return size(id).h;
    guard.add(id);
    const kids = kidsOf(id);
    const total = kids.reduce((sum, kid) => sum + subtreeHeight(kid, guard), 0) + VERTICAL_GAP * Math.max(0, kids.length - 1);
    const height = Math.max(size(id).h, total); heights.set(id, height); return height;
  };
  const stackHeight = (kids: string[]) => kids.reduce((sum, kid) => sum + subtreeHeight(kid), 0) + VERTICAL_GAP * Math.max(0, kids.length - 1);
  const rootBox = elementBounds(root); const rootCenterY = rootBox.y + rootBox.h / 2;
  const positions = new Map<string, Point>(); const sides = new Map<string, Side>(); const placed = new Set<string>([rootId]);
  const place = (parentId: string, kids: string[], side: Side, centerY: number) => {
    const parentBox = positions.has(parentId) ? { ...positions.get(parentId)!, ...size(parentId) } : rootBox;
    let cursor = centerY - stackHeight(kids) / 2;
    for (const kid of kids) {
      if (placed.has(kid)) continue;
      placed.add(kid); sides.set(kid, side);
      const height = heights.get(kid) ?? subtreeHeight(kid); const box = size(kid); const middle = cursor + height / 2;
      positions.set(kid, { x: side === "right" ? parentBox.x + parentBox.w + HORIZONTAL_GAP : parentBox.x - HORIZONTAL_GAP - box.w, y: middle - box.h / 2 });
      place(kid, kidsOf(kid), side, middle);
      cursor += height + VERTICAL_GAP;
    }
  };
  const firstLevel = kidsOf(rootId); const rootCenterX = rootBox.x + rootBox.w / 2;
  const onLeft = (id: string) => centerX(byId.get(id)) < rootCenterX;
  place(rootId, firstLevel.filter(id => !onLeft(id)), "right", rootCenterY);
  place(rootId, firstLevel.filter(onLeft), "left", rootCenterY);
  const next = elements.map(element => {
    if (element.id && positions.has(element.id)) { const target = positions.get(element.id)!; const box = elementBounds(element); return translateElement(element, target.x - box.x, target.y - box.y); }
    if (isMindMapEdge(element) && element.endBinding && element.startBinding) {
      const side = sides.get(element.endBinding.elementId);
      if (!side) return element;
      const startAnchor = { x: side === "right" ? 1 : 0, y: .5 }; const endAnchor = { x: side === "right" ? 0 : 1, y: .5 };
      const same = element.startBinding.anchor.x === startAnchor.x && element.endBinding.anchor.x === endAnchor.x;
      return same ? element : { ...element, startBinding: { ...element.startBinding, anchor: startAnchor }, endBinding: { ...element.endBinding, anchor: endAnchor } };
    }
    return element;
  });
  return resolveBindings(next);
}

export function mindMapBounds(elements: Element[], rootId: string): Bounds | undefined {
  const ids = mindMapBranchIds(elements, rootId); if (!ids.length) return undefined;
  const boxes = elements.filter(element => element.id && ids.includes(element.id)).map(elementBounds);
  const left = Math.min(...boxes.map(box => box.x)); const top = Math.min(...boxes.map(box => box.y));
  return { x: left, y: top, w: Math.max(...boxes.map(box => box.x + box.w)) - left, h: Math.max(...boxes.map(box => box.y + box.h)) - top };
}
