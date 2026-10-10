import type { CanvasState, Element, PersonalLibraryData, ProjectWorkspaceData, SketchFile, SketchFileDocumentV9, SketchPage, Theme, WindowsSyncMetadata } from "../../model";
import { SKETCH_FORMAT_VERSION } from "../../model";
import { createProjectWorkspace } from "../project/project-data";
import { createLegacyLibraryData } from "./legacy-library-data";
import { normalizeElement } from "./parse-sketch";

type CreateSnapshotOptions = {
  pages: SketchPage[];
  activePageId: string;
  activeElements: Element[];
  activeCanvasState: CanvasState;
  activeRenderedBoardColor: string;
  theme: Theme;
  project: ProjectWorkspaceData;
  library: PersonalLibraryData;
  windowsSync?: WindowsSyncMetadata;
};

export function createSketchSnapshot(options: CreateSnapshotOptions): SketchFile {
  const sourcePages = options.pages.length ? options.pages : [{ id: "page-1", name: "Page 1", canvasState: options.activeCanvasState, elements: options.activeElements }];
  const pages = sourcePages.map(page => {
    const isCurrent = page.id === options.activePageId || (!options.activePageId && sourcePages.length === 1);
    const sourceElements = isCurrent ? options.activeElements : page.elements;
    const normalized = sourceElements.map(normalizeElement);
    const invalidIndex = normalized.findIndex(element => !element);
    if (invalidIndex >= 0) {
      const invalid = sourceElements[invalidIndex];
      throw new Error(`The ${invalid?.type ?? "unknown"} element ${invalid?.id ?? invalidIndex + 1} on “${page.name}” cannot be saved in SketchDraw format v${SKETCH_FORMAT_VERSION}.`);
    }
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
    project: options.project,
    library: options.library,
    ...(options.windowsSync ? { windowsSync: options.windowsSync } : {}),
  };
}

export function serializeSketchSnapshot(snapshot: SketchFile): string {
  const library = snapshot.library ?? createLegacyLibraryData();
  const document: SketchFileDocumentV9 = {
    format: "SketchDraw",
    version: SKETCH_FORMAT_VERSION,
    sections: {
      canvas: { activePageId: snapshot.activePageId, pages: snapshot.pages },
      planning: snapshot.project ?? createProjectWorkspace(),
      notebook: { notes: library.quickNotes },
      retiredLibraryArchive: {
        studyNotes: library.studyNotes,
        studyCards: library.studyCards,
        wikiArticles: library.wikiArticles,
        journalEntries: library.journalEntries,
        writingDrafts: library.writingDrafts,
        researchSources: library.researchSources,
        mediaEntries: library.mediaEntries,
      },
    },
    ...(snapshot.windowsSync ? { windowsSync: snapshot.windowsSync } : {}),
  };
  return JSON.stringify(document, null, 2);
}
