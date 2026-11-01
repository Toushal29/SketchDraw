import type { Element, GroupElement, Point, ShapeElement } from "../../model";

type ZenParticipant = { id: string; label: string; annotator?: string; line?: number; aliasStart?: number; aliasEnd?: number };
type ZenMessage = { kind: "message" | "call" | "create" | "reply" | "comment"; from?: string; to?: string; label: string; operator?: string; line: number; start: number; end: number; reply?: boolean; children?: ZenStatement[] };
type ZenBranch = { label: string; line: number; start: number; end: number; children: ZenStatement[] };
type ZenFragment = { kind: "fragment"; fragment: string; branches: ZenBranch[]; line: number; children?: ZenStatement[] };
type ZenStatement = ZenMessage | ZenFragment;
type ZenDiagram = { participants: ZenParticipant[]; statements: ZenStatement[]; title?: string; sourceLines: string[] };
const LIMIT = 100_000;
const MAX_PARTICIPANTS = 100;
const MAX_STATEMENTS = 500;
const MAX_DEPTH = 24;
const encode = (value: unknown) => encodeURIComponent(JSON.stringify(value));
const decode = <T,>(value: string): T => JSON.parse(decodeURIComponent(value)) as T;

export function isMermaidZenUml(source: string) {
  return source.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n").find(line => line.trim() && !/^\s*%%/.test(line))?.trim().toLowerCase() === "zenuml";
}

function fail(message: string, line: string, lineIndex: number, column = line.search(/\S/)): never {
  throw new Error(`${message} (line ${lineIndex + 1}, column ${Math.max(1, column + 1)}).`);
}

