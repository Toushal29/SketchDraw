import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const cache = new Map();
function loadTs(file) {
  const absolute = path.resolve(file);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = { exports: {} }; cache.set(absolute, module);
  const source = readFileSync(absolute, "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const localRequire = specifier => specifier.startsWith(".") ? loadTs(path.resolve(path.dirname(absolute), `${specifier}.ts`)) : require(specifier);
  new Function("require", "module", "exports", code)(localRequire, module, module.exports);
  return module.exports;
}
const fixture = name => readFileSync(path.join(root, "scripts", "fixtures", "diagram-code", name), "utf8");
const mermaid = loadTs(path.join(root, "src", "mermaid.ts"));
const dot = loadTs(path.join(root, "src", "features", "diagrams", "dot.ts"));
const csv = loadTs(path.join(root, "src", "features", "diagrams", "csv-diagram.ts"));
const formats = loadTs(path.join(root, "src", "features", "diagrams", "code-formats.ts"));
const chartImport = loadTs(path.join(root, "src", "features", "components", "chart-import.ts"));
const d2 = loadTs(path.join(root, "src", "features", "diagrams", "d2.ts"));
const pathEditing = loadTs(path.join(root, "src", "features", "canvas", "path-editing.ts"));
const structure = loadTs(path.join(root, "src", "features", "canvas", "structure.ts"));
const bounds = loadTs(path.join(root, "src", "features", "canvas", "bounds.ts"));
const validation = loadTs(path.join(root, "src", "features", "diagrams", "validation.ts"));
const connectorRouting = loadTs(path.join(root, "src", "features", "diagrams", "connector-routing.ts"));
const componentMasters = loadTs(path.join(root, "src", "features", "components", "component-masters.ts"));

const flow = mermaid.parseMermaidFlowchart(fixture("flowchart.mmd"));
assert.equal(flow.nodes.length, 4);
assert.equal(flow.links.length, 3);
assert.equal(flow.subgraphs.length, 1);
const flowElements = mermaid.layoutMermaidFlowchart(flow, { x: 0, y: 0 });
assert.equal(flowElements.find(item => item.id === "mermaid-node:Client")?.color, "#2468a0");
assert.equal(flowElements.find(item => item.id === "mermaid-link:0")?.color, "#227755");
const flowExport = formats.exportDiagramCode("mmd", flowElements);
const flowAgain = mermaid.parseMermaidFlowchart(flowExport);
assert.equal(flowAgain.links.length, 3);
assert.equal(flowAgain.subgraphs.length, 1);
assert.equal(flowAgain.nodes.find(item => item.key === "Client")?.fillColor, "#e8f3ff");

const sequence = mermaid.parseMermaidSequence(fixture("sequence.mmd"));
assert.equal(sequence.participants.length, 3);
assert.equal(sequence.messages.length, 3);
const sequenceGroup = { type: "group", id: "fixture-sequence", elements: mermaid.layoutMermaidSequence(sequence, { x: 0, y: 0 }), mermaid: { format: "mermaid", source: fixture("sequence.mmd") } };
const sequenceExport = formats.exportDiagramCode("mmd", [sequenceGroup]);
assert.equal(mermaid.parseMermaidSequence(sequenceExport).messages.length, 3);

const dotElements = dot.dotToDiagram(fixture("styles.dot"));
assert.equal(dotElements.filter(item => item.type === "arrow").length, 1);
const dotExport = formats.exportDiagramCode("dot", dotElements);
assert.match(dotExport, /fillcolor="#e8f3ff"/);
assert.match(dotExport, /arrowtail=odot/);
assert.equal(dot.dotToDiagram(dotExport).filter(item => item.type === "arrow").length, 1);

const csvElements = csv.csvToDiagram(fixture("relationships.csv"));
assert.equal(csvElements.filter(item => item.type === "arrow").length, 2);
const csvExport = formats.exportDiagramCode("csv", csvElements);
assert.equal(csv.csvToDiagram(csvExport).filter(item => item.type === "arrow").length, 2);

const chart = chartImport.chartDataFromCsv("Region,Sales,Cost\nNorth,12,7\nSouth,18,9", 0, [1, 2]);
assert.deepEqual(chart.labels, ["North", "South"]);
assert.equal(chart.series?.length, 2);

const d2Elements = d2.d2ToDiagram(readFileSync(path.join(root, "scripts", "fixtures", "complex-architecture.d2"), "utf8"));
assert.equal(d2Elements.filter(item => item.type === "arrow").length, 4);
const d2Directions = d2.d2ToDiagram("a: A\nb: B\nc: C\na <- b\nb -- c");
const reversed = d2Directions.find(item => item.type === "arrow");
const undirected = d2Directions.find(item => item.type === "line");
assert.equal(reversed?.startBinding?.elementId, "d2-b");
assert.equal(reversed?.endBinding?.elementId, "d2-a");
assert.equal(undirected?.startHead, undefined);
assert.equal(undirected?.endHead, undefined);
const d2Collisions = d2.d2ToDiagram("a-b: First\na_b: Second\na-b -> a_b");
assert.equal(new Set(d2Collisions.map(item => item.id)).size, d2Collisions.length);
assert.ok(d2Collisions.every(item => item.id.length <= 100));
assert.throws(() => d2.d2ToDiagram(`${Array.from({ length: 34 }, (_, index) => `${"  ".repeat(index)}g${index}: {`).join("\n")}\n${Array.from({ length: 34 }, (_, index) => `${"  ".repeat(33 - index)}}`).join("\n")}`), /32 levels deep/);
const deletedLayers = structure.deleteCanvasLayers([
  { id: "root", name: "Root", order: 0 },
  { id: "parent", name: "Parent", parentId: "root", order: 0 },
  { id: "child", name: "Child", parentId: "parent", order: 0 },
], ["parent", "child"]);
assert.equal(deletedLayers.reassignment.get("parent"), "root");
assert.equal(deletedLayers.reassignment.get("child"), "root");
const labeledFrame = { type: "group", id: "frame-bounds", elements: [], componentBounds: { x: 10, y: 20, w: 120, h: 80 }, container: { kind: "frame", name: "Frame title", showLabel: true } };
const frameContentBounds = bounds.visibleElementBounds(labeledFrame);
assert.ok(frameContentBounds.some(box => box.y < 20), "frame export bounds must include the visible frame label");
const defaultPortShape = { type: "rectangle", id: "port-target", x: 0, y: 0, w: 100, h: 100, color: "#000000", thickness: 2 };
const defaultPortConnector = { type: "arrow", id: "port-link", x: 50, y: 0, w: 120, h: 50, color: "#000000", thickness: 2, startBinding: { elementId: "port-target", anchor: { x: .5, y: 0 }, portId: "north" } };
assert.ok(!validation.validateDiagram([defaultPortShape, defaultPortConnector], [], { includeOverlaps: false }).some(issue => issue.code === "invalid-port"));
const obstacle = { type: "rectangle", id: "route-obstacle", x: 80, y: 30, w: 40, h: 40, color: "#000000", thickness: 2 };
const routedConnector = { type: "arrow", id: "route-link", x: 0, y: 50, w: 200, h: 0, color: "#000000", thickness: 2, autoRoute: true };
const routeContext = connectorRouting.createAutoRouteContext([routedConnector, obstacle]);
assert.ok(connectorRouting.autoRoutePoints(routedConnector, routeContext).length > 0);
const master = { id: "master-test", name: "Scale test", template: [{ type: "arrow", id: "template-link", x: 0, y: 0, w: 50, h: 20, color: "#000000", thickness: 2, routeWaypoints: [{ x: 25, y: 10 }], label: { text: "Link", color: "#000000", fontSize: 12, verticalAlign: "middle" } }], bounds: { x: 0, y: 0, w: 100, h: 100 } };
const scaledMasterInstance = componentMasters.instantiateComponentMaster(master, { x: 10, y: 20, w: 200, h: 200 });
assert.equal(scaledMasterInstance.elements[0].thickness, 4);
assert.deepEqual(scaledMasterInstance.elements[0].routeWaypoints, [{ x: 60, y: 40 }]);
assert.equal(scaledMasterInstance.elements[0].label.fontSize, 24);

const originalPath = { type: "svgPath", x: 10, y: 20, w: 40, h: 20, pathWidth: 40, pathHeight: 20, rotation: 37, pathData: "M 0 0 L 40 0 L 40 20 Z" };
const expandedPath = pathEditing.updateEditablePath(originalPath, [{ x: -10, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }]);
assert.ok(expandedPath.x < originalPath.x);
assert.ok(expandedPath.w > originalPath.w);
assert.equal(expandedPath.x + expandedPath.w / 2, originalPath.x + originalPath.w / 2);
assert.equal(expandedPath.y + expandedPath.h / 2, originalPath.y + originalPath.h / 2);

assert.throws(() => formats.plantUmlToDiagram("@startuml\nstart\n:Do work;\nstop\n@enduml"), /Unsupported PlantUML construct on line 2/);
assert.equal(formats.plantUmlToDiagram(fixture("orders.puml")).filter(item => item.type === "arrow").length, 1);

process.stdout.write("Diagram fixtures passed: Mermaid flowchart and sequence, DOT styles, D2 groups and edge directions, CSV graph and chart mapping, path bounds, PlantUML subset errors.\n");
