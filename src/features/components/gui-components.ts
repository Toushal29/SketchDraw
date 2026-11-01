import type { FontFamily, GuiComponentProperties, GroupElement, Point, StrokeStyle, Theme } from "../../model";
import { strokeDashPattern } from "../canvas/stroke-style";
import { componentBaselineOffset, componentFont, componentFontFamily } from "./component-text";

export type GuiComponentKind =
  | "form-button" | "form-input" | "form-select" | "form-checkbox" | "form-radio" | "form-toggle" | "form-textarea" | "form-search" | "form-date" | "form-slider" | "form-password" | "form-email" | "form-file"
  | "gui-card" | "gui-app-bar" | "gui-navigation" | "gui-tabs" | "gui-image" | "gui-alert" | "gui-modal" | "gui-breadcrumbs" | "gui-avatar" | "gui-badge" | "gui-progress" | "gui-list" | "gui-table" | "gui-accordion" | "gui-menu" | "gui-toast" | "gui-pagination" | "gui-divider" | "gui-footer";

export const GUI_COMPONENT_DEFINITIONS: { kind: GuiComponentKind; section: string; label: string; description: string; width: number; height: number }[] = [
  { kind: "form-button", section: "Forms & UI | Controls", label: "Button", description: "Compact primary action button", width: 100, height: 50 },
  { kind: "form-input", section: "Forms & UI | Fields", label: "Text field", description: "Compact labeled text input", width: 175, height: 50 },
  { kind: "form-select", section: "Forms & UI | Fields", label: "Select field", description: "Compact labeled selection field", width: 175, height: 50 },
  { kind: "form-checkbox", section: "Forms & UI | Choices", label: "Checkbox group", description: "Compact list of selectable options", width: 150, height: 75 },
  { kind: "form-radio", section: "Forms & UI | Choices", label: "Radio group", description: "Compact single-choice list", width: 150, height: 75 },
  { kind: "form-toggle", section: "Forms & UI | Choices", label: "Toggle switch", description: "Compact settings switch", width: 150, height: 50 },
  { kind: "form-textarea", section: "Forms & UI | Fields", label: "Text area", description: "Multi-line text input", width: 190, height: 105 },
  { kind: "form-search", section: "Forms & UI | Fields", label: "Search field", description: "Search input with a search icon", width: 190, height: 50 },
  { kind: "form-date", section: "Forms & UI | Fields", label: "Date field", description: "Date input with a calendar affordance", width: 180, height: 50 },
  { kind: "form-slider", section: "Forms & UI | Controls", label: "Slider", description: "Range control with a movable value", width: 180, height: 56 },
  { kind: "form-password", section: "Forms & UI | Fields", label: "Password field", description: "Masked password input", width: 175, height: 50 },
  { kind: "form-email", section: "Forms & UI | Fields", label: "Email field", description: "Labeled email input", width: 175, height: 50 },
  { kind: "form-file", section: "Forms & UI | Fields", label: "File upload", description: "File picker field with upload affordance", width: 190, height: 50 },
  { kind: "gui-card", section: "Forms & UI | Layout", label: "Content card", description: "Card with image, title, copy, and action", width: 175, height: 125 },
  { kind: "gui-app-bar", section: "Forms & UI | Layout", label: "App bar", description: "Header bar with brand and account controls", width: 250, height: 50 },
  { kind: "gui-navigation", section: "Forms & UI | Layout", label: "Side navigation", description: "Navigation rail with active page", width: 150, height: 150 },
  { kind: "gui-tabs", section: "Forms & UI | Layout", label: "Tab bar", description: "Horizontal navigation tabs", width: 200, height: 50 },
  { kind: "gui-image", section: "Forms & UI | Media", label: "Image placeholder", description: "Replaceable media area for a wireframe", width: 150, height: 100 },
  { kind: "gui-alert", section: "Forms & UI | Feedback", label: "Alert banner", description: "Inline status message with an icon", width: 260, height: 68 },
  { kind: "gui-modal", section: "Forms & UI | Feedback", label: "Dialog window", description: "Confirmation dialog with actions", width: 300, height: 190 },
  { kind: "gui-breadcrumbs", section: "Forms & UI | Navigation", label: "Breadcrumbs", description: "Compact hierarchical navigation trail", width: 250, height: 42 },
  { kind: "gui-avatar", section: "Forms & UI | Identity", label: "Avatar", description: "User avatar with initials", width: 64, height: 64 },
  { kind: "gui-badge", section: "Forms & UI | Feedback", label: "Status badge", description: "Small status or category label", width: 100, height: 36 },
  { kind: "gui-progress", section: "Forms & UI | Feedback", label: "Progress bar", description: "Labeled completion meter", width: 210, height: 58 },
  { kind: "gui-list", section: "Forms & UI | Data", label: "List", description: "Compact list with editable rows", width: 210, height: 150 },
  { kind: "gui-table", section: "Forms & UI | Data", label: "Data table", description: "Simple table with headers and sample rows", width: 280, height: 150 },
  { kind: "gui-accordion", section: "Forms & UI | Layout", label: "Accordion", description: "Expandable section list wireframe", width: 240, height: 142 },
  { kind: "gui-menu", section: "Forms & UI | Navigation", label: "Menu", description: "Compact navigation menu", width: 180, height: 138 },
  { kind: "gui-toast", section: "Forms & UI | Feedback", label: "Toast notification", description: "Short status message with a dismiss affordance", width: 260, height: 74 },
  { kind: "gui-pagination", section: "Forms & UI | Navigation", label: "Pagination", description: "Page navigation with previous and next controls", width: 230, height: 42 },
  { kind: "gui-divider", section: "Forms & UI | Layout", label: "Divider", description: "Horizontal content separator", width: 200, height: 24 },
  { kind: "gui-footer", section: "Forms & UI | Layout", label: "Footer", description: "Page footer with a label and links", width: 320, height: 58 },
];

const GUI_KINDS = new Set<string>(GUI_COMPONENT_DEFINITIONS.map(item => item.kind));
export const isGuiComponentKind = (kind: string): kind is GuiComponentKind => GUI_KINDS.has(kind);

