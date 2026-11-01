import type { Element, GroupElement, LibraryChartData, Point, ShapeElement } from "../../model";
import { buildLibraryComponent } from "../components/library-components";
import { exportMermaidTreeView, isMermaidTreeView, layoutMermaidTreeView } from "./mermaid-treeview";
import { exportMermaidSwimlane, isMermaidSwimlane, layoutMermaidSwimlane } from "./mermaid-swimlane";
import { exportMermaidCynefin, isMermaidCynefin, layoutMermaidCynefin } from "./mermaid-cynefin";
import { exportMermaidWardley, isMermaidWardley, layoutMermaidWardley } from "./mermaid-wardley";
import { exportMermaidEventModeling, isMermaidEventModeling, layoutMermaidEventModeling } from "./mermaid-eventmodeling";
import { exportMermaidZenUml, isMermaidZenUml, layoutMermaidZenUml } from "./mermaid-zenuml";

export type ExtendedMermaidType = "class" | "er" | "state" | "journey" | "gantt" | "c4" | "mindmap" | "timeline" | "git" | "requirement" | "quadrant" | "kanban" | "sankey" | "block" | "pie" | "xychart" | "packet" | "architecture" | "radar" | "treemap" | "venn" | "usecase" | "ishikawa" | "treeview" | "swimlane" | "cynefin" | "wardley" | "eventmodeling" | "zenuml";
type Node = { id: string; label: string; shape: "rectangle" | "rounded" | "diamond" | "circle"; role?: string };
type Edge = { from: string; to: string; label: string; relation?: string; fromCardinality?: string; toCardinality?: string; fromAnchor?: Point; toAnchor?: Point; direction?: "forward" | "backward" | "both" | "none"; sourceLine?: number; sourceColumn?: number };
type Graph = { nodes: Node[]; edges: Edge[]; title?: string; sections?: string[]; metadata?: Record<string, string>; chartData?: LibraryChartData };
export type MermaidCapabilitySummary = { family: string; supported: string; knownLimits: string };
const MERMAID_CAPABILITIES: Record<ExtendedMermaidType | "flowchart" | "sequence", MermaidCapabilitySummary> = {
  flowchart: { family: "Flowchart", supported: "Directed and undirected edges, common node forms and styles, labels, subgraphs, and bound connectors.", knownLimits: "Canvas coordinates and styles outside the editable node/edge subset are not represented in Mermaid source." },
  sequence: { family: "Sequence diagram", supported: "Participants, actors, aliases, and common synchronous/asynchronous message arrows.", knownLimits: "Activation, note, fragment, and advanced sequence directives are rejected; canvas coordinates are not encoded." },
  class: { family: "Class diagram", supported: "Classes, attributes, methods, aliases, relationship operators, labels, and cardinalities.", knownLimits: "Unsupported annotations, styling, and directives are rejected; canvas coordinates are not encoded." },
  er: { family: "ER diagram", supported: "Entities, fields, key markers, and labeled cardinality relationships.", knownLimits: "Unsupported entity attributes or relationship syntax are rejected; canvas coordinates are not encoded." },
  state: { family: "State diagram", supported: "Named states, transitions, transition labels, and supported nested state declarations.", knownLimits: "Unsupported composite-state directives and styling are rejected; free canvas coordinates are not encoded." },
  journey: { family: "User journey", supported: "Sections, tasks, actor labels, and task scores.", knownLimits: "Unsupported journey directives are rejected; canvas arrangement and non-model styling are not encoded." },
  gantt: { family: "Gantt chart", supported: "Sections, tasks, dates/durations, dependencies, and supported status markers.", knownLimits: "Unsupported calendar and task directives are rejected; the generated layout is not a source coordinate map." },
  c4: { family: "C4 diagram", supported: "Supported C4 actors, systems, containers, components, boundaries, and relationships.", knownLimits: "Only the C4 subset implemented by this importer round-trips; unsupported views and styles are rejected." },
  mindmap: { family: "Mind map", supported: "Indented hierarchies and supported Mermaid node shapes.", knownLimits: "Unsupported annotations and styling are rejected; manual canvas positions are not expressed by Mermaid." },
  timeline: { family: "Timeline", supported: "Sections, dated events, event labels, and titles.", knownLimits: "Unsupported timeline configuration is rejected; manual canvas spacing is not encoded." },
  git: { family: "Git graph", supported: "Commits, branches, checkout, merge, and supported commit labels.", knownLimits: "Unsupported Git graph directives are rejected; branch layout is regenerated from source order." },
  requirement: { family: "Requirement diagram", supported: "Requirements, elements, supported requirement properties, and typed relations.", knownLimits: "Unsupported requirement fields and relationship types are rejected; positions are regenerated." },
  quadrant: { family: "Quadrant chart", supported: "Axis labels, quadrant labels, titled charts, and positioned data points.", knownLimits: "Unsupported point/style directives are rejected; manual canvas arrangement is not serialized." },
  kanban: { family: "Kanban board", supported: "Columns, tasks, titles, and editable task cards.", knownLimits: "Unsupported board styling or directives are rejected; canvas spacing is regenerated." },
  sankey: { family: "Sankey diagram", supported: "Weighted source/target flows and editable labels/values.", knownLimits: "Only Mermaid's supported beta flow syntax is accepted; manual node coordinates are not encoded." },
  block: { family: "Block diagram", supported: "Grid columns, spanning blocks, groups, labels, and supported links.", knownLimits: "Unsupported block layout directives are rejected; free canvas positions are not represented." },
  pie: { family: "Pie chart", supported: "Editable category labels, numeric values, title, and show-data setting.", knownLimits: "The chart is reconstructed from values; custom slice styling and canvas placement are not represented." },
  xychart: { family: "XY chart", supported: "Editable categories, numeric series, axis labels, bounds, and bar/line series.", knownLimits: "Horizontal orientation and unsupported chart configuration are rejected; custom canvas styling is not encoded." },
  packet: { family: "Packet diagram", supported: "Bit-range fields, labels, and supported continuation rows.", knownLimits: "Unsupported packet configuration and style directives are rejected; field positions are recalculated." },
  architecture: { family: "Architecture diagram", supported: "Groups, services, junctions, icon names, anchored relationships, and directions.", knownLimits: "Unsupported icon assets or configuration may use generic visual fallbacks; custom coordinates are not encoded." },
  radar: { family: "Radar chart", supported: "Axes, multiple curves, values, axis ranges, ticks, graticule, and legend visibility.", knownLimits: "The chart is reconstructed from its data; unsupported styling and canvas placement are not represented." },
  treemap: { family: "Treemap", supported: "Nested labels, numeric leaf values, and editable hierarchy.", knownLimits: "Rectangle areas are approximate to source values; unsupported treemap options and canvas positions are not encoded." },
  venn: { family: "Venn diagram", supported: "Set declarations, pair/higher-order unions, sizes, labels, and nested editable text.", knownLimits: "Circle sizes/overlaps are approximate; unsupported Venn styles are rejected and exact geometric overlap is not guaranteed." },
  usecase: { family: "Use case diagram", supported: "Actors, use cases, system boundaries, associations, include/extend, and supported generalization.", knownLimits: "Nested boundaries and unsupported relationships are rejected; canvas layout is regenerated." },
  ishikawa: { family: "Ishikawa diagram", supported: "Indented causes, sub-causes, category branches, and editable problem statement.", knownLimits: "Only the beta indentation grammar is supported; manual branch positions and unsupported styles are not encoded." },
  treeview: { family: "TreeView", supported: "Indented or box-drawn hierarchy, descriptions, highlights, supported icons, and directories/files.", knownLimits: "Unsupported icons use text fallbacks; the source grammar does not preserve free canvas positions." },
  swimlane: { family: "Swimlane flowchart", supported: "Top-level subgraph lanes, lane direction, flowchart nodes, bound handoffs, and supported frontmatter/accessibility metadata.", knownLimits: "Nested lanes and unsupported styling/click directives are rejected; canvas lane geometry is regenerated." },
  cynefin: { family: "Cynefin framework", supported: "Five domains, editable items, transitions, supported themes, accessibility text, and domain descriptions.", knownLimits: "Mermaid self-loop transitions are ignored by Mermaid itself; item overflow uses a visual count badge." },
  wardley: { family: "Wardley map", supported: "Anchors, components, evolution stages, pipelines, strategies, dependencies, trends, notes, and annotations.", knownLimits: "Unsupported themes and hand-drawn mode are rejected; positions and evolution values use the implemented normalized map model." },
  eventmodeling: { family: "Event Modeling", supported: "Timeframes, reset frames, typed lanes, inferred/explicit links, inline examples, and reusable data blocks.", knownLimits: "Only the documented timeframe/data subset is supported; unsupported DSL constructs are rejected with source locations." },
  zenuml: { family: "ZenUML sequence diagram", supported: "Participants, annotators, aliases, synchronous/asynchronous messages, creation, returns, nested calls, comments, loops, alternatives, optional/parallel blocks, try/catch/finally, and break.", knownLimits: "Only these ZenUML constructs are editable; unmodeled syntax is rejected. Canvas coordinates and activation styling are not encoded in source." },
};

export function mermaidCapabilitySummary(source: string): MermaidCapabilitySummary | undefined {
  const type = detectExtendedMermaidType(source);
  if (type) return MERMAID_CAPABILITIES[type];
  const first = source.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n").find(line => line.trim() && !/^\s*%%/.test(line))?.trim() ?? "";
  if (/^sequenceDiagram\b/i.test(first)) return MERMAID_CAPABILITIES.sequence;
  if (/^(?:flowchart|graph)\b/i.test(first)) return MERMAID_CAPABILITIES.flowchart;
  return undefined;
}

export function detectExtendedMermaidType(source: string): ExtendedMermaidType | undefined {
  if (isMermaidTreeView(source)) return "treeview";
  if (isMermaidSwimlane(source)) return "swimlane";
  if (isMermaidCynefin(source)) return "cynefin";
  if (isMermaidWardley(source)) return "wardley";
  if (isMermaidEventModeling(source)) return "eventmodeling";
  if (isMermaidZenUml(source)) return "zenuml";
  const first = source.replace(/^\s*%%.*$/gm, "").trim().split(/\r?\n/)[0] ?? "";
  if (/^classDiagram\b/i.test(first)) return "class";
  if (/^erDiagram\b/i.test(first)) return "er";
  if (/^stateDiagram(?:-v2)?\b/i.test(first)) return "state";
  if (/^journey\b/i.test(first)) return "journey";
  if (/^gantt\b/i.test(first)) return "gantt";
  if (/^C4(?:Context|Container|Component|Dynamic|Deployment)\b/i.test(first)) return "c4";
  if (/^mindmap\b/i.test(first)) return "mindmap";
  if (/^timeline\b/i.test(first)) return "timeline";
  if (/^gitGraph\b/i.test(first)) return "git";
  if (/^requirementDiagram\b/i.test(first)) return "requirement";
  if (/^quadrantChart\b/i.test(first)) return "quadrant";
  if (/^kanban\b/i.test(first)) return "kanban";
  if (/^sankey-beta\b/i.test(first)) return "sankey";
  if (/^block-beta\b/i.test(first)) return "block";
  if (/^pie\b/i.test(first)) return "pie";
  if (/^xychart(?:-beta)?\b/i.test(first)) return "xychart";
  if (/^packet(?:-beta)?\b/i.test(first)) return "packet";
  if (/^architecture-beta\b/i.test(first)) return "architecture";
  if (/^radar-beta\b/i.test(first)) return "radar";
  if (/^treemap-beta\b/i.test(first)) return "treemap";
  if (/^venn-beta\b/i.test(first)) return "venn";
  if (/^usecase-beta\b/i.test(first)) return "usecase";
  if (/^ishikawa-beta\b/i.test(first)) return "ishikawa";
  return undefined;
}

function unquote(value: string): string {
  return value.trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_match, double, single) => double ?? single);
}

function anchorPoint(value: string): Point {
  return value === "T" ? { x: .5, y: 0 } : value === "B" ? { x: .5, y: 1 } : value === "L" ? { x: 0, y: .5 } : { x: 1, y: .5 };
}

