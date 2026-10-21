export type SchemaColumn = { name: string; type: string; primaryKey?: boolean; foreignTable?: string; foreignColumn?: string; nullable?: boolean };
export type SchemaIndex = { name: string; columns: string[]; unique?: boolean; expression?: string };
export type SchemaConstraint = { name?: string; kind: "unique" | "check" | "foreign-key" | "primary-key"; columns?: string[]; expression?: string; referencedTable?: string; referencedColumns?: string[] };
export type SchemaTable = { name: string; columns: SchemaColumn[]; indexes?: SchemaIndex[]; constraints?: SchemaConstraint[] };

const identifier = (value: string) => value.replace(/^[`"\[]/, "").replace(/[`"\]]$/, "").trim();
const sqlNamePart = '(?:`[^`]+`|"[^"]+"|\\[[^\\]]+\\]|[\\w$-]+)';
const qualifiedSqlName = `${sqlNamePart}(?:\\s*\\.\\s*${sqlNamePart})*`;
const createTablePattern = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(${qualifiedSqlName})\\s*\\(`, "ig");
const foreignKeyPattern = new RegExp(`FOREIGN\\s+KEY\\s*\\(([^)]+)\\)\\s*REFERENCES\\s+(${qualifiedSqlName})\\s*\\(([^)]+)\\)`, "i");
const referencePattern = new RegExp(`REFERENCES\\s+(${qualifiedSqlName})\\s*\\(([^)]+)\\)`, "i");

const unqualifiedSqlName = (value: string) => {
  const parts = value.match(/`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$-]+/g);
  return identifier(parts?.[parts.length - 1] ?? value);
};

