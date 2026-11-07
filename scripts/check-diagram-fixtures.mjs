import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";
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
const mermaidExtended = loadTs(path.join(root, "src", "features", "diagrams", "mermaid-extended.ts"));
const mermaidPreviewGeometry = loadTs(path.join(root, "src", "features", "diagrams", "mermaid-preview-geometry.ts"));
const dot = loadTs(path.join(root, "src", "features", "diagrams", "dot.ts"));
const csv = loadTs(path.join(root, "src", "features", "diagrams", "csv-diagram.ts"));
const formats = loadTs(path.join(root, "src", "features", "diagrams", "code-formats.ts"));
const plantuml = loadTs(path.join(root, "src", "features", "diagrams", "plantuml-diagrams.ts"));
const chartImport = loadTs(path.join(root, "src", "features", "components", "chart-import.ts"));
const d2 = loadTs(path.join(root, "src", "features", "diagrams", "d2.ts"));
const schemaParser = loadTs(path.join(root, "src", "schema.ts"));
const pathEditing = loadTs(path.join(root, "src", "features", "canvas", "path-editing.ts"));
const structure = loadTs(path.join(root, "src", "features", "canvas", "structure.ts"));
const bounds = loadTs(path.join(root, "src", "features", "canvas", "bounds.ts"));
const validation = loadTs(path.join(root, "src", "features", "diagrams", "validation.ts"));
const connectorRouting = loadTs(path.join(root, "src", "features", "diagrams", "connector-routing.ts"));
const componentMasters = loadTs(path.join(root, "src", "features", "components", "component-masters.ts"));
const proposalComponents = loadTs(path.join(root, "src", "features", "components", "proposal-components.ts"));
const libraryComponents = loadTs(path.join(root, "src", "features", "components", "library-components.ts"));
const libraryComponentEditor = loadTs(path.join(root, "src", "features", "components", "library-component-editor.ts"));
const componentGeometry = loadTs(path.join(root, "src", "features", "components", "component-geometry.ts"));
const sketchParser = loadTs(path.join(root, "src", "features", "files", "parse-sketch.ts"));
const sketchModel = loadTs(path.join(root, "src", "model.ts"));
const modelComponentRenderer = loadTs(path.join(root, "src", "features", "components", "model-component-renderer.ts"));
const proposalPlanningRenderer = loadTs(path.join(root, "src", "features", "components", "proposal-planning-renderer.ts"));
const proposalWireframeRenderer = loadTs(path.join(root, "src", "features", "components", "proposal-wireframe-renderer.ts"));
const wireframePresets = loadTs(path.join(root, "src", "features", "components", "wireframe-presets.ts"));
const bpmnXml = loadTs(path.join(root, "src", "features", "diagrams", "bpmn-xml.ts"));
const bpmnAnalysis = loadTs(path.join(root, "src", "features", "diagrams", "bpmn-analysis.ts"));
const structurizrWorkspace = loadTs(path.join(root, "src", "features", "diagrams", "structurizr-workspace.ts"));
const customStencils = loadTs(path.join(root, "src", "features", "components", "custom-stencils.ts"));
const dataPipeline = loadTs(path.join(root, "src", "features", "diagrams", "data-pipeline.ts"));
const pipelineSql = loadTs(path.join(root, "src", "features", "diagrams", "pipeline-sql.ts"));
const pipelineWorkflows = loadTs(path.join(root, "src", "features", "diagrams", "pipeline-workflows.ts"));
const schemaVisualizer = loadTs(path.join(root, "src", "features", "diagrams", "schema-visualizer.ts"));
const checklist = loadTs(path.join(root, "src", "features", "notes", "checklist.ts"));
const vsdxArchive = loadTs(path.join(root, "src", "features", "diagrams", "visio-vsdx-archive.ts"));
const zip = loadTs(path.join(root, "src", "features", "files", "zip.ts"));

