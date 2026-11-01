import type { Element } from "../../model";

type Extent = { x: number; y: number; w: number; h: number };

/** Zoom around the diagram center and apply world-space drag offsets to an existing preview box. */
export function zoomMermaidPreviewViewBox(value: string, zoom: number, pan: { x: number; y: number }): string {
  const bounds = value.trim().split(/[,\s]+/).map(Number);
  if (bounds.length !== 4 || !bounds.every(Number.isFinite) || bounds[2] <= 0 || bounds[3] <= 0 || !Number.isFinite(zoom) || zoom <= 0 || !Number.isFinite(pan.x) || !Number.isFinite(pan.y)) return "0 0 300 200";
  const [x, y, width, height] = bounds; const viewWidth = width / zoom; const viewHeight = height / zoom;
  return [x + (width - viewWidth) / 2 - pan.x, y + (height - viewHeight) / 2 - pan.y, viewWidth, viewHeight].join(" ");
}

function extentOf(element: Element): Extent | undefined {
  if (element.type === "group") return element.componentBounds;
  if (element.type === "text") {
    const fontSize = Number.isFinite(element.fontSize) ? element.fontSize : 14;
    const width = element.wrapWidth ?? element.text.length * fontSize * .65;
    const height = fontSize * Math.max(1, element.text.split("\n").length);
    return { x: element.x, y: element.y, w: width, h: height };
  }
  if (element.type === "freehand") {
    const points = element.points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (!points.length) return undefined;
    const xs = points.map(point => point.x); const ys = points.map(point => point.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  if ("x" in element && "y" in element && "w" in element && "h" in element) return { x: element.x, y: element.y, w: element.w, h: element.h };
  return undefined;
}

/** Creates a finite, padded SVG viewBox from the native elements used by a Mermaid preview. */
export function mermaidPreviewViewBox(elements: readonly Element[], padding = 24, minimumHeight = 160): string {
  const extents = elements.map(extentOf).filter((extent): extent is Extent => !!extent
    && Number.isFinite(extent.x) && Number.isFinite(extent.y)
    && Number.isFinite(extent.w) && Number.isFinite(extent.h));
  if (!extents.length) return `0 0 ${Math.max(300, padding * 2 + 1)} ${Math.max(minimumHeight, padding * 2 + 1)}`;

  const xs = extents.flatMap(extent => [extent.x, extent.x + extent.w]);
  const ys = extents.flatMap(extent => [extent.y, extent.y + extent.h]);
  const minX = Math.min(...xs); const minY = Math.min(...ys);
  const width = Math.max(1, Math.max(...xs) - minX + padding * 2);
  const height = Math.max(minimumHeight, Math.max(...ys) - minY + padding * 2);
  return `${minX - padding} ${minY - padding} ${width} ${height}`;
}
