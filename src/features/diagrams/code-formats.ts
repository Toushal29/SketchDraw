import type { Element, GroupElement, SchemaTableElement, ShapeElement } from "../../model";
import { detectExtendedMermaidType, exportExtendedMermaid, layoutEditableClassDiagram } from "./mermaid-extended";
import { exportBpmnXml } from "./bpmn-xml";
import { exportStructurizrWorkspaceJson } from "./structurizr-workspace";
import { detectPlantUmlFamily, exportPlantUmlAdvanced, plantUmlAdvancedToDiagram } from "./plantuml-diagrams";

export type DiagramCodeFormat = "mmd" | "dot" | "d2" | "csv" | "sql" | "json" | "puml" | "bpmn" | "structurizr-json";
export type SqlDialect = "postgresql" | "mysql" | "mariadb" | "sqlite" | "sqlserver";
export type DiagramCodeExportOptions = { sqlDialect?: SqlDialect; bpmnContextElements?: Element[] };

const flatten = (elements: Element[]): Element[] => elements.flatMap(element => element.hidden ? [] : element.type === "group" ? [...(["uml-lifeline", "uml-class"].includes(element.libraryComponent?.kind ?? "") ? [element] : []), ...flatten(element.elements)] : [element]);
const safeId = (value: string, fallback: string) => {
  const id = value.replace(/[^A-Za-z0-9_]/g, "_").replace(/^[^A-Za-z_]+/, "");
  return id || fallback;
};
const escapeMermaid = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\r?\n/g, "<br/>");
const escapeQuoted = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\r?\n/g, "\\n");
const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const isConnector = (item: Element): item is ShapeElement => item.type === "line" || item.type === "arrow";
type DiagramShapeNode = ShapeElement & { type: "rectangle" | "circle" | "diamond" | "triangle" | "flowchart" };
type DiagramNodeElement = SchemaTableElement | Extract<Element, { type: "text" }> | DiagramShapeNode | Extract<Element, { type: "group" }>;
const isNode = (item: Element): item is DiagramNodeElement => item.type === "schemaTable" || item.type === "text" || item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "triangle" || item.type === "flowchart" || item.type === "group" && ["uml-lifeline", "uml-class"].includes(item.libraryComponent?.kind ?? "");
const nodeLabel = (item: DiagramNodeElement) => item.type === "schemaTable" ? `${item.name}\n${item.columns.map(field => `${field.name}: ${field.dataType}${field.primaryKey ? " (PK)" : ""}`).join("\n")}` : item.type === "text" ? item.text : item.type === "group" ? item.libraryComponent?.kind === "uml-class" ? [item.libraryComponent.label ?? "Class", ...(item.libraryComponent.componentFields ?? []).filter(field => ["attributes", "methods"].includes(field.key)).flatMap(field => field.value.split(/\r?\n/).filter(Boolean))].join("\n") : item.libraryComponent?.label ?? "Participant" : item.label?.text ?? item.flowchartShape ?? item.type;
type CodeNode = { item: DiagramNodeElement; id: string; label: string };
type CodeEdge = { item: ShapeElement; from: CodeNode; to: CodeNode; label: string };

function diagramParts(elements: Element[]) {
  const visible = flatten(elements);
  const used = new Set<string>();
  const nodes: CodeNode[] = visible.filter((item): item is DiagramNodeElement => isNode(item) && item.id?.startsWith("mermaid-subgraph:") !== true).map((item, index) => {
    const sourceId = item.id?.startsWith("mermaid-node:") ? item.id.slice("mermaid-node:".length) : item.id;
    const base = safeId(sourceId ?? "", `node_${index + 1}`);
    let id = base; let suffix = 2;
    while (used.has(id)) id = `${base}_${suffix++}`;
    used.add(id);
    return { item, id, label: nodeLabel(item) || `Node ${index + 1}` };
  });
  const findEndpoint = (connector: ShapeElement, end: "start" | "end"): CodeNode | undefined => {
    const binding = end === "start" ? connector.startBinding : connector.endBinding;
    if (binding) {
      const match = visible.find(item => item.id === binding.elementId);
      const found = nodes.find(node => node.item === match);
      if (found) return found;
    }
    if (!nodes.length) return undefined;
    const x = end === "start" ? connector.x : connector.x + connector.w;
    const y = end === "start" ? connector.y : connector.y + connector.h;
    return nodes.reduce((best, node) => {
      const item = node.item;
      const cx = item.type === "text" ? item.x : item.type === "group" ? item.componentBounds!.x + item.componentBounds!.w / 2 : item.x + item.w / 2;
      const cy = item.type === "text" ? item.y : item.type === "group" ? item.componentBounds!.y + item.componentBounds!.h / 2 : item.y + item.h / 2;
      const distance = (cx - x) ** 2 + (cy - y) ** 2;
      return distance < best.distance ? { node, distance } : best;
    }, { node: nodes[0], distance: Infinity }).node;
  };
  const edges: CodeEdge[] = visible.filter(isConnector).flatMap(item => {
    const from = findEndpoint(item, "start");
    if (!from) return [];
    if (item.type === "arrow" && item.arrowRoute === "forked") {
      return [item.forkUpper, item.forkLower].flatMap(branch => {
        if (!branch) return [];
        const endpoint = { ...item, x: branch.end?.x ?? item.x + item.w, y: branch.end?.y ?? item.y + item.h, w: 0, h: 0, endBinding: branch.endBinding };
        const to = findEndpoint(endpoint, "end");
        return to ? [{ item, from, to, label: "" }] : [];
      });
    }
    const to = findEndpoint(item, "end");
    return to ? [{ item, from, to, label: item.label?.text ?? "" }] : [];
  });
  return { nodes, edges, tables: visible.filter((item): item is SchemaTableElement => item.type === "schemaTable") };
}

function exportMermaid(elements: Element[]) {
  if (elements.length === 1 && elements[0].type === "group" && elements[0].mermaid?.format === "plantuml" && elements[0].mermaid.diagramType === "class") {
    return exportExtendedMermaid("class", elements, elements[0].mermaid.source);
  }
  if (elements.length === 1 && elements[0].type === "group" && elements[0].mermaid?.format !== "plantuml") {
    const type: string | undefined = elements[0].mermaid?.diagramType ?? detectExtendedMermaidType(elements[0].mermaid?.source ?? "");
    if (type && type !== "flowchart" && type !== "sequence") return exportExtendedMermaid(type as NonNullable<ReturnType<typeof detectExtendedMermaidType>>, elements, elements[0].mermaid?.source ?? "");
  }
  if (elements.length === 1 && elements[0].type === "group" && elements[0].mermaid && /^\s*sequenceDiagram\b/im.test(elements[0].mermaid.source)) {
    const group = elements[0];
    const participants = group.elements.filter((item): item is Extract<Element, { type: "group" }> => item.type === "group" && item.libraryComponent?.kind === "uml-lifeline");
    const aliases = new Map(participants.map((item, index) => [item.id!, safeId(item.id ?? "", `participant_${index + 1}`)]));
    if (!participants.length) throw new Error("This sequence group has no editable lifelines to export.");
    const lines = ["sequenceDiagram", ...participants.map((item, index) => `  participant ${aliases.get(item.id!) || `participant_${index + 1}`} as "${escapeMermaid(item.libraryComponent?.label ?? "Participant")}"`)];
    for (const edge of group.elements.filter((item): item is ShapeElement => isConnector(item))) {
      const from = edge.startBinding?.elementId ? aliases.get(edge.startBinding.elementId) : undefined;
      const to = edge.endBinding?.elementId ? aliases.get(edge.endBinding.elementId) : undefined;
      if (!from || !to) continue;
      const operator = edge.lineStyle === "dashed" ? "-->>" : edge.endHead === "bar" ? "-x" : edge.endHead === "open" ? "-)" : "->>";
      lines.push(`  ${from}${operator}${to}: ${escapeMermaid(edge.label?.text ?? "Message")}`);
    }
    return lines.join("\n") + "\n";
  }
  const { nodes, edges } = diagramParts(elements);
  if (!nodes.length) throw new Error("Add at least one labeled shape or text item before exporting diagram code.");
  const definition = (node: CodeNode) => {
    const label = `"${escapeMermaid(node.label)}"`;
    if (node.item.type === "circle") return `${node.id}((${label}))`;
    if (node.item.type === "diamond") return `${node.id}{${label}}`;
    if (node.item.type === "rectangle" && node.item.edgeStyle === "pill") return `${node.id}([${label}])`;
    return `${node.id}[${label}]`;
  };
  const allVisible = flatten(elements);
  const frames = allVisible.filter((item): item is ShapeElement => item.type === "rectangle" && item.id?.startsWith("mermaid-subgraph:") === true);
  const memberFrame = (node: CodeNode) => {
    const center = node.item.type === "text" ? { x: node.item.x, y: node.item.y } : node.item.type === "group" ? { x: node.item.componentBounds!.x + node.item.componentBounds!.w / 2, y: node.item.componentBounds!.y + node.item.componentBounds!.h / 2 } : { x: node.item.x + node.item.w / 2, y: node.item.y + node.item.h / 2 };
    return frames.filter(frame => center.x >= frame.x && center.x <= frame.x + frame.w && center.y >= frame.y && center.y <= frame.y + frame.h).sort((a, b) => a.w * a.h - b.w * b.h)[0];
  };
  const lines = ["flowchart TD"];
  const definitions = (items: CodeNode[], indent: string) => items.map(node => `${indent}${definition(node)}`);
  lines.push(...definitions(nodes.filter(node => !memberFrame(node)), "  "));
  for (const frame of frames) {
    const members = nodes.filter(node => memberFrame(node) === frame);
    if (!members.length) continue;
    const id = safeId(frame.id ?? "subgraph", "subgraph");
    lines.push(`  subgraph ${id}["${escapeMermaid(frame.label?.text ?? "Group")}"]`, ...definitions(members, "    "), "  end");
  }
  for (const edge of edges) {
    const item = edge.item;
    const operator = item.lineStyle === "dotted" ? "-.->" : item.thickness >= 3 ? "==>" : item.startHead && item.startHead !== "none" ? "<-->" : item.type === "arrow" || (item.endHead && item.endHead !== "none") ? "-->" : "---";
    lines.push(`  ${edge.from.id} ${operator}${edge.label ? `|${escapeMermaid(edge.label)}|` : ""} ${edge.to.id}`);
  }
  for (const node of nodes) if (node.item.type !== "text" && node.item.type !== "schemaTable" && node.item.type !== "group") {
    const style = [`fill:${node.item.fillColor ?? "#ffffff"}`, `stroke:${node.item.color}`, `color:${node.item.label?.color ?? "#33495d"}`, `stroke-width:${node.item.thickness}px`];
    if (node.item.lineStyle === "dashed") style.push("stroke-dasharray:5 4");
    if (node.item.lineStyle === "dotted") style.push("stroke-dasharray:1 4");
    lines.push(`  style ${node.id} ${style.join(",")}`);
  }
  edges.forEach((edge, index) => { const item = edge.item; lines.push(`  linkStyle ${index} stroke:${item.color},stroke-width:${item.thickness}px${item.lineStyle === "dotted" ? ",stroke-dasharray:1 4" : item.lineStyle === "dashed" ? ",stroke-dasharray:5 4" : ""}`); });
  return lines.join("\n") + "\n";
}

