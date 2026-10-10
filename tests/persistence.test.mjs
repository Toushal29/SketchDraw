import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const build = process.env.SKETCHDRAW_TEST_BUILD_DIR;
const { parseSketchFile, sketchFileResourceError } = require(path.join(build, "src/features/files/parse-sketch.js"));
const { serializeSketchSnapshot } = require(path.join(build, "src/features/files/document-codec.js"));
const { sketchRecoveryStore } = require(path.join(build, "src/features/files/sketch-recovery-store.js"));
const { restoreDocumentRecovery } = require(path.join(build, "src/features/document/document-recovery.js"));

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function validSketchSnapshot() {
  return {
    format: "SketchDraw", version: 10, activePageId: "p1",
    pages: [{ id: "p1", name: "Page 1", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff", boardColorFollowsTheme: true }, elements: [] }],
  };
}

test("opens and normalizes the current canvas-only document format", () => {
  const parsed = parseSketchFile(validSketchSnapshot());
  assert.ok(parsed);
  assert.equal(parsed.version, 10);
  assert.equal(parsed.activePageId, "p1");
  assert.equal(parsed.pages[0].name, "Page 1");
});

test("rejects old formats and documents containing retired workspace data", () => {
  const current = validSketchSnapshot();
  assert.equal(parseSketchFile({ ...current, version: 9 }), undefined);
  assert.equal(parseSketchFile({ ...current, sections: { notebook: { notes: ["discarded"] } } }), undefined);
  assert.equal(parseSketchFile({ ...current, project: { notes: ["discarded"] } }), undefined);
  assert.equal(parseSketchFile({ ...current, library: { quickNotes: ["discarded"] } }), undefined);
  assert.equal(parseSketchFile({ ...current, retiredLibraryArchive: { records: ["discarded"] } }), undefined);

  const serialized = JSON.parse(serializeSketchSnapshot({ ...current, retiredLibraryArchive: { records: ["discarded"] } }));
  assert.equal(serialized.version, 10);
  assert.equal("sections" in serialized, false);
  assert.equal("project" in serialized, false);
  assert.equal("library" in serialized, false);
  assert.equal("retiredLibraryArchive" in serialized, false);
});

test("rejects a stroke whose point count exceeds the input budget", () => {
  const document = validSketchSnapshot();
  document.pages[0].elements = [{ type: "freehand", id: "large-stroke", points: Array.from({ length: 100_001 }, () => ({ x: 0, y: 0 })), color: "#202124", thickness: 2 }];
  assert.equal(parseSketchFile(document), undefined);
});

test("rejects canvas text beyond the per-element size limit", () => {
  const document = validSketchSnapshot();
  document.pages[0].elements = [{ type: "text", id: "large-text", x: 0, y: 0, text: "x".repeat(100_001), color: "#202124", fontSize: 14 }];
  assert.equal(parseSketchFile(document), undefined);
});

test("prevents saving a document that exceeds the reopenable stroke budget", () => {
  const document = validSketchSnapshot();
  document.pages[0].elements = Array.from({ length: 11 }, (_, index) => ({ type: "freehand", id: `stroke-${index}`, points: new Array(100_000), color: "#202124", thickness: 2 }));
  assert.match(sketchFileResourceError(document), /point save limit/);
});

test("recovery restores interrupted work and flags a changed file baseline", () => {
  globalThis.localStorage = new MemoryStorage();
  const recovered = validSketchSnapshot();
  recovered.pages[0].name = "Recovered page";
  const entry = { savedAt: 100, baselineRaw: "old file contents", snapshot: recovered };
  assert.equal(sketchRecoveryStore.write("/sketches/a.sketchdraw", entry), true);
  const stored = sketchRecoveryStore.read("/sketches/a.sketchdraw");
  assert.deepEqual(stored, entry);

  let applied;
  let conflict;
  let prompt = { path: "/sketches/a.sketchdraw", snapshot: recovered, baselineRaw: entry.baselineRaw };
  let dirty = false;
  const conflicted = restoreDocumentRecovery(prompt, "new file contents", {
    applySnapshot: (...args) => { applied = args; },
    removeRecovery: path => sketchRecoveryStore.remove(path),
    setDirty: value => { dirty = value; },
    setRecoveryPrompt: value => { prompt = value; },
    setConflict: value => { conflict = value; },
  });
  assert.equal(conflicted, true);
  assert.equal(applied[0].pages[0].name, "Recovered page");
  assert.equal(applied[2], "new file contents");
  assert.equal(dirty, true);
  assert.equal(prompt, undefined);
  assert.deepEqual(conflict, { path: "/sketches/a.sketchdraw", remote: "new file contents" });
  assert.equal(sketchRecoveryStore.read("/sketches/a.sketchdraw"), undefined);
});
