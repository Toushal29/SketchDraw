import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount, type JSX } from "solid-js";
import { applyAutoLayout, resizeFrameChildren } from "./layout-engine";
import { createUIElement, createUIFrame, createUIDesignId, normalizeUIDesignDocument, UI_FRAME_PRESETS, type UIComponentVariant, type UIElement, type UIElementKind, type UIFramePresetId, type UIGridMinmaxTrack, type UIInteraction, type UIManualGuide, type UIGuideSettings, type UIPrototypeVariable, type UIDesignDocument, type UIPage, type UIResponsiveBreakpoint, type UIValueToken, type UITypographyStyle } from "./model";
import { fitGroupBounds, normalizeRect, resizeElement, unionRects, type UIRect } from "./geometry";
import { UIHierarchyIndex } from "./hierarchy";
import { measureFrameEdges, measureMultipleSpacing, measureRectDistances, resolveResizeSnap, resolveSmartSnap, type UIAlignmentLine, type UIDistanceMeasure, type UISnapTarget } from "./guides";
import { moveHierarchyNodes, type HierarchyDropPosition } from "./hierarchy-operations";
import { applyComponentVariant as applyComponentVariantTree, captureComponentVariant, detachComponentInstance, resetComponentInstance, resetComponentNodeOverride as resetComponentChildOverride, synchronizeComponentMasters, withComponentOverrides } from "./components";
import { sanitizeSvg } from "./svg-import";
import { canSetTokenAlias, contrastRatio, materializeColorToken, materializeEffectToken, materializeTypographyToken, materializeValueToken, resolveColorToken, resolveEffectToken, resolveTypographyToken, resolveValueToken } from "./tokens";
import type { UIDesignSession } from "./session";
import { InspectorPanel, type InspectorTab } from "./inspector/InspectorPanel";
import { ResponsiveBreakpointsPanel } from "./inspector/ResponsiveBreakpointsPanel";
import "./ui-design.css";

type Props = { session: UIDesignSession };
type Tool = "select" | "hand" | "frame" | Exclude<UIElementKind, "group" | "componentInstance">;
type Camera = { x: number; y: number; zoom: number };
type Gesture =
  | { kind: "pan"; pointer: number; clientX: number; clientY: number; camera: Camera }
  | { kind: "draw"; pointer: number; tool: Tool; parentId: string; start: { x: number; y: number }; current: { x: number; y: number } }
  | { kind: "move"; pointer: number; start: { x: number; y: number }; ids: string[]; originals: UIElement[]; worldStarts: Array<{ id: string; x: number; y: number }>; startBounds: UIRect; snapTargets: UISnapTarget[]; spacingParentId?: string }
  | { kind: "resize"; pointer: number; start: { x: number; y: number }; id: string; original: UIElement; handle: string; snapTargets: UISnapTarget[] }
  | { kind: "guide"; pointer: number; guideId: string; axis: "x" | "y" }
  | { kind: "marquee"; pointer: number; start: { x: number; y: number }; current: { x: number; y: number }; additive: string[]; scopeParentId?: string; clickTargetId?: string }
  | { kind: "point"; pointer: number; id: string; point: number; side: "anchor" | "in" | "out" };
type AssetPart = { kind: Exclude<UIElementKind, "frame" | "group" | "componentInstance">; name?: string; text?: string; x: number; y: number; width: number; height: number; fill?: string; radius?: number };
type Asset = { id: string; name: string; category: string; width: number; height: number; parts: AssetPart[] };
type TokenKind = "color" | "type" | "spacing" | "radius" | "effect";
type TokenPreset = { name: string; value?: string; number?: number; fontFamily?: "system" | "sans" | "serif" | "mono"; fontSize?: number; fontWeight?: number; lineHeight?: number; letterSpacing?: number };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const round = (value: number) => Math.round(value);
const safeBoxShadow = (value: string) => value.length <= 256 && !/[;{}<>]|url\s*\(|var\s*\(|expression\s*\(/i.test(value) ? value : "none";
const fontStacks = { system: "system-ui, sans-serif", sans: "Arial, sans-serif", serif: "Georgia, serif", mono: "ui-monospace, monospace" };
function readableTextColor(color: string): string {
  const value = color.replace("#", "");
  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)) return "#26354d";
  const expanded = value.length === 3 ? [...value].map(char => char + char).join("") : value;
  const channels = [0, 2, 4].map(offset => parseInt(expanded.slice(offset, offset + 2), 16) / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 > 0.42 ? "#26354d" : "#ffffff";
}
function vectorPath(points: UIElement["pathPoints"], width: number, height: number, close = true): string {
  if (!points.length) return "";
  let path = `M ${points[0].x * width} ${points[0].y * height}`;
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1], next = points[index];
    if (previous.outX !== undefined || previous.outY !== undefined || next.inX !== undefined || next.inY !== undefined)
      path += ` C ${(previous.outX ?? previous.x) * width} ${(previous.outY ?? previous.y) * height}, ${(next.inX ?? next.x) * width} ${(next.inY ?? next.y) * height}, ${next.x * width} ${next.y * height}`;
    else path += ` L ${next.x * width} ${next.y * height}`;
  }
  return close ? `${path} Z` : path;
}
const tokenPresets: Record<TokenKind, TokenPreset[]> = {
  color: [{ name: "Primary", value: "#365fe5" }, { name: "Text", value: "#26354d" }, { name: "Surface", value: "#ffffff" }, { name: "Muted", value: "#e4ebf8" }, { name: "Border", value: "#b9c7dc" }],
  type: [{ name: "Heading", fontFamily: "system", fontSize: 28, fontWeight: 700, lineHeight: 1.2, letterSpacing: 0 }, { name: "Body", fontFamily: "system", fontSize: 16, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0 }, { name: "Caption", fontFamily: "system", fontSize: 12, fontWeight: 400, lineHeight: 1.4, letterSpacing: 0.1 }, { name: "Label", fontFamily: "system", fontSize: 14, fontWeight: 600, lineHeight: 1.3, letterSpacing: 0 }],
  spacing: [4, 8, 12, 16, 24, 32].map(number => ({ name: `Space ${number}`, number })),
  radius: [{ name: "Square", number: 0 }, { name: "Small", number: 4 }, { name: "Medium", number: 8 }, { name: "Large", number: 12 }, { name: "Pill", number: 999 }],
  effect: [{ name: "Soft shadow", value: "0 2px 8px #26354d1a" }, { name: "Raised shadow", value: "0 8px 24px #26354d26" }, { name: "Focus ring", value: "0 0 0 3px #365fe540" }, { name: "Overlay shadow", value: "0 12px 32px #17223540" }],
};
const kindName = (kind: UIElementKind) => kind === "componentInstance" ? "Component" : kind[0].toUpperCase() + kind.slice(1);
const assets: Asset[] = [
  { id: "basic-rectangle", name: "Rectangle", category: "Basics", width: 120, height: 80, parts: [{ kind: "rectangle", name: "Rectangle", x: 0, y: 0, width: 120, height: 80, fill: "#e8eef9", radius: 2 }] },
  { id: "basic-ellipse", name: "Ellipse", category: "Basics", width: 80, height: 80, parts: [{ kind: "ellipse", name: "Ellipse", x: 0, y: 0, width: 80, height: 80, fill: "#e8eef9" }] },
  { id: "basic-text", name: "Text label", category: "Basics", width: 180, height: 32, parts: [{ kind: "text", name: "Text label", text: "Text label", x: 0, y: 0, width: 180, height: 32, fill: "#26354d" }] },
  { id: "basic-divider", name: "Divider", category: "Basics", width: 200, height: 1, parts: [{ kind: "line", name: "Divider", x: 0, y: 0, width: 200, height: 1, fill: "#cbd5e1" }] },
  { id: "image-placeholder", name: "Image placeholder", category: "Basics", width: 160, height: 112, parts: [{ kind: "rectangle", name: "Image placeholder", x: 0, y: 0, width: 160, height: 112, fill: "#edf2f8", radius: 4 }, { kind: "ellipse", name: "Image marker", x: 18, y: 16, width: 20, height: 20, fill: "#c5d1e2" }, { kind: "path", name: "Image landscape", x: 20, y: 45, width: 120, height: 50, fill: "#b6c5d9" }] },
  { id: "primary-button", name: "Primary button", category: "Controls", width: 144, height: 44, parts: [{ kind: "button", name: "Primary button", text: "Button", x: 0, y: 0, width: 144, height: 44, fill: "#365fe5" }] },
  { id: "secondary-button", name: "Secondary button", category: "Controls", width: 144, height: 44, parts: [{ kind: "button", name: "Secondary button", text: "Button", x: 0, y: 0, width: 144, height: 44, fill: "#ffffff" }] },
  { id: "badge", name: "Badge", category: "Controls", width: 92, height: 28, parts: [{ kind: "button", name: "Badge", text: "Label", x: 0, y: 0, width: 92, height: 28, fill: "#e8eef9", radius: 14 }] },
  { id: "avatar", name: "Avatar", category: "Basics", width: 48, height: 48, parts: [{ kind: "ellipse", name: "Avatar", x: 0, y: 0, width: 48, height: 48, fill: "#dce8ff" }] },
  { id: "button-states", name: "Button states", category: "Controls", width: 316, height: 52, parts: [{ kind: "button", name: "Primary button", text: "Continue", x: 0, y: 0, width: 140, height: 44, fill: "#365fe5" }, { kind: "button", name: "Secondary button", text: "Cancel", x: 156, y: 0, width: 140, height: 44, fill: "#ffffff" }] },
  { id: "login-form", name: "Login form", category: "Forms", width: 320, height: 270, parts: [{ kind: "text", text: "Welcome back", x: 0, y: 0, width: 300, height: 36, fill: "#26354d" }, { kind: "input", text: "Email address", x: 0, y: 54, width: 300, height: 44 }, { kind: "input", text: "Password", x: 0, y: 110, width: 300, height: 44 }, { kind: "checkbox", text: "Remember me", x: 0, y: 164, width: 150, height: 28 }, { kind: "button", text: "Sign in", x: 0, y: 212, width: 300, height: 48, fill: "#365fe5" }] },
  { id: "card", name: "Content card", category: "Patterns", width: 300, height: 196, parts: [{ kind: "rectangle", name: "Card background", x: 0, y: 0, width: 300, height: 188, fill: "#ffffff", radius: 12 }, { kind: "text", text: "Card title", x: 18, y: 16, width: 260, height: 26 }, { kind: "text", text: "A short description for this card.", x: 18, y: 52, width: 260, height: 50, fill: "#66758b" }, { kind: "button", text: "Learn more", x: 18, y: 126, width: 120, height: 40, fill: "#365fe5" }] },
  { id: "navigation", name: "Navigation bar", category: "Navigation", width: 720, height: 64, parts: [{ kind: "rectangle", name: "Navigation surface", x: 0, y: 0, width: 720, height: 56, fill: "#ffffff" }, { kind: "text", text: "Brand", x: 18, y: 16, width: 140, height: 26 }, { kind: "text", text: "Overview      Products      Resources", x: 250, y: 17, width: 300, height: 24, fill: "#56647a" }, { kind: "button", text: "Sign in", x: 604, y: 10, width: 98, height: 38, fill: "#365fe5" }] },
  { id: "profile-row", name: "Profile row", category: "Patterns", width: 300, height: 60, parts: [{ kind: "ellipse", name: "Avatar", x: 0, y: 4, width: 48, height: 48, fill: "#dce8ff" }, { kind: "text", text: "Alex Morgan", x: 64, y: 5, width: 210, height: 24 }, { kind: "text", text: "Product designer", x: 64, y: 29, width: 210, height: 22, fill: "#77849a" }] },
  { id: "stat-cards", name: "Statistics cards", category: "Data", width: 392, height: 124, parts: [{ kind: "rectangle", x: 0, y: 0, width: 184, height: 112, fill: "#ffffff", radius: 10 }, { kind: "text", text: "Revenue", x: 16, y: 12, width: 152, height: 20, fill: "#748097" }, { kind: "text", text: "$24,680", x: 16, y: 42, width: 152, height: 36, fill: "#26354d" }, { kind: "rectangle", x: 208, y: 0, width: 184, height: 112, fill: "#ffffff", radius: 10 }, { kind: "text", text: "Active users", x: 224, y: 12, width: 152, height: 20, fill: "#748097" }, { kind: "text", text: "1,284", x: 224, y: 42, width: 152, height: 36, fill: "#26354d" }] },
  { id: "empty-state", name: "Empty state", category: "Patterns", width: 300, height: 216, parts: [{ kind: "ellipse", name: "Illustration", x: 118, y: 0, width: 64, height: 64, fill: "#e8eef9" }, { kind: "text", text: "Nothing here yet", x: 0, y: 82, width: 300, height: 30 }, { kind: "text", text: "Create something to get started.", x: 0, y: 116, width: 300, height: 26, fill: "#66758b" }, { kind: "button", text: "Create new", x: 88, y: 160, width: 124, height: 42, fill: "#365fe5" }] },
  { id: "search-field", name: "Search field", category: "Controls", width: 320, height: 52, parts: [{ kind: "input", name: "Search", text: "Search", x: 0, y: 0, width: 320, height: 44 }] },
  { id: "checkbox-list", name: "Checkbox list", category: "Forms", width: 280, height: 116, parts: [{ kind: "checkbox", text: "Email updates", x: 0, y: 0, width: 240, height: 28 }, { kind: "checkbox", text: "Product news", x: 0, y: 40, width: 240, height: 28 }, { kind: "checkbox", text: "Weekly summary", x: 0, y: 80, width: 240, height: 28 }] },
  { id: "modal", name: "Dialog", category: "Patterns", width: 420, height: 248, parts: [{ kind: "rectangle", name: "Dialog surface", x: 0, y: 0, width: 420, height: 240, fill: "#ffffff", radius: 14 }, { kind: "text", text: "Confirm your changes", x: 24, y: 24, width: 360, height: 30 }, { kind: "text", text: "Your updates are ready to be saved.", x: 24, y: 68, width: 360, height: 26, fill: "#66758b" }, { kind: "button", text: "Cancel", x: 164, y: 168, width: 104, height: 44, fill: "#ffffff" }, { kind: "button", text: "Save", x: 284, y: 168, width: 112, height: 44, fill: "#365fe5" }] },
  { id: "sidebar", name: "Sidebar navigation", category: "Navigation", width: 240, height: 220, parts: [{ kind: "text", text: "WORKSPACE", x: 12, y: 8, width: 200, height: 18, fill: "#7a879b" }, { kind: "button", text: "Overview", x: 0, y: 36, width: 220, height: 40, fill: "#eaf0ff" }, { kind: "text", text: "Projects", x: 12, y: 88, width: 200, height: 24 }, { kind: "text", text: "Reports", x: 12, y: 128, width: 200, height: 24 }, { kind: "text", text: "Settings", x: 12, y: 168, width: 200, height: 24 }] },
  { id: "table", name: "Data table", category: "Data", width: 640, height: 168, parts: [{ kind: "rectangle", x: 0, y: 0, width: 640, height: 40, fill: "#edf1f7" }, { kind: "text", text: "Name                         Status                 Updated", x: 16, y: 10, width: 610, height: 22 }, { kind: "text", text: "Design system                  Active                  Today", x: 16, y: 56, width: 610, height: 22 }, { kind: "text", text: "Mobile app                     Review                  Yesterday", x: 16, y: 100, width: 610, height: 22 }, { kind: "text", text: "Website refresh                Draft                   Monday", x: 16, y: 144, width: 610, height: 22 }] },
  { id: "toast", name: "Toast notification", category: "Patterns", width: 360, height: 68, parts: [{ kind: "rectangle", x: 0, y: 0, width: 350, height: 58, fill: "#ffffff", radius: 10 }, { kind: "ellipse", x: 16, y: 18, width: 22, height: 22, fill: "#2ca678" }, { kind: "text", text: "Changes saved successfully", x: 54, y: 18, width: 270, height: 24 }] },
  { id: "chart-card", name: "Chart card", category: "Data", width: 360, height: 220, parts: [{ kind: "rectangle", x: 0, y: 0, width: 350, height: 210, fill: "#ffffff", radius: 12 }, { kind: "text", text: "Weekly activity", x: 18, y: 16, width: 300, height: 26 }, { kind: "path", name: "Trend line", x: 28, y: 84, width: 286, height: 92, fill: "#365fe5" }] },
];

function TextField(props: { label: string; value: string; onInput: (value: string) => void; placeholder?: string; multiline?: boolean }) {
  return <label class="ui-field"><span>{props.label}</span><Show when={props.multiline} fallback={<input value={props.value} placeholder={props.placeholder} onInput={event => props.onInput(event.currentTarget.value)} />}><textarea value={props.value} placeholder={props.placeholder} onInput={event => props.onInput(event.currentTarget.value)} /></Show></label>;
}
function NumberField(props: { label: string; value: number; min?: number; max?: number; step?: number; onInput: (value: number) => void }) {
  let input: HTMLInputElement | undefined;
  createEffect(() => {
    const next = String(round(props.value));
    if (input && document.activeElement !== input && input.value !== next) input.value = next;
  });
  return <label class="ui-field"><span>{props.label}</span><input ref={element => { input = element; element.value = String(round(props.value)); }} type="number" min={props.min ?? -1000000} max={props.max ?? 1000000} step={props.step ?? 1} onInput={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) props.onInput(round(value)); }} onBlur={event => { event.currentTarget.value = String(round(props.value)); }} /></label>;
}
function SelectField<T extends string>(props: { label: string; value: T; options: T[]; onChange: (value: T) => void }) {
  return <label class="ui-field"><span>{props.label}</span><select value={props.value} onChange={event => props.onChange(event.currentTarget.value as T)}><For each={props.options}>{option => <option value={option}>{option}</option>}</For></select></label>;
}

function responsiveWidth(breakpoint: UIResponsiveBreakpoint): number {
  if (breakpoint.minWidth === 0) return Math.max(1, Math.min(breakpoint.maxWidth ?? 390, 390));
  if (breakpoint.maxWidth !== undefined) return Math.max(1, Math.floor((breakpoint.minWidth + breakpoint.maxWidth) / 2));
  return Math.max(1, breakpoint.minWidth, 1440);
}

function makeResponsivePreviewPage(page: UIPage, breakpoint: UIResponsiveBreakpoint, frameId: string, width: number, spacingTokens: readonly UIValueToken[], modeId: string): UIPage {
  const initial = page.elements.map(node => ({ ...node, ...(node.responsiveOverrides[breakpoint.id] ?? {}) }));
  const baseFrame = page.elements.find(node => node.id === frameId && node.kind === "frame");
  const previewFrame = initial.find(node => node.id === frameId && node.kind === "frame");
  if (!baseFrame || !previewFrame) return { ...page, elements: initial };
  const nextWidth = Math.max(1, Math.round(previewFrame.responsiveOverrides[breakpoint.id]?.width ?? width));
  const nextHeight = Math.max(1, Math.round(previewFrame.height));
  const resized = resizeFrameChildren(initial, frameId, { width: baseFrame.width, height: baseFrame.height }, { width: nextWidth, height: nextHeight });
  const restoredOverrides = resized.map(node => ({ ...node, ...(node.responsiveOverrides[breakpoint.id] ?? {}) }));
  const rooted = restoredOverrides.map(node => node.id === frameId ? { ...node, parentId: page.id, x: 0, y: 0, rotation: 0, width: nextWidth, height: nextHeight } : node);
  return applyAutoLayout({ ...page, elements: rooted }, spacingTokens, modeId);
}

function ResponsiveOverridesEditor(props: { node: UIElement; breakpoints: UIResponsiveBreakpoint[]; onChange: (overrides: UIElement["responsiveOverrides"]) => void }) {
  const set = (breakpointId: string, key: "x" | "y" | "width" | "height" | "hidden", value: number | boolean | undefined) => {
    const next = { ...props.node.responsiveOverrides };
    const row = { ...(next[breakpointId] ?? {}) };
    if (value === undefined) delete row[key]; else Object.assign(row, { [key]: value });
    if (Object.keys(row).length) next[breakpointId] = row; else delete next[breakpointId];
    props.onChange(next);
  };
  return <section class="ui-inspector-section ui-responsive-overrides"><header><strong>Responsive overrides</strong></header>
    <For each={props.breakpoints}>{breakpoint => { const value = () => props.node.responsiveOverrides[breakpoint.id] ?? {}; return <div class="ui-responsive-override"><strong>{breakpoint.name}</strong><div class="ui-responsive-override-fields">{(["x", "y", "width", "height"] as const).map(key => <label><span>{key === "width" ? "W" : key === "height" ? "H" : key.toUpperCase()}</span><input type="number" step="1" min={key === "width" || key === "height" ? 1 : -100000} placeholder={String(props.node[key])} value={value()[key] ?? ""} onInput={event => set(breakpoint.id, key, event.currentTarget.value === "" ? undefined : Math.round(Number(event.currentTarget.value) || 0))} /></label>)}</div><label class="ui-responsive-visibility"><span>Visibility</span><select value={value().hidden === undefined ? "inherit" : value().hidden ? "hidden" : "visible"} onChange={event => set(breakpoint.id, "hidden", event.currentTarget.value === "inherit" ? undefined : event.currentTarget.value === "hidden")}><option value="inherit">Inherit</option><option value="visible">Visible</option><option value="hidden">Hidden</option></select></label></div>; }}</For>
  </section>;
}

function ResponsivePreviewDialog(props: { page: UIPage; breakpoints: UIResponsiveBreakpoint[]; spacingTokens: readonly UIValueToken[]; modeId: string; renderFrame: (page: UIPage, frameId: string) => JSX.Element; onClose: () => void }) {
  const frames = () => props.page.elements.filter(node => node.kind === "frame" && !props.page.elements.some(parent => parent.id === node.parentId && parent.kind === "frame"));
  const [frameId, setFrameId] = createSignal(frames()[0]?.id ?? "");
  return <div class="ui-dialog-backdrop ui-responsive-backdrop" onClick={props.onClose}><section class="ui-responsive-dialog" role="dialog" aria-modal="true" aria-label="Responsive preview" onClick={event => event.stopPropagation()}>
    <header><div><strong>Responsive preview</strong><span>Compare this screen at each named breakpoint.</span></div><label><span>Screen</span><select value={frameId()} onChange={event => setFrameId(event.currentTarget.value)}><For each={frames()}>{frame => <option value={frame.id}>{frame.name}</option>}</For></select></label><button type="button" aria-label="Close responsive preview" onClick={props.onClose}>×</button></header>
    <div class="ui-responsive-preview-grid">
      <Show when={frames().length > 0 && props.breakpoints.length > 0} fallback={<p class="ui-panel-empty">Add a screen frame and breakpoint to compare responsive layouts.</p>}>
        <For each={props.breakpoints}>{breakpoint => {
          const width = responsiveWidth(breakpoint);
          const previewPage = makeResponsivePreviewPage(props.page, breakpoint, frameId(), width, props.spacingTokens, props.modeId);
          const frame = previewPage.elements.find(node => node.id === frameId());
          const scale = () => frame ? Math.min(1, 330 / frame.width, 390 / frame.height) : 1;
          return <article class="ui-responsive-preview-card">
            <header><strong>{breakpoint.name}</strong><span>{frame ? `${round(frame.width)} × ${round(frame.height)} px` : `${width} px`}</span></header>
            <div class="ui-responsive-preview-viewport" style={{ width: `${(frame?.width ?? width) * scale()}px`, height: `${(frame?.height ?? 500) * scale()}px` }}>
              <div class="ui-responsive-preview-scene" style={{ width: `${frame?.width ?? width}px`, height: `${frame?.height ?? 500}px`, transform: `scale(${scale()})` }}>{frame ? props.renderFrame(previewPage, frame.id) : null}</div>
            </div>
          </article>;
        }}</For>
      </Show>
    </div>
    <footer><button type="button" onClick={props.onClose}>Done</button></footer>
  </section></div>;
}

function GridTracksEditor(props: { title: string; tracks: Array<UIGridMinmaxTrack | undefined>; count: number; onChange: (tracks: Array<UIGridMinmaxTrack | undefined>) => void; onCountChange?: (count: number) => void }) {
  const indices = () => props.tracks.flatMap((track, index) => track ? [index] : []);
  const add = () => {
    const index = Array.from({ length: Math.max(props.count, props.tracks.length) }, (_, i) => i).find(i => !props.tracks[i]);
    const target = index ?? Math.max(props.count, props.tracks.length);
    if (target >= 48) return;
    const next = [...props.tracks]; next[target] = { min: 0, max: 1, maxUnit: "fr" }; props.onChange(next); props.onCountChange?.(Math.max(props.count, target + 1));
  };
  const patch = (index: number, value: Partial<UIGridMinmaxTrack>) => props.onChange(props.tracks.map((item, at) => at === index ? { min: item?.min ?? 0, max: item?.max ?? 1, maxUnit: item?.maxUnit ?? "fr", ...value } : item));
  const remove = (index: number) => { const next = [...props.tracks]; next[index] = undefined; props.onChange(next); };
  return <div class="ui-grid-track-editor"><header><strong>{props.title}</strong><button type="button" onClick={add}>＋ Track</button></header><For each={indices()}>{index => { const track = () => props.tracks[index]!; return <div class="ui-grid-track-row"><span>{index + 1}</span><label><small>Min px</small><input type="number" min="0" max="1000000" step="1" value={track().min} onInput={event => patch(index, { min: Math.max(0, Math.round(Number(event.currentTarget.value) || 0)) })} /></label><label><small>Max</small><input type="number" min="0.1" max="1000000" step="0.1" disabled={track().maxUnit === "auto"} value={track().maxUnit === "auto" ? "" : track().max} onInput={event => patch(index, { max: Math.max(0.1, Number(event.currentTarget.value) || 0.1) })} /></label><select aria-label={`${props.title} ${index + 1} max sizing`} value={track().maxUnit} onChange={event => patch(index, { maxUnit: event.currentTarget.value as UIGridMinmaxTrack["maxUnit"] })}><option value="fr">fr</option><option value="px">px</option><option value="auto">auto</option></select><button type="button" title={`Remove ${props.title.toLowerCase()} track ${index + 1}`} aria-label={`Remove ${props.title.toLowerCase()} track ${index + 1}`} onClick={() => remove(index)}>×</button></div>; }}</For><Show when={!indices().length}><small class="ui-inspector-note">No custom tracks. Add a min/max rule to override the default grid sizing.</small></Show></div>;
}

function AssetIcon(props: { kind: UIElementKind }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <Show when={props.kind === "rectangle"}><rect x="3.5" y="5" width="17" height="14" rx="1.5" /></Show>
    <Show when={props.kind === "ellipse"}><circle cx="12" cy="12" r="8" /></Show>
    <Show when={props.kind === "text"}><path d="M5 5h14M12 5v14m-4 0h8" /></Show>
    <Show when={props.kind === "line"}><path d="M4 18 20 6" /></Show>
    <Show when={props.kind === "path"}><path d="M4 18c3-9 7-12 10-9s4 3 6-3" /><circle cx="4" cy="18" r="1.4" /><circle cx="20" cy="6" r="1.4" /></Show>
    <Show when={props.kind === "image"}><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><circle cx="9" cy="9" r="1.4" /><path d="m5 17 5-5 3 3 2-2 4 4" /></Show>
    <Show when={props.kind === "frame"}><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M8 8h8v8H8z" stroke-dasharray="2 2" /></Show>
    <Show when={props.kind === "group"}><rect x="3.5" y="5" width="17" height="14" rx="1.5" stroke-dasharray="3 2" /><rect x="7.5" y="8" width="9" height="8" rx="1" /></Show>
    <Show when={props.kind === "componentInstance"}><path d="m12 3 3 3-3 3-3-3 3-3Zm6 6 3 3-3 3-3-3 3-3Zm-12 0 3 3-3 3-3-3 3-3Zm6 6 3 3-3 3-3-3 3-3Z" /></Show>
    <Show when={props.kind === "button"}><rect x="3.5" y="6" width="17" height="12" rx="4" /><path d="M8 12h8" /></Show>
    <Show when={props.kind === "input"}><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="M7 12h7" /></Show>
    <Show when={props.kind === "checkbox"}><rect x="4.5" y="4.5" width="15" height="15" rx="3" /><path d="m8 12 2.5 2.5L16 9" /></Show>
  </svg>;
}

function ToolIcon(props: { tool: Tool }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <Show when={props.tool === "select"}><path d="M5 3 18 15l-5 1-2 5L5 3Z" /></Show>
    <Show when={props.tool === "hand"}><path d="M8 11V5a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v6c0 4-2 6-6 6h-2c-2 0-3-.8-4-2l-3-4a1.5 1.5 0 0 1 2-2l2 2" /></Show>
    <Show when={props.tool === "frame"}><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M8 8h8v8H8z" stroke-dasharray="2 2" /></Show>
    <Show when={props.tool === "rectangle"}><rect x="4" y="5" width="16" height="14" rx="1.5" /></Show>
    <Show when={props.tool === "ellipse"}><circle cx="12" cy="12" r="8" /></Show>
    <Show when={props.tool === "line"}><path d="M5 19 19 5" /><circle cx="5" cy="19" r="1" /><circle cx="19" cy="5" r="1" /></Show>
    <Show when={props.tool === "path"}><path d="M4 18c3-9 7-12 10-9s4 3 6-3" /><circle cx="4" cy="18" r="1.5" /><circle cx="20" cy="6" r="1.5" /></Show>
    <Show when={props.tool === "text"}><path d="M5 5h14M12 5v14m-4 0h8" /></Show>
    <Show when={props.tool === "button"}><rect x="3.5" y="6" width="17" height="12" rx="4" /><path d="M8 12h8" /></Show>
    <Show when={props.tool === "input"}><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="M7 12h7" /></Show>
    <Show when={props.tool === "checkbox"}><rect x="4.5" y="4.5" width="15" height="15" rx="3" /><path d="m8 12 2.5 2.5L16 9" /></Show>
    <Show when={props.tool === "image"}><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><circle cx="9" cy="9" r="1.5" /><path d="m5 17 5-5 3 3 2-2 4 4" /></Show>
  </svg>;
}

