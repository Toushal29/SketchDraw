import type { GroupElement, Theme } from "../../model";
import { proposalComponentForKind } from "./proposal-components";

type Point = { x: number; y: number };
type Primitive =
  | { type: "rect"; x: number; y: number; w: number; h: number; fill: string; stroke: string; radius?: number | [number, number, number, number]; dash?: string }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; width?: number; dash?: string }
  | { type: "path"; points: Point[]; stroke: string; width?: number; fill?: string; close?: boolean }
  | { type: "circle"; x: number; y: number; r: number; fill: string; stroke?: string }
  | { type: "text"; value: string; x: number; y: number; w: number; size: number; weight: number; color: string; align?: "left" | "center" | "right"; maxLines?: number };
type Palette = { ink: string; edge: string; fill: string; soft: string; muted: string; accent: string; red: string; green: string };

function split(value: string, limit = 6): string[] {
  return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, limit);
}

function fieldsFor(group: GroupElement): Record<string, string> {
  return Object.fromEntries((group.libraryComponent?.componentFields ?? []).map(field => [field.key, field.value.trim()]));
}

function makeScene(group: GroupElement, theme: Theme): { primitives: Primitive[]; bounds: { x: number; y: number; w: number; h: number } } | undefined {
  const bounds = group.componentBounds; const kind = group.libraryComponent?.kind;
  const definition = kind ? proposalComponentForKind(kind) : undefined;
  if (!bounds || !kind || !definition?.section.startsWith("Wireframing") || definition.archetype === "connector") return undefined;
  const { x, y, w, h } = bounds; const primitives: Primitive[] = []; const fields = fieldsFor(group); const dark = theme === "dark";
  const palette: Palette = {
    ink: dark ? "#edf1f4" : "#252a2e",
    edge: group.libraryComponent?.styleOverrides?.color ?? (dark ? "#9ba8b3" : "#4b5560"),
    fill: group.libraryComponent?.styleOverrides?.fillColor === null ? "none" : group.libraryComponent?.styleOverrides?.fillColor ?? group.container?.background ?? (dark ? "#252a32" : "#ffffff"),
    soft: dark ? "#343e49" : "#eef1f3", muted: dark ? "#aab4be" : "#65717b",
    accent: dark ? "#8ebbea" : "#2875b8", red: dark ? "#a55252" : "#b83e3e", green: dark ? "#53866c" : "#42845b",
  };
  const { ink, edge, fill, soft, muted, accent } = palette;
  const value = (key: string, fallback = "") => fields[key]?.trim() || fallback;
  const rect = (rx: number, ry: number, rw: number, rh: number, color = fill, radius: number | [number, number, number, number] = 0, stroke = edge, dash?: string) => primitives.push({ type: "rect", x: rx, y: ry, w: rw, h: rh, fill: color, stroke, radius, dash });
  const line = (x1: number, y1: number, x2: number, y2: number, stroke = edge, width = 1, dash?: string) => primitives.push({ type: "line", x1, y1, x2, y2, stroke, width, dash });
  const path = (points: Point[], stroke = edge, width = 1, color?: string, close = false) => primitives.push({ type: "path", points, stroke, width, fill: color, close });
  const circle = (cx: number, cy: number, radius: number, color = accent, stroke = edge) => primitives.push({ type: "circle", x: cx, y: cy, r: radius, fill: color, stroke });
  const text = (copy: string, tx: number, ty: number, width: number, size = 9, weight = 400, color = ink, align: "left" | "center" | "right" = "left", maxLines = 2) => primitives.push({ type: "text", value: copy, x: tx, y: ty, w: width, size, weight, color, align, maxLines });
  const titleBar = (caption = definition.label, barHeight = 25, radius = 4) => {
    // The outer card owns the stroke; the header should only fill its inset area.
    rect(x + 1, y + 1, w - 2, barHeight, soft, [radius, radius, 0, 0], "none");
    text(caption, x + 9, y + 6, w - 18, 10, 700, ink, "left", 1);
    line(x + 1, y + barHeight + 1, x + w - 1, y + barHeight + 1, edge);
  };
  const shell = (caption = definition.label, radius = 5) => {
    rect(x + .75, y + .75, w - 1.5, h - 1.5, fill, radius, edge);
    titleBar(caption, 25, Math.max(0, radius - 1));
  };
  const lines = (raw: string, fallback: string[], limit = 5) => split(raw, limit).length ? split(raw, limit) : fallback;
  const regionRows = (raw: string, left: number, top: number, width: number, height: number, fallback = ["Heading", "Main content", "Supporting details"], max = 4) => {
    const entries = lines(raw, fallback, max); const rowHeight = Math.max(14, height / entries.length);
    entries.forEach((entry, index) => {
      const yy = top + index * rowHeight; const rowH = Math.max(10, Math.min(34, rowHeight - 4));
      rect(left, yy, width, rowH, index === 0 ? soft : fill, 3, edge);
      text(entry, left + 6, yy + 4, width - 12, 7, index === 0 ? 650 : 400, index === 0 ? ink : muted, "left", 2);
    });
  };
  const button = (label: string, bx: number, by: number, bw: number, bh = 19, primary = true) => {
    rect(bx, by, bw, bh, primary ? accent : soft, 4, primary ? accent : edge);
    text(label, bx + 4, by + 4, bw - 8, 7, 650, primary ? "#ffffff" : ink, "center", 1);
  };

  if (/responsive-screen-frame|browser-window|device-frame|application-window|screen-frame/.test(kind)) {
    const browser = kind.endsWith("browser-window"); const mobile = kind.endsWith("mobile-device-frame"); const tablet = kind.endsWith("tablet-device-frame"); const desktop = kind.endsWith("desktop-application-window");
    const device = mobile || tablet; const viewport = value("viewport", mobile ? "390 × 844 · mobile" : tablet ? "820 × 1180 · tablet" : desktop ? "1440 × 900 · desktop" : "1280 × 800 · responsive");
    const state = value("state", "Default state"); const content = value("content"); const access = value("accessibility", "Keyboard · visible focus");
    if (device) {
      const outerPad = mobile ? Math.min(11, w * .06) : Math.min(10, w * .035); const screenX = x + outerPad; const screenY = y + (mobile ? 15 : 10); const screenW = w - outerPad * 2; const screenH = h - (mobile ? 30 : 20);
      rect(x + 2, y + 2, w - 4, h - 4, dark ? "#15191e" : "#fafbfc", mobile ? Math.min(w * .12, 30) : 14, edge);
      rect(screenX, screenY, screenW, screenH, fill, mobile ? 17 : 9, edge);
      if (mobile) { rect(x + w * .37, y + 6, w * .26, 4, edge, 3, edge); circle(x + w * .74, y + 8, 2, edge, edge); }
      else { circle(x + w / 2, y + 6, 2, edge, edge); line(x + w / 2 - 9, y + 6, x + w / 2 + 9, y + 6, edge, 1); }
      text(viewport, screenX + 7, screenY + 5, screenW - 14, 6, 600, muted, "left", 1);
      const innerTop = screenY + 20; const stateW = Math.min(screenW - 14, Math.max(38, state.length * 4 + 12));
      rect(screenX + 7, innerTop, stateW, 15, soft, 7, edge); text(state, screenX + 11, innerTop + 4, stateW - 8, 6, 600, accent, "left", 1);
      regionRows(content, screenX + 7, innerTop + 21, screenW - 14, screenH - 63, ["Page title", "Primary content", "Action"], 4);
      text(access, screenX + 7, screenY + screenH - 19, screenW - 14, 5.5, 500, muted, "left", 1);
    } else if (browser) {
      rect(x + 1, y + 1, w - 2, h - 2, fill, 7, edge); rect(x + 1, y + 1, w - 2, 31, soft, [6, 6, 0, 0], "none");
      circle(x + 13, y + 12, 3, palette.red, palette.red); circle(x + 23, y + 12, 3, "#d4a649", "#d4a649"); circle(x + 33, y + 12, 3, palette.green, palette.green);
      rect(x + 45, y + 6, w - 58, 15, fill, 7, edge); text(viewport, x + 52, y + 9, w - 74, 6, 500, muted, "left", 1);
      const viewY = y + 37; rect(x + 8, viewY, w - 16, h - 48, fill, 2, edge);
      rect(x + 8, viewY, w - 16, 17, soft, 2, soft); text(state || "Page state", x + 14, viewY + 5, w - 28, 7, 650, ink, "left", 1);
      regionRows(content, x + 15, viewY + 23, w - 30, h - 85, ["Navigation", "Hero content", "Feature cards", "Footer"], 4);
      text(access, x + 12, y + h - 13, w - 24, 6, 500, muted, "left", 1);
    } else if (desktop) {
      rect(x + 1, y + 1, w - 2, h - 2, fill, 5, edge); titleBar(value("state", "Document window"), 26, 4);
      circle(x + w - 39, y + 13, 3, edge, edge); circle(x + w - 25, y + 13, 3, edge, edge); line(x + w - 14, y + 10, x + w - 8, y + 16, edge); line(x + w - 8, y + 10, x + w - 14, y + 16, edge);
      const sidebarW = Math.max(48, Math.min(78, w * .25)); rect(x + 1, y + 28, sidebarW, h - 29, soft, 0, soft);
      regionRows(content, x + sidebarW + 9, y + 36, w - sidebarW - 18, h - 70, ["Toolbar", "Workspace", "Properties"], 4);
      const nav = lines(content, ["Home", "Projects", "Settings"], 4); nav.forEach((item, index) => text(item, x + 8, y + 39 + index * 19, sidebarW - 14, 6, 500, index === 0 ? accent : muted, "left", 1));
      text(`${viewport} · ${access}`, x + 8, y + h - 14, w - 16, 5.5, 500, muted, "left", 1);
    } else {
      rect(x + 1, y + 1, w - 2, h - 2, fill, 3, edge, "6 4"); titleBar("Responsive screen · " + viewport, 27);
      const stateW = Math.min(100, w - 24); rect(x + w - stateW - 9, y + 7, stateW, 15, fill, 7, edge); text(state, x + w - stateW - 5, y + 10, stateW - 8, 6, 600, accent, "left", 1);
      regionRows(content, x + 11, y + 36, w - 22, h - 65, ["Header", "Navigation", "Main content", "Actions"], 4);
      text(access, x + 11, y + h - 16, w - 22, 6, 500, muted, "left", 1);
    }
  } else if (kind.endsWith("bottom-navigation")) {
    shell("Bottom navigation", 7); const items = lines(value("items"), ["Home", "Search", "Saved", "Profile"], 5); const active = value("active", items[0]); const itemW = (w - 16) / items.length; const top = y + 36;
    line(x + 1, top - 5, x + w - 1, top - 5, edge);
    items.forEach((item, index) => { const ix = x + 8 + index * itemW; const selected = item.toLowerCase() === active.toLowerCase(); circle(ix + itemW / 2, top + 5, 3.5, selected ? accent : fill, selected ? accent : muted); text(item, ix + 2, top + 13, itemW - 4, 6, selected ? 700 : 500, selected ? accent : muted, "center", 1); });
    text(`Selected: ${active} · ${value("behavior", "Tap to navigate")}`, x + 8, y + h - 25, w - 16, 6, 500, muted, "left", 1); text(value("accessibility", "Navigation label and tab order"), x + 8, y + h - 14, w - 16, 5.5, 500, muted, "left", 1);
  } else if (kind.endsWith("side-drawer")) {
    shell("Navigation drawer", 5); const items = lines(value("items"), ["Overview", "Projects", "Reports", "Settings"], 6); const active = value("active", items[0]);
    const drawerW = Math.min(w - 18, Math.max(105, w * .66)); rect(x + 8, y + 33, drawerW, h - 45, fill, 4, edge); text(value("behavior", "Overlay · Escape closes"), x + 14, y + 39, drawerW - 12, 6, 500, muted, "left", 1);
    items.forEach((item, index) => { const rowY = y + 54 + index * 18; const selected = item.toLowerCase() === active.toLowerCase(); if (selected) rect(x + 12, rowY - 2, drawerW - 8, 16, soft, 3, soft); circle(x + 20, rowY + 5, 2.5, selected ? accent : muted, selected ? accent : muted); text(item, x + 28, rowY, drawerW - 40, 7, selected ? 650 : 450, selected ? accent : ink, "left", 1); });
    text(`Active: ${active} · ${value("accessibility", "Focus returns to menu button")}`, x + 8, y + h - 14, w - 16, 5.5, 500, muted, "left", 1);
  } else if (kind.endsWith("bottom-sheet")) {
    shell("Bottom sheet", 9); rect(x + w * .4, y + 31, w * .2, 3, muted, 2, muted); text(value("dismiss", "Half height · swipe down to close"), x + 10, y + 40, w - 20, 6, 500, muted, "center", 1);
    const content = lines(value("content"), ["Choose an option", "Review details", "More information"], 4); content.forEach((item, index) => text(item, x + 12, y + 54 + index * 14, w - 24, 7, index === 0 ? 650 : 450, index === 0 ? ink : muted, "left", 1));
    button(value("action", "Continue"), x + 10, y + h - 49, w - 20, 17); text(`Trigger: ${value("trigger", "Swipe up")}`, x + 10, y + h - 27, w - 20, 5.5, 500, muted, "center", 1); text(value("accessibility", "Dialog · focus returns to trigger"), x + 8, y + h - 16, w - 16, 5, 500, muted, "center", 1);
  } else if (kind.endsWith("tooltip")) {
    rect(x + 5, y + 10, w - 10, h - 22, ink, 6, ink); path([{ x: x + w / 2 - 5, y: y + h - 12 }, { x: x + w / 2 + 5, y: y + h - 12 }, { x: x + w / 2, y: y + h - 4 }], ink, 1, ink, true);
    text(value("content", "Helpful description"), x + 13, y + 17, w - 26, 8, 600, "#ffffff", "left", 3); text(`On: ${value("trigger", "Help icon")} · ${value("dismiss", "Escape or blur")}`, x + 12, y + h - 36, w - 24, 5.5, 500, muted, "left", 1); text(`Action: ${value("action", "Learn more")} · ${value("accessibility", "Described by control")}`, x + 12, y + h - 25, w - 24, 5.5, 500, muted, "left", 1);
  } else if (kind.endsWith("popover")) {
    shell("Popover", 5); path([{ x: x + 20, y: y + 26 }, { x: x + 30, y: y + 26 }, { x: x + 25, y: y + 20 }], edge, 1, fill, true);
    text(`Anchor: ${value("trigger", "Toolbar action")}`, x + 10, y + 34, w - 20, 6, 600, muted, "left", 1);
    lines(value("content"), ["Edit", "Duplicate", "Remove"], 4).forEach((item, index) => { const yy = y + 47 + index * 13; if (index === 0) rect(x + 7, yy - 2, w - 14, 13, soft, 3, soft); text(item, x + 13, yy, w - 26, 7, 500, index === 0 ? accent : ink, "left", 1); });
    text(`Dismiss: ${value("dismiss", "Outside click · Escape")} · ${value("action", "Select item")}`, x + 9, y + h - 15, w - 18, 5.5, 500, muted, "left", 1); text(value("accessibility", "Menu semantics · focus managed"), x + 9, y + h - 6, w - 18, 5, 500, muted, "left", 1);
  } else if (kind.endsWith("command-palette")) {
    shell("Command palette", 7); rect(x + 9, y + 33, w - 18, 18, fill, 4, edge); circle(x + 18, y + 42, 4, fill, muted); line(x + 21, y + 45, x + 25, y + 49, muted); text(value("trigger", "Search commands · Ctrl+K"), x + 30, y + 38, w - 42, 7, 500, muted, "left", 1);
    const commands = lines(value("content"), ["Open file", "Create page", "Export diagram", "Settings"], 5); commands.forEach((command, index) => { const yy = y + 56 + index * 13; if (index === 0) rect(x + 9, yy - 2, w - 18, 13, soft, 3, soft); text(command, x + 14, yy, w * .65, 7, 500, index === 0 ? accent : ink, "left", 1); text(index === 0 ? "Enter" : `Ctrl+${index}`, x + w - 53, yy, 38, 6, 500, muted, "right", 1); });
    text(`Dismiss: ${value("dismiss", "Escape")} · Action: ${value("action", "Run selected command")}`, x + 9, y + h - 15, w - 18, 5.5, 500, muted, "left", 1); text(value("accessibility", "Arrow keys · Enter · Escape"), x + 9, y + h - 6, w - 18, 5, 500, muted, "left", 1);
  } else if (kind.endsWith("empty-state")) {
    shell("Empty state", 6); circle(x + w / 2, y + 52, 15, soft, edge); rect(x + w / 2 - 8, y + 48, 16, 10, fill, 2, accent); line(x + w / 2 - 6, y + 46, x + w / 2 + 6, y + 46, accent);
    text(value("status", "Nothing here yet"), x + 10, y + 73, w - 20, 9, 700, ink, "center", 1); text(value("details", "Add an item to get started."), x + 12, y + 88, w - 24, 7, 400, muted, "center", 2); button(value("recovery", "Create item"), x + w * .28, y + h - 28, w * .44, 17);
    text(value("accessibility", "Illustration: empty collection"), x + 8, y + h - 8, w - 16, 5, 500, muted, "center", 1);
  } else if (kind.endsWith("skeleton-loading-state")) {
    shell("Loading · skeleton", 5); const rows = lines(value("content"), ["Title", "Body", "Action"], 5); const compact = value("content").toLowerCase().includes("table");
    if (compact) { rows.forEach((_row, index) => { const yy = y + 38 + index * 17; rect(x + 10, yy, w - 20, 10, index === 0 ? soft : fill, 4, edge); }); }
    else rows.forEach((item, index) => { const rowStep = Math.min(27, (h - 67) / rows.length); const yy = y + 38 + index * rowStep; rect(x + 10, yy, 24, 20, soft, 3, edge); rect(x + 41, yy + 1, w - 53, 7, soft, 3, soft); rect(x + 41, yy + 12, Math.max(30, w * .48), 5, soft, 3, soft); text(item, x + 9, yy + 20, w - 18, 5, 400, muted, "left", 1); });
    text(value("state", "Loading content"), x + 10, y + h - 29, w - 20, 6, 600, muted, "left", 1); text(`${value("interaction", "Content appears when ready")} · ${value("accessibility", "Busy state announced")}`, x + 10, y + h - 17, w - 20, 5.5, 500, muted, "left", 1);
  } else if (kind.endsWith("error-state")) {
    shell("Error state", 6); circle(x + 22, y + 48, 9, palette.red, palette.red); text("!", x + 18, y + 42, 8, 12, 700, "#ffffff", "center", 1);
    text(value("status", "Something went wrong"), x + 38, y + 42, w - 50, 9, 700, palette.red, "left", 2); text(value("details", "The request could not be completed."), x + 12, y + 67, w - 24, 7, 400, muted, "left", 3);
    button(value("recovery", "Try again"), x + 12, y + h - 30, Math.min(90, w - 24), 17); text(value("accessibility", "Alert · focus on error summary"), x + 12, y + h - 10, w - 24, 5.5, 500, muted, "left", 1);
  } else if (kind.endsWith("loading-indicator")) {
    shell("Loading", 6); const cx = x + 30; const cy = y + 54; circle(cx, cy, 13, fill, soft); path(Array.from({ length: 9 }, (_, index) => ({ x: cx + Math.cos(index * Math.PI / 4) * 10, y: cy + Math.sin(index * Math.PI / 4) * 10 })), accent, 2);
    text(value("status", "Loading your workspace"), x + 51, y + 42, w - 62, 8, 650, ink, "left", 2); text(value("state", "Please wait"), x + 51, y + 61, w - 62, 6, 500, muted, "left", 1);
    const progress = Number(value("progress").replace(/%$/, "").trim()); if (Number.isFinite(progress) && value("progress")) { rect(x + 13, y + 82, w - 26, 6, soft, 3, soft); rect(x + 13, y + 82, (w - 26) * Math.max(0, Math.min(100, progress)) / 100, 6, accent, 3, accent); text(`${Math.max(0, Math.min(100, progress))}%`, x + w - 38, y + 72, 25, 6, 600, accent, "right", 1); }
    text(value("accessibility", "Progress announced to assistive technology"), x + 10, y + h - 16, w - 20, 5.5, 500, muted, "left", 1);
  } else if (kind.endsWith("sign-in-panel")) {
    shell("Sign in", 6); text(value("identity", "Email address"), x + 12, y + 37, w - 24, 6, 600, muted, "left", 1); rect(x + 10, y + 47, w - 20, 19, fill, 3, edge); text(value("identity", "name@example.com"), x + 16, y + 53, w - 32, 7, 400, muted, "left", 1);
    text(value("secret", "Password"), x + 12, y + 71, w - 24, 6, 600, muted, "left", 1); rect(x + 10, y + 81, w - 20, 19, fill, 3, edge); text("••••••••", x + 16, y + 87, w - 32, 7, 400, muted, "left", 1);
    text(value("validation", "Validation message"), x + 12, y + 105, w - 24, 6, 500, palette.red, "left", 1); button(value("action", "Sign in"), x + 10, y + 120, w - 20, 18);
    text(value("accessibility", "Labels · errors linked to fields"), x + 10, y + h - 10, w - 20, 5.5, 500, muted, "left", 1);
  } else if (kind.endsWith("file-drop-zone")) {
    shell("Upload files", 6); rect(x + 11, y + 36, w - 22, h - 69, fill, 6, accent, "6 4");
    path([{ x: x + w / 2, y: y + 48 }, { x: x + w / 2, y: y + 66 }], accent, 2); path([{ x: x + w / 2 - 7, y: y + 55 }, { x: x + w / 2, y: y + 48 }, { x: x + w / 2 + 7, y: y + 55 }], accent, 2);
    text(value("content", "Drop files here"), x + 18, y + 72, w - 36, 8, 650, ink, "center", 2); text(value("accepted", "PDF · PNG · SVG · 10 MB max"), x + 15, y + 92, w - 30, 6, 500, muted, "center", 2);
    button(value("action", "Browse files"), x + w * .3, y + h - 28, w * .4, 17); text(`${value("state", "Idle · drag to upload")} · ${value("accessibility", "Keyboard browse available")}`, x + 10, y + h - 8, w - 20, 5.5, 500, muted, "center", 1);
  } else if (kind.endsWith("filter-toolbar")) {
    shell("Search and filters", 5); rect(x + 9, y + 35, w - 18, 20, fill, 4, edge); circle(x + 19, y + 44, 4, fill, muted); line(x + 22, y + 47, x + 26, y + 51, muted); text(value("behavior", "Search results"), x + 31, y + 41, w - 44, 7, 400, muted, "left", 1);
    const items = lines(value("items"), ["Type", "Owner", "Date"], 4); const active = lines(value("active"), [], 4); let cx = x + 9;
    items.forEach(item => { const selected = active.some(entry => entry.toLowerCase() === item.toLowerCase()); const chipW = Math.min(w * .39, Math.max(38, item.length * 5 + 14)); rect(cx, y + 63, chipW, 18, selected ? soft : fill, 8, selected ? accent : edge); text(item, cx + 5, y + 68, chipW - 10, 6, selected ? 650 : 500, selected ? accent : muted, "center", 1); cx += chipW + 5; });
    text(`Active: ${value("active", "None")} · ${value("accessibility", "Filters are keyboard operable")}`, x + 9, y + h - 22, w - 18, 5.5, 500, muted, "left", 1); text(value("behavior", "Sort · clear all"), x + 9, y + h - 11, w - 18, 5.5, 500, muted, "left", 1);
  } else if (kind.endsWith("search-result-row")) {
    rect(x + 1, y + 1, w - 2, h - 2, fill, 4, edge); circle(x + 22, y + 22, 10, soft, edge); text("⌕", x + 13, y + 14, 18, 12, 600, accent, "center", 1);
    text(value("title", "Search result"), x + 40, y + 10, w - 74, 8, 700, ink, "left", 1); text(value("excerpt", "Matching text appears here."), x + 40, y + 25, w - 50, 7, 400, muted, "left", 2);
    rect(x + 40, y + 49, Math.min(70, w * .38), 15, soft, 7, edge); text(value("category", "Document"), x + 44, y + 53, Math.min(62, w * .34), 6, 600, accent, "left", 1); button(value("action", "Open"), x + w - 45, y + h - 26, 35, 17, false);
  } else if (kind.endsWith("notification-center")) {
    shell("Notifications", 5); const notifications = lines(value("details"), ["A new update is available", "Your export is ready", "Someone shared a file"], 5);
    notifications.forEach((raw, index) => { const parts = raw.split("|").map(part => part.trim()); const yy = y + 34 + index * Math.min(31, (h - 62) / notifications.length); const unread = /unread/i.test(parts[2] ?? "") || index === 0 && !/read/i.test(value("status")); if (index) line(x + 8, yy - 2, x + w - 8, yy - 2, soft); circle(x + 14, yy + 8, 3, unread ? accent : soft, unread ? accent : muted); text(parts[0], x + 23, yy + 2, w - 35, 7, unread ? 650 : 450, ink, "left", 2); text(parts[1] || (unread ? "Unread" : "Read"), x + 23, yy + 17, w - 35, 5.5, 500, muted, "left", 1); });
    text(`${value("status", "1 unread")} · ${value("recovery", "Mark all as read")} · ${value("accessibility", "Unread count announced")}`, x + 9, y + h - 14, w - 18, 5, 500, muted, "left", 1);
  } else if (kind.endsWith("code-editor-panel")) {
    shell("Code editor", 5); rect(x + 1, y + 27, w - 2, h - 28, dark ? "#1b2027" : "#f7f8fa", 0, edge);
    text(`${value("language", "TypeScript · sketch.ts")}`, x + 9, y + 33, w - 18, 6, 600, accent, "left", 1); line(x + 1, y + 46, x + w - 1, y + 46, edge);
    const code = lines(value("code"), ["function render() {", "  return <Canvas />;", "}"], 5); code.forEach((row, index) => { const yy = y + 51 + index * 12; text(String(index + 1), x + 6, yy, 14, 6, 500, muted, "right", 1); text(row, x + 27, yy, w - 38, 6.5, 400, ink, "left", 1); });
    text(value("diagnostics", "0 errors · no warnings"), x + 9, y + h - 26, w - 18, 6, 600, value("diagnostics").toLowerCase().includes("error") ? palette.red : muted, "left", 1); text(value("interaction", "Cursor · selection · keyboard"), x + 9, y + h - 14, w - 18, 5.5, 500, muted, "left", 1);
  } else if (kind.endsWith("validation-summary")) {
    shell("Validation summary", 5); const errors = lines(value("details"), ["Email is required", "Password must be longer"], 5);
    text(value("status", `${errors.length} fields need attention`), x + 10, y + 35, w - 20, 8, 700, palette.red, "left", 2);
    errors.forEach((raw, index) => { const parts = raw.split("|").map(part => part.trim()); const yy = y + 57 + index * Math.min(18, (h - 90) / errors.length); circle(x + 15, yy + 5, 2.5, palette.red, palette.red); text(parts[0], x + 23, yy, 52, 6, 650, accent, "left", 1); text(parts[1] || parts[0], x + 78, yy, w - 91, 6, 400, muted, "left", 2); });
    text(`${value("recovery", "Review fields")} · ${value("accessibility", "Errors linked to form fields")}`, x + 10, y + h - 14, w - 20, 5.5, 500, muted, "left", 1);
  } else if (kind.endsWith("breakpoint-marker")) {
    shell("Responsive breakpoint", 4); const bp = value("breakpoint", "Tablet · 768 px");
    line(x + 18, y + 52, x + w - 18, y + 52, edge, 1, "4 3"); line(x + w / 2, y + 36, x + w / 2, y + h - 30, accent, 2); circle(x + w / 2, y + 52, 4, accent, accent);
    text(bp, x + 10, y + 34, w - 20, 8, 700, accent, "center", 1); text(value("before", "Two columns"), x + 9, y + 64, w / 2 - 14, 6, 500, muted, "left", 2); text(value("after", "Single column"), x + w / 2 + 5, y + 64, w / 2 - 14, 6, 500, muted, "left", 2);
    text(`${value("behavior", "Stack content")} · ${value("accessibility", "Reflow at 200% zoom")}`, x + 9, y + h - 16, w - 18, 5.5, 500, muted, "left", 1);
  } else if (kind.endsWith("accessibility-focus-ring")) {
    shell("Keyboard focus", 5); const label = value("element", "Save button"); const controlW = Math.min(w - 42, Math.max(70, label.length * 6 + 24)); const controlX = x + (w - controlW) / 2;
    rect(controlX - 4, y + 40, controlW + 8, 32, "none", 7, accent, "4 2"); button(label, controlX, y + 46, controlW, 20, false);
    text(`Order: ${value("focus-order", "2 of 5")}`, x + 9, y + 82, w - 18, 6, 600, muted, "left", 1); text(value("appearance", "2 px · 2 px offset · high contrast"), x + 9, y + 95, w - 18, 6, 500, ink, "left", 1);
    text(`${value("keyboard", "Tab to focus · Enter to activate")} · ${value("contrast", "3:1 contrast")}`, x + 9, y + h - 14, w - 18, 5.5, 500, muted, "left", 1);
  }
  return { primitives, bounds };
}

