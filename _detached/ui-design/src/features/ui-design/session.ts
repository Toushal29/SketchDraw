import { createSignal } from "solid-js";
import { filePathIdentity, normalizeFileUri } from "../files/paths";
import { createUIDesignDocument, parseUIDesignDocument, serializeUIDesignDocument, type UIDesignDocument } from "./model";

const RECENT_KEY = "sketchdraw-recent-ui-design-files-v1";
const RECOVERY_KEY = "sketchdraw-ui-design-recovery-v2";
const HISTORY_LIMIT = 100;

export type UIDesignFileHost = {
  chooseOpen(): Promise<string | null>;
  chooseSave(defaultName: string): Promise<string | null>;
  authorize(path: string): Promise<string>;
  read(path: string): Promise<string>;
  write(path: string, contents: string, expected: string | null): Promise<void>;
  displayName(path: string): string;
};

function readRecentPaths(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((path): path is string => typeof path === "string").slice(0, 12) : [];
  } catch { return []; }
}

export function createUIDesignSession(host: UIDesignFileHost) {
  const [document, setDocument] = createSignal<UIDesignDocument>(createUIDesignDocument());
  const [path, setPath] = createSignal<string>();
  const [dirty, setDirty] = createSignal(false);
  const [opening, setOpening] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [savedAt, setSavedAt] = createSignal("");
  const [error, setError] = createSignal("");
  const [recentPaths, setRecentPaths] = createSignal(readRecentPaths());
  const [editorOpen, setEditorOpen] = createSignal(false);
  const [hasDocument, setHasDocument] = createSignal(false);
  const [historyRevision, setHistoryRevision] = createSignal(0);
  const [recoveryAvailable, setRecoveryAvailable] = createSignal(false);
  const past: UIDesignDocument[] = [];
  const future: UIDesignDocument[] = [];
  let baseline: string | null = null;
  let lastHistoryKey: string | undefined;
  let lastHistoryAt = 0;
  let recoveryTimer: number | undefined;

  try { setRecoveryAvailable(!!localStorage.getItem(RECOVERY_KEY)); } catch { /* Recovery is optional when storage is unavailable. */ }

  function scheduleRecovery(snapshot: UIDesignDocument) {
    window.clearTimeout(recoveryTimer);
    recoveryTimer = window.setTimeout(() => {
      try { localStorage.setItem(RECOVERY_KEY, serializeUIDesignDocument(snapshot)); setRecoveryAvailable(true); } catch { /* Preserve editing when recovery storage is full or disabled. */ }
    }, 350);
  }

  function clearRecovery() {
    window.clearTimeout(recoveryTimer);
    try { localStorage.removeItem(RECOVERY_KEY); } catch { /* Recovery is optional when storage is unavailable. */ }
    setRecoveryAvailable(false);
  }

  function remember(filePath: string) {
    const normalized = normalizeFileUri(filePath);
    const identity = filePathIdentity(normalized);
    const next = [normalized, ...recentPaths().filter(item => filePathIdentity(item) !== identity)].slice(0, 12);
    setRecentPaths(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* Keep the list for this run if storage is unavailable. */ }
  }

  async function openPath(filePath: string): Promise<boolean> {
    if (saving() || opening() || dirty() && !window.confirm("Discard unsaved UI Design changes and open another file?")) return false;
    setOpening(true);
    setError("");
    try {
      const authorized = await host.authorize(filePath);
      const raw = await host.read(authorized);
      const parsed = parseUIDesignDocument(raw);
      setDocument(parsed);
      setPath(authorized);
      setEditorOpen(true);
      setHasDocument(true);
      setDirty(false);
      baseline = raw;
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      clearRecovery();
      past.length = 0;
      future.length = 0;
      lastHistoryKey = undefined;
      lastHistoryAt = 0;
      setHistoryRevision(value => value + 1);
      remember(authorized);
      return true;
    } catch (cause) {
      setError(`Could not open UI Design file: ${String(cause)}`);
      return false;
    } finally { setOpening(false); }
  }

  async function open(): Promise<boolean> {
    if (saving() || opening()) return false;
    try {
      const selected = await host.chooseOpen();
      return selected ? openPath(selected) : false;
    } catch (cause) {
      setError(`Could not choose a UI Design file: ${String(cause)}`);
      return false;
    }
  }

  function create(name = "Untitled UI design"): boolean {
    if (saving() || opening() || dirty() && !window.confirm("Discard unsaved UI Design changes and create a new file?")) return false;
    setDocument(createUIDesignDocument(name));
    setPath(undefined);
    setEditorOpen(true);
    setHasDocument(true);
    setDirty(false);
    setSavedAt("");
    baseline = null;
    clearRecovery();
    past.length = 0;
    future.length = 0;
    lastHistoryKey = undefined;
    lastHistoryAt = 0;
    setHistoryRevision(value => value + 1);
    setError("");
    return true;
  }

  function update(next: UIDesignDocument, coalesceKey?: string) {
    if (opening()) return;
    const current = document();
    if (next === current) return;
    const now = Date.now();
    const coalesce = !!coalesceKey && coalesceKey === lastHistoryKey && now - lastHistoryAt < 700;
    if (!coalesce) {
      past.push(current);
      if (past.length > HISTORY_LIMIT) past.shift();
    }
    future.length = 0;
    lastHistoryKey = coalesceKey;
    lastHistoryAt = coalesceKey ? now : 0;
    setDocument(next);
    setDirty(true);
    setError("");
    scheduleRecovery(next);
    setHistoryRevision(value => value + 1);
  }

  function undo() {
    if (opening()) return;
    lastHistoryKey = undefined;
    lastHistoryAt = 0;
    const previous = past.pop();
    if (!previous) return;
    future.push(document());
    setDocument(previous);
    setDirty(true);
    scheduleRecovery(previous);
    setHistoryRevision(value => value + 1);
  }

  function redo() {
    if (opening()) return;
    lastHistoryKey = undefined;
    lastHistoryAt = 0;
    const next = future.pop();
    if (!next) return;
    past.push(document());
    setDocument(next);
    setDirty(true);
    scheduleRecovery(next);
    setHistoryRevision(value => value + 1);
  }

  async function writeTo(filePath: string, updateCurrent: boolean): Promise<boolean> {
    if (saving() || opening()) return false;
    setSaving(true);
    setError("");
    try {
      const snapshot = document();
      const contents = serializeUIDesignDocument(snapshot);
      const expected = updateCurrent && path() === filePath ? baseline : null;
      await host.write(filePath, contents, expected);
      remember(filePath);
      if (updateCurrent) {
        setPath(filePath);
        baseline = contents;
        setDirty(document() !== snapshot);
        setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        if (document() === snapshot) clearRecovery();
        else scheduleRecovery(document());
      }
      return true;
    } catch (cause) {
      setError(`Could not save UI Design file: ${String(cause)}`);
      return false;
    } finally { setSaving(false); }
  }

  async function saveAs(): Promise<boolean> {
    if (saving() || opening()) return false;
    try {
      const suggested = path() ? host.displayName(path()!).replace(/\.sdui$/i, "") + ".sdui" : `${document().name.replace(/[<>:"/\\|?*]/g, "-") || "Untitled"}.sdui`;
      const selected = await host.chooseSave(suggested);
      if (!selected) return false;
      const authorized = await host.authorize(selected);
      return writeTo(authorized, true);
    } catch (cause) {
      setError(`Could not choose a UI Design save location: ${String(cause)}`);
      return false;
    }
  }

  async function save(): Promise<boolean> {
    const current = path();
    return current ? writeTo(current, true) : saveAs();
  }

  async function openRecent(filePath: string): Promise<boolean> { return openPath(filePath); }
  function reportError(message: string) { setError(message); }
  function restoreRecovery(): boolean {
    if (!recoveryAvailable() || saving() || opening() || dirty() && !window.confirm("Replace the current UI Design draft with the recovered version?")) return false;
    try {
      const recovered = parseUIDesignDocument(localStorage.getItem(RECOVERY_KEY) ?? "");
      setDocument(recovered);
      setPath(undefined);
      setEditorOpen(true);
      setHasDocument(true);
      setDirty(true);
      setSavedAt("");
      baseline = null;
      past.length = 0;
      future.length = 0;
      lastHistoryKey = undefined;
      lastHistoryAt = 0;
      setHistoryRevision(value => value + 1);
      setError("");
      setRecoveryAvailable(false);
      return true;
    } catch (cause) {
      setError(`Could not recover the last UI Design draft: ${String(cause)}`);
      clearRecovery();
      return false;
    }
  }
  function dismissRecovery() { clearRecovery(); }
  function goHome() { setEditorOpen(false); }
  function continueEditing() { setEditorOpen(true); }

  return {
    document, path, dirty, opening, saving, savedAt, error, recentPaths, recoveryAvailable, editorOpen, hasDocument,
    open, openPath, openRecent, create, update, save, saveAs, undo, redo, reportError, restoreRecovery, dismissRecovery, goHome, continueEditing,
    canUndo: () => { historyRevision(); return !opening() && past.length > 0; },
    canRedo: () => { historyRevision(); return !opening() && future.length > 0; },
    fileName: () => path() ? host.displayName(path()!) : document().name,
    recentDisplayName: (filePath: string) => host.displayName(filePath),
  };
}

export type UIDesignSession = ReturnType<typeof createUIDesignSession>;
