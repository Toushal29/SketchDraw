import type { UIManualGuide, UIGuideSettings } from "./model";
import type { UIRect } from "./geometry";

export type UIGuideAxis = "x" | "y";
export type UIAlignmentLine = { axis: UIGuideAxis; position: number; from: number; to: number; source: "object" | "manual" | "grid" | "spacing" };
export type UISnapTarget = { id: string; parentId: string; bounds: UIRect };
export type UIDistanceMeasure = { axis: UIGuideAxis; start: number; end: number; cross: number; value: number; label: string };

type Candidate = { delta: number; line: UIAlignmentLine; rank: number };
const axisStart = (rect: UIRect, axis: UIGuideAxis) => axis === "x" ? rect.x : rect.y;
const axisSize = (rect: UIRect, axis: UIGuideAxis) => axis === "x" ? rect.width : rect.height;
const edges = (rect: UIRect, axis: UIGuideAxis) => {
  const start = axisStart(rect, axis), size = axisSize(rect, axis);
  return [start, start + size / 2, start + size];
};
const crossRange = (rect: UIRect, axis: UIGuideAxis): [number, number] => axis === "x"
  ? [rect.y, rect.y + rect.height]
  : [rect.x, rect.x + rect.width];
const rangesOverlap = (a: [number, number], b: [number, number]) => Math.max(a[0], b[0]) <= Math.min(a[1], b[1]);

function nearestAxisSnap(
  axis: UIGuideAxis,
  moving: UIRect,
  targets: UISnapTarget[],
  guides: UIManualGuide[],
  threshold: number,
  settings: UIGuideSettings,
  spacingParentId?: string,
): Candidate | undefined {
  const movingEdges = edges(moving, axis);
  const movingRange = crossRange(moving, axis);
  let best: Candidate | undefined;
  const consider = (candidate: Candidate) => {
    if (Math.abs(candidate.delta) > threshold) return;
    if (!best
      || Math.abs(candidate.delta) < Math.abs(best.delta)
      || (Math.abs(candidate.delta) === Math.abs(best.delta) && candidate.rank < best.rank)
      || (Math.abs(candidate.delta) === Math.abs(best.delta) && candidate.rank === best.rank && candidate.line.position < best.line.position)) best = candidate;
  };

  if (settings.snapObjects) for (const target of targets) {
    const targetEdges = edges(target.bounds, axis);
    const targetRange = crossRange(target.bounds, axis);
    const fullRange: [number, number] = [
      Math.min(movingRange[0], targetRange[0]),
      Math.max(movingRange[1], targetRange[1]),
    ];
    for (let movingIndex = 0; movingIndex < movingEdges.length; movingIndex++) {
      for (let targetIndex = 0; targetIndex < targetEdges.length; targetIndex++) {
        consider({
          delta: targetEdges[targetIndex] - movingEdges[movingIndex],
          line: { axis, position: targetEdges[targetIndex], from: fullRange[0], to: fullRange[1], source: "object" },
          rank: movingIndex === targetIndex ? 0 : 1,
        });
      }
    }
  }

  if (settings.snapGuides) for (const guide of guides) {
    if (!guide.visible || guide.axis !== axis) continue;
    for (const edge of movingEdges) consider({
      delta: guide.position - edge,
      line: { axis, position: guide.position, from: movingRange[0], to: movingRange[1], source: "manual" },
      rank: -1,
    });
  }

  if (settings.equalSpacing && spacingParentId && targets.length) {
    const sorted = targets
      .filter(target => target.parentId === spacingParentId && rangesOverlap(movingRange, crossRange(target.bounds, axis)))
      .map(target => target.bounds)
      .sort((a, b) => axisStart(a, axis) - axisStart(b, axis));
    // Only test the adjacent peer gaps. Enumerating every distinct gap against
    // every peer creates quadratic work on every pointer-move event.
    const movingStart = axisStart(moving, axis), movingSize = axisSize(moving, axis);
    const tryGap = (target: UIRect, gap: number, before: boolean) => {
      if (gap < 0) return;
      const start = axisStart(target, axis), end = start + axisSize(target, axis);
      const position = before ? start - gap - movingSize : end + gap;
      const delta = position - movingStart;
      consider({
        delta,
        line: { axis, position: before ? position + movingSize : position, from: Math.min(position, start, end), to: Math.max(position + movingSize, start, end), source: "spacing" },
        rank: 2,
      });
    };
    for (let index = 0; index < sorted.length; index++) {
      const target = sorted[index];
      const targetRange = crossRange(target, axis);
      const previous = sorted[index - 1];
      if (previous && rangesOverlap(targetRange, crossRange(previous, axis))) {
        const gap = axisStart(target, axis) - axisStart(previous, axis) - axisSize(previous, axis);
        tryGap(target, gap, false);
      }
      const next = sorted[index + 1];
      if (next && rangesOverlap(targetRange, crossRange(next, axis))) {
        const gap = axisStart(next, axis) - axisStart(target, axis) - axisSize(target, axis);
        tryGap(target, gap, true);
      }
    }
  }

  return best;
}

