import type { Element, Point, ShapeElement } from "../../model";

export type EventModelKind = "ui" | "processor" | "command" | "readmodel" | "event";
type EventFrame = { id: string; entity: string; kind: EventModelKind; reset: boolean; laneKey: string; laneLabel: string; sourceIndex: number; dataRef?: string; inlineData?: string; inlineDataType?: string; explicitRefs: string[]; line: number };
type EventData = { id: string; type?: string; body: string; sourceIndex: number; line: number };
type EventDiagram = { frames: EventFrame[]; data: EventData[]; lanes: { key: string; label: string; sourceIndex: number }[] };

const INLINE_TYPES = new Set(["json", "jsobj", "figma", "salt", "uri", "md", "html", "text"]);
const LANE_GROUP: Record<EventModelKind, string> = { ui: "UI / Automation", processor: "UI / Automation", command: "Command / Read Model", readmodel: "Command / Read Model", event: "Events" };
const SHORT_KIND: Record<EventModelKind, string> = { ui: "ui", processor: "pcr", command: "cmd", readmodel: "rmo", event: "evt" };
const LONG_KIND: Record<EventModelKind, string> = { ui: "ui", processor: "processor", command: "command", readmodel: "readmodel", event: "event" };
const encode = (value: unknown) => encodeURIComponent(JSON.stringify(value));
const decode = <T,>(value: string): T => JSON.parse(decodeURIComponent(value)) as T;

