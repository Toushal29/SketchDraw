import type { Element } from "../../model";
import { buildStructuredDiagram, type StructuredGraphLink, type StructuredGraphNode } from "./structured-data";

type JsonObject = Record<string, unknown>;
type StructurizrNodeKind = "person" | "softwareSystem" | "container" | "component" | "deploymentNode" | "infrastructureNode" | "softwareSystemInstance" | "containerInstance";
type NodeMetadata = {
  id: string;
  kind: StructurizrNodeKind;
  name: string;
  parentId?: string;
  fields: JsonObject;
  workspace: { id?: number; name?: string; description?: string; version?: string; enterprise?: JsonObject; properties?: JsonObject };
};
type RelationshipMetadata = { id: string; sourceId: string; destinationId: string; fields: JsonObject };

const MAX_SOURCE_LENGTH = 5_000_000;
const MAX_ELEMENTS = 500;
const MAX_RELATIONSHIPS = 2_000;
const object = (value: unknown): JsonObject | undefined => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
const text = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : "";
const records = (value: unknown): JsonObject[] => Array.isArray(value) ? value.flatMap(item => object(item) ? [object(item)!] : []) : [];
const encode = (value: unknown) => encodeURIComponent(JSON.stringify(value));

function boundedProperties(value: unknown): JsonObject | undefined {
  const input = object(value);
  if (!input) return undefined;
  const pairs = Object.entries(input).slice(0, 100).flatMap(([key, entry]): [string, unknown][] => {
    if (!/^[\p{L}\p{N}_. -]{1,100}$/u.test(key)) return [];
    if (typeof entry === "string") return [[key, entry.slice(0, 1_000)]];
    if (typeof entry === "number" && Number.isFinite(entry) || typeof entry === "boolean") return [[key, entry]];
    return [];
  });
  return pairs.length ? Object.fromEntries(pairs) : undefined;
}

function tagList(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return [...new Set(value.split(",").map(item => item.trim()).filter(Boolean))].slice(0, 40).join(", ") || undefined;
}

function metadataFromRole(role: string | undefined, prefix: string): JsonObject | undefined {
  if (!role?.startsWith(prefix)) return undefined;
  try {
    const decoded: unknown = JSON.parse(decodeURIComponent(role.slice(prefix.length)));
    return object(decoded);
  } catch { return undefined; }
}

function metadataRole(prefix: string, value: unknown): string { return prefix + encode(value); }

function nodeDisplayDetail(kind: string, fields: JsonObject): string {
  const detail = [
    text(fields.description),
    text(fields.technology) ? `Technology: ${text(fields.technology)}` : "",
    text(fields.environment) ? `Environment: ${text(fields.environment)}` : "",
    text(fields.instances) ? `Instances: ${text(fields.instances)}` : "",
    text(fields.location) ? `Location: ${text(fields.location)}` : "",
    tagList(fields.tags) ? `Tags: ${tagList(fields.tags)}` : "",
    text(fields.group) ? `Group: ${text(fields.group)}` : "",
  ].filter(Boolean).join("\n");
  return detail ? `${kind}\n${detail}` : kind;
}

