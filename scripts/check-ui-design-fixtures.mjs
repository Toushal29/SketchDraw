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
const tokens = loadTypeScript("src/features/ui-design/tokens.ts");
const hierarchyOperations = loadTypeScript("src/features/ui-design/hierarchy-operations.ts");
const components = loadTypeScript("src/features/ui-design/components.ts");
const {
  UI_DESIGN_FORMAT, UI_DESIGN_VERSION, UI_DESIGN_MAX_BYTES, UI_DESIGN_MAX_ELEMENTS,
  createUIDesignDocument, createUIElement, createUIFrame, normalizeUIDesignDocument, parseUIDesignDocument, serializeUIDesignDocument,
} = model;
const { applyComponentVariant, captureComponentVariant, detachComponentInstance, resetComponentInstance, resetComponentNodeOverride, synchronizeComponentMasters, withComponentOverrides } = components;
const { UIHierarchyIndex, hierarchyIsValid } = hierarchy;
const { applyAutoLayout, resizeFrameChildren } = layout;
const { resolveColorToken, resolveTypographyToken, resolveValueToken, resolveEffectToken } = tokens;
const { groupHierarchyNodes, ungroupHierarchyNodes, duplicateHierarchyNodes, moveHierarchyNodes } = hierarchyOperations;

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
document.prototypeVariables = [{ id: "variable-logged-in", name: "Logged in", value: false }];
button.interactions.push({ id: "interaction-conditional", name: "Open account", trigger: "keyboard", action: "open-overlay", targetPageId: secondPage.id, transition: "slide-left", key: "Enter", condition: { variableId: "variable-logged-in", operator: "truthy" } });
document.colorTokens[0].modeValues = { "mode-dark": "#102030" };
document.typographyTokens[0].modeValues = { "mode-dark": { fontSize: 18, fontWeight: 600 } };
document.spacingTokens[0].modeValues = { "mode-dark": 12 };
document.radiusTokens[0].modeValues = { "mode-dark": 14 };
document.effectTokens[0].modeValues = { "mode-dark": "0 8px 20px #00000040" };

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

const rotatedFrame = createUIFrame(0, { x: 100, y: 100 }, page.id, "custom");
rotatedFrame.width = 100; rotatedFrame.height = 100; rotatedFrame.rotation = 30; rotatedFrame.clipContent = true;
const rotatedChild = createUIElement("rectangle", 0, { x: 80, y: 10 }, rotatedFrame.id, { width: 50, height: 20 });
rotatedChild.rotation = 15;
const transformedIndex = new UIHierarchyIndex(page.id, [rotatedFrame, rotatedChild]);
const childBounds = transformedIndex.worldBounds(rotatedChild.id);
const clippedBounds = transformedIndex.visibleWorldBounds(rotatedChild.id);
assert.equal(transformedIndex.worldTransform(rotatedChild.id)?.rotation, 45, "nested rotation accumulates through the hierarchy");
assert.ok(childBounds && clippedBounds && clippedBounds.width < childBounds.width, "rotated frame clipping reduces visible descendant bounds");
assert.equal(new UIHierarchyIndex(page.id, [{ ...rotatedFrame, hidden: true }, rotatedChild]).isEffectivelyHidden(rotatedChild.id), true, "hidden ancestors hide descendants");
assert.equal(new UIHierarchyIndex(page.id, [{ ...rotatedFrame, locked: true }, rotatedChild]).isEffectivelyLocked(rotatedChild.id), true, "locked ancestors lock descendants");
const constrained = resizeFrameChildren([{ ...rotatedChild, x: 12, width: 40, constraints: { ...rotatedChild.constraints, horizontal: "right", minWidth: 48, maxWidth: 60 } }], rotatedFrame.id, { width: 100, height: 100 }, { width: 120, height: 110 });
assert.deepEqual([constrained[0].x, constrained[0].width], [32, 48], "right constraints and minimum dimensions apply during parent resize");
const rotatedReparent = transformedIndex.reparent(rotatedChild.id, page.id);
assert.ok(rotatedReparent, "rotated descendants can be reparented to page root");
const afterRotatedReparent = new UIHierarchyIndex(page.id, [rotatedFrame, rotatedReparent]).worldTransform(rotatedChild.id);
assert.deepEqual(afterRotatedReparent, transformedIndex.worldTransform(rotatedChild.id), "reparent preserves nested world transform under rotation");