function NodeView(props: { node: UIElement; parentIsPage: boolean; selected: boolean; editing: boolean; interactive: boolean; root?: boolean; visualKind?: UIElementKind; fillOverride?: () => string | undefined; strokeOverride?: () => string | undefined; radiusOverride?: () => number | undefined; effectOverride?: () => string | undefined; typographyOverride?: () => UITypographyStyle | undefined; renderChildren: (parentId: string) => JSX.Element; onDown: (event: PointerEvent, node: UIElement) => void; onResize: (event: PointerEvent, node: UIElement, handle: string) => void; onDouble: (node: UIElement) => void; onText: (node: UIElement, text: string) => void; onInteraction: (interaction: UIInteraction) => void; onPointDown: (event: PointerEvent, node: UIElement, point: number, side?: "anchor" | "in" | "out") => void }) {
  const node = () => props.node;
  const visualKind = () => props.visualKind ?? node().kind;
  const textLike = () => ["text", "button", "input", "checkbox"].includes(visualKind());
  const fill = () => props.fillOverride?.() ?? node().fill;
  const stroke = () => props.strokeOverride?.() ?? node().stroke;
  const radius = () => props.radiusOverride?.() ?? node().radius;
  const typography = () => props.typographyOverride?.();
  const shadow = () => safeBoxShadow(props.effectOverride?.() || node().effectValue || (node().shadow === "soft" ? "0 5px 16px #26354d20" : node().shadow === "strong" ? "0 12px 30px #26354d40" : "none"));
  const gradient = () => node().fillGradient ? `linear-gradient(${node().fillGradient!.angle}deg, ${node().fillGradient!.from}, ${node().fillGradient!.to})` : fill();
  const style = (): JSX.CSSProperties => ({ left: `${props.root ? 0 : node().x}px`, top: `${props.root ? 0 : node().y}px`, width: `${node().width}px`, height: `${node().height}px`, transform: `rotate(${props.root ? 0 : node().rotation}deg)`, "--node-fill": fill(), "--node-text": readableTextColor(fill()), "--node-stroke": stroke() === "none" ? "transparent" : stroke(), "--node-stroke-width": `${node().strokeWidth}px`, "--node-stroke-style": node().strokeStyle, "--node-radius": `${radius()}px`, background: gradient(), opacity: node().opacity, "font-family": fontStacks[typography()?.fontFamily ?? node().fontFamily], "font-size": `${typography()?.fontSize ?? node().fontSize}px`, "font-weight": typography()?.fontWeight ?? node().fontWeight, "line-height": typography()?.lineHeight ?? node().lineHeight, "letter-spacing": `${typography()?.letterSpacing ?? node().letterSpacing}px`, "text-align": node().textAlign, "box-shadow": visualKind() === "frame" ? "none" : shadow() });
  const frameClass = () => visualKind() === "frame" ? props.parentIsPage && node().frameType === "screen" ? "node-screen-frame" : "node-container-frame" : "";
  const onTrigger = (trigger: UIInteraction["trigger"]) => { if (props.interactive) for (const interaction of node().interactions.filter(item => item.trigger === trigger)) props.onInteraction(interaction); };
  return <div class={`ui-node kind-${visualKind()} ${frameClass()} ${props.selected ? "is-selected" : ""} ${node().hidden ? "is-hidden" : ""} ${node().locked ? "is-locked" : ""} ${props.interactive ? "is-preview" : ""}`} data-node-id={node().id} style={style()} aria-label={node().name} title={node().name}
    onPointerDown={event => { if (props.interactive) { event.stopPropagation(); onTrigger("press"); return; } event.stopPropagation(); props.onDown(event, node()); }}
    onPointerEnter={() => onTrigger("hover")}
    onClick={event => { if (props.interactive) { event.stopPropagation(); onTrigger("click"); } }}
    onDblClick={event => { event.stopPropagation(); if (!props.interactive) props.onDouble(node()); }}>
     <Show when={visualKind() === "frame"}><div class="ui-frame-surface" style={{ background: props.parentIsPage ? fill() : "transparent", border: props.parentIsPage && stroke() !== "none" ? `${node().strokeWidth}px ${node().strokeStyle} ${stroke()}` : "none", "border-radius": `${radius()}px`, overflow: node().clipContent ? "hidden" : "visible", "box-shadow": shadow() }} /><Show when={props.parentIsPage && !props.interactive}><div class="ui-frame-label" onPointerDown={event => { if (props.interactive) return; event.stopPropagation(); props.onDown(event, node()); }}>{node().name}<small>{round(node().width)} × {round(node().height)}</small></div></Show></Show>
     <Show when={visualKind() === "image"}><Show when={node().imageData} fallback={<span class="ui-image-empty">{node().text || "Place image"}</span>}><img src={node().imageData} alt={node().text || node().name} draggable="false" style={{ "object-fit": node().imageFit, "object-position": `${node().imageCrop.x * 100}% ${node().imageCrop.y * 100}%`, width: `${node().imageCrop.width * 100}%`, height: `${node().imageCrop.height * 100}%` }} /></Show></Show>
      <Show when={visualKind() === "path"}><svg class="ui-path-svg" viewBox={`0 0 ${node().width} ${node().height}`} preserveAspectRatio="none" aria-hidden="true"><defs><Show when={node().fillGradient}><linearGradient id={`gradient-${node().id}`} gradientTransform={`rotate(${node().fillGradient!.angle})`}><stop offset="0%" stop-color={node().fillGradient!.from} /><stop offset="100%" stop-color={node().fillGradient!.to} /></linearGradient></Show></defs><path d={vectorPath(node().pathPoints, node().width, node().height)} fill={node().fillGradient ? `url(#gradient-${node().id})` : fill()} stroke={stroke() === "none" ? "transparent" : stroke()} stroke-width={node().strokeWidth} stroke-dasharray={node().strokeStyle === "dashed" ? "6 4" : node().strokeStyle === "dotted" ? "1 4" : undefined} stroke-linecap="round" stroke-linejoin="round" /></svg></Show>
    <Show when={textLike()}><Show when={props.editing} fallback={<span class="ui-node-text">{node().text}</span>}><textarea class="ui-inline-editor" value={node().text} aria-label={`Edit ${node().name}`} onPointerDown={event => event.stopPropagation()} onInput={event => props.onText(node(), event.currentTarget.value)} onBlur={() => props.onText(node(), node().text)} /></Show></Show>
     <Show when={visualKind() === "checkbox"}><span class="ui-checkbox-mark" /></Show>
     <Show when={visualKind() === "frame" || visualKind() === "group" || node().kind === "componentInstance"}><div class="ui-node-children" style={{ overflow: (node().clipContent || node().mask || node().autoLayout.enabled && node().autoLayout.clip) ? "hidden" : "visible", "border-radius": node().clipContent || node().mask || node().autoLayout.enabled && node().autoLayout.clip ? `${radius()}px` : undefined, "clip-path": node().mask && node().kind === "ellipse" ? "ellipse(50% 50% at 50% 50%)" : undefined }}>{props.renderChildren(node().id)}</div></Show>
    <Show when={props.selected && !props.interactive && !node().locked}><div class="ui-node-selection" aria-hidden="true" /><For each={["nw", "n", "ne", "e", "se", "s", "sw", "w"]}>{handle => <button type="button" class={`ui-resize-handle handle-${handle}`} aria-label={`Resize ${node().name} ${handle}`} onPointerDown={event => { event.stopPropagation(); props.onResize(event, node(), handle); }} />}</For></Show>
     <Show when={props.selected && node().kind === "path" && !props.interactive}><svg class="ui-path-handle-lines" viewBox={`0 0 ${node().width} ${node().height}`} preserveAspectRatio="none" aria-hidden="true"><For each={node().pathPoints}>{point => <><Show when={point.inX !== undefined || point.inY !== undefined}><line x1={point.x * node().width} y1={point.y * node().height} x2={(point.inX ?? point.x) * node().width} y2={(point.inY ?? point.y) * node().height} /></Show><Show when={point.outX !== undefined || point.outY !== undefined}><line x1={point.x * node().width} y1={point.y * node().height} x2={(point.outX ?? point.x) * node().width} y2={(point.outY ?? point.y) * node().height} /></Show></>}</For></svg><For each={node().pathPoints}>{(point, index) => <><button class="ui-path-point" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} aria-label={`Edit vector point ${index() + 1}`} onPointerDown={event => { event.stopPropagation(); props.onPointDown(event, node(), index(), "anchor"); }} /><Show when={point.inX !== undefined || point.inY !== undefined}><button class="ui-path-handle" style={{ left: `${(point.inX ?? point.x) * 100}%`, top: `${(point.inY ?? point.y) * 100}%` }} aria-label={`Edit incoming Bézier handle ${index() + 1}`} onPointerDown={event => { event.stopPropagation(); props.onPointDown(event, node(), index(), "in"); }} /></Show><Show when={point.outX !== undefined || point.outY !== undefined}><button class="ui-path-handle" style={{ left: `${(point.outX ?? point.x) * 100}%`, top: `${(point.outY ?? point.y) * 100}%` }} aria-label={`Edit outgoing Bézier handle ${index() + 1}`} onPointerDown={event => { event.stopPropagation(); props.onPointDown(event, node(), index(), "out"); }} /></Show></>}</For></Show>
  </div>;
}

function UiDesignHome(props: Props) {
  return <section class="ui-design-home" aria-label="UI Design home"><div class="ui-home-inner">
    <header class="ui-home-header"><div class="ui-home-brand"><span class="ui-product-mark">U</span><div><strong>SketchDraw</strong><span>UI DESIGN</span></div></div><span class="ui-home-local"><i /> Local design workspace</span></header>
    <main class="ui-home-main"><section class="ui-home-hero"><div class="ui-home-copy"><p class="ui-home-eyebrow">A workspace for interface design</p><h1>Shape ideas into<br /><em>real interfaces.</em></h1><p>Create responsive screens, reusable components, and interactive prototypes on an open canvas.</p><div class="ui-home-actions"><button class="ui-home-primary" onClick={() => props.session.create()}>＋ Create a design</button><button class="ui-home-secondary" onClick={() => void props.session.open()}>Open .sdui file</button></div><p class="ui-home-file-note">Portable <strong>.sdui</strong> files stay in folders you choose.</p></div><div class="ui-home-preview" aria-hidden="true"><div class="home-preview-toolbar"><span>Untitled interface</span><span>100%</span></div><div class="home-preview-art"><i /><i /><b /><span /><span /><strong /></div><div class="home-preview-caption">Design screens. Connect the flow.</div></div></section>
      <Show when={props.session.recoveryAvailable()}><section class="ui-recovery-card" role="status"><span>Unsaved draft found</span><button onClick={() => props.session.restoreRecovery()}>Restore draft</button><button onClick={() => props.session.dismissRecovery()}>Discard</button></section></Show>
      <section class="ui-recent-section"><header><div><p>YOUR WORKSPACE</p><h2>Recent designs</h2></div><span>{props.session.recentPaths().length}</span></header><Show when={props.session.recentPaths().length > 0} fallback={<div class="ui-empty-state"><strong>Your designs will appear here</strong><p>Open a .sdui file to add it to recent designs.</p></div>}><For each={props.session.recentPaths()}>{path => <button class="ui-recent-row" onClick={() => void props.session.openRecent(path)}><span class="ui-file-mark">U</span><span>{props.session.recentDisplayName(path)}</span><small>Open →</small></button>}</For></Show></section>
      <Show when={props.session.hasDocument()}><button class="ui-continue-button" onClick={() => props.session.continueEditing()}>Continue editing current design</button></Show><Show when={props.session.error()}><p class="ui-home-error" role="alert">{props.session.error()}</p></Show>
    </main><footer class="ui-home-footer"><span><i /> Private by design</span><span>Saved on your device</span><span>UI Design · .sdui</span></footer></div></section>;
}

