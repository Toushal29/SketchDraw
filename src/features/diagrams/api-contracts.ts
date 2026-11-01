import { parseAllDocuments } from "yaml";
import { buildStructuredDiagram, type StructuredGraphLink, type StructuredGraphNode } from "./structured-data";

type Token = { value: string; line: number; kind: "name" | "string" | "number" | "punct" };
const stringValue = (value: unknown) => typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
const objectValue = (value: unknown): Record<string, unknown> | undefined => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
function maskComments(source: string, hashComments = false): string {
  const chars = source.split(""); let quote = ""; let triple = false; let lineComment = false; let blockComment = false;
  for (let index = 0; index < chars.length; index++) {
    const char = source[index]; const next = source[index + 1];
    if (lineComment) { if (char === "\n") lineComment = false; else chars[index] = " "; continue; }
    if (blockComment) { if (char === "*" && next === "/") { chars[index] = chars[index + 1] = " "; index++; blockComment = false; } else if (char !== "\n") chars[index] = " "; continue; }
    if (quote) {
      if (!triple && char === "\\") { index++; continue; }
      if (triple && source.startsWith('"""', index)) { quote = ""; triple = false; index += 2; continue; }
      if (!triple && char === quote) quote = "";
      continue;
    }
    if (source.startsWith('"""', index)) { quote = '"'; triple = true; index += 2; continue; }
    if (char === "'" || char === '"' || char === "`") { quote = char; continue; }
    if (char === "/" && next === "/") { chars[index] = chars[index + 1] = " "; index++; lineComment = true; continue; }
    if (char === "/" && next === "*") { chars[index] = chars[index + 1] = " "; index++; blockComment = true; continue; }
    if (hashComments && char === "#") { chars[index] = " "; lineComment = true; }
  }
  return chars.join("");
}
function tokenize(source: string, language: string): Token[] {
  if (source.length > 5_000_000) throw new Error(`${language} input is limited to 5 MB.`);
  const output: Token[] = []; let index = 0; let line = 1;
  while (index < source.length) {
    const char = source[index]; const next = source[index + 1];
    if (/\s/.test(char)) { if (char === "\n") line++; index++; continue; }
    if (char === "#" || char === "/" && next === "/") { while (index < source.length && source[index] !== "\n") index++; continue; }
    if (char === "/" && next === "*") { index += 2; while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) { if (source[index++] === "\n") line++; } index = Math.min(source.length, index + 2); continue; }
    const tokenLine = line;
    if (char === "\"" || char === "'") {
      const quote = char; let value = ""; index++;
      while (index < source.length && source[index] !== quote) { if (source[index] === "\\" && index + 1 < source.length) index++; if (source[index] === "\n") line++; value += source[index++]; }
      if (index < source.length) index++; output.push({ value, line: tokenLine, kind: "string" }); continue;
    }
    if (char === "`" && source.startsWith("```", index)) { const end = source.indexOf("```", index + 3); if (end < 0) throw new Error(`${language} contains an unclosed block string.`); const text = source.slice(index + 3, end); line += (text.match(/\n/g) ?? []).length; output.push({ value: text, line: tokenLine, kind: "string" }); index = end + 3; continue; }
    if (/[A-Za-z_]/.test(char)) { let value = char; index++; while (/[A-Za-z0-9_.-]/.test(source[index] ?? "")) value += source[index++]; output.push({ value, line: tokenLine, kind: "name" }); continue; }
    if (/\d/.test(char)) { let value = char; index++; while (/[\d.]/.test(source[index] ?? "")) value += source[index++]; output.push({ value, line: tokenLine, kind: "number" }); continue; }
    output.push({ value: source.startsWith("...", index) ? "..." : char, line: tokenLine, kind: "punct" }); index += source.startsWith("...", index) ? 3 : 1;
  }
  if (output.length > 500_000) throw new Error(`${language} input has too many tokens.`);
  return output;
}