function linesOf(source: string) { return source.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n"); }
function headerIndex(lines: string[]) {
  let index = 0;
  while (index < lines.length && (!lines[index].trim() || /^\s*%%/.test(lines[index]))) index++;
  return /^eventmodeling\s*$/i.test(lines[index] ?? "") ? index : -1;
}
export function isMermaidEventModeling(source: string) { return headerIndex(linesOf(source)) >= 0; }

function diagnostic(message: string, raw: string, lineIndex: number, column = raw.search(/\S/)): never {
  throw new Error(`${message} (line ${lineIndex + 1}, column ${Math.max(1, column + 1)}).`);
}

function stripLineComment(line: string) {
  let quote = ""; let escaped = false;
  for (let index = 0; index < line.length - 1; index++) {
    const char = line[index];
    if (escaped) { escaped = false; continue; }
    if (char === "\\" && quote) { escaped = true; continue; }
    if ((char === "\"" || char === "'") && (!quote || quote === char)) { quote = quote ? "" : char; continue; }
    if (!quote && line.slice(index, index + 2) === "//") return line.slice(0, index);
  }
  return line;
}

function unquote(value: string) {
  const input = value.trim();
  if (input.length < 2 || !((input[0] === "\"" && input[input.length - 1] === "\"") || (input[0] === "'" && input[input.length - 1] === "'"))) return input;
  return input.slice(1, -1).replace(/\\([\\"'])/g, "$1");
}

function quote(value: string) { return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/[\r\n]+/g, " ")}"`; }
function formatEntity(value: string) { return /^[A-Za-z_][\w.-]*$/.test(value) ? value : quote(value); }

function laneFor(kind: EventModelKind, entity: string) {
  const group = LANE_GROUP[kind]; const separator = entity.indexOf(".");
  if (separator <= 0) return { key: `default:${group}`, label: group };
  const namespace = entity.slice(0, separator);
  if (!/^[\w-]+$/.test(namespace)) return { key: `default:${group}`, label: group };
  return { key: `${namespace}:${group}`, label: `${namespace} · ${group}` };
}

function parseFrame(raw: string, line: string, lineIndex: number, sourceIndex: number): EventFrame | undefined {
  const match = /^(tf|timeframe|rf|resetframe)\s+([\w.-]+)\s+(ui|pcr|processor|cmd|command|rmo|readmodel|evt|event)\s+(.+)$/i.exec(line);
  if (!match) return undefined;
  const reset = /^(?:rf|resetframe)$/i.test(match[1]); const id = match[2];
  let remaining = match[4].trim(); const explicitRefs: string[] = [];
  const relationIndex = remaining.indexOf("->>");
  if (relationIndex >= 0) {
    const relations = remaining.slice(relationIndex); remaining = remaining.slice(0, relationIndex).trim();
    const refs = [...relations.matchAll(/->>\s*([\w.-]+)/g)].map(item => item[1]);
    if (!refs.length || relations.replace(/->>\s*[\w.-]+/g, "").trim()) diagnostic("Event Modeling explicit links use ->> followed by a frame number", raw, lineIndex, raw.indexOf("->>"));
    explicitRefs.push(...refs);
  }
  const dataRefMatch = /\[\[([^\]]+)\]\]/.exec(remaining); const dataRef = dataRefMatch?.[1].trim();
  if (dataRefMatch) remaining = remaining.replace(dataRefMatch[0], " ").trim();
  let inlineDataType: string | undefined;
  const dataTypeMatch = /`([^`]+)`/.exec(remaining);
  if (dataTypeMatch) {
    inlineDataType = dataTypeMatch[1].trim().toLowerCase();
    if (!INLINE_TYPES.has(inlineDataType)) diagnostic(`Unsupported Event Modeling data type: ${inlineDataType}`, raw, lineIndex, raw.indexOf(dataTypeMatch[0]));
    remaining = remaining.replace(dataTypeMatch[0], " ").trim();
  }
  let inlineData: string | undefined;
  const openData = remaining.indexOf("{");
  if (openData >= 0) {
    const closeData = remaining.lastIndexOf("}");
    if (closeData < openData || remaining.slice(closeData + 1).trim()) diagnostic("Inline Event Modeling data needs a closing brace at the end of the timeframe", raw, lineIndex);
    inlineData = remaining.slice(openData + 1, closeData).trim(); remaining = remaining.slice(0, openData).trim();
    if (inlineData.length > 5000) diagnostic("Inline Event Modeling examples are limited to 5,000 characters", raw, lineIndex);
  }
  if (dataRef && inlineData !== undefined) diagnostic("A timeframe can use either an inline data example or a [[data reference]]", raw, lineIndex);
  const entity = unquote(remaining.trim());
  if (!entity || entity.length > 180) diagnostic("Event Modeling entity names must contain 1 to 180 characters", raw, lineIndex);
  const kindToken = match[3].toLowerCase();
  const kind: EventModelKind = kindToken === "ui" ? "ui" : kindToken === "pcr" || kindToken === "processor" ? "processor" : kindToken === "cmd" || kindToken === "command" ? "command" : kindToken === "rmo" || kindToken === "readmodel" ? "readmodel" : "event";
  const lane = laneFor(kind, entity);
  return { id, entity, kind, reset, laneKey: lane.key, laneLabel: lane.label, sourceIndex, ...(dataRef ? { dataRef } : {}), ...(inlineData !== undefined ? { inlineData } : {}), ...(inlineDataType ? { inlineDataType } : {}), explicitRefs, line: lineIndex + 1 };
}

export function parseMermaidEventModeling(source: string): EventDiagram {
  if (source.length > 150_000) throw new Error("Mermaid Event Modeling input is limited to 150,000 characters.");
  const lines = linesOf(source); const header = headerIndex(lines);
  if (header < 0) throw new Error("Expected an eventmodeling header.");
  const frames: EventFrame[] = []; const data: EventData[] = []; const laneMap = new Map<string, { key: string; label: string; sourceIndex: number }>();
  const frameIds = new Set<string>(); const dataIds = new Set<string>(); let activeData: EventData | undefined;
  for (let index = header + 1; index < lines.length; index++) {
    const raw = lines[index]; const line = stripLineComment(raw).trim();
    if (activeData) {
      if (line === "}") { activeData = undefined; continue; }
      activeData.body += `${activeData.body ? "\n" : ""}${raw.trimEnd()}`;
      if (activeData.body.length > 5000) diagnostic("Event Modeling data examples are limited to 5,000 characters", raw, index);
      continue;
    }
    if (!line) continue;
    const dataBlock = /^data\s+([\w.-]+)\s*(?:`([^`]+)`\s*)?\{(.*)$/i.exec(line);
    if (dataBlock) {
      const id = dataBlock[1]; if (dataIds.has(id)) diagnostic(`Duplicate Event Modeling data block: ${id}`, raw, index);
      const type = dataBlock[2]?.toLowerCase(); if (type && !INLINE_TYPES.has(type)) diagnostic(`Unsupported Event Modeling data type: ${type}`, raw, index, raw.indexOf("`" + dataBlock[2] + "`"));
      const bodyPart = dataBlock[3]; const closing = /}\s*$/.test(bodyPart);
      const body = closing ? bodyPart.slice(0, bodyPart.lastIndexOf("}")).trim() : bodyPart.trim();
      if (body.length > 5000) diagnostic("Event Modeling data examples are limited to 5,000 characters", raw, index);
      const block: EventData = { id, ...(type ? { type } : {}), body, sourceIndex: data.length, line: index + 1 };
      data.push(block); dataIds.add(id); if (data.length > 200) diagnostic("Event Modeling diagrams are limited to 200 data blocks", raw, index);
      if (!closing) activeData = block;
      continue;
    }
    const frame = parseFrame(raw, line, index, frames.length);
    if (frame) {
      if (frameIds.has(frame.id)) diagnostic(`Event Modeling timeframe number ${frame.id} is used more than once`, raw, index);
      frameIds.add(frame.id); frames.push(frame);
      if (!laneMap.has(frame.laneKey)) laneMap.set(frame.laneKey, { key: frame.laneKey, label: frame.laneLabel, sourceIndex: frame.sourceIndex });
      if (frames.length > 300) diagnostic("Event Modeling diagrams are limited to 300 timeframes", raw, index);
      continue;
    }
    if (/^(?:title|classDef|style|click)\b/i.test(line)) diagnostic("This Event Modeling directive is not supported by SketchDraw", raw, index);
    diagnostic("Unsupported Mermaid Event Modeling syntax", raw, index);
  }
  if (activeData) throw new Error(`Event Modeling data block ${activeData.id} is missing its closing brace (line ${activeData.line}, column 1).`);
  for (const frame of frames) {
    if (frame.dataRef && !dataIds.has(frame.dataRef)) diagnostic(`Timeframe ${frame.id} references missing data block ${frame.dataRef}`, lines[frame.line - 1], frame.line - 1);
    for (const reference of frame.explicitRefs) if (!frameIds.has(reference)) diagnostic(`Timeframe ${frame.id} links to unknown timeframe ${reference}`, lines[frame.line - 1], frame.line - 1);
  }
  if (!frames.length) throw new Error("An Event Modeling diagram needs at least one timeframe.");
  const lanes = [...laneMap.values()].sort((a, b) => a.sourceIndex - b.sourceIndex);
  return { frames, data, lanes };
}