function splitTopLevel(source: string): string[] {
  const parts: string[] = []; let current = ""; let quote = ""; let escaped = false; const stack: string[] = [];
  const closing: Record<string, string> = { "[": "]", "{": "}", "(": ")" };
  for (const char of source) {
    if (escaped) { current += char; escaped = false; continue; }
    if (char === "\\" && quote) { current += char; escaped = true; continue; }
    if ((char === "'" || char === '"') && (!quote || quote === char)) { quote = quote ? "" : char; current += char; continue; }
    if (!quote && closing[char]) stack.push(closing[char]);
    else if (!quote && stack[stack.length - 1] === char) stack.pop();
    if (char === "," && !quote && !stack.length) { if (current.trim()) parts.push(current.trim()); current = ""; }
    else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
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

function parseVennEntry(source: string, allowSize: boolean): { id: string; label: string; size?: number } {
  let input = source.trim(); let size: number | undefined;
  if (allowSize) {
    const sizeMatch = /:\s*(\d+(?:\.\d+)?)$/.exec(input);
    if (sizeMatch) { size = Number(sizeMatch[1]); input = input.slice(0, sizeMatch.index).trim(); }
  } else if (/:\s*\d+(?:\.\d+)?$/.test(input)) throw new Error("Mermaid Venn text nodes do not accept a size.");
  if (size !== undefined && (!Number.isFinite(size) || size <= 0)) throw new Error("Mermaid Venn sizes must be positive finite numbers.");
  const identifier = /^("(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[A-Za-z_][\w.-]*)([\s\S]*)$/.exec(input);
  if (!identifier) throw new Error(`Unsupported Mermaid Venn identifier: ${source}`);
  const id = unquote(identifier[1]); const suffix = identifier[2].trim();
  let label = id;
  if (suffix) {
    const labelMatch = /^\[\s*(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|([^\]]+))\s*\]$/.exec(suffix);
    if (!labelMatch) throw new Error(`Unsupported Mermaid Venn label syntax: ${source}`);
    label = (labelMatch[1] ?? labelMatch[2] ?? labelMatch[3]).trim();
  }
  if (!id || !label) throw new Error("Mermaid Venn identifiers and labels cannot be empty.");
  return { id, label, ...(size === undefined ? {} : { size }) };
}

function parseGraph(source: string, type: ExtendedMermaidType): Graph {
  const nodes = new Map<string, Node>(); const edges: Edge[] = []; const fields = new Map<string, string[]>();
  let activeClass = ""; let activeUsecaseBoundary = ""; let title = ""; let section = ""; const sections: string[] = []; const metadata: Record<string, string> = {};
  const usecaseDeclared = new Set<string>(); const usecaseBoundaryIds = new Set<string>();
  let currentBranch = "main"; let commitSequence = 0; let previousTimelineEvent = ""; let blockColumns = 3; let blockRow = 0;
  const hierarchy: { indent: number; id: string }[] = []; const branchHeads = new Map<string, string>(); const kanbanColumns: string[] = [];
  const architectureMembershipLines = new Map<string, number>();
  const architectureMembershipColumns = new Map<string, number>();
  const pieLabels: string[] = []; const pieValues: number[] = []; const xySeries: { name: string; values: number[]; chartType: "bar" | "line" }[] = [];
  let xyLabels: string[] = []; let xyXAxisLabel = ""; let xyYAxisLabel = ""; let xyMin: number | undefined; let xyMax: number | undefined;
  let packetRow = 0; let packetCursor = 0;
  const radarAxisIds: string[] = []; const radarLabels: string[] = []; const radarCurveIds = new Set<string>(); const radarSeries: { name: string; values: number[]; chartType: "line" }[] = [];
  let radarMin: number | undefined; let radarMax: number | undefined; let radarTicks = 5; let radarGraticule: "circle" | "polygon" = "circle"; let radarLegend = true;
  const treemapSourceLines = new Map<string, number>();
  const treemapSourceColumns = new Map<string, number>();
  const vennSets = new Map<string, { internalId: string; indent: number }>(); const vennDeclaredIds = new Set<string>();
  let vennLatestOwner: { kind: "set" | "union"; internalId: string; indent: number } | undefined; let vennUnionCount = 0; let vennTextCount = 0;
  const get = (id: string, label = id, shape: Node["shape"] = "rectangle", role?: string) => {
    const key = id.replace(/[^\w.-]/g, "_").slice(0, 80) || `node_${nodes.size + 1}`;
    const previous = nodes.get(key);
    if (!previous || label !== key) nodes.set(key, { id: key, label: label || key, shape, ...(role ? { role } : previous?.role ? { role: previous.role } : {}) });
    return key;
  };
  const declareUsecaseNode = (id: string, label: string, shape: Node["shape"], role: string) => {
    const key = get(id, label, shape, role);
    const previous = nodes.get(key);
    if (previous) nodes.set(key, { ...previous, label: label || key, shape, role });
    return key;
  };
  for (const [lineIndex, raw] of source.replace(/\r/g, "").split("\n").entries()) {
    try {
    if (type === "packet" && /%%\s*\{/.test(raw)) throw new Error("Mermaid packet configuration directives are not supported yet.");
    const uncommented = raw.replace(/%%.*$/, ""); const indent = uncommented.match(/^\s*/)?.[0].length ?? 0;
    const line = uncommented.trim(); if (!line) continue;
    if (type === "pie" && /^pie\b/i.test(line)) {
      const showData = /\bshowData\b/i.test(line);
      const chartTitle = /\btitle\s+(?:"([^"]*)"|'([^']*)'|(.+))$/i.exec(line);
      if (chartTitle) title = chartTitle[1] ?? chartTitle[2] ?? chartTitle[3].trim();
      metadata.showData = String(showData);
      continue;
    }
    if (/^(?:classDiagram|erDiagram|stateDiagram(?:-v2)?|C4(?:Context|Container|Component|Dynamic|Deployment)|mindmap|timeline|gitGraph|requirementDiagram|quadrantChart|kanban|sankey-beta|block-beta|xychart(?:-beta)?|packet(?:-beta)?|architecture-beta|radar-beta|treemap-beta|venn-beta|usecase-beta|ishikawa-beta)\b/i.test(line)) {
      if (type === "xychart" && /\bhorizontal\b/i.test(line)) throw new Error("Horizontal Mermaid XY charts are not supported by the editable chart model yet.");
      continue;
    }
    if (/^direction\s+/i.test(line)) {
      if (type === "usecase") {
        if (activeUsecaseBoundary) throw new Error("Mermaid use case direction statements must be outside system boundaries.");
        const direction = /^direction\s+(TD|TB|BT|LR|RL)$/i.exec(line);
        if (!direction) throw new Error(`Unsupported Mermaid use case direction: ${line}`);
        metadata.direction = direction[1].toUpperCase();
      }
      continue;
    }
    if (/^layout\s+/i.test(line) || /^dateFormat\s+/i.test(line) || /^axisFormat\s+/i.test(line) || /^tickInterval\s+/i.test(line) || /^excludes\s+/i.test(line) || /^includes\s+/i.test(line) || /^todayMarker\s+/i.test(line)) continue;
    if (/^title\s+/i.test(line)) { title = line.replace(/^title\s+/i, "").replace(/^(["'])(.*)\1$/, "$2"); continue; }
    if (type === "venn") {
      const set = /^set\s+(.+)$/i.exec(line);
      if (set) {
        const entry = parseVennEntry(set[1], true);
        if (vennDeclaredIds.has(entry.id)) throw new Error(`Duplicate Mermaid Venn identifier: ${entry.id}`);
        const internalId = `venn_set_${vennSets.size + 1}`; const size = entry.size === undefined ? "" : String(entry.size);
        get(internalId, entry.label, "circle", `mermaid-venn-set:${encodeURIComponent(entry.id)}:${size}`);
        vennSets.set(entry.id, { internalId, indent }); vennDeclaredIds.add(entry.id);
        vennLatestOwner = { kind: "set", internalId, indent }; continue;
      }
      const union = /^union\s+([\s\S]+)$/i.exec(line);
      if (union) {
        let declaration = union[1].trim(); let size: number | undefined;
        const sizeMatch = /:\s*(\d+(?:\.\d+)?)$/.exec(declaration);
        if (sizeMatch) { size = Number(sizeMatch[1]); declaration = declaration.slice(0, sizeMatch.index).trim(); }
        if (size !== undefined && (!Number.isFinite(size) || size <= 0)) throw new Error("Mermaid Venn sizes must be positive finite numbers.");
        let rawIds = declaration; let label: string | undefined;
        const labelMatch = /^(.*?)\s*\[\s*(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|([^\]]+))\s*\]$/.exec(declaration);
        if (labelMatch) { rawIds = labelMatch[1].trim(); label = (labelMatch[2] ?? labelMatch[3] ?? labelMatch[4]).trim(); }
        const sourceIds = parseArgs(rawIds).map(unquote);
        if (sourceIds.length < 2 || sourceIds.length > 8 || new Set(sourceIds).size !== sourceIds.length) throw new Error("Mermaid Venn unions need 2 to 8 distinct set identifiers.");
        const missing = sourceIds.find(id => !vennSets.has(id));
        if (missing) throw new Error(`Mermaid Venn union references undeclared set ${missing}; declare sets before unions.`);
        if (label !== undefined && !label) throw new Error("Mermaid Venn union labels cannot be empty.");
        const internalId = `venn_union_${++vennUnionCount}`; const displayLabel = label ?? sourceIds.join(" ∩ "); const encodedIds = encodeURIComponent(JSON.stringify(sourceIds));
        get(internalId, displayLabel, "rectangle", `mermaid-venn-union:${encodedIds}:${size === undefined ? "" : size}`);
        vennLatestOwner = { kind: "union", internalId, indent }; continue;
      }
      const text = /^text\s+([\s\S]+)$/i.exec(line);
      if (text) {
        if (!vennLatestOwner || indent <= vennLatestOwner.indent) throw new Error("Mermaid Venn text nodes must be indented under the most recent set or union.");
        const entry = parseVennEntry(text[1], false);
        if (vennDeclaredIds.has(entry.id)) throw new Error(`Duplicate Mermaid Venn identifier: ${entry.id}`);
        const internalId = `venn_text_${++vennTextCount}`;
        get(internalId, entry.label, "rectangle", `mermaid-venn-text:${vennLatestOwner.kind}:${encodeURIComponent(vennLatestOwner.internalId)}:${encodeURIComponent(entry.id)}`);
        vennDeclaredIds.add(entry.id); continue;
      }
      if (/^style\b/i.test(line)) throw new Error("Mermaid Venn style directives are not supported by the editable subset yet.");
      if (/^(?:accTitle\s|accDescr\s)/i.test(line)) continue;
      throw new Error(`Unsupported Mermaid Venn syntax: ${line}`);
    }
    const sectionMatch = /^section\s+(.+)$/i.exec(line); if (sectionMatch) { section = sectionMatch[1].trim(); sections.push(section); activeClass = ""; if (type === "timeline") previousTimelineEvent = ""; continue; }
    if (line === "}" || /^end\s*$/i.test(line)) { activeClass = ""; if (type === "usecase") activeUsecaseBoundary = ""; continue; }

    if (type === "usecase") {
      const assertDeclared = (id: string) => {
        if (!id || usecaseDeclared.has(id) || usecaseBoundaryIds.has(id)) throw new Error(`Duplicate Mermaid use case identifier: ${id}`);
        usecaseDeclared.add(id);
      };
      const boundary = /^systemBoundary\s+(?:(\w+)(?:\s*\[\s*([^\]]+)\s*\])?|"([^"]+)"|'([^']+)'|(\w+))$/i.exec(line);
      if (boundary) {
        if (activeUsecaseBoundary) throw new Error("Nested Mermaid use case system boundaries are not supported.");
        const label = unquote((boundary[2] ?? boundary[3] ?? boundary[4] ?? boundary[5] ?? boundary[1]).trim());
        const id = boundary[1] ?? boundary[5] ?? safeId(label, `system_${usecaseBoundaryIds.size + 1}`);
        if (usecaseDeclared.has(id) || usecaseBoundaryIds.has(id)) throw new Error(`Duplicate Mermaid use case identifier: ${id}`);
        usecaseBoundaryIds.add(id);
        declareUsecaseNode(id, label, "rectangle", "mermaid-usecase-boundary");
        activeUsecaseBoundary = id; continue;
      }
      const actor = /^actor\s+([A-Za-z0-9_]+)(?:\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\))?$/i.exec(line);
      if (actor) {
        if (usecaseDeclared.has(actor[1])) throw new Error(`Mermaid use case actor ${actor[1]} is declared more than once.`);
        if (!usecaseDeclared.has(actor[1])) assertDeclared(actor[1]);
        const label = unquote((actor[2] ?? actor[3] ?? actor[4] ?? actor[1]).trim());
        const role = `mermaid-usecase-actor:${encodeURIComponent(activeUsecaseBoundary)}`;
        declareUsecaseNode(actor[1], label, "rectangle", role); continue;
      }
      const includeOrExtend = /^([A-Za-z0-9_]+)\s+(?:[\w-]+@)?\.\.>\s*:\s*(include|extend)\s+([A-Za-z0-9_]+)$/i.exec(line);
      if (includeOrExtend) {
        if (activeUsecaseBoundary) throw new Error("Mermaid use case relationships must be outside system boundaries.");
        const [, fromRaw, kind, toRaw] = includeOrExtend;
        const from = get(fromRaw, fromRaw, "rectangle", "mermaid-usecase-ellipse:");
        const to = get(toRaw, toRaw, "rectangle", "mermaid-usecase-ellipse:");
        edges.push({ from, to, label: kind.toLowerCase(), relation: kind.toLowerCase(), sourceLine: lineIndex + 1, sourceColumn: raw.indexOf(line) + 1 }); continue;
      }
      const association = /^([A-Za-z0-9_]+)\s+(<\|--|--\|>|-->|<--|--o|o--|--x|x--|--)\s+(?:(?:"([^"]*)"|'([^']*)'|([^\s]+))\s+(<\|--|--\|>|-->|<--|--o|o--|--x|x--|--)\s+)?([A-Za-z0-9_]+)$/i.exec(line);
      if (association) {
        if (activeUsecaseBoundary) throw new Error("Mermaid use case relationships must be outside system boundaries.");
        const fromRaw = association[1]; const firstOperator = association[2]; const label = (association[3] ?? association[4] ?? association[5] ?? "").trim();
        const operator = association[6] ?? firstOperator; const toRaw = association[7] ?? association[3] ?? association[4] ?? association[5];
        const relationLabel = association[6] ? label : "";
        if (!toRaw || toRaw === fromRaw && !association[6]) throw new Error(`Unsupported Mermaid use case relationship: ${line}`);
        const from = get(fromRaw, fromRaw, "rectangle", "mermaid-usecase-ellipse:");
        const to = get(toRaw, toRaw, "rectangle", "mermaid-usecase-ellipse:");
        edges.push({ from, to, label: relationLabel, relation: operator, sourceLine: lineIndex + 1, sourceColumn: raw.indexOf(line) + 1 }); continue;
      }
      const generalization = /^([A-Za-z0-9_]+)\s+(<\|--|--\|>)\s+([A-Za-z0-9_]+)$/.exec(line);
      if (generalization) {
        const from = get(generalization[1], generalization[1], "rectangle", "mermaid-usecase-ellipse:");
        const to = get(generalization[3], generalization[3], "rectangle", "mermaid-usecase-ellipse:");
        edges.push({ from, to, label: "", relation: generalization[2], sourceLine: lineIndex + 1, sourceColumn: raw.indexOf(line) + 1 }); continue;
      }
      if (/^(?:actor\b|systemBoundary\b)/i.test(line)) throw new Error(`Unsupported Mermaid use case declaration: ${line}`);
      const usecase = /^([A-Za-z0-9_]+)(?:\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)|\[\s*([^\]]*)\s*\])?$/.exec(line);
      const quotedUsecase = /^"([^"]+)"$/.exec(line);
      if (usecase || quotedUsecase) {
        const id = usecase?.[1] ?? safeId(quotedUsecase![1], `usecase_${usecaseDeclared.size + 1}`);
        if (usecaseDeclared.has(id)) throw new Error(`Duplicate Mermaid use case declaration: ${id}`);
        assertDeclared(id);
        const rectangle = usecase?.[5] !== undefined;
        const label = unquote((usecase?.[2] ?? usecase?.[3] ?? usecase?.[4] ?? usecase?.[5] ?? quotedUsecase?.[1] ?? id).trim());
        const kind = rectangle ? "rectangle" : "ellipse";
        declareUsecaseNode(id, label, rectangle ? "rectangle" : "rounded", `mermaid-usecase-${kind}:${encodeURIComponent(activeUsecaseBoundary)}`); continue;
      }
      if (/^(?:accTitle\s|accDescr\b|classDef\b|class\s|style\b|note\b|json\b)/i.test(line)) throw new Error(`Mermaid use case styling, notes, and JSON nodes are outside the editable subset: ${line}`);
      throw new Error(`Unsupported Mermaid use case syntax: ${line}`);
    }

    if (type === "radar") {
      if (/^axis\s+/i.test(line)) {
        for (const token of splitTopLevel(line.replace(/^axis\s+/i, ""))) {
          const axis = /^([\w.-]+)(?:\[(?:"([^"]*)"|'([^']*)'|([^\]]+))\])?$/.exec(token);
          if (!axis) throw new Error(`Unsupported Mermaid radar axis syntax: ${token}`);
          if (radarAxisIds.includes(axis[1])) throw new Error(`Duplicate Mermaid radar axis: ${axis[1]}`);
          const axisLabel = (axis[2] ?? axis[3] ?? axis[4] ?? axis[1]).trim(); if (!axisLabel) throw new Error("Mermaid radar axis labels cannot be empty.");
          radarAxisIds.push(axis[1]); radarLabels.push(axisLabel);
        }
        continue;
      }
      if (/^curve\s+/i.test(line)) {
        for (const token of splitTopLevel(line.replace(/^curve\s+/i, ""))) {
          const curve = /^([\w.-]+)(?:\[(?:"([^"]*)"|'([^']*)'|([^\]]+))\])?\s*\{([^}]*)\}$/.exec(token);
          if (!curve) throw new Error(`Unsupported Mermaid radar curve syntax: ${token}`);
          if (radarCurveIds.has(curve[1])) throw new Error(`Duplicate Mermaid radar curve ID: ${curve[1]}`);
          const rawValues = splitTopLevel(curve[5]); let values: number[];
          if (rawValues.some(value => value.includes(":"))) {
            const byAxis = new Map<string, number>();
            for (const value of rawValues) { const pair = /^\s*([\w.-]+)\s*:\s*(-?\d+(?:\.\d+)?)\s*$/.exec(value); if (!pair) throw new Error(`Unsupported Mermaid radar key/value: ${value}`); if (byAxis.has(pair[1])) throw new Error(`Duplicate Mermaid radar axis value: ${pair[1]}`); byAxis.set(pair[1], Number(pair[2])); }
            if (byAxis.size !== radarAxisIds.length || radarAxisIds.some(id => !byAxis.has(id))) throw new Error("Mermaid radar key/value curves must provide one value for every declared axis.");
            values = radarAxisIds.map(id => byAxis.get(id)!);
          } else values = rawValues.map(Number);
          if (values.some(value => !Number.isFinite(value))) throw new Error(`Mermaid radar values must be finite numbers: ${token}`);
          radarCurveIds.add(curve[1]); radarSeries.push({ name: curve[2] ?? curve[3] ?? curve[4] ?? curve[1], values, chartType: "line" });
        }
        continue;
      }
      const range = /^(max|min)\s+(-?\d+(?:\.\d+)?)$/i.exec(line);
      if (range) { if (range[1].toLowerCase() === "max") radarMax = Number(range[2]); else radarMin = Number(range[2]); continue; }
      const ticks = /^ticks\s+([1-9]\d*)$/i.exec(line);
      if (ticks) { radarTicks = Number(ticks[1]); if (radarTicks > 20) throw new Error("Mermaid radar ticks are limited to 20."); continue; }
      const graticule = /^graticule\s+(circle|polygon)$/i.exec(line);
      if (graticule) { radarGraticule = graticule[1].toLowerCase() as "circle" | "polygon"; continue; }
      const legend = /^showLegend\s+(true|false)$/i.exec(line);
      if (legend) { radarLegend = legend[1].toLowerCase() === "true"; continue; }
      if (/^(?:accTitle\s|accDescr\s)/i.test(line)) continue;
      throw new Error(`Unsupported Mermaid radar syntax: ${line}`);
    }

    if (type === "treemap") {
      if (/^(?:style|classDef|class\s)/i.test(line) || /:::[\w-]+/.test(line)) throw new Error("Mermaid treemap style directives are not supported by the editable subset yet.");
      const leaf = /^(.*?)\s*:\s*(-?\d+(?:\.\d+)?)$/.exec(line); const label = unquote(leaf?.[1] ?? line);
      const value = leaf ? Number(leaf[2]) : undefined;
      if (!label || (value !== undefined && (!Number.isFinite(value) || value <= 0))) throw new Error("Mermaid treemap values must be positive finite numbers.");
      while (hierarchy.length && hierarchy[hierarchy.length - 1].indent >= indent) hierarchy.pop();
      const parent = hierarchy[hierarchy.length - 1]?.id ?? ""; const id = `treemap_${nodes.size + 1}`;
      get(id, value === undefined ? label : `${label}\n${value}`, "rectangle", `mermaid-treemap:${encodeURIComponent(parent)}:${value === undefined ? "" : value}`);
      hierarchy.push({ indent, id }); treemapSourceLines.set(id, lineIndex + 1); treemapSourceColumns.set(id, raw.indexOf(line) + 1); continue;
    }

    if (type === "pie") {
      const slice = /^(?:"([^"]+)"|'([^']+)'|(.+?))\s*:\s*(-?\d+(?:\.\d+)?)$/.exec(line);
      if (!slice) throw new Error(`Unsupported Mermaid pie syntax: ${line}`);
      const label = (slice[1] ?? slice[2] ?? slice[3]).trim(); const rawValue = slice[4]; const value = Number(rawValue);
      if (!label || !Number.isFinite(value) || value <= 0 || (rawValue.split(".")[1]?.length ?? 0) > 2) throw new Error("Mermaid pie values must be positive numbers with at most two decimal places.");
      pieLabels.push(label); pieValues.push(value); continue;
    }

    if (type === "xychart") {
      if (/^x-axis\b/i.test(line)) {
        let rest = line.replace(/^x-axis\s*/i, ""); const quoted = /^(?:"([^"]*)"|'([^']*)')/.exec(rest);
        if (quoted) { xyXAxisLabel = quoted[1] ?? quoted[2]; rest = rest.slice(quoted[0].length).trim(); }
        const categories = /^\[([^\]]*)\]/.exec(rest);
        if (categories) { xyLabels = parseArgs(categories[1]).map(unquote); rest = rest.slice(categories[0].length).trim(); }
        if (/\d\s*-->\s*\d/.test(rest)) throw new Error("Numeric Mermaid X-axis ranges are not supported; use categorical labels or omit the range.");
        if (rest) throw new Error(`Unsupported Mermaid XY X-axis syntax: ${line}`);
        continue;
      }
      if (/^y-axis\b/i.test(line)) {
        let rest = line.replace(/^y-axis\s*/i, ""); const quoted = /^(?:"([^"]*)"|'([^']*)')/.exec(rest);
        if (quoted) { xyYAxisLabel = quoted[1] ?? quoted[2]; rest = rest.slice(quoted[0].length).trim(); }
        const range = /^(-?\d+(?:\.\d+)?)\s*-->\s*(-?\d+(?:\.\d+)?)$/.exec(rest);
        if (range) { xyMin = Number(range[1]); xyMax = Number(range[2]); }
        else if (rest) throw new Error(`Unsupported Mermaid XY Y-axis syntax: ${line}`);
        if (xyMin !== undefined && xyMax !== undefined && xyMax <= xyMin) throw new Error("Mermaid XY Y-axis maximum must be greater than its minimum.");
        continue;
      }
      const series = /^(bar|line)\s+\[([^\]]*)\]$/i.exec(line);
      if (series) {
        const values = parseArgs(series[2]).map(Number);
        if (!values.length || values.some(value => !Number.isFinite(value))) throw new Error(`Mermaid XY ${series[1]} values must be finite numbers: ${line}`);
        xySeries.push({ name: `Series ${xySeries.length + 1}`, values, chartType: series[1].toLowerCase() as "bar" | "line" }); continue;
      }
      if (/^(?:accTitle\s|accDescr\s)/i.test(line)) continue;
      throw new Error(`Unsupported Mermaid XY chart syntax: ${line}`);
    }

    if (type === "packet") {
      if (/^(?:accTitle\s|accDescr\s)/i.test(line)) continue;
      const field = /^(?:\+(\d+)|(\d+)(?:\s*-\s*(\d+))?)\s*:\s*(.+)$/.exec(line);
      if (!field) throw new Error(`Unsupported Mermaid packet syntax: ${line}`);
      if (field[1] && packetCursor >= 32) { packetRow++; packetCursor = 0; }
      const explicitStart = field[2] ? Number(field[2]) : packetCursor;
      if (!field[1] && explicitStart < packetCursor) packetRow++;
      const start = field[1] ? packetCursor : explicitStart;
      const end = field[1] ? start + Number(field[1]) - 1 : field[3] ? Number(field[3]) : start;
      const label = unquote(field[4]);
      if (!label || end < start || end >= 32 || start < 0) throw new Error("Mermaid packet fields must cover valid bit positions from 0 through 31.");
      get(`packet_field_${nodes.size + 1}`, label, "rectangle", `mermaid-packet:${packetRow}:${start}:${end}`);
      packetCursor = end + 1; continue;
    }

    if (type === "architecture") {
      const assertNewNode = (id: string) => {
        const key = id.replace(/[^\w.-]/g, "_").slice(0, 80) || `node_${nodes.size + 1}`;
        if (nodes.has(key)) throw new Error(`Duplicate Mermaid architecture ID: ${id}`);
      };
      const group = /^group\s+([\w.-]+)(?:\(([^)]+)\))?\s*\[([^\]]+)\](?:\s+in\s+([\w.-]+))?$/i.exec(line);
      if (group) {
        if (group[4]) throw new Error("Nested Mermaid architecture groups are not supported yet.");
        assertNewNode(group[1]);
        get(group[1], unquote(group[3]), "rounded", `mermaid-architecture-group:${encodeURIComponent(group[2] ?? "")}`); continue;
      }
      const service = /^service\s+([\w.-]+)(?:\(([^)]+)\))?\s*\[([^\]]+)\](?:\s+in\s+([\w.-]+))?$/i.exec(line);
      if (service) { assertNewNode(service[1]); get(service[1], unquote(service[3]), "rounded", `mermaid-architecture-service:${encodeURIComponent(service[2] ?? "")}:${encodeURIComponent(service[4] ?? "")}`); if (service[4]) { architectureMembershipLines.set(service[1], lineIndex + 1); architectureMembershipColumns.set(service[1], raw.indexOf(line) + 1); } continue; }
      const junction = /^junction\s+([\w.-]+)(?:\s+in\s+([\w.-]+))?$/i.exec(line);
      if (junction) { assertNewNode(junction[1]); get(junction[1], "", "circle", `mermaid-architecture-junction:${encodeURIComponent(junction[2] ?? "")}`); if (junction[2]) { architectureMembershipLines.set(junction[1], lineIndex + 1); architectureMembershipColumns.set(junction[1], raw.indexOf(line) + 1); } continue; }
      const link = /^([\w.-]+)(?:\{([\w.-]+)\})?:([TBLR])\s*(<-->|<--|-->|--)\s*([TBLR]):([\w.-]+)(?:\{([\w.-]+)\})?$/.exec(line);
      if (link) {
        const keyOf = (id: string) => id.replace(/[^\w.-]/g, "_").slice(0, 80);
        const existingFrom = nodes.get(keyOf(link[1])); const existingTo = nodes.get(keyOf(link[6]));
        if (!existingFrom?.role?.startsWith("mermaid-architecture-") || !existingTo?.role?.startsWith("mermaid-architecture-")) throw new Error("Mermaid architecture links must reference declared groups, services, or junctions.");
        const from = get(link[1]); const to = get(link[6]);
        for (const [nodeId, qualifier] of [[from, link[2]], [to, link[7]]] as const) if (qualifier) {
          const node = nodes.get(nodeId); const nodeGroup = node?.role?.startsWith("mermaid-architecture-service:") ? decodePart(node.role.split(":")[2] ?? "") : "";
          if (nodeGroup !== qualifier) throw new Error(`Mermaid architecture endpoint ${nodeId} is not in group ${qualifier}.`);
        }
        const direction = link[4] === "-->" ? "forward" : link[4] === "<--" ? "backward" : link[4] === "<-->" ? "both" : "none";
        edges.push({ from, to, label: "", relation: "architecture", fromAnchor: anchorPoint(link[3]), toAnchor: anchorPoint(link[5]), direction }); continue;
      }
      if (/^(?:accTitle\s|accDescr\s)/i.test(line)) continue;
      throw new Error(`Unsupported Mermaid architecture syntax: ${line}`);
    }

    if (type === "ishikawa") {
      const label = unquote(line);
      if (!label) throw new Error(`Mermaid Ishikawa labels cannot be empty (line ${lineIndex + 1}).`);
      if (!nodes.size) {
        const id = get("ishikawa_problem", label, "rounded", "mermaid-ishikawa-problem");
        hierarchy.push({ indent, id }); continue;
      }
      while (hierarchy.length && hierarchy[hierarchy.length - 1].indent >= indent) hierarchy.pop();
      const parent = hierarchy[hierarchy.length - 1];
      if (!parent) throw new Error(`Every Mermaid Ishikawa cause must be indented beneath its parent (line ${lineIndex + 1}).`);
      const id = `ishikawa_cause_${nodes.size}`;
      const nodeId = get(id, label, "rounded", `mermaid-ishikawa-cause:${encodeURIComponent(parent.id)}`);
      edges.push({ from: parent.id, to: nodeId, label: "", sourceLine: lineIndex + 1 });
      hierarchy.push({ indent, id: nodeId }); continue;
    }

    if (type === "mindmap") {
      const bracket = /^([A-Za-z_][\w.-]*)\s*\[([^\]]+)\]$/.exec(line);
      const circle = /^([A-Za-z_][\w.-]*)\(\((.+)\)\)$/.exec(line);
      const rounded = /^([A-Za-z_][\w.-]*)\((.+)\)$/.exec(line);
      const label = (bracket?.[2] ?? circle?.[2] ?? rounded?.[2] ?? line.replace(/^[-+*]\s*/, "")).trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_match, double, single) => double ?? single);
      const key = bracket?.[1] ?? circle?.[1] ?? rounded?.[1] ?? `mindmap_${nodes.size + 1}`;
      while (hierarchy.length && hierarchy[hierarchy.length - 1].indent >= indent) hierarchy.pop();
      const parent = hierarchy[hierarchy.length - 1]?.id;
      const nodeId = get(key, label.trim(), hierarchy.length ? "rounded" : circle ? "circle" : "rounded", "mermaid-mindmap");
      if (parent) edges.push({ from: parent, to: nodeId, label: "" });
      hierarchy.push({ indent, id: nodeId });
      continue;
    }

    if (type === "timeline") {
      const event = /^(.+?)\s*:\s*(.+)$/.exec(line);
      if (event) {
        const date = event[1].trim(); const label = event[2].trim(); const id = get(`timeline_${nodes.size + 1}`, label, "rounded", `mermaid-timeline:${encodeURIComponent(date)}:${encodeURIComponent(section || "Timeline")}`);
        if (previousTimelineEvent) edges.push({ from: previousTimelineEvent, to: id, label: "" });
        previousTimelineEvent = id; continue;
      }
      if (/^(?:accTitle\s|accDescr\s)/i.test(line)) continue;
      throw new Error(`Unsupported Mermaid timeline syntax: ${line}`);
    }

    if (type === "git") {
      const branch = /^(?:branch|checkout)\s+([\w.-]+)$/i.exec(line);
      if (branch) {
        const name = branch[1];
        if (/^branch/i.test(line)) branchHeads.set(name, branchHeads.get(currentBranch) ?? "");
        currentBranch = name; continue;
      }
      const commit = /^(commit|merge|cherry-pick)(?:\s+([\s\S]*))?$/i.exec(line);
      if (commit) {
        const command = commit[1].toLowerCase(); const args = commit[2] ?? "";
        const idMatch = /\bid\s*:\s*(?:"([^"]+)"|'([^']+)'|([\w.-]+))/i.exec(args);
        const labelMatch = /\btag\s*:\s*(?:"([^"]+)"|'([^']+)'|([\w.-]+))/i.exec(args);
        const key = `git_${++commitSequence}`; const label = idMatch?.[1] ?? idMatch?.[2] ?? idMatch?.[3] ?? labelMatch?.[1] ?? labelMatch?.[2] ?? labelMatch?.[3] ?? `Commit ${commitSequence}`;
        const id = get(key, label, "circle", `mermaid-git:${encodeURIComponent(currentBranch)}:${encodeURIComponent(label)}`);
        const previous = branchHeads.get(currentBranch); if (previous) edges.push({ from: previous, to: id, label: command === "merge" ? "merge" : command === "cherry-pick" ? "cherry-pick" : "" });
        if (command === "merge") {
          const sourceBranch = args.trim().split(/\s+/)[0]; const otherHead = branchHeads.get(sourceBranch);
          if (otherHead && otherHead !== previous) edges.push({ from: otherHead, to: id, label: "merge" });
        }
        branchHeads.set(currentBranch, id); continue;
      }
      if (/^%%/.test(raw) || /^acc(?:Title|Descr)\s/i.test(line)) continue;
      throw new Error(`Unsupported Mermaid gitGraph syntax: ${line}`);
    }

    if (type === "requirement") {
      const declaration = /^(requirement|functionalRequirement|interfaceRequirement|performanceRequirement|physicalRequirement|designConstraint|element)\s+([\w.-]+)\s*\{?$/i.exec(line);
      if (declaration) {
        const key = get(declaration[2], `${declaration[1]}\n${declaration[2]}`, "rounded", `mermaid-requirement:${declaration[1]}`);
        fields.set(key, fields.get(key) ?? []); activeClass = key; continue;
      }
      const field = /^(id|text|risk|verifymethod|type)\s*:\s*(.+)$/i.exec(line);
      if (activeClass && field) { fields.set(activeClass, [...(fields.get(activeClass) ?? []), `${field[1]}: ${field[2]}`].slice(0, 12)); continue; }
      const relation = /^([\w.-]+)\s+-\s*(satisfies|verifies|refines|traces|contains|derives|copies|derives from)\s*->\s*([\w.-]+)$/i.exec(line);
      if (relation) { const from = get(relation[1]); const to = get(relation[3]); edges.push({ from, to, label: relation[2], relation: relation[2] }); continue; }
      if (/^(?:accTitle\s|accDescr\s)/i.test(line)) continue;
      throw new Error(`Unsupported Mermaid requirement syntax: ${line}`);
    }

    if (type === "quadrant") {
      const point = /^point\s+(.+?)\s*:\s*\[\s*([\d.]+)\s*,\s*([\d.]+)\s*\]$/i.exec(line);
      if (point) {
        const x = Math.max(0, Math.min(1, Number(point[2]))); const y = Math.max(0, Math.min(1, Number(point[3])));
        const label = point[1].trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_match, double, single) => double ?? single);
        get(`quadrant_${nodes.size + 1}`, label, "circle", `mermaid-quadrant:${x}:${y}`); continue;
      }
      const axis = /^(x-axis|y-axis)\s+(.+?)(?:\s+-->\s+(.+))?$/i.exec(line);
      if (axis) { metadata[`${axis[1].toLowerCase()}-low`] = axis[2].trim(); if (axis[3]) metadata[`${axis[1].toLowerCase()}-high`] = axis[3].trim(); continue; }
      const quadrantLabel = /^quadrant-([1-4])\s+(.+)$/i.exec(line);
      if (quadrantLabel) { metadata[`quadrant-${quadrantLabel[1]}`] = quadrantLabel[2].trim(); continue; }
      if (/^(?:accTitle|accDescr)\b/i.test(line)) continue;
      throw new Error(`Unsupported Mermaid quadrant syntax: ${line}`);
    }

    if (type === "kanban") {
      const item = /^([A-Za-z_][\w.-]*)\s*\[([^\]]+)\]$/.exec(line);
      const label = (item?.[2] ?? line.replace(/^\[|\]$/g, "").trim()).trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_match, double, single) => double ?? single);
      if (!label) throw new Error(`Unsupported Mermaid kanban syntax: ${line}`);
      while (hierarchy.length && hierarchy[hierarchy.length - 1].indent >= indent) hierarchy.pop();
      if (!hierarchy.length || indent <= (hierarchy[0]?.indent ?? indent)) {
        const key = get(item?.[1] ?? `kanban_column_${kanbanColumns.length + 1}`, label, "rounded", "mermaid-kanban-column");
        kanbanColumns.push(key); hierarchy.push({ indent, id: key });
      } else {
        const columnId = hierarchy[0]?.id ?? "kanban_column_1";
        const key = get(item?.[1] ?? `kanban_task_${nodes.size + 1}`, label, "rectangle", `mermaid-kanban-card:${columnId}`);
        hierarchy.push({ indent, id: key });
      }
      continue;
    }

    if (type === "sankey") {
      const [sourceName, targetName, rawWeight, ...extra] = parseArgs(line);
      const weight = Number(rawWeight);
      if (!sourceName || !targetName || !rawWeight || !Number.isFinite(weight) || weight < 0 || extra.length) throw new Error(`Unsupported Mermaid Sankey syntax: ${line}`);
      const from = get(sourceName, sourceName, "rectangle", "mermaid-sankey"); const to = get(targetName, targetName, "rectangle", "mermaid-sankey");
      edges.push({ from, to, label: String(weight) }); continue;
    }

    if (type === "block") {
      const columns = /^columns\s+([1-9]\d*)$/i.exec(line);
      if (columns) { blockColumns = Number(columns[1]); if (blockColumns > 12) throw new Error("Mermaid block diagrams support at most 12 columns."); metadata.columns = String(blockColumns); continue; }
      if (/^space(?::[1-9]\d*)?$/i.test(line)) throw new Error("Mermaid block space directives are not supported yet; use named blocks.");
      if (/^(?:block:|end\b)/i.test(line)) throw new Error("Nested Mermaid block groups are not supported yet: " + line);
      const tokens = line.match(/(?:[\w.-]+\[[^\]]*\]|[\w.-]+(?::[1-9]\d*)?)/g) ?? [];
      if (!tokens.length) throw new Error("Unsupported Mermaid block syntax: " + line);
      let row = blockRow; let column = 0;
      for (const token of tokens) {
        const spanMatch = /^([\w.-]+):([1-9]\d*)$/.exec(token); const labeled = /^([\w.-]+)\[([\s\S]*)\]$/.exec(token);
        const id = spanMatch?.[1] ?? labeled?.[1] ?? token; const span = Math.min(blockColumns, Number(spanMatch?.[2] ?? 1));
        const label = labeled?.[2]?.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_match, double, single) => double ?? single) ?? id;
        if (column >= blockColumns) { row++; column = 0; }
        get(id, label, "rounded", "mermaid-block:" + row + ":" + column + ":" + span); column += span;
      }
      blockRow = row + 1; continue;
    }

    if (type === "class") {
      const alias = /^class\s+(?:"([^"]+)"|'([^']+)'|([\w.]+))\s+as\s+([\w.]+)\s*(\{)?$/i.exec(line);
      if (alias) { const label = alias[1] ?? alias[2] ?? alias[3]; activeClass = get(alias[4], label); fields.set(activeClass, fields.get(activeClass) ?? []); if (!alias[5]) activeClass = ""; continue; }
      const block = /^class\s+([\w.]+)(?:\s*\[\s*([\s\S]*?)\s*\])?\s*\{?$/.exec(line);
      if (block) { activeClass = get(block[1], block[2] || block[1]); fields.set(activeClass, fields.get(activeClass) ?? []); continue; }
      const rel = /^([\w.]+)\s+(?:"([^"]+)"\s+)?(<\|--|--\|>|<\.\.\||\.\.\|>|<\.\.>|\.\.>|\*--|--\*|o--|--o|--|\.\.|-->|<-->)\s+(?:"([^"]+)"\s+)?([\w.]+)(?:\s*:\s*(.*))?$/.exec(line);
      if (rel) { const from = get(rel[1]); const to = get(rel[5]); edges.push({ from, to, label: (rel[6] ?? "").trim(), relation: rel[3], ...(rel[2] ? { fromCardinality: rel[2] } : {}), ...(rel[4] ? { toCardinality: rel[4] } : {}) }); continue; }
      const member = /^(?:([\w.]+)\s*:\s*)?([+\-#~]?\s*[^:()]+(?:\([^)]*\))?(?:\s*:\s*[^:]+)?)$/.exec(line);
      if (activeClass && member) { fields.set(activeClass, [...(fields.get(activeClass) ?? []), member[2].trim()].slice(0, 24)); continue; }
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
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      const column = Math.max(1, raw.search(/\S/) + 1);
      const conciseMessage = message.replace(/\s+\(line \d+(?:, column \d+)?\)$/, "");
      throw new Error(`${conciseMessage} (line ${lineIndex + 1}, column ${column})`);
    }
  }
  let chartData: LibraryChartData | undefined;
  if (type === "pie") {
    if (!pieLabels.length) throw new Error("The Mermaid pie diagram has no slices.");
    if (pieLabels.length > 300) throw new Error("Mermaid pie diagrams are limited to 300 slices.");
    chartData = { labels: pieLabels, values: pieValues, ...(title ? { title } : {}), options: { showValues: metadata.showData === "true", legend: "right" } };
  }
  if (type === "xychart") {
    if (!xySeries.length) throw new Error("The Mermaid XY chart has no bar or line series.");
    if (xySeries.length > 20) throw new Error("Mermaid XY charts are limited to 20 series.");
    const categoryCount = xyLabels.length || xySeries[0].values.length;
    if (!categoryCount || categoryCount > 300 || xySeries.some(item => item.values.length !== categoryCount)) throw new Error("Mermaid XY series must contain the same number of values as the category labels, with a maximum of 300 categories.");
    const labels = xyLabels.length ? xyLabels : Array.from({ length: categoryCount }, (_value, index) => String(index + 1));
    chartData = { labels, values: xySeries[0].values, ...(title ? { title } : {}), ...(xyXAxisLabel ? { xAxisLabel: xyXAxisLabel } : {}), ...(xyYAxisLabel ? { yAxisLabel: xyYAxisLabel } : {}), series: xySeries, options: { showGrid: true, showPoints: true, ...(xyMin === undefined ? {} : { minValue: xyMin }), ...(xyMax === undefined ? {} : { maxValue: xyMax }) } };
  }
  if (type === "radar") {
    if (radarAxisIds.length < 3) throw new Error("Mermaid radar diagrams need at least three axes.");
    if (!radarSeries.length) throw new Error("The Mermaid radar diagram has no curves.");
    if (radarSeries.length > 20 || radarAxisIds.length > 60) throw new Error("Mermaid radar diagrams are limited to 20 curves and 60 axes.");
    if (radarSeries.some(series => series.values.length !== radarAxisIds.length)) throw new Error("Every Mermaid radar curve must provide one value for each declared axis.");
    const allValues = radarSeries.flatMap(series => series.values); const minValue = radarMin ?? 0; const maxValue = radarMax ?? Math.max(1, ...allValues);
    if (maxValue <= minValue) throw new Error("Mermaid radar maximum must be greater than its minimum.");
    if (allValues.some(value => value < minValue || value > maxValue)) throw new Error("Mermaid radar curve values must fall within the configured min/max range.");
    chartData = { labels: radarLabels, axisIds: radarAxisIds, values: radarSeries[0].values, ...(title ? { title } : {}), series: radarSeries, options: { minValue, maxValue, radarTicks, radarGraticule, legend: radarLegend ? "right" : "hidden", showPoints: true } };
  }
  if (type === "treemap") {
    if (!nodes.size) throw new Error("The Mermaid treemap has no sections or leaves.");
    const children = new Map<string, Node[]>();
    for (const node of nodes.values()) {
      const role = /^mermaid-treemap:([^:]*):(.*)$/.exec(node.role ?? ""); const parent = role ? decodePart(role[1]) : "";
      if (parent && !nodes.has(parent)) throw new Error(`Mermaid treemap node ${node.id} references an unknown parent.`);
      if (parent) children.set(parent, [...(children.get(parent) ?? []), node]);
    }
    for (const node of nodes.values()) {
      const role = /^mermaid-treemap:([^:]*):(.*)$/.exec(node.role ?? ""); const explicitValue = role?.[2] ?? "";
      if (!children.get(node.id)?.length && !explicitValue) throw new Error(`Mermaid treemap leaf ${node.label.split("\n")[0]} needs a numeric value (line ${treemapSourceLines.get(node.id) ?? "?"}, column ${treemapSourceColumns.get(node.id) ?? "?"}).`);
    }
  }
  if (type === "venn") {
    if (vennSets.size < 2) throw new Error("Mermaid Venn diagrams need at least two sets.");
    if (vennSets.size > 8 || vennUnionCount > 100 || vennTextCount > 200) throw new Error("Mermaid Venn diagrams are limited to 8 sets, 100 unions, and 200 text nodes.");
  }
  if (type === "architecture") {
    for (const node of nodes.values()) {
      const role = node.role ?? ""; const parts = role.split(":"); const parent = role.startsWith("mermaid-architecture-service:") ? decodePart(parts[2] ?? "") : role.startsWith("mermaid-architecture-junction:") ? decodePart(parts[1] ?? "") : "";
      if (parent && !nodes.get(parent)?.role?.startsWith("mermaid-architecture-group:")) throw new Error(`Mermaid architecture item ${node.id} references unknown group ${parent} (line ${architectureMembershipLines.get(node.id) ?? "?"}, column ${architectureMembershipColumns.get(node.id) ?? "?"}).`);
    }
  }
  if (type === "ishikawa" && nodes.size < 2) throw new Error("Mermaid Ishikawa diagrams need an event and at least one indented cause.");
  if (!nodes.size && !chartData) throw new Error(`The ${type} diagram has no supported elements.`);
  if (nodes.size > 300 || edges.length > 500) throw new Error("Mermaid diagrams are limited to 300 objects and 500 relationships.");
  if (type === "usecase") {
    if (![...nodes.values()].some(node => node.role?.startsWith("mermaid-usecase-actor:") || node.role?.startsWith("mermaid-usecase-ellipse:") || node.role?.startsWith("mermaid-usecase-rectangle:"))) throw new Error("Mermaid use case diagrams need at least one actor or use case declaration.");
    for (const edge of edges) {
      const from = nodes.get(edge.from); const to = nodes.get(edge.to);
      if (!from || !to) throw new Error(`Mermaid use case relationship references a missing endpoint (line ${edge.sourceLine ?? "?"}, column ${edge.sourceColumn ?? "?"}).`);
      if (from.role === "mermaid-usecase-boundary" || to.role === "mermaid-usecase-boundary") throw new Error(`Mermaid use case relationships cannot target a system boundary (line ${edge.sourceLine ?? "?"}, column ${edge.sourceColumn ?? "?"}).`);
      const fromActor = from.role?.startsWith("mermaid-usecase-actor:") ?? false; const toActor = to.role?.startsWith("mermaid-usecase-actor:") ?? false;
      if ((edge.relation === "include" || edge.relation === "extend") && (fromActor || toActor)) throw new Error(`Mermaid ${edge.relation} relationships must connect use cases (line ${edge.sourceLine ?? "?"}, column ${edge.sourceColumn ?? "?"}).`);
      if ((edge.relation === "--|>" || edge.relation === "<|--") && fromActor !== toActor) throw new Error(`Mermaid use case generalization must connect two actors or two use cases (line ${edge.sourceLine ?? "?"}, column ${edge.sourceColumn ?? "?"}).`);
    }
  }
  for (const [id, members] of fields) { const node = nodes.get(id); if (node) node.label = [node.label, ...members].join("\n"); }
  return { nodes: [...nodes.values()], edges, ...(title ? { title } : {}), ...(sections.length ? { sections } : {}), ...(Object.keys(metadata).length ? { metadata } : {}), ...(chartData ? { chartData } : {}) };
}

