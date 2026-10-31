import type { ColorToken, Element, StyleMode, FontFamily, ShapeElement, StrokeStyle, StrokeStyleToken, StyleBindings, StyleLibrary, StyleSlot, TextElement, TextStyleToken } from "../../model";

export const MAX_COLOR_TOKENS = 64;
export const MAX_TEXT_STYLES = 32;
export const MAX_STROKE_STYLES = 32;
export const MAX_STYLE_MODES = 8;
export const STYLE_SLOTS: readonly StyleSlot[] = ["stroke", "fill", "text", "textStyle", "strokeStyle"];
export const STYLE_SLOT_LABELS: Record<StyleSlot, string> = { stroke: "Stroke color", fill: "Fill color", text: "Text color", textStyle: "Text style", strokeStyle: "Stroke style" };

const FONT_FAMILIES: readonly FontFamily[] = ["sans", "hand", "serif", "mono", "rounded", "display"];
const STROKE_STYLES: readonly StrokeStyle[] = ["solid", "dashed", "dotted", "double"];
const TEXT_ALIGNMENTS = ["left", "center", "right", "justify"] as const;

type SlotValues = Record<string, unknown>;

export const emptyStyleLibrary = (): StyleLibrary => ({ colors: [], textStyles: [], strokeStyles: [] });
export const isStyleLibraryEmpty = (library: StyleLibrary) => !library.colors.length && !library.textStyles.length && !library.strokeStyles.length;

const isHexColor = (value: unknown): value is string => typeof value === "string" && /^#[\da-f]{6}$/i.test(value);
const isTokenId = (value: unknown): value is string => typeof value === "string" && /^[\w.-]{1,100}$/.test(value);
const tokenName = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value.trim().slice(0, 60) : fallback;

/** Validates a stored library at an import boundary. Invalid tokens are dropped; the rest are kept. */
export function normalizeStyleLibrary(value: unknown): StyleLibrary | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const seen = new Set<string>();
  const unique = (id: string) => { if (seen.has(id)) return false; seen.add(id); return true; };
  const list = (key: string, limit: number) => Array.isArray(raw[key]) ? (raw[key] as unknown[]).slice(0, limit) : [];
  const modes = list("modes", MAX_STYLE_MODES).flatMap((item): StyleMode[] => {
    const mode = item as Record<string, unknown> | null;
    return mode && isTokenId(mode.id) && unique(`mode:${mode.id}`) ? [{ id: mode.id, name: tokenName(mode.name, "Mode") }] : [];
  });
  const colors = list("colors", MAX_COLOR_TOKENS).flatMap((item): ColorToken[] => {
    const token = item as Record<string, unknown> | null;
    if (!token || !isTokenId(token.id) || !isHexColor(token.value) || !unique(token.id)) return [];
    const modeValues = token.modeValues && typeof token.modeValues === "object" && !Array.isArray(token.modeValues)
      ? Object.fromEntries(Object.entries(token.modeValues as Record<string, unknown>).filter(([key, value]) => modes.some(mode => mode.id === key) && isHexColor(value)).map(([key, value]) => [key, (value as string).toLowerCase()])) : {};
    return [{ id: token.id, name: tokenName(token.name, "Color"), value: token.value.toLowerCase(), ...(Object.keys(modeValues).length ? { modeValues } : {}), ...(isTokenId(token.aliasOf) && token.aliasOf !== token.id ? { aliasOf: token.aliasOf } : {}) }];
  });
  const textStyles = list("textStyles", MAX_TEXT_STYLES).flatMap((item): TextStyleToken[] => {
    const token = item as Record<string, unknown> | null;
    if (!token || !isTokenId(token.id) || typeof token.fontSize !== "number" || !Number.isFinite(token.fontSize) || token.fontSize < 8 || token.fontSize > 160 || !FONT_FAMILIES.includes(token.fontFamily as FontFamily) || !unique(token.id)) return [];
    return [{
      id: token.id, name: tokenName(token.name, "Text style"), fontSize: Math.round(token.fontSize), fontFamily: token.fontFamily as FontFamily,
      ...(token.bold === true ? { bold: true } : {}), ...(token.italic === true ? { italic: true } : {}), ...(token.underline === true ? { underline: true } : {}),
      ...(TEXT_ALIGNMENTS.includes(token.textAlign as typeof TEXT_ALIGNMENTS[number]) ? { textAlign: token.textAlign as TextStyleToken["textAlign"] } : {}),
    }];
  });
  const strokeStyles = list("strokeStyles", MAX_STROKE_STYLES).flatMap((item): StrokeStyleToken[] => {
    const token = item as Record<string, unknown> | null;
    return token && isTokenId(token.id) && typeof token.thickness === "number" && Number.isFinite(token.thickness) && token.thickness >= 1 && token.thickness <= 64 && STROKE_STYLES.includes(token.lineStyle as StrokeStyle) && unique(token.id)
      ? [{ id: token.id, name: tokenName(token.name, "Stroke style"), thickness: Math.round(token.thickness), lineStyle: token.lineStyle as StrokeStyle }] : [];
  });
  const activeModeId = typeof raw.activeModeId === "string" && modes.some(mode => mode.id === raw.activeModeId) ? raw.activeModeId : undefined;
  const library: StyleLibrary = { colors, textStyles, strokeStyles, ...(modes.length ? { modes } : {}), ...(activeModeId ? { activeModeId } : {}), ...(raw.followTheme === true && modes.length ? { followTheme: true } : {}) };
  return isStyleLibraryEmpty(library) ? undefined : library;
}

