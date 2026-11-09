import { hierarchyIsValid, isHierarchyContainer, UIHierarchyIndex } from "./hierarchy";
import { hasTokenAliasCycle } from "./tokens";

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
export type UIInteraction = {
  id: string; name: string; trigger: "click" | "hover" | "press" | "keyboard" | "timed";
  action: "navigate" | "back" | "open-overlay" | "close-overlay" | "set-variable";
  targetPageId?: string; targetNodeId?: string; transition: "instant" | "dissolve" | "slide-left" | "slide-right";
  key?: string; delayMs?: number; variableId?: string; variableValue?: string | number | boolean;
  overlayPosition?: "center" | "top" | "bottom"; overlayBackground?: string; overlayOpacity?: number; closeOnOutside?: boolean;
  condition?: { variableId: string; operator: "equals" | "not-equals" | "greater" | "less" | "truthy" | "falsy"; value?: string | number | boolean };
};
export type UIPrototypeFlow = { id: string; name: string; startPageId: string; startNodeId?: string };
export type UIPrototypeVariable = { id: string; name: string; value: string | number | boolean };
export type UIResponsiveBreakpoint = { id: string; name: string; minWidth: number; maxWidth?: number };
export type UIColorMode = { id: string; name: string };
export type UIColorToken = { id: string; name: string; value: string; modeValues?: Record<string, string>; aliasOf?: string };
export type UITypographyStyle = { fontFamily: "system" | "sans" | "serif" | "mono"; fontSize: number; fontWeight: number; lineHeight: number; letterSpacing: number };
export type UITypographyToken = { id: string; name: string } & UITypographyStyle & { modeValues?: Record<string, Partial<UITypographyStyle>>; aliasOf?: string };
export type UIValueToken = { id: string; name: string; value: number; unit: "px" | "rem"; modeValues?: Record<string, number>; aliasOf?: string };
export type UIGridMinmaxTrack = { min: number; max: number; maxUnit: "px" | "fr" | "auto" };
export type UIComponentVariant = { id: string; name: string; properties: Record<string, string | number | boolean> };
export type UIComponentDefinition = { id: string; name: string; root: UIElement; children: UIElement[]; variants: UIComponentVariant[] };
export type UIAutoLayout = {
  enabled: boolean; direction: "horizontal" | "vertical" | "grid"; gap: number; gapTokenId: string; paddingTop: number; paddingRight: number; paddingBottom: number; paddingLeft: number;
  paddingTopTokenId: string; paddingRightTokenId: string; paddingBottomTokenId: string; paddingLeftTokenId: string;
  alignment: "start" | "center" | "end" | "stretch"; justification: "start" | "center" | "end" | "space-between";
  wrap: boolean; columns: number; gridColumnSizes: number[]; gridRowSizes: number[]; gridColumnFr: number[]; gridRowFr: number[]; gridColumnMinmax: Array<UIGridMinmaxTrack | undefined>; gridRowMinmax: Array<UIGridMinmaxTrack | undefined>; widthMode: "fixed" | "hug" | "fill"; heightMode: "fixed" | "hug" | "fill"; clip: boolean;
};
export type UIConstraints = { horizontal: "left" | "right" | "left-right" | "center" | "scale"; vertical: "top" | "bottom" | "top-bottom" | "center" | "scale"; minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number };

export type UIElement = {
  id: string; name: string; kind: UIElementKind; parentId: string; order: number;
  x: number; y: number; width: number; height: number; rotation: number;
  hidden: boolean; locked: boolean; text: string; imageData: string;
  fillTokenId: string; strokeTokenId: string; typographyTokenId: string; radiusTokenId: string; effectTokenId: string; effectValue: string; componentId: string; componentSourceId: string; componentSourceIds: Record<string, string>; componentVariantId: string; overrides: Record<string, string | number | boolean>;
  pathPoints: UIPathPoint[]; fill: string; stroke: string; strokeWidth: number; strokeStyle: "solid" | "dashed" | "dotted";
  fillGradient?: { angle: number; from: string; to: string }; booleanOperation?: "union" | "subtract" | "intersect" | "exclude";
  radius: number; opacity: number; shadow: "none" | "soft" | "strong"; fontFamily: "system" | "sans" | "serif" | "mono";
  fontSize: number; fontWeight: number; lineHeight: number; letterSpacing: number; textAlign: "left" | "center" | "right";
  clipContent: boolean; frameType: "screen" | "container"; framePreset: UIFramePresetId; constraints: UIConstraints;
  widthSizing: "fixed" | "hug" | "fill"; heightSizing: "fixed" | "hug" | "fill";
  layoutPosition: "flow" | "absolute"; gridColumn: number; gridRow: number; gridColumnSpan: number; gridRowSpan: number;
  responsiveOverrides: Record<string, Partial<Pick<UIElement, "x" | "y" | "width" | "height" | "hidden">>>;
  previewOverflow: "none" | "horizontal" | "vertical" | "both"; fixedOnScroll: boolean;
  autoLayout: UIAutoLayout; mask: boolean; imageFit: "cover" | "contain" | "fill"; imageCrop: { x: number; y: number; width: number; height: number };
  interactions: UIInteraction[];
};
export type UIManualGuide = { id: string; axis: "x" | "y"; position: number; visible: boolean; locked: boolean };
export type UIGuideSettings = { enabled: boolean; smartGuides: boolean; equalSpacing: boolean; snapObjects: boolean; snapGuides: boolean; snapGrid: boolean; measurements: boolean; threshold: number; gridSize: number; color: string };
export type UIPage = { id: string; name: string; background: string; elements: UIElement[]; prototypeFlows: UIPrototypeFlow[]; activePrototypeFlowId: string; guides: UIManualGuide[] };
export type UIDesignDocument = {
  format: typeof UI_DESIGN_FORMAT; version: typeof UI_DESIGN_VERSION; id: string; name: string; activePageId: string; pages: UIPage[];
  colorTokens: UIColorToken[]; typographyTokens: UITypographyToken[]; spacingTokens: UIValueToken[]; radiusTokens: UIValueToken[];
  effectTokens: Array<{ id: string; name: string; value: string; modeValues?: Record<string, string>; aliasOf?: string }>; colorModes: UIColorMode[]; activeColorModeId: string;
  components: UIComponentDefinition[]; assetLibraries: Array<{ id: string; name: string; enabled: boolean; assetIds: string[] }>;
  prototypeVariables: UIPrototypeVariable[]; responsiveBreakpoints: UIResponsiveBreakpoint[]; guideSettings: UIGuideSettings;
};

