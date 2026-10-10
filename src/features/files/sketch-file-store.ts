import { invoke } from "@tauri-apps/api/core";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { normalizeFileUri } from "./paths";

/** File-system boundary for opening and saving portable .sketch documents. */
export const sketchFileStore = {
  authorize(path: string) {
    return invoke<string>("authorize_sketch_file", { path: normalizeFileUri(path) });
  },

  read(path: string) {
    return readTextFile(path);
  },

  async write(path: string, contents: string, expected: string | null = null) {
    if (/^content:\/\//i.test(path)) {
      await writeTextFile(path, contents);
      return;
    }
    await invoke("atomic_save_sketch", { path: normalizeFileUri(path), contents, expected });
  },
};
