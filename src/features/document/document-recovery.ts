import type { SketchFile } from "../../model";
import type { WorkspaceArea } from "../workspace/workspace-types";
import type { DocumentConflict, DocumentRecoveryPrompt } from "./document-types";

export type DocumentRecoveryPorts = {
  applySnapshot: (snapshot: SketchFile, path: string, raw: string, area: WorkspaceArea) => void;
  removeRecovery: (path: string) => void;
  setDirty: (dirty: boolean) => void;
  setRecoveryPrompt: (prompt: DocumentRecoveryPrompt | undefined) => void;
  setConflict: (conflict: DocumentConflict | undefined) => void;
};

/** Applies an interrupted edit and flags a changed on-disk baseline for conflict handling. */
export function restoreDocumentRecovery(
  recovery: DocumentRecoveryPrompt,
  currentBaselineRaw: string | undefined,
  area: WorkspaceArea,
  ports: DocumentRecoveryPorts,
) {
  const baseline = currentBaselineRaw ?? "";
  ports.applySnapshot(recovery.snapshot, recovery.path, baseline, area);
  ports.removeRecovery(recovery.path);
  ports.setDirty(true);
  ports.setRecoveryPrompt(undefined);
  if (recovery.baselineRaw !== undefined && recovery.baselineRaw !== baseline) {
    ports.setConflict({ path: recovery.path, remote: baseline });
    return true;
  }
  return false;
}
