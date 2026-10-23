import type { Point } from "../../model";

/** Tests whether a canvas point lies inside a closed polygon such as a filled arrowhead. */
export function pointInPolygon(point: Point, points: Point[]): boolean {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const currentPoint = points[index]; const previousPoint = points[previous];
    const crosses = (currentPoint.y > point.y) !== (previousPoint.y > point.y);
    if (crosses && point.x < (previousPoint.x - currentPoint.x) * (point.y - currentPoint.y) / (previousPoint.y - currentPoint.y) + currentPoint.x) inside = !inside;
  }
  return inside;
}
