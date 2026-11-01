import type { Element, GroupElement, ShapeElement } from "../../model";
import { parse as parseYaml } from "yaml";

export type PlantUmlFamily = "activity" | "state" | "usecase" | "component" | "deployment" | "timing" | "mindmap" | "wbs" | "gantt" | "network" | "json" | "yaml" | "archimate";
type PlantNode = { id: string; label: string; shape: "rectangle" | "diamond" | "circle"; role: string; line: number; start: number; end: number; order: number; lane?: string; parent?: string; time?: number; duration?: number; detail?: string; sourceId?: string };
type PlantEdge = { from: string; to: string; label: string; line: number; start: number; end: number; operator: string; direction?: "forward" | "backward" | "both" | "none" };
type PlantFrame = { id: string; label: string; members: string[]; line: number; start?: number; end?: number; parent?: string };
type PlantDiagram = { family: PlantUmlFamily; nodes: PlantNode[]; edges: PlantEdge[]; frames: PlantFrame[]; title?: string; mode: "graph" | "activity" | "tree" | "timeline" };
type PlantRole = { line: number; start: number; end: number; original: string; id: string; sourceId?: string; family: PlantUmlFamily; operator?: string };
const encode = (value: unknown) => encodeURIComponent(JSON.stringify(value));
const decode = <T,>(value: string): T => JSON.parse(decodeURIComponent(value)) as T;
const rolePrefix = (family: PlantUmlFamily, kind: "node" | "edge" | "frame") => `plantuml-${family}-${kind}:`;

