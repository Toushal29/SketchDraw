import { invoke } from "@tauri-apps/api/core";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { normalizeFileUri } from "./paths";

export type SketchFileStoreCapabilities = {
  /** True when the provider exposes a stable revision token independent of file contents. */
  canReportRevisionToken: boolean;
  /** True when a write can be rejected atomically if the saved baseline has changed. */
  supportsConditionalWrite: boolean;
  /** True when replacing the destination is atomic. */
  supportsAtomicWrite: boolean;
  /** True when the app can poll the selected path for shared-folder changes. */
  supportsBackgroundUpdateCheck: boolean;
  /** True when reading the current bytes allows a best-effort conflict preflight. */
  supportsConflictPreflight: boolean;
};

export type SketchFileStoreAdapter = {
  capabilities: SketchFileStoreCapabilities;
  authorize(path: string): Promise<string>;
  read(path: string): Promise<string>;
  write(path: string, contents: string, expected: string | null): Promise<void>;
};

/** Desktop files use an atomic same-directory replacement with an exact baseline check. */
export const desktopSketchFileAdapter: SketchFileStoreAdapter = {
  capabilities: {
    canReportRevisionToken: false,
    supportsConditionalWrite: true,
    supportsAtomicWrite: true,
    supportsBackgroundUpdateCheck: true,
    supportsConflictPreflight: true,
  },

  authorize(path) {
    return invoke<string>("authorize_sketch_file", { path: normalizeFileUri(path) });
  },

  read(path) {
    return readTextFile(path);
  },

  async write(path, contents, expected) {
    await invoke("atomic_save_sketch", { path: normalizeFileUri(path), contents, expected });
  },
};

/** SAF grants access to one selected document; provider writes have no portable compare-and-swap. */
export const androidSafSketchFileAdapter: SketchFileStoreAdapter = {
  capabilities: {
    canReportRevisionToken: false,
    supportsConditionalWrite: false,
    supportsAtomicWrite: false,
    supportsBackgroundUpdateCheck: false,
    supportsConflictPreflight: true,
  },

  authorize(path) {
    return invoke<string>("authorize_sketch_file", { path });
  },

  read(path) {
    return readTextFile(path);
  },

  async write(path, contents) {
    await invoke("write_sketch_document", { uri: path, contents });
  },
};

export function sketchFileAdapterFor(path: string): SketchFileStoreAdapter {
  return /^content:\/\//i.test(path) ? androidSafSketchFileAdapter : desktopSketchFileAdapter;
}

/** Routes document I/O through the platform adapter selected for the authorized path. */
export const sketchFileStore = {
  adapter: sketchFileAdapterFor,

  authorize(path: string) {
    const normalized = normalizeFileUri(path);
    return sketchFileAdapterFor(normalized).authorize(normalized);
  },

  read(path: string) {
    return sketchFileAdapterFor(path).read(path);
  },

  write(path: string, contents: string, expected: string | null = null) {
    return sketchFileAdapterFor(path).write(path, contents, expected);
  },
};
