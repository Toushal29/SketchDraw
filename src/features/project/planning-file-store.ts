import { invoke } from "@tauri-apps/api/core";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { isPlanningPath, normalizeFileUri } from "../files/paths";

export const planningFileStore = {
  async authorize(path: string): Promise<string> {
    const normalized = normalizeFileUri(path);
    if (!isPlanningPath(normalized)) throw new Error("Only .sdplan files can be opened as Planning documents.");
    return invoke<string>("authorize_planning_file", { path: normalized });
  },

  read(path: string): Promise<string> {
    return readTextFile(path);
  },

  async write(path: string, contents: string, expected: string | null): Promise<void> {
    if (/^content:\/\//i.test(path)) {
      await invoke("write_sketch_document", { uri: path, contents });
      return;
    }
    await invoke("atomic_save_planning", { path: normalizeFileUri(path), contents, expected });
  },
};
