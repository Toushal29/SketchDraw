import type { StrokePoint, StrokeSmoothingProfile, StrokeDynamics, PressureCurvePoint } from "../../model";
import { evaluateCurve } from "./pressure-curve";

export const DYNAMICS_OPTIONS: { value: StrokeDynamics; label: string; description: string }[] = [
  { value: "pressure", label: "Pressure", description: "Stylus pressure controls width" },
  { value: "velocity", label: "Velocity", description: "Drawing speed controls width (fast = thin, slow = thick)" },
  { value: "tilt", label: "Tilt", description: "Stylus angle controls width" },
];

export const DEFAULT_PROFILE: StrokeSmoothingProfile = {
  dynamics: "pressure",
  strength: 0.5,
};

export const VELOCITY_PROFILE: StrokeSmoothingProfile = {
  dynamics: "velocity",
  strength: 0.6,
  curve: [
    { input: 0, output: 1 },
    { input: 0.3, output: 0.7 },
    { input: 0.7, output: 0.3 },
    { input: 1, output: 0.1 },
  ],
};

export const TILT_PROFILE: StrokeSmoothingProfile = {
  dynamics: "tilt",
  strength: 0.5,
};

export function computeDynamicWidth(
  point: StrokePoint,
  previousPoint: StrokePoint | undefined,
  baseThickness: number,
  profile: StrokeSmoothingProfile,
  timeDelta?: number,
): number {
  const strength = Math.max(0, Math.min(1, profile.strength));

  switch (profile.dynamics) {
    case "pressure": {
      const pressure = point.pressure ?? 0.5;
      const curve = profile.curve;
      const mapped = curve ? evaluateCurve(curve, pressure) : pressure;
      return baseThickness * (1 - strength + strength * mapped * 2);
    }

    case "velocity": {
      if (!previousPoint || !timeDelta || timeDelta <= 0) return baseThickness;
      const dx = point.x - previousPoint.x;
      const dy = point.y - previousPoint.y;
      const distance = Math.hypot(dx, dy);
      const velocity = Math.min(1, distance / (timeDelta * 2));
      const curve = profile.curve;
      const mapped = curve ? evaluateCurve(curve, velocity) : 1 - velocity;
      return baseThickness * (1 - strength + strength * mapped * 2);
    }

    case "tilt": {
      const tiltMagnitude = Math.min(1, Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0) / 90);
      const mapped = 0.4 + tiltMagnitude * 0.6;
      return baseThickness * (1 - strength + strength * mapped * 2);
    }

    default:
      return baseThickness;
  }
}

export function smoothWidths(widths: number[], windowSize: number = 3): number[] {
  if (widths.length <= windowSize) return widths;
  const half = Math.floor(windowSize / 2);
  return widths.map((_, index) => {
    let sum = 0;
    let count = 0;
    for (let offset = -half; offset <= half; offset++) {
      const i = index + offset;
      if (i >= 0 && i < widths.length) {
        sum += widths[i];
        count++;
      }
    }
    return sum / count;
  });
}
