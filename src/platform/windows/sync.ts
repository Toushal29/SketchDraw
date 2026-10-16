import type { PersonalLibraryData, ProjectWorkspaceData, SketchFile, WindowsSyncMetadata } from "../../model";

export { mergeLatestSnapshots } from "../../features/files/snapshot-merge";

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
  const project = snapshot.project ?? emptyProject();
  const library = snapshot.library ?? emptyLibrary();
  current.set("w:meta", JSON.stringify({ name: project.name, description: project.description }));
  for (const note of project.notes) current.set(`w:n:${note.id}`, JSON.stringify(note));
  for (const task of project.tasks) current.set(`w:t:${task.id}`, JSON.stringify(task));
  for (const item of project.checklist ?? []) current.set(`w:c:${item.id}`, JSON.stringify(item));
  for (const milestone of project.milestones) current.set(`w:m:${milestone.id}`, JSON.stringify(milestone));
  for (const entry of project.logEntries) current.set(`w:l:${entry.id}`, JSON.stringify(entry));
  for (const file of project.files) current.set(`w:f:${file.id}`, JSON.stringify(file));
  for (const note of library.quickNotes) current.set(`w:quick-note:${note.id}`, JSON.stringify(note));
  for (const note of library.studyNotes) current.set(`w:sn:${note.id}`, JSON.stringify(note));
  for (const card of library.studyCards) current.set(`w:sc:${card.id}`, JSON.stringify(card));
  for (const article of library.wikiArticles) current.set(`w:wiki:${article.id}`, JSON.stringify(article));
  for (const entry of library.journalEntries) current.set(`w:journal:${entry.id}`, JSON.stringify(entry));
  for (const draft of library.writingDrafts) current.set(`w:writing:${draft.id}`, JSON.stringify(draft));
  for (const source of library.researchSources) current.set(`w:research:${source.id}`, JSON.stringify(source));
  for (const entry of library.mediaEntries) current.set(`w:media:${entry.id}`, JSON.stringify(entry));
  return current;
}

function emptyProject(): ProjectWorkspaceData {
  return { name: "Untitled project", description: "", notes: [], tasks: [], checklist: [], milestones: [], logEntries: [], files: [] };
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
