import type { Binding, Element, ShapeElement, Point, ShapeLabel, FlowchartShape } from "./model";

export const isConnector = (element: Element): element is ShapeElement => element.type === "line" || element.type === "arrow";
export const isLabelShape = (element: Element): element is ShapeElement => ["rectangle", "circle", "diamond", "flowchart"].includes(element.type);

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
  return all.every(item => !isConnector(item) || [item.startBinding, item.endBinding].every(binding => !binding || !!ids.get(binding.elementId) && isLabelShape(ids.get(binding.elementId)!)));
}

export function anchorPoint(shape: ShapeElement, anchor: Point): Point {
  const cx = shape.x + shape.w / 2; const cy = shape.y + shape.h / 2;
  const x = Math.min(shape.x, shape.x + shape.w) + Math.abs(shape.w) * anchor.x;
  const y = Math.min(shape.y, shape.y + shape.h) + Math.abs(shape.h) * anchor.y;
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
      if (!isLabelShape(item) || !item.id) continue;
      for (const anchor of [{ x: .5, y: 0 }, { x: 1, y: .5 }, { x: .5, y: 1 }, { x: 0, y: .5 }]) {
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
      return target && isLabelShape(target) ? anchorPoint(target, binding!.anchor) : undefined;
    };
    const start = resolve(item.startBinding); const end = resolve(item.endBinding);
    const x = start?.x ?? item.x; const y = start?.y ?? item.y;
    const w = (end?.x ?? item.x + item.w) - x; const h = (end?.y ?? item.y + item.h) - y;
    if (x === item.x && y === item.y && w === item.w && h === item.h && (!item.startBinding || start) && (!item.endBinding || end)) return item;
    return { ...item, x, y, w, h, startBinding: start ? item.startBinding : undefined, endBinding: end ? item.endBinding : undefined };
  };
  return items.map(visit);
}

export function copyElements(items: Element[], dx = 24, dy = 24): Element[] {
  const remap = new Map(flatten(items).map(item => [item.id, crypto.randomUUID()]));
  const binding = (value?: Binding): Binding | undefined => value && remap.has(value.elementId) ? { ...value, elementId: remap.get(value.elementId)! } : undefined;
  const visit = (item: Element): Element => {
    const copy = { ...item, id: remap.get(item.id)!, locked: false };
    if (copy.type === "group") return { ...copy, elements: copy.elements.map(visit) };
    if (copy.type === "freehand") return { ...copy, points: copy.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
    if (isConnector(copy)) return { ...copy, x: copy.x + dx, y: copy.y + dy, startBinding: binding(copy.startBinding), endBinding: binding(copy.endBinding), routePoints: copy.routePoints?.map(p => ({ x: p.x + dx, y: p.y + dy })) };
    return { ...copy, x: copy.x + dx, y: copy.y + dy };
  };
  return resolveBindings(items.map(visit));
}

export const textFont = (text: ShapeLabel) => `${text.italic ? "italic " : ""}${text.bold ? "700" : "400"} ${text.fontSize}px ${text.fontFamily === "hand" ? "cursive" : "sans-serif"}`;
export function labelBox(shape: ShapeElement) {
  const insetX = Math.min(Math.abs(shape.w) * (shape.type === "diamond" || shape.flowchartShape === "decision" ? .25 : .12), Math.abs(shape.w) / 2);
  const insetY = Math.min(Math.abs(shape.h) * (shape.flowchartShape === "database" ? .3 : .18), Math.abs(shape.h) / 2);
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
}
