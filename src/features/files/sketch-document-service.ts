import type { SketchFile } from "../../model";
import { parseSketchFile } from "./parse-sketch";
import { mergeLatestSnapshots } from "../../platform/windows/sync";
import { serializeSketchSnapshot } from "./document-codec";
import { sketchFileStore } from "./sketch-file-store";

export type OpenedSketchDocument = {
  path: string;
  rawText: string;
  snapshot: SketchFile;
  needsMigration: boolean;
};

export async function openSketchDocument(path: string): Promise<OpenedSketchDocument> {
  const authorizedPath = await sketchFileStore.authorize(path);
  const rawText = await sketchFileStore.read(authorizedPath);
  const raw: unknown = JSON.parse(rawText);
  const snapshot = parseSketchFile(raw);
  if (!snapshot) throw new Error("This file is invalid or uses an unsupported SketchDraw format.");
  return { path: authorizedPath, rawText, snapshot, needsMigration: !!raw && typeof raw === "object" && "version" in raw && raw.version !== snapshot.version };
}

export function decodeSketchDocument(value: unknown): SketchFile | undefined {
  return parseSketchFile(value);
}

/** Writes a document through the storage adapter with both preflight and atomic conflict checks. */
export async function saveSketchDocument(path: string, snapshot: SketchFile, expectedRaw: string | null): Promise<{ contents: string; conflictRaw?: string }> {
  const contents = serializeSketchSnapshot(snapshot);
  if (expectedRaw !== null) {
    const diskRaw = await sketchFileStore.read(path);
    if (diskRaw !== expectedRaw) return { contents, conflictRaw: diskRaw };
  }
  await sketchFileStore.write(path, contents, expectedRaw);
  return { contents };
}

/** Parse and merge a shared-folder copy; malformed partial sync files are ignored. */
export function mergeSketchDocument(local: SketchFile, remoteRaw: string): { remote: SketchFile; merged: SketchFile } | undefined {
  try {
    const remote = parseSketchFile(JSON.parse(remoteRaw) as unknown);
    return remote ? { remote, merged: mergeLatestSnapshots(local, remote) } : undefined;
  } catch {
    return undefined;
  }
}
