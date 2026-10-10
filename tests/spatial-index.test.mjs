import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const build = process.env.SKETCHDRAW_TEST_BUILD_DIR;
const { ElementSpatialIndex } = require(path.join(build, "src/features/canvas/spatial-index.js"));

function rectangle(x, y, w = 20, h = 20) {
  return { type: "rectangle", x, y, w, h, color: "#222222", thickness: 2 };
}

test("spatial index returns viewport candidates in original scene order", () => {
  const elements = Array.from({ length: 200 }, (_, index) => rectangle(index * 100, index % 3 * 100));
  const index = new ElementSpatialIndex(elements);
  assert.deepEqual(index.query({ x: 9_900, y: 0, w: 150, h: 120 }), [99, 100]);
});

test("spatial index finds large and negative-coordinate objects", () => {
  const elements = [rectangle(-20_000, -20_000, 20_000, 20_000), ...Array.from({ length: 100 }, (_, index) => rectangle(10_000 + index * 100, 10_000))];
  const index = new ElementSpatialIndex(elements);
  assert.deepEqual(index.query({ x: -5, y: -5, w: 10, h: 10 }), [0]);
  assert.deepEqual(index.query({ x: 19_900, y: 10_000, w: 5, h: 5 }), [100]);
});

test("linear and indexed queries agree for small scenes and preserve overlaps", () => {
  const elements = [rectangle(0, 0), rectangle(10, 10), rectangle(10, 10)];
  const index = new ElementSpatialIndex(elements);
  assert.deepEqual(index.query({ x: 15, y: 15, w: 0, h: 0 }), [0, 1, 2]);
  assert.deepEqual(index.query({ x: 50, y: 50, w: 1, h: 1 }), []);
});