function boxShape(node: Node, x: number, y: number, width: number, height: number): ShapeElement {
  const color = node.role?.startsWith("mermaid-c4:Person") ? "#6e83bf" : node.role?.startsWith("mermaid-c4:") ? "#668e82" : "#627f9a";
  return { type: node.shape === "circle" ? "circle" : node.shape === "diamond" ? "diamond" : "rectangle", id: `mermaid-node:${node.id}`, componentRole: node.role, x, y, w: width, h: height, color, thickness: 1.5, fillColor: node.role?.startsWith("mermaid-c4:") ? "#eef7f4" : "#f4f7fa", fillOpacity: 1, edgeStyle: node.shape === "rounded" ? "rounded" : "sharp", cornerRadius: node.shape === "rounded" ? 12 : undefined, label: { text: node.label, color: "#30465a", fontSize: 12, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } };
}

export type EditableClassNode = { id: string; label: string; attributes: string[]; methods: string[] };
export type EditableClassRelationship = { from: string; to: string; label?: string; operator?: string; fromCardinality?: string; toCardinality?: string };

/** Build native, field-editable UML class cards and bound relationships from diagram source. */
export function layoutEditableClassDiagram(nodes: EditableClassNode[], relationships: EditableClassRelationship[], center: Point, title = ""): Element[] {
  if (!nodes.length) throw new Error("Add at least one class to the class diagram.");
  const rank = new Map(nodes.map(node => [node.id, 0]));
  const outgoing = new Map(nodes.map(node => [node.id, [] as string[]]));
  const incoming = new Map(nodes.map(node => [node.id, 0]));
  for (const edge of relationships) {
    if (!rank.has(edge.from) || !rank.has(edge.to)) continue;
    outgoing.get(edge.from)!.push(edge.to); incoming.set(edge.to, incoming.get(edge.to)! + 1);
  }
  const queue = nodes.filter(node => incoming.get(node.id) === 0).map(node => node.id);
  const processed = new Set<string>();
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index]; processed.add(id);
    for (const target of outgoing.get(id) ?? []) {
      rank.set(target, Math.max(rank.get(target) ?? 0, (rank.get(id) ?? 0) + 1));
      incoming.set(target, incoming.get(target)! - 1);
      if (incoming.get(target) === 0) queue.push(target);
    }
  }
  // Cyclic associations have no topological order; keep their members together instead of
  // repeatedly pushing them into deeper columns.
  for (const node of nodes) if (!processed.has(node.id)) rank.set(node.id, 0);

  const dimensions = new Map<string, { w: number; h: number }>();
  for (const node of nodes) {
    const contentLines = [node.label, ...node.attributes, ...node.methods];
    const longestLine = Math.max(0, ...contentLines.map(line => line.length));
    const w = Math.max(220, Math.min(420, 54 + longestLine * 7.2));
    const attributeRows = Math.max(1, node.attributes.length);
    const methodRows = Math.max(1, node.methods.length);
    const h = Math.max(124, Math.min(560, 48 + (attributeRows + methodRows) * 18));
    dimensions.set(node.id, { w, h });
  }
  const maxRank = Math.max(...rank.values());
  const rankNodes = new Map<number, EditableClassNode[]>();
  nodes.forEach(node => rankNodes.set(rank.get(node.id) ?? 0, [...(rankNodes.get(rank.get(node.id) ?? 0) ?? []), node]));
  const rankWidths = Array.from({ length: maxRank + 1 }, (_, index) => Math.max(0, ...(rankNodes.get(index) ?? []).map(node => dimensions.get(node.id)!.w)));
  const columnGap = 78; const totalWidth = rankWidths.reduce((sum, width) => sum + width, 0) + columnGap * maxRank;
  const firstX = center.x - totalWidth / 2;
  const columnLeft = new Map<number, number>(); let cursorX = firstX;
  rankWidths.forEach((width, index) => { columnLeft.set(index, cursorX); cursorX += width + columnGap; });

  const scope = crypto.randomUUID(); const positions = new Map<string, GroupElement>();
  for (let column = 0; column <= maxRank; column++) {
    const members = rankNodes.get(column) ?? []; const totalHeight = members.reduce((sum, node) => sum + dimensions.get(node.id)!.h, 0) + Math.max(0, members.length - 1) * 38;
    let top = center.y - totalHeight / 2;
    for (const node of members) {
      const { w, h } = dimensions.get(node.id)!; const base = buildLibraryComponent("uml-class", 0, 0);
      const componentFields = (base.libraryComponent?.componentFields ?? []).map(field => field.key === "attributes"
        ? { ...field, value: node.attributes.join("\n") }
        : field.key === "methods" ? { ...field, value: node.methods.join("\n") } : field);
      const id = `uml-class:${scope}:${safeId(node.id, "class")}`;
      const group: GroupElement = {
        ...base, id, componentRole: `uml-class-node:${encodeURIComponent(node.id)}`,
        componentBounds: { x: columnLeft.get(column)! + (rankWidths[column] - w) / 2, y: top, w, h },
        libraryComponent: { ...base.libraryComponent!, label: node.label || node.id, componentFields },
      };
      positions.set(node.id, group); top += h + 38;
    }
  }

  const connector = (edge: EditableClassRelationship, index: number): ShapeElement | undefined => {
    const from = positions.get(edge.from); const to = positions.get(edge.to);
    if (!from?.componentBounds || !to?.componentBounds) return undefined;
    const fromBounds = from.componentBounds; const toBounds = to.componentBounds;
    const dx = toBounds.x + toBounds.w / 2 - (fromBounds.x + fromBounds.w / 2);
    const dy = toBounds.y + toBounds.h / 2 - (fromBounds.y + fromBounds.h / 2);
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const startAnchor = horizontal ? { x: dx >= 0 ? 1 : 0, y: .5 } : { x: .5, y: dy >= 0 ? 1 : 0 };
    const endAnchor = horizontal ? { x: dx >= 0 ? 0 : 1, y: .5 } : { x: .5, y: dy >= 0 ? 0 : 1 };
    const relation = edge.operator ?? "--";
    const startHead = relation.startsWith("<|") ? "hollow" : relation.startsWith("*") ? "diamond" : relation.startsWith("o") ? "open-diamond" : relation.startsWith("<") ? "solid" : "none";
    const endHead = relation.endsWith("|>") ? "hollow" : relation.endsWith("*") ? "diamond" : relation.endsWith("o") ? "open-diamond" : relation.endsWith(">") ? "solid" : "none";
    const start = { x: fromBounds.x + fromBounds.w * startAnchor.x, y: fromBounds.y + fromBounds.h * startAnchor.y };
    const end = { x: toBounds.x + toBounds.w * endAnchor.x, y: toBounds.y + toBounds.h * endAnchor.y };
    return {
      type: "line", id: `uml-class-link:${scope}:${index}`, componentRole: `uml-class-relation:${encodeURIComponent(JSON.stringify({ operator: relation, fromCardinality: edge.fromCardinality, toCardinality: edge.toCardinality, label: edge.label ?? "" }))}`,
      x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color: "#71869b", thickness: 1.6,
      lineStyle: relation.includes(".") ? "dashed" : "solid", startHead, endHead,
      autoRoute: true, arrowRoute: "elbow",
      startBinding: { elementId: from.id!, anchor: startAnchor }, endBinding: { elementId: to.id!, anchor: endAnchor },
      ...([edge.fromCardinality, edge.toCardinality, edge.label].some(Boolean) ? { label: { text: [edge.fromCardinality, edge.toCardinality, edge.label].filter(Boolean).join(" · "), color: "#52697e", fontSize: 11, fontFamily: "sans" as const, bold: false, italic: false, underline: false, textAlign: "center" as const, listType: "none" as const, verticalAlign: "top" as const } } : {}),
    };
  };
  const cards = [...positions.values()]; const links = relationships.map(connector).filter((item): item is ShapeElement => !!item);
  const classTop = cards.length ? Math.min(...cards.map(card => card.componentBounds!.y)) : center.y;
  const heading: Element[] = title ? [{ type: "text", id: "mermaid-title", x: center.x - Math.max(100, totalWidth / 2), y: classTop - 42, text: title, color: "#34495e", fontSize: 18, bold: true, fontFamily: "sans", textAlign: "left", listType: "none" }] : [];
  return [...heading, ...links, ...cards];
}

