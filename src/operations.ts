import type { Binding, ConnectionPoint, Element, GroupElement, ShapeElement, SchemaTableElement, TextElement, Point, Bounds, RelationshipType } from "./model";
import { schemaTableMetrics } from "./features/diagrams/schema-table-layout";

export const isConnector = (element: Element): element is ShapeElement => element.type === "line" || element.type === "arrow";
export const isLabelShape = (element: Element): element is ShapeElement => element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "triangle" || element.type === "flowchart" || element.type === "svgPath";
export const isConnectable = (element: Element): element is ShapeElement | SchemaTableElement | TextElement | GroupElement => isLabelShape(element) || element.type === "schemaTable" || element.type === "text" || element.type === "group" && !!element.componentBounds && (!!element.container || !!element.libraryComponent || !!element.masterId);
export const BOX_ANCHORS: readonly Point[] = [
  { x: .25, y: 0 }, { x: .5, y: 0 }, { x: .75, y: 0 },
  { x: 1, y: .25 }, { x: 1, y: .5 }, { x: 1, y: .75 },
  { x: .75, y: 1 }, { x: .5, y: 1 }, { x: .25, y: 1 },
  { x: 0, y: .75 }, { x: 0, y: .5 }, { x: 0, y: .25 },
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
];
export const DEFAULT_CONNECTION_POINTS: readonly ConnectionPoint[] = [
  { id: "north", name: "North", anchor: { x: .5, y: 0 } },
  { id: "east", name: "East", anchor: { x: 1, y: .5 } },
  { id: "south", name: "South", anchor: { x: .5, y: 1 } },
  { id: "west", name: "West", anchor: { x: 0, y: .5 } },
];

let textBoundsContext: CanvasRenderingContext2D | null | undefined;
const textBoxCache = new WeakMap<TextElement, Bounds>();
export function alignedTextStartX(anchorX: number, width: number, alignment: TextElement["textAlign"] = "left"): number {
  return alignment === "center" ? anchorX - width / 2 : alignment === "right" ? anchorX - width : anchorX;
}
/** Text has no stored width, so ports use the same measured box as selection. */
export function textElementBox(element: TextElement): Bounds {
  const cached = textBoxCache.get(element); if (cached) return cached;
  const lines = element.text.split(/\r?\n/).map((line, index) => element.listType === "bullet" ? `\u2022 ${line}` : element.listType === "number" ? `${index + 1}. ${line}` : line);
  if (textBoundsContext === undefined && typeof document !== "undefined") textBoundsContext = document.createElement("canvas").getContext("2d");
  if (textBoundsContext) textBoundsContext.font = textFont(element);
  let width = element.fontSize * .5;
  for (const line of lines) width = Math.max(width, textBoundsContext?.measureText(line).width ?? line.length * element.fontSize * .6);
  const bounds = { x: alignedTextStartX(element.x, width, element.textAlign), y: element.y, w: width, h: lines.length * element.fontSize * 1.25 };
  textBoxCache.set(element, bounds);
  return bounds;
}

export function ensureIds(items: Element[]): Element[] {
  return items.map(item => {
    const identified = item.id ? item : { ...item, id: crypto.randomUUID() };
    if (identified.type !== "group") return identified;
    const sourceChildren = identified.libraryComponent?.kind === "uml-activation" ? identified.elements.filter(child => child.type !== "text") : identified.elements;
    const children = ensureIds(sourceChildren);
    return children.length === identified.elements.length && children.every((child, index) => child === identified.elements[index]) ? identified : { ...identified, elements: children };
  });
}

export function flatten(items: Element[]): Element[] {
  return items.flatMap(item => item.type === "group" ? [item, ...flatten(item.elements)] : [item]);
}

/** Validate page-local identities and bindings. Missing targets are never silently retargeted. */
export function validReferences(items: Element[]): boolean {
  const all = flatten(items); const ids = new Map(all.map(item => [item.id, item]));
  if (ids.size !== all.length || all.some(item => !item.id)) return false;
  const rowIds = all.flatMap(item => item.type === "schemaTable" ? item.columns.map(column => column.id) : []);
  if (new Set(rowIds).size !== rowIds.length || rowIds.some(id => ids.has(id))) return false;
  return all.every(item => !isConnector(item) || [item.startBinding, item.endBinding, item.forkUpper?.endBinding, item.forkLower?.endBinding].every(binding => {
    if (!binding) return true;
    const target = ids.get(binding.elementId);
    return !!target && isConnectable(target) && (target.type !== "schemaTable" || !binding.rowId || target.columns.some(column => column.id === binding.rowId)) && (!binding.portId || connectionPointsFor(target).some(point => point.id === binding.portId));
  }));
}

