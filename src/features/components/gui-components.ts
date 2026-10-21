import type { GuiComponentProperties, GroupElement, Point, Theme } from "../../model";

export type GuiComponentKind =
  | "form-button" | "form-input" | "form-select" | "form-checkbox" | "form-radio" | "form-toggle"
  | "gui-card" | "gui-app-bar" | "gui-navigation" | "gui-tabs" | "gui-image";

function componentFontFamily(family?: string) {
  return family === "hand" ? "'Comic Sans MS', 'Segoe Print', cursive" : family === "serif" ? "Georgia, 'Times New Roman', serif" : family === "mono" ? "'Cascadia Mono', Consolas, monospace" : family === "rounded" ? "'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif" : family === "display" ? "'Arial Black', Impact, sans-serif" : "system-ui, 'Segoe UI', sans-serif";
}

export const GUI_COMPONENT_DEFINITIONS: { kind: GuiComponentKind; section: string; label: string; description: string; width: number; height: number }[] = [
  { kind: "form-button", section: "Forms & UI | Controls", label: "Button", description: "Compact primary action button", width: 100, height: 50 },
  { kind: "form-input", section: "Forms & UI | Fields", label: "Text field", description: "Compact labeled text input", width: 175, height: 50 },
  { kind: "form-select", section: "Forms & UI | Fields", label: "Select field", description: "Compact labeled selection field", width: 175, height: 50 },
  { kind: "form-checkbox", section: "Forms & UI | Choices", label: "Checkbox group", description: "Compact list of selectable options", width: 150, height: 75 },
  { kind: "form-radio", section: "Forms & UI | Choices", label: "Radio group", description: "Compact single-choice list", width: 150, height: 75 },
  { kind: "form-toggle", section: "Forms & UI | Choices", label: "Toggle switch", description: "Compact settings switch", width: 150, height: 50 },
  { kind: "gui-card", section: "Forms & UI | Layout", label: "Content card", description: "Card with image, title, copy, and action", width: 175, height: 125 },
  { kind: "gui-app-bar", section: "Forms & UI | Layout", label: "App bar", description: "Header bar with brand and account controls", width: 250, height: 50 },
  { kind: "gui-navigation", section: "Forms & UI | Layout", label: "Side navigation", description: "Navigation rail with active page", width: 150, height: 150 },
  { kind: "gui-tabs", section: "Forms & UI | Layout", label: "Tab bar", description: "Horizontal navigation tabs", width: 200, height: 50 },
  { kind: "gui-image", section: "Forms & UI | Media", label: "Image placeholder", description: "Replaceable media area for a wireframe", width: 150, height: 100 },
];

const GUI_KINDS = new Set<string>(GUI_COMPONENT_DEFINITIONS.map(item => item.kind));
export const isGuiComponentKind = (kind: string): kind is GuiComponentKind => GUI_KINDS.has(kind);