const groupParent = createUIFrame(0, { x: 240, y: 160 }, page.id, "custom");
groupParent.width = 360; groupParent.height = 260; groupParent.rotation = 27;
const groupA = createUIElement("rectangle", 0, { x: 24, y: 32 }, groupParent.id, { width: 80, height: 46 }); groupA.rotation = 12;
const groupB = createUIElement("text", 1, { x: 178, y: 104 }, groupParent.id, { width: 116, height: 34 }); groupB.rotation = -8;
groupA.interactions = [{ id: "group-link", name: "Internal target", trigger: "click", action: "navigate", targetNodeId: groupB.id, transition: "instant" }];
const groupInput = [groupParent, groupA, groupB];
const groupBefore = new UIHierarchyIndex(page.id, groupInput);
const groupAWorld = groupBefore.worldTransform(groupA.id);
const groupBWorld = groupBefore.worldTransform(groupB.id);
const groupContainer = createUIElement("group", 2, { x: 0, y: 0 }, page.id);
const groupedNodes = groupHierarchyNodes(page.id, groupInput, [groupA.id, groupB.id], groupContainer);
assert.ok(groupedNodes, "grouping creates one hierarchy container for multiple selected roots");
assert.equal(groupedNodes.length, groupInput.length + 1, "grouping reparents original nodes without duplicating layers");
const createdGroup = groupedNodes.find(node => node.id === groupContainer.id);
assert.ok(createdGroup && createdGroup.parentId === groupParent.id, "group remains under the shared parent frame");
const groupedIndex = new UIHierarchyIndex(page.id, groupedNodes);
const sameTransform = (actual, expected) => actual && expected && Math.abs(actual.x - expected.x) < 1e-8 && Math.abs(actual.y - expected.y) < 1e-8 && Math.abs(actual.rotation - expected.rotation) < 1e-8;
assert.deepEqual(groupedIndex.children(createdGroup.id).map(node => node.id), [groupA.id, groupB.id], "group children retain their original identities and order");
assert.equal(sameTransform(groupedIndex.worldTransform(groupA.id), groupAWorld), true, "grouping beneath a rotated frame preserves child world transform");
assert.equal(sameTransform(groupedIndex.worldTransform(groupB.id), groupBWorld), true, "all grouped children preserve their world transform");
let cloneCounter = 0;
const duplicatedGroup = duplicateHierarchyNodes(page.id, groupedNodes, [createdGroup.id], kind => `copy-${kind}-${++cloneCounter}`);
assert.equal(duplicatedGroup.nodes.length, groupedNodes.length + 3, "duplicating a group copies exactly the selected subtree");
const copiedGroupId = duplicatedGroup.selectedIds[0];
const copiedGroup = duplicatedGroup.nodes.find(node => node.id === copiedGroupId);
assert.ok(copiedGroup && copiedGroup.id !== createdGroup.id, "duplicated group receives a fresh identity");
const copiedChildren = duplicatedGroup.nodes.filter(node => node.parentId === copiedGroupId).sort((a, b) => a.order - b.order);
assert.equal(copiedChildren.length, 2, "duplicated group retains its complete child hierarchy");
assert.notEqual(copiedChildren[0].id, groupA.id, "duplicated child receives a fresh identity");
assert.equal(copiedChildren[0].interactions[0].targetNodeId, copiedChildren[1].id, "internal prototype links remap to the duplicated target");
const ungrouped = ungroupHierarchyNodes(page.id, groupedNodes, [createdGroup.id]);
assert.equal(ungrouped.nodes.some(node => node.id === createdGroup.id), false, "ungroup removes only the transparent container");
assert.equal(ungrouped.nodes.length, groupInput.length, "ungroup does not leave duplicate or orphan layers");
const ungroupedIndex = new UIHierarchyIndex(page.id, ungrouped.nodes);
assert.equal(sameTransform(ungroupedIndex.worldTransform(groupA.id), groupAWorld), true, "ungroup preserves child world transforms");
assert.equal(sameTransform(ungroupedIndex.worldTransform(groupB.id), groupBWorld), true, "ungroup preserves every child world transform");
const reordered = moveHierarchyNodes(page.id, groupedNodes, [groupA.id], groupB.id, false);
assert.ok(reordered, "a layer can be reordered within its sibling hierarchy");
assert.equal(reordered.find(node => node.id === groupA.id)?.parentId, createdGroup.id, "reorder keeps the layer in its current parent");
assert.ok(reordered.find(node => node.id === groupA.id).order < reordered.find(node => node.id === groupB.id).order, "drop after a sibling in layer-panel order gives groupA lower paint order");
assert.equal(moveHierarchyNodes(page.id, groupedNodes, [createdGroup.id], groupA.id, true), undefined, "a container cannot be moved into its own descendant");

