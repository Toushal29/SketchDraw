import type { FreehandElement, Point, StrokePoint } from "../../model";

export const stylusStrokeWidth = (point: StrokePoint, thickness: number) => thickness * (point.pressure === undefined ? 1 : .35 + Math.max(0, Math.min(1, point.pressure)) * 1.15) * (1 + Math.min(1, Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0) / 90) * .28);
export const stylusStrokeWidthAt = (points: StrokePoint[], index: number, thickness: number) => index === 0 ? stylusStrokeWidth(points[0], thickness) : (stylusStrokeWidth(points[index - 1], thickness) + stylusStrokeWidth(points[index], thickness)) / 2;

type StrokeCache = {
  length: number;
  pressureAware: boolean;
  body: Path2D;
  pressureBody: Map<number, Path2D>;
  complete?: Path2D;
  pressureComplete: Map<number, Path2D>;
  left: number;
  top: number;
  right: number;
  bottom: number;
  maxWidth: number;
};

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const newCache = (pressureAware = false): StrokeCache => ({ length: 0, pressureAware, body: new Path2D(), pressureBody: new Map(), pressureComplete: new Map(), left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity, maxWidth: 1 });

type StrokePath = Pick<Path2D, "moveTo" | "lineTo" | "quadraticCurveTo">;

function pressureCurve<Path extends StrokePath>(paths: Map<number, Path>, from: Point, control: Point, to: Point, startWidth: number, endWidth: number, createPath: () => Path) {
  const pathFor = (width: number) => {
    const factor = Math.max(.05, Math.round(width * 100) / 100);
    let path = paths.get(factor);
    if (!path) { path = createPath(); paths.set(factor, path); }
    return path;
  };
  const widthChange = Math.abs(endWidth - startWidth);
  if (widthChange < .005) {
    const path = pathFor((startWidth + endWidth) / 2);
    path.moveTo(from.x, from.y); path.quadraticCurveTo(control.x, control.y, to.x, to.y);
    return;
  }
  const length = Math.hypot(control.x - from.x, control.y - from.y) + Math.hypot(to.x - control.x, to.y - control.y);
  const steps = Math.min(256, Math.max(1, Math.ceil(length / 2), Math.ceil(widthChange / .01)));
  const pointAt = (t: number) => {
    const u = 1 - t;
    return { x: u * u * from.x + 2 * u * t * control.x + t * t * to.x, y: u * u * from.y + 2 * u * t * control.y + t * t * to.y };
  };
  for (let step = 0; step < steps; step++) {
    const t0 = step / steps; const t1 = (step + 1) / steps;
    const start = pointAt(t0); const end = pointAt(t1);
    const path = pathFor(startWidth + (endWidth - startWidth) * (t0 + t1) / 2);
    path.moveTo(start.x, start.y); path.lineTo(end.x, end.y);
  }
}

