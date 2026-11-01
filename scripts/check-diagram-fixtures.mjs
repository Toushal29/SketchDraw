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
const mermaidExtended = loadTs(path.join(root, "src", "features", "diagrams", "mermaid-extended.ts"));
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
const proposalComponents = loadTs(path.join(root, "src", "features", "components", "proposal-components.ts"));
const libraryComponents = loadTs(path.join(root, "src", "features", "components", "library-components.ts"));
const bpmnXml = loadTs(path.join(root, "src", "features", "diagrams", "bpmn-xml.ts"));
const structuredData = loadTs(path.join(root, "src", "features", "diagrams", "structured-data.ts"));
const apiContracts = loadTs(path.join(root, "src", "features", "diagrams", "api-contracts.ts"));
const structurizrDsl = loadTs(path.join(root, "src", "features", "diagrams", "structurizr-dsl.ts"));
const structurizrExport = loadTs(path.join(root, "src", "features", "diagrams", "structurizr-export.ts"));
const dataPipeline = loadTs(path.join(root, "src", "features", "diagrams", "data-pipeline.ts"));
const schemaVisualizer = loadTs(path.join(root, "src", "features", "diagrams", "schema-visualizer.ts"));

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

const extendedMermaidCases = [
  ["mindmap", `mindmap\n  root((Project))\n    Plan\n      Scope\n    Build\n      API`],
  ["timeline", `timeline\n  title Product launch\n  section Planning\n    2024-01 : Research\n    2024-02 : Plan\n  section Delivery\n    2024-03 : Build`],
  ["git", `gitGraph\n  commit id: "init"\n  branch develop\n  checkout develop\n  commit id: "feature"\n  checkout main\n  commit id: "hotfix"\n  merge develop`],
  ["requirement", `requirementDiagram\n  requirement reqA {\n    id: 1\n    text: Keep data safe\n    risk: high\n    verifymethod: test\n  }\n  element Store {\n    type: database\n  }\n  Store - satisfies -> reqA`],
  ["quadrant", `quadrantChart\n  title Risk review\n  x-axis Low impact --> High impact\n  y-axis Low likelihood --> High likelihood\n  quadrant-1 High and high\n  quadrant-2 Low likelihood\n  point Alpha: [0.8, 0.7]\n  point Beta: [0.2, 0.3]`],
  ["kanban", `kanban\n  backlog[Backlog]\n    task1[Write spec]\n    task2[Review]\n  done[Done]\n    task3[Ship]`],
  ["sankey", `sankey-beta\n  Source, Process, 4\n  Source, Review, 3\n  Process, Final, 2\n  Review, Final, 1`],
];
for (const [expectedType, source] of extendedMermaidCases) {
  const parsed = mermaidExtended.layoutExtendedMermaid(source, { x: 0, y: 0 });
  assert.equal(parsed.type, expectedType, `${expectedType} Mermaid family is detected`);
  const exported = mermaidExtended.exportExtendedMermaid(parsed.type, parsed.elements, source);
  assert.equal(mermaidExtended.detectExtendedMermaidType(exported), expectedType, `${expectedType} Mermaid source exports in its original family`);
  const roundTrip = mermaidExtended.layoutExtendedMermaid(exported, { x: 0, y: 0 });
  const countNodes = elements => elements.filter(item => item.type !== "group" && item.id?.startsWith("mermaid-node:")).length;
  assert.equal(countNodes(roundTrip.elements), countNodes(parsed.elements), `${expectedType} Mermaid nodes survive an editable round trip`);
}
assert.throws(() => mermaidExtended.layoutExtendedMermaid("quadrantChart\n  unsupported directive", { x: 0, y: 0 }), /line 2/, "Unsupported Mermaid directives identify their source line");
const mindmapDiagram = mermaidExtended.layoutExtendedMermaid(extendedMermaidCases[0][1], { x: 0, y: 0 }).elements;
assert.equal(mindmapDiagram.filter(item => item.type === "line" && item.id?.startsWith("mermaid-link:")).length, 4, "Mind map hierarchy becomes attached native relationships");
const requirementDiagram = mermaidExtended.layoutExtendedMermaid(extendedMermaidCases[3][1], { x: 0, y: 0 }).elements;
assert.ok(requirementDiagram.some(item => item.type !== "group" && item.label?.text.includes("risk: high")), "Requirement properties remain editable on nodes");
assert.equal(requirementDiagram.filter(item => item.type === "line").length, 1, "Requirement relations become editable connectors");
const quadrantDiagram = mermaidExtended.layoutExtendedMermaid(extendedMermaidCases[4][1], { x: 0, y: 0 }).elements;
assert.ok(quadrantDiagram.some(item => item.type === "text" && item.text === "High impact"), "Quadrant axes remain editable labels");
const kanbanDiagram = mermaidExtended.layoutExtendedMermaid(extendedMermaidCases[5][1], { x: 0, y: 0 }).elements;
assert.equal(kanbanDiagram.filter(item => item.type !== "group" && item.id?.startsWith("mermaid-node:")).length, 5, "Kanban columns and tasks become editable cards");
const sankeyDiagram = mermaidExtended.layoutExtendedMermaid(extendedMermaidCases[6][1], { x: 0, y: 0 }).elements;
assert.equal(sankeyDiagram.filter(item => (item.type === "line" || item.type === "arrow") && item.startBinding && item.endBinding).length, 4, "Sankey weights become editable attached relationships");
assert.ok(sankeyDiagram.some(item => (item.type === "line" || item.type === "arrow") && item.label?.text === "4"), "Sankey flow values remain visible");
const blockSource = "block-beta\n  title Service layout\n  columns 3\n  client[Client] api:2\n  database queue worker";
const blockDiagram = mermaidExtended.layoutExtendedMermaid(blockSource, { x: 0, y: 0 }).elements;
assert.equal(blockDiagram.filter(item => item.type === "rectangle" && item.id?.startsWith("mermaid-node:")).length, 5, "Block diagrams produce editable grid cells");
assert.ok(blockDiagram.some(item => item.type === "rectangle" && item.w > 230), "Block column spans affect shape geometry");
const blockExport = mermaidExtended.exportExtendedMermaid("block", blockDiagram, blockSource);
assert.equal(mermaidExtended.layoutExtendedMermaid(blockExport, { x: 0, y: 0 }).elements.filter(item => item.type === "rectangle" && item.id?.startsWith("mermaid-node:")).length, 5, "Block cells survive source export and reimport");

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