function exportDotLegacy(elements: Element[]) {
  const { nodes, edges } = diagramParts(elements);
  if (!nodes.length) throw new Error("Add at least one labeled shape or text item before exporting diagram code.");
  const lines = ["digraph SketchDraw {", "  rankdir=TB;"];
  for (const node of nodes) {
    const item = node.item;
    const shape = item.type === "circle" ? "ellipse" : item.type === "diamond" ? "diamond" : item.type === "schemaTable" ? "record" : "box";
    const color = item.type === "schemaTable" || item.type === "group" ? "#9ca3af" : item.type === "text" ? "#333333" : item.color;
    const fill = item.type === "schemaTable" || item.type === "group" ? "#ffffff" : item.type === "text" ? "none" : item.fillColor ?? "#ffffff";
    const rounded = item.type === "group" || item.type === "rectangle" && item.edgeStyle === "rounded";
    lines.push(`  ${node.id} [label="${escapeQuoted(node.label)}", shape=${shape}, color="${escapeQuoted(color)}", fillcolor="${escapeQuoted(fill)}", style="${item.type === "text" ? "" : `filled${rounded ? ",rounded" : ""}`}"];`);
  }
  for (const edge of edges) {
    const item = edge.item;
    const style = item.lineStyle === "dotted" ? "dotted" : item.lineStyle === "dashed" ? "dashed" : "solid";
    const dir = item.startHead && item.startHead !== "none" ? "both" : item.type === "arrow" || (item.endHead && item.endHead !== "none") ? "forward" : "none";
    const arrowhead = item.endHead === "none" ? "none" : item.endHead === "open" ? "vee" : item.endHead === "dot" ? "odot" : item.endHead === "bar" ? "tee" : "normal";
    const arrowtail = item.startHead === "none" ? "none" : item.startHead === "open" ? "vee" : item.startHead === "dot" ? "odot" : item.startHead === "bar" ? "tee" : "normal";
    lines.push(`  ${edge.from.id} -> ${edge.to.id} [${edge.label ? `label="${escapeQuoted(edge.label)}", ` : ""}color="${escapeQuoted(item.color)}", penwidth=${Math.max(.5, item.thickness)}, style=${style}, dir=${dir}, arrowhead=${arrowhead}, arrowtail=${arrowtail}];`);
  }
  return lines.join("\n") + "\n}\n";
}

type DotNodeMetadata = { shape?: string; rankdir?: "LR" | "RL" | "TB" | "BT"; nodesep?: number; ranksep?: number; ranksepEqually?: boolean; groups?: { key: string; rank: string }[] };
type DotEdgeMetadata = { graph?: "graph" | "digraph"; direction?: string; arrowHead?: string; arrowTail?: string; startHead?: string; endHead?: string };
const decodeDotMetadata = <T,>(role: string | undefined, prefix: string): T | undefined => {
  if (!role?.startsWith(prefix)) return undefined;
  try { return JSON.parse(decodeURIComponent(role.slice(prefix.length))) as T; } catch { return undefined; }
};

