import type { Element, SchemaTableElement } from "../../model";

export type BlueprintFormat = "java" | "python" | "prisma";
export type BlueprintFile = { path: string; contents: string };

type UmlClass = { name: string; attributes: string[]; methods: string[] };
const identifier = (value: string, fallback: string) => {
  const cleaned = value.trim().replace(/[^\p{L}\p{N}_$]/gu, "_").replace(/^[^\p{L}_$]/u, "_$&");
  return cleaned || fallback;
};
const camelName = (value: string, fallback: string) => {
  const name = identifier(value, fallback);
  return name[0].toLowerCase() + name.slice(1);
};
const snakeName = (value: string, fallback: string) => identifier(value, fallback).replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

function findUmlClasses(elements: Element[]): UmlClass[] {
  const result: UmlClass[] = [];
  const visit = (items: Element[]) => {
    for (const item of items) {
      if (item.type !== "group") continue;
      if (item.libraryComponent?.kind === "uml-class" || item.componentId?.startsWith("uml-class:")) {
        const textFor = (role: string) => item.elements.find((child): child is Extract<Element, { type: "text" }> => child.type === "text" && child.componentRole === role)?.text ?? "";
        result.push({
          name: textFor("class-name").trim() || item.libraryComponent?.label?.trim() || "UntitledClass",
          attributes: textFor("class-attributes").split(/\r?\n/).map(line => line.trim()).filter(Boolean),
          methods: textFor("class-methods").split(/\r?\n/).map(line => line.trim()).filter(Boolean),
        });
      } else visit(item.elements);
    }
  };
  visit(elements);
  return result;
}

