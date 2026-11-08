import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodeRequire = createRequire(import.meta.url);
const moduleCache = new Map();

function loadTypeScript(relativePath) {
  const sourcePath = path.resolve(root, relativePath);
  if (moduleCache.has(sourcePath)) return moduleCache.get(sourcePath).exports;
  const module = { exports: {} };
  moduleCache.set(sourcePath, module);
  const code = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const localRequire = specifier => {
    if (specifier.startsWith(".")) {
      const candidate = path.resolve(path.dirname(sourcePath), specifier + ".ts");
      return loadTypeScript(path.relative(root, candidate));
    }
    return nodeRequire(specifier);
  };
  new Function("require", "module", "exports", code)(localRequire, module, module.exports);
  return module.exports;
}

const model = loadTypeScript("src/features/ui-design/model.ts");
const geometry = loadTypeScript("src/features/ui-design/geometry.ts");
const hierarchy = loadTypeScript("src/features/ui-design/hierarchy.ts");
const spatial = loadTypeScript("src/features/ui-design/spatial-index.ts");
const layout = loadTypeScript("src/features/ui-design/layout-engine.ts");
const {
  UI_DESIGN_FORMAT, UI_DESIGN_VERSION, UI_DESIGN_MAX_BYTES, UI_DESIGN_MAX_ELEMENTS,
  createUIDesignDocument, createUIElement, createUIFrame, normalizeUIDesignDocument, parseUIDesignDocument, serializeUIDesignDocument,
} = model;
const { UIHierarchyIndex, hierarchyIsValid } = hierarchy;
const { applyAutoLayout, resizeFrameChildren } = layout;

const document = createUIDesignDocument("Infinite interface");
const page = document.pages[0];
const group = createUIElement("group", 0, { x: 120, y: 80 }, page.id);
group.rotation = 90;
group.width = 420;
group.height = 260;
const nestedGroup = createUIElement("group", 0, { x: 30, y: 24 }, group.id);
nestedGroup.width = 300;
nestedGroup.height = 180;
const button = createUIElement("button", 0, { x: 20, y: 24 }, nestedGroup.id);
button.text = "Continue";
button.fillTokenId = document.colorTokens[0].id;
const text = createUIElement("text", 1, { x: 20, y: 80 }, nestedGroup.id);
text.text = "Account details";
const image = createUIElement("image", 2, { x: 160, y: 24 }, nestedGroup.id);
image.componentId = "component-avatar";
image.componentVariantId = "variant-compact";
group.order = 0;
nestedGroup.order = 0;
button.order = 0;
text.order = 1;
image.order = 2;
page.elements.push(group, nestedGroup, button, text, image);

const secondPage = structuredClone(page);
secondPage.id = "page-target";
secondPage.name = "Profile";
secondPage.activePrototypeFlowId = "flow-target";
secondPage.prototypeFlows = [{ id: "flow-target", name: "Profile flow", startPageId: secondPage.id }];
secondPage.elements = [];
document.pages.push(secondPage);
button.interactions = [{ id: "interaction-primary", name: "Continue to profile", trigger: "click", action: "navigate", targetPageId: secondPage.id, transition: "dissolve" }];

assert.equal(hierarchyIsValid(page.id, page.elements), true, "groups, shapes, text, images, and component instances share one valid page hierarchy");
const index = new UIHierarchyIndex(page.id, page.elements);
assert.deepEqual(index.ancestors(button.id).map(node => node.id), [nestedGroup.id, group.id], "a node resolves ancestry through nested groups");
assert.deepEqual(index.children(nestedGroup.id).map(node => node.id), [button.id, text.id, image.id], "siblings follow explicit layer order");
assert.deepEqual(index.flatten(page.id).map(node => node.id), [group.id, nestedGroup.id, button.id, text.id, image.id], "the page hierarchy flattens in layer order");

