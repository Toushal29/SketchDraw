import type { Element, ShapeElement } from "../../model";

type XmlNode = { name: string; attributes: Record<string, string>; children: XmlNode[]; text: string };
type XmlToken = { raw: string; end: number };

function entityDecode(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower === "amp") return "&"; if (lower === "lt") return "<"; if (lower === "gt") return ">"; if (lower === "quot") return "\""; if (lower === "apos") return "'";
    const numeric = lower.startsWith("#x") ? Number.parseInt(lower.slice(2), 16) : Number.parseInt(lower.slice(1), 10);
    return Number.isFinite(numeric) && numeric > 0 && numeric <= 0x10ffff ? String.fromCodePoint(numeric) : "�";
  });
}

function scanTag(source: string, start: number): XmlToken {
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
  const document: XmlNode = { name: "#document", attributes: {}, children: [], text: "" };
  const stack = [document];
  for (let index = 0; index < source.length;) {
    const open = source.indexOf("<", index);
    if (open < 0) { stack[stack.length - 1].text += entityDecode(source.slice(index)); break; }
    if (open > index) stack[stack.length - 1].text += entityDecode(source.slice(index, open));
    if (source.startsWith("<!--", open)) { const close = source.indexOf("-->", open + 4); if (close < 0) throw new Error("BPMN XML contains an unfinished comment."); index = close + 3; continue; }
    if (source.startsWith("<![CDATA[", open)) { const close = source.indexOf("]]>", open + 9); if (close < 0) throw new Error("BPMN XML contains an unfinished CDATA block."); stack[stack.length - 1].text += source.slice(open + 9, close); index = close + 3; continue; }
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
      const keyStart = cursor;
      while (/[A-Za-z0-9_.:-]/.test(attributeSource[cursor] ?? "")) cursor++;
      const key = attributeSource.slice(keyStart, cursor);
      while (/\s/.test(attributeSource[cursor] ?? "")) cursor++;
      if (!key || attributeSource[cursor++] !== "=") throw new Error("BPMN XML contains a malformed attribute.");
      while (/\s/.test(attributeSource[cursor] ?? "")) cursor++;
      const quote = attributeSource[cursor++];
      if (quote !== "\"" && quote !== "'") throw new Error("BPMN XML attributes must be quoted.");
      const valueStart = cursor;
      while (cursor < attributeSource.length && attributeSource[cursor] !== quote) cursor++;
      if (cursor >= attributeSource.length) throw new Error("BPMN XML contains an unterminated attribute value.");
      attributes[key] = entityDecode(attributeSource.slice(valueStart, cursor)); cursor++;
    }
    const node: XmlNode = { name, attributes, children: [], text: "" }; stack[stack.length - 1].children.push(node);
    if (!selfClosing) { if (stack.length >= 128) throw new Error("BPMN XML nesting exceeds 128 levels."); stack.push(node); }
  }
  if (stack.length !== 1) throw new Error(`BPMN XML element ${stack[stack.length - 1]?.name ?? "unknown"} is not closed.`);
  if (document.children.length !== 1) throw new Error("BPMN XML needs exactly one root element.");
  return document.children[0];
}