const serialized = serializeUIDesignDocument(document);
const roundTrip = parseUIDesignDocument(serialized);
assert.equal(roundTrip.format, UI_DESIGN_FORMAT, "the independent UI Design file format round-trips");
assert.equal(roundTrip.version, UI_DESIGN_VERSION, "the page model writes the current .sdui version");
assert.deepEqual(roundTrip.pages[0].elements.map(item => [item.kind, item.parentId, item.order]), [
  ["group", page.id, 0], ["group", group.id, 0], ["button", nestedGroup.id, 0], ["text", nestedGroup.id, 1], ["image", nestedGroup.id, 2],
], "flat node storage preserves hierarchy links and layer order");
assert.equal(roundTrip.pages[0].elements[2].interactions[0].targetPageId, secondPage.id, "prototype links target pages");
assert.equal(roundTrip.prototypeVariables[0].value, false, "prototype variables persist in the .sdui document");
assert.equal(roundTrip.pages[0].elements[2].interactions[1].condition.variableId, "variable-logged-in", "prototype conditions retain variable references");
assert.equal(roundTrip.colorTokens[0].modeValues["mode-dark"], "#102030", "color modes persist through the document codec");
assert.equal(roundTrip.typographyTokens[0].modeValues["mode-dark"].fontSize, 18, "typography modes persist through the document codec");
assert.equal(roundTrip.spacingTokens[0].modeValues["mode-dark"], 12, "spacing modes persist through the document codec");
assert.equal(roundTrip.radiusTokens[0].modeValues["mode-dark"], 14, "radius modes persist through the document codec");
assert.equal(roundTrip.effectTokens[0].modeValues["mode-dark"], "0 8px 20px #00000040", "effect modes persist through the document codec");
assert.equal(normalizeUIDesignDocument({ ...document, format: "SketchDraw" }), undefined, "Canvas documents are rejected by the independent UI Design parser");
assert.equal(normalizeUIDesignDocument({ ...document, version: UI_DESIGN_VERSION - 1 }), undefined, "unknown older schemas are not silently migrated");

const legacyComponentDocument = structuredClone(document);
const legacyPage = legacyComponentDocument.pages[0];
const legacyComponentId = "legacy-component";
const legacyMaster = createUIElement("group", legacyPage.elements.length, { x: 12, y: 18 }, legacyPage.id);
legacyMaster.name = "Master group";
legacyMaster.componentId = legacyComponentId;
const legacyMasterChild = createUIElement("button", 0, { x: 8, y: 10 }, legacyMaster.id);
legacyMasterChild.text = "Master button";
const legacyInstance = { ...structuredClone(legacyMaster), id: "legacy-instance", kind: "componentInstance", componentId: legacyComponentId, parentId: legacyPage.id, order: legacyPage.elements.length + 1, x: 180, y: 40, componentSourceId: "" };
const legacyInstanceChild = { ...structuredClone(legacyMasterChild), id: "legacy-instance-child", parentId: legacyInstance.id, componentSourceId: "" };
legacyMasterChild.parentId = legacyMaster.id;
legacyMasterChild.componentSourceId = "";
legacyMaster.componentSourceId = "";
legacyPage.elements.push(legacyMaster, legacyMasterChild, legacyInstance, legacyInstanceChild);
legacyComponentDocument.components = [{
  id: legacyComponentId, name: legacyMaster.name,
  root: { ...structuredClone(legacyMaster), id: `${legacyComponentId}-root`, parentId: "component-root", componentSourceId: "" },
  children: [{ ...structuredClone(legacyMasterChild), id: `${legacyComponentId}-${legacyMasterChild.id}`, parentId: `${legacyComponentId}-root`, componentSourceId: "" }],
  variants: [{ id: "legacy-default", name: "Default", properties: {} }],
}];
const normalizedLegacyComponent = normalizeUIDesignDocument(legacyComponentDocument);
assert.ok(normalizedLegacyComponent, "legacy component documents normalize without dropping their hierarchy");
const normalizedLegacyPage = normalizedLegacyComponent.pages[0];
assert.equal(normalizedLegacyComponent.components[0].root.componentSourceId, legacyMaster.id, "legacy component root snapshot links to its live master node");
assert.equal(normalizedLegacyComponent.components[0].children[0].componentSourceId, legacyMasterChild.id, "legacy component child snapshot recovers its source identity");
assert.equal(normalizedLegacyPage.elements.find(item => item.id === legacyInstance.id).componentSourceId, legacyMaster.id, "legacy instance root is linked to its component source");
assert.equal(normalizedLegacyPage.elements.find(item => item.id === legacyInstanceChild.id).componentSourceId, legacyMasterChild.id, "legacy nested instance child is linked to its component source");
const malformedComponent = structuredClone(legacyComponentDocument);
malformedComponent.components[0].children[0].parentId = "missing-node";
assert.equal(normalizeUIDesignDocument(malformedComponent), undefined, "malformed component hierarchy is rejected instead of silently losing children");

