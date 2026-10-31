import type { Element, Point, ShapeElement } from "../../model";
import { connectorPolylines } from "./geometry";
import { elementBounds } from "../canvas/bounds";
import { isConnector } from "../../operations";

export type ConnectorCrossing = { point: Point; tangent: Point; color: string; thickness: number };

function segmentIntersection(a: Point, b: Point, c: Point, d: Point): Point | undefined {
  const rx = b.x - a.x; const ry = b.y - a.y; const sx = d.x - c.x; const sy = d.y - c.y;
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) < 1e-6) return undefined;
  const qx = c.x - a.x; const qy = c.y - a.y;
  const t = (qx * sy - qy * sx) / denominator; const u = (qx * ry - qy * rx) / denominator;
  if (t <= .02 || t >= .98 || u <= .02 || u >= .98) return undefined;
  return { x: a.x + t * rx, y: a.y + t * ry };
}

function contains(bounds: ReturnType<typeof elementBounds>, point: Point) {
  return point.x >= bounds.x && point.x <= bounds.x + bounds.w && point.y >= bounds.y && point.y <= bounds.y + bounds.h;
}

/** Finds interior crossings; the later connector in paint order is the bridge. */
export function connectorCrossings(items: Element[], resolve: (item: ShapeElement) => ShapeElement = item => item): ConnectorCrossing[] {
  const connectors = items.filter((item): item is ShapeElement => isConnector(item) && !item.hidden).map(resolve);
  if (connectors.length < 2 || connectors.length > 160) return [];
  const obstacles = items.filter(item => !isConnector(item) && !item.hidden && (item.type !== "group" || !!item.note || !!item.mermaid || !!item.libraryComponent || !!item.container?.collapsed)).map(elementBounds);
  const crossings: ConnectorCrossing[] = [];
  for (let overIndex = 1; overIndex < connectors.length; overIndex++) {
    const over = connectors[overIndex]; const overPaths = connectorPolylines(over);
    for (let underIndex = 0; underIndex < overIndex; underIndex++) {
      const under = connectors[underIndex]; const underPaths = connectorPolylines(under);
      for (const overPath of overPaths) for (let overSegment = 1; overSegment < overPath.length; overSegment++) {
        const oa = overPath[overSegment - 1]; const ob = overPath[overSegment]; const odx = ob.x - oa.x; const ody = ob.y - oa.y; const olen = Math.hypot(odx, ody);
        if (olen < 1) continue;
        for (const underPath of underPaths) for (let underSegment = 1; underSegment < underPath.length; underSegment++) {
          const ua = underPath[underSegment - 1]; const ub = underPath[underSegment];
          if (Math.max(oa.x, ob.x) < Math.min(ua.x, ub.x) || Math.max(ua.x, ub.x) < Math.min(oa.x, ob.x) || Math.max(oa.y, ob.y) < Math.min(ua.y, ub.y) || Math.max(ua.y, ub.y) < Math.min(oa.y, ob.y)) continue;
          const point = segmentIntersection(oa, ob, ua, ub);
          if (!point || obstacles.some(bounds => contains(bounds, point))) continue;
          const gap = Math.max(4, Math.min(9, over.thickness * 2.8 + 2));
          const previous = overPath[overSegment - 1]; const next = overPath[overSegment];
          if (Math.hypot(point.x - previous.x, point.y - previous.y) < gap || Math.hypot(point.x - next.x, point.y - next.y) < gap) continue;
          crossings.push({ point, tangent: { x: odx / olen, y: ody / olen }, color: over.color, thickness: over.thickness });
          if (crossings.length >= 1200) return crossings;
        }
      }
    }
  }
  return crossings;
}

/** Paints a small white gap under an arched overpass at every line crossing. */
export function drawConnectorBridges(ctx: CanvasRenderingContext2D, items: Element[], background: string, resolve?: (item: ShapeElement) => ShapeElement) {
  for (const bridge of connectorCrossings(items, resolve)) {
    const radius = Math.max(4, Math.min(9, bridge.thickness * 2.8 + 2));
    const { x, y } = bridge.point; const { x: tx, y: ty } = bridge.tangent;
    const nx = -ty; const ny = tx;
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = background; ctx.lineWidth = Math.max(5, bridge.thickness + 4);
    ctx.beginPath(); ctx.moveTo(x - tx * radius, y - ty * radius); ctx.lineTo(x + tx * radius, y + ty * radius); ctx.stroke();
    ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = bridge.color; ctx.lineWidth = Math.max(.75, bridge.thickness);
    ctx.beginPath(); ctx.moveTo(x - tx * radius, y - ty * radius); ctx.quadraticCurveTo(x + nx * radius, y + ny * radius, x + tx * radius, y + ty * radius); ctx.stroke();
    ctx.restore();
  }
}
