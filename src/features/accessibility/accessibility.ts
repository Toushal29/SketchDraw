import type { Element, GroupElement, ShapeElement } from "../../model";

export const ALT_TEXT_MAX_LENGTH = 500;

/** Okabe-Ito colors stay distinguishable under the common forms of color-vision deficiency. */
export const COLOR_BLIND_SAFE_PALETTE: readonly { value: string; label: string }[] = [
  { value: "#000000", label: "Black" },
  { value: "#e69f00", label: "Orange" },
  { value: "#56b4e9", label: "Sky blue" },
  { value: "#009e73", label: "Bluish green" },
  { value: "#f0e442", label: "Yellow" },
  { value: "#0072b2", label: "Blue" },
  { value: "#d55e00", label: "Vermillion" },
  { value: "#cc79a7", label: "Reddish purple" },
];

export type ColorVisionMode = "none" | "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia";

/** Machado et al. (2009) full-severity matrices, applied to the displayed canvas only. */
export const COLOR_VISION_MODES: readonly { id: ColorVisionMode; label: string; matrix?: string }[] = [
  { id: "none", label: "Normal vision" },
  { id: "protanopia", label: "Protanopia (no red)", matrix: "0.152286 1.052583 -0.204868 0 0  0.114503 0.786281 0.099216 0 0  -0.003882 -0.048116 1.051998 0 0  0 0 0 1 0" },
  { id: "deuteranopia", label: "Deuteranopia (no green)", matrix: "0.367322 0.860646 -0.227968 0 0  0.280085 0.672501 0.047413 0 0  -0.011820 0.042940 0.968881 0 0  0 0 0 1 0" },
  { id: "tritanopia", label: "Tritanopia (no blue)", matrix: "1.255528 -0.076749 -0.178779 0 0  -0.078411 0.930809 0.147602 0 0  0.004733 0.691367 0.303900 0 0  0 0 0 1 0" },
  { id: "achromatopsia", label: "Achromatopsia (no color)", matrix: "0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0" },
];

export function isColorVisionMode(value: unknown): value is ColorVisionMode {
  return COLOR_VISION_MODES.some(mode => mode.id === value);
}

