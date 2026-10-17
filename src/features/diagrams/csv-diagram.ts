import type { Element, ShapeElement } from "../../model";

type CsvTable = { headers: string[]; rows: string[][] };
const MAX_CSV_CELL = 50_000;
const id = () => `csv-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;

/** Small RFC-4180 style reader with row and input limits for local CSV files. */
export function parseCsv(source: string): CsvTable {
  if (source.length > 5_000_000) throw new Error("CSV input is limited to 5 MB.");
  const rows: string[][] = []; let row: string[] = []; let field = ""; let quoted = false;
  const input = source.replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
      if (field.length > MAX_CSV_CELL) throw new Error("CSV cells are limited to 50,000 characters.");
      continue;
    }
    if (char === '"' && field.length === 0) { quoted = true; continue; }
    if (char === ",") { row.push(field.trim()); field = ""; if (row.length >= 100) throw new Error("CSV diagrams are limited to 100 columns."); continue; }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index++;
      row.push(field.trim()); field = "";
      if (row.some(value => value.length)) rows.push(row);
      row = [];
      if (rows.length > 10_001) throw new Error("CSV diagrams are limited to 10,000 data rows.");
      continue;
    }
    field += char;
    if (field.length > MAX_CSV_CELL) throw new Error("CSV cells are limited to 50,000 characters.");
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  row.push(field.trim()); if (row.some(value => value.length)) rows.push(row);
  if (rows.length < 2) throw new Error("CSV needs a header row and at least one data row.");
  if (rows[0].length > 100) throw new Error("CSV diagrams are limited to 100 columns.");
  const width = rows[0].length;
  if (rows.slice(1).some(item => item.length > width)) throw new Error("CSV rows must not contain more columns than the header.");
  const headers = rows[0].map(value => value.trim());
  if (headers.some(value => !value)) throw new Error("CSV column names cannot be blank.");
  return { headers, rows: rows.slice(1).map(item => [...item, ...Array(Math.max(0, width - item.length)).fill("")]) };
}

const indexOf = (headers: string[], candidates: string[]) => headers.findIndex(header => candidates.includes(header.trim().toLowerCase().replace(/[\s_-]+/g, "")));
const nodeShape = (idValue: string, label: string, x: number, y: number): ShapeElement => ({ type: "rectangle", id: id(), x, y, w: 230, h: Math.max(76, Math.min(230, 40 + label.split("\n").length * 22)), color: "#4b5563", thickness: 2, fillColor: "#ffffff", label: { text: label || idValue, color: "#111827", fontSize: 15, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "middle", offsetX: 12, offsetY: 4 } });
const anchorToward = (from: ShapeElement, to: ShapeElement) => { const dx = to.x + to.w / 2 - (from.x + from.w / 2); const dy = to.y + to.h / 2 - (from.y + from.h / 2); return Math.abs(dx) > Math.abs(dy) ? { x: dx > 0 ? 1 : 0, y: 0.5 } : { x: 0.5, y: dy > 0 ? 1 : 0 }; };

/** Turn row-oriented CSV data into editable node cards and, when present, connectors. */
export function csvToDiagram(source: string): Element[] {
  const { headers, rows } = parseCsv(source);
  if (rows.length > 500) throw new Error("A CSV diagram can include up to 500 rows.");
  const idIndex = indexOf(headers, ["id", "key", "nodeid", "identifier"]);
  const labelIndex = indexOf(headers, ["label", "name", "title", "node", "task", "step"]);
  const fromIndex = indexOf(headers, ["from", "source", "parent", "start"]);
  const toIndex = indexOf(headers, ["to", "target", "destination", "end"]);
  const edgeLabelIndex = indexOf(headers, ["edgelabel", "relationship", "relation"]);
  const edgeMode = fromIndex >= 0 && toIndex >= 0;
  const nodeRecords = new Map<string, { label: string; index: number }>();
  const links: { from: string; to: string; label: string }[] = [];
  if (edgeMode) {
    rows.forEach(row => {
      const sourceId = row[fromIndex]?.trim(); const targetId = row[toIndex]?.trim();
      const rowId = idIndex >= 0 ? row[idIndex]?.trim() : "";
      const label = labelIndex >= 0 ? row[labelIndex]?.trim() : "";
      // Diagram-code exports include standalone node records as well as edge
      // records. Keep those nodes when the CSV also has from/to columns.
      if (!sourceId || !targetId) {
        if (rowId && label) nodeRecords.set(rowId, { label, index: nodeRecords.size });
        return;
      }
      if (label.length > MAX_CSV_CELL) throw new Error("CSV labels are limited to 50,000 characters.");
      if (rowId) nodeRecords.set(rowId, { label: label || rowId, index: nodeRecords.size });
      if (!nodeRecords.has(sourceId)) nodeRecords.set(sourceId, { label: sourceId, index: nodeRecords.size });
      if (!nodeRecords.has(targetId)) nodeRecords.set(targetId, { label: targetId, index: nodeRecords.size });
      links.push({ from: sourceId, to: targetId, label: edgeLabelIndex >= 0 ? row[edgeLabelIndex] : idIndex < 0 && labelIndex >= 0 ? row[labelIndex] : "" });
    });
  } else {
    rows.forEach((row, index) => {
      const key = idIndex >= 0 ? row[idIndex]?.trim() : String(index + 1);
      const label = row.map((value, column) => value ? `${headers[column]}: ${value}` : "").filter(Boolean).join("\n");
      if (label.length > 100_000) throw new Error("Generated CSV card text is limited to 100,000 characters per row.");
      if (!key) return;
      nodeRecords.set(key, { label: label || key, index: nodeRecords.size });
    });
  }
  if (!nodeRecords.size) throw new Error("No rows with an ID or label could be turned into diagram objects.");
  if (nodeRecords.size > 500) throw new Error("A CSV diagram can include up to 500 unique nodes.");
  const nodes = new Map<string, ShapeElement>();
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodeRecords.size)));
  for (const [key, entry] of nodeRecords) nodes.set(key, nodeShape(key, entry.label, (entry.index % columns) * 260, Math.floor(entry.index / columns) * 160));
  const edges: ShapeElement[] = [];
  for (const link of links) {
    const from = nodes.get(link.from); const to = nodes.get(link.to);
    if (!from || !to) continue;
    edges.push({ type: "arrow", id: id(), x: from.x + from.w / 2, y: from.y + from.h / 2, w: to.x + to.w / 2 - (from.x + from.w / 2), h: to.y + to.h / 2 - (from.y + from.h / 2), color: "#6b7280", thickness: 2, endHead: "solid", startHead: "none", startBinding: { elementId: from.id!, anchor: anchorToward(from, to) }, endBinding: { elementId: to.id!, anchor: anchorToward(to, from) }, ...(link.label ? { label: { text: link.label, color: "#4b5563", fontSize: 13, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" } } : {}) });
  }
  return [...edges, ...nodes.values()];
}
