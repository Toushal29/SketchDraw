import type { GroupElement, Theme } from "../../model";
import { cloudProviderComponent } from "../diagrams/cloud-providers";

type Palette = { ink: string; edge: string; fill: string; soft: string; muted: string; accent: string };
const paletteFor = (kind: string, dark: boolean, simple = false): Palette => {
  if (simple) return dark
    ? { ink: "#f0f1f2", edge: "#aab1b8", fill: "#25282b", soft: "#3a3f44", muted: "#c0c5c9", accent: "#d6dadd" }
    : { ink: "#252a2e", edge: "#6f777e", fill: "#ffffff", soft: "#edf0f2", muted: "#737b82", accent: "#46525b" };
  const provider = cloudProviderComponent(kind);
  if (provider) return dark
    ? { ink: "#f0f1f2", edge: provider.accent, fill: "#25282b", soft: "#3a3f44", muted: "#c0c5c9", accent: provider.accent }
    : { ink: "#252a2e", edge: provider.accent, fill: "#ffffff", soft: "#f3f5f6", muted: "#737b82", accent: provider.accent };
  if (kind.startsWith("network-")) return dark ? { ink: "#d5f1ef", edge: "#58a6a4", fill: "#1d3437", soft: "#29494b", muted: "#9dbab9", accent: "#66c7ac" } : { ink: "#245c61", edge: "#72aeb0", fill: "#f1fbfa", soft: "#dff2f0", muted: "#678b8d", accent: "#399c84" };
  if (kind.startsWith("cloud-") || kind.startsWith("software-") || kind.startsWith("c4-") || kind === "network-zone") return dark ? { ink: "#d9e8fa", edge: "#8299b1", fill: "#222e3a", soft: "#304155", muted: "#a5b1bf", accent: "#78a7dc" } : { ink: "#334b63", edge: "#a0b2c3", fill: "#f9fbfd", soft: "#eaf1f8", muted: "#728195", accent: "#4e83b4" };
  if (kind.startsWith("bpmn-")) return dark ? { ink: "#f2deba", edge: "#bb9859", fill: "#352d1f", soft: "#49391f", muted: "#c7b18a", accent: "#d7a650" } : { ink: "#76551e", edge: "#c9a35f", fill: "#fffaf0", soft: "#f7edd7", muted: "#9a8155", accent: "#bb8735" };
  if (kind.startsWith("uml-") || kind.startsWith("sequence-") || kind.startsWith("er-")) return dark ? { ink: "#e4dcff", edge: "#a99aca", fill: "#2d293a", soft: "#3c3550", muted: "#b5aacd", accent: "#ae95e8" } : { ink: "#56477f", edge: "#a99bc8", fill: "#fbf9ff", soft: "#efebf8", muted: "#81789b", accent: "#7968a8" };
  return dark ? { ink: "#e0e6ec", edge: "#657687", fill: "#252e36", soft: "#34414d", muted: "#a5b1bf", accent: "#6ea3c2" } : { ink: "#344252", edge: "#a9b6c3", fill: "#ffffff", soft: "#eef3f7", muted: "#7f8d9a", accent: "#4e83b4" };
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, Math.min(radius, w / 2, h / 2));
  else ctx.rect(x, y, w, h);
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, size: number, color: string, weight = 500, align: CanvasTextAlign = "left") {
  ctx.fillStyle = color; ctx.font = `${weight} ${size}px system-ui, sans-serif`; ctx.textAlign = align; ctx.textBaseline = "middle";
  ctx.fillText(value, x, y, Math.max(4, maxWidth));
}

