import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createCanvasHistory } = require(path.join(process.env.SKETCHDRAW_TEST_BUILD_DIR, "src/features/canvas/history.js"));

test("undo and redo keep per-page stacks isolated", () => {
  let current = ["first"];
  let dirty = false;
  let selected = [0];
  let version = 0;
  const history = createCanvasHistory({
    getCurrent: () => current,
    setCurrent: value => { current = value; },
    clone: value => [...value],
    canEdit: () => true,
    clearSelection: () => { selected = []; },
    markDirty: () => { dirty = true; },
    changed: () => { version += 1; },
  });
  history.push(["before edit"]);
  current = ["edited"];
  history.rememberPage("p1");
  history.resetCurrent();
  current = ["second page"];
  history.push(["empty second page"]);
  history.undo();
  assert.deepEqual(current, ["empty second page"]);
  history.restorePage("p1");
  history.undo();
  assert.deepEqual(current, ["before edit"]);
  assert.deepEqual(selected, []);
  assert.equal(dirty, true);
  assert.ok(version > 0);
});
