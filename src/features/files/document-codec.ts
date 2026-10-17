import type { CanvasState, Element, PersonalLibraryData, SketchFile, SketchFileDocumentV9, SketchPage, Theme, WindowsSyncMetadata } from "../../model";
import { SKETCH_FORMAT_VERSION } from "../../model";
import { createLegacyLibraryData } from "./legacy-library-data";
import { normalizeElement } from "./parse-sketch";

// The retired collections are immutable document data. Reuse their encoded block
// across saves while the library object stays unchanged.
const retiredArchiveJson = new WeakMap<PersonalLibraryData, string>();
const retiredArchiveMarker = "__SKETCHDRAW_RETIRED_LIBRARY_ARCHIVE_V9__";
const pageListMarker = "__SKETCHDRAW_PAGE_CHUNKS_V9__";
const elementListMarker = "__SKETCHDRAW_ELEMENT_CHUNK_V9__";
const NORMALIZED_PAGE_CACHE_BYTES = 4 * 1024 * 1024;
const SERIALIZED_PAGE_CACHE_BYTES = 4 * 1024 * 1024;
const normalizedElementCache = new WeakMap<Element, Element | null>();

type NormalizedPageCacheEntry = { elements: Element[]; bytes: number };
type SerializedPageCacheEntry = { metadataKey: string; block: string; elementsJson: string; bytes: number };
const normalizedPageCache = new Map<Element[], NormalizedPageCacheEntry>();
const serializedPageCache = new Map<Element[], SerializedPageCacheEntry>();
let normalizedPageCacheBytes = 0;
let serializedPageCacheBytes = 0;

function estimateElementBytes(element: Element, limit: number): number {
  let bytes = 160;
  if (element.type === "freehand") bytes += element.points.length * 64;
  else if (element.type === "text") bytes += element.text.length * 2;
  else if (element.type === "image") bytes += element.dataUrl.length * 2;
  else if (element.type === "schemaTable") bytes += element.schemaSource.length * 2 + element.columns.length * 160;
  else if (element.type === "group") {
    for (const child of element.elements) {
      bytes += estimateElementBytes(child, limit - bytes);
      if (bytes > limit) return bytes;
    }
    if (element.note) bytes += element.note.content.length * 2 + (element.note.title?.length ?? 0) * 2;
    if (element.mermaid) bytes += element.mermaid.source.length * 2;
  } else if ("label" in element && element.label) bytes += element.label.text.length * 2;
  return bytes;
}

function estimateElementsBytes(elements: Element[], limit: number) {
  let bytes = 0;
  for (const element of elements) {
    bytes += estimateElementBytes(element, limit - bytes);
    if (bytes > limit) break;
  }
  return bytes;
}

function normalizedElements(source: Element[]): Element[] {
  const cached = normalizedPageCache.get(source);
  if (cached) {
    normalizedPageCache.delete(source);
    normalizedPageCache.set(source, cached);
    return cached.elements;
  }
  const normalized = source.map(element => {
    const cachedElement = normalizedElementCache.get(element);
    if (cachedElement !== undefined) return cachedElement ?? undefined;
    const value = normalizeElement(element);
    normalizedElementCache.set(element, value ?? null);
    return value;
  });
  const invalid = normalized.some(element => !element);
  if (invalid) return normalized as Element[];
  const bytes = estimateElementsBytes(source, NORMALIZED_PAGE_CACHE_BYTES);
  if (bytes <= NORMALIZED_PAGE_CACHE_BYTES) {
    while (normalizedPageCacheBytes + bytes > NORMALIZED_PAGE_CACHE_BYTES) {
      const oldest = normalizedPageCache.keys().next().value as Element[] | undefined;
      if (!oldest) break;
      const removed = normalizedPageCache.get(oldest);
      if (removed) normalizedPageCacheBytes -= removed.bytes;
      normalizedPageCache.delete(oldest);
    }
    normalizedPageCache.set(source, { elements: normalized as Element[], bytes });
    normalizedPageCacheBytes += bytes;
  }
  return normalized as Element[];
}

