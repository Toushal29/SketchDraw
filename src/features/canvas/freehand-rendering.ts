import type { FreehandElement, Point, StrokePoint } from "../../model";
import { getStroke } from "perfect-freehand";

export const stylusStrokeWidth = (point: StrokePoint, thickness: number) => thickness * (point.pressure === undefined ? 1 : .35 + Math.max(0, Math.min(1, point.pressure)) * 1.15) * (1 + Math.min(1, Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0) / 90) * .28);
export const stylusStrokeWidthAt = (points: StrokePoint[], index: number, thickness: number) => index === 0 ? stylusStrokeWidth(points[0], thickness) : (stylusStrokeWidth(points[index - 1], thickness) + stylusStrokeWidth(points[index], thickness)) / 2;

type StrokeCache = {
  length: number;
  pressureAware: boolean;
  preview: Path2D;
  pressureOutline?: Path2D;
  pressurePrefix?: Path2D;
  pressureTail?: StrokePoint[];
  pressureCommittedLength: number;
  pressureThickness?: number;
  pressureLastPoint?: StrokePoint;
  pressureFinal?: boolean;
  pressureLength: number;
  committedPairs: number;
  started: boolean;
  lastPoint?: StrokePoint;
  complete?: Path2D;
  left: number;
  top: number;
  right: number;
  bottom: number;
  maxWidth: number;
};

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const newCache = (pressureAware = false): StrokeCache => ({ length: 0, pressureAware, preview: new Path2D(), pressureLength: 0, pressureCommittedLength: 0, committedPairs: 0, started: false, left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity, maxWidth: 1 });

function pressureOutlinePath(points: StrokePoint[], thickness: number, last: boolean) {
  const outline = getStroke(points.map(point => [point.x, point.y, Math.max(.01, Math.min(1, stylusStrokeWidth(point, 1) / 2))] as [number, number, number]), {
    size: Math.max(.5, thickness * 2), thinning: 1, smoothing: .55, streamline: 0, simulatePressure: false, last,
  });
  const path = new Path2D();
  if (!outline.length) return path;
  const first = outline[0]; const end = outline[outline.length - 1];
  path.moveTo((end[0] + first[0]) / 2, (end[1] + first[1]) / 2);
  for (let index = 0; index < outline.length; index++) {
    const point = outline[index]; const next = outline[(index + 1) % outline.length];
    path.quadraticCurveTo(point[0], point[1], (point[0] + next[0]) / 2, (point[1] + next[1]) / 2);
  }
  path.closePath();
  return path;
}

/** Keep the unfinished end separate so a replaced last sample never leaves stale geometry behind. */
function strokeTail(points: StrokePoint[]) {
  if (points.length < 2) return undefined;
  const length = points.length; const previous = points[length - 2]; const last = points[length - 1];
  const start = length === 2 ? points[0] : midpoint(points[length - 3], previous);
  const middle = midpoint(previous, last); const path = new Path2D();
  path.moveTo(start.x, start.y);
  path.quadraticCurveTo(previous.x, previous.y, middle.x, middle.y);
  path.quadraticCurveTo(last.x, last.y, last.x, last.y);
  return path;
}

type StrokePath = Pick<Path2D, "moveTo" | "quadraticCurveTo">;