function wrapText(value: string, width: number, size: number, maxLines: number): string[] {
  const limit = Math.max(1, Math.floor(width / Math.max(1, size * .58))); const output: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      if (!line) line = word;
      else if (`${line} ${word}`.length <= limit) line += ` ${word}`;
      else { output.push(line); line = word; }
    }
    if (line) output.push(line);
  }
  if (!output.length) return [""];
  if (output.length > maxLines) { output.length = maxLines; output[maxLines - 1] = `${output[maxLines - 1].slice(0, Math.max(1, limit - 1)).trimEnd()}…`; }
  return output;
}

export function drawProposalWireframeComponent(ctx: CanvasRenderingContext2D, group: GroupElement, theme: Theme): boolean {
  const scene = makeScene(group, theme); if (!scene) return false;
  ctx.save(); ctx.beginPath(); ctx.rect(scene.bounds.x, scene.bounds.y, scene.bounds.w, scene.bounds.h); ctx.clip(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const item of scene.primitives) {
    if (item.type === "rect") {
      ctx.beginPath(); if (typeof ctx.roundRect === "function") ctx.roundRect(item.x, item.y, item.w, item.h, item.radius ?? 0); else ctx.rect(item.x, item.y, item.w, item.h);
      if (item.fill !== "none") { ctx.fillStyle = item.fill; ctx.fill(); }
      if (item.stroke !== "none") { ctx.strokeStyle = item.stroke; ctx.lineWidth = 1; ctx.setLineDash(item.dash ? item.dash.split(" ").map(Number) : []); ctx.stroke(); ctx.setLineDash([]); }
    } else if (item.type === "line") {
      ctx.beginPath(); ctx.moveTo(item.x1, item.y1); ctx.lineTo(item.x2, item.y2); ctx.strokeStyle = item.stroke; ctx.lineWidth = item.width ?? 1; ctx.setLineDash(item.dash ? item.dash.split(" ").map(Number) : []); ctx.stroke(); ctx.setLineDash([]);
    } else if (item.type === "path") {
      if (!item.points.length) continue; ctx.beginPath(); ctx.moveTo(item.points[0].x, item.points[0].y); item.points.slice(1).forEach(point => ctx.lineTo(point.x, point.y)); if (item.close) ctx.closePath();
      if (item.fill) { ctx.fillStyle = item.fill; ctx.fill(); } ctx.strokeStyle = item.stroke; ctx.lineWidth = item.width ?? 1; ctx.stroke();
    } else if (item.type === "circle") {
      ctx.beginPath(); ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2); ctx.fillStyle = item.fill; ctx.fill(); if (item.stroke) { ctx.strokeStyle = item.stroke; ctx.lineWidth = 1; ctx.stroke(); }
    } else {
      const size = Math.max(5, item.size); const align = item.align ?? "left"; ctx.font = `${item.weight} ${size}px sans-serif`; ctx.fillStyle = item.color; ctx.textAlign = align; ctx.textBaseline = "top";
      const lines = wrapText(item.value, item.w, size, item.maxLines ?? 2); const tx = align === "center" ? item.x + item.w / 2 : align === "right" ? item.x + item.w : item.x;
      lines.forEach((line, index) => ctx.fillText(line, tx, item.y + index * size * 1.16, Math.max(1, item.w)));
    }
  }
  ctx.restore(); return true;
}

