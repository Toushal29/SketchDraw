import type { DataLink, DataSource, Element, ShapeElement } from "../../model";
import { parseCsv } from "../diagrams/csv-diagram";

export const MAX_DATA_ROWS = 2000;
export const MAX_DATA_COLUMNS = 40;
export const MAX_DATA_SOURCES = 12;
export const MAX_RULES_LENGTH = 2000;

const cell = (value: unknown): string => value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);

/** Reads a CSV file or a JSON array of objects (also `{ "rows": [...] }` or `{ "data": [...] }`) into headers and string rows. */
export function parseDataTable(text: string, fileName = ""): { headers: string[]; rows: string[][] } {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("The data file is empty.");
  let headers: string[]; let rows: string[][];
  if (/\.json$/i.test(fileName) || trimmed.startsWith("[") || trimmed.startsWith("{")) {
    let parsed: unknown;
    try { parsed = JSON.parse(trimmed); } catch { throw new Error("The file is not valid JSON."); }
    const list = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? (["rows", "data", "items", "records"] as const).map(key => (parsed as Record<string, unknown>)[key]).find(Array.isArray) : undefined;
    if (!Array.isArray(list) || !list.length || !list.every(item => item && typeof item === "object" && !Array.isArray(item))) throw new Error("JSON data must be an array of objects, such as [{\"name\": \"API\", \"status\": \"up\"}].");
    headers = [...new Set(list.flatMap(item => Object.keys(item as object)))].slice(0, MAX_DATA_COLUMNS);
    rows = list.slice(0, MAX_DATA_ROWS).map(item => headers.map(header => cell((item as Record<string, unknown>)[header])));
  } else {
    const table = parseCsv(trimmed);
    headers = table.headers.slice(0, MAX_DATA_COLUMNS);
    rows = table.rows.slice(0, MAX_DATA_ROWS).map(row => row.slice(0, MAX_DATA_COLUMNS));
  }
  if (!headers.length) throw new Error("The data file has no columns.");
  return { headers, rows };
}

export type DataRule = { column: string; operator: "=" | "!=" | ">" | ">=" | "<" | "<=" | "contains"; value: string; fill?: string; stroke?: string; text?: string };

/**
 * One rule per line: `status = down -> fill #d64545`, `load >= 80 -> stroke #b9771d, text #ffffff`.
 * Returns the rules it understood and a message for each line it could not read.
 */
export function parseDataRules(source: string): { rules: DataRule[]; errors: string[] } {
  const rules: DataRule[] = []; const errors: string[] = [];
  source.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim(); if (!line || line.startsWith("//") || line.startsWith("#")) return;
    const match = /^(.+?)\s*(>=|<=|!=|=|>|<|\bcontains\b)\s*(.+?)\s*->\s*(.+)$/i.exec(line);
    if (!match) { errors.push(`Rule ${index + 1}: write it like  status = down -> fill #d64545`); return; }
    const rule: DataRule = { column: match[1].trim(), operator: match[2].toLowerCase() as DataRule["operator"], value: match[3].trim().replace(/^"(.*)"$/, "$1") };
    for (const effect of match[4].split(",")) {
      const part = /^\s*(fill|stroke|text)\s+(#[\da-f]{6})\s*$/i.exec(effect);
      if (part) rule[part[1].toLowerCase() as "fill" | "stroke" | "text"] = part[2].toLowerCase();
      else errors.push(`Rule ${index + 1}: "${effect.trim()}" is not fill, stroke, or text with a #rrggbb color.`);
    }
    if (rule.fill || rule.stroke || rule.text) rules.push(rule);
  });
  return { rules, errors };
}

function matches(rule: DataRule, actual: string): boolean {
  const a = actual.trim(); const b = rule.value;
  const numeric = a !== "" && b !== "" && Number.isFinite(Number(a)) && Number.isFinite(Number(b));
  switch (rule.operator) {
    case "=": return numeric ? Number(a) === Number(b) : a.toLowerCase() === b.toLowerCase();
    case "!=": return numeric ? Number(a) !== Number(b) : a.toLowerCase() !== b.toLowerCase();
    case "contains": return a.toLowerCase().includes(b.toLowerCase());
    default: {
      if (!numeric) return false;
      const x = Number(a); const y = Number(b);
      return rule.operator === ">" ? x > y : rule.operator === ">=" ? x >= y : rule.operator === "<" ? x < y : x <= y;
    }
  }
}

export function findDataRow(source: DataSource, link: DataLink): Record<string, string> | undefined {
  const keyAt = source.headers.indexOf(link.key);
  if (keyAt < 0) return undefined;
  const row = source.rows.find(candidate => (candidate[keyAt] ?? "").trim().toLowerCase() === link.value.trim().toLowerCase());
  return row ? Object.fromEntries(source.headers.map((header, index) => [header, row[index] ?? ""])) : undefined;
}

