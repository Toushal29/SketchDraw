import { isHierarchyContainer, UIHierarchyIndex, type UIHierarchyNode } from "./hierarchy";

type OperationNode = UIHierarchyNode & {
  name?: string;
  interactions?: Array<{ id: string; targetNodeId?: string }>;
};

function rootSelection<T extends UIHierarchyNode>(index: UIHierarchyIndex<T>, selectedIds: readonly string[]): T[] {
  const selected = new Set(selectedIds);
  return [...selected].filter(id => !index.hasSelectedAncestor(id, selected)).map(id => index.get(id)).filter((node): node is T => !!node);
}

/** Group selected nodes by reparenting them into one transparent container. */
export function groupHierarchyNodes<T extends OperationNode>(pageId: string, nodes: readonly T[], selectedIds: readonly string[], groupNode: T): T[] | undefined {
  const index = new UIHierarchyIndex<T>(pageId, nodes);
  const selected = rootSelection(index, selectedIds);
  if (selected.length < 2) return undefined;
  const parentId = selected.every(node => node.parentId === selected[0].parentId) ? selected[0].parentId : pageId;
  if (parentId !== pageId && !isHierarchyContainer(index.get(parentId)?.kind ?? "")) return undefined;

  const corners = selected.flatMap(node => {
    const transform = index.worldTransform(node.id);
    if (!transform) return [];
    const angle = transform.rotation * Math.PI / 180;
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    return [[0, 0], [node.width, 0], [node.width, node.height], [0, node.height]].flatMap(([x, y]) => {
      const world = { x: transform.x + x * cosine - y * sine, y: transform.y + x * sine + y * cosine };
      const local = index.worldToLocal(parentId, world);
      return local ? [local] : [];
    });
  });
  if (corners.length < selected.length * 4) return undefined;
  const left = Math.floor(Math.min(...corners.map(point => point.x)) + 1e-7);
  const top = Math.floor(Math.min(...corners.map(point => point.y)) + 1e-7);
  const right = Math.ceil(Math.max(...corners.map(point => point.x)) - 1e-7);
  const bottom = Math.ceil(Math.max(...corners.map(point => point.y)) - 1e-7);
  const order = index.children(parentId).reduce((max, sibling) => Math.max(max, sibling.order), -1) + 1;
  const container = { ...groupNode, parentId, order, x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top), rotation: 0 };
  const withContainer = new UIHierarchyIndex<T>(pageId, [...nodes, container]);
  const moved = new Map<string, T>();
  for (const node of selected) {
    const child = withContainer.reparent(node.id, container.id);
    if (!child) return undefined;
    moved.set(node.id, child);
  }
  return [...nodes.map(node => moved.get(node.id) ?? node), container];
}

/** Remove selected groups/frames while preserving each child's world transform. */
export function ungroupHierarchyNodes<T extends OperationNode>(pageId: string, nodes: readonly T[], selectedIds: readonly string[]): { nodes: T[]; selectedIds: string[] } {
  let current = [...nodes];
  const chosen: string[] = [];
  for (const id of selectedIds) {
    const group = current.find(node => node.id === id);
    if (!group || (group.kind !== "group" && group.kind !== "frame")) continue;
    const index = new UIHierarchyIndex<T>(pageId, current);
    const children = index.children(group.id);
    for (const [childIndex, child] of children.entries()) {
      const moved = index.reparent(child.id, group.parentId);
      if (!moved) continue;
      current = current.map(node => node.id === child.id ? { ...moved, order: group.order + (childIndex + 1) / (children.length + 1) } as T : node);
      chosen.push(child.id);
    }
    current = current.filter(node => node.id !== group.id);
  }
  return { nodes: current, selectedIds: chosen };
}

