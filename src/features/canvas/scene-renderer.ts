import type { ArrowHead, Bounds, CanvasSnapGuides, CanvasSnapTarget, CanvasState, EdgeStyle, Element, FreehandElement, Point, Preview, ShapeElement, StrokePoint, StrokeStyle, Tool } from "../../model";
import { anchorPoint, connectionAnchorsFor, isConnectable, isConnector } from "../../operations";
import { elementBounds } from "./bounds";
import { swimlaneDividerHandles } from "./swimlanes";
import { ElementSpatialIndex, elementSpatialIndex } from "./spatial-index";
import { SceneTileCache } from "./scene-tile-cache";
import { shapeAdjustmentHandles } from "../shapes/geometry";
import { gridStepForStyle, isometricRowHeight, isometricRowOffset, type CanvasGridStyle } from "./input";

type DragState = { indices: number[]; point: Point; before: Element[]; moved: boolean; dx: number; dy: number; guides?: CanvasSnapGuides; snapTargets: { x: CanvasSnapTarget[]; y: CanvasSnapTarget[] }; targets: Map<string, Element> };

function orderedSceneIndices(queried: number[], added?: Set<number>) {
  if (!added?.size) return queried;
  const extras = [...added].sort((a, b) => a - b);
  const ordered: number[] = [];
  let queryIndex = 0; let extraIndex = 0;
  while (queryIndex < queried.length || extraIndex < extras.length) {
    const query = queried[queryIndex] ?? Infinity;
    const extra = extras[extraIndex] ?? Infinity;
    if (query < extra) { ordered.push(query); queryIndex++; }
    else if (extra < query) { ordered.push(extra); extraIndex++; }
    else { ordered.push(query); queryIndex++; extraIndex++; }
  }
  return ordered;
}

export type CanvasSceneRendererPorts = {
  elements: () => Element[];
  isHidden: (element: Element) => boolean;
  isLocked: (element: Element) => boolean;
  spatialIndex: () => ElementSpatialIndex;
  tileCacheKey: () => string;
  tileCacheAllowed: () => boolean;
  canvasState: () => CanvasState;
  contentTransforms?: () => { center: Point; rotation: number }[];
  contextScenes?: () => { elements: Element[]; sourceElements: Element[]; transforms: { center: Point; rotation: number }[] }[];
  groupEditBoundary?: () => { bounds: Bounds; color: string } | undefined;
  renderedBoardColor: () => string;
  whiteboardStyle: () => string;
  showGrid: () => boolean;
  gridSize: number;
  selectedSet: () => Set<number>;
  moveOrigin: () => DragState | undefined;
  resizeOrigin: () => { original: Element; guides?: CanvasSnapGuides; endpointGuide?: { axis: "x" | "y"; coordinate: number; point: Point } } | undefined;
  hoveredIndex: () => number | undefined;
  boardLocked: () => boolean;
  tool: () => Tool;
  attachmentHint: () => Point | undefined;
  marquee: () => { start: Point; end: Point; lasso?: Point[] } | undefined;
  laserTrail: () => { points: Point[]; opacity: number } | undefined;
  laserThickness: () => number;
  preview: () => Preview | undefined;
  simulationTokenId?: () => string | undefined;
  currentPoints: () => StrokePoint[];
  lineStyle: () => StrokeStyle;
  edgeStyle: () => EdgeStyle;
  cornerRadius: () => number;
  fillEnabled: () => boolean;
  fillColor: () => string;
  fillOpacity: () => number;
  defaultLineStartHead: () => ArrowHead;
  defaultLineEndHead: () => ArrowHead;
  defaultStartHead: () => ArrowHead;
  defaultEndHead: () => ArrowHead;
  defaultForkUpperHead: () => ArrowHead;
  defaultForkLowerHead: () => ArrowHead;
  drawFreehandPreview: (ctx: CanvasRenderingContext2D, element: FreehandElement) => void;
  drawElement: (ctx: CanvasRenderingContext2D, element: Element, viewport?: Bounds, sourceItems?: Element[]) => void;
  drawLaserStroke: (ctx: CanvasRenderingContext2D, points: Point[], opacity: number, thickness: number) => void;
  connectorForView: (item: ShapeElement, sourceItems?: Element[]) => ShapeElement;
  connectorMayIntersect: (item: ShapeElement, viewport: Bounds, sourceItems?: Element[]) => boolean;
  connectorHandles: (item: ShapeElement) => { id: string; x: number; y: number }[];
  resolveDraggedConnector: (element: Element, index: number, drag: DragState) => Element;
  intersectsBounds: (left: number, top: number, right: number, bottom: number, bounds: Bounds) => boolean;
};

