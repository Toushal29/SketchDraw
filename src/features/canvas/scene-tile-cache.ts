import type { Bounds, Element } from "../../model";
import type { ElementSpatialIndex } from "./spatial-index";

const TILE_SIZE = 512;
const TILE_BLEED = 1;
const MAX_TILE_BYTES = 24 * 1024 * 1024;
const MAX_VISIBLE_TILES = 64;
const MAX_CACHED_TILE_SCALE = 3;

type SceneTile = {
  x: number;
  y: number;
  bytes: number;
  canvas: HTMLCanvasElement;
};

/** Bounded cache for settled canvas regions. The document elements remain authoritative. */
export class SceneTileCache {
  private readonly tiles = new Map<string, SceneTile>();
  private cachedBytes = 0;
  private previousElements?: Element[];
  private renderKey?: string;

  clear() {
    for (const tile of this.tiles.values()) this.release(tile);
    this.tiles.clear();
    this.cachedBytes = 0;
    this.previousElements = undefined;
    this.renderKey = undefined;
  }

  draw(
    context: CanvasRenderingContext2D,
    viewport: Bounds,
    zoom: number,
    devicePixelRatio: number,
    elements: Element[],
    spatialIndex: ElementSpatialIndex,
    renderKey: string,
    drawElement: (context: CanvasRenderingContext2D, element: Element, viewport: Bounds, sourceItems: Element[]) => void,
  ): boolean {
    const physicalScale = zoom * devicePixelRatio;
    if (!Number.isFinite(physicalScale) || physicalScale < 1 || physicalScale > MAX_CACHED_TILE_SCALE) return false;
    // Keep cached detail close to the screen's physical pixel scale to avoid
    // interpolation blur at 100% zoom and nearby zoom levels.
    const scale = Math.max(.75, Math.min(MAX_CACHED_TILE_SCALE, Math.round(physicalScale * 8) / 8));
    // At exact canvas zoom, redraw vectors when a raster tile would need any
    // fractional scaling or translation on the device pixel grid.
    if (Math.abs(zoom - 1) < 1e-8) {
      const transform = context.getTransform();
      const aligned = Math.abs(transform.a - scale) < 1e-6 && Math.abs(transform.d - scale) < 1e-6
        && Math.abs(transform.b) < 1e-8 && Math.abs(transform.c) < 1e-8
        && Math.abs(transform.e - Math.round(transform.e)) < 1e-6 && Math.abs(transform.f - Math.round(transform.f)) < 1e-6
        && Math.abs(physicalScale - scale) < 1e-6
        && Math.abs((TILE_SIZE + TILE_BLEED * 2) * scale - Math.round((TILE_SIZE + TILE_BLEED * 2) * scale)) < 1e-6;
      if (!aligned) return false;
    }
    this.sync(elements, spatialIndex, renderKey);

    const left = Math.floor(viewport.x / TILE_SIZE);
    const top = Math.floor(viewport.y / TILE_SIZE);
    const right = Math.floor((viewport.x + viewport.w) / TILE_SIZE);
    const bottom = Math.floor((viewport.y + viewport.h) / TILE_SIZE);
    const visibleCount = (right - left + 1) * (bottom - top + 1);
    const tilePixels = Math.ceil((TILE_SIZE + TILE_BLEED * 2) * scale);
    const visibleTileBytes = visibleCount * tilePixels * tilePixels * 4;
    if (!Number.isFinite(visibleCount) || visibleCount < 1 || visibleCount > MAX_VISIBLE_TILES || visibleTileBytes > MAX_TILE_BYTES) return false;

    const visibleTiles: SceneTile[] = [];
    for (let tileY = top; tileY <= bottom; tileY++) {
      for (let tileX = left; tileX <= right; tileX++) {
        const tile = this.getOrRender(tileX, tileY, scale, elements, spatialIndex, drawElement);
        if (!tile) return false;
        visibleTiles.push(tile);
      }
    }
    const transform = context.getTransform();
    if (![transform.a, transform.b, transform.c, transform.d, transform.e, transform.f].every(Number.isFinite)
      || Math.abs(transform.b) > 1e-8 || Math.abs(transform.c) > 1e-8 || !transform.a || !transform.d) return false;
    for (const tile of visibleTiles) {
      const x1 = transform.a * tile.x + transform.e;
      const x2 = transform.a * (tile.x + TILE_SIZE) + transform.e;
      const y1 = transform.d * tile.y + transform.f;
      const y2 = transform.d * (tile.y + TILE_SIZE) + transform.f;
      const left = Math.round(Math.min(x1, x2));
      const top = Math.round(Math.min(y1, y2));
      const right = Math.round(Math.max(x1, x2));
      const bottom = Math.round(Math.max(y1, y2));
      if (right <= left || bottom <= top) continue;
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.beginPath();
      context.rect(left, top, right - left, bottom - top);
      context.clip();
      context.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
      context.drawImage(tile.canvas, tile.x - TILE_BLEED, tile.y - TILE_BLEED, TILE_SIZE + TILE_BLEED * 2, TILE_SIZE + TILE_BLEED * 2);
      context.restore();
    }
    return true;
  }