function exportDot(elements: Element[]) {
  const { nodes, edges } = diagramParts(elements);
  if (!nodes.length) return exportDotLegacy(elements);
  const nodeMetadata = (node: CodeNode) => decodeDotMetadata<DotNodeMetadata>(node.item.componentRole, "dot-node|");
  const edgeMetadata = (edge: CodeEdge) => decodeDotMetadata<DotEdgeMetadata>(edge.item.componentRole, "dot-edge|");
  const ids = new Map(nodes.map((node, index) => {
    let importedId: string | undefined;
    if (node.item.id?.startsWith("dot-node:")) {
      importedId = node.item.liveKey;
      if (!importedId) { try { importedId = decodeURIComponent(node.item.id.slice("dot-node:".length)); } catch { /* Use the generated safe ID for malformed imported metadata. */ } }
    }
    return [node.item, importedId ?? node.id ?? `node_${index + 1}`] as const;
  }));
  const quote = (value: string) => `"${escapeQuoted(value)}"`;
  const escapeRecord = (value: string) => value.replace(/\\/g, "\\\\").replace(/[{}|<>]/g, character => `\\${character}`);
  const metadata = nodes.map(nodeMetadata).find((value): value is DotNodeMetadata => !!value);
  const directed = edges.some(edge => edgeMetadata(edge)?.graph === "digraph") || edges.some(edge => edge.item.type === "arrow" || edge.item.startHead && edge.item.startHead !== "none" || edge.item.endHead && edge.item.endHead !== "none");
  const lines = [`${directed ? "digraph" : "graph"} SketchDraw {`, `  rankdir=${metadata?.rankdir ?? "TB"};`];
  if (metadata?.nodesep !== undefined) lines.push(`  nodesep=${metadata.nodesep};`);
  if (metadata?.ranksep !== undefined) lines.push(`  ranksep=${quote(`${metadata.ranksep}${metadata.ranksepEqually ? " equally" : ""}`)};`);
  const byElement = new Map<Element, CodeNode>(nodes.map(node => [node.item, node]));
  const emittedClusters = new Set<string>();
  const hasNode = (items: Element[]): boolean => items.some(item => byElement.has(item) || item.type === "group" && hasNode(item.elements));
  const flowchartShape: Record<string, string> = { process: "box", terminator: "oval", decision: "diamond", data: "parallelogram", document: "note", "multi-document": "tab", database: "cylinder", "predefined-process": "component", "internal-storage": "component", preparation: "hexagon", "manual-input": "parallelogram", "manual-operation": "box", connector: "circle", "off-page": "note", delay: "triangle", "stored-data": "cylinder", display: "parallelogram", merge: "triangle", extract: "triangle", collate: "box", sort: "diamond", "summing-junction": "circle", or: "circle", "loop-limit": "hexagon", "loop-start": "circle", "loop-end": "circle", "alternate-process": "box", card: "note", "punched-tape": "parallelogram", "sequential-data": "parallelogram", "direct-data": "parallelogram", cloud: "cloud", star: "star", lightning: "rarrow", heart: "box", callout: "note", gear: "component", hexagon: "hexagon", parallelogram: "parallelogram", trapezoid: "trapezium", pentagon: "pentagon", octagon: "octagon", chevron: "rarrow", cross: "box", folder: "folder", note: "note", cube: "box3d", "rounded-rectangle": "box", shield: "box", "right-arrow": "rarrow", "left-arrow": "larrow", "double-arrow": "rarrow", "up-arrow": "rarrow", "down-arrow": "rarrow", ring: "ellipse", "pie-slice": "ellipse", wave: "parallelogram", banner: "note", teardrop: "circle", funnel: "trapezium" };
  const emitNode = (node: CodeNode, depth: number) => {
    const item = node.item; const source = nodeMetadata(node);
    const shape = item.altText?.includes("Unsupported DOT shape") ? "box" : source?.shape ?? (item.type === "text" ? "plaintext" : item.type === "circle" ? "ellipse" : item.type === "diamond" ? "diamond" : item.type === "triangle" ? "triangle" : item.type === "schemaTable" ? "record" : item.type === "flowchart" ? flowchartShape[item.flowchartShape ?? "process"] ?? "box" : "box");
    const labelStyle = item.type === "text" || item.type === "group" || item.type === "schemaTable" ? undefined : item.label;
    const shapeElement = item.type === "text" || item.type === "group" || item.type === "schemaTable" ? undefined : item;
    let label = quote(node.label);
    if (shape === "record" || shape === "mrecord") {
      const fields = node.label.split(/\r?\n/); const ports = "connectionPoints" in item ? item.connectionPoints ?? [] : [];
      label = quote(`{${fields.map((field, index) => { const port = ports.find(point => point.id === `dot-port-${index + 1}`) ?? ports[index]; return `${port ? `<${escapeRecord(port.name)}>` : ""}${escapeRecord(field)}`; }).join("|")}}`);
    }
    const color = item.type === "schemaTable" || item.type === "group" ? "#9ca3af" : item.type === "text" ? "#333333" : item.color;
    const fill = item.type === "schemaTable" || item.type === "group" ? "#ffffff" : item.type === "text" ? "none" : item.fillColor ?? "#ffffff";
    const styles = [item.type === "schemaTable" || (shapeElement && (shapeElement.fillOpacity ?? 0.2) > 0) ? "filled" : "", shapeElement?.edgeStyle === "rounded" ? "rounded" : "", shapeElement?.lineStyle === "dashed" ? "dashed" : "", shapeElement?.lineStyle === "dotted" ? "dotted" : "", labelStyle?.bold ? "bold" : "", labelStyle?.italic ? "italic" : ""].filter(Boolean);
    const width = item.type === "text" ? Math.max(30, item.text.length * item.fontSize * 0.55) : item.type === "group" ? item.componentBounds?.w ?? 180 : item.w;
    const height = item.type === "text" ? Math.max(24, item.fontSize * 1.5) : item.type === "group" ? item.componentBounds?.h ?? 80 : item.h;
    const attrs = [`label=${label}`, `shape=${shape}`, `width=${(Math.max(12, width) / 96).toFixed(3)}`, `height=${(Math.max(12, height) / 96).toFixed(3)}`, "fixedsize=shape", `color=${quote(color)}`, `fillcolor=${quote(fill)}`, `penwidth=${Math.max(0.5, shapeElement?.thickness ?? 1).toFixed(2)}`, `style=${quote(styles.join(","))}`];
    if (labelStyle?.color) attrs.push(`fontcolor=${quote(labelStyle.color)}`);
    if (labelStyle?.fontSize) attrs.push(`fontsize=${labelStyle.fontSize}`);
    if (shapeElement?.lineStyle === "double") attrs.push("peripheries=2");
    lines.push(`${"  ".repeat(depth)}${quote(ids.get(item) ?? node.id)} [${attrs.join(", ")}];`);
  };
  const emitItems = (items: Element[], depth: number) => {
    for (const item of items) {
      if (item.hidden) continue;
      const node = byElement.get(item);
      if (node) { emitNode(node, depth); continue; }
      if (item.type !== "group") continue;
      if (item.container?.kind === "container" && hasNode(item.elements)) {
        const sourceId = item.liveKey || item.id?.replace(/^dot-cluster:/, "") || item.container.name || `cluster_${emittedClusters.size + 1}`;
        const base = safeId(sourceId, `cluster_${emittedClusters.size + 1}`); let cluster = base; let suffix = 2;
        while (emittedClusters.has(cluster)) cluster = `${base}_${suffix++}`;
        emittedClusters.add(cluster);
        const clusterId = /^cluster(?:_|$)/i.test(cluster) ? cluster : `cluster_${cluster}`;
        const style = [item.container.background ? "filled" : "", item.container.borderStyle === "dashed" ? "dashed" : item.container.borderStyle === "dotted" ? "dotted" : "", "rounded"].filter(Boolean).join(",");
        lines.push(`${"  ".repeat(depth)}subgraph ${clusterId} {`, `${"  ".repeat(depth + 1)}label=${quote(item.container.name || sourceId)};`, `${"  ".repeat(depth + 1)}color=${quote(item.container.borderColor ?? "#9ca3af")};`, `${"  ".repeat(depth + 1)}penwidth=${Math.max(0.5, item.container.borderThickness ?? 1.5).toFixed(2)};`);
        if (item.container.background) lines.push(`${"  ".repeat(depth + 1)}fillcolor=${quote(item.container.background)};`);
        if (style) lines.push(`${"  ".repeat(depth + 1)}style=${quote(style)};`);
        emitItems(item.elements, depth + 1); lines.push(`${"  ".repeat(depth)}}`);
      } else emitItems(item.elements, depth);
    }
  };
  emitItems(elements, 1);
  const rankSets = new Map<string, { rank: string; ids: string[] }>();
  for (const node of nodes) for (const group of nodeMetadata(node)?.groups ?? []) { const current = rankSets.get(group.key) ?? { rank: group.rank, ids: [] }; current.ids.push(quote(ids.get(node.item) ?? node.id)); rankSets.set(group.key, current); }
  for (const { rank, ids: rankedIds } of rankSets.values()) if (rankedIds.length > 1) lines.push(`  subgraph { rank=${rank}; ${rankedIds.join("; ")}; }`);
  const toDotHead = (value: ShapeElement["endHead"]) => value === "none" ? "none" : value === "open" ? "vee" : value === "hollow" ? "empty" : value === "thick" ? "box" : value === "dot" ? "odot" : value === "diamond" ? "diamond" : value === "open-diamond" ? "odiamond" : value === "bar" ? "tee" : value === "crow" ? "crow" : "normal";
  for (const edge of edges) {
    const item = edge.item; const source = edgeMetadata(edge); const unchanged = source && source.startHead === item.startHead && source.endHead === item.endHead;
    const tail = unchanged && source?.arrowTail ? source.arrowTail : toDotHead(item.startHead);
    const head = unchanged && source?.arrowHead ? source.arrowHead : toDotHead(item.endHead);
    const direction = unchanged && source?.direction ? source.direction : item.startHead && item.startHead !== "none" ? item.endHead && item.endHead !== "none" ? "both" : "back" : item.endHead && item.endHead !== "none" ? "forward" : "none";
    const style = item.lineStyle === "dotted" ? "dotted" : item.lineStyle === "dashed" ? "dashed" : "solid";
    const attrs = [...(edge.label ? [`label=${quote(edge.label)}`] : []), `color=${quote(item.color)}`, `penwidth=${Math.max(0.5, item.thickness).toFixed(2)}`, `style=${style}`, ...(directed ? [`dir=${direction}`, `arrowhead=${head}`, `arrowtail=${tail}`] : [])];
    const anchorId = (node: CodeNode, anchor: { x: number; y: number } | undefined) => {
      const id = quote(ids.get(node.item) ?? node.id); const source = nodeMetadata(node);
      const port = (source?.shape === "record" || source?.shape === "mrecord") && "connectionPoints" in node.item ? node.item.connectionPoints?.find(point => !!anchor && Math.abs(point.anchor.x - anchor.x) < 0.015 && Math.abs(point.anchor.y - anchor.y) < 0.015) : undefined;
      if (port) return `${id}:${quote(port.name)}`;
      if (!anchor) return id;
      const compass = ({ "0.5,0": "n", "1,0": "ne", "1,0.5": "e", "1,1": "se", "0.5,1": "s", "0,1": "sw", "0,0.5": "w", "0,0": "nw", "0.5,0.5": "c" } as Record<string, string>)[`${Math.round(anchor.x * 2) / 2},${Math.round(anchor.y * 2) / 2}`];
      return compass ? `${id}:${compass}` : id;
    };
    lines.push(`  ${anchorId(edge.from, item.startBinding?.anchor)} ${directed ? "->" : "--"} ${anchorId(edge.to, item.endBinding?.anchor)} [${attrs.join(", ")}];`);
  }
  return lines.join("\n") + "\n}\n";
}

export function dotExportLosses(elements: Element[]): string[] {
  const visible = flatten(elements);
  const losses = new Set<string>(["Graphviz recalculates layout; exact canvas coordinates and connector routes are not retained."]);
  if (visible.some(item => item.type === "group" && !item.container)) losses.add("Groups without container metadata are flattened.");
  if (visible.some(item => item.type === "schemaTable")) losses.add("Database card constraints, indexes, and SQL types are flattened into record labels.");
  if (visible.some(item => item.type === "group" && item.libraryComponent?.kind === "uml-class")) losses.add("UML class compartments are flattened into a multiline node label.");
  if (visible.some(item => item.altText?.includes("Unsupported DOT shape"))) losses.add("Unsupported DOT shapes use editable rectangle fallbacks on the canvas and export as boxes.");
  const approximatedFlowchartShapes = new Set(["heart", "cross", "shield", "double-arrow", "up-arrow", "down-arrow", "teardrop", "pie-slice", "wave", "banner", "funnel"]);
  if (visible.some(item => item.type === "flowchart" && approximatedFlowchartShapes.has(item.flowchartShape ?? ""))) losses.add("Some decorative flowchart shapes are approximated with the nearest supported Graphviz node shape.");
  if (visible.some(item => item.tooltip?.includes("HTML-like DOT"))) losses.add("HTML-like label formatting is reduced to plain text.");
  if (visible.some(item => item.type !== "group" && "rotation" in item && !!item.rotation)) losses.add("Shape rotations and custom shape adjustments are not represented by DOT export.");
  if (visible.some(item => item.type === "line" || item.type === "arrow" ? item.lineStyle === "double" || item.autoRoute || item.routePoints?.length || item.routeWaypoints?.length : false)) losses.add("Double and manually routed connector styling is simplified to standard DOT edges.");
  if (visible.some(item => item.type !== "group" && "opacity" in item && item.opacity !== undefined && item.opacity < 1 || item.type !== "group" && "fillOpacity" in item && item.fillOpacity !== undefined && item.fillOpacity > 0 && item.fillOpacity < 1)) losses.add("Object opacity and translucent fills are not retained.");
  return [...losses];
}