function classLayout(graph: Graph, center: Point): Element[] {
  const nodes = graph.nodes.map(node => {
    const members = node.label.split("\n").slice(1).map(member => member.trim()).filter(Boolean);
    return { id: node.id, label: node.label.split("\n")[0] || node.id, attributes: members.filter(member => !member.includes("(")), methods: members.filter(member => member.includes("(")) };
  });
  return layoutEditableClassDiagram(nodes, graph.edges.map(edge => ({ from: edge.from, to: edge.to, label: edge.label, operator: edge.relation, fromCardinality: edge.fromCardinality, toCardinality: edge.toCardinality })), center, graph.title);
}

function usecaseLayout(graph: Graph, center: Point): Element[] {
  const nodes = graph.nodes.filter(node => node.role?.startsWith("mermaid-usecase-actor:") || node.role?.startsWith("mermaid-usecase-ellipse:") || node.role?.startsWith("mermaid-usecase-rectangle:"));
  const boundaries = graph.nodes.filter(node => node.role === "mermaid-usecase-boundary");
  const boundaryOf = (node: Node) => decodePart(node.role?.slice(node.role.indexOf(":") + 1) ?? "");
  const members = new Map(boundaries.map(boundary => [boundary.id, nodes.filter(node => boundaryOf(node) === boundary.id)]));
  const unbounded = nodes.filter(node => !boundaryOf(node));
  const dimensions = (node: Node) => node.role?.startsWith("mermaid-usecase-actor:") ? { w: 104, h: 124 } : node.role?.startsWith("mermaid-usecase-rectangle:") ? { w: 190, h: 90 } : { w: 190, h: 100 };
  const boundaryDimensions = new Map(boundaries.map(boundary => {
    const count = members.get(boundary.id)?.length ?? 0; const columns = count > 1 ? 2 : 1; const rows = Math.max(1, Math.ceil(count / columns));
    return [boundary.id, { w: columns * 190 + 28, h: 58 + rows * 126 }];
  }));
  const unboundedColumns = unbounded.length > 1 ? 2 : 1; const unboundedRows = Math.max(1, Math.ceil(unbounded.length / unboundedColumns));
  const unboundedWidth = unbounded.length ? unboundedColumns * 202 : 0; const unboundedHeight = unbounded.length ? unboundedRows * 132 : 0;
  const direction = graph.metadata?.direction ?? "LR"; const horizontal = direction === "LR" || direction === "RL"; const reverse = direction === "RL" || direction === "BT";
  const orderedBoundaries = reverse ? [...boundaries].reverse() : boundaries;
  const positions = new Map<string, ShapeElement | GroupElement>(); const frames: ShapeElement[] = []; const cards: (ShapeElement | GroupElement)[] = [];
  const gap = 52;
  if (horizontal) {
    const frameWidth = orderedBoundaries.reduce((sum, boundary) => sum + boundaryDimensions.get(boundary.id)!.w, 0) + Math.max(0, orderedBoundaries.length - 1) * gap;
    const totalWidth = frameWidth + (unboundedWidth ? (frameWidth ? gap : 0) + unboundedWidth : 0);
    let cursorX = center.x - totalWidth / 2;
    const placeNodes = (items: Node[], x: number, top: number, columns: number, containerId = "") => {
      items.forEach((node, index) => {
        const dims = dimensions(node); const column = index % columns; const row = Math.floor(index / columns);
        const cellX = x + 14 + column * 202 + Math.max(0, (190 - dims.w) / 2);
        const y = top + 48 + row * 126 + Math.max(0, (100 - dims.h) / 2);
        const position = { x: cellX, y, ...dims };
        const item = usecaseNodeElement(node, position, containerId);
        positions.set(node.id, item); cards.push(item);
      });
    };
    for (const boundary of orderedBoundaries) {
      const bounds = boundaryDimensions.get(boundary.id)!; const top = center.y - bounds.h / 2; const x = cursorX;
      const frame = usecaseBoundaryElement(boundary, { x, y: top, ...bounds });
      frames.push(frame); positions.set(boundary.id, frame);
      placeNodes(members.get(boundary.id) ?? [], x, top, (members.get(boundary.id)?.length ?? 0) > 1 ? 2 : 1, boundary.id);
      cursorX += bounds.w + gap;
    }
    if (unbounded.length) placeNodes(unbounded, cursorX, center.y - unboundedHeight / 2, unboundedColumns);
  } else {
    const frameHeight = orderedBoundaries.reduce((sum, boundary) => sum + boundaryDimensions.get(boundary.id)!.h, 0) + Math.max(0, orderedBoundaries.length - 1) * gap;
    const totalHeight = frameHeight + (unboundedHeight ? (frameHeight ? gap : 0) + unboundedHeight : 0);
    let cursorY = center.y - totalHeight / 2;
    const placeNodes = (items: Node[], x: number, top: number, columns: number, containerId = "") => {
      items.forEach((node, index) => {
        const dims = dimensions(node); const column = index % columns; const row = Math.floor(index / columns);
        const cellX = x + 14 + column * 202 + Math.max(0, (190 - dims.w) / 2);
        const y = top + 48 + row * 126 + Math.max(0, (100 - dims.h) / 2);
        const item = usecaseNodeElement(node, { x: cellX, y, ...dims }, containerId);
        positions.set(node.id, item); cards.push(item);
      });
    };
    for (const boundary of orderedBoundaries) {
      const bounds = boundaryDimensions.get(boundary.id)!; const x = center.x - bounds.w / 2; const y = cursorY;
      const frame = usecaseBoundaryElement(boundary, { x, y, ...bounds });
      frames.push(frame); positions.set(boundary.id, frame);
      placeNodes(members.get(boundary.id) ?? [], x, y, (members.get(boundary.id)?.length ?? 0) > 1 ? 2 : 1, boundary.id);
      cursorY += bounds.h + gap;
    }
    if (unbounded.length) placeNodes(unbounded, center.x - unboundedWidth / 2, cursorY, unboundedColumns);
  }
  const boundsOf = (item: ShapeElement | GroupElement) => {
    if (item.type === "group") return item.componentBounds;
    return { x: item.x, y: item.y, w: item.w, h: item.h };
  };
  const links: ShapeElement[] = graph.edges.flatMap((edge, index) => {
    const from = positions.get(edge.from); const to = positions.get(edge.to);
    if (!from || !to) return [];
    const a = boundsOf(from); const b = boundsOf(to); if (!a || !b) return [];
    const dx = b.x + b.w / 2 - (a.x + a.w / 2); const dy = b.y + b.h / 2 - (a.y + a.h / 2);
    const sideByCenter = (x: number, y: number) => Math.abs(x) >= Math.abs(y) ? { x: x >= 0 ? 1 : 0, y: .5 } : { x: .5, y: y >= 0 ? 1 : 0 };
    const startAnchor = sideByCenter(dx, dy); const endAnchor = sideByCenter(-dx, -dy);
    const start = { x: a.x + a.w * startAnchor.x, y: a.y + a.h * startAnchor.y }; const end = { x: b.x + b.w * endAnchor.x, y: b.y + b.h * endAnchor.y };
    let startHead: ShapeElement["startHead"] = "none"; let endHead: ShapeElement["endHead"] = "none"; let lineStyle: ShapeElement["lineStyle"] = "solid";
    if (edge.relation === "include" || edge.relation === "extend") { endHead = "open"; lineStyle = "dashed"; }
    else if (edge.relation === "--|>") endHead = "hollow";
    else if (edge.relation === "<|--") startHead = "hollow";
    else if (edge.relation === "-->") endHead = "solid";
    else if (edge.relation === "<--") startHead = "solid";
    else if (edge.relation === "--o") endHead = "dot";
    else if (edge.relation === "o--") startHead = "dot";
    else if (edge.relation === "--x") endHead = "bar";
    else if (edge.relation === "x--") startHead = "bar";
    return [{
      type: "line", id: `mermaid-link:${index}`,
      componentRole: `mermaid-usecase-edge:${encodeURIComponent(JSON.stringify({ operator: edge.relation ?? "--", label: edge.label }))}`,
      x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color: "#71869b", thickness: 1.6,
      lineStyle, startHead, endHead, autoRoute: true, arrowRoute: "elbow",
      startBinding: { elementId: from.id!, anchor: startAnchor }, endBinding: { elementId: to.id!, anchor: endAnchor },
      ...(edge.label ? { label: { text: edge.label, color: "#52697e", fontSize: 11, fontFamily: "sans" as const, bold: false, italic: false, underline: false, textAlign: "center" as const, listType: "none" as const, verticalAlign: "top" as const } } : {}),
    }];
  });
  const bounds = [...frames, ...cards].flatMap(item => { const itemBounds = boundsOf(item); return itemBounds ? [itemBounds] : []; });
  const title: Element[] = graph.title && bounds.length ? [{ type: "text", id: "mermaid-title", x: Math.min(...bounds.map(item => item.x)), y: Math.min(...bounds.map(item => item.y)) - 36, text: graph.title, color: "#34495e", fontSize: 18, bold: true, fontFamily: "sans", textAlign: "left", listType: "none" }] : [];
  return [...title, ...frames, ...links, ...cards];
}