/** Duplicate selected subtrees with fresh identities and internal links remapped. */
export function duplicateHierarchyNodes<T extends OperationNode>(pageId: string, nodes: readonly T[], selectedIds: readonly string[], createId: (kind: string) => string, offset = 16): { nodes: T[]; selectedIds: string[] } {
  const index = new UIHierarchyIndex<T>(pageId, nodes);
  const roots = rootSelection(index, selectedIds);
  if (!roots.length) return { nodes: [...nodes], selectedIds: [] };
  const rootIds = new Set(roots.map(node => node.id));
  const cloneIds = new Map<string, string>();
  const copies: T[] = [];
  const nextOrder = new Map<string, number>();
  for (const root of roots) {
    if (!nextOrder.has(root.parentId)) nextOrder.set(root.parentId, index.children(root.parentId).reduce((max, sibling) => Math.max(max, sibling.order), -1) + 1);
    nextOrder.set(root.id, nextOrder.get(root.parentId)!);
    nextOrder.set(root.parentId, nextOrder.get(root.parentId)! + 1);
  }
  for (const root of roots) for (const node of [root, ...index.descendants(root.id)]) cloneIds.set(node.id, createId(node.kind));
  for (const root of roots) for (const node of [root, ...index.descendants(root.id)]) {
    const parentTransform = node.parentId === pageId ? undefined : index.worldTransform(node.parentId);
    const angle = -(parentTransform?.rotation ?? 0) * Math.PI / 180;
    const dx = offset * Math.cos(angle) - offset * Math.sin(angle);
    const dy = offset * Math.sin(angle) + offset * Math.cos(angle);
    const interactions = node.interactions?.map(link => ({ ...link, id: createId("interaction"), targetNodeId: link.targetNodeId ? cloneIds.get(link.targetNodeId) ?? link.targetNodeId : undefined }));
    copies.push({ ...structuredClone(node), id: cloneIds.get(node.id)!, parentId: cloneIds.get(node.parentId) ?? node.parentId, x: node.x + (rootIds.has(node.id) ? dx : 0), y: node.y + (rootIds.has(node.id) ? dy : 0), order: rootIds.has(node.id) ? nextOrder.get(node.id) ?? node.order + 1 : node.order, ...(node.name ? { name: `${node.name} copy` } : {}), ...(interactions ? { interactions } : {}) } as T);
  }
  return { nodes: [...nodes, ...copies], selectedIds: roots.map(node => cloneIds.get(node.id)!) };
}

export type HierarchyDropPosition = "before" | "inside" | "after" | "front" | "back";

/** Move selected nodes while preserving world transforms and deterministic stack order. */
export function moveHierarchyNodes<T extends UIHierarchyNode>(pageId: string, nodes: readonly T[], draggedIds: readonly string[], targetId: string | undefined, position: HierarchyDropPosition | boolean): T[] | undefined {
  const index = new UIHierarchyIndex<T>(pageId, nodes);
  const draggedSet = new Set(draggedIds);
  const source = [...draggedSet].filter(id => !index.hasSelectedAncestor(id, draggedSet));
  const target = targetId ? index.get(targetId) : undefined;
  if (!source.length || targetId && (!target || source.includes(targetId))) return undefined;
  const placement: HierarchyDropPosition = typeof position === "boolean" ? position ? "inside" : "after" : position;
  if (placement !== "front" && placement !== "back" && !target) return undefined;
  const targetIsContainer = !!target && isHierarchyContainer(target.kind);
  const parentId = placement === "inside" && targetIsContainer ? target!.id : placement === "front" || placement === "back" ? pageId : target!.parentId;
  if (source.some(id => !index.canReparent(id, parentId))) return undefined;

  const moved = new Map<string, T>();
  for (const id of source) {
    const child = index.reparent(id, parentId);
    if (!child) return undefined;
    moved.set(id, child);
  }

  const updated = nodes.map(node => moved.get(node.id) ?? node);
  const destinationIndex = new UIHierarchyIndex<T>(pageId, updated);
  const remaining = destinationIndex.children(parentId).filter(node => !draggedSet.has(node.id));
  // The layer tree is front-to-back, while lower order values render behind
  // higher ones. Build the insertion list in layer-panel order, then reverse it
  // when assigning paint order.
  const displayOrder = remaining.slice().reverse();
  const movedNodes = source.map(id => moved.get(id)!).filter(Boolean);
  if (placement === "inside" || placement === "front") displayOrder.unshift(...movedNodes);
  else if (placement === "back") displayOrder.push(...movedNodes);
  else {
    const targetIndex = displayOrder.findIndex(node => node.id === target!.id);
    if (targetIndex < 0) return undefined;
    displayOrder.splice(targetIndex + (placement === "after" ? 1 : 0), 0, ...movedNodes);
  }

  const paintOrder = displayOrder.slice().reverse();
  const orderById = new Map<string, number>(paintOrder.map((node, order) => [node.id, order] as const));
  return updated.map(node => orderById.has(node.id) ? { ...node, order: orderById.get(node.id)! } : node);
}