export function defaultGuiComponentProperties(kind: string): GuiComponentProperties | undefined {
  if (kind === "form-input") return { titlePosition: "top", placeholder: "Enter text" };
  if (kind === "form-select") return { titlePosition: "top", placeholder: "Choose an option" };
  if (kind === "form-checkbox" || kind === "form-radio") return { titlePosition: "top", optionLayout: "vertical", optionColumns: 2, optionGap: 4 };
  if (kind === "gui-card") return { title: "Card title", bodyText: "Add a short description", actionLabel: "Details" };
  if (kind === "gui-app-bar") return { title: "Workspace", actionLabel: "JD" };
  if (kind === "gui-navigation") return { title: "Workspace", items: ["Overview", "Projects", "Reports", "Settings"], activeItem: 0 };
  if (kind === "gui-tabs") return { items: ["Overview", "Activity", "Settings"], activeItem: 0 };
  if (kind === "gui-image") return { placeholder: "Image" };
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
  const fontSize = Math.max(5, Math.min(14, meta.textStyle?.fontSize ?? 11, 25 * .32));
  const titleWidth = horizontalTitle ? Math.min(bounds.w * .38, Math.max(30, (meta.formTitle ?? "Choose an option").length * fontSize * .55)) : bounds.w;
  const contentWidth = horizontalTitle ? Math.max(20, bounds.w - titleWidth - 6) : bounds.w - 4;
  const columns = guiChoiceColumnCount(group, contentWidth);
  const rows = Math.ceil(options.length / columns);
  const rowGap = Math.max(0, Math.min(40, props.optionRowGap ?? props.optionGap ?? 4));
  const titleHeight = horizontalTitle ? 0 : position === "bottom" ? 15 : 18;
  return Math.max(25, titleHeight + rows * 11 + (rows - 1) * rowGap + 6);
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
  const safe = (value: string | null | undefined, fallback: string) => value && /^(#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i.test(value) ? value : fallback;
  const overrides = group.libraryComponent?.styleOverrides;
  return {
    ink: safe(overrides?.color, dark ? "#e7ebef" : "#27313a"),
    muted: dark ? "#aab4bf" : "#6d7883",
    edge: safe(overrides?.color, dark ? "#59636d" : "#d3dbe3"),
    surface: safe(overrides?.fillColor, dark ? "#20262c" : "#ffffff"),
    soft: dark ? "#2a323a" : "#f2f5f8",
    accent: dark ? "#8bb7ff" : "#376fca",
  };
}

function escapeXml(value: string) {
  return value.replace(/[&<>\"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" })[char]!);
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
  if (kind.startsWith("form-")) return meta.formTitle || (kind === "form-input" ? "Label" : kind === "form-select" ? "Choose an option" : kind === "form-checkbox" ? "Preferences" : kind === "form-radio" ? "Choose an option" : kind === "form-toggle" ? "Notifications" : "Continue");
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
  const size = Math.max(5, Math.min(14, meta.textStyle?.fontSize ?? 11, h * .32));
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
    p.push({ type: "text", value: clampText(value, tw, font), x: finalX, y: ty, width: tw, size: font, fill: textStyle?.color ?? fill, weight: textStyle?.bold === undefined ? weight : textStyle.bold ? 700 : 400, anchor: finalAlign === "center" ? "middle" : finalAlign === "right" ? "end" : "start", family: componentFontFamily(textStyle?.fontFamily), italic: textStyle?.italic, underline: textStyle?.underline });
  };
  const inset = Math.max(5, Math.min(12, w * .06));

  if (meta.kind === "form-button") {
    const fill = meta.styleOverrides?.fillColor && meta.styleOverrides.fillColor !== "transparent" ? style.surface : style.accent;
    rect(x, y, w, h, fill, Math.min(7, h / 2));
    text(options[meta.selectedOption ?? 0] ?? "Continue", x + w / 2, y + h / 2, w - inset * 2, size, theme === "dark" ? "#151b20" : "#ffffff", 650, "middle");
  } else if (meta.kind === "form-input" || meta.kind === "form-select") {
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
    const placeholder = props.placeholder ?? (meta.kind === "form-select" ? options[meta.selectedOption ?? 0] ?? "Choose an option" : "Enter text");
    text(placeholder, fieldX + inset * .45, fieldY + fieldH / 2, fieldW - inset * .8 - (meta.kind === "form-select" ? 17 : 1), Math.min(11, size), style.muted);
    if (meta.kind === "form-select") { const ax = fieldX + fieldW - 9; const ay = fieldY + fieldH / 2; line(ax - 3, ay - 1, ax, ay + 2, style.muted, 1.4); line(ax, ay + 2, ax + 3, ay - 1, style.muted, 1.4); }
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
  const size = Math.max(5, Math.min(14, meta.textStyle?.fontSize ?? 11, h * .32));
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
  ctx.save(); ctx.beginPath(); ctx.rect(bounds.x - 1, bounds.y - 1, bounds.w + 2, bounds.h + 2); ctx.clip();
  for (const item of primitives) {
    if (item.type === "rect") { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(item.x, item.y, item.w, item.h, Math.min(item.radius ?? 0, item.w / 2, item.h / 2)) : ctx.rect(item.x, item.y, item.w, item.h); ctx.fillStyle = item.fill; ctx.fill(); if (item.stroke && item.stroke !== "transparent") { ctx.strokeStyle = item.stroke; ctx.lineWidth = 1; ctx.stroke(); } }
    else if (item.type === "circle") { ctx.beginPath(); ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2); ctx.fillStyle = item.fill; ctx.fill(); if (item.stroke && item.stroke !== "transparent") { ctx.strokeStyle = item.stroke; ctx.lineWidth = 1; ctx.stroke(); } }
    else if (item.type === "line") { ctx.beginPath(); ctx.moveTo(item.x1, item.y1); ctx.lineTo(item.x2, item.y2); ctx.strokeStyle = item.stroke; ctx.lineWidth = item.width ?? 1; ctx.stroke(); }
    else if (item.type === "path") { ctx.beginPath(); item.points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); if (item.closed) ctx.closePath(); if (item.fill) { ctx.fillStyle = item.fill; ctx.fill(); } if (item.stroke) { ctx.strokeStyle = item.stroke; ctx.lineWidth = item.width ?? 1; ctx.stroke(); } }
    else {
      ctx.fillStyle = item.fill; ctx.font = `${item.italic ? "italic " : ""}${item.weight ?? 500} ${item.size}px ${item.family ?? "system-ui, sans-serif"}`; ctx.textAlign = item.anchor === "middle" ? "center" : item.anchor === "end" ? "right" : "left"; ctx.textBaseline = "middle"; ctx.fillText(item.value, item.x, item.y, item.width);
      if (item.underline) { const measured = Math.min(item.width, ctx.measureText(item.value).width); const start = item.anchor === "middle" ? item.x - measured / 2 : item.anchor === "end" ? item.x - measured : item.x; ctx.fillRect(start, item.y + item.size * .36, measured, Math.max(1, item.size / 14)); }
    }
  }
  ctx.restore();
  return true;
}

