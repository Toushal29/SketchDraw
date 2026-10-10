import type { Bounds, Element } from "../../model";
import { elementBounds } from "./bounds";

const CELL_SIZE = 512;
const MAX_CELLS_PER_ELEMENT = 128;
const MAX_CELLS_PER_QUERY = 4096;
const LINEAR_SCAN_THRESHOLD = 64;

type IndexedBounds = { index: number; bounds: Bounds };

function cellRange(bounds: Bounds) {
  const left = Math.floor(bounds.x / CELL_SIZE);
  const top = Math.floor(bounds.y / CELL_SIZE);
  const right = Math.floor((bounds.x + bounds.w) / CELL_SIZE);
  const bottom = Math.floor((bounds.y + bounds.h) / CELL_SIZE);
  return { left, top, right, bottom, count: (right - left + 1) * (bottom - top + 1) };
}

function validBounds(bounds: Bounds) {
  return Number.isFinite(bounds.x) && Number.isFinite(bounds.y) && Number.isFinite(bounds.w) && Number.isFinite(bounds.h) && bounds.w >= 0 && bounds.h >= 0;
}

function intersects(a: Bounds, b: Bounds) {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

/** A cached uniform-grid broad phase. Results retain scene order for paint and hit testing. */
export class ElementSpatialIndex {
  private readonly entries: IndexedBounds[];
  private readonly cells = new Map<string, number[]>();
  private readonly overflow: number[] = [];

  constructor(private readonly elements: Element[]) {
    this.entries = elements.map((element, index) => ({ index, bounds: elementBounds(element) }));
    if (elements.length <= LINEAR_SCAN_THRESHOLD) return;
    for (const entry of this.entries) {
      if (!validBounds(entry.bounds)) {
        this.overflow.push(entry.index);
        continue;
      }
      const range = cellRange(entry.bounds);
      if (!Number.isFinite(range.count) || range.count > MAX_CELLS_PER_ELEMENT) {
        this.overflow.push(entry.index);
        continue;
      }
      for (let x = range.left; x <= range.right; x++) {
        for (let y = range.top; y <= range.bottom; y++) {
          const key = `${x},${y}`;
          const bucket = this.cells.get(key);
          if (bucket) bucket.push(entry.index);
          else this.cells.set(key, [entry.index]);
        }
      }
    }
  }

  query(bounds: Bounds): number[] {
    if (this.elements.length <= LINEAR_SCAN_THRESHOLD) return this.filterAll(bounds);
    if (!validBounds(bounds)) return this.entries.map(entry => entry.index);
    const range = cellRange(bounds);
    if (!Number.isFinite(range.count) || range.count > MAX_CELLS_PER_QUERY) return this.filterAll(bounds);
    const found = new Set<number>(this.overflow);
    for (let x = range.left; x <= range.right; x++) {
      for (let y = range.top; y <= range.bottom; y++) {
        for (const index of this.cells.get(`${x},${y}`) ?? []) found.add(index);
      }
    }
    return [...found].filter(index => intersects(this.entries[index].bounds, bounds)).sort((a, b) => a - b);
  }

  private filterAll(bounds: Bounds) {
    return this.entries.filter(entry => intersects(entry.bounds, bounds)).map(entry => entry.index);
  }
}

const indexCache = new WeakMap<Element[], ElementSpatialIndex>();

export function elementSpatialIndex(elements: Element[]): ElementSpatialIndex {
  let index = indexCache.get(elements);
  if (!index) {
    index = new ElementSpatialIndex(elements);
    indexCache.set(elements, index);
  }
  return index;
}
