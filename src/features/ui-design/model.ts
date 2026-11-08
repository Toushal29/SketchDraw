import { hierarchyIsValid, isHierarchyContainer } from "./hierarchy";

/** Independent, deliberately clean .sdui schema. */
export const UI_DESIGN_FORMAT = "SketchDrawUIDesign" as const;
export const UI_DESIGN_VERSION = 1 as const;
export const UI_DESIGN_MAX_BYTES = 20 * 1024 * 1024;
export const UI_DESIGN_MAX_PAGES = 100;
export const UI_DESIGN_MAX_ELEMENTS = 10_000;

export type UIFramePresetId = "custom" | "mobile-iphone" | "mobile-android" | "tablet" | "laptop" | "desktop" | "desktop-wide";
export type UIFramePreset = { id: UIFramePresetId; label: string; width: number; height: number; category: "mobile" | "tablet" | "desktop" | "custom" };
export const UI_FRAME_PRESETS: UIFramePreset[] = [
  { id: "mobile-iphone", label: "iPhone · 390 × 844", width: 390, height: 844, category: "mobile" },
  { id: "mobile-android", label: "Android · 360 × 800", width: 360, height: 800, category: "mobile" },
  { id: "tablet", label: "Tablet · 834 × 1194", width: 834, height: 1194, category: "tablet" },
  { id: "laptop", label: "Laptop · 1366 × 768", width: 1366, height: 768, category: "desktop" },
  { id: "desktop", label: "Desktop · 1440 × 900", width: 1440, height: 900, category: "desktop" },
  { id: "desktop-wide", label: "Wide desktop · 1920 × 1080", width: 1920, height: 1080, category: "desktop" },
  { id: "custom", label: "Custom dimensions", width: 800, height: 600, category: "custom" },
];

export type UIElementKind = "group" | "frame" | "text" | "rectangle" | "ellipse" | "line" | "path" | "button" | "input" | "checkbox" | "image" | "componentInstance";
export type UIPathPoint = { x: number; y: number; inX?: number; inY?: number; outX?: number; outY?: number; type?: "corner" | "smooth" };
export type UIGridKind = "square" | "columns" | "rows" | "modular" | "baseline";
export type UIInteraction = {
  id: string; name: string; trigger: "click" | "hover" | "press";
  action: "navigate" | "back" | "open-overlay" | "close-overlay";
  targetPageId?: string; targetNodeId?: string; transition: "instant" | "dissolve" | "slide-left" | "slide-right";
};
export type UIPrototypeFlow = { id: string; name: string; startPageId: string; startNodeId?: string };
export type UIColorMode = { id: string; name: string };
export type UIColorToken = { id: string; name: string; value: string; modeValues?: Record<string, string>; aliasOf?: string };
export type UITypographyToken = { id: string; name: string; fontFamily: "system" | "sans" | "serif" | "mono"; fontSize: number; fontWeight: number; lineHeight: number; letterSpacing: number };
export type UIValueToken = { id: string; name: string; value: number; unit: "px" | "rem" };
export type UIComponentVariant = { id: string; name: string; properties: Record<string, string | number | boolean> };
export type UIComponentDefinition = { id: string; name: string; root: UIElement; children: UIElement[]; variants: UIComponentVariant[] };
export type UIGrid = { visible: boolean; snap: boolean; kind: UIGridKind; size: number; columns: number; rows: number; gutter: number; margin: number; baseline: number; color: string; opacity: number };
export type UIAutoLayout = {
  enabled: boolean; direction: "horizontal" | "vertical" | "grid"; gap: number; paddingTop: number; paddingRight: number; paddingBottom: number; paddingLeft: number;
  alignment: "start" | "center" | "end" | "stretch"; justification: "start" | "center" | "end" | "space-between";
  wrap: boolean; columns: number; widthMode: "fixed" | "hug" | "fill"; heightMode: "fixed" | "hug" | "fill"; clip: boolean;
};
export type UIConstraints = { horizontal: "left" | "right" | "left-right" | "center" | "scale"; vertical: "top" | "bottom" | "top-bottom" | "center" | "scale"; minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number };

