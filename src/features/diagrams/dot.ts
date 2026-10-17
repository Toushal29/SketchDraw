import type { Element, ShapeElement } from "../../model";

type DotNode = { id: string; label: string; shape: string; index: number };
type DotEdge = { from: string; to: string; label: string };
type DotRankDirection = "LR" | "RL" | "TB" | "BT";
const MAX_DOT_NODES = 500;
const MAX_DOT_EDGES = 5_000;
const MAX_DOT_LABEL = 50_000;
const makeId = () => `dot-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
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
  const pattern = /([\w.-]+)\s*=\s*("(?:\\.|[^"])*"|[^,\s]+)\s*,?/g;
  for (const match of source.matchAll(pattern)) output[match[1].toLowerCase()] = parseId(match[2]);
  return output;
}

function sizeFor(label: string): { w: number; h: number } { return { w: Math.max(150, Math.min(280, 44 + label.length * 7)), h: Math.max(66, Math.min(130, 46 + label.split("\n").length * 20)) }; }

/** Parse a practical DOT subset: directed/undirected graphs, nodes, edge chains and labels. */
export function dotToDiagram(source: string): Element[] {
  if (source.length > 500_000) throw new Error("DOT input is limited to 500 KB.");
  if (!/^\s*(?:strict\s+)?(?:di)?graph\b/i.test(source)) throw new Error("DOT source must start with graph or digraph.");
  const directed = /^\s*(?:strict\s+)?digraph\b/i.test(source);
  const bodyStart = source.indexOf("{"); const bodyEnd = source.lastIndexOf("}");
  if (bodyStart < 0 || bodyEnd <= bodyStart) throw new Error("DOT graph needs a matching pair of braces.");
  const statements = splitStatements(source.slice(bodyStart + 1, bodyEnd));
  if (statements.length > 5000) throw new Error("DOT diagrams are limited to 5,000 statements.");
  const nodes = new Map<string, DotNode>(); const edges: DotEdge[] = []; let rankdir: DotRankDirection = "TB";
  const ensureNode = (key: string, attrs: Record<string, string> = {}) => {
    if (!key || key.length > 200) throw new Error("DOT node names must contain between 1 and 200 characters.");
    const current = nodes.get(key); const label = attrs.label ?? current?.label ?? key; const shape = attrs.shape ?? current?.shape ?? "box";
    if (label.length > MAX_DOT_LABEL) throw new Error("DOT labels are limited to 50,000 characters.");
    if (current) { current.label = label; current.shape = shape; }
    else {
      if (nodes.size >= MAX_DOT_NODES) throw new Error("DOT diagrams are limited to 500 nodes.");
      nodes.set(key, { id: key, label, shape, index: nodes.size });
    }
  };
  for (const statement of statements) {
    if (/^(?:graph|node|edge)\s*\[/i.test(statement)) {
      const config = attributes(statement.slice(statement.indexOf("[")));
      if (/^graph\s*\[/i.test(statement) && /^(LR|RL|TB|BT)$/i.test(config.rankdir ?? "")) rankdir = config.rankdir.toUpperCase() as DotRankDirection;
      continue;
    }
    const rankSetting = /^rankdir\s*=\s*(LR|RL|TB|BT)$/i.exec(statement);
    if (rankSetting) { rankdir = rankSetting[1].toUpperCase() as DotRankDirection; continue; }
    if (/^subgraph\b/i.test(statement) || statement === "}") continue;
    const edgePattern = /("(?:\\.|[^"])*"|[A-Za-z_\u0080-\uffff][\w.:-]*|[-\d][\w.:-]*)\s*(--|->)\s*/g;
    const matches = [...statement.matchAll(edgePattern)];
    if (matches.length) {
      const first = matches[0]; const chain = [parseId(first[1])];
      for (const match of matches) {
        const nextStart = (match.index ?? 0) + match[0].length;
        const nextMatch = /^("(?:\\.|[^"])*"|[A-Za-z_\u0080-\uffff][\w.:-]*|[-\d][\w.:-]*)/.exec(statement.slice(nextStart));
        if (!nextMatch) throw new Error("A DOT edge is missing a destination node.");
        chain.push(parseId(nextMatch[1]));
      }
      const lastMatch = matches[matches.length - 1];
      const attrs = attributes(statement.slice(statement.lastIndexOf("[") >= (lastMatch?.index ?? 0) ? statement.lastIndexOf("[") : statement.length));
      if ((attrs.label ?? "").length > MAX_DOT_LABEL) throw new Error("DOT labels are limited to 50,000 characters.");
      for (let i = 0; i < chain.length - 1; i++) {
        if (edges.length >= MAX_DOT_EDGES) throw new Error("DOT diagrams are limited to 5,000 connectors.");
        ensureNode(chain[i]); ensureNode(chain[i + 1]); edges.push({ from: chain[i], to: chain[i + 1], label: attrs.label ?? "" });
      }
      continue;
    }
    const nodeMatch = /^\s*("(?:\\.|[^"])*"|[A-Za-z_\u0080-\uffff][\w.:-]*|[-\d][\w.:-]*)\s*(\[[\s\S]*\])?\s*$/.exec(statement);
    if (nodeMatch) { ensureNode(parseId(nodeMatch[1]), nodeMatch[2] ? attributes(nodeMatch[2]) : {}); continue; }
    if (!/^[\w.:-]+\s*=/.test(statement)) throw new Error(`Unsupported DOT statement: ${statement.slice(0, 80)}`);
  }
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
  const rankBuckets = new Map<number, DotNode[]>();
  for (const node of nodes.values()) { const rank = ranks.get(node.id) ?? 0; const bucket = rankBuckets.get(rank) ?? []; bucket.push(node); rankBuckets.set(rank, bucket); }
  const maxRank = Math.max(0, ...ranks.values());
  const cardById = new Map<string, ShapeElement>();
  for (const node of nodes.values()) {
    const rank = ranks.get(node.id) ?? 0; const bucket = rankBuckets.get(rank) ?? []; const position = bucket.indexOf(node);
    const x = (rankdir === "LR" || rankdir === "RL" ? (rankdir === "RL" ? maxRank - rank : rank) * 300 : position * 280);
    const y = (rankdir === "LR" || rankdir === "RL" ? position * 180 : (rankdir === "BT" ? maxRank - rank : rank) * 180);
    const size = sizeFor(node.label); const shape = /^(ellipse|oval|circle)$/i.test(node.shape) ? "circle" : /^(diamond|rhombus)$/i.test(node.shape) ? "diamond" : "rectangle";
    cardById.set(node.id, { type: shape, id: makeId(), x, y, ...size, color: "#4b5563", thickness: 2, fillColor: "#ffffff", label: { text: node.label, color: "#111827", fontSize: 16, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } });
  }
  const connectorElements: ShapeElement[] = edges.map(edge => {
    const from = cardById.get(edge.from)!; const to = cardById.get(edge.to)!;
    return { type: "arrow", id: makeId(), x: from.x + from.w / 2, y: from.y + from.h / 2, w: to.x + to.w / 2 - (from.x + from.w / 2), h: to.y + to.h / 2 - (from.y + from.h / 2), color: "#6b7280", thickness: 2, endHead: directed ? "solid" : "none", startHead: "none", startBinding: { elementId: from.id!, anchor: anchorToward(from, to) }, endBinding: { elementId: to.id!, anchor: anchorToward(to, from) }, ...(edge.label ? { label: { text: edge.label, color: "#4b5563", fontSize: 13, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" } } : {}) };
  });
  return [...connectorElements, ...cardById.values()];
}