/** Validates stored bindings. Unknown slots and malformed entries are dropped. */
export function normalizeStyleBindings(value: unknown): StyleBindings | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const bindings: StyleBindings = {};
  for (const slot of STYLE_SLOTS) {
    const entry = raw[slot] as Record<string, unknown> | null | undefined;
    if (entry && typeof entry === "object" && isTokenId(entry.id) && typeof entry.applied === "string" && entry.applied.length <= 500) bindings[slot] = { id: entry.id, applied: entry.applied };
  }
  return Object.keys(bindings).length ? bindings : undefined;
}

/** Combines libraries held by different pages. The first token with a given id wins. */
export function mergeStyleLibraries(libraries: (StyleLibrary | undefined)[]): StyleLibrary {
  const merged = emptyStyleLibrary();
  const take = <T extends { id: string }>(target: T[], source: T[] | undefined, limit: number) => { for (const token of source ?? []) if (target.length < limit && !target.some(item => item.id === token.id)) target.push(token); };
  for (const library of libraries) {
    if (!library) continue;
    if (library.modes?.length && !merged.modes) { merged.modes = library.modes; if (library.activeModeId) merged.activeModeId = library.activeModeId; if (library.followTheme) merged.followTheme = true; }
    take(merged.colors, library.colors, MAX_COLOR_TOKENS); take(merged.textStyles, library.textStyles, MAX_TEXT_STYLES); take(merged.strokeStyles, library.strokeStyles, MAX_STROKE_STYLES);
  }
  return merged;
}

const textFields = (source: Pick<TextElement, "fontSize" | "fontFamily" | "bold" | "italic" | "underline" | "textAlign">): SlotValues => ({
  fontSize: source.fontSize, fontFamily: source.fontFamily ?? "sans", bold: !!source.bold, italic: !!source.italic, underline: !!source.underline, textAlign: source.textAlign ?? "left",
});
const textFieldPatch = (values: SlotValues) => ({
  ...(typeof values.fontSize === "number" ? { fontSize: values.fontSize } : {}), ...(values.fontFamily ? { fontFamily: values.fontFamily as FontFamily } : {}),
  bold: !!values.bold, italic: !!values.italic, underline: !!values.underline, ...(values.textAlign ? { textAlign: values.textAlign as NonNullable<TextElement["textAlign"]> } : {}),
});

const isConnectorType = (element: Element) => element.type === "line" || element.type === "arrow";
const isShapeType = (element: Element): element is ShapeElement => element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "triangle" || element.type === "flowchart" || element.type === "svgPath" || isConnectorType(element);

/** Groups whose children are styled individually when a token is applied to a selection. */
export const isStructuralGroup = (element: Element): boolean => element.type === "group" && !element.note && !element.libraryComponent && !element.container && !element.masterId;

