import type { UIElement, UIGrid } from "./model";

export type UIRect = { x: number; y: number; width: number; height: number };
export type UISnapGuide = { position: number; start: number; end: number; peer: string; alignment: string };
export type UISnapResult = { x: number; y: number; guideX?: UISnapGuide; guideY?: UISnapGuide };
export type UIGapMeasurement = { axis: "x" | "y"; side: "left" | "right" | "above" | "below"; gap: number; x1: number; y1: number; x2: number; y2: number };

export function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }): UIRect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

export function intersects(a: UIRect, b: UIRect): boolean {
  return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

export function unionRects(rects: UIRect[]): UIRect | undefined {
  if (!rects.length) return undefined;
  const left = Math.min(...rects.map(item => item.x));
  const top = Math.min(...rects.map(item => item.y));
  const right = Math.max(...rects.map(item => item.x + item.width));
  const bottom = Math.max(...rects.map(item => item.y + item.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function measureNeighborGaps(target: UIRect, peers: UIRect[]): UIGapMeasurement[] {
  const overlapY = (item: UIRect) => Math.min(target.y + target.height, item.y + item.height) - Math.max(target.y, item.y);
  const overlapX = (item: UIRect) => Math.min(target.x + target.width, item.x + item.width) - Math.max(target.x, item.x);
  const left = peers.filter(item => overlapY(item) > 0 && item.x + item.width <= target.x).sort((a, b) => b.x + b.width - a.x - a.width)[0];
  const right = peers.filter(item => overlapY(item) > 0 && item.x >= target.x + target.width).sort((a, b) => a.x - b.x)[0];
  const above = peers.filter(item => overlapX(item) > 0 && item.y + item.height <= target.y).sort((a, b) => b.y + b.height - a.y - a.height)[0];
  const below = peers.filter(item => overlapX(item) > 0 && item.y >= target.y + target.height).sort((a, b) => a.y - b.y)[0];
  const result: UIGapMeasurement[] = [];
  const midY = (item: UIRect) => Math.max(target.y, item.y) + overlapY(item) / 2;
  const midX = (item: UIRect) => Math.max(target.x, item.x) + overlapX(item) / 2;
  if (left) result.push({ axis: "x", side: "left", gap: target.x - left.x - left.width, x1: left.x + left.width, y1: midY(left), x2: target.x, y2: midY(left) });
  if (right) result.push({ axis: "x", side: "right", gap: right.x - target.x - target.width, x1: target.x + target.width, y1: midY(right), x2: right.x, y2: midY(right) });
  if (above) result.push({ axis: "y", side: "above", gap: target.y - above.y - above.height, x1: midX(above), y1: above.y + above.height, x2: midX(above), y2: target.y });
  if (below) result.push({ axis: "y", side: "below", gap: below.y - target.y - target.height, x1: midX(below), y1: target.y + target.height, x2: midX(below), y2: below.y });
  return result;
}

export function equalSpacingAround(target: UIRect, peers: UIRect[], tolerance = 1): { axis: "x" | "y"; gap: number } | undefined {
  const gaps = measureNeighborGaps(target, peers);
  const horizontal = gaps.filter(item => item.axis === "x");
  if (horizontal.some(item => item.side === "left") && horizontal.some(item => item.side === "right")) {
    const left = horizontal.find(item => item.side === "left")!.gap;
    const right = horizontal.find(item => item.side === "right")!.gap;
    if (left > 0 && right > 0 && Math.abs(left - right) <= tolerance) return { axis: "x", gap: (left + right) / 2 };
  }
  const vertical = gaps.filter(item => item.axis === "y");
  if (vertical.some(item => item.side === "above") && vertical.some(item => item.side === "below")) {
    const above = vertical.find(item => item.side === "above")!.gap;
    const below = vertical.find(item => item.side === "below")!.gap;
    if (above > 0 && below > 0 && Math.abs(above - below) <= tolerance) return { axis: "y", gap: (above + below) / 2 };
  }
  return undefined;
}

function closestPeerSnap(position: number, anchors: Array<{ offset: number; name: string }>, peers: UIElement[], axis: "x" | "y", tolerance: number) {
  let result: { position: number; target: number; distance: number; peer: UIElement; alignment: string } | undefined;
  const anchorLabels = axis === "x" ? ["left", "center", "right"] : ["top", "center", "bottom"];
  for (const anchor of anchors) for (const peer of peers) {
    const peerSize = axis === "x" ? peer.width : peer.height;
    const targets = [0, peerSize / 2, peerSize];
    for (let index = 0; index < targets.length; index++) {
      const target = (axis === "x" ? peer.x : peer.y) + targets[index];
      const nextPosition = target - anchor.offset;
      const distance = Math.abs(position - nextPosition);
      if (distance <= tolerance && (!result || distance < result.distance)) {
        result = { position: nextPosition, target, distance, peer, alignment: `${anchor.name} ↔ ${anchorLabels[index]}` };
      }
    }
  }
  return result;
}

/** Snap a node on an unbounded page grid and align it with nearby peer edges. */
export function snapPosition(grid: UIGrid, element: UIElement, x: number, y: number, peers: UIElement[], zoom: number): UISnapResult {
  let nextX = x;
  let nextY = y;
  let guideX: UISnapGuide | undefined;
  let guideY: UISnapGuide | undefined;
  const tolerance = 6 / Math.max(0.08, zoom);
  const xAnchors = [0, element.width / 2, element.width];
  const yAnchors = [0, element.height / 2, element.height];
  if (grid.snap) {
    const step = grid.kind === "baseline" ? grid.size * 4 : grid.size;
    const snapGrid = (position: number, anchors: number[]) => {
      let chosen: { position: number; target: number; distance: number } | undefined;
      for (const anchor of anchors) {
        const target = Math.round((position + anchor) / step) * step;
        const distance = Math.abs(position + anchor - target);
        if (distance <= tolerance && (!chosen || distance < chosen.distance)) chosen = { position: target - anchor, target, distance };
      }
      return chosen;
    };
    const gx = snapGrid(nextX, xAnchors);
    const gy = snapGrid(nextY, yAnchors);
    if (gx) nextX = gx.position;
    if (gy) nextY = gy.position;
  }
  const sx = closestPeerSnap(nextX, xAnchors.map((offset, index) => ({ offset, name: ["left", "center", "right"][index] })), peers, "x", tolerance);
  const sy = closestPeerSnap(nextY, yAnchors.map((offset, index) => ({ offset, name: ["top", "center", "bottom"][index] })), peers, "y", tolerance);
  if (sx) nextX = sx.position;
  if (sy) nextY = sy.position;
  if (sx) {
    const movedTop = nextY, movedBottom = nextY + element.height;
    const peerTop = sx.peer.y, peerBottom = sx.peer.y + sx.peer.height;
    guideX = { position: sx.target, start: Math.min(movedTop, peerTop), end: Math.max(movedBottom, peerBottom), peer: sx.peer.name, alignment: sx.alignment };
  }
  if (sy) {
    const movedLeft = nextX, movedRight = nextX + element.width;
    const peerLeft = sy.peer.x, peerRight = sy.peer.x + sy.peer.width;
    guideY = { position: sy.target, start: Math.min(movedLeft, peerLeft), end: Math.max(movedRight, peerRight), peer: sy.peer.name, alignment: sy.alignment };
  }
  const roundGuide = (guide: UISnapGuide | undefined) => guide && ({ ...guide, position: Math.round(guide.position), start: Math.round(guide.start), end: Math.round(guide.end) });
  return { x: Math.round(nextX), y: Math.round(nextY), guideX: roundGuide(guideX), guideY: roundGuide(guideY) };
}

export function resizeElement(element: UIElement, handle: string, dx: number, dy: number): UIRect {
  const left = handle.includes("w");
  const right = handle.includes("e");
  const top = handle.includes("n");
  const bottom = handle.includes("s");
  let x = element.x;
  let y = element.y;
  let width = element.width;
  let height = element.height;
  if (left) { x += dx; width -= dx; }
  if (right) width += dx;
  if (top) { y += dy; height -= dy; }
  if (bottom) height += dy;
  const minimum = 1;
  if (width < minimum) { if (left) x -= minimum - width; width = minimum; }
  if (height < minimum) { if (top) y -= minimum - height; height = minimum; }
  const leftEdge = Math.round(x);
  const topEdge = Math.round(y);
  const rightEdge = Math.round(x + width);
  const bottomEdge = Math.round(y + height);
  return { x: leftEdge, y: topEdge, width: Math.max(1, rightEdge - leftEdge), height: Math.max(1, bottomEdge - topEdge) };
}

export function visibleGridLines(grid: UIGrid, bounds: UIRect, zoom: number): { x: number[]; y: number[] } {
  if (!grid.visible) return { x: [], y: [] };
  const step = Math.max(grid.kind === "baseline" ? grid.baseline : grid.size, 8 / Math.max(0.08, zoom));
  const range = (start: number, end: number) => {
    const first = Math.ceil(start / step);
    const last = Math.floor(end / step);
    const values: number[] = [];
    for (let index = first; index <= last && values.length < 1000; index++) values.push(Math.round(index * step));
    return values;
  };
  return {
    x: grid.kind === "rows" || grid.kind === "baseline" ? [] : range(bounds.x, bounds.x + bounds.width),
    y: grid.kind === "columns" ? [] : range(bounds.y, bounds.y + bounds.height),
  };
}
