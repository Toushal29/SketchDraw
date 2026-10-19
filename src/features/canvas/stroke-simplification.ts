import type { StrokePoint } from "../../model";

const ATTRIBUTE_TOLERANCE: Record<"pressure" | "tiltX" | "tiltY" | "orientation", number> = {
  pressure: 0.035,
  tiltX: 2,
  tiltY: 2,
  orientation: 3,
};

function circularDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

function preservesStrokeAttributes(a: StrokePoint, b: StrokePoint, c: StrokePoint, t: number, pressureTolerance: number) {
  for (const key of Object.keys(ATTRIBUTE_TOLERANCE) as (keyof typeof ATTRIBUTE_TOLERANCE)[]) {
    const start = a[key]; const middle = b[key]; const end = c[key];
    if (start === undefined && middle === undefined && end === undefined) continue;
    if (start === undefined || middle === undefined || end === undefined) return false;
    const expected = key === "orientation" ? start + circularDelta(start, end) * t : start + (end - start) * t;
    const error = key === "orientation" ? Math.abs(circularDelta(expected, middle)) : Math.abs(middle - expected);
    if (error > (key === "pressure" ? pressureTolerance : ATTRIBUTE_TOLERANCE[key])) return false;
  }
  return true;
}

function distanceToSegment(point: StrokePoint, start: StrokePoint, end: StrokePoint) {
  const dx = end.x - start.x; const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const x = start.x + dx * t; const y = start.y + dy * t;
  return { distance: Math.hypot(point.x - x, point.y - y), t };
}

/**
 * Appends one sample while removing only a nearly straight middle sample whose
 * position and stylus attributes can be interpolated within the given error.
 * Keep a bounded sample spacing because the pressure brush's smoothing changes
 * when dense input is reduced to long straight segments. The first point and
 * current endpoint are always retained.
 */
export function appendSimplifiedStrokePoint(points: StrokePoint[], point: StrokePoint, tolerance: number, pressureTolerance = ATTRIBUTE_TOLERANCE.pressure, maxSegmentLength = Infinity) {
  if (points.length >= 2) {
    const start = points[points.length - 2];
    const middle = points[points.length - 1];
    const deviation = distanceToSegment(middle, start, point);
    if (deviation.distance <= tolerance && Math.hypot(point.x - start.x, point.y - start.y) <= maxSegmentLength && preservesStrokeAttributes(start, middle, point, deviation.t, pressureTolerance)) {
      points[points.length - 1] = point;
      return;
    }
  }
  points.push(point);
}