const localName = (node: XmlNode) => node.name.split(":").pop()!.toLowerCase();
function walk(node: XmlNode, visit: (candidate: XmlNode) => void) { visit(node); for (const child of node.children) walk(child, visit); }
const allDescendants = (node: XmlNode) => { const output: XmlNode[] = []; walk(node, item => output.push(item)); return output; };
const descendants = (node: XmlNode, name: string) => { const output: XmlNode[] = []; walk(node, item => { if (localName(item) === name.toLowerCase()) output.push(item); }); return output; };
const direct = (node: XmlNode, name: string) => node.children.filter(item => localName(item) === name.toLowerCase());
const attr = (node: XmlNode, name: string) => node.attributes[name] ?? node.attributes[`bpmn:${name}`] ?? "";
const safeId = (value: string, fallback: string) => { const result = value.replace(/[^A-Za-z0-9_.-]/g, "_").replace(/^[^A-Za-z_]+/, "").slice(0, 96); return result || fallback; };
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const number = (value: string | undefined, fallback: number) => { const parsed = Number(value); return Number.isFinite(parsed) && Math.abs(parsed) <= 1_000_000 ? parsed : fallback; };
const BPMN_NODES = new Set(["startEvent", "intermediateCatchEvent", "intermediateThrowEvent", "endEvent", "boundaryEvent", "task", "userTask", "serviceTask", "scriptTask", "manualTask", "businessRuleTask", "sendTask", "receiveTask", "callActivity", "subProcess", "transaction", "adHocSubProcess", "eventSubProcess", "exclusiveGateway", "eventBasedGateway", "inclusiveGateway", "parallelGateway", "complexGateway", "dataObjectReference", "dataStoreReference", "textAnnotation", "participant", "lane", "group"]);
const BPMN_EDGES = new Set(["sequenceFlow", "messageFlow", "association", "dataInputAssociation", "dataOutputAssociation"]);
const reference = (node: XmlNode, key: string) => attr(node, key) || direct(node, key)[0]?.text.trim() || "";

type ShapeRecord = { sourceId: string; type: string; name: string; shape: ShapeElement };