// Component sync uses stable source identities across nested trees and pages.
const componentSyncDocument = createUIDesignDocument("Component sync fixture");
const componentMasterPage = componentSyncDocument.pages[0];
const syncComponentId = "component-sync-fixture";
const masterRoot = createUIElement("group", 0, { x: 20, y: 30 }, componentMasterPage.id);
Object.assign(masterRoot, { name: "Card master", componentId: syncComponentId, componentSourceId: "source-root" });
const masterFrame = createUIElement("frame", 0, { x: 8, y: 10 }, masterRoot.id);
Object.assign(masterFrame, { name: "Content", componentSourceId: "source-frame" });
const masterLabel = createUIElement("text", 0, { x: 4, y: 5 }, masterFrame.id);
Object.assign(masterLabel, { name: "Title", text: "Original title", componentSourceId: "source-label" });
const masterRemoved = createUIElement("rectangle", 1, { x: 20, y: 5 }, masterFrame.id);
Object.assign(masterRemoved, { componentSourceId: "source-removed" });
componentMasterPage.elements.push(masterRoot, masterFrame, masterLabel, masterRemoved);
const defaultVariant = { id: "sync-default", name: "Default", properties: {} };
const componentTemplate = {
  id: syncComponentId,
  name: "Card master",
  root: { ...structuredClone(masterRoot), id: "template-root", parentId: "component-root", componentSourceId: "source-root" },
  children: [
    { ...structuredClone(masterFrame), id: "template-frame", parentId: "template-root", componentSourceId: "source-frame" },
    { ...structuredClone(masterLabel), id: "template-label", parentId: "template-frame", componentSourceId: "source-label" },
    { ...structuredClone(masterRemoved), id: "template-removed", parentId: "template-frame", componentSourceId: "source-removed" },
  ],
  variants: [defaultVariant],
};
const makeComponentInstancePage = (pageId, suffix) => {
  const page = { ...structuredClone(componentMasterPage), id: pageId, name: `Page ${suffix}`, elements: [], prototypeFlows: [{ id: `flow-${suffix}`, name: "Flow", startPageId: pageId }], activePrototypeFlowId: `flow-${suffix}` };
  const root = { ...structuredClone(componentTemplate.root), id: `instance-${suffix}`, kind: "componentInstance", parentId: pageId, x: 120, y: 80, componentId: syncComponentId, componentSourceId: "source-root", componentVariantId: defaultVariant.id, overrides: {}, interactions: [] };
  const frame = { ...structuredClone(componentTemplate.children[0]), id: `instance-frame-${suffix}`, parentId: root.id };
  const label = { ...structuredClone(componentTemplate.children[1]), id: `instance-label-${suffix}`, parentId: frame.id };
  const removed = { ...structuredClone(componentTemplate.children[2]), id: `instance-removed-${suffix}`, parentId: frame.id };
  if (suffix === "two") Object.assign(label, { fill: "#ff0000", overrides: { fill: "#ff0000" } });
  page.elements.push(root, frame, label, removed);
  return page;
};
const componentPageTwo = makeComponentInstancePage("page-two", "two");
const componentPageThree = makeComponentInstancePage("page-three", "three");
componentSyncDocument.pages.push(componentPageTwo, componentPageThree);
componentSyncDocument.components = [componentTemplate];
const addedMasterChild = createUIElement("ellipse", 0, { x: 2, y: 22 }, masterFrame.id);
Object.assign(addedMasterChild, { name: "Indicator", componentSourceId: "source-added" });
Object.assign(addedMasterChild, { order: 1 });
componentMasterPage.elements = componentMasterPage.elements.filter(node => node.id !== masterRemoved.id).map(node => node.id === masterLabel.id ? { ...node, text: "Updated title", fill: "#00aa55", order: 2 } : node.id === masterFrame.id ? { ...node, order: 0 } : node);
componentMasterPage.elements.push(addedMasterChild);
const syncedComponents = synchronizeComponentMasters(componentSyncDocument);
const syncedDefinition = syncedComponents.components[0];
assert.equal(syncedDefinition.children.some(node => node.componentSourceId === "source-removed"), false, "removed master children are removed from the component definition");
assert.equal(syncedDefinition.children.some(node => node.componentSourceId === "source-added"), true, "new master children enter the component definition");
for (const pageId of ["page-two", "page-three"]) {
  const syncedPage = syncedComponents.pages.find(page => page.id === pageId);
  const instance = syncedPage.elements.find(node => node.kind === "componentInstance");
  const label = syncedPage.elements.find(node => node.componentSourceId === "source-label");
  const added = syncedPage.elements.find(node => node.componentSourceId === "source-added");
  assert.equal(label.text, "Updated title", `${pageId} instance receives nested master content updates`);
  assert.ok(added, `${pageId} instance receives newly added master children`);
  assert.equal(added.parentId, syncedPage.elements.find(node => node.componentSourceId === "source-frame").id, `${pageId} added child attaches to the corresponding nested instance parent`);
  assert.deepEqual(syncedPage.elements.filter(node => node.parentId === added.parentId).sort((a, b) => a.order - b.order).map(node => node.componentSourceId), ["source-added", "source-label"], `${pageId} instance follows the master's reordered child structure`);
  assert.equal(syncedPage.elements.some(node => node.componentSourceId === "source-removed"), false, `${pageId} instance removes deleted master children`);
  assert.equal(instance.componentSourceId, "source-root", `${pageId} instance retains its stable root source identity`);
}
assert.equal(syncedComponents.pages.find(page => page.id === "page-two").elements.find(node => node.componentSourceId === "source-label").fill, "#ff0000", "per-child visual overrides survive master synchronization");
assert.equal(syncedComponents.pages.find(page => page.id === "page-three").elements.find(node => node.componentSourceId === "source-label").fill, "#00aa55", "unmodified child styling follows master changes");
const nestedVariant = { id: "sync-compact", name: "Compact", properties: { width: 222, "source-label.text": "Compact title", "source-label.fill": "#123456" } };
const variantComponent = { ...syncedDefinition, variants: [...syncedDefinition.variants, nestedVariant] };
const pageTwoAfterVariant = applyComponentVariant(syncedComponents.pages.find(page => page.id === "page-two").elements, "page-two", "instance-two", variantComponent, nestedVariant.id);
assert.equal(pageTwoAfterVariant.find(node => node.id === "instance-two").width, 222, "root variant properties apply to the component instance");
assert.equal(pageTwoAfterVariant.find(node => node.componentSourceId === "source-label").text, "Compact title", "nested variant text applies to the matching child source node");
assert.equal(pageTwoAfterVariant.find(node => node.componentSourceId === "source-label").fill, "#ff0000", "a local child override takes precedence over variant styling");
const capturedVariant = captureComponentVariant(pageTwoAfterVariant, "page-two", variantComponent, "instance-two", "captured-state", "Captured state");
assert.equal(capturedVariant.properties["source-label.text"], "Compact title", "a saved variant captures nested child values");
const withSiblingOverride = pageTwoAfterVariant.map(node => node.componentSourceId === "source-added" ? { ...node, fill: "#abcdef", overrides: { fill: "#abcdef" } } : node);
const resetOneChild = resetComponentNodeOverride(withSiblingOverride, "page-two", variantComponent, "instance-two", "instance-label-two");
assert.equal(resetOneChild.find(node => node.componentSourceId === "source-label").fill, "#123456", "resetting one child restores its selected variant value");
assert.equal(resetOneChild.find(node => node.componentSourceId === "source-added").fill, "#abcdef", "resetting one child leaves sibling overrides intact");
const resetInstance = resetComponentInstance(pageTwoAfterVariant, "page-two", variantComponent, "instance-two");
assert.equal(resetInstance.find(node => node.id === "instance-two").componentVariantId, defaultVariant.id, "reset restores the default variant");
assert.equal(resetInstance.find(node => node.componentSourceId === "source-label").fill, "#00aa55", "reset clears per-child overrides back to the live master value");
const detachedInstance = detachComponentInstance(resetInstance, "page-two", "instance-two");
assert.equal(detachedInstance.find(node => node.id === "instance-two").kind, "group", "detaching converts the instance root to a normal group");
assert.ok(detachedInstance.some(node => node.componentSourceId === "" && node.parentId === "instance-two"), "detaching preserves its child hierarchy and clears component linkage");
assert.equal(withComponentOverrides({ ...masterRoot, overrides: {} }, { x: 90, fill: "#abcdef" }, true).overrides.x, undefined, "instance root positioning remains independent of component appearance overrides");
assert.equal(withComponentOverrides({ ...masterRoot, overrides: {} }, { x: 90, fill: "#abcdef" }, true).overrides.fill, "#abcdef", "instance root appearance edits are stored as overrides");