function readSlot(element: Element, slot: StyleSlot): SlotValues | undefined {
  if (element.type === "freehand") return slot === "stroke" ? { color: element.color } : slot === "strokeStyle" ? { thickness: element.thickness } : undefined;
  if (element.type === "text") return slot === "text" ? { color: element.color } : slot === "textStyle" ? textFields(element) : undefined;
  if (isShapeType(element)) {
    if (slot === "stroke") return { color: element.color };
    if (slot === "fill") return isConnectorType(element) ? undefined : { color: element.fillColor ?? null };
    if (slot === "strokeStyle") return { thickness: element.thickness, lineStyle: element.lineStyle ?? "solid" };
    if (slot === "text") return element.label ? { color: element.label.color } : undefined;
    return element.label ? textFields(element.label) : undefined;
  }
  if (element.type !== "group" || element.note || isStructuralGroup(element)) return undefined;
  if (element.container) {
    if (slot === "stroke") return { color: element.container.borderColor ?? null };
    if (slot === "fill") return { color: element.container.background ?? null };
    if (slot === "strokeStyle") return { thickness: element.container.borderThickness ?? null, lineStyle: element.container.borderStyle ?? "solid" };
    return undefined;
  }
  const component = element.libraryComponent;
  if (!component) return undefined;
  if (slot === "stroke") return { color: component.styleOverrides?.color ?? null };
  if (slot === "fill") return { color: component.styleOverrides?.fillColor ?? null };
  if (slot === "strokeStyle") return { lineStyle: component.styleOverrides?.lineStyle ?? "solid" };
  if (slot === "text") return { color: component.textStyle?.color ?? null };
  return { fontSize: component.textStyle?.fontSize ?? null, fontFamily: component.textStyle?.fontFamily ?? "sans", bold: !!component.textStyle?.bold, italic: !!component.textStyle?.italic, underline: !!component.textStyle?.underline, textAlign: component.textStyle?.textAlign ?? "left" };
}

function writeSlot(element: Element, slot: StyleSlot, values: SlotValues): Element {
  const color = typeof values.color === "string" ? values.color : undefined;
  const thickness = typeof values.thickness === "number" ? Math.max(1, Math.round(values.thickness)) : undefined;
  const lineStyle = STROKE_STYLES.includes(values.lineStyle as StrokeStyle) ? values.lineStyle as StrokeStyle : undefined;
  if (element.type === "freehand") return slot === "stroke" && color ? { ...element, color } : slot === "strokeStyle" && thickness ? { ...element, thickness } : element;
  if (element.type === "text") return slot === "text" && color ? { ...element, color } : slot === "textStyle" ? { ...element, ...textFieldPatch(values) } : element;
  if (isShapeType(element)) {
    if (slot === "stroke") return color ? { ...element, color } : element;
    if (slot === "fill") return color && !isConnectorType(element) ? { ...element, fillColor: color, fillOpacity: element.fillOpacity ?? 1 } : element;
    if (slot === "strokeStyle") return { ...element, ...(thickness ? { thickness } : {}), ...(lineStyle ? { lineStyle } : {}) };
    if (!element.label) return element;
    return slot === "text" ? color ? { ...element, label: { ...element.label, color } } : element : { ...element, label: { ...element.label, ...textFieldPatch(values) } };
  }
  if (element.type !== "group" || element.note || isStructuralGroup(element)) return element;
  if (element.container) {
    if (slot === "stroke" && color) return { ...element, container: { ...element.container, borderColor: color } };
    if (slot === "fill" && color) return { ...element, container: { ...element.container, background: color } };
    if (slot === "strokeStyle") return { ...element, container: { ...element.container, ...(thickness ? { borderThickness: Math.min(24, thickness) } : {}), ...(lineStyle ? { borderStyle: lineStyle } : {}) } };
    return element;
  }
  const component = element.libraryComponent;
  if (!component) return element;
  const overrides = component.styleOverrides ?? {};
  if (slot === "stroke" && color) return { ...element, libraryComponent: { ...component, styleOverrides: { ...overrides, color } } };
  if (slot === "fill" && color) return { ...element, libraryComponent: { ...component, styleOverrides: { ...overrides, fillColor: color, fillOpacity: overrides.fillOpacity ?? 1 } } };
  if (slot === "strokeStyle" && lineStyle) return { ...element, libraryComponent: { ...component, styleOverrides: { ...overrides, lineStyle } } };
  if (slot === "text" && color) return { ...element, libraryComponent: { ...component, textStyle: { ...component.textStyle, color } } };
  if (slot === "textStyle") return { ...element, libraryComponent: { ...component, textStyle: { ...component.textStyle, ...textFieldPatch(values) } } };
  return element;
}

