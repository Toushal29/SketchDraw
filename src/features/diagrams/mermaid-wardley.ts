import type { Element, Point, ShapeElement, TextElement } from "../../model";

type WardleyKind = "component" | "anchor";
type WardleyStrategy = "build" | "buy" | "outsource" | "market";
type WardleyNode = { name: string; kind: WardleyKind; visibility: number; evolution: number; strategy?: WardleyStrategy; inertia: boolean; labelOffset?: Point; pipeline?: string; pipelineVisibility?: number; line: number };
type WardleyEdge = { from: string; to: string; operator: "->" | "-->" | "-.->" | "+>" | "+<" | "+<>" | "+label"; label: string; line: number };
type WardleyMarker = { kind: "note" | "accelerator" | "deaccelerator" | "annotation" | "trend"; label: string; visibility: number; evolution: number; number?: number; node?: string; trendKind?: "evolve" | "projection"; line: number };
type WardleyStage = { label: string; position: number };
type WardleyDiagram = { title: string; width: number; height: number; nodes: WardleyNode[]; edges: WardleyEdge[]; markers: WardleyMarker[]; stages: WardleyStage[]; customStages: boolean; annotationPosition?: Point };

const DEFAULT_STAGES: WardleyStage[] = [
  { label: "Genesis", position: 0 }, { label: "Custom", position: .25 },
  { label: "Product", position: .5 }, { label: "Commodity", position: .75 }, { label: "Utility", position: 1 },
];
const STRATEGIES = new Set<WardleyStrategy>(["build", "buy", "outsource", "market"]);
const encode = (value: unknown) => encodeURIComponent(JSON.stringify(value));
const decode = <T,>(value: string): T => JSON.parse(decodeURIComponent(value)) as T;