// Nested instances retain their own component identity while also participating
// in the containing component's source tree and variant property namespace.
const innerComponentId = "component-inner-fixture";
const outerComponentId = "component-outer-fixture";
const innerRoot = createUIElement("group", 0, { x: 0, y: 0 }, "component-root");
Object.assign(innerRoot, { id: "inner-template-root", componentId: innerComponentId, componentSourceId: "inner-root", componentSourceIds: { [innerComponentId]: "inner-root" } });
const innerTitle = createUIElement("text", 0, { x: 2, y: 2 }, innerRoot.id);
Object.assign(innerTitle, { id: "inner-template-title", text: "Nested default title", componentSourceId: "inner-title", componentSourceIds: { [innerComponentId]: "inner-title" } });
const innerDefault = { id: "inner-default", name: "Default", properties: {} };
const innerCompact = { id: "inner-compact", name: "Compact", properties: { "inner-title.text": "Nested compact title" } };
const innerComponent = { id: innerComponentId, name: "Inner component", root: innerRoot, children: [innerTitle], variants: [innerDefault, innerCompact] };
const outerRoot = createUIElement("group", 0, { x: 0, y: 0 }, "component-root");
Object.assign(outerRoot, { id: "outer-template-root", componentId: outerComponentId, componentSourceId: "outer-root", componentSourceIds: { [outerComponentId]: "outer-root" } });
const nestedInstance = createUIElement("componentInstance", 0, { x: 4, y: 4 }, outerRoot.id);
Object.assign(nestedInstance, { id: "outer-template-inner", componentId: innerComponentId, componentVariantId: innerDefault.id, componentSourceId: "inner-root", componentSourceIds: { [outerComponentId]: "outer-inner-instance", [innerComponentId]: "inner-root" } });
const nestedTitle = createUIElement("text", 0, { x: 1, y: 1 }, nestedInstance.id);
Object.assign(nestedTitle, { id: "outer-template-title", text: "Nested default title", componentSourceId: "inner-title", componentSourceIds: { [outerComponentId]: "outer-inner-title", [innerComponentId]: "inner-title" } });
const outerDefault = { id: "outer-default", name: "Default", properties: {} };
const outerCompact = { id: "outer-compact", name: "Compact inner", properties: { "outer-inner-instance.componentVariantId": innerCompact.id } };
const outerOverride = { id: "outer-title-override", name: "Override inner title", properties: { "outer-inner-instance.componentVariantId": innerCompact.id, "outer-inner-title.text": "Outer variant title" } };
const outerComponent = { id: outerComponentId, name: "Outer component", root: outerRoot, children: [nestedInstance, nestedTitle], variants: [outerDefault, outerCompact, outerOverride] };
const nestedInstanceRoot = { ...structuredClone(outerRoot), id: "outer-instance", kind: "componentInstance", parentId: "page-nested", componentVariantId: outerDefault.id, componentId: outerComponentId, overrides: {} };
const nestedInstanceChild = { ...structuredClone(nestedInstance), id: "nested-inner-instance", parentId: nestedInstanceRoot.id };
const nestedInstanceTitle = { ...structuredClone(nestedTitle), id: "nested-inner-title", parentId: nestedInstanceChild.id };
const nestedVariantElements = [nestedInstanceRoot, nestedInstanceChild, nestedInstanceTitle];
const appliedNestedVariant = applyComponentVariant(nestedVariantElements, "page-nested", nestedInstanceRoot.id, outerComponent, outerCompact.id, [outerComponent, innerComponent]);
assert.equal(appliedNestedVariant.find(node => node.id === nestedInstanceChild.id).componentVariantId, innerCompact.id, "outer variants can select a nested component variant");
assert.equal(appliedNestedVariant.find(node => node.id === nestedInstanceTitle.id).text, "Nested compact title", "nested component variants resolve against their own source identity");
const appliedOuterOverride = applyComponentVariant(nestedVariantElements, "page-nested", nestedInstanceRoot.id, outerComponent, outerOverride.id, [outerComponent, innerComponent]);
assert.equal(appliedOuterOverride.find(node => node.id === nestedInstanceTitle.id).text, "Outer variant title", "explicit outer child variant values take precedence over nested component variants");

