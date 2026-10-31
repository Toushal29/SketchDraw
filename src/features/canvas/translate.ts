import type { Element, ShapeElement } from "../../model";
import { isConnector } from "../../operations";

/**
 * Moves an element and everything it owns by a world-space offset. Anything
 * `canMove` rejects, along with its children, stays where it is.
 */
export function translateElement(element: Element, dx: number, dy: number, canMove: (element: Element) => boolean = () => true): Element {
  if (!canMove(element)) return element;
  if (element.type === "group") return { ...element, ...(element.componentBounds ? { componentBounds: { ...element.componentBounds, x: element.componentBounds.x + dx, y: element.componentBounds.y + dy } } : {}), elements: element.elements.map(child => translateElement(child, dx, dy, canMove)) };
  if (element.type === "freehand") return { ...element, points: element.points.map(point => ({ ...point, x: point.x + dx, y: point.y + dy })) };
  if (isConnector(element)) {
    const shiftBranch = (branch: ShapeElement["forkUpper"]) => branch ? { ...branch, end: branch.end ? { x: branch.end.x + dx, y: branch.end.y + dy } : undefined, routePoints: branch.routePoints?.map(point => ({ x: point.x + dx, y: point.y + dy })) } : undefined;
    return { ...element, x: element.x + dx, y: element.y + dy, routePoints: element.routePoints?.map(point => ({ x: point.x + dx, y: point.y + dy })), forkUpper: shiftBranch(element.forkUpper), forkLower: shiftBranch(element.forkLower) };
  }
  return { ...element, x: element.x + dx, y: element.y + dy };
}