function parseField(line: string) {
  const value = line.replace(/^[+\-#~]\s*/, "").replace(/;\s*$/, "").trim();
  const match = /^([\w$]+)\s*:\s*([\w.$<>\[\]?|]+)?(?:\s*=.*)?$/.exec(value);
  if (match) return { name: identifier(match[1], "field"), type: match[2] || "Any", visibility: line.trim()[0] };
  const words = value.split(/\s+/);
  if (words.length >= 2 && /^[\w.$<>\[\]?|]+$/.test(words[0]) && /^[\w$]+$/.test(words[1])) return { name: identifier(words[1], "field"), type: words[0], visibility: line.trim()[0] };
  return { name: identifier(value.split(/[=: (]/)[0] || "field", "field"), type: "Any", visibility: line.trim()[0] };
}

function parseMethod(line: string) {
  const value = line.replace(/^[+\-#~]\s*/, "").replace(/;\s*$/, "").trim();
  const match = /^([\w$]+)\s*\((.*)\)\s*(?::\s*([\w.$<>\[\]?|]+))?$/.exec(value);
  if (!match) return { name: identifier(value.split(/[(:]/)[0] || "todo", "todo"), parameters: [] as { name: string; type: string }[], returnType: "void" };
  const parameters = match[2].split(",").map((part, index) => {
    const entry = part.trim();
    const typed = /^([\w$]+)\s*:\s*([\w.$<>\[\]?|]+)$/.exec(entry);
    if (typed) return { name: identifier(typed[1], `arg${index + 1}`), type: typed[2] };
    const spaced = /^([\w.$<>\[\]?|]+)\s+([\w$]+)$/.exec(entry);
    return spaced ? { name: identifier(spaced[2], `arg${index + 1}`), type: spaced[1] } : { name: `arg${index + 1}`, type: "Any" };
  }).filter(parameter => parameter.name);
  return { name: identifier(match[1], "todo"), parameters, returnType: match[3] || "void" };
}

function javaType(source: string) {
  const value = source.replace(/\?$/, "").trim();
  const known: Record<string, string> = { any: "Object", string: "String", str: "String", text: "String", int: "int", integer: "int", long: "long", bigint: "long", boolean: "boolean", bool: "boolean", float: "double", double: "double", number: "double", uuid: "java.util.UUID", date: "java.time.LocalDate", datetime: "java.time.Instant", timestamp: "java.time.Instant", void: "void" };
  return known[value.toLowerCase()] ?? (/^[A-Za-z_$][\w.$]*(?:<[^;{}]+>)?(?:\[\])?$/.test(value) ? value : "Object");
}

function pythonType(source: string) {
  const value = source.replace(/\?$/, "").trim().toLowerCase();
  const known: Record<string, string> = { string: "str", str: "str", text: "str", int: "int", integer: "int", long: "int", bigint: "int", boolean: "bool", bool: "bool", float: "float", double: "float", number: "float", void: "None", any: "Any" };
  return known[value] ?? "Any";
}

function classFiles(format: "java" | "python", elements: Element[]): BlueprintFile[] {
  const cards = findUmlClasses(elements);
  if (!cards.length) throw new Error("Add one or more UML class cards before exporting a class blueprint.");
  if (cards.length > 300) throw new Error("Blueprint export is limited to 300 UML classes at a time.");
  const usedNames = new Set<string>();
  const uniqueName = (name: string, index: number) => {
    const base = identifier(name, `Class${index + 1}`); let result = base; let suffix = 2;
    while (usedNames.has(result.toLowerCase())) result = `${base}${suffix++}`;
    usedNames.add(result.toLowerCase());
    return result;
  };
  const files: BlueprintFile[] = [];
  for (const [index, card] of cards.entries()) {
    const name = uniqueName(card.name, index);
    const fields = card.attributes.map(parseField);
    const methods = card.methods.map(parseMethod);
    if (format === "java") {
      const members = [
        ...fields.map(field => `    ${field.visibility === "+" ? "public" : field.visibility === "#" ? "protected" : "private"} ${javaType(field.type)} ${field.name};`),
        ...methods.map(method => `    public ${javaType(method.returnType)} ${method.name}(${method.parameters.map(parameter => `${javaType(parameter.type)} ${parameter.name}`).join(", ")}) {\n        throw new UnsupportedOperationException("TODO: implement ${method.name}");\n    }`),
      ];
      files.push({ path: `java/src/main/java/${name}.java`, contents: `public class ${name} {\n${members.length ? `${members.join("\n\n")}\n` : "    // TODO: add class members\n"}}\n` });
    } else {
      const members = [
        ...fields.map(field => `    ${field.name}: ${pythonType(field.type)} = None`),
        ...methods.map(method => `    def ${snakeName(method.name, "todo")}(${["self", ...method.parameters.map(parameter => `${snakeName(parameter.name, "arg")}: ${pythonType(parameter.type)}`)].join(", ")}) -> ${pythonType(method.returnType)}:\n        raise NotImplementedError("TODO: implement ${method.name}")`),
      ];
      files.push({ path: `python/src/${snakeName(name, `class_${index + 1}`)}.py`, contents: `from typing import Any\n\n\nclass ${name}:\n${members.length ? `${members.join("\n\n")}\n` : "    pass\n"}` });
    }
  }
  if (format === "python") files.push({ path: "python/src/__init__.py", contents: "" });
  files.push({ path: "README.md", contents: format === "java"
    ? "# UML Java blueprint\n\nGenerated classes are empty implementation scaffolds. Review field types, package names, relationships, and domain behavior before using them.\n"
    : "# UML Python blueprint\n\nGenerated classes are empty implementation scaffolds. Review field types, package names, relationships, and domain behavior before using them.\n" });
  return files;
}

function prismaFiles(elements: Element[]): BlueprintFile[] {
  const tables = elements.flatMap(function visit(item): SchemaTableElement[] {
    return item.type === "schemaTable" ? [item] : item.type === "group" ? item.elements.flatMap(visit) : [];
  });
  if (!tables.length) throw new Error("Add one or more database schema cards before exporting a Prisma blueprint.");
  if (tables.length > 300) throw new Error("Prisma export is limited to 300 tables at a time.");
  const modelNames = new Map<SchemaTableElement, string>();
  const modelNameCounts = new Map<string, number>();
  for (const table of tables) {
    const base = identifier(table.name, `Model${modelNames.size + 1}`);
    const count = (modelNameCounts.get(base.toLowerCase()) ?? 0) + 1;
    modelNameCounts.set(base.toLowerCase(), count);
    modelNames.set(table, count === 1 ? base : `${base}${count}`);
  }
  const fieldNames = new Map<SchemaTableElement, Map<string, string>>();
  for (const table of tables) {
    const used = new Set<string>(); const map = new Map<string, string>();
    for (const [index, field] of table.columns.entries()) {
      const base = identifier(field.name, `field${index + 1}`); let name = base; let suffix = 2;
      while (used.has(name.toLowerCase())) name = `${base}${suffix++}`;
      used.add(name.toLowerCase()); map.set(field.name, name);
    }
    fieldNames.set(table, map);
  }
  const modelByName = new Map(tables.map(table => [table.name.toLowerCase(), table] as const));
  const reverseRelations = new Map<SchemaTableElement, { name: string; type: string }[]>();
  const relationByField = new Map<SchemaTableElement, Map<string, { target: SchemaTableElement; targetField: string; name: string; reverseName: string }>>();
  for (const table of tables) {
    const relations = new Map<string, { target: SchemaTableElement; targetField: string; name: string; reverseName: string }>();
    for (const [index, field] of table.columns.entries()) {
      const target = field.foreignTable ? modelByName.get(field.foreignTable.toLowerCase()) : undefined;
      const targetField = field.foreignColumn || "id";
      if (!target || !fieldNames.get(target)?.has(targetField)) continue;
      const relation = { target, targetField, name: `${modelNames.get(table)}_${fieldNames.get(table)?.get(field.name)}_${index + 1}`, reverseName: `${camelName(modelNames.get(table)!, "model")}From${identifier(field.name, `field${index + 1}`)}` };
      relations.set(field.name, relation);
      const list = reverseRelations.get(target) ?? [];
      list.push({ name: relation.reverseName, type: `${modelNames.get(table)}[] @relation("${relation.name}")` });
      reverseRelations.set(target, list);
    }
    relationByField.set(table, relations);
  }
  const models = tables.map(table => {
    const fields = table.columns.map((field, index) => {
      const name = fieldNames.get(table)!.get(field.name)!;
      const upper = field.dataType.toUpperCase();
      const type = /\b(?:BIGINT|BIGSERIAL)\b/.test(upper) ? "BigInt" : /\b(?:BOOL|BOOLEAN)\b/.test(upper) ? "Boolean" : /\b(?:DECIMAL|NUMERIC)\b/.test(upper) ? "Decimal" : /\b(?:REAL|FLOAT|DOUBLE)\b/.test(upper) ? "Float" : /\b(?:JSON|JSONB)\b/.test(upper) ? "Json" : /\b(?:BYTEA|BLOB|BINARY)\b/.test(upper) ? "Bytes" : /\b(?:INT|INTEGER|SERIAL|SMALLINT|TINYINT)\b/.test(upper) ? "Int" : /\b(?:DATE|TIME|TIMESTAMP|DATETIME)\b/.test(upper) ? "DateTime" : "String";
      const singlePrimary = field.primaryKey && table.columns.filter(column => column.primaryKey).length === 1;
      const unique = table.constraints?.some(constraint => constraint.kind === "unique" && constraint.columns?.length === 1 && constraint.columns[0] === field.name) || table.indexes?.some(item => item.unique && item.columns.length === 1 && item.columns[0] === field.name);
      const relation = relationByField.get(table)?.get(field.name);
      const mapped = name !== field.name ? ` @map("${field.name.replace(/"/g, "\\\"")}")` : "";
      const scalar = `  ${name} ${type}${field.nullable !== false && !field.primaryKey ? "?" : ""}${singlePrimary ? " @id" : unique ? " @unique" : ""}${mapped}`;
      if (!relation) return scalar;
      const targetName = fieldNames.get(relation.target)?.get(relation.targetField);
      const optional = field.nullable !== false && !field.primaryKey;
      return `${scalar}\n  ${camelName(modelNames.get(relation.target)!, "related")}${identifier(name, `field${index + 1}`)} ${modelNames.get(relation.target)}${optional ? "?" : ""} @relation("${relation.name}", fields: [${name}], references: [${targetName}])`;
    });
    const constraints = table.constraints ?? [];
    const compositePrimary = constraints.find(item => item.kind === "primary-key" && (item.columns?.length ?? 0) > 1)?.columns ?? table.columns.filter(field => field.primaryKey).map(field => field.name);
    if (compositePrimary.length > 1) fields.push(`  @@id([${compositePrimary.map(name => fieldNames.get(table)?.get(name) ?? identifier(name, "field")).join(", ")}])`);
    for (const constraint of constraints.filter(item => item.kind === "unique" && (item.columns?.length ?? 0) > 1)) fields.push(`  @@unique([${constraint.columns!.map(name => fieldNames.get(table)?.get(name) ?? identifier(name, "field")).join(", ")}])`);
    for (const index of table.indexes ?? []) if (index.columns.length > 1) fields.push(`  ${index.unique ? "@@unique" : "@@index"}([${index.columns.map(name => fieldNames.get(table)?.get(name) ?? identifier(name, "field")).join(", ")}])`);
    for (const relation of reverseRelations.get(table) ?? []) fields.push(`  ${relation.name} ${relation.type}`);
    const modelName = modelNames.get(table)!;
    const map = modelName !== table.name ? `\n  @@map("${table.name.replace(/"/g, "\\\"")}")` : "";
    return `model ${modelName} {\n${fields.join("\n")}${map}\n}`;
  });
  const contents = `generator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n\n${models.join("\n\n")}\n`;
  return [{ path: "prisma/schema.prisma", contents }, { path: "README.md", contents: "# Prisma schema blueprint\n\nGenerated for PostgreSQL from SketchDraw schema cards. Review provider-specific types and relations before running Prisma validation or migrations. This export does not connect to a database.\n" }];
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Creates a small, standards-compliant uncompressed ZIP for offline scaffold export. */
export function blueprintZip(files: BlueprintFile[], maximumBytes = 32 * 1024 * 1024) {
  if (!files.length || files.length > 512) throw new Error("The blueprint contains an unsupported number of files.");
  const encoder = new TextEncoder();
  const entries = files.map(file => {
    const name = encoder.encode(file.path.replace(/\\/g, "/")); const data = encoder.encode(file.contents);
    if (!name.length || name.length > 1000 || data.length > maximumBytes) throw new Error("A generated ZIP file is too large to package.");
    return { name, data, crc: crc32(data) };
  });
  if (entries.reduce((sum, entry) => sum + entry.data.length, 0) > maximumBytes) throw new Error(`The generated ZIP is larger than ${Math.floor(maximumBytes / 1024 / 1024)} MB.`);
  const localParts: Uint8Array[] = []; const centralParts: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const local = new Uint8Array(30 + entry.name.length); const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true); localView.setUint16(4, 20, true); localView.setUint16(6, 0x0800, true); localView.setUint16(8, 0, true);
    localView.setUint32(14, entry.crc, true); localView.setUint32(18, entry.data.length, true); localView.setUint32(22, entry.data.length, true); localView.setUint16(26, entry.name.length, true); local.set(entry.name, 30);
    localParts.push(local, entry.data);
    const central = new Uint8Array(46 + entry.name.length); const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true); centralView.setUint16(4, 20, true); centralView.setUint16(6, 20, true); centralView.setUint16(8, 0x0800, true); centralView.setUint16(10, 0, true);
    centralView.setUint32(16, entry.crc, true); centralView.setUint32(20, entry.data.length, true); centralView.setUint32(24, entry.data.length, true); centralView.setUint16(28, entry.name.length, true); centralView.setUint32(42, offset, true); central.set(entry.name, 46);
    centralParts.push(central);
    offset += local.length + entry.data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22); const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, entries.length, true); endView.setUint16(10, entries.length, true); endView.setUint32(12, centralSize, true); endView.setUint32(16, offset, true);
  const output = new Uint8Array(offset + centralSize + end.length); let cursor = 0;
  for (const part of [...localParts, ...centralParts, end]) { output.set(part, cursor); cursor += part.length; }
  return output;
}

export function buildBlueprintFiles(format: BlueprintFormat, elements: Element[]) {
  if (format === "prisma") return prismaFiles(elements);
  return classFiles(format, elements);
}
