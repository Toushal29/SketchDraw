import type { Element, GhostLayerConfig, SketchPage, Bounds, CanvasState } from "../../model";
import { elementBounds } from "./bounds";

export function ghostLayerElements(config: GhostLayerConfig, pages: SketchPage[]): Element[] | undefined {
  const page = pages.find(p => p.id === config.sourcePageId);
  return page?.elements;
}

export function drawGhostLayer(
  ctx: CanvasRenderingContext2D,
  elements: Element[],
  config: GhostLayerConfig,
  canvasState: CanvasState,
  drawElement: (ctx: CanvasRenderingContext2D, element: Element) => void,
) {
  const previousAlpha = ctx.globalAlpha;
  ctx.globalAlpha = config.opacity;

  if (config.tint) {
    ctx.save();
    for (const element of elements) {
      drawElement(ctx, element);
    }
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = config.tint;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(
      -canvasState.panX / canvasState.zoom,
      -canvasState.panY / canvasState.zoom,
      ctx.canvas.width / canvasState.zoom,
      ctx.canvas.height / canvasState.zoom,
    );
    ctx.restore();
  } else {
    for (const element of elements) {
      drawElement(ctx, element);
    }
  }

  ctx.globalAlpha = previousAlpha;
}

export function ghostLayerBounds(elements: Element[]): Bounds | undefined {
  if (!elements.length) return undefined;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const element of elements) {
    const bounds = elementBounds(element);
    left = Math.min(left, bounds.x);
    top = Math.min(top, bounds.y);
    right = Math.max(right, bounds.x + bounds.w);
    bottom = Math.max(bottom, bounds.y + bounds.h);
  }
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export const DEFAULT_GHOST_LAYER: GhostLayerConfig = {
  sourcePageId: "",
  opacity: 0.2,
  tint: "#6B8AFF",
};