/** Retains incremental paths and composites translucent pressure strokes once. */
export function createFreehandRenderer() {
  const caches = new WeakMap<StrokePoint[], StrokeCache>();
  let surface: HTMLCanvasElement | undefined;
  type Raster = { canvas: HTMLCanvasElement; length: number; scale: number; ink: string; thickness: number; x: number; y: number; bytes: number; lastUsed: number };
  const rasters = new Map<StrokePoint[], Raster>();
  const rasterBudget = 24 * 1024 * 1024;
  let rasterBytes = 0;

  function releaseRaster(points: StrokePoint[]) {
    const raster = rasters.get(points); if (!raster) return;
    rasterBytes -= raster.bytes; raster.canvas.width = 0; raster.canvas.height = 0; rasters.delete(points);
  }

  function drawRaster(ctx: CanvasRenderingContext2D, element: FreehandElement, cache: StrokeCache, ink: string) {
    // Small strokes are cheaper as paths. Large cached surfaces have an explicit
    // memory bound; oversized strokes retain the viewport-clipped path renderer.
    if (element.points.length < 64 && cache.pressureComplete.size <= 1) return false;
    const transform = ctx.getTransform();
    const scale = Math.hypot(transform.a, transform.b);
    if (!Number.isFinite(scale) || scale <= 0) return false;
    let raster = rasters.get(element.points);
    const now = performance.now();
    if (raster && (raster.length !== element.points.length || raster.scale !== scale || raster.ink !== ink || raster.thickness !== element.thickness)) {
      releaseRaster(element.points); raster = undefined;
    }
    if (!raster) {
      const padding = Math.max(1, element.thickness * cache.maxWidth * .85) * scale + 2;
      const left = Math.floor(cache.left * scale - padding); const top = Math.floor(cache.top * scale - padding);
      const width = Math.ceil(cache.right * scale + padding) - left; const height = Math.ceil(cache.bottom * scale + padding) - top;
      const bytes = width * height * 4;
      if (width > 4096 || height > 4096 || bytes > 4 * 1024 * 1024) return false;
      while (rasterBytes + bytes > rasterBudget || rasters.size >= 256) {
        const oldest = rasters.keys().next().value!;
        // A working set larger than the budget must not evict/rebuild every
        // visible stroke each frame. Keep hot entries and draw overflow as paths.
        if (now - rasters.get(oldest)!.lastUsed < 500) return false;
        releaseRaster(oldest);
      }
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const layer = canvas.getContext("2d"); if (!layer) return false;
      layer.setTransform(scale, 0, 0, scale, -left, -top);
      paint(layer, element, cache, ink);
      raster = { canvas, length: element.points.length, scale, ink, thickness: element.thickness, x: left / scale, y: top / scale, bytes, lastUsed: now };
      rasterBytes += bytes;
    }
    // Refresh the least-recently-used order without retaining whole documents.
    rasters.delete(element.points); rasters.set(element.points, raster);
    raster.lastUsed = now;
    ctx.drawImage(raster.canvas, raster.x, raster.y, raster.canvas.width / scale, raster.canvas.height / scale);
    return true;
  }

  function pathsFor(points: StrokePoint[]) {
    let cache = caches.get(points);
    if (!cache || points.length < cache.length) { cache = newCache(); caches.set(points, cache); }
    if (cache.length === points.length) return cache;
    for (let index = cache.length; index < points.length; index++) {
      const point = points[index];
      const hasPressure = point.pressure !== undefined || point.tiltX !== undefined || point.tiltY !== undefined;
      if (hasPressure && !cache.pressureAware && index > 0) {
        cache = newCache(true); caches.set(points, cache); index = -1; continue;
      }
      cache.pressureAware ||= hasPressure;
      cache.left = Math.min(cache.left, point.x); cache.top = Math.min(cache.top, point.y);
      cache.right = Math.max(cache.right, point.x); cache.bottom = Math.max(cache.bottom, point.y);
      cache.maxWidth = Math.max(cache.maxWidth, stylusStrokeWidth(point, 1));
      if (index === 0) cache.body.moveTo(point.x, point.y);
      else {
        const previous = points[index - 1];
        const from = index === 1 ? points[0] : midpoint(points[index - 2], previous);
        const to = midpoint(previous, point);
        if (cache.pressureAware) pressureCurve(cache.pressureBody, from, previous, to, stylusStrokeWidthAt(points, index - 1, 1), stylusStrokeWidthAt(points, index, 1), () => new Path2D());
        else cache.body.quadraticCurveTo(previous.x, previous.y, to.x, to.y);
      }
      cache.length = index + 1;
    }
    const last = points[points.length - 1];
    if (!cache.pressureAware) {
      // Include the terminal segment in the same paint operation as the body.
      cache.complete = new Path2D(cache.body); cache.complete.lineTo(last.x, last.y);
    } else if (points.length > 1) {
      const tail = new Map<number, Path2D>();
      const from = midpoint(points[points.length - 2], last);
      pressureCurve(tail, from, midpoint(from, last), last, stylusStrokeWidthAt(points, points.length - 1, 1), stylusStrokeWidth(last, 1), () => new Path2D());
      cache.pressureComplete = new Map(cache.pressureBody);
      for (const [width, path] of tail) {
        const body = cache.pressureBody.get(width);
        const complete = body ? new Path2D(body) : new Path2D();
        complete.addPath(path); cache.pressureComplete.set(width, complete);
      }
    }
    return cache;
  }

  function paint(ctx: CanvasRenderingContext2D, element: FreehandElement, cache: StrokeCache, ink: string) {
    ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.setLineDash([]);
    if (element.points.length === 1) {
      const point = element.points[0]; const width = stylusStrokeWidth(point, element.thickness);
      const tilt = Math.min(1, Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0) / 90);
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, Math.max(.25, width * (.5 + tilt * .35)), Math.max(.25, width * .5), Math.atan2(point.tiltY ?? 0, point.tiltX ?? 0), 0, Math.PI * 2);
      ctx.fill();
    } else if (cache.pressureAware) {
      for (const [width, path] of cache.pressureComplete) { ctx.lineWidth = Math.max(.35, width * element.thickness); ctx.stroke(path); }
    } else {
      ctx.lineWidth = element.thickness; ctx.stroke(cache.complete!);
    }
  }

  function draw(ctx: CanvasRenderingContext2D, element: FreehandElement, ink: string, cacheRaster = true) {
    if (!element.points.length || ctx.globalAlpha === 0) return;
    const cache = pathsFor(element.points);
    if (cacheRaster && drawRaster(ctx, element, cache, ink)) return;
    if (!cache.pressureAware || cache.pressureComplete.size <= 1 || element.points.length === 1 || ctx.globalAlpha === 1) {
      paint(ctx, element, cache, ink); return;
    }

    // Opaque segments share a temporary surface; apply brush opacity only when
    // compositing the whole stroke. This avoids dark caps at segment overlaps.
    const transform = ctx.getTransform();
    const padding = Math.max(1, element.thickness * cache.maxWidth * .85);
    const corners = [
      [cache.left - padding, cache.top - padding], [cache.right + padding, cache.top - padding],
      [cache.left - padding, cache.bottom + padding], [cache.right + padding, cache.bottom + padding],
    ].map(([x, y]) => ({ x: transform.a * x + transform.c * y + transform.e, y: transform.b * x + transform.d * y + transform.f }));
    const left = Math.max(0, Math.floor(Math.min(...corners.map(point => point.x))) - 2);
    const top = Math.max(0, Math.floor(Math.min(...corners.map(point => point.y))) - 2);
    const right = Math.min(ctx.canvas.width, Math.ceil(Math.max(...corners.map(point => point.x))) + 2);
    const bottom = Math.min(ctx.canvas.height, Math.ceil(Math.max(...corners.map(point => point.y))) + 2);
    const width = right - left; const height = bottom - top;
    if (width <= 0 || height <= 0) return;
    surface ??= document.createElement("canvas");
    if (surface.width < width || surface.height < height || surface.width * surface.height > Math.max(16_000_000, ctx.canvas.width * ctx.canvas.height)) {
      // Grow in blocks while keeping the surface within the destination's budget.
      surface.width = Math.min(ctx.canvas.width, Math.ceil(width / 128) * 128);
      surface.height = Math.min(ctx.canvas.height, Math.ceil(height / 128) * 128);
    }
    const layer = surface.getContext("2d");
    if (!layer) return;
    layer.setTransform(1, 0, 0, 1, 0, 0); layer.clearRect(0, 0, width, height);
    layer.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e - left, transform.f - top);
    layer.globalAlpha = 1;
    paint(layer, element, cache, ink);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(surface, 0, 0, width, height, left, top, width, height);
    ctx.restore();
  }

  function clearRasterCache() { for (const points of rasters.keys()) releaseRaster(points); }
  function dispose() { clearRasterCache(); if (surface) { surface.width = 0; surface.height = 0; } surface = undefined; }

  return { draw, clearRasterCache, dispose };
}