// Inner master changes must reach outer masters first, then propagate through
// outer instances even when the containing component appears first in storage.
const nestedSyncDocument = createUIDesignDocument("Nested component sync fixture");
const nestedSyncPageOne = nestedSyncDocument.pages[0];
const nestedSyncPageTwo = { ...structuredClone(nestedSyncPageOne), id: "nested-sync-page-two", name: "Page 2", elements: [] };
const liveInnerRoot = { ...structuredClone(innerRoot), id: "live-inner-root", parentId: nestedSyncPageOne.id, componentId: innerComponentId };
const liveInnerTitle = { ...structuredClone(innerTitle), id: "live-inner-title", parentId: liveInnerRoot.id, text: "Updated from inner master" };
const liveOuterRoot = { ...structuredClone(outerRoot), id: "live-outer-root", parentId: nestedSyncPageOne.id, componentId: outerComponentId };
const liveNestedRoot = { ...structuredClone(nestedInstance), id: "live-nested-instance", parentId: liveOuterRoot.id, componentVariantId: innerDefault.id };
const liveNestedTitle = { ...structuredClone(nestedTitle), id: "live-nested-title", parentId: liveNestedRoot.id, text: "Nested default title" };
nestedSyncPageOne.elements.push(liveInnerRoot, liveInnerTitle, liveOuterRoot, liveNestedRoot, liveNestedTitle);
const outerInstanceForSync = { ...structuredClone(outerRoot), id: "outer-sync-instance", kind: "componentInstance", parentId: nestedSyncPageTwo.id, componentVariantId: outerDefault.id, componentId: outerComponentId, overrides: {} };
const nestedVariantOverride = withComponentOverrides(nestedInstance, { componentVariantId: innerCompact.id }, true);
const nestedInstanceForSync = { ...structuredClone(nestedInstance), ...nestedVariantOverride, id: "inner-sync-instance", parentId: outerInstanceForSync.id };
const nestedTitleForSync = { ...structuredClone(nestedTitle), id: "inner-sync-title", parentId: nestedInstanceForSync.id };
nestedSyncPageTwo.elements.push(outerInstanceForSync, nestedInstanceForSync, nestedTitleForSync);
nestedSyncDocument.pages.push(nestedSyncPageTwo);
nestedSyncDocument.components = [outerComponent, innerComponent];
const nestedSynced = synchronizeComponentMasters(nestedSyncDocument);
assert.equal(nestedSynced.pages.find(item => item.id === nestedSyncPageOne.id).elements.find(node => node.id === liveNestedTitle.id).text, "Updated from inner master", "nested component master changes update instances inside outer masters");
assert.equal(nestedSynced.pages.find(item => item.id === nestedSyncPageTwo.id).elements.find(node => node.id === nestedTitleForSync.id).text, "Nested compact title", "a nested instance's selected variant override survives containing master synchronization");

