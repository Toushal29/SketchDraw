import type { ArrowHead, Bounds, CanvasState, EdgeStyle, Element, FreehandElement, Point, Preview, ShapeElement, StrokePoint, StrokeStyle, Tool } from "../../model";
import { BOX_ANCHORS, anchorPoint, isConnectable, isConnector } from "../../operations";
import { elementBounds } from "./bounds";
import { traceConnector } from "../connectors/geometry";
import { ElementSpatialIndex, elementSpatialIndex } from "./spatial-index";
import { SceneTileCache } from "./scene-tile-cache";
import { gridStepForStyle, isometricRowHeight, isometricRowOffset, type CanvasGridStyle } from "./input";

type DragState = { indices: number[]; point: Point; before: Element[]; moved: boolean; dx: number; dy: number; guides?: { x?: number; y?: number }; snapTargets: { x: number[]; y: number[] }; targets: Map<string, Element> };
export type CanvasSceneRendererPorts = {
  elements: () => Element[];
  isHidden: (element: Element) => boolean;
  isLocked: (element: Element) => boolean;
  spatialIndex: () => ElementSpatialIndex;
  tileCacheKey: () => string;
  tileCacheAllowed: () => boolean;
  canvasState: () => CanvasState;
  renderedBoardColor: () => string;
  whiteboardStyle: () => string;
  showGrid: () => boolean;
  gridSize: number;
  selectedSet: () => Set<number>;
  moveOrigin: () => DragState | undefined;
  resizeOrigin: () => { original: Element } | undefined;
  hoveredIndex: () => number | undefined;
  boardLocked: () => boolean;
  tool: () => Tool;
  attachmentHint: () => Point | undefined;
  marquee: () => { start: Point; end: Point } | undefined;
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
  const autoRouteIndicesByElements = new WeakMap<Element[], { visibilityKey: string; indices: number[] }>();

  function getAutoRouteIndices(items: Element[]) {
    const visibilityKey = ports.tileCacheKey();
    const cached = autoRouteIndicesByElements.get(items);
    if (cached?.visibilityKey === visibilityKey) return cached.indices;
    const indices: number[] = [];
    {
      items.forEach((item, index) => {
        if (isConnector(item) && item.autoRoute && !ports.isHidden(item) && !item.routePoints) indices.push(index);
      });
    }
    autoRouteIndicesByElements.set(items, { visibilityKey, indices });
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

  // Schema cards size to their field rows, so expose horizontal handles without empty vertical space.
  function drawTransformHandles(ctx: CanvasRenderingContext2D, bounds: Bounds, zoom: number, includeRotate = true, rotation = 0, allowVerticalResize = true) {
    const handles = transformHandlePoints(bounds, zoom, includeRotate, rotation); const rotate = includeRotate ? handles.pop() : undefined; const top = rotatePoint({ x: bounds.x + bounds.w / 2, y: bounds.y }, { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }, rotation);
    ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = "#547bb1"; ctx.fillStyle = "#ffffff"; ctx.lineWidth = 1 / zoom;
    if (rotate) { ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(rotate.x, rotate.y); ctx.stroke(); }
    for (const handle of handles) { if (!allowVerticalResize && (handle.id === "n" || handle.id === "s")) continue; ctx.beginPath(); ctx.rect(handle.x - 4 / zoom, handle.y - 4 / zoom, 8 / zoom, 8 / zoom); ctx.fill(); ctx.stroke(); }
    if (rotate) { ctx.beginPath(); ctx.arc(rotate.x, rotate.y, 5 / zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } ctx.restore();
  }

  function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number, includeSelection: boolean, transparent = false, viewOverride?: CanvasState, sourceItems = ports.elements(), includeGrid = true, includeStrokePreview = true) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    if (!transparent) { ctx.fillStyle = ports.renderedBoardColor(); ctx.fillRect(0, 0, width, height); }
    const state = viewOverride ?? ports.canvasState(); if (!transparent && includeGrid) drawGrid(ctx, width, height, state);
    ctx.save(); ctx.translate(state.panX, state.panY); ctx.scale(state.zoom, state.zoom);
    const padding = 16 / state.zoom;
    const viewport = { x: -state.panX / state.zoom - padding, y: -state.panY / state.zoom - padding, w: width / state.zoom + padding * 2, h: height / state.zoom + padding * 2 };
    const selected = ports.selectedSet();
    const currentMove = ports.moveOrigin();
    const drag = includeSelection && sourceItems === ports.elements() && currentMove?.moved ? currentMove : undefined;
    const spatialItems = drag?.before ?? sourceItems;
    const paintIndices = new Set((spatialItems === ports.elements() ? ports.spatialIndex() : elementSpatialIndex(spatialItems)).query(viewport));
    // The spatial index tracks a connector's endpoints and stored route points.
    // Auto routes are calculated only for display, so their bends can leave the
    // indexed bounds. Include them directly and bypass tiles whose bounds and
    // invalidation data cannot account for those calculated bends.
    const autoRouteIndices = getAutoRouteIndices(sourceItems);
    const hasUnindexedAutoRoutes = autoRouteIndices.length > 0;
    if (hasUnindexedAutoRoutes) autoRouteIndices.forEach(index => paintIndices.add(index));
    if (drag) {
      const movedIds = new Set(drag.targets.keys());
      for (const index of drag.indices) paintIndices.add(index);
      sourceItems.forEach((element, index) => {
        if (!isConnector(element)) return;
        const bindings = [element.startBinding, element.endBinding, element.forkUpper?.endBinding, element.forkLower?.endBinding];
        if (bindings.some(binding => binding && movedIds.has(binding.elementId)) || element.autoRoute) paintIndices.add(index);
      });
    }
    const tileDrawing = !hasUnindexedAutoRoutes && includeSelection && !transparent && !viewOverride && !drag && sourceItems === ports.elements() && ports.tileCacheAllowed()
      && tileCache.draw(ctx, viewport, state.zoom, dpr, sourceItems, ports.spatialIndex(), ports.tileCacheKey(), (tileContext, element, tileViewport, items) => {
        const drawn = isConnector(element) ? ports.connectorForView(element as ShapeElement, items) : element;
        ports.drawElement(tileContext, drawn, tileViewport, items);
      });
    for (const index of [...paintIndices].sort((a, b) => a - b)) {
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
      if (includeSelection && (isSelected || ports.hoveredIndex() === index) && isConnector(element)) {
        ctx.save(); ctx.strokeStyle = "#548ce8"; ctx.globalAlpha = .65; ctx.lineWidth = (isSelected ? 2 : 1) / state.zoom; traceConnector(ctx, drawnElement as ShapeElement); ctx.stroke();
        if (isSelected && selected.size === 1 && !ports.isLocked(element) && !ports.boardLocked()) for (const handle of ports.connectorHandles(element as ShapeElement)) { const routeHandle = handle.id.startsWith("route") || handle.id.startsWith("auto-route:") || handle.id.includes(":route:"); ctx.beginPath(); ctx.fillStyle = routeHandle ? "#dbeafe" : "#ffffff"; ctx.arc(handle.x, handle.y, (routeHandle ? 4 : 6) / state.zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        ctx.restore();
      } else if (includeSelection && (isSelected || ports.hoveredIndex() === index)) {
        const bounds = elementBounds(element); const handlePadding = 5 / state.zoom;
        ctx.save(); ctx.strokeStyle = isSelected ? "#547bb1" : "#8298b8"; ctx.globalAlpha = isSelected ? 1 : 0.62; ctx.lineWidth = 1 / state.zoom; ctx.setLineDash([4 / state.zoom, 3 / state.zoom]);
        const rotation = element.rotation ?? 0; const frame = rotation ? elementBounds({ ...element, rotation: 0 } as Element) : bounds;
        if (rotation) {
          ctx.translate(frame.x + frame.w / 2, frame.y + frame.h / 2); ctx.rotate(rotation * Math.PI / 180);
          ctx.strokeRect(-frame.w / 2 - handlePadding, -frame.h / 2 - handlePadding, Math.max(frame.w + handlePadding * 2, 2 / state.zoom), Math.max(frame.h + handlePadding * 2, 2 / state.zoom));
        } else ctx.strokeRect(bounds.x - handlePadding, bounds.y - handlePadding, Math.max(bounds.w + handlePadding * 2, 2 / state.zoom), Math.max(bounds.h + handlePadding * 2, 2 / state.zoom));
        ctx.restore();
        if (isSelected && !ports.isLocked(element) && selected.size === 1 && ports.tool() === "select" && (element.type !== "group" || !!element.note && !element.note.collapsed || !!element.libraryComponent || !!element.container) && element.type !== "freehand") {
          drawTransformHandles(ctx, frame, state.zoom, element.type !== "group" || !!element.libraryComponent || !!element.container, rotation, element.type !== "schemaTable");
        }
      }
      ctx.restore();
    }
    if (drag?.guides && (Number.isFinite(drag.guides.x) || Number.isFinite(drag.guides.y))) {
      ctx.save(); ctx.strokeStyle = "#e24978"; ctx.globalAlpha = .92; ctx.lineWidth = 1 / state.zoom; ctx.setLineDash([6 / state.zoom, 4 / state.zoom]); ctx.beginPath();
      if (Number.isFinite(drag.guides.x)) { ctx.moveTo(drag.guides.x!, viewport.y); ctx.lineTo(drag.guides.x!, viewport.y + viewport.h); }
      if (Number.isFinite(drag.guides.y)) { ctx.moveTo(viewport.x, drag.guides.y!); ctx.lineTo(viewport.x + viewport.w, drag.guides.y!); }
      ctx.stroke(); ctx.restore();
    }
    const tokenId = ports.simulationTokenId?.();
    const token = tokenId ? sourceItems.find(item => item.id === tokenId && !ports.isHidden(item)) : undefined;
    if (token) {
      const tokenBounds = elementBounds(token); const tokenX = tokenBounds.x + tokenBounds.w / 2; const tokenY = tokenBounds.y + tokenBounds.h / 2;
      ctx.save(); ctx.fillStyle = "#f59e0b"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2 / state.zoom;
      ctx.beginPath(); ctx.arc(tokenX, tokenY, 8 / state.zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.fillStyle = "#b45309"; ctx.arc(tokenX, tokenY, 3 / state.zoom, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    const currentResize = ports.resizeOrigin();
    if (includeSelection && (ports.tool() === "arrow" || ports.tool() === "line" || currentResize && isConnector(currentResize.original))) {
      const drawPorts = (items: Element[]) => { for (const item of items) {
        const moved = !!drag?.targets.has(item.id ?? ""); const bounds = elementBounds(item);
        const visibleBounds = moved ? { ...bounds, x: bounds.x + drag!.dx, y: bounds.y + drag!.dy } : bounds;
        if (ports.isHidden(item) || ports.isLocked(item) || !ports.intersectsBounds(viewport.x, viewport.y, viewport.x + viewport.w, viewport.y + viewport.h, visibleBounds)) continue;
        if (item.type === "group") {
          if (item.componentBounds && (item.libraryComponent || item.container)) {
            if (moved) { ctx.save(); ctx.translate(drag!.dx, drag!.dy); }
            for (const anchor of BOX_ANCHORS) { const point = anchorPoint(item, anchor); ctx.beginPath(); ctx.arc(point.x, point.y, 4 / state.zoom, 0, Math.PI * 2); ctx.fill(); }
            for (const port of item.libraryComponent?.connectionPoints ?? item.container?.connectionPoints ?? []) { const point = anchorPoint(item, port.anchor, undefined, port.id); ctx.beginPath(); ctx.arc(point.x, point.y, 5 / state.zoom, 0, Math.PI * 2); ctx.fill(); }
            if (moved) ctx.restore();
          }
          drawPorts(item.elements); continue;
        }
        if (!isConnectable(item)) continue;
        if (moved) { ctx.save(); ctx.translate(drag!.dx, drag!.dy); }
        const anchors: { anchor: Point; rowId?: string; portId?: string }[] = [
          ...BOX_ANCHORS.map(anchor => ({ anchor })),
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
      if (type === "pen") { if (ports.tool() === "laser") drawLaserStroke(ctx, ports.currentPoints(), 1, ports.laserThickness() / state.zoom); else ports.drawFreehandPreview(ctx, { type: "freehand", points: ports.currentPoints(), color: stroke, thickness: widthPx, opacity }); }
      else ports.drawElement(ctx, { type, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color: stroke, thickness: widthPx, lineStyle: ports.lineStyle(), flowchartShape: activePreview.flowchartShape, lineRoute: activePreview.lineRoute, arrowRoute: activePreview.arrowRoute, edgeStyle: ports.edgeStyle(), cornerRadius: ports.cornerRadius(), ...(ports.fillEnabled() && (type === "rectangle" || type === "circle" || type === "diamond" || type === "triangle" || type === "flowchart") ? { fillColor: ports.fillColor(), fillOpacity: ports.fillOpacity() } : {}), ...(type === "line" ? { startHead: ports.defaultLineStartHead(), endHead: ports.defaultLineEndHead() } : {}), ...(type === "arrow" ? { startHead: ports.defaultStartHead(), endHead: ports.defaultEndHead(), ...(activePreview.arrowRoute === "forked" ? { forkUpper: { endHead: ports.defaultForkUpperHead() }, forkLower: { endHead: ports.defaultForkLowerHead() } } : {}) } : {}) });
    }
    ctx.restore();
    const activeMarquee = ports.marquee();
    if (includeSelection && activeMarquee) {
      const { start, end } = activeMarquee; const left = Math.min(start.x, end.x) * state.zoom + state.panX; const top = Math.min(start.y, end.y) * state.zoom + state.panY;
      const marqueeWidth = Math.abs(end.x - start.x) * state.zoom; const marqueeHeight = Math.abs(end.y - start.y) * state.zoom;
      ctx.save(); ctx.strokeStyle = "#5888c5"; ctx.fillStyle = "#76a7e51a"; ctx.lineWidth = 1; ctx.setLineDash([5, 4]); ctx.fillRect(left, top, marqueeWidth, marqueeHeight); ctx.strokeRect(left, top, marqueeWidth, marqueeHeight); ctx.restore();
    }
  }

  function drawStrokePreview(ctx: CanvasRenderingContext2D, dpr: number) {
    const preview = ports.preview(); if (preview?.type !== "pen") return;
    const state = ports.canvasState();
    ctx.save(); ctx.setTransform(dpr * state.zoom, 0, 0, dpr * state.zoom, dpr * state.panX, dpr * state.panY);
    ports.drawFreehandPreview(ctx, { type: "freehand", points: ports.currentPoints(), color: preview.color, thickness: preview.thickness, opacity: preview.opacity });
    ctx.restore();
  }

  return { drawGrid, drawTransformHandles, drawScene, drawStrokePreview, dispose: () => tileCache.clear() };

}