export function resolveSmartSnap(
  moving: UIRect,
  delta: { x: number; y: number },
  targets: UISnapTarget[],
  guides: UIManualGuide[],
  settings: UIGuideSettings,
  zoom: number,
  spacingParentId?: string,
): { delta: { x: number; y: number }; lines: UIAlignmentLine[] } {
  if (!settings.enabled) return { delta, lines: [] };
  const moved: UIRect = { ...moving, x: moving.x + delta.x, y: moving.y + delta.y };
  const threshold = Math.max(0.25, settings.threshold / Math.max(zoom, 0.05));
  const xSnap = nearestAxisSnap("x", moved, targets, guides, threshold, settings, spacingParentId);
  const ySnap = nearestAxisSnap("y", moved, targets, guides, threshold, settings, spacingParentId);
  let x = delta.x + (xSnap?.delta ?? 0), y = delta.y + (ySnap?.delta ?? 0);
  const lines = [xSnap?.line, ySnap?.line].filter((line): line is UIAlignmentLine => !!line);

  if (settings.snapGrid && settings.gridSize > 0) for (const axis of ["x", "y"] as const) {
    const snappedByGuide = axis === "x" ? xSnap : ySnap;
    if (snappedByGuide) continue;
    const coordinate = axisStart(moved, axis);
    const snapped = Math.round(coordinate / settings.gridSize) * settings.gridSize;
    if (Math.abs(snapped - coordinate) > threshold) continue;
    if (axis === "x") x += snapped - coordinate; else y += snapped - coordinate;
    const range = crossRange(moved, axis);
    lines.push({ axis, position: snapped, from: range[0], to: range[1], source: "grid" });
  }

  return { delta: { x: Math.round(x), y: Math.round(y) }, lines: settings.smartGuides ? lines : [] };
}

export function resolveResizeSnap(
  rect: UIRect,
  handle: string,
  targets: UISnapTarget[],
  guides: UIManualGuide[],
  settings: UIGuideSettings,
  zoom: number,
): { correction: { x: number; y: number }; lines: UIAlignmentLine[] } {
  if (!settings.enabled) return { correction: { x: 0, y: 0 }, lines: [] };
  const threshold = Math.max(0.25, settings.threshold / Math.max(zoom, 0.05));
  const corrections = { x: 0, y: 0 };
  const lines: UIAlignmentLine[] = [];
  for (const axis of ["x", "y"] as const) {
    const active = axis === "x" ? handle.includes("w") || handle.includes("e") : handle.includes("n") || handle.includes("s");
    if (!active) continue;
    const isStart = axis === "x" ? handle.includes("w") : handle.includes("n");
    const edge = axisStart(rect, axis) + (isStart ? 0 : axisSize(rect, axis));
    let chosen: Candidate | undefined;
    const consider = (candidate: Candidate) => {
      if (Math.abs(candidate.delta) > threshold) return;
      if (!chosen
        || Math.abs(candidate.delta) < Math.abs(chosen.delta)
        || (Math.abs(candidate.delta) === Math.abs(chosen.delta) && candidate.rank < chosen.rank)
        || (Math.abs(candidate.delta) === Math.abs(chosen.delta) && candidate.rank === chosen.rank && candidate.line.position < chosen.line.position)) chosen = candidate;
    };
    if (settings.snapObjects) for (const target of targets) {
      for (const targetEdge of edges(target.bounds, axis)) {
        const range = crossRange(target.bounds, axis);
        consider({ delta: targetEdge - edge, line: { axis, position: targetEdge, from: Math.min(crossRange(rect, axis)[0], range[0]), to: Math.max(crossRange(rect, axis)[1], range[1]), source: "object" }, rank: 0 });
      }
    }
    if (settings.snapGuides) for (const guide of guides) if (guide.visible && guide.axis === axis) {
      const range = crossRange(rect, axis);
      consider({ delta: guide.position - edge, line: { axis, position: guide.position, from: range[0], to: range[1], source: "manual" }, rank: -1 });
    }
    if (!chosen && settings.snapGrid && settings.gridSize > 0) {
      const snapped = Math.round(edge / settings.gridSize) * settings.gridSize;
      if (Math.abs(snapped - edge) <= threshold) {
        const range = crossRange(rect, axis);
        chosen = { delta: snapped - edge, line: { axis, position: snapped, from: range[0], to: range[1], source: "grid" }, rank: 1 };
      }
    }
    if (chosen) {
      corrections[axis] = Math.round(chosen.delta);
      if (settings.smartGuides) lines.push(chosen.line);
    }
  }
  return { correction: corrections, lines };
}