const invalidParent = structuredClone(document);
invalidParent.pages[0].elements[2].parentId = "missing-parent";
const repairedParent = normalizeUIDesignDocument(invalidParent);
assert.equal(repairedParent.pages[0].elements[2].parentId, repairedParent.pages[0].id, "orphaned imported nodes are repaired to page root without dropping content");
const invalidLink = structuredClone(document);
invalidLink.pages[0].elements[2].interactions[0].targetPageId = "missing-page";
const normalizedInvalidLink = normalizeUIDesignDocument(invalidLink);
assert.equal(normalizedInvalidLink.pages[0].elements[2].interactions.length, 1, "only links to missing pages are removed at the file boundary");
assert.equal(normalizedInvalidLink.pages[0].elements[2].interactions[0].targetPageId, secondPage.id, "valid links remain intact while dangling page links are removed");
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
assert.equal(resolveColorToken([{ id: "alias", name: "Alias", value: "#000000", aliasOf: "primary" }, { id: "primary", name: "Primary", value: "#ffffff", modeValues: { dark: "#111111" } }], "alias", "dark", "#000000"), "#111111", "color aliases resolve through active modes");
assert.equal(resolveTypographyToken({ id: "type", name: "Body", fontFamily: "system", fontSize: 16, fontWeight: 400, lineHeight: 1.4, letterSpacing: 0, modeValues: { dark: { fontSize: 18, fontWeight: 600 } } }, "dark")?.fontSize, 18, "typography mode values resolve for the selected mode");
assert.equal(resolveValueToken({ id: "space", name: "Space", value: 8, unit: "px", modeValues: { dark: 12 } }, "dark"), 12, "spacing and radius tokens resolve mode-specific values");
assert.equal(resolveEffectToken({ value: "none", modeValues: { dark: "0 4px 12px #00000040" } }, "dark"), "0 4px 12px #00000040", "effect tokens resolve mode-specific values");
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