function parse(source: string): ZenDiagram {
  if (source.length > LIMIT) throw new Error(`Mermaid ZenUML input is limited to ${LIMIT.toLocaleString()} characters.`);
  const lines = source.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
  const header = lines.findIndex(line => /^\s*zenuml\s*$/i.test(line));
  if (header < 0) throw new Error("Start a ZenUML diagram with zenuml.");
  const participants = new Map<string, ZenParticipant>();
  const root: ZenStatement[] = [];
  type Context = { target: ZenStatement[]; owner?: ZenFragment; currentParticipant?: string; returnTarget?: string };
  const stack: Context[] = [{ target: root }];
  let title = ""; let pendingAnnotator = ""; let pendingReply = false; let pendingBranchOwner: ZenFragment | undefined; let statements = 0;
  const context = () => stack[stack.length - 1];
  const ensureParticipant = (id: string, label = id, data: Partial<ZenParticipant> = {}) => {
    if (!/^[A-Za-z_][\w.-]{0,79}$/.test(id)) throw new Error(`Invalid ZenUML participant identifier: ${id}`);
    const existing = participants.get(id);
    if (existing && data.line !== undefined && existing.line !== undefined) fail(`Duplicate ZenUML participant "${id}"`, lines[data.line] ?? id, data.line);
    if (existing) {
      if (data.annotator) existing.annotator = data.annotator;
      if (data.line !== undefined) { existing.line = data.line; existing.aliasStart = data.aliasStart; existing.aliasEnd = data.aliasEnd; existing.label = label || id; }
      return existing;
    }
    if (participants.size >= MAX_PARTICIPANTS) throw new Error(`A Mermaid ZenUML diagram can contain up to ${MAX_PARTICIPANTS} participants.`);
    const participant = { id, label: label || id, ...data };
    participants.set(id, participant); return participant;
  };
  const add = (node: ZenStatement) => {
    if (++statements > MAX_STATEMENTS) throw new Error(`A Mermaid ZenUML diagram can contain up to ${MAX_STATEMENTS} editable statements.`);
    context().target.push(node);
  };
  const openFragment = (name: string, label: string, lineIndex: number, start: number, end: number, raw: string) => {
    if (stack.length >= MAX_DEPTH) fail(`ZenUML nesting is limited to ${MAX_DEPTH} levels`, raw, lineIndex);
    const fragment: ZenFragment = { kind: "fragment", fragment: name, branches: [{ label, line: lineIndex, start, end, children: [] }], line: lineIndex };
    const current = context(); add(fragment); stack.push({ target: fragment.branches[0].children, owner: fragment, currentParticipant: current.currentParticipant, returnTarget: current.returnTarget });
  };
  const closeBlock = (raw: string, lineIndex: number) => {
    if (stack.length === 1) fail("Unexpected closing brace in ZenUML", raw, lineIndex);
    stack.pop();
  };

  for (let index = header + 1; index < lines.length; index++) {
    const raw = lines[index]; let line = raw.trim(); if (!line) continue;
    if (/^title\s+/i.test(line)) { title = line.replace(/^title\s+/i, "").replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_m, a, b) => a ?? b); continue; }
    if (/^@[A-Za-z][A-Za-z0-9_]*\s+[A-Za-z_][\w.-]*$/.test(line)) {
      const [annotator, id] = line.split(/\s+/); pendingAnnotator = annotator.slice(1); ensureParticipant(id, id, { annotator: pendingAnnotator }); continue;
    }
    if (/^@(?:return|reply)\s*$/i.test(line)) { pendingReply = true; continue; }
    if (/^\/\//.test(line)) {
      const label = line.slice(2).trim(); add({ kind: "comment", label, line: index, start: raw.indexOf(label), end: raw.indexOf(label) + label.length }); continue;
    }
    // ZenUML accepts a closing brace followed by an alternative branch on the same line.
    const closeThenElse = /^}\s*(else(?:\s+if\s*\([\s\S]*?\))?|catch(?:\s*\([\s\S]*?\))?|finally)\s*\{\s*$/.exec(line);
    if (closeThenElse) {
      const owner = context().owner;
      closeBlock(raw, index);
      if (!owner || !["if", "try"].includes(owner.fragment)) fail("An else/catch/finally branch must belong to an open if or try fragment", raw, index);
      const label = closeThenElse[1]; const start = raw.indexOf(label); const branch = { label, line: index, start, end: start + label.length, children: [] as ZenStatement[] };
      const current = context(); pendingBranchOwner = undefined; owner.branches.push(branch); stack.push({ target: branch.children, owner, currentParticipant: current.currentParticipant, returnTarget: current.returnTarget }); continue;
    }
    if (/^}\s*$/.test(line)) { pendingBranchOwner = context().owner; closeBlock(raw, index); continue; }
    const branchLine = /^(else(?:\s+if\s*\([\s\S]*?\))?|catch(?:\s*\([\s\S]*?\))?|finally)\s*\{\s*$/.exec(line);
    if (branchLine) {
      const owner = context().owner ?? pendingBranchOwner;
      if (!owner || !["if", "try"].includes(owner.fragment)) fail("An alternative branch must belong to an open if or try fragment", raw, index);
      const branch = { label: branchLine[1], line: index, start: raw.indexOf(branchLine[1]), end: raw.indexOf(branchLine[1]) + branchLine[1].length, children: [] as ZenStatement[] };
      const current = context(); pendingBranchOwner = undefined; owner.branches.push(branch); stack.push({ target: branch.children, owner, currentParticipant: current.currentParticipant, returnTarget: current.returnTarget }); continue;
    }
    pendingBranchOwner = undefined;
    let body = line; let opensBlock = false;
    if (body.endsWith("{")) { opensBlock = true; body = body.slice(0, -1).trimEnd(); }
    if (body.includes("}") || (body.includes("{") && !opensBlock)) fail("ZenUML blocks must use a single statement followed by an opening brace", raw, index);
    const offset = raw.indexOf(body);
    if (/^(?:theme|autonumber|activate|deactivate|participant|actor)\b/i.test(body)) fail("This Mermaid sequence-only directive is not valid ZenUML syntax", raw, index);

    if (/^(?:while|for|forEach|foreach|loop)\b/i.test(body) || /^(?:if|opt|par|try)\b/i.test(body)) {
      if (!opensBlock) fail("ZenUML control fragments must open a block with `{`", raw, index, offset);
      const match = /^(while|for|forEach|foreach|loop|if|opt|par|try)(?:\s*\(([\s\S]*)\))?\s*$/i.exec(body);
      if (!match) fail("Unsupported ZenUML control fragment", raw, index, offset);
      const name = match[1].toLowerCase(); const condition = match[2]?.trim() ?? ""; const label = condition ? `${match[1]} (${condition})` : match[1];
      const start = condition ? raw.indexOf(condition, offset) : offset; const end = condition ? start + condition.length : offset + match[1].length;
      openFragment(name === "foreach" ? "forEach" : name, label, index, start, end, raw); continue;
    }
    if (/^break\s*$/i.test(body)) { add({ kind: "reply", label: "break", line: index, start: offset, end: offset + body.length, from: context().currentParticipant }); continue; }
    const async = /^([A-Za-z_][\w.-]*)\s*(->>|->)\s*([A-Za-z_][\w.-]*)\s*:\s*([\s\S]+)$/.exec(body);
    if (async) {
      const [, from, operator, to, label] = async; ensureParticipant(from); ensureParticipant(to);
      const messageStart = raw.indexOf(label, offset); add({ kind: "message", from, to, label: label.trim(), operator, reply: pendingReply, line: index, start: messageStart, end: messageStart + label.trimEnd().length });
      context().currentParticipant = from; pendingReply = false; continue;
    }
    const creation = /^new\s+([A-Za-z_][\w.-]*)(?:\s*\(([^)]*)\))?\s*$/.exec(body);
    if (creation) {
      const participant = ensureParticipant(creation[1]); const args = creation[2] ? `(${creation[2]})` : "";
      const created: ZenMessage = { kind: "create", to: participant.id, label: `new ${participant.label}${args}`, line: index, start: offset, end: offset + body.length };
      const returnTarget = context().currentParticipant; add(created); if (opensBlock) { created.children = []; stack.push({ target: created.children, currentParticipant: participant.id, returnTarget }); } continue;
    }
    const assignment = /^(?:(?:[A-Za-z_][\w.<>?\[\]]*)\s+)?([A-Za-z_][\w.-]*)\s*=\s*([A-Za-z_][\w.-]*)\.([A-Za-z_][\w.-]*(?:\([^)]*\))?)\s*$/.exec(body);
    const call = /^(?:([A-Za-z_][\w.-]*)\.)?([A-Za-z_][\w.-]*(?:\([^)]*\))?)\s*$/.exec(body);
    if (assignment || call) {
      const actor = assignment?.[2] ?? call?.[1] ?? context().currentParticipant;
      const method = assignment ? `${assignment[3]} -> ${assignment[1]}` : call?.[2] ?? "";
      if (!actor || !method) fail("A ZenUML method call must name its participant, for example `A.loadData()`", raw, index, offset);
      ensureParticipant(actor); const previousParticipant = context().currentParticipant; const methodStart = raw.indexOf(assignment ? assignment[3] : method, offset); const value = method;
      const node: ZenMessage = { kind: "call", from: actor, to: actor, label: value, line: index, start: methodStart, end: methodStart + (assignment ? assignment[3].length : method.length) };
      add(node); context().currentParticipant = actor;
      if (opensBlock) { node.children = []; stack.push({ target: node.children, currentParticipant: actor, returnTarget: previousParticipant }); }
      continue;
    }
    const returned = /^(?:return\s+([\s\S]+))$/i.exec(body);
    if (returned) { add({ kind: "reply", label: body, from: context().currentParticipant, to: context().returnTarget, line: index, start: offset, end: offset + body.length }); continue; }
    const alias = /^([A-Za-z_][\w.-]*)\s+as\s+(?:"([^"]+)"|'([^']+)'|([\w .-]+))$/.exec(body);
    if (alias) {
      const label = alias[2] ?? alias[3] ?? alias[4].trim(); const rawLabelStart = raw.indexOf(label, offset); const quotedAlias = alias[2] !== undefined || alias[3] !== undefined; const start = quotedAlias ? rawLabelStart - 1 : rawLabelStart; const end = quotedAlias ? rawLabelStart + label.length + 1 : rawLabelStart + label.length;
      ensureParticipant(alias[1], label, { line: index, aliasStart: start, aliasEnd: end }); pendingAnnotator = ""; continue;
    }
    if (/^[A-Za-z_][\w.-]*$/.test(body)) { ensureParticipant(body, body, pendingAnnotator ? { annotator: pendingAnnotator } : {}); pendingAnnotator = ""; continue; }
    if (opensBlock) fail("Unsupported ZenUML block syntax", raw, index, offset);
    fail("Unsupported Mermaid ZenUML syntax", raw, index, offset);
  }
  if (stack.length !== 1) throw new Error(`ZenUML has ${stack.length - 1} unclosed block(s).`);
  if (!participants.size) throw new Error("Add at least one ZenUML participant or message.");
  return { participants: [...participants.values()], statements: root, title: title || undefined, sourceLines: lines };
}

