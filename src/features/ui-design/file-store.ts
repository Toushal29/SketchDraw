import { invoke } from "@tauri-apps/api/core";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { normalizeFileUri } from "../files/paths";

export function isUIDesignPath(path: string): boolean {
  let value = normalizeFileUri(path);
  for (let pass = 0; pass < 2; pass++) {
    try { const decoded = decodeURIComponent(value); if (decoded === value) break; value = decoded; }
    catch { break; }
  }
  return value.trim().toLowerCase().endsWith(".sdui");
}

export function withUIDesignExtension(path: string): string {
  const value = normalizeFileUri(path);
  if (/^content:\/\//i.test(value)) return value;
  if (!isUIDesignPath(value)) throw new Error("Choose a filename ending in .sdui.");
  return value;
}

export const uiDesignFileStore = {
  async authorize(path: string): Promise<string> {
    const normalized = normalizeFileUri(path);
    if (!isUIDesignPath(normalized) && !/^content:\/\//i.test(normalized)) throw new Error("Only .sdui files can be opened as UI Design documents.");
    return invoke<string>("authorize_ui_design_file", { path: normalized });
  },
  read(path: string): Promise<string> { return readTextFile(path); },
  async write(path: string, contents: string, expected: string | null): Promise<void> {
    if (/^content:\/\//i.test(path)) {
      await invoke("write_sketch_document", { uri: path, contents });
      return;
    }
    await invoke("atomic_save_ui_design", { path: normalizeFileUri(path), contents, expected });
  },
};
