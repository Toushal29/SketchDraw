import type { CanvasState, Element, Point } from "../model";

export function rotateCanvasPoint(point: Point, center: Point, degrees: number): Point {
  if (!degrees) return point;
  const angle = degrees * Math.PI / 180; const dx = point.x - center.x; const dy = point.y - center.y;
  return { x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle) };
}

export const emptyCanvas = (): CanvasState => ({ zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff", boardColorFollowsTheme: true });
export const cloneElements = (items: Element[]): Element[] => JSON.parse(JSON.stringify(items)) as Element[];
export const sameCanvasPoints = (left: Point[] | undefined, right: Point[]) => !!left && left.length === right.length && left.every((point, index) => point.x === right[index].x && point.y === right[index].y);
export const WINDOWS_SHAPE_TYPES = ["rectangle", "circle", "diamond", "triangle", "flowchart", "line", "arrow"] as const;
export const isShapeLike = (element: Element) => (WINDOWS_SHAPE_TYPES as readonly string[]).includes(element.type);
export const isShapeLikeType = (type: Element["type"]) => (WINDOWS_SHAPE_TYPES as readonly string[]).includes(type);