type FrameMetadata = Pick<EventFrame, "id" | "kind" | "reset" | "dataRef" | "inlineDataType" | "sourceIndex"> & { hasInlineData: boolean };

function frameMeta(frame: EventFrame): FrameMetadata {
  return { id: frame.id, kind: frame.kind, reset: frame.reset, ...(frame.dataRef ? { dataRef: frame.dataRef } : {}), ...(frame.inlineDataType ? { inlineDataType: frame.inlineDataType } : {}), hasInlineData: frame.inlineData !== undefined, sourceIndex: frame.sourceIndex };
}

function makeTextShape(text: string, x: number, y: number, width: number, height: number, options: { id: string; role: string; fill?: string; color?: string; dashed?: boolean; fontSize?: number; bold?: boolean }): ShapeElement {
  return { type: "rectangle", id: options.id, componentRole: options.role, x, y, w: width, h: height, color: options.color ?? "#697c8e", thickness: 1.2, lineStyle: options.dashed ? "dashed" : "solid", fillColor: options.fill ?? "#ffffff", fillOpacity: 1, edgeStyle: "rounded", cornerRadius: 8, label: { text, color: "#263748", fontSize: options.fontSize ?? 11, fontFamily: "sans", bold: options.bold ?? false, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "top", offsetX: 8, offsetY: 8 } };
}