export function connectionPointsFor(shape: ShapeElement | SchemaTableElement | TextElement | GroupElement): ConnectionPoint[] {
  const custom = shape.type === "group" ? shape.connectionPoints ?? shape.libraryComponent?.connectionPoints ?? shape.container?.connectionPoints ?? [] : "connectionPoints" in shape ? shape.connectionPoints ?? [] : [];
  return [...DEFAULT_CONNECTION_POINTS, ...custom.filter(point => !DEFAULT_CONNECTION_POINTS.some(defaultPort => defaultPort.id === point.id))];
}

export function anchorPoint(shape: ShapeElement | SchemaTableElement | TextElement | GroupElement, anchor: Point, rowId?: string, portId?: string): Point {
  const box = shape.type === "group" ? shape.componentBounds! : shape.type === "text" ? textElementBox(shape) : { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
  const cx = box.x + box.w / 2; const cy = box.y + box.h / 2;
  const normalized = (portId ? connectionPointsFor(shape).find(port => port.id === portId)?.anchor : undefined) ?? anchor;
  let x = Math.min(box.x, box.x + box.w) + Math.abs(box.w) * normalized.x;
  const rowIndex = shape.type === "schemaTable" && rowId ? shape.columns.findIndex(column => column.id === rowId) : -1;
  // Use the card's shared metrics so row-bound connectors meet the rendered field center.
  const { titleHeight, rowHeight } = shape.type === "schemaTable" ? schemaTableMetrics(shape.fontSize ?? 12) : { titleHeight: 0, rowHeight: 0 };
  let y = shape.type === "schemaTable" && rowIndex >= 0
    ? shape.y + titleHeight + rowIndex * rowHeight + rowHeight / 2
    : Math.min(box.y, box.y + box.h) + Math.abs(box.h) * normalized.y;
  if (shape.type === "circle" && shape.w !== 0 && shape.h !== 0) {
    const dx = (x - cx) / (Math.abs(box.w) / 2); const dy = (y - cy) / (Math.abs(box.h) / 2);
    const scale = Math.hypot(dx, dy) || 1;
    x = cx + (x - cx) / scale; y = cy + (y - cy) / scale;
  }
  const angle = (shape.rotation ?? 0) * Math.PI / 180;
  return { x: cx + (x - cx) * Math.cos(angle) - (y - cy) * Math.sin(angle), y: cy + (x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle) };
}

/** Box corners and edge midpoints keep attachments predictable, including rotated elements. */
export function nearestBinding(items: Element[], point: Point, threshold: number, eligible: (item: Element) => boolean = () => true, relationshipType?: RelationshipType): { binding: Binding; point: Point } | undefined {
  let best: { binding: Binding; point: Point; distance: number } | undefined;
  const blockedByTypedPort = (item: ShapeElement | SchemaTableElement | TextElement | GroupElement, anchor: Point) => !!relationshipType && connectionPointsFor(item).some(port => port.accepts?.length && Math.abs(port.anchor.x - anchor.x) < .0001 && Math.abs(port.anchor.y - anchor.y) < .0001 && !port.accepts.includes(relationshipType));
  const visit = (children: Element[]) => {
    for (let index = children.length - 1; index >= 0; index--) {
      const item = children[index];
      if (item.hidden || item.locked || !eligible(item)) continue;
      if (item.type === "group") {
        if (item.componentBounds && (item.libraryComponent || item.masterId) && item.id) for (const anchor of BOX_ANCHORS) {
          if (blockedByTypedPort(item, anchor)) continue;
          const port = anchorPoint(item, anchor); const distance = Math.hypot(point.x - port.x, point.y - port.y);
          if (distance <= threshold && (!best || distance < best.distance)) best = { binding: { elementId: item.id, anchor }, point: port, distance };
        }
        if (item.componentBounds && (item.libraryComponent || item.container || item.masterId) && item.id) for (const custom of connectionPointsFor(item).filter(port => !port.accepts?.length || !relationshipType || port.accepts.includes(relationshipType))) {
          const port = anchorPoint(item, custom.anchor, undefined, custom.id); const distance = Math.hypot(point.x - port.x, point.y - port.y);
          if (distance <= threshold && (!best || distance <= best.distance)) best = { binding: { elementId: item.id, anchor: custom.anchor, portId: custom.id }, point: port, distance };
        }
        visit(item.elements); continue;
      }
      if (!isConnectable(item) || !item.id) continue;
      if (item.type === "schemaTable") {
        for (const column of item.columns) for (const anchor of [{ x: 1, y: .5 }, { x: 0, y: .5 }]) {
          const port = anchorPoint(item, anchor, column.id); const distance = Math.hypot(point.x - port.x, point.y - port.y);
          if (distance <= threshold && (!best || distance < best.distance)) best = { binding: { elementId: item.id, anchor, rowId: column.id }, point: port, distance };
        }
      }
      for (const anchor of BOX_ANCHORS) {
        if (blockedByTypedPort(item, anchor)) continue;
        const port = anchorPoint(item, anchor); const distance = Math.hypot(point.x - port.x, point.y - port.y);
        if (distance <= threshold && (!best || distance < best.distance)) best = { binding: { elementId: item.id, anchor }, point: port, distance };
      }
      if (item.type !== "schemaTable") for (const custom of connectionPointsFor(item).filter(port => !port.accepts?.length || !relationshipType || port.accepts.includes(relationshipType))) {
        const port = anchorPoint(item, custom.anchor, undefined, custom.id); const distance = Math.hypot(point.x - port.x, point.y - port.y);
        if (distance <= threshold && (!best || distance <= best.distance)) best = { binding: { elementId: item.id, anchor: custom.anchor, portId: custom.id }, point: port, distance };
      }
    }
  };
  visit(items); return best;
}

/** Rebind free connector endpoints when a compatible object is close by. */
export function reattachDanglingConnectors(items: Element[], threshold: number, eligible: (item: Element) => boolean = () => true): { elements: Element[]; count: number } {
  let count = 0;
  const lookup = new Map(flatten(items).map(item => [item.id, item]));
  const endpointBinding = (binding: Binding | undefined) => {
    const target = binding ? lookup.get(binding.elementId) : undefined;
    const rowExists = target?.type !== "schemaTable" || !binding?.rowId || target.columns.some(column => column.id === binding.rowId);
    return binding && target && isConnectable(target) && rowExists && (!binding.portId || connectionPointsFor(target).some(port => port.id === binding.portId));
  };
  const visit = (item: Element): Element => {
    if (item.type === "group") {
      if (item.hidden || item.locked || !eligible(item)) return item;
      const children = item.elements.map(visit);
      return children.every((child, index) => child === item.elements[index]) ? item : { ...item, elements: children };
    }
    if (!isConnector(item) || !eligible(item)) return item;
    const before = { ...item };
    let startBinding = item.startBinding; let endBinding = item.endBinding;
    let start = { x: item.x, y: item.y }; let end = { x: item.x + item.w, y: item.y + item.h };
    if (!endpointBinding(startBinding)) {
      const match = nearestBinding(items, start, threshold, eligible, item.relationshipType);
      if (match) { start = match.point; startBinding = match.binding; count++; }
      else startBinding = undefined;
    }
    if (!endpointBinding(endBinding)) {
      const match = nearestBinding(items, end, threshold, eligible, item.relationshipType);
      if (match) { end = match.point; endBinding = match.binding; count++; }
      else endBinding = undefined;
    }
    if (startBinding === item.startBinding && endBinding === item.endBinding) return item;
    return { ...before, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, startBinding, endBinding };
  };
  return { elements: items.map(visit), count };
}

/** Re-evaluate attachments after every geometry edit, undo, group move, and load. */
export function resolveBindings(items: Element[]): Element[] {
  const hasBindings = (children: Element[]): boolean => children.some(item => item.type === "group"
    ? hasBindings(item.elements)
    : isConnector(item) && !!(item.startBinding || item.endBinding || item.forkUpper?.endBinding || item.forkLower?.endBinding));
  if (!hasBindings(items)) return items;
  const lookup = new Map(flatten(items).map(item => [item.id, item]));
  const visit = (item: Element): Element => {
    if (item.type === "group") {
      const children = item.elements.map(visit);
      return children.every((child, index) => child === item.elements[index]) ? item : { ...item, elements: children };
    }
    if (!isConnector(item)) return item;
    const resolve = (binding?: Binding) => {
      const target = binding ? lookup.get(binding.elementId) : undefined;
      const rowExists = target?.type !== "schemaTable" || !binding?.rowId || target.columns.some(column => column.id === binding.rowId);
      return target && isConnectable(target) && rowExists && (!binding?.portId || connectionPointsFor(target).some(port => port.id === binding.portId)) ? anchorPoint(target, binding!.anchor, binding!.rowId, binding!.portId) : undefined;
    };
    const resolveBranch = (branch: ShapeElement["forkUpper"]) => {
      if (!branch) return undefined;
      const end = resolve(branch.endBinding);
      if (!branch.endBinding || !end) return branch.endBinding ? { ...branch, endBinding: undefined } : branch;
      if (branch.end?.x === end.x && branch.end?.y === end.y) return branch;
      return { ...branch, end, endBinding: branch.endBinding };
    };
    const start = resolve(item.startBinding); const end = resolve(item.endBinding);
    const x = start?.x ?? item.x; const y = start?.y ?? item.y;
    const w = (end?.x ?? item.x + item.w) - x; const h = (end?.y ?? item.y + item.h) - y;
    const forkUpper = resolveBranch(item.forkUpper); const forkLower = resolveBranch(item.forkLower);
    if (x === item.x && y === item.y && w === item.w && h === item.h && forkUpper === item.forkUpper && forkLower === item.forkLower && (!item.startBinding || start) && (!item.endBinding || end)) return item;
    return { ...item, x, y, w, h, startBinding: start ? item.startBinding : undefined, endBinding: end ? item.endBinding : undefined, forkUpper, forkLower };
  };
  return items.map(visit);
}

export function copyElements(items: Element[], dx = 24, dy = 24): Element[] {
  const allElements: Element[] = [];
  const collect = (item: Element) => {
    allElements.push(item);
    if (item.type === "group") {
      item.elements.forEach(collect);
      item.stencilParameters?.template.forEach(collect);
    }
  };
  items.forEach(collect);
  const remap = new Map(allElements.filter(item => item.id).map(item => [item.id!, crypto.randomUUID()]));
  const componentRemap = new Map(allElements.flatMap(item => item.componentId ? [[item.componentId, crypto.randomUUID()] as const] : []));
  const rowRemap = new Map(allElements.flatMap(item => item.type === "schemaTable" ? item.columns.map(column => [column.id, crypto.randomUUID()] as const) : []));
  const diagramRemap = new Map(allElements.flatMap(item => item.type === "schemaTable" ? [[item.schemaDiagramId, crypto.randomUUID()] as const] : []));
  const binding = (value?: Binding): Binding | undefined => value && remap.has(value.elementId) ? { ...value, elementId: remap.get(value.elementId)!, rowId: value.rowId ? rowRemap.get(value.rowId) ?? value.rowId : undefined } : undefined;
  const visit = (item: Element): Element => {
    const copy = { ...item, id: item.id ? remap.get(item.id) ?? crypto.randomUUID() : crypto.randomUUID(), componentId: item.componentId ? componentRemap.get(item.componentId) : undefined, locked: false };
    if (copy.type === "group") return { ...copy, ...(copy.componentBounds ? { componentBounds: { ...copy.componentBounds, x: copy.componentBounds.x + dx, y: copy.componentBounds.y + dy } } : {}), elements: copy.elements.map(visit), ...(copy.stencilParameters ? { stencilParameters: { ...copy.stencilParameters, template: copy.stencilParameters.template.map(visit) } } : {}) };
    if (copy.type === "freehand") return { ...copy, points: copy.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })) };
    if (copy.type === "schemaTable") return { ...copy, schemaDiagramId: diagramRemap.get(copy.schemaDiagramId)!, columns: copy.columns.map(column => ({ ...column, id: rowRemap.get(column.id)! })), x: copy.x + dx, y: copy.y + dy };
    if (isConnector(copy)) {
      const shiftBranch = (branch: ShapeElement["forkUpper"]) => branch ? {
        ...branch,
        end: branch.end ? { x: branch.end.x + dx, y: branch.end.y + dy } : undefined,
        routePoints: branch.routePoints?.map(p => ({ x: p.x + dx, y: p.y + dy })),
        endBinding: binding(branch.endBinding),
      } : undefined;
      return { ...copy, schemaDiagramId: copy.schemaDiagramId ? diagramRemap.get(copy.schemaDiagramId) : undefined, x: copy.x + dx, y: copy.y + dy, startBinding: binding(copy.startBinding), endBinding: binding(copy.endBinding), routePoints: copy.routePoints?.map(p => ({ x: p.x + dx, y: p.y + dy })), forkUpper: shiftBranch(copy.forkUpper), forkLower: shiftBranch(copy.forkLower) };
    }
    return { ...copy, x: copy.x + dx, y: copy.y + dy };
  };
  return resolveBindings(items.map(visit));
}