const fingerprint = (element: Element, slot: StyleSlot): string | undefined => { const values = readSlot(element, slot); return values ? JSON.stringify(values) : undefined; };

/** Slots whose properties exist on this element, so the UI offers only meaningful tokens. */
export function supportedSlots(element: Element): StyleSlot[] {
  return STYLE_SLOTS.filter(slot => readSlot(element, slot) !== undefined);
}

/** The color a token shows in the active mode, following aliases (a cycle falls back to the token's own value). */
export function resolveColorToken(library: StyleLibrary, token: ColorToken, depth = 0): string {
  if (token.aliasOf && depth < 8) {
    const target = library.colors.find(item => item.id === token.aliasOf);
    if (target && target.id !== token.id) return resolveColorToken(library, target, depth + 1);
  }
  const mode = library.activeModeId;
  const first = library.modes?.[0]?.id;
  return mode && mode !== first ? token.modeValues?.[mode] ?? token.value : token.value;
}

/** True when pointing `id` at `target` would make aliases loop back to `id`. */
export function wouldCreateAliasCycle(library: StyleLibrary, id: string, target: string): boolean {
  let current: string | undefined = target;
  for (let depth = 0; current && depth <= MAX_COLOR_TOKENS; depth++) {
    if (current === id) return true;
    current = library.colors.find(token => token.id === current)?.aliasOf;
  }
  return false;
}

function tokenValues(library: StyleLibrary, slot: StyleSlot, id: string): SlotValues | undefined {
  if (slot === "textStyle") {
    const token = library.textStyles.find(item => item.id === id);
    return token ? { fontSize: token.fontSize, fontFamily: token.fontFamily, bold: !!token.bold, italic: !!token.italic, underline: !!token.underline, ...(token.textAlign ? { textAlign: token.textAlign } : {}) } : undefined;
  }
  if (slot === "strokeStyle") { const token = library.strokeStyles.find(item => item.id === id); return token ? { thickness: token.thickness, lineStyle: token.lineStyle } : undefined; }
  const token = library.colors.find(item => item.id === id);
  return token ? { color: resolveColorToken(library, token) } : undefined;
}

export type BindingState = "unbound" | "bound" | "detached" | "unavailable";

/** `detached` means the element carried a binding but its value was edited afterwards. */
export function bindingState(element: Element, slot: StyleSlot, library: StyleLibrary): { state: BindingState; tokenId?: string } {
  if (readSlot(element, slot) === undefined) return { state: "unavailable" };
  const binding = element.styleBindings?.[slot];
  if (!binding || !tokenValues(library, slot, binding.id)) return { state: "unbound" };
  return { state: fingerprint(element, slot) === binding.applied ? "bound" : "detached", tokenId: binding.id };
}

const withBindings = (element: Element, bindings: StyleBindings): Element => {
  const { styleBindings: _discard, ...rest } = element as Element & { styleBindings?: StyleBindings };
  return (Object.keys(bindings).length ? { ...rest, styleBindings: bindings } : rest) as Element;
};

/** Applies a token to one element (not its children) and records the binding. */
export function applyToken(element: Element, slot: StyleSlot, tokenId: string, library: StyleLibrary): Element {
  const values = tokenValues(library, slot, tokenId);
  if (!values || readSlot(element, slot) === undefined) return element;
  const written = writeSlot(element, slot, values);
  const applied = fingerprint(written, slot);
  return applied === undefined ? element : withBindings(written, { ...element.styleBindings, [slot]: { id: tokenId, applied } });
}

/** Applies a token to an element, or to every styled descendant of a plain group. Notes are left alone. */
export function applyTokenDeep(element: Element, slot: StyleSlot, tokenId: string, library: StyleLibrary): Element {
  if (element.type === "group" && isStructuralGroup(element)) return { ...element, elements: element.elements.map(child => applyTokenDeep(child, slot, tokenId, library)) };
  return applyToken(element, slot, tokenId, library);
}

/** Detaches an element from a token and keeps its current look. */
export function removeBinding(element: Element, slot: StyleSlot): Element {
  if (element.type === "group" && isStructuralGroup(element)) return { ...element, elements: element.elements.map(child => removeBinding(child, slot)) };
  if (!element.styleBindings?.[slot]) return element;
  const { [slot]: _removed, ...rest } = element.styleBindings;
  return withBindings(element, rest);
}