function fittedComponentText(ctx: CanvasRenderingContext2D, value: string, bounds: { x: number; y: number; w: number; h: number }, tx: number, ty: number, requestedWidth: number, requestedSize: number, color: string, weight = 500, align: CanvasTextAlign = "left") {
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
  let size = Math.min(48, Math.max(5, requestedSize), bottom - top);
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  const measuredWidth = ctx.measureText(value).width;
  if (measuredWidth > maxWidth && measuredWidth > 0) size = Math.max(5, size * maxWidth / measuredWidth);
  const fittedY = Math.max(top + size / 2, Math.min(bottom - size / 2, ty));
  text(ctx, value, x, fittedY, maxWidth, size, color, weight, align);
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

function drawCleanModelComponent(ctx: CanvasRenderingContext2D, group: GroupElement, theme: Theme) {
  const bounds = group.componentBounds; const meta = group.libraryComponent;
  if (!bounds || !meta) return;
  const { x, y, w, h } = bounds; const kind = meta.kind;
  const ink = meta.styleOverrides?.color ?? (theme === "dark" ? "#eeeeee" : "#292929");
  const edge = ink; const fill = meta.styleOverrides?.fillColor === null ? "transparent" : meta.styleOverrides?.fillColor ?? (theme === "dark" ? "#202020" : "#ffffff");
  const soft = theme === "dark" ? "#343434" : "#eeeeee";
  const maxLabelSize = Math.max(5, Math.min(48, h - 4));
  const size = Math.min(maxLabelSize, Math.max(5, meta.textStyle?.fontSize ?? 12));
  const name = meta.label ?? kind.replace(/^(network|cloud|software|bpmn|c4)-/, "").replace(/-/g, " ");
  const box = (bx = x, by = y, bw = w, bh = h, color = fill) => { ctx.fillStyle = color === "transparent" ? "rgba(0,0,0,0)" : color; if (color !== "transparent") ctx.fillRect(bx, by, bw, bh); ctx.strokeStyle = edge; ctx.lineWidth = 1.3; ctx.strokeRect(bx, by, bw, bh); };
  const label = (value = name, bx = x + 10, by = y + 15, max = w - 20, font = size, bold = true, align: CanvasTextAlign = "left") => {
    fittedComponentText(ctx, value, bounds, bx, by, max, Math.min(maxLabelSize, font), ink, bold ? 650 : 400, align);
  };
  const rule = (x1: number, y1: number, x2: number, y2: number) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = edge; ctx.lineWidth = 1.2; ctx.stroke(); };
  const dashedBoundary = (title: string, caption: string) => {
    ctx.setLineDash([6, 4]); ctx.strokeStyle = edge; ctx.lineWidth = 1.3; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.setLineDash([]);
    label(title.toUpperCase(), x + 12, y + 15, w - 24, Math.min(size, 14));
    label(caption, x + 12, y + 34, w - 24, Math.max(8, size * .75), false);
  };
  ctx.save();
  ctx.beginPath(); ctx.rect(x - 1, y - 1, w + 2, h + 2); ctx.clip();
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.font = `${size}px system-ui, sans-serif`;

  if (kind === "diagram-frame") {
    ctx.strokeStyle = edge; ctx.lineWidth = 1.4; ctx.setLineDash([7, 4]); ctx.strokeRect(x + .7, y + .7, Math.max(0, w - 1.4), Math.max(0, h - 1.4)); ctx.setLineDash([]);
    label(name, x + 12, y + 13, w - 24, Math.min(size, 14));
    ctx.restore(); return;
  }
  if (kind === "diagram-swimlane") {
    const headerHeight = Math.min(32, Math.max(24, h * .12)); const labelWidth = Math.min(132, Math.max(84, w * .22));
    const lanes = Math.max(2, Math.min(8, Math.round(meta.laneCount ?? 3))); const rowHeight = Math.max(1, (h - headerHeight) / lanes);
    box(); ctx.fillStyle = soft; ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, headerHeight - 1));
    rule(x, y + headerHeight, x + w, y + headerHeight); rule(x + labelWidth, y + headerHeight, x + labelWidth, y + h);
    label(name, x + 10, y + headerHeight / 2, w - 20, Math.min(size, 14));
    for (let lane = 0; lane < lanes; lane++) {
      const top = y + headerHeight + rowHeight * lane;
      if (lane) rule(x, top, x + w, top);
      label(`Lane ${lane + 1}`, x + 8, top + rowHeight / 2, labelWidth - 16, Math.min(size, 12), false);
    }
    ctx.restore(); return;
  }
  if (kind.startsWith("c4-")) { dashedBoundary(name, kind === "c4-system" ? "C4 · system context" : kind === "c4-container" ? "C4 · container" : "C4 · component"); ctx.restore(); return; }
  if (kind === "network-zone") { dashedBoundary(name, "Network boundary"); ctx.restore(); return; }
  if (kind === "cloud-boundary") {
    cloudPath(ctx, x, y, w, h); ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill();
    ctx.setLineDash([6, 4]); ctx.strokeStyle = edge; ctx.lineWidth = 1.3; ctx.stroke(); ctx.setLineDash([]);
    label(name.toUpperCase(), x + w * .25, y + h * .45, w * .5, Math.min(size, 14), true, "center");
    label("Deployment boundary", x + w * .25, y + h * .58, w * .5, Math.max(8, size * .72), false, "center");
    ctx.restore(); return;
  }

  if (kind === "software-client") {
    box(); label(name.toUpperCase()); rule(x, y + 27, x + w, y + 27);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + 12 + i * 10, y + 14, 2, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill(); }
    box(x + 12, y + 38, w * .32, h - 52, soft); box(x + w * .42, y + 38, w * .48, 16, soft); box(x + w * .42, y + 62, w * .48, h - 76, soft);
  } else if (kind === "software-api" || kind === "software-service" || kind === "tech-service") {
    box(); label(name.toUpperCase());
    rule(x + 10, y + h * .48, x + w - 10, y + h * .48);
    label(kind === "software-api" ? "HTTP / RPC" : kind === "tech-service" ? "Technology" : "Module / worker", x + 10, y + h * .72, w - 20, Math.max(8, size * .8), false);
  } else if (kind === "software-database" || kind === "cloud-database") {
    const inset = w * .07; const ry = Math.max(7, Math.min(12, h * .12)); const left = x + inset; const right = x + w - inset;
    ctx.beginPath(); ctx.moveTo(left, y + ry); ctx.lineTo(left, y + h - ry); ctx.ellipse(x + w / 2, y + h - ry, w * .43, ry, 0, Math.PI, 0, true); ctx.lineTo(right, y + ry); ctx.closePath();
    ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + ry, w * .43, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill === "transparent" ? "rgba(0,0,0,0)" : fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * .55, w * .43, ry, 0, 0, Math.PI); ctx.strokeStyle = edge; ctx.stroke();
    if (kind === "cloud-database") {
      label("MANAGED DATABASE", x + 8, y + h * .38, w - 16, Math.max(8, size * .68), true, "center");
      label("SQL · BACKUP · REPLICAS", x + 7, y + h * .72, w - 14, Math.max(7, size * .52), false, "center");
    } else label(name.toUpperCase(), x + 8, y + h * .48, w - 16, Math.max(8, size * .78), true, "center");
  } else if (kind === "software-queue" || kind === "cloud-queue") {
    box(); label(name.toUpperCase());
    const count = 3; const cellW = (w - 32) / count; for (let i = 0; i < count; i++) box(x + 10 + i * cellW, y + h * .48, cellW - 6, Math.min(24, h * .28), soft);
    rule(x + 10, y + h - 14, x + w - 10, y + h - 14);
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
    box(); label(name.toUpperCase()); label("KEY / VALUE", x + 10, y + h * .68, w - 20, Math.max(8, size * .8), false);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + w - 14, y + 14 + i * 10, 2, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill(); }
  } else if (kind === "cloud-function") {
    box(); box(x + 10, y + 10, Math.min(32, h - 20), Math.min(32, h - 20), soft); label("fn", x + 10, y + Math.min(26, h / 2), Math.min(32, h - 20), 14, true, "center");
    label(name.toUpperCase(), x + 50, y + 22, w - 60, Math.max(8, size * .8)); label("On demand", x + 50, y + 43, w - 60, Math.max(8, size * .75), false);
  } else if (kind === "cloud-storage") {
    box(); label(name.toUpperCase());
    for (let i = 0; i < 3; i++) rule(x + 12, y + 42 + i * 14, x + w - 12, y + 42 + i * 14);
  } else if (kind === "network-switch" || kind === "network-hub") {
    box(); label(name.toUpperCase());
    const count = Math.max(1, Math.min(32, Math.round(meta.portCount ?? (kind === "network-hub" ? 8 : 6)))); const columns = Math.min(8, count); const rows = Math.ceil(count / columns);
    const gapX = (w - 24) / columns; const startY = y + 32; const rowGap = Math.max(10, (h - 42) / rows);
    for (let i = 0; i < count; i++) { const col = i % columns; const row = Math.floor(i / columns); const pw = Math.min(12, gapX - 2); ctx.strokeStyle = edge; ctx.strokeRect(x + 12 + col * gapX + (gapX - pw) / 2, startY + row * rowGap, pw, Math.min(7, rowGap - 2)); }
  } else if (kind === "network-server") {
    box(); label(name.toUpperCase()); for (let row = 0; row < 3; row++) { const yy = y + 28 + row * ((h - 36) / 3); box(x + 10, yy, w - 20, Math.max(8, (h - 48) / 3), soft); ctx.beginPath(); ctx.arc(x + 18, yy + 7, 2, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill(); }
  } else if (kind === "network-firewall") {
    box(); label(name.toUpperCase()); const top = y + 30; const brickW = (w - 24) / 4; const brickH = (h - 40) / 2;
    for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) ctx.strokeRect(x + 8 + col * brickW + (row ? brickW / 2 : 0), top + row * brickH, brickW, brickH);
  } else if (kind === "network-client") {
    box(x + 8, y + 4, w - 16, h * .68); rule(x + w * .25, y + h * .82, x + w * .75, y + h * .82); rule(x + w * .5, y + h * .68, x + w * .5, y + h * .82); label(name.toUpperCase(), x + 4, y + h - 8, w - 8, Math.max(8, size * .72), true, "center");
  } else if (kind === "network-router" || kind === "network-load-balancer") {
    box(); label(name.toUpperCase()); const cx = x + w / 2; const cy = y + h * .61; ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * .1, 0, Math.PI * 2); ctx.strokeStyle = edge; ctx.stroke();
    const ends = kind === "network-router" ? [[x + 8, cy], [x + w - 8, cy], [cx, y + h - 7], [cx, y + 30]] : [[x + 10, y + h - 8], [cx, y + h - 8], [x + w - 10, y + h - 8]];
    for (const [ex, ey] of ends) { rule(cx, cy, ex, ey); ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.stroke(); }
  } else if (kind === "network-access-point") {
    const r = Math.min(w * .28, h * .34); const cx = x + w / 2; const cy = y + h * .4;
    for (const scale of [1, .68, .32]) { ctx.beginPath(); ctx.arc(cx, cy, r * scale, Math.PI, 0); ctx.strokeStyle = edge; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill(); label(name.toUpperCase(), x + 4, y + h - 10, w - 8, Math.max(7, size * .72), true, "center");
  } else if (kind === "bpmn-start" || kind === "bpmn-event" || kind === "bpmn-end") {
    const diameter = Math.min(w, h - 14); const cx = x + w / 2; const cy = y + diameter / 2 + 1; ctx.beginPath(); ctx.arc(cx, cy, diameter * .43, 0, Math.PI * 2); ctx.fillStyle = fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = kind === "bpmn-end" ? 2.5 : 1.3; ctx.stroke();
    if (kind === "bpmn-event") { ctx.beginPath(); ctx.arc(cx, cy, diameter * .34, 0, Math.PI * 2); ctx.stroke(); }
    label(name, x, y + h - 8, w, Math.max(7, size * .64), false, "center");
  } else if (kind === "bpmn-gateway" || kind === "bpmn-parallel-gateway") {
    const side = Math.min(w, h - 12); const cx = x + w / 2; const cy = side / 2; ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(x + w, y + cy); ctx.lineTo(cx, y + side); ctx.lineTo(x, y + cy); ctx.closePath(); ctx.fillStyle = fill; if (fill !== "transparent") ctx.fill(); ctx.strokeStyle = edge; ctx.stroke();
    if (kind === "bpmn-parallel-gateway") { rule(cx, y + side * .28, cx, y + side * .72); rule(x + w * .28, y + cy, x + w * .72, y + cy); }
    else { rule(x + w * .34, y + side * .34, x + w * .66, y + side * .66); rule(x + w * .66, y + side * .34, x + w * .34, y + side * .66); }
    label(name, x, y + h - 8, w, Math.max(7, size * .58), false, "center");
  } else if (kind === "bpmn-task") {
    box(); label(name.toUpperCase(), x + 8, y + h / 2, w - 16, size, true, "center");
  } else if (kind === "bpmn-data") {
    box(); ctx.beginPath(); ctx.moveTo(x + w - 18, y); ctx.lineTo(x + w, y + 18); ctx.lineTo(x + w - 18, y + 18); ctx.closePath(); ctx.strokeStyle = edge; ctx.stroke(); rule(x + 12, y + h - 23, x + w - 12, y + h - 23); label(name.toUpperCase(), x + 5, y + h / 2, w - 10, Math.max(8, size * .8), true, "center");
  } else if (kind === "bpmn-pool") {
    box(); box(x, y, Math.min(34, w / 3), h, soft); rule(x + Math.min(34, w / 3), y + h / 2, x + w, y + h / 2); label(name.toUpperCase(), x + 2, y + h / 2, Math.min(30, w / 3), Math.max(8, size * .55), true, "center");
  } else if (kind === "data-flow") {
    label(name.toUpperCase(), x, y + 9, w, Math.max(8, size * .72), true, "center"); const yy = y + h * .72; rule(x + 4, yy, x + w - 10, yy); ctx.beginPath(); ctx.moveTo(x + w - 16, yy - 5); ctx.lineTo(x + w - 8, yy); ctx.lineTo(x + w - 16, yy + 5); ctx.strokeStyle = edge; ctx.stroke();
  }
  ctx.restore();
}