export function defaultGuiComponentProperties(kind: string): GuiComponentProperties | undefined {
  if (kind === "form-input") return { titlePosition: "top", placeholder: "Enter text" };
  if (kind === "form-select") return { titlePosition: "top", placeholder: "Choose an option" };
  if (kind === "form-textarea") return { titlePosition: "top", placeholder: "Write a message" };
  if (kind === "form-search") return { titlePosition: "top", placeholder: "Search" };
  if (kind === "form-date") return { titlePosition: "top", placeholder: "Select a date" };
  if (kind === "form-password") return { titlePosition: "top", placeholder: "Enter password" };
  if (kind === "form-email") return { titlePosition: "top", placeholder: "name@example.com" };
  if (kind === "form-file") return { titlePosition: "top", placeholder: "Choose a file" };
  if (kind === "form-checkbox" || kind === "form-radio") return { titlePosition: "top", optionLayout: "vertical", optionColumns: 2, optionGap: 4 };
  if (kind === "form-slider") return { title: "Volume" };
  if (kind === "gui-card") return { title: "Card title", bodyText: "Add a short description", actionLabel: "Details" };
  if (kind === "gui-app-bar") return { title: "Workspace", actionLabel: "JD" };
  if (kind === "gui-navigation") return { title: "Workspace", items: ["Overview", "Projects", "Reports", "Settings"], activeItem: 0 };
  if (kind === "gui-tabs") return { items: ["Overview", "Activity", "Settings"], activeItem: 0 };
  if (kind === "gui-image") return { placeholder: "Image" };
  if (kind === "gui-alert") return { title: "Information", bodyText: "Your changes are saved." };
  if (kind === "gui-modal") return { title: "Confirm action", bodyText: "Review this change before continuing.", actionLabel: "Continue" };
  if (kind === "gui-breadcrumbs") return { items: ["Home", "Projects", "Current"], activeItem: 2 };
  if (kind === "gui-avatar") return { title: "JD" };
  if (kind === "gui-badge") return { title: "Active" };
  if (kind === "gui-progress") return { title: "Progress" };
  if (kind === "gui-list") return { title: "Recent items", items: ["Project plan", "Design review", "Release notes"] };
  if (kind === "gui-table") return { title: "Team members", items: ["Name", "Role", "Status", "Alex", "Designer", "Active", "Sam", "Engineer", "Away"] };
  if (kind === "gui-accordion") return { title: "Help topics", items: ["Getting started", "Account settings", "Billing"] };
  if (kind === "gui-menu") return { title: "Menu", items: ["Overview", "Projects", "Settings"], activeItem: 0 };
  if (kind === "gui-toast") return { title: "Changes saved", bodyText: "Your work is up to date." };
  if (kind === "gui-pagination") return { items: ["1", "2", "3", "4", "5"], activeItem: 0 };
  if (kind === "gui-footer") return { title: "© 2025 SketchDraw", items: ["Help", "Privacy", "Terms"] };
  return undefined;
}

export function guiChoiceColumnCount(group: GroupElement, contentWidth: number): number {
  const meta = group.libraryComponent;
  if (!meta || (meta.kind !== "form-checkbox" && meta.kind !== "form-radio")) return 1;
  const props = meta.guiProperties ?? defaultGuiComponentProperties(meta.kind) ?? {};
  const options = meta.formOptions?.length ? meta.formOptions.slice(0, 12) : ["First option", "Second option", "Third option"];
  const layout = props.optionLayout ?? "vertical";
  if (layout === "vertical") return 1;
  const gap = Math.max(0, Math.min(40, props.optionColumnGap ?? props.optionGap ?? 4));
  const fittingColumns = Math.max(1, Math.floor((Math.max(0, contentWidth) + gap) / (36 + gap)));
  const requestedColumns = layout === "horizontal" ? options.length : Math.max(1, Math.round(props.optionColumns ?? 2));
  return Math.min(options.length, requestedColumns, fittingColumns);
}

export function guiChoiceMinimumHeight(group: GroupElement): number {
  const meta = group.libraryComponent;
  const bounds = group.componentBounds;
  if (!meta || !bounds || (meta.kind !== "form-checkbox" && meta.kind !== "form-radio")) return 25;
  const props = meta.guiProperties ?? defaultGuiComponentProperties(meta.kind) ?? {};
  const position = props.titlePosition ?? "top";
  const horizontalTitle = position === "left" || position === "right";
  const options = meta.formOptions?.length ? meta.formOptions.slice(0, 12) : ["First option", "Second option", "Third option"];
  const preferredFontSize = meta.textStyle?.fontSize ?? 11;
  const titleWidth = horizontalTitle ? Math.min(bounds.w * .38, Math.max(30, (meta.formTitle ?? "Choose an option").length * preferredFontSize * .55)) : bounds.w;
  const contentWidth = horizontalTitle ? Math.max(20, bounds.w - titleWidth - 6) : bounds.w - 4;
  const columns = guiChoiceColumnCount(group, contentWidth);
  const rows = Math.ceil(options.length / columns);
  const rowGap = Math.max(0, Math.min(40, props.optionRowGap ?? props.optionGap ?? 4));
  const titleHeight = horizontalTitle ? 2 : position === "bottom" ? 2 : 18;
  const bottomTitleSpace = position === "bottom" && !horizontalTitle ? 18 : 0;
  let height = titleHeight + rows * 11 + (rows - 1) * rowGap + bottomTitleSpace + 4;
  for (let pass = 0; pass < 4; pass++) {
    const fontSize = Math.max(9, Math.min(14, preferredFontSize, height * .32));
    const itemHeight = Math.max(11, fontSize * 1.2);
    height = titleHeight + rows * itemHeight + (rows - 1) * rowGap + bottomTitleSpace + 4;
  }
  return Math.max(25, Math.ceil(height));
}

export function guiNavigationMinimumHeight(group: GroupElement): number {
  const meta = group.libraryComponent;
  if (meta?.kind !== "gui-navigation") return 25;
  const props = meta.guiProperties ?? defaultGuiComponentProperties(meta.kind) ?? {};
  const itemCount = Math.max(1, Math.min(12, props.items?.length ?? 4));
  const rowGap = Math.max(0, Math.min(40, props.optionRowGap ?? props.optionGap ?? 4));
  return Math.max(52, 42 + itemCount * 12 + (itemCount - 1) * rowGap);
}

export function guiCardCompactThreshold(group: GroupElement): number {
  const props = group.libraryComponent?.guiProperties ?? defaultGuiComponentProperties(group.libraryComponent?.kind ?? "") ?? {};
  const rowGap = Math.max(0, Math.min(40, props.optionRowGap ?? props.optionGap ?? 4));
  return 80 + rowGap * 1.5;
}

