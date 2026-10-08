import type { Element, SketchFile, SketchPage, WindowsSyncMetadata } from "../../model";

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const pageFields = (page: SketchPage) => ({ name: page.name, canvasState: page.canvasState });

function liveStamp(document: SketchFile, key: string): number {
  const metadata = document.windowsSync;
  if (!metadata) return 0;
  return metadata.clocks[key] ?? metadata.updatedAt;
}

function deletionStamp(document: SketchFile, key: string): number | undefined {
  return document.windowsSync?.tombstones[key];
}

function latestLive<T>(leftDoc: SketchFile, rightDoc: SketchFile, key: string, left: T, right: T): T {
  const leftAt = liveStamp(leftDoc, key); const rightAt = liveStamp(rightDoc, key);
  if (leftAt !== rightAt) return leftAt > rightAt ? left : right;
  // Equal clocks are possible when device clocks have only millisecond
  // resolution. A serialized-value tie break makes every device converge.
  return JSON.stringify(left) >= JSON.stringify(right) ? left : right;
}

function chooseEntity<T>(leftDoc: SketchFile, rightDoc: SketchFile, key: string, left: T | undefined, right: T | undefined): T | undefined {
  if (left !== undefined && right !== undefined) return same(left, right) ? left : latestLive(leftDoc, rightDoc, key, left, right);
  if (left !== undefined) {
    const deletedAt = deletionStamp(rightDoc, key);
    return deletedAt !== undefined && deletedAt >= liveStamp(leftDoc, key) ? undefined : left;
  }
  if (right !== undefined) {
    const deletedAt = deletionStamp(leftDoc, key);
    return deletedAt !== undefined && deletedAt >= liveStamp(rightDoc, key) ? undefined : right;
  }
  return undefined;
}

function latestMap(left: Record<string, number>, right: Record<string, number>) {
  const result: Record<string, number> = { ...left };
  for (const [key, value] of Object.entries(right)) result[key] = Math.max(result[key] ?? 0, value);
  return result;
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

export function mergeLatestSnapshots(left: SketchFile, right: SketchFile): SketchFile {
  const leftMeta = left.windowsSync ?? { ...createWindowsSyncMetadata(), updatedAt: 0 };
  const rightMeta = right.windowsSync ?? { ...createWindowsSyncMetadata(), updatedAt: 0 };
  const orderedPageIds = [...left.pages.map(page => page.id), ...right.pages.map(page => page.id).filter(id => !left.pages.some(page => page.id === id))];
  const clocks = latestMap(leftMeta.clocks, rightMeta.clocks);
  const tombstones = latestMap(leftMeta.tombstones, rightMeta.tombstones);
  const pages: SketchPage[] = [];

  for (const pageId of orderedPageIds) {
    const leftPage = left.pages.find(page => page.id === pageId);
    const rightPage = right.pages.find(page => page.id === pageId);
    const pageKey = `p:${pageId}`;
    const selectedShell = chooseEntity(left, right, pageKey, leftPage && pageFields(leftPage), rightPage && pageFields(rightPage));
    if (!selectedShell) {
      const deletedAt = Math.max(deletionStamp(left, pageKey) ?? 0, deletionStamp(right, pageKey) ?? 0);
      if (deletedAt) { tombstones[pageKey] = deletedAt; delete clocks[pageKey]; }
      continue;
    }
    const pageClock = Math.max(leftPage ? liveStamp(left, pageKey) : 0, rightPage ? liveStamp(right, pageKey) : 0);
    clocks[pageKey] = pageClock; delete tombstones[pageKey];
    const leftElements = new Map((leftPage?.elements ?? []).flatMap(element => element.id ? [[element.id, element] as const] : []));
    const rightElements = new Map((rightPage?.elements ?? []).flatMap(element => element.id ? [[element.id, element] as const] : []));
    const elementIds = new Set([...leftElements.keys(), ...rightElements.keys()]);
    const elements: Element[] = [];
    for (const id of elementIds) {
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
    pages.push({ id: pageId, ...selectedShell, elements });
  }

  const newerDocument = leftMeta.updatedAt === rightMeta.updatedAt
    ? (leftMeta.deviceId >= rightMeta.deviceId ? leftMeta : rightMeta)
    : leftMeta.updatedAt > rightMeta.updatedAt ? leftMeta : rightMeta;
  const preferredActivePage = newerDocument === leftMeta ? left.activePageId : right.activePageId;
  const activePageId = pages.some(page => page.id === preferredActivePage) ? preferredActivePage : pages[0]?.id ?? left.activePageId;
  const windowsSync: WindowsSyncMetadata = {
    version: 1,
    updatedAt: Math.max(leftMeta.updatedAt, rightMeta.updatedAt),
    deviceId: newerDocument.deviceId,
    clocks,
    tombstones,
  };
  return { format: "SketchDraw", version: Math.max(left.version, right.version) as SketchFile["version"], activePageId, pages, windowsSync };
}
