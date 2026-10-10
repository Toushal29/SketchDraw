import type { ArrowHead, Bounds, CanvasState, EdgeStyle, Element, Point, Preview, ShapeElement, StrokePoint, StrokeStyle, Tool } from "../../model";
import { BOX_ANCHORS, anchorPoint, isConnectable, isConnector } from "../../operations";
import { elementBounds } from "./bounds";
import { traceConnector } from "./geometry";

type DragState = { indices: number[]; point: Point; before: Element[]; moved: boolean; dx: number; dy: number; snapTargets: { x: number[]; y: number[] }; targets: Map<string, Element> };
type AlignmentGuides = { x?: number; y?: number };

export type CanvasSceneRendererPorts = {
  elements: () => Element[];
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
  alignmentGuides: () => AlignmentGuides | undefined;
  marquee: () => { start: Point; end: Point } | undefined;
  showAlignmentGuides: () => boolean;
  laserTrail: () => { points: Point[]; opacity: number } | undefined;
  laserThickness: () => number;
  preview: () => Preview | undefined;
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
  drawElement: (ctx: CanvasRenderingContext2D, element: Element, viewport?: Bounds, sourceItems?: Element[]) => void;
  drawLaserStroke: (ctx: CanvasRenderingContext2D, points: Point[], opacity: number, thickness: number) => void;
  connectorForView: (item: ShapeElement, sourceItems?: Element[]) => ShapeElement;
  connectorHandles: (item: ShapeElement) => { id: string; x: number; y: number }[];
  resolveDraggedConnector: (element: Element, index: number, drag: DragState) => Element;
  intersectsBounds: (left: number, top: number, right: number, bottom: number, bounds: Bounds) => boolean;
};

export function transformHandlePoints(bounds: Bounds, zoom: number, includeRotate = true) {
  const midX = bounds.x + bounds.w / 2; const midY = bounds.y + bounds.h / 2; const offset = 24 / zoom;
  const handles = [{ id: "nw", x: bounds.x, y: bounds.y }, { id: "n", x: midX, y: bounds.y }, { id: "ne", x: bounds.x + bounds.w, y: bounds.y }, { id: "e", x: bounds.x + bounds.w, y: midY }, { id: "se", x: bounds.x + bounds.w, y: bounds.y + bounds.h }, { id: "s", x: midX, y: bounds.y + bounds.h }, { id: "sw", x: bounds.x, y: bounds.y + bounds.h }, { id: "w", x: bounds.x, y: midY }];
  return includeRotate ? [...handles, { id: "rotate", x: midX, y: bounds.y - offset }] : handles;
}