/** Import a Structurizr workspace JSON model as editable C4/deployment nodes and relationships. */
export function structurizrWorkspaceJsonToDiagram(source: string): Element[] {
  if (source.length > MAX_SOURCE_LENGTH) throw new Error("Structurizr workspace JSON is limited to 5 MB.");
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { throw new Error("The Structurizr workspace file is not valid JSON."); }
  const workspace = object(parsed);
  const model = object(workspace?.model);
  if (!workspace || !model) throw new Error("The JSON file must be a Structurizr workspace with a model object.");

  const workspaceFields = {
    ...(typeof workspace.id === "number" && Number.isFinite(workspace.id) ? { id: workspace.id } : {}),
    ...(typeof workspace.name === "string" ? { name: workspace.name.slice(0, 160) } : {}),
    ...(typeof workspace.description === "string" ? { description: workspace.description.slice(0, 2_000) } : {}),
    ...(typeof workspace.version === "string" ? { version: workspace.version.slice(0, 80) } : {}),
    ...(object(model.enterprise) ? { enterprise: { name: text(object(model.enterprise)?.name).slice(0, 160) } } : {}),
    ...(boundedProperties(model.properties) ? { properties: boundedProperties(model.properties) } : {}),
  };
  const nodeList: StructuredGraphNode[] = [];
  const relationshipList: StructuredGraphLink[] = [];
  const nodeBySourceId = new Map<string, { key: string; kind: StructurizrNodeKind }>();
  const pendingRelationships: { sourceId: string; relationship: JsonObject }[] = [];
  const elementIds = new Set<string>();
  const relationshipIds = new Set<string>();

  const addNode = (raw: JsonObject, kind: StructurizrNodeKind, parentId?: string) => {
    const id = text(raw.id).trim();
    if (!id) throw new Error(`Structurizr ${kind} is missing its stable ID.`);
    if (elementIds.has(id)) throw new Error(`Structurizr workspace contains duplicate element ID "${id}".`);
    if (nodeList.length >= MAX_ELEMENTS) throw new Error(`Structurizr workspace imports are limited to ${MAX_ELEMENTS} model elements.`);
    elementIds.add(id);
    const name = text(raw.name).trim() || `${kind} ${nodeList.length + 1}`;
    const fields: JsonObject = {
      ...(typeof raw.description === "string" ? { description: raw.description.slice(0, 2_000) } : {}),
      ...(typeof raw.technology === "string" ? { technology: raw.technology.slice(0, 240) } : {}),
      ...(typeof raw.tags === "string" ? { tags: tagList(raw.tags) ?? "" } : {}),
      ...(typeof raw.url === "string" ? { url: raw.url.slice(0, 2_000) } : {}),
      ...(typeof raw.location === "string" ? { location: raw.location } : {}),
      ...(typeof raw.group === "string" ? { group: raw.group.slice(0, 240) } : {}),
      ...(typeof raw.environment === "string" ? { environment: raw.environment.slice(0, 240) } : {}),
      ...(typeof raw.instances === "string" ? { instances: raw.instances.slice(0, 120) } : {}),
      ...(typeof raw.instanceId === "number" && Number.isFinite(raw.instanceId) ? { instanceId: raw.instanceId } : {}),
      ...(typeof raw.softwareSystemId === "string" ? { softwareSystemId: raw.softwareSystemId } : {}),
      ...(typeof raw.containerId === "string" ? { containerId: raw.containerId } : {}),
      ...(boundedProperties(raw.properties) ? { properties: boundedProperties(raw.properties) } : {}),
    };
    const metadata: NodeMetadata = { id, kind, name: name.slice(0, 2_000), ...(parentId ? { parentId } : {}), fields, workspace: nodeList.length === 0 ? workspaceFields : {} };
    const key = `structurizr-workspace:${id}`;
    nodeBySourceId.set(id, { key, kind });
    nodeList.push({ key, title: name, kind: `C4 ${kind}`, detail: nodeDisplayDetail(`C4 ${kind}`, fields), componentRole: metadataRole("structurizr-workspace-node|", metadata), liveKey: id });
    if (Array.isArray(raw.relationships)) for (const relationship of records(raw.relationships)) pendingRelationships.push({ sourceId: id, relationship });
    return id;
  };

  for (const person of records(model.people)) addNode(person, "person");
  for (const system of records(model.softwareSystems)) {
    const systemId = addNode(system, "softwareSystem");
    for (const container of records(system.containers)) {
      const containerId = addNode(container, "container", systemId);
      for (const component of records(container.components)) addNode(component, "component", containerId);
    }
  }
  const addDeployment = (raw: JsonObject, parentId?: string) => {
    const id = addNode(raw, "deploymentNode", parentId);
    for (const infrastructure of records(raw.infrastructureNodes)) addNode(infrastructure, "infrastructureNode", id);
    for (const instance of records(raw.softwareSystemInstances)) addNode(instance, "softwareSystemInstance", id);
    for (const instance of records(raw.containerInstances)) addNode(instance, "containerInstance", id);
    for (const child of records(raw.children)) addDeployment(child, id);
  };
  for (const deploymentNode of records(model.deploymentNodes)) addDeployment(deploymentNode);
  if (!nodeList.length) throw new Error("The Structurizr workspace has no supported people, systems, containers, components, or deployment nodes.");

  const nodeIds = new Set(nodeBySourceId.keys());
  for (const [index, item] of pendingRelationships.entries()) {
    const raw = item.relationship;
    const sourceId = text(raw.sourceId).trim() || item.sourceId;
    const destinationId = text(raw.destinationId).trim();
    if (!nodeIds.has(sourceId) || !nodeIds.has(destinationId)) throw new Error(`Structurizr relationship ${text(raw.id) || index + 1} refers to a missing source or destination element.`);
    const id = text(raw.id).trim() || `structurizr-relationship-${index + 1}`;
    if (relationshipIds.has(id) || elementIds.has(id)) throw new Error(`Structurizr workspace contains duplicate ID "${id}".`);
    relationshipIds.add(id);
    if (relationshipList.length >= MAX_RELATIONSHIPS) throw new Error(`Structurizr workspace imports are limited to ${MAX_RELATIONSHIPS} relationships.`);
    const fields: JsonObject = {
      ...(typeof raw.description === "string" ? { description: raw.description.slice(0, 2_000) } : {}),
      ...(typeof raw.tags === "string" ? { tags: tagList(raw.tags) ?? "" } : {}),
      ...(typeof raw.url === "string" ? { url: raw.url.slice(0, 2_000) } : {}),
      ...(typeof raw.technology === "string" ? { technology: raw.technology.slice(0, 240) } : {}),
      ...(typeof raw.interactionStyle === "string" ? { interactionStyle: raw.interactionStyle } : {}),
      ...(typeof raw.linkedRelationshipId === "string" ? { linkedRelationshipId: raw.linkedRelationshipId } : {}),
      ...(boundedProperties(raw.properties) ? { properties: boundedProperties(raw.properties) } : {}),
    };
    const metadata: RelationshipMetadata = { id, sourceId, destinationId, fields };
    relationshipList.push({ from: nodeBySourceId.get(sourceId)!.key, to: nodeBySourceId.get(destinationId)!.key, label: text(raw.description), componentRole: metadataRole("structurizr-workspace-edge|", metadata), liveKey: `${sourceId} ${destinationId}` });
  }

  const elements = buildStructuredDiagram(nodeList, relationshipList, "structurizr-workspace");
  // The generated layout is deliberately portable and editable. Source view
  // coordinates, themes, documentation, and view-specific styling are not
  // needed to preserve the workspace model itself.
  return elements;
}