function ishikawaLayout(graph: Graph, center: Point): Element[] {
  const problem = graph.nodes.find(node => node.role === "mermaid-ishikawa-problem");
  if (!problem) throw new Error("Mermaid Ishikawa diagrams need a problem statement.");
  const children = new Map<string, Node[]>();
  for (const edge of graph.edges) {
    const child = graph.nodes.find(node => node.id === edge.to);
    if (child) children.set(edge.from, [...(children.get(edge.from) ?? []), child]);
  }
  const categories = children.get(problem.id) ?? [];
  if (!categories.length) throw new Error("Mermaid Ishikawa diagrams need at least one cause beneath the problem.");
  const spanCache = new Map<string, number>();
  const spanOf = (node: Node): number => {
    const cached = spanCache.get(node.id); if (cached !== undefined) return cached;
    const members = children.get(node.id) ?? [];
    const descendants = members.reduce((sum, child) => sum + spanOf(child), 0) + Math.max(0, members.length - 1) * 20;
    const span = Math.max(180, descendants); spanCache.set(node.id, span); return span;
  };
  const gaps = Math.max(0, categories.length - 1) * 34;
  const totalWidth = categories.reduce((sum, node) => sum + spanOf(node), 0) + gaps;
  const spineStart = center.x - totalWidth / 2; const problemBounds = { x: spineStart + totalWidth + 46, y: center.y - 48, w: 210, h: 96 };
  const positions = new Map<string, { x: number; y: number; w: number; h: number }>();
  const shapes: ShapeElement[] = [];
  const placeNode = (node: Node, x: number, y: number, depth: number, side: -1 | 1) => {
    const w = depth === 0 ? problemBounds.w : depth === 1 ? 154 : 140;
    const h = depth === 0 ? problemBounds.h : depth === 1 ? 48 : 42;
    const bounds = depth === 0 ? problemBounds : { x: x - w / 2, y: y - h / 2, w, h };
    const shape = boxShape(node, bounds.x, bounds.y, bounds.w, bounds.h);
    shape.componentRole = node.role;
    shape.fillColor = depth === 0 ? "#f5e9e9" : depth === 1 ? "#eaf0f5" : "#f8fafb";
    shape.color = depth === 0 ? "#ad6464" : "#627f9a";
    shape.label = { ...shape.label!, text: node.label, color: "#30404c", fontSize: depth === 0 ? 15 : depth === 1 ? 12 : 11, bold: depth <= 1, textAlign: "center", verticalAlign: "middle" };
    positions.set(node.id, bounds); shapes.push(shape);
    const members = children.get(node.id) ?? [];
    if (!members.length) return;
    const childTotal = members.reduce((sum, child) => sum + spanOf(child), 0) + Math.max(0, members.length - 1) * 20;
    let cursor = x - childTotal / 2;
    for (const child of members) {
      const childSpan = spanOf(child); const childCenter = cursor + childSpan / 2;
      const childY = center.y + side * (112 + depth * 80);
      placeNode(child, childCenter, childY, depth + 1, side); cursor += childSpan + 20;
    }
  };
  const rootShape = (() => {
    const shape = boxShape(problem, problemBounds.x, problemBounds.y, problemBounds.w, problemBounds.h);
    shape.componentRole = problem.role; shape.fillColor = "#f5e9e9"; shape.color = "#ad6464";
    shape.label = { ...shape.label!, text: problem.label, color: "#543838", fontSize: 15, bold: true, textAlign: "center", verticalAlign: "middle" };
    positions.set(problem.id, problemBounds); shapes.push(shape); return shape;
  })();
  let cursor = spineStart;
  categories.forEach((node, index) => {
    const span = spanOf(node); const nodeCenter = cursor + span / 2; const side = (index % 2 === 0 ? -1 : 1) as -1 | 1;
    const y = center.y + side * 112;
    placeNode(node, nodeCenter, y, 1, side); cursor += span + 34;
  });
  const spineWidth = problemBounds.x - spineStart;
  const spine: ShapeElement = {
    type: "line", id: "mermaid-ishikawa-spine", componentRole: "mermaid-ishikawa-spine",
    x: spineStart, y: center.y, w: spineWidth, h: 0, color: "#627f9a", thickness: 2.2,
    lineRoute: "straight", startHead: "none", endHead: "none",
    endBinding: { elementId: rootShape.id!, anchor: { x: 0, y: .5 } },
  };
  const connector = (fromId: string, toId: string, startBounds: { x: number; y: number; w: number; h: number }, endBounds: { x: number; y: number; w: number; h: number }, startAnchor: { x: number; y: number }, endAnchor: { x: number; y: number }, index: number): ShapeElement => {
    const start = { x: startBounds.x + startBounds.w * startAnchor.x, y: startBounds.y + startBounds.h * startAnchor.y };
    const end = { x: endBounds.x + endBounds.w * endAnchor.x, y: endBounds.y + endBounds.h * endAnchor.y };
    return {
      type: "line", id: `mermaid-link:${index}`,
      componentRole: `mermaid-ishikawa-edge:${encodeURIComponent(JSON.stringify({ from: fromId, to: toId }))}`,
      x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color: "#71869b", thickness: 1.4,
      lineRoute: "straight", startHead: "none", endHead: "none",
      startBinding: { elementId: fromId === problem.id ? spine.id! : `mermaid-node:${fromId}`, anchor: startAnchor },
      endBinding: { elementId: `mermaid-node:${toId}`, anchor: endAnchor },
    };
  };
  const links: ShapeElement[] = [];
  let linkIndex = 0;
  for (const node of categories) {
    const bounds = positions.get(node.id)!; const parent = decodePart(node.role?.slice("mermaid-ishikawa-cause:".length) ?? "");
    const side = (categories.indexOf(node) % 2 === 0 ? -1 : 1) as -1 | 1;
    links.push(connector(parent, node.id, { x: spineStart, y: center.y, w: spineWidth, h: 0 }, bounds, { x: (bounds.x + bounds.w / 2 - spineStart) / spineWidth, y: .5 }, { x: .5, y: side < 0 ? 1 : 0 }, linkIndex++));
  }
  for (const edge of graph.edges) {
    if (edge.from === problem.id) continue;
    const parent = positions.get(edge.from); const child = positions.get(edge.to); if (!parent || !child) continue;
    const parentSide = parent.y + parent.h / 2 < center.y ? -1 : 1;
    links.push(connector(edge.from, edge.to, parent, child, { x: .5, y: parentSide < 0 ? 0 : 1 }, { x: .5, y: parentSide < 0 ? 1 : 0 }, linkIndex++));
  }
  return [spine, ...links, ...shapes];
}

function usecaseNodeElement(node: Node, bounds: { x: number; y: number; w: number; h: number }, _containerId = ""): ShapeElement | GroupElement {
  const role = node.role ?? ""; const id = `mermaid-node:${node.id}`;
  if (role.startsWith("mermaid-usecase-actor:")) {
    const component = buildLibraryComponent("uml-actor", bounds.x, bounds.y);
    return { ...component, id, componentRole: role, componentBounds: bounds, libraryComponent: { ...component.libraryComponent!, label: node.label } };
  }
  if (role.startsWith("mermaid-usecase-ellipse:")) {
    const component = buildLibraryComponent("uml-use-case", bounds.x, bounds.y);
    return { ...component, id, componentRole: role, componentBounds: bounds, libraryComponent: { ...component.libraryComponent!, label: node.label } };
  }
  return { ...boxShape(node, bounds.x, bounds.y, bounds.w, bounds.h), id, componentRole: role, fillColor: "#f6f2ff", fillOpacity: 1, label: { text: node.label, color: "#59488c", fontSize: 12, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } };
}

function usecaseBoundaryElement(node: Node, bounds: { x: number; y: number; w: number; h: number }): ShapeElement {
  return { type: "rectangle", id: `mermaid-node:${node.id}`, componentRole: "mermaid-usecase-boundary", ...bounds, color: "#7563ad", thickness: 1.4, fillColor: "#f6f2ff", fillOpacity: .16, edgeStyle: "sharp", label: { text: node.label, color: "#59488c", fontSize: 14, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "top" } };
}

function graphLayout(graph: Graph, center: Point, type: ExtendedMermaidType): Element[] {
  const incoming = new Map(graph.nodes.map(node => [node.id, 0])); const outgoing = new Map(graph.nodes.map(node => [node.id, [] as string[]]));
  for (const edge of graph.edges) { incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1); outgoing.get(edge.from)?.push(edge.to); }
  const rank = new Map(graph.nodes.map(node => [node.id, 0])); const degree = new Map(incoming); const queue = graph.nodes.filter(node => !degree.get(node.id));
  for (let index = 0; index < queue.length; index++) for (const target of outgoing.get(queue[index].id) ?? []) { rank.set(target, Math.max(rank.get(target) ?? 0, (rank.get(queue[index].id) ?? 0) + 1)); degree.set(target, (degree.get(target) ?? 1) - 1); if (!degree.get(target)) queue.push(graph.nodes.find(node => node.id === target)!); }
  const levels = new Map<number, Node[]>(); graph.nodes.forEach(node => { const level = rank.get(node.id) ?? 0; levels.set(level, [...(levels.get(level) ?? []), node]); });
  const maxRank = Math.max(...levels.keys()); const positions = new Map<string, ShapeElement>(); const horizontal = type === "class" || type === "c4" || type === "sankey";
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

