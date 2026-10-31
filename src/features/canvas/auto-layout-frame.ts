import type { AutoLayoutConfig, Bounds, Element, GroupElement } from "../../model";
import { isConnector } from "../../operations";
import { elementBounds } from "./bounds";
import { resizeContainerWithChildren } from "./structure";
import { translateElement } from "./translate";

export const DEFAULT_AUTO_LAYOUT: AutoLayoutConfig = { direction: "vertical", gap: 12, padding: 16, align: "start" };
const EPSILON = .01;
const MIN_FILL = 25;

export type AutoLayoutPorts = {
  /** Resizes complex objects such as library components. Return undefined to use the built-in resize. */
  resize?: (element: Element, bounds: Bounds) => Element | undefined;
};

export function normalizeAutoLayout(value: Partial<AutoLayoutConfig> | undefined): AutoLayoutConfig {
  const clamp = (input: unknown, fallback: number) => typeof input === "number" && Number.isFinite(input) ? Math.max(0, Math.min(500, Math.round(input))) : fallback;
  return {
    direction: value?.direction === "horizontal" || value?.direction === "grid" ? value.direction : "vertical",
    gap: clamp(value?.gap, DEFAULT_AUTO_LAYOUT.gap), padding: clamp(value?.padding, DEFAULT_AUTO_LAYOUT.padding),
    align: value?.align === "center" || value?.align === "end" || value?.align === "stretch" ? value.align : "start",
    ...(value?.wrap === true ? { wrap: true } : {}),
    ...(typeof value?.columns === "number" && Number.isFinite(value.columns) ? { columns: Math.max(1, Math.min(12, Math.round(value.columns))) } : {}),
  };
}

function resizeChild(element: Element, target: Bounds, ports: AutoLayoutPorts): Element {
  const custom = ports.resize?.(element, target);
  if (custom) return custom;
  if (element.type === "group") return element.componentBounds ? resizeContainerWithChildren(element, target) : element;
  if (element.type === "freehand" || element.type === "text" || !("w" in element) || !("h" in element)) return element;
  return { ...element, x: target.x, y: target.y, w: target.w, h: target.h } as Element;
}

function placeChild(element: Element, target: Bounds, ports: AutoLayoutPorts): Element {
  let next = element; let current = elementBounds(element);
  if (Math.abs(current.w - target.w) > EPSILON || Math.abs(current.h - target.h) > EPSILON) { next = resizeChild(element, target, ports); current = elementBounds(next); }
  const dx = target.x - current.x; const dy = target.y - current.y;
  return Math.abs(dx) > EPSILON || Math.abs(dy) > EPSILON ? translateElement(next, dx, dy) : next;
}

/**
 * Stacks a frame's children along one axis with a fixed gap and padding. Children marked `layoutFill`
 * share leftover space on the main axis; `stretch` alignment fills the cross axis. A hugging frame
 * (auto-resize, not size-locked) grows or shrinks to its content from its top-left corner.
 */