function cleanLines(source: string) { return source.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n"); }
function firstBodyLine(lines: string[]) {
  let index = 0;
  while (index < lines.length && (!lines[index].trim() || /^\s*%%/.test(lines[index]))) index++;
  if (lines[index]?.trim() === "---") {
    const end = lines.findIndex((line, current) => current > index && line.trim() === "---");
    if (end < 0) return -1;
    index = end + 1;
    while (index < lines.length && (!lines[index].trim() || /^\s*%%/.test(lines[index]))) index++;
  }
  return index;
}

export function isMermaidWardley(source: string) {
  const lines = cleanLines(source); const index = firstBodyLine(lines);
  return index >= 0 && /^wardley-beta\s*$/i.test(lines[index] ?? "");
}

function fail(message: string, raw: string, index: number, column = raw.search(/\S/)): never {
  throw new Error(`${message} (line ${index + 1}, column ${Math.max(1, column + 1)}).`);
}

function stripComment(line: string) {
  let quote = ""; let escaped = false;
  for (let index = 0; index < line.length - 1; index++) {
    const char = line[index];
    if (escaped) { escaped = false; continue; }
    if (char === "\\" && quote) { escaped = true; continue; }
    if ((char === "\"" || char === "'") && (!quote || quote === char)) { quote = quote ? "" : char; continue; }
    if (!quote && line.slice(index, index + 2) === "%%") return line.slice(0, index);
  }
  return line;
}

function unquote(value: string) {
  const input = value.trim();
  if (input.length < 2 || !((input[0] === "\"" && input[input.length - 1] === "\"") || (input[0] === "'" && input[input.length - 1] === "'"))) return input;
  return input.slice(1, -1).replace(/\\([\\"'])/g, "$1");
}

function quote(value: string) { return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/[\r\n]+/g, " ")}"`; }

function coordinatePair(value: string, raw: string, lineIndex: number, allowSingle = false): Point {
  const parts = value.split(",").map(part => Number(part.trim()));
  if (allowSingle && parts.length === 1) parts.push(0);
  if (parts.length !== 2 || parts.some(part => !Number.isFinite(part)) || parts.some(part => part < 0 || part > 1)) fail("Wardley coordinates must contain values from 0 to 1", raw, lineIndex);
  return { x: parts[0], y: parts[1] };
}

function parseStage(source: string, raw: string, lineIndex: number): WardleyStage[] {
  const tokens = source.split(/\s*->\s*/).map(value => value.trim());
  if (tokens.length < 2 || tokens.length > 12) fail("Wardley evolution needs 2 to 12 stages", raw, lineIndex);
  const stages: WardleyStage[] = tokens.map((token, index) => {
    const match = /^(.*?)(?:@([\d.]+))?$/.exec(token); const label = unquote(match?.[1] ?? "").trim();
    if (!label) fail("Wardley evolution stage labels cannot be empty", raw, lineIndex);
    const position = match?.[2] === undefined ? index / (tokens.length - 1) : Number(match[2]);
    if (!Number.isFinite(position) || position < 0 || position > 1) fail("Wardley evolution stage positions must be from 0 to 1", raw, lineIndex);
    return { label, position };
  });
  if (stages.some((stage, index) => index > 0 && stage.position <= stages[index - 1].position)) fail("Wardley evolution stage positions must increase from left to right", raw, lineIndex);
  return stages;
}

function splitNameAndNumber(value: string, raw: string, lineIndex: number): { name: string; number: number } {
  const match = /^(.*?)\s+([+-]?(?:\d+\.?\d*|\.\d+))$/.exec(value.trim());
  const number = Number(match?.[2]);
  if (!match || !match[1].trim() || !Number.isFinite(number) || number < 0 || number > 1) fail("Expected a Wardley component name followed by a coordinate from 0 to 1", raw, lineIndex);
  return { name: unquote(match[1]), number };
}

function parseNode(line: string, raw: string, lineIndex: number, pipeline?: { name: string; visibility: number }): WardleyNode | undefined {
  const match = /^(component|anchor)\s+(.+?)\s*\[([^\]]+)\](.*)$/i.exec(line);
  if (!match) return undefined;
  const kind = match[1].toLowerCase() as WardleyKind; const name = unquote(match[2].trim());
  if (!name || name.length > 180) fail("Wardley node labels must contain 1 to 180 characters", raw, lineIndex);
  const coordinates = match[3].split(",").map(value => Number(value.trim()));
  if (pipeline) {
    if (kind !== "component" || coordinates.length !== 1 || !Number.isFinite(coordinates[0]) || coordinates[0] < 0 || coordinates[0] > 1) fail("Pipeline members use component Name [evolution] with a coordinate from 0 to 1", raw, lineIndex);
    coordinates.unshift(pipeline.visibility);
  } else if (coordinates.length !== 2 || coordinates.some(value => !Number.isFinite(value) || value < 0 || value > 1)) fail("Wardley nodes use [visibility, evolution] coordinates from 0 to 1", raw, lineIndex);
  let suffix = match[4].trim(); let labelOffset: Point | undefined;
  const offset = /\blabel\s+\[([^\]]+)\]/i.exec(suffix);
  if (offset) {
    const values = offset[1].split(",").map(value => Number(value.trim()));
    if (values.length !== 2 || values.some(value => !Number.isFinite(value) || Math.abs(value) > 1000)) fail("Wardley label offsets need two values within 1000 units", raw, lineIndex, raw.indexOf(offset[0]));
    labelOffset = { x: values[0], y: values[1] }; suffix = suffix.replace(offset[0], "").trim();
  }
  const decorators = [...suffix.matchAll(/\(([\w-]+)\)/g)].map(item => item[1].toLowerCase());
  if (decorators.some(value => value !== "inertia" && !STRATEGIES.has(value as WardleyStrategy)) || new Set(decorators).size !== decorators.length) fail("Wardley node decorators support build, buy, outsource, market, and inertia", raw, lineIndex);
  for (const decorator of decorators) suffix = suffix.replace(`(${decorator})`, "");
  if (suffix.trim()) fail("Unsupported Wardley node modifier", raw, lineIndex, raw.indexOf(suffix));
  const strategy = decorators.find(value => STRATEGIES.has(value as WardleyStrategy)) as WardleyStrategy | undefined;
  return { name, kind, visibility: coordinates[0], evolution: coordinates[1], ...(strategy ? { strategy } : {}), inertia: decorators.includes("inertia"), ...(labelOffset ? { labelOffset } : {}), ...(pipeline ? { pipeline: pipeline.name, pipelineVisibility: pipeline.visibility } : {}), line: lineIndex + 1 };
}

function parseLink(line: string, raw: string, lineIndex: number): WardleyEdge | undefined {
  const match = /^(.+?)\s+(\+<>|\+>|\+<|\+'(?:[^']|\\')*'>|-\.->|-->|->)\s+(.+?)(?:\s*;\s*(.+))?$/.exec(line);
  if (!match) return undefined;
  const from = unquote(match[1]); const to = unquote(match[3]); let operator = match[2]; let label = unquote(match[4] ?? "");
  const inlineLabel = /^\+'((?:[^']|\\')*)'>$/.exec(operator);
  if (inlineLabel) { operator = "+label"; label = unquote(`'${inlineLabel[1]}'`); }
  if (!from || !to) fail("Wardley dependencies need source and target components", raw, lineIndex);
  return { from, to, operator: operator as WardleyEdge["operator"], label, line: lineIndex + 1 };
}

