import { invoke } from "@tauri-apps/api/core";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { normalizeFileUri } from "./paths";

/** Windows file I/O contract: scoped access, atomic replacement, and conflict checks. */
export const sketchFileStore = {
  capabilities: {
    canReportRevisionToken: false,
    supportsConditionalWrite: true,
    supportsAtomicWrite: true,
    supportsBackgroundUpdateCheck: true,
    supportsConflictPreflight: true,
  },

  authorize(path: string) {
    return invoke<string>("authorize_sketch_file", { path: normalizeFileUri(path) });
  },

  read(path: string) {
    return readTextFile(path);
  },

  write(path: string, contents: string, expected: string | null = null) {
    return invoke("atomic_save_sketch", { path: normalizeFileUri(path), contents, expected });
  },
};