export type UIElement = {
  id: string; name: string; kind: UIElementKind; parentId: string; order: number;
  x: number; y: number; width: number; height: number; rotation: number;
  hidden: boolean; locked: boolean; text: string; imageData: string;
  fillTokenId: string; typographyTokenId: string; componentId: string; componentVariantId: string; overrides: Record<string, string | number | boolean>;
  pathPoints: UIPathPoint[]; fill: string; stroke: string; strokeWidth: number; strokeStyle: "solid" | "dashed" | "dotted";
  radius: number; opacity: number; shadow: "none" | "soft" | "strong"; fontFamily: "system" | "sans" | "serif" | "mono";
  fontSize: number; fontWeight: number; lineHeight: number; letterSpacing: number; textAlign: "left" | "center" | "right";
  clipContent: boolean; frameType: "screen" | "container"; framePreset: UIFramePresetId; constraints: UIConstraints;
  widthSizing: "fixed" | "hug" | "fill"; heightSizing: "fixed" | "hug" | "fill";
  autoLayout: UIAutoLayout; mask: boolean; imageFit: "cover" | "contain" | "fill"; imageCrop: { x: number; y: number; width: number; height: number };
  interactions: UIInteraction[];
};
export type UIPage = { id: string; name: string; background: string; elements: UIElement[]; grid: UIGrid; prototypeFlows: UIPrototypeFlow[]; activePrototypeFlowId: string };
export type UIDesignDocument = {
  format: typeof UI_DESIGN_FORMAT; version: typeof UI_DESIGN_VERSION; id: string; name: string; activePageId: string; pages: UIPage[];
  colorTokens: UIColorToken[]; typographyTokens: UITypographyToken[]; spacingTokens: UIValueToken[]; radiusTokens: UIValueToken[];
  effectTokens: Array<{ id: string; name: string; value: string }>; colorModes: UIColorMode[]; activeColorModeId: string;
  components: UIComponentDefinition[]; assetLibraries: Array<{ id: string; name: string; enabled: boolean; assetIds: string[] }>;
};

let idCounter = 0;
export function createUIDesignId(prefix = "ui"): string {
  try { return `${prefix}-${crypto.randomUUID()}`; }
  catch { return `${prefix}-${Date.now().toString(36)}-${(++idCounter).toString(36)}`; }
}
const defaultGrid = (): UIGrid => ({ visible: true, snap: true, kind: "square", size: 8, columns: 12, rows: 8, gutter: 16, margin: 24, baseline: 8, color: "#4774d9", opacity: 0.16 });
const defaultAutoLayout = (): UIAutoLayout => ({ enabled: false, direction: "vertical", gap: 8, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, alignment: "start", justification: "start", wrap: false, columns: 2, widthMode: "fixed", heightMode: "fixed", clip: false });
const defaultConstraints = (): UIConstraints => ({ horizontal: "left", vertical: "top" });