function timelineLayout(graph: Graph, center: Point, type: "journey" | "gantt" | "timeline"): Element[] {
  const rows: Element[] = []; const positions = new Map<string, ShapeElement>(); const nodes = graph.nodes; const rowHeight = type === "journey" ? 88 : 54; const left = center.x - 430; const top = center.y - Math.max(160, nodes.length * rowHeight / 2);
  if (graph.title) rows.push({ type: "text", id: "mermaid-title", x: left, y: top - 42, text: graph.title, color: "#34495e", fontSize: 18, bold: true, fontFamily: "sans", textAlign: "left", listType: "none" });
  if (type === "timeline") {
    const sectionNames = [...new Set(nodes.map(node => { const match = /^mermaid-timeline:[^:]*:(.*)$/.exec(node.role ?? ""); return match ? decodePart(match[1]) : "Timeline"; }))];
    const dates = nodes.map(node => { const match = /^mermaid-timeline:([^:]*):/.exec(node.role ?? ""); const raw = match ? decodePart(match[1]) : ""; const value = Date.parse(raw); return Number.isFinite(value) ? value : Number.NaN; });
    const validDates = dates.filter(Number.isFinite); const firstDate = validDates.length ? Math.min(...validDates) : undefined; const lastDate = validDates.length ? Math.max(...validDates) : undefined;
    const sectionSeen = new Set<string>();
    nodes.forEach((node, index) => {
      const match = /^mermaid-timeline:([^:]*):(.*)$/.exec(node.role ?? ""); const date = match ? decodePart(match[1]) : ""; const lane = match ? decodePart(match[2]) : "Timeline"; const laneIndex = Math.max(0, sectionNames.indexOf(lane));
      const dateValue = dates[index]; const x = firstDate !== undefined && lastDate !== undefined && Number.isFinite(dateValue) && lastDate > firstDate ? left + (dateValue - firstDate) / (lastDate - firstDate) * 650 : left + 20 + (index % 4) * 170;
      const y = top + laneIndex * 108; if (!sectionSeen.has(lane)) { sectionSeen.add(lane); rows.push({ type: "text", id: `mermaid-timeline-section:${laneIndex}`, x: left, y: y + 19, text: lane, color: "#34495e", fontSize: 13, bold: true, fontFamily: "sans", textAlign: "left", listType: "none" }); }
      const shape = boxShape(node, x, y, 164, 58); positions.set(node.id, shape); rows.push(shape);
      if (date) rows.push({ type: "text", id: `mermaid-timeline-date:${node.id}`, x, y: y + 62, text: date, color: "#667085", fontSize: 10, fontFamily: "sans", textAlign: "center", listType: "none" });
    });
    graph.edges.forEach((edge, index) => {
      const from = positions.get(edge.from); const to = positions.get(edge.to); if (!from || !to) return;
      const start = { x: from.x + from.w, y: from.y + from.h / 2 }; const end = { x: to.x, y: to.y + to.h / 2 };
      rows.push({ type: "arrow", id: `mermaid-link:${index}`, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color: "#71869b", thickness: 1.2, autoRoute: true, arrowRoute: "elbow", endHead: "solid", startBinding: { elementId: from.id!, anchor: { x: 1, y: .5 } }, endBinding: { elementId: to.id!, anchor: { x: 0, y: .5 } } });
    });
    return rows;
  }
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

function quadrantLayout(graph: Graph, center: Point): Element[] {
  const left = center.x - 360; const top = center.y - 220; const width = 720; const height = 440;
  const elements: Element[] = [];
  if (graph.title) elements.push({ type: "text", id: "mermaid-title", x: left, y: top - 40, text: graph.title, color: "#34495e", fontSize: 18, bold: true, fontFamily: "sans", textAlign: "left", listType: "none" });
  elements.push(
    { type: "line", id: "mermaid-quadrant-x-axis", x: center.x, y: top, w: 0, h: height, color: "#a6b2bf", thickness: 1 },
    { type: "line", id: "mermaid-quadrant-y-axis", x: left, y: center.y, w: width, h: 0, color: "#a6b2bf", thickness: 1 },
    { type: "text", id: "mermaid-quadrant-x-low", x: left, y: top + height + 12, text: graph.metadata?.["x-axis-low"] ?? "Low", color: "#667085", fontSize: 11, fontFamily: "sans", textAlign: "left", listType: "none" },
    { type: "text", id: "mermaid-quadrant-x-high", x: left + width - 100, y: top + height + 12, text: graph.metadata?.["x-axis-high"] ?? "High", color: "#667085", fontSize: 11, fontFamily: "sans", textAlign: "right", listType: "none" },
    { type: "text", id: "mermaid-quadrant-y-low", x: left - 10, y: top + height - 18, text: graph.metadata?.["y-axis-low"] ?? "Low", color: "#667085", fontSize: 11, fontFamily: "sans", textAlign: "right", listType: "none" },
    { type: "text", id: "mermaid-quadrant-y-high", x: left - 10, y: top, text: graph.metadata?.["y-axis-high"] ?? "High", color: "#667085", fontSize: 11, fontFamily: "sans", textAlign: "right", listType: "none" },
  );
  const quadrantTextPositions: Record<string, Point> = { "quadrant-1": { x: left + width / 2 + 12, y: top + 10 }, "quadrant-2": { x: left + 12, y: top + 10 }, "quadrant-3": { x: left + 12, y: center.y + 10 }, "quadrant-4": { x: left + width / 2 + 12, y: center.y + 10 } };
  for (const name of ["quadrant-1", "quadrant-2", "quadrant-3", "quadrant-4"]) if (graph.metadata?.[name]) elements.push({ type: "text", id: `mermaid-quadrant-label-${name.slice(-1)}`, ...quadrantTextPositions[name], text: graph.metadata[name], color: "#8290a0", fontSize: 11, fontFamily: "sans", textAlign: "left", listType: "none" });
  for (const node of graph.nodes) {
    const match = /^mermaid-quadrant:([\d.]+):([\d.]+)$/.exec(node.role ?? ""); const x = Number(match?.[1] ?? .5); const y = Number(match?.[2] ?? .5);
    elements.push(boxShape(node, left + x * width - 74, top + (1 - y) * height - 30, 148, 60));
  }
  return elements;
}

function kanbanLayout(graph: Graph, center: Point): Element[] {
  const columns = graph.nodes.filter(node => node.role === "mermaid-kanban-column");
  const cards = graph.nodes.filter(node => node.role?.startsWith("mermaid-kanban-card:"));
  const columnWidth = 230; const columnGap = 20; const cardHeight = 64; const cardGap = 14; const totalWidth = columns.length * columnWidth + Math.max(0, columns.length - 1) * columnGap;
  const left = center.x - totalWidth / 2; const top = center.y - 260; const result: Element[] = [];
  if (graph.title) result.push({ type: "text", id: "mermaid-title", x: left, y: top - 38, text: graph.title, color: "#34495e", fontSize: 18, bold: true, fontFamily: "sans", textAlign: "left", listType: "none" });
  columns.forEach((column, index) => {
    const x = left + index * (columnWidth + columnGap); const columnCards = cards.filter(card => card.role === `mermaid-kanban-card:${column.id}`);
    const height = Math.max(172, 72 + columnCards.length * (cardHeight + cardGap));
    result.push(boxShape(column, x, top, columnWidth, height));
    columnCards.forEach((card, cardIndex) => result.push(boxShape(card, x + 10, top + 54 + cardIndex * (cardHeight + cardGap), columnWidth - 20, cardHeight)));
  });
  return result;
}

function blockLayout(graph: Graph, center: Point): Element[] {
  const columns = Math.max(1, Math.min(12, Number(graph.metadata?.columns) || 3)); const cellWidth = Math.min(230, 820 / columns); const gap = 16; const rowHeight = 112;
  const left = center.x - (columns * cellWidth + (columns - 1) * gap) / 2; const top = center.y - Math.max(100, graph.nodes.length * rowHeight / columns / 2); const result: Element[] = [];
  if (graph.title) result.push({ type: "text", id: "mermaid-title", x: left, y: top - 40, text: graph.title, color: "#34495e", fontSize: 18, bold: true, fontFamily: "sans", textAlign: "left", listType: "none" });
  for (const node of graph.nodes) {
    const match = /^mermaid-block:(\d+):(\d+):(\d+)$/.exec(node.role ?? ""); const row = Number(match?.[1] ?? 0); const column = Number(match?.[2] ?? 0); const span = Number(match?.[3] ?? 1);
    const width = span * cellWidth + (span - 1) * gap; const x = left + column * (cellWidth + gap); const y = top + row * rowHeight;
    result.push(boxShape(node, x, y, width, 80));
  }
  return result;
}

function chartLayout(graph: Graph, center: Point, type: "pie" | "xychart" | "radar"): GroupElement {
  const width = type === "pie" ? 360 : type === "radar" ? 400 : 440; const height = type === "pie" ? 300 : type === "radar" ? 360 : 320;
  const kind = type === "pie" ? "viz-pie" : type === "radar" ? "viz-radar" : "viz-line";
  return {
    type: "group", id: `mermaid-chart:${type}`, elements: [],
    componentBounds: { x: center.x - width / 2, y: center.y - height / 2, w: width, h: height },
    libraryComponent: { kind, label: type === "pie" ? "Mermaid pie chart" : "Mermaid XY chart", chartData: graph.chartData ?? { labels: [], values: [] } },
  };
}

function treemapRole(node: Node) {
  const match = /^mermaid-treemap:([^:]*):(.*)$/.exec(node.role ?? "");
  return { parent: match ? decodePart(match[1]) : "", explicitValue: match?.[2] ? Number(match[2]) : undefined };
}

function treemapLayout(graph: Graph, center: Point): Element[] {
  const nodes = new Map(graph.nodes.map(node => [node.id, node])); const children = new Map<string, Node[]>(); const weights = new Map<string, number>();
  for (const node of graph.nodes) { const parent = treemapRole(node).parent; if (parent) children.set(parent, [...(children.get(parent) ?? []), node]); }
  const weight = (node: Node, path = new Set<string>()): number => {
    const cached = weights.get(node.id); if (cached !== undefined) return cached;
    if (path.has(node.id)) throw new Error("Mermaid treemap hierarchy contains a cycle.");
    const next = new Set(path); next.add(node.id); const explicit = treemapRole(node).explicitValue; const descendants = children.get(node.id) ?? [];
    const value = explicit ?? (descendants.length ? descendants.reduce((sum, child) => sum + weight(child, next), 0) : 0);
    if (!(value > 0) || !Number.isFinite(value)) throw new Error(`Mermaid treemap node ${node.label.split("\n")[0]} needs a positive total value.`);
    weights.set(node.id, value); return value;
  };
  const roots = graph.nodes.filter(node => !treemapRole(node).parent); roots.forEach(node => weight(node));
  const maxDepth = graph.nodes.reduce((max, node) => {
    let depth = 0; let parent = treemapRole(node).parent; const seen = new Set<string>();
    while (parent && nodes.has(parent) && !seen.has(parent)) { seen.add(parent); depth++; parent = treemapRole(nodes.get(parent)!).parent; }
    return Math.max(max, depth);
  }, 0);
  const left = center.x - 440; const top = center.y - Math.max(250, (maxDepth + 1) * 44); const width = 880; const height = Math.max(500, (maxDepth + 1) * 92); const result: Element[] = [];
  if (graph.title) result.push({ type: "text", id: "mermaid-title", x: left, y: top - 38, text: graph.title, color: "#34495e", fontSize: 18, bold: true, fontFamily: "sans", textAlign: "left", listType: "none" });
  const colors = ["#dceafa", "#e4f0e5", "#f6ead5", "#eee4f4", "#dceff0", "#f4e1e1"];
  const tile = (items: Node[], bounds: { x: number; y: number; w: number; h: number }, depth: number) => {
    const total = items.reduce((sum, node) => sum + weight(node), 0); let cursor = 0;
    const horizontal = bounds.w >= bounds.h;
    for (const node of items) {
      const ratio = weight(node) / Math.max(total, Number.EPSILON); const gap = items.length > 1 ? 2 : 0;
      const box = horizontal
        ? { x: bounds.x + cursor, y: bounds.y, w: Math.max(1, bounds.w * ratio - gap), h: bounds.h }
        : { x: bounds.x, y: bounds.y + cursor, w: bounds.w, h: Math.max(1, bounds.h * ratio - gap) };
      cursor += (horizontal ? bounds.w : bounds.h) * ratio;
      const value = treemapRole(node).explicitValue; const shape = boxShape(node, box.x, box.y, box.w, box.h);
      if (shape.type !== "line") {
        shape.fillColor = colors[depth % colors.length]; shape.fillOpacity = depth === 0 ? .42 : .88;
        shape.label = { ...shape.label!, textAlign: "left", verticalAlign: "top", fontSize: Math.max(9, Math.min(14, 13 - depth * .5)), bold: depth === 0 };
      }
      result.push(shape);
      const nested = children.get(node.id) ?? [];
      if (nested.length) {
        const pad = depth === 0 ? 5 : 3; const header = Math.min(28, Math.max(18, box.h * .18));
        const inner = { x: box.x + pad, y: box.y + header, w: Math.max(1, box.w - pad * 2), h: Math.max(1, box.h - header - pad) };
        tile(nested, inner, depth + 1);
      } else if (value !== undefined && shape.type !== "line") {
        shape.label = { ...shape.label!, text: `${node.label.split("\n")[0]}\n${value}`, verticalAlign: "middle", textAlign: "center" };
      }
    }
  };
  tile(roots, { x: left, y: top, w: width, h: height }, 0);
  return result;
}

function vennLayout(graph: Graph, center: Point): Element[] {
  const sets = graph.nodes.filter(node => node.role?.startsWith("mermaid-venn-set:"));
  const unions = graph.nodes.filter(node => node.role?.startsWith("mermaid-venn-union:"));
  const textNodes = graph.nodes.filter(node => node.role?.startsWith("mermaid-venn-text:"));
  const declaredSizes = sets.map(node => Number(/^mermaid-venn-set:[^:]*:([^:]*)$/.exec(node.role ?? "")?.[1])).filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  const typicalSize = declaredSizes[Math.floor(declaredSizes.length / 2)] ?? 1;
  const radii = new Map(sets.map(node => {
    const rawSize = Number(/^mermaid-venn-set:[^:]*:([^:]*)$/.exec(node.role ?? "")?.[1]);
    const ratio = Number.isFinite(rawSize) && rawSize > 0 ? Math.sqrt(rawSize / typicalSize) : 1;
    return [node.id, Math.max(84, Math.min(146, 116 * ratio))];
  }));
  const centers = new Map<string, Point>(); const ringRadius = sets.length <= 4 ? 74 : 118;
  sets.forEach((node, index) => {
    const radius = radii.get(node.id) ?? 116;
    let position: Point;
    if (sets.length === 2) position = { x: center.x + (index === 0 ? -1 : 1) * radius * .62, y: center.y };
    else {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / sets.length;
      position = { x: center.x + Math.cos(angle) * ringRadius, y: center.y + Math.sin(angle) * ringRadius };
    }
    centers.set(node.id, position);
  });
  const palette = ["#6386c6", "#54a28c", "#e49b52", "#9a72c3", "#d67575", "#5d9fba", "#a7a143", "#cc72a2"];
  const result: Element[] = [];
  if (graph.title) result.push({ type: "text", id: "mermaid-title", x: center.x - 250, y: center.y - ringRadius - 190, text: graph.title, color: "#34495e", fontSize: 18, bold: true, fontFamily: "sans", textAlign: "left", listType: "none" });
  sets.forEach((node, index) => {
    const position = centers.get(node.id)!; const radius = radii.get(node.id) ?? 116; const color = palette[index % palette.length];
    const shape = boxShape(node, position.x - radius, position.y - radius, radius * 2, radius * 2);
    shape.fillColor = color; shape.fillOpacity = .2; shape.color = color; shape.thickness = 2;
    shape.label = { ...shape.label!, fontSize: 13, bold: true, textAlign: "center", verticalAlign: "top" };
    result.push(shape);
  });
  for (const node of unions) {
    const match = /^mermaid-venn-union:([^:]*):/.exec(node.role ?? "");
    let members: string[] = [];
    try { members = JSON.parse(decodePart(match?.[1] ?? "")) as string[]; } catch { members = []; }
    const memberCenters = members.map(sourceId => {
      const set = sets.find(candidate => decodePart(/^mermaid-venn-set:([^:]*):/.exec(candidate.role ?? "")?.[1] ?? "") === sourceId);
      return set ? centers.get(set.id) : undefined;
    }).filter((point): point is Point => !!point);
    if (!memberCenters.length) continue;
    const x = memberCenters.reduce((sum, point) => sum + point.x, 0) / memberCenters.length;
    const y = memberCenters.reduce((sum, point) => sum + point.y, 0) / memberCenters.length;
    const shape = boxShape(node, x - 62, y - 14, 124, 28);
    shape.fillOpacity = 0; shape.thickness = 0;
    shape.label = { ...shape.label!, fontSize: 12, bold: true, textAlign: "center", verticalAlign: "middle" };
    result.push(shape);
  }
  const childCounts = new Map<string, number>();
  textNodes.forEach(node => {
    const role = /^mermaid-venn-text:(set|union):([^:]*):/.exec(node.role ?? "");
    if (!role) return;
    const parentId = decodePart(role[2]); const parent = role[1] === "set" ? sets.find(item => item.id === parentId) : unions.find(item => item.id === parentId);
    if (!parent) return;
    const childKey = `${role[1]}:${parent.id}`; const childIndex = childCounts.get(childKey) ?? 0; childCounts.set(childKey, childIndex + 1);
    let position: Point;
    if (role[1] === "set") {
      const parentCenter = centers.get(parent.id)!; const radius = radii.get(parent.id) ?? 116; const offset = (childIndex % 3 - 1) * Math.min(28, radius * .22);
      position = { x: parentCenter.x + offset, y: parentCenter.y + radius * .18 + Math.floor(childIndex / 3) * 22 };
    } else {
      const unionRole = /^mermaid-venn-union:([^:]*):/.exec(parent.role ?? ""); let members: string[] = [];
      try { members = JSON.parse(decodePart(unionRole?.[1] ?? "")) as string[]; } catch { members = []; }
      const memberCenters = members.map(sourceId => {
        const set = sets.find(candidate => decodePart(/^mermaid-venn-set:([^:]*):/.exec(candidate.role ?? "")?.[1] ?? "") === sourceId);
        return set ? centers.get(set.id) : undefined;
      }).filter((point): point is Point => !!point);
      position = memberCenters.length ? { x: memberCenters.reduce((sum, point) => sum + point.x, 0) / memberCenters.length, y: memberCenters.reduce((sum, point) => sum + point.y, 0) / memberCenters.length + 20 + childIndex * 22 } : center;
    }
    const shape = boxShape(node, position.x - 54, position.y, 108, 24);
    shape.fillOpacity = 0; shape.thickness = 0;
    shape.label = { ...shape.label!, fontSize: 10, textAlign: "center", verticalAlign: "middle" };
    result.push(shape);
  });
  return result;
}

function packetLayout(graph: Graph, center: Point): Element[] {
  const bitsPerRow = 32; const bitWidth = 24; const left = center.x - bitsPerRow * bitWidth / 2; const firstRow = center.y - Math.max(84, graph.nodes.length * 30);
  const rows = new Map<number, Node[]>();
  for (const node of graph.nodes) {
    const match = /^mermaid-packet:(\d+):(\d+):(\d+)$/.exec(node.role ?? "");
    if (match) rows.set(Number(match[1]), [...(rows.get(Number(match[1])) ?? []), node]);
  }
  const result: Element[] = [];
  if (graph.title) result.push({ type: "text", id: "mermaid-title", x: left, y: firstRow - 38, text: graph.title, color: "#34495e", fontSize: 18, bold: true, fontFamily: "sans", textAlign: "left", listType: "none" });
  for (const [row, nodes] of [...rows.entries()].sort(([a], [b]) => a - b)) {
    const y = firstRow + row * 82;
    for (let bit = 0; bit < bitsPerRow; bit += 4) result.push({ type: "text", id: `mermaid-packet-bit:${row}:${bit}`, x: left + bit * bitWidth, y: y - 15, text: String(bit), color: "#667085", fontSize: 9, fontFamily: "mono", textAlign: "left", listType: "none" });
    for (const node of nodes) {
      const match = /^mermaid-packet:(\d+):(\d+):(\d+)$/.exec(node.role ?? "")!; const start = Number(match[2]); const end = Number(match[3]);
      const shape = boxShape(node, left + start * bitWidth, y, (end - start + 1) * bitWidth, 52);
      if (shape.type !== "line") shape.label = { ...shape.label!, fontSize: Math.max(8, Math.min(11, 10 + (end - start - 2) * .12)), textAlign: "center" };
      result.push(shape);
    }
  }
  return result;
}

function architectureLayout(graph: Graph, center: Point): Element[] {
  const groupNodes = graph.nodes.filter(node => node.role?.startsWith("mermaid-architecture-group:"));
  const serviceNodes = graph.nodes.filter(node => node.role?.startsWith("mermaid-architecture-service:"));
  const junctionNodes = graph.nodes.filter(node => node.role?.startsWith("mermaid-architecture-junction:"));
  const positions = new Map<string, ShapeElement>(); const frames: ShapeElement[] = []; const cards: ShapeElement[] = [];
  const columns = Math.min(2, Math.max(1, groupNodes.length)); const frameWidth = 370; const frameGap = 44; const frameHeights = groupNodes.map(group => Math.max(168, 100 + Math.ceil(serviceNodes.filter(node => decodePart(node.role!.split(":")[2] ?? "") === group.id).length / 2) * 92));
  const totalWidth = columns * frameWidth + (columns - 1) * frameGap; const top = center.y - 170;
  groupNodes.forEach((group, index) => {
    const childNodes = serviceNodes.filter(node => decodePart(node.role!.split(":")[2] ?? "") === group.id);
    const row = Math.floor(index / columns); const column = index % columns; const x = center.x - totalWidth / 2 + column * (frameWidth + frameGap); const y = top + row * (Math.max(...frameHeights, 168) + 38);
    const frame = boxShape(group, x, y, frameWidth, frameHeights[index]);
    if (frame.type !== "line") { frame.fillColor = "#eef3f8"; frame.fillOpacity = 0.62; frame.label = { ...frame.label!, textAlign: "left", verticalAlign: "top", fontSize: 14, bold: true }; }
    frames.push(frame); positions.set(group.id, frame);
    childNodes.forEach((node, childIndex) => {
      const childX = x + 18 + (childIndex % 2) * 166; const childY = y + 48 + Math.floor(childIndex / 2) * 86;
      const card = boxShape(node, childX, childY, 150, 66); if (card.type !== "line") card.fillColor = "#ffffff";
      cards.push(card); positions.set(node.id, card);
    });
  });
  const ungrouped = serviceNodes.filter(node => !decodePart(node.role!.split(":")[2] ?? ""));
  ungrouped.forEach((node, index) => {
    const x = center.x + (index - (ungrouped.length - 1) / 2) * 180 - 75; const y = groupNodes.length ? top + Math.ceil(groupNodes.length / columns) * (Math.max(...frameHeights, 168) + 38) + 8 : center.y - 33;
    const card = boxShape(node, x, y, 150, 66); if (card.type !== "line") card.fillColor = "#ffffff";
    cards.push(card); positions.set(node.id, card);
  });
  junctionNodes.forEach((node, index) => {
    const x = center.x + ((index % 4) - 1.5) * 44; const y = center.y + 210 + Math.floor(index / 4) * 48;
    const junction = boxShape(node, x, y, 30, 30); positions.set(node.id, junction); cards.push(junction);
  });
  const links: ShapeElement[] = graph.edges.flatMap((edge, index) => {
    const from = positions.get(edge.from); const to = positions.get(edge.to); if (!from || !to) return [];
    const anchor = edge.fromAnchor ?? { x: from.x + from.w <= to.x ? 1 : 0, y: .5 };
    const endAnchor = edge.toAnchor ?? { x: from.x + from.w <= to.x ? 0 : 1, y: .5 };
    const start = { x: from.x + from.w * anchor.x, y: from.y + from.h * anchor.y }; const end = { x: to.x + to.w * endAnchor.x, y: to.y + to.h * endAnchor.y };
    return [{ type: "arrow", id: `mermaid-link:${index}`, componentRole: "mermaid-relation:architecture", x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color: "#71869b", thickness: 1.8, autoRoute: true, arrowRoute: "elbow", startHead: edge.direction === "backward" || edge.direction === "both" ? "solid" : "none", endHead: edge.direction === "forward" || edge.direction === "both" ? "solid" : "none", startBinding: { elementId: from.id!, anchor }, endBinding: { elementId: to.id!, anchor: endAnchor } } as ShapeElement];
  });
  const heading: Element[] = graph.title ? [{ type: "text", id: "mermaid-title", x: center.x - totalWidth / 2, y: top - 38, text: graph.title, color: "#34495e", fontSize: 18, bold: true, fontFamily: "sans", textAlign: "left", listType: "none" }] : [];
  return [...heading, ...frames, ...links, ...cards];
}

export function layoutExtendedMermaid(source: string, center: Point): { type: ExtendedMermaidType; elements: Element[] } {
  const type = detectExtendedMermaidType(source); if (!type) throw new Error("This source is not one of the supported extended Mermaid diagram types.");
  if (type === "treeview") return { type, elements: layoutMermaidTreeView(source, center) };
  if (type === "swimlane") return { type, elements: layoutMermaidSwimlane(source, center) };
  if (type === "cynefin") return { type, elements: layoutMermaidCynefin(source, center) };
  if (type === "wardley") return { type, elements: layoutMermaidWardley(source, center) };
  if (type === "eventmodeling") return { type, elements: layoutMermaidEventModeling(source, center) };
  if (type === "zenuml") return { type, elements: layoutMermaidZenUml(source, center) };
  const graph = parseGraph(source, type);
  const elements = type === "class" ? classLayout(graph, center) : type === "usecase" ? usecaseLayout(graph, center) : type === "ishikawa" ? ishikawaLayout(graph, center) : type === "pie" || type === "xychart" || type === "radar" ? [chartLayout(graph, center, type)] : type === "treemap" ? treemapLayout(graph, center) : type === "venn" ? vennLayout(graph, center) : type === "packet" ? packetLayout(graph, center) : type === "architecture" ? architectureLayout(graph, center) : type === "journey" || type === "gantt" || type === "timeline" ? timelineLayout(graph, center, type) : type === "quadrant" ? quadrantLayout(graph, center) : type === "kanban" ? kanbanLayout(graph, center) : type === "block" ? blockLayout(graph, center) : graphLayout(graph, center, type);
  return { type, elements };
}

function flatten(elements: Element[]): Element[] { return elements.flatMap(item => item.hidden ? [] : item.type === "group" ? flatten(item.elements) : [item]); }
function findChartGroup(elements: Element[]): GroupElement | undefined {
  for (const item of elements) {
    if (item.hidden || item.type !== "group") continue;
    if (item.id === "mermaid-chart:pie" || item.id === "mermaid-chart:xychart" || item.id === "mermaid-chart:radar") return item;
    const nested = findChartGroup(item.elements); if (nested) return nested;
  }
  return undefined;
}
function safeId(value: string, fallback: string) { const result = value.replace(/[^\w]/g, "_").replace(/^[^A-Za-z_]+/, ""); return result || fallback; }
function quote(value: string) { return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/[\r\n]+/g, " ")}"`; }
function decodePart(value: string) { try { return decodeURIComponent(value); } catch { return value; } }
function sourceRelation(item: ShapeElement) { return item.componentRole?.startsWith("mermaid-relation:") ? decodePart(item.componentRole.slice("mermaid-relation:".length)) : undefined; }

