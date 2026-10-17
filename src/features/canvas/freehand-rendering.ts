import type { FreehandElement, Point, StrokePoint } from "../../model";
import { getStroke } from "perfect-freehand";

export const stylusStrokeWidth = (point: StrokePoint, thickness: number) => thickness * (point.pressure === undefined ? 1 : .35 + Math.max(0, Math.min(1, point.pressure)) * 1.15) * (1 + Math.min(1, Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0) / 90) * .28);
export const stylusStrokeWidthAt = (points: StrokePoint[], index: number, thickness: number) => index === 0 ? stylusStrokeWidth(points[0], thickness) : (stylusStrokeWidth(points[index - 1], thickness) + stylusStrokeWidth(points[index], thickness)) / 2;

type StrokeCache = {
  length: number;
  pressureAware: boolean;
  preview: Path2D;
  previewWidthTotal: number;
  pressureOutline?: Path2D;
  pressureThickness?: number;
  pressureLength: number;
  complete?: Path2D;
  left: number;
  top: number;
  right: number;
  bottom: number;
  maxWidth: number;
};

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const newCache = (pressureAware = false): StrokeCache => ({ length: 0, pressureAware, preview: new Path2D(), previewWidthTotal: 0, pressureLength: 0, left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity, maxWidth: 1 });

function appendPressureSample(path: Path2D, points: StrokePoint[], index: number, thickness: number) {
  const point = points[index]; const radius = Math.max(.25, stylusStrokeWidth(point, thickness) / 2);
  if (index === 0) {
    const width = radius * 2; const tilt = Math.min(1, Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0) / 90);
    path.ellipse(point.x, point.y, Math.max(.25, width * (.5 + tilt * .35)), Math.max(.25, width * .5), Math.atan2(point.tiltY ?? 0, point.tiltX ?? 0), 0, Math.PI * 2);
    return;
  }
  if (index > 0) {
    const previous = points[index - 1]; const previousRadius = Math.max(.25, stylusStrokeWidth(previous, thickness) / 2);
    const dx = point.x - previous.x; const dy = point.y - previous.y; const length = Math.hypot(dx, dy);
    if (length > 0) {
      const nx = -dy / length; const ny = dx / length;
      path.moveTo(previous.x + nx * previousRadius, previous.y + ny * previousRadius);
      path.lineTo(point.x + nx * radius, point.y + ny * radius);
      path.lineTo(point.x - nx * radius, point.y - ny * radius);
      path.lineTo(previous.x - nx * previousRadius, previous.y - ny * previousRadius);
      path.closePath();
    }
  }
  path.moveTo(point.x + radius, point.y);
  path.arc(point.x, point.y, radius, 0, Math.PI * 2);
  path.closePath();
}

type StrokePath = Pick<Path2D, "moveTo" | "lineTo" | "quadraticCurveTo">;

