import { For, Show, createSignal, onCleanup, onMount } from "solid-js";

export type WindowsRadialContext = "canvas" | "text" | "connector" | "shape" | "image" | "ink" | "group" | "component" | "multiple";
export type WindowsRadialAction =
  | "select" | "eraser" | "width" | "color" | "copy" | "line" | "undo" | "pen" | "crop"
  | "fill" | "duplicate" | "copyStyle" | "pasteStyle" | "delete" | "group" | "ungroup"
  | "editText" | "editLabel" | "editGroup" | "textSize" | "lineStyle" | "route";
type Panel = "width" | "color";

type Props = {
  x: number;
  y: number;
  scale: number;
  activeTool: string;
  context: WindowsRadialContext;
  width: number;
  color: string;
  canEdit: boolean;
  canWidth: boolean;
  canFill: boolean;
  canLineStyle: boolean;
  canRoute: boolean;
  canEditText: boolean;
  canEditLabel: boolean;
  canEditGroup: boolean;
  canCopy: boolean;
  canUndo: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  canCopyStyle: boolean;
  canPasteStyle: boolean;
  canGroup: boolean;
  canUngroup: boolean;
  onAction: (action: WindowsRadialAction) => void;
  onWidth: (width: number) => void;
  onColor: (color: string) => void;
  onClose: () => void;
};

const SIZE = 210;
const CENTER = SIZE / 2;
const INNER_RADIUS = 34.5;
const OUTER_RADIUS = 104.25;
const LABEL_RADIUS = 69.75;
const PANEL_WIDTH = 220;
const PANEL_GAP = 14;
const WIDTHS = [1, 3, 6, 12] as const;
const COLORS = [
  { label: "Black", value: "#1d1d1f" },
  { label: "Red", value: "#ff3b30" },
  { label: "Orange", value: "#ff9500" },
  { label: "Green", value: "#34c759" },
  { label: "Blue", value: "#007aff" },
  { label: "Purple", value: "#6546ff" },
  { label: "Gray", value: "#8e8e93" },
  { label: "White", value: "#ffffff" },
] as const;

const ACTIONS: Record<WindowsRadialContext, { id: WindowsRadialAction; label: string }[]> = {
  canvas: [
    { id: "select", label: "Select" }, { id: "eraser", label: "Eraser" }, { id: "width", label: "Width" }, { id: "color", label: "Color" },
    { id: "copy", label: "Copy" }, { id: "line", label: "Line" }, { id: "undo", label: "Undo" }, { id: "pen", label: "Pen" },
  ],
  text: [
    { id: "select", label: "Select" }, { id: "editText", label: "Edit text" }, { id: "color", label: "Color" }, { id: "textSize", label: "Text size +" },
    { id: "copy", label: "Copy" }, { id: "copyStyle", label: "Copy style" }, { id: "duplicate", label: "Duplicate" }, { id: "delete", label: "Delete" },
  ],
  connector: [
    { id: "select", label: "Select" }, { id: "color", label: "Color" }, { id: "width", label: "Width" }, { id: "lineStyle", label: "Line style" },
    { id: "route", label: "Route" }, { id: "editLabel", label: "Edit label" }, { id: "duplicate", label: "Duplicate" }, { id: "delete", label: "Delete" },
  ],
  shape: [
    { id: "select", label: "Select" }, { id: "color", label: "Color" }, { id: "width", label: "Width" }, { id: "fill", label: "Fill" },
    { id: "editLabel", label: "Edit label" }, { id: "copy", label: "Copy" }, { id: "duplicate", label: "Duplicate" }, { id: "delete", label: "Delete" },
  ],
  ink: [
    { id: "select", label: "Select" }, { id: "color", label: "Color" }, { id: "width", label: "Width" }, { id: "eraser", label: "Eraser" },
    { id: "copy", label: "Copy" }, { id: "copyStyle", label: "Copy style" }, { id: "duplicate", label: "Duplicate" }, { id: "delete", label: "Delete" },
  ],
  group: [
    { id: "select", label: "Select" }, { id: "editGroup", label: "Enter group" }, { id: "copy", label: "Copy" }, { id: "copyStyle", label: "Copy style" },
    { id: "pasteStyle", label: "Paste style" }, { id: "duplicate", label: "Duplicate" }, { id: "ungroup", label: "Ungroup" }, { id: "delete", label: "Delete" },
  ],
  component: [
    { id: "select", label: "Select" }, { id: "editGroup", label: "Edit component" }, { id: "color", label: "Color" }, { id: "fill", label: "Fill" },
    { id: "copy", label: "Copy" }, { id: "copyStyle", label: "Copy style" }, { id: "duplicate", label: "Duplicate" }, { id: "delete", label: "Delete" },
  ],
  image: [
    { id: "select", label: "Select" }, { id: "crop", label: "Crop image" }, { id: "copy", label: "Copy" }, { id: "copyStyle", label: "Copy style" },
    { id: "duplicate", label: "Duplicate" }, { id: "delete", label: "Delete" },
  ],
  multiple: [
    { id: "select", label: "Select" }, { id: "copy", label: "Copy" }, { id: "copyStyle", label: "Copy style" }, { id: "pasteStyle", label: "Paste style" },
    { id: "group", label: "Group" }, { id: "duplicate", label: "Duplicate" }, { id: "undo", label: "Undo" }, { id: "delete", label: "Delete" },
  ],
};

