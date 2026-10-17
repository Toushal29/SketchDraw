import type { Element, SchemaTableElement, ShapeElement } from "../../model";

export type DiagramCodeFormat = "mmd" | "dot" | "csv" | "sql" | "json" | "puml";

const flatten = (elements: Element[]): Element[] => elements.flatMap(element => element.hidden ? [] : element.type === "group" ? flatten(element.elements) : [element]);
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
type DiagramNodeElement = SchemaTableElement | Extract<Element, { type: "text" }> | ShapeElement;
const isNode = (item: Element): item is DiagramNodeElement => item.type === "schemaTable" || item.type === "text" || item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "triangle" || item.type === "flowchart";
const nodeLabel = (item: Element) => item.type === "schemaTable" ? `${item.name}\n${item.columns.map(field => `${field.name}: ${field.dataType}${field.primaryKey ? " (PK)" : ""}`).join("\n")}` : item.type === "text" ? item.text : item.type === "group" ? "" : item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "triangle" || item.type === "flowchart" ? item.label?.text ?? item.flowchartShape ?? item.type : "";
type CodeNode = { item: DiagramNodeElement; id: string; label: string };
type CodeEdge = { item: ShapeElement; from: CodeNode; to: CodeNode; label: string };

function diagramParts(elements: Element[]) {
  const visible = flatten(elements);
  const used = new Set<string>();
  const nodes: CodeNode[] = visible.filter(isNode).map((item, index) => {
    const base = safeId(item.id ?? "", `node_${index + 1}`);
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
      const cx = item.type === "text" ? item.x : item.x + item.w / 2;
      const cy = item.type === "text" ? item.y : item.y + item.h / 2;
      const distance = (cx - x) ** 2 + (cy - y) ** 2;
      return distance < best.distance ? { node, distance } : best;
    }, { node: nodes[0], distance: Infinity }).node;
  };
  const edges: CodeEdge[] = visible.filter(isConnector).flatMap(item => {
    const from = findEndpoint(item, "start"); const to = findEndpoint(item, "end");
    return from && to ? [{ item, from, to, label: item.label?.text ?? "" }] : [];
  });
  return { nodes, edges, tables: visible.filter((item): item is SchemaTableElement => item.type === "schemaTable") };
}

function exportMermaid(elements: Element[]) {
  const { nodes, edges } = diagramParts(elements);
  if (!nodes.length) throw new Error("Add at least one labeled shape or text item before exporting diagram code.");
  const definition = (node: CodeNode) => {
    const label = `"${escapeMermaid(node.label)}"`;
    if (node.item.type === "circle") return `${node.id}((${label}))`;
    if (node.item.type === "diamond") return `${node.id}{${label}}`;
    if (node.item.type === "rectangle" && node.item.edgeStyle === "pill") return `${node.id}([${label}])`;
    return `${node.id}[${label}]`;
  };
  const lines = ["flowchart TD", ...nodes.map(node => `  ${definition(node)}`)];
  for (const edge of edges) {
    const item = edge.item;
    const operator = item.lineStyle === "dotted" ? "-.->" : item.thickness >= 3 ? "==>" : item.startHead && item.startHead !== "none" ? "<-->" : item.type === "arrow" || (item.endHead && item.endHead !== "none") ? "-->" : "---";
    lines.push(`  ${edge.from.id} ${operator}${edge.label ? `|${escapeMermaid(edge.label)}|` : ""} ${edge.to.id}`);
  }
  return lines.join("\n") + "\n";
}

function exportDot(elements: Element[]) {
  const { nodes, edges } = diagramParts(elements);
  if (!nodes.length) throw new Error("Add at least one labeled shape or text item before exporting diagram code.");
  const lines = ["digraph SketchDraw {", "  rankdir=TB;"];
  for (const node of nodes) {
    const item = node.item;
    const shape = item.type === "circle" ? "ellipse" : item.type === "diamond" ? "diamond" : item.type === "schemaTable" ? "record" : "box";
    const color = item.type === "schemaTable" ? "#9ca3af" : item.color;
    const fill = item.type === "schemaTable" ? "#ffffff" : item.type === "text" ? "none" : item.fillColor ?? "#ffffff";
    lines.push(`  ${node.id} [label="${escapeQuoted(node.label)}", shape=${shape}, color="${escapeQuoted(color)}", fillcolor="${escapeQuoted(fill)}", style=filled];`);
  }
  for (const edge of edges) {
    const item = edge.item;
    const style = item.lineStyle === "dotted" ? "dotted" : item.lineStyle === "dashed" ? "dashed" : "solid";
    const dir = item.startHead && item.startHead !== "none" ? "both" : item.type === "arrow" || (item.endHead && item.endHead !== "none") ? "forward" : "none";
    lines.push(`  ${edge.from.id} -> ${edge.to.id} [${edge.label ? `label="${escapeQuoted(edge.label)}", ` : ""}style=${style}, dir=${dir}];`);
  }
  return lines.join("\n") + "\n}\n";
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
      return { id, table, schema: { title: table.name, type: "object", properties, required, additionalProperties: false } };
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
    const columns = table.columns.map(field => {
      const parts = [`  ${quoteSql(field.name)} ${field.dataType || "TEXT"}`, ...(field.primaryKey ? ["PRIMARY KEY"] : []), ...(field.nullable === false || field.primaryKey ? ["NOT NULL"] : []), ...(field.foreignTable ? [`REFERENCES ${quoteSql(field.foreignTable)} (${quoteSql(field.foreignColumn || "id")})`] : [])];
      return parts.join(" ");
    });
    return `CREATE TABLE ${quoteSql(table.name)} (\n${columns.join(",\n")}\n);`;
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
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("'" ) || /^@(?:startuml|enduml)\b/i.test(line)) continue;
    if (block) {
      if (line === "}") { block = undefined; continue; }
      if (block.fields.length >= 100) throw new Error("A PlantUML class can contain up to 100 fields.");
      block.fields.push(line.replace(/^[+\-#~]\s*/, ""));
      continue;
    }
    const declaration = /^(?:class|entity|object|rectangle|component)\s+(?:"([^"]+)"\s+as\s+)?([A-Za-z_][\w.-]*)(?:\s*\{)?\s*$/i.exec(line);
    if (declaration) {
      const alias = declaration[2];
      if (nodes.has(alias)) throw new Error(`Duplicate PlantUML element: ${alias}`);
      const node = { id: alias, label: declaration[1] ?? alias, fields: [] as string[] };
      nodes.set(alias, node);
      if (line.endsWith("{")) block = node;
      continue;
    }
    const relationship = /^([A-Za-z_][\w.-]*)\s*(?:<\|\.\.|\*--|o--|<-->|<--|-->|\.\.>|--|\.\.|\*)\s*([A-Za-z_][\w.-]*)(?:\s*:\s*(.*))?$/.exec(line);
    if (relationship) {
      if (edges.length >= 500) throw new Error("A PlantUML import can contain up to 500 relationships.");
      const [, from, to, label = ""] = relationship;
      for (const id of [from, to]) if (!nodes.has(id)) nodes.set(id, { id, label: id, fields: [] });
      edges.push({ from, to, label });
    }
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