function linesOf(source: string) { return source.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n"); }
function diagnostic(message: string, raw: string, line: number, column = raw.search(/\S/)): never {
  throw new Error(`${message} (line ${line + 1}, column ${Math.max(1, column + 1)}).`);
}
function safeId(value: string, fallback: string) { return value.replace(/[^A-Za-z0-9_]/g, "_").replace(/^[^A-Za-z_]+/, "") || fallback; }

export function detectPlantUmlFamily(source: string): PlantUmlFamily | undefined {
  const lines = linesOf(source); const start = lines.find(line => /^\s*@start\w+/i.test(line))?.trim() ?? "";
  const marker = /^@start(\w+)/i.exec(start)?.[1].toLowerCase();
  if (marker === "nwdiag") return "network";
  if (["activity", "state", "usecase", "component", "deployment", "timing", "mindmap", "wbs", "gantt", "json", "yaml"].includes(marker ?? "")) return marker as PlantUmlFamily;
  if (!/@startuml\b/i.test(source)) return undefined;
  const body = lines.filter(line => !/^\s*@(?:startuml|enduml)\b/i.test(line)).join("\n");
  if (/\bnwdiag\s*\{|\bnetwork\s+[\w.-]+\s*\{/i.test(body)) return "network";
  if (/^\s*archimate\b|\b(?:Business|Application|Technology|Motivation|Strategy|Implementation|Physical)_[A-Za-z_]+\b/m.test(body)) return "archimate";
  if (/^\s*(?:clock|binary|concise|robust|analog|rectangle)\s+.+\bas\s+\w+/im.test(body) && /^\s*@\+?\d+\s+/m.test(body)) return "timing";
  if (/^\s*(?:start|stop|end|detach|kill|fork\b|split\b|if\s*\(|while\s*\(|repeat\b|:[\s\S]*;)/im.test(body)) return "activity";
  if (/^\s*(?:\[\*\]|state\s+\w+|\w+)\s*(?:-+>|-+\[|\{\s*$)/m.test(body) && /(?:\[\*\]|\bstate\s+\w+)/i.test(body)) return "state";
  if (/^\s*usecase\s+/im.test(body) || /^\s*\([^\n]+\)\s*(?:as\s+[\w.-]+)?$/m.test(body) || /^\s*:[^:\n]+:\s*$/m.test(body)) return "usecase";
  if (/^\s*(?:component|interface|package|folder|frame|queue|storage)\s+/im.test(body)) return "component";
  if (/^\s*(?:node|cloud)\s+/im.test(body)) return "deployment";
  if (/^\s*(?:participant|boundary|control|collections|queue)\s+/im.test(body) || /^\s*[A-Za-z_]\w*\s+(?:-->>|->>|-->|->|<--|<-)\s+[A-Za-z_]\w*/m.test(body) || /^\s*(?:activate|deactivate|autonumber)\b/im.test(body)) return undefined;
  if (/^\s*(?:actor\s+|usecase\s+|\([^\n]+\)\s*(?:as\s+\w+)?$|:[^\n]+:\s*(?:as\s+\w+)?$)/im.test(body)) return "usecase";
  if (/^\s*(?:node|cloud|database|artifact|component|interface|package|folder|frame|queue|storage)\s+/im.test(body)) return /\b(?:node|cloud)\s+/i.test(body) ? "deployment" : "component";
  return undefined;
}

function emptyDiagram(family: PlantUmlFamily, mode: PlantDiagram["mode"] = "graph"): PlantDiagram { return { family, nodes: [], edges: [], frames: [], mode }; }
function sourceBody(lines: string[]) {
  let start = lines.findIndex(line => /^\s*@start\w+/i.test(line)); let end = lines.findIndex((line, index) => index > start && /^\s*@end\w+\b/i.test(line));
  if (start < 0 || end < 0) throw new Error("PlantUML diagrams need matching @start... and @end... markers.");
  const startType = /^\s*@start(\w+)/i.exec(lines[start])?.[1].toLowerCase(); const endType = /^\s*@end(\w+)/i.exec(lines[end])?.[1].toLowerCase();
  if (startType && endType && startType !== endType && !(startType === "uml" && endType === "uml")) diagnostic("PlantUML start and end markers must match", lines[end], end);
  return { start, end, startType };
}
function addNode(diagram: PlantDiagram, data: Omit<PlantNode, "order" | "family"> & { order?: number }) {
  const existing = diagram.nodes.find(node => node.id === data.id);
  if (existing) return existing;
  const node: PlantNode = { ...data, order: data.order ?? diagram.nodes.length };
  diagram.nodes.push(node); return node;
}
function addEdge(diagram: PlantDiagram, data: PlantEdge) { diagram.edges.push(data); }

function parseActivity(lines: string[], start: number, end: number): PlantDiagram {
  const diagram = emptyDiagram("activity", "activity");
  let lane = "Activity"; let previous = ""; let pendingEdgeLabel = ""; let serial = 0;
  type Branch = { decision: string; exits: string[]; sawElse: boolean; kind: "if" | "loop" | "fork" };
  const stack: Branch[] = [];
  const make = (label: string, shape: PlantNode["shape"], line: number, raw: string, startColumn: number, endColumn: number, kind: string) => {
    void raw;
    const id = `activity-${++serial}`; const node = addNode(diagram, { id, label, shape, role: kind, line, start: kind === "start" || kind === "stop" ? -1 : startColumn, end: kind === "start" || kind === "stop" ? -1 : endColumn, lane });
    if (previous) addEdge(diagram, { from: previous, to: id, label: pendingEdgeLabel, line, start: startColumn, end: startColumn, operator: "-->" });
    previous = id; pendingEdgeLabel = ""; return node;
  };
  for (let index = start + 1; index < end; index++) {
    const raw = lines[index]; const line = raw.trim(); if (!line || line.startsWith("'") || line.startsWith("'!")) continue;
    const partition = /^\|(?:#[\w-]+\|)?([^|]+)\|(?:\s*(?:\[\[.*\]\])?)?$/.exec(line);
    if (partition) { lane = partition[1].trim(); if (!diagram.frames.some(frame => frame.id === lane)) diagram.frames.push({ id: lane, label: lane, members: [], line: index }); continue; }
    if (/^(?:title|caption|header|footer)\s+/i.test(line)) { if (/^title\s+/i.test(line)) diagram.title = line.replace(/^title\s+/i, ""); continue; }
    if (/^start\s*$/i.test(line)) { make("Start", "circle", index, raw, raw.indexOf(line), raw.indexOf(line) + line.length, "start"); continue; }
    if (/^(?:stop|end)\s*$/i.test(line)) { make("Stop", "circle", index, raw, raw.indexOf(line), raw.indexOf(line) + line.length, "stop"); continue; }
    const action = /^:\s*([\s\S]*?)\s*;\s*(?:<<[^>]+>>)?$/.exec(line);
    if (action) { const startColumn = raw.indexOf(action[1]); const node = make(action[1].replace(/\\n/g, "\n"), "rectangle", index, raw, startColumn, startColumn + action[1].length, "action"); if (lane) diagram.frames.find(frame => frame.id === lane)?.members.push(node.id); continue; }
    const decision = /^if\s*\((.*?)\)\s*(?:then\s*(?:\((.*?)\))?)?\s*$/i.exec(line);
    if (decision) {
      const startColumn = raw.indexOf(decision[1]); const node = make(decision[1], "diamond", index, raw, startColumn, startColumn + decision[1].length, "decision");
      if (decision[2]) pendingEdgeLabel = decision[2]; stack.push({ decision: node.id, exits: [], sawElse: false, kind: "if" }); previous = node.id; continue;
    }
    const loop = /^while\s*\((.*?)\)\s*(?:is\s*\((.*?)\))?\s*$/i.exec(line);
    if (loop) { const startColumn = raw.indexOf(loop[1]); const node = make(loop[1], "diamond", index, raw, startColumn, startColumn + loop[1].length, "loop"); stack.push({ decision: node.id, exits: [], sawElse: false, kind: "loop" }); previous = node.id; pendingEdgeLabel = loop[2] ?? "yes"; continue; }
    if (/^else(?:\s*\((.*?)\))?\s*$/i.test(line)) {
      const branch = stack[stack.length - 1]; if (!branch || branch.kind !== "if" || branch.sawElse) diagnostic("PlantUML else needs one open if branch", raw, index);
      if (previous && previous !== branch.decision) branch.exits.push(previous); branch.sawElse = true; previous = branch.decision; pendingEdgeLabel = /^else\s*\((.*?)\)/i.exec(line)?.[1] ?? "no"; continue;
    }
    const then = /^then(?:\s+\((.*?)\))?\s*$/i.exec(line);
    if (then) { pendingEdgeLabel = then[1] ?? "yes"; continue; }
    if (/^elseif\s*\((.*?)\)\s*(?:then\s*(?:\((.*?)\))?)?\s*$/i.test(line)) diagnostic("PlantUML elseif is outside the current activity subset; use nested if branches", raw, index);
    if (/^endif\s*$/i.test(line)) {
      const branch = stack.pop(); if (!branch || branch.kind !== "if") diagnostic("PlantUML endif has no matching if", raw, index);
      if (previous && previous !== branch.decision) branch.exits.push(previous);
      if (!branch.sawElse) branch.exits.push(branch.decision);
      if (branch.exits.length > 1) { previous = ""; const merge = make("Merge", "circle", index, raw, raw.indexOf(line), raw.indexOf(line) + line.length, "merge"); for (const exit of branch.exits) addEdge(diagram, { from: exit, to: merge.id, label: "", line: index, start: raw.indexOf(line), end: raw.indexOf(line), operator: "-->" }); previous = merge.id; }
      else previous = branch.exits[0] ?? branch.decision;
      continue;
    }
    const endwhile = /^endwhile(?:\s*\((.*?)\))?\s*$/i.exec(line);
    if (endwhile) { const branch = stack.pop(); if (!branch || branch.kind !== "loop") diagnostic("PlantUML endwhile has no matching while", raw, index); if (previous && previous !== branch.decision) addEdge(diagram, { from: previous, to: branch.decision, label: "", line: index, start: raw.indexOf(line), end: raw.indexOf(line), operator: "-->" }); previous = branch.decision; pendingEdgeLabel = endwhile[1] ?? "exit"; continue; }
    if (/^fork\s*$/i.test(line)) { const node = make("Fork", "circle", index, raw, raw.indexOf(line), raw.indexOf(line) + line.length, "fork"); stack.push({ decision: node.id, exits: [], sawElse: false, kind: "fork" }); previous = node.id; continue; }
    if (/^fork\s+again\s*$/i.test(line)) { const branch = stack[stack.length - 1]; if (!branch || branch.kind !== "fork") diagnostic("PlantUML fork again needs an open fork", raw, index); if (previous && previous !== branch.decision) branch.exits.push(previous); previous = branch.decision; continue; }
    if (/^end\s+fork(?:\s*\{(?:and|or)\})?\s*$/i.test(line)) { const branch = stack.pop(); if (!branch || branch.kind !== "fork") diagnostic("PlantUML end fork has no matching fork", raw, index); if (previous && previous !== branch.decision) branch.exits.push(previous); previous = ""; const join = make("Join", "circle", index, raw, raw.indexOf(line), raw.indexOf(line) + line.length, "join"); for (const exit of branch.exits) addEdge(diagram, { from: exit, to: join.id, label: "", line: index, start: raw.indexOf(line), end: raw.indexOf(line), operator: "-->" }); previous = join.id; continue; }
    const unsupported = /^(?:repeat|split|switch|case|label|goto|detach|kill|!pragma|skinparam|<style>)/i.test(line);
    if (unsupported) diagnostic("PlantUML activity construct is outside the editable subset", raw, index);
    if (/^@(?:start|end)uml\b/i.test(line)) continue;
    diagnostic("Unsupported PlantUML activity syntax", raw, index);
  }
  if (stack.length) throw new Error(`PlantUML activity has ${stack.length} unclosed control block(s).`);
  if (!diagram.nodes.length) throw new Error("Add an activity action, start/stop node, decision, or fork.");
  if (diagram.frames.length) {
    for (const frame of diagram.frames) if (!frame.members.length) frame.members = [];
  }
  return diagram;
}

function parseGraphFamily(source: string, family: "state" | "usecase" | "component" | "deployment" | "archimate"): PlantDiagram {
  const lines = linesOf(source); const marker = sourceBody(lines); const diagram = emptyDiagram(family); let title = ""; const frameStack: PlantFrame[] = []; let serial = 0;
  const terminal = (_raw: string, index: number, key: string, label: string, kind: "initial" | "final") => addNode(diagram, { id: key, label, shape: "circle", role: kind, line: index, start: -1, end: -1 });
  for (let index = marker.start + 1; index < marker.end; index++) {
    const raw = lines[index]; const line = raw.trim(); if (!line || line.startsWith("'") || line.startsWith("'!")) continue;
    if (/^title\s+/i.test(line)) { title = line.replace(/^title\s+/i, ""); continue; }
    if (/^\}$/.test(line)) { if (!frameStack.length) diagnostic("Unexpected PlantUML closing brace", raw, index); const frame = frameStack.pop()!; if (frame.members.length) diagram.frames.push(frame); continue; }
    if (/^(?:hide|show|skinparam|left to right direction|top to bottom direction|allowmixing)\b/i.test(line)) diagnostic("PlantUML styling/orientation directives are outside this editable family subset", raw, index);
    if (family === "state") {
      const stateDecl = /^state\s+(?:"([^"]+)"|'([^']+)'|([\w.-]+))(?:\s+as\s+([\w.-]+))?\s*(\{)?\s*$/i.exec(line);
      if (stateDecl) {
        const label = stateDecl[1] ?? stateDecl[2] ?? stateDecl[3]; const id = stateDecl[4] ?? safeId(label, `state_${++serial}`); const start = raw.indexOf(label);
        const parent = frameStack[frameStack.length - 1]?.id;
        addNode(diagram, { id, label, shape: "rectangle", role: "state", line: index, start, end: start + label.length, parent });
        if (parent) frameStack.find(frame => frame.id === parent)?.members.push(id);
        if (line.endsWith("{")) frameStack.push({ id, label, members: [], line: index }); continue;
      }
      const transition = /^(\[\*\]|[\w.-]+)\s*(-+\[[^\]]+\]-+>|-+>|-+|->|-->)\s*(\[\*\]|[\w.-]+)(?:\s*:\s*(.*))?$/.exec(line);
      if (transition) {
        const from = transition[1] === "[*]" ? "__initial__" : transition[1]; const to = transition[3] === "[*]" ? "__final__" : transition[3];
        if (from === "__initial__") terminal(raw, index, from, "Start", "initial"); else addNode(diagram, { id: from, label: from, shape: "rectangle", role: "state", line: index, start: raw.indexOf(from), end: raw.indexOf(from) + from.length });
        if (to === "__final__") terminal(raw, index, to, "End", "final"); else addNode(diagram, { id: to, label: to, shape: "rectangle", role: "state", line: index, start: raw.lastIndexOf(to), end: raw.lastIndexOf(to) + to.length });
        const label = transition[4] ?? ""; const labelStart = label ? raw.lastIndexOf(label) : raw.length;
        addEdge(diagram, { from, to, label, line: index, start: labelStart, end: labelStart + label.length, operator: transition[2] }); continue;
      }
      const description = /^([\w.-]+)\s*:\s*(.+)$/.exec(line);
      if (description) { const node = addNode(diagram, { id: description[1], label: description[1], shape: "rectangle", role: "state", line: index, start: raw.indexOf(description[1]), end: raw.indexOf(description[1]) + description[1].length }); node.detail = description[2]; continue; }
    } else {
      const archimateMacro = /^([A-Za-z][\w]*)\(\s*([\w.-]+)\s*,\s*"((?:\\.|[^"])*)"(?:\s*,\s*[^)]*)?\)\s*$/.exec(line);
      const archimateNative = /^archimate\s+#([\w-]+)\s+(?:"([^"]+)"|'([^']+)'|([\w.-]+))(?:\s+as\s+([\w.-]+))?(?:\s+<<[^>]+>>)?\s*$/i.exec(line);
      const archimate = /^(?:(Business|Application|Technology|Motivation|Strategy|Implementation|Physical)_([A-Za-z_]+)|([A-Za-z_]+))\s+(?:"([^"]+)"|'([^']+)'|([\w.-]+))(?:\s+as\s+([\w.-]+))?(?:\s+<<[^>]+>>)?\s*$/.exec(line);
      const general = /^(actor|usecase|component|interface|database|node|cloud|artifact|folder|package|frame|queue|storage|rectangle|agent|process|card|file|person|state)\s+(?:"([^"]+)"|'([^']+)'|([\w.-]+))(?:\s+as\s+([\w.-]+))?\s*(\{)?\s*$/i.exec(line);
      const archimateRelationMacro = /^Rel_([A-Za-z][\w]*)\(\s*([\w.-]+)\s*,\s*([\w.-]+)(?:\s*,\s*"((?:\\.|[^"])*)")?\s*\)\s*$/.exec(line);
      if (family === "archimate" && archimateMacro) {
        const kind = archimateMacro[1]; const id = archimateMacro[2]; const label = archimateMacro[3].replace(/\\n/g, "\n"); const start = raw.indexOf(archimateMacro[3]);
        addNode(diagram, { id, label, shape: "rectangle", role: kind, line: index, start, end: start + archimateMacro[3].length }); continue;
      }
      if (family === "archimate" && archimateNative) {
        const label = archimateNative[2] ?? archimateNative[3] ?? archimateNative[4]; const id = archimateNative[5] ?? safeId(label, `element_${++serial}`); const start = raw.indexOf(label);
        addNode(diagram, { id, label, shape: "rectangle", role: archimateNative[1], line: index, start, end: start + label.length }); continue;
      }
      if (family === "archimate" && archimate) {
        const prefix = archimate[1] ? `${archimate[1]}_${archimate[2]}` : archimate[3]; const label = archimate[4] ?? archimate[5] ?? archimate[6]; const id = archimate[7] ?? safeId(label, `element_${++serial}`); const start = raw.indexOf(label);
        const parent = frameStack[frameStack.length - 1]?.id;
        addNode(diagram, { id, label, shape: "rectangle", role: prefix, line: index, start, end: start + label.length, parent });
        if (parent) frameStack.find(frame => frame.id === parent)?.members.push(id);
        continue;
      }
      if (family === "archimate" && archimateRelationMacro) {
        const [, name, from, to, label = ""] = archimateRelationMacro;
        for (const id of [from, to]) if (!diagram.nodes.some(node => node.id === id)) addNode(diagram, { id, label: id, shape: "rectangle", role: "element", line: index, start: raw.indexOf(id), end: raw.indexOf(id) + id.length });
        const operator = /Aggregation/i.test(name) ? "o--" : /Composition/i.test(name) ? "*--" : /Specialization|Realization/i.test(name) ? "--|>" : /Flow|Influence/i.test(name) ? "..>" : "-->";
        const start = label ? raw.indexOf(label, raw.indexOf("(")) : raw.length;
        addEdge(diagram, { from, to, label, line: index, start, end: start + label.length, operator }); continue;
      }
      if (family !== "archimate" && general) {
        const kind = general[1].toLowerCase(); const label = general[2] ?? general[3] ?? general[4]; const id = general[5] ?? safeId(label, `${kind}_${++serial}`); const start = raw.indexOf(label);
        const parent = frameStack[frameStack.length - 1]?.id;
        addNode(diagram, { id, label, shape: kind === "usecase" ? "diamond" : kind === "actor" || kind === "person" ? "circle" : "rectangle", role: kind, line: index, start, end: start + label.length, parent });
        if (parent) frameStack.find(frame => frame.id === parent)?.members.push(id);
        if (general[6]) frameStack.push({ id, label, members: [], line: index }); continue;
      }
    }
    if (family === "usecase" && /^:[^:]+:\s*(?:as\s+[\w.-]+)?$/.test(line)) {
      const match = /^:([^:]+):\s*(?:as\s+([\w.-]+))?$/.exec(line)!; const id = match[2] ?? safeId(match[1], `actor_${++serial}`); const start = raw.indexOf(match[1]);
      addNode(diagram, { id, label: match[1], shape: "circle", role: "actor", line: index, start, end: start + match[1].length }); continue;
    }
    if (family === "usecase" && /^\([^)]+\)(?:\s+as\s+\w+)?$/.test(line)) {
      const match = /^\(([^)]+)\)(?:\s+as\s+(\w+))?$/.exec(line)!; const id = match[2] ?? safeId(match[1], `usecase_${++serial}`); const start = raw.indexOf(match[1]);
      addNode(diagram, { id, label: match[1], shape: "diamond", role: "usecase", line: index, start, end: start + match[1].length }); continue;
    }
    if (family === "usecase" || family === "component" || family === "deployment" || family === "archimate") {
      const relation = /^([\w.-]+)\s*(-(?:up|down|left|right|u|d|l|r)?->|-->|\.\.>|--|\.\.|<\|--|--\|>|\*--|o--|<-->)\s*([\w.-]+)(?:\s*:\s*(.*))?$/.exec(line);
      if (relation) {
        const [, from, operator, to, label = ""] = relation;
        for (const id of [from, to]) if (!diagram.nodes.some(node => node.id === id)) addNode(diagram, { id, label: id, shape: "rectangle", role: "generic", line: index, start: raw.indexOf(id), end: raw.indexOf(id) + id.length });
        const labelStart = label ? raw.lastIndexOf(label) : raw.length;
        addEdge(diagram, { from, to, label, line: index, start: labelStart, end: labelStart + label.length, operator }); continue;
      }
    }
    if (/^@(?:start|end)uml\b/i.test(line)) continue;
    if (family === "component" || family === "deployment" || family === "archimate") {
      if (family === "archimate" && /^!include\s+<archimate\/(?:Archimate|archimate)>\s*$/i.test(line)) continue;
      if (/^(?:!include|skinparam|left to right direction|top to bottom direction)\b/i.test(line)) diagnostic("PlantUML include/style/orientation directive is outside this editable subset", raw, index);
    }
    diagnostic(`Unsupported PlantUML ${family} syntax`, raw, index);
  }
  if (frameStack.length) throw new Error(`PlantUML ${family} has ${frameStack.length} unclosed group(s).`);
  if (!diagram.nodes.length) throw new Error(`Add at least one ${family} declaration or relationship.`);
  diagram.title = title || undefined;
  return diagram;
}

