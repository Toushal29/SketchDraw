import type { SketchFile } from "../../model";

export type SketchRecoveryEntry = { savedAt: number; baselineRaw?: string; snapshot: SketchFile };

const recoveryKey = (path: string) => `sketchdraw-v6-recovery:${encodeURIComponent(path)}`;

/** Best-effort browser recovery storage for interrupted document edits. */
export const sketchRecoveryStore = {
  key(path: string) {
    return recoveryKey(path);
  },

  read(path: string): unknown {
    try {
      const stored = localStorage.getItem(recoveryKey(path));
      return stored ? JSON.parse(stored) as unknown : undefined;
    } catch {
      return undefined;
    }
  },

  write(path: string, entry: SketchRecoveryEntry) {
    try { localStorage.setItem(recoveryKey(path), JSON.stringify(entry)); return true; }
    catch { return false; }
  },

  remove(path: string) {
    try { localStorage.removeItem(recoveryKey(path)); return true; }
    catch { return false; }
  },
};
