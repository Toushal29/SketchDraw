import type { UIElement } from "./model";
import type { UIRect } from "./geometry";

const CELL_SIZE = 512;
const MAX_CELLS_PER_ELEMENT = 256;

function cellKey(x: number, y: number) { return `${x},${y}`; }

export class UIElementSpatialIndex {
  private readonly buckets = new Map<string, UIElement[]>();
  private readonly oversized: UIElement[] = [];

  constructor(elements: UIElement[]) {
    for (const element of elements) {
      if (element.hidden) continue;
      const left = Math.floor(element.x / CELL_SIZE);
      const top = Math.floor(element.y / CELL_SIZE);
      const right = Math.floor((element.x + element.width) / CELL_SIZE);
      const bottom = Math.floor((element.y + element.height) / CELL_SIZE);
      if ((right - left + 1) * (bottom - top + 1) > MAX_CELLS_PER_ELEMENT) {
        this.oversized.push(element);
        continue;
      }
      for (let x = left; x <= right; x++) for (let y = top; y <= bottom; y++) {
        const key = cellKey(x, y);
        const bucket = this.buckets.get(key);
        if (bucket) bucket.push(element);
        else this.buckets.set(key, [element]);
      }
    }
  }

  query(rect: UIRect): UIElement[] {
    const left = Math.floor(rect.x / CELL_SIZE);
    const top = Math.floor(rect.y / CELL_SIZE);
    const right = Math.floor((rect.x + rect.width) / CELL_SIZE);
    const bottom = Math.floor((rect.y + rect.height) / CELL_SIZE);
    const cells = (right - left + 1) * (bottom - top + 1);
    const found = new Map<string, UIElement>();
    if (cells > 4096) {
      for (const bucket of this.buckets.values()) for (const element of bucket) found.set(element.id, element);
    } else {
      for (let x = left; x <= right; x++) for (let y = top; y <= bottom; y++) {
        for (const element of this.buckets.get(cellKey(x, y)) ?? []) found.set(element.id, element);
      }
    }
    for (const element of this.oversized) found.set(element.id, element);
    return [...found.values()].filter(element => element.x <= rect.x + rect.width && element.x + element.width >= rect.x && element.y <= rect.y + rect.height && element.y + element.height >= rect.y);
  }
}