type PlacedStatement = { statement: ZenStatement; y: number; startY: number; endY: number; branch?: string; branchLine?: number };
function placeStatements(statements: ZenStatement[], y: number, result: PlacedStatement[] = [], branch?: string, branchLine?: number): { result: PlacedStatement[]; y: number } {
  for (const statement of statements) {
    if (statement.kind !== "fragment") {
      const startY = y; result.push({ statement, y, startY, endY: y + 1, branch, branchLine }); y += 1;
      if (statement.children?.length) { const nested = placeStatements(statement.children, y, result, branch, branchLine); y = nested.y; }
      continue;
    }
    const startY = y; const fragmentEntry: PlacedStatement = { statement, y, startY, endY: y, branch, branchLine };
    y += .3;
    for (const [index, item] of statement.branches.entries()) {
      if (index) y += .25;
      const nested = placeStatements(item.children, y, result, item.label, item.line); y = nested.y;
    }
    if (y === startY) y += 1;
    fragmentEntry.endY = y; result.push(fragmentEntry); y += .3;
  }
  return { result, y };
}

function messageRole(statement: ZenMessage) { return `mermaid-zenuml-message:${encode({ line: statement.line, start: statement.start, end: statement.end, kind: statement.kind, from: statement.from, to: statement.to, operator: statement.operator, reply: statement.reply, original: statement.label })}`; }
function participantRole(participant: ZenParticipant) { return `mermaid-zenuml-participant:${encode({ id: participant.id, line: participant.line, start: participant.aliasStart, end: participant.aliasEnd, original: participant.label, annotator: participant.annotator })}`; }