function contentHeight(text: string, width: number, fontSize: number, minimum: number, maximum: number) {
  const charactersPerLine = Math.max(8, Math.floor((width - 22) / (fontSize * .57)));
  const lineCount = text.split(/\r?\n/).reduce((count, line) => count + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0);
  return Math.max(minimum, Math.min(maximum, lineCount * fontSize * 1.25 + 20));
}

export function layoutMermaidEventModeling(source: string, center: Point): Element[] {
  const model = parseMermaidEventModeling(source); const laneIndex = new Map(model.lanes.map((lane, index) => [lane.key, index]));
  const columnPitch = 220; const width = Math.max(660, model.frames.length * columnPitch + 180); const left = center.x - width / 2;
  const frameLabels = new Map(model.frames.map(frame => [frame.id, `${frame.id} · ${frame.entity}\n${LONG_KIND[frame.kind]}${frame.reset ? " · Reset frame" : ""}${frame.dataRef ? `\nData: ${frame.dataRef}` : frame.inlineData !== undefined ? `\nExample${frame.inlineDataType ? ` (${frame.inlineDataType})` : ""}:\n${frame.inlineData}` : ""}`]));
  const frameHeights = new Map(model.frames.map(frame => [frame.id, contentHeight(frameLabels.get(frame.id) ?? "", 174, 10, 112, 2400)]));
  const laneHeights = model.lanes.map(lane => Math.max(196, ...model.frames.filter(frame => frame.laneKey === lane.key).map(frame => (frameHeights.get(frame.id) ?? 112) + 52)));
  const dataLabels = model.data.map(entry => `${entry.id}\n${entry.type ? `Type: ${entry.type}\n` : ""}${entry.body}`);
  const dataHeights = dataLabels.map(label => contentHeight(label, 190, 10, 114, 2400)); const dataRowHeights: number[] = [];
  for (let index = 0; index < dataHeights.length; index += 4) dataRowHeights.push(Math.max(...dataHeights.slice(index, index + 4)));
  const mapHeight = 108 + laneHeights.reduce((sum, height) => sum + height + 16, 0) + (model.data.length ? 70 + dataRowHeights.reduce((sum, height) => sum + height + 18, 0) : 0);
  const top = center.y - mapHeight / 2; const result: Element[] = [];
  const frameShapes = new Map<string, ShapeElement>(); const dataShapes = new Map<string, ShapeElement>();
  const laneOffsets: number[] = []; let laneCursor = top + 50;
  model.lanes.forEach((lane, index) => {
    const laneY = laneCursor; const laneHeight = laneHeights[index]; laneOffsets.push(laneY);
    result.push(makeTextShape("", left + 72, laneY, width - 90, laneHeight, { id: `mermaid-eventmodeling-lane:${encode(lane.key)}`, role: `mermaid-eventmodeling-lane:${encode(lane.key)}`, fill: index % 2 ? "#f5f8fb" : "#edf3f7", color: "#c4d0db" }));
    result.push({ type: "text", id: `mermaid-eventmodeling-lane-label:${encode(lane.key)}`, componentRole: `mermaid-eventmodeling-lane-label:${encode(lane.key)}`, x: left + 80, y: laneY + 8, text: lane.label, color: "#4b6175", fontSize: 13, bold: true, fontFamily: "sans", textAlign: "left", listType: "none" });
    laneCursor += laneHeight + 16;
  });
  for (const frame of model.frames) {
    const row = laneIndex.get(frame.laneKey) ?? 0; const x = left + 96 + frame.sourceIndex * columnPitch; const y = laneOffsets[row] + 38;
    const card = makeTextShape(frameLabels.get(frame.id) ?? frame.entity, x, y, 174, frameHeights.get(frame.id) ?? 112, { id: `mermaid-eventmodeling-frame:${frame.id}`, role: `mermaid-eventmodeling-frame:${encode(frameMeta(frame))}`, fill: frame.kind === "event" ? "#fff2e7" : frame.reset ? "#fff8d9" : "#ffffff", color: frame.kind === "event" ? "#c78350" : frame.reset ? "#c3a445" : "#73879a", dashed: frame.reset, fontSize: 10 });
    frameShapes.set(frame.id, card); result.push(card);
  }
  const links: { from: string; to: string; kind: "inferred" | "explicit" }[] = [];
  for (let index = 1; index < model.frames.length; index++) if (!model.frames[index].reset) links.push({ from: model.frames[index - 1].id, to: model.frames[index].id, kind: "inferred" });
  for (const frame of model.frames) for (const target of frame.explicitRefs) links.push({ from: frame.id, to: target, kind: "explicit" });
  for (const [index, edge] of links.entries()) {
    const from = frameShapes.get(edge.from); const to = frameShapes.get(edge.to);
    if (!from || !to) continue;
    result.push({ type: "arrow", id: `mermaid-eventmodeling-link:${index}`, componentRole: `mermaid-eventmodeling-link:${encode({ kind: edge.kind, from: edge.from, to: edge.to })}`, x: from.x + from.w, y: from.y + from.h / 2, w: to.x - (from.x + from.w), h: to.y + to.h / 2 - (from.y + from.h / 2), color: edge.kind === "explicit" ? "#7b6ca0" : "#6f879d", thickness: edge.kind === "inferred" ? 1.4 : 1.8, lineStyle: edge.kind === "inferred" ? "solid" : "dashed", arrowRoute: "elbow", startHead: "none", endHead: "solid", startBinding: { elementId: from.id!, anchor: { x: 1, y: .5 } }, endBinding: { elementId: to.id!, anchor: { x: 0, y: .5 } } });
  }
  if (model.data.length) {
    const dataTop = laneCursor + 22; const dataOffsets: number[] = []; let dataCursor = dataTop + 8;
    for (const rowHeight of dataRowHeights) { dataOffsets.push(dataCursor); dataCursor += rowHeight + 18; }
    result.push({ type: "text", id: "mermaid-eventmodeling-data-heading", componentRole: "mermaid-eventmodeling-data-heading", x: left + 80, y: dataTop - 15, text: "Data examples", color: "#52687c", fontSize: 14, bold: true, fontFamily: "sans", textAlign: "left", listType: "none" });
    model.data.forEach((entry, index) => {
      const x = left + 96 + (index % 4) * 220; const y = dataOffsets[Math.floor(index / 4)]; const body = dataLabels[index];
      const card = makeTextShape(body, x, y, 190, dataHeights[index], { id: `mermaid-eventmodeling-data:${encode(entry.id)}`, role: `mermaid-eventmodeling-data:${encode({ id: entry.id, type: entry.type, sourceIndex: entry.sourceIndex })}`, fill: "#f8fbff", color: "#93a6b9", fontSize: 10 });
      dataShapes.set(entry.id, card); result.push(card);
    });
    // Add data reference arrows after the data cards exist.
    for (const frame of model.frames) if (frame.dataRef) {
      const from = frameShapes.get(frame.id); const to = dataShapes.get(frame.dataRef); if (!from || !to) continue;
      result.push({ type: "arrow", id: `mermaid-eventmodeling-data-link:${frame.id}`, componentRole: `mermaid-eventmodeling-data-link:${encode({ frameId: frame.id, dataId: frame.dataRef })}`, x: from.x + from.w / 2, y: from.y + from.h, w: to.x + to.w / 2 - (from.x + from.w / 2), h: to.y - (from.y + from.h), color: "#709588", thickness: 1.4, lineStyle: "dotted", arrowRoute: "elbow", startHead: "none", endHead: "solid", startBinding: { elementId: from.id!, anchor: { x: .5, y: 1 } }, endBinding: { elementId: to.id!, anchor: { x: .5, y: 0 } } });
    }
  }
  return result;
}