export function createCanvasSceneRenderer(ports: CanvasSceneRendererPorts) {
  function drawLaserStroke(ctx: CanvasRenderingContext2D, points: Point[], opacity: number, thickness: number) {
    ports.drawLaserStroke(ctx, points, opacity, thickness);
  }

  function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, state: CanvasState) {
    const style = ports.whiteboardStyle();
    if (!ports.showGrid() || style === "plain") return;
    const multiplier = Math.max(1, 2 ** Math.max(0, Math.ceil(Math.log2(0.65 / state.zoom))));
    const baseStep = style === "small-dots" || style === "small-grid" ? 12 : style === "ruled" ? 30 : ports.gridSize;
    const step = baseStep * multiplier; const left = -state.panX / state.zoom; const top = -state.panY / state.zoom;
    const right = (width - state.panX) / state.zoom; const bottom = (height - state.panY) / state.zoom;
    const hex = ports.renderedBoardColor().replace("#", ""); const rgb = Number.parseInt(hex.length === 3 ? hex.split("").map(part => part + part).join("") : hex, 16); const luminance = (0.2126 * ((rgb >> 16) & 255)) + (0.7152 * ((rgb >> 8) & 255)) + (0.0722 * (rgb & 255));
    ctx.save(); ctx.translate(state.panX, state.panY); ctx.scale(state.zoom, state.zoom);
    const startX = Math.floor(left / step) * step; const startY = Math.floor(top / step) * step;
    ctx.strokeStyle = luminance < 130 ? "#353a45" : "#e4e5e2"; ctx.lineWidth = 0.75 / state.zoom; ctx.beginPath();
    if (style === "lines" || style === "small-grid") {
      for (let x = startX; x <= right; x += step) { ctx.moveTo(x, top); ctx.lineTo(x, bottom); }
      for (let y = startY; y <= bottom; y += step) { ctx.moveTo(left, y); ctx.lineTo(right, y); }
      ctx.stroke();
    } else if (style === "ruled") {
      for (let y = startY; y <= bottom; y += step) { ctx.moveTo(left, y); ctx.lineTo(right, y); }
      ctx.stroke();
    } else if (style === "isometric") {
      // Index from the document origin so the pattern shares the fixed grid snap origin.
      const rowStep = step * Math.sqrt(3) / 2;
      const firstRow = Math.floor(top / rowStep) - 1; const lastRow = Math.ceil(bottom / rowStep) + 1;
      const firstX = left - step; const lastX = right + step;
      for (let row = firstRow; row <= lastRow; row++) {
        const y = row * rowStep; const phase = Math.abs(row % 2) === 1 ? step / 2 : 0;
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
      for (let x = startX; x <= right; x += step) for (let y = startY; y <= bottom; y += step) { ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }

  function drawTransformHandles(ctx: CanvasRenderingContext2D, bounds: Bounds, zoom: number, includeRotate = true) {
    const handles = transformHandlePoints(bounds, zoom, includeRotate); const rotate = includeRotate ? handles.pop() : undefined; const top = { x: bounds.x + bounds.w / 2, y: bounds.y };
    ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = "#547bb1"; ctx.fillStyle = "#ffffff"; ctx.lineWidth = 1 / zoom;
    if (rotate) { ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(rotate.x, rotate.y); ctx.stroke(); }
    for (const handle of handles) { ctx.beginPath(); ctx.rect(handle.x - 4 / zoom, handle.y - 4 / zoom, 8 / zoom, 8 / zoom); ctx.fill(); ctx.stroke(); }
    if (rotate) { ctx.beginPath(); ctx.arc(rotate.x, rotate.y, 5 / zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } ctx.restore();
  }

  function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number, includeSelection: boolean, transparent = false, viewOverride?: CanvasState, sourceItems = ports.elements(), includeGrid = true) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    if (!transparent) { ctx.fillStyle = ports.renderedBoardColor(); ctx.fillRect(0, 0, width, height); }
    const state = viewOverride ?? ports.canvasState(); if (!transparent && includeGrid) drawGrid(ctx, width, height, state);
    ctx.save(); ctx.translate(state.panX, state.panY); ctx.scale(state.zoom, state.zoom);
    const padding = 16 / state.zoom;
    const viewport = { x: -state.panX / state.zoom - padding, y: -state.panY / state.zoom - padding, w: width / state.zoom + padding * 2, h: height / state.zoom + padding * 2 };
    const selected = ports.selectedSet();
    const currentMove = ports.moveOrigin();
    const drag = includeSelection && sourceItems === ports.elements() && currentMove?.moved ? currentMove : undefined;
    sourceItems.forEach((element, index) => {
      if (element.hidden) return;
      const moved = !!drag?.indices.includes(index);
      const resolvedElement = drag ? ports.resolveDraggedConnector(element, index, drag) : element;
      const drawnElement = isConnector(resolvedElement) ? ports.connectorForView(resolvedElement as ShapeElement, sourceItems) : resolvedElement;
      const bounds = elementBounds(moved ? element : drawnElement);
      const visibleBounds = moved ? { ...bounds, x: bounds.x + drag!.dx, y: bounds.y + drag!.dy } : bounds;
      if (!ports.intersectsBounds(viewport.x, viewport.y, viewport.x + viewport.w, viewport.y + viewport.h, visibleBounds)) return;
      ctx.save(); if (moved) ctx.translate(drag!.dx, drag!.dy);
      const drawViewport = moved ? { ...viewport, x: viewport.x - drag!.dx, y: viewport.y - drag!.dy } : viewport;
      ports.drawElement(ctx, drawnElement, drawViewport);
      const isSelected = selected.has(index);
      if (includeSelection && (isSelected || ports.hoveredIndex() === index) && isConnector(element)) {
        ctx.save(); ctx.strokeStyle = "#548ce8"; ctx.globalAlpha = .65; ctx.lineWidth = (isSelected ? 2 : 1) / state.zoom; traceConnector(ctx, drawnElement as ShapeElement); ctx.stroke();
        if (isSelected && selected.size === 1 && !element.locked && !ports.boardLocked()) for (const handle of ports.connectorHandles(element as ShapeElement)) { const routeHandle = handle.id.startsWith("route") || handle.id.startsWith("auto-route:") || handle.id.includes(":route:"); ctx.beginPath(); ctx.fillStyle = routeHandle ? "#dbeafe" : "#ffffff"; ctx.arc(handle.x, handle.y, (routeHandle ? 4 : 6) / state.zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        ctx.restore();
      } else if (includeSelection && (isSelected || ports.hoveredIndex() === index)) {
        const bounds = elementBounds(element); const handlePadding = 5 / state.zoom;
        ctx.save(); ctx.strokeStyle = isSelected ? "#547bb1" : "#8298b8"; ctx.globalAlpha = isSelected ? 1 : 0.62; ctx.lineWidth = 1 / state.zoom; ctx.setLineDash([4 / state.zoom, 3 / state.zoom]);
        ctx.strokeRect(bounds.x - handlePadding, bounds.y - handlePadding, Math.max(bounds.w + handlePadding * 2, 2 / state.zoom), Math.max(bounds.h + handlePadding * 2, 2 / state.zoom)); ctx.restore();
        if (isSelected && !element.locked && selected.size === 1 && ports.tool() === "select" && (element.type !== "group" || !!element.note && !element.note.collapsed) && element.type !== "freehand") drawTransformHandles(ctx, bounds, state.zoom, element.type !== "group");
      }
      ctx.restore();
    });
    const currentResize = ports.resizeOrigin();
    if (includeSelection && (ports.tool() === "arrow" || ports.tool() === "line" || currentResize && isConnector(currentResize.original))) {
      const drawPorts = (items: Element[]) => { for (const item of items) {
        const moved = !!drag?.targets.has(item.id ?? ""); const bounds = elementBounds(item);
        const visibleBounds = moved ? { ...bounds, x: bounds.x + drag!.dx, y: bounds.y + drag!.dy } : bounds;
        if (item.hidden || item.locked || !ports.intersectsBounds(viewport.x, viewport.y, viewport.x + viewport.w, viewport.y + viewport.h, visibleBounds)) continue;
        if (item.type === "group") { drawPorts(item.elements); continue; } if (!isConnectable(item)) continue;
        if (moved) { ctx.save(); ctx.translate(drag!.dx, drag!.dy); }
        const anchors: { anchor: Point; rowId?: string }[] = [
          ...BOX_ANCHORS.map(anchor => ({ anchor })),
          ...(item.type === "schemaTable" ? item.columns.flatMap(column => [{ anchor: { x: 0, y: .5 }, rowId: column.id }, { anchor: { x: 1, y: .5 }, rowId: column.id }]) : []),
        ];
        for (const { anchor, rowId } of anchors) { const point = anchorPoint(item, anchor, rowId); ctx.beginPath(); ctx.arc(point.x, point.y, 4 / state.zoom, 0, Math.PI * 2); ctx.fill(); }
        if (moved) ctx.restore();
      } }; ctx.save(); ctx.fillStyle = "#5d94e7"; ctx.globalAlpha = .7; drawPorts(ports.elements()); const hint = ports.attachmentHint(); if (hint) { ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(hint.x, hint.y, 8 / state.zoom, 0, Math.PI * 2); ctx.strokeStyle = "#2675f5"; ctx.lineWidth = 2 / state.zoom; ctx.stroke(); } ctx.restore();
    }
    const guides = ports.alignmentGuides();
    if (includeSelection && guides && ports.showAlignmentGuides()) {
      const left = -state.panX / state.zoom; const top = -state.panY / state.zoom; const right = (width - state.panX) / state.zoom; const bottom = (height - state.panY) / state.zoom;
      ctx.save(); ctx.strokeStyle = "#668fd0"; ctx.globalAlpha = .85; ctx.lineWidth = 1 / state.zoom; ctx.setLineDash([5 / state.zoom, 4 / state.zoom]); ctx.beginPath();
      if (guides.x !== undefined) { ctx.moveTo(guides.x, top); ctx.lineTo(guides.x, bottom); }
      if (guides.y !== undefined) { ctx.moveTo(left, guides.y); ctx.lineTo(right, guides.y); }
      ctx.stroke(); ctx.restore();
    }
    const transientLaser = ports.laserTrail();
    if (includeSelection && transientLaser) drawLaserStroke(ctx, transientLaser.points, transientLaser.opacity, ports.laserThickness() / state.zoom);
    const activePreview = ports.preview();
    if (includeSelection && activePreview) {
      const { start, end, type, color: stroke, thickness: widthPx, opacity } = activePreview;
      if (type === "pen") { if (ports.tool() === "laser") drawLaserStroke(ctx, ports.currentPoints(), 1, ports.laserThickness() / state.zoom); else ports.drawElement(ctx, { type: "freehand", points: ports.currentPoints(), color: stroke, thickness: widthPx, opacity }); }
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

  return { drawGrid, drawTransformHandles, drawScene };
}
