import type { Element, Point, ShapeElement } from "../../model";

export type ExtendedMermaidType = "class" | "er" | "state" | "journey" | "gantt" | "c4";
type Node = { id: string; label: string; shape: "rectangle" | "rounded" | "diamond" | "circle"; role?: string };
type Edge = { from: string; to: string; label: string; relation?: string };
type Graph = { nodes: Node[]; edges: Edge[]; title?: string; sections?: string[] };

export function detectExtendedMermaidType(source: string): ExtendedMermaidType | undefined {
  const first = source.replace(/^\s*%%.*$/gm, "").trim().split(/\r?\n/)[0] ?? "";
  if (/^classDiagram\b/i.test(first)) return "class";
  if (/^erDiagram\b/i.test(first)) return "er";
  if (/^stateDiagram(?:-v2)?\b/i.test(first)) return "state";
  if (/^journey\b/i.test(first)) return "journey";
  if (/^gantt\b/i.test(first)) return "gantt";
  if (/^C4(?:Context|Container|Component|Dynamic|Deployment)\b/i.test(first)) return "c4";
  return undefined;
}

function parseArgs(source: string): string[] {
  const args: string[] = []; let current = ""; let quote = ""; let escaped = false;
  for (const char of source) {
    if (escaped) { current += char; escaped = false; continue; }
    if (char === "\\" && quote) { current += char; escaped = true; continue; }
    if ((char === "'" || char === '"') && (!quote || quote === char)) { quote = quote ? "" : char; current += char; continue; }
    if (char === "," && !quote) { args.push(current.trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_match, double, single) => double ?? single)); current = ""; }
    else current += char;
  }
  if (current.trim()) args.push(current.trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_match, double, single) => double ?? single));
  return args;
}

