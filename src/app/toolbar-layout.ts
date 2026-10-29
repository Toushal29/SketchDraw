import type { ToolbarItem } from "../model";
import { isWindowsPlatform } from "../platform/runtime";

export const DEFAULT_TOOL_ORDER: ToolbarItem[] = ["select", "pan", "pen", "paintBrushes", "eraser", "laser", "line", "arrow", "rectangle", "circle", "diamond", "flowchart", "text", "bucket", "crop", "measure", "codeData", "pathEdit", "frame"];
export const DEFAULT_MORE_TOOL_ORDER: ToolbarItem[] = ["bucket", "measure", "crop"];
export const MOBILE_DEFAULT_TOOLBAR_ORDER: ToolbarItem[] = ["select", "pan", "pen", "paintBrushes", "eraser", "line", "arrow", "rectangle", "text"];
export type ToolbarLayout = { toolbar: ToolbarItem[]; more: ToolbarItem[] };
export type OrderedToolbarEntry = { id: string; label: string; tools: ToolbarItem[] };
export function normalizePaintToolOrder(toolbar: ToolbarItem[]) {
  const moveAfter = (item: ToolbarItem, anchor: ToolbarItem) => {
    const itemIndex = toolbar.indexOf(item);
    const anchorIndex = toolbar.indexOf(anchor);
    if (itemIndex >= 0 && anchorIndex >= 0 && itemIndex !== anchorIndex + 1) {
      toolbar.splice(itemIndex, 1);
      toolbar.splice(toolbar.indexOf(anchor) + 1, 0, item);
    }
  };
  if (toolbar.includes("paintBrushes")) moveAfter("paintBrushes", "pen");
  moveAfter("eraser", toolbar.includes("paintBrushes") ? "paintBrushes" : "pen");
}
export function toolbarItemsForCurrentPlatform(): ToolbarItem[] {
  return [...DEFAULT_TOOL_ORDER];
}
export function defaultToolbarLayout(): ToolbarLayout {
  const available = toolbarItemsForCurrentPlatform();
  if (!isWindowsPlatform()) {
    const toolbar = MOBILE_DEFAULT_TOOLBAR_ORDER.filter(value => available.includes(value));
    const more = [
      ...DEFAULT_MORE_TOOL_ORDER.filter(value => available.includes(value)),
      ...available.filter(value => !toolbar.includes(value) && !DEFAULT_MORE_TOOL_ORDER.includes(value)),
    ];
    return { toolbar, more };
  }
  const more = DEFAULT_MORE_TOOL_ORDER.filter(value => available.includes(value));
  return { toolbar: available.filter(value => !more.includes(value)), more };
}
export function readToolbarLayout(): ToolbarLayout {
  try {
    const available = toolbarItemsForCurrentPlatform();
    const defaults = defaultToolbarLayout();
    const saved: unknown = JSON.parse(localStorage.getItem("sketchdraw-toolbar-layout") ?? "null");
    const normalize = (values: unknown) => Array.isArray(values) ? [...new Set(values.filter((value): value is ToolbarItem => value !== "moreTools" && available.includes(value as ToolbarItem)))] : [];
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      const source = saved as { toolbar?: unknown; more?: unknown };
      const toolbar = normalize(source.toolbar);
      const more = normalize(source.more).filter(value => value !== "eraser" && !toolbar.includes(value));
      for (const value of [...defaults.toolbar, ...defaults.more]) if (!toolbar.includes(value) && !more.includes(value)) (defaults.more.includes(value) ? more : toolbar).push(value);
      normalizePaintToolOrder(toolbar);
      return { toolbar, more };
    }
    const legacy = JSON.parse(localStorage.getItem("sketchdraw-toolbar-order") ?? "null") as unknown;
    if (Array.isArray(legacy)) {
      const oldToolbar = normalize(legacy).filter(value => !DEFAULT_MORE_TOOL_ORDER.includes(value));
      const more = defaults.more.filter(value => !oldToolbar.includes(value));
      const toolbar = [...oldToolbar, ...defaults.toolbar.filter(value => !oldToolbar.includes(value))];
      normalizePaintToolOrder(toolbar);
      return { toolbar, more };
    }
    return defaults;
  } catch { return defaultToolbarLayout(); }
}