function parseHierarchy(source: string, family: "mindmap" | "wbs"): PlantDiagram {
  const lines = linesOf(source); const marker = sourceBody(lines); const diagram = emptyDiagram(family, "tree"); const stack: PlantNode[] = [];
  let rootIndent: number | undefined; let serial = 0; let seen = 0;
  for (let index = marker.start + 1; index < marker.end; index++) {
    const raw = lines[index]; const line = raw.trim(); if (!line || line.startsWith("'") || /^@(?:start|end)(?:mindmap|wbs)$/i.test(line)) continue;
    if (/^title\s+/i.test(line)) { diagram.title = line.replace(/^title\s+/i, ""); continue; }
    const match = /^([*#]+)\s+(.+)$/.exec(line);
    if (!match) {
      if (/^(?:skinparam|!include|<style>)/i.test(line)) diagnostic(`PlantUML ${family} style/include syntax is outside the editable subset`, raw, index);
      diagnostic(`Unsupported PlantUML ${family} syntax; use one star/hash per hierarchy level`, raw, index);
    }
    const depth = match[1].length - 1; const label = match[2].replace(/\s+<<[^>]+>>\s*$/, "").trim();
    if (!label) diagnostic(`PlantUML ${family} node label cannot be empty`, raw, index);
    if (rootIndent === undefined) rootIndent = depth;
    if (depth < rootIndent || depth > stack.length) diagnostic(`PlantUML ${family} indentation skips a parent level`, raw, index, raw.indexOf(match[1]));
    const parent = depth ? stack[depth - 1] : undefined; const start = raw.indexOf(label); const id = `tree-${++serial}`;
    const node = addNode(diagram, { id, label, shape: "rectangle", role: family === "wbs" ? "work-package" : "mindmap-node", line: index, start, end: start + label.length, parent: parent?.id });
    if (parent) addEdge(diagram, { from: parent.id, to: node.id, label: "", line: index, start, end: start, operator: "hierarchy" });
    stack[depth] = node; stack.length = depth + 1; seen++;
    if (seen > 500) throw new Error(`PlantUML ${family} diagrams are limited to 500 nodes.`);
  }
  if (!diagram.nodes.length) throw new Error(`Add at least one PlantUML ${family} node.`);
  return diagram;
}

function parseGantt(source: string): PlantDiagram {
  const lines = linesOf(source); const marker = sourceBody(lines); const diagram = emptyDiagram("gantt", "timeline"); const byLabel = new Map<string, PlantNode>(); const dependencies: { from: string; to: string; line: number }[] = [];
  let serial = 0; let cursorDay = 0; const durations = new Map<string, number>();
  const addTask = (name: string, line: string, index: number, start: number, duration = 1, detail = "") => {
    if (!name.trim()) diagnostic("PlantUML Gantt task name cannot be empty", line, index, start);
    const existing = byLabel.get(name); if (existing) return existing;
    const node = addNode(diagram, { id: `task-${++serial}`, label: name, shape: "rectangle", role: "task", line: index, start, end: start + name.length, time: cursorDay, duration, detail });
    byLabel.set(name, node); durations.set(name, duration); cursorDay += duration; return node;
  };
  for (let index = marker.start + 1; index < marker.end; index++) {
    const raw = lines[index]; const line = raw.trim(); if (!line || line.startsWith("'") || /^@(?:start|end)gantt$/i.test(line)) continue;
    if (/^title\s+/i.test(line)) { diagram.title = line.replace(/^title\s+/i, ""); continue; }
    if (/^(?:project starts|printscale|saturday|sunday|monday|tuesday|wednesday|thursday|friday|today|language|includes|excludes)\b/i.test(line)) continue;
    const task = /^\[([^\]]+)\]\s+(.+)$/i.exec(line);
    if (task) {
      const name = task[1].trim(); const rest = task[2].trim(); const start = raw.indexOf(task[1]);
      const durationMatch = /\blasts?\s+(\d+)\s+(?:days?|weeks?|months?)\b/i.exec(rest); const duration = durationMatch ? Math.max(1, Number(durationMatch[1])) : 1;
      const date = /\b(?:starts|happens)\s+(?:at\s+)?(\d{4}-\d{2}-\d{2})\b/i.exec(rest);
      const milestone = /^happens\b/i.test(rest); const detail = [date?.[1], durationMatch ? `${durationMatch[1]} ${durationMatch[0].match(/days?|weeks?|months?/i)?.[0] ?? "days"}` : "", milestone ? "Milestone" : ""].filter(Boolean).join(" · ");
      if (date) { const parsed = Date.parse(date[1]); if (!Number.isFinite(parsed)) diagnostic("Invalid PlantUML Gantt date", raw, index, raw.indexOf(date[1])); cursorDay = (parsed - Date.UTC(2020, 0, 1)) / 86_400_000; }
      const node = addTask(name, raw, index, start, milestone ? .35 : duration, detail);
      const refs = [...rest.matchAll(/\[([^\]]+)\]'s\s+(?:end|start)/gi)]; for (const ref of refs) if (ref[1] !== name) dependencies.push({ from: ref[1], to: name, line: index });
      if (!date && !durationMatch && !milestone && !/\b(?:after|before|at)\b/i.test(rest)) diagnostic("PlantUML Gantt task needs a supported starts/lasts/happens clause", raw, index);
      void node; continue;
    }
    diagnostic("Unsupported PlantUML Gantt syntax", raw, index);
  }
  for (const dependency of dependencies) {
    const from = byLabel.get(dependency.from); const to = byLabel.get(dependency.to);
    if (!from || !to) diagnostic(`PlantUML Gantt dependency references unknown task ${!from ? dependency.from : dependency.to}`, lines[dependency.line], dependency.line);
    addEdge(diagram, { from: from.id, to: to.id, label: "", line: dependency.line, start: 0, end: 0, operator: "dependency" });
  }
  if (!diagram.nodes.length) throw new Error("Add at least one supported PlantUML Gantt task.");
  return diagram;
}

function parseTiming(source: string): PlantDiagram {
  const lines = linesOf(source); const marker = sourceBody(lines); const diagram = emptyDiagram("timing", "timeline");
  const participants = new Map<string, { id: string; label: string; kind: string; line: number; start: number; end: number }>();
  const samples: { participant: string; state: string; time: number; line: number; start: number; end: number }[] = [];
  let previousTime = 0;
  for (let index = marker.start + 1; index < marker.end; index++) {
    const raw = lines[index]; const line = raw.trim(); if (!line || line.startsWith("'") || /^@(?:start|end)uml$/i.test(line)) continue;
    if (/^title\s+/i.test(line)) { diagram.title = line.replace(/^title\s+/i, ""); continue; }
    const declaration = /^(clock|binary|concise|robust|analog|rectangle)\s+(?:"([^"]+)"|'([^']+)'|([\w.-]+))\s+as\s+([\w.-]+)(?:\s+with\s+period\s+\d+)?\s*$/i.exec(line);
    if (declaration) {
      const label = declaration[2] ?? declaration[3] ?? declaration[4]; const id = declaration[5]; const start = raw.indexOf(label);
      if (participants.has(id)) diagnostic(`Duplicate PlantUML timing participant ${id}`, raw, index);
      participants.set(id, { id, label, kind: declaration[1].toLowerCase(), line: index, start, end: start + label.length }); continue;
    }
    const timePrefix = /^@(\+?\d+)\s+(.+)$/.exec(line);
    if (timePrefix) {
      const delta = Number(timePrefix[1].replace("+", "")); const time = timePrefix[1].startsWith("+") ? previousTime + delta : delta; previousTime = time;
      const rest = timePrefix[2]; const pattern = /([\w.-]+)\s+is\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))/g; let match: RegExpExecArray | null; let found = false;
      while ((match = pattern.exec(rest))) {
        const id = match[1]; const state = match[2] ?? match[3] ?? match[4]; const participant = participants.get(id);
        if (!participant) diagnostic(`PlantUML timing event references undeclared participant ${id}`, raw, index, raw.indexOf(id));
        const start = raw.indexOf(state, raw.indexOf(rest)); samples.push({ participant: id, state, time, line: index, start, end: start + state.length }); found = true;
      }
      if (!found) diagnostic("Unsupported PlantUML timing state row", raw, index);
      continue;
    }
    diagnostic("Unsupported PlantUML timing syntax; supported samples use `@time participant is state`", raw, index);
  }
  const ids = [...participants.keys()]; if (!ids.length || !samples.length) throw new Error("PlantUML timing diagrams need participant declarations and time samples.");
  const sortedTimes = [...new Set(samples.map(sample => sample.time))].sort((a, b) => a - b); const timeEnd = Math.max(1, sortedTimes[sortedTimes.length - 1] ?? 1) + 10;
  for (const sample of samples) {
    const next = samples.filter(other => other.participant === sample.participant && other.time > sample.time).sort((a, b) => a.time - b.time)[0];
    const duration = Math.max(.2, (next?.time ?? timeEnd) - sample.time);
    addNode(diagram, { id: `${sample.participant}:${sample.time}:${sample.line}`, label: sample.state, shape: "rectangle", role: participants.get(sample.participant)!.kind, line: sample.line, start: sample.start, end: sample.end, lane: sample.participant, time: sample.time, duration });
  }
  for (const [id, participant] of participants) diagram.frames.push({ id, label: participant.label, members: diagram.nodes.filter(node => node.lane === id).map(node => node.id), line: participant.line });
  return diagram;
}

