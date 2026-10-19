import { parseSketchFile } from "../files/parse-sketch";

export type NamedDocumentSnapshot = { id: string; name: string; createdAt: number; contents: string };
const storageKey = (path: string) => `sketchdraw-named-snapshots:${path}`;

export function readNamedDocumentSnapshots(path: string): NamedDocumentSnapshot[] {
  try {
    const raw = localStorage.getItem(storageKey(path)); if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is NamedDocumentSnapshot => !!item && typeof item === "object"
      && typeof item.id === "string" && typeof item.name === "string" && typeof item.createdAt === "number" && typeof item.contents === "string").slice(0, 10);
  } catch { return []; }
}

export function writeNamedDocumentSnapshots(path: string, snapshots: NamedDocumentSnapshot[]) {
  localStorage.setItem(storageKey(path), JSON.stringify(snapshots.slice(0, 10)));
}

export function serializePortableNamedSnapshots(snapshots: NamedDocumentSnapshot[]): string {
  return JSON.stringify({ format: "SketchDrawNamedVersions", version: 1, snapshots: snapshots.slice(0, 10) }, null, 2);
}

export function parsePortableNamedSnapshots(source: string): NamedDocumentSnapshot[] {
  if (source.length > 100_000_000) throw new Error("Portable versions file is limited to 100 MB.");
  let value: unknown;
  try { value = JSON.parse(source); } catch { throw new Error("Portable versions file is not valid JSON."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Portable versions file has an unsupported format.");
  const root = value as Record<string, unknown>;
  if (root.format !== "SketchDrawNamedVersions" || root.version !== 1 || !Array.isArray(root.snapshots)) throw new Error("Choose a SketchDraw named versions export.");
  const snapshots = root.snapshots.flatMap((item): NamedDocumentSnapshot[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (typeof record.name !== "string" || !record.name.trim() || record.name.length > 80 || typeof record.createdAt !== "number" || !Number.isFinite(record.createdAt) || typeof record.contents !== "string" || record.contents.length > 20_000_000 || !parseSketchFile(record.contents)) return [];
    return [{ id: typeof record.id === "string" ? record.id.slice(0, 100) : crypto.randomUUID(), name: record.name.trim(), createdAt: record.createdAt, contents: record.contents }];
  }).slice(0, 10);
  if (!snapshots.length) throw new Error("No valid SketchDraw versions were found in this file.");
  return snapshots;
}

/** A compact page/object diff for a named snapshot against the open document. */
export function compareNamedDocumentSnapshot(beforeRaw: string, currentRaw: string): string[] {
  const before = parseSketchFile(beforeRaw); const current = parseSketchFile(currentRaw);
  if (!before || !current) return ["This saved version could not be compared with the current document."];
  const beforePages = new Map(before.pages.map(page => [page.id, page])); const currentPages = new Map(current.pages.map(page => [page.id, page]));
  const lines: string[] = [];
  for (const page of current.pages) {
    const old = beforePages.get(page.id);
    if (!old) { lines.push(`Added page: ${page.name}`); continue; }
    const oldItems = new Map(old.elements.flatMap(item => item.id ? [[item.id, item] as const] : []));
    const nextItems = new Map(page.elements.flatMap(item => item.id ? [[item.id, item] as const] : []));
    const added = [...nextItems.keys()].filter(id => !oldItems.has(id)).length;
    const removed = [...oldItems.keys()].filter(id => !nextItems.has(id)).length;
    const changed = [...nextItems].filter(([id, item]) => oldItems.has(id) && JSON.stringify(item) !== JSON.stringify(oldItems.get(id))).length;
    if (added || removed || changed || old.name !== page.name) lines.push(`${page.name}: ${added} added, ${removed} removed, ${changed} changed${old.name !== page.name ? ` (renamed from ${old.name})` : ""}`);
  }
  for (const page of before.pages) if (!currentPages.has(page.id)) lines.push(`Removed page: ${page.name}`);
  return lines.length ? lines : ["No page or object changes detected."];
}
