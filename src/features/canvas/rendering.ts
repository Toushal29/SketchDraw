import type { FontFamily, ShapeElement, Theme } from "../../model";
import { labelBox, textFont, textLayout } from "../../operations";

export function fontCss(family?: FontFamily): string {
  return family === "hand" ? "'Comic Sans MS', 'Segoe Print', cursive"
    : family === "serif" ? "Georgia, 'Times New Roman', serif"
      : family === "mono" ? "'Cascadia Mono', Consolas, monospace"
        : family === "rounded" ? "'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif"
          : family === "display" ? "'Arial Black', Impact, sans-serif" : "'DM Sans', 'Segoe UI', sans-serif";
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
  return `<g fill="${escapeXml(themeInk(label.color, activeTheme))}" opacity="${(shape.opacity ?? 1) * (label.opacity ?? 1)}" font-size="${label.fontSize}" font-family="${escapeXml(fontCss(label.fontFamily))}" font-weight="${label.bold ? 700 : 400}" font-style="${label.italic ? "italic" : "normal"}" text-decoration="${label.underline ? "underline" : "none"}">${textLayout(ctx, shape).map(run => `<text x="${run.x}" y="${run.y + label.fontSize * .8}">${escapeXml(run.text)}</text>`).join("")}</g>`;
}

export type CanvasRendererPorts = {
  canvas: () => HTMLCanvasElement | undefined;
  hasDocument: () => boolean;
  drawScene: (ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number, includeSelection: boolean, includeStrokePreview?: boolean) => void;
  hasStrokePreview?: () => boolean;
  drawStrokePreview?: (ctx: CanvasRenderingContext2D, dpr: number) => void;
};

/** Owns the canvas paint frame sizing and animation-frame scheduling. */
export function createCanvasRenderScheduler(ports: CanvasRendererPorts) {
  let frame: number | undefined;
  let sceneDirty = true;
  let background: HTMLCanvasElement | undefined;
  let backgroundTarget: HTMLCanvasElement | undefined;

  function releaseBackground() {
    if (background) { background.width = 0; background.height = 0; }
    background = undefined; backgroundTarget = undefined;
  }

  function render() {
    const canvas = ports.canvas();
    if (!ports.hasDocument() || !canvas?.isConnected) { releaseBackground(); return; }
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) { releaseBackground(); return; }
    const dpr = Math.min(window.devicePixelRatio || 1, 8192 / rect.width, 8192 / rect.height, Math.sqrt(16_000_000 / (rect.width * rect.height)));
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) { canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr); sceneDirty = true; }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!ports.hasStrokePreview?.() || !ports.drawStrokePreview) {
      releaseBackground(); ports.drawScene(ctx, rect.width, rect.height, dpr, true); sceneDirty = false; return;
    }
    if (sceneDirty || !background || backgroundTarget !== canvas) {
      ports.drawScene(ctx, rect.width, rect.height, dpr, true, false);
      background ??= document.createElement("canvas");
      if (background.width !== canvas.width || background.height !== canvas.height) { background.width = canvas.width; background.height = canvas.height; }
      const layer = background.getContext("2d");
      if (layer) {
        layer.clearRect(0, 0, background.width, background.height); layer.drawImage(canvas, 0, 0);
        backgroundTarget = canvas; sceneDirty = false;
      } else { releaseBackground(); sceneDirty = true; }
    } else {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(background, 0, 0); ctx.restore();
    }
    ports.drawStrokePreview(ctx, dpr);
  }

  function schedule() {
    sceneDirty = true;
    schedulePreview();
  }

  function schedulePreview() {
    if (frame !== undefined) return;
    frame = requestAnimationFrame(() => { frame = undefined; render(); });
  }

  function dispose() {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined; releaseBackground();
  }

  return { render, schedule, schedulePreview, dispose };
}
