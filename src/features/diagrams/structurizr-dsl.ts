import type { Element } from "../../model";
import { buildStructuredDiagram, type StructuredGraphLink, type StructuredGraphNode } from "./structured-data";

const ELEMENT_TYPES = ["infrastructureNode", "softwareSystemInstance", "containerInstance", "deploymentNode", "softwareSystem", "component", "container", "person", "customElement"] as const;
type C4ElementType = typeof ELEMENT_TYPES[number];

function withoutLineComment(line: string): string {
  let quote = ""; let escaped = false;
  for (let index = 0; index < line.length - 1; index++) {
    const char = line[index];
    if (escaped) { escaped = false; continue; }
    if (char === "\\" && quote) { escaped = true; continue; }
    if ((char === '"' || char === "'") && (!quote || quote === char)) { quote = quote ? "" : char; continue; }
    if (!quote && char === "/" && line[index + 1] === "/") return line.slice(0, index);
  }
  return line;
}

function quotedArguments(source: string): string[] {
  const values: string[] = []; let quote = ""; let value = ""; let active = false; let escaped = false;
  for (const char of source) {
    if (!active) { if (char === '"' || char === "'") { quote = char; value = ""; active = true; } continue; }
    if (escaped) { value += char; escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === quote) { values.push(value); active = false; quote = ""; continue; }
    value += char;
  }
  if (active) throw new Error("Structurizr DSL contains an unclosed quoted string.");
  return values;
}

function braceDelta(source: string): number {
  let quote = ""; let escaped = false; let delta = 0;
  for (const char of source) {
    if (escaped) { escaped = false; continue; }
    if (quote && char === "\\") { escaped = true; continue; }
    if (char === '"' || char === "'") { if (!quote) quote = char; else if (quote === char) quote = ""; continue; }
    if (!quote && char === "{") delta++;
    else if (!quote && char === "}") delta--;
  }
  return delta;
}

/** Import the common Structurizr DSL model and C4 deployment subset. */
export function structurizrDslToDiagram(source: string): Element[] {
  if (source.length > 5_000_000) throw new Error("Structurizr DSL input is limited to 5 MB.");
  const nodes: StructuredGraphNode[] = []; const links: StructuredGraphLink[] = []; const nodeKeys = new Map<string, string>();
  const pending: { from: string; to: string; label: string; line: number }[] = []; const parents: { depth: number; key: string }[] = [];
  let depth = 0; let modelDepth = -1; let generatedId = 0;
  for (const [index, rawLine] of source.replace(/\r/g, "").split("\n").entries()) {
    const clean = withoutLineComment(rawLine); const line = clean.trim();
    while (parents.length && parents[parents.length - 1].depth > depth) parents.pop();
    if (/^model\s*\{/i.test(line)) modelDepth = depth + 1;
    else if (modelDepth >= 0 && depth >= modelDepth) {
      const assignment = /^([A-Za-z_][\w.-]*)\s*=\s*/.exec(line); const statement = assignment ? line.slice(assignment[0].length) : line;
      const declaration = new RegExp(`^(?:${ELEMENT_TYPES.join("|")})\\b`).exec(statement);
      if (declaration) {
        const kind = ELEMENT_TYPES.find(type => statement.startsWith(type)) as C4ElementType; const rest = statement.slice(kind.length).trim();
        const args = quotedArguments(rest); const title = args[0]?.trim() || `${kind} ${generatedId + 1}`; const description = args[1]?.trim() || "";
        const alias = assignment?.[1] ?? `${kind.toLowerCase()}_${++generatedId}_${title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
        if (nodeKeys.has(alias)) throw new Error(`Structurizr DSL declares the alias "${alias}" more than once.`);
        if (nodes.length >= 500) throw new Error("Structurizr DSL imports are limited to 500 model elements.");
        const key = `structurizr:${alias}`; nodeKeys.set(alias, key);
        nodes.push({ key, title, kind: `C4 ${kind}`, detail: [description, ...args.slice(2)].filter(Boolean).join("\n"), componentRole: `structurizr-node|${kind}|${encodeURIComponent(alias)}|${index + 1}`, liveKey: alias });
        const parent = parents[parents.length - 1]; if (parent) links.push({ from: parent.key, to: key, label: "contains", componentRole: `structurizr-edge|${encodeURIComponent(parent.key.slice("structurizr:".length))}|${encodeURIComponent(alias)}` });
        if (braceDelta(rest) > 0) parents.push({ depth: depth + 1, key });
      } else {
        const relationship = /^([A-Za-z_][\w.-]*)\s*(?:->|-->|->>)\s*([A-Za-z_][\w.-]*)(.*)$/.exec(line);
        if (relationship) pending.push({ from: relationship[1], to: relationship[2], label: quotedArguments(relationship[3])[0] ?? "", line: index + 1 });
      }
    }
    depth += braceDelta(clean);
    if (modelDepth > depth) modelDepth = -1;
  }
  if (!nodes.length) throw new Error("Structurizr DSL contains no supported person, system, container, component, or deployment declarations.");
  for (const relation of pending) {
    let from = nodeKeys.get(relation.from); let to = nodeKeys.get(relation.to);
    for (const [alias, key] of [[relation.from, from], [relation.to, to]] as const) {
      if (key) continue;
      const unresolvedKey = `structurizr:unresolved:${alias}`;
      if (!nodeKeys.has(alias)) { nodeKeys.set(alias, unresolvedKey); nodes.push({ key: unresolvedKey, title: alias, kind: "Unresolved Structurizr reference", componentRole: `code-source|structurizr|${relation.line}|1`, liveKey: alias }); }
      if (alias === relation.from) from = nodeKeys.get(alias); else to = nodeKeys.get(alias);
    }
    if (from && to) links.push({ from, to, label: relation.label, componentRole: `structurizr-edge|${encodeURIComponent(relation.from)}|${encodeURIComponent(relation.to)}`, liveKey: `${relation.from} ${relation.to}` });
  }
  return buildStructuredDiagram(nodes, links, "structurizr");
}
