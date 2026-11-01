import type { D2Metadata, Element, FlowchartShape, GroupElement, SchemaConstraint, SchemaField, SchemaTableElement, ShapeElement } from "../../model";
import { buildLibraryComponent } from "../components/library-components";
import { elementBounds, unionBounds } from "../canvas/bounds";

type D2Direction = "up" | "down" | "right" | "left";
type D2Row = { name: string; type: string; constraints: string[] };
type D2Node = {
  id: string; path: string; label: string; parent?: D2Node; children: D2Node[]; rows: D2Row[];
  shape: string; block?: boolean; fill?: string; stroke?: string; fontColor?: string; strokeWidth?: number; strokeDash?: string;
  fontSize?: number; icon?: string; near?: string; width?: number; height?: number; gridRows?: number; gridColumns?: number; gridLayout?: D2Layout; line: number;
  x: number; y: number; w: number; h: number;
};
type D2Edge = { from: string; to: string; label: string; direction: "forward" | "reverse" | "both" | "none"; dotted?: boolean; order: number };
type D2Layout = { direction?: D2Direction; gridGap?: number; horizontalGap?: number; verticalGap?: number; padding?: number };
type ParseScope = { kind: "root" | "node" | "vars" | "config" | "style"; node?: D2Node };

const safeId = (value: string) => value.replace(/[^A-Za-z0-9_]/g, "_").replace(/^[^A-Za-z_]+/, "") || "node";
const decodeLabel = (value: string) => {
  const text = value.trim();
  if (text.startsWith('"') && text.endsWith('"')) {
    try { return JSON.parse(text) as string; } catch { return text.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\"); }
  }
  if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1).replace(/\\n/g, "\n").replace(/\\'/g, "'");
  return text;
};
const readKey = (value: string) => decodeLabel(value.trim());
const validColor = (value: string) => /^(?:#[\da-f]{3,8}|[a-z]{1,24}|rgba?\([\d.,%\s]+\))$/i.test(value);
const keyPattern = String.raw`(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z_][\w.-]{0,119})`;

function makeNode(id: string, parent: D2Node | undefined, line: number, label = ""): D2Node {
  const path = parent ? `${parent.path}.${id}` : id;
  return { id, path, label: label || id, parent, children: [], rows: [], shape: "rectangle", line, x: 0, y: 0, w: 180, h: 82 };
}

function locationError(message: string, line: number, raw: string): Error {
  const column = Math.max(1, raw.search(/\S/) + 1);
  return new Error(`${message} (line ${line}, column ${column}): ${raw.trim().slice(0, 100)}`);
}

function applyAttribute(node: D2Node, key: string, rawValue: string, line: number, raw: string) {
  const value = decodeLabel(rawValue);
  if (key === "shape") { node.shape = value.toLowerCase().replace(/-/g, "_"); return; }
  if (key === "label") { node.label = value; return; }
  if (key === "icon") { if (value.length > 2048) throw locationError("D2 icon references are limited to 2,048 characters", line, raw); node.icon = value; return; }
  if (key === "near") { node.near = value; return; }
  if (key === "width" || key === "height") {
    const size = Number(value);
    if (!Number.isFinite(size) || size < 20 || size > 2000) throw locationError(`D2 ${key} must be between 20 and 2,000`, line, raw);
    if (key === "width") node.width = size; else node.height = size;
    return;
  }
  if (key === "grid-rows" || key === "grid-columns") {
    const count = Number(value);
    if (!Number.isInteger(count) || count < 1 || count > 100) throw locationError(`D2 ${key} must be between 1 and 100`, line, raw);
    if (key === "grid-rows") node.gridRows = count; else node.gridColumns = count;
    return;
  }
  if (key === "grid-gap" || key === "horizontal-gap" || key === "vertical-gap") {
    if (node.shape !== "grid") throw locationError(`${key} is supported only on a D2 grid shape`, line, raw);
    const gap = Number(value);
    if (!Number.isFinite(gap) || gap < 0 || gap > 2000) throw locationError(`D2 ${key} must be between 0 and 2,000`, line, raw);
    node.gridLayout ??= {};
    if (key === "grid-gap") node.gridLayout.gridGap = gap;
    else if (key === "horizontal-gap") node.gridLayout.horizontalGap = gap;
    else node.gridLayout.verticalGap = gap;
    return;
  }
  if (key === "style.fill" || key === "style.stroke" || key === "style.font-color") {
    if (!validColor(value)) throw locationError(`Unsupported D2 color value for ${key}`, line, raw);
    if (key === "style.fill") node.fill = value;
    else if (key === "style.stroke") node.stroke = value;
    else node.fontColor = value;
    return;
  }
  if (key === "style.stroke-width" || key === "style.font-size") {
    const size = Number(value);
    if (!Number.isFinite(size) || size < 0 || size > 100) throw locationError(`D2 ${key} must be between 0 and 100`, line, raw);
    if (key === "style.stroke-width") node.strokeWidth = size; else node.fontSize = size;
    return;
  }
  if (key === "style.stroke-dash") { node.strokeDash = value; return; }
  if (key === "far") throw locationError("D2 has no documented 'far' placement attribute; use 'near'", line, raw);
  throw locationError(`Unsupported D2 attribute '${key}'`, line, raw);
}

function rowConstraintStrings(raw: string | undefined) {
  if (!raw) return [];
  const value = raw.trim();
  if (value.startsWith("[") && value.endsWith("]")) return value.slice(1, -1).split(/[;,]/).map(decodeLabel).map(item => item.trim()).filter(Boolean);
  return [decodeLabel(value)];
}

/**
 * Imports SketchDraw's documented D2 subset: nested containers, styled shapes, SQL tables,
 * UML classes, simple sequence diagrams, connections, direction, near hints, and layout padding.
 * Unsupported constructs fail with a source location so partial diagrams are never silent.
 */
export function d2ToDiagram(source: string): Element[] {
  if (source.length > 500_000) throw new Error("D2 input is limited to 500 KB.");
  const root: D2Node = { id: "", path: "", label: "", children: [], rows: [], shape: "root", line: 0, x: 0, y: 0, w: 0, h: 0 };
  const stack: ParseScope[] = [{ kind: "root" }];
  const nodes = new Map<string, D2Node>();
  const edges: D2Edge[] = [];
  const pending: { path: string; scopePath: string; key: string; value: string; line: number; raw: string }[] = [];
  const layout: D2Layout = {};
  let sequence = false;
  let nodeCount = 0;
  const lines = source.replace(/\r/g, "").split("\n");
  if (lines.length > 10_000) throw new Error("D2 diagrams are limited to 10,000 lines.");
  const currentNode = () => [...stack].reverse().find(scope => scope.kind === "node" || scope.kind === "style")?.node;
  const currentParent = () => currentNode() ?? root;
  const addNode = (id: string, label: string, line: number) => {
    const parent = currentParent();
    const path = parent.path ? `${parent.path}.${id}` : id;
    if (path.length > 4096) throw new Error("D2 object paths are limited to 4,096 characters in SketchDraw.");
    const existing = nodes.get(path);
    if (existing) { if (label) existing.label = label; return existing; }
    if (++nodeCount > 500) throw new Error("D2 diagrams are limited to 500 nodes.");
    const node = makeNode(id, parent === root ? undefined : parent, line, label);
    parent.children.push(node); nodes.set(path, node); return node;
  };
  const setLayoutValue = (key: string, value: string, line: number, raw: string) => {
    if (key === "direction") {
      if (!["up", "down", "left", "right"].includes(value)) throw locationError("D2 direction must be up, down, left, or right", line, raw);
      layout.direction = value as D2Direction; return;
    }
    if (key === "pad") {
      const padding = Number(value);
      if (!Number.isFinite(padding) || padding < 0 || padding > 2000) throw locationError("D2 padding must be between 0 and 2,000", line, raw);
      layout.padding = padding; return;
    }
    throw locationError(`Unsupported D2 layout setting '${key}'`, line, raw);
  };

  for (const [lineIndex, rawLine] of lines.entries()) {
    const lineNumber = lineIndex + 1;
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      const hint = /^#\s*SketchDraw layout:\s*(\{.*\})$/.exec(line);
      if (hint) {
        try {
          const value = JSON.parse(hint[1]) as D2Layout;
          if (["up", "down", "left", "right"].includes(String(value.direction))) layout.direction = value.direction;
          for (const key of ["gridGap", "horizontalGap", "verticalGap", "padding"] as const) if (Number.isFinite(value[key])) layout[key] = Math.max(0, Math.min(2000, value[key]!));
        } catch { throw locationError("Invalid SketchDraw D2 layout hint", lineNumber, rawLine); }
      }
      continue;
    }
    if (line === "}") {
      if (stack.length === 1) throw locationError("Unexpected closing brace", lineNumber, rawLine);
      stack.pop(); continue;
    }
    const scope = stack[stack.length - 1];
    if (scope.kind === "root" && /^shape\s*:\s*sequence_diagram$/i.test(line)) { sequence = true; continue; }
    if (scope.kind === "root" && /^direction\s*:\s*(up|down|left|right)$/i.test(line)) { setLayoutValue("direction", line.split(":")[1].trim().toLowerCase(), lineNumber, rawLine); continue; }
    if (scope.kind === "root" && /^vars\s*:\s*\{\s*$/.test(line)) { stack.push({ kind: "vars" }); continue; }
    if (scope.kind === "vars" && /^d2-config\s*:\s*\{\s*$/.test(line)) { stack.push({ kind: "config" }); continue; }
    if (scope.kind === "config") {
      const config = /^([\w-]+)\s*:\s*(.+)$/.exec(line);
      if (config) { setLayoutValue(config[1], decodeLabel(config[2]), lineNumber, rawLine); continue; }
      throw locationError("Unsupported D2 configuration syntax", lineNumber, rawLine);
    }
    if (scope.kind === "vars") throw locationError("Only vars.d2-config.pad is supported in the D2 subset", lineNumber, rawLine);

    if (scope.kind === "style") {
      const styleEntry = /^([\w-]+)\s*:\s*(.+)$/.exec(line);
      if (!styleEntry) throw locationError("Unsupported D2 style block syntax", lineNumber, rawLine);
      if (!["fill", "stroke", "font-color", "stroke-width", "stroke-dash", "font-size"].includes(styleEntry[1])) throw locationError(`Unsupported D2 style '${styleEntry[1]}'`, lineNumber, rawLine);
      applyAttribute(scope.node!, `style.${styleEntry[1]}`, styleEntry[2], lineNumber, rawLine); continue;
    }

    const styleBlock = /^(?:(.+?)\.)?style\s*:\s*\{\s*$/.exec(line);
    if (styleBlock) {
      const targetPath = styleBlock[1] ? readKey(styleBlock[1]) : undefined;
      const target = targetPath ? nodes.get(targetPath) : currentNode();
      if (!target) throw locationError("D2 style block must belong to a declared object", lineNumber, rawLine);
      stack.push({ kind: "style", node: target }); continue;
    }

    const activeAttribute = /^([\w.-]+)\s*:\s*(.+)$/.exec(line);
    if (scope.kind === "node" && activeAttribute && /^(?:shape|label|icon|near|far|width|height|style\.[\w-]+|grid-rows|grid-columns|grid-gap|horizontal-gap|vertical-gap)$/.test(activeAttribute[1])) {
      applyAttribute(scope.node!, activeAttribute[1], activeAttribute[2], lineNumber, rawLine); continue;
    }

    if (scope.kind === "node" && scope.node?.shape === "class" && !/^(?:shape|label|icon|near|far|width|height|style\.)/.test(line)) {
      if (scope.node.rows.length >= 300) throw new Error("A D2 UML class is limited to 300 members.");
      if (!/^[+\-#~]?\s*[\w$#~+\-]+(?:\([^)]*\))?(?:\s*:\s*.+)?$/.test(line)) throw locationError("Unsupported D2 UML class member", lineNumber, rawLine);
      const call = line.includes("(");
      scope.node.rows.push({ name: call ? `method:${line}` : `field:${line}`, type: "", constraints: [] });
      continue;
    }

    const edgeMatch = new RegExp(`^(${keyPattern}(?:\\.${keyPattern})?)\\s*(<->|->|-->|--|<--|<-|\\.\.>)\\s*(${keyPattern}(?:\\.${keyPattern})?)(?:\\s*:\\s*(.+))?$`).exec(line);
    if (edgeMatch) {
      if (edges.length >= 5000) throw new Error("D2 diagrams are limited to 5,000 connectors.");
      const [, from, operator, to, rawLabel = ""] = edgeMatch;
      edges.push({ from: readKey(from), to: readKey(to), label: decodeLabel(rawLabel), direction: operator === "--" ? "none" : operator === "<->" ? "both" : operator === "<--" || operator === "<-" ? "reverse" : "forward", dotted: operator === "..>", order: edges.length });
      continue;
    }

    const opener = new RegExp(`^(${keyPattern})\\s*:\\s*(.*?)\\s*\\{\\s*$`).exec(line);
    if (opener) {
      const id = readKey(opener[1]);
      const label = decodeLabel(opener[2] ?? "");
      if (stack.filter(item => item.kind === "node").length >= 32) throw new Error("D2 groups can be nested up to 32 levels deep.");
      const candidatePath = currentParent().path ? `${currentParent().path}.${id}` : id;
      if (nodes.has(candidatePath)) throw locationError(`D2 object '${candidatePath}' has more than one block declaration`, lineNumber, rawLine);
      const node = addNode(id, label, lineNumber);
      node.block = true;
      stack.push({ kind: "node", node }); continue;
    }

    const property = /^(.+?)\.(shape|label|icon|near|far|width|height|style\.[\w-]+)\s*:\s*(.+)$/.exec(line);
    if (property) {
      pending.push({ path: readKey(property[1]), scopePath: currentParent().path, key: property[2], value: property[3], line: lineNumber, raw: rawLine }); continue;
    }

    const nodeLine = new RegExp(`^(${keyPattern})\\s*:\\s*(.+)$`).exec(line);
    if (nodeLine && !/^(shape|direction|grid-gap|horizontal-gap|vertical-gap)$/i.test(readKey(nodeLine[1]))) {
      const parent = currentParent();
      if (parent.shape === "sql_table") {
        const row = new RegExp(`^(${keyPattern})\\s*:\\s*("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|[^\\s{]+)(?:\\s*\\{\\s*constraint\\s*:\\s*(.*?)\\s*\\})?$`).exec(line);
        if (!row) throw locationError("Unsupported D2 SQL-table row", lineNumber, rawLine);
        parent.rows.push({ name: readKey(row[1]), type: decodeLabel(row[2]), constraints: rowConstraintStrings(row[3]) });
        if (parent.rows.length > 300) throw new Error("A D2 SQL table is limited to 300 fields.");
        continue;
      }
      const id = readKey(nodeLine[1]);
      const value = nodeLine[2].trim();
      if (parent.shape === "class" && ["shape", "label", "icon", "near", "far", "width", "height"].includes(id) || parent.shape === "class" && id.startsWith("style.")) {
        applyAttribute(parent, id, value, lineNumber, rawLine); continue;
      }
      if (parent.shape === "class") throw locationError("UML class members use 'name: Type' or 'method()' syntax; inline member blocks are not supported", lineNumber, rawLine);
      const inline = /^([^{}]+?)\s*\{\s*([^{}]+)\s*\}$/.exec(value);
      if (inline && currentNode()) {
        const inlineProperty = /^([\w.-]+)\s*:\s*(.+)$/.exec(inline[2]);
        if (inlineProperty && parent.shape !== "sql_table") {
          const child = addNode(id, decodeLabel(inline[1]), lineNumber);
          applyAttribute(child, inlineProperty[1], inlineProperty[2], lineNumber, rawLine);
          continue;
        }
      }
      addNode(id, decodeLabel(value), lineNumber);
      continue;
    }

    const attribute = /^([\w.-]+)\s*:\s*(.+)$/.exec(line);
    if (attribute) {
      const [, key, value] = attribute;
      const active = currentNode();
      if (active) { applyAttribute(active, key, value, lineNumber, rawLine); continue; }
      if (scope.kind === "root") throw locationError(`Unsupported D2 diagram attribute '${key}'`, lineNumber, rawLine);
    }

    if (scope.kind === "node" && scope.node?.shape === "class") {
      if (scope.node.rows.length >= 300) throw new Error("A D2 UML class is limited to 300 members.");
      const member = line.replace(/^\s*/, "");
      if (!/^[+\-#~]?\s*[\w$#~+\-]+(?:\([^)]*\))?(?:\s*:\s*.+)?$/.test(member)) throw locationError("Unsupported D2 UML class member", lineNumber, rawLine);
      const call = member.includes("(");
      scope.node.rows.push({ name: call ? `method:${member}` : `field:${member}`, type: "", constraints: [] });
      continue;
    }

    const bare = new RegExp(`^${keyPattern}$`).exec(line);
    if (bare) { addNode(readKey(line), readKey(line), lineNumber); continue; }
    throw locationError("Unsupported D2 syntax", lineNumber, rawLine);
  }
  if (stack.length !== 1) throw new Error(`D2 object '${stack[stack.length - 1].node?.path ?? "vars"}' is missing a closing brace.`);

  const resolveAttributeTarget = (item: typeof pending[number]) => {
    let scopePath = item.scopePath;
    while (scopePath) {
      const candidate = nodes.get(`${scopePath}.${item.path}`);
      if (candidate) return candidate;
      const separator = scopePath.lastIndexOf(".");
      scopePath = separator < 0 ? "" : scopePath.slice(0, separator);
    }
    const exact = nodes.get(item.path);
    if (exact) return exact;
    if (!item.path.includes(".")) {
      const matches = [...nodes.values()].filter(node => node.id.toLocaleLowerCase() === item.path.toLocaleLowerCase());
      if (matches.length === 1) return matches[0];
    }
    return undefined;
  };
  for (const item of pending) {
    const node = resolveAttributeTarget(item);
    if (!node) throw locationError(`D2 attribute references unknown object '${item.path}'`, item.line, item.raw);
    applyAttribute(node, item.key, item.value, item.line, item.raw);
  }
  const findNode = (sourceId: string) => {
    if (nodes.has(sourceId)) return nodes.get(sourceId)!;
    const caseFolded = [...nodes.entries()].find(([path]) => path.toLocaleLowerCase() === sourceId.toLocaleLowerCase())?.[1];
    if (caseFolded) return caseFolded;
    if (!sourceId.includes(".")) {
      const matches = [...nodes.values()].filter(node => node.id.toLocaleLowerCase() === sourceId.toLocaleLowerCase());
      if (matches.length === 1) return matches[0];
    }
    const parts = sourceId.split(".");
    for (let index = parts.length - 1; index > 0; index--) {
      const candidate = parts.slice(0, index).join(".");
      const found = nodes.get(candidate);
      if (found?.shape === "sql_table") return found;
    }
    return undefined;
  };
  for (const edge of edges) {
    const from = findNode(edge.from); const to = findNode(edge.to);
    const sourceNode = from ?? addNode(edge.from.split(".")[0], edge.from.split(".")[0], 0);
    const targetNode = to ?? addNode(edge.to.split(".")[0], edge.to.split(".")[0], 0);
    if (sequence) continue;
    const sourceField = edge.from.startsWith(`${sourceNode.path}.`) ? edge.from.slice(sourceNode.path.length + 1) : undefined;
    const targetField = edge.to.startsWith(`${targetNode.path}.`) ? edge.to.slice(targetNode.path.length + 1) : undefined;
    if (sourceNode.shape === "sql_table" && sourceField && targetNode.shape === "sql_table" && targetField) {
      const field = sourceNode.rows.find(row => row.name === sourceField);
      if (field) field.constraints = [...new Set([...field.constraints, `references:${targetNode.path}.${targetField}`, "foreign_key"])];
    }
  }
  const allNodes = [...nodes.values()];
  if (!allNodes.length) throw new Error("No D2 nodes, containers, tables, classes, or sequence messages were found.");
  if (allNodes.filter(node => node.children.length || node.block && !["sql_table", "class"].includes(node.shape)).length > 100) throw new Error("D2 diagrams are limited to 100 groups.");
  if (sequence && allNodes.some(node => node.parent)) throw new Error("Nested containers inside D2 sequence diagrams are not supported yet.");

  const direction = layout.direction ?? "right";
  const hGap = layout.horizontalGap ?? layout.gridGap ?? 92;
  const vGap = layout.verticalGap ?? layout.gridGap ?? 70;
  const padding = layout.padding ?? 24;
  const metadataLayout = { ...layout, direction };

  const dimensions = (node: D2Node) => {
    const label = node.label || node.id;
    const widest = Math.max(label.length, ...node.rows.map(row => row.name.length + row.type.length + 3), 0);
    if (node.shape === "sql_table") { node.w = node.width ?? Math.max(180, Math.min(360, 34 + widest * 7)); node.h = node.height ?? 32 + Math.max(1, node.rows.length) * 23; }
    else if (node.shape === "class") { node.w = node.width ?? Math.max(220, Math.min(440, 54 + widest * 7)); node.h = node.height ?? Math.max(120, 68 + Math.max(1, node.rows.length) * 20); }
    else if (node.children.length) { node.w = node.width ?? 180; node.h = node.height ?? 110; }
    else { node.w = node.width ?? Math.max(140, Math.min(360, 50 + widest * 7)); node.h = node.height ?? Math.max(72, 44 + Math.max(1, label.split(/\n/).length) * 21); }
  };
  allNodes.forEach(dimensions);

  if (sequence) {
    const participants = new Map<string, D2Node>();
    for (const node of allNodes.filter(item => !item.parent)) participants.set(node.path, node);
    for (const edge of edges) {
      const from = findNode(edge.from); const to = findNode(edge.to);
      if (from) participants.set(from.path, from);
      if (to) participants.set(to.path, to);
    }
    const ordered = [...participants.values()];
    if (!ordered.length || !edges.length) throw new Error("D2 sequence diagrams need participants and at least one message.");
    ordered.forEach((node, index) => { node.x = padding + index * (156 + hGap); node.y = padding; node.w = node.width ?? 156; node.h = padding + 82 + Math.max(1, edges.length) * 58; });
  } else {
    const arrange = (parent: D2Node, ox: number, oy: number): { w: number; h: number } => {
      const children = parent.children;
      if (!children.length) return { w: parent.w, h: parent.h };
      const childSizes = children.map(child => child.children.length ? arrange(child, 0, 0) : { w: child.w, h: child.h });
      const columns = parent.shape === "grid" ? parent.gridColumns ?? (parent.gridRows ? Math.max(1, Math.ceil(children.length / parent.gridRows)) : Math.max(1, Math.ceil(Math.sqrt(children.length)))) : Math.max(1, Math.ceil(Math.sqrt(children.length)));
      const rows = parent.shape === "grid" ? parent.gridRows ?? Math.ceil(children.length / columns) : Math.ceil(children.length / columns);
      const parentHGap = parent.gridLayout?.horizontalGap ?? parent.gridLayout?.gridGap ?? hGap;
      const parentVGap = parent.gridLayout?.verticalGap ?? parent.gridLayout?.gridGap ?? vGap;
      const columnWidths = Array.from({ length: columns }, (_, col) => Math.max(...children.map((_, index) => index % columns === col ? childSizes[index].w : 0)));
      const rowHeights = Array.from({ length: rows }, (_, row) => Math.max(...children.map((_, index) => Math.floor(index / columns) === row ? childSizes[index].h : 0)));
      const positions: { x: number; y: number }[] = [];
      let rowY = oy + padding;
      for (let row = 0; row < rows; row++) {
        let colX = ox + padding;
        for (let col = 0; col < columns; col++) {
          const index = row * columns + col; if (index >= children.length) break;
          positions[index] = { x: colX, y: rowY };
          colX += columnWidths[col] + parentHGap;
        }
        rowY += rowHeights[row] + parentVGap;
      }
      for (let index = 0; index < children.length; index++) {
        const position = positions[index]; const child = children[index];
        if (direction === "left") position.x = ox + padding + (columns - 1 - (index % columns)) * (columnWidths[index % columns] + parentHGap);
        if (direction === "up") position.y = oy + padding + (rows - 1 - Math.floor(index / columns)) * (rowHeights[Math.floor(index / columns)] + parentVGap);
        child.x = position.x; child.y = position.y;
        if (child.children.length) arrange(child, child.x, child.y);
      }
      const contentW = columnWidths.reduce((sum, value) => sum + value, 0) + Math.max(0, columns - 1) * parentHGap;
      const contentH = rowHeights.reduce((sum, value) => sum + value, 0) + Math.max(0, rows - 1) * parentVGap;
      parent.w = parent.width ?? contentW + padding * 2;
      parent.h = parent.height ?? contentH + padding * 2;
      return { w: parent.w, h: parent.h };
    };
    const arrangement = arrange(root, 0, 0);
    // D2 `near` is a layout hint. Compass positions and object proximity are approximated in
    // SketchDraw's deterministic layout; exact TALA/ELK/Dagre placement is not reproduced.
    const placed = allNodes.filter(node => !node.near);
    const bounds = unionBounds(placed.filter(node => !node.children.length).map(node => ({ x: node.x, y: node.y, w: node.w, h: node.h })));
    for (const node of allNodes.filter(item => item.near)) {
      const place = node.near!.replace(/^outside-/, "");
      const area = bounds ?? { x: padding, y: padding, w: arrangement.w, h: arrangement.h };
      if (["top-left", "top-center", "top-right", "center-left", "center-right", "bottom-left", "bottom-center", "bottom-right"].includes(place)) {
        node.x = place.endsWith("left") ? area.x : place.endsWith("right") ? area.x + area.w - node.w : area.x + area.w / 2 - node.w / 2;
        node.y = place.startsWith("top") ? area.y : place.startsWith("bottom") ? area.y + area.h - node.h : area.y + area.h / 2 - node.h / 2;
        continue;
      }
      const target = findNode(node.near!);
      if (target) { node.x = target.x + target.w + hGap / 2; node.y = target.y; continue; }
      throw new Error(`Unsupported D2 near value '${node.near}' on '${node.path}'.`);
    }
  }

  const usedIds = new Set<string>();
  const elementId = (prefix: string, value: string) => {
    const base = `${prefix}-${safeId(value)}`.slice(0, 94); let id = base; let suffix = 2;
    while (usedIds.has(id)) { const tail = `-${suffix++}`; id = `${base.slice(0, 100 - tail.length)}${tail}`; }
    usedIds.add(id); return id;
  };
  const elementByPath = new Map<string, Element>();
  const metadata = (node: D2Node): D2Metadata => ({ shape: node.shape, ...(node.icon ? { icon: node.icon } : {}), ...(node.near ? { near: node.near } : {}), ...(node.fill ? { fill: node.fill } : {}), ...(node.stroke ? { stroke: node.stroke } : {}), ...(node.fontColor ? { fontColor: node.fontColor } : {}), ...(node.strokeWidth === undefined ? {} : { strokeWidth: node.strokeWidth }), ...(node.strokeDash ? { strokeDash: node.strokeDash } : {}), ...(node.fontSize === undefined ? {} : { fontSize: node.fontSize }), ...(node.gridRows ? { gridRows: node.gridRows } : {}), ...(node.gridColumns ? { gridColumns: node.gridColumns } : {}), layout: { ...metadataLayout, ...node.gridLayout } });
  const color = (node: D2Node) => node.stroke ?? "#64748b";
  const makeShape = (node: D2Node): ShapeElement => {
    const common = { id: elementId("d2", node.path), liveKey: node.path, d2: metadata(node), x: node.x, y: node.y, w: node.w, h: node.h, color: color(node), thickness: node.strokeWidth ?? 2, fillColor: node.fill ?? "#ffffff", label: { text: node.label || node.id, color: node.fontColor ?? "#172033", fontSize: node.fontSize ?? 14, fontFamily: "sans" as const, bold: false, italic: false, underline: false, textAlign: "center" as const, listType: "none" as const, verticalAlign: "middle" as const }, ...(node.icon ? { altText: `D2 icon: ${node.icon}`, tooltip: `D2 icon: ${node.icon}` } : {}) };
    const standard: Record<string, "circle" | "diamond" | "rectangle"> = { circle: "circle", oval: "circle", ellipse: "circle", diamond: "diamond", rectangle: "rectangle", square: "rectangle" };
    const flowMap: Record<string, FlowchartShape> = { hexagon: "hexagon", cloud: "cloud", cylinder: "database", database: "database", document: "document", parallelogram: "parallelogram", callout: "callout", queue: "predefined-process", stored_data: "stored-data", person: "terminator", step: "process", page: "document", package: "predefined-process", text: "process" };
    const basic = standard[node.shape];
    if (basic) return { type: basic, ...common };
    if (flowMap[node.shape]) return { type: "flowchart", flowchartShape: flowMap[node.shape], ...common };
    return { type: "rectangle", componentRole: `d2-shape-fallback:${node.shape}`, ...common };
  };
  const classElement = (node: D2Node): GroupElement => {
    const attributes = node.rows.filter(row => row.name.startsWith("field:")).map(row => row.name.slice(6));
    const methods = node.rows.filter(row => row.name.startsWith("method:")).map(row => row.name.slice(7));
    const base = buildLibraryComponent("uml-class", node.x, node.y);
    const componentFields = (base.libraryComponent?.componentFields ?? []).map(field => field.key === "attributes" ? { ...field, value: attributes.join("\n") } : field.key === "methods" ? { ...field, value: methods.join("\n") } : field);
    return { ...base, id: elementId("d2-class", node.path), liveKey: node.path, d2: metadata(node), componentRole: `d2-class:${node.path}`, componentBounds: { x: node.x, y: node.y, w: node.w, h: node.h }, libraryComponent: { ...base.libraryComponent!, label: node.label || node.id, componentFields }, ...(node.icon ? { altText: `D2 icon: ${node.icon}`, tooltip: `D2 icon: ${node.icon}` } : {}) };
  };
  const tableElement = (node: D2Node): SchemaTableElement => {
    const fields: SchemaField[] = node.rows.map((row, index) => {
      const references = row.constraints.find(item => item.startsWith("references:"))?.slice("references:".length);
      const [foreignTable, foreignColumn] = references?.split(/\.(?=[^.]+$)/) ?? [];
      return { id: elementId("d2-column", `${node.path}-${row.name}-${index}`), name: row.name, dataType: row.type, primaryKey: row.constraints.includes("primary_key"), nullable: row.constraints.includes("not_null") || row.constraints.includes("NOT NULL") || row.constraints.includes("primary_key") ? false : undefined, ...(foreignTable ? { foreignTable, foreignColumn } : {}) };
    });
    const constraints: SchemaConstraint[] = [...node.rows.filter(row => row.constraints.includes("unique")).map(row => ({ kind: "unique" as const, columns: [row.name] })), ...node.rows.filter(row => row.constraints.includes("foreign_key") && !row.constraints.some(value => value.startsWith("references:"))).map(row => ({ kind: "foreign-key" as const, columns: [row.name] }))];
    return { type: "schemaTable", id: elementId("d2-table", node.path), liveKey: node.path, d2: metadata(node), name: node.label || node.id, x: node.x, y: node.y, w: node.w, h: node.h, columns: fields, schemaDiagramId: "d2-import", schemaSource: "", ...(constraints.length ? { constraints } : {}) };
  };
  for (const node of allNodes) {
    if (sequence || node.children.length) continue;
    const element = node.shape === "sql_table" ? tableElement(node) : node.shape === "class" ? classElement(node) : makeShape(node);
    elementByPath.set(node.path, element);
  }

  if (sequence) {
    const participants = [...new Map(allNodes.map(node => [node.path, node])).values()];
    const participantGroups = new Map<string, GroupElement>();
    for (const [index, node] of participants.entries()) {
      const id = elementId("d2-sequence", node.path); const messageHeight = Math.max(1, edges.length) * 58;
      const header: ShapeElement = { type: "rectangle", id: `${id}-header`, liveKey: node.path, d2: { ...metadata(node), sequenceKind: "participant", sequenceOrder: index }, x: node.x, y: node.y, w: node.w, h: 46, color: color(node), thickness: node.strokeWidth ?? 1.5, fillColor: node.fill ?? "#f4f7fa", label: { text: node.label || node.id, color: node.fontColor ?? "#172033", fontSize: node.fontSize ?? 14, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } };
      const lifeline: ShapeElement = { type: "line", id: `${id}-lifeline`, x: node.x + node.w / 2, y: node.y + 46, w: 0, h: messageHeight, color: "#94a3b8", thickness: 1.2, lineStyle: "dashed" };
      const group: GroupElement = { type: "group", id, liveKey: node.path, d2: { ...metadata(node), sequenceKind: "participant", sequenceOrder: index }, componentRole: `d2-sequence-participant:${node.path}`, elements: [header, lifeline], componentBounds: { x: node.x, y: node.y, w: node.w, h: 46 + messageHeight }, container: { kind: "container", name: node.label || node.id, showBorder: false, showLabel: false, clipChildren: false, autoResize: false, padding: 0 } };
      participantGroups.set(node.path, group); elementByPath.set(node.path, group);
    }
    const messageElements: ShapeElement[] = edges.map((edge, index) => {
      const from = findNode(edge.from) ?? nodes.get(edge.from.split(".")[0]); const to = findNode(edge.to) ?? nodes.get(edge.to.split(".")[0]);
      if (!from || !to) throw new Error("D2 sequence message refers to an unknown participant.");
      const actualFrom = edge.direction === "reverse" ? to : from; const actualTo = edge.direction === "reverse" ? from : to;
      const fromGroup = participantGroups.get(actualFrom.path)!; const toGroup = participantGroups.get(actualTo.path)!;
      const fromBounds = fromGroup.componentBounds!; const toBounds = toGroup.componentBounds!;
      const y = padding + 78 + index * 58; const forward = fromBounds.x <= toBounds.x;
      const startAnchor = { x: forward ? 1 : 0, y: Math.max(0, Math.min(1, (y - fromBounds.y) / fromBounds.h)) };
      const endAnchor = { x: forward ? 0 : 1, y: Math.max(0, Math.min(1, (y - toBounds.y) / toBounds.h)) };
      return { type: edge.direction === "none" ? "line" : "arrow", id: elementId("d2-message", String(index + 1)), d2: { shape: "sequence-message", sequenceKind: "message", sequenceOrder: edge.order, layout: metadataLayout }, componentRole: `d2-sequence-message:${edge.direction}`, x: forward ? fromBounds.x + fromBounds.w : fromBounds.x, y, w: forward ? toBounds.x - fromBounds.x - fromBounds.w : toBounds.x + toBounds.w - fromBounds.x, h: 0, color: "#64748b", thickness: 1.5, ...(edge.direction === "none" ? { lineRoute: "straight" as const } : { arrowRoute: "straight" as const, endHead: edge.direction === "both" ? "solid" as const : "solid" as const, ...(edge.direction === "both" ? { startHead: "solid" as const } : {}) }), ...(edge.dotted ? { lineStyle: "dotted" as const } : {}), startBinding: { elementId: fromGroup.id!, anchor: startAnchor }, endBinding: { elementId: toGroup.id!, anchor: endAnchor }, ...(edge.label ? { label: { text: edge.label, color: "#475569", fontSize: 12, fontFamily: "sans" as const, bold: false, italic: false, underline: false, textAlign: "center" as const, listType: "none" as const, verticalAlign: "top" as const } } : {}) } as ShapeElement;
    });
    return [...messageElements, ...participants.map(node => participantGroups.get(node.path)!)];
  }

  const buildContainer = (node: D2Node): GroupElement => {
    const cached = elementByPath.get(node.path);
    if (cached?.type === "group") return cached;
    const contents: Element[] = node.children.flatMap(child => {
      if (child.children.length) return [buildContainer(child)];
      const element = elementByPath.get(child.path); return element ? [element] : [];
    });
    const bounds = unionBounds(contents.map(elementBounds));
    const padding = 20;
    const group: GroupElement = { type: "group", id: elementId("d2-group", node.path), liveKey: node.path, d2: metadata(node), componentRole: `d2-container:${node.path}`, elements: contents, componentBounds: bounds ? { x: bounds.x - padding, y: bounds.y - padding, w: bounds.w + padding * 2, h: bounds.h + padding * 2 } : { x: node.x, y: node.y, w: node.w, h: node.h }, container: { kind: "container", name: node.label || node.id, showBorder: true, showLabel: true, borderColor: node.stroke ?? "#64748b", borderThickness: node.strokeWidth ?? 1.5, background: node.fill, clipChildren: false, autoResize: false, padding } };
    elementByPath.set(node.path, group);
    return group;
  };
  for (const node of allNodes.filter(item => item.near)) {
    if (node.children.length) continue;
    const item = elementByPath.get(node.path);
    if (item && (item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "flowchart" || item.type === "schemaTable")) { item.x = node.x; item.y = node.y; }
    else if (item?.type === "group" && item.componentBounds) { item.componentBounds = { ...item.componentBounds, x: node.x, y: node.y }; }
  }
  for (const node of allNodes.filter(item => item.children.length)) buildContainer(node);
  const resolveEdgeNode = (sourceId: string) => {
    const exact = elementByPath.get(sourceId); if (exact) return exact;
    if (!sourceId.includes(".")) {
      const matches = allNodes.filter(node => node.id === sourceId).map(node => elementByPath.get(node.path)).filter((item): item is Element => !!item);
      if (matches.length === 1) return matches[0];
    }
    const parts = sourceId.split(".");
    for (let index = parts.length - 1; index > 0; index--) { const parent = elementByPath.get(parts.slice(0, index).join(".")); if (parent?.type === "schemaTable") return parent; }
    return undefined;
  };
  const connectors: ShapeElement[] = edges.flatMap((edge, index) => {
    const fromElement = resolveEdgeNode(edge.from); const toElement = resolveEdgeNode(edge.to);
    if (!fromElement || !toElement) return [];
    const fromBounds = elementBounds(fromElement); const toBounds = elementBounds(toElement);
    const dx = toBounds.x + toBounds.w / 2 - fromBounds.x - fromBounds.w / 2; const dy = toBounds.y + toBounds.h / 2 - fromBounds.y - fromBounds.h / 2;
    const start = Math.abs(dx) >= Math.abs(dy) ? { x: dx >= 0 ? 1 : 0, y: .5 } : { x: .5, y: dy >= 0 ? 1 : 0 };
    const end = Math.abs(dx) >= Math.abs(dy) ? { x: dx >= 0 ? 0 : 1, y: .5 } : { x: .5, y: dy >= 0 ? 0 : 1 };
    const a = { x: fromBounds.x + fromBounds.w * start.x, y: fromBounds.y + fromBounds.h * start.y };
    const b = { x: toBounds.x + toBounds.w * end.x, y: toBounds.y + toBounds.h * end.y };
    const direction = edge.direction === "reverse" ? "reverse" : edge.direction;
    const actualA = direction === "reverse" ? b : a; const actualB = direction === "reverse" ? a : b;
    return [{ type: edge.direction === "none" ? "line" : "arrow", id: elementId("d2-edge", String(index + 1)), d2: { shape: "connection", sequenceOrder: edge.order, layout: metadataLayout }, x: actualA.x, y: actualA.y, w: actualB.x - actualA.x, h: actualB.y - actualA.y, color: "#64748b", thickness: 1.6, ...(edge.direction === "none" ? { lineRoute: "elbow" as const } : { arrowRoute: "elbow" as const, endHead: "solid" as const, ...(edge.direction === "both" ? { startHead: "solid" as const } : {}) }), ...(edge.dotted ? { lineStyle: "dotted" as const } : {}), startBinding: { elementId: direction === "reverse" ? toElement.id! : fromElement.id!, anchor: direction === "reverse" ? end : start }, endBinding: { elementId: direction === "reverse" ? fromElement.id! : toElement.id!, anchor: direction === "reverse" ? start : end }, ...(edge.label ? { label: { text: edge.label, color: "#475569", fontSize: 12, fontFamily: "sans" as const, bold: false, italic: false, underline: false, textAlign: "center" as const, listType: "none" as const, verticalAlign: "top" as const } } : {}) } as ShapeElement];
  });
  const topLevel = root.children.map(node => elementByPath.get(node.path)).filter((item): item is Element => !!item);
  // Apply source layout metadata to all editable roots so export after a .sketch save retains it.
  const roots = [...connectors, ...topLevel].map(item => ({ ...item, d2: { ...(item.d2 ?? {}), layout: item.d2?.layout ?? metadataLayout } } as Element));
  return roots;
}
