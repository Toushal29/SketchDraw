import { createSignal } from "solid-js";
import type { ProjectWorkspaceData, WindowsSyncMetadata } from "../../model";
import { displayPathName, isPlanningPath, normalizeFileUri, withPlanningExtension } from "../files/paths";
import { createProjectWorkspace } from "./project-data";
import { hasPlanningContent, parsePlanningFile, serializePlanningFile } from "./planning-file";
import { planningFileStore } from "./planning-file-store";

type PlanningSessionPorts = {
  busy: () => boolean;
  setBusy: (busy: boolean) => void;
  chooseDocument: () => Promise<string | null>;
  createDocument: (fileName: string) => Promise<string | null>;
  activeSketchPath: () => string | undefined;
  displayNameForPath: (path: string) => string;
  setError: (message: string) => void;
};

export function createPlanningSession(ports: PlanningSessionPorts) {
  const [recentPlans, setRecentPlans] = createSignal<string[]>((() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem("sketchdraw-recent-plans") ?? "[]");
      return Array.isArray(value) ? value.filter((path): path is string => typeof path === "string" && isPlanningPath(path)).slice(0, 100) : [];
    } catch { return []; }
  })());
  const [data, setData] = createSignal<ProjectWorkspaceData>(createProjectWorkspace());
  const [path, setPath] = createSignal<string>();
  const [dirty, setDirty] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [savedAt, setSavedAt] = createSignal("");
  const [baselineRaw, setBaselineRaw] = createSignal<string>();
  const [legacyPending, setLegacyPending] = createSignal<ProjectWorkspaceData>();
  const [needsExtraction, setNeedsExtraction] = createSignal(false);
  let legacySourcePath: string | undefined;

  function remember(filePath: string) {
    filePath = normalizeFileUri(filePath);
    const updated = [filePath, ...recentPlans().filter(item => normalizeFileUri(item) !== filePath)].slice(0, 100);
    setRecentPlans(updated);
    try { localStorage.setItem("sketchdraw-recent-plans", JSON.stringify(updated)); } catch { /* Keep recent plans for this session if browser storage is unavailable. */ }
  }

  async function write(filePath: string, project: ProjectWorkspaceData, updateCurrent: boolean): Promise<boolean> {
    if (saving()) return false;
    setSaving(true);
    try {
      const contents = serializePlanningFile(project);
      const expected = updateCurrent && path() === filePath ? baselineRaw() ?? null : null;
      await planningFileStore.write(filePath, contents, expected);
      remember(filePath);
      if (updateCurrent) {
        setPath(filePath);
        setBaselineRaw(contents);
        setDirty(false);
        setNeedsExtraction(false);
        setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      }
      ports.setError("");
      return true;
    } catch (cause) {
      ports.setError(`Could not save Planning file: ${String(cause)}`);
      return false;
    } finally { setSaving(false); }
  }

  async function saveAs(project = data(), updateCurrent = true, suggestedName?: string): Promise<boolean> {
    if (ports.busy() || saving()) return false;
    ports.setBusy(true);
    try {
      const defaultName = suggestedName ?? (path() ? ports.displayNameForPath(path()!).replace(/\.sdplan$/i, "") + ".sdplan" : "Untitled.sdplan");
      const selected = await ports.createDocument(defaultName);
      if (!selected) return false;
      const destination = withPlanningExtension(selected);
      if (/^content:\/\//i.test(destination)) await planningFileStore.authorize(destination);
      return await write(destination, project, updateCurrent);
    } catch (cause) {
      ports.setError(`Could not choose Planning save location: ${String(cause)}`);
      return false;
    } finally { ports.setBusy(false); }
  }

  async function save(): Promise<boolean> {
    const currentPath = path();
    return currentPath ? write(currentPath, data(), true) : saveAs();
  }

  async function beforeReplace(): Promise<boolean> {
    const pending = legacyPending();
    if (pending && !await saveLegacyCopy(pending)) return false;
    if (!dirty()) return true;
    const saved = await save();
    return saved && !dirty();
  }

  async function close(): Promise<boolean> {
    if (ports.busy() || saving() || !await beforeReplace()) return false;
    setData(createProjectWorkspace());
    setPath(undefined);
    setBaselineRaw(undefined);
    setDirty(false);
    setSavedAt("");
    setNeedsExtraction(false);
    setLegacyPending(undefined);
    legacySourcePath = undefined;
    ports.setError("");
    return true;
  }

  async function load(filePath: string): Promise<boolean> {
    if (ports.busy()) return false;
    if (!await beforeReplace()) return false;
    ports.setBusy(true);
    try {
      const authorizedPath = await planningFileStore.authorize(filePath);
      const raw = await planningFileStore.read(authorizedPath);
      const parsed = parsePlanningFile(JSON.parse(raw) as unknown);
      if (!parsed) throw new Error("This is not a supported SketchDraw .sdplan file.");
      setData(parsed.project);
      setPath(authorizedPath);
      setBaselineRaw(raw);
      setDirty(false);
      setNeedsExtraction(false);
      setLegacyPending(undefined);
      legacySourcePath = undefined;
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      remember(authorizedPath);
      ports.setError("");
      return true;
    } catch (cause) {
      ports.setError(`Could not open Planning file: ${String(cause)}`);
      return false;
    } finally { ports.setBusy(false); }
  }

  async function openPicker(): Promise<boolean> {
    if (ports.busy() || !await beforeReplace()) return false;
    ports.setBusy(true);
    let selected: string | null = null;
    try { selected = await ports.chooseDocument(); }
    catch (cause) { ports.setError(`Could not choose Planning file: ${String(cause)}`); }
    finally { ports.setBusy(false); }
    return selected ? load(selected) : false;
  }

  async function create(): Promise<boolean> {
    if (ports.busy() || !await beforeReplace()) return false;
    ports.setBusy(true);
    try {
      const selected = await ports.createDocument("Untitled.sdplan");
      if (!selected) return false;
      const destination = withPlanningExtension(selected);
      if (/^content:\/\//i.test(destination)) await planningFileStore.authorize(destination);
      const project = createProjectWorkspace(displayPathName(destination).replace(/\.sdplan$/i, "") || "Untitled project");
      const contents = serializePlanningFile(project);
      await planningFileStore.write(destination, contents, null);
      setData(project);
      setPath(destination);
      setBaselineRaw(contents);
      setDirty(false);
      setNeedsExtraction(false);
      setLegacyPending(undefined);
      legacySourcePath = undefined;
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      remember(destination);
      ports.setError("");
      return true;
    } catch (cause) {
      ports.setError(`Could not create Planning file: ${String(cause)}`);
      return false;
    } finally { ports.setBusy(false); }
  }

  async function saveLegacyCopy(project: ProjectWorkspaceData): Promise<boolean> {
    if (ports.busy() || saving()) return false;
    ports.setBusy(true);
    try {
      const sketchStem = ports.activeSketchPath() ? ports.displayNameForPath(ports.activeSketchPath()!).replace(/\.sketch$/i, "") : "Imported planning";
      const selected = await ports.createDocument(`${sketchStem}.sdplan`);
      if (!selected) return false;
      const destination = withPlanningExtension(selected);
      if (path() && normalizeFileUri(destination) === normalizeFileUri(path()!)) {
        ports.setError("Choose a different .sdplan file so the existing Planning file is not overwritten by imported data.");
        return false;
      }
      if (/^content:\/\//i.test(destination)) await planningFileStore.authorize(destination);
      const saved = await write(destination, project, false);
      if (saved) { setLegacyPending(undefined); setNeedsExtraction(false); }
      return saved;
    } catch (cause) {
      ports.setError(`Could not extract legacy Planning data: ${String(cause)}`);
      return false;
    } finally { ports.setBusy(false); }
  }

  function importLegacy(project: ProjectWorkspaceData | undefined, defaultNames: readonly string[] = []) {
    if (!project || !hasPlanningContent(project, defaultNames)) return;
    if (path() || dirty()) setLegacyPending(project);
    else {
      setData(project);
      setPath(undefined);
      setBaselineRaw(undefined);
      setDirty(true);
      setLegacyPending(undefined);
    }
    setNeedsExtraction(true);
  }

  function importLegacyFromSketch({ path: sketchPath, quickNotes }: {
    path: string;
    quickNotes: ProjectWorkspaceData["notes"];
  }): boolean {
    const sketchName = ports.displayNameForPath(sketchPath).replace(/\.sketch$/i, "");
    if (!quickNotes.length) return false;
    const project = { ...createProjectWorkspace(sketchName), notes: quickNotes };
    if (hasPlanningContent(project, [sketchName, "Untitled project"])) legacySourcePath = normalizeFileUri(sketchPath);
    importLegacy(project, [sketchName, "Untitled project"]);
    return true;
  }

  function discardLegacyFromSketch(sketchPath: string) {
    if (legacySourcePath !== normalizeFileUri(sketchPath)) return;
    setLegacyPending(undefined);
    setNeedsExtraction(false);
    if (!path() && dirty()) {
      setData(createProjectWorkspace());
      setDirty(false);
      setSavedAt("");
    }
    legacySourcePath = undefined;
  }

  function removeLegacySyncMetadata(metadata: WindowsSyncMetadata | undefined): WindowsSyncMetadata | undefined {
    if (!metadata) return metadata;
    const isLegacyPlanningKey = (key: string) => /^w:(?:meta|n|t|c|m|l|f)(?::|$)/.test(key);
    const clocks = Object.fromEntries(Object.entries(metadata.clocks).filter(([key]) => !isLegacyPlanningKey(key)));
    const tombstones = Object.fromEntries(Object.entries(metadata.tombstones).filter(([key]) => !isLegacyPlanningKey(key)));
    return Object.keys(clocks).length === Object.keys(metadata.clocks).length
      && Object.keys(tombstones).length === Object.keys(metadata.tombstones).length
      ? metadata
      : { ...metadata, clocks, tombstones };
  }

  function update(project: ProjectWorkspaceData) {
    setData(project);
    setDirty(true);
  }

  return {
    recentPlans, data, path, dirty, saving, savedAt, legacyPending, needsExtraction,
    update, remember, save, saveAs, beforeReplace, close, load, openPicker, create, saveLegacyCopy, importLegacy, importLegacyFromSketch, discardLegacyFromSketch, removeLegacySyncMetadata,
  };
}