type Style = { ink: string; muted: string; edge: string; surface: string; soft: string; accent: string };
function styleFor(group: GroupElement, theme: Theme): Style {
  const dark = theme === "dark";
  const host = typeof document === "undefined" ? undefined : document.querySelector<HTMLElement>(dark ? ".app-shell.theme-dark" : ".app-shell:not(.theme-dark)") ?? document.documentElement;
  const token = (name: string, fallback: string) => host && typeof getComputedStyle === "function" ? getComputedStyle(host).getPropertyValue(name).trim() || fallback : fallback;
  const safe = (value: string | null | undefined, fallback: string) => value && /^(#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i.test(value) ? value : fallback;
  const overrides = group.libraryComponent?.styleOverrides;
  return {
    ink: safe(overrides?.color, token("--diagram-ink", dark ? "#f0f1f2" : "#252a2e")),
    muted: token("--diagram-muted", dark ? "#c0c5c9" : "#737b82"),
    edge: safe(overrides?.color, token("--diagram-edge", dark ? "#aab1b8" : "#6f777e")),
    surface: overrides?.fillColor === null ? "transparent" : safe(overrides?.fillColor, token("--diagram-fill", dark ? "#25282b" : "#ffffff")),
    soft: token("--diagram-soft", dark ? "#3a3f44" : "#edf0f2"),
    accent: token("--diagram-accent-blue", dark ? "#8bb7ff" : "#376fca"),
  };
}

function escapeXml(value: string) {
  return value.replace(/[&<>\"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" })[char]!);
}

function primitivePath(ctx: CanvasRenderingContext2D, item: Primitive, offsetX = 0, offsetY = 0) {
  ctx.beginPath();
  if (item.type === "rect") {
    if (item.w <= 0 || item.h <= 0) return;
    const radius = Math.max(0, Math.min(item.radius ?? 0, item.w / 2, item.h / 2));
    if (ctx.roundRect) ctx.roundRect(item.x + offsetX, item.y + offsetY, item.w, item.h, radius);
    else ctx.rect(item.x + offsetX, item.y + offsetY, item.w, item.h);
  } else if (item.type === "circle") ctx.arc(item.x + offsetX, item.y + offsetY, item.r, 0, Math.PI * 2);
  else if (item.type === "line") { ctx.moveTo(item.x1 + offsetX, item.y1 + offsetY); ctx.lineTo(item.x2 + offsetX, item.y2 + offsetY); }
  else if (item.type === "path") {
    item.points.forEach((point, index) => index ? ctx.lineTo(point.x + offsetX, point.y + offsetY) : ctx.moveTo(point.x + offsetX, point.y + offsetY));
    if (item.closed) ctx.closePath();
  }
}

function strokePrimitive(ctx: CanvasRenderingContext2D, item: Primitive, style: StrokeStyle, bounds: NonNullable<GroupElement["componentBounds"]>) {
  if (item.type === "text") return;
  const width = item.type === "line" || item.type === "path" ? item.width ?? 1 : 1;
  const color = item.stroke ?? "transparent";
  if (color === "transparent") return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (style === "double" && (item.type === "line" || item.type === "path" && !item.closed)) {
    const points = item.type === "line" ? [{ x: item.x1, y: item.y1 }, { x: item.x2, y: item.y2 }] : item.points;
    const first = points[0]; const last = points[points.length - 1];
    if (first && last) {
      const dx = last.x - first.x; const dy = last.y - first.y; const length = Math.max(1, Math.hypot(dx, dy)); const gap = Math.max(1.5, width * 1.25); const ox = -dy / length * gap; const oy = dx / length * gap;
      ctx.setLineDash([]); primitivePath(ctx, item, ox, oy); ctx.stroke(); primitivePath(ctx, item, -ox, -oy); ctx.stroke();
    }
  } else {
    ctx.setLineDash(strokeDashPattern(style, width)); primitivePath(ctx, item); ctx.stroke();
    if (style === "double") {
      ctx.setLineDash([]); ctx.translate(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2); ctx.scale(.94, .94); ctx.translate(-(bounds.x + bounds.w / 2), -(bounds.y + bounds.h / 2));
      primitivePath(ctx, item); ctx.stroke();
    }
  }
  ctx.restore();
}

function svgPrimitiveStroke(style: StrokeStyle, width: number) {
  const dash = strokeDashPattern(style, width);
  return dash.length ? ` stroke-dasharray="${dash.join(" ")}"` : "";
}

function clampText(value: string, width: number, size: number) {
  const limit = Math.max(1, Math.floor(width / Math.max(1, size * .58)));
  return value.length > limit ? `${value.slice(0, Math.max(0, limit - 3)).trimEnd()}...` : value;
}

type Primitive =
  | { type: "rect"; x: number; y: number; w: number; h: number; fill: string; radius?: number; stroke?: string }
  | { type: "circle"; x: number; y: number; r: number; fill: string; stroke?: string }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; width?: number }
  | { type: "path"; points: { x: number; y: number }[]; fill?: string; stroke?: string; width?: number; closed?: boolean }
  | { type: "text"; value: string; x: number; y: number; width: number; size: number; fill: string; weight?: number; anchor?: "start" | "middle" | "end"; family?: string; italic?: boolean; underline?: boolean };

function componentTitle(group: GroupElement) {
  const meta = group.libraryComponent!;
  const kind = meta.kind;
  if (kind.startsWith("form-")) return meta.formTitle || (kind === "form-input" ? "Label" : kind === "form-select" ? "Choose an option" : kind === "form-textarea" ? "Message" : kind === "form-search" ? "Search" : kind === "form-date" ? "Date" : kind === "form-password" ? "Password" : kind === "form-email" ? "Email" : kind === "form-file" ? "Attachment" : kind === "form-slider" ? "Volume" : kind === "form-checkbox" ? "Preferences" : kind === "form-radio" ? "Choose an option" : kind === "form-toggle" ? "Notifications" : "Continue");
  return meta.guiProperties?.title ?? meta.label ?? "Content";
}