function parseHex(color: string): [number, number, number] | undefined {
  const match = /^#([\da-f]{6})$/i.exec(color.trim());
  if (!match) return undefined;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** WCAG relative luminance of a #rrggbb color. */
export function relativeLuminance(color: string): number | undefined {
  const rgb = parseHex(color);
  if (!rgb) return undefined;
  const [r, g, b] = rgb.map(channel => { const value = channel / 255; return value <= .03928 ? value / 12.92 : Math.pow((value + .055) / 1.055, 2.4); });
  return .2126 * r + .7152 * g + .0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colors, or undefined when either is not a hex color. */
export function contrastRatio(foreground: string, background: string): number | undefined {
  const a = relativeLuminance(foreground); const b = relativeLuminance(background);
  if (a === undefined || b === undefined) return undefined;
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

/** Blends a #rrggbb color over another by `alpha`, so translucent fills use their visible color. */
export function blendColors(top: string, bottom: string, alpha: number): string {
  const a = parseHex(top); const b = parseHex(bottom);
  if (!a || !b) return top;
  const mix = a.map((channel, index) => Math.round(channel * alpha + b[index] * (1 - alpha)));
  return `#${mix.map(channel => channel.toString(16).padStart(2, "0")).join("")}`;
}

const TYPE_NAMES: Partial<Record<Element["type"], string>> = {
  freehand: "Drawing", rectangle: "Rectangle", circle: "Ellipse", diamond: "Diamond", triangle: "Triangle", flowchart: "Flowchart shape",
  line: "Line", arrow: "Arrow", svgPath: "Vector shape", text: "Text", image: "Image", schemaTable: "Database table", group: "Group",
};

const clean = (value: string | undefined) => value?.replace(/\s+/g, " ").trim() ?? "";

function groupRole(group: GroupElement): string {
  if (group.note) return group.note.kind === "checklist" ? "Checklist" : group.note.kind === "sticky" ? "Sticky note" : "Note";
  if (group.container) return group.container.kind === "swimlane" ? "Swimlane" : group.container.kind === "frame" ? "Frame" : "Container";
  if (group.libraryComponent) return "Component";
  return "Group";
}

function innerText(element: Element): string {
  if (element.type === "text") return clean(element.text);
  if (element.type === "schemaTable") return clean(element.name);
  if (element.type === "group") return element.elements.map(innerText).filter(Boolean).join(" ");
  return "label" in element ? clean(element.label?.text) : "";
}

/** Role such as "Rectangle" or "Note", for screen-reader announcements and the document outline. */
export function elementRole(element: Element): string {
  if (element.type === "group") return groupRole(element);
  if (element.type === "arrow" || element.type === "line") return element.type === "arrow" ? "Connector arrow" : "Connector line";
  return TYPE_NAMES[element.type] ?? "Object";
}

/** The accessible name: author-written alt text first, then visible labels. */
export function elementAccessibleName(element: Element): string {
  const alt = clean(element.altText);
  if (alt) return alt;
  if (element.type === "group") {
    const name = clean(element.container?.name) || clean(element.note?.title) || clean(element.libraryComponent?.label) || innerText(element);
    return name.slice(0, 120);
  }
  return innerText(element).slice(0, 120);
}

export function describeElement(element: Element): string {
  const role = elementRole(element); const name = elementAccessibleName(element);
  return name ? `${role}: ${name}` : `${role} (no label)`;
}

export type OutlineEntry = { depth: number; indices: number[]; element: Element; role: string; name: string; hasAltText: boolean };

/** Flat, reading-order list of the page's objects. `indices` is the path from the page list into nested groups. */
export function buildDocumentOutline(elements: Element[], maxEntries = 500): OutlineEntry[] {
  const entries: OutlineEntry[] = [];
  const center = (element: Element) => { const box = boundsOf(element); return { x: box.x + box.w / 2, y: box.y + box.h / 2 }; };
  const visit = (items: Element[], depth: number, parent: number[]) => {
    const order = items.map((element, index) => ({ element, index })).filter(({ element }) => !element.hidden)
      .sort((a, b) => { const ca = center(a.element); const cb = center(b.element); return Math.abs(ca.y - cb.y) > 24 ? ca.y - cb.y : ca.x - cb.x; });
    for (const { element, index } of order) {
      if (entries.length >= maxEntries) return;
      const indices = [...parent, index];
      const structural = element.type === "group" && !element.note && !element.libraryComponent && !element.container;
      entries.push({ depth, indices, element, role: elementRole(element), name: elementAccessibleName(element), hasAltText: !!clean(element.altText) });
      if (element.type === "group" && (structural || element.container)) visit(element.elements, depth + 1, indices);
    }
  };
  visit(elements, 0, []);
  return entries;
}

function boundsOf(element: Element): { x: number; y: number; w: number; h: number } {
  if (element.type === "freehand") {
    if (!element.points.length) return { x: 0, y: 0, w: 0, h: 0 };
    let left = Infinity; let top = Infinity; let right = -Infinity; let bottom = -Infinity;
    for (const point of element.points) { left = Math.min(left, point.x); top = Math.min(top, point.y); right = Math.max(right, point.x); bottom = Math.max(bottom, point.y); }
    return { x: left, y: top, w: right - left, h: bottom - top };
  }
  if (element.type === "group") {
    if (element.componentBounds) return element.componentBounds;
    const boxes = element.elements.map(boundsOf);
    if (!boxes.length) return { x: 0, y: 0, w: 0, h: 0 };
    const left = Math.min(...boxes.map(box => box.x)); const top = Math.min(...boxes.map(box => box.y));
    return { x: left, y: top, w: Math.max(...boxes.map(box => box.x + box.w)) - left, h: Math.max(...boxes.map(box => box.y + box.h)) - top };
  }
  if (element.type === "text") return { x: element.x, y: element.y, w: 0, h: 0 };
  const w = "w" in element ? element.w : 0; const h = "h" in element ? element.h : 0;
  return { x: Math.min(element.x, element.x + w), y: Math.min(element.y, element.y + h), w: Math.abs(w), h: Math.abs(h) };
}

export type AccessibilityIssue = { code: "low-contrast" | "missing-alt-text"; message: string; elementId?: string };

const FILLED_SHAPES = new Set<Element["type"]>(["rectangle", "circle", "diamond", "triangle", "flowchart", "svgPath"]);

/**
 * Finds labels that are hard to read against their fill (or the board) and
 * images that have no alternative text. Large or bold text needs 3:1, other
 * text 4.5:1, matching WCAG AA. `ink` maps stored text colors to the colors
 * actually drawn, such as the dark-theme neutral inversion.
 */
export function accessibilityIssues(elements: Element[], boardColor: string, ink: (color: string) => string = color => color): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  const fills: { box: ReturnType<typeof boundsOf>; color: string }[] = [];
  const shapeFill = (shape: ShapeElement, base: string) => shape.fillColor ? blendColors(shape.fillColor, base, shape.fillOpacity ?? 1) : undefined;
  const check = (id: string | undefined, name: string, foreground: string, background: string, size: number, bold: boolean) => {
    const ratio = contrastRatio(ink(foreground), background);
    if (ratio === undefined) return;
    const large = size >= 24 || bold && size >= 18.66;
    const required = large ? 3 : 4.5;
    if (ratio < required) issues.push({ code: "low-contrast", message: `${name} has a contrast ratio of ${ratio.toFixed(1)}:1 (needs ${required}:1) against its background.`, elementId: id });
  };
  const walk = (items: Element[], base: string) => {
    for (const item of items) {
      if (item.hidden) continue;
      if (item.type === "group") { walk(item.elements, item.container?.background ?? base); continue; }
      if (item.type === "image" && !clean(item.altText)) issues.push({ code: "missing-alt-text", message: "This image has no alt text.", elementId: item.id });
      if (FILLED_SHAPES.has(item.type)) {
        const shape = item as ShapeElement; const fill = shapeFill(shape, base);
        if (fill) fills.push({ box: boundsOf(item), color: fill });
        if (shape.label?.text.trim()) check(item.id, `The label "${clean(shape.label.text).slice(0, 40)}"`, shape.label.color, fill ?? base, shape.label.fontSize, !!shape.label.bold);
      } else if (item.type === "text" && item.text.trim()) {
        const at = { x: item.x + 1, y: item.y + item.fontSize / 2 };
        const behind = [...fills].reverse().find(fill => at.x >= fill.box.x && at.x <= fill.box.x + fill.box.w && at.y >= fill.box.y && at.y <= fill.box.y + fill.box.h);
        check(item.id, `The text "${clean(item.text).slice(0, 40)}"`, item.color, behind?.color ?? base, item.fontSize, !!item.bold);
      } else if ((item.type === "line" || item.type === "arrow") && item.label?.text.trim()) check(item.id, `The label "${clean(item.label.text).slice(0, 40)}"`, item.label.color, base, item.label.fontSize, !!item.label.bold);
    }
  };
  walk(elements, boardColor);
  return issues;
}