function flatten(elements: Element[]): Element[] { return elements.flatMap(item => item.hidden ? [] : item.type === "group" ? flatten(item.elements) : [item]); }

export function exportMermaidEventModeling(elements: Element[]) {
  const items = flatten(elements); const frameShapes = items.filter((item): item is ShapeElement => item.type === "rectangle" && item.componentRole?.startsWith("mermaid-eventmodeling-frame:") === true);
  if (!frameShapes.length) throw new Error("This Event Modeling diagram has no editable timeframes to export.");
  const frameData = frameShapes.map(shape => ({ shape, meta: decode<FrameMetadata>(shape.componentRole!.slice("mermaid-eventmodeling-frame:".length)) }));
  const dataShapes = items.filter((item): item is ShapeElement => item.type === "rectangle" && item.componentRole?.startsWith("mermaid-eventmodeling-data:") === true);
  const dataById = new Map(dataShapes.map(shape => { const meta = decode<{ id: string; type?: string }>(shape.componentRole!.slice("mermaid-eventmodeling-data:".length)); return [meta.id, { shape, meta }] as const; }));
  const byElementId = new Map(frameData.map(item => [item.shape.id!, item.meta.id] as const));
  const lines = ["eventmodeling"];
  for (const item of frameData.sort((a, b) => a.shape.x - b.shape.x || a.meta.sourceIndex - b.meta.sourceIndex)) {
    const content = item.shape.label?.text ?? ""; const [firstLine = "", ...detailLines] = content.split(/\r?\n/); const separator = firstLine.indexOf("·"); const entity = (separator >= 0 ? firstLine.slice(separator + 1) : firstLine).trim() || "Unnamed";
    const keyword = item.meta.reset ? "rf" : "tf"; const dataRef = /\bData:\s*([\w.-]+)/i.exec(content)?.[1] ?? item.meta.dataRef;
    const example = detailLines.findIndex(line => /^Example(?:\s|:)/i.test(line));
    const inlineData = item.meta.hasInlineData ? (example >= 0 ? detailLines.slice(example + 1).join(" ").trim().replace(/[\r\n]+/g, " ") : "") : undefined;
    const linesForFrame = [`${keyword} ${item.meta.id} ${SHORT_KIND[item.meta.kind]} ${formatEntity(entity)}`];
    if (dataRef) linesForFrame[0] += ` [[${dataRef}]]`;
    else if (inlineData !== undefined) linesForFrame[0] += ` ${item.meta.inlineDataType ? `\`${item.meta.inlineDataType}\`` : ""}{ ${inlineData.replace(/[\r\n]+/g, " ")} }`;
    const explicit = items.filter((link): link is ShapeElement => link.type === "arrow" && link.componentRole?.startsWith("mermaid-eventmodeling-link:") === true).flatMap(link => {
      const meta = decode<{ kind: string; from: string; to: string }>(link.componentRole!.slice("mermaid-eventmodeling-link:".length));
      if (meta.kind !== "explicit") return [];
      const from = link.startBinding?.elementId ? byElementId.get(link.startBinding.elementId) : meta.from;
      const to = link.endBinding?.elementId ? byElementId.get(link.endBinding.elementId) : meta.to;
      return from === item.meta.id && to ? [to] : [];
    });
    const targets = [...new Set(explicit)]; if (targets.length) linesForFrame[0] += targets.map(target => ` ->> ${target}`).join("");
    lines.push(...linesForFrame);
  }
  for (const item of frameData) {
    const ref = /\bData:\s*([\w.-]+)/i.exec(item.shape.label?.text ?? "")?.[1] ?? item.meta.dataRef;
    if (ref && !dataById.has(ref)) throw new Error(`Event Modeling timeframe ${item.meta.id} references data block ${ref}, which was removed.`);
  }
  for (const { shape, meta } of dataById.values()) {
    const content = shape.label?.text ?? meta.id; const bodyLines = content.split(/\r?\n/); bodyLines.shift();
    if (meta.type) bodyLines.shift();
    lines.push(`data ${meta.id}${meta.type ? ` \`${meta.type}\`` : ""} {`);
    lines.push(...bodyLines);
    lines.push("}");
  }
  return lines.join("\n") + "\n";
}