function buildPrimitives(group: GroupElement, theme: Theme): Primitive[] | undefined {
  const bounds = group.componentBounds;
  const meta = group.libraryComponent;
  if (!bounds || !meta || !isGuiComponentKind(meta.kind)) return undefined;
  const { x, y, w, h } = bounds;
  const style = styleFor(group, theme);
  const props = meta.guiProperties ?? defaultGuiComponentProperties(meta.kind) ?? {};
  const title = componentTitle(group);
  const textStyle = meta.textStyle;
  const size = Math.max(9, Math.min(14, meta.textStyle?.fontSize ?? 11, h * .32));
  const options = (meta.formOptions?.length ? meta.formOptions : ["First option", "Second option", "Third option"]).slice(0, 12);
  const p: Primitive[] = [];
  const rect = (rx: number, ry: number, rw: number, rh: number, fill = style.surface, radius = 5, stroke = style.edge) => p.push({ type: "rect", x: rx, y: ry, w: Math.max(0, rw), h: Math.max(0, rh), fill, radius, stroke });
  const line = (x1: number, y1: number, x2: number, y2: number, stroke = style.edge, width = 1) => p.push({ type: "line", x1, y1, x2, y2, stroke, width });
  const circle = (cx: number, cy: number, r: number, fill: string, stroke = style.edge) => p.push({ type: "circle", x: cx, y: cy, r: Math.max(1, r), fill, stroke });
  const text = (value: string, tx: number, ty: number, tw: number, font = size, fill = style.ink, weight = 500, anchor: "start" | "middle" | "end" = "start") => {
    if (tw < 2 || h < 5) return;
    const finalAlign = textStyle?.textAlign ?? (anchor === "middle" ? "center" : anchor === "end" ? "right" : "left");
    const left = anchor === "middle" ? tx - tw / 2 : anchor === "end" ? tx - tw : tx;
    const finalX = finalAlign === "center" ? left + tw / 2 : finalAlign === "right" ? left + tw : left;
    const fittedFont = Math.max(9, font);
    p.push({ type: "text", value: clampText(value, tw, fittedFont), x: finalX, y: ty, width: tw, size: fittedFont, fill: textStyle?.color ?? fill, weight: textStyle?.bold === undefined ? weight : textStyle.bold ? 700 : 400, anchor: finalAlign === "center" ? "middle" : finalAlign === "right" ? "end" : "start", family: componentFontFamily(textStyle?.fontFamily), italic: textStyle?.italic, underline: textStyle?.underline });
  };
  const inset = Math.max(5, Math.min(12, w * .06));

  if (meta.kind === "form-button") {
    const configuredFill = meta.styleOverrides?.fillColor;
    const fill = configuredFill === null ? "transparent" : configuredFill ?? style.accent;
    rect(x, y, w, h, fill, Math.min(7, h / 2));
    const buttonText = meta.textStyle?.color ?? (configuredFill === undefined ? theme === "dark" ? "#151b20" : "#ffffff" : style.ink);
    text(options[meta.selectedOption ?? 0] ?? "Continue", x + w / 2, y + h / 2, w - inset * 2, size, buttonText, 650, "middle");
  } else if (meta.kind === "form-input" || meta.kind === "form-select" || meta.kind === "form-search" || meta.kind === "form-date" || meta.kind === "form-password" || meta.kind === "form-email" || meta.kind === "form-file") {
    const position = props.titlePosition ?? "top";
    const horizontal = position === "left" || position === "right";
    const titleWidth = horizontal ? Math.min(w * .42, Math.max(34, title.length * size * .55)) : w - inset * 2;
    const fieldX = position === "left" ? x + titleWidth + 5 : x + 1;
    const fieldW = horizontal ? Math.max(18, w - titleWidth - 7) : w - 2;
    const titleX = position === "right" ? x + w - titleWidth : x + inset;
    const titleY = position === "top" ? y + Math.min(9, h * .19) : position === "bottom" ? y + h - Math.min(7, h * .14) : y + h / 2;
    const fieldY = position === "bottom" ? y + 1 : horizontal ? y + 1 : y + Math.min(17, h * .36);
    const fieldH = horizontal ? h - 2 : Math.max(14, h - Math.min(18, h * .38) - (position === "bottom" ? 0 : 0));
    text(title, titleX, titleY, titleWidth - inset * .25, Math.min(10, size), style.muted, 600);
    rect(fieldX, fieldY, fieldW, fieldH, style.surface, 5);
    const placeholder = meta.kind === "form-password" ? "••••••••" : props.placeholder ?? (meta.kind === "form-select" ? options[meta.selectedOption ?? 0] ?? "Choose an option" : meta.kind === "form-search" ? "Search" : meta.kind === "form-date" ? "Select a date" : meta.kind === "form-email" ? "name@example.com" : meta.kind === "form-file" ? "Choose a file" : "Enter text");
    text(placeholder, fieldX + inset * .45, fieldY + fieldH / 2, fieldW - inset * .8 - (meta.kind === "form-select" || meta.kind === "form-date" ? 17 : meta.kind === "form-file" ? 33 : 1), Math.min(11, size), style.muted);
    if (meta.kind === "form-select") { const ax = fieldX + fieldW - 9; const ay = fieldY + fieldH / 2; line(ax - 3, ay - 1, ax, ay + 2, style.muted, 1.4); line(ax, ay + 2, ax + 3, ay - 1, style.muted, 1.4); }
    if (meta.kind === "form-search") { const cx = fieldX + fieldW - 12; const cy = fieldY + fieldH / 2; circle(cx, cy, 3.5, "transparent", style.muted); line(cx + 2.5, cy + 2.5, cx + 5.5, cy + 5.5, style.muted, 1.2); }
    if (meta.kind === "form-date") { const cx = fieldX + fieldW - 16; const cy = fieldY + fieldH / 2 - 5; rect(cx, cy, 12, 11, "transparent", 2, style.muted); line(cx, cy + 3, cx + 12, cy + 3, style.muted); line(cx + 3, cy - 2, cx + 3, cy + 1, style.muted); line(cx + 9, cy - 2, cx + 9, cy + 1, style.muted); }
    if (meta.kind === "form-file") { const bx = fieldX + fieldW - 28; rect(bx, fieldY + 4, 24, Math.max(16, fieldH - 8), style.soft, 4); line(bx + 12, fieldY + fieldH * .35, bx + 12, fieldY + fieldH * .68, style.accent, 1.4); line(bx + 9, fieldY + fieldH * .45, bx + 12, fieldY + fieldH * .35, style.accent, 1.4); line(bx + 15, fieldY + fieldH * .45, bx + 12, fieldY + fieldH * .35, style.accent, 1.4); }
  } else if (meta.kind === "form-textarea") {
    const position = props.titlePosition ?? "top";
    const titleHeight = position === "top" ? Math.min(17, h * .22) : 0;
    text(title, x + inset, position === "bottom" ? y + h - 5 : y + Math.min(9, h * .16), w - inset * 2, Math.min(10, size), style.muted, 600);
    rect(x + 1, y + titleHeight + 1, w - 2, Math.max(12, h - titleHeight - (position === "bottom" ? 18 : 2)), style.surface, 5);
    text(props.placeholder ?? "Write a message", x + inset, y + titleHeight + 12, w - inset * 2, Math.min(10, size), style.muted, 450);
  } else if (meta.kind === "form-checkbox" || meta.kind === "form-radio") {
    const position = props.titlePosition ?? "top";
    const horizontalTitle = position === "left" || position === "right";
    const titleHeight = horizontalTitle ? 0 : Math.min(18, h * .28);
    const titleWidth = horizontalTitle ? Math.min(w * .38, Math.max(30, title.length * size * .55)) : w;
    const contentX = position === "left" ? x + titleWidth + 4 : x + 2;
    const contentW = horizontalTitle ? Math.max(20, w - titleWidth - 6) : w - 4;
    const contentY = position === "top" ? y + titleHeight : y + 2;
    text(title, position === "right" ? x + w - titleWidth : x + 3, horizontalTitle ? y + h / 2 : position === "bottom" ? y + h - 6 : y + 8, titleWidth - 4, Math.min(11, size), style.ink, 650);
    const columns = guiChoiceColumnCount(group, contentW);
    const columnGap = Math.max(0, Math.min(40, props.optionColumnGap ?? props.optionGap ?? 4));
    const rowGap = Math.max(0, Math.min(40, props.optionRowGap ?? props.optionGap ?? 4));
    const cellW = Math.max(1, (contentW - columnGap * (columns - 1)) / columns);
    const itemHeight = Math.max(11, size * 1.2);
    const rowPitch = itemHeight + rowGap;
    options.forEach((option, index) => {
      const col = index % columns; const row = Math.floor(index / columns);
      const cellX = contentX + col * (cellW + columnGap); const cy = contentY + row * rowPitch + itemHeight / 2;
      const markerSize = Math.min(10, Math.max(5, rowPitch * .62));
      const markerX = cellX + 2;
      const active = meta.kind === "form-checkbox" ? meta.formStates?.[index] ?? index === 0 : (meta.selectedOption ?? 0) === index;
      if (meta.kind === "form-checkbox") {
        rect(markerX, cy - markerSize / 2, markerSize, markerSize, active ? style.accent : style.surface, 2);
        if (active) { line(markerX + 2, cy, markerX + 4, cy + 2, "#ffffff", 1.3); line(markerX + 4, cy + 2, markerX + markerSize - 1, cy - 3, "#ffffff", 1.3); }
      } else {
        circle(markerX + markerSize / 2, cy, markerSize / 2, style.surface);
        if (active) circle(markerX + markerSize / 2, cy, markerSize * .22, style.accent, style.accent);
      }
      text(option, markerX + markerSize + 4, cy, Math.max(1, cellW - markerSize - 8), Math.min(10, size), style.ink);
    });
  } else if (meta.kind === "form-toggle") {
    const trackW = Math.min(36, Math.max(26, w * .24)); const trackH = Math.min(20, Math.max(15, h * .48)); const tx = x + w - trackW - inset; const ty = y + (h - trackH) / 2;
    text(title, x + inset, y + h / 2, tx - x - inset - 7, size, style.ink, 600);
    rect(tx, ty, trackW, trackH, meta.formState === false ? style.soft : style.accent, trackH / 2);
    circle(tx + (meta.formState === false ? trackH / 2 : trackW - trackH / 2), ty + trackH / 2, trackH * .34, theme === "dark" ? "#161b1f" : "#ffffff", "transparent");
  } else if (meta.kind === "form-slider") {
    text(title, x + inset, y + Math.min(10, h * .2), w - inset * 2, Math.min(10, size), style.ink, 600);
    const trackY = y + h * .68; const trackLeft = x + inset; const trackRight = x + w - inset; const ratio = Math.max(0, Math.min(1, (meta.selectedOption ?? 65) / 100));
    line(trackLeft, trackY, trackRight, trackY, style.soft, 5); line(trackLeft, trackY, trackLeft + (trackRight - trackLeft) * ratio, trackY, style.accent, 5); circle(trackLeft + (trackRight - trackLeft) * ratio, trackY, 5, style.surface, style.accent);
  } else if (meta.kind === "gui-card" && h < guiCardCompactThreshold(group)) {
    rect(x, y, w, h, style.surface, 6);
    const actionW = Math.min(64, Math.max(28, w * .28));
    const textWidth = Math.max(4, w - actionW - inset * 2 - 12);
    const titleWidth = textWidth * .42;
    text(title, x + inset, y + h / 2, titleWidth, Math.min(10, size, h * .36), style.ink, 650);
    text(props.bodyText ?? "Add a short description", x + inset + titleWidth + 6, y + h / 2, textWidth - titleWidth, Math.min(8, size, h * .3), style.muted, 450);
    rect(x + w - inset - actionW, y + Math.max(2, (h - Math.min(16, h - 4)) / 2), actionW, Math.min(16, h - 4), style.accent, 4);
    text(props.actionLabel ?? "Details", x + w - inset - actionW / 2, y + h / 2, actionW - 6, Math.min(8, h * .3), theme === "dark" ? "#151b20" : "#ffffff", 600, "middle");
  } else if (meta.kind === "gui-card") {
    rect(x, y, w, h, style.surface, 7);
    const imageH = Math.max(18, h * .32); rect(x + 1, y + 1, w - 2, imageH, style.soft, 6);
    const actionH = Math.min(17, Math.max(11, h * .15)); const actionY = y + h - actionH - 5;
    const rowGap = Math.max(0, Math.min(40, props.optionRowGap ?? props.optionGap ?? 4));
    text(title, x + inset, y + imageH + 12, w - inset * 2, Math.min(11, size), style.ink, 650);
    text(props.bodyText ?? "Add a short description", x + inset, Math.min(y + imageH + 21 + rowGap, actionY - 8), w - inset * 2, Math.min(9, size), style.muted, 450);
    const actionW = Math.min(70, w * .46); rect(x + inset, actionY, actionW, actionH, style.accent, 4);
    text(props.actionLabel ?? "Details", x + inset + actionW / 2, actionY + actionH / 2, actionW - 8, Math.min(8, actionH * .62), theme === "dark" ? "#151b20" : "#ffffff", 600, "middle");
  } else if (meta.kind === "gui-app-bar") {
    rect(x, y, w, h, style.surface, 4);
    const compact = w < 170; const logoSize = compact ? 10 : 14; const avatarRadius = compact ? 6 : 10; const avatarX = x + w - inset - avatarRadius;
    rect(x + inset, y + h / 2 - logoSize / 2, logoSize, logoSize, style.accent, 4);
    const titleX = x + inset + logoSize + 6; const titleRight = compact ? avatarX - avatarRadius - 5 : x + w - 68;
    text(title || "Workspace", titleX, y + h / 2, Math.max(8, titleRight - titleX), Math.min(size, h * .34), style.ink, 650);
    if (!compact) line(x + w - 61, y + 9, x + w - 61, y + h - 9);
    circle(avatarX, y + h / 2, avatarRadius, style.soft); text(props.actionLabel ?? "JD", avatarX, y + h / 2, avatarRadius * 2 - 2, compact ? 5 : 7, style.ink, 600, "middle");
  } else if (meta.kind === "gui-navigation") {
    rect(x, y, w, h, style.surface, 6);
    const items = (props.items?.length ? props.items : ["Overview", "Projects", "Reports", "Settings"]).slice(0, 12);
    if (h < 52) {
      text(title || "Workspace", x + inset, y + h / 2, w - inset * 2, Math.min(size, h * .36), style.ink, 650);
    } else {
    text(title || "Workspace", x + inset, y + 14, w - inset * 2, size, style.ink, 650);
    const rowGap = Math.max(0, Math.min(40, props.optionRowGap ?? props.optionGap ?? 4));
    const rowHeight = Math.min(27, Math.max(12, (h - 39 - rowGap * (items.length - 1)) / items.length));
    items.forEach((label, index) => {
      const yy = y + 34 + index * (rowHeight + rowGap); const active = index === (props.activeItem ?? 0);
      if (active) rect(x + 4, yy - rowHeight * .36, w - 8, rowHeight * .72, theme === "dark" ? "#34495f" : "#eaf1fb", 4, "transparent");
      circle(x + inset + 3, yy, 2.3, active ? style.accent : style.muted, "transparent");
      text(label, x + inset + 11, yy, w - inset * 2 - 11, Math.min(10, size), style.ink, active ? 600 : 450);
    });
    }
  } else if (meta.kind === "gui-tabs") {
    rect(x, y, w, h, style.surface, 4);
    const items = (props.items?.length ? props.items : ["Overview", "Activity", "Settings"]).slice(0, 8);
    const gap = Math.max(0, Math.min(40, props.optionColumnGap ?? props.optionGap ?? 4));
    const cell = Math.max(1, (w - gap * (items.length - 1)) / items.length);
    items.forEach((label, index) => { const active = index === (props.activeItem ?? 0); const left = x + cell * index + gap * index; const cx = left + cell / 2; text(label, cx, y + h / 2 - 2, cell - 8, Math.min(9, size), active ? style.accent : style.muted, active ? 650 : 500, "middle"); if (active) line(left + 7, y + h - 2, left + cell - 7, y + h - 2, style.accent, 2); });
  } else if (meta.kind === "gui-image") {
    rect(x, y, w, h, style.soft, 5);
    p.push({ type: "path", points: [{ x: x + w * .2, y: y + h * .76 }, { x: x + w * .43, y: y + h * .42 }, { x: x + w * .57, y: y + h * .58 }, { x: x + w * .68, y: y + h * .46 }, { x: x + w * .84, y: y + h * .76 }], fill: theme === "dark" ? "#404b55" : "#d9e2eb", closed: true });
    circle(x + w * .72, y + h * .3, Math.min(6, h * .08), style.accent, style.accent);
    text(props.placeholder ?? "Image", x + w / 2, y + h - 9, w - 8, Math.min(9, size), style.muted, 500, "middle");
  } else if (meta.kind === "gui-alert") {
    rect(x, y, w, h, style.soft, 6, style.edge); circle(x + 14, y + 17, 6, style.accent, style.accent); text("i", x + 14, y + 17, 10, 8, "#ffffff", 700, "middle");
    text(title, x + 26, y + 15, w - 36, Math.min(10, size), style.ink, 650); text(props.bodyText ?? "Your changes are saved.", x + 10, y + h - 15, w - 20, Math.min(9, size), style.muted, 450);
  } else if (meta.kind === "gui-modal") {
    rect(x, y, w, h, style.soft, 8, style.edge); rect(x + 7, y + 7, w - 14, h - 14, style.surface, 6, style.edge);
    text(title, x + 17, y + 26, w - 34, Math.min(13, size + 1), style.ink, 650); text(props.bodyText ?? "Review this change before continuing.", x + 17, y + h * .53, w - 34, Math.min(9, size), style.muted, 450);
    const actionW = Math.min(86, w * .3); rect(x + w - actionW - 17, y + h - 34, actionW, 19, style.accent, 4, style.accent); text(props.actionLabel ?? "Continue", x + w - actionW / 2 - 17, y + h - 24, actionW - 8, 8, theme === "dark" ? "#151b20" : "#ffffff", 600, "middle");
  } else if (meta.kind === "gui-breadcrumbs") {
    const items = (props.items?.length ? props.items : ["Home", "Projects", "Current"]).slice(0, 5); const cellW = (w - inset * 2) / items.length;
    items.forEach((item, index) => { const left = x + inset + index * cellW; text(item, left, y + h / 2, cellW - 8, Math.min(9, size), index === (props.activeItem ?? items.length - 1) ? style.ink : style.muted, index === (props.activeItem ?? items.length - 1) ? 650 : 450); if (index < items.length - 1) text("/", left + cellW - 5, y + h / 2, 8, 9, style.muted, 450, "middle"); });
  } else if (meta.kind === "gui-avatar") {
    const radius = Math.min(w, h) * .43; circle(x + w / 2, y + h / 2, radius, style.soft, style.edge); text(title.slice(0, 3).toUpperCase(), x + w / 2, y + h / 2, radius * 1.5, Math.min(12, size), style.ink, 650, "middle");
  } else if (meta.kind === "gui-badge") {
    const labelWidth = Math.min(w, Math.max(42, title.length * size * .65 + 18)); const labelX = x + (w - labelWidth) / 2; rect(labelX, y + 3, labelWidth, h - 6, style.soft, (h - 6) / 2, style.edge); circle(labelX + 9, y + h / 2, 2.5, style.accent, style.accent); text(title, labelX + 15, y + h / 2, labelWidth - 20, Math.min(9, size), style.ink, 600);
  } else if (meta.kind === "gui-progress") {
    text(title, x + inset, y + 11, w - inset * 2, Math.min(10, size), style.ink, 600); const trackY = y + h * .67; const trackX = x + inset; const trackW = w - inset * 2; rect(trackX, trackY, trackW, 8, style.soft, 4, "transparent"); rect(trackX, trackY, trackW * .68, 8, style.accent, 4, "transparent"); text("68%", x + w - inset, y + 11, 35, Math.min(9, size), style.muted, 500, "end");
  } else if (meta.kind === "gui-list" || meta.kind === "gui-menu" || meta.kind === "gui-accordion") {
    rect(x, y, w, h, style.surface, 5); text(title, x + inset, y + 13, w - inset * 2, size, style.ink, 650);
    const items = (props.items?.length ? props.items : ["First item", "Second item", "Third item"]).slice(0, 12);
    const gap = Math.max(0, Math.min(40, props.optionRowGap ?? props.optionGap ?? 3)); const rowHeight = Math.min(24, Math.max(13, (h - 28 - gap * (items.length - 1)) / items.length));
    items.forEach((item, index) => { const yy = y + 27 + index * (rowHeight + gap); if (meta.kind === "gui-accordion") rect(x + 5, yy, w - 10, rowHeight, style.soft, 3, "transparent"); if (meta.kind === "gui-menu" && index === (props.activeItem ?? 0)) rect(x + 4, yy, w - 8, rowHeight, style.soft, 3, "transparent"); if (meta.kind === "gui-list") circle(x + inset + 3, yy + rowHeight / 2, 2.5, style.accent, "transparent"); text(item, x + inset + (meta.kind === "gui-list" ? 10 : 2), yy + rowHeight / 2, w - inset * 2 - 12, Math.min(10, size), style.ink, meta.kind === "gui-menu" && index === (props.activeItem ?? 0) ? 600 : 450); if (meta.kind === "gui-accordion") { const ax = x + w - 13; const ay = yy + rowHeight / 2; line(ax - 3, ay - 1, ax, ay + 2, style.muted); line(ax, ay + 2, ax + 3, ay - 1, style.muted); } });
  } else if (meta.kind === "gui-table") {
    const items = (props.items?.length ? props.items : ["Name", "Type", "Status", "Item", "Text", "Active"]).slice(0, 12); const cols = 3; const rows = Math.max(2, Math.ceil(items.length / cols)); const rowH = h / rows; const colW = w / cols;
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) { const index = row * cols + col; const cellX = x + col * colW; const cellY = y + row * rowH; rect(cellX, cellY, colW, rowH, row === 0 ? style.soft : style.surface, 0, style.edge); text(items[index] ?? "—", cellX + 5, cellY + rowH / 2, colW - 10, Math.min(9, size), row === 0 ? style.ink : style.muted, row === 0 ? 650 : 450); }
  } else if (meta.kind === "gui-toast") {
    rect(x, y, w, h, style.surface, 6); circle(x + 16, y + h / 2, 6, style.accent, style.accent); text("✓", x + 16, y + h / 2, 10, 8, theme === "dark" ? "#151b20" : "#ffffff", 700, "middle"); text(title, x + 30, y + h * .39, w - 42, Math.min(10, size), style.ink, 650); text(props.bodyText ?? "Your work is up to date.", x + 30, y + h * .7, w - 42, Math.min(9, size), style.muted, 450); text("×", x + w - 12, y + 12, 10, 12, style.muted, 500, "middle");
  } else if (meta.kind === "gui-pagination") {
    const items = (props.items?.length ? props.items : ["1", "2", "3"]).slice(0, 8); const gap = 4; const buttonW = Math.min(30, (w - inset * 2 - gap * (items.length + 1)) / (items.length + 2)); let bx = x + inset;
    for (const label of ["‹", ...items, "›"]) { const active = label === items[props.activeItem ?? 0]; rect(bx, y + (h - 26) / 2, buttonW, 26, active ? style.soft : style.surface, 4, active ? style.accent : style.edge); text(label, bx + buttonW / 2, y + h / 2, buttonW - 4, Math.min(10, size), active ? style.accent : style.ink, active ? 650 : 450, "middle"); bx += buttonW + gap; }
  } else if (meta.kind === "gui-divider") {
    line(x + inset, y + h / 2, x + w - inset, y + h / 2, style.edge, 1);
  } else if (meta.kind === "gui-footer") {
    line(x, y + 1, x + w, y + 1, style.edge); text(title, x + inset, y + h / 2, Math.max(40, w * .42), Math.min(9, size), style.muted, 500);
    const items = (props.items?.length ? props.items : ["Help", "Privacy", "Terms"]).slice(0, 6); const cellW = Math.max(1, w * .5 / items.length);
    items.forEach((item, index) => text(item, x + w * .5 + index * cellW, y + h / 2, cellW - 4, Math.min(9, size), style.muted, 450, "middle"));
  }
  return p;
}