function parseStructuredData(source: string, family: "json" | "yaml"): PlantDiagram {
  const lines = linesOf(source); const marker = sourceBody(lines); const diagram = emptyDiagram(family, "tree");
  const raw = lines.slice(marker.start + 1, marker.end).join("\n");
  let data: unknown;
  try { data = family === "json" ? JSON.parse(raw) as unknown : parseYaml(raw) as unknown; }
  catch (cause) { throw new Error(`Invalid PlantUML ${family.toUpperCase()} data: ${cause instanceof Error ? cause.message : String(cause)}`); }
  let serial = 0; let searchOffset = 0;
  const sourcePosition = (key: string) => {
    const token = family === "json" ? JSON.stringify(key) : key;
    let absolute = source.indexOf(token, searchOffset);
    if (absolute < 0) absolute = source.indexOf(token, marker.start + 1);
    if (absolute < 0) return { line: marker.start + 1, start: 0, end: 0 };
    searchOffset = absolute + token.length;
    const before = source.slice(0, absolute); const line = before.split("\n").length - 1; const start = absolute - (before.lastIndexOf("\n") + 1) + (family === "json" ? 1 : 0);
    return { line, start, end: start + key.length };
  };
  const visit = (value: unknown, key: string, parent?: string, depth = 0): PlantNode => {
    if (depth > 24) throw new Error(`PlantUML ${family.toUpperCase()} nesting is limited to 24 levels.`);
    if (serial >= 500) throw new Error(`PlantUML ${family.toUpperCase()} diagrams are limited to 500 nodes.`);
    const id = `data-${++serial}`; const span = sourcePosition(key); const isContainer = value !== null && typeof value === "object";
    const detail = !isContainer ? String(value) : Array.isArray(value) ? `Array · ${value.length} items` : `Object · ${Object.keys(value as Record<string, unknown>).length} fields`;
    const node = addNode(diagram, { id, label: key, shape: "rectangle", role: isContainer ? Array.isArray(value) ? "array" : "object" : "value", line: span.line, start: span.start, end: span.end, parent, detail });
    if (parent) addEdge(diagram, { from: parent, to: id, label: "", line: span.line, start: span.start, end: span.start, operator: "tree" });
    if (Array.isArray(value)) value.forEach((child, index) => visit(child, `[${index}]`, id, depth + 1));
    else if (value !== null && typeof value === "object") Object.entries(value as Record<string, unknown>).forEach(([childKey, child]) => visit(child, childKey, id, depth + 1));
    return node;
  };
  const rootLabel = family === "json" ? "JSON" : "YAML";
  if (data !== null && typeof data === "object") {
    const root = addNode(diagram, { id: "data-root", label: rootLabel, shape: "rectangle", role: "root", line: marker.start, start: 0, end: 0 });
    if (Array.isArray(data)) data.forEach((child, index) => visit(child, `[${index}]`, root.id, 1));
    else Object.entries(data as Record<string, unknown>).forEach(([key, child]) => visit(child, key, root.id, 1));
  } else visit(data, rootLabel);
  return diagram;
}

