/**
 * Eraser-style text for cloud and system architecture:
 *
 *   direction down
 *   Users [icon: user]
 *   VPC {
 *     API [icon: aws-api-gateway, label: "Public API"]
 *     Orders [icon: aws-lambda]
 *     DB [icon: aws-rds, color: #2468a0]
 *   }
 *   Users > API: HTTPS
 *   API > Orders > DB
 *
 * Operators: `>` forward, `<` back, `<>` both ways, `-` no arrowheads. `A > B, C` fans out. `//` and `#` start comments.
 */
export type CloudArrow = "forward" | "back" | "both" | "none";
export type CloudNode = { name: string; icon?: string; label?: string; color?: string; group?: string };
export type CloudGroup = { name: string; label?: string; color?: string; parent?: string };
export type CloudEdge = { from: string; to: string; arrow: CloudArrow; label?: string };
export type CloudDiagramSource = { nodes: CloudNode[]; groups: CloudGroup[]; edges: CloudEdge[]; direction: "right" | "down"; errors: { line: number; message: string }[] };

const MAX_NODES = 300;
const MAX_EDGES = 600;

/** Splits on `separator` outside quotes and brackets. */
function splitTop(text: string, separator: RegExp): string[] {
  const parts: string[] = []; let depth = 0; let quote = false; let start = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') quote = !quote;
    else if (!quote && char === "[") depth++;
    else if (!quote && char === "]") depth = Math.max(0, depth - 1);
    else if (!quote && depth === 0) {
      const match = separator.exec(text.slice(index));
      if (match && match.index === 0 && match[0].length) { parts.push(text.slice(start, index)); index += match[0].length - 1; start = index + 1; }
    }
  }
  parts.push(text.slice(start));
  return parts;
}

const unquote = (value: string) => { const trimmed = value.trim(); return trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed; };

