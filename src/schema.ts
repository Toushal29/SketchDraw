export type SchemaColumn = { name: string; type: string; primaryKey?: boolean; foreignTable?: string; foreignColumn?: string; nullable?: boolean };
export type SchemaTable = { name: string; columns: SchemaColumn[] };

const identifier = (value: string) => value.replace(/^[`"\[]/, "").replace(/[`"\]]$/, "").trim();

function splitSqlItems(body: string): string[] {
  const items: string[] = []; let start = 0; let depth = 0; let quote = "";
  for (let index = 0; index < body.length; index++) {
    const char = body[index];
    if (quote) { if (char === quote) { if (body[index + 1] === quote) index++; else quote = ""; } else if (char === "\\") index++; continue; }
    if (char === "'" || char === '"' || char === "`") { quote = char; continue; }
    if (char === "[") { quote = "]"; continue; }
    if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === "," && depth === 0) { items.push(body.slice(start, index).trim()); start = index + 1; }
  }
  const final = body.slice(start).trim(); if (final) items.push(final);
  return items;
}

function matchingParen(source: string, start: number): number {
  let depth = 0; let quote = "";
  for (let index = start; index < source.length; index++) {
    const char = source[index];
    if (quote) { if (char === quote) { if (source[index + 1] === quote) index++; else quote = ""; } else if (char === "\\") index++; continue; }
    if (char === "'" || char === '"' || char === "`") { quote = char; continue; }
    if (char === "[") { quote = "]"; continue; }
    if (char === "(") depth++;
    else if (char === ")" && --depth === 0) return index;
  }
  return -1;
}

function parseSql(source: string): SchemaTable[] {
  const tables: SchemaTable[] = [];
  const create = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$.-]+))\s*\(/ig;
  for (const match of source.matchAll(create)) {
    const name = identifier(match[1].split(".").pop() ?? match[1]);
    const openIndex = (match.index ?? 0) + match[0].lastIndexOf("("); const closeIndex = matchingParen(source, openIndex);
    if (!name || closeIndex < 0) continue;
    const columns: SchemaColumn[] = []; const primaryKeys = new Set<string>(); const foreignKeys: { column: string; table: string; target: string }[] = [];
    for (const item of splitSqlItems(source.slice(openIndex + 1, closeIndex))) {
      const primary = /PRIMARY\s+KEY\s*\(([^)]+)\)/i.exec(item);
      if (primary) { primary[1].split(",").forEach(part => primaryKeys.add(identifier(part.trim().split(/\s+/)[0]).toLowerCase())); continue; }
      const foreign = /FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+((?:`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$.-]+))\s*\(([^)]+)\)/i.exec(item);
      if (foreign) { foreignKeys.push({ column: identifier(foreign[1].split(",")[0]), table: identifier(foreign[2].split(".").pop() ?? foreign[2]), target: identifier(foreign[3].split(",")[0]) }); continue; }
      if (/^(?:CONSTRAINT|UNIQUE|CHECK|INDEX|KEY)\b/i.test(item)) continue;
      const field = /^\s*(`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$.-]+)\s+([\w]+(?:\s+PRECISION)?(?:\s*\([^)]*\))?(?:\s+UNSIGNED)?)([\s\S]*)$/i.exec(item);
      if (!field) continue;
      const columnName = identifier(field[1]); const details = field[3] ?? "";
      const reference = /REFERENCES\s+((?:`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$.-]+))\s*\(([^)]+)\)/i.exec(details);
      columns.push({ name: columnName, type: field[2].trim(), primaryKey: /\bPRIMARY\s+KEY\b/i.test(details), foreignTable: reference ? identifier(reference[1].split(".").pop() ?? reference[1]) : undefined, foreignColumn: reference ? identifier(reference[2].split(",")[0]) : undefined, nullable: !/\bNOT\s+NULL\b/i.test(details) });
    }
    for (const column of columns) {
      if (primaryKeys.has(column.name.toLowerCase())) column.primaryKey = true;
      const foreign = foreignKeys.find(item => item.column.toLowerCase() === column.name.toLowerCase());
      if (foreign) { column.foreignTable = foreign.table; column.foreignColumn = foreign.target; }
    }
    if (columns.length) tables.push({ name, columns });
  }
  return tables;
}

function parseJson(source: string): SchemaTable[] {
  const parsed: unknown = JSON.parse(source);
  const root = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : undefined;
  const rawTables = Array.isArray(parsed) ? parsed : Array.isArray(root?.tables) ? root.tables : root?.tables && typeof root.tables === "object" ? Object.entries(root.tables as Record<string, unknown>).map(([name, value]) => value && typeof value === "object" && !Array.isArray(value) && "columns" in value ? { name, ...(value as Record<string, unknown>) } : { name, columns: value }) : undefined;
  if (!rawTables) throw new Error("JSON schema must have a tables array or a tables object.");
  return rawTables.flatMap((raw): SchemaTable[] => {
    if (!raw || typeof raw !== "object") return [];
    const table = raw as Record<string, unknown>; const name = String(table.name ?? table.tableName ?? table.table_name ?? "").trim();
    const rawColumns = Array.isArray(table.columns) ? table.columns : table.columns && typeof table.columns === "object" ? Object.entries(table.columns as Record<string, unknown>).map(([columnName, value]) => typeof value === "string" ? { name: columnName, type: value } : value && typeof value === "object" ? { name: columnName, ...(value as Record<string, unknown>) } : { name: columnName }) : undefined;
    if (!name || !rawColumns) return [];
    const primaryKeys = new Set(Array.isArray(table.primaryKey) ? table.primaryKey.map(value => String(value).toLowerCase()) : Array.isArray(table.primary_key) ? table.primary_key.map(value => String(value).toLowerCase()) : []);
    const columns = rawColumns.flatMap((entry): SchemaColumn[] => {
      if (typeof entry === "string") return [{ name: entry.trim(), type: "" }];
      if (!entry || typeof entry !== "object") return [];
      const column = entry as Record<string, unknown>; const columnName = String(column.name ?? column.columnName ?? column.column_name ?? "").trim();
      if (!columnName) return [];
      const reference = column.references ?? column.foreignKey ?? column.foreign_key ?? column.fk;
      const refText = typeof reference === "string" ? reference : reference && typeof reference === "object" ? `${String((reference as Record<string, unknown>).table ?? "")}.${String((reference as Record<string, unknown>).column ?? "")}` : "";
      const lastDot = refText.lastIndexOf("."); const foreignTable = refText ? (lastDot >= 0 ? refText.slice(0, lastDot).split(".").pop() : refText) : undefined; const foreignColumn = lastDot >= 0 ? refText.slice(lastDot + 1) : undefined;
      return [{ name: columnName, type: String(column.type ?? column.dataType ?? column.data_type ?? ""), primaryKey: column.primaryKey === true || column.primary_key === true || column.pk === true || primaryKeys.has(columnName.toLowerCase()), foreignTable, foreignColumn, nullable: column.nullable !== false }];
    });
    return columns.length ? [{ name, columns }] : [];
  });
}

export function parseSchema(source: string): SchemaTable[] {
  if (source.length > 500_000) throw new Error("Schema input is limited to 500,000 characters.");
  const input = source.trim(); if (!input) throw new Error("Paste SQL CREATE TABLE statements or a JSON schema first.");
  const tables = input.startsWith("{") || input.startsWith("[") ? parseJson(input) : parseSql(input);
  if (!tables.length) throw new Error("No tables with columns were found. Check the SQL CREATE TABLE syntax or the JSON tables array.");
  if (tables.length > 50) throw new Error("A visualizer import can include up to 50 tables at once.");
  if (tables.some(table => table.columns.length > 100)) throw new Error("A table can include up to 100 columns.");
  return tables;
}