export function guiOptionIndexAtPoint(group: GroupElement, point: Point): number | undefined {
  const bounds = group.componentBounds;
  const meta = group.libraryComponent;
  if (!bounds || !meta || (meta.kind !== "form-checkbox" && meta.kind !== "form-radio")) return undefined;
  const options = meta.formOptions?.length ? meta.formOptions.slice(0, 12) : ["First option", "Second option", "Third option"];
  const props = meta.guiProperties ?? defaultGuiComponentProperties(meta.kind) ?? {};
  const { x, y, w, h } = bounds;
  const title = componentTitle(group);
  const size = Math.max(9, Math.min(14, meta.textStyle?.fontSize ?? 11, h * .32));
  const position = props.titlePosition ?? "top";
  const horizontalTitle = position === "left" || position === "right";
  const titleHeight = horizontalTitle ? 0 : Math.min(18, h * .28);
  const titleWidth = horizontalTitle ? Math.min(w * .38, Math.max(30, title.length * size * .55)) : w;
  const contentX = position === "left" ? x + titleWidth + 4 : x + 2;
  const contentW = horizontalTitle ? Math.max(20, w - titleWidth - 6) : w - 4;
  const contentY = position === "top" ? y + titleHeight : y + 2;
  const contentH = Math.max(10, h - titleHeight - (position === "bottom" ? 15 : 2));
  if (point.x < contentX || point.x > contentX + contentW || point.y < contentY || point.y > contentY + contentH) return undefined;
  const columns = guiChoiceColumnCount(group, contentW);
  const rows = Math.ceil(options.length / columns);
  const columnGap = Math.max(0, Math.min(40, props.optionColumnGap ?? props.optionGap ?? 4));
  const rowGap = Math.max(0, Math.min(40, props.optionRowGap ?? props.optionGap ?? 4));
  const cellW = Math.max(1, (contentW - columnGap * (columns - 1)) / columns);
  const itemHeight = Math.max(11, size * 1.2);
  const rowPitch = itemHeight + rowGap;
  const relativeX = point.x - contentX; const relativeY = point.y - contentY;
  const column = Math.floor(relativeX / (cellW + columnGap));
  const row = Math.floor(relativeY / rowPitch);
  if (column < 0 || column >= columns || relativeX - column * (cellW + columnGap) > cellW || row < 0 || row >= rows || relativeY - row * rowPitch > itemHeight) return undefined;
  const index = row * columns + column;
  return index >= 0 && index < options.length ? index : undefined;
}

