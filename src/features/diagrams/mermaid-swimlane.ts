import type { Element, Point, ShapeElement } from "../../model";
import { parseMermaidFlowchart } from "../../mermaid";

const laneRole = "mermaid-swimlane-lane:";
const nodeRole = "mermaid-swimlane-node:";
const encode = (value: string) => encodeURIComponent(value);
const decode = (value: string) => { try { return decodeURIComponent(value); } catch { return value; } };

function sourceLines(source: string) { return source.replace(/\r/g, "").split("\n"); }

function headerInfo(lines: string[]) {
  let header = 0;
  while (header < lines.length && (!lines[header].trim() || /^\s*%%/.test(lines[header]))) header++;
  let frontmatter: string[] = []; let frontmatterStart = -1; let frontmatterEnd = -1;
  if (lines[header]?.trim() === "---") {
    const end = lines.findIndex((line, index) => index > header && line.trim() === "---");
    if (end < 0) return undefined;
    frontmatterStart = header; frontmatterEnd = end;
    frontmatter = lines.slice(header, end + 1);
    header = end + 1;
    while (header < lines.length && (!lines[header].trim() || /^\s*%%/.test(lines[header]))) header++;
  }
  const match = /^\s*swimlane-beta(?:\s+(TB|TD|BT|LR|RL))?\s*$/i.exec(lines[header] ?? "");
  if (!match) return undefined;
  const direction = (match[1] ?? "TD").toUpperCase() as "TB" | "TD" | "BT" | "LR" | "RL";
  return { header, frontmatter, frontmatterStart, frontmatterEnd, direction };
}

export function isMermaidSwimlane(source: string) { return headerInfo(sourceLines(source)) !== undefined; }

function sourceDiagnostic(message: string, lineIndex: number, columnIndex = 0) {
  throw new Error(`${message} (line ${lineIndex + 1}, column ${columnIndex + 1}).`);
}

export function parseMermaidSwimlane(source: string) {
  if (source.length > 100_000) throw new Error("Mermaid input is limited to 100,000 characters.");
  const lines = sourceLines(source); const header = headerInfo(lines);
  if (!header) throw new Error("Expected a swimlane-beta header.");
  const normalized = [...lines];
  for (let index = 0; index < header.header; index++) normalized[index] = "";
  for (let index = header.frontmatterStart; index >= 0 && index <= header.frontmatterEnd; index++) normalized[index] = "";
  normalized[header.header] = `flowchart ${header.direction === "TB" ? "TD" : header.direction}`;
  let accessibilityBlock = false;
  for (let index = header.header + 1; index < lines.length; index++) {
    const raw = lines[index]; const line = raw.trim();
    if (accessibilityBlock) { normalized[index] = ""; if (/^\s*\}/.test(line)) accessibilityBlock = false; continue; }
    if (/^accTitle\s*:/i.test(line) || /^accDescr\s*:/i.test(line)) { normalized[index] = ""; continue; }
    if (/^accDescr\s*\{/i.test(line)) { normalized[index] = ""; accessibilityBlock = true; continue; }
    if (/^(?:classDef\b|class\s|style\s|linkStyle\b|click\s)/i.test(line)) sourceDiagnostic("Mermaid swimlane styling and click directives are outside the editable subset", index, raw.search(/\S/));
    if (/^direction\s+/i.test(line)) sourceDiagnostic("Set Mermaid swimlane direction on the swimlane-beta header", index, raw.search(/\S/));
  }
  const flow = parseMermaidFlowchart(normalized.join("\n"));
  if (!flow.subgraphs.length) throw new Error("Mermaid swimlanes need at least one top-level subgraph lane.");
  if (flow.subgraphs.some(lane => lane.parentId)) throw new Error("Nested Mermaid swimlane lanes are not supported yet.");
  if (flow.nodes.some(node => !node.subgraphId || !flow.subgraphs.some(lane => lane.id === node.subgraphId))) throw new Error("Every Mermaid swimlane node must be declared inside a top-level subgraph lane.");
  return { ...flow, direction: header.direction };
}

function quote(value: string) { return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/[\r\n]+/g, " ")}"`; }

function anchor(bounds: { x: number; y: number; w: number; h: number }, target: { x: number; y: number; w: number; h: number }) {
  const dx = target.x + target.w / 2 - (bounds.x + bounds.w / 2); const dy = target.y + target.h / 2 - (bounds.y + bounds.h / 2);
  return Math.abs(dx) >= Math.abs(dy) ? { start: { x: dx >= 0 ? 1 : 0, y: .5 }, end: { x: dx >= 0 ? 0 : 1, y: .5 } } : { start: { x: .5, y: dy >= 0 ? 1 : 0 }, end: { x: .5, y: dy >= 0 ? 0 : 1 } };
}