function pointAt(angle: number, radius: number) {
  const radians = (angle - 90) * Math.PI / 180;
  return { x: CENTER + Math.cos(radians) * radius, y: CENTER + Math.sin(radians) * radius };
}

function sectorPath(index: number, count: number) {
  const step = 360 / count;
  const start = index * step - step / 2;
  const end = start + step;
  const innerStart = pointAt(start, INNER_RADIUS);
  const outerStart = pointAt(start, OUTER_RADIUS);
  const outerEnd = pointAt(end, OUTER_RADIUS);
  const innerEnd = pointAt(end, INNER_RADIUS);
  return `M ${innerStart.x} ${innerStart.y} L ${outerStart.x} ${outerStart.y} A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 0 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${INNER_RADIUS} ${INNER_RADIUS} 0 0 0 ${innerStart.x} ${innerStart.y} Z`;
}

function MenuIcon(props: { name: WindowsRadialAction; color: string; width: number }) {
  if (props.name === "color") return <span class="windows-radial-color-dot" style={{ background: props.color }} />;
  if (props.name === "width") return <span class="windows-radial-width-mark" style={{ height: `${Math.max(2, Math.min(7, props.width * .75))}px` }} />;
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <Show when={props.name === "select"}><path d="m5 3 12 9-5.4 1-2.2 6.5z" /></Show>
    <Show when={props.name === "eraser"}><path d="m9 4 10 10-7 7H7l-4-4zM6 19h15M6.5 14.5l5 5" /></Show>
    <Show when={props.name === "copy"}><rect x="8" y="8" width="12" height="12" rx="1" /><path d="M16 8V4H4v12h4" /></Show>
    <Show when={props.name === "line"}><path d="M5 19 19 5" /></Show>
    <Show when={props.name === "crop"}><path d="M8 4H4v4m12-4h4v4M20 16v4h-4M8 20H4v-4M8 8h8v8H8z" /></Show>
    <Show when={props.name === "undo"}><path d="m9 7-5 5 5 5M4 12h9a6 6 0 0 1 6 6" /></Show>
    <Show when={props.name === "pen"}><path d="m5 19 3.5-.8L19 7.7a2.1 2.1 0 0 0-3-3L5.5 15.2zM13.8 6.9l3.3 3.3M4 20h4" /></Show>
    <Show when={props.name === "fill"}><path d="m12 3 7 7-7 11-7-11zM8.5 13h7M18 17h.01" /></Show>
    <Show when={props.name === "duplicate"}><rect x="8" y="8" width="12" height="12" rx="1" /><path d="M16 8V4H4v12h4" /></Show>
    <Show when={props.name === "copyStyle" || props.name === "pasteStyle"}><path d="m14 4 6 6-9 9H5v-6zM12 6l6 6M4 20h16" /></Show>
    <Show when={props.name === "delete"}><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6" /></Show>
    <Show when={props.name === "group" || props.name === "ungroup" || props.name === "editGroup"}><rect x="3.5" y="4" width="8" height="8" rx="1" /><rect x="12.5" y="12" width="8" height="8" rx="1" /><path d="M11.5 8h5v4M12.5 16h-5v-4" /></Show>
    <Show when={props.name === "editText"}><path d="M5 6h14M12 6v13M8 19h8" /></Show>
    <Show when={props.name === "editLabel"}><path d="M4 6h16M12 6v13M8 19h8" /><path d="m17 16 3 3-3 3" /></Show>
    <Show when={props.name === "textSize"}><path d="M4 7h12M10 7v12M7 19h6M18 8v8m-3-3 3 3 3-3" /></Show>
    <Show when={props.name === "lineStyle"}><path d="M3 12h18" stroke-dasharray="3 3" /></Show>
    <Show when={props.name === "route"}><path d="M4 18h6V6h10m-4-4 4 4-4 4" /></Show>
  </svg>;
}