export function drawModelComponent(ctx: CanvasRenderingContext2D, group: GroupElement, theme: Theme, _preferredAppearance: "modern" | "simple" = "modern") {
  const bounds = group.componentBounds;
  const kind = group.libraryComponent?.kind;
  if (!bounds || !kind) return;
  const { x, y, w, h } = bounds;
  const meta = group.libraryComponent!;
  if (meta.renderStyle === "clean") { drawCleanModelComponent(ctx, group, theme); return; }
  // Modeling components share one plain visual language. Per-item appearance
  // metadata remains readable for old files, but applies only to graphs.
  const simple = true;
  const palette = paletteFor(kind, theme === "dark", simple);
  const ink = meta.styleOverrides?.color ?? palette.ink;
  const fill = meta.styleOverrides?.fillColor === null ? "transparent" : meta.styleOverrides?.fillColor ?? palette.fill;
  const fillOpacity = meta.styleOverrides?.fillOpacity ?? 1;
  const maxLabelSize = Math.max(5, Math.min(48, h - 4));
  const size = Math.min(maxLabelSize, Math.max(5, meta.textStyle?.fontSize ?? 12));
  const name = meta.formTitle ?? meta.label ?? kind.replace(/^(network|cloud|software|bpmn|uml|c4|er)-/, "").replace(/-/g, " ").toUpperCase();
  const strokeWidth = Math.max(1.25, Math.min(2.5, Math.min(w, h) * .018));
  const shell = (radius = 12, inset = 0) => {
    roundRect(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, radius);
    if (fill !== "transparent") { ctx.save(); ctx.globalAlpha = fillOpacity; ctx.fillStyle = fill; ctx.fill(); ctx.restore(); }
    ctx.strokeStyle = ink === palette.ink ? palette.edge : ink; ctx.lineWidth = strokeWidth; ctx.stroke();
  };
  const componentText = (value: string, tx: number, ty: number, maxWidth: number, fontSize: number, color: string, weight = 500, align: CanvasTextAlign = "left") => {
    fittedComponentText(ctx, value, bounds, tx, ty, maxWidth, Math.min(maxLabelSize, fontSize), color, weight, align);
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
    if (meta.iconSvg && meta.iconViewBox) {
      const iconUrl = componentIconDataUrl(group); const icon = iconUrl ? componentIconImages.get(iconUrl) : undefined;
      if (icon?.complete && icon.naturalWidth) {
        const [, , sourceW, sourceH] = meta.iconViewBox.split(/\s+/).map(Number);
        const ratio = sourceW > 0 && sourceH > 0 ? sourceW / sourceH : 1;
        const drawW = iconSide * Math.min(1, ratio); const drawH = iconSide * Math.min(1, 1 / ratio);
        ctx.drawImage(icon, iconX + (iconSide - drawW) / 2, iconY + (iconSide - drawH) / 2, drawW, drawH);
      }
    } else {
      roundRect(ctx, iconX, iconY, iconSide, iconSide, 3); ctx.fillStyle = palette.soft; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke();
      componentText( provider.glyph, iconX + iconSide / 2, iconY + iconSide / 2, iconSide - 4, provider.glyph.length > 2 ? 9 : 13, ink, 700, "center");
    }
    const copyX = iconX + iconSide + 10;
    componentText( name, copyX, y + h * .43, w - (copyX - x) - 10, size, ink, 700);
    componentText( provider.provider.toUpperCase(), copyX, y + h * .63, w - (copyX - x) - 10, 8, palette.muted, 600);
    componentText( provider.description, x + 12, y + h - 8, w - 24, 8, palette.muted, 500);
    ctx.restore(); return;
  }
  if (kind === "cloud-boundary") {
    cloudPath(ctx, x, y, w, h); ctx.save(); ctx.globalAlpha = fillOpacity; ctx.fillStyle = fill === "transparent" ? "#ffffff" : fill; ctx.fill(); ctx.restore();
    ctx.strokeStyle = ink === palette.ink ? palette.edge : ink; ctx.setLineDash([8, 5]); ctx.stroke(); ctx.setLineDash([]);
    componentText( name.toUpperCase(), x + w * .24, y + h * .36, w * .5, size + 1, ink, 700);
    componentText( "DEPLOYMENT BOUNDARY", x + w * .24, y + h * .36 + size + 7, w * .5, Math.max(8, size * .72), palette.muted, 500);
    ctx.restore(); return;
  }
  if (kind === "network-zone" || kind === "c4-system" || kind === "c4-container" || kind === "c4-component") {
    shell(15); ctx.setLineDash([6, 4]); ctx.strokeStyle = palette.edge; ctx.strokeRect(x + 5, y + 5, w - 10, h - 10); ctx.setLineDash([]);
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
      if (h > 68) componentText( `${count} PORT${count === 1 ? "" : "S"} · REPEATER`, x + 12, y + h - 10, w - 24, 8, palette.muted, 500);
    } else {
      const count = Math.max(1, Math.min(32, Math.round(meta.portCount ?? 6)));
      shell(simple ? 0 : 11); heading(name, y + 15);
      drawPorts(ctx, x, y, w, count, palette, false);
      if (count > 8) componentText( `${count} PORTS`, x + w - 10, y + 15, w * .45, Math.max(8, size * .7), palette.muted, 500, "right");
    }
    ctx.restore(); return;
  }
  if (kind === "network-server") {
    shell(10); const rows = Math.max(2, Math.min(4, Math.floor((h - 22) / 23))); const rowH = (h - 26) / rows;
    heading(); for (let index = 0; index < rows; index++) { const yy = y + 25 + index * rowH; roundRect(ctx, x + 10, yy, w - 20, rowH - 5, 4); ctx.fillStyle = palette.soft; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke(); ctx.beginPath(); ctx.arc(x + 20, yy + (rowH - 5) / 2, 2.4, 0, Math.PI * 2); ctx.fillStyle = palette.accent; ctx.fill(); }
    ctx.restore(); return;
  }
  if (kind === "network-firewall") {
    shell(9); heading(); const top = y + Math.min(29, h * .34); const rowH = (h - (top - y) - 12) / 2;
    for (let row = 0; row < 2; row++) { const yy = top + row * rowH; for (let col = 0; col < 4; col++) { const bw = (w - 28) / 4; roundRect(ctx, x + 10 + col * bw + (row % 2 ? bw / 2 : 0), yy + 2, bw - 4, rowH - 5, 2); ctx.fillStyle = palette.soft; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke(); } }
    ctx.restore(); return;
  }
  if (kind === "network-access-point") {
    const diameter = Math.min(w * .56, h * .64); const radius = diameter / 2; const cx = x + w / 2; const cy = y + h * .38;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fillStyle = palette.soft; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.lineWidth = strokeWidth; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, radius * .78, 0, Math.PI * 2); ctx.fillStyle = fill === "transparent" ? palette.fill : fill; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.lineWidth = Math.max(1, strokeWidth * .7); ctx.stroke();
    ctx.strokeStyle = palette.accent; ctx.lineWidth = Math.max(1.4, strokeWidth); ctx.beginPath(); ctx.moveTo(cx - radius * .31, cy - radius * .03); ctx.quadraticCurveTo(cx, cy - radius * .56, cx + radius * .31, cy - radius * .03); ctx.moveTo(cx - radius * .17, cy + radius * .12); ctx.quadraticCurveTo(cx, cy - radius * .16, cx + radius * .17, cy + radius * .12); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy + radius * .26, Math.max(1.5, radius * .06), 0, Math.PI * 2); ctx.fillStyle = palette.accent; ctx.fill();
    for (const offset of [-.18, 0, .18]) { ctx.beginPath(); ctx.arc(cx + radius * offset * 3, cy + radius * .62, Math.max(1.2, radius * .045), 0, Math.PI * 2); ctx.fillStyle = palette.accent; ctx.fill(); }
    componentText( "ACCESS POINT", cx, y + h * .88, w - 12, size, ink, 700, "center");
    ctx.restore(); return;
  }
  if (kind === "network-router" || kind === "network-load-balancer" || kind === "network-client") {
    shell(kind === "network-client" ? 8 : 16); heading();
    const cy = y + h * .58; const cx = x + w / 2;
    if (kind === "network-client") { ctx.strokeStyle = palette.edge; ctx.beginPath(); ctx.moveTo(x + w * .28, y + h * .78); ctx.lineTo(x + w * .72, y + h * .78); ctx.moveTo(cx, y + h * .64); ctx.lineTo(cx, y + h * .79); ctx.stroke(); }
    else if (kind === "network-load-balancer") { ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * .13, 0, Math.PI * 2); ctx.fillStyle = palette.soft; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke(); for (const direction of [-1, 0, 1]) { const xx = cx + direction * w * .31; ctx.beginPath(); ctx.moveTo(cx, cy + 10); ctx.lineTo(xx, y + h * .82); ctx.stroke(); ctx.beginPath(); ctx.arc(xx, y + h * .82, 4, 0, Math.PI * 2); ctx.fillStyle = palette.accent; ctx.fill(); } }
    else { ctx.strokeStyle = palette.edge; for (const direction of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx, cy + direction * 8); ctx.lineTo(cx + direction * w * .27, cy + direction * h * .22); ctx.stroke(); } }
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
  if (kind.startsWith("form-")) {
    shell(simple ? 0 : kind === "form-button" ? Math.min(13, h / 2) : 10);
    if (kind === "form-button") {
      const buttonFill = meta.styleOverrides?.fillColor ?? (simple ? fill : palette.accent);
      ctx.fillStyle = buttonFill === "transparent" ? palette.fill : buttonFill; ctx.fillRect(x + strokeWidth, y + strokeWidth, Math.max(0, w - strokeWidth * 2), Math.max(0, h - strokeWidth * 2));
      if (!simple && buttonFill !== "transparent") { ctx.fillStyle = "rgba(0,0,0,.12)"; ctx.fillRect(x + strokeWidth, y + h - Math.max(2, strokeWidth * 1.5), Math.max(0, w - strokeWidth * 2), Math.max(1, strokeWidth)); }
      const caption = meta.formOptions?.[meta.selectedOption ?? 0] ?? meta.formTitle ?? "Continue";
      componentText( caption, x + w / 2, y + h / 2, Math.max(4, w - 24), size, simple ? ink : "#ffffff", 650, "center");
    }
    else if (kind === "form-toggle") {
      const sw = Math.min(48, Math.max(30, w * .25)); const sh = Math.min(26, Math.max(18, h * .44)); const sx = Math.max(x + 7, x + w - sw - 14); const sy = y + (h - sh) / 2;
      componentText( name, x + 14, y + h / 2, Math.max(4, sx - x - 22), size, ink, 600);
      roundRect(ctx, sx, sy, Math.min(sw, Math.max(1, x + w - sx - 7)), sh, simple ? 0 : sh / 2);
      ctx.fillStyle = meta.formState === false ? palette.soft : palette.accent; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke();
      const actualWidth = Math.min(sw, Math.max(1, x + w - sx - 7)); ctx.fillStyle = simple ? palette.fill : "#fff"; ctx.beginPath(); ctx.arc(sx + (meta.formState === false ? sh / 2 : actualWidth - sh / 2), sy + sh / 2, Math.min(sh * .36, actualWidth / 3), 0, Math.PI * 2); ctx.fill();
    }
    else if (kind === "form-checkbox" || kind === "form-radio") {
      heading(name, y + 15);
      const options = (meta.formOptions?.length ? meta.formOptions : ["Option 1"]).slice(0, 12);
      const rowHeight = Math.min(23, (h - 30) / options.length);
      options.forEach((option, index) => {
        const cy = y + 30 + rowHeight * (index + .5); const active = kind === "form-checkbox" ? meta.formStates?.[index] ?? index === 0 : (meta.selectedOption ?? 0) === index;
        if (kind === "form-checkbox") { roundRect(ctx, x + 13, cy - 6, 12, 12, 3); ctx.fillStyle = palette.fill; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke(); if (active) { ctx.beginPath(); ctx.moveTo(x + 16, cy); ctx.lineTo(x + 18, cy + 3); ctx.lineTo(x + 22, cy - 3); ctx.strokeStyle = palette.accent; ctx.lineWidth = 2; ctx.stroke(); } }
        else { ctx.beginPath(); ctx.arc(x + 19, cy, 6, 0, Math.PI * 2); ctx.fillStyle = palette.fill; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke(); if (active) { ctx.beginPath(); ctx.arc(x + 19, cy, 3, 0, Math.PI * 2); ctx.fillStyle = palette.accent; ctx.fill(); } }
        componentText( option || `Option ${index + 1}`, x + 34, cy, w - 47, size, palette.ink, 500);
      });
    }
    else if (kind === "form-input" || kind === "form-select") {
      const inset = Math.min(12, Math.max(2, w * .06)); const fieldY = y + Math.min(31, h * .42); const fieldHeight = Math.max(1, h - (fieldY - y) - Math.min(10, h * .12));
      componentText( name, x + inset, y + Math.min(15, h * .2), Math.max(4, w - inset * 2), size, ink, 600);
      roundRect(ctx, x + inset, fieldY, Math.max(1, w - inset * 2), fieldHeight, simple ? 0 : 6); ctx.fillStyle = palette.fill; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke();
      if (kind === "form-input") { ctx.beginPath(); ctx.moveTo(x + inset + 9, fieldY + fieldHeight / 2); ctx.lineTo(x + w - inset - 9, fieldY + fieldHeight / 2); ctx.strokeStyle = palette.muted; ctx.lineWidth = 1; ctx.stroke(); }
      else {
        const arrowSpace = Math.min(27, Math.max(12, w * .15)); componentText( meta.formOptions?.[meta.selectedOption ?? 0] ?? "Select an option", x + inset + 9, fieldY + fieldHeight / 2, Math.max(4, w - inset * 2 - arrowSpace - 12), size, palette.ink, 500);
        const ax = x + w - inset - Math.min(12, arrowSpace / 2); ctx.beginPath(); ctx.moveTo(ax - 4, fieldY + fieldHeight / 2 - 2); ctx.lineTo(ax, fieldY + fieldHeight / 2 + 2); ctx.lineTo(ax + 4, fieldY + fieldHeight / 2 - 2); ctx.strokeStyle = palette.edge; ctx.stroke();
      }
    }
    else { heading(name, y + 15); roundRect(ctx, x + 12, y + 29, w - 24, h - 40, 6); ctx.fillStyle = palette.fill; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke(); }
    ctx.restore(); return;
  }
  if (kind === "uml-actor") {
    const cx = x + w / 2; const head = Math.min(w * .22, h * .11); ctx.strokeStyle = ink; ctx.beginPath(); ctx.arc(cx, y + head + 3, head, 0, Math.PI * 2); ctx.moveTo(cx, y + head * 2 + 3); ctx.lineTo(cx, y + h * .62); ctx.moveTo(x + w * .2, y + h * .4); ctx.lineTo(x + w * .8, y + h * .4); ctx.moveTo(cx, y + h * .62); ctx.lineTo(x + w * .25, y + h * .74); ctx.moveTo(cx, y + h * .62); ctx.lineTo(x + w * .75, y + h * .74); ctx.stroke(); componentText( name, cx, y + h * .9, w - 8, size, ink, 500, "center"); ctx.restore(); return;
  }
  if (kind === "uml-use-case") { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w * .46, h * .4, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke(); centerHeading(name); ctx.restore(); return; }
  if (kind === "uml-lifeline") { roundRect(ctx, x, y, w, Math.min(34, h), simple ? 0 : 8); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke(); heading(name, y + 17); ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(x + w / 2, y + 34); ctx.lineTo(x + w / 2, y + h); ctx.strokeStyle = palette.edge; ctx.stroke(); ctx.setLineDash([]); ctx.restore(); return; }
  if (kind === "uml-activation") { const activationWidth = Math.min(w, Math.max(10, w * .44)); roundRect(ctx, x + (w - activationWidth) / 2, y, activationWidth, h, 4); ctx.fillStyle = palette.soft; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke(); ctx.restore(); return; }
  if (kind.startsWith("sequence-") || kind.startsWith("uml-") && ["uml-inheritance", "uml-realization", "uml-aggregation", "uml-composition"].includes(kind) || kind.startsWith("er-one-") || kind === "er-many-many" || kind === "data-flow") {
    const yy = y + h / 2; const relationshipDiamond = kind === "uml-aggregation" || kind === "uml-composition";
    if (kind === "uml-realization") ctx.setLineDash([5, 4]);
    ctx.strokeStyle = ink; ctx.beginPath(); ctx.moveTo(x + (relationshipDiamond ? 25 : 6), yy); ctx.lineTo(x + w - 9, yy); ctx.stroke(); ctx.setLineDash([]);
    if (kind.startsWith("sequence-")) { ctx.beginPath(); ctx.moveTo(x + w - 18, yy - 6); ctx.lineTo(x + w - 8, yy); ctx.lineTo(x + w - 18, yy + 6); if (kind === "sequence-sync") { ctx.closePath(); ctx.fillStyle = ink; ctx.fill(); } else ctx.stroke(); }
    else if (kind === "uml-inheritance" || kind === "uml-realization") { ctx.beginPath(); ctx.moveTo(x + w - 19, yy - 8); ctx.lineTo(x + w - 8, yy); ctx.lineTo(x + w - 19, yy + 8); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); }
    if (kind === "uml-aggregation" || kind === "uml-composition") { ctx.beginPath(); ctx.moveTo(x + 7, yy); ctx.lineTo(x + 16, yy - 6); ctx.lineTo(x + 25, yy); ctx.lineTo(x + 16, yy + 6); ctx.closePath(); if (kind === "uml-composition") { ctx.fillStyle = ink; ctx.fill(); } else { ctx.fillStyle = fill; ctx.fill(); } ctx.stroke(); }
    if (kind === "sequence-sync" || kind === "sequence-async") componentText( name, x + w / 2, y + 9, w - 20, Math.max(8, size * .7), palette.muted, 500, "center");
    ctx.restore(); return;
  }
  if (kind.startsWith("bpmn-")) {
    if (["bpmn-start", "bpmn-event", "bpmn-end"].includes(kind)) { ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) * .44, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = kind === "bpmn-end" ? strokeWidth * 2 : strokeWidth; ctx.stroke(); if (kind === "bpmn-event") { ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) * .34, 0, Math.PI * 2); ctx.stroke(); } }
    else if (kind.includes("gateway")) { ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h / 2); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = ink; ctx.stroke(); ctx.beginPath(); if (kind === "bpmn-parallel-gateway") { ctx.moveTo(x + w * .5, y + h * .3); ctx.lineTo(x + w * .5, y + h * .7); ctx.moveTo(x + w * .3, y + h * .5); ctx.lineTo(x + w * .7, y + h * .5); } else { ctx.moveTo(x + w * .34, y + h * .34); ctx.lineTo(x + w * .66, y + h * .66); ctx.moveTo(x + w * .66, y + h * .34); ctx.lineTo(x + w * .34, y + h * .66); } ctx.stroke(); }
    else { shell(kind === "bpmn-pool" ? 4 : 10); if (kind === "bpmn-pool") { ctx.beginPath(); ctx.moveTo(x + 31, y); ctx.lineTo(x + 31, y + h); ctx.moveTo(x + 31, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.strokeStyle = palette.edge; ctx.stroke(); } centerHeading(name); }
    ctx.restore(); return;
  }
  if (kind === "uml-class" || kind === "uml-interface" || kind === "er-table") {
    shell(9); const headerH = Math.min(36, h * .28); ctx.fillStyle = palette.soft; roundRect(ctx, x + 1, y + 1, w - 2, headerH, 8); ctx.fill(); ctx.strokeStyle = palette.edge; ctx.beginPath(); ctx.moveTo(x, y + headerH); ctx.lineTo(x + w, y + headerH); ctx.stroke(); heading(name, y + headerH / 2, x + 12, w - 24);
    if (h > headerH + 24) { ctx.beginPath(); ctx.moveTo(x, y + headerH + (h - headerH) * .48); ctx.lineTo(x + w, y + headerH + (h - headerH) * .48); ctx.stroke(); }
    ctx.restore(); return;
  }
  if (kind === "viz-kpi" || kind.startsWith("viz-")) {
    shell(12); heading(meta.chartData?.title ?? name); ctx.strokeStyle = palette.edge; ctx.beginPath(); ctx.moveTo(x + 14, y + h * .75); ctx.lineTo(x + w - 14, y + h * .75); ctx.moveTo(x + 14, y + h * .35); ctx.lineTo(x + 14, y + h * .75); ctx.stroke();
    const values = meta.chartData?.values ?? [3, 6, 4, 8]; const max = Math.max(1, ...values); const gap = (w - 36) / Math.max(1, values.length);
    if (kind === "viz-bar") values.forEach((value, index) => { ctx.fillStyle = palette.accent; ctx.fillRect(x + 20 + index * gap, y + h * .73 - (value / max) * h * .32, gap * .55, (value / max) * h * .32); });
    else { ctx.beginPath(); values.forEach((value, index) => { const px = x + 20 + (values.length <= 1 ? 0 : index * (w - 40) / (values.length - 1)); const py = y + h * .73 - (value / max) * h * .32; if (!index) ctx.moveTo(px, py); else ctx.lineTo(px, py); }); ctx.strokeStyle = palette.accent; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.restore(); return;
  }
  shell(12); centerHeading(name); ctx.restore();
}

