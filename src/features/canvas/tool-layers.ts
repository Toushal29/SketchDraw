import type { Element } from "../../model";

export type ToolLayerKind = Element["type"];
export type ToolLayer = {
  key: ToolLayerKind;
  label: string;
  indices: number[];
  topIndex: number;
  hidden: boolean;
  locked: boolean;
};

const TOOL_LAYER_LABELS: Record<ToolLayerKind, string> = {
  freehand: "Pen and brushes",
  rectangle: "Rectangles",
  circle: "Circles",
  diamond: "Diamonds",
  triangle: "Triangles",
  flowchart: "Flowchart symbols",
  line: "Lines",
  arrow: "Arrows",
  text: "Text",
  image: "Images",
  schemaTable: "Schema tables",
  group: "Groups and cards",
};

export function getToolLayers(elements: Element[]): ToolLayer[] {
  const groups = new Map<ToolLayerKind, number[]>();
  elements.forEach((element, index) => {
    const indices = groups.get(element.type) ?? [];
    indices.push(index);
    groups.set(element.type, indices);
  });

  return [...groups.entries()]
    .map(([key, indices]) => ({
      key,
      label: TOOL_LAYER_LABELS[key],
      indices,
      topIndex: indices[indices.length - 1],
      hidden: indices.every(index => elements[index].hidden),
      locked: indices.every(index => elements[index].locked),
    }))
    .sort((a, b) => b.topIndex - a.topIndex);
}

export function toggleToolLayer(elements: Element[], key: ToolLayerKind, property: "hidden" | "locked"): Element[] {
  const layer = elements.filter(element => element.type === key);
  if (!layer.length) return elements;
  const nextValue = layer.some(element => !element[property]);
  return elements.map(element => element.type === key ? { ...element, [property]: nextValue } as Element : element);
}

export function reorderToolLayer(elements: Element[], sourceKey: ToolLayerKind, targetRow: number): Element[] {
  const orderedKeys = getToolLayers(elements).map(layer => layer.key);
  const sourceRow = orderedKeys.indexOf(sourceKey);
  if (sourceRow < 0 || targetRow < 0 || targetRow >= orderedKeys.length || sourceRow === targetRow) return elements;

  orderedKeys.splice(sourceRow, 1);
  orderedKeys.splice(targetRow, 0, sourceKey);

  const grouped = new Map<ToolLayerKind, Element[]>();
  for (const element of elements) {
    const group = grouped.get(element.type) ?? [];
    group.push(element);
    grouped.set(element.type, group);
  }

  // The canvas array is back-to-front, while the panel is front-to-back.
  return orderedKeys.reverse().flatMap(key => grouped.get(key) ?? []);
}
