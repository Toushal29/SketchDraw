import type { Element, GroupElement, Theme } from "../../model";
import { cloudNeutralComponent, cloudProviderComponent } from "../diagrams/cloud-providers";
import { cloudNeutralCanvasPath, cloudNeutralIconPath } from "./cloud-neutral-icons";
import { drawUiComponent, uiComponentSvg } from "./ui-components";
import { componentBaselineOffset, componentBoxTextAnchor, componentFont as sharedComponentFont, componentFontFamily } from "./component-text";
import { normalizeComponentSvgText } from "./component-text";
import { proposalComponentForKind, proposalComponentScore } from "./proposal-components";
import { drawProposalPlanningComponent, proposalPlanningComponentSvg } from "./proposal-planning-renderer";
import { drawProposalWireframeComponent, proposalWireframeComponentSvg } from "./proposal-wireframe-renderer";

type Palette = { ink: string; edge: string; fill: string; soft: string; muted: string; accent: string };
function componentThemeToken(name: string, fallback: string) {
  const host = typeof document === "undefined" ? undefined : document.querySelector<HTMLElement>(".app-shell") ?? document.documentElement;
  const value = host && typeof getComputedStyle === "function" ? getComputedStyle(host).getPropertyValue(name).trim() : "";
  return value || fallback;
}
function paletteFor(dark: boolean): Palette {
  return {
    ink: componentThemeToken("--diagram-ink", dark ? "#f0f1f2" : "#252a2e"), edge: componentThemeToken("--diagram-edge", dark ? "#aab1b8" : "#6f777e"), fill: componentThemeToken("--diagram-fill", dark ? "#25282b" : "#ffffff"),
    soft: componentThemeToken("--diagram-soft", dark ? "#3a3f44" : "#edf0f2"), muted: componentThemeToken("--diagram-muted", dark ? "#c0c5c9" : "#737b82"), accent: componentThemeToken("--diagram-accent", dark ? "#d6dadd" : "#46525b"),
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  ctx.beginPath();
  if (w <= 0 || h <= 0) return;
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, Math.max(0, Math.min(radius, w / 2, h / 2)));
  else ctx.rect(x, y, w, h);
}

function strokeRectAligned(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const transform = ctx.getTransform(); const scale = Math.max(.01, Math.hypot(transform.a, transform.b));
  if (Math.abs(transform.a) < 1e-7 || Math.abs(transform.d) < 1e-7 || Math.abs(transform.b) > 1e-7 || Math.abs(transform.c) > 1e-7 || Math.abs(Math.abs(transform.a) - Math.abs(transform.d)) > 1e-7) {
    ctx.strokeRect(x, y, Math.max(0, w), Math.max(0, h));
    return;
  }
  const deviceStrokeWidth = Math.max(1, Math.round(ctx.lineWidth * scale)); const offset = deviceStrokeWidth % 2 ? .5 : 0;
  const alignX = (value: number) => (Math.round(transform.a * value + transform.e - offset) + offset - transform.e) / transform.a;
  const alignY = (value: number) => (Math.round(transform.d * value + transform.f - offset) + offset - transform.f) / transform.d;
  const left = alignX(x); const top = alignY(y); const right = alignX(x + w); const bottom = alignY(y + h);
  const previousLineWidth = ctx.lineWidth;
  ctx.lineWidth = deviceStrokeWidth / scale;
  ctx.strokeRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
  ctx.lineWidth = previousLineWidth;
}

function attributeRadii(w: number, h: number, strokeWidth: number, double: boolean) {
  const outerX = Math.max(0, w / 2 - strokeWidth / 2);
  const outerY = Math.max(0, h / 2 - strokeWidth / 2);
  const inset = double ? Math.min(5, outerX / 2, outerY / 2) : 0;
  return { outerX, outerY, innerX: outerX - inset, innerY: outerY - inset };
}

function componentFieldValue(group: GroupElement, key: string): string {
  return group.libraryComponent?.componentFields?.find(field => field.key === key)?.value.trim() ?? "";
}

type ComponentTextStyle = NonNullable<NonNullable<GroupElement["libraryComponent"]>["textStyle"]>;
function componentFont(size: number, weight: number, style?: ComponentTextStyle) {
  return sharedComponentFont(size, style?.bold === undefined ? weight : style.bold ? 700 : 400, style?.fontFamily, style?.italic);
}
function componentTextAlign(align: ComponentTextStyle["textAlign"] | undefined, fallback: CanvasTextAlign): CanvasTextAlign {
  return align === "justify" ? fallback : align ?? fallback;
}
function componentTextAnchor(x: number, width: number, from: CanvasTextAlign, to: CanvasTextAlign) {
  const left = from === "center" ? x - width / 2 : from === "right" ? x - width : x;
  return to === "center" ? left + width / 2 : to === "right" ? left + width : left;
}
function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, size: number, color: string, weight = 500, align: CanvasTextAlign = "left", style?: ComponentTextStyle) {
  const fontSize = Math.max(5, size);
  const actualWeight = style?.bold === undefined ? weight : style.bold ? 700 : 400;
  ctx.fillStyle = color; ctx.font = componentFont(fontSize, weight, style); ctx.textAlign = align; ctx.textBaseline = "alphabetic";
  ctx.fillText(value, x, y + componentBaselineOffset(fontSize, actualWeight, style?.fontFamily, style?.italic), Math.max(1, maxWidth));
  if (style?.underline) {
    const measured = Math.min(Math.max(1, maxWidth), ctx.measureText(value).width);
    const start = align === "center" ? x - measured / 2 : align === "right" ? x - measured : x;
    ctx.fillRect(start, y + fontSize * .36, measured, Math.max(1, fontSize / 14));
  }
}

function fittedComponentSingleLine(ctx: CanvasRenderingContext2D, value: string, bounds: { x: number; y: number; w: number; h: number }, tx: number, ty: number, requestedWidth: number, requestedSize: number, color: string, weight = 500, align: CanvasTextAlign = "left", style?: ComponentTextStyle) {
  fittedComponentText(ctx, value, bounds, tx, ty, requestedWidth, requestedSize, color, weight, align, style, 2);
}

function wrapComponentLabel(ctx: CanvasRenderingContext2D, value: string, width: number): string[] {
  const output: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    if (!paragraph.trim()) { output.push(""); continue; }
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= width) { line = candidate; continue; }
      if (line) { output.push(line); line = ""; }
      let fragment = "";
      for (const character of word) {
        if (fragment && ctx.measureText(fragment + character).width > width) { output.push(fragment); fragment = ""; }
        fragment += character;
      }
      line = fragment;
    }
    if (line) output.push(line);
  }
  return output.length ? output : [""];
}

function wrapComponentApprox(value: string, width: number, size: number): string[] {
  const maxChars = Math.max(1, Math.floor(width / Math.max(1, size * .58)));
  const output: string[] = [];
  let line = "";
  for (const word of value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean)) {
    if (line && `${line} ${word}`.length <= maxChars) { line += ` ${word}`; continue; }
    if (line) { output.push(line); line = ""; }
    for (let offset = 0; offset < word.length; offset += maxChars) {
      const part = word.slice(offset, offset + maxChars);
      if (offset + maxChars < word.length) output.push(part); else line = part;
    }
  }
  if (line) output.push(line);
  return output.length ? output : [""];
}

function fittedComponentText(ctx: CanvasRenderingContext2D, value: string, bounds: { x: number; y: number; w: number; h: number }, tx: number, ty: number, requestedWidth: number, requestedSize: number, color: string, weight = 500, align: CanvasTextAlign = "left", style?: ComponentTextStyle, maxLineLimit = 2) {
  const inset = Math.min(4, Math.max(1, Math.min(bounds.w, bounds.h) * .04));
  const left = bounds.x + inset; const right = bounds.x + bounds.w - inset;
  const top = bounds.y + inset; const bottom = bounds.y + bounds.h - inset;
  if (right <= left || bottom <= top) return;
  const width = Math.max(0, Math.min(requestedWidth, right - left));
  let x = tx; let maxWidth = width;
  if (align === "center") {
    x = Math.max(left + width / 2, Math.min(right - width / 2, tx));
    maxWidth = Math.min(width, 2 * Math.min(x - left, right - x));
  } else if (align === "right") {
    x = Math.max(left, Math.min(right, tx));
    maxWidth = Math.min(width, x - left);
  } else {
    x = Math.max(left, Math.min(right, tx));
    maxWidth = Math.min(width, right - x);
  }
  if (maxWidth < 2) return;
  // Small labels inside compact architecture cards intentionally use 6–8 px.
  // Raising them to 9 px made these labels wrap beyond their own sub-boxes.
  const minimumSize = Math.max(5, Math.min(9, requestedSize));
  let size = Math.max(minimumSize, Math.min(48, requestedSize, bottom - top));
  let lines: string[] = [];
  let lineHeight = size * 1.18;
  let maxLines = Math.max(1, Math.floor((bottom - top) / lineHeight));
  for (;;) {
    ctx.font = componentFont(size, weight, style);
    lines = wrapComponentLabel(ctx, value, maxWidth);
    lineHeight = size * 1.18;
    maxLines = Math.min(maxLineLimit, Math.max(1, Math.floor((bottom - top) / lineHeight)));
    if (lines.length <= maxLines || size <= minimumSize) break;
    size = Math.max(minimumSize, size - 1);
  }
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    const last = lines.length - 1;
    let shortened = lines[last].replace(/\s+$/, "");
    while (shortened && ctx.measureText(`${shortened}…`).width > maxWidth) shortened = shortened.slice(0, -1);
    lines[last] = shortened ? `${shortened}…` : "…";
  }
  const stackHeight = lines.length * lineHeight;
  const centerY = Math.max(top + stackHeight / 2, Math.min(bottom - stackHeight / 2, ty));
  const firstY = centerY - stackHeight / 2 + lineHeight / 2;
  for (const [index, line] of lines.entries()) text(ctx, line, x, firstY + index * lineHeight, maxWidth, size, color, weight, align, style);
}

function cloudPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(x + w * .15, y + h * .8);
  ctx.bezierCurveTo(x + w * .04, y + h * .8, x + w * .015, y + h * .66, x + w * .05, y + h * .56);
  ctx.bezierCurveTo(x + w * .08, y + h * .45, x + w * .17, y + h * .42, x + w * .25, y + h * .44);
  ctx.bezierCurveTo(x + w * .25, y + h * .22, x + w * .4, y + h * .12, x + w * .53, y + h * .23);
  ctx.bezierCurveTo(x + w * .66, y + h * .05, x + w * .85, y + h * .12, x + w * .87, y + h * .36);
  ctx.bezierCurveTo(x + w * .97, y + h * .38, x + w * .99, y + h * .49, x + w * .96, y + h * .59);
  ctx.bezierCurveTo(x + w * .99, y + h * .72, x + w * .9, y + h * .81, x + w * .81, y + h * .8);
  ctx.closePath();
}

function drawPorts(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, count: number, palette: Palette, hub = false, hubCenter?: { x: number; y: number }) {
  const visible = Math.min(32, Math.max(1, Math.round(count)));
  const columns = Math.min(8, visible);
  const rows = Math.ceil(visible / columns);
  const cell = (width - 24) / columns;
  for (let index = 0; index < visible; index++) {
    const col = index % columns; const row = Math.floor(index / columns);
    const cx = x + 12 + cell * (col + .5); const cy = y + 32 + row * 18;
    if (hub) {
      ctx.strokeStyle = palette.edge;
      ctx.beginPath(); ctx.moveTo(hubCenter?.x ?? x + width / 2, hubCenter?.y ?? y + 26); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(3, Math.min(5, cell * .22)), 0, Math.PI * 2); ctx.fillStyle = palette.fill; ctx.fill(); ctx.stroke();
      text(ctx, String(index + 1), cx, cy + 9, cell, 7, palette.muted, 500, "center");
    } else {
      roundRect(ctx, cx - Math.min(7, cell * .35), cy - 5, Math.min(14, cell * .7), 10, 2.5); ctx.fillStyle = palette.fill; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy + 8, 1.4, 0, Math.PI * 2); ctx.fillStyle = palette.accent; ctx.fill();
    }
  }
  return rows;
}

function drawProposalSystemsComponent(
  ctx: CanvasRenderingContext2D,
  group: GroupElement,
  bounds: { x: number; y: number; w: number; h: number },
  kind: string,
  name: string,
  fill: string,
  edge: string,
  textInk: string,
  size: number,
  textStyle: ComponentTextStyle | undefined,
  palette: Palette,
): boolean {
  const definition = proposalComponentForKind(kind);
  if (!definition?.section.startsWith("Systems engineering") || definition.archetype === "connector") return false;
  const { x, y, w, h } = bounds;
  const fields = group.libraryComponent?.componentFields ?? [];
  const value = (key: string) => fields.find(item => item.key === key)?.value.trim() ?? "";
  const label = (key: string) => fields.find(item => item.key === key)?.label ?? key.replace(/-/g, " ");
  const ink = edge;
  const fillShape = (rounded = 4, dashed = false) => {
    ctx.beginPath();
    if (rounded) roundRect(ctx, x + 1, y + 1, w - 2, h - 2, rounded);
    else ctx.rect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill;
    if (fill !== "transparent") ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.setLineDash(dashed ? [6, 4] : []); ctx.stroke(); ctx.setLineDash([]);
  };
  const rule = (atY: number, left = x + 1, right = x + w - 1) => {
    ctx.beginPath(); ctx.moveTo(left, atY); ctx.lineTo(right, atY); ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.stroke();
  };
  const title = (stereotype: string, titleY = y + 33, titleSize = Math.min(size, 15), centered = false) => {
    fittedComponentText(ctx, `«${stereotype}»`, bounds, centered ? x + w / 2 : x + 10, y + 16, w - 20, Math.min(10, size * .72), palette.accent, 600, centered ? "center" : "left", textStyle, 1);
    fittedComponentText(ctx, name, bounds, centered ? x + w / 2 : x + 10, titleY, w - 20, titleSize, textInk, 650, centered ? "center" : "left", textStyle, 2);
  };
  const rows = (keys: string[], top: number, bottom: number, options: { inset?: number; fontSize?: number; maxLines?: number } = {}) => {
    const visible = keys.map(key => ({ key, text: value(key) })).filter(item => item.text);
    if (!visible.length || bottom <= top) return;
    const rowHeight = (bottom - top) / visible.length;
    visible.forEach((item, index) => {
      const rowTop = top + rowHeight * index;
      if (index) rule(rowTop, x + 1, x + w - 1);
      const rowText = `${label(item.key)}: ${item.text.replace(/\s*\n\s*/g, " · ")}`;
      fittedComponentText(ctx, rowText, bounds, x + (options.inset ?? 9), rowTop + rowHeight / 2, w - (options.inset ?? 9) - 8, Math.min(options.fontSize ?? size * .72, rowHeight * .72), textInk, 400, "left", textStyle, options.maxLines ?? 1);
    });
  };
  const drawPortIcon = (atX: number, atY: number) => {
    ctx.fillStyle = fill === "transparent" ? palette.fill : fill;
    ctx.strokeStyle = ink; ctx.lineWidth = 1.4;
    ctx.fillRect(atX - 5, atY - 5, 10, 10); ctx.strokeRect(atX - 5, atY - 5, 10, 10);
  };

  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.lineCap = "round"; ctx.lineJoin = "round";

  if (kind === "proposal-systems-sysml-requirement") {
    fillShape(2);
    fittedComponentText(ctx, "«requirement»", bounds, x + 10, y + 14, w - 20, 10, palette.accent, 600, "left", textStyle, 1);
    const id = value("requirement-id");
    fittedComponentText(ctx, id ? `ID: ${id}` : name, bounds, x + 10, y + 34, w - 20, Math.min(size, 16), textInk, 650, "left", textStyle, 1);
    rule(y + 43);
    const statement = value("statement");
    if (statement) fittedComponentText(ctx, statement, bounds, x + 10, y + 75, w - 20, Math.min(size, 13), textInk, 500, "left", textStyle, 3);
    rule(y + h * .61);
    rows(["rationale", "verification"], y + h * .61, y + h - 1, { fontSize: Math.min(11, size * .72), maxLines: 2 });
  } else if (kind === "proposal-systems-sysml-block") {
    fillShape(2);
    fittedComponentText(ctx, "«block»", bounds, x + 10, y + 14, w - 20, 10, palette.accent, 600, "left", textStyle, 1);
    fittedComponentText(ctx, name, bounds, x + 10, y + 35, w - 20, Math.min(size, 16), textInk, 650, "left", textStyle, 2);
    rule(y + 45);
    rows(["stereotype", "parts", "values", "interfaces"], y + 45, y + h - 1, { fontSize: Math.min(12, size * .72), maxLines: 2 });
  } else if (kind === "proposal-systems-activity-partition") {
    fillShape(1, true);
    ctx.fillStyle = palette.soft; ctx.fillRect(x + 2, y + 2, w - 4, 30);
    rule(y + 33);
    fittedComponentText(ctx, value("responsibility") || name, bounds, x + 10, y + 18, w - 20, Math.min(size, 13), textInk, 650, "left", textStyle, 1);
    rows(["actions", "inputs", "outputs"], y + 34, y + h - 8, { inset: 10, fontSize: Math.min(12, size * .72), maxLines: 2 });
  } else if (kind === "proposal-systems-time-event" || kind === "proposal-systems-change-event") {
    const radius = Math.max(16, Math.min(24, h * .16, w * .12)); const cx = x + radius + 12; const cy = y + h / 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, radius, radius, 0, 0, Math.PI * 2); ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.stroke();
    if (kind.endsWith("time-event")) {
      ctx.beginPath(); ctx.ellipse(cx, cy, radius - 5, radius - 5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy); ctx.lineTo(cx + 6, cy + 4); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.quadraticCurveTo(cx - 5, cy - 9, cx, cy); ctx.quadraticCurveTo(cx + 5, cy + 9, cx + 10, cy); ctx.stroke();
    }
    const contentX = x + radius * 2 + 22; const contentWidth = Math.max(24, w - (contentX - x) - 10);
    fittedComponentText(ctx, kind.endsWith("time-event") ? "«time event»" : "«change event»", bounds, contentX, y + 16, contentWidth, 9, palette.accent, 600, "left", textStyle, 1);
    fittedComponentText(ctx, name, bounds, contentX, y + 36, contentWidth, Math.min(size, 14), textInk, 650, "left", textStyle, 2);
    rows(["trigger", "expression", "transition", "scope"], y + 52, y + h - 4, { inset: contentX - x, fontSize: Math.min(10, size * .64), maxLines: 2 });
  } else if (kind === "proposal-systems-action-pin" || kind === "proposal-systems-object-node") {
    fillShape(kind.endsWith("action-pin") ? 5 : 14);
    const stereotype = kind.endsWith("action-pin") ? "pin" : "object";
    fittedComponentText(ctx, `«${stereotype}»`, bounds, x + 9, y + 14, w - 18, 9, palette.accent, 600, "left", textStyle, 1);
    fittedComponentText(ctx, value(kind.endsWith("action-pin") ? "pin-name" : "object") || name, bounds, x + w / 2, y + h * .43, w - 22, Math.min(size, 15), textInk, 600, "center", textStyle, 2);
    rows(kind.endsWith("action-pin") ? ["type", "direction", "multiplicity"] : ["state", "direction", "pins"], y + h * .62, y + h - 5, { fontSize: Math.min(11, size * .65), maxLines: 1 });
    if (kind.endsWith("action-pin")) {
      const output = value("direction").toLowerCase().startsWith("out"); const pinX = output ? x + w - 2 : x + 2; const cy = y + h / 2;
      ctx.beginPath(); ctx.moveTo(pinX, cy - 8); ctx.lineTo(pinX + (output ? 8 : -8), cy - 8); ctx.lineTo(pinX + (output ? 8 : -8), cy + 8); ctx.lineTo(pinX, cy + 8); ctx.strokeStyle = ink; ctx.lineWidth = 1.4; ctx.stroke();
    }
  } else if (kind === "proposal-systems-send-signal-action" || kind === "proposal-systems-accept-signal-action") {
    fillShape(9);
    fittedComponentText(ctx, kind.endsWith("send-signal-action") ? "sendSignal" : "acceptEvent", bounds, x + 10, y + 23, w - 20, Math.min(size, 15), palette.accent, 650, "left", textStyle, 1);
    fittedComponentText(ctx, name, bounds, x + 10, y + 44, w - 20, Math.min(size, 14), textInk, 600, "left", textStyle, 2);
    rule(y + 55);
    rows(["signal", "payload", "source-target", "guard"], y + 55, y + h - 2, { fontSize: Math.min(11, size * .68), maxLines: 1 });
  } else if (kind === "proposal-systems-provided-interface" || kind === "proposal-systems-required-interface") {
    const cx = x + w * .16; const cy = y + h / 2; const radius = Math.max(10, Math.min(18, h * .16, w * .08));
    ctx.strokeStyle = ink; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + 1, cy); ctx.lineTo(cx - radius, cy); ctx.stroke();
    if (kind.endsWith("provided-interface")) {
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(cx + radius * .55, cy, radius, Math.PI * .65, Math.PI * 1.35); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + radius * .18, cy - radius * .76); ctx.lineTo(cx + radius * .18, cy + radius * .76); ctx.stroke();
    }
    fittedComponentText(ctx, kind.endsWith("provided-interface") ? "«provided»" : "«required»", bounds, x + w * .34, cy - 19, w * .62, 10, palette.accent, 600, "left", textStyle, 1);
    fittedComponentText(ctx, value("interface") || name, bounds, x + w * .34, cy + 1, w * .62, Math.min(size, 14), textInk, 650, "left", textStyle, 2);
    const responsible = kind.endsWith("provided-interface") ? value("provider") : value("consumer");
    const interfaceDetails = [["Role", responsible], ["Operations", value("operations")], ["Protocol", value("protocol")]].filter(([, item]) => item);
    interfaceDetails.forEach(([label, item], index) => fittedComponentText(ctx, `${label}: ${item}`, bounds, x + w * .34, cy + 24 + index * 17, w * .62, Math.min(10, size * .65), textInk, 400, "left", textStyle, 1));
  } else if (kind === "proposal-systems-uml-combined-fragment") {
    fillShape(1);
    const tabWidth = Math.min(82, w * .38); const tabHeight = Math.min(30, h * .22);
    ctx.beginPath(); ctx.moveTo(x + 1, y + tabHeight); ctx.lineTo(x + 1, y + 1); ctx.lineTo(x + tabWidth, y + 1); ctx.lineTo(x + tabWidth + 13, y + tabHeight); ctx.closePath();
    ctx.fillStyle = palette.soft; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.stroke();
    fittedComponentText(ctx, value("operator") || "alt", bounds, x + 8, y + tabHeight * .64, tabWidth - 10, 11, palette.accent, 700, "left", textStyle, 1);
    fittedComponentText(ctx, value("guard") || name, bounds, x + tabWidth + 16, y + tabHeight + 17, w - tabWidth - 22, Math.min(size, 13), textInk, 600, "left", textStyle, 2);
    rows(["operands", "lifelines"], y + tabHeight + 30, y + h - 2, { fontSize: Math.min(12, size * .72), maxLines: 2 });
  } else if (kind === "proposal-systems-constraint-block" || kind === "proposal-systems-parametric-constraint") {
    fillShape(2);
    fittedComponentText(ctx, "«constraint»", bounds, x + 10, y + 14, w - 20, 10, palette.accent, 600, "left", textStyle, 1);
    fittedComponentText(ctx, name, bounds, x + 10, y + 34, w - 20, Math.min(size, 14), textInk, 650, "left", textStyle, 1);
    rule(y + 43);
    const expression = value("expression");
    if (expression) fittedComponentText(ctx, expression, bounds, x + w / 2, y + h * .62, w - 24, Math.min(15, size), textInk, 500, "center", textStyle, 3);
    rows(["inputs", "outputs", "variables", "units", "assumptions", "source"], y + h * .72, y + h - 2, { fontSize: Math.min(10, size * .65), maxLines: 1 });
  } else if (kind === "proposal-systems-interface-block" || /proposal-systems-(?:full-port|proxy-port|uml-port)$/.test(kind)) {
    fillShape(2);
    const port = /port$/.test(kind);
    fittedComponentText(ctx, port ? `«${kind.endsWith("full-port") ? "full port" : kind.endsWith("proxy-port") ? "proxy port" : "port"}»` : "«interface block»", bounds, x + 10, y + 15, w - 28, 10, palette.accent, 600, "left", textStyle, 1);
    fittedComponentText(ctx, value(port ? "port-name" : "interface-name") || name, bounds, x + 10, y + 37, w - 22, Math.min(size, 15), textInk, 650, "left", textStyle, 2);
    if (port) drawPortIcon(x + w - 2, y + h / 2);
    rule(y + 48);
    rows(port ? ["direction", "interface", "delegation"] : ["provided", "required", "protocol"], y + 48, y + h - 2, { fontSize: Math.min(11, size * .68), maxLines: 2 });
  } else if (kind === "proposal-systems-protocol-state") {
    fillShape(18);
    fittedComponentText(ctx, value("state") || name, bounds, x + w / 2, y + 25, w - 24, Math.min(size, 16), textInk, 650, "center", textStyle, 2);
    rule(y + 39, x + 10, x + w - 10);
    rows(["entry-exit", "allowed-transitions", "protocol"], y + 39, y + h - 3, { inset: 12, fontSize: Math.min(11, size * .68), maxLines: 2 });
  } else {
    const property = /property$/.test(kind) || kind.endsWith("value-type");
    fillShape(property ? 1 : 3);
    const stereotype = kind.endsWith("part-property") ? "part" : kind.endsWith("reference-property") ? "reference" : kind.endsWith("value-property") ? "value" : kind.endsWith("value-type") ? "value type" : kind.endsWith("requirement-stakeholder") ? "requirement stakeholder" : kind.endsWith("requirement-test-case") ? "test case" : kind.endsWith("requirement-risk") ? "requirement risk" : "element";
    title(stereotype, y + 36, Math.min(size, 15));
    rule(y + 45);
    const propertyFields = kind.endsWith("part-property") ? ["part-name", "type", "owner", "constraint"]
      : kind.endsWith("reference-property") ? ["reference-name", "type", "target", "role"]
        : kind.endsWith("value-property") ? ["value-name", "type", "value", "range"]
          : kind.endsWith("value-type") ? ["type-name", "base-type", "unit", "constraint"]
            : kind.endsWith("requirement-stakeholder") ? ["stakeholder", "need", "priority", "trace"]
              : kind.endsWith("requirement-test-case") ? ["test-id", "preconditions", "procedure", "expected"]
                : kind.endsWith("requirement-risk") ? ["risk", "likelihood", "impact", "mitigation"]
                  : kind.endsWith("provided-interface") ? ["interface", "provider", "operations", "protocol"]
                    : kind.endsWith("required-interface") ? ["interface", "consumer", "operations", "protocol"]
                      : ["element", "specification", "properties", "trace"];
    rows(propertyFields, y + 45, y + h - 2, { fontSize: Math.min(12, size * .7), maxLines: 2 });
  }
  ctx.restore();
  return true;
}

function drawProposalDecisionComponent(
  ctx: CanvasRenderingContext2D,
  group: GroupElement,
  bounds: { x: number; y: number; w: number; h: number },
  kind: string,
  name: string,
  fill: string,
  edge: string,
  textInk: string,
  size: number,
  textStyle: ComponentTextStyle | undefined,
  palette: Palette,
): boolean {
  const definition = proposalComponentForKind(kind);
  if (!definition?.section.startsWith("Decision modelling") || definition.archetype === "connector") return false;
  const { x, y, w, h } = bounds;
  const fields = group.libraryComponent?.componentFields ?? [];
  const value = (key: string) => fields.find(item => item.key === key)?.value.trim() ?? "";
  const fieldLabel = (key: string) => fields.find(item => item.key === key)?.label ?? key.replace(/-/g, " ");
  const compactLabels: Record<string, string> = { "event-definition": "Definition", behavior: "Behavior", flow: "Flow", "outputs-policy": "Policy", "source-target": "Participants", "associated-work": "Activity" };
  const panel = (radius = 4, dash: number[] = []) => {
    ctx.beginPath(); roundRect(ctx, x + 1, y + 1, w - 2, h - 2, radius);
    if (fill !== "transparent") { ctx.fillStyle = fill; ctx.fill(); }
    ctx.strokeStyle = edge; ctx.lineWidth = 1.4; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
  };
  const rule = (y1: number, x1 = x + 1, x2 = x + w - 1, dash: number[] = []) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y1); ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
  };
  const title = (stereotype: string, left = x + 10, top = y + 16, width = w - 20, centered = false, displayName = name) => {
    fittedComponentText(ctx, `${stereotype}`, bounds, centered ? left + width / 2 : left, top, width, 9, palette.accent, 600, centered ? "center" : "left", textStyle, 1);
    fittedComponentText(ctx, displayName, bounds, centered ? left + width / 2 : left, top + 19, width, Math.min(size, 14), textInk, 650, centered ? "center" : "left", textStyle, 2);
  };
  const rows = (keys: string[], top: number, bottom: number, left = x + 10, width = w - 20, font = Math.min(11, size * .68)) => {
    const visible = keys.map(key => ({ key, text: value(key) })).filter(item => item.text);
    if (!visible.length || bottom <= top) return;
    const rowHeight = (bottom - top) / visible.length;
    visible.forEach((item, index) => {
      const rowTop = top + rowHeight * index;
      if (index) rule(rowTop, left - 2, left + width + 2);
      const detail = `${compactLabels[item.key] ?? fieldLabel(item.key)}: ${item.text.replace(/\s*\n\s*/g, " | ")}`;
      fittedComponentText(ctx, detail, bounds, left, rowTop + rowHeight / 2, width, Math.min(font, rowHeight * .72), textInk, 400, "left", textStyle, rowHeight >= 20 ? 2 : 1);
    });
  };

  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (/proposal-decision-(?:conditional|escalation|compensation|link|multiple|parallel-multiple|cancel)-event$/.test(kind)) {
    const radius = Math.max(18, Math.min(29, h * .22, w * .12)); const cx = x + radius + 12; const cy = y + h / 2;
    const behavior = value("behavior").toLowerCase(); const nonInterrupting = behavior.includes("non-interrupt");
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = nonInterrupting ? 1.5 : 2.4; ctx.setLineDash(nonInterrupting ? [4, 3] : []); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.fillStyle = edge;
    if (kind.endsWith("conditional-event")) { ctx.beginPath(); ctx.moveTo(cx - 7, cy - 9); ctx.lineTo(cx + 7, cy - 9); ctx.lineTo(cx + 7, cy + 3); ctx.lineTo(cx, cy + 9); ctx.lineTo(cx - 7, cy + 3); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - 4, cy - 3); ctx.lineTo(cx + 4, cy - 3); ctx.moveTo(cx - 4, cy + 1); ctx.lineTo(cx + 4, cy + 1); ctx.stroke(); }
    else if (kind.endsWith("escalation-event")) { ctx.beginPath(); ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy - 8); ctx.lineTo(cx - 6, cy - 2); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx + 6, cy - 2); ctx.stroke(); }
    else if (kind.endsWith("compensation-event")) { ctx.beginPath(); ctx.moveTo(cx - 8, cy); ctx.lineTo(cx - 1, cy - 6); ctx.lineTo(cx - 1, cy + 6); ctx.closePath(); ctx.moveTo(cx + 1, cy); ctx.lineTo(cx + 8, cy - 6); ctx.lineTo(cx + 8, cy + 6); ctx.closePath(); ctx.stroke(); }
    else if (kind.endsWith("link-event")) { ctx.beginPath(); ctx.arc(cx - 4, cy, 5, -.8, 2.3); ctx.moveTo(cx + 8, cy); ctx.arc(cx + 4, cy, 5, 2.3, 5.5); ctx.stroke(); }
    else if (kind.endsWith("parallel-multiple-event")) { ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8); ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy); ctx.moveTo(cx - 6, cy - 6); ctx.lineTo(cx + 6, cy + 6); ctx.moveTo(cx + 6, cy - 6); ctx.lineTo(cx - 6, cy + 6); ctx.stroke(); }
    else if (kind.endsWith("multiple-event")) { for (const [dx, dy] of [[0, -7], [7, 0], [0, 7], [-7, 0]]) { ctx.beginPath(); ctx.moveTo(cx + dx, cy + dy - 2); ctx.lineTo(cx + dx + 2, cy + dy); ctx.lineTo(cx + dx, cy + dy + 2); ctx.lineTo(cx + dx - 2, cy + dy); ctx.closePath(); ctx.fill(); } }
    else { ctx.beginPath(); ctx.moveTo(cx - 7, cy - 7); ctx.lineTo(cx + 7, cy + 7); ctx.moveTo(cx + 7, cy - 7); ctx.lineTo(cx - 7, cy + 7); ctx.stroke(); }
    const contentX = x + radius * 2 + 22; const contentWidth = Math.max(24, w - (contentX - x) - 10);
    title("BPMN event", contentX, y + 14, contentWidth);
    rows(["trigger", "event-definition", "behavior", "flow"], y + 54, y + h - 4, contentX, contentWidth, Math.min(10, size * .62));
  } else if (/proposal-decision-(?:event-subprocess|transaction-subprocess|ad-hoc-subprocess)$/.test(kind)) {
    const dash = kind.endsWith("event-subprocess") ? [2, 3] : kind.endsWith("ad-hoc-subprocess") ? [7, 4] : [];
    panel(2, dash);
    if (kind.endsWith("transaction-subprocess")) { ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.strokeRect(x + 5, y + 5, w - 10, h - 10); }
    title(kind.endsWith("event-subprocess") ? "event subprocess" : kind.endsWith("transaction-subprocess") ? "transaction" : "ad hoc");
    rule(y + 44);
    rows(["purpose", "participants", "completion", "messages"], y + 45, y + h - 3);
    if (kind.endsWith("ad-hoc-subprocess")) fittedComponentText(ctx, "~", bounds, x + w - 16, y + h - 9, 12, 13, edge, 700, "center", textStyle, 1);
    else if (kind.endsWith("event-subprocess")) fittedComponentText(ctx, "O", bounds, x + w - 17, y + h - 10, 14, 11, edge, 700, "center", textStyle, 1);
  } else if (kind.endsWith("choreography-task") || kind.endsWith("call-choreography")) {
    panel(3);
    if (kind.endsWith("call-choreography")) { ctx.strokeStyle = edge; ctx.lineWidth = 2.5; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4); }
    const top = value("participants").split(/[\r\n,]+/).map(item => item.trim()).filter(Boolean);
    const bandHeight = Math.min(24, h * .18);
    ctx.fillStyle = palette.soft; ctx.fillRect(x + 2, y + 2, w - 4, bandHeight);
    ctx.fillRect(x + 2, y + h - bandHeight - 2, w - 4, bandHeight);
    rule(y + bandHeight + 2); rule(y + h - bandHeight - 2);
    fittedComponentText(ctx, top[0] ?? "Participant", bounds, x + 9, y + bandHeight / 2 + 2, w - 18, 9, textInk, 600, "left", textStyle, 1);
    fittedComponentText(ctx, top[1] ?? "Participant", bounds, x + 9, y + h - bandHeight / 2 - 2, w - 18, 9, textInk, 600, "left", textStyle, 1);
    fittedComponentText(ctx, name, bounds, x + 10, y + bandHeight + 14, w - 20, Math.min(size, 13), textInk, 650, "center", textStyle, 1);
    const details = [["Purpose", value("purpose")], ["Completion", value("completion")], ["Messages", value("messages")]].filter(([, detail]) => detail);
    details.forEach(([label, detail], index) => fittedComponentText(ctx, `${label}: ${detail}`, bounds, x + 10, y + bandHeight + 27 + index * 11, w - 20, 8, palette.muted, 400, "center", textStyle, 1));
  } else if (kind.endsWith("conversation-node")) {
    const inset = Math.min(18, w * .12);
    ctx.beginPath(); ctx.moveTo(x + inset, y + 1); ctx.lineTo(x + w - inset, y + 1); ctx.lineTo(x + w - 1, y + h / 2); ctx.lineTo(x + w - inset, y + h - 1); ctx.lineTo(x + inset, y + h - 1); ctx.lineTo(x + 1, y + h / 2); ctx.closePath(); ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.stroke();
    title("conversation", x + 18, y + 12, w - 36, true); rows(["purpose", "participants", "completion", "messages"], y + 49, y + h - 3, x + 18, w - 36, Math.min(9, size * .58));
  } else if (kind.endsWith("bpmn-message")) {
    panel(2); const left = x + 15; const top = y + 18; const iconW = Math.min(45, w * .2); const iconH = 30;
    ctx.strokeStyle = edge; ctx.lineWidth = 1.4; ctx.strokeRect(left, top, iconW, iconH); ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left + iconW / 2, top + iconH * .56); ctx.lineTo(left + iconW, top); ctx.stroke();
    const textLeft = left + iconW + 12; const textWidth = w - (textLeft - x) - 10;
    title("message", textLeft, y + 14, textWidth); rows(["message-name", "payload", "correlation", "source-target"], y + 54, y + h - 4, textLeft, textWidth, Math.min(10, size * .62));
  } else if (/proposal-decision-data-(?:input|output)$/.test(kind)) {
    const fold = Math.min(18, w * .13); ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + w - fold, y + 1); ctx.lineTo(x + w - 1, y + fold); ctx.lineTo(x + w - 1, y + h - 1); ctx.lineTo(x + 1, y + h - 1); ctx.closePath(); ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w - fold, y + 1); ctx.lineTo(x + w - fold, y + fold); ctx.lineTo(x + w - 1, y + fold); ctx.stroke();
    title(kind.endsWith("data-input") ? "data input" : "data output"); rule(y + 44); rows(["data-name", "structure", "direction", "associated-work"], y + 45, y + h - 3);
  } else if (kind.endsWith("data-collection")) {
    panel(1); const cy = y + 17; ctx.beginPath(); ctx.ellipse(x + w / 2, cy, w * .48, 9, 0, 0, Math.PI * 2); ctx.fillStyle = palette.soft; ctx.fill(); ctx.strokeStyle = edge; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 2, cy); ctx.lineTo(x + 2, y + h - 14); ctx.moveTo(x + w - 2, cy); ctx.lineTo(x + w - 2, y + h - 14); ctx.ellipse(x + w / 2, y + h - 14, w * .48, 9, 0, 0, Math.PI); ctx.stroke();
    title("data collection", x + 12, y + 8, w - 24, true); rows(["data-name", "structure", "direction", "associated-work"], y + 50, y + h - 16);
  } else if (/proposal-decision-dmn-decision-table$/.test(kind)) {
    panel(2);
    fittedComponentText(ctx, value("question") || name, bounds, x + 10, y + 17, w - 20, Math.min(13, size), textInk, 650, "left", textStyle, 2);
    const inputNames = value("inputs").split(/\r?\n/).map(item => item.trim()).filter(Boolean).slice(0, 3);
    const outputSpec = value("outputs-policy");
    const outputName = outputSpec.replace(/hit\s*policy\s*[:=].*$/im, "").replace(/^\s*outputs?\s*[:=]\s*/i, "").trim();
    const headers = [...inputNames.map(item => item.split(/[:(]/)[0].trim()), outputName || "Output"];
    const policy = (outputSpec.match(/(?:hit\s*policy\s*[:=]\s*)?(unique|first|any|collect|rule\s*order|output\s*order|priority|any\s*order)/i)?.[1] ?? "FIRST").toUpperCase();
    const gridTop = y + 38; const gridBottom = y + h - 19; const rowsData = value("rules").split(/\r?\n/).map(line => line.split("|").map(cell => cell.trim())).filter(cells => cells.some(Boolean)).slice(0, 4);
    const displayedRows = Math.max(2, rowsData.length + 1); const rowHeight = Math.max(15, (gridBottom - gridTop) / displayedRows); const columnWidth = (w - 2) / headers.length;
    ctx.fillStyle = palette.soft; ctx.fillRect(x + 1, gridTop, w - 2, rowHeight);
    for (let column = 0; column <= headers.length; column++) { const columnX = x + columnWidth * column; ctx.beginPath(); ctx.moveTo(columnX, gridTop); ctx.lineTo(columnX, gridTop + rowHeight * displayedRows); ctx.strokeStyle = edge; ctx.lineWidth = .9; ctx.stroke(); }
    for (let row = 0; row <= displayedRows; row++) rule(gridTop + rowHeight * row, x + 1, x + w - 1);
    headers.forEach((header, index) => fittedComponentText(ctx, header, bounds, x + columnWidth * index + columnWidth / 2, gridTop + rowHeight / 2, columnWidth - 6, 9, textInk, 650, "center", textStyle, 1));
    rowsData.forEach((cells, rowIndex) => headers.forEach((_, colIndex) => fittedComponentText(ctx, cells[colIndex] ?? "-", bounds, x + columnWidth * colIndex + columnWidth / 2, gridTop + rowHeight * (rowIndex + 1.5), columnWidth - 6, 9, textInk, 400, "center", textStyle, 1)));
    fittedComponentText(ctx, `Hit policy: ${policy}`, bounds, x + 9, y + h - 7, w - 18, 8, palette.muted, 600, "left", textStyle, 1);
  } else if (kind.endsWith("dmn-decision") || kind.endsWith("dmn-decision-service")) {
    panel(6);
    const service = kind.endsWith("dmn-decision-service");
    title(service ? "DMN decision service" : "DMN decision", x + 10, y + 9, w - 20);
    rule(y + 42);
    rows(service ? ["service", "inputs", "decisions", "outputs"] : ["question", "inputs", "logic", "result"], y + 44, y + h - 3, x + 10, w - 20, Math.min(10, size * .65));
  } else if (kind.endsWith("dmn-input-data") || kind.endsWith("dmn-knowledge-source") || kind.endsWith("business-knowledge-model")) {
    const knowledge = !kind.endsWith("dmn-input-data"); const side = knowledge ? Math.min(22, w * .12) : 0;
    ctx.beginPath();
    if (knowledge) { ctx.moveTo(x + side, y + 1); ctx.lineTo(x + w - 1, y + 1); ctx.lineTo(x + w - side, y + h - 1); ctx.lineTo(x + 1, y + h - 1); ctx.closePath(); }
    else ctx.rect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.stroke();
    const stereotype = kind.endsWith("business-knowledge-model") ? "business knowledge model" : knowledge ? "knowledge source" : "input data";
    title(stereotype, x + 12, y + 14, w - 24);
    const keys = kind.endsWith("dmn-input-data") ? ["variable", "source", "constraints", "consumers"] : kind.endsWith("business-knowledge-model") ? ["source", "owner", "authority", "decisions"] : ["source", "owner", "authority", "decisions"];
    rule(y + 47); rows(keys, y + 48, y + h - 3);
  } else if (kind.endsWith("dmn-context-expression")) {
    panel(3); title("context expression", x + 10, y + 14, w - 20, false, value("context") || name); rule(y + 44);
    const entries = value("entries").split(/\r?\n/).filter(Boolean).slice(0, 3);
    const lines = [...entries, value("result") ? `Result: ${value("result")}` : "", value("type") ? `Type: ${value("type")}` : ""].filter(Boolean);
    const rowHeight = Math.max(13, (h - 49) / Math.max(1, lines.length));
    lines.forEach((line, index) => fittedComponentText(ctx, line, bounds, x + 11, y + 48 + rowHeight * (index + .5), w - 22, Math.min(10, size * .66), textInk, 400, "left", textStyle, 1));
  } else {
    panel(definition.archetype === "boundary" ? 1 : 5, definition.archetype === "boundary" ? [6, 4] : []);
    title(kind.endsWith("call-choreography") ? "call choreography" : "BPMN element");
    rows((fields.map(field => field.key)), y + 44, y + h - 2);
  }
  ctx.restore();
  return true;
}

function drawProposalDataComponent(
  ctx: CanvasRenderingContext2D,
  group: GroupElement,
  bounds: { x: number; y: number; w: number; h: number },
  kind: string,
  name: string,
  fill: string,
  edge: string,
  textInk: string,
  size: number,
  textStyle: ComponentTextStyle | undefined,
  palette: Palette,
): boolean {
  const definition = proposalComponentForKind(kind);
  if (!definition?.section.startsWith("Data & schemas") || definition.archetype === "connector") return false;
  const { x, y, w, h } = bounds; const fields = group.libraryComponent?.componentFields ?? [];
  const value = (key: string) => fields.find(item => item.key === key)?.value.trim() ?? "";
  const fieldLabel = (key: string) => fields.find(item => item.key === key)?.label ?? key.replace(/-/g, " ");
  const compactLabels: Record<string, string> = { "producer-consumer": "Producers / consumers", "source-item": "Source item", "column-families": "Families", "foreign-keys": "Dimension keys", "tracking-columns": "Tracked fields", "vector-index": "Vector index", "on-failure": "On failure" };
  const panel = (radius = 4, dashed = false) => {
    ctx.beginPath(); roundRect(ctx, x + 1, y + 1, w - 2, h - 2, radius);
    if (fill !== "transparent") { ctx.fillStyle = fill; ctx.fill(); }
    ctx.strokeStyle = edge; ctx.lineWidth = 1.4; ctx.setLineDash(dashed ? [6, 4] : []); ctx.stroke(); ctx.setLineDash([]);
  };
  const rule = (atY: number, left = x + 1, right = x + w - 1) => { ctx.beginPath(); ctx.moveTo(left, atY); ctx.lineTo(right, atY); ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke(); };
  const rows = (keys: string[], top: number, bottom: number, left = x + 9, width = w - 18, font = Math.min(10, size * .66)) => {
    if (bottom <= top || !keys.length) return;
    const rowHeight = (bottom - top) / keys.length;
    keys.forEach((key, index) => {
      const rowY = top + index * rowHeight;
      if (index) rule(rowY, left - 2, left + width + 2);
      const detail = `${compactLabels[key] ?? fieldLabel(key)}${value(key) ? `: ${value(key).replace(/\s*\n\s*/g, " | ")}` : ""}`;
      fittedComponentText(ctx, detail, bounds, left, rowY + rowHeight / 2, width, Math.min(font, rowHeight * .72), textInk, 400, "left", textStyle, rowHeight >= 20 ? 2 : 1);
    });
  };
  const databaseRows = (rowKeys: string[], top: number, bottom: number, inset: number) => {
    if (bottom <= top || !rowKeys.length) return;
    const rowHeight = (bottom - top) / rowKeys.length; const left = x + inset + 7; const width = Math.max(4, w - (inset + 7) * 2);
    rowKeys.forEach((key, index) => {
      const rowY = top + index * rowHeight;
      if (index) rule(rowY, x + inset + 2, x + w - inset - 2);
      const detail = `${compactLabels[key] ?? fieldLabel(key)}${value(key) ? `: ${value(key).replace(/\s*\n\s*/g, " | ")}` : ""}`;
      fittedComponentText(ctx, detail, bounds, left, rowY + rowHeight / 2, width, Math.min(10, size * .62, rowHeight * .72), textInk, 400, "left", textStyle, rowHeight >= 20 ? 2 : 1);
    });
  };
  const graphInsetAt = (localY: number) => {
    const midHeight = Math.max(1, h / 2); const ratio = Math.min(1, Math.max(0, Math.min(localY, h - localY) / midHeight));
    return 1 + Math.max(0, w * .16 - 1) * (1 - ratio);
  };
  const graphRows = (rowKeys: string[], top: number, bottom: number) => {
    if (bottom <= top || !rowKeys.length) return;
    const rowHeight = (bottom - top) / rowKeys.length;
    rowKeys.forEach((key, index) => {
      const rowY = top + index * rowHeight; const inset = Math.max(graphInsetAt(rowY + 2 - y), graphInsetAt(rowY + rowHeight - 2 - y));
      const left = x + inset + 7; const width = Math.max(4, w - 2 * (inset + 7));
      if (index) rule(rowY, x + inset + 3, x + w - inset - 3);
      const detail = `${compactLabels[key] ?? fieldLabel(key)}${value(key) ? `: ${value(key).replace(/\s*\n\s*/g, " | ")}` : ""}`;
      fittedComponentText(ctx, detail, bounds, left, rowY + rowHeight / 2, width, Math.min(9, size * .58, rowHeight * .72), textInk, 400, "left", textStyle, rowHeight >= 20 ? 2 : 1);
    });
  };
  const heading = (caption = name, top = y + 16, left = x + 10, width = w - 20) => {
    fittedComponentText(ctx, caption, bounds, left, top, width, Math.min(size, 13), textInk, 650, "left", textStyle, 2);
  };
  const keys = fields.map(field => field.key);
  const tableRows = (top = y + 35, bottom = y + h - 3) => {
    const headerHeight = Math.min(30, Math.max(24, h * .23));
    ctx.fillStyle = palette.soft; ctx.fillRect(x + 2, y + 2, w - 4, headerHeight);
    rule(y + headerHeight);
    const dataTop = Math.max(top, y + headerHeight + 2);
    const count = Math.max(1, keys.length); const rowHeight = Math.max(1, (bottom - dataTop) / count);
    rows(keys, dataTop, bottom, x + 8, w - 16, Math.min(10, size * .62));
    return rowHeight;
  };
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (definition.archetype === "database" || kind.endsWith("document-collection")) {
    const ry = Math.min(11, h * .11); const inset = Math.min(13, w * .08); const cx = x + w / 2;
    ctx.beginPath(); ctx.moveTo(x + inset, y + ry); ctx.bezierCurveTo(x + inset, y - 1, x + w - inset, y - 1, x + w - inset, y + ry); ctx.lineTo(x + w - inset, y + h - ry); ctx.bezierCurveTo(x + w - inset, y + h + 1, x + inset, y + h + 1, x + inset, y + h - ry); ctx.closePath();
    if (fill !== "transparent") { ctx.fillStyle = fill; ctx.fill(); } ctx.strokeStyle = edge; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, y + ry, (w - inset * 2) / 2, ry, 0, 0, Math.PI * 2); ctx.stroke();
    heading(name, y + 31, x + inset + 7, w - 2 * (inset + 7)); databaseRows(keys, y + 44, y + h - ry - 2, inset);
  } else if (kind.endsWith("graph-vertex")) {
    ctx.beginPath(); ctx.moveTo(x + w * .16, y + 1); ctx.lineTo(x + w * .84, y + 1); ctx.lineTo(x + w - 1, y + h / 2); ctx.lineTo(x + w * .84, y + h - 1); ctx.lineTo(x + w * .16, y + h - 1); ctx.lineTo(x + 1, y + h / 2); ctx.closePath();
    if (fill !== "transparent") { ctx.fillStyle = fill; ctx.fill(); } ctx.strokeStyle = edge; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.moveTo(x + w * .16, y + 1); ctx.lineTo(x + w * .84, y + 1); ctx.lineTo(x + w - 1, y + h / 2); ctx.lineTo(x + w * .84, y + h - 1); ctx.lineTo(x + w * .16, y + h - 1); ctx.lineTo(x + 1, y + h / 2); ctx.closePath(); ctx.clip();
    const titleWidth = w * .62; fittedComponentText(ctx, value("type") || name, bounds, x + w / 2, y + 19, titleWidth, Math.min(size, 13), textInk, 650, "center", textStyle, 1);
    rule(y + 32, x + w * .15, x + w * .85); graphRows(keys.filter(key => key !== "type"), y + 36, y + h - 4); ctx.restore();
  } else if (kind.endsWith("graph-edge-type")) {
    panel(5); ctx.strokeStyle = edge; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x + 10, y + 25); ctx.lineTo(x + w - 16, y + 25); ctx.lineTo(x + w - 23, y + 19); ctx.moveTo(x + w - 16, y + 25); ctx.lineTo(x + w - 23, y + 31); ctx.stroke();
    heading(value("type") || name, y + 17); rule(y + 39); rows(keys.filter(key => key !== "type"), y + 42, y + h - 3);
  } else if (kind.endsWith("wide-column-table")) {
    panel(2); tableRows(); heading(value("table") || name, y + 17);
    const markerX = x + w - 25; ctx.strokeStyle = edge; ctx.beginPath(); ctx.moveTo(markerX, y + 2); ctx.lineTo(markerX, y + 29); ctx.stroke();
  } else if (kind.endsWith("table-partition") || kind.endsWith("star-schema-boundary")) {
    panel(2, true); heading(value("partition") || value("fact") || name, y + 17); rule(y + 34);
    if (kind.endsWith("star-schema-boundary")) {
      const center = { x: x + w / 2, y: y + 62 }; const nodes = [x + 30, x + w - 30, x + w / 2];
      nodes.forEach((nodeX, index) => { ctx.beginPath(); ctx.moveTo(center.x, center.y); ctx.lineTo(nodeX, y + 45 + (index === 2 ? 28 : 5)); ctx.strokeStyle = edge; ctx.stroke(); });
      roundRect(ctx, center.x - 21, center.y - 10, 42, 20, 2); ctx.fillStyle = palette.soft; ctx.fill(); ctx.stroke();
      nodes.forEach((nodeX, index) => { roundRect(ctx, nodeX - 22, index === 2 ? y + 73 : y + 39, 44, 18, 2); ctx.stroke(); });
      rows(keys, y + 103, y + h - 3, x + 9, w - 18, 8);
    } else rows(keys, y + 37, y + h - 3);
  } else if (kind.endsWith("data-classification-badge")) {
    const classification = value("classification").toLowerCase(); const badgeColor = classification.includes("restrict") ? "#b34a4a" : classification.includes("confidential") ? "#bd7921" : classification.includes("internal") ? "#426da7" : "#39815c";
    panel(12); roundRect(ctx, x + 9, y + 9, Math.min(w - 18, 112), 24, 12); ctx.fillStyle = badgeColor; ctx.fill();
    fittedComponentText(ctx, value("classification") || "Classification", bounds, x + 15, y + 21, Math.min(w - 30, 100), 9, "#ffffff", 700, "left", textStyle, 1);
    rows(keys.filter(key => key !== "classification"), y + 40, y + h - 3);
  } else if (kind.endsWith("data-quality-check")) {
    panel(5); const status = /pass|ok|valid/i.test(value("severity"));
    ctx.beginPath(); roundRect(ctx, x + 9, y + 10, 18, 18, 3); ctx.strokeStyle = edge; ctx.stroke();
    if (status) { ctx.beginPath(); ctx.moveTo(x + 13, y + 19); ctx.lineTo(x + 17, y + 23); ctx.lineTo(x + 24, y + 14); ctx.stroke(); }
    heading(value("rule") || name, y + 21, x + 34, w - 44); rule(y + 37); rows(keys.filter(key => key !== "rule"), y + 40, y + h - 3);
  } else if (definition.archetype === "table" && !/primary-key|foreign-key/.test(kind)) {
    panel(2); tableRows(); heading(value("store") || value("table") || value("type-name") || value("event-name") || value("contract") || name, y + 17);
  } else if (kind.endsWith("data-contract") || kind.endsWith("json-schema-object") || kind.endsWith("graphql-resolver") || kind.endsWith("standalone-database-column")) {
    const fold = Math.min(18, w * .12); ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + w - fold, y + 1); ctx.lineTo(x + w - 1, y + fold); ctx.lineTo(x + w - 1, y + h - 1); ctx.lineTo(x + 1, y + h - 1); ctx.closePath();
    if (fill !== "transparent") { ctx.fillStyle = fill; ctx.fill(); } ctx.strokeStyle = edge; ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + w - fold, y + 1); ctx.lineTo(x + w - fold, y + fold); ctx.lineTo(x + w - 1, y + fold); ctx.stroke();
    heading(value("contract") || value("title") || value("column") || value("parent-field") || name, y + 18); rule(y + 36); rows(keys, y + 39, y + h - 3);
  } else if (/primary-key|foreign-key|unique-constraint|check-constraint/.test(kind)) {
    panel(4); const badge = kind.includes("primary") ? "PK" : kind.includes("foreign") ? "FK" : kind.includes("unique") ? "UN" : "CK";
    roundRect(ctx, x + 9, y + 9, 30, 20, 4); ctx.fillStyle = palette.soft; ctx.fill(); ctx.strokeStyle = edge; ctx.stroke();
    fittedComponentText(ctx, badge, bounds, x + 24, y + 19, 25, 9, textInk, 700, "center", textStyle, 1);
    heading(value("constraint") || name, y + 20, x + 47, w - 56); rule(y + 36); rows(keys.filter(key => key !== "constraint"), y + 39, y + h - 3);
  } else {
    panel(5); heading(value("store") || value("dataset") || value("type-name") || value("index") || value("type") || name, y + 17); rule(y + 35); rows(keys, y + 38, y + h - 3);
  }
  ctx.restore();
  return true;
}

function drawProposalArchitectureComponent(
  ctx: CanvasRenderingContext2D,
  group: GroupElement,
  bounds: { x: number; y: number; w: number; h: number },
  kind: string,
  name: string,
  fill: string,
  edge: string,
  textInk: string,
  size: number,
  textStyle: ComponentTextStyle | undefined,
  palette: Palette,
): boolean {
  const definition = proposalComponentForKind(kind);
  if (!definition?.section.startsWith("Architecture patterns")) return false;
  const { x, y, w, h } = bounds; const fields = group.libraryComponent?.componentFields ?? [];
  const value = (key: string) => fields.find(item => item.key === key)?.value.trim() ?? "";
  const fieldLabel = (key: string) => fields.find(item => item.key === key)?.label ?? key.replace(/-/g, " ");
  const keys = fields.map(field => field.key);
  const frame = (radius = 6, dashed = false) => {
    ctx.beginPath(); roundRect(ctx, x + 1, y + 1, w - 2, h - 2, radius);
    if (fill !== "transparent") { ctx.fillStyle = fill; ctx.fill(); }
    ctx.strokeStyle = edge; ctx.lineWidth = 1.4; ctx.setLineDash(dashed ? [6, 4] : []); ctx.stroke(); ctx.setLineDash([]);
  };
  const rule = (atY: number, left = x + 1, right = x + w - 1) => { ctx.beginPath(); ctx.moveTo(left, atY); ctx.lineTo(right, atY); ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke(); };
  const text = (copy: string, tx: number, ty: number, width: number, font = 10, weight = 400, align: CanvasTextAlign = "left", maxLines = 1) =>
    fittedComponentText(ctx, copy, bounds, align === "center" || align === "right" ? componentBoxTextAnchor(tx, width, align) : tx, ty, width, font, textInk, weight, align, textStyle, maxLines);
  const heading = (copy = name, ty = y + 19, tx = x + 10, width = w - 20) => text(copy, tx, ty, width, Math.min(size, 13), 650, "left", 2);
  const rows = (rowKeys: string[] = keys, top = y + 43, bottom = y + h - 3, left = x + 10, width = w - 20) => {
    if (bottom <= top || !rowKeys.length) return;
    const rowHeight = (bottom - top) / rowKeys.length;
    rowKeys.forEach((key, index) => {
      const rowY = top + rowHeight * index;
      if (index) rule(rowY, left - 2, left + width + 2);
      const current = value(key);
      text(`${fieldLabel(key)}${current ? `: ${current.replace(/\s*\n\s*/g, " | ")}` : ""}`, left, rowY + rowHeight / 2, width, Math.min(9, size * .62, rowHeight * .66), 400, "left", rowHeight >= 20 ? 2 : 1);
    });
  };
  const box = (bx: number, by: number, bw: number, bh: number, radius = 3, color = palette.soft) => {
    roundRect(ctx, bx, by, bw, bh, radius); if (color !== "transparent") { ctx.fillStyle = color; ctx.fill(); }
    ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke();
  };
  const line = (x1: number, y1: number, x2: number, y2: number, dashed = false) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = edge; ctx.lineWidth = 1.4; ctx.setLineDash(dashed ? [4, 3] : []); ctx.stroke(); ctx.setLineDash([]);
  };
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.lineCap = "round"; ctx.lineJoin = "round";

  if (kind === "proposal-architecture-web-frontend" || kind === "proposal-architecture-mobile-client") {
    frame(8); const band = Math.min(27, h * .2); ctx.fillStyle = palette.soft; ctx.fillRect(x + 2, y + 2, w - 4, band);
    rule(y + band + 1); [0, 1, 2].forEach(index => { ctx.beginPath(); ctx.arc(x + 12 + index * 8, y + band / 2 + 1, 2, 0, Math.PI * 2); ctx.fillStyle = palette.muted; ctx.fill(); });
    heading(value("application") || name, y + band + 15); rows(keys.filter(key => key !== "application"), y + band + 29);
  } else if (kind === "proposal-architecture-api-operation" || kind === "proposal-architecture-graphql-endpoint" || kind === "proposal-architecture-grpc-service" || kind === "proposal-architecture-webhook-endpoint") {
    frame(5); const badge = kind.endsWith("api-operation") ? (value("method-path").split(/\s+/)[0] || "HTTP") : kind.endsWith("graphql-endpoint") ? "GRAPHQL" : kind.endsWith("grpc-service") ? "gRPC" : "WEBHOOK";
    box(x + 9, y + 8, Math.min(w * .36, 68), 21, 4); text(badge.toUpperCase(), x + 12, y + 18, Math.min(w * .36, 62), 8, 700, "center");
    const primary = kind.endsWith("api-operation") ? "method-path" : kind.endsWith("graphql-endpoint") ? "endpoint" : kind.endsWith("grpc-service") ? "service" : "route-event";
    heading(value(primary) || name, y + 20, x + Math.min(w * .36, 68) + 17, w - Math.min(w * .36, 68) - 26); rule(y + 36);
    rows(keys.filter(key => key !== primary), y + 39);
  } else if (/background-worker|batch-job|scheduler/.test(kind)) {
    frame(7); const cx = x + 24; const cy = y + 24; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.strokeStyle = edge; ctx.stroke();
    if (kind.endsWith("scheduler")) { ctx.beginPath(); ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy); ctx.lineTo(cx + 6, cy + 3); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 6, cy); ctx.lineTo(cx + 2, cy - 4); ctx.moveTo(cx + 6, cy); ctx.lineTo(cx + 2, cy + 4); ctx.stroke(); }
    heading(name, y + 20, x + 43, w - 53); rule(y + 39); rows(keys, y + 42);
  } else if (/event-producer|event-consumer|event-topic|stream-partition/.test(kind)) {
    const partition = kind.endsWith("stream-partition"); frame(partition ? 2 : 8, partition);
    if (partition) {
      heading(value("partition") || name, y + 19); rule(y + 34);
      const col = (w - 24) / 4; for (let index = 0; index < 4; index++) { box(x + 10 + index * col, y + 39, Math.max(8, col - 3), 13, 2, index === 0 ? palette.accent : palette.soft); text(String(index), x + 10 + index * col, y + 45, Math.max(8, col - 3), 7, 600, "center"); }
      rows(keys.filter(key => key !== "partition"), y + 57);
    } else {
      const producer = kind.endsWith("event-producer"); const consumer = kind.endsWith("event-consumer");
      box(x + 9, y + 9, 32, 22, 4); text(producer ? "PUB" : consumer ? "SUB" : "BUS", x + 11, y + 20, 28, 8, 700, "center");
      const primary = producer ? "producer" : consumer ? "consumer" : "topic";
      heading(value(primary) || name, y + 21, x + 49, w - 59); rule(y + 38);
      const detailKeys = kind.endsWith("event-topic") ? keys.filter(key => key !== "topic") : keys.filter(key => key !== primary);
      rows(detailKeys, y + 41);
    }
  } else if (/saga-orchestrator|saga-participant/.test(kind)) {
    frame(5); heading(value(kind.endsWith("saga-orchestrator") ? "saga" : "participant") || name);
    const midY = y + 39; const stageWidth = Math.max(24, (w - 40) / 3);
    for (let index = 0; index < 3; index++) {
      const sx = x + 10 + index * (stageWidth + 10); box(sx, midY, stageWidth, 16, 3, index === 1 ? palette.soft : fill);
      text(["Step", "Commit", "Compensate"][index], sx + 2, midY + 8, stageWidth - 4, 7, 500, "center");
      if (index < 2) { line(sx + stageWidth + 1, midY + 8, sx + stageWidth + 8, midY + 8); ctx.beginPath(); ctx.moveTo(sx + stageWidth + 5, midY + 5); ctx.lineTo(sx + stageWidth + 8, midY + 8); ctx.lineTo(sx + stageWidth + 5, midY + 11); ctx.stroke(); }
    }
    rule(y + 61); rows(keys.filter(key => key !== (kind.endsWith("saga-orchestrator") ? "saga" : "participant")), y + 64);
  } else if (kind.endsWith("transactional-outbox") || kind.endsWith("change-data-capture")) {
    frame(5); heading(name); const cy = y + 38; box(x + 10, cy, 37, 24, 3); text(kind.endsWith("transactional-outbox") ? "DB" : "LOG", x + 12, cy + 12, 33, 8, 700, "center");
    line(x + 48, cy + 12, x + w - 50, cy + 12); ctx.beginPath(); ctx.moveTo(x + w - 56, cy + 8); ctx.lineTo(x + w - 50, cy + 12); ctx.lineTo(x + w - 56, cy + 16); ctx.stroke();
    box(x + w - 47, cy, 37, 24, 3); text("BUS", x + w - 45, cy + 12, 33, 8, 700, "center"); rule(y + 68); rows(keys, y + 71);
  } else if (kind.endsWith("service-mesh-sidecar")) {
    frame(6); heading(name); const top = y + 34; const cardWidth = (w - 32) / 2;
    box(x + 10, top, cardWidth, 24); text("Workload", x + 12, top + 12, cardWidth - 4, 8, 600, "center");
    box(x + 22 + cardWidth, top, cardWidth, 24); text("Sidecar proxy", x + 24 + cardWidth, top + 12, cardWidth - 4, 8, 600, "center");
    line(x + 10 + cardWidth, top + 12, x + 20 + cardWidth, top + 12);
    rule(y + 64); rows(keys, y + 67);
  } else if (kind.endsWith("circuit-breaker")) {
    frame(6); heading(name, y + 16); const state = value("fallback").toLowerCase(); const labels = ["Closed", "Open", "Half-open"];
    const statusY = y + 32; const cellWidth = (w - 26) / 3;
    labels.forEach((label, index) => { const bx = x + 10 + index * cellWidth; const active = state.includes(label.toLowerCase()); box(bx, statusY, cellWidth - 4, 19, 4, active ? palette.accent : palette.soft); text(label, bx + 1, statusY + 9, cellWidth - 6, 7, 600, "center"); });
    rule(y + 56); rows(keys, y + 59);
  } else if (kind.endsWith("adapter")) {
    frame(6); heading(name); const mid = y + 40; const half = (w - 40) / 2;
    box(x + 10, mid, half, 22); text("Source", x + 12, mid + 11, half - 4, 8, 600, "center");
    box(x + w - half - 10, mid, half, 22); text("Target", x + w - half - 8, mid + 11, half - 4, 8, 600, "center");
    line(x + half + 12, mid + 11, x + w - half - 12, mid + 11); rule(y + 69); rows(keys, y + 72);
  } else if (kind.endsWith("backend-for-frontend")) {
    frame(6); heading(name); const cy = y + 42; const clientWidth = 43; const serviceWidth = 42;
    box(x + 9, cy - 8, clientWidth, 22); text("Client", x + 11, cy + 3, clientWidth - 4, 7, 600, "center");
    box(x + w / 2 - 29, cy - 8, 58, 22); text("BFF", x + w / 2 - 27, cy + 3, 54, 8, 700, "center");
    box(x + w - serviceWidth - 9, cy - 8, serviceWidth, 22); text("APIs", x + w - serviceWidth - 7, cy + 3, serviceWidth - 4, 7, 600, "center");
    line(x + 53, cy + 3, x + w / 2 - 30, cy + 3); line(x + w / 2 + 30, cy + 3, x + w - serviceWidth - 10, cy + 3); rule(y + 67); rows(keys, y + 70);
  } else if (kind.endsWith("bounded-context")) {
    frame(2, true); heading(value("context") || name, y + 20); text("BOUNDARY / UBIQUITOUS LANGUAGE", x + 10, y + 37, w - 20, 7, 600);
    rule(y + 47); rows(keys.filter(key => key !== "context"), y + 50);
  } else if (kind.endsWith("aggregate-root")) {
    frame(4, true); heading(value("root") || name, y + 18); box(x + 12, y + 31, w - 24, 22, 3); text("Aggregate root", x + 14, y + 42, w - 28, 8, 700, "center");
    rule(y + 59); rows(keys.filter(key => key !== "root"), y + 62);
  } else if (kind.endsWith("domain-entity")) {
    frame(4); ctx.fillStyle = palette.soft; ctx.fillRect(x + 2, y + 2, w - 4, 27); heading(value("entity") || name, y + 17); text(`ID: ${value("entity") || "identity"}`, x + w - 62, y + 17, 52, 8, 600, "right");
    rule(y + 31); rows(keys.filter(key => key !== "entity"), y + 34);
  } else if (kind.endsWith("value-object")) {
    frame(18); box(x + 10, y + 8, 28, 19, 9); text("IMM", x + 11, y + 17, 26, 7, 700, "center"); heading(value("value") || name, y + 19, x + 45, w - 55); rule(y + 34); rows(keys.filter(key => key !== "value"), y + 37);
  } else if (kind.endsWith("domain-event")) {
    frame(6); const envelope = y + 31; ctx.beginPath(); ctx.moveTo(x + 10, envelope); ctx.lineTo(x + w - 10, envelope); ctx.lineTo(x + w - 10, envelope + 15); ctx.lineTo(x + w / 2, envelope + 28); ctx.lineTo(x + 10, envelope + 15); ctx.closePath(); ctx.strokeStyle = edge; ctx.stroke();
    heading(value("event") || name, y + 18); rule(y + 64); rows(keys.filter(key => key !== "event"), y + 67);
  } else if (kind.endsWith("application-component")) {
    frame(2); box(x + 7, y + 12, 15, 9, 1); box(x + 7, y + 25, 15, 9, 1); heading(value("component") || name, y + 22, x + 29, w - 39); rule(y + 39); rows(keys.filter(key => key !== "component"), y + 42);
  } else if (kind.endsWith("application-service")) {
    frame(6); heading(value("service") || name, y + 19); ctx.beginPath(); ctx.moveTo(x + 11, y + 29); ctx.lineTo(x + 11, y + 42); ctx.lineTo(x + 18, y + 42); ctx.moveTo(x + 11, y + 29); ctx.lineTo(x + 18, y + 29); ctx.strokeStyle = edge; ctx.stroke();
    rule(y + 44); rows(keys.filter(key => key !== "service"), y + 47);
  } else if (kind.endsWith("business-actor")) {
    frame(7); const cx = x + 26; const cy = y + 27; ctx.beginPath(); ctx.arc(cx, cy - 8, 5, 0, Math.PI * 2); ctx.strokeStyle = edge; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - 3); ctx.lineTo(cx, cy + 11); ctx.moveTo(cx - 9, cy + 2); ctx.lineTo(cx + 9, cy + 2); ctx.moveTo(cx, cy + 11); ctx.lineTo(cx - 7, cy + 19); ctx.moveTo(cx, cy + 11); ctx.lineTo(cx + 7, cy + 19); ctx.stroke();
    heading(value("actor") || name, y + 21, x + 43, w - 53); rule(y + 48); rows(keys.filter(key => key !== "actor"), y + 51);
  } else if (kind.endsWith("business-role")) {
    frame(6); box(x + 10, y + 9, 24, 24, 12); text("R", x + 11, y + 21, 22, 10, 700, "center"); heading(value("role") || name, y + 21, x + 42, w - 52); rule(y + 39); rows(keys.filter(key => key !== "role"), y + 42);
  } else if (kind.endsWith("business-process")) {
    frame(6); heading(value("process") || name, y + 18); const mid = y + 37; const bw = (w - 34) / 3;
    ["Trigger", "Work", "Result"].forEach((step, index) => { const bx = x + 9 + index * (bw + 8); box(bx, mid, bw, 16, 3); text(step, bx + 1, mid + 8, bw - 2, 7, 600, "center"); if (index < 2) line(bx + bw + 1, mid + 8, bx + bw + 7, mid + 8); });
    rule(y + 60); rows(keys.filter(key => key !== "process"), y + 63);
  } else if (kind.endsWith("data-object")) {
    const fold = Math.min(20, w * .14); ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + w - fold, y + 1); ctx.lineTo(x + w - 1, y + fold); ctx.lineTo(x + w - 1, y + h - 1); ctx.lineTo(x + 1, y + h - 1); ctx.closePath();
    if (fill !== "transparent") { ctx.fillStyle = fill; ctx.fill(); } ctx.strokeStyle = edge; ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + w - fold, y + 1); ctx.lineTo(x + w - fold, y + fold); ctx.lineTo(x + w - 1, y + fold); ctx.stroke();
    heading(value("object") || name, y + 18); rule(y + 36); rows(keys.filter(key => key !== "object"), y + 39);
  } else if (kind.endsWith("technology-node")) {
    frame(1); const dx = Math.min(16, w * .1); ctx.beginPath(); ctx.moveTo(x + dx, y + 12); ctx.lineTo(x + w / 2, y + 2); ctx.lineTo(x + w - dx, y + 12); ctx.lineTo(x + w - dx, y + h - 10); ctx.lineTo(x + w / 2, y + h - 1); ctx.lineTo(x + dx, y + h - 10); ctx.closePath(); ctx.strokeStyle = edge; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + dx, y + 12); ctx.lineTo(x + w / 2, y + 22); ctx.lineTo(x + w - dx, y + 12); ctx.moveTo(x + w / 2, y + 22); ctx.lineTo(x + w / 2, y + h - 1); ctx.stroke();
    heading(value("node") || name, y + 19); rule(y + 33, x + dx + 5, x + w - dx - 5); rows(keys.filter(key => key !== "node"), y + 36, y + h - 8, x + dx + 7, w - dx * 2 - 14);
  } else {
    frame(definition.archetype === "boundary" ? 2 : 6, definition.archetype === "boundary"); heading(); rule(y + 34); rows(keys, y + 37);
  }
  ctx.restore();
  return true;
}

function drawCleanModelComponent(ctx: CanvasRenderingContext2D, group: GroupElement, theme: Theme, allElements?: readonly Element[]) {
  const bounds = group.componentBounds; const meta = group.libraryComponent;
  if (!bounds || !meta) return;
  const { x, y, w, h } = bounds; const kind = meta.kind;
  const textStyle = meta.textStyle;
  const defaultPalette = paletteFor(theme === "dark");
  const defaultInk = defaultPalette.ink;
  const textInk = textStyle?.color ?? meta.styleOverrides?.color ?? defaultInk;
  const ink = meta.styleOverrides?.color ?? defaultInk;
  const edge = ink; const fill = meta.styleOverrides?.fillColor === null ? "transparent" : meta.styleOverrides?.fillColor ?? group.container?.background ?? defaultPalette.fill;
  const soft = defaultPalette.soft;
  const maxLabelSize = Math.max(5, Math.min(48, h - 4));
  const size = Math.min(maxLabelSize, Math.max(5, meta.textStyle?.fontSize ?? 12));
  const name = meta.label ?? kind.replace(/^(network|cloud|software|bpmn|c4)-/, "").replace(/-/g, " ");
  const field = (key: string) => componentFieldValue(group, key);
  const proposal = proposalComponentForKind(kind);
  if (proposal && drawProposalPlanningComponent(ctx, group, theme, allElements)) return;
  if (proposal && drawProposalWireframeComponent(ctx, group, theme)) return;
  if (proposal && drawProposalSystemsComponent(ctx, group, bounds, kind, name, fill, edge, textInk, size, textStyle, defaultPalette)) return;
  if (proposal && drawProposalDecisionComponent(ctx, group, bounds, kind, name, fill, edge, textInk, size, textStyle, defaultPalette)) return;
  if (proposal && drawProposalDataComponent(ctx, group, bounds, kind, name, fill, edge, textInk, size, textStyle, defaultPalette)) return;
  if (proposal && drawProposalArchitectureComponent(ctx, group, bounds, kind, name, fill, edge, textInk, size, textStyle, defaultPalette)) return;
  if (proposal) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill;
    ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (proposal.archetype === "decision") {
      ctx.beginPath(); ctx.moveTo(x + w / 2, y + 1); ctx.lineTo(x + w - 1, y + h / 2); ctx.lineTo(x + w / 2, y + h - 1); ctx.lineTo(x + 1, y + h / 2); ctx.closePath();
      if (fill !== "transparent") ctx.fill(); ctx.stroke();
    } else if (proposal.archetype === "event") {
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, Math.max(1, w / 2 - 1), Math.max(1, h / 2 - 1), 0, 0, Math.PI * 2);
      if (fill !== "transparent") ctx.fill(); ctx.stroke();
    } else if (proposal.archetype === "database") {
      const ry = Math.min(12, h * .15);
      ctx.beginPath(); ctx.moveTo(x + w * .08, y + ry); ctx.bezierCurveTo(x + w * .08, y - ry * .25, x + w * .92, y - ry * .25, x + w * .92, y + ry);
      ctx.lineTo(x + w * .92, y + h - ry); ctx.bezierCurveTo(x + w * .92, y + h + ry * .25, x + w * .08, y + h + ry * .25, x + w * .08, y + h - ry);
      ctx.closePath(); if (fill !== "transparent") ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + ry, w * .42, ry, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (proposal.archetype === "document") {
      const fold = Math.min(20, w * .18); ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + w - fold, y + 1); ctx.lineTo(x + w - 1, y + fold); ctx.lineTo(x + w - 1, y + h - 1); ctx.lineTo(x + 1, y + h - 1); ctx.closePath();
      if (fill !== "transparent") ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + w - fold, y + 1); ctx.lineTo(x + w - fold, y + fold); ctx.lineTo(x + w - 1, y + fold); ctx.stroke();
    } else if (proposal.archetype === "screen") {
      roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 8); if (fill !== "transparent") ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 1, y + Math.min(22, h * .17)); ctx.lineTo(x + w - 1, y + Math.min(22, h * .17)); ctx.stroke();
      for (let index = 0; index < 3; index++) { ctx.beginPath(); ctx.arc(x + 10 + index * 9, y + 11, 2, 0, Math.PI * 2); ctx.fillStyle = defaultPalette.muted; ctx.fill(); }
    } else if (proposal.archetype === "sticky") {
      const fold = Math.min(18, w * .13, h * .18); ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + w - 1, y + 1); ctx.lineTo(x + w - 1, y + h - fold); ctx.lineTo(x + w - fold, y + h - 1); ctx.lineTo(x + 1, y + h - 1); ctx.closePath();
      if (fill === "transparent") ctx.fillStyle = defaultPalette.soft; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w - fold, y + h - 1); ctx.lineTo(x + w - fold, y + h - fold); ctx.lineTo(x + w - 1, y + h - fold); ctx.stroke();
    } else if (proposal.archetype === "connector") {
      ctx.beginPath(); ctx.moveTo(x + 3, y + h / 2); ctx.lineTo(x + w - 8, y + h / 2); ctx.lineTo(x + w - 15, y + h / 2 - 5); ctx.moveTo(x + w - 8, y + h / 2); ctx.lineTo(x + w - 15, y + h / 2 + 5); ctx.stroke();
    } else {
      if (proposal.archetype === "boundary") ctx.setLineDash([6, 4]);
      roundRect(ctx, x + 1, y + 1, w - 2, h - 2, proposal.archetype === "boundary" ? 2 : 7);
      if (fill !== "transparent") ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      if (proposal.archetype === "table") {
        const headerHeight = Math.min(28, h * .24); ctx.fillStyle = defaultPalette.soft; ctx.fillRect(x + 2, y + 2, Math.max(0, w - 4), headerHeight);
        ctx.beginPath(); ctx.moveTo(x + 1, y + headerHeight); ctx.lineTo(x + w - 1, y + headerHeight); ctx.stroke();
        const rowCount = Math.min(3, Math.max(1, (meta.componentFields ?? []).length));
        for (let index = 1; index < rowCount; index++) { const rowY = y + headerHeight + (h - headerHeight) * index / rowCount; ctx.beginPath(); ctx.moveTo(x + 1, rowY); ctx.lineTo(x + w - 1, rowY); ctx.stroke(); }
      }
    }
    if (proposal.archetype !== "connector") {
      const center = proposal.archetype === "event" || proposal.archetype === "decision" || proposal.archetype === "sticky";
      const titleY = proposal.archetype === "event" || proposal.archetype === "decision" ? y + h * .46 : proposal.archetype === "sticky" ? y + h * .34 : proposal.archetype === "screen" ? y + Math.min(39, h * .31) : proposal.archetype === "table" ? y + Math.min(19, h * .16) : y + Math.min(22, h * .2);
      fittedComponentText(ctx, name, bounds, center ? x + w / 2 : x + 9, titleY, w - (center ? 20 : 18), size, textInk, 650, center ? "center" : "left", textStyle, 2);
      const details = (meta.componentFields ?? []).filter(item => item.value.trim());
      const score = proposalComponentScore(kind, meta.componentFields ?? []);
      if (score) details.push({ key: "calculated-score", ...score });
      const detailsStart = proposal.archetype === "table" ? y + h * .48 : proposal.archetype === "sticky" ? y + h * .58 : proposal.archetype === "event" || proposal.archetype === "decision" ? y + h * .7 : y + h * .54;
      const available = Math.max(0, y + h - detailsStart - 7);
      const rowHeight = details.length ? available / details.length : 0;
      details.forEach((item, index) => fittedComponentText(ctx, `${item.label}: ${item.value}`, bounds, x + 9, detailsStart + rowHeight * (index + .5), w - 18, Math.max(6, Math.min(size * .68, rowHeight * .76)), textInk, 400, "left", textStyle, rowHeight >= size * 1.45 ? 2 : 1));
    }
    ctx.restore(); return;
  }
  const provider = cloudProviderComponent(kind);
  if (provider) {
    ctx.save();
    ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill;
    if (fill !== "transparent") ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = provider.accent; ctx.lineWidth = 1.5; strokeRectAligned(ctx, x, y, w, h);
    const iconSide = Math.max(28, Math.min(54, h - 34, w * .34));
    const iconX = x + 10; const iconY = y + (h - iconSide) / 2 - 3;
    drawProviderArtwork(ctx, group, iconX, iconY, iconSide, defaultPalette.soft, provider.accent);
    const copyX = iconX + iconSide + 9; const copyWidth = w - (copyX - x) - 9;
    const providerTextAlign = componentTextAlign(textStyle?.textAlign, "left");
    fittedComponentSingleLine(ctx, name, bounds, componentTextAnchor(copyX, copyWidth, "left", providerTextAlign), y + h * .37, copyWidth, size, textInk, 700, providerTextAlign, textStyle);
    fittedComponentSingleLine(ctx, provider.provider.toUpperCase(), bounds, componentTextAnchor(copyX, copyWidth, "left", providerTextAlign), y + h * .59, copyWidth, 8, textInk, 650, providerTextAlign, textStyle);
    const providerDetails = (meta.componentFields ?? []).filter(item => item.value.trim()).slice(0, 2);
    providerDetails.forEach((item, index) => fittedComponentSingleLine(ctx, `${item.label}: ${item.value.replace(/\s*\n\s*/g, " · ")}`, bounds, componentTextAnchor(copyX, copyWidth, "left", providerTextAlign), y + h * (.76 + index * .13), copyWidth, 7, textInk, 400, providerTextAlign, textStyle));
    ctx.restore(); return;
  }
  const box = (bx = x, by = y, bw = w, bh = h, color = fill) => { ctx.fillStyle = color === "transparent" ? "rgba(0,0,0,0)" : color; if (color !== "transparent") ctx.fillRect(bx, by, bw, bh); ctx.strokeStyle = edge; ctx.lineWidth = 1.5; strokeRectAligned(ctx, bx, by, bw, bh); };
  const label = (value = name, bx = x + 10, by = y + 15, max = w - 20, font = size, bold = true, align: CanvasTextAlign = "left") => {
    const textAlign = componentTextAlign(textStyle?.textAlign, align);
    fittedComponentSingleLine(ctx, value.replace(/\s*\n\s*/g, " · "), bounds, componentTextAnchor(bx, max, "left", textAlign), by, max, Math.min(maxLabelSize, font), textInk, bold ? 650 : 400, textAlign, textStyle);
  };
  const rule = (x1: number, y1: number, x2: number, y2: number) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.stroke(); };
  const dashedBoundary = (title: string, caption: string) => {
    ctx.setLineDash([6, 4]); ctx.strokeStyle = edge; ctx.lineWidth = 1.5; strokeRectAligned(ctx, x + 1, y + 1, w - 2, h - 2); ctx.setLineDash([]);
    label(title.toUpperCase(), x + 12, y + 15, w - 24, Math.min(size, 14));
    label(caption, x + 12, y + 34, w - 24, Math.max(8, size * .75), false);
  };
  ctx.save();
  ctx.beginPath(); ctx.rect(x - 1, y - 1, w + 2, h + 2); ctx.clip();
  ctx.lineCap = "round"; ctx.lineJoin = "round";

  const neutralCloud = cloudNeutralComponent(kind);
  if (neutralCloud) {
    ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill;
    roundRect(ctx, x, y, w, h, 5); if (fill !== "transparent") ctx.fill();
    ctx.strokeStyle = defaultPalette.edge; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = neutralCloud.accent; ctx.fillRect(x, y + 5, 3, Math.max(0, h - 10));
    const iconSide = Math.min(25, Math.max(14, h - 20), Math.max(14, w * .22));
    const iconX = x + 11; const iconY = y + Math.min(11, (h - iconSide) / 2);
    const path = cloudNeutralCanvasPath(kind);
    if (path) { ctx.save(); ctx.translate(iconX, iconY); ctx.scale(iconSide / 24, iconSide / 24); ctx.fillStyle = neutralCloud.accent; ctx.fill(path); ctx.restore(); }
    const copyX = iconX + iconSide + 8; const copyWidth = Math.max(8, w - (copyX - x) - 7);
    const align = componentTextAlign(textStyle?.textAlign, "left"); const anchor = () => componentTextAnchor(copyX, copyWidth, "left", align);
    fittedComponentSingleLine(ctx, name, bounds, anchor(), y + Math.min(23, h * .39), copyWidth, Math.min(size, 12), textInk, 650, align, textStyle);
    fittedComponentSingleLine(ctx, neutralCloud.category, bounds, anchor(), y + Math.min(41, h * .68), copyWidth, 7, neutralCloud.accent, 600, align, textStyle);
    if (h > 76) (meta.componentFields ?? []).filter(item => item.value.trim()).slice(0, Math.min(2, Math.floor((h - 65) / 13)))
      .forEach((item, index) => fittedComponentSingleLine(ctx, `${item.label}: ${item.value.replace(/\s*\n\s*/g, " · ")}`, bounds, x + 10, y + 68 + index * 13, w - 20, 7, textInk, 400, "left", textStyle));
    ctx.restore(); return;
  }

  if (kind === "uml-use-case") {
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2 - .65, h / 2 - .65, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill();
    ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.stroke();
    label(name, x + w / 2, y + h / 2, w - 16, size, true, "center");
    const outcome = field("outcome"); if (outcome) label(outcome, x + w / 2, y + h * .68, w * .64, Math.max(7, size * .62), false, "center");
    ctx.restore(); return;
  }

  if (kind === "db-view") {
    const fold = Math.min(22, w * .14); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w - fold, y); ctx.lineTo(x + w, y + fold); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.stroke();
    rule(x + w - fold, y, x + w - fold, y + fold); rule(x + w - fold, y + fold, x + w, y + fold); label(name.toUpperCase(), x + 10, y + 18, w - 30, Math.min(size, 12)); rule(x + 10, y + 31, x + w - 10, y + 31);
    const sources = field("sources"); const query = field("query"); const refresh = field("refresh");
    if (sources) label(`Sources: ${sources}`, x + 10, y + 49, w - 20, Math.max(7, size * .62), false);
    if (query) label(`Query: ${query}`, x + 10, y + 75, w - 20, Math.max(7, size * .58), false);
    if (refresh) label(`Refresh: ${refresh}`, x + 10, y + h - 9, w - 20, Math.max(7, size * .56), false);
    ctx.restore(); return;
  }
  if (kind === "db-index") {
    box(); label("INDEX", x + 10, y + 17, w - 20, Math.min(size, 11)); rule(x + 10, y + 29, x + w - 10, y + 29);
    const method = field("method"); const columns = field("columns"); const uniqueness = field("uniqueness"); const predicate = field("predicate");
    const rootX = x + 20; const rootY = y + 48; ctx.strokeStyle = edge; ctx.beginPath(); ctx.moveTo(rootX, rootY); ctx.lineTo(x + 45, rootY + 13); ctx.moveTo(x + 45, rootY + 13); ctx.lineTo(x + 31, rootY + 25); ctx.moveTo(x + 45, rootY + 13); ctx.lineTo(x + 59, rootY + 25); ctx.stroke();
    for (const [px, py] of [[rootX, rootY], [x + 31, rootY + 25], [x + 59, rootY + 25]]) { ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fillStyle = soft; ctx.fill(); ctx.stroke(); }
    const details = [uniqueness, columns, method, predicate].filter(Boolean).slice(0, 3);
    details.forEach((value, index) => label(value, x + 70, y + 47 + index * 21, w - 80, Math.max(7, size * .58), index === 0));
    ctx.restore(); return;
  }
  if (kind === "db-procedure") {
    roundRect(ctx, x, y, w, h, 9); ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 25, y + 25, 14, 0, Math.PI * 2); ctx.fillStyle = soft; ctx.fill(); ctx.stroke(); label("ƒx", x + 13, y + 25, 24, 12, true, "center");
    label(name.toUpperCase(), x + 48, y + 18, w - 58, Math.min(size, 12)); rule(x + 48, y + 31, x + w - 10, y + 31);
    const signature = field("signature"); const parameters = field("parameters"); const transaction = field("transaction"); const effects = field("effects");
    if (signature) label(signature, x + 12, y + 55, w - 24, Math.max(7, size * .64), true);
    if (parameters) label(`Parameters: ${parameters}`, x + 12, y + 78, w - 24, Math.max(7, size * .56), false);
    if (transaction || effects) label([transaction, effects].filter(Boolean).join(" · "), x + 12, y + h - 10, w - 24, Math.max(7, size * .52), false);
    ctx.restore(); return;
  }
  if (kind === "uml-object") {
    box(); label("«instance»", x + 8, y + 16, w - 16, Math.max(8, size * .68), false, "center");
    const classifier = field("classifier"); label(classifier ? `${name} : ${classifier}` : name, x + 8, y + 37, w - 16, size, true, "center"); rule(x, y + 52, x + w, y + 52);
    const state = field("state"); const slots = field("slots"); if (state) label(`State: ${state}`, x + 10, y + 69, w - 20, Math.max(7, size * .64), false);
    if (slots) slots.split(/\r?\n/).filter(Boolean).slice(0, 4).forEach((slot, index) => label(slot, x + 12, y + 89 + index * 14, w - 24, Math.max(7, size * .58), false));
    ctx.restore(); return;
  }
  if (kind === "uml-activity-action") {
    roundRect(ctx, x, y, w, h, 15); ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 1.3; ctx.stroke();
    label(name, x + 12, y + 22, w - 24, size, true, "center");
    const behavior = field("behavior"); const inputs = field("inputs"); const outputs = field("outputs");
    if (behavior) label(behavior, x + 12, y + 47, w - 24, Math.max(7, size * .62), false, "center");
    if (inputs) { box(x - 1, y + h * .5 - 5, 8, 10, soft); label(inputs.split(/\r?\n/)[0], x + 10, y + h * .72, w * .42, Math.max(6, size * .52), false); }
    if (outputs) { box(x + w - 7, y + h * .5 - 5, 8, 10, soft); label(outputs.split(/\r?\n/)[0], x + w * .54, y + h * .72, w * .4, Math.max(6, size * .52), false); }
    ctx.restore(); return;
  }
  if (kind === "uml-activity-decision") {
    ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h / 2); ctx.closePath(); ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.stroke();
    const condition = field("condition"); const guards = field("guards"); label(condition || name, x + w * .24, y + h * .45, w * .52, Math.max(7, size * .65), true, "center");
    if (guards) label(guards.split(/\r?\n/)[0], x + 3, y + h - 5, w - 6, Math.max(6, size * .48), false, "center");
    ctx.restore(); return;
  }
  if (kind === "uml-activity-initial" || kind === "uml-activity-final") {
    const radius = Math.min(w, h) / 2 - 1; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, radius, 0, Math.PI * 2); ctx.fillStyle = kind === "uml-activity-initial" ? ink : (fill === "transparent" ? "rgba(0,0,0,0)" : fill); if (kind === "uml-activity-initial" || fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = kind === "uml-activity-final" ? 2 : 1.5; ctx.stroke();
    if (kind === "uml-activity-final") { ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, radius * .65, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill(); }
    ctx.restore(); return;
  }
  if (kind === "c4-container-instance" || kind === "c4-component-instance") {
    box(); label(kind === "c4-container-instance" ? "CONTAINER" : "COMPONENT", x + 10, y + 16, w - 20, Math.max(8, size * .7), false); rule(x + 1, y + 29, x + w - 1, y + 29); label(name, x + 10, y + 49, w - 20, size, true);
    const main = field("responsibility"); const implementation = field(kind === "c4-container-instance" ? "technology" : "implementation"); const interfaces = field(kind === "c4-container-instance" ? "interfaces" : "interface");
    if (main) label(main, x + 10, y + 74, w - 20, Math.max(7, size * .62), false);
    if (implementation) label(implementation, x + 10, y + 96, w - 20, Math.max(7, size * .58), false);
    if (interfaces) label(interfaces, x + 10, y + h - 8, w - 20, Math.max(7, size * .52), false);
    ctx.restore(); return;
  }
  if (kind === "bpmn-group") {
    roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 8); ctx.setLineDash([6, 4]); ctx.strokeStyle = edge; ctx.stroke(); ctx.setLineDash([]); label(name.toUpperCase(), x + 12, y + 17, w - 24, Math.min(size, 12));
    const purpose = field("purpose"); if (purpose) label(purpose, x + 12, y + 43, w - 24, Math.max(7, size * .64), false); ctx.restore(); return;
  }

  if (kind === "uml-enumeration") {
    box(); const header = Math.min(40, h * .3);
    label("<<enumeration>>", x + 8, y + 14, w - 16, Math.max(8, size * .68), false, "center");
    label(name, x + 8, y + header, w - 16, size, true, "center");
    rule(x, y + header + 8, x + w, y + header + 8);
    label("<<literal>>", x + 12, y + header + 28, w - 24, Math.max(8, size * .68), false);
    const literals = meta.componentFields?.find(field => field.key === "literals")?.value.trim();
    if (literals) literals.split(/\r?\n/).slice(0, 8).forEach((literal, index) => label(literal, x + 12, y + header + 48 + index * Math.min(16, h * .1), w - 24, Math.max(8, size * .72), false));
    ctx.restore(); return;
  }

  if (kind === "diagram-frame") {
    ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.setLineDash([7, 4]); strokeRectAligned(ctx, x + .7, y + .7, Math.max(0, w - 1.4), Math.max(0, h - 1.4)); ctx.setLineDash([]);
    label(name, x + 12, y + 13, w - 24, Math.min(size, 14));
    ctx.restore(); return;
  }
  if (kind === "diagram-swimlane") {
    const headerHeight = Math.min(32, Math.max(24, h * .12)); const labelWidth = Math.min(132, Math.max(84, w * .22));
    const lanes = Math.max(2, Math.min(8, Math.round(meta.laneCount ?? 3))); const laneWeights = Array.from({ length: lanes }, (_, lane) => { const weight = meta.laneWeights?.[lane]; return Number.isFinite(weight) && weight! > 0 ? weight! : 1; }); const totalLaneWeight = laneWeights.reduce((sum, weight) => sum + weight, 0); const rowHeights = laneWeights.map(weight => Math.max(1, (h - headerHeight) * weight / totalLaneWeight));
    box(); ctx.fillStyle = soft; ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, headerHeight - 1));
    rule(x, y + headerHeight, x + w, y + headerHeight); rule(x + labelWidth, y + headerHeight, x + labelWidth, y + h);
    label(name, x + 10, y + headerHeight / 2, w - 20, Math.min(size, 14));
    let laneTop = y + headerHeight;
    for (let lane = 0; lane < lanes; lane++) {
      const rowHeight = rowHeights[lane]!; const top = laneTop;
      if (lane) rule(x, top, x + w, top);
      label(`Lane ${lane + 1}`, x + 8, top + rowHeight / 2, labelWidth - 16, Math.min(size, 12), false);
      laneTop += rowHeight;
    }
    ctx.restore(); return;
  }
  if (["uml-state", "uml-initial-state", "uml-final-state", "uml-fork", "uml-join", "uml-component", "uml-node", "uml-artifact", "uml-enumeration"].includes(kind)) {
    if (kind === "uml-initial-state") {
      ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2 - .65, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
    } else if (kind === "uml-final-state") {
      const outerRadius = Math.min(w, h) / 2 - 1;
      ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, outerRadius, 0, Math.PI * 2); ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, outerRadius * .65, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
    } else if (kind === "uml-fork" || kind === "uml-join") {
      ctx.fillStyle = ink; ctx.fillRect(x, y + 1, w, Math.max(1, h - 2));
    } else if (kind === "uml-state") {
      roundRect(ctx, x, y, w, h, 10); ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.stroke();
      label(name, x + 10, y + h * .4, w - 20, size, true, "center");
      const actions = (["entry", "do", "exit"] as const).flatMap(key => {
        const value = meta.componentFields?.find(field => field.key === key)?.value.trim();
        return value ? [`${key}: ${value}`] : [];
      });
      actions.forEach((action, index) => label(action, x + 10, y + h * (.62 + index * .12), w - 20, Math.max(7, size * .6), false, "center"));
    } else if (kind === "uml-component") {
      box(); strokeRectAligned(ctx, x + w - 25, y + 12, 14, 10); strokeRectAligned(ctx, x + w - 25, y + 28, 14, 10); label(name, x + 10, y + h * .36, w - 45, size, true, "center");
      const provided = field("provided"); const required = field("required");
      if (provided) label(`Provides: ${provided}`, x + 10, y + h * .65, w - 20, Math.max(7, size * .65), false);
      if (required) label(`Requires: ${required}`, x + 10, y + h * .82, w - 20, Math.max(7, size * .62), false);
    } else if (kind === "uml-node") {
      const dx = Math.min(18, w * .12); const dy = Math.min(15, h * .12); box(x + dx, y + dy, w - dx, h - dy); ctx.beginPath(); ctx.moveTo(x + dx, y + dy); ctx.lineTo(x + dx + 10, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + dy); ctx.moveTo(x + w - dx, y + dy); ctx.lineTo(x + w, y); ctx.strokeStyle = edge; ctx.stroke(); label(name, x + dx + 8, y + h * .43, w - dx - 16, size, true, "center");
      const environment = field("execution-environment"); const location = field("location");
      if (environment) label(environment, x + dx + 8, y + h * .64, w - dx - 16, Math.max(7, size * .65), false, "center");
      if (location) label(location, x + dx + 8, y + h * .82, w - dx - 16, Math.max(7, size * .6), false, "center");
    } else if (kind === "uml-artifact") {
      const fold = Math.min(20, w * .18); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w - fold, y); ctx.lineTo(x + w, y + fold); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.stroke(); rule(x + w - fold, y, x + w - fold, y + fold); rule(x + w - fold, y + fold, x + w, y + fold); label(name, x + 8, y + h * .43, w - 16, size, true, "center");
      const version = field("version"); const repository = field("repository");
      if (version) label(`Version ${version}`, x + 8, y + h * .65, w - 16, Math.max(7, size * .65), false, "center");
      if (repository) label(repository, x + 8, y + h * .82, w - 16, Math.max(7, size * .6), false, "center");
    } else {
      box(); const header = Math.min(40, h * .3); label("«enumeration»", x + 8, y + 14, w - 16, Math.max(8, size * .68), false, "center"); label(name, x + 8, y + header, w - 16, size, true, "center"); rule(x, y + header + 8, x + w, y + header + 8); label("«literal»", x + 12, y + header + 28, w - 24, Math.max(8, size * .68), false);
    }
    ctx.restore(); return;
  }
  if (kind === "c4-person") {
    const cx = x + w / 2; const headY = y + 24;
    ctx.beginPath(); ctx.arc(cx, headY, 10, 0, Math.PI * 2); ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, headY + 11); ctx.lineTo(cx, y + 63); ctx.moveTo(cx - 20, y + 42); ctx.lineTo(cx + 20, y + 42); ctx.moveTo(cx, y + 63); ctx.lineTo(cx - 15, y + 82); ctx.moveTo(cx, y + 63); ctx.lineTo(cx + 15, y + 82); ctx.stroke();
    const role = field("role"); const goal = field("goal");
    label(name, x + 6, y + h - (role && goal ? 38 : role || goal ? 27 : 8), w - 12, Math.min(size, 12), true, "center");
    if (role) label(role, x + 6, y + h - (goal ? 24 : 12), w - 12, Math.max(7, size * .64), false, "center");
    if (goal) label(goal, x + 6, y + h - 5, w - 12, Math.max(7, size * .58), false, "center");
    ctx.restore(); return;
  }
  if (kind === "c4-software-system") {
    box();
    label("SOFTWARE SYSTEM", x + 10, y + 18, w - 20, Math.max(8, size * .72), false);
    label(name, x + 10, y + h * .42, w - 20, size, true);
    const capability = field("description"); const technology = field("technology");
    if (capability) label(capability, x + 10, y + h * .66, w - 20, Math.max(7, size * .68), false);
    if (technology) label(technology, x + 10, y + h - 8, w - 20, Math.max(7, size * .62), false);
    ctx.restore(); return;
  }
  if (kind === "c4-external-system") {
    ctx.setLineDash([6, 4]); ctx.strokeStyle = edge; ctx.lineWidth = 1.5; strokeRectAligned(ctx, x + 1, y + 1, w - 2, h - 2); ctx.setLineDash([]);
    label("EXTERNAL SYSTEM", x + 10, y + 18, w - 20, Math.max(8, size * .72), false);
    label(name, x + 10, y + h * .4, w - 20, size, true);
    const capability = field("description"); const integration = field("interface");
    if (capability) label(capability, x + 10, y + h * .65, w - 20, Math.max(7, size * .66), false);
    if (integration) label(integration, x + 10, y + h - 8, w - 20, Math.max(7, size * .6), false);
    ctx.restore(); return;
  }
  if (kind === "c4-code-element") {
    box(); label("CODE ELEMENT", x + 10, y + 16, w - 20, Math.max(8, size * .7), false);
    rule(x + 1, y + 27, x + w - 1, y + 27); label(name, x + 12, y + h * .39, w - 24, size, true);
    rule(x + 1, y + h * .54, x + w - 1, y + h * .54);
    const signature = field("signature"); const responsibility = field("responsibility");
    if (signature) label(signature, x + 12, y + h * .68, w - 24, Math.max(7, size * .66), false);
    if (responsibility) label(responsibility, x + 12, y + h * .84, w - 24, Math.max(7, size * .62), false);
    ctx.restore(); return;
  }
  if (kind === "c4-deployment-node" || kind === "c4-infrastructure-node") {
    ctx.strokeStyle = edge; ctx.lineWidth = 1.5; strokeRectAligned(ctx, x + 1, y + 1, w - 2, h - 2);
    rule(x + 12, y + 27, x + w - 12, y + 27);
    label(kind === "c4-deployment-node" ? "DEPLOYMENT NODE" : "INFRASTRUCTURE NODE", x + 10, y + 15, w - 20, Math.min(size, 12));
    const rackTop = y + 40; const rackHeight = Math.min(28, (h - 54) / 2);
    const deploymentDetails = kind === "c4-deployment-node"
      ? [field("environment") && `Environment: ${field("environment")}`, field("instance") && `Instance: ${field("instance")}`, field("technology") && `Runtime: ${field("technology")}`]
      : [field("infrastructure-role") && `Role: ${field("infrastructure-role")}`, field("technology") && `Technology: ${field("technology")}`, field("location") && `Location: ${field("location")}`];
    for (let index = 0; index < 2; index++) {
      const rowY = rackTop + index * (rackHeight + 6);
      strokeRectAligned(ctx, x + 14, rowY, w - 28, rackHeight);
      ctx.beginPath(); ctx.arc(x + 24, rowY + rackHeight / 2, 2, 0, Math.PI * 2); ctx.fillStyle = edge; ctx.fill();
      const detail = deploymentDetails[index];
      if (detail) label(detail, x + 32, rowY + rackHeight / 2, w - 48, Math.max(7, size * .58), false);
      else rule(x + 32, rowY + rackHeight / 2, x + w - 14, rowY + rackHeight / 2);
    }
    label(name, x + 10, y + h - 6, w - 20, Math.max(8, size * .72), false);
    ctx.restore(); return;
  }
  if (kind === "c4-system" || kind === "c4-container" || kind === "c4-component") {
    dashedBoundary(name, kind === "c4-system" ? "System context" : kind === "c4-container" ? "Container boundary" : "Component boundary");
    const responsibility = field(kind === "c4-system" ? "system-scope" : "description");
    const implementation = field(kind === "c4-system" ? "context" : "technology");
    if (responsibility) label(responsibility, x + 12, y + 56, w - 24, Math.max(8, size * .72), false);
    if (implementation) label(implementation, x + 12, y + 78, w - 24, Math.max(8, size * .66), false);
    ctx.restore(); return;
  }
  if (kind === "network-zone" || kind === "network-subnet") {
    dashedBoundary(name, kind === "network-subnet" ? "IP subnet" : "Network trust zone");
    if (kind === "network-subnet") {
      const cidr = field("cidr"); const gateway = field("gateway"); const vlan = field("vlan");
      if (cidr) label(cidr, x + 12, y + 56, w - 24, Math.max(9, size * .82), true);
      if (gateway) label(`Gateway: ${gateway}`, x + 12, y + 78, w - 24, Math.max(8, size * .68), false);
      if (vlan) label(`VLAN: ${vlan}`, x + 12, y + 99, w - 24, Math.max(8, size * .64), false);
    } else {
      const trust = field("trust-level"); const ingress = field("ingress-policy");
      if (trust) label(`Trust: ${trust}`, x + 12, y + 56, w - 24, Math.max(9, size * .78), true);
      if (ingress) label(`Ingress: ${ingress}`, x + 12, y + 78, w - 24, Math.max(8, size * .68), false);
    }
    ctx.restore(); return;
  }
  if (kind === "diagram-legend") {
    box();
    label(name, x + 12, y + 15, w - 24, Math.min(size, 14));
    rule(x + 8, y + 29, x + w - 8, y + 29);
    const rows = ["Component", "Decision", "Data store", "Relationship"];
    rows.forEach((row, index) => {
      const rowY = y + 42 + index * 18;
      if (index === 0) box(x + 12, rowY - 5, 14, 10, soft);
      else if (index === 1) { ctx.beginPath(); ctx.moveTo(x + 19, rowY - 7); ctx.lineTo(x + 26, rowY); ctx.lineTo(x + 19, rowY + 7); ctx.lineTo(x + 12, rowY); ctx.closePath(); ctx.fillStyle = soft; ctx.fill(); ctx.stroke(); }
      else if (index === 2) { ctx.beginPath(); ctx.ellipse(x + 19, rowY, 7, 5, 0, 0, Math.PI * 2); ctx.fillStyle = soft; ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x + 19, rowY, 7, 2, 0, 0, Math.PI); ctx.stroke(); }
      else { rule(x + 12, rowY, x + 27, rowY); ctx.beginPath(); ctx.moveTo(x + 23, rowY - 3); ctx.lineTo(x + 27, rowY); ctx.lineTo(x + 23, rowY + 3); ctx.stroke(); }
      label(row, x + 34, rowY, w - 44, Math.min(size, 10), false);
    });
    ctx.restore(); return;
  }
  if (kind === "cloud-boundary") {
    cloudPath(ctx, x, y, w, h); ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill();
    ctx.setLineDash([6, 4]); ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
    label(name.toUpperCase(), x + w * .25, y + h * .45, w * .5, Math.min(size, 14), true, "center");
    label("Deployment boundary", x + w * .25, y + h * .58, w * .5, Math.max(8, size * .72), false, "center");
    ctx.restore(); return;
  }

  if (kind === "software-client") {
    box(); label(name.toUpperCase()); rule(x, y + 27, x + w, y + 27);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + 12 + i * 10, y + 14, 2, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill(); }
    box(x + 12, y + 38, w * .32, h - 52, soft); box(x + w * .42, y + 38, w * .48, 16, soft); box(x + w * .42, y + 62, w * .48, h - 76, soft);
  } else if (kind === "software-api") {
    box(); label(name, x + 12, y + 16, w - 24, Math.min(size, 13), true);
    rule(x + 1, y + 29, x + w - 1, y + 29);
    const method = field("method").toUpperCase(); const path = field("path");
    const methodWidth = Math.min(64, Math.max(44, w * .27));
    const routeX = x + 12 + (method ? methodWidth + 8 : 0);
    if (method) label(method, x + 12, y + 49, methodWidth, 9, true);
    if (path) label(path, routeX, y + 49, Math.max(1, x + w - 12 - routeX), Math.max(8, size * .78), true);
    const details = [
      ["Summary", field("summary")],
      ["Request", field("request-body")],
      ["Response", field("responses")],
      ["Parameters", field("parameters")],
      ["Server", field("server")],
      ["Auth", field("security")],
      ["Operation", field("operation-id")],
    ].filter(([, value]) => value) as [string, string][];
    const detailTop = y + 66; const detailBottom = y + h - 5; const detailWidth = w - 24;
    const detailSize = Math.max(6, Math.min(8, size * .58)); const lineHeight = detailSize * 1.3;
    const maxLines = Math.max(1, Math.floor((detailBottom - detailTop) / lineHeight));
    const textAlign = componentTextAlign(textStyle?.textAlign, "left");
    const anchorX = componentTextAnchor(x + 12, detailWidth, "left", textAlign);
    const lines = details.flatMap(([title, value]) => {
      const normalized = value.split(/\r?\n/).map(part => part.trim()).filter(Boolean).join(" · ");
      ctx.font = componentFont(detailSize, 400, textStyle);
      return wrapComponentLabel(ctx, `${title}: ${normalized}`, detailWidth);
    });
    const visibleLines = lines.slice(0, maxLines);
    if (lines.length > maxLines && visibleLines.length) {
      let finalLine = visibleLines[visibleLines.length - 1];
      while (finalLine && ctx.measureText(`${finalLine}…`).width > detailWidth) finalLine = finalLine.slice(0, -1);
      visibleLines[visibleLines.length - 1] = `${finalLine.trimEnd()}…`;
    }
    ctx.save(); ctx.font = componentFont(detailSize, 400, textStyle); ctx.fillStyle = textStyle?.color ?? textInk; ctx.textAlign = textAlign; ctx.textBaseline = "top";
    visibleLines.forEach((line, index) => ctx.fillText(line, anchorX, detailTop + index * lineHeight, detailWidth)); ctx.restore();
  } else if (kind === "software-service" || kind === "tech-service") {
    box(); label(name.toUpperCase());
    rule(x + 10, y + h * .48, x + w - 10, y + h * .48);
    const detail = field(kind === "tech-service" ? "technology" : "responsibility");
    label(detail || (kind === "tech-service" ? "Technology" : "Module / worker"), x + 10, y + h * .72, w - 20, Math.max(8, size * .8), false);
  } else if (kind === "software-database" || kind === "cloud-database") {
    const inset = w * .07; const ry = Math.max(7, Math.min(12, h * .12)); const left = x + inset; const right = x + w - inset;
    ctx.beginPath(); ctx.moveTo(left, y + ry); ctx.lineTo(left, y + h - ry); ctx.ellipse(x + w / 2, y + h - ry, w * .43, ry, 0, Math.PI, 0, true); ctx.lineTo(right, y + ry); ctx.closePath();
    ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + ry, w * .43, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * .55, w * .43, ry, 0, 0, Math.PI); ctx.strokeStyle = edge; ctx.stroke();
    if (kind === "cloud-database") {
      label(field("engine") || "MANAGED DATABASE", x + 8, y + h * .38, w - 16, Math.max(8, size * .68), true, "center");
      const database = field("database-name"); const availability = field("availability");
      if (database) label(database, x + 7, y + h * .57, w - 14, Math.max(7, size * .62), false, "center");
      if (availability) label(availability, x + 7, y + h * .82, w - 14, Math.max(7, size * .5), false, "center");
    } else {
      label(name.toUpperCase(), x + 8, y + h * .4, w - 16, Math.max(8, size * .78), true, "center");
      const engine = field("engine"); const schema = field("schema"); const recovery = field("recovery");
      if (engine) label(engine, x + 8, y + h * .57, w - 16, Math.max(7, size * .62), false, "center");
      if (schema || recovery) label(schema || recovery, x + 8, y + h * .73, w - 16, Math.max(7, size * .55), false, "center");
    }
  } else if (kind === "software-queue" || kind === "cloud-queue") {
    box(); label(name.toUpperCase());
    const count = 3; const cellW = (w - 32) / count; for (let i = 0; i < count; i++) box(x + 10 + i * cellW, y + h * .48, cellW - 6, Math.min(24, h * .28), soft);
    rule(x + 10, y + h - 14, x + w - 10, y + h - 14);
    const address = kind === "cloud-queue" ? field("queue-address") : field("queue-name");
    const contract = kind === "cloud-queue" ? field("message-type") : field("message-shape");
    if (address) label(address, x + 8, y + h * .35, w - 16, Math.max(7, size * .62), false, "center");
    if (contract) label(contract, x + 8, y + h - 5, w - 16, Math.max(7, size * .56), false, "center");
  } else if (kind === "software-event-bus") {
    const busTop = y + h * .33; const busBottom = y + h * .67;
    box(x + 2, busTop, w - 4, busBottom - busTop, soft); label(name.toUpperCase(), x + 8, y + h * .5, w - 16, size, true, "center");
    label("PUBLISHERS", x + 4, y + 7, w - 8, Math.max(7, size * .53), false, "center");
    label("SUBSCRIBERS", x + 4, y + h - 7, w - 8, Math.max(7, size * .53), false, "center");
    for (const ratio of [.2, .5, .8]) {
      const px = x + w * ratio; rule(px, y + 18, px, busTop + 2);
      ctx.beginPath(); ctx.moveTo(px - 3, busTop - 3); ctx.lineTo(px, busTop + 2); ctx.lineTo(px + 3, busTop - 3); ctx.strokeStyle = edge; ctx.stroke();
      rule(px, busBottom - 2, px, y + h - 18);
      ctx.beginPath(); ctx.moveTo(px - 3, y + h - 21); ctx.lineTo(px, y + h - 16); ctx.lineTo(px + 3, y + h - 21); ctx.strokeStyle = edge; ctx.stroke();
      ctx.beginPath(); ctx.arc(px, y + 17, 2.5, 0, Math.PI * 2); ctx.fillStyle = edge; ctx.fill();
    }
  } else if (kind === "software-cache") {
    box(); label(name.toUpperCase());
    const cachedValues = field("cached-values"); const expiration = field("expiration"); const eviction = field("eviction");
    label(cachedValues || "KEY / VALUE", x + 10, y + h * .56, w - 20, Math.max(8, size * .7), false);
    if (expiration || eviction) label([expiration && `TTL ${expiration}`, eviction].filter(Boolean).join(" · "), x + 10, y + h * .8, w - 20, Math.max(7, size * .58), false);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + w - 14, y + 14 + i * 10, 2, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill(); }
  } else if (kind === "cloud-function") {
    box(); box(x + 10, y + 10, Math.min(32, h - 20), Math.min(32, h - 20), soft); label("fn", x + 10, y + Math.min(26, h / 2), Math.min(32, h - 20), 14, true, "center");
    label(name.toUpperCase(), x + 50, y + 22, w - 60, Math.max(8, size * .8));
    const runtime = field("runtime"); const handler = field("handler"); const trigger = field("invocation");
    label(runtime || handler || "Function runtime", x + 50, y + 43, w - 60, Math.max(8, size * .7), false);
    if (trigger) label(`Trigger: ${trigger}`, x + 10, y + h - 9, w - 20, Math.max(7, size * .58), false);
  } else if (kind === "cloud-storage") {
    box(); label(name.toUpperCase());
    const bucket = field("bucket"); const contents = field("stored-objects"); const access = field("access-policy");
    if (bucket) label(bucket, x + 12, y + 39, w - 24, Math.max(7, size * .66), true);
    rule(x + 12, y + 48, x + w - 12, y + 48);
    if (contents) label(contents, x + 12, y + 67, w - 24, Math.max(7, size * .62), false);
    if (access) label(access, x + 12, y + 88, w - 24, Math.max(7, size * .56), false);
  } else if (kind === "network-switch" || kind === "network-hub") {
    box(); label(name.toUpperCase());
    const count = Math.max(1, Math.min(32, Math.round(meta.portCount ?? (kind === "network-hub" ? 8 : 6)))); const columns = Math.min(8, count); const rows = Math.ceil(count / columns);
    const gapX = (w - 24) / columns; const startY = y + 32; const rowGap = Math.max(10, (h - 42) / rows);
    for (let i = 0; i < count; i++) { const col = i % columns; const row = Math.floor(i / columns); const pw = Math.min(12, gapX - 2); ctx.strokeStyle = edge; strokeRectAligned(ctx, x + 12 + col * gapX + (gapX - pw) / 2, startY + row * rowGap, pw, Math.min(7, rowGap - 2)); }
    const networkNote = kind === "network-switch" ? field("vlans") : field("connected-devices");
    if (networkNote) label(networkNote, x + 8, y + h - 5, w - 16, Math.max(6, size * .55), false, "center");
  } else if (kind === "network-server") {
    box(); label(name.toUpperCase()); for (let row = 0; row < 3; row++) { const yy = y + 28 + row * ((h - 36) / 3); box(x + 10, yy, w - 20, Math.max(8, (h - 48) / 3), soft); ctx.beginPath(); ctx.arc(x + 18, yy + 7, 2, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill(); }
    const address = field("ip-addresses"); const services = field("services");
    if (address) label(address, x + 24, y + h * .49, w - 34, Math.max(6, size * .5), false);
    if (services) label(services, x + 24, y + h * .7, w - 34, Math.max(6, size * .48), false);
  } else if (kind === "network-firewall") {
    box(); label(name.toUpperCase());
    const action = field("default-action"); const rules = field("rules");
    if (action) label(`Default: ${action}`, x + 8, y + 28, w - 16, Math.max(6, size * .5), false);
    const top = y + 38; const brickW = (w - 24) / 4; const brickH = (h - 50) / 2;
    for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) strokeRectAligned(ctx, x + 8 + col * brickW + (row ? brickW / 2 : 0), top + row * brickH, brickW, brickH);
    if (rules) label(rules, x + 8, y + h - 4, w - 16, Math.max(6, size * .48), false, "center");
  } else if (kind === "network-client") {
    box(x + 8, y + 4, w - 16, h * .68);
    const platform = field("platform"); const network = field("network");
    if (platform) label(platform, x + 12, y + h * .39, w - 24, Math.max(7, size * .58), false, "center");
    if (network) label(network, x + 12, y + h * .55, w - 24, Math.max(6, size * .5), false, "center");
    rule(x + w * .25, y + h * .82, x + w * .75, y + h * .82); rule(x + w * .5, y + h * .68, x + w * .5, y + h * .82); label(name.toUpperCase(), x + 4, y + h - 8, w - 8, Math.max(8, size * .72), true, "center");
  } else if (kind === "network-router" || kind === "network-load-balancer") {
    box(); label(name.toUpperCase()); const cx = x + w / 2; const cy = y + h * .61; ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * .1, 0, Math.PI * 2); ctx.strokeStyle = edge; ctx.stroke();
    const note = kind === "network-router" ? field("routing-protocol") : field("listeners");
    if (note) label(note, x + 8, y + 27, w - 16, Math.max(6, size * .52), false, "center");
    const ends = kind === "network-router" ? [[x + 8, cy], [x + w - 8, cy], [cx, y + h - 7], [cx, y + 39]] : [[x + 10, y + h - 8], [cx, y + h - 8], [x + w - 10, y + h - 8]];
    for (const [ex, ey] of ends) { rule(cx, cy, ex, ey); ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.stroke(); }
  } else if (kind === "network-access-point") {
    const r = Math.min(w * .21, h * .27); const cx = x + w / 2; const cy = y + h * .37;
    for (const scale of [1, .68, .32]) { ctx.beginPath(); ctx.arc(cx, cy, r * scale, Math.PI, 0); ctx.strokeStyle = edge; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
    label(name.toUpperCase(), x + 4, y + 12, w - 8, Math.max(7, size * .72), true, "center");
    const ssid = field("ssid"); const security = field("security-mode"); const channel = field("channel");
    if (ssid) label(ssid, x + 6, y + h * .72, w - 12, Math.max(7, size * .58), true, "center");
    if (security || channel) label([security, channel].filter(Boolean).join(" · "), x + 6, y + h * .88, w - 12, Math.max(6, size * .48), false, "center");
  } else if (kind === "network-internet") {
    cloudPath(ctx, x + 5, y + 5, w - 10, h - 14); ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.stroke();
    const prefix = field("public-prefix");
    label(name.toUpperCase(), x + 14, y + h * (prefix ? .45 : .57), w - 28, Math.min(size, 12), true, "center");
    if (prefix) label(prefix, x + 14, y + h * .67, w - 28, Math.max(7, size * .58), false, "center");
  } else if (kind === "network-vpn") {
    box(); label(name.toUpperCase(), x + 8, y + 14, w - 16, Math.min(size, 12), true, "center");
    ctx.setLineDash([5, 4]); rule(x + 16, y + h * .63, x + w - 16, y + h * .63); ctx.setLineDash([]);
    for (const px of [x + 17, x + w - 17]) { ctx.beginPath(); ctx.arc(px, y + h * .63, 4, 0, Math.PI * 2); ctx.fillStyle = fill === "transparent" ? "#ffffff" : fill; ctx.fill(); ctx.strokeStyle = edge; ctx.stroke(); }
    const route = [field("local-prefixes"), field("remote-prefixes")].filter(Boolean).join(" to ");
    label(route || "Encrypted tunnel", x + 8, y + h - 9, w - 16, Math.max(7, size * .56), false, "center");
  } else if (kind === "network-dns") {
    box(); const radius = Math.min(w * .24, h * .25); const cx = x + w / 2; const cy = y + h * .4;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.strokeStyle = edge; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cy, radius * .48, radius, 0, 0, Math.PI * 2); ctx.stroke();
    rule(cx - radius, cy, cx + radius, cy);
    const zone = field("zone");
    if (zone) label(zone, x + 8, y + h * .7, w - 16, Math.max(7, size * .58), false, "center");
    label(name.toUpperCase(), x + 8, y + h - 7, w - 16, Math.max(8, size * .68), true, "center");
  } else if (kind === "network-nat-gateway") {
    box(); label(name.toUpperCase(), x + 8, y + 14, w - 16, Math.min(size, 12), true, "center");
    const centerX = x + w / 2; const centerY = y + h * .55;
    for (const startX of [x + 24, x + w - 24]) { rule(startX, y + h - 13, centerX, centerY); ctx.beginPath(); ctx.arc(startX, y + h - 13, 3, 0, Math.PI * 2); ctx.stroke(); }
    rule(centerX, centerY, centerX, y + h * .31); ctx.beginPath(); ctx.moveTo(centerX - 4, y + h * .37); ctx.lineTo(centerX, y + h * .3); ctx.lineTo(centerX + 4, y + h * .37); ctx.stroke();
    const publicAddress = field("public-address");
    if (publicAddress) label(publicAddress, x + 8, y + h - 5, w - 16, Math.max(7, size * .55), false, "center");
  } else if (kind === "network-modem") {
    box(); label(name.toUpperCase(), x + 6, y + 13, w - 12, Math.min(size, 11), true, "center"); rule(x + 10, y + h * .42, x + w - 10, y + h * .42);
    for (let index = 0; index < 4; index++) { ctx.beginPath(); ctx.arc(x + 15 + index * 11, y + h * .67, 2, 0, Math.PI * 2); ctx.fillStyle = edge; ctx.fill(); }
    for (const scale of [1, .65]) { ctx.beginPath(); ctx.arc(x + w - 23, y + h * .74, 8 * scale, Math.PI, 0); ctx.stroke(); }
    const access = field("access-technology");
    if (access) label(access, x + 6, y + h - 5, w - 12, Math.max(6, size * .5), false, "center");
  } else if (["network-proxy", "network-bridge", "network-bastion", "network-gateway", "network-printer", "network-workstation"].includes(kind)) {
    box(); label(name.toUpperCase(), x + 8, y + 14, w - 16, Math.min(size, 12), true, "center");
    if (kind === "network-proxy") {
      const cy = y + h * .62; rule(x + 20, cy - 8, x + w - 20, cy - 8); rule(x + w - 28, cy + 8, x + 28, cy + 8);
      ctx.beginPath(); ctx.moveTo(x + w - 24, cy - 13); ctx.lineTo(x + w - 18, cy - 8); ctx.lineTo(x + w - 24, cy - 3); ctx.moveTo(x + 24, cy + 3); ctx.lineTo(x + 18, cy + 8); ctx.lineTo(x + 24, cy + 13); ctx.stroke();
      const upstream = field("upstream"); if (upstream) label(upstream, x + 8, y + h - 5, w - 16, Math.max(6, size * .5), false, "center");
    } else if (kind === "network-bridge") {
      const cy = y + h * .66; rule(x + 25, cy, x + w - 25, cy); rule(x + w * .3, cy, x + w * .3, y + h * .43); rule(x + w * .7, cy, x + w * .7, y + h * .43);
      ctx.beginPath(); ctx.moveTo(x + w * .3, y + h * .43); ctx.quadraticCurveTo(x + w * .5, y + h * .22, x + w * .7, y + h * .43); ctx.stroke();
      strokeRectAligned(ctx, x + 15, cy - 5, 10, 10); strokeRectAligned(ctx, x + w - 25, cy - 5, 10, 10);
      const segments = field("segments"); if (segments) label(segments, x + 8, y + h - 5, w - 16, Math.max(6, size * .5), false, "center");
    } else if (kind === "network-bastion") {
      const cx = x + w / 2; const top = y + h * .35;
      ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx + 28, top + 10); ctx.lineTo(cx + 24, top + 32); ctx.quadraticCurveTo(cx, top + 50, cx - 24, top + 32); ctx.lineTo(cx - 28, top + 10); ctx.closePath(); ctx.stroke();
      rule(cx - 8, top + 15, cx + 8, top + 15); rule(cx - 8, top + 22, cx + 8, top + 22); rule(cx - 8, top + 29, cx + 8, top + 29);
      const sources = field("allowed-sources"); if (sources) label(sources, x + 8, y + h - 5, w - 16, Math.max(6, size * .5), false, "center");
    } else if (kind === "network-gateway") {
      const cx = x + w / 2; const cy = y + h * .63;
      ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx + 22, cy); ctx.lineTo(cx, cy + 20); ctx.lineTo(cx - 22, cy); ctx.closePath(); ctx.stroke();
      rule(x + 18, cy, cx - 22, cy); rule(cx + 22, cy, x + w - 18, cy); rule(cx, cy - 31, cx, cy - 20); rule(cx, cy + 20, cx, y + h - 10);
      const gatewayType = field("gateway-type"); if (gatewayType) label(gatewayType, x + 8, y + h - 5, w - 16, Math.max(6, size * .5), false, "center");
    } else if (kind === "network-printer") {
      const bodyY = y + h * .43; strokeRectAligned(ctx, x + w * .2, bodyY, w * .6, h * .36); strokeRectAligned(ctx, x + w * .3, y + h * .27, w * .4, h * .22); strokeRectAligned(ctx, x + w * .3, bodyY + h * .26, w * .4, h * .2); rule(x + w * .36, bodyY + h * .1, x + w * .64, bodyY + h * .1);
      const model = field("model"); if (model) label(model, x + w * .3, y + h * .36, w * .4, Math.max(6, size * .48), false, "center");
    } else {
      const screenY = y + h * .34; strokeRectAligned(ctx, x + w * .2, screenY, w * .6, h * .34); rule(x + w / 2, screenY + h * .34, x + w / 2, y + h * .82); rule(x + w * .34, y + h * .82, x + w * .66, y + h * .82);
      const platform = field("platform"); if (platform) label(platform, x + w * .24, screenY + h * .18, w * .52, Math.max(6, size * .5), false, "center");
    }
  } else if (["bpmn-start", "bpmn-event", "bpmn-end", "bpmn-boundary-event", "bpmn-message-event", "bpmn-timer-event", "bpmn-error-event", "bpmn-signal-event", "bpmn-terminate-event"].includes(kind)) {
    const diameter = Math.max(0, h >= 72 ? Math.min(58, w, h - 38) : Math.min(w, h - 14)); const cx = x + w / 2; const cy = y + diameter / 2 + 1; const marked = ["bpmn-event", "bpmn-boundary-event", "bpmn-message-event", "bpmn-timer-event", "bpmn-error-event", "bpmn-signal-event", "bpmn-terminate-event"].includes(kind);
    ctx.beginPath(); ctx.arc(cx, cy, diameter * .43, 0, Math.PI * 2); ctx.fillStyle = fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = kind === "bpmn-end" || kind === "bpmn-terminate-event" ? 2 : 1.5; ctx.stroke();
    if (marked) { ctx.beginPath(); ctx.arc(cx, cy, diameter * .34, 0, Math.PI * 2); if (kind === "bpmn-boundary-event") ctx.setLineDash([3, 2]); ctx.stroke(); ctx.setLineDash([]); }
    if (kind === "bpmn-message-event") { const mw = diameter * .38; const mh = diameter * .24; strokeRectAligned(ctx, cx - mw / 2, cy - mh / 2, mw, mh); ctx.beginPath(); ctx.moveTo(cx - mw / 2, cy - mh / 2); ctx.lineTo(cx, cy + mh * .18); ctx.lineTo(cx + mw / 2, cy - mh / 2); ctx.stroke(); }
    else if (kind === "bpmn-timer-event") { ctx.beginPath(); ctx.moveTo(cx, cy - diameter * .2); ctx.lineTo(cx, cy); ctx.lineTo(cx + diameter * .14, cy + diameter * .08); ctx.stroke(); }
    else if (kind === "bpmn-error-event") { ctx.beginPath(); ctx.moveTo(cx + diameter * .08, cy - diameter * .22); ctx.lineTo(cx - diameter * .1, cy); ctx.lineTo(cx + diameter * .04, cy); ctx.lineTo(cx - diameter * .08, cy + diameter * .22); ctx.stroke(); }
    else if (kind === "bpmn-signal-event") { ctx.beginPath(); ctx.moveTo(cx, cy - diameter * .2); ctx.lineTo(cx + diameter * .18, cy + diameter * .16); ctx.lineTo(cx - diameter * .18, cy + diameter * .16); ctx.closePath(); ctx.stroke(); }
    else if (kind === "bpmn-terminate-event") { ctx.beginPath(); ctx.arc(cx, cy, diameter * .18, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill(); }
    const eventDetail = kind === "bpmn-start" ? field("trigger-reference")
      : kind === "bpmn-message-event" ? field("message-name")
        : kind === "bpmn-timer-event" ? field("timer-expression")
          : kind === "bpmn-error-event" ? field("error-code")
            : kind === "bpmn-signal-event" ? field("signal")
              : kind === "bpmn-boundary-event" ? field("event-definition")
                : kind === "bpmn-terminate-event" ? field("reason")
                  : kind === "bpmn-end" ? field("outcome") : field("event-definition");
    if (eventDetail && h >= 72) label(eventDetail, x + 4, y + h - 24, w - 8, Math.max(7, size * .6), false, "center");
    label(name, x, y + h - 8, w, Math.max(7, size * .64), false, "center");
  } else if (["bpmn-gateway", "bpmn-parallel-gateway", "bpmn-inclusive-gateway", "bpmn-event-gateway"].includes(kind)) {
    const side = Math.max(0, Math.min(w, h - 12, 58)); const cx = x + w / 2; const left = cx - side / 2; const cy = side / 2; ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx + side / 2, y + cy); ctx.lineTo(cx, y + side); ctx.lineTo(left, y + cy); ctx.closePath(); ctx.fillStyle = fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.stroke();
    if (kind === "bpmn-parallel-gateway") { rule(cx, y + side * .28, cx, y + side * .72); rule(cx - side * .22, y + cy, cx + side * .22, y + cy); }
    else if (kind === "bpmn-inclusive-gateway") { ctx.beginPath(); ctx.arc(cx, cy, side * .18, 0, Math.PI * 2); ctx.stroke(); }
    else if (kind === "bpmn-event-gateway") { ctx.beginPath(); ctx.arc(cx, cy, side * .2, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, side * .14, 0, Math.PI * 2); ctx.stroke(); }
    else { rule(cx - side * .16, y + side * .34, cx + side * .16, y + side * .66); rule(cx + side * .16, y + side * .34, cx - side * .16, y + side * .66); }
    label(name, x, y + h - 8, w, Math.max(7, size * .58), false, "center");
  } else if (["bpmn-task", "bpmn-user-task", "bpmn-service-task", "bpmn-script-task", "bpmn-manual-task", "bpmn-business-rule-task", "bpmn-send-task", "bpmn-receive-task", "bpmn-call-activity"].includes(kind)) {
    box(); if (kind === "bpmn-call-activity") strokeRectAligned(ctx, x + 4, y + 4, w - 8, h - 8);
    const gx = x + 15; const gy = y + 18;
    if (kind === "bpmn-user-task") { ctx.beginPath(); ctx.arc(gx + 5, gy + 4, 3, 0, Math.PI * 2); ctx.stroke(); rule(gx, gy + 16, gx + 10, gy + 16); rule(gx + 5, gy + 8, gx + 5, gy + 20); }
    else if (kind === "bpmn-service-task") { ctx.beginPath(); ctx.arc(gx + 5, gy + 8, 6, 0, Math.PI * 2); ctx.stroke(); rule(gx - 2, gy + 8, gx + 12, gy + 8); rule(gx + 5, gy + 1, gx + 5, gy + 15); }
    else if (kind === "bpmn-script-task") { strokeRectAligned(ctx, gx, gy, 12, 16); rule(gx + 3, gy + 5, gx + 9, gy + 5); rule(gx + 3, gy + 9, gx + 9, gy + 9); rule(gx + 3, gy + 13, gx + 7, gy + 13); }
    else if (kind === "bpmn-manual-task") { ctx.beginPath(); ctx.moveTo(gx + 2, gy + 18); ctx.lineTo(gx + 3, gy + 7); ctx.lineTo(gx + 5, gy + 7); ctx.lineTo(gx + 6, gy + 14); ctx.lineTo(gx + 7, gy + 4); ctx.lineTo(gx + 9, gy + 4); ctx.lineTo(gx + 10, gy + 14); ctx.lineTo(gx + 11, gy + 7); ctx.lineTo(gx + 13, gy + 7); ctx.lineTo(gx + 14, gy + 17); ctx.stroke(); }
    else if (kind === "bpmn-business-rule-task") { strokeRectAligned(ctx, gx, gy + 2, 16, 14); rule(gx, gy + 7, gx + 16, gy + 7); rule(gx, gy + 12, gx + 16, gy + 12); rule(gx + 6, gy + 2, gx + 6, gy + 16); }
    else if (kind === "bpmn-send-task" || kind === "bpmn-receive-task") { strokeRectAligned(ctx, gx, gy + 3, 17, 12); ctx.beginPath(); ctx.moveTo(gx, gy + 3); ctx.lineTo(gx + 8.5, gy + 10); ctx.lineTo(gx + 17, gy + 3); ctx.stroke(); if (kind === "bpmn-send-task") { ctx.beginPath(); ctx.arc(gx + 8.5, gy + 9, 1.5, 0, Math.PI * 2); ctx.fillStyle = edge; ctx.fill(); } }
    const taskDescription = kind === "bpmn-user-task" ? field("assignee")
      : kind === "bpmn-service-task" ? field("operation")
        : kind === "bpmn-script-task" ? field("script-language")
          : kind === "bpmn-manual-task" ? field("instruction")
            : kind === "bpmn-business-rule-task" ? field("decision")
              : kind === "bpmn-send-task" ? field("message")
                : kind === "bpmn-receive-task" ? field("message")
                  : kind === "bpmn-call-activity" ? field("called-process")
                    : field("activity");
    const taskPrefix = kind === "bpmn-user-task" ? "Assignee" : kind === "bpmn-service-task" ? "Operation" : kind === "bpmn-script-task" ? "Language" : kind === "bpmn-manual-task" ? "Instruction" : kind === "bpmn-business-rule-task" ? "Decision" : kind === "bpmn-send-task" ? "Send" : kind === "bpmn-receive-task" ? "Receive" : kind === "bpmn-call-activity" ? "Calls" : "Work";
    label(name, x + 34, y + h * .59, w - 42, size, true, "center");
    if (taskDescription) label(`${taskPrefix}: ${taskDescription}`, x + 12, y + h * .84, w - 24, Math.max(7, size * .62), false, "center");
  } else if (kind === "bpmn-subprocess") {
    box(); label(name.toUpperCase(), x + 10, y + h * .36, w - 20, size, true, "center");
    const purpose = field("purpose"); const entry = field("entry-condition");
    if (purpose) label(purpose, x + 10, y + h * .59, w - 20, Math.max(7, size * .64), false, "center");
    if (entry) label(`Starts when: ${entry}`, x + 10, y + h * .78, w - 20, Math.max(7, size * .58), false, "center");
    strokeRectAligned(ctx, x + w / 2 - 6, y + h - 18, 12, 12); rule(x + w / 2 - 3, y + h - 12, x + w / 2 + 3, y + h - 12); rule(x + w / 2, y + h - 15, x + w / 2, y + h - 9);
  } else if (kind === "bpmn-data") {
    box(); ctx.beginPath(); ctx.moveTo(x + w - 18, y); ctx.lineTo(x + w, y + 18); ctx.lineTo(x + w - 18, y + 18); ctx.closePath(); ctx.strokeStyle = edge; ctx.stroke(); rule(x + 12, y + h - 23, x + w - 12, y + h - 23); label(name.toUpperCase(), x + 5, y + h * .38, w - 10, Math.max(8, size * .8), true, "center");
    const state = field("state"); const format = field("format");
    if (state) label(state, x + 6, y + h * .59, w - 12, Math.max(7, size * .62), false, "center");
    if (format) label(format, x + 6, y + h * .75, w - 12, Math.max(7, size * .56), false, "center");
  } else if (kind === "bpmn-data-store") {
    const ry = Math.min(12, h * .16); ctx.beginPath(); ctx.ellipse(x + w / 2, y + ry, w * .42, ry, 0, 0, Math.PI * 2); ctx.moveTo(x + w * .08, y + ry); ctx.lineTo(x + w * .08, y + h - ry); ctx.ellipse(x + w / 2, y + h - ry, w * .42, ry, 0, Math.PI, 0, true); ctx.lineTo(x + w * .92, y + ry); ctx.strokeStyle = edge; ctx.stroke(); ctx.beginPath(); ctx.ellipse(x + w / 2, y + ry, w * .42, ry, 0, 0, Math.PI * 2); ctx.stroke(); label(name.toUpperCase(), x + 8, y + h * .42, w - 16, Math.max(8, size * .72), true, "center");
    const store = field("store"); const retention = field("retention");
    if (store) label(store, x + 8, y + h * .62, w - 16, Math.max(7, size * .62), false, "center");
    if (retention) label(`Retention: ${retention}`, x + 8, y + h * .8, w - 16, Math.max(7, size * .56), false, "center");
  } else if (kind === "bpmn-text-annotation") {
    rule(x + 15, y + 8, x + 15, y + h - 8); rule(x + 15, y + 8, x + 28, y + 8); rule(x + 15, y + h - 8, x + 28, y + h - 8); label(name, x + 30, y + h / 2, w - 40, Math.max(8, size * .8), false);
  } else if (kind === "bpmn-pool") {
    box(); box(x, y, Math.min(34, w / 3), h, soft); rule(x + Math.min(34, w / 3), y + h / 2, x + w, y + h / 2); label(name.toUpperCase(), x + 2, y + h / 2, Math.min(30, w / 3), Math.max(8, size * .55), true, "center");
  } else if (kind === "data-flow") {
    label(name.toUpperCase(), x, y + 9, w, Math.max(8, size * .72), true, "center"); const yy = y + h * .72; rule(x + 4, yy, x + w - 10, yy); ctx.beginPath(); ctx.moveTo(x + w - 16, yy - 5); ctx.lineTo(x + w - 8, yy); ctx.lineTo(x + w - 16, yy + 5); ctx.strokeStyle = edge; ctx.stroke();
  } else {
    box(); label(name, x + 10, y + h * .42, w - 20, size, true, "center"); label(`Unsupported: ${kind}`, x + 10, y + h * .7, w - 20, Math.max(7, size * .65), false, "center");
  }
  ctx.restore();
}

function drawModelComponentDirect(ctx: CanvasRenderingContext2D, group: GroupElement, theme: Theme, allElements?: readonly Element[]) {
  const bounds = group.componentBounds;
  const kind = group.libraryComponent?.kind;
  if (!bounds || !kind) return;
  const { x, y, w, h } = bounds;
  const meta = group.libraryComponent!;
  const textStyle = meta.textStyle;
  if (drawUiComponent(ctx, group, theme)) return;
  if (meta.renderStyle === "clean" && !kind.startsWith("er-")) { drawCleanModelComponent(ctx, group, theme, allElements); return; }
  // Modeling components share one plain visual language.
  const simple = true;
  const basePalette = paletteFor(theme === "dark");
  const palette: Palette = basePalette;
  const ink = meta.styleOverrides?.color ?? palette.ink;
  const fill = meta.styleOverrides?.fillColor === null ? "transparent" : meta.styleOverrides?.fillColor ?? palette.fill;
  const fillOpacity = meta.styleOverrides?.fillOpacity ?? 1;
  const maxLabelSize = Math.max(5, Math.min(48, h - 4));
  const size = Math.min(maxLabelSize, Math.max(5, meta.textStyle?.fontSize ?? 12));
  const name = meta.uiComponent?.properties.title ?? meta.label ?? kind.replace(/^(network|cloud|software|bpmn|uml|c4|er)-/, "").replace(/-/g, " ").toUpperCase();
  const field = (key: string) => componentFieldValue(group, key);
  const strokeWidth = 1.5;
  const shell = (radius = 12, inset = 0) => {
    roundRect(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, radius);
    if (fill !== "transparent") { ctx.save(); ctx.globalAlpha = fillOpacity; ctx.fillStyle = fill; ctx.fill(); ctx.restore(); }
    ctx.strokeStyle = ink === palette.ink ? palette.edge : ink; ctx.lineWidth = strokeWidth; ctx.stroke();
  };
  const componentText = (value: string, tx: number, ty: number, maxWidth: number, fontSize: number, color: string, weight = 500, align: CanvasTextAlign = "left") => {
    const textAlign = componentTextAlign(textStyle?.textAlign, align);
    const textColor = textStyle?.color ?? color;
    fittedComponentSingleLine(ctx, value.replace(/\s*\n\s*/g, " · "), bounds, componentTextAnchor(tx, maxWidth, align, textAlign), ty, maxWidth, Math.min(maxLabelSize, fontSize), textColor, weight, textAlign, textStyle);
  };
  const componentSingleLine = (value: string, tx: number, ty: number, maxWidth: number, fontSize: number, color: string, weight = 500, align: CanvasTextAlign = "left") => {
    const textAlign = componentTextAlign(textStyle?.textAlign, align);
    const textColor = textStyle?.color ?? color;
    fittedComponentSingleLine(ctx, value, bounds, componentTextAnchor(tx, maxWidth, align, textAlign), ty, maxWidth, Math.min(maxLabelSize, fontSize), textColor, weight, textAlign, textStyle);
  };
  const heading = (value = name, yy = y + Math.min(18, h * .18), left = x + 14, max = w - 28) => componentText(value.toUpperCase(), left, yy, max, size, ink, 700);
  const centerHeading = (value = name, yy = y + h * .55) => componentText(value, x + w / 2, yy, w - 18, size, ink, 650, "center");

  ctx.save();
  ctx.beginPath(); ctx.rect(x - 1, y - 1, w + 2, h + 2); ctx.clip();
  ctx.lineWidth = strokeWidth; ctx.lineCap = "round"; ctx.lineJoin = "round";
  const provider = cloudProviderComponent(kind);
  if (provider) {
    shell(5);
    const iconSide = Math.max(24, Math.min(64, h - 32, w * .38));
    const iconX = x + 12; const iconY = y + (h - iconSide) / 2 - 3;
    drawProviderArtwork(ctx, group, iconX, iconY, iconSide, palette.soft, palette.edge);
    const copyX = iconX + iconSide + 10;
    componentText( name, copyX, y + h * .43, w - (copyX - x) - 10, size, ink, 700);
    componentText( provider.provider.toUpperCase(), copyX, y + h * .63, w - (copyX - x) - 10, 8, palette.muted, 600);
    componentText( provider.description, x + 12, y + h - 8, w - 24, 8, palette.muted, 500);
    ctx.restore(); return;
  }
  if (kind === "cloud-boundary") {
    cloudPath(ctx, x, y, w, h); ctx.save(); ctx.globalAlpha = fillOpacity; ctx.fillStyle = fill === "transparent" ? palette.fill : fill; ctx.fill(); ctx.restore();
    ctx.strokeStyle = ink === palette.ink ? palette.edge : ink; ctx.setLineDash([8, 5]); ctx.stroke(); ctx.setLineDash([]);
    componentText( name.toUpperCase(), x + w * .24, y + h * .36, w * .5, size + 1, ink, 700);
    componentText( "DEPLOYMENT BOUNDARY", x + w * .24, y + h * .36 + size + 7, w * .5, Math.max(8, size * .72), palette.muted, 500);
    ctx.restore(); return;
  }
  if (kind === "network-zone" || kind === "c4-system" || kind === "c4-container" || kind === "c4-component") {
    shell(15); ctx.setLineDash([6, 4]); ctx.strokeStyle = palette.edge; strokeRectAligned(ctx, x + 5, y + 5, w - 10, h - 10); ctx.setLineDash([]);
    heading(); componentText( kind === "network-zone" ? "NETWORK BOUNDARY" : "SYSTEM CONTEXT", x + 14, y + Math.min(35, h * .28), w - 28, Math.max(8, size * .72), palette.muted, 500);
    ctx.restore(); return;
  }
  if (kind === "network-switch" || kind === "network-hub") {
    if (kind === "network-hub") {
      const count = Math.max(1, Math.min(32, Math.round(meta.portCount ?? 8)));
      const columns = Math.min(8, count); const rows = Math.ceil(count / columns);
      const rowHeight = Math.max(12, (h - 42) / rows); const cell = (w - 24) / columns;
      shell(simple ? 0 : 7);
      ctx.fillStyle = palette.soft; ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), 27);
      heading("ETHERNET HUB", y + 15, x + 12, w - 38);
      ctx.beginPath(); ctx.arc(x + w - 15, y + 14, 3, 0, Math.PI * 2); ctx.fillStyle = palette.accent; ctx.fill();
      ctx.strokeStyle = palette.edge; ctx.beginPath(); ctx.moveTo(x + 9, y + 31); ctx.lineTo(x + w - 9, y + 31); ctx.stroke();
      for (let index = 0; index < count; index++) {
        const col = index % columns; const row = Math.floor(index / columns);
        const cx = x + 12 + cell * (col + .5); const cy = y + 35 + row * rowHeight;
        const socketWidth = Math.max(4, Math.min(13, cell - 2)); const socketHeight = Math.max(4, Math.min(9, rowHeight * .55));
        roundRect(ctx, cx - socketWidth / 2, cy, socketWidth, socketHeight, simple ? 0 : 2);
        ctx.fillStyle = palette.fill; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke();
        ctx.fillStyle = palette.accent; ctx.fillRect(cx - Math.min(2, socketWidth / 4), cy + socketHeight - 2, Math.min(4, socketWidth / 2), 1.5);
      }
      const clients = field("connected-devices");
      if (clients && h > 68) componentText(clients, x + 12, y + h - 10, w - 24, 7, palette.muted, 500);
      else if (h > 68) componentText(`${count} PORT${count === 1 ? "" : "S"} · REPEATER`, x + 12, y + h - 10, w - 24, 8, palette.muted, 500);
    } else {
      const count = Math.max(1, Math.min(32, Math.round(meta.portCount ?? 6)));
      shell(simple ? 0 : 11); heading(name, y + 15);
      drawPorts(ctx, x, y, w, count, palette, false);
      if (count > 8) componentText( `${count} PORTS`, x + w - 10, y + 15, w * .45, Math.max(8, size * .7), palette.muted, 500, "right");
      const vlans = field("vlans");
      if (vlans) componentText(vlans, x + w / 2, y + h - 4, w - 16, Math.max(6, size * .55), palette.muted, 400, "center");
    }
    ctx.restore(); return;
  }
  if (kind === "network-server") {
    shell(10); const rows = Math.max(2, Math.min(4, Math.floor((h - 22) / 23))); const rowH = (h - 26) / rows;
    heading(); for (let index = 0; index < rows; index++) { const yy = y + 25 + index * rowH; roundRect(ctx, x + 10, yy, w - 20, rowH - 5, 4); ctx.fillStyle = palette.soft; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke(); ctx.beginPath(); ctx.arc(x + 20, yy + (rowH - 5) / 2, 2.4, 0, Math.PI * 2); ctx.fillStyle = palette.accent; ctx.fill(); }
    const addresses = field("ip-addresses"); const services = field("services");
    if (addresses && rows > 1) componentText(addresses, x + 28, y + 25 + rowH * 1.5, w - 38, Math.max(6, size * .52), palette.ink, 400);
    if (services && rows > 2) componentText(services, x + 28, y + 25 + rowH * 2.5, w - 38, Math.max(6, size * .5), palette.ink, 400);
    ctx.restore(); return;
  }
  if (kind === "network-firewall") {
    shell(9); heading();
    const action = field("default-action"); const rules = field("rules");
    if (action) componentText(`Default: ${action}`, x + 10, y + 27, w - 20, Math.max(7, size * .55), palette.muted, 500);
    const top = y + Math.min(42, h * .46); const rowH = (h - (top - y) - 10) / 2;
    for (let row = 0; row < 2; row++) { const yy = top + row * rowH; for (let col = 0; col < 4; col++) { const bw = (w - 28) / 4; roundRect(ctx, x + 10 + col * bw + (row % 2 ? bw / 2 : 0), yy + 2, bw - 4, rowH - 5, 2); ctx.fillStyle = palette.soft; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke(); } }
    if (rules) componentText(rules, x + 10, y + h - 5, w - 20, Math.max(6, size * .5), palette.muted, 400);
    ctx.restore(); return;
  }
  if (kind === "network-access-point") {
    const diameter = Math.min(w * .56, h * .64); const radius = diameter / 2; const cx = x + w / 2; const cy = y + h * .38;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fillStyle = palette.soft; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.lineWidth = strokeWidth; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, radius * .78, 0, Math.PI * 2); ctx.fillStyle = fill === "transparent" ? palette.fill : fill; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = palette.accent; ctx.lineWidth = strokeWidth; ctx.beginPath(); ctx.moveTo(cx - radius * .31, cy - radius * .03); ctx.quadraticCurveTo(cx, cy - radius * .56, cx + radius * .31, cy - radius * .03); ctx.moveTo(cx - radius * .17, cy + radius * .12); ctx.quadraticCurveTo(cx, cy - radius * .16, cx + radius * .17, cy + radius * .12); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy + radius * .26, Math.max(1.5, radius * .06), 0, Math.PI * 2); ctx.fillStyle = palette.accent; ctx.fill();
    for (const offset of [-.18, 0, .18]) { ctx.beginPath(); ctx.arc(cx + radius * offset * 3, cy + radius * .62, Math.max(1.2, radius * .045), 0, Math.PI * 2); ctx.fillStyle = palette.accent; ctx.fill(); }
    const ssid = field("ssid"); const security = field("security-mode");
    if (ssid) componentText(ssid, cx, y + h * .72, w - 12, Math.max(7, size * .62), palette.muted, 500, "center");
    if (security) componentText(security, cx, y + h * .86, w - 12, Math.max(7, size * .56), palette.muted, 400, "center");
    else componentText(name, cx, y + h * .88, w - 12, size, ink, 700, "center");
    ctx.restore(); return;
  }
  if (kind === "network-router" || kind === "network-load-balancer" || kind === "network-client") {
    shell(kind === "network-client" ? 8 : 16); heading();
    const cy = y + h * .58; const cx = x + w / 2;
    if (kind === "network-client") {
      const platform = field("platform"); const network = field("network");
      if (platform) componentText(platform, cx, y + h * .47, w * .68, Math.max(7, size * .62), palette.ink, 500, "center");
      if (network) componentText(network, cx, y + h * .58, w * .68, Math.max(6, size * .54), palette.muted, 400, "center");
      ctx.strokeStyle = palette.edge; ctx.beginPath(); ctx.moveTo(x + w * .28, y + h * .78); ctx.lineTo(x + w * .72, y + h * .78); ctx.moveTo(cx, y + h * .64); ctx.lineTo(cx, y + h * .79); ctx.stroke();
    }
    else if (kind === "network-load-balancer") {
      const listeners = field("listeners"); if (listeners) componentText(listeners, cx, y + h * .3, w - 20, Math.max(7, size * .58), palette.muted, 400, "center");
      ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * .13, 0, Math.PI * 2); ctx.fillStyle = palette.soft; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke(); for (const direction of [-1, 0, 1]) { const xx = cx + direction * w * .31; ctx.beginPath(); ctx.moveTo(cx, cy + 10); ctx.lineTo(xx, y + h * .82); ctx.stroke(); ctx.beginPath(); ctx.arc(xx, y + h * .82, 4, 0, Math.PI * 2); ctx.fillStyle = palette.accent; ctx.fill(); }
    }
    else {
      const protocol = field("routing-protocol"); const asn = field("autonomous-system");
      if (protocol) componentText(protocol + (asn ? ` · AS${asn}` : ""), cx, y + h * .36, w - 16, Math.max(7, size * .58), palette.muted, 500, "center");
      ctx.strokeStyle = palette.edge; for (const direction of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx, cy + direction * 8); ctx.lineTo(cx + direction * w * .27, cy + direction * h * .22); ctx.stroke(); }
    }
    ctx.restore(); return;
  }
  if (kind === "software-database" || kind === "cloud-database") {
    ctx.beginPath(); ctx.moveTo(x + w * .07, y + 13); ctx.lineTo(x + w * .07, y + h - 13); ctx.ellipse(x + w / 2, y + h - 13, w * .43, 10, 0, Math.PI, 0, true); ctx.lineTo(x + w * .93, y + 13); ctx.closePath();
    ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + 13, w * .43, 10, 0, 0, Math.PI * 2); ctx.fillStyle = fill === "transparent" ? "#fff" : fill; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * .48, w * .43, 9, 0, 0, Math.PI); ctx.stroke();
    if (kind === "cloud-database") { centerHeading("MANAGED DATABASE", y + h * .39); componentText( "SQL / BACKUP / REPLICAS", x + w / 2, y + h * .69, w - 18, Math.max(7, size * .52), ink, 400, "center"); }
    else centerHeading(name, y + h * .33);
    ctx.restore(); return;
  }
  if (kind === "software-queue" || kind === "cloud-queue") {
    shell(12); heading(); const count = 3; const itemW = (w - 34) / count;
    for (let index = 0; index < count; index++) { roundRect(ctx, x + 12 + index * (itemW + 5), y + h * .44, itemW, h * .32, 5); ctx.fillStyle = palette.soft; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke(); }
    ctx.restore(); return;
  }
  if (kind.startsWith("er-") && !["er-table", "er-one-one", "er-one-many", "er-many-one", "er-many-many"].includes(kind)) {
    const erEdge = meta.styleOverrides?.color ?? palette.edge;
    const erFill = meta.styleOverrides?.fillColor === null ? "transparent" : meta.styleOverrides?.fillColor ?? palette.fill;
    const erName = meta.label ?? name;
    const paintShape = () => { ctx.fillStyle = erFill === "transparent" ? "rgba(0,0,0,0)" : erFill; if (erFill !== "transparent") ctx.fill(); ctx.strokeStyle = erEdge; ctx.lineWidth = strokeWidth; ctx.stroke(); };
    const erLabel = (value = erName, tx = x + w / 2, ty = y + h / 2, maxWidth = w - 14, underline = false) => {
      componentSingleLine(value, tx, ty, maxWidth, size, erEdge, 500, "center");
      if (underline && value) { const textWidth = Math.min(maxWidth, value.length * size * .56); ctx.beginPath(); ctx.moveTo(tx - textWidth / 2, ty + size * .42); ctx.lineTo(tx + textWidth / 2, ty + size * .42); ctx.strokeStyle = erEdge; ctx.lineWidth = 1; ctx.stroke(); }
    };
    if (["er-entity", "er-weak-entity", "er-associative-entity"].includes(kind)) {
      const inset = kind === "er-weak-entity" ? 6 : 0;
      ctx.beginPath(); ctx.rect(x + inset, y + inset, w - inset * 2, h - inset * 2); paintShape();
      if (kind === "er-weak-entity") { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.strokeStyle = erEdge; ctx.stroke(); }
      if (kind === "er-associative-entity") { ctx.beginPath(); ctx.moveTo(x + w / 2, y + 2); ctx.lineTo(x + w / 2 + 10, y + 12); ctx.lineTo(x + w / 2, y + 22); ctx.lineTo(x + w / 2 - 10, y + 12); ctx.closePath(); paintShape(); }
      erLabel(erName, x + w / 2, y + 17, w - 16);
      if (kind === "er-weak-entity") {
        const owner = field("owner"); const discriminator = field("partial-key");
        if (owner) erLabel(`Owner: ${owner}`, x + w / 2, y + 37, w - 18);
        if (discriminator) erLabel(`Key: ${discriminator}`, x + w / 2, y + 56, w - 18);
      } else if (kind === "er-associative-entity") {
        const participants = [field("first-entity"), field("second-entity")].filter(Boolean).join(" / "); const key = field("association-key");
        if (participants) erLabel(participants, x + w / 2, y + 42, w - 18);
        if (key) erLabel(`Key: ${key}`, x + w / 2, y + 65, w - 18);
      } else {
        const identifier = field("identifier"); const attributes = field("attributes").split(/\r?\n/).filter(Boolean);
        if (identifier) erLabel(`PK ${identifier}`, x + w / 2, y + 38, w - 18);
        attributes.slice(0, 2).forEach((attribute, index) => erLabel(attribute, x + w / 2, y + 56 + index * 14, w - 18));
      }
    } else if (kind === "er-relationship" || kind === "er-identifying-relationship") {
      ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h / 2); ctx.closePath(); paintShape();
      if (kind === "er-identifying-relationship") { ctx.beginPath(); ctx.moveTo(x + w / 2, y + 7); ctx.lineTo(x + w - 8, y + h / 2); ctx.lineTo(x + w / 2, y + h - 7); ctx.lineTo(x + 8, y + h / 2); ctx.closePath(); ctx.strokeStyle = erEdge; ctx.stroke(); }
      erLabel(erName, x + w / 2, y + h * .42, w * .62);
      const sourceRole = field(kind === "er-identifying-relationship" ? "owner-role" : "source-role");
      const targetRole = field(kind === "er-identifying-relationship" ? "dependent-role" : "target-role");
      if (sourceRole || targetRole) erLabel(`${sourceRole || "?"} - ${targetRole || "?"}`, x + w / 2, y + h * .66, w * .48);
    } else if (kind.includes("attribute")) {
      const double = kind === "er-multivalued-attribute"; const radii = attributeRadii(w, h, strokeWidth, double);
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, radii.innerX, radii.innerY, 0, 0, Math.PI * 2);
      if (kind === "er-derived-attribute" || kind === "er-partial-key-attribute") ctx.setLineDash([4, 3]); paintShape(); ctx.setLineDash([]);
      if (double) { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, radii.outerX, radii.outerY, 0, 0, Math.PI * 2); ctx.strokeStyle = erEdge; ctx.stroke(); }
      erLabel(erName, x + w / 2, y + h * .42, w * .72, kind === "er-key-attribute" || kind === "er-partial-key-attribute");
      const type = field(kind === "er-multivalued-attribute" ? "element-type" : kind === "er-derived-attribute" ? "expression" : "data-type");
      if (type) erLabel(type, x + w / 2, y + h * .7, w * .7);
    } else if (kind === "er-composite-attribute") {
      const parentX = x + w / 2; const parentY = y + h * .22; const childY = y + h * .77;
      ctx.beginPath(); ctx.moveTo(parentX, parentY + h * .16); ctx.lineTo(x + w * .25, childY - h * .16); ctx.moveTo(parentX, parentY + h * .16); ctx.lineTo(x + w * .75, childY - h * .16); ctx.strokeStyle = erEdge; ctx.stroke();
      for (const [cx, cy, rx] of [[parentX, parentY, w * .18], [x + w * .25, childY, w * .22], [x + w * .75, childY, w * .22]] as const) { ctx.beginPath(); ctx.ellipse(cx, cy, rx, h * .16, 0, 0, Math.PI * 2); paintShape(); }
      erLabel(erName, parentX, parentY);
      erLabel(meta.componentFields?.find(field => field.key === "sub-attribute-1")?.value ?? "Attribute 1", x + w * .25, childY, w * .34);
      erLabel(meta.componentFields?.find(field => field.key === "sub-attribute-2")?.value ?? "Attribute 2", x + w * .75, childY, w * .34);
    }
    ctx.restore(); return;
  }
  if (kind === "uml-package") {
    const tabW = Math.min(w * .42, 86); const tabH = Math.min(22, h * .22);
    ctx.beginPath(); ctx.moveTo(x, y + tabH); ctx.lineTo(x, y + 2); ctx.lineTo(x + tabW, y + 2); ctx.lineTo(x + tabW + 12, y + tabH); ctx.lineTo(x + w - 2, y + tabH); ctx.lineTo(x + w - 2, y + h - 2); ctx.lineTo(x + 2, y + h - 2); ctx.closePath(); ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = meta.styleOverrides?.color ?? palette.edge; ctx.lineWidth = 1.3; ctx.stroke();
    const namespace = field("namespace"); const contents = field("contents");
    componentText(name, x + w / 2, y + tabH + h * .31, w - 24, size, ink, 650, "center");
    if (namespace) componentText(namespace, x + w / 2, y + tabH + h * .52, w - 24, Math.max(7, size * .7), palette.muted, 500, "center");
    if (contents) componentText(contents, x + w / 2, y + tabH + h * .7, w - 24, Math.max(7, size * .64), ink, 400, "center");
    ctx.restore(); return;
  }
  if (kind === "uml-actor") {
    const cx = x + w / 2; const figureWidth = Math.min(58, w * .72); const head = Math.min(12, h * .11); ctx.strokeStyle = ink; ctx.beginPath(); ctx.arc(cx, y + head + 3, head, 0, Math.PI * 2); ctx.moveTo(cx, y + head * 2 + 3); ctx.lineTo(cx, y + h * .58); ctx.moveTo(cx - figureWidth * .38, y + h * .38); ctx.lineTo(cx + figureWidth * .38, y + h * .38); ctx.moveTo(cx, y + h * .58); ctx.lineTo(cx - figureWidth * .3, y + h * .69); ctx.moveTo(cx, y + h * .58); ctx.lineTo(cx + figureWidth * .3, y + h * .69); ctx.stroke();
    const role = field("role"); const goal = field("goal");
    componentText(name, cx, y + h - (role && goal ? 42 : role || goal ? 30 : 20), w - 8, size, ink, 500, "center");
    if (role) componentText(role, cx, y + h - (goal ? 25 : 8), w - 8, Math.max(7, size * .64), palette.muted, 400, "center");
    if (goal) componentText(goal, cx, y + h - 8, w - 8, Math.max(7, size * .58), ink, 400, "center");
    ctx.restore(); return;
  }
  if (kind === "uml-use-case") { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2 - strokeWidth / 2, h / 2 - strokeWidth / 2, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke(); centerHeading(name, y + h / 2); const outcome = field("outcome"); if (outcome) componentText(outcome, x + w / 2, y + h * .68, w * .64, Math.max(7, size * .62), palette.muted, 400, "center"); ctx.restore(); return; }
  if (kind === "uml-lifeline") { roundRect(ctx, x, y, w, Math.min(34, h), simple ? 0 : 8); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke(); heading(name, y + 17); ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(x + w / 2, y + 34); ctx.lineTo(x + w / 2, y + h); ctx.strokeStyle = palette.edge; ctx.stroke(); ctx.setLineDash([]); ctx.restore(); return; }
  if (kind === "uml-activation") { roundRect(ctx, x + .65, y, Math.max(1, w - 1.3), h, 1); ctx.fillStyle = palette.soft; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke(); ctx.restore(); return; }
  if (kind.startsWith("sequence-") || kind.startsWith("uml-") && ["uml-inheritance", "uml-realization", "uml-aggregation", "uml-composition", "uml-association", "uml-dependency", "uml-include", "uml-extend"].includes(kind) || kind.startsWith("er-one-") || kind === "er-many-one" || kind === "er-many-many" || kind === "data-flow") {
    const yy = y + h / 2; const relationshipDiamond = kind === "uml-aggregation" || kind === "uml-composition";
    if (kind === "uml-realization" || kind === "uml-dependency" || kind === "uml-include" || kind === "uml-extend") ctx.setLineDash([5, 4]);
    ctx.strokeStyle = ink; ctx.beginPath(); ctx.moveTo(x + (relationshipDiamond ? 25 : 6), yy); ctx.lineTo(x + w - 9, yy); ctx.stroke(); ctx.setLineDash([]);
    if (kind.startsWith("sequence-")) { ctx.beginPath(); ctx.moveTo(x + w - 18, yy - 6); ctx.lineTo(x + w - 8, yy); ctx.lineTo(x + w - 18, yy + 6); if (kind === "sequence-sync") { ctx.closePath(); ctx.fillStyle = ink; ctx.fill(); } else ctx.stroke(); }
    else if (kind === "uml-inheritance" || kind === "uml-realization" || kind === "uml-dependency" || kind === "uml-include" || kind === "uml-extend") { ctx.beginPath(); ctx.moveTo(x + w - 19, yy - 8); ctx.lineTo(x + w - 8, yy); ctx.lineTo(x + w - 19, yy + 8); if (kind === "uml-inheritance" || kind === "uml-realization") ctx.closePath(); ctx.fillStyle = fill; if (kind === "uml-inheritance" || kind === "uml-realization") ctx.fill(); ctx.stroke(); }
    if (kind === "uml-aggregation" || kind === "uml-composition") { ctx.beginPath(); ctx.moveTo(x + 7, yy); ctx.lineTo(x + 16, yy - 6); ctx.lineTo(x + 25, yy); ctx.lineTo(x + 16, yy + 6); ctx.closePath(); if (kind === "uml-composition") { ctx.fillStyle = ink; ctx.fill(); } else { ctx.fillStyle = fill; ctx.fill(); } ctx.stroke(); }
    if (kind.startsWith("er-one-") || kind === "er-many-one" || kind === "er-many-many") {
      const leftMany = kind === "er-many-one" || kind === "er-many-many"; const rightMany = kind === "er-one-many" || kind === "er-many-many";
      const marker = (px: number, direction: number, many: boolean) => {
        ctx.beginPath();
        if (many) { ctx.moveTo(px, yy); ctx.lineTo(px + direction * 12, yy - 8); ctx.moveTo(px, yy); ctx.lineTo(px + direction * 12, yy); ctx.moveTo(px, yy); ctx.lineTo(px + direction * 12, yy + 8); }
        else { ctx.moveTo(px, yy - 8); ctx.lineTo(px, yy + 8); }
        ctx.stroke();
      };
      ctx.strokeStyle = ink; marker(x + 8, 1, leftMany); marker(x + w - 8, -1, rightMany);
    }
    if (kind === "sequence-sync" || kind === "sequence-async" || kind === "uml-include" || kind === "uml-extend") componentText(kind === "uml-include" ? "<<include>>" : kind === "uml-extend" ? "<<extend>>" : name, x + w / 2, y + 9, w - 20, Math.max(8, size * .7), palette.muted, 500, "center");
    ctx.restore(); return;
  }
  if (kind.startsWith("bpmn-")) {
    if (["bpmn-start", "bpmn-event", "bpmn-end"].includes(kind)) { ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) * .44, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = kind === "bpmn-end" ? 2 : strokeWidth; ctx.stroke(); if (kind === "bpmn-event") { ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) * .34, 0, Math.PI * 2); ctx.stroke(); } }
    else if (kind.includes("gateway")) { ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h / 2); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = ink; ctx.stroke(); ctx.beginPath(); if (kind === "bpmn-parallel-gateway") { ctx.moveTo(x + w * .5, y + h * .3); ctx.lineTo(x + w * .5, y + h * .7); ctx.moveTo(x + w * .3, y + h * .5); ctx.lineTo(x + w * .7, y + h * .5); } else { ctx.moveTo(x + w * .34, y + h * .34); ctx.lineTo(x + w * .66, y + h * .66); ctx.moveTo(x + w * .66, y + h * .34); ctx.lineTo(x + w * .34, y + h * .66); } ctx.stroke(); }
    else { shell(kind === "bpmn-pool" ? 4 : 10); if (kind === "bpmn-pool") { ctx.beginPath(); ctx.moveTo(x + 31, y); ctx.lineTo(x + 31, y + h); ctx.moveTo(x + 31, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.strokeStyle = palette.edge; ctx.stroke(); } centerHeading(name); }
    ctx.restore(); return;
  }
  if (kind === "uml-class" || kind === "uml-interface" || kind === "er-table") {
    shell(9); const headerH = kind === "er-table" ? Math.min(34, h * .23) : Math.min(36, h * .28); ctx.fillStyle = palette.soft; roundRect(ctx, x + 1, y + 1, w - 2, headerH, 8); ctx.fill(); ctx.strokeStyle = palette.edge; ctx.beginPath(); ctx.moveTo(x, y + headerH); ctx.lineTo(x + w, y + headerH); ctx.stroke();
    if (kind === "uml-interface") componentSingleLine("<<interface>>", x + 12, y + 12, w - 24, Math.max(7, size * .66), palette.muted, 400);
    heading(name, kind === "uml-interface" ? y + 31 : y + headerH / 2, x + 12, w - 24);
    const field = (key: string) => meta.componentFields?.find(value => value.key === key)?.value.trim() ?? "";
    const writeLines = (value: string, top: number, availableHeight: number) => {
      const lines = value.split(/\r?\n/).filter(Boolean).slice(0, Math.max(1, Math.floor(availableHeight / 14)));
      lines.forEach((line, index) => componentSingleLine(line, x + 12, top + 11 + index * 14, w - 24, Math.max(7, size * .72), palette.ink, 400));
    };
    if (kind === "uml-class") {
      const divider = y + headerH + (h - headerH) * .49; ctx.beginPath(); ctx.moveTo(x, divider); ctx.lineTo(x + w, divider); ctx.stroke();
      writeLines(field("attributes"), y + headerH + 5, divider - y - headerH - 8); writeLines(field("methods"), divider + 5, y + h - divider - 8);
    } else if (kind === "uml-interface") {
      ctx.beginPath(); ctx.moveTo(x, y + h * .46); ctx.lineTo(x + w, y + h * .46); ctx.stroke(); writeLines(field("operations"), y + h * .46 + 4, h * .54 - 8);
    } else {
      ctx.beginPath(); ctx.moveTo(x, y + headerH + (h - headerH) / 3); ctx.lineTo(x + w, y + headerH + (h - headerH) / 3); ctx.moveTo(x, y + headerH + (h - headerH) * 2 / 3); ctx.lineTo(x + w, y + headerH + (h - headerH) * 2 / 3); ctx.stroke();
      ["column-1", "column-2", "column-3"].forEach((key, index) => writeLines(field(key), y + headerH + index * ((h - headerH) / 3) + 2, (h - headerH) / 3 - 4));
    }
    ctx.restore(); return;
  }
  shell(12); centerHeading(name); ctx.restore();
}

type ComponentBitmap = { canvas: HTMLCanvasElement; pixels: number; lastUsed: number };
const componentBitmapCache = new Map<string, ComponentBitmap>();
let componentBitmapPixels = 0;
let componentBitmapClock = 0;
const MAX_COMPONENT_BITMAPS = 96;
const MAX_COMPONENT_BITMAP_PIXELS = 12_000_000;
function componentBitmapLimits() {
  const lightweight = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  return lightweight ? { count: 24, pixels: 2_000_000 } : { count: MAX_COMPONENT_BITMAPS, pixels: MAX_COMPONENT_BITMAP_PIXELS };
}

function shortHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

function componentRasterKey(group: GroupElement, theme: Theme, pixelWidth: number, pixelHeight: number) {
  const meta = group.libraryComponent!;
  const iconUrl = componentIconDataUrl(group); const icon = iconUrl ? componentIconImages.get(iconUrl) : undefined;
  const fields = JSON.stringify([meta.label, meta.uiComponent, meta.chartData, meta.componentFields?.map(field => [field.key, field.value]), meta.iconSvg, meta.iconViewBox, icon?.complete && icon.naturalWidth > 0]);
  const style = JSON.stringify([meta.styleOverrides, meta.textStyle, meta.renderStyle, meta.appearance, theme]);
  return `${meta.kind}:${group.componentBounds!.w}x${group.componentBounds!.h}:${shortHash(style)}:${pixelWidth}x${pixelHeight}:${shortHash(fields)}`;
}

function cachedComponentBitmap(group: GroupElement, theme: Theme, pixelWidth: number, pixelHeight: number): ComponentBitmap | undefined {
  const bounds = group.componentBounds;
  if (!bounds || typeof document === "undefined") return undefined;
  if (pixelWidth < 1 || pixelHeight < 1 || pixelWidth > 4096 || pixelHeight > 4096 || pixelWidth * pixelHeight > 4_000_000) return undefined;
  const key = componentRasterKey(group, theme, pixelWidth, pixelHeight);
  let entry = componentBitmapCache.get(key);
  if (entry) { entry.lastUsed = ++componentBitmapClock; return entry; }
  const canvas = document.createElement("canvas"); canvas.width = pixelWidth; canvas.height = pixelHeight;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.setTransform(pixelWidth / bounds.w, 0, 0, pixelHeight / bounds.h, 0, 0);
  const localGroup = { ...group, rotation: 0, componentBounds: { x: 0, y: 0, w: bounds.w, h: bounds.h } };
  drawModelComponentDirect(context, localGroup, theme);
  const pixels = pixelWidth * pixelHeight;
  entry = { canvas, pixels, lastUsed: ++componentBitmapClock };
  componentBitmapCache.set(key, entry); componentBitmapPixels += pixels;
  const limits = componentBitmapLimits();
  while ((componentBitmapCache.size > limits.count || componentBitmapPixels > limits.pixels) && componentBitmapCache.size > 1) {
    const oldest = [...componentBitmapCache.entries()].reduce((candidate, current) => current[1].lastUsed < candidate[1].lastUsed ? current : candidate);
    componentBitmapCache.delete(oldest[0]); componentBitmapPixels = Math.max(0, componentBitmapPixels - oldest[1].pixels);
  }
  return entry;
}

export function drawModelComponent(ctx: CanvasRenderingContext2D, group: GroupElement, theme: Theme, allowRasterCache = true, allElements?: readonly Element[]) {
  const bounds = group.componentBounds; const kind = group.libraryComponent?.kind;
  if (!bounds || !kind) return;
  const proposal = proposalComponentForKind(kind);
  const pageAwarePlanning = proposal?.section.startsWith("Visual planning") ?? false;
  const transform = ctx.getTransform();
  const isIntegerPixel = (value: number) => Math.abs(value - Math.round(value)) < 1e-7;
  const pixelX = transform.a * bounds.x + transform.e;
  const pixelY = transform.d * bounds.y + transform.f;
  const pixelWidth = transform.a * bounds.w;
  const pixelHeight = transform.d * bounds.h;
  // Cached components stay sharp only when their bitmap has the exact output
  // dimensions and lands on the physical pixel grid. Fractional scales,
  // subpixel positions, and rotation use the vector renderer directly.
  const cacheable = Math.abs(transform.b) < 1e-8 && Math.abs(transform.c) < 1e-8
    && transform.a > 0 && transform.d > 0 && Math.abs(transform.a - transform.d) < 1e-7
    && [pixelX, pixelY, pixelWidth, pixelHeight].every(isIntegerPixel);
  if (cacheable && allowRasterCache && !pageAwarePlanning) {
    const bitmap = cachedComponentBitmap(group, theme, Math.round(pixelWidth), Math.round(pixelHeight));
    if (bitmap) {
      ctx.save(); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bitmap.canvas, bounds.x, bounds.y, bounds.w, bounds.h); ctx.restore();
      return;
    }
  }
  drawModelComponentDirect(ctx, group, theme, allElements);
}

function renderModelComponentSvg(group: GroupElement, theme: Theme, allElements?: readonly Element[]): string {
  const uiSvg = uiComponentSvg(group, theme);
  if (uiSvg) return uiSvg;
  const bounds = group.componentBounds; const kind = group.libraryComponent?.kind;
  if (!bounds || !kind) return "";
  const { x, y, w, h } = bounds; const meta = group.libraryComponent!;
  const field = (key: string) => componentFieldValue(group, key);
  const simple = true;
  const basePalette = paletteFor(theme === "dark");
  const palette: Palette = basePalette;
  const edge = meta.styleOverrides?.color ?? palette.edge;
  const fill = meta.styleOverrides?.fillColor === null ? "none" : meta.styleOverrides?.fillColor ?? group.container?.background ?? palette.fill;
  const rawTitle = meta.uiComponent?.properties.title ?? meta.label ?? kind.replace(/-/g, " ");
  const maxLabelSize = Math.max(5, Math.min(48, h - 4));
  const size = Math.min(maxLabelSize, Math.max(5, meta.textStyle?.fontSize ?? 12));
  const strokeWidth = 1.5;
  const xmlText = (value: string) => value.replace(/[&<>]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]!);
  const fitXmlText = (value: string, availableWidth: number, fontSize = size) => {
    const fittedFont = Math.max(9, fontSize);
    const maxCharacters = Math.max(1, Math.floor(availableWidth / Math.max(1, fittedFont * .58)));
    const lines = wrapComponentApprox(value, availableWidth, fittedFont);
    if (lines.length > 2) {
      lines.length = 2;
      const last = lines[1].slice(0, Math.max(0, maxCharacters - 1)).trimEnd();
      lines[1] = `${last}…`;
    }
    if (lines.length < 2) return xmlText(lines[0]);
    return `<tspan dy="-0.6em">${xmlText(lines[0])}</tspan><tspan dy="1.2em">${xmlText(lines[1])}</tspan>`;
  };
  const title = xmlText(rawTitle);
  const fitTextAttribute = (value: string, availableWidth: number, fontSize = size) => value.length * fontSize * .58 > availableWidth
    ? ` textLength="${Math.max(1, availableWidth)}" lengthAdjust="spacingAndGlyphs"`
    : "";
  if (meta.renderStyle === "clean" && !kind.startsWith("er-")) {
    const ink = meta.styleOverrides?.color ?? palette.ink; const cleanFill = fill; const soft = palette.soft;
    const t = (value: string, tx: number, ty: number, tw = w - 20, font = size, anchor = "start", weight = 600) => {
      const fittedFont = Math.max(5, Math.min(maxLabelSize, font));
      const textAnchor = meta.textStyle?.textAlign === "center" ? "middle" : meta.textStyle?.textAlign === "right" ? "end" : meta.textStyle?.textAlign === "left" ? "start" : anchor;
      const left = anchor === "middle" ? tx - tw / 2 : anchor === "end" ? tx - tw : tx;
      const textX = textAnchor === "middle" ? left + tw / 2 : textAnchor === "end" ? left + tw : left;
      const maxChars = Math.max(1, Math.floor(Math.max(1, tw) / (fittedFont * .58)));
      const lines = value.split(/\r?\n/).flatMap(paragraph => {
        const result: string[] = []; let line = "";
        for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
          if (line && `${line} ${word}`.length <= maxChars) { line += ` ${word}`; continue; }
          if (line) { result.push(line); line = ""; }
          for (let offset = 0; offset < word.length; offset += maxChars) {
            const fragment = word.slice(offset, offset + maxChars);
            if (offset + maxChars < word.length) result.push(fragment); else line = fragment;
          }
        }
        if (line) result.push(line);
        return result.length ? result : [""];
      });
      const lineHeight = fittedFont * 1.18; const maxLines = Math.min(2, Math.max(1, Math.floor((h - 8) / lineHeight)));
      if (lines.length > maxLines) {
        lines.length = maxLines;
        let last = lines[maxLines - 1].slice(0, Math.max(0, maxChars - 1));
        lines[maxLines - 1] = `${last.trimEnd()}…`;
      }
      const stackHeight = lines.length * lineHeight;
      const centerY = Math.max(y + stackHeight / 2 + 2, Math.min(y + h - stackHeight / 2 - 2, ty));
      const firstY = centerY - stackHeight / 2 + lineHeight / 2;
      const tspans = lines.map((line, index) => `<tspan x="${textX}" y="${firstY + index * lineHeight}">${xmlText(line)}</tspan>`).join("");
      return `<text text-anchor="${textAnchor}" dominant-baseline="middle" fill="${ink}" font-family="${componentFontFamily(meta.textStyle?.fontFamily)}" font-size="${fittedFont}" font-weight="${weight}">${tspans}</text>`;
    };
    const block = (rows: [string, string][], left: number, top: number, width: number, font: number, height: number) => {
      const fittedFont = Math.max(9, Math.min(10, font)); const lineHeight = fittedFont * 1.3; const maxLines = Math.max(1, Math.floor(height / lineHeight));
      const lines = rows.flatMap(([label, value]) => wrapComponentApprox(`${label}: ${value.replace(/\s*\n\s*/g, " · ")}`, width, fittedFont));
      const visible = lines.slice(0, maxLines);
      if (lines.length > maxLines && visible.length) visible[visible.length - 1] = `${visible[visible.length - 1].slice(0, Math.max(0, Math.floor(width / (fittedFont * .58)) - 1)).trimEnd()}…`;
      const tspans = visible.map((line, index) => `<tspan x="${left}" y="${top + fittedFont + index * lineHeight}">${xmlText(line)}</tspan>`).join("");
      return `<text text-anchor="start" fill="${ink}" font-family="sans-serif" font-size="${fittedFont}" font-weight="400">${tspans}</text>`;
    };
    const field = (key: string) => componentFieldValue(group, key);
    const r = (rx = x, ry = y, rw = w, rh = h, color = cleanFill, radius = 0) => `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}"${radius > 0 ? ` rx="${Math.min(radius, rw / 2, rh / 2)}" ry="${Math.min(radius, rw / 2, rh / 2)}"` : ""} fill="${color}" stroke="${ink}" stroke-width="1.3"/>`;
    const p = (d: string, dash = "") => `<path d="${d}" fill="none" stroke="${ink}" stroke-width="1.3"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
    const proposal = proposalComponentForKind(kind);
    const planningSvg = proposalPlanningComponentSvg(group, theme, allElements);
    if (planningSvg !== undefined) return planningSvg;
    const wireframeSvg = proposalWireframeComponentSvg(group, theme);
    if (wireframeSvg !== undefined) return wireframeSvg;
    if (kind === "proposal-systems-provided-interface" || kind === "proposal-systems-required-interface") {
      const cx = x + w * .16; const cy = y + h / 2; const radius = Math.max(10, Math.min(18, h * .16, w * .08));
      const glyph = kind.endsWith("provided-interface")
        ? `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${cleanFill}" stroke="${ink}"/>`
        : `<path d="M ${cx + radius * .18} ${cy - radius * .76} A ${radius} ${radius} 0 0 0 ${cx + radius * .18} ${cy + radius * .76} M ${cx + radius * .18} ${cy - radius * .76} V ${cy + radius * .76}" fill="none" stroke="${ink}"/>`;
      const responsible = kind.endsWith("provided-interface") ? field("provider") : field("consumer");
      const details = [["Role", responsible], ["Operations", field("operations")], ["Protocol", field("protocol")]].filter(([, item]) => !!item);
      return `${p(`M ${x} ${cy} H ${cx - radius}`)}${glyph}${t(kind.endsWith("provided-interface") ? "provided interface" : "required interface", x + w * .34, cy - 18, w * .62, 9, "start", 600)}${t(field("interface") || rawTitle, x + w * .34, cy + 1, w * .62, Math.min(14, size), "start", 650)}${details.map(([label, item], index) => t(`${label}: ${item}`, x + w * .34, cy + 23 + index * 16, w * .62, 9, "start", 400)).join("")}`;
    }
    if (proposal?.section.startsWith("Systems engineering") && proposal.archetype !== "connector") {
      const fieldLabel = (key: string) => meta.componentFields?.find(item => item.key === key)?.label ?? key.replace(/-/g, " ");
      const rows = (keys: string[], top: number, bottom: number, left = x + 10, width = w - 20) => {
        const renderedKeys = kind === "proposal-systems-sysml-block" && !keys.includes("stereotype") ? ["stereotype", ...keys] : keys;
        return block(
          renderedKeys.map(key => [fieldLabel(key), field(key)] as [string, string]).filter(([, value]) => !!value),
          left, top, width, Math.min(10, size * .7), Math.max(0, bottom - top),
        );
      };
      if (kind === "proposal-systems-sysml-requirement") {
        const id = field("requirement-id"); const statement = field("statement");
        return `${r(x, y, w, h, cleanFill, 2)}${t("«requirement»", x + 10, y + 14, w - 20, 9, "start", 600)}${t(id ? `ID: ${id}` : rawTitle, x + 10, y + 33, w - 20, Math.min(15, size), "start", 650)}${p(`M ${x} ${y + 43} H ${x + w}`)}${statement ? t(statement, x + 10, y + 72, w - 20, Math.min(13, size), "start", 500) : ""}${p(`M ${x} ${y + h * .61} H ${x + w}`)}${rows(["rationale", "verification"], y + h * .61, y + h)}`;
      }
      if (kind === "proposal-systems-sysml-block") return `${r(x, y, w, h, cleanFill, 2)}${t("«block»", x + 10, y + 14, w - 20, 9, "start", 600)}${t(rawTitle, x + 10, y + 34, w - 20, Math.min(15, size), "start", 650)}${p(`M ${x} ${y + 44} H ${x + w}`)}${rows(["parts", "values", "interfaces"], y + 45, y + h)}`;
      if (kind === "proposal-systems-activity-partition") return `${r(x, y, w, h, cleanFill, 0)}<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="31" fill="${soft}"/><path d="M ${x} ${y + 33} H ${x + w}" fill="none" stroke="${ink}"/>${t(field("responsibility") || rawTitle, x + 10, y + 18, w - 20, Math.min(13, size), "start", 650)}${rows(["actions", "inputs", "outputs"], y + 34, y + h - 8)}`;
      if (kind === "proposal-systems-time-event" || kind === "proposal-systems-change-event") {
        const radius = Math.max(16, Math.min(24, h * .16, w * .12)); const cx = x + radius + 12; const cy = y + h / 2; const contentX = x + radius * 2 + 22; const contentWidth = Math.max(24, w - (contentX - x) - 10);
        const marker = kind.endsWith("time-event")
          ? `<circle cx="${cx}" cy="${cy}" r="${radius - 5}" fill="none" stroke="${ink}"/><path d="M ${cx} ${cy - 7} V ${cy} L ${cx + 6} ${cy + 4}" stroke="${ink}"/>`
          : `<path d="M ${cx - 10} ${cy} Q ${cx - 5} ${cy - 9} ${cx} ${cy} Q ${cx + 5} ${cy + 9} ${cx + 10} ${cy}" fill="none" stroke="${ink}"/>`;
        return `<ellipse cx="${cx}" cy="${cy}" rx="${radius}" ry="${radius}" fill="${cleanFill}" stroke="${ink}" stroke-width="1.5"/>${marker}${t(kind.endsWith("time-event") ? "«time event»" : "«change event»", contentX, y + 15, contentWidth, 9, "start", 600)}${t(rawTitle, contentX, y + 34, contentWidth, Math.min(size, 14), "start", 650)}${rows(["trigger", "expression", "transition", "scope"], y + 52, y + h - 3, contentX, contentWidth)}`;
      }
      if (kind === "proposal-systems-action-pin" || kind === "proposal-systems-object-node") {
        const pin = kind.endsWith("action-pin"); const direction = field("direction").toLowerCase(); const output = direction.startsWith("out");
        const tabX = output ? x + w - 2 : x - 6;
        const connectorTab = pin ? `<path d="M ${tabX} ${y + h / 2 - 8} h 8 v 16 h -8" fill="${cleanFill}" stroke="${ink}"/>` : "";
        return `${r(x, y, w, h, cleanFill, pin ? 5 : 14)}${connectorTab}${t(pin ? "«pin»" : "«object»", x + 9, y + 14, w - 18, 9, "start", 600)}${t(field(pin ? "pin-name" : "object") || rawTitle, x + w / 2, y + h * .43, w - 22, Math.min(size, 14), "middle", 600)}${rows(pin ? ["type", "direction", "multiplicity"] : ["state", "direction", "pins"], y + h * .62, y + h - 4)}`;
      }
      if (kind === "proposal-systems-send-signal-action" || kind === "proposal-systems-accept-signal-action") {
        const signalAction = kind.endsWith("send-signal-action") ? "sendSignal" : "acceptEvent";
        return `${r(x, y, w, h, cleanFill, 9)}${t(signalAction, x + 10, y + 22, w - 20, Math.min(13, size), "start", 650)}${t(rawTitle, x + 10, y + 42, w - 20, Math.min(13, size), "start", 600)}${p(`M ${x} ${y + 53} H ${x + w}`)}${rows(["signal", "payload", "source-target", "guard"], y + 54, y + h)}`;
      }
      if (kind === "proposal-systems-provided-interface" || kind === "proposal-systems-required-interface") {
        const cx = x + w * .16; const cy = y + h / 2; const radius = Math.max(10, Math.min(18, h * .16, w * .08));
        const glyph = kind.endsWith("provided-interface")
          ? `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${cleanFill === "none" ? "none" : cleanFill}" stroke="${ink}"/>`
          : `<path d="M ${cx + radius * .18} ${cy - radius * .76} A ${radius} ${radius} 0 0 0 ${cx + radius * .18} ${cy + radius * .76} M ${cx + radius * .18} ${cy - radius * .76} V ${cy + radius * .76}" fill="none" stroke="${ink}"/>`;
        return `${p(`M ${x} ${cy} H ${cx - radius}`)}${glyph}${t(kind.endsWith("provided-interface") ? "«provided»" : "«required»", x + w * .34, cy - 18, w * .62, 9, "start", 600)}${t(field("interface") || rawTitle, x + w * .34, cy + 1, w * .62, Math.min(14, size), "start", 650)}${t(field("operations") || field("protocol"), x + w * .34, cy + 23, w * .62, 10, "start", 400)}`;
      }
      if (kind === "proposal-systems-uml-combined-fragment") {
        const tabWidth = Math.min(82, w * .38); const tabHeight = Math.min(30, h * .22);
        return `${r(x, y, w, h, cleanFill)}<path d="M ${x} ${y + tabHeight} V ${y + 1} H ${x + tabWidth} L ${x + tabWidth + 13} ${y + tabHeight} Z" fill="${soft}" stroke="${ink}"/>${t(field("operator") || "alt", x + 8, y + tabHeight * .64, tabWidth - 10, 10, "start", 700)}${t(field("guard") || rawTitle, x + tabWidth + 15, y + tabHeight + 16, w - tabWidth - 22, Math.min(13, size), "start", 600)}${rows(["operands", "lifelines"], y + tabHeight + 28, y + h)}`;
      }
      if (kind === "proposal-systems-constraint-block" || kind === "proposal-systems-parametric-constraint") return `${r(x, y, w, h, cleanFill, 2)}${t("«constraint»", x + 10, y + 14, w - 20, 9, "start", 600)}${t(rawTitle, x + 10, y + 33, w - 20, Math.min(13, size), "start", 650)}${p(`M ${x} ${y + 43} H ${x + w}`)}${t(field("expression"), x + w / 2, y + h * .62, w - 24, Math.min(15, size), "middle", 500)}${rows(["inputs", "outputs", "variables", "units", "assumptions", "source"], y + h * .72, y + h)}`;
      if (kind === "proposal-systems-interface-block" || /proposal-systems-(?:full-port|proxy-port|uml-port)$/.test(kind)) {
        const port = /port$/.test(kind); const portName = kind.endsWith("full-port") ? "full port" : kind.endsWith("proxy-port") ? "proxy port" : "port";
        const portGlyph = port ? `<rect x="${x + w - 7}" y="${y + h / 2 - 5}" width="10" height="10" fill="${cleanFill}" stroke="${ink}"/>` : "";
        return `${r(x, y, w, h, cleanFill, 2)}${t(port ? `«${portName}»` : "«interface block»", x + 10, y + 14, w - 28, 9, "start", 600)}${t(field(port ? "port-name" : "interface-name") || rawTitle, x + 10, y + 35, w - 22, Math.min(14, size), "start", 650)}${portGlyph}${p(`M ${x} ${y + 46} H ${x + w}`)}${rows(port ? ["direction", "interface", "delegation"] : ["provided", "required", "protocol"], y + 47, y + h)}`;
      }
      if (kind === "proposal-systems-protocol-state") return `${r(x, y, w, h, cleanFill, 18)}${t(field("state") || rawTitle, x + w / 2, y + 25, w - 24, Math.min(15, size), "middle", 650)}${p(`M ${x + 10} ${y + 39} H ${x + w - 10}`)}${rows(["entry-exit", "allowed-transitions", "protocol"], y + 40, y + h - 2, x + 12, w - 24)}`;
      const propertyKind = kind.endsWith("part-property") ? "part" : kind.endsWith("reference-property") ? "reference" : kind.endsWith("value-property") ? "value" : kind.endsWith("value-type") ? "value type" : kind.endsWith("requirement-stakeholder") ? "requirement stakeholder" : kind.endsWith("requirement-test-case") ? "test case" : kind.endsWith("requirement-risk") ? "requirement risk" : "element";
      const keys = kind.endsWith("part-property") ? ["part-name", "type", "owner", "constraint"]
        : kind.endsWith("reference-property") ? ["reference-name", "type", "target", "role"]
          : kind.endsWith("value-property") ? ["value-name", "type", "value", "range"]
            : kind.endsWith("value-type") ? ["type-name", "base-type", "unit", "constraint"]
              : kind.endsWith("requirement-stakeholder") ? ["stakeholder", "need", "priority", "trace"]
                : kind.endsWith("requirement-test-case") ? ["test-id", "preconditions", "procedure", "expected"]
                  : kind.endsWith("requirement-risk") ? ["risk", "likelihood", "impact", "mitigation"]
                    : ["element", "specification", "properties", "trace"];
      return `${r(x, y, w, h, cleanFill)}${t(`«${propertyKind}»`, x + 10, y + 14, w - 20, 9, "start", 600)}${t(rawTitle, x + 10, y + 34, w - 20, Math.min(14, size), "start", 650)}${p(`M ${x} ${y + 44} H ${x + w}`)}${rows(keys, y + 45, y + h)}`;
    }
    if (proposal?.section.startsWith("Decision modelling") && proposal.archetype !== "connector") {
      const decisionFields = meta.componentFields ?? [];
      const compactLabel: Record<string, string> = { "event-definition": "Definition", behavior: "Behavior", flow: "Flow", "outputs-policy": "Policy", "source-target": "Participants", "associated-work": "Activity" };
      const fieldRows = (keys: string[], top: number, bottom: number, left = x + 10, width = w - 20) => block(
        keys.map(key => [compactLabel[key] ?? decisionFields.find(item => item.key === key)?.label ?? key.replace(/-/g, " "), field(key)] as [string, string]).filter(([, value]) => !!value),
        left, top, width, Math.min(10, size * .68), Math.max(0, bottom - top),
      );
      if (/proposal-decision-(?:conditional|escalation|compensation|link|multiple|parallel-multiple|cancel)-event$/.test(kind)) {
        const radius = Math.max(18, Math.min(29, h * .22, w * .12)); const cx = x + radius + 12; const cy = y + h / 2;
        const nonInterrupting = field("behavior").toLowerCase().includes("non-interrupt");
        const ring = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${cleanFill}" stroke="${ink}" stroke-width="${nonInterrupting ? 1.5 : 2.4}"${nonInterrupting ? ' stroke-dasharray="4 3"' : ""}/>`;
        const symbol = kind.endsWith("conditional-event") ? `<path d="M ${cx - 7} ${cy - 8} h14 v11 l-7 6-7-6 Z M ${cx - 4} ${cy - 3} h8 M ${cx - 4} ${cy + 1} h8" fill="none" stroke="${ink}"/>`
          : kind.endsWith("escalation-event") ? `<path d="M ${cx} ${cy + 8} V ${cy - 8} l-6 6 m6-6 6 6" fill="none" stroke="${ink}"/>`
            : kind.endsWith("compensation-event") ? `<path d="M ${cx - 8} ${cy} l7-6 v12 Z m3-6 7-6 v12 Z" fill="none" stroke="${ink}"/>`
              : kind.endsWith("link-event") ? `<path d="M ${cx - 7} ${cy - 2} a5 5 0 0 1 8-4 m4 8 a5 5 0 0 1-8 4" fill="none" stroke="${ink}"/>`
                : kind.endsWith("parallel-multiple-event") ? `<path d="M ${cx} ${cy - 8} v16 m-8-8 h16 m-14-6 12 12 m0-12-12 12" fill="none" stroke="${ink}"/>`
                  : kind.endsWith("multiple-event") ? `<path d="M ${cx} ${cy - 8} l2 6 6 2-6 2-2 6-2-6-6-2 6-2 Z" fill="${ink}"/>`
                    : `<path d="M ${cx - 7} ${cy - 7} l14 14 m0-14-14 14" stroke="${ink}"/>`;
        const contentX = x + radius * 2 + 22; const contentWidth = Math.max(24, w - (contentX - x) - 10);
        return `${ring}${symbol}${t("BPMN event", contentX, y + 15, contentWidth, 9, "start", 600)}${t(rawTitle, contentX, y + 34, contentWidth, Math.min(size, 14), "start", 650)}${fieldRows(["trigger", "event-definition", "behavior", "flow"], y + 50, y + h - 3, contentX, contentWidth)}`;
      }
      if (/proposal-decision-(?:event-subprocess|transaction-subprocess|ad-hoc-subprocess)$/.test(kind)) {
        const dash = kind.endsWith("event-subprocess") ? ' stroke-dasharray="2 3"' : kind.endsWith("ad-hoc-subprocess") ? ' stroke-dasharray="7 4"' : "";
        const inner = kind.endsWith("transaction-subprocess") ? r(x + 5, y + 5, w - 10, h - 10, "none", 1) : "";
        const marker = kind.endsWith("ad-hoc-subprocess") ? t("~", x + w - 16, y + h - 8, 12, 13, "middle", 700) : kind.endsWith("event-subprocess") ? t("O", x + w - 16, y + h - 8, 12, 11, "middle", 700) : "";
        return `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" fill="${cleanFill}" stroke="${ink}"${dash}/>${inner}${t(rawTitle, x + 10, y + 20, w - 20, Math.min(14, size), "start", 650)}${p(`M ${x} ${y + 39} H ${x + w}`)}${fieldRows(["purpose", "participants", "completion", "messages"], y + 42, y + h - 3)}${marker}`;
      }
      if (kind.endsWith("choreography-task") || kind.endsWith("call-choreography")) {
        const band = Math.min(24, h * .18); const participants = field("participants").split(/[\r\n,]+/).map(item => item.trim()).filter(Boolean);
        const border = kind.endsWith("call-choreography") ? 2.5 : 1.3;
        const participantBands = `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${band}" fill="${soft}"/><rect x="${x + 2}" y="${y + h - band - 2}" width="${w - 4}" height="${band}" fill="${soft}"/><path d="M ${x} ${y + band + 2} H ${x + w} M ${x} ${y + h - band - 2} H ${x + w}" stroke="${ink}"/>`;
        return `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="3" fill="${cleanFill}" stroke="${ink}" stroke-width="${border}"/>${participantBands}${t(participants[0] ?? "Participant", x + 9, y + band / 2 + 2, w - 18, 9, "start", 600)}${t(participants[1] ?? "Participant", x + 9, y + h - band / 2 - 2, w - 18, 9, "start", 600)}${t(rawTitle, x + w / 2, y + band + 14, w - 20, Math.min(size, 13), "middle", 650)}${fieldRows(["purpose", "completion", "messages"], y + band + 23, y + h - band - 3, x + 8, w - 16)}`;
      }
      if (kind.endsWith("conversation-node")) {
        return `<path d="M ${x + 18} ${y + 1} H ${x + w - 18} L ${x + w - 1} ${y + h / 2} L ${x + w - 18} ${y + h - 1} H ${x + 18} L ${x + 1} ${y + h / 2} Z" fill="${cleanFill}" stroke="${ink}"/>${t("Conversation", x + w / 2, y + 16, w - 36, 9, "middle", 600)}${t(rawTitle, x + w / 2, y + 34, w - 36, Math.min(size, 13), "middle", 650)}${fieldRows(["purpose", "participants", "completion", "messages"], y + 45, y + h - 3, x + 18, w - 36)}`;
      }
      if (kind.endsWith("bpmn-message")) {
        const iconX = x + 15; const iconY = y + 14; const iconW = Math.min(45, w * .2); const iconH = 28;
        return `${r(x, y, w, h, cleanFill, 2)}<rect x="${iconX}" y="${iconY}" width="${iconW}" height="${iconH}" fill="none" stroke="${ink}"/><path d="M ${iconX} ${iconY} l${iconW / 2} ${iconH * .56} ${iconW / 2}-${iconH * .56}" fill="none" stroke="${ink}"/>${t("Message", x + 15 + iconW + 10, y + 18, w - iconW - 35, 9, "start", 600)}${t(rawTitle, x + 15 + iconW + 10, y + 36, w - iconW - 35, Math.min(size, 13), "start", 650)}${fieldRows(["message-name", "payload", "correlation", "source-target"], y + 51, y + h - 3, x + 15 + iconW + 10, w - iconW - 35)}`;
      }
      if (/proposal-decision-data-(?:input|output)$/.test(kind)) {
        const fold = Math.min(18, w * .13); const path = `M ${x + 1} ${y + 1} H ${x + w - fold} L ${x + w - 1} ${y + fold} V ${y + h - 1} H ${x + 1} Z M ${x + w - fold} ${y + 1} V ${y + fold} H ${x + w - 1}`;
        return `<path d="${path}" fill="${cleanFill}" stroke="${ink}"/>${t(kind.endsWith("data-input") ? "Data input" : "Data output", x + 10, y + 17, w - 24, 9, "start", 600)}${t(rawTitle, x + 10, y + 35, w - 24, Math.min(size, 13), "start", 650)}${p(`M ${x} ${y + 44} H ${x + w}`)}${fieldRows(["data-name", "structure", "direction", "associated-work"], y + 47, y + h - 3)}`;
      }
      if (kind.endsWith("data-collection")) {
        const cy = y + 14; const ry = 9;
        return `<ellipse cx="${x + w / 2}" cy="${cy}" rx="${w * .48}" ry="${ry}" fill="${soft}" stroke="${ink}"/><path d="M ${x + 2} ${cy} V ${y + h - 14} M ${x + w - 2} ${cy} V ${y + h - 14} M ${x + w / 2 - w * .48} ${y + h - 14} A ${w * .48} ${ry} 0 0 0 ${x + w / 2 + w * .48} ${y + h - 14}" fill="none" stroke="${ink}"/>${t(rawTitle, x + w / 2, y + 34, w - 24, Math.min(size, 13), "middle", 650)}${fieldRows(["data-name", "structure", "direction", "associated-work"], y + 49, y + h - 15)}`;
      }
      if (kind.endsWith("dmn-decision-table")) {
        const inputNames = field("inputs").split(/\r?\n/).map(item => item.trim()).filter(Boolean).slice(0, 3).map(item => item.split(/[:(]/)[0].trim());
        const outputSpec = field("outputs-policy"); const outputName = outputSpec.replace(/hit\s*policy\s*[:=].*$/im, "").replace(/^\s*outputs?\s*[:=]\s*/i, "").trim() || "Output";
        const headers = [...inputNames, outputName]; const dataRows = field("rules").split(/\r?\n/).map(line => line.split("|").map(cell => cell.trim())).filter(row => row.some(Boolean)).slice(0, 4);
        const top = y + 37; const rowHeight = Math.max(14, (h - 57) / Math.max(2, dataRows.length + 1)); const colWidth = w / headers.length;
        const grid = Array.from({ length: headers.length + 1 }, (_, col) => `<path d="M ${x + col * colWidth} ${top} V ${top + rowHeight * (dataRows.length + 1)}" stroke="${ink}"/>`).join("") + Array.from({ length: dataRows.length + 2 }, (_, row) => `<path d="M ${x} ${top + row * rowHeight} H ${x + w}" stroke="${ink}"/>`).join("");
        const headerText = headers.map((header, col) => t(header, x + col * colWidth + colWidth / 2, top + rowHeight / 2, colWidth - 5, 8, "middle", 650)).join("");
        const bodyText = dataRows.flatMap((row, rowIndex) => headers.map((_, col) => t(row[col] ?? "-", x + col * colWidth + colWidth / 2, top + rowHeight * (rowIndex + 1.5), colWidth - 5, 8, "middle", 400))).join("");
        const policy = outputSpec.match(/(?:hit\s*policy\s*[:=]\s*)?(unique|first|any|collect|rule\s*order|output\s*order|priority|any\s*order)/i)?.[1] ?? "FIRST";
        return `${r(x, y, w, h, cleanFill, 2)}${t(field("question") || rawTitle, x + 10, y + 16, w - 20, Math.min(size, 12), "start", 650)}<rect x="${x}" y="${top}" width="${w}" height="${rowHeight}" fill="${soft}"/>${grid}${headerText}${bodyText}${t(`Hit policy: ${policy.toUpperCase()}`, x + 9, y + h - 6, w - 18, 8, "start", 600)}`;
      }
      if (kind.endsWith("dmn-decision") || kind.endsWith("dmn-decision-service")) {
        const service = kind.endsWith("dmn-decision-service"); const keys = service ? ["service", "inputs", "decisions", "outputs"] : ["question", "inputs", "logic", "result"];
        return `${r(x, y, w, h, cleanFill, 6)}${t(service ? "DMN decision service" : "DMN decision", x + 10, y + 14, w - 20, 9, "start", 600)}${t(rawTitle, x + 10, y + 32, w - 20, Math.min(size, 13), "start", 650)}${p(`M ${x} ${y + 42} H ${x + w}`)}${fieldRows(keys, y + 44, y + h - 3)}`;
      }
      if (kind.endsWith("dmn-input-data") || kind.endsWith("dmn-knowledge-source") || kind.endsWith("business-knowledge-model")) {
        const knowledge = !kind.endsWith("dmn-input-data");
        const shape = knowledge ? `<path d="M ${x + 20} ${y + 1} H ${x + w - 1} L ${x + w - 20} ${y + h - 1} H ${x + 1} Z" fill="${cleanFill}" stroke="${ink}"/>` : r(x, y, w, h, cleanFill);
        const stereotype = kind.endsWith("business-knowledge-model") ? "Business knowledge model" : knowledge ? "Knowledge source" : "Input data";
        const keys = kind.endsWith("dmn-input-data") ? ["variable", "source", "constraints", "consumers"] : ["source", "owner", "authority", "decisions"];
        return `${shape}${t(stereotype, x + 10, y + 17, w - 20, 9, "start", 600)}${t(rawTitle, x + 10, y + 35, w - 20, Math.min(size, 13), "start", 650)}${p(`M ${x} ${y + 44} H ${x + w}`)}${fieldRows(keys, y + 47, y + h - 3)}`;
      }
      if (kind.endsWith("dmn-context-expression")) {
        const entries = field("entries").split(/\r?\n/).filter(Boolean).slice(0, 3);
        const details = [...entries.map((entry, index) => [`Entry ${index + 1}`, entry] as [string, string]), ["Result", field("result")] as [string, string], ["Type", field("type")] as [string, string]].filter(([, value]) => !!value);
        return `${r(x, y, w, h, cleanFill, 3)}${t("Context expression", x + 10, y + 14, w - 20, 9, "start", 600)}${t(field("context") || rawTitle, x + 10, y + 32, w - 20, Math.min(size, 13), "start", 650)}${p(`M ${x} ${y + 42} H ${x + w}`)}${block(details, x + 10, y + 44, w - 20, Math.min(10, size * .65), h - 47)}`;
      }
      const keys = decisionFields.map(item => item.key);
      return `${r(x, y, w, h, cleanFill, proposal.archetype === "boundary" ? 1 : 5)}${t(rawTitle, x + 10, y + 20, w - 20, Math.min(size, 14), "start", 650)}${p(`M ${x} ${y + 36} H ${x + w}`)}${fieldRows(keys, y + 39, y + h - 3)}`;
    }
    if (proposal?.section.startsWith("Data & schemas") && proposal.archetype !== "connector") {
      const dataFields = meta.componentFields ?? [];
      const dataLabel = (key: string) => dataFields.find(item => item.key === key)?.label ?? key.replace(/-/g, " ");
      const dataRows = (keys: string[], top: number, bottom: number, left = x + 9, width = w - 18) => block(
        keys.map(key => [dataLabel(key), field(key)] as [string, string]), left, top, width, Math.min(10, size * .66), Math.max(0, bottom - top),
      );
      const keys = dataFields.map(item => item.key);
      if (proposal.archetype === "database" || kind.endsWith("document-collection")) {
        const inset = Math.min(13, w * .08); const ry = Math.min(11, h * .11); const cx = x + w / 2;
        const cylinder = `<path d="M ${x + inset} ${y + ry} V ${y + h - ry} C ${x + inset} ${y + h + 1} ${x + w - inset} ${y + h + 1} ${x + w - inset} ${y + h - ry} V ${y + ry}" fill="${cleanFill}" stroke="${ink}"/><ellipse cx="${cx}" cy="${y + ry}" rx="${(w - inset * 2) / 2}" ry="${ry}" fill="${cleanFill}" stroke="${ink}"/>`;
        const contentLeft = x + inset + 7; const contentWidth = w - 2 * (inset + 7); const top = y + 44; const bottom = y + h - ry - 3; const rowHeight = (bottom - top) / Math.max(1, keys.length);
        const rowMarkup = keys.map((key, index) => {
          const rowY = top + index * rowHeight; const label = dataLabel(key); const value = field(key).replace(/\s*\n\s*/g, " | "); const detail = `${label}${value ? `: ${value}` : ""}`;
          const divider = index ? p(`M ${x + inset + 2} ${rowY} H ${x + w - inset - 2}`) : "";
          return `${divider}${t(detail, contentLeft, rowY + rowHeight / 2, contentWidth, Math.min(10, size * .62, rowHeight * .72), "start", 400)}`;
        }).join("");
        return `${cylinder}${t(rawTitle, contentLeft, y + 31, contentWidth, Math.min(size, 12))}${rowMarkup}`;
      }
      if (kind.endsWith("graph-vertex")) {
        const shape = `M ${x + w * .16} ${y + 1} H ${x + w * .84} L ${x + w - 1} ${y + h / 2} L ${x + w * .84} ${y + h - 1} H ${x + w * .16} L ${x + 1} ${y + h / 2} Z`;
        const graphInsetAt = (localY: number) => { const halfHeight = Math.max(1, h / 2); const ratio = Math.min(1, Math.max(0, Math.min(localY, h - localY) / halfHeight)); return 1 + Math.max(0, w * .16 - 1) * (1 - ratio); };
        const rowKeys = keys.filter(key => key !== "type"); const top = y + 36; const bottom = y + h - 4; const rowHeight = (bottom - top) / Math.max(1, rowKeys.length);
        const rowMarkup = rowKeys.map((key, index) => {
          const rowY = top + index * rowHeight; const inset = Math.max(graphInsetAt(rowY + 2 - y), graphInsetAt(rowY + rowHeight - 2 - y)); const left = x + inset + 7; const width = Math.max(4, w - 2 * (inset + 7));
          const value = field(key).replace(/\s*\n\s*/g, " | "); const detail = `${dataLabel(key)}${value ? `: ${value}` : ""}`;
          const divider = index ? p(`M ${x + inset + 3} ${rowY} H ${x + w - inset - 3}`) : "";
          return `${divider}${t(detail, left, rowY + rowHeight / 2, width, Math.min(9, size * .58, rowHeight * .72), "start", 400)}`;
        }).join("");
        const clipId = `graph-vertex-${String(group.id ?? kind).replace(/[^\w-]/g, "_") || "vertex"}`;
        return `<path d="${shape}" fill="${cleanFill}" stroke="${ink}"/><defs><clipPath id="${clipId}"><path d="${shape}"/></clipPath></defs><g clip-path="url(#${clipId})">${t(field("type") || rawTitle, x + w / 2, y + 19, w * .62, Math.min(size, 13), "middle", 650)}${p(`M ${x + w * .15} ${y + 32} H ${x + w * .85}`)}${rowMarkup}</g>`;
      }
      if (kind.endsWith("graph-edge-type")) return `${r(x, y, w, h, cleanFill, 5)}${t(field("type") || rawTitle, x + 10, y + 17, w - 20, Math.min(size, 12))}${p(`M ${x + 10} ${y + 31} H ${x + w - 17} l-7-6 m7 6-7 6`)}${dataRows(keys.filter(key => key !== "type"), y + 38, y + h - 3)}`;
      if (kind.endsWith("wide-column-table") || proposal.archetype === "table") {
        const headerHeight = Math.min(29, Math.max(24, h * .22)); const top = y + headerHeight + 2; const bottom = y + h - 3;
        const lines = Array.from({ length: keys.length + 1 }, (_, index) => `<path d="M ${x} ${top + (bottom - top) * index / Math.max(1, keys.length)} H ${x + w}" stroke="${ink}"/>`).join("");
        return `${r(x, y, w, h, cleanFill, 2)}<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${headerHeight}" fill="${soft}"/>${t(rawTitle, x + 9, y + 17, w - 18, Math.min(size, 12))}${lines}${dataRows(keys, top + 1, bottom, x + 8, w - 16)}`;
      }
      if (kind.endsWith("table-partition") || kind.endsWith("star-schema-boundary")) {
        const border = r(x + 1, y + 1, w - 2, h - 2, cleanFill, 1).replace("stroke-width=\"1.3\"", "stroke-width=\"1.3\" stroke-dasharray=\"6 4\"");
        if (kind.endsWith("star-schema-boundary")) {
          const cx = x + w / 2; const cy = y + 57;
          const mini = `<path d="M ${cx} ${cy} L ${x + 28} ${y + 48} M ${cx} ${cy} L ${x + w - 28} ${y + 48} M ${cx} ${cy} L ${cx} ${y + 78}" stroke="${ink}"/><rect x="${cx - 20}" y="${cy - 9}" width="40" height="18" fill="${soft}" stroke="${ink}"/><rect x="${x + 9}" y="${y + 41}" width="38" height="16" fill="${cleanFill}" stroke="${ink}"/><rect x="${x + w - 47}" y="${y + 41}" width="38" height="16" fill="${cleanFill}" stroke="${ink}"/><rect x="${cx - 19}" y="${y + 71}" width="38" height="16" fill="${cleanFill}" stroke="${ink}"/>`;
          return `${border}${t(rawTitle, x + 10, y + 17, w - 20, Math.min(size, 12))}${mini}${dataRows(keys, y + 103, y + h - 3, x + 9, w - 18)}`;
        }
        return `${border}${t(field("partition") || rawTitle, x + 10, y + 18, w - 20, Math.min(size, 12))}${p(`M ${x} ${y + 35} H ${x + w}`)}${dataRows(keys, y + 38, y + h - 3)}`;
      }
      if (kind.endsWith("data-classification-badge")) {
        const classification = field("classification").toLowerCase(); const badge = classification.includes("restrict") ? "#b34a4a" : classification.includes("confidential") ? "#bd7921" : classification.includes("internal") ? "#426da7" : "#39815c";
        return `${r(x, y, w, h, cleanFill, 12)}<rect x="${x + 9}" y="${y + 9}" width="${Math.min(w - 18, 112)}" height="24" rx="12" fill="${badge}"/>${t(field("classification") || "Classification", x + 15, y + 21, Math.min(w - 30, 100), 9, "start", 700)}${dataRows(keys.filter(key => key !== "classification"), y + 40, y + h - 3)}`;
      }
      if (kind.endsWith("data-quality-check")) {
        return `${r(x, y, w, h, cleanFill, 5)}<rect x="${x + 9}" y="${y + 10}" width="18" height="18" rx="3" fill="none" stroke="${ink}"/>${t(field("rule") || rawTitle, x + 34, y + 21, w - 44, Math.min(size, 11))}${p(`M ${x} ${y + 37} H ${x + w}`)}${dataRows(keys.filter(key => key !== "rule"), y + 40, y + h - 3)}`;
      }
      if (kind.endsWith("data-contract") || kind.endsWith("json-schema-object") || kind.endsWith("graphql-resolver") || kind.endsWith("standalone-database-column")) {
        const fold = Math.min(18, w * .12); const path = `M ${x + 1} ${y + 1} H ${x + w - fold} L ${x + w - 1} ${y + fold} V ${y + h - 1} H ${x + 1} Z M ${x + w - fold} ${y + 1} V ${y + fold} H ${x + w - 1}`;
        const top = field("contract") || field("title") || field("column") || field("parent-field") || rawTitle;
        return `<path d="${path}" fill="${cleanFill}" stroke="${ink}"/>${t(top, x + 10, y + 18, w - 24, Math.min(size, 12))}${p(`M ${x} ${y + 36} H ${x + w}`)}${dataRows(keys, y + 39, y + h - 3)}`;
      }
      if (/primary-key|foreign-key|unique-constraint|check-constraint/.test(kind)) {
        const badge = kind.includes("primary") ? "PK" : kind.includes("foreign") ? "FK" : kind.includes("unique") ? "UN" : "CK";
        return `${r(x, y, w, h, cleanFill, 4)}<rect x="${x + 9}" y="${y + 9}" width="30" height="20" rx="4" fill="${soft}" stroke="${ink}"/>${t(badge, x + 24, y + 19, 25, 9, "middle", 700)}${t(field("constraint") || rawTitle, x + 47, y + 20, w - 56, Math.min(size, 12))}${p(`M ${x} ${y + 36} H ${x + w}`)}${dataRows(keys.filter(key => key !== "constraint"), y + 39, y + h - 3)}`;
      }
      return `${r(x, y, w, h, cleanFill, 5)}${t(field("store") || field("dataset") || field("type-name") || field("index") || field("type") || rawTitle, x + 10, y + 17, w - 20, Math.min(size, 12))}${p(`M ${x} ${y + 35} H ${x + w}`)}${dataRows(keys, y + 38, y + h - 3)}`;
    }
    if (proposal?.section.startsWith("Architecture patterns")) {
      const architectureText = (value: string, left: number, top: number, width = w - 20, font = size, anchor = "start", weight = 600) =>
        t(value, componentBoxTextAnchor(left, width, anchor === "middle" ? "center" : anchor === "end" ? "right" : "left"), top, width, font, anchor, weight);
      const architectureFields = meta.componentFields ?? [];
      const keys = architectureFields.map(item => item.key);
      const rows = (rowKeys = keys, top = y + 45, bottom = y + h - 3, left = x + 10, width = w - 20) => block(
        rowKeys.map(key => [architectureFields.find(item => item.key === key)?.label ?? key.replace(/-/g, " "), field(key)] as [string, string]),
        left, top, width, Math.min(10, size * .66), Math.max(0, bottom - top),
      );
      const panel = (radius = 6, dash = "") => `${r(x, y, w, h, cleanFill, radius).replace("stroke-width=\"1.3\"", `stroke-width=\"1.3\"${dash ? ` stroke-dasharray=\"${dash}\"` : ""}`)}`;
      const separator = (atY: number, left = x, right = x + w) => p(`M ${left} ${atY} H ${right}`);
      if (["proposal-architecture-web-frontend", "proposal-architecture-mobile-client"].includes(kind)) {
        const band = Math.min(27, h * .2);
        return `${panel(8)}<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${band}" fill="${soft}"/>${architectureText("●  ●  ●", x + 10, y + band / 2 + 1, 50, 7)}${architectureText(field("application") || rawTitle, x + 10, y + band + 16, w - 20, Math.min(size, 13))}${separator(y + band + 22)}${rows(keys.filter(key => key !== "application"), y + band + 26)}`;
      }
      if (/api-operation|graphql-endpoint|grpc-service|webhook-endpoint/.test(kind)) {
        const badge = kind.endsWith("api-operation") ? field("method-path").split(/\s+/)[0] || "HTTP" : kind.endsWith("graphql-endpoint") ? "GRAPHQL" : kind.endsWith("grpc-service") ? "gRPC" : "WEBHOOK";
        return `${panel(5)}${r(x + 9, y + 8, Math.min(w * .36, 68), 21, soft, 4)}${architectureText(badge.toUpperCase(), x + 11, y + 19, Math.min(w * .36, 64), 8, "middle", 700)}${architectureText(rawTitle, x + Math.min(w * .36, 68) + 17, y + 20, w - Math.min(w * .36, 68) - 25, Math.min(size, 12), "start", 650)}${separator(y + 36)}${rows(keys, y + 39)}`;
      }
      if (/background-worker|batch-job|scheduler/.test(kind)) {
        const cx = x + 23; const cy = y + 24;
        return `${panel(6)}<circle cx="${cx}" cy="${cy}" r="12" fill="none" stroke="${ink}"/>${p(`M ${cx - 7} ${cy} H ${cx + 6} l-4-4 m4 4-4 4`)}${architectureText(rawTitle, x + 43, y + 21, w - 53, Math.min(size, 13))}${separator(y + 39)}${rows(keys, y + 42)}`;
      }
      if (/event-producer|event-consumer|event-topic|stream-partition/.test(kind)) {
        const partition = kind.endsWith("stream-partition"); const publish = kind.endsWith("event-producer"); const subscribe = kind.endsWith("event-consumer");
        const top = partition ? y + 56 : y + 42;
        const lanes = partition ? `<rect x="${x + 10}" y="${y + 39}" width="${w - 20}" height="13" fill="${soft}" stroke="${ink}"/>${architectureText("0             1             2             3", x + 13, y + 46, w - 26, 7)}` : `${r(x + 9, y + 9, 34, 22, soft, 4)}${architectureText(publish ? "PUB" : subscribe ? "SUB" : "BUS", x + 10, y + 20, 32, 8, "middle", 700)}`;
        const first = field(partition ? "partition" : publish ? "producer" : subscribe ? "consumer" : "topic") || rawTitle;
        return `${panel(partition ? 2 : 8, partition ? "6 4" : "")}${lanes}${architectureText(first, x + (partition ? 10 : 50), partition ? y + 19 : y + 21, w - (partition ? 20 : 60), Math.min(size, 13), "start", 650)}${separator(top - 4)}${rows(keys.filter(key => key !== (partition ? "partition" : publish ? "producer" : subscribe ? "consumer" : "topic")), top)}`;
      }
      if (/saga-orchestrator|saga-participant/.test(kind)) {
        const lead = kind.endsWith("saga-orchestrator") ? "saga" : "participant"; const first = field(lead) || rawTitle;
        const steps = `<rect x="${x + 10}" y="${y + 37}" width="${(w - 40) / 3}" height="16" rx="3" fill="${soft}" stroke="${ink}"/><rect x="${x + w / 2 - (w - 40) / 6}" y="${y + 37}" width="${(w - 40) / 3}" height="16" rx="3" fill="${soft}" stroke="${ink}"/><rect x="${x + w - 10 - (w - 40) / 3}" y="${y + 37}" width="${(w - 40) / 3}" height="16" rx="3" fill="${soft}" stroke="${ink}"/>${architectureText("Step", x + 10, y + 45, (w - 40) / 3, 7, "middle")}${architectureText("Commit", x + w / 2 - (w - 40) / 6, y + 45, (w - 40) / 3, 7, "middle")}${architectureText("Compensate", x + w - 10 - (w - 40) / 3, y + 45, (w - 40) / 3, 7, "middle")}`;
        return `${panel(5)}${architectureText(first, x + 10, y + 20, w - 20, Math.min(size, 13), "start", 650)}${steps}${separator(y + 60)}${rows(keys.filter(key => key !== lead), y + 63)}`;
      }
      if (kind.endsWith("transactional-outbox") || kind.endsWith("change-data-capture")) {
        const labels = kind.endsWith("transactional-outbox") ? ["DB", "BUS"] : ["LOG", "SINK"];
        return `${panel(5)}${architectureText(rawTitle, x + 10, y + 18, w - 20, Math.min(size, 13))}${r(x + 10, y + 29, 37, 23, soft, 3)}${architectureText(labels[0], x + 11, y + 41, 35, 8, "middle", 700)}${p(`M ${x + 49} ${y + 40} H ${x + w - 49} l-6-4 m6 4-6 4`)}${r(x + w - 47, y + 29, 37, 23, soft, 3)}${architectureText(labels[1], x + w - 46, y + 41, 35, 8, "middle", 700)}${separator(y + 62)}${rows(keys, y + 65)}`;
      }
      if (kind.endsWith("service-mesh-sidecar")) {
        const cardWidth = (w - 32) / 2; const top = y + 32;
        return `${panel(6)}${architectureText(rawTitle, x + 10, y + 18, w - 20, Math.min(size, 13))}${r(x + 10, top, cardWidth, 24, soft, 3)}${architectureText("Workload", x + 12, top + 13, cardWidth - 4, 8, "middle", 600)}${r(x + 22 + cardWidth, top, cardWidth, 24, soft, 3)}${architectureText("Sidecar proxy", x + 24 + cardWidth, top + 13, cardWidth - 4, 8, "middle", 600)}${p(`M ${x + 10 + cardWidth} ${top + 12} H ${x + 22 + cardWidth}`)}${separator(y + 62)}${rows(keys, y + 65)}`;
      }
      if (kind.endsWith("circuit-breaker")) {
        const cellWidth = (w - 26) / 3; const atY = y + 31;
        const states = ["Closed", "Open", "Half-open"].map((label, index) => `${r(x + 10 + index * cellWidth, atY, cellWidth - 4, 18, soft, 4)}${architectureText(label, x + 11 + index * cellWidth, atY + 10, cellWidth - 6, 7, "middle", 600)}`).join("");
        return `${panel(6)}${architectureText(rawTitle, x + 10, y + 17, w - 20, Math.min(size, 13), "start", 650)}${states}${separator(y + 55)}${rows(keys, y + 58)}`;
      }
      if (kind.endsWith("adapter") || kind.endsWith("backend-for-frontend")) {
        const adapter = kind.endsWith("adapter"); const leftLabel = adapter ? "Source" : "Client"; const centerLabel = adapter ? "Map" : "BFF"; const rightLabel = adapter ? "Target" : "APIs";
        const mid = y + 34; const boxWidth = adapter ? (w - 40) / 2 : 48; const leftX = x + 10; const centerX = x + w / 2 - (adapter ? 13 : 25); const rightX = x + w - boxWidth - 10;
        const flow = `${r(leftX, mid, boxWidth, 20, soft, 3)}${architectureText(leftLabel, leftX + 1, mid + 11, boxWidth - 2, 8, "middle", 600)}${r(centerX, mid, adapter ? 26 : 50, 20, soft, 3)}${architectureText(centerLabel, centerX + 1, mid + 11, (adapter ? 26 : 50) - 2, 8, "middle", 700)}${r(rightX, mid, boxWidth, 20, soft, 3)}${architectureText(rightLabel, rightX + 1, mid + 11, boxWidth - 2, 8, "middle", 600)}${p(`M ${leftX + boxWidth} ${mid + 10} H ${centerX}`)}${p(`M ${centerX + (adapter ? 26 : 50)} ${mid + 10} H ${rightX}`)}`;
        return `${panel(6)}${architectureText(rawTitle, x + 10, y + 18, w - 20, Math.min(size, 13))}${flow}${separator(y + 62)}${rows(keys, y + 65)}`;
      }
      if (kind.endsWith("bounded-context") || kind.endsWith("aggregate-root")) {
        const aggregate = kind.endsWith("aggregate-root"); const lead = aggregate ? "root" : "context"; const border = panel(aggregate ? 4 : 2, "6 4");
        const title = field(lead) || rawTitle; const inner = aggregate ? `${r(x + 12, y + 31, w - 24, 23, soft, 3)}${architectureText("Aggregate root", x + 14, y + 43, w - 28, 8, "middle", 700)}` : architectureText("BOUNDARY / UBIQUITOUS LANGUAGE", x + 10, y + 36, w - 20, 7, "start", 600);
        const top = aggregate ? y + 63 : y + 49;
        return `${border}${architectureText(title, x + 10, y + 19, w - 20, Math.min(size, 13), "start", 650)}${inner}${separator(top - 3)}${rows(keys.filter(key => key !== lead), top)}`;
      }
      if (kind.endsWith("domain-entity") || kind.endsWith("value-object") || kind.endsWith("domain-event") || kind.endsWith("application-component") || kind.endsWith("application-service") || kind.endsWith("business-actor") || kind.endsWith("business-role") || kind.endsWith("business-process") || kind.endsWith("data-object") || kind.endsWith("technology-node")) {
        const lead = kind.endsWith("domain-entity") ? "entity" : kind.endsWith("value-object") ? "value" : kind.endsWith("domain-event") ? "event" : kind.endsWith("application-component") ? "component" : kind.endsWith("application-service") ? "service" : kind.endsWith("business-actor") ? "actor" : kind.endsWith("business-role") ? "role" : kind.endsWith("business-process") ? "process" : kind.endsWith("data-object") ? "object" : "node";
        const data = kind.endsWith("data-object"); const technology = kind.endsWith("technology-node"); const process = kind.endsWith("business-process");
        const shell = technology ? `<path d="M ${x + 13} ${y + 12} L ${x + w / 2} ${y + 1} L ${x + w - 13} ${y + 12} V ${y + h - 10} L ${x + w / 2} ${y + h - 1} L ${x + 13} ${y + h - 10} Z M ${x + 13} ${y + 12} L ${x + w / 2} ${y + 23} L ${x + w - 13} ${y + 12} M ${x + w / 2} ${y + 23} V ${y + h - 1}" fill="${cleanFill}" stroke="${ink}"/>` : data ? `<path d="M ${x + 1} ${y + 1} H ${x + w - 19} L ${x + w - 1} ${y + 19} V ${y + h - 1} H ${x + 1} Z M ${x + w - 19} ${y + 1} V ${y + 19} H ${x + w - 1}" fill="${cleanFill}" stroke="${ink}"/>` : panel(kind.endsWith("domain-event") ? 6 : kind.endsWith("value-object") ? 16 : 4);
        const actor = kind.endsWith("business-actor"); const role = kind.endsWith("business-role"); const application = kind.endsWith("application-component"); const service = kind.endsWith("application-service"); const valueObject = kind.endsWith("value-object");
        const top = process ? y + 62 : kind.endsWith("domain-event") ? y + 67 : actor ? y + 51 : service ? y + 47 : data ? y + 39 : y + 39;
        const middle = process ? `${["Trigger", "Work", "Result"].map((label, index) => `${r(x + 10 + index * (w - 26) / 3, y + 37, (w - 34) / 3, 16, soft, 3)}${architectureText(label, x + 11 + index * (w - 26) / 3, y + 45, (w - 36) / 3, 7, "middle", 600)}`).join("")}`
          : actor ? `<circle cx="${x + 26}" cy="${y + 30}" r="4" fill="none" stroke="${ink}"/><path d="M ${x + 26} ${y + 34} V ${y + 41} M ${x + 18} ${y + 38} H ${x + 34} M ${x + 26} ${y + 41} L ${x + 20} ${y + 48} M ${x + 26} ${y + 41} L ${x + 32} ${y + 48}" stroke="${ink}"/>`
            : kind.endsWith("domain-event") ? p(`M ${x + 10} ${y + 31} H ${x + w - 10} V ${y + 46} L ${x + w / 2} ${y + 60} L ${x + 10} ${y + 46} Z`)
              : application ? `${r(x + 7, y + 12, 15, 9, soft, 1)}${r(x + 7, y + 25, 15, 9, soft, 1)}`
                : service ? p(`M ${x + 11} ${y + 29} V ${y + 42} H ${x + 18} M ${x + 11} ${y + 29} H ${x + 18}`)
                  : role ? `${r(x + 10, y + 9, 24, 24, soft, 12)}${architectureText("R", x + 11, y + 21, 22, 10, "middle", 700)}`
                    : valueObject ? `${r(x + 10, y + 8, 28, 19, soft, 9)}${architectureText("IMM", x + 11, y + 17, 26, 7, "middle", 700)}` : "";
        const headingX = actor || role || application || valueObject ? x + (actor ? 43 : role ? 42 : application ? 29 : 45) : x + 10;
        const headingWidth = w - (headingX - x) - 10;
        const entityTitleWidth = kind.endsWith("domain-entity") ? w - 82 : headingWidth;
        return `${shell}${architectureText(field(lead) || rawTitle, headingX, y + 19, entityTitleWidth, Math.min(size, 13), "start", 650)}${kind.endsWith("domain-entity") ? architectureText(`ID: ${field("entity") || "identity"}`, x + w - 65, y + 19, 55, 8, "end", 600) : ""}${middle}${separator(top - 3)}${rows(keys.filter(key => key !== lead), top)}`;
      }
      return `${panel(proposal.archetype === "boundary" ? 2 : 6, proposal.archetype === "boundary" ? "6 4" : "")}${architectureText(rawTitle, x + 10, y + 20, w - 20, Math.min(size, 13), "start", 650)}${separator(y + 36)}${rows(keys, y + 39)}`;
    }
    const neutralCloud = cloudNeutralComponent(kind);
    if (neutralCloud) {
      const iconSide = Math.min(25, Math.max(14, h - 20), Math.max(14, w * .22));
      const iconX = x + 11; const iconY = y + Math.min(11, (h - iconSide) / 2);
      const copyX = iconX + iconSide + 8; const copyWidth = Math.max(8, w - (copyX - x) - 7);
      const path = cloudNeutralIconPath(kind);
      const icon = path ? `<path d="${path}" fill="${neutralCloud.accent}" transform="translate(${iconX} ${iconY}) scale(${iconSide / 24})"/>` : "";
      const details = h > 76 ? (meta.componentFields ?? []).filter(item => item.value.trim()).slice(0, Math.min(2, Math.floor((h - 65) / 13))) : [];
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${cleanFill}" stroke="#bdc8d0"/><path d="M ${x + 1.5} ${y + 5} V ${y + h - 5}" stroke="${neutralCloud.accent}" stroke-width="3"/>${icon}${t(rawTitle, copyX, y + Math.min(23, h * .39), copyWidth, Math.min(size, 12))}<text x="${copyX}" y="${y + Math.min(41, h * .68)}" dominant-baseline="middle" fill="${neutralCloud.accent}" font-family="sans-serif" font-size="7" font-weight="600">${xmlText(neutralCloud.category)}</text>${details.map((item, index) => t(`${item.label}: ${item.value}`, x + 10, y + 68 + index * 13, w - 20, 7, "start", 400)).join("")}`;
    }
    if (kind === "db-view") {
      const fold = Math.min(22, w * .14); const sources = field("sources"); const query = field("query"); const refresh = field("refresh");
      return `${p(`M ${x} ${y} H ${x + w - fold} L ${x + w} ${y + fold} V ${y + h} H ${x} Z M ${x + w - fold} ${y} V ${y + fold} H ${x + w}`)}${t(rawTitle.toUpperCase(), x + 10, y + 18, w - 30, Math.min(size, 12))}${p(`M ${x + 10} ${y + 31} H ${x + w - 10}`)}${sources ? t(`Sources: ${sources}`, x + 10, y + 49, w - 20, Math.max(7, size * .62), "start", 400) : ""}${query ? t(`Query: ${query}`, x + 10, y + 75, w - 20, Math.max(7, size * .58), "start", 400) : ""}${refresh ? t(`Refresh: ${refresh}`, x + 10, y + h - 9, w - 20, Math.max(7, size * .56), "start", 400) : ""}`;
    }
    if (kind === "db-index") {
      const details = [field("uniqueness"), field("columns"), field("method"), field("predicate")].filter(Boolean).slice(0, 3);
      const branch = `<path d="M ${x + 20} ${y + 48} L ${x + 45} ${y + 61} M ${x + 45} ${y + 61} L ${x + 31} ${y + 73} M ${x + 45} ${y + 61} L ${x + 59} ${y + 73}" fill="none" stroke="${ink}"/><circle cx="${x + 20}" cy="${y + 48}" r="3" fill="${soft}" stroke="${ink}"/><circle cx="${x + 31}" cy="${y + 73}" r="3" fill="${soft}" stroke="${ink}"/><circle cx="${x + 59}" cy="${y + 73}" r="3" fill="${soft}" stroke="${ink}"/>`;
      return `${r()}${t("INDEX", x + 10, y + 17, w - 20, Math.min(size, 11))}${p(`M ${x + 10} ${y + 29} H ${x + w - 10}`)}${branch}${details.map((value, index) => t(value, x + 70, y + 47 + index * 21, w - 80, Math.max(7, size * .58), "start", index === 0 ? 600 : 400)).join("")}`;
    }
    if (kind === "db-procedure") {
      const signature = field("signature"); const parameters = field("parameters"); const transaction = field("transaction"); const effects = field("effects");
      return `${r(x, y, w, h, cleanFill)}<circle cx="${x + 25}" cy="${y + 25}" r="14" fill="${soft}" stroke="${ink}"/>${t("ƒx", x + 25, y + 25, 24, 12, "middle")}${t(rawTitle.toUpperCase(), x + 48, y + 18, w - 58, Math.min(size, 12))}${p(`M ${x + 48} ${y + 31} H ${x + w - 10}`)}${signature ? t(signature, x + 12, y + 55, w - 24, Math.max(7, size * .64)) : ""}${parameters ? t(`Parameters: ${parameters}`, x + 12, y + 78, w - 24, Math.max(7, size * .56), "start", 400) : ""}${transaction || effects ? t([transaction, effects].filter(Boolean).join(" · "), x + 12, y + h - 10, w - 24, Math.max(7, size * .52), "start", 400) : ""}`;
    }
    if (kind === "uml-object") {
      const classifier = field("classifier"); const state = field("state"); const slots = field("slots"); const slotLines = slots.split(/\r?\n/).filter(Boolean).slice(0, 4);
      return `${r()}${t("«instance»", x + w / 2, y + 16, w - 16, Math.max(8, size * .68), "middle", 400)}${t(classifier ? `${rawTitle} : ${classifier}` : rawTitle, x + w / 2, y + 37, w - 16, size, "middle")}${p(`M ${x} ${y + 52} H ${x + w}`)}${state ? t(`State: ${state}`, x + 10, y + 69, w - 20, Math.max(7, size * .64), "start", 400) : ""}${slotLines.map((slot, index) => t(slot, x + 12, y + 89 + index * 14, w - 24, Math.max(7, size * .58), "start", 400)).join("")}`;
    }
    if (kind === "uml-activity-action") {
      const behavior = field("behavior"); const inputs = field("inputs").split(/\r?\n/).filter(Boolean)[0]; const outputs = field("outputs").split(/\r?\n/).filter(Boolean)[0];
      return `${r(x, y, w, h, cleanFill, 15)}${t(rawTitle, x + w / 2, y + 22, w - 24, size, "middle")}${behavior ? t(behavior, x + w / 2, y + 47, w - 24, Math.max(7, size * .62), "middle", 400) : ""}${inputs ? `${r(x - 1, y + h * .5 - 5, 8, 10, soft)}${t(inputs, x + 10, y + h * .72, w * .42, Math.max(6, size * .52), "start", 400)}` : ""}${outputs ? `${r(x + w - 7, y + h * .5 - 5, 8, 10, soft)}${t(outputs, x + w * .54, y + h * .72, w * .4, Math.max(6, size * .52), "start", 400)}` : ""}`;
    }
    if (kind === "uml-activity-decision") {
      const condition = field("condition"); const guards = field("guards").split(/\r?\n/).filter(Boolean)[0];
      return `<path d="M ${x + w / 2} ${y} L ${x + w} ${y + h / 2} L ${x + w / 2} ${y + h} L ${x} ${y + h / 2} Z" fill="${cleanFill}" stroke="${ink}" stroke-width="1.3"/>${t(condition || rawTitle, x + w * .24, y + h * .45, w * .52, Math.max(7, size * .65), "middle")}${guards ? t(guards, x + w / 2, y + h - 5, w - 6, Math.max(6, size * .48), "middle", 400) : ""}`;
    }
    if (kind === "uml-activity-initial" || kind === "uml-activity-final") {
      const radius = Math.min(w, h) / 2 - 1; const cx = x + w / 2; const cy = y + h / 2; const circle = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${kind === "uml-activity-initial" ? ink : cleanFill}" stroke="${ink}" stroke-width="${kind === "uml-activity-final" ? 2 : 1.5}"/>`;
      return `${circle}${kind === "uml-activity-final" ? `<circle cx="${cx}" cy="${cy}" r="${radius * .65}" fill="${ink}"/>` : ""}`;
    }
    if (kind === "c4-container-instance" || kind === "c4-component-instance") {
      const container = kind === "c4-container-instance"; const responsibility = field("responsibility"); const implementation = field(container ? "technology" : "implementation"); const interfaces = field(container ? "interfaces" : "interface");
      return `${r()}${t(container ? "CONTAINER" : "COMPONENT", x + 10, y + 16, w - 20, Math.max(8, size * .7), "start", 400)}${p(`M ${x + 1} ${y + 29} H ${x + w - 1}`)}${t(rawTitle, x + 10, y + 49, w - 20, size)}${responsibility ? t(responsibility, x + 10, y + 74, w - 20, Math.max(7, size * .62), "start", 400) : ""}${implementation ? t(implementation, x + 10, y + 96, w - 20, Math.max(7, size * .58), "start", 400) : ""}${interfaces ? t(interfaces, x + 10, y + h - 8, w - 20, Math.max(7, size * .52), "start", 400) : ""}`;
    }
    if (kind === "bpmn-group") {
      const purpose = field("purpose");
      return `${p(`M ${x + 10} ${y + 2} H ${x + w - 10} Q ${x + w - 2} ${y + 2} ${x + w - 2} ${y + 10} V ${y + h - 10} Q ${x + w - 2} ${y + h - 2} ${x + w - 10} ${y + h - 2} H ${x + 10} Q ${x + 2} ${y + h - 2} ${x + 2} ${y + h - 10} V ${y + 10} Q ${x + 2} ${y + 2} ${x + 10} ${y + 2} Z`, "6 4")}${t(rawTitle.toUpperCase(), x + 12, y + 17, w - 24, Math.min(size, 12))}${purpose ? t(purpose, x + 12, y + 43, w - 24, Math.max(7, size * .64), "start", 400) : ""}`;
    }
    if (["uml-state", "uml-initial-state", "uml-final-state", "uml-fork", "uml-join", "uml-component", "uml-node", "uml-artifact", "uml-enumeration"].includes(kind)) {
    if (kind === "uml-initial-state") return `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${Math.min(w, h) / 2 - .65}" fill="${ink}" stroke="${ink}"/>`;
    if (kind === "uml-final-state") { const outerRadius = Math.min(w, h) / 2 - 1; return `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${outerRadius}" fill="${cleanFill}" stroke="${ink}" stroke-width="2"/><circle cx="${x + w / 2}" cy="${y + h / 2}" r="${outerRadius * .65}" fill="${ink}"/>`; }
    if (kind === "uml-fork" || kind === "uml-join") return `<rect x="${x}" y="${y + 1}" width="${w}" height="${Math.max(1, h - 2)}" fill="${ink}"/>`;
      if (kind === "uml-state") {
        const actions = (["entry", "do", "exit"] as const).flatMap(key => {
          const value = meta.componentFields?.find(field => field.key === key)?.value.trim();
          return value ? [key + ": " + value] : [];
        });
        return `${r()}${t(rawTitle, x + w / 2, y + h * .4, w - 20, size, "middle")}${actions.map((action, index) => t(action, x + w / 2, y + h * (.62 + index * .12), w - 20, Math.max(7, size * .6), "middle", 400)).join("")}`;
      }
      if (kind === "uml-component") return `${r()}${r(x + w - 25, y + 12, 14, 10, "none")}${r(x + w - 25, y + 28, 14, 10, "none")}${t(rawTitle, x + (w - 35) / 2, y + h * .36, w - 45, size, "middle")}${field("provided") ? t(`Provides: ${field("provided")}`, x + w / 2, y + h * .65, w - 20, Math.max(7, size * .65), "middle", 400) : ""}${field("required") ? t(`Requires: ${field("required")}`, x + w / 2, y + h * .82, w - 20, Math.max(7, size * .62), "middle", 400) : ""}`;
      if (kind === "uml-node") { const dx = Math.min(18, w * .12); const dy = Math.min(15, h * .12); return `${r(x + dx, y + dy, w - dx, h - dy)}${p(`M ${x + dx} ${y + dy} L ${x + dx + 10} ${y} H ${x + w} V ${y + dy} M ${x + w - dx} ${y + dy} L ${x + w} ${y}`)}${t(rawTitle, x + w / 2 + dx / 2, y + h * .43, w - dx - 16, size, "middle")}${field("execution-environment") ? t(field("execution-environment"), x + w / 2 + dx / 2, y + h * .64, w - dx - 16, Math.max(7, size * .65), "middle", 400) : ""}${field("location") ? t(field("location"), x + w / 2 + dx / 2, y + h * .82, w - dx - 16, Math.max(7, size * .6), "middle", 400) : ""}`; }
      if (kind === "uml-artifact") { const fold = Math.min(20, w * .18); return `${p(`M ${x} ${y} H ${x + w - fold} L ${x + w} ${y + fold} V ${y + h} H ${x} Z M ${x + w - fold} ${y} V ${y + fold} H ${x + w}`)}${t(rawTitle, x + w / 2, y + h * .43, w - 16, size, "middle")}${field("version") ? t(`Version ${field("version")}`, x + w / 2, y + h * .65, w - 16, Math.max(7, size * .65), "middle", 400) : ""}${field("repository") ? t(field("repository"), x + w / 2, y + h * .82, w - 16, Math.max(7, size * .6), "middle", 400) : ""}`; }
      const header = Math.min(40, h * .3);
      return `${r()}${t("«enumeration»", x + w / 2, y + 14, w - 16, Math.max(8, size * .68), "middle", 400)}${t(rawTitle, x + w / 2, y + header, w - 16, size, "middle")}${p(`M ${x} ${y + header + 8} H ${x + w}`)}${t("«literal»", x + 12, y + header + 28, w - 24, Math.max(8, size * .68), "start", 400)}`;
    }
    if (kind === "uml-package") {
      const tabW = Math.min(w * .42, 86); const tabH = Math.min(22, h * .22);
      const contents = field("contents"); const namespace = field("namespace");
      return `<path d="M ${x} ${y + tabH} V ${y + 2} H ${x + tabW} L ${x + tabW + 12} ${y + tabH} H ${x + w - 2} V ${y + h - 2} H ${x + 2} Z" fill="${cleanFill}" stroke="${ink}" stroke-width="1.3"/>${t(rawTitle, x + 12, y + tabH + h * .31, w - 24, size, "middle")}${namespace ? t(namespace, x + 12, y + tabH + h * .52, w - 24, Math.max(7, size * .7), "middle", 400) : ""}${contents ? t(contents, x + 12, y + tabH + h * .7, w - 24, Math.max(7, size * .64), "middle", 400) : ""}`;
    }
    if (kind === "uml-actor") {
      const cx = x + w / 2; const figureWidth = Math.min(58, w * .72); const head = Math.min(12, h * .11); const role = field("role"); const goal = field("goal");
      const figure = `<circle cx="${cx}" cy="${y + head + 3}" r="${head}" fill="${cleanFill}" stroke="${ink}"/><path d="M ${cx} ${y + head * 2 + 3} V ${y + h * .58} M ${cx - figureWidth * .38} ${y + h * .38} H ${cx + figureWidth * .38} M ${cx} ${y + h * .58} L ${cx - figureWidth * .3} ${y + h * .69} M ${cx} ${y + h * .58} L ${cx + figureWidth * .3} ${y + h * .69}" fill="none" stroke="${ink}"/>`;
      return `${figure}${t(rawTitle, cx, y + h - (role && goal ? 42 : role || goal ? 30 : 20), w - 8, size, "middle")}${role ? t(role, cx, y + h - (goal ? 25 : 8), w - 8, Math.max(7, size * .64), "middle", 400) : ""}${goal ? t(goal, cx, y + h - 8, w - 8, Math.max(7, size * .58), "middle", 400) : ""}`;
    }
    if (kind === "uml-use-case") return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2 - .65}" ry="${h / 2 - .65}" fill="${cleanFill}" stroke="${ink}" stroke-width="1.3"/>${t(rawTitle, x + w / 2, y + h / 2, w * .84, size, "middle")}${field("outcome") ? t(field("outcome"), x + w / 2, y + h * .68, w * .64, Math.max(7, size * .62), "middle", 400) : ""}`;
    if (kind === "diagram-legend") {
      const rows = ["Component", "Decision", "Data store", "Relationship"];
      const rowMarkup = rows.map((row, index) => {
        const rowY = y + 42 + index * 18;
        const glyph = index === 0 ? `<rect x="${x + 12}" y="${rowY - 5}" width="14" height="10" fill="${soft}" stroke="${ink}"/>`
          : index === 1 ? `<path d="M ${x + 19} ${rowY - 7} l7 7-7 7-7-7Z" fill="${soft}" stroke="${ink}"/>`
            : index === 2 ? `<ellipse cx="${x + 19}" cy="${rowY}" rx="7" ry="5" fill="${soft}" stroke="${ink}"/><path d="M ${x + 12} ${rowY} a7 2 0 0 0 14 0" fill="none" stroke="${ink}"/>`
              : `<path d="M ${x + 12} ${rowY} H ${x + 27} m-4-3 4 3-4 3" fill="none" stroke="${ink}"/>`;
        return `${glyph}${t(row, x + 34, rowY, w - 44, Math.min(size, 10), "start", 400)}`;
      }).join("");
      return `${r()}${t(rawTitle, x + 12, y + 15, w - 24, Math.min(size, 14))}<path d="M ${x + 8} ${y + 29} H ${x + w - 8}" stroke="${ink}"/>${rowMarkup}`;
    }
    const provider = cloudProviderComponent(kind);
    if (provider) {
      const iconSide = Math.max(28, Math.min(54, h - 34, w * .34)); const iconX = x + 10; const iconY = y + (h - iconSide) / 2 - 3; const copyX = iconX + iconSide + 9;
      const outer = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${cleanFill}" stroke="${provider.accent}" stroke-width="1.4"/>`;
      const icon = meta.iconSvg && meta.iconViewBox
        ? `<svg x="${iconX}" y="${iconY}" width="${iconSide}" height="${iconSide}" viewBox="${meta.iconViewBox}" preserveAspectRatio="xMidYMid meet">${meta.iconSvg}</svg>`
        : `<rect x="${iconX}" y="${iconY}" width="${iconSide}" height="${iconSide}" fill="${soft}" stroke="${provider.accent}" stroke-width="1.2"/><text x="${iconX + iconSide / 2}" y="${iconY + iconSide / 2}" text-anchor="middle" dominant-baseline="middle" fill="${provider.accent}" font-family="sans-serif" font-size="${provider.glyph.length > 2 ? 10 : 13}" font-weight="700">${xmlText(provider.glyph)}</text>`;
      const providerDetails = (meta.componentFields ?? []).filter(item => item.value.trim()).slice(0, 2);
      const detailMarkup = providerDetails.map((item, index) => t(`${item.label}: ${item.value}`, copyX, y + h * (.76 + index * .13), w - (copyX - x) - 9, 7, "start", 400)).join("");
      return `${outer}${icon}${t(rawTitle, copyX, y + h * .34, w - (copyX - x) - 9, size)}${t(provider.provider.toUpperCase(), copyX, y + h * .53, w - (copyX - x) - 9, 8, "start", 650)}${detailMarkup}`;
    }
    if (kind === "c4-person") {
      const role = field("role"); const goal = field("goal");
      return `<circle cx="${x + w / 2}" cy="${y + 24}" r="10" fill="none" stroke="${ink}" stroke-width="1.5"/>${p(`M ${x + w / 2} ${y + 35} V ${y + 63} M ${x + w / 2 - 20} ${y + 42} H ${x + w / 2 + 20} M ${x + w / 2} ${y + 63} L ${x + w / 2 - 15} ${y + 82} M ${x + w / 2} ${y + 63} L ${x + w / 2 + 15} ${y + 82}`)}${t(rawTitle, x + w / 2, y + h - (role || goal ? 31 : 8), w - 12, Math.min(size, 12), "middle")}${role ? t(role, x + w / 2, y + h - 19, w - 12, Math.max(7, size * .64), "middle", 400) : ""}${goal ? t(goal, x + w / 2, y + h - 7, w - 12, Math.max(7, size * .58), "middle", 400) : ""}`;
    }
    if (kind === "c4-software-system") return `${r()}${t("SOFTWARE SYSTEM", x + 10, y + 18, w - 20, Math.max(8, size * .72), "start", 400)}${t(rawTitle, x + 10, y + h * .42, w - 20, size)}${field("description") ? t(field("description"), x + 10, y + h * .67, w - 20, Math.max(7, size * .68), "start", 400) : ""}${field("technology") ? t(field("technology"), x + 10, y + h - 8, w - 20, Math.max(7, size * .62), "start", 400) : ""}`;
    if (kind === "c4-external-system") return `${r(x + 1, y + 1, w - 2, h - 2, "none").replace("stroke-width=\"1.3\"", "stroke-width=\"1.3\" stroke-dasharray=\"6 4\"")}${t("EXTERNAL SYSTEM", x + 10, y + 18, w - 20, Math.max(8, size * .72), "start", 400)}${t(rawTitle, x + 10, y + h * .4, w - 20, size)}${field("description") ? t(field("description"), x + 10, y + h * .65, w - 20, Math.max(7, size * .66), "start", 400) : ""}${field("interface") ? t(field("interface"), x + 10, y + h - 8, w - 20, Math.max(7, size * .6), "start", 400) : ""}`;
    if (kind === "c4-deployment-node" || kind === "c4-infrastructure-node") {
      const detailKeys = kind === "c4-deployment-node" ? ["environment", "instance", "technology"] : ["infrastructure-role", "technology", "location"];
      const details = detailKeys.map(key => field(key)).filter(Boolean);
      return `${r()}${t(kind === "c4-deployment-node" ? "DEPLOYMENT NODE" : "INFRASTRUCTURE NODE", x + 10, y + 15, w - 20, Math.min(size, 12))}${p(`M ${x + 12} ${y + 27} H ${x + w - 12}`)}${[0, 1].map(index => `${r(x + 14, y + 40 + index * 34, w - 28, 28, "none")}<circle cx="${x + 24}" cy="${y + 54 + index * 34}" r="2" fill="${ink}"/>${details[index] ? t(details[index], x + 32, y + 54 + index * 34, w - 50, 8, "start", 400) : ""}`).join("")}${t(rawTitle, x + 10, y + h - 6, w - 20, Math.max(8, size * .72), "start", 400)}`;
    }
    if (kind === "c4-code-element") return `${r()}${t("CODE ELEMENT", x + 10, y + 16, w - 20, Math.max(8, size * .7), "start", 400)}${p(`M ${x + 1} ${y + 27} H ${x + w - 1}`)}${t(rawTitle, x + 12, y + h * .39, w - 24, size)}${p(`M ${x + 1} ${y + h * .54} H ${x + w - 1}`)}${field("signature") ? t(field("signature"), x + 12, y + h * .68, w - 24, Math.max(7, size * .66), "start", 400) : ""}${field("responsibility") ? t(field("responsibility"), x + 12, y + h * .84, w - 24, Math.max(7, size * .62), "start", 400) : ""}`;
    if (kind === "c4-system" || kind === "c4-container" || kind === "c4-component") return `${r(x + 1, y + 1, w - 2, h - 2, "none").replace("stroke-width=\"1.3\"", "stroke-width=\"1.3\" stroke-dasharray=\"6 4\"")}${t(rawTitle.toUpperCase(), x + 12, y + 15, w - 24, Math.min(size, 14))}${t(kind === "c4-system" ? "System context" : kind === "c4-container" ? "Container boundary" : "Component boundary", x + 12, y + 34, w - 24, Math.max(8, size * .75), "start", 400)}${field(kind === "c4-system" ? "system-scope" : "description") ? t(field(kind === "c4-system" ? "system-scope" : "description"), x + 12, y + 56, w - 24, Math.max(8, size * .72), "start", 400) : ""}${field(kind === "c4-system" ? "context" : "technology") ? t(field(kind === "c4-system" ? "context" : "technology"), x + 12, y + 78, w - 24, Math.max(8, size * .66), "start", 400) : ""}`;
    if (kind === "network-zone") return `${r(x + 1, y + 1, w - 2, h - 2, "none").replace("stroke-width=\"1.3\"", "stroke-width=\"1.3\" stroke-dasharray=\"6 4\"")}${t(rawTitle.toUpperCase(), x + 12, y + 15, w - 24, Math.min(size, 14))}${t("Network trust zone", x + 12, y + 34, w - 24, Math.max(8, size * .75), "start", 400)}${field("trust-level") ? t(`Trust: ${field("trust-level")}`, x + 12, y + 56, w - 24, Math.max(9, size * .78)) : ""}${field("ingress-policy") ? t(`Ingress: ${field("ingress-policy")}`, x + 12, y + 78, w - 24, Math.max(8, size * .68), "start", 400) : ""}`;
    if (kind === "network-subnet") return `${r(x + 1, y + 1, w - 2, h - 2, "none").replace("stroke-width=\"1.3\"", "stroke-width=\"1.3\" stroke-dasharray=\"6 4\"")}${t(rawTitle.toUpperCase(), x + 12, y + 15, w - 24, Math.min(size, 14))}${t("IP subnet", x + 12, y + 34, w - 24, Math.max(8, size * .75), "start", 400)}${field("cidr") ? t(field("cidr"), x + 12, y + 56, w - 24, Math.max(9, size * .82)) : ""}${field("gateway") ? t(`Gateway: ${field("gateway")}`, x + 12, y + 78, w - 24, Math.max(8, size * .68), "start", 400) : ""}${field("vlan") ? t(`VLAN: ${field("vlan")}`, x + 12, y + 99, w - 24, Math.max(8, size * .64), "start", 400) : ""}`;
    if (kind === "cloud-boundary") {
      const d = `M ${x + w * .15} ${y + h * .8} C ${x + w * .04} ${y + h * .8}, ${x + w * .015} ${y + h * .66}, ${x + w * .05} ${y + h * .56} C ${x + w * .08} ${y + h * .45}, ${x + w * .17} ${y + h * .42}, ${x + w * .25} ${y + h * .44} C ${x + w * .25} ${y + h * .22}, ${x + w * .4} ${y + h * .12}, ${x + w * .53} ${y + h * .23} C ${x + w * .66} ${y + h * .05}, ${x + w * .85} ${y + h * .12}, ${x + w * .87} ${y + h * .36} C ${x + w * .97} ${y + h * .38}, ${x + w * .99} ${y + h * .49}, ${x + w * .96} ${y + h * .59} C ${x + w * .99} ${y + h * .72}, ${x + w * .9} ${y + h * .81}, ${x + w * .81} ${y + h * .8} Z`;
      return `<path d="${d}" fill="${cleanFill}" stroke="${ink}" stroke-width="1.3" stroke-dasharray="6 4"/>${t(rawTitle.toUpperCase(), x + w / 2, y + h * .45, w * .5, size, "middle")}${t("Deployment boundary", x + w / 2, y + h * .58, w * .5, Math.max(8, size * .72), "middle", 400)}`;
    }
    if (kind === "software-database" || kind === "cloud-database") {
      const left = x + w * .07; const right = x + w * .93; const ry = Math.max(7, Math.min(12, h * .12));
      const body = `<path d="M ${left} ${y + ry} V ${y + h - ry} A ${w * .43} ${ry} 0 0 1 ${right} ${y + h - ry} V ${y + ry} Z" fill="${cleanFill}" stroke="${ink}" stroke-width="1.3"/>`;
      const top = `<ellipse cx="${x + w / 2}" cy="${y + ry}" rx="${w * .43}" ry="${ry}" fill="${cleanFill}" stroke="${ink}" stroke-width="1.3"/>`;
      const rim = p(`M ${left} ${y + h * .55} C ${left} ${y + h * .7}, ${right} ${y + h * .7}, ${right} ${y + h * .55}`);
      const labels = kind === "cloud-database"
        ? `${t("MANAGED DATABASE", x + w / 2, y + h * .39, w - 16, Math.max(8, size * .66), "middle")}${t("SQL · BACKUP · REPLICAS", x + w / 2, y + h * .73, w - 14, Math.max(7, size * .5), "middle", 400)}`
        : t(rawTitle.toUpperCase(), x + w / 2, y + h * .5, w - 16, Math.max(8, size * .78), "middle");
      return `${body}${top}${rim}${labels}`;
    }
    if (kind === "software-queue" || kind === "cloud-queue") {
      const address = field(kind === "cloud-queue" ? "queue-address" : "queue-name"); const contract = field(kind === "cloud-queue" ? "message-type" : "message-shape");
      return `${r()}${t(rawTitle.toUpperCase(), x + 10, y + 15)}${address ? t(address, x + 8, y + h * .35, w - 16, Math.max(7, size * .62), "middle", 400) : ""}${[0, 1, 2].map(index => r(x + 10 + index * ((w - 32) / 3), y + h * .48, (w - 32) / 3 - 6, Math.min(24, h * .28), soft)).join("")}${p(`M ${x + 10} ${y + h - 14} H ${x + w - 10}`)}${contract ? t(contract, x + 8, y + h - 5, w - 16, Math.max(7, size * .56), "middle", 400) : ""}`;
    }
    if (kind === "cloud-function") return `${r()}${r(x + 10, y + 10, Math.min(32, h - 20), Math.min(32, h - 20), soft)}${t("fn", x + 10 + Math.min(16, (h - 20) / 2), y + 26, 32, 14, "middle")}${t(rawTitle.toUpperCase(), x + 50, y + 22, w - 60, Math.max(8, size * .8))}${t(field("runtime") || field("handler") || "Function runtime", x + 50, y + 43, w - 60, Math.max(8, size * .7), "start", 400)}${field("invocation") ? t(`Trigger: ${field("invocation")}`, x + 10, y + h - 9, w - 20, Math.max(7, size * .58), "start", 400) : ""}`;
    if (kind === "cloud-storage") return `${r()}${t(rawTitle.toUpperCase(), x + 12, y + 15)}${field("bucket") ? t(field("bucket"), x + 12, y + 39, w - 24, Math.max(7, size * .66)) : ""}${p(`M ${x + 12} ${y + 48} H ${x + w - 12}`)}${field("stored-objects") ? t(field("stored-objects"), x + 12, y + 67, w - 24, Math.max(7, size * .62), "start", 400) : ""}${field("access-policy") ? t(field("access-policy"), x + 12, y + 88, w - 24, Math.max(7, size * .56), "start", 400) : ""}`;
    if (kind === "software-client") return `${r()}${t(rawTitle.toUpperCase(), x + 12, y + 14)}${p(`M ${x} ${y + 27} H ${x + w}`)}${r(x + 12, y + 38, w * .32, h - 52, soft)}${r(x + w * .42, y + 38, w * .48, 16, soft)}${r(x + w * .42, y + 62, w * .48, h - 76, soft)}`;
    if (kind === "software-api") {
      const method = field("method").toUpperCase(); const path = field("path");
      const methodWidth = Math.min(64, Math.max(44, w * .27));
      const routeX = x + 12 + (method ? methodWidth + 8 : 0);
      const route = `${method ? t(method, x + 12, y + 49, methodWidth, 9, "start", 650) : ""}${path ? t(path, routeX, y + 49, Math.max(1, x + w - 12 - routeX), Math.max(8, size * .78)) : ""}`;
      const details = [
        ["Summary", field("summary")], ["Request", field("request-body")], ["Response", field("responses")], ["Parameters", field("parameters")],
        ["Server", field("server")], ["Auth", field("security")], ["Operation", field("operation-id")],
      ].filter(([, value]) => value) as [string, string][];
      return `${r()}${t(rawTitle, x + 12, y + 16, w - 24, Math.min(size, 13))}${p(`M ${x + 1} ${y + 29} H ${x + w - 1}`)}${route}${block(details, x + 12, y + 65, w - 24, Math.max(6, size * .58), h - 70)}`;
    }
    if (kind === "software-cache") return `${r()}${t(rawTitle.toUpperCase(), x + 10, y + 17)}${t(field("cached-values") || "KEY / VALUE", x + 10, y + h * .48, w - 20, Math.max(8, size * .72), "start", 400)}${field("expiration") ? t(`TTL: ${field("expiration")}`, x + 10, y + h * .67, w - 20, Math.max(7, size * .62), "start", 400) : ""}${field("eviction") ? t(`Eviction: ${field("eviction")}`, x + 10, y + h * .84, w - 20, Math.max(7, size * .58), "start", 400) : ""}`;
    if (["software-service", "tech-service"].includes(kind)) return `${r()}${t(rawTitle.toUpperCase(), x + 10, y + 17)}${p(`M ${x + 10} ${y + h * .48} H ${x + w - 10}`)}${t(field(kind === "tech-service" ? "technology" : "responsibility") || (kind === "tech-service" ? "Technology" : "Module / worker"), x + 10, y + h * .72, w - 20, Math.max(8, size * .8), "start", 400)}`;
    if (kind === "software-event-bus") {
      const top = y + h * .33; const bottom = y + h * .67;
      const links = [.2, .5, .8].map(ratio => {
        const px = x + w * ratio;
        return `${p(`M ${px} ${y + 17} V ${top - 2} m -3 -5 3 5 3 -5 M ${px} ${bottom + 2} V ${y + h - 18} m -3 -5 3 5 3 -5`)}<circle cx="${px}" cy="${y + 17}" r="2.5" fill="${ink}"/>`;
      }).join("");
      return `${t("PUBLISHERS", x + w / 2, y + 7, w - 8, Math.max(7, size * .53), "middle", 400)}${r(x + 2, top, w - 4, bottom - top, soft)}${t(rawTitle.toUpperCase(), x + w / 2, y + h * .5, w - 16, size, "middle")}${links}${t("SUBSCRIBERS", x + w / 2, y + h - 7, w - 8, Math.max(7, size * .53), "middle", 400)}`;
    }
    if (kind === "network-switch" || kind === "network-hub") {
      const count = Math.max(1, Math.min(32, Math.round(meta.portCount ?? (kind === "network-hub" ? 8 : 6)))); const columns = Math.min(8, count); const rows = Math.ceil(count / columns); const gapX = (w - 24) / columns; const rowGap = Math.max(10, (h - 42) / rows);
      const ports = Array.from({ length: count }, (_, index) => { const col = index % columns; const row = Math.floor(index / columns); const pw = Math.min(12, gapX - 2); return r(x + 12 + col * gapX + (gapX - pw) / 2, y + 32 + row * rowGap, pw, Math.min(7, rowGap - 2), "none"); }).join("");
      const networkNote = kind === "network-switch" ? field("vlans") : field("connected-devices");
      return `${r()}${t(rawTitle.toUpperCase(), x + 10, y + 15)}${ports}${networkNote ? t(networkNote, x + 8, y + h - 5, w - 16, Math.max(6, size * .55), "middle", 400) : ""}`;
    }
    if (kind === "network-server") {
      const rows = Array.from({ length: 3 }, (_, row) => r(x + 10, y + 28 + row * ((h - 36) / 3), w - 20, Math.max(8, (h - 48) / 3), soft)).join("");
      const details = [field("ip-addresses"), field("services")].filter(Boolean);
      return `${r()}${t(rawTitle.toUpperCase(), x + 10, y + 15)}${rows}${details.map((detail, index) => t(detail, x + 24, y + 46 + index * 20, w - 34, Math.max(6, size * .48), "start", 400)).join("")}`;
    }
    if (kind === "network-firewall") {
      const bricks = Array.from({ length: 8 }, (_, index) => { const row = Math.floor(index / 4); const col = index % 4; const brickW = (w - 24) / 4; const brickH = (h - 50) / 2; return r(x + 8 + col * brickW + (row ? brickW / 2 : 0), y + 38 + row * brickH, brickW, brickH, "none"); }).join("");
      return `${r()}${t(rawTitle.toUpperCase(), x + 10, y + 15)}${field("default-action") ? t(`Default: ${field("default-action")}`, x + 8, y + 29, w - 16, Math.max(6, size * .5), "start", 400) : ""}${bricks}${field("rules") ? t(field("rules"), x + 8, y + h - 4, w - 16, Math.max(6, size * .48), "middle", 400) : ""}`;
    }
    if (kind === "network-client") return `${r(x + 8, y + 4, w - 16, h * .68)}${field("platform") ? t(field("platform"), x + 12, y + h * .39, w - 24, Math.max(7, size * .58), "middle", 400) : ""}${field("network") ? t(field("network"), x + 12, y + h * .55, w - 24, Math.max(6, size * .5), "middle", 400) : ""}${p(`M ${x + w * .25} ${y + h * .82} H ${x + w * .75} M ${x + w * .5} ${y + h * .68} V ${y + h * .82}`)}${t(rawTitle.toUpperCase(), x + w / 2, y + h - 10, w - 8, Math.max(7, size * .72), "middle")}`;
    if (kind === "network-router" || kind === "network-load-balancer") {
      const detail = field(kind === "network-router" ? "routing-protocol" : "listeners");
      return `${r()}${t(rawTitle.toUpperCase(), x + 10, y + 15)}${detail ? t(detail, x + 8, y + 28, w - 16, Math.max(6, size * .5), "middle", 400) : ""}${p(`M ${x + w / 2} ${y + h * .61} L ${x + 8} ${y + h * .8} M ${x + w / 2} ${y + h * .61} L ${x + w - 8} ${y + h * .8} M ${x + w / 2} ${y + h * .61} V ${y + h - 8}`)}<circle cx="${x + w / 2}" cy="${y + h * .61}" r="${Math.min(w, h) * .1}" fill="${cleanFill}" stroke="${ink}"/>`;
    }
    if (kind === "network-access-point") { const cx = x + w / 2; const cy = y + h * .35; const radius = Math.min(w * .2, h * .25); return `${t(rawTitle.toUpperCase(), cx, y + 12, w - 8, Math.max(7, size * .68), "middle")}${[1, .68, .32].map(scale => p(`M ${cx - radius * scale} ${cy} A ${radius * scale} ${radius * scale} 0 0 1 ${cx + radius * scale} ${cy}`)).join("")}<circle cx="${cx}" cy="${cy}" r="2" fill="${ink}"/>${field("ssid") ? t(field("ssid"), cx, y + h * .72, w - 12, Math.max(7, size * .58), "middle", 650) : ""}${field("security-mode") || field("channel") ? t([field("security-mode"), field("channel")].filter(Boolean).join(" · "), cx, y + h * .88, w - 12, Math.max(6, size * .48), "middle", 400) : ""}`; }
    if (kind === "network-internet") {
      const d = `M ${x + w * .18} ${y + h * .76} C ${x + w * .04} ${y + h * .76} ${x + w * .04} ${y + h * .55} ${x + w * .19} ${y + h * .5} C ${x + w * .18} ${y + h * .24} ${x + w * .42} ${y + h * .18} ${x + w * .54} ${y + h * .34} C ${x + w * .72} ${y + h * .12} ${x + w * .94} ${y + h * .33} ${x + w * .85} ${y + h * .51} C ${x + w} ${y + h * .61} ${x + w * .9} ${y + h * .78} ${x + w * .76} ${y + h * .76} Z`;
      const prefix = field("public-prefix");
      return `<path d="${d}" fill="${cleanFill}" stroke="${ink}" stroke-width="1.3"/>${t(rawTitle.toUpperCase(), x + w / 2, y + h * (prefix ? .46 : .59), w * .62, Math.min(size, 12), "middle")}${prefix ? t(prefix, x + w / 2, y + h * .68, w * .68, Math.max(7, size * .58), "middle", 400) : ""}`;
    }
    if (kind === "network-vpn") {
      const route = [field("local-prefixes"), field("remote-prefixes")].filter(Boolean).join(" → ");
      const detail = route || field("vpn-type");
      return `${r()}${t(rawTitle.toUpperCase(), x + w / 2, y + 14, w - 16, Math.min(size, 12), "middle")}${p(`M ${x + 17} ${y + h * .59} H ${x + w - 17}`, "5 4")}<circle cx="${x + 17}" cy="${y + h * .59}" r="4" fill="${cleanFill}" stroke="${ink}"/><circle cx="${x + w - 17}" cy="${y + h * .59}" r="4" fill="${cleanFill}" stroke="${ink}"/>${detail ? t(detail, x + w / 2, y + h - 8, w - 16, Math.max(7, size * .56), "middle", 400) : ""}`;
    }
    if (kind === "network-dns") { const cx = x + w / 2; const cy = y + h * .35; const radius = Math.min(w * .22, h * .22); return `${r()}<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${ink}"/><ellipse cx="${cx}" cy="${cy}" rx="${radius * .48}" ry="${radius}" fill="none" stroke="${ink}"/>${p(`M ${cx - radius} ${cy} H ${cx + radius}`)}${field("zone") ? t(field("zone"), cx, y + h * .71, w - 16, Math.max(7, size * .58), "middle", 400) : ""}${t(rawTitle.toUpperCase(), cx, y + h - 7, w - 16, Math.max(8, size * .68), "middle")}`; }
    if (kind === "network-nat-gateway") return `${r()}${t(rawTitle.toUpperCase(), x + w / 2, y + 14, w - 16, Math.min(size, 12), "middle")}${p(`M ${x + 24} ${y + h - 28} L ${x + w / 2} ${y + h * .55} L ${x + w - 24} ${y + h - 28} M ${x + w / 2} ${y + h * .55} V ${y + h * .31} l -4 6 m 4 -6 l 4 6`)}<circle cx="${x + 24}" cy="${y + h - 28}" r="3" fill="${cleanFill}" stroke="${ink}"/><circle cx="${x + w - 24}" cy="${y + h - 28}" r="3" fill="${cleanFill}" stroke="${ink}"/>${field("public-address") ? t(field("public-address"), x + 8, y + h - 5, w - 16, Math.max(7, size * .55), "middle", 400) : ""}`;
    if (kind === "network-modem") return `${r()}${t(rawTitle.toUpperCase(), x + w / 2, y + 13, w - 12, Math.min(size, 11), "middle")}${p(`M ${x + 10} ${y + h * .42} H ${x + w - 10}`)}${[0, 1, 2, 3].map(index => `<circle cx="${x + 15 + index * 11}" cy="${y + h * .67}" r="2" fill="${ink}"/>`).join("")}${p(`M ${x + w - 31} ${y + h * .74} A 8 8 0 0 1 ${x + w - 15} ${y + h * .74} M ${x + w - 28} ${y + h * .74} A 5 5 0 0 1 ${x + w - 18} ${y + h * .74}`)}${field("access-technology") ? t(field("access-technology"), x + 6, y + h - 5, w - 12, Math.max(6, size * .5), "middle", 400) : ""}`;
    if (["network-proxy", "network-bridge", "network-bastion", "network-gateway", "network-printer", "network-workstation"].includes(kind)) {
      const cx = x + w / 2; const cy = y + h * .55;
      if (kind === "network-workstation") return `${r(x + 10, y + 8, w - 20, h * .58, soft)}${field("platform") ? t(field("platform"), cx, y + h * .38, w - 24, Math.max(6, size * .5), "middle", 400) : ""}${p(`M ${x + w * .3} ${y + h * .72} H ${x + w * .7} M ${cx} ${y + h * .66} V ${y + h * .82} M ${x + w * .28} ${y + h * .82} H ${x + w * .72}`)}${t(rawTitle.toUpperCase(), cx, y + h - 8, w - 8, Math.max(7, size * .7), "middle")}`;
      if (kind === "network-printer") return `${r(x + 12, y + h * .34, w - 24, h * .48, soft)}${r(x + 24, y + 5, w - 48, h * .34, cleanFill)}${field("model") ? t(field("model"), cx, y + h * .25, w - 52, Math.max(6, size * .48), "middle", 400) : ""}${p(`M ${x + 28} ${y + h * .7} H ${x + w - 28} M ${x + 30} ${y + h * .84} H ${x + w - 30}`)}<circle cx="${x + w - 22}" cy="${y + h * .48}" r="2" fill="${ink}"/>${t(rawTitle.toUpperCase(), cx, y + h - 7, w - 8, Math.max(7, size * .66), "middle")}`;
      if (kind === "network-bridge") return `${r()}${t(rawTitle.toUpperCase(), cx, y + 14, w - 12, Math.min(size, 11), "middle")}${p(`M ${x + 16} ${cy} H ${x + w - 16} M ${x + w * .3} ${cy - 12} V ${cy + 12} M ${x + w * .7} ${cy - 12} V ${cy + 12}`)}${[.16, .5, .84].map(position => `<circle cx="${x + w * position}" cy="${cy}" r="4" fill="${cleanFill}" stroke="${ink}"/>`).join("")}${field("segments") ? t(field("segments"), cx, y + h - 5, w - 16, Math.max(6, size * .5), "middle", 400) : ""}`;
      if (kind === "network-gateway") return `${r()}${t(rawTitle.toUpperCase(), cx, y + 14, w - 12, Math.min(size, 11), "middle")}${p(`M ${cx} ${y + h * .35} V ${y + h * .65} M ${cx - 16} ${y + h * .65} H ${cx + 16} M ${cx - 12} ${y + h * .42} L ${cx} ${y + h * .32} L ${cx + 12} ${y + h * .42}`)}${field("gateway-type") ? t(field("gateway-type"), cx, y + h - 5, w - 16, Math.max(6, size * .5), "middle", 400) : ""}`;
      if (kind === "network-bastion") return `${r()}${t(rawTitle.toUpperCase(), cx, y + 14, w - 12, Math.min(size, 11), "middle")}${p(`M ${cx} ${y + h * .31} L ${cx + 18} ${y + h * .4} V ${y + h * .58} Q ${cx + 16} ${y + h * .76} ${cx} ${y + h * .84} Q ${cx - 16} ${y + h * .76} ${cx - 18} ${y + h * .58} V ${y + h * .4} Z M ${cx - 8} ${y + h * .56} L ${cx - 2} ${y + h * .63} L ${cx + 10} ${y + h * .48}`)}${field("allowed-sources") ? t(field("allowed-sources"), cx, y + h - 5, w - 16, Math.max(6, size * .5), "middle", 400) : ""}`;
      return `${r()}${t(rawTitle.toUpperCase(), cx, y + 14, w - 12, Math.min(size, 11), "middle")}${p(`M ${x + 12} ${cy} H ${x + w - 12} M ${x + w * .32} ${cy - 7} l-7 7 7 7 M ${x + w * .68} ${cy - 7} l7 7-7 7`)}${field("upstream") ? t(field("upstream"), cx, y + h - 5, w - 16, Math.max(6, size * .5), "middle", 400) : ""}`;
    }
    if (["bpmn-start", "bpmn-event", "bpmn-end", "bpmn-boundary-event", "bpmn-message-event", "bpmn-timer-event", "bpmn-error-event", "bpmn-signal-event", "bpmn-terminate-event"].includes(kind)) {
      const diameter = Math.max(0, h >= 72 ? Math.min(58, w, h - 38) : Math.min(w, h - 14)); const cx = x + w / 2; const cy = diameter / 2 + y + 1;
      const marked = !["bpmn-start", "bpmn-end"].includes(kind);
      const outer = `<circle cx="${cx}" cy="${cy}" r="${diameter * .43}" fill="${kind === "bpmn-terminate-event" ? ink : cleanFill}" stroke="${ink}" stroke-width="${kind === "bpmn-end" || kind === "bpmn-terminate-event" ? 2 : 1.5}"/>`;
      const inner = marked ? `<circle cx="${cx}" cy="${cy}" r="${diameter * .34}" fill="none" stroke="${kind === "bpmn-terminate-event" ? cleanFill : ink}"${kind === "bpmn-boundary-event" ? " stroke-dasharray=\"3 2\"" : ""}/>` : "";
      const marker = kind === "bpmn-message-event" ? `<path d="M ${cx - 8} ${cy - 5} H ${cx + 8} V ${cy + 5} H ${cx - 8} Z M ${cx - 8} ${cy - 5} L ${cx} ${cy + 1} L ${cx + 8} ${cy - 5}" fill="none" stroke="${ink}"/>`
        : kind === "bpmn-timer-event" ? `<circle cx="${cx}" cy="${cy}" r="${diameter * .17}" fill="none" stroke="${ink}"/><path d="M ${cx} ${cy - 5} V ${cy} L ${cx + 5} ${cy + 3}" stroke="${ink}"/>`
          : kind === "bpmn-error-event" ? `<path d="M ${cx + 4} ${cy - 9} L ${cx - 4} ${cy} H ${cx + 2} L ${cx - 4} ${cy + 9}" stroke="${ink}"/>`
            : kind === "bpmn-signal-event" ? `<path d="M ${cx} ${cy - 9} L ${cx + 8} ${cy + 7} H ${cx - 8} Z" fill="none" stroke="${ink}"/>`
              : kind === "bpmn-terminate-event" ? `<circle cx="${cx}" cy="${cy}" r="${diameter * .17}" fill="${cleanFill}"/>` : "";
      const eventDetail = kind === "bpmn-start" ? field("trigger-reference")
        : kind === "bpmn-message-event" ? field("message-name")
          : kind === "bpmn-timer-event" ? field("timer-expression")
            : kind === "bpmn-error-event" ? field("error-code")
              : kind === "bpmn-signal-event" ? field("signal")
                : kind === "bpmn-boundary-event" ? field("event-definition")
                  : kind === "bpmn-terminate-event" ? field("reason")
                    : kind === "bpmn-end" ? field("outcome") : field("event-definition");
      return `${outer}${inner}${marker}${eventDetail && h >= 72 ? t(eventDetail, cx, y + h - 24, w - 8, Math.max(7, size * .6), "middle", 400) : ""}${t(rawTitle, cx, y + h - 8, w, Math.max(7, size * .64), "middle", 400)}`;
    }
    if (["bpmn-gateway", "bpmn-parallel-gateway", "bpmn-inclusive-gateway", "bpmn-event-gateway"].includes(kind)) { const side = Math.min(w, h - 12, 58); const cx = x + w / 2; const left = cx - side / 2; const cy = side / 2; const marks = kind === "bpmn-parallel-gateway" ? `M ${cx} ${y + side * .28} V ${y + side * .72} M ${cx - side * .22} ${y + cy} H ${cx + side * .22}` : kind === "bpmn-inclusive-gateway" ? `M ${cx} ${y + cy - side * .18} A ${side * .18} ${side * .18} 0 1 0 ${cx} ${y + cy + side * .18} A ${side * .18} ${side * .18} 0 1 0 ${cx} ${y + cy - side * .18}` : kind === "bpmn-event-gateway" ? `M ${cx} ${y + cy - side * .2} A ${side * .2} ${side * .2} 0 1 0 ${cx} ${y + cy + side * .2} A ${side * .2} ${side * .2} 0 1 0 ${cx} ${y + cy - side * .2} M ${cx} ${y + cy - side * .14} A ${side * .14} ${side * .14} 0 1 0 ${cx} ${y + cy + side * .14} A ${side * .14} ${side * .14} 0 1 0 ${cx} ${y + cy - side * .14}` : `M ${cx - side * .16} ${y + side * .34} L ${cx + side * .16} ${y + side * .66} M ${cx + side * .16} ${y + side * .34} L ${cx - side * .16} ${y + side * .66}`; return `<path d="M ${cx} ${y} L ${cx + side / 2} ${y + cy} L ${cx} ${y + side} L ${left} ${y + cy} Z" fill="${cleanFill}" stroke="${ink}"/>${p(marks)}${t(rawTitle, cx, y + h - 8, w, Math.max(7, size * .58), "middle", 400)}`; }
    if (["bpmn-task", "bpmn-user-task", "bpmn-service-task", "bpmn-script-task", "bpmn-manual-task", "bpmn-business-rule-task", "bpmn-send-task", "bpmn-receive-task", "bpmn-call-activity"].includes(kind)) {
      const iconX = x + 14; const iconY = y + 14;
      const marker = kind === "bpmn-user-task" ? `<circle cx="${iconX + 5}" cy="${iconY + 4}" r="3" fill="none" stroke="${ink}"/><path d="M ${iconX} ${iconY + 16} H ${iconX + 10} M ${iconX + 5} ${iconY + 8} V ${iconY + 18}" stroke="${ink}"/>`
        : kind === "bpmn-service-task" ? `<circle cx="${iconX + 7}" cy="${iconY + 8}" r="6" fill="none" stroke="${ink}"/><path d="M ${iconX + 1} ${iconY + 8} H ${iconX + 13} M ${iconX + 7} ${iconY + 2} V ${iconY + 14}" stroke="${ink}"/>`
          : kind === "bpmn-script-task" ? `<rect x="${iconX}" y="${iconY}" width="13" height="17" fill="none" stroke="${ink}"/><path d="M ${iconX + 3} ${iconY + 5} H ${iconX + 10} M ${iconX + 3} ${iconY + 9} H ${iconX + 10} M ${iconX + 3} ${iconY + 13} H ${iconX + 8}" stroke="${ink}"/>`
            : kind === "bpmn-manual-task" ? `<path d="M ${iconX + 2} ${iconY + 18} L ${iconX + 3} ${iconY + 7} H ${iconX + 5} L ${iconX + 6} ${iconY + 14} L ${iconX + 7} ${iconY + 4} H ${iconX + 9} L ${iconX + 10} ${iconY + 14} L ${iconX + 11} ${iconY + 7} H ${iconX + 13} L ${iconX + 14} ${iconY + 17}" fill="none" stroke="${ink}"/>`
              : kind === "bpmn-business-rule-task" ? `<rect x="${iconX}" y="${iconY + 2}" width="16" height="14" fill="none" stroke="${ink}"/><path d="M ${iconX} ${iconY + 7} H ${iconX + 16} M ${iconX} ${iconY + 12} H ${iconX + 16} M ${iconX + 6} ${iconY + 2} V ${iconY + 16}" stroke="${ink}"/>`
                : kind === "bpmn-send-task" || kind === "bpmn-receive-task" ? `<rect x="${iconX}" y="${iconY + 3}" width="17" height="12" fill="none" stroke="${ink}"/><path d="M ${iconX} ${iconY + 3} L ${iconX + 8.5} ${iconY + 10} L ${iconX + 17} ${iconY + 3}" fill="none" stroke="${ink}"/>${kind === "bpmn-send-task" ? `<circle cx="${iconX + 8.5}" cy="${iconY + 9}" r="1.5" fill="${ink}"/>` : ""}` : "";
      const callBorder = kind === "bpmn-call-activity" ? r(x + 4, y + 4, w - 8, h - 8, "none") : "";
      const taskDescription = kind === "bpmn-user-task" ? field("assignee")
        : kind === "bpmn-service-task" ? field("operation")
          : kind === "bpmn-script-task" ? field("script-language")
            : kind === "bpmn-manual-task" ? field("instruction")
              : kind === "bpmn-business-rule-task" ? field("decision")
                : kind === "bpmn-send-task" || kind === "bpmn-receive-task" ? field("message")
                  : kind === "bpmn-call-activity" ? field("called-process") : field("activity");
      const taskPrefix = kind === "bpmn-user-task" ? "Assignee" : kind === "bpmn-service-task" ? "Operation" : kind === "bpmn-script-task" ? "Language" : kind === "bpmn-manual-task" ? "Instruction" : kind === "bpmn-business-rule-task" ? "Decision" : kind === "bpmn-send-task" ? "Send" : kind === "bpmn-receive-task" ? "Receive" : kind === "bpmn-call-activity" ? "Calls" : "Work";
      return `${r()}${callBorder}${marker}${t(rawTitle.toUpperCase(), x + w / 2, y + h * .59, w - 20, size, "middle")}${taskDescription ? t(`${taskPrefix}: ${taskDescription}`, x + w / 2, y + h * .84, w - 24, Math.max(7, size * .62), "middle", 400) : ""}`;
    }
    if (kind === "bpmn-subprocess") return `${r()}${t(rawTitle.toUpperCase(), x + w / 2, y + h * .36, w - 20, size, "middle")}${field("purpose") ? t(field("purpose"), x + w / 2, y + h * .59, w - 20, Math.max(7, size * .64), "middle", 400) : ""}${field("entry-condition") ? t(`Starts when: ${field("entry-condition")}`, x + w / 2, y + h * .78, w - 20, Math.max(7, size * .58), "middle", 400) : ""}${r(x + w / 2 - 6, y + h - 18, 12, 12, cleanFill)}${p(`M ${x + w / 2 - 3} ${y + h - 12} H ${x + w / 2 + 3} M ${x + w / 2} ${y + h - 15} V ${y + h - 9}`)}`;
    if (kind === "bpmn-data") return `${r()}${p(`M ${x + w - 18} ${y} L ${x + w - 18} ${y + 18} H ${x + w}`)}${t(rawTitle.toUpperCase(), x + w / 2, y + h * .38, w - 10, Math.max(8, size * .8), "middle")}${field("state") ? t(field("state"), x + w / 2, y + h * .59, w - 12, Math.max(7, size * .62), "middle", 400) : ""}${field("format") ? t(field("format"), x + w / 2, y + h * .75, w - 12, Math.max(7, size * .56), "middle", 400) : ""}`;
    if (kind === "bpmn-data-store") { const ry = Math.min(12, h * .16); return `<path d="M ${x} ${y + ry} C ${x} ${y - ry * .3} ${x + w} ${y - ry * .3} ${x + w} ${y + ry} V ${y + h - ry} C ${x + w} ${y + h + ry * .3} ${x} ${y + h + ry * .3} ${x} ${y + h - ry} Z" fill="${cleanFill}" stroke="${ink}"/><ellipse cx="${x + w / 2}" cy="${y + ry}" rx="${w / 2}" ry="${ry}" fill="${cleanFill}" stroke="${ink}"/>${t(rawTitle.toUpperCase(), x + w / 2, y + h * .42, w - 12, size, "middle")}${field("store") ? t(field("store"), x + w / 2, y + h * .62, w - 14, Math.max(7, size * .62), "middle", 400) : ""}${field("retention") ? t(`Retention: ${field("retention")}`, x + w / 2, y + h * .8, w - 14, Math.max(7, size * .56), "middle", 400) : ""}`; }
    if (kind === "bpmn-text-annotation") return `${p(`M ${x + 14} ${y} H ${x + 4} V ${y + h} H ${x + 14}`)}${t(rawTitle, x + 22, y + h / 2, w - 28, size, "start", 400)}`;
    if (kind === "bpmn-pool") return `${r()}${r(x, y, Math.min(34, w / 3), h, soft)}${p(`M ${x + 34} ${y + h / 2} H ${x + w}`)}${t("POOL", x + 17, y + h / 2, 30, Math.max(8, size * .55), "middle")}`;
    if (kind === "data-flow") return `${t(rawTitle.toUpperCase(), x + w / 2, y + 9, w, Math.max(8, size * .72), "middle")}${p(`M ${x + 4} ${y + h * .72} H ${x + w - 10} l -8 -5 m 8 5 l -8 5`)}`;
  }
  const provider = cloudProviderComponent(kind);
  if (provider) {
    const ink = meta.styleOverrides?.color ?? palette.ink;
    const iconSide = Math.max(24, Math.min(64, h - 32, w * .38)); const iconX = x + 12; const iconY = y + (h - iconSide) / 2 - 3; const copyX = iconX + iconSide + 10;
    const icon = meta.iconSvg && meta.iconViewBox ? `<svg x="${iconX}" y="${iconY}" width="${iconSide}" height="${iconSide}" viewBox="${meta.iconViewBox}" preserveAspectRatio="xMidYMid meet">${meta.iconSvg}</svg>` : `<rect x="${iconX}" y="${iconY}" width="${iconSide}" height="${iconSide}" fill="${palette.soft}" stroke="${edge}"/><text x="${iconX + iconSide / 2}" y="${iconY + iconSide / 2 + 4}" text-anchor="middle" fill="${ink}" font-family="sans-serif" font-size="12" font-weight="700">${xmlText(provider.glyph)}</text>`;
    const providerDetails = (meta.componentFields ?? []).filter(item => item.value.trim()).slice(0, 2);
    const detailMarkup = providerDetails.map((item, index) => {
      const value = `${item.label}: ${item.value}`;
      return `<text x="${copyX}" y="${y + h * (.78 + index * .12)}" fill="${palette.muted}" font-family="sans-serif" font-size="7"${fitTextAttribute(value, w - (copyX - x) - 10, 7)}>${xmlText(value)}</text>`;
    }).join("");
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${edge}" stroke-width="1.5"/>${icon}<text x="${copyX}" y="${y + h * .34}" fill="${ink}" font-family="sans-serif" font-size="${size}" font-weight="700"${fitTextAttribute(rawTitle, w - (copyX - x) - 10)}>${title}</text><text x="${copyX}" y="${y + h * .53}" fill="${palette.muted}" font-family="sans-serif" font-size="8"${fitTextAttribute(provider.provider.toUpperCase(), w - (copyX - x) - 10, 8)}>${xmlText(provider.provider.toUpperCase())}</text>${detailMarkup}`;
  }
  if (kind === "cloud-boundary") {
    const d = `M ${x + w * .15} ${y + h * .8} C ${x + w * .04} ${y + h * .8}, ${x + w * .015} ${y + h * .66}, ${x + w * .05} ${y + h * .56} C ${x + w * .08} ${y + h * .45}, ${x + w * .17} ${y + h * .42}, ${x + w * .25} ${y + h * .44} C ${x + w * .25} ${y + h * .22}, ${x + w * .4} ${y + h * .12}, ${x + w * .53} ${y + h * .23} C ${x + w * .66} ${y + h * .05}, ${x + w * .85} ${y + h * .12}, ${x + w * .87} ${y + h * .36} C ${x + w * .97} ${y + h * .38}, ${x + w * .99} ${y + h * .49}, ${x + w * .96} ${y + h * .59} C ${x + w * .99} ${y + h * .72}, ${x + w * .9} ${y + h * .81}, ${x + w * .81} ${y + h * .8} Z`;
    return `<path d="${d}" fill="${fill}" fill-opacity="${meta.styleOverrides?.fillOpacity ?? 1}" stroke="${edge}" stroke-width="2" stroke-dasharray="8 5"/><text x="${x + w * .24}" y="${y + h * .36}" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}" font-weight="700"${fitTextAttribute(rawTitle, w * .5)}>${title}</text><text x="${x + w * .24}" y="${y + h * .36 + size + 3}" fill="${palette.muted}" font-family="sans-serif" font-size="${Math.min(maxLabelSize, Math.max(6, size * .8))}"${fitTextAttribute("DEPLOYMENT BOUNDARY", w * .5, Math.min(maxLabelSize, size * .8))}>DEPLOYMENT BOUNDARY</text>`;
  }
  if (kind === "network-switch" || kind === "network-hub") {
    const count = Math.max(1, Math.min(32, Math.round(meta.portCount ?? (kind === "network-hub" ? 8 : 6))));
    const columns = Math.min(8, count); const rows = Math.ceil(count / columns); const cell = (w - 24) / columns;
    const heading = xmlText(rawTitle.toUpperCase());
    if (kind === "network-hub") {
      const rowHeight = Math.max(12, (h - 42) / rows);
      const ports = Array.from({ length: count }, (_, index) => {
        const col = index % columns; const row = Math.floor(index / columns); const cx = x + 12 + cell * (col + .5); const cy = y + 34 + rowHeight * (row + .5); const socketWidth = Math.max(4, Math.min(13, cell - 2)); const socketHeight = Math.max(4, Math.min(9, rowHeight * .55));
        return `<rect x="${cx - socketWidth / 2}" y="${cy - socketHeight / 2}" width="${socketWidth}" height="${socketHeight}" rx="${simple ? 0 : 2}" fill="${palette.fill}" stroke="${edge}"/><path d="M ${cx - 2} ${cy + socketHeight / 2 - 1} H ${cx + 2}" stroke="${palette.accent}"/>`;
      }).join("");
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${simple ? 0 : 7}" fill="${fill}" fill-opacity="${meta.styleOverrides?.fillOpacity ?? 1}" stroke="${edge}"/><rect x="${x + 1}" y="${y + 1}" width="${Math.max(0, w - 2)}" height="27" fill="${palette.soft}"/><text x="${x + 12}" y="${y + 17}" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}" font-weight="700"${fitTextAttribute("ETHERNET HUB", w - 24)}>ETHERNET HUB</text><circle cx="${x + w - 15}" cy="${y + 14}" r="3" fill="${palette.accent}"/><path d="M ${x + 9} ${y + 31} H ${x + w - 9}" stroke="${edge}"/>${ports}<text x="${x + 12}" y="${y + h - 8}" fill="${palette.muted}" font-family="sans-serif" font-size="8">${count} PORT${count === 1 ? "" : "S"} · REPEATER</text>`;
    }
    const ports = Array.from({ length: count }, (_, index) => {
      const col = index % columns; const row = Math.floor(index / columns); const cx = x + 12 + cell * (col + .5); const cy = y + 32 + row * 18;
      return `<rect x="${cx - Math.min(7, cell * .35)}" y="${cy - 5}" width="${Math.min(14, cell * .7)}" height="10" rx="2.5" fill="${fill}" stroke="${edge}"/><circle cx="${cx}" cy="${cy + 8}" r="1.4" fill="${palette.accent}"/>`;
    }).join("");
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="11" fill="${fill}" fill-opacity="${meta.styleOverrides?.fillOpacity ?? 1}" stroke="${edge}"/><text x="${x + 14}" y="${y + 15}" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}" font-weight="700"${fitTextAttribute(rawTitle.toUpperCase(), w - 28)}>${heading}</text>${ports}`;
  }
  const box = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${simple ? 0 : 12}" fill="${fill}" fill-opacity="${meta.styleOverrides?.fillOpacity ?? 1}" stroke="${edge}" stroke-width="1.5"/>`;
  const label = `<text x="${x + w / 2}" y="${y + Math.min(20, h * .2)}" text-anchor="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}" font-weight="700"${fitTextAttribute(rawTitle, w - 24)}>${title}</text>`;
  if (kind === "network-server") {
    const rows = Math.max(2, Math.min(4, Math.floor((h - 22) / 23))); const rowHeight = (h - 26) / rows;
    return `${box}${label}${Array.from({ length: rows }, (_, index) => { const yy = y + 25 + index * rowHeight; return `<rect x="${x + 10}" y="${yy}" width="${w - 20}" height="${rowHeight - 5}" rx="4" fill="${palette.soft}" stroke="${edge}"/><circle cx="${x + 20}" cy="${yy + (rowHeight - 5) / 2}" r="2.4" fill="${palette.accent}"/>`; }).join("")}`;
  }
  if (kind === "network-firewall") return `${box}${label}<path d="M ${x + 9} ${y + h * .48} H ${x + w - 9} M ${x + 9} ${y + h * .68} H ${x + w - 9} M ${x + w * .33} ${y + h * .27} V ${y + h * .48} M ${x + w * .67} ${y + h * .48} V ${y + h * .68} M ${x + w * .48} ${y + h * .68} V ${y + h - 8}" fill="none" stroke="${edge}"/>`;
  if (kind === "network-client") return `<rect x="${x + w * .1}" y="${y + h * .24}" width="${w * .8}" height="${h * .55}" rx="5" fill="${palette.soft}" stroke="${edge}"/><path d="M ${x + w * .36} ${y + h * .88} H ${x + w * .64} M ${x + w / 2} ${y + h * .79} V ${y + h * .88}" stroke="${edge}"/>${label}`;
  if (kind === "network-router" || kind === "network-access-point" || kind === "network-load-balancer") {
    const cx = x + w / 2; const cy = y + h * .62;
    if (kind === "network-router") return `${box}${label}<path d="M ${x + w * .28} ${cy} H ${x + w * .72} M ${cx} ${cy - h * .16} V ${cy + h * .16} M ${cx - 5} ${cy + h * .1} L ${cx} ${cy + h * .16} L ${cx + 5} ${cy + h * .1}" fill="none" stroke="${edge}" stroke-width="1.5"/>`;
    if (kind === "network-access-point") {
      const diameter = Math.min(w * .42, h * .46); const radius = diameter / 2; const cy = y + h * .34; const surface = fill === "transparent" ? palette.fill : fill;
      const glyph = `<path d="M ${cx - radius * .31} ${cy - radius * .03} Q ${cx} ${cy - radius * .56} ${cx + radius * .31} ${cy - radius * .03} M ${cx - radius * .17} ${cy + radius * .12} Q ${cx} ${cy - radius * .16} ${cx + radius * .17} ${cy + radius * .12}" fill="none" stroke="${palette.accent}" stroke-width="${strokeWidth}" stroke-linecap="round"/><circle cx="${cx}" cy="${cy + radius * .26}" r="${Math.max(1.5, radius * .06)}" fill="${palette.accent}"/>`;
      const leds = [-.18, 0, .18].map(offset => `<circle cx="${cx + radius * offset * 3}" cy="${cy + radius * .62}" r="${Math.max(1.2, radius * .045)}" fill="${palette.accent}"/>`).join("");
      const ssid = field("ssid"); const security = field("security-mode"); const channel = field("channel");
      const identity = ssid ? `<text x="${cx}" y="${y + h * .72}" text-anchor="middle" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${Math.max(7, size * .58)}" font-weight="650"${fitTextAttribute(ssid, w - 12, Math.max(7, size * .58))}>${xmlText(ssid)}</text>` : "";
      const radio = security || channel ? `${xmlText(security)}${security && channel ? " · " : ""}${xmlText(channel)}` : "";
      const settings = radio ? `<text x="${cx}" y="${y + h * .88}" text-anchor="middle" dominant-baseline="middle" fill="${palette.muted}" font-family="sans-serif" font-size="${Math.max(6, size * .48)}"${fitTextAttribute([security, channel].filter(Boolean).join(" · "), w - 12, Math.max(6, size * .48))}>${radio}</text>` : "";
      const heading = `<text x="${cx}" y="${y + 12}" text-anchor="middle" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${Math.max(7, size * .68)}" font-weight="700"${fitTextAttribute(rawTitle.toUpperCase(), w - 8, Math.max(7, size * .68))}>${xmlText(rawTitle.toUpperCase())}</text>`;
      return `${heading}<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${palette.soft}" stroke="${edge}" stroke-width="${strokeWidth}"/><circle cx="${cx}" cy="${cy}" r="${radius * .78}" fill="${surface}" stroke="${edge}" stroke-width="${1}"/>${glyph}${leds}${identity}${settings}`;
    }
    return `${box}${label}<circle cx="${cx}" cy="${cy - 8}" r="10" fill="${palette.soft}" stroke="${edge}"/><path d="M ${cx} ${cy + 2} L ${x + w * .25} ${y + h * .83} M ${cx} ${cy + 2} L ${cx} ${y + h * .83} M ${cx} ${cy + 2} L ${x + w * .75} ${y + h * .83}" stroke="${edge}"/><circle cx="${x + w * .25}" cy="${y + h * .83}" r="4" fill="${palette.accent}"/><circle cx="${cx}" cy="${y + h * .83}" r="4" fill="${palette.accent}"/><circle cx="${x + w * .75}" cy="${y + h * .83}" r="4" fill="${palette.accent}"/>`;
  }
  if (kind === "network-zone" || kind === "c4-system" || kind === "c4-container") return `<rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" rx="12" fill="${fill}" fill-opacity="${meta.styleOverrides?.fillOpacity ?? 1}" stroke="${edge}" stroke-dasharray="6 4"/>${label}<rect x="${x + 16}" y="${y + 35}" width="${w * .34}" height="${h * .42}" rx="7" fill="${palette.soft}" stroke="${edge}"/><rect x="${x + w * .58}" y="${y + 35}" width="${w * .28}" height="${h * .2}" rx="6" fill="${palette.soft}" stroke="${edge}"/><rect x="${x + w * .58}" y="${y + h * .61}" width="${w * .28}" height="${h * .2}" rx="6" fill="${palette.soft}" stroke="${edge}"/>`;
  if (kind === "software-database" || kind === "cloud-database") { const left = x + w * .08; const right = x + w * .92; const ry = 10; const body = `<path d="M ${left} ${y + ry} V ${y + h - ry} A ${w * .42} ${ry} 0 0 1 ${right} ${y + h - ry} V ${y + ry} Z" fill="${fill}" stroke="${edge}"/>`; const top = `<ellipse cx="${x + w / 2}" cy="${y + 12}" rx="${w * .42}" ry="10" fill="${fill}" stroke="${edge}"/>`; const rim = `<path d="M ${left} ${y + h * .48} C ${left} ${y + h * .61}, ${right} ${y + h * .61}, ${right} ${y + h * .48}" fill="none" stroke="${edge}"/>`; return `${body}${top}${rim}${label}`; }
  if (kind === "software-queue" || kind === "cloud-queue") return `${box}${label}${[0, 1, 2].map(index => `<rect x="${x + 12 + index * ((w - 34) / 3 + 5)}" y="${y + h * .48}" width="${(w - 34) / 3}" height="${h * .27}" rx="5" fill="${palette.soft}" stroke="${edge}"/>`).join("")}`;
  if (kind.startsWith("er-") && kind !== "er-table") {
    const erEdge = meta.styleOverrides?.color ?? "#000000"; const erFill = meta.styleOverrides?.fillColor === null ? "none" : meta.styleOverrides?.fillColor ?? "#ffffff";
    const text = (value: string, tx: number, ty: number, width = w - 14, font = size) => `<text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="middle" fill="${erEdge}" font-family="sans-serif" font-size="${font}"${fitTextAttribute(value, width, font)}>${xmlText(value)}</text>`;
    if (["er-entity", "er-weak-entity", "er-associative-entity"].includes(kind)) {
      const inset = kind === "er-weak-entity" ? 6 : 0; const outer = `<rect x="${x + inset}" y="${y + inset}" width="${w - inset * 2}" height="${h - inset * 2}" fill="${erFill}" stroke="${erEdge}"/>`;
      const inner = kind === "er-weak-entity" ? `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" fill="none" stroke="${erEdge}"/>` : "";
      const badge = kind === "er-associative-entity" ? `<path d="M ${x + w / 2} ${y + 2} l10 10-10 10-10-10Z" fill="${erFill}" stroke="${erEdge}"/>` : "";
      const titleLine = text(rawTitle, x + w / 2, y + 17, w - 16);
      if (kind === "er-weak-entity") return `${outer}${inner}${badge}${titleLine}${field("owner") ? text(`Owner: ${field("owner")}`, x + w / 2, y + 37, w - 18, Math.max(7, size * .62)) : ""}${field("partial-key") ? text(`Key: ${field("partial-key")}`, x + w / 2, y + 56, w - 18, Math.max(7, size * .62)) : ""}`;
      if (kind === "er-associative-entity") {
        const participants = [field("first-entity"), field("second-entity")].filter(Boolean).join(" / ");
        return `${outer}${inner}${badge}${titleLine}${participants ? text(participants, x + w / 2, y + 42, w - 18, Math.max(7, size * .64)) : ""}${field("association-key") ? text(`Key: ${field("association-key")}`, x + w / 2, y + 65, w - 18, Math.max(7, size * .6)) : ""}`;
      }
      const attributes = field("attributes").split(/\r?\n/).filter(Boolean);
      return `${outer}${inner}${badge}${titleLine}${field("identifier") ? text(`PK ${field("identifier")}`, x + w / 2, y + 38, w - 18, Math.max(7, size * .64)) : ""}${attributes.slice(0, 2).map((attribute, index) => text(attribute, x + w / 2, y + 56 + index * 14, w - 18, Math.max(7, size * .62))).join("")}`;
    }
    if (kind === "er-relationship" || kind === "er-identifying-relationship") {
      const diamond = `<path d="M ${x + w / 2} ${y} L ${x + w} ${y + h / 2} L ${x + w / 2} ${y + h} L ${x} ${y + h / 2} Z" fill="${erFill}" stroke="${erEdge}"/>`;
      const inner = kind === "er-identifying-relationship" ? `<path d="M ${x + w / 2} ${y + 7} L ${x + w - 8} ${y + h / 2} L ${x + w / 2} ${y + h - 7} L ${x + 8} ${y + h / 2} Z" fill="none" stroke="${erEdge}"/>` : "";
      const sourceRole = field(kind === "er-identifying-relationship" ? "owner-role" : "source-role");
      const targetRole = field(kind === "er-identifying-relationship" ? "dependent-role" : "target-role");
      return `${diamond}${inner}${text(rawTitle, x + w / 2, y + h * .42, w * .62)}${sourceRole || targetRole ? text(`${sourceRole || "?"} - ${targetRole || "?"}`, x + w / 2, y + h * .66, w * .48, Math.max(6, size * .6)) : ""}`;
    }
    if (kind.includes("attribute")) {
      const double = kind === "er-multivalued-attribute"; const radii = attributeRadii(w, h, 1.4, double); const dash = kind === "er-derived-attribute" || kind === "er-partial-key-attribute" ? ` stroke-dasharray="4 3"` : "";
      const ellipse = `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${radii.innerX}" ry="${radii.innerY}" fill="${erFill}" stroke="${erEdge}"${dash}/>`;
      const outer = double ? `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${radii.outerX}" ry="${radii.outerY}" fill="none" stroke="${erEdge}"/>` : "";
      const label = text(rawTitle, x + w / 2, y + h * .42, w * .72); const underline = kind === "er-key-attribute" || kind === "er-partial-key-attribute" ? `<path d="M ${x + w * .28} ${y + h * .51} H ${x + w * .72}" stroke="${erEdge}"/>` : "";
      const type = field(kind === "er-multivalued-attribute" ? "element-type" : kind === "er-derived-attribute" ? "expression" : "data-type");
      return `${ellipse}${outer}${label}${underline}${type ? text(type, x + w / 2, y + h * .7, w * .7, Math.max(7, size * .6)) : ""}`;
    }
    if (kind === "er-composite-attribute") {
      const parent = text(rawTitle, x + w / 2, y + h * .22); const first = meta.componentFields?.find(field => field.key === "sub-attribute-1")?.value ?? "Attribute 1"; const second = meta.componentFields?.find(field => field.key === "sub-attribute-2")?.value ?? "Attribute 2";
      return `<path d="M ${x + w / 2} ${y + h * .38} L ${x + w * .25} ${y + h * .61} M ${x + w / 2} ${y + h * .38} L ${x + w * .75} ${y + h * .61}" stroke="${erEdge}"/><ellipse cx="${x + w / 2}" cy="${y + h * .22}" rx="${w * .18}" ry="${h * .16}" fill="${erFill}" stroke="${erEdge}"/><ellipse cx="${x + w * .25}" cy="${y + h * .77}" rx="${w * .22}" ry="${h * .16}" fill="${erFill}" stroke="${erEdge}"/><ellipse cx="${x + w * .75}" cy="${y + h * .77}" rx="${w * .22}" ry="${h * .16}" fill="${erFill}" stroke="${erEdge}"/>${parent}${text(first, x + w * .25, y + h * .77, w * .34)}${text(second, x + w * .75, y + h * .77, w * .34)}`;
    }
  }
  if (kind === "uml-package") { const tabW = Math.min(w * .42, 86); const tabH = Math.min(22, h * .22); return `<path d="M ${x} ${y + tabH} L ${x} ${y + 2} L ${x + tabW} ${y + 2} L ${x + tabW + 12} ${y + tabH} L ${x + w - 2} ${y + tabH} L ${x + w - 2} ${y + h - 2} L ${x + 2} ${y + h - 2} Z" fill="${fill}" stroke="${edge}" stroke-width="1.3"/><text x="${x + w / 2}" y="${y + tabH + h * .35}" text-anchor="middle" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}"${fitTextAttribute(rawTitle, w - 24)}>${title}</text>`; }
  if (kind === "uml-actor") { const cx = x + w / 2; const figureWidth = Math.min(58, w * .72); const head = Math.min(12, h * .11); return `<circle cx="${cx}" cy="${y + head + 3}" r="${head}" fill="${fill}" stroke="${edge}"/><path d="M ${cx} ${y + head * 2 + 3} V ${y + h * .62} M ${cx - figureWidth * .38} ${y + h * .4} H ${cx + figureWidth * .38} M ${cx} ${y + h * .62} L ${cx - figureWidth * .3} ${y + h * .74} M ${cx} ${y + h * .62} L ${cx + figureWidth * .3} ${y + h * .74}" fill="none" stroke="${edge}"/><text x="${cx}" y="${y + h * .9}" text-anchor="middle" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}"${fitTextAttribute(rawTitle, w - 8)}>${title}</text>`; }
  if (kind === "uml-use-case") return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2 - .65}" ry="${h / 2 - .65}" fill="${fill}" stroke="${edge}"/><text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}"${fitTextAttribute(rawTitle, w * .84)}>${title}</text>`;
  if (kind === "uml-lifeline") return `<rect x="${x}" y="${y}" width="${w}" height="${Math.min(34, h)}" rx="${simple ? 0 : 8}" fill="${fill}" fill-opacity="${meta.styleOverrides?.fillOpacity ?? 1}" stroke="${edge}"/><text x="${x + w / 2}" y="${y + 17}" text-anchor="middle" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}" font-weight="700">${title}</text><path d="M ${x + w / 2} ${y + 34} V ${y + h}" stroke="${edge}" stroke-dasharray="6 5"/>`;
  if (kind === "uml-activation") return `<rect x="${x + .65}" y="${y}" width="${Math.max(1, w - 1.3)}" height="${h}" fill="${palette.soft}" stroke="${edge}"/>`;
  if (kind === "sequence-sync" || kind === "sequence-async" || kind.startsWith("uml-") && ["uml-inheritance", "uml-realization", "uml-aggregation", "uml-composition", "uml-association", "uml-dependency", "uml-include", "uml-extend"].includes(kind) || kind.startsWith("er-one-") || kind === "er-many-one" || kind === "er-many-many" || kind === "data-flow") {
    const yy = y + h / 2; const diamond = kind === "uml-aggregation" || kind === "uml-composition"; const dashed = ["uml-realization", "uml-dependency", "uml-include", "uml-extend"].includes(kind) ? " stroke-dasharray=\"5 4\"" : "";
    const relation = `<path d="M ${x + (diamond ? 25 : 6)} ${yy} H ${x + w - 9}" fill="none" stroke="${edge}"${dashed}/>`;
    const head = kind.startsWith("sequence-") || kind === "uml-inheritance" || kind === "uml-realization" || kind === "uml-dependency" || kind === "uml-include" || kind === "uml-extend" || kind === "data-flow" ? `<path d="M ${x + w - 19} ${yy - 8} L ${x + w - 8} ${yy} L ${x + w - 19} ${yy + 8} ${kind === "sequence-sync" || kind === "uml-inheritance" || kind === "uml-realization" ? "Z" : ""}" fill="${kind === "sequence-sync" ? edge : kind === "uml-inheritance" || kind === "uml-realization" ? fill : "none"}" stroke="${edge}"/>` : "";
    const diamondMark = diamond ? `<path d="M ${x + 7} ${yy} l9-6 9 6-9 6 Z" fill="${kind === "uml-composition" ? edge : fill}" stroke="${edge}"/>` : "";
    const one = (px: number) => `<path d="M ${px} ${yy - 8} V ${yy + 8}" stroke="${edge}"/>`;
    const crow = (px: number, direction: number) => `<path d="M ${px} ${yy} l${direction * 12} -8 M ${px} ${yy} h${direction * 12} M ${px} ${yy} l${direction * 12} 8" stroke="${edge}"/>`;
    const cardinality = kind.startsWith("er-one-") || kind === "er-many-one" || kind === "er-many-many"
      ? `${kind === "er-many-one" || kind === "er-many-many" ? crow(x + 8, 1) : one(x + 8)}${kind === "er-one-many" || kind === "er-many-many" ? crow(x + w - 8, -1) : one(x + w - 8)}` : "";
    const stereotypeText = kind === "uml-include" ? "<<include>>" : "<<extend>>";
    const stereotype = kind === "uml-include" || kind === "uml-extend" ? `<text x="${x + w / 2}" y="${y + 9}" text-anchor="middle" dominant-baseline="middle" fill="${palette.muted}" font-family="sans-serif" font-size="${Math.max(8, size * .7)}">${xmlText(stereotypeText)}</text>` : "";
    return `${relation}${head}${diamondMark}${cardinality}${stereotype}`;
  }
  if (kind === "bpmn-start" || kind === "bpmn-event" || kind === "bpmn-end") return `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${Math.min(w, h) * .44}" fill="${fill}" stroke="${edge}" stroke-width="${kind === "bpmn-end" ? 3 : 1.5}"/>${kind === "bpmn-event" ? `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${Math.min(w, h) * .34}" fill="none" stroke="${edge}"/>` : ""}`;
  if (kind === "bpmn-gateway" || kind === "bpmn-parallel-gateway") { const marks = kind === "bpmn-parallel-gateway" ? `M ${x + w / 2} ${y + h * .3} V ${y + h * .7} M ${x + w * .3} ${y + h / 2} H ${x + w * .7}` : `M ${x + w * .34} ${y + h * .34} L ${x + w * .66} ${y + h * .66} M ${x + w * .66} ${y + h * .34} L ${x + w * .34} ${y + h * .66}`; return `<path d="M ${x + w / 2} ${y} L ${x + w} ${y + h / 2} L ${x + w / 2} ${y + h} L ${x} ${y + h / 2} Z" fill="${fill}" stroke="${edge}"/><path d="${marks}" stroke="${edge}"/>`; }
  if (kind === "bpmn-task" || kind === "bpmn-pool" || kind === "bpmn-data") return `${box}${label}${kind === "bpmn-pool" ? `<path d="M ${x + 31} ${y} V ${y + h} M ${x + 31} ${y + h / 2} H ${x + w}" stroke="${edge}"/>` : ""}`;
  if (kind === "uml-class" || kind === "uml-interface" || kind === "er-table") {
    const headerH = kind === "er-table" ? Math.min(34, h * .23) : Math.min(36, h * .28);
    const headingY = kind === "uml-interface" ? y + 31 : y + headerH / 2;
    const headingText = `<text x="${x + 12}" y="${headingY}" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}" font-weight="700"${fitTextAttribute(rawTitle, w - 24)}>${title}</text>`;
    const stereotype = kind === "uml-interface" ? `<text x="${x + 12}" y="${y + 12}" dominant-baseline="middle" fill="${palette.muted}" font-family="sans-serif" font-size="${Math.max(7, size * .66)}">&lt;&lt;interface&gt;&gt;</text>` : "";
    const lines = (value: string, top: number, maxLines: number) => value.split(/\r?\n/).filter(Boolean).slice(0, maxLines).map((line, index) => `<text x="${x + 12}" y="${top + 11 + index * 14}" dominant-baseline="middle" fill="${palette.ink}" font-family="sans-serif" font-size="${Math.max(7, size * .72)}">${fitXmlText(line, w - 24)}</text>`).join("");
    const field = (key: string) => meta.componentFields?.find(value => value.key === key)?.value ?? "";
    const header = `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${headerH}" rx="8" fill="${palette.soft}"/>`;
    if (kind === "uml-class") {
      const divider = y + headerH + (h - headerH) * .49;
      return `${box}${header}${headingText}<path d="M ${x} ${y + headerH} H ${x + w} M ${x} ${divider} H ${x + w}" stroke="${edge}"/>${lines(field("attributes"), y + headerH + 5, Math.max(1, Math.floor((divider - y - headerH - 8) / 14)))}${lines(field("methods"), divider + 5, Math.max(1, Math.floor((y + h - divider - 8) / 14)))}`;
    }
    if (kind === "uml-interface") return `${box}${header}${stereotype}${headingText}<path d="M ${x} ${y + headerH} H ${x + w} M ${x} ${y + h * .46} H ${x + w}" stroke="${edge}"/>${lines(field("operations"), y + h * .46 + 4, Math.max(1, Math.floor((h * .54 - 8) / 14)))}`;
    const rowHeight = (h - headerH) / 3;
    return `${box}${header}${headingText}<path d="M ${x} ${y + headerH} H ${x + w} M ${x} ${y + headerH + rowHeight} H ${x + w} M ${x} ${y + headerH + rowHeight * 2} H ${x + w}" stroke="${edge}"/>${["column-1", "column-2", "column-3"].map((key, index) => lines(field(key), y + headerH + rowHeight * index + 2, Math.max(1, Math.floor((rowHeight - 4) / 14)))).join("")}`;
  }
  return `${box}${label}`;
}

/** Keeps component text formatting consistent when the vector renderer exports its dynamic labels. */
export function modelComponentSvg(group: GroupElement, theme: Theme = "light", allElements?: readonly Element[]) {
  // Nested decorations can be wider than an imported or tightly resized symbol.
  // Keep their SVG geometry valid without changing the saved component bounds.
  let svg = renderModelComponentSvg(group, theme, allElements).replace(/<(?:circle|ellipse|rect)\b[^>]*>/g, tag =>
    tag.replace(/\b(r|rx|ry|width|height)="(-(?:\d|\.)[^"]*)"/g, (_attribute, name: string) => `${name}="0"`));
  const style = group.libraryComponent?.textStyle;
  if (!svg) return svg;
  if (style) {
  const family = componentFontFamily(style.fontFamily);
  svg = svg.replace(/<text\b([^>]*)>/g, (_match, rawAttributes: string) => {
    let attributes = rawAttributes;
    const replace = (name: string, value: string) => {
      const pattern = new RegExp(`\\b${name}="[^"]*"`);
      attributes = pattern.test(attributes) ? attributes.replace(pattern, `${name}="${value}"`) : `${attributes} ${name}="${value}"`;
    };
    if (style.color) replace("fill", style.color);
    if (style.fontFamily) replace("font-family", family);
    if (style.bold !== undefined) replace("font-weight", style.bold ? "700" : "400");
    if (style.italic !== undefined) replace("font-style", style.italic ? "italic" : "normal");
    if (style.underline !== undefined) replace("text-decoration", style.underline ? "underline" : "none");
    return `<text${attributes}>`;
  });
  }
  const palette = paletteFor(theme === "dark");
  const colorTokens = new Map<string, string>([
    ["#000000", palette.ink], ["#252a2e", palette.ink], ["#27313a", palette.ink], ["#292929", palette.ink],
    ["#46525b", palette.accent], ["#6f777e", palette.edge], ["#737b82", palette.muted], ["#6d7883", palette.muted], ["#bdc8d0", palette.edge],
    ["#ffffff", palette.fill], ["#fff", palette.fill], ["#edf0f2", palette.soft], ["#eeeeee", palette.soft], ["#f2f5f8", palette.soft], ["#d3dbe3", palette.soft], ["#d9e2eb", palette.soft], ["#eaf1fb", palette.soft],
    ["#0078d4", componentThemeToken("--diagram-accent-blue", palette.accent)], ["#376fca", componentThemeToken("--diagram-accent-blue", palette.accent)], ["#326ce5", componentThemeToken("--diagram-accent-blue", palette.accent)], ["#4285f4", componentThemeToken("--diagram-accent-blue", palette.accent)], ["#ed8b00", componentThemeToken("--diagram-accent-warm", palette.accent)],
  ]);
  const explicitColors = new Set([style?.color?.toLowerCase(), group.libraryComponent?.styleOverrides?.color?.toLowerCase(), group.libraryComponent?.styleOverrides?.fillColor?.toLowerCase()]);
  svg = svg.replace(/\b(fill|stroke|color)="(#[\da-fA-F]{3,8})"/g, (attribute, colorAttribute: string, color: string) => {
    const lower = color.toLowerCase();
    if (explicitColors.has(lower)) return attribute;
    const token = colorTokens.get(lower);
    return token ? `${colorAttribute}="${token}"` : attribute;
  });
  svg = normalizeComponentSvgText(svg, style?.fontFamily);
  return svg.replace(/\bstroke-width="([\d.]+)"/g, (_match, rawWidth: string) => {
    const width = Number(rawWidth); const standard = [1, 1.5, 2].reduce((best, current) => Math.abs(current - width) < Math.abs(best - width) ? current : best, 1);
    return `stroke-width="${standard}"`;
  });
}

const componentIconImages = new Map<string, HTMLImageElement>();
const COMPONENT_ARTWORK_CELL = 64;
const MAX_COMPONENT_ARTWORK_SPRITES = 512;
type ComponentArtworkSprite = { signature: string; canvas: HTMLCanvasElement; cells: Map<string, { x: number; y: number }> };
let componentArtworkSprite: ComponentArtworkSprite | undefined;
let componentArtworkPreload: { signature: string; promise: Promise<void> } | undefined;

function componentIconDataUrl(group: GroupElement): string | undefined {
  const data = group.libraryComponent;
  if (!data?.iconSvg || !data.iconViewBox) return undefined;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${data.iconViewBox}">${data.iconSvg}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function drawProviderArtwork(ctx: CanvasRenderingContext2D, group: GroupElement, x: number, y: number, size: number, background: string, stroke: string) {
  const url = componentIconDataUrl(group);
  if (url && componentArtworkSprite?.cells.has(url)) {
    const cell = componentArtworkSprite.cells.get(url)!;
    ctx.drawImage(componentArtworkSprite.canvas, cell.x, cell.y, COMPONENT_ARTWORK_CELL, COMPONENT_ARTWORK_CELL, x, y, size, size);
    return;
  }
  const image = url ? componentIconImages.get(url) : undefined;
  if (image?.complete && image.naturalWidth > 0) {
    const [, , sourceW, sourceH] = (group.libraryComponent?.iconViewBox ?? "0 0 1 1").split(/\s+/).map(Number);
    const ratio = sourceW > 0 && sourceH > 0 ? sourceW / sourceH : image.naturalWidth / image.naturalHeight;
    const drawW = size * Math.min(1, ratio); const drawH = size * Math.min(1, 1 / ratio);
    ctx.drawImage(image, x + (size - drawW) / 2, y + (size - drawH) / 2, drawW, drawH);
    return;
  }
  // Keep the placeholder shape stable while local artwork is decoded.
  ctx.fillStyle = background; ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = stroke; ctx.lineWidth = 1; strokeRectAligned(ctx, x, y, size, size);
}

/** Decodes local provider artwork once and packs it into a small reusable canvas sprite. */
export function preloadComponentArtwork(elements: Element[], onReady?: () => void) {
  const urls = new Set<string>();
  const visit = (items: Element[]) => items.forEach(item => {
    if (item.type !== "group") return;
    if (item.libraryComponent?.iconSvg && item.libraryComponent.iconViewBox) {
      const url = componentIconDataUrl(item);
      if (url) { urls.add(url); cacheComponentIconImage(item); }
    }
    visit(item.elements);
  });
  visit(elements);
  const mobileLimit = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches ? 64 : MAX_COMPONENT_ARTWORK_SPRITES;
  const ordered = [...urls].sort().slice(0, mobileLimit);
  const signature = shortHash(ordered.join("\u0000"));
  if (componentArtworkSprite?.signature === signature) { onReady?.(); return; }
  if (componentArtworkPreload?.signature === signature) { void componentArtworkPreload.promise.then(() => onReady?.()); return; }
  const promise = Promise.all(ordered.map(url => new Promise<void>(resolve => {
    const image = componentIconImages.get(url);
    if (!image || image.complete) { resolve(); return; }
    const done = () => resolve();
    image.addEventListener("load", done, { once: true }); image.addEventListener("error", done, { once: true });
  }))).then(() => {
    const loaded = ordered.filter(url => {
      const image = componentIconImages.get(url);
      return !!image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
    });
    if (!loaded.length || typeof document === "undefined") { componentArtworkSprite = undefined; return; }
    const columns = Math.min(8, loaded.length); const rows = Math.ceil(loaded.length / columns);
    const canvas = document.createElement("canvas"); canvas.width = columns * COMPONENT_ARTWORK_CELL; canvas.height = rows * COMPONENT_ARTWORK_CELL;
    const context = canvas.getContext("2d"); if (!context) { componentArtworkSprite = undefined; return; }
    const cells = new Map<string, { x: number; y: number }>();
    loaded.forEach((url, index) => {
      const image = componentIconImages.get(url)!; const x = index % columns * COMPONENT_ARTWORK_CELL; const y = Math.floor(index / columns) * COMPONENT_ARTWORK_CELL;
      const scale = Math.min(COMPONENT_ARTWORK_CELL / image.naturalWidth, COMPONENT_ARTWORK_CELL / image.naturalHeight);
      const width = image.naturalWidth * scale; const height = image.naturalHeight * scale;
      context.drawImage(image, x + (COMPONENT_ARTWORK_CELL - width) / 2, y + (COMPONENT_ARTWORK_CELL - height) / 2, width, height);
      cells.set(url, { x, y });
    });
    if (componentArtworkPreload?.signature === signature) componentArtworkSprite = { signature, canvas, cells };
  });
  componentArtworkPreload = { signature, promise };
  void promise.then(() => { if (componentArtworkPreload?.signature === signature) onReady?.(); });
}

export function cacheComponentIconImage(group: GroupElement, onLoad?: () => void): HTMLImageElement | undefined {
  const url = componentIconDataUrl(group);
  if (!url) return undefined;
  let image = componentIconImages.get(url);
  if (!image) {
    image = new Image();
    image.onload = () => onLoad?.();
    image.src = url;
    componentIconImages.set(url, image);
  }
  return image;
}