function rotatePoint(point: Point, center: Point, degrees: number): Point {
  if (!degrees) return point;
  const angle = degrees * Math.PI / 180; const dx = point.x - center.x; const dy = point.y - center.y;
  return { x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle) };
}

export function transformHandlePoints(bounds: Bounds, zoom: number, includeRotate = true, rotation = 0) {
  const midX = bounds.x + bounds.w / 2; const midY = bounds.y + bounds.h / 2; const offset = 24 / zoom;
  const handles = [{ id: "nw", x: bounds.x, y: bounds.y }, { id: "n", x: midX, y: bounds.y }, { id: "ne", x: bounds.x + bounds.w, y: bounds.y }, { id: "e", x: bounds.x + bounds.w, y: midY }, { id: "se", x: bounds.x + bounds.w, y: bounds.y + bounds.h }, { id: "s", x: midX, y: bounds.y + bounds.h }, { id: "sw", x: bounds.x, y: bounds.y + bounds.h }, { id: "w", x: bounds.x, y: midY }];
  const allHandles = includeRotate ? [...handles, { id: "rotate", x: midX, y: bounds.y - offset }] : handles;
  const center = { x: midX, y: midY };
  return rotation ? allHandles.map(handle => ({ ...handle, ...rotatePoint(handle, center, rotation) })) : allHandles;
}

