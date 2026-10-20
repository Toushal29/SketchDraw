import type { Bounds, CanvasLayer, Element, GroupElement, Point } from "../../model";
import { elementBounds, unionBounds } from "./bounds";
import { flatten, isConnector } from "../../operations";

export type LayerNestingAction = "nest" | "unnest";
const layerLookupCache = new WeakMap<CanvasLayer[], Map<string, CanvasLayer>>();

function layerLookup(layers: CanvasLayer[]) {
  let lookup = layerLookupCache.get(layers);
  if (!lookup) { lookup = new Map(layers.map(layer => [layer.id, layer])); layerLookupCache.set(layers, lookup); }
  return lookup;
}

export function normalizeCanvasLayers(value: unknown): CanvasLayer[] | undefined {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 512) return undefined;
  const layers: CanvasLayer[] = [];
  const ids = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== "string" || !/^[\w.-]{1,100}$/.test(item.id) || ids.has(item.id)
      || typeof item.name !== "string" || !item.name.trim() || item.name.length > 80
      || (item.parentId !== undefined && (typeof item.parentId !== "string" || !/^[\w.-]{1,100}$/.test(item.parentId)))
      || (item.hidden !== undefined && typeof item.hidden !== "boolean") || (item.locked !== undefined && typeof item.locked !== "boolean")
      || (item.order !== undefined && (!Number.isInteger(item.order) || (item.order as number) < 0 || (item.order as number) > 10_000))) return undefined;
    ids.add(item.id);
    layers.push({ id: item.id, name: item.name.trim(), ...(typeof item.parentId === "string" ? { parentId: item.parentId } : {}), hidden: item.hidden === true, locked: item.locked === true, order: typeof item.order === "number" ? item.order : layers.length });
  }
  if (layers.some(layer => layer.parentId && (!ids.has(layer.parentId) || layer.parentId === layer.id))) return undefined;
  const byId = new Map(layers.map(layer => [layer.id, layer]));
  for (const layer of layers) {
    const visited = new Set<string>([layer.id]); let parentId = layer.parentId; let depth = 0;
    while (parentId) { if (visited.has(parentId) || ++depth > 32) return undefined; visited.add(parentId); parentId = byId.get(parentId)?.parentId; }
  }
  return layers;
}

export function layerHidden(layers: CanvasLayer[], layerId?: string): boolean {
  const byId = layerLookup(layers);
  let current = layerId ? byId.get(layerId) : undefined;
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    if (current.hidden) return true;
    visited.add(current.id); current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return false;
}

export function layerLocked(layers: CanvasLayer[], layerId?: string): boolean {
  const byId = layerLookup(layers);
  let current = layerId ? byId.get(layerId) : undefined;
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    if (current.locked) return true;
    visited.add(current.id); current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return false;
}

export function orderCanvasLayers(layers: CanvasLayer[]): CanvasLayer[] {
  const byParent = new Map<string | undefined, CanvasLayer[]>();
  for (const layer of layers) {
    const siblings = byParent.get(layer.parentId) ?? [];
    siblings.push(layer); byParent.set(layer.parentId, siblings);
  }
  for (const siblings of byParent.values()) siblings.sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
  const result: CanvasLayer[] = [];
  const append = (parentId?: string, depth = 0) => {
    if (depth > 32) return;
    for (const layer of byParent.get(parentId) ?? []) { result.push(layer); append(layer.id, depth + 1); }
  };
  append(); return result;
}

export function ensureCanvasLayerPath(layers: CanvasLayer[], path: string): { layers: CanvasLayer[]; id?: string } {
  const names = path.split("/").map(part => part.trim().replace(/\s+/g, " ")).filter(Boolean).slice(0, 8);
  if (!names.length) return { layers };
  const next = [...layers]; let parentId: string | undefined;
  for (const name of names) {
    let current = next.find(layer => layer.parentId === parentId && layer.name.toLowerCase() === name.toLowerCase());
    if (!current) {
      current = { id: crypto.randomUUID(), name: name.slice(0, 80), parentId, order: next.filter(layer => layer.parentId === parentId).length };
      next.push(current);
    }
    parentId = current.id;
  }
  return { layers: next, id: parentId };
}