let idCounter = 0;
export function createUIDesignId(prefix = "ui"): string {
  try { return `${prefix}-${crypto.randomUUID()}`; }
  catch { return `${prefix}-${Date.now().toString(36)}-${(++idCounter).toString(36)}`; }
}
const defaultAutoLayout = (): UIAutoLayout => ({ enabled: false, direction: "vertical", gap: 8, gapTokenId: "", paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, paddingTopTokenId: "", paddingRightTokenId: "", paddingBottomTokenId: "", paddingLeftTokenId: "", alignment: "start", justification: "start", wrap: false, columns: 2, gridColumnSizes: [], gridRowSizes: [], gridColumnFr: [], gridRowFr: [], gridColumnMinmax: [], gridRowMinmax: [], widthMode: "fixed", heightMode: "fixed", clip: false });
const defaultConstraints = (): UIConstraints => ({ horizontal: "left", vertical: "top" });

export function createUIElement(kind: UIElementKind, order: number, point: { x: number; y: number }, parentId: string, size?: { width: number; height: number }): UIElement {
  const id = createUIDesignId(kind);
  const dimensions = size ?? (kind === "frame" ? { width: 390, height: 844 } : kind === "button" ? { width: 132, height: 44 } : kind === "input" ? { width: 240, height: 44 } : kind === "checkbox" ? { width: 140, height: 28 } : kind === "text" ? { width: 180, height: 32 } : kind === "line" ? { width: 120, height: 2 } : { width: 120, height: 80 });
  const preset = kind === "frame" ? UI_FRAME_PRESETS.find(item => item.id === "mobile-iphone")! : UI_FRAME_PRESETS[0];
  return {
    id, name: kind === "frame" ? "Frame" : kind === "group" ? "Group" : `${kind[0].toUpperCase()}${kind.slice(1)}`, kind, parentId, order,
    x: Math.round(point.x), y: Math.round(point.y), width: dimensions.width, height: dimensions.height, rotation: 0,
    hidden: false, locked: false, text: kind === "button" ? "Button" : kind === "input" ? "Placeholder" : kind === "checkbox" ? "Checkbox" : kind === "text" ? "Text" : "", imageData: "",
    fillTokenId: "", strokeTokenId: "", typographyTokenId: "", radiusTokenId: "", effectTokenId: "", effectValue: "", componentId: "", componentSourceId: "", componentSourceIds: {}, componentVariantId: "", overrides: {}, pathPoints: [],
    fill: kind === "text" || kind === "line" || kind === "path" || kind === "group" ? "#26354d" : kind === "button" ? "#365fe5" : kind === "frame" ? "#ffffff" : "#e4ebf8",
    stroke: kind === "text" || kind === "path" || kind === "group" ? "none" : kind === "line" ? "#26354d" : "#b9c7dc", strokeWidth: 1, strokeStyle: "solid", radius: kind === "button" ? 8 : kind === "input" ? 6 : kind === "frame" ? 0 : 4,
    opacity: 1, shadow: "none", fontFamily: "system", fontSize: 16, fontWeight: kind === "button" ? 600 : 400, lineHeight: 1.4, letterSpacing: 0, textAlign: "left",
    clipContent: kind === "frame", frameType: "container", framePreset: preset.id, constraints: defaultConstraints(), widthSizing: "fixed", heightSizing: "fixed", layoutPosition: "flow", gridColumn: 0, gridRow: 0, gridColumnSpan: 1, gridRowSpan: 1, responsiveOverrides: {}, previewOverflow: "none", fixedOnScroll: false, autoLayout: defaultAutoLayout(), mask: false,
    imageFit: "cover", imageCrop: { x: 0, y: 0, width: 1, height: 1 }, interactions: [], fillGradient: undefined, booleanOperation: undefined,
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
    pages: [{ id: pageId, name: "Page 1", background: "#edf1f7", elements: [], prototypeFlows: [{ id: flowId, name: "Flow 1", startPageId: pageId }], activePrototypeFlowId: flowId, guides: [] }],
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
    prototypeVariables: [], responsiveBreakpoints: [{ id: "breakpoint-mobile", name: "Mobile", minWidth: 0, maxWidth: 767 }, { id: "breakpoint-tablet", name: "Tablet", minWidth: 768, maxWidth: 1199 }, { id: "breakpoint-desktop", name: "Desktop", minWidth: 1200 }],
    guideSettings: { enabled: true, smartGuides: true, equalSpacing: true, snapObjects: true, snapGuides: true, snapGrid: false, measurements: true, threshold: 7, gridSize: 8, color: "#7857d5" },
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
function safeImageData(value: unknown): string {
  if (typeof value !== "string" || value.length > 8_000_000) return "";
  const data = value.trim();
  if (/^data:image\/(?:png|jpeg|gif|webp);base64,[\da-z+/]+=*$/i.test(data)) return data;
  const svg = data.match(/^data:image\/svg\+xml;base64,([\da-z+/]+=*)$/i);
  if (!svg) return "";
  try {
    const binary = atob(svg[1]);
    const markup = new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0)));
    if (!/<svg(?:\s|>)/i.test(markup) || /<!DOCTYPE|<!ENTITY|<\s*(?:script|foreignObject|iframe|object|embed)\b|\son[a-z]+\s*=|javascript\s*:|@import|url\(\s*['"]?(?!#)/i.test(markup)) return "";
    if (/\b(?:href|xlink:href)\s*=\s*['"](?!#|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(markup)) return "";
    return data;
  } catch { return ""; }
}
const validKinds = new Set<UIElementKind>(["group", "frame", "text", "rectangle", "ellipse", "line", "path", "button", "input", "checkbox", "image", "componentInstance"]);
function cleanElement(value: unknown, pageId: string, index: number): UIElement | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || !validKinds.has(value.kind as UIElementKind)) return undefined;
  const base = createUIElement(value.kind as UIElementKind, index, { x: 0, y: 0 }, pageId);
  const source = value as Record<string, any>;
  const clean: UIElement = { ...base,
    id: string(source.id, base.id, 120), name: string(source.name, base.name, 120), parentId: string(source.parentId, pageId, 120), order: number(source.order, index, 0, 1e7),
    x: number(source.x, 0, -1e7, 1e7), y: number(source.y, 0, -1e7, 1e7), width: number(source.width, base.width, 1, 1e6), height: number(source.height, base.height, 1, 1e6), rotation: number(source.rotation, 0, -36000, 36000),
    hidden: bool(source.hidden), locked: bool(source.locked), text: string(source.text, "", 10000), imageData: safeImageData(source.imageData),
    fillTokenId: string(source.fillTokenId), strokeTokenId: string(source.strokeTokenId), typographyTokenId: string(source.typographyTokenId), radiusTokenId: string(source.radiusTokenId), effectTokenId: string(source.effectTokenId), effectValue: string(source.effectValue, "", 1000), componentId: string(source.componentId), componentSourceId: string(source.componentSourceId), componentSourceIds: isRecord(source.componentSourceIds) ? Object.fromEntries(Object.entries(source.componentSourceIds).filter(([key, item]) => /^[\w.-]{1,120}$/.test(key) && typeof item === "string" && item.length <= 200).slice(0, 16)) as Record<string, string> : {}, componentVariantId: string(source.componentVariantId), overrides: isRecord(source.overrides) ? Object.fromEntries(Object.entries(source.overrides).filter(([key, item]) => /^[\w.-]{1,200}$/.test(key) && (typeof item === "string" || typeof item === "boolean" || typeof item === "number" && Number.isFinite(item))).slice(0, 100)) as UIElement["overrides"] : {},
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
    layoutPosition: source.layoutPosition === "absolute" ? "absolute" : "flow", gridColumn: number(source.gridColumn, 0, 0, 48), gridRow: number(source.gridRow, 0, 0, 10000), gridColumnSpan: number(source.gridColumnSpan, 1, 1, 48), gridRowSpan: number(source.gridRowSpan, 1, 1, 10000),
    responsiveOverrides: isRecord(source.responsiveOverrides) ? Object.fromEntries(Object.entries(source.responsiveOverrides).slice(0, 32).filter(([, item]) => isRecord(item)).map(([id, item]) => {
      const override = item as Record<string, unknown>;
      return [string(id, "", 120), {
        ...(typeof override.x === "number" ? { x: number(override.x, 0, -1e7, 1e7) } : {}),
        ...(typeof override.y === "number" ? { y: number(override.y, 0, -1e7, 1e7) } : {}),
        ...(typeof override.width === "number" ? { width: number(override.width, base.width, 1, 1e6) } : {}),
        ...(typeof override.height === "number" ? { height: number(override.height, base.height, 1, 1e6) } : {}),
        ...(typeof override.hidden === "boolean" ? { hidden: override.hidden } : {}),
      }];
    }).filter(([id]) => !!id)) : {},
    previewOverflow: ["none", "horizontal", "vertical", "both"].includes(source.previewOverflow) ? source.previewOverflow : "none", fixedOnScroll: bool(source.fixedOnScroll),
    autoLayout: isRecord(source.autoLayout) ? {
      ...base.autoLayout,
      enabled: bool(source.autoLayout.enabled), direction: ["horizontal", "vertical", "grid"].includes(source.autoLayout.direction as string) ? source.autoLayout.direction as UIAutoLayout["direction"] : base.autoLayout.direction,
      gap: number(source.autoLayout.gap, base.autoLayout.gap, 0, 10000),
      gapTokenId: string(source.autoLayout.gapTokenId),
      paddingTop: number(source.autoLayout.paddingTop, 0, 0, 10000), paddingRight: number(source.autoLayout.paddingRight, 0, 0, 10000),
      paddingBottom: number(source.autoLayout.paddingBottom, 0, 0, 10000), paddingLeft: number(source.autoLayout.paddingLeft, 0, 0, 10000),
      paddingTopTokenId: string(source.autoLayout.paddingTopTokenId), paddingRightTokenId: string(source.autoLayout.paddingRightTokenId),
      paddingBottomTokenId: string(source.autoLayout.paddingBottomTokenId), paddingLeftTokenId: string(source.autoLayout.paddingLeftTokenId),
      alignment: ["start", "center", "end", "stretch"].includes(source.autoLayout.alignment as string) ? source.autoLayout.alignment as UIAutoLayout["alignment"] : base.autoLayout.alignment,
      justification: ["start", "center", "end", "space-between"].includes(source.autoLayout.justification as string) ? source.autoLayout.justification as UIAutoLayout["justification"] : base.autoLayout.justification,
      wrap: bool(source.autoLayout.wrap), columns: number(source.autoLayout.columns, base.autoLayout.columns, 1, 48), gridColumnSizes: Array.isArray(source.autoLayout.gridColumnSizes) ? source.autoLayout.gridColumnSizes.slice(0, 48).map((size: unknown) => number(size, 0, 0, 1e6)) : base.autoLayout.gridColumnSizes,
      gridRowSizes: Array.isArray(source.autoLayout.gridRowSizes) ? source.autoLayout.gridRowSizes.slice(0, 10000).map((size: unknown) => number(size, 0, 0, 1e6)) : base.autoLayout.gridRowSizes,
      gridColumnFr: Array.isArray(source.autoLayout.gridColumnFr) ? source.autoLayout.gridColumnFr.slice(0, 48).map((weight: unknown) => number(weight, 0, 0, 1000)) : base.autoLayout.gridColumnFr,
      gridRowFr: Array.isArray(source.autoLayout.gridRowFr) ? source.autoLayout.gridRowFr.slice(0, 10000).map((weight: unknown) => number(weight, 0, 0, 1000)) : base.autoLayout.gridRowFr,
      gridColumnMinmax: Array.isArray(source.autoLayout.gridColumnMinmax) ? source.autoLayout.gridColumnMinmax.slice(0, 48).map((track: unknown) => isRecord(track) ? (() => { const min = number(track.min, 0, 0, 1e6); const maxUnit = ["px", "fr", "auto"].includes(track.maxUnit as string) ? track.maxUnit as UIGridMinmaxTrack["maxUnit"] : "fr"; return { min, max: maxUnit === "auto" ? 1e6 : number(track.max, min, min, 1e6), maxUnit }; })() : undefined) : base.autoLayout.gridColumnMinmax,
      gridRowMinmax: Array.isArray(source.autoLayout.gridRowMinmax) ? source.autoLayout.gridRowMinmax.slice(0, 10000).map((track: unknown) => isRecord(track) ? (() => { const min = number(track.min, 0, 0, 1e6); const maxUnit = ["px", "fr", "auto"].includes(track.maxUnit as string) ? track.maxUnit as UIGridMinmaxTrack["maxUnit"] : "fr"; return { min, max: maxUnit === "auto" ? 1e6 : number(track.max, min, min, 1e6), maxUnit }; })() : undefined) : base.autoLayout.gridRowMinmax,
      widthMode: ["fixed", "hug", "fill"].includes(source.autoLayout.widthMode as string) ? source.autoLayout.widthMode as UIAutoLayout["widthMode"] : base.autoLayout.widthMode,
      heightMode: ["fixed", "hug", "fill"].includes(source.autoLayout.heightMode as string) ? source.autoLayout.heightMode as UIAutoLayout["heightMode"] : base.autoLayout.heightMode,
      clip: bool(source.autoLayout.clip),
    } : base.autoLayout,
    mask: bool(source.mask), imageFit: ["cover", "contain", "fill"].includes(source.imageFit) ? source.imageFit : "cover",
    fillGradient: isRecord(source.fillGradient) && /^#[\da-f]{6}$/i.test(String(source.fillGradient.from ?? "")) && /^#[\da-f]{6}$/i.test(String(source.fillGradient.to ?? "")) ? { angle: number(source.fillGradient.angle, 0, -360, 360), from: String(source.fillGradient.from), to: String(source.fillGradient.to) } : undefined,
    booleanOperation: ["union", "subtract", "intersect", "exclude"].includes(String(source.booleanOperation)) ? source.booleanOperation as UIElement["booleanOperation"] : undefined,
    imageCrop: isRecord(source.imageCrop) ? { x: number(source.imageCrop.x, 0, 0, 1), y: number(source.imageCrop.y, 0, 0, 1), width: number(source.imageCrop.width, 1, 0.01, 1), height: number(source.imageCrop.height, 1, 0.01, 1) } : base.imageCrop,
    pathPoints: Array.isArray(source.pathPoints) ? source.pathPoints.slice(0, 10000).filter(isRecord).map(point => ({
      x: number(point.x, 0, 0, 1), y: number(point.y, 0, 0, 1),
      ...(typeof point.inX === "number" && Number.isFinite(point.inX) ? { inX: number(point.inX, 0, -10, 10) } : {}),
      ...(typeof point.inY === "number" && Number.isFinite(point.inY) ? { inY: number(point.inY, 0, -10, 10) } : {}),
      ...(typeof point.outX === "number" && Number.isFinite(point.outX) ? { outX: number(point.outX, 0, -10, 10) } : {}),
      ...(typeof point.outY === "number" && Number.isFinite(point.outY) ? { outY: number(point.outY, 0, -10, 10) } : {}),
      type: point.type === "smooth" ? "smooth" : "corner",
    })) : [],
    interactions: Array.isArray(source.interactions) ? source.interactions.slice(0, 100).filter(isRecord).map((item, i) => ({
      id: string(item.id, `interaction-${i}`, 120), name: string(item.name, "Interaction", 120),
      trigger: typeof item.trigger === "string" && ["click", "hover", "press", "keyboard", "timed"].includes(item.trigger) ? item.trigger as UIInteraction["trigger"] : "click",
      action: typeof item.action === "string" && ["navigate", "back", "open-overlay", "close-overlay", "set-variable"].includes(item.action) ? item.action as UIInteraction["action"] : "navigate",
      targetPageId: string(item.targetPageId), targetNodeId: string(item.targetNodeId), transition: typeof item.transition === "string" && ["instant", "dissolve", "slide-left", "slide-right"].includes(item.transition) ? item.transition as UIInteraction["transition"] : "instant",
      ...(typeof item.action === "string" && (item.action === "open-overlay" || item.action === "close-overlay") ? {
        overlayPosition: ["center", "top", "bottom"].includes(String(item.overlayPosition)) ? item.overlayPosition as NonNullable<UIInteraction["overlayPosition"]> : "center",
        overlayBackground: /^#[\da-f]{6}$/i.test(String(item.overlayBackground ?? "")) ? String(item.overlayBackground) : "#172235",
        overlayOpacity: number(item.overlayOpacity, 0.48, 0, 1), closeOnOutside: bool(item.closeOnOutside, true),
      } : {}),
      ...(typeof item.trigger === "string" && item.trigger === "keyboard" ? { key: string(item.key, "Enter", 32) } : {}),
      ...(typeof item.trigger === "string" && item.trigger === "timed" ? { delayMs: number(item.delayMs, 1000, 0, 60000) } : {}),
      ...(typeof item.action === "string" && item.action === "set-variable" ? { variableId: string(item.variableId, "", 120) } : {}),
      ...(typeof item.variableValue === "string" || typeof item.variableValue === "number" && Number.isFinite(item.variableValue) || typeof item.variableValue === "boolean" ? { variableValue: item.variableValue } : {}),
      ...(isRecord(item.condition) ? { condition: { variableId: string(item.condition.variableId, "", 120), operator: ["equals", "not-equals", "greater", "less", "truthy", "falsy"].includes(item.condition.operator as string) ? item.condition.operator as NonNullable<UIInteraction["condition"]>["operator"] : "truthy", ...(typeof item.condition.value === "string" || typeof item.condition.value === "number" && Number.isFinite(item.condition.value) || typeof item.condition.value === "boolean" ? { value: item.condition.value } : {}) } } : {}),
    })) : [],
  };
  return clean;
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
  const guideRows = value.guides === undefined ? [] : value.guides;
  if (!Array.isArray(guideRows) || guideRows.length > 256 || guideRows.some(item => !isRecord(item))) return undefined;
  const guides = guideRows.map((guide, guideIndex) => ({
    id: string(guide.id, `guide-${guideIndex}`, 120), axis: guide.axis === "y" ? "y" as const : "x" as const,
    position: number(guide.position, 0, -1e7, 1e7), visible: bool(guide.visible, true), locked: bool(guide.locked, false),
  }));
  if (guideRows.some((guide: Record<string, unknown>) => guide.axis !== "x" && guide.axis !== "y") || new Set(guides.map(guide => guide.id)).size !== guides.length) return undefined;
  const indexTree = new Map(elements.map(node => [node.id, node]));
  for (const node of elements) if (node.parentId !== id && !isHierarchyContainer(indexTree.get(node.parentId)?.kind ?? "")) node.parentId = id;
  // Remove cyclic or unreachable branches at the untrusted file boundary.
  if (!hierarchyIsValid(id, elements)) for (const node of elements) node.parentId = id;
  return { id, name: string(value.name, `Page ${index + 1}`, 120), background: /^#[\da-f]{6}$/i.test(String(value.background ?? "")) ? String(value.background) : "#edf1f7", elements, prototypeFlows, activePrototypeFlowId: prototypeFlows.some(flow => flow.id === value.activePrototypeFlowId) ? string(value.activePrototypeFlowId) : prototypeFlows[0]?.id ?? "", guides };
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
  for (const token of colors) token.modeValues = Object.fromEntries(Object.entries(token.modeValues ?? {}).filter(([id]) => modeIds.has(id)));
  const typographyRows = tokenRows(value.typographyTokens, document.typographyTokens, 1000); if (!typographyRows) return undefined;
  const typographyTokens: UITypographyToken[] = typographyRows.map(token => ({
    id: token.id, name: token.name, fontFamily: ["system", "sans", "serif", "mono"].includes(token.fontFamily as string) ? token.fontFamily as UITypographyToken["fontFamily"] : "system",
    aliasOf: string(token.aliasOf),
    fontSize: number(token.fontSize, 16, 1, 512), fontWeight: number(token.fontWeight, 400, 100, 900), lineHeight: number(token.lineHeight, 1.4, 0.5, 5), letterSpacing: number(token.letterSpacing, 0, -100, 100),
    modeValues: isRecord(token.modeValues) ? Object.fromEntries(Object.entries(token.modeValues).filter(([id, mode]) => modeIds.has(id) && isRecord(mode)).map(([id, mode]) => {
      const values = mode as Record<string, unknown>;
      const cleaned: Partial<UITypographyToken> = {};
      if (["system", "sans", "serif", "mono"].includes(values.fontFamily as string)) cleaned.fontFamily = values.fontFamily as UITypographyToken["fontFamily"];
      if (typeof values.fontSize === "number" && Number.isFinite(values.fontSize)) cleaned.fontSize = number(values.fontSize, 16, 1, 512);
      if (typeof values.fontWeight === "number" && Number.isFinite(values.fontWeight)) cleaned.fontWeight = number(values.fontWeight, 400, 100, 900);
      if (typeof values.lineHeight === "number" && Number.isFinite(values.lineHeight)) cleaned.lineHeight = number(values.lineHeight, 1.4, 0.5, 5);
      if (typeof values.letterSpacing === "number" && Number.isFinite(values.letterSpacing)) cleaned.letterSpacing = number(values.letterSpacing, 0, -100, 100);
      return [id, cleaned];
    })) : {},
  }));
  const cleanValueTokens = (source: unknown, defaults: UIValueToken[]) => {
    const rows = tokenRows(source, defaults, 1000); if (!rows) return undefined;
    return rows.map(token => ({
      id: token.id, name: token.name, value: number(token.value, 0, 0, 1e6), unit: token.unit === "rem" ? "rem" as const : "px" as const,
      aliasOf: string(token.aliasOf),
      modeValues: isRecord(token.modeValues) ? Object.fromEntries(Object.entries(token.modeValues).filter(([id, modeValue]) => modeIds.has(id) && typeof modeValue === "number" && Number.isFinite(modeValue)).map(([id, modeValue]) => [id, number(modeValue, 0, 0, 1e6)])) : {},
    }));
  };
  const spacingTokens = cleanValueTokens(value.spacingTokens, document.spacingTokens); if (!spacingTokens) return undefined;
  const radiusTokens = cleanValueTokens(value.radiusTokens, document.radiusTokens); if (!radiusTokens) return undefined;
  const effectRows = tokenRows(value.effectTokens, document.effectTokens, 1000); if (!effectRows) return undefined;
  const effectTokens = effectRows.map(token => ({
    id: token.id, name: token.name, value: string(token.value, "", 1000), aliasOf: string(token.aliasOf),
    modeValues: isRecord(token.modeValues) ? Object.fromEntries(Object.entries(token.modeValues).filter(([id, modeValue]) => modeIds.has(id) && typeof modeValue === "string").map(([id, modeValue]) => [id, string(modeValue, "", 1000)])) : {},
  }));
  const clearInvalidAliases = <T extends { id: string; aliasOf?: string }>(tokens: T[]) => {
    const ids = new Set(tokens.map(token => token.id));
    return tokens.map(token => token.aliasOf && !ids.has(token.aliasOf) ? { ...token, aliasOf: undefined } : token);
  };
  const normalizedTypographyTokens = clearInvalidAliases(typographyTokens);
  const normalizedSpacingTokens = clearInvalidAliases(spacingTokens);
  const normalizedRadiusTokens = clearInvalidAliases(radiusTokens);
  const normalizedEffectTokens = clearInvalidAliases(effectTokens);
  if ([hasTokenAliasCycle(colors), hasTokenAliasCycle(normalizedTypographyTokens), hasTokenAliasCycle(normalizedSpacingTokens), hasTokenAliasCycle(normalizedRadiusTokens), hasTokenAliasCycle(normalizedEffectTokens)].some(Boolean)) return undefined;
  const libraryRows = value.assetLibraries === undefined ? document.assetLibraries : value.assetLibraries;
  if (!Array.isArray(libraryRows) || libraryRows.length > 100 || libraryRows.some(item => !isRecord(item))) return undefined;
  const assetLibraries = libraryRows.map((source: unknown, i: number) => { const item = source as Record<string, unknown>; return { id: string(item.id, `library-${i}`, 120), name: string(item.name, `Library ${i + 1}`, 120), enabled: bool(item.enabled, true), assetIds: Array.isArray(item.assetIds) ? item.assetIds.filter((id: unknown): id is string => typeof id === "string").slice(0, 10000) : [] }; });
  if (new Set(assetLibraries.map(item => item.id)).size !== assetLibraries.length) return undefined;
  const variableSource = value.prototypeVariables === undefined ? document.prototypeVariables : value.prototypeVariables;
  if (!Array.isArray(variableSource) || variableSource.length > 1000 || variableSource.some(item => !isRecord(item))) return undefined;
  const prototypeVariables: UIPrototypeVariable[] = variableSource.map((item: Record<string, unknown>, index: number) => ({
    id: string(item.id, `variable-${index}`, 120), name: string(item.name, `Variable ${index + 1}`, 120),
    value: typeof item.value === "number" && Number.isFinite(item.value) ? number(item.value, 0, -1e9, 1e9) : typeof item.value === "boolean" ? item.value : string(item.value, "", 10000),
  }));
  if (new Set(prototypeVariables.map(item => item.id)).size !== prototypeVariables.length) return undefined;
  const guideSettingsSource = value.guideSettings === undefined ? document.guideSettings : value.guideSettings;
  if (!isRecord(guideSettingsSource)) return undefined;
  const guideSettings = {
    enabled: bool(guideSettingsSource.enabled, true), smartGuides: bool(guideSettingsSource.smartGuides, true),
    equalSpacing: bool(guideSettingsSource.equalSpacing, true), snapObjects: bool(guideSettingsSource.snapObjects, true),
    snapGuides: bool(guideSettingsSource.snapGuides, true), snapGrid: bool(guideSettingsSource.snapGrid, false),
    measurements: bool(guideSettingsSource.measurements, true), threshold: number(guideSettingsSource.threshold, 7, 1, 32),
    gridSize: number(guideSettingsSource.gridSize, 8, 1, 512),
    color: color(guideSettingsSource.color, "#7857d5"),
  };
  const breakpointSource = value.responsiveBreakpoints === undefined ? document.responsiveBreakpoints : value.responsiveBreakpoints;
  if (!Array.isArray(breakpointSource) || breakpointSource.length > 32 || breakpointSource.some(item => !isRecord(item))) return undefined;
  const responsiveBreakpoints: UIResponsiveBreakpoint[] = breakpointSource.map((item: Record<string, unknown>, index: number) => ({
    id: string(item.id, `breakpoint-${index}`, 120), name: string(item.name, `Breakpoint ${index + 1}`, 120),
    minWidth: number(item.minWidth, 0, 0, 100000), ...(typeof item.maxWidth === "number" ? { maxWidth: number(item.maxWidth, 100000, 0, 100000) } : {}),
  })).sort((a, b) => a.minWidth - b.minWidth);
  if (new Set(responsiveBreakpoints.map(item => item.id)).size !== responsiveBreakpoints.length || new Set(responsiveBreakpoints.map(item => item.name.trim().toLocaleLowerCase())).size !== responsiveBreakpoints.length || responsiveBreakpoints.some((item, index) => item.maxWidth !== undefined && item.maxWidth < item.minWidth || index > 0 && (responsiveBreakpoints[index - 1].maxWidth === undefined || responsiveBreakpoints[index - 1].maxWidth! >= item.minWidth))) return undefined;
  const componentSource = value.components === undefined ? [] : value.components;
  if (!Array.isArray(componentSource) || componentSource.length > 1000 || componentSource.some(item => !isRecord(item))) return undefined;
  const components: UIComponentDefinition[] = [];
  for (const [componentIndex, source] of componentSource.entries()) {
    const component = source as Record<string, unknown>;
    const root = cleanElement(component.root, "component-root", 0);
    if (!root) return undefined;
    const id = string(component.id, root.id, 120);
    const rawChildren = component.children === undefined ? [] : component.children;
    if (!Array.isArray(rawChildren) || rawChildren.length > UI_DESIGN_MAX_ELEMENTS || rawChildren.some(item => !isRecord(item))) return undefined;
    const children = rawChildren.map((child, index) => cleanElement(child, root.id, index));
    if (children.some((child): child is undefined => child === undefined)) return undefined;
    const componentPageId = `component-page:${id}`;
    if (!hierarchyIsValid(componentPageId, [{ ...root, parentId: componentPageId }, ...(children as UIElement[])])) return undefined;
    const variantsSource = component.variants === undefined ? [] : component.variants;
    if (!Array.isArray(variantsSource) || variantsSource.length > 100 || variantsSource.some(item => !isRecord(item))) return undefined;
    const variants = variantsSource.filter(isRecord).map((variant, index) => ({
      id: string(variant.id, `variant-${index}`, 120), name: string(variant.name, `Variant ${index + 1}`, 120),
      properties: isRecord(variant.properties) ? Object.fromEntries(Object.entries(variant.properties).filter(([key, item]) => /^[\w.-]{1,160}$/.test(key) && (typeof item === "string" || typeof item === "number" && Number.isFinite(item) || typeof item === "boolean")).slice(0, 500)) as UIComponentVariant["properties"] : {},
    }));
    if (new Set(variants.map(variant => variant.id)).size !== variants.length) return undefined;
    components.push({ id, name: string(component.name, root.name || `Component ${componentIndex + 1}`, 120), root, children: children as UIElement[], variants });
  }
  if (new Set(components.map(component => component.id)).size !== components.length) return undefined;

  // Source IDs connect live master nodes to their snapshots and every instance.
  // Rebuild them for existing v1 files that predate this additive identity field.
  const boundComponents = components.map(component => {
    const componentPageId = `component-page:${component.id}`;
    const masterPage = pages.find(page => page.elements.some(node => node.componentId === component.id && node.kind !== "componentInstance"));
    const masterRoot = masterPage?.elements.find(node => node.componentId === component.id && node.kind !== "componentInstance");
    const rootSourceId = component.root.componentSourceIds[component.id] || component.root.componentSourceId || masterRoot?.id || `component:${component.id}:root`;
    const sourceChildren = component.children.map(child => {
      const derivedId = child.id.startsWith(`${component.id}-`) ? child.id.slice(component.id.length + 1) : "";
      const childSourceId = child.componentSourceIds[component.id] || child.componentSourceId || (masterPage?.elements.some(node => node.id === derivedId) ? derivedId : `component:${component.id}:node:${child.id}`);
      return { ...child, componentSourceId: child.componentSourceId || childSourceId, componentSourceIds: { ...child.componentSourceIds, [component.id]: childSourceId } };
    });
    const root = { ...component.root, componentSourceId: component.root.componentSourceId || rootSourceId, componentSourceIds: { ...component.root.componentSourceIds, [component.id]: rootSourceId } };
    const children = sourceChildren;
    const templateIndex = new UIHierarchyIndex<UIElement>(componentPageId, [{ ...root, parentId: componentPageId }, ...children]);
    const bindTree = (nodes: UIElement[], parentId: string, templateParentId: string) => {
      const index = new UIHierarchyIndex<UIElement>(parentId, nodes);
      const templates = templateIndex.children(templateParentId);
      const actualChildren = index.children(parentId);
      for (const [order, template] of templates.entries()) {
        const actual = actualChildren.find(node => node.order === template.order && node.kind === template.kind) ?? actualChildren[order];
        if (!actual || actual.kind !== template.kind) continue;
        const at = nodes.findIndex(node => node.id === actual.id);
        if (at >= 0) {
          const sourceId = template.componentSourceIds[component.id] || template.componentSourceId;
          nodes[at] = { ...nodes[at], componentSourceId: nodes[at].componentSourceId || sourceId, componentSourceIds: { ...nodes[at].componentSourceIds, [component.id]: sourceId } };
        }
        bindTree(nodes, actual.id, template.id);
      }
    };
    if (masterPage && masterRoot) {
      const masterNodes = masterPage.elements.map(node => node.id === masterRoot.id ? { ...node, componentSourceId: node.componentSourceId || rootSourceId, componentSourceIds: { ...node.componentSourceIds, [component.id]: rootSourceId } } : node);
      bindTree(masterNodes, masterRoot.id, root.id);
      masterPage.elements = masterNodes;
    }
    for (const page of pages) {
      let pageNodes = page.elements;
      const instances = pageNodes.filter(node => node.kind === "componentInstance" && node.componentId === component.id);
      for (const instance of instances) {
        const rootAt = pageNodes.findIndex(node => node.id === instance.id);
        if (rootAt >= 0) pageNodes[rootAt] = { ...pageNodes[rootAt], componentSourceId: pageNodes[rootAt].componentSourceId || rootSourceId, componentSourceIds: { ...pageNodes[rootAt].componentSourceIds, [component.id]: rootSourceId } };
        bindTree(pageNodes, instance.id, root.id);
      }
      page.elements = pageNodes;
    }
    return { ...component, root, children };
  });
  return {
    ...document, id: string(value.id, document.id, 120), name: string(value.name, document.name, 200), pages,
    activePageId: pageIds.has(value.activePageId as string) ? value.activePageId as string : pages[0].id,
    colorTokens: colors, typographyTokens: normalizedTypographyTokens,
    spacingTokens: normalizedSpacingTokens, radiusTokens: normalizedRadiusTokens, effectTokens: normalizedEffectTokens,
    colorModes: modes, activeColorModeId: modeIds.has(value.activeColorModeId as string) ? value.activeColorModeId as string : modes[0]?.id ?? "",
    components: boundComponents,
    assetLibraries, prototypeVariables, responsiveBreakpoints, guideSettings,
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
