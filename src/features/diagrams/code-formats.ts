import type { Element, SchemaTableElement, ShapeElement } from "../../model";

export type DiagramCodeFormat = "mmd" | "dot" | "d2" | "csv" | "sql" | "json" | "puml";

const flatten = (elements: Element[]): Element[] => elements.flatMap(element => element.hidden ? [] : element.type === "group" ? [...(element.libraryComponent?.kind === "uml-lifeline" ? [element] : []), ...flatten(element.elements)] : [element]);
const safeId = (value: string, fallback: string) => {
  const id = value.replace(/[^A-Za-z0-9_]/g, "_").replace(/^[^A-Za-z_]+/, "");
  return id || fallback;
};
const escapeMermaid = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\r?\n/g, "<br/>");
const escapeQuoted = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\r?\n/g, "\\n");
const quoteSql = (value: string) => `"${value.replace(/"/g, '""')}"`;
const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const isConnector = (item: Element): item is ShapeElement => item.type === "line" || item.type === "arrow";
type DiagramNodeElement = SchemaTableElement | Extract<Element, { type: "text" }> | ShapeElement | Extract<Element, { type: "group" }>;
const isNode = (item: Element): item is DiagramNodeElement => item.type === "schemaTable" || item.type === "text" || item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "triangle" || item.type === "flowchart" || item.type === "group" && item.libraryComponent?.kind === "uml-lifeline";
const nodeLabel = (item: Element) => item.type === "schemaTable" ? `${item.name}\n${item.columns.map(field => `${field.name}: ${field.dataType}${field.primaryKey ? " (PK)" : ""}`).join("\n")}` : item.type === "text" ? item.text : item.type === "group" ? item.libraryComponent?.label ?? "Participant" : item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "triangle" || item.type === "flowchart" ? item.label?.text ?? item.flowchartShape ?? item.type : "";
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

