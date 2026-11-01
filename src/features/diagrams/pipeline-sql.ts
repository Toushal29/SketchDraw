import type { Element } from "../../model";
import { buildStructuredDiagram, type StructuredGraphLink, type StructuredGraphNode } from "./structured-data";

const IDENTIFIER = "(?:\"(?:[^\"]|\"\")+\"|\\x60(?:[^\\x60]|\\x60\\x60)+\\x60|\\[(?:[^\\]]|\\]\\])+\\]|[A-Za-z_$#][\\w$#]*)";
const QUALIFIED_NAME = IDENTIFIER + "(?:\\s*\\.\\s*" + IDENTIFIER + ")*";

function maskSqlCommentsAndStrings(source: string): string {
  let result = ""; let quote = ""; let blockComment = false; let lineComment = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index]; const next = source[index + 1] ?? "";
    if (lineComment) { result += char === "\n" ? "\n" : " "; if (char === "\n") lineComment = false; continue; }
    if (blockComment) { result += char === "\n" ? "\n" : " "; if (char === "*" && next === "/") { result += " "; index++; blockComment = false; } continue; }
    if (quote) {
      result += char === "\n" ? "\n" : " ";
      if (char === quote && next === quote) { result += " "; index++; }
      else if (char === quote && source[index - 1] !== "\\") quote = "";
      continue;
    }
    if (char === "-" && next === "-") { result += "  "; index++; lineComment = true; continue; }
    if (char === "/" && next === "*") { result += "  "; index++; blockComment = true; continue; }
    if (char === "'") { result += " "; quote = "'"; continue; }
    result += char;
  }
  return result;
}

function normalizeIdentifier(value: string) {
  return value.trim().split(".").map(part => part.trim()
    .replace(/^\[(.*)\]$/s, "$1").replace(/^\"(.*)\"$/s, "$1").replace(/^\x60(.*)\x60$/s, "$1")
    .replace(/\]\]/g, "]").replace(/\"\"/g, "\"").replace(/\x60\x60/g, "\x60")).join(".");
}

/** Infer view and table lineage from common SQL transformations. This importer never executes SQL. */
export function sqlLineageToDiagram(source: string): Element[] {
  if (source.length > 5_000_000) throw new Error("SQL lineage input is limited to 5 MB.");
  const statements = maskSqlCommentsAndStrings(source).split(";").map(value => value.trim()).filter(Boolean);
  const nodes = new Map<string, StructuredGraphNode>(); const links: StructuredGraphLink[] = [];
  let queryIndex = 0;
  const addNode = (name: string, kind: string, detail?: string) => {
    const key = "sql:" + name.toLocaleLowerCase();
    if (!nodes.has(key)) nodes.set(key, { key, title: name, kind, ...(detail ? { detail } : {}), componentRole: "sql-lineage-node|" + encodeURIComponent(name), liveKey: name });
    return key;
  };
  for (const [index, statement] of statements.entries()) {
    const createPattern = new RegExp("\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?(?:(?:TEMP|TEMPORARY|MATERIALIZED)\\s+)?(VIEW|TABLE)\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(" + QUALIFIED_NAME + ")", "i");
    const writePattern = new RegExp("\\b(?:INSERT\\s+INTO|MERGE\\s+INTO)\\s+(" + QUALIFIED_NAME + ")", "i");
    const createMatch = createPattern.exec(statement); const writeMatch = createMatch ? undefined : writePattern.exec(statement);
    const targetName = createMatch ? normalizeIdentifier(createMatch[2]) : writeMatch ? normalizeIdentifier(writeMatch[1]) : "";
    const ctePattern = new RegExp("(?:\\bWITH\\s+(?:RECURSIVE\\s+)?|,\\s*)(" + IDENTIFIER + ")\\s*(?:\\([^)]*\\)\\s*)?AS\\s*\\(", "gi");
    const ctes = new Set([...statement.matchAll(ctePattern)].map(match => normalizeIdentifier(match[1]).toLocaleLowerCase()));
    const readPattern = new RegExp("\\b(?:FROM|JOIN)\\s+(?:ONLY\\s+)?(" + QUALIFIED_NAME + ")", "gi");
    const reads = [...new Set([...statement.matchAll(readPattern)].map(match => normalizeIdentifier(match[1])).filter(name => name && !ctes.has(name.toLocaleLowerCase())))];
    let outputKey: string | undefined; let outputName = targetName;
    if (targetName) {
      const objectType = createMatch ? (createMatch[1].toLocaleUpperCase() === "VIEW" ? "SQL view" : "SQL table") : "SQL transformation";
      const materialized = createMatch && /\bMATERIALIZED\s+VIEW\b/i.test(statement) ? " (materialized)" : "";
      const detail = createMatch && /\bAS\s*(?:WITH\b|SELECT\b)/i.test(statement) ? "Output of a SQL query." : undefined;
      outputKey = addNode(targetName, objectType + materialized, detail);
    } else if (/\bSELECT\b/i.test(statement) && reads.length) {
      queryIndex++; outputName = "SQL query " + queryIndex;
      outputKey = addNode(outputName, "SQL query", "Statement " + (index + 1) + "; output target is not declared in this source.");
    }
    if (!outputKey) continue;
    for (const name of reads) {
      const inputKey = addNode(name, "SQL source");
      if (inputKey !== outputKey) links.push({
        from: inputKey, to: outputKey, label: "lineage (inferred from SQL)",
        componentRole: "sql-lineage-edge|" + encodeURIComponent(name) + "|" + encodeURIComponent(outputName),
        liveKey: name + " -> " + outputName,
      });
    }
  }
  if (!nodes.size) throw new Error("No SQL view, table transformation, or SELECT lineage was found. Supported inputs include CREATE VIEW/TABLE AS SELECT, INSERT/MERGE INTO, and SELECT/FROM/JOIN dependencies.");
  return buildStructuredDiagram([...nodes.values()], links, "sql-lineage");
}
