import type { SketchFile } from "../../model";
import type { WorkspaceArea } from "../workspace/workspace-types";
import { normalizeFileUri, isSketchPath } from "../files/paths";
import { decodeSketchDocument, mergeSketchDocument, openSketchDocument, saveSketchDocument } from "../files/sketch-document-service";
import { sketchFileStore } from "../files/sketch-file-store";
import { sketchRecoveryStore } from "../files/sketch-recovery-store";
import { restoreDocumentRecovery } from "./document-recovery";
import type { DocumentConflict, DocumentControllerStatus, DocumentRecoveryPrompt } from "./document-types";

type DocumentControllerPorts = {
  activePath: () => string | undefined;
  setActivePath: (path: string) => void;
  dirty: () => boolean;
  setDirty: (dirty: boolean) => void;
  readOnly: () => boolean;
  setReadOnly: (readOnly: boolean) => void;
  documentBusy: () => boolean;
  setDocumentBusy: (busy: boolean) => void;
  setSaving: (saving: boolean) => void;
  setSavedAt: (savedAt: string) => void;
  setError: (message: string) => void;
  recoveryPrompt: () => DocumentRecoveryPrompt | undefined;
  setRecoveryPrompt: (prompt: DocumentRecoveryPrompt | undefined) => void;
  syncConflict: () => DocumentConflict | undefined;
  setSyncConflict: (conflict: DocumentConflict | undefined) => void;
  workspaceArea: () => WorkspaceArea;
  snapshot: () => SketchFile;
  snapshotRaw: (snapshot: SketchFile) => string;
  applySnapshot: (snapshot: SketchFile, path: string, raw: string, area?: WorkspaceArea) => void;
  resetDocument: () => void;
  beforeReplace: () => Promise<boolean>;
  commitTextDraft: () => void;
  rememberFile: (path: string) => void;
  onOpened: (path: string, viewOnly: boolean) => void;
  restoreOpenedView: (path: string, pageId: string) => void;
  canCheckForUpdates: () => boolean;
  shouldKeepDocumentDirtyAfterUpdate?: (remote: SketchFile) => boolean;
  normalizePath?: (path: string) => string;
  isSketchPath?: (path: string) => boolean;
  setStatus?: (status: DocumentControllerStatus) => void;
};

