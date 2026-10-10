import { createSignal } from "solid-js";
import type { SketchFile, SketchPage, WindowsSyncMetadata } from "../../model";
import { displayPathName } from "../files/paths";

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Owns the active canvas document and its page state. */
export function createDocumentSession() {
  const [pages, setPages] = createSignal<SketchPage[]>([]);
  const [activePageId, setActivePageId] = createSignal("");
  const [activePath, setActivePath] = createSignal<string>();
  const [readOnlyView, setReadOnlyView] = createSignal(false);
  const [dirty, setDirty] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [savedAt, setSavedAt] = createSignal("");
  const [windowsSyncMetadata, setWindowsSyncMetadata] = createSignal<WindowsSyncMetadata>();

  function activate(snapshot: SketchFile, path: string) {
    const copiedPages = snapshot.pages.map(page => ({ ...page, canvasState: { ...page.canvasState }, elements: cloneValue(page.elements) }));
    const currentPage = copiedPages.find(page => page.id === snapshot.activePageId) ?? copiedPages[0];
    setPages(copiedPages);
    setActivePageId(currentPage.id);
    setActivePath(path);
    setWindowsSyncMetadata(snapshot.windowsSync);
    setReadOnlyView(false);
    setDirty(!snapshot.windowsSync);
    setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    return currentPage;
  }

  function reset() {
    setPages([]);
    setActivePageId("");
    setActivePath(undefined);
    setReadOnlyView(false);
    setDirty(false);
    setSaving(false);
    setSavedAt("");
    setWindowsSyncMetadata(undefined);
  }

  return {
    pages, setPages,
    activePageId, setActivePageId,
    activePath, setActivePath,
    readOnlyView, setReadOnlyView,
    dirty, setDirty,
    saving, setSaving,
    savedAt, setSavedAt,
    windowsSyncMetadata, setWindowsSyncMetadata,
    activate,
    reset,
    suggestedName: () => activePath() ? displayPathName(activePath()!).replace(/\.sketchdraw$/i, "") : "Untitled",
  };
}