/** Retains incremental paths and a bounded raster cache for long strokes. */
export function createFreehandRenderer() {
  const caches = new WeakMap<StrokePoint[], StrokeCache>();
  type Raster = { canvas: HTMLCanvasElement; length: number; scale: number; ink: string; thickness: number; x: number; y: number; bytes: number; lastUsed: number };
  const rasters = new Map<StrokePoint[], Raster>();
  const rasterBudget = 24 * 1024 * 1024;
  let rasterBytes = 0;
  type PreviewLayer = { points: StrokePoint[]; canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; length: number; ink: string; thickness: number; transform: [number, number, number, number, number, number] };
  let previewLayer: PreviewLayer | undefined;

  function releaseRaster(points: StrokePoint[]) {
    const raster = rasters.get(points); if (!raster) return;
    rasterBytes -= raster.bytes; raster.canvas.width = 0; raster.canvas.height = 0; rasters.delete(points);
  }

  function drawRaster(ctx: CanvasRenderingContext2D, element: FreehandElement, cache: StrokeCache, ink: string) {
    // Small strokes are cheaper as paths. Large cached surfaces have an explicit
    // memory bound; oversized strokes retain the viewport-clipped path renderer.
    if (element.points.length < 64) return false;
    const transform = ctx.getTransform();
    const scale = Math.hypot(transform.a, transform.b);
    if (!Number.isFinite(scale) || scale <= 0) return false;
    let raster = rasters.get(element.points);
    const now = performance.now();
    if (raster && (raster.length !== element.points.length || raster.scale !== scale || raster.ink !== ink || raster.thickness !== element.thickness)) {
      releaseRaster(element.points); raster = undefined;
    }
    if (!raster) {
      const padding = Math.max(1, element.thickness * cache.maxWidth * 1.5) * scale + 2;
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

  function pathsFor(points: StrokePoint[], thickness: number) {
    let cache = caches.get(points);
    if (!cache || points.length < cache.length) { cache = newCache(); caches.set(points, cache); }
    if (cache.pressureAware && cache.pressureThickness !== thickness) {
      cache.pressureOutline = new Path2D(); cache.pressureThickness = thickness; cache.pressureLength = 0;
      while (cache.pressureLength < points.length) {
        appendPressureSample(cache.pressureOutline, points, cache.pressureLength, thickness);
        cache.pressureLength++;
      }
    }
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
      cache.previewWidthTotal += stylusStrokeWidth(point, 1);
      if (index === 0) cache.preview.moveTo(point.x, point.y);
      else {
        cache.preview.lineTo(point.x, point.y);
      }
      cache.length = index + 1;
      if (cache.pressureAware) {
        if (cache.pressureThickness !== thickness) {
          cache.pressureOutline = new Path2D(); cache.pressureThickness = thickness; cache.pressureLength = 0;
        }
        while (cache.pressureLength < points.length) {
          appendPressureSample(cache.pressureOutline!, points, cache.pressureLength, thickness);
          cache.pressureLength++;
        }
      }
    }
    return cache;
  }

  function finalizePaths(cache: StrokeCache) {
    if (!cache.pressureAware && !cache.complete) {
      // Use the same path before and after pen-up so the stroke does not jump.
      cache.complete = new Path2D(cache.preview);
    }
  }

  function drawPressurePreview(ctx: CanvasRenderingContext2D, element: FreehandElement, ink: string) {
    const targetWidth = ctx.canvas.width; const targetHeight = ctx.canvas.height;
    const transform = ctx.getTransform();
    const scale = Math.min(1, Math.sqrt((4 * 1024 * 1024) / Math.max(1, targetWidth * targetHeight * 4)));
    const signature: [number, number, number, number, number, number] = [transform.a * scale, transform.b * scale, transform.c * scale, transform.d * scale, transform.e * scale, transform.f * scale];
    let surface = previewLayer;
    const matches = surface && surface.points === element.points && surface.canvas.width === Math.max(1, Math.round(targetWidth * scale)) && surface.canvas.height === Math.max(1, Math.round(targetHeight * scale)) && surface.ink === ink && surface.thickness === element.thickness && surface.transform.every((value, index) => value === signature[index]) && surface.length <= element.points.length;
    if (!matches) {
      const canvas = surface?.canvas ?? document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(targetWidth * scale)); canvas.height = Math.max(1, Math.round(targetHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, canvas.width, canvas.height);
      surface = previewLayer = { points: element.points, canvas, context, length: 0, ink, thickness: element.thickness, transform: signature };
    }
    if (!surface) return;
    if (surface.length < element.points.length) {
      const additions = new Path2D();
      for (let index = surface.length; index < element.points.length; index++) appendPressureSample(additions, element.points, index, element.thickness);
      surface.context.setTransform(...signature); surface.context.fillStyle = ink; surface.context.globalAlpha = 1; surface.context.fill(additions);
      surface.length = element.points.length;
    }
    ctx.save(); const opacity = ctx.globalAlpha; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = opacity;
    ctx.drawImage(surface.canvas, 0, 0, targetWidth, targetHeight); ctx.restore();
  }

  function drawRetainedPreview(ctx: CanvasRenderingContext2D, element: FreehandElement, ink: string) {
    const surface = previewLayer;
    if (!surface || surface.points !== element.points || surface.ink !== ink || surface.thickness !== element.thickness || surface.length !== element.points.length) return false;
    const targetWidth = ctx.canvas.width; const targetHeight = ctx.canvas.height;
    const scale = Math.min(1, Math.sqrt((4 * 1024 * 1024) / Math.max(1, targetWidth * targetHeight * 4)));
    if (surface.canvas.width !== Math.max(1, Math.round(targetWidth * scale)) || surface.canvas.height !== Math.max(1, Math.round(targetHeight * scale))) return false;
    const transform = ctx.getTransform();
    const signature = [transform.a * scale, transform.b * scale, transform.c * scale, transform.d * scale, transform.e * scale, transform.f * scale];
    if (!surface.transform.every((value, index) => value === signature[index])) return false;
    ctx.save(); const opacity = ctx.globalAlpha; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = opacity;
    ctx.drawImage(surface.canvas, 0, 0, targetWidth, targetHeight); ctx.restore();
    return true;
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
      if (cache.pressureOutline) ctx.fill(cache.pressureOutline);
    } else {
      ctx.lineWidth = element.thickness; ctx.stroke(cache.complete!);
    }
  }

  function draw(ctx: CanvasRenderingContext2D, element: FreehandElement, ink: string, cacheRaster = true, preview = false) {
    if (!element.points.length || ctx.globalAlpha === 0) return;
    const cache = pathsFor(element.points, element.thickness);
    if (preview) {
      ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.setLineDash([]);
      if (element.points.length === 1) {
        const point = element.points[0]; const width = stylusStrokeWidth(point, element.thickness);
        const tilt = Math.min(1, Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0) / 90);
        ctx.beginPath(); ctx.ellipse(point.x, point.y, Math.max(.25, width * (.5 + tilt * .35)), Math.max(.25, width * .5), Math.atan2(point.tiltY ?? 0, point.tiltX ?? 0), 0, Math.PI * 2); ctx.fill();
      } else if (cache.pressureAware && cache.pressureOutline) {
        drawPressurePreview(ctx, element, ink);
      } else {
        const averageWidth = cache.previewWidthTotal / Math.max(1, cache.length);
        ctx.lineWidth = Math.max(.5, element.thickness * averageWidth); ctx.stroke(cache.preview);
      }
      return;
    }
    if (cache.pressureAware && drawRetainedPreview(ctx, element, ink)) return;
    finalizePaths(cache);
    if (cacheRaster && drawRaster(ctx, element, cache, ink)) return;
    paint(ctx, element, cache, ink);
  }

  function clearRasterCache() { for (const points of rasters.keys()) releaseRaster(points); }
  function dispose() { clearRasterCache(); if (previewLayer) { previewLayer.canvas.width = 0; previewLayer.canvas.height = 0; previewLayer = undefined; } }

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
  if (pressureAware) {
    const outline = getStroke(points.map(point => [point.x, point.y, Math.max(.01, Math.min(1, stylusStrokeWidth(point, 1) / 2))] as [number, number, number]), {
      size: Math.max(.5, element.thickness * 2), thinning: 1, smoothing: .55, streamline: .4, simulatePressure: false, last: true,
    });
    const path = outline.length ? `M ${outline.map(point => `${point[0]} ${point[1]}`).join(" L ")} Z` : "";
    return `<path d="${path}" fill="${ink}" opacity="${element.opacity ?? 1}"/>`;
  }
  const paths = new Map<number, SvgStrokePath>(); const body = new SvgStrokePath();
  body.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1]; const to = midpoint(previous, points[index]);
    body.quadraticCurveTo(previous.x, previous.y, to.x, to.y);
  }
  const last = points[points.length - 1];
  body.lineTo(last.x, last.y); paths.set(1, body);
  return `<g fill="none" stroke="${ink}" opacity="${element.opacity ?? 1}" stroke-linecap="round" stroke-linejoin="round">${[...paths].map(([width, path]) => `<path d="${path}" stroke-width="${Math.max(.35, width * element.thickness)}"/>`).join("")}</g>`;
}