export function guiComponentSvg(group: GroupElement) {
  const primitives = buildPrimitives(group, "light");
  const meta = group.libraryComponent;
  if (!primitives || !meta) return undefined;
  const content = primitives.map(item => {
    if (item.type === "rect") return `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" rx="${Math.min(item.radius ?? 0, item.w / 2, item.h / 2)}" fill="${item.fill}"${item.stroke && item.stroke !== "transparent" ? ` stroke="${item.stroke}" stroke-width="1"` : ""}/>`;
    if (item.type === "circle") return `<circle cx="${item.x}" cy="${item.y}" r="${item.r}" fill="${item.fill}"${item.stroke && item.stroke !== "transparent" ? ` stroke="${item.stroke}" stroke-width="1"` : ""}/>`;
    if (item.type === "line") return `<path d="M ${item.x1} ${item.y1} L ${item.x2} ${item.y2}" fill="none" stroke="${item.stroke}" stroke-width="${item.width ?? 1}" stroke-linecap="round"/>`;
    if (item.type === "path") { const d = item.points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ") + (item.closed ? " Z" : ""); return `<path d="${d}"${item.fill ? ` fill="${item.fill}"` : ` fill="none"`}${item.stroke ? ` stroke="${item.stroke}" stroke-width="${item.width ?? 1}"` : ""}/>`; }
    return `<text x="${item.x}" y="${item.y}" text-anchor="${item.anchor ?? "start"}" dominant-baseline="middle" fill="${item.fill}" font-family="${escapeXml(item.family ?? "system-ui, sans-serif")}" font-size="${item.size}" font-weight="${item.weight ?? 500}"${item.italic ? ` font-style="italic"` : ""}${item.underline ? ` text-decoration="underline"` : ""}>${escapeXml(item.value)}</text>`;
  }).join("");
  return `<g data-component="${meta.kind}" data-id="${escapeXml(group.id ?? "")}">${content}</g>`;
}
