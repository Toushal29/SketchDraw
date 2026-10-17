import type { Bounds, Element } from "../../model";
import type { ElementSpatialIndex } from "./spatial-index";

const TILE_SIZE = 512;
const TILE_BLEED = 1;
const MAX_TILE_BYTES = 24 * 1024 * 1024;
const MAX_VISIBLE_TILES = 64;
const MAX_CACHED_TILE_SCALE = 2;

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
    if (!Number.isFinite(physicalScale) || physicalScale > MAX_CACHED_TILE_SCALE + .25) return false;
    const scale = Math.max(.75, Math.min(MAX_CACHED_TILE_SCALE, Math.ceil(physicalScale * 2) / 2));
    this.sync(elements, spatialIndex, renderKey);

    const left = Math.floor(viewport.x / TILE_SIZE);
    const top = Math.floor(viewport.y / TILE_SIZE);
    const right = Math.floor((viewport.x + viewport.w) / TILE_SIZE);
    const bottom = Math.floor((viewport.y + viewport.h) / TILE_SIZE);
    const visibleCount = (right - left + 1) * (bottom - top + 1);
    const tilePixels = Math.ceil((TILE_SIZE + TILE_BLEED * 2) * scale);
    const visibleTileBytes = visibleCount * tilePixels * tilePixels * 4;
    if (!Number.isFinite(visibleCount) || visibleCount < 1 || visibleCount > MAX_VISIBLE_TILES || visibleTileBytes > MAX_TILE_BYTES) return false;

    for (let tileY = top; tileY <= bottom; tileY++) {
      for (let tileX = left; tileX <= right; tileX++) {
        const tile = this.getOrRender(tileX, tileY, scale, elements, spatialIndex, drawElement);
        if (!tile) return false;
        context.drawImage(tile.canvas, tile.x - TILE_BLEED, tile.y - TILE_BLEED, TILE_SIZE + TILE_BLEED * 2, TILE_SIZE + TILE_BLEED * 2);
      }
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
