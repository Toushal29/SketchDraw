import type { PersonalLibraryData, SketchFile, WindowsSyncMetadata } from "../../model";

export { mergeLatestSnapshots } from "../../features/files/snapshot-merge";

const librarySyncEntriesCache = new WeakMap<PersonalLibraryData, [string, string][]>();

export function getWindowsDeviceId() {
  try {
    let deviceId = localStorage.getItem("sketchdraw-windows-device-id");
    if (!deviceId) { deviceId = crypto.randomUUID(); localStorage.setItem("sketchdraw-windows-device-id", deviceId); }
    return deviceId;
  } catch { return crypto.randomUUID(); }
}

export function createWindowsSyncMetadata(previous?: WindowsSyncMetadata): WindowsSyncMetadata {
  return { version: 1, updatedAt: Date.now(), deviceId: getWindowsDeviceId(), clocks: { ...(previous?.clocks ?? {}) }, tombstones: { ...(previous?.tombstones ?? {}) } };
}

function snapshotEntries(snapshot: SketchFile): Map<string, string> {
  const current = new Map<string, string>();
  for (const page of snapshot.pages) {
    current.set(`p:${page.id}`, JSON.stringify({ name: page.name, canvasState: page.canvasState }));
    for (const element of page.elements) if (element.id) current.set(`e:${page.id}:${element.id}`, JSON.stringify(element));
  }
  const library = snapshot.library ?? emptyLibrary();
  for (const [key, value] of librarySyncEntries(library)) current.set(key, value);
  return current;
}

function librarySyncEntries(library: PersonalLibraryData): [string, string][] {
  const cached = librarySyncEntriesCache.get(library);
  if (cached) return cached;
  const entries: [string, string][] = [];
  for (const note of library.quickNotes) entries.push([`w:quick-note:${note.id}`, JSON.stringify(note)]);
  for (const note of library.studyNotes) entries.push([`w:sn:${note.id}`, JSON.stringify(note)]);
  for (const card of library.studyCards) entries.push([`w:sc:${card.id}`, JSON.stringify(card)]);
  for (const article of library.wikiArticles) entries.push([`w:wiki:${article.id}`, JSON.stringify(article)]);
  for (const entry of library.journalEntries) entries.push([`w:journal:${entry.id}`, JSON.stringify(entry)]);
  for (const draft of library.writingDrafts) entries.push([`w:writing:${draft.id}`, JSON.stringify(draft)]);
  for (const source of library.researchSources) entries.push([`w:research:${source.id}`, JSON.stringify(source)]);
  for (const entry of library.mediaEntries) entries.push([`w:media:${entry.id}`, JSON.stringify(entry)]);
  librarySyncEntriesCache.set(library, entries);
  return entries;
}

function emptyLibrary(): PersonalLibraryData {
  return { quickNotes: [], studyNotes: [], studyCards: [], wikiArticles: [], journalEntries: [], writingDrafts: [], researchSources: [], mediaEntries: [] };
}

/** Tracks per-record clocks and deletions while leaving file polling in the app shell. */
export function createWindowsSyncTracker() {
  let observed = new Map<string, string>();

  function seed(snapshot: SketchFile) {
    observed = snapshotEntries(snapshot);
  }

  function reset() {
    observed = new Map();
  }

  function initializeMetadata(snapshot: SketchFile, metadata = createWindowsSyncMetadata(), now = Date.now()) {
    if (snapshot.windowsSync) return snapshot.windowsSync;
    const current = snapshotEntries(snapshot);
    for (const key of current.keys()) metadata.clocks[key] = now;
    return metadata;
  }

  function observe(snapshot: SketchFile, previous: WindowsSyncMetadata, deviceId = getWindowsDeviceId(), now = Date.now()) {
    const current = snapshotEntries(snapshot);
    const clocks = { ...previous.clocks };
    const tombstones = { ...previous.tombstones };
    let changed = false;
    for (const [key, value] of current) {
      const old = observed.get(key);
      if (old !== undefined && old !== value) { clocks[key] = now; delete tombstones[key]; changed = true; }
      else if (old === undefined && !clocks[key] && !tombstones[key]) { clocks[key] = previous.updatedAt || now; changed = true; }
    }
    for (const key of observed.keys()) if (!current.has(key)) { tombstones[key] = now; delete clocks[key]; changed = true; }
    observed = current;
    return changed ? { version: 1 as const, updatedAt: now, deviceId, clocks, tombstones } : undefined;
  }

  return { seed, reset, initializeMetadata, observe };
}
