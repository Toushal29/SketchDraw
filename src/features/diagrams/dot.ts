import type { Element, GroupElement, ShapeElement } from "../../model";
import { elementBounds } from "../canvas/bounds";

type DotNode = { id: string; label: string; shape: string; index: number; groupPath: string[]; ports?: { name: string; index: number; x: number; y: number }[]; width?: number; height?: number; color?: string; fillColor?: string; fontColor?: string; fontSize?: number; style?: string; penWidth?: number; htmlLabel?: boolean };
type DotEdge = { from: string; to: string; fromPort?: string; toPort?: string; fromCompass?: string; toCompass?: string; label: string; groupPath: string[]; color?: string; style?: string; penWidth?: number; arrowHead?: string; arrowTail?: string; direction?: string; htmlLabel?: boolean };
type DotRankDirection = "LR" | "RL" | "TB" | "BT";
type DotScope = { key: string; id: string; cluster: boolean; parentPath: string[]; members: Set<string>; attributes: Record<string, string>; nodeDefaults: Record<string, string>; edgeDefaults: Record<string, string>; rank?: string };
const MAX_DOT_NODES = 500;
const MAX_DOT_EDGES = 5_000;
const MAX_DOT_LABEL = 50_000;
const makeId = () => `dot-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const numericAttribute = (value: string | undefined) => Number(value?.trim().split(/[\s,]+/)[0]);
const anchorToward = (from: ShapeElement, to: ShapeElement) => { const dx = to.x + to.w / 2 - (from.x + from.w / 2); const dy = to.y + to.h / 2 - (from.y + from.h / 2); return Math.abs(dx) > Math.abs(dy) ? { x: dx > 0 ? 1 : 0, y: 0.5 } : { x: 0.5, y: dy > 0 ? 1 : 0 }; };

function splitStatements(source: string): string[] {
  let clean = ""; let quote = ""; let lineComment = false; let blockComment = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i]; const n = source[i + 1];
    if (lineComment) { if (c === "\n") { lineComment = false; clean += c; } else clean += " "; continue; }
    if (blockComment) { if (c === "*" && n === "/") { blockComment = false; clean += "  "; i++; } else clean += c === "\n" ? "\n" : " "; continue; }
    if (quote) { clean += c; if (c === "\\" && n) clean += source[++i]; else if (c === quote) quote = ""; continue; }
    if (c === '"') { quote = c; clean += c; continue; }
    if (c === "/" && n === "/" || c === "#") { lineComment = true; clean += " "; if (c === "/") { clean += " "; i++; } continue; }
    if (c === "/" && n === "*") { blockComment = true; clean += "  "; i++; continue; }
    clean += c;
  }
  const statements: string[] = []; let current = ""; quote = ""; let bracket = 0;
  for (let index = 0; index < clean.length; index++) {
    const c = clean[index];
    if (quote) { current += c; if (c === "\\" && clean[index + 1]) current += clean[++index]; else if (c === quote) quote = ""; continue; }
    if (c === '"') { quote = c; current += c; continue; }
    if (c === "[") bracket++;
    else if (c === "]") bracket = Math.max(0, bracket - 1);
    if (bracket === 0 && (c === "{" || c === "}")) {
      if (current.trim()) statements.push(current.trim()); current = ""; statements.push(c); continue;
    }
    if ((c === ";" || c === "\n") && bracket === 0) { if (current.trim()) statements.push(current.trim()); current = ""; }
    else current += c;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function parseId(raw: string): string {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\(["\\])/g, "$1");
  return value;
}

function attributes(raw: string): Record<string, string> {
  const output: Record<string, string> = {};
  const source = raw.trim().replace(/^\[/, "").replace(/\]$/, "");
  let index = 0;
  while (index < source.length) {
    while (index < source.length && /[\s,]/.test(source[index])) index++;
    const key = /^([\w.-]+)\s*=\s*/.exec(source.slice(index));
    if (!key) { index++; continue; }
    index += key[0].length;
    const start = index; const first = source[index];
    if (first === '"') {
      index++;
      while (index < source.length) { if (source[index] === "\\" && index + 1 < source.length) index += 2; else if (source[index++] === '"') break; }
    } else if (first === "<") {
      let depth = 0; let quote = "";
      while (index < source.length) {
        const char = source[index++];
        if (quote) { if (char === "\\") index++; else if (char === quote) quote = ""; continue; }
        if (char === '"' || char === "'") { quote = char; continue; }
        if (char === "<") depth++;
        else if (char === ">" && --depth === 0) break;
      }
    } else while (index < source.length && !/[\s,]/.test(source[index])) index++;
    const value = source.slice(start, index).trim();
    output[key[1].toLowerCase()] = first === '<' ? value : parseId(value);
  }
  return output;
}

function parseEndpoint(value: string) {
  const match = /^("(?:\\.|[^"])*"|[A-Za-z_\u0080-\uffff][\w.-]*|[-\d][\w.-]*)(?::("(?:\\.|[^"])*"|[A-Za-z_\u0080-\uffff][\w.-]*|[-\d][\w.-]*)(?::(n|ne|e|se|s|sw|w|nw|c|_))?)?$/i.exec(value);
  if (!match) throw new Error(`Invalid DOT node endpoint: ${value}`);
  return { id: parseId(match[1]), ...(match[2] ? { port: parseId(match[2]) } : {}), ...(match[3] ? { compass: match[3].toLowerCase() } : {}) };
}

function splitRecordFields(source: string): string[] {
  const fields: string[] = []; let current = ""; let depth = 0; let escaped = false;
  for (const char of source) {
    if (escaped) { current += char; escaped = false; continue; }
    if (char === "\\") { current += char; escaped = true; continue; }
    if (char === "{") depth++;
    if (char === "}") depth = Math.max(0, depth - 1);
    if (char === "|" && depth === 0) { fields.push(current); current = ""; } else current += char;
  }
  fields.push(current);
  return fields;
}

function recordFields(label: string): { text: string; port?: string }[] {
  const root = label.trim().replace(/^\{([\s\S]*)\}$/, "$1");
  const fields: { text: string; port?: string }[] = [];
  const visit = (raw: string) => {
    const port = /^\s*<([^>]+)>/.exec(raw)?.[1];
    let field = raw.replace(/^\s*<[^>]+>\s*/, "").trim();
    const nested = /^\{([\s\S]*)\}$/.exec(field);
    if (nested) {
      const before = fields.length;
      splitRecordFields(nested[1]).forEach(visit);
      if (port && fields.length > before && !fields[before].port) fields[before].port = port;
      return;
    }
    field = field.replace(/\\([{}|<>])/g, "$1").trim();
    fields.push({ text: field || `Field ${fields.length + 1}`, ...(port ? { port } : {}) });
  };
  splitRecordFields(root).forEach(visit);
  return fields;
}

function htmlLabelText(value: string): string {
  const inner = value.startsWith("<<") && value.endsWith(">>") ? value.slice(1, -1) : value;
  return inner.replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\s*\/\s*(?:td|tr|table)\s*>/gi, " ").replace(/<\s*\/\s*li\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&#(\d+);/g, (_all, code: string) => String.fromCodePoint(Math.min(0x10ffff, Number(code))))
    .replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function graphColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (/^#[\da-f]{3}$/i.test(value)) return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  if (/^#[\da-f]{6}$/i.test(value) || /^[a-z]{1,24}$/i.test(value)) return value;
  return fallback;
}

function sizeFor(label: string): { w: number; h: number } { return { w: Math.max(150, Math.min(280, 44 + label.length * 7)), h: Math.max(66, Math.min(130, 46 + label.split("\n").length * 20)) }; }

/** Parse editable Graphviz DOT nodes, record ports, rank constraints, and cluster subgraphs. */
export function dotToDiagram(source: string): Element[] {
  if (source.length > 500_000) throw new Error("DOT input is limited to 500 KB.");
  if (!/^\s*(?:strict\s+)?(?:di)?graph\b/i.test(source)) throw new Error("DOT source must start with graph or digraph.");
  const directed = /^\s*(?:strict\s+)?digraph\b/i.test(source);
  const bodyStart = source.indexOf("{"); const bodyEnd = source.lastIndexOf("}");
  if (bodyStart < 0 || bodyEnd <= bodyStart) throw new Error("DOT graph needs a matching pair of braces.");
  const statements = splitStatements(source.slice(bodyStart + 1, bodyEnd));
  if (statements.length > 5000) throw new Error("DOT diagrams are limited to 5,000 statements.");
  const nodes = new Map<string, DotNode>(); const edges: DotEdge[] = []; const rankConstraints: { key: string; rank: string; members: string[] }[] = [];
  const rootScope: DotScope = { key: "", id: "", cluster: false, parentPath: [], members: new Set(), attributes: {}, nodeDefaults: {}, edgeDefaults: {} };
  const scopes = [rootScope]; const allScopes = [rootScope]; let pendingSubgraph: { id: string; cluster: boolean } | undefined; let scopeCounter = 0;
  const currentScope = () => scopes[scopes.length - 1];
  const clusterPath = () => scopes.slice(1).filter(scope => scope.cluster).map(scope => scope.key);
  const commonPath = (first: string[], second: string[]) => first.slice(0, first.findIndex((value, index) => value !== second[index]) < 0 ? Math.min(first.length, second.length) : first.findIndex((value, index) => value !== second[index]));
  let graphRankdir: DotRankDirection = "TB"; let nodesep = 0.25; let ranksep = 0.5;
  const ensureNode = (key: string, attrs: Record<string, string> = {}) => {
    const existing = nodes.get(key);
    // DOT defaults apply when a node is first declared. An edge may mention
    // that node again later; reapplying defaults then would erase explicit
    // attributes already stored on it.
    attrs = existing ? attrs : { ...currentScope().nodeDefaults, ...attrs };
    if (!key || key.length > 200) throw new Error("DOT node names must contain between 1 and 200 characters.");
    const current = existing; const rawLabel = attrs.label ?? current?.label ?? key; const shape = (attrs.shape ?? current?.shape ?? "box").toLowerCase();
    const record = shape === "record" || shape === "mrecord";
    const html = rawLabel.startsWith("<") && rawLabel.endsWith(">");
    const fields = record && !html ? recordFields(rawLabel) : undefined;
    const label = html ? htmlLabelText(rawLabel) : fields ? fields.map(field => field.text).join("\n") : rawLabel;
    if (label.length > MAX_DOT_LABEL) throw new Error("DOT labels are limited to 50,000 characters.");
    const style = attrs.style ?? current?.style; const penWidth = Number(attrs.penwidth ?? current?.penWidth);
    const horizontalFields = graphRankdir === "TB" || graphRankdir === "BT";
    const portFields = fields?.flatMap((field, index) => field.port ? [{ name: field.port, index }] : [])
      ?? [...rawLabel.matchAll(/\bPORT\s*=\s*["']([^"']+)["']/gi)].map((match, index) => ({ name: match[1], index }));
    const fieldCount = fields?.length ?? Math.max(portFields.length, 1);
    const ports = portFields.length ? portFields.map(port => ({ ...port, x: horizontalFields ? (port.index + 0.5) / fieldCount : 0.5, y: horizontalFields ? 0.5 : (port.index + 0.5) / fieldCount })) : undefined;
    if (current) {
      if (attrs.label !== undefined) current.label = label;
      if (attrs.shape !== undefined) current.shape = shape;
      if (attrs.color) current.color = graphColor(attrs.color, current.color ?? "#4b5563");
      if (attrs.fillcolor) current.fillColor = graphColor(attrs.fillcolor, current.fillColor ?? "#ffffff");
      if (attrs.fontcolor) current.fontColor = graphColor(attrs.fontcolor, current.fontColor ?? "#111827");
      if (attrs.fontsize && Number.isFinite(Number(attrs.fontsize))) current.fontSize = clamp(Number(attrs.fontsize), 8, 100);
      if (attrs.label !== undefined) current.htmlLabel = html;
      if (style) current.style = style;
      if (Number.isFinite(penWidth) && penWidth > 0) current.penWidth = clamp(penWidth, 0.5, 24);
      const width = numericAttribute(attrs.width); const height = numericAttribute(attrs.height);
      if (Number.isFinite(width) && width > 0) current.width = clamp(width * 96, 40, 1000);
      if (Number.isFinite(height) && height > 0) current.height = clamp(height * 96, 30, 800);
      if (attrs.label !== undefined || attrs.shape !== undefined) current.ports = ports;
      const path = clusterPath(); if (path.length > current.groupPath.length) current.groupPath = path;
    }
    else {
      if (nodes.size >= MAX_DOT_NODES) throw new Error("DOT diagrams are limited to 500 nodes.");
      const width = Number(attrs.width); const height = Number(attrs.height);
      nodes.set(key, { id: key, label, shape, index: nodes.size, groupPath: clusterPath(), ...(ports ? { ports } : {}), ...(Number.isFinite(width) && width > 0 ? { width: clamp(width * 96, 40, 1000) } : {}), ...(Number.isFinite(height) && height > 0 ? { height: clamp(height * 96, 30, 800) } : {}), ...(attrs.color ? { color: graphColor(attrs.color, "#4b5563") } : {}), ...(attrs.fillcolor ? { fillColor: graphColor(attrs.fillcolor, "#ffffff") } : {}), ...(attrs.fontcolor ? { fontColor: graphColor(attrs.fontcolor, "#111827") } : {}), ...(attrs.fontsize && Number.isFinite(Number(attrs.fontsize)) ? { fontSize: clamp(Number(attrs.fontsize), 8, 100) } : {}), ...(style ? { style } : {}), ...(Number.isFinite(penWidth) && penWidth > 0 ? { penWidth: clamp(penWidth, 0.5, 24) } : {}), ...(html ? { htmlLabel: true } : {}) });
    }
    for (const scope of scopes) scope.members.add(key);
  };
  const endpointId = String.raw`(?:"(?:\\.|[^"])*"|[A-Za-z_\u0080-\uffff][\w.-]*|[-\d][\w.-]*)`;
  const endpoint = `${endpointId}(?::${endpointId}(?::(?:n|ne|e|se|s|sw|w|nw|c|_))?)?`;
  for (const statement of statements) {
    if (statement === "}") {
      if (scopes.length === 1) throw new Error("DOT contains an unmatched subgraph closing brace.");
      const finished = scopes.pop()!;
      if (finished.rank && ["same", "min", "max", "source", "sink"].includes(finished.rank)) rankConstraints.push({ key: finished.key, rank: finished.rank, members: [...finished.members] });
      continue;
    }
    if (statement === "{") {
      if (!pendingSubgraph) throw new Error("DOT contains a subgraph opening brace without a subgraph declaration.");
      const parent = currentScope(); const key = `dot-scope-${++scopeCounter}`;
      const scope: DotScope = { key, id: pendingSubgraph.id || key, cluster: pendingSubgraph.cluster, parentPath: clusterPath(), members: new Set(), attributes: {}, nodeDefaults: { ...parent.nodeDefaults }, edgeDefaults: { ...parent.edgeDefaults } };
      scopes.push(scope); allScopes.push(scope); pendingSubgraph = undefined; continue;
    }
    const subgraph = /^subgraph(?:\s+("(?:\\.|[^"])*"|[A-Za-z_\u0080-\uffff][\w.-]*))?\s*$/i.exec(statement);
    if (subgraph) { const name = subgraph[1] ? parseId(subgraph[1]) : ""; pendingSubgraph = { id: name, cluster: /^cluster(?:_|$)/i.test(name) }; continue; }
    if (/^(?:graph|node|edge)\s*\[/i.test(statement)) {
      const config = attributes(statement.slice(statement.indexOf("[")));
      if (/^graph\s*\[/i.test(statement)) {
        Object.assign(currentScope().attributes, config);
        if (config.rank && ["same", "min", "max", "source", "sink"].includes(config.rank.toLowerCase())) currentScope().rank = config.rank.toLowerCase();
        if (scopes.length === 1 && /^(LR|RL|TB|BT)$/i.test(config.rankdir ?? "")) graphRankdir = config.rankdir.toUpperCase() as DotRankDirection;
        const nodeGap = numericAttribute(config.nodesep); const rankGap = numericAttribute(config.ranksep);
        if (scopes.length === 1 && Number.isFinite(nodeGap)) nodesep = clamp(nodeGap, 0.05, 10);
        if (scopes.length === 1 && Number.isFinite(rankGap)) ranksep = clamp(rankGap, 0.05, 20);
      }
      if (/^node\s*\[/i.test(statement)) currentScope().nodeDefaults = { ...currentScope().nodeDefaults, ...config };
      if (/^edge\s*\[/i.test(statement)) currentScope().edgeDefaults = { ...currentScope().edgeDefaults, ...config };
      continue;
    }
    const rankSetting = /^rank\s*=\s*(same|min|max|source|sink)$/i.exec(statement);
    if (rankSetting) { currentScope().rank = rankSetting[1].toLowerCase(); continue; }
    const graphSetting = /^(rankdir|ranksep|nodesep)\s*=\s*("(?:\\.|[^"])*"|[^\s,]+)$/i.exec(statement);
    if (graphSetting && scopes.length === 1) {
      const [, setting, rawValue] = graphSetting; const value = parseId(rawValue);
      if (setting.toLowerCase() === "rankdir" && /^(LR|RL|TB|BT)$/i.test(value)) graphRankdir = value.toUpperCase() as DotRankDirection;
      if (setting.toLowerCase() === "nodesep" && Number.isFinite(numericAttribute(value))) nodesep = clamp(numericAttribute(value), 0.05, 10);
      if (setting.toLowerCase() === "ranksep" && Number.isFinite(numericAttribute(value))) ranksep = clamp(numericAttribute(value), 0.05, 20);
      continue;
    }
    const edgePattern = new RegExp(`(${endpoint})\\s*(--|->)\\s*`, "g");
    const matches = [...statement.matchAll(edgePattern)];
    if (matches.length) {
      const first = matches[0]; const chain = [parseEndpoint(first[1])]; let targetEnd = 0;
      for (const match of matches) {
        const nextStart = (match.index ?? 0) + match[0].length;
        const nextMatch = new RegExp(`^(${endpoint})`).exec(statement.slice(nextStart));
        if (!nextMatch) throw new Error("A DOT edge is missing a destination node.");
        chain.push(parseEndpoint(nextMatch[1])); targetEnd = nextStart + nextMatch[1].length;
      }
      const attrs = { ...currentScope().edgeDefaults, ...attributes(statement.slice(targetEnd)) };
      if ((attrs.label ?? "").length > MAX_DOT_LABEL) throw new Error("DOT labels are limited to 50,000 characters.");
      const edgeLabelRaw = attrs.label ?? ""; const edgeLabel = edgeLabelRaw.startsWith("<") ? htmlLabelText(edgeLabelRaw) : edgeLabelRaw;
      const edgeStyle = (attrs.style ?? "").toLowerCase(); const penWidth = Number(attrs.penwidth);
      for (let i = 0; i < chain.length - 1; i++) {
        if (edges.length >= MAX_DOT_EDGES) throw new Error("DOT diagrams are limited to 5,000 connectors.");
        ensureNode(chain[i].id); ensureNode(chain[i + 1].id);
        const fromNode = nodes.get(chain[i].id)!; const toNode = nodes.get(chain[i + 1].id)!;
        edges.push({ from: chain[i].id, to: chain[i + 1].id, ...(chain[i].port ? { fromPort: chain[i].port } : {}), ...(chain[i + 1].port ? { toPort: chain[i + 1].port } : {}), ...(chain[i].compass ? { fromCompass: chain[i].compass } : {}), ...(chain[i + 1].compass ? { toCompass: chain[i + 1].compass } : {}), label: edgeLabel, groupPath: commonPath(fromNode.groupPath, toNode.groupPath), ...(attrs.color ? { color: graphColor(attrs.color, "#6b7280") } : {}), ...(edgeStyle ? { style: edgeStyle } : {}), ...(Number.isFinite(penWidth) && penWidth > 0 ? { penWidth: clamp(penWidth, 0.5, 24) } : {}), ...(attrs.arrowhead ? { arrowHead: attrs.arrowhead } : {}), ...(attrs.arrowtail ? { arrowTail: attrs.arrowtail } : {}), ...(attrs.dir ? { direction: attrs.dir.toLowerCase() } : {}), ...(edgeLabelRaw.startsWith("<") ? { htmlLabel: true } : {}) });
      }
      continue;
    }
    const nodeMatch = new RegExp(`^\\s*(${endpointId})\\s*(\\[[\\s\\S]*\\])?\\s*$`).exec(statement);
    if (nodeMatch) { ensureNode(parseId(nodeMatch[1]), nodeMatch[2] ? attributes(nodeMatch[2]) : {}); continue; }
    const graphAssignment = /^([\w.-]+)\s*=\s*("(?:\\.|[^"])*"|[^\s,]+)$/.exec(statement);
    if (graphAssignment) {
      const name = graphAssignment[1].toLowerCase(); const value = parseId(graphAssignment[2]); currentScope().attributes[name] = value;
      if (name === "label") currentScope().attributes.label = value.startsWith("<") ? htmlLabelText(value) : value;
      if (name === "rankdir" && scopes.length === 1 && /^(LR|RL|TB|BT)$/i.test(value)) graphRankdir = value.toUpperCase() as DotRankDirection;
      if (name === "nodesep" && scopes.length === 1 && Number.isFinite(numericAttribute(value))) nodesep = clamp(numericAttribute(value), 0.05, 10);
      if (name === "ranksep" && scopes.length === 1 && Number.isFinite(numericAttribute(value))) ranksep = clamp(numericAttribute(value), 0.05, 20);
      continue;
    }
    throw new Error(`Unsupported DOT statement: ${statement.slice(0, 80)}`);
  }
  if (scopes.length !== 1 || pendingSubgraph) throw new Error("DOT contains an unclosed subgraph.");
  if (!nodes.size) throw new Error("No DOT nodes were found.");
  const incoming = new Set(edges.map(edge => edge.to)); const ranks = new Map<string, number>(); const queue = directed ? [...nodes.keys()].filter(key => !incoming.has(key)) : [];
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) { const targets = outgoing.get(edge.from) ?? []; targets.push(edge.to); outgoing.set(edge.from, targets); }
  queue.forEach(key => ranks.set(key, 0));
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const key = queue[cursor]; const rank = ranks.get(key) ?? 0;
    for (const target of outgoing.get(key) ?? []) if (!ranks.has(target)) { ranks.set(target, rank + 1); queue.push(target); }
  }
  const undirectedColumns = Math.max(1, Math.ceil(Math.sqrt(nodes.size)));
  for (const node of nodes.values()) if (!ranks.has(node.id)) ranks.set(node.id, directed ? 0 : Math.floor(node.index / undirectedColumns));
  for (const constraint of rankConstraints.filter(item => item.rank === "same")) {
    const rank = Math.max(0, ...constraint.members.map(member => ranks.get(member) ?? 0));
    for (const member of constraint.members) ranks.set(member, rank);
  }
  let initialMaxRank = Math.max(0, ...ranks.values());
  for (const constraint of rankConstraints.filter(item => item.rank === "min" || item.rank === "source")) for (const member of constraint.members) ranks.set(member, 0);
  for (const constraint of rankConstraints.filter(item => item.rank === "max" || item.rank === "sink")) for (const member of constraint.members) ranks.set(member, initialMaxRank);
  const rankBuckets = new Map<number, DotNode[]>();
  for (const node of nodes.values()) { const rank = ranks.get(node.id) ?? 0; const bucket = rankBuckets.get(rank) ?? []; bucket.push(node); rankBuckets.set(rank, bucket); }
  const cardById = new Map<string, ShapeElement>();
  const recordShape = (name: string) => /^(?:record|mrecord)$/i.test(name);
  const flowchartShapes: Record<string, NonNullable<ShapeElement["flowchartShape"]>> = { trapezium: "trapezoid", trapezoid: "trapezoid", invtrapezium: "trapezoid", invtrapezoid: "trapezoid", parallelogram: "parallelogram", pentagon: "pentagon", house: "pentagon", invhouse: "pentagon", hexagon: "hexagon", octagon: "octagon", doubleoctagon: "octagon", septagon: "octagon", folder: "folder", tab: "folder", note: "note", box3d: "cube", component: "predefined-process", cylinder: "database", cloud: "cloud", star: "star", larrow: "left-arrow", rarrow: "right-arrow" };
  const nodeSize = new Map<string, { w: number; h: number }>();
  for (const node of nodes.values()) { const defaultSize = sizeFor(node.label); nodeSize.set(node.id, { w: node.width ?? defaultSize.w, h: node.height ?? (recordShape(node.shape) ? Math.max(70, 32 + node.label.split("\n").length * 24) : defaultSize.h) }); }
  const horizontal = graphRankdir === "LR" || graphRankdir === "RL"; const reverseRanks = graphRankdir === "BT" || graphRankdir === "RL";
  const rankGap = clamp(ranksep * 96, 16, 1200); const nodeGap = clamp(nodesep * 96, 8, 600); const rankStarts = new Map<number, number>(); let primaryOffset = 0;
  for (const rank of [...rankBuckets.keys()].sort((a, b) => a - b)) { rankStarts.set(rank, primaryOffset); const size = [...(rankBuckets.get(rank) ?? [])].reduce((largest, node) => Math.max(largest, horizontal ? nodeSize.get(node.id)!.w : nodeSize.get(node.id)!.h), 0); primaryOffset += size + rankGap; }
  const totalPrimary = Math.max(1, primaryOffset - rankGap);
  for (const node of nodes.values()) {
    const rank = ranks.get(node.id) ?? 0; const bucket = rankBuckets.get(rank) ?? []; const position = bucket.indexOf(node);
    const size = nodeSize.get(node.id)!; const crossPosition = bucket.slice(0, position).reduce((offset, item) => offset + (horizontal ? nodeSize.get(item.id)!.h : nodeSize.get(item.id)!.w) + nodeGap, 0);
    const primary = rankStarts.get(rank) ?? 0; const mainPosition = reverseRanks ? totalPrimary - primary - (horizontal ? size.w : size.h) : primary;
    const x = horizontal ? mainPosition : crossPosition; const y = horizontal ? crossPosition : mainPosition;
    const dotShape = node.shape.toLowerCase(); const mappedFlow = flowchartShapes[dotShape];
    const shape: ShapeElement["type"] = ["ellipse", "oval", "circle", "doublecircle", "point", "egg"].includes(dotShape) ? "circle" : ["diamond", "rhombus", "mdiamond"].includes(dotShape) ? "diamond" : ["triangle", "invtriangle"].includes(dotShape) ? "triangle" : mappedFlow ? "flowchart" : "rectangle";
    const nodeStyle = (node.style ?? "").toLowerCase();
    const unsupportedShape = !["box", "rect", "rectangle", "ellipse", "oval", "circle", "doublecircle", "point", "egg", "diamond", "rhombus", "mdiamond", "triangle", "invtriangle", "record", "mrecord", "plaintext", "plain", "none", ...Object.keys(flowchartShapes)].includes(dotShape);
    const fillEnabled = nodeStyle.split(/[\s,]+/).includes("filled");
    const connectionPoints = node.ports?.map(port => ({ id: `dot-port-${port.index + 1}`, name: port.name, anchor: { x: port.x, y: port.y } }));
    const mappedShape = shape === "flowchart" ? mappedFlow : undefined;
    const rankMetadata = { rankdir: graphRankdir, nodesep, ranksep, ranksepEqually: /\bequally\b/i.test(rootScope.attributes.ranksep ?? ""), rank: ranks.get(node.id) ?? 0, groups: rankConstraints.filter(constraint => constraint.members.includes(node.id)).map(({ key, rank }) => ({ key, rank })) };
    cardById.set(node.id, { type: shape, id: `dot-node:${encodeURIComponent(node.id)}`, liveKey: node.id, componentRole: `dot-node|${encodeURIComponent(JSON.stringify({ shape: dotShape, ...rankMetadata }))}`, x, y, ...size, color: graphColor(node.color, "#4b5563"), thickness: node.penWidth ?? 2, fillColor: graphColor(node.fillColor, "#ffffff"), ...(mappedShape ? { flowchartShape: mappedShape } : {}), ...(unsupportedShape ? { altText: `Unsupported DOT shape '${dotShape}' was simplified to an editable rectangle.` } : {}), ...(node.htmlLabel ? { tooltip: "HTML-like DOT label markup was simplified to plain text." } : {}), ...(nodeStyle.includes("dashed") ? { lineStyle: "dashed" as const } : nodeStyle.includes("dotted") ? { lineStyle: "dotted" as const } : nodeStyle.includes("double") ? { lineStyle: "double" as const } : {}), ...(nodeStyle.includes("rounded") ? { edgeStyle: "rounded" as const } : {}), fillOpacity: fillEnabled ? 1 : 0, ...(connectionPoints?.length ? { connectionPoints } : {}), ...(dotShape === "invtriangle" || dotShape === "invhouse" || dotShape === "invtrapezium" || dotShape === "invtrapezoid" ? { rotation: 180 } : {}), label: { text: node.label, color: graphColor(node.fontColor, "#111827"), fontSize: node.fontSize ?? 16, fontFamily: "sans", bold: nodeStyle.includes("bold"), italic: nodeStyle.includes("italic"), underline: nodeStyle.includes("underline"), textAlign: "center", listType: "none", verticalAlign: "middle" } });
  }
  const compassAnchor = (value?: string) => ({ n: { x: 0.5, y: 0 }, ne: { x: 1, y: 0 }, e: { x: 1, y: 0.5 }, se: { x: 1, y: 1 }, s: { x: 0.5, y: 1 }, sw: { x: 0, y: 1 }, w: { x: 0, y: 0.5 }, nw: { x: 0, y: 0 }, c: { x: 0.5, y: 0.5 } } as Record<string, { x: number; y: number }>)[value?.toLowerCase() ?? ""];
  const portAnchor = (item: ShapeElement, port?: string, compass?: string, toward?: ShapeElement) => {
    const custom = port ? item.connectionPoints?.find(point => point.name === port)?.anchor : undefined;
    return custom ?? compassAnchor(compass) ?? (toward ? anchorToward(item, toward) : { x: 0.5, y: 0.5 });
  };
  const connectorElements: ShapeElement[] = edges.map(edge => {
    const from = cardById.get(edge.from)!; const to = cardById.get(edge.to)!;
    const head = (value: string | undefined, fallback: ShapeElement["endHead"]) => value === "none" ? "none" : ["vee", "open", "curve", "icurve"].includes(value ?? "") ? "open" : ["dot", "odot", "invdot", "invodot"].includes(value ?? "") ? "dot" : value === "tee" ? "bar" : value === "diamond" ? "diamond" : value === "odiamond" ? "open-diamond" : value === "crow" ? "crow" : ["box", "obox"].includes(value ?? "") ? "thick" : ["empty", "invempty"].includes(value ?? "") ? "hollow" : ["normal", "inv"].includes(value ?? "") ? "solid" : fallback;
    const direction = edge.direction?.toLowerCase(); const lineStyle = (edge.style ?? "").toLowerCase();
    const startHead = direction === "both" || direction === "back" ? head(edge.arrowTail, "solid") : "none";
    const endHead = direction === "none" || direction === "back" ? "none" : head(edge.arrowHead, directed ? "solid" : "none");
    const sourceAnchor = portAnchor(from, edge.fromPort, edge.fromCompass, to); const targetAnchor = portAnchor(to, edge.toPort, edge.toCompass, from);
    const start = { x: from.x + from.w * sourceAnchor.x, y: from.y + from.h * sourceAnchor.y }; const end = { x: to.x + to.w * targetAnchor.x, y: to.y + to.h * targetAnchor.y };
    return { type: startHead !== "none" || endHead !== "none" ? "arrow" : "line", id: makeId(), liveKey: `dot-edge:${edge.from}:${edge.fromPort ?? ""}->${edge.to}:${edge.toPort ?? ""}`, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color: graphColor(edge.color, "#6b7280"), thickness: edge.penWidth ?? 2, lineStyle: lineStyle.includes("dashed") ? "dashed" : lineStyle.includes("dotted") ? "dotted" : "solid", startHead, endHead, startBinding: { elementId: from.id!, anchor: sourceAnchor }, endBinding: { elementId: to.id!, anchor: targetAnchor }, ...(edge.label ? { label: { text: edge.label, color: graphColor(edge.color, "#4b5563"), fontSize: 13, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" } } : {}) };
  });
  connectorElements.forEach((item, index) => {
    const edge = edges[index];
    item.componentRole = `dot-edge|${encodeURIComponent(JSON.stringify({ graph: directed ? "digraph" : "graph", direction: edge.direction ?? "forward", arrowHead: edge.arrowHead ?? (directed ? "normal" : "none"), arrowTail: edge.arrowTail ?? "normal", startHead: item.startHead, endHead: item.endHead }))}`;
    if (edge.htmlLabel) item.tooltip = "HTML-like DOT edge label markup was simplified to plain text.";
  });
  const groupedItems = new Map<string, Element[]>();
  const place = (item: Element, path: string[]) => { const key = path[path.length - 1] ?? ""; const list = groupedItems.get(key) ?? []; list.push(item); groupedItems.set(key, list); };
  for (const node of nodes.values()) place(cardById.get(node.id)!, node.groupPath);
  edges.forEach((edge, index) => place(connectorElements[index], edge.groupPath));
  const clusterScopes = allScopes.filter(scope => scope.cluster); const childrenByParent = new Map<string, DotScope[]>();
  for (const scope of clusterScopes) { const parent = scope.parentPath[scope.parentPath.length - 1] ?? ""; const list = childrenByParent.get(parent) ?? []; list.push(scope); childrenByParent.set(parent, list); }
  const buildCluster = (scope: DotScope): GroupElement | undefined => {
    const children = (childrenByParent.get(scope.key) ?? []).flatMap(child => { const group = buildCluster(child); return group ? [group] : []; });
    const members = [...children, ...(groupedItems.get(scope.key) ?? [])]; if (!members.length) return undefined;
    const bounds = members.map(elementBounds); const minX = Math.min(...bounds.map(item => item.x)); const minY = Math.min(...bounds.map(item => item.y)); const maxX = Math.max(...bounds.map(item => item.x + item.w)); const maxY = Math.max(...bounds.map(item => item.y + item.h));
    const clusterStyle = (scope.attributes.style ?? "").toLowerCase(); const color = graphColor(scope.attributes.color, "#9ca3af"); const fill = graphColor(scope.attributes.fillcolor, "#ffffff");
    const group: GroupElement = { type: "group", id: `dot-cluster:${encodeURIComponent(scope.id)}`, liveKey: scope.id, elements: members, componentBounds: { x: minX - 18, y: minY - 34, w: Math.max(80, maxX - minX + 36), h: Math.max(60, maxY - minY + 52) }, container: { kind: "container", name: scope.attributes.label || scope.id, showBorder: true, showLabel: true, borderColor: color, borderThickness: clamp(Number(scope.attributes.penwidth) || 1.5, 0.5, 8), borderStyle: clusterStyle.includes("dashed") ? "dashed" : clusterStyle.includes("dotted") ? "dotted" : "solid", ...(clusterStyle.includes("filled") || scope.attributes.fillcolor ? { background: fill } : {}), clipChildren: false, autoResize: false, padding: 18 } };
    return group;
  };
  const rootItems = [...(groupedItems.get("") ?? [])];
  for (const scope of childrenByParent.get("") ?? []) { const group = buildCluster(scope); if (group) rootItems.push(group); }
  const roots = [...rootItems.filter(item => item.type === "line" || item.type === "arrow"), ...rootItems.filter(item => item.type !== "line" && item.type !== "arrow")];
  return roots;
}