function collectUsecaseElements(elements: Element[]): Element[] {
  const result: Element[] = [];
  for (const item of elements) {
    if (item.hidden) continue;
    if (item.type === "group") {
      if (item.componentRole?.startsWith("mermaid-usecase-actor:") || item.componentRole?.startsWith("mermaid-usecase-ellipse:")) result.push(item);
      else result.push(...collectUsecaseElements(item.elements));
    } else if (item.componentRole?.startsWith("mermaid-usecase-")) result.push(item);
  }
  return result;
}

function exportEditableUsecase(elements: Element[], originalSource = ""): string {
  const items = collectUsecaseElements(elements);
  const nodes = items.filter(item => (item.type === "group" && (item.componentRole?.startsWith("mermaid-usecase-actor:") || item.componentRole?.startsWith("mermaid-usecase-ellipse:"))) || item.componentRole?.startsWith("mermaid-usecase-rectangle:") || item.componentRole === "mermaid-usecase-boundary");
  const boundaries = nodes.filter(item => item.componentRole === "mermaid-usecase-boundary");
  const semanticNodes = nodes.filter(item => item.componentRole !== "mermaid-usecase-boundary");
  const byElementId = new Map(semanticNodes.map(item => [item.id, item]));
  const idOf = (item: Element) => (item.id ?? "").replace(/^mermaid-node:/, "");
  const labelOf = (item: Element) => {
    if (item.type === "group") return item.libraryComponent?.label?.trim() || idOf(item);
    if ("label" in item && item.label && typeof item.label === "object") return item.label.text?.trim() || idOf(item);
    return idOf(item);
  };
  const boundaryFor = (item: Element) => decodePart(item.componentRole?.slice(item.componentRole.indexOf(":") + 1) ?? "");
  const quoteLabel = (label: string) => `"${label.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/[\r\n]/g, " ")}"`;
  const lines = ["usecase-beta"];
  const direction = /^\s*direction\s+(TD|TB|BT|LR|RL)\s*$/im.exec(originalSource)?.[1]?.toUpperCase();
  if (direction) lines.push(`direction ${direction}`);
  const title = flatten(elements).find((item): item is Extract<Element, { type: "text" }> => item.type === "text" && item.id === "mermaid-title");
  if (title?.text.trim()) lines.push(`title ${quoteLabel(title.text.trim())}`);
  const drawNode = (item: Element, indent: string) => {
    const id = idOf(item); const label = labelOf(item); const role = item.componentRole ?? "";
    if (role.startsWith("mermaid-usecase-actor:")) lines.push(`${indent}actor ${id}(${quoteLabel(label)})`);
    else if (role.startsWith("mermaid-usecase-rectangle:")) lines.push(`${indent}${id}[${quoteLabel(label)}]`);
    else if (role.startsWith("mermaid-usecase-ellipse:")) lines.push(`${indent}${id}(${quoteLabel(label)})`);
  };
  for (const boundary of boundaries) {
    const id = idOf(boundary); const label = labelOf(boundary);
    lines.push(`systemBoundary ${id}${label === id ? "" : `[${quoteLabel(label)}]`}`);
    for (const node of semanticNodes.filter(item => boundaryFor(item) === id)) drawNode(node, "  ");
    lines.push("end");
  }
  for (const node of semanticNodes.filter(item => !boundaryFor(item))) drawNode(node, "");
  for (const item of items) {
    if ((item.type !== "line" && item.type !== "arrow") || !item.startBinding?.elementId || !item.endBinding?.elementId) continue;
    const from = byElementId.get(item.startBinding.elementId); const to = byElementId.get(item.endBinding.elementId); if (!from || !to) continue;
    let metadata: { operator?: string; label?: string } = {};
    if (item.componentRole?.startsWith("mermaid-usecase-edge:")) {
      try { metadata = JSON.parse(decodePart(item.componentRole.slice("mermaid-usecase-edge:".length))) as { operator?: string; label?: string }; } catch { /* Use the visible line style and heads below. */ }
    }
    const operator = metadata.operator ?? (item.endHead === "hollow" ? "--|>" : item.startHead === "hollow" ? "<|--" : item.endHead === "solid" ? "-->" : item.startHead === "solid" ? "<--" : "--");
    const visibleLabel = item.label?.text?.trim() ?? metadata.label ?? "";
    if (operator === "include" || operator === "extend") lines.push(`${idOf(from)} ..> : ${operator} ${idOf(to)}`);
    else if (visibleLabel) lines.push(`${idOf(from)} -- ${quoteLabel(visibleLabel)} --> ${idOf(to)}`);
    else lines.push(`${idOf(from)} ${operator} ${idOf(to)}`);
  }
  return lines.join("\n") + "\n";
}

function collectUmlClassGroups(elements: Element[]): GroupElement[] {
  const result: GroupElement[] = [];
  for (const item of elements) if (item.type === "group") {
    if (item.libraryComponent?.kind === "uml-class" && item.componentRole?.startsWith("uml-class-node:")) result.push(item);
    else result.push(...collectUmlClassGroups(item.elements));
  }
  return result;
}

function exportEditableClassDiagram(elements: Element[]): string | undefined {
  const classes = collectUmlClassGroups(elements);
  if (!classes.length) return undefined;
  const items = flatten(elements); const byElementId = new Map(classes.map(item => [item.id, item]));
  const idFor = (group: GroupElement) => decodePart((group.componentRole ?? "").slice("uml-class-node:".length));
  const lines = ["classDiagram"];
  const title = items.find((item): item is Extract<Element, { type: "text" }> => item.type === "text" && item.id === "mermaid-title");
  if (title?.text.trim()) lines.push(`  title ${quote(title.text.trim())}`);
  for (const group of classes) {
    const id = idFor(group); const label = group.libraryComponent?.label?.trim() || id;
    const fields = group.libraryComponent?.componentFields ?? [];
    const members = [...(fields.find(field => field.key === "attributes")?.value ?? "").split(/\r?\n/), ...(fields.find(field => field.key === "methods")?.value ?? "").split(/\r?\n/)].map(value => value.trim()).filter(Boolean);
    lines.push(`  class ${label !== id ? `${quote(label)} as ${id}` : id} {`, ...members.map(member => `    ${member}`), "  }");
  }
  for (const item of items) {
    if ((item.type !== "line" && item.type !== "arrow") || !item.startBinding?.elementId || !item.endBinding?.elementId) continue;
    const from = byElementId.get(item.startBinding.elementId); const to = byElementId.get(item.endBinding.elementId);
    if (!from || !to) continue;
    const relationMetadata = item.componentRole?.startsWith("uml-class-relation:") ? (() => { try { return JSON.parse(decodePart(item.componentRole.slice("uml-class-relation:".length))) as { operator?: string; fromCardinality?: string; toCardinality?: string; label?: string }; } catch { return { operator: decodePart(item.componentRole.slice("uml-class-relation:".length)) }; } })() : undefined;
    const raw = relationMetadata?.operator;
    const fallback = item.startHead === "hollow" ? item.lineStyle === "dashed" ? "<..|" : "<|--"
      : item.startHead === "diamond" ? "*--" : item.startHead === "open-diamond" ? "o--"
        : item.endHead === "hollow" ? item.lineStyle === "dashed" ? "..|>" : "--|>"
          : item.endHead === "diamond" ? "--*" : item.endHead === "open-diamond" ? "--o"
            : item.startHead !== "none" && item.endHead !== "none" ? "<-->"
              : item.endHead === "none" ? item.lineStyle === "dashed" ? ".." : "--"
                : item.lineStyle === "dashed" ? "..>" : "-->";
    const operator = raw && /^(?:<\|--|--\|>|<\.\.\||\.\.\|>|<\.\.>|\.\.>|\*--|--\*|o--|--o|--|\.\.|-->|<--|<-->)$/.test(raw) ? raw : fallback;
    const visibleLabel = item.label?.text.trim() ?? "";
    const originalVisibleLabel = [relationMetadata?.fromCardinality, relationMetadata?.toCardinality, relationMetadata?.label].filter(Boolean).join(" · ");
    const label = visibleLabel === originalVisibleLabel ? relationMetadata?.label ?? "" : visibleLabel;
    lines.push(`  ${idFor(from)} ${relationMetadata?.fromCardinality ? `${quote(relationMetadata.fromCardinality)} ` : ""}${operator}${relationMetadata?.toCardinality ? ` ${quote(relationMetadata.toCardinality)}` : ""} ${idFor(to)}${label ? ` : ${label}` : ""}`);
  }
  return lines.join("\n") + "\n";
}

