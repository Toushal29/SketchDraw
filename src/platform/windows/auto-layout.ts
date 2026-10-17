import ELK, { type ElkNode } from "elkjs/lib/elk-api.js";
import elkWorkerUrl from "elkjs/lib/elk-worker.min.js?url";
import type { Element, ShapeElement } from "../../model";
import { elementBounds, unionBounds } from "../../features/canvas/bounds";

const elk = new ELK({ workerUrl: elkWorkerUrl, algorithms: ["layered"] });

function hasLockedChild(element: Element): boolean {
  return element.type === "group" && element.elements.some(child => child.locked || hasLockedChild(child));
}

function isConnector(element: Element): element is ShapeElement & { type: "line" | "arrow" } {
  return element.type === "line" || element.type === "arrow";
}

/** Repositions top-level objects with ELK, using existing connector bindings as graph edges. */
export async function autoLayoutElements(elements: Element[], selectedIndices: number[]): Promise<Element[]> {
  const selected = new Set(selectedIndices);
  const useSelection = selectedIndices.length > 1;
  const nodes = elements.flatMap((element, index) => {
    if (element.hidden || element.locked || isConnector(element) || hasLockedChild(element) || (useSelection && !selected.has(index))) return [];
    const bounds = elementBounds(element);
    if (![bounds.x, bounds.y, bounds.w, bounds.h].every(Number.isFinite)) return [];
    return [{ id: `node-${index}`, index, element, bounds }];
  });
  if (nodes.length < 2) return elements;

  const nodesById = new Map(nodes.map(node => [node.id, node] as const));
  const nodesByIndex = new Map(nodes.map(node => [node.index, node] as const));
  const nodeIds = new Set(nodes.map(node => node.id));
  const rootByChildId = new Map<string, string>();
  for (const node of nodes) {
    const addIds = (element: Element) => {
      if (element.id) rootByChildId.set(element.id, node.id);
      if (element.type === "group") element.elements.forEach(addIds);
    };
    addIds(node.element);
  }

  const edges = elements.flatMap((element, index) => {
    if (!isConnector(element) || element.hidden) return [];
    const source = element.startBinding?.elementId ? rootByChildId.get(element.startBinding.elementId) : undefined;
    const target = element.endBinding?.elementId ? rootByChildId.get(element.endBinding.elementId) : undefined;
    if (!source || !target || source === target || !nodeIds.has(source) || !nodeIds.has(target)) return [];
    return [{ id: `edge-${index}`, sources: [source], targets: [target] }];
  });

  const graph: ElkNode = {
    id: "sketchdraw",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "48",
      "elk.layered.spacing.nodeNodeBetweenLayers": "88",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.padding": "[top=28,left=28,bottom=28,right=28]",
    },
    children: nodes.map(({ id, bounds }) => ({ id, width: Math.max(64, bounds.w), height: Math.max(40, bounds.h) })),
    edges,
  };

  const result = await elk.layout(graph);
  const positions = new Map((result.children ?? []).flatMap(node => {
    const source = nodesById.get(node.id);
    if (!source || !Number.isFinite(node.x) || !Number.isFinite(node.y)) return [];
    return [[source.index, { x: node.x!, y: node.y! }] as const];
  }));
  if (positions.size < 2) return elements;

  const beforeBounds = unionBounds(nodes.map(node => node.bounds));
  const layoutChildren = result.children ?? [];
  const left = Math.min(...layoutChildren.map(node => node.x ?? 0));
  const top = Math.min(...layoutChildren.map(node => node.y ?? 0));
  const offsetX = (beforeBounds?.x ?? 0) - left;
  const offsetY = (beforeBounds?.y ?? 0) - top;

  return elements.map((element, index) => {
    const position = positions.get(index);
    const original = nodesByIndex.get(index);
    if (!position || !original) return element;
    const dx = offsetX + position.x - original.bounds.x;
    const dy = offsetY + position.y - original.bounds.y;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return element;
    const move = (item: Element): Element => {
      if (item.locked) return item;
      if (item.type === "group") {
        return {
          ...item,
          ...(item.componentBounds ? { componentBounds: { ...item.componentBounds, x: item.componentBounds.x + dx, y: item.componentBounds.y + dy } } : {}),
          elements: item.elements.map(move),
        };
      }
      if (item.type === "freehand") return { ...item, points: item.points.map(point => ({ ...point, x: point.x + dx, y: point.y + dy })) };
      if (isConnector(item)) return {
        ...item,
        x: item.x + dx,
        y: item.y + dy,
        routePoints: item.routePoints?.map(point => ({ x: point.x + dx, y: point.y + dy })),
        forkUpper: item.forkUpper ? { ...item.forkUpper, end: item.forkUpper.end ? { x: item.forkUpper.end.x + dx, y: item.forkUpper.end.y + dy } : undefined, routePoints: item.forkUpper.routePoints?.map(point => ({ x: point.x + dx, y: point.y + dy })) } : undefined,
        forkLower: item.forkLower ? { ...item.forkLower, end: item.forkLower.end ? { x: item.forkLower.end.x + dx, y: item.forkLower.end.y + dy } : undefined, routePoints: item.forkLower.routePoints?.map(point => ({ x: point.x + dx, y: point.y + dy })) } : undefined,
      };
      return { ...item, x: item.x + dx, y: item.y + dy };
    };
    return move(element);
  });
}