  private sync(elements: Element[], spatialIndex: ElementSpatialIndex, renderKey: string) {
    if (this.renderKey !== undefined && this.renderKey !== renderKey) this.clear();
    this.renderKey = renderKey;
    if (elements === this.previousElements) return;
    const changes = spatialIndex.takeChangedBounds();
    this.previousElements = elements;
    if (!changes) { this.clearTiles(); return; }
    for (const bounds of changes) this.invalidate(bounds);
  }

  private getOrRender(
    tileX: number,
    tileY: number,
    scale: number,
    elements: Element[],
    spatialIndex: ElementSpatialIndex,
    drawElement: (context: CanvasRenderingContext2D, element: Element, viewport: Bounds, sourceItems: Element[]) => void,
  ) {
    const key = `${scale}:${tileX}:${tileY}`;
    const existing = this.tiles.get(key);
    if (existing) {
      this.tiles.delete(key);
      this.tiles.set(key, existing);
      return existing;
    }
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const worldBounds = { x: x - TILE_BLEED, y: y - TILE_BLEED, w: TILE_SIZE + TILE_BLEED * 2, h: TILE_SIZE + TILE_BLEED * 2 };
    const candidates = spatialIndex.query(worldBounds);
    for (const index of candidates) {
      const bounds = spatialIndex.boundsAt(index);
      if (!bounds) continue;
      const tileCount = (Math.floor((bounds.x + bounds.w) / TILE_SIZE) - Math.floor(bounds.x / TILE_SIZE) + 1)
        * (Math.floor((bounds.y + bounds.h) / TILE_SIZE) - Math.floor(bounds.y / TILE_SIZE) + 1);
      if (!Number.isFinite(tileCount) || tileCount > 64) return undefined;
    }
    const width = Math.max(1, Math.ceil(worldBounds.w * scale));
    const height = Math.max(1, Math.ceil(worldBounds.h * scale));
    const bytes = width * height * 4;
    if (bytes > MAX_TILE_BYTES) return undefined;
    while (this.cachedBytes + bytes > MAX_TILE_BYTES || this.tiles.size >= MAX_VISIBLE_TILES * 2) {
      const oldest = this.tiles.keys().next().value as string | undefined;
      if (!oldest) break;
      const tile = this.tiles.get(oldest);
      if (tile) { this.tiles.delete(oldest); this.release(tile); }
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const tileContext = canvas.getContext("2d", { alpha: true });
    if (!tileContext) { canvas.width = 0; canvas.height = 0; return undefined; }
    tileContext.setTransform(scale, 0, 0, scale, -worldBounds.x * scale, -worldBounds.y * scale);
    tileContext.beginPath();
    tileContext.rect(worldBounds.x, worldBounds.y, worldBounds.w, worldBounds.h);
    tileContext.clip();
    for (const index of candidates) {
      const element = elements[index];
      if (!element || element.hidden) continue;
      drawElement(tileContext, element, worldBounds, elements);
    }
    const tile = { x, y, bytes, canvas };
    this.tiles.set(key, tile);
    this.cachedBytes += bytes;
    return tile;
  }

  private invalidate(bounds: Bounds) {
    if (![bounds.x, bounds.y, bounds.w, bounds.h].every(Number.isFinite) || bounds.w < 0 || bounds.h < 0) { this.clearTiles(); return; }
    const left = Math.floor(bounds.x / TILE_SIZE);
    const top = Math.floor(bounds.y / TILE_SIZE);
    const right = Math.floor((bounds.x + bounds.w) / TILE_SIZE);
    const bottom = Math.floor((bounds.y + bounds.h) / TILE_SIZE);
    if ((right - left + 1) * (bottom - top + 1) > 4096) { this.clearTiles(); return; }
    for (const [key, tile] of this.tiles) {
      const tileLeft = tile.x - TILE_BLEED;
      const tileTop = tile.y - TILE_BLEED;
      if (bounds.x > tileLeft + TILE_SIZE + TILE_BLEED || bounds.x + bounds.w < tileLeft || bounds.y > tileTop + TILE_SIZE + TILE_BLEED || bounds.y + bounds.h < tileTop) continue;
      this.tiles.delete(key);
      this.release(tile);
    }
  }

  private clearTiles() {
    for (const tile of this.tiles.values()) this.release(tile);
    this.tiles.clear();
    this.cachedBytes = 0;
  }

  private release(tile: SceneTile) {
    this.cachedBytes = Math.max(0, this.cachedBytes - tile.bytes);
    tile.canvas.width = 0;
    tile.canvas.height = 0;
  }
}
