import type { Binding, Element, ShapeElement, SchemaTableElement, Point, ShapeLabel, FlowchartShape } from "./model";

export const isConnector = (element: Element): element is ShapeElement => element.type === "line" || element.type === "arrow";
export const isLabelShape = (element: Element): element is ShapeElement => ["rectangle", "circle", "diamond", "triangle", "flowchart"].includes(element.type);
const isConnectable = (element: Element): element is ShapeElement | SchemaTableElement => isLabelShape(element) || element.type === "schemaTable";

export function ensureIds(items: Element[]): Element[] {
  return items.map(item => {
    const identified = item.id ? item : { ...item, id: crypto.randomUUID() };
    if (identified.type !== "group") return identified;
    const children = ensureIds(identified.elements);
    return children.every((child, index) => child === identified.elements[index]) ? identified : { ...identified, elements: children };
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
    return !!target && isConnectable(target) && (target.type !== "schemaTable" || !binding.rowId || target.columns.some(column => column.id === binding.rowId));
  }));
}

export function anchorPoint(shape: ShapeElement | SchemaTableElement, anchor: Point, rowId?: string): Point {
  const cx = shape.x + shape.w / 2; const cy = shape.y + shape.h / 2;
  const x = Math.min(shape.x, shape.x + shape.w) + Math.abs(shape.w) * anchor.x;
  const rowIndex = shape.type === "schemaTable" && rowId ? shape.columns.findIndex(column => column.id === rowId) : -1;
  const rowFontSize = shape.type === "schemaTable" ? shape.fontSize ?? 14 : 14;
  const rowHeaderHeight = Math.max(42, rowFontSize * 2.8); const rowHeight = Math.max(30, rowFontSize * 1.8);
  const y = shape.type === "schemaTable" && rowIndex >= 0
    ? shape.y + rowHeaderHeight + rowIndex * rowHeight + rowHeight / 2
    : Math.min(shape.y, shape.y + shape.h) + Math.abs(shape.h) * anchor.y;
  const angle = (shape.rotation ?? 0) * Math.PI / 180;
  return { x: cx + (x - cx) * Math.cos(angle) - (y - cy) * Math.sin(angle), y: cy + (x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle) };
}

/** Four explicit ports keep attachments predictable, including rotated shapes. */
export function nearestBinding(items: Element[], point: Point, threshold: number): { binding: Binding; point: Point } | undefined {
  let best: { binding: Binding; point: Point; distance: number } | undefined;
  const visit = (children: Element[]) => {
    for (const item of [...children].reverse()) {
      if (item.hidden || item.locked) continue;
      if (item.type === "group") { visit(item.elements); continue; }
      if (!isConnectable(item) || !item.id) continue;
      if (item.type === "schemaTable") {
        for (const column of item.columns) for (const anchor of [{ x: 1, y: .5 }, { x: 0, y: .5 }]) {
          const port = anchorPoint(item, anchor, column.id); const distance = Math.hypot(point.x - port.x, point.y - port.y);
          if (distance <= threshold && (!best || distance < best.distance)) best = { binding: { elementId: item.id, anchor, rowId: column.id }, point: port, distance };
        }
      } else for (const anchor of [{ x: .5, y: 0 }, { x: 1, y: .5 }, { x: .5, y: 1 }, { x: 0, y: .5 }]) {
        const port = anchorPoint(item, anchor); const distance = Math.hypot(point.x - port.x, point.y - port.y);
        if (distance <= threshold && (!best || distance < best.distance)) best = { binding: { elementId: item.id, anchor }, point: port, distance };
      }
    }
  };
  visit(items); return best;
}

