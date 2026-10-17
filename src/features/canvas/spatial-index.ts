import type { Bounds, Element } from "../../model";
import { elementBounds } from "./bounds";

const CELL_SIZE = 512;
const MAX_CELLS_PER_ELEMENT = 128;
const MAX_CELLS_PER_QUERY = 4096;
const LINEAR_SCAN_THRESHOLD = 64;
const MAX_PENDING_CHANGE_BOUNDS = 4096;

type IndexedBounds = { element: Element; index: number; bounds: Bounds; cellKeys: string[]; overflow: boolean };

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
  private elements: Element[] = [];
  private entries: IndexedBounds[] = [];
  private gridEnabled = false;
  private readonly cells = new Map<string, Set<IndexedBounds>>();
  private readonly overflow = new Set<IndexedBounds>();
  private pendingChangeBounds: Bounds[] = [];
  private pendingChangeOverflow = false;

  constructor(elements: Element[] = []) {
    this.update(elements);
  }

  /** Reuses bounds and grid membership for immutable elements shared with the previous page snapshot. */
  update(elements: Element[], knownChangedIndices?: readonly number[]) {
    if (elements === this.elements) return;
    const nextGridEnabled = elements.length > LINEAR_SCAN_THRESHOLD;
    if (knownChangedIndices && elements.length === this.elements.length && nextGridEnabled === this.gridEnabled) {
      for (const index of new Set(knownChangedIndices)) {
        if (index < 0 || index >= elements.length || elements[index] === this.elements[index]) continue;
        const previous = this.entries[index];
        if (previous) { this.recordChange(previous.bounds); this.removeFromGrid(previous); }
        const element = elements[index];
        const entry: IndexedBounds = { element, index, bounds: elementBounds(element), cellKeys: [], overflow: false };
        this.recordChange(entry.bounds);
        if (this.gridEnabled) this.addToGrid(entry);
        this.entries[index] = entry;
      }
      this.elements = elements;
      return;
    }
    if (nextGridEnabled === this.gridEnabled && elements.length === this.elements.length + 1) {
      let appendOnly = true;
      for (let index = 0; index < this.elements.length; index++) if (elements[index] !== this.elements[index]) { appendOnly = false; break; }
      if (appendOnly) {
        const element = elements[elements.length - 1];
        const entry: IndexedBounds = { element, index: elements.length - 1, bounds: elementBounds(element), cellKeys: [], overflow: false };
        this.recordChange(entry.bounds);
        if (this.gridEnabled) this.addToGrid(entry);
        this.entries.push(entry);
        this.elements = elements;
        return;
      }
    }
    if (nextGridEnabled === this.gridEnabled && this.elements.length === elements.length + 1) {
      let tailRemoved = true;
      for (let index = 0; index < elements.length; index++) if (elements[index] !== this.elements[index]) { tailRemoved = false; break; }
      if (tailRemoved) {
        const removed = this.entries.pop();
        if (removed) { this.recordChange(removed.bounds); this.removeFromGrid(removed); }
        this.elements = elements;
        return;
      }
    }
    if (elements.length === this.elements.length) {
      for (let index = 0; index < elements.length; index++) {
        if (elements[index] === this.elements[index]) continue;
        const previous = this.entries[index];
        if (previous) { this.recordChange(previous.bounds); this.removeFromGrid(previous); }
        const element = elements[index];
        const entry: IndexedBounds = { element, index, bounds: elementBounds(element), cellKeys: [], overflow: false };
        this.recordChange(entry.bounds);
        if (this.gridEnabled) this.addToGrid(entry);
        this.entries[index] = entry;
      }
      this.elements = elements;
      return;
    }
    if (this.gridEnabled && !nextGridEnabled) for (const entry of this.entries) this.removeFromGrid(entry);
    const available = new Map<Element, IndexedBounds[]>();
    for (const entry of this.entries) {
      const matches = available.get(entry.element);
      if (matches) matches.push(entry);
      else available.set(entry.element, [entry]);
    }
    const retained = new Set<IndexedBounds>();
    const nextEntries = new Array<IndexedBounds>(elements.length);
    let previousSharedIndex = -1;
    let sharedOrderChanged = false;
    for (let index = 0; index < elements.length; index++) {
      const element = elements[index];
      const matches = available.get(element);
      const reused = matches?.pop();
      if (reused) {
        if (reused.index < previousSharedIndex) sharedOrderChanged = true;
        previousSharedIndex = reused.index;
        reused.index = index;
        retained.add(reused);
        nextEntries[index] = reused;
      } else {
        const entry: IndexedBounds = { element, index, bounds: elementBounds(element), cellKeys: [], overflow: false };
        this.recordChange(entry.bounds);
        if (nextGridEnabled && this.gridEnabled) this.addToGrid(entry);
        nextEntries[index] = entry;
      }
    }
    for (const entry of this.entries) if (!retained.has(entry)) { this.recordChange(entry.bounds); this.removeFromGrid(entry); }
    if (sharedOrderChanged) {
      for (const entry of this.entries) this.recordChange(entry.bounds);
      for (const entry of nextEntries) this.recordChange(entry.bounds);
    }
    this.entries = nextEntries;
    this.elements = elements;
    if (nextGridEnabled && !this.gridEnabled) for (const entry of this.entries) this.addToGrid(entry);
    this.gridEnabled = nextGridEnabled;
  }

  /** Updates only explicitly changed slots when the caller can guarantee the rest are identical. */
  updateChanged(elements: Element[], changedIndices: readonly number[]) {
    this.update(elements, changedIndices);
  }

  query(bounds: Bounds): number[] {
    if (this.entries.length <= LINEAR_SCAN_THRESHOLD) return this.filterAll(bounds);
    if (!validBounds(bounds)) return this.entries.map(entry => entry.index);
    const range = cellRange(bounds);
    if (!Number.isFinite(range.count) || range.count > MAX_CELLS_PER_QUERY) return this.filterAll(bounds);
    const found = new Set<IndexedBounds>(this.overflow);
    for (let x = range.left; x <= range.right; x++) {
      for (let y = range.top; y <= range.bottom; y++) {
        for (const entry of this.cells.get(`${x},${y}`) ?? []) found.add(entry);
      }
    }
    return [...found].filter(entry => intersects(entry.bounds, bounds)).map(entry => entry.index).sort((a, b) => a - b);
  }

  boundsAt(index: number) {
    return this.entries[index]?.bounds;
  }

  /** Returns bounds that need repainting since the previous consumer read them. */
  takeChangedBounds(): Bounds[] | undefined {
    const changed = this.pendingChangeOverflow ? undefined : this.pendingChangeBounds;
    this.pendingChangeBounds = [];
    this.pendingChangeOverflow = false;
    return changed;
  }

  private filterAll(bounds: Bounds) {
    return this.entries.filter(entry => intersects(entry.bounds, bounds)).map(entry => entry.index);
  }

  private addToGrid(entry: IndexedBounds) {
    if (!validBounds(entry.bounds)) { entry.overflow = true; this.overflow.add(entry); return; }
    const range = cellRange(entry.bounds);
    if (!Number.isFinite(range.count) || range.count > MAX_CELLS_PER_ELEMENT) { entry.overflow = true; this.overflow.add(entry); return; }
    for (let x = range.left; x <= range.right; x++) {
      for (let y = range.top; y <= range.bottom; y++) {
        const key = `${x},${y}`;
        let bucket = this.cells.get(key);
        if (!bucket) { bucket = new Set(); this.cells.set(key, bucket); }
        bucket.add(entry);
        entry.cellKeys.push(key);
      }
    }
  }

  private recordChange(bounds: Bounds) {
    if (this.pendingChangeOverflow) return;
    if (this.pendingChangeBounds.length >= MAX_PENDING_CHANGE_BOUNDS) {
      this.pendingChangeBounds = [];
      this.pendingChangeOverflow = true;
      return;
    }
    this.pendingChangeBounds.push(bounds);
  }

  private removeFromGrid(entry: IndexedBounds) {
    if (entry.overflow) this.overflow.delete(entry);
    for (const key of entry.cellKeys) {
      const bucket = this.cells.get(key);
      bucket?.delete(entry);
      if (bucket?.size === 0) this.cells.delete(key);
    }
    entry.cellKeys = [];
    entry.overflow = false;
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
