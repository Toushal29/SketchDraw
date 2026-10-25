import type { FlowchartShape, ShapeElement } from "../../model";

type Box = { x: number; y: number; w: number; h: number };

function boxOf(element: ShapeElement): Box {
  return { x: Math.min(element.x, element.x + element.w), y: Math.min(element.y, element.y + element.h), w: Math.abs(element.w), h: Math.abs(element.h) };
}

function polygon(points: { x: number; y: number }[]): string {
  return points.length ? `M ${points.map(point => `${point.x} ${point.y}`).join(" L ")} Z` : "";
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  const k = .55228475;
  return `M ${cx + rx} ${cy} C ${cx + rx} ${cy + k * ry} ${cx + k * rx} ${cy + ry} ${cx} ${cy + ry} C ${cx - k * rx} ${cy + ry} ${cx - rx} ${cy + k * ry} ${cx - rx} ${cy} C ${cx - rx} ${cy - k * ry} ${cx - k * rx} ${cy - ry} ${cx} ${cy - ry} C ${cx + k * rx} ${cy - ry} ${cx + rx} ${cy - k * ry} ${cx + rx} ${cy} Z`;
}

function reverseEllipsePath(cx: number, cy: number, rx: number, ry: number): string {
  const k = .55228475;
  return `M ${cx + rx} ${cy} C ${cx + rx} ${cy - k * ry} ${cx + k * rx} ${cy - ry} ${cx} ${cy - ry} C ${cx - k * rx} ${cy - ry} ${cx - rx} ${cy - k * ry} ${cx - rx} ${cy} C ${cx - rx} ${cy + k * ry} ${cx - k * rx} ${cy + ry} ${cx} ${cy + ry} C ${cx + k * rx} ${cy + ry} ${cx + rx} ${cy + k * ry} ${cx + rx} ${cy} Z`;
}