/** Re-evaluate attachments after every geometry edit, undo, group move, and load. */
export function resolveBindings(items: Element[]): Element[] {
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
      return target && isConnectable(target) && rowExists ? anchorPoint(target, binding!.anchor, binding!.rowId) : undefined;
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
  const remap = new Map(flatten(items).map(item => [item.id, crypto.randomUUID()]));
  const componentRemap = new Map(flatten(items).flatMap(item => item.componentId ? [[item.componentId, crypto.randomUUID()] as const] : []));
  const rowRemap = new Map(flatten(items).flatMap(item => item.type === "schemaTable" ? item.columns.map(column => [column.id, crypto.randomUUID()] as const) : []));
  const diagramRemap = new Map(flatten(items).flatMap(item => item.type === "schemaTable" ? [[item.schemaDiagramId, crypto.randomUUID()] as const] : []));
  const binding = (value?: Binding): Binding | undefined => value && remap.has(value.elementId) ? { ...value, elementId: remap.get(value.elementId)!, rowId: value.rowId ? rowRemap.get(value.rowId) ?? value.rowId : undefined } : undefined;
  const visit = (item: Element): Element => {
    const copy = { ...item, id: remap.get(item.id)!, componentId: item.componentId ? componentRemap.get(item.componentId) : undefined, locked: false };
    if (copy.type === "group") return { ...copy, elements: copy.elements.map(visit) };
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

export const textFont = (text: ShapeLabel) => `${text.italic ? "italic " : ""}${text.bold ? "700" : "400"} ${text.fontSize}px ${text.fontFamily === "hand" ? "cursive" : text.fontFamily === "serif" ? "Georgia, serif" : text.fontFamily === "mono" ? "'Cascadia Mono', Consolas, monospace" : "'DM Sans', sans-serif"}`;
export function labelBox(shape: ShapeElement) {
  // Keep ordinary shape-label padding in canvas units so resizing the shape
  // does not make its text margins grow. Tapered symbols retain extra clearance.
  const width = Math.abs(shape.w); const height = Math.abs(shape.h);
  const tapered = shape.type === "diamond" || shape.flowchartShape === "decision";
  const insetX = Math.min(width / 2, tapered ? Math.max(12, width * .2) : 12);
  const insetY = Math.min(height / 2, shape.flowchartShape === "database" ? Math.max(12, height * .22) : 12);
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

export function extraFlowchartPath(shape: FlowchartShape, x: number, y: number, w: number, h: number): string | undefined {
  const r = x + w; const b = y + h; const m = x + w / 2;
  if (shape === "connector") return `M ${x} ${y + h / 2} a ${w / 2} ${h / 2} 0 1 0 ${w} 0 a ${w / 2} ${h / 2} 0 1 0 ${-w} 0`;
  if (shape === "off-page") return `M ${x} ${y} H ${r} V ${y + h * .65} L ${m} ${b} L ${x} ${y + h * .65} Z`;
  if (shape === "manual-operation") return `M ${x} ${y} H ${r} L ${r - w * .2} ${b} H ${x + w * .2} Z`;
  if (shape === "delay") return `M ${x} ${y} H ${m} C ${r + w / 6} ${y} ${r + w / 6} ${b} ${m} ${b} H ${x} Z`;
  if (shape === "stored-data") return `M ${x + w * .2} ${y} H ${r} C ${r - w * .25} ${y + h / 3} ${r - w * .25} ${b - h / 3} ${r} ${b} H ${x + w * .2} C ${x - w * .06} ${b} ${x - w * .06} ${y} ${x + w * .2} ${y} Z`;
  if (shape === "cloud") return `M ${x + w * .2} ${y + h * .76} C ${x + w * .04} ${y + h * .76} ${x} ${y + h * .63} ${x} ${y + h * .49} C ${x} ${y + h * .34} ${x + w * .13} ${y + h * .25} ${x + w * .29} ${y + h * .27} C ${x + w * .34} ${y + h * .08} ${x + w * .53} ${y} ${x + w * .68} ${y + h * .12} C ${x + w * .77} ${y + h * .18} ${x + w * .8} ${y + h * .26} ${x + w * .81} ${y + h * .31} C ${x + w} ${y + h * .29} ${r} ${y + h * .43} ${r} ${y + h * .56} C ${r} ${y + h * .69} ${x + w * .9} ${y + h * .76} ${x + w * .77} ${y + h * .76} Z`;
  if (shape === "star") { const points = Array.from({ length: 10 }, (_, index) => { const angle = -Math.PI / 2 + index * Math.PI / 5; const radius = index % 2 ? .23 : .48; return `${m + Math.cos(angle) * w * radius} ${y + h / 2 + Math.sin(angle) * h * radius}`; }); return `M ${points.join(" L ")} Z`; }
  if (shape === "lightning") return `M ${x + w * .58} ${y} L ${x + w * .18} ${y + h * .55} H ${x + w * .43} L ${x + w * .31} ${b} L ${r} ${y + h * .38} H ${x + w * .67} Z`;
  if (shape === "heart") return `M ${m} ${b} C ${x + w * .81} ${y + h * .69} ${r} ${y + h * .52} ${r} ${y + h * .3} C ${r} ${y + h * .03} ${x + w * .61} ${y - h * .02} ${m} ${y + h * .23} C ${x + w * .39} ${y - h * .02} ${x} ${y + h * .03} ${x} ${y + h * .3} C ${x} ${y + h * .52} ${x + w * .19} ${y + h * .69} ${m} ${b} Z`;
  if (shape === "callout") return `M ${x + w * .1} ${y} H ${r - w * .1} Q ${r} ${y} ${r} ${y + h * .12} V ${y + h * .68} Q ${r} ${y + h * .8} ${r - w * .1} ${y + h * .8} H ${x + w * .63} L ${x + w * .47} ${b} L ${x + w * .41} ${y + h * .8} H ${x + w * .1} Q ${x} ${y + h * .8} ${x} ${y + h * .68} V ${y + h * .12} Q ${x} ${y} ${x + w * .1} ${y} Z`;
  if (shape === "gear") { const points = Array.from({ length: 24 }, (_, index) => { const angle = -Math.PI / 2 + index * Math.PI / 12; const radius = index % 6 < 2 ? .48 : index % 6 < 4 ? .39 : .48; return `${m + Math.cos(angle) * w * radius} ${y + h / 2 + Math.sin(angle) * h * radius}`; }); return `M ${points.join(" L ")} Z M ${m + w * .17} ${y + h / 2} A ${w * .17} ${h * .17} 0 1 0 ${m - w * .17} ${y + h / 2} A ${w * .17} ${h * .17} 0 1 0 ${m + w * .17} ${y + h / 2} Z`; }
}
