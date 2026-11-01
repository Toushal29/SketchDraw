import type { Element, Point, ShapeElement, TextElement } from "../../model";

export const CYNEFIN_DOMAINS = ["complex", "complicated", "clear", "chaotic", "confusion"] as const;
export type CynefinDomain = typeof CYNEFIN_DOMAINS[number];

type CynefinItem = { label: string; sourceIndex: number };
type CynefinTransition = { from: CynefinDomain; to: CynefinDomain; label: string; sourceIndex: number };
type CynefinStyle = { complexBg: string; complicatedBg: string; clearBg: string; chaoticBg: string; confusionBg: string; boundaryColor: string; boundaryWidth: number; cliffColor: string; cliffWidth: number; arrowColor: string; arrowWidth: number; labelColor: string; textColor: string; domainFontSize: number; itemFontSize: number };
type CynefinConfig = { width: number; height: number; padding: number; showDomainDescriptions: boolean; boundaryAmplitude: number; seed: number; style: CynefinStyle };
type CynefinDiagram = { title: string; domains: Record<CynefinDomain, CynefinItem[]>; transitions: CynefinTransition[]; config: CynefinConfig };

const domainTitles: Record<CynefinDomain, string> = { complex: "Complex", complicated: "Complicated", clear: "Clear", chaotic: "Chaotic", confusion: "Confusion / Disorder" };
const domainDescriptions: Record<CynefinDomain, string> = {
  complex: "Probe → Sense → Respond · Emergent practices",
  complicated: "Sense → Analyse → Respond · Good practices",
  clear: "Sense → Categorise → Respond · Best practices",
  chaotic: "Act → Sense → Respond · Novel practices",
  confusion: "Move each issue into a domain you can act on",
};
const baseStyle: CynefinStyle = {
  complexBg: "#e9e2f4", complicatedBg: "#e1eaf5", clearBg: "#e3efe5", chaoticBg: "#f4e3df", confusionBg: "#f4edcf",
  boundaryColor: "#657383", boundaryWidth: 2, cliffColor: "#b85443", cliffWidth: 3, arrowColor: "#465c72", arrowWidth: 2,
  labelColor: "#263544", textColor: "#34495e", domainFontSize: 15, itemFontSize: 11,
};
const configKeys = new Set(["width", "height", "padding", "showDomainDescriptions", "boundaryAmplitude", "seed"]);
const styleKeys = new Set(Object.keys(baseStyle));
const isDomain = (value: string): value is CynefinDomain => (CYNEFIN_DOMAINS as readonly string[]).includes(value.toLowerCase());
const encode = (value: string) => encodeURIComponent(value);
const decode = (value: string) => { try { return decodeURIComponent(value); } catch { return value; } };

function linesOf(source: string) { return source.replace(/\r/g, "").split("\n"); }
function headerInfo(lines: string[]) {
  let header = 0;
  while (header < lines.length && (!lines[header].trim() || /^\s*%%/.test(lines[header]))) header++;
  let frontmatterStart = -1; let frontmatterEnd = -1;
  if (lines[header]?.trim() === "---") {
    frontmatterStart = header; frontmatterEnd = lines.findIndex((line, index) => index > header && line.trim() === "---");
    if (frontmatterEnd < 0) return undefined;
    header = frontmatterEnd + 1;
    while (header < lines.length && (!lines[header].trim() || /^\s*%%/.test(lines[header]))) header++;
  }
  if (!/^\s*cynefin-beta\s*$/i.test(lines[header] ?? "")) return undefined;
  return { header, frontmatterStart, frontmatterEnd };
}

export function isMermaidCynefin(source: string) { return headerInfo(linesOf(source)) !== undefined; }

function diagnostic(message: string, sourceLine: string, lineIndex: number, columnIndex = sourceLine.search(/\S/)) {
  throw new Error(`${message} (line ${lineIndex + 1}, column ${Math.max(1, columnIndex + 1)}).`);
}