/** Applies the linked row to one element: label text from a column, then colors from the first matching rule per property. */
export function applyDataLink(element: Element, source: DataSource | undefined): Element {
  const link = element.dataLink;
  if (!link || !source) return element;
  const row = findDataRow(source, link);
  if (!row) return element;
  let next: Element = element;
  const text = link.label && link.label in row ? row[link.label] : undefined;
  const { rules } = parseDataRules(link.rules ?? "");
  const effects: { fill?: string; stroke?: string; text?: string } = {};
  for (const rule of rules) if (rule.column in row && matches(rule, row[rule.column])) { effects.fill ??= rule.fill; effects.stroke ??= rule.stroke; effects.text ??= rule.text; }
  if (next.type === "text") {
    if (text !== undefined && next.text !== text) next = { ...next, text };
    if (effects.text && next.color !== effects.text) next = { ...next, color: effects.text };
    return next;
  }
  if (next.type === "freehand") return effects.stroke && next.color !== effects.stroke ? { ...next, color: effects.stroke } : next;
  if (next.type === "group" || next.type === "image" || next.type === "schemaTable") return next;
  const shape: ShapeElement = next;
  const isConnector = shape.type === "line" || shape.type === "arrow";
  let changed = shape;
  if (text !== undefined && text !== (shape.label?.text ?? "")) changed = { ...changed, label: { ...(changed.label ?? { color: "#1f2933", fontSize: 14, verticalAlign: "middle" as const, textAlign: "center" as const }), text } };
  if (effects.fill && !isConnector && (changed.fillColor !== effects.fill)) changed = { ...changed, fillColor: effects.fill, fillOpacity: changed.fillOpacity ?? 1 };
  if (effects.stroke && changed.color !== effects.stroke) changed = { ...changed, color: effects.stroke };
  if (effects.text && changed.label && changed.label.color !== effects.text) changed = { ...changed, label: { ...changed.label, color: effects.text } };
  return changed;
}

/** Re-applies every data link in the tree. Unchanged elements keep their identity. */
export function refreshDataLinks(elements: Element[], sources: DataSource[]): Element[] {
  if (!sources.length) return elements;
  const byId = new Map(sources.map(source => [source.id, source]));
  const visit = (item: Element): Element => {
    let next = item;
    if (item.type === "group") { const children = item.elements.map(visit); if (children.some((child, index) => child !== item.elements[index])) next = { ...item, elements: children }; }
    return next.dataLink ? applyDataLink(next, byId.get(next.dataLink.source)) : next;
  };
  const result = elements.map(visit);
  return result.some((item, index) => item !== elements[index]) ? result : elements;
}

export function distinctValues(source: DataSource, column: string, limit = 200): string[] {
  const at = source.headers.indexOf(column); if (at < 0) return [];
  return [...new Set(source.rows.map(row => (row[at] ?? "").trim()).filter(Boolean))].slice(0, limit);
}

/** Validates data sources read from a file. Invalid sources are dropped. */
export function normalizeDataSources(value: unknown): DataSource[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, MAX_DATA_SOURCES).flatMap((raw): DataSource[] => {
    const item = raw as Record<string, unknown> | null;
    if (!item || typeof item.id !== "string" || !/^[\w.-]{1,100}$/.test(item.id) || seen.has(item.id) || typeof item.name !== "string") return [];
    if (!Array.isArray(item.headers) || !item.headers.length || item.headers.length > MAX_DATA_COLUMNS || !item.headers.every(header => typeof header === "string" && header.length <= 120)) return [];
    const headers = item.headers as string[];
    if (!Array.isArray(item.rows) || item.rows.length > MAX_DATA_ROWS || !item.rows.every(row => Array.isArray(row) && row.length <= headers.length && row.every(entry => typeof entry === "string" && entry.length <= 2000))) return [];
    seen.add(item.id);
    return [{ id: item.id, name: item.name.slice(0, 120) || "Data", headers, rows: (item.rows as string[][]).map(row => [...row, ...Array(headers.length - row.length).fill("")]), ...(typeof item.path === "string" && item.path.length <= 1000 ? { path: item.path } : {}), updatedAt: typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt) ? item.updatedAt : 0 }];
  });
}

export function normalizeDataLink(value: unknown): DataLink | undefined {
  const item = value as Record<string, unknown> | null;
  if (!item || typeof item !== "object" || typeof item.source !== "string" || !/^[\w.-]{1,100}$/.test(item.source) || typeof item.key !== "string" || typeof item.value !== "string" || item.key.length > 120 || item.value.length > 500) return undefined;
  return { source: item.source, key: item.key, value: item.value, ...(typeof item.label === "string" && item.label && item.label.length <= 120 ? { label: item.label } : {}), ...(typeof item.rules === "string" && item.rules.trim() ? { rules: item.rules.slice(0, MAX_RULES_LENGTH) } : {}) };
}