export function reflowAutoLayoutFrame(group: GroupElement, ports: AutoLayoutPorts = {}): GroupElement {
  const config = group.container?.autoLayout; const frame = group.componentBounds;
  if (!config || !frame) return group;
  const horizontal = config.direction === "horizontal";
  const hug = !!group.container?.autoResize && !group.container.lockedSize;
  const children = group.elements.filter(child => !child.hidden && !isConnector(child));
  if (!children.length) return group;
  if (config.direction === "grid" || config.wrap) {
    const padding = config.padding; const gap = config.gap; const boxes = children.map(elementBounds); const placed = new Map<Element, Element>();
    let targets: Bounds[] = [];
    if (config.direction === "grid") {
      const columns = Math.max(1, Math.min(children.length, config.columns ?? Math.ceil(Math.sqrt(children.length * Math.max(.25, frame.w / Math.max(1, frame.h))))));
      const rows = Math.ceil(children.length / columns); const hugCellW = Math.max(...boxes.map(box => box.w)); const hugCellH = Math.max(...boxes.map(box => box.h));
      const cellW = hug ? hugCellW : Math.max(25, (frame.w - padding * 2 - gap * (columns - 1)) / columns);
      const cellH = hug ? hugCellH : Math.max(25, (frame.h - padding * 2 - gap * (rows - 1)) / rows);
      targets = children.map((_, index) => { const column = index % columns; const row = Math.floor(index / columns); const box = boxes[index]; const w = config.align === "stretch" || children[index].layoutFill ? cellW : box.w; const h = config.align === "stretch" || children[index].layoutFill ? cellH : box.h; const offsetX = config.align === "center" ? (cellW - w) / 2 : config.align === "end" ? cellW - w : 0; const offsetY = config.align === "center" ? (cellH - h) / 2 : config.align === "end" ? cellH - h : 0; return { x: frame.x + padding + column * (cellW + gap) + offsetX, y: frame.y + padding + row * (cellH + gap) + offsetY, w, h }; });
    } else {
      const horizontal = config.direction === "horizontal"; const availableMain = Math.max(25, (horizontal ? frame.w : frame.h) - padding * 2);
      const rows: { indices: number[]; main: number; cross: number }[] = [];
      let row = { indices: [] as number[], main: 0, cross: 0 };
      children.forEach((_, index) => {
        const box = boxes[index]; const main = horizontal ? box.w : box.h; const cross = horizontal ? box.h : box.w;
        if (!hug && row.indices.length && row.main + gap + main > availableMain) { rows.push(row); row = { indices: [], main: 0, cross: 0 }; }
        row.indices.push(index); row.main += (row.indices.length > 1 ? gap : 0) + main; row.cross = Math.max(row.cross, cross);
      });
      if (row.indices.length) rows.push(row);
      let crossCursor = horizontal ? frame.y + padding : frame.x + padding;
      for (const current of rows) {
        let mainCursor = horizontal ? frame.x + padding : frame.y + padding;
        for (const index of current.indices) {
          const box = boxes[index]; const naturalMain = horizontal ? box.w : box.h; const naturalCross = horizontal ? box.h : box.w;
          const main = naturalMain; const cross = config.align === "stretch" ? current.cross : naturalCross;
          const crossOffset = config.align === "center" ? (current.cross - cross) / 2 : config.align === "end" ? current.cross - cross : 0;
          targets[index] = horizontal ? { x: mainCursor, y: crossCursor + crossOffset, w: main, h: cross } : { x: crossCursor + crossOffset, y: mainCursor, w: cross, h: main };
          mainCursor += main + gap;
        }
        crossCursor += current.cross + gap;
      }
    }
    children.forEach((child, index) => { const next = placeChild(child, targets[index], ports); if (next !== child) placed.set(child, next); });
    const nextChildren = group.elements.map(child => placed.get(child) ?? child); const visibleBounds = children.map(child => elementBounds(placed.get(child) ?? child));
    const content = { x: Math.min(...visibleBounds.map(box => box.x)), y: Math.min(...visibleBounds.map(box => box.y)), w: Math.max(...visibleBounds.map(box => box.x + box.w)) - Math.min(...visibleBounds.map(box => box.x)), h: Math.max(...visibleBounds.map(box => box.y + box.h)) - Math.min(...visibleBounds.map(box => box.y)) };
    const nextFrame = hug ? { x: frame.x, y: frame.y, w: Math.max(25, content.w + padding * 2), h: Math.max(25, content.h + padding * 2) } : frame;
    const changed = placed.size > 0 || Math.abs(nextFrame.w - frame.w) > EPSILON || Math.abs(nextFrame.h - frame.h) > EPSILON;
    return changed ? { ...group, componentBounds: nextFrame, ...(placed.size ? { elements: nextChildren } : {}) } : group;
  }
  const mainOf = (box: Bounds) => horizontal ? box.w : box.h; const crossOf = (box: Bounds) => horizontal ? box.h : box.w;
  const boxes = children.map(elementBounds);
  const padding = config.padding; const gaps = config.gap * (children.length - 1);
  const crossSpace = hug ? Math.max(...boxes.map(crossOf)) : Math.max(0, crossOf(frame) - padding * 2);
  const fillers = hug ? [] : children.filter(child => child.layoutFill);
  const fixedMain = boxes.reduce((total, box, index) => total + (fillers.includes(children[index]) ? 0 : mainOf(box)), 0);
  const fillMain = fillers.length ? Math.max(MIN_FILL, (mainOf(frame) - padding * 2 - gaps - fixedMain) / fillers.length) : 0;
  const mainStart = (horizontal ? frame.x : frame.y) + padding; const crossStart = (horizontal ? frame.y : frame.x) + padding;
  const placed = new Map<Element, Element>(); let cursor = mainStart; let farthestCross = 0; let changed = false;
  children.forEach((child, index) => {
    const box = boxes[index];
    const targetMain = fillers.includes(child) ? fillMain : mainOf(box);
    const targetCross = config.align === "stretch" ? crossSpace : crossOf(box);
    const offset = config.align === "center" ? (crossSpace - targetCross) / 2 : config.align === "end" ? crossSpace - targetCross : 0;
    const target: Bounds = horizontal ? { x: cursor, y: crossStart + offset, w: targetMain, h: targetCross } : { x: crossStart + offset, y: cursor, w: targetCross, h: targetMain };
    const next = placeChild(child, target, ports);
    if (next !== child) { placed.set(child, next); changed = true; }
    const actual = elementBounds(next);
    cursor += mainOf(actual) + config.gap; farthestCross = Math.max(farthestCross, crossOf(actual));
  });
  const extent = cursor - config.gap + padding - mainStart + padding;
  const nextFrame: Bounds = hug
    ? { x: frame.x, y: frame.y, w: horizontal ? extent : farthestCross + padding * 2, h: horizontal ? farthestCross + padding * 2 : extent }
    : frame;
  const frameChanged = Math.abs(nextFrame.w - frame.w) > EPSILON || Math.abs(nextFrame.h - frame.h) > EPSILON;
  if (!changed && !frameChanged) return group;
  return { ...group, ...(frameChanged ? { componentBounds: nextFrame } : {}), elements: changed ? group.elements.map(child => placed.get(child) ?? child) : group.elements };
}

/** Re-flows every auto-layout frame, innermost first. Returns the same array when nothing moved. */
export function reflowAutoLayoutFrames(items: Element[], ports: AutoLayoutPorts = {}): Element[] {
  const next = items.map(item => {
    if (item.type !== "group") return item;
    const children = reflowAutoLayoutFrames(item.elements, ports);
    const group = children.some((child, index) => child !== item.elements[index]) ? { ...item, elements: children } : item;
    return group.container?.autoLayout ? reflowAutoLayoutFrame(group, ports) : group;
  });
  return next.every((item, index) => item === items[index]) ? items : next;
}

/** True when any frame in the tree uses auto layout, so callers can skip the pass for ordinary drawings. */
export function hasAutoLayoutFrames(items: Element[]): boolean {
  return items.some(item => item.type === "group" && (!!item.container?.autoLayout || hasAutoLayoutFrames(item.elements)));
}