function parseGraph(source: string, type: ExtendedMermaidType): Graph {
  const nodes = new Map<string, Node>(); const edges: Edge[] = []; const fields = new Map<string, string[]>();
  let activeClass = ""; let title = ""; let section = ""; const sections: string[] = [];
  const get = (id: string, label = id, shape: Node["shape"] = "rectangle", role?: string) => {
    const key = id.replace(/[^\w.-]/g, "_").slice(0, 80) || `node_${nodes.size + 1}`;
    const previous = nodes.get(key);
    if (!previous || label !== key) nodes.set(key, { id: key, label: label || key, shape, ...(role ? { role } : previous?.role ? { role: previous.role } : {}) });
    return key;
  };
  for (const raw of source.replace(/\r/g, "").split("\n")) {
    const line = raw.replace(/%%.*$/, "").trim(); if (!line) continue;
    if (/^(?:classDiagram|erDiagram|stateDiagram(?:-v2)?|C4(?:Context|Container|Component|Dynamic|Deployment))\b/i.test(line)) continue;
    if (/^direction\s+/i.test(line) || /^layout\s+/i.test(line) || /^dateFormat\s+/i.test(line) || /^axisFormat\s+/i.test(line) || /^tickInterval\s+/i.test(line) || /^excludes\s+/i.test(line) || /^includes\s+/i.test(line) || /^todayMarker\s+/i.test(line)) continue;
    if (/^title\s+/i.test(line)) { title = line.replace(/^title\s+/i, "").replace(/^(["'])(.*)\1$/, "$2"); continue; }
    const sectionMatch = /^section\s+(.+)$/i.exec(line); if (sectionMatch) { section = sectionMatch[1].trim(); sections.push(section); activeClass = ""; continue; }
    if (line === "}" || /^end\s*$/i.test(line)) { activeClass = ""; continue; }

    if (type === "class") {
      const block = /^class\s+([\w.]+)(?:\s*\[\s*([\s\S]*?)\s*\])?\s*\{?$/.exec(line);
      if (block) { activeClass = get(block[1], block[2] || block[1]); fields.set(activeClass, fields.get(activeClass) ?? []); continue; }
      const rel = /^([\w.]+)\s+(<\|--|--\|>|<\.\.\||\.\.\|>|<\.\.>|\.\.>|\*--|o--|--|\.\.|-->)\s+([\w.]+)(?:\s*:\s*(.*))?$/.exec(line);
      if (rel) { const from = get(rel[1]); const to = get(rel[3]); edges.push({ from, to, label: (rel[4] ?? "").trim(), relation: rel[2] }); continue; }
      const member = /^(?:([\w.]+)\s*:\s*)?([+\-#~]?\s*[^:()]+(?:\([^)]*\))?(?:\s*:\s*[^:]+)?)$/.exec(line);
      if (activeClass && member) { fields.set(activeClass, [...(fields.get(activeClass) ?? []), member[2].trim()].slice(0, 24)); continue; }
      const alias = /^class\s+([\w.]+)\s+as\s+([\w.]+)$/i.exec(line); if (alias) { get(alias[1], alias[2]); continue; }
      if (/^(?:hide|show|note\b|namespace\b|click\b|callback\b|link\b|style\b|classDef\b)/i.test(line)) continue;
      throw new Error(`Unsupported Mermaid class syntax: ${line}`);
    }

    if (type === "er") {
      const entityBlock = /^([\w.]+)\s*\{$/.exec(line);
      if (entityBlock) { activeClass = get(entityBlock[1]); fields.set(activeClass, fields.get(activeClass) ?? []); continue; }
      if (activeClass) { const field = /^([\w.]+)\s+([\w.]+)(?:\s+([\w, ]+))?$/.exec(line); if (field) { const flags = field[3] ? ` ${field[3].replace(/\s+/g, " ").trim()}` : ""; fields.set(activeClass, [...(fields.get(activeClass) ?? []), `${field[2]}: ${field[1]}${flags}`].slice(0, 32)); continue; } }
      const relation = /^([\w.]+)\s+([|o}{]+--[|o}{]+)\s+([\w.]+)(?:\s*:\s*(.+))?$/.exec(line);
      if (relation) { const from = get(relation[1]); const to = get(relation[3]); edges.push({ from, to, label: (relation[4] ?? "").replace(/^['"]|['"]$/g, ""), relation: relation[2] }); continue; }
      throw new Error(`Unsupported Mermaid ER syntax: ${line}`);
    }

    if (type === "state") {
      const stateAlias = /^state\s+["'](.+?)["']\s+as\s+([\w.]+)$/.exec(line); if (stateAlias) { get(stateAlias[2], stateAlias[1], "rounded"); continue; }
      const stateLabel = /^state\s+([\w.]+)\s*:\s*(.+)$/.exec(line); if (stateLabel) { get(stateLabel[1], `${stateLabel[1]}\n${stateLabel[2]}`, "rounded"); continue; }
      const transition = /^([^\s]+)\s+(-{1,2}>|-->)\s+([^\s:]+)(?:\s*:\s*(.+))?$/.exec(line);
      if (transition) {
        const id = (value: string) => value === "[*]" ? "__initial__" : value;
        const from = id(transition[1]); const to = id(transition[3]);
        get(from, from === "__initial__" ? "Start" : from, from === "__initial__" ? "circle" : "rounded");
        get(to, to === "__initial__" ? "Start" : to, to === "__initial__" ? "circle" : "rounded");
        edges.push({ from, to, label: (transition[4] ?? "").trim() }); continue;
      }
      if (/^(?:note\b|direction\b|classDef\b)/i.test(line)) continue;
      throw new Error(`Unsupported Mermaid state syntax: ${line}`);
    }

    if (type === "c4") {
      const declaration = /^(Person|Person_Ext|System|System_Ext|SystemDb|SystemDb_Ext|Container|ContainerDb|Container_Ext|ContainerDb_Ext|Component|ComponentDb|Component_Ext|ComponentDb_Ext|System_Boundary|Container_Boundary|Boundary)\s*\((.*)\)\s*\{?$/.exec(line);
      if (declaration) { const [id, ...attributes] = parseArgs(declaration[2]); const kind = declaration[1]; const role = `mermaid-c4:${kind}`; get(id ?? `c4_${nodes.size}`, attributes.filter(Boolean).join("\n") || kind, /Person/.test(kind) ? "circle" : /Boundary/.test(kind) ? "rounded" : "rectangle", role); if (/Boundary/.test(kind)) activeClass = id; continue; }
      const rel = /^Rel(?:_Back|_Up|_Down|_Left|_Right|_Neighbor)?\s*\((.*)\)$/.exec(line);
      if (rel) { const [fromRaw, toRaw, label, technology] = parseArgs(rel[1]); if (!fromRaw || !toRaw) throw new Error(`C4 relationship needs source and destination: ${line}`); const from = get(fromRaw); const to = get(toRaw); edges.push({ from, to, label: [label, technology].filter(Boolean).join(" · ") }); continue; }
      if (line === "}" || /^UpdateLayoutConfig\s*\(/i.test(line)) continue;
      throw new Error(`Unsupported Mermaid C4 syntax: ${line}`);
    }

    if (type === "journey") {
      const task = /^(.+?):\s*([1-5])\s*:\s*(.+)$/.exec(line);
      if (task) { const key = `journey_${nodes.size + 1}`; get(key, `${task[1].trim()}\n${task[3].trim()} / ${task[2]}/5`, "rounded", `mermaid-journey:${task[2]}:${encodeURIComponent(task[3].trim())}:${encodeURIComponent(section || "Journey")}`); continue; }
      if (/^(?:title\s|section\s|accTitle\s|accDescr\s)/i.test(line)) continue;
      throw new Error(`Unsupported Mermaid journey syntax: ${line}`);
    }

    if (type === "gantt") {
      const task = /^(.+?)\s*:\s*(.*)$/.exec(line);
      if (task) {
        const values = task[2].split(",").map(value => value.trim()).filter(Boolean);
        const idValue = values.find(value => /^[\w.-]+$/.test(value) && !/^(active|done|crit|milestone|after|until)$/.test(value) && !/^\d{4}-\d{2}-\d{2}$/.test(value));
        const duration = values.find(value => /^\d+(?:\.\d+)?\s*(?:d|w|h|m)$/i.test(value));
        const start = values.find(value => /^\d{4}-\d{2}-\d{2}$/.test(value)) ?? "";
        const key = idValue ?? `gantt_${nodes.size + 1}`; const label = task[1].trim();
        get(key, label, "rectangle", `mermaid-gantt:${encodeURIComponent(duration ?? "1d")}:${encodeURIComponent(section || "Tasks")}:${encodeURIComponent(start)}`);
        for (const dependency of values.filter(value => /^after\s+/i.test(value)).flatMap(value => value.replace(/^after\s+/i, "").split(/\s+/)).filter(Boolean)) {
          const from = get(dependency); edges.push({ from, to: key, label: "", relation: "gantt-after" });
        }
        continue;
      }
      if (/^(?:title\s|dateFormat\s|axisFormat\s|tickInterval\s|excludes\s|includes\s|todayMarker\s|accTitle\s|accDescr\s)/i.test(line)) continue;
      throw new Error(`Unsupported Mermaid Gantt syntax: ${line}`);
    }
  }
  if (!nodes.size) throw new Error(`The ${type} diagram has no supported elements.`);
  if (nodes.size > 300 || edges.length > 500) throw new Error("Mermaid diagrams are limited to 300 objects and 500 relationships.");
  for (const [id, members] of fields) { const node = nodes.get(id); if (node) node.label = [node.label, ...members].join("\n"); }
  return { nodes: [...nodes.values()], edges, ...(title ? { title } : {}), ...(sections.length ? { sections } : {}) };
}

function boxShape(node: Node, x: number, y: number, width: number, height: number): ShapeElement {
  const color = node.role?.startsWith("mermaid-c4:Person") ? "#6e83bf" : node.role?.startsWith("mermaid-c4:") ? "#668e82" : "#627f9a";
  return { type: node.shape === "circle" ? "circle" : node.shape === "diamond" ? "diamond" : "rectangle", id: `mermaid-node:${node.id}`, componentRole: node.role, x, y, w: width, h: height, color, thickness: 1.5, fillColor: node.role?.startsWith("mermaid-c4:") ? "#eef7f4" : "#f4f7fa", fillOpacity: 1, edgeStyle: node.shape === "rounded" ? "rounded" : "sharp", cornerRadius: node.shape === "rounded" ? 12 : undefined, label: { text: node.label, color: "#30465a", fontSize: 12, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } };
}

function graphLayout(graph: Graph, center: Point, type: ExtendedMermaidType): Element[] {
  const incoming = new Map(graph.nodes.map(node => [node.id, 0])); const outgoing = new Map(graph.nodes.map(node => [node.id, [] as string[]]));
  for (const edge of graph.edges) { incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1); outgoing.get(edge.from)?.push(edge.to); }
  const rank = new Map(graph.nodes.map(node => [node.id, 0])); const degree = new Map(incoming); const queue = graph.nodes.filter(node => !degree.get(node.id));
  for (let index = 0; index < queue.length; index++) for (const target of outgoing.get(queue[index].id) ?? []) { rank.set(target, Math.max(rank.get(target) ?? 0, (rank.get(queue[index].id) ?? 0) + 1)); degree.set(target, (degree.get(target) ?? 1) - 1); if (!degree.get(target)) queue.push(graph.nodes.find(node => node.id === target)!); }
  const levels = new Map<number, Node[]>(); graph.nodes.forEach(node => { const level = rank.get(node.id) ?? 0; levels.set(level, [...(levels.get(level) ?? []), node]); });
  const maxRank = Math.max(...levels.keys()); const positions = new Map<string, ShapeElement>(); const horizontal = type === "class" || type === "c4";
  for (const [level, members] of levels) members.forEach((node, index) => {
    const width = node.shape === "circle" ? 116 : 218; const height = node.shape === "circle" ? 96 : Math.max(78, Math.min(190, 48 + node.label.split("\n").length * 18));
    const major = (level - maxRank / 2) * 300; const minor = (index - (members.length - 1) / 2) * 166;
    const x = center.x + (horizontal ? major : minor) - width / 2; const y = center.y + (horizontal ? minor : major) - height / 2;
    positions.set(node.id, boxShape(node, x, y, width, height));
  });
  const links: ShapeElement[] = graph.edges.flatMap((edge, index) => {
    const from = positions.get(edge.from); const to = positions.get(edge.to); if (!from || !to) return [];
    const forward = (rank.get(edge.from) ?? 0) <= (rank.get(edge.to) ?? 0); const anchor = { x: horizontal ? forward ? 1 : 0 : .5, y: horizontal ? .5 : forward ? 1 : 0 }; const endAnchor = { x: horizontal ? forward ? 0 : 1 : .5, y: horizontal ? .5 : forward ? 0 : 1 };
    const start = { x: from.x + from.w * anchor.x, y: from.y + from.h * anchor.y }; const end = { x: to.x + to.w * endAnchor.x, y: to.y + to.h * endAnchor.y };
    const relation = edge.relation ?? "";
    const composition = relation.includes("*"); const aggregation = relation.includes("o"); const inherit = relation.includes("<|") || relation.includes("|>");
    const startHead = type === "class" ? relation.startsWith("<|") || relation.startsWith("<..|") ? "hollow" : relation.startsWith("*") ? "diamond" : relation.startsWith("o") ? "open-diamond" : "none" : "none";
    const endHead = type === "class" ? relation.startsWith("--|>") || relation.startsWith("..|>") ? "hollow" : relation.startsWith("-->") || relation.startsWith("..>") ? "solid" : relation.startsWith("--*") ? "diamond" : relation.startsWith("--o") ? "open-diamond" : "none" : composition ? "diamond" : aggregation ? "open-diamond" : inherit ? "hollow" : "solid";
    return [{ type: "line", id: `mermaid-link:${index}`, componentRole: relation ? `mermaid-relation:${encodeURIComponent(relation)}` : undefined, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color: "#71869b", thickness: 1.6, startHead, endHead, lineStyle: relation.includes(".") ? "dashed" : "solid", startBinding: { elementId: from.id!, anchor }, endBinding: { elementId: to.id!, anchor: endAnchor }, ...(edge.label ? { label: { text: edge.label, color: "#52697e", fontSize: 11, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" } } : {}) } as ShapeElement];
  });
  return [...positions.values(), ...links];
}

function timelineLayout(graph: Graph, center: Point, type: "journey" | "gantt"): Element[] {
  const rows: Element[] = []; const positions = new Map<string, ShapeElement>(); const nodes = graph.nodes; const rowHeight = type === "journey" ? 88 : 54; const left = center.x - 430; const top = center.y - Math.max(160, nodes.length * rowHeight / 2);
  if (graph.title) rows.push({ type: "text", id: "mermaid-title", x: left, y: top - 42, text: graph.title, color: "#34495e", fontSize: 18, bold: true, fontFamily: "sans", textAlign: "left", listType: "none" });
  const dependencyRank = new Map(nodes.map(node => [node.id, 0]));
  for (let pass = 0; pass < nodes.length; pass++) for (const edge of graph.edges) dependencyRank.set(edge.to, Math.max(dependencyRank.get(edge.to) ?? 0, (dependencyRank.get(edge.from) ?? 0) + 1));
  const startDates = nodes.flatMap(node => { const match = /^mermaid-gantt:([^:]+):([^:]+):([^:]+)$/.exec(node.role ?? ""); if (!match?.[3]) return []; const time = Date.parse(decodePart(match[3])); return Number.isFinite(time) ? [time] : []; });
  const firstStart = startDates.length ? Math.min(...startDates) : undefined;
  nodes.forEach((node, index) => {
    const role = node.role ?? ""; const match = /^mermaid-gantt:([^:]+):([^:]+):([^:]+)$/.exec(role); const legacyMatch = /^mermaid-gantt:([^:]+):/.exec(role); const duration = match ? decodePart(match[1]) : legacyMatch?.[1] ?? "1d"; const count = Number.parseFloat(duration) || 1; const multiplier = /w$/i.test(duration) ? 5 : /h$/i.test(duration) ? .1 : /m$/i.test(duration) ? .02 : 1;
    const date = match?.[3] ? Date.parse(decodePart(match[3])) : Number.NaN; const dateOffset = firstStart !== undefined && Number.isFinite(date) ? (date - firstStart) / 86_400_000 : (dependencyRank.get(node.id) ?? 0) * 3.5;
    const width = type === "journey" ? 186 : Math.max(96, Math.min(430, count * multiplier * 48)); const x = type === "journey" ? left + (index % 4) * 210 : left + 230 + dateOffset * 48; const y = type === "journey" ? top + Math.floor(index / 4) * rowHeight : top + index * rowHeight;
    if (type === "gantt") rows.push({ type: "text", id: `mermaid-task-label:${node.id}`, x: left, y: y + 8, text: node.label, color: "#34495e", fontSize: 12, fontFamily: "sans", textAlign: "left", listType: "none" });
    const shape = boxShape(node, x, y, width, type === "journey" ? 64 : 30); positions.set(node.id, shape); rows.push(shape);
  });
  if (type === "gantt") graph.edges.forEach((edge, index) => {
    const from = positions.get(edge.from); const to = positions.get(edge.to); if (!from || !to) return;
    const forward = from.x <= to.x; const anchor = { x: forward ? 1 : 0, y: .5 }; const endAnchor = { x: forward ? 0 : 1, y: .5 };
    const start = { x: from.x + from.w * anchor.x, y: from.y + from.h / 2 }; const end = { x: to.x + to.w * endAnchor.x, y: to.y + to.h / 2 };
    rows.push({ type: "arrow", id: `mermaid-link:${index}`, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color: "#71869b", thickness: 1.2, autoRoute: true, arrowRoute: "elbow", endHead: "solid", startBinding: { elementId: from.id!, anchor }, endBinding: { elementId: to.id!, anchor: endAnchor } });
  });
  return rows;
}

export function layoutExtendedMermaid(source: string, center: Point): { type: ExtendedMermaidType; elements: Element[] } {
  const type = detectExtendedMermaidType(source); if (!type) throw new Error("This source is not one of the supported extended Mermaid diagram types.");
  const graph = parseGraph(source, type);
  return { type, elements: type === "journey" || type === "gantt" ? timelineLayout(graph, center, type) : graphLayout(graph, center, type) };
}

function flatten(elements: Element[]): Element[] { return elements.flatMap(item => item.hidden ? [] : item.type === "group" ? flatten(item.elements) : [item]); }
function safeId(value: string, fallback: string) { const result = value.replace(/[^\w]/g, "_").replace(/^[^A-Za-z_]+/, ""); return result || fallback; }
function quote(value: string) { return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/[\r\n]+/g, " ")}"`; }
function decodePart(value: string) { try { return decodeURIComponent(value); } catch { return value; } }
function sourceRelation(item: ShapeElement) { return item.componentRole?.startsWith("mermaid-relation:") ? decodePart(item.componentRole.slice("mermaid-relation:".length)) : undefined; }

/** Emit edits from generated native shapes back into the original Mermaid family. */
export function exportExtendedMermaid(type: ExtendedMermaidType, elements: Element[], originalSource = ""): string {
  const items = flatten(elements); const nodes = items.filter((item): item is ShapeElement => ["rectangle", "circle", "diamond", "triangle", "flowchart"].includes(item.type) && item.id?.startsWith("mermaid-node:") === true);
  const byId = new Map(nodes.map((node, index) => [node.id!, { node, id: safeId(node.id!.slice("mermaid-node:".length), `node_${index + 1}`) }]));
  if (!nodes.length) throw new Error("This generated Mermaid diagram has no editable nodes to export.");
  const lines: string[] = type === "class" ? ["classDiagram"] : type === "er" ? ["erDiagram"] : type === "state" ? ["stateDiagram-v2"] : type === "journey" ? ["journey"] : type === "gantt" ? ["gantt", "  dateFormat YYYY-MM-DD", "  axisFormat %b %d"] : ["C4Context"];
  if ((type === "journey" || type === "gantt") && items.some(item => item.id === "mermaid-title" && item.type === "text")) { const title = items.find(item => item.id === "mermaid-title" && item.type === "text") as Extract<Element, { type: "text" }>; lines.push(`  title ${title.text}`); }
  let activeSection = "";
  for (const [index, node] of nodes.entries()) {
    const key = byId.get(node.id!)!.id; const label = node.label?.text ?? key;
    if (type === "class") lines.push(`  class ${key} {`, ...label.split("\n").slice(1).map(member => `    ${member}`), "  }");
    else if (type === "er") lines.push(`  ${key} {`, ...label.split("\n").slice(1).map(member => `    ${member.replace(/^([^:]+):\s*([^ ]+).*$/, "$2 $1")}`), "  }");
    else if (type === "state" && key !== "__initial__") lines.push(`  state ${quote(label)} as ${key}`);
    else if (type === "c4") { const kind = node.componentRole?.replace("mermaid-c4:", "") || "Container"; const attributes = label.split("\n").filter(Boolean).map(quote); lines[0] = "C4Context"; lines.push(`  ${kind}(${key}${attributes.length ? `, ${attributes.join(", ")}` : ""})`); }
    else if (type === "journey") {
      const parts = (node.componentRole ?? "").split(":"); const rating = /^\d+$/.test(parts[1] ?? "") ? parts[1] : "3";
      const userTask = parts.length >= 4 ? decodePart(parts[2]) : parts[2] ?? "User"; const section = parts.length >= 4 ? decodePart(parts[3]) : "Journey";
      if (section !== activeSection) { activeSection = section; lines.push(`  section ${section}`); }
      lines.push(`  ${label.split("\n")[0]}: ${rating}: ${userTask}`);
    }
    else {
      const parts = (node.componentRole ?? "").replace(/^mermaid-gantt:/, "").split(":");
      const duration = parts.length >= 3 ? decodePart(parts[0]) : parts[0] ?? "1d";
      const section = parts.length >= 3 ? decodePart(parts[1]) : parts[1] ?? "Tasks";
      const start = parts.length >= 3 ? decodePart(parts[2]) : "";
      if (section !== activeSection) { activeSection = section; lines.push(`  section ${section}`); }
      lines.push(`  ${label.split("\n")[0]} :${key}, ${start ? `${start}, ` : ""}${duration}`);
    }
    void index;
  }
  for (const item of items) if ((item.type === "line" || item.type === "arrow") && item.startBinding?.elementId && item.endBinding?.elementId) {
    const from = byId.get(item.startBinding.elementId); const to = byId.get(item.endBinding.elementId); if (!from || !to) continue;
    const label = item.label?.text?.trim();
    if (type === "class") { const original = sourceRelation(item); const fallback = item.startHead === "hollow" ? item.lineStyle === "dashed" ? "<..|" : "<|--" : item.startHead === "diamond" ? "*--" : item.startHead === "open-diamond" ? "o--" : item.endHead === "hollow" ? "--|>" : item.endHead === "none" ? item.lineStyle === "dashed" ? ".." : "--" : item.lineStyle === "dashed" ? "..>" : "-->"; const relation = original && /^(?:<\|--|--\|>|<\.\.\||\.\.\|>|<\.\.>|\.\.>|\*--|o--|--|\.\.|-->)$/.test(original) ? original : fallback; lines.push(`  ${from.id} ${relation} ${to.id}${label ? ` : ${label}` : ""}`); }
    else if (type === "er") { const original = sourceRelation(item); const relation = original && /^[|o}{]+--[|o}{]+$/.test(original) ? original : "||--o{"; lines.push(`  ${from.id} ${relation} ${to.id}${label ? ` : ${label}` : ""}`); }
    else if (type === "state") lines.push(`  ${from.id === "__initial__" ? "[*]" : from.id} --> ${to.id === "__initial__" ? "[*]" : to.id}${label ? ` : ${label}` : ""}`);
    else if (type === "c4") lines.push(`  Rel(${from.id}, ${to.id}, ${quote(label ?? "uses")})`);
    else if (type === "gantt") lines.push(`  ${to.id} : after ${from.id}`);
  }
  if (type === "c4") lines[0] = /^\s*(C4(?:Context|Container|Component|Dynamic|Deployment))\b/im.exec(originalSource)?.[1] ?? "C4Context";
  return lines.join("\n") + "\n";
}
