import type { CanvasBookmark, Element } from "../../model";

export const MAX_BOOKMARKS_PER_PAGE = 50;

export type NavigablePage = { id: string; name: string; elements: Element[]; bookmarks?: CanvasBookmark[] };
export type FrameEntry = { pageId: string; pageName: string; id: string; name: string };

/** Top-level named frames of one page, in stacking order. */
export function pageFrames(elements: Element[]): { id: string; name: string }[] {
  return elements.flatMap(item => item.type === "group" && item.container?.kind === "frame" && item.id && !item.hidden ? [{ id: item.id, name: item.container.name || "Frame" }] : []);
}

/** Every frame in the sketch in reading order: page by page, then stacking order. */
export function collectFrames(pages: NavigablePage[]): FrameEntry[] {
  return pages.flatMap(page => pageFrames(page.elements).map(frame => ({ pageId: page.id, pageName: page.name, ...frame })));
}

/** The frame after (or before) the selected one, wrapping at the ends. With no selected frame it starts on the active page. */
export function adjacentFrame(entries: FrameEntry[], activePageId: string | undefined, selectedFrameId: string | undefined, direction: 1 | -1): FrameEntry | undefined {
  if (!entries.length) return undefined;
  const current = selectedFrameId ? entries.findIndex(entry => entry.id === selectedFrameId) : -1;
  if (current >= 0) return entries[(current + direction + entries.length) % entries.length];
  const onPage = entries.filter(entry => entry.pageId === activePageId);
  if (onPage.length) return direction > 0 ? onPage[0] : onPage[onPage.length - 1];
  return direction > 0 ? entries[0] : entries[entries.length - 1];
}

/** Validates saved bookmarks at the file boundary. Invalid entries are dropped. */
export function normalizeBookmarks(value: unknown): CanvasBookmark[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, MAX_BOOKMARKS_PER_PAGE).flatMap((raw): CanvasBookmark[] => {
    const item = raw as Record<string, unknown> | null;
    if (!item || typeof item.id !== "string" || !/^[\w.-]{1,100}$/.test(item.id) || seen.has(item.id)) return [];
    const finite = (input: unknown): input is number => typeof input === "number" && Number.isFinite(input);
    if (!finite(item.zoom) || item.zoom <= 0 || item.zoom > 100 || !finite(item.panX) || !finite(item.panY) || Math.abs(item.panX) > 1e9 || Math.abs(item.panY) > 1e9) return [];
    seen.add(item.id);
    return [{ id: item.id, name: typeof item.name === "string" && item.name.trim() ? item.name.trim().slice(0, 60) : "View", zoom: item.zoom, panX: item.panX, panY: item.panY }];
  });
}
