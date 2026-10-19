import type { CanvasState, Point, StrokePoint } from "../../model";

export type CanvasGridStyle = "plain" | "dots" | "lines" | "small-dots" | "ruled" | "small-grid" | "isometric";

export function gridSpacingForStyle(style: CanvasGridStyle, gridSize: number): number {
  return style === "small-dots" || style === "small-grid" ? gridSize / 2 : gridSize;
}

export function gridStepForStyle(style: CanvasGridStyle, gridSize: number, zoom: number, pixelRatio = 1): number {
  const baseStep = gridSpacingForStyle(style, gridSize);
  // Fine paper uses exact half-grid subdivisions. At low zoom, skip by powers
  // of two from the same origin so its visible lines still land on that lattice.
  const downsample = Math.max(1, 2 ** Math.max(0, Math.ceil(Math.log2(12 / (baseStep * Math.max(0.02, zoom))))));
  const rawStep = baseStep * downsample;
  // Quantize the visible pitch to a whole backing-canvas pixel. This keeps
  // every repeated interval equal instead of alternating between rounded
  // device-pixel widths at fractional zoom/DPI combinations.
  const physicalScale = Math.max(0.02, zoom) * Math.max(0.25, pixelRatio);
  return Math.round(rawStep * physicalScale) / physicalScale;
}

export function isometricRowHeight(step: number): number {
  return step * Math.sqrt(3) / 2;
}

export function isometricRowOffset(row: number, step: number): number {
  return Math.abs(row % 2) === 1 ? step / 2 : 0;
}

export function gridSvgPattern(style: CanvasGridStyle, step: number): { width: number; height: number; path?: string; dotRadius?: number } {
  if (style === "isometric") {
    const rowHeight = isometricRowHeight(step);
    const width = step * 2;
    const segments: string[] = [];
    for (let row = 0; row <= 2; row++) {
      const phase = isometricRowOffset(row, step);
      const firstColumn = Math.floor((0 - phase) / step) - 1;
      const lastColumn = Math.ceil((width - phase) / step) + 1;
      for (let column = firstColumn; column <= lastColumn; column++) {
        const x = column * step + phase;
        segments.push(`M ${x} ${row * rowHeight} H ${x + step}`);
        if (row < 2) {
          segments.push(`M ${x} ${row * rowHeight} L ${x - step / 2} ${(row + 1) * rowHeight}`);
          segments.push(`M ${x} ${row * rowHeight} L ${x + step / 2} ${(row + 1) * rowHeight}`);
        }
      }
    }
    return { width, height: rowHeight * 2, path: segments.join(" ") };
  }
  if (style === "lines" || style === "small-grid") return { width: step, height: step, path: `M 0 0 H ${step} M 0 0 V ${step}` };
  if (style === "ruled") return { width: step, height: step, path: `M 0 ${step} H ${step}` };
  return { width: step, height: step, dotRadius: style === "small-dots" ? 0.65 : 0.85 };
}

export function pointerToWorld(clientX: number, clientY: number, rect: DOMRect, state: CanvasState): Point {
  return { x: (clientX - rect.left - state.panX) / state.zoom, y: (clientY - rect.top - state.panY) / state.zoom };
}

/** Keep the world point beneath a viewport point fixed while changing zoom. */
export function zoomCanvasStateAt(state: CanvasState, viewportPoint: Point, requestedZoom: number): CanvasState {
  const zoom = Math.max(0.02, Math.min(8, Number.isFinite(requestedZoom) ? requestedZoom : state.zoom));
  const worldX = (viewportPoint.x - state.panX) / state.zoom;
  const worldY = (viewportPoint.y - state.panY) / state.zoom;
  return { ...state, zoom, panX: viewportPoint.x - worldX * zoom, panY: viewportPoint.y - worldY * zoom };
}

export type CanvasTouchGestureSnapshot = {
  action: "pan" | "zoom" | "panZoom" | "none";
  initialDistance: number;
  initialZoom: number;
  initialPanX: number;
  initialPanY: number;
  initialMidpoint: Point;
  worldAnchor: Point;
};

/** Apply a two- or three-finger gesture while preserving its chosen canvas anchor. */
export function canvasStateForTouchGesture(
  state: CanvasState,
  gesture: CanvasTouchGestureSnapshot,
  midpoint: Point,
  distance: number,
  viewportOffset: Point = { x: 0, y: 0 },
): CanvasState {
  if (gesture.action === "none") return state;
  const zoom = gesture.action === "pan"
    ? gesture.initialZoom
    : Math.max(0.02, Math.min(8, gesture.initialZoom * Math.max(0.01, distance) / Math.max(0.01, gesture.initialDistance)));
  if (gesture.action === "pan") {
    return { ...state, zoom, panX: gesture.initialPanX + midpoint.x - gesture.initialMidpoint.x, panY: gesture.initialPanY + midpoint.y - gesture.initialMidpoint.y };
  }
  const anchor = gesture.action === "zoom" ? gesture.initialMidpoint : midpoint;
  return {
    ...state,
    zoom,
    panX: anchor.x - viewportOffset.x - gesture.worldAnchor.x * zoom,
    panY: anchor.y - viewportOffset.y - gesture.worldAnchor.y * zoom,
  };
}

export function strokePointFromPointer(event: PointerEvent, point: Point, pressureEnabled: boolean, tiltEnabled: boolean): StrokePoint {
  if (event.pointerType !== "pen") return point;
  return {
    ...point,
    ...(pressureEnabled ? { pressure: Math.max(0, Math.min(1, event.pressure > 0 ? event.pressure : .5)) } : {}),
    ...(tiltEnabled ? { tiltX: Math.max(-90, Math.min(90, event.tiltX)), tiltY: Math.max(-90, Math.min(90, event.tiltY)), orientation: ((Number.isFinite(event.twist) ? event.twist : 0) % 360 + 360) % 360 } : {}),
  };
}

export function snapCanvasPoint(point: Point, enabled: boolean, style: CanvasGridStyle, gridSize: number, zoom = 1, pixelRatio = 1): Point {
  if (!enabled) return point;
  // Match the grid's zoom-dependent spacing so snapped points always land on
  // a grid mark that is currently visible on the canvas.
  const step = gridStepForStyle(style, gridSize, zoom, pixelRatio);
  if (style === "isometric") {
    const rowStep = isometricRowHeight(step);
    const nearestRow = Math.floor(point.y / rowStep);
    let closest = { x: 0, y: 0, distance: Infinity };
    for (let row = nearestRow - 1; row <= nearestRow + 2; row++) {
      const phase = isometricRowOffset(row, step);
      const x = Math.round((point.x - phase) / step) * step + phase;
      const y = row * rowStep;
      const distance = (x - point.x) ** 2 + (y - point.y) ** 2;
      if (distance < closest.distance) closest = { x, y, distance };
    }
    return { x: closest.x, y: closest.y };
  }
  const snapIndex = (value: number) => Math.round(value / step) * step;
  return { x: snapIndex(point.x), y: snapIndex(point.y) };
}
