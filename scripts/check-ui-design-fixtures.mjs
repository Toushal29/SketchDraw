import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const sourcePath = path.join(root, "src", "features", "ui-design", "model.ts");
const module = { exports: {} };
const source = readFileSync(sourcePath, "utf8");
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
new Function("require", "module", "exports", code)(require, module, module.exports);

const {
  UI_DESIGN_MAX_ARTBOARDS,
  UI_DESIGN_MAX_BYTES,
  UI_DESIGN_MAX_NODES,
  createUIDesignDocument,
  normalizeUIDesignDocument,
  parseUIDesignDocument,
  serializeUIDesignDocument,
} = module.exports;

const document = createUIDesignDocument("Checkout flow");
document.pages[0].artboards[0].nodes.push({
  id: "button-1", kind: "button", x: 16, y: 24, width: 160, height: 44,
  text: "Continue", background: "#2563eb", foreground: "#ffffff", border: "#1d4ed8", fontSize: 16, radius: 8,
});
const serialized = serializeUIDesignDocument(document);
assert.deepEqual(parseUIDesignDocument(serialized), document, "a UI Design document round-trips through the standalone .sdui codec");
assert.equal(normalizeUIDesignDocument({ ...document, format: "SketchDraw" }), undefined, "Canvas documents are rejected by the UI Design parser");
assert.equal(normalizeUIDesignDocument({ ...document, version: 2 }), undefined, "unsupported UI Design versions are rejected");

const oldDocument = structuredClone(document);
delete oldDocument.pages[0].artboards[0].layoutGrid;
assert.deepEqual(normalizeUIDesignDocument(oldDocument).pages[0].artboards[0].layoutGrid, { visible: false, snap: false, columns: 12, gutter: 16, margin: 24 }, "older v1 artboards receive safe default guide settings");
const invalidGuideValues = structuredClone(document);
invalidGuideValues.pages[0].artboards[0].layoutGrid = { visible: true, snap: true, columns: 99, gutter: -4, margin: 900 };
assert.deepEqual(normalizeUIDesignDocument(invalidGuideValues).pages[0].artboards[0].layoutGrid, { visible: true, snap: true, columns: 24, gutter: 0, margin: 400 }, "guide settings are clamped to supported limits");

const duplicateIds = structuredClone(document);
duplicateIds.pages[0].artboards[0].nodes.push({ ...duplicateIds.pages[0].artboards[0].nodes[0], id: duplicateIds.pages[0].id });
assert.equal(normalizeUIDesignDocument(duplicateIds), undefined, "node IDs cannot collide with document structure IDs");

const tooManyBoards = structuredClone(document);
tooManyBoards.pages[0].artboards = Array.from({ length: UI_DESIGN_MAX_ARTBOARDS + 1 }, (_, index) => ({
  ...tooManyBoards.pages[0].artboards[0], id: `board-${index}`,
}));
assert.equal(normalizeUIDesignDocument(tooManyBoards), undefined, "artboard count is bounded");

const tooManyNodes = structuredClone(document);
const node = tooManyNodes.pages[0].artboards[0].nodes[0];
tooManyNodes.pages[0].artboards[0].nodes = Array.from({ length: UI_DESIGN_MAX_NODES + 1 }, (_, index) => ({ ...node, id: `node-${index}` }));
assert.equal(normalizeUIDesignDocument(tooManyNodes), undefined, "element count is bounded");

assert.throws(() => parseUIDesignDocument(" ".repeat(UI_DESIGN_MAX_BYTES + 1)), /20 MB limit/, "oversized UI Design files are rejected before JSON parsing");
assert.throws(() => parseUIDesignDocument("{}"), /does not match the \.sdui file format/, "unrecognized document data is rejected");

console.log("UI Design fixtures passed: standalone format round-trip, workspace/version isolation, guide defaults and bounds, duplicate IDs, count limits, and oversized-file rejection.");
