import type { PressureCurve, PressureCurvePoint } from "../../model";

const STORAGE_KEY = "sketchdraw-pressure-curve";

export const DEFAULT_PRESSURE_CURVE: PressureCurve = {
  points: [
    { input: 0, output: 0 },
    { input: 0.25, output: 0.2 },
    { input: 0.75, output: 0.85 },
    { input: 1, output: 1 },
  ],
  minThickness: 0.35,
  maxThickness: 1.15,
};

export const LINEAR_CURVE: PressureCurve = {
  points: [{ input: 0, output: 0 }, { input: 1, output: 1 }],
  minThickness: 0.35,
  maxThickness: 1.15,
};

export const SOFT_CURVE: PressureCurve = {
  points: [
    { input: 0, output: 0 },
    { input: 0.3, output: 0.5 },
    { input: 0.7, output: 0.9 },
    { input: 1, output: 1 },
  ],
  minThickness: 0.4,
  maxThickness: 1.0,
};

export const FIRM_CURVE: PressureCurve = {
  points: [
    { input: 0, output: 0 },
    { input: 0.4, output: 0.1 },
    { input: 0.8, output: 0.6 },
    { input: 1, output: 1 },
  ],
  minThickness: 0.3,
  maxThickness: 1.3,
};

export const PRESSURE_PRESETS: { name: string; curve: PressureCurve }[] = [
  { name: "Default", curve: DEFAULT_PRESSURE_CURVE },
  { name: "Linear", curve: LINEAR_CURVE },
  { name: "Soft", curve: SOFT_CURVE },
  { name: "Firm", curve: FIRM_CURVE },
];

export function readPressureCurve(): PressureCurve {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_PRESSURE_CURVE;
    const parsed = JSON.parse(stored);
    if (isValidCurve(parsed)) return parsed;
  } catch { /* Fall through. */ }
  return DEFAULT_PRESSURE_CURVE;
}

export function writePressureCurve(curve: PressureCurve) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(curve)); } catch { /* Best-effort. */ }
}

function isValidCurve(value: unknown): value is PressureCurve {
  if (typeof value !== "object" || !value) return false;
  const candidate = value as PressureCurve;
  return Array.isArray(candidate.points) && candidate.points.length >= 2 && candidate.points.length <= 64 &&
    candidate.points.every((point, index) => typeof point?.input === "number" && Number.isFinite(point.input) && point.input >= 0 && point.input <= 1 && typeof point.output === "number" && Number.isFinite(point.output) && point.output >= 0 && point.output <= 1 && (index === 0 || point.input > candidate.points[index - 1].input)) &&
    candidate.points[0].input === 0 && candidate.points[candidate.points.length - 1].input === 1 &&
    typeof candidate.minThickness === "number" && Number.isFinite(candidate.minThickness) && candidate.minThickness > 0 && candidate.minThickness <= 4 &&
    typeof candidate.maxThickness === "number" && Number.isFinite(candidate.maxThickness) && candidate.maxThickness >= candidate.minThickness && candidate.maxThickness <= 4;
}

export function evaluateCurve(points: PressureCurvePoint[], input: number): number {
  const clamped = Math.max(0, Math.min(1, input));
  if (points.length === 0) return clamped;
  if (clamped <= points[0].input) return points[0].output;
  if (clamped >= points[points.length - 1].input) return points[points.length - 1].output;

  let lower = points[0];
  let upper = points[points.length - 1];
  for (const point of points) {
    if (point.input <= clamped && point.input > lower.input) lower = point;
    if (point.input >= clamped && point.input < upper.input) upper = point;
  }
  if (lower.input === upper.input) return lower.output;
  const t = (clamped - lower.input) / (upper.input - lower.input);
  const smoothT = t * t * (3 - 2 * t);
  return lower.output + (upper.output - lower.output) * smoothT;
}

export function applyPressureCurve(pressure: number, curve: PressureCurve): number {
  const mapped = evaluateCurve(curve.points, pressure);
  return curve.minThickness + mapped * (curve.maxThickness - curve.minThickness);
}