export function moveCanvasLayer(layers: CanvasLayer[], id: string, delta: number): CanvasLayer[] {
  const source = layers.find(layer => layer.id === id); if (!source || !delta) return layers;
  const siblings = layers.filter(layer => layer.parentId === source.parentId).sort((left, right) => left.order - right.order);
  const index = siblings.findIndex(layer => layer.id === id); const nextIndex = Math.max(0, Math.min(siblings.length - 1, index + delta));
  if (nextIndex === index) return layers;
  [siblings[index], siblings[nextIndex]] = [siblings[nextIndex], siblings[index]];
  const order = new Map(siblings.map((layer, position) => [layer.id, position]));
  return layers.map(layer => order.has(layer.id) ? { ...layer, order: order.get(layer.id)! } : layer);
}

export function changeCanvasLayerNesting(layers: CanvasLayer[], id: string, action: LayerNestingAction): CanvasLayer[] {
  const ordered = orderCanvasLayers(layers); const source = layers.find(layer => layer.id === id); if (!source) return layers;
  if (action === "nest") {
    const index = ordered.findIndex(layer => layer.id === id); const parent = ordered[index - 1];
    if (!parent || parent.id === id || parent.parentId === id) return layers;
    const descendants = new Set<string>(); let changed = true;
    while (changed) { changed = false; for (const layer of layers) if (layer.parentId && (layer.parentId === id || descendants.has(layer.parentId)) && !descendants.has(layer.id)) { descendants.add(layer.id); changed = true; } }
    if (descendants.has(parent.id)) return layers;
    const siblings = layers.filter(layer => layer.parentId === parent.id);
    return layers.map(layer => layer.id === id ? { ...layer, parentId: parent.id, order: siblings.length } : layer);
  }
  if (!source.parentId) return layers;
  const parent = layers.find(layer => layer.id === source.parentId);
  const grandParent = parent?.parentId;
  const siblings = layers.filter(layer => layer.parentId === grandParent);
  return layers.map(layer => layer.id === id ? { ...layer, parentId: grandParent, order: siblings.length } : layer);
}

export function deleteCanvasLayers(layers: CanvasLayer[], ids: string[]): { layers: CanvasLayer[]; reassignment: Map<string, string | undefined> } {
  const removing = new Set(ids); const removed = layers.filter(layer => removing.has(layer.id));
  const layersById = new Map(layers.map(layer => [layer.id, layer]));
  const reassignment = new Map<string, string | undefined>();
  for (const layer of removed) {
    let parentId = layer.parentId; const visited = new Set<string>();
    while (parentId && removing.has(parentId) && !visited.has(parentId)) { visited.add(parentId); parentId = layersById.get(parentId)?.parentId; }
    reassignment.set(layer.id, parentId);
  }
  const next = layers.filter(layer => !removing.has(layer.id)).map(layer => {
    if (!layer.parentId || !removing.has(layer.parentId)) return layer;
    let parentId: string | undefined = layer.parentId; const visited = new Set<string>();
    while (parentId && removing.has(parentId) && !visited.has(parentId)) { visited.add(parentId); parentId = layersById.get(parentId)?.parentId; }
    return { ...layer, parentId, order: layers.filter(candidate => candidate.parentId === parentId && !removing.has(candidate.id)).length };
  });
  const siblingsByParent = new Map<string | undefined, CanvasLayer[]>();
  for (const layer of next) { const siblings = siblingsByParent.get(layer.parentId) ?? []; siblings.push(layer); siblingsByParent.set(layer.parentId, siblings); }
  const orderById = new Map<string, number>();
  for (const siblings of siblingsByParent.values()) siblings.sort((left, right) => left.order - right.order || left.name.localeCompare(right.name)).forEach((layer, order) => orderById.set(layer.id, order));
  return { layers: next.map(layer => ({ ...layer, order: orderById.get(layer.id) ?? layer.order })), reassignment };
}

function containsId(element: Element, id: string): boolean {
  return element.id === id || element.type === "group" && element.elements.some(child => containsId(child, id));
}

/** Move selected root objects into a group without changing their world coordinates. */
export function moveElementsIntoContainer(items: Element[], sourceIds: string[], targetId: string): Element[] {
  const movingIds = new Set(sourceIds); const targetOriginal = flatten(items).find(item => item.id === targetId);
  if (targetOriginal?.type !== "group" || !targetOriginal.container && !targetOriginal.libraryComponent || movingIds.has(targetId)) return items;
  const roots = items.filter(item => movingIds.has(item.id ?? ""));
  if (!roots.length || roots.some(root => containsId(root, targetId))) return items;
  const moved: Element[] = [];
  const remove = (children: Element[]): Element[] => {
    const result: Element[] = [];
    for (const child of children) {
      if (movingIds.has(child.id ?? "")) { moved.push(child); continue; }
      if (child.type !== "group") { result.push(child); continue; }
      const nested = remove(child.elements);
      result.push(nested.length === child.elements.length && nested.every((item, index) => item === child.elements[index]) ? child : { ...child, elements: nested });
    }
    return result;
  };
  const withoutSources = remove(items);
  if (!moved.length) return items;
  let found = false;
  const insert = (children: Element[]): Element[] => children.map(child => {
    if (child.id === targetId && child.type === "group") { found = true; return { ...child, elements: [...child.elements, ...moved] }; }
    if (child.type === "group") return { ...child, elements: insert(child.elements) };
    return child;
  });
  const next = insert(withoutSources);
  return found ? next : items;
}