function UiDesignEditor(props: Props) {
  const [tool, setTool] = createSignal<Tool>("select");
  const [selectedIds, setSelectedIds] = createSignal<string[]>([]);
  const [camera, setCamera] = createSignal<Camera>({ x: 0, y: 0, zoom: 0.8 });
  const [stageSize, setStageSize] = createSignal({ width: 0, height: 0 });
  const [gesture, setGesture] = createSignal<Gesture>();
  const [leftTab, setLeftTab] = createSignal<"pages" | "layers" | "assets">("pages");
  const [rightTab, setRightTab] = createSignal<InspectorTab>("design");
  const [rightPanelOpen, setRightPanelOpen] = createSignal(true);
  const [layerSearch, setLayerSearch] = createSignal("");
  const [assetSearch, setAssetSearch] = createSignal("");
  const [collapsed, setCollapsed] = createSignal<Set<string>>(new Set());
  const [inspectorSections, setInspectorSections] = createSignal(new Set(["position", "frame", "frame-preview", "layout", "appearance", "text", "prototype", "image", "component", "component-child-overrides", "reusable-component", "responsive-breakpoints", "styles-library"]));
  const [framePresetOpen, setFramePresetOpen] = createSignal(false);
  const [framePresetPosition, setFramePresetPosition] = createSignal({ left: 0, top: 0 });
  const [frameMoveArmed, setFrameMoveArmed] = createSignal("");
  const [guidesMenuOpen, setGuidesMenuOpen] = createSignal(false);
  const [guidesMenuPosition, setGuidesMenuPosition] = createSignal({ left: 8, top: 48 });
  const [hoveredNodeId, setHoveredNodeId] = createSignal("");
  const [altHeld, setAltHeld] = createSignal(false);
  const [snapLines, setSnapLines] = createSignal<UIAlignmentLine[]>([]);
  const [editingId, setEditingId] = createSignal("");
  const [dragIds, setDragIds] = createSignal<string[]>([]);
  const [layerDrop, setLayerDrop] = createSignal<{ targetId?: string; position: HierarchyDropPosition }>();
  let activeLayerDragIds: string[] = [];
  const [connectSource, setConnectSource] = createSignal("");
  const [preview, setPreview] = createSignal(false);
  const [responsivePreviewOpen, setResponsivePreviewOpen] = createSignal(false);
  const [previewPageId, setPreviewPageId] = createSignal("");
  const [previewNodeId, setPreviewNodeId] = createSignal("");
  const [previewHistory, setPreviewHistory] = createSignal<Array<{ pageId: string; nodeId: string }>>([]);
  const [previewOverlay, setPreviewOverlay] = createSignal<{ pageId: string; nodeId: string; position: "center" | "top" | "bottom"; background: string; opacity: number; closeOnOutside: boolean }>();
  const [previewTransition, setPreviewTransition] = createSignal<UIInteraction["transition"]>("instant");
  const [previewVariables, setPreviewVariables] = createSignal<Record<string, string | number | boolean>>({});
  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number; world: { x: number; y: number }; nodeId?: string; selectionIds: string[] }>();
  const [message, setMessage] = createSignal("");
  const [findOpen, setFindOpen] = createSignal(false);
  const [findQuery, setFindQuery] = createSignal("");
  const [replaceQuery, setReplaceQuery] = createSignal("");
  const toggleInspectorSection = (id: string) => setInspectorSections(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  let stage: HTMLDivElement | undefined;
  let activeGesture: Gesture | undefined;
  let spaceHeld = false;
  let imageInput: HTMLInputElement | undefined;
  let tokenInput: HTMLInputElement | undefined;
  let componentLibraryInput: HTMLInputElement | undefined;

  const document = () => props.session.document();
  const page = () => document().pages.find(item => item.id === document().activePageId) ?? document().pages[0];
  const hierarchy = createMemo(() => new UIHierarchyIndex<UIElement>(page().id, page().elements));
  const pageRoots = () => hierarchy().children(page().id);
  const selected = () => selectedIds().map(id => hierarchy().get(id)).filter((node): node is UIElement => !!node);
  const selectedOne = () => selected().length === 1 ? selected()[0] : undefined;
  const matchingAssets = () => assets.filter(asset => !assetSearch().trim() || asset.name.toLowerCase().includes(assetSearch().trim().toLowerCase()));
  const matchingComponents = () => document().components.filter(component => {
    const library = document().assetLibraries.find(item => item.assetIds.includes(component.id));
    return (!library || library.enabled) && (!assetSearch().trim() || component.name.toLowerCase().includes(assetSearch().trim().toLowerCase()));
  });
  const assetCategories = () => ["Basics", "Controls", "Forms", "Navigation", "Patterns", "Data"].filter(category => matchingAssets().some(asset => asset.category === category));
  const zoomLabel = () => `${round(camera().zoom * 100)}%`;
  const rootsOnly = (ids: string[]) => {
    const unique = [...new Set(ids)]; const selectedSet = new Set(unique);
    return unique.filter(id => !!hierarchy().get(id) && !hierarchy().hasSelectedAncestor(id, selectedSet));
  };
  const isEffectively = (node: UIElement, key: "hidden" | "locked") => node[key] || hierarchy().ancestors(node.id).some(parent => parent[key]);
  const displayNodes = createMemo(() => hierarchy().flatten().filter(node => !isEffectively(node, "hidden")));
  const topVisible = createMemo(() => pageRoots().filter(node => !isEffectively(node, "hidden")));
  const worldBounds = (node: UIElement) => hierarchy().worldBounds(node.id);
  const selectedBounds = () => unionRects(rootsOnly(selectedIds()).flatMap(id => { const node = hierarchy().get(id), bounds = node && worldBounds(node); return bounds ? [bounds] : []; }));
  const snapTargetsFor = (ids: string[]): UISnapTarget[] => {
    const excluded = new Set(ids.flatMap(id => [id, ...hierarchy().descendants(id).map(node => node.id)]));
    return displayNodes().filter(node => !excluded.has(node.id) && node.kind !== "group").flatMap(node => { const bounds = worldBounds(node); return bounds ? [{ id: node.id, parentId: node.parentId, bounds }] : []; });
  };
  const measurements = createMemo<UIDistanceMeasure[]>(() => {
    const settings = document().guideSettings;
    const active = gesture();
    if (!settings.enabled || !settings.measurements || (!altHeld() && !["move", "resize"].includes(active?.kind ?? ""))) return [];
    const selectedRoots = rootsOnly(selectedIds());
    const bounds = selectedBounds();
    if (!bounds || !selectedRoots.length) return [];
    const selectedRects = selectedRoots.flatMap(id => { const node = hierarchy().get(id), rect = node && worldBounds(node); return rect ? [rect] : []; });
    const ancestors = hierarchy().ancestors(selectedRoots[0]);
    const frame = ancestors.find(candidate => candidate.kind === "frame" && selectedRoots.every(id => hierarchy().ancestors(id).some(parent => parent.id === candidate.id)));
    const frameBounds = frame && worldBounds(frame);
    const frameMeasures = frameBounds ? measureFrameEdges(bounds, frameBounds) : [];
    const hovered = hoveredNodeId() ? hierarchy().get(hoveredNodeId()) : undefined;
    if (altHeld() && hovered && !selectedRoots.includes(hovered.id) && !isEffectively(hovered, "hidden")) {
      const hoveredBounds = worldBounds(hovered);
      if (hoveredBounds) {
        const containsSelection = hovered.kind === "frame" && selectedRoots.every(id => hierarchy().ancestors(id).some(parent => parent.id === hovered.id));
        return containsSelection ? measureFrameEdges(bounds, hoveredBounds) : measureRectDistances(bounds, hoveredBounds);
      }
    }
    if (selectedRects.length > 1) {
      const spacing = measureMultipleSpacing(selectedRects);
      if (active?.kind === "move" || active?.kind === "resize") {
        let nearestX: UIDistanceMeasure | undefined;
        let nearestY: UIDistanceMeasure | undefined;
        for (const target of active.snapTargets) for (const measure of measureRectDistances(bounds, target.bounds)) {
          if (measure.axis === "x" && (!nearestX || measure.value < nearestX.value)) nearestX = measure;
          if (measure.axis === "y" && (!nearestY || measure.value < nearestY.value)) nearestY = measure;
        }
        const nearestByAxis = [nearestX, nearestY].filter((measure): measure is UIDistanceMeasure => !!measure);
        return [...frameMeasures, ...spacing, ...nearestByAxis];
      }
      return spacing;
    }
    if (active?.kind === "move" || active?.kind === "resize") {
      const targets = active.snapTargets.map(target => target.bounds);
      let nearestX: UIDistanceMeasure | undefined;
      let nearestY: UIDistanceMeasure | undefined;
      for (const target of targets) for (const measure of measureRectDistances(bounds, target)) {
        if (measure.axis === "x" && (!nearestX || measure.value < nearestX.value)) nearestX = measure;
        if (measure.axis === "y" && (!nearestY || measure.value < nearestY.value)) nearestY = measure;
      }
      const nearestByAxis = [nearestX, nearestY].filter((measure): measure is UIDistanceMeasure => !!measure);
      return [...frameMeasures, ...nearestByAxis];
    }
    if (frameMeasures.length) return frameMeasures;
    return [];
  });
  const screenPoint = (x: number, y: number) => ({ x: camera().x + x * camera().zoom, y: camera().y + y * camera().zoom });
  const cameraWorld = (event: { clientX: number; clientY: number }) => { const rect = stage?.getBoundingClientRect(); return rect ? { x: (event.clientX - rect.left - camera().x) / camera().zoom, y: (event.clientY - rect.top - camera().y) / camera().zoom } : { x: 0, y: 0 }; };
  const viewportCenterWorld = () => { const rect = stage?.getBoundingClientRect(); return rect ? { x: (stage!.clientWidth / 2 - camera().x) / camera().zoom, y: (stage!.clientHeight / 2 - camera().y) / camera().zoom } : { x: 0, y: 0 }; };
  const insertionParentAt = (point = viewportCenterWorld()) => {
    const selectedNode = selectedOne();
    const selectedContainer = selectedNode
      ? [selectedNode, ...hierarchy().ancestors(selectedNode.id)].find(node => ["frame", "group", "componentInstance"].includes(node.kind))
      : undefined;
    const containingFrame = displayNodes()
      .filter(node => node.kind === "frame")
      .map(node => ({ node, bounds: worldBounds(node) }))
      .filter((item): item is { node: UIElement; bounds: UIRect } => !!item.bounds && point.x >= item.bounds.x && point.x <= item.bounds.x + item.bounds.width && point.y >= item.bounds.y && point.y <= item.bounds.y + item.bounds.height)
      .sort((a, b) => a.bounds.width * a.bounds.height - b.bounds.width * b.bounds.height)[0]?.node;
    const selectedParent = selectedNode?.parentId ? hierarchy().get(selectedNode.parentId) : undefined;
    const parentId = selectedContainer?.id
      ?? (selectedParent && ["frame", "group", "componentInstance"].includes(selectedParent.kind) ? selectedParent.id : undefined)
      ?? containingFrame?.id
      ?? page().id;
    return { parentId, point: parentId === page().id ? point : hierarchy().worldToLocal(parentId, point) ?? point };
  };
  const addMessage = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(""), 2600); };
  const updateDocument = (mutate: (current: UIDesignDocument) => UIDesignDocument, key?: string) => props.session.update(mutate(document()), key);
  const updatePage = (mutate: (current: UIPage) => UIPage, key?: string) => updateDocument(doc => ({ ...doc, pages: doc.pages.map(item => item.id === page().id ? mutate(item) : item) }), key);
  const updateGuideSettings = (patch: Partial<UIGuideSettings>) => updateDocument(doc => ({ ...doc, guideSettings: { ...doc.guideSettings, ...patch } }), "guide-settings");
  const addManualGuide = (axis: "x" | "y", position: number) => {
    if (!Number.isFinite(position) || page().guides.length >= 256) return;
    const guide: UIManualGuide = { id: createUIDesignId("guide"), axis, position: round(clamp(position, -1e7, 1e7)), visible: true, locked: false };
    updatePage(current => ({ ...current, guides: [...current.guides, guide] }), "guide-add");
  };
  const updateManualGuide = (id: string, patch: Partial<UIManualGuide>) => updatePage(current => ({ ...current, guides: current.guides.map(guide => guide.id === id ? { ...guide, ...patch, position: patch.position === undefined ? guide.position : round(clamp(patch.position, -1e7, 1e7)) } : guide) }), `guide:${id}`);
  const removeManualGuide = (id: string) => updatePage(current => ({ ...current, guides: current.guides.filter(guide => guide.id !== id || guide.locked) }), `guide-remove:${id}`);
  const addCenteredGuide = (axis: "x" | "y") => {
    const bounds = selectedBounds(); const center = bounds ? axis === "x" ? bounds.x + bounds.width / 2 : bounds.y + bounds.height / 2 : axis === "x" ? viewportCenterWorld().x : viewportCenterWorld().y;
    addManualGuide(axis, center);
  };
  const addContextGuide = (axis: "x" | "y") => {
    const menu = contextMenu(); if (!menu) return;
    addManualGuide(axis, axis === "x" ? menu.world.x : menu.world.y);
    setContextMenu(undefined);
  };
  const updateResponsiveBreakpoints = (breakpoints: UIResponsiveBreakpoint[]) => {
    const sorted = [...breakpoints].sort((a, b) => a.minWidth - b.minWidth);
    if (sorted.some((item, index) => !item.name.trim() || item.maxWidth !== undefined && item.maxWidth < item.minWidth || index > 0 && (sorted[index - 1].maxWidth === undefined || sorted[index - 1].maxWidth! >= item.minWidth)) || new Set(sorted.map(item => item.name.trim().toLocaleLowerCase())).size !== sorted.length) {
      setMessage("Breakpoint names and width ranges must be unique and non-overlapping."); return;
    }
    updateDocument(current => {
      const activeIds = new Set(sorted.map(item => item.id));
      const removedIds = new Set(current.responsiveBreakpoints.filter(item => !activeIds.has(item.id)).map(item => item.id));
      return { ...current, responsiveBreakpoints: sorted, pages: current.pages.map(item => ({ ...item, elements: item.elements.map(node => {
        if (!removedIds.size) return node;
        const responsiveOverrides = Object.fromEntries(Object.entries(node.responsiveOverrides).filter(([id]) => !removedIds.has(id)));
        return { ...node, responsiveOverrides };
      }) })) };
    });
  };
  const reflowDocument = (doc: UIDesignDocument): UIDesignDocument => ({
    ...doc,
    pages: doc.pages.map(item => {
      const arranged = applyAutoLayout(item, doc.spacingTokens, doc.activeColorModeId);
      return { ...arranged, elements: fitGroupBounds(item.id, arranged.elements) };
    }),
  });
  const updateNodes = (mutate: (nodes: UIElement[]) => UIElement[], key?: string, layout = true) => updateDocument(doc => {
    const current = doc.pages.find(item => item.id === doc.activePageId) ?? doc.pages[0];
    const next = [...new Map(mutate(current.elements).map(node => [node.id, node])).values()];
    const arranged = layout ? applyAutoLayout({ ...current, elements: next }, doc.spacingTokens, doc.activeColorModeId).elements : next;
    const changedPage = { ...current, elements: fitGroupBounds(current.id, arranged) };
    const updated = { ...doc, pages: doc.pages.map(item => item.id === current.id ? changedPage : item) };
    return reflowDocument(synchronizeComponentMasters(updated));
  }, key);
  const updateNode = (id: string, patch: Partial<UIElement>, key?: string) => updateNodes(nodes => {
    const target = nodes.find(node => node.id === id); if (!target) return nodes;
    const currentIndex = hierarchy();
    const ancestors = currentIndex.ancestors(id);
    const containingInstance = ancestors.find(parent => parent.kind === "componentInstance");
    const insideComponentMaster = ancestors.some(parent => parent.kind !== "componentInstance" && !!parent.componentId);
    const instanceRoot = containingInstance ?? (target.kind === "componentInstance" && !insideComponentMaster ? target : undefined);
    const effectivePatch = instanceRoot ? withComponentOverrides(target, patch, target.id === instanceRoot.id) : patch;
    let next = nodes.map(node => node.id === id ? { ...node, ...effectivePatch } : node);
    if (target.kind === "frame" && (patch.width !== undefined || patch.height !== undefined)) next = resizeFrameChildren(next, id, { width: target.width, height: target.height }, { width: patch.width ?? target.width, height: patch.height ?? target.height });
    return next;
  }, key);
  const updateField = <K extends keyof UIElement>(node: UIElement, key: K, value: UIElement[K], historyKey = String(key)) => updateNode(node.id, { [key]: value } as Pick<UIElement, K>, historyKey);

  const zoomAt = (clientX: number, clientY: number, nextZoom: number) => {
    const rect = stage?.getBoundingClientRect(); if (!rect) return;
    const old = camera(); const localX = clientX - rect.left; const localY = clientY - rect.top;
    const worldX = (localX - old.x) / old.zoom; const worldY = (localY - old.y) / old.zoom;
    const zoom = clamp(nextZoom, 0.08, 5);
    setCamera({ x: localX - worldX * zoom, y: localY - worldY * zoom, zoom });
  };
  const fitContent = (nodes = topVisible()) => {
    if (!stage || !nodes.length) { if (stage) setCamera({ x: stage.clientWidth / 2, y: stage.clientHeight / 2, zoom: 0.8 }); return; }
    const bounds = unionRects(nodes.map(node => worldBounds(node)).filter((rect): rect is UIRect => !!rect)); if (!bounds) return;
    const margin = 96; const zoom = clamp(Math.min((stage.clientWidth - margin * 2) / Math.max(1, bounds.width), (stage.clientHeight - margin * 2) / Math.max(1, bounds.height)), 0.08, 2.5);
    setCamera({ x: (stage.clientWidth - bounds.width * zoom) / 2 - bounds.x * zoom, y: (stage.clientHeight - bounds.height * zoom) / 2 - bounds.y * zoom, zoom });
  };
  const setPage = (id: string) => { if (!document().pages.some(item => item.id === id)) return; updateDocument(doc => ({ ...doc, activePageId: id })); setSelectedIds([]); setConnectSource(""); };

  const selectNode = (node: UIElement, additive = false) => {
    if (isEffectively(node, "hidden") || isEffectively(node, "locked")) return;
    setSelectedIds(current => additive ? current.includes(node.id) ? current.filter(id => id !== node.id) : [...current, node.id] : [node.id]);
    setFrameMoveArmed(node.kind === "frame" && !additive ? node.id : "");
  };
  const openContextMenu = (event: MouseEvent, explicitNode?: UIElement) => {
    const target = event.target instanceof Element ? event.target : undefined;
    if (target?.closest("input,textarea,select,[contenteditable='true']")) return;
    event.preventDefault();
    const nodeElement = target?.closest<HTMLElement>(".ui-node[data-node-id]");
    const node = explicitNode ?? (nodeElement ? hierarchy().get(nodeElement.dataset.nodeId ?? "") : undefined);
    const alreadySelected = !!node && selectedIds().includes(node.id);
    if (node && !alreadySelected) setSelectedIds([node.id]);
    if (node) setFrameMoveArmed(node.kind === "frame" ? node.id : "");
    const selectionIds = node ? alreadySelected ? selectedIds() : [node.id] : selectedIds();
    const bounds = node ? worldBounds(node) : undefined;
    const world = bounds && explicitNode ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 } : cameraWorld(event);
    setContextMenu({ x: event.clientX, y: event.clientY, world, nodeId: node?.id, selectionIds });
  };
  const contextTarget = () => { const id = contextMenu()?.nodeId; return id ? hierarchy().get(id) : undefined; };
  const contextNodes = () => (contextMenu()?.selectionIds ?? []).map(id => hierarchy().get(id)).filter((node): node is UIElement => !!node);
  const contextRoots = () => rootsOnly(contextMenu()?.selectionIds ?? []);
  const contextCanEdit = () => contextNodes().length > 0 && contextNodes().every(node => !isEffectively(node, "locked"));
  const contextAncestorsUnlocked = () => contextNodes().length > 0 && contextNodes().every(node => !hierarchy().ancestors(node.id).some(parent => parent.locked));
  const contextMenuPosition = () => {
    const menu = contextMenu(); if (!menu) return {};
    const width = 260; const height = Math.min(window.innerHeight * 0.78, 560);
    return { left: `${Math.max(8, Math.min(menu.x, window.innerWidth - width - 8))}px`, top: `${Math.max(8, Math.min(menu.y, window.innerHeight - height - 8))}px` };
  };
  const runContextAction = (action: (target: UIElement | undefined, menu: NonNullable<ReturnType<typeof contextMenu>>) => void) => {
    const menu = contextMenu(); if (!menu) return;
    const target = menu.nodeId ? hierarchy().get(menu.nodeId) : undefined;
    setSelectedIds(menu.selectionIds); setContextMenu(undefined); action(target, menu);
  };
  const addContextChild = (kind: Tool) => runContextAction((target, menu) => {
    if (!target || !["frame", "group", "componentInstance"].includes(target.kind) || isEffectively(target, "locked")) return;
    createAt(kind, menu.world, undefined, target.id); setLeftTab("layers");
  });
  const addContextNode = (kind: Tool) => runContextAction((target, menu) => {
    if (target && isEffectively(target, "locked")) return;
    const parentId = target && ["frame", "group", "componentInstance"].includes(target.kind) ? target.id : target?.parentId ?? page().id;
    createAt(kind, menu.world, undefined, parentId); setLeftTab("layers");
  });
  const addContextFrame = (presetId: UIFramePresetId) => runContextAction((target, menu) => {
    const parentId = target && ["frame", "group", "componentInstance"].includes(target.kind) && !isEffectively(target, "locked") ? target.id : target?.parentId ?? page().id;
    const preset = UI_FRAME_PRESETS.find(item => item.id === presetId) ?? UI_FRAME_PRESETS[0];
    const point = parentId === page().id ? menu.world : hierarchy().worldToLocal(parentId, menu.world) ?? menu.world;
    const frame = createUIFrame(hierarchy().children(parentId).length, point, parentId, preset.id);
    if (preset.id === "custom") {
      const width = Number(window.prompt("Frame width in pixels", "800")); if (!Number.isFinite(width) || width < 1) return;
      const height = Number(window.prompt("Frame height in pixels", "600")); if (!Number.isFinite(height) || height < 1) return;
      frame.width = round(clamp(width, 1, 10000)); frame.height = round(clamp(height, 1, 10000));
    }
    updateNodes(nodes => [...nodes, frame], undefined, false); setSelectedIds([frame.id]); setTool("select"); setLeftTab("layers");
  });
  const toggleContextFlag = (key: "hidden" | "locked") => runContextAction((_target, menu) => {
    const ids = rootsOnly(menu.selectionIds); if (!ids.length) return;
    const nodes = ids.map(id => hierarchy().get(id)).filter((node): node is UIElement => !!node);
    const value = !nodes.every(node => node[key]);
    updateNodes(items => items.map(node => ids.includes(node.id) ? { ...node, [key]: value } : node), undefined, false);
  });
  createEffect(() => {
    if (!contextMenu()) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : undefined;
      if (!target?.closest(".ui-context-menu")) setContextMenu(undefined);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); setContextMenu(undefined); } };
    window.addEventListener("pointerdown", dismiss, true); window.addEventListener("keydown", escape, true);
    onCleanup(() => { window.removeEventListener("pointerdown", dismiss, true); window.removeEventListener("keydown", escape, true); });
  });
  const startPan = (event: PointerEvent) => {
    const value: Gesture = { kind: "pan", pointer: event.pointerId, clientX: event.clientX, clientY: event.clientY, camera: camera() };
    activeGesture = value; setGesture(value); stage?.setPointerCapture(event.pointerId);
  };
  const connectToFrame = (node: UIElement) => {
    const sourceId = connectSource();
    if (!sourceId || node.kind !== "frame" || node.id === sourceId) return false;
    const source = hierarchy().get(sourceId);
    if (source) updateNode(source.id, { interactions: [...source.interactions, { id: createUIDesignId("interaction"), name: "Navigate to screen", trigger: "click", action: "navigate", targetNodeId: node.id, transition: "instant" }] });
    addMessage(`Linked ${source?.name ?? "element"} to ${node.name}`);
    setConnectSource(""); setSelectedIds([node.id]);
    return true;
  };
  const startMove = (event: PointerEvent, node: UIElement) => {
    if (connectSource()) {
      connectToFrame(node);
      return;
    }
    if (node.kind === "frame" && frameMoveArmed() !== node.id) return;
    if (node.kind !== "frame" || frameMoveArmed() !== node.id) setFrameMoveArmed("");
    if (isEffectively(node, "locked")) return;
    if (!selectedIds().includes(node.id)) setSelectedIds(event.shiftKey ? [...selectedIds(), node.id] : [node.id]);
    const ids = rootsOnly(selectedIds().includes(node.id) ? selectedIds() : event.shiftKey ? [...selectedIds(), node.id] : [node.id]);
    const originals = ids.map(id => hierarchy().get(id)).filter((item): item is UIElement => !!item && !isEffectively(item, "locked"));
    const index = hierarchy();
    const worldStarts = originals.flatMap(item => { const transform = index.worldTransform(item.id); return transform ? [{ id: item.id, x: transform.x, y: transform.y }] : []; });
    const startBounds = unionRects(originals.flatMap(item => { const bounds = index.worldBounds(item.id); return bounds ? [bounds] : []; }));
    if (!startBounds) return;
    const spacingParentId = originals.length && originals.every(item => item.parentId === originals[0].parentId) ? originals[0].parentId : undefined;
    const value: Gesture = { kind: "move", pointer: event.pointerId, start: cameraWorld(event), ids: originals.map(item => item.id), originals, worldStarts, startBounds, snapTargets: snapTargetsFor(originals.map(item => item.id)), spacingParentId };
    activeGesture = value; setGesture(value); stage?.setPointerCapture(event.pointerId);
  };
  const startResize = (event: PointerEvent, node: UIElement, handle: string) => {
    if (isEffectively(node, "locked")) return;
    const value: Gesture = { kind: "resize", pointer: event.pointerId, start: cameraWorld(event), id: node.id, original: node, handle, snapTargets: snapTargetsFor([node.id]) };
    activeGesture = value; setGesture(value); stage?.setPointerCapture(event.pointerId);
  };
  const startGuideMove = (event: PointerEvent, guide: UIManualGuide) => {
    if (guide.locked || !guide.visible || !document().guideSettings.enabled) return;
    event.preventDefault(); event.stopPropagation();
    const value: Gesture = { kind: "guide", pointer: event.pointerId, guideId: guide.id, axis: guide.axis };
    activeGesture = value; setGesture(value); stage?.setPointerCapture(event.pointerId);
  };
  const startPoint = (event: PointerEvent, node: UIElement, point: number, side: "anchor" | "in" | "out" = "anchor") => {
    if (isEffectively(node, "locked")) return;
    const value: Gesture = { kind: "point", pointer: event.pointerId, id: node.id, point, side };
    activeGesture = value; setGesture(value); stage?.setPointerCapture(event.pointerId);
  };
  const createAt = (kind: Tool, point: { x: number; y: number }, size?: { width: number; height: number }, parentId = page().id) => {
    if (kind === "select" || kind === "hand") return;
    const index = new UIHierarchyIndex<UIElement>(page().id, page().elements);
    const parent = parentId === page().id ? undefined : index.get(parentId);
    const local = parent ? index.worldToLocal(parentId, point) ?? point : point;
    const order = index.children(parentId).reduce((max, node) => Math.max(max, node.order), -1) + 1;
    const node = createUIElement(kind, order, local, parentId, size);
    if (kind === "frame") { node.frameType = "container"; node.framePreset = "custom"; }
    if (kind === "path") node.pathPoints = [
      { x: 0.04, y: 0.5, outX: 0.18, outY: 0.12, type: "smooth" },
      { x: 0.5, y: 0.04, inX: 0.34, inY: 0.04, outX: 0.66, outY: 0.04, type: "smooth" },
      { x: 0.96, y: 0.5, inX: 0.82, inY: 0.12, outX: 0.82, outY: 0.88, type: "smooth" },
      { x: 0.5, y: 0.96, inX: 0.66, inY: 0.96, outX: 0.34, outY: 0.96, type: "smooth" },
      { x: 0.04, y: 0.5, inX: 0.18, inY: 0.88, type: "smooth" },
    ];
    updateNodes(nodes => [...nodes, node], undefined, false); setSelectedIds([node.id]); setTool("select");
    return node;
  };
  const addFrame = (presetId: UIFramePresetId, customSize?: { width: number; height: number }) => {
    const world = viewportCenterWorld();
    const preset = UI_FRAME_PRESETS.find(item => item.id === presetId) ?? UI_FRAME_PRESETS[0];
    const width = customSize?.width ?? preset.width, height = customSize?.height ?? preset.height;
    const point = { x: round(world.x - width / 2), y: round(world.y - height / 2) };
    const parent = selectedOne()?.kind === "frame" ? selectedOne()!.id : page().id;
    const node = createUIFrame(hierarchy().children(parent).length, parent === page().id ? point : hierarchy().worldToLocal(parent, point) ?? point, parent, presetId);
    node.width = width; node.height = height;
    updateNodes(nodes => [...nodes, node], undefined, false); setSelectedIds([node.id]); setTool("select");
  };
  const chooseFramePreset = (presetId: UIFramePresetId) => {
    if (presetId !== "custom") { addFrame(presetId); setFramePresetOpen(false); return; }
    const width = Number(window.prompt("Frame width in pixels", "800")); if (!Number.isFinite(width) || width < 1) return;
    const height = Number(window.prompt("Frame height in pixels", "600")); if (!Number.isFinite(height) || height < 1) return;
    addFrame("custom", { width: round(clamp(width, 1, 10000)), height: round(clamp(height, 1, 10000)) }); setFramePresetOpen(false);
  };
  const handleStageDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target as HTMLElement;
    if (target.closest("button,input,textarea,select,[contenteditable='true']")) return;
    if (tool() === "hand" || spaceHeld || event.button === 1) { startPan(event); return; }
    const point = cameraWorld(event);
    if (tool() !== "select") { const value: Gesture = { kind: "draw", pointer: event.pointerId, tool: tool(), parentId: page().id, start: point, current: point }; activeGesture = value; setGesture(value); stage?.setPointerCapture(event.pointerId); return; }
    setFrameMoveArmed("");
    const additive = selectedIds(); const value: Gesture = { kind: "marquee", pointer: event.pointerId, start: point, current: point, additive: event.shiftKey ? additive : [] }; activeGesture = value; setGesture(value); if (!event.shiftKey) setSelectedIds([]); stage?.setPointerCapture(event.pointerId);
  };
  const handleNodeDown = (event: PointerEvent, node: UIElement) => {
    if (event.button !== 0 && event.button !== 1) return;
    if (tool() === "hand" || spaceHeld || event.button === 1) { startPan(event); return; }
    if (connectSource() && node.kind === "frame") { connectToFrame(node); return; }
    const target = event.target;
    if (target instanceof Element && target.closest(".ui-frame-label")) {
      if (tool() === "select") {
        if (frameMoveArmed() === node.id) startMove(event, node);
        else { setSelectedIds(event.shiftKey ? [...new Set([...selectedIds(), node.id])] : [node.id]); setFrameMoveArmed(node.id); }
      }
      return;
    }
    if (tool() !== "select") {
      const isContainer = ["frame", "group", "componentInstance"].includes(node.kind);
      const parentId = isContainer ? node.id : node.parentId;
      const parent = hierarchy().get(parentId);
      if (parent && isEffectively(parent, "locked")) return;
      const point = cameraWorld(event); const value: Gesture = { kind: "draw", pointer: event.pointerId, tool: tool(), parentId, start: point, current: point };
      activeGesture = value; setGesture(value); stage?.setPointerCapture(event.pointerId); return;
    }
    if (node.kind === "frame") {
      const bounds = worldBounds(node);
      const point = cameraWorld(event);
      const tolerance = 8 / camera().zoom;
      const nearBoundary = !!bounds
        && point.x >= bounds.x - tolerance && point.x <= bounds.x + bounds.width + tolerance
        && point.y >= bounds.y - tolerance && point.y <= bounds.y + bounds.height + tolerance
        && (Math.abs(point.x - bounds.x) <= tolerance || Math.abs(point.x - (bounds.x + bounds.width)) <= tolerance
          || Math.abs(point.y - bounds.y) <= tolerance || Math.abs(point.y - (bounds.y + bounds.height)) <= tolerance);
      if (frameMoveArmed() === node.id && nearBoundary) { startMove(event, node); return; }
      const additive = event.shiftKey ? selectedIds() : [];
      const value: Gesture = { kind: "marquee", pointer: event.pointerId, start: point, current: point, additive, scopeParentId: node.id, clickTargetId: node.id };
      activeGesture = value; setGesture(value);
      if (!event.shiftKey) setSelectedIds([]);
      stage?.setPointerCapture(event.pointerId);
      return;
    }
    startMove(event, node);
  };
  const handleStageMove = (event: PointerEvent) => {
    setAltHeld(event.altKey);
    const active = activeGesture;
    if (!active || active.pointer !== event.pointerId) {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(".ui-node[data-node-id]") : undefined;
      setHoveredNodeId(target?.dataset.nodeId ?? "");
      return;
    }
    const point = cameraWorld(event);
    if (active.kind === "pan") setCamera({ ...active.camera, x: active.camera.x + event.clientX - active.clientX, y: active.camera.y + event.clientY - active.clientY });
    else if (active.kind === "marquee" || active.kind === "draw") { const next = { ...active, current: point } as Gesture; activeGesture = next; setGesture(next); }
    else if (active.kind === "move") {
      const dx = point.x - active.start.x, dy = point.y - active.start.y;
      const snapped = resolveSmartSnap(active.startBounds, { x: dx, y: dy }, active.snapTargets, page().guides, document().guideSettings, camera().zoom, active.spacingParentId);
      setSnapLines(snapped.lines);
      updateNodes(nodes => {
        const index = hierarchy();
        return nodes.map(node => {
        const original = active.originals.find(item => item.id === node.id); if (!original) return node;
        const worldStart = active.worldStarts.find(item => item.id === node.id); if (!worldStart) return node;
        const targetWorld = { x: round(worldStart.x + snapped.delta.x), y: round(worldStart.y + snapped.delta.y) };
        const targetLocal = index.worldToLocal(original.parentId, targetWorld);
        return targetLocal ? { ...original, x: round(targetLocal.x), y: round(targetLocal.y) } : node;
      });
      }, "move", false);
    } else if (active.kind === "resize") {
      const original = active.original; const transform = hierarchy().worldTransform(original.id);
      const radians = -(transform?.rotation ?? original.rotation) * Math.PI / 180; const dx = point.x - active.start.x; const dy = point.y - active.start.y;
      const localDx = dx * Math.cos(radians) - dy * Math.sin(radians); const localDy = dx * Math.sin(radians) + dy * Math.cos(radians);
      let next = resizeElement(original, active.handle, localDx, localDy);
      if (Math.abs(transform?.rotation ?? original.rotation) < 0.001) {
        const originalBounds = worldBounds(original);
        if (originalBounds) {
          const proposed = { ...originalBounds, x: originalBounds.x + next.x - original.x, y: originalBounds.y + next.y - original.y, width: next.width, height: next.height };
          const snapped = resolveResizeSnap(proposed, active.handle, active.snapTargets, page().guides, document().guideSettings, camera().zoom);
          setSnapLines(snapped.lines);
          const west = active.handle.includes("w"), north = active.handle.includes("n");
          next = {
            ...next,
            ...(active.handle.includes("e") ? { width: Math.max(1, next.width + snapped.correction.x) } : west ? { x: next.x + snapped.correction.x, width: Math.max(1, next.width - snapped.correction.x) } : {}),
            ...(active.handle.includes("s") ? { height: Math.max(1, next.height + snapped.correction.y) } : north ? { y: next.y + snapped.correction.y, height: Math.max(1, next.height - snapped.correction.y) } : {}),
          };
        } else setSnapLines([]);
      } else setSnapLines([]);
      updateNode(original.id, next, `resize:${original.id}`);
    } else if (active.kind === "guide") {
      const guide = page().guides.find(item => item.id === active.guideId);
      if (guide && !guide.locked) updateManualGuide(active.guideId, { position: active.axis === "x" ? point.x : point.y });
    } else if (active.kind === "point") {
      const node = hierarchy().get(active.id); if (!node) return; const local = hierarchy().worldToLocal(node.parentId, point); if (!local) return;
      const dx = local.x - node.x; const dy = local.y - node.y; const radians = -node.rotation * Math.PI / 180;
      const nodeLocalX = (dx * Math.cos(radians) - dy * Math.sin(radians)) / node.width; const nodeLocalY = (dx * Math.sin(radians) + dy * Math.cos(radians)) / node.height;
      const points = node.pathPoints.map((item, index) => {
        if (index !== active.point) return item;
        if (active.side === "anchor") {
          const moveX = nodeLocalX - item.x, moveY = nodeLocalY - item.y;
          return {
            ...item, x: clamp(nodeLocalX, 0, 1), y: clamp(nodeLocalY, 0, 1),
            ...(item.inX !== undefined ? { inX: item.inX + moveX } : {}), ...(item.inY !== undefined ? { inY: item.inY + moveY } : {}),
            ...(item.outX !== undefined ? { outX: item.outX + moveX } : {}), ...(item.outY !== undefined ? { outY: item.outY + moveY } : {}),
          };
        }
        const keyX = active.side === "in" ? "inX" : "outX", keyY = active.side === "in" ? "inY" : "outY";
        const handleX = clamp(nodeLocalX, -10, 10), handleY = clamp(nodeLocalY, -10, 10);
        const next = { ...item, [keyX]: handleX, [keyY]: handleY };
        if (item.type === "smooth") {
          const oppositeX = active.side === "in" ? "outX" : "inX", oppositeY = active.side === "in" ? "outY" : "inY";
          const dx = handleX - item.x, dy = handleY - item.y;
          next[oppositeX] = clamp(item.x - dx, -10, 10); next[oppositeY] = clamp(item.y - dy, -10, 10);
        }
        return next;
      });
      updateNode(node.id, { pathPoints: points }, `point:${node.id}:${active.point}`);
    }
  };
  const finishGesture = (event: PointerEvent) => {
    const active = activeGesture; if (!active || active.pointer !== event.pointerId) return;
    const point = cameraWorld(event);
    if (active.kind === "draw") {
      const rect = normalizeRect(active.start, point); const minSizes: Record<string, { width: number; height: number }> = { button: { width: 144, height: 44 }, input: { width: 240, height: 44 }, checkbox: { width: 140, height: 32 }, text: { width: 180, height: 32 }, ellipse: { width: 80, height: 80 }, line: { width: 120, height: 2 }, frame: { width: 240, height: 160 }, path: { width: 120, height: 80 }, rectangle: { width: 120, height: 80 }, image: { width: 160, height: 120 } };
      const min = minSizes[active.tool] ?? { width: 1, height: 1 };
      const dragged = rect.width > 3 || rect.height > 3;
      const size = dragged
        ? { width: Math.max(1, round(rect.width)), height: Math.max(1, round(rect.height)) }
        : min;
      const node = createAt(active.tool, dragged ? { x: round(rect.x), y: round(rect.y) } : active.start, size, active.parentId);
      if (node && active.tool === "image") imageInput?.click();
    } else if (active.kind === "guide") {
      const rect = stage?.getBoundingClientRect();
      if (rect && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) removeManualGuide(active.guideId);
    } else if (active.kind === "marquee") {
      const rect = normalizeRect(active.start, point);
      if (rect.width > 2 || rect.height > 2) {
        const candidates = active.scopeParentId ? hierarchy().descendants(active.scopeParentId).filter(node => !isEffectively(node, "hidden")) : displayNodes();
        const selectedFrameIds = new Set(candidates.filter(node => node.kind === "frame" && !isEffectively(node, "locked")).filter(node => {
          const box = worldBounds(node);
          return !!box && box.x >= rect.x && box.y >= rect.y && box.x + box.width <= rect.x + rect.width && box.y + box.height <= rect.y + rect.height;
        }).map(node => node.id));
        const additiveIds = new Set(active.additive);
        const hits = candidates.filter(node => !isEffectively(node, "locked") && !hierarchy().hasSelectedAncestor(node.id, additiveIds) && !hierarchy().ancestors(node.id).some(parent => selectedFrameIds.has(parent.id))).filter(node => {
          const box = worldBounds(node);
          if (!box) return false;
          const fullyContained = box.x >= rect.x && box.y >= rect.y && box.x + box.width <= rect.x + rect.width && box.y + box.height <= rect.y + rect.height;
          if (node.kind === "frame") return fullyContained;
          return box.x <= rect.x + rect.width && box.x + box.width >= rect.x && box.y <= rect.y + rect.height && box.y + box.height >= rect.y;
        }).map(node => node.id);
        setSelectedIds([...new Set([...active.additive, ...hits])]);
        const onlyFrame = hits.length === 1 ? hierarchy().get(hits[0]) : undefined;
        setFrameMoveArmed(onlyFrame?.kind === "frame" ? onlyFrame.id : "");
      } else if (active.clickTargetId) {
        const target = hierarchy().get(active.clickTargetId);
        if (target && !isEffectively(target, "locked")) {
          setSelectedIds([...new Set([...active.additive, target.id])]);
          setFrameMoveArmed(target.kind === "frame" ? target.id : "");
        }
      }
    }
    activeGesture = undefined; setGesture(undefined); setSnapLines([]);
    try { stage?.releasePointerCapture(event.pointerId); } catch { /* Pointer may already have been released by the host. */ }
  };
  const cancelGesture = (event: PointerEvent) => {
    const active = activeGesture; if (!active || active.pointer !== event.pointerId) return;
    activeGesture = undefined; setGesture(undefined); setSnapLines([]);
    try { stage?.releasePointerCapture(event.pointerId); } catch { /* Pointer may already have been released by the host. */ }
  };
  const handleWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey || !event.shiftKey) { event.preventDefault(); zoomAt(event.clientX, event.clientY, camera().zoom * Math.exp(-event.deltaY * 0.0015)); }
    else setCamera(current => ({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }));
  };

  const deleteSelection = () => {
    const ids = new Set(rootsOnly(selectedIds()).flatMap(id => [id, ...hierarchy().descendants(id).map(node => node.id)]));
    if (!ids.size) return;
    updateNodes(nodes => nodes.filter(node => !ids.has(node.id))); setSelectedIds([]);
  };
  const duplicateSelection = () => {
    const roots = rootsOnly(selectedIds()); const cloneIds = new Map<string, string>(); const copies: UIElement[] = [];
    const rootIds = new Set(roots);
    const nextOrder = new Map<string, number>();
    for (const root of roots) {
      const node = hierarchy().get(root); if (!node) continue;
      if (!nextOrder.has(node.parentId)) nextOrder.set(node.parentId, hierarchy().children(node.parentId).reduce((max, sibling) => Math.max(max, sibling.order), -1) + 1);
      nextOrder.set(node.id, nextOrder.get(node.parentId)!);
      nextOrder.set(node.parentId, nextOrder.get(node.parentId)! + 1);
    }
    for (const root of roots) for (const node of [hierarchy().get(root)!, ...hierarchy().descendants(root)]) cloneIds.set(node.id, createUIDesignId(node.kind));
    for (const root of roots) for (const node of [hierarchy().get(root)!, ...hierarchy().descendants(root)]) {
      const parentTransform = node.parentId === page().id ? undefined : hierarchy().worldTransform(node.parentId);
      const radians = -(parentTransform?.rotation ?? 0) * Math.PI / 180;
      const offsetX = 16 * Math.cos(radians) - 16 * Math.sin(radians);
      const offsetY = 16 * Math.sin(radians) + 16 * Math.cos(radians);
      copies.push({ ...structuredClone(node), id: cloneIds.get(node.id)!, parentId: cloneIds.get(node.parentId) ?? node.parentId, x: node.x + (rootIds.has(node.id) ? offsetX : 0), y: node.y + (rootIds.has(node.id) ? offsetY : 0), order: rootIds.has(node.id) ? nextOrder.get(node.id) ?? node.order + 1 : node.order, name: `${node.name} copy`, interactions: node.interactions.map(link => ({ ...link, id: createUIDesignId("interaction"), targetNodeId: link.targetNodeId ? cloneIds.get(link.targetNodeId) ?? link.targetNodeId : undefined })) });
    }
    updateNodes(nodes => [...nodes, ...copies]); setSelectedIds(roots.map(id => cloneIds.get(id)!));
  };
  const groupSelection = () => {
    const ids = rootsOnly(selectedIds()); if (ids.length < 2) return;
    const index = hierarchy();
    const nodes = ids.map(id => index.get(id)).filter((node): node is UIElement => !!node && !isEffectively(node, "hidden") && !isEffectively(node, "locked"));
    if (nodes.length < 2) return;
    const parentId = nodes.every(node => node.parentId === nodes[0].parentId) ? nodes[0].parentId : page().id;
    const localRects = nodes.map(node => {
      const transform = index.worldTransform(node.id); if (!transform) return undefined;
      const angle = transform.rotation * Math.PI / 180; const cosine = Math.cos(angle); const sine = Math.sin(angle);
      const corners = [{ x: 0, y: 0 }, { x: node.width, y: 0 }, { x: node.width, y: node.height }, { x: 0, y: node.height }]
        .map(point => ({ x: transform.x + point.x * cosine - point.y * sine, y: transform.y + point.x * sine + point.y * cosine }))
        .map(point => parentId === page().id ? point : index.worldToLocal(parentId, point)).filter((point): point is { x: number; y: number } => !!point);
      if (!corners.length) return undefined;
      const left = Math.min(...corners.map(point => point.x)); const top = Math.min(...corners.map(point => point.y));
      const right = Math.max(...corners.map(point => point.x)); const bottom = Math.max(...corners.map(point => point.y));
      return { x: left, y: top, width: right - left, height: bottom - top };
    }).filter((box): box is UIRect => !!box);
    const bounds = unionRects(localRects); if (!bounds) return;
    const left = Math.floor(bounds.x + 1e-7), top = Math.floor(bounds.y + 1e-7);
    const right = Math.ceil(bounds.x + bounds.width - 1e-7), bottom = Math.ceil(bounds.y + bounds.height - 1e-7);
    const order = index.children(parentId).reduce((max, sibling) => Math.max(max, sibling.order), -1) + 1;
    const group = createUIElement("group", order, { x: left, y: top }, parentId, { width: Math.max(1, right - left), height: Math.max(1, bottom - top) }); group.name = "Group";
    const baseIndex = new UIHierarchyIndex<UIElement>(page().id, [...page().elements, group]);
    const transformed = new Map<string, UIElement>();
    for (const node of nodes) { const moved = baseIndex.reparent(node.id, group.id); if (moved) transformed.set(node.id, moved); }
    if (transformed.size !== nodes.length) return;
    updateNodes(items => [...items.map(item => transformed.get(item.id) ?? item), group], undefined, false);
    setSelectedIds([group.id]);
  };
  const bulkRename = () => {
    const ids = rootsOnly(selectedIds());
    if (!ids.length) return;
    const template = window.prompt("Rename selected layers. Use {n} for numbering.", ids.length === 1 ? hierarchy().get(ids[0])?.name ?? "Layer" : "Layer {n}");
    if (!template?.trim()) return;
    const names = new Map(ids.map((id, index) => [id, template.trim().replace(/\{n\}/g, String(index + 1)).slice(0, 120)]));
    updateNodes(nodes => nodes.map(node => names.has(node.id) ? { ...node, name: names.get(node.id)! } : node), undefined, false);
  };
  const updateSelection = (patch: Partial<UIElement>) => {
    const ids = new Set(rootsOnly(selectedIds()));
    if (!ids.size) return;
    updateNodes(nodes => nodes.map(node => ids.has(node.id) && !isEffectively(node, "locked") ? { ...node, ...patch } : node), undefined, false);
  };
  const ungroupSelection = () => {
    const groups = selected().filter(node => node.kind === "group" || node.kind === "frame"); if (!groups.length) return;
    let nodes = [...page().elements]; const chosen: string[] = [];
    for (const group of groups) {
      const index = new UIHierarchyIndex<UIElement>(page().id, nodes);
      for (const child of index.children(group.id)) { const moved = index.reparent(child.id, group.parentId); if (moved) { nodes = nodes.map(item => item.id === child.id ? { ...moved, order: group.order + child.order / 1000 } : item); chosen.push(child.id); } }
      nodes = nodes.filter(item => item.id !== group.id);
    }
    updateNodes(() => nodes); setSelectedIds(chosen);
  };
  const renameNode = (node: UIElement) => { const next = window.prompt("Layer name", node.name); if (next?.trim()) updateNode(node.id, { name: next.trim().slice(0, 120) }); };
  const reorderSelection = (direction: "front" | "back" | "forward" | "backward", ids = selectedIds()) => {
    const roots = rootsOnly(ids).filter(id => { const node = hierarchy().get(id); return !!node && !isEffectively(node, "locked"); });
    if (!roots.length) return;
    const selected = new Set(roots);
    const parentIds = [...new Set(roots.map(id => hierarchy().get(id)?.parentId).filter((id): id is string => !!id))];
    updateNodes(nodes => {
      let next = [...nodes];
      for (const parentId of parentIds) {
        const siblings = hierarchy().children(parentId).map(node => node.id);
        const moving = new Set(siblings.filter(id => selected.has(id)));
        let ordered = [...siblings];
        if (direction === "front") ordered = [...siblings.filter(id => !moving.has(id)), ...siblings.filter(id => moving.has(id))];
        else if (direction === "back") ordered = [...siblings.filter(id => moving.has(id)), ...siblings.filter(id => !moving.has(id))];
        else if (direction === "forward") {
          for (let i = ordered.length - 2; i >= 0; i--) if (moving.has(ordered[i]) && !moving.has(ordered[i + 1])) [ordered[i], ordered[i + 1]] = [ordered[i + 1], ordered[i]];
        } else {
          for (let i = 1; i < ordered.length; i++) if (moving.has(ordered[i]) && !moving.has(ordered[i - 1])) [ordered[i], ordered[i - 1]] = [ordered[i - 1], ordered[i]];
        }
        ordered.forEach((id, order) => { next = next.map(node => node.id === id ? { ...node, order } : node); });
      }
      return next;
    }, undefined, false);
  };
  const toggleCollapsed = (id: string) => setCollapsed(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const canDropLayer = (ids: string[], targetId: string | undefined, position: HierarchyDropPosition) => {
    const index = hierarchy();
    const dragged = new Set(ids);
    const roots = [...dragged].filter(id => !index.hasSelectedAncestor(id, dragged));
    const target = targetId ? index.get(targetId) : undefined;
    if (!roots.length || targetId && (!target || roots.includes(targetId))) return false;
    const parentId = position === "inside" && target && ["frame", "group", "componentInstance"].includes(target.kind) ? target.id : position === "front" || position === "back" ? page().id : target?.parentId;
    if (!parentId) return false;
    const parent = parentId === page().id ? undefined : index.get(parentId);
    if (parent && isEffectively(parent, "locked")) return false;
    return roots.every(id => {
      const node = index.get(id);
      return !!node && !isEffectively(node, "locked") && index.canReparent(id, parentId);
    });
  };
  const layerDragIds = (event: DragEvent) => {
    if (activeLayerDragIds.length) return activeLayerDragIds;
    const current = dragIds();
    if (current.length) return current;
    const transfer = event.dataTransfer;
    const encoded = transfer?.getData("application/x-sketchdraw-layer-ids") || transfer?.getData("text/plain") || "";
    return encoded.split(",").map(id => id.trim()).filter(Boolean);
  };
  const layerDropPositionFor = (node: UIElement, event: DragEvent): HierarchyDropPosition => {
    const rect = event.currentTarget instanceof HTMLElement ? event.currentTarget.getBoundingClientRect() : undefined;
    const ratio = rect && rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;
    if (["frame", "group", "componentInstance"].includes(node.kind)) {
      if (ratio < 0.27) return "before";
      if (ratio > 0.73) return "after";
      return "inside";
    }
    return ratio < 0.5 ? "before" : "after";
  };
  const commitLayerDrop = (ids: string[], targetId: string | undefined, position: HierarchyDropPosition) => {
    if (!canDropLayer(ids, targetId, position)) return;
    const next = moveHierarchyNodes(page().id, page().elements, ids, targetId, position);
    if (next) updateNodes(() => next, undefined, false);
  };
  const handleLayerDragOver = (node: UIElement, event: DragEvent) => {
    event.preventDefault(); event.stopPropagation();
    const ids = layerDragIds(event);
    const preferred = layerDropPositionFor(node, event);
    const candidates = preferred === "inside" ? [preferred, "before", "after"] as const : [preferred] as const;
    const position = candidates.find(candidate => canDropLayer(ids, node.id, candidate));
    if (!position) { if (event.dataTransfer) event.dataTransfer.dropEffect = "none"; setLayerDrop(undefined); return; }
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    setLayerDrop({ targetId: node.id, position });
  };
  const handleLayerDrop = (node: UIElement, event: DragEvent) => {
    event.preventDefault(); event.stopPropagation();
    const ids = layerDragIds(event);
    const preferred = layerDropPositionFor(node, event);
    const candidates = preferred === "inside" ? [preferred, "before", "after"] as const : [preferred] as const;
    const position = candidates.find(candidate => canDropLayer(ids, node.id, candidate));
    if (position) commitLayerDrop(ids, node.id, position);
    activeLayerDragIds = []; setDragIds([]); setLayerDrop(undefined);
  };
  const handleLayerListDragOver = (event: DragEvent) => {
    if (event.target !== event.currentTarget || !event.currentTarget) return;
    event.preventDefault(); event.stopPropagation();
    const ids = layerDragIds(event);
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const position: HierarchyDropPosition = event.clientY < rect.top + rect.height / 2 ? "front" : "back";
    if (!canDropLayer(ids, undefined, position)) { if (event.dataTransfer) event.dataTransfer.dropEffect = "none"; setLayerDrop(undefined); return; }
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    setLayerDrop({ position });
  };
  const handleLayerListDrop = (event: DragEvent) => {
    if (event.target !== event.currentTarget || !event.currentTarget) return;
    event.preventDefault(); event.stopPropagation();
    const ids = layerDragIds(event);
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const position: HierarchyDropPosition = layerDrop()?.targetId === undefined ? layerDrop()?.position ?? (event.clientY < rect.top + rect.height / 2 ? "front" : "back") : event.clientY < rect.top + rect.height / 2 ? "front" : "back";
    commitLayerDrop(ids, undefined, position);
    activeLayerDragIds = []; setDragIds([]); setLayerDrop(undefined);
  };
  const addAsset = (asset: Asset) => {
    const center = viewportCenterWorld();
    const { parentId, point } = insertionParentAt(center);
    const origin = { x: round(center.x - asset.width / 2), y: round(center.y - asset.height / 2) };
    if (asset.parts.length === 1) {
      const part = asset.parts[0];
      const node = createAt(part.kind, { x: origin.x + part.x, y: origin.y + part.y }, { width: part.width, height: part.height }, parentId);
      if (node) { node.name = asset.name; node.text = part.text ?? ""; if (part.fill) node.fill = part.fill; if (part.radius !== undefined) node.radius = part.radius; updateNodes(nodes => nodes.map(item => item.id === node.id ? node : item), undefined, false); setSelectedIds([node.id]); setLeftTab("layers"); }
      return;
    }
    const localOrigin = { x: round(point.x - asset.width / 2), y: round(point.y - asset.height / 2) };
    const group = createUIElement("group", hierarchy().children(parentId).length, localOrigin, parentId, { width: asset.width, height: asset.height }); group.name = asset.name;
    const children = asset.parts.map((part, order) => { const child = createUIElement(part.kind, order, { x: part.x, y: part.y }, group.id, { width: part.width, height: part.height }); child.name = part.name ?? kindName(part.kind); child.text = part.text ?? ""; if (part.fill) child.fill = part.fill; if (part.radius !== undefined) child.radius = part.radius; return child; });
    updateNodes(nodes => [...nodes, group, ...children], undefined, false); setSelectedIds([group.id]); setLeftTab("layers");
  };
  const createComponent = () => {
    const node = selectedOne(); if (!node) return;
    const subtree = [node, ...hierarchy().descendants(node.id)]; const componentId = createUIDesignId("component");
    const rootId = `${componentId}-root`;
    const sourceIds = new Map(subtree.map(child => [child.id, createUIDesignId("component-source")]));
    const childIds = new Map(subtree.slice(1).map(child => [child.id, `${componentId}-${child.id}`]));
    const rootSourceId = sourceIds.get(node.id)!;
    const root = { ...structuredClone(node), id: rootId, parentId: "component-root", order: 0, componentId, componentSourceId: node.componentSourceId || rootSourceId, componentSourceIds: { ...node.componentSourceIds, [componentId]: rootSourceId } };
    const children = subtree.slice(1).map(child => {
      const childSourceId = sourceIds.get(child.id)!;
      return { ...structuredClone(child), id: childIds.get(child.id)!, componentSourceId: child.componentSourceId || childSourceId, componentSourceIds: { ...child.componentSourceIds, [componentId]: childSourceId }, parentId: child.parentId === node.id ? rootId : childIds.get(child.parentId) ?? rootId, order: child.order };
    });
    const variants: UIComponentVariant[] = [{ id: createUIDesignId("variant"), name: "Default", properties: {} }, { id: createUIDesignId("variant"), name: "Compact", properties: { width: Math.max(80, round(node.width * 0.8)) } }];
    const component = { id: componentId, name: node.name || "Component", root, children, variants };
    updateNodes(nodes => nodes.map(item => sourceIds.has(item.id) ? { ...item, componentId: item.id === node.id ? componentId : item.componentId, componentSourceId: item.componentSourceId || sourceIds.get(item.id)!, componentSourceIds: { ...item.componentSourceIds, [componentId]: sourceIds.get(item.id)! } } : item), undefined, false);
    updateDocument(doc => synchronizeComponentMasters({ ...doc, components: [...doc.components, component] })); addMessage("Component created in Assets"); setLeftTab("assets");
  };
  const componentChildren = (component: UIDesignDocument["components"][number], instanceId: string) => {
    const ids = new Map(component.children.map(child => [child.id, createUIDesignId(child.kind)]));
    return component.children.map(child => ({ ...structuredClone(child), id: ids.get(child.id)!, componentSourceId: child.componentSourceId || child.id, componentSourceIds: { ...child.componentSourceIds, [component.id]: child.componentSourceIds[component.id] || child.componentSourceId || child.id }, parentId: child.parentId === component.root.id ? instanceId : ids.get(child.parentId) ?? instanceId }));
  };
  const insertComponent = (id: string) => {
    const component = document().components.find(item => item.id === id); if (!component) return;
    const center = viewportCenterWorld();
    const { parentId, point: localCenter } = insertionParentAt(center);
    const instance = { ...structuredClone(component.root), id: createUIDesignId("component"), kind: "componentInstance" as const, parentId, order: hierarchy().children(parentId).length, x: round(localCenter.x - component.root.width / 2), y: round(localCenter.y - component.root.height / 2), name: `${component.name} instance`, componentId: id, componentVariantId: component.variants[0]?.id ?? "", interactions: [] };
    const children = componentChildren(component, instance.id);
    updateNodes(nodes => applyComponentVariantTree([...nodes, instance, ...children], page().id, instance.id, component, instance.componentVariantId, document().components), undefined, false); setSelectedIds([instance.id]); setLeftTab("layers");
  };
  const applyVariant = (node: UIElement, variantId: string) => {
    const component = document().components.find(item => item.id === node.componentId); if (!component) return;
    const variant = component.variants.find(item => item.id === variantId); if (!variant) return;
    const selectedComponent = component;
    const ancestors = hierarchy().ancestors(node.id);
    const nestedInInstance = ancestors.some(parent => parent.kind === "componentInstance") && !ancestors.some(parent => parent.kind !== "componentInstance" && !!parent.componentId);
    updateNodes(nodes => {
      const selected = nestedInInstance
        ? nodes.map(item => item.id === node.id ? { ...item, ...withComponentOverrides(item, { componentVariantId: variantId }, true) } : item)
        : nodes;
      return applyComponentVariantTree(selected, page().id, node.id, selectedComponent, variantId, document().components);
    }, `variant:${node.id}`);
  };
  const detachComponent = (node: UIElement) => updateNodes(nodes => detachComponentInstance(nodes, page().id, node.id), `detach:${node.id}`, false);
  const resetComponent = (node: UIElement) => {
    const component = document().components.find(item => item.id === node.componentId); if (!component) return;
    const selectedComponent = component;
    updateNodes(nodes => resetComponentInstance(nodes, page().id, selectedComponent, node.id, document().components), `reset:${node.id}`, false);
  };
  const resetComponentNode = (node: UIElement) => {
    const root = node.kind === "componentInstance" ? node : hierarchy().ancestors(node.id).find(parent => parent.kind === "componentInstance");
    if (!root) return;
    const component = document().components.find(item => item.id === root.componentId); if (!component) return;
    const selectedComponent = component;
    updateNodes(nodes => resetComponentChildOverride(nodes, page().id, selectedComponent, root.id, node.id, document().components), `reset-node:${node.id}`, false);
  };
  const saveComponentVariant = (node: UIElement) => {
    const component = document().components.find(item => item.id === node.componentId); if (!component) return;
    if (component.variants.length >= 100) { addMessage("This component already has the maximum of 100 variants"); return; }
    const name = window.prompt("Name this variant", `Variant ${component.variants.length + 1}`)?.trim().slice(0, 120);
    if (!name) return;
    const variant = captureComponentVariant(page().elements, page().id, component, node.id, createUIDesignId("variant"), name);
    if (!variant) return;
    updateDocument(doc => ({ ...doc, components: doc.components.map(item => item.id === component.id ? { ...item, variants: [...item.variants, variant] } : item) }));
    addMessage(`Saved variant “${name}”`);
  };

  const renderSvgScene = (nodes: UIElement[], index: UIHierarchyIndex<UIElement>, fixedBounds?: UIRect) => {
    const hidden = (node: UIElement) => node.hidden || index.ancestors(node.id).some(parent => parent.hidden);
    const all = nodes.flatMap(node => [node, ...index.descendants(node.id)]).filter(node => !hidden(node));
    const bounds = fixedBounds ?? unionRects(all.map(node => index.worldBounds(node.id)).filter((box): box is UIRect => !!box)); if (!bounds) return undefined;
    const renderNode = (node: UIElement, isExportRoot: boolean): string => {
      const id = `clip-${node.id.replace(/[^\w-]/g, "-")}`;
      const master = componentRoot(node);
      const kind = master?.kind ?? node.kind;
      const rawFill = node.fillTokenId ? resolveColorToken(document().colorTokens, node.fillTokenId, document().activeColorModeId, node.fill) : node.fill;
      const rawStroke = node.strokeTokenId ? resolveColorToken(document().colorTokens, node.strokeTokenId, document().activeColorModeId, node.stroke) : node.stroke;
      const fill = escapeXml(rawFill); const stroke = rawStroke === "none" ? "none" : escapeXml(rawStroke);
      const gradientId = `gradient-${id}`;
      const shapeFill = node.fillGradient ? `url(#${gradientId})` : fill;
      const radiusToken = document().radiusTokens.find(token => token.id === node.radiusTokenId);
      const radius = resolveValueToken(radiusToken, document().activeColorModeId, document().radiusTokens) ?? node.radius;
      const typographyToken = document().typographyTokens.find(token => token.id === node.typographyTokenId);
      const typography = resolveTypographyToken(typographyToken, document().activeColorModeId, document().typographyTokens);
      const fontFamily = typography?.fontFamily ?? node.fontFamily;
      const fontSize = typography?.fontSize ?? node.fontSize;
      const fontWeight = typography?.fontWeight ?? node.fontWeight;
      const dash = node.strokeStyle === "dashed" ? ` stroke-dasharray="${Math.max(2, node.strokeWidth * 4)} ${Math.max(2, node.strokeWidth * 3)}"` : node.strokeStyle === "dotted" ? ` stroke-dasharray="${Math.max(1, node.strokeWidth)} ${Math.max(2, node.strokeWidth * 2)}"` : "";
      const border = `stroke="${stroke}" stroke-width="${node.strokeWidth}"${dash}`;
      let shape = "";
      if (kind === "frame") {
        if (isExportRoot && node.frameType === "screen") shape = `<rect width="${node.width}" height="${node.height}" rx="${radius}" fill="${shapeFill}" ${border}/>`;
      } else if (kind === "group" || kind === "componentInstance") {
        shape = "";
      } else if (kind === "ellipse") shape = `<ellipse cx="${node.width / 2}" cy="${node.height / 2}" rx="${node.width / 2}" ry="${node.height / 2}" fill="${shapeFill}" ${border}/>`;
      else if (kind === "line") shape = `<line x1="0" y1="${node.height / 2}" x2="${node.width}" y2="${node.height / 2}" ${border}/>`;
      else if (kind === "path") {
        const points = node.pathPoints;
        if (points.length) {
          let path = `M ${points[0].x * node.width} ${points[0].y * node.height}`;
          for (let index = 1; index < points.length; index++) {
            const previous = points[index - 1]; const next = points[index];
            if (previous.outX !== undefined || previous.outY !== undefined || next.inX !== undefined || next.inY !== undefined) {
              path += ` C ${(previous.outX ?? previous.x) * node.width} ${(previous.outY ?? previous.y) * node.height}, ${(next.inX ?? next.x) * node.width} ${(next.inY ?? next.y) * node.height}, ${next.x * node.width} ${next.y * node.height}`;
            } else path += ` L ${next.x * node.width} ${next.y * node.height}`;
          }
          shape = `<path d="${path}" fill="${shapeFill}" ${border}/>`;
        }
      } else if (kind === "image") shape = node.imageData.startsWith("data:image/") ? `<image href="${escapeXml(node.imageData)}" width="${node.width}" height="${node.height}" preserveAspectRatio="${node.imageFit === "fill" ? "none" : node.imageFit === "contain" ? "xMidYMid meet" : "xMidYMid slice"}"/>` : `<rect width="${node.width}" height="${node.height}" rx="${radius}" fill="${shapeFill}" ${border}/>`;
      else {
        if (["rectangle", "button", "input", "checkbox"].includes(kind)) shape = `<rect width="${node.width}" height="${node.height}" rx="${radius}" fill="${shapeFill}" ${border}/>`;
        if (kind === "checkbox") shape += `<rect x="8" y="${Math.max(4, (node.height - 16) / 2)}" width="16" height="16" rx="3" fill="none" stroke="${stroke}"/>`;
        const buttonTextColor = kind === "button" ? "#ffffff" : fill;
        if (node.text && kind !== "text") shape += `<text x="${kind === "checkbox" ? 32 : kind === "button" ? node.width / 2 : 12}" y="${node.height / 2}" dominant-baseline="middle" text-anchor="${kind === "button" ? "middle" : "start"}" fill="${buttonTextColor}" font-family="${escapeXml(fontStacks[fontFamily])}" font-size="${fontSize}" font-weight="${fontWeight}">${escapeXml(node.text)}</text>`;
        if (kind === "text") shape = `<text x="0" y="${fontSize}" fill="${fill}" font-family="${escapeXml(fontStacks[fontFamily])}" font-size="${fontSize}" font-weight="${fontWeight}">${escapeXml(node.text)}</text>`;
      }
      const children = index.children(node.id).filter(child => !hidden(child)); const clips = kind === "frame" && (node.clipContent || node.mask) || node.autoLayout.enabled && node.autoLayout.clip;
      const childMarkup = children.map(child => renderNode(child, false)).join("");
      const defs = node.fillGradient ? `<defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="0" gradientTransform="rotate(${node.fillGradient.angle} .5 .5)"><stop offset="0%" stop-color="${escapeXml(node.fillGradient.from)}"/><stop offset="100%" stop-color="${escapeXml(node.fillGradient.to)}"/></linearGradient></defs>` : "";
      const clip = clips ? `<defs><clipPath id="${id}"><rect width="${node.width}" height="${node.height}" rx="${Math.min(radius, node.width / 2, node.height / 2)}"/></clipPath></defs><g clip-path="url(#${id})">${childMarkup}</g>` : childMarkup;
      const content = defs + clip;
      const transform = isExportRoot ? index.worldTransform(node.id) : undefined;
      const x = transform?.x ?? node.x; const y = transform?.y ?? node.y; const rotation = transform?.rotation ?? node.rotation;
      return `<g transform="translate(${x} ${y}) rotate(${rotation})" opacity="${node.opacity}">${shape}${content}</g>`;
    };
    const left = Math.floor(bounds.x); const top = Math.floor(bounds.y); const right = Math.ceil(bounds.x + bounds.width); const bottom = Math.ceil(bounds.y + bounds.height);
    const width = Math.max(1, right - left); const height = Math.max(1, bottom - top);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${left} ${top} ${width} ${height}">${nodes.filter(node => !hidden(node)).map(node => renderNode(node, true)).join("")}</svg>`;
    return { svg, width, height };
  };
  const exportSVG = () => {
    const roots = rootsOnly(selected().map(node => node.id)).map(id => hierarchy().get(id)!).filter(Boolean); const nodes = roots.length ? roots : topVisible(); if (!nodes.length) return;
    const scene = renderSvgScene(nodes, hierarchy()); if (scene) downloadText(`${document().name.replace(/[^\w-]+/g, "-")}.svg`, scene.svg, "image/svg+xml");
  };
  const exportPNG = async () => {
    const roots = rootsOnly(selected().map(node => node.id)).map(id => hierarchy().get(id)!).filter(Boolean); const nodes = roots.length ? roots : topVisible(); if (!nodes.length) return;
    try {
      const scene = renderSvgScene(nodes, hierarchy()); if (!scene) return;
      const blob = await rasterizeSvg(scene.svg, scene.width, scene.height);
      downloadBlob(`${document().name.replace(/[^\w-]+/g, "-")}.png`, blob);
    } catch (error) { addMessage(error instanceof Error ? error.message : "PNG export failed"); }
  };
  const exportPDF = async () => {
    const source = document();
    const scenes = source.pages.flatMap(item => {
      const index = new UIHierarchyIndex<UIElement>(item.id, item.elements);
      return item.elements.filter(node => node.kind === "frame" && node.frameType === "screen" && !node.hidden && !index.ancestors(node.id).some(parent => parent.hidden)).map(node => ({ node, index }));
    });
    if (!scenes.length) { addMessage("Add a visible screen frame before exporting a PDF"); return; }
    if (scenes.length > 100) { addMessage("PDF export is limited to 100 visible screen frames at a time"); return; }
    try {
      const { PDFDocument } = await import("pdf-lib");
      const pdf = await PDFDocument.create();
      for (const { node, index } of scenes) {
        const bounds = index.worldBounds(node.id); if (!bounds) continue;
        const scene = renderSvgScene([node], index, bounds); if (!scene) continue;
        const imageBlob = await rasterizeSvg(scene.svg, scene.width, scene.height);
        const image = await pdf.embedPng(new Uint8Array(await imageBlob.arrayBuffer()));
        const pageScale = Math.min(1, 14_400 / scene.width, 14_400 / scene.height);
        const pageWidth = Math.max(1, scene.width * pageScale); const pageHeight = Math.max(1, scene.height * pageScale);
        const outputPage = pdf.addPage([pageWidth, pageHeight]);
        outputPage.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
      }
      if (!pdf.getPageCount()) { addMessage("No visible screen frames could be exported"); return; }
      const bytes = await pdf.save();
      downloadBlob(`${source.name.replace(/[^\w-]+/g, "-")}.pdf`, new Blob([bytes as BlobPart], { type: "application/pdf" }));
    } catch (error) { addMessage(error instanceof Error ? error.message : "PDF export failed"); }
  };
  const exportOfflinePresentation = () => {
    const screens = document().pages.flatMap(item => {
      const index = new UIHierarchyIndex<UIElement>(item.id, item.elements);
      return item.elements.filter(node => node.kind === "frame" && node.frameType === "screen" && !index.ancestors(node.id).some(parent => parent.hidden)).map(node => ({ page: item, node, index, id: `${item.id}::${node.id}` }));
    });
    if (!screens.length) { addMessage("Add a screen frame before exporting a presentation"); return; }
    const safeCss = (value: string) => /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value) || value === "transparent" ? value : "#ffffff";
    const render = (node: UIElement, index: UIHierarchyIndex<UIElement>, isRoot = false): string => {
      if (node.hidden || index.ancestors(node.id).some(parent => parent.hidden)) return "";
      const children = index.children(node.id).map(child => render(child, index)).join("");
      const fill = safeCss(resolveColorToken(document().colorTokens, node.fillTokenId, document().activeColorModeId, node.fill));
      const stroke = node.stroke === "none" ? "transparent" : safeCss(resolveColorToken(document().colorTokens, node.strokeTokenId, document().activeColorModeId, node.stroke));
      const radius = resolveValueToken(document().radiusTokens.find(item => item.id === node.radiusTokenId), document().activeColorModeId, document().radiusTokens) ?? node.radius;
      const background = node.fillGradient ? `linear-gradient(${node.fillGradient.angle}deg, ${safeCss(node.fillGradient.from)}, ${safeCss(node.fillGradient.to)})` : fill;
      const style = [`position:${isRoot ? "relative" : "absolute"}`, `left:${isRoot ? 0 : node.x}px`, `top:${isRoot ? 0 : node.y}px`, `width:${node.width}px`, `height:${node.height}px`, `transform:${isRoot ? "none" : `rotate(${node.rotation}deg)`}`, `opacity:${node.opacity}`, `box-sizing:border-box`, `border-radius:${node.kind === "ellipse" ? "50%" : radius + "px"}`, `background:${["group", "componentInstance"].includes(node.kind) || node.kind === "frame" && !isRoot ? "transparent" : background}`, `border:${node.strokeWidth}px ${node.strokeStyle} ${stroke}`, `color:${node.kind === "text" ? fill : readableTextColor(fill)}`, `font-family:${fontStacks[node.fontFamily]}`, `font-size:${node.fontSize}px`, `font-weight:${node.fontWeight}`, `line-height:${node.lineHeight}`, `text-align:${node.textAlign}`, `box-shadow:${safeBoxShadow(node.effectValue || (node.shadow === "soft" ? "0 5px 16px #26354d20" : node.shadow === "strong" ? "0 12px 30px #26354d40" : "none"))}`, `overflow:${node.clipContent || node.mask || node.autoLayout.clip ? "hidden" : "visible"}`, ...(node.autoLayout.enabled ? [`display:flex`, `flex-direction:${node.autoLayout.direction === "horizontal" ? "row" : "column"}`, `gap:${node.autoLayout.gap}px`, `padding:${node.autoLayout.paddingTop}px ${node.autoLayout.paddingRight}px ${node.autoLayout.paddingBottom}px ${node.autoLayout.paddingLeft}px`] : [])].join(";");
      const interactions = node.interactions.find(item => item.trigger === "click" && (item.action === "navigate" || item.action === "open-overlay"));
      const target = interactions ? screens.find(screen => screen.node.id === interactions.targetNodeId || screen.page.id === interactions.targetPageId) : undefined;
      const data = target ? ` data-destination="${escapeHtml(target.id)}" title="Open ${escapeHtml(target.node.name)}"` : "";
      const content = node.kind === "path" ? `<svg viewBox="0 0 ${node.width} ${node.height}" preserveAspectRatio="none"><path d="${escapeHtml(vectorPath(node.pathPoints, node.width, node.height))}" fill="${fill}" stroke="${stroke}" stroke-width="${node.strokeWidth}" /></svg>` : node.kind === "image" && node.imageData.startsWith("data:image/") ? `<img src="${escapeHtml(node.imageData)}" alt="${escapeHtml(node.text || node.name)}" style="width:100%;height:100%;object-fit:${node.imageFit}"/>` : escapeHtml(node.text);
      const tag = node.kind === "button" ? "button" : node.kind === "text" ? "div" : node.kind === "image" ? "div" : "div";
      const attrs = node.kind === "button" ? " type=\"button\"" : "";
      return `<${tag} class="offline-node kind-${node.kind}" style="${style}"${attrs}${data}>${content}${children}</${tag}>`;
    };
    const slides = screens.map((screen, index) => `<section class="offline-screen${index === 0 ? " active" : ""}" data-screen="${escapeHtml(screen.id)}" data-width="${screen.node.width}" data-height="${screen.node.height}" style="width:${screen.node.width}px;height:${screen.node.height}px;background:${safeCss(screen.node.fill)}">${render(screen.node, screen.index, true)}</section>`).join("");
    const options = screens.map((screen, index) => `<option value="${escapeHtml(screen.id)}"${index === 0 ? " selected" : ""}>${escapeHtml(screen.page.name)} / ${escapeHtml(screen.node.name)}</option>`).join("");
    const ids = JSON.stringify(screens.map(item => item.id));
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(document().name)} · SketchDraw presentation</title><style>*{box-sizing:border-box}body{margin:0;background:#eef1f6;color:#26354d;font:14px system-ui,sans-serif}.toolbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fff;border-bottom:1px solid #d8deea}.toolbar strong{margin-right:auto}.toolbar button,.toolbar select{min-height:32px;border:1px solid #ccd5e4;border-radius:6px;background:#fff;color:inherit;padding:0 10px}.stage{min-height:calc(100vh - 54px);display:grid;place-items:center;padding:24px;overflow:auto}.offline-screen{display:none;position:relative;flex:none;transform-origin:center;box-shadow:0 12px 40px #16223825;overflow:hidden}.offline-screen.active{display:block}.offline-node{display:flex;align-items:center;white-space:pre-wrap;overflow-wrap:anywhere}.kind-button{justify-content:center;border:0;cursor:pointer}.kind-input{padding:8px 12px}.kind-ellipse{border-radius:50%}.kind-path svg{width:100%;height:100%;overflow:visible}.kind-frame,.kind-group,.kind-componentInstance{pointer-events:none}.offline-node[data-destination]{cursor:pointer;pointer-events:auto}.offline-node img{display:block}.offline-node.kind-checkbox:before{content:"";width:16px;height:16px;flex:none;margin-right:8px;border:1px solid currentColor;border-radius:3px}.hint{color:#64728a;font-size:12px}@media(max-width:700px){.stage{place-items:start center;padding:12px}.toolbar{flex-wrap:wrap}.toolbar strong{width:100%}}</style><header class="toolbar"><strong>${escapeHtml(document().name)} · Offline presentation</strong><button id="back" type="button">Back</button><select id="screen">${options}</select><button id="zoom" type="button">Fit screen</button><span id="count" class="hint">1 / ${screens.length}</span></header><main class="stage" id="stage">${slides}</main><script>const ids=${ids};let at=0;const screens=[...document.querySelectorAll('.offline-screen')];const select=document.querySelector('#screen');function show(id){const i=ids.indexOf(id);if(i<0)return;at=i;screens.forEach((s,n)=>s.classList.toggle('active',n===i));select.value=id;document.querySelector('#count').textContent=(i+1)+' / '+ids.length;fit()}function fit(){const s=screens[at],stage=document.querySelector('#stage');if(!s)return;const scale=Math.min(1,(stage.clientWidth-32)/Number(s.dataset.width),(stage.clientHeight-32)/Number(s.dataset.height));s.style.transform='scale('+Math.max(.1,scale)+')'}select.addEventListener('change',()=>show(select.value));document.querySelector('#back').addEventListener('click',()=>show(ids[Math.max(0,at-1)]));document.querySelector('#zoom').addEventListener('click',()=>{const s=screens[at];if(s)s.style.transform='scale(1)'});document.querySelector('#stage').addEventListener('click',e=>{const target=e.target.closest('[data-destination]');if(target)show(target.dataset.destination)});window.addEventListener('resize',fit);fit();</script></html>`;
    downloadText(`${document().name.replace(/[^\w-]+/g, "-")}-presentation.html`, html, "text/html");
  };
  const importSvg = (source: string) => {
    let imported: ReturnType<typeof sanitizeSvg>;
    try { imported = sanitizeSvg(source); }
    catch (error) { addMessage(error instanceof Error ? error.message : "This SVG could not be imported"); return; }
    const current = selectedOne()?.kind === "image" ? selectedOne() : undefined;
    const name = "Imported SVG";
    if (current) {
      updateNode(current.id, { imageData: imported.data, imageFit: "contain", text: name, name });
      setSelectedIds([current.id]);
      return;
    }
    const center = viewportCenterWorld();
    const { parentId, point: localCenter } = insertionParentAt(center);
    const order = hierarchy().children(parentId).reduce((max, node) => Math.max(max, node.order), -1) + 1;
    const image = createUIElement("image", order, { x: round(localCenter.x - imported.width / 2), y: round(localCenter.y - imported.height / 2) }, parentId, { width: imported.width, height: imported.height });
    image.name = name; image.text = name; image.imageData = imported.data; image.imageFit = "contain";
    updateNodes(nodes => [...nodes, image], undefined, false); setSelectedIds([image.id]); setLeftTab("layers");
  };
  const readImage = async (file?: File) => {
    if (!file) return;
    if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) { importSvg(await file.text()); return; }
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) { addMessage("Choose a supported image up to 8 MB"); return; }
    const reader = new FileReader(); reader.onload = () => {
      const current = selectedOne()?.kind === "image" ? selectedOne() : undefined;
      const parentId = insertionParentAt().parentId;
      const node = current ?? createAt("image", viewportCenterWorld(), undefined, parentId);
      if (node) updateNode(node.id, { kind: "image", imageData: String(reader.result), text: file.name.replace(/\.[^.]+$/, "") });
    }; reader.readAsDataURL(file);
  };
  const startPrototype = () => {
    const flow = page().prototypeFlows.find(item => item.id === page().activePrototypeFlowId) ?? page().prototypeFlows[0];
    const startPageId = flow?.startPageId ?? page().id;
    const startPage = document().pages.find(item => item.id === startPageId) ?? page();
    const startNode = flow?.startNodeId ?? startPage.elements.find(item => item.kind === "frame" && item.parentId === startPage.id)?.id ?? startPage.elements.find(item => item.parentId === startPage.id)?.id ?? "";
    setPreviewPageId(startPage.id); setPreviewNodeId(startNode); setPreviewHistory([]); setPreviewOverlay(undefined); setPreviewVariables({}); setPreview(true);
  };
  const interactionPassesCondition = (interaction: UIInteraction) => {
    const condition = interaction.condition;
    if (!condition) return true;
    const overrides = previewVariables();
    const base = document().prototypeVariables.find(item => item.id === condition.variableId);
    if (!base) return false;
    const value = condition.variableId in overrides ? overrides[condition.variableId] : base.value;
    if (condition.operator === "truthy") return !!value;
    if (condition.operator === "falsy") return !value;
    if (condition.operator === "equals") return value == condition.value;
    if (condition.operator === "not-equals") return value != condition.value;
    const left = Number(value), right = Number(condition.value);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    return condition.operator === "greater" ? left > right : left < right;
  };
  const runInteraction = (interaction: UIInteraction) => {
    if (!interactionPassesCondition(interaction)) return;
    if (interaction.action === "set-variable") {
      if (!interaction.variableId || interaction.variableValue === undefined) return;
      setPreviewVariables(prev => ({ ...prev, [interaction.variableId!]: interaction.variableValue! }));
      return;
    }
    if (interaction.action === "close-overlay") { setPreviewOverlay(undefined); return; }
    if (interaction.action === "back") {
      if (previewOverlay()) { setPreviewOverlay(undefined); return; }
      const history = previewHistory(); const previous = history[history.length - 1]; if (previous) { setPreviewPageId(previous.pageId); setPreviewNodeId(previous.nodeId); setPreviewHistory(items => items.slice(0, -1)); }
      return;
    }
    if (interaction.action !== "navigate" && interaction.action !== "open-overlay") return;
    const located = interaction.targetNodeId ? document().pages.find(item => item.elements.some(node => node.id === interaction.targetNodeId)) : undefined;
    const destination = document().pages.find(item => item.id === (interaction.targetPageId || located?.id || previewPageId())) ?? document().pages[0];
    const requested = interaction.targetNodeId ? destination.elements.find(node => node.id === interaction.targetNodeId) : undefined;
    const destinationHierarchy = new UIHierarchyIndex<UIElement>(destination.id, destination.elements);
    const destinationNode = requested ? [requested, ...destinationHierarchy.ancestors(requested.id)].find(node => node.kind === "frame" && node.frameType === "screen") ?? requested : destination.elements.find(node => node.kind === "frame" && node.parentId === destination.id) ?? destination.elements.find(node => node.parentId === destination.id);
    const targetNodeId = destinationNode?.id ?? "";
    setPreviewHistory(items => [...items, { pageId: previewPageId(), nodeId: previewNodeId() }]); setPreviewTransition(interaction.transition);
    if (interaction.action === "open-overlay") setPreviewOverlay({ pageId: destination.id, nodeId: targetNodeId, position: interaction.overlayPosition ?? "center", background: interaction.overlayBackground ?? "#172235", opacity: interaction.overlayOpacity ?? 0.48, closeOnOutside: interaction.closeOnOutside ?? true });
    else { setPreviewPageId(destination.id); setPreviewNodeId(targetNodeId); setPreviewOverlay(undefined); }
  };
  createEffect(() => {
    if (!preview()) return;
    const pageId = previewOverlay()?.pageId ?? previewPageId();
    const rootId = previewOverlay()?.nodeId ?? previewNodeId();
    const targetPage = document().pages.find(item => item.id === pageId);
    if (!targetPage || !rootId) return;
    const tree = new UIHierarchyIndex<UIElement>(targetPage.id, targetPage.elements);
    const activeNodes = [tree.get(rootId), ...tree.descendants(rootId)].filter((item): item is UIElement => !!item && !item.hidden && !tree.ancestors(item.id).some(parent => parent.hidden));
    const timers = activeNodes.flatMap(node => node.interactions.filter(item => item.trigger === "timed").map(item => window.setTimeout(() => runInteraction(item), clamp(item.delayMs ?? 1000, 0, 60000))));
    onCleanup(() => timers.forEach(timer => window.clearTimeout(timer)));
  });
  const addInteraction = (node: UIElement) => updateNode(node.id, { interactions: [...node.interactions, { id: createUIDesignId("interaction"), name: "Navigate", trigger: "click", action: "navigate", transition: "instant" }] });
  const addPrototypeVariable = () => {
    if (document().prototypeVariables.length >= 100) { addMessage("This design has reached the 100 variable limit"); return; }
    const name = window.prompt("Prototype variable name", `Variable ${document().prototypeVariables.length + 1}`)?.trim().slice(0, 80);
    if (!name) return;
    if (document().prototypeVariables.some(variable => variable.name.toLowerCase() === name.toLowerCase())) { addMessage("A variable with that name already exists"); return; }
    updateDocument(doc => ({ ...doc, prototypeVariables: [...doc.prototypeVariables, { id: createUIDesignId("variable"), name, value: "" }] }));
  };
  const updatePrototypeVariable = (id: string, patch: Partial<UIPrototypeVariable>) => updateDocument(doc => ({ ...doc, prototypeVariables: doc.prototypeVariables.map(variable => variable.id === id ? { ...variable, ...patch } : variable) }), `prototype-variable:${id}`);
  const renamePage = (item: UIPage) => { const value = window.prompt("Page name", item.name); if (value?.trim()) updateDocument(doc => ({ ...doc, pages: doc.pages.map(pageItem => pageItem.id === item.id ? { ...pageItem, name: value.trim().slice(0, 120) } : pageItem) })); };
  const addPage = () => { const next: UIPage = { id: createUIDesignId("page"), name: `Page ${document().pages.length + 1}`, background: page().background, elements: [], prototypeFlows: [], activePrototypeFlowId: "", guides: [] }; updateDocument(doc => ({ ...doc, pages: [...doc.pages, next], activePageId: next.id })); setSelectedIds([]); };
  const duplicatePage = (item: UIPage) => {
    const copy = structuredClone(item); const sourcePageId = item.id; copy.id = createUIDesignId("page"); copy.name = `${item.name} copy`;
    copy.guides = copy.guides.map(guide => ({ ...guide, id: createUIDesignId("guide") }));
    const ids = new Map(copy.elements.map(node => [node.id, createUIDesignId(node.kind)]));
    for (const node of copy.elements) {
      const sourceNodeId = node.id;
      node.id = ids.get(sourceNodeId)!; node.parentId = ids.get(node.parentId) ?? copy.id;
      node.interactions = node.interactions.map(link => ({
        ...link, id: createUIDesignId("interaction"),
        targetPageId: link.targetPageId === sourcePageId ? copy.id : link.targetPageId,
        targetNodeId: link.targetNodeId ? ids.get(link.targetNodeId) ?? link.targetNodeId : undefined,
      }));
    }
    copy.prototypeFlows = copy.prototypeFlows.map(flow => ({ ...flow, id: createUIDesignId("flow"), startPageId: copy.id, startNodeId: flow.startNodeId ? ids.get(flow.startNodeId) : undefined }));
    updateDocument(doc => ({ ...doc, pages: [...doc.pages, copy], activePageId: copy.id }));
  };
  const deletePage = (item: UIPage) => { if (document().pages.length <= 1) return; if (!window.confirm(`Delete “${item.name}” and its contents?`)) return; updateDocument(doc => { const pages = doc.pages.filter(candidate => candidate.id !== item.id); return { ...doc, pages, activePageId: doc.activePageId === item.id ? pages[0].id : doc.activePageId, components: doc.components }; }); setSelectedIds([]); };
  const addToken = (type: TokenKind, presetName?: string) => {
    const preset = tokenPresets[type].find(item => item.name === presetName);
    if (type === "color") updateDocument(doc => ({ ...doc, colorTokens: [...doc.colorTokens, { id: createUIDesignId("color"), name: preset?.name ?? `Color ${doc.colorTokens.length + 1}`, value: preset?.value ?? "#365fe5" }] }));
    else if (type === "type") updateDocument(doc => ({ ...doc, typographyTokens: [...doc.typographyTokens, { id: createUIDesignId("type"), name: preset?.name ?? `Text style ${doc.typographyTokens.length + 1}`, fontFamily: preset?.fontFamily ?? "system", fontSize: preset?.fontSize ?? 16, fontWeight: preset?.fontWeight ?? 400, lineHeight: preset?.lineHeight ?? 1.4, letterSpacing: preset?.letterSpacing ?? 0 }] }));
    else if (type === "spacing") updateDocument(doc => ({ ...doc, spacingTokens: [...doc.spacingTokens, { id: createUIDesignId("space"), name: preset?.name ?? `Space ${doc.spacingTokens.length + 1}`, value: preset?.number ?? 8, unit: "px" }] }));
    else if (type === "radius") updateDocument(doc => ({ ...doc, radiusTokens: [...doc.radiusTokens, { id: createUIDesignId("radius"), name: preset?.name ?? `Radius ${doc.radiusTokens.length + 1}`, value: preset?.number ?? 8, unit: "px" }] }));
    else updateDocument(doc => ({ ...doc, effectTokens: [...doc.effectTokens, { id: createUIDesignId("effect"), name: preset?.name ?? `Effect ${doc.effectTokens.length + 1}`, value: preset?.value ?? "0 4px 14px #26354d24" }] }));
  };
  const editTypographyToken = (id: string, patch: Partial<UITypographyStyle>) => updateDocument(doc => {
    const source = doc.typographyTokens.find(token => token.id === id);
    if (!source) return doc;
    const token = source.aliasOf ? materializeTypographyToken(source, doc.colorModes.map(mode => mode.id), doc.typographyTokens) : source;
    return { ...doc, typographyTokens: doc.typographyTokens.map(item => item.id === id ? { ...token, modeValues: { ...token.modeValues, [doc.activeColorModeId]: { ...(token.modeValues?.[doc.activeColorModeId] ?? resolveTypographyToken(source, doc.activeColorModeId, doc.typographyTokens) ?? token), ...patch } } } : item) };
  });
  const editColorToken = (id: string, value: string) => updateDocument(doc => {
    const source = doc.colorTokens.find(token => token.id === id);
    if (!source) return doc;
    const token = source.aliasOf ? materializeColorToken(source, doc.colorModes.map(mode => mode.id), doc.colorTokens) : source;
    return { ...doc, colorTokens: doc.colorTokens.map(item => item.id === id ? { ...token, modeValues: { ...token.modeValues, [doc.activeColorModeId]: value } } : item) };
  });
  const editValueToken = (type: "spacing" | "radius", id: string, value: number) => updateDocument(doc => {
    const collection = type === "spacing" ? doc.spacingTokens : doc.radiusTokens;
    const source = collection.find(token => token.id === id);
    if (!source) return doc;
    const token = source.aliasOf ? materializeValueToken(source, doc.colorModes.map(mode => mode.id), collection) : source;
    const updated = { ...token, modeValues: { ...token.modeValues, [doc.activeColorModeId]: value } };
    return type === "spacing"
      ? { ...doc, spacingTokens: doc.spacingTokens.map(item => item.id === id ? updated : item) }
      : { ...doc, radiusTokens: doc.radiusTokens.map(item => item.id === id ? updated : item) };
  });
  const editEffectToken = (id: string, value: string) => updateDocument(doc => {
    const source = doc.effectTokens.find(token => token.id === id);
    if (!source) return doc;
    const token = source.aliasOf ? materializeEffectToken(source, doc.colorModes.map(mode => mode.id), doc.effectTokens) : source;
    return { ...doc, effectTokens: doc.effectTokens.map(item => item.id === id ? { ...token, modeValues: { ...token.modeValues, [doc.activeColorModeId]: value }, aliasOf: undefined } : item) };
  });
  const changeTokenAlias = (type: TokenKind, id: string, aliasOf: string) => updateDocument(doc => {
    const modeIds = doc.colorModes.map(mode => mode.id);
    if (type === "color") {
      const source = doc.colorTokens.find(token => token.id === id); if (!source) return doc;
      const updated = aliasOf ? { ...source, aliasOf, modeValues: {} } : source.aliasOf ? materializeColorToken(source, modeIds, doc.colorTokens) : source;
      return { ...doc, colorTokens: doc.colorTokens.map(token => token.id === id ? updated : token) };
    }
    if (type === "type") {
      const source = doc.typographyTokens.find(token => token.id === id); if (!source) return doc;
      const updated = aliasOf ? { ...source, aliasOf, modeValues: {} } : source.aliasOf ? materializeTypographyToken(source, modeIds, doc.typographyTokens) : source;
      return { ...doc, typographyTokens: doc.typographyTokens.map(token => token.id === id ? updated : token) };
    }
    if (type === "spacing" || type === "radius") {
      const collection = type === "spacing" ? doc.spacingTokens : doc.radiusTokens;
      const source = collection.find(token => token.id === id); if (!source) return doc;
      const updated = aliasOf ? { ...source, aliasOf, modeValues: {} } : source.aliasOf ? materializeValueToken(source, modeIds, collection) : source;
      return type === "spacing"
        ? { ...doc, spacingTokens: doc.spacingTokens.map(token => token.id === id ? updated : token) }
        : { ...doc, radiusTokens: doc.radiusTokens.map(token => token.id === id ? updated : token) };
    }
    const source = doc.effectTokens.find(token => token.id === id); if (!source) return doc;
    const updated = aliasOf ? { ...source, aliasOf, modeValues: {} } : source.aliasOf ? materializeEffectToken(source, modeIds, doc.effectTokens) : source;
    return { ...doc, effectTokens: doc.effectTokens.map(token => token.id === id ? updated : token) };
  });
  const removeToken = (type: "color" | "type" | "spacing" | "radius" | "effect", id: string) => updateDocument(doc => {
    const colorValue = (tokenId: string, fallback: string) => resolveColorToken(doc.colorTokens, tokenId, doc.activeColorModeId, fallback);
    const spacingValue = (tokenId: string, fallback: number) => resolveValueToken(doc.spacingTokens.find(item => item.id === tokenId), doc.activeColorModeId, doc.spacingTokens) ?? fallback;
    const cleanElement = (element: UIElement): UIElement => {
      const typeToken = type === "type" && element.typographyTokenId === id ? resolveTypographyToken(doc.typographyTokens.find(token => token.id === id), doc.activeColorModeId, doc.typographyTokens) : undefined;
      const effectToken = type === "effect" && element.effectTokenId === id ? resolveEffectToken(doc.effectTokens.find(token => token.id === id), doc.activeColorModeId, doc.effectTokens) : undefined;
      const spacing = element.autoLayout;
      return {
        ...element,
        fill: type === "color" && element.fillTokenId === id ? colorValue(id, element.fill) : element.fill,
        stroke: type === "color" && element.strokeTokenId === id ? colorValue(id, element.stroke) : element.stroke,
        fillTokenId: type === "color" && element.fillTokenId === id ? "" : element.fillTokenId,
        strokeTokenId: type === "color" && element.strokeTokenId === id ? "" : element.strokeTokenId,
        fontFamily: typeToken?.fontFamily ?? element.fontFamily,
        fontSize: typeToken?.fontSize ?? element.fontSize,
        fontWeight: typeToken?.fontWeight ?? element.fontWeight,
        lineHeight: typeToken?.lineHeight ?? element.lineHeight,
        letterSpacing: typeToken?.letterSpacing ?? element.letterSpacing,
        typographyTokenId: type === "type" && element.typographyTokenId === id ? "" : element.typographyTokenId,
        radius: type === "radius" && element.radiusTokenId === id ? resolveValueToken(doc.radiusTokens.find(item => item.id === id), doc.activeColorModeId, doc.radiusTokens) ?? element.radius : element.radius,
        radiusTokenId: type === "radius" && element.radiusTokenId === id ? "" : element.radiusTokenId,
        effectValue: effectToken ?? element.effectValue,
        effectTokenId: type === "effect" && element.effectTokenId === id ? "" : element.effectTokenId,
        autoLayout: type === "spacing" ? {
          ...spacing,
          gap: spacing.gapTokenId === id ? spacingValue(id, spacing.gap) : spacing.gap,
          paddingTop: spacing.paddingTopTokenId === id ? spacingValue(id, spacing.paddingTop) : spacing.paddingTop,
          paddingRight: spacing.paddingRightTokenId === id ? spacingValue(id, spacing.paddingRight) : spacing.paddingRight,
          paddingBottom: spacing.paddingBottomTokenId === id ? spacingValue(id, spacing.paddingBottom) : spacing.paddingBottom,
          paddingLeft: spacing.paddingLeftTokenId === id ? spacingValue(id, spacing.paddingLeft) : spacing.paddingLeft,
          gapTokenId: spacing.gapTokenId === id ? "" : spacing.gapTokenId,
          paddingTopTokenId: spacing.paddingTopTokenId === id ? "" : spacing.paddingTopTokenId,
          paddingRightTokenId: spacing.paddingRightTokenId === id ? "" : spacing.paddingRightTokenId,
          paddingBottomTokenId: spacing.paddingBottomTokenId === id ? "" : spacing.paddingBottomTokenId,
          paddingLeftTokenId: spacing.paddingLeftTokenId === id ? "" : spacing.paddingLeftTokenId,
        } : spacing,
      };
    };
    const pages = doc.pages.map(item => ({ ...item, elements: item.elements.map(cleanElement) }));
    const components = doc.components.map(component => ({ ...component, root: cleanElement(component.root), children: component.children.map(cleanElement) }));
    const modeIds = doc.colorModes.map(mode => mode.id);
    if (type === "color") {
      const aliases = doc.colorTokens.filter(token => token.aliasOf === id).map(token => materializeColorToken(token, modeIds, doc.colorTokens));
      return { ...doc, pages, components, colorTokens: doc.colorTokens.filter(token => token.id !== id).map(token => aliases.find(alias => alias.id === token.id) ?? token) };
    }
    if (type === "type") {
      const aliases = doc.typographyTokens.filter(token => token.aliasOf === id).map(token => materializeTypographyToken(token, modeIds, doc.typographyTokens));
      return { ...doc, pages, components, typographyTokens: doc.typographyTokens.filter(token => token.id !== id).map(token => aliases.find(alias => alias.id === token.id) ?? token) };
    }
    if (type === "spacing") {
      const aliases = doc.spacingTokens.filter(token => token.aliasOf === id).map(token => materializeValueToken(token, modeIds, doc.spacingTokens));
      return reflowDocument({ ...doc, pages, components, spacingTokens: doc.spacingTokens.filter(token => token.id !== id).map(token => aliases.find(alias => alias.id === token.id) ?? token) });
    }
    if (type === "radius") {
      const aliases = doc.radiusTokens.filter(token => token.aliasOf === id).map(token => materializeValueToken(token, modeIds, doc.radiusTokens));
      return { ...doc, pages, components, radiusTokens: doc.radiusTokens.filter(token => token.id !== id).map(token => aliases.find(alias => alias.id === token.id) ?? token) };
    }
    const aliases = doc.effectTokens.filter(token => token.aliasOf === id).map(token => materializeEffectToken(token, modeIds, doc.effectTokens));
    return { ...doc, pages, components, effectTokens: doc.effectTokens.filter(token => token.id !== id).map(token => aliases.find(alias => alias.id === token.id) ?? token) };
  });
  const exportTokens = () => downloadText(`${document().name.replace(/[^\w-]+/g, "-")}-tokens.json`, JSON.stringify({ colorModes: document().colorModes, colors: document().colorTokens, typography: document().typographyTokens, spacing: document().spacingTokens, radius: document().radiusTokens, effects: document().effectTokens }, null, 2), "application/json");
  const exportComponentLibrary = () => {
    const components = document().components;
    if (!components.length) { addMessage("Create a reusable component before exporting a library"); return; }
    downloadText(`${document().name.replace(/[^\w-]+/g, "-")}-components.json`, JSON.stringify({ format: "SketchDrawComponentLibrary", version: 1, name: `${document().name} components`, components }, null, 2), "application/json");
  };
  const importComponentLibrary = async (file?: File) => {
    if (!file || file.size > 10 * 1024 * 1024) { if (file) addMessage("Component libraries must be 10 MB or smaller"); return; }
    try {
      const value = JSON.parse(await file.text()) as { format?: unknown; version?: unknown; name?: unknown; components?: unknown };
      if (value.format !== "SketchDrawComponentLibrary" || value.version !== 1 || !Array.isArray(value.components) || !value.components.length || value.components.length > 500) throw new Error("Unsupported library format");
      const current = document();
      const imported = normalizeUIDesignDocument({ ...current, components: [...current.components, ...value.components] });
      if (!imported || imported.components.length !== current.components.length + value.components.length) throw new Error("Invalid component definitions");
      const additions = imported.components.slice(current.components.length);
      const libraryId = createUIDesignId("library");
      const name = typeof value.name === "string" && value.name.trim() ? value.name.trim().slice(0, 120) : file.name.replace(/\.json$/i, "").slice(0, 120);
      updateDocument(doc => ({ ...doc, components: [...doc.components, ...additions], assetLibraries: [...doc.assetLibraries, { id: libraryId, name, enabled: true, assetIds: additions.map(item => item.id) }] }));
      addMessage(`Imported ${additions.length} component${additions.length === 1 ? "" : "s"} from ${name}`);
    } catch (error) { addMessage(error instanceof Error ? error.message : "This component library is invalid"); }
  };
  const removeComponentLibrary = (libraryId: string) => {
    const library = document().assetLibraries.find(item => item.id === libraryId);
    if (!library) return;
    const ids = new Set(library.assetIds);
    const used = document().pages.some(item => item.elements.some(node => ids.has(node.componentId)));
    if (used) { addMessage("This library is in use. Detach or remove its instances before removing it."); return; }
    if (!window.confirm(`Remove ${library.name} and its imported components from this design?`)) return;
    updateDocument(doc => ({ ...doc, assetLibraries: doc.assetLibraries.filter(item => item.id !== libraryId), components: doc.components.filter(item => !ids.has(item.id)) }));
  };
  const toggleComponentLibrary = (libraryId: string) => updateDocument(doc => ({ ...doc, assetLibraries: doc.assetLibraries.map(item => item.id === libraryId ? { ...item, enabled: !item.enabled } : item) }));
  const importTokens = async (file?: File) => {
    if (!file || file.size > 1_000_000) return;
    try {
      const value = JSON.parse(await file.text()) as Record<string, unknown>;
      const current = document();
      const imported = normalizeUIDesignDocument({
        ...current,
        colorTokens: value.colors ?? current.colorTokens,
        typographyTokens: value.typography ?? current.typographyTokens,
        spacingTokens: value.spacing ?? current.spacingTokens,
        radiusTokens: value.radius ?? current.radiusTokens,
        effectTokens: value.effects ?? current.effectTokens,
        colorModes: value.colorModes ?? current.colorModes,
      });
      if (!imported) throw new Error("Invalid token collections");
      updateDocument(() => reflowDocument(imported));
      addMessage("Design tokens imported");
    } catch { addMessage("Token file is invalid or contains unsupported values"); }
  };
  const replaceText = () => {
    const query = findQuery(); if (!query) return;
    updateDocument(doc => ({ ...doc, pages: doc.pages.map(item => ({ ...item, elements: item.elements.map(node => node.text.includes(query) ? { ...node, text: node.text.split(query).join(replaceQuery()) } : node) })) })); setFindOpen(false);
  };
  const lintResults = createMemo(() => {
    const findings: Array<{ id: string; severity: "warning" | "info"; text: string; node?: UIElement; pageId: string }> = [];
    for (const currentPage of document().pages) {
      const tree = new UIHierarchyIndex<UIElement>(currentPage.id, currentPage.elements);
      for (const node of currentPage.elements) {
        if (node.hidden || tree.ancestors(node.id).some(parent => parent.hidden)) continue;
        const location = `${currentPage.name} / ${node.name}`;
        if (["button", "input", "checkbox"].includes(node.kind) && (node.width < 44 || node.height < 44)) findings.push({ id: `${currentPage.id}-${node.id}-touch`, pageId: currentPage.id, severity: "warning", text: `${location}: interactive target is smaller than 44 × 44 px`, node });
        if (node.kind === "text" && node.fontSize < 12) findings.push({ id: `${currentPage.id}-${node.id}-font`, pageId: currentPage.id, severity: "warning", text: `${location}: text is smaller than 12 px`, node });
        if (node.kind === "image" && !node.text.trim()) findings.push({ id: `${currentPage.id}-${node.id}-alt`, pageId: currentPage.id, severity: "warning", text: `${location}: image needs descriptive alternative text`, node });
        if (node.fillTokenId && !document().colorTokens.some(token => token.id === node.fillTokenId)) findings.push({ id: `${currentPage.id}-${node.id}-token`, pageId: currentPage.id, severity: "warning", text: `${location}: missing color token reference`, node });
        if (["text", "button", "input"].includes(node.kind)) {
          const resolvedFill = resolveColorToken(document().colorTokens, node.fillTokenId, document().activeColorModeId, node.fill);
          const foreground = node.kind === "text" ? resolvedFill : readableTextColor(resolvedFill);
          const parent = tree.ancestors(node.id).find(item => (item.kind === "frame" || item.kind === "group") && item.fill !== "none");
          const background = node.kind === "text" ? (parent ? resolveColorToken(document().colorTokens, parent.fillTokenId, document().activeColorModeId, parent.fill) : currentPage.background) : resolvedFill;
          const surfaces = node.kind === "text" && parent?.fillGradient ? [parent.fillGradient.from, parent.fillGradient.to] : node.kind !== "text" && node.fillGradient ? [node.fillGradient.from, node.fillGradient.to] : [background];
          const ratios = surfaces.map(surface => contrastRatio(foreground, surface)).filter((value): value is number => value !== undefined);
          const ratio = ratios.length ? Math.min(...ratios) : undefined;
          if (ratio !== undefined && ratio < 4.5) findings.push({ id: `${currentPage.id}-${node.id}-contrast`, pageId: currentPage.id, severity: "warning", text: `${location}: minimum contrast is ${ratio.toFixed(2)}:1 (4.5:1 recommended)`, node });
        }
      }
    }
    return findings;
  });
  const prototypeDiagnostics = createMemo(() => {
    const issues: string[] = [];
    for (const item of document().pages) {
      for (const flow of item.prototypeFlows) {
        const targetPage = document().pages.find(candidate => candidate.id === flow.startPageId);
        if (!targetPage) issues.push(`${flow.name}: starting page is missing`);
        else if (flow.startNodeId && !targetPage.elements.some(node => node.id === flow.startNodeId && node.kind === "frame")) issues.push(`${flow.name}: starting frame is missing`);
      }
      for (const node of item.elements) for (const interaction of node.interactions) {
        if ((interaction.action === "navigate" || interaction.action === "open-overlay") && interaction.targetNodeId) {
          const found = document().pages.some(candidate => candidate.elements.some(target => target.id === interaction.targetNodeId && target.kind === "frame"));
          if (!found) issues.push(`${item.name} / ${node.name} / ${interaction.name}: destination frame is missing`);
        } else if ((interaction.action === "navigate" || interaction.action === "open-overlay") && interaction.targetPageId && !document().pages.some(candidate => candidate.id === interaction.targetPageId)) issues.push(`${item.name} / ${node.name} / ${interaction.name}: destination page is missing`);
        if (interaction.condition && !document().prototypeVariables.some(variable => variable.id === interaction.condition?.variableId)) issues.push(`${item.name} / ${node.name} / ${interaction.name}: condition variable is missing`);
        if (interaction.action === "set-variable" && !document().prototypeVariables.some(variable => variable.id === interaction.variableId)) issues.push(`${item.name} / ${node.name} / ${interaction.name}: action variable is missing`);
      }
    }
    return [...new Set(issues)];
  });
  const exportAccessibilityReport = () => downloadText(`${document().name.replace(/[^\w-]+/g, "-")}-accessibility.json`, JSON.stringify({ document: document().name, generatedAt: new Date().toISOString(), summary: { pages: document().pages.length, findings: lintResults().length, warnings: lintResults().filter(item => item.severity === "warning").length }, findings: lintResults().map(({ id, pageId, severity, text, node }) => ({ id, page: document().pages.find(item => item.id === pageId)?.name, pageId, severity, text, nodeId: node?.id, layer: node?.name })) }, null, 2), "application/json");
  const gestureRect = createMemo(() => {
    const active = gesture();
    return active?.kind === "draw" || active?.kind === "marquee" ? normalizeRect(active.start, active.current) : undefined;
  });
  const sceneExtent = createMemo(() => unionRects(topVisible().map(node => worldBounds(node)).filter((box): box is UIRect => !!box)) ?? { x: -1600, y: -1200, width: 3200, height: 2400 });
  const layerMatches = (node: UIElement, query: string): boolean => !query || `${node.name} ${node.kind}`.toLowerCase().includes(query) || hierarchy().children(node.id).some(child => layerMatches(child, query));
  const componentRoot = (node: UIElement) => node.kind === "componentInstance" ? document().components.find(item => item.id === node.componentId)?.root : undefined;
  const nodeStyleBindings = (node: UIElement) => ({
    fillOverride: () => node.fillTokenId ? resolveColorToken(document().colorTokens, node.fillTokenId, document().activeColorModeId, node.fill) : undefined,
    strokeOverride: () => node.strokeTokenId ? resolveColorToken(document().colorTokens, node.strokeTokenId, document().activeColorModeId, node.stroke) : undefined,
    radiusOverride: () => resolveValueToken(document().radiusTokens.find(item => item.id === node.radiusTokenId), document().activeColorModeId, document().radiusTokens),
    effectOverride: () => resolveEffectToken(document().effectTokens.find(token => token.id === node.effectTokenId), document().activeColorModeId, document().effectTokens),
    typographyOverride: () => resolveTypographyToken(document().typographyTokens.find(token => token.id === node.typographyTokenId), document().activeColorModeId, document().typographyTokens),
  });
  const renderChildren = (parentId: string, interactive = false): JSX.Element => <For each={hierarchy().children(parentId).filter(node => !isEffectively(node, "hidden"))}>{node => { const master = componentRoot(node); return <NodeView node={node} {...nodeStyleBindings(node)} parentIsPage={parentId === page().id} selected={selectedIds().includes(node.id) && !isEffectively(node, "locked")} editing={editingId() === node.id} interactive={interactive} visualKind={master?.kind} renderChildren={childId => renderChildren(childId, interactive)} onDown={handleNodeDown} onResize={startResize} onDouble={item => { if (["text", "button", "input", "checkbox"].includes(item.kind)) setEditingId(item.id); else renameNode(item); }} onText={(item, text) => updateNode(item.id, { text }, `text:${item.id}`)} onInteraction={runInteraction} onPointDown={startPoint} />; }}</For>;
  const renderLayerTree = (parentId: string, depth: number): JSX.Element => <For each={hierarchy().children(parentId).slice().reverse().filter(node => layerMatches(node, layerSearch().trim().toLowerCase()))}>{node => {
    const container = ["frame", "group", "componentInstance"].includes(node.kind);
    const hidden = isEffectively(node, "hidden"); const locked = isEffectively(node, "locked");
    return <>
      <div class={`ui-layer-row ${selectedIds().includes(node.id) ? "is-selected" : ""} ${hidden ? "is-muted" : ""} ${dragIds().includes(node.id) ? "is-dragging" : ""} ${layerDrop()?.targetId === node.id ? `is-drop-${layerDrop()?.position}` : ""}`} style={{ "--layer-depth": depth }} draggable={!locked} onContextMenu={event => openContextMenu(event, node)} onDragStart={event => { const selectedIdsForDrag = selectedIds().includes(node.id) ? rootsOnly(selectedIds()) : [node.id]; const ids = selectedIdsForDrag.filter(id => { const candidate = hierarchy().get(id); return !!candidate && !isEffectively(candidate, "locked"); }); if (!ids.length) { event.preventDefault(); return; } activeLayerDragIds = ids; setDragIds(ids); setLayerDrop(undefined); event.dataTransfer?.clearData(); event.dataTransfer?.setData("application/x-sketchdraw-layer-ids", ids.join(",")); event.dataTransfer?.setData("text/plain", ids.join(",")); if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { activeLayerDragIds = []; setDragIds([]); setLayerDrop(undefined); }} onDragOver={event => handleLayerDragOver(node, event)} onDrop={event => handleLayerDrop(node, event)}>
        <span class="ui-layer-indent" style={{ width: `${depth * 13}px` }} />
        {container ? <button class="ui-layer-caret" aria-label={`${collapsed().has(node.id) ? "Expand" : "Collapse"} ${node.name}`} aria-expanded={!collapsed().has(node.id)} onClick={event => { event.stopPropagation(); toggleCollapsed(node.id); }}>{collapsed().has(node.id) ? "›" : "⌄"}</button> : <span class="ui-layer-caret-placeholder" />}
        <button class="ui-layer-main" onClick={event => selectNode(node, event.shiftKey)} onDblClick={event => { event.stopPropagation(); renameNode(node); }} title={`${node.name} · double-click to rename`}><AssetIcon kind={node.kind} /><span class="ui-layer-name">{node.name}</span></button>
        <button class={`ui-layer-icon ${hidden ? "is-off" : ""}`} aria-label={`${hidden ? "Show" : "Hide"} ${node.name}`} aria-pressed={node.hidden} title={hidden && !node.hidden ? "Hidden by parent" : node.hidden ? "Show layer" : "Hide layer"} disabled={hidden && !node.hidden} onClick={() => updateNode(node.id, { hidden: !node.hidden })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6Z" />{hidden ? <path d="m4 4 16 16" /> : <circle cx="12" cy="12" r="2.5" />}</svg></button>
        <button class={`ui-layer-icon ${locked ? "is-on" : ""}`} aria-label={`${locked ? "Unlock" : "Lock"} ${node.name}`} aria-pressed={node.locked} title={locked && !node.locked ? "Locked by parent" : node.locked ? "Unlock layer" : "Lock layer"} disabled={locked && !node.locked} onClick={() => updateNode(node.id, { locked: !node.locked })}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" />{locked ? <path d="M8 10V7a4 4 0 0 1 8 0v3" /> : <path d="M8 10V7a4 4 0 0 1 7-2" />}</svg></button>
      </div>
      <Show when={container && !collapsed().has(node.id)}>{renderLayerTree(node.id, depth + 1)}</Show>
    </>;
  }}</For>;
  const previewNodeText = (node: UIElement) => {
    const variables = document().prototypeVariables;
    const text = node.text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, key: string) => {
      const variable = variables.find(item => item.id === key || item.name === key);
      return variable ? String(variable.value) : `{{${key}}}`;
    });
    return text === node.text ? node : { ...node, text };
  };
  const renderPreviewTree = (parentId: string, previewPage: UIPage, index = new UIHierarchyIndex<UIElement>(previewPage.id, previewPage.elements)): JSX.Element => <For each={index.children(parentId).filter(node => !node.hidden && !index.ancestors(node.id).some(parent => parent.hidden))}>{node => { const master = componentRoot(node); return <NodeView node={previewNodeText(node)} {...nodeStyleBindings(node)} parentIsPage={node.parentId === previewPage.id} selected={false} editing={false} interactive visualKind={master?.kind} renderChildren={childId => renderPreviewTree(childId, previewPage, index)} onDown={() => {}} onResize={() => {}} onDouble={() => {}} onText={(item, text) => updateNode(item.id, { text }, `preview-text:${item.id}`)} onInteraction={runInteraction} onPointDown={() => {}} />; }}</For>;
  const renderPreviewNode = (nodeId: string, previewPage: UIPage): JSX.Element => {
    const source = previewPage.elements.find(item => item.id === nodeId); if (!source) return <div />;
    const node = { ...source, parentId: previewPage.id, x: 0, y: 0, rotation: 0 };
    const master = componentRoot(node); const index = new UIHierarchyIndex<UIElement>(previewPage.id, previewPage.elements);
    return <NodeView node={previewNodeText(node)} {...nodeStyleBindings(node)} root parentIsPage selected={false} editing={false} interactive visualKind={master?.kind} renderChildren={childId => renderPreviewTree(childId, previewPage, index)} onDown={() => {}} onResize={() => {}} onDouble={() => {}} onText={(item, text) => updateNode(item.id, { text }, `preview-text:${item.id}`)} onInteraction={runInteraction} onPointDown={() => {}} />;
  };
  const renderResponsiveChildren = (parentId: string, previewPage: UIPage, index: UIHierarchyIndex<UIElement>): JSX.Element => <For each={index.children(parentId).filter(node => !node.hidden && !index.ancestors(node.id).some(parent => parent.hidden))}>{node => { const master = componentRoot(node); return <NodeView node={node} {...nodeStyleBindings(node)} parentIsPage={parentId === previewPage.id} selected={false} editing={false} interactive={false} visualKind={master?.kind} renderChildren={childId => renderResponsiveChildren(childId, previewPage, index)} onDown={() => {}} onResize={() => {}} onDouble={() => {}} onText={() => {}} onInteraction={() => {}} onPointDown={() => {}} />; }}</For>;
  const renderResponsiveFrame = (previewPage: UIPage, frameId: string): JSX.Element => {
    const source = previewPage.elements.find(item => item.id === frameId); if (!source) return <div />;
    const node = { ...source, parentId: previewPage.id, x: 0, y: 0, rotation: 0 };
    const master = componentRoot(node); const index = new UIHierarchyIndex<UIElement>(previewPage.id, previewPage.elements);
    return <NodeView node={node} {...nodeStyleBindings(node)} root parentIsPage selected={false} editing={false} interactive={false} visualKind={master?.kind} renderChildren={childId => renderResponsiveChildren(childId, previewPage, index)} onDown={() => {}} onResize={() => {}} onDouble={() => {}} onText={() => {}} onInteraction={() => {}} onPointDown={() => {}} />;
  };

  onMount(() => {
    if (stage) { setCamera({ x: stage.clientWidth / 2, y: stage.clientHeight / 2, zoom: 0.8 }); setStageSize({ width: stage.clientWidth, height: stage.clientHeight }); }
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null; const typing = !!target?.matches("input,textarea,select,[contenteditable='true']");
      if (event.key === "Alt") setAltHeld(true);
      if (event.code === "Space" && !typing) { spaceHeld = true; if (stage) stage.style.cursor = "grab"; }
      if (preview() && !typing) {
        const pageId = previewOverlay()?.pageId ?? previewPageId(); const rootId = previewOverlay()?.nodeId ?? previewNodeId();
        const previewPage = document().pages.find(item => item.id === pageId);
        if (previewPage && rootId) {
          const index = new UIHierarchyIndex<UIElement>(previewPage.id, previewPage.elements);
          const active = [index.get(rootId), ...index.descendants(rootId)].filter((node): node is UIElement => !!node && !node.hidden && !index.ancestors(node.id).some(parent => parent.hidden));
          const matches = active.flatMap(node => node.interactions.filter(link => link.trigger === "keyboard" && (link.key ?? "Enter").toLowerCase() === event.key.toLowerCase()));
          if (matches.length) { event.preventDefault(); matches.forEach(runInteraction); return; }
        }
      }
      if (event.key === "Escape" && preview()) { event.preventDefault(); setPreview(false); return; }
      if (event.key === "Escape" && guidesMenuOpen()) { event.preventDefault(); setGuidesMenuOpen(false); return; }
      if (typing || preview()) return;
      if ((event.ctrlKey || event.metaKey) && event.code === "Semicolon") {
        event.preventDefault();
        if (event.shiftKey) updatePage(current => ({ ...current, guides: current.guides.filter(guide => guide.locked) }), "guide-clear");
        else updateGuideSettings({ enabled: !document().guideSettings.enabled });
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? props.session.redo() : props.session.undo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); props.session.redo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelection(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "g") { event.preventDefault(); event.shiftKey ? ungroupSelection() : groupSelection(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") { event.preventDefault(); setFindOpen(true); return; }
      if (event.key === "Delete" || event.key === "Backspace") { deleteSelection(); return; }
      if (event.key === "Escape" && contextMenu()) { event.preventDefault(); setContextMenu(undefined); return; }
      if (event.key === "Escape") { setTool("select"); setSelectedIds([]); setConnectSource(""); setPreview(false); setFindOpen(false); setFramePresetOpen(false); return; }
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        if (event.key.toLowerCase() === "v") setTool("select"); else if (event.key.toLowerCase() === "h") setTool("hand"); else if (event.key.toLowerCase() === "f") setTool("frame"); else if (event.key.toLowerCase() === "r") setTool("rectangle"); else if (event.key.toLowerCase() === "o") setTool("ellipse"); else if (event.key.toLowerCase() === "t") setTool("text"); else if (event.key.toLowerCase() === "l") setTool("line");
      }
    };
    const onKeyUp = (event: KeyboardEvent) => { if (event.key === "Alt") setAltHeld(false); if (event.code === "Space") { spaceHeld = false; if (stage) stage.style.cursor = tool() === "hand" ? "grab" : ""; } };
    const onBlur = () => { spaceHeld = false; setAltHeld(false); if (stage) stage.style.cursor = tool() === "hand" ? "grab" : ""; };
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKeyUp); window.addEventListener("blur", onBlur); onCleanup(() => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("blur", onBlur); });
    const observer = new ResizeObserver(() => { if (!stage) return; setStageSize({ width: stage.clientWidth, height: stage.clientHeight }); if (camera().x === 0 && camera().y === 0) setCamera({ x: stage.clientWidth / 2, y: stage.clientHeight / 2, zoom: 0.8 }); }); if (stage) observer.observe(stage); onCleanup(() => observer.disconnect());
  });

  const tools: Array<{ id: Tool; label: string; key?: string }> = [{ id: "select", label: "Select", key: "V" }, { id: "hand", label: "Pan", key: "H" }, { id: "frame", label: "Frame", key: "F" }, { id: "rectangle", label: "Rectangle", key: "R" }, { id: "ellipse", label: "Ellipse", key: "O" }, { id: "line", label: "Line", key: "L" }, { id: "path", label: "Vector path", key: "P" }, { id: "text", label: "Text", key: "T" }, { id: "button", label: "Button" }, { id: "input", label: "Input" }, { id: "checkbox", label: "Checkbox" }, { id: "image", label: "Image" }];

  const toolsForHeader = tools.filter(item => ["hand", "frame", "rectangle", "ellipse", "line", "path", "text", "image"].includes(item.id));

  return <div class="ui-editor-shell" onPointerDown={event => { const target = event.target instanceof Element ? event.target : undefined; if (!target?.closest(".ui-guide-menu-anchor")) setGuidesMenuOpen(false); }}>
    <header class="ui-editor-topbar">
      <button class="ui-topbar-back" onClick={() => props.session.goHome()} aria-label="Back to UI Design home" title="Home">&#8592;</button>
      <div class="ui-topbar-file"><span class="ui-brand-mark">U</span><div><strong>{document().name}</strong><small>{props.session.saving() ? "Saving…" : props.session.dirty() ? "Unsaved changes" : props.session.savedAt() ? `Saved ${props.session.savedAt()}` : "Local design"}</small></div></div>
      <nav class="ui-tools" aria-label="Design tools">
        <button type="button" class={`ui-tool-button ${tool() === "select" ? "is-active" : ""}`} aria-label="Selection tool" title="Selection tool (V)" onClick={() => setTool("select")}>&#8598;</button>
        <For each={toolsForHeader}>{item => item.id === "frame" ? <div class="ui-topbar-menu-anchor"><button type="button" class={`ui-tool-button ${tool() === item.id ? "is-active" : ""}`} aria-label={item.label} title={`${item.label} (F) · Choose a screen or container size`} aria-expanded={framePresetOpen()} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setFramePresetPosition({ left: Math.min(rect.left, Math.max(8, window.innerWidth - 320)), top: rect.bottom + 4 }); setTool("frame"); setFramePresetOpen(value => !value); }}><ToolIcon tool={item.id} /></button><Show when={framePresetOpen()}><div class="ui-frame-preset-menu" style={{ left: `${framePresetPosition().left}px`, top: `${framePresetPosition().top}px` }} role="menu" aria-label="Create frame preset"><For each={UI_FRAME_PRESETS}>{preset => <button type="button" role="menuitem" onClick={() => chooseFramePreset(preset.id)}>{preset.label}<span>{preset.id === "custom" ? "Choose dimensions" : `${preset.width} × ${preset.height}`}</span></button>}</For></div></Show></div> : <button type="button" class={`ui-tool-button ${tool() === item.id ? "is-active" : ""}`} aria-label={item.label} title={`${item.label}${item.key ? ` (${item.key})` : ""}`} onClick={() => item.id === "image" ? imageInput?.click() : setTool(item.id)}><ToolIcon tool={item.id} /></button>}</For>
      </nav>
      <div class="ui-topbar-view-actions" aria-label="Canvas view controls"><button type="button" title="Fit all" onClick={() => fitContent()}>Fit</button><button type="button" title="Fit selection" disabled={!selected().length} onClick={() => fitContent(selected())}>Selection</button><button type="button" title="Zoom to 100%" onClick={() => setCamera(current => ({ ...current, zoom: 1 }))}>100%</button><button type="button" title="Zoom out" onClick={() => zoomAt((stage?.getBoundingClientRect().left ?? 0) + (stage?.clientWidth ?? 0) / 2, (stage?.getBoundingClientRect().top ?? 0) + (stage?.clientHeight ?? 0) / 2, camera().zoom / 1.2)}>−</button><output>{zoomLabel()}</output><button type="button" title="Zoom in" onClick={() => zoomAt((stage?.getBoundingClientRect().left ?? 0) + (stage?.clientWidth ?? 0) / 2, (stage?.getBoundingClientRect().top ?? 0) + (stage?.clientHeight ?? 0) / 2, camera().zoom * 1.2)}>＋</button></div>
      <div class="ui-topbar-menu-anchor ui-guide-menu-anchor"><button type="button" class="ui-topbar-menu-trigger" aria-haspopup="dialog" aria-expanded={guidesMenuOpen()} onClick={event => { if (!guidesMenuOpen()) { const rect = event.currentTarget.getBoundingClientRect(); const width = Math.min(360, window.innerWidth - 16); const height = Math.min(560, window.innerHeight - 16); setGuidesMenuPosition({ left: clamp(rect.left, 8, Math.max(8, window.innerWidth - width - 8)), top: clamp(rect.bottom + 4, 8, Math.max(8, window.innerHeight - height - 8)) }); } setGuidesMenuOpen(value => !value); }}>Guides <span aria-hidden="true">⌄</span></button><Show when={guidesMenuOpen()}><div class="ui-guides-popover" role="dialog" aria-label="Guides and snapping" style={{ left: `${guidesMenuPosition().left}px`, top: `${guidesMenuPosition().top}px` }} onPointerDown={event => event.stopPropagation()}>
        <header><strong>Guides</strong><div><button type="button" title="Add vertical guide at selection or canvas center" onClick={() => addCenteredGuide("x")}>＋ Vertical</button><button type="button" title="Add horizontal guide at selection or canvas center" onClick={() => addCenteredGuide("y")}>＋ Horizontal</button></div></header>
        <label class="ui-guide-check"><input type="checkbox" checked={document().guideSettings.enabled} onChange={event => updateGuideSettings({ enabled: event.currentTarget.checked })} /><span>Show guides and smart feedback</span><kbd>Ctrl/⌘+;</kbd></label>
        <div class="ui-guide-options">
          <label><input type="checkbox" checked={document().guideSettings.smartGuides} onChange={event => updateGuideSettings({ smartGuides: event.currentTarget.checked })} /> Alignment lines</label>
          <label><input type="checkbox" checked={document().guideSettings.snapObjects} onChange={event => updateGuideSettings({ snapObjects: event.currentTarget.checked })} /> Snap to objects</label>
          <label><input type="checkbox" checked={document().guideSettings.snapGuides} onChange={event => updateGuideSettings({ snapGuides: event.currentTarget.checked })} /> Snap to manual guides</label>
          <label><input type="checkbox" checked={document().guideSettings.equalSpacing} onChange={event => updateGuideSettings({ equalSpacing: event.currentTarget.checked })} /> Equal spacing</label>
          <label><input type="checkbox" checked={document().guideSettings.snapGrid} onChange={event => updateGuideSettings({ snapGrid: event.currentTarget.checked })} /> Snap to grid</label>
          <Show when={document().guideSettings.snapGrid}><label class="ui-guide-grid-size">Grid step <input type="number" min="1" max="512" step="1" value={document().guideSettings.gridSize} onChange={event => updateGuideSettings({ gridSize: Math.max(1, Math.min(512, Math.round(event.currentTarget.valueAsNumber || 1))) })} /> px</label></Show>
          <label><input type="checkbox" checked={document().guideSettings.measurements} onChange={event => updateGuideSettings({ measurements: event.currentTarget.checked })} /> Distance labels · Alt or drag</label>
          <label class="ui-guide-grid-size">Guide color <input type="color" aria-label="Guide color" value={document().guideSettings.color} onInput={event => updateGuideSettings({ color: event.currentTarget.value })} /></label>
          <label class="ui-guide-grid-size">Snap distance <input type="number" min="1" max="32" step="1" value={document().guideSettings.threshold} onInput={event => updateGuideSettings({ threshold: Math.max(1, Math.min(32, Math.round(event.currentTarget.valueAsNumber || 1))) })} /> px</label>
        </div>
        <section class="ui-guide-list"><header><strong>Page guides</strong><button type="button" disabled={!page().guides.some(guide => !guide.locked)} title="Remove unlocked guides" onClick={() => updatePage(current => ({ ...current, guides: current.guides.filter(guide => guide.locked) }), "guide-clear")}>Clear</button></header>
          <Show when={page().guides.length} fallback={<p>No manual guides. Add one here or right-click the canvas.</p>}><For each={page().guides}>{guide => <div class={`ui-guide-row ${guide.visible ? "" : "is-hidden"}`}><button type="button" class="ui-guide-visibility" aria-label={`${guide.visible ? "Hide" : "Show"} ${guide.axis === "x" ? "vertical" : "horizontal"} guide`} aria-pressed={guide.visible} onClick={() => updateManualGuide(guide.id, { visible: !guide.visible })}>{guide.visible ? "◉" : "○"}</button><span class={`ui-guide-axis axis-${guide.axis}`} aria-hidden="true"></span><span>{guide.axis === "x" ? "X" : "Y"}</span><input type="number" step="1" aria-label={`${guide.axis === "x" ? "Vertical" : "Horizontal"} guide position in pixels`} value={guide.position} onChange={event => { if (Number.isFinite(event.currentTarget.valueAsNumber)) updateManualGuide(guide.id, { position: event.currentTarget.valueAsNumber }); }} /><span>px</span><button type="button" aria-label={`${guide.locked ? "Unlock" : "Lock"} guide`} aria-pressed={guide.locked} onClick={() => updateManualGuide(guide.id, { locked: !guide.locked })}>{guide.locked ? "▣" : "♙"}</button><button type="button" aria-label="Remove guide" disabled={guide.locked} onClick={() => removeManualGuide(guide.id)}>×</button></div>}</For></Show>
        </section>
      </div></Show></div>
      <div class="ui-topbar-actions"><button type="button" disabled={!props.session.canUndo()} onClick={() => props.session.undo()} title="Undo (Ctrl/⌘+Z)" aria-label="Undo">↶</button><button type="button" disabled={!props.session.canRedo()} onClick={() => props.session.redo()} title="Redo (Ctrl/⌘+Y)" aria-label="Redo">↷</button><button type="button" onClick={() => void props.session.save()}>Save</button><button type="button" class="ui-present-button" onClick={startPrototype}>Present <span aria-hidden="true">▶</span></button><button type="button" onClick={() => setRightPanelOpen(v => !v)} title="Toggle inspector panel" aria-pressed={rightPanelOpen()}>{rightPanelOpen() ? "◧" : "◨"}</button><button type="button" onClick={() => props.session.goHome()}>Home</button></div>
    </header>
    <div class={`ui-editor-layout${rightPanelOpen() ? "" : " inspector-hidden"}`}>
       <aside class="ui-left-panel" aria-label="Design navigation"><nav class="ui-panel-tabs" aria-label="Left panel sections"><For each={["pages", "layers", "assets"] as const}>{tab => <button type="button" aria-pressed={leftTab() === tab} class={leftTab() === tab ? "is-active" : ""} onClick={() => setLeftTab(tab)}>{tab}</button>}</For></nav>
        <Show when={leftTab() === "pages"}><section class="ui-left-section"><header><span>Pages</span><button title="Add page" onClick={addPage}>＋</button></header><For each={document().pages}>{item => <div class={`ui-page-row ${page().id === item.id ? "is-active" : ""}`}><button onClick={() => setPage(item.id)} onDblClick={() => renamePage(item)} title="Double-click to rename">▤ {item.name}</button><details><summary aria-label={`Page actions for ${item.name}`}>···</summary><div class="ui-page-menu"><button onClick={() => setPage(item.id)}>Open</button><button onClick={() => renamePage(item)}>Rename</button><button onClick={() => duplicatePage(item)}>Duplicate</button><button onClick={() => deletePage(item)}>Delete</button></div></details></div>}</For></section><section class="ui-left-section"><header><span>Prototype flows</span><button title="Add flow" onClick={() => updatePage(current => { const flow = { id: createUIDesignId("flow"), name: `Flow ${current.prototypeFlows.length + 1}`, startPageId: current.id, startNodeId: topVisible().find(node => node.kind === "frame")?.id }; return { ...current, prototypeFlows: [...current.prototypeFlows, flow], activePrototypeFlowId: flow.id }; })}>＋</button></header><For each={page().prototypeFlows}>{flow => <button class={`ui-flow-row ${page().activePrototypeFlowId === flow.id ? "is-active" : ""}`} onClick={() => updatePage(item => ({ ...item, activePrototypeFlowId: flow.id }))}>{flow.name}</button>}</For><Show when={!page().prototypeFlows.length}><p class="ui-panel-empty">Create a flow to set its starting screen.</p></Show></section><section class="ui-left-section"><header><span>Frames</span><button title="Add screen frame" onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setFramePresetPosition({ left: Math.min(rect.left, Math.max(8, window.innerWidth - 320)), top: rect.bottom + 4 }); setTool("frame"); setFramePresetOpen(true); }}>＋</button></header><For each={displayNodes().filter(node => node.kind === "frame")}>{frame => <button class={`ui-frame-row ${selectedIds().includes(frame.id) ? "is-active" : ""}`} style={{ "--frame-depth": `${Math.min(hierarchy().ancestors(frame.id).length, 5) * 12}px` }} onClick={() => { setSelectedIds([frame.id]); fitContent([frame]); }} onDblClick={() => renameNode(frame)}><span aria-hidden="true">▧</span><span>{frame.name}</span><small>{frame.frameType === "screen" ? "Screen" : "Container"}</small></button>}</For><Show when={!displayNodes().some(node => node.kind === "frame")}><p class="ui-panel-empty">No frames on this page yet.</p></Show><ResponsiveBreakpointsPanel breakpoints={document().responsiveBreakpoints} open={inspectorSections().has("responsive-breakpoints")} onToggle={() => toggleInspectorSection("responsive-breakpoints")} onChange={updateResponsiveBreakpoints} onCompare={() => setResponsivePreviewOpen(true)} /></section></Show>
        <Show when={leftTab() === "layers"}><section class="ui-left-section ui-layer-section"><header><span>{page().name.toUpperCase()} · LAYERS</span><button title="Group selected (Ctrl+G)" onClick={groupSelection}>＋</button></header><div class="ui-searchbox"><span>⌕</span><input placeholder="Search layers" value={layerSearch()} onInput={event => setLayerSearch(event.currentTarget.value)} /><button title="Clear search" onClick={() => setLayerSearch("")}>×</button></div><div class={`ui-layer-list ${layerDrop() && layerDrop()?.targetId === undefined ? `is-drop-${layerDrop()?.position ?? ""}` : ""}`} onDragOver={handleLayerListDragOver} onDrop={handleLayerListDrop}>{renderLayerTree(page().id, 0)}</div><Show when={!page().elements.length}><div class="ui-panel-empty">Add a frame or element to start.</div></Show><footer><button disabled={!selectedIds().length} onClick={bulkRename}>Rename</button><button disabled={selected().length < 2} onClick={groupSelection}>Group</button><button disabled={!selected().some(node => node.kind === "group" || node.kind === "frame")} onClick={ungroupSelection}>Ungroup</button></footer></section></Show>
        <Show when={leftTab() === "assets"}><section class="ui-left-section ui-assets-section">
          <div class="ui-searchbox"><span aria-hidden="true">⌕</span><input aria-label="Search assets" placeholder="Search assets" value={assetSearch()} onInput={event => setAssetSearch(event.currentTarget.value)} /><Show when={assetSearch()}><button aria-label="Clear asset search" onClick={() => setAssetSearch("")}>×</button></Show></div>
          <div class="ui-library-heading">ASSET LIBRARY <span>{matchingAssets().length + matchingComponents().length}</span></div>
          <div class="ui-library-actions"><button type="button" onClick={() => componentLibraryInput?.click()}>Import library</button><button type="button" disabled={!document().components.length} onClick={exportComponentLibrary}>Export library</button></div>
          <Show when={document().assetLibraries.length}><section class="ui-asset-libraries"><strong>Local libraries</strong><For each={document().assetLibraries}>{library => <div><span>{library.name}<small>{library.assetIds.length} components · {library.enabled ? "Visible" : "Hidden"}</small></span><button type="button" class="ui-library-toggle" aria-pressed={library.enabled} title={library.enabled ? "Hide library assets" : "Show library assets"} onClick={() => toggleComponentLibrary(library.id)}>{library.enabled ? "On" : "Off"}</button><button type="button" aria-label={`Remove ${library.name}`} title={`Remove ${library.name}`} onClick={() => removeComponentLibrary(library.id)}>×</button></div>}</For></section></Show>
          <For each={assetCategories()}>{category => <section class="ui-asset-category">
            <h3 class="ui-asset-category-heading">{category}<small>{matchingAssets().filter(asset => asset.category === category).length}</small></h3>
            <For each={matchingAssets().filter(asset => asset.category === category)}>{asset => <button class="ui-asset-row" title={`Add ${asset.name}`} aria-label={`Add ${asset.name} asset`} onClick={() => addAsset(asset)}><span class="ui-asset-thumb" aria-hidden="true"><AssetIcon kind={asset.id === "image-placeholder" ? "image" : asset.parts[0]?.kind ?? "rectangle"} /></span><span>{asset.name}</span></button>}</For>
          </section>}</For>
          <Show when={assetSearch() && !matchingAssets().length && !matchingComponents().length}><p class="ui-panel-empty">No assets match “{assetSearch()}”.</p></Show>
          <Show when={!assetSearch() || matchingComponents().length > 0}><section class="ui-asset-category ui-component-assets"><h3 class="ui-asset-category-heading">Components<small>{matchingComponents().length}</small></h3><For each={matchingComponents()}>{component => <button class="ui-asset-row" title={`Add ${component.name}`} onClick={() => insertComponent(component.id)}><span class="ui-asset-thumb" aria-hidden="true"><AssetIcon kind="componentInstance" /></span><span>{component.name}</span></button>}</For><Show when={!assetSearch() && !document().components.length}><p class="ui-panel-empty">Create a component from a selection to keep it here.</p></Show></section></Show>
        </section></Show>
      </aside>

      <main class="ui-center-workspace"><div ref={stage} class={`ui-canvas-stage tool-${tool()}`} style={{ background: page().background, "--ui-zoom": String(camera().zoom) }} onPointerDown={handleStageDown} onPointerMove={handleStageMove} onPointerUp={finishGesture} onPointerCancel={cancelGesture} onWheel={handleWheel} onContextMenu={event => openContextMenu(event)}>
        <div class="ui-infinite-plane" style={{ transform: `translate(${camera().x}px,${camera().y}px) scale(${camera().zoom})` }}>{renderChildren(page().id)}
          <Show when={connectSource()}><svg class="ui-prototype-wires" style={{ position: "absolute", left: `${sceneExtent().x}px`, top: `${sceneExtent().y}px`, width: `${sceneExtent().width}px`, height: `${sceneExtent().height}px`, overflow: "visible", "pointer-events": "none" }}><For each={displayNodes().flatMap(node => node.interactions.filter(link => link.targetNodeId).map(link => ({ node, link })))}>{entry => { const from = worldBounds(entry.node); const toNode = hierarchy().get(entry.link.targetNodeId ?? ""); const to = toNode && worldBounds(toNode); return from && to ? <path d={`M ${from.x + from.width - sceneExtent().x} ${from.y + from.height / 2 - sceneExtent().y} C ${from.x + from.width + 60 - sceneExtent().x} ${from.y + from.height / 2 - sceneExtent().y}, ${to.x - 60 - sceneExtent().x} ${to.y + to.height / 2 - sceneExtent().y}, ${to.x - sceneExtent().x} ${to.y + to.height / 2 - sceneExtent().y}`} /> : null; }}</For></svg></Show>
          <Show when={gesture()?.kind === "draw" && gestureRect()}><div class="ui-draw-preview" style={{ left: `${gestureRect()!.x}px`, top: `${gestureRect()!.y}px`, width: `${Math.max(1, gestureRect()!.width)}px`, height: `${Math.max(1, gestureRect()!.height)}px` }} /></Show>
          <Show when={gesture()?.kind === "marquee" && gestureRect()}><div class="ui-marquee" style={{ left: `${gestureRect()!.x}px`, top: `${gestureRect()!.y}px`, width: `${gestureRect()!.width}px`, height: `${gestureRect()!.height}px` }} /></Show>
          <Show when={connectSource()}><div class="ui-connect-hint">Select a frame to connect · Esc to cancel</div></Show>
        </div>
        <Show when={document().guideSettings.enabled && stageSize().width > 0 && stageSize().height > 0}>
          <svg class="ui-guides-overlay" aria-hidden="true" viewBox={`0 0 ${stageSize().width} ${stageSize().height}`}>
            <For each={page().guides.filter(guide => guide.visible)}>{guide => {
              const anchor = screenPoint(guide.axis === "x" ? guide.position : 0, guide.axis === "y" ? guide.position : 0);
              const vertical = guide.axis === "x";
              const value = `${vertical ? "X" : "Y"} ${round(guide.position)} px`;
              const labelWidth = Math.max(48, value.length * 6.2 + 12);
              const labelX = vertical ? clamp(anchor.x + 5, 2, stageSize().width - labelWidth - 2) : 5;
              const labelY = vertical ? 17 : clamp(anchor.y - 5, 15, stageSize().height - 3);
              return <g class={`ui-manual-guide ${vertical ? "is-vertical" : "is-horizontal"} ${guide.locked ? "is-locked" : ""}`}>
                <line class="ui-guide-visible-line" x1={vertical ? anchor.x : 0} y1={vertical ? 0 : anchor.y} x2={vertical ? anchor.x : stageSize().width} y2={vertical ? stageSize().height : anchor.y} style={{ stroke: document().guideSettings.color }} />
                <line class="ui-guide-hit-line" x1={vertical ? anchor.x : 0} y1={vertical ? 0 : anchor.y} x2={vertical ? anchor.x : stageSize().width} y2={vertical ? stageSize().height : anchor.y} style={{ "pointer-events": guide.locked ? "none" : "stroke", cursor: vertical ? "col-resize" : "row-resize" }} onPointerDown={event => startGuideMove(event, guide)} />
                <g class="ui-guide-coordinate" style={{ "pointer-events": "none" }}><rect x={labelX} y={labelY - 13} width={labelWidth} height="17" rx="4" style={{ fill: document().guideSettings.color }} /><text x={labelX + 6} y={labelY - 1}>{value}</text></g>
              </g>;
            }}</For>
            <For each={snapLines()}>{line => {
              const start = line.axis === "x" ? screenPoint(line.position, line.from) : screenPoint(line.from, line.position);
              const end = line.axis === "x" ? screenPoint(line.position, line.to) : screenPoint(line.to, line.position);
              return <line class={`ui-smart-guide source-${line.source}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />;
            }}</For>
            <For each={measurements()}>{measure => {
              const start = measure.axis === "x" ? screenPoint(measure.start, measure.cross) : screenPoint(measure.cross, measure.start);
              const end = measure.axis === "x" ? screenPoint(measure.end, measure.cross) : screenPoint(measure.cross, measure.end);
              const horizontal = measure.axis === "x";
              const labelWidth = Math.max(38, measure.label.length * 6.3 + 12);
              const labelX = horizontal ? (start.x + end.x - labelWidth) / 2 : start.x + 8;
              const labelY = horizontal ? start.y - 8 : (start.y + end.y) / 2;
              return <g class="ui-distance-measure">
                <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
                <line x1={start.x - (horizontal ? 0 : 4)} y1={start.y - (horizontal ? 4 : 0)} x2={start.x + (horizontal ? 0 : 4)} y2={start.y + (horizontal ? 4 : 0)} />
                <line x1={end.x - (horizontal ? 0 : 4)} y1={end.y - (horizontal ? 4 : 0)} x2={end.x + (horizontal ? 0 : 4)} y2={end.y + (horizontal ? 4 : 0)} />
                <rect x={labelX} y={labelY - 8} width={labelWidth} height="17" rx="4" />
                <text x={labelX + labelWidth / 2} y={labelY + 4} text-anchor="middle">{measure.label}</text>
              </g>;
            }}</For>
          </svg>
        </Show>
        <Show when={message()}><div class="ui-toast-message" role="status">{message()}</div></Show>
        </div>
      </main>

      <Show when={rightPanelOpen()}><InspectorPanel activeTab={rightTab()} onTabChange={setRightTab} design={<>
        <div class="ui-inspector-scroll"><Show when={selectedOne()}>
          <SelectedInspector node={selectedOne()!} page={page()} document={document()} hierarchy={hierarchy()} openSections={inspectorSections} toggleSection={toggleInspectorSection} updateNode={updateNode} updateField={updateField} updatePage={updatePage} setColorMode={modeId => updateDocument(doc => ({ ...doc, activeColorModeId: modeId }))} createComponent={createComponent} applyVariant={applyVariant} saveComponentVariant={saveComponentVariant} detachComponent={detachComponent} resetComponent={resetComponent} resetComponentNode={resetComponentNode} />
        </Show><Show when={selected().length > 1}><MultiSelectionInspector count={selected().length} nodes={selected()} onFill={fill => updateSelection({ fill, fillTokenId: "", fillGradient: undefined })} onOpacity={opacity => updateSelection({ opacity })} /></Show><section class="ui-inspector-section ui-styles-section"><header><button type="button" class="ui-section-toggle" aria-expanded={inspectorSections().has("styles-library")} onClick={() => toggleInspectorSection("styles-library")}>{inspectorSections().has("styles-library") ? "v" : ">"} Local styles &amp; variables</button><button onClick={exportTokens} title="Export token JSON">↓</button></header><div class="ui-token-library" style={{ display: inspectorSections().has("styles-library") ? "block" : "none" }}><div class="ui-token-actions"><button onClick={() => tokenInput?.click()}>Import tokens</button><button onClick={exportTokens}>Export tokens</button></div><For each={document().colorModes}>{mode => <button class={`ui-mode-pill ${document().activeColorModeId === mode.id ? "is-active" : ""}`} onClick={() => updateDocument(doc => ({ ...doc, activeColorModeId: mode.id }))}>{mode.name}</button>}</For><TokenSection title="Colors" presets={tokenPresets.color.map(item => item.name)} onAdd={() => addToken("color")} onPreset={name => addToken("color", name)}><For each={document().colorTokens}>{token => <div class="ui-token-row"><input type="color" aria-label={`Color for ${token.name}`} value={resolveColorToken(document().colorTokens, token.id, document().activeColorModeId, token.value)} onInput={event => editColorToken(token.id, event.currentTarget.value)} /><input aria-label="Color token name" value={token.name} onInput={event => updateDocument(doc => ({ ...doc, colorTokens: doc.colorTokens.map(item => item.id === token.id ? { ...item, name: event.currentTarget.value } : item) }))} /><TokenAliasSelect token={token} tokens={document().colorTokens} onChange={aliasOf => changeTokenAlias("color", token.id, aliasOf)} /><button class="ui-token-remove" type="button" title={`Remove ${token.name}`} aria-label={`Remove ${token.name} color token`} onClick={() => removeToken("color", token.id)}>×</button></div>}</For></TokenSection><TokenSection title="Typography" presets={tokenPresets.type.map(item => item.name)} onAdd={() => addToken("type")} onPreset={name => addToken("type", name)}><For each={document().typographyTokens}>{token => <div class="ui-token-card ui-token-type-row"><input aria-label="Typography token name" value={token.name} onInput={event => updateDocument(doc => ({ ...doc, typographyTokens: doc.typographyTokens.map(item => item.id === token.id ? { ...item, name: event.currentTarget.value } : item) }))} /><div class="ui-token-type-fields"><select aria-label="Typography font family" value={resolveTypographyToken(token, document().activeColorModeId, document().typographyTokens)?.fontFamily ?? token.fontFamily} onChange={event => editTypographyToken(token.id, { fontFamily: event.currentTarget.value as typeof token.fontFamily })}><option value="system">System</option><option value="sans">Sans</option><option value="serif">Serif</option><option value="mono">Mono</option></select><input aria-label="Typography font size" type="number" min="1" max="512" value={resolveTypographyToken(token, document().activeColorModeId, document().typographyTokens)?.fontSize ?? token.fontSize} onInput={event => editTypographyToken(token.id, { fontSize: Math.max(1, Number(event.currentTarget.value) || 1) })} /><input aria-label="Typography font weight" type="number" min="100" max="900" step="100" value={resolveTypographyToken(token, document().activeColorModeId, document().typographyTokens)?.fontWeight ?? token.fontWeight} onInput={event => editTypographyToken(token.id, { fontWeight: clamp(Number(event.currentTarget.value) || 400, 100, 900) })} /><input aria-label="Typography line height" title="Line height" type="number" min="0.5" max="5" step="0.1" value={resolveTypographyToken(token, document().activeColorModeId, document().typographyTokens)?.lineHeight ?? token.lineHeight} onInput={event => editTypographyToken(token.id, { lineHeight: clamp(Number(event.currentTarget.value) || 1, 0.5, 5) })} /><input aria-label="Typography letter spacing" title="Letter spacing" type="number" min="-20" max="100" step="0.1" value={resolveTypographyToken(token, document().activeColorModeId, document().typographyTokens)?.letterSpacing ?? token.letterSpacing} onInput={event => editTypographyToken(token.id, { letterSpacing: clamp(Number(event.currentTarget.value) || 0, -20, 100) })} /></div><TokenAliasSelect token={token} tokens={document().typographyTokens} onChange={aliasOf => changeTokenAlias("type", token.id, aliasOf)} /><button class="ui-token-remove" type="button" title={`Remove ${token.name}`} aria-label={`Remove ${token.name} typography token`} onClick={() => removeToken("type", token.id)}>×</button></div>}</For></TokenSection><TokenSection title="Spacing" presets={tokenPresets.spacing.map(item => item.name)} onAdd={() => addToken("spacing")} onPreset={name => addToken("spacing", name)}><For each={document().spacingTokens}>{token => <TokenValue token={token} tokens={document().spacingTokens} modeId={document().activeColorModeId} onChange={value => editValueToken("spacing", token.id, value)} onRename={name => updateDocument(doc => ({ ...doc, spacingTokens: doc.spacingTokens.map(item => item.id === token.id ? { ...item, name } : item) }))} onAliasChange={aliasOf => changeTokenAlias("spacing", token.id, aliasOf)} onRemove={() => removeToken("spacing", token.id)} />}</For></TokenSection><TokenSection title="Radius" presets={tokenPresets.radius.map(item => item.name)} onAdd={() => addToken("radius")} onPreset={name => addToken("radius", name)}><For each={document().radiusTokens}>{token => <TokenValue token={token} tokens={document().radiusTokens} modeId={document().activeColorModeId} onChange={value => editValueToken("radius", token.id, value)} onRename={name => updateDocument(doc => ({ ...doc, radiusTokens: doc.radiusTokens.map(item => item.id === token.id ? { ...item, name } : item) }))} onAliasChange={aliasOf => changeTokenAlias("radius", token.id, aliasOf)} onRemove={() => removeToken("radius", token.id)} />}</For></TokenSection><TokenSection title="Effects" presets={tokenPresets.effect.map(item => item.name)} onAdd={() => addToken("effect")} onPreset={name => addToken("effect", name)}><For each={document().effectTokens}>{token => <div class="ui-token-card ui-token-effect-row"><input aria-label="Effect token name" value={token.name} onInput={event => updateDocument(doc => ({ ...doc, effectTokens: doc.effectTokens.map(item => item.id === token.id ? { ...item, name: event.currentTarget.value } : item) }))} /><input aria-label="Effect token value" value={resolveEffectToken(token, document().activeColorModeId, document().effectTokens) ?? token.value} onInput={event => editEffectToken(token.id, event.currentTarget.value)} /><TokenAliasSelect token={token} tokens={document().effectTokens} onChange={aliasOf => changeTokenAlias("effect", token.id, aliasOf)} /><button class="ui-token-remove" type="button" title={`Remove ${token.name}`} aria-label={`Remove ${token.name} effect token`} onClick={() => removeToken("effect", token.id)}>×</button></div>}</For></TokenSection></div></section>
          </div></>}
        prototype={<><div class="ui-inspector-scroll"><section class="ui-inspector-section"><header><strong>Prototype</strong><div class="ui-header-actions"><button type="button" onClick={exportOfflinePresentation}>Offline HTML</button><button class="ui-primary-action-small" onClick={startPrototype}>Present ▶</button></div></header><label class="ui-field"><span>Starting point</span><select value={page().activePrototypeFlowId} onChange={event => updatePage(current => ({ ...current, activePrototypeFlowId: event.currentTarget.value }))}><For each={page().prototypeFlows}>{flow => <option value={flow.id}>{flow.name}</option>}</For></select></label><label class="ui-field"><span>Starting screen</span><select value={page().prototypeFlows.find(flow => flow.id === page().activePrototypeFlowId)?.startNodeId ?? ""} onChange={event => updatePage(current => ({ ...current, prototypeFlows: current.prototypeFlows.map(flow => flow.id === current.activePrototypeFlowId ? { ...flow, startNodeId: event.currentTarget.value } : flow) }))}><option value="">First screen frame</option><For each={page().elements.filter(node => node.kind === "frame" && node.frameType === "screen")}>{frame => <option value={frame.id}>{frame.name}</option>}</For></select></label><Show when={selectedOne()}><div class="ui-prototype-actions"><button onClick={() => { setConnectSource(selectedOne()!.id); setMessage("Select a target screen frame"); }}>＋ Connect to frame</button><button onClick={() => addInteraction(selectedOne()!)}>＋ Add interaction</button></div><For each={selectedOne()?.interactions ?? []}>{(interaction, index) => <InteractionEditor interaction={interaction} page={page()} nodes={page().elements} variables={document().prototypeVariables} onChange={next => updateNode(selectedOne()!.id, { interactions: selectedOne()!.interactions.map((item, i) => i === index() ? next : item) })} onRemove={() => updateNode(selectedOne()!.id, { interactions: selectedOne()!.interactions.filter((_, i) => i !== index()) })} />}</For></Show><For each={displayNodes().filter(node => node.kind === "frame")}>{frame => <div class="ui-connection-row"><span>{frame.name}</span><For each={frame.interactions.filter(link => link.targetNodeId)}>{link => <small>→ {hierarchy().get(link.targetNodeId!)?.name ?? "Missing destination"}</small>}</For></div>}</For><div class="ui-prototype-variable-panel"><header><strong>Prototype variables</strong><button type="button" onClick={addPrototypeVariable}>＋ Add</button></header><Show when={!document().prototypeVariables.length}><p class="ui-inspector-note">Use variables in interaction conditions, actions, and preview text with <code>{"{{variableName}}"}</code>.</p></Show><For each={document().prototypeVariables}>{variable => <div class="ui-prototype-variable-row"><input aria-label="Variable name" value={variable.name} onChange={event => updatePrototypeVariable(variable.id, { name: event.currentTarget.value.slice(0, 80) })} /><select aria-label={`Type of ${variable.name}`} value={typeof variable.value} onChange={event => updatePrototypeVariable(variable.id, { value: event.currentTarget.value === "boolean" ? false : event.currentTarget.value === "number" ? 0 : "" })}><option value="string">Text</option><option value="number">Number</option><option value="boolean">Boolean</option></select>{typeof variable.value === "boolean" ? <select aria-label={`Value of ${variable.name}`} value={String(variable.value)} onChange={event => updatePrototypeVariable(variable.id, { value: event.currentTarget.value === "true" })}><option value="false">False</option><option value="true">True</option></select> : <input aria-label={`Value of ${variable.name}`} type={typeof variable.value === "number" ? "number" : "text"} value={String(variable.value)} onInput={event => updatePrototypeVariable(variable.id, { value: typeof variable.value === "number" ? event.currentTarget.valueAsNumber || 0 : event.currentTarget.value })} />}<button type="button" aria-label={`Remove ${variable.name}`} onClick={() => updateDocument(doc => ({ ...doc, prototypeVariables: doc.prototypeVariables.filter(item => item.id !== variable.id) }))}>×</button></div>}</For></div><section class="ui-prototype-diagnostics"><header><strong>Link diagnostics</strong><span>{prototypeDiagnostics().length}</span></header><Show when={prototypeDiagnostics().length} fallback={<p>All prototype destinations and variables are valid.</p>}><For each={prototypeDiagnostics()}>{issue => <p class="severity-warning">{issue}</p>}</For></Show></section></section></div></>}
        inspect={<><div class="ui-inspector-scroll">
            <section class="ui-inspector-section ui-inspect-handoff">
              <header><strong>Inspect / handoff</strong></header>
              <div class="ui-handoff-actions" role="group" aria-label="Export design"><button type="button" onClick={exportSVG}>SVG</button><button type="button" onClick={() => void exportPNG()}>PNG</button><button type="button" onClick={() => void exportPDF()}>PDF</button><button type="button" onClick={exportOfflinePresentation}>Offline preview</button><button type="button" onClick={exportTokens}>Tokens</button></div>
              <Show when={selectedOne()} fallback={<p class="ui-inspector-note">Select an object to inspect its measurements and generated code.</p>}>
                <InspectPanel node={selectedOne()!} document={document()} elements={page().elements} pageId={page().id} world={hierarchy().worldTransform(selectedOne()!.id) ?? { x: selectedOne()!.x, y: selectedOne()!.y, rotation: selectedOne()!.rotation }} />
              </Show>
            </section>
            <section class="ui-inspector-section ui-accessibility-panel">
              <header><strong>Accessibility review</strong><span class="ui-accessibility-count">{lintResults().length} findings</span></header>
              <Show when={lintResults().length} fallback={<p class="ui-inspector-note">No accessibility or style issues found across the document.</p>}>
                <For each={lintResults()}>{finding => <button type="button" class={`ui-accessibility-finding severity-${finding.severity}`} onClick={() => { if (!finding.node) return; setPage(finding.pageId); setSelectedIds([finding.node.id]); setLeftTab("layers"); }}><span>{finding.text}</span><small>{document().pages.find(item => item.id === finding.pageId)?.name ?? "Page"} · Select layer</small></button>}</For>
              </Show>
              <button class="ui-accessibility-export" type="button" onClick={exportAccessibilityReport}>Export report</button>
            </section>
          </div>
        </>} /></Show>
    </div>
    <Show when={contextMenu()}>
      <div class="ui-context-menu" role="menu" aria-label="Canvas actions" style={contextMenuPosition()} onContextMenu={event => event.preventDefault()}>
        <header><span>{contextTarget()?.name ?? (contextNodes().length ? `${contextNodes().length} selected` : "Canvas")}</span><small>{contextTarget()?.kind ?? "Actions"}</small></header>
        <Show when={contextTarget() && ["frame", "group", "componentInstance"].includes(contextTarget()!.kind)}>
          <div class="ui-context-group" role="group" aria-label="Add inside">
            <strong>Add inside</strong>
            <div class="ui-context-quick-actions"><button role="menuitem" disabled={!contextCanEdit()} onClick={() => addContextChild("rectangle")}>Rectangle</button><button role="menuitem" disabled={!contextCanEdit()} onClick={() => addContextChild("text")}>Text</button><button role="menuitem" disabled={!contextCanEdit()} onClick={() => addContextChild("button")}>Button</button><button role="menuitem" disabled={!contextCanEdit()} onClick={() => addContextChild("image")}>Image</button></div>
          </div>
        </Show>
        <Show when={!contextTarget()}>
          <div class="ui-context-group" role="group" aria-label="Create on canvas">
            <strong>Create here</strong>
            <div class="ui-context-quick-actions"><button role="menuitem" onClick={() => addContextNode("rectangle")}>Rectangle</button><button role="menuitem" onClick={() => addContextNode("ellipse")}>Ellipse</button><button role="menuitem" onClick={() => addContextNode("text")}>Text</button><button role="menuitem" onClick={() => addContextNode("button")}>Button</button></div>
            <div class="ui-context-quick-actions"><For each={UI_FRAME_PRESETS.filter(preset => ["mobile-iphone", "tablet", "desktop", "custom"].includes(preset.id))}>{preset => <button role="menuitem" onClick={() => addContextFrame(preset.id)}>{preset.label}</button>}</For></div>
            <div class="ui-context-quick-actions"><button role="menuitem" onClick={() => addContextGuide("x")}>Vertical guide</button><button role="menuitem" onClick={() => addContextGuide("y")}>Horizontal guide</button></div>
          </div>
        </Show>
        <Show when={contextNodes().length > 0}>
          <div class="ui-context-group" role="group" aria-label="Selection actions">
            <Show when={contextTarget()}><button role="menuitem" disabled={!contextCanEdit()} onClick={() => runContextAction(target => { if (target) renameNode(target); })}>Rename…</button></Show>
            <button role="menuitem" disabled={!contextCanEdit() || !contextAncestorsUnlocked()} onClick={() => runContextAction(() => duplicateSelection())}>Duplicate <kbd>Ctrl+D</kbd></button>
            <Show when={contextRoots().length > 1}><button role="menuitem" disabled={!contextCanEdit() || !contextAncestorsUnlocked()} onClick={() => runContextAction(() => groupSelection())}>Group selection <kbd>Ctrl+G</kbd></button></Show>
            <Show when={contextNodes().some(node => node.kind === "group" || node.kind === "frame")}><button role="menuitem" disabled={!contextCanEdit() || !contextAncestorsUnlocked()} onClick={() => runContextAction(() => ungroupSelection())}>Ungroup</button></Show>
            <Show when={contextTarget()?.kind === "componentInstance"}><button role="menuitem" onClick={() => runContextAction(target => { if (target) resetComponent(target); })}>Reset component overrides</button><button role="menuitem" disabled={!contextCanEdit()} onClick={() => runContextAction(target => { if (target) detachComponent(target); })}>Detach component</button></Show>
            <Show when={contextTarget() && contextTarget()!.kind !== "componentInstance" && contextNodes().length === 1}><button role="menuitem" disabled={!contextCanEdit()} onClick={() => runContextAction(() => createComponent())}>Create component</button></Show>
            <Show when={contextTarget()}><div class="ui-context-separator" /><button role="menuitem" disabled={!!contextTarget()?.parentId && !contextAncestorsUnlocked()} onClick={() => toggleContextFlag("hidden")}>{contextTarget()?.hidden ? "Show" : "Hide"}</button><button role="menuitem" disabled={!!contextTarget()?.parentId && !contextAncestorsUnlocked()} onClick={() => toggleContextFlag("locked")}>{contextTarget()?.locked ? "Unlock" : "Lock"}</button></Show>
            <button role="menuitem" disabled={!contextCanEdit() || !contextAncestorsUnlocked()} onClick={() => runContextAction((_target, menu) => reorderSelection("front", menu.selectionIds))}>Bring to front</button>
            <button role="menuitem" disabled={!contextCanEdit() || !contextAncestorsUnlocked()} onClick={() => runContextAction((_target, menu) => reorderSelection("back", menu.selectionIds))}>Send to back</button>
            <button role="menuitem" class="is-danger" disabled={!contextCanEdit() || !contextAncestorsUnlocked()} onClick={() => runContextAction(() => deleteSelection())}>Delete</button>
          </div>
        </Show>
        <Show when={contextTarget()?.kind === "frame"}>
          <div class="ui-context-group" role="group" aria-label="Frame options">
            <button role="menuitem" disabled={!contextCanEdit()} onClick={() => runContextAction(target => { if (target) updateNode(target.id, { clipContent: !target.clipContent }); })}>{contextTarget()?.clipContent ? "Disable clipping" : "Clip content"}</button>
            <button role="menuitem" disabled={!contextCanEdit()} onClick={() => runContextAction(target => { if (!target) return; updatePage(current => { const active = current.prototypeFlows.find(flow => flow.id === current.activePrototypeFlowId); if (active) return { ...current, prototypeFlows: current.prototypeFlows.map(flow => flow.id === active.id ? { ...flow, startNodeId: target.id } : flow) }; const flow = { id: createUIDesignId("flow"), name: `Flow ${current.prototypeFlows.length + 1}`, startPageId: current.id, startNodeId: target.id }; return { ...current, prototypeFlows: [...current.prototypeFlows, flow], activePrototypeFlowId: flow.id }; }); setRightTab("prototype"); })}>Set as flow starting point</button>
          </div>
        </Show>
        <Show when={!contextTarget() && !contextNodes().length}><div class="ui-context-hint">Right-click an object for more actions.</div></Show>
      </div>
    </Show>
    <input ref={imageInput} type="file" accept="image/*,.svg" hidden onChange={event => { void readImage(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
    <input ref={tokenInput} type="file" accept="application/json,.json" hidden onChange={event => { void importTokens(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
    <input ref={componentLibraryInput} type="file" accept="application/json,.json" hidden onChange={event => { void importComponentLibrary(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
    <Show when={findOpen()}><div class="ui-dialog-backdrop" onClick={() => setFindOpen(false)}><section class="ui-find-dialog" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}><header><strong>Find and replace text</strong><button onClick={() => setFindOpen(false)}>×</button></header><TextField label="Find" value={findQuery()} onInput={setFindQuery} /><TextField label="Replace with" value={replaceQuery()} onInput={setReplaceQuery} /><footer><button onClick={() => setFindOpen(false)}>Cancel</button><button class="ui-primary-action-small" onClick={replaceText}>Replace all</button></footer></section></div></Show>
        <Show when={responsivePreviewOpen()}><ResponsivePreviewDialog page={page()} breakpoints={document().responsiveBreakpoints} spacingTokens={document().spacingTokens} modeId={document().activeColorModeId} renderFrame={renderResponsiveFrame} onClose={() => setResponsivePreviewOpen(false)} /></Show>
        <Show when={preview()}><PrototypePresentation document={document()} pageId={previewPageId()} nodeId={previewNodeId()} overlay={previewOverlay()} historyLength={previewHistory().length} transition={previewTransition()} renderNode={renderPreviewNode} onClose={() => setPreview(false)} onBack={() => runInteraction({ id: "back", name: "Back", trigger: "click", action: "back", transition: "instant" })} onScreen={(pageId, nodeId) => { setPreviewPageId(pageId); setPreviewNodeId(nodeId); setPreviewOverlay(undefined); }} /></Show>
  </div>;
}

function TokenSection(props: { title: string; presets: string[]; onAdd: () => void; onPreset: (name: string) => void; children: JSX.Element }) {
  const [open, setOpen] = createSignal(true);
  const [adding, setAdding] = createSignal(false);
  return <section class="ui-token-section"><header><button onClick={() => setOpen(value => !value)}>{open() ? "⌄" : "›"} {props.title}</button><button onClick={() => setAdding(value => !value)} aria-label={"Add " + props.title + " token"} aria-expanded={adding()}>＋</button></header>
    <Show when={adding()}><div class="ui-token-presets"><For each={props.presets}>{name => <button type="button" onClick={() => { props.onPreset(name); setAdding(false); }}>{name}</button>}</For><button type="button" class="is-custom" onClick={() => { props.onAdd(); setAdding(false); }}>Custom…</button></div></Show>
    <Show when={open()}><div>{props.children}</div></Show>
  </section>;
}
function TokenValue(props: { token: UIValueToken; tokens: UIValueToken[]; modeId: string; onChange: (value: number) => void; onRename: (name: string) => void; onAliasChange: (aliasOf: string) => void; onRemove: () => void }) {
  const effectiveValue = () => resolveValueToken(props.token, props.modeId, props.tokens) ?? props.token.value * (props.token.unit === "rem" ? 16 : 1);
  const unitValue = () => round(effectiveValue() / (props.token.unit === "rem" ? 16 : 1));
  return <div class="ui-token-card ui-token-value-row"><input value={props.token.name} aria-label="Token name" onInput={event => props.onRename(event.currentTarget.value)} /><input type="number" value={unitValue()} onInput={event => props.onChange(round(Number(event.currentTarget.value)))} /><span>{props.token.unit}</span><button class="ui-token-remove" type="button" title={`Remove ${props.token.name}`} aria-label={`Remove ${props.token.name} token`} onClick={props.onRemove}>×</button><TokenAliasSelect token={props.token} tokens={props.tokens} onChange={props.onAliasChange} /></div>;
}

function SelectedInspector(props: { node: UIElement; page: UIPage; document: UIDesignDocument; hierarchy: UIHierarchyIndex<UIElement>; openSections: () => Set<string>; toggleSection: (id: string) => void; updateNode: (id: string, patch: Partial<UIElement>, key?: string) => void; updateField: <K extends keyof UIElement>(node: UIElement, key: K, value: UIElement[K], keyName?: string) => void; updatePage: (mutate: (page: UIPage) => UIPage) => void; setColorMode: (modeId: string) => void; createComponent: () => void; applyVariant: (node: UIElement, variantId: string) => void; saveComponentVariant: (node: UIElement) => void; detachComponent: (node: UIElement) => void; resetComponent: (node: UIElement) => void; resetComponentNode: (node: UIElement) => void }) {
  const open = (id: string) => props.openSections().has(id); const toggle = props.toggleSection;
  const node = () => props.node; const position = () => props.hierarchy.worldTransform(node().id) ?? { x: node().x, y: node().y, rotation: node().rotation };
  const containingInstance = () => node().kind === "componentInstance" ? node() : props.hierarchy.ancestors(node().id).find(parent => parent.kind === "componentInstance");
  const edit = <K extends keyof UIElement>(key: K, value: UIElement[K]) => {
    const typographyFields: Array<keyof UIElement> = ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing"];
    if (typographyFields.includes(key)) props.updateNode(node().id, { [key]: value, typographyTokenId: "" } as Partial<UIElement>);
    else props.updateField(node(), key, value);
  };
  const setWorldPosition = (axis: "x" | "y", value: number) => { const transform = position(); const dx = axis === "x" ? round(value) - round(transform.x) : 0; const dy = axis === "y" ? round(value) - round(transform.y) : 0; const parent = node().parentId === props.page.id ? undefined : props.hierarchy.worldTransform(node().parentId); const rad = -(parent?.rotation ?? 0) * Math.PI / 180; props.updateNode(node().id, { x: round(node().x + dx * Math.cos(rad) - dy * Math.sin(rad)), y: round(node().y + dx * Math.sin(rad) + dy * Math.cos(rad)) }); };
  const section = (id: string, title: string, content: JSX.Element) => <section class="ui-inspector-section"><header><button class="ui-section-toggle" onClick={() => toggle(id)}>{open(id) ? "⌄" : "›"} {title}</button></header><Show when={open(id)}>{content}</Show></section>;
  const colorValue = (tokenId: string, fallback: string) => resolveColorToken(props.document.colorTokens, tokenId, props.document.activeColorModeId, fallback);
  const radiusToken = () => props.document.radiusTokens.find(token => token.id === node().radiusTokenId);
  const radiusValue = () => resolveValueToken(radiusToken(), props.document.activeColorModeId, props.document.radiusTokens) ?? node().radius;
  type LayoutNumberKey = "gap" | "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft";
  type LayoutTokenKey = "gapTokenId" | "paddingTopTokenId" | "paddingRightTokenId" | "paddingBottomTokenId" | "paddingLeftTokenId";
  const spacingField = (label: string, valueKey: LayoutNumberKey, tokenKey: LayoutTokenKey) => {
    const boundToken = () => props.document.spacingTokens.find(token => token.id === node().autoLayout[tokenKey]);
    const value = () => resolveValueToken(boundToken(), props.document.activeColorModeId, props.document.spacingTokens) ?? node().autoLayout[valueKey];
    const updateLayout = (patch: Partial<UIElement["autoLayout"]>) => props.updateNode(node().id, { autoLayout: { ...node().autoLayout, ...patch } });
    return <div class="ui-spacing-token-control"><NumberField label={label} min={0} value={value()} onInput={next => updateLayout({ [valueKey]: next, [tokenKey]: "" })} /><select aria-label={`${label} token`} title={`${label} token`} value={node().autoLayout[tokenKey]} onChange={event => {
      const token = props.document.spacingTokens.find(item => item.id === event.currentTarget.value);
      updateLayout({ [tokenKey]: token?.id ?? "", ...(token ? { [valueKey]: resolveValueToken(token, props.document.activeColorModeId, props.document.spacingTokens) ?? node().autoLayout[valueKey] } : {}) });
    }}><option value="">Custom</option><For each={props.document.spacingTokens}>{token => <option value={token.id}>{token.name}</option>}</For></select></div>;
  };
  const layoutSummary = () => {
    const layout = node().autoLayout;
    const value = (key: LayoutNumberKey, tokenKey: LayoutTokenKey) => {
      const token = props.document.spacingTokens.find(item => item.id === layout[tokenKey]);
      return round(resolveValueToken(token, props.document.activeColorModeId, props.document.spacingTokens) ?? layout[key]);
    };
    const count = props.hierarchy.children(node().id).length;
    return `${count} ${count === 1 ? "child" : "children"} · ${layout.direction} · ${value("gap", "gapTokenId")} px gap · padding ${value("paddingTop", "paddingTopTokenId")} / ${value("paddingRight", "paddingRightTokenId")} / ${value("paddingBottom", "paddingBottomTokenId")} / ${value("paddingLeft", "paddingLeftTokenId")} px (top / right / bottom / left)`;
  };
  return <>
    {section("position", "Position", <><div class="ui-property-grid"><NumberField label="X" value={position().x} onInput={value => setWorldPosition("x", value)} /><NumberField label="Y" value={position().y} onInput={value => setWorldPosition("y", value)} /><NumberField label="W" min={1} value={node().width} onInput={value => props.updateNode(node().id, { width: value })} /><NumberField label="H" min={1} value={node().height} onInput={value => props.updateNode(node().id, { height: value })} /><NumberField label="Rotation" value={node().rotation} onInput={value => edit("rotation", value)} /></div><label class="ui-field"><span>Layer name</span><input value={node().name} onInput={event => edit("name", event.currentTarget.value)} /></label><div class="ui-property-grid"><SelectField label="Horizontal" value={node().constraints.horizontal} options={["left", "right", "left-right", "center", "scale"]} onChange={horizontal => edit("constraints", { ...node().constraints, horizontal })} /><SelectField label="Vertical" value={node().constraints.vertical} options={["top", "bottom", "top-bottom", "center", "scale"]} onChange={vertical => edit("constraints", { ...node().constraints, vertical })} /></div></>)}
    {node().kind === "frame" ? <>{section("frame", "Frame", <><SelectField label="Type" value={node().frameType} options={["screen", "container"]} onChange={frameType => edit("frameType", frameType)} /><SelectField label="Preset" value={node().framePreset} options={UI_FRAME_PRESETS.map(item => item.id)} onChange={presetId => { const preset = UI_FRAME_PRESETS.find(item => item.id === presetId); if (preset) props.updateNode(node().id, { framePreset: preset.id, width: preset.width, height: preset.height, frameType: preset.id === "custom" ? "container" : "screen" }); }} /><label class="ui-check-row"><input type="checkbox" checked={node().clipContent} onChange={event => edit("clipContent", event.currentTarget.checked)} /> Clip children</label><label class="ui-color-field"><span>Frame fill</span><input type="color" value={colorValue(node().fillTokenId, node().fill)} onInput={event => props.updateNode(node().id, { fill: event.currentTarget.value, fillTokenId: "" })} /></label><label class="ui-check-row"><input type="checkbox" checked={node().mask} onChange={event => edit("mask", event.currentTarget.checked)} /> Use as mask for children</label></>)}{section("frame-preview", "Frame preview", <p class="ui-inspector-note">Child constraints update when this frame or a parent frame is resized.</p>)}</> : null}
    {section("layout", "Auto layout", <><label class="ui-check-row"><input type="checkbox" checked={node().autoLayout.enabled} onChange={event => edit("autoLayout", { ...node().autoLayout, enabled: event.currentTarget.checked })} /> Enable auto layout</label><Show when={node().autoLayout.enabled}><p class="ui-layout-summary" aria-live="polite">{layoutSummary()}</p><div class="ui-property-grid"><SelectField label="Direction" value={node().autoLayout.direction} options={["horizontal", "vertical", "grid"]} onChange={direction => edit("autoLayout", { ...node().autoLayout, direction })} />{spacingField("Gap", "gap", "gapTokenId")}<NumberField label="Columns" min={1} max={48} value={node().autoLayout.columns} onInput={columns => edit("autoLayout", { ...node().autoLayout, columns })} /><SelectField label="Align" value={node().autoLayout.alignment} options={["start", "center", "end", "stretch"]} onChange={alignment => edit("autoLayout", { ...node().autoLayout, alignment })} /><SelectField label="Justify" value={node().autoLayout.justification} options={["start", "center", "end", "space-between"]} onChange={justification => edit("autoLayout", { ...node().autoLayout, justification })} /><SelectField label="Width" value={node().autoLayout.widthMode} options={["fixed", "hug", "fill"]} onChange={widthMode => edit("autoLayout", { ...node().autoLayout, widthMode })} /><SelectField label="Height" value={node().autoLayout.heightMode} options={["fixed", "hug", "fill"]} onChange={heightMode => edit("autoLayout", { ...node().autoLayout, heightMode })} />{spacingField("Padding top", "paddingTop", "paddingTopTokenId")}{spacingField("Padding right", "paddingRight", "paddingRightTokenId")}{spacingField("Padding bottom", "paddingBottom", "paddingBottomTokenId")}{spacingField("Padding left", "paddingLeft", "paddingLeftTokenId")}</div><label class="ui-check-row"><input type="checkbox" checked={node().autoLayout.wrap} onChange={event => edit("autoLayout", { ...node().autoLayout, wrap: event.currentTarget.checked })} /> Wrap content</label><label class="ui-check-row"><input type="checkbox" checked={node().autoLayout.clip} onChange={event => edit("autoLayout", { ...node().autoLayout, clip: event.currentTarget.checked })} /> Clip content</label><Show when={node().autoLayout.direction === "grid"}><GridTracksEditor title="Columns" tracks={node().autoLayout.gridColumnMinmax} count={node().autoLayout.columns} onChange={tracks => edit("autoLayout", { ...node().autoLayout, gridColumnMinmax: tracks })} onCountChange={columns => edit("autoLayout", { ...node().autoLayout, columns })} /><GridTracksEditor title="Rows" tracks={node().autoLayout.gridRowMinmax} count={48} onChange={tracks => edit("autoLayout", { ...node().autoLayout, gridRowMinmax: tracks })} /></Show></Show>{!node().autoLayout.enabled ? <div class="ui-property-grid"><SelectField label="Width sizing" value={node().widthSizing} options={["fixed", "hug", "fill"]} onChange={widthSizing => edit("widthSizing", widthSizing)} /><SelectField label="Height sizing" value={node().heightSizing} options={["fixed", "hug", "fill"]} onChange={heightSizing => edit("heightSizing", heightSizing)} /></div> : null}</>)}
    {section("appearance", "Appearance", <><div class="ui-property-grid"><label class="ui-color-field"><span>Fill</span><input type="color" value={colorValue(node().fillTokenId, node().fill)} onInput={event => props.updateNode(node().id, { fill: event.currentTarget.value, fillTokenId: "" })} /></label><label class="ui-field"><span>Fill token</span><select value={node().fillTokenId} onChange={event => { const token = props.document.colorTokens.find(item => item.id === event.currentTarget.value); props.updateNode(node().id, { fillTokenId: token?.id ?? "", fill: token ? resolveColorToken(props.document.colorTokens, token.id, props.document.activeColorModeId, node().fill) : node().fill }); }}><option value="">Custom</option><For each={props.document.colorTokens}>{token => <option value={token.id}>{token.name}</option>}</For></select></label><label class="ui-color-field"><span>Stroke</span><input type="color" value={colorValue(node().strokeTokenId, node().stroke === "none" ? "#ffffff" : node().stroke)} onInput={event => props.updateNode(node().id, { stroke: event.currentTarget.value, strokeTokenId: "" })} /></label><label class="ui-field"><span>Stroke token</span><select value={node().strokeTokenId} onChange={event => { const token = props.document.colorTokens.find(item => item.id === event.currentTarget.value); props.updateNode(node().id, { strokeTokenId: token?.id ?? "", stroke: token ? resolveColorToken(props.document.colorTokens, token.id, props.document.activeColorModeId, node().stroke) : node().stroke }); }}><option value="">Custom</option><For each={props.document.colorTokens}>{token => <option value={token.id}>{token.name}</option>}</For></select></label><NumberField label="Stroke width" min={0} value={node().strokeWidth} onInput={value => edit("strokeWidth", value)} /><NumberField label="Radius" min={0} value={radiusValue()} onInput={value => props.updateNode(node().id, { radius: value, radiusTokenId: "" })} /><label class="ui-field"><span>Radius token</span><select value={node().radiusTokenId} onChange={event => { const token = props.document.radiusTokens.find(item => item.id === event.currentTarget.value); props.updateNode(node().id, { radiusTokenId: token?.id ?? "", ...(token ? { radius: resolveValueToken(token, props.document.activeColorModeId, props.document.radiusTokens) ?? node().radius } : {}) }); }}><option value="">Custom</option><For each={props.document.radiusTokens}>{token => <option value={token.id}>{token.name}</option>}</For></select></label><NumberField label="Opacity %" min={0} max={100} value={round(node().opacity * 100)} onInput={value => edit("opacity", value / 100)} /><SelectField label="Shadow" value={node().shadow} options={["none", "soft", "strong"]} onChange={shadow => props.updateNode(node().id, { shadow, effectTokenId: "", effectValue: "" })} /><label class="ui-field"><span>Effect token</span><select value={node().effectTokenId} onChange={event => props.updateNode(node().id, { effectTokenId: event.currentTarget.value, effectValue: "", shadow: "none" })}><option value="">Custom</option><For each={props.document.effectTokens}>{token => <option value={token.id}>{token.name}</option>}</For></select></label><TextField label="Custom shadow" value={node().effectValue} placeholder="0 4px 12px #00000020" onInput={value => props.updateNode(node().id, { effectValue: value.slice(0, 256), effectTokenId: "", shadow: "none" })} /><SelectField label="Stroke style" value={node().strokeStyle} options={["solid", "dashed", "dotted"]} onChange={strokeStyle => edit("strokeStyle", strokeStyle)} /></div><Show when={node().kind !== "frame" && node().kind !== "group" && node().kind !== "componentInstance"}><label class="ui-check-row"><input type="checkbox" checked={!!node().fillGradient} onChange={event => props.updateNode(node().id, { fillGradient: event.currentTarget.checked ? node().fillGradient ?? { angle: 90, from: node().fill.startsWith("#") ? node().fill : "#365fe5", to: "#ffffff" } : undefined })} /> Linear gradient fill</label><Show when={node().fillGradient}><div class="ui-gradient-fields"><NumberField label="Angle °" min={-360} max={360} value={node().fillGradient?.angle ?? 90} onInput={angle => { const g = node().fillGradient; if (g) props.updateNode(node().id, { fillGradient: { angle, from: g.from, to: g.to } }); }} /><label class="ui-color-field"><span>From</span><input type="color" value={node().fillGradient?.from ?? "#365fe5"} onInput={event => { const g = node().fillGradient; if (g) props.updateNode(node().id, { fillGradient: { angle: g.angle, from: event.currentTarget.value, to: g.to } }); }} /></label><label class="ui-color-field"><span>To</span><input type="color" value={node().fillGradient?.to ?? "#ffffff"} onInput={event => { const g = node().fillGradient; if (g) props.updateNode(node().id, { fillGradient: { angle: g.angle, from: g.from, to: event.currentTarget.value } }); }} /></label></div></Show></Show><label class="ui-field"><span>Token mode</span><select value={props.document.activeColorModeId} onChange={event => props.setColorMode(event.currentTarget.value)}>{props.document.colorModes.map(mode => <option value={mode.id}>{mode.name}</option>)}</select></label></>)}
    <Show when={props.document.responsiveBreakpoints.length > 0}><ResponsiveOverridesEditor node={node()} breakpoints={props.document.responsiveBreakpoints} onChange={responsiveOverrides => props.updateNode(node().id, { responsiveOverrides })} /></Show>
    <Show when={["text", "button", "input", "checkbox"].includes(node().kind)}>{section("text", "Text", <><TextField label="Content" value={node().text} onInput={value => edit("text", value)} multiline /><div class="ui-property-grid"><SelectField label="Font" value={node().fontFamily} options={["system", "sans", "serif", "mono"]} onChange={fontFamily => edit("fontFamily", fontFamily)} /><NumberField label="Size" min={1} max={512} value={node().fontSize} onInput={value => edit("fontSize", value)} /><NumberField label="Weight" min={100} max={900} step={100} value={node().fontWeight} onInput={value => edit("fontWeight", value)} /><NumberField label="Line height" min={50} max={500} value={round(node().lineHeight * 100)} onInput={value => edit("lineHeight", value / 100)} /><NumberField label="Letter spacing" value={node().letterSpacing} onInput={value => edit("letterSpacing", value)} /><SelectField label="Align" value={node().textAlign} options={["left", "center", "right"]} onChange={textAlign => edit("textAlign", textAlign)} /></div><label class="ui-field"><span>Text style</span><select value={node().typographyTokenId} onChange={event => { const token = props.document.typographyTokens.find(item => item.id === event.currentTarget.value); props.updateNode(node().id, { typographyTokenId: token?.id ?? "", ...(token ? resolveTypographyToken(token, props.document.activeColorModeId, props.document.typographyTokens) : {}) }); }}><option value="">Custom</option><For each={props.document.typographyTokens}>{token => <option value={token.id}>{token.name}</option>}</For></select></label></>)} </Show>
    <Show when={node().kind === "image"}>{section("image", "Image", <><SelectField label="Fit" value={node().imageFit} options={["cover", "contain", "fill"]} onChange={imageFit => edit("imageFit", imageFit)} /><div class="ui-property-grid"><NumberField label="Crop X %" min={0} max={100} value={round(node().imageCrop.x * 100)} onInput={value => edit("imageCrop", { ...node().imageCrop, x: value / 100 })} /><NumberField label="Crop Y %" min={0} max={100} value={round(node().imageCrop.y * 100)} onInput={value => edit("imageCrop", { ...node().imageCrop, y: value / 100 })} /><NumberField label="Crop W %" min={1} max={100} value={round(node().imageCrop.width * 100)} onInput={value => edit("imageCrop", { ...node().imageCrop, width: value / 100 })} /><NumberField label="Crop H %" min={1} max={100} value={round(node().imageCrop.height * 100)} onInput={value => edit("imageCrop", { ...node().imageCrop, height: value / 100 })} /></div></>)} </Show>
    <Show when={node().kind === "componentInstance"}>{section("component", "Component instance", <><label class="ui-field"><span>Variant</span><select value={node().componentVariantId} onChange={event => props.applyVariant(node(), event.currentTarget.value)}><For each={props.document.components.find(item => item.id === node().componentId)?.variants ?? []}>{variant => <option value={variant.id}>{variant.name}</option>}</For></select></label><div class="ui-property-grid"><button onClick={() => props.saveComponentVariant(node())}>Save current as variant</button><button onClick={() => props.resetComponent(node())}>Reset overrides</button><button onClick={() => props.detachComponent(node())}>Detach instance</button></div></>)} </Show>
    <Show when={node().kind !== "componentInstance" && containingInstance() && (node().componentSourceIds[containingInstance()!.componentId] || node().componentSourceId)}>{section("component-child-overrides", "Instance child overrides", <><p class="ui-inspector-note">{Object.keys(node().overrides).length ? `Overrides: ${Object.keys(node().overrides).join(", ")}` : "This child follows its component master."}</p><button type="button" disabled={!Object.keys(node().overrides).length} onClick={() => props.resetComponentNode(node())}>Reset this child</button></>)}</Show>
    {section("reusable-component", "Reusable component", <><p class="ui-inspector-note">Create a reusable local component from the selected node and its children.</p><button type="button" onClick={props.createComponent}>Create component</button></>)}
  </>;
}

function InteractionEditor(props: { interaction: UIInteraction; page: UIPage; nodes: UIElement[]; variables: UIPrototypeVariable[]; onChange: (interaction: UIInteraction) => void; onRemove: () => void }) {
  const interaction = () => props.interaction;
  const setCondition = (patch: Partial<NonNullable<UIInteraction["condition"]>>) => props.onChange({ ...interaction(), condition: { variableId: interaction().condition?.variableId ?? props.variables[0]?.id ?? "", operator: interaction().condition?.operator ?? "truthy", ...interaction().condition, ...patch } });
  const targetValue = (event: InputEvent) => {
    const variable = props.variables.find(item => item.id === interaction().variableId);
    const raw = (event.currentTarget as HTMLInputElement).value;
    return typeof variable?.value === "number" ? Number(raw) : typeof variable?.value === "boolean" ? raw === "true" : raw;
  };
  return <article class="ui-interaction-card"><header><strong>{interaction().name}</strong><button type="button" aria-label="Remove interaction" onClick={props.onRemove}>×</button></header>
    <div class="ui-property-grid"><SelectField label="Trigger" value={interaction().trigger} options={["click", "hover", "press", "keyboard", "timed"]} onChange={trigger => props.onChange({ ...interaction(), trigger })} /><SelectField label="Action" value={interaction().action} options={["navigate", "back", "open-overlay", "close-overlay", "set-variable"]} onChange={action => props.onChange({ ...interaction(), action })} /></div>
    <Show when={interaction().trigger === "keyboard"}><TextField label="Key" value={interaction().key ?? "Enter"} onInput={key => props.onChange({ ...interaction(), key: key.slice(0, 32) })} /></Show>
    <Show when={interaction().trigger === "timed"}><NumberField label="Delay (ms)" min={0} max={60000} value={interaction().delayMs ?? 1000} onInput={delayMs => props.onChange({ ...interaction(), delayMs })} /></Show>
    <Show when={interaction().action === "navigate" || interaction().action === "open-overlay"}><label class="ui-field"><span>Destination</span><select value={interaction().targetNodeId ?? interaction().targetPageId ?? ""} onChange={event => { const target = event.currentTarget.value; const isNode = props.nodes.some(node => node.id === target); props.onChange({ ...interaction(), targetNodeId: isNode ? target : "", targetPageId: isNode ? "" : target }); }}><option value="">Select screen</option><For each={props.nodes.filter(node => node.kind === "frame" && node.frameType === "screen")}>{node => <option value={node.id}>{node.name}</option>}</For><For each={props.page.prototypeFlows}>{flow => <option value={flow.startPageId}>Page · {flow.name}</option>}</For></select></label></Show>
    <Show when={interaction().action === "set-variable"}><Show when={props.variables.length > 0} fallback={<p class="ui-inspector-note">Add a prototype variable below first.</p>}><label class="ui-field"><span>Variable</span><select value={interaction().variableId ?? ""} onChange={event => { const variable = props.variables.find(item => item.id === event.currentTarget.value); props.onChange({ ...interaction(), variableId: event.currentTarget.value, variableValue: variable?.value }); }}><For each={props.variables}>{variable => <option value={variable.id}>{variable.name}</option>}</For></select></label><Show when={props.variables.find(item => item.id === interaction().variableId)}>{variable => <label class="ui-field"><span>New value</span>{typeof variable().value === "boolean" ? <select value={String(interaction().variableValue ?? variable().value)} onChange={event => props.onChange({ ...interaction(), variableValue: event.currentTarget.value === "true" })}><option value="true">True</option><option value="false">False</option></select> : <input type={typeof variable().value === "number" ? "number" : "text"} value={String(interaction().variableValue ?? variable().value)} onInput={event => props.onChange({ ...interaction(), variableValue: targetValue(event) })} />}</label>}</Show></Show></Show>
    <label class="ui-check-row"><input type="checkbox" checked={!!interaction().condition} disabled={!props.variables.length} onChange={event => props.onChange({ ...interaction(), condition: event.currentTarget.checked ? { variableId: props.variables[0]?.id ?? "", operator: "truthy" } : undefined })} />Run only when condition matches</label>
    <Show when={interaction().condition}><div class="ui-property-grid"><label class="ui-field"><span>Variable</span><select value={interaction().condition!.variableId} onChange={event => setCondition({ variableId: event.currentTarget.value })}><For each={props.variables}>{variable => <option value={variable.id}>{variable.name}</option>}</For></select></label><SelectField label="Rule" value={interaction().condition!.operator} options={["equals", "not-equals", "greater", "less", "truthy", "falsy"]} onChange={operator => setCondition({ operator })} /><Show when={!(["truthy", "falsy"] as const).includes(interaction().condition!.operator as "truthy" | "falsy")}><TextField label="Value" value={String(interaction().condition!.value ?? "")} onInput={value => setCondition({ value })} /></Show></div></Show>
    <Show when={interaction().action === "navigate" || interaction().action === "open-overlay"}><SelectField label="Transition" value={interaction().transition} options={["instant", "dissolve", "slide-left", "slide-right"]} onChange={transition => props.onChange({ ...interaction(), transition })} /></Show>
    <Show when={interaction().action === "open-overlay"}><div class="ui-property-grid"><SelectField label="Position" value={interaction().overlayPosition ?? "center"} options={["center", "top", "bottom"]} onChange={overlayPosition => props.onChange({ ...interaction(), overlayPosition })} /><label class="ui-color-field"><span>Backdrop</span><input type="color" value={interaction().overlayBackground ?? "#172235"} onInput={event => props.onChange({ ...interaction(), overlayBackground: event.currentTarget.value })} /></label><NumberField label="Backdrop opacity %" min={0} max={100} value={round((interaction().overlayOpacity ?? 0.48) * 100)} onInput={value => props.onChange({ ...interaction(), overlayOpacity: value / 100 })} /></div><label class="ui-check-row"><input type="checkbox" checked={interaction().closeOnOutside ?? true} onChange={event => props.onChange({ ...interaction(), closeOnOutside: event.currentTarget.checked })} />Close on outside click</label></Show>
  </article>;
}

function MultiSelectionInspector(props: { count: number; nodes: UIElement[]; onFill: (value: string) => void; onOpacity: (value: number) => void }) {
  const first = () => props.nodes[0];
  const mixedFill = () => props.nodes.some(node => node.fill !== first()?.fill);
  const mixedOpacity = () => props.nodes.some(node => node.opacity !== first()?.opacity);
  return <section class="ui-inspector-section ui-multiselection"><header><strong>Multiple selection</strong><span>{props.count} layers</span></header><p class="ui-inspector-note">Changes apply to unlocked selected layers.</p><div class="ui-property-grid"><label class="ui-color-field"><span>Fill{mixedFill() ? " · mixed" : ""}</span><input aria-label="Apply fill to selection" type="color" value={first()?.fill?.startsWith("#") ? first()!.fill : "#ffffff"} onInput={event => props.onFill(event.currentTarget.value)} /></label><NumberField label={`Opacity${mixedOpacity() ? " · mixed" : ""} %`} min={0} max={100} value={round((first()?.opacity ?? 1) * 100)} onInput={value => props.onOpacity(value / 100)} /></div></section>;
}

function InspectPanel(props: { node: UIElement; document: UIDesignDocument; elements: UIElement[]; pageId: string; world: { x: number; y: number; rotation: number } }) {
  const node = () => props.node;
  const tree = () => new UIHierarchyIndex<UIElement>(props.pageId, props.elements);
  const parent = () => tree().get(node().parentId);
  const childrenCount = () => tree().descendants(node().id).length;
  const fill = () => resolveColorToken(props.document.colorTokens, node().fillTokenId, props.document.activeColorModeId, node().fill);
  const stroke = () => resolveColorToken(props.document.colorTokens, node().strokeTokenId, props.document.activeColorModeId, node().stroke);
  const radius = () => resolveValueToken(props.document.radiusTokens.find(item => item.id === node().radiusTokenId), props.document.activeColorModeId, props.document.radiusTokens) ?? node().radius;
  const effect = () => resolveEffectToken(props.document.effectTokens.find(item => item.id === node().effectTokenId), props.document.activeColorModeId, props.document.effectTokens) || node().effectValue || (node().shadow === "soft" ? "0 5px 16px #26354d20" : node().shadow === "strong" ? "0 12px 30px #26354d40" : "none");
  const typography = () => resolveTypographyToken(props.document.typographyTokens.find(item => item.id === node().typographyTokenId), props.document.activeColorModeId, props.document.typographyTokens);
  const spacing = (value: number, tokenId: string) => `${round(resolveValueToken(props.document.spacingTokens.find(item => item.id === tokenId), props.document.activeColorModeId, props.document.spacingTokens) ?? value)}px`;
  const worldCss = () => {
    const declarations = [
      "position: absolute", `left: ${round(props.world.x)}px`, `top: ${round(props.world.y)}px`,
      `width: ${round(node().width)}px`, `height: ${round(node().height)}px`, `transform: rotate(${round(props.world.rotation)}deg)`,
      `opacity: ${node().opacity}`, ...(() => { const g = node().fillGradient; return node().fill !== "none" ? [`background: ${g ? `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})` : fill()}`] : []; })(),
      ...(stroke() !== "none" && node().strokeWidth > 0 ? [`border: ${round(node().strokeWidth)}px ${node().strokeStyle} ${stroke()}`] : ["border: none"]),
      `border-radius: ${round(radius())}px`, ...(effect() !== "none" ? [`box-shadow: ${safeBoxShadow(effect())}`] : []),
    ];
    if (node().autoLayout.enabled) declarations.push(`display: ${node().autoLayout.direction === "grid" ? "grid" : "flex"}`, ...(node().autoLayout.direction === "grid" ? [`grid-template-columns: repeat(${node().autoLayout.columns}, minmax(0, 1fr))`] : [`flex-direction: ${node().autoLayout.direction === "horizontal" ? "row" : "column"}`]), `gap: ${spacing(node().autoLayout.gap, node().autoLayout.gapTokenId)}`, `padding: ${spacing(node().autoLayout.paddingTop, node().autoLayout.paddingTopTokenId)} ${spacing(node().autoLayout.paddingRight, node().autoLayout.paddingRightTokenId)} ${spacing(node().autoLayout.paddingBottom, node().autoLayout.paddingBottomTokenId)} ${spacing(node().autoLayout.paddingLeft, node().autoLayout.paddingLeftTokenId)}`, `align-items: ${node().autoLayout.alignment === "start" ? "flex-start" : node().autoLayout.alignment === "end" ? "flex-end" : node().autoLayout.alignment}`, `justify-content: ${node().autoLayout.justification === "start" ? "flex-start" : node().autoLayout.justification === "end" ? "flex-end" : node().autoLayout.justification}`, `flex-wrap: ${node().autoLayout.wrap ? "wrap" : "nowrap"}`);
    if (["text", "button", "input", "checkbox"].includes(node().kind)) {
      const type = typography();
      declarations.push(`font-family: ${fontStacks[type?.fontFamily ?? node().fontFamily]}`, `font-size: ${round(type?.fontSize ?? node().fontSize)}px`, `font-weight: ${type?.fontWeight ?? node().fontWeight}`, `line-height: ${type?.lineHeight ?? node().lineHeight}`, `letter-spacing: ${round(type?.letterSpacing ?? node().letterSpacing)}px`, `text-align: ${node().textAlign}`);
    }
    return `.layer-${node().id.replace(/[^\w-]/g, "-")} {\n${declarations.map(item => `  ${item};`).join("\n")}\n}`;
  };
  const markup = (solid: boolean) => {
    const render = (item: UIElement, depth: number, root: boolean, parentFlow: boolean): string => {
      const indent = "  ".repeat(depth); const className = `layer-${item.id.replace(/[^\w-]/g, "-")}`;
      const background = ["group", "componentInstance"].includes(item.kind) || item.kind === "frame" && item.frameType === "container" ? "transparent" : item.fillGradient ? `linear-gradient(${item.fillGradient.angle}deg, ${item.fillGradient.from}, ${item.fillGradient.to})` : item.fill;
      const flowChild = parentFlow && item.layoutPosition !== "absolute";
      const positionValues: Array<[string, string]> = root || flowChild ? [] : [
        ["left", `${round(item.x)}px`],
        ["top", `${round(item.y)}px`],
      ];
      const styleValues: Array<[string, string]> = [
        ["position", root || flowChild ? "relative" : "absolute"],
        ...positionValues,
        ["width", `${round(item.width)}px`], ["height", `${round(item.height)}px`],
        ["transform", root ? "none" : `rotate(${round(item.rotation)}deg)`], ["opacity", String(item.opacity)],
        ["boxSizing", "border-box"], ["background", background],
        ["border", item.stroke === "none" ? "none" : `${round(item.strokeWidth)}px ${item.strokeStyle} ${stroke()}`],
        ["borderRadius", item.kind === "ellipse" ? "50%" : `${round(item.radius)}px`],
        ["overflow", item.clipContent || item.mask || item.autoLayout.clip ? "hidden" : "visible"],
        ...(item.shadow !== "none" || item.effectValue ? [["boxShadow", safeBoxShadow(item.effectValue || (item.shadow === "soft" ? "0 5px 16px #26354d20" : "0 12px 30px #26354d40"))] as [string, string]] : []),
        ...(item.autoLayout.enabled ? [["display", item.autoLayout.direction === "grid" ? "grid" : "flex"], ...(item.autoLayout.direction === "grid" ? [["gridTemplateColumns", `repeat(${item.autoLayout.columns}, minmax(0, 1fr))`] as [string, string]] : [["flexDirection", item.autoLayout.direction === "horizontal" ? "row" : "column"] as [string, string]]), ["gap", `${round(item.autoLayout.gap)}px`], ["padding", `${round(item.autoLayout.paddingTop)}px ${round(item.autoLayout.paddingRight)}px ${round(item.autoLayout.paddingBottom)}px ${round(item.autoLayout.paddingLeft)}px`], ["flexWrap", item.autoLayout.wrap ? "wrap" : "nowrap"]] as Array<[string, string]> : []),
        ...(["text", "button", "input", "checkbox"].includes(item.kind) ? [["color", item.kind === "text" ? fill() : readableTextColor(background)], ["fontFamily", fontStacks[item.fontFamily]], ["fontSize", `${round(item.fontSize)}px`], ["fontWeight", String(item.fontWeight)], ["lineHeight", String(item.lineHeight)], ["textAlign", item.textAlign]] as Array<[string, string]> : []),
      ];
      const style = styleValues.map(([key, value]) => `${key.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)}:${value}`).join(";");
      const styleObject = `{ ${styleValues.map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(", ")} }`;
      const attrs = solid ? `class={${JSON.stringify(className)}} data-kind={${JSON.stringify(item.kind)}} style={${styleObject}}` : `class="${className}" data-kind="${item.kind}" style="${escapeHtml(style)}"`;
      const children = tree().children(item.id).map(child => render(child, depth + 1, false, item.autoLayout.enabled)).join("\n");
      const content = escapeHtml(item.text);
      if (item.kind === "input") return `${indent}<input ${attrs} value="${escapeHtml(item.text)}" />`;
      if (item.kind === "image" && item.imageData.startsWith("data:image/")) return `${indent}<img ${attrs} src="${escapeHtml(item.imageData)}" alt="${escapeHtml(item.text || item.name)}" />`;
      const tag = item.kind === "button" ? "button" : item.kind === "checkbox" ? "label" : "div";
      const label = item.kind === "checkbox" ? `<input type="checkbox" /> ${content}` : content;
      const open = `<${tag}${item.kind === "button" ? " type=\"button\"" : ""} ${attrs}>`;
      const solidOpen = `<${tag}${item.kind === "button" ? " type=\"button\"" : ""} ${attrs}>`;
      return `${indent}${solid ? solidOpen : open}${label ? `\n${indent}  ${label}` : ""}${children ? `\n${children}` : ""}\n${indent}</${tag}>`;
    };
    const markup = render(node(), 1, true, false);
    return solid ? `import type { Component } from "solid-js";\n\nexport const GeneratedLayer: Component = () => (\n${markup}\n);` : markup;
  };  const layoutRule = () => node().autoLayout.enabled ? `${node().autoLayout.direction} auto layout · ${round(node().autoLayout.gap)} px gap · padding ${round(node().autoLayout.paddingTop)}/${round(node().autoLayout.paddingRight)}/${round(node().autoLayout.paddingBottom)}/${round(node().autoLayout.paddingLeft)} px · ${node().autoLayout.wrap ? "wrap" : "no wrap"}` : `${node().layoutPosition} position · ${node().widthSizing} width · ${node().heightSizing} height`;
  const constraints = () => `${node().constraints.horizontal} / ${node().constraints.vertical}${node().constraints.minWidth || node().constraints.maxWidth || node().constraints.minHeight || node().constraints.maxHeight ? ` · min/max ${node().constraints.minWidth ?? "—"}/${node().constraints.maxWidth ?? "—"} × ${node().constraints.minHeight ?? "—"}/${node().constraints.maxHeight ?? "—"}` : ""}`;
  return <div class="ui-inspect-content"><dl><dt>Width</dt><dd>{round(node().width)} px</dd><dt>Height</dt><dd>{round(node().height)} px</dd><dt>Position</dt><dd>{round(props.world.x)}, {round(props.world.y)} px</dd><dt>Rotation</dt><dd>{round(props.world.rotation)}°</dd><dt>Parent</dt><dd>{parent()?.name ?? "Page"}</dd><dt>Children</dt><dd>{childrenCount()}</dd><dt>Layout rule</dt><dd>{layoutRule()}</dd><dt>Constraints</dt><dd>{constraints()}</dd><dt>Clipping</dt><dd>{node().clipContent || node().mask || node().autoLayout.clip ? "Enabled" : "Off"}</dd><dt>Fill</dt><dd>{(() => { const g = node().fillGradient; return <i style={{ background: g ? `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})` : fill() }} />; })()}{fill()}</dd><dt>Stroke</dt><dd>{stroke()}</dd><dt>Radius</dt><dd>{round(radius())} px</dd><dt>Effect</dt><dd>{effect()}</dd><dt>Layout</dt><dd>{node().autoLayout.enabled ? `Auto layout · ${node().autoLayout.direction}` : `${node().widthSizing} × ${node().heightSizing}`}</dd></dl><CodeBlock title="CSS" code={worldCss()} /><CodeBlock title="HTML structure" code={markup(false)} /><CodeBlock title="SolidJS structure" code={markup(true)} /></div>;
}function CodeBlock(props: { title: string; code: string }) { const [copied, setCopied] = createSignal(false); return <section class="ui-code-section"><header><strong>{props.title}</strong><button onClick={() => { void navigator.clipboard?.writeText(props.code); setCopied(true); window.setTimeout(() => setCopied(false), 1200); }}>{copied() ? "Copied" : "Copy"}</button></header><pre><code>{props.code}</code></pre></section>; }

function PrototypePresentation(props: { document: UIDesignDocument; pageId: string; nodeId: string; overlay?: { pageId: string; nodeId: string; position: "center" | "top" | "bottom"; background: string; opacity: number; closeOnOutside: boolean }; historyLength: number; transition: UIInteraction["transition"]; renderNode: (nodeId: string, page: UIPage) => JSX.Element; onClose: () => void; onBack: () => void; onScreen: (pageId: string, nodeId: string) => void }) {
  const pageFor = (id: string) => props.document.pages.find(item => item.id === id) ?? props.document.pages[0];
  const rootFor = (page: UIPage, id: string) => page.elements.find(item => item.id === id) ?? page.elements.find(item => item.kind === "frame" && item.parentId === page.id) ?? page.elements.find(item => item.parentId === page.id);
  const page = () => pageFor(props.pageId); const root = () => rootFor(page(), props.nodeId);
  const overlayPage = () => props.overlay ? pageFor(props.overlay.pageId) : undefined;
  const overlayRoot = () => props.overlay && overlayPage() ? rootFor(overlayPage()!, props.overlay.nodeId) : undefined;
  const screens = () => props.document.pages.flatMap(item => item.elements.filter(node => node.kind === "frame" && node.frameType === "screen" && !new UIHierarchyIndex<UIElement>(item.id, item.elements).ancestors(node.id).some(parent => parent.hidden)).map(node => ({ pageId: item.id, nodeId: node.id, label: `${item.name} / ${node.name}` })));
  let viewport: HTMLDivElement | undefined;
  const [viewportSize, setViewportSize] = createSignal({ width: 0, height: 0 });
  onMount(() => { if (!viewport) return; const observer = new ResizeObserver(entries => { const rect = entries[0]?.contentRect; if (rect) setViewportSize({ width: rect.width, height: rect.height }); }); observer.observe(viewport); onCleanup(() => observer.disconnect()); });
  const scale = (node?: UIElement) => node ? Math.min(1, Math.max(0.05, Math.min((viewportSize().width - 64) / Math.max(1, node.width), (viewportSize().height - 64) / Math.max(1, node.height)))) : 1;
  const chooseScreen = (value: string) => { const [pageId, nodeId] = value.split("::"); props.onScreen(pageId, nodeId); };
  const selectedScreen = () => `${props.pageId}::${props.nodeId}`;
  return <div class="ui-present-overlay"><header><div><span class="ui-present-dot" /> Preview · {page().name}{root()?.name ? ` · ${root()!.name}` : ""}</div><div><button disabled={!props.historyLength && !props.overlay} onClick={props.onBack}>← Back</button><label>Screen<select value={selectedScreen()} onChange={event => chooseScreen(event.currentTarget.value)}><For each={screens()}>{screen => <option value={`${screen.pageId}::${screen.nodeId}`}>{screen.label}</option>}</For></select></label><button onClick={props.onClose}>Close ×</button></div></header><div class={`ui-present-stage transition-${props.transition}`} ref={viewport}>
    <Show when={root()} fallback={<div class="ui-present-empty">This page has no screen or content to preview.</div>}>{screen => <div class="ui-present-device" style={{ width: `${screen().width}px`, height: `${screen().height}px`, "--preview-scale": scale(screen()), background: screen().fill }}>{props.renderNode(screen().id, page())}<Show when={overlayRoot()}>{overlay => <div class="ui-present-overlay-scrim" style={{ background: `${props.overlay?.background ?? "#172235"}${Math.round((props.overlay?.opacity ?? 0.48) * 255).toString(16).padStart(2, "0")}`, "align-items": props.overlay?.position === "top" ? "flex-start" : props.overlay?.position === "bottom" ? "flex-end" : "center", "padding-top": props.overlay?.position === "top" ? "24px" : "0" }} onClick={event => { if (event.target === event.currentTarget && props.overlay?.closeOnOutside) props.onBack(); }}><div class="ui-present-overlay-device" style={{ width: `${overlay().width}px`, height: `${overlay().height}px`, "--preview-scale": scale(overlay()), background: overlay().fill }}>{props.renderNode(overlay().id, overlayPage()!)}</div></div>}</Show></div>}</Show>
  </div></div>;
}

function escapeXml(value: string) { return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ?? character); }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character); }
async function rasterizeSvg(svg: string, width: number, height: number): Promise<Blob> {
  const scale = Math.min(1, 8192 / Math.max(1, width), 8192 / Math.max(1, height), Math.sqrt(16_000_000 / Math.max(1, width * height)));
  const pixelWidth = Math.max(1, Math.ceil(width * scale)); const pixelHeight = Math.max(1, Math.ceil(height * scale));
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("The design could not be rasterized for export")); image.src = url; });
    const canvas = document.createElement("canvas"); canvas.width = pixelWidth; canvas.height = pixelHeight;
    const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas rendering is unavailable for image export");
    context.drawImage(image, 0, 0, pixelWidth, pixelHeight);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("The image export could not be encoded")), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}
function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.style.display = "none"; document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadText(name: string, contents: string, type: string) { downloadBlob(name, new Blob([contents], { type })); }

type TokenAliasChoice = { id: string; name: string; aliasOf?: string };
function TokenAliasSelect(props: { token: TokenAliasChoice; tokens: TokenAliasChoice[]; onChange: (aliasOf: string) => void }) {
  const options = () => props.tokens.filter(item => item.id !== props.token.id && canSetTokenAlias(props.tokens, props.token.id, item.id));
  return <select class="ui-token-alias-select" value={props.token.aliasOf ?? ""} aria-label={`Alias for ${props.token.name}`} title={`Alias ${props.token.name} to another token`} onChange={event => props.onChange(event.currentTarget.value)}><option value="">Custom value</option><For each={options()}>{item => <option value={item.id}>{item.name}</option>}</For></select>;
}

export function UiDesignWorkspace(props: Props) { return <Show when={props.session.editorOpen()} fallback={<UiDesignHome session={props.session} />}><UiDesignEditor session={props.session} /></Show>; }
