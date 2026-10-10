import type { SketchFile } from "../../model";
import { parseSketchFile, sketchFileResourceError } from "./parse-sketch";
import { mergeLatestSnapshots } from "../../platform/windows/sync";
import { serializeSketchSnapshot } from "./document-codec";
import { sketchFileStore } from "./sketch-file-store";

export type OpenedSketchDocument = {
  path: string;
  rawText: string;
  snapshot: SketchFile;
};

export async function openSketchDocument(path: string): Promise<OpenedSketchDocument> {
  const authorizedPath = await sketchFileStore.authorize(path);
  const rawText = await sketchFileStore.read(authorizedPath);
  const raw: unknown = JSON.parse(rawText);
  const snapshot = parseSketchFile(raw);
  if (!snapshot) throw new Error("This file is invalid or uses an unsupported SketchDraw format.");
  return { path: authorizedPath, rawText, snapshot };
}

export function decodeSketchDocument(value: unknown): SketchFile | undefined {
  return parseSketchFile(value);
}

/** Writes a document through the storage adapter with both preflight and atomic conflict checks. */
export async function saveSketchDocument(path: string, snapshot: SketchFile, expectedRaw: string | null): Promise<{ contents: string; conflictRaw?: string }> {
  const resourceError = sketchFileResourceError(snapshot);
  if (resourceError) throw new Error(resourceError);
  const contents = serializeSketchSnapshot(snapshot);
  // Compare the version currently visible through the provider before writing.
  // SAF does not expose a universal conditional-write operation, but this
  // preflight catches external edits already visible to the selected URI.
  if (expectedRaw !== null && sketchFileStore.capabilities.supportsConflictPreflight) {
    const diskRaw = await sketchFileStore.read(path);
    if (diskRaw !== expectedRaw) return { contents, conflictRaw: diskRaw };
  }
  await sketchFileStore.write(path, contents, sketchFileStore.capabilities.supportsConditionalWrite ? expectedRaw : null);
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
