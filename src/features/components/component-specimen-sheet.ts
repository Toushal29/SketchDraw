import type { Element, GroupElement } from "../../model";
import { elementBounds } from "../canvas/bounds";
import { resizeLibraryGroup } from "./library-component-editor";

/** Fits a real component into a fixed specimen cell without changing its saved size. */
export function fitComponentSpecimen(source: Element, cell: { x: number; y: number; w: number; h: number }, padding = 12): Element {
  const bounds = elementBounds(source);
  const maxWidth = Math.max(1, cell.w - padding * 2);
  const maxHeight = Math.max(1, cell.h - padding * 2);
  const scale = Math.min(1, maxWidth / Math.max(1, bounds.w), maxHeight / Math.max(1, bounds.h));
  const width = Math.max(1, bounds.w * scale);
  const height = Math.max(1, bounds.h * scale);
  const target = { x: cell.x + (cell.w - width) / 2, y: cell.y + (cell.h - height) / 2, w: width, h: height };
  if (source.type === "group") return resizeLibraryGroup(source, target);
  const wrapper: GroupElement = { type: "group", elements: [source] };
  return resizeLibraryGroup(wrapper, target).elements[0] ?? source;
}
