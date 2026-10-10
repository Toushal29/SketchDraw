import type { CanvasState, Point, StrokePoint } from "../../model";

export type CanvasGridStyle = "plain" | "dots" | "lines" | "small-dots" | "ruled" | "small-grid" | "isometric";

export function pointerToWorld(clientX: number, clientY: number, rect: DOMRect, state: CanvasState): Point {
  return { x: (clientX - rect.left - state.panX) / state.zoom, y: (clientY - rect.top - state.panY) / state.zoom };
}

export function strokePointFromPointer(event: PointerEvent, point: Point, pressureEnabled: boolean, tiltEnabled: boolean): StrokePoint {
  if (event.pointerType !== "pen") return point;
  return {
    ...point,
    ...(pressureEnabled ? { pressure: Math.max(0, Math.min(1, event.pressure > 0 ? event.pressure : .5)) } : {}),
    ...(tiltEnabled ? { tiltX: Math.max(-90, Math.min(90, event.tiltX)), tiltY: Math.max(-90, Math.min(90, event.tiltY)) } : {}),
  };
}

export function snapCanvasPoint(point: Point, enabled: boolean, style: CanvasGridStyle, gridSize: number): Point {
  if (!enabled) return point;
  if (style === "isometric") {
    const rowStep = gridSize * Math.sqrt(3) / 2;
    const row = Math.round(point.y / rowStep);
    const phase = Math.abs(row % 2) === 1 ? gridSize / 2 : 0;
    return { x: Math.round((point.x - phase) / gridSize) * gridSize + phase, y: row * rowStep };
  }
  return { x: Math.round(point.x / gridSize) * gridSize, y: Math.round(point.y / gridSize) * gridSize };
}
