import type { ToolbarItem } from "../model";

export const DEFAULT_TOOL_ORDER: ToolbarItem[] = ["select", "lasso", "pan", "pen", "paintBrushes", "eraser", "laser", "line", "arrow", "rectangle", "circle", "diamond", "flowchart", "text", "componentLibrary", "image", "bucket", "crop", "measure", "codeData", "pathEdit", "frame"];
export const DEFAULT_MORE_TOOL_ORDER: ToolbarItem[] = ["lasso", "laser", "arrow", "rectangle", "circle", "diamond", "crop", "measure", "codeData", "pathEdit", "frame"];
export type ToolbarLayout = { toolbar: ToolbarItem[]; more: ToolbarItem[] };
export type OrderedToolbarEntry = { id: string; label: string; tools: ToolbarItem[] };

export function toolbarItemsForCurrentPlatform(): ToolbarItem[] {
  return [...DEFAULT_TOOL_ORDER];
}

export function defaultToolbarLayout(): ToolbarLayout {
  const available = toolbarItemsForCurrentPlatform();
  const more = DEFAULT_MORE_TOOL_ORDER.filter(value => available.includes(value));
  return { toolbar: available.filter(value => !more.includes(value)), more };
}

export function readToolbarLayout(): ToolbarLayout {
  try {
    const available = toolbarItemsForCurrentPlatform();
    const defaults = defaultToolbarLayout();
    const normalize = (values: unknown) => Array.isArray(values)
      ? [...new Set(values.filter((value): value is ToolbarItem => available.includes(value as ToolbarItem)))]
      : [];
    const saved: unknown = JSON.parse(localStorage.getItem("sketchdraw-toolbar-layout") ?? "null");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      const source = saved as { toolbar?: unknown; more?: unknown };
      const toolbar = normalize(source.toolbar);
      const more = normalize(source.more).filter(value => !toolbar.includes(value));
      for (const value of [...defaults.toolbar, ...defaults.more]) {
        if (toolbar.includes(value) || more.includes(value)) continue;
        (defaults.more.includes(value) ? more : toolbar).push(value);
      }
      return { toolbar, more };
    }

    const legacy = JSON.parse(localStorage.getItem("sketchdraw-toolbar-order") ?? "null") as unknown;
    if (Array.isArray(legacy)) {
      const toolbar = normalize(legacy);
      const more = defaults.more.filter(value => !toolbar.includes(value));
      for (const value of defaults.toolbar) if (!toolbar.includes(value)) toolbar.push(value);
      for (const value of defaults.more) if (!toolbar.includes(value) && !more.includes(value)) more.push(value);
      return { toolbar, more };
    }
    return defaults;
  } catch { return defaultToolbarLayout(); }
}