export function layoutMermaidZenUml(source: string, center: Point): Element[] {
  const diagram = parse(source); const spacing = 220; const participantWidth = 156; const top = center.y - 230; const placed = placeStatements(diagram.statements, 0).result;
  const rowHeight = 58; const totalRows = Math.max(5, ...placed.map(item => item.endY + .5)); const height = totalRows * rowHeight + 92;
  const firstX = center.x - (diagram.participants.length - 1) * spacing / 2 - participantWidth / 2;
  const participants: GroupElement[] = diagram.participants.map((participant, index) => ({ type: "group", id: `mermaid-zenuml-participant:${encodeURIComponent(participant.id)}`, componentRole: participantRole(participant), elements: [], componentBounds: { x: firstX + index * spacing, y: top, w: participantWidth, h: height }, libraryComponent: { kind: "uml-lifeline", label: participant.label } }));
  const byId = new Map(diagram.participants.map((item, index) => [item.id, participants[index]]));
  const yAt = (row: number) => top + 68 + row * rowHeight;
  const frames: ShapeElement[] = [];
  for (const placedItem of placed) {
    const statement = placedItem.statement;
    if (statement.kind !== "fragment") continue;
    const fromRow = placedItem.startY; const toRow = placedItem.endY;
    frames.push({ type: "rectangle", id: `mermaid-zenuml-fragment:${statement.line}`, componentRole: `mermaid-zenuml-fragment:${encode({ line: statement.line, fragment: statement.fragment, branches: statement.branches.map(item => ({ label: item.label, line: item.line, start: item.start, end: item.end })) })}`, x: firstX - 18, y: yAt(fromRow) - 12, w: (diagram.participants.length - 1) * spacing + participantWidth + 36, h: Math.max(46, (toRow - fromRow) * rowHeight + 26), color: "#71849a", thickness: 1.2, lineStyle: "solid", fillColor: "#eef3f8", fillOpacity: .28, edgeStyle: "sharp", label: { text: statement.branches[0]?.label ?? statement.fragment, color: "#52697e", fontSize: 11, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "top" } });
    for (const branch of statement.branches.slice(1)) {
      const branchStart = Math.min(...placed.filter(candidate => candidate.branchLine === branch.line).map(candidate => candidate.y), placedItem.startY + .3);
      frames.push({ type: "line", id: `mermaid-zenuml-branch:${statement.line}:${branch.line}`, componentRole: `mermaid-zenuml-branch:${encode({ line: branch.line, start: branch.start, end: branch.end, original: branch.label })}`, x: firstX - 18, y: yAt(branchStart) - 15, w: (diagram.participants.length - 1) * spacing + participantWidth + 36, h: 0, color: "#a6b3c0", thickness: 1, lineStyle: "dashed", startHead: "none", endHead: "none", label: { text: branch.label, color: "#52697e", fontSize: 10, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "top" } });
    }
  }
  const rows: Element[] = [];
  for (const item of placed) {
    if (item.statement.kind === "fragment") continue;
    const statement = item.statement; const y = yAt(item.y); const role = messageRole(statement);
    if (statement.kind === "comment") {
      rows.push({ type: "rectangle", id: `mermaid-zenuml-comment:${statement.line}`, componentRole: role, x: center.x - 130, y: y - 16, w: 260, h: 30, color: "#a28a4a", thickness: 1, fillColor: "#fff9df", fillOpacity: 1, edgeStyle: "rounded", cornerRadius: 5, label: { text: statement.label, color: "#65582f", fontSize: 11, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } }); continue;
    }
    if (statement.kind === "reply" && (!statement.from || !statement.to)) {
      rows.push({ type: "text", id: `mermaid-zenuml-reply:${statement.line}`, componentRole: role, x: center.x - 110, y: y - 12, text: statement.label, color: "#536a7f", fontSize: 11, fontFamily: "sans", textAlign: "center", listType: "none" }); continue;
    }
    const from = statement.from;
    const to = statement.to ?? from;
    const fromGroup = from ? byId.get(from) : undefined; const toGroup = to ? byId.get(to) : undefined;
    if (statement.kind === "call" || statement.kind === "create" || from && to && from === to) {
      const group = toGroup ?? fromGroup; if (!group) continue;
      const gx = group.componentBounds!.x + group.componentBounds!.w / 2; const isCreate = statement.kind === "create";
      rows.push({ type: "arrow", id: `mermaid-zenuml-call:${statement.line}`, componentRole: role, x: gx, y, w: 64, h: 8, color: "#617a92", thickness: 1.4, lineStyle: statement.kind === "reply" ? "dashed" : "solid", arrowRoute: "elbow", startHead: "none", endHead: "solid", ...(isCreate ? { label: { text: statement.label, color: "#40556a", fontSize: 10, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "top" } } : {}), ...(statement.kind === "call" ? { label: { text: statement.label, color: "#40556a", fontSize: 10, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "top" } } : {}) }); continue;
    }
    if (fromGroup && toGroup) {
      const startX = fromGroup.componentBounds!.x + fromGroup.componentBounds!.w / 2; const endX = toGroup.componentBounds!.x + toGroup.componentBounds!.w / 2;
      rows.push({ type: "arrow", id: `mermaid-zenuml-message:${statement.line}`, componentRole: role, x: startX, y, w: endX - startX, h: 0, color: "#617a92", thickness: 1.5, lineStyle: statement.kind === "reply" || statement.operator === "->>" ? "dashed" : "solid", startHead: "none", endHead: statement.kind === "reply" || statement.reply || statement.operator === "->>" ? "open" : "solid", startBinding: { elementId: fromGroup.id!, anchor: { x: .5, y: (y - top) / height } }, endBinding: { elementId: toGroup.id!, anchor: { x: .5, y: (y - top) / height } }, label: { text: statement.label, color: "#40556a", fontSize: 11, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" } });
    }
  }
  const title: Element[] = diagram.title ? [{ type: "text", id: "mermaid-zenuml-title", componentRole: "mermaid-zenuml-title", x: firstX, y: top - 34, text: diagram.title, color: "#34495e", fontSize: 17, bold: true, fontFamily: "sans", textAlign: "left", listType: "none" }] : [];
  frames.sort((left, right) => right.w * right.h - left.w * left.h);
  return [...title, ...frames, ...participants, ...rows];
}

function flatten(elements: Element[]): Element[] { return elements.flatMap(item => item.hidden ? [] : item.type === "group" ? [item, ...flatten(item.elements)] : [item]); }
function readRole<T>(item: Element, prefix: string): T | undefined { const role = item.componentRole ?? ""; if (!role.startsWith(prefix)) return undefined; try { return decode<T>(role.slice(prefix.length)); } catch { return undefined; } }

export function exportMermaidZenUml(elements: Element[], originalSource: string) {
  const parsed = parse(originalSource); const edits: { line: number; start: number; end: number; value: string }[] = [];
  const items = flatten(elements);
  const quoted = (value: string) => value.replace(/[\\"\r\n]/g, char => char === "\\" ? "\\\\" : char === "\"" ? "\\\"" : " ");
  for (const item of items) {
    const participant = item.type === "group" ? readRole<{ id: string; line?: number; start?: number; end?: number; original: string }>(item, "mermaid-zenuml-participant:") : undefined;
    if (item.type === "group" && participant && participant.line !== undefined && participant.start !== undefined && participant.end !== undefined) {
      const current = item.libraryComponent?.label?.trim() ?? participant.original;
      if (current !== participant.original) edits.push({ line: participant.line, start: participant.start, end: participant.end, value: `"${quoted(current)}"` });
    }
    const message = readRole<{ line: number; start: number; end: number; kind: string; original: string }>(item, "mermaid-zenuml-message:");
    if (message) {
      const current = item.type === "rectangle" ? item.label?.text ?? message.original : item.type === "text" ? item.text : "label" in item ? item.label?.text ?? message.original : message.original;
      if (current !== message.original) {
        let value = current.replace(/[\r\n]+/g, " ");
        if (message.kind === "call") {
          value = value.split(/\s+->\s+/)[0].replace(/[^A-Za-z0-9_$()., <>?-]/g, "_");
        }
        edits.push({ line: message.line, start: message.start, end: message.end, value });
      }
    }
    const fragment = item.type === "rectangle" ? readRole<{ branches: { line: number; start: number; end: number; label: string }[]; fragment: string }>(item, "mermaid-zenuml-fragment:") : undefined;
    if (fragment?.branches[0] && item.type === "rectangle") {
      const first = fragment.branches[0]; const currentLabel = item.label?.text ?? first.label;
      if (currentLabel !== first.label) {
        const condition = /^[^(]*\((.*)\)$/.exec(currentLabel)?.[1] ?? currentLabel;
        edits.push({ line: first.line, start: first.start, end: first.end, value: condition });
      }
    }
    const branch = item.type === "line" ? readRole<{ line: number; start: number; end: number; original: string }>(item, "mermaid-zenuml-branch:") : undefined;
    if (branch && item.type === "line" && item.label?.text !== branch.original) edits.push({ line: branch.line, start: branch.start, end: branch.end, value: item.label?.text ?? "" });
  }
  const lines = [...parsed.sourceLines];
  for (const edit of edits.sort((a, b) => b.line - a.line || b.start - a.start)) {
    if (edit.line < 0 || edit.line >= lines.length) continue;
    lines[edit.line] = lines[edit.line].slice(0, edit.start) + edit.value + lines[edit.line].slice(edit.end);
  }
  const declared = new Set(parsed.participants.filter(item => item.line !== undefined).map(item => item.id));
  const inserted = items.filter((item): item is GroupElement => item.type === "group" && !!readRole(item, "mermaid-zenuml-participant:")).flatMap(item => {
    const data = readRole<{ id: string; line?: number; original: string }>(item, "mermaid-zenuml-participant:")!; const label = item.libraryComponent?.label?.trim() || data.id;
    return data.line === undefined && !declared.has(data.id) && label !== data.id ? [`  ${data.id} as "${quoted(label)}"`] : [];
  });
  if (inserted.length) {
    const header = lines.findIndex(line => /^\s*zenuml\s*$/i.test(line)); lines.splice(header + 1, 0, ...inserted);
  }
  const title = items.find(item => item.type === "text" && item.id === "mermaid-zenuml-title");
  if (title?.type === "text" && title.text !== parsed.title) {
    const titleIndex = lines.findIndex(line => /^\s*title\s+/i.test(line));
    if (titleIndex >= 0) lines[titleIndex] = `  title ${title.text.replace(/[\r\n]+/g, " ")}`;
    else { const header = lines.findIndex(line => /^\s*zenuml\s*$/i.test(line)); lines.splice(header + 1, 0, `  title ${title.text.replace(/[\r\n]+/g, " ")}`); }
  }
  // Validate the resulting text before returning source so a malformed edit cannot poison a document's DSL.
  parse(lines.join("\n"));
  return lines.join("\n");
}