/** Remove a container while preserving its children and their absolute positions. */
export function removeContainer(items: Element[], id: string): Element[] {
  let found = false;
  const remove = (children: Element[]): Element[] => {
    const result: Element[] = [];
    for (const child of children) {
      if (child.id === id && child.type === "group" && (child.container || child.libraryComponent)) { found = true; result.push(...child.elements); continue; }
      if (child.type !== "group") { result.push(child); continue; }
      const nested = remove(child.elements);
      result.push(nested.length === child.elements.length && nested.every((item, index) => item === child.elements[index]) ? child : { ...child, elements: nested });
    }
    return result;
  };
  const next = remove(items); return found ? next : items;
}

export function fitContainerToContent(group: GroupElement, padding = group.container?.padding ?? 24): GroupElement {
  const content = unionBounds(group.elements.filter(item => !item.hidden).map(elementBounds));
  if (!content) return group;
  const inset = Math.max(0, Math.min(500, padding));
  return { ...group, componentBounds: { x: content.x - inset, y: content.y - inset, w: content.w + inset * 2, h: content.h + inset * 2 } };
}

/** Scale a container's bounds and every child from the same world-space transform. */
export function resizeContainerWithChildren(group: GroupElement, target: Bounds): GroupElement {
  const source = group.componentBounds ?? elementBounds(group);
  if (source.w <= 0 || source.h <= 0 || target.w <= 0 || target.h <= 0) return group;
  const sx = target.w / source.w; const sy = target.h / source.h; const fontScale = Math.sqrt(Math.abs(sx * sy));
  const mapPoint = (point: Point): Point => ({ x: target.x + (point.x - source.x) * sx, y: target.y + (point.y - source.y) * sy });
  const mapBounds = (bounds: Bounds): Bounds => ({ x: target.x + (bounds.x - source.x) * sx, y: target.y + (bounds.y - source.y) * sy, w: bounds.w * sx, h: bounds.h * sy });
  const scale = (item: Element): Element => {
    if (item.type === "group") {
      const container = item.container && item.container.padding !== undefined ? { ...item.container, padding: item.container.padding * fontScale } : item.container;
      const libraryComponent = item.libraryComponent?.textStyle?.fontSize !== undefined
        ? { ...item.libraryComponent, textStyle: { ...item.libraryComponent.textStyle, fontSize: Math.max(8, item.libraryComponent.textStyle.fontSize * fontScale) } }
        : item.libraryComponent;
      const note = item.note ? { ...item.note, ...(item.note.width !== undefined ? { width: item.note.width * sx } : {}), ...(item.note.height !== undefined ? { height: item.note.height * sy } : {}), ...(item.note.fontSize !== undefined ? { fontSize: Math.max(8, item.note.fontSize * fontScale) } : {}) } : item.note;
      return { ...item, ...(item.componentBounds ? { componentBounds: mapBounds(item.componentBounds) } : {}), ...(container ? { container } : {}), ...(libraryComponent ? { libraryComponent } : {}), ...(note ? { note } : {}), elements: item.elements.map(scale) };
    }
    if (item.type === "freehand") return { ...item, points: item.points.map(point => ({ ...point, ...mapPoint(point) })), thickness: Math.max(0.5, item.thickness * fontScale) };
    if (item.type === "text") return { ...item, x: mapPoint(item).x, y: mapPoint(item).y, fontSize: Math.max(8, item.fontSize * fontScale) };
    if (item.type === "image" || item.type === "schemaTable") return { ...item, ...mapPoint(item), w: item.w * sx, h: item.h * sy };
    const label = item.label ? { ...item.label, fontSize: Math.max(8, item.label.fontSize * fontScale), ...(item.label.offsetX !== undefined ? { offsetX: item.label.offsetX * sx } : {}), ...(item.label.offsetY !== undefined ? { offsetY: item.label.offsetY * sy } : {}) } : undefined;
    return {
      ...item,
      ...mapPoint(item),
      w: item.w * sx,
      h: item.h * sy,
      thickness: Math.max(0.5, item.thickness * fontScale),
      ...(item.cornerRadius !== undefined ? { cornerRadius: item.cornerRadius * fontScale } : {}),
      ...(label ? { label } : {}),
      ...(item.routePoints ? { routePoints: item.routePoints.map(mapPoint) } : {}),
      ...(item.routeWaypoints ? { routeWaypoints: item.routeWaypoints.map(mapPoint) } : {}),
      ...(item.forkUpper ? { forkUpper: { ...item.forkUpper, ...(item.forkUpper.end ? { end: mapPoint(item.forkUpper.end) } : {}), ...(item.forkUpper.routePoints ? { routePoints: item.forkUpper.routePoints.map(mapPoint) } : {}) } } : {}),
      ...(item.forkLower ? { forkLower: { ...item.forkLower, ...(item.forkLower.end ? { end: mapPoint(item.forkLower.end) } : {}), ...(item.forkLower.routePoints ? { routePoints: item.forkLower.routePoints.map(mapPoint) } : {}) } } : {}),
    } as Element;
  };
  return { ...group, componentBounds: target, elements: group.elements.map(scale) };
}

