import type { Element, Point, ShapeElement, TextElement } from "../../model";

type TreeNode = { id: string; label: string; parent?: string; depth: number; directory: boolean; className?: string; icon?: string; defaultIcon?: "folder" | "file"; description?: string; sourceLine: number; sourceColumn: number };
type TreeMetadata = Pick<TreeNode, "parent" | "directory" | "className" | "icon" | "defaultIcon" | "sourceLine" | "sourceColumn">;
const rolePrefix = "mermaid-treeview-node:";
const descriptionPrefix = "mermaid-treeview-description:";
const encode = (value: unknown) => encodeURIComponent(JSON.stringify(value));
const decode = (value: string): TreeMetadata | undefined => { try { return JSON.parse(decodeURIComponent(value)) as TreeMetadata; } catch { return undefined; } };

function sourceLines(source: string) { return source.replace(/\r/g, "").split("\n"); }
function treeViewHeaderIndex(lines: string[]) {
  let start = 0;
  while (start < lines.length && (!lines[start].trim() || /^\s*%%/.test(lines[start]))) start++;
  if (lines[start]?.trim() === "---") {
    start++;
    while (start < lines.length && lines[start].trim() !== "---") start++;
    if (start >= lines.length) return -1;
    start++;
    while (start < lines.length && (!lines[start].trim() || /^\s*%%/.test(lines[start]))) start++;
  }
  return /^\s*treeView-beta\s*$/i.test(lines[start] ?? "") ? start : -1;
}

export function isMermaidTreeView(source: string) { return treeViewHeaderIndex(sourceLines(source)) >= 0; }

function configurationShowIcons(lines: string[], headerIndex: number) {
  if (headerIndex < 0 || !lines.slice(0, headerIndex).some(line => line.trim() === "---")) return false;
  const frontmatter = lines.slice(0, headerIndex).join("\n");
  const treeView = /(?:^|\n)\s*treeView\s*:\s*([\s\S]*?)(?=\n\S|$)/i.exec(frontmatter)?.[1] ?? "";
  return /^\s*showIcons\s*:\s*true\s*$/im.test(treeView);
}

