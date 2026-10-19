import type { Element as SketchElement, Point, ShapeElement, TextElement } from "../../model";

type Matrix = [number, number, number, number, number, number];
type Paint = { fill?: string; stroke?: string; strokeWidth: number; opacity: number; fillOpacity: number; strokeOpacity: number; fillRule: "nonzero" | "evenodd"; fontSize: number; fontWeight: string; fontStyle: string; textAnchor: string };
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const numberPattern = /[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/ig;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const numbers = (value: string | null | undefined) => value?.match(numberPattern)?.map(Number).filter(Number.isFinite) ?? [];

function multiply(a: Matrix, b: Matrix): Matrix {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}
function transformPoint(matrix: Matrix, x: number, y: number): Point { return { x: matrix[0] * x + matrix[2] * y + matrix[4], y: matrix[1] * x + matrix[3] * y + matrix[5] }; }

function transformMatrix(value: string | null): Matrix {
  let result = IDENTITY;
  for (const match of value?.matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g) ?? []) {
    const name = match[1].toLowerCase(); const n = numbers(match[2]); let next: Matrix = IDENTITY;
    if (name === "matrix" && n.length >= 6) next = n.slice(0, 6) as Matrix;
    else if (name === "translate") next = [1, 0, 0, 1, n[0] ?? 0, n[1] ?? 0];
    else if (name === "scale") next = [n[0] ?? 1, 0, 0, n[1] ?? n[0] ?? 1, 0, 0];
    else if (name === "rotate") {
      const angle = (n[0] ?? 0) * Math.PI / 180; const rotate: Matrix = [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0];
      next = n.length >= 3 ? multiply(multiply([1, 0, 0, 1, n[1], n[2]], rotate), [1, 0, 0, 1, -n[1], -n[2]]) : rotate;
    } else if (name === "skewx") next = [1, 0, Math.tan((n[0] ?? 0) * Math.PI / 180), 1, 0, 0];
    else if (name === "skewy") next = [1, Math.tan((n[0] ?? 0) * Math.PI / 180), 0, 1, 0, 0];
    else continue;
    result = multiply(result, next);
  }
  return result;
}