const gapBetween = (aStart: number, aSize: number, bStart: number, bSize: number) =>
  bStart >= aStart + aSize ? bStart - aStart - aSize : aStart >= bStart + bSize ? aStart - bStart - bSize : 0;

export function measureRectDistances(from: UIRect, to: UIRect): UIDistanceMeasure[] {
  const horizontalGap = gapBetween(from.x, from.width, to.x, to.width);
  const verticalGap = gapBetween(from.y, from.height, to.y, to.height);
  const verticalOverlapStart = Math.max(from.y, to.y), verticalOverlapEnd = Math.min(from.y + from.height, to.y + to.height);
  const horizontalOverlapStart = Math.max(from.x, to.x), horizontalOverlapEnd = Math.min(from.x + from.width, to.x + to.width);
  const horizontal: UIDistanceMeasure = {
    axis: "x",
    start: from.x + from.width <= to.x ? from.x + from.width : to.x + to.width <= from.x ? to.x + to.width : Math.max(from.x, to.x),
    end: from.x + from.width <= to.x ? to.x : to.x + to.width <= from.x ? from.x : Math.min(from.x + from.width, to.x + to.width),
    cross: verticalOverlapStart <= verticalOverlapEnd ? (verticalOverlapStart + verticalOverlapEnd) / 2 : Math.max(from.y, to.y),
    value: horizontalGap,
    label: `${Math.round(horizontalGap)} px`,
  };
  const vertical: UIDistanceMeasure = {
    axis: "y",
    start: from.y + from.height <= to.y ? from.y + from.height : to.y + to.height <= from.y ? to.y + to.height : Math.max(from.y, to.y),
    end: from.y + from.height <= to.y ? to.y : to.y + to.height <= from.y ? from.y : Math.min(from.y + from.height, to.y + to.height),
    cross: horizontalOverlapStart <= horizontalOverlapEnd ? (horizontalOverlapStart + horizontalOverlapEnd) / 2 : Math.max(from.x, to.x),
    value: verticalGap,
    label: `${Math.round(verticalGap)} px`,
  };
  return [horizontal, vertical].filter(item => item.value > 0 && item.end >= item.start);
}

/** Return only adjacent, unobstructed horizontal/vertical gaps between selected objects. */
export function measureMultipleSpacing(rects: UIRect[]): UIDistanceMeasure[] {
  const result: UIDistanceMeasure[] = [];
  for (const axis of ["x", "y"] as const) {
    const ordered = [...rects].sort((a, b) => axisStart(a, axis) - axisStart(b, axis));
    const seen = new Set<string>();
    for (let index = 0; index < ordered.length; index++) {
      const before = ordered[index];
      const beforeStart = axisStart(before, axis), beforeSize = axisSize(before, axis);
      const beforeCross = crossRange(before, axis);
      const beforeEnd = beforeStart + beforeSize;
      const after = ordered.slice(index + 1).find(rect => axisStart(rect, axis) >= beforeEnd && rangesOverlap(beforeCross, crossRange(rect, axis)));
      if (!after) continue;
      const gap = axisStart(after, axis) - beforeEnd;
      if (gap <= 0) continue;
      const blocked = ordered.some(rect => rect !== before && rect !== after
        && axisStart(rect, axis) < axisStart(after, axis)
        && axisStart(rect, axis) + axisSize(rect, axis) > beforeEnd
        && rangesOverlap(beforeCross, crossRange(rect, axis)));
      if (blocked) continue;
      const pairKey = [before, after].map(rect => `${rect.x},${rect.y},${rect.width},${rect.height}`).sort().join("|");
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      const afterCross = crossRange(after, axis);
      const overlapStart = Math.max(beforeCross[0], afterCross[0]);
      const overlapEnd = Math.min(beforeCross[1], afterCross[1]);
      result.push({
        axis,
        start: beforeStart + beforeSize,
        end: axisStart(after, axis),
        cross: (overlapStart + overlapEnd) / 2,
        value: gap,
        label: `${Math.round(gap)} px`,
      });
    }
  }
  return result;
}

export function measureFrameEdges(node: UIRect, frame: UIRect): UIDistanceMeasure[] {
  const values: Omit<UIDistanceMeasure, "label">[] = [
    { axis: "x", start: frame.x, end: node.x, cross: node.y + node.height / 2, value: node.x - frame.x },
    { axis: "x", start: node.x + node.width, end: frame.x + frame.width, cross: node.y + node.height / 2, value: frame.x + frame.width - node.x - node.width },
    { axis: "y", start: frame.y, end: node.y, cross: node.x + node.width / 2, value: node.y - frame.y },
    { axis: "y", start: node.y + node.height, end: frame.y + frame.height, cross: node.x + node.width / 2, value: frame.y + frame.height - node.y - node.height },
  ];
  return values.filter(item => item.value >= 0).map(item => ({ ...item, label: `${Math.round(item.value)} px` }));
}
