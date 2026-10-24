import type { CanvasLayer, Element } from "../../model";
import { orderCanvasLayers } from "./structure";

export type ToolLayerKind = Element["type"] | `named:${string}` | `layer:${string}`;
export type ToolLayer = {
  key: ToolLayerKind;
  label: string;
  depth: number;
  path: string;
  indices: number[];
  topIndex: number;
  hidden: boolean;
  locked: boolean;
  persistent?: boolean;
  parentId?: string;
  order?: number;
};

const TOOL_LAYER_LABELS: Record<Element["type"], string> = {
  freehand: "Pen and brushes", rectangle: "Rectangles", circle: "Circles", diamond: "Diamonds", triangle: "Triangles",
  flowchart: "Flowchart symbols", line: "Lines", arrow: "Arrows", svgPath: "SVG vectors", text: "Text", image: "Images",
  schemaTable: "Schema tables", group: "Groups and cards",
};

const ELEMENT_TYPES = new Set(Object.keys(TOOL_LAYER_LABELS));

function isToolLayerElement(value: unknown): value is Element {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Element>;
  return typeof item.type === "string" && ELEMENT_TYPES.has(item.type)
    && (item.type !== "group" || Array.isArray((item as Extract<Element, { type: "group" }>).elements));
}

function collectToolLayerElements(values: readonly unknown[], result: Element[] = []): Element[] {
  for (const value of values) {
    if (!isToolLayerElement(value)) continue;
    result.push(value);
    if (value.type === "group") collectToolLayerElements(value.elements, result);
  }
  return result;
}

export function getToolLayers(elements: Element[], layers: CanvasLayer[] = []): ToolLayer[] {
  const orderedLayers = orderCanvasLayers(layers);
  const layersById = new Map(layers.map(layer => [layer.id, layer]));
  const indicesByLayer = new Map<string, Set<number>>();
  const visitLayered = (item: unknown, rootIndex: number) => {
    if (!isToolLayerElement(item)) return;
    let layer = typeof item.layerId === "string" ? layersById.get(item.layerId) : undefined;
    const visited = new Set<string>();
    while (layer && !visited.has(layer.id) && visited.size < 32) {
      visited.add(layer.id);
      const indices = indicesByLayer.get(layer.id) ?? new Set<number>();
      indices.add(rootIndex); indicesByLayer.set(layer.id, indices);
      layer = layer.parentId ? layersById.get(layer.parentId) : undefined;
    }
    if (item.type === "group") item.elements.forEach(child => visitLayered(child, rootIndex));
  };
  elements.forEach((item, index) => visitLayered(item, index));
  const explicit: ToolLayer[] = orderedLayers.map(layer => {
    const ancestors: string[] = []; let parentId = layer.parentId; let guard = 0;
    while (parentId && guard++ < 32) { const parent = layersById.get(parentId); if (!parent) break; ancestors.unshift(parent.name); parentId = parent.parentId; }
    const path = [...ancestors, layer.name].join(" / ");
    const indices = [...(indicesByLayer.get(layer.id) ?? [])];
    const topIndex = indices.reduce((highest, index) => Math.max(highest, index), -1);
    return { key: `layer:${layer.id}` as const, label: layer.name, path, depth: ancestors.length, indices, topIndex, hidden: layer.hidden === true, locked: layer.locked === true, persistent: true, parentId: layer.parentId, order: layer.order };
  });

  const groups = new Map<ToolLayerKind, Set<number>>();
  elements.forEach((element, index) => {
    const collect = (value: unknown) => {
      if (!isToolLayerElement(value)) return;
      const item = value;
      if (typeof item.layerId !== "string" || !item.layerId) {
        const layerName = typeof item.layerName === "string" ? item.layerName : "";
        const key: ToolLayerKind = layerName ? `named:${layerName}` : item.type;
        const indices = groups.get(key) ?? new Set<number>(); indices.add(index); groups.set(key, indices);
      }
      if (item.type === "group") item.elements.forEach(collect);
    };
    collect(element);
  });
  const implicit = [...groups.entries()].map(([key, indices]) => ({
    key,
    label: key.startsWith("named:") ? key.slice(6).split("/").pop()?.trim() || key.slice(6) : TOOL_LAYER_LABELS[key as Element["type"]],
    depth: key.startsWith("named:") ? Math.max(0, key.slice(6).split("/").length - 1) : 0,
    path: key.startsWith("named:") ? key.slice(6) : "",
    indices: [...indices], topIndex: [...indices].reduce((highest, index) => Math.max(highest, index), -1),
    hidden: [...indices].every(index => elements[index].hidden), locked: [...indices].every(index => elements[index].locked),
  }));
  return [...explicit, ...implicit.sort((left, right) => right.topIndex - left.topIndex)];
}

export function toggleToolLayer(elements: Element[], key: ToolLayerKind, property: "hidden" | "locked"): Element[] {
  if (typeof key !== "string") return elements;
  if (key.startsWith("layer:")) return elements;
  const matches = (element: unknown): element is Element => isToolLayerElement(element)
    && (key.startsWith("named:") ? element.layerName === key.slice(6) : !element.layerName && !element.layerId && element.type === key);
  const layer = collectToolLayerElements(elements).filter(matches);
  if (!layer.length) return elements;
  const nextValue = layer.some(element => !element[property]);
  const update = (items: readonly unknown[]): Element[] => items.map(value => {
    if (!isToolLayerElement(value)) return value as Element;
    const element = value;
    const updated = matches(element) ? { ...element, [property]: nextValue } as Element : element;
    return updated.type === "group" ? { ...updated, elements: update(updated.elements) } : updated;
  });
  return update(elements);
}

export function reorderToolLayer(elements: Element[], sourceKey: ToolLayerKind, targetRow: number): Element[] {
  return reorderToolLayers(elements, [sourceKey], targetRow);
}

export function reorderToolLayers(elements: Element[], sourceKeys: ToolLayerKind[], targetRow: number): Element[] {
  if (!Array.isArray(sourceKeys) || !elements.every(isToolLayerElement)) return elements;
  const orderedKeys = getToolLayers(elements).filter(layer => !layer.persistent).map(layer => layer.key);
  const selected = new Set(sourceKeys.filter((key): key is ToolLayerKind => typeof key === "string" && !key.startsWith("layer:")));
  const moving = orderedKeys.filter(key => selected.has(key));
  if (!moving.length || targetRow < 0 || targetRow >= orderedKeys.length) return elements;
  const remaining = orderedKeys.filter(key => !selected.has(key));
  const removedBefore = orderedKeys.slice(0, targetRow).filter(key => selected.has(key)).length;
  const insertion = Math.max(0, Math.min(remaining.length, targetRow - removedBefore));
  remaining.splice(insertion, 0, ...moving);
  if (remaining.every((key, index) => key === orderedKeys[index])) return elements;
  const grouped = new Map<ToolLayerKind, Element[]>();
  for (const element of elements) {
    const key: ToolLayerKind = element.layerId ? element.type : element.layerName ? `named:${element.layerName}` : element.type;
    if (element.layerId) continue;
    const group = grouped.get(key) ?? []; group.push(element); grouped.set(key, group);
  }
  const reordered = remaining.reverse().flatMap(key => grouped.get(key) ?? []); let cursor = 0;
  return elements.map(element => element.layerId ? element : reordered[cursor++] ?? element);
}