function pathToPolyline(data: string, matrix: Matrix): string | undefined {
  const tokens = data.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/ig) ?? [];
  if (!tokens.length || tokens.some(token => !/^[a-z]$/i.test(token) && !/^[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?$/i.test(token))) return undefined;
  let index = 0; let command = ""; let x = 0; let y = 0; let startX = 0; let startY = 0; let cubicControl: Point | undefined; let quadControl: Point | undefined;
  const out: string[] = []; let segments = 0;
  const isCommand = (token: string | undefined) => !!token && /^[a-z]$/i.test(token);
  const take = () => { const value = Number(tokens[index++]); return Number.isFinite(value) ? value : undefined; };
  const emit = (px: number, py: number, move = false) => {
    const point = transformPoint(matrix, px, py); if (![point.x, point.y].every(Number.isFinite)) return false;
    out.push(`${move ? "M" : "L"}${+point.x.toFixed(3)} ${+point.y.toFixed(3)}`); segments++; return true;
  };
  const lineTo = (nx: number, ny: number) => { x = nx; y = ny; cubicControl = undefined; quadControl = undefined; return emit(x, y); };
  while (index < tokens.length && segments < 50_000) {
    if (isCommand(tokens[index])) command = tokens[index++];
    if (!command) return undefined;
    const relative = command === command.toLowerCase(); const upper = command.toUpperCase();
    if (upper === "Z") { x = startX; y = startY; out.push("Z"); command = ""; cubicControl = undefined; quadControl = undefined; continue; }
    const originX = x; const originY = y;
    if (upper === "M" || upper === "L" || upper === "T") {
      const a = take(); const b = take(); if (a === undefined || b === undefined) return undefined;
      const nx = relative ? originX + a : a; const ny = relative ? originY + b : b;
      if (upper === "M") { x = nx; y = ny; startX = x; startY = y; cubicControl = quadControl = undefined; if (!emit(x, y, true)) return undefined; command = relative ? "l" : "L"; }
      else if (upper === "T") { const control = quadControl ? { x: 2 * originX - quadControl.x, y: 2 * originY - quadControl.y } : { x: originX, y: originY }; const sx = originX; const sy = originY; for (let step = 1; step <= 10; step++) { const t = step / 10; const mt = 1 - t; if (!emit(mt * mt * sx + 2 * mt * t * control.x + t * t * nx, mt * mt * sy + 2 * mt * t * control.y + t * t * ny)) return undefined; } x = nx; y = ny; quadControl = control; cubicControl = undefined; }
      else if (!lineTo(nx, ny)) return undefined;
      continue;
    }
    if (upper === "H" || upper === "V") { const a = take(); if (a === undefined) return undefined; if (!lineTo(upper === "H" ? relative ? originX + a : a : originX, upper === "V" ? relative ? originY + a : a : originY)) return undefined; continue; }
    if (upper === "C" || upper === "S") {
      let c1: Point; let c2: Point; let end: Point;
      if (upper === "C") { const a = take(), b = take(), c = take(), d = take(), e = take(), f = take(); if ([a,b,c,d,e,f].some(v => v === undefined)) return undefined; c1 = { x: relative ? originX + a! : a!, y: relative ? originY + b! : b! }; c2 = { x: relative ? originX + c! : c!, y: relative ? originY + d! : d! }; end = { x: relative ? originX + e! : e!, y: relative ? originY + f! : f! }; }
      else { const a = take(), b = take(), c = take(), d = take(); if ([a,b,c,d].some(v => v === undefined)) return undefined; c1 = cubicControl ? { x: 2 * originX - cubicControl.x, y: 2 * originY - cubicControl.y } : { x: originX, y: originY }; c2 = { x: relative ? originX + a! : a!, y: relative ? originY + b! : b! }; end = { x: relative ? originX + c! : c!, y: relative ? originY + d! : d! }; }
      for (let step = 1; step <= 12; step++) { const t = step / 12, mt = 1 - t; if (!emit(mt ** 3 * originX + 3 * mt ** 2 * t * c1.x + 3 * mt * t ** 2 * c2.x + t ** 3 * end.x, mt ** 3 * originY + 3 * mt ** 2 * t * c1.y + 3 * mt * t ** 2 * c2.y + t ** 3 * end.y)) return undefined; }
      x = end.x; y = end.y; cubicControl = c2; quadControl = undefined; continue;
    }
    if (upper === "Q") {
      const a = take(), b = take(), c = take(), d = take(); if ([a,b,c,d].some(v => v === undefined)) return undefined;
      const control = { x: relative ? originX + a! : a!, y: relative ? originY + b! : b! }; const end = { x: relative ? originX + c! : c!, y: relative ? originY + d! : d! };
      for (let step = 1; step <= 10; step++) { const t = step / 10, mt = 1 - t; if (!emit(mt * mt * originX + 2 * mt * t * control.x + t * t * end.x, mt * mt * originY + 2 * mt * t * control.y + t * t * end.y)) return undefined; }
      x = end.x; y = end.y; quadControl = control; cubicControl = undefined; continue;
    }
    if (upper === "A") {
      const rx0 = take(), ry0 = take(), rotation = take(), large = take(), sweep = take(), a = take(), b = take(); if ([rx0, ry0, rotation, large, sweep, a, b].some(v => v === undefined)) return undefined;
      const end = { x: relative ? originX + a! : a!, y: relative ? originY + b! : b! }; const rx = Math.abs(rx0!), ry = Math.abs(ry0!);
      if (rx < 1e-6 || ry < 1e-6 || (Math.abs(end.x - originX) + Math.abs(end.y - originY) < 1e-6)) { if (!emit(end.x, end.y)) return undefined; x = end.x; y = end.y; cubicControl = quadControl = undefined; continue; }
      const phi = rotation! * Math.PI / 180, cos = Math.cos(phi), sin = Math.sin(phi), dx = (originX - end.x) / 2, dy = (originY - end.y) / 2;
      const xp = cos * dx + sin * dy, yp = -sin * dx + cos * dy; const lambda = xp * xp / (rx * rx) + yp * yp / (ry * ry); const radiusScale = Math.sqrt(Math.max(1, lambda)); const adjustedRx = rx * radiusScale, adjustedRy = ry * radiusScale; const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, (1 - lambda) / Math.max(1e-12, lambda)));
      const cxp = k * adjustedRx * yp / adjustedRy, cyp = -k * adjustedRy * xp / adjustedRx; const cx = cos * cxp - sin * cyp + (originX + end.x) / 2, cy = sin * cxp + cos * cyp + (originY + end.y) / 2;
      const angle = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
      const ux = (xp - cxp) / adjustedRx, uy = (yp - cyp) / adjustedRy, vx = (-xp - cxp) / adjustedRx, vy = (-yp - cyp) / adjustedRy; const start = Math.atan2(uy, ux); let delta = angle(ux, uy, vx, vy);
      if (!sweep && delta > 0) delta -= Math.PI * 2; if (sweep && delta < 0) delta += Math.PI * 2;
      const count = Math.max(4, Math.ceil(Math.abs(delta) / (Math.PI / 18)));
      for (let step = 1; step <= count; step++) { const theta = start + delta * step / count; const px = cx + adjustedRx * cos * Math.cos(theta) - adjustedRy * sin * Math.sin(theta); const py = cy + adjustedRx * sin * Math.cos(theta) + adjustedRy * cos * Math.sin(theta); if (!emit(px, py)) return undefined; }
      x = end.x; y = end.y; cubicControl = quadControl = undefined; continue;
    }
    return undefined;
  }
  return segments > 0 && segments < 50_000 ? out.join(" ") : undefined;
}