/** Emit edits from generated native shapes back into the original Mermaid family. */
export function exportExtendedMermaid(type: ExtendedMermaidType, elements: Element[], originalSource = ""): string {
  if (type === "treeview") return exportMermaidTreeView(elements, originalSource);
  if (type === "swimlane") return exportMermaidSwimlane(elements, originalSource);
  if (type === "cynefin") return exportMermaidCynefin(elements, originalSource);
  if (type === "wardley") return exportMermaidWardley(elements, originalSource);
  if (type === "eventmodeling") return exportMermaidEventModeling(elements);
  if (type === "zenuml") return exportMermaidZenUml(elements, originalSource);
  if (type === "usecase") return exportEditableUsecase(elements, originalSource);
  if (type === "class") {
    const editable = exportEditableClassDiagram(elements);
    if (editable) return editable;
  }
  const chartGroup = findChartGroup(elements); const items = flatten(elements); const nodes = items.filter((item): item is ShapeElement => ["rectangle", "circle", "diamond", "triangle", "flowchart"].includes(item.type) && item.id?.startsWith("mermaid-node:") === true);
  if (type === "pie" || type === "xychart" || type === "radar") {
    const data = chartGroup?.libraryComponent?.chartData;
    if (!data || !data.labels.length || !data.values.length) throw new Error(`This generated Mermaid ${type} chart has no editable data to export.`);
    if (type === "pie") {
      const showValues = !!data.options?.showValues; const lines = [`pie${showValues ? " showData" : ""}${data.title ? ` title ${quote(data.title)}` : ""}`];
      data.labels.forEach((label, index) => lines.push(`  ${quote(label)} : ${Number(data.values[index] ?? 0)}`));
      return lines.join("\n") + "\n";
    }
    if (type === "radar") {
      if (data.labels.length < 3) throw new Error("Mermaid radar export needs at least three axis labels.");
      const axisIds = data.axisIds?.length === data.labels.length ? data.axisIds : data.labels.map((label, index) => safeId(label, `axis_${index + 1}`));
      const lines = ["radar-beta"];
      if (data.title) lines.push(`  title ${quote(data.title)}`);
      for (const [index, label] of data.labels.entries()) lines.push(`  axis ${axisIds[index]}[${quote(label)}]`);
      const series = data.series?.length ? data.series : [{ name: "Series 1", values: data.values, chartType: "line" as const }];
      for (const [index, item] of series.entries()) lines.push(`  curve curve_${index + 1}[${quote(item.name)}]{${item.values.join(", ")}}`);
      if (Number.isFinite(data.options?.maxValue)) lines.push(`  max ${data.options!.maxValue}`);
      if (Number.isFinite(data.options?.minValue)) lines.push(`  min ${data.options!.minValue}`);
      if (Number.isFinite(data.options?.radarTicks)) lines.push(`  ticks ${data.options!.radarTicks}`);
      lines.push(`  graticule ${data.options?.radarGraticule ?? "circle"}`, `  showLegend ${data.options?.legend !== "hidden"}`);
      return lines.join("\n") + "\n";
    }
    const lines = ["xychart-beta"];
    if (data.title) lines.push(`  title ${quote(data.title)}`);
    lines.push(`  x-axis${data.xAxisLabel ? ` ${quote(data.xAxisLabel)}` : ""} [${data.labels.map(quote).join(", ")}]`);
    const minimum = data.options?.minValue; const maximum = data.options?.maxValue;
    const bounds = Number.isFinite(minimum) && Number.isFinite(maximum) ? ` ${minimum} --> ${maximum}` : "";
    lines.push(`  y-axis${data.yAxisLabel ? ` ${quote(data.yAxisLabel)}` : ""}${bounds}`);
    const series = data.series?.length ? data.series : [{ name: "Series 1", values: data.values, chartType: "line" as const }];
    for (const item of series) lines.push(`  ${item.chartType === "bar" ? "bar" : "line"} [${item.values.join(", ")}]`);
    return lines.join("\n") + "\n";
  }
  const byId = new Map(nodes.map((node, index) => [node.id!, { node, id: safeId(node.id!.slice("mermaid-node:".length), `node_${index + 1}`) }]));
  if (!nodes.length) throw new Error("This generated Mermaid diagram has no editable nodes to export.");
  const nodeForElement = new Map(nodes.map(node => [node.id!, node]));
  const relationships = items.flatMap(item => {
    if ((item.type !== "line" && item.type !== "arrow") || !item.startBinding?.elementId || !item.endBinding?.elementId) return [];
    const from = nodeForElement.get(item.startBinding.elementId); const to = nodeForElement.get(item.endBinding.elementId);
    return from && to ? [{ item, from, to }] : [];
  });
  if (type === "ishikawa") {
    const problem = nodes.find(node => node.componentRole === "mermaid-ishikawa-problem");
    if (!problem) throw new Error("This generated Mermaid Ishikawa diagram has no problem node to export.");
    const causes = nodes.filter(node => node.componentRole?.startsWith("mermaid-ishikawa-cause:"));
    const children = new Map<string, ShapeElement[]>();
    for (const node of causes) {
      const parent = decodePart(node.componentRole!.slice("mermaid-ishikawa-cause:".length));
      children.set(parent, [...(children.get(parent) ?? []), node]);
    }
    const labelOf = (node: ShapeElement) => (node.label?.text ?? node.id ?? "Cause").replace(/\s*\n\s*/g, " ").trim();
    const keyOf = (node: ShapeElement) => (node.id ?? "").replace(/^mermaid-node:/, "");
    const rootKey = keyOf(problem); const lines = ["ishikawa-beta", labelOf(problem)]; const visited = new Set<string>([rootKey]);
    const visit = (parentId: string, depth: number) => {
      for (const node of children.get(parentId) ?? []) {
        const key = keyOf(node);
        if (!key || visited.has(key)) continue;
        visited.add(key); lines.push(`${" ".repeat(depth * 4)}${labelOf(node)}`); visit(key, depth + 1);
      }
    };
    visit(rootKey, 1);
    for (const node of causes) { const key = keyOf(node); if (key && !visited.has(key)) { lines.push(`    ${labelOf(node)}`); visited.add(key); visit(key, 2); } }
    if (!causes.length) throw new Error("This Mermaid Ishikawa diagram has no editable causes to export.");
    return lines.join("\n") + "\n";
  }
  if (type === "venn") {
    const sets = nodes.filter(node => node.componentRole?.startsWith("mermaid-venn-set:"));
    const unions = nodes.filter(node => node.componentRole?.startsWith("mermaid-venn-union:"));
    const textNodes = nodes.filter(node => node.componentRole?.startsWith("mermaid-venn-text:"));
    const title = items.find((item): item is Extract<Element, { type: "text" }> => item.type === "text" && item.id === "mermaid-title");
    const lines = ["venn-beta"];
    if (title?.text) lines.push(`  title ${quote(title.text)}`);
    const childrenOf = (owner: ShapeElement) => textNodes.filter(node => {
      const role = /^mermaid-venn-text:(set|union):([^:]*):/.exec(node.componentRole ?? "");
      return decodePart(role?.[2] ?? "") === owner.id?.slice("mermaid-node:".length);
    });
    for (const node of sets) {
      const match = /^mermaid-venn-set:([^:]*):(.*)$/.exec(node.componentRole ?? "");
      if (!match) continue;
      const sourceId = decodePart(match[1]); const label = (node.label?.text ?? sourceId).trim(); const size = match[2] ? `:${match[2]}` : "";
      lines.push(`  set ${quote(sourceId)}[${quote(label)}]${size}`);
      for (const child of childrenOf(node)) {
        const role = /^mermaid-venn-text:set:[^:]*:([^:]*)$/.exec(child.componentRole ?? "");
        if (role) lines.push(`    text ${quote(decodePart(role[1]))}[${quote((child.label?.text ?? "").trim())}]`);
      }
    }
    for (const node of unions) {
      const match = /^mermaid-venn-union:([^:]*):(.*)$/.exec(node.componentRole ?? "");
      if (!match) continue;
      let sourceIds: string[];
      try { sourceIds = JSON.parse(decodePart(match[1])) as string[]; } catch { throw new Error("This Mermaid Venn union no longer has valid set references."); }
      const size = match[2] ? `:${match[2]}` : "";
      lines.push(`  union ${sourceIds.map(quote).join(", ")}[${quote((node.label?.text ?? "").trim())}]${size}`);
      for (const child of childrenOf(node)) {
        const role = /^mermaid-venn-text:union:[^:]*:([^:]*)$/.exec(child.componentRole ?? "");
        if (role) lines.push(`    text ${quote(decodePart(role[1]))}[${quote((child.label?.text ?? "").trim())}]`);
      }
    }
    return lines.join("\n") + "\n";
  }
  if (type === "packet") {
    const lines = ["packet-beta"]; const title = items.find((item): item is Extract<Element, { type: "text" }> => item.type === "text" && item.id === "mermaid-title");
    if (title) lines.push(`  title ${title.text}`);
    for (const node of nodes) {
      const match = /^mermaid-packet:(\d+):(\d+):(\d+)$/.exec(node.componentRole ?? ""); if (!match) continue;
      const start = Number(match[2]); const end = Number(match[3]); const prefix = end === start ? String(start) : `${start}-${end}`;
      lines.push(`  ${prefix}: ${quote(node.label?.text ?? "")}`);
    }
    return lines.join("\n") + "\n";
  }
  if (type === "treemap") {
    const lines = ["treemap-beta"]; const byInternalId = new Map(nodes.map(node => [node.id!.slice("mermaid-node:".length), node])); const depths = new Map<string, number>();
    const depthOf = (node: ShapeElement, path = new Set<string>()): number => {
      if (!node.id) return 0; const key = node.id.slice("mermaid-node:".length); const cached = depths.get(key); if (cached !== undefined) return cached;
      if (path.has(key)) return 0; const next = new Set(path); next.add(key); const role = /^mermaid-treemap:([^:]*):(.*)$/.exec(node.componentRole ?? ""); const parent = role ? decodePart(role[1]) : "";
      const parentNode = byInternalId.get(parent); const depth = parentNode ? depthOf(parentNode, next) + 1 : 0; depths.set(key, depth); return depth;
    };
    for (const node of nodes) {
      const parts = (node.label?.text ?? "").split("\n"); const role = /^mermaid-treemap:([^:]*):(.*)$/.exec(node.componentRole ?? ""); let label = parts[0] ?? ""; let value = role?.[2] ? Number(role[2]) : undefined;
      const displayedValue = parts[parts.length - 1] ?? "";
      if (value !== undefined && parts.length > 1 && /^-?\d+(?:\.\d+)?$/.test(displayedValue)) { value = Number(displayedValue); label = parts.slice(0, -1).join(" "); }
      lines.push(`${"  ".repeat(depthOf(node) + 1)}${quote(label)}${value === undefined ? "" : `: ${value}`}`);
    }
    return lines.join("\n") + "\n";
  }
  if (type === "architecture") {
    const lines = ["architecture-beta"];
    const iconFor = (node: ShapeElement) => {
      const role = node.componentRole ?? "";
      if (role.startsWith("mermaid-architecture-group:")) return decodePart(role.slice("mermaid-architecture-group:".length));
      const parts = role.split(":"); return parts.length > 1 ? decodePart(parts[1]) : "";
    };
    for (const node of nodes.filter(node => node.componentRole?.startsWith("mermaid-architecture-group:"))) {
      const id = safeId(node.id!.slice("mermaid-node:".length), "group"); const icon = iconFor(node); const label = node.label?.text ?? id;
      lines.push(`  group ${id}${icon ? `(${icon})` : ""}[${quote(label)}]`);
    }
    for (const node of nodes.filter(node => node.componentRole?.startsWith("mermaid-architecture-service:"))) {
      const parts = node.componentRole!.split(":"); const icon = decodePart(parts[1] ?? ""); const group = decodePart(parts[2] ?? ""); const id = safeId(node.id!.slice("mermaid-node:".length), "service");
      lines.push(`  service ${id}${icon ? `(${icon})` : ""}[${quote(node.label?.text ?? id)}]${group ? ` in ${safeId(group, "group")}` : ""}`);
    }
    for (const node of nodes.filter(node => node.componentRole?.startsWith("mermaid-architecture-junction:"))) lines.push(`  junction ${safeId(node.id!.slice("mermaid-node:".length), "junction")}`);
    const side = (anchor: Point | undefined) => !anchor ? "R" : anchor.x <= 0 ? "L" : anchor.x >= 1 ? "R" : anchor.y <= 0 ? "T" : "B";
    for (const { from, to, item } of relationships) {
      const direction = item.startHead === "solid" && item.endHead === "solid" ? "<-->" : item.startHead === "solid" ? "<--" : item.endHead === "solid" ? "-->" : "--";
      lines.push(`  ${safeId(from.id!.slice("mermaid-node:".length), "from")}:${side(item.startBinding?.anchor)} ${direction} ${side(item.endBinding?.anchor)}:${safeId(to.id!.slice("mermaid-node:".length), "to")}`);
    }
    return lines.join("\n") + "\n";
  }
  if (type === "mindmap") {
    const incoming = new Set(relationships.map(edge => edge.to.id)); const outgoing = new Map<string, ShapeElement[]>();
    for (const edge of relationships) outgoing.set(edge.from.id!, [...(outgoing.get(edge.from.id!) ?? []), edge.to]);
    const lines = ["mindmap"]; const visited = new Set<string>();
    const visit = (node: ShapeElement, depth: number) => {
      if (!node.id || visited.has(node.id)) return; visited.add(node.id);
      const key = safeId(node.id.slice("mermaid-node:".length), `mindmap_${visited.size}`); const label = (node.label?.text ?? key).split("\n")[0];
      const marker = depth === 0 ? `((${quote(label)}))` : `[${quote(label)}]`;
      lines.push(`${"  ".repeat(depth + 1)}${key}${marker}`);
      for (const child of outgoing.get(node.id) ?? []) visit(child, depth + 1);
    };
    for (const node of nodes) if (!incoming.has(node.id!)) visit(node, 0);
    for (const node of nodes) visit(node, 0);
    return lines.join("\n") + "\n";
  }
  if (type === "timeline") {
    const lines = ["timeline"]; const title = items.find((item): item is Extract<Element, { type: "text" }> => item.type === "text" && item.id === "mermaid-title");
    if (title) lines.push(`  title ${title.text}`);
    let active = "";
    for (const node of nodes) {
      const match = /^mermaid-timeline:([^:]*):(.*)$/.exec(node.componentRole ?? ""); const date = match ? decodePart(match[1]) : ""; const section = match ? decodePart(match[2]) : "Timeline";
      if (section !== active) { active = section; lines.push(`  section ${section}`); }
      lines.push(`  ${date || ""} : ${(node.label?.text ?? "").split("\n")[0]}`);
    }
    return lines.join("\n") + "\n";
  }
  if (type === "git") {
    const lines = ["gitGraph"]; let activeBranch = "main"; const declared = new Set(["main"]);
    for (const node of nodes) {
      const match = /^mermaid-git:([^:]*):([\s\S]*)$/.exec(node.componentRole ?? ""); const branch = match ? decodePart(match[1]) : "main"; const label = match ? decodePart(match[2]) : node.label?.text ?? "Commit";
      if (branch !== activeBranch) {
        if (!declared.has(branch)) { lines.push(`  branch ${safeId(branch, "branch")}`); declared.add(branch); }
        lines.push(`  checkout ${safeId(branch, "branch")}`); activeBranch = branch;
      }
      const nodeEdges = relationships.filter(edge => edge.to.id === node.id);
      const mergeParent = nodeEdges.find(edge => edge.item.label?.text === "merge" && edge.from.componentRole?.startsWith("mermaid-git:") && decodePart(edge.from.componentRole.slice("mermaid-git:".length).split(":")[0]) !== branch);
      if (mergeParent) {
        const parentBranch = decodePart(mergeParent.from.componentRole!.slice("mermaid-git:".length).split(":")[0]);
        lines.push(`  merge ${safeId(parentBranch, "branch")}`);
      } else lines.push(`  commit id: ${quote(label)}`);
    }
    return lines.join("\n") + "\n";
  }
  if (type === "requirement") {
    const lines = ["requirementDiagram"];
    for (const node of nodes) {
      const kind = node.componentRole?.replace(/^mermaid-requirement:/, "") ?? "requirement"; const label = (node.label?.text ?? "").split("\n");
      const id = safeId(label[1] ?? node.id?.slice("mermaid-node:".length) ?? "requirement", "requirement");
      lines.push(`  ${kind} ${id} {`);
      for (const field of label.slice(2)) lines.push(`    ${field}`);
      lines.push("  }");
    }
    for (const { from, to, item } of relationships) {
      const relation = item.label?.text ?? (item.componentRole?.startsWith("mermaid-relation:") ? decodePart(item.componentRole.slice("mermaid-relation:".length)) : "traces");
      lines.push(`  ${safeId(from.id!.slice("mermaid-node:".length), "from")} - ${relation} -> ${safeId(to.id!.slice("mermaid-node:".length), "to")}`);
    }
    return lines.join("\n") + "\n";
  }
  if (type === "quadrant") {
    const byTextId = (id: string) => (items.find((item): item is Extract<Element, { type: "text" }> => item.type === "text" && item.id === id)?.text ?? "").trim();
    const lines = ["quadrantChart"]; const title = byTextId("mermaid-title");
    if (title) lines.push(`  title ${title}`);
    lines.push(`  x-axis ${byTextId("mermaid-quadrant-x-low") || "Low"} --> ${byTextId("mermaid-quadrant-x-high") || "High"}`, `  y-axis ${byTextId("mermaid-quadrant-y-low") || "Low"} --> ${byTextId("mermaid-quadrant-y-high") || "High"}`);
    for (let index = 1; index <= 4; index++) { const label = byTextId(`mermaid-quadrant-label-${index}`); if (label) lines.push(`  quadrant-${index} ${label}`); }
    const verticalAxis = items.find((item): item is ShapeElement => item.type === "line" && item.id === "mermaid-quadrant-x-axis"); const horizontalAxis = items.find((item): item is ShapeElement => item.type === "line" && item.id === "mermaid-quadrant-y-axis");
    const plotLeft = horizontalAxis?.x ?? Math.min(...nodes.map(item => item.x)); const plotWidth = horizontalAxis?.w ?? 720; const plotTop = verticalAxis?.y ?? Math.min(...nodes.map(item => item.y)); const plotHeight = verticalAxis?.h ?? 440;
    for (const node of nodes) {
      const role = /^mermaid-quadrant:([\d.]+):([\d.]+)$/.exec(node.componentRole ?? "");
      const x = plotWidth ? Math.max(0, Math.min(1, (node.x + node.w / 2 - plotLeft) / plotWidth)) : Number(role?.[1] ?? .5); const y = plotHeight ? Math.max(0, Math.min(1, 1 - (node.y + node.h / 2 - plotTop) / plotHeight)) : Number(role?.[2] ?? .5);
      lines.push(`  point ${quote((node.label?.text ?? "").split("\n")[0])}: [${x.toFixed(3)}, ${y.toFixed(3)}]`);
    }
    return lines.join("\n") + "\n";
  }
  if (type === "kanban") {
    const lines = ["kanban"]; const title = items.find((item): item is Extract<Element, { type: "text" }> => item.type === "text" && item.id === "mermaid-title");
    if (title) lines.push(`  title ${title.text}`);
    const columns = nodes.filter(node => node.componentRole === "mermaid-kanban-column");
    for (const column of columns) {
      const columnId = safeId(column.id!.slice("mermaid-node:".length), "column"); lines.push(`  ${columnId}[${quote((column.label?.text ?? columnId).split("\n")[0])}]`);
      for (const card of nodes.filter(node => node.componentRole === `mermaid-kanban-card:${column.id!.slice("mermaid-node:".length)}` || node.componentRole === `mermaid-kanban-card:${safeId(column.id!.slice("mermaid-node:".length), "column")}`)) {
        lines.push(`    ${safeId(card.id!.slice("mermaid-node:".length), "task")}[${quote((card.label?.text ?? "").split("\n")[0])}]`);
      }
    }
    return lines.join("\n") + "\n";
  }
  if (type === "block") {
    const lines = ["block-beta"]; const title = items.find((item): item is Extract<Element, { type: "text" }> => item.type === "text" && item.id === "mermaid-title");
    if (title) lines.push("  title " + title.text);
    const positions = nodes.map(node => /^mermaid-block:(\d+):(\d+):(\d+)$/.exec(node.componentRole ?? ""));
    const columns = Math.max(1, ...positions.map(match => Number(match?.[2] ?? 0) + Number(match?.[3] ?? 1)));
    lines.push("  columns " + columns);
    const rows = new Map<number, { column: number; text: string }[]>();
    nodes.forEach((node, index) => {
      const match = positions[index]; const row = Number(match?.[1] ?? 0); const column = Number(match?.[2] ?? 0); const span = Number(match?.[3] ?? 1); const id = safeId(node.id!.slice("mermaid-node:".length), "block_" + (index + 1)); const label = (node.label?.text ?? "").split("\n")[0];
      const value = label && label !== id ? id + "[" + quote(label) + "]" : id; rows.set(row, [...(rows.get(row) ?? []), { column, text: span > 1 ? value + ":" + span : value }]);
    });
    for (const row of [...rows.keys()].sort((a, b) => a - b)) lines.push("  " + rows.get(row)!.sort((a, b) => a.column - b.column).map(item => item.text).join(" "));
    return lines.join("\n") + "\n";
  }
  if (type === "sankey") {
    const lines = ["sankey-beta"];
    for (const { from, to, item } of relationships) {
      const value = Number(item.label?.text ?? 0);
      lines.push(`  ${quote((from.label?.text ?? "").split("\n")[0])}, ${quote((to.label?.text ?? "").split("\n")[0])}, ${Number.isFinite(value) ? value : 0}`);
    }
    return lines.join("\n") + "\n";
  }
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
