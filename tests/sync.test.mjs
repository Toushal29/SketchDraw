import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const { mergeLatestSnapshots } = require(path.join(process.env.SKETCHDRAW_TEST_BUILD_DIR, "src/platform/windows/sync.js"));

function rectangle(id, color) {
  return { id, type: "rectangle", x: 10, y: 20, w: 80, h: 50, color, thickness: 2 };
}

function copy(elements, deviceId, updatedAt, clocks, tombstones = {}) {
  return {
    format: "SketchDraw", version: 8, activePageId: "p1",
    pages: [{ id: "p1", name: "Page 1", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" }, elements }],
    windowsSync: { version: 1, updatedAt, deviceId, clocks, tombstones },
  };
}

test("merges a concurrent edit and deletion from two synced copies", () => {
  const local = copy(
    [rectangle("edited", "#ff0000")],
    "device-a", 30,
    { "p:p1": 1, "e:p1:edited": 20 },
    { "e:p1:deleted": 30 },
  );
  const remote = copy(
    [rectangle("edited", "#0000ff"), rectangle("deleted", "#333333")],
    "device-b", 10,
    { "p:p1": 1, "e:p1:edited": 10, "e:p1:deleted": 10 },
  );

  const merged = mergeLatestSnapshots(local, remote);
  assert.equal(merged.pages[0].elements.find(element => element.id === "edited").color, "#ff0000");
  assert.equal(merged.pages[0].elements.some(element => element.id === "deleted"), false);
  assert.equal(merged.windowsSync.tombstones["e:p1:deleted"], 30);
});
