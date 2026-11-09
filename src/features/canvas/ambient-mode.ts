import type { CanvasState, Element } from "../../model";
import { elementBounds, unionBounds } from "./bounds";

export type AmbientConfig = {
  speed: number;
  pauseOnEdge: number;
  includeZoom: boolean;
};

export const DEFAULT_AMBIENT: AmbientConfig = {
  speed: 0.3,
  pauseOnEdge: 2000,
  includeZoom: true,
};

export function createAmbientController(
  getElements: () => Element[],
  getCanvasState: () => CanvasState,
  setCanvasState: (state: Partial<CanvasState>) => void,
  getViewport: () => { width: number; height: number },
) {
  let running = false;
  let frame: number | undefined;
  let path: { x: number; y: number }[] = [];
  let pathIndex = 0;
  let progress = 0;
  let pauseTimer = 0;

  function computePath(): { x: number; y: number }[] {
    const bounds = unionBounds(getElements().map(elementBounds));
    if (!bounds) return [{ x: 0, y: 0 }];
    const pad = 100;
    return [
      { x: bounds.x - pad, y: bounds.y - pad },
      { x: bounds.x + bounds.w + pad, y: bounds.y - pad },
      { x: bounds.x + bounds.w + pad, y: bounds.y + bounds.h + pad },
      { x: bounds.x - pad, y: bounds.y + bounds.h + pad },
    ];
  }

  function tick(_timestamp: number) {
    if (!running) return;
    if (path.length < 2) { path = computePath(); pathIndex = 0; progress = 0; }

    const config = DEFAULT_AMBIENT;
    if (pauseTimer > 0) {
      pauseTimer -= 16;
      frame = requestAnimationFrame(tick);
      return;
    }

    const from = path[pathIndex % path.length];
    const to = path[(pathIndex + 1) % path.length];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const segmentLength = Math.hypot(dx, dy);
    if (segmentLength < 1) { pathIndex++; frame = requestAnimationFrame(tick); return; }

    progress += config.speed;
    const t = Math.min(1, progress / segmentLength);
    const smooth = t * t * (3 - 2 * t);

    const viewport = getViewport();
    const currentX = from.x + dx * smooth;
    const currentY = from.y + dy * smooth;
    const zoom = config.includeZoom ? Math.max(0.3, Math.min(1.5, Math.min(viewport.width / segmentLength, viewport.height / segmentLength) * 0.8)) : getCanvasState().zoom;

    setCanvasState({
      panX: -currentX * zoom + viewport.width / 2,
      panY: -currentY * zoom + viewport.height / 2,
      zoom,
    });

    if (t >= 1) {
      pathIndex++;
      progress = 0;
      pauseTimer = config.pauseOnEdge;
    }

    frame = requestAnimationFrame(tick);
  }

  return {
    start() {
      if (running) return;
      running = true;
      path = computePath();
      pathIndex = 0;
      progress = 0;
      pauseTimer = 0;
      frame = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      if (frame !== undefined) { cancelAnimationFrame(frame); frame = undefined; }
    },
    isRunning: () => running,
    toggle() { if (running) this.stop(); else this.start(); },
  };
}