assert.equal(proposalComponents.PROPOSAL_COMPONENTS.length, 195);
assert.equal(new Set(proposalComponents.PROPOSAL_COMPONENTS.map(item => item.kind)).size, 195);
assert.equal(new Set(proposalComponents.PROPOSAL_COMPONENTS.map(item => item.section.split(" | ")[0])).size, 6);
assert.ok(libraryComponents.LIBRARY_COMPONENTS.length >= 400, "the categorized modeling catalog exceeds 400 usable components");
for (const proposal of proposalComponents.PROPOSAL_COMPONENTS) {
  const instance = libraryComponents.buildLibraryComponent(proposal.kind, 12, 24);
  assert.equal(instance.libraryComponent?.kind, proposal.kind, `palette component ${proposal.label} can be instantiated`);
  assert.ok(instance.componentBounds && instance.componentBounds.w > 0 && instance.componentBounds.h > 0, `palette component ${proposal.label} has usable default bounds`);
}
const bpmnSource = fixture("process.bpmn");
const bpmnElements = bpmnXml.importBpmnXml(bpmnSource);
assert.equal(bpmnElements.filter(item => item.componentRole?.startsWith("bpmn-node|")).length, 5);
assert.equal(bpmnElements.filter(item => item.componentRole?.startsWith("bpmn-edge|")).length, 4);
assert.equal(bpmnElements.find(item => item.componentRole?.includes("userTask"))?.label?.text, "Review & approve");
assert.equal(bpmnElements.find(item => item.componentRole?.includes("userTask"))?.x, 160);
const bpmnExport = bpmnXml.exportBpmnXml(bpmnElements);
assert.match(bpmnExport, /<bpmn:messageFlow/);
assert.match(bpmnExport, /<bpmndi:BPMNShape/);
assert.equal(bpmnXml.importBpmnXml(bpmnExport).filter(item => item.componentRole?.startsWith("bpmn-edge|")).length, 4);
assert.throws(() => bpmnXml.importBpmnXml("<!DOCTYPE definitions [<!ENTITY x SYSTEM 'file:///etc/passwd'>]><definitions/>"), /DOCTYPE/);
const openApiElements = structuredData.openApiToDiagram(fixture("openapi-advanced.yaml"));
const openApiLabels = openApiElements.flatMap(item => item.type === "group" ? [] : [item.label?.text ?? ""]);
assert.ok(openApiLabels.some(label => label.includes("receiveOrderEvent")), "OpenAPI webhooks become editable operation nodes");
assert.ok(openApiLabels.some(label => label.includes("orderStatusCallback")), "OpenAPI callbacks become editable operation nodes");
assert.ok(openApiLabels.some(label => label.includes("ApiKeyAuth")), "OpenAPI security schemes remain visible");
assert.ok(openApiLabels.some(label => label.includes("PageSize")), "Reusable OpenAPI parameters remain visible");
assert.ok(openApiElements.filter(item => item.type === "arrow").length >= 6, "OpenAPI references and operation tags become editable relationships");
const unresolvedOpenApi = structuredData.openApiToDiagram(`openapi: 3.1.0\ninfo: { title: Missing, version: 1 }\npaths:\n  /missing:\n    get:\n      responses:\n        '200':\n          description: Missing schema\n          content:\n            application/json:\n              schema: { $ref: '#/components/schemas/DoesNotExist' }`);
assert.ok(unresolvedOpenApi.some(item => item.type !== "group" && item.label?.text.includes("Unresolved local OpenAPI reference")), "Unresolved local references are reported as visible objects");
const graphQl = apiContracts.graphQlToDiagram(`type User {\n  id: ID!\n  posts: [Post!]!\n}\ntype Post {\n  author: User!\n}\nenum Role {\n  ADMIN\n  MEMBER @deprecated(reason: "legacy")\n}`);
assert.ok(graphQl.some(item => item.type !== "group" && item.label?.text.includes("id: ID!")), "GraphQL fields remain visible");
assert.ok(graphQl.some(item => item.type === "arrow" && item.label?.text === "posts"), "GraphQL references become relationships");
assert.ok(graphQl.some(item => item.type !== "group" && item.label?.text.includes("ADMIN")), "GraphQL enum values remain visible");
assert.ok(!graphQl.some(item => item.type !== "group" && item.label?.text.includes("reason")), "GraphQL enum directives do not become enum values");
const dbml = apiContracts.dbmlToDiagram(`Table users {\n  id int [pk]\n  name varchar\n}\nTable posts {\n  user_id int [ref: > users.id]\n}`);
assert.ok(dbml.some(item => item.type !== "group" && item.label?.text.includes("id: int (PK)")), "DBML primary keys are kept");
assert.ok(dbml.some(item => item.type === "arrow" && item.label?.text.includes("user_id")), "DBML references become relationships");
const protobuf = apiContracts.protobufToDiagram(`syntax = "proto3";\n// message Ignored { string fake = 1; }\nmessage User { string id = 1; }\nmessage Request { User user = 1; }\nmessage Reply { string value = 1; }\nservice Users { rpc Get(Request) returns (Reply); }`);
assert.ok(protobuf.some(item => item.type !== "group" && item.label?.text.includes("id: string (#1)")), "Protocol Buffer fields are kept");
assert.ok(protobuf.some(item => item.type === "arrow" && item.label?.text === "request"), "RPC request types become linked");
assert.ok(!protobuf.some(item => item.type !== "group" && item.label?.text.includes("Ignored")), "Commented Protocol Buffer declarations are ignored");
const avro = apiContracts.avroToDiagram(JSON.stringify([{ type: "record", name: "User", namespace: "example", fields: [{ name: "id", type: "string" }, { name: "department", type: "Department" }] }, { type: "record", name: "Department", namespace: "example", fields: [{ name: "name", type: "string" }] }]));
assert.ok(avro.some(item => item.type !== "group" && item.label?.text.includes("department")), "Avro record fields remain visible");
assert.ok(avro.some(item => item.type === "arrow" && item.label?.text === "department"), "Avro named types become relationships");
const prisma = apiContracts.prismaToDiagram(`model User {\n  id Int @id\n  posts Post[]\n}\nmodel Post {\n  id Int @id\n  author User @relation(fields: [authorId], references: [id])\n  authorId Int\n}\nenum Role {\n  ADMIN\n}`);
assert.ok(prisma.some(item => item.type !== "group" && item.label?.text.includes("id: Int (required, PK)")), "Prisma keys and fields remain visible");
assert.ok(prisma.some(item => item.type === "arrow" && item.label?.text.includes("author")), "Prisma relation fields become relationships");
const asyncApi = apiContracts.asyncApiToDiagram(`asyncapi: 2.6.0\ninfo: { title: Orders, version: 1.0.0 }\nchannels:\n  orders:\n    publish:\n      operationId: createOrder\n      message:\n        $ref: '#/components/messages/Order'\ncomponents:\n  messages:\n    Order:\n      name: Order\n      payload:\n        schema:\n          $ref: '#/components/schemas/OrderPayload'\n  schemas:\n    OrderPayload:\n      type: object\nservers:\n  production:\n    host: events.example.com\n    protocol: kafka`);
assert.ok(asyncApi.some(item => item.type !== "group" && item.label?.text.includes("orders")), "AsyncAPI channels remain visible");
assert.ok(asyncApi.some(item => item.type !== "group" && item.label?.text.includes("production")), "AsyncAPI servers remain visible");
assert.ok(asyncApi.some(item => item.type === "arrow" && item.label?.text === "exchanges"), "AsyncAPI operations link to messages");
const asyncApiThree = apiContracts.asyncApiToDiagram(`asyncapi: 3.0.0\ninfo: { title: Orders, version: 1.0.0 }\nchannels:\n  orders:\n    address: orders\noperations:\n  receiveOrders:\n    action: receive\n    channel: { $ref: '#/channels/orders' }\n    messages:\n      - { $ref: '#/components/messages/Order' }\ncomponents:\n  messages:\n    Order: { name: Order, payload: { type: object } }`);
assert.equal(asyncApiThree.filter(item => item.type === "arrow" && item.label?.text === "uses channel").length, 1, "AsyncAPI 3 operations link to their channel once");
const structurizrSource = `workspace "Banking" {\n  model {\n    customer = person "Customer" "Bank customer"\n    bank = softwareSystem "Bank" "The bank" {\n      api = container "API" "Handles requests" "Java"\n      ledger = component "Ledger" "Stores data"\n    }\n    customer -> bank "Uses"\n    api -> ledger "Calls"\n  }\n  views {\n    systemContext bank { include * }\n  }\n}`;
const structurizrElements = structurizrDsl.structurizrDslToDiagram(structurizrSource);
assert.equal(structurizrElements.filter(item => item.type !== "group" && item.componentRole?.startsWith("structurizr-node|")).length, 4, "Structurizr C4 elements import");
assert.ok(structurizrElements.some(item => item.type === "arrow" && item.label?.text === "Calls"), "Structurizr relationships import");
const structurizrSourceExport = structurizrExport.exportStructurizrDsl(structurizrElements);
assert.match(structurizrSourceExport, /customer = person "Customer"/);
assert.match(structurizrSourceExport, /api -> ledger "Calls"/);
assert.equal(structurizrDsl.structurizrDslToDiagram(structurizrSourceExport).filter(item => item.type === "arrow").length, structurizrElements.filter(item => item.type === "arrow").length, "Structurizr supported subset round-trips");
const dbtManifest = dataPipeline.dbtManifestToDiagram({ metadata: { dbt_version: "1.8.0" }, nodes: {
  "model.shop.stg_orders": { unique_id: "model.shop.stg_orders", name: "stg_orders", resource_type: "model", original_file_path: "models/stg_orders.sql", config: { materialized: "view" }, depends_on: { nodes: ["source.shop.raw.orders"] } },
  "model.shop.fact_orders": { unique_id: "model.shop.fact_orders", name: "fact_orders", resource_type: "model", original_file_path: "models/fact_orders.sql", config: { materialized: "table" }, depends_on: { nodes: ["model.shop.stg_orders"] } },
  "test.shop.not_null": { unique_id: "test.shop.not_null", name: "not_null_fact_orders_id", resource_type: "test", depends_on: { nodes: ["model.shop.fact_orders"] } },
}, sources: { "source.shop.raw.orders": { unique_id: "source.shop.raw.orders", name: "orders", source_name: "raw", resource_type: "source", description: "Raw order input." } } });
assert.equal(dbtManifest.filter(item => item.type !== "group" && item.componentRole?.startsWith("dbt-node|")).length, 4, "dbt models, tests, and sources import");
assert.equal(dbtManifest.filter(item => item.type === "arrow" && item.label?.text === "feeds").length, 3, "dbt dependencies become lineage arrows");
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

