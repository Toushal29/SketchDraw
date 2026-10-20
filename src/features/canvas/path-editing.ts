import type { Point, ShapeElement } from "../../model";

export type EditablePath = { points: Point[]; closed: boolean };

/** Accept the deliberately small absolute M/L/Z subset used by simple editable paths. */
export function parseEditablePath(pathData: string | undefined): EditablePath | undefined {
  if (!pathData || pathData.length > 100_000) return undefined;
  const tokens = pathData.match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) ?? [];
  const residue = pathData.replace(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi, "").replace(/[\s,]+/g, "");
  if (residue || tokens.length < 5) return undefined;
  const points: Point[] = [];
  let command = "";
  let closed = false;
  let sawMove = false;
  for (let index = 0; index < tokens.length;) {
    if (/^[A-Za-z]$/.test(tokens[index])) {
      command = tokens[index++];
      if (command === "Z" || command === "z") { if (!points.length || closed) return undefined; closed = true; command = ""; continue; }
      if (command !== "M" && command !== "L") return undefined;
      if (command === "M") { if (sawMove) return undefined; sawMove = true; }
    }
    if (command !== "M" && command !== "L" || index + 1 >= tokens.length || /^[A-Za-z]$/.test(tokens[index]) || /^[A-Za-z]$/.test(tokens[index + 1])) return undefined;
    const x = Number(tokens[index++]); const y = Number(tokens[index++]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    points.push({ x, y });
    if (command === "M") command = "L";
  }
  return points.length >= 2 ? { points, closed } : undefined;
}

export function updateEditablePath(element: ShapeElement, nodes: Point[]): ShapeElement {
  const previous = element.type === "svgPath" ? parseEditablePath(element.pathData) : undefined;
  if (element.type !== "svgPath" || !previous || nodes.length < 2 || nodes.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return element;
  const oldWidth = Math.max(0.001, element.pathWidth ?? element.w);
  const oldHeight = Math.max(0.001, element.pathHeight ?? element.h);
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  for (const point of nodes) { minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x); minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y); }
  // Expand around the existing viewport center. This keeps the shape's rotation
  // pivot fixed and makes moved nodes part of the element's hit-test bounds.
  const width = Math.max(oldWidth, 2 * Math.max(oldWidth / 2 - minX, maxX - oldWidth / 2));
  const height = Math.max(oldHeight, 2 * Math.max(oldHeight / 2 - minY, maxY - oldHeight / 2));
  const offsetX = (oldWidth - width) / 2; const offsetY = (oldHeight - height) / 2;
  const pathWidth = width; const pathHeight = height;
  const coordinates = nodes.map(point => `${Number((point.x - offsetX).toFixed(3))} ${Number((point.y - offsetY).toFixed(3))}`);
  return {
    ...element,
    x: element.x + offsetX * element.w / oldWidth,
    y: element.y + offsetY * element.h / oldHeight,
    w: element.w * width / oldWidth,
    h: element.h * height / oldHeight,
    pathWidth,
    pathHeight,
    pathData: `M ${coordinates[0]} ${coordinates.slice(1).map(point => `L ${point}`).join(" ")}${previous.closed ? " Z" : ""}`,
  };
}