function escapeXml(value: string): string { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" })[char]!); }

export function proposalWireframeComponentSvg(group: GroupElement, theme: Theme = "light"): string | undefined {
  const scene = makeScene(group, theme); if (!scene) return undefined;
  return scene.primitives.map(item => {
    if (item.type === "rect") {
      const stroke = `stroke="${item.stroke}" stroke-width="1"${item.dash ? ` stroke-dasharray="${item.dash}"` : ""}`;
      if (typeof item.radius === "number" || item.radius === undefined) return `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" rx="${item.radius ?? 0}" fill="${item.fill}" ${stroke}/>`;
      const limit = Math.max(0, Math.min(item.w, item.h) / 2); const [tl, tr, br, bl] = item.radius.map(radius => Math.max(0, Math.min(limit, radius)));
      const d = `M ${item.x + tl} ${item.y} H ${item.x + item.w - tr} Q ${item.x + item.w} ${item.y} ${item.x + item.w} ${item.y + tr} V ${item.y + item.h - br} Q ${item.x + item.w} ${item.y + item.h} ${item.x + item.w - br} ${item.y + item.h} H ${item.x + bl} Q ${item.x} ${item.y + item.h} ${item.x} ${item.y + item.h - bl} V ${item.y + tl} Q ${item.x} ${item.y} ${item.x + tl} ${item.y} Z`;
      return `<path d="${d}" fill="${item.fill}" ${stroke}/>`;
    }
    if (item.type === "line") return `<path d="M ${item.x1} ${item.y1} L ${item.x2} ${item.y2}" fill="none" stroke="${item.stroke}" stroke-width="${item.width ?? 1}"${item.dash ? ` stroke-dasharray="${item.dash}"` : ""}/>`;
    if (item.type === "path") return `<path d="M ${item.points.map(point => `${point.x} ${point.y}`).join(" L ")}${item.close ? " Z" : ""}" fill="${item.fill ?? "none"}" stroke="${item.stroke}" stroke-width="${item.width ?? 1}"/>`;
    if (item.type === "circle") return `<circle cx="${item.x}" cy="${item.y}" r="${item.r}" fill="${item.fill}"${item.stroke ? ` stroke="${item.stroke}" stroke-width="1"` : ""}/>`;
    const size = Math.max(5, item.size); const lines = wrapText(item.value, item.w, size, item.maxLines ?? 2); const anchor = item.align === "center" ? "middle" : item.align === "right" ? "end" : "start";
    const tx = item.align === "center" ? item.x + item.w / 2 : item.align === "right" ? item.x + item.w : item.x;
    return `<text text-anchor="${anchor}" dominant-baseline="hanging" x="${tx}" y="${item.y}" fill="${item.color}" font-family="sans-serif" font-size="${size}" font-weight="${item.weight}">${lines.map((line, index) => `<tspan x="${tx}" y="${item.y + index * size * 1.16}">${escapeXml(line)}</tspan>`).join("")}</text>`;
  }).join("");
}