class SvgStrokePath implements StrokePath {
  private commands: string[] = [];
  moveTo(x: number, y: number) { this.commands.push(`M ${x} ${y}`); }
  lineTo(x: number, y: number) { this.commands.push(`L ${x} ${y}`); }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) { this.commands.push(`Q ${cx} ${cy} ${x} ${y}`); }
  toString() { return this.commands.join(" "); }
}

/** SVG uses the same smoothing and a single opacity group as canvas strokes. */
export function freehandSvg(element: FreehandElement, color: string): string {
  const points = element.points;
  if (!points.length) return "";
  const ink = color.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
  if (points.length === 1) {
    const point = points[0]; const width = stylusStrokeWidth(point, element.thickness);
    const tilt = Math.min(1, Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0) / 90);
    const angle = Math.atan2(point.tiltY ?? 0, point.tiltX ?? 0) * 180 / Math.PI;
    return `<ellipse cx="${point.x}" cy="${point.y}" rx="${Math.max(.25, width * (.5 + tilt * .35))}" ry="${Math.max(.25, width * .5)}" transform="rotate(${angle} ${point.x} ${point.y})" fill="${ink}" opacity="${element.opacity ?? 1}"/>`;
  }
  const pressureAware = points.some(point => point.pressure !== undefined || point.tiltX !== undefined || point.tiltY !== undefined);
  const paths = new Map<number, SvgStrokePath>(); const body = new SvgStrokePath();
  body.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1]; const to = midpoint(previous, points[index]);
    if (pressureAware) {
      const from = index === 1 ? points[0] : midpoint(points[index - 2], previous);
      pressureCurve(paths, from, previous, to, stylusStrokeWidthAt(points, index - 1, 1), stylusStrokeWidthAt(points, index, 1), () => new SvgStrokePath());
    } else body.quadraticCurveTo(previous.x, previous.y, to.x, to.y);
  }
  const last = points[points.length - 1];
  if (pressureAware) {
    const from = midpoint(points[points.length - 2], last);
    pressureCurve(paths, from, midpoint(from, last), last, stylusStrokeWidthAt(points, points.length - 1, 1), stylusStrokeWidth(last, 1), () => new SvgStrokePath());
  } else { body.lineTo(last.x, last.y); paths.set(1, body); }
  return `<g fill="none" stroke="${ink}" opacity="${element.opacity ?? 1}" stroke-linecap="round" stroke-linejoin="round">${[...paths].map(([width, path]) => `<path d="${path}" stroke-width="${Math.max(.35, width * element.thickness)}"/>`).join("")}</g>`;
}