function nodeStyles(node: Element, parent: Paint): Paint {
  const inline: Record<string, string> = {};
  for (const declaration of (node.getAttribute("style") ?? "").split(";")) { const colon = declaration.indexOf(":"); if (colon > 0) inline[declaration.slice(0, colon).trim().toLowerCase()] = declaration.slice(colon + 1).trim(); }
  const get = (name: string, fallback: string) => node.getAttribute(name) ?? inline[name] ?? fallback;
  return {
    fill: get("fill", parent.fill ?? "#000000"), stroke: get("stroke", parent.stroke ?? "none"),
    strokeWidth: clamp(Number.parseFloat(get("stroke-width", String(parent.strokeWidth))) || parent.strokeWidth, 0.1, 1000),
    opacity: parent.opacity * clamp(Number.parseFloat(get("opacity", "1")) || 0, 0, 1),
    fillOpacity: parent.fillOpacity * clamp(Number.parseFloat(get("fill-opacity", "1")) || 0, 0, 1),
    strokeOpacity: parent.strokeOpacity * clamp(Number.parseFloat(get("stroke-opacity", "1")) || 0, 0, 1),
    fillRule: get("fill-rule", parent.fillRule) === "evenodd" ? "evenodd" : "nonzero",
    fontSize: clamp(Number.parseFloat(get("font-size", String(parent.fontSize))) || parent.fontSize, 1, 1000),
    fontWeight: get("font-weight", parent.fontWeight), fontStyle: get("font-style", parent.fontStyle), textAnchor: get("text-anchor", parent.textAnchor),
  };
}