function exportD2(elements: Element[]) {
  const visible: Element[] = [];
  const collect = (items: Element[]) => items.forEach(item => { if (!item.hidden) { visible.push(item); if (item.type === "group") collect(item.elements); } });
  collect(elements);
  const labels = (item: Element) => item.type === "schemaTable" ? item.name : item.type === "group" ? item.libraryComponent?.label ?? item.container?.name ?? item.note?.title ?? item.liveKey ?? "Group" : item.type === "text" ? item.text : "label" in item ? item.label?.text ?? "" : "";
  const rawId = (item: Element, fallback: string) => item.liveKey || (item.id?.startsWith("mermaid-node:") ? item.id.slice("mermaid-node:".length) : item.id) || fallback;
  const quoteKey = (value: string) => /^[A-Za-z_][\w.-]{0,119}$/.test(value) ? value : JSON.stringify(value);
  const sourcePath = (value: string) => value.split(".").map(quoteKey).join(".");
  const localId = (item: Element, fallback: string) => { const value = rawId(item, fallback).split("."); const last = value[value.length - 1] || fallback; return item.liveKey ? last : safeId(last, fallback); };
  const indent = (depth: number) => "  ".repeat(depth);
  const lines: string[] = [];
  const ids = new Map<string, string>();
  const usedIds = new Set<string>();
  let generatedId = 0;
  const getId = (item: Element) => {
    const known = item.id ? ids.get(item.id) : undefined;
    if (known) return known;
    const candidate = rawId(item, `node_${++generatedId}`);
    if (item.liveKey) { ids.set(item.id ?? candidate, candidate); return candidate; }
    const id = candidate.split(".").map(part => {
      const cleaned = safeId(part, `node_${++generatedId}`);
      let value = cleaned; let suffix = 2;
      while (usedIds.has(value)) value = `${cleaned}_${suffix++}`;
      usedIds.add(value); return value;
    }).join(".");
    if (item.id) ids.set(item.id, id);
    return id;
  };
  const participants = visible.filter((item): item is GroupElement => item.type === "group" && item.d2?.sequenceKind === "participant").sort((a, b) => (a.d2?.sequenceOrder ?? 0) - (b.d2?.sequenceOrder ?? 0));
  const messages = visible.filter((item): item is ShapeElement => (item.type === "arrow" || item.type === "line") && item.d2?.sequenceKind === "message").sort((a, b) => (a.d2?.sequenceOrder ?? 0) - (b.d2?.sequenceOrder ?? 0));
  const layout = elements.find(item => item.d2?.layout)?.d2?.layout;
  if (participants.length && messages.length) {
    lines.push("shape: sequence_diagram");
    for (const participant of participants) {
      const id = getId(participant); const label = participant.container?.name ?? participant.libraryComponent?.label ?? labels(participant);
      lines.push(`${indent(0)}${sourcePath(id)}: ${JSON.stringify(label)}`);
    }
    for (const message of messages) {
      const from = message.startBinding?.elementId ? visible.find(item => item.id === message.startBinding!.elementId) : undefined;
      const to = message.endBinding?.elementId ? visible.find(item => item.id === message.endBinding!.elementId) : undefined;
      if (!from || !to) continue;
      const fromId = ids.get(from.id ?? "") ?? getId(from); const toId = ids.get(to.id ?? "") ?? getId(to);
      const roleDirection = message.componentRole?.slice("d2-sequence-message:".length);
      const operator = roleDirection === "none" || message.type === "line" ? "--" : message.startHead !== "none" && message.startHead ? "<->" : message.lineStyle === "dotted" ? "..>" : "->";
      lines.push(`${sourcePath(fromId)} ${operator} ${sourcePath(toId)}${message.label?.text ? `: ${JSON.stringify(message.label.text)}` : ""}`);
    }
  } else {
    const hasExportableNode = visible.some(item => item.type === "schemaTable" || item.type === "text" || item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "triangle" || item.type === "flowchart" || item.type === "group" && (item.libraryComponent?.kind === "uml-class" || !item.note && !item.mermaid && !item.libraryComponent));
    if (!hasExportableNode) throw new Error("Add at least one labeled shape or text item before exporting diagram code.");
    if (layout?.direction) lines.push(`direction: ${layout.direction}`);
    if (layout?.padding !== undefined) lines.push(`vars: {\n  d2-config: {\n    pad: ${layout.padding}\n  }\n}`);
    if (layout && (layout.gridGap !== undefined || layout.horizontalGap !== undefined || layout.verticalGap !== undefined)) lines.push(`# SketchDraw layout: ${JSON.stringify(layout)}`);
    const rendered = new Set<string>();
    const shapeName = (item: Element): string => {
      if (item.d2?.shape) return item.d2.shape;
      if (item.type === "circle") return "oval";
      if (item.type === "diamond") return "diamond";
      if (item.type === "flowchart") return item.flowchartShape?.replace(/-/g, "_") ?? "rectangle";
      return "rectangle";
    };
    const styleLines = (item: Element, depth: number) => {
      const pad = indent(depth);
      const fill = item.d2?.fill ?? (item.type === "schemaTable" ? undefined : item.type === "group" ? item.container?.background : "fillColor" in item ? item.fillColor : undefined);
      const stroke = item.d2?.stroke ?? (item.type === "group" ? item.container?.borderColor : "color" in item ? item.color : undefined);
      const width = item.d2?.strokeWidth ?? (item.type === "group" ? item.container?.borderThickness : "thickness" in item ? item.thickness : undefined);
      if (fill && fill !== "#ffffff") lines.push(`${pad}style.fill: ${JSON.stringify(fill)}`);
      if (stroke && stroke !== "#64748b" && stroke !== "#9ca3af") lines.push(`${pad}style.stroke: ${JSON.stringify(stroke)}`);
      if (width && width !== 2) lines.push(`${pad}style.stroke-width: ${width}`);
      const labelColor = item.d2?.fontColor ?? (item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "flowchart" ? item.label?.color : undefined);
      if (labelColor && labelColor !== "#172033") lines.push(`${pad}style.font-color: ${JSON.stringify(labelColor)}`);
      const fontSize = item.d2?.fontSize ?? (item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "flowchart" ? item.label?.fontSize : undefined);
      if (fontSize && fontSize !== 14) lines.push(`${pad}style.font-size: ${fontSize}`);
      if (item.d2?.strokeDash) lines.push(`${pad}style.stroke-dash: ${JSON.stringify(item.d2.strokeDash)}`);
    };
    const writeLeaf = (item: Element, depth: number) => {
      if (rendered.has(item.id ?? "")) return;
      rendered.add(item.id ?? "");
      const key = quoteKey(localId(item, `node_${++generatedId}`)); const pad = indent(depth);
      const name = shapeName(item);
      if (item.type === "schemaTable") {
        lines.push(`${pad}${key}: {`, `${pad}  label: ${JSON.stringify(item.name)}`, `${pad}  shape: sql_table`);
        for (const column of item.columns) {
          const constraints = [column.primaryKey ? "primary_key" : "", column.foreignTable ? "foreign_key" : "", column.nullable === false && !column.primaryKey ? "not_null" : "", (item.constraints ?? []).some(value => value.kind === "unique" && value.columns?.includes(column.name)) ? "unique" : ""].filter(Boolean);
          lines.push(`${pad}  ${quoteKey(column.name)}: ${column.dataType || "string"}${constraints.length ? ` {constraint: [${constraints.join("; ")}]}` : ""}`);
        }
        styleLines(item, depth + 1);
        if (item.d2?.near) lines.push(`${pad}  near: ${JSON.stringify(item.d2.near)}`);
        if (item.w > 0) lines.push(`${pad}  width: ${Math.round(item.w)}`); if (item.h > 0) lines.push(`${pad}  height: ${Math.round(item.h)}`);
        lines.push(`${pad}}`); return;
      }
      if (item.type === "group" && item.libraryComponent?.kind === "uml-class") {
        lines.push(`${pad}${key}: {`, `${pad}  label: ${JSON.stringify(item.libraryComponent.label ?? "Class")}`, `${pad}  shape: class`);
        const fields = item.libraryComponent.componentFields ?? [];
        for (const name of ["attributes", "methods"]) for (const member of (fields.find(field => field.key === name)?.value ?? "").split(/\r?\n/).map(value => value.trim()).filter(Boolean)) lines.push(`${pad}  ${member}`);
        styleLines(item, depth + 1); if (item.d2?.icon) lines.push(`${pad}  icon: ${JSON.stringify(item.d2.icon)}`); if (item.d2?.near) lines.push(`${pad}  near: ${JSON.stringify(item.d2.near)}`);
        if (item.componentBounds?.w) lines.push(`${pad}  width: ${Math.round(item.componentBounds.w)}`); if (item.componentBounds?.h) lines.push(`${pad}  height: ${Math.round(item.componentBounds.h)}`);
        lines.push(`${pad}}`); return;
      }
      const label = labels(item);
      lines.push(`${pad}${key}: {`, `${pad}  label: ${JSON.stringify(label)}`, `${pad}  shape: ${name}`);
      styleLines(item, depth + 1);
      if (item.d2?.icon) lines.push(`${pad}  icon: ${JSON.stringify(item.d2.icon)}`);
      if (item.d2?.near) lines.push(`${pad}  near: ${JSON.stringify(item.d2.near)}`);
      if (("w" in item && item.w > 0) && item.d2?.shape) lines.push(`${pad}  width: ${Math.round(item.w)}`);
      if (("h" in item && item.h > 0) && item.d2?.shape) lines.push(`${pad}  height: ${Math.round(item.h)}`);
      lines.push(`${pad}}`);
    };
    const writeNodes = (items: Element[], depth: number) => {
      for (const item of items) {
        if (item.hidden) continue;
        if (item.type === "group" && item.libraryComponent?.kind !== "uml-class" && !item.note && !item.mermaid) {
          const key = quoteKey(localId(item, `group_${++generatedId}`)); const name = item.container?.name ?? item.libraryComponent?.label;
          lines.push(`${indent(depth)}${key}: {`);
          if (name && name !== key) lines.push(`${indent(depth + 1)}label: ${JSON.stringify(name)}`);
          if (item.d2?.shape === "grid") {
            lines.push(`${indent(depth + 1)}shape: grid`);
            if (item.d2.gridRows) lines.push(`${indent(depth + 1)}grid-rows: ${item.d2.gridRows}`);
            if (item.d2.gridColumns) lines.push(`${indent(depth + 1)}grid-columns: ${item.d2.gridColumns}`);
            if (item.d2.layout?.gridGap !== undefined) lines.push(`${indent(depth + 1)}grid-gap: ${item.d2.layout.gridGap}`);
            if (item.d2.layout?.horizontalGap !== undefined) lines.push(`${indent(depth + 1)}horizontal-gap: ${item.d2.layout.horizontalGap}`);
            if (item.d2.layout?.verticalGap !== undefined) lines.push(`${indent(depth + 1)}vertical-gap: ${item.d2.layout.verticalGap}`);
          }
          styleLines(item, depth + 1);
          writeNodes(item.elements, depth + 1);
          lines.push(`${indent(depth)}}`); continue;
        }
        if (isNode(item)) writeLeaf(item, depth);
      }
    };
    writeNodes(elements, 0);
    const containers = visible.filter((item): item is GroupElement => item.type === "group" && !item.note && !item.mermaid && item.libraryComponent?.kind !== "uml-class");
    containers.forEach(item => getId(item));
    const nodeItems = visible.filter(item => isNode(item));
    for (const item of nodeItems) getId(item);
    const idByElement = new Map(visible.filter(item => item.id && ids.has(item.id)).map(item => [item.id!, ids.get(item.id!)!]));
    const looseEdges = diagramParts(elements).edges;
    const edgeItems = visible.filter((item): item is ShapeElement => (item.type === "arrow" || item.type === "line") && item.d2?.sequenceKind !== "message");
    const emitted = new Set<string>();
    for (const edge of edgeItems) {
      if (emitted.has(edge.id ?? "")) continue;
      let fromId = edge.startBinding?.elementId ? idByElement.get(edge.startBinding.elementId) : undefined;
      let toId = edge.endBinding?.elementId ? idByElement.get(edge.endBinding.elementId) : undefined;
      const loose = looseEdges.find(candidate => candidate.item === edge);
      fromId ??= loose?.from.id; toId ??= loose?.to.id;
      if (!fromId || !toId) continue;
      const operator = edge.type === "line" || edge.endHead === "none" ? "--" : edge.startHead && edge.startHead !== "none" ? "<->" : edge.lineStyle === "dotted" ? "..>" : "->";
      lines.push(`${sourcePath(fromId)} ${operator} ${sourcePath(toId)}${edge.label?.text ? `: ${JSON.stringify(edge.label.text)}` : ""}`);
      emitted.add(edge.id ?? "");
    }
  }
  return lines.join("\n") + "\n";
}