export function createCanvasSceneRenderer(ports: CanvasSceneRendererPorts) {
  const tileCache = new SceneTileCache();
  const contextSpatialIndexes = new WeakMap<Element[], ElementSpatialIndex>();
  const autoRouteIndicesByElements = new WeakMap<Element[], { visibilityKey: string; indices: number[] }>();
  let stationaryAutoRouteCache: { visibilityKey: string; indices: number[] } | undefined;

  function contextSpatialIndex(items: Element[]) {
    let index = contextSpatialIndexes.get(items);
    if (!index) { index = new ElementSpatialIndex(); index.update(items); contextSpatialIndexes.set(items, index); }
    return index;
  }

  function getAutoRouteIndices(items: Element[], reuseStationary = false) {
    const visibilityKey = ports.tileCacheKey();
    if (reuseStationary && stationaryAutoRouteCache?.visibilityKey === visibilityKey) return stationaryAutoRouteCache.indices;
    const cached = autoRouteIndicesByElements.get(items);
    if (cached?.visibilityKey === visibilityKey) {
      stationaryAutoRouteCache = { visibilityKey, indices: cached.indices };
      return cached.indices;
    }
    const indices: number[] = [];
    {
      items.forEach((item, index) => {
        if (isConnector(item) && item.autoRoute && !ports.isHidden(item) && !item.routePoints) indices.push(index);
      });
    }
    autoRouteIndicesByElements.set(items, { visibilityKey, indices });
    stationaryAutoRouteCache = { visibilityKey, indices };
    return indices;
  }

  function drawLaserStroke(ctx: CanvasRenderingContext2D, points: Point[], opacity: number, thickness: number) {
    ports.drawLaserStroke(ctx, points, opacity, thickness);
  }

  function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, state: CanvasState) {
    const style = ports.whiteboardStyle();
    if (!ports.showGrid() || style === "plain") return;
    const step = gridStepForStyle(style as CanvasGridStyle, ports.gridSize, state.zoom); const left = -state.panX / state.zoom; const top = -state.panY / state.zoom;
    const right = (width - state.panX) / state.zoom; const bottom = (height - state.panY) / state.zoom;
    const hex = ports.renderedBoardColor().replace("#", ""); const rgb = Number.parseInt(hex.length === 3 ? hex.split("").map(part => part + part).join("") : hex, 16); const luminance = (0.2126 * ((rgb >> 16) & 255)) + (0.7152 * ((rgb >> 8) & 255)) + (0.0722 * (rgb & 255));
    ctx.save(); ctx.translate(state.panX, state.panY); ctx.scale(state.zoom, state.zoom);
    const startColumn = Math.floor(left / step); const startRowIndex = Math.floor(top / step);
    ctx.strokeStyle = luminance < 130 ? "#353a45" : "#e4e5e2"; ctx.lineWidth = 0.75 / state.zoom; ctx.beginPath();
    if (style === "lines" || style === "small-grid") {
      for (let column = startColumn; column * step <= right; column++) { const x = column * step; ctx.moveTo(x, top); ctx.lineTo(x, bottom); }
      for (let row = startRowIndex; row * step <= bottom; row++) { const y = row * step; ctx.moveTo(left, y); ctx.lineTo(right, y); }
      ctx.stroke();
    } else if (style === "ruled") {
      for (let row = startRowIndex; row * step <= bottom; row++) { const y = row * step; ctx.moveTo(left, y); ctx.lineTo(right, y); }
      ctx.stroke();
    } else if (style === "isometric") {
      // Index from the document origin so the pattern shares the fixed grid snap origin.
      const rowStep = isometricRowHeight(step);
      const firstRow = Math.floor(top / rowStep) - 1; const lastRow = Math.ceil(bottom / rowStep) + 1;
      const firstX = left - step; const lastX = right + step;
      for (let row = firstRow; row <= lastRow; row++) {
        const y = row * rowStep; const phase = isometricRowOffset(row, step);
        const firstColumn = Math.floor((firstX - phase) / step); const lastColumn = Math.ceil((lastX - phase) / step);
        for (let column = firstColumn; column <= lastColumn; column++) {
          const x = column * step + phase;
          ctx.moveTo(x, y); ctx.lineTo(x + step, y);
          if (row < lastRow) { ctx.moveTo(x, y); ctx.lineTo(x - step / 2, y + rowStep); ctx.moveTo(x, y); ctx.lineTo(x + step / 2, y + rowStep); }
        }
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = luminance < 130 ? "#414653" : "#deddd6"; const radius = (style === "small-dots" ? 0.65 : 0.85) / state.zoom;
      ctx.beginPath();
      for (let column = startColumn; column * step <= right; column++) for (let row = startRowIndex; row * step <= bottom; row++) { const x = column * step; const y = row * step; ctx.moveTo(x + radius, y); ctx.arc(x, y, radius, 0, Math.PI * 2); }
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTransformHandles(ctx: CanvasRenderingContext2D, bounds: Bounds, zoom: number, includeRotate = true, rotation = 0) {
    const handles = transformHandlePoints(bounds, zoom, includeRotate, rotation); const rotate = includeRotate ? handles.pop() : undefined; const top = rotatePoint({ x: bounds.x + bounds.w / 2, y: bounds.y }, { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }, rotation);
    ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = "#547bb1"; ctx.fillStyle = "#ffffff"; ctx.lineWidth = 1 / zoom;
    if (rotate) { ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(rotate.x, rotate.y); ctx.stroke(); }
    for (const handle of handles) { ctx.beginPath(); ctx.rect(handle.x - 4 / zoom, handle.y - 4 / zoom, 8 / zoom, 8 / zoom); ctx.fill(); ctx.stroke(); }
    if (rotate) { ctx.beginPath(); ctx.arc(rotate.x, rotate.y, 5 / zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } ctx.restore();
  }

  function drawSelectionOutline(ctx: CanvasRenderingContext2D, bounds: Bounds, zoom: number, rotation = 0) {
    const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
    const corners = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.w, y: bounds.y },
      { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
      { x: bounds.x, y: bounds.y + bounds.h },
    ].map(point => rotatePoint(point, center, rotation));

    ctx.save();
    ctx.beginPath();
    corners.forEach((point, index) => { if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); });
    ctx.closePath();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3.5 / zoom;
    ctx.stroke();
    ctx.strokeStyle = "#3478e5";
    ctx.lineWidth = 1.6 / zoom;
    ctx.stroke();
    ctx.restore();
  }

  function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number, includeSelection: boolean, transparent = false, viewOverride?: CanvasState, sourceItems = ports.elements(), includeGrid = true, includeStrokePreview = true) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    if (!transparent) { ctx.fillStyle = ports.renderedBoardColor(); ctx.fillRect(0, 0, width, height); }
    const state = viewOverride ?? ports.canvasState(); if (!transparent && includeGrid) drawGrid(ctx, width, height, state);
    const contentTransforms = includeSelection && sourceItems === ports.elements() ? (ports.contentTransforms?.() ?? []).filter(transform => transform.rotation % 360 !== 0) : [];
    ctx.save(); ctx.translate(state.panX, state.panY); ctx.scale(state.zoom, state.zoom);
    const padding = 16 / state.zoom;
    const canvasViewport = { x: -state.panX / state.zoom - padding, y: -state.panY / state.zoom - padding, w: width / state.zoom + padding * 2, h: height / state.zoom + padding * 2 };
    const viewportForTransforms = (transforms: { center: Point; rotation: number }[]) => {
      const active = transforms.filter(transform => transform.rotation % 360 !== 0);
      if (!active.length) return canvasViewport;
      const corners = [{ x: canvasViewport.x, y: canvasViewport.y }, { x: canvasViewport.x + canvasViewport.w, y: canvasViewport.y }, { x: canvasViewport.x + canvasViewport.w, y: canvasViewport.y + canvasViewport.h }, { x: canvasViewport.x, y: canvasViewport.y + canvasViewport.h }].map(point => {
        for (const transform of active) point = rotatePoint(point, transform.center, -transform.rotation);
        return point;
      });
      const left = Math.min(...corners.map(point => point.x)); const top = Math.min(...corners.map(point => point.y));
      const right = Math.max(...corners.map(point => point.x)); const bottom = Math.max(...corners.map(point => point.y));
      return { x: left, y: top, w: right - left, h: bottom - top };
    };
    for (const scene of includeSelection && sourceItems === ports.elements() ? ports.contextScenes?.() ?? [] : []) {
      const contextTransforms = scene.transforms.filter(transform => transform.rotation % 360 !== 0);
      const contextViewport = viewportForTransforms(contextTransforms);
      ctx.save();
      for (const transform of contextTransforms) { ctx.translate(transform.center.x, transform.center.y); ctx.rotate(transform.rotation * Math.PI / 180); ctx.translate(-transform.center.x, -transform.center.y); }
      for (const index of contextSpatialIndex(scene.elements).query(contextViewport)) {
        const element = scene.elements[index]; if (!element) continue;
        if (ports.isHidden(element) || !ports.intersectsBounds(contextViewport.x, contextViewport.y, contextViewport.x + contextViewport.w, contextViewport.y + contextViewport.h, elementBounds(element))) continue;
        const drawn = isConnector(element) ? ports.connectorForView(element as ShapeElement, scene.sourceElements) : element;
        ports.drawElement(ctx, drawn, contextViewport, scene.sourceElements);
      }
      ctx.restore();
    }
    for (const transform of contentTransforms) { ctx.translate(transform.center.x, transform.center.y); ctx.rotate(transform.rotation * Math.PI / 180); ctx.translate(-transform.center.x, -transform.center.y); }
    const viewport = viewportForTransforms(contentTransforms);
    const selected = ports.selectedSet();
    const currentMove = ports.moveOrigin();
    const currentResize = ports.resizeOrigin();
    const drag = includeSelection && sourceItems === ports.elements() && currentMove?.moved ? currentMove : undefined;
    const spatialItems = drag?.before ?? sourceItems;
    const queriedIndices = (spatialItems === ports.elements() ? ports.spatialIndex() : elementSpatialIndex(spatialItems)).query(viewport);
    let addedPaintIndices: Set<number> | undefined;
    const addPaintIndex = (index: number) => { (addedPaintIndices ??= new Set()).add(index); };
    // The spatial index tracks a connector's endpoints and stored route points.
    // Auto routes are calculated only for display, so their bends can leave the
    // indexed bounds. Include them directly and bypass tiles whose bounds and
    // invalidation data cannot account for those calculated bends.
    // Resizing a non-connector preserves connector identities and order, so
    // reuse the stationary list rather than scanning the whole scene per frame.
    const autoRouteIndices = getAutoRouteIndices(sourceItems, !!currentResize && !isConnector(currentResize.original));
    let hasUnindexedAutoRoutes = false;
    for (const index of autoRouteIndices) {
      const item = sourceItems[index];
      if (!item || !isConnector(item) || !ports.connectorMayIntersect(item, viewport, sourceItems)) continue;
      hasUnindexedAutoRoutes = true;
      addPaintIndex(index);
    }
    if (drag) {
      const movedIds = new Set(drag.targets.keys());
      for (const index of drag.indices) addPaintIndex(index);
      sourceItems.forEach((element, index) => {
        if (!isConnector(element)) return;
        const bindings = [element.startBinding, element.endBinding, element.forkUpper?.endBinding, element.forkLower?.endBinding];
        if (bindings.some(binding => binding && movedIds.has(binding.elementId)) || element.autoRoute) addPaintIndex(index);
      });
    }
    const paintIndices = orderedSceneIndices(queriedIndices, addedPaintIndices);
    // Paint vectors directly at 100% and above. Repeated bitmap tile copies
    // soften one-pixel strokes and text even when their nominal scale matches.
    const tileDrawing = state.zoom < 1 && !contentTransforms.length && !hasUnindexedAutoRoutes && includeSelection && !transparent && !viewOverride && !drag && sourceItems === ports.elements() && ports.tileCacheAllowed()
      && tileCache.draw(ctx, viewport, state.zoom, dpr, sourceItems, ports.spatialIndex(), ports.tileCacheKey(), (tileContext, element, tileViewport, items) => {
        const drawn = isConnector(element) ? ports.connectorForView(element as ShapeElement, items) : element;
        ports.drawElement(tileContext, drawn, tileViewport, items);
      });
    for (const index of paintIndices) {
      const element = sourceItems[index];
      if (!element) continue;
      if (ports.isHidden(element)) continue;
      const moved = !!drag?.indices.includes(index);
      const resolvedElement = drag ? ports.resolveDraggedConnector(element, index, drag) : element;
      const drawnElement = isConnector(resolvedElement) ? ports.connectorForView(resolvedElement as ShapeElement, sourceItems) : resolvedElement;
      const bounds = elementBounds(moved ? element : drawnElement);
      const visibleBounds = moved ? { ...bounds, x: bounds.x + drag!.dx, y: bounds.y + drag!.dy } : bounds;
      if (!ports.intersectsBounds(viewport.x, viewport.y, viewport.x + viewport.w, viewport.y + viewport.h, visibleBounds)) continue;
      ctx.save(); if (moved) ctx.translate(drag!.dx, drag!.dy);
      const drawViewport = moved ? { ...viewport, x: viewport.x - drag!.dx, y: viewport.y - drag!.dy } : viewport;
      if (!tileDrawing) ports.drawElement(ctx, drawnElement, drawViewport, sourceItems);
      const isSelected = selected.has(index);
      const rotation = element.rotation ?? 0;
      const frame = rotation ? elementBounds({ ...element, rotation: 0 } as Element) : elementBounds(element);
      if (includeSelection && isSelected) drawSelectionOutline(ctx, frame, state.zoom, rotation);
      if (includeSelection && (isSelected || ports.hoveredIndex() === index) && isConnector(element)) {
        if (isSelected && selected.size === 1 && !ports.isLocked(element) && !ports.boardLocked()) for (const handle of ports.connectorHandles(element as ShapeElement)) { const routeHandle = handle.id.startsWith("route") || handle.id.startsWith("auto-route:") || handle.id.startsWith("waypoint:") || handle.id.includes(":route:"); ctx.beginPath(); ctx.fillStyle = routeHandle ? "#dbeafe" : "#ffffff"; ctx.arc(handle.x, handle.y, (routeHandle ? 4 : 6) / state.zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      } else if (includeSelection && (isSelected || ports.hoveredIndex() === index)) {
        if (isSelected && !ports.isLocked(element) && selected.size === 1 && ports.tool() === "select" && (element.type !== "group" || !!element.note && !element.note.collapsed || !!element.libraryComponent || !!element.container) && element.type !== "freehand") {
          drawTransformHandles(ctx, frame, state.zoom, element.type !== "group" || !!element.libraryComponent || !!element.container, rotation);
          if (element.type === "group" && element.libraryComponent?.kind === "diagram-swimlane") for (const handle of swimlaneDividerHandles(element)) {
            const size = 1 / state.zoom; ctx.beginPath(); ctx.roundRect(handle.point.x - 7 * size, handle.point.y - 3 * size, 14 * size, 6 * size, 3 * size); ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 1.5 * size; ctx.fill(); ctx.stroke();
          }
          if (element.type === "flowchart") for (const handle of shapeAdjustmentHandles(element)) {
            ctx.beginPath(); ctx.arc(handle.x, handle.y, 4.5 / state.zoom, 0, Math.PI * 2);
            ctx.fillStyle = "#fff7d6"; ctx.strokeStyle = "#ba7400"; ctx.lineWidth = 1.5 / state.zoom; ctx.fill(); ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
    const activeSnapGuides = drag?.guides ?? (includeSelection && sourceItems === ports.elements() ? currentResize?.guides : undefined);
    if (activeSnapGuides && (activeSnapGuides.x || activeSnapGuides.y)) {
      const alignedSegment = (movingStart: number, movingLength: number, referenceStart: number, referenceLength: number) => {
        const movingEnd = movingStart + movingLength; const referenceEnd = referenceStart + referenceLength;
        const overlapStart = Math.max(movingStart, referenceStart); const overlapEnd = Math.min(movingEnd, referenceEnd);
        if (overlapEnd > overlapStart) {
          const center = overlapStart + (overlapEnd - overlapStart) / 2;
          const half = Math.min(7 / state.zoom, (overlapEnd - overlapStart) / 2);
          return [center - half, center + half] as const;
        }
        if (movingEnd <= referenceStart) return [movingEnd, referenceStart] as const;
        return [referenceEnd, movingStart] as const;
      };
      ctx.save(); ctx.strokeStyle = "#e24978"; ctx.fillStyle = "#e24978"; ctx.globalAlpha = .95; ctx.lineWidth = 1.5 / state.zoom; ctx.setLineDash([5 / state.zoom, 3 / state.zoom]);
      const drawGuide = (axis: "x" | "y", guide: NonNullable<CanvasSnapGuides[typeof axis]>) => {
        const [start, end] = axis === "x"
          ? alignedSegment(guide.moving.y, guide.moving.h, guide.reference.y, guide.reference.h)
          : alignedSegment(guide.moving.x, guide.moving.w, guide.reference.x, guide.reference.w);
        const a = Math.min(start, end); const b = Math.max(start, end); const half = 6 / state.zoom;
        ctx.beginPath();
        if (axis === "x") { ctx.moveTo(guide.coordinate, viewport.y); ctx.lineTo(guide.coordinate, viewport.y + viewport.h); }
        else { ctx.moveTo(viewport.x, guide.coordinate); ctx.lineTo(viewport.x + viewport.w, guide.coordinate); }
        ctx.stroke(); ctx.setLineDash([]);
        for (const point of [a, b > a ? b : a + half * 2]) {
          ctx.beginPath(); ctx.arc(axis === "x" ? guide.coordinate : point, axis === "x" ? point : guide.coordinate, 2.2 / state.zoom, 0, Math.PI * 2); ctx.fill();
        }
        ctx.setLineDash([5 / state.zoom, 3 / state.zoom]);
      };
      if (activeSnapGuides.x) drawGuide("x", activeSnapGuides.x);
      if (activeSnapGuides.y) drawGuide("y", activeSnapGuides.y);
      ctx.restore();
    }
    const endpointGuide = includeSelection && sourceItems === ports.elements() && currentResize && isConnector(currentResize.original) ? currentResize.endpointGuide : undefined;
    if (endpointGuide) {
      ctx.save(); ctx.strokeStyle = "#e24978"; ctx.fillStyle = "#e24978"; ctx.globalAlpha = .9; ctx.lineWidth = 1.25 / state.zoom; ctx.setLineDash([6 / state.zoom, 4 / state.zoom]); ctx.beginPath();
      if (endpointGuide.axis === "y") { ctx.moveTo(viewport.x, endpointGuide.coordinate); ctx.lineTo(viewport.x + viewport.w, endpointGuide.coordinate); }
      else { ctx.moveTo(endpointGuide.coordinate, viewport.y); ctx.lineTo(endpointGuide.coordinate, viewport.y + viewport.h); }
      ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(endpointGuide.point.x, endpointGuide.point.y, 3.5 / state.zoom, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    const tokenId = ports.simulationTokenId?.();
    const token = tokenId ? sourceItems.find(item => item.id === tokenId && !ports.isHidden(item)) : undefined;
    if (token) {
      const tokenBounds = elementBounds(token); const tokenX = tokenBounds.x + tokenBounds.w / 2; const tokenY = tokenBounds.y + tokenBounds.h / 2;
      ctx.save(); ctx.fillStyle = "#f59e0b"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2 / state.zoom;
      ctx.beginPath(); ctx.arc(tokenX, tokenY, 8 / state.zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.fillStyle = "#b45309"; ctx.arc(tokenX, tokenY, 3 / state.zoom, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (includeSelection && (ports.tool() === "arrow" || ports.tool() === "line" || currentResize && isConnector(currentResize.original))) {
      const drawPorts = (items: Element[]) => { for (const item of items) {
        const moved = !!drag?.targets.has(item.id ?? ""); const bounds = elementBounds(item);
        const visibleBounds = moved ? { ...bounds, x: bounds.x + drag!.dx, y: bounds.y + drag!.dy } : bounds;
        if (ports.isHidden(item) || ports.isLocked(item) || !ports.intersectsBounds(viewport.x, viewport.y, viewport.x + viewport.w, viewport.y + viewport.h, visibleBounds)) continue;
        if (item.type === "group") {
          if (item.componentBounds && (item.libraryComponent || item.container || item.masterId)) {
            if (moved) { ctx.save(); ctx.translate(drag!.dx, drag!.dy); }
            for (const anchor of connectionAnchorsFor(item)) { const point = anchorPoint(item, anchor); ctx.beginPath(); ctx.arc(point.x, point.y, 4 / state.zoom, 0, Math.PI * 2); ctx.fill(); }
            for (const port of item.connectionPoints ?? item.libraryComponent?.connectionPoints ?? item.container?.connectionPoints ?? []) { const point = anchorPoint(item, port.anchor, undefined, port.id); ctx.beginPath(); ctx.arc(point.x, point.y, 5 / state.zoom, 0, Math.PI * 2); ctx.fill(); }
            if (moved) ctx.restore();
          }
          drawPorts(item.elements); continue;
        }
        if (!isConnectable(item)) continue;
        if (moved) { ctx.save(); ctx.translate(drag!.dx, drag!.dy); }
        const anchors: { anchor: Point; rowId?: string; portId?: string }[] = [
          ...connectionAnchorsFor(item).map(anchor => ({ anchor })),
          ...(("connectionPoints" in item ? item.connectionPoints : undefined) ?? []).map(port => ({ anchor: port.anchor, portId: port.id })),
          ...(item.type === "schemaTable" ? item.columns.flatMap(column => [{ anchor: { x: 0, y: .5 }, rowId: column.id }, { anchor: { x: 1, y: .5 }, rowId: column.id }]) : []),
        ];
        for (const { anchor, rowId, portId } of anchors) { const point = anchorPoint(item, anchor, rowId, portId); ctx.beginPath(); ctx.arc(point.x, point.y, portId ? 5 / state.zoom : 4 / state.zoom, 0, Math.PI * 2); ctx.fill(); }
        if (moved) ctx.restore();
      } }; ctx.save(); ctx.fillStyle = "#5d94e7"; ctx.globalAlpha = .7;
      const portElements = ports.elements();
      const portItems = drag?.before ?? portElements;
      const portIndices = new Set((portItems === ports.elements() ? ports.spatialIndex() : elementSpatialIndex(portItems)).query(viewport));
      for (const index of drag?.indices ?? []) portIndices.add(index);
      drawPorts([...portIndices].sort((a, b) => a - b).map(index => portElements[index]).filter((item): item is Element => !!item));
      const hint = ports.attachmentHint(); if (hint) { ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(hint.x, hint.y, 8 / state.zoom, 0, Math.PI * 2); ctx.strokeStyle = "#2675f5"; ctx.lineWidth = 2 / state.zoom; ctx.stroke(); } ctx.restore();
    }
    const transientLaser = ports.laserTrail();
    if (includeSelection && transientLaser) drawLaserStroke(ctx, transientLaser.points, transientLaser.opacity, ports.laserThickness() / state.zoom);
    const activePreview = ports.preview();
    if (includeSelection && activePreview && (includeStrokePreview || activePreview.type !== "pen" || ports.tool() === "laser")) {
      const { start, end, type, color: stroke, thickness: widthPx, opacity } = activePreview;
      if ((type === "line" || type === "arrow") && activePreview.alignmentGuide) {
        const guide = activePreview.alignmentGuide;
        ctx.save(); ctx.strokeStyle = "#e24978"; ctx.fillStyle = "#e24978"; ctx.globalAlpha = .9; ctx.lineWidth = 1.25 / state.zoom; ctx.setLineDash([6 / state.zoom, 4 / state.zoom]); ctx.beginPath();
        if (guide.axis === "y") { ctx.moveTo(viewport.x, guide.coordinate); ctx.lineTo(viewport.x + viewport.w, guide.coordinate); }
        else { ctx.moveTo(guide.coordinate, viewport.y); ctx.lineTo(guide.coordinate, viewport.y + viewport.h); }
        ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(end.x, end.y, 3.5 / state.zoom, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      if (type === "pen") { if (ports.tool() === "laser") drawLaserStroke(ctx, ports.currentPoints(), 1, ports.laserThickness() / state.zoom); else ports.drawFreehandPreview(ctx, { type: "freehand", points: ports.currentPoints(), color: stroke, thickness: widthPx, opacity }); }
      else ports.drawElement(ctx, { type, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color: stroke, thickness: widthPx, lineStyle: ports.lineStyle(), flowchartShape: activePreview.flowchartShape, lineRoute: activePreview.lineRoute, arrowRoute: activePreview.arrowRoute, edgeStyle: ports.edgeStyle(), cornerRadius: ports.cornerRadius(), ...(ports.fillEnabled() && (type === "rectangle" || type === "circle" || type === "diamond" || type === "triangle" || type === "flowchart") ? { fillColor: ports.fillColor(), fillOpacity: ports.fillOpacity() } : {}), ...(type === "line" ? { startHead: ports.defaultLineStartHead(), endHead: ports.defaultLineEndHead() } : {}), ...(type === "arrow" ? { startHead: ports.defaultStartHead(), endHead: ports.defaultEndHead(), ...(activePreview.arrowRoute === "forked" ? { forkUpper: { endHead: ports.defaultForkUpperHead() }, forkLower: { endHead: ports.defaultForkLowerHead() } } : {}) } : {}) });
    }
    const groupEditBoundary = includeSelection && sourceItems === ports.elements() ? ports.groupEditBoundary?.() : undefined;
    if (groupEditBoundary) {
      const bounds = groupEditBoundary.bounds; const padding = 3 / state.zoom;
      ctx.save(); ctx.beginPath(); ctx.rect(bounds.x - padding, bounds.y - padding, bounds.w + padding * 2, bounds.h + padding * 2);
      ctx.setLineDash([]); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3.5 / state.zoom; ctx.stroke();
      ctx.strokeStyle = groupEditBoundary.color; ctx.lineWidth = 1.8 / state.zoom; ctx.setLineDash([7 / state.zoom, 4 / state.zoom]); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    const contentPointToScreen = (point: Point) => {
      for (let index = contentTransforms.length - 1; index >= 0; index--) {
        const transform = contentTransforms[index];
        point = rotatePoint(point, transform.center, transform.rotation);
      }
      return { x: point.x * state.zoom + state.panX, y: point.y * state.zoom + state.panY };
    };
    const activeMarquee = ports.marquee();
    if (includeSelection && activeMarquee) {
      if (activeMarquee.lasso && activeMarquee.lasso.length > 1) {
        ctx.save(); ctx.strokeStyle = "#5888c5"; ctx.fillStyle = "#76a7e51a"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.lineJoin = "round"; ctx.beginPath();
        activeMarquee.lasso.forEach((point, index) => { const screen = contentPointToScreen(point); if (index) ctx.lineTo(screen.x, screen.y); else ctx.moveTo(screen.x, screen.y); });
        ctx.fill(); ctx.stroke(); ctx.restore();
        return;
      }
      const { start, end } = activeMarquee;
      const corners = [
        { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) },
        { x: Math.max(start.x, end.x), y: Math.min(start.y, end.y) },
        { x: Math.max(start.x, end.x), y: Math.max(start.y, end.y) },
        { x: Math.min(start.x, end.x), y: Math.max(start.y, end.y) },
      ].map(contentPointToScreen);
      ctx.save(); ctx.strokeStyle = "#5888c5"; ctx.fillStyle = "#76a7e51a"; ctx.lineWidth = 1; ctx.setLineDash([5, 4]); ctx.beginPath();
      corners.forEach((point, index) => { if (index) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y); });
      ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }

  function drawStrokePreview(ctx: CanvasRenderingContext2D, dpr: number) {
    const preview = ports.preview(); if (preview?.type !== "pen") return;
    const state = ports.canvasState();
    ctx.save(); ctx.setTransform(dpr * state.zoom, 0, 0, dpr * state.zoom, dpr * state.panX, dpr * state.panY);
    for (const transform of ports.contentTransforms?.() ?? []) {
      ctx.translate(transform.center.x, transform.center.y); ctx.rotate(transform.rotation * Math.PI / 180); ctx.translate(-transform.center.x, -transform.center.y);
    }
    ports.drawFreehandPreview(ctx, { type: "freehand", points: ports.currentPoints(), color: preview.color, thickness: preview.thickness, opacity: preview.opacity });
    ctx.restore();
  }

  return { drawGrid, drawTransformHandles, drawScene, drawStrokePreview, dispose: () => tileCache.clear() };

}