export const textFont = (text: Pick<TextElement, "italic" | "bold" | "fontSize" | "fontFamily">) => `${text.italic ? "italic " : ""}${text.bold ? "700" : "400"} ${text.fontSize}px ${text.fontFamily === "hand" ? "'Comic Sans MS', 'Segoe Print', cursive" : text.fontFamily === "serif" ? "Georgia, 'Times New Roman', serif" : text.fontFamily === "mono" ? "'Cascadia Mono', Consolas, monospace" : text.fontFamily === "rounded" ? "'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif" : text.fontFamily === "display" ? "'Arial Black', Impact, sans-serif" : "system-ui, 'Segoe UI', sans-serif"}`;
export function labelBox(shape: ShapeElement) {
  // Keep padding proportional only while a shape is small. A fixed inset can
  // consume the entire label area on compact components such as UML lifelines.
  const width = Math.abs(shape.w); const height = Math.abs(shape.h);
  if (shape.type === "line" || shape.type === "arrow") {
    const fontSize = shape.label?.fontSize ?? 12;
    const lineCount = Math.max(1, shape.label?.text.split(/\r?\n/).length ?? 1);
    const labelWidth = Math.max(120, width);
    const centerX = shape.x + shape.w / 2 + (shape.label?.offsetX ?? 0);
    const centerY = shape.y + shape.h / 2 - fontSize * 1.75 + (shape.label?.offsetY ?? 0);
    return { x: centerX - labelWidth / 2, y: centerY, w: labelWidth, h: Math.max(fontSize * 1.25, lineCount * fontSize * 1.25) };
  }
  const tapered = shape.type === "diamond" || ["decision", "data", "hexagon", "parallelogram", "trapezoid", "pentagon", "octagon", "chevron", "shield"].includes(shape.flowchartShape ?? "");
  const insetX = Math.min(width / 2, tapered ? Math.min(12, width * .2) : Math.min(12, Math.max(1, width * .08)));
  const insetY = Math.min(height / 2, shape.flowchartShape === "database" ? Math.min(12, height * .22) : Math.min(12, Math.max(1, height * .1)));
  return { x: Math.min(shape.x, shape.x + shape.w) + insetX, y: Math.min(shape.y, shape.y + shape.h) + insetY, w: Math.max(1, Math.abs(shape.w) - insetX * 2), h: Math.max(1, Math.abs(shape.h) - insetY * 2) };
}