function exportCsv(elements: Element[]) {
  const { nodes, edges } = diagramParts(elements);
  if (!nodes.length) throw new Error("Add at least one labeled shape or text item before exporting diagram code.");
  const rows: unknown[][] = [["id", "label", "from", "to", "edgeLabel", "kind"]];
  for (const node of nodes) rows.push([node.id, node.label, "", "", "", node.item.type]);
  for (const edge of edges) rows.push(["", "", edge.from.id, edge.to.id, edge.label, edge.item.type]);
  return rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function sqlIdentifier(value: string, dialect: SqlDialect) {
  if (dialect === "mysql" || dialect === "mariadb") return `\`${value.replace(/`/g, "``")}\``;
  if (dialect === "sqlserver") return "[" + value.replace(/\]/g, "]]" ) + "]";
  return `"${value.replace(/"/g, '""')}"`;
}

function sqlQualifiedIdentifier(value: string, dialect: SqlDialect) {
  return value.split(".").map(part => sqlIdentifier(part, dialect)).join(".");
}

function sqlLiteral(value: string) { return `'${value.replace(/'/g, "''")}'`; }

function inlineEnumValues(type: string): string[] | undefined {
  const match = /^ENUM\s*\(([\s\S]*)\)$/i.exec(type.trim()); if (!match) return undefined;
  const values: string[] = []; let current = ""; let quoted = false;
  for (let index = 0; index < match[1].length; index++) {
    const char = match[1][index];
    if (quoted) { current += char; if (char === "'" && match[1][index + 1] === "'") current += match[1][++index]; else if (char === "'") quoted = false; }
    else if (char === "'") { quoted = true; current += char; }
    else if (char === ",") { const value = /^'((?:''|[^'])*)'$/.exec(current.trim()); if (!value) return undefined; values.push(value[1].replace(/''/g, "'")); current = ""; }
    else current += char;
  }
  const last = /^'((?:''|[^'])*)'$/.exec(current.trim()); if (!last) return undefined;
  values.push(last[1].replace(/''/g, "'")); return values;
}

function schemaObjectKind(table: SchemaTableElement) { return table.objectKind ?? "table"; }

