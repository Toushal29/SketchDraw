import type { Element, GroupElement, LibraryComponentFieldValue, ShapeElement } from "../../model";
import { buildLibraryComponent, LIBRARY_COMPONENTS, type LibraryComponentKind } from "../components/library-components";

type XmlContent = { text: string } | { node: XmlNode };
type XmlNode = { name: string; attributes: Record<string, string>; children: XmlNode[]; content: XmlContent[]; text: string; namespaceContext: Record<string, string> };
type BpmnEventDefinition = { kind: string; id?: string; referenceName?: string; referenceValue?: string; referenceKey?: string; expressionName?: string; expression?: string; attributes?: Record<string, string>; extensionXml?: string };
type BpmnDefinitionReference = { id: string; type: string; xml: string; processId?: string; parentSubprocessId?: string };
type BpmnLaneSetMetadata = { id: string; attributes: Record<string, string>; extensionXml?: string; parentLaneId?: string };
type BpmnProcessMetadata = { id: string; attributes: Record<string, string>; namespaces: Record<string, string>; extensionXml?: string; otherXml?: string[]; laneSets?: BpmnLaneSetMetadata[] };
type BpmnCollaborationMetadata = { id: string; attributes: Record<string, string>; namespaces: Record<string, string>; extensionXml?: string; otherXml?: string[] };
type BpmnDocumentMetadata = { attributes: Record<string, string>; namespaces: Record<string, string>; definitionsChildren: string[]; processes: BpmnProcessMetadata[]; collaborations: BpmnCollaborationMetadata[]; diagramAttributes?: Record<string, string>; planeAttributes?: Record<string, string>; additionalPlanesXml?: string[]; additionalDiagramsXml?: string[]; otherPlaneXml?: string[] };
type BpmnNodeMetadata = {
  version: 1;
  type: string;
  sourceId: string;
  processId?: string;
  process?: BpmnProcessMetadata;
  collaborationId?: string;
  document?: BpmnDocumentMetadata;
  parentSubprocessId?: string;
  laneIds?: string[];
  flowNodeRefs?: string[];
  laneSetId?: string;
  parentLaneId?: string;
  processRef?: string;
  processExecutable?: boolean;
  attributes?: Record<string, string>;
  eventDefinitions?: BpmnEventDefinition[];
  referenceDefinitions?: BpmnDefinitionReference[];
  di?: Record<string, string>;
  diChildren?: string[];
  extensionXml?: string;
  otherXml?: string[];
  namespaces?: Record<string, string>;
};
type BpmnEdgeMetadata = { version: 1; type: string; sourceId: string; processId?: string; process?: BpmnProcessMetadata; collaborationId?: string; parentSubprocessId?: string; associationDirection?: string; sourceRefs?: string[]; targetRefs?: string[]; attributes?: Record<string, string>; referenceDefinitions?: BpmnDefinitionReference[]; extensionXml?: string; otherXml?: string[]; di?: Record<string, string>; diChildren?: string[]; namespaces?: Record<string, string> };
type ShapeRecord = { sourceId: string; type: string; processId?: string; parentSubprocessId?: string; element: GroupElement; bounds: { x: number; y: number; w: number; h: number }; metadata: BpmnNodeMetadata };
type EdgeRecord = { sourceId: string; type: string; processId?: string; parentSubprocessId?: string; collaborationId?: string; node: XmlNode };
export type BpmnCompatibilityReport = { kept: number; simplified: number; skipped: number; details: string[] };
export type BpmnImportResult = { elements: Element[]; report: BpmnCompatibilityReport };

function entityDecode(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower === "amp") return "&"; if (lower === "lt") return "<"; if (lower === "gt") return ">"; if (lower === "quot") return "\""; if (lower === "apos") return "'";
    const numeric = lower.startsWith("#x") ? Number.parseInt(lower.slice(2), 16) : Number.parseInt(lower.slice(1), 10);
    return Number.isFinite(numeric) && numeric > 0 && numeric <= 0x10ffff ? String.fromCodePoint(numeric) : "�";
  });
}

function scanTag(source: string, start: number): { raw: string; end: number } {
  let quote = "";
  for (let index = start + 1; index < source.length; index++) {
    const char = source[index];
    if (quote) { if (char === quote) quote = ""; }
    else if (char === "\"" || char === "'") quote = char;
    else if (char === ">") return { raw: source.slice(start + 1, index), end: index + 1 };
  }
  throw new Error("BPMN XML contains an unfinished tag.");
}

