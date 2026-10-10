import type { Element, SketchFile, SketchPage, WindowsSyncMetadata } from "../../model";

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const pageFields = (page: SketchPage) => ({ name: page.name, canvasState: page.canvasState });

function liveStamp(document: SketchFile, key: string): number {
  return document.windowsSync?.clocks[key] ?? document.windowsSync?.updatedAt ?? 0;
}

function deletionStamp(document: SketchFile, key: string): number | undefined {
  return document.windowsSync?.tombstones[key];
}

function chooseEntity<T>(leftDoc: SketchFile, rightDoc: SketchFile, key: string, left: T | undefined, right: T | undefined): T | undefined {
  if (left !== undefined && right !== undefined) {
    if (same(left, right)) return left;
    const leftAt = liveStamp(leftDoc, key);
    const rightAt = liveStamp(rightDoc, key);
    return leftAt === rightAt ? JSON.stringify(left) >= JSON.stringify(right) ? left : right : leftAt > rightAt ? left : right;
  }
  if (left !== undefined) return (deletionStamp(rightDoc, key) ?? -1) >= liveStamp(leftDoc, key) ? undefined : left;
  if (right !== undefined) return (deletionStamp(leftDoc, key) ?? -1) >= liveStamp(rightDoc, key) ? undefined : right;
  return undefined;
}

function latestMap(left: Record<string, number>, right: Record<string, number>) {
  const result = { ...left };
  for (const [key, value] of Object.entries(right)) result[key] = Math.max(result[key] ?? 0, value);
  return result;
}

function snapshotEntries(snapshot: SketchFile): Map<string, string> {
  const entries = new Map<string, string>();
  for (const page of snapshot.pages) {
    entries.set(`p:${page.id}`, JSON.stringify(pageFields(page)));
    for (const element of page.elements) if (element.id) entries.set(`e:${page.id}:${element.id}`, JSON.stringify(element));
  }
  return entries;
}

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

/** Tracks page and canvas element edits and deletions for shared-folder updates. */
export function createWindowsSyncTracker() {
  let observed = new Map<string, string>();

  function seed(snapshot: SketchFile) { observed = snapshotEntries(snapshot); }
  function reset() { observed = new Map(); }

  function initializeMetadata(snapshot: SketchFile, metadata = createWindowsSyncMetadata(), now = Date.now()) {
    if (snapshot.windowsSync) return snapshot.windowsSync;
    for (const key of snapshotEntries(snapshot).keys()) metadata.clocks[key] = now;
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

export function mergeLatestSnapshots(left: SketchFile, right: SketchFile): SketchFile {
  const leftMeta = left.windowsSync ?? { ...createWindowsSyncMetadata(), updatedAt: 0 };
  const rightMeta = right.windowsSync ?? { ...createWindowsSyncMetadata(), updatedAt: 0 };
  const clocks = latestMap(leftMeta.clocks, rightMeta.clocks);
  const tombstones = latestMap(leftMeta.tombstones, rightMeta.tombstones);
  const orderedPageIds = [...left.pages.map(page => page.id), ...right.pages.map(page => page.id).filter(id => !left.pages.some(page => page.id === id))];
  const pages: SketchPage[] = [];

  for (const pageId of orderedPageIds) {
    const leftPage = left.pages.find(page => page.id === pageId);
    const rightPage = right.pages.find(page => page.id === pageId);
    const pageKey = `p:${pageId}`;
    const shell = chooseEntity(left, right, pageKey, leftPage && pageFields(leftPage), rightPage && pageFields(rightPage));
    if (!shell) {
      const deletedAt = Math.max(deletionStamp(left, pageKey) ?? 0, deletionStamp(right, pageKey) ?? 0);
      if (deletedAt) { tombstones[pageKey] = deletedAt; delete clocks[pageKey]; }
      continue;
    }
    clocks[pageKey] = Math.max(leftPage ? liveStamp(left, pageKey) : 0, rightPage ? liveStamp(right, pageKey) : 0);
    delete tombstones[pageKey];
    const leftElements = new Map((leftPage?.elements ?? []).flatMap(element => element.id ? [[element.id, element] as const] : []));
    const rightElements = new Map((rightPage?.elements ?? []).flatMap(element => element.id ? [[element.id, element] as const] : []));
    const elements: Element[] = [];
    for (const id of new Set([...leftElements.keys(), ...rightElements.keys()])) {
      const key = `e:${pageId}:${id}`;
      const selected = chooseEntity(left, right, key, leftElements.get(id), rightElements.get(id));
      if (selected) {
        elements.push(selected);
        clocks[key] = Math.max(leftElements.has(id) ? liveStamp(left, key) : 0, rightElements.has(id) ? liveStamp(right, key) : 0);
        delete tombstones[key];
      } else {
        const deletedAt = Math.max(deletionStamp(left, key) ?? 0, deletionStamp(right, key) ?? 0);
        if (deletedAt) { tombstones[key] = deletedAt; delete clocks[key]; }
      }
    }
    pages.push({ id: pageId, ...shell, elements });
  }

  const newer = leftMeta.updatedAt === rightMeta.updatedAt
    ? leftMeta.deviceId >= rightMeta.deviceId ? leftMeta : rightMeta
    : leftMeta.updatedAt > rightMeta.updatedAt ? leftMeta : rightMeta;
  const preferredActivePage = newer === leftMeta ? left.activePageId : right.activePageId;
  const activePageId = pages.some(page => page.id === preferredActivePage) ? preferredActivePage : pages[0]?.id ?? left.activePageId;
  return {
    format: "SketchDraw", version: 10, activePageId, pages,
    windowsSync: { version: 1, updatedAt: Math.max(leftMeta.updatedAt, rightMeta.updatedAt), deviceId: newer.deviceId, clocks, tombstones },
  };
}