function parseNetwork(source: string): PlantDiagram {
  const lines = linesOf(source); const marker = sourceBody(lines); const diagram = emptyDiagram("network");
  const frames: PlantFrame[] = []; const stack: { kind: "root" | "network" | "group"; frame?: PlantFrame; network?: string }[] = [{ kind: "root" }];
  const nodeByName = new Map<string, PlantNode>(); const peerEdges: { from: string; to: string; line: number; start: number; end: number }[] = []; let serial = 0;
  const active = () => stack[stack.length - 1];
  for (let index = marker.start + 1; index < marker.end; index++) {
    const raw = lines[index]; const line = raw.trim(); if (!line || line.startsWith("//") || line.startsWith("'") || /^@(?:start|end)nwdiag$/i.test(line)) continue;
    if (/^nwdiag\s*\{$/i.test(line)) { stack.push({ kind: "root" }); continue; }
    if (/^network(?:\s+([\w.-]+))?\s*\{$/i.test(line)) {
      const match = /^network(?:\s+([\w.-]+))?\s*\{$/i.exec(line)!; const label = match[1] ?? `Network ${frames.length + 1}`;
      const frame: PlantFrame = { id: `network-${++serial}`, label, members: [], line: index }; frames.push(frame); stack.push({ kind: "network", frame, network: frame.id }); continue;
    }
    if (/^group(?:\s+([\w.-]+))?\s*\{$/i.test(line)) {
      const match = /^group(?:\s+([\w.-]+))?\s*\{$/i.exec(line)!; const label = match[1] ?? `Group ${frames.length + 1}`;
      const frame: PlantFrame = { id: `network-group-${++serial}`, label, members: [], line: index }; frames.push(frame); stack.push({ kind: "group", frame, network: active().network }); continue;
    }
    if (/^\}$/.test(line)) { if (stack.length === 1) diagnostic("Unexpected PlantUML network brace", raw, index); stack.pop(); continue; }
    if (/^(?:title|caption|header|footer)\s+/i.test(line)) { if (/^title\s+/i.test(line)) diagram.title = line.replace(/^title\s+/i, ""); continue; }
    if (/^(?:width\s*=\s*full|color\s*=|description\s*=)/i.test(line)) continue;
    if (/^address\s*=\s*(?:"([^"]*)"|'([^']*)'|([^;]+))\s*;?$/i.test(line)) {
      const match = /^address\s*=\s*(?:"([^"]*)"|'([^']*)'|([^;]+))\s*;?$/i.exec(line)!; if (active().frame) active().frame!.label += ` · ${match[1] ?? match[2] ?? match[3].trim()}`; continue;
    }
    const peer = /^([\w.-]+)\s*(--|-->|-\[.+\]->)\s*([\w.-]+)\s*;?$/.exec(line);
    if (peer) {
      const start = raw.indexOf(peer[1]); const end = raw.indexOf(peer[3], start + peer[1].length) + peer[3].length;
      for (const name of [peer[1], peer[3]]) if (!nodeByName.has(name)) nodeByName.set(name, addNode(diagram, { id: name, label: name, shape: "rectangle", role: "device", line: index, start: raw.indexOf(name), end: raw.indexOf(name) + name.length }));
      peerEdges.push({ from: peer[1], to: peer[3], line: index, start, end }); continue;
    }
    const host = /^([\w.-]+)(?:\s*\[([^\]]*)\])?\s*;?$/.exec(line);
    if (host) {
      const name = host[1]; const attributes = host[2] ?? ""; const address = /\baddress\s*=\s*(?:"([^"]*)"|'([^']*)'|([^,]+))/i.exec(attributes); const shape = /\bshape\s*=\s*([\w-]+)/i.exec(attributes)?.[1]; const description = /\bdescription\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attributes);
      const network = active().network; const visualId = network ? `${network}:${name}` : name; const labelStart = raw.indexOf(name);
      const node = addNode(diagram, { id: visualId, sourceId: name, label: name, shape: "rectangle", role: shape ?? "device", line: index, start: labelStart, end: labelStart + name.length, parent: active().frame?.id, detail: [address?.[1] ?? address?.[2] ?? address?.[3]?.trim(), description?.[1] ?? description?.[2]].filter(Boolean).join(" · ") });
      for (const block of stack) if (block.frame && !block.frame.members.includes(node.id)) block.frame.members.push(node.id);
      if (!nodeByName.has(name)) nodeByName.set(name, node);
      continue;
    }
    diagnostic("Unsupported PlantUML network syntax; supported rows declare networks, hosts, addresses, shapes, and peer links", raw, index);
  }
  if (stack.length > 1) throw new Error(`PlantUML network diagram has ${stack.length - 1} unclosed network/group block(s).`);
  for (const edge of peerEdges) addEdge(diagram, { from: nodeByName.get(edge.from)!.id, to: nodeByName.get(edge.to)!.id, label: "", line: edge.line, start: edge.start, end: edge.end, operator: "--" });
  if (!diagram.nodes.length) throw new Error("Add at least one PlantUML network or host.");
  diagram.frames.push(...frames);
  return diagram;
}