function normalizedColor(value: string | undefined, fallback: string): string | undefined {
  if (!value || value === "none" || value === "transparent") return undefined;
  let color = value.trim();
  if (/^url\(/i.test(color)) return undefined;
  if (/^#[\da-f]{3}$/i.test(color)) color = `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  if (/^#[\da-f]{6}$/i.test(color)) return color;
  const rgb = /^rgba?\(\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?/i.exec(color);
  if (rgb) { const channels = rgb.slice(1, 4).map(value => clamp(Math.round(Number(value) * (color.includes("%") ? 2.55 : 1)), 0, 255)); return `#${channels.map(value => value.toString(16).padStart(2, "0")).join("")}`; }
  const named: Record<string, string> = { black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff", yellow: "#ffff00", orange: "#ffa500", purple: "#800080", gray: "#808080", grey: "#808080", navy: "#000080", teal: "#008080", silver: "#c0c0c0", maroon: "#800000", lime: "#00ff00", aqua: "#00ffff", fuchsia: "#ff00ff" };
  return named[color.toLowerCase()] ?? fallback;
}

function gradientColor(value: string, root: SVGSVGElement): string | undefined {
  const match = /^url\(#([\w:.-]+)\)$/i.exec(value.trim()); if (!match) return normalizedColor(value, "#475569");
  const gradient = root.querySelector(`#${CSS.escape(match[1])}`); if (!gradient || !/gradient$/i.test(gradient.localName)) return undefined;
  const colors = [...gradient.querySelectorAll("stop")].map(stop => {
    const inline = stop.getAttribute("style") ?? ""; const declared = /(?:^|;)\s*stop-color\s*:\s*([^;]+)/i.exec(inline)?.[1];
    return normalizedColor(stop.getAttribute("stop-color") ?? declared, "#475569");
  }).filter((color): color is string => !!color);
  if (!colors.length) return "#475569";
  const channel = (index: number) => Math.round(colors.reduce((total, color) => total + Number.parseInt(color.slice(index, index + 2), 16), 0) / colors.length);
  return `#${[1, 3, 5].map(channel).map(value => value.toString(16).padStart(2, "0")).join("")}`;
}

function elementPath(node: Element): string | undefined {
  const tag = node.localName.toLowerCase(); const n = (name: string, fallback = 0) => Number.parseFloat(node.getAttribute(name) ?? "") || fallback;
  if (tag === "path") return node.getAttribute("d") ?? undefined;
  if (tag === "rect") {
    const x = n("x"), y = n("y"), w = Math.max(0, n("width")), h = Math.max(0, n("height")); if (!w || !h) return undefined;
    const rx = Math.min(w / 2, h / 2, Math.abs(n("rx", n("ry")))); const ry = Math.min(w / 2, h / 2, Math.abs(n("ry", n("rx"))));
    return rx && ry ? `M${x + rx} ${y} H${x + w - rx} Q${x + w} ${y} ${x + w} ${y + ry} V${y + h - ry} Q${x + w} ${y + h} ${x + w - rx} ${y + h} H${x + rx} Q${x} ${y + h} ${x} ${y + h - ry} V${y + ry} Q${x} ${y} ${x + rx} ${y} Z` : `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
  }
  if (tag === "circle" || tag === "ellipse") {
    const cx = n("cx"), cy = n("cy"), rx = Math.abs(tag === "circle" ? n("r") : n("rx")), ry = Math.abs(tag === "circle" ? rx : n("ry"));
    return rx && ry ? `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z` : undefined;
  }
  if (tag === "line") return `M${n("x1")} ${n("y1")} L${n("x2")} ${n("y2")}`;
  if (tag === "polyline" || tag === "polygon") {
    const coords = numbers(node.getAttribute("points")); if (coords.length < 4 || coords.length % 2) return undefined;
    return `M${coords[0]} ${coords[1]} ${coords.slice(2).reduce((path, value, index) => path + `${index % 2 ? " " : " L"}${value}`, "")}${tag === "polygon" ? " Z" : ""}`;
  }
  return undefined;
}

/** Converts SVG paths, groups, transforms and solid/gradient paints into editable vector objects. */
export function svgPrimitivesToElements(root: SVGSVGElement, origin: Point, scale: number): SketchElement[] | undefined {
  const output: SketchElement[] = []; const rootPaint: Paint = { fill: "#000000", stroke: "none", strokeWidth: 1, opacity: 1, fillOpacity: 1, strokeOpacity: 1, fillRule: "nonzero", fontSize: 16, fontWeight: "400", fontStyle: "normal", textAnchor: "start" };
  let remainingPathPoints = 250_000;
  const unsupportedAttributes = ["clip-path", "mask", "filter", "marker-start", "marker-mid", "marker-end", "vector-effect"];
  const addPath = (data: string, matrix: Matrix, paint: Paint, fillValue: string, strokeValue: string) => {
    const flattened = pathToPolyline(data, matrix); if (!flattened) return false;
    const coordinates = numbers(flattened.replace(/[MLZ]/g, " ")); if (coordinates.length < 4 || coordinates.length / 2 > remainingPathPoints || coordinates.some(value => Math.abs(value) > 1_000_000)) return false;
    remainingPathPoints -= coordinates.length / 2;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (let index = 0; index < coordinates.length; index += 2) { left = Math.min(left, coordinates[index]); right = Math.max(right, coordinates[index]); top = Math.min(top, coordinates[index + 1]); bottom = Math.max(bottom, coordinates[index + 1]); }
    const pathWidth = Math.max(1, right - left), pathHeight = Math.max(1, bottom - top);
    const localData = flattened.replace(/([ML])(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_all, verb: string, px: string, py: string) => `${verb}${+(Number(px) - left).toFixed(3)} ${+(Number(py) - top).toFixed(3)}`);
    if (localData.length > 500_000) return false;
    const fill = fillValue.trim().startsWith("url(") ? gradientColor(fillValue, root) : normalizedColor(fillValue, "#475569");
    const stroke = strokeValue.trim().startsWith("url(") ? gradientColor(strokeValue, root) : normalizedColor(strokeValue, "#475569");
    if (!fill && !stroke) return true;
    const color = stroke ?? fill ?? "#475569";
    const transformStrokeScale = Math.sqrt(Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]));
    const shape: ShapeElement = { type: "svgPath", id: crypto.randomUUID(), x: origin.x + left * scale, y: origin.y + top * scale, w: pathWidth * scale, h: pathHeight * scale, color, thickness: Math.max(1, paint.strokeWidth * transformStrokeScale * scale), pathData: localData, pathWidth, pathHeight, fillRule: paint.fillRule, svgStroke: !!stroke, opacity: paint.opacity, ...(fill ? { fillColor: fill, fillOpacity: paint.fillOpacity } : {}) };
    output.push(shape); return true;
  };
  const visit = (node: Element, parentMatrix: Matrix, parentPaint: Paint, useStack = new Set<string>()) => {
    const tag = node.localName.toLowerCase(); if (["defs", "title", "desc", "metadata", "style", "lineargradient", "radialgradient", "clippath", "mask", "pattern", "marker"].includes(tag) || tag === "symbol" && !useStack.size) return true;
    for (const attribute of unsupportedAttributes) if (node.hasAttribute(attribute) || new RegExp(`(?:^|;)\\s*${attribute}\\s*:`).test(node.getAttribute("style") ?? "")) return false;
    const matrix = multiply(parentMatrix, transformMatrix(node.getAttribute("transform"))); const paint = nodeStyles(node, parentPaint);
    const fillValue = paint.fill ?? "none"; const strokeValue = paint.stroke ?? "none";
    if (tag === "g" || tag === "svg" || tag === "a" || tag === "symbol") { for (const child of [...node.children]) if (!visit(child, matrix, paint, useStack)) return false; return true; }
    if (tag === "use") {
      const reference = node.getAttribute("href") ?? node.getAttribute("xlink:href"); if (!reference?.startsWith("#")) return false;
      const id = reference.slice(1); if (useStack.has(id)) return false; const target = root.querySelector(`#${CSS.escape(id)}`); if (!target) return false;
      const translated = multiply(matrix, [1, 0, 0, 1, Number.parseFloat(node.getAttribute("x") ?? "0") || 0, Number.parseFloat(node.getAttribute("y") ?? "0") || 0]); const nextStack = new Set(useStack); nextStack.add(id); return visit(target, translated, paint, nextStack);
    }
    if (tag === "tspan") return true;
    if (tag === "text") {
      const value = node.textContent?.trim(); if (!value) return true;
      const at = transformPoint(matrix, Number.parseFloat(node.getAttribute("x") ?? "0") || 0, Number.parseFloat(node.getAttribute("y") ?? "0") || 0); const factor = Math.hypot(matrix[0], matrix[1]) * scale; const color = normalizedColor(fillValue, normalizedColor(strokeValue, "#334155") ?? "#334155") ?? normalizedColor(strokeValue, "#334155") ?? "#334155";
      const text: TextElement = { type: "text", id: crypto.randomUUID(), x: origin.x + at.x * scale, y: origin.y + at.y * scale - clamp(paint.fontSize * factor, 8, 160), text: value.slice(0, 2000), color, fontSize: clamp(paint.fontSize * factor, 8, 160), fontFamily: "sans", bold: /^(bold|[6-9]00)$/i.test(paint.fontWeight), italic: paint.fontStyle === "italic", textAlign: paint.textAnchor === "middle" ? "center" : paint.textAnchor === "end" ? "right" : "left", opacity: paint.opacity };
      if (Math.abs(matrix[1]) + Math.abs(matrix[2]) > 1e-4) text.rotation = Math.atan2(matrix[1], matrix[0]) * 180 / Math.PI;
      output.push(text); return true;
    }
    const path = elementPath(node); if (path) return addPath(path, matrix, paint, fillValue, strokeValue);
    return true;
  };
  if (!visit(root, IDENTITY, rootPaint) || output.length > 20_000) return undefined;
  return output.length ? output : undefined;
}