function flowchartOutline(shape: FlowchartShape, { x, y, w, h }: Box): string {
  const right = x + w; const bottom = y + h; const middle = x + w / 2;
  const diamond = polygon([{ x: middle, y }, { x: right, y: y + h / 2 }, { x: middle, y: bottom }, { x, y: y + h / 2 }]);
  const rect = `M ${x} ${y} H ${right} V ${bottom} H ${x} Z`;
  if (w < 1 || h < 1) return rect;
  switch (shape) {
    case "process": case "predefined-process": case "internal-storage": case "collate": case "loop-limit": case "loop-start": case "loop-end": case "direct-data": return rect;
    case "terminator": {
      const r = Math.min(w / 2, h / 2);
      return `M ${x + r} ${y} H ${right - r} Q ${right} ${y} ${right} ${y + r} V ${bottom - r} Q ${right} ${bottom} ${right - r} ${bottom} H ${x + r} Q ${x} ${bottom} ${x} ${bottom - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
    }
    case "decision": case "sort": return diamond;
    case "data": case "parallelogram": {
      const inset = Math.min(w * .22, h * .35);
      return `M ${x + inset} ${y} H ${right} L ${right - inset} ${bottom} H ${x} Z`;
    }
    case "document": case "multi-document": return `M ${x} ${y} H ${right} V ${bottom - h * .14} C ${right - w * .28} ${bottom - h * .32} ${x + w * .28} ${bottom - h * .01} ${x} ${bottom - h * .14} Z`;
    case "database": {
      const ry = Math.min(h * .18, w * .25); const rx = w / 2; const k = .55228475;
      return `M ${x} ${y + ry} C ${x} ${y + ry - k * ry} ${middle - k * rx} ${y} ${middle} ${y} C ${middle + k * rx} ${y} ${right} ${y + ry - k * ry} ${right} ${y + ry} V ${bottom - ry} C ${right} ${bottom - ry + k * ry} ${middle + k * rx} ${bottom} ${middle} ${bottom} C ${middle - k * rx} ${bottom} ${x} ${bottom - ry + k * ry} ${x} ${bottom - ry} Z`;
    }
    case "connector": case "summing-junction": case "or": return ellipsePath(middle, y + h / 2, w / 2, h / 2);
    case "merge": return polygon([{ x, y }, { x: right, y }, { x: middle, y: bottom }]);
    case "extract": return polygon([{ x: middle, y }, { x: right, y: bottom }, { x, y: bottom }]);
    case "off-page": return `M ${x} ${y} H ${right} V ${y + h * .65} L ${middle} ${bottom} L ${x} ${y + h * .65} Z`;
    case "manual-input": { const inset = Math.min(w * .22, h * .45); return `M ${x + inset} ${y} H ${right} V ${bottom} H ${x} V ${y + inset} Z`; }
    case "card": return `M ${x + w * .18} ${y} H ${right} V ${bottom} H ${x} V ${y + h * .2} Z`;
    case "manual-operation": { const inset = Math.min(w * .2, 18); return `M ${x} ${y} H ${right} L ${right - inset} ${bottom} H ${x + inset} Z`; }
    case "delay": return `M ${x} ${y} H ${middle} C ${right + w / 6} ${y} ${right + w / 6} ${bottom} ${middle} ${bottom} H ${x} Z`;
    case "stored-data": return `M ${x + w * .2} ${y} H ${right} C ${right - w * .25} ${y + h / 3} ${right - w * .25} ${bottom - h / 3} ${right} ${bottom} H ${x + w * .2} C ${x - w * .06} ${bottom} ${x - w * .06} ${y} ${x + w * .2} ${y} Z`;
    case "punched-tape": return `M ${x} ${y + h * .18} C ${x + w * .22} ${y - h * .04} ${x + w * .36} ${y + h * .38} ${middle} ${y + h * .18} C ${x + w * .7} ${y - h * .02} ${x + w * .82} ${y + h * .38} ${right} ${y + h * .18} V ${bottom - h * .18} C ${x + w * .78} ${bottom + h * .04} ${x + w * .64} ${bottom - h * .38} ${middle} ${bottom - h * .18} C ${x + w * .3} ${bottom + h * .02} ${x + w * .18} ${bottom - h * .38} ${x} ${bottom - h * .18} Z`;
    case "sequential-data": return `M ${x} ${y + h * .18} C ${x} ${y + h * .08} ${x + w * .22} ${y} ${middle} ${y} C ${right - w * .22} ${y} ${right} ${y + h * .08} ${right} ${y + h * .18} V ${bottom - h * .18} C ${right} ${bottom - h * .08} ${right - w * .22} ${bottom} ${middle} ${bottom} C ${x + w * .22} ${bottom} ${x} ${bottom - h * .08} ${x} ${bottom - h * .18} Z`;
    case "alternate-process": { const r = Math.min(w * .16, h * .3); return `M ${x + r} ${y} H ${right - r} Q ${right} ${y} ${right} ${y + r} V ${bottom - r} Q ${right} ${bottom} ${right - r} ${bottom} H ${x + r} Q ${x} ${bottom} ${x} ${bottom - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`; }
    case "cloud": return `M ${x + w * .2} ${y + h * .76} C ${x + w * .04} ${y + h * .76} ${x} ${y + h * .63} ${x} ${y + h * .49} C ${x} ${y + h * .34} ${x + w * .13} ${y + h * .25} ${x + w * .29} ${y + h * .27} C ${x + w * .34} ${y + h * .08} ${x + w * .53} ${y} ${x + w * .68} ${y + h * .12} C ${x + w * .77} ${y + h * .18} ${x + w * .8} ${y + h * .26} ${x + w * .81} ${y + h * .31} C ${x + w} ${y + h * .29} ${right} ${y + h * .43} ${right} ${y + h * .56} C ${right} ${y + h * .69} ${x + w * .9} ${y + h * .76} ${x + w * .77} ${y + h * .76} Z`;
    case "star": return polygon(Array.from({ length: 10 }, (_, index) => { const angle = -Math.PI / 2 + index * Math.PI / 5; const radius = index % 2 ? .23 : .48; return { x: middle + Math.cos(angle) * w * radius, y: y + h / 2 + Math.sin(angle) * h * radius }; }));
    case "lightning": return `M ${x + w * .58} ${y} L ${x + w * .18} ${y + h * .55} H ${x + w * .43} L ${x + w * .31} ${bottom} L ${right} ${y + h * .38} H ${x + w * .67} Z`;
    case "heart": return `M ${middle} ${bottom} C ${x + w * .81} ${y + h * .69} ${right} ${y + h * .52} ${right} ${y + h * .3} C ${right} ${y + h * .03} ${x + w * .61} ${y - h * .02} ${middle} ${y + h * .23} C ${x + w * .39} ${y - h * .02} ${x} ${y + h * .03} ${x} ${y + h * .3} C ${x} ${y + h * .52} ${x + w * .19} ${y + h * .69} ${middle} ${bottom} Z`;
    case "callout": return `M ${x + w * .1} ${y} H ${right - w * .1} Q ${right} ${y} ${right} ${y + h * .12} V ${y + h * .68} Q ${right} ${y + h * .8} ${right - w * .1} ${y + h * .8} H ${x + w * .63} L ${x + w * .47} ${bottom} L ${x + w * .41} ${y + h * .8} H ${x + w * .1} Q ${x} ${y + h * .8} ${x} ${y + h * .68} V ${y + h * .12} Q ${x} ${y} ${x + w * .1} ${y} Z`;
    case "gear": {
      const teeth = Array.from({ length: 24 }, (_, index) => { const angle = -Math.PI / 2 + index * Math.PI / 12; const radius = index % 6 < 2 ? .48 : index % 6 < 4 ? .39 : .48; return { x: middle + Math.cos(angle) * w * radius, y: y + h / 2 + Math.sin(angle) * h * radius }; });
      // Reverse the inner contour so nonzero filling leaves the gear hole empty in PDF too.
      const outer = polygon(teeth); const inner = reverseEllipsePath(middle, y + h / 2, w * .17, h * .17);
      return `${outer} ${inner}`;
    }
    case "hexagon": { const cut = Math.min(w * .2, h * .28); return `M ${x + cut} ${y} H ${right - cut} L ${right} ${y + h / 2} L ${right - cut} ${bottom} H ${x + cut} L ${x} ${y + h / 2} Z`; }
    case "preparation": { const cut = Math.min(w * .25, h * .35); return `M ${x + cut} ${y} H ${right - cut} L ${right} ${y + h / 2} L ${right - cut} ${bottom} H ${x + cut} L ${x} ${y + h / 2} Z`; }
    case "trapezoid": { const inset = Math.min(w * .2, h * .35); return `M ${x + inset} ${y} H ${right - inset} L ${right} ${bottom} H ${x} Z`; }
    case "pentagon": return polygon(Array.from({ length: 5 }, (_, index) => { const angle = -Math.PI / 2 + index * Math.PI * 2 / 5; return { x: middle + Math.cos(angle) * w * .48, y: y + h / 2 + Math.sin(angle) * h * .48 }; }));
    case "octagon": { const cut = Math.min(w * .2, h * .2); return `M ${x + cut} ${y} H ${right - cut} L ${right} ${y + cut} V ${bottom - cut} L ${right - cut} ${bottom} H ${x + cut} L ${x} ${bottom - cut} V ${y + cut} Z`; }
    case "chevron": return `M ${x} ${y} H ${x + w * .62} L ${right} ${y + h / 2} L ${x + w * .62} ${bottom} H ${x} L ${x + w * .38} ${y + h / 2} Z`;
    case "cross": { const arm = Math.min(w, h) * .32; return `M ${middle - arm / 2} ${y} H ${middle + arm / 2} V ${y + h / 2 - arm / 2} H ${right} V ${y + h / 2 + arm / 2} H ${middle + arm / 2} V ${bottom} H ${middle - arm / 2} V ${y + h / 2 + arm / 2} H ${x} V ${y + h / 2 - arm / 2} H ${middle - arm / 2} Z`; }
    case "folder": return `M ${x} ${y + h * .16} H ${x + w * .38} L ${x + w * .5} ${y + h * .32} H ${right} V ${bottom} H ${x} Z`;
    case "note": return `M ${x} ${y} H ${right - w * .22} L ${right} ${y + h * .22} V ${bottom} H ${x} Z`;
    case "display": return `M ${x} ${y} H ${right} V ${y + h * .68} H ${x} Z M ${x + w * .4} ${y + h * .68} L ${x + w * .34} ${bottom - h * .08} H ${x + w * .66} L ${x + w * .6} ${y + h * .68} Z M ${x + w * .28} ${bottom - h * .08} H ${x + w * .72} V ${bottom} H ${x + w * .28} Z`;
    case "cube": return `M ${middle} ${y} L ${right} ${y + h * .22} V ${y + h * .76} L ${middle} ${bottom} L ${x} ${y + h * .76} V ${y + h * .22} Z`;
    case "rounded-rectangle": { const radius = Math.min(w * .16, h * .3); return `M ${x + radius} ${y} H ${right - radius} Q ${right} ${y} ${right} ${y + radius} V ${bottom - radius} Q ${right} ${bottom} ${right - radius} ${bottom} H ${x + radius} Q ${x} ${bottom} ${x} ${bottom - radius} V ${y + radius} Q ${x} ${y} ${x + radius} ${y} Z`; }
    case "shield": return `M ${middle} ${y} L ${right} ${y + h * .16} V ${y + h * .48} Q ${right} ${y + h * .82} ${middle} ${bottom} Q ${x} ${y + h * .82} ${x} ${y + h * .48} V ${y + h * .16} Z`;
    default: return rect;
  }
}

function flowchartDetails(shape: FlowchartShape, { x, y, w, h }: Box): string {
  const right = x + w; const bottom = y + h; const middle = x + w / 2;
  if (shape === "predefined-process") { const inset = Math.min(w * .18, 12); return `M ${x + inset} ${y} V ${bottom} M ${right - inset} ${y} V ${bottom}`; }
  if (shape === "internal-storage") { const inset = Math.min(w * .22, 15); return `M ${x + inset} ${y} V ${bottom} M ${x + inset} ${y + h * .28} H ${right}`; }
  if (shape === "multi-document") { const dx = Math.min(w * .12, 10); const dy = Math.min(h * .12, 8); return `M ${x + dx} ${y + dy} H ${right} M ${x + dx * 2} ${y + dy * 2} H ${right} M ${x + dx} ${y + dy} V ${bottom - h * .14} M ${x + dx * 2} ${y + dy * 2} V ${bottom - h * .14} C ${right - w * .28} ${bottom - h * .32} ${x + w * .28} ${bottom - h * .01} ${x + dx * 2} ${bottom - h * .14}`; }
  if (shape === "database") { const ry = Math.min(h * .18, w * .25); const rx = w / 2; const k = .55228475; return `M ${x} ${y + ry} C ${x} ${y + ry + k * ry} ${middle - k * rx} ${y + 2 * ry} ${middle} ${y + 2 * ry} C ${middle + k * rx} ${y + 2 * ry} ${right} ${y + ry + k * ry} ${right} ${y + ry}`; }
  if (shape === "merge") return `M ${x + w * .2} ${y + h * .72} H ${right - w * .2}`;
  if (shape === "extract") return `M ${x + w * .2} ${y + h * .28} H ${right - w * .2}`;
  if (shape === "collate") return `M ${x + w * .2} ${y + h * .2} L ${right - w * .2} ${bottom - h * .2} M ${right - w * .2} ${y + h * .2} L ${x + w * .2} ${bottom - h * .2}`;
  if (shape === "sort") return `M ${x + w * .2} ${y + h / 2} H ${right - w * .2}`;
  if (shape === "summing-junction") return `M ${middle} ${y + h * .3} V ${y + h * .7} M ${x + w * .3} ${y + h / 2} H ${x + w * .7}`;
  if (shape === "or") return `M ${x + w * .32} ${y + h * .32} L ${x + w * .68} ${y + h * .68} M ${x + w * .68} ${y + h * .32} L ${x + w * .32} ${y + h * .68}`;
  if (shape === "loop-limit") return `M ${x + w * .18} ${y + h * .16} Q ${middle} ${y - h * .14} ${right - w * .18} ${y + h * .16}`;
  if (shape === "loop-start") return `M ${middle} ${y + h * .15} V ${bottom - h * .15} M ${middle} ${y + h * .15} l-${w * .08} ${h * .12} M ${middle} ${y + h * .15} l${w * .08} ${h * .12}`;
  if (shape === "loop-end") return `M ${middle} ${y + h * .15} V ${bottom - h * .15} M ${middle} ${bottom - h * .15} l-${w * .08} -${h * .12} M ${middle} ${bottom - h * .15} l${w * .08} -${h * .12}`;
  if (shape === "punched-tape") return `M ${x} ${y + h * .18} C ${x + w * .22} ${y - h * .04} ${x + w * .36} ${y + h * .38} ${middle} ${y + h * .18} C ${x + w * .7} ${y - h * .02} ${x + w * .82} ${y + h * .38} ${right} ${y + h * .18} M ${x} ${bottom - h * .18} C ${x + w * .22} ${bottom + h * .04} ${x + w * .36} ${bottom - h * .38} ${middle} ${bottom - h * .18} C ${x + w * .7} ${bottom + h * .02} ${x + w * .82} ${bottom - h * .38} ${right} ${bottom - h * .18}`;
  if (shape === "sequential-data") { const ry = h * .18; const rx = w / 2; const k = .55228475; return `M ${x} ${y + ry} C ${x} ${y + ry - k * ry} ${middle - k * rx} ${y} ${middle} ${y} C ${middle + k * rx} ${y} ${right} ${y + ry - k * ry} ${right} ${y + ry} M ${x} ${y + h / 2} C ${x} ${y + h / 2 + k * ry} ${middle - k * rx} ${y + h / 2 + ry} ${middle} ${y + h / 2 + ry} C ${middle + k * rx} ${y + h / 2 + ry} ${right} ${y + h / 2 + k * ry} ${right} ${y + h / 2}`; }
  if (shape === "direct-data") return `M ${x + w * .25} ${y + h * .25} H ${right - w * .25} V ${bottom - h * .25} H ${x + w * .25} Z`;
  if (shape === "note") return `M ${right - w * .22} ${y} V ${y + h * .22} H ${right}`;
  if (shape === "cube") return `M ${x} ${y + h * .22} L ${middle} ${y + h * .48} L ${right} ${y + h * .22} M ${middle} ${y + h * .48} V ${bottom}`;
  return "";
}

/** Returns a closed outline only; internal marks use a separate path and never affect fill. */
export function shapePathData(element: ShapeElement): string | undefined {
  const box = boxOf(element); const { x, y, w, h } = box; const right = x + w; const bottom = y + h; const cx = x + w / 2; const cy = y + h / 2;
  if (element.type === "rectangle") {
    if (element.edgeStyle === "cut") { const c = Math.min(element.cornerRadius ?? 12, w / 2, h / 2); return `M ${x + c} ${y} H ${right - c} L ${right} ${y + c} V ${bottom - c} L ${right - c} ${bottom} H ${x + c} L ${x} ${bottom - c} V ${y + c} Z`; }
    const radius = element.edgeStyle === "pill" ? Math.min(w, h) / 2 : element.edgeStyle === "rounded" ? Math.min(element.cornerRadius ?? 12, w / 2, h / 2) : 0;
    return radius ? `M ${x + radius} ${y} H ${right - radius} Q ${right} ${y} ${right} ${y + radius} V ${bottom - radius} Q ${right} ${bottom} ${right - radius} ${bottom} H ${x + radius} Q ${x} ${bottom} ${x} ${bottom - radius} V ${y + radius} Q ${x} ${y} ${x + radius} ${y} Z` : `M ${x} ${y} H ${right} V ${bottom} H ${x} Z`;
  }
  if (element.type === "circle") return ellipsePath(cx, cy, w / 2, h / 2);
  if (element.type === "diamond") return polygon([{ x: cx, y }, { x: right, y: cy }, { x: cx, y: bottom }, { x, y: cy }]);
  if (element.type === "triangle") return polygon([{ x: cx, y }, { x: right, y: bottom }, { x, y: bottom }]);
  if (element.type === "flowchart") return flowchartOutline(element.flowchartShape ?? "process", box);
  return undefined;
}

export function shapeDetailPathData(element: ShapeElement): string {
  return element.type === "flowchart" ? flowchartDetails(element.flowchartShape ?? "process", boxOf(element)) : "";
}

export function shapePathObject(element: ShapeElement): Path2D | undefined {
  const data = shapePathData(element);
  return data ? new Path2D(data) : undefined;
}

export function shapeDetailPathObject(element: ShapeElement): Path2D | undefined {
  const data = shapeDetailPathData(element);
  return data ? new Path2D(data) : undefined;
}

/** Shape contours use winding rules; inner contours reverse direction to create holes. */
export function shapeFillRule(_element: ShapeElement): CanvasFillRule { return "nonzero"; }