const expectedWorld = index.localToWorld(nestedGroup.id, { x: button.x, y: button.y });
assert.deepEqual(index.worldToLocal(nestedGroup.id, expectedWorld), { x: button.x, y: button.y }, "local and page-space conversions are inverse operations");
const beforeMove = index.worldTransform(button.id);
const reparented = index.reparent(button.id, page.id);
assert.ok(reparented, "a node can be moved from a group to the page root");
const reparentedIndex = new UIHierarchyIndex(page.id, [...page.elements.filter(node => node.id !== button.id), reparented]);
const afterMove = reparentedIndex.worldTransform(button.id);
assert.ok(Math.abs(afterMove.x - beforeMove.x) < 1e-8 && Math.abs(afterMove.y - beforeMove.y) < 1e-8 && afterMove.rotation === beforeMove.rotation, "reparenting preserves world position and rotation");
assert.equal(index.canReparent(group.id, button.id), false, "a node cannot be parented below its descendant");
assert.equal(index.hasSelectedAncestor(button.id, new Set([group.id])), true, "a group selection identifies descendant layers");
assert.equal(hierarchyIsValid(page.id, page.elements.map(node => node.id === nestedGroup.id ? { ...node, parentId: button.id } : node)), false, "hierarchy cycles are rejected");

const serialized = serializeUIDesignDocument(document);
const roundTrip = parseUIDesignDocument(serialized);
assert.equal(roundTrip.format, UI_DESIGN_FORMAT, "the independent UI Design file format round-trips");
assert.equal(roundTrip.version, UI_DESIGN_VERSION, "the page model writes the current .sdui version");
assert.deepEqual(roundTrip.pages[0].elements.map(item => [item.kind, item.parentId, item.order]), [
  ["group", page.id, 0], ["group", group.id, 0], ["button", nestedGroup.id, 0], ["text", nestedGroup.id, 1], ["image", nestedGroup.id, 2],
], "flat node storage preserves hierarchy links and layer order");
assert.equal(roundTrip.pages[0].elements[2].interactions[0].targetPageId, secondPage.id, "prototype links target pages");
assert.equal(normalizeUIDesignDocument({ ...document, format: "SketchDraw" }), undefined, "Canvas documents are rejected by the independent UI Design parser");
assert.equal(normalizeUIDesignDocument({ ...document, version: UI_DESIGN_VERSION - 1 }), undefined, "unknown older schemas are not silently migrated");

const invalidParent = structuredClone(document);
invalidParent.pages[0].elements[2].parentId = "missing-parent";
const repairedParent = normalizeUIDesignDocument(invalidParent);
assert.equal(repairedParent.pages[0].elements[2].parentId, repairedParent.pages[0].id, "orphaned imported nodes are repaired to page root without dropping content");
const invalidLink = structuredClone(document);
invalidLink.pages[0].elements[2].interactions[0].targetPageId = "missing-page";
assert.equal(normalizeUIDesignDocument(invalidLink).pages[0].elements[2].interactions.length, 0, "links to missing pages are removed at the file boundary");
const tooManyElements = structuredClone(document);
tooManyElements.pages[0].elements = Array.from({ length: UI_DESIGN_MAX_ELEMENTS + 1 }, (_, order) => ({ ...button, id: "element-" + order, parentId: tooManyElements.pages[0].id, order }));
assert.equal(normalizeUIDesignDocument(tooManyElements), undefined, "page element count is bounded");
assert.throws(() => parseUIDesignDocument(" ".repeat(UI_DESIGN_MAX_BYTES + 1)), /20 MB limit/, "oversized files are rejected before JSON parsing");
assert.throws(() => parseUIDesignDocument("{"), /valid JSON/, "malformed data produces a clear parse error");

assert.deepEqual(geometry.resizeElement({ ...button, x: 10, y: 20, width: 100, height: 80 }, "e", 20.25, 0), { x: 10, y: 20, width: 120, height: 80 }, "resizing rounds edges to whole CSS pixels");

