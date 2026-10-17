import { createSignal } from "solid-js";
import type { SketchFile, SketchPage, WindowsSyncMetadata, PersonalLibraryData } from "../../model";
import { createLegacyLibraryData } from "../files/legacy-library-data";
import type { WorkspaceArea } from "../workspace/workspace-types";

/** Owns the active document's cross-workspace state and lifecycle. */
export function createDocumentSession() {
  const [pages, setPages] = createSignal<SketchPage[]>([]);
  const [activePageId, setActivePageId] = createSignal("");
  const [activePath, setActivePath] = createSignal<string>();
  // Retired Library collections remain in the archive for round-trip safety.
  // Legacy quick notes are moved into Planning when a document is opened.
  const [legacyLibraryData, setLegacyLibraryData] = createSignal<PersonalLibraryData>(createLegacyLibraryData());
  const [workspaceArea, setWorkspaceArea] = createSignal<WorkspaceArea>("canvas");
  const [readOnlyView, setReadOnlyView] = createSignal(false);
  const [dirty, setDirty] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [savedAt, setSavedAt] = createSignal("");
  const [windowsSyncMetadata, setWindowsSyncMetadata] = createSignal<WindowsSyncMetadata>();

  function activate(snapshot: SketchFile, path: string, area: WorkspaceArea = "canvas") {
    // Parsed snapshot pages are already detached from the input JSON. Keep their
    // immutable element arrays instead of deep-cloning every page on open.
    const copiedPages = snapshot.pages.map(page => ({ ...page, canvasState: { ...page.canvasState } }));
    const currentPage = copiedPages.find(page => page.id === snapshot.activePageId) ?? copiedPages[0];
    setPages(copiedPages);
    setActivePageId(currentPage.id);
    setActivePath(path);
    setLegacyLibraryData(snapshot.library ?? createLegacyLibraryData());
    setWindowsSyncMetadata(snapshot.windowsSync);
    setWorkspaceArea(area);
    setReadOnlyView(false);
    setDirty(!snapshot.windowsSync);
    setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    return currentPage;
  }

  function reset() {
    setPages([]);
    setActivePageId("");
    setActivePath(undefined);
    setLegacyLibraryData(createLegacyLibraryData());
    setWorkspaceArea("canvas");
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
    legacyLibraryData, setLegacyLibraryData,
    workspaceArea, setWorkspaceArea,
    readOnlyView, setReadOnlyView,
    dirty, setDirty,
    saving, setSaving,
    savedAt, setSavedAt,
    windowsSyncMetadata, setWindowsSyncMetadata,
    activate,
    reset,
  };
}