const gridParent = createUIElement("group", 0, { x: 0, y: 0 }, layoutPage.id, { width: 300, height: 180 });
gridParent.autoLayout = { ...gridParent.autoLayout, enabled: true, direction: "grid", columns: 2, gap: 10, paddingLeft: 8, paddingTop: 6, gridColumnSizes: [100, 0], gridRowSizes: [50] };
const gridFirst = createUIElement("rectangle", 0, { x: 90, y: 90 }, gridParent.id, { width: 70, height: 32 });
const gridSecond = createUIElement("rectangle", 1, { x: 0, y: 0 }, gridParent.id, { width: 40, height: 30 }); gridSecond.gridColumn = 2; gridSecond.gridRow = 1; gridSecond.widthSizing = "fill";
const gridSpanning = createUIElement("rectangle", 2, { x: 0, y: 0 }, gridParent.id, { width: 50, height: 26 }); gridSpanning.gridColumn = 1; gridSpanning.gridRow = 2; gridSpanning.gridColumnSpan = 2; gridSpanning.widthSizing = "fill";
const absoluteGridChild = createUIElement("rectangle", 3, { x: 211, y: 121 }, gridParent.id, { width: 28, height: 22 }); absoluteGridChild.layoutPosition = "absolute";
const gridResult = applyAutoLayout({ ...layoutPage, elements: [gridParent, gridFirst, gridSecond, gridSpanning, absoluteGridChild] });
const laidOut = new Map(gridResult.elements.map(node => [node.id, node]));
assert.deepEqual([laidOut.get(gridFirst.id).x, laidOut.get(gridFirst.id).y, laidOut.get(gridSecond.id).x, laidOut.get(gridSecond.id).width], [8, 6, 118, 182], "grid layout applies padding, fixed tracks, fractional remainder, and explicit placement");
assert.deepEqual([laidOut.get(gridSpanning.id).x, laidOut.get(gridSpanning.id).y, laidOut.get(gridSpanning.id).width], [8, 66, 292], "grid items span the requested columns and use their row placement");
assert.deepEqual([laidOut.get(absoluteGridChild.id).x, laidOut.get(absoluteGridChild.id).y], [211, 121], "absolute children stay at their explicit local coordinates outside grid flow");
const fractionalParent = createUIElement("group", 0, { x: 0, y: 0 }, layoutPage.id, { width: 300, height: 300 });
fractionalParent.autoLayout = { ...fractionalParent.autoLayout, enabled: true, direction: "grid", columns: 1, gridColumnFr: [1], gridRowFr: [2, 1] };
const fractionalFirst = createUIElement("rectangle", 0, { x: 0, y: 0 }, fractionalParent.id, { width: 20, height: 24 });
fractionalFirst.gridRow = 1; fractionalFirst.widthSizing = "fill"; fractionalFirst.heightSizing = "fill";
const fractionalSecond = createUIElement("rectangle", 1, { x: 0, y: 0 }, fractionalParent.id, { width: 20, height: 24 });
fractionalSecond.gridRow = 2; fractionalSecond.widthSizing = "fill"; fractionalSecond.heightSizing = "fill";
const fractionalResult = applyAutoLayout({ ...layoutPage, elements: [fractionalParent, fractionalFirst, fractionalSecond] });
const fractionalById = new Map(fractionalResult.elements.map(node => [node.id, node]));
assert.deepEqual([fractionalById.get(fractionalFirst.id).height, fractionalById.get(fractionalSecond.id).height], [195, 97], "weighted fractional grid rows divide available space proportionally after the row gap");
assert.deepEqual([fractionalById.get(fractionalFirst.id).y, fractionalById.get(fractionalSecond.id).y], [0, 203], "weighted fractional rows position children at the computed track edge");

const spatialIndex = new spatial.UIElementSpatialIndex([{ ...button, x: 10, y: 10 }, { ...button, id: "outside", x: 2000, y: 2000 }]);
assert.deepEqual(spatialIndex.query({ x: 0, y: 0, width: 100, height: 100 }).map(item => item.id), [button.id], "viewport queries return only spatially intersecting nodes");

console.log("UI Design fixtures passed: v1 .sdui schema, shared hierarchy, rotated transforms and reparenting, group/ungroup/duplicate/reorder, clipping, ancestor visibility/locking, constraints, prototype links, whole-pixel resizing, nested auto layout, live token reflow, nested component variants, per-child overrides, multi-page component structure sync, and viewport indexing.");
