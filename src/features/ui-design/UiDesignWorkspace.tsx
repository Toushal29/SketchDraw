import { For, Show, createMemo, createSignal, onCleanup, onMount, type JSX } from "solid-js";
import { applyAutoLayout, resizeFrameChildren } from "./layout-engine";
import { createUIElement, createUIFrame, createUIDesignId, UI_FRAME_PRESETS, type UIComponentVariant, type UIElement, type UIElementKind, type UIFramePresetId, type UIInteraction, type UIDesignDocument, type UIPage } from "./model";
import { equalSpacingAround, measureNeighborGaps, normalizeRect, resizeElement, snapPosition, unionRects, type UISnapGuide, type UIRect } from "./geometry";
import { UIHierarchyIndex } from "./hierarchy";
import type { UIDesignSession } from "./session";
import "./ui-design.css";

type Props = { session: UIDesignSession };
type Tool = "select" | "hand" | "measure" | "frame" | Exclude<UIElementKind, "group" | "componentInstance">;
type Camera = { x: number; y: number; zoom: number };
type Gesture =
  | { kind: "pan"; pointer: number; clientX: number; clientY: number; camera: Camera }
  | { kind: "draw"; pointer: number; tool: Tool; parentId: string; start: { x: number; y: number }; current: { x: number; y: number } }
  | { kind: "move"; pointer: number; start: { x: number; y: number }; ids: string[]; originals: UIElement[] }
  | { kind: "resize"; pointer: number; start: { x: number; y: number }; id: string; original: UIElement; handle: string }
  | { kind: "marquee"; pointer: number; start: { x: number; y: number }; current: { x: number; y: number }; additive: string[] }
  | { kind: "measure"; pointer: number; start: { x: number; y: number }; current: { x: number; y: number } }
  | { kind: "point"; pointer: number; id: string; point: number };
type AssetPart = { kind: Exclude<UIElementKind, "frame" | "group" | "componentInstance">; name?: string; text?: string; x: number; y: number; width: number; height: number; fill?: string; radius?: number };
type Asset = { id: string; name: string; category: string; width: number; height: number; parts: AssetPart[] };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const round = (value: number) => Math.round(value);
const fontStacks = { system: "system-ui, sans-serif", sans: "Arial, sans-serif", serif: "Georgia, serif", mono: "ui-monospace, monospace" };
const kindName = (kind: UIElementKind) => kind === "componentInstance" ? "Component" : kind[0].toUpperCase() + kind.slice(1);
function resolveColorToken(tokens: UIDesignDocument["colorTokens"], id: string, modeId: string, fallback: string): string {
  const byId = new Map(tokens.map(token => [token.id, token])); const seen = new Set<string>(); let token = byId.get(id);
  while (token && token.aliasOf && !seen.has(token.id)) { seen.add(token.id); token = byId.get(token.aliasOf); }
  const candidate = token?.modeValues?.[modeId] ?? token?.value;
  return candidate && /^#[\da-f]{3,8}$/i.test(candidate) ? candidate : fallback;
}
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
  return <label class="ui-field"><span>{props.label}</span><input type="number" min={props.min ?? -1000000} max={props.max ?? 1000000} step={props.step ?? 1} value={round(props.value)} onInput={event => { const value = Number(event.currentTarget.value); if (Number.isFinite(value)) props.onInput(round(value)); }} /></label>;
}
function SelectField<T extends string>(props: { label: string; value: T; options: T[]; onChange: (value: T) => void }) {
  return <label class="ui-field"><span>{props.label}</span><select value={props.value} onChange={event => props.onChange(event.currentTarget.value as T)}><For each={props.options}>{option => <option value={option}>{option}</option>}</For></select></label>;
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
    <Show when={props.tool === "measure"}><path d="M4 20 20 4m-14 13 3 3m2-7 3 3m2-7 3 3" /></Show>
  </svg>;
}