/** Retains incremental paths and a bounded raster cache for long strokes. */
export function createFreehandRenderer() {
  const caches = new WeakMap<StrokePoint[], StrokeCache>();
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

  function includePoint(cache: StrokeCache, point: StrokePoint) {
    cache.left = Math.min(cache.left, point.x); cache.top = Math.min(cache.top, point.y);
    cache.right = Math.max(cache.right, point.x); cache.bottom = Math.max(cache.bottom, point.y);
    cache.maxWidth = Math.max(cache.maxWidth, stylusStrokeWidth(point, 1));
  }

  function pathsFor(points: StrokePoint[], thickness: number, preview: boolean) {
    let cache = caches.get(points);
    if (!cache || points.length < cache.length) { cache = newCache(); caches.set(points, cache); }
    const previousLength = cache.length; const previousLastPoint = cache.lastPoint;
    const lastPoint = points[points.length - 1]; const tailChanged = previousLastPoint !== lastPoint;
    for (let index = Math.max(0, previousLength - 1); index < points.length; index++) {
      const point = points[index];
      const hasPressure = point.pressure !== undefined || point.tiltX !== undefined || point.tiltY !== undefined;
      cache.pressureAware ||= hasPressure;
      includePoint(cache, point);
    }
    // Simplification may replace the latest sample without increasing length.
    // Keep the curve tail live while leaving already completed segments cached.
    if (tailChanged) cache.complete = undefined;
    if (!cache.started && points.length) { cache.preview.moveTo(points[0].x, points[0].y); cache.started = true; }
    if (cache.pressureAware) {
      const pressureFinal = !preview;
      if (cache.pressureThickness !== thickness || points.length < cache.pressureLength) {
        cache.pressurePrefix = new Path2D(); cache.pressureTail = undefined; cache.pressureCommittedLength = 0; cache.pressureOutline = undefined;
      }
      if (preview) {
        // Keep the expensive pressure outline calculation bounded during a live
        // stroke. Completed chunks have overlap for smooth joins; only the small
        // moving tail is rebuilt as pointer samples arrive.
        while (points.length - cache.pressureCommittedLength >= 36) {
          const end = cache.pressureCommittedLength + 24;
          const start = Math.max(0, cache.pressureCommittedLength - 8);
          cache.pressurePrefix ??= new Path2D();
          cache.pressurePrefix.addPath(pressureOutlinePath(points.slice(start, end), thickness, false));
          cache.pressureCommittedLength = end;
        }
        const tailStart = Math.max(0, cache.pressureCommittedLength - 8);
        const tail = points.slice(tailStart);
        const tailChanged = !cache.pressureTail || cache.pressureTail.length !== tail.length || tail.some((point, index) => point !== cache.pressureTail![index]);
        if (!cache.pressureOutline || tailChanged || cache.pressureFinal !== pressureFinal || cache.pressureThickness !== thickness) {
          cache.pressureOutline = pressureOutlinePath(tail, thickness, false);
        }
        cache.pressureTail = tail;
      } else if (!cache.pressureOutline || cache.pressureLength !== points.length || cache.pressureLastPoint !== lastPoint || cache.pressureFinal !== pressureFinal || cache.pressureThickness !== thickness) {
        cache.pressurePrefix = undefined; cache.pressureTail = undefined; cache.pressureCommittedLength = 0;
        cache.pressureOutline = pressureOutlinePath(points, thickness, true);
      }
      if (cache.pressureOutline) {
        cache.pressureLength = points.length; cache.pressureThickness = thickness; cache.pressureLastPoint = lastPoint; cache.pressureFinal = pressureFinal;
      }
    } else {
      // Commit only curves that no longer touch the replaceable final two samples.
      while (cache.committedPairs < points.length - 2) {
        const index = cache.committedPairs; const from = points[index]; const to = points[index + 1]; const middle = midpoint(from, to);
        cache.preview.quadraticCurveTo(from.x, from.y, middle.x, middle.y);
        cache.committedPairs++;
      }
    }
    cache.length = points.length; cache.lastPoint = lastPoint;
    return cache;
  }

  function finalizePaths(cache: StrokeCache, points: StrokePoint[]) {
    if (!cache.pressureAware && !cache.complete) {
      // Use the same path before and after pen-up so the stroke does not jump.
      const complete = new Path2D(cache.preview); const tail = strokeTail(points);
      if (tail) complete.addPath(tail);
      cache.complete = complete;
    }
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
      if (cache.pressureOutline) {
        const path = cache.pressurePrefix ? new Path2D(cache.pressurePrefix) : new Path2D();
        path.addPath(cache.pressureOutline); ctx.fill(path);
      }
    } else {
      ctx.lineWidth = element.thickness; ctx.stroke(cache.complete ?? cache.preview);
    }
  }

  function draw(ctx: CanvasRenderingContext2D, element: FreehandElement, ink: string, cacheRaster = true, preview = false) {
    if (!element.points.length || ctx.globalAlpha === 0) return;
    const cache = pathsFor(element.points, element.thickness, preview);
    if (preview) {
      ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.setLineDash([]);
      if (element.points.length === 1) {
        const point = element.points[0]; const width = stylusStrokeWidth(point, element.thickness);
        const tilt = Math.min(1, Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0) / 90);
        ctx.beginPath(); ctx.ellipse(point.x, point.y, Math.max(.25, width * (.5 + tilt * .35)), Math.max(.25, width * .5), Math.atan2(point.tiltY ?? 0, point.tiltX ?? 0), 0, Math.PI * 2); ctx.fill();
      } else if (cache.pressureAware && cache.pressureOutline) {
        const path = cache.pressurePrefix ? new Path2D(cache.pressurePrefix) : new Path2D();
        path.addPath(cache.pressureOutline); ctx.fill(path);
      } else {
        const tail = strokeTail(element.points);
        const path = new Path2D(cache.preview);
        if (tail) path.addPath(tail);
        ctx.lineWidth = Math.max(.5, element.thickness); ctx.stroke(path);
      }
      return;
    }
    finalizePaths(cache, element.points);
    if (cacheRaster && drawRaster(ctx, element, cache, ink)) return;
    paint(ctx, element, cache, ink);
  }

  function clearRasterCache() { for (const points of rasters.keys()) releaseRaster(points); }
  function dispose() { clearRasterCache(); }

  return { draw, clearRasterCache, dispose };
}

class SvgStrokePath implements StrokePath {
  private commands: string[] = [];
  moveTo(x: number, y: number) { this.commands.push(`M ${x} ${y}`); }
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
      size: Math.max(.5, element.thickness * 2), thinning: 1, smoothing: .55, streamline: 0, simulatePressure: false, last: true,
    });
    let path = "";
    if (outline.length) {
      const first = outline[0]; const last = outline[outline.length - 1];
      const commands = [`M ${(last[0] + first[0]) / 2} ${(last[1] + first[1]) / 2}`];
      for (let index = 0; index < outline.length; index++) {
        const point = outline[index]; const next = outline[(index + 1) % outline.length];
        commands.push(`Q ${point[0]} ${point[1]} ${(point[0] + next[0]) / 2} ${(point[1] + next[1]) / 2}`);
      }
      commands.push("Z"); path = commands.join(" ");
    }
    return `<path d="${path}" fill="${ink}" opacity="${element.opacity ?? 1}"/>`;
  }
  const paths = new Map<number, SvgStrokePath>(); const body = new SvgStrokePath();
  body.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1]; const to = midpoint(previous, points[index]);
    body.quadraticCurveTo(previous.x, previous.y, to.x, to.y);
  }
  const last = points[points.length - 1];
  body.quadraticCurveTo(last.x, last.y, last.x, last.y); paths.set(1, body);
  return `<g fill="none" stroke="${ink}" opacity="${element.opacity ?? 1}" stroke-linecap="round" stroke-linejoin="round">${[...paths].map(([width, path]) => `<path d="${path}" stroke-width="${Math.max(.35, width * element.thickness)}"/>`).join("")}</g>`;
}
