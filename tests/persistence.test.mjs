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

function emptyProject() {
  return { name: "Project", description: "", notes: [], tasks: [], milestones: [], logEntries: [], files: [] };
}

function validSketchSnapshot(library) {
  return {
    format: "SketchDraw", version: 9, activePageId: "p1",
    pages: [{ id: "p1", name: "Page 1", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff", boardColorFollowsTheme: true }, elements: [] }],
    project: emptyProject(), library,
  };
}

test("opens a v5 file and normalizes it to the current v9 document model", () => {
  const parsed = parseSketchFile({
    format: "SketchDraw", version: 5,
    pages: [{ id: "old-page", name: "Old page", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" }, elements: [
      { type: "rectangle", x: 10, y: 20, w: 80, h: 50, color: "#333333", thickness: 2 },
    ] }],
  });
  assert.ok(parsed);
  assert.equal(parsed.version, 9);
  assert.equal(parsed.pages[0].id, "old-page");
  assert.equal(parsed.pages[0].canvasState.boardColorFollowsTheme, true);
  assert.equal(typeof parsed.pages[0].elements[0].id, "string");
});

test("rejects a stroke whose point count exceeds the input budget", () => {
  const document = validSketchSnapshot({ quickNotes: [], studyNotes: [], studyCards: [], wikiArticles: [], journalEntries: [], writingDrafts: [], researchSources: [], mediaEntries: [] });
  document.pages[0].elements = [{ type: "freehand", id: "large-stroke", points: Array.from({ length: 100_001 }, () => ({ x: 0, y: 0 })), color: "#202124", thickness: 2 }];
  assert.equal(parseSketchFile(document), undefined);
});

test("rejects canvas text beyond the per-element size limit", () => {
  const document = validSketchSnapshot({ quickNotes: [], studyNotes: [], studyCards: [], wikiArticles: [], journalEntries: [], writingDrafts: [], researchSources: [], mediaEntries: [] });
  document.pages[0].elements = [{ type: "text", id: "large-text", x: 0, y: 0, text: "x".repeat(100_001), color: "#202124", fontSize: 14 }];
  assert.equal(parseSketchFile(document), undefined);
});

test("prevents saving a document that exceeds the reopenable stroke budget", () => {
  const document = validSketchSnapshot({ quickNotes: [], studyNotes: [], studyCards: [], wikiArticles: [], journalEntries: [], writingDrafts: [], researchSources: [], mediaEntries: [] });
  document.pages[0].elements = Array.from({ length: 11 }, (_, index) => ({ type: "freehand", id: `stroke-${index}`, points: new Array(100_000), color: "#202124", thickness: 2 }));
  assert.match(sketchFileResourceError(document), /point save limit/);
});

test("reads v8 documents and migrates Notebook and all retired Library records into v9", () => {
  const library = {
    quickNotes: [{ id: "q1", title: "Quick", content: "Keep this", createdAt: 1, updatedAt: 2 }],
    studyNotes: [{ id: "sn1", title: "Study", content: "Legacy note", createdAt: 1, updatedAt: 2 }],
    studyCards: [{ id: "sc1", front: "A", back: "B", dueAt: 3, intervalDays: 1, easeFactor: 2.5, repetitions: 1, createdAt: 1, updatedAt: 2 }],
    wikiArticles: [{ id: "w1", title: "Wiki", content: "Article", tags: ["old"], createdAt: 1, updatedAt: 2 }],
    journalEntries: [{ id: "j1", date: "2024-01-01", prompt: "", mood: "good", content: "Entry", createdAt: 1, updatedAt: 2 }],
    writingDrafts: [{ id: "wd1", title: "Draft", outline: "", content: "Text", revisions: [], createdAt: 1, updatedAt: 2 }],
    researchSources: [{ id: "r1", title: "Source", url: "", author: "", year: "", citation: "", quote: "", notes: "", tags: [], createdAt: 1, updatedAt: 2 }],
    mediaEntries: [{ id: "m1", title: "Media", kind: "book", status: "complete", notes: "", createdAt: 1, updatedAt: 2 }],
  };
  const current = validSketchSnapshot(library);
  const parsedV8 = parseSketchFile({
    format: "SketchDraw", version: 8,
    sections: {
      canvas: { activePageId: current.activePageId, pages: current.pages },
      planning: current.project,
      library,
    },
  });
  assert.ok(parsedV8);
  assert.equal(parsedV8.version, 9);
  assert.deepEqual(parsedV8.library, library);

  const savedRaw = serializeSketchSnapshot(parsedV8);
  const saved = JSON.parse(savedRaw);
  assert.equal(saved.version, 9);
  assert.deepEqual(saved.sections.notebook.notes, library.quickNotes);
  assert.equal("library" in saved.sections, false);
  assert.deepEqual(saved.sections.retiredLibraryArchive, {
    studyNotes: library.studyNotes,
    studyCards: library.studyCards,
    wikiArticles: library.wikiArticles,
    journalEntries: library.journalEntries,
    writingDrafts: library.writingDrafts,
    researchSources: library.researchSources,
    mediaEntries: library.mediaEntries,
  });
  const reopened = parseSketchFile(JSON.parse(savedRaw));
  assert.ok(reopened);
  assert.deepEqual(reopened.library, library);
});

test("recovery storage restores interrupted work and flags a changed file baseline", () => {
  globalThis.localStorage = new MemoryStorage();
  const recovered = validSketchSnapshot({ quickNotes: [], studyNotes: [], studyCards: [], wikiArticles: [], journalEntries: [], writingDrafts: [], researchSources: [], mediaEntries: [] });
  recovered.pages[0].name = "Recovered page";
  const entry = { savedAt: 100, baselineRaw: "old file contents", snapshot: recovered };
  assert.equal(sketchRecoveryStore.write("/sketches/a.sketch", entry), true);
  const stored = sketchRecoveryStore.read("/sketches/a.sketch");
  assert.deepEqual(stored, entry);

  let applied;
  let conflict;
  let prompt = { path: "/sketches/a.sketch", snapshot: recovered, baselineRaw: entry.baselineRaw };
  let dirty = false;
  const conflicted = restoreDocumentRecovery(prompt, "new file contents", "canvas", {
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
  assert.deepEqual(conflict, { path: "/sketches/a.sketch", remote: "new file contents" });
  assert.equal(sketchRecoveryStore.read("/sketches/a.sketch"), undefined);
});
