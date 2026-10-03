import type { Element, Point, ShapeElement, StrokeStyle } from "./model";

export type MermaidDirection = "TD" | "BT" | "LR" | "RL";
type MermaidNode = { key: string; label: string; shape: "rectangle" | "rounded" | "diamond" | "circle"; defined: boolean; subgraphId?: string };
type MermaidSubgraph = { id: string; title: string; parentId?: string };
type MermaidLink = { from: string; to: string; label: string; lineStyle: StrokeStyle; thickness: number; startHead: ShapeElement["startHead"]; endHead: ShapeElement["endHead"] };
export type MermaidFlowchart = { direction: MermaidDirection; nodes: MermaidNode[]; links: MermaidLink[]; subgraphs: MermaidSubgraph[] };

function nodeAt(line: string, offset: number): { node: MermaidNode; next: number } | undefined {
  const leading = /^\s*/.exec(line.slice(offset))?.[0].length ?? 0;
  let cursor = offset + leading;
  const id = /^[A-Za-z_]\w*(?:-[A-Za-z0-9_]+)*/.exec(line.slice(cursor));
  if (!id) return undefined;
  const key = id[0]; cursor += key.length;
  const rest = line.slice(cursor); let open = ""; let close = ""; let shape: MermaidNode["shape"] = "rectangle";
  if (rest.startsWith("((")) { open = "(("; close = "))"; shape = "circle"; }
  else if (rest.startsWith("{")) { open = "{"; close = "}"; shape = "diamond"; }
  else if (rest.startsWith("([")) { open = "(["; close = "])"; shape = "rounded"; }
  else if (rest.startsWith("[[")) { open = "[["; close = "]]"; shape = "rectangle"; }
  else if (rest.startsWith("[")) { open = "["; close = "]"; }
  else if (rest.startsWith("(")) { open = "("; close = ")"; shape = "rounded"; }
  if (!open) return { node: { key, label: key, shape, defined: false }, next: cursor };
  const labelStart = cursor + open.length; const closeAt = line.indexOf(close, labelStart);
  if (closeAt < 0) return undefined;
  let label = line.slice(labelStart, closeAt).trim();
  if ((label.startsWith('"') && label.endsWith('"')) || (label.startsWith("'") && label.endsWith("'"))) label = label.slice(1, -1);
  label = label.replace(/<br\s*\/?>/gi, "\n").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  return { node: { key, label: label || key, shape, defined: true }, next: closeAt + close.length };
}