const meta = (format: string, line: number, key: string) => ({ componentRole: `code-source|${format}|${line}|1`, liveKey: key });
const refNames = (type: string) => [...type.matchAll(/[A-Za-z_][\w.]*/g)].map(match => match[0]).filter(name => !["null", "string", "boolean", "bytes", "int", "long", "float", "double", "decimal", "date", "time", "timestamp", "map", "array"].includes(name.toLowerCase()));

/** Import GraphQL SDL type, input, interface, union, enum, and scalar declarations. */
export function graphQlToDiagram(source: string) {
  const lines = source.replace(/\r/g, "").split("\n"); const tokens = tokenize(source, "GraphQL SDL");
  const nodes: StructuredGraphNode[] = []; const links: StructuredGraphLink[] = []; const known = new Set<string>(); const fieldsByType = new Map<string, { line: number; value: string; refs: string[] }[]>();
  for (let cursor = 0; cursor < tokens.length; cursor++) {
    const token = tokens[cursor]; const extended = token.value === "extend"; const kindToken = tokens[cursor + (extended ? 1 : 0)];
    if (!kindToken || !["type", "input", "interface", "enum", "union", "scalar"].includes(kindToken.value)) continue;
    const nameToken = tokens[cursor + (extended ? 2 : 1)]; if (!nameToken || nameToken.kind !== "name") continue;
    const kind = kindToken.value; const name = nameToken.value; const key = `graphql:${name}`; known.add(name);
    let open = cursor; if (kind !== "scalar") while (open < tokens.length && tokens[open].value !== "{" && tokens[open].value !== "=" && tokens[open].line <= nameToken.line + 3) open++;
    let end = open; let body = "";
    if (tokens[open]?.value === "{") { let depth = 1; end = open + 1; while (end < tokens.length && depth) { if (tokens[end].value === "{") depth++; else if (tokens[end].value === "}") depth--; end++; } if (depth) throw new Error(`GraphQL ${kind} ${name} has an unclosed body near line ${nameToken.line}.`); body = tokens.slice(open + 1, end - 1).map(item => item.value).join(" "); }
    else if (tokens[open]?.value === "=") { end = open + 1; while (end < tokens.length && tokens[end].line === tokens[open].line) end++; body = tokens.slice(open + 1, end).map(item => item.value).join(" "); }
    const declarationLine = lines[nameToken.line - 1]?.trim() ?? "";
    const typeFields: { line: number; value: string; refs: string[] }[] = [];
    if (kind === "union") {
      for (const member of body.split("|").map(item => item.trim()).filter(Boolean)) typeFields.push({ line: nameToken.line, value: `Member: ${member}`, refs: [member] });
    } else if (kind === "enum") {
      const firstBodyLine = tokens[open]?.line ?? nameToken.line; const lastBodyLine = tokens[Math.max(open, end - 1)]?.line ?? firstBodyLine;
      for (let rowIndex = firstBodyLine - 1; rowIndex < lastBodyLine; rowIndex++) {
        const value = /^\s*([A-Za-z_][\w]*)(?:\s+@.*)?\s*$/.exec(lines[rowIndex].replace(/#.*/, ""));
        if (value && value[1] !== "enum") typeFields.push({ line: rowIndex + 1, value: value[1], refs: [] });
      }
    } else {
      const firstBodyLine = tokens[open]?.line ?? nameToken.line;
      const lastBodyLine = tokens[Math.max(open, end - 1)]?.line ?? firstBodyLine;
      const bodySource = lines.slice(firstBodyLine - 1, lastBodyLine).map(line => line.replace(/#.*/, "")).join("\n");
      const fieldPattern = /(?:^|[\s,{}])([A-Za-z_][\w]*)\s*(?:\([^)]*\))?\s*:\s*([\[\]!A-Za-z_][\w\[\]!]*)(?=\s|@|,|$)/gm;
      for (const field of bodySource.matchAll(fieldPattern)) {
        const fieldLine = firstBodyLine + (bodySource.slice(0, field.index ?? 0).match(/\n/g) ?? []).length;
        typeFields.push({ line: fieldLine, value: `${field[1]}: ${field[2]}`, refs: refNames(field[2]) });
      }
    }
    const extendsTypes = kindToken.value === "type" || kind === "interface" ? tokens.slice(cursor, open).filter(item => item.value === "&" || item.value === "implements").length ? tokens.slice(cursor, open).filter(item => item.kind === "name" && item.value !== "extend" && item.value !== kind && item.value !== name && item.value !== "implements").map(item => item.value) : [] : [];
    const detail = [declarationLine && !declarationLine.startsWith(kind) ? declarationLine : "", ...typeFields.slice(0, 36).map(item => item.value), ...(extendsTypes.length ? [`Implements: ${extendsTypes.join(", ")}`] : [])].filter(Boolean).join("\n");
    nodes.push({ key, title: name, kind: `GraphQL ${kind}`, detail, ...meta("graphql", nameToken.line, key) }); fieldsByType.set(name, [...(fieldsByType.get(name) ?? []), ...typeFields]);
    for (const ref of extendsTypes) links.push({ from: key, to: `graphql:${ref}`, label: "implements", ...meta("graphql", nameToken.line, `${key}->${ref}`) });
    cursor = Math.max(cursor, end - 1);
  }
  if (!nodes.length) throw new Error("GraphQL SDL contains no supported type, input, interface, union, enum, or scalar declarations.");
  for (const [name, fields] of fieldsByType) for (const field of fields) for (const ref of field.refs) if (known.has(ref)) links.push({ from: `graphql:${name}`, to: `graphql:${ref}`, label: field.value.split(":")[0], ...meta("graphql", field.line, `${name}.${field.value}`) });
  return buildStructuredDiagram(nodes, links, "graphql");
}

function readBalancedBlock(source: string, open: number, language: string): { body: string; end: number } {
  let depth = 0; let quote = ""; let lineComment = false; let blockComment = false;
  for (let index = open; index < source.length; index++) {
    const char = source[index]; const next = source[index + 1];
    if (lineComment) { if (char === "\n") lineComment = false; continue; }
    if (blockComment) { if (char === "*" && next === "/") { blockComment = false; index++; } continue; }
    if (quote) { if (char === "\\") index++; else if (char === quote) quote = ""; continue; }
    if (char === "'" || char === '"' || char === "`") { quote = char; continue; }
    if (char === "/" && next === "/") { lineComment = true; index++; continue; }
    if (char === "/" && next === "*") { blockComment = true; index++; continue; }
    if (char === "{") depth++;
    else if (char === "}" && --depth === 0) return { body: source.slice(open + 1, index), end: index + 1 };
  }
  throw new Error(`${language} block is missing a closing brace.`);
}

/** Import DBML tables, columns, primary/unique markers, and table/field references. */
export function dbmlToDiagram(source: string) {
  if (source.length > 5_000_000) throw new Error("DBML input is limited to 5 MB.");
  const clean = source.replace(/\/\/[^\n]*/g, ""); const nodes: StructuredGraphNode[] = []; const links: StructuredGraphLink[] = []; const names = new Set<string>();
  const tablePattern = /\bTable\s+(?:"([^"]+)"|`([^`]+)`|([\w.]+))(?:\s*\[[^\]]*\])?\s*\{/gi;
  for (let match = tablePattern.exec(clean); match; match = tablePattern.exec(clean)) {
    const name = match[1] ?? match[2] ?? match[3]; const open = tablePattern.lastIndex - 1; const block = readBalancedBlock(clean, open, "DBML table"); tablePattern.lastIndex = block.end;
    const key = `dbml:${name}`; if (names.has(name)) throw new Error(`DBML declares table ${name} more than once.`); names.add(name);
    const fields: string[] = []; const relations: { field: string; target: string; targetField: string; line: number }[] = [];
    for (const [index, rawLine] of block.body.split("\n").entries()) {
      const row = rawLine.trim(); const field = /^(?:"([^"]+)"|`([^`]+)`|([\w]+))\s+([\w.()\[\]]+)(?:\s*\[([^\]]*)\])?/.exec(row);
      if (!field) continue;
      const fieldName = field[1] ?? field[2] ?? field[3]; const type = field[4]; const flags = (field[5] ?? "").toLowerCase();
      fields.push(`${fieldName}: ${type}${flags.includes("pk") ? " (PK)" : ""}${flags.includes("not null") ? " (required)" : ""}`);
      const ref = /ref\s*:\s*([<>-])\s*(?:"([^"]+)"|`([^`]+)`|([\w.]+))\s*\.\s*(?:"([^"]+)"|`([^`]+)`|([\w]+))/i.exec(field[5] ?? "");
      if (ref) relations.push({ field: fieldName, target: ref[2] ?? ref[3] ?? ref[4].split(".")[0], targetField: ref[5] ?? ref[6] ?? ref[7], line: (source.slice(0, match.index).match(/\n/g) ?? []).length + index + 1 });
    }
    const baseLine = (source.slice(0, match.index).match(/\n/g) ?? []).length + 1;
    nodes.push({ key, title: name, kind: "DBML table", detail: fields.join("\n"), ...meta("dbml", baseLine, key) });
    for (const relation of relations) links.push({ from: key, to: `dbml:${relation.target}`, label: `${relation.field} → ${relation.targetField}`, ...meta("dbml", relation.line, `${name}.${relation.field}`) });
  }
  const refPattern = /^\s*Ref\s*:\s*(?:"([^".]+)"|`([^`.]+)`|([\w.]+))\s*\.\s*([\w]+)\s*([<>-])\s*(?:"([^".]+)"|`([^`.]+)`|([\w.]+))\s*\.\s*([\w]+)/gim;
  for (let match = refPattern.exec(clean); match; match = refPattern.exec(clean)) {
    const fromTable = match[1] ?? match[2] ?? match[3].split(".")[0]; const fromField = match[4]; const toTable = match[6] ?? match[7] ?? match[8].split(".")[0]; const toField = match[9];
    if (!links.some(link => link.from === `dbml:${fromTable}` && link.to === `dbml:${toTable}` && link.label?.startsWith(`${fromField} `))) links.push({ from: `dbml:${fromTable}`, to: `dbml:${toTable}`, label: `${fromField} ${match[5]} ${toField}`, ...meta("dbml", (source.slice(0, match.index).match(/\n/g) ?? []).length + 1, `${fromTable}.${fromField}`) });
  }
  if (!nodes.length) throw new Error("DBML input contains no Table blocks.");
  return buildStructuredDiagram(nodes, links, "dbml");
}

/** Import Protocol Buffer messages, enums, and service RPC request/response links. */
export function protobufToDiagram(source: string) {
  tokenize(source, "Protocol Buffers"); const scanSource = maskComments(source); const nodes: StructuredGraphNode[] = []; const links: StructuredGraphLink[] = []; const names = new Set<string>(); const fields: { owner: string; type: string; name: string; line: number }[] = [];
  const pattern = /\b(message|enum|service)\s+([A-Za-z_][\w.]*)\s*\{/g;
  for (let match = pattern.exec(scanSource); match; match = pattern.exec(scanSource)) {
    const type = match[1]; const name = match[2]; const open = pattern.lastIndex - 1; const block = readBalancedBlock(source, open, "Protocol Buffer"); pattern.lastIndex = block.end;
    if (names.has(name)) throw new Error(`Protocol Buffer declaration ${name} is duplicated.`); names.add(name);
    const key = `proto:${name}`; const line = (source.slice(0, match.index).match(/\n/g) ?? []).length + 1; const members: string[] = [];
    for (const [rowIndex, rawLine] of block.body.split("\n").entries()) {
      const row = rawLine.replace(/\/\/.*$/, "").trim(); if (!row || row === "reserved" || row.startsWith("option ")) continue;
      const enumValue = /^([A-Za-z_][\w]*)\s*=\s*(-?\d+)/.exec(row);
      if (type === "enum" && enumValue) { members.push(`${enumValue[1]} = ${enumValue[2]}`); continue; }
      const field = /^(?:(?:optional|required|repeated)\s+)?(map\s*<[^>]+>|[A-Za-z_][\w.]*)\s+([A-Za-z_][\w]*)\s*=\s*(\d+)/.exec(row);
      if (type === "message" && field) { members.push(`${field[2]}: ${field[1]} (#${field[3]})`); fields.push({ owner: name, type: field[1].replace(/[<>!,\s]/g, ""), name: field[2], line: line + rowIndex + 1 }); }
    }
    nodes.push({ key, title: name, kind: `Protocol Buffer ${type}`, detail: members.slice(0, 60).join("\n"), ...meta("proto", line, key) });
    if (type === "service") {
      for (const rpc of maskComments(block.body).matchAll(/rpc\s+(\w+)\s*\(\s*(?:stream\s+)?([\w.]+)\s*\)\s*returns\s*\(\s*(?:stream\s+)?([\w.]+)\s*\)/g)) {
        const rpcKey = `proto-rpc:${name}.${rpc[1]}`; nodes.push({ key: rpcKey, title: rpc[1], kind: "Protocol Buffer RPC", detail: `${rpc[2]} → ${rpc[3]}`, ...meta("proto", line + (block.body.slice(0, rpc.index).match(/\n/g) ?? []).length, rpcKey) });
        for (const [direction, rawType] of [["request", rpc[2]], ["response", rpc[3]]] as const) {
          const typeName = rawType.split(".").pop()!;
          if (names.has(typeName)) links.push({ from: rpcKey, to: `proto:${typeName}`, label: direction });
        }
      }
    }
  }
  if (!nodes.length) throw new Error("Protocol Buffers input contains no message, enum, or service declarations.");
  for (const field of fields) { const target = field.type.split(".").pop()!; if (names.has(target)) links.push({ from: `proto:${field.owner}`, to: `proto:${target}`, label: field.name, ...meta("proto", field.line, `${field.owner}.${field.name}`) }); }
  return buildStructuredDiagram(nodes, links, "protobuf");
}

/** Import Avro record/enum/fixed definitions and named-type field references. */
export function avroToDiagram(input: string | unknown) {
  let parsed: unknown;
  if (typeof input === "string") { if (input.length > 5_000_000) throw new Error("Avro schema input is limited to 5 MB."); try { parsed = JSON.parse(input); } catch { throw new Error("Avro schema is not valid JSON."); } }
  else parsed = input;
  const roots = Array.isArray(parsed) ? parsed : [parsed]; const nodes: StructuredGraphNode[] = []; const links: StructuredGraphLink[] = []; const keyByName = new Map<string, string>(); const pending: { from: string; type: string; field: string }[] = [];
  const visit = (value: unknown, namespace = "", line = 1, depth = 0) => {
    if (depth > 64) throw new Error("Avro schema nesting is limited to 64 levels.");
    if (Array.isArray(value)) { value.forEach(item => visit(item, namespace, line, depth + 1)); return; }
    const record = value && typeof value === "object" ? value as Record<string, unknown> : undefined; if (!record) return;
    const type = typeof record.type === "string" ? record.type : "";
    if (type === "record" || type === "enum" || type === "fixed") {
      const name = String(record.name ?? ""); const recordNamespace = String(record.namespace ?? namespace); const fullName = recordNamespace ? `${recordNamespace}.${name}` : name;
      if (!name) return; const key = `avro:${fullName}`; keyByName.set(fullName, key); keyByName.set(name, key);
      const fields = Array.isArray(record.fields) ? record.fields.map(item => item && typeof item === "object" ? item as Record<string, unknown> : {}).filter(Boolean) : [];
      const detail = type === "record" ? fields.slice(0, 80).map(field => `${String(field.name ?? "field")}: ${Array.isArray(field.type) ? field.type.join(" | ") : typeof field.type === "string" ? field.type : JSON.stringify(field.type)}`).join("\n") : Array.isArray(record.symbols) ? record.symbols.map(String).join("\n") : `Size: ${String(record.size ?? "unknown")}`;
      nodes.push({ key, title: fullName, kind: `Avro ${type}`, detail, ...meta("avro", line, key) });
      for (const field of fields) { const fieldType = Array.isArray(field.type) ? field.type.map(String).filter(value => value !== "null").join(" | ") : typeof field.type === "string" ? field.type : String(objectValue(field.type)?.name ?? ""); pending.push({ from: key, type: fieldType, field: String(field.name ?? "field") }); visit(field.type, String(record.namespace ?? namespace), line, depth + 1); }
    } else if (Array.isArray(record.type)) visit(record.type, namespace, line, depth + 1);
    else if (record.type && typeof record.type === "object") visit(record.type, namespace, line, depth + 1);
  };
  roots.forEach(root => visit(root));
  for (const item of pending) for (const ref of refNames(item.type)) { const target = keyByName.get(ref); if (target) links.push({ from: item.from, to: target, label: item.field }); }
  if (!nodes.length) throw new Error("Avro JSON needs a record, enum, or fixed schema declaration.");
  return buildStructuredDiagram(nodes, links, "avro");
}

/** Import Prisma models, enums, scalar fields, and relation fields as editable schema cards. */
export function prismaToDiagram(source: string) {
  if (source.length > 5_000_000) throw new Error("Prisma schema input is limited to 5 MB.");
  const declarations: { name: string; kind: "model" | "enum" | "type"; body: string; line: number }[] = [];
  const pattern = /\b(model|enum|type)\s+([A-Za-z_][\w]*)\s*\{/g;
  const scanSource = maskComments(source);
  for (let match = pattern.exec(scanSource); match; match = pattern.exec(scanSource)) {
    const block = readBalancedBlock(source, pattern.lastIndex - 1, "Prisma"); pattern.lastIndex = block.end;
    declarations.push({ kind: match[1] as "model" | "enum" | "type", name: match[2], body: block.body, line: (source.slice(0, match.index).match(/\n/g) ?? []).length + 1 });
    if (declarations.length > 500) throw new Error("Prisma imports are limited to 500 model, enum, and composite type declarations.");
  }
  if (!declarations.length) throw new Error("Prisma schema contains no model, enum, or composite type declarations.");
  const declaredNames = new Set(declarations.map(item => item.name)); const nodes: StructuredGraphNode[] = []; const links: StructuredGraphLink[] = [];
  for (const declaration of declarations) {
    const key = `prisma:${declaration.name}`; const details: string[] = [];
    for (const [index, raw] of declaration.body.split("\n").entries()) {
      const row = raw.replace(/\/\/.*$/, "").trim(); if (!row || row.startsWith("@@")) continue;
      if (declaration.kind === "enum") { const value = /^([A-Za-z_][\w]*)/.exec(row); if (value) details.push(value[1]); continue; }
      const field = /^([A-Za-z_][\w]*)\s+([A-Za-z_][\w]*(?:\?)?(?:\[\])?)(.*)$/.exec(row); if (!field) continue;
      const name = field[1]; const type = field[2]; const attributes = field[3].trim();
      const markers = [type.endsWith("[]") ? "collection" : type.endsWith("?") ? "optional" : "required", attributes.includes("@id") ? "PK" : "", attributes.includes("@unique") ? "unique" : ""].filter(Boolean);
      details.push(`${name}: ${type}${markers.length ? ` (${markers.join(", ")})` : ""}`);
      const target = type.replace(/[?\[\]]/g, "");
      if (declaredNames.has(target) && target !== declaration.name) links.push({ from: key, to: `prisma:${target}`, label: `${name}${attributes.includes("@relation") ? " relation" : ""}`, ...meta("prisma", declaration.line + index + 1, `${declaration.name}.${name}`) });
    }
    nodes.push({ key, title: declaration.name, kind: `Prisma ${declaration.kind}`, detail: details.slice(0, 80).join("\n"), ...meta("prisma", declaration.line, key) });
  }
  return buildStructuredDiagram(nodes, links, "prisma");
}

/** Import AsyncAPI channels, operations, messages, schemas, servers, and local references. */
export function asyncApiToDiagram(input: string | unknown) {
  let root: Record<string, unknown> | undefined;
  if (typeof input === "string") {
    if (input.length > 5_000_000) throw new Error("AsyncAPI input is limited to 5 MB.");
    try { const docs = parseAllDocuments(input); if (!docs.length || docs.length > 500 || docs.some(doc => doc.errors.length)) throw new Error(); root = (docs[0].toJS({ maxAliasCount: 100 }) as Record<string, unknown>) ?? undefined; } catch { throw new Error("The AsyncAPI YAML or JSON could not be parsed."); }
  } else root = objectValue(input);
  if (!root || !stringValue(root.asyncapi)) throw new Error("AsyncAPI input needs an asyncapi version field.");
  const nodes: StructuredGraphNode[] = []; const links: StructuredGraphLink[] = []; const channels = objectValue(root.channels) ?? {}; const operations = objectValue(root.operations) ?? {}; const componentMessages = objectValue(objectValue(root.components)?.messages) ?? {}; const channelKeys = new Map<string, string>(); const emittedMessages = new Set<string>();
  for (const [name, raw] of Object.entries(channels)) { const channel = objectValue(raw) ?? {}; const key = `asyncapi:channel:${name}`; channelKeys.set(name, key); nodes.push({ key, title: name, kind: "AsyncAPI channel", detail: [stringValue(channel.description), Array.isArray(channel.servers) ? `Servers: ${channel.servers.join(", ")}` : ""].filter(Boolean).join("\n"), ...meta("asyncapi", 1, key) }); }
  for (const [name, raw] of Object.entries(operations)) {
    const operation = objectValue(raw) ?? {}; const channelRef = stringValue(operation.channel && objectValue(operation.channel)?.$ref); const channelName = channelRef.split("/").pop() ?? ""; const channelKey = channelKeys.get(channelName);
    const key = `asyncapi:operation:${name}`; nodes.push({ key, title: stringValue(operation.title) || name, kind: `AsyncAPI ${stringValue(operation.action) || "operation"}`, detail: stringValue(operation.summary) || stringValue(operation.description), ...meta("asyncapi", 1, key) });
    if (channelKey) links.push({ from: key, to: channelKey, label: "uses channel" });
    const operationMessages = Array.isArray(operation.messages) ? operation.messages : Object.keys(objectValue(operation.messages) ?? {}).map(messageName => ({ $ref: `#/components/messages/${messageName}` }));
    for (const [index, rawMessage] of operationMessages.entries()) {
      const messageRef = stringValue(objectValue(rawMessage)?.$ref); const messageName = messageRef.split("/").pop() || `${name}-${index + 1}`;
      const messageKey = `asyncapi:component:${messageName}`; const componentMessage = objectValue(componentMessages[messageName]);
      if (!emittedMessages.has(messageKey)) { emittedMessages.add(messageKey); nodes.push({ key: messageKey, title: stringValue(componentMessage?.name) || messageName, kind: "AsyncAPI message", detail: stringValue(componentMessage?.summary) || stringValue(componentMessage?.description), ...meta("asyncapi", 1, messageKey) }); }
      links.push({ from: key, to: messageKey, label: "exchanges" });
    }
  }
  for (const [channelName, raw] of Object.entries(channels)) {
    const channel = objectValue(raw) ?? {}; const channelKey = channelKeys.get(channelName)!;
    for (const action of ["publish", "subscribe"]) {
      const operation = objectValue(channel[action]); if (!operation) continue;
      const key = `asyncapi:operation:${action}:${channelName}`; nodes.push({ key, title: stringValue(operation.operationId) || `${action} ${channelName}`, kind: `AsyncAPI ${action}`, detail: stringValue(operation.summary) || stringValue(operation.description), ...meta("asyncapi", 1, key) });
      links.push({ from: key, to: channelKey, label: action === "publish" ? "publishes to" : "subscribes to" });
      const operationMessages = [operation.message, ...(Array.isArray(operation.messages) ? operation.messages : [])].filter(Boolean).flatMap(raw => { const value = objectValue(raw); return Array.isArray(value?.oneOf) ? value.oneOf : [raw]; });
      const messages = operationMessages.length ? operationMessages.map((raw, index) => [String(index), raw] as const) : Object.entries(objectValue(channel.messages) ?? {});
      for (const [messageName, messageRaw] of messages) {
        const rawMessage = objectValue(messageRaw) ?? {}; const ref = stringValue(rawMessage.$ref); const resolvedName = ref.split("/").pop() || messageName; const message = objectValue(componentMessages[resolvedName]) ?? rawMessage; const messageKey = `asyncapi:message:${channelName}:${resolvedName}`;
        if (!emittedMessages.has(messageKey)) { emittedMessages.add(messageKey); nodes.push({ key: messageKey, title: stringValue(message.name) || resolvedName, kind: "AsyncAPI message", detail: stringValue(message.title) || stringValue(message.summary) || stringValue(message.description), ...meta("asyncapi", 1, messageKey) }); }
        links.push({ from: key, to: messageKey, label: "exchanges" });
        if (ref) links.push({ from: messageKey, to: `asyncapi:component:${resolvedName}`, label: "references" });
        const schema = objectValue(objectValue(message.payload)?.schema); if (schema) { const ref = stringValue(schema.$ref); if (ref) links.push({ from: messageKey, to: `asyncapi:component:${ref.split("/").pop()}`, label: "payload" }); }
      }
    }
  }
  const components = objectValue(root.components) ?? {};
  for (const category of ["schemas", "messages", "operations", "channels", "securitySchemes"] as const) for (const [name, raw] of Object.entries(objectValue(components[category]) ?? {})) {
    if (category === "messages" && emittedMessages.has(`asyncapi:component:${name}`)) continue;
    const item = objectValue(raw) ?? {}; const key = `asyncapi:component:${name}`; nodes.push({ key, title: name, kind: `AsyncAPI ${category.replace(/s$/, "")}`, detail: stringValue(item.summary) || stringValue(item.description) || (category === "schemas" ? JSON.stringify(objectValue(item.properties) ?? {}).slice(0, 900) : ""), ...meta("asyncapi", 1, key) });
  }
  for (const [name, raw] of Object.entries(objectValue(root.servers) ?? {})) { const server = objectValue(raw) ?? {}; const key = `asyncapi:server:${name}`; nodes.push({ key, title: name, kind: "AsyncAPI server", detail: [stringValue(server.protocol), stringValue(server.host), stringValue(server.description)].filter(Boolean).join("\n"), ...meta("asyncapi", 1, key) }); }
  if (!nodes.length) throw new Error("The AsyncAPI document contains no channels, operations, messages, or schemas.");
  return buildStructuredDiagram(nodes, links, "asyncapi");
}