function exportDot(elements: Element[]) {
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

function exportD2(elements: Element[]) {
  const { nodes, edges } = diagramParts(elements);
  if (!nodes.length) throw new Error("Add at least one labeled shape or text item before exporting diagram code.");
  const lines: string[] = [];
  const nodeByElement = new Map(nodes.map(node => [node.item, node]));
  const used = new Set(nodes.map(node => node.id));
  let groupSequence = 0;
  const writeNodes = (items: Element[], depth: number) => {
    const indent = "  ".repeat(depth);
    for (const item of items) {
      if (item.hidden) continue;
      if (item.type === "group" && item.libraryComponent?.kind !== "uml-lifeline") {
        const base = safeId(item.libraryComponent?.label ?? item.note?.title ?? `group_${++groupSequence}`, `group_${groupSequence}`);
        let id = base; let suffix = 2;
        while (used.has(id)) id = `${base}_${suffix++}`;
        used.add(id);
        lines.push(`${indent}${id}: {`);
        writeNodes(item.elements, depth + 1);
        lines.push(`${indent}}`);
        continue;
      }
      if (!isNode(item)) continue;
      const node = nodeByElement.get(item);
      if (!node) continue;
      lines.push(`${indent}${node.id}: ${JSON.stringify(node.label)}`);
      const shape = item.type === "circle" ? "oval" : item.type === "diamond" ? "diamond" : "rectangle";
      const fill = item.type === "schemaTable" || item.type === "group" ? "#ffffff" : item.type === "text" ? undefined : item.fillColor;
      const stroke = item.type === "schemaTable" || item.type === "group" ? "#9ca3af" : item.type === "text" ? undefined : item.color;
      lines.push(`${indent}${node.id}.shape: ${shape}`);
      if (fill) lines.push(`${indent}${node.id}.style.fill: ${JSON.stringify(fill)}`);
      if (stroke) lines.push(`${indent}${node.id}.style.stroke: ${JSON.stringify(stroke)}`);
    }
  };
  writeNodes(elements, 0);
  if (edges.length) lines.push("");
  for (const edge of edges) {
    const item = edge.item;
    const operator = item.startHead && item.startHead !== "none" ? "<->" : "->";
    lines.push(`  ${edge.from.id} ${operator} ${edge.to.id}${edge.label ? `: ${JSON.stringify(edge.label)}` : ""}`);
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

function exportSchema(tables: SchemaTableElement[], format: "sql" | "json") {
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
      return { id, table, schema: { title: table.name, type: "object", properties, required, additionalProperties: false, ...(table.indexes?.length ? { "x-sketchdraw-indexes": table.indexes } : {}), ...(table.constraints?.length ? { "x-sketchdraw-constraints": table.constraints } : {}) } };
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
  return tables.map(table => {
    const constraints = table.constraints ?? [];
    const tablePrimaryKey = constraints.some(item => item.kind === "primary-key");
    const foreignKeyColumns = new Set(constraints.filter(item => item.kind === "foreign-key").flatMap(item => item.columns ?? []));
    const columns = table.columns.map(field => {
      const parts = [`  ${quoteSql(field.name)} ${field.dataType || "TEXT"}`, ...(!tablePrimaryKey && field.primaryKey ? ["PRIMARY KEY"] : []), ...(field.nullable === false || field.primaryKey ? ["NOT NULL"] : []), ...(!foreignKeyColumns.has(field.name) && field.foreignTable ? [`REFERENCES ${quoteSql(field.foreignTable)} (${quoteSql(field.foreignColumn || "id")})`] : [])];
      return parts.join(" ");
    });
    const tableConstraints = constraints.flatMap(constraint => {
      const prefix = constraint.name ? `CONSTRAINT ${quoteSql(constraint.name)} ` : "";
      const list = (constraint.columns ?? []).map(quoteSql).join(", ");
      if (constraint.kind === "primary-key" && list) return [`  ${prefix}PRIMARY KEY (${list})`];
      if (constraint.kind === "unique" && list) return [`  ${prefix}UNIQUE (${list})`];
      if (constraint.kind === "check" && constraint.expression) return [`  ${prefix}CHECK (${constraint.expression})`];
      if (constraint.kind === "foreign-key" && list && constraint.referencedTable) return [`  ${prefix}FOREIGN KEY (${list}) REFERENCES ${quoteSql(constraint.referencedTable)} (${(constraint.referencedColumns ?? []).map(quoteSql).join(", ") || quoteSql("id")})`];
      return [];
    });
    const definition = `CREATE TABLE ${quoteSql(table.name)} (\n${[...columns, ...tableConstraints].join(",\n")}\n);`;
    const indexes = (table.indexes ?? []).map(index => `CREATE ${index.unique ? "UNIQUE " : ""}INDEX ${quoteSql(index.name)} ON ${quoteSql(table.name)} (${index.columns.map(quoteSql).join(", ")})${index.expression ? ` ${index.expression}` : ""};`);
    return [definition, ...indexes].join("\n");
  }).join("\n\n") + "\n";
}

function exportPlantUml(elements: Element[]) {
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

export function exportDiagramCode(format: DiagramCodeFormat, elements: Element[]) {
  switch (format) {
    case "mmd": return exportMermaid(elements);
    case "dot": return exportDot(elements);
    case "d2": return exportD2(elements);
    case "csv": return exportCsv(elements);
    case "sql": return exportSchema(diagramParts(elements).tables, "sql");
    case "json": return exportSchema(diagramParts(elements).tables, "json");
    case "puml": return exportPlantUml(elements);
  }
}

/** Import the editable class/object and relationship subset emitted by exportPlantUml. */
export function plantUmlToDiagram(source: string): Element[] {
  if (source.length > 100_000) throw new Error("PlantUML input is limited to 100,000 characters.");
  if (!/@startuml\b/i.test(source) || !/@enduml\b/i.test(source)) throw new Error("PlantUML files need @startuml and @enduml markers.");
  type Node = { id: string; label: string; fields: string[] };
  const nodes = new Map<string, Node>(); const edges: { from: string; to: string; label: string }[] = [];
  const lines = source.replace(/\r/g, "").split("\n");
  let block: Node | undefined;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const raw = lines[lineIndex];
    const line = raw.trim();
    if (!line || line.startsWith("'" ) || /^@(?:startuml|enduml)\b/i.test(line)) continue;
    if (block) {
      if (line === "}") { block = undefined; continue; }
      if (block.fields.length >= 100) throw new Error("A PlantUML class can contain up to 100 fields.");
      block.fields.push(line.replace(/^[+\-#~]\s*/, ""));
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
    const cardinality = /^([A-Za-z_][\w.-]*)\s+"([^"]+)"\s*(<\|\.\.|<\|--|\.\.\|>|\*--|o--|<-->|<--|-->|\.\.>|--|\.\.|\*)\s*"([^"]+)"\s*([A-Za-z_][\w.-]*)(?:\s*:\s*(.*))?$/.exec(line);
    if (cardinality) {
      if (edges.length >= 500) throw new Error("A PlantUML import can contain up to 500 relationships.");
      const [, from, leftCardinality, , rightCardinality, to, label = ""] = cardinality;
      for (const id of [from, to]) if (!nodes.has(id)) nodes.set(id, { id, label: id, fields: [] });
      edges.push({ from, to, label: [leftCardinality, rightCardinality, label].filter(Boolean).join(" · ") });
      continue;
    }
    const relationship = /^([A-Za-z_][\w.-]*)\s*(?:<\|\.\.|<\|--|\.\.\|>|\*--|o--|<-->|<--|-->|\.\.>|--|\.\.|\*)\s*([A-Za-z_][\w.-]*)(?:\s*:\s*(.*))?$/.exec(line);
    if (relationship) {
      if (edges.length >= 500) throw new Error("A PlantUML import can contain up to 500 relationships.");
      const [, from, to, label = ""] = relationship;
      for (const id of [from, to]) if (!nodes.has(id)) nodes.set(id, { id, label: id, fields: [] });
      edges.push({ from, to, label });
      continue;
    }
    throw new Error(`Unsupported PlantUML construct on line ${lineIndex + 1}: “${line.slice(0, 80)}”. This importer currently supports class, entity, object, rectangle, component, members, and common relationships.`);
  }
  if (block) throw new Error("Close each PlantUML class body with }.");
  if (!nodes.size) throw new Error("Add at least one class, object, or relationship to the PlantUML file.");
  if (nodes.size > 200) throw new Error("A PlantUML import can contain up to 200 elements.");
  const entries = [...nodes.values()];
  const columns = Math.max(1, Math.ceil(Math.sqrt(entries.length)));
  const shapes = new Map<string, ShapeElement>();
  entries.forEach((node, index) => {
    const text = [node.label, ...node.fields].join("\n");
    const width = Math.max(150, Math.min(320, 40 + Math.max(...text.split("\n").map(line => line.length), 0) * 8));
    const height = Math.max(72, 44 + text.split("\n").length * 22);
    shapes.set(node.id, { type: "rectangle", id: `plantuml-${safeId(node.id, String(index + 1))}`, x: (index % columns) * 300, y: Math.floor(index / columns) * 210, w: width, h: height, color: "#4b5563", thickness: 2, fillColor: "#ffffff", label: { text, color: "#111827", fontSize: 15, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "middle" } });
  });
  const anchor = (from: ShapeElement, to: ShapeElement) => {
    const dx = to.x + to.w / 2 - (from.x + from.w / 2); const dy = to.y + to.h / 2 - (from.y + from.h / 2);
    return Math.abs(dx) > Math.abs(dy) ? { x: dx > 0 ? 1 : 0, y: .5 } : { x: .5, y: dy > 0 ? 1 : 0 };
  };
  const connectors = edges.map((edge, index) => {
    const from = shapes.get(edge.from)!; const to = shapes.get(edge.to)!; const start = anchor(from, to); const end = anchor(to, from);
    return { type: "arrow", id: `plantuml-link-${index + 1}`, x: from.x + from.w * start.x, y: from.y + from.h * start.y, w: to.x + to.w * end.x - (from.x + from.w * start.x), h: to.y + to.h * end.y - (from.y + from.h * start.y), color: "#6b7280", thickness: 2, startHead: "none", endHead: "solid", startBinding: { elementId: from.id!, anchor: start }, endBinding: { elementId: to.id!, anchor: end }, ...(edge.label ? { label: { text: edge.label, color: "#4b5563", fontSize: 13, fontFamily: "sans" as const, bold: false, italic: false, underline: false, textAlign: "center" as const, listType: "none" as const, verticalAlign: "top" as const } } : {}) } as ShapeElement;
  });
  return [...connectors, ...shapes.values()];
}