function flatten(elements: Element[]): Element[] {
  return elements.flatMap(item => item.hidden ? [] : item.type === "group" ? flatten(item.elements) : [item]);
}

function readNode(item: Element): NodeMetadata | undefined {
  if (item.type === "group" || !item.componentRole?.startsWith("structurizr-workspace-node|") || !("label" in item)) return undefined;
  const value = metadataFromRole(item.componentRole, "structurizr-workspace-node|") as unknown as NodeMetadata | undefined;
  if (!value || typeof value.id !== "string" || !value.fields || !value.workspace) return undefined;
  const label = item.label?.text.split("\n")[0]?.trim();
  if (label && label !== value.name.slice(0, 120)) value.name = label;
  return value;
}

function readRelationship(item: Element): RelationshipMetadata | undefined {
  if ((item.type !== "line" && item.type !== "arrow") || !item.componentRole?.startsWith("structurizr-workspace-edge|")) return undefined;
  const value = metadataFromRole(item.componentRole, "structurizr-workspace-edge|") as unknown as RelationshipMetadata | undefined;
  if (!value || typeof value.id !== "string" || typeof value.sourceId !== "string" || typeof value.destinationId !== "string") return undefined;
  const label = item.label?.text.trim();
  if (label !== undefined && label !== text(value.fields.description)) value.fields.description = label;
  return value;
}

function objectWithFields(metadata: NodeMetadata, currentName: string): JsonObject {
  return { ...metadata.fields, id: metadata.id, name: currentName || metadata.name };
}

function viewElement(item: Element) {
  if (item.type === "group" || !item.id || !("x" in item) || !("y" in item)) return undefined;
  return { id: item.liveKey ?? item.id, x: Math.round(item.x), y: Math.round(item.y) };
}

function labelText(item: Element): string {
  return "label" in item && item.label ? item.label.text : "";
}