// VSDX import limits and bounded expansion regression fixtures.
function singleEntryZip(name, compressed, { method, plainLength, checksum }) {
  const nameBytes = Buffer.from(name, "utf8");
  const local = Buffer.alloc(30 + nameBytes.length + compressed.length);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(method, 8);
  local.writeUInt32LE(checksum >>> 0, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(plainLength, 22);
  local.writeUInt16LE(nameBytes.length, 26); nameBytes.copy(local, 30); Buffer.from(compressed).copy(local, 30 + nameBytes.length);
  const central = Buffer.alloc(46 + nameBytes.length);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(method, 10);
  central.writeUInt32LE(checksum >>> 0, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(plainLength, 24);
  central.writeUInt16LE(nameBytes.length, 28); nameBytes.copy(central, 46);
  const end = Buffer.alloc(22); const directoryOffset = local.length;
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(directoryOffset, 16);
  return new Uint8Array(Buffer.concat([local, central, end]));
}
assert.equal(vsdxArchive.crc32(new TextEncoder().encode("123456789")), 0xcbf43926, "table-driven CRC32 matches the standard check value");
const validArchive = await vsdxArchive.validateVsdxArchive(zip.createStoredZip([{ path: "visio/pages/pages.xml", contents: "<Pages/>" }]));
assert.equal(new TextDecoder().decode(validArchive.get("visio/pages/pages.xml")), "<Pages/>");
await assert.rejects(() => vsdxArchive.validateVsdxArchive(new Uint8Array(vsdxArchive.MAX_VSDX_ARCHIVE_BYTES + 1)), /limited to 25 MB/, "oversized ZIP input is rejected before parsing");
const overLimitDeflate = new Uint8Array(deflateRawSync(Buffer.from("x")));
await assert.rejects(() => vsdxArchive.validateVsdxArchive(singleEntryZip("visio/pages/pages.xml", overLimitDeflate, { method: 8, plainLength: vsdxArchive.MAX_VSDX_EXPANDED_BYTES + 1, checksum: 0 })), /expanded Visio package exceeds the 50 MB/, "declared decompression size is bounded before inflation");
const bombPlain = Buffer.alloc(1024 * 1024, 0x41); const bombCompressed = new Uint8Array(deflateRawSync(bombPlain));
await assert.rejects(() => vsdxArchive.validateVsdxArchive(singleEntryZip("visio/pages/pages.xml", bombCompressed, { method: 8, plainLength: 1, checksum: vsdxArchive.crc32(bombPlain) })), /expands beyond its declared size/, "underreported decompression bomb is stopped while streaming");

// Checklist structural markers survive inline formatting and retain item types.
const checklistText = checklist.checklistToText([
  { id: "heading", type: "heading", text: "Section" },
  { id: "task", type: "task", text: "**Bold task**", checked: false, level: 0 },
  { id: "done", type: "task", text: "Complete", checked: true, level: 1 },
]);
assert.equal(checklistText, "# Section\n- [ ] **Bold task**\n\t- [x] Complete");
assert.deepEqual(checklist.parseChecklistText(checklistText).map(item => [item.type, item.text]), [["heading", "Section"], ["task", "**Bold task**"], ["task", "Complete"]]);
assert.equal(checklist.parseChecklistText("**Bold** and **bold**")[0].type, "task", "multiple bold spans do not become a heading by their outer delimiters");
const boldTask = checklist.formatChecklistTextSelection("plain task", 0, 10, "**", "**");
assert.equal(boldTask.text, "- [ ] **plain task**");
assert.equal(checklist.parseChecklistText(boldTask.text)[0].type, "task");
const unboldHeading = checklist.formatChecklistTextSelection("**Section**", 0, 11, "**", "**");
assert.equal(unboldHeading.text, "# Section");
assert.equal(checklist.parseChecklistText(unboldHeading.text)[0].type, "heading");

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
const flowHeadVariants = mermaid.parseMermaidFlowchart("flowchart LR\n  A <-- B\n  B o-- C\n  C ---x D\n");
assert.deepEqual(flowHeadVariants.links.map(link => [link.startHead, link.endHead]), [["solid", "none"], ["dot", "none"], ["none", "bar"]], "the editable Mermaid flow parser retains backward, open-start, and cross-terminal arrows");
assert.throws(() => mermaid.parseMermaidFlowchart("flowchart LR\n  classDef danger fill:red"), /outside the editable subset.*line 2, column 3/, "unsupported Mermaid flowchart directives report a precise source location");
assert.throws(() => mermaid.parseMermaidFlowchart("flowchart LR\n  A -->"), /Expected a node after the connector.*line 2, column 8/, "incomplete Mermaid connectors report the missing endpoint location");

const sequence = mermaid.parseMermaidSequence(fixture("sequence.mmd"));
assert.equal(sequence.participants.length, 3);
assert.equal(sequence.messages.length, 3);
assert.throws(() => mermaid.parseMermaidSequence("sequenceDiagram\n    loop forever"), /not supported yet: loop.*line 2, column 5/, "unsupported Mermaid sequence fragments report a precise source location");
const sequenceGroup = { type: "group", id: "fixture-sequence", elements: mermaid.layoutMermaidSequence(sequence, { x: 0, y: 0 }), mermaid: { format: "mermaid", source: fixture("sequence.mmd") } };
const sequenceExport = formats.exportDiagramCode("mmd", [sequenceGroup]);
assert.equal(mermaid.parseMermaidSequence(sequenceExport).messages.length, 3);

const extendedMermaidCases = [
  ["class", `classDiagram
  title Order domain
  class Customer {
    +UUID id
    +String email
    +placeOrder(): Order
  }
  class "Order line" as OrderLine {
    +Integer quantity
    +subtotal(): Decimal
  }
  Customer "1" --> "*" OrderLine : places`],
  ["usecase", `usecase-beta
  title Store ordering
  direction LR
  actor Customer("Store customer")
  actor Clerk("Checkout clerk")
  systemBoundary Checkout["Checkout service"]
    Begin("Begin checkout")
    Payment[Take payment]
    Discount("Apply discount")
  end
  Customer --> Begin
  Clerk -- "requests adjustment" --> Discount
  Begin ..> : include Payment
  Discount ..> : extend Begin
  Clerk --|> Customer`],
  ["ishikawa", `ishikawa-beta
Blurry Photo
    Process
        Out of focus
        Shutter speed too slow
        Protective film not removed
        Beautification filter applied
    User
        Shaky hands
    Equipment
        LENS
            Inappropriate lens
            Damaged lens
            Dirty lens
        SENSOR
            Damaged sensor
            Dirty sensor
    Environment
        Subject moved too quickly
        Too dark`],
  ["mindmap", `mindmap\n  root((Project))\n    Plan\n      Scope\n    Build\n      API`],
  ["timeline", `timeline\n  title Product launch\n  section Planning\n    2024-01 : Research\n    2024-02 : Plan\n  section Delivery\n    2024-03 : Build`],
  ["git", `gitGraph\n  commit id: "init"\n  branch develop\n  checkout develop\n  commit id: "feature"\n  checkout main\n  commit id: "hotfix"\n  merge develop`],
  ["requirement", `requirementDiagram\n  requirement reqA {\n    id: 1\n    text: Keep data safe\n    risk: high\n    verifymethod: test\n  }\n  element Store {\n    type: database\n  }\n  Store - satisfies -> reqA`],
  ["quadrant", `quadrantChart\n  title Risk review\n  x-axis Low impact --> High impact\n  y-axis Low likelihood --> High likelihood\n  quadrant-1 High and high\n  quadrant-2 Low likelihood\n  point Alpha: [0.8, 0.7]\n  point Beta: [0.2, 0.3]`],
  ["kanban", `kanban\n  backlog[Backlog]\n    task1[Write spec]\n    task2[Review]\n  done[Done]\n    task3[Ship]`],
  ["sankey", `sankey-beta\n  Source, Process, 4\n  Source, Review, 3\n  Process, Final, 2\n  Review, Final, 1`],
  ["pie", `pie showData title "Device mix"\n  "Desktop": 46\n  "Tablet": 35\n  "Phone": 19`],
  ["xychart", `xychart-beta\n  title "Monthly activity"\n  x-axis "Month" ["Jan", "Feb", "Mar"]\n  y-axis "Users" 0 --> 100\n  line [28, 48, 38]\n  bar [12, 19, 24]`],
  ["packet", `packet-beta\n  title "Example packet"\n  0-3: "Version"\n  4-7: "Header length"\n  8-15: "Type"\n  16-31: "Payload length"\n  +8: "Next row field"`],
  ["architecture", `architecture-beta\n  group cloud(cloud)[Cloud]\n  service client(internet)[Client]\n  service api(server)[API] in cloud\n  service database(database)[Database] in cloud\n  client:R --> L:api\n  api:B --> T:database`],
  ["radar", `radar-beta\n  title "Capability review"\n  axis performance["Performance"], usability["Usability"], scale["Scale"]\n  curve current["Current"]{3, 4, 5}\n  curve target["Target"]{4, 5, 3}\n  curve benchmark["Benchmark"]{performance: 5, usability: 4, scale: 4}\n  min 0\n  max 5\n  ticks 4\n  graticule polygon\n  showLegend false`],
  ["treemap", `treemap-beta\n  "Products"\n    "Electronics"\n      "Phones": 50\n      "Laptops": 30\n    "Clothing"\n      "Shoes": 20`],
  ["venn", `venn-beta\n  title "Team overlap"\n  set "Frontend Team"["Frontend"]:20\n    text A1["React"]\n  set Backend:12\n    text B1["API"]\n  set "Service Ops"["Ops"]:14\n    text C1["Runbooks"]\n  union "Frontend Team",Backend["Shared APIs"]:3\n    text AB1["OpenAPI"]\n  union "Frontend Team",Backend,"Service Ops"["Shared delivery"]`],
  ["treeview", fixture("treeview.mmd")],
  ["swimlane", fixture("swimlane.mmd")],
  ["cynefin", fixture("cynefin.mmd")],
  ["wardley", fixture("wardley.mmd")],
  ["eventmodeling", fixture("eventmodeling.mmd")],
  ["zenuml", fixture("zenuml.mmd")],
];
for (const [expectedType, source] of extendedMermaidCases) {
  const parsed = mermaidExtended.layoutExtendedMermaid(source, { x: 0, y: 0 });
  assert.equal(parsed.type, expectedType, `${expectedType} Mermaid family is detected`);
  const capability = mermaidExtended.mermaidCapabilitySummary(source);
  assert.ok(capability?.family && capability.supported && capability.knownLimits, `${expectedType} exposes supported syntax and known limits`);
  const exported = mermaidExtended.exportExtendedMermaid(parsed.type, parsed.elements, source);
  assert.equal(mermaidExtended.detectExtendedMermaidType(exported), expectedType, `${expectedType} Mermaid source exports in its original family`);
  const roundTrip = mermaidExtended.layoutExtendedMermaid(exported, { x: 0, y: 0 });
  const countNodes = elements => elements.filter(item => item.type !== "group" && item.id?.startsWith("mermaid-node:") || item.type === "group" && (item.componentRole?.startsWith("uml-class-node:") || item.componentRole?.startsWith("mermaid-usecase-actor:") || item.componentRole?.startsWith("mermaid-usecase-ellipse:"))).length;
  assert.equal(countNodes(roundTrip.elements), countNodes(parsed.elements), `${expectedType} Mermaid nodes survive an editable round trip`);
}
assert.match(mermaidExtended.mermaidCapabilitySummary(fixture("sequence.mmd")).knownLimits, /rejected/i, "the sequence subset reports unsupported feature behavior");
assert.match(mermaidExtended.mermaidCapabilitySummary(fixture("flowchart.mmd")).supported, /subgraphs/i, "the flowchart subset reports its supported constructs");
const classSource = extendedMermaidCases.find(([type]) => type === "class")[1];
const editableClassElements = mermaidExtended.layoutExtendedMermaid(classSource, { x: 0, y: 0 }).elements;
const editableClassCards = editableClassElements.filter(item => item.type === "group" && item.libraryComponent?.kind === "uml-class");
assert.equal(editableClassCards.length, 2, "Mermaid class source creates native editable UML cards");
const classPreviewViewBox = mermaidPreviewGeometry.mermaidPreviewViewBox(editableClassElements).split(/\s+/).map(Number);
assert.equal(classPreviewViewBox.length, 4);
assert.ok(classPreviewViewBox.every(Number.isFinite), "Mermaid class preview viewBox stays finite when nodes use component bounds");
assert.ok(classPreviewViewBox[0] <= Math.min(...editableClassCards.map(item => item.componentBounds.x)) - 23, "Mermaid class preview viewBox includes the left edge of library-component cards");
assert.ok(classPreviewViewBox[0] + classPreviewViewBox[2] >= Math.max(...editableClassCards.map(item => item.componentBounds.x + item.componentBounds.w)) + 23, "Mermaid class preview viewBox includes the right edge of library-component cards");
const zoomedClassViewBox = mermaidPreviewGeometry.zoomMermaidPreviewViewBox(classPreviewViewBox.join(" "), 2, { x: 0, y: 0 }).split(/\s+/).map(Number);
assert.ok(zoomedClassViewBox.every(Number.isFinite) && Math.abs(zoomedClassViewBox[2] - classPreviewViewBox[2] / 2) < 1e-8, "Mermaid preview zoom keeps a valid viewBox and scales around its center");
const pannedClassViewBox = mermaidPreviewGeometry.zoomMermaidPreviewViewBox(classPreviewViewBox.join(" "), 2, { x: 15, y: -8 }).split(/\s+/).map(Number);
assert.ok(Math.abs(pannedClassViewBox[0] - (zoomedClassViewBox[0] - 15)) < 1e-8 && Math.abs(pannedClassViewBox[1] - (zoomedClassViewBox[1] + 8)) < 1e-8, "Mermaid preview pan offsets the zoomed viewBox predictably");
assert.ok(mermaidPreviewGeometry.mermaidPreviewViewBox([]).split(/\s+/).map(Number).every(Number.isFinite), "empty Mermaid previews receive a safe finite fallback viewBox");
assert.deepEqual(editableClassCards.find(item => item.libraryComponent.label === "Customer").libraryComponent.componentFields.find(field => field.key === "attributes").value, "+UUID id\n+String email", "Mermaid class attributes are stored in editable class fields");
assert.deepEqual(editableClassCards.find(item => item.libraryComponent.label === "Order line").libraryComponent.componentFields.find(field => field.key === "methods").value, "+subtotal(): Decimal", "Mermaid class methods and aliases map to editable UML fields");
const classConnector = editableClassElements.find(item => item.type === "line" && item.componentRole?.startsWith("uml-class-relation:"));
assert.equal(classConnector?.endHead, "solid", "Mermaid class relationships use attached editable arrowheads");
assert.ok(classConnector?.startBinding && classConnector?.endBinding, "Mermaid class relationships bind to their class cards");
const changedClassCard = libraryComponentEditor.setLibraryComponentField(editableClassCards[0], "component:attributes", "+UUID id\n+String displayName");
const classEdits = mermaidExtended.exportExtendedMermaid("class", [changedClassCard, ...editableClassElements.filter(item => item !== editableClassCards[0])], classSource);
assert.ok(classEdits.includes("+String displayName") && classEdits.includes("Customer \"1\" --> \"*\" OrderLine"), "class field and relationship edits export back to Mermaid source");
const editableClassRoundTrip = mermaidExtended.layoutExtendedMermaid(classEdits, { x: 0, y: 0 }).elements;
assert.equal(editableClassRoundTrip.filter(item => item.type === "group" && item.libraryComponent?.kind === "uml-class").length, 2, "native class groups survive Mermaid source round-trip");
assert.equal(editableClassRoundTrip.find(item => item.type === "group" && item.libraryComponent?.kind === "uml-class" && item.componentRole?.endsWith(encodeURIComponent("OrderLine")))?.libraryComponent?.label, "Order line", "Mermaid class aliases retain their display names after editing and round-trip");
const usecaseSource = extendedMermaidCases.find(([type]) => type === "usecase")[1];
const usecaseElements = mermaidExtended.layoutExtendedMermaid(usecaseSource, { x: 0, y: 0 }).elements;
assert.equal(usecaseElements.filter(item => item.type === "group" && item.libraryComponent?.kind === "uml-actor").length, 2, "Mermaid use case actors become editable actor components");
assert.equal(usecaseElements.filter(item => item.type === "group" && item.libraryComponent?.kind === "uml-use-case").length, 2, "Mermaid oval use cases become editable ellipse components");
assert.equal(usecaseElements.filter(item => item.type === "rectangle" && item.componentRole?.startsWith("mermaid-usecase-rectangle:")).length, 1, "Mermaid bracket use cases remain editable rectangle shapes");
assert.equal(usecaseElements.filter(item => item.componentRole === "mermaid-usecase-boundary").length, 1, "Mermaid system boundaries become editable canvas boundaries");
assert.equal(usecaseElements.filter(item => item.type === "line" && item.startBinding && item.endBinding).length, 5, `Mermaid associations, include, extend, and generalization become attached connectors: ${JSON.stringify(usecaseElements.filter(item => item.type === "line").map(item => [item.componentRole, item.startBinding?.elementId, item.endBinding?.elementId]))}`);
const includeConnector = usecaseElements.find(item => item.componentRole?.startsWith("mermaid-usecase-edge:") && decodeURIComponent(item.componentRole).includes("include"));
assert.equal(includeConnector?.lineStyle, "dashed", "use case include relationships keep UML dashed styling");
const usecaseExport = mermaidExtended.exportExtendedMermaid("usecase", usecaseElements, usecaseSource);
assert.ok(usecaseExport.includes('systemBoundary Checkout["Checkout service"]') && usecaseExport.includes("Begin ..> : include Payment") && usecaseExport.includes("Discount ..> : extend Begin"), "use case source export preserves boundary names and typed relationships");
const usecaseRoundTrip = mermaidExtended.layoutExtendedMermaid(usecaseExport, { x: 0, y: 0 }).elements;
const usecaseOrderSource = `usecase-beta
direction TD
Customer --> Login
actor Customer
Login("Sign in")
systemBoundary "Order system"
  actor Clerk("Payment clerk")
  Authorize("Authorize payment")
end
Clerk --> Authorize
"Reset password"`;
const usecaseOrderElements = mermaidExtended.layoutExtendedMermaid(usecaseOrderSource, { x: 0, y: 0 }).elements;
assert.equal(usecaseOrderElements.filter(item => item.type === "group" && item.libraryComponent?.kind === "uml-actor").length, 2, "use case actor declarations retain their type when relationships precede them and inside system boundaries");
assert.equal(usecaseOrderElements.filter(item => item.type === "group" && item.libraryComponent?.kind === "uml-use-case").length, 3, "use cases declared after edges and as quoted labels stay editable");
const usecaseOrderExport = mermaidExtended.exportExtendedMermaid("usecase", usecaseOrderElements, usecaseOrderSource);
assert.ok(usecaseOrderExport.includes("direction TD") && usecaseOrderExport.includes('systemBoundary Order_system["Order system"]'), "use case source export preserves layout direction and quoted boundary titles");
const ishikawaSource = extendedMermaidCases.find(([type]) => type === "ishikawa")[1];
const ishikawaElements = mermaidExtended.layoutExtendedMermaid(ishikawaSource, { x: 0, y: 0 }).elements;
assert.ok(ishikawaElements.some(item => item.type === "line" && item.id === "mermaid-ishikawa-spine"), "Ishikawa source creates an editable fishbone spine");
assert.equal(ishikawaElements.filter(item => item.type === "line" && item.startBinding && item.endBinding).length, 18, "Ishikawa hierarchy creates bound editable cause branches");
const editedIshikawa = ishikawaElements.map(item => item.type === "rectangle" && item.label?.text === "Out of focus" ? { ...item, label: { ...item.label, text: "Focus failure" } } : item);
const ishikawaExport = mermaidExtended.exportExtendedMermaid("ishikawa", editedIshikawa, ishikawaSource);
assert.ok(ishikawaExport.includes("Focus failure") && ishikawaExport.includes("            Damaged lens"), `Ishikawa edits export back with their nested cause indentation: ${JSON.stringify(ishikawaExport)}`);
assert.equal(mermaidExtended.layoutExtendedMermaid(ishikawaExport, { x: 0, y: 0 }).elements.filter(item => item.id?.startsWith("mermaid-node:")).length, ishikawaElements.filter(item => item.id?.startsWith("mermaid-node:")).length, "Ishikawa causes survive source round-trip");
assert.throws(() => mermaidExtended.layoutExtendedMermaid("ishikawa-beta\nProblem"), /at least one indented cause/, "Ishikawa source requires a cause beneath its problem");
assert.throws(() => mermaidExtended.layoutExtendedMermaid("ishikawa-beta\nProblem\nCause"), /indented beneath its parent/, "Ishikawa cause indentation is validated");
assert.throws(() => mermaidExtended.layoutExtendedMermaid("usecase-beta\nsystemBoundary Store\n  Login\n  User --> Login\nend"), /relationships must be outside system boundaries/, "relationships inside system boundaries fail explicitly");
assert.equal(usecaseRoundTrip.filter(item => item.type === "group" && item.libraryComponent?.kind === "uml-actor").length, 2, "editable use case actors survive source round-trip");
assert.equal(usecaseRoundTrip.filter(item => item.type === "group" && item.libraryComponent?.kind === "uml-use-case").length, 2, "editable oval use cases survive source round-trip");
assert.throws(() => mermaidExtended.layoutExtendedMermaid("usecase-beta\nactor User@{ type: hollow }", { x: 0, y: 0 }), /Unsupported Mermaid use case declaration|Unsupported Mermaid use case syntax/, "unsupported use case actor metadata is reported instead of dropped");
assert.throws(() => mermaidExtended.layoutExtendedMermaid("quadrantChart\n  unsupported directive", { x: 0, y: 0 }), /line 2/, "Unsupported Mermaid directives identify their source line");
const treeViewSource = fixture("treeview.mmd");
const treeViewElements = mermaidExtended.layoutExtendedMermaid(treeViewSource, { x: 0, y: 0 }).elements;
const treeViewNodes = treeViewElements.filter(item => item.type === "rectangle" && item.componentRole?.startsWith("mermaid-treeview-node:"));
assert.equal(treeViewNodes.length, 6, "TreeView indentation and box-drawing rows create editable nodes");
assert.equal(treeViewElements.filter(item => item.type === "line" && item.startBinding && item.endBinding).length, 4, "TreeView hierarchy creates attached parent-child relationships");
assert.equal(treeViewNodes.find(item => item.id === "mermaid-node:tree_1").fillColor, "#fff4c2", "TreeView highlight annotation applies its built-in visual style");
assert.ok(treeViewNodes.find(item => item.id === "mermaid-node:tree_3").tooltip.includes("logos:typescript"), "External TreeView icons remain visible as an identified text fallback");
assert.ok(treeViewElements.some(item => item.type === "text" && item.text === "main component"), "TreeView inline descriptions become editable text objects");
const editedTreeView = treeViewElements.map(item => item.id === "mermaid-node:tree_3" ? { ...item, label: { ...item.label, text: "◇ logos:typescript Application.tsx" } } : item);
const treeViewExport = mermaidExtended.exportExtendedMermaid("treeview", editedTreeView, treeViewSource);
assert.ok(treeViewExport.startsWith("---\nconfig:\n  treeView:\n    showIcons: true\n---\ntreeView-beta"), "TreeView export preserves its icon configuration");
assert.ok(treeViewExport.includes("Application.tsx icon(logos:typescript) ## main component"), `TreeView edits and annotations export to Mermaid source: ${treeViewExport}`);
const treeViewAgain = mermaidExtended.layoutExtendedMermaid(treeViewExport, { x: 0, y: 0 }).elements;
assert.equal(treeViewAgain.filter(item => item.type === "rectangle" && item.componentRole?.startsWith("mermaid-treeview-node:")).length, 6, "TreeView nodes survive edit and source round-trip");
const treeViewGroup = { type: "group", id: "treeview-sketch-fixture", elements: treeViewAgain, mermaid: { format: "mermaid", diagramType: "treeview", source: treeViewExport } };
const reopenedTreeView = sketchParser.parseSketchFile({ format: "SketchDraw", version: sketchModel.SKETCH_FORMAT_VERSION, canvas: { activePageId: "treeview", pages: [{ id: "treeview", name: "TreeView", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" }, elements: [treeViewGroup] }] } });
assert.equal(reopenedTreeView.pages[0].elements[0].mermaid.diagramType, "treeview", "TreeView source family metadata survives .sketch save/reopen normalization");
for (const type of ["pie", "xychart", "packet", "architecture", "radar", "treemap", "venn", "usecase", "ishikawa", "treeview", "swimlane", "cynefin", "wardley", "eventmodeling", "zenuml"]) {
  const group = { type: "group", id: `mermaid-${type}-metadata`, elements: [], mermaid: { format: "mermaid", diagramType: type, source: `${type}-fixture` } };
  const reopened = sketchParser.parseSketchFile({ format: "SketchDraw", version: sketchModel.SKETCH_FORMAT_VERSION, canvas: { activePageId: "metadata", pages: [{ id: "metadata", name: "Metadata", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" }, elements: [group] }] } });
  assert.equal(reopened.pages[0].elements[0].mermaid.diagramType, type, `${type} family metadata survives .sketch save/reopen normalization`);
}
const swimlaneSource = fixture("swimlane.mmd");
const swimlaneElements = mermaidExtended.layoutExtendedMermaid(swimlaneSource, { x: 0, y: 0 }).elements;
const swimlaneLanes = swimlaneElements.filter(item => item.type === "rectangle" && item.componentRole?.startsWith("mermaid-swimlane-lane:"));
const swimlaneNodes = swimlaneElements.filter(item => item.id?.startsWith("mermaid-node:"));
const swimlaneEdges = swimlaneElements.filter(item => item.id?.startsWith("mermaid-link:"));
assert.equal(swimlaneLanes.length, 2, "Mermaid swimlanes create one editable responsibility lane per top-level subgraph");
assert.equal(swimlaneNodes.length, 4, "Mermaid swimlane flowchart nodes remain individually editable");
assert.equal(swimlaneEdges.length, 3, "Mermaid swimlane handoffs remain editable, bound connectors");
assert.ok(swimlaneEdges.every(item => item.startBinding && item.endBinding), "swimlane edges bind to their source and target nodes");
assert.ok(swimlaneSource.includes("theme: default") && swimlaneSource.includes("accDescr:"), "the fixture exercises Mermaid frontmatter and accessibility metadata");
const changedSwimlaneNode = { ...swimlaneNodes.find(item => item.id === "mermaid-node:review"), label: { ...swimlaneNodes.find(item => item.id === "mermaid-node:review").label, text: "Approve request?" } };
const editedSwimlane = swimlaneElements.map(item => item.id === changedSwimlaneNode.id ? changedSwimlaneNode : item);
const swimlaneExport = mermaidExtended.exportExtendedMermaid("swimlane", editedSwimlane, swimlaneSource);
assert.ok(swimlaneExport.startsWith("---\nconfig:"), "swimlane export preserves original Mermaid configuration frontmatter");
assert.match(swimlaneExport, /accTitle: Order approval/);
assert.match(swimlaneExport, /review\{\"Approve request\?\"\}/, "edited node labels round-trip into swimlane source");
assert.match(swimlaneExport, /\|New order\|/, "edge labels are retained when exporting the swimlane model");
const swimlaneRoundTrip = mermaidExtended.layoutExtendedMermaid(swimlaneExport, { x: 0, y: 0 }).elements;
assert.equal(swimlaneRoundTrip.filter(item => item.type === "rectangle" && item.componentRole?.startsWith("mermaid-swimlane-lane:")).length, 2, "swimlane lanes survive source round-trip");
assert.equal(swimlaneRoundTrip.filter(item => item.id?.startsWith("mermaid-link:")).length, 3, "swimlane handoffs survive source round-trip");
assert.equal(swimlaneRoundTrip.find(item => item.id === "mermaid-node:review")?.label?.text, "Approve request?", "edited swimlane labels survive source round-trip");
assert.throws(() => mermaidExtended.layoutExtendedMermaid("swimlane-beta LR\nsubgraph Sales\n  subgraph Team\n    a[Task]\n  end\nend", { x: 0, y: 0 }), /Nested Mermaid swimlane lanes/, "nested swimlane lanes are rejected explicitly");
assert.throws(() => mermaidExtended.layoutExtendedMermaid("swimlane-beta\nsubgraph Sales\n  a[Task]\nend\nclassDef alert fill:#f00", { x: 0, y: 0 }), /line 5, column 1/, "unsupported swimlane styling reports its exact source location");
const swimlaneGroup = { type: "group", id: "swimlane-sketch-fixture", elements: swimlaneRoundTrip, mermaid: { format: "mermaid", diagramType: "swimlane", source: swimlaneExport } };
const reopenedSwimlane = sketchParser.parseSketchFile({ format: "SketchDraw", version: sketchModel.SKETCH_FORMAT_VERSION, canvas: { activePageId: "swimlane", pages: [{ id: "swimlane", name: "Swimlane", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" }, elements: [swimlaneGroup] }] } });
assert.equal(reopenedSwimlane.pages[0].elements[0].mermaid.diagramType, "swimlane", "swimlane source family metadata survives .sketch save/reopen normalization");
const cynefinSource = fixture("cynefin.mmd");
const cynefinElements = mermaidExtended.layoutExtendedMermaid(cynefinSource, { x: 0, y: 0 }).elements;
const cynefinDomains = cynefinElements.filter(item => item.type === "rectangle" || item.type === "circle" ? item.componentRole?.startsWith("mermaid-cynefin-domain:") : false);
const cynefinCards = cynefinElements.filter(item => item.type === "rectangle" && item.componentRole?.startsWith("mermaid-cynefin-item:") === true);
const cynefinTransitions = cynefinElements.filter(item => (item.type === "arrow" || item.type === "line") && item.componentRole?.startsWith("mermaid-cynefin-transition:") === true);
assert.equal(cynefinDomains.length, 5, "Cynefin creates five editable framework regions");
assert.equal(cynefinCards.length, 9, "Cynefin creates editable cards for each domain item");
assert.equal(cynefinCards.filter(item => item.componentRole.startsWith("mermaid-cynefin-item:confusion:")).length, 3, "Cynefin keeps the central Confusion region to three visible item cards");
assert.equal(cynefinElements.filter(item => item.type === "rectangle" && item.componentRole?.startsWith("mermaid-cynefin-overflow:")).length, 1, "Cynefin shows an overflow badge for additional Confusion items");
assert.equal(cynefinTransitions.length, 4, "Cynefin transition arrows bind to their editable domain regions and Mermaid self-loops are ignored");
assert.ok(cynefinTransitions.every(item => item.startBinding && item.endBinding), "Cynefin transitions remain attached when domains move");
assert.ok(cynefinElements.some(item => item.id === "mermaid-cynefin-boundary-vertical") && cynefinElements.some(item => item.id === "mermaid-cynefin-boundary-horizontal"), "Cynefin structural boundaries stay visible with domain descriptions enabled");
assert.ok(cynefinSource.includes("themeVariables:") && cynefinSource.includes("accTitle:") && cynefinSource.includes("accDescr:"), "Cynefin fixture exercises theme configuration and accessibility directives");
const changedCynefinCard = cynefinCards.find(item => item.componentRole === "mermaid-cynefin-item:complex:0");
const editedCynefin = cynefinElements.map(item => item === changedCynefinCard ? { ...item, label: { ...item.label, text: "Investigate service regression" } } : item.type === "text" && item.componentRole === "mermaid-cynefin-title" ? { ...item, text: "Updated incident response map" } : item.type === "arrow" && item.componentRole?.startsWith("mermaid-cynefin-transition:") ? { ...item, label: { ...item.label, text: "Evidence found" } } : item);
const cynefinExport = mermaidExtended.exportExtendedMermaid("cynefin", editedCynefin, cynefinSource);
assert.ok(cynefinExport.startsWith("---\nconfig:"), "Cynefin export preserves Mermaid configuration frontmatter");
assert.ok(cynefinExport.includes("Updated incident response map") && cynefinExport.includes("Investigate service regression") && cynefinExport.includes("Evidence found"), "Cynefin title, item, and transition edits export back to Mermaid source");
assert.match(cynefinExport, /accTitle: Incident response domains/);
assert.match(cynefinExport, /accDescr: A decision map for classifying and moving response work\./);
assert.ok(!cynefinExport.includes("Ignored by Mermaid"), "ignored Cynefin self-loop syntax is not reintroduced on export");
const cynefinRoundTrip = mermaidExtended.layoutExtendedMermaid(cynefinExport, { x: 0, y: 0 }).elements;
assert.equal(cynefinRoundTrip.filter(item => item.type === "rectangle" || item.type === "circle" ? item.componentRole?.startsWith("mermaid-cynefin-domain:") : false).length, 5, "Cynefin regions survive source round-trip");
assert.equal(cynefinRoundTrip.find(item => item.componentRole === "mermaid-cynefin-item:complex:0")?.label?.text, "Investigate service regression", "edited Cynefin item labels survive source round-trip");
assert.equal(cynefinRoundTrip.filter(item => item.componentRole?.startsWith("mermaid-cynefin-transition:")).length, 4, "Cynefin transitions survive source round-trip");
const cynefinWithoutDescriptions = mermaidExtended.layoutExtendedMermaid(cynefinSource.replace("showDomainDescriptions: true", "showDomainDescriptions: false"), { x: 0, y: 0 }).elements;
assert.ok(cynefinWithoutDescriptions.some(item => item.id === "mermaid-cynefin-boundary-vertical") && cynefinWithoutDescriptions.some(item => item.id === "mermaid-cynefin-boundary-horizontal"), "hiding Cynefin descriptions does not remove its structural boundaries");
assert.throws(() => mermaidExtended.layoutExtendedMermaid('cynefin-beta\ncomplex\n  unquoted item', { x: 0, y: 0 }), /line 3, column 3/, "unsupported Cynefin item syntax points to the source location");
const cynefinGroup = { type: "group", id: "cynefin-sketch-fixture", elements: cynefinRoundTrip, mermaid: { format: "mermaid", diagramType: "cynefin", source: cynefinExport } };
const reopenedCynefin = sketchParser.parseSketchFile({ format: "SketchDraw", version: sketchModel.SKETCH_FORMAT_VERSION, canvas: { activePageId: "cynefin", pages: [{ id: "cynefin", name: "Cynefin", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" }, elements: [cynefinGroup] }] } });
assert.equal(reopenedCynefin.pages[0].elements[0].mermaid.diagramType, "cynefin", "Cynefin source family metadata survives .sketch save/reopen normalization");
const wardleySource = fixture("wardley.mmd");
const wardleyElements = mermaidExtended.layoutExtendedMermaid(wardleySource, { x: 0, y: 0 }).elements;
const wardleyNodes = wardleyElements.filter(item => ["rectangle", "circle", "diamond", "triangle", "flowchart"].includes(item.type) && item.componentRole?.startsWith("mermaid-wardley-node:") === true);
const wardleyLinks = wardleyElements.filter(item => item.type === "arrow" && item.componentRole?.startsWith("mermaid-wardley-link:") === true);
const wardleyTrends = wardleyElements.filter(item => item.type === "arrow" && item.componentRole?.startsWith("mermaid-wardley-trend:") === true);
assert.equal(wardleyNodes.length, 7, "Wardley maps create editable anchors, components, and pipeline members");
assert.equal(wardleyLinks.length, 6, "Wardley dependencies, directed flows, and labeled links become editable arrows");
assert.ok(wardleyLinks.every(item => item.startBinding && item.endBinding), "Wardley dependency arrows stay bound to their component nodes");
assert.equal(wardleyTrends.length, 2, "Wardley evolution and trend arrows remain editable");
assert.equal(wardleyElements.filter(item => item.type === "rectangle" && item.componentRole?.startsWith("mermaid-wardley-marker:")).length, 4, "Wardley notes, accelerators, deaccelerators, and numbered annotations become editable cards");
assert.equal(wardleyElements.filter(item => item.type === "text" && item.componentRole?.startsWith("mermaid-wardley-stage:")).length, 4, "Wardley custom evolution stages become editable axis labels");
const changedWardleyLabel = wardleyElements.find(item => item.type === "text" && item.text === "API");
const editedWardley = wardleyElements.map(item => item === changedWardleyLabel ? { ...item, text: "Public API" } : item);
const wardleyExport = mermaidExtended.exportExtendedMermaid("wardley", editedWardley, wardleySource);
assert.match(wardleyExport, /component "Public API" \[0\.650, 0\.640\]/, "Wardley component labels and normalized positions export to source");
assert.match(wardleyExport, /pipeline "Data Platform" \{/);
assert.match(wardleyExport, /evolve "Public API" 0\.820/);
assert.match(wardleyExport, /\+\'calls\'>/);
assert.match(wardleyExport, /annotations \[/);
const wardleyRoundTrip = mermaidExtended.layoutExtendedMermaid(wardleyExport, { x: 0, y: 0 }).elements;
assert.equal(wardleyRoundTrip.filter(item => item.componentRole?.startsWith("mermaid-wardley-node:")).length, 7, "Wardley nodes and pipeline members survive editable source round-trip");
assert.equal(wardleyRoundTrip.filter(item => item.componentRole?.startsWith("mermaid-wardley-link:")).length, 6, "Wardley dependency relationships survive source round-trip");
assert.ok(wardleyRoundTrip.some(item => item.type === "text" && item.text === "Public API"), "edited Wardley component names survive source round-trip");
assert.throws(() => mermaidExtended.layoutExtendedMermaid("wardley-beta\ncomponent API [0.5, 0.5]\nAPI -> Missing", { x: 0, y: 0 }), /unknown component Missing.*line 3/, "Wardley unresolved component references report their line");
assert.throws(() => mermaidExtended.layoutExtendedMermaid("---\ntheme: dark\n---\nwardley-beta\ncomponent API [0.5, 0.5]", { x: 0, y: 0 }), /theme overrides are preserved but not rendered/, "Wardley theme settings are rejected explicitly instead of being ignored");
const eventModelingSource = fixture("eventmodeling.mmd");
const eventModelingElements = mermaidExtended.layoutExtendedMermaid(eventModelingSource, { x: 0, y: 0 }).elements;
const eventFrames = eventModelingElements.filter(item => item.type === "rectangle" && item.componentRole?.startsWith("mermaid-eventmodeling-frame:") === true);
const eventLanes = eventModelingElements.filter(item => item.type === "rectangle" && item.componentRole?.startsWith("mermaid-eventmodeling-lane:") === true);
const eventData = eventModelingElements.filter(item => item.type === "rectangle" && item.componentRole?.startsWith("mermaid-eventmodeling-data:") === true);
const eventLinks = eventModelingElements.filter(item => item.type === "arrow" && item.componentRole?.startsWith("mermaid-eventmodeling-link:") === true);
const eventDataLinks = eventModelingElements.filter(item => item.type === "arrow" && item.componentRole?.startsWith("mermaid-eventmodeling-data-link:") === true);
assert.equal(eventFrames.length, 9, "Event Modeling accepts compact and relaxed timeframe declarations");
assert.equal(eventLanes.length, 7, "Event Modeling infers swimlanes from entity type and namespace");
assert.equal(eventData.length, 2, "Event Modeling data blocks become editable data cards");
assert.equal(eventLinks.filter(item => decodeURIComponent(item.componentRole.slice(item.componentRole.indexOf(":") + 1)).includes('"kind":"inferred"')).length, 7, "Event Modeling infers sequential links and resets inference at reset frames");
assert.equal(eventLinks.filter(item => decodeURIComponent(item.componentRole.slice(item.componentRole.indexOf(":") + 1)).includes('"kind":"explicit"')).length, 3, "Event Modeling ->> references create explicit relationships");
assert.equal(eventDataLinks.length, 2, "Timeframe data references attach to their editable data blocks");
assert.ok([...eventLinks, ...eventDataLinks].every(item => item.startBinding && item.endBinding), "Event Modeling relationships remain bound to their timeframe and data cards");
const changedEventFrame = eventFrames.find(item => item.id === "mermaid-eventmodeling-frame:02");
const editedEventFrames = eventModelingElements.map(item => item === changedEventFrame ? { ...item, label: { ...item.label, text: "02 · Add catalogue item\ncommand\nExample:\ndescription: 'Book', quantity: 2" } } : item);
const eventModelingExport = mermaidExtended.exportExtendedMermaid("eventmodeling", editedEventFrames, eventModelingSource);
assert.match(eventModelingExport, /tf 02 cmd "Add catalogue item" \{ description: 'Book', quantity: 2 \}/);
assert.match(eventModelingExport, /tf 04 rmo CartItems ->> 02 ->> 03/);
assert.match(eventModelingExport, /rf 05 evt External.InventoryChanged ->> 03/);
assert.match(eventModelingExport, /data CartSummary `json` \{/);
const eventModelingRoundTrip = mermaidExtended.layoutExtendedMermaid(eventModelingExport, { x: 0, y: 0 }).elements;
assert.equal(eventModelingRoundTrip.filter(item => item.type === "rectangle" && item.componentRole?.startsWith("mermaid-eventmodeling-frame:") === true).length, 9, "Event Modeling timeframes survive source round-trip");
assert.equal(eventModelingRoundTrip.find(item => item.id === "mermaid-eventmodeling-frame:02")?.label?.text.split("\n")[0], "02 · Add catalogue item", "Edited Event Modeling entities survive source round-trip");
assert.throws(() => mermaidExtended.layoutExtendedMermaid("eventmodeling\ntf 01 ui A\ntf 01 evt B", { x: 0, y: 0 }), /timeframe number 01 is used more than once.*line 3/, "duplicate Event Modeling timeframe IDs fail at the source line");
assert.throws(() => mermaidExtended.layoutExtendedMermaid("eventmodeling\ntf 01 evt A ->> 02", { x: 0, y: 0 }), /unknown timeframe 02.*line 2/, "unresolved Event Modeling explicit links report the source line");

const zenUmlSource = fixture("zenuml.mmd");
const zenUmlElements = mermaidExtended.layoutExtendedMermaid(zenUmlSource, { x: 0, y: 0 }).elements;
const zenUmlParticipants = zenUmlElements.filter(item => item.type === "group" && item.componentRole?.startsWith("mermaid-zenuml-participant:") === true);
const zenUmlMessages = zenUmlElements.filter(item => item.type === "arrow" && item.id?.startsWith("mermaid-zenuml-message:") === true);
const zenUmlCalls = zenUmlElements.filter(item => item.type === "arrow" && item.id?.startsWith("mermaid-zenuml-call:") === true);
assert.equal(zenUmlParticipants.length, 5, "ZenUML declarations, aliases, and implicit participants become editable lifelines");
assert.equal(zenUmlMessages.length, 8, "ZenUML async messages, parallel messages, and replies remain editable connectors");
assert.ok(zenUmlMessages.every(item => item.startBinding && item.endBinding), "ZenUML messages bind to their editable participants");
assert.ok(zenUmlCalls.some(item => item.label?.text === "validateOrder(orderId)"), "ZenUML synchronous method calls are visible as editable messages");
assert.ok(zenUmlCalls.some(item => item.label?.text === "loadOrder() -> saved"), "ZenUML typed assignments remain visible on synchronous calls");
assert.equal(zenUmlElements.filter(item => item.type === "rectangle" && item.componentRole?.startsWith("mermaid-zenuml-fragment:") === true).length, 7, "ZenUML loop, optional, conditional, parallel, and try fragments become editable frames");
const changedZenMessage = zenUmlMessages[0];
const editedZenUml = zenUmlElements.map(item => item === changedZenMessage ? { ...item, label: { ...item.label, text: "Submit order" } } : item).map(item => item.type === "text" && item.id === "mermaid-zenuml-title" ? { ...item, text: "Updated order interaction" } : item).map(item => item.type === "group" && item.libraryComponent?.label === "Store client" ? { ...item, libraryComponent: { ...item.libraryComponent, label: "Shop browser" } } : item).map(item => item.type === "rectangle" && item.componentRole?.startsWith("mermaid-zenuml-fragment:") === true && item.id?.startsWith("mermaid-zenuml-fragment:9") ? { ...item, label: { ...item.label, text: "if (orderIsValid)" } } : item);
const zenUmlExport = mermaidExtended.exportExtendedMermaid("zenuml", editedZenUml, zenUmlSource);
assert.ok(zenUmlExport.includes("Customer->API: Submit order") && zenUmlExport.includes("title Updated order interaction") && zenUmlExport.includes("Web as \"Shop browser\"") && zenUmlExport.includes("if (orderIsValid)"), "ZenUML message, participant, fragment, and title edits round-trip to source");
const zenUmlRoundTrip = mermaidExtended.layoutExtendedMermaid(zenUmlExport, { x: 0, y: 0 }).elements;
assert.equal(zenUmlRoundTrip.filter(item => item.type === "group" && item.componentRole?.startsWith("mermaid-zenuml-participant:")).length, 5, "ZenUML participants survive source round-trip");
assert.equal(zenUmlRoundTrip.find(item => item.type === "arrow" && item.label?.text === "Submit order")?.label?.text, "Submit order", "ZenUML edited message labels survive source round-trip");
assert.throws(() => mermaidExtended.layoutExtendedMermaid("zenuml\nA ++ B", { x: 0, y: 0 }), /Unsupported Mermaid ZenUML syntax.*line 2, column 1/, "unsupported ZenUML syntax has a line and column diagnostic");
const zenUmlGroup = { type: "group", id: "zenuml-sketch-fixture", elements: zenUmlRoundTrip, mermaid: { format: "mermaid", diagramType: "zenuml", source: zenUmlExport } };
const reopenedZenUml = sketchParser.parseSketchFile({ format: "SketchDraw", version: sketchModel.SKETCH_FORMAT_VERSION, canvas: { activePageId: "zenuml", pages: [{ id: "zenuml", name: "ZenUML", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" }, elements: [zenUmlGroup] }] } });
assert.equal(reopenedZenUml.pages[0].elements[0].mermaid.diagramType, "zenuml", "ZenUML family metadata survives .sketch save/reopen normalization");
assert.throws(() => mermaidExtended.layoutExtendedMermaid("treeView-beta\n  Root\nChild", { x: 0, y: 0 }), /line 3, column 1/, "TreeView indentation errors identify their original line and column");
assert.throws(() => mermaidExtended.layoutExtendedMermaid("treeView-beta\n├── Root\n    Child", { x: 0, y: 0 }), /cannot mix indentation and box-drawing.*line 3, column 5/, "TreeView rejects mixed input styles at the exact source position");
const mindmapDiagram = mermaidExtended.layoutExtendedMermaid(extendedMermaidCases.find(([type]) => type === "mindmap")[1], { x: 0, y: 0 }).elements;
assert.equal(mindmapDiagram.filter(item => (item.type === "line" || item.type === "arrow") && item.id?.startsWith("mermaid-link:") && item.startBinding && item.endBinding).length, 4, "Mind map hierarchy becomes attached native relationships");
const requirementDiagram = mermaidExtended.layoutExtendedMermaid(extendedMermaidCases.find(([type]) => type === "requirement")[1], { x: 0, y: 0 }).elements;
assert.ok(requirementDiagram.some(item => item.type !== "group" && item.label?.text.includes("risk: high")), "Requirement properties remain editable on nodes");
assert.equal(requirementDiagram.filter(item => item.type === "line").length, 1, "Requirement relations become editable connectors");
const quadrantDiagram = mermaidExtended.layoutExtendedMermaid(extendedMermaidCases.find(([type]) => type === "quadrant")[1], { x: 0, y: 0 }).elements;
assert.ok(quadrantDiagram.some(item => item.type === "text" && item.text === "High impact"), "Quadrant axes remain editable labels");
const kanbanDiagram = mermaidExtended.layoutExtendedMermaid(extendedMermaidCases.find(([type]) => type === "kanban")[1], { x: 0, y: 0 }).elements;
assert.equal(kanbanDiagram.filter(item => item.type !== "group" && item.id?.startsWith("mermaid-node:")).length, 5, "Kanban columns and tasks become editable cards");
const sankeyDiagram = mermaidExtended.layoutExtendedMermaid(extendedMermaidCases.find(([type]) => type === "sankey")[1], { x: 0, y: 0 }).elements;
assert.equal(sankeyDiagram.filter(item => (item.type === "line" || item.type === "arrow") && item.startBinding && item.endBinding).length, 4, "Sankey weights become editable attached relationships");
assert.ok(sankeyDiagram.some(item => (item.type === "line" || item.type === "arrow") && item.label?.text === "4"), "Sankey flow values remain visible");
const blockSource = "block-beta\n  title Service layout\n  columns 3\n  client[Client] api:2\n  database queue worker";
const blockDiagram = mermaidExtended.layoutExtendedMermaid(blockSource, { x: 0, y: 0 }).elements;
assert.equal(blockDiagram.filter(item => item.type === "rectangle" && item.id?.startsWith("mermaid-node:")).length, 5, "Block diagrams produce editable grid cells");
assert.ok(blockDiagram.some(item => item.type === "rectangle" && item.w > 230), "Block column spans affect shape geometry");
const blockExport = mermaidExtended.exportExtendedMermaid("block", blockDiagram, blockSource);
assert.equal(mermaidExtended.layoutExtendedMermaid(blockExport, { x: 0, y: 0 }).elements.filter(item => item.type === "rectangle" && item.id?.startsWith("mermaid-node:")).length, 5, "Block cells survive source export and reimport");
const pieSource = extendedMermaidCases.find(([type]) => type === "pie")[1];
const pieDiagram = mermaidExtended.layoutExtendedMermaid(pieSource, { x: 0, y: 0 });
const pieChart = pieDiagram.elements.find(item => item.type === "group" && item.libraryComponent?.kind === "viz-pie");
assert.deepEqual(pieChart?.libraryComponent?.chartData?.labels, ["Desktop", "Tablet", "Phone"], "Mermaid pie slices become editable chart categories");
assert.deepEqual(pieChart?.libraryComponent?.chartData?.values, [46, 35, 19], "Mermaid pie values reach the native chart model");
pieChart.libraryComponent.chartData.labels[0] = "Workstation";
const pieExport = mermaidExtended.exportExtendedMermaid("pie", pieDiagram.elements, pieSource);
assert.match(pieExport, /"Workstation"\s*:\s*46/, "Pie chart edits export back into Mermaid source");
assert.equal(mermaidExtended.layoutExtendedMermaid(pieExport, { x: 0, y: 0 }).elements[0].libraryComponent.chartData.labels[0], "Workstation", "Pie edits survive export and reimport");
const xySource = extendedMermaidCases.find(([type]) => type === "xychart")[1];
const xyDiagram = mermaidExtended.layoutExtendedMermaid(xySource, { x: 0, y: 0 });
const xyChart = xyDiagram.elements.find(item => item.type === "group" && item.libraryComponent?.kind === "viz-line");
assert.deepEqual(xyChart?.libraryComponent?.chartData?.series?.map(item => item.chartType), ["line", "bar"], "Mermaid XY series preserve line and bar types");
assert.equal(xyChart?.libraryComponent?.chartData?.options?.maxValue, 100, "Mermaid XY value-axis bounds remain editable chart settings");
xyChart.libraryComponent.chartData.series[0].values[1] = 52;
const xyExport = mermaidExtended.exportExtendedMermaid("xychart", xyDiagram.elements, xySource);
assert.match(xyExport, /line \[28, 52, 38\]/, "XY chart edits export to their matching Mermaid series");
assert.equal(mermaidExtended.layoutExtendedMermaid(xyExport, { x: 0, y: 0 }).elements[0].libraryComponent.chartData.series[0].values[1], 52, "XY chart edits survive export and reimport");
const packetSource = extendedMermaidCases.find(([type]) => type === "packet")[1];
const packetDiagram = mermaidExtended.layoutExtendedMermaid(packetSource, { x: 0, y: 0 });
assert.equal(packetDiagram.elements.filter(item => item.type === "rectangle" && item.id?.startsWith("mermaid-node:")).length, 5, "Packet fields become editable bit-range shapes");
assert.ok(packetDiagram.elements.some(item => item.type === "rectangle" && item.w === 8 * 24), "Packet +bits fields use the next available bit range");
const packetExport = mermaidExtended.exportExtendedMermaid("packet", packetDiagram.elements, packetSource);
assert.equal(mermaidExtended.layoutExtendedMermaid(packetExport, { x: 0, y: 0 }).elements.filter(item => item.type === "rectangle" && item.id?.startsWith("mermaid-node:")).length, 5, "Packet fields survive source export and reimport");
assert.throws(() => mermaidExtended.layoutExtendedMermaid("packet-beta\n  %%{init: { 'packet': { 'bitsPerRow': 16 } }}%%\n  0-3: \"Version\"", { x: 0, y: 0 }), /line 2/, "Unsupported packet configuration reports its source line");
const architectureMermaidSource = extendedMermaidCases.find(([type]) => type === "architecture")[1];
const architectureDiagram = mermaidExtended.layoutExtendedMermaid(architectureMermaidSource, { x: 0, y: 0 });
assert.equal(architectureDiagram.elements.filter(item => (item.type === "line" || item.type === "arrow") && item.startBinding && item.endBinding).length, 2, "Architecture relationships are attached to editable service nodes");
const architectureExport = mermaidExtended.exportExtendedMermaid("architecture", architectureDiagram.elements, architectureMermaidSource);
const architectureAgain = mermaidExtended.layoutExtendedMermaid(architectureExport, { x: 0, y: 0 });
assert.equal(architectureAgain.elements.filter(item => item.type === "rectangle" && item.id?.startsWith("mermaid-node:")).length, 4, "Architecture groups and services survive source export and reimport");
assert.throws(() => mermaidExtended.layoutExtendedMermaid("architecture-beta\n  service api(server)[API] in unknown", { x: 0, y: 0 }), /line 2/, "Undefined architecture groups are rejected with a source line");
assert.throws(() => mermaidExtended.layoutExtendedMermaid("xychart-beta horizontal\n  line [1, 2]", { x: 0, y: 0 }), /line 1/, "Unsupported XY orientation reports its source line");
const radarSource = extendedMermaidCases.find(([type]) => type === "radar")[1];
const radarDiagram = mermaidExtended.layoutExtendedMermaid(radarSource, { x: 0, y: 0 });
const radarChart = radarDiagram.elements.find(item => item.type === "group" && item.libraryComponent?.kind === "viz-radar");
assert.deepEqual(radarChart?.libraryComponent?.chartData?.labels, ["Performance", "Usability", "Scale"], "Radar axes retain their readable labels");
assert.deepEqual(radarChart?.libraryComponent?.chartData?.axisIds, ["performance", "usability", "scale"], "Radar axes retain their stable IDs");
assert.deepEqual(radarChart?.libraryComponent?.chartData?.series?.[2]?.values, [5, 4, 4], "Radar key/value curves map to the declared axis order");
assert.equal(radarChart?.libraryComponent?.chartData?.options?.radarGraticule, "polygon", "Radar graticule selection reaches the chart renderer");
radarChart.libraryComponent.chartData.series[1].values[0] = 2;
const radarExport = mermaidExtended.exportExtendedMermaid("radar", radarDiagram.elements, radarSource);
assert.match(radarExport, /curve curve_2\["Target"\]\{2, 5, 3\}/, "Radar curve edits export as editable Mermaid values");
const radarAgain = mermaidExtended.layoutExtendedMermaid(radarExport, { x: 0, y: 0 });
assert.equal(radarAgain.elements[0].libraryComponent.chartData.series[1].values[0], 2, "Radar edits survive source export and reimport");
assert.equal(radarAgain.elements[0].libraryComponent.chartData.options.radarTicks, 4, "Radar tick count survives round trip");
const treemapSource = extendedMermaidCases.find(([type]) => type === "treemap")[1];
const treemapDiagram = mermaidExtended.layoutExtendedMermaid(treemapSource, { x: 0, y: 0 });
const treemapNodes = treemapDiagram.elements.filter(item => item.type === "rectangle" && item.id?.startsWith("mermaid-node:"));
assert.equal(treemapNodes.length, 6, "Treemap hierarchy becomes editable nested rectangles");
const phones = treemapNodes.find(item => item.label?.text.startsWith("Phones")); const electronics = treemapNodes.find(item => item.label?.text.startsWith("Electronics"));
assert.ok(phones.x >= electronics.x && phones.y >= electronics.y && phones.x + phones.w <= electronics.x + electronics.w + 1 && phones.y + phones.h <= electronics.y + electronics.h + 1, "Treemap children tile inside their parent bounds");
phones.label.text = "Phones\n55";
const treemapExport = mermaidExtended.exportExtendedMermaid("treemap", treemapDiagram.elements, treemapSource);
assert.match(treemapExport, /"Phones": 55/, "Treemap value edits export into the source hierarchy");
assert.equal(mermaidExtended.layoutExtendedMermaid(treemapExport, { x: 0, y: 0 }).elements.find(item => item.type === "rectangle" && item.label?.text.startsWith("Phones"))?.label.text, "Phones\n55", "Treemap edits survive export and reimport");
assert.throws(() => mermaidExtended.layoutExtendedMermaid("treemap-beta\n  \"Leaf\"", { x: 0, y: 0 }), /needs a numeric value.*line 2/, "Treemap leaves without values report their source line");
const vennSource = extendedMermaidCases.find(([type]) => type === "venn")[1];
const vennDiagram = mermaidExtended.layoutExtendedMermaid(vennSource, { x: 0, y: 0 });
const vennShapes = vennDiagram.elements.filter(item => item.type === "circle" || item.type === "rectangle" && item.id?.startsWith("mermaid-node:"));
assert.equal(vennShapes.filter(item => item.type === "circle").length, 3, "Venn set definitions become overlapping editable set circles");
assert.equal(vennShapes.length, 9, "Venn unions and nested text remain editable labels");
assert.ok(vennShapes.some(item => item.componentRole?.includes(":20") && item.type === "circle"), "Venn set sizes remain attached to their editable sets");
const frontend = vennShapes.find(item => item.componentRole?.startsWith("mermaid-venn-set:") && item.label?.text === "Frontend");
frontend.label.text = "Web client";
const openApi = vennShapes.find(item => item.componentRole?.includes(":AB1") || item.label?.text === "OpenAPI");
openApi.label.text = "OpenAPI spec";
const vennExport = mermaidExtended.exportExtendedMermaid("venn", vennDiagram.elements, vennSource);
assert.match(vennExport, /set "Frontend Team"\["Web client"\]:20/, "Venn set-label edits retain source IDs and sizes");
assert.match(vennExport, /union "Frontend Team", "Backend"\["Shared APIs"\]:3/, "Venn union members, labels, and sizes export together");
assert.match(vennExport, /union "Frontend Team", "Backend", "Service Ops"\["Shared delivery"\]/, "Higher-arity Venn unions retain every set member");
assert.match(vennExport, /text "AB1"\["OpenAPI spec"\]/, "Venn nested text edits export under their union");
const vennAgain = mermaidExtended.layoutExtendedMermaid(vennExport, { x: 0, y: 0 });
assert.equal(vennAgain.elements.find(item => item.componentRole?.startsWith("mermaid-venn-set:") && item.type === "circle")?.label.text, "Web client", "Venn edits survive source export and reimport");
assert.throws(() => mermaidExtended.layoutExtendedMermaid("venn-beta\n  set A\n  union A,Missing", { x: 0, y: 0 }), /undeclared set Missing.*line 3/, "Venn unions reject undefined set references with source locations");
assert.throws(() => mermaidExtended.layoutExtendedMermaid("venn-beta\n  set A\n  set B\n  style A fill:red", { x: 0, y: 0 }), /style directives are not supported.*line 4/, "Venn style directives produce explicit subset diagnostics");

const dotElements = dot.dotToDiagram(fixture("styles.dot"));
assert.equal(dotElements.filter(item => item.type === "arrow").length, 1);
const dotExport = formats.exportDiagramCode("dot", dotElements);
assert.match(dotExport, /fillcolor="#e8f3ff"/);
assert.match(dotExport, /arrowtail=odot/);
assert.equal(dot.dotToDiagram(dotExport).filter(item => item.type === "arrow").length, 1);

const flattenDot = items => items.flatMap(item => item.type === "group" ? [item, ...flattenDot(item.elements)] : [item]);
const deepDot = dot.dotToDiagram(fixture("deep.dot"));
const deepDotFlat = flattenDot(deepDot);
const ingestCluster = deepDot.find(item => item.type === "group" && item.container?.name === "Ingest");
const deepDotSource = deepDotFlat.find(item => item.liveKey === "source");
const deepDotParser = deepDotFlat.find(item => item.liveKey === "parser");
const deepDotSink = deepDotFlat.find(item => item.liveKey === "sink");
const deepDotFallback = deepDotFlat.find(item => item.liveKey === "fallback");
const deepDotEdges = deepDotFlat.filter(item => item.type === "line" || item.type === "arrow");
assert.ok(ingestCluster, "DOT cluster subgraphs import as editable groups");
assert.ok(ingestCluster.elements.some(item => item.type === "group" && item.container?.name === "Parse"), "nested DOT clusters retain their parent-child structure");
assert.equal(ingestCluster.elements.filter(item => item.type === "line" || item.type === "arrow").length, 1, "cluster-contained edges stay in their cluster");
assert.equal(deepDotFlat.filter(item => item.liveKey === "source" || item.liveKey === "parser" || item.liveKey === "sink").length, 3, "nested noncluster rank subgraphs do not create unintended containers");
assert.equal(deepDotSource.connectionPoints?.find(point => point.name === "out")?.anchor.x, 0.5, "record ports are retained as editable connector points");
assert.equal(deepDotParser.connectionPoints?.find(point => point.name === "input")?.anchor.x, 0.5, "HTML-like label ports are read from table cells");
assert.equal(deepDotParser.label.text, "Parse rows", "HTML-like labels become readable editable text");
assert.match(deepDotParser.tooltip, /simplified to plain text/, "HTML-like label simplification is disclosed");
assert.equal(deepDotSource.color, "#223344", "scoped node defaults apply to later nodes");
assert.equal(deepDotSource.fillColor, "#f0f5ff", "scoped fill defaults apply to later nodes");
assert.equal(deepDotSource.label.color, "#123456", "font defaults apply to later nodes");
assert.equal(deepDotSink.fillColor, "#eaf3ed", "node declarations override graph-scoped defaults");
assert.equal(deepDotFallback.type, "rectangle", "unsupported DOT node shapes receive an editable fallback");
assert.match(deepDotFallback.altText, /Unsupported DOT shape 'nonagon'/);
assert.equal(deepDotEdges.length, 2, "DOT edges import with their chain and cluster membership");
const portEdge = deepDotEdges.find(item => item.startBinding?.elementId === deepDotSource.id);
assert.equal(portEdge.type, "arrow", "bidirectional DOT edges remain editable arrow connectors");
assert.equal(portEdge.startHead, "dot", "DOT arrow-tail symbols map onto the source connector head");
assert.equal(portEdge.endHead, "diamond", "DOT arrow-head symbols map onto the destination connector head");
assert.equal(portEdge.lineStyle, "dotted", "edge defaults retain dotted style");
assert.deepEqual(portEdge.startBinding.anchor, deepDotSource.connectionPoints.find(point => point.name === "out").anchor, "record-port bindings attach to the requested source port");
assert.deepEqual(portEdge.endBinding.anchor, deepDotParser.connectionPoints.find(point => point.name === "input").anchor, "HTML-port bindings attach to the requested destination port");
const deepDotMetadata = JSON.parse(decodeURIComponent(deepDotSource.componentRole.slice("dot-node|".length)));
const deepDotParserMetadata = JSON.parse(decodeURIComponent(deepDotParser.componentRole.slice("dot-node|".length)));
assert.equal(deepDotMetadata.rankdir, "LR", "graph direction is retained for editing and export");
assert.equal(deepDotMetadata.nodesep, 0.35, "node spacing is retained");
assert.equal(deepDotMetadata.ranksep, 0.8, "rank spacing is retained");
assert.equal(deepDotMetadata.ranksepEqually, true, "ranksep equally modifier is retained");
assert.equal(deepDotMetadata.rank, deepDotParserMetadata.rank, "same-rank constraints align the specified nodes");
const deepDotExport = formats.exportDiagramCode("dot", deepDot);
assert.match(deepDotExport, /subgraph cluster_ingest/);
assert.match(deepDotExport, /subgraph cluster_parse/);
assert.match(deepDotExport, /subgraph \{ rank=same;/, "same-rank groups export as rank subgraphs");
assert.match(deepDotExport, /rankdir=LR;/);
assert.match(deepDotExport, /nodesep=0\.35;/);
assert.match(deepDotExport, /ranksep="0\.8 equally";/);
assert.match(deepDotExport, /<out>/, "record port declarations survive DOT export");
assert.match(deepDotExport, /arrowtail=odot/);
assert.match(deepDotExport, /arrowhead=diamond/);
assert.match(deepDotExport, /style=dotted/);
const deepDotAgain = flattenDot(dot.dotToDiagram(deepDotExport));
assert.ok(deepDotAgain.some(item => item.type === "group" && item.container?.name === "Ingest"), "cluster labels survive DOT export and reimport");
assert.ok(deepDotAgain.some(item => item.type === "group" && item.container?.name === "Parse"), "nested clusters survive DOT export and reimport");
assert.ok(deepDotAgain.some(item => item.liveKey === "source" && item.connectionPoints?.some(point => point.name === "out")), "record ports survive DOT export and reimport");
assert.ok(deepDotAgain.some(item => item.type === "arrow" && item.startHead === "dot" && item.endHead === "diamond" && item.startBinding?.elementId === deepDotSource.id && item.endBinding?.elementId === deepDotParser.id), "edge arrowheads, endpoints, and port bindings survive DOT export and reimport");
assert.ok(formats.dotExportLosses(deepDot).some(loss => loss.includes("HTML-like label formatting")), "DOT exports report HTML-label formatting losses");
assert.ok(formats.dotExportLosses(deepDot).some(loss => loss.includes("Unsupported DOT shapes")), "DOT exports report node-shape fallback losses");
assert.match(deepDotExport, /"fallback" \[label="Unmapped shape", shape=box/, "fallback geometry exports as an explicit box shape");

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

const flattenD2 = items => items.flatMap(item => item.type === "group" ? [item, ...flattenD2(item.elements)] : [item]);
const nestedD2Gateway = flattenD2(d2Elements).find(item => item.liveKey === "platform.edge.gateway");
assert.equal(nestedD2Gateway?.d2?.shape, "hexagon", "nested D2 shape attributes apply to their scoped object");
assert.equal(nestedD2Gateway?.d2?.fill, "#dbeafe", "nested D2 style attributes apply to their scoped object");
const d2Advanced = d2.d2ToDiagram(fixture("d2-advanced.d2"));
const d2AdvancedFlat = flattenD2(d2Advanced);
const d2Inventory = d2AdvancedFlat.find(item => item.type === "schemaTable" && item.liveKey === "platform.inventory");
const d2Accounts = d2AdvancedFlat.find(item => item.type === "schemaTable" && item.liveKey === "platform.accounts");
const d2Class = d2AdvancedFlat.find(item => item.type === "group" && item.componentRole?.startsWith("d2-class:"));
const d2Gateway = d2AdvancedFlat.find(item => item.liveKey === "platform.gateway");
const d2Grid = d2AdvancedFlat.find(item => item.type === "group" && item.liveKey === "tiles");
assert.equal(d2Inventory?.type, "schemaTable");
assert.equal(d2Inventory?.columns.find(field => field.name === "id")?.primaryKey, true);
assert.equal(d2Inventory?.columns.find(field => field.name === "owner_id")?.foreignTable, "platform.accounts");
assert.equal(d2Accounts?.type, "schemaTable");
assert.equal(d2Class?.type, "group");
assert.match(d2Class?.libraryComponent?.componentFields?.find(field => field.key === "methods")?.value ?? "", /refresh\(\): void/);
assert.equal(d2Gateway?.type, "flowchart");
assert.equal(d2Gateway?.flowchartShape, "hexagon");
assert.equal(d2Gateway?.d2?.icon, "https://example.test/api.svg");
assert.equal(d2Gateway?.d2?.near, "top-left");
assert.equal(d2Gateway?.d2?.layout?.direction, "right");
assert.equal(d2Gateway?.d2?.stroke, "#2563eb");
assert.equal(d2Grid?.d2?.shape, "grid");
assert.equal(d2Grid?.d2?.gridRows, 2);
assert.equal(d2Grid?.d2?.gridColumns, 2);
assert.equal(d2Grid?.d2?.layout?.gridGap, 28);
assert.ok(d2Advanced.some(item => item.type === "group" && item.liveKey === "platform"));
const d2AdvancedExport = formats.exportDiagramCode("d2", d2Advanced);
const d2AdvancedReimport = flattenD2(d2.d2ToDiagram(d2AdvancedExport));
assert.ok(d2AdvancedReimport.some(item => item.type === "schemaTable" && item.liveKey === "platform.inventory" && item.columns.some(field => field.name === "id" && field.primaryKey)));
const restoredD2Class = d2AdvancedReimport.find(item => item.type === "group" && item.liveKey === "platform.service" && item.libraryComponent?.kind === "uml-class");
assert.ok(restoredD2Class);
assert.match(restoredD2Class.libraryComponent.componentFields.find(field => field.key === "methods")?.value ?? "", /refresh\(\): void/);
assert.ok(d2AdvancedReimport.some(item => item.type === "flowchart" && item.liveKey === "platform.gateway" && item.d2?.icon === "https://example.test/api.svg" && item.d2.stroke === "#2563eb"));
assert.ok(d2AdvancedReimport.some(item => item.type === "group" && item.liveKey === "tiles" && item.d2?.gridRows === 2 && item.d2?.layout?.gridGap === 28));
const restoredD2Group = sketchParser.normalizeElement(d2Advanced.find(item => item.type === "group" && item.liveKey === "platform"));
assert.equal(restoredD2Group?.type, "group");
assert.equal(restoredD2Group?.d2?.layout?.direction, "right", "D2 source metadata survives .sketch element normalization");
const d2Sequence = d2.d2ToDiagram(fixture("d2-sequence.d2"));
assert.equal(d2Sequence.filter(item => item.type === "arrow" || item.type === "line").length, 4);
assert.equal(d2Sequence.filter(item => item.type === "group" && item.d2?.sequenceKind === "participant").length, 3);
const d2SequenceExport = formats.exportDiagramCode("d2", d2Sequence);
const d2SequenceReimport = d2.d2ToDiagram(d2SequenceExport);
assert.equal(d2SequenceReimport.filter(item => item.type === "arrow" || item.type === "line").length, 4);

const sqlDialects = [
  ["sql-postgresql.sql", "postgresql"], ["sql-mysql.sql", "mysql"], ["sql-sqlite.sql", "sqlite"], ["sql-sqlserver.sql", "sqlserver"],
];
const largeSchemaSource = `-- ${"x".repeat(5_200_000)}\nCREATE TABLE preserved_large_source (id INTEGER PRIMARY KEY);`;
const reopenedLargeSchema = sketchParser.parseSketchFile({
  format: "SketchDraw",
  version: sketchModel.SKETCH_FORMAT_VERSION,
  canvas: { activePageId: "large-schema", pages: [{
    id: "large-schema", name: "Large schema", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" },
    elements: [{ type: "schemaTable", id: "large-schema-table", x: 0, y: 0, w: 190, h: 80, name: "Large table", columns: [{ id: "large-schema-column", name: "id", dataType: "INTEGER", primaryKey: true }], schemaDiagramId: "large-schema-diagram", schemaSource: largeSchemaSource }],
  }] },
});
assert.equal(reopenedLargeSchema?.pages[0].elements[0]?.type === "schemaTable" ? reopenedLargeSchema.pages[0].elements[0].schemaSource : undefined, largeSchemaSource, "schema text above the 5,000,000-character parsing limit remains available when its sketch reopens");

for (const [fileName, dialect] of sqlDialects) {
  const source = fixture(fileName);
  const parsed = schemaParser.parseSchema(source);
  const tables = parsed.filter(item => (item.objectKind ?? "table") === "table");
  const views = parsed.filter(item => item.objectKind === "view");
  assert.ok(tables.length >= 2, `${dialect} imports qualified tables and their columns`);
  assert.equal(views.length, 1, `${dialect} imports view definitions`);
  assert.ok(views[0].viewQuery?.toUpperCase().includes("SELECT"), `${dialect} retains editable view SQL`);
  assert.ok(parsed.some(item => item.constraints?.some(constraint => constraint.kind === "foreign-key")), `${dialect} retains foreign keys`);
  const schemaElements = parsed.map((table, index) => ({ type: "schemaTable", id: `${dialect}-schema-${index}`, x: index * 220, y: 0, w: 190, h: 100, name: table.name, objectKind: table.objectKind, viewQuery: table.viewQuery, enumValues: table.enumValues, columns: table.columns.map((column, fieldIndex) => ({ id: `${dialect}-field-${index}-${fieldIndex}`, name: column.name, dataType: column.type, primaryKey: column.primaryKey, foreignTable: column.foreignTable, foreignColumn: column.foreignColumn, nullable: column.nullable })), indexes: table.indexes, constraints: table.constraints, schemaDiagramId: `${dialect}-diagram`, schemaSource: source }));
  const exported = formats.exportDiagramCode("sql", schemaElements, { sqlDialect: dialect });
  const reimported = schemaParser.parseSchema(exported);
  assert.equal(reimported.filter(item => item.objectKind === "view").length, 1, `${dialect} SQL export reimports its view`);
  assert.ok(reimported.some(item => (item.objectKind ?? "table") === "table" && item.columns.some(column => column.primaryKey)), `${dialect} SQL export retains keys`);
  if (dialect === "postgresql") {
    assert.match(exported, /CREATE TYPE "sales"\."order_state" AS ENUM/);
    assert.match(exported, /CREATE SCHEMA IF NOT EXISTS "sales"/);
    assert.ok(parsed.find(item => item.name === "sales.orders")?.indexes?.some(index => index.method === "btree" && index.orders?.[0] === "DESC"), "PostgreSQL index method and ordering are parsed");
    assert.match(exported, /USING btree \("id" DESC\) WHERE id > 0/);
    assert.ok(parsed.find(item => item.name === "sales.orders")?.constraints?.some(constraint => constraint.onDelete === "CASCADE" && constraint.onUpdate === "RESTRICT"), "PostgreSQL FK actions are parsed");
    assert.match(exported, /ON DELETE CASCADE ON UPDATE RESTRICT/);
    assert.ok(reimported.some(item => item.objectKind === "enum" && item.enumValues?.includes("cancelled")), "PostgreSQL enum values reimport");
    const jsonReimport = schemaParser.parseSchema(formats.exportDiagramCode("json", schemaElements));
    assert.ok(jsonReimport.some(item => item.objectKind === "view" && item.viewQuery?.includes("JOIN")), "JSON Schema extensions retain editable views");
    const normalizedEnum = sketchParser.normalizeElement(schemaElements.find(item => item.objectKind === "enum"));
    assert.equal(normalizedEnum?.type === "schemaTable" ? normalizedEnum.enumValues?.length : 0, 3, "enum metadata survives .sketch normalization");
    const mysqlEnumExport = formats.exportDiagramCode("sql", schemaElements, { sqlDialect: "mysql" });
    const sqliteEnumExport = formats.exportDiagramCode("sql", schemaElements, { sqlDialect: "sqlite" });
    const sqlServerEnumExport = formats.exportDiagramCode("sql", schemaElements, { sqlDialect: "sqlserver" });
    assert.match(mysqlEnumExport, /`state` ENUM\('pending', 'paid', 'cancelled'\)/, "PostgreSQL enum values become a MySQL column enum");
    assert.match(sqliteEnumExport, /"state" TEXT NOT NULL CHECK \("state" IN \('pending', 'paid', 'cancelled'\)\)/, "PostgreSQL enum values become a SQLite check");
    assert.match(sqlServerEnumExport, /\[state\] NVARCHAR\(255\) NOT NULL CHECK \(\[state\] IN \('pending', 'paid', 'cancelled'\)\)/, "PostgreSQL enum values become a SQL Server check");
    assert.ok(formats.sqlSchemaExportLosses(schemaElements, "mysql").some(loss => /named enum/i.test(loss)));
  }
  if (dialect === "mysql") {
    const composite = parsed.find(item => item.name === "retail.order_line");
    assert.deepEqual(composite?.constraints?.find(constraint => constraint.kind === "primary-key")?.columns, ["order_id", "line_no"], "composite primary keys stay ordered and editable");
    assert.equal(composite?.constraints?.find(constraint => constraint.kind === "foreign-key")?.onDelete, "CASCADE", "MySQL foreign-key actions are parsed");
    assert.match(exported, /CONSTRAINT `pk_order_line` PRIMARY KEY \(`order_id`, `line_no`\)/);
  }
  if (dialect === "mysql") { assert.match(exported, /CREATE DATABASE IF NOT EXISTS `retail`/); assert.match(exported, /ENUM\('active', 'paused', 'closed'\)/); }
  if (dialect === "sqlite") { assert.match(exported, /CHECK \(status IN/); assert.match(exported, /CREATE INDEX "main"\."idx_orders_customer"/); assert.match(exported, /lower\(email\)/); assert.ok(formats.sqlSchemaExportLosses(schemaElements, dialect).some(loss => /expression-index/i.test(loss))); }
  if (dialect === "sqlserver") { assert.match(exported, /\[sales\]\.\[customer\]/); assert.equal(parsed.find(item => item.name === "sales.orders")?.indexes?.[0]?.orders?.[0], "DESC", "SQL Server GO terminators still delimit indexes"); assert.ok(formats.sqlSchemaExportLosses(schemaElements, dialect).some(loss => /identity/.test(loss))); }
}
assert.throws(() => d2.d2ToDiagram("a: {\n  far: b\n}"), /no documented 'far'/i);

const schemaTables = [
  { type: "schemaTable", id: "schema-parent", schemaDiagramId: "schema-test", schemaSource: "", name: "Parent", x: 320, y: 0, w: 190, h: 150, columns: [
    { id: "parent-id", name: "id", dataType: "INTEGER", primaryKey: true },
    { id: "parent-tenant", name: "tenant_id", dataType: "INTEGER", primaryKey: true },
  ] },
  { type: "schemaTable", id: "schema-child", schemaDiagramId: "schema-test", schemaSource: "", name: "Child", x: 0, y: 0, w: 190, h: 150, columns: [
    { id: "child-id", name: "id", dataType: "INTEGER", primaryKey: true },
    { id: "child-parent", name: "parent_id", dataType: "INTEGER", foreignTable: "Parent", foreignColumn: "id" },
    { id: "child-tenant", name: "tenant_ref", dataType: "INTEGER", foreignTable: "Parent", foreignColumn: "tenant_id" },
  ] },
];
const sqlRelations = schemaVisualizer.schemaRelationshipConnectors(schemaTables, "schema-test");
assert.equal(sqlRelations.length, 2, "SQL foreign keys create one field-bound connector per referenced column pair");
assert.deepEqual(sqlRelations.map(item => [item.startBinding?.elementId, item.startBinding?.rowId, item.endBinding?.elementId, item.endBinding?.rowId]), [
  ["schema-parent", "parent-id", "schema-child", "child-parent"],
  ["schema-parent", "parent-tenant", "schema-child", "child-tenant"],
]);
const routedSqlRelations = connectorRouting.autoRouteConnectorSet([...sqlRelations, ...schemaTables]);
const routedSqlLinks = routedSqlRelations.filter(item => item.type === "line" && item.schemaDiagramId === "schema-test");
assert.equal(routedSqlLinks.length, 2);
assert.ok(routedSqlLinks.every(item => item.autoRoute && Array.isArray(item.routePoints)), "SQL links are pre-routed together after table layout");

assert.equal(proposalComponents.PROPOSAL_COMPONENTS.length, 198);
assert.equal(new Set(proposalComponents.PROPOSAL_COMPONENTS.map(item => item.kind)).size, 198);
assert.equal(new Set(proposalComponents.PROPOSAL_COMPONENTS.map(item => item.section.split(" | ")[0])).size, 6);
assert.ok(libraryComponents.LIBRARY_COMPONENTS.length >= 400, "the categorized modeling catalog exceeds 400 usable components");
for (const proposal of proposalComponents.PROPOSAL_COMPONENTS) {
  if (proposal.archetype === "connector") {
    const relationship = libraryComponents.buildLibraryRelationship(proposal.kind, 12, 24);
    assert.equal(relationship?.type, "line", `palette relationship ${proposal.label} is inserted as an editable connector`);
    assert.equal(relationship?.componentRole, proposal.kind, `palette relationship ${proposal.label} retains its model identity`);
    assert.ok(relationship?.label, `palette relationship ${proposal.label} has an editable label`);
    continue;
  }
  const instance = libraryComponents.buildLibraryComponent(proposal.kind, 12, 24);
  assert.equal(instance.libraryComponent?.kind, proposal.kind, `palette component ${proposal.label} can be instantiated`);
  assert.ok(instance.componentBounds && instance.componentBounds.w > 0 && instance.componentBounds.h > 0, `palette component ${proposal.label} has usable default bounds`);
  const fields = instance.libraryComponent?.componentFields ?? [];
  assert.ok(fields.length >= 3, `palette component ${proposal.label} has editable modeling fields`);
  assert.ok(fields.some(field => !["Details", "ID / type", "Verification / trace"].includes(field.label)), `palette component ${proposal.label} uses purpose-specific field labels`);
  const edited = libraryComponentEditor.setLibraryComponentField(instance, `component:${fields[0].key}`, "Editable sample");
  assert.equal(edited.libraryComponent?.componentFields?.[0]?.value, "Editable sample", `palette component ${proposal.label} accepts edits`);
}
const systemsComponents = proposalComponents.PROPOSAL_COMPONENTS.filter(item => item.section.startsWith("Systems engineering"));
assert.equal(systemsComponents.length, 38, "all proposed Systems and advanced UML entries are catalogued");
for (const [family, prefix] of [
  ["Systems engineering", "proposal-systems-"], ["BPMN and decision modelling", "proposal-decision-"],
  ["Database, data structures, and schemas", "proposal-data-"], ["Software architecture and integration", "proposal-architecture-"],
  ["Visual planning and decision tools", "proposal-planning-"], ["Wireframing and UI planning", "proposal-wireframe-"],
]) {
  const entries = proposalComponents.PROPOSAL_COMPONENTS.filter(item => item.kind.startsWith(prefix));
  assert.ok(entries.length > 0, `${family} has catalog entries`);
  assert.ok(entries.every(item => proposalComponents.proposalComponentSubcategory(item.kind)), `${family} assigns every entry to a palette subcategory`);
  assert.ok(new Set(entries.map(item => proposalComponents.proposalComponentSubcategory(item.kind))).size >= 3, `${family} appears as multiple category groups in the shape palette`);
}
const expectedSystemRelationships = new Map([
  ["proposal-systems-requirement-decomposition-link", ["dependency", "<<deriveReqt>>", "dashed", "open"]],
  ["proposal-systems-requirement-satisfy-link", ["dependency", "<<satisfy>>", "dashed", "open"]],
  ["proposal-systems-requirement-verify-link", ["dependency", "<<verify>>", "dashed", "open"]],
  ["proposal-systems-requirement-derive-link", ["dependency", "<<deriveReqt>>", "dashed", "open"]],
  ["proposal-systems-requirement-refine-link", ["dependency", "<<refine>>", "dashed", "open"]],
  ["proposal-systems-requirement-trace-link", ["dependency", "<<trace>>", "dashed", "open"]],
  ["proposal-systems-item-flow", ["data-flow", "Item flow", "solid", "solid"]],
  ["proposal-systems-allocation-relationship", ["dependency", "<<allocate>>", "dashed", "open"]],
  ["proposal-systems-parametric-constraint", ["association", "=", "solid", "none"]],
  ["proposal-systems-uml-communication-message", ["sequence", "UML communication message", "solid", "open"]],
  ["proposal-systems-composite-part-connector", ["association", "", "solid", "none"]],
  ["proposal-systems-package-import", ["dependency", "<<import>>", "dashed", "open"]],
  ["proposal-systems-package-merge", ["dependency", "<<merge>>", "dashed", "open"]],
]);
for (const [kind, [relationshipType, label, lineStyle, endHead]] of expectedSystemRelationships) {
  const connector = libraryComponents.buildLibraryRelationship(kind, 12, 24);
  assert.equal(connector?.relationshipType, relationshipType, `${kind} uses its semantic relationship type`);
  assert.equal(connector?.label?.text, label, `${kind} has its UML/SysML relationship label`);
  assert.equal(connector?.lineStyle, lineStyle, `${kind} uses the expected relationship line style`);
  assert.equal(connector?.endHead, endHead, `${kind} uses the expected arrow head`);
}
const systemRelationships = [...expectedSystemRelationships.keys()].map(kind => {
  const connector = libraryComponents.buildLibraryRelationship(kind, 20, 40);
  assert.ok(connector?.relationshipFields?.length, `${kind} has editable relationship-specific properties`);
  return connector.relationshipFields.reduce((current, field) => libraryComponentEditor.setLibraryRelationshipField(current, field.key, `Saved ${field.key}`), connector);
});
const reopenedRelationships = sketchParser.parseSketchFile({
  format: "SketchDraw", version: sketchModel.SKETCH_FORMAT_VERSION,
  canvas: { activePageId: "relationships", pages: [{ id: "relationships", name: "Relationships", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" }, elements: systemRelationships }] },
});
assert.equal(reopenedRelationships?.pages[0].elements.length, systemRelationships.length, "all typed Systems relationships survive SketchDraw save/reopen normalization");
for (const [index, [kind, [relationshipType, label, lineStyle, endHead]]] of [...expectedSystemRelationships.entries()].entries()) {
  const reopened = reopenedRelationships.pages[0].elements[index];
  assert.equal(reopened.componentRole, kind);
  assert.equal(reopened.relationshipType, relationshipType);
  assert.equal(reopened.label?.text, label);
  assert.equal(reopened.lineStyle, lineStyle);
  assert.equal(reopened.endHead, endHead);
  assert.deepEqual(reopened.relationshipFields, systemRelationships[index].relationshipFields, `${kind} preserves its edited relationship properties`);
}
const editableSystemComponents = [];
for (const proposal of systemsComponents.filter(item => item.archetype !== "connector")) {
  let instance = libraryComponents.buildLibraryComponent(proposal.kind, 0, 0);
  for (const [index, field] of (instance.libraryComponent.componentFields ?? []).entries()) {
    instance = libraryComponentEditor.setLibraryComponentField(instance, `component:${field.key}`, `V${index + 1}`);
  }
  const fields = instance.libraryComponent.componentFields ?? [];
  assert.equal(new Set(fields.map(field => field.key)).size, fields.length, `${proposal.label} has unique editable field keys`);
  assert.ok(fields.every(field => field.label && field.hint), `${proposal.label} documents each editable field`);
  editableSystemComponents.push(instance);
  const svg = modelComponentRenderer.modelComponentSvg(instance);
  for (const field of instance.libraryComponent.componentFields) assert.ok(svg.includes(field.value), `${proposal.label} exports its ${field.label} value`);
  assert.ok(!svg.includes("undefined"), `${proposal.label} has valid vector output`);
  const canvasText = [];
  const context = new Proxy({ font: "10px sans-serif", textAlign: "left", textBaseline: "alphabetic" }, {
    get(target, property) {
      if (property === "getTransform") return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (property === "measureText") return text => ({ width: String(text).length * 5 });
      if (property === "fillText") return text => canvasText.push(String(text));
      return target[property] ?? (() => {});
    },
    set(target, property, value) { target[property] = value; return true; },
  });
  modelComponentRenderer.drawModelComponent(context, instance, "light", false);
  for (const field of instance.libraryComponent.componentFields) assert.ok(canvasText.some(text => text.includes(field.value)), `${proposal.label} draws its ${field.label} value on canvas`);
}
const reopenedSystemComponents = sketchParser.parseSketchFile({
  format: "SketchDraw", version: sketchModel.SKETCH_FORMAT_VERSION,
  canvas: { activePageId: "systems-models", pages: [{ id: "systems-models", name: "Systems models", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" }, elements: editableSystemComponents }] },
});
assert.equal(reopenedSystemComponents?.pages[0].elements.length, editableSystemComponents.length, "all Systems elements survive SketchDraw save/reopen normalization");
for (const [index, component] of editableSystemComponents.entries()) assert.deepEqual(
  reopenedSystemComponents.pages[0].elements[index]?.type === "group" ? reopenedSystemComponents.pages[0].elements[index].libraryComponent?.componentFields : undefined,
  component.libraryComponent.componentFields,
  `${systemsComponents.filter(item => item.archetype !== "connector")[index].label} preserves its edited fields`,
);
assert.ok(modelComponentRenderer.modelComponentSvg(libraryComponents.buildLibraryComponent("proposal-systems-sysml-requirement", 0, 0)).includes("requirement"), "SysML requirement export has a requirement-specific heading");
assert.ok(modelComponentRenderer.modelComponentSvg(libraryComponents.buildLibraryComponent("proposal-systems-uml-combined-fragment", 0, 0)).includes("M "), "UML combined fragment export contains a fragment frame");
for (const kind of ["proposal-systems-provided-interface", "proposal-systems-required-interface"]) {
  const component = libraryComponents.buildLibraryComponent(kind, 0, 0);
  const ports = componentGeometry.componentDefaultPorts(component, (_path, anchor) => anchor);
  assert.equal(ports.length, 1, `${kind} exposes only its interface endpoint`);
  assert.equal(ports[0].id, "interface-contract");
  assert.deepEqual(ports[0].accepts, ["association", "dependency"], `${kind} rejects unrelated connector types`);
}
const providedInterface = libraryComponents.buildLibraryComponent("proposal-systems-provided-interface", 20, 20);
const interfaceAssociation = { ...libraryComponents.buildLibraryRelationship("proposal-systems-composite-part-connector", 0, 0), startBinding: { elementId: providedInterface.id, anchor: { x: .16, y: .5 }, portId: "interface-contract" } };
assert.ok(!validation.validateDiagram([providedInterface, interfaceAssociation], [], { includeOverlaps: false }).some(issue => issue.code === "connection-rule"), "interface connectors accept UML associations");
const incompatibleInterfaceLink = { ...interfaceAssociation, id: "invalid-interface-link", relationshipType: "network" };
assert.ok(validation.validateDiagram([providedInterface, incompatibleInterfaceLink], [], { includeOverlaps: false }).some(issue => issue.code === "connection-rule"), "interface ports report incompatible relationship types");
for (const proposal of systemsComponents) {
  const snapped = componentGeometry.snapComponentSize(proposal.kind, 1, 1);
  const minimum = componentGeometry.componentMinimumSize(proposal.kind);
  assert.ok(snapped.w >= minimum.w && snapped.h >= minimum.h, `${proposal.label} cannot resize below its usable bounds`);
  if (proposal.archetype === "event") assert.equal(componentGeometry.componentGeometry(proposal.kind, snapped.w, snapped.h).resize.aspectLock, true, `${proposal.label} keeps its symbol proportions while resizing`);
}
const proposalDecisionFields = kind => libraryComponents.buildLibraryComponent(kind, 0, 0).libraryComponent.componentFields;
assert.deepEqual(proposalDecisionFields("proposal-decision-conditional-event").map(field => field.key), ["trigger", "event-definition", "behavior", "flow"], "BPMN event profiles provide trigger, definition, catch/throw behavior, and flow details");
assert.deepEqual(proposalDecisionFields("proposal-decision-dmn-decision").map(field => field.key), ["question", "inputs", "logic", "result"], "DMN decisions expose their question, inputs, logic, and result");
assert.deepEqual(proposalDecisionFields("proposal-decision-dmn-decision-table").map(field => field.key), ["question", "inputs", "rules", "outputs-policy"], "DMN decision tables expose input clauses, rules, outputs, and hit policy");
assert.deepEqual(proposalDecisionFields("proposal-decision-dmn-context-expression").map(field => field.key), ["context", "entries", "result", "type"], "DMN context expressions expose their entries and result type");
const editableDecisionComponents = [];
for (const proposal of proposalComponents.PROPOSAL_COMPONENTS.filter(item => item.section.startsWith("Decision modelling") && item.archetype !== "connector")) {
  let instance = libraryComponents.buildLibraryComponent(proposal.kind, 0, 0);
  for (const [index, field] of (instance.libraryComponent.componentFields ?? []).entries()) {
    instance = libraryComponentEditor.setLibraryComponentField(instance, `component:${field.key}`, `D${index + 1}`);
  }
  const canvasText = [];
  const context = new Proxy({ font: "10px sans-serif", textAlign: "left", textBaseline: "alphabetic" }, {
    get(target, property) {
      if (property === "getTransform") return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (property === "measureText") return text => ({ width: String(text).length * 5 });
      if (property === "fillText") return text => canvasText.push(String(text));
      return target[property] ?? (() => {});
    },
    set(target, property, value) { target[property] = value; return true; },
  });
  const svg = modelComponentRenderer.modelComponentSvg(instance);
  for (const [index, field] of instance.libraryComponent.componentFields.entries()) assert.ok(svg.includes(`D${index + 1}`), `${proposal.label} exports its ${field.label} value in SVG`);
  modelComponentRenderer.drawModelComponent(context, instance, "light", false);
  for (const [index, field] of instance.libraryComponent.componentFields.entries()) assert.ok(canvasText.some(text => text.includes(`D${index + 1}`)), `${proposal.label} draws its ${field.label} value on canvas. Actual canvas text: ${canvasText.join(" | ")}`);
  editableDecisionComponents.push(instance);
}
const reopenedDecisionComponents = sketchParser.parseSketchFile({
  format: "SketchDraw", version: sketchModel.SKETCH_FORMAT_VERSION,
  canvas: { activePageId: "bpmn-dmn-models", pages: [{ id: "bpmn-dmn-models", name: "BPMN and DMN models", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" }, elements: editableDecisionComponents }] },
});
assert.equal(reopenedDecisionComponents?.pages[0].elements.length, editableDecisionComponents.length, "all BPMN and DMN modeling nodes survive SketchDraw save/reopen normalization");
for (const [index, component] of editableDecisionComponents.entries()) assert.deepEqual(
  reopenedDecisionComponents.pages[0].elements[index]?.type === "group" ? reopenedDecisionComponents.pages[0].elements[index].libraryComponent?.componentFields : undefined,
  component.libraryComponent.componentFields,
  `${component.libraryComponent.label} preserves its edited fields`,
);
assert.deepEqual(libraryComponents.buildLibraryComponent("proposal-data-wide-column-table", 0, 0).libraryComponent.componentFields.map(field => field.key), ["table", "row-key", "column-families", "sparse-values"], "wide-column tables expose row keys, families, and sparse column details");
assert.deepEqual(libraryComponents.buildLibraryComponent("proposal-data-star-schema-boundary", 0, 0).libraryComponent.componentFields.map(field => field.key), ["fact", "dimensions", "relationships", "notes"], "star schema boundaries expose the central fact and dimension relationships");
assert.deepEqual(libraryComponents.buildLibraryComponent("proposal-data-graphql-union", 0, 0).libraryComponent.componentFields.map(field => field.key), ["type-name", "members", "resolver", "used-by"], "GraphQL union components expose members and type resolution");
const editableDataComponents = [];
for (const proposal of proposalComponents.PROPOSAL_COMPONENTS.filter(item => item.section.startsWith("Data & schemas") && item.archetype !== "connector")) {
  let instance = libraryComponents.buildLibraryComponent(proposal.kind, 0, 0);
  for (const [index, field] of (instance.libraryComponent.componentFields ?? []).entries()) {
    instance = libraryComponentEditor.setLibraryComponentField(instance, `component:${field.key}`, `S${index + 1}`);
  }
  const canvasText = [];
  const context = new Proxy({ font: "10px sans-serif", textAlign: "left", textBaseline: "alphabetic" }, {
    get(target, property) {
      if (property === "getTransform") return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (property === "measureText") return text => ({ width: String(text).length * 5 });
      if (property === "fillText") return text => canvasText.push(String(text));
      return target[property] ?? (() => {});
    },
    set(target, property, value) { target[property] = value; return true; },
  });
  const svg = modelComponentRenderer.modelComponentSvg(instance);
  for (const [index, field] of instance.libraryComponent.componentFields.entries()) assert.ok(svg.includes(`S${index + 1}`), `${proposal.label} exports its ${field.label} value in SVG`);
  modelComponentRenderer.drawModelComponent(context, instance, "light", false);
  for (const [index, field] of instance.libraryComponent.componentFields.entries()) assert.ok(canvasText.some(text => text.includes(`S${index + 1}`)), `${proposal.label} draws its ${field.label} value on canvas. Actual canvas text: ${canvasText.join(" | ")}`);
  editableDataComponents.push(instance);
}
const reopenedDataComponents = sketchParser.parseSketchFile({
  format: "SketchDraw", version: sketchModel.SKETCH_FORMAT_VERSION,
  canvas: { activePageId: "data-models", pages: [{ id: "data-models", name: "Data models", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" }, elements: editableDataComponents }] },
});
assert.equal(reopenedDataComponents?.pages[0].elements.length, editableDataComponents.length, "all database and schema modeling nodes survive SketchDraw save/reopen normalization");
for (const [index, component] of editableDataComponents.entries()) assert.deepEqual(
  reopenedDataComponents.pages[0].elements[index]?.type === "group" ? reopenedDataComponents.pages[0].elements[index].libraryComponent?.componentFields : undefined,
  component.libraryComponent.componentFields,
  `${component.libraryComponent.label} preserves its edited fields`,
);
for (const proposal of proposalComponents.PROPOSAL_COMPONENTS.filter(item => item.section.startsWith("Data & schemas"))) {
  const snapped = componentGeometry.snapComponentSize(proposal.kind, 1, 1);
  const minimum = componentGeometry.componentMinimumSize(proposal.kind);
  assert.ok(snapped.w >= minimum.w && snapped.h >= minimum.h, `${proposal.label} cannot resize below its usable data/schema bounds`);
}
const architectureProposals = proposalComponents.PROPOSAL_COMPONENTS.filter(item => item.section.startsWith("Architecture patterns"));
assert.equal(architectureProposals.length, 33, "the software architecture family covers all 33 proposal entries");
const editableArchitectureComponents = [];
for (const proposal of architectureProposals) {
  let instance = libraryComponents.buildLibraryComponent(proposal.kind, 0, 0);
  const fields = instance.libraryComponent.componentFields ?? [];
  assert.equal(fields.length, 4, `${proposal.label} has a complete architecture-specific property profile`);
  assert.notDeepEqual(fields.map(field => field.key), ["interface", "dependencies", "deployment"], `${proposal.label} does not fall back to generic architecture fields`);
  for (const [index, field] of fields.entries()) instance = libraryComponentEditor.setLibraryComponentField(instance, `component:${field.key}`, `A${index + 1}`);
  const canvasText = [];
  const context = new Proxy({ font: "10px sans-serif", textAlign: "left", textBaseline: "alphabetic" }, {
    get(target, property) {
      if (property === "getTransform") return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (property === "measureText") return text => ({ width: String(text).length * 5 });
      if (property === "fillText") return (text, x, y, width) => canvasText.push({ text: String(text), x, y, width, align: target.textAlign });
      return target[property] ?? (() => {});
    },
    set(target, property, value) { target[property] = value; return true; },
  });
  const svg = modelComponentRenderer.modelComponentSvg(instance);
  for (const [index, field] of fields.entries()) assert.ok(svg.includes(`A${index + 1}`), `${proposal.label} exports its ${field.label} in SVG`);
  modelComponentRenderer.drawModelComponent(context, instance, "light", false);
  for (const [index, field] of fields.entries()) assert.ok(canvasText.some(item => item.text.includes(`A${index + 1}`)), `${proposal.label} draws its ${field.label} on canvas. Actual canvas text: ${canvasText.map(item => item.text).join(" | ")}`);
  const snapped = componentGeometry.snapComponentSize(proposal.kind, 1, 1);
  const minimum = componentGeometry.componentMinimumSize(proposal.kind);
  assert.ok(snapped.w >= minimum.w && snapped.h >= minimum.h, `${proposal.label} cannot resize below its usable architecture bounds`);
  if (proposal.archetype === "event") assert.equal(componentGeometry.componentGeometry(proposal.kind, instance.componentBounds.w, instance.componentBounds.h).resize.aspectLock, false, `${proposal.label} can resize as an architecture card rather than a circular event`);
  editableArchitectureComponents.push(instance);
}
const svgLabelX = (svg, label) => {
  const safe = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = svg.match(new RegExp(`<text text-anchor="middle"[^>]*><tspan x="([\\d.]+)" y="[^"]*">${safe}</tspan></text>`));
  assert.ok(match, `architecture SVG contains centered ${label} text`);
  return Number(match[1]);
};
const svgLabelLayout = (svg, label) => {
  const node = svg.split("<text ").slice(1).map(entry => entry.split("</text>")[0]).find(entry => entry.includes(">" + label + "</tspan>"));
  assert.ok(node, `architecture SVG contains the ${label} label`);
  return {
    fontSize: Number(/font-size="([0-9.]+)"/.exec(node)?.[1]),
    lineCount: node.split("<tspan").length - 1,
  };
};
const assertFitsOneLine = (svg, label, availableWidth, designedFontSize) => {
  const layout = svgLabelLayout(svg, label);
  assert.equal(layout.lineCount, 1, `${label} stays on one line inside its component cell`);
  assert.ok(layout.fontSize <= designedFontSize + .1, `${label} keeps its designed compact font size`);
  assert.ok(label.length * layout.fontSize * .58 <= availableWidth + 1, `${label} fits inside its own component cell`);
};
const sagaInstance = libraryComponents.buildLibraryComponent("proposal-architecture-saga-orchestrator", 0, 0);
const sagaSvg = modelComponentRenderer.modelComponentSvg(sagaInstance);
const sagaStageWidth = (sagaInstance.componentBounds.w - 40) / 3;
assert.ok(Math.abs(svgLabelX(sagaSvg, "Step") - (10 + sagaStageWidth / 2)) < .1, "saga step label is centered inside its own stage box");
for (const label of ["Step", "Commit", "Compensate"]) assertFitsOneLine(sagaSvg, label, sagaStageWidth, 7);
const sidecarInstance = libraryComponents.buildLibraryComponent("proposal-architecture-service-mesh-sidecar", 0, 0);
const sidecarSvg = modelComponentRenderer.modelComponentSvg(sidecarInstance);
const sidecarCardWidth = (sidecarInstance.componentBounds.w - 32) / 2;
assert.ok(Math.abs(svgLabelX(sidecarSvg, "Workload") - (10 + sidecarCardWidth / 2)) < .1, "service-mesh workload label is centered inside its box");
assert.ok(Math.abs(svgLabelX(sidecarSvg, "Sidecar proxy") - (22 + sidecarCardWidth * 1.5)) < .1, "service-mesh sidecar label is centered inside its box");
assertFitsOneLine(sidecarSvg, "Workload", sidecarCardWidth - 4, 8);
assertFitsOneLine(sidecarSvg, "Sidecar proxy", sidecarCardWidth - 4, 8);
const breakerInstance = libraryComponents.buildLibraryComponent("proposal-architecture-circuit-breaker", 0, 0);
const breakerSvg = modelComponentRenderer.modelComponentSvg(breakerInstance);
const breakerCellWidth = (breakerInstance.componentBounds.w - 26) / 3;
assert.ok(Math.abs(svgLabelX(breakerSvg, "Closed") - (10 + (breakerCellWidth - 4) / 2)) < .1, "circuit-breaker state label is centered inside its state box");
for (const label of ["Closed", "Open", "Half-open"]) assertFitsOneLine(breakerSvg, label, breakerCellWidth - 6, 7);
const sagaCanvasText = [];
const sagaContext = new Proxy({ font: "10px sans-serif", textAlign: "left", textBaseline: "alphabetic" }, {
  get(target, property) {
    if (property === "getTransform") return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    if (property === "measureText") return text => ({ width: String(text).length * (Number(/([0-9.]+)px/.exec(target.font)?.[1] ?? 10) * .58) });
    if (property === "fillText") return (text, x, y, width) => sagaCanvasText.push({ text: String(text), x, y, width, align: target.textAlign, font: target.font });
    return target[property] ?? (() => {});
  },
  set(target, property, value) { target[property] = value; return true; },
});
modelComponentRenderer.drawModelComponent(sagaContext, sagaInstance, "light", false);
const sagaStep = sagaCanvasText.find(item => item.text === "Step");
assert.ok(sagaStep && sagaStep.align === "center" && Math.abs(sagaStep.x - (10 + (sagaInstance.componentBounds.w - 40) / 6)) < .1, "canvas saga step label uses the same centered box anchor as SVG");
for (const label of ["Step", "Commit", "Compensate"]) {
  const canvasLabel = sagaCanvasText.find(item => item.text === label);
  assert.ok(canvasLabel?.align === "center", `canvas ${label} label remains centered`);
  assert.ok(Number(/([0-9.]+)px/.exec(canvasLabel.font)?.[1]) <= 7.1, `canvas ${label} label uses its compact designed font size`);
  assert.ok(label.length * Number(/([0-9.]+)px/.exec(canvasLabel.font)?.[1]) * .58 <= sagaStageWidth + 1, `canvas ${label} label fits inside its own stage box`);
}
modelComponentRenderer.drawModelComponent(sagaContext, sidecarInstance, "light", false);
const sidecarCanvasWidth = (sidecarInstance.componentBounds.w - 32) / 2;
for (const [label, expectedX] of [["Workload", 10 + sidecarCanvasWidth / 2], ["Sidecar proxy", 22 + sidecarCanvasWidth * 1.5]]) {
  const canvasLabel = sagaCanvasText.find(item => item.text === label);
  assert.ok(canvasLabel?.align === "center" && Math.abs(canvasLabel.x - expectedX) < .1, `canvas ${label} label is centered on its actual sidecar box`);
  assert.ok(Number(/([0-9.]+)px/.exec(canvasLabel.font)?.[1]) <= 8.1, `canvas ${label} label retains a compact fitting size`);
}
modelComponentRenderer.drawModelComponent(sagaContext, breakerInstance, "light", false);
const breakerCanvasWidth = (breakerInstance.componentBounds.w - 26) / 3;
for (const [index, label] of ["Closed", "Open", "Half-open"].entries()) {
  const canvasLabel = sagaCanvasText.find(item => item.text === label);
  const expectedX = 11 + index * breakerCanvasWidth + (breakerCanvasWidth - 6) / 2;
  assert.ok(canvasLabel?.align === "center" && Math.abs(canvasLabel.x - expectedX) < .1, `canvas ${label} state label is centered in its own box`);
  assert.ok(label.length * Number(/([0-9.]+)px/.exec(canvasLabel.font)?.[1]) * .58 <= breakerCanvasWidth - 6 + 1, `canvas ${label} fits within its state box`);
}
const reopenedArchitectureComponents = sketchParser.parseSketchFile({
  format: "SketchDraw", version: sketchModel.SKETCH_FORMAT_VERSION,
  canvas: { activePageId: "architecture-models", pages: [{ id: "architecture-models", name: "Architecture models", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" }, elements: editableArchitectureComponents }] },
});
assert.equal(reopenedArchitectureComponents?.pages[0].elements.length, editableArchitectureComponents.length, "all architecture modeling nodes survive SketchDraw save/reopen normalization");
for (const [index, component] of editableArchitectureComponents.entries()) assert.deepEqual(
  reopenedArchitectureComponents.pages[0].elements[index]?.type === "group" ? reopenedArchitectureComponents.pages[0].elements[index].libraryComponent?.componentFields : undefined,
  component.libraryComponent.componentFields,
  `${component.libraryComponent.label} preserves its edited architecture fields`,
);
const architectureSource = libraryComponents.buildLibraryComponent("proposal-architecture-api-operation", 0, 0);
const architectureTarget = libraryComponents.buildLibraryComponent("proposal-architecture-application-service", 240, 0);
const architectureDependency = {
  ...libraryComponents.buildLibraryRelationship("uml-dependency", 0, 0),
  startBinding: { elementId: architectureSource.id, anchor: { x: 1, y: .5 }, portId: "east" },
  endBinding: { elementId: architectureTarget.id, anchor: { x: 0, y: .5 }, portId: "west" },
};
assert.equal(architectureDependency?.relationshipType, "dependency", "architecture dependencies retain their semantic connector type");
const reopenedArchitectureLink = sketchParser.parseSketchFile({
  format: "SketchDraw", version: sketchModel.SKETCH_FORMAT_VERSION,
  canvas: { activePageId: "architecture-links", pages: [{ id: "architecture-links", name: "Architecture links", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" }, elements: [architectureSource, architectureDependency, architectureTarget] }] },
});
assert.equal(reopenedArchitectureLink?.pages[0].elements[1]?.relationshipType, "dependency", "typed architecture relationships remain typed after SketchDraw save/reopen");
assert.deepEqual(reopenedArchitectureLink?.pages[0].elements[1]?.startBinding?.elementId, architectureSource.id, "architecture dependency stays bound to its source component");
assert.deepEqual(reopenedArchitectureLink?.pages[0].elements[1]?.endBinding?.elementId, architectureTarget.id, "architecture dependency stays bound to its target component");
const lineageConnector = libraryComponents.buildLibraryRelationship("proposal-data-data-lineage-connector", 0, 0);
assert.equal(lineageConnector?.relationshipType, "data-flow", "lineage uses a directed data-flow relationship");
assert.equal(lineageConnector?.endHead, "solid", "lineage connectors show a directed data-flow arrow");
assert.ok(lineageConnector?.relationshipFields?.some(field => field.key === "transformation"), "lineage connectors expose editable transformation metadata");
const editedLineage = libraryComponentEditor.setLibraryRelationshipField(lineageConnector, "transformation", "Filter inactive rows, then aggregate monthly totals");
const reopenedLineage = sketchParser.parseSketchFile({ format: "SketchDraw", version: sketchModel.SKETCH_FORMAT_VERSION, canvas: { activePageId: "lineage", pages: [{ id: "lineage", name: "Lineage", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" }, elements: [editedLineage] }] } });
assert.equal(reopenedLineage?.pages[0].elements[0]?.relationshipFields?.find(field => field.key === "transformation")?.value, "Filter inactive rows, then aggregate monthly totals", "lineage relationship metadata survives SketchDraw save/reopen");
const factTable = libraryComponents.buildLibraryComponent("proposal-data-fact-table", 0, 0);
const factRowPorts = componentGeometry.componentDefaultPorts(factTable, (_path, anchor) => anchor).filter(port => port.id.startsWith("row-"));
const factHeader = Math.min(30, Math.max(24, factTable.componentBounds.h * .23)); const factDataTop = Math.max(35, factHeader + 2);
assert.equal(factRowPorts.length, factTable.libraryComponent.componentFields.length, "data schema tables expose one connector port per visible row");
assert.ok(Math.abs(factRowPorts[0].anchor.y - (factDataTop + (factTable.componentBounds.h - factDataTop - 3) / 8) / factTable.componentBounds.h) < .001, "fact table row ports align with the visible table rows");
const expectedDecisionRelationships = new Map([
  ["proposal-decision-data-association", ["data-flow", "Data association", "dotted", "open"]],
  ["proposal-decision-bpmn-message-flow", ["data-flow", "BPMN message flow", "dashed", "open"]],
  ["proposal-decision-dmn-invocation", ["dependency", "DMN invocation", "dashed", "open"]],
  ["proposal-decision-dmn-information-requirement", ["dependency", "DMN information requirement", "solid", "open"]],
  ["proposal-decision-dmn-knowledge-requirement", ["dependency", "DMN knowledge requirement", "solid", "open"]],
  ["proposal-decision-dmn-authority-requirement", ["dependency", "DMN authority requirement", "solid", "open"]],
]);
const decisionRelationships = [...expectedDecisionRelationships.entries()].map(([kind, [relationshipType, label, lineStyle, endHead]]) => {
  const connector = libraryComponents.buildLibraryRelationship(kind, 0, 0);
  assert.equal(connector?.relationshipType, relationshipType, `${kind} has its BPMN/DMN relationship type`);
  assert.equal(connector?.label?.text, label, `${kind} retains its editable relationship label`);
  assert.equal(connector?.lineStyle, lineStyle, `${kind} uses its notation line style`);
  assert.equal(connector?.endHead, endHead, `${kind} has its correct arrowhead`);
  assert.ok(connector?.relationshipFields?.length, `${kind} exposes editable relationship details`);
  return connector;
});
const reopenedDecisionRelationships = sketchParser.parseSketchFile({
  format: "SketchDraw", version: sketchModel.SKETCH_FORMAT_VERSION,
  canvas: { activePageId: "bpmn-dmn", pages: [{ id: "bpmn-dmn", name: "BPMN and DMN", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" }, elements: decisionRelationships }] },
});
assert.equal(reopenedDecisionRelationships?.pages[0].elements.length, decisionRelationships.length, "BPMN and DMN connectors survive SketchDraw save/reopen normalization");
for (const [index, [kind, [relationshipType, label, lineStyle, endHead]]] of [...expectedDecisionRelationships.entries()].entries()) {
  const connector = reopenedDecisionRelationships.pages[0].elements[index];
  assert.equal(connector.componentRole, kind);
  assert.equal(connector.relationshipType, relationshipType);
  assert.equal(connector.label?.text, label);
  assert.equal(connector.lineStyle, lineStyle);
  assert.equal(connector.endHead, endHead);
  assert.deepEqual(connector.relationshipFields, decisionRelationships[index].relationshipFields);
}
const dmnDecision = libraryComponents.buildLibraryComponent("proposal-decision-dmn-decision", 0, 0);
const dmnDecisionPorts = componentGeometry.componentDefaultPorts(dmnDecision, (_path, anchor) => anchor);
assert.deepEqual(dmnDecisionPorts.map(port => port.id), ["decision-input", "decision-output"], "DMN decisions expose distinct input and output ports");
assert.ok(dmnDecisionPorts.every(port => port.accepts?.includes("dependency")), "DMN decision ports accept requirement relationships");
assert.match(componentGeometry.componentOutlinePath(dmnDecision.libraryComponent.kind, dmnDecision.componentBounds.w, dmnDecision.componentBounds.h), /H 100 V 100/, "DMN decisions use a rectangular outline consistent with their visible canvas and SVG shapes");
const conditionalEvent = libraryComponents.buildLibraryComponent("proposal-decision-conditional-event", 0, 0);
const eventPorts = componentGeometry.componentDefaultPorts(conditionalEvent, (_path, anchor) => anchor);
assert.deepEqual(eventPorts.map(port => port.id), ["event-input", "event-output"], "BPMN event markers expose separate connection points on their visible event ring");
assert.ok(eventPorts.every(port => port.accepts?.includes("sequence")), "BPMN event markers accept sequence-flow connections");
assert.ok(eventPorts[0].anchor.x < eventPorts[1].anchor.x && eventPorts[1].anchor.x < .5, "BPMN event connectors terminate on the event icon instead of the detail text area");
const simStart = libraryComponents.buildLibraryComponent("bpmn-start", 0, 0);
const simChoreography = libraryComponents.buildLibraryComponent("proposal-decision-choreography-task", 0, 0);
const simEvent = libraryComponentEditor.setLibraryComponentField(libraryComponents.buildLibraryComponent("proposal-decision-conditional-event", 0, 0), "component:behavior", "catch");
const simEnd = libraryComponents.buildLibraryComponent("bpmn-end", 0, 0);
const sequenceFlow = (id, start, end) => ({ type: "line", id, x: 0, y: 0, w: 1, h: 0, color: "#46525b", thickness: 1.5, relationshipType: "sequence", startBinding: { elementId: start.id, anchor: { x: .5, y: .5 } }, endBinding: { elementId: end.id, anchor: { x: .5, y: .5 } } });
const simulatedNodes = [simStart, simChoreography, simEvent, simEnd];
const simulatedFlows = simulatedNodes.slice(0, -1).map((node, index) => sequenceFlow(`advanced-sequence-${index}`, node, simulatedNodes[index + 1]));
const advancedTrace = bpmnAnalysis.simulateBpmn([...simulatedNodes, ...simulatedFlows]);
assert.deepEqual(advancedTrace.filter(step => step.kind === "node").map(step => step.elementId), simulatedNodes.map(node => node.id), "advanced BPMN choreography and event nodes participate in sequence-token simulation");
assert.ok(!validation.validateDiagram([...simulatedNodes, ...simulatedFlows], [], { includeOverlaps: false }).some(issue => ["bpmn-event-catch-flow", "bpmn-task-flow"].includes(issue.code)), "advanced BPMN event and choreography validation accepts correctly connected flows");
const decisionSource = libraryComponents.buildLibraryComponent("proposal-decision-dmn-decision", 0, 0);
const decisionInput = libraryComponents.buildLibraryComponent("proposal-decision-dmn-input-data", 0, 0);
const reversedRequirement = { ...libraryComponents.buildLibraryRelationship("proposal-decision-dmn-information-requirement", 0, 0), id: "reversed-dmn-requirement", startBinding: { elementId: decisionSource.id, anchor: { x: .5, y: .5 } }, endBinding: { elementId: decisionInput.id, anchor: { x: .5, y: .5 } } };
assert.ok(validation.validateDiagram([decisionSource, decisionInput, reversedRequirement], [], { includeOverlaps: false }).some(issue => issue.code === "dmn-link-direction"), "DMN information requirements report reversed decision/input relationships");
const decisionTable = libraryComponents.buildLibraryComponent("proposal-decision-dmn-decision-table", 0, 0);
let malformedDecisionTable = libraryComponentEditor.setLibraryComponentField(decisionTable, "component:inputs", "age\nmember");
malformedDecisionTable = libraryComponentEditor.setLibraryComponentField(malformedDecisionTable, "component:rules", "adult | approve");
assert.ok(validation.validateDiagram([malformedDecisionTable], [], { includeOverlaps: false }).some(issue => issue.code === "dmn-table-rule-width"), "DMN table validation checks rule columns against its input clauses and output");
for (const proposal of proposalComponents.PROPOSAL_COMPONENTS.filter(item => item.section.startsWith("Decision modelling"))) {
  const snapped = componentGeometry.snapComponentSize(proposal.kind, 1, 1);
  const minimum = componentGeometry.componentMinimumSize(proposal.kind);
  assert.ok(snapped.w >= minimum.w && snapped.h >= minimum.h, `${proposal.label} cannot resize below its usable BPMN/DMN bounds`);
}
const persistedRequirement = libraryComponentEditor.setLibraryComponentField(
  libraryComponents.buildLibraryComponent("proposal-systems-sysml-requirement", 40, 60),
  "component:statement",
  "The controller shall enter a safe state within 100 ms.",
);
const reopenedRequirement = sketchParser.parseSketchFile({
  format: "SketchDraw", version: sketchModel.SKETCH_FORMAT_VERSION,
  canvas: { activePageId: "systems", pages: [{ id: "systems", name: "Systems", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" }, elements: [persistedRequirement] }] },
});
assert.equal(reopenedRequirement?.pages[0].elements[0]?.libraryComponent?.componentFields?.find(field => field.key === "statement")?.value, "The controller shall enter a safe state within 100 ms.", "SysML editing survives SketchDraw save/reopen normalization");
const riceFields = [
  { key: "reach", label: "Reach", value: "1000" }, { key: "impact", label: "Impact", value: "2" },
  { key: "confidence", label: "Confidence", value: "80" }, { key: "effort", label: "Effort", value: "4" },
];
assert.equal(proposalComponents.proposalComponentScore("proposal-planning-rice-score-card", riceFields)?.value, "400", "RICE cards calculate their score from editable inputs");
assert.equal(proposalComponents.proposalComponentScore("proposal-planning-rice-score-card", [...riceFields.slice(0, 3), { ...riceFields[3], value: "0" }]), undefined, "incomplete or invalid RICE inputs do not render instructional text as a score");
assert.equal(proposalComponents.proposalComponentScore("proposal-planning-ice-score-card", [
  { key: "impact", label: "Impact", value: "8" }, { key: "confidence", label: "Confidence", value: "7" }, { key: "ease", label: "Ease", value: "6" },
])?.value, "336", "ICE cards calculate their score from editable inputs");
const planningProposals = proposalComponents.PROPOSAL_COMPONENTS.filter(item => item.section.startsWith("Visual planning"));
assert.equal(planningProposals.length, 39, "all 39 visual planning and decision tools are catalogued");
const planningInstances = [];
for (const proposal of planningProposals.filter(item => item.archetype !== "connector")) {
  let instance = libraryComponents.buildLibraryComponent(proposal.kind, 0, 0);
  const fields = instance.libraryComponent.componentFields ?? [];
  assert.ok(fields.length >= 4, `${proposal.label} exposes a complete editable planning profile`);
  assert.equal(new Set(fields.map(field => field.key)).size, fields.length, `${proposal.label} has unique planning field keys`);
  assert.notDeepEqual(fields.map(field => field.key), ["topic", "evidence", "impact", "next-step"], `${proposal.label} does not use generic planning fields`);
  for (const [index, field] of fields.entries()) instance = libraryComponentEditor.setLibraryComponentField(instance, `component:${field.key}`, field.key === "total-float" ? "7" : `P${index + 1}`);
  const minimum = componentGeometry.componentMinimumSize(proposal.kind);
  const snapped = componentGeometry.snapComponentSize(proposal.kind, 1, 1);
  assert.ok(snapped.w >= minimum.w && snapped.h >= minimum.h, `${proposal.label} retains enough room for its planning layout`);
  assert.equal(componentGeometry.componentGeometry(proposal.kind, instance.componentBounds.w, instance.componentBounds.h).resize.aspectLock, false, `${proposal.label} can resize as a planning panel`);
  const svg = modelComponentRenderer.modelComponentSvg(instance);
  assert.ok(svg.length > 100 && !svg.includes("undefined"), `${proposal.label} has a complete valid SVG drawing`);
  for (const [index, field] of fields.entries()) assert.ok(svg.includes(field.key === "total-float" ? "7" : `P${index + 1}`), `${proposal.label} includes its ${field.label} in SVG`);
  const canvasText = [];
  const context = new Proxy({ font: "10px sans-serif", textAlign: "left", textBaseline: "alphabetic" }, {
    get(target, property) {
      if (property === "getTransform") return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (property === "measureText") return text => ({ width: String(text).length * 5 });
      if (property === "fillText") return text => canvasText.push(String(text));
      return target[property] ?? (() => {});
    },
    set(target, property, value) { target[property] = value; return true; },
  });
  modelComponentRenderer.drawModelComponent(context, instance, "light", false);
  assert.ok(canvasText.length > 0, `${proposal.label} draws its planning layout on canvas`);
  for (const [index, field] of fields.entries()) assert.ok(canvasText.some(text => text.includes(field.key === "total-float" ? "7" : `P${index + 1}`)), `${proposal.label} includes its ${field.label} on canvas`);
  planningInstances.push(instance);
}
const planningDependency = libraryComponents.buildLibraryRelationship("proposal-planning-dependency-connector", 10, 20);
assert.equal(planningDependency?.relationshipType, "dependency", "schedule dependencies use dependency relationships");
assert.equal(planningDependency?.lineStyle, "solid", "schedule dependency lines are visually distinct from deferred dependency patterns");
assert.equal(planningDependency?.endHead, "solid", "schedule dependency arrows point to successor work");
assert.equal(planningDependency?.relationshipFields?.find(field => field.key === "relationship")?.value, "FS", "new schedule dependencies default to finish-to-start");
const retimedDependency = libraryComponentEditor.setLibraryRelationshipField(planningDependency, "relationship", "SS");
assert.equal(retimedDependency.label?.text, "SS", "editing a dependency type updates the connector label");
assert.equal(libraryComponentEditor.setLibraryRelationshipField(retimedDependency, "lag", "2").label?.text, "SS +2d", "editing dependency lag updates the connector label");
const weightedFields = [
  { key: "options", label: "Options", value: "Alpha\nBeta" },
  { key: "criteria", label: "Criteria", value: "Impact | 3\nCost | 1" },
  { key: "scores", label: "Scores", value: "Alpha | 5,2\nBeta | 4,4" },
  { key: "result", label: "Result", value: "Prefer the higher impact option." },
];
assert.equal(proposalComponents.proposalComponentScore("proposal-planning-weighted-decision-matrix", weightedFields)?.value, "Alpha · 4.25", "weighted decision matrices calculate each option against criterion weights");
assert.equal(proposalComponents.proposalComponentScore("proposal-planning-weighted-decision-matrix", [...weightedFields.slice(0, 2), { ...weightedFields[2], value: "Alpha | 5" }, weightedFields[3]]), undefined, "weighted scores remain blank until each option has a score for every criterion");
assert.equal(proposalComponents.proposalComponentScore("proposal-planning-key-result-card", [
  { key: "baseline", label: "Baseline", value: "10" }, { key: "current", label: "Current", value: "40" }, { key: "target", label: "Target", value: "50" },
])?.value, "75%", "key results calculate progress above baseline toward the target");
const pestleSvg = modelComponentRenderer.modelComponentSvg(libraryComponents.buildLibraryComponent("proposal-planning-pestle-map", 0, 0));
for (const label of ["POLITICAL", "ECONOMIC", "SOCIAL", "TECHNOLOGY", "LEGAL", "ENVIRONMENTAL"]) assert.ok(pestleSvg.includes(label), `PESTLE maps display the ${label} cell when empty`);
const assumptionSvg = modelComponentRenderer.modelComponentSvg(libraryComponents.buildLibraryComponent("proposal-planning-assumption-map", 0, 0));
for (const label of ["Test first", "Act on it", "Evidence", "Importance", "Test:"]) assert.ok(assumptionSvg.includes(label), `assumption maps show their ${label} structure when empty`);
const impactEffortSvg = modelComponentRenderer.modelComponentSvg(libraryComponents.buildLibraryComponent("proposal-planning-impact-effort-matrix", 0, 0));
for (const label of ["Quick wins", "Major projects", "Defer", "Avoid"]) assert.ok(impactEffortSvg.includes(label), `impact/effort maps show the ${label} quadrant`);
const riceBlankSvg = modelComponentRenderer.modelComponentSvg(libraryComponents.buildLibraryComponent("proposal-planning-rice-score-card", 0, 0));
assert.ok(riceBlankSvg.includes("Reach") && riceBlankSvg.includes("Effort") && !riceBlankSvg.includes("Enter numeric"), "an empty RICE card is a clear score template without instructional text masquerading as a score");
const moscowSvg = modelComponentRenderer.modelComponentSvg(libraryComponents.buildLibraryComponent("proposal-planning-moscow-group", 0, 0));
for (const label of ["MUST", "SHOULD", "COULD", "WON&apos;T"]) assert.ok(moscowSvg.includes(label), `MoSCoW boards visibly include ${label}`);
const decisionTreeSvg = modelComponentRenderer.modelComponentSvg(libraryComponents.buildLibraryComponent("proposal-planning-decision-tree-node", 0, 0));
for (const label of ["Decision?", "Yes", "No", "Other"]) assert.ok(decisionTreeSvg.includes(label), `decision tree nodes show the ${label} branch structure`);
const raciSvg = modelComponentRenderer.modelComponentSvg(libraryComponents.buildLibraryComponent("proposal-planning-raci-matrix", 0, 0));
for (const label of ["Work item", "Role A", "Role B", "Responsibility assignment", "Matrix owner:"]) assert.ok(raciSvg.includes(label), `RACI matrices show ${label} in their table layout`);
const empathySvg = modelComponentRenderer.modelComponentSvg(libraryComponents.buildLibraryComponent("proposal-planning-empathy-map", 0, 0));
for (const label of ["SAYS", "THINKS", "DOES", "FEELS"]) assert.ok(empathySvg.includes(label), `empathy maps label the ${label} quadrant`);
const blueprintSvg = modelComponentRenderer.modelComponentSvg(libraryComponents.buildLibraryComponent("proposal-planning-service-blueprint", 0, 0));
for (const label of ["Customer", "Frontstage", "Backstage", "Support", "Evidence"]) assert.ok(blueprintSvg.includes(label), `service blueprints show the ${label} lane`);
const blueprintInstance = libraryComponents.buildLibraryComponent("proposal-planning-service-blueprint", 0, 0);
const blueprintBounds = blueprintInstance.componentBounds;
const blueprintRects = [...modelComponentRenderer.modelComponentSvg(blueprintInstance).matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"/g)].map(match => ({ x: Number(match[1]), y: Number(match[2]), w: Number(match[3]), h: Number(match[4]) }));
assert.ok(blueprintRects.length && blueprintRects.every(rect => rect.x >= blueprintBounds.x && rect.y >= blueprintBounds.y && rect.x + rect.w <= blueprintBounds.x + blueprintBounds.w + 1e-6 && rect.y + rect.h <= blueprintBounds.y + blueprintBounds.h + 1e-6), "service blueprint header and all five lanes stay inside the component bounds");
const graphVertexSvg = modelComponentRenderer.modelComponentSvg(libraryComponents.buildLibraryComponent("proposal-data-graph-vertex", 0, 0));
assert.match(graphVertexSvg, /text-anchor="middle"[^>]*><tspan x="100" y="23\.2">Graph vertex<\/tspan>/, "graph vertex heading is centered within its safe hexagon area");
const searchIndexSvg = modelComponentRenderer.modelComponentSvg(libraryComponents.buildLibraryComponent("proposal-data-search-index", 0, 0));
assert.match(searchIndexSvg, /<tspan x="20" y="35\.2">Search index<\/tspan>/, "search index heading clears the cylinder rim and sits inside the body");
const scheduleTask = (kind, duration) => libraryComponentEditor.setLibraryComponentField(libraryComponents.buildLibraryComponent(kind, 0, 0), `component:duration`, String(duration));
const taskA = scheduleTask("proposal-planning-work-package", 2);
const taskB = scheduleTask("proposal-planning-critical-path-task", 3);
const taskC = scheduleTask("proposal-planning-critical-path-task", 4);
const taskD = scheduleTask("proposal-planning-work-package", 2);
const boundDependency = (from, to, id) => ({ ...libraryComponents.buildLibraryRelationship("proposal-planning-dependency-connector", 0, 0), id, startBinding: { elementId: from.id, anchor: { x: 1, y: .5 } }, endBinding: { elementId: to.id, anchor: { x: 0, y: .5 } } });
const scheduleScene = [taskA, taskB, taskC, taskD, boundDependency(taskA, taskB, "dep-a-b"), boundDependency(taskA, taskC, "dep-a-c"), boundDependency(taskB, taskD, "dep-b-d"), boundDependency(taskC, taskD, "dep-c-d")];
const criticalFloats = proposalPlanningRenderer.analyzePlanningCriticalPath(scheduleScene);
assert.equal(criticalFloats.get(taskA.id), 0, "CPM marks the shared start task critical");
assert.equal(criticalFloats.get(taskB.id), 1, "CPM calculates float on the shorter branch");
assert.equal(criticalFloats.get(taskC.id), 0, "CPM marks the longer branch critical");
assert.equal(criticalFloats.get(taskD.id), 0, "CPM marks the shared finish task critical");
assert.ok(modelComponentRenderer.modelComponentSvg(taskC, "light", scheduleScene).includes("CRITICAL"), "critical-path highlighting follows canvas dependency bindings in SVG export");
const reopenedPlanning = sketchParser.parseSketchFile({
  format: "SketchDraw", version: sketchModel.SKETCH_FORMAT_VERSION,
  canvas: { activePageId: "planning-models", pages: [{ id: "planning-models", name: "Planning models", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" }, elements: [...planningInstances, planningDependency] }] },
});
assert.equal(reopenedPlanning?.pages[0].elements.length, planningInstances.length + 1, "all planning model nodes and dependency fields survive SketchDraw save/reopen normalization");
for (const [index, component] of planningInstances.entries()) assert.deepEqual(
  reopenedPlanning.pages[0].elements[index]?.type === "group" ? reopenedPlanning.pages[0].elements[index].libraryComponent?.componentFields : undefined,
  component.libraryComponent.componentFields,
  `${component.libraryComponent.label} preserves its planning fields in a SketchDraw file`,
);
assert.equal(reopenedPlanning?.pages[0].elements[planningInstances.length]?.type === "line" ? reopenedPlanning.pages[0].elements[planningInstances.length].relationshipFields?.find(field => field.key === "relationship")?.value : undefined, "FS", "default schedule semantics persist in a SketchDraw file");
const wireframeProposals = proposalComponents.PROPOSAL_COMPONENTS.filter(item => item.section.startsWith("Wireframing"));
assert.equal(wireframeProposals.length, 24, "the wireframing family includes all 24 proposal components");
const fileDropSvg = proposalWireframeRenderer.proposalWireframeComponentSvg(libraryComponents.buildLibraryComponent("proposal-wireframe-file-drop-zone", 0, 0));
assert.match(fileDropSvg, /rx="6" fill="#ffffff" stroke="#4b5560"/, "file drop zones draw one rounded outer border");
assert.match(fileDropSvg, /fill="#eef1f3" stroke="none"/, "the title header fills inside the outer border without repainting its corner strokes");
assert.match(fileDropSvg, /M [\d.]+ [\d.]+ H [\d.]+ Q [\d.]+ [\d.]+ [\d.]+ [\d.]+ V [\d.]+ Q/, "the title header rounds only its top corners to match the enclosing shell");
const editableWireframes = [];
for (const proposal of wireframeProposals) {
  let instance = libraryComponents.buildLibraryComponent(proposal.kind, 16, 24);
  const fields = instance.libraryComponent.componentFields ?? [];
  assert.ok(fields.length >= 3, `${proposal.label} has editable wireframe properties`);
  const minimum = componentGeometry.componentMinimumSize(proposal.kind);
  assert.ok(instance.componentBounds.w >= minimum.w && instance.componentBounds.h >= minimum.h, `${proposal.label} starts at a size large enough for its complete layout`);
  for (const [index, field] of fields.entries()) instance = libraryComponentEditor.setLibraryComponentField(instance, `component:${field.key}`, field.key === "progress" ? "73" : `W${index + 1}`);
  const canvasText = [];
  const context = new Proxy({ font: "10px sans-serif", textAlign: "left", textBaseline: "alphabetic" }, {
    get(target, property) {
      if (property === "getTransform") return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (property === "measureText") return text => ({ width: String(text).length * 5 });
      if (property === "fillText") return text => canvasText.push(String(text));
      return target[property] ?? (() => {});
    },
    set(target, property, value) { target[property] = value; return true; },
  });
  const svg = modelComponentRenderer.modelComponentSvg(instance);
  modelComponentRenderer.drawModelComponent(context, instance, "light", false);
  for (const [index, field] of fields.entries()) {
    const expected = field.key === "progress" ? "73%" : `W${index + 1}`;
    assert.ok(svg.includes(expected), `${proposal.label} exports its ${field.label} field in SVG`);
    assert.ok(canvasText.some(text => text.includes(expected)), `${proposal.label} draws its ${field.label} field on canvas. Actual text: ${canvasText.join(" | ")}`);
  }
  const snapped = componentGeometry.snapComponentSize(proposal.kind, 1, 1);
  assert.ok(snapped.w >= minimum.w && snapped.h >= minimum.h, `${proposal.label} retains a usable minimum wireframe size`);
  editableWireframes.push(instance);
}
for (const [kind, presetIndex] of [
  ["proposal-wireframe-responsive-screen-frame", 0], ["proposal-wireframe-browser-window", 1],
  ["proposal-wireframe-mobile-device-frame", 1], ["proposal-wireframe-tablet-device-frame", 0],
  ["proposal-wireframe-desktop-application-window", 2],
]) {
  const presets = wireframePresets.wireframeViewportPresets(kind);
  assert.equal(presets.length, 3, `${kind} provides three useful viewport presets`);
  const initial = libraryComponents.buildLibraryComponent(kind, 20, 40);
  const resized = wireframePresets.applyWireframeViewportPreset(initial, presets[presetIndex]);
  assert.deepEqual({ w: resized.componentBounds.w, h: resized.componentBounds.h }, { w: presets[presetIndex].w, h: presets[presetIndex].h }, `${kind} preset resizes the frame to its advertised viewport`);
  assert.equal(resized.libraryComponent.componentFields.find(field => field.key === "viewport")?.value, `${presets[presetIndex].label} · ${presets[presetIndex].w} × ${presets[presetIndex].h}`, `${kind} preset stores its viewport label`);
}
const reopenedWireframes = sketchParser.parseSketchFile({
  format: "SketchDraw", version: sketchModel.SKETCH_FORMAT_VERSION,
  canvas: { activePageId: "wireframe-models", pages: [{ id: "wireframe-models", name: "Wireframe models", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" }, elements: editableWireframes }] },
});
assert.equal(reopenedWireframes?.pages[0].elements.length, editableWireframes.length, "all wireframe elements survive SketchDraw save/reopen normalization");
for (const [index, component] of editableWireframes.entries()) assert.deepEqual(
  reopenedWireframes.pages[0].elements[index]?.type === "group" ? reopenedWireframes.pages[0].elements[index].libraryComponent?.componentFields : undefined,
  component.libraryComponent.componentFields,
  `${component.libraryComponent.label} preserves editable wireframe fields in a SketchDraw file`,
);
const bpmnSource = fixture("process.bpmn");
const bpmnElements = bpmnXml.importBpmnXml(bpmnSource);
const bpmnImport = bpmnXml.importBpmnXmlWithReport(bpmnSource);
assert.equal(bpmnImport.report.kept, bpmnElements.length, "BPMN compatibility report counts retained canvas objects");
assert.equal(bpmnImport.report.simplified, 0, "BPMN compatibility report does not claim losses for the supported fixture");
assert.equal(bpmnImport.report.skipped, 0, "BPMN compatibility report reports no skipped content for the supported fixture");
assert.ok(bpmnImport.report.details.some(detail => detail.includes("extensionElements blocks are preserved")), "BPMN report lists preserved extension metadata");
assert.equal(bpmnElements.filter(item => item.componentRole?.startsWith("bpmn-node|")).length, 6);
assert.equal(bpmnElements.filter(item => item.componentRole?.startsWith("bpmn-edge|")).length, 4);
const bpmnUserTask = bpmnElements.find(item => item.componentRole?.includes("userTask"));
assert.equal(bpmnUserTask?.type === "group" ? bpmnUserTask.libraryComponent?.label : bpmnUserTask?.label?.text, "Review & approve");
assert.equal(bpmnUserTask?.type === "group" ? bpmnUserTask.componentBounds?.x : bpmnUserTask?.x, 160);
const bpmnMetadata = element => JSON.parse(decodeURIComponent(element.componentRole.split("|").slice(1).join("|")));
const bpmnUserTaskMetadata = bpmnMetadata(bpmnUserTask);
assert.equal(bpmnUserTaskMetadata.attributes["vendor:priority"], "high", "vendor node attributes remain in source metadata");
assert.match(bpmnUserTaskMetadata.extensionXml, /before <vendor:tag>Escalation &amp; SLA<\/vendor:tag> after/, "extension XML preserves mixed text and child order");
assert.equal(bpmnUserTaskMetadata.di["vendor:layer"], "foreground", "BPMN DI extension attributes remain in source metadata");
assert.match(bpmnUserTaskMetadata.diChildren[0], /<vendor:visual/, "BPMN DI style child XML remains in source metadata");
const bpmnStartEvent = bpmnElements.find(item => item.componentRole?.includes("startEvent"));
const bpmnStartMetadata = bpmnMetadata(bpmnStartEvent);
assert.equal(bpmnStartMetadata.eventDefinitions[0].attributes["vendor:cycle"], "daily", "event-definition attributes remain in source metadata");
assert.match(bpmnStartMetadata.eventDefinitions[0].extensionXml, /local schedule/, "event-definition extension elements remain in source metadata");
const bpmnExport = bpmnXml.exportBpmnXml(bpmnElements);
assert.match(bpmnExport, /<bpmn:messageFlow/);
assert.match(bpmnExport, /<bpmndi:BPMNShape/);
assert.match(bpmnExport, /xmlns:vendor="https:\/\/example\.test\/bpmn\/vendor"/, "extension namespaces remain declared in exported XML");
assert.match(bpmnExport, /vendor:priority="high"/, "vendor node attributes are exported");
assert.match(bpmnExport, /vendor:flowMetadata key="decision"/, "flow extension elements are exported");
assert.match(bpmnExport, /vendor:visual/, "BPMN DI style extension elements are exported");
assert.match(bpmnExport, /<bpmn:message id="OrderMessage" name="Order details"[^>]*>/, "message declarations referenced by collaboration flows are exported");
assert.match(bpmnExport, /<bpmn:dataObject id="DecisionData" name="Decision data"[^>]*\/>/, "data object declarations referenced by data nodes are exported in process scope");
assert.match(bpmnExport, /vendor:cycle="daily"/, "event-definition attributes are exported");
assert.match(bpmnExport, /vendor:timerMetadata>local schedule/, "event-definition extension elements are exported");
assert.equal(bpmnXml.importBpmnXml(bpmnExport).filter(item => item.componentRole?.startsWith("bpmn-edge|")).length, 4);
const bpmnReopenedTask = bpmnXml.importBpmnXml(bpmnExport).find(item => item.componentRole?.includes("userTask"));
assert.match(bpmnMetadata(bpmnReopenedTask).extensionXml, /Escalation &amp; SLA/, "extensions survive BPMN export and reimport");
const nestedBpmn = bpmnXml.importBpmnXmlWithReport(fixture("process-subprocess.bpmn"));
assert.equal(nestedBpmn.report.simplified, 0, "nested subprocess content is not reported as simplified");
const nestedBpmnExport = bpmnXml.exportBpmnXml(nestedBpmn.elements);
assert.match(nestedBpmnExport, /<bpmn:subProcess[^>]*id="Nested"[^>]*>[\s\S]*<bpmn:startEvent[^>]*id="NestedStart"[^>]*\/>[\s\S]*<bpmn:sequenceFlow id="NestedFlow1"[\s\S]*?<\/bpmn:subProcess>/, "subprocess nodes and their internal flows export inside the subprocess scope");
const nestedBpmnReopened = bpmnXml.importBpmnXml(nestedBpmnExport);
assert.equal(bpmnMetadata(nestedBpmnReopened.find(item => item.componentRole?.includes("NestedTask"))).parentSubprocessId, "Nested", "nested process membership survives BPMN export and reimport");
const fidelityBpmn = bpmnXml.importBpmnXmlWithReport(fixture("process-fidelity.bpmn"));
assert.equal(fidelityBpmn.report.simplified, 1, "unresolvable relationship endpoint pairs are reported as simplified");
assert.equal(fidelityBpmn.report.skipped, 2, "unsupported BPMN nodes and relationships with missing endpoints are reported");
assert.ok(fidelityBpmn.report.details.some(detail => detail.includes("2 additional BPMN DI planes are preserved")), "additional planes from separate BPMN diagrams are counted and reported as retained");
assert.ok(fidelityBpmn.report.details.some(detail => detail.includes("implicitThrowEvent")), "the compatibility report identifies unsupported BPMN node kinds");
assert.ok(fidelityBpmn.report.details.some(detail => detail.includes("Unmapped_Association")), "the compatibility report identifies relationships that cannot be represented by editable connectors");
const fidelityNodes = fidelityBpmn.elements.filter(item => item.componentRole?.startsWith("bpmn-node|"));
const fidelityEdges = fidelityBpmn.elements.filter(item => item.componentRole?.startsWith("bpmn-edge|"));
assert.equal(fidelityNodes.filter(item => bpmnMetadata(item).type === "participant").length, 2, "participants from both collaborations import");
assert.equal(fidelityEdges.filter(item => bpmnMetadata(item).type === "dataInputAssociation").length, 4, "each resolvable data-association endpoint pair imports as a connector");
const fidelityLane = fidelityNodes.find(item => bpmnMetadata(item).sourceId === "Lane_Operations");
assert.deepEqual(bpmnMetadata(fidelityLane).flowNodeRefs, ["Start_Main", "End_Main"], "outer lane membership references retain their original order");
assert.equal(bpmnMetadata(fidelityLane).laneSetId, "LaneSet_Main", "lane-set membership survives import");
const nestedFidelityLane = fidelityNodes.find(item => bpmnMetadata(item).sourceId === "Lane_Review");
assert.deepEqual(bpmnMetadata(nestedFidelityLane).flowNodeRefs, ["Task_Main"], "nested lane membership is kept with its own lane");
assert.equal(bpmnMetadata(nestedFidelityLane).parentLaneId, "Lane_Operations", "nested lane parent membership survives import");
const fidelityDocument = fidelityNodes.map(bpmnMetadata).find(metadata => metadata.document);
assert.equal(fidelityDocument.document.attributes.id, "FidelityDefinitions", "definitions-level attributes attach to the editable document metadata");
assert.ok(fidelityDocument.document.definitionsChildren.some(xml => xml.includes("definitions-level detail")), "definitions-level extension content is retained");
assert.equal(fidelityDocument.document.processes.find(process => process.id === "Process_Main").attributes["vendor:owner"], "operations", "process-level vendor attributes survive import");
assert.equal(fidelityDocument.document.collaborations.length, 2, "collaboration metadata keeps separate collaboration records");
const fidelityTask = fidelityNodes.find(item => bpmnMetadata(item).sourceId === "Task_Main");
fidelityTask.libraryComponent.label = "Check inventory";
fidelityTask.componentBounds.x = 165;
const fidelitySequenceFlow = fidelityEdges.find(item => bpmnMetadata(item).sourceId === "Flow_Main_1");
fidelitySequenceFlow.label = { text: "Inventory available", routePosition: .5 };
const fidelityExport = bpmnXml.exportBpmnXml(fidelityBpmn.elements);
assert.match(fidelityExport, /<bpmn:definitions[^>]*id="FidelityDefinitions"[^>]*targetNamespace="https:\/\/example\.test\/processes"[^>]*vendor:edition="reviewed"/, "definitions attributes survive BPMN export");
assert.match(fidelityExport, /vendor:definitionsMeta owner="process-team">definitions-level detail/, "definitions-level extensions survive BPMN export");
assert.match(fidelityExport, /<bpmn:process[^>]*id="Process_Main"[^>]*isExecutable="true"[^>]*vendor:owner="operations"/, "process metadata remains associated with its own process");
assert.match(fidelityExport, /<bpmn:process[^>]*id="Process_Archive"[^>]*isExecutable="false"[^>]*vendor:owner="archive"/, "second process and its attributes export separately");
assert.match(fidelityExport, /<bpmn:laneSet[^>]*id="LaneSet_Main"[^>]*vendor:layout="horizontal"[\s\S]*<bpmn:childLaneSet[^>]*id="LaneSet_Review"[^>]*vendor:layout="vertical"[\s\S]*<bpmn:flowNodeRef>Task_Main<\/bpmn:flowNodeRef>/, "nested lane-set attributes and flow-node membership export");
assert.match(fidelityExport, /<bpmn:collaboration[^>]*id="Collaboration_Orders"[^>]*vendor:region="west"[\s\S]*vendor:collaborationMeta channel="orders"[\s\S]*Participant_Orders[\s\S]*Message_Orders[\s\S]*<\/bpmn:collaboration>/, "first collaboration keeps its identity, participant, message flow, and extension");
assert.match(fidelityExport, /<bpmn:collaboration[^>]*id="Collaboration_Archive"[^>]*vendor:region="east"[\s\S]*Participant_Archive[\s\S]*Message_Archive[\s\S]*<\/bpmn:collaboration>/, "second collaboration exports as its own container");
assert.match(fidelityExport, /<bpmn:sourceRef>Start_Main<\/bpmn:sourceRef>[\s\S]*<bpmn:sourceRef>Task_Main<\/bpmn:sourceRef>[\s\S]*<bpmn:targetRef>Task_Main<\/bpmn:targetRef>[\s\S]*<bpmn:targetRef>End_Main<\/bpmn:targetRef>/, "all source and target references on multi-endpoint data associations export");
assert.match(fidelityExport, /<bpmn:conditionExpression[^>]*>inventoryAvailable = true<\/bpmn:conditionExpression>/, "sequence-flow conditions survive export");
assert.match(fidelityExport, /<bpmn:task[^>]*id="Task_Main"[^>]*name="Check inventory"/, "edits to a BPMN node label export under its original semantic ID");
assert.match(fidelityExport, /<dc:Bounds x="165" y="68" width="120" height="72"\/>/, "edits to BPMN node geometry update the primary diagram-interchange bounds");
assert.match(fidelityExport, /<bpmn:sequenceFlow id="Flow_Main_1"[^>]*name="Inventory available"/, "edits to relationship labels export under the original relationship ID");
assert.match(fidelityExport, /<bpmn:implicitThrowEvent[^>]*id="Unsupported_Event"/, "unsupported process nodes remain in original BPMN XML");
assert.match(fidelityExport, /<bpmndi:BPMNPlane[^>]*id="Plane_Alternate"/, "additional planes inside the primary diagram remain in exported XML");
assert.match(fidelityExport, /<bpmndi:BPMNDiagram[^>]*id="Diagram_Archive"/, "additional BPMN diagrams remain in exported XML");
assert.match(fidelityExport, /<bpmn:association id="Unmapped_Association" sourceRef="Missing_Source" targetRef="Missing_Target"[\s\S]*vendor:unmapped reason="missing-endpoints"/, "relationships without editable endpoints remain in their original process XML");
const fidelityReopened = bpmnXml.importBpmnXmlWithReport(fidelityExport);
assert.equal(fidelityReopened.report.simplified, 1, "the unsupported relationship endpoint remains visible in the loss report after reimport");
assert.equal(fidelityReopened.elements.filter(item => item.componentRole?.startsWith("bpmn-edge|") && bpmnMetadata(item).type === "dataInputAssociation").length, 4, "all data-association branches survive BPMN export and reimport");
const reopenedFidelityTask = fidelityReopened.elements.find(item => item.componentRole?.startsWith("bpmn-node|") && bpmnMetadata(item).sourceId === "Task_Main");
assert.equal(reopenedFidelityTask.libraryComponent.label, "Check inventory", "BPMN node label edits survive export and reimport");
assert.equal(reopenedFidelityTask.componentBounds.x, 165, "BPMN node geometry edits survive export and reimport");
assert.ok(fidelityReopened.report.details.some(detail => detail.includes("Unmapped_Association")), "reimport reports preserved unsupported relationship content by ID");
const selectedFidelityExport = bpmnXml.exportBpmnXml([fidelityTask], fidelityBpmn.elements);
assert.match(selectedFidelityExport, /id="FidelityDefinitions"/, "selection export uses full-document metadata context");
assert.match(selectedFidelityExport, /<bpmn:process[^>]*id="Process_Main"[^>]*vendor:owner="operations"/, "selection export retains metadata for its process");
assert.throws(() => bpmnXml.importBpmnXml("<!DOCTYPE definitions [<!ENTITY x SYSTEM 'file:///etc/passwd'>]><definitions/>"), /DOCTYPE/);
const workspaceSource = fixture("structurizr-workspace.json");
const workspaceElements = structurizrWorkspace.structurizrWorkspaceJsonToDiagram(workspaceSource);
assert.equal(workspaceElements.filter(item => item.componentRole?.startsWith("structurizr-workspace-node|")).length, 7, "Structurizr workspace JSON imports the supported C4 and deployment model nodes");
assert.equal(workspaceElements.filter(item => item.componentRole?.startsWith("structurizr-workspace-edge|")).length, 2, "Structurizr workspace JSON imports relationships from nested source records");
const workspaceExport = JSON.parse(structurizrWorkspace.exportStructurizrWorkspaceJson(workspaceElements));
assert.equal(workspaceExport.name, "Payments Platform", "Structurizr workspace name is retained");
assert.equal(workspaceExport.model.softwareSystems[0].containers[0].components[0].id, "4", "Nested C4 element identity survives workspace export");
assert.equal(workspaceExport.model.people[0].tags, "Person, External", "Structurizr element tags survive workspace export");
assert.equal(workspaceExport.model.softwareSystems[0].containers[0].relationships[0].technology, "HTTPS", "Relationship technology survives workspace export");
assert.equal(workspaceExport.model.deploymentNodes[0].containerInstances[0].containerId, "3", "Deployment instance references survive workspace export");
assert.equal(workspaceExport.views.systemLandscapeViews[0].relationships[0].id, "r1", "Workspace JSON exports a generated editable system-landscape view");
const workspaceAgain = structurizrWorkspace.structurizrWorkspaceJsonToDiagram(JSON.stringify(workspaceExport));
assert.equal(workspaceAgain.filter(item => item.componentRole?.startsWith("structurizr-workspace-node|")).length, 7, "Structurizr workspace JSON model round-trips through editable elements");
const reopenedWorkspaceSketch = sketchParser.parseSketchFile({ format: "SketchDraw", version: sketchModel.SKETCH_FORMAT_VERSION, canvas: { activePageId: "structurizr", pages: [{ id: "structurizr", name: "Structurizr", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" }, elements: workspaceElements }] } });
assert.equal(reopenedWorkspaceSketch?.pages[0].elements.filter(item => item.componentRole?.startsWith("structurizr-workspace-node|")).length, 7, "Structurizr workspace element metadata survives SketchDraw save/reopen");
const workspaceAfterReopen = JSON.parse(structurizrWorkspace.exportStructurizrWorkspaceJson(reopenedWorkspaceSketch.pages[0].elements));
assert.equal(workspaceAfterReopen.model.softwareSystems[0].containers[0].components[0].id, "4", "Workspace model identity survives a SketchDraw save/reopen round trip");
assert.throws(() => structurizrWorkspace.structurizrWorkspaceJsonToDiagram('{"model":{}}'), /no supported people|missing its stable ID/, "empty Structurizr workspace models fail with an actionable message");
const stencilElement = { type: "rectangle", id: "stencil-rectangle", x: 0, y: 0, w: 120, h: 80, color: "#222222", thickness: 2, label: { text: "Reusable" } };
const portableLibrarySource = customStencils.exportPortableStencilLibrary([{ id: "stencil-1", name: "Reusable card", elements: [stencilElement], tags: ["architecture"], preview: "Reusable" }], [{ id: "master-1", name: "Reusable master", template: [stencilElement], bounds: { x: 0, y: 0, w: 120, h: 80 }, variants: { hover: [stencilElement] }, states: { hover: "hover" } }]);
const portableLibrary = customStencils.parsePortableStencilLibrary(portableLibrarySource);
assert.equal(portableLibrary.format, "SketchDrawStencilLibrary", "Portable JSON component libraries use the documented format identifier");
assert.equal(portableLibrary.version, 2, "Portable JSON component libraries export the current schema version");
assert.equal(portableLibrary.stencils[0].elements[0].id, "stencil-rectangle", "Portable JSON component libraries preserve editable element data");
assert.equal(portableLibrary.masters[0].states.hover, "hover", "Portable JSON component libraries preserve mapped interaction states");
assert.throws(() => customStencils.exportPortableStencilLibrary(Array.from({ length: 41 }, (_, index) => ({ id: String(index), name: "Stencil", elements: [stencilElement], tags: [], preview: "" }))), /up to 40 components/, "Portable library export rejects overflow rather than silently dropping stencils");
const portableLibraryV1 = customStencils.parsePortableStencilLibrary(JSON.stringify({ format: "SketchDrawStencilLibrary", version: 1, stencils: [{ id: "legacy", name: "Legacy", elements: [stencilElement] }] }));
assert.equal(portableLibraryV1.stencils[0].name, "Legacy", "Portable JSON component libraries keep the supported version 1 import path");
const dbtManifest = dataPipeline.dbtManifestToDiagram({ metadata: { dbt_version: "1.8.0" }, nodes: {
  "model.shop.stg_orders": { unique_id: "model.shop.stg_orders", name: "stg_orders", resource_type: "model", original_file_path: "models/stg_orders.sql", config: { materialized: "view" }, depends_on: { nodes: ["source.shop.raw.orders"] } },
  "model.shop.fact_orders": { unique_id: "model.shop.fact_orders", name: "fact_orders", resource_type: "model", original_file_path: "models/fact_orders.sql", config: { materialized: "table" }, depends_on: { nodes: ["model.shop.stg_orders"] } },
  "test.shop.not_null": { unique_id: "test.shop.not_null", name: "not_null_fact_orders_id", resource_type: "test", depends_on: { nodes: ["model.shop.fact_orders"] } },
}, sources: { "source.shop.raw.orders": { unique_id: "source.shop.raw.orders", name: "orders", source_name: "raw", resource_type: "source", description: "Raw order input." } } });
assert.equal(dbtManifest.filter(item => item.type !== "group" && item.componentRole?.startsWith("dbt-node|")).length, 4, "dbt models, tests, and sources import");
assert.equal(dbtManifest.filter(item => item.type === "arrow" && item.label?.text === "feeds").length, 3, "dbt dependencies become lineage arrows");
const sqlLineage = pipelineSql.sqlLineageToDiagram(fixture("sql-lineage.sql"));
const sqlLineageNodes = sqlLineage.filter(item => item.type !== "group" && item.componentRole?.startsWith("sql-lineage-node|"));
const sqlLineageEdges = sqlLineage.filter(item => item.type === "arrow" && item.componentRole?.startsWith("sql-lineage-edge|"));
assert.ok(sqlLineageNodes.some(item => item.label?.text.includes("analytics.staged_orders")), "SQL view lineage keeps qualified output names");
assert.ok(sqlLineageNodes.some(item => item.label?.text.includes("raw_orders")), "SQL lineage includes source tables");
assert.ok(sqlLineageEdges.some(item => item.label?.text === "lineage (inferred from SQL)" && item.liveKey === "raw_orders -> analytics.staged_orders"), "SQL lineage marks SELECT-derived edges as inferred");
assert.ok(sqlLineageEdges.some(item => item.liveKey === "analytics.staged_orders -> analytics.daily_order_counts"), "SQL CTAS outputs connect to their inferred table inputs");
assert.ok(!sqlLineageNodes.some(item => item.label?.text.startsWith("filtered\\n")), "SQL CTE aliases are not mistaken for physical source tables");
assert.ok(pipelineSql.sqlLineageToDiagram("CREATE TABLE orders (id INTEGER);").some(item => item.type !== "group" && item.label?.text.includes("SQL table")), "standalone SQL table declarations import as nodes even when they have no inferred lineage");
const airflow = pipelineWorkflows.airflowDagToDiagram(fixture("airflow-dag.py"));
const airflowEdges = airflow.filter(item => item.type === "arrow");
assert.ok(airflow.some(item => item.type !== "group" && item.label?.text.includes("DAG: orders_daily") && item.label.text.includes("Schedule: @daily")), "Airflow imports retain the DAG name and literal schedule");
assert.ok(airflowEdges.some(item => item.label?.text === "depends on (configured)" && item.liveKey === "start -> extract"), "Airflow bitshift dependencies are marked configured");
assert.ok(airflowEdges.some(item => item.label?.text === "depends on (configured)" && item.liveKey === "extract -> publish"), "Airflow set_downstream calls are mapped as configured dependencies");
assert.ok(airflowEdges.some(item => item.label?.text.includes("inferred from TaskFlow argument") && item.liveKey === "extract -> normalized"), "Airflow TaskFlow argument dependencies are marked inferred");
assert.ok(airflow.some(item => item.type !== "group" && item.label?.text.includes("TaskGroup: delivery")), "Airflow TaskGroup membership is retained on its task node");
assert.throws(() => pipelineWorkflows.airflowDagToDiagram("task = PythonOperator(task_id='task')"), /No Airflow DAG declaration/, "arbitrary Python operator calls are not mistaken for a complete Airflow DAG file");
const githubWorkflow = pipelineWorkflows.githubActionsWorkflowToDiagram(fixture("github-actions.yml"));
assert.ok(githubWorkflow, "GitHub Actions workflow YAML is detected");
const githubNodes = githubWorkflow.filter(item => item.type !== "group" && item.componentRole?.startsWith("github-job|"));
const githubEdges = githubWorkflow.filter(item => item.type === "arrow" && item.componentRole?.startsWith("github-needs|"));
assert.equal(githubNodes.length, 3, "GitHub Actions jobs import as editable workflow nodes");
assert.ok(githubNodes.some(item => item.label?.text.includes("Triggers: push, workflow_dispatch") && item.label.text.includes("Matrix: node")), "workflow nodes retain triggers and job matrix details");
assert.ok(githubEdges.some(item => item.label?.text === "needs (configured)" && item.liveKey === "lint -> test"), "GitHub Actions needs references are marked configured");
assert.equal(pipelineWorkflows.githubActionsWorkflowToDiagram("services:\n  api:\n    image: example"), undefined, "non-workflow YAML continues through the existing structured importer");
assert.throws(() => pipelineWorkflows.githubActionsWorkflowToDiagram("on: push\njobs:\n  build:\n    needs: missing"), /needs unknown job/, "GitHub Actions dependencies to undeclared jobs are reported");
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

assert.ok(formats.plantUmlToDiagram("@startuml\nstart\n:Do work;\nstop\n@enduml").some(item => item.componentRole?.startsWith("plantuml-activity-node:")), "PlantUML activity source is routed through the editable activity importer");
const plantClassElements = formats.plantUmlToDiagram(fixture("orders.puml"));
const plantClassCards = plantClassElements.filter(item => item.type === "group" && item.libraryComponent?.kind === "uml-class");
assert.equal(plantClassCards.length, 2, "PlantUML class import creates native editable UML cards");
const plantClassRelationship = plantClassElements.find(item => item.type === "line" && item.componentRole?.startsWith("uml-class-relation:"));
assert.equal(plantClassRelationship?.endHead, "solid", "PlantUML class relationships are attached to the editable cards");
assert.equal(plantClassRelationship?.label.text, "1 · many · places", "PlantUML relationship cardinalities stay visible on the canvas");
const plantClassGroup = { type: "group", id: "plantuml-class-fixture", elements: plantClassElements, mermaid: { format: "plantuml", diagramType: "class", source: fixture("orders.puml") } };
const plantClassExport = formats.exportDiagramCode("puml", [plantClassGroup]);
assert.ok(plantClassExport.includes('Customer "1" --> "many" Order : places'), "PlantUML class relationships preserve cardinality and labels after editing");
const plantClassReimport = formats.plantUmlToDiagram(plantClassExport);
assert.equal(plantClassReimport.filter(item => item.type === "group" && item.libraryComponent?.kind === "uml-class").length, 2, "native PlantUML class cards survive source round-trip");
const plantSequenceSource = "@startuml\nactor \"End User\" as User\nparticipant API\ndatabase Store\nUser -> API: request\nAPI -->> Store: query\nStore --> API: rows\nAPI -> User: response\n@enduml";
assert.equal(formats.isPlantUmlSequence(plantSequenceSource), true);
assert.equal(formats.isPlantUmlSequence("@startuml\nA -> B: hello\n@enduml"), true, "Implicit PlantUML sequence participants are recognized");
const plantSequenceElements = formats.plantUmlToDiagram(plantSequenceSource);
assert.equal(plantSequenceElements.filter(item => item.type === "arrow").length, 4, "PlantUML sequence messages become editable arrows");
const plantSequenceParticipants = plantSequenceElements.filter(item => item.type === "group" && item.componentRole?.startsWith("plantuml-sequence-participant:"));
assert.equal(plantSequenceParticipants.length, 3, "PlantUML sequence participants receive editable lifeline groups");
assert.equal(plantSequenceParticipants.filter(item => item.type === "group" && item.elements.some(child => child.type === "line" && child.lineStyle === "dashed")).length, 3);
const plantSequenceGroup = { type: "group", id: "plantuml-sequence-fixture", elements: plantSequenceElements, mermaid: { format: "plantuml", diagramType: "sequence", source: plantSequenceSource } };
const plantSequenceExport = formats.exportDiagramCode("puml", [plantSequenceGroup]);
assert.equal(formats.plantUmlToDiagram(plantSequenceExport).filter(item => item.type === "arrow").length, 4, "PlantUML sequence messages survive source export and reimport");

const plantUmlFamilyFixtures = ["activity", "state", "usecase", "component", "deployment", "timing", "mindmap", "wbs", "gantt", "network", "json", "yaml", "archimate"];
for (const family of plantUmlFamilyFixtures) {
  const source = fixture(`plantuml-${family}.puml`);
  assert.equal(plantuml.detectPlantUmlFamily(source), family, `${family} fixture is detected as its PlantUML family`);
  const generated = formats.plantUmlToDiagram(source);
  const nodePrefix = `plantuml-${family}-node:`;
  assert.ok(generated.some(item => item.componentRole?.startsWith(nodePrefix)), `${family} source creates editable, source-linked nodes`);
  const wrapper = { type: "group", id: `plantuml-${family}-fixture`, elements: generated, mermaid: { format: "plantuml", diagramType: family, source } };
  const exported = formats.exportDiagramCode("puml", [wrapper]);
  const reimported = formats.plantUmlToDiagram(exported);
  assert.ok(reimported.some(item => item.componentRole?.startsWith(nodePrefix)), `${family} nodes survive source export and reimport`);
  const reopened = sketchParser.parseSketchFile({ format: "SketchDraw", version: sketchModel.SKETCH_FORMAT_VERSION, canvas: { activePageId: family, pages: [{ id: family, name: family, canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff" }, elements: [wrapper] }] } });
  assert.equal(reopened.pages[0].elements[0].mermaid.diagramType, family, `${family} PlantUML metadata survives .sketch reopen`);
  assert.equal(reopened.pages[0].elements[0].mermaid.source, source, `${family} PlantUML source survives .sketch reopen`);
  const capabilities = plantuml.plantUmlCapabilitySummary(source);
  assert.ok(capabilities?.supported && capabilities.knownLimits, `${family} documents supported constructs and known limits`);
}
const plantActivity = formats.plantUmlToDiagram(fixture("plantuml-activity.puml"));
const forkJoin = plantActivity.find(item => item.type === "circle" && item.label?.text === "Join");
assert.ok(forkJoin, "PlantUML fork creates an editable join node");
assert.equal(plantActivity.filter(item => item.type === "arrow" && item.endBinding?.elementId === forkJoin.id).length, 2, "each parallel activity branch joins exactly once");
assert.ok(plantActivity.some(item => item.type === "rectangle" && item.componentRole?.startsWith("plantuml-activity-frame:") && item.label?.text === "Worker lane"), "activity partitions become editable lane frames");
const plantState = formats.plantUmlToDiagram(fixture("plantuml-state.puml"));
assert.ok(plantState.some(item => item.type === "rectangle" && item.componentRole?.startsWith("plantuml-state-frame:") && item.label?.text === "Payment"), "composite PlantUML states create editable boundary frames");
const editableMindmap = formats.plantUmlToDiagram(fixture("plantuml-mindmap.puml"));
const renamedMindmap = editableMindmap.map(item => item.componentRole?.startsWith("plantuml-mindmap-node:") && item.type === "rectangle" && item.label?.text === "Discover" ? { ...item, label: { ...item.label, text: "Explore" } } : item);
const mindmapGroup = { type: "group", id: "plantuml-editable-mindmap", elements: renamedMindmap, mermaid: { format: "plantuml", diagramType: "mindmap", source: fixture("plantuml-mindmap.puml") } };
const editedMindmapSource = formats.exportDiagramCode("puml", [mindmapGroup]);
assert.ok(editedMindmapSource.includes("** Explore"), "PlantUML text edits patch the mapped source label");
assert.ok(formats.plantUmlToDiagram(editedMindmapSource).some(item => item.type === "rectangle" && item.label?.text === "Explore"), "edited PlantUML source reparses to the new canvas label");
assert.throws(() => formats.plantUmlToDiagram("@startactivity\nelseif (unsupported)\n@endactivity"), /outside the current activity subset.*line 2, column 1/, "unsupported PlantUML constructs identify their source line and column");

// Lasso selection: strokes are picked when most of their ink is enclosed.
const lasso = loadTs(path.join(root, "src", "features", "canvas", "lasso-selection.ts"));
const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
assert.ok(lasso.pointInPolygon({ x: 50, y: 50 }, square));
assert.ok(!lasso.pointInPolygon({ x: 150, y: 50 }, square));
const insideStroke = { type: "freehand", id: "in", color: "#000000", thickness: 2, points: [{ x: 10, y: 10 }, { x: 40, y: 40 }, { x: 80, y: 60 }] };
const outsideStroke = { type: "freehand", id: "out", color: "#000000", thickness: 2, points: [{ x: 200, y: 10 }, { x: 240, y: 40 }] };
const halfStroke = { type: "freehand", id: "half", color: "#000000", thickness: 2, points: [{ x: 95, y: 50 }, { x: 140, y: 50 }, { x: 160, y: 50 }, { x: 180, y: 50 }] };
const lockedStroke = { ...insideStroke, id: "locked", locked: true };
assert.deepEqual(lasso.lassoSelectIndices([insideStroke, outsideStroke, halfStroke, lockedStroke], square, item => !item.locked), [0]);
assert.deepEqual(lasso.lassoSelectIndices([insideStroke], square.slice(0, 2), () => true), []);
const lassoPath = [{ x: 0, y: 0 }];
assert.ok(!lasso.appendLassoPoint(lassoPath, { x: 0.5, y: 0 }, 2));
assert.ok(lasso.appendLassoPoint(lassoPath, { x: 5, y: 0 }, 2));

// Accessibility: WCAG contrast, outline names, alt text, and color-vision modes.
const a11y = loadTs(path.join(root, "src", "features", "accessibility", "accessibility.ts"));
assert.ok(Math.abs(a11y.contrastRatio("#000000", "#ffffff") - 21) < 1e-6);
assert.ok(a11y.contrastRatio("#777777", "#ffffff") < 4.5);
assert.equal(a11y.contrastRatio("not-a-color", "#ffffff"), undefined);
assert.equal(a11y.COLOR_BLIND_SAFE_PALETTE.length, 8);
assert.ok(a11y.COLOR_VISION_MODES.every(mode => mode.id === "none" || mode.matrix.split(/\s+/).length === 20));
const labelled = { type: "rectangle", id: "api", x: 0, y: 0, w: 100, h: 60, color: "#000000", thickness: 2, fillColor: "#000000", fillOpacity: 1, label: { text: "API", color: "#222222", fontSize: 14, verticalAlign: "middle" } };
const picture = { type: "image", id: "pic", x: 200, y: 0, w: 50, h: 50, dataUrl: "data:image/png;base64,AAAA" };
const described = { ...picture, id: "pic2", y: 100, altText: "Architecture sketch" };
const lowContrast = a11y.accessibilityIssues([labelled, picture, described], "#ffffff");
assert.ok(lowContrast.some(issue => issue.code === "low-contrast" && issue.elementId === "api"));
assert.deepEqual(lowContrast.filter(issue => issue.code === "missing-alt-text").map(issue => issue.elementId), ["pic"]);
assert.equal(a11y.accessibilityIssues([{ ...labelled, label: { ...labelled.label, color: "#ffffff" } }], "#ffffff").length, 0);
assert.ok(a11y.accessibilityIssues([{ ...labelled, label: { ...labelled.label, color: "#ffffff" } }], "#ffffff", () => "#000000").some(issue => issue.code === "low-contrast"));
assert.equal(a11y.describeElement(labelled), "Rectangle: API");
assert.equal(a11y.describeElement(described), "Image: Architecture sketch");
assert.equal(a11y.describeElement(picture), "Image (no label)");
const outline = a11y.buildDocumentOutline([described, labelled, { type: "group", id: "g", elements: [picture] }]);
assert.deepEqual(outline.map(entry => entry.indices.join(".")), ["1", "2", "2.0", "0"]);
assert.ok(outline.some(entry => entry.indices.join(".") === "2.0" && entry.depth === 1));
assert.ok(validation.validateDiagram([labelled, picture], [], { includeOverlaps: false, accessibility: { boardColor: "#ffffff" } }).some(issue => issue.code === "missing-alt-text"));
assert.ok(!validation.validateDiagram([labelled, picture], [], { includeOverlaps: false }).some(issue => issue.code === "missing-alt-text"));

// Style library: bindings update every linked object but never overwrite a manual edit.
const styles = loadTs(path.join(root, "src", "features", "styles", "style-library.ts"));
const library = { colors: [{ id: "brand", name: "Brand", value: "#2468a0" }], textStyles: [{ id: "title", name: "Title", fontSize: 28, fontFamily: "serif", bold: true }], strokeStyles: [{ id: "heavy", name: "Heavy", thickness: 6, lineStyle: "dashed" }] };
const box = { type: "rectangle", id: "box", x: 0, y: 0, w: 80, h: 40, color: "#000000", thickness: 2, label: { text: "Hi", color: "#111111", fontSize: 12, verticalAlign: "middle" } };
const note = { type: "text", id: "t", x: 0, y: 0, text: "Title", color: "#000000", fontSize: 16 };
const doodle = { type: "freehand", id: "d", color: "#000000", thickness: 2, points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] };
let linkedBox = styles.applyToken(styles.applyToken(styles.applyToken(box, "stroke", "brand", library), "fill", "brand", library), "strokeStyle", "heavy", library);
assert.equal(linkedBox.color, "#2468a0"); assert.equal(linkedBox.fillColor, "#2468a0"); assert.equal(linkedBox.thickness, 6); assert.equal(linkedBox.lineStyle, "dashed");
const linkedNote = styles.applyToken(note, "textStyle", "title", library);
assert.equal(linkedNote.fontSize, 28); assert.equal(linkedNote.fontFamily, "serif"); assert.equal(linkedNote.bold, true);
assert.equal(styles.applyToken(note, "fill", "brand", library), note);
const linkedDoodle = styles.applyToken(styles.applyToken(doodle, "stroke", "brand", library), "strokeStyle", "heavy", library);
assert.equal(linkedDoodle.color, "#2468a0"); assert.equal(linkedDoodle.thickness, 6);
const group = { type: "group", id: "plain", elements: [box, doodle] };
const groupApplied = styles.applyTokenDeep(group, "stroke", "brand", library);
assert.deepEqual(groupApplied.elements.map(child => child.color), ["#2468a0", "#2468a0"]);
const edited = { ...library, colors: [{ id: "brand", name: "Brand", value: "#aa3322" }] };
const refreshed = styles.refreshElementList([linkedBox, linkedNote, linkedDoodle, groupApplied], edited);
assert.equal(refreshed[0].color, "#aa3322"); assert.equal(refreshed[0].fillColor, "#aa3322"); assert.equal(refreshed[0].thickness, 6);
assert.equal(refreshed[2].color, "#aa3322"); assert.equal(refreshed[3].elements[1].color, "#aa3322");
assert.equal(styles.refreshElementList([linkedNote], edited)[0], linkedNote);
const handEdited = { ...linkedBox, color: "#00ff00" };
assert.equal(styles.bindingState(handEdited, "stroke", library).state, "detached");
const afterEdit = styles.refreshStyleBindings(handEdited, edited);
assert.equal(afterEdit.color, "#00ff00"); assert.equal(afterEdit.styleBindings.stroke, undefined); assert.equal(afterEdit.fillColor, "#aa3322");
const deletedToken = styles.refreshStyleBindings(linkedBox, { ...library, colors: [] });
assert.equal(deletedToken.color, "#2468a0"); assert.equal(deletedToken.styleBindings.stroke, undefined); assert.equal(deletedToken.styleBindings.strokeStyle.id, "heavy");
assert.equal(styles.countTokenUsage([linkedBox, groupApplied], "stroke", "brand"), 3);
assert.equal(styles.removeBinding(linkedBox, "fill").styleBindings.fill, undefined);
const frame = { type: "group", id: "frame", elements: [], componentBounds: { x: 0, y: 0, w: 100, h: 100 }, container: { kind: "frame", name: "Frame" } };
assert.equal(styles.applyToken(frame, "fill", "brand", library).container.background, "#2468a0");
assert.deepEqual(styles.supportedSlots({ type: "arrow", id: "a", x: 0, y: 0, w: 10, h: 10, color: "#000000", thickness: 2 }), ["stroke", "strokeStyle"]);
const normalized = styles.normalizeStyleLibrary({ colors: [{ id: "ok", name: " Blue ", value: "#0000FF" }, { id: "bad", value: "blue" }, { id: "ok", value: "#ffffff" }], textStyles: [{ id: "x", fontSize: 4, fontFamily: "sans" }], strokeStyles: "nope" });
assert.deepEqual(normalized.colors, [{ id: "ok", name: "Blue", value: "#0000ff" }]);
assert.equal(normalized.textStyles.length, 0);
assert.equal(styles.normalizeStyleLibrary({ colors: [] }), undefined);
assert.deepEqual(styles.normalizeStyleBindings({ stroke: { id: "brand", applied: "{}" }, bogus: { id: "x", applied: "{}" }, fill: { id: "bad id!", applied: "{}" } }), { stroke: { id: "brand", applied: "{}" } });
// Variables with modes and aliases.
const modeLibrary = { colors: [{ id: "bg", name: "Background", value: "#ffffff", modeValues: { dark: "#101820" } }, { id: "card", name: "Card", value: "#eeeeee", aliasOf: "bg" }], textStyles: [], strokeStyles: [], modes: [{ id: "light", name: "Light" }, { id: "dark", name: "Dark" }] };
assert.equal(styles.resolveColorToken(modeLibrary, modeLibrary.colors[0]), "#ffffff");
assert.equal(styles.resolveColorToken({ ...modeLibrary, activeModeId: "dark" }, modeLibrary.colors[0]), "#101820");
assert.equal(styles.resolveColorToken({ ...modeLibrary, activeModeId: "dark" }, modeLibrary.colors[1]), "#101820");
assert.equal(styles.resolveColorToken({ ...modeLibrary, colors: [{ ...modeLibrary.colors[0], aliasOf: "card" }, modeLibrary.colors[1]] }, modeLibrary.colors[1]) !== undefined, true);
assert.ok(styles.wouldCreateAliasCycle(modeLibrary, "bg", "card"));
assert.ok(!styles.wouldCreateAliasCycle(modeLibrary, "card", "bg"));
const modeBox = styles.applyToken({ ...box, id: "mode-box" }, "fill", "card", modeLibrary);
assert.equal(modeBox.fillColor, "#ffffff");
const darkBox = styles.refreshStyleBindings(modeBox, { ...modeLibrary, activeModeId: "dark" });
assert.equal(darkBox.fillColor, "#101820");
assert.equal(styles.refreshStyleBindings(darkBox, { ...modeLibrary, activeModeId: "light" }).fillColor, "#ffffff");
const roundTrip = styles.normalizeStyleLibrary(JSON.parse(JSON.stringify({ ...modeLibrary, activeModeId: "dark", followTheme: true })));
assert.equal(roundTrip.activeModeId, "dark"); assert.equal(roundTrip.followTheme, true); assert.equal(roundTrip.colors[1].aliasOf, "bg"); assert.equal(roundTrip.colors[0].modeValues.dark, "#101820");
assert.equal(styles.normalizeStyleLibrary({ ...modeLibrary, activeModeId: "missing", colors: [{ ...modeLibrary.colors[0], modeValues: { ghost: "#000000" } }] }).activeModeId, undefined);
assert.deepEqual(styles.mergeStyleLibraries([library, { colors: [{ id: "brand", name: "Other", value: "#ffffff" }, { id: "extra", name: "Extra", value: "#123456" }], textStyles: [], strokeStyles: [] }]).colors.map(token => token.id), ["brand", "extra"]);

// Auto-layout frames: stack, gap, padding, alignment, fill, hug, and stable repeat passes.
const frameLayout = loadTs(path.join(root, "src", "features", "canvas", "auto-layout-frame.ts"));
const cardA = { type: "rectangle", id: "card-a", x: 0, y: 0, w: 50, h: 20, color: "#000000", thickness: 2 };
const cardB = { type: "rectangle", id: "card-b", x: 100, y: 100, w: 30, h: 40, color: "#000000", thickness: 2 };
const stackFrame = (container, bounds = { x: 0, y: 0, w: 200, h: 300 }, children = [cardA, cardB]) => ({ type: "group", id: "stack", elements: children, componentBounds: bounds, container: { kind: "frame", name: "Stack", ...container } });
const stacked = frameLayout.reflowAutoLayoutFrame(stackFrame({ autoLayout: { direction: "vertical", gap: 5, padding: 10, align: "start" } }));
assert.deepEqual(stacked.elements.map(child => [child.x, child.y]), [[10, 10], [10, 35]]);
assert.equal(frameLayout.reflowAutoLayoutFrames([stacked])[0], stacked);
const centered = frameLayout.reflowAutoLayoutFrame(stackFrame({ autoLayout: { direction: "vertical", gap: 5, padding: 10, align: "center" } }));
assert.deepEqual(centered.elements.map(child => child.x), [10 + (180 - 50) / 2, 10 + (180 - 30) / 2]);
const stretched = frameLayout.reflowAutoLayoutFrame(stackFrame({ autoLayout: { direction: "vertical", gap: 5, padding: 10, align: "stretch" } }));
assert.deepEqual(stretched.elements.map(child => child.w), [180, 180]);
const hugged = frameLayout.reflowAutoLayoutFrame(stackFrame({ autoResize: true, autoLayout: { direction: "vertical", gap: 5, padding: 10, align: "start" } }));
assert.deepEqual(hugged.componentBounds, { x: 0, y: 0, w: 70, h: 85 });
const filled = frameLayout.reflowAutoLayoutFrame(stackFrame({ autoLayout: { direction: "horizontal", gap: 10, padding: 10, align: "start" } }, { x: 0, y: 0, w: 300, h: 100 }, [{ ...cardA, layoutFill: true }, { ...cardA, id: "card-c" }]));
assert.deepEqual(filled.elements.map(child => [child.x, child.w]), [[10, 220], [240, 50]]);
const lockedAside = frameLayout.reflowAutoLayoutFrame(stackFrame({ autoLayout: { direction: "vertical", gap: 5, padding: 10, align: "start" } }, undefined, [{ ...cardA, hidden: true }, cardB]));
assert.deepEqual([lockedAside.elements[0].x, lockedAside.elements[1].y], [0, 10]);
assert.equal(frameLayout.reflowAutoLayoutFrames([cardA, cardB]).length, 2);
assert.equal(frameLayout.hasAutoLayoutFrames([cardA, stacked]), true);
assert.equal(frameLayout.hasAutoLayoutFrames([cardA, stackFrame({})]), false);
const nestedLayout = frameLayout.reflowAutoLayoutFrames([{ type: "group", id: "outer", elements: [stackFrame({ autoLayout: { direction: "vertical", gap: 5, padding: 10, align: "start" } })], componentBounds: { x: 0, y: 0, w: 400, h: 400 }, container: { kind: "frame", name: "Outer" } }]);
assert.equal(nestedLayout[0].elements[0].elements[1].y, 35);
const translateModule = loadTs(path.join(root, "src", "features", "canvas", "translate.ts"));
assert.equal(translateModule.translateElement({ ...cardA, locked: true }, 5, 5, item => !item.locked).x, 0);
assert.deepEqual(translateModule.translateElement({ type: "freehand", id: "f", color: "#000000", thickness: 2, points: [{ x: 1, y: 2 }] }, 3, 4).points, [{ x: 4, y: 6 }]);
assert.deepEqual(frameLayout.normalizeAutoLayout({ direction: "horizontal", gap: -4, padding: 9999, align: "bogus" }), { direction: "horizontal", gap: 0, padding: 500, align: "start" });

// Frame navigation: collecting frames, stepping with wrap-around, and bookmark validation.
const navigation = loadTs(path.join(root, "src", "features", "navigation", "frame-navigation.ts"));
const screenFrame = (id, name) => ({ type: "group", id, elements: [], componentBounds: { x: 0, y: 0, w: 10, h: 10 }, container: { kind: "frame", name } });
const navPages = [{ id: "p1", name: "One", elements: [screenFrame("a", "Home"), { ...screenFrame("hidden", "Hidden"), hidden: true }, cardA] }, { id: "p2", name: "Two", elements: [screenFrame("b", "Settings"), screenFrame("c", "")] }];
const navFrames = navigation.collectFrames(navPages);
assert.deepEqual(navFrames.map(frame => [frame.pageId, frame.id, frame.name]), [["p1", "a", "Home"], ["p2", "b", "Settings"], ["p2", "c", "Frame"]]);
assert.equal(navigation.adjacentFrame(navFrames, "p1", "a", 1).id, "b");
assert.equal(navigation.adjacentFrame(navFrames, "p1", "a", -1).id, "c");
assert.equal(navigation.adjacentFrame(navFrames, "p2", undefined, 1).id, "b");
assert.equal(navigation.adjacentFrame(navFrames, "p2", undefined, -1).id, "c");
assert.equal(navigation.adjacentFrame([], "p1", undefined, 1), undefined);
assert.deepEqual(navigation.normalizeBookmarks([{ id: "ok", name: "  Wide ", zoom: .5, panX: 1, panY: 2 }, { id: "ok", zoom: 1, panX: 0, panY: 0 }, { id: "bad id", zoom: 1, panX: 0, panY: 0 }, { id: "nan", zoom: 0, panX: 0, panY: 0 }, "junk"]), [{ id: "ok", name: "Wide", zoom: .5, panX: 1, panY: 2 }]);

// Mind maps: ids, branches, automatic layout on both sides, siblings, and branch deletion.
const mindMap = loadTs(path.join(root, "src", "features", "diagrams", "mind-map.ts"));
let mapElements = [mindMap.createMindMapNode("root", { x: 0, y: 0 }, "Plan", 0)];
const firstIdea = mindMap.addMindMapChild(mapElements, "root", { node: "a", edge: "ea" }, "Alpha");
mapElements = firstIdea.elements;
const alpha = mapElements.find(item => item.id === "a"); const rootNode = mapElements.find(item => item.id === "root");
assert.ok(alpha.x >= rootNode.x + rootNode.w + 40, "first branch grows to the right of the central idea");
const edgeA = mapElements.find(item => item.id === "ea");
assert.equal(edgeA.type, "line"); assert.equal(edgeA.startBinding.elementId, "root"); assert.ok(edgeA.w > 0, "branch curves are resolved to real endpoints");
const secondIdea = mindMap.addMindMapChild(mapElements, "root", { node: "b", edge: "eb" }, "Beta");
mapElements = secondIdea.elements;
const beta = mapElements.find(item => item.id === "b");
assert.ok(beta.x + beta.w <= rootNode.x - 40, "second first-level idea goes to the lighter, left side");
assert.equal(mindMap.mindMapParentId(mapElements, "b"), "root");
const thirdIdea = mindMap.addMindMapSibling(mapElements, "a", { node: "c", edge: "ec" }, "Gamma");
mapElements = thirdIdea.elements;
const alphaNow = mapElements.find(item => item.id === "a"); const gamma = mapElements.find(item => item.id === "c");
assert.ok(Math.abs(gamma.y - alphaNow.y) >= alphaNow.h + 10 && gamma.x === alphaNow.x, "siblings stack on the same side without overlapping");
const grandchild = mindMap.addMindMapChild(mapElements, "a", { node: "a1", edge: "ea1" }, "Detail");
mapElements = grandchild.elements;
const detail = mapElements.find(item => item.id === "a1"); const alphaAfter = mapElements.find(item => item.id === "a");
assert.ok(detail.x > alphaAfter.x + alphaAfter.w && mindMap.mindMapRootId(mapElements, "a1") === "root");
assert.deepEqual(mindMap.mindMapBranchIds(mapElements, "a").sort(), ["a", "a1"]);
const pruned = mindMap.removeMindMapBranch(mapElements, "a");
assert.ok(!pruned.some(item => ["a", "a1", "ea", "ea1"].includes(item.id)) && pruned.some(item => item.id === "b") && pruned.some(item => item.id === "c"));
assert.equal(mindMap.addMindMapSibling([mindMap.createMindMapNode("solo", { x: 0, y: 0 }, "Solo", 0)], "solo", { node: "k", edge: "ek" }).elements.some(item => item.id === "k"), true);
assert.equal(mindMap.addMindMapChild([{ type: "rectangle", id: "plain", x: 0, y: 0, w: 10, h: 10, color: "#000000", thickness: 2 }], "plain", { node: "z", edge: "ez" }), undefined);

// Cloud architecture text: nodes, props, groups, chained and fan-out connections, labels, and errors.
const cloudDsl = loadTs(path.join(root, "src", "features", "diagrams", "cloud-dsl.ts"));
const cloud = cloudDsl.parseCloudDiagram(`// edge to data
direction down
Users [icon: user]
VPC [color: #2468a0] {
  API [icon: aws-api-gateway, label: "Public API, v2"]
  Orders [icon: aws-lambda]
  Data {
    DB [icon: aws-rds]
  }
}
Users > API: HTTPS
API > Orders > DB
Orders <> Cache, Queue
Cache - Queue
my-service > DB # trailing comment
`);
assert.equal(cloud.direction, "down");
assert.deepEqual(cloud.errors, []);
assert.deepEqual(cloud.groups.map(group => [group.name, group.parent ?? null, group.color ?? null]), [["VPC", null, "#2468a0"], ["Data", "VPC", null]]);
assert.deepEqual(cloud.nodes.filter(node => node.group).map(node => [node.name, node.group]), [["API", "VPC"], ["Orders", "VPC"], ["DB", "Data"]]);
assert.equal(cloud.nodes.find(node => node.name === "API").label, "Public API, v2");
assert.equal(cloud.nodes.find(node => node.name === "Users").icon, "user");
assert.deepEqual(cloud.edges.map(edge => `${edge.from}${{ forward: ">", back: "<", both: "<>", none: "-" }[edge.arrow]}${edge.to}${edge.label ? ":" + edge.label : ""}`),
  ["Users>API:HTTPS", "API>Orders", "Orders>DB", "Orders<>Cache", "Orders<>Queue", "Cache-Queue", "my-service>DB"]);
assert.ok(cloud.nodes.some(node => node.name === "my-service" && !node.group));
assert.ok(cloudDsl.parseCloudDiagram("A>B->C").edges.length === 2);
assert.equal(cloudDsl.parseCloudDiagram("A > B").nodes.length, 2);
assert.match(cloudDsl.parseCloudDiagram("Group {\nA").errors[0].message, /missing a closing brace/);
assert.match(cloudDsl.parseCloudDiagram("}").errors[0].message, /Unexpected closing brace/);

// Export to code: Terraform skeletons, OpenAPI stubs, and HTML or React from screen frames.
const scaffolds = loadTs(path.join(root, "src", "features", "diagrams", "code-scaffolds.ts"));
const component = (id, kind, label, extra = {}, fields = []) => ({ type: "group", id, elements: [], componentBounds: { x: 0, y: 0, w: 100, h: 60 }, libraryComponent: { kind, label, componentFields: fields.map(([key, value]) => ({ key, label: key, value })), ...extra } });
const lambdaNode = component("fn", "aws-lambda", "Orders"); const rdsNode = component("db", "aws-rds", "Orders DB"); const bucketNode = component("bucket", "azure-blob-storage", "Assets");
const wire = { type: "arrow", id: "w", x: 0, y: 0, w: 10, h: 0, color: "#000000", thickness: 2, startBinding: { elementId: "fn", anchor: { x: 1, y: .5 } }, endBinding: { elementId: "db", anchor: { x: 0, y: .5 } }, label: { text: "SQL", color: "#000000", fontSize: 12, verticalAlign: "top" } };
const tf = Object.fromEntries(scaffolds.terraformFiles([lambdaNode, rdsNode, bucketNode, wire]).map(file => [file.path, file.contents]));
assert.match(tf["main.tf"], /resource "aws_lambda_function" "orders" \{/);
assert.match(tf["main.tf"], /resource "aws_db_instance" "orders_db" \{/);
assert.match(tf["main.tf"], /resource "azurerm_storage_account" "assets" \{/);
assert.match(tf["main.tf"], /# Diagram: connects to Orders DB \(aws_db_instance\.orders_db\): SQL/);
assert.match(tf["versions.tf"], /hashicorp\/aws/); assert.match(tf["versions.tf"], /hashicorp\/azurerm/); assert.ok(!/hashicorp\/google/.test(tf["versions.tf"]));
assert.match(tf["variables.tf"], /variable "aws_region"/);
assert.equal(scaffolds.terraformFiles([component("a", "aws-lambda", "A"), component("b", "aws-lambda", "A")])[2].contents.match(/"aws_lambda_function" "a/g).length, 2);
assert.throws(() => scaffolds.terraformFiles([component("n", "cloud-cache", "Cache")]), /AWS, Azure, or Google Cloud/);

const yamlModule = require("yaml");
const endpoint = component("ep", "software-api", "Create order", {}, [["method", "POST"], ["path", "/orders/{orderId}/items"], ["summary", "Add an item"], ["request-body", "application/json: NewItem"], ["responses", "201: Item\n404: Order not found\n200: Item[]"], ["parameters", "limit, query, integer, false"], ["security", "Bearer token"], ["server", "https://api.example.com/"]]);
const itemsTable = { type: "schemaTable", id: "t", x: 0, y: 0, w: 100, h: 60, name: "Item", columns: [{ id: "c1", name: "id", dataType: "uuid", primaryKey: true }, { id: "c2", name: "qty", dataType: "integer", nullable: false }, { id: "c3", name: "note", dataType: "text", nullable: true }], schemaDiagramId: "d", schemaSource: "" };
const api = yamlModule.parse(scaffolds.openApiFiles([endpoint, itemsTable])[0].contents);
const operation = api.paths["/orders/{orderId}/items"].post;
assert.equal(api.openapi, "3.1.0"); assert.equal(operation.summary, "Add an item"); assert.equal(operation.operationId, "postOrdersByOrderIdItems");
assert.deepEqual(operation.parameters.map(parameter => [parameter.name, parameter.in, parameter.required]), [["limit", "query", false], ["orderId", "path", true]]);
assert.equal(operation.requestBody.content["application/json"].schema.$ref, "#/components/schemas/NewItem");
assert.equal(operation.responses["201"].content["application/json"].schema.$ref, "#/components/schemas/Item");
assert.equal(operation.responses["200"].content["application/json"].schema.type, "array");
assert.equal(operation.responses["404"].description, "Order not found");
assert.deepEqual(operation.security, [{ bearerAuth: [] }]); assert.equal(api.components.securitySchemes.bearerAuth.scheme, "bearer");
assert.deepEqual(api.servers, [{ url: "https://api.example.com" }]);
assert.deepEqual(api.components.schemas.Item.required.sort(), ["id", "qty"]); assert.equal(api.components.schemas.Item.properties.id.format, "uuid"); assert.equal(api.components.schemas.Item.properties.qty.type, "integer");
assert.match(api.components.schemas.NewItem.description, /TODO/);
assert.throws(() => scaffolds.openApiFiles([lambdaNode]), /API endpoint components/);

const uiComponent = (id, kind, label, y, properties = {}) => ({ type: "group", id, elements: [], componentBounds: { x: 20, y, w: 160, h: 50 }, libraryComponent: { kind, label, uiComponent: { schema: 1, properties } } });
const screenFrame2 = (name, children, container = {}) => ({ type: "group", id: `frame-${name}`, elements: children, componentBounds: { x: 0, y: 0, w: 240, h: 300 }, container: { kind: "frame", name, ...container } });
const signIn = screenFrame2("Sign in", [
  { type: "text", id: "heading", x: 20, y: 10, text: "Welcome <back>", color: "#111111", fontSize: 24, bold: true },
  uiComponent("email", "ui.email-field", "Email", 60, { title: "Email address", placeholder: "you@example.com" }),
  uiComponent("role", "ui.select", "Role", 120, { title: "Role", items: [{ id: "admin", label: "Admin" }, { id: "guest", label: "Guest" }], selectedItemId: "guest" }),
  uiComponent("save", "ui.button", "Save", 190, { title: "Save", action: "Sign in" }),
  { type: "image", id: "logo", x: 20, y: 250, w: 40, h: 40, dataUrl: "data:image/png;base64,AAAA", altText: "Company logo" },
]);
const html = Object.fromEntries(scaffolds.htmlFiles([signIn]).map(file => [file.path, file.contents]));
assert.match(html["index.html"], /<h2 style="position: absolute; left: 20px; top: 10px;[^"]*">Welcome &lt;back&gt;<\/h2>/);
assert.match(html["index.html"], /<label for="email_address"[^>]*>\s*Email address/); assert.match(html["index.html"], /<input id="email_address" name="email_address" type="email" placeholder="you@example.com">/);
assert.match(html["index.html"], /<option value="Guest" selected>Guest<\/option>/); assert.match(html["index.html"], /<button type="button"[^>]*>Sign in<\/button>/);
assert.match(html["index.html"], /role="img" aria-label="Company logo"/); assert.match(html["styles.css"], /\.frame/);
const settingsScreen = screenFrame2("Settings page", [uiComponent("a", "ui.button", "A", 10, { title: "A", action: "One" }), { ...uiComponent("b", "ui.button", "B", 80, { title: "B", action: "Two" }), layoutFill: true }], { autoLayout: { direction: "horizontal", gap: 8, padding: 12, align: "center" } });
const flexHtml = scaffolds.htmlFiles([settingsScreen])[0].contents;
assert.match(flexHtml, /display: flex; flex-direction: row; gap: 8px; padding: 12px; align-items: center/); assert.match(flexHtml, /flex: 1 1 0/); assert.ok(!/position: absolute/.test(flexHtml));
const react = Object.fromEntries(scaffolds.reactFiles([signIn, settingsScreen]).map(file => [file.path, file.contents]));
assert.ok(react["src/screens/SignIn.jsx"] && react["src/screens/SettingsPage.jsx"] && react["package.json"] && react["vite.config.js"]);
assert.match(react["src/screens/SignIn.jsx"], /export default function SignIn\(\) \{/); assert.match(react["src/screens/SignIn.jsx"], /htmlFor="email_address"/);
assert.ok(!/class=|for=/.test(react["src/screens/SignIn.jsx"])); assert.match(react["src/screens/SignIn.jsx"], /className="frame"/); assert.match(react["src/screens/SignIn.jsx"], /defaultValue="Guest"/); assert.ok(!/selected/.test(react["src/screens/SignIn.jsx"]));
assert.match(react["src/screens/SignIn.jsx"], /\{"Welcome <back>"\}/); assert.match(react["src/App.jsx"], /import SettingsPage from "\.\/screens\/SettingsPage\.jsx";/);
assert.equal(JSON.parse(react["package.json"]).dependencies.react.startsWith("^18"), true);
assert.throws(() => scaffolds.htmlFiles([lambdaNode]), /Create a screen frame/);
assert.equal(scaffolds.buildScaffoldFiles("openapi", [endpoint])[0].path, "openapi.yaml");

// Links: only web and email targets are ever kept.
const links = loadTs(path.join(root, "src", "features", "links", "links.ts"));
assert.equal(links.normalizeExternalHref("https://example.com/a b"), undefined);
assert.equal(links.normalizeExternalHref("https://example.com/docs?x=1"), "https://example.com/docs?x=1");
assert.equal(links.normalizeExternalHref("mailto:team@example.com"), "mailto:team@example.com");
for (const unsafe of ["javascript:alert(1)", "data:text/html,hi", "file:///C:/secret.txt", "ftp://example.com", "//example.com", "example.com", "https://", "mailto:", 42, undefined]) assert.equal(links.normalizeExternalHref(unsafe), undefined, String(unsafe));
assert.equal(links.parseTypedHref("example.com/docs"), "https://example.com/docs");
assert.equal(links.parseTypedHref("javascript:alert(1)"), undefined);
assert.equal(links.parseTypedHref(""), undefined);

// Document link checker.
const linkPages = [
  { id: "home", name: "Home", elements: [{ type: "rectangle", id: "go", x: 0, y: 0, w: 10, h: 10, color: "#000000", thickness: 2, pageLinkId: "next" }, { type: "rectangle", id: "dead", x: 0, y: 0, w: 10, h: 10, color: "#000000", thickness: 2, pageLinkId: "gone" }, { type: "rectangle", id: "loop", x: 0, y: 0, w: 10, h: 10, color: "#000000", thickness: 2, pageLinkId: "home" }, { type: "rectangle", id: "ghost", x: 0, y: 0, w: 10, h: 10, color: "#000000", thickness: 2, prototypeTargetId: "elsewhere" }, { type: "group", id: "g", elements: [{ type: "rectangle", id: "inside", x: 0, y: 0, w: 5, h: 5, color: "#000000", thickness: 2 }] }, { type: "rectangle", id: "okproto", x: 0, y: 0, w: 10, h: 10, color: "#000000", thickness: 2, prototypeTargetId: "inside" }] },
  { id: "next", name: "Next", elements: [] },
  { id: "orphan", name: "Orphan", elements: [] },
];
const linkIssues = validation.checkDocumentLinks(linkPages);
assert.deepEqual(linkIssues.map(issue => issue.code).sort(), ["missing-page", "missing-prototype-target", "self-page-link", "unreachable-page"]);
assert.equal(linkIssues.find(issue => issue.code === "unreachable-page").pageId, "orphan");
assert.equal(linkIssues.find(issue => issue.code === "missing-prototype-target").elementId, "ghost");
assert.deepEqual(validation.checkDocumentLinks([{ id: "a", name: "A", elements: [] }, { id: "b", name: "B", elements: [] }]), []);

// Org chart from CSV.
const orgChart = loadTs(path.join(root, "src", "features", "diagrams", "org-chart.ts"));
const org = orgChart.buildOrgChart(orgChart.ORG_CHART_EXAMPLE, { x: 0, y: 0 });
const orgNode = name => org.elements.find(item => item.id === `org-node:${name}`);
assert.equal(org.elements.filter(item => item.type === "rectangle").length, 6); assert.equal(org.elements.filter(item => item.type === "arrow").length, 5);
assert.ok(orgNode("Ada Reyes").y < orgNode("Ben Okafor").y && orgNode("Ben Okafor").y < orgNode("Dev Patel").y, "reports sit below their manager");
assert.equal(orgNode("Dev Patel").y, orgNode("Fay Nguyen").y); assert.ok(orgNode("Dev Patel").x !== orgNode("Fay Nguyen").x);
const adaMid = orgNode("Ada Reyes").x + orgNode("Ada Reyes").w / 2; const kids = [orgNode("Ben Okafor"), orgNode("Chloe Park")];
assert.ok(Math.abs(adaMid - (kids[0].x + kids[1].x + kids[1].w) / 2) < 1, "a manager is centered over their direct reports");
assert.equal(orgNode("Dev Patel").color === orgNode("Fay Nguyen").color && orgNode("Dev Patel").color !== orgNode("Eli Moreau").color, true);
const looped = orgChart.buildOrgChart("name,manager\nA,B\nB,A\nC,Nobody\nA,Duplicate", { x: 0, y: 0 });
assert.ok(looped.warnings.some(text => /loop/i.test(text)) && looped.warnings.some(text => /not in the list/.test(text)) && looped.warnings.some(text => /repeated/.test(text)));
assert.throws(() => orgChart.buildOrgChart("name,title\nA,B", { x: 0, y: 0 }), /manager column/);
assert.throws(() => orgChart.buildOrgChart("a,b\n1,2", { x: 0, y: 0 }), /name column/);

// Sequence playback steps.
const playback = loadTs(path.join(root, "src", "features", "diagrams", "sequence-playback.ts"));
const lifeline = (id, label, x) => ({ type: "group", id, elements: [], componentBounds: { x, y: 0, w: 100, h: 400 }, libraryComponent: { kind: "uml-lifeline", label } });
const msg = (id, from, to, y, text) => ({ type: "arrow", id, x: 50, y, w: 200, h: 0, color: "#000000", thickness: 2, startBinding: { elementId: from, anchor: { x: .5, y: .2 } }, endBinding: { elementId: to, anchor: { x: .5, y: .2 } }, label: { text, color: "#000000", fontSize: 12, verticalAlign: "top" } });
const playbackElements = [lifeline("c", "Client", 0), lifeline("s", "Server", 200), msg("m2", "s", "c", 160, "200 OK"), msg("m1", "c", "s", 80, "GET /orders"), { ...msg("hidden", "c", "s", 120, "x"), hidden: true }, msg("plain", "c", "zz", 100, "not a lifeline")];
const steps = playback.sequenceSteps(playbackElements);
assert.deepEqual(steps.map(step => [step.messageId, step.from, step.to, step.label]), [["m1", "Client", "Server", "GET /orders"], ["m2", "Server", "Client", "200 OK"]]);
assert.equal(playback.rootIndexContaining(playbackElements, "s"), 1); assert.equal(playback.rootIndexContaining(playbackElements, "nope"), -1);

// Data-linked shapes: tables from CSV or JSON, color rules, and refresh.
const dataBinding = loadTs(path.join(root, "src", "features", "data", "data-binding.ts"));
const csvTable = dataBinding.parseDataTable("service,status,load\nAPI,up,42\nDB,down,91\nCache,up,85\n");
assert.deepEqual(csvTable.headers, ["service", "status", "load"]); assert.equal(csvTable.rows.length, 3);
assert.deepEqual(dataBinding.parseDataTable('[{"service":"API","status":"up"},{"service":"DB","load":7}]').headers, ["service", "status", "load"]);
assert.equal(dataBinding.parseDataTable('{"rows":[{"a":1}]}').rows[0][0], "1");
assert.throws(() => dataBinding.parseDataTable("[1,2]"), /array of objects/); assert.throws(() => dataBinding.parseDataTable("  "), /empty/); assert.throws(() => dataBinding.parseDataTable("{oops", "x.json"), /not valid JSON/);
const statusSource = { id: "ops", name: "ops.csv", headers: csvTable.headers, rows: csvTable.rows, updatedAt: 1 };
const parsedRules = dataBinding.parseDataRules("status = down -> fill #D64545, text #ffffff\nload >= 80 -> stroke #b9771d\n// note\nbroken line\nstatus = up -> glow #ffffff");
assert.equal(parsedRules.rules.length, 2); assert.equal(parsedRules.rules[0].fill, "#d64545"); assert.equal(parsedRules.errors.length, 2);
const monitorBox = { type: "rectangle", id: "mon", x: 0, y: 0, w: 100, h: 50, color: "#000000", thickness: 2, label: { text: "old", color: "#111111", fontSize: 14, verticalAlign: "middle" }, dataLink: { source: "ops", key: "service", value: "db", label: "status", rules: "status = down -> fill #d64545, text #ffffff\nload >= 80 -> stroke #b9771d" } };
const linkedBox2 = dataBinding.applyDataLink(monitorBox, statusSource);
assert.equal(linkedBox2.label.text, "down"); assert.equal(linkedBox2.fillColor, "#d64545"); assert.equal(linkedBox2.color, "#b9771d"); assert.equal(linkedBox2.label.color, "#ffffff");
assert.equal(dataBinding.applyDataLink(linkedBox2, statusSource), linkedBox2, "applying again changes nothing");
const healthyBox = dataBinding.applyDataLink({ ...monitorBox, dataLink: { ...monitorBox.dataLink, value: "API" } }, statusSource);
assert.equal(healthyBox.label.text, "up"); assert.equal(healthyBox.fillColor, undefined); assert.equal(healthyBox.color, "#000000");
const missingRow = { ...monitorBox, dataLink: { ...monitorBox.dataLink, value: "Nope" } };
assert.equal(dataBinding.applyDataLink(missingRow, statusSource), missingRow); assert.equal(dataBinding.applyDataLink(monitorBox, undefined), monitorBox);
const textLink = dataBinding.applyDataLink({ type: "text", id: "t", x: 0, y: 0, text: "?", color: "#000000", fontSize: 14, dataLink: { source: "ops", key: "service", value: "Cache", label: "load", rules: "load > 80 -> text #ff0000" } }, statusSource);
assert.equal(textLink.text, "85"); assert.equal(textLink.color, "#ff0000");
const newSource = { ...statusSource, rows: [["API", "down", "10"], ["DB", "up", "12"], ["Cache", "up", "1"]] };
const nestedLinks = [{ type: "group", id: "g", elements: [monitorBox] }, healthyBox];
const refreshedLinks = dataBinding.refreshDataLinks(nestedLinks, [newSource]);
assert.equal(refreshedLinks[0].elements[0].label.text, "up"); assert.equal(refreshedLinks[0].elements[0].fillColor, "#d64545" === refreshedLinks[0].elements[0].fillColor ? "#d64545" : refreshedLinks[0].elements[0].fillColor);
assert.equal(refreshedLinks[1].label.text, "down"); assert.equal(refreshedLinks[1].fillColor, "#d64545");
assert.equal(dataBinding.refreshDataLinks(nestedLinks, []), nestedLinks);
assert.deepEqual(dataBinding.distinctValues(statusSource, "status"), ["up", "down"]);
assert.equal(dataBinding.normalizeDataSources([{ ...statusSource, id: "bad id" }, { ...statusSource, rows: [["too", "many", "cells", "here"]] }, statusSource, { ...statusSource }]).length, 1);
assert.equal(dataBinding.normalizeDataLink({ source: "ops", key: "k", value: "v", rules: "x" }).rules, "x"); assert.equal(dataBinding.normalizeDataLink({ source: "a b", key: "k", value: "v" }), undefined);

// Capacity and cost totals roll up through nested frames.
const metricsModule = loadTs(path.join(root, "src", "features", "diagrams", "metrics.ts"));
const costed = (id, cost, capacity, unit) => ({ type: "rectangle", id, x: 0, y: 0, w: 10, h: 10, color: "#000000", thickness: 2, metrics: { cost, capacity, unit } });
const costTree = [
  { type: "group", id: "prod", elements: [costed("a", 120, 500, "req/s"), costed("b", 80.5, 250, "req/s"), { type: "group", id: "data", elements: [costed("c", 300, 2, "TB")], container: { kind: "container", name: "Data" } }], container: { kind: "frame", name: "Production" } },
  costed("loose", 10),
];
const metricSummary = metricsModule.summarizeMetrics(costTree);
assert.equal(metricSummary.page.cost, 510.5); assert.deepEqual(metricSummary.page.capacity, { "req/s": 750, TB: 2 }); assert.equal(metricSummary.page.counted, 4);
assert.deepEqual(metricSummary.groups.map(group => [group.name, group.totals.cost, group.depth]), [["Production", 500.5, 0], ["Data", 300, 1]]);
assert.match(metricsModule.metricsSummaryText(metricSummary), /Total: \$510\.5 · 750 req\/s · 2 TB \(4 objects\)\n {0}Production: \$500\.5 · 750 req\/s · 2 TB\n {2}Data: \$300 · 2 TB/);
assert.equal(metricsModule.summarizeMetrics([{ type: "rectangle", id: "n", x: 0, y: 0, w: 1, h: 1, color: "#000000", thickness: 1 }]).page.counted, 0);
assert.deepEqual(metricsModule.normalizeMetrics({ cost: 5, capacity: "x", unit: " GB " }), { cost: 5, unit: "GB" }); assert.equal(metricsModule.normalizeMetrics({ cost: Infinity }), undefined); assert.equal(metricsModule.normalizeMetrics(null), undefined);

process.stdout.write("Diagram fixtures passed: Mermaid flowchart, swimlane, Cynefin, Wardley, Event Modeling, ZenUML, sequence, class, ER, state, journey, Gantt, C4, mind map, timeline, Git graph, requirement, quadrant, Kanban, Sankey, block, pie, XY chart, packet, architecture, radar, treemap, Venn, Ishikawa, use case, and TreeView; PlantUML class/object and sequence plus 13 family subsets; DOT clusters, ranks, ports, defaults, styles, and export/reimport; D2 SQL/class/sequence imports and ID/style/layout round trips; PostgreSQL, MySQL, SQLite, and SQL Server DDL parsing/export; CSV graph and chart mapping, 520 categorized modeling components, BPMN XML import/export and XML safety, VSDX CRC/size/decompression limits, checklist formatting/type stability, Structurizr workspace JSON, dbt manifest, SQL transformation and Airflow/GitHub Actions lineage, path bounds, subset errors, lasso selection, accessibility checks, and style library bindings.\n");