export function WindowsRadialMenu(props: Props) {
  const [panel, setPanel] = createSignal<Panel>();
  const [hovered, setHovered] = createSignal<WindowsRadialAction>();
  const [viewportSize, setViewportSize] = createSignal({ width: window.innerWidth, height: window.innerHeight });
  let dialogElement: HTMLDivElement | undefined;
  const actions = () => ACTIONS[props.context];
  const viewportWidth = () => viewportSize().width / props.scale;
  const viewportHeight = () => viewportSize().height / props.scale;
  const centerX = () => viewportWidth() < SIZE + 24 ? viewportWidth() / 2 : Math.max(CENTER + 12, Math.min(viewportWidth() - CENTER - 12, props.x / props.scale));
  const centerY = () => viewportHeight() < SIZE + 24 ? viewportHeight() / 2 : Math.max(CENTER + 12, Math.min(viewportHeight() - CENTER - 12, props.y / props.scale));
  const panelSide = () => {
    if (centerX() + CENTER + PANEL_GAP + PANEL_WIDTH + 12 <= viewportWidth()) return "right";
    if (centerX() - CENTER - PANEL_GAP - PANEL_WIDTH - 12 >= 0) return "left";
    const panelHeight = panel() === "color" ? 92 : 64;
    if (centerY() + CENTER + PANEL_GAP + panelHeight + 12 <= viewportHeight()) return "below";
    if (centerY() - CENTER - PANEL_GAP - panelHeight - 12 >= 0) return "above";
    return "overlay";
  };
  const enabled = (action: WindowsRadialAction) => {
    if (action === "select") return true;
    if (action === "width") return props.canWidth;
    if (action === "fill") return props.canFill;
    if (action === "lineStyle") return props.canLineStyle;
    if (action === "route") return props.canRoute;
    if (action === "editText") return props.canEditText;
    if (action === "editLabel") return props.canEditLabel;
    if (action === "editGroup") return props.canEditGroup;
    if (action === "undo") return props.canUndo;
    if (action === "copy") return props.canCopy;
    if (action === "duplicate") return props.canDuplicate;
    if (action === "delete") return props.canDelete;
    if (action === "copyStyle") return props.canCopyStyle;
    if (action === "pasteStyle") return props.canPasteStyle;
    if (action === "group") return props.canGroup;
    if (action === "ungroup") return props.canUngroup;
    return props.canEdit;
  };
  const active = (action: WindowsRadialAction) => panel() === action || props.activeTool === action;

  function choose(action: WindowsRadialAction) {
    if (!enabled(action)) return;
    if (action === "width" || action === "color") { setPanel(panel() === action ? undefined : action); return; }
    props.onAction(action);
    props.onClose();
  }

  onMount(() => {
    const focusFrame = requestAnimationFrame(() => dialogElement?.querySelector<HTMLButtonElement>(".windows-radial-action:not(:disabled)")?.focus({ preventScroll: true }));
    const onResize = () => setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); props.onClose(); return; }
      if (dialogElement?.contains(event.target as Node)) event.stopPropagation();
      if (event.key !== "Tab" || !dialogElement) return;
      const buttons = [...dialogElement.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    onCleanup(() => { cancelAnimationFrame(focusFrame); document.removeEventListener("keydown", onKeyDown); window.removeEventListener("resize", onResize); });
  });

  return <div class="windows-radial-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) props.onClose(); }} onContextMenu={event => event.preventDefault()}>
    <div ref={dialogElement} class="windows-radial-anchor" style={{ left: `${centerX()}px`, top: `${centerY()}px` }} role="dialog" aria-label={`${props.context === "canvas" ? "Canvas" : props.context} radial shortcuts`} aria-modal="true">
      <div class="windows-radial-wheel">
        <svg class="windows-radial-sectors" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          <For each={actions()}>{(action, index) => <path d={sectorPath(index(), actions().length)} classList={{ "is-active": active(action.id), "is-hovered": hovered() === action.id, "is-disabled": !enabled(action.id) }} onPointerEnter={() => setHovered(action.id)} onPointerLeave={() => setHovered(undefined)} onClick={() => choose(action.id)} />}</For>
        </svg>
        <For each={actions()}>{(action, index) => {
          const position = pointAt(index() * (360 / actions().length), LABEL_RADIUS);
          return <button type="button" class="windows-radial-action" classList={{ "is-active": active(action.id) }} style={{ left: `${position.x}px`, top: `${position.y}px` }} disabled={!enabled(action.id)} aria-label={action.id === "width" ? `Width, ${props.width} pixels` : action.label} aria-expanded={action.id === "width" || action.id === "color" ? panel() === action.id : undefined} onPointerEnter={() => setHovered(action.id)} onPointerLeave={() => setHovered(undefined)} onClick={() => choose(action.id)}>
            <MenuIcon name={action.id} color={props.color} width={props.width} />
            <Show when={action.id === "width"}><span class="windows-radial-value">{props.width} px</span></Show>
            <span class="windows-radial-label">{action.label}</span>
          </button>;
        }}</For>
        <button type="button" class="windows-radial-close" aria-label="Close radial menu" onClick={props.onClose}><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 18 18M18 6 6 18" /></svg></span></button>
      </div>
      <Show when={panel()}>{current => <div class={`windows-radial-panel is-${panelSide()}`} role="group" aria-label={current() === "width" ? "Stroke width" : "Stroke color"}>
        <Show when={current() === "width"} fallback={<div class="windows-radial-colors"><For each={COLORS}>{option => <button type="button" title={option.label} aria-label={option.label} aria-pressed={props.color.toLowerCase() === option.value} onClick={() => { props.onColor(option.value); props.onClose(); }}><span style={{ background: option.value }} /></button>}</For></div>}>
          <div class="windows-radial-widths"><For each={WIDTHS}>{width => <button type="button" classList={{ "is-selected": props.width === width }} aria-label={`${width} pixel stroke width`} aria-pressed={props.width === width} onClick={() => { props.onWidth(width); props.onClose(); }}><span class="windows-radial-width-preview" style={{ height: `${Math.max(1, width * .75)}px` }} /><span>{width} px</span></button>}</For></div>
        </Show>
      </div>}</Show>
    </div>
  </div>;
}
