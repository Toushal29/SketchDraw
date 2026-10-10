import type { FontFamily, ShapeElement, Theme } from "../../model";
import { labelBox, textFont, textLayout } from "../../operations";

export function fontCss(family?: FontFamily): string {
  return family === "hand" ? "cursive" : family === "serif" ? "Georgia, serif" : family === "mono" ? "'Cascadia Mono', Consolas, monospace" : "'DM Sans', sans-serif";
}

export function themeInk(color: string, activeTheme: Theme): string {
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color);
  if (!match) return color;
  const hex = match[1].length === 3 ? [...match[1]].map(part => part + part).join("") : match[1];
  const channels = [0, 2, 4].map(index => Number.parseInt(hex.slice(index, index + 2), 16));
  const [red, green, blue] = channels;
  const isNeutral = Math.max(red, green, blue) - Math.min(red, green, blue) < 22;
  if (!isNeutral) return color;
  const luminance = red * .2126 + green * .7152 + blue * .0722;
  if (activeTheme === "dark" && luminance < 105) return "#f4f4f2";
  if (activeTheme === "light" && luminance > 235) return "#252525";
  return color;
}

export function drawShapeLabel(ctx: CanvasRenderingContext2D, shape: ShapeElement, activeTheme: Theme) {
  const label = shape.label;
  if (!label?.text) return;
  ctx.save(); ctx.font = textFont(label); ctx.fillStyle = themeInk(label.color, activeTheme); ctx.globalAlpha = (shape.opacity ?? 1) * (label.opacity ?? 1); ctx.textBaseline = "top"; ctx.textAlign = "left";
  const box = labelBox(shape); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
  for (const run of textLayout(ctx, shape)) { ctx.fillText(run.text, run.x, run.y); if (label.underline) ctx.fillRect(run.x, run.y + label.fontSize * 1.06, ctx.measureText(run.text).width, Math.max(1, label.fontSize / 18)); }
  ctx.restore();
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

export function shapeLabelSvg(shape: ShapeElement, ctx: CanvasRenderingContext2D, activeTheme: Theme): string {
  const label = shape.label;
  if (!label?.text) return "";
  return `<g fill="${escapeXml(themeInk(label.color, activeTheme))}" opacity="${(shape.opacity ?? 1) * (label.opacity ?? 1)}" font-size="${label.fontSize}" font-family="${label.fontFamily === "hand" ? "cursive" : "sans-serif"}" font-weight="${label.bold ? 700 : 400}" font-style="${label.italic ? "italic" : "normal"}" text-decoration="${label.underline ? "underline" : "none"}">${textLayout(ctx, shape).map(run => `<text x="${run.x}" y="${run.y + label.fontSize * .8}">${escapeXml(run.text)}</text>`).join("")}</g>`;
}

export type CanvasRendererPorts = {
  canvas: () => HTMLCanvasElement | undefined;
  hasDocument: () => boolean;
  drawScene: (ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number, includeSelection: boolean) => void;
};

/** Owns the canvas paint frame sizing and animation-frame scheduling. */
export function createCanvasRenderScheduler(ports: CanvasRendererPorts) {
  let frame: number | undefined;

  function render() {
    const canvas = ports.canvas();
    if (!ports.hasDocument() || !canvas?.isConnected) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 8192 / rect.width, 8192 / rect.height, Math.sqrt(16_000_000 / (rect.width * rect.height)));
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) { canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr); }
    const ctx = canvas.getContext("2d");
    if (ctx) ports.drawScene(ctx, rect.width, rect.height, dpr, true);
  }

  function schedule() {
    if (frame !== undefined) return;
    frame = requestAnimationFrame(() => { frame = undefined; render(); });
  }

  function dispose() {
    if (frame !== undefined) cancelAnimationFrame(frame);
  }

  return { render, schedule, dispose };
}
