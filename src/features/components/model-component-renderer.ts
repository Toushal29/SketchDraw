import type { GroupElement, Theme } from "../../model";

type Palette = { ink: string; edge: string; fill: string; soft: string; muted: string; accent: string };
const paletteFor = (kind: string, dark: boolean, simple = false): Palette => {
  if (simple) return dark
    ? { ink: "#f0f1f2", edge: "#aab1b8", fill: "#25282b", soft: "#3a3f44", muted: "#c0c5c9", accent: "#d6dadd" }
    : { ink: "#252a2e", edge: "#6f777e", fill: "#ffffff", soft: "#edf0f2", muted: "#737b82", accent: "#46525b" };
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

export function drawModelComponent(ctx: CanvasRenderingContext2D, group: GroupElement, theme: Theme, preferredAppearance: "modern" | "simple" = "modern") {
  const bounds = group.componentBounds;
  const kind = group.libraryComponent?.kind;
  if (!bounds || !kind) return;
  const { x, y, w, h } = bounds;
  const meta = group.libraryComponent!;
  const appearance = meta.appearance ?? preferredAppearance;
  const simple = appearance === "simple";
  const palette = paletteFor(kind, theme === "dark", simple);
  const ink = meta.styleOverrides?.color ?? palette.ink;
  const fill = meta.styleOverrides?.fillColor === null ? "transparent" : meta.styleOverrides?.fillColor ?? palette.fill;
  const fillOpacity = meta.styleOverrides?.fillOpacity ?? 1;
  const size = Math.max(8, Math.min(160, meta.textStyle?.fontSize ?? 12));
  const name = meta.formTitle ?? meta.label ?? kind.replace(/^(network|cloud|software|bpmn|uml|c4|er)-/, "").replace(/-/g, " ").toUpperCase();
  const strokeWidth = Math.max(1.25, Math.min(2.5, Math.min(w, h) * .018));
  const shell = (radius = 12, inset = 0) => {
    roundRect(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, radius);
    if (fill !== "transparent") { ctx.save(); ctx.globalAlpha = fillOpacity; ctx.fillStyle = fill; ctx.fill(); ctx.restore(); }
    ctx.strokeStyle = ink === palette.ink ? palette.edge : ink; ctx.lineWidth = strokeWidth; ctx.stroke();
  };
  const heading = (value = name, yy = y + Math.min(18, h * .18), left = x + 14, max = w - 28) => text(ctx, value.toUpperCase(), left, yy, max, size, ink, 700);
  const centerHeading = (value = name, yy = y + h * .55) => text(ctx, value, x + w / 2, yy, w - 18, size, ink, 650, "center");

  ctx.save(); ctx.lineWidth = strokeWidth; ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (kind === "cloud-boundary") {
    cloudPath(ctx, x, y, w, h); ctx.save(); ctx.globalAlpha = fillOpacity; ctx.fillStyle = fill === "transparent" ? "#ffffff" : fill; ctx.fill(); ctx.restore();
    ctx.strokeStyle = ink === palette.ink ? palette.edge : ink; ctx.setLineDash([8, 5]); ctx.stroke(); ctx.setLineDash([]);
    text(ctx, name.toUpperCase(), x + w * .24, y + h * .36, w * .5, size + 1, ink, 700);
    text(ctx, "DEPLOYMENT BOUNDARY", x + w * .24, y + h * .36 + size + 7, w * .5, Math.max(8, size * .72), palette.muted, 500);
    ctx.restore(); return;
  }
  if (kind === "network-zone" || kind === "c4-system" || kind === "c4-container" || kind === "c4-component") {
    shell(15); ctx.setLineDash([6, 4]); ctx.strokeStyle = palette.edge; ctx.strokeRect(x + 5, y + 5, w - 10, h - 10); ctx.setLineDash([]);
    heading(); text(ctx, kind === "network-zone" ? "NETWORK BOUNDARY" : "SYSTEM CONTEXT", x + 14, y + Math.min(35, h * .28), w - 28, Math.max(8, size * .72), palette.muted, 500);
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
      if (h > 68) text(ctx, `${count} PORT${count === 1 ? "" : "S"} · REPEATER`, x + 12, y + h - 10, w - 24, 8, palette.muted, 500);
    } else {
      const count = Math.max(1, Math.min(32, Math.round(meta.portCount ?? 6)));
      shell(simple ? 0 : 11); heading(name, y + 15);
      drawPorts(ctx, x, y, w, count, palette, false);
      if (count > 8) text(ctx, `${count} PORTS`, x + w - 10, y + 15, w * .45, Math.max(8, size * .7), palette.muted, 500, "right");
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
    text(ctx, "ACCESS POINT", cx, y + h * .88, w - 12, size, ink, 700, "center");
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
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + 13, w * .43, 10, 0, 0, Math.PI * 2); ctx.fillStyle = fill === "transparent" ? "#fff" : fill; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w * .07, y + 13); ctx.lineTo(x + w * .07, y + h - 13); ctx.ellipse(x + w / 2, y + h - 13, w * .43, 10, 0, 0, Math.PI); ctx.lineTo(x + w * .93, y + 13); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * .48, w * .43, 9, 0, 0, Math.PI); ctx.stroke(); centerHeading(name, y + h * .33); ctx.restore(); return;
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
      text(ctx, caption, x + w / 2, y + h / 2, Math.max(4, w - 24), size, simple ? ink : "#ffffff", 650, "center");
    }
    else if (kind === "form-toggle") {
      const sw = Math.min(48, Math.max(30, w * .25)); const sh = Math.min(26, Math.max(18, h * .44)); const sx = Math.max(x + 7, x + w - sw - 14); const sy = y + (h - sh) / 2;
      text(ctx, name, x + 14, y + h / 2, Math.max(4, sx - x - 22), size, ink, 600);
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
        text(ctx, option || `Option ${index + 1}`, x + 34, cy, w - 47, size, palette.ink, 500);
      });
    }
    else if (kind === "form-input" || kind === "form-select") {
      const inset = Math.min(12, Math.max(2, w * .06)); const fieldY = y + Math.min(31, h * .42); const fieldHeight = Math.max(1, h - (fieldY - y) - Math.min(10, h * .12));
      text(ctx, name, x + inset, y + Math.min(15, h * .2), Math.max(4, w - inset * 2), size, ink, 600);
      roundRect(ctx, x + inset, fieldY, Math.max(1, w - inset * 2), fieldHeight, simple ? 0 : 6); ctx.fillStyle = palette.fill; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke();
      if (kind === "form-input") { ctx.beginPath(); ctx.moveTo(x + inset + 9, fieldY + fieldHeight / 2); ctx.lineTo(x + w - inset - 9, fieldY + fieldHeight / 2); ctx.strokeStyle = palette.muted; ctx.lineWidth = 1; ctx.stroke(); }
      else {
        const arrowSpace = Math.min(27, Math.max(12, w * .15)); text(ctx, meta.formOptions?.[meta.selectedOption ?? 0] ?? "Select an option", x + inset + 9, fieldY + fieldHeight / 2, Math.max(4, w - inset * 2 - arrowSpace - 12), size, palette.ink, 500);
        const ax = x + w - inset - Math.min(12, arrowSpace / 2); ctx.beginPath(); ctx.moveTo(ax - 4, fieldY + fieldHeight / 2 - 2); ctx.lineTo(ax, fieldY + fieldHeight / 2 + 2); ctx.lineTo(ax + 4, fieldY + fieldHeight / 2 - 2); ctx.strokeStyle = palette.edge; ctx.stroke();
      }
    }
    else { heading(name, y + 15); roundRect(ctx, x + 12, y + 29, w - 24, h - 40, 6); ctx.fillStyle = palette.fill; ctx.fill(); ctx.strokeStyle = palette.edge; ctx.stroke(); }
    ctx.restore(); return;
  }
  if (kind === "uml-actor") {
    const cx = x + w / 2; const head = Math.min(w * .22, h * .11); ctx.strokeStyle = ink; ctx.beginPath(); ctx.arc(cx, y + head + 3, head, 0, Math.PI * 2); ctx.moveTo(cx, y + head * 2 + 3); ctx.lineTo(cx, y + h * .62); ctx.moveTo(x + w * .2, y + h * .4); ctx.lineTo(x + w * .8, y + h * .4); ctx.moveTo(cx, y + h * .62); ctx.lineTo(x + w * .25, y + h * .74); ctx.moveTo(cx, y + h * .62); ctx.lineTo(x + w * .75, y + h * .74); ctx.stroke(); text(ctx, name, cx, y + h * .9, w - 8, size, ink, 500, "center"); ctx.restore(); return;
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
    if (kind === "sequence-sync" || kind === "sequence-async") text(ctx, name, x + w / 2, y + 9, w - 20, Math.max(8, size * .7), palette.muted, 500, "center");
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

export function modelComponentSvg(group: GroupElement, preferredAppearance: "modern" | "simple" = "modern") {
  const bounds = group.componentBounds; const kind = group.libraryComponent?.kind;
  if (!bounds || !kind) return "";
  const { x, y, w, h } = bounds; const meta = group.libraryComponent!;
  const simple = (meta.appearance ?? preferredAppearance) === "simple";
  const palette = paletteFor(kind, false, simple); const edge = meta.styleOverrides?.color ?? palette.edge;
  const fill = meta.styleOverrides?.fillColor === null ? "none" : meta.styleOverrides?.fillColor ?? palette.fill;
  const rawTitle = meta.formTitle ?? meta.label ?? kind.replace(/-/g, " ");
  const size = Math.max(8, Math.min(160, meta.textStyle?.fontSize ?? 12));
  const strokeWidth = Math.max(1.25, Math.min(2.5, Math.min(w, h) * .018));
  const xmlText = (value: string) => value.replace(/[&<>]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]!);
  const title = xmlText(rawTitle);
  if (kind === "cloud-boundary") {
    const d = `M ${x + w * .15} ${y + h * .8} C ${x + w * .04} ${y + h * .8}, ${x + w * .015} ${y + h * .66}, ${x + w * .05} ${y + h * .56} C ${x + w * .08} ${y + h * .45}, ${x + w * .17} ${y + h * .42}, ${x + w * .25} ${y + h * .44} C ${x + w * .25} ${y + h * .22}, ${x + w * .4} ${y + h * .12}, ${x + w * .53} ${y + h * .23} C ${x + w * .66} ${y + h * .05}, ${x + w * .85} ${y + h * .12}, ${x + w * .87} ${y + h * .36} C ${x + w * .97} ${y + h * .38}, ${x + w * .99} ${y + h * .49}, ${x + w * .96} ${y + h * .59} C ${x + w * .99} ${y + h * .72}, ${x + w * .9} ${y + h * .81}, ${x + w * .81} ${y + h * .8} Z`;
    return `<path d="${d}" fill="${fill}" fill-opacity="${meta.styleOverrides?.fillOpacity ?? 1}" stroke="${edge}" stroke-width="2" stroke-dasharray="8 5"/><text x="${x + w * .24}" y="${y + h * .36}" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}" font-weight="700">${title}</text><text x="${x + w * .24}" y="${y + h * .36 + size + 3}" fill="${palette.muted}" font-family="sans-serif" font-size="${Math.max(8, size * .8)}">DEPLOYMENT BOUNDARY</text>`;
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
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${simple ? 0 : 7}" fill="${fill}" fill-opacity="${meta.styleOverrides?.fillOpacity ?? 1}" stroke="${edge}"/><rect x="${x + 1}" y="${y + 1}" width="${Math.max(0, w - 2)}" height="27" fill="${palette.soft}"/><text x="${x + 12}" y="${y + 17}" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}" font-weight="700">ETHERNET HUB</text><circle cx="${x + w - 15}" cy="${y + 14}" r="3" fill="${palette.accent}"/><path d="M ${x + 9} ${y + 31} H ${x + w - 9}" stroke="${edge}"/>${ports}<text x="${x + 12}" y="${y + h - 8}" fill="${palette.muted}" font-family="sans-serif" font-size="8">${count} PORT${count === 1 ? "" : "S"} · REPEATER</text>`;
    }
    const ports = Array.from({ length: count }, (_, index) => {
      const col = index % columns; const row = Math.floor(index / columns); const cx = x + 12 + cell * (col + .5); const cy = y + 32 + row * 18;
      return `<rect x="${cx - Math.min(7, cell * .35)}" y="${cy - 5}" width="${Math.min(14, cell * .7)}" height="10" rx="2.5" fill="${fill}" stroke="${edge}"/><circle cx="${cx}" cy="${cy + 8}" r="1.4" fill="${palette.accent}"/>`;
    }).join("");
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="11" fill="${fill}" fill-opacity="${meta.styleOverrides?.fillOpacity ?? 1}" stroke="${edge}"/><text x="${x + 14}" y="${y + 15}" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}" font-weight="700">${heading}</text>${ports}`;
  }
  const box = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${simple ? 0 : 12}" fill="${fill}" fill-opacity="${meta.styleOverrides?.fillOpacity ?? 1}" stroke="${edge}" stroke-width="1.5"/>`;
  const label = `<text x="${x + w / 2}" y="${y + Math.min(20, h * .2)}" text-anchor="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}" font-weight="700">${title}</text>`;
  if (kind.startsWith("viz-")) {
    const chartTitle = xmlText(meta.chartData?.title ?? rawTitle);
    const chartLabel = `<text x="${x + w / 2}" y="${y + Math.min(20, h * .2)}" text-anchor="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}" font-weight="700">${chartTitle}</text>`;
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
  if (kind === "software-database" || kind === "cloud-database") return `<path d="M ${x + w * .08} ${y + 12} C ${x + w * .08} ${y + 1}, ${x + w * .92} ${y + 1}, ${x + w * .92} ${y + 12} V ${y + h - 12} C ${x + w * .92} ${y + h - 1}, ${x + w * .08} ${y + h - 1}, ${x + w * .08} ${y + h - 12} Z" fill="${fill}" stroke="${edge}"/><ellipse cx="${x + w / 2}" cy="${y + 12}" rx="${w * .42}" ry="10" fill="${fill}" stroke="${edge}"/><path d="M ${x + w * .08} ${y + h * .48} C ${x + w * .08} ${y + h * .61}, ${x + w * .92} ${y + h * .61}, ${x + w * .92} ${y + h * .48}" fill="none" stroke="${edge}"/>${label}`;
  if (kind === "software-queue" || kind === "cloud-queue") return `${box}${label}${[0, 1, 2].map(index => `<rect x="${x + 12 + index * ((w - 34) / 3 + 5)}" y="${y + h * .48}" width="${(w - 34) / 3}" height="${h * .27}" rx="5" fill="${palette.soft}" stroke="${edge}"/>`).join("")}`;
  if (kind === "form-button") { const caption = xmlText(meta.formOptions?.[meta.selectedOption ?? 0] ?? meta.formTitle ?? "Continue"); const buttonFill = meta.styleOverrides?.fillColor ?? (simple ? fill : palette.accent); const buttonInk = meta.styleOverrides?.color ?? (simple ? palette.ink : "#ffffff"); return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${simple ? 0 : Math.min(13, h / 2)}" fill="${buttonFill}" fill-opacity="${meta.styleOverrides?.fillOpacity ?? 1}" stroke="${edge}" stroke-width="1.5"/>${simple ? "" : `<path d="M ${x + 2} ${y + h - 3} H ${x + w - 2}" stroke="rgba(0,0,0,.12)" stroke-width="2"/>`}<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="middle" fill="${buttonInk}" font-family="sans-serif" font-size="${size}" font-weight="650">${caption}</text>`; }
  if (kind === "form-input" || kind === "form-select") { const selectValue = xmlText(meta.formOptions?.[meta.selectedOption ?? 0] ?? "Select an option"); const inset = Math.min(12, Math.max(2, w * .06)); const fieldY = y + Math.min(31, h * .42); const fieldHeight = Math.max(1, h - (fieldY - y) - Math.min(10, h * .12)); const titleText = xmlText(rawTitle); const field = `<rect x="${x + inset}" y="${fieldY}" width="${Math.max(1, w - inset * 2)}" height="${fieldHeight}" rx="${simple ? 0 : 6}" fill="${palette.fill}" stroke="${edge}"/>`; return `${box}<text x="${x + inset}" y="${y + Math.min(15, h * .2) + size * .35}" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}" font-weight="600">${titleText}</text>${field}${kind === "form-select" ? `<text x="${x + inset + 9}" y="${fieldY + fieldHeight / 2}" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}">${selectValue}</text><path d="m${x + w - inset - 12} ${fieldY + fieldHeight / 2 - 2} 4 4 4-4" fill="none" stroke="${edge}"/>` : `<path d="M ${x + inset + 9} ${fieldY + fieldHeight / 2} H ${x + w - inset - 9}" stroke="${palette.muted}"/>`}`; }
  if (kind === "form-toggle") { const sw = Math.min(48, Math.max(20, w * .25), Math.max(1, w - 16)); const sh = Math.min(26, Math.max(12, h * .44), Math.max(1, h - 8)); const sx = x + w - sw - Math.min(14, Math.max(4, w * .06)); const sy = y + (h - sh) / 2; const enabled = meta.formState !== false; return `${box}<text x="${x + 14}" y="${y + h / 2}" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}" font-weight="700">${title}</text><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="${simple ? 0 : sh / 2}" fill="${enabled ? palette.accent : palette.soft}" stroke="${edge}"/><circle cx="${sx + (enabled ? sw - sh / 2 : sh / 2)}" cy="${sy + sh / 2}" r="${Math.min(sh * .36, sw / 3)}" fill="${simple ? palette.fill : "#fff"}"/>`; }
  if (kind === "form-checkbox" || kind === "form-radio") {
    const options = (meta.formOptions?.length ? meta.formOptions : ["Option 1"]).slice(0, 12); const rowHeight = Math.min(23, (h - 30) / options.length);
    const rows = options.map((option, index) => { const cy = y + 30 + rowHeight * (index + .5); const active = kind === "form-checkbox" ? meta.formStates?.[index] ?? index === 0 : (meta.selectedOption ?? 0) === index; const marker = kind === "form-checkbox" ? `<rect x="${x + 13}" y="${cy - 6}" width="12" height="12" rx="3" fill="${palette.fill}" stroke="${edge}"/>${active ? `<path d="m${x + 16} ${cy} 2 3 4-6" fill="none" stroke="${palette.accent}" stroke-width="2"/>` : ""}` : `<circle cx="${x + 19}" cy="${cy}" r="6" fill="${palette.fill}" stroke="${edge}"/>${active ? `<circle cx="${x + 19}" cy="${cy}" r="3" fill="${palette.accent}"/>` : ""}`; return `${marker}<text x="${x + 34}" y="${cy}" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${Math.max(8, (meta.textStyle?.fontSize ?? 12) * .76)}">${xmlText(option)}</text>`; }).join("");
    return `${box}${label}${rows}`;
  }
  if (kind === "uml-actor") { const cx = x + w / 2; const head = Math.min(w * .22, h * .11); return `<circle cx="${cx}" cy="${y + head + 3}" r="${head}" fill="${fill}" stroke="${edge}"/><path d="M ${cx} ${y + head * 2 + 3} V ${y + h * .62} M ${x + w * .2} ${y + h * .4} H ${x + w * .8} M ${cx} ${y + h * .62} L ${x + w * .25} ${y + h * .74} M ${cx} ${y + h * .62} L ${x + w * .75} ${y + h * .74}" fill="none" stroke="${edge}"/><text x="${cx}" y="${y + h * .9}" text-anchor="middle" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${size}">${title}</text>`; }
  if (kind === "uml-use-case") return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w * .46}" ry="${h * .4}" fill="${fill}" stroke="${edge}"/><text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${meta.textStyle?.fontSize ?? 12}">${title}</text>`;
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
  if (kind === "uml-class" || kind === "uml-interface" || kind === "er-table") return `${box}<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${Math.min(36, h * .28)}" rx="8" fill="${palette.soft}"/><text x="${x + 12}" y="${y + Math.min(36, h * .28) / 2}" dominant-baseline="middle" fill="${meta.styleOverrides?.color ?? palette.ink}" font-family="sans-serif" font-size="${meta.textStyle?.fontSize ?? 12}" font-weight="700">${title}</text><path d="M ${x} ${y + Math.min(36, h * .28)} H ${x + w} M ${x} ${y + h * .66} H ${x + w}" stroke="${edge}"/>`;
  return `${box}${label}`;
}