function withoutSqlComments(source: string): string {
  let result = ""; let quote = "";
  for (let index = 0; index < source.length; index++) {
    const char = source[index]; const next = source[index + 1];
    if (quote) {
      result += char;
      if (char === quote) { if (next === quote) result += source[++index]; else quote = ""; }
      else if (char === "\\" && quote !== "]" && next !== undefined) result += source[++index];
      continue;
    }
    if (char === "'" || char === '"' || char === "`" || char === "[") { quote = char === "[" ? "]" : char; result += char; continue; }
    if (char === "-" && next === "-" || char === "#") {
      while (index < source.length && source[index] !== "\n") { result += " "; index++; }
      if (index < source.length) result += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      result += "  "; index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) { result += source[index] === "\n" ? "\n" : " "; index++; }
      if (index < source.length) result += "  ";
      index++;
      continue;
    }
    result += char;
  }
  return result;
}

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
  const sql = withoutSqlComments(source);
  for (const match of sql.matchAll(createTablePattern)) {
    const name = unqualifiedSqlName(match[1]);
    const openIndex = (match.index ?? 0) + match[0].lastIndexOf("("); const closeIndex = matchingParen(sql, openIndex);
    if (!name || closeIndex < 0) continue;
    const columns: SchemaColumn[] = []; const primaryKeys = new Set<string>(); const foreignKeys: { column: string; table: string; target: string }[] = []; const constraints: SchemaConstraint[] = [];
    for (const item of splitSqlItems(sql.slice(openIndex + 1, closeIndex))) {
      const constraintName = /^\s*CONSTRAINT\s+((?:`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$-]+)\s+)/i.exec(item)?.[1];
      const cleanItem = item.replace(/^\s*CONSTRAINT\s+(?:`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$-]+)\s+/i, "").trim();
      const primary = /PRIMARY\s+KEY\s*\(([^)]+)\)/i.exec(cleanItem);
      if (primary) { const keyColumns = primary[1].split(",").map(part => identifier(part.trim().split(/\s+/)[0])); keyColumns.forEach(name => primaryKeys.add(name.toLowerCase())); constraints.push({ ...(constraintName ? { name: identifier(constraintName.trim()) } : {}), kind: "primary-key", columns: keyColumns }); continue; }
      const foreign = foreignKeyPattern.exec(item);
      if (foreign) {
        const sourceColumns = foreign[1].split(",").map(part => identifier(part.trim())); const targetColumns = foreign[3].split(",").map(part => identifier(part.trim()));
        foreignKeys.push({ column: sourceColumns[0], table: unqualifiedSqlName(foreign[2]), target: targetColumns[0] });
        constraints.push({ ...(constraintName ? { name: identifier(constraintName.trim()) } : {}), kind: "foreign-key", columns: sourceColumns, referencedTable: unqualifiedSqlName(foreign[2]), referencedColumns: targetColumns }); continue;
      }
      const unique = /^(?:UNIQUE(?:\s+(?:KEY|INDEX))?)(?:\s+((?:`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$-]+)))?\s*\(([^)]+)\)/i.exec(cleanItem);
      if (unique) { constraints.push({ ...(constraintName ? { name: identifier(constraintName.trim()) } : {}), kind: "unique", columns: unique[2].split(",").map(part => identifier(part.trim())) }); continue; }
      const check = /^CHECK\s*\(([\s\S]*)\)\s*$/i.exec(cleanItem);
      if (check) { constraints.push({ ...(constraintName ? { name: identifier(constraintName.trim()) } : {}), kind: "check", expression: check[1].trim() }); continue; }
      if (/^(?:INDEX|KEY)\b/i.test(cleanItem)) continue;
      const field = /^\s*(`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$.-]+)\s+([\w]+(?:\s+PRECISION)?(?:\s*\([^)]*\))?(?:\s+UNSIGNED)?)([\s\S]*)$/i.exec(item);
      if (!field) continue;
      const columnName = identifier(field[1]); const details = field[3] ?? "";
      const reference = referencePattern.exec(details); const primaryKey = /\bPRIMARY\s+KEY\b/i.test(details);
      columns.push({ name: columnName, type: field[2].trim(), primaryKey, foreignTable: reference ? unqualifiedSqlName(reference[1]) : undefined, foreignColumn: reference ? identifier(reference[2].split(",")[0]) : undefined, nullable: !primaryKey && !/\bNOT\s+NULL\b/i.test(details) });
    }
    for (const column of columns) {
      if (primaryKeys.has(column.name.toLowerCase())) column.primaryKey = true;
      if (column.primaryKey) column.nullable = false;
      const foreign = foreignKeys.find(item => item.column.toLowerCase() === column.name.toLowerCase());
      if (foreign) { column.foreignTable = foreign.table; column.foreignColumn = foreign.target; }
    }
    if (columns.length) tables.push({ name, columns, ...(constraints.length ? { constraints } : {}) });
  }
  const indexPattern = /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$.-]+))\s+ON\s+((?:`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$.-]+)(?:\s*\.\s*(?:`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$.-]+))?)\s*\(([^)]*)\)(?:\s+WHERE\s+([\s\S]*?))?\s*;/ig;
  for (const match of sql.matchAll(indexPattern)) {
    const table = tables.find(item => item.name.toLowerCase() === unqualifiedSqlName(match[3]).toLowerCase());
    if (!table) continue;
    const expression = match[4].trim();
    (table.indexes ??= []).push({ name: unqualifiedSqlName(match[2]), columns: expression.split(",").map(part => identifier(part.trim())), unique: !!match[1], ...(match[5] ? { expression: `WHERE ${match[5].trim()}` } : {}) });
  }
  const alterPattern = /ALTER\s+TABLE\s+((?:`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$.-]+)(?:\s*\.\s*(?:`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$.-]+))?)\s+ADD\s+(?:CONSTRAINT\s+((?:`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$-]+))\s+)?([\s\S]*?);/ig;
  for (const match of sql.matchAll(alterPattern)) {
    const table = tables.find(item => item.name.toLowerCase() === unqualifiedSqlName(match[1]).toLowerCase());
    if (!table) continue;
    const definition = match[3].trim(); const name = match[2] ? identifier(match[2]) : undefined;
    const primary = /PRIMARY\s+KEY\s*\(([^)]+)\)/i.exec(definition); const unique = /UNIQUE(?:\s+(?:KEY|INDEX))?\s*(?:[^()]*)\(([^)]+)\)/i.exec(definition);
    const foreign = foreignKeyPattern.exec(definition); const check = /CHECK\s*\(([\s\S]*)\)\s*$/i.exec(definition);
    if (primary) table.constraints = [...table.constraints ?? [], { ...(name ? { name } : {}), kind: "primary-key", columns: primary[1].split(",").map(part => identifier(part.trim())) }];
    else if (unique) table.constraints = [...table.constraints ?? [], { ...(name ? { name } : {}), kind: "unique", columns: unique[1].split(",").map(part => identifier(part.trim())) }];
    else if (foreign) table.constraints = [...table.constraints ?? [], { ...(name ? { name } : {}), kind: "foreign-key", columns: foreign[1].split(",").map(part => identifier(part.trim())), referencedTable: unqualifiedSqlName(foreign[2]), referencedColumns: foreign[3].split(",").map(part => identifier(part.trim())) }];
    else if (check) table.constraints = [...table.constraints ?? [], { ...(name ? { name } : {}), kind: "check", expression: check[1].trim() }];
  }
  return tables;
}

function jsonSchemaColumns(properties: Record<string, unknown>, required: Set<string>): SchemaColumn[] {
  return Object.entries(properties).flatMap(([name, property]) => {
    if (!property || typeof property !== "object" || Array.isArray(property)) return [];
    const schema = property as Record<string, unknown>;
    const declaredTypes = Array.isArray(schema.type) ? schema.type.map(String) : [String(schema.type ?? "")];
    const type = declaredTypes.find(value => value !== "null") ?? "string";
    const fallbackTypes: Record<string, string> = { integer: "INTEGER", number: "REAL", boolean: "BOOLEAN", string: schema.format === "date" ? "DATE" : schema.format === "time" ? "TIME" : schema.format === "date-time" ? "TIMESTAMP" : "TEXT" };
    const nullable = typeof schema["x-sketchdraw-nullable"] === "boolean" ? schema["x-sketchdraw-nullable"] : declaredTypes.includes("null") || !required.has(name);
    return [{
      name,
      type: typeof schema["x-sketchdraw-dataType"] === "string" ? schema["x-sketchdraw-dataType"] : fallbackTypes[type] ?? "TEXT",
      primaryKey: schema["x-sketchdraw-primaryKey"] === true,
      nullable,
      ...(typeof schema["x-sketchdraw-foreignTable"] === "string" ? { foreignTable: schema["x-sketchdraw-foreignTable"] } : {}),
      ...(typeof schema["x-sketchdraw-foreignColumn"] === "string" ? { foreignColumn: schema["x-sketchdraw-foreignColumn"] } : {}),
    }];
  });
}

function jsonSchemaTables(root: Record<string, unknown>): unknown[] | undefined {
  const definitions = root.$defs ?? root.definitions;
  if (definitions && typeof definitions === "object" && !Array.isArray(definitions)) {
    return Object.entries(definitions as Record<string, unknown>).flatMap(([definitionName, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const definition = value as Record<string, unknown>;
      const properties = definition.properties;
      if (!properties || typeof properties !== "object" || Array.isArray(properties)) return [];
      const required = new Set(Array.isArray(definition.required) ? definition.required.map(String) : []);
      const columns = jsonSchemaColumns(properties as Record<string, unknown>, required);
      return columns.length ? [{ name: String(definition.title ?? definitionName), columns, indexes: definition["x-sketchdraw-indexes"], constraints: definition["x-sketchdraw-constraints"] }] : [];
    });
  }
  const properties = root.properties;
  if (root.type === "object" && properties && typeof properties === "object" && !Array.isArray(properties)) {
    const required = new Set(Array.isArray(root.required) ? root.required.map(String) : []);
    const directProperties = Object.fromEntries(Object.entries(properties as Record<string, unknown>).filter(([, property]) => !!property && typeof property === "object" && !Array.isArray(property) && !("$ref" in property)));
    const columns = jsonSchemaColumns(directProperties, required);
    if (columns.length) return [{ name: String(root.title ?? "Table"), columns, indexes: root["x-sketchdraw-indexes"], constraints: root["x-sketchdraw-constraints"] }];
  }
  return undefined;
}

function parseJson(source: string): SchemaTable[] {
  const parsed: unknown = JSON.parse(source);
  const root = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
  const rawTables = Array.isArray(parsed) ? parsed : Array.isArray(root?.tables) ? root.tables : root?.tables && typeof root.tables === "object" ? Object.entries(root.tables as Record<string, unknown>).map(([name, value]) => value && typeof value === "object" && !Array.isArray(value) && "columns" in value ? { name, ...(value as Record<string, unknown>) } : { name, columns: value }) : undefined;
  const tablesInput = rawTables ?? (root ? jsonSchemaTables(root) : undefined);
  if (!tablesInput) throw new Error("JSON input must have a tables array/object or a JSON Schema object with properties or $defs.");
  return tablesInput.flatMap((raw): SchemaTable[] => {
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
      const primaryKey = column.primaryKey === true || column.primary_key === true || column.pk === true || primaryKeys.has(columnName.toLowerCase());
      return [{ name: columnName, type: String(column.type ?? column.dataType ?? column.data_type ?? ""), primaryKey, foreignTable, foreignColumn, nullable: !primaryKey && column.nullable !== false }];
    });
    const indexes = Array.isArray(table.indexes) ? table.indexes : Array.isArray(table["x-sketchdraw-indexes"]) ? table["x-sketchdraw-indexes"] : [];
    const constraints = Array.isArray(table.constraints) ? table.constraints : Array.isArray(table["x-sketchdraw-constraints"]) ? table["x-sketchdraw-constraints"] : [];
    const parsedIndexes: SchemaIndex[] = indexes.flatMap((rawIndex, indexPosition) => {
      if (!rawIndex || typeof rawIndex !== "object" || Array.isArray(rawIndex)) return [];
      const index = rawIndex as Record<string, unknown>;
      const indexColumns = Array.isArray(index.columns) ? index.columns.map(String) : [];
      if (!indexColumns.length || indexColumns.length > 100) return [];
      return [{ name: String(index.name ?? `idx_${name}_${indexPosition + 1}`).slice(0, 200), columns: indexColumns.map(value => value.slice(0, 200)), unique: index.unique === true, ...(typeof index.expression === "string" ? { expression: index.expression.slice(0, 2000) } : {}) }];
    });
    const parsedConstraints: SchemaConstraint[] = constraints.flatMap(rawConstraint => {
      if (!rawConstraint || typeof rawConstraint !== "object" || Array.isArray(rawConstraint)) return [];
      const constraint = rawConstraint as Record<string, unknown>;
      if (!["unique", "check", "foreign-key", "primary-key"].includes(String(constraint.kind))) return [];
      const constraintColumns = Array.isArray(constraint.columns) ? constraint.columns.map(String).slice(0, 100) : undefined;
      const referencedColumns = Array.isArray(constraint.referencedColumns) ? constraint.referencedColumns.map(String).slice(0, 100) : undefined;
      return [{ kind: constraint.kind as SchemaConstraint["kind"], ...(typeof constraint.name === "string" ? { name: constraint.name.slice(0, 200) } : {}), ...(constraintColumns ? { columns: constraintColumns.map(value => value.slice(0, 200)) } : {}), ...(typeof constraint.expression === "string" ? { expression: constraint.expression.slice(0, 2000) } : {}), ...(typeof constraint.referencedTable === "string" ? { referencedTable: constraint.referencedTable.slice(0, 200) } : {}), ...(referencedColumns ? { referencedColumns: referencedColumns.map(value => value.slice(0, 200)) } : {}) }];
    });
    return columns.length ? [{ name, columns, ...(parsedIndexes.length ? { indexes: parsedIndexes } : {}), ...(parsedConstraints.length ? { constraints: parsedConstraints } : {}) }] : [];
  });
}

export function parseSchema(source: string): SchemaTable[] {
  if (source.length > 500_000) throw new Error("Schema input is limited to 500,000 characters.");
  const input = source.trim(); if (!input) throw new Error("Paste SQL CREATE TABLE statements or a JSON table definition first.");
  const tables = input.startsWith("{") || input.startsWith("[") ? parseJson(input) : parseSql(input);
  for (const table of tables) for (const constraint of table.constraints ?? []) {
    if (constraint.kind !== "primary-key") continue;
    for (const columnName of constraint.columns ?? []) {
      const column = table.columns.find(candidate => candidate.name.toLowerCase() === columnName.toLowerCase());
      if (column) { column.primaryKey = true; column.nullable = false; }
    }
  }
  for (const table of tables) for (const constraint of table.constraints ?? []) {
    if (constraint.kind !== "foreign-key" || !constraint.referencedTable) continue;
    const target = tables.find(candidate => candidate.name.toLowerCase() === constraint.referencedTable!.toLowerCase());
    const primaryKeys = target?.columns.filter(column => column.primaryKey).map(column => column.name) ?? [];
    for (const [index, sourceName] of (constraint.columns ?? []).entries()) {
      const sourceColumn = table.columns.find(column => column.name.toLowerCase() === sourceName.toLowerCase());
      if (!sourceColumn) continue;
      const referencedColumn = constraint.referencedColumns?.[index] ?? primaryKeys[index] ?? (primaryKeys.length === 1 ? primaryKeys[0] : undefined);
      if (!sourceColumn.foreignTable) sourceColumn.foreignTable = constraint.referencedTable;
      if (sourceColumn.foreignTable.toLowerCase() === constraint.referencedTable.toLowerCase() && !sourceColumn.foreignColumn && referencedColumn) sourceColumn.foreignColumn = referencedColumn;
    }
  }
  if (!tables.length) throw new Error("No tables with columns were found. Check the SQL CREATE TABLE syntax or the JSON tables array.");
  if (tables.length > 50) throw new Error("A visualizer import can include up to 50 tables at once.");
  if (tables.some(table => table.columns.length > 100)) throw new Error("A table can include up to 100 columns.");
  return tables;
}