export function fitAutoResizeContainers(items: Element[]): Element[] {
  const nextItems = items.map(item => {
    if (item.type !== "group") return item;
    const children = fitAutoResizeContainers(item.elements);
    const changed = children.some((child, index) => child !== item.elements[index]);
    let next: GroupElement = changed ? { ...item, elements: children } : item;
    if (next.container?.autoResize && !next.container.lockedSize) next = fitContainerToContent(next);
    return next;
  });
  return nextItems.every((item, index) => item === items[index]) ? items : nextItems;
}

export function selectConnectedIndices(items: Element[], selectedIndices: number[]): number[] {
  const records = flatten(items); const rootById = new Map<string, number>();
  items.forEach((root, index) => { const visit = (item: Element) => { if (item.id) rootById.set(item.id, index); if (item.type === "group") item.elements.forEach(visit); }; visit(root); });
  const graph = new Map<string, Set<string>>();
  const link = (left: string, right: string) => { const a = graph.get(left) ?? new Set<string>(); const b = graph.get(right) ?? new Set<string>(); a.add(right); b.add(left); graph.set(left, a); graph.set(right, b); };
  for (const item of records) if (isConnector(item) && item.id) {
    const endpoints = [item.startBinding?.elementId, item.endBinding?.elementId, item.forkUpper?.endBinding?.elementId, item.forkLower?.endBinding?.elementId].filter((id): id is string => !!id);
    for (const endpoint of endpoints) link(endpoint, item.id);
    for (let index = 1; index < endpoints.length; index++) link(endpoints[0], endpoints[index]);
  }
  const pending = selectedIndices.flatMap(index => { const item = items[index]; if (!item) return []; const ids = flatten([item]).map(child => child.id).filter((id): id is string => !!id); return ids; });
  const visited = new Set<string>();
  while (pending.length) { const id = pending.pop()!; if (visited.has(id)) continue; visited.add(id); for (const next of graph.get(id) ?? []) pending.push(next); }
  return [...new Set([...selectedIndices, ...[...visited].flatMap(id => { const index = rootById.get(id); return index === undefined ? [] : [index]; })])].sort((a, b) => a - b);
}

function similarityKey(item: Element): string {
  if (item.type === "group") return `group:${item.container?.kind ?? ""}:${item.libraryComponent?.kind ?? ""}`;
  if (item.type === "flowchart") return `flowchart:${item.flowchartShape ?? "process"}`;
  return item.type;
}

export function selectSimilarIndices(items: Element[], selectedIndices: number[]): number[] {
  const keys = new Set(selectedIndices.map(index => items[index]).filter((item): item is Element => !!item).map(similarityKey));
  return items.flatMap((item, index) => keys.has(similarityKey(item)) && !item.hidden && !item.locked ? [index] : []);
}

export function getElementIdsInLayer(items: Element[], layerId: string): Set<string> {
  return new Set(flatten(items).filter(item => item.layerId === layerId).map(item => item.id).filter((id): id is string => !!id));
}

export function containerBounds(group: GroupElement): Bounds | undefined {
  return group.componentBounds ?? unionBounds(group.elements.filter(child => !child.hidden).map(elementBounds));
}