export function drawGuiComponent(ctx: CanvasRenderingContext2D, group: GroupElement, theme: Theme) {
  const bounds = group.componentBounds;
  const primitives = buildPrimitives(group, theme);
  if (!bounds || !primitives) return false;
  const lineStyle = group.libraryComponent?.styleOverrides?.lineStyle ?? "solid";
  ctx.save(); ctx.beginPath(); ctx.rect(bounds.x - 1, bounds.y - 1, bounds.w + 2, bounds.h + 2); ctx.clip();
  for (const item of primitives) {
    if (item.type === "rect" || item.type === "circle") { primitivePath(ctx, item); ctx.fillStyle = item.fill; ctx.fill(); strokePrimitive(ctx, item, lineStyle, bounds); }
    else if (item.type === "line") strokePrimitive(ctx, item, lineStyle, bounds);
    else if (item.type === "path") { primitivePath(ctx, item); if (item.fill) { ctx.fillStyle = item.fill; ctx.fill(); } if (item.stroke) strokePrimitive(ctx, item, lineStyle, bounds); }
    else {
      const size = Math.max(9, item.size); const family = item.family as FontFamily | undefined; const weight = item.weight ?? 500;
      ctx.fillStyle = item.fill; ctx.font = componentFont(size, weight, family, item.italic); ctx.textAlign = item.anchor === "middle" ? "center" : item.anchor === "end" ? "right" : "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText(item.value, item.x, item.y + componentBaselineOffset(size, weight, family, item.italic), item.width);
      if (item.underline) { const measured = Math.min(item.width, ctx.measureText(item.value).width); const start = item.anchor === "middle" ? item.x - measured / 2 : item.anchor === "end" ? item.x - measured : item.x; ctx.fillRect(start, item.y + size * .36, measured, Math.max(1, size / 14)); }
    }
  }
  ctx.restore();
  return true;
}