export function createUIElement(kind: UIElementKind, order: number, point: { x: number; y: number }, parentId: string, size?: { width: number; height: number }): UIElement {
  const id = createUIDesignId(kind);
  const dimensions = size ?? (kind === "frame" ? { width: 390, height: 844 } : kind === "button" ? { width: 132, height: 44 } : kind === "input" ? { width: 240, height: 44 } : kind === "checkbox" ? { width: 140, height: 28 } : kind === "text" ? { width: 180, height: 32 } : kind === "line" ? { width: 120, height: 2 } : { width: 120, height: 80 });
  const preset = kind === "frame" ? UI_FRAME_PRESETS.find(item => item.id === "mobile-iphone")! : UI_FRAME_PRESETS[0];
  return {
    id, name: kind === "frame" ? "Frame" : kind === "group" ? "Group" : `${kind[0].toUpperCase()}${kind.slice(1)}`, kind, parentId, order,
    x: Math.round(point.x), y: Math.round(point.y), width: dimensions.width, height: dimensions.height, rotation: 0,
    hidden: false, locked: false, text: kind === "button" ? "Button" : kind === "input" ? "Placeholder" : kind === "checkbox" ? "Checkbox" : kind === "text" ? "Text" : "", imageData: "",
    fillTokenId: "", typographyTokenId: "", componentId: "", componentVariantId: "", overrides: {}, pathPoints: [],
    fill: kind === "text" || kind === "line" || kind === "path" || kind === "group" ? "#26354d" : kind === "button" ? "#365fe5" : kind === "frame" ? "#ffffff" : "#e4ebf8",
    stroke: kind === "text" || kind === "line" || kind === "path" || kind === "group" ? "none" : "#b9c7dc", strokeWidth: 1, strokeStyle: "solid", radius: kind === "button" ? 8 : kind === "input" ? 6 : kind === "frame" ? 0 : 4,
    opacity: 1, shadow: "none", fontFamily: "system", fontSize: 16, fontWeight: kind === "button" ? 600 : 400, lineHeight: 1.4, letterSpacing: 0, textAlign: "left",
    clipContent: kind === "frame", frameType: "container", framePreset: preset.id, constraints: defaultConstraints(), widthSizing: "fixed", heightSizing: "fixed", autoLayout: defaultAutoLayout(), mask: false,
    imageFit: "cover", imageCrop: { x: 0, y: 0, width: 1, height: 1 }, interactions: [],
  };
}
export function createUIFrame(order: number, point: { x: number; y: number }, parentId: string, presetId: UIFramePresetId = "mobile-iphone"): UIElement {
  const preset = UI_FRAME_PRESETS.find(item => item.id === presetId) ?? UI_FRAME_PRESETS[0];
  const frame = createUIElement("frame", order, point, parentId, preset);
  frame.frameType = presetId === "custom" ? "container" : "screen";
  frame.framePreset = preset.id;
  frame.name = preset.id === "custom" ? "Frame" : preset.label.split(" · ")[0];
  return frame;
}
export function createUIDesignDocument(name = "Untitled UI design"): UIDesignDocument {
  const pageId = createUIDesignId("page");
  const flowId = createUIDesignId("flow");
  return {
    format: UI_DESIGN_FORMAT, version: UI_DESIGN_VERSION, id: createUIDesignId("design"), name, activePageId: pageId,
    pages: [{ id: pageId, name: "Page 1", background: "#edf1f7", elements: [], grid: defaultGrid(), prototypeFlows: [{ id: flowId, name: "Flow 1", startPageId: pageId }], activePrototypeFlowId: flowId }],
    colorTokens: [
      { id: "color-primary", name: "Primary", value: "#365fe5" }, { id: "color-text", name: "Text", value: "#26354d" },
      { id: "color-surface", name: "Surface", value: "#ffffff" }, { id: "color-muted", name: "Muted", value: "#e4ebf8" },
    ],
    typographyTokens: [{ id: "type-body", name: "Body", fontFamily: "system", fontSize: 16, fontWeight: 400, lineHeight: 1.4, letterSpacing: 0 }],
    spacingTokens: [{ id: "space-1", name: "Space 1", value: 4, unit: "px" }, { id: "space-2", name: "Space 2", value: 8, unit: "px" }, { id: "space-3", name: "Space 3", value: 16, unit: "px" }],
    radiusTokens: [{ id: "radius-1", name: "Small", value: 4, unit: "px" }, { id: "radius-2", name: "Medium", value: 8, unit: "px" }],
    effectTokens: [{ id: "effect-soft", name: "Soft shadow", value: "0 4px 14px #1f29331c" }],
    colorModes: [{ id: "mode-light", name: "Light" }, { id: "mode-dark", name: "Dark" }], activeColorModeId: "mode-light", components: [],
    assetLibraries: [{ id: "library-core", name: "SketchDraw basics", enabled: true, assetIds: [] }],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function number(value: unknown, fallback: number, min: number, max: number) { return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback; }
function string(value: unknown, fallback = "", max = 4000) { return typeof value === "string" ? value.slice(0, max) : fallback; }
function bool(value: unknown, fallback = false) { return typeof value === "boolean" ? value : fallback; }
function color(value: unknown, fallback: string, allowNone = false) {
  if (typeof value !== "string") return fallback;
  return /^#[\da-f]{3,8}$/i.test(value) || (allowNone && value === "none") ? value : fallback;
}
const validKinds = new Set<UIElementKind>(["group", "frame", "text", "rectangle", "ellipse", "line", "path", "button", "input", "checkbox", "image", "componentInstance"]);
function cleanElement(value: unknown, pageId: string, index: number): UIElement | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || !validKinds.has(value.kind as UIElementKind)) return undefined;
  const base = createUIElement(value.kind as UIElementKind, index, { x: 0, y: 0 }, pageId);
  const source = value as Record<string, any>;
  const clean: UIElement = { ...base,
    id: string(source.id, base.id, 120), name: string(source.name, base.name, 120), parentId: string(source.parentId, pageId, 120), order: number(source.order, index, 0, 1e7),
    x: number(source.x, 0, -1e7, 1e7), y: number(source.y, 0, -1e7, 1e7), width: number(source.width, base.width, 1, 1e6), height: number(source.height, base.height, 1, 1e6), rotation: number(source.rotation, 0, -36000, 36000),
    hidden: bool(source.hidden), locked: bool(source.locked), text: string(source.text, "", 10000), imageData: string(source.imageData, "", 8_000_000),
    fillTokenId: string(source.fillTokenId), typographyTokenId: string(source.typographyTokenId), componentId: string(source.componentId), componentVariantId: string(source.componentVariantId), overrides: isRecord(source.overrides) ? source.overrides as UIElement["overrides"] : {},
    fill: color(source.fill, base.fill), stroke: color(source.stroke, base.stroke, true), strokeWidth: number(source.strokeWidth, 1, 0, 100), strokeStyle: ["solid", "dashed", "dotted"].includes(source.strokeStyle) ? source.strokeStyle : "solid",
    radius: number(source.radius, base.radius, 0, 10000), opacity: number(source.opacity, 1, 0, 1), shadow: ["none", "soft", "strong"].includes(source.shadow) ? source.shadow : "none",
    fontFamily: ["system", "sans", "serif", "mono"].includes(source.fontFamily) ? source.fontFamily : "system", fontSize: number(source.fontSize, 16, 1, 512), fontWeight: number(source.fontWeight, 400, 100, 900), lineHeight: number(source.lineHeight, 1.4, 0.5, 5), letterSpacing: number(source.letterSpacing, 0, -100, 100), textAlign: ["left", "center", "right"].includes(source.textAlign) ? source.textAlign : "left",
    clipContent: bool(source.clipContent, source.kind === "frame"), frameType: source.frameType === "screen" ? "screen" : "container", framePreset: UI_FRAME_PRESETS.some(item => item.id === source.framePreset) ? source.framePreset : "custom",
    constraints: isRecord(source.constraints) ? {
      horizontal: ["left", "right", "left-right", "center", "scale"].includes(source.constraints.horizontal as string) ? source.constraints.horizontal as UIConstraints["horizontal"] : base.constraints.horizontal,
      vertical: ["top", "bottom", "top-bottom", "center", "scale"].includes(source.constraints.vertical as string) ? source.constraints.vertical as UIConstraints["vertical"] : base.constraints.vertical,
      minWidth: typeof source.constraints.minWidth === "number" ? number(source.constraints.minWidth, 1, 1, 1e6) : undefined,
      maxWidth: typeof source.constraints.maxWidth === "number" ? number(source.constraints.maxWidth, 1e6, 1, 1e6) : undefined,
      minHeight: typeof source.constraints.minHeight === "number" ? number(source.constraints.minHeight, 1, 1, 1e6) : undefined,
      maxHeight: typeof source.constraints.maxHeight === "number" ? number(source.constraints.maxHeight, 1e6, 1, 1e6) : undefined,
    } : base.constraints,
    widthSizing: ["fixed", "hug", "fill"].includes(source.widthSizing) ? source.widthSizing : "fixed", heightSizing: ["fixed", "hug", "fill"].includes(source.heightSizing) ? source.heightSizing : "fixed",
    autoLayout: isRecord(source.autoLayout) ? {
      ...base.autoLayout,
      enabled: bool(source.autoLayout.enabled), direction: ["horizontal", "vertical", "grid"].includes(source.autoLayout.direction as string) ? source.autoLayout.direction as UIAutoLayout["direction"] : base.autoLayout.direction,
      gap: number(source.autoLayout.gap, base.autoLayout.gap, 0, 10000),
      paddingTop: number(source.autoLayout.paddingTop, 0, 0, 10000), paddingRight: number(source.autoLayout.paddingRight, 0, 0, 10000),
      paddingBottom: number(source.autoLayout.paddingBottom, 0, 0, 10000), paddingLeft: number(source.autoLayout.paddingLeft, 0, 0, 10000),
      alignment: ["start", "center", "end", "stretch"].includes(source.autoLayout.alignment as string) ? source.autoLayout.alignment as UIAutoLayout["alignment"] : base.autoLayout.alignment,
      justification: ["start", "center", "end", "space-between"].includes(source.autoLayout.justification as string) ? source.autoLayout.justification as UIAutoLayout["justification"] : base.autoLayout.justification,
      wrap: bool(source.autoLayout.wrap), columns: number(source.autoLayout.columns, base.autoLayout.columns, 1, 48),
      widthMode: ["fixed", "hug", "fill"].includes(source.autoLayout.widthMode as string) ? source.autoLayout.widthMode as UIAutoLayout["widthMode"] : base.autoLayout.widthMode,
      heightMode: ["fixed", "hug", "fill"].includes(source.autoLayout.heightMode as string) ? source.autoLayout.heightMode as UIAutoLayout["heightMode"] : base.autoLayout.heightMode,
      clip: bool(source.autoLayout.clip),
    } : base.autoLayout,
    mask: bool(source.mask), imageFit: ["cover", "contain", "fill"].includes(source.imageFit) ? source.imageFit : "cover",
    imageCrop: isRecord(source.imageCrop) ? { x: number(source.imageCrop.x, 0, 0, 1), y: number(source.imageCrop.y, 0, 0, 1), width: number(source.imageCrop.width, 1, 0.01, 1), height: number(source.imageCrop.height, 1, 0.01, 1) } : base.imageCrop,
    pathPoints: Array.isArray(source.pathPoints) ? source.pathPoints.slice(0, 10000).filter(isRecord).map(point => ({ x: number(point.x, 0, 0, 1), y: number(point.y, 0, 0, 1), type: point.type === "smooth" ? "smooth" : "corner" })) : [],
    interactions: Array.isArray(source.interactions) ? source.interactions.slice(0, 100).filter(isRecord).map((item, i) => ({ id: string(item.id, `interaction-${i}`, 120), name: string(item.name, "Interaction", 120), trigger: typeof item.trigger === "string" && ["click", "hover", "press"].includes(item.trigger) ? item.trigger as UIInteraction["trigger"] : "click", action: typeof item.action === "string" && ["navigate", "back", "open-overlay", "close-overlay"].includes(item.action) ? item.action as UIInteraction["action"] : "navigate", targetPageId: string(item.targetPageId), targetNodeId: string(item.targetNodeId), transition: typeof item.transition === "string" && ["instant", "dissolve", "slide-left", "slide-right"].includes(item.transition) ? item.transition as UIInteraction["transition"] : "instant" })) : [],
  };
  return clean;
}
function cleanGrid(value: unknown): UIGrid {
  const base = defaultGrid(); if (!isRecord(value)) return base;
  return { visible: true, snap: true, kind: ["square", "columns", "rows", "modular", "baseline"].includes(value.kind as string) ? value.kind as UIGridKind : base.kind, size: number(value.size, base.size, 1, 512), columns: number(value.columns, base.columns, 1, 48), rows: number(value.rows, base.rows, 1, 48), gutter: number(value.gutter, base.gutter, 0, 512), margin: number(value.margin, base.margin, 0, 2000), baseline: number(value.baseline, base.baseline, 1, 128), color: color(value.color, base.color), opacity: number(value.opacity, base.opacity, 0.01, 0.8) };
}
function cleanPage(value: unknown, index: number): UIPage | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || !Array.isArray(value.elements) || value.elements.length > UI_DESIGN_MAX_ELEMENTS) return undefined;
  const id = string(value.id, `page-${index}`, 120);
  const cleanedElements = value.elements.map((item, i) => cleanElement(item, id, i));
  if (cleanedElements.some((node): node is undefined => node === undefined)) return undefined;
  const elements = cleanedElements as UIElement[];
  if (new Set(elements.map(node => node.id)).size !== elements.length) return undefined;
  const pages = new Set<string>();
  const flows = Array.isArray(value.prototypeFlows) ? value.prototypeFlows.filter(isRecord).slice(0, 100).map((flow, i) => ({ id: string(flow.id, `flow-${i}`, 120), name: string(flow.name, `Flow ${i + 1}`, 120), startPageId: string(flow.startPageId, id, 120), startNodeId: string(flow.startNodeId) || undefined })) : [];
  for (const flow of flows) pages.add(flow.startPageId);
  const prototypeFlows = flows.filter(flow => pages.has(flow.startPageId));
  const indexTree = new Map(elements.map(node => [node.id, node]));
  for (const node of elements) if (node.parentId !== id && !isHierarchyContainer(indexTree.get(node.parentId)?.kind ?? "")) node.parentId = id;
  // Remove cyclic or unreachable branches at the untrusted file boundary.
  if (!hierarchyIsValid(id, elements)) for (const node of elements) node.parentId = id;
  return { id, name: string(value.name, `Page ${index + 1}`, 120), background: /^#[\da-f]{6}$/i.test(String(value.background ?? "")) ? String(value.background) : "#edf1f7", elements, grid: cleanGrid(value.grid), prototypeFlows, activePrototypeFlowId: prototypeFlows.some(flow => flow.id === value.activePrototypeFlowId) ? string(value.activePrototypeFlowId) : prototypeFlows[0]?.id ?? "" };
}
export function normalizeUIDesignDocument(value: unknown): UIDesignDocument | undefined {
  if (!isRecord(value) || value.format !== UI_DESIGN_FORMAT || value.version !== UI_DESIGN_VERSION || !Array.isArray(value.pages) || !value.pages.length || value.pages.length > UI_DESIGN_MAX_PAGES) return undefined;
  const cleanedPages = value.pages.map(cleanPage);
  // Reject the document if any page is malformed. Silently filtering a page
  // here would make a successfully opened file lose that page on its next save.
  if (cleanedPages.some((page): page is undefined => page === undefined)) return undefined;
  const pages = cleanedPages as UIPage[];
  const pageIds = new Set(pages.map(page => page.id));
  const pageCount = pages.reduce((sum, page) => sum + page.elements.length, 0);
  if (new Set(pageIds).size !== pages.length || pageCount > UI_DESIGN_MAX_ELEMENTS) return undefined;
  for (const page of pages) for (const node of page.elements) node.interactions = node.interactions.filter(interaction => (!interaction.targetPageId || pageIds.has(interaction.targetPageId)) && (!interaction.targetNodeId || page.elements.some(target => target.id === interaction.targetNodeId)));
  const document = createUIDesignDocument(string(value.name, "Untitled UI design", 200));
  type NormalizedTokenRow = Record<string, unknown> & { id: string; name: string };
  const tokenRows = (source: unknown, defaults: Array<Record<string, unknown>>, max: number): NormalizedTokenRow[] | undefined => {
    if (source === undefined) return defaults as NormalizedTokenRow[];
    if (!Array.isArray(source) || source.length > max || source.some(item => !isRecord(item))) return undefined;
    const rows = source as Array<Record<string, unknown>>;
    const cleaned: NormalizedTokenRow[] = rows.map((item, index) => ({ ...item, id: string(item.id, `token-${index}`, 120), name: string(item.name, "Untitled", 120) }));
    return new Set(cleaned.map(item => item.id)).size === cleaned.length ? cleaned : undefined;
  };
  const colorRows = tokenRows(value.colorTokens, document.colorTokens, 1000); if (!colorRows) return undefined;
  const colors: UIColorToken[] = colorRows.map(token => {
    const modeValues = isRecord(token.modeValues) ? Object.fromEntries(Object.entries(token.modeValues).filter((entry): entry is [string, string] => typeof entry[1] === "string").map(([id, value]) => [id, color(value, "#000000")])) : {};
    return { id: token.id, name: token.name, value: color(token.value, "#000000"), aliasOf: string(token.aliasOf), modeValues };
  });
  const colorIds = new Set(colors.map(token => token.id));
  for (const token of colors) if (token.aliasOf && !colorIds.has(token.aliasOf)) token.aliasOf = "";
  const modeRows = tokenRows(value.colorModes, document.colorModes, 32); if (!modeRows) return undefined;
  const modes: UIColorMode[] = modeRows.map(mode => ({ id: mode.id, name: mode.name }));
  const modeIds = new Set(modes.map(mode => mode.id));
  const typographyRows = tokenRows(value.typographyTokens, document.typographyTokens, 1000); if (!typographyRows) return undefined;
  const typographyTokens: UITypographyToken[] = typographyRows.map(token => ({
    id: token.id, name: token.name, fontFamily: ["system", "sans", "serif", "mono"].includes(token.fontFamily as string) ? token.fontFamily as UITypographyToken["fontFamily"] : "system",
    fontSize: number(token.fontSize, 16, 1, 512), fontWeight: number(token.fontWeight, 400, 100, 900), lineHeight: number(token.lineHeight, 1.4, 0.5, 5), letterSpacing: number(token.letterSpacing, 0, -100, 100),
  }));
  const cleanValueTokens = (source: unknown, defaults: UIValueToken[]) => {
    const rows = tokenRows(source, defaults, 1000); if (!rows) return undefined;
    return rows.map(token => ({ id: token.id, name: token.name, value: number(token.value, 0, 0, 1e6), unit: token.unit === "rem" ? "rem" as const : "px" as const }));
  };
  const spacingTokens = cleanValueTokens(value.spacingTokens, document.spacingTokens); if (!spacingTokens) return undefined;
  const radiusTokens = cleanValueTokens(value.radiusTokens, document.radiusTokens); if (!radiusTokens) return undefined;
  const effectRows = tokenRows(value.effectTokens, document.effectTokens, 1000); if (!effectRows) return undefined;
  const effectTokens = effectRows.map(token => ({ id: token.id, name: token.name, value: string(token.value, "", 1000) }));
  const libraryRows = value.assetLibraries === undefined ? document.assetLibraries : value.assetLibraries;
  if (!Array.isArray(libraryRows) || libraryRows.length > 100 || libraryRows.some(item => !isRecord(item))) return undefined;
  const assetLibraries = libraryRows.map((source: unknown, i: number) => { const item = source as Record<string, unknown>; return { id: string(item.id, `library-${i}`, 120), name: string(item.name, `Library ${i + 1}`, 120), enabled: bool(item.enabled, true), assetIds: Array.isArray(item.assetIds) ? item.assetIds.filter((id: unknown): id is string => typeof id === "string").slice(0, 10000) : [] }; });
  if (new Set(assetLibraries.map(item => item.id)).size !== assetLibraries.length) return undefined;
  return {
    ...document, id: string(value.id, document.id, 120), name: string(value.name, document.name, 200), pages,
    activePageId: pageIds.has(value.activePageId as string) ? value.activePageId as string : pages[0].id,
    colorTokens: colors, typographyTokens,
    spacingTokens, radiusTokens, effectTokens,
    colorModes: modes, activeColorModeId: modeIds.has(value.activeColorModeId as string) ? value.activeColorModeId as string : modes[0]?.id ?? "",
    components: Array.isArray(value.components) ? value.components.filter(isRecord).slice(0, 1000).flatMap(component => { const root = cleanElement(component.root, "component-root", 0); return root ? [{ id: string(component.id, root.id, 120), name: string(component.name, root.name, 120), root, children: Array.isArray(component.children) ? component.children.map((child, i) => cleanElement(child, root.id, i)).filter((item): item is UIElement => !!item) : [], variants: Array.isArray(component.variants) ? component.variants.filter(isRecord).slice(0, 100).map((variant, i) => ({ id: string(variant.id, `variant-${i}`, 120), name: string(variant.name, `Variant ${i + 1}`, 120), properties: isRecord(variant.properties) ? variant.properties as UIComponentVariant["properties"] : {} })) : [] }] : []; }) : [],
    assetLibraries,
  };
}
export function parseUIDesignDocument(contents: string): UIDesignDocument {
  if (new TextEncoder().encode(contents).byteLength > UI_DESIGN_MAX_BYTES) throw new Error("UI Design file exceeds the 20 MB limit.");
  let parsed: unknown; try { parsed = JSON.parse(contents); } catch { throw new Error("UI Design file does not contain valid JSON."); }
  const document = normalizeUIDesignDocument(parsed);
  if (!document) throw new Error("This is not a supported SketchDraw UI Design v1 document.");
  return document;
}
export function serializeUIDesignDocument(document: UIDesignDocument): string {
  const normalized = normalizeUIDesignDocument(document);
  if (!normalized) throw new Error("The UI Design document is invalid and cannot be saved.");
  const contents = JSON.stringify(normalized);
  if (new TextEncoder().encode(contents).byteLength > UI_DESIGN_MAX_BYTES) throw new Error("UI Design file exceeds the 20 MB limit.");
  return contents;
}
