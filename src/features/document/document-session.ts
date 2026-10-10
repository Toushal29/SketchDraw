import { createSignal } from "solid-js";
import type { SketchFile, SketchPage, WindowsSyncMetadata, PersonalLibraryData } from "../../model";
import { createProjectWorkspace } from "../project/project-data";
import { createLegacyLibraryData } from "../files/legacy-library-data";
import { displayPathName } from "../files/paths";
import type { WorkspaceArea } from "../workspace/workspace-types";
import type { ProjectWorkspaceData } from "../../model";

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Owns the active document's cross-workspace state and lifecycle. */
export function createDocumentSession() {
  const [pages, setPages] = createSignal<SketchPage[]>([]);
  const [activePageId, setActivePageId] = createSignal("");
  const [activePath, setActivePath] = createSignal<string>();
  const [projectWorkspaceData, setProjectWorkspaceData] = createSignal<ProjectWorkspaceData>(createProjectWorkspace());
  // Retired Library collections remain in the archive for round-trip safety.
  // Notebook edits only quickNotes in the in-memory compatibility model.
  const [legacyLibraryData, setLegacyLibraryData] = createSignal<PersonalLibraryData>(createLegacyLibraryData());
  const [workspaceArea, setWorkspaceArea] = createSignal<WorkspaceArea>("canvas");
  const [readOnlyView, setReadOnlyView] = createSignal(false);
  const [dirty, setDirty] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [savedAt, setSavedAt] = createSignal("");
  const [windowsSyncMetadata, setWindowsSyncMetadata] = createSignal<WindowsSyncMetadata>();

  function activate(snapshot: SketchFile, path: string, area: WorkspaceArea = "canvas") {
    const copiedPages = snapshot.pages.map(page => ({ ...page, canvasState: { ...page.canvasState }, elements: cloneValue(page.elements) }));
    const currentPage = copiedPages.find(page => page.id === snapshot.activePageId) ?? copiedPages[0];
    setPages(copiedPages);
    setActivePageId(currentPage.id);
    setActivePath(path);
    setProjectWorkspaceData(snapshot.project ?? createProjectWorkspace(displayPathName(path).replace(/\.sketch$/i, "")));
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
    setProjectWorkspaceData(createProjectWorkspace());
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
    projectWorkspaceData, setProjectWorkspaceData,
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