/** Import the common BPMN 2.0 process/collaboration subset and retain semantic element IDs on native objects. */
export function importBpmnXml(source: string): Element[] {
  const root = parseXml(source);
  if (localName(root) !== "definitions") throw new Error("BPMN XML must have a definitions root element.");
  const semanticNodes = new Map<string, XmlNode>();
  const process = descendants(root, "process")[0];
  if (!process) throw new Error("BPMN XML does not contain a process.");
  for (const child of allDescendants(process)) if (BPMN_NODES.has(child.name.split(":").pop()!)) {
    const id = attr(child, "id"); if (id) semanticNodes.set(id, child);
  }
  for (const participant of descendants(root, "participant")) { const id = attr(participant, "id"); if (id) semanticNodes.set(id, participant); }
  for (const lane of descendants(root, "lane")) { const id = attr(lane, "id"); if (id) semanticNodes.set(id, lane); }
  for (const group of descendants(root, "group")) { const id = attr(group, "id"); if (id) semanticNodes.set(id, group); }
  const diagramShapes = new Map<string, XmlNode>(); const diagramEdges = new Map<string, XmlNode>();
  for (const item of descendants(root, "bpmnShape")) if (attr(item, "bpmnElement")) diagramShapes.set(attr(item, "bpmnElement"), item);
  for (const item of descendants(root, "bpmnEdge")) if (attr(item, "bpmnElement")) diagramEdges.set(attr(item, "bpmnElement"), item);
  if (!semanticNodes.size) throw new Error("BPMN process contains no supported flow nodes.");
  if (semanticNodes.size > 500) throw new Error("BPMN diagrams are limited to 500 semantic nodes.");

  const records = new Map<string, ShapeRecord>(); const columns = Math.max(1, Math.ceil(Math.sqrt(semanticNodes.size)));
  [...semanticNodes.values()].forEach((item, index) => {
    const sourceId = attr(item, "id"); const type = item.name.split(":").pop()!; const label = attr(item, "name") || type.replace(/([a-z])([A-Z])/g, "$1 $2");
    const bounds = descendants(diagramShapes.get(sourceId) ?? item, "bounds")[0];
    const x = number(bounds?.attributes.x, (index % columns) * 250); const y = number(bounds?.attributes.y, Math.floor(index / columns) * 150);
    const width = Math.max(44, number(bounds?.attributes.width, /event|gateway/i.test(type) ? 56 : 156)); const height = Math.max(36, number(bounds?.attributes.height, /event|gateway/i.test(type) ? 56 : 90));
    const shape: ShapeElement = {
      type: /gateway/i.test(type) ? "diamond" : /event/i.test(type) ? "circle" : "rectangle",
      id: `bpmn-node-${safeId(sourceId, String(index + 1))}`, componentRole: `bpmn-node|${type}|${encodeURIComponent(sourceId)}`,
      x, y, w: width, h: height, color: "#46525b", thickness: 1.5, fillColor: "#ffffff", fillOpacity: 1,
      ...(type === "task" || /Task$|Activity|SubProcess/.test(type) ? { edgeStyle: "rounded" as const, cornerRadius: 10 } : {}),
      label: { text: label, color: "#252a2e", fontSize: 13, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" },
    };
    records.set(sourceId, { sourceId, type, name: label, shape });
  });

  const edges: ShapeElement[] = [];
  for (const child of allDescendants(root).filter(item => BPMN_EDGES.has(item.name.split(":").pop()!))) {
    const sourceId = reference(child, "sourceRef"); const targetId = reference(child, "targetRef"); const from = records.get(sourceId); const to = records.get(targetId); const id = attr(child, "id");
    if (!from || !to || !id) continue;
    const type = child.name.split(":").pop()!; const fromAnchor = { x: from.shape.x < to.shape.x ? 1 : 0, y: .5 }; const toAnchor = { x: from.shape.x < to.shape.x ? 0 : 1, y: .5 };
    const edgeDiagram = diagramEdges.get(id); const waypoints = edgeDiagram ? descendants(edgeDiagram, "waypoint").map(point => ({ x: number(point.attributes.x, 0), y: number(point.attributes.y, 0) })) : [];
    const start = waypoints[0] ?? { x: from.shape.x + from.shape.w * fromAnchor.x, y: from.shape.y + from.shape.h * fromAnchor.y };
    const end = waypoints[waypoints.length - 1] ?? { x: to.shape.x + to.shape.w * toAnchor.x, y: to.shape.y + to.shape.h * toAnchor.y };
    edges.push({ type: type === "association" || type === "conversationLink" ? "line" : "arrow", id: `bpmn-edge-${safeId(id, String(edges.length + 1))}`, componentRole: `bpmn-edge|${type}|${encodeURIComponent(id)}`, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color: "#46525b", thickness: 1.5, lineStyle: type === "messageFlow" || type === "association" ? "dashed" : "solid", startHead: "none", endHead: type === "association" || type === "conversationLink" ? "none" : "solid", lineRoute: "elbow", ...(waypoints.length > 2 ? { routePoints: waypoints.slice(1, -1) } : {}), startBinding: { elementId: from.shape.id!, anchor: fromAnchor }, endBinding: { elementId: to.shape.id!, anchor: toAnchor }, ...(attr(child, "name") ? { label: { text: attr(child, "name"), color: "#46525b", fontSize: 11, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" } } : {}) });
  }
  return [...edges, ...[...records.values()].map(record => record.shape)];
}

/** Export imported BPMN semantic nodes and relationships as BPMN 2.0 XML with DI bounds. */
export function exportBpmnXml(elements: Element[]): string {
  const flattened = elements.flatMap(function visit(item): Element[] { return item.hidden ? [] : item.type === "group" ? item.elements.flatMap(visit) : [item]; });
  const visible = flattened.filter((item): item is ShapeElement => item.type !== "group" && item.componentRole?.startsWith("bpmn-node|") === true);
  const nodes = visible.map((shape, index) => {
    const [, type, encodedId = ""] = (shape.componentRole ?? "").split("|"); let id = ""; try { id = decodeURIComponent(encodedId); } catch { id = encodedId; }
    return BPMN_NODES.has(type) ? { shape, type, id: safeId(id, `Activity_${index + 1}`), label: shape.label?.text ?? "" } : undefined;
  }).filter((node): node is NonNullable<typeof node> => !!node);
  const byElementId = new Map(nodes.flatMap(node => node.shape.id ? [[node.shape.id, node] as const] : []));
  const flows = flattened.filter((item): item is ShapeElement => (item.type === "line" || item.type === "arrow") && item.componentRole?.startsWith("bpmn-edge|") === true).flatMap((shape, index) => {
    const from = shape.startBinding?.elementId ? byElementId.get(shape.startBinding.elementId) : undefined; const to = shape.endBinding?.elementId ? byElementId.get(shape.endBinding.elementId) : undefined;
    if (!from || !to) return [];
    const [, type, encodedId = ""] = (shape.componentRole ?? "").split("|"); let id = ""; try { id = decodeURIComponent(encodedId); } catch { id = encodedId; }
    return BPMN_EDGES.has(type) ? [{ shape, from, to, type, id: safeId(id, `Flow_${index + 1}`) }] : [];
  });
  if (!nodes.length) throw new Error("Select or import BPMN nodes before exporting BPMN XML.");
  const processNodes = nodes.filter(node => node.type !== "participant" && node.type !== "lane");
  const participants = nodes.filter(node => node.type === "participant");
  const lanes = nodes.filter(node => node.type === "lane");
  const nodeXml = processNodes.map(({ type, id, label }) => `<bpmn:${type} id="${escapeXml(id)}"${label ? ` name="${escapeXml(label)}"` : ""}/>`).join("\n    ");
  const participantXml = participants.map(({ id, label }) => `<bpmn:participant id="${escapeXml(id)}"${label ? ` name="${escapeXml(label)}"` : ""} processRef="Process_1"/>`).join("\n      ");
  const laneXml = lanes.length ? `<bpmn:laneSet id="LaneSet_1">${lanes.map(({ id, label }) => `<bpmn:lane id="${escapeXml(id)}"${label ? ` name="${escapeXml(label)}"` : ""}/>`).join("")}</bpmn:laneSet>` : "";
  const serializeFlow = ({ shape, type, id, from, to }: typeof flows[number]) => {
    if (type === "dataInputAssociation" || type === "dataOutputAssociation") return `<bpmn:${type} id="${escapeXml(id)}"><bpmn:sourceRef>${escapeXml(from.id)}</bpmn:sourceRef><bpmn:targetRef>${escapeXml(to.id)}</bpmn:targetRef></bpmn:${type}>`;
    return `<bpmn:${type} id="${escapeXml(id)}" sourceRef="${escapeXml(from.id)}" targetRef="${escapeXml(to.id)}"${shape.label?.text ? ` name="${escapeXml(shape.label.text)}"` : ""}/>`;
  };
  const processFlows = flows.filter(flow => flow.type !== "messageFlow").map(serializeFlow).join("\n    ");
  const collaborationFlows = flows.filter(flow => flow.type === "messageFlow").map(serializeFlow).join("\n      ");
  const shapeXml = nodes.map(({ shape, id }) => `<bpmndi:BPMNShape id="DI_${escapeXml(id)}" bpmnElement="${escapeXml(id)}"><dc:Bounds x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}"/></bpmndi:BPMNShape>`).join("\n      ");
  const edgeXml = flows.map(({ shape, id }) => {
    const points = [{ x: shape.x, y: shape.y }, ...(shape.routePoints ?? []), { x: shape.x + shape.w, y: shape.y + shape.h }];
    return `<bpmndi:BPMNEdge id="DI_${escapeXml(id)}" bpmnElement="${escapeXml(id)}">${points.map(point => `<di:waypoint x="${point.x}" y="${point.y}"/>`).join("")}</bpmndi:BPMNEdge>`;
  }).join("\n      ");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="SketchDraw_Diagram" targetNamespace="https://sketchdraw.local/bpmn">\n  <bpmn:process id="Process_1" isExecutable="false">\n    ${nodeXml}${laneXml ? `\n    ${laneXml}` : ""}${processFlows ? `\n    ${processFlows}` : ""}\n  </bpmn:process>${participants.length || collaborationFlows ? `\n  <bpmn:collaboration id="Collaboration_1">${participantXml ? `\n      ${participantXml}` : ""}${collaborationFlows ? `\n      ${collaborationFlows}` : ""}\n  </bpmn:collaboration>` : ""}\n  <bpmndi:BPMNDiagram id="BPMNDiagram_1"><bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">\n      ${shapeXml}${edgeXml ? `\n      ${edgeXml}` : ""}\n  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>\n</bpmn:definitions>\n`;
}