function unquote(raw: string) {
  const value = raw.trim();
  if (value.length < 2 || !((value[0] === "\"" && value[value.length - 1] === "\"") || (value[0] === "'" && value[value.length - 1] === "'"))) return value;
  const quote = value[0];
  return value.slice(1, -1).replace(/\\([\\"'])/g, "$1").replace(quote === "\"" ? /\\n/g : /$^/, "\n");
}

function yamlBlockValues(lines: string[], path: string[]): Map<string, string> {
  let searchStart = 0; let parentIndent = -1; let blockStart = -1; let blockEnd = lines.length;
  for (const name of path) {
    let found = -1; let indent = -1;
    for (let index = searchStart; index < blockEnd; index++) {
      const match = /^(\s*)([\w-]+)\s*:\s*(?:#.*)?$/.exec(lines[index]);
      if (match && match[2] === name && match[1].length > parentIndent) { found = index; indent = match[1].length; break; }
    }
    if (found < 0) return new Map();
    blockStart = found; blockEnd = lines.length;
    for (let index = found + 1; index < lines.length; index++) {
      if (!lines[index].trim() || /^\s*#/.test(lines[index])) continue;
      const currentIndent = /^\s*/.exec(lines[index])?.[0].length ?? 0;
      if (currentIndent <= indent) { blockEnd = index; break; }
    }
    searchStart = found + 1; parentIndent = indent;
  }
  const values = new Map<string, string>();
  if (blockStart < 0) return values;
  for (let index = blockStart + 1; index < blockEnd; index++) {
    const match = /^\s+([\w-]+)\s*:\s*(.*)$/.exec(lines[index]);
    if (match) values.set(match[1], unquote(match[2].replace(/\s+#.*$/, "").trim()));
  }
  return values;
}

function numericConfig(values: Map<string, string>, key: string, fallback: number, min: number, max: number, integer = false) {
  const raw = values.get(key); if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max || integer && !Number.isInteger(value)) throw new Error(`Mermaid Cynefin config ${key} must be ${integer ? "an integer" : "a number"} between ${min} and ${max}.`);
  return value;
}

function colorConfig(values: Map<string, string>, key: keyof CynefinStyle, fallback: string) {
  const raw = values.get(key); if (raw === undefined) return fallback;
  const value = raw.trim();
  if (!/^(?:#[\da-f]{3,8}|[a-z]{3,24}|(?:rgb|rgba|hsl|hsla)\([\d.% ,/]+\))$/i.test(value)) throw new Error(`Mermaid Cynefin color ${key} must be a simple CSS color value.`);
  return value;
}

function parseConfig(lines: string[]): CynefinConfig {
  const config = yamlBlockValues(lines, ["config", "cynefin"]);
  const style = yamlBlockValues(lines, ["config", "themeVariables", "cynefin"]);
  for (const key of config.keys()) if (!configKeys.has(key)) throw new Error(`Unsupported Mermaid Cynefin config key: ${key}.`);
  for (const key of style.keys()) if (!styleKeys.has(key)) throw new Error(`Unsupported Mermaid Cynefin theme variable: ${key}.`);
  const shown = config.get("showDomainDescriptions");
  if (shown !== undefined && shown !== "true" && shown !== "false") throw new Error("Mermaid Cynefin showDomainDescriptions must be true or false.");
  return {
    width: numericConfig(config, "width", 800, 400, 2400, true),
    height: numericConfig(config, "height", 600, 320, 1800, true),
    padding: numericConfig(config, "padding", 40, 0, 200, true),
    boundaryAmplitude: numericConfig(config, "boundaryAmplitude", 8, 0, 40),
    seed: numericConfig(config, "seed", 0, 0, 1_000_000, true),
    showDomainDescriptions: shown !== "false",
    style: Object.fromEntries(Object.keys(baseStyle).map(key => {
      const styleKey = key as keyof CynefinStyle; const fallback = baseStyle[styleKey];
      return [key, typeof fallback === "string" ? colorConfig(style, styleKey, fallback) : numericConfig(style, key, fallback, 0, key.endsWith("FontSize") ? 40 : 20)];
    })) as CynefinStyle,
  };
}

export function parseMermaidCynefin(source: string): CynefinDiagram {
  if (source.length > 100_000) throw new Error("Mermaid input is limited to 100,000 characters.");
  const lines = linesOf(source); const header = headerInfo(lines);
  if (!header) throw new Error("Expected a cynefin-beta header.");
  const domains = Object.fromEntries(CYNEFIN_DOMAINS.map(domain => [domain, [] as CynefinItem[]])) as Record<CynefinDomain, CynefinItem[]>;
  const transitions: CynefinTransition[] = []; const config = parseConfig(lines);
  let title = ""; let activeDomain: CynefinDomain | undefined; let itemIndex = 0; let accessibilityBlock = false;
  for (let index = header.header + 1; index < lines.length; index++) {
    const raw = lines[index]; const line = raw.trim();
    if (!line || /^%%/.test(line)) continue;
    if (header.frontmatterStart >= 0 && index >= header.frontmatterStart && index <= header.frontmatterEnd) continue;
    if (accessibilityBlock) { if (/^\s*\}/.test(line)) accessibilityBlock = false; continue; }
    if (/^accTitle\s*:/i.test(line) || /^accDescr\s*:/i.test(line)) continue;
    if (/^accDescr\s*\{/i.test(line)) { accessibilityBlock = true; continue; }
    if (/^title\s+/i.test(line)) { title = unquote(line.replace(/^title\s+/i, "")); activeDomain = undefined; continue; }
    if (/^(?:title|accTitle|accDescr)\b/i.test(line)) diagnostic("Unsupported Mermaid Cynefin title or accessibility directive", raw, index);
    const transition = /^(complex|complicated|clear|chaotic|confusion)\s*-->\s*(complex|complicated|clear|chaotic|confusion)(?:\s*:\s*(.+))?\s*$/i.exec(line);
    if (transition) {
      const from = transition[1].toLowerCase() as CynefinDomain; const to = transition[2].toLowerCase() as CynefinDomain;
      // Mermaid silently ignores self-loop transitions.
      if (from === to) { activeDomain = undefined; continue; }
      const label = transition[3] ? unquote(transition[3]) : "";
      if (transition[3] && !/^(['\"]).*\1$/.test(transition[3].trim())) diagnostic("Cynefin transition labels must be quoted", raw, index, raw.indexOf(transition[3]));
      transitions.push({ from, to, label, sourceIndex: transitions.length });
      if (transitions.length > 200) diagnostic("A Mermaid Cynefin diagram can contain at most 200 transitions", raw, index);
      activeDomain = undefined; continue;
    }
    if (/^(complex|complicated|clear|chaotic|confusion)$/i.test(line)) { activeDomain = line.toLowerCase() as CynefinDomain; continue; }
    if (activeDomain) {
      if (!/^(['"]).*\1$/.test(line)) diagnostic("Cynefin domain items must be quoted labels on their own lines", raw, index);
      const label = unquote(line);
      if (!label.trim()) diagnostic("Cynefin item labels cannot be empty", raw, index);
      if (label.length > 500) diagnostic("Cynefin item labels cannot exceed 500 characters", raw, index);
      domains[activeDomain].push({ label, sourceIndex: itemIndex++ });
      const limit = activeDomain === "confusion" ? 100 : 80;
      if (domains[activeDomain].length > limit) diagnostic(`The ${activeDomain} domain exceeds its ${limit}-item input limit`, raw, index);
      continue;
    }
    diagnostic("Unsupported Mermaid Cynefin syntax", raw, index);
  }
  return { title, domains, transitions, config };
}

function text(id: string, role: string, x: number, y: number, value: string, color: string, fontSize: number, bold = false, align: TextElement["textAlign"] = "left"): TextElement {
  return { type: "text", id, componentRole: role, x, y, text: value, color, fontSize, bold, fontFamily: "sans", textAlign: align, listType: "none" };
}

function pathElement(id: string, role: string, bounds: { x: number; y: number; w: number; h: number }, pathWidth: number, pathHeight: number, pathData: string, color: string, thickness: number): ShapeElement {
  return { type: "svgPath", id, componentRole: role, ...bounds, pathWidth, pathHeight, pathData, color, thickness, svgStroke: true, fillRule: "nonzero", lineStyle: "solid" };
}

function wavePath(bounds: { x: number; y: number; w: number; h: number }, vertical: boolean, amplitude: number, seed: number) {
  const pathWidth = vertical ? Math.max(1, amplitude * 2 + 2) : bounds.w;
  const pathHeight = vertical ? bounds.h : Math.max(1, amplitude * 2 + 2);
  const middle = amplitude + 1; const segments = 8; const phase = seed === 0 ? 0 : (seed % 7) - 3;
  if (!amplitude) return vertical ? { pathWidth, pathHeight, pathData: `M ${middle} 0 L ${middle} ${pathHeight}` } : { pathWidth, pathHeight, pathData: `M 0 ${middle} L ${pathWidth} ${middle}` };
  if (vertical) {
    const step = pathHeight / segments; let pathData = `M ${middle} 0`;
    for (let index = 0; index < segments; index++) { const sign = index % 2 ? -1 : 1; pathData += ` Q ${middle + sign * (amplitude + phase * .2)} ${step * (index + .5)} ${middle} ${step * (index + 1)}`; }
    return { pathWidth, pathHeight, pathData };
  }
  const step = pathWidth / segments; let pathData = `M 0 ${middle}`;
  for (let index = 0; index < segments; index++) { const sign = index % 2 ? -1 : 1; pathData += ` Q ${step * (index + .5)} ${middle + sign * (amplitude + phase * .2)} ${step * (index + 1)} ${middle}`; }
  return { pathWidth, pathHeight, pathData };
}

function connector(from: ShapeElement, to: ShapeElement, transition: CynefinTransition, config: CynefinConfig): ShapeElement {
  const dx = to.x + to.w / 2 - (from.x + from.w / 2); const dy = to.y + to.h / 2 - (from.y + from.h / 2);
  const startAnchor = Math.abs(dx) >= Math.abs(dy) ? { x: dx > 0 ? 1 : 0, y: .5 } : { x: .5, y: dy > 0 ? 1 : 0 };
  const endAnchor = Math.abs(dx) >= Math.abs(dy) ? { x: dx > 0 ? 0 : 1, y: .5 } : { x: .5, y: dy > 0 ? 0 : 1 };
  const start = { x: from.x + from.w * startAnchor.x, y: from.y + from.h * startAnchor.y }; const end = { x: to.x + to.w * endAnchor.x, y: to.y + to.h * endAnchor.y };
  return { type: "arrow", id: `mermaid-cynefin-transition:${transition.sourceIndex}`, componentRole: `mermaid-cynefin-transition:${encode(JSON.stringify({ from: transition.from, to: transition.to }))}`, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color: config.style.arrowColor, thickness: config.style.arrowWidth, arrowRoute: "elbow", autoRoute: true, startHead: "none", endHead: "solid", startBinding: { elementId: from.id!, anchor: startAnchor }, endBinding: { elementId: to.id!, anchor: endAnchor }, ...(transition.label ? { label: { text: transition.label, color: config.style.textColor, fontSize: config.style.itemFontSize, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" } } : {}) };
}

export function layoutMermaidCynefin(source: string, center: Point): Element[] {
  const diagram = parseMermaidCynefin(source); const { config } = diagram; const pad = config.padding; const centerGapX = 232;
  const quadWidth = Math.max(286, (config.width - pad * 2 - centerGapX) / 2);
  const quadrantCardWidth = (quadWidth - 40) / 2; const quadrantHeaderHeight = config.showDomainDescriptions ? 62 : 50;
  const quadrantRows = (CYNEFIN_DOMAINS.filter(domain => domain !== "confusion") as Exclude<CynefinDomain, "confusion">[]).map(domain => {
    const labels = diagram.domains[domain]; const heights: number[] = [];
    for (let index = 0; index < labels.length; index += 2) heights.push(Math.max(cynefinCardHeight(labels[index].label, quadrantCardWidth, config.style.itemFontSize, 34), labels[index + 1] ? cynefinCardHeight(labels[index + 1].label, quadrantCardWidth, config.style.itemFontSize, 34) : 0));
    return heights;
  });
  const quadrantNeededHeight = Math.max(0, ...quadrantRows.map(rows => quadrantHeaderHeight + rows.reduce((sum, row) => sum + row, 0) + Math.max(0, rows.length - 1) * 7 + 18));
  const quadHeight = Math.max(220, quadrantNeededHeight);
  const confusionCardWidth = 216 - 34; const confusionStartOffset = config.showDomainDescriptions ? 56 : 39;
  const confusionCardHeights = diagram.domains.confusion.slice(0, 3).map(item => cynefinCardHeight(item.label, confusionCardWidth, config.style.itemFontSize, 22));
  const hasConfusionOverflow = diagram.domains.confusion.length > 3;
  const confusionHeight = Math.max(170, confusionStartOffset + confusionCardHeights.reduce((sum, value) => sum + value, 0) + Math.max(0, confusionCardHeights.length - 1) * 2 + (hasConfusionOverflow ? (confusionCardHeights.length ? 2 : 0) + 18 : 0) + 14);
  const centerGapY = Math.max(190, confusionHeight + 20);
  const width = Math.max(config.width, quadWidth * 2 + centerGapX + pad * 2); const height = Math.max(config.height, quadHeight * 2 + centerGapY + pad * 2);
  const left = center.x - width / 2; const top = center.y - height / 2; const midX = center.x; const midY = center.y;
  const frameBounds: Record<Exclude<CynefinDomain, "confusion">, { x: number; y: number; w: number; h: number }> = {
    complex: { x: left + pad, y: top + pad, w: quadWidth, h: quadHeight },
    complicated: { x: midX + centerGapX / 2, y: top + pad, w: quadWidth, h: quadHeight },
    chaotic: { x: left + pad, y: midY + centerGapY / 2, w: quadWidth, h: quadHeight },
    clear: { x: midX + centerGapX / 2, y: midY + centerGapY / 2, w: quadWidth, h: quadHeight },
  };
  const frames = new Map<CynefinDomain, ShapeElement>(); const result: Element[] = [];
  if (diagram.title) result.push(text("mermaid-title", "mermaid-cynefin-title", left + pad, top - 34, diagram.title, config.style.labelColor, 20, true));
  for (const domain of ["complex", "complicated", "chaotic", "clear"] as const) {
    const bounds = frameBounds[domain]; const frame: ShapeElement = { type: "rectangle", id: `mermaid-cynefin-domain:${domain}`, componentRole: `mermaid-cynefin-domain:${domain}`, ...bounds, color: config.style.boundaryColor, thickness: config.style.boundaryWidth, fillColor: config.style[`${domain}Bg`], fillOpacity: .82, edgeStyle: "sharp", label: { text: "", color: config.style.labelColor, fontSize: config.style.domainFontSize, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "top" } };
    frames.set(domain, frame); result.push(frame);
  }
  // These boundaries define the model and remain visible if subtitles are hidden.
  const seed = config.seed || hashSource(source);
  const dividerX = midX - config.boundaryAmplitude - 1; const dividerY = midY - config.boundaryAmplitude - 1;
  const verticalBounds = { x: dividerX, y: top + pad, w: config.boundaryAmplitude * 2 + 2, h: height - pad * 2 };
  const vertical = wavePath(verticalBounds, true, config.boundaryAmplitude, seed);
  result.push(pathElement("mermaid-cynefin-boundary-vertical", "mermaid-cynefin-boundary:vertical", verticalBounds, vertical.pathWidth, vertical.pathHeight, vertical.pathData, config.style.boundaryColor, config.style.boundaryWidth));
  const horizontalBounds = { x: left + pad, y: dividerY, w: width - pad * 2, h: config.boundaryAmplitude * 2 + 2 };
  const horizontal = wavePath(horizontalBounds, false, config.boundaryAmplitude, seed + 1);
  result.push(pathElement("mermaid-cynefin-boundary-horizontal", "mermaid-cynefin-boundary:horizontal", horizontalBounds, horizontal.pathWidth, horizontal.pathHeight, horizontal.pathData, config.style.boundaryColor, config.style.boundaryWidth));
  const cliffBounds = { x: midX - centerGapX / 2, y: midY + centerGapY / 2 - 5, w: centerGapX, h: centerGapY };
  result.push(pathElement("mermaid-cynefin-cliff", "mermaid-cynefin-cliff", cliffBounds, cliffBounds.w, cliffBounds.h, `M 0 0 C ${centerGapX * .35} ${centerGapY * .28} ${centerGapX * .62} ${centerGapY * .74} ${centerGapX} ${centerGapY}`, config.style.cliffColor, config.style.cliffWidth));
  const confusion: ShapeElement = { type: "circle", id: "mermaid-cynefin-domain:confusion", componentRole: "mermaid-cynefin-domain:confusion", x: midX - 108, y: midY - confusionHeight / 2, w: 216, h: confusionHeight, color: config.style.boundaryColor, thickness: config.style.boundaryWidth, fillColor: config.style.confusionBg, fillOpacity: 1, label: { text: "", color: config.style.labelColor, fontSize: config.style.domainFontSize, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } };
  frames.set("confusion", confusion); result.push(confusion);
  for (const transition of diagram.transitions) result.push(connector(frames.get(transition.from)!, frames.get(transition.to)!, transition, config));
  const descriptionElements: TextElement[] = [];
  for (const domain of CYNEFIN_DOMAINS) {
    const bounds = domain === "confusion" ? confusion : frameBounds[domain];
    const centered = domain === "confusion"; const headingY = bounds.y + 13;
    descriptionElements.push(text(`mermaid-cynefin-heading:${domain}`, `mermaid-cynefin-heading:${domain}`, bounds.x + (centered ? 0 : 16), headingY, domainTitles[domain], config.style.labelColor, config.style.domainFontSize, true, centered ? "center" : "left"));
    if (config.showDomainDescriptions) descriptionElements.push(text(`mermaid-cynefin-description:${domain}`, `mermaid-cynefin-description:${domain}`, bounds.x + (centered ? 8 : 16), headingY + 22, domainDescriptions[domain], config.style.textColor, 9, false, centered ? "center" : "left"));
  }
  result.push(...descriptionElements);
  for (const domain of CYNEFIN_DOMAINS) {
    const bounds = domain === "confusion" ? confusion : frameBounds[domain]; const labels = diagram.domains[domain];
    const cardGapY = domain === "confusion" ? 2 : 7;
    if (domain === "confusion") {
      const cardWidth = bounds.w - 34; let cardY = bounds.y + confusionStartOffset;
      labels.slice(0, 3).forEach((item, index) => {
        const cardHeight = cynefinCardHeight(item.label, cardWidth, config.style.itemFontSize, 22);
        result.push(itemCard(domain, item, index, bounds.x + 17, cardY, cardWidth, cardHeight, config)); cardY += cardHeight + cardGapY;
      });
      const extras = labels.slice(3).map(item => item.label);
      if (extras.length) {
        const overflow: ShapeElement = { type: "rectangle", id: "mermaid-cynefin-overflow:confusion", componentRole: `mermaid-cynefin-overflow:${encode(JSON.stringify(extras))}`, x: bounds.x + 17, y: cardY, w: cardWidth, h: 18, color: config.style.boundaryColor, thickness: 1, fillColor: config.style.confusionBg, fillOpacity: 1, edgeStyle: "pill", label: { text: `+${extras.length} more`, color: config.style.textColor, fontSize: 9, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } };
        result.push(overflow);
      }
      continue;
    }
    const cardWidth = (bounds.w - 40) / 2; const startY = bounds.y + quadrantHeaderHeight; const rowOffsets: number[] = [];
    for (let index = 0, rowY = startY; index < labels.length; index += 2) {
      rowOffsets.push(rowY);
      const rowHeight = Math.max(cynefinCardHeight(labels[index].label, cardWidth, config.style.itemFontSize, 34), labels[index + 1] ? cynefinCardHeight(labels[index + 1].label, cardWidth, config.style.itemFontSize, 34) : 0);
      rowY += rowHeight + cardGapY;
    }
    labels.forEach((item, index) => { const column = index % 2; const row = Math.floor(index / 2); const cardHeight = cynefinCardHeight(item.label, cardWidth, config.style.itemFontSize, 34); result.push(itemCard(domain, item, index, bounds.x + 14 + column * (cardWidth + 8), rowOffsets[row], cardWidth, cardHeight, config)); });
  }
  return result;
}

function itemCard(domain: CynefinDomain, item: CynefinItem, index: number, x: number, y: number, w: number, h: number, config: CynefinConfig): ShapeElement {
  return { type: "rectangle", id: `mermaid-cynefin-item:${domain}:${index}`, componentRole: `mermaid-cynefin-item:${domain}:${index}`, x, y, w, h, color: config.style.boundaryColor, thickness: 1, fillColor: "#ffffff", fillOpacity: .9, edgeStyle: "rounded", cornerRadius: 6, label: { text: item.label, color: config.style.textColor, fontSize: config.style.itemFontSize, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } };
}

function cynefinCardHeight(text: string, width: number, fontSize: number, minimum: number) {
  const approximateCharactersPerLine = Math.max(4, Math.floor(width / Math.max(1, fontSize * .58)));
  let lineCount = 0;
  for (const paragraph of text.split(/\r?\n/)) {
    let lineLength = 0;
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      const wordLines = Math.ceil(word.length / approximateCharactersPerLine);
      if (lineLength && lineLength + word.length + 1 > approximateCharactersPerLine) { lineCount++; lineLength = 0; }
      if (wordLines > 1) { lineCount += wordLines - 1; lineLength = word.length % approximateCharactersPerLine; }
      else lineLength += (lineLength ? 1 : 0) + word.length;
    }
    lineCount += 1;
  }
  return Math.max(minimum, lineCount * fontSize * 1.25 + 8);
}

function hashSource(source: string) {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index++) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  return (hash >>> 0) % 1_000_000 + 1;
}

function flatten(elements: Element[]): Element[] { return elements.flatMap(item => item.hidden ? [] : item.type === "group" ? flatten(item.elements) : [item]); }

function metadataFromSource(source: string) {
  const lines = linesOf(source); const header = headerInfo(lines); if (!header) return { frontmatter: [] as string[], accessibility: [] as string[] };
  const frontmatter = header.frontmatterStart < 0 ? [] : lines.slice(header.frontmatterStart, header.frontmatterEnd + 1);
  const accessibility: string[] = []; let inDescription = false;
  for (const line of lines.slice(header.header + 1)) {
    if (inDescription) { accessibility.push(line); if (/^\s*\}/.test(line.trim())) inDescription = false; continue; }
    if (/^\s*acc(?:Title|Descr)\s*:/i.test(line)) accessibility.push(line.trim());
    else if (/^\s*accDescr\s*\{/i.test(line)) { accessibility.push(line.trim()); inDescription = true; }
  }
  return { frontmatter, accessibility };
}

function quote(value: string) { return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/[\r\n]+/g, " ")}"`; }

export function exportMermaidCynefin(elements: Element[], originalSource = "") {
  const items = flatten(elements); const domains = items.filter((item): item is ShapeElement => item.type === "rectangle" || item.type === "circle" ? item.componentRole?.startsWith("mermaid-cynefin-domain:") === true : false);
  const domainMap = new Map<CynefinDomain, ShapeElement>();
  for (const item of domains) { const domain = item.componentRole!.slice("mermaid-cynefin-domain:".length); if (isDomain(domain)) domainMap.set(domain, item); }
  if (domainMap.size !== CYNEFIN_DOMAINS.length) throw new Error("This Mermaid Cynefin diagram needs all five editable domains to export.");
  const domainHeadings = items.filter((item): item is TextElement => item.type === "text" && item.componentRole?.startsWith("mermaid-cynefin-heading:") === true);
  for (const heading of domainHeadings) {
    const domain = heading.componentRole!.slice("mermaid-cynefin-heading:".length);
    if (isDomain(domain) && heading.text !== domainTitles[domain]) throw new Error(`The ${domainTitles[domain]} Cynefin heading is fixed by Mermaid syntax and cannot be renamed.`);
  }
  const descriptions = items.filter((item): item is TextElement => item.type === "text" && item.componentRole?.startsWith("mermaid-cynefin-description:") === true);
  for (const description of descriptions) {
    const domain = description.componentRole!.slice("mermaid-cynefin-description:".length);
    if (isDomain(domain) && description.text !== domainDescriptions[domain]) throw new Error("Cynefin domain descriptions are framework labels, not Mermaid source fields; restore the default description before exporting.");
  }
  const title = items.find((item): item is TextElement => item.type === "text" && item.componentRole === "mermaid-cynefin-title");
  const frames = domainMap;
  const cardElements = items.filter((item): item is ShapeElement => item.type === "rectangle" && item.componentRole?.startsWith("mermaid-cynefin-item:") === true);
  const overflow = items.filter((item): item is ShapeElement => item.type === "rectangle" && item.componentRole?.startsWith("mermaid-cynefin-overflow:") === true);
  const parsedOriginal = originalSource ? parseMermaidCynefin(originalSource) : undefined;
  if (parsedOriginal && parsedOriginal.domains.confusion.length > 3 && overflow.length !== 1) throw new Error("The Confusion domain overflow badge was removed; its hidden source labels cannot be safely exported.");
  const lines = ["cynefin-beta"]; const metadata = metadataFromSource(originalSource);
  if (metadata.frontmatter.length) lines.unshift(...metadata.frontmatter);
  if (title?.text.trim()) lines.push(`title ${quote(title.text.trim())}`);
  for (const domain of CYNEFIN_DOMAINS) {
    lines.push(domain);
    const frame = frames.get(domain)!; const domainCards = cardElements.filter(card => itemDomain(card, frames) === domain);
    domainCards.sort((a, b) => a.y - b.y || a.x - b.x || itemOrder(a) - itemOrder(b));
    for (const card of domainCards) lines.push(`  ${quote((card.label?.text ?? "").trim())}`);
    if (domain === "confusion" && overflow.length) {
      let extras: string[];
      try { extras = JSON.parse(decode(overflow[0].componentRole!.slice("mermaid-cynefin-overflow:".length))) as string[]; }
      catch { throw new Error("The Confusion domain overflow data is invalid and cannot be exported."); }
      if (overflow[0].label?.text !== `+${extras.length} more`) throw new Error("The Confusion domain overflow badge is generated from hidden source items and cannot be edited directly.");
      for (const label of extras) lines.push(`  ${quote(label)}`);
    }
    void frame;
  }
  for (const transition of items.filter((item): item is ShapeElement => (item.type === "arrow" || item.type === "line") && item.componentRole?.startsWith("mermaid-cynefin-transition:") === true)) {
    let details: { from?: string; to?: string };
    try { details = JSON.parse(decode(transition.componentRole!.slice("mermaid-cynefin-transition:".length))) as { from?: string; to?: string }; }
    catch { throw new Error("A Cynefin transition has invalid endpoint metadata and cannot be exported."); }
    if (!isDomain(details.from ?? "") || !isDomain(details.to ?? "") || details.from === details.to) throw new Error("A Cynefin transition must connect two different recognized domains.");
    const label = transition.label?.text?.trim();
    lines.push(`${details.from} --> ${details.to}${label ? ` : ${quote(label)}` : ""}`);
  }
  lines.push(...metadata.accessibility);
  return lines.join("\n") + "\n";
}

function itemOrder(item: ShapeElement) { return Number(/mermaid-cynefin-item:[^:]+:(\d+)$/.exec(item.componentRole ?? "")?.[1] ?? 0); }

function itemDomain(item: ShapeElement, domains: Map<CynefinDomain, ShapeElement>): CynefinDomain | undefined {
  const cx = item.x + item.w / 2; const cy = item.y + item.h / 2;
  const matches = [...domains.entries()].filter(([, frame]) => cx >= frame.x && cx <= frame.x + frame.w && cy >= frame.y && cy <= frame.y + frame.h).sort((a, b) => a[1].w * a[1].h - b[1].w * b[1].h);
  if (matches[0]) return matches[0][0];
  const original = /^mermaid-cynefin-item:([^:]+):/.exec(item.componentRole ?? ""); return original && isDomain(original[1]) ? original[1] : undefined;
}