/** Shared line wrapping and justification for canvas and SVG output. */
export function textLayout(ctx: CanvasRenderingContext2D, shape: ShapeElement) {
  const label = shape.label; if (!label) return [];
  const box = labelBox(shape); ctx.save(); ctx.font = textFont(label);
  const lines: { text: string; last: boolean }[] = [];
  label.text.split(/\r?\n/).forEach((paragraph, index) => {
    const prefix = label.listType === "bullet" ? "• " : label.listType === "number" ? `${index + 1}. ` : "";
    let line = "";
    for (const word of (prefix + paragraph).split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > box.w) { lines.push({ text: line, last: false }); line = ""; }
      // Break long words rather than allowing text to escape the shape.
      for (const character of (line ? " " : "") + word) {
        if (line && ctx.measureText(line + character).width > box.w) { lines.push({ text: line, last: false }); line = ""; }
        line += character;
      }
    }
    lines.push({ text: line, last: true });
  });
  const step = label.fontSize * 1.25; const total = lines.length * step;
  const top = box.y + (label.verticalAlign === "bottom" ? Math.max(0, box.h - total) : label.verticalAlign === "middle" ? Math.max(0, (box.h - total) / 2) : 0);
  const output = lines.flatMap((line, index) => {
    const y = top + index * step; if (y + label.fontSize > box.y + box.h + .01) return [];
    const width = ctx.measureText(line.text).width;
    if (label.textAlign === "justify" && !line.last && line.text.includes(" ")) {
      const words = line.text.split(" "); const gap = (box.w - words.reduce((sum, word) => sum + ctx.measureText(word).width, 0)) / (words.length - 1);
      let x = box.x; return words.map(text => { const run = { text, x, y }; x += ctx.measureText(text).width + gap; return run; });
    }
    return [{ text: line.text, x: box.x + (label.textAlign === "center" ? (box.w - width) / 2 : label.textAlign === "right" ? box.w - width : 0), y }];
  });
  ctx.restore(); return output;
}