/** Export the supported Structurizr model as a workspace JSON document with a generated view set. */
export function exportStructurizrWorkspaceJson(elements: Element[]): string {
  const items = flatten(elements);
  const nodes = items.flatMap(item => { const metadata = readNode(item); return metadata ? [{ item, metadata }] : []; });
  if (!nodes.length) throw new Error("Select or import a Structurizr workspace diagram with supported model elements first.");
  if (nodes.length > MAX_ELEMENTS) throw new Error(`Structurizr workspace exports are limited to ${MAX_ELEMENTS} model elements.`);
  const relationships = items.flatMap(item => { const metadata = readRelationship(item); return metadata ? [{ item, metadata }] : []; });
  if (relationships.length > MAX_RELATIONSHIPS) throw new Error(`Structurizr workspace exports are limited to ${MAX_RELATIONSHIPS} relationships.`);

  const nodesById = new Map(nodes.map(entry => [entry.metadata.id, entry]));
  const relationshipsBySource = new Map<string, JsonObject[]>();
  for (const { item, metadata } of relationships) {
    if (!nodesById.has(metadata.sourceId) || !nodesById.has(metadata.destinationId)) continue;
    const relation: JsonObject = { ...metadata.fields, id: metadata.id, sourceId: metadata.sourceId, destinationId: metadata.destinationId, description: labelText(item).trim() || text(metadata.fields.description) };
    const list = relationshipsBySource.get(metadata.sourceId) ?? [];
    list.push(relation); relationshipsBySource.set(metadata.sourceId, list);
  }

  const model: JsonObject = { people: [], softwareSystems: [], deploymentNodes: [] };
  const personList = model.people as JsonObject[];
  const systemList = model.softwareSystems as JsonObject[];
  const deploymentList = model.deploymentNodes as JsonObject[];
  const containerById = new Map<string, JsonObject>();
  const deploymentById = new Map<string, JsonObject>();
  const workspace = nodes[0].metadata.workspace;
  if (workspace.enterprise) model.enterprise = workspace.enterprise;
  if (workspace.properties) model.properties = workspace.properties;

  for (const { item, metadata } of nodes) {
    const node = objectWithFields(metadata, labelText(item).split("\n")[0]?.trim() ?? metadata.name);
    const outgoing = relationshipsBySource.get(metadata.id);
    if (outgoing?.length) node.relationships = outgoing;
    const parent = metadata.parentId ? nodesById.get(metadata.parentId)?.metadata : undefined;
    switch (metadata.kind) {
      case "person": personList.push(node); break;
      case "softwareSystem": node.containers = []; systemList.push(node); break;
      case "container": {
        const owner = parent ? nodesById.get(parent.id)?.metadata : undefined;
        const ownerNode = owner ? nodesById.get(owner.id) : undefined;
        const target = ownerNode ? systemList.find(entry => entry.id === ownerNode.metadata.id) : undefined;
        if (!target) continue;
        const children = target.containers as JsonObject[]; children.push(node); containerById.set(metadata.id, node);
        node.components = [];
        break;
      }
      case "component": {
        const owner = parent ? containerById.get(parent.id) : undefined;
        if (!owner) continue;
        (owner.components as JsonObject[]).push(node); break;
      }
      case "deploymentNode": {
        const owner = parent ? deploymentById.get(parent.id) : undefined;
        node.children = []; node.infrastructureNodes = []; node.softwareSystemInstances = []; node.containerInstances = [];
        if (owner) (owner.children as JsonObject[]).push(node); else deploymentList.push(node);
        deploymentById.set(metadata.id, node); break;
      }
      case "infrastructureNode": {
        const owner = parent ? deploymentById.get(parent.id) : undefined;
        if (owner) (owner.infrastructureNodes as JsonObject[]).push(node); break;
      }
      case "softwareSystemInstance": {
        const owner = parent ? deploymentById.get(parent.id) : undefined;
        if (owner) (owner.softwareSystemInstances as JsonObject[]).push(node); break;
      }
      case "containerInstance": {
        const owner = parent ? deploymentById.get(parent.id) : undefined;
        if (owner) (owner.containerInstances as JsonObject[]).push(node); break;
      }
    }
  }

  const allNodes = nodes.flatMap(({ item, metadata }) => viewElement(item) && (metadata.kind === "person" || metadata.kind === "softwareSystem") ? [viewElement(item)!] : []);
  const allNodeIds = new Set(allNodes.map(item => item.id));
  const landscapeRelationships = relationships.flatMap(({ metadata }) => allNodeIds.has(metadata.sourceId) && allNodeIds.has(metadata.destinationId) ? [{ id: metadata.id }] : []);
  const views = allNodes.length ? { systemLandscapeViews: [{ key: "sketchdraw-system-landscape", description: "Generated from the editable SketchDraw workspace model.", elements: allNodes, relationships: landscapeRelationships }] } : {};
  const output: JsonObject = {
    ...(typeof workspace.id === "number" ? { id: workspace.id } : { id: 1 }),
    name: workspace.name || "SketchDraw workspace",
    ...(workspace.description ? { description: workspace.description } : {}),
    ...(workspace.version ? { version: workspace.version } : {}),
    model,
    views,
  };
  return JSON.stringify(output, null, 2) + "\n";
}