const PLANT_CAPABILITIES: Record<PlantUmlFamily, { family: string; supported: string; knownLimits: string }> = {
  activity: { family: "Activity diagram", supported: "Actions, start and stop, if/else, while loops, fork/join, partitions, and labeled branches.", knownLimits: "Repeat, switch, elseif, styling, and unsupported activity syntax are rejected." },
  state: { family: "State diagram", supported: "States, initial/final markers, labeled transitions, descriptions, and simple composite states.", knownLimits: "Regions, pseudostates beyond initial/final, directives, and styling are rejected." },
  usecase: { family: "Use case diagram", supported: "Actors, use cases, aliases, boundaries, and common relationships.", knownLimits: "Advanced relationship and styling directives are rejected." },
  component: { family: "Component diagram", supported: "Common components, interfaces, databases, packages, folders, queues, artifacts, actors, and relationships.", knownLimits: "Ports, lollipops, advanced nesting, styles, and includes are outside the subset." },
  deployment: { family: "Deployment diagram", supported: "Nodes, clouds, databases, artifacts, components, relationships, and simple nested containers.", knownLimits: "Deployment stereotypes, ports, styling, includes, and orientation directives are rejected." },
  timing: { family: "Timing diagram", supported: "Clock, binary, concise, robust, analog, and rectangle participants with absolute or relative time samples.", knownLimits: "Waveform configuration, constraints, and advanced timing syntax are rejected." },
  mindmap: { family: "Mind map", supported: "Star-indented labels, title, and nested editable nodes.", knownLimits: "Icons, colors, Markdown, side placement, and node styling are rejected." },
  wbs: { family: "Work breakdown structure", supported: "Hash-indented work packages and nested hierarchy.", knownLimits: "Styling, numbering directives, links, and scheduling semantics are not modeled." },
  gantt: { family: "Gantt chart", supported: "Tasks with supported start dates, durations, milestones, and start/end task dependencies.", knownLimits: "Working calendars, exclusions, resources, styling, and complex date expressions are outside the subset." },
  network: { family: "Network diagram", supported: "nwdiag networks, groups, hosts, addresses, shape hints, descriptions, and peer links.", knownLimits: "Styles, ports, routing semantics, and advanced attributes are rejected or omitted." },
  json: { family: "JSON diagram", supported: "JSON objects, arrays, scalar values, and nested keys as editable tree nodes.", knownLimits: "Original source is retained; editing scalar values is not currently mapped back." },
  yaml: { family: "YAML diagram", supported: "YAML mappings, sequences, scalar values, and nested keys as editable tree nodes.", knownLimits: "Original source is retained; aliases, tags, and scalar-value editing are outside the editable subset." },
  archimate: { family: "ArchiMate diagram", supported: "Common ArchiMate element declarations and relationships as editable nodes and connectors.", knownLimits: "Views, viewpoints, properties, and visualization directives are outside the source subset." },
};

