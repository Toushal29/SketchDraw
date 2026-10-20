import type { Element, GroupElement, ShapeElement } from "../../model";

type NodeRecord = { id: string; label: string; groupPath: string[]; shape: string; fill?: string; stroke?: string };
type GroupRecord = { id: string; label: string; parent?: GroupRecord; groups: GroupRecord[]; nodes: NodeRecord[] };
type EdgeRecord = { from: string; to: string; label: string; direction: "forward" | "reverse" | "both" | "none"; dotted?: boolean };
const safeId = (value: string) => value.replace(/[^A-Za-z0-9_]/g, "_").replace(/^[^A-Za-z_]+/, "") || "node";
function uniqueElementId(prefix: string, value: string, used: Set<string>) {
  const base = `${prefix}-${safeId(value)}`.slice(0, 94);
  let id = base; let suffix = 2;
  while (used.has(id)) {
    const tail = `-${suffix++}`;
    id = `${base.slice(0, 100 - tail.length)}${tail}`;
  }
  used.add(id);
  return id;
}
const decodeLabel = (value: string) => {
  const text = value.trim();
  if (text.startsWith('"') && text.endsWith('"')) {
    try { return JSON.parse(text) as string; } catch { return text.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\"); }
  }
  return text;
};

/** Import a deliberately bounded D2 subset with nodes, groups, labels, fill colors, and edges. */
export function d2ToDiagram(source: string): Element[] {
  if (source.length > 500_000) throw new Error("D2 input is limited to 500 KB.");
  const root: GroupRecord = { id: "root", label: "", groups: [], nodes: [] };
  const stack: GroupRecord[] = [root];
  const records = new Map<string, NodeRecord>();
  const groupIds = new Set<string>();
  const usedSourceIds = new Set<string>();
  const edgeRows: EdgeRecord[] = [];
  const styles = new Map<string, { shape?: string; fill?: string; stroke?: string }>();
  let nodeCount = 0;
  const lines = source.replace(/\r/g, "").split("\n");
  if (lines.length > 10_000) throw new Error("D2 diagrams are limited to 10,000 lines.");
  for (const [lineIndex, raw] of lines.entries()) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line === "}") { if (stack.length === 1) throw new Error(`Unexpected closing brace on line ${lineIndex + 1}.`); stack.pop(); continue; }
    const group = /^([A-Za-z_][\w.-]{0,119})\s*:\s*\{\s*$/.exec(line);
    if (group) {
      const parent = stack[stack.length - 1];
      if (usedSourceIds.has(group[1])) throw new Error(`D2 ID “${group[1]}” is already in use.`);
      if (groupIds.size >= 100) throw new Error("D2 diagrams are limited to 100 groups.");
      if (stack.length >= 33) throw new Error("D2 groups can be nested up to 32 levels deep.");
      groupIds.add(group[1]); usedSourceIds.add(group[1]);
      const next: GroupRecord = { id: group[1], label: group[1], parent, groups: [], nodes: [] };
      parent.groups.push(next); stack.push(next); continue;
    }
    const edge = /^([A-Za-z_][\w.-]{0,119})\s*(<->|->|-->|--|<--|<-|\.\.>)\s*([A-Za-z_][\w.-]{0,119})(?:\s*:\s*(.+))?$/.exec(line);
    if (edge) {
      if (edgeRows.length >= 5000) throw new Error("D2 diagrams are limited to 5,000 connectors.");
      const [, from, operator, to, rawLabel = ""] = edge;
      edgeRows.push({
        from, to, label: decodeLabel(rawLabel),
        direction: operator === "--" ? "none" : operator === "<->" ? "both" : operator === "<--" || operator === "<-" ? "reverse" : "forward",
        dotted: operator === "..>",
      });
      continue;
    }
    const style = /^([A-Za-z_][\w.-]{0,119})\.(shape|style\.fill|style\.stroke)\s*:\s*(.+)$/.exec(line);
    if (style) {
      const value = decodeLabel(style[3]); const current = styles.get(style[1]) ?? {};
      if (style[2] === "shape") current.shape = value.toLowerCase();
      else if (style[2] === "style.fill" && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value)) current.fill = value;
      else if (style[2] === "style.stroke" && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value)) current.stroke = value;
      styles.set(style[1], current); continue;
    }
    const node = /^([A-Za-z_][\w.-]{0,119})\s*:\s*(.+)$/.exec(line);
    if (node) {
      const [, id, rawLabel] = node;
      if (!records.has(id)) {
        if (groupIds.has(id)) throw new Error(`D2 ID “${id}” is already used by a group.`);
        if (++nodeCount > 500) throw new Error("D2 diagrams are limited to 500 nodes.");
        // Reserving the ID here keeps later groups from silently colliding.
        usedSourceIds.add(id);
        const groupPath = stack.slice(1).map(item => item.id);
        const record: NodeRecord = { id, label: decodeLabel(rawLabel), groupPath, shape: "rectangle" };
        records.set(id, record); stack[stack.length - 1].nodes.push(record);
      } else records.get(id)!.label = decodeLabel(rawLabel);
      continue;
    }
    throw new Error(`Unsupported D2 syntax on line ${lineIndex + 1}: ${line.slice(0, 100)}`);
  }
  if (stack.length !== 1) throw new Error(`D2 group “${stack[stack.length - 1].id}” is missing a closing brace.`);
  for (const endpoint of new Set(edgeRows.flatMap(edge => [edge.from, edge.to]))) if (!records.has(endpoint)) {
    if (groupIds.has(endpoint)) throw new Error(`D2 edges to group “${endpoint}” are not supported yet.`);
    if (++nodeCount > 500) throw new Error("D2 diagrams are limited to 500 nodes.");
    usedSourceIds.add(endpoint);
    const record: NodeRecord = { id: endpoint, label: endpoint, groupPath: [], shape: "rectangle" };
    records.set(endpoint, record); root.nodes.push(record);
  }
  if (!records.size && !root.groups.length) throw new Error("No D2 nodes or groups were found.");
  for (const [id, style] of styles) if (records.has(id)) { records.get(id)!.shape = style.shape ?? "rectangle"; records.get(id)!.fill = style.fill; records.get(id)!.stroke = style.stroke; }

  const allNodes = [...records.values()];
  const columns = Math.max(1, Math.ceil(Math.sqrt(allNodes.length)));
  const shapes = new Map<string, ShapeElement>();
  const usedElementIds = new Set<string>();
  allNodes.forEach((node, index) => {
    const shape = node.shape.includes("circle") || node.shape.includes("oval") ? "circle" : node.shape.includes("diamond") ? "diamond" : "rectangle";
    const width = Math.max(140, Math.min(320, 52 + node.label.split(/\n/).reduce((max, part) => Math.max(max, part.length), 0) * 7));
    const height = Math.max(72, 40 + node.label.split(/\n/).length * 22);
    shapes.set(node.id, { type: shape, id: uniqueElementId("d2", node.id, usedElementIds), x: (index % columns) * 290, y: Math.floor(index / columns) * 180, w: width, h: height, color: node.stroke ?? "#64748b", thickness: 2, fillColor: node.fill ?? "#ffffff", label: { text: node.label || node.id, color: "#172033", fontSize: 14, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } });
  });
  const groups: GroupElement[] = [];
  const buildGroup = (record: GroupRecord): GroupElement => ({ type: "group", id: `d2-group-${safeId(record.id)}`, elements: [...record.groups.map(buildGroup), ...record.nodes.flatMap(node => { const shape = shapes.get(node.id); return shape ? [shape] : []; })] });
  groups.push(...root.groups.map(buildGroup));
  const anchorToward = (from: ShapeElement, to: ShapeElement) => { const dx = to.x + to.w / 2 - from.x - from.w / 2; const dy = to.y + to.h / 2 - from.y - from.h / 2; return Math.abs(dx) > Math.abs(dy) ? { x: dx > 0 ? 1 : 0, y: .5 } : { x: .5, y: dy > 0 ? 1 : 0 }; };
  const connectors: ShapeElement[] = edgeRows.flatMap((edge, index) => {
    const fromId = edge.direction === "reverse" ? edge.to : edge.from;
    const toId = edge.direction === "reverse" ? edge.from : edge.to;
    const from = shapes.get(fromId); const to = shapes.get(toId);
    if (!from || !to) return [];
    const start = anchorToward(from, to); const end = anchorToward(to, from);
    const connectorType = edge.direction === "none" ? "line" : "arrow";
    return [{ type: connectorType, id: uniqueElementId("d2-edge", String(index + 1), usedElementIds), x: from.x + from.w * start.x, y: from.y + from.h * start.y, w: to.x + to.w * end.x - from.x - from.w * start.x, h: to.y + to.h * end.y - from.y - from.h * start.y, color: "#64748b", thickness: 2, ...(connectorType === "line" ? { lineRoute: "elbow" as const } : { arrowRoute: "elbow" as const, startHead: edge.direction === "both" ? "solid" as const : "none" as const, endHead: "solid" as const }), ...(edge.dotted ? { lineStyle: "dotted" as const } : {}), startBinding: { elementId: from.id!, anchor: start }, endBinding: { elementId: to.id!, anchor: end }, ...(edge.label ? { label: { text: edge.label, color: "#475569", fontSize: 12, fontFamily: "sans" as const, bold: false, italic: false, underline: false, textAlign: "center" as const, listType: "none" as const, verticalAlign: "top" as const } } : {}) } as ShapeElement];
  });
  const groupedIds = new Set([...root.groups.flatMap(function visit(group): string[] { return [...group.nodes.map(node => node.id), ...group.groups.flatMap(visit)]; })]);
  const assignGroupIds = (group: GroupElement, record: GroupRecord): GroupElement => ({ ...group, id: uniqueElementId("d2-group", record.id, usedElementIds), elements: [...record.groups.map((child, index) => assignGroupIds(group.elements[index] as GroupElement, child)), ...record.nodes.flatMap(node => { const shape = shapes.get(node.id); return shape ? [shape] : []; })] });
  const identifiedGroups = root.groups.map((record, index) => assignGroupIds(groups[index], record));
  return [...connectors, ...identifiedGroups, ...allNodes.filter(node => !groupedIds.has(node.id)).flatMap(node => { const shape = shapes.get(node.id); return shape ? [shape] : []; })];
}