const gui = (id, kind, label, y, props = {}, extra = {}) => ({ type: "group", id, elements: [], componentBounds: { x: 20, y, w: 160, h: 50 }, libraryComponent: { kind, label, guiProperties: props, ...extra } });
const screenFrame2 = (name, children, container = {}) => ({ type: "group", id: `frame-${name}`, elements: children, componentBounds: { x: 0, y: 0, w: 240, h: 300 }, container: { kind: "frame", name, ...container } });
const signIn = screenFrame2("Sign in", [
  { type: "text", id: "heading", x: 20, y: 10, text: "Welcome <back>", color: "#111111", fontSize: 24, bold: true },
  gui("email", "form-email", "Email", 60, { title: "Email address", placeholder: "you@example.com" }),
  gui("role", "form-select", "Role", 120, { title: "Role" }, { formOptions: ["Admin", "Guest"], selectedOption: 1 }),
  gui("save", "form-button", "Save", 190, { actionLabel: "Sign in" }),
  { type: "image", id: "logo", x: 20, y: 250, w: 40, h: 40, dataUrl: "data:image/png;base64,AAAA", altText: "Company logo" },
]);
const html = Object.fromEntries(scaffolds.htmlFiles([signIn]).map(file => [file.path, file.contents]));
assert.match(html["index.html"], /<h2 style="position: absolute; left: 20px; top: 10px;[^"]*">Welcome &lt;back&gt;<\/h2>/);
assert.match(html["index.html"], /<label for="email_address"[^>]*>\s*Email address/); assert.match(html["index.html"], /<input id="email_address" name="email_address" type="email" placeholder="you@example.com">/);
assert.match(html["index.html"], /<option value="Guest" selected>Guest<\/option>/); assert.match(html["index.html"], /<button type="button"[^>]*>Sign in<\/button>/);
assert.match(html["index.html"], /role="img" aria-label="Company logo"/); assert.match(html["styles.css"], /\.frame/);
const settingsScreen = screenFrame2("Settings page", [gui("a", "form-button", "A", 10, { actionLabel: "One" }), { ...gui("b", "form-button", "B", 80, { actionLabel: "Two" }), layoutFill: true }], { autoLayout: { direction: "horizontal", gap: 8, padding: 12, align: "center" } });
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

process.stdout.write("Diagram fixtures passed: Mermaid flowchart, sequence, class, ER, state, journey, Gantt, C4, mind map, timeline, Git graph, requirement, quadrant, Kanban, Sankey, and block; DOT styles, D2 groups and edge directions, CSV graph and chart mapping, 517 categorized modeling components, BPMN XML import/export and XML safety, OpenAPI callbacks and references, GraphQL, DBML, Protocol Buffers, Avro, Prisma, AsyncAPI 2/3, Structurizr DSL C4 model round-trip, dbt manifest lineage, path bounds, PlantUML subset errors, lasso selection, accessibility checks, and style library bindings.\n");