function unquote(value: string) {
  const text = value.trim();
  if (text.length < 2 || !(text.startsWith('"') && text.endsWith('"') || text.startsWith("'") && text.endsWith("'"))) return text;
  const quote = text[0];
  return text.slice(1, -1).replace(/\\([\\"'])/g, "$1").replace(quote === '"' ? /\\n/g : /$^/, "\n");
}

function firstUnquoted(source: string, token: string) {
  let quote = ""; let escaped = false;
  for (let index = 0; index <= source.length - token.length; index++) {
    const char = source[index];
    if (escaped) { escaped = false; continue; }
    if (char === "\\" && quote) { escaped = true; continue; }
    if ((char === '"' || char === "'") && (!quote || quote === char)) { quote = quote ? "" : char; continue; }
    if (!quote && source.startsWith(token, index)) return index;
  }
  return -1;
}

function parseTreeLabel(source: string, line: number, column: number) {
  let rest = source.trim(); let description = ""; let className: string | undefined; let icon: string | undefined;
  const descriptionAt = firstUnquoted(rest, "##");
  if (descriptionAt >= 0) { description = rest.slice(descriptionAt + 2).trim(); rest = rest.slice(0, descriptionAt).trimEnd(); if (!description) throw new Error(`A Mermaid TreeView description cannot be empty (line ${line}, column ${column + descriptionAt + 2}).`); }
  const annotations = /\s+(:::([\w-]+)|icon\(([^()]*)\))\s*$/u;
  while (annotations.test(rest)) {
    const match = annotations.exec(rest)!; rest = rest.slice(0, match.index).trimEnd();
    if (match[2]) { if (className) throw new Error(`A Mermaid TreeView node can have one style class (line ${line}, column ${column + match.index}).`); className = match[2]; }
    else { if (icon !== undefined) throw new Error(`A Mermaid TreeView node can have one icon annotation (line ${line}, column ${column + match.index}).`); icon = match[3].trim(); if (!icon) throw new Error(`A Mermaid TreeView icon name cannot be empty (line ${line}, column ${column + match.index}).`); }
  }
  const directory = /\/$/.test(rest);
  if (directory) rest = rest.slice(0, -1).trimEnd();
  if ((rest.startsWith('"') && !rest.endsWith('"')) || (rest.startsWith("'") && !rest.endsWith("'"))) throw new Error(`Unclosed quoted Mermaid TreeView label (line ${line}, column ${column}).`);
  const label = unquote(rest);
  if (!label) throw new Error(`A Mermaid TreeView node label cannot be empty (line ${line}, column ${column}).`);
  return { label, directory, className, icon, description };
}

function parseBoxLine(line: string) {
  const match = /^((?:(?:│|┃| ){4})*)(?:├──|└──|┣━━|┗━━)\s*(.*)$/.exec(line);
  if (!match) return undefined;
  return { depth: match[1].length / 4, body: match[2], column: match[0].indexOf(match[2]) + 1 };
}

export function parseMermaidTreeView(source: string) {
  const lines = sourceLines(source); const header = treeViewHeaderIndex(lines);
  if (header < 0) throw new Error("Expected a treeView-beta header.");
  const showIcons = configurationShowIcons(lines, header); const data: TreeNode[] = []; const stack: TreeNode[] = [];
  let indentationRoot: number | undefined; let mode: "indent" | "box" | undefined;
  for (let index = header + 1; index < lines.length; index++) {
    const raw = lines[index].replace(/\t/g, "    "); const trimmed = raw.trim();
    if (!trimmed || /^%%/.test(trimmed)) continue;
    if (/^(?:---|treeView-beta)\s*$/i.test(trimmed)) throw new Error(`Unexpected Mermaid TreeView header or frontmatter delimiter (line ${index + 1}, column ${raw.indexOf(trimmed) + 1}).`);
    const box = parseBoxLine(raw);
    const lineMode = box ? "box" : "indent";
    if (mode && mode !== lineMode) throw new Error(`Mermaid TreeView cannot mix indentation and box-drawing rows (line ${index + 1}, column ${raw.search(/\S/) + 1}).`);
    mode ??= lineMode;
    let depth: number; let body: string; let column: number;
    if (box) { depth = box.depth; body = box.body; column = box.column; }
    else {
      const indent = raw.match(/^\s*/)?.[0].length ?? 0; indentationRoot ??= indent;
      if (indent < indentationRoot) throw new Error(`Mermaid TreeView indentation cannot move left of the first node (line ${index + 1}, column ${indent + 1}).`);
      depth = 0; while (stack[depth] && stack[depth].sourceColumn - 1 < indent) depth++;
      while (stack.length && stack[stack.length - 1].sourceColumn - 1 >= indent) stack.pop();
      depth = stack.length; body = raw.slice(indent); column = indent + 1;
    }
    if (box) {
      if (depth > stack.length) throw new Error(`Mermaid TreeView branch has no parent at this depth (line ${index + 1}, column ${column}).`);
      while (stack.length > depth) stack.pop();
    }
    const parent = depth ? stack[depth - 1] : undefined;
    if (depth && !parent) throw new Error(`Mermaid TreeView node is missing its parent (line ${index + 1}, column ${column}).`);
    const parsed = parseTreeLabel(body, index + 1, column);
    const node: TreeNode = { id: `tree_${data.length + 1}`, ...parsed, depth, ...(parsed.icon === undefined && showIcons ? { defaultIcon: parsed.directory ? "folder" : "file" } : {}), ...(parent ? { parent: parent.id } : {}), sourceLine: index + 1, sourceColumn: column };
    data.push(node); stack[depth] = node;
    if (data.length > 300) throw new Error(`Mermaid TreeView is limited to 300 nodes (line ${index + 1}, column ${column}).`);
  }
  if (!data.length) throw new Error("Mermaid TreeView needs at least one node.");
  const rootDepth = Math.min(...data.map(node => node.depth));
  if (rootDepth !== 0) throw new Error("Mermaid TreeView needs a root node at the first indentation level.");
  return { nodes: data, showIcons, frontmatter: lines.slice(0, header).join("\n") };
}

function treeNodeShape(node: TreeNode, bounds: { x: number; y: number; w: number; h: number }): ShapeElement {
  const icon = node.icon === "none" ? "" : node.icon === "folder" || node.defaultIcon === "folder" ? "📁" : node.icon === "file" || node.defaultIcon === "file" ? "📄" : node.icon ? `◇ ${node.icon}` : "";
  const label = `${icon ? `${icon} ` : ""}${node.label}`;
  const highlight = node.className === "highlight";
  return {
    type: "rectangle", id: `mermaid-node:${node.id}`, componentRole: `${rolePrefix}${encode({ parent: node.parent, directory: node.directory, className: node.className, icon: node.icon, defaultIcon: node.defaultIcon, sourceLine: node.sourceLine, sourceColumn: node.sourceColumn })}`,
    ...bounds, color: highlight ? "#c49300" : node.directory ? "#587a9e" : "#8b98a6", thickness: highlight ? 2 : 1, fillColor: highlight ? "#fff4c2" : node.directory ? "#eef4f9" : "#ffffff", fillOpacity: 1,
    edgeStyle: "rounded", cornerRadius: 5, tooltip: node.icon && node.icon !== "none" && node.icon !== "file" && node.icon !== "folder" ? `Mermaid icon: ${node.icon} (shown as a text fallback)` : undefined,
    label: { text: label, color: "#263442", fontSize: 13, fontFamily: "sans", bold: node.directory, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "middle", offsetX: 9 },
  };
}

export function layoutMermaidTreeView(source: string, center: Point): Element[] {
  const parsed = parseMermaidTreeView(source); const positions = new Map<string, { x: number; y: number; w: number; h: number }>(); const shapes: ShapeElement[] = []; const descriptions: TextElement[] = [];
  const maximumDepth = Math.max(...parsed.nodes.map(node => node.depth)); const originX = center.x - (maximumDepth * 40 + 235) / 2; const firstY = center.y - (parsed.nodes.length * 48) / 2;
  parsed.nodes.forEach((node, index) => {
    const bounds = { x: originX + node.depth * 40, y: firstY + index * 48, w: 220, h: 34 }; const shape = treeNodeShape(node, bounds); shapes.push(shape); positions.set(node.id, bounds);
    if (node.description) descriptions.push({ type: "text", id: `${descriptionPrefix}${node.id}`, componentRole: `${descriptionPrefix}${node.id}`, x: bounds.x + bounds.w + 12, y: bounds.y + 8, text: node.description, color: node.className === "highlight" ? "#8b6c00" : "#65717d", fontSize: 12, fontFamily: "sans", italic: true, textAlign: "left", listType: "none", wrapWidth: 280 });
  });
  const links: ShapeElement[] = parsed.nodes.flatMap(node => {
    if (!node.parent) return [];
    const parent = positions.get(node.parent); const child = positions.get(node.id); if (!parent || !child) return [];
    return [{ type: "line", id: `mermaid-link:${node.id}`, componentRole: `mermaid-treeview-edge:${node.parent}:${node.id}`, x: parent.x + parent.w, y: parent.y + parent.h / 2, w: child.x - (parent.x + parent.w), h: child.y + child.h / 2 - (parent.y + parent.h / 2), color: "#9aa7b4", thickness: 1.2, lineRoute: "elbow", startHead: "none", endHead: "none", startBinding: { elementId: `mermaid-node:${node.parent}`, anchor: { x: 1, y: .5 } }, endBinding: { elementId: `mermaid-node:${node.id}`, anchor: { x: 0, y: .5 } } } as ShapeElement];
  });
  return [...links, ...shapes, ...descriptions];
}

function encodeTreeLabel(label: string, directory: boolean) {
  const needsQuotes = /[\s"'\\]/u.test(label) || /^(?:%%|treeView-beta|---)$/i.test(label);
  const quoted = needsQuotes ? `"${label.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"` : label;
  return `${quoted}${directory ? "/" : ""}`;
}

export function exportMermaidTreeView(elements: Element[], originalSource = "") {
  const nodes = elements.flatMap(item => {
    if (item.type !== "rectangle" || !item.componentRole?.startsWith(rolePrefix)) return [];
    const metadata = decode(item.componentRole.slice(rolePrefix.length));
    return metadata ? [{ item, metadata, id: (item.id ?? "").replace(/^mermaid-node:/, "") }] : [];
  });
  if (!nodes.length) throw new Error("This generated TreeView has no editable nodes to export.");
  const byId = new Map(nodes.map(entry => [entry.id, entry]));
  const children = new Map<string, typeof nodes>();
  for (const node of nodes) if (node.metadata.parent && byId.has(node.metadata.parent)) children.set(node.metadata.parent, [...(children.get(node.metadata.parent) ?? []), node]);
  const description = new Map(elements.flatMap(item => item.type === "text" && item.id?.startsWith(descriptionPrefix) ? [[item.id.slice(descriptionPrefix.length), item.text] as const] : []));
  const lines = ["treeView-beta"]; const visited = new Set<string>();
  const visit = (node: typeof nodes[number], depth: number) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    const visibleLabel = node.item.label?.text ?? node.id;
    const icon = node.metadata.icon;
    const renderedPrefix = icon === "folder" || node.metadata.defaultIcon === "folder" ? "📁 " : icon === "file" || node.metadata.defaultIcon === "file" ? "📄 " : icon && icon !== "none" ? `◇ ${icon} ` : "";
    const editableLabel = renderedPrefix && visibleLabel.startsWith(renderedPrefix) ? visibleLabel.slice(renderedPrefix.length) : visibleLabel;
    const label = encodeTreeLabel(editableLabel, node.metadata.directory);
    const annotations = [...(node.metadata.className ? [`:::${node.metadata.className}`] : []), ...(icon ? [`icon(${icon})`] : [])];
    const text = description.get(node.id)?.trim();
    lines.push(`${"  ".repeat(depth)}${label}${annotations.length ? ` ${annotations.join(" ")}` : ""}${text ? ` ## ${text}` : ""}`);
    for (const child of children.get(node.id) ?? []) visit(child, depth + 1);
  };
  for (const node of nodes) if (!node.metadata.parent || !byId.has(node.metadata.parent)) visit(node, 0);
  for (const node of nodes) visit(node, 0);
  const sourceLines = sourceLinesFn(originalSource); const header = treeViewHeaderIndex(sourceLines);
  const frontmatter = header >= 0 ? sourceLines.slice(0, header).join("\n").trim() : "";
  return `${frontmatter ? `${frontmatter}\n` : ""}${lines.join("\n")}\n`;
}

function sourceLinesFn(source: string) { return source.replace(/\r/g, "").split("\n"); }
