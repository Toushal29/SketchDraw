import type { StrokeStyle } from "../../model";

export function strokeDashPattern(style: StrokeStyle | undefined, thickness: number): number[] {
  if (style === "dashed") return [thickness * 4, thickness * 2.5];
  if (style === "dotted") return [thickness, thickness * 2.2];
  return [];
}

export function strokeStyleLineGap(style: StrokeStyle | undefined, thickness: number): number {
  return style === "double" ? Math.max(2.5, thickness * 1.2) : 0;
}