/** Coordinates document lifecycle and reports state transitions through the UI ports. */
export function createDocumentController(ports: DocumentControllerPorts) {
  let baselineRaw: string | undefined;
  let saveInFlight = false;
  const normalize = ports.normalizePath ?? normalizeFileUri;
  const supportsSketch = ports.isSketchPath ?? isSketchPath;
  const report = (status: DocumentControllerStatus) => ports.setStatus?.(status);

  async function save(path: string): Promise<void> {
    if (ports.readOnly() || saveInFlight || ports.recoveryPrompt()) return;
    ports.commitTextDraft();
    saveInFlight = true;
    ports.setSaving(true);
    report("saving");
    try {
      const snapshot = ports.snapshot();
      const isNewPath = ports.activePath() !== path;
      const saved = await saveSketchDocument(path, snapshot, !isNewPath ? baselineRaw ?? null : null);
      if (saved.conflictRaw !== undefined) {
        ports.setSyncConflict({ path, remote: saved.conflictRaw });
        report("conflict");
        return;
      }
      ports.setActivePath(path);
      if (isNewPath) ports.rememberFile(path);
      baselineRaw = saved.contents;
      ports.setSyncConflict(undefined);
      sketchRecoveryStore.remove(path);
      ports.setDirty(ports.snapshotRaw(ports.snapshot()) !== saved.contents);
      ports.setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      ports.setError("");
      report("saved");
    } catch (cause) {
      if (String(cause).includes("CONFLICT:")) {
        try {
          ports.setSyncConflict({ path, remote: await sketchFileStore.read(path) });
          report("conflict");
        } catch { /* Keep local recovery available if the shared file cannot be read. */ }
      }
      ports.setError(`Could not save file: ${String(cause)}`);
      report("error");
    } finally {
      saveInFlight = false;
      ports.setSaving(false);
    }
  }

  async function open(path: string, viewOnly = false): Promise<boolean> {
    if (ports.documentBusy()) return false;
    ports.setDocumentBusy(true);
    report("opening");
    try {
      path = normalize(path);
      if (!supportsSketch(path)) throw new Error("Only .sketch documents are supported.");
      if (!await ports.beforeReplace()) { report("idle"); return false; }
      const opened = await openSketchDocument(path);
      const { path: authorizedPath, rawText, snapshot, needsMigration } = opened;
      ports.applySnapshot(snapshot, authorizedPath, rawText, "canvas");
      ports.setReadOnly(viewOnly);
      ports.onOpened(authorizedPath, viewOnly);
      ports.rememberFile(authorizedPath);
      ports.restoreOpenedView(authorizedPath, snapshot.activePageId);
      if (needsMigration && !viewOnly) ports.setDirty(true);
      if (!viewOnly) {
        try {
          const entry = sketchRecoveryStore.read(authorizedPath);
          if (entry && typeof entry === "object" && !Array.isArray(entry)) {
            const record = entry as Record<string, unknown>;
            const recovered = decodeSketchDocument(record.snapshot);
            const recoveryBaseline = typeof record.baselineRaw === "string" ? record.baselineRaw : undefined;
            if (recovered && ports.snapshotRaw(recovered) !== ports.snapshotRaw(snapshot)) {
              ports.setRecoveryPrompt({ path: authorizedPath, snapshot: recovered, baselineRaw: recoveryBaseline });
            } else sketchRecoveryStore.remove(authorizedPath);
          }
        } catch { /* Ignore malformed recovery data and leave the source file untouched. */ }
      }
      baselineRaw = rawText;
      if (needsMigration && !viewOnly && !ports.recoveryPrompt()) await save(authorizedPath);
      report("idle");
      return true;
    } catch (cause) {
      ports.setError(`Could not open file: ${String(cause)}`);
      report("error");
      return false;
    } finally {
      ports.setDocumentBusy(false);
    }
  }

  async function close(): Promise<boolean> {
    if (!ports.activePath() || ports.documentBusy()) return false;
    ports.setDocumentBusy(true);
    try {
      if (!await ports.beforeReplace()) return false;
      ports.resetDocument();
      baselineRaw = undefined;
      ports.setError("");
      report("idle");
      return true;
    } finally { ports.setDocumentBusy(false); }
  }

  async function checkForUpdates(): Promise<void> {
    const path = ports.activePath();
    const startingBaseline = baselineRaw;
    const wasReadOnly = ports.readOnly();
    if (!path || !startingBaseline || !ports.canCheckForUpdates()) return;
    try {
      const remoteRaw = await sketchFileStore.read(path);
      if (ports.activePath() !== path || baselineRaw !== startingBaseline || remoteRaw === startingBaseline) return;
      const mergedDocument = mergeSketchDocument(ports.snapshot(), remoteRaw);
      if (!mergedDocument) return;
      const { remote, merged } = mergedDocument;
      ports.applySnapshot(merged, path, remoteRaw, ports.workspaceArea());
      ports.setReadOnly(wasReadOnly);
      ports.setSyncConflict(undefined);
      baselineRaw = remoteRaw;
      const hasMergedEdits = ports.snapshotRaw(merged) !== ports.snapshotRaw(remote);
      ports.setDirty(!wasReadOnly && (hasMergedEdits || !!ports.shouldKeepDocumentDirtyAfterUpdate?.(remote)));
      if (hasMergedEdits) window.setTimeout(() => {
        if (ports.activePath() === path && ports.dirty() && !ports.syncConflict()) void save(path);
      }, 80);
    } catch {
      // A disconnected cloud folder or provider lock is retried on the next poll.
    }
  }

  function persistRecovery(entry: { savedAt: number; baselineRaw?: string; snapshot: SketchFile }) {
    const path = ports.activePath();
    if (ports.readOnly() || !path) return;
    sketchRecoveryStore.write(path, entry);
  }

  function restoreRecovery() {
    const recovery = ports.recoveryPrompt();
    if (!recovery) return;
    if (restoreDocumentRecovery(recovery, baselineRaw, ports.workspaceArea(), {
      applySnapshot: ports.applySnapshot,
      removeRecovery: sketchRecoveryStore.remove,
      setDirty: ports.setDirty,
      setRecoveryPrompt: ports.setRecoveryPrompt,
      setConflict: ports.setSyncConflict,
    })) report("conflict");
  }

  function discardRecovery() {
    const recovery = ports.recoveryPrompt();
    if (!recovery) return;
    sketchRecoveryStore.remove(recovery.path);
    ports.setRecoveryPrompt(undefined);
  }

  async function reloadConflict() {
    const conflict = ports.syncConflict();
    if (!conflict) return;
    try {
      const raw: unknown = JSON.parse(conflict.remote);
      const parsed = decodeSketchDocument(raw);
      if (!parsed) throw new Error("The updated file is not a valid SketchDraw document.");
      ports.applySnapshot(parsed, conflict.path, conflict.remote, ports.workspaceArea());
      baselineRaw = conflict.remote;
      ports.setSyncConflict(undefined);
      sketchRecoveryStore.remove(conflict.path);
      if (raw && typeof raw === "object" && "version" in raw && raw.version !== parsed.version) {
        ports.setDirty(true);
        await save(conflict.path);
      }
    } catch (cause) { ports.setError(`Could not reload the synchronized file: ${String(cause)}`); }
  }

  function setBaselineRaw(raw: string | undefined) { baselineRaw = raw; }

  return { open, save, close, checkForUpdates, persistRecovery, restoreRecovery, discardRecovery, reloadConflict, setBaselineRaw, baselineRaw: () => baselineRaw, isSaveInFlight: () => saveInFlight };
}
