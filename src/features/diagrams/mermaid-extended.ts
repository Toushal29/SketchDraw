import type { Element, Point, ShapeElement } from "../../model";

export type ExtendedMermaidType = "class" | "er" | "state" | "journey" | "gantt" | "c4" | "mindmap" | "timeline" | "git" | "requirement" | "quadrant" | "kanban" | "sankey";
type Node = { id: string; label: string; shape: "rectangle" | "rounded" | "diamond" | "circle"; role?: string };
type Edge = { from: string; to: string; label: string; relation?: string };
type Graph = { nodes: Node[]; edges: Edge[]; title?: string; sections?: string[]; metadata?: Record<string, string> };

export function detectExtendedMermaidType(source: string): ExtendedMermaidType | undefined {
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
  let activeClass = ""; let title = ""; let section = ""; const sections: string[] = []; const metadata: Record<string, string> = {};
  let currentBranch = "main"; let commitSequence = 0; let previousTimelineEvent = "";
  const hierarchy: { indent: number; id: string }[] = []; const branchHeads = new Map<string, string>(); const kanbanColumns: string[] = [];
  const get = (id: string, label = id, shape: Node["shape"] = "rectangle", role?: string) => {
    const key = id.replace(/[^\w.-]/g, "_").slice(0, 80) || `node_${nodes.size + 1}`;
    const previous = nodes.get(key);
    if (!previous || label !== key) nodes.set(key, { id: key, label: label || key, shape, ...(role ? { role } : previous?.role ? { role: previous.role } : {}) });
    return key;
  };
  for (const raw of source.replace(/\r/g, "").split("\n")) {
    const uncommented = raw.replace(/%%.*$/, ""); const indent = uncommented.match(/^\s*/)?.[0].length ?? 0;
    const line = uncommented.trim(); if (!line) continue;
    if (/^(?:classDiagram|erDiagram|stateDiagram(?:-v2)?|C4(?:Context|Container|Component|Dynamic|Deployment)|mindmap|timeline|gitGraph|requirementDiagram|quadrantChart|kanban|sankey-beta)\b/i.test(line)) continue;
    if (/^direction\s+/i.test(line) || /^layout\s+/i.test(line) || /^dateFormat\s+/i.test(line) || /^axisFormat\s+/i.test(line) || /^tickInterval\s+/i.test(line) || /^excludes\s+/i.test(line) || /^includes\s+/i.test(line) || /^todayMarker\s+/i.test(line)) continue;
    if (/^title\s+/i.test(line)) { title = line.replace(/^title\s+/i, "").replace(/^(["'])(.*)\1$/, "$2"); continue; }
    const sectionMatch = /^section\s+(.+)$/i.exec(line); if (sectionMatch) { section = sectionMatch[1].trim(); sections.push(section); activeClass = ""; if (type === "timeline") previousTimelineEvent = ""; continue; }
    if (line === "}" || /^end\s*$/i.test(line)) { activeClass = ""; continue; }

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
  return { nodes: [...nodes.values()], edges, ...(title ? { title } : {}), ...(sections.length ? { sections } : {}), ...(Object.keys(metadata).length ? { metadata } : {}) };
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

export function layoutExtendedMermaid(source: string, center: Point): { type: ExtendedMermaidType; elements: Element[] } {
  const type = detectExtendedMermaidType(source); if (!type) throw new Error("This source is not one of the supported extended Mermaid diagram types.");
  const graph = parseGraph(source, type);
  const elements = type === "journey" || type === "gantt" || type === "timeline" ? timelineLayout(graph, center, type) : type === "quadrant" ? quadrantLayout(graph, center) : type === "kanban" ? kanbanLayout(graph, center) : graphLayout(graph, center, type);
  return { type, elements };
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
  const nodeForElement = new Map(nodes.map(node => [node.id!, node]));
  const relationships = items.flatMap(item => {
    if ((item.type !== "line" && item.type !== "arrow") || !item.startBinding?.elementId || !item.endBinding?.elementId) return [];
    const from = nodeForElement.get(item.startBinding.elementId); const to = nodeForElement.get(item.endBinding.elementId);
    return from && to ? [{ item, from, to }] : [];
  });
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