function NodeView(props: { node: UIElement; parentIsPage: boolean; selected: boolean; editing: boolean; interactive: boolean; root?: boolean; visualKind?: UIElementKind; fillOverride?: string; renderChildren: (parentId: string) => JSX.Element; onDown: (event: PointerEvent, node: UIElement) => void; onResize: (event: PointerEvent, node: UIElement, handle: string) => void; onDouble: (node: UIElement) => void; onText: (node: UIElement, text: string) => void; onInteraction: (interaction: UIInteraction) => void; onPointDown: (event: PointerEvent, node: UIElement, point: number) => void }) {
  const node = () => props.node;
  const visualKind = () => props.visualKind ?? node().kind;
  const textLike = () => ["text", "button", "input", "checkbox"].includes(visualKind());
  const fill = () => props.fillOverride ?? (node().fillTokenId ? node().fill : node().fill);
  const style = (): JSX.CSSProperties => ({ left: `${props.root ? 0 : node().x}px`, top: `${props.root ? 0 : node().y}px`, width: `${node().width}px`, height: `${node().height}px`, transform: `rotate(${props.root ? 0 : node().rotation}deg)`, "--node-fill": fill(), "--node-stroke": node().stroke === "none" ? "transparent" : node().stroke, "--node-radius": `${node().radius}px`, opacity: node().opacity, "font-family": fontStacks[node().fontFamily], "font-size": `${node().fontSize}px`, "font-weight": node().fontWeight, "line-height": node().lineHeight, "letter-spacing": `${node().letterSpacing}px`, "text-align": node().textAlign, "box-shadow": node().shadow === "soft" ? "0 5px 16px #26354d20" : node().shadow === "strong" ? "0 12px 30px #26354d40" : "none" });
  const frameClass = () => visualKind() === "frame" ? props.parentIsPage && node().frameType === "screen" ? "node-screen-frame" : "node-container-frame" : "";
  const onTrigger = (trigger: UIInteraction["trigger"]) => { const interaction = node().interactions.find(item => item.trigger === trigger); if (props.interactive && interaction) props.onInteraction(interaction); };
  return <div class={`ui-node kind-${visualKind()} ${frameClass()} ${props.selected ? "is-selected" : ""} ${node().hidden ? "is-hidden" : ""} ${node().locked ? "is-locked" : ""} ${props.interactive ? "is-preview" : ""}`} data-node-id={node().id} style={style()} aria-label={node().name} title={node().name}
    onPointerDown={event => { if (props.interactive) { event.stopPropagation(); onTrigger("press"); return; } event.stopPropagation(); props.onDown(event, node()); }}
    onPointerEnter={() => onTrigger("hover")}
    onClick={event => { if (props.interactive) { event.stopPropagation(); onTrigger("click"); } }}
    onDblClick={event => { event.stopPropagation(); if (!props.interactive) props.onDouble(node()); }}>
     <Show when={visualKind() === "frame"}><div class="ui-frame-surface" style={{ background: props.parentIsPage ? node().fill : "transparent", border: props.parentIsPage && node().stroke !== "none" ? `${node().strokeWidth}px ${node().strokeStyle} ${node().stroke}` : "none", "border-radius": `${node().radius}px`, overflow: node().clipContent ? "hidden" : "visible" }} /><Show when={props.parentIsPage && !props.interactive}><div class="ui-frame-label" onPointerDown={event => { if (props.interactive) return; event.stopPropagation(); props.onDown(event, node()); }}>{node().name}<small>{round(node().width)} × {round(node().height)}</small></div></Show></Show>
     <Show when={visualKind() === "group"}><div class="ui-group-outline" /></Show>
     <Show when={visualKind() === "image"}><Show when={node().imageData} fallback={<span class="ui-image-empty">{node().text || "Place image"}</span>}><img src={node().imageData} alt={node().text || node().name} draggable="false" style={{ "object-fit": node().imageFit, "object-position": `${node().imageCrop.x * 100}% ${node().imageCrop.y * 100}%`, width: `${node().imageCrop.width * 100}%`, height: `${node().imageCrop.height * 100}%` }} /></Show></Show>
     <Show when={visualKind() === "path"}><svg class="ui-path-svg" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true"><polygon points={node().pathPoints.map(point => `${point.x},${point.y}`).join(" ")} fill={fill()} stroke={node().stroke === "none" ? "transparent" : node().stroke} stroke-width={node().strokeWidth / Math.max(1, node().width)} vector-effect="non-scaling-stroke" /></svg></Show>
    <Show when={textLike()}><Show when={props.editing} fallback={<span class="ui-node-text">{node().text}</span>}><textarea class="ui-inline-editor" value={node().text} aria-label={`Edit ${node().name}`} onPointerDown={event => event.stopPropagation()} onInput={event => props.onText(node(), event.currentTarget.value)} onBlur={() => props.onText(node(), node().text)} /></Show></Show>
     <Show when={visualKind() === "checkbox"}><span class="ui-checkbox-mark" /></Show>
     <Show when={visualKind() === "frame" || visualKind() === "group" || node().kind === "componentInstance"}><div class="ui-node-children" style={{ overflow: visualKind() === "frame" && node().clipContent || node().autoLayout.enabled && node().autoLayout.clip ? "hidden" : "visible" }}>{props.renderChildren(node().id)}</div></Show>
    <Show when={props.selected && !props.interactive && !node().locked}><div class="ui-node-selection" aria-hidden="true" /><For each={["nw", "n", "ne", "e", "se", "s", "sw", "w"]}>{handle => <button type="button" class={`ui-resize-handle handle-${handle}`} aria-label={`Resize ${node().name} ${handle}`} onPointerDown={event => { event.stopPropagation(); props.onResize(event, node(), handle); }} />}</For></Show>
    <Show when={props.selected && node().kind === "path" && !props.interactive}><For each={node().pathPoints}>{(point, index) => <button class="ui-path-point" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} aria-label={`Edit vector point ${index() + 1}`} onPointerDown={event => { event.stopPropagation(); props.onPointDown(event, node(), index()); }} />}</For></Show>
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
  const [gesture, setGesture] = createSignal<Gesture>();
  const [leftTab, setLeftTab] = createSignal<"pages" | "layers" | "assets">("pages");
  const [rightTab, setRightTab] = createSignal<"design" | "prototype" | "inspect">("design");
  const [layerSearch, setLayerSearch] = createSignal("");
  const [assetSearch, setAssetSearch] = createSignal("");
  const [collapsed, setCollapsed] = createSignal<Set<string>>(new Set());
  const [assetCollapsed, setAssetCollapsed] = createSignal<Set<string>>(new Set());
  const [framePresetOpen, setFramePresetOpen] = createSignal(false);
  const [framePresetPosition, setFramePresetPosition] = createSignal({ left: 0, top: 0 });
  const [guideMenuOpen, setGuideMenuOpen] = createSignal(false);
  const [editingId, setEditingId] = createSignal("");
  const [dragIds, setDragIds] = createSignal<string[]>([]);
  const [connectSource, setConnectSource] = createSignal("");
  const [preview, setPreview] = createSignal(false);
  const [previewPageId, setPreviewPageId] = createSignal("");
  const [previewNodeId, setPreviewNodeId] = createSignal("");
  const [previewHistory, setPreviewHistory] = createSignal<Array<{ pageId: string; nodeId: string }>>([]);
  const [previewOverlay, setPreviewOverlay] = createSignal<{ pageId: string; nodeId: string }>();
  const [previewTransition, setPreviewTransition] = createSignal<UIInteraction["transition"]>("instant");
  const [message, setMessage] = createSignal("");
  const [snapGuides, setSnapGuides] = createSignal<{ x?: UISnapGuide; y?: UISnapGuide }>({});
  const [findOpen, setFindOpen] = createSignal(false);
  const [findQuery, setFindQuery] = createSignal("");
  const [replaceQuery, setReplaceQuery] = createSignal("");
  const [showLint, setShowLint] = createSignal(false);
  let stage: HTMLDivElement | undefined;
  let activeGesture: Gesture | undefined;
  let spaceHeld = false;
  let imageInput: HTMLInputElement | undefined;
  let tokenInput: HTMLInputElement | undefined;

  const document = () => props.session.document();
  const page = () => document().pages.find(item => item.id === document().activePageId) ?? document().pages[0];
  const hierarchy = createMemo(() => new UIHierarchyIndex<UIElement>(page().id, page().elements));
  const pageRoots = () => hierarchy().children(page().id);
  const selected = () => selectedIds().map(id => hierarchy().get(id)).filter((node): node is UIElement => !!node);
  const selectedOne = () => selected().length === 1 ? selected()[0] : undefined;
  const matchingAssets = () => assets.filter(asset => !assetSearch().trim() || asset.name.toLowerCase().includes(assetSearch().trim().toLowerCase()));
  const matchingComponents = () => document().components.filter(component => !assetSearch().trim() || component.name.toLowerCase().includes(assetSearch().trim().toLowerCase()));
  const assetCategories = () => ["Basics", "Controls", "Forms", "Navigation", "Patterns", "Data"].filter(category => matchingAssets().some(asset => asset.category === category));
  const zoomLabel = () => `${round(camera().zoom * 100)}%`;
  const rootsOnly = (ids: string[]) => ids.filter(id => !hierarchy().hasSelectedAncestor(id, new Set(ids)));
  const isEffectively = (node: UIElement, key: "hidden" | "locked") => node[key] || hierarchy().ancestors(node.id).some(parent => parent[key]);
  const displayNodes = () => hierarchy().flatten().filter(node => !isEffectively(node, "hidden"));
  const topVisible = () => pageRoots().filter(node => !isEffectively(node, "hidden"));
  const worldBounds = (node: UIElement) => hierarchy().worldBounds(node.id);
  const cameraWorld = (event: PointerEvent | WheelEvent) => { const rect = stage?.getBoundingClientRect(); return rect ? { x: (event.clientX - rect.left - camera().x) / camera().zoom, y: (event.clientY - rect.top - camera().y) / camera().zoom } : { x: 0, y: 0 }; };
  const viewportCenterWorld = () => { const rect = stage?.getBoundingClientRect(); return rect ? { x: (stage!.clientWidth / 2 - camera().x) / camera().zoom, y: (stage!.clientHeight / 2 - camera().y) / camera().zoom } : { x: 0, y: 0 }; };
  const addMessage = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(""), 2600); };
  const updateDocument = (mutate: (current: UIDesignDocument) => UIDesignDocument, key?: string) => props.session.update(mutate(document()), key);
  const updatePage = (mutate: (current: UIPage) => UIPage, key?: string) => updateDocument(doc => ({ ...doc, pages: doc.pages.map(item => item.id === page().id ? mutate(item) : item) }), key);
  const updateNodes = (mutate: (nodes: UIElement[]) => UIElement[], key?: string, layout = true) => updatePage(current => {
    const next = mutate(current.elements);
    return layout ? applyAutoLayout({ ...current, elements: next }) : { ...current, elements: next };
  }, key);
  const updateNode = (id: string, patch: Partial<UIElement>, key?: string) => updateNodes(nodes => {
    const target = nodes.find(node => node.id === id); if (!target) return nodes;
    let next = nodes.map(node => node.id === id ? { ...node, ...patch } : node);
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
  };
  const startPan = (event: PointerEvent) => {
    const value: Gesture = { kind: "pan", pointer: event.pointerId, clientX: event.clientX, clientY: event.clientY, camera: camera() };
    activeGesture = value; setGesture(value); stage?.setPointerCapture(event.pointerId);
  };
  const startMove = (event: PointerEvent, node: UIElement) => {
    if (connectSource()) {
      if (node.kind === "frame" && node.id !== connectSource()) {
        const source = hierarchy().get(connectSource());
        if (source) updateNode(source.id, { interactions: [...source.interactions, { id: createUIDesignId("interaction"), name: "Navigate to screen", trigger: "click", action: "navigate", targetNodeId: node.id, transition: "instant" }] });
        addMessage(`Linked ${source?.name ?? "element"} to ${node.name}`); setConnectSource(""); setSelectedIds([node.id]);
      }
      return;
    }
    if (isEffectively(node, "locked")) return;
    if (!selectedIds().includes(node.id)) setSelectedIds(event.shiftKey ? [...selectedIds(), node.id] : [node.id]);
    const ids = rootsOnly(selectedIds().includes(node.id) ? selectedIds() : event.shiftKey ? [...selectedIds(), node.id] : [node.id]);
    const originals = ids.map(id => hierarchy().get(id)).filter((item): item is UIElement => !!item && !isEffectively(item, "locked"));
    const value: Gesture = { kind: "move", pointer: event.pointerId, start: cameraWorld(event), ids: originals.map(item => item.id), originals };
    activeGesture = value; setGesture(value); stage?.setPointerCapture(event.pointerId);
  };
  const startResize = (event: PointerEvent, node: UIElement, handle: string) => {
    if (isEffectively(node, "locked")) return;
    const value: Gesture = { kind: "resize", pointer: event.pointerId, start: cameraWorld(event), id: node.id, original: node, handle };
    activeGesture = value; setGesture(value); stage?.setPointerCapture(event.pointerId);
  };
  const startPoint = (event: PointerEvent, node: UIElement, point: number) => {
    if (isEffectively(node, "locked")) return;
    const value: Gesture = { kind: "point", pointer: event.pointerId, id: node.id, point };
    activeGesture = value; setGesture(value); stage?.setPointerCapture(event.pointerId);
  };
  const createAt = (kind: Tool, point: { x: number; y: number }, size?: { width: number; height: number }, parentId = page().id) => {
    if (kind === "select" || kind === "hand" || kind === "measure") return;
    const index = new UIHierarchyIndex<UIElement>(page().id, page().elements);
    const parent = parentId === page().id ? undefined : index.get(parentId);
    const local = parent ? index.worldToLocal(parentId, point) ?? point : point;
    const order = index.children(parentId).reduce((max, node) => Math.max(max, node.order), -1) + 1;
    const node = createUIElement(kind, order, local, parentId, size);
    if (kind === "frame") { node.frameType = "container"; node.framePreset = "custom"; }
    if (kind === "path") node.pathPoints = [{ x: 0, y: 0.5 }, { x: 0.3, y: 0.1 }, { x: 0.72, y: 0.25 }, { x: 1, y: 0.5 }, { x: 0.72, y: 0.75 }, { x: 0.3, y: 0.9 }];
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
    if (tool() === "measure") { const value: Gesture = { kind: "measure", pointer: event.pointerId, start: point, current: point }; activeGesture = value; setGesture(value); stage?.setPointerCapture(event.pointerId); return; }
    if (tool() !== "select") { const value: Gesture = { kind: "draw", pointer: event.pointerId, tool: tool(), parentId: selectedOne()?.kind === "frame" ? selectedOne()!.id : page().id, start: point, current: point }; activeGesture = value; setGesture(value); stage?.setPointerCapture(event.pointerId); return; }
    const movingFrames = rootsOnly(selectedIds()).map(id => hierarchy().get(id)).filter((node): node is UIElement => !!node && node.kind === "frame");
    if (movingFrames.length && movingFrames.length === rootsOnly(selectedIds()).length) { startMove(event, movingFrames[0]); return; }
    const additive = selectedIds(); const value: Gesture = { kind: "marquee", pointer: event.pointerId, start: point, current: point, additive: event.shiftKey ? additive : [] }; activeGesture = value; setGesture(value); if (!event.shiftKey) setSelectedIds([]); stage?.setPointerCapture(event.pointerId);
  };
  const handleStageMove = (event: PointerEvent) => {
    const active = activeGesture; if (!active || active.pointer !== event.pointerId) return;
    const point = cameraWorld(event);
    if (active.kind === "pan") setCamera({ ...active.camera, x: active.camera.x + event.clientX - active.clientX, y: active.camera.y + event.clientY - active.clientY });
    else if (active.kind === "marquee" || active.kind === "draw" || active.kind === "measure") { const next = { ...active, current: point } as Gesture; activeGesture = next; setGesture(next); }
    else if (active.kind === "move") {
      const dx = point.x - active.start.x, dy = point.y - active.start.y;
      let snappedX = dx, snappedY = dy;
      if (active.originals.length) {
        const boxes = active.originals.map(node => worldBounds(node)).filter((box): box is UIRect => !!box); const box = unionRects(boxes);
        if (box) {
          const moved = { ...active.originals[0], x: box.x, y: box.y, width: box.width, height: box.height };
          const selectedSet = new Set(active.ids);
          const peers = displayNodes().filter(item => !selectedSet.has(item.id) && !hierarchy().hasSelectedAncestor(item.id, selectedSet)).flatMap(item => { const bounds = worldBounds(item); return bounds ? [{ ...item, ...bounds }] : []; });
          const snap = snapPosition(page().grid, moved, box.x + dx, box.y + dy, peers, camera().zoom);
          snappedX = snap.x - box.x; snappedY = snap.y - box.y;
          setSnapGuides({ x: snap.guideX, y: snap.guideY });
        }
      }
      updateNodes(nodes => nodes.map(node => {
        const original = active.originals.find(item => item.id === node.id); if (!original) return node;
        const parentTransform = original.parentId === page().id ? { rotation: 0 } : hierarchy().worldTransform(original.parentId) ?? { rotation: 0 };
        const rad = -parentTransform.rotation * Math.PI / 180;
        const localX = snappedX * Math.cos(rad) - snappedY * Math.sin(rad); const localY = snappedX * Math.sin(rad) + snappedY * Math.cos(rad);
        return { ...original, x: round(original.x + localX), y: round(original.y + localY) };
      }), "move", false);
    } else if (active.kind === "resize") {
      const original = active.original; const parent = original.parentId === page().id ? undefined : hierarchy().worldTransform(original.parentId);
      const radians = -(parent?.rotation ?? 0) * Math.PI / 180; const dx = point.x - active.start.x; const dy = point.y - active.start.y;
      const localDx = dx * Math.cos(radians) - dy * Math.sin(radians); const localDy = dx * Math.sin(radians) + dy * Math.cos(radians);
      const next = resizeElement(original, active.handle, localDx, localDy);
      updateNode(original.id, next, `resize:${original.id}`);
    } else if (active.kind === "point") {
      const node = hierarchy().get(active.id); if (!node) return; const local = hierarchy().worldToLocal(node.parentId, point); if (!local) return;
      const world = hierarchy().worldTransform(node.id); const dx = local.x - node.x; const dy = local.y - node.y; const radians = -(world?.rotation ?? 0) * Math.PI / 180;
      const nodeLocalX = (dx * Math.cos(radians) - dy * Math.sin(radians)) / node.width; const nodeLocalY = (dx * Math.sin(radians) + dy * Math.cos(radians)) / node.height;
      const points = node.pathPoints.map((item, index) => index === active.point ? { ...item, x: clamp(nodeLocalX, 0, 1), y: clamp(nodeLocalY, 0, 1) } : item);
      updateNode(node.id, { pathPoints: points }, `point:${node.id}:${active.point}`);
    }
  };
  const finishGesture = (event: PointerEvent) => {
    const active = activeGesture; if (!active || active.pointer !== event.pointerId) return;
    const point = cameraWorld(event);
    if (active.kind === "draw") {
      const rect = normalizeRect(active.start, point); const minSizes: Record<string, { width: number; height: number }> = { button: { width: 132, height: 44 }, input: { width: 240, height: 44 }, checkbox: { width: 140, height: 28 }, text: { width: 180, height: 32 }, ellipse: { width: 80, height: 80 }, line: { width: 120, height: 2 }, frame: { width: 390, height: 844 }, path: { width: 120, height: 80 }, rectangle: { width: 120, height: 80 }, image: { width: 160, height: 120 } };
      const min = minSizes[active.tool] ?? { width: 1, height: 1 };
      const size = { width: Math.max(min.width, round(rect.width)), height: Math.max(min.height, round(rect.height)) };
      const node = createAt(active.tool, rect.width || rect.height ? { x: round(rect.x), y: round(rect.y) } : active.start, size, active.parentId);
      if (node && active.tool === "image") imageInput?.click();
    } else if (active.kind === "marquee") {
      const rect = normalizeRect(active.start, point);
      if (rect.width > 2 || rect.height > 2) {
        const hits = displayNodes().filter(node => !isEffectively(node, "locked") && !hierarchy().hasSelectedAncestor(node.id, new Set(active.additive))).filter(node => { const box = worldBounds(node); return !!box && box.x <= rect.x + rect.width && box.x + box.width >= rect.x && box.y <= rect.y + rect.height && box.y + box.height >= rect.y; }).map(node => node.id);
        setSelectedIds([...new Set([...active.additive, ...hits])]);
      }
    }
    activeGesture = undefined; setGesture(undefined); setSnapGuides({});
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
    for (const root of roots) for (const node of [hierarchy().get(root)!, ...hierarchy().descendants(root)]) cloneIds.set(node.id, createUIDesignId(node.kind));
    for (const root of roots) for (const node of [hierarchy().get(root)!, ...hierarchy().descendants(root)]) copies.push({ ...structuredClone(node), id: cloneIds.get(node.id)!, parentId: cloneIds.get(node.parentId) ?? node.parentId, x: node.x + 16, y: node.y + 16, order: node.order + 1, name: `${node.name} copy`, interactions: node.interactions.map(link => ({ ...link, id: createUIDesignId("interaction") })) });
    updateNodes(nodes => [...nodes.map(node => roots.includes(node.id) ? { ...node, order: node.order + 1 } : node), ...copies]); setSelectedIds(roots.map(id => cloneIds.get(id)!));
  };
  const groupSelection = () => {
    const ids = rootsOnly(selectedIds()); if (ids.length < 2) return;
    const nodes = ids.map(id => hierarchy().get(id)!).filter(Boolean); const parentId = nodes.every(node => node.parentId === nodes[0].parentId) ? nodes[0].parentId : page().id;
    const boxes = nodes.map(node => worldBounds(node)).filter((box): box is UIRect => !!box); const bounds = unionRects(boxes); if (!bounds) return;
    const local = parentId === page().id ? bounds : hierarchy().worldToLocal(parentId, { x: bounds.x, y: bounds.y }) ?? bounds;
    const group = createUIElement("group", hierarchy().children(parentId).length, local, parentId, { width: round(bounds.width), height: round(bounds.height) }); group.name = "Group";
    const nextNodes = [...page().elements, group]; const baseIndex = new UIHierarchyIndex<UIElement>(page().id, nextNodes);
    const transformed = nodes.map(node => { const updated = baseIndex.reparent(node.id, group.id); if (!updated) return node; const world = baseIndex.worldTransform(node.id); const parent = baseIndex.worldTransform(group.id); return { ...updated, x: round(updated.x), y: round(updated.y), rotation: world && parent ? world.rotation - parent.rotation : node.rotation }; });
    updateNodes(items => [...items.filter(item => !ids.includes(item.id)), group, ...items.filter(item => !ids.includes(item.id)).map(item => transformed.find(node => node.id === item.id) ?? item), ...transformed]); setSelectedIds([group.id]);
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
  const toggleCollapsed = (id: string) => setCollapsed(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleAssetCategory = (id: string) => setAssetCollapsed(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const moveLayer = (draggedIds: string[], targetId: string, into: boolean) => {
    const source = [...new Set(draggedIds)].filter(id => !hierarchy().hasSelectedAncestor(id, new Set(draggedIds)));
    const target = hierarchy().get(targetId); if (!target || source.includes(targetId)) return;
    const parentId = into && ["frame", "group", "componentInstance"].includes(target.kind) ? target.id : target.parentId;
    const index = new UIHierarchyIndex<UIElement>(page().id, page().elements);
    let next = [...page().elements]; let order = index.children(parentId).reduce((max, node) => Math.max(max, node.order), -1) + 1;
    for (const id of source) { const moved = index.reparent(id, parentId); if (!moved) continue; next = next.map(node => node.id === id ? { ...moved, order: order++ } : node); }
    updateNodes(() => next, undefined, false);
  };
  const addAsset = (asset: Asset) => {
    const center = viewportCenterWorld();
    const group = createUIElement("group", hierarchy().children(page().id).length, { x: round(center.x - asset.width / 2), y: round(center.y - asset.height / 2) }, page().id, { width: asset.width, height: asset.height }); group.name = asset.name;
    const children = asset.parts.map((part, order) => { const child = createUIElement(part.kind, order, { x: part.x, y: part.y }, group.id, { width: part.width, height: part.height }); child.name = part.name ?? kindName(part.kind); child.text = part.text ?? ""; if (part.fill) child.fill = part.fill; if (part.radius !== undefined) child.radius = part.radius; return child; });
    updateNodes(nodes => [...nodes, group, ...children], undefined, false); setSelectedIds([group.id]); setLeftTab("layers");
  };
  const createComponent = () => {
    const node = selectedOne(); if (!node) return;
    const subtree = [node, ...hierarchy().descendants(node.id)]; const componentId = createUIDesignId("component");
    const rootId = `${componentId}-root`;
    const childIds = new Map(subtree.slice(1).map(child => [child.id, `${componentId}-${child.id}`]));
    const root = { ...structuredClone(node), id: rootId, parentId: "component-root", order: 0, componentId };
    const children = subtree.slice(1).map(child => ({ ...structuredClone(child), id: childIds.get(child.id)!, parentId: child.parentId === node.id ? rootId : childIds.get(child.parentId) ?? rootId, order: child.order }));
    const variants: UIComponentVariant[] = [{ id: createUIDesignId("variant"), name: "Default", properties: {} }, { id: createUIDesignId("variant"), name: "Compact", properties: { width: Math.max(80, round(node.width * 0.8)) } }];
    const component = { id: componentId, name: node.name || "Component", root, children, variants };
    updateDocument(doc => ({ ...doc, components: [...doc.components, component] })); updateNode(node.id, { componentId }); addMessage("Component created in Assets"); setLeftTab("assets");
  };
  const componentChildren = (component: UIDesignDocument["components"][number], instanceId: string) => {
    const ids = new Map(component.children.map(child => [child.id, createUIDesignId(child.kind)]));
    return component.children.map(child => ({ ...structuredClone(child), id: ids.get(child.id)!, parentId: child.parentId === component.root.id ? instanceId : ids.get(child.parentId) ?? instanceId }));
  };
  const insertComponent = (id: string) => {
    const component = document().components.find(item => item.id === id); if (!component) return;
    const center = viewportCenterWorld();
    const instance = { ...structuredClone(component.root), id: createUIDesignId("component"), kind: "componentInstance" as const, parentId: page().id, order: hierarchy().children(page().id).length, x: round(center.x - component.root.width / 2), y: round(center.y - component.root.height / 2), name: `${component.name} instance`, componentId: id, componentVariantId: component.variants[0]?.id ?? "", interactions: [] };
    const children = componentChildren(component, instance.id);
    updateNodes(nodes => [...nodes, instance, ...children], undefined, false); setSelectedIds([instance.id]); setLeftTab("layers");
  };
  const applyVariant = (node: UIElement, variantId: string) => {
    const component = document().components.find(item => item.id === node.componentId); const variant = component?.variants.find(item => item.id === variantId); if (!variant) return;
    const patch: Partial<UIElement> = {};
    for (const [key, value] of Object.entries(variant.properties)) if (["width", "height", "fill", "stroke", "radius", "text"].includes(key)) (patch as Record<string, unknown>)[key] = value;
    updateNode(node.id, { ...patch, componentVariantId: variantId, overrides: { ...variant.properties } });
  };
  const detachComponent = (node: UIElement) => updateNode(node.id, { kind: "group", componentId: "", componentVariantId: "", overrides: {} });
  const resetComponent = (node: UIElement) => {
    const component = document().components.find(item => item.id === node.componentId); if (!component) return;
    const reset = { ...node };
    for (const key of ["width", "height", "fill", "stroke", "strokeWidth", "strokeStyle", "radius", "opacity", "shadow", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textAlign", "text", "pathPoints", "clipContent", "autoLayout"] as const) (reset as unknown as Record<string, unknown>)[key] = structuredClone(component.root[key]);
    reset.overrides = {}; reset.componentVariantId = component.variants[0]?.id ?? "";
    const descendants = new Set(hierarchy().descendants(node.id).map(child => child.id));
    updateNodes(nodes => [...nodes.filter(child => !descendants.has(child.id)), reset, ...componentChildren(component, node.id)], undefined, false);
  };

  const exportSVG = () => {
    const roots = rootsOnly(selected().map(node => node.id)).map(id => hierarchy().get(id)!).filter(Boolean); const nodes = roots.length ? roots : topVisible(); if (!nodes.length) return;
    const all = nodes.flatMap(node => [node, ...hierarchy().descendants(node.id)]);
    const bounds = unionRects(all.map(node => worldBounds(node)).filter((box): box is UIRect => !!box)); if (!bounds) return;
    const renderNode = (node: UIElement, isPageRoot: boolean): string => {
      const id = `clip-${node.id.replace(/[^\w-]/g, "-")}`;
      const fill = escapeXml(node.fill); const stroke = node.stroke === "none" ? "none" : escapeXml(node.stroke);
      const dash = node.strokeStyle === "dashed" ? ` stroke-dasharray="${Math.max(2, node.strokeWidth * 4)} ${Math.max(2, node.strokeWidth * 3)}"` : node.strokeStyle === "dotted" ? ` stroke-dasharray="${Math.max(1, node.strokeWidth)} ${Math.max(2, node.strokeWidth * 2)}"` : "";
      const border = `stroke="${stroke}" stroke-width="${round(node.strokeWidth)}"${dash}`;
      let shape = "";
      if (node.kind === "frame") {
        if (isPageRoot && node.frameType === "screen") shape = `<rect width="${round(node.width)}" height="${round(node.height)}" rx="${round(node.radius)}" fill="${fill}" ${border}/>`;
      } else if (node.kind === "group" || node.kind === "componentInstance") {
        shape = "";
      } else if (node.kind === "ellipse") shape = `<ellipse cx="${round(node.width / 2)}" cy="${round(node.height / 2)}" rx="${round(node.width / 2)}" ry="${round(node.height / 2)}" fill="${fill}" ${border}/>`;
      else if (node.kind === "line") shape = `<line x1="0" y1="${round(node.height / 2)}" x2="${round(node.width)}" y2="${round(node.height / 2)}" ${border}/>`;
      else if (node.kind === "path") shape = `<polygon points="${node.pathPoints.map(point => `${point.x * node.width},${point.y * node.height}`).join(" ")}" fill="${fill}" ${border}/>`;
      else if (node.kind === "image") shape = node.imageData.startsWith("data:image/") ? `<image href="${escapeXml(node.imageData)}" width="${round(node.width)}" height="${round(node.height)}" preserveAspectRatio="${node.imageFit === "fill" ? "none" : node.imageFit === "contain" ? "xMidYMid meet" : "xMidYMid slice"}"/>` : `<rect width="${round(node.width)}" height="${round(node.height)}" rx="${round(node.radius)}" fill="${fill}" ${border}/>`;
      else {
        if (["rectangle", "button", "input", "checkbox"].includes(node.kind)) shape = `<rect width="${round(node.width)}" height="${round(node.height)}" rx="${round(node.radius)}" fill="${fill}" ${border}/>`;
        if (node.kind === "checkbox") shape += `<rect x="8" y="${Math.max(4, (node.height - 16) / 2)}" width="16" height="16" rx="3" fill="none" stroke="${stroke}"/>`;
        if (node.text) shape += `<text x="${node.kind === "checkbox" ? 32 : node.kind === "button" ? node.width / 2 : 12}" y="${node.height / 2}" dominant-baseline="middle" text-anchor="${node.kind === "button" ? "middle" : "start"}" fill="${fill}" font-family="${node.fontFamily}" font-size="${round(node.fontSize)}" font-weight="${round(node.fontWeight)}">${escapeXml(node.text)}</text>`;
        if (node.kind === "text") shape = `<text x="0" y="${round(node.fontSize)}" fill="${fill}" font-family="${node.fontFamily}" font-size="${round(node.fontSize)}" font-weight="${round(node.fontWeight)}">${escapeXml(node.text)}</text>`;
      }
      const children = hierarchy().children(node.id); const clips = node.kind === "frame" && node.clipContent || node.autoLayout.enabled && node.autoLayout.clip;
      const childMarkup = children.map(child => renderNode(child, false)).join("");
      const content = clips ? `<defs><clipPath id="${id}"><rect width="${round(node.width)}" height="${round(node.height)}"/></clipPath></defs><g clip-path="url(#${id})">${childMarkup}</g>` : childMarkup;
      return `<g transform="translate(${round(node.x)} ${round(node.y)}) rotate(${round(node.rotation)})" opacity="${node.opacity}">${shape}${content}</g>`;
    };
    downloadText(`${document().name.replace(/[^\w-]+/g, "-")}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(bounds.width)}" height="${Math.ceil(bounds.height)}" viewBox="${Math.floor(bounds.x)} ${Math.floor(bounds.y)} ${Math.ceil(bounds.width)} ${Math.ceil(bounds.height)}">${nodes.map(node => renderNode(node, node.parentId === page().id)).join("")}</svg>`, "image/svg+xml");
  };
  const importSvg = (source: string) => {
    if (source.length > 2_000_000) { addMessage("SVG exceeds the 2 MB import limit"); return; }
    const parsed = new DOMParser().parseFromString(source, "image/svg+xml"); const root = parsed.documentElement;
    if (root.localName !== "svg" || parsed.querySelector("parsererror,script,foreignObject,iframe,object,embed")) { addMessage("This SVG is invalid or contains unsupported embedded content"); return; }
    const box = root.getAttribute("viewBox")?.split(/[ ,]+/).map(Number); const width = round(Number(root.getAttribute("width")) || box?.[2] || 240); const height = round(Number(root.getAttribute("height")) || box?.[3] || 160);
    const container = createUIElement("group", hierarchy().children(page().id).length, { x: 0, y: 0 }, page().id, { width, height }); container.name = "Imported SVG";
    const inserted: UIElement[] = [container]; const center = viewportCenterWorld(); container.x = round(center.x - width / 2); container.y = round(center.y - height / 2);
    const safePaint = (value: string | null) => value && (/^#[\da-f]{3,8}$/i.test(value) || ["none", "black", "white", "red", "blue", "green", "transparent"].includes(value.toLowerCase())) ? value : "#dce5f2";
    const children = Array.from(root.querySelectorAll("rect,circle,ellipse,line,polygon,polyline"));
    for (const [order, shape] of children.entries()) {
      const tag = shape.localName; let kind: UIElementKind = tag === "circle" || tag === "ellipse" ? "ellipse" : tag === "line" ? "line" : tag === "polygon" || tag === "polyline" ? "path" : "rectangle";
      const x = Number(shape.getAttribute(tag === "circle" ? "cx" : tag === "ellipse" ? "cx" : tag === "line" ? "x1" : "x")) || 0; const y = Number(shape.getAttribute(tag === "circle" ? "cy" : tag === "ellipse" ? "cy" : tag === "line" ? "y1" : "y")) || 0;
      const w = Math.max(1, Number(shape.getAttribute(tag === "circle" ? "r" : tag === "ellipse" ? "rx" : tag === "line" ? "x2" : "width")) || 80) * (tag === "circle" ? 2 : 1); const h = Math.max(1, Number(shape.getAttribute(tag === "circle" ? "r" : tag === "ellipse" ? "ry" : tag === "line" ? "y2" : "height")) || 60) * (tag === "circle" ? 2 : 1);
      const child = createUIElement(kind, order, { x: round(x - (tag === "circle" || tag === "ellipse" ? w / 2 : 0)), y: round(y - (tag === "circle" || tag === "ellipse" ? h / 2 : 0)) }, container.id, { width: round(w), height: round(h) }); child.fill = safePaint(shape.getAttribute("fill")); child.stroke = safePaint(shape.getAttribute("stroke")); child.name = tag[0].toUpperCase() + tag.slice(1);
      if (kind === "path") { const points = (shape.getAttribute("points") ?? "").trim().split(/[\s,]+/).map(Number); child.pathPoints = []; for (let i = 0; i + 1 < points.length; i += 2) child.pathPoints.push({ x: clamp(points[i] / width, 0, 1), y: clamp(points[i + 1] / height, 0, 1) }); }
      inserted.push(child);
    }
    updateNodes(nodes => [...nodes, ...inserted], undefined, false); setSelectedIds([container.id]);
  };
  const readImage = async (file?: File) => {
    if (!file) return;
    if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) { importSvg(await file.text()); return; }
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) { addMessage("Choose a supported image up to 8 MB"); return; }
    const reader = new FileReader(); reader.onload = () => {
      const current = selectedOne()?.kind === "image" ? selectedOne() : undefined;
      const parentId = selectedOne()?.kind === "frame" ? selectedOne()!.id : page().id;
      const node = current ?? createAt("image", viewportCenterWorld(), undefined, parentId);
      if (node) updateNode(node.id, { kind: "image", imageData: String(reader.result), text: file.name.replace(/\.[^.]+$/, "") });
    }; reader.readAsDataURL(file);
  };
  const startPrototype = () => {
    const flow = page().prototypeFlows.find(item => item.id === page().activePrototypeFlowId) ?? page().prototypeFlows[0];
    const startPageId = flow?.startPageId ?? page().id;
    const startPage = document().pages.find(item => item.id === startPageId) ?? page();
    const startNode = flow?.startNodeId ?? startPage.elements.find(item => item.kind === "frame" && item.parentId === startPage.id)?.id ?? startPage.elements.find(item => item.parentId === startPage.id)?.id ?? "";
    setPreviewPageId(startPage.id); setPreviewNodeId(startNode); setPreviewHistory([]); setPreviewOverlay(undefined); setPreview(true);
  };
  const runInteraction = (interaction: UIInteraction) => {
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
    const destinationNode = requested ? [requested, ...destinationHierarchy.ancestors(requested.id).reverse()].find(node => node.kind === "frame" && node.frameType === "screen") ?? requested : destination.elements.find(node => node.kind === "frame" && node.parentId === destination.id) ?? destination.elements.find(node => node.parentId === destination.id);
    const targetNodeId = destinationNode?.id ?? "";
    setPreviewHistory(items => [...items, { pageId: previewPageId(), nodeId: previewNodeId() }]); setPreviewTransition(interaction.transition);
    if (interaction.action === "open-overlay") setPreviewOverlay({ pageId: destination.id, nodeId: targetNodeId });
    else { setPreviewPageId(destination.id); setPreviewNodeId(targetNodeId); setPreviewOverlay(undefined); }
  };
  const addInteraction = (node: UIElement) => updateNode(node.id, { interactions: [...node.interactions, { id: createUIDesignId("interaction"), name: "Navigate", trigger: "click", action: "navigate", transition: "instant" }] });
  const renamePage = (item: UIPage) => { const value = window.prompt("Page name", item.name); if (value?.trim()) updateDocument(doc => ({ ...doc, pages: doc.pages.map(pageItem => pageItem.id === item.id ? { ...pageItem, name: value.trim().slice(0, 120) } : pageItem) })); };
  const addPage = () => { const next: UIPage = { id: createUIDesignId("page"), name: `Page ${document().pages.length + 1}`, background: page().background, elements: [], grid: { ...page().grid }, prototypeFlows: [], activePrototypeFlowId: "" }; updateDocument(doc => ({ ...doc, pages: [...doc.pages, next], activePageId: next.id })); setSelectedIds([]); };
  const duplicatePage = (item: UIPage) => { const copy = structuredClone(item); copy.id = createUIDesignId("page"); copy.name = `${item.name} copy`; const ids = new Map(copy.elements.map(node => [node.id, createUIDesignId(node.kind)])); for (const node of copy.elements) { node.id = ids.get(node.id)!; node.parentId = ids.get(node.parentId) ?? copy.id; node.interactions = node.interactions.map(link => ({ ...link, id: createUIDesignId("interaction") })); } copy.prototypeFlows = copy.prototypeFlows.map(flow => ({ ...flow, id: createUIDesignId("flow"), startPageId: copy.id, startNodeId: ids.get(flow.startNodeId ?? "") })); updateDocument(doc => ({ ...doc, pages: [...doc.pages, copy], activePageId: copy.id })); };
  const deletePage = (item: UIPage) => { if (document().pages.length <= 1) return; if (!window.confirm(`Delete “${item.name}” and its contents?`)) return; updateDocument(doc => { const pages = doc.pages.filter(candidate => candidate.id !== item.id); return { ...doc, pages, activePageId: doc.activePageId === item.id ? pages[0].id : doc.activePageId, components: doc.components }; }); setSelectedIds([]); };
  const addToken = (type: "color" | "type" | "spacing" | "radius" | "effect") => {
    if (type === "color") updateDocument(doc => ({ ...doc, colorTokens: [...doc.colorTokens, { id: createUIDesignId("color"), name: `Color ${doc.colorTokens.length + 1}`, value: "#365fe5" }] }));
    else if (type === "type") updateDocument(doc => ({ ...doc, typographyTokens: [...doc.typographyTokens, { id: createUIDesignId("type"), name: `Text style ${doc.typographyTokens.length + 1}`, fontFamily: "system", fontSize: 16, fontWeight: 400, lineHeight: 1.4, letterSpacing: 0 }] }));
    else if (type === "spacing") updateDocument(doc => ({ ...doc, spacingTokens: [...doc.spacingTokens, { id: createUIDesignId("space"), name: `Space ${doc.spacingTokens.length + 1}`, value: 8, unit: "px" }] }));
    else if (type === "radius") updateDocument(doc => ({ ...doc, radiusTokens: [...doc.radiusTokens, { id: createUIDesignId("radius"), name: `Radius ${doc.radiusTokens.length + 1}`, value: 8, unit: "px" }] }));
    else updateDocument(doc => ({ ...doc, effectTokens: [...doc.effectTokens, { id: createUIDesignId("effect"), name: `Effect ${doc.effectTokens.length + 1}`, value: "0 4px 14px #26354d24" }] }));
  };
  const exportTokens = () => downloadText(`${document().name.replace(/[^\w-]+/g, "-")}-tokens.json`, JSON.stringify({ colorModes: document().colorModes, colors: document().colorTokens, typography: document().typographyTokens, spacing: document().spacingTokens, radius: document().radiusTokens, effects: document().effectTokens }, null, 2), "application/json");
  const importTokens = async (file?: File) => { if (!file || file.size > 1_000_000) return; try { const value = JSON.parse(await file.text()) as Record<string, unknown>; updateDocument(doc => ({ ...doc, colorTokens: Array.isArray(value.colors) ? value.colors as UIDesignDocument["colorTokens"] : doc.colorTokens, typographyTokens: Array.isArray(value.typography) ? value.typography as UIDesignDocument["typographyTokens"] : doc.typographyTokens, spacingTokens: Array.isArray(value.spacing) ? value.spacing as UIDesignDocument["spacingTokens"] : doc.spacingTokens, radiusTokens: Array.isArray(value.radius) ? value.radius as UIDesignDocument["radiusTokens"] : doc.radiusTokens, effectTokens: Array.isArray(value.effects) ? value.effects as UIDesignDocument["effectTokens"] : doc.effectTokens, colorModes: Array.isArray(value.colorModes) ? value.colorModes as UIDesignDocument["colorModes"] : doc.colorModes })); addMessage("Design tokens imported"); } catch { addMessage("Token file must be valid JSON"); } };
  const replaceText = () => {
    const query = findQuery(); if (!query) return;
    updateNodes(nodes => nodes.map(node => node.text.includes(query) ? { ...node, text: node.text.split(query).join(replaceQuery()) } : node)); setFindOpen(false);
  };
  const lintResults = createMemo(() => {
    const findings: Array<{ id: string; severity: "warning" | "info"; text: string; node?: UIElement }> = [];
    for (const node of displayNodes()) {
      if (["button", "input", "checkbox"].includes(node.kind) && (node.width < 44 || node.height < 32)) findings.push({ id: `${node.id}-touch`, severity: "warning", text: `${node.name}: small interactive target`, node });
      if (node.kind === "text" && node.fontSize < 11) findings.push({ id: `${node.id}-font`, severity: "warning", text: `${node.name}: text is smaller than 11 px`, node });
      if (node.fillTokenId && !document().colorTokens.some(token => token.id === node.fillTokenId)) findings.push({ id: `${node.id}-token`, severity: "warning", text: `${node.name}: missing color token reference`, node });
    }
    return findings;
  });
  const gestureRect = createMemo(() => {
    const active = gesture();
    return active?.kind === "draw" || active?.kind === "marquee" ? normalizeRect(active.start, active.current) : undefined;
  });
  const measureGesture = createMemo(() => {
    const active = gesture();
    return active?.kind === "measure" ? active : undefined;
  });
  const spacingMeasurements = createMemo(() => {
    if (selected().length !== 1) return [];
    const selectedNode = selectedOne()!; const box = worldBounds(selectedNode); if (!box) return [];
    const peers = displayNodes().filter(node => node.id !== selectedNode.id && !hierarchy().hasSelectedAncestor(node.id, new Set([selectedNode.id]))).map(node => worldBounds(node)).filter((rect): rect is UIRect => !!rect);
    return measureNeighborGaps(box, peers);
  });
  const equalSpacing = createMemo(() => { const node = selectedOne(); const box = node && worldBounds(node); if (!box) return undefined; const peers = displayNodes().filter(item => item.id !== node.id && !hierarchy().hasSelectedAncestor(item.id, new Set([node.id]))).map(item => worldBounds(item)).filter((rect): rect is UIRect => !!rect); return equalSpacingAround(box, peers); });
  const sceneExtent = createMemo(() => unionRects(topVisible().map(node => worldBounds(node)).filter((box): box is UIRect => !!box)) ?? { x: -1600, y: -1200, width: 3200, height: 2400 });
  const layerMatches = (node: UIElement, query: string): boolean => !query || `${node.name} ${node.kind}`.toLowerCase().includes(query) || hierarchy().children(node.id).some(child => layerMatches(child, query));
  const componentRoot = (node: UIElement) => node.kind === "componentInstance" ? document().components.find(item => item.id === node.componentId)?.root : undefined;
  const renderChildren = (parentId: string, interactive = false): JSX.Element => <For each={hierarchy().children(parentId).filter(node => !isEffectively(node, "hidden"))}>{node => { const master = componentRoot(node); return <NodeView node={node} parentIsPage={parentId === page().id} selected={selectedIds().includes(node.id) && !isEffectively(node, "locked")} editing={editingId() === node.id} interactive={interactive} visualKind={master?.kind} fillOverride={node.fillTokenId ? resolveColorToken(document().colorTokens, node.fillTokenId, document().activeColorModeId, node.fill) : undefined} renderChildren={childId => renderChildren(childId, interactive)} onDown={startMove} onResize={startResize} onDouble={item => { if (["text", "button", "input", "checkbox"].includes(item.kind)) setEditingId(item.id); else renameNode(item); }} onText={(item, text) => updateNode(item.id, { text }, `text:${item.id}`)} onInteraction={runInteraction} onPointDown={startPoint} />; }}</For>;
  const renderLayerTree = (parentId: string, depth: number): JSX.Element => <For each={hierarchy().children(parentId).filter(node => layerMatches(node, layerSearch().trim().toLowerCase()))}>{node => {
    const container = ["frame", "group", "componentInstance"].includes(node.kind);
    const hidden = isEffectively(node, "hidden"); const locked = isEffectively(node, "locked");
    return <>
      <div class={`ui-layer-row ${selectedIds().includes(node.id) ? "is-selected" : ""} ${hidden ? "is-muted" : ""}`} style={{ "--layer-depth": depth }} draggable onDragStart={event => { const ids = selectedIds().includes(node.id) ? selectedIds() : [node.id]; setDragIds(ids); event.dataTransfer?.setData("text/plain", ids.join(",")); if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"; }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); moveLayer(dragIds().length ? dragIds() : (event.dataTransfer?.getData("text/plain") ?? "").split(","), node.id, event.offsetX > 26); setDragIds([]); }}>
        <span class="ui-layer-indent" style={{ width: `${depth * 13}px` }} />
        {container ? <button class="ui-layer-caret" aria-label={`${collapsed().has(node.id) ? "Expand" : "Collapse"} ${node.name}`} aria-expanded={!collapsed().has(node.id)} onClick={event => { event.stopPropagation(); toggleCollapsed(node.id); }}>{collapsed().has(node.id) ? "›" : "⌄"}</button> : <span class="ui-layer-caret-placeholder" />}
        <button class="ui-layer-main" onClick={event => selectNode(node, event.shiftKey)} onDblClick={event => { event.stopPropagation(); renameNode(node); }} title={`${node.name} · double-click to rename`}>{node.kind === "frame" ? "▦" : node.kind === "text" ? "T" : node.kind === "image" ? "▧" : node.kind === "componentInstance" ? "◇" : node.kind === "group" ? "▱" : node.kind === "ellipse" ? "○" : node.kind === "path" ? "⌁" : "□"}<span class="ui-layer-name">{node.name}</span></button>
        <button class={`ui-layer-icon ${hidden ? "is-off" : ""}`} aria-label={`${hidden ? "Show" : "Hide"} ${node.name}`} aria-pressed={node.hidden} title={hidden && !node.hidden ? "Hidden by parent" : node.hidden ? "Show layer" : "Hide layer"} disabled={hidden && !node.hidden} onClick={() => updateNode(node.id, { hidden: !node.hidden })}>{hidden ? "◌" : "◉"}</button>
        <button class={`ui-layer-icon ${locked ? "is-on" : ""}`} aria-label={`${locked ? "Unlock" : "Lock"} ${node.name}`} aria-pressed={node.locked} title={locked && !node.locked ? "Locked by parent" : node.locked ? "Unlock layer" : "Lock layer"} disabled={locked && !node.locked} onClick={() => updateNode(node.id, { locked: !node.locked })}>{locked ? "▣" : "·"}</button>
      </div>
      <Show when={container && !collapsed().has(node.id)}>{renderLayerTree(node.id, depth + 1)}</Show>
    </>;
  }}</For>;
  const renderPreviewTree = (parentId: string, previewPage: UIPage, index = new UIHierarchyIndex<UIElement>(previewPage.id, previewPage.elements)): JSX.Element => <For each={index.children(parentId).filter(node => !node.hidden && !index.ancestors(node.id).some(parent => parent.hidden))}>{node => { const master = componentRoot(node); return <NodeView node={node} parentIsPage={parentId === previewPage.id} selected={false} editing={false} interactive visualKind={master?.kind} fillOverride={node.fillTokenId ? resolveColorToken(document().colorTokens, node.fillTokenId, document().activeColorModeId, node.fill) : undefined} renderChildren={childId => renderPreviewTree(childId, previewPage, index)} onDown={() => {}} onResize={() => {}} onDouble={() => {}} onText={(item, text) => updateNode(item.id, { text }, `preview-text:${item.id}`)} onInteraction={runInteraction} onPointDown={() => {}} />; }}</For>;
  const renderPreviewNode = (nodeId: string, previewPage: UIPage): JSX.Element => {
    const source = previewPage.elements.find(item => item.id === nodeId); if (!source) return <div />;
    const node = { ...source, parentId: previewPage.id, x: 0, y: 0, rotation: 0 };
    const master = componentRoot(node); const index = new UIHierarchyIndex<UIElement>(previewPage.id, previewPage.elements);
    return <NodeView node={node} root parentIsPage selected={false} editing={false} interactive visualKind={master?.kind} fillOverride={node.fillTokenId ? resolveColorToken(document().colorTokens, node.fillTokenId, document().activeColorModeId, node.fill) : undefined} renderChildren={childId => renderPreviewTree(childId, previewPage, index)} onDown={() => {}} onResize={() => {}} onDouble={() => {}} onText={(item, text) => updateNode(item.id, { text }, `preview-text:${item.id}`)} onInteraction={runInteraction} onPointDown={() => {}} />;
  };

  onMount(() => {
    if (stage) setCamera({ x: stage.clientWidth / 2, y: stage.clientHeight / 2, zoom: 0.8 });
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null; const typing = !!target?.matches("input,textarea,select,[contenteditable='true']");
      if (event.code === "Space" && !typing) { spaceHeld = true; if (stage) stage.style.cursor = "grab"; }
      if (typing) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? props.session.redo() : props.session.undo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); props.session.redo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelection(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "g") { event.preventDefault(); event.shiftKey ? ungroupSelection() : groupSelection(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") { event.preventDefault(); setFindOpen(true); return; }
      if (event.key === "Delete" || event.key === "Backspace") { deleteSelection(); return; }
      if (event.key === "Escape") { setTool("select"); setSelectedIds([]); setConnectSource(""); setPreview(false); setFindOpen(false); setGuideMenuOpen(false); setFramePresetOpen(false); return; }
      if (event.key.toLowerCase() === "v") setTool("select"); else if (event.key.toLowerCase() === "h") setTool("hand"); else if (event.key.toLowerCase() === "f") setTool("frame"); else if (event.key.toLowerCase() === "r") setTool("rectangle"); else if (event.key.toLowerCase() === "o") setTool("ellipse"); else if (event.key.toLowerCase() === "t") setTool("text"); else if (event.key.toLowerCase() === "l") setTool("line"); else if (event.key.toLowerCase() === "m") setTool("measure");
    };
    const onKeyUp = (event: KeyboardEvent) => { if (event.code === "Space") { spaceHeld = false; if (stage) stage.style.cursor = tool() === "hand" ? "grab" : ""; } };
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKeyUp); onCleanup(() => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp); });
    const observer = new ResizeObserver(() => { if (stage && camera().x === 0 && camera().y === 0) setCamera({ x: stage.clientWidth / 2, y: stage.clientHeight / 2, zoom: 0.8 }); }); if (stage) observer.observe(stage); onCleanup(() => observer.disconnect());
  });

  const tools: Array<{ id: Tool; label: string; key?: string }> = [{ id: "select", label: "Select", key: "V" }, { id: "hand", label: "Pan", key: "H" }, { id: "frame", label: "Frame", key: "F" }, { id: "rectangle", label: "Rectangle", key: "R" }, { id: "ellipse", label: "Ellipse", key: "O" }, { id: "line", label: "Line", key: "L" }, { id: "path", label: "Vector path", key: "P" }, { id: "text", label: "Text", key: "T" }, { id: "button", label: "Button" }, { id: "input", label: "Input" }, { id: "checkbox", label: "Checkbox" }, { id: "image", label: "Image" }, { id: "measure", label: "Measure", key: "M" }];
  const toolsForHeader = tools.filter(item => ["hand", "frame", "rectangle", "ellipse", "line", "path", "text", "image", "measure"].includes(item.id));

  return <div class="ui-editor-shell">
    <header class="ui-editor-topbar">
      <button class="ui-topbar-back" onClick={() => props.session.goHome()} aria-label="Back to UI Design home" title="Home">←</button>
      <div class="ui-topbar-file"><span class="ui-brand-mark">U</span><div><strong>{document().name}</strong><small>{props.session.saving() ? "Saving…" : props.session.dirty() ? "Unsaved changes" : props.session.savedAt() ? `Saved ${props.session.savedAt()}` : "Local design"}</small></div></div>
      <nav class="ui-tools" aria-label="Design tools"><button type="button" class={`ui-tool-button ${tool() === "select" ? "is-active" : ""}`} aria-label="Selection tool" title="Selection tool (V)" onClick={() => setTool("select")}>↖</button><For each={toolsForHeader}>{item => item.id === "frame" ? <div class="ui-topbar-menu-anchor"><button type="button" class={`ui-tool-button ${tool() === item.id ? "is-active" : ""}`} aria-label={item.label} title={`${item.label} (F) · Choose a screen or container size`} aria-expanded={framePresetOpen()} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setFramePresetPosition({ left: Math.min(rect.left, Math.max(8, window.innerWidth - 320)), top: rect.bottom + 4 }); setTool("frame"); setFramePresetOpen(value => !value); setGuideMenuOpen(false); }}><ToolIcon tool={item.id} /></button><Show when={framePresetOpen()}><div class="ui-frame-preset-menu" style={{ left: `${framePresetPosition().left}px`, top: `${framePresetPosition().top}px` }} role="menu" aria-label="Create frame preset"><For each={UI_FRAME_PRESETS}>{preset => <button role="menuitem" onClick={() => chooseFramePreset(preset.id)}>{preset.label}<span>{preset.id === "custom" ? "Choose dimensions" : `${preset.width} × ${preset.height}`}</span></button>}</For></div></Show></div> : <button type="button" class={`ui-tool-button ${tool() === item.id ? "is-active" : ""}`} aria-label={item.label} title={`${item.label}${item.key ? ` (${item.key})` : ""}`} onClick={() => item.id === "image" ? imageInput?.click() : setTool(item.id)}><ToolIcon tool={item.id} /></button>}</For></nav>
      <div class="ui-topbar-view-actions" aria-label="Canvas view controls"><button type="button" title="Fit all" onClick={() => fitContent()}>Fit</button><button type="button" title="Fit selection" disabled={!selected().length} onClick={() => fitContent(selected())}>Selection</button><button type="button" title="Zoom to 100%" onClick={() => setCamera(current => ({ ...current, zoom: 1 }))}>100%</button><button type="button" title="Zoom out" onClick={() => zoomAt((stage?.getBoundingClientRect().left ?? 0) + (stage?.clientWidth ?? 0) / 2, (stage?.getBoundingClientRect().top ?? 0) + (stage?.clientHeight ?? 0) / 2, camera().zoom / 1.2)}>−</button><output>{zoomLabel()}</output><button type="button" title="Zoom in" onClick={() => zoomAt((stage?.getBoundingClientRect().left ?? 0) + (stage?.clientWidth ?? 0) / 2, (stage?.getBoundingClientRect().top ?? 0) + (stage?.clientHeight ?? 0) / 2, camera().zoom * 1.2)}>＋</button></div>
      <div class="ui-topbar-menu-anchor"><button type="button" class="ui-topbar-menu-trigger" aria-haspopup="dialog" aria-expanded={guideMenuOpen()} onClick={() => { setGuideMenuOpen(value => !value); setFramePresetOpen(false); }}>Guides⌄</button><Show when={guideMenuOpen()}><div class="ui-guide-popover" role="dialog" aria-label="Layout guides"><LayoutGuidePanel page={page()} onChange={grid => updatePage(current => ({ ...current, grid: { ...grid, visible: true, snap: true } }))} /></div></Show></div>
      <div class="ui-topbar-actions"><button disabled={!props.session.canUndo()} onClick={() => props.session.undo()} title="Undo (Ctrl/⌘+Z)">↶</button><button disabled={!props.session.canRedo()} onClick={() => props.session.redo()} title="Redo (Ctrl/⌘+Y)">↷</button><button onClick={() => void props.session.save()}>Save</button><button class="ui-present-button" onClick={startPrototype}>Present <span>▶</span></button><button onClick={() => props.session.goHome()}>Home</button></div>
    </header>
    <div class="ui-editor-layout">
       <aside class="ui-left-panel" aria-label="Design navigation"><div class="ui-panel-topline"><strong>{leftTab() === "pages" ? "Pages" : leftTab() === "layers" ? "Layers" : "Assets"}</strong><button title="Collapse panel sections" onClick={() => setLeftTab("layers")}>⌄</button></div><nav class="ui-panel-tabs" aria-label="Left panel sections"><For each={["pages", "layers", "assets"] as const}>{tab => <button class={leftTab() === tab ? "is-active" : ""} onClick={() => setLeftTab(tab)}>{tab}</button>}</For></nav>
        <Show when={leftTab() === "pages"}><section class="ui-left-section"><header><span>Pages</span><button title="Add page" onClick={addPage}>＋</button></header><For each={document().pages}>{item => <div class={`ui-page-row ${page().id === item.id ? "is-active" : ""}`}><button onClick={() => setPage(item.id)} onDblClick={() => renamePage(item)} title="Double-click to rename">▤ {item.name}</button><details><summary aria-label={`Page actions for ${item.name}`}>···</summary><div class="ui-page-menu"><button onClick={() => setPage(item.id)}>Open</button><button onClick={() => renamePage(item)}>Rename</button><button onClick={() => duplicatePage(item)}>Duplicate</button><button onClick={() => deletePage(item)}>Delete</button></div></details></div>}</For></section><section class="ui-left-section"><header><span>Prototype flows</span><button title="Add flow" onClick={() => updatePage(current => { const flow = { id: createUIDesignId("flow"), name: `Flow ${current.prototypeFlows.length + 1}`, startPageId: current.id, startNodeId: topVisible().find(node => node.kind === "frame")?.id }; return { ...current, prototypeFlows: [...current.prototypeFlows, flow], activePrototypeFlowId: flow.id }; })}>＋</button></header><For each={page().prototypeFlows}>{flow => <button class={`ui-flow-row ${page().activePrototypeFlowId === flow.id ? "is-active" : ""}`} onClick={() => updatePage(item => ({ ...item, activePrototypeFlowId: flow.id }))}>{flow.name}</button>}</For><Show when={!page().prototypeFlows.length}><p class="ui-panel-empty">Create a flow to set its starting screen.</p></Show></section><section class="ui-left-section"><header><span>Frames</span><button title="Add screen frame" onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setFramePresetPosition({ left: Math.min(rect.left, Math.max(8, window.innerWidth - 320)), top: rect.bottom + 4 }); setTool("frame"); setFramePresetOpen(true); }}>＋</button></header><For each={displayNodes().filter(node => node.kind === "frame")}>{frame => <button class={`ui-frame-row ${selectedIds().includes(frame.id) ? "is-active" : ""}`} style={{ "--frame-depth": `${Math.min(hierarchy().ancestors(frame.id).length, 5) * 12}px` }} onClick={() => { setSelectedIds([frame.id]); fitContent([frame]); }} onDblClick={() => renameNode(frame)}><span aria-hidden="true">▧</span><span>{frame.name}</span><small>{frame.frameType === "screen" ? "Screen" : "Container"}</small></button>}</For><Show when={!displayNodes().some(node => node.kind === "frame")}><p class="ui-panel-empty">No frames on this page yet.</p></Show></section></Show>
        <Show when={leftTab() === "layers"}><section class="ui-left-section ui-layer-section"><header><span>{page().name.toUpperCase()} · LAYERS</span><button title="Group selected (Ctrl+G)" onClick={groupSelection}>＋</button></header><div class="ui-searchbox"><span>⌕</span><input placeholder="Search layers" value={layerSearch()} onInput={event => setLayerSearch(event.currentTarget.value)} /><button title="Clear search" onClick={() => setLayerSearch("")}>×</button></div><div class="ui-layer-list">{renderLayerTree(page().id, 0)}</div><Show when={!page().elements.length}><div class="ui-panel-empty">Add a frame or element to start.</div></Show><footer><button disabled={selected().length < 2} onClick={groupSelection}>Group</button><button disabled={!selected().some(node => node.kind === "group" || node.kind === "frame")} onClick={ungroupSelection}>Ungroup</button></footer></section></Show>
        <Show when={leftTab() === "assets"}><section class="ui-left-section ui-assets-section">
          <div class="ui-searchbox"><span aria-hidden="true">⌕</span><input aria-label="Search assets" placeholder="Search assets" value={assetSearch()} onInput={event => setAssetSearch(event.currentTarget.value)} /><Show when={assetSearch()}><button aria-label="Clear asset search" onClick={() => setAssetSearch("")}>×</button></Show></div>
          <div class="ui-library-heading">ASSET LIBRARY <span>{matchingAssets().length + matchingComponents().length}</span></div>
          <For each={assetCategories()}>{category => <section class="ui-asset-category">
            <button class="ui-category-toggle" onClick={() => toggleAssetCategory(category)} aria-expanded={!assetCollapsed().has(category)}><span aria-hidden="true">{assetCollapsed().has(category) ? "›" : "⌄"}</span>{category}<small>{matchingAssets().filter(asset => asset.category === category).length}</small></button>
            <Show when={!assetCollapsed().has(category)}><For each={matchingAssets().filter(asset => asset.category === category)}>{asset => {
              const scale = Math.min(36 / asset.width, 23 / asset.height);
              return <button class="ui-asset-row" title={`Add ${asset.name}`} aria-label={`Add ${asset.name} asset`} onClick={() => addAsset(asset)}><span class="ui-asset-thumb" aria-hidden="true">{asset.parts.slice(0, 6).map(part => {
                const textLike = part.kind === "text";
                const lineLike = part.kind === "line";
                return <i class={`ui-asset-preview-part kind-${part.kind}`} style={{ left: `${part.x * scale}px`, top: `${part.y * scale + (textLike ? 3 : 0)}px`, width: `${Math.max(textLike ? 8 : 2, part.width * scale)}px`, height: `${textLike || lineLike ? 2 : Math.max(2, part.height * scale)}px`, "background-color": textLike || lineLike || part.kind === "path" ? "#6f7f99" : part.fill ?? "#dce5f3", "border-radius": `${Math.min(part.radius ?? (part.kind === "ellipse" ? 20 : 3), 8) * scale}px` }} />;
              })}</span><span>{asset.name}</span><small aria-hidden="true">＋</small></button>;
            }}</For></Show>
          </section>}</For>
          <Show when={assetSearch() && !matchingAssets().length && !matchingComponents().length}><p class="ui-panel-empty">No assets match “{assetSearch()}”.</p></Show>
          <Show when={!assetSearch() || matchingComponents().length > 0}><section class="ui-asset-category ui-component-assets"><button class="ui-category-toggle" onClick={() => toggleAssetCategory("Components")} aria-expanded={!assetCollapsed().has("Components")}><span aria-hidden="true">{assetCollapsed().has("Components") ? "›" : "⌄"}</span>Components<small>{matchingComponents().length}</small></button><Show when={!assetCollapsed().has("Components")}><For each={matchingComponents()}>{component => <button class="ui-asset-row" title={`Add ${component.name}`} onClick={() => insertComponent(component.id)}><span class="ui-asset-thumb ui-component-asset-preview" aria-hidden="true">◇</span><span>{component.name}</span><small aria-hidden="true">＋</small></button>}</For><Show when={!assetSearch() && !document().components.length}><p class="ui-panel-empty">Create a component from a selection to keep it here.</p></Show></Show></section></Show>
        </section></Show>
      </aside>

      <main class="ui-center-workspace"><div ref={stage} class={`ui-canvas-stage tool-${tool()}`} style={{ background: page().background }} onPointerDown={handleStageDown} onPointerMove={handleStageMove} onPointerUp={finishGesture} onPointerCancel={finishGesture} onWheel={handleWheel}>
         <div class={`ui-canvas-grid ${page().grid.kind}`} style={{ "--grid-step": `${Math.max(4, page().grid.size * camera().zoom)}px`, "--grid-half": `${Math.max(2, page().grid.size * camera().zoom / 2)}px`, "--grid-color": page().grid.color, "--grid-opacity": page().grid.opacity, "--grid-x": `${camera().x}px`, "--grid-y": `${camera().y}px`, display: "block" }} />
        <div class="ui-infinite-plane" style={{ transform: `translate(${camera().x}px,${camera().y}px) scale(${camera().zoom})` }}>{renderChildren(page().id)}
          <Show when={connectSource()}><svg class="ui-prototype-wires" style={{ position: "absolute", left: `${sceneExtent().x}px`, top: `${sceneExtent().y}px`, width: `${sceneExtent().width}px`, height: `${sceneExtent().height}px`, overflow: "visible", "pointer-events": "none" }}><For each={displayNodes().flatMap(node => node.interactions.filter(link => link.targetNodeId).map(link => ({ node, link })))}>{entry => { const from = worldBounds(entry.node); const toNode = hierarchy().get(entry.link.targetNodeId ?? ""); const to = toNode && worldBounds(toNode); return from && to ? <path d={`M ${from.x + from.width - sceneExtent().x} ${from.y + from.height / 2 - sceneExtent().y} C ${from.x + from.width + 60 - sceneExtent().x} ${from.y + from.height / 2 - sceneExtent().y}, ${to.x - 60 - sceneExtent().x} ${to.y + to.height / 2 - sceneExtent().y}, ${to.x - sceneExtent().x} ${to.y + to.height / 2 - sceneExtent().y}`} /> : null; }}</For></svg></Show>
          <Show when={gesture()?.kind === "draw" && gestureRect()}><div class="ui-draw-preview" style={{ left: `${gestureRect()!.x}px`, top: `${gestureRect()!.y}px`, width: `${Math.max(1, gestureRect()!.width)}px`, height: `${Math.max(1, gestureRect()!.height)}px` }} /></Show>
          <Show when={gesture()?.kind === "marquee" && gestureRect()}><div class="ui-marquee" style={{ left: `${gestureRect()!.x}px`, top: `${gestureRect()!.y}px`, width: `${gestureRect()!.width}px`, height: `${gestureRect()!.height}px` }} /></Show>
          <Show when={measureGesture()}>{active => <svg class="ui-manual-measure" viewBox={`${Math.min(active().start.x, active().current.x)} ${Math.min(active().start.y, active().current.y)} ${Math.max(1, Math.abs(active().current.x - active().start.x))} ${Math.max(1, Math.abs(active().current.y - active().start.y))}`}><line x1={active().start.x} y1={active().start.y} x2={active().current.x} y2={active().current.y} /></svg>}</Show>
          <For each={spacingMeasurements()}>{item => <div class={`ui-gap-indicator gap-${item.axis}`} style={{ left: `${Math.min(item.x1, item.x2)}px`, top: `${Math.min(item.y1, item.y2)}px`, width: `${Math.max(1, Math.abs(item.x2 - item.x1))}px`, height: `${Math.max(1, Math.abs(item.y2 - item.y1))}px` }}><span>{round(item.gap)} px</span></div>}</For>
         <Show when={snapGuides().x}>{guide => <div class="ui-smart-guide ui-smart-guide-x" aria-hidden="true" style={{ left: `${guide().position}px`, top: `${guide().start}px`, height: `${Math.max(1, guide().end - guide().start)}px` }}><span>{guide().peer} · {guide().alignment}</span></div>}</Show><Show when={snapGuides().y}>{guide => <div class="ui-smart-guide ui-smart-guide-y" aria-hidden="true" style={{ left: `${guide().start}px`, top: `${guide().position}px`, width: `${Math.max(1, guide().end - guide().start)}px` }}><span>{guide().peer} · {guide().alignment}</span></div>}</Show>
          <Show when={equalSpacing()}><div class="ui-equal-spacing-badge">Equal {equalSpacing()?.axis === "x" ? "horizontal" : "vertical"} gap · {round(equalSpacing()!.gap)} px</div></Show>
          <Show when={connectSource()}><div class="ui-connect-hint">Select a frame to connect · Esc to cancel</div></Show>
        </div>
        <Show when={message()}><div class="ui-toast-message" role="status">{message()}</div></Show>
        </div>
      </main>

      <aside class="ui-right-panel" aria-label="Properties"><nav class="ui-inspector-tabs"><For each={["design", "prototype", "inspect"] as const}>{tab => <button class={rightTab() === tab ? "is-active" : ""} onClick={() => setRightTab(tab)}>{tab}</button>}</For></nav>
        <Show when={rightTab() === "design"}><div class="ui-inspector-scroll"><Show when={selectedOne()} fallback={<>
           <section class="ui-inspector-section"><header><strong>Page</strong><span>{page().name}</span></header><label class="ui-color-field"><span>Canvas background</span><input type="color" value={page().background} onInput={event => updatePage(current => ({ ...current, background: event.currentTarget.value }))} /></label></section>
          <section class="ui-inspector-section"><header><strong>Quality checks</strong><button onClick={() => setShowLint(value => !value)}>{showLint() ? "Hide" : `Review ${lintResults().length}`}</button></header><Show when={showLint()}><For each={lintResults()}>{finding => <button class={`ui-lint-row severity-${finding.severity}`} onClick={() => { if (finding.node) setSelectedIds([finding.node.id]); }}>{finding.text}</button>}</For><Show when={!lintResults().length}><p class="ui-inspector-note">No size or style issues found on this page.</p></Show><button class="ui-secondary-action" onClick={exportSVG}>Export page SVG</button></Show></section>
          </>}>
          <SelectedInspector node={selectedOne()!} page={page()} document={document()} hierarchy={hierarchy()} updateNode={updateNode} updateField={updateField} updatePage={updatePage} setColorMode={modeId => updateDocument(doc => ({ ...doc, activeColorModeId: modeId }))} renameNode={renameNode} createComponent={createComponent} applyVariant={applyVariant} detachComponent={detachComponent} resetComponent={resetComponent} />
        </Show><section class="ui-inspector-section ui-styles-section"><header><strong>Design tokens</strong><button onClick={exportTokens} title="Export token JSON">↓</button></header><div class="ui-token-actions"><button onClick={() => tokenInput?.click()}>Import tokens</button><button onClick={exportTokens}>Export tokens</button></div><For each={document().colorModes}>{mode => <button class={`ui-mode-pill ${document().activeColorModeId === mode.id ? "is-active" : ""}`} onClick={() => updateDocument(doc => ({ ...doc, activeColorModeId: mode.id }))}>{mode.name}</button>}</For><TokenSection title="Colors" onAdd={() => addToken("color")}><For each={document().colorTokens}>{token => <div class="ui-token-row"><input type="color" aria-label={`Color for ${token.name}`} value={token.modeValues?.[document().activeColorModeId] ?? token.value} onInput={event => updateDocument(doc => ({ ...doc, colorTokens: doc.colorTokens.map(item => item.id === token.id ? { ...item, value: event.currentTarget.value, modeValues: { ...item.modeValues, [doc.activeColorModeId]: event.currentTarget.value } } : item) }))} /><input aria-label="Color token name" value={token.name} onInput={event => updateDocument(doc => ({ ...doc, colorTokens: doc.colorTokens.map(item => item.id === token.id ? { ...item, name: event.currentTarget.value } : item) }))} /><input aria-label="Color token alias" value={token.aliasOf ?? ""} placeholder="Alias token id" onChange={event => updateDocument(doc => ({ ...doc, colorTokens: doc.colorTokens.map(item => item.id === token.id ? { ...item, aliasOf: event.currentTarget.value } : item) }))} /></div>}</For></TokenSection><TokenSection title="Typography" onAdd={() => addToken("type")}><For each={document().typographyTokens}>{token => <div class="ui-token-card"><input aria-label="Typography token name" value={token.name} onInput={event => updateDocument(doc => ({ ...doc, typographyTokens: doc.typographyTokens.map(item => item.id === token.id ? { ...item, name: event.currentTarget.value } : item) }))} /><span>{token.fontSize}px · {token.fontWeight}</span></div>}</For></TokenSection><TokenSection title="Spacing" onAdd={() => addToken("spacing")}><For each={document().spacingTokens}>{token => <TokenValue token={token} onChange={value => updateDocument(doc => ({ ...doc, spacingTokens: doc.spacingTokens.map(item => item.id === token.id ? { ...item, value } : item) }))} />}</For></TokenSection><TokenSection title="Radius" onAdd={() => addToken("radius")}><For each={document().radiusTokens}>{token => <TokenValue token={token} onChange={value => updateDocument(doc => ({ ...doc, radiusTokens: doc.radiusTokens.map(item => item.id === token.id ? { ...item, value } : item) }))} />}</For></TokenSection><TokenSection title="Effects" onAdd={() => addToken("effect")}><For each={document().effectTokens}>{token => <div class="ui-token-card"><input aria-label="Effect token name" value={token.name} onInput={event => updateDocument(doc => ({ ...doc, effectTokens: doc.effectTokens.map(item => item.id === token.id ? { ...item, name: event.currentTarget.value } : item) }))} /><input aria-label="Effect token value" value={token.value} onInput={event => updateDocument(doc => ({ ...doc, effectTokens: doc.effectTokens.map(item => item.id === token.id ? { ...item, value: event.currentTarget.value } : item) }))} /></div>}</For></TokenSection></section>
          </div></Show>
        <Show when={rightTab() === "prototype"}><div class="ui-inspector-scroll"><section class="ui-inspector-section"><header><strong>Prototype</strong><button class="ui-primary-action-small" onClick={startPrototype}>Present ▶</button></header><label class="ui-field"><span>Starting point</span><select value={page().activePrototypeFlowId} onChange={event => updatePage(current => ({ ...current, activePrototypeFlowId: event.currentTarget.value }))}><For each={page().prototypeFlows}>{flow => <option value={flow.id}>{flow.name}</option>}</For></select></label><label class="ui-field"><span>Starting screen</span><select value={page().prototypeFlows.find(flow => flow.id === page().activePrototypeFlowId)?.startNodeId ?? ""} onChange={event => updatePage(current => ({ ...current, prototypeFlows: current.prototypeFlows.map(flow => flow.id === current.activePrototypeFlowId ? { ...flow, startNodeId: event.currentTarget.value } : flow) }))}><option value="">First screen frame</option><For each={page().elements.filter(node => node.kind === "frame")}>{frame => <option value={frame.id}>{frame.name}</option>}</For></select></label><Show when={selectedOne()}><div class="ui-prototype-actions"><button onClick={() => { setConnectSource(selectedOne()!.id); setMessage("Select a target screen frame"); }}>＋ Connect to frame</button><button onClick={() => addInteraction(selectedOne()!)}>＋ Add interaction</button></div><For each={selectedOne()?.interactions ?? []}>{(interaction, index) => <InteractionEditor interaction={interaction} page={page()} nodes={page().elements} onChange={next => updateNode(selectedOne()!.id, { interactions: selectedOne()!.interactions.map((item, i) => i === index() ? next : item) })} onRemove={() => updateNode(selectedOne()!.id, { interactions: selectedOne()!.interactions.filter((_, i) => i !== index()) })} />}</For></Show><For each={displayNodes().filter(node => node.kind === "frame")}>{frame => <div class="ui-connection-row"><span>{frame.name}</span><For each={frame.interactions.filter(link => link.targetNodeId)}>{link => <small>→ {hierarchy().get(link.targetNodeId!)?.name}</small>}</For></div>}</For></section></div></Show>
        <Show when={rightTab() === "inspect"}><div class="ui-inspector-scroll"><section class="ui-inspector-section"><header><strong>Inspect / handoff</strong><button onClick={exportSVG}>Export SVG</button></header><Show when={selectedOne()} fallback={<p class="ui-inspector-note">Select an object to inspect its measurements and code.</p>}><InspectPanel node={selectedOne()!} parent={hierarchy().parent(selectedOne()!.id)} /></Show><button class="ui-secondary-action" onClick={exportTokens}>Export design tokens</button><button class="ui-secondary-action" onClick={() => setShowLint(true)}>Run accessibility and consistency checks</button><Show when={lintResults().length > 0}><For each={lintResults()}>{finding => <div class={`ui-lint-row severity-${finding.severity}`}>{finding.text}</div>}</For></Show></section></div></Show>
      </aside>
    </div>
    <input ref={imageInput} type="file" accept="image/*,.svg" hidden onChange={event => { void readImage(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
    <input ref={tokenInput} type="file" accept="application/json,.json" hidden onChange={event => { void importTokens(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
    <Show when={findOpen()}><div class="ui-dialog-backdrop" onClick={() => setFindOpen(false)}><section class="ui-find-dialog" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}><header><strong>Find and replace text</strong><button onClick={() => setFindOpen(false)}>×</button></header><TextField label="Find" value={findQuery()} onInput={setFindQuery} /><TextField label="Replace with" value={replaceQuery()} onInput={setReplaceQuery} /><footer><button onClick={() => setFindOpen(false)}>Cancel</button><button class="ui-primary-action-small" onClick={replaceText}>Replace all</button></footer></section></div></Show>
        <Show when={preview()}><PrototypePresentation document={document()} pageId={previewPageId()} nodeId={previewNodeId()} overlay={previewOverlay()} historyLength={previewHistory().length} transition={previewTransition()} renderNode={renderPreviewNode} onClose={() => setPreview(false)} onBack={() => runInteraction({ id: "back", name: "Back", trigger: "click", action: "back", transition: "instant" })} onScreen={(pageId, nodeId) => { setPreviewPageId(pageId); setPreviewNodeId(nodeId); setPreviewOverlay(undefined); }} /></Show>
  </div>;
}

function TokenSection(props: { title: string; onAdd: () => void; children: JSX.Element }) { const [open, setOpen] = createSignal(true); return <section class="ui-token-section"><header><button onClick={() => setOpen(value => !value)}>{open() ? "⌄" : "›"} {props.title}</button><button onClick={props.onAdd} aria-label={`Add ${props.title} token`}>＋</button></header><Show when={open()}><div>{props.children}</div></Show></section>; }
function TokenValue(props: { token: { id: string; name: string; value: number; unit: "px" | "rem" }; onChange: (value: number) => void }) { return <div class="ui-token-card"><input value={props.token.name} aria-label="Token name" /><input type="number" value={round(props.token.value)} onInput={event => props.onChange(round(Number(event.currentTarget.value)))} /><span>{props.token.unit}</span></div>; }

function LayoutGuidePanel(props: { page: UIPage; onChange: (grid: UIPage["grid"]) => void }) {
  const [expanded, setExpanded] = createSignal(true); const grid = () => props.page.grid;
  const update = (patch: Partial<UIPage["grid"]>) => props.onChange({ ...grid(), ...patch, visible: true, snap: true });
  return <section class="ui-inspector-section ui-guide-panel"><header><strong>Layout guides</strong><button aria-expanded={expanded()} onClick={() => setExpanded(value => !value)}>{expanded() ? "−" : "+"}</button></header><Show when={expanded()}><SelectField label="Guide type" value={grid().kind} options={["square", "columns", "rows", "modular", "baseline"]} onChange={kind => update({ kind })} /><div class="ui-grid-fields"><NumberField label="Columns" min={1} max={48} value={grid().columns} onInput={columns => update({ columns })} /><NumberField label="Rows" min={1} max={48} value={grid().rows} onInput={rows => update({ rows })} /><NumberField label="Grid size" min={1} max={512} value={grid().size} onInput={size => update({ size })} /><NumberField label="Baseline" min={1} max={128} value={grid().baseline} onInput={baseline => update({ baseline })} /><NumberField label="Gutter" min={0} max={512} value={grid().gutter} onInput={gutter => update({ gutter })} /><NumberField label="Margin" min={0} max={2000} value={grid().margin} onInput={margin => update({ margin })} /></div><div class="ui-grid-fields"><label class="ui-field"><span>Guide color</span><input type="color" value={grid().color} onInput={event => update({ color: event.currentTarget.value })} /></label><label class="ui-field"><span>Opacity · {round(grid().opacity * 100)}%</span><input type="range" min="0.01" max="0.8" step="0.01" value={grid().opacity} onInput={event => update({ opacity: Number(event.currentTarget.value) })} /></label></div></Show></section>;
}

function SelectedInspector(props: { node: UIElement; page: UIPage; document: UIDesignDocument; hierarchy: UIHierarchyIndex<UIElement>; updateNode: (id: string, patch: Partial<UIElement>, key?: string) => void; updateField: <K extends keyof UIElement>(node: UIElement, key: K, value: UIElement[K], keyName?: string) => void; updatePage: (mutate: (page: UIPage) => UIPage) => void; setColorMode: (modeId: string) => void; renameNode: (node: UIElement) => void; createComponent: () => void; applyVariant: (node: UIElement, variantId: string) => void; detachComponent: (node: UIElement) => void; resetComponent: (node: UIElement) => void }) {
  const [openSections, setOpenSections] = createSignal(new Set(["position", "layout", "appearance", "text", "prototype"])); const open = (id: string) => openSections().has(id); const toggle = (id: string) => setOpenSections(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const node = () => props.node; const position = () => props.hierarchy.worldTransform(node().id) ?? { x: node().x, y: node().y, rotation: node().rotation };
  const edit = <K extends keyof UIElement>(key: K, value: UIElement[K]) => props.updateField(node(), key, value);
  const setWorldPosition = (axis: "x" | "y", value: number) => { const transform = position(); const dx = axis === "x" ? round(value) - round(transform.x) : 0; const dy = axis === "y" ? round(value) - round(transform.y) : 0; const parent = node().parentId === props.page.id ? undefined : props.hierarchy.worldTransform(node().parentId); const rad = -(parent?.rotation ?? 0) * Math.PI / 180; props.updateNode(node().id, { x: round(node().x + dx * Math.cos(rad) - dy * Math.sin(rad)), y: round(node().y + dx * Math.sin(rad) + dy * Math.cos(rad)) }); };
  const section = (id: string, title: string, content: JSX.Element) => <section class="ui-inspector-section"><header><button class="ui-section-toggle" onClick={() => toggle(id)}>{open(id) ? "⌄" : "›"} {title}</button></header><Show when={open(id)}>{content}</Show></section>;
  const colorValue = (tokenId: string, fallback: string) => resolveColorToken(props.document.colorTokens, tokenId, props.document.activeColorModeId, fallback);
  return <>
    <section class="ui-selected-heading"><strong>{node().name}</strong><small>{kindName(node().kind)}{node().kind === "frame" ? node().frameType === "screen" ? " · Screen" : " · Container" : ""}</small><div><button onClick={() => props.renameNode(node())}>Rename</button><button onClick={() => props.updateNode(node().id, { locked: !node().locked })}>{node().locked ? "Unlock" : "Lock"}</button></div></section>
    {section("position", "Position", <><div class="ui-property-grid"><NumberField label="X" value={position().x} onInput={value => setWorldPosition("x", value)} /><NumberField label="Y" value={position().y} onInput={value => setWorldPosition("y", value)} /><NumberField label="W" min={1} value={node().width} onInput={value => props.updateNode(node().id, { width: value })} /><NumberField label="H" min={1} value={node().height} onInput={value => props.updateNode(node().id, { height: value })} /><NumberField label="Rotation" value={node().rotation} onInput={value => edit("rotation", value)} /></div><label class="ui-field"><span>Layer name</span><input value={node().name} onInput={event => edit("name", event.currentTarget.value)} /></label><div class="ui-property-grid"><SelectField label="Horizontal" value={node().constraints.horizontal} options={["left", "right", "left-right", "center", "scale"]} onChange={horizontal => edit("constraints", { ...node().constraints, horizontal })} /><SelectField label="Vertical" value={node().constraints.vertical} options={["top", "bottom", "top-bottom", "center", "scale"]} onChange={vertical => edit("constraints", { ...node().constraints, vertical })} /></div></>)}
    {node().kind === "frame" ? <><section class="ui-inspector-section"><header><strong>Frame</strong></header><SelectField label="Type" value={node().frameType} options={["screen", "container"]} onChange={frameType => edit("frameType", frameType)} /><SelectField label="Preset" value={node().framePreset} options={UI_FRAME_PRESETS.map(item => item.id)} onChange={presetId => { const preset = UI_FRAME_PRESETS.find(item => item.id === presetId); if (preset) props.updateNode(node().id, { framePreset: preset.id, width: preset.width, height: preset.height, frameType: preset.id === "custom" ? "container" : "screen" }); }} /><label class="ui-check-row"><input type="checkbox" checked={node().clipContent} onChange={event => edit("clipContent", event.currentTarget.checked)} /> Clip children</label><label class="ui-color-field"><span>Frame fill</span><input type="color" value={node().fill} onInput={event => edit("fill", event.currentTarget.value)} /></label><label class="ui-check-row"><input type="checkbox" checked={node().mask} onChange={event => edit("mask", event.currentTarget.checked)} /> Use as mask for children</label></section><section class="ui-inspector-section"><header><strong>Frame preview</strong></header><p class="ui-inspector-note">Resize constraints on children are applied from this frame’s dimensions.</p></section></> : null}
    {section("layout", "Auto layout", <><label class="ui-check-row"><input type="checkbox" checked={node().autoLayout.enabled} onChange={event => edit("autoLayout", { ...node().autoLayout, enabled: event.currentTarget.checked })} /> Enable auto layout</label><Show when={node().autoLayout.enabled}><div class="ui-property-grid"><SelectField label="Direction" value={node().autoLayout.direction} options={["horizontal", "vertical", "grid"]} onChange={direction => edit("autoLayout", { ...node().autoLayout, direction })} /><NumberField label="Gap" min={0} value={node().autoLayout.gap} onInput={gap => edit("autoLayout", { ...node().autoLayout, gap })} /><NumberField label="Columns" min={1} max={48} value={node().autoLayout.columns} onInput={columns => edit("autoLayout", { ...node().autoLayout, columns })} /><SelectField label="Align" value={node().autoLayout.alignment} options={["start", "center", "end", "stretch"]} onChange={alignment => edit("autoLayout", { ...node().autoLayout, alignment })} /><SelectField label="Justify" value={node().autoLayout.justification} options={["start", "center", "end", "space-between"]} onChange={justification => edit("autoLayout", { ...node().autoLayout, justification })} /><SelectField label="Width" value={node().autoLayout.widthMode} options={["fixed", "hug", "fill"]} onChange={widthMode => edit("autoLayout", { ...node().autoLayout, widthMode })} /><SelectField label="Height" value={node().autoLayout.heightMode} options={["fixed", "hug", "fill"]} onChange={heightMode => edit("autoLayout", { ...node().autoLayout, heightMode })} /><NumberField label="Padding top" min={0} value={node().autoLayout.paddingTop} onInput={paddingTop => edit("autoLayout", { ...node().autoLayout, paddingTop })} /><NumberField label="Padding right" min={0} value={node().autoLayout.paddingRight} onInput={paddingRight => edit("autoLayout", { ...node().autoLayout, paddingRight })} /><NumberField label="Padding bottom" min={0} value={node().autoLayout.paddingBottom} onInput={paddingBottom => edit("autoLayout", { ...node().autoLayout, paddingBottom })} /><NumberField label="Padding left" min={0} value={node().autoLayout.paddingLeft} onInput={paddingLeft => edit("autoLayout", { ...node().autoLayout, paddingLeft })} /></div><label class="ui-check-row"><input type="checkbox" checked={node().autoLayout.wrap} onChange={event => edit("autoLayout", { ...node().autoLayout, wrap: event.currentTarget.checked })} /> Wrap content</label><label class="ui-check-row"><input type="checkbox" checked={node().autoLayout.clip} onChange={event => edit("autoLayout", { ...node().autoLayout, clip: event.currentTarget.checked })} /> Clip content</label></Show>{!node().autoLayout.enabled ? <div class="ui-property-grid"><SelectField label="Width sizing" value={node().widthSizing} options={["fixed", "hug", "fill"]} onChange={widthSizing => edit("widthSizing", widthSizing)} /><SelectField label="Height sizing" value={node().heightSizing} options={["fixed", "hug", "fill"]} onChange={heightSizing => edit("heightSizing", heightSizing)} /></div> : null}</>)}
    {section("appearance", "Appearance", <><div class="ui-property-grid"><label class="ui-color-field"><span>Fill</span><input type="color" value={colorValue(node().fillTokenId, node().fill)} onInput={event => { edit("fill", event.currentTarget.value); edit("fillTokenId", ""); }} /></label><label class="ui-field"><span>Fill token</span><select value={node().fillTokenId} onChange={event => { const token = props.document.colorTokens.find(item => item.id === event.currentTarget.value); props.updateNode(node().id, { fillTokenId: token?.id ?? "", fill: token ? resolveColorToken(props.document.colorTokens, token.id, props.document.activeColorModeId, node().fill) : node().fill }); }}><option value="">Custom</option><For each={props.document.colorTokens}>{token => <option value={token.id}>{token.name}</option>}</For></select></label><label class="ui-color-field"><span>Stroke</span><input type="color" value={node().stroke === "none" ? "#ffffff" : node().stroke} onInput={event => edit("stroke", event.currentTarget.value)} /></label><NumberField label="Stroke width" min={0} value={node().strokeWidth} onInput={value => edit("strokeWidth", value)} /><NumberField label="Radius" min={0} value={node().radius} onInput={value => edit("radius", value)} /><NumberField label="Opacity %" min={0} max={100} value={round(node().opacity * 100)} onInput={value => edit("opacity", value / 100)} /><SelectField label="Shadow" value={node().shadow} options={["none", "soft", "strong"]} onChange={shadow => edit("shadow", shadow)} /><SelectField label="Stroke style" value={node().strokeStyle} options={["solid", "dashed", "dotted"]} onChange={strokeStyle => edit("strokeStyle", strokeStyle)} /></div><label class="ui-field"><span>Token mode</span><select value={props.document.activeColorModeId} onChange={event => props.setColorMode(event.currentTarget.value)}>{props.document.colorModes.map(mode => <option value={mode.id}>{mode.name}</option>)}</select></label></>)}
    <Show when={["text", "button", "input", "checkbox"].includes(node().kind)}>{section("text", "Text", <><TextField label="Content" value={node().text} onInput={value => edit("text", value)} multiline /><div class="ui-property-grid"><SelectField label="Font" value={node().fontFamily} options={["system", "sans", "serif", "mono"]} onChange={fontFamily => edit("fontFamily", fontFamily)} /><NumberField label="Size" min={1} max={512} value={node().fontSize} onInput={value => edit("fontSize", value)} /><NumberField label="Weight" min={100} max={900} step={100} value={node().fontWeight} onInput={value => edit("fontWeight", value)} /><NumberField label="Line height" min={50} max={500} value={round(node().lineHeight * 100)} onInput={value => edit("lineHeight", value / 100)} /><NumberField label="Letter spacing" value={node().letterSpacing} onInput={value => edit("letterSpacing", value)} /><SelectField label="Align" value={node().textAlign} options={["left", "center", "right"]} onChange={textAlign => edit("textAlign", textAlign)} /></div><label class="ui-field"><span>Text style</span><select value={node().typographyTokenId} onChange={event => { const token = props.document.typographyTokens.find(item => item.id === event.currentTarget.value); props.updateNode(node().id, { typographyTokenId: token?.id ?? "", ...(token ? { fontFamily: token.fontFamily, fontSize: token.fontSize, fontWeight: token.fontWeight, lineHeight: token.lineHeight, letterSpacing: token.letterSpacing } : {}) }); }}><option value="">Custom</option><For each={props.document.typographyTokens}>{token => <option value={token.id}>{token.name}</option>}</For></select></label></>)} </Show>
    <Show when={node().kind === "image"}>{section("image", "Image", <><SelectField label="Fit" value={node().imageFit} options={["cover", "contain", "fill"]} onChange={imageFit => edit("imageFit", imageFit)} /><div class="ui-property-grid"><NumberField label="Crop X %" min={0} max={100} value={round(node().imageCrop.x * 100)} onInput={value => edit("imageCrop", { ...node().imageCrop, x: value / 100 })} /><NumberField label="Crop Y %" min={0} max={100} value={round(node().imageCrop.y * 100)} onInput={value => edit("imageCrop", { ...node().imageCrop, y: value / 100 })} /><NumberField label="Crop W %" min={1} max={100} value={round(node().imageCrop.width * 100)} onInput={value => edit("imageCrop", { ...node().imageCrop, width: value / 100 })} /><NumberField label="Crop H %" min={1} max={100} value={round(node().imageCrop.height * 100)} onInput={value => edit("imageCrop", { ...node().imageCrop, height: value / 100 })} /></div></>)} </Show>
    <Show when={node().kind === "componentInstance"}>{section("component", "Component instance", <><label class="ui-field"><span>Variant</span><select value={node().componentVariantId} onChange={event => props.applyVariant(node(), event.currentTarget.value)}><For each={props.document.components.find(item => item.id === node().componentId)?.variants ?? []}>{variant => <option value={variant.id}>{variant.name}</option>}</For></select></label><div class="ui-property-grid"><button onClick={() => props.resetComponent(node())}>Reset overrides</button><button onClick={() => props.detachComponent(node())}>Detach instance</button></div></>)} </Show>
    <section class="ui-inspector-section"><header><strong>Reusable component</strong><button onClick={props.createComponent}>Create</button></header><p class="ui-inspector-note">Create a reusable local component from the selected node and its children.</p></section>
  </>;
}

function InteractionEditor(props: { interaction: UIInteraction; page: UIPage; nodes: UIElement[]; onChange: (interaction: UIInteraction) => void; onRemove: () => void }) {
  return <article class="ui-interaction-card"><header><strong>{props.interaction.name}</strong><button aria-label="Remove interaction" onClick={props.onRemove}>×</button></header><div class="ui-property-grid"><SelectField label="Trigger" value={props.interaction.trigger} options={["click", "hover", "press"]} onChange={trigger => props.onChange({ ...props.interaction, trigger })} /><SelectField label="Action" value={props.interaction.action} options={["navigate", "back", "open-overlay", "close-overlay"]} onChange={action => props.onChange({ ...props.interaction, action })} /></div><Show when={props.interaction.action === "navigate" || props.interaction.action === "open-overlay"}><label class="ui-field"><span>Destination</span><select value={props.interaction.targetNodeId ?? props.interaction.targetPageId ?? ""} onChange={event => { const target = event.currentTarget.value; const isNode = props.nodes.some(node => node.id === target); props.onChange({ ...props.interaction, targetNodeId: isNode ? target : "", targetPageId: isNode ? "" : target }); }}><option value="">Select screen</option><For each={props.nodes.filter(node => node.kind === "frame")}>{node => <option value={node.id}>{node.name}</option>}</For><For each={props.page.prototypeFlows}>{flow => <option value={flow.startPageId}>Page · {flow.name}</option>}</For></select></label></Show><SelectField label="Transition" value={props.interaction.transition} options={["instant", "dissolve", "slide-left", "slide-right"]} onChange={transition => props.onChange({ ...props.interaction, transition })} /></article>;
}

function InspectPanel(props: { node: UIElement; parent?: UIElement }) {
  const worldCss = () => `.layer-${props.node.id.replace(/[^\w-]/g, "-")} {\n  position: ${props.parent ? "absolute" : "relative"};\n  width: ${round(props.node.width)}px;\n  height: ${round(props.node.height)}px;\n  transform: translate(${round(props.node.x)}px, ${round(props.node.y)}px) rotate(${round(props.node.rotation)}deg);\n  background: ${props.node.fill};\n  border: ${round(props.node.strokeWidth)}px ${props.node.strokeStyle} ${props.node.stroke};\n  border-radius: ${round(props.node.radius)}px;\n  opacity: ${props.node.opacity};\n}`;
  return <div class="ui-inspect-content"><dl><dt>Width</dt><dd>{round(props.node.width)} px</dd><dt>Height</dt><dd>{round(props.node.height)} px</dd><dt>Position</dt><dd>{round(props.node.x)}, {round(props.node.y)} px</dd><dt>Rotation</dt><dd>{round(props.node.rotation)}°</dd><dt>Fill</dt><dd><i style={{ background: props.node.fill }} />{props.node.fill}</dd><dt>Stroke</dt><dd>{props.node.stroke}</dd><dt>Radius</dt><dd>{round(props.node.radius)} px</dd><dt>Layout</dt><dd>{props.node.autoLayout.enabled ? `Auto layout · ${props.node.autoLayout.direction}` : `${props.node.widthSizing} × ${props.node.heightSizing}`}</dd></dl><CodeBlock title="CSS" code={worldCss()} /></div>;
}
function CodeBlock(props: { title: string; code: string }) { const [copied, setCopied] = createSignal(false); return <section class="ui-code-section"><header><strong>{props.title}</strong><button onClick={() => { void navigator.clipboard?.writeText(props.code); setCopied(true); window.setTimeout(() => setCopied(false), 1200); }}>{copied() ? "Copied" : "Copy"}</button></header><pre><code>{props.code}</code></pre></section>; }

function PrototypePresentation(props: { document: UIDesignDocument; pageId: string; nodeId: string; overlay?: { pageId: string; nodeId: string }; historyLength: number; transition: UIInteraction["transition"]; renderNode: (nodeId: string, page: UIPage) => JSX.Element; onClose: () => void; onBack: () => void; onScreen: (pageId: string, nodeId: string) => void }) {
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
    <Show when={root()} fallback={<div class="ui-present-empty">This page has no screen or content to preview.</div>}>{screen => <div class="ui-present-device" style={{ width: `${screen().width}px`, height: `${screen().height}px`, "--preview-scale": scale(screen()), background: screen().fill }}>{props.renderNode(screen().id, page())}<Show when={overlayRoot()}>{overlay => <div class="ui-present-overlay-scrim" onClick={event => { if (event.target === event.currentTarget) props.onBack(); }}><div class="ui-present-overlay-device" style={{ width: `${overlay().width}px`, height: `${overlay().height}px`, "--preview-scale": scale(overlay()), background: overlay().fill }}>{props.renderNode(overlay().id, overlayPage()!)}</div></div>}</Show></div>}</Show>
  </div></div>;
}

function escapeXml(value: string) { return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ?? character); }
function downloadText(name: string, contents: string, type: string) { const url = URL.createObjectURL(new Blob([contents], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }

export function UiDesignWorkspace(props: Props) { return <Show when={props.session.editorOpen()} fallback={<UiDesignHome session={props.session} />}><UiDesignEditor session={props.session} /></Show>; }