function stripComment(line: string): string {
  let quote = false;
  for (let index = 0; index < line.length; index++) {
    if (line[index] === '"') quote = !quote;
    if (!quote && (line.startsWith("//", index) || line[index] === "#" && (index === 0 || /\s/.test(line[index - 1])) && !/^#[\da-f]{3,8}\b/i.test(line.slice(index)))) return line.slice(0, index);
  }
  return line;
}

type Reference = { name: string; props: Record<string, string> };
function parseReference(text: string): Reference | undefined {
  const match = /^(.*?)\s*(?:\[(.*)\])?\s*$/.exec(text.trim());
  const name = unquote(match?.[1] ?? "");
  if (!name || name.length > 80) return undefined;
  const props: Record<string, string> = {};
  for (const entry of splitTop(match?.[2] ?? "", /,/)) {
    const separator = entry.indexOf(":"); if (separator < 0) continue;
    const key = entry.slice(0, separator).trim().toLowerCase(); const value = unquote(entry.slice(separator + 1));
    if (key && value) props[key] = value;
  }
  return { name, props };
}

export function parseCloudDiagram(source: string): CloudDiagramSource {
  const result: CloudDiagramSource = { nodes: [], groups: [], edges: [], direction: "right", errors: [] };
  const stack: string[] = [];
  const nodes = new Map<string, CloudNode>(); const groups = new Map<string, CloudGroup>();
  const declare = (reference: Reference, line: number): string => {
    if (groups.has(reference.name)) return reference.name;
    let node = nodes.get(reference.name);
    if (!node) {
      if (nodes.size >= MAX_NODES) { result.errors.push({ line, message: `A diagram can hold up to ${MAX_NODES} nodes.` }); return reference.name; }
      node = { name: reference.name, ...(stack.length ? { group: stack[stack.length - 1] } : {}) };
      nodes.set(node.name, node); result.nodes.push(node);
    }
    if (reference.props.icon) node.icon = reference.props.icon;
    if (reference.props.label) node.label = reference.props.label;
    if (reference.props.color && /^#[\da-f]{6}$/i.test(reference.props.color)) node.color = reference.props.color;
    if (stack.length && !node.group) node.group = stack[stack.length - 1];
    return node.name;
  };
  source.split(/\r?\n/).forEach((raw, lineIndex) => {
    const line = lineIndex + 1; const text = stripComment(raw).trim();
    if (!text) return;
    if (text === "}") { if (!stack.pop()) result.errors.push({ line, message: "Unexpected closing brace." }); return; }
    const direction = /^direction\s+(right|left|down|up)$/i.exec(text);
    if (direction) { result.direction = /down|up/i.test(direction[1]) ? "down" : "right"; return; }
    if (text.endsWith("{")) {
      const reference = parseReference(text.slice(0, -1));
      if (!reference) { result.errors.push({ line, message: "A group needs a name before the opening brace." }); stack.push(""); return; }
      if (!groups.has(reference.name)) {
        nodes.delete(reference.name);
        const group: CloudGroup = { name: reference.name, ...(reference.props.label ? { label: reference.props.label } : {}), ...(reference.props.color && /^#[\da-f]{6}$/i.test(reference.props.color) ? { color: reference.props.color } : {}), ...(stack.length ? { parent: stack[stack.length - 1] } : {}) };
        groups.set(group.name, group); result.groups.push(group);
        result.nodes = result.nodes.filter(node => node.name !== group.name);
      }
      stack.push(reference.name); return;
    }
    // Edge chains: split by operators outside brackets and quotes, keep the operators.
    let labelText: string | undefined; let body = text;
    const colon = splitTop(body, /:\s/); if (colon.length > 1) { labelText = unquote(colon.slice(1).join(": ")); body = colon[0]; }
    const pieces: string[] = []; const operators: CloudArrow[] = []; let cursor = 0; let quote = false; let depth = 0;
    for (let index = 0; index < body.length; index++) {
      const char = body[index];
      if (char === '"') quote = !quote; else if (!quote && char === "[") depth++; else if (!quote && char === "]") depth = Math.max(0, depth - 1);
      else if (!quote && depth === 0) {
        const rest = body.slice(index);
        const arrow = /^(<->|<>|-->|->|<-|<|>)/.exec(rest)?.[0];
        // A bare dash is also a hyphen inside names, so it only counts as an operator between spaces.
        const dash = /^(--|-)(?=\s|$)/.exec(rest)?.[0];
        const operator = arrow ?? (dash && /(^|\s)$/.test(body.slice(0, index)) ? dash : undefined);
        if (operator) { pieces.push(body.slice(cursor, index)); operators.push(operator === "<>" || operator === "<->" ? "both" : operator === "<" || operator === "<-" ? "back" : operator === ">" || operator === "->" || operator === "-->" ? "forward" : "none"); index += operator.length - 1; cursor = index + 1; }
      }
    }
    pieces.push(body.slice(cursor));
    if (operators.length) {
      const sides = pieces.map(piece => splitTop(piece, /,/).map(part => parseReference(part)));
      if (sides.some(side => side.some(reference => !reference))) { result.errors.push({ line, message: "Each side of a connection needs a name." }); return; }
      const names = sides.map(side => side.map(reference => declare(reference!, line)));
      names.forEach((from, position) => {
        if (position === names.length - 1) return;
        for (const a of from) for (const b of names[position + 1]) {
          if (result.edges.length >= MAX_EDGES) { result.errors.push({ line, message: `A diagram can hold up to ${MAX_EDGES} connections.` }); return; }
          result.edges.push({ from: a, to: b, arrow: operators[position], ...(labelText ? { label: labelText } : {}) });
        }
      });
      return;
    }
    for (const part of splitTop(text, /,/)) {
      const reference = parseReference(part);
      if (!reference) { result.errors.push({ line, message: "Could not read this line." }); continue; }
      declare(reference, line);
    }
  });
  if (stack.length) result.errors.push({ line: source.split(/\r?\n/).length, message: `${stack.length} group${stack.length === 1 ? " is" : "s are"} missing a closing brace.` });
  return result;
}
