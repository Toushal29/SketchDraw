import type { BlendMode, DropShadow, GradientFill, GradientStop, PatternFill, Element } from "../../model";

// ── Gradient fill rendering ──

export function createCanvasGradient(ctx: CanvasRenderingContext2D, gradient: GradientFill, x: number, y: number, w: number, h: number): CanvasGradient {
  if (gradient.type === "radial") {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const radius = Math.max(w, h) / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    addStops(grad, gradient.stops);
    return grad;
  }
  const angle = ((gradient.angle ?? 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const half = Math.max(w, h) / 2;
  const grad = ctx.createLinearGradient(cx - cos * half, cy - sin * half, cx + cos * half, cy + sin * half);
  addStops(grad, gradient.stops);
  return grad;
}

function addStops(grad: CanvasGradient, stops: GradientStop[]) {
  for (const stop of stops) {
    grad.addColorStop(Math.max(0, Math.min(1, stop.offset)), stop.color);
  }
}

export function gradientToSvgDef(id: string, gradient: GradientFill): string {
  const stops = gradient.stops.map(s => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join("");
  if (gradient.type === "radial") {
    return `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">${stops}</radialGradient>`;
  }
  const angle = gradient.angle ?? 0;
  const rad = (angle * Math.PI) / 180;
  const x1 = 50 - Math.cos(rad) * 50;
  const y1 = 50 - Math.sin(rad) * 50;
  const x2 = 50 + Math.cos(rad) * 50;
  const y2 = 50 + Math.sin(rad) * 50;
  return `<linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">${stops}</linearGradient>`;
}

export const DEFAULT_GRADIENT: GradientFill = {
  type: "linear",
  angle: 180,
  stops: [
    { offset: 0, color: "#4f46e5" },
    { offset: 1, color: "#06b6d4" },
  ],
};

// ── Pattern fill rendering ──

export function createPatternCanvas(pattern: PatternFill, size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const spacing = pattern.spacing ?? 8;
  const thickness = pattern.thickness ?? 1;
  canvas.width = spacing;
  canvas.height = spacing;
  const ctx = canvas.getContext("2d")!;
  ctx.strokeStyle = pattern.color;
  ctx.fillStyle = pattern.color;
  ctx.lineWidth = thickness;

  switch (pattern.type) {
    case "dots":
      ctx.beginPath();
      ctx.arc(spacing / 2, spacing / 2, thickness, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "hatch":
      ctx.beginPath();
      ctx.moveTo(0, spacing);
      ctx.lineTo(spacing, 0);
      ctx.stroke();
      break;
    case "crosshatch":
      ctx.beginPath();
      ctx.moveTo(0, spacing);
      ctx.lineTo(spacing, 0);
      ctx.moveTo(0, 0);
      ctx.lineTo(spacing, spacing);
      ctx.stroke();
      break;
    case "diagonal":
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(spacing, spacing);
      ctx.stroke();
      break;
    case "horizontal-lines":
      ctx.beginPath();
      ctx.moveTo(0, spacing / 2);
      ctx.lineTo(spacing, spacing / 2);
      ctx.stroke();
      break;
    case "vertical-lines":
      ctx.beginPath();
      ctx.moveTo(spacing / 2, 0);
      ctx.lineTo(spacing / 2, spacing);
      ctx.stroke();
      break;
  }
  return canvas;
}

export function patternToSvgDef(id: string, pattern: PatternFill): string {
  const spacing = pattern.spacing ?? 8;
  const thickness = pattern.thickness ?? 1;
  let content = "";
  switch (pattern.type) {
    case "dots":
      content = `<circle cx="${spacing / 2}" cy="${spacing / 2}" r="${thickness}" fill="${pattern.color}"/>`;
      break;
    case "hatch":
      content = `<line x1="0" y1="${spacing}" x2="${spacing}" y2="0" stroke="${pattern.color}" stroke-width="${thickness}"/>`;
      break;
    case "crosshatch":
      content = `<line x1="0" y1="${spacing}" x2="${spacing}" y2="0" stroke="${pattern.color}" stroke-width="${thickness}"/><line x1="0" y1="0" x2="${spacing}" y2="${spacing}" stroke="${pattern.color}" stroke-width="${thickness}"/>`;
      break;
    default:
      content = `<line x1="0" y1="${spacing / 2}" x2="${spacing}" y2="${spacing / 2}" stroke="${pattern.color}" stroke-width="${thickness}"/>`;
  }
  return `<pattern id="${id}" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse">${content}</pattern>`;
}

export const DEFAULT_PATTERN: PatternFill = {
  type: "hatch",
  color: "#666666",
  spacing: 8,
  thickness: 1,
};

// ── Drop shadow rendering ──

export function applyShadowToContext(ctx: CanvasRenderingContext2D, shadow: DropShadow) {
  ctx.shadowOffsetX = shadow.offsetX;
  ctx.shadowOffsetY = shadow.offsetY;
  ctx.shadowBlur = shadow.blur;
  ctx.shadowColor = shadow.color;
}

export function clearShadowFromContext(ctx: CanvasRenderingContext2D) {
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

export function shadowToCssFilter(shadow: DropShadow): string {
  return `drop-shadow(${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${shadow.color})`;
}

export function shadowToSvgFilter(id: string, shadow: DropShadow): string {
  return `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${shadow.offsetX}" dy="${shadow.offsetY}" stdDeviation="${shadow.blur / 2}" flood-color="${shadow.color}"/></filter>`;
}

export const DEFAULT_SHADOW: DropShadow = {
  offsetX: 2,
  offsetY: 4,
  blur: 8,
  color: "rgba(0, 0, 0, 0.25)",
};

// ── Blend mode rendering ──

export function applyBlendMode(ctx: CanvasRenderingContext2D, mode?: BlendMode) {
  ctx.globalCompositeOperation = blendModeToComposite(mode ?? "normal");
}

function blendModeToComposite(mode: BlendMode): GlobalCompositeOperation {
  switch (mode) {
    case "multiply": return "multiply";
    case "screen": return "screen";
    case "overlay": return "overlay";
    case "darken": return "darken";
    case "lighten": return "lighten";
    case "color-dodge": return "color-dodge";
    case "color-burn": return "color-burn";
    case "hard-light": return "hard-light";
    case "soft-light": return "soft-light";
    case "difference": return "difference";
    case "exclusion": return "exclusion";
    default: return "source-over";
  }
}

export const BLEND_MODE_OPTIONS: { value: BlendMode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" },
  { value: "lighten", label: "Lighten" },
  { value: "color-dodge", label: "Color Dodge" },
  { value: "color-burn", label: "Color Burn" },
  { value: "hard-light", label: "Hard Light" },
  { value: "soft-light", label: "Soft Light" },
  { value: "difference", label: "Difference" },
  { value: "exclusion", label: "Exclusion" },
];

// ── Element effect helpers ──

export function hasVisualEffects(element: Element): boolean {
  if (element.type === "freehand") return false;
  if ("gradientFill" in element && element.gradientFill) return true;
  if ("patternFill" in element && element.patternFill) return true;
  if ("dropShadow" in element && element.dropShadow) return true;
  if ("blendMode" in element && element.blendMode && element.blendMode !== "normal") return true;
  return false;
}