function subgraphAt(raw: string, parentId: string | undefined, index: number): MermaidSubgraph | undefined {
  const match = /^subgraph\s+(.+)$/i.exec(raw);
  if (!match) return undefined;
  const declaration = match[1].trim();
  const bracket = /^([A-Za-z_][\w-]*)\s*\[\s*([\s\S]*?)\s*\]$/.exec(declaration);
  const quoted = /^([A-Za-z_][\w-]*)\s+["']([\s\S]*?)["']$/.exec(declaration);
  const plainId = /^([A-Za-z_][\w-]*)$/.exec(declaration);
  const title = bracket?.[2] ?? quoted?.[2] ?? (plainId ? plainId[1] : declaration);
  const id = bracket?.[1] ?? quoted?.[1] ?? plainId?.[1] ?? "subgraph-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + index;
  return { id, title: title.replace(/^(["'])(.*)\1$/, "$2"), parentId };
}

function linkAt(line: string, offset: number): { link: Omit<MermaidLink, "from" | "to">; next: number } | undefined {
  const leading = /^\s*/.exec(line.slice(offset))?.[0].length ?? 0; let cursor = offset + leading; const rest = line.slice(cursor);
  let label = ""; let lineStyle: StrokeStyle = "solid"; let thickness = 1.7; let startHead: ShapeElement["startHead"] = "none"; let endHead: ShapeElement["endHead"] = "solid"; let width = 0;
  const spaced = /^--\s+(.+?)\s+-->/i.exec(rest);
  const spacedDotted = /^-\.\s+(.+?)\s+\.->/i.exec(rest);
  if (spaced) { width = spaced[0].length; label = spaced[1].trim(); }
  else if (spacedDotted) { width = spacedDotted[0].length; label = spacedDotted[1].trim(); lineStyle = "dotted"; }
  else {
    const operators: [string, Partial<Omit<MermaidLink, "from" | "to" | "label">>][] = [
      ["o--o", { startHead: "dot", endHead: "dot" }], ["x--x", { startHead: "bar", endHead: "bar" }],
      ["<-->", { startHead: "solid", endHead: "solid" }], ["o-->", { startHead: "dot" }], ["x-->", { startHead: "bar" }], ["<--o", { startHead: "solid", endHead: "dot" }], ["<--x", { startHead: "solid", endHead: "bar" }],
      ["-.->", { lineStyle: "dotted" }], ["-.-", { lineStyle: "dotted", endHead: "none" }], ["==>", { thickness: 3.2 }], ["===", { thickness: 3.2, endHead: "none" }],
      ["--o", { endHead: "dot" }], ["--x", { endHead: "bar" }], ["-->", {}], ["---", { endHead: "none" }],
    ];
    const operator = operators.find(([token]) => rest.startsWith(token));
    if (operator) { width = operator[0].length; lineStyle = operator[1].lineStyle ?? lineStyle; thickness = operator[1].thickness ?? thickness; startHead = operator[1].startHead ?? startHead; endHead = operator[1].endHead ?? endHead; }
  }
  if (!width) return undefined;
  cursor += width;
  const gap = /^\s*/.exec(line.slice(cursor))?.[0].length ?? 0; cursor += gap;
  if (line[cursor] === "|") {
    const end = line.indexOf("|", cursor + 1);
    if (end < 0) return undefined;
    label = line.slice(cursor + 1, end).trim(); cursor = end + 1;
  }
  return { link: { label, lineStyle, thickness, startHead, endHead }, next: cursor };
}

/** Parse an offline-friendly Mermaid flowchart subset, including subgraphs and common edge styles. */
export function parseMermaidFlowchart(source: string): MermaidFlowchart {
  if (source.length > 100_000) throw new Error("Mermaid input is limited to 100,000 characters.");
  let direction: MermaidDirection = "TD";
  const nodes = new Map<string, MermaidNode>(); const links: MermaidLink[] = []; const subgraphs: MermaidSubgraph[] = []; const stack: MermaidSubgraph[] = [];
  const lines = source.replace(/\r/g, "").split("\n");
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const raw = lines[lineIndex].split("%%", 1)[0].trim(); if (!raw) continue;
    const header = /^(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)\b/i.exec(raw);
    if (header) { direction = header[1].toUpperCase() === "TB" ? "TD" : header[1].toUpperCase() as MermaidDirection; continue; }
    const subgraph = subgraphAt(raw, stack[stack.length - 1]?.id, subgraphs.length + 1);
    if (subgraph) {
      if (subgraphs.some(item => item.id === subgraph.id)) throw new Error("Duplicate Mermaid subgraph ID on line " + (lineIndex + 1) + ".");
      subgraphs.push(subgraph); if (subgraphs.length > 50) throw new Error("A Mermaid import can contain up to 50 subgraphs."); stack.push(subgraph); continue;
    }
    if (/^end\s*$/i.test(raw)) { if (!stack.length) throw new Error("Unexpected subgraph end on line " + (lineIndex + 1) + "."); stack.pop(); continue; }
    if (/^(?:classDef\b|class\s|style\s|linkStyle\b|click\s|direction\s)/i.test(raw)) continue;
    let cursor = 0; const first = nodeAt(raw, cursor);
    if (!first) throw new Error("Unsupported Mermaid flowchart syntax on line " + (lineIndex + 1) + ".");
    const remember = (node: MermaidNode) => {
      const previous = nodes.get(node.key);
      const assignedSubgraph = stack[stack.length - 1]?.id;
      const next = { ...node, ...(node.defined || !previous ? { subgraphId: assignedSubgraph } : { subgraphId: previous.subgraphId }) };
      if (!previous || node.defined) nodes.set(node.key, next);
    };
    remember(first.node); cursor = first.next; let from = first.node.key; let hadLink = false;
    while (cursor < raw.length) {
      const edge = linkAt(raw, cursor);
      if (!edge) {
        if (!hadLink && !raw.slice(cursor).trim()) break;
        throw new Error("Unsupported Mermaid connector on line " + (lineIndex + 1) + ".");
      }
      const target = nodeAt(raw, edge.next);
      if (!target) throw new Error("Expected a node after the connector on line " + (lineIndex + 1) + ".");
      remember(target.node); links.push({ from, to: target.node.key, ...edge.link });
      if (links.length > 500) throw new Error("A Mermaid import can contain up to 500 connectors.");
      from = target.node.key; cursor = target.next; hadLink = true;
    }
  }
  if (stack.length) throw new Error("Close the Mermaid subgraph with end.");
  if (!nodes.size) throw new Error("Add at least one node to the Mermaid flowchart.");
  if (nodes.size > 200) throw new Error("A Mermaid import can contain up to 200 nodes.");
  return { direction, nodes: [...nodes.values()], links, subgraphs };
}

/** Turn parsed Mermaid nodes and links into ordinary, editable canvas elements. */
export function layoutMermaidFlowchart(diagram: MermaidFlowchart, center: Point): Element[] {
  const incoming = new Map(diagram.nodes.map(node => [node.key, 0]));
  const outgoing = new Map(diagram.nodes.map(node => [node.key, [] as string[]]));
  for (const link of diagram.links) { incoming.set(link.to, (incoming.get(link.to) ?? 0) + 1); outgoing.get(link.from)?.push(link.to); }
  const rank = new Map(diagram.nodes.map(node => [node.key, 0])); const degree = new Map(incoming); const queue = diagram.nodes.filter(node => !degree.get(node.key));
  for (let at = 0; at < queue.length; at++) {
    const key = queue[at].key;
    for (const target of outgoing.get(key) ?? []) {
      rank.set(target, Math.max(rank.get(target) ?? 0, (rank.get(key) ?? 0) + 1));
      degree.set(target, (degree.get(target) ?? 1) - 1);
      if (degree.get(target) === 0) queue.push(diagram.nodes.find(node => node.key === target)!);
    }
  }
  const columns = new Map<number, MermaidNode[]>();
  for (const node of diagram.nodes) { const level = rank.get(node.key) ?? 0; columns.set(level, [...(columns.get(level) ?? []), node]); }
  const isHorizontal = diagram.direction === "LR" || diagram.direction === "RL"; const reverse = diagram.direction === "RL" || diagram.direction === "BT";
  const levels = [...columns.keys()].sort((a, b) => a - b); const maxLevel = levels[levels.length - 1] ?? 0;
  const positions = new Map<string, ShapeElement>();
  for (const [level, members] of columns) members.forEach((node, slot) => {
    const major = (level - maxLevel / 2) * (isHorizontal ? 286 : 170) * (reverse ? -1 : 1);
    const minor = (slot - (members.length - 1) / 2) * (isHorizontal ? 142 : 244);
    const width = node.shape === "circle" ? 112 : 184; const height = node.shape === "circle" ? 92 : 78;
    const x = center.x + (isHorizontal ? major : minor) - width / 2; const y = center.y + (isHorizontal ? minor : major) - height / 2;
    const shape: ShapeElement = { type: node.shape === "diamond" ? "diamond" : node.shape === "circle" ? "circle" : "rectangle", id: "mermaid-node:" + node.key, x, y, w: width, h: height, color: "#657f98", thickness: 1.6, fillColor: "#f3f7fb", fillOpacity: 1, edgeStyle: node.shape === "rounded" ? "pill" : "rounded", cornerRadius: node.shape === "rounded" ? 28 : 12, label: { text: node.label, color: "#33495d", fontSize: 14, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } };
    positions.set(node.key, shape);
  });
  const framesById = new Map<string, ShapeElement>();
  const subgraphById = new Map(diagram.subgraphs.map(item => [item.id, item]));
  const depth = (item: MermaidSubgraph) => { let count = 0; let parent = item.parentId; while (parent) { count++; parent = subgraphById.get(parent)?.parentId; } return count; };
  const belongs = (node: MermaidNode, ownerId: string) => { let current = node.subgraphId; while (current) { if (current === ownerId) return true; current = subgraphById.get(current)?.parentId; } return false; };
  for (const subgraph of [...diagram.subgraphs].sort((a, b) => depth(b) - depth(a))) {
    const members = diagram.nodes.filter(node => belongs(node, subgraph.id)).map(node => positions.get(node.key)).filter((node): node is ShapeElement => !!node);
    const childFrames = diagram.subgraphs.filter(item => item.parentId === subgraph.id).map(item => framesById.get(item.id)).filter((frame): frame is ShapeElement => !!frame);
    const content = [...members, ...childFrames];
    if (!content.length) continue;
    const left = Math.min(...content.map(item => item.x)); const top = Math.min(...content.map(item => item.y)); const right = Math.max(...content.map(item => item.x + item.w)); const bottom = Math.max(...content.map(item => item.y + item.h));
    framesById.set(subgraph.id, { type: "rectangle", id: "mermaid-subgraph:" + subgraph.id, x: left - 24, y: top - 56, w: right - left + 48, h: bottom - top + 78, color: "#91a4b6", thickness: 1.3, lineStyle: "dashed", fillColor: "#eaf0f5", fillOpacity: .6, edgeStyle: "rounded", cornerRadius: 14, label: { text: subgraph.title, color: "#52697e", fontSize: 12, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "top" } });
  }
  const frames = [...diagram.subgraphs].sort((a, b) => depth(a) - depth(b)).map(subgraph => framesById.get(subgraph.id)).filter((frame): frame is ShapeElement => !!frame);
  const nodes = [...positions.values()];
  const links: ShapeElement[] = diagram.links.map((link, index) => {
    const from = positions.get(link.from)!; const to = positions.get(link.to)!;
    const fromRank = rank.get(link.from) ?? 0; const toRank = rank.get(link.to) ?? 0;
    const forward = fromRank === toRank ? (isHorizontal ? from.x <= to.x : from.y <= to.y) : reverse ? fromRank > toRank : fromRank < toRank;
    const horizontal = isHorizontal || (fromRank === toRank && Math.abs(to.x - from.x) > Math.abs(to.y - from.y));
    const startAnchor = horizontal ? { x: forward ? 1 : 0, y: .5 } : { x: .5, y: forward ? 1 : 0 };
    const endAnchor = horizontal ? { x: forward ? 0 : 1, y: .5 } : { x: .5, y: forward ? 0 : 1 };
    const start = { x: from.x + from.w * startAnchor.x, y: from.y + from.h * startAnchor.y };
    const end = { x: to.x + to.w * endAnchor.x, y: to.y + to.h * endAnchor.y };
    return { type: "line", id: "mermaid-link:" + index, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color: "#71869b", thickness: link.thickness, lineStyle: link.lineStyle, startHead: link.startHead, endHead: link.endHead, startBinding: { elementId: from.id!, anchor: startAnchor }, endBinding: { elementId: to.id!, anchor: endAnchor }, ...(link.label ? { label: { text: link.label, color: "#566b7e", fontSize: 11, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" as const } } : {}) } as ShapeElement;
  });
  return [...frames, ...nodes, ...links];
}