const layoutPage = structuredClone(page);
layoutPage.elements = [];
const row = createUIElement("group", 0, { x: 0, y: 0 }, layoutPage.id, { width: 300, height: 120 });
row.autoLayout = { ...row.autoLayout, enabled: true, direction: "horizontal", gap: 10, paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8 };
const first = createUIElement("button", 0, { x: 90, y: 70 }, row.id, { width: 80, height: 32 });
const fill = createUIElement("input", 1, { x: 0, y: 0 }, row.id, { width: 40, height: 40 }); fill.widthSizing = "fill";
layoutPage.elements.push(row, first, fill);
const rowLayout = applyAutoLayout(layoutPage);
assert.deepEqual([rowLayout.elements[1].x, rowLayout.elements[1].y, rowLayout.elements[2].x, rowLayout.elements[2].width], [10, 8, 100, 190], "horizontal auto layout positions children and distributes fill width");
const tokenRow = { ...row, id: "token-row", autoLayout: { ...row.autoLayout, gap: 0, gapTokenId: "space-live", paddingLeft: 8, paddingRight: 8 } };
const tokenChildren = [first, { ...fill, id: "token-second", order: 1, widthSizing: "fixed", width: 80 }].map((item, order) => ({ ...item, parentId: tokenRow.id, order, width: 80, height: 32 }));
const tokenLayout = applyAutoLayout({ ...layoutPage, elements: [tokenRow, ...tokenChildren] }, [{ id: "space-live", name: "Live gap", value: 12, unit: "px" }]);
assert.equal(tokenLayout.elements[2].x - (tokenLayout.elements[1].x + tokenLayout.elements[1].width), 12, "auto-layout spacing tokens set the actual canvas gap");
const changedTokenLayout = applyAutoLayout({ ...layoutPage, elements: [tokenRow, ...tokenChildren] }, [{ id: "space-live", name: "Live gap", value: 20, unit: "px" }]);
assert.equal(changedTokenLayout.elements[2].x - (changedTokenLayout.elements[1].x + changedTokenLayout.elements[1].width), 20, "changing a spacing token reflows auto-layout children");
const wrapParent = { ...row, width: 190, autoLayout: { ...row.autoLayout, wrap: true, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 } };
const wrapChildren = [first, { ...fill, widthSizing: "fixed", width: 100 }].map((item, order) => ({ ...item, order, parentId: wrapParent.id, width: 100, height: 30 }));
const wrapped = applyAutoLayout({ ...layoutPage, elements: [wrapParent, ...wrapChildren] });
assert.equal(wrapped.elements[2].y > wrapped.elements[1].y, true, "horizontal wrap creates a new row when the next child does not fit");
const resized = resizeFrameChildren([{ ...first, parentId: row.id, x: 20, width: 60, constraints: { ...first.constraints, horizontal: "left-right" } }], row.id, { width: 100, height: 100 }, { width: 150, height: 120 });
assert.deepEqual([resized[0].x, resized[0].width], [20, 110], "frame resize applies edge constraints to direct children");
const outerFrame = createUIFrame(0, { x: 0, y: 0 }, layoutPage.id, "custom");
outerFrame.width = 200; outerFrame.height = 160;
const innerFrame = createUIFrame(0, { x: 10, y: 12 }, outerFrame.id, "custom");
innerFrame.width = 160; innerFrame.height = 120;
innerFrame.constraints = { ...innerFrame.constraints, horizontal: "left-right", vertical: "top-bottom" };
const nestedContent = createUIElement("rectangle", 0, { x: 20, y: 15 }, innerFrame.id, { width: 30, height: 25 });
nestedContent.constraints = { ...nestedContent.constraints, horizontal: "right", vertical: "bottom" };
const nestedResize = resizeFrameChildren([outerFrame, innerFrame, nestedContent], outerFrame.id, { width: 200, height: 160 }, { width: 250, height: 180 });
assert.deepEqual([nestedResize[1].width, nestedResize[1].height, nestedResize[2].x, nestedResize[2].y], [210, 140, 70, 35], "nested frame constraints propagate size changes to descendants in local coordinates");

const spatialIndex = new spatial.UIElementSpatialIndex([{ ...button, x: 10, y: 10 }, { ...button, id: "outside", x: 2000, y: 2000 }]);
assert.deepEqual(spatialIndex.query({ x: 0, y: 0, width: 100, height: 100 }).map(item => item.id), [button.id], "viewport queries return only spatially intersecting nodes");

console.log("UI Design fixtures passed: v1 .sdui schema, shared page/group/element hierarchy, ancestry, ordering, world/local transforms, safe reparenting, cycle and orphan repair, page prototype links, document bounds, whole-pixel resizing, auto layout flow/wrapping/fill, live spacing-token reflow, recursive nested-frame constraints, and viewport indexing.");
