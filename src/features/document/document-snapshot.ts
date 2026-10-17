import type { SketchFile, WindowsSyncMetadata } from "../../model";
import { createSketchSnapshot } from "../files/document-codec";
import { createWindowsSyncMetadata, createWindowsSyncTracker, getWindowsDeviceId } from "../../platform/windows/sync";

type SnapshotOptions = Parameters<typeof createSketchSnapshot>[0];
type DocumentSnapshotPorts = {
  readDocument: () => Omit<SnapshotOptions, "windowsSync">;
  activePath: () => string | undefined;
  revision: () => number;
  windowsSyncMetadata: () => WindowsSyncMetadata | undefined;
  setWindowsSyncMetadata: (metadata: WindowsSyncMetadata | undefined) => void;
};

/** Builds persisted document snapshots and records Windows sync clocks once per edit. */
export function createDocumentSnapshotCoordinator(ports: DocumentSnapshotPorts) {
  const tracker = createWindowsSyncTracker();
  let lastObservedPath: string | undefined;
  let lastObservedRevision = -1;
  let cachedSnapshot: { path: string | undefined; revision: number; document: SketchFile } | undefined;

  function invalidate() {
    lastObservedPath = undefined;
    lastObservedRevision = -1;
    cachedSnapshot = undefined;
  }

  function observe(snapshot: SketchFile) {
    const path = ports.activePath();
    const revision = ports.revision();
    if (!path || (lastObservedPath === path && lastObservedRevision === revision)) return;
    const next = tracker.observe(snapshot, ports.windowsSyncMetadata() ?? createWindowsSyncMetadata(), getWindowsDeviceId());
    lastObservedPath = path;
    lastObservedRevision = revision;
    if (next) ports.setWindowsSyncMetadata(next);
  }

  function currentDocument(): SketchFile {
    const path = ports.activePath();
    const revision = ports.revision();
    const cached = cachedSnapshot;
    if (cached && cached.path === path && cached.revision === revision) return cached.document;
    const document = createSketchSnapshot({ ...ports.readDocument(), windowsSync: ports.windowsSyncMetadata() });
    cachedSnapshot = { path, revision, document };
    return document;
  }

  function snapshot(): SketchFile {
    const document = currentDocument();
    observe(document);
    const metadata = ports.windowsSyncMetadata();
    return { ...document, ...(metadata ? { windowsSync: metadata } : {}) };
  }

  function observeCurrent() {
    const path = ports.activePath();
    const revision = ports.revision();
    if (!path || (lastObservedPath === path && lastObservedRevision === revision)) return;
    observe(currentDocument());
  }

  function seed(document: SketchFile) {
    tracker.seed(document);
    invalidate();
  }

  function reset() {
    tracker.reset();
    invalidate();
  }

  function initializeMetadata(document: SketchFile, metadata = createWindowsSyncMetadata()) {
    return tracker.initializeMetadata(document, metadata);
  }

  return { snapshot, observeCurrent, seed, reset, initializeMetadata, invalidate };
}