function serializedPage(page: SketchPage): string {
  const metadataKey = JSON.stringify([page.id, page.name, page.canvasState]);
  const cached = serializedPageCache.get(page.elements);
  if (cached?.metadataKey === metadataKey) {
    serializedPageCache.delete(page.elements);
    serializedPageCache.set(page.elements, cached);
    return cached.block;
  }
  // Reuse the element array encoding when only page metadata (such as pan or
  // zoom) changed. The V9 document still stores ordinary JSON page objects.
  const elementsJson = cached?.elementsJson ?? JSON.stringify(page.elements);
  const pageShell = JSON.stringify({ id: page.id, name: page.name, canvasState: page.canvasState, elements: elementListMarker });
  const block = `        ${pageShell.replace(`"elements":"${elementListMarker}"`, `"elements":${elementsJson}`)}`;
  const bytes = (block.length + elementsJson.length) * 2;
  if (cached) {
    serializedPageCache.delete(page.elements);
    serializedPageCacheBytes -= cached.bytes;
  }
  if (bytes <= SERIALIZED_PAGE_CACHE_BYTES) {
    while (serializedPageCacheBytes + bytes > SERIALIZED_PAGE_CACHE_BYTES) {
      const oldest = serializedPageCache.keys().next().value as Element[] | undefined;
      if (!oldest) break;
      const removed = serializedPageCache.get(oldest);
      if (removed) serializedPageCacheBytes -= removed.bytes;
      serializedPageCache.delete(oldest);
    }
    serializedPageCache.set(page.elements, { metadataKey, block, elementsJson, bytes });
    serializedPageCacheBytes += bytes;
  }
  return block;
}

type CreateSnapshotOptions = {
  pages: SketchPage[];
  activePageId: string;
  activeElements: Element[];
  activeCanvasState: CanvasState;
  activeRenderedBoardColor: string;
  theme: Theme;
  library: PersonalLibraryData;
  windowsSync?: WindowsSyncMetadata;
};

export function createSketchSnapshot(options: CreateSnapshotOptions): SketchFile {
  const sourcePages = options.pages.length ? options.pages : [{ id: "page-1", name: "Page 1", canvasState: options.activeCanvasState, elements: options.activeElements }];
  const pages = sourcePages.map(page => {
    const isCurrent = page.id === options.activePageId || (!options.activePageId && sourcePages.length === 1);
    const sourceElements = isCurrent ? options.activeElements : page.elements;
    const normalized = normalizedElements(sourceElements);
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
    library: options.library,
    ...(options.windowsSync ? { windowsSync: options.windowsSync } : {}),
  };
}

export function serializeSketchSnapshot(snapshot: SketchFile): string {
  const library = snapshot.library ?? createLegacyLibraryData();
  let archiveJson = retiredArchiveJson.get(library);
  if (!archiveJson) {
    archiveJson = JSON.stringify({
      studyNotes: library.studyNotes,
      studyCards: library.studyCards,
      wikiArticles: library.wikiArticles,
      journalEntries: library.journalEntries,
      writingDrafts: library.writingDrafts,
      researchSources: library.researchSources,
      mediaEntries: library.mediaEntries,
    }, null, 2);
    retiredArchiveJson.set(library, archiveJson);
  }
  const document: SketchFileDocumentV9 = {
    format: "SketchDraw",
    version: SKETCH_FORMAT_VERSION,
    sections: {
      canvas: { activePageId: snapshot.activePageId, pages: pageListMarker as unknown as SketchFileDocumentV9["sections"]["canvas"]["pages"] },
      notebook: { notes: library.quickNotes },
      retiredLibraryArchive: retiredArchiveMarker as unknown as SketchFileDocumentV9["sections"]["retiredLibraryArchive"],
    },
    ...(snapshot.windowsSync ? { windowsSync: snapshot.windowsSync } : {}),
  };
  const documentJson = JSON.stringify(document, null, 2);
  const marker = `"retiredLibraryArchive": "${retiredArchiveMarker}"`;
  const pageBlocks = snapshot.pages.map(serializedPage).join(",\n");
  const pageArray = `"pages": [\n${pageBlocks}\n      ]`;
  const archive = archiveJson.replace(/\n/g, "\n      ");
  return documentJson.replace(/"retiredLibraryArchive": "__SKETCHDRAW_RETIRED_LIBRARY_ARCHIVE_V9__"|"pages": "__SKETCHDRAW_PAGE_CHUNKS_V9__"/g, token => token === marker ? `"retiredLibraryArchive": ${archive}` : pageArray);
}