/**
 * Re-applies token values to every bound element. A binding whose element was
 * edited by hand since the last apply is dropped instead of overwritten, and
 * a binding to a deleted token is dropped while keeping the literal look.
 */
export function refreshStyleBindings(element: Element, library: StyleLibrary): Element {
  let next = element;
  if (element.type === "group") {
    const children = element.elements.map(child => refreshStyleBindings(child, library));
    if (children.some((child, index) => child !== element.elements[index])) next = { ...element, elements: children };
  }
  const bindings = next.styleBindings;
  if (!bindings) return next;
  const kept: StyleBindings = {};
  let changed = false;
  for (const slot of STYLE_SLOTS) {
    const binding = bindings[slot];
    if (!binding) continue;
    const values = tokenValues(library, slot, binding.id);
    const current = fingerprint(next, slot);
    if (!values) { changed = true; continue; }
    if (current === undefined) { kept[slot] = binding; continue; }
    if (current !== binding.applied) { changed = true; continue; }
    const written = writeSlot(next, slot, values);
    const applied = fingerprint(written, slot) ?? binding.applied;
    // Keep the existing object when the token already matches, so unchanged elements stay referentially equal.
    if (applied !== current) next = written;
    kept[slot] = applied === binding.applied ? binding : { id: binding.id, applied };
    if (kept[slot] !== binding) changed = true;
  }
  return changed || Object.keys(kept).length !== Object.keys(bindings).length ? withBindings(next, kept) : next;
}

export function refreshElementList(elements: Element[], library: StyleLibrary): Element[] {
  let changed = false;
  const next = elements.map(element => { const refreshed = refreshStyleBindings(element, library); if (refreshed !== element) changed = true; return refreshed; });
  return changed ? next : elements;
}

/** How many elements are currently bound to a token. Detached elements are not counted. */
export function countTokenUsage(elements: Element[], slot: StyleSlot, tokenId: string): number {
  let count = 0;
  const visit = (items: Element[]) => { for (const item of items) { if (item.styleBindings?.[slot]?.id === tokenId && fingerprint(item, slot) === item.styleBindings[slot]!.applied) count++; if (item.type === "group") visit(item.elements); } };
  visit(elements);
  return count;
}

/** Captures an element's current look as a token value, for "Create from selection". */
export function captureToken(element: Element, slot: StyleSlot): SlotValues | undefined {
  const target = isStructuralGroup(element) ? undefined : element;
  const values = target ? readSlot(target, slot) : undefined;
  if (!values) return undefined;
  if ((slot === "stroke" || slot === "fill" || slot === "text") && !isHexColor(values.color)) return undefined;
  if (slot === "textStyle" && typeof values.fontSize !== "number") return undefined;
  if (slot === "strokeStyle" && typeof values.thickness !== "number") return undefined;
  return values;
}

export function newColorToken(id: string, name: string, value: string): ColorToken { return { id, name: tokenName(name, "Color"), value: value.toLowerCase() }; }
export function newTextStyleToken(id: string, name: string, values: SlotValues): TextStyleToken {
  return { id, name: tokenName(name, "Text style"), fontSize: Math.max(8, Math.min(160, Math.round(Number(values.fontSize) || 16))), fontFamily: FONT_FAMILIES.includes(values.fontFamily as FontFamily) ? values.fontFamily as FontFamily : "sans",
    ...(values.bold ? { bold: true } : {}), ...(values.italic ? { italic: true } : {}), ...(values.underline ? { underline: true } : {}), ...(TEXT_ALIGNMENTS.includes(values.textAlign as typeof TEXT_ALIGNMENTS[number]) ? { textAlign: values.textAlign as TextStyleToken["textAlign"] } : {}) };
}
export function newStrokeStyleToken(id: string, name: string, values: SlotValues): StrokeStyleToken {
  return { id, name: tokenName(name, "Stroke style"), thickness: Math.max(1, Math.min(64, Math.round(Number(values.thickness) || 2))), lineStyle: STROKE_STYLES.includes(values.lineStyle as StrokeStyle) ? values.lineStyle as StrokeStyle : "solid" };
}