export function parseMermaidWardley(source: string): WardleyDiagram {
  if (source.length > 150_000) throw new Error("Mermaid Wardley input is limited to 150,000 characters.");
  const lines = cleanLines(source); const header = firstBodyLine(lines);
  if (header < 0 || !/^wardley-beta\s*$/i.test(lines[header] ?? "")) throw new Error("Expected a wardley-beta header.");
  for (let index = 0; index < header; index++) {
    const setting = lines[index].trim();
    if (/^themeVariables\s*:/i.test(setting) || /^theme\s*:/i.test(setting)) fail("Wardley Mermaid theme overrides are preserved but not rendered by this editable subset", lines[index], index);
    if (/^look\s*:\s*handDrawn\b/i.test(setting)) fail("Wardley hand-drawn rendering is not supported by this editable subset", lines[index], index);
  }
  const nodes: WardleyNode[] = []; const edges: WardleyEdge[] = []; const markers: WardleyMarker[] = [];
  let title = ""; let width = 1100; let height = 700; let stages = DEFAULT_STAGES; let customStages = false;
  let activePipeline: { name: string; visibility: number } | undefined; let annotationPosition: Point | undefined;
  for (let index = header + 1; index < lines.length; index++) {
    const raw = lines[index]; const line = stripComment(raw).trim(); if (!line) continue;
    if (/^title\s+/i.test(line)) { title = unquote(line.replace(/^title\s+/i, "")); continue; }
    if (/^accTitle\s*:/i.test(line) || /^accDescr(?:\s*:|\s*\{)/i.test(line)) {
      if (/^accDescr\s*\{/i.test(line)) while (++index < lines.length && !/^\s*\}/.test(lines[index])) { /* retain block in source metadata */ }
      continue;
    }
    const size = /^size\s+\[([^\]]+)\]\s*$/i.exec(line);
    if (size) {
      const pair = size[1].split(",").map(value => Number(value.trim()));
      if (pair.length !== 2 || pair.some(value => !Number.isInteger(value) || value < 400 || value > 2400)) fail("Wardley map size needs width and height from 400 to 2400", raw, index);
      width = pair[0]; height = pair[1]; continue;
    }
    const evolution = /^evolution\s+(.+)$/i.exec(line);
    if (evolution) { stages = parseStage(evolution[1], raw, index); customStages = true; continue; }
    const pipeline = /^pipeline\s+(.+?)\s*\{\s*$/i.exec(line);
    if (pipeline) {
      if (activePipeline) fail("Nested Wardley pipelines are not supported", raw, index);
      const parentName = unquote(pipeline[1]); const parent = nodes.find(node => node.name === parentName);
      if (!parent) fail(`Wardley pipeline parent ${parentName} must be declared first`, raw, index);
      activePipeline = { name: parentName, visibility: parent.visibility }; continue;
    }
    if (line === "}") { if (!activePipeline) fail("Unexpected Wardley pipeline close", raw, index); activePipeline = undefined; continue; }
    const node = parseNode(line, raw, index, activePipeline);
    if (node) {
      if (nodes.some(item => item.name === node.name)) fail(`Duplicate Wardley component name: ${node.name}`, raw, index);
      nodes.push(node); if (nodes.length > 300) fail("Wardley diagrams are limited to 300 components", raw, index); continue;
    }
    const evolve = /^evolve\s+(.+)$/i.exec(line);
    if (evolve) {
      const { name, number } = splitNameAndNumber(evolve[1], raw, index); const component = nodes.find(item => item.name === name);
      if (!component) fail(`Wardley evolve references unknown component ${name}`, raw, index);
      markers.push({ kind: "trend", trendKind: "evolve", label: "", visibility: component.visibility, evolution: number, node: name, line: index + 1 }); continue;
    }
    const note = /^(note|accelerator|deaccelerator)\s+(["'].*["'])\s+\[([^\]]+)\]\s*$/i.exec(line);
    if (note) {
      const coordinates = coordinatePair(note[3], raw, index); const kind = note[1].toLowerCase() as WardleyMarker["kind"];
      markers.push({ kind, label: unquote(note[2]), visibility: coordinates.x, evolution: coordinates.y, line: index + 1 }); continue;
    }
    const annotationAnchor = /^annotations\s+\[([^\]]+)\]\s*$/i.exec(line);
    if (annotationAnchor) { annotationPosition = coordinatePair(annotationAnchor[1], raw, index); continue; }
    const annotation = /^annotation\s+(\d+)\s*,\s*\[([^\]]+)\]\s+(["'].*["'])\s*$/i.exec(line);
    if (annotation) {
      const coordinates = coordinatePair(annotation[2], raw, index); markers.push({ kind: "annotation", label: unquote(annotation[3]), visibility: coordinates.y, evolution: coordinates.x, number: Number(annotation[1]), line: index + 1 }); continue;
    }
    const trend = /^(.+?)\s+-\.\-\s*\(([^,()]+),\s*([^()]+)\)\s*$/i.exec(line);
    if (trend) {
      const name = unquote(trend[1]); if (!nodes.some(node => node.name === name)) fail(`Wardley trend references unknown component ${name}`, raw, index);
      const pair = [Number(trend[2]), Number(trend[3])]; if (pair.some(value => !Number.isFinite(value) || value < 0 || value > 1)) fail("Wardley trend coordinates must be from 0 to 1", raw, index);
      markers.push({ kind: "trend", trendKind: "projection", label: "", visibility: pair[1], evolution: pair[0], node: name, line: index + 1 }); continue;
    }
    const edge = parseLink(line, raw, index);
    if (edge) { edges.push(edge); if (edges.length > 600) fail("Wardley diagrams are limited to 600 dependencies", raw, index); continue; }
    if (/^acc(?:Title|Descr)\b/i.test(line)) continue;
    fail("Unsupported Mermaid Wardley syntax", raw, index);
  }
  if (activePipeline) throw new Error("Wardley pipeline is missing its closing brace.");
  if (!nodes.length) throw new Error("A Mermaid Wardley map needs at least one anchor or component.");
  for (const edge of edges) {
    if (!nodes.some(node => node.name === edge.from)) fail(`Wardley dependency references unknown component ${edge.from}`, lines[edge.line - 1] ?? "", edge.line - 1);
    if (!nodes.some(node => node.name === edge.to)) fail(`Wardley dependency references unknown component ${edge.to}`, lines[edge.line - 1] ?? "", edge.line - 1);
  }
  return { title, width, height, nodes, edges, markers, stages, customStages, ...(annotationPosition ? { annotationPosition } : {}) };
}

function textElement(id: string, role: string, x: number, y: number, text: string, color: string, fontSize: number, bold = false, wrapWidth?: number): TextElement {
  return { type: "text", id, componentRole: role, x, y, text, color, fontSize, bold, fontFamily: "sans", textAlign: "left", listType: "none", ...(wrapWidth ? { wrapWidth } : {}) };
}

function mapPoint(plot: { x: number; y: number; w: number; h: number }, visibility: number, evolution: number): Point {
  return { x: plot.x + evolution * plot.w, y: plot.y + (1 - visibility) * plot.h };
}

function roleMetadata(node: WardleyNode) {
  return `mermaid-wardley-node:${encode({ name: node.name, kind: node.kind, strategy: node.strategy, inertia: node.inertia, pipeline: node.pipeline, pipelineVisibility: node.pipelineVisibility })}`;
}

export function layoutMermaidWardley(source: string, center: Point): Element[] {
  const diagram = parseMermaidWardley(source); const x = center.x - diagram.width / 2; const y = center.y - diagram.height / 2;
  const plot = { x: x + 74, y: y + 48, w: diagram.width - 112, h: diagram.height - 116 };
  const result: Element[] = []; const nodes = new Map<string, ShapeElement>(); const labels = new Map<string, TextElement>();
  result.push({ type: "rectangle", id: "mermaid-wardley-frame", componentRole: "mermaid-wardley-frame", x, y, w: diagram.width, h: diagram.height, color: "#9ba9b8", thickness: 1, fillColor: "#ffffff", fillOpacity: .96, edgeStyle: "sharp" });
  result.push({ type: "rectangle", id: "mermaid-wardley-plot", componentRole: "mermaid-wardley-plot", ...plot, color: "#9ba9b8", thickness: 1, fillColor: "#ffffff", fillOpacity: .18, edgeStyle: "sharp" });
  if (diagram.title) result.push(textElement("mermaid-wardley-title", "mermaid-wardley-title", plot.x, y + 12, diagram.title, "#243447", 20, true));
  result.push(textElement("mermaid-wardley-y-axis", "mermaid-wardley-axis", x + 10, plot.y + plot.h / 2, "Visibility", "#526273", 12, true));
  result.push(textElement("mermaid-wardley-x-axis", "mermaid-wardley-axis", plot.x + plot.w / 2, plot.y + plot.h + 33, "Evolution", "#526273", 12, true));
  for (let tick = 0; tick <= 4; tick++) {
    const fraction = tick / 4; const tickY = plot.y + (1 - fraction) * plot.h;
    result.push({ type: "line", id: `mermaid-wardley-grid-y:${tick}`, componentRole: "mermaid-wardley-grid", x: plot.x, y: tickY, w: plot.w, h: 0, color: "#dce2e8", thickness: 1, lineStyle: "dotted" });
    result.push(textElement(`mermaid-wardley-y-tick:${tick}`, "mermaid-wardley-axis", x + 42, tickY - 6, fraction.toFixed(2), "#738091", 9));
  }
  if (diagram.customStages) {
    diagram.stages.forEach((stage, index) => {
      const stageX = plot.x + stage.position * plot.w;
      if (index > 0 && index < diagram.stages.length - 1) result.push({ type: "line", id: `mermaid-wardley-stage-line:${index}`, componentRole: "mermaid-wardley-grid", x: stageX, y: plot.y, w: 0, h: plot.h, color: "#e3e7eb", thickness: 1, lineStyle: "dotted" });
      result.push(textElement(`mermaid-wardley-stage:${index}`, `mermaid-wardley-stage:${encode({ position: stage.position, custom: true })}`, stageX - 32, plot.y + plot.h + 8, stage.label, "#59697b", 10, true, 88));
    });
  } else {
    diagram.stages.forEach((stage, index) => {
      const pos = index / (diagram.stages.length - 1); const stageX = plot.x + pos * plot.w;
      if (index > 0 && index < diagram.stages.length - 1) result.push({ type: "line", id: `mermaid-wardley-stage-line:${index}`, componentRole: "mermaid-wardley-grid", x: stageX, y: plot.y, w: 0, h: plot.h, color: "#e3e7eb", thickness: 1, lineStyle: "dotted" });
      result.push(textElement(`mermaid-wardley-stage:${index}`, `mermaid-wardley-stage:${encode({ position: pos, custom: false })}`, stageX - 30, plot.y + plot.h + 8, stage.label, "#59697b", 10, true, 84));
    });
  }
  for (const node of diagram.nodes) {
    const point = mapPoint(plot, node.visibility, node.evolution); const size = node.kind === "anchor" ? 24 : 18;
    const type: ShapeElement["type"] = node.kind === "anchor" ? "circle" : node.strategy === "build" ? "triangle" : node.strategy === "buy" ? "diamond" : "rectangle";
    const shape: ShapeElement = { type, id: `mermaid-wardley-node:${encode(node.name)}`, componentRole: roleMetadata(node), x: point.x - size / 2, y: point.y - size / 2, w: size, h: size, color: node.kind === "anchor" ? "#385d7b" : node.inertia ? "#b36340" : "#4d6882", thickness: node.inertia ? 2.5 : 1.5, lineStyle: node.inertia ? "dashed" : "solid", fillColor: node.kind === "anchor" ? "#dceaf5" : node.strategy === "market" ? "#ecf3e9" : "#ffffff", fillOpacity: 1 };
    const labelPoint = { x: point.x + (node.labelOffset?.x ?? 14), y: point.y + (node.labelOffset?.y ?? -10) };
    const label = textElement(`mermaid-wardley-label:${encode(node.name)}`, `mermaid-wardley-label:${encode(node.name)}`, labelPoint.x, labelPoint.y, node.name, "#263647", node.kind === "anchor" ? 13 : 11, node.kind === "anchor", 200);
    nodes.set(node.name, shape); labels.set(node.name, label); result.push(shape, label);
    if (node.strategy) result.push(textElement(`mermaid-wardley-strategy:${encode(node.name)}`, `mermaid-wardley-strategy:${encode(node.name)}`, point.x + 11, point.y + 8, node.strategy, "#69798a", 8));
  }
  for (const [index, edge] of diagram.edges.entries()) {
    const from = nodes.get(edge.from)!; const to = nodes.get(edge.to)!; const reverse = edge.operator === "+<"; const both = edge.operator === "+<>";
    const link: ShapeElement = { type: "arrow", id: `mermaid-wardley-link:${index}`, componentRole: `mermaid-wardley-link:${encode({ from: edge.from, to: edge.to, operator: edge.operator })}`, x: from.x + from.w / 2, y: from.y + from.h / 2, w: to.x + to.w / 2 - (from.x + from.w / 2), h: to.y + to.h / 2 - (from.y + from.h / 2), color: "#627e98", thickness: 1.6, lineStyle: edge.operator === "-.->" ? "dashed" : "solid", arrowRoute: "straight", startHead: reverse || both ? "solid" : "none", endHead: reverse ? "none" : "solid", startBinding: { elementId: from.id!, anchor: { x: .5, y: .5 } }, endBinding: { elementId: to.id!, anchor: { x: .5, y: .5 } }, ...(edge.label ? { label: { text: edge.label, color: "#45586c", fontSize: 10, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" } } : {}) };
    result.push(link);
  }
  for (const [index, marker] of diagram.markers.entries()) {
    const point = mapPoint(plot, marker.visibility, marker.evolution);
    if (marker.kind === "trend" && marker.node) {
      const startNode = nodes.get(marker.node)!; const start = { x: startNode.x + startNode.w / 2, y: startNode.y + startNode.h / 2 };
      result.push({ type: "arrow", id: `mermaid-wardley-trend:${index}`, componentRole: `mermaid-wardley-trend:${encode({ node: marker.node, trendKind: marker.trendKind })}`, x: start.x, y: start.y, w: point.x - start.x, h: point.y - start.y, color: "#b84f47", thickness: 1.5, lineStyle: "dashed", arrowRoute: "straight", startHead: "none", endHead: "solid", startBinding: { elementId: startNode.id!, anchor: { x: .5, y: .5 } } });
      continue;
    }
    const label = marker.kind === "annotation" ? `${marker.number}. ${marker.label}` : marker.label;
    result.push({ type: "rectangle", id: `mermaid-wardley-marker:${index}`, componentRole: `mermaid-wardley-marker:${encode({ kind: marker.kind, number: marker.number })}`, x: point.x, y: point.y, w: Math.max(96, Math.min(230, label.length * 7 + 24)), h: marker.kind === "annotation" ? 38 : 30, color: marker.kind === "accelerator" ? "#628c69" : marker.kind === "deaccelerator" ? "#b46557" : "#818b96", thickness: 1, fillColor: marker.kind === "annotation" ? "#fff4cf" : "#ffffff", fillOpacity: 1, edgeStyle: "rounded", label: { text: label, color: "#33465a", fontSize: 10, fontFamily: "sans", bold: marker.kind === "accelerator", italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "middle", offsetX: 8, offsetY: 0 } });
  }
  if (diagram.annotationPosition) {
    const point = mapPoint(plot, diagram.annotationPosition.y, diagram.annotationPosition.x);
    result.push(textElement("mermaid-wardley-annotations-anchor", `mermaid-wardley-annotations-anchor:${encode(diagram.annotationPosition)}`, point.x, point.y, "Annotations", "#68788a", 10, true));
  }
  return result;
}

function flatten(elements: Element[]): Element[] { return elements.flatMap(item => item.hidden ? [] : item.type === "group" ? flatten(item.elements) : [item]); }
function sourceMetadata(source: string) {
  const lines = cleanLines(source); const header = firstBodyLine(lines); const metadata: string[] = [];
  if (header < 0) return { frontmatter: [] as string[], accessibility: metadata };
  const frontmatter = lines[0]?.trim() === "---" ? lines.slice(0, lines.findIndex((line, index) => index > 0 && line.trim() === "---") + 1) : [];
  for (let index = header + 1; index < lines.length; index++) {
    const line = lines[index];
    if (/^\s*(?:accTitle\s*:|accDescr\s*:)/i.test(line)) metadata.push(line.trim());
    else if (/^\s*accDescr\s*\{/i.test(line)) {
      metadata.push(line.trim());
      while (++index < lines.length) { metadata.push(lines[index]); if (/^\s*\}/.test(lines[index])) break; }
    }
  }
  return { frontmatter, accessibility: metadata };
}

export function exportMermaidWardley(elements: Element[], originalSource = "") {
  const items = flatten(elements); const frame = items.find((item): item is ShapeElement => item.type === "rectangle" && item.componentRole === "mermaid-wardley-frame");
  if (!frame) throw new Error("This Wardley map has no editable map boundary to export.");
  const plot = items.find((item): item is ShapeElement => item.type === "rectangle" && item.componentRole === "mermaid-wardley-plot");
  if (!plot) throw new Error("This Wardley map has no editable plotting area to export.");
  const title = items.find((item): item is TextElement => item.type === "text" && item.componentRole === "mermaid-wardley-title");
  const nodeShapes = items.filter((item): item is ShapeElement => ["rectangle", "circle", "diamond", "triangle", "flowchart"].includes(item.type) && item.componentRole?.startsWith("mermaid-wardley-node:") === true);
  if (!nodeShapes.length) throw new Error("A Mermaid Wardley map needs at least one editable component.");
  const decodeNode = (node: ShapeElement) => decode<{ name: string; kind: WardleyKind; strategy?: WardleyStrategy; inertia: boolean; pipeline?: string; pipelineVisibility?: number }>(node.componentRole!.slice("mermaid-wardley-node:".length));
  const nameMap = new Map<string, string>();
  for (const node of nodeShapes) {
    const metadata = decodeNode(node); const label = items.find((item): item is TextElement => item.type === "text" && item.componentRole === `mermaid-wardley-label:${encode(metadata.name)}`)?.text.trim() || metadata.name;
    nameMap.set(metadata.name, label);
  }
  const lines = ["wardley-beta"]; const metadata = sourceMetadata(originalSource);
  if (metadata.frontmatter.length) lines.unshift(...metadata.frontmatter);
  if (title?.text.trim()) lines.push(`title ${quote(title.text.trim())}`);
  const px = (node: ShapeElement) => Math.max(0, Math.min(1, (node.x + node.w / 2 - plot.x) / plot.w));
  const py = (node: ShapeElement) => Math.max(0, Math.min(1, 1 - (node.y + node.h / 2 - plot.y) / plot.h));
  lines.push(`size [${Math.round(frame.w)}, ${Math.round(frame.h)}]`);
  const nodeByName = new Map(nodeShapes.map(node => [decodeNode(node).name, node]));
  const pipelineNodes = new Map<string, ShapeElement[]>();
  for (const node of nodeShapes) {
    const model = decodeNode(node); const nodeName = nameMap.get(model.name)!;
    const labelElement = items.find((item): item is TextElement => item.type === "text" && item.componentRole === `mermaid-wardley-label:${encode(model.name)}`);
    const point = { x: node.x + node.w / 2, y: node.y + node.h / 2 };
    const offset = labelElement ? { x: Math.round(labelElement.x - point.x), y: Math.round(labelElement.y - point.y) } : { x: 14, y: -10 };
    if (model.pipeline) { const group = pipelineNodes.get(model.pipeline) ?? []; group.push(node); pipelineNodes.set(model.pipeline, group); continue; }
    const decoration = [model.strategy ? `(${model.strategy})` : "", model.inertia ? "(inertia)" : ""].filter(Boolean).join(" ");
    const labelOffset = labelElement && (offset.x !== 14 || offset.y !== -10) ? ` label [${offset.x}, ${offset.y}]` : "";
    lines.push(`${model.kind} ${quote(nodeName)} [${py(node).toFixed(3)}, ${px(node).toFixed(3)}]${decoration ? ` ${decoration}` : ""}${labelOffset}`);
  }
  for (const [parent, children] of pipelineNodes) {
    const parentNode = [...nodeByName.values()].find(node => decodeNode(node).name === parent);
    lines.push(`pipeline ${quote(nameMap.get(parent) ?? parent)} {`);
    for (const node of children) {
      const model = decodeNode(node); const labelElement = items.find((item): item is TextElement => item.type === "text" && item.componentRole === `mermaid-wardley-label:${encode(model.name)}`);
      const point = { x: node.x + node.w / 2, y: node.y + node.h / 2 }; const offset = labelElement ? { x: Math.round(labelElement.x - point.x), y: Math.round(labelElement.y - point.y) } : { x: 14, y: -10 };
      const details = [model.strategy ? `(${model.strategy})` : "", model.inertia ? "(inertia)" : ""].filter(Boolean).join(" ");
      const labelOffset = labelElement && (offset.x !== 14 || offset.y !== -10) ? ` label [${offset.x}, ${offset.y}]` : "";
      lines.push(`  component ${quote(nameMap.get(model.name) ?? model.name)} [${px(node).toFixed(3)}]${details ? ` ${details}` : ""}${labelOffset}`);
    }
    lines.push("}");
    if (!parentNode) throw new Error(`Wardley pipeline parent ${parent} was removed and cannot be exported.`);
  }
  const stageElements = items.filter((item): item is TextElement => item.type === "text" && item.componentRole?.startsWith("mermaid-wardley-stage:") === true).map(item => ({ label: item.text.trim(), metadata: decode<{ position: number; custom: boolean }>(item.componentRole!.slice("mermaid-wardley-stage:".length)), x: item.x + 32 })).sort((a, b) => a.x - b.x);
  if (stageElements.some(stage => stage.metadata.custom) && stageElements.length >= 2) {
    const stages = stageElements.map(stage => `${quote(stage.label)}@${Math.max(0, Math.min(1, (stage.x - plot.x) / plot.w)).toFixed(3)}`);
    lines.push(`evolution ${stages.join(" -> ")}`);
  }
  const componentName = (old: string) => nameMap.get(old) ?? old;
  for (const link of items.filter((item): item is ShapeElement => item.type === "arrow" && item.componentRole?.startsWith("mermaid-wardley-link:") === true)) {
    const edge = decode<{ from: string; to: string; operator: WardleyEdge["operator"] }>(link.componentRole!.slice("mermaid-wardley-link:".length));
    if (!nodeByName.has(edge.from) || !nodeByName.has(edge.to)) throw new Error("A Wardley dependency points to a component that was removed.");
    const from = componentName(edge.from); const to = componentName(edge.to); const label = link.label?.text?.trim();
    const operator = edge.operator === "+label" && label ? ` +'${label.replace(/'/g, "\\'")}'>` : edge.operator;
    lines.push(`${quote(from)} ${operator} ${quote(to)}${edge.operator !== "+label" && label ? `; ${quote(label)}` : ""}`);
  }
  for (const trend of items.filter((item): item is ShapeElement => item.type === "arrow" && item.componentRole?.startsWith("mermaid-wardley-trend:") === true)) {
    const source = decode<{ node: string; trendKind: "evolve" | "projection" }>(trend.componentRole!.slice("mermaid-wardley-trend:".length));
    if (!nodeByName.has(source.node)) throw new Error(`Wardley trend source ${source.node} was removed and cannot be exported.`);
    const x = Math.max(0, Math.min(1, (trend.x + trend.w - plot.x) / plot.w)); const y = Math.max(0, Math.min(1, 1 - (trend.y + trend.h - plot.y) / plot.h));
    lines.push(source.trendKind === "evolve" ? `evolve ${quote(componentName(source.node))} ${x.toFixed(3)}` : `${quote(componentName(source.node))} -.- (${x.toFixed(3)}, ${y.toFixed(3)})`);
  }
  const markers = items.filter((item): item is ShapeElement => item.type === "rectangle" && item.componentRole?.startsWith("mermaid-wardley-marker:") === true);
  for (const marker of markers) {
    const detail = decode<{ kind: WardleyMarker["kind"]; number?: number }>(marker.componentRole!.slice("mermaid-wardley-marker:".length));
    const visibility = Math.max(0, Math.min(1, 1 - (marker.y + marker.h / 2 - plot.y) / plot.h)); const evolution = Math.max(0, Math.min(1, (marker.x + marker.w / 2 - plot.x) / plot.w));
    const label = marker.label?.text?.trim() ?? "";
    if (detail.kind === "annotation") {
      const parsed = /^(\d+)\.\s*([\s\S]*)$/.exec(label); lines.push(`annotation ${parsed?.[1] ?? detail.number ?? 1},[${evolution.toFixed(3)},${visibility.toFixed(3)}] ${quote(parsed?.[2] ?? label)}`);
    } else lines.push(`${detail.kind} ${quote(label)} [${visibility.toFixed(3)}, ${evolution.toFixed(3)}]`);
  }
  const annotationAnchor = items.find((item): item is TextElement => item.type === "text" && item.componentRole?.startsWith("mermaid-wardley-annotations-anchor:") === true);
  if (annotationAnchor) {
    const visibility = Math.max(0, Math.min(1, 1 - (annotationAnchor.y - plot.y) / plot.h));
    const evolution = Math.max(0, Math.min(1, (annotationAnchor.x - plot.x) / plot.w));
    lines.push(`annotations [${evolution.toFixed(3)}, ${visibility.toFixed(3)}]`);
  }
  if (metadata.accessibility.length) lines.push(...metadata.accessibility);
  return lines.join("\n") + "\n";
}