export function layoutMermaidSwimlane(source: string, center: Point): Element[] {
  const graph = parseMermaidSwimlane(source); const horizontalFlow = graph.direction === "LR" || graph.direction === "RL"; const reverse = graph.direction === "RL" || graph.direction === "BT";
  const orderedLanes = reverse ? [...graph.subgraphs].reverse() : graph.subgraphs;
  const nodesByLane = new Map(graph.subgraphs.map(lane => [lane.id, graph.nodes.filter(node => node.subgraphId === lane.id)]));
  const laneWidth = horizontalFlow ? 246 : Math.max(300, ...[...nodesByLane.values()].map(nodes => nodes.length * 214 + 48));
  const laneHeight = horizontalFlow ? Math.max(190, ...[...nodesByLane.values()].map(nodes => nodes.length * 106 + 56)) : 184;
  const laneGap = 24; const totalWidth = horizontalFlow ? graph.subgraphs.length * laneWidth + Math.max(0, graph.subgraphs.length - 1) * laneGap : laneWidth;
  const totalHeight = horizontalFlow ? laneHeight : graph.subgraphs.length * laneHeight + Math.max(0, graph.subgraphs.length - 1) * laneGap;
  const left = center.x - totalWidth / 2; const top = center.y - totalHeight / 2; const laneBounds = new Map<string, { x: number; y: number; w: number; h: number }>();
  orderedLanes.forEach((lane, index) => {
    const x = horizontalFlow ? left + index * (laneWidth + laneGap) : left; const y = horizontalFlow ? top : top + index * (laneHeight + laneGap);
    laneBounds.set(lane.id, { x, y, w: laneWidth, h: laneHeight });
  });
  const positions = new Map<string, ShapeElement>(); const laneFrames: ShapeElement[] = [];
  for (const lane of graph.subgraphs) {
    const bounds = laneBounds.get(lane.id)!;
    laneFrames.push({ type: "rectangle", id: `mermaid-lane:${lane.id}`, componentRole: `${laneRole}${encode(lane.id)}`, ...bounds, color: "#8297aa", thickness: 1.5, lineStyle: "solid", fillColor: "#edf2f6", fillOpacity: .45, edgeStyle: "sharp", label: { text: lane.title, color: "#40576d", fontSize: 13, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "top" } });
    const members = nodesByLane.get(lane.id) ?? [];
    members.forEach((node, memberIndex) => {
      const offset = reverse ? members.length - memberIndex - 1 : memberIndex;
      const x = horizontalFlow ? bounds.x + 32 : bounds.x + 38 + offset * 214;
      const y = horizontalFlow ? bounds.y + 48 + offset * 106 : bounds.y + 55;
      const width = horizontalFlow ? 182 : 172; const height = 66;
      const shape: ShapeElement = {
        type: node.shape === "diamond" ? "diamond" : node.shape === "circle" ? "circle" : "rectangle",
        id: `mermaid-node:${node.key}`, componentRole: `${nodeRole}${encode(lane.id)}`,
        x, y, w: width, h: height, color: node.color ?? "#657f98", thickness: node.thickness ?? 1.6,
        fillColor: node.fillColor ?? "#ffffff", fillOpacity: 1, ...(node.lineStyle ? { lineStyle: node.lineStyle } : {}),
        edgeStyle: node.shape === "rounded" ? "pill" : "sharp", cornerRadius: node.shape === "rounded" ? 26 : 0,
        label: { text: node.label, color: node.labelColor ?? "#33495d", fontSize: 12, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" },
      };
      positions.set(node.key, shape);
    });
  }
  const links = graph.links.flatMap((link, index) => {
    const from = positions.get(link.from); const to = positions.get(link.to); if (!from || !to) return [];
    const anchors = anchor(from, to); const start = { x: from.x + from.w * anchors.start.x, y: from.y + from.h * anchors.start.y }; const end = { x: to.x + to.w * anchors.end.x, y: to.y + to.h * anchors.end.y };
    return [{ type: "arrow" as const, id: `mermaid-link:${index}`, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color: link.color ?? "#71869b", thickness: link.thickness, lineStyle: link.lineStyle, autoRoute: true, arrowRoute: "elbow" as const, startHead: link.startHead, endHead: link.endHead, startBinding: { elementId: from.id!, anchor: anchors.start }, endBinding: { elementId: to.id!, anchor: anchors.end }, ...(link.label ? { label: { text: link.label, color: "#52697e", fontSize: 11, fontFamily: "sans" as const, bold: false, italic: false, underline: false, textAlign: "center" as const, listType: "none" as const, verticalAlign: "top" as const } } : {}) }];
  });
  return [...laneFrames, ...links, ...positions.values()];
}

function flatten(elements: Element[]): Element[] { return elements.flatMap(item => item.hidden ? [] : item.type === "group" ? flatten(item.elements) : [item]); }

function originalSwimlaneMetadata(source: string) {
  const lines = sourceLines(source); const header = headerInfo(lines); if (!header) return { frontmatter: [], accessibility: [] as string[] };
  const accessibility: string[] = []; let inDescription = false;
  for (const line of lines.slice(header.header + 1)) {
    if (inDescription) { accessibility.push(line); if (/^\s*\}/.test(line)) inDescription = false; continue; }
    if (/^\s*acc(?:Title|Descr)\s*:/i.test(line)) accessibility.push(line.trim());
    else if (/^\s*accDescr\s*\{/i.test(line)) { accessibility.push(line.trim()); inDescription = true; }
  }
  return { frontmatter: header.frontmatter, accessibility };
}

export function exportMermaidSwimlane(elements: Element[], originalSource = "") {
  const items = flatten(elements); const lanes = items.filter((item): item is ShapeElement => item.type === "rectangle" && item.componentRole?.startsWith(laneRole) === true);
  const nodes = items.filter((item): item is ShapeElement => ["rectangle", "circle", "diamond", "flowchart"].includes(item.type) && item.id?.startsWith("mermaid-node:") === true);
  if (!lanes.length) throw new Error("This Mermaid swimlane diagram has no editable lanes to export.");
  const laneId = (item: ShapeElement) => decode(item.componentRole!.slice(laneRole.length));
  const nodeKey = (item: ShapeElement) => item.id!.slice("mermaid-node:".length);
  const sortedLanes = [...lanes].sort((a, b) => {
    const sourceDirection = headerInfo(sourceLines(originalSource))?.direction ?? "TD"; const reverse = sourceDirection === "BT" || sourceDirection === "RL";
    const primary = sourceDirection === "LR" || sourceDirection === "RL" ? a.x - b.x : a.y - b.y;
    return reverse ? -primary : primary;
  });
  const inLane = (node: ShapeElement, lane: ShapeElement) => {
    const cx = node.x + node.w / 2; const cy = node.y + node.h / 2;
    return cx >= lane.x && cx <= lane.x + lane.w && cy >= lane.y && cy <= lane.y + lane.h;
  };
  const assignedLane = (node: ShapeElement) => sortedLanes.filter(lane => inLane(node, lane)).sort((a, b) => a.w * a.h - b.w * b.h)[0]
    ?? sortedLanes.find(lane => laneId(lane) === decode((node.componentRole ?? "").slice(nodeRole.length)));
  const quoteLabel = (value: string) => quote(value.trim() || " ");
  const nodeDefinition = (node: ShapeElement) => {
    const id = nodeKey(node); const label = quoteLabel(node.label?.text ?? id);
    if (node.type === "circle") return `${id}((${label}))`;
    if (node.type === "diamond") return `${id}{${label}}`;
    if (node.type === "flowchart" || node.edgeStyle === "pill") return `${id}([${label}])`;
    return `${id}[${label}]`;
  };
  const lines = [`swimlane-beta ${headerInfo(sourceLines(originalSource))?.direction ?? "TD"}`];
  const metadata = originalSwimlaneMetadata(originalSource);
  if (metadata.frontmatter.length) lines.unshift(...metadata.frontmatter);
  lines.push(...metadata.accessibility.map(line => line.trim()));
  for (const lane of sortedLanes) {
    const id = laneId(lane); const label = lane.label?.text?.trim() || id;
    lines.push(`  subgraph ${id} [${quoteLabel(label)}]`);
    const members = nodes.filter(node => assignedLane(node) === lane);
    const horizontal = (headerInfo(sourceLines(originalSource))?.direction ?? "TD") === "TD" || (headerInfo(sourceLines(originalSource))?.direction ?? "TD") === "TB";
    members.sort((a, b) => horizontal ? a.x - b.x : a.y - b.y);
    for (const node of members) lines.push(`    ${nodeDefinition(node)}`);
    lines.push("  end");
  }
  const byElementId = new Map(nodes.map(node => [node.id!, node]));
  for (const connector of items.filter((item): item is ShapeElement => (item.type === "line" || item.type === "arrow") && !!item.startBinding?.elementId && !!item.endBinding?.elementId)) {
    const from = byElementId.get(connector.startBinding!.elementId); const to = byElementId.get(connector.endBinding!.elementId); if (!from || !to) continue;
    const startHead = connector.startHead ?? "none"; const endHead = connector.endHead ?? "none";
    const headParts: Record<string, string> = { none: "", solid: "<", dot: "o", bar: "x" };
    const endParts: Record<string, string> = { none: "", solid: ">", dot: "o", bar: "x" };
    const operator = connector.lineStyle === "dotted"
      ? startHead === "none" && endHead === "none" ? "-.-" : "-.->"
      : connector.thickness >= 3 ? startHead === "none" && endHead === "none" ? "===" : "==>"
      : startHead === "none" && endHead === "none" ? "---" : `${headParts[startHead] ?? ""}--${endParts[endHead] ?? ""}`;
    const label = connector.label?.text?.trim(); const labeled = label ? `${operator}|${label.replace(/\|/g, "/")}|` : operator;
    lines.push(`  ${nodeKey(from)} ${labeled} ${nodeKey(to)}`);
  }
  return lines.join("\n") + "\n";
}