export function guiComponentSvg(group: GroupElement, theme: Theme = "light") {
  const primitives = buildPrimitives(group, theme);
  const meta = group.libraryComponent;
  if (!primitives || !meta) return undefined;
  const bounds = group.componentBounds!;
  const centerX = bounds.x + bounds.w / 2; const centerY = bounds.y + bounds.h / 2;
  const doubleTransform = `translate(${centerX} ${centerY}) scale(.94) translate(${-centerX} ${-centerY})`;
  const content = primitives.map(item => {
    const lineStyle = meta.styleOverrides?.lineStyle ?? "solid";
    if (item.type === "rect") {
      const stroke = item.stroke && item.stroke !== "transparent" ? ` stroke="${item.stroke}" stroke-width="1"${svgPrimitiveStroke(lineStyle, 1)}` : "";
      const outer = `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" rx="${Math.min(item.radius ?? 0, item.w / 2, item.h / 2)}" fill="${item.fill}"${stroke}/>`;
      return outer + (lineStyle === "double" && stroke ? `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" rx="${Math.min(item.radius ?? 0, item.w / 2, item.h / 2)}" transform="${doubleTransform}" fill="none" stroke="${item.stroke}" stroke-width="1"/>` : "");
    }
    if (item.type === "circle") {
      const stroke = item.stroke && item.stroke !== "transparent" ? ` stroke="${item.stroke}" stroke-width="1"${svgPrimitiveStroke(lineStyle, 1)}` : "";
      const outer = `<circle cx="${item.x}" cy="${item.y}" r="${item.r}" fill="${item.fill}"${stroke}/>`;
      return outer + (lineStyle === "double" && stroke ? `<circle cx="${item.x}" cy="${item.y}" r="${item.r}" transform="${doubleTransform}" fill="none" stroke="${item.stroke}" stroke-width="1"/>` : "");
    }
    if (item.type === "line") {
      const width = item.width ?? 1; const dx = item.x2 - item.x1; const dy = item.y2 - item.y1; const length = Math.max(1, Math.hypot(dx, dy)); const gap = Math.max(1.5, width * 1.25); const ox = -dy / length * gap; const oy = dx / length * gap;
      const stroke = `fill="none" stroke="${item.stroke}" stroke-width="${width}" stroke-linecap="round"`;
      return lineStyle === "double" ? `<path d="M ${item.x1 + ox} ${item.y1 + oy} L ${item.x2 + ox} ${item.y2 + oy}" ${stroke}/><path d="M ${item.x1 - ox} ${item.y1 - oy} L ${item.x2 - ox} ${item.y2 - oy}" ${stroke}/>` : `<path d="M ${item.x1} ${item.y1} L ${item.x2} ${item.y2}" ${stroke}${svgPrimitiveStroke(lineStyle, width)}/>`;
    }
    if (item.type === "path") {
      const d = item.points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ") + (item.closed ? " Z" : "");
      const width = item.width ?? 1; const stroke = item.stroke ? ` stroke="${item.stroke}" stroke-width="${width}"${svgPrimitiveStroke(lineStyle, width)}` : "";
      const outer = `<path d="${d}"${item.fill ? ` fill="${item.fill}"` : ` fill="none"`}${stroke}/>`;
      if (!item.stroke || lineStyle !== "double") return outer;
      if (item.closed) return `${outer}<path d="${d}" transform="${doubleTransform}" fill="none" stroke="${item.stroke}" stroke-width="${width}"/>`;
      const first = item.points[0]; const last = item.points[item.points.length - 1];
      if (!first || !last) return outer;
      const dx = last.x - first.x; const dy = last.y - first.y; const length = Math.max(1, Math.hypot(dx, dy)); const gap = Math.max(1.5, width * 1.25); const ox = -dy / length * gap; const oy = dx / length * gap;
      const pathAt = (x: number, y: number) => item.points.map((point, index) => `${index ? "L" : "M"} ${point.x + x} ${point.y + y}`).join(" ");
      return `<path d="${pathAt(ox, oy)}" fill="none" stroke="${item.stroke}" stroke-width="${width}"/><path d="${pathAt(-ox, -oy)}" fill="none" stroke="${item.stroke}" stroke-width="${width}"/>`;
    }
    return `<text x="${item.x}" y="${item.y}" text-anchor="${item.anchor ?? "start"}" dominant-baseline="middle" fill="${item.fill}" font-family="${escapeXml(componentFontFamily(item.family as FontFamily | undefined))}" font-size="${Math.max(9, item.size)}" font-weight="${item.weight ?? 500}"${item.italic ? ` font-style="italic"` : ""}${item.underline ? ` text-decoration="underline"` : ""}>${escapeXml(item.value)}</text>`;
  }).join("");
  return `<g data-component="${meta.kind}">${content}</g>`;
}