export function plantUmlCapabilitySummary(source: string) {
  const family = detectPlantUmlFamily(source);
  if (!family) {
    if (/^\s*(?:abstract\s+)?(?:class|interface|enum|entity)\s+/im.test(source)) return { family: "Class diagram", supported: "Classes, interfaces, enumerations, members, relationship operators, labels, and cardinalities.", knownLimits: "Unsupported directives and advanced annotations are rejected; generated canvas geometry is not exported." };
    if (/^\s*(?:participant|boundary|control|entity|database|collections|queue)\s+/im.test(source) || /^\s*[A-Za-z_]\w*\s+(?:-->>|->>|-->|->|<--|<-)\s+[A-Za-z_]\w*\s*:/m.test(source)) return { family: "Sequence diagram", supported: "Participants, actors, aliases, common synchronous/asynchronous message arrows, and message labels.", knownLimits: "Self-messages, activation bars, notes, fragments, and advanced directives are outside the editable subset." };
    return undefined;
  }
  const capability = PLANT_CAPABILITIES[family];
  return { ...capability, knownLimits: capability.knownLimits + " Only mapped text labels patch into the retained source; added/deleted objects and free canvas positions are not serialized." };
}

function parsePlantDiagram(source: string, family: PlantUmlFamily): PlantDiagram {
  if (family === "activity") {
    const lines = linesOf(source); const marker = sourceBody(lines);
    return parseActivity(lines, marker.start, marker.end);
  }
  if (["state", "usecase", "component", "deployment", "archimate"].includes(family)) return parseGraphFamily(source, family as "state" | "usecase" | "component" | "deployment" | "archimate");
  if (family === "mindmap" || family === "wbs") return parseHierarchy(source, family);
  if (family === "gantt") return parseGantt(source);
  if (family === "timing") return parseTiming(source);
  if (family === "network") return parseNetwork(source);
  return parseStructuredData(source, family as "json" | "yaml");
}

function plantRole(kind: "node" | "edge" | "frame", family: PlantUmlFamily, line: number, start: number, end: number, original: string, id: string, operator?: string) {
  const metadata: PlantRole = { family, line, start, end, original, id, ...(operator ? { operator } : {}) };
  return rolePrefix(family, kind) + encode(metadata);
}

function readPlantRole(role?: string): PlantRole | undefined {
  if (!role) return undefined;
  const prefix = role.match(/^plantuml-[\w-]+-(?:node|edge|frame):/);
  if (!prefix) return undefined;
  try { return decode<PlantRole>(role.slice(prefix[0].length)); } catch { return undefined; }
}

function plantLabel(text: string, color: string, fontSize = 13, bold = false) {
  return { text, color, fontSize, fontFamily: "sans" as const, bold, italic: false, underline: false, textAlign: "center" as const, listType: "none" as const, verticalAlign: "middle" as const };
}

