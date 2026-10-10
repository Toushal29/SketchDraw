import type { CanvasState, Element, SketchFile, SketchPage, Theme, WindowsSyncMetadata } from "../../model";
import { SKETCH_FORMAT_VERSION } from "../../model";
import { normalizeElement } from "./parse-sketch";

type CreateSnapshotOptions = {
  pages: SketchPage[];
  activePageId: string;
  activeElements: Element[];
  activeCanvasState: CanvasState;
  activeRenderedBoardColor: string;
  theme: Theme;
  windowsSync?: WindowsSyncMetadata;
};

export function createSketchSnapshot(options: CreateSnapshotOptions): SketchFile {
  const sourcePages = options.pages.length ? options.pages : [{ id: "page-1", name: "Page 1", canvasState: options.activeCanvasState, elements: options.activeElements }];
  const pages = sourcePages.map(page => {
    const isCurrent = page.id === options.activePageId || (!options.activePageId && sourcePages.length === 1);
    const normalized = (isCurrent ? options.activeElements : page.elements).map(normalizeElement);
    if (normalized.some(element => !element)) throw new Error(`The drawing contains an element that cannot be saved in SketchDraw format v${SKETCH_FORMAT_VERSION}.`);
    const state = isCurrent ? options.activeCanvasState : page.canvasState;
    const backgroundColor = isCurrent
      ? options.activeRenderedBoardColor
      : state.boardColorFollowsTheme ? options.theme === "dark" ? "#17191f" : "#ffffff" : state.backgroundColor;
    return {
      id: page.id,
      name: page.name,
      canvasState: { ...state, backgroundColor, boardColorFollowsTheme: state.boardColorFollowsTheme ?? true },
      elements: normalized as Element[],
    };
  });
  return {
    format: "SketchDraw",
    version: SKETCH_FORMAT_VERSION,
    activePageId: options.activePageId || pages[0].id,
    pages,
    ...(options.windowsSync ? { windowsSync: options.windowsSync } : {}),
  };
}

export function serializeSketchSnapshot(snapshot: SketchFile): string {
  return JSON.stringify({
    format: "SketchDraw",
    version: SKETCH_FORMAT_VERSION,
    activePageId: snapshot.activePageId,
    pages: snapshot.pages,
    ...(snapshot.windowsSync ? { windowsSync: snapshot.windowsSync } : {}),
  } satisfies SketchFile, null, 2);
}