function parseXml(source: string): XmlNode {
  if (source.length > 5_000_000) throw new Error("BPMN XML input is limited to 5 MB.");
  const document: XmlNode = { name: "#document", attributes: {}, children: [], content: [], text: "", namespaceContext: {} };
  const stack = [document];
  for (let index = 0; index < source.length;) {
    const open = source.indexOf("<", index);
    if (open < 0) { const text = entityDecode(source.slice(index)); stack[stack.length - 1].text += text; if (text) stack[stack.length - 1].content.push({ text }); break; }
    if (open > index) { const text = entityDecode(source.slice(index, open)); stack[stack.length - 1].text += text; if (text) stack[stack.length - 1].content.push({ text }); }
    if (source.startsWith("<!--", open)) { const close = source.indexOf("-->", open + 4); if (close < 0) throw new Error("BPMN XML contains an unfinished comment."); index = close + 3; continue; }
    if (source.startsWith("<![CDATA[", open)) { const close = source.indexOf("]]>", open + 9); if (close < 0) throw new Error("BPMN XML contains an unfinished CDATA block."); const text = source.slice(open + 9, close); stack[stack.length - 1].text += text; if (text) stack[stack.length - 1].content.push({ text }); index = close + 3; continue; }
    if (/^<!DOCTYPE\b/i.test(source.slice(open, open + 12))) throw new Error("BPMN XML with a DOCTYPE declaration is not supported.");
    if (source.startsWith("<?", open)) { const close = source.indexOf("?>", open + 2); if (close < 0) throw new Error("BPMN XML contains an unfinished processing instruction."); index = close + 2; continue; }
    const token = scanTag(source, open); index = token.end;
    const raw = token.raw.trim();
    if (raw.startsWith("!")) continue;
    if (raw.startsWith("/")) {
      const name = raw.slice(1).trim(); const current = stack.pop();
      if (!current || current === document || current.name !== name) throw new Error(`BPMN XML closing tag does not match ${current?.name ?? "the document"}.`);
      continue;
    }
    const selfClosing = raw.endsWith("/"); const body = selfClosing ? raw.slice(0, -1).trim() : raw;
    const nameEnd = body.search(/[\s/]/); const name = nameEnd < 0 ? body : body.slice(0, nameEnd);
    if (!name || !/^[A-Za-z_][\w.:-]*$/.test(name)) throw new Error("BPMN XML contains an invalid element name.");
    const attributes: Record<string, string> = {}; const attributeSource = body.slice(name.length); let cursor = 0;
    while (cursor < attributeSource.length) {
      while (/\s|\//.test(attributeSource[cursor] ?? "")) cursor++;
      if (cursor >= attributeSource.length) break;
      const keyStart = cursor; while (/[A-Za-z0-9_.:-]/.test(attributeSource[cursor] ?? "")) cursor++;
      const key = attributeSource.slice(keyStart, cursor); while (/\s/.test(attributeSource[cursor] ?? "")) cursor++;
      if (!key || attributeSource[cursor++] !== "=") throw new Error("BPMN XML contains a malformed attribute.");
      while (/\s/.test(attributeSource[cursor] ?? "")) cursor++;
      const quote = attributeSource[cursor++];
      if (quote !== "\"" && quote !== "'") throw new Error("BPMN XML attributes must be quoted.");
      const valueStart = cursor; while (cursor < attributeSource.length && attributeSource[cursor] !== quote) cursor++;
      if (cursor >= attributeSource.length) throw new Error("BPMN XML contains an unterminated attribute value.");
      attributes[key] = entityDecode(attributeSource.slice(valueStart, cursor)); cursor++;
    }
    const parent = stack[stack.length - 1]; const namespaceContext = { ...parent.namespaceContext };
    for (const [key, value] of Object.entries(attributes)) if (key === "xmlns") namespaceContext[""] = value; else if (key.startsWith("xmlns:")) namespaceContext[key.slice(6)] = value;
    const node: XmlNode = { name, attributes, children: [], content: [], text: "", namespaceContext };
    parent.children.push(node); parent.content.push({ node });
    if (!selfClosing) { if (stack.length >= 128) throw new Error("BPMN XML nesting exceeds 128 levels."); stack.push(node); }
  }
  if (stack.length !== 1) throw new Error(`BPMN XML element ${stack[stack.length - 1]?.name ?? "unknown"} is not closed.`);
  if (document.children.length !== 1) throw new Error("BPMN XML needs exactly one root element.");
  return document.children[0];
}

const localName = (node: XmlNode) => node.name.split(":").pop()!.toLowerCase();
const tagName = (node: XmlNode) => node.name.split(":").pop()!;
function walk(node: XmlNode, visit: (candidate: XmlNode) => void) { visit(node); for (const child of node.children) walk(child, visit); }
const allDescendants = (node: XmlNode) => { const output: XmlNode[] = []; walk(node, item => output.push(item)); return output; };
const descendants = (node: XmlNode, name: string) => { const output: XmlNode[] = []; walk(node, item => { if (localName(item) === name.toLowerCase()) output.push(item); }); return output; };
const direct = (node: XmlNode, name: string) => node.children.filter(item => localName(item) === name.toLowerCase());
const attr = (node: XmlNode, name: string) => node.attributes[name] ?? node.attributes[`bpmn:${name}`] ?? "";
const attrByLocalName = (node: XmlNode, name: string) => Object.entries(node.attributes).find(([key]) => key.toLowerCase() === name.toLowerCase() || key.toLowerCase().endsWith(`:${name.toLowerCase()}`))?.[1] ?? "";
const textChild = (node: XmlNode, name: string) => direct(node, name)[0]?.text.trim() ?? "";
const safeId = (value: string, fallback: string) => { const result = value.replace(/[^A-Za-z0-9_.-]/g, "_").replace(/^[^A-Za-z_]+/, "").slice(0, 96); return result || fallback; };
const encode = (value: unknown) => encodeURIComponent(JSON.stringify(value));
const decode = <T,>(value: string): T | undefined => { try { return JSON.parse(decodeURIComponent(value)) as T; } catch { return undefined; } };
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
const number = (value: string | undefined, fallback: number) => { const parsed = Number(value); return Number.isFinite(parsed) && Math.abs(parsed) <= 1_000_000 ? parsed : fallback; };
const finiteXmlNumber = (value: number) => Number.isFinite(value) ? Number(value.toFixed(3)) : 0;

const BPMN_NODES = new Set([
  "startEvent", "intermediateCatchEvent", "intermediateThrowEvent", "endEvent", "boundaryEvent",
  "task", "userTask", "serviceTask", "scriptTask", "manualTask", "businessRuleTask", "sendTask", "receiveTask", "callActivity", "subProcess", "transaction", "adHocSubProcess", "eventSubProcess",
  "exclusiveGateway", "eventBasedGateway", "inclusiveGateway", "parallelGateway", "complexGateway",
  "dataObjectReference", "dataStoreReference", "textAnnotation", "participant", "lane", "group",
  "choreographyTask", "subChoreography", "callChoreography", "conversation", "callConversation", "conversationNode", "subConversation",
  "dataInput", "dataOutput",
]);
const BPMN_EDGES = new Set(["sequenceFlow", "messageFlow", "association", "dataInputAssociation", "dataOutputAssociation", "conversationLink"]);
const BPMN_EVENT_MARKERS: Record<string, LibraryComponentKind> = {
  messageEventDefinition: "bpmn-message-event", timerEventDefinition: "bpmn-timer-event", errorEventDefinition: "bpmn-error-event",
  signalEventDefinition: "bpmn-signal-event", terminateEventDefinition: "bpmn-terminate-event",
  conditionalEventDefinition: "proposal-decision-conditional-event", escalationEventDefinition: "proposal-decision-escalation-event",
  compensationEventDefinition: "proposal-decision-compensation-event", linkEventDefinition: "proposal-decision-link-event",
  multipleEventDefinition: "proposal-decision-multiple-event", parallelMultipleEventDefinition: "proposal-decision-parallel-multiple-event",
  cancelEventDefinition: "proposal-decision-cancel-event",
};

function componentKind(type: string, eventDefinitions: BpmnEventDefinition[]): LibraryComponentKind {
  const eventKind = eventDefinitions[0]?.kind;
  if (type === "boundaryEvent") return "bpmn-boundary-event";
  if (eventKind && BPMN_EVENT_MARKERS[eventKind]) return BPMN_EVENT_MARKERS[eventKind];
  const kinds: Record<string, LibraryComponentKind> = {
    startEvent: "bpmn-start", intermediateCatchEvent: "bpmn-event", intermediateThrowEvent: "bpmn-event", endEvent: "bpmn-end",
    task: "bpmn-task", userTask: "bpmn-user-task", serviceTask: "bpmn-service-task", scriptTask: "bpmn-script-task", manualTask: "bpmn-manual-task",
    businessRuleTask: "bpmn-business-rule-task", sendTask: "bpmn-send-task", receiveTask: "bpmn-receive-task", callActivity: "bpmn-call-activity",
    subProcess: "bpmn-subprocess", transaction: "proposal-decision-transaction-subprocess", adHocSubProcess: "proposal-decision-ad-hoc-subprocess", eventSubProcess: "proposal-decision-event-subprocess",
    exclusiveGateway: "bpmn-gateway", complexGateway: "bpmn-gateway", eventBasedGateway: "bpmn-event-gateway", inclusiveGateway: "bpmn-inclusive-gateway", parallelGateway: "bpmn-parallel-gateway",
    dataObjectReference: "bpmn-data", dataInput: "proposal-decision-data-input", dataOutput: "proposal-decision-data-output", dataStoreReference: "bpmn-data-store",
    textAnnotation: "bpmn-text-annotation", participant: "bpmn-pool", lane: "proposal-systems-activity-partition", group: "bpmn-group",
    choreographyTask: "proposal-decision-choreography-task", subChoreography: "proposal-decision-choreography-task", callChoreography: "proposal-decision-call-choreography",
    conversation: "proposal-decision-conversation-node", conversationNode: "proposal-decision-conversation-node", callConversation: "proposal-decision-conversation-node", subConversation: "proposal-decision-conversation-node",
  };
  const candidate = kinds[type] ?? "bpmn-task";
  return LIBRARY_COMPONENTS.some(item => item.kind === candidate) ? candidate : "bpmn-task";
}

function eventDefinitions(node: XmlNode, definitionNames: Map<string, string>): BpmnEventDefinition[] {
  return node.children.filter(child => /EventDefinition$/.test(tagName(child))).map(child => {
    const definition = { kind: tagName(child), attributes: semanticAttributes(child), extensionXml: extensionXml(child) } as BpmnEventDefinition;
    const id = attr(child, "id"); if (id) definition.id = id;
    const referenceKey = ["messageRef", "signalRef", "errorRef", "escalationRef", "operationRef", "itemRef"].find(key => attr(child, key));
    if (referenceKey) {
      const ref = attr(child, referenceKey); definition.referenceName = definitionNames.get(ref) ?? ref;
      definition.referenceValue = ref; definition.referenceKey = referenceKey;
    }
    const expression = child.children.find(item => ["timedate", "timeduration", "timecycle", "condition"].includes(localName(item)));
    if (expression) { definition.expressionName = tagName(expression); definition.expression = expression.text.trim(); }
    return definition;
  });
}

const SAFE_NODE_ATTRIBUTES = new Set([
  "gatewayDirection", "default", "attachedToRef", "cancelActivity", "isInterrupting", "triggeredByEvent", "calledElement", "implementation", "operationRef", "scriptFormat", "isForCompensation", "instantiate", "isClosed", "processRef", "associationDirection", "itemSubjectRef", "dataStoreRef", "isCollection", "isRequired", "isExecutable", "isExpanded", "isHorizontal", "isMarkerVisible", "participantBandKind", "messageRef", "signalRef", "errorRef", "escalationRef", "loopCharacteristics", "completionCondition",
]);
function semanticAttributes(node: XmlNode): Record<string, string> {
  return Object.fromEntries(Object.entries(node.attributes).filter(([key]) => {
    const name = key.split(":").pop()!;
    return name !== "xmlns" && !key.startsWith("xmlns:") && name !== "id" && name !== "name" || SAFE_NODE_ATTRIBUTES.has(name);
  }));
}

function rawAttributes(node: XmlNode): Record<string, string> {
  return Object.fromEntries(Object.entries(node.attributes).filter(([key]) => key !== "xmlns" && !key.startsWith("xmlns:")));
}

function otherChildXml(node: XmlNode, excluded: ReadonlySet<string>): string[] | undefined {
  const values = node.children.filter(child => !excluded.has(localName(child))).map(child => serializeXmlNode(child, true));
  return values.length ? values : undefined;
}

function serializeXmlNode(node: XmlNode, preserveInheritedNamespaces = false): string {
  const attributes = { ...node.attributes };
  if (preserveInheritedNamespaces) for (const [prefix, uri] of Object.entries(node.namespaceContext)) {
    const key = prefix ? `xmlns:${prefix}` : "xmlns";
    if (attributes[key] === undefined) attributes[key] = uri;
  }
  const attrs = Object.entries(attributes).map(([key, value]) => ` ${key}="${escapeXml(value)}"`).join("");
  const content = node.content.map(part => "text" in part ? escapeXml(part.text) : serializeXmlNode(part.node)).join("");
  return content ? `<${node.name}${attrs}>${content}</${node.name}>` : `<${node.name}${attrs}/>`;
}

function extensionXml(node: XmlNode): string | undefined {
  const extensions = direct(node, "extensionElements")[0];
  return extensions ? serializeXmlNode(extensions, true) : undefined;
}

function diAttributes(node: XmlNode | undefined): Record<string, string> | undefined {
  if (!node) return undefined;
  return Object.fromEntries(Object.entries(node.attributes).filter(([key]) => !["id", "bpmnElement"].includes(key.split(":").pop()!) && key !== "xmlns" && !key.startsWith("xmlns:")));
}

function diChildren(node: XmlNode | undefined, geometryName: "bounds" | "waypoint"): string[] | undefined {
  if (!node) return undefined;
  const values = node.children.filter(child => localName(child) !== geometryName).map(child => serializeXmlNode(child, true));
  return values.length ? values : undefined;
}

const BPMN_REFERENCE_DEFINITIONS = new Set(["message", "signal", "error", "escalation", "itemDefinition", "dataObject", "dataStore", "resource", "interface", "operation", "correlationProperty", "correlationKey", "category"]);
function referenceDefinitionsFor(attributes: Record<string, string>, eventDefinitions: BpmnEventDefinition[], definitions: Map<string, XmlNode>, scopes: Map<string, { processId: string; parentSubprocessId?: string }>, processId: string, parentSubprocessId?: string): BpmnDefinitionReference[] | undefined {
  const ids = new Set(Object.entries(attributes).filter(([key]) => key.split(":").pop()!.endsWith("Ref")).flatMap(([, value]) => value.split(/\s+/).filter(Boolean)));
  for (const event of eventDefinitions) if (event.referenceValue) ids.add(event.referenceValue);
  const references = [...ids].flatMap(id => {
    const node = definitions.get(id); if (!node || !BPMN_REFERENCE_DEFINITIONS.has(tagName(node))) return [];
    const scope = scopes.get(id);
    return [{ id, type: tagName(node), xml: serializeXmlNode(node, true), ...(scope ?? (processId ? { processId, ...(parentSubprocessId ? { parentSubprocessId } : {}) } : {})) }];
  });
  return references.length ? references : undefined;
}

function componentFields(kind: LibraryComponentKind, values: Record<string, string>): LibraryComponentFieldValue[] | undefined {
  const current = buildLibraryComponent(kind, 0, 0).libraryComponent?.componentFields;
  if (!current?.length) return undefined;
  return current.map(field => values[field.key] === undefined ? field : { ...field, value: values[field.key] });
}

function componentFieldValues(type: string, node: XmlNode, definitions: BpmnEventDefinition[], definitionNames: Map<string, string>): Record<string, string> {
  const event = definitions[0]; const eventKind = event?.kind.replace(/EventDefinition$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase() ?? "none";
  const messageRef = attr(node, "messageRef"); const signalRef = attr(node, "signalRef"); const errorRef = attr(node, "errorRef");
  const attachedToRef = attr(node, "attachedToRef"); const isInterrupting = attr(node, "cancelActivity") || attr(node, "isInterrupting");
  const script = textChild(node, "script"); const scriptFormat = attr(node, "scriptFormat");
  const timer = event?.expression ?? ""; const timerKind = event?.expressionName?.replace(/^time/i, "").toLowerCase() ?? "";
  const dataState = descendants(node, "dataState")[0]?.text.trim() ?? "";
  const gateway = attr(node, "gatewayDirection");
  const values: Record<string, string> = {
    activity: attr(node, "name") || type, trigger: eventKind === "none" ? "None" : eventKind, "trigger-reference": event?.referenceName ?? event?.expression ?? "",
    "message-name": event?.kind === "messageEventDefinition" ? event.referenceName ?? (messageRef ? definitionNames.get(messageRef) ?? messageRef : "") : "",
    direction: /Throw|endEvent/.test(type) ? "Throw" : "Catch", correlation: "",
    "timer-kind": timerKind, "timer-expression": timer,
    "error-code": event?.referenceName ?? (errorRef ? definitionNames.get(errorRef) ?? errorRef : ""), "error-name": event?.referenceName ?? "",
    "catching-scope": attachedToRef, signal: event?.referenceName ?? (signalRef ? definitionNames.get(signalRef) ?? signalRef : ""), scope: attr(node, "processRef"),
    "event-kind": eventKind, "event-definition": event?.referenceName ?? event?.expression ?? eventKind,
    "attached-activity": attachedToRef, interrupting: isInterrupting ? String(isInterrupting !== "false") : "",
    "gateway-type": type.replace(/Gateway$/, ""), "default-flow": attr(node, "default"), "called-process": attr(node, "calledElement"),
    "process-reference": attr(node, "processRef"), participant: attr(node, "name") || "", "data-object": attr(node, "name") || "", state: dataState,
    format: attr(node, "itemSubjectRef"), store: definitionNames.get(attr(node, "dataStoreRef")) ?? attr(node, "dataStoreRef"),
    "script-language": scriptFormat, script, "decision-table": attr(node, "implementation"), decision: attr(node, "operationRef"),
    operation: definitionNames.get(attr(node, "operationRef")) ?? attr(node, "operationRef"), "implementation": attr(node, "implementation"),
    "purpose": attr(node, "name") || type,
    "completion-condition": textChild(node, "completionCondition"), completion: textChild(node, "completionCondition"),
  };
  for (const [key, value] of Object.entries(values)) if (value === undefined) delete values[key];
  if (gateway) values["trigger-rule"] = gateway;
  return values;
}

function edgeReferences(node: XmlNode, key: "sourceRef" | "targetRef"): string[] {
  const values = direct(node, key).map(item => item.text.trim()).filter(Boolean);
  const attribute = attr(node, key);
  return values.length ? values : attribute.split(/\s+/).filter(Boolean);
}

function bpmnNodeMetadata(role: string | undefined): BpmnNodeMetadata | undefined {
  if (!role?.startsWith("bpmn-node|")) return undefined;
  const parts = role.split("|");
  if (parts.length === 3) {
    let sourceId = parts[2]; try { sourceId = decodeURIComponent(sourceId); } catch { /* legacy data is kept as-is */ }
    return { version: 1, type: parts[1], sourceId };
  }
  return decode<BpmnNodeMetadata>(parts.slice(1).join("|"));
}

function bpmnEdgeMetadata(role: string | undefined): BpmnEdgeMetadata | undefined {
  if (!role?.startsWith("bpmn-edge|")) return undefined;
  const parts = role.split("|");
  if (parts.length === 3) {
    let sourceId = parts[2]; try { sourceId = decodeURIComponent(sourceId); } catch { /* legacy data is kept as-is */ }
    return { version: 1, type: parts[1], sourceId };
  }
  return decode<BpmnEdgeMetadata>(parts.slice(1).join("|"));
}

function diagramGeometry(node: Element): { x: number; y: number; w: number; h: number } | undefined {
  if (node.type === "group") return node.componentBounds;
  if (node.type === "schemaTable" || node.type === "image" || node.type === "rectangle" || node.type === "circle" || node.type === "diamond" || node.type === "triangle" || node.type === "flowchart" || node.type === "svgPath") return { x: node.x, y: node.y, w: node.w, h: node.h };
  return undefined;
}

function nodeLabel(node: Element) {
  if (node.type === "group") return node.libraryComponent?.label ?? "";
  return node.type === "schemaTable" ? node.name : node.type === "text" ? node.text : node.type === "rectangle" || node.type === "circle" || node.type === "diamond" || node.type === "triangle" || node.type === "flowchart" || node.type === "line" || node.type === "arrow" || node.type === "svgPath" ? node.label?.text ?? "" : "";
}

/** Import BPMN process, collaboration, lane, event, task, gateway, data, and DI geometry with a compatibility report. */
export function importBpmnXmlWithReport(source: string): BpmnImportResult {
  const root = parseXml(source);
  if (localName(root) !== "definitions") throw new Error("BPMN XML must have a definitions root element.");
  const processes = descendants(root, "process");
  if (!processes.length) throw new Error("BPMN XML does not contain a process.");

  const definitions = new Map<string, string>(); const definitionNodes = new Map<string, XmlNode>(); const definitionScopes = new Map<string, { processId: string; parentSubprocessId?: string }>();
  for (const item of allDescendants(root)) {
    const id = attr(item, "id"); const name = attr(item, "name");
    if (id && name && !definitions.has(id)) definitions.set(id, name);
    if (id && BPMN_REFERENCE_DEFINITIONS.has(tagName(item)) && !definitionNodes.has(id)) definitionNodes.set(id, item);
  }
  const processesMetadata = new Map<string, BpmnProcessMetadata>(); const laneSetByLane = new Map<string, string>(); const parentLaneByLane = new Map<string, string>();
  for (const [processIndex, process] of processes.entries()) {
    const processId = attr(process, "id") || `Process_${processIndex + 1}`; const laneSets: BpmnLaneSetMetadata[] = [];
    const collectLaneSet = (laneSet: XmlNode, parentLaneId?: string) => {
      const laneSetId = attr(laneSet, "id") || `LaneSet_${processIndex + 1}_${laneSets.length + 1}`;
      laneSets.push({ id: laneSetId, attributes: rawAttributes(laneSet), ...(extensionXml(laneSet) ? { extensionXml: extensionXml(laneSet) } : {}), ...(parentLaneId ? { parentLaneId } : {}) });
      for (const lane of direct(laneSet, "lane")) {
        const laneId = attr(lane, "id"); if (laneId) { laneSetByLane.set(laneId, laneSetId); if (parentLaneId) parentLaneByLane.set(laneId, parentLaneId); }
        for (const childSet of direct(lane, "childLaneSet")) collectLaneSet(childSet, laneId || parentLaneId);
      }
    };
    for (const laneSet of direct(process, "laneSet")) collectLaneSet(laneSet);
    processesMetadata.set(processId, {
      id: processId, attributes: rawAttributes(process), namespaces: process.namespaceContext,
      ...(extensionXml(process) ? { extensionXml: extensionXml(process) } : {}),
      ...(laneSets.length ? { laneSets } : {}),
      ...(otherChildXml(process, new Set(["extensionelements", "laneset", "dataobject", ...[...BPMN_NODES, ...BPMN_EDGES].map(name => name.toLowerCase())])) ? { otherXml: otherChildXml(process, new Set(["extensionelements", "laneset", "dataobject", ...[...BPMN_NODES, ...BPMN_EDGES].map(name => name.toLowerCase())])) } : {}),
    });
  }
  const collaborationNodes = descendants(root, "collaboration");
  const collaborationMetadata: BpmnCollaborationMetadata[] = collaborationNodes.map((collaboration, index) => ({
    id: attr(collaboration, "id") || `Collaboration_${index + 1}`, attributes: rawAttributes(collaboration), namespaces: collaboration.namespaceContext,
    ...(extensionXml(collaboration) ? { extensionXml: extensionXml(collaboration) } : {}),
    ...(otherChildXml(collaboration, new Set(["extensionelements", ...[...BPMN_NODES, ...BPMN_EDGES].map(name => name.toLowerCase())])) ? { otherXml: otherChildXml(collaboration, new Set(["extensionelements", ...[...BPMN_NODES, ...BPMN_EDGES].map(name => name.toLowerCase())])) } : {}),
  }));
  const collaborationByNode = new Map<XmlNode, string>();
  collaborationNodes.forEach((collaboration, index) => {
    const collaborationId = collaborationMetadata[index].id;
    for (const node of allDescendants(collaboration)) if (node !== collaboration && (BPMN_NODES.has(tagName(node)) || BPMN_EDGES.has(tagName(node)))) collaborationByNode.set(node, collaborationId);
  });
  const semanticNodes: { node: XmlNode; type: string; sourceId: string; processId: string; parentSubprocessId?: string; collaborationId?: string; laneSetId?: string; parentLaneId?: string }[] = [];
  const ids = new Set<string>(); let generatedId = 0;
  const addSemanticNode = (node: XmlNode, processId: string, parentSubprocessId?: string) => {
    const type = tagName(node); if (!BPMN_NODES.has(type)) return;
    const sourceId = attr(node, "id") || `SketchDraw_${++generatedId}`;
    if (ids.has(sourceId)) return;
    ids.add(sourceId); semanticNodes.push({ node, type, sourceId, processId, ...(parentSubprocessId ? { parentSubprocessId } : {}), ...(collaborationByNode.get(node) ? { collaborationId: collaborationByNode.get(node) } : {}), ...(laneSetByLane.get(sourceId) ? { laneSetId: laneSetByLane.get(sourceId) } : {}), ...(parentLaneByLane.get(sourceId) ? { parentLaneId: parentLaneByLane.get(sourceId) } : {}) });
  };
  const walkProcess = (node: XmlNode, processId: string, parentSubprocessId?: string) => {
    for (const child of node.children) {
      const type = tagName(child); const isNode = BPMN_NODES.has(type); const id = attr(child, "id");
      if (type === "dataObject" && id) definitionScopes.set(id, { processId, ...(parentSubprocessId ? { parentSubprocessId } : {}) });
      if (isNode) addSemanticNode(child, processId, parentSubprocessId);
      const nestedParent = ["subProcess", "transaction", "adHocSubProcess", "eventSubProcess"].includes(type) ? id || parentSubprocessId : parentSubprocessId;
      walkProcess(child, processId, nestedParent);
    }
  };
  for (const [index, process] of processes.entries()) walkProcess(process, attr(process, "id") || `Process_${index + 1}`);
  for (const collaboration of collaborationNodes) for (const node of allDescendants(collaboration)) if (BPMN_NODES.has(tagName(node))) addSemanticNode(node, "");
  if (!semanticNodes.length) throw new Error("BPMN process contains no supported flow nodes.");
  if (semanticNodes.length > 500) throw new Error("BPMN diagrams are limited to 500 semantic nodes.");

  const diagrams = descendants(root, "bpmnDiagram"); const selectedDiagram = diagrams[0];
  const plane = selectedDiagram ? descendants(selectedDiagram, "bpmnPlane")[0] : undefined;
  const additionalPlanes = selectedDiagram ? direct(selectedDiagram, "bpmnPlane").slice(1) : [];
  const documentMetadata: BpmnDocumentMetadata = {
    attributes: rawAttributes(root), namespaces: root.namespaceContext,
    definitionsChildren: root.children.filter(child => !["process", "collaboration", "bpmndiagram"].includes(localName(child))).map(child => serializeXmlNode(child, true)),
    processes: [...processesMetadata.values()], collaborations: collaborationMetadata,
    ...(selectedDiagram ? { diagramAttributes: rawAttributes(selectedDiagram) } : {}),
    ...(plane ? { planeAttributes: rawAttributes(plane) } : {}),
    ...(additionalPlanes.length ? { additionalPlanesXml: additionalPlanes.map(item => serializeXmlNode(item, true)) } : {}),
    ...(diagrams.length > 1 ? { additionalDiagramsXml: diagrams.slice(1).map(item => serializeXmlNode(item, true)) } : {}),
    ...(plane ? (() => { const values = plane.children.filter(child => !["bpmnshape", "bpmnedge"].includes(localName(child))).map(child => serializeXmlNode(child, true)); return values.length ? { otherPlaneXml: values } : {}; })() : {}),
  };
  const diagramShapes = new Map<string, XmlNode>(); const diagramEdges = new Map<string, XmlNode>();
  for (const item of plane ? allDescendants(plane) : []) {
    if (localName(item) === "bpmnshape" && attr(item, "bpmnElement") && !diagramShapes.has(attr(item, "bpmnElement"))) diagramShapes.set(attr(item, "bpmnElement"), item);
    if (localName(item) === "bpmnedge" && attr(item, "bpmnElement") && !diagramEdges.has(attr(item, "bpmnElement"))) diagramEdges.set(attr(item, "bpmnElement"), item);
  }
  const laneByFlowNode = new Map<string, string[]>();
  for (const { node, type, sourceId } of semanticNodes) if (type === "lane") {
    for (const ref of descendants(node, "flowNodeRef").map(item => item.text.trim()).filter(Boolean)) laneByFlowNode.set(ref, [...(laneByFlowNode.get(ref) ?? []), sourceId]);
  }
  const columns = Math.max(1, Math.ceil(Math.sqrt(semanticNodes.length))); const records = new Map<string, ShapeRecord>();
  semanticNodes.forEach(({ node, type, sourceId, processId, parentSubprocessId, collaborationId, laneSetId, parentLaneId }, index) => {
    const label = attr(node, "name") || (type === "textAnnotation" ? textChild(node, "text") : "") || type.replace(/([a-z])([A-Z])/g, "$1 $2");
    const diShape = diagramShapes.get(sourceId); const bounds = diShape ? direct(diShape, "bounds")[0] : undefined;
    const laneBounds = /participant|lane/i.test(type);
    const defaultWidth = type === "participant" ? 400 : type === "lane" ? 360 : /event|gateway/i.test(type) ? 56 : /dataObject|dataStore|dataInput|dataOutput/i.test(type) ? 88 : 156;
    const defaultHeight = type === "participant" ? 220 : type === "lane" ? 150 : /event|gateway/i.test(type) ? 56 : /dataObject|dataStore|dataInput|dataOutput/i.test(type) ? 96 : 90;
    const x = number(bounds?.attributes.x, (index % columns) * 250); const y = number(bounds?.attributes.y, Math.floor(index / columns) * 150);
    const width = Math.max(laneBounds ? 180 : 44, number(bounds?.attributes.width, defaultWidth)); const height = Math.max(laneBounds ? 72 : 36, number(bounds?.attributes.height, defaultHeight));
    const eventInfo = eventDefinitions(node, definitions); const kind = componentKind(type, eventInfo);
    const group = buildLibraryComponent(kind, x, y);
    const nodeExtension = extensionXml(node); const nodeDiAttributes = diAttributes(diShape); const nodeDiChildren = diChildren(diShape, "bounds"); const nodeAttributes = semanticAttributes(node);
    const excludedNodeChildren = new Set(["extensionelements", "script", "flownoderef", "childlaneset", ...[...BPMN_NODES, ...BPMN_EDGES].map(name => name.toLowerCase()), "dataobject"]);
    for (const child of node.children) if (/EventDefinition$/.test(tagName(child))) excludedNodeChildren.add(localName(child));
    const nodeOtherXml = otherChildXml(node, excludedNodeChildren);
    const nodeReferenceDefinitions = referenceDefinitionsFor(nodeAttributes, eventInfo, definitionNodes, definitionScopes, processId, parentSubprocessId);
    const metadata: BpmnNodeMetadata = {
      version: 1, type, sourceId, ...(processId ? { processId } : {}), ...(collaborationId ? { collaborationId } : {}), ...(parentSubprocessId ? { parentSubprocessId } : {}),
      ...(laneSetId ? { laneSetId } : {}), ...(parentLaneId ? { parentLaneId } : {}),
      ...(laneByFlowNode.get(sourceId) ? { laneIds: laneByFlowNode.get(sourceId) } : {}),
      ...(type === "lane" ? { flowNodeRefs: direct(node, "flowNodeRef").map(item => item.text.trim()).filter(Boolean) } : {}),
      ...(type === "participant" && attr(node, "processRef") ? { processRef: attr(node, "processRef") } : {}),
      ...(processesMetadata.get(processId)?.attributes.isExecutable ? { processExecutable: processesMetadata.get(processId)!.attributes.isExecutable === "true" } : {}),
      attributes: nodeAttributes, ...(nodeReferenceDefinitions ? { referenceDefinitions: nodeReferenceDefinitions } : {}), namespaces: node.namespaceContext,
      ...(nodeExtension ? { extensionXml: nodeExtension } : {}),
      ...(nodeOtherXml ? { otherXml: nodeOtherXml } : {}),
      ...(eventInfo.length ? { eventDefinitions: eventInfo } : {}),
      ...(nodeDiAttributes ? { di: nodeDiAttributes } : {}), ...(nodeDiChildren ? { diChildren: nodeDiChildren } : {}),
    };
    const values = componentFieldValues(type, node, eventInfo, definitions);
    const componentAttributes = group.libraryComponent ?? { kind };
    const fields = componentFields(kind, values);
    group.id = `bpmn-node-${safeId(sourceId, String(index + 1))}`;
    group.componentRole = `bpmn-node|${encode(metadata)}`;
    group.componentBounds = { x, y, w: width, h: height };
    group.libraryComponent = {
      ...componentAttributes, label,
      ...(fields ? { componentFields: fields } : {}),
      ...(diShape && (attrByLocalName(diShape, "stroke") || attrByLocalName(diShape, "fill")) ? { styleOverrides: {
        ...(attrByLocalName(diShape, "stroke") ? { color: attrByLocalName(diShape, "stroke") } : {}),
        ...(attrByLocalName(diShape, "fill") ? { fillColor: attrByLocalName(diShape, "fill") } : {}),
      } } : {}),
    };
    const documentation = textChild(node, "documentation"); if (documentation) group.altText = documentation.slice(0, 1000);
    records.set(sourceId, { sourceId, type, processId, parentSubprocessId, element: group, bounds: { x, y, w: width, h: height }, metadata });
  });

  const edgeRecords: EdgeRecord[] = [];
  for (const process of processes) {
    const processId = attr(process, "id") || "Process_1";
    const addEdges = (container: XmlNode, parentSubprocessId?: string) => {
      for (const node of container.children) {
        const type = tagName(node); const id = attr(node, "id");
        if (BPMN_EDGES.has(type) && id) edgeRecords.push({ sourceId: id, type, processId, parentSubprocessId, node });
        if (["subProcess", "transaction", "adHocSubProcess", "eventSubProcess"].includes(type)) addEdges(node, id || parentSubprocessId);
        else if (!BPMN_EDGES.has(type)) addEdges(node, parentSubprocessId);
      }
    };
    addEdges(process);
  }
  for (const collaboration of collaborationNodes) {
    for (const node of allDescendants(collaboration)) if (BPMN_EDGES.has(tagName(node)) && attr(node, "id")) edgeRecords.push({ sourceId: attr(node, "id"), type: tagName(node), processId: "", collaborationId: collaborationByNode.get(node), node });
  }
  const edges: ShapeElement[] = [];
  const unrepresentedEdges: EdgeRecord[] = [];
  const unrepresentedEndpointIds = new Set<string>();
  let unrepresentedEdgePairs = 0;
  for (const edge of edgeRecords) {
    const sources = edgeReferences(edge.node, "sourceRef"); const targets = edgeReferences(edge.node, "targetRef");
    if (!sources.length || !targets.length) { unrepresentedEdges.push(edge); continue; }
    const edgeDiagram = diagramEdges.get(edge.sourceId);
    const waypoints = edgeDiagram ? direct(edgeDiagram, "waypoint").map(point => ({ x: number(point.attributes.x, 0), y: number(point.attributes.y, 0) })) : [];
    const pairs = sources.flatMap(sourceId => targets.map(targetId => ({ sourceId, targetId })));
    let representedPairCount = 0;
    for (const [pairIndex, pair] of pairs.entries()) {
      const { sourceId, targetId } = pair;
      const from = records.get(sourceId); const to = records.get(targetId); if (!from || !to) { unrepresentedEdgePairs++; unrepresentedEndpointIds.add(edge.sourceId); continue; }
      representedPairCount++;
      const dx = to.bounds.x + to.bounds.w / 2 - (from.bounds.x + from.bounds.w / 2); const dy = to.bounds.y + to.bounds.h / 2 - (from.bounds.y + from.bounds.h / 2);
      const fromAnchor = Math.abs(dx) >= Math.abs(dy) ? { x: dx >= 0 ? 1 : 0, y: .5 } : { x: .5, y: dy >= 0 ? 1 : 0 };
      const toAnchor = Math.abs(dx) >= Math.abs(dy) ? { x: dx >= 0 ? 0 : 1, y: .5 } : { x: .5, y: dy >= 0 ? 0 : 1 };
      const route = pairs.length === 1 ? waypoints : [];
      const start = route[0] ?? { x: from.bounds.x + from.bounds.w * fromAnchor.x, y: from.bounds.y + from.bounds.h * fromAnchor.y };
      const end = route[route.length - 1] ?? { x: to.bounds.x + to.bounds.w * toAnchor.x, y: to.bounds.y + to.bounds.h * toAnchor.y };
      const associationDirection = attr(edge.node, "associationDirection");
      const noArrow = edge.type === "conversationLink" || edge.type === "association" && (!associationDirection || associationDirection === "None");
      const messageFlow = edge.type === "messageFlow"; const dataAssociation = edge.type === "dataInputAssociation" || edge.type === "dataOutputAssociation";
      const edgeExtension = extensionXml(edge.node); const edgeDiAttributes = diAttributes(edgeDiagram); const edgeDiChildren = diChildren(edgeDiagram, "waypoint");
      const edgeOtherXml = otherChildXml(edge.node, new Set(["extensionelements", "sourceref", "targetref"]));
      const labelText = attr(edge.node, "name"); const edgeAttributes = semanticAttributes(edge.node); const edgeReferencesToDefinitions = referenceDefinitionsFor(edgeAttributes, [], definitionNodes, definitionScopes, edge.processId ?? "", edge.parentSubprocessId); const roleMetadata: BpmnEdgeMetadata = {
        version: 1, type: edge.type, sourceId: edge.sourceId, ...(edge.processId ? { processId: edge.processId } : {}),
        ...(edge.collaborationId ? { collaborationId: edge.collaborationId } : {}), ...(edge.parentSubprocessId ? { parentSubprocessId: edge.parentSubprocessId } : {}), ...(associationDirection ? { associationDirection } : {}),
        sourceRefs: sources, targetRefs: targets,
        attributes: edgeAttributes, ...(edgeReferencesToDefinitions ? { referenceDefinitions: edgeReferencesToDefinitions } : {}), namespaces: edge.node.namespaceContext,
        ...(edgeExtension ? { extensionXml: edgeExtension } : {}),
        ...(edgeOtherXml ? { otherXml: edgeOtherXml } : {}),
        ...(edgeDiAttributes ? { di: edgeDiAttributes } : {}), ...(edgeDiChildren ? { diChildren: edgeDiChildren } : {}),
      };
      const label = labelText ? { text: labelText, color: "#46525b", fontSize: 11, fontFamily: "sans" as const, bold: false, italic: false, underline: false, textAlign: "center" as const, listType: "none" as const, verticalAlign: "top" as const, routePosition: .5 } : undefined;
      edges.push({
        type: noArrow ? "line" : "arrow", id: `bpmn-edge-${safeId(edge.sourceId, String(edges.length + 1))}${pairIndex ? `-${pairIndex + 1}` : ""}`,
        componentRole: `bpmn-edge|${encode(roleMetadata)}`, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y,
        color: "#46525b", thickness: 1.5, lineStyle: messageFlow || edge.type === "association" ? "dashed" : dataAssociation ? "dotted" : "solid",
        startHead: "none", endHead: noArrow ? "none" : messageFlow || dataAssociation ? "open" : "solid", lineRoute: route.length > 2 ? "elbow" : "straight",
        ...(route.length > 2 ? { routePoints: route.slice(1, -1) } : {}),
        startBinding: { elementId: from.element.id!, anchor: fromAnchor }, endBinding: { elementId: to.element.id!, anchor: toAnchor },
        ...(label && pairIndex === 0 ? { label } : {}),
      });
    }
    if (!representedPairCount) unrepresentedEdges.push(edge);
  }
  for (const edge of unrepresentedEdges) {
    const target = edge.collaborationId ? collaborationMetadata.find(item => item.id === edge.collaborationId) : edge.processId ? processesMetadata.get(edge.processId) : undefined;
    if (target) target.otherXml = [...(target.otherXml ?? []), serializeXmlNode(edge.node, true)];
  }
  const elements = [...edges, ...[...records.values()].map(record => record.element)];
  const documentHost = records.values().next().value as ShapeRecord | undefined;
  if (documentHost) {
    documentHost.metadata.document = documentMetadata;
    documentHost.element.componentRole = `bpmn-node|${encode(documentHost.metadata)}`;
  }
  const graphTypePattern = /(?:Event|Task|Gateway|Activity|SubProcess|Choreography|Conversation|Participant|Lane|Association|Flow|DataObjectReference|DataStoreReference|TextAnnotation|Group|DataInput|DataOutput)$/i;
  const unsupportedGraphNodes = allDescendants(root).filter(node => {
    const prefix = node.name.includes(":") ? node.name.slice(0, node.name.indexOf(":")) : "";
    const namespace = node.namespaceContext[prefix] ?? "";
    const isBpmnModel = !namespace || namespace === "http://www.omg.org/spec/BPMN/20100524/MODEL";
    const type = tagName(node);
    return isBpmnModel && graphTypePattern.test(type) && !BPMN_NODES.has(type) && !BPMN_EDGES.has(type);
  });
  const planeCount = diagrams.reduce((total, diagram) => total + descendants(diagram, "bpmnPlane").length, 0);
  const extraPlanes = Math.max(0, planeCount - 1);
  const nestedProcessNodes = semanticNodes.filter(node => !!node.parentSubprocessId).length;
  const simplified = unrepresentedEdgePairs;
  const skipped = unsupportedGraphNodes.length + unrepresentedEdges.length;
  const details = [String(elements.length) + " BPMN nodes and connectors were added as editable canvas objects."];
  const preservedExtensionCount = descendants(root, "extensionElements").length;
  if (preservedExtensionCount) details.push(String(preservedExtensionCount) + " extensionElements blocks are preserved in BPMN element metadata and export.");
  if (nestedProcessNodes) details.push(String(nestedProcessNodes) + " nested process nodes retain their subprocess scope when the containing subprocess is included in export.");
  if (processes.length > 1) details.push(String(processes.length) + " process definitions and their process-level attributes/extensions are retained independently.");
  if (collaborationMetadata.length > 1) details.push(String(collaborationMetadata.length) + " collaboration containers retain their own IDs, participants, message flows, attributes, and extensions.");
  if (edgeRecords.some(edge => edge.type === "dataInputAssociation" || edge.type === "dataOutputAssociation")) details.push("All sourceRef and targetRef endpoints on data associations are retained; each mapped endpoint pair is shown as an editable connector.");
  if (unrepresentedEdgePairs) details.push(String(unrepresentedEdgePairs) + " relationship endpoint pairs have no supported editable BPMN node (relationships: " + [...unrepresentedEndpointIds].join(", ") + "); their original references remain in XML.");
  if (extraPlanes) details.push(String(extraPlanes) + " additional BPMN DI planes are preserved as original XML; only the first plane is shown on the canvas.");
  if (unrepresentedEdges.length) details.push(String(unrepresentedEdges.length) + " relationships with missing or unsupported endpoints (" + unrepresentedEdges.map(edge => edge.sourceId).join(", ") + ") remain in their original process or collaboration XML.");
  if (unsupportedGraphNodes.length) {
    const names = [...new Set(unsupportedGraphNodes.map(tagName))].sort().join(", ");
    details.push(String(unsupportedGraphNodes.length) + " unsupported BPMN elements remain as original XML but are not editable canvas objects: " + names + ".");
  }
  if (!simplified && !skipped) details.push("No unsupported BPMN node types or unrepresented relationships were detected.");
  return { elements, report: { kept: elements.length, simplified, skipped, details } };
}

/** Backward-compatible element-only import API. */
export function importBpmnXml(source: string): Element[] {
  return importBpmnXmlWithReport(source).elements;
}

function xmlAttributes(attributes: Record<string, string>): string {
  return Object.entries(attributes).map(([key, value]) => ` ${key}="${escapeXml(value)}"`).join("");
}

function flowXml(flow: { shape: ShapeElement; metadata: BpmnEdgeMetadata; from: { id: string; sourceId: string }; to: { id: string; sourceId: string } }): string {
  const { shape, metadata, from, to } = flow; const id = safeId(metadata.sourceId, "Flow"); const type = metadata.type;
  const attributes = { ...metadata.attributes };
  for (const key of Object.keys(attributes)) if (["id", "name", "sourceRef", "targetRef"].includes(key.split(":").pop()!)) delete attributes[key];
  if (metadata.associationDirection && !attributes.associationDirection) attributes.associationDirection = metadata.associationDirection;
  const label = shape.label?.text ? ` name="${escapeXml(shape.label.text)}"` : "";
  const childXml = (metadata.otherXml ?? []).join(""); const extension = metadata.extensionXml ?? "";
  if (type === "dataInputAssociation" || type === "dataOutputAssociation") {
    const sources = metadata.sourceRefs?.length ? metadata.sourceRefs : [from.id]; const targets = metadata.targetRefs?.length ? metadata.targetRefs : [to.id];
    const references = [...sources.map(ref => `<bpmn:sourceRef>${escapeXml(safeId(ref, ref))}</bpmn:sourceRef>`), ...targets.map(ref => `<bpmn:targetRef>${escapeXml(safeId(ref, ref))}</bpmn:targetRef>`)].join("");
    return `<bpmn:${type} id="${escapeXml(id)}"${xmlAttributes(attributes)}>${extension}${childXml}${references}</bpmn:${type}>`;
  }
  return `<bpmn:${type} id="${escapeXml(id)}" sourceRef="${escapeXml(from.id)}" targetRef="${escapeXml(to.id)}"${label}${xmlAttributes(attributes)}>${extension}${childXml}</bpmn:${type}>`;
}

/** Export imported BPMN semantic nodes and relationships as BPMN 2.0 XML with process-aware DI bounds. */
export function exportBpmnXml(elements: Element[], contextElements: Element[] = elements): string {
  const collect = (items: Element[]) => {
    const result: Element[] = [];
    const visit = (current: Element[]) => { for (const item of current) { if (item.hidden) continue; result.push(item); if (item.type === "group") visit(item.elements); } };
    visit(items); return result;
  };
  const all = collect(elements); const contextAll = collect(contextElements);
  const documentMetadata = [...all, ...contextAll].flatMap(element => [bpmnNodeMetadata(element.componentRole)?.document]).find((metadata): metadata is BpmnDocumentMetadata => !!metadata);
  const nodeElements = all.filter(item => !!bpmnNodeMetadata(item.componentRole));
  const nodes = nodeElements.flatMap((element, index) => {
    const metadata = bpmnNodeMetadata(element.componentRole); const bounds = diagramGeometry(element);
    if (!metadata || !bounds || !BPMN_NODES.has(metadata.type)) return [];
    return [{ element, metadata, bounds, id: safeId(metadata.sourceId, `Node_${index + 1}`), sourceId: metadata.sourceId, type: metadata.type, label: nodeLabel(element) }];
  });
  const byElementId = new Map(nodes.flatMap(node => node.element.id ? [[node.element.id, node] as const] : []));
  const flowCandidates = all.flatMap(element => {
    if (element.type !== "line" && element.type !== "arrow") return [];
    const metadata = bpmnEdgeMetadata(element.componentRole); if (!metadata || !BPMN_EDGES.has(metadata.type)) return [];
    const from = element.startBinding?.elementId ? byElementId.get(element.startBinding.elementId) : undefined; const to = element.endBinding?.elementId ? byElementId.get(element.endBinding.elementId) : undefined;
    return from && to ? [{ shape: element, metadata, from, to, id: safeId(metadata.sourceId, "Flow") }] : [];
  });
  const flows = [...new Map(flowCandidates.map(flow => [flow.metadata.sourceId, flow] as const)).values()];
  if (!nodes.length) throw new Error("Select or import BPMN nodes before exporting BPMN XML.");

  const processNodes = nodes.filter(node => node.type !== "participant" && node.type !== "lane");
  const participants = nodes.filter(node => node.type === "participant"); const lanes = nodes.filter(node => node.type === "lane");
  const namespaces = new Map<string, string>();
  for (const metadata of [...nodes.map(node => node.metadata), ...flows.map(flow => flow.metadata)]) {
    for (const [prefix, uri] of Object.entries(metadata.namespaces ?? {})) if (prefix !== "xml") namespaces.set(prefix, uri);
    for (const [prefix, uri] of Object.entries(metadata.process?.namespaces ?? {})) if (prefix !== "xml") namespaces.set(prefix, uri);
  }
  for (const [prefix, uri] of Object.entries(documentMetadata?.namespaces ?? {})) if (prefix !== "xml") namespaces.set(prefix, uri);
  for (const collaboration of documentMetadata?.collaborations ?? []) for (const [prefix, uri] of Object.entries(collaboration.namespaces)) if (prefix !== "xml") namespaces.set(prefix, uri);
  const namespaceAttributes = [...namespaces].filter(([prefix]) => !["bpmn", "bpmndi", "dc", "di"].includes(prefix)).map(([prefix, uri]) => `${prefix ? ` xmlns:${prefix}` : " xmlns"}="${escapeXml(uri)}"`).join("");
  const processIds = [...new Set(processNodes.filter(node => !node.metadata.collaborationId).map(node => node.metadata.processId).filter((id): id is string => !!id))];
  if (!processIds.length && processNodes.some(node => !node.metadata.collaborationId)) processIds.push("Process_1");
  const referencedDefinitions = new Map<string, BpmnDefinitionReference>();
  for (const metadata of [...nodes.map(node => node.metadata), ...flows.map(flow => flow.metadata)]) {
    for (const reference of metadata.referenceDefinitions ?? []) if (!referencedDefinitions.has(reference.id)) referencedDefinitions.set(reference.id, reference);
  }
  const globalDefinitionXml = documentMetadata ? documentMetadata.definitionsChildren.join("\n  ") : [...referencedDefinitions.values()].filter(reference => reference.type !== "dataObject").map(reference => reference.xml).join("\n  ");
  const processMetadata = new Map<string, BpmnProcessMetadata>(documentMetadata?.processes.map(item => [item.id, item]) ?? []);
  for (const node of nodes) if (node.metadata.process?.id && !processMetadata.has(node.metadata.process.id)) processMetadata.set(node.metadata.process.id, node.metadata.process);
  for (const flow of flows) if (flow.metadata.process?.id && !processMetadata.has(flow.metadata.process.id)) processMetadata.set(flow.metadata.process.id, flow.metadata.process);

  const nodeMarkup = (node: typeof processNodes[number]): string => {
    const { type, id, label, metadata } = node;
    const attributes = { ...metadata.attributes }; delete attributes.id; delete attributes.name;
    const extension = metadata.extensionXml ?? "";
    if (type === "lane") {
      const references = metadata.flowNodeRefs ?? [];
      const nestedSets = processMetadata.get(metadata.processId ?? "")?.laneSets?.filter(set => set.parentLaneId === node.sourceId) ?? [];
      const nestedXml = nestedSets.map(set => laneSetMarkup(set, lanes.filter(child => child.metadata.processId === metadata.processId))).join("");
      return `<bpmn:lane id="${escapeXml(id)}"${label ? ` name="${escapeXml(label)}"` : ""}${xmlAttributes(attributes)}>${extension}${(metadata.otherXml ?? []).join("")}${references.map(ref => `<bpmn:flowNodeRef>${escapeXml(safeId(ref, ref))}</bpmn:flowNodeRef>`).join("")}${nestedXml}</bpmn:lane>`;
    }
    const children = (metadata.eventDefinitions ?? []).map(event => {
      const attrs = { ...event.attributes }; delete attrs.id;
      const key = event.referenceKey ?? (event.kind === "messageEventDefinition" ? "messageRef" : event.kind === "signalEventDefinition" ? "signalRef" : event.kind === "errorEventDefinition" ? "errorRef" : event.kind === "escalationEventDefinition" ? "escalationRef" : "");
      if (key && event.referenceValue) attrs[key] = event.referenceValue;
      const expr = event.expressionName && event.expression !== undefined ? `<bpmn:${event.expressionName}>${escapeXml(event.expression)}</bpmn:${event.expressionName}>` : "";
      const content = `${event.extensionXml ?? ""}${expr}`;
      return `<bpmn:${event.kind}${event.id ? ` id="${escapeXml(event.id)}"` : ""}${xmlAttributes(attrs)}${content ? `>${content}</bpmn:${event.kind}>` : "/>"}`;
    }).join("");
    const script = type === "scriptTask" ? `<bpmn:script>${escapeXml(node.element.type === "group" ? node.element.libraryComponent?.componentFields?.find(field => field.key === "script")?.value ?? "" : "")}</bpmn:script>` : "";
    const supportsNestedFlow = ["subProcess", "transaction", "adHocSubProcess", "eventSubProcess"].includes(type);
    const nestedDefinitions = supportsNestedFlow ? [...referencedDefinitions.values()].filter(reference => reference.type === "dataObject" && reference.processId === metadata.processId && reference.parentSubprocessId === node.sourceId).map(reference => reference.xml).join("") : "";
    const nestedNodes = supportsNestedFlow ? processNodes.filter(child => child.metadata.parentSubprocessId === node.sourceId).map(nodeMarkup).join("") : "";
    const nestedFlows = supportsNestedFlow ? flows.filter(flow => flow.metadata.parentSubprocessId === node.sourceId).map(flowXml).join("") : "";
    const childXml = extension + (metadata.otherXml ?? []).join("") + children + script + nestedDefinitions + nestedNodes + nestedFlows;
    return `<bpmn:${type} id="${escapeXml(id)}"${label ? ` name="${escapeXml(label)}"` : ""}${xmlAttributes(attributes)}${childXml ? `>${childXml}</bpmn:${type}>` : "/>"}`;
  };
  function laneSetMarkup(set: BpmnLaneSetMetadata, processLanes: typeof lanes, elementName = "laneSet"): string {
    const attributes = { ...set.attributes, id: safeId(set.id, set.id) };
    const items = processLanes.filter(lane => lane.metadata.laneSetId === set.id && lane.metadata.parentLaneId === set.parentLaneId);
    const lanesXml = items.map(lane => {
      const nestedSets = processMetadata.get(lane.metadata.processId ?? "")?.laneSets?.filter(childSet => childSet.parentLaneId === lane.sourceId) ?? [];
      const nestedXml = nestedSets.map(childSet => laneSetMarkup(childSet, processLanes, "childLaneSet")).join("");
      const laneAttributes = { ...lane.metadata.attributes }; delete laneAttributes.id; delete laneAttributes.name;
      const laneRefs = (lane.metadata.flowNodeRefs ?? []).map(ref => `<bpmn:flowNodeRef>${escapeXml(safeId(ref, ref))}</bpmn:flowNodeRef>`).join("");
      return `<bpmn:lane id="${escapeXml(lane.id)}"${lane.label ? ` name="${escapeXml(lane.label)}"` : ""}${xmlAttributes(laneAttributes)}>${lane.metadata.extensionXml ?? ""}${(lane.metadata.otherXml ?? []).join("")}${laneRefs}${nestedXml}</bpmn:lane>`;
    }).join("");
    return `<bpmn:${elementName}${xmlAttributes(attributes)}>${set.extensionXml ?? ""}${lanesXml}</bpmn:${elementName}>`;
  }
  const processXml = processIds.map(processId => {
    const processElements = processNodes.filter(node => node.metadata.processId === processId && !node.metadata.parentSubprocessId);
    const processLanes = lanes.filter(node => node.metadata.processId === processId);
    const process = processMetadata.get(processId);
    const processAttributes: Record<string, string> = { ...(process?.attributes ?? {}), id: safeId(processId, `Process_${processIds.indexOf(processId) + 1}`) };
    const candidate = processElements.find(node => node.metadata.processId === processId) ?? processLanes.find(node => node.metadata.processId === processId);
    if (processAttributes.isExecutable === undefined) processAttributes.isExecutable = candidate?.metadata.processExecutable === undefined ? "false" : String(candidate.metadata.processExecutable);
    const processDefinitions = [...referencedDefinitions.values()].filter(reference => reference.type === "dataObject" && reference.processId === processId && !reference.parentSubprocessId).map(reference => reference.xml).join("");
    const laneSetMetadata = process?.laneSets?.length ? process.laneSets : processLanes.length ? [{ id: `LaneSet_${safeId(processId, "1")}`, attributes: {} }] : [];
    const laneSetsXml = laneSetMetadata.filter(item => !item.parentLaneId).map(item => laneSetMarkup(item, processLanes)).join("");
    const processFlows = flows.filter(flow => flow.metadata.type !== "messageFlow" && (flow.metadata.processId ?? processId) === processId && !flow.metadata.parentSubprocessId).map(flowXml).join("");
    return `<bpmn:process${xmlAttributes(processAttributes)}>${process?.extensionXml ?? ""}${(process?.otherXml ?? []).join("")}${processDefinitions}${processElements.map(nodeMarkup).join("")}${laneSetsXml}${processFlows}</bpmn:process>`;
  }).join("\n  ");
  const collaborationMetadata = documentMetadata?.collaborations ?? [];
  const fallbackCollaboration: BpmnCollaborationMetadata = { id: "Collaboration_1", attributes: {}, namespaces: {} };
  const collaborations: BpmnCollaborationMetadata[] = collaborationMetadata.length ? collaborationMetadata : participants.length || flows.some(flow => flow.metadata.type === "messageFlow") ? [fallbackCollaboration] : [];
  const collaborationXml = collaborations.map(collaboration => {
    const collaborationId = collaboration.id;
    const collaborationParticipants = participants.filter(node => !node.metadata.collaborationId ? collaborationId === collaborations[0]?.id : node.metadata.collaborationId === collaborationId);
    const collaborationNodes = nodes.filter(node => node.metadata.collaborationId === collaborationId && node.type !== "participant" && node.type !== "lane");
    const collaborationFlows = flows.filter(flow => flow.metadata.type === "messageFlow" && (!flow.metadata.collaborationId ? collaborationId === collaborations[0]?.id : flow.metadata.collaborationId === collaborationId));
    const participantXml = collaborationParticipants.map(node => {
    const attributes = { ...node.metadata.attributes }; delete attributes.id; delete attributes.name; delete attributes.processRef;
    const processRef = node.metadata.processRef ? ` processRef="${escapeXml(safeId(node.metadata.processRef, node.metadata.processRef))}"` : "";
    const content = (node.metadata.extensionXml ?? "") + (node.metadata.otherXml ?? []).join("");
    return `<bpmn:participant id="${escapeXml(node.id)}"${node.label ? ` name="${escapeXml(node.label)}"` : ""}${processRef}${xmlAttributes(attributes)}${content ? `>${content}</bpmn:participant>` : "/>"}`;
    }).join("");
    const attributes = { ...collaboration.attributes, id: safeId(collaborationId, "Collaboration_1") };
    const contents = (collaboration.extensionXml ?? "") + (collaboration.otherXml ?? []).join("") + collaborationNodes.map(nodeMarkup).join("") + participantXml + collaborationFlows.map(flowXml).join("");
    return `<bpmn:collaboration${xmlAttributes(attributes)}>${contents}</bpmn:collaboration>`;
  }).join("\n  ");
  const shapeXml = nodes.map(({ bounds, id, metadata }) => {
    return `<bpmndi:BPMNShape id="DI_${escapeXml(id)}" bpmnElement="${escapeXml(id)}"${xmlAttributes(metadata.di ?? {})}><dc:Bounds x="${finiteXmlNumber(bounds.x)}" y="${finiteXmlNumber(bounds.y)}" width="${finiteXmlNumber(bounds.w)}" height="${finiteXmlNumber(bounds.h)}"/>${(metadata.diChildren ?? []).join("")}</bpmndi:BPMNShape>`;
  }).join("\n      ");
  const edgeXml = flows.map(({ shape, metadata, id }) => {
    const points = [{ x: shape.x, y: shape.y }, ...(shape.routePoints ?? []), { x: shape.x + shape.w, y: shape.y + shape.h }];
    return `<bpmndi:BPMNEdge id="DI_${escapeXml(id)}" bpmnElement="${escapeXml(id)}"${xmlAttributes(metadata.di ?? {})}>${points.map(point => `<di:waypoint x="${finiteXmlNumber(point.x)}" y="${finiteXmlNumber(point.y)}"/>`).join("")}${(metadata.diChildren ?? []).join("")}</bpmndi:BPMNEdge>`;
  }).join("\n      ");
  const planeRef = documentMetadata?.planeAttributes?.bpmnElement ?? processIds[0] ?? "Process_1";
  const definitionsAttributes = { id: "SketchDraw_Diagram", targetNamespace: "https://sketchdraw.local/bpmn", ...(documentMetadata?.attributes ?? {}) };
  const diagramAttributes = { id: "BPMNDiagram_1", ...(documentMetadata?.diagramAttributes ?? {}) };
  const planeAttributes = { id: "BPMNPlane_1", bpmnElement: planeRef, ...(documentMetadata?.planeAttributes ?? {}) };
  const planeChildren = [shapeXml, edgeXml, ...(documentMetadata?.otherPlaneXml ?? [])].filter(Boolean).join("\n      ");
  const additionalPlanesXml = (documentMetadata?.additionalPlanesXml ?? []).join("\n    ");
  const additionalDiagramsXml = (documentMetadata?.additionalDiagramsXml ?? []).join("\n  ");
  const rootChildren = [globalDefinitionXml, processXml, collaborationXml,
    `<bpmndi:BPMNDiagram${xmlAttributes(diagramAttributes)}><bpmndi:BPMNPlane${xmlAttributes(planeAttributes)}>${planeChildren ? `\n      ${planeChildren}\n  ` : ""}</bpmndi:BPMNPlane>${additionalPlanesXml ? `\n    ${additionalPlanesXml}\n  ` : ""}</bpmndi:BPMNDiagram>`, additionalDiagramsXml].filter(Boolean).join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI"${namespaceAttributes}${xmlAttributes(definitionsAttributes)}>\n  ${rootChildren}\n</bpmn:definitions>\n`;
}