function layoutPlantDiagram(diagram: PlantDiagram): Element[] {
  const nodes = diagram.nodes; const edges = diagram.edges; const family = diagram.family;
  if (nodes.length > 500 || edges.length > 1000) throw new Error("PlantUML diagrams are limited to 500 nodes and 1,000 relationships.");
  const boundsByNode = new Map<string, { x: number; y: number; w: number; h: number }>();
  const idByNode = new Map(nodes.map((node, index) => [node.id, "plantuml-" + family + "-" + safeId(node.id, "node") + "-" + (index + 1)]));
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const width = (node: PlantNode) => Math.max(110, Math.min(260, 46 + Math.max(...node.label.split(/\r?\n/).map(part => part.length), 8) * 7));
  const height = (node: PlantNode) => Math.max(48, 26 + node.label.split(/\r?\n/).length * 18 + (node.detail ? 18 : 0));
  const x0 = 64; const y0 = 56; const gapY = 54;
  if (diagram.mode === "tree") {
    const depth = (node: PlantNode) => { let value = 0; let parent = node.parent; const guard = new Set<string>(); while (parent && !guard.has(parent)) { guard.add(parent); value++; parent = nodeById.get(parent)?.parent; } return value; };
    const counters = new Map<number, number>();
    for (const node of nodes) {
      const level = depth(node); const row = counters.get(level) ?? 0; counters.set(level, row + 1);
      boundsByNode.set(node.id, { x: x0 + level * 315, y: y0 + row * (height(node) + 28), w: width(node), h: height(node) });
    }
  } else if (diagram.mode === "timeline") {
    const lanes = [...new Set(nodes.map(node => node.lane ?? "Tasks"))]; const minTime = Math.min(0, ...nodes.map(node => node.time ?? 0));
    nodes.forEach((node, index) => {
      const lane = lanes.indexOf(node.lane ?? "Tasks"); const x = x0 + Math.max(0, (node.time ?? index * 2) - minTime) * 30;
      boundsByNode.set(node.id, { x, y: y0 + Math.max(0, lane) * 120, w: Math.max(86, Math.min(300, (node.duration ?? 2) * 30)), h: height(node) });
    });
  } else if (diagram.mode === "activity") {
    nodes.forEach((node, index) => {
      const incoming = edges.find(edge => edge.to === node.id);
      const parentIndex = incoming ? nodes.findIndex(item => item.id === incoming.from) : -1;
      const x = x0 + (parentIndex >= 0 && Math.abs(index - parentIndex) > 1 ? 180 : (index % 2) * 180);
      boundsByNode.set(node.id, { x, y: y0 + index * 90, w: width(node), h: height(node) });
    });
  } else {
    const counts = new Map<string, number>();
    nodes.forEach((node, index) => {
      const lane = node.lane ?? ""; const row = counts.get(lane) ?? 0; counts.set(lane, row + 1);
      boundsByNode.set(node.id, { x: x0 + (lane ? [...new Set(nodes.map(item => item.lane ?? ""))].indexOf(lane) * 340 : (index % 3) * 340), y: y0 + row * (height(node) + gapY), w: width(node), h: height(node) });
    });
  }
  const output: Element[] = [];
  for (const frame of diagram.frames) {
    const members = frame.members.map(id => boundsByNode.get(id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (!members.length) continue;
    const left = Math.min(...members.map(item => item.x)) - 16; const top = Math.min(...members.map(item => item.y)) - 36;
    const right = Math.max(...members.map(item => item.x + item.w)) + 16; const bottom = Math.max(...members.map(item => item.y + item.h)) + 16;
    output.push({ type: "rectangle", id: "plantuml-" + family + "-frame-" + safeId(frame.id, "frame"), componentRole: plantRole("frame", family, frame.line, frame.start ?? 0, frame.end ?? 0, frame.label, frame.id), x: left, y: top, w: right - left, h: bottom - top, color: "#7e8c9a", thickness: 1, fillOpacity: 0, lineStyle: "dashed", label: plantLabel(frame.label, "#516273", 12, true) });
  }
  for (const edge of edges) {
    const a = boundsByNode.get(edge.from); const b = boundsByNode.get(edge.to); if (!a || !b) continue;
    const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }; const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const horizontal = Math.abs(bc.x - ac.x) >= Math.abs(bc.y - ac.y);
    const startAnchor = horizontal ? { x: bc.x >= ac.x ? 1 : 0, y: 0.5 } : { x: 0.5, y: bc.y >= ac.y ? 1 : 0 };
    const endAnchor = horizontal ? { x: bc.x >= ac.x ? 0 : 1, y: 0.5 } : { x: 0.5, y: bc.y >= ac.y ? 0 : 1 };
    const x = a.x + a.w * startAnchor.x; const y = a.y + a.h * startAnchor.y; const endX = b.x + b.w * endAnchor.x; const endY = b.y + b.h * endAnchor.y;
    const inheritance = /<\|--|--\|>/.test(edge.operator); const composition = edge.operator.includes("*"); const aggregation = edge.operator.includes("o");
    output.push({ type: "arrow", id: "plantuml-" + family + "-edge-" + output.length, componentRole: plantRole("edge", family, edge.line, edge.start, edge.end, edge.label, edge.from + "->" + edge.to, edge.operator), x, y, w: endX - x, h: endY - y, color: "#617f97", thickness: 1.6, lineStyle: /\.\./.test(edge.operator) ? "dashed" : "solid", lineRoute: "elbow", startHead: inheritance ? "hollow" : composition ? "diamond" : aggregation ? "open-diamond" : "none", endHead: inheritance ? "none" : edge.operator.includes(">") || family === "activity" || family === "state" || family === "gantt" ? "solid" : "none", startBinding: { elementId: idByNode.get(edge.from)!, anchor: startAnchor }, endBinding: { elementId: idByNode.get(edge.to)!, anchor: endAnchor }, ...(edge.label ? { label: plantLabel(edge.label, "#43566a", 11) } : {}) });
  }
  for (const node of nodes) {
    const box = boundsByNode.get(node.id)!; const id = idByNode.get(node.id)!; const terminal = ["start", "stop", "initial", "final"].includes(node.role); const circle = node.shape === "circle"; const diamond = node.shape === "diamond";
    const shape: ShapeElement = { type: circle ? "circle" : diamond ? "diamond" : "rectangle", id, componentRole: plantRole("node", family, node.line, node.start, node.end, node.label, node.sourceId ?? node.id), x: box.x, y: box.y, w: box.w, h: box.h, color: "#53687c", thickness: 1.5, fillColor: terminal ? "#53687c" : "#f7f9fb", fillOpacity: 1, ...(node.role === "decision" ? { flowchartShape: "decision" as const } : {}), label: plantLabel(node.label, terminal ? "#ffffff" : "#273746", 13, ["start", "stop", "decision", "state", "actor", "usecase", "task", "work-package"].includes(node.role)) };
    output.push(shape);
    if (node.detail) output.push({ type: "text", id: id + "-detail", componentRole: shape.componentRole + ":detail", x: box.x + 7, y: box.y + box.h - 18, text: node.detail, color: "#526170", fontSize: 10, wrapWidth: box.w - 14 });
  }
  if (!output.length) throw new Error("PlantUML parser produced no editable elements.");
  return output;
}

export function plantUmlAdvancedToDiagram(source: string): Element[] {
  if (source.length > 100000) throw new Error("PlantUML input is limited to 100,000 characters.");
  const family = detectPlantUmlFamily(source);
  if (!family) throw new Error("PlantUML syntax is outside the supported editable families.");
  const marker = sourceBody(linesOf(source));
  const markerName = marker.startType ?? "";
  if (markerName !== "uml" && markerName !== family && !(markerName === "nwdiag" && family === "network")) throw new Error("PlantUML start/end markers do not match the selected diagram family.");
  return layoutPlantDiagram(parsePlantDiagram(source, family));
}

export function exportPlantUmlAdvanced(elements: Element[]): string | undefined {
  if (elements.length !== 1 || elements[0].type !== "group" || elements[0].mermaid?.format !== "plantuml") return undefined;
  const group = elements[0] as GroupElement; const metadata = group.mermaid;
  if (!metadata) return undefined;
  const family = metadata.diagramType as PlantUmlFamily | undefined;
  if (!family || !Object.prototype.hasOwnProperty.call(PLANT_CAPABILITIES, family)) return undefined;
  const lines = linesOf(metadata.source);
  const patches: { line: number; start: number; end: number; value: string; original: string }[] = [];
  const collect = (items: Element[]) => items.forEach(item => {
    if (item.type === "group") return collect(item.elements);
    if (item.componentRole?.includes("-frame:")) return;
    if (item.componentRole?.endsWith(":detail")) return;
    const meta = readPlantRole(item.componentRole);
    if (!meta || meta.family !== family || meta.line < 0 || meta.line >= lines.length || meta.start < 0 || meta.end < meta.start) return;
    const value = item.type === "text" ? item.text : item.type === "arrow" || item.type === "line" ? item.label?.text ?? "" : "label" in item ? item.label?.text ?? "" : "";
    if (value === meta.original) return;
    let escaped = value;
    if (family === "json") escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    else if (family === "yaml") escaped = value.replace(/'/g, "''");
    else escaped = value.replace(/([\\;])/g, "\\$1");
    patches.push({ line: meta.line, start: meta.start, end: meta.end, value: escaped, original: meta.original });
  });
  collect(group.elements);
  const byLine = new Map<number, typeof patches>();
  for (const patch of patches) byLine.set(patch.line, [...(byLine.get(patch.line) ?? []), patch]);
  for (const [lineNumber, edits] of byLine) {
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      if (lines[lineNumber].slice(edit.start, edit.end) !== edit.original) continue;
      lines[lineNumber] = lines[lineNumber].slice(0, edit.start) + edit.value + lines[lineNumber].slice(edit.end);
    }
  }
  return lines.join("\n") + "\n";
}
