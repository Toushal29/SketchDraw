import type { Point, StrokePoint, SymmetryConfig, SymmetryMode } from "../../model";

export const SYMMETRY_MODES: { value: SymmetryMode; label: string; description: string }[] = [
  { value: "off", label: "Off", description: "No symmetry" },
  { value: "horizontal", label: "Horizontal", description: "Mirror left/right" },
  { value: "vertical", label: "Vertical", description: "Mirror top/bottom" },
  { value: "quad", label: "Quad", description: "Mirror all 4 quadrants" },
  { value: "radial", label: "Radial", description: "Rotate around center" },
];

export function mirrorPoint(point: Point, center: Point, config: SymmetryConfig): Point[] {
  if (config.mode === "off") return [point];

  const dx = point.x - center.x;
  const dy = point.y - center.y;

  switch (config.mode) {
    case "horizontal":
      return [point, { x: center.x - dx, y: point.y }];
    case "vertical":
      return [point, { x: point.x, y: center.y - dy }];
    case "quad":
      return [
        point,
        { x: center.x - dx, y: point.y },
        { x: point.x, y: center.y - dy },
        { x: center.x - dx, y: center.y - dy },
      ];
    case "radial": {
      const axes = config.axes ?? 6;
      const angle = Math.atan2(dy, dx);
      const dist = Math.hypot(dx, dy);
      const step = (2 * Math.PI) / axes;
      const result: Point[] = [];
      for (let i = 0; i < axes; i++) {
        const a = angle + step * i;
        result.push({ x: center.x + dist * Math.cos(a), y: center.y + dist * Math.sin(a) });
      }
      return result;
    }
    default:
      return [point];
  }
}

export function mirrorStroke(points: StrokePoint[], center: Point, config: SymmetryConfig): StrokePoint[][] {
  if (config.mode === "off") return [points];

  const axes = axisCount(config);
  const strokes: StrokePoint[][] = Array.from({ length: axes }, () => []);

  for (const point of points) {
    const mirrored = mirrorPoint(point, center, config);
    for (let i = 0; i < mirrored.length && i < axes; i++) {
      strokes[i].push({ ...point, x: mirrored[i].x, y: mirrored[i].y });
    }
  }

  return strokes;
}

function axisCount(config: SymmetryConfig): number {
  switch (config.mode) {
    case "horizontal":
    case "vertical":
      return 2;
    case "quad":
      return 4;
    case "radial":
      return config.axes ?? 6;
    default:
      return 1;
  }
}

export function drawSymmetryGuides(
  ctx: CanvasRenderingContext2D,
  center: Point,
  config: SymmetryConfig,
  canvasWidth: number,
  canvasHeight: number,
) {
  if (config.mode === "off") return;

  ctx.save();
  ctx.strokeStyle = "rgba(107, 138, 255, 0.4)";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);

  if (config.mode === "horizontal" || config.mode === "quad") {
    ctx.beginPath();
    ctx.moveTo(center.x, 0);
    ctx.lineTo(center.x, canvasHeight);
    ctx.stroke();
  }

  if (config.mode === "vertical" || config.mode === "quad") {
    ctx.beginPath();
    ctx.moveTo(0, center.y);
    ctx.lineTo(canvasWidth, center.y);
    ctx.stroke();
  }

  if (config.mode === "radial") {
    const axes = config.axes ?? 6;
    const step = Math.PI / axes;
    const radius = Math.max(canvasWidth, canvasHeight);
    for (let i = 0; i < axes; i++) {
      const angle = step * i;
      ctx.beginPath();
      ctx.moveTo(center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle));
      ctx.lineTo(center.x - radius * Math.cos(angle), center.y - radius * Math.sin(angle));
      ctx.stroke();
    }
  }

  ctx.restore();
}