export function modelComponentSvg(group: GroupElement, _preferredAppearance: "modern" | "simple" = "modern") {
  const bounds = group.componentBounds; const kind = group.libraryComponent?.kind;
  if (!bounds || !kind) return "";
  const { x, y, w, h } = bounds; const meta = group.libraryComponent!;
  const simple = true;
  const palette = paletteFor(kind, false, simple); const edge = meta.styleOverrides?.color ?? palette.edge;
  const fill = meta.styleOverrides?.fillColor === null ? "none" : meta.styleOverrides?.fillColor ?? palette.fill;
  const rawTitle = meta.formTitle ?? meta.label ?? kind.replace(/-/g, " ");
  const maxLabelSize = Math.max(5, Math.min(48, h - 4));
  const size = Math.min(maxLabelSize, Math.max(5, meta.textStyle?.fontSize ?? 12));
  const strokeWidth = Math.max(1.25, Math.min(2.5, Math.min(w, h) * .018));
  const xmlText = (value: string) => value.replace(/[&<>]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]!);
  const title = xmlText(rawTitle);
  const fitTextAttribute = (value: string, availableWidth: number, fontSize = size) => value.length * fontSize * .58 > availableWidth
    ? ` textLength="${Math.max(1, availableWidth)}" lengthAdjust="spacingAndGlyphs"`
    : "";
  if (meta.renderStyle === "clean") {
    const ink = meta.styleOverrides?.color ?? "#292929"; const cleanFill = fill; const soft = "#eeeeee";
    const t = (value: string, tx: number, ty: number, tw = w - 20, font = size, anchor = "start", weight = 600) => {
      const fittedFont = Math.min(maxLabelSize, Math.max(5, font));
      const fittedY = Math.max(y + fittedFont / 2 + 2, Math.min(y + h - fittedFont / 2 - 2, ty));
      const estimatedWidth = value.length * fittedFont * .58;
      const fit = estimatedWidth > tw ? ` textLength="${Math.max(1, tw)}" lengthAdjust="spacingAndGlyphs"` : "";
      return `<text x="${tx}" y="${fittedY}" text-anchor="${anchor}" dominant-baseline="middle"${fit} fill="${ink}" font-family="sans-serif" font-size="${fittedFont}" font-weight="${weight}">${xmlText(value)}</text>`;
    };
    const r = (rx = x, ry = y, rw = w, rh = h, color = cleanFill) => `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${color}" stroke="${ink}" stroke-width="1.3"/>`;
    const p = (d: string, dash = "") => `<path d="${d}" fill="none" stroke="${ink}" stroke-width="1.3"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
    if (kind.startsWith("c4-") || kind === "network-zone") return `${r(x + 1, y + 1, w - 2, h - 2, "none").replace("stroke-width=\"1.3\"", "stroke-width=\"1.3\" stroke-dasharray=\"6 4\"")}${t(rawTitle.toUpperCase(), x + 12, y + 15, w - 24, Math.min(size, 14))}${t(kind.startsWith("c4-") ? "C4 boundary" : "Network boundary", x + 12, y + 34, w - 24, Math.max(8, size * .75), "start", 400)}`;
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
    if (kind === "software-queue" || kind === "cloud-queue") return `${r()}${t(rawTitle.toUpperCase(), x + 10, y + 15)}${[0, 1, 2].map(index => r(x + 10 + index * ((w - 32) / 3), y + h * .48, (w - 32) / 3 - 6, Math.min(24, h * .28), soft)).join("")}${p(`M ${x + 10} ${y + h - 14} H ${x + w - 10}`)}`;
    if (kind === "cloud-function") return `${r()}${r(x + 10, y + 10, Math.min(32, h - 20), Math.min(32, h - 20), soft)}${t("fn", x + 10 + Math.min(16, (h - 20) / 2), y + 26, 32, 14, "middle")}${t(rawTitle.toUpperCase(), x + 50, y + 22, w - 60, Math.max(8, size * .8))}${t("On demand", x + 50, y + 43, w - 60, Math.max(8, size * .75), "start", 400)}`;
    if (kind === "cloud-storage") return `${r()}${t(rawTitle.toUpperCase(), x + 12, y + 15)}${[0, 1, 2].map(index => p(`M ${x + 12} ${y + 42 + index * 14} H ${x + w - 12}`)).join("")}`;
    if (kind === "software-client") return `${r()}${t(rawTitle.toUpperCase(), x + 12, y + 14)}${p(`M ${x} ${y + 27} H ${x + w}`)}${r(x + 12, y + 38, w * .32, h - 52, soft)}${r(x + w * .42, y + 38, w * .48, 16, soft)}${r(x + w * .42, y + 62, w * .48, h - 76, soft)}`;
    if (["software-api", "software-service", "tech-service", "software-cache"].includes(kind)) return `${r()}${t(rawTitle.toUpperCase(), x + 10, y + 17)}${kind === "software-cache" ? t("KEY / VALUE", x + 10, y + h * .68, w - 20, Math.max(8, size * .8), "start", 400) : p(`M ${x + 10} ${y + h * .48} H ${x + w - 10}`)}${kind === "software-cache" ? "" : t(kind === "software-api" ? "HTTP / RPC" : kind === "tech-service" ? "Technology" : "Module / worker", x + 10, y + h * .72, w - 20, Math.max(8, size * .8), "start", 400)}`;
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
      return `${r()}${t(rawTitle.toUpperCase(), x + 10, y + 15)}${ports}`;
    }
    if (kind === "network-server") return `${r()}${t(rawTitle.toUpperCase(), x + 10, y + 15)}${Array.from({ length: 3 }, (_, row) => r(x + 10, y + 28 + row * ((h - 36) / 3), w - 20, Math.max(8, (h - 48) / 3), soft)).join("")}`;
    if (kind === "network-firewall") return `${r()}${t(rawTitle.toUpperCase(), x + 10, y + 15)}${Array.from({ length: 8 }, (_, index) => { const row = Math.floor(index / 4); const col = index % 4; const brickW = (w - 24) / 4; const brickH = (h - 40) / 2; return r(x + 8 + col * brickW + (row ? brickW / 2 : 0), y + 30 + row * brickH, brickW, brickH, "none"); }).join("")}`;
    if (kind === "network-client") return `${r(x + 8, y + 4, w - 16, h * .68)}${p(`M ${x + w * .25} ${y + h * .82} H ${x + w * .75} M ${x + w * .5} ${y + h * .68} V ${y + h * .82}`)}${t(rawTitle.toUpperCase(), x + w / 2, y + h - 10, w - 8, Math.max(7, size * .72), "middle")}`;
    if (kind === "network-router" || kind === "network-load-balancer") return `${r()}${t(rawTitle.toUpperCase(), x + 10, y + 15)}${p(`M ${x + w / 2} ${y + h * .61} L ${x + 8} ${y + h * .8} M ${x + w / 2} ${y + h * .61} L ${x + w - 8} ${y + h * .8} M ${x + w / 2} ${y + h * .61} V ${y + h - 8}`)}<circle cx="${x + w / 2}" cy="${y + h * .61}" r="${Math.min(w, h) * .1}" fill="${cleanFill}" stroke="${ink}"/>`;
    if (kind === "network-access-point") { const cx = x + w / 2; const cy = y + h * .4; const radius = Math.min(w * .28, h * .34); return `${[1, .68, .32].map(scale => p(`M ${cx - radius * scale} ${cy} A ${radius * scale} ${radius * scale} 0 0 1 ${cx + radius * scale} ${cy}`)).join("")}<circle cx="${cx}" cy="${cy}" r="2" fill="${ink}"/>${t(rawTitle.toUpperCase(), cx, y + h - 10, w - 8, Math.max(7, size * .72), "middle")}`; }
    if (kind === "bpmn-start" || kind === "bpmn-event" || kind === "bpmn-end") { const diameter = Math.min(w, h - 14); const cx = x + w / 2; const cy = diameter / 2 + y + 1; return `<circle cx="${cx}" cy="${cy}" r="${diameter * .43}" fill="${cleanFill}" stroke="${ink}" stroke-width="${kind === "bpmn-end" ? 2.5 : 1.3}"/>${kind === "bpmn-event" ? `<circle cx="${cx}" cy="${cy}" r="${diameter * .34}" fill="none" stroke="${ink}"/>` : ""}${t(rawTitle, cx, y + h - 8, w, Math.max(7, size * .64), "middle", 400)}`; }
    if (kind === "bpmn-gateway" || kind === "bpmn-parallel-gateway") { const side = Math.min(w, h - 12); const cx = x + w / 2; const cy = side / 2; const marks = kind === "bpmn-parallel-gateway" ? `M ${cx} ${y + side * .28} V ${y + side * .72} M ${x + w * .28} ${y + cy} H ${x + w * .72}` : `M ${x + w * .34} ${y + side * .34} L ${x + w * .66} ${y + side * .66} M ${x + w * .66} ${y + side * .34} L ${x + w * .34} ${y + side * .66}`; return `<path d="M ${cx} ${y} L ${x + w} ${y + cy} L ${cx} ${y + side} L ${x} ${y + cy} Z" fill="${cleanFill}" stroke="${ink}"/>${p(marks)}${t(rawTitle, cx, y + h - 8, w, Math.max(7, size * .58), "middle", 400)}`; }
    if (kind === "bpmn-task") return `${r()}${t(rawTitle.toUpperCase(), x + w / 2, y + h / 2, w - 16, size, "middle")}`;
    if (kind === "bpmn-data") return `${r()}${p(`M ${x + w - 18} ${y} L ${x + w - 18} ${y + 18} H ${x + w}`)}${t(rawTitle.toUpperCase(), x + w / 2, y + h / 2, w - 10, Math.max(8, size * .8), "middle")}`;
    if (kind === "bpmn-pool") return `${r()}${r(x, y, Math.min(34, w / 3), h, soft)}${p(`M ${x + 34} ${y + h / 2} H ${x + w}`)}${t("POOL", x + 17, y + h / 2, 30, Math.max(8, size * .55), "middle")}`;
    if (kind === "data-flow") return `${t(rawTitle.toUpperCase(), x + w / 2, y + 9, w, Math.max(8, size * .72), "middle")}${p(`M ${x + 4} ${y + h * .72} H ${x + w - 10} l -8 -5 m 8 5 l -8 5`)}`;
  }
  const provider = cloudProviderComponent(kind);
  if (provider) {
    const ink = meta.styleOverrides?.color ?? palette.ink;
    const iconSide = Math.max(24, Math.min(64, h - 32, w * .38)); const iconX = x + 12; const iconY = y + (h - iconSide) / 2 - 3; const copyX = iconX + iconSide + 10;
    const icon = meta.iconSvg && meta.iconViewBox ? `<svg x="${iconX}" y="${iconY}" width="${iconSide}" height="${iconSide}" viewBox="${meta.iconViewBox}" preserveAspectRatio="xMidYMid meet">${meta.iconSvg}</svg>` : `<rect x="${iconX}" y="${iconY}" width="${iconSide}" height="${iconSide}" fill="${palette.soft}" stroke="${edge}"/><text x="${iconX + iconSide / 2}" y="${iconY + iconSide / 2 + 4}" text-anchor="middle" fill="${ink}" font-family="sans-serif" font-size="12" font-weight="700">${xmlText(provider.glyph)}</text>`;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${edge}" stroke-width="1.5"/>${icon}<text x="${copyX}" y="${y + h * .43}" fill="${ink}" font-family="sans-serif" font-size="${size}" font-weight="700"${fitTextAttribute(rawTitle, w - (copyX - x) - 10)}>${title}</text><text x="${copyX}" y="${y + h * .63}" fill="${palette.muted}" font-family="sans-serif" font-size="8"${fitTextAttribute(provider.provider.toUpperCase(), w - (copyX - x) - 10, 8)}>${xmlText(provider.provider.toUpperCase())}</text><text x="${x + 12}" y="${y + h - 6}" fill="${palette.muted}" font-family="sans-serif" font-size="8"${fitTextAttribute(provider.description, w - 24, 8)}>${xmlText(provider.description)}</text>`;
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
  if (kind.startsWith("viz-")) {
    const chartTitle = xmlText(meta.chartData?.title ?? rawTitle);
    const chartLabel = `<text x="${x + w / 2}" y="${y + Math.min(20, h * .2)}" text-anchor="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}" font-weight="700"${fitTextAttribute(meta.chartData?.title ?? rawTitle, w - 24)}>${chartTitle}</text>`;
    const values = (meta.chartData?.values?.length ? meta.chartData.values : [3, 6, 4, 8]).slice(0, 24);
    const plot = { x: x + 18, y: y + 38, w: Math.max(10, w - 36), h: Math.max(10, h - 54) };
    const maximum = Math.max(1, ...values.map(value => Math.abs(value)));
    const points = values.map((value, index) => ({ x: plot.x + (values.length < 2 ? plot.w / 2 : index * plot.w / (values.length - 1)), y: plot.y + plot.h - Math.max(0, value) / maximum * plot.h * .86 }));
    const axes = `<path d="M ${plot.x} ${plot.y} V ${plot.y + plot.h} H ${plot.x + plot.w}" fill="none" stroke="${palette.edge}" stroke-width="1"/>`;
    let chart = "";
    if (kind === "viz-bar") {
      const slot = plot.w / Math.max(1, values.length); chart = values.map((value, index) => { const height = Math.max(1, Math.max(0, value) / maximum * plot.h * .86); return `<rect x="${plot.x + index * slot + slot * .18}" y="${plot.y + plot.h - height}" width="${slot * .64}" height="${height}" rx="2" fill="${palette.accent}"/>`; }).join("");
    } else if (kind === "viz-scatter") chart = points.map(point => `<circle cx="${point.x}" cy="${point.y}" r="3" fill="${palette.accent}"/>`).join("");
    else if (kind === "viz-pie" || kind === "viz-donut") {
      const cx = x + w / 2; const cy = y + h * .58; const radius = Math.max(5, Math.min(w, h) * .29); const parts = values.map(value => Math.max(0, value)); const total = Math.max(1, parts.reduce((sum, value) => sum + value, 0)); let angle = -Math.PI / 2;
      chart = parts.map((value, index) => { const next = angle + value / total * Math.PI * 2; const startX = cx + Math.cos(angle) * radius; const startY = cy + Math.sin(angle) * radius; const endX = cx + Math.cos(next) * radius; const endY = cy + Math.sin(next) * radius; const large = next - angle > Math.PI ? 1 : 0; const color = [palette.accent, palette.edge, palette.soft, palette.muted][index % 4]; const path = kind === "viz-donut" ? `M ${cx + Math.cos(angle) * radius * .52} ${cy + Math.sin(angle) * radius * .52} L ${startX} ${startY} A ${radius} ${radius} 0 ${large} 1 ${endX} ${endY} L ${cx + Math.cos(next) * radius * .52} ${cy + Math.sin(next) * radius * .52} A ${radius * .52} ${radius * .52} 0 ${large} 0 ${cx + Math.cos(angle) * radius * .52} ${cy + Math.sin(angle) * radius * .52} Z` : `M ${cx} ${cy} L ${startX} ${startY} A ${radius} ${radius} 0 ${large} 1 ${endX} ${endY} Z`; angle = next; return `<path d="${path}" fill="${color}" stroke="${fill === "none" ? "#fff" : fill}" stroke-width="1"/>`; }).join("");
    } else {
      const line = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
      const area = kind === "viz-area" && points.length ? `<path d="${line} L ${points[points.length - 1].x} ${plot.y + plot.h} L ${points[0].x} ${plot.y + plot.h} Z" fill="${palette.accent}" fill-opacity=".16" stroke="none"/>` : "";
      chart = `${area}<path d="${line}" fill="none" stroke="${palette.accent}" stroke-width="2"/>`;
    }
    if (kind === "viz-kpi") {
      const value = values[0] ?? 0; const change = values[1] ?? 0; const trend = meta.trendDirection ?? (change > 0 ? "up" : change < 0 ? "down" : "steady");
      return `${box}${chartLabel}<text x="${x + 18}" y="${y + h * .58}" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${Math.min(30, size * 2.5)}" font-weight="700">${value}</text><text x="${x + 20}" y="${y + h * .79}" fill="${trend === "down" ? "#c15d60" : palette.accent}" font-family="sans-serif" font-size="${size * .9}">${trend === "up" ? "▲" : trend === "down" ? "▼" : "●"} ${xmlText(meta.chartData?.labels?.[1] ?? "Change")} ${change}</text>`;
    }
    return `${box}${chartLabel}${kind === "viz-pie" || kind === "viz-donut" ? "" : axes}${chart}`;
  }
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
      const diameter = Math.min(w * .56, h * .64); const radius = diameter / 2; const cy = y + h * .38; const surface = fill === "transparent" ? palette.fill : fill;
      const glyph = `<path d="M ${cx - radius * .31} ${cy - radius * .03} Q ${cx} ${cy - radius * .56} ${cx + radius * .31} ${cy - radius * .03} M ${cx - radius * .17} ${cy + radius * .12} Q ${cx} ${cy - radius * .16} ${cx + radius * .17} ${cy + radius * .12}" fill="none" stroke="${palette.accent}" stroke-width="${Math.max(1.4, strokeWidth)}" stroke-linecap="round"/><circle cx="${cx}" cy="${cy + radius * .26}" r="${Math.max(1.5, radius * .06)}" fill="${palette.accent}"/>`;
      const leds = [-.18, 0, .18].map(offset => `<circle cx="${cx + radius * offset * 3}" cy="${cy + radius * .62}" r="${Math.max(1.2, radius * .045)}" fill="${palette.accent}"/>`).join("");
      return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${palette.soft}" stroke="${edge}" stroke-width="${strokeWidth}"/><circle cx="${cx}" cy="${cy}" r="${radius * .78}" fill="${surface}" stroke="${edge}" stroke-width="${Math.max(1, strokeWidth * .7)}"/>${glyph}${leds}<text x="${cx}" y="${y + h * .88}" text-anchor="middle" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}" font-weight="700">ACCESS POINT</text>`;
    }
    return `${box}${label}<circle cx="${cx}" cy="${cy - 8}" r="10" fill="${palette.soft}" stroke="${edge}"/><path d="M ${cx} ${cy + 2} L ${x + w * .25} ${y + h * .83} M ${cx} ${cy + 2} L ${cx} ${y + h * .83} M ${cx} ${cy + 2} L ${x + w * .75} ${y + h * .83}" stroke="${edge}"/><circle cx="${x + w * .25}" cy="${y + h * .83}" r="4" fill="${palette.accent}"/><circle cx="${cx}" cy="${y + h * .83}" r="4" fill="${palette.accent}"/><circle cx="${x + w * .75}" cy="${y + h * .83}" r="4" fill="${palette.accent}"/>`;
  }
  if (kind === "network-zone" || kind === "c4-system" || kind === "c4-container") return `<rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" rx="12" fill="${fill}" fill-opacity="${meta.styleOverrides?.fillOpacity ?? 1}" stroke="${edge}" stroke-dasharray="6 4"/>${label}<rect x="${x + 16}" y="${y + 35}" width="${w * .34}" height="${h * .42}" rx="7" fill="${palette.soft}" stroke="${edge}"/><rect x="${x + w * .58}" y="${y + 35}" width="${w * .28}" height="${h * .2}" rx="6" fill="${palette.soft}" stroke="${edge}"/><rect x="${x + w * .58}" y="${y + h * .61}" width="${w * .28}" height="${h * .2}" rx="6" fill="${palette.soft}" stroke="${edge}"/>`;
  if (kind === "software-database" || kind === "cloud-database") { const left = x + w * .08; const right = x + w * .92; const ry = 10; const body = `<path d="M ${left} ${y + ry} V ${y + h - ry} A ${w * .42} ${ry} 0 0 1 ${right} ${y + h - ry} V ${y + ry} Z" fill="${fill}" stroke="${edge}"/>`; const top = `<ellipse cx="${x + w / 2}" cy="${y + 12}" rx="${w * .42}" ry="10" fill="${fill}" stroke="${edge}"/>`; const rim = `<path d="M ${left} ${y + h * .48} C ${left} ${y + h * .61}, ${right} ${y + h * .61}, ${right} ${y + h * .48}" fill="none" stroke="${edge}"/>`; return `${body}${top}${rim}${label}`; }
  if (kind === "software-queue" || kind === "cloud-queue") return `${box}${label}${[0, 1, 2].map(index => `<rect x="${x + 12 + index * ((w - 34) / 3 + 5)}" y="${y + h * .48}" width="${(w - 34) / 3}" height="${h * .27}" rx="5" fill="${palette.soft}" stroke="${edge}"/>`).join("")}`;
  if (kind === "form-button") { const caption = xmlText(meta.formOptions?.[meta.selectedOption ?? 0] ?? meta.formTitle ?? "Continue"); const buttonFill = meta.styleOverrides?.fillColor ?? (simple ? fill : palette.accent); const buttonInk = meta.styleOverrides?.color ?? (simple ? palette.ink : "#ffffff"); return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${simple ? 0 : Math.min(13, h / 2)}" fill="${buttonFill}" fill-opacity="${meta.styleOverrides?.fillOpacity ?? 1}" stroke="${edge}" stroke-width="1.5"/>${simple ? "" : `<path d="M ${x + 2} ${y + h - 3} H ${x + w - 2}" stroke="rgba(0,0,0,.12)" stroke-width="2"/>`}<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="middle" fill="${buttonInk}" font-family="sans-serif" font-size="${size}" font-weight="650">${caption}</text>`; }
  if (kind === "form-input" || kind === "form-select") { const selectValue = xmlText(meta.formOptions?.[meta.selectedOption ?? 0] ?? "Select an option"); const inset = Math.min(12, Math.max(2, w * .06)); const fieldY = y + Math.min(31, h * .42); const fieldHeight = Math.max(1, h - (fieldY - y) - Math.min(10, h * .12)); const titleText = xmlText(rawTitle); const field = `<rect x="${x + inset}" y="${fieldY}" width="${Math.max(1, w - inset * 2)}" height="${fieldHeight}" rx="${simple ? 0 : 6}" fill="${palette.fill}" stroke="${edge}"/>`; return `${box}<text x="${x + inset}" y="${y + Math.min(15, h * .2) + size * .35}" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}" font-weight="600">${titleText}</text>${field}${kind === "form-select" ? `<text x="${x + inset + 9}" y="${fieldY + fieldHeight / 2}" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}">${selectValue}</text><path d="m${x + w - inset - 12} ${fieldY + fieldHeight / 2 - 2} 4 4 4-4" fill="none" stroke="${edge}"/>` : `<path d="M ${x + inset + 9} ${fieldY + fieldHeight / 2} H ${x + w - inset - 9}" stroke="${palette.muted}"/>`}`; }
  if (kind === "form-toggle") { const sw = Math.min(48, Math.max(20, w * .25), Math.max(1, w - 16)); const sh = Math.min(26, Math.max(12, h * .44), Math.max(1, h - 8)); const sx = x + w - sw - Math.min(14, Math.max(4, w * .06)); const sy = y + (h - sh) / 2; const enabled = meta.formState !== false; return `${box}<text x="${x + 14}" y="${y + h / 2}" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}" font-weight="700">${title}</text><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="${simple ? 0 : sh / 2}" fill="${enabled ? palette.accent : palette.soft}" stroke="${edge}"/><circle cx="${sx + (enabled ? sw - sh / 2 : sh / 2)}" cy="${sy + sh / 2}" r="${Math.min(sh * .36, sw / 3)}" fill="${simple ? palette.fill : "#fff"}"/>`; }
  if (kind === "form-checkbox" || kind === "form-radio") {
    const options = (meta.formOptions?.length ? meta.formOptions : ["Option 1"]).slice(0, 12); const rowHeight = Math.min(23, (h - 30) / options.length);
    const rows = options.map((option, index) => { const cy = y + 30 + rowHeight * (index + .5); const active = kind === "form-checkbox" ? meta.formStates?.[index] ?? index === 0 : (meta.selectedOption ?? 0) === index; const marker = kind === "form-checkbox" ? `<rect x="${x + 13}" y="${cy - 6}" width="12" height="12" rx="3" fill="${palette.fill}" stroke="${edge}"/>${active ? `<path d="m${x + 16} ${cy} 2 3 4-6" fill="none" stroke="${palette.accent}" stroke-width="2"/>` : ""}` : `<circle cx="${x + 19}" cy="${cy}" r="6" fill="${palette.fill}" stroke="${edge}"/>${active ? `<circle cx="${x + 19}" cy="${cy}" r="3" fill="${palette.accent}"/>` : ""}`; return `${marker}<text x="${x + 34}" y="${cy}" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${Math.min(maxLabelSize, Math.max(6, size * .76))}">${xmlText(option)}</text>`; }).join("");
    return `${box}${label}${rows}`;
  }
  if (kind === "uml-actor") { const cx = x + w / 2; const head = Math.min(w * .22, h * .11); return `<circle cx="${cx}" cy="${y + head + 3}" r="${head}" fill="${fill}" stroke="${edge}"/><path d="M ${cx} ${y + head * 2 + 3} V ${y + h * .62} M ${x + w * .2} ${y + h * .4} H ${x + w * .8} M ${cx} ${y + h * .62} L ${x + w * .25} ${y + h * .74} M ${cx} ${y + h * .62} L ${x + w * .75} ${y + h * .74}" fill="none" stroke="${edge}"/><text x="${cx}" y="${y + h * .9}" text-anchor="middle" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}"${fitTextAttribute(rawTitle, w - 8)}>${title}</text>`; }
  if (kind === "uml-use-case") return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w * .46}" ry="${h * .4}" fill="${fill}" stroke="${edge}"/><text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}"${fitTextAttribute(rawTitle, w * .84)}>${title}</text>`;
  if (kind === "uml-lifeline") return `<rect x="${x}" y="${y}" width="${w}" height="${Math.min(34, h)}" rx="${simple ? 0 : 8}" fill="${fill}" fill-opacity="${meta.styleOverrides?.fillOpacity ?? 1}" stroke="${edge}"/><text x="${x + w / 2}" y="${y + 17}" text-anchor="middle" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}" font-weight="700">${title}</text><path d="M ${x + w / 2} ${y + 34} V ${y + h}" stroke="${edge}" stroke-dasharray="6 5"/>`;
  if (kind === "uml-activation") { const activationWidth = Math.min(w, Math.max(10, w * .44)); return `<rect x="${x + (w - activationWidth) / 2}" y="${y}" width="${activationWidth}" height="${h}" rx="4" fill="${palette.soft}" stroke="${edge}"/>`; }
  if (kind === "sequence-sync" || kind === "sequence-async" || kind.startsWith("uml-") && ["uml-inheritance", "uml-realization", "uml-aggregation", "uml-composition"].includes(kind) || kind.startsWith("er-one-") || kind === "er-many-many" || kind === "data-flow") {
    const yy = y + h / 2; const diamond = kind === "uml-aggregation" || kind === "uml-composition"; const dashed = kind === "uml-realization" ? " stroke-dasharray=\"5 4\"" : "";
    const relation = `<path d="M ${x + (diamond ? 25 : 6)} ${yy} H ${x + w - 9}" fill="none" stroke="${edge}"${dashed}/>`;
    const head = kind.startsWith("sequence-") || kind === "uml-inheritance" || kind === "uml-realization" || kind === "data-flow" ? `<path d="M ${x + w - 19} ${yy - 8} L ${x + w - 8} ${yy} L ${x + w - 19} ${yy + 8} ${kind === "sequence-sync" ? "Z" : ""}" fill="${kind === "sequence-sync" ? edge : fill}" stroke="${edge}"/>` : "";
    const diamondMark = diamond ? `<path d="M ${x + 7} ${yy} l9-6 9 6-9 6 Z" fill="${kind === "uml-composition" ? edge : fill}" stroke="${edge}"/>` : "";
    return `${relation}${head}${diamondMark}`;
  }
  if (kind === "bpmn-start" || kind === "bpmn-event" || kind === "bpmn-end") return `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${Math.min(w, h) * .44}" fill="${fill}" stroke="${edge}" stroke-width="${kind === "bpmn-end" ? 3 : 1.5}"/>${kind === "bpmn-event" ? `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${Math.min(w, h) * .34}" fill="none" stroke="${edge}"/>` : ""}`;
  if (kind === "bpmn-gateway" || kind === "bpmn-parallel-gateway") { const marks = kind === "bpmn-parallel-gateway" ? `M ${x + w / 2} ${y + h * .3} V ${y + h * .7} M ${x + w * .3} ${y + h / 2} H ${x + w * .7}` : `M ${x + w * .34} ${y + h * .34} L ${x + w * .66} ${y + h * .66} M ${x + w * .66} ${y + h * .34} L ${x + w * .34} ${y + h * .66}`; return `<path d="M ${x + w / 2} ${y} L ${x + w} ${y + h / 2} L ${x + w / 2} ${y + h} L ${x} ${y + h / 2} Z" fill="${fill}" stroke="${edge}"/><path d="${marks}" stroke="${edge}"/>`; }
  if (kind === "bpmn-task" || kind === "bpmn-pool" || kind === "bpmn-data") return `${box}${label}${kind === "bpmn-pool" ? `<path d="M ${x + 31} ${y} V ${y + h} M ${x + 31} ${y + h / 2} H ${x + w}" stroke="${edge}"/>` : ""}`;
  if (kind === "uml-class" || kind === "uml-interface" || kind === "er-table") return `${box}<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${Math.min(36, h * .28)}" rx="8" fill="${palette.soft}"/><text x="${x + 12}" y="${y + Math.min(36, h * .28) / 2}" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}" font-weight="700"${fitTextAttribute(rawTitle, w - 24)}>${title}</text><path d="M ${x} ${y + Math.min(36, h * .28)} H ${x + w} M ${x} ${y + h * .66} H ${x + w}" stroke="${edge}"/>`;
  return `${box}${label}`;
}

const componentIconImages = new Map<string, HTMLImageElement>();

export function componentIconDataUrl(group: GroupElement): string | undefined {
  const data = group.libraryComponent;
  if (!data?.iconSvg || !data.iconViewBox) return undefined;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${data.iconViewBox}">${data.iconSvg}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
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
