import type { Point } from "../../model";

const MAX_HISTORY = 24;
const STORAGE_KEY = "sketchdraw-color-history";

export type ColorSample = { color: string; timestamp: number };

export function readColorHistory(): ColorSample[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown): item is ColorSample =>
        typeof item === "object" && item !== null &&
        typeof (item as ColorSample).color === "string" &&
        /^#[\da-f]{3,8}$/i.test((item as ColorSample).color) &&
        typeof (item as ColorSample).timestamp === "number"
    ).slice(0, MAX_HISTORY);
  } catch { return []; }
}

export function writeColorHistory(history: ColorSample[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY))); } catch { /* Best-effort persistence. */ }
}

export function addColorSample(history: ColorSample[], color: string): ColorSample[] {
  const normalized = color.toLowerCase();
  const filtered = history.filter(sample => sample.color.toLowerCase() !== normalized);
  return [{ color: normalized, timestamp: Date.now() }, ...filtered].slice(0, MAX_HISTORY);
}

export function clearColorHistory(): ColorSample[] {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* Ignore. */ }
  return [];
}

export type ColorRingLayout = {
  cx: number;
  cy: number;
  radius: number;
  items: { color: string; x: number; y: number; angle: number }[];
};

export function layoutColorRing(center: Point, radius: number, colors: ColorSample[]): ColorRingLayout {
  const count = colors.length;
  const step = count > 0 ? (2 * Math.PI) / count : 0;
  return {
    cx: center.x,
    cy: center.y,
    radius,
    items: colors.map((sample, index) => {
      const angle = -Math.PI / 2 + index * step;
      return { color: sample.color, x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle), angle };
    }),
  };
}