export function sqlSchemaExportLosses(tables: SchemaTableElement[], dialect: SqlDialect): string[] {
  const losses = new Set<string>();
  const source = tables.map(table => table.schemaSource).filter(Boolean).join("\n");
  const enums = tables.filter(table => schemaObjectKind(table) === "enum");
  if (enums.length && dialect !== "postgresql") losses.add(dialect === "mysql" || dialect === "mariadb"
    ? "Named enum objects are inlined only when a column refers to them; unused named enums are emitted as comments because this dialect defines ENUM on columns."
    : "This dialect has no native PostgreSQL-style enum type; enum values are converted to a text-like column plus a CHECK when referenced, and standalone enum objects are comments.");
  if ((dialect === "mysql" || dialect === "mariadb") && tables.some(table => table.indexes?.some(index => /^WHERE\b/i.test(index.expression ?? "")))) losses.add("Partial-index WHERE clauses are omitted for MySQL/MariaDB.");
  if (tables.some(table => table.indexes?.some(index => index.columns.some(column => !/^[\p{L}_$][\p{L}\p{N}_$-]*$/u.test(column))))) losses.add("Expression-index terms are preserved as SQL expressions; verify that the chosen database version supports their syntax.");
  if ((dialect === "sqlite" || dialect === "sqlserver") && tables.some(table => table.indexes?.some(index => index.method))) losses.add("The source index access method is omitted because SQLite and SQL Server use their own index implementations.");
  if (/\bINCLUDE\s*\(|\bNULLS\s+NOT\s+DISTINCT\b|\bWITH\s*\(/i.test(source)) losses.add("Index INCLUDE columns and storage options are not modeled and will not be regenerated.");
  if (/\bDEFERRABLE\b|\bINITIALLY\s+(?:DEFERRED|IMMEDIATE)\b|\bMATCH\s+(?:FULL|SIMPLE|PARTIAL)\b|\bEXCLUDE\s+USING\b/i.test(source)) losses.add("Deferrability, FK MATCH modes, and exclusion constraints are not modeled and will not be regenerated.");
  if (/\bCREATE\s+DOMAIN\b|\bCREATE\s+SEQUENCE\b/i.test(source)) losses.add("Domains and standalone sequences are outside the editable schema model and are not exported.");
  if (dialect === "postgresql" && tables.some(table => table.columns.some(column => inlineEnumValues(column.dataType)))) losses.add("Inline MySQL ENUM columns are converted to PostgreSQL TEXT columns with CHECK constraints.");
  if (dialect === "sqlite" && tables.some(table => table.name.split(".").length > 1 && !["main", "temp"].includes(table.name.split(".")[0].toLowerCase()))) losses.add("SQLite schema qualifiers are retained, but databases must already be attached; the export does not create or attach database files.");
  if (/\b(?:AUTO_INCREMENT\b|IDENTITY\s*\(|DEFAULT\b|ON\s+UPDATE\b|GENERATED\s+(?:ALWAYS|BY\s+DEFAULT)\b|COLLATE\b)/i.test(source)) losses.add("Column defaults, identity/auto-increment clauses, generated expressions, and collations are not modeled and will not be regenerated.");
  if (/\bCREATE\s+(?:MATERIALIZED\s+)?TRIGGER\b/i.test(source)) losses.add("Triggers are outside the editable schema model and are not exported.");
  if (/\bCREATE\s+MATERIALIZED\s+VIEW\b/i.test(source)) losses.add("Materialized views are not imported as ordinary views and are not exported.");
  if (/\bCREATE\s+(?:MATERIALIZED\s+)?PROCEDURE\b|\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i.test(source)) losses.add("Stored procedures and functions are outside the editable schema model and are not exported.");
  if (tables.some(table => table.viewQuery && /\b(?:DEFINER|SQL\s+SECURITY|ALGORITHM|WITH\s+(?:LOCAL|CASCADED)?\s*CHECK\s+OPTION|WITH\s+SCHEMABINDING)\b/i.test(table.schemaSource))) losses.add("View security, algorithm, schemabinding, and check-option clauses are not modeled; only the view query is exported.");
  return [...losses];
}

function exportSqlSchema(tables: SchemaTableElement[], dialect: SqlDialect): string {
  const enums = tables.filter(table => schemaObjectKind(table) === "enum");
  const objects = tables.filter(table => schemaObjectKind(table) !== "enum");
  const enumByName = new Map(enums.flatMap(item => { const parts = item.name.split("."); return [[item.name.toLowerCase(), item], [parts[parts.length - 1].toLowerCase(), item]]; }));
  const quoteName = (name: string) => sqlQualifiedIdentifier(name, dialect);
  const namespaceObjects = dialect === "postgresql" ? tables : objects;
  const schemas = [...new Set(namespaceObjects.flatMap(table => { const parts = table.name.split("."); return parts.length > 1 ? [parts.slice(0, -1).join(".")] : []; }))];
  const header: string[] = [];
  for (const schema of schemas) {
    if (dialect === "postgresql") header.push(`CREATE SCHEMA IF NOT EXISTS ${quoteName(schema)};`);
    else if (dialect === "mysql" || dialect === "mariadb") header.push(`CREATE DATABASE IF NOT EXISTS ${quoteName(schema)};`);
    else if (dialect === "sqlserver") header.push(`IF SCHEMA_ID(N'${schema.replace(/'/g, "''")}') IS NULL EXEC(N'CREATE SCHEMA ${quoteName(schema).replace(/'/g, "''")}');`);
  }
  const enumStatements = enums.flatMap(item => {
    const values = item.enumValues ?? item.columns.map(column => column.name);
    if (dialect !== "postgresql") return [`-- Enum ${item.name}: ${values.map(sqlLiteral).join(", ")} (see export limitations)`];
    return [`CREATE TYPE ${quoteName(item.name)} AS ENUM (${values.map(sqlLiteral).join(", ")});`];
  });
  const tablesSql = objects.filter(table => schemaObjectKind(table) === "table").map(table => {
    const constraints = table.constraints ?? [];
    const tablePrimaryKey = constraints.some(item => item.kind === "primary-key");
    const foreignKeyColumns = new Set(constraints.filter(item => item.kind === "foreign-key").flatMap(item => item.columns ?? []));
    const columns = table.columns.map(field => {
      const dataType = field.dataType || (dialect === "sqlserver" ? "NVARCHAR(255)" : dialect === "sqlite" ? "TEXT" : "TEXT");
      const dataTypeParts = dataType.split(".");
      const enumType = enumByName.get(dataType.toLowerCase()) ?? enumByName.get(dataTypeParts[dataTypeParts.length - 1].toLowerCase());
      const inlineValues = inlineEnumValues(dataType) ?? (enumType ? enumType.enumValues ?? enumType.columns.map(column => column.name) : undefined);
      let renderedType = dataType;
      if (enumType && dialect === "mysql" || enumType && dialect === "mariadb") renderedType = `ENUM(${(inlineValues ?? []).map(sqlLiteral).join(", ")})`;
      else if (enumType && dialect === "sqlite") renderedType = "TEXT";
      else if (enumType && dialect === "sqlserver") renderedType = "NVARCHAR(255)";
      else if (!enumType && inlineValues && dialect === "postgresql") renderedType = "TEXT";
      else if (inlineValues && dialect === "sqlite") renderedType = "TEXT";
      else if (inlineValues && dialect === "sqlserver") renderedType = "NVARCHAR(255)";
      const addEnumCheck = !!inlineValues && (dialect === "sqlite" || dialect === "sqlserver" || dialect === "postgresql" && !enumType);
      const parts = [`  ${sqlIdentifier(field.name, dialect)} ${renderedType}`,
        ...(!tablePrimaryKey && field.primaryKey ? ["PRIMARY KEY"] : []),
        ...(field.nullable === false || field.primaryKey ? ["NOT NULL"] : []),
        ...(!foreignKeyColumns.has(field.name) && field.foreignTable ? [`REFERENCES ${quoteName(field.foreignTable)} (${sqlIdentifier(field.foreignColumn || "id", dialect)})`] : []),
        ...(addEnumCheck ? [`CHECK (${sqlIdentifier(field.name, dialect)} IN (${(inlineValues ?? []).map(sqlLiteral).join(", ")}))`] : [])];
      return parts.join(" ");
    });
    const tableConstraints = constraints.flatMap(constraint => {
      const prefix = constraint.name ? `CONSTRAINT ${sqlIdentifier(constraint.name, dialect)} ` : "";
      const list = (constraint.columns ?? []).map(column => sqlIdentifier(column, dialect)).join(", ");
      if (constraint.kind === "primary-key" && list) return [`  ${prefix}PRIMARY KEY (${list})`];
      if (constraint.kind === "unique" && list) return [`  ${prefix}UNIQUE (${list})`];
      if (constraint.kind === "check" && constraint.expression) return [`  ${prefix}CHECK (${constraint.expression})`];
      if (constraint.kind === "foreign-key" && list && constraint.referencedTable) {
        const actions = [constraint.onDelete ? `ON DELETE ${constraint.onDelete}` : "", constraint.onUpdate ? `ON UPDATE ${constraint.onUpdate}` : ""].filter(Boolean).join(" ");
        return [`  ${prefix}FOREIGN KEY (${list}) REFERENCES ${quoteName(constraint.referencedTable)} (${(constraint.referencedColumns ?? []).map(column => sqlIdentifier(column, dialect)).join(", ") || sqlIdentifier("id", dialect)})${actions ? ` ${actions}` : ""}`];
      }
      return [];
    });
    return `CREATE TABLE ${quoteName(table.name)} (\n${[...columns, ...tableConstraints].join(",\n")}\n);`;
  });
  const indexes = objects.filter(table => schemaObjectKind(table) === "table").flatMap(table => (table.indexes ?? []).map(index => {
    const cols = index.columns.map((column, indexPosition) => {
      const isIdentifier = /^[\p{L}_$][\p{L}\p{N}_$-]*$/u.test(column);
      return `${isIdentifier ? sqlIdentifier(column, dialect) : column}${isIdentifier && index.orders?.[indexPosition] === "DESC" ? " DESC" : isIdentifier && index.orders?.[indexPosition] === "ASC" ? " ASC" : ""}`;
    }).join(", ");
    const partial = index.expression && /^WHERE\b/i.test(index.expression) && dialect !== "mysql" && dialect !== "mariadb" ? ` ${index.expression}` : "";
    const indexName = quoteName(index.name);
    const methodBeforeTable = index.method && (dialect === "mysql" || dialect === "mariadb") ? ` USING ${index.method.toUpperCase()}` : "";
    const methodAfterTable = index.method && dialect === "postgresql" ? ` USING ${index.method}` : "";
    return `CREATE ${index.unique ? "UNIQUE " : ""}INDEX ${indexName}${methodBeforeTable} ON ${quoteName(table.name)}${methodAfterTable} (${cols})${partial};`;
  }));
  const views = objects.filter(table => schemaObjectKind(table) === "view").map(view => {
    if (!view.viewQuery?.trim()) throw new Error(`View ${view.name} is missing its SELECT query.`);
    const names = view.columns.length ? ` (${view.columns.map(column => sqlIdentifier(column.name, dialect)).join(", ")})` : "";
    return `CREATE VIEW ${quoteName(view.name)}${names} AS\n${view.viewQuery.trim().replace(/;\s*$/, "")};`;
  });
  const sections = [header, enumStatements, tablesSql, indexes, views].filter(section => section.length).map(section => section.join("\n"));
  return sections.join("\n\n") + "\n";
}

function exportSchema(tables: SchemaTableElement[], format: "sql" | "json", dialect: SqlDialect = "postgresql") {
  if (!tables.length) throw new Error("Select or create editable schema table cards before exporting SQL or JSON schema.");
  if (format === "json") {
    const used = new Set<string>();
    const definitions = tables.map((table, index) => {
      const base = safeId(table.name, `table_${index + 1}`); let id = base; let suffix = 2;
      while (used.has(id)) id = `${base}_${suffix++}`;
      used.add(id);
      const required: string[] = [];
      const properties = Object.fromEntries(table.columns.map(field => {
        const dataType = field.dataType || "TEXT";
        const upper = dataType.toUpperCase();
        const type = /^(?:BOOL|BOOLEAN)\b/.test(upper) ? "boolean" : /^(?:TINYINT|SMALLINT|MEDIUMINT|INT(?:EGER)?|BIGINT|SERIAL|BIGSERIAL)\b/.test(upper) ? "integer" : /^(?:DECIMAL|NUMERIC|REAL|FLOAT|DOUBLE)\b/.test(upper) ? "number" : /^(?:DATE|TIME|TIMESTAMP|DATETIME)\b/.test(upper) ? "string" : "string";
        const jsonFormat = /^(?:DATETIME|TIMESTAMP)\b/.test(upper) ? "date-time" : /^DATE\b/.test(upper) ? "date" : /^TIME\b/.test(upper) ? "time" : undefined;
        const nullable = field.nullable !== false && !field.primaryKey;
        if (!nullable) required.push(field.name);
        return [field.name, {
          type: nullable ? [type, "null"] : type,
          ...(jsonFormat ? { format: jsonFormat } : {}),
          "x-sketchdraw-dataType": dataType,
          "x-sketchdraw-primaryKey": !!field.primaryKey,
          "x-sketchdraw-nullable": nullable,
          ...(field.foreignTable ? { "x-sketchdraw-foreignTable": field.foreignTable, ...(field.foreignColumn ? { "x-sketchdraw-foreignColumn": field.foreignColumn } : {}) } : {}),
        }];
      }));
      return { id, table, schema: { title: table.name, type: "object", properties, required, additionalProperties: false, ...(table.objectKind && table.objectKind !== "table" ? { "x-sketchdraw-objectKind": table.objectKind } : {}), ...(table.viewQuery ? { "x-sketchdraw-viewQuery": table.viewQuery } : {}), ...(table.enumValues?.length ? { "x-sketchdraw-enumValues": table.enumValues } : {}), ...(table.indexes?.length ? { "x-sketchdraw-indexes": table.indexes } : {}), ...(table.constraints?.length ? { "x-sketchdraw-constraints": table.constraints } : {}) } };
    });
    return JSON.stringify({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "SketchDraw database schema",
      type: "object",
      properties: Object.fromEntries(definitions.map(({ id, table }) => [table.name, { $ref: `#/$defs/${id}` }])),
      additionalProperties: false,
      $defs: Object.fromEntries(definitions.map(({ id, schema }) => [id, schema])),
    }, null, 2) + "\n";
  }
  return exportSqlSchema(tables, dialect);
}

function exportEditablePlantUmlClasses(elements: Element[]): string | undefined {
  const items = flatten(elements);
  const classes = items.filter((item): item is GroupElement => item.type === "group" && item.libraryComponent?.kind === "uml-class" && item.componentRole?.startsWith("uml-class-node:") === true);
  if (!classes.length) return undefined;
  const decode = (value: string) => { try { return decodeURIComponent(value); } catch { return value; } };
  const quotePlantUml = (value: string) => `"${escapeQuoted(value)}"`;
  const sourceId = (item: GroupElement) => decode((item.componentRole ?? "").slice("uml-class-node:".length));
  const byId = new Map(classes.map(item => [item.id, item]));
  const lines = ["@startuml"];
  for (const item of classes) {
    const id = safeId(sourceId(item), "Class"); const name = item.libraryComponent?.label?.trim() || id;
    if (name !== id) lines.push(`class ${quotePlantUml(name)} as ${id} {`); else lines.push(`class ${id} {`);
    const fields = item.libraryComponent?.componentFields ?? [];
    for (const key of ["attributes", "methods"]) for (const member of (fields.find(field => field.key === key)?.value ?? "").split(/\r?\n/).map(value => value.trim()).filter(Boolean)) lines.push("  " + member);
    lines.push("}");
  }
  for (const item of items) {
    if ((item.type !== "line" && item.type !== "arrow") || !item.startBinding?.elementId || !item.endBinding?.elementId) continue;
    const from = byId.get(item.startBinding.elementId); const to = byId.get(item.endBinding.elementId); if (!from || !to) continue;
    const encoded = item.componentRole?.startsWith("uml-class-relation:") ? item.componentRole.slice("uml-class-relation:".length) : undefined;
    const relationMetadata = encoded ? (() => { try { return JSON.parse(decode(encoded)) as { operator?: string; fromCardinality?: string; toCardinality?: string; label?: string }; } catch { return { operator: decode(encoded) }; } })() : undefined;
    const raw = relationMetadata?.operator;
    const fallback = item.startHead === "hollow" ? item.lineStyle === "dashed" ? "<..|" : "<|--" : item.startHead === "diamond" ? "*--" : item.startHead === "open-diamond" ? "o--" : item.endHead === "hollow" ? item.lineStyle === "dashed" ? "..|>" : "--|>" : item.endHead === "diamond" ? "--*" : item.endHead === "open-diamond" ? "--o" : item.endHead === "none" ? item.lineStyle === "dashed" ? ".." : "--" : item.lineStyle === "dashed" ? "..>" : "-->";
    const relation = raw && /^(?:<\|--|--\|>|<\.\.\||\.\.\|>|<\.\.>|\.\.>|\*--|--\*|o--|--o|--|\.\.|-->|<--|<-->)$/.test(raw) ? raw : fallback;
    const fromId = safeId(sourceId(from), "Class"); const toId = safeId(sourceId(to), "Class");
    const visibleLabel = item.label?.text.trim().replace(/[\r\n]/g, " ") ?? "";
    const originalVisibleLabel = [relationMetadata?.fromCardinality, relationMetadata?.toCardinality, relationMetadata?.label].filter(Boolean).join(" · ");
    const label = visibleLabel === originalVisibleLabel ? relationMetadata?.label ?? "" : visibleLabel;
    lines.push(`  ${fromId} ${relationMetadata?.fromCardinality ? `${quotePlantUml(relationMetadata.fromCardinality)} ` : ""}${relation}${relationMetadata?.toCardinality ? ` ${quotePlantUml(relationMetadata.toCardinality)}` : ""} ${toId}${label ? ` : ${label}` : ""}`);
  }
  lines.push("@enduml");
  return lines.join("\n") + "\n";
}

function exportPlantUml(elements: Element[]) {
  if (elements.length === 1 && elements[0].type === "group" && elements[0].mermaid?.format === "plantuml" && elements[0].mermaid.diagramType === "sequence") return exportPlantUmlSequence(elements[0]);
  const advanced = exportPlantUmlAdvanced(elements);
  if (advanced !== undefined) return advanced;
  const editableClassDiagram = exportEditablePlantUmlClasses(elements);
  if (editableClassDiagram) return editableClassDiagram;
  const { nodes, edges } = diagramParts(elements);
  if (!nodes.length) throw new Error("Add at least one labeled shape or text item before exporting diagram code.");
  const lines = ["@startuml"];
  for (const node of nodes) {
    if (node.item.type === "schemaTable") {
      const fields = node.item.columns.map(field => `  ${field.name}: ${field.dataType}${field.primaryKey ? " <<PK>>" : ""}`);
      lines.push(`class "${escapeQuoted(node.item.name)}" as ${node.id} {`, ...fields, "}");
    } else lines.push(`object "${escapeQuoted(node.label)}" as ${node.id}`);
  }
  for (const edge of edges) lines.push(`  ${edge.from.id} ${edge.item.type === "arrow" || edge.item.endHead !== "none" ? "-->" : "--"} ${edge.to.id}${edge.label ? ` : ${edge.label.replace(/[\r\n]/g, " ")}` : ""}`);
  lines.push("@enduml");
  return lines.join("\n") + "\n";
}

function exportPlantUmlSequence(group: Extract<Element, { type: "group" }>) {
  const items = flatten(group.elements);
  const participants = group.elements.filter((item): item is GroupElement => item.type === "group" && item.componentRole?.startsWith("plantuml-sequence-participant:") === true).sort((a, b) => (a.componentBounds?.x ?? 0) - (b.componentBounds?.x ?? 0));
  if (!participants.length) throw new Error("This PlantUML sequence diagram has no editable participants to export.");
  const aliasOf = (item: GroupElement, index: number) => {
    const parts = (item.componentRole ?? "").slice("plantuml-sequence-participant:".length).split(":");
    try { return decodeURIComponent(parts.slice(1).join(":")) || "participant_" + (index + 1); } catch { return "participant_" + (index + 1); }
  };
  const aliases = new Map(participants.map((item, index) => [item.id!, safeId(aliasOf(item, index), "participant_" + (index + 1))]));
  const lines = ["@startuml"];
  participants.forEach((item, index) => {
    const kind = (item.componentRole ?? "").slice("plantuml-sequence-participant:".length).split(":")[0] || "participant";
    const alias = aliases.get(item.id!) || "participant_" + (index + 1);
    const label = item.elements.find((child): child is ShapeElement => child.type === "rectangle" && child.componentRole === "plantuml-sequence-header")?.label?.text ?? alias;
    lines.push(kind + " \"" + escapeQuoted(label) + "\" as " + alias);
  });
  const messages = items.filter((item): item is ShapeElement => item.type === "arrow" && item.componentRole?.startsWith("plantuml-sequence-message:") === true).sort((a, b) => a.y - b.y);
  for (const message of messages) {
    const from = message.startBinding?.elementId ? aliases.get(message.startBinding.elementId) : undefined;
    const to = message.endBinding?.elementId ? aliases.get(message.endBinding.elementId) : undefined;
    if (!from || !to) continue;
    const operator = (message.componentRole ?? "").slice("plantuml-sequence-message:".length) || (message.lineStyle === "dashed" ? "-->" : "->");
    lines.push("  " + from + " " + operator + " " + to + (message.label?.text ? " : " + message.label.text.replace(/[\r\n]/g, " ") : ""));
  }
  lines.push("@enduml");
  return lines.join("\n") + "\n";
}

export function exportDiagramCode(format: DiagramCodeFormat, elements: Element[], options: DiagramCodeExportOptions = {}) {
  switch (format) {
    case "mmd": return exportMermaid(elements);
    case "dot": return exportDot(elements);
    case "d2": return exportD2(elements);
    case "csv": return exportCsv(elements);
    case "sql": return exportSchema(diagramParts(elements).tables, "sql", options.sqlDialect ?? "postgresql");
    case "json": return exportSchema(diagramParts(elements).tables, "json");
    case "puml": return exportPlantUml(elements);
    case "bpmn": return exportBpmnXml(elements, options.bpmnContextElements);
    case "structurizr-json": return exportStructurizrWorkspaceJson(elements);
  }
}

export function isPlantUmlSequence(source: string) {
  if (detectPlantUmlFamily(source)) return false;
  const hasParticipant = /^(?:actor|participant|boundary|control|entity|database|collections|queue)\s+/im.test(source);
  const hasMessage = /^\s*[\w.-]+\s*(?:-->>|->>|-->|->|<--|<-)\s*[\w.-]+(?:\s*:.*)?$/m.test(source);
  const unambiguousMessage = /^\s*[\w.-]+\s*(?:->>|->|<-)\s*[\w.-]+(?:\s*:.*)?$/m.test(source);
  return hasMessage && (hasParticipant || unambiguousMessage);
}

export function isPlantUmlClassDiagram(source: string) {
  return /^\s*(?:abstract\s+)?(?:class|interface|enum|entity)\s+/im.test(source);
}

function plantUmlSequenceToDiagram(source: string): Element[] {
  type Participant = { id: string; label: string; kind: string; index: number };
  type Message = { from: string; to: string; operator: string; label: string };
  const participants = new Map<string, Participant>();
  const messages: Message[] = [];
  const lines = source.replace(/\r/g, "").split("\n");
  const ensureParticipant = (id: string, label = id, kind = "participant") => {
    const current = participants.get(id);
    if (current) {
      if (label !== id) current.label = label;
      if (kind !== "participant") current.kind = kind;
      return current;
    }
    if (participants.size >= 40) throw new Error("A PlantUML sequence diagram can contain up to 40 participants.");
    const participant = { id, label, kind, index: participants.size };
    participants.set(id, participant);
    return participant;
  };
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim();
    if (!line || line.startsWith("'") || /^@(?:startuml|enduml)\b/i.test(line)) continue;
    const declaration = /^(actor|participant|boundary|control|entity|database|collections|queue)\s+(?:"([^"]+)"(?:\s+as\s+([\w.-]+))?|([\w.-]+)(?:\s+as\s+([\w.-]+))?)$/i.exec(line);
    if (declaration) {
      const kind = declaration[1].toLowerCase();
      const label = declaration[2] ?? declaration[4] ?? "";
      const alias = declaration[3] ?? declaration[5] ?? safeId(label, "participant_" + (participants.size + 1));
      ensureParticipant(alias, label || alias, kind);
      continue;
    }
    if (/^(?:autonumber|hide\s+footbox|activate\s+|deactivate\s+|skinparam\s+)/i.test(line)) continue;
    const message = /^([\w.-]+)\s*(-->>|->>|-->|->|<--|<-)\s*([\w.-]+)(?:\s*:\s*(.*))?$/.exec(line);
    if (!message) throw new Error("Unsupported PlantUML sequence construct (line " + (lineIndex + 1) + ", column " + (Math.max(0, lines[lineIndex].search(/\S/)) + 1) + "): " + line.slice(0, 80));
    let from = message[1]; let to = message[3]; let operator = message[2];
    if (operator.startsWith("<")) {
      const previousFrom = from; from = to; to = previousFrom;
      operator = operator === "<--" ? "-->" : "->";
    }
    if (from === to) throw new Error("PlantUML self-messages are not supported yet (line " + (lineIndex + 1) + ", column " + (Math.max(0, lines[lineIndex].indexOf(from)) + 1) + ").");
    ensureParticipant(from); ensureParticipant(to);
    if (messages.length >= 500) throw new Error("A PlantUML sequence diagram can contain up to 500 messages.");
    messages.push({ from, to, operator, label: message[4] ?? "" });
  }
  if (!messages.length) throw new Error("Add at least one message to the PlantUML sequence diagram.");
  const ordered = [...participants.values()];
  const shapes = new Map<string, GroupElement>();
  const elements: Element[] = [];
  const left = 60; const gap = 210; const top = 20;
  ordered.forEach((participant, index) => {
    const x = left + index * gap;
    const id = "plantuml-sequence-participant-" + safeId(participant.id, String(index + 1)) + "-" + (index + 1);
    const height = Math.max(78, messages.length * 58 + 24);
    const header: ShapeElement = {
      type: "rectangle", id: id + "-header", componentRole: "plantuml-sequence-header",
      x, y: top, w: 150, h: 42, color: "#657f98", thickness: 1.5, fillColor: "#f3f7fb",
      label: { text: participant.label, color: "#33495d", fontSize: 13, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" },
    };
    const lifeline: ShapeElement = { type: "line", id: id + "-lifeline", x: x + 75, y: top + 42, w: 0, h: height, color: "#9aa9b8", thickness: 1, lineStyle: "dashed" };
    const group: GroupElement = {
      type: "group", id, liveKey: participant.id, componentRole: "plantuml-sequence-participant:" + participant.kind + ":" + encodeURIComponent(participant.id),
      elements: [lifeline, header], componentBounds: { x, y: top, w: 150, h: 42 + height },
      container: { kind: "container", name: participant.label, showBorder: false, showLabel: false, clipChildren: false, autoResize: false, padding: 0 },
    };
    shapes.set(participant.id, group);
    elements.push(group);
  });
  messages.forEach((message, index) => {
    const from = shapes.get(message.from)!; const to = shapes.get(message.to)!; const fromBounds = from.componentBounds!; const toBounds = to.componentBounds!;
    const forward = fromBounds.x < toBounds.x; const y = top + 86 + index * 58; const startAnchor = { x: forward ? 1 : 0, y: (y - fromBounds.y) / fromBounds.h }; const endAnchor = { x: forward ? 0 : 1, y: (y - toBounds.y) / toBounds.h };
    const startX = fromBounds.x + fromBounds.w * startAnchor.x; const endX = toBounds.x + toBounds.w * endAnchor.x;
    elements.push({
      type: "arrow", id: "plantuml-sequence-message-" + (index + 1), componentRole: "plantuml-sequence-message:" + message.operator,
      x: startX, y, w: endX - startX, h: 0, color: "#71869b", thickness: 1.5,
      lineStyle: message.operator.startsWith("--") ? "dashed" : "solid", endHead: message.operator.endsWith(">>") ? "open" : "solid",
      startBinding: { elementId: from.id!, anchor: startAnchor }, endBinding: { elementId: to.id!, anchor: endAnchor },
      ...(message.label ? { label: { text: message.label, color: "#52697e", fontSize: 12, fontFamily: "sans" as const, bold: false, italic: false, underline: false, textAlign: "center" as const, listType: "none" as const, verticalAlign: "top" as const } } : {}),
    });
  });
  return elements;
}

/** Import the editable class/object and sequence subsets emitted by exportPlantUml. */
export function plantUmlToDiagram(source: string): Element[] {
  if (source.length > 100_000) throw new Error("PlantUML input is limited to 100,000 characters.");
  if (detectPlantUmlFamily(source)) return plantUmlAdvancedToDiagram(source);
  if (!/@startuml\b/i.test(source) || !/@enduml\b/i.test(source)) throw new Error("PlantUML files need @startuml and @enduml markers.");
  if (isPlantUmlSequence(source)) return plantUmlSequenceToDiagram(source);
  type Node = { id: string; label: string; fields: string[] };
  const nodes = new Map<string, Node>(); const edges: { from: string; to: string; label: string; operator: string; fromCardinality?: string; toCardinality?: string }[] = [];
  const lines = source.replace(/\r/g, "").split("\n");
  let block: Node | undefined;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const raw = lines[lineIndex];
    const line = raw.trim();
    if (!line || line.startsWith("'" ) || /^@(?:startuml|enduml)\b/i.test(line)) continue;
    if (block) {
      if (line === "}") { block = undefined; continue; }
      if (block.fields.length >= 100) throw new Error("A PlantUML class can contain up to 100 fields.");
      block.fields.push(line);
      continue;
    }
    const declaration = /^(?:abstract\s+)?(?:class|entity|object|rectangle|component|interface|enum|annotation|database|queue)\s+(?:"([^"]+)"\s+as\s+)?([A-Za-z_][\w.-]*)(?:\s*\{)?\s*$/i.exec(line);
    if (declaration) {
      const alias = declaration[2];
      if (nodes.has(alias)) throw new Error(`Duplicate PlantUML element: ${alias}`);
      const node = { id: alias, label: declaration[1] ?? alias, fields: [] as string[] };
      nodes.set(alias, node);
      if (line.endsWith("{")) block = node;
      continue;
    }
    const cardinality = /^([A-Za-z_][\w.-]*)\s+"([^"]+)"\s*(<\|\.\.|<\|--|\.\.\|>|\*--|--\*|o--|--o|<-->|<--|-->|\.\.>|--|\.\.|\*)\s*"([^"]+)"\s*([A-Za-z_][\w.-]*)(?:\s*:\s*(.*))?$/.exec(line);
    if (cardinality) {
      if (edges.length >= 500) throw new Error("A PlantUML import can contain up to 500 relationships.");
      const [, from, leftCardinality, operator, rightCardinality, to, label = ""] = cardinality;
      for (const id of [from, to]) if (!nodes.has(id)) nodes.set(id, { id, label: id, fields: [] });
      edges.push({ from, to, operator, fromCardinality: leftCardinality, toCardinality: rightCardinality, label });
      continue;
    }
    const relationship = /^([A-Za-z_][\w.-]*)\s*(<\|\.\.|<\|--|\.\.\|>|\*--|--\*|o--|--o|<-->|<--|-->|\.\.>|--|\.\.|\*)\s*([A-Za-z_][\w.-]*)(?:\s*:\s*(.*))?$/.exec(line);
    if (relationship) {
      if (edges.length >= 500) throw new Error("A PlantUML import can contain up to 500 relationships.");
      const [, from, operator, to, label = ""] = relationship;
      for (const id of [from, to]) if (!nodes.has(id)) nodes.set(id, { id, label: id, fields: [] });
      edges.push({ from, to, label, operator });
      continue;
    }
    throw new Error(`Unsupported PlantUML construct on line ${lineIndex + 1}: “${line.slice(0, 80)}”. This importer currently supports class, entity, object, rectangle, component, members, and common relationships.`);
  }
  if (block) throw new Error("Close each PlantUML class body with }.");
  if (!nodes.size) throw new Error("Add at least one class, object, or relationship to the PlantUML file.");
  if (nodes.size > 200) throw new Error("A PlantUML import can contain up to 200 elements.");
  const entries = [...nodes.values()];
  return layoutEditableClassDiagram(entries.map(node => ({
    id: node.id, label: node.label,
    attributes: node.fields.filter(member => !member.includes("(")),
    methods: node.fields.filter(member => member.includes("(")),
  })), edges, { x: 0, y: 0 });
}
