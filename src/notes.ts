import type { Element, FlowchartShape, GroupElement, NoteKind, ShapeElement, TextElement, Theme } from "./model";

const text = (x: number, y: number, value: string, color = "#303638", size = 14, family: TextElement["fontFamily"] = "sans", bold = false): TextElement => ({
  type: "text", x, y, text: value, color, fontSize: size, fontFamily: family, bold, textAlign: "left", listType: "none",
});

const rect = (x: number, y: number, w: number, h: number, fill: string, color: string, radius = 12): ShapeElement => ({
  type: "rectangle", x, y, w, h, color, thickness: 1.4, fillColor: fill, fillOpacity: 1, edgeStyle: "rounded", cornerRadius: radius,
});

export const normalizeNoteContent = (content: string, kind: NoteKind) => {
  const hasContent = content.trim();
  if (kind !== "checklist") return content;
  return (hasContent ? content.split(/\r?\n/) : [""]).map(line => {
    if (!line.trim()) return "";
    const indent = /^\s*/.exec(line)?.[0].replace(/\t/g, "  ") ?? "";
    const task = line.trimStart();
    const existing = /^(?:(?:[-*]|\d+\.)\s+)?\[([ xX])\]\s*(.*)$/.exec(task);
    return existing ? `${indent}- [${existing[1]}] ${existing[2]}` : `${indent}- [ ] ${task.replace(/^(?:[-*]|\d+\.)\s+/, "")}`;
  }).filter(Boolean).join("\n") || "- [ ] New task";
};

const NOTE_CARD_PALETTES: Record<Theme, Record<NoteKind, { surface: string; border: string; accent: string; ink: string; muted: string; rule: string; soft: string; check: string }>> = {
  light: {
    note: { surface: "#ffffff", border: "#d9e0e8", accent: "#607d9a", ink: "#263445", muted: "#738196", rule: "#e8edf2", soft: "#f4f7fa", check: "#557ea8" },
    sticky: { surface: "#fbf8f0", border: "#e6ddc8", accent: "#a28850", ink: "#49402d", muted: "#93845f", rule: "#eee7d8", soft: "#f4eedf", check: "#8c7545" },
    checklist: { surface: "#f5f9f6", border: "#d7e4da", accent: "#5f8a6d", ink: "#2d4035", muted: "#72897a", rule: "#e3ece5", soft: "#eaf2ec", check: "#4d8965" },
  },
  dark: {
    note: { surface: "#282e36", border: "#444d59", accent: "#86a9cf", ink: "#e6edf5", muted: "#a0adbc", rule: "#3b444f", soft: "#333c47", check: "#83aeda" },
    sticky: { surface: "#332f25", border: "#514a38", accent: "#c6aa64", ink: "#eee4c9", muted: "#c0b38e", rule: "#4a4333", soft: "#403a2d", check: "#ccb263" },
    checklist: { surface: "#27332b", border: "#405447", accent: "#7fb08a", ink: "#e0eee3", muted: "#a1b5a6", rule: "#394b3e", soft: "#304036", check: "#86bd93" },
  },
};
export const defaultNoteTitle = (kind: NoteKind) => kind === "sticky" ? "Sticky note" : kind === "checklist" ? "Checklist" : "Note + code";
export const noteCardPalette = (kind: NoteKind, theme: Theme, appearance: "modern" | "simple" = "modern") => appearance === "simple"
  ? { surface: theme === "dark" ? "#202020" : "#ffffff", border: theme === "dark" ? "#b8b8b8" : "#777777", accent: theme === "dark" ? "#c8c8c8" : "#666666", ink: theme === "dark" ? "#f0f0f0" : "#202020", muted: theme === "dark" ? "#c5c5c5" : "#606060", rule: theme === "dark" ? "#555555" : "#c6c6c6", soft: theme === "dark" ? "#333333" : "#eeeeee", check: theme === "dark" ? "#dedede" : "#555555" }
  : NOTE_CARD_PALETTES[theme][kind];

export function checklistRows(content: string, width: number, fontSize: number) {
  let top = 86;
  return content.split(/\r?\n/).filter(line => line.trim()).map((line, index) => {
    const match = /^\s*(?:[-*]|\d+\.)\s+\[([ xX])\]\s*(.*)$/.exec(line);
    const indent = Math.min(6, Math.floor((line.match(/^\s*/)?.[0].replace(/\t/g, "  ").length ?? 0) / 2)) * 14;
    const lineHeight = Math.max(16, fontSize * 1.38);
    const boxX = 16 + indent; const textX = boxX + 27;
    const max = Math.max(6, Math.floor((width - textX - 16) / (fontSize * .54)));
    let rest = match?.[2] || "Untitled task"; const labelLines: string[] = [];
    while (rest.length > max) { const breakAt = rest.lastIndexOf(" ", max); const count = breakAt > 0 ? breakAt : max; labelLines.push(rest.slice(0, count)); rest = rest.slice(count).trimStart(); }
    labelLines.push(rest);
    const height = Math.max(28, labelLines.length * lineHeight + 7);
    const row = { index, top, height, lineHeight, boxX, textX, done: match?.[1].toLowerCase() === "x", labelLines };
    top += height + 3; return row;
  });
}

export function syntaxTokens(line: string, language: string): { value: string; color: string }[] {
  const langs = language.toLowerCase();
  const generalKeywords = /\b(const|let|var|function|return|if|else|for|while|class|new|import|from|export|default|async|await|throw|try|catch|interface|type|public|private|static|def|elif|in|and|or|not|True|False|None|pass|with|as|yield|extends|implements|void|number|string|boolean|true|false|null)\b/g;
  const sqlKeywords = /\b(select|from|where|join|left|right|inner|outer|on|as|group|by|order|limit|create|table|insert|into|values|update|set|delete|primary|key|foreign|references|not|null|unique|and|or|count|having|distinct)\b/g;
  const cssKeywords = /\b(color|background|display|position|flex|grid|margin|padding|width|height|border|font|align|justify|gap|transform|opacity|overflow|top|right|bottom|left)\b/g;
  const isHtml = ["html", "xml", "svg", "jsx", "tsx"].includes(langs);
  const tokenPattern = isHtml
    ? /(<!--.*?-->|<\/?[A-Za-z][^>]*>|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b)/g
    : /(\/\/.*|#.*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b)/g;
  const tokens: { value: string; color: string }[] = [];
  let cursor = 0;
  for (const match of line.matchAll(tokenPattern)) {
    const value = match[0]; const start = match.index ?? 0;
    if (start > cursor) tokens.push({ value: line.slice(cursor, start), color: "#dce5f4" });
    let color = "#dce5f4";
    if (value.startsWith("//") || value.startsWith("#") || value.startsWith("<!--")) color = "#91a78d";
    else if (isHtml && value.startsWith("<")) color = "#85b8ee";
    else if (/^["'`]/.test(value)) color = langs === "json" ? "#a9d887" : "#e7b579";
    else if (/^\d/.test(value)) color = "#c5a6ed";
    else if (new RegExp((langs === "sql" ? sqlKeywords : ["css", "scss", "less"].includes(langs) ? cssKeywords : generalKeywords).source).test(value)) color = "#85b8ee";
    else if (/^[A-Z]/.test(value)) color = "#dfc477";
    tokens.push({ value, color }); cursor = start + value.length;
  }
  if (cursor < line.length) tokens.push({ value: line.slice(cursor), color: "#dce5f4" });
  return tokens.filter(token => token.value).reduce((runs, token) => {
    const previous = runs[runs.length - 1];
    if (previous?.color === token.color) previous.value += token.value;
    else runs.push({ ...token });
    return runs;
  }, [] as { value: string; color: string }[]);
}

export function syntaxTokenColor(color: string, theme: Theme, appearance: "modern" | "simple") {
  if (appearance !== "simple" || theme === "dark") return color;
  const lightColors: Record<string, string> = {
    "#dce5f4": "#334155", "#91a78d": "#557044", "#85b8ee": "#1c5d96",
    "#a9d887": "#49751f", "#e7b579": "#98561d", "#c5a6ed": "#7043a5", "#dfc477": "#81620b",
  };
  return lightColors[color] ?? "#334155";
}

/** Store card content in metadata and one backing shape, keeping the document in v7 groups. */
export function buildNoteGroup(x: number, y: number, kind: NoteKind, source: string, dimensions: { width?: number; height?: number; fontSize?: number; collapsed?: boolean; title?: string } = {}): GroupElement {
  const content = normalizeNoteContent(source, kind);
  const width = Math.max(180, Math.min(4000, dimensions.width ?? (kind === "sticky" ? 296 : 340)));
  const fontSize = Math.round(Math.max(8, Math.min(32, dimensions.fontSize ?? 14)));
  const collapsed = dimensions.collapsed === true;
  const title = (dimensions.title ?? defaultNoteTitle(kind)).trim().slice(0, 120) || defaultNoteTitle(kind);
  const palette = noteCardPalette(kind, "light");
  const lines = content.split(/\r?\n/);
  let estimated = 82;
  if (kind === "checklist") {
    const rows = checklistRows(content, width, fontSize); const last = rows[rows.length - 1]; estimated = last ? last.top + last.height + 16 : 116;
  } else {
    const maxChars = Math.max(8, Math.floor((width - 38) / (fontSize * .56)));
    let inCode = false; let codeCount = 0;
    for (const line of lines) {
      if (/^\s*```/.test(line)) { if (inCode) { estimated += Math.max(48, codeCount * fontSize * 1.55 + 28) + 10; codeCount = 0; } inCode = !inCode; continue; }
      if (inCode) codeCount++; else estimated += line.trim() ? Math.ceil(line.length / maxChars) * fontSize * 1.5 : 9;
    }
    if (inCode) estimated += Math.max(48, codeCount * fontSize * 1.55 + 28);
    estimated += 18;
  }
  const fullHeight = dimensions.height === undefined ? Math.max(estimated, 120) : Math.max(100, Math.min(1_000_000, dimensions.height));
  const visibleHeight = collapsed ? 66 : fullHeight;
  const background: ShapeElement = { type: "rectangle", x, y, w: width, h: visibleHeight, color: palette.border, thickness: 1, fillColor: palette.surface, fillOpacity: 1, edgeStyle: "rounded", cornerRadius: 12 };
  return { type: "group", note: { kind, content, title, width, height: fullHeight, fontSize, collapsed }, elements: [background] };
}

/** Render a whole note card in one pass instead of adding a canvas element for every line or token. */
export function drawNoteCard(ctx: CanvasRenderingContext2D, group: GroupElement, theme: Theme, appearance: "modern" | "simple" = "modern") {
  const meta = group.note; const background = group.elements.find((item): item is ShapeElement => item.type === "rectangle");
  if (!meta || !background) return;
  const { x, y } = background; const width = Math.abs(background.w); const height = Math.abs(background.h);
  const palette = noteCardPalette(meta.kind, theme, appearance); const fontSize = Math.max(8, Math.min(48, meta.fontSize ?? 14));
  ctx.save(); ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x, y, width, height, appearance === "simple" ? 0 : 9); ctx.fillStyle = palette.surface; ctx.fill(); ctx.strokeStyle = palette.border; ctx.stroke();
  if (appearance !== "simple") { ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, width, height, 9); ctx.clip(); ctx.fillStyle = palette.accent; ctx.fillRect(x, y + 1, 3, Math.max(0, height - 2)); ctx.restore(); }
  const collapsed = meta.collapsed === true; const title = (meta.title || defaultNoteTitle(meta.kind)).slice(0, 120);
  ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.font = "600 13px system-ui, sans-serif"; ctx.fillStyle = palette.ink; ctx.fillText(title, x + 16, y + 13, Math.max(40, width - 94));
  const toggleX = x + width - 38; const toggleY = collapsed ? y + 20 : y + 11;
  ctx.beginPath(); ctx.roundRect(toggleX, toggleY, 24, 24, appearance === "simple" ? 0 : 7); ctx.fillStyle = palette.soft; ctx.fill(); ctx.strokeStyle = palette.rule; ctx.stroke();
  ctx.strokeStyle = palette.muted; ctx.lineWidth = 1.5; ctx.beginPath();
  if (collapsed) { ctx.moveTo(toggleX + 8, toggleY + 9); ctx.lineTo(toggleX + 12, toggleY + 13); ctx.lineTo(toggleX + 16, toggleY + 9); }
  else { ctx.moveTo(toggleX + 8, toggleY + 15); ctx.lineTo(toggleX + 12, toggleY + 11); ctx.lineTo(toggleX + 16, toggleY + 15); }
  ctx.stroke();
  if (collapsed) {
    const rows = meta.kind === "checklist" ? checklistRows(meta.content, width, fontSize) : undefined;
    const completed = rows?.filter(row => row.done).length ?? 0;
    const summary = rows ? completed + " of " + rows.length + " tasks" : (meta.content.split(/\r?\n/).find(line => line.trim() && !/^\s*```/.test(line)) ?? "Empty card").trim();
    ctx.font = "500 10px system-ui, sans-serif"; ctx.fillStyle = palette.muted; ctx.fillText(summary, x + 16, y + 37, Math.max(40, width - 70));
  }
  if (!collapsed) { ctx.strokeStyle = palette.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 14, y + 47); ctx.lineTo(x + width - 14, y + 47); ctx.stroke(); }
  if (collapsed || height <= 54) { ctx.restore(); return; }
  ctx.save(); ctx.beginPath(); ctx.rect(x + 8, y + 49, width - 16, height - 57); ctx.clip();
  const drawText = (value: string, px: number, py: number, size = fontSize, color = palette.ink, weight = 400, family = "system-ui, sans-serif") => { ctx.font = `${weight} ${size}px ${family}`; ctx.fillStyle = color; ctx.textAlign = "left"; ctx.fillText(value, px, py, Math.max(1, x + width - 14 - px)); };
  const wrap = (value: string, max: number) => { const chunks: string[] = []; let remaining = value; while (remaining.length > max) { let cut = remaining.lastIndexOf(" ", max); if (cut < 1) cut = max; chunks.push(remaining.slice(0, cut)); remaining = remaining.slice(cut).trimStart(); } chunks.push(remaining); return chunks; };
  if (meta.kind === "checklist") {
    const rows = checklistRows(meta.content, width, fontSize); const completed = rows.filter(row => row.done).length;
    drawText(`${completed} of ${rows.length} complete`, x + 16, y + 53, 10, palette.muted, 600);
    const progressWidth = width - 32; ctx.beginPath(); ctx.roundRect(x + 16, y + 71, progressWidth, 3, appearance === "simple" ? 0 : 2); ctx.fillStyle = palette.rule; ctx.fill();
    if (completed && rows.length) { ctx.beginPath(); ctx.roundRect(x + 16, y + 71, progressWidth * completed / rows.length, 3, appearance === "simple" ? 0 : 2); ctx.fillStyle = palette.check; ctx.fill(); }
    for (const row of rows) {
      const boxX = x + row.boxX; const textX = x + row.textX; const textTop = y + row.top + (row.height - row.labelLines.length * row.lineHeight) / 2;
      const checkboxY = y + row.top + Math.max(0, (row.height - 16) / 2);
      ctx.beginPath(); ctx.roundRect(boxX, checkboxY, 16, 16, appearance === "simple" ? 0 : 4); ctx.fillStyle = row.done ? palette.check : palette.surface; ctx.fill(); ctx.strokeStyle = row.done ? palette.check : palette.border; ctx.stroke();
      if (row.done) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(boxX + 4, checkboxY + 8); ctx.lineTo(boxX + 7, checkboxY + 11); ctx.lineTo(boxX + 12, checkboxY + 5); ctx.stroke(); }
      row.labelLines.forEach((line, lineIndex) => {
        const baseline = textTop + lineIndex * row.lineHeight; drawText(line, textX, baseline, fontSize, row.done ? palette.muted : palette.ink);
        if (row.done) { const measured = ctx.measureText(line).width; ctx.strokeStyle = palette.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(textX, baseline + fontSize * .7); ctx.lineTo(textX + measured, baseline + fontSize * .7); ctx.stroke(); }
      });
    }
  } else {
    let cursor = y + 58; let inCode = false; let language = "text"; let codeLines: string[] = [];
    const flushCode = () => {
      const max = Math.max(8, Math.floor((width - 42) / (fontSize * .62))); const lines = codeLines.flatMap(line => wrap(line, max)); const blockHeight = Math.max(45, lines.length * fontSize * 1.5 + 26);
      ctx.beginPath(); ctx.roundRect(x + 10, cursor, width - 20, blockHeight, appearance === "simple" ? 0 : 7); ctx.fillStyle = appearance === "simple" ? palette.surface : "#202936"; ctx.fill(); ctx.strokeStyle = appearance === "simple" ? palette.rule : "#344154"; ctx.stroke();
      ctx.font = "600 9px system-ui, sans-serif"; ctx.fillStyle = appearance === "simple" ? palette.muted : "#91a1b5"; ctx.fillText(language.toUpperCase(), x + 20, cursor + 7);
      lines.forEach((line, index) => { let px = x + 20; const py = cursor + 22 + index * fontSize * 1.5; for (const token of syntaxTokens(line, language)) { ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Consolas, monospace`; ctx.fillStyle = syntaxTokenColor(token.color, theme, appearance); ctx.fillText(token.value, px, py); px += ctx.measureText(token.value).width; } });
      cursor += blockHeight + 9; codeLines = []; inCode = false;
    };
    const maxChars = Math.max(8, Math.floor((width - 36) / (fontSize * .56)));
    for (const line of meta.content.split(/\r?\n/)) {
      const fence = /^\s*```\s*([\w+#.-]*)\s*$/.exec(line);
      if (fence) { if (!inCode) { inCode = true; language = fence[1] || "text"; } else flushCode(); continue; }
      if (inCode) { codeLines.push(line); continue; }
      if (!line.trim()) { cursor += 8; continue; }
      const heading = /^(#{1,3})\s+(.*)$/.exec(line); const size = heading ? fontSize + (4 - heading[1].length) * 2 : fontSize;
      for (const part of wrap(heading?.[2] ?? line, maxChars)) { drawText(part, x + 16, cursor, size, palette.ink, heading ? 650 : 400); cursor += size * 1.5; }
    }
    if (inCode) flushCode();
  }
  ctx.restore(); ctx.restore();
}
export function noteCollapseHit(group: GroupElement, point: { x: number; y: number }): boolean {
  if (!group.note) return false;
  const background = group.elements.find((item): item is ShapeElement => item.type === "rectangle");
  if (!background) return false;
  const x = background.x + background.w - 40; const y = background.y + (group.note.collapsed ? 16 : 8);
  return point.x >= x && point.x <= x + 30 && point.y >= y && point.y <= y + 30;
}

export const EXTRA_FLOWCHART_SHAPES: { value: FlowchartShape; label: string }[] = [
  { value: "cloud", label: "Cloud / external service" }, { value: "star", label: "Star" },
  { value: "lightning", label: "Lightning" }, { value: "heart", label: "Heart" },
  { value: "callout", label: "Callout" },
];

export function checklistIndexAt(group: GroupElement, point: { x: number; y: number }): number | undefined {
  if (group.note?.kind !== "checklist" || group.note.collapsed) return undefined;
  const background = group.elements.find((item): item is ShapeElement => item.type === "rectangle");
  if (!background) return undefined;
  for (const row of checklistRows(group.note.content, Math.abs(background.w), group.note.fontSize ?? 14)) {
    const x = background.x + row.boxX; const y = background.y + row.top + Math.max(0, (row.height - 16) / 2);
    if (point.x >= x - 4 && point.x <= x + 24 && point.y >= y - 4 && point.y <= y + 20) return row.index;
  }
  return undefined;
}

export function toggleChecklistContent(content: string, target: number): string {
  let row = -1;
  return content.split(/\r?\n/).map(line => {
    if (!line.trim()) return line;
    row++;
    if (row !== target) return line;
    return line.replace(/\[([ xX])\]/, (_match, value: string) => `[${value.trim() ? " " : "x"}]`);
  }).join("\n");
}

export type LibraryComponentKind = "uml-class" | "uml-lifeline" | "uml-activation" | "uml-inheritance" | "uml-realization" | "uml-aggregation" | "uml-composition" | "sequence-sync" | "sequence-async" | "er-table" | "er-one-many" | "er-many-many" | "c4-system" | "c4-container" | "c4-component" | "tech-database" | "tech-cloud" | "tech-service" | "data-flow" | "network-zone";
export const LIBRARY_COMPONENTS: { kind: LibraryComponentKind; section: string; label: string; description: string; width: number; height: number }[] = [
  { kind: "uml-class", section: "UML · Class & sequence", label: "Class card", description: "Name, attributes, and methods compartments", width: 230, height: 154 },
  { kind: "uml-lifeline", section: "UML · Class & sequence", label: "Lifeline", description: "Participant header and dashed lifeline", width: 154, height: 250 },
  { kind: "uml-activation", section: "UML · Class & sequence", label: "Activation bar", description: "Sequence activation marker", width: 28, height: 82 },
  { kind: "sequence-sync", section: "UML · Class & sequence", label: "Sync message", description: "Solid synchronous message arrow", width: 184, height: 50 },
  { kind: "sequence-async", section: "UML · Class & sequence", label: "Async message", description: "Open asynchronous message arrow", width: 184, height: 50 },
  { kind: "uml-inheritance", section: "UML · Relationships", label: "Inheritance", description: "Solid line with hollow arrow", width: 184, height: 42 },
  { kind: "uml-realization", section: "UML · Relationships", label: "Realization", description: "Dashed line with hollow arrow", width: 184, height: 42 },
  { kind: "uml-aggregation", section: "UML · Relationships", label: "Aggregation", description: "Hollow diamond relationship", width: 184, height: 42 },
  { kind: "uml-composition", section: "UML · Relationships", label: "Composition", description: "Filled diamond relationship", width: 184, height: 42 },
  { kind: "er-table", section: "ER · Tables & relations", label: "Table schema card", description: "Table with PK, FK, field, and type rows", width: 220, height: 156 },
  { kind: "er-one-many", section: "ER · Tables & relations", label: "One to many", description: "Crow’s foot relationship connector", width: 190, height: 42 },
  { kind: "er-many-many", section: "ER · Tables & relations", label: "Many to many", description: "Crow’s feet on both endpoints", width: 190, height: 42 },
  { kind: "c4-system", section: "Architecture · C4 & infrastructure", label: "System boundary", description: "C4 system context enclosure", width: 300, height: 190 },
  { kind: "c4-container", section: "Architecture · C4 & infrastructure", label: "Container boundary", description: "C4 container enclosure", width: 250, height: 156 },
  { kind: "c4-component", section: "Architecture · C4 & infrastructure", label: "Component boundary", description: "C4 component enclosure", width: 210, height: 132 },
  { kind: "tech-database", section: "Architecture · C4 & infrastructure", label: "Database node", description: "Database with technology tag", width: 150, height: 94 },
  { kind: "tech-cloud", section: "Architecture · C4 & infrastructure", label: "External service", description: "Cloud service node", width: 166, height: 92 },
  { kind: "tech-service", section: "Architecture · C4 & infrastructure", label: "Service node", description: "Service with technology tag", width: 174, height: 92 },
  { kind: "data-flow", section: "Architecture · C4 & infrastructure", label: "Data flow", description: "Directional data pipeline arrow", width: 202, height: 46 },
  { kind: "network-zone", section: "Architecture · C4 & infrastructure", label: "Network zone", description: "Translucent infrastructure enclosure", width: 280, height: 168 },
];

const lineElement = (x: number, y: number, w: number, h: number, color = "#74889a", dashed = false): ShapeElement => ({ type: "line", x, y, w, h, color, thickness: 1.4, lineStyle: dashed ? "dashed" : "solid", startHead: "none", endHead: "none" });

export function buildLibraryComponent(kind: LibraryComponentKind, x: number, y: number): GroupElement {
  const elements: Element[] = [];
  if (kind === "uml-class") {
    elements.push(rect(x, y, 230, 154, "#f8fbff", "#7e94ad", 9), rect(x, y, 230, 36, "#e8f0fb", "#7e94ad", 9));
    elements.push(lineElement(x, y + 36, 230, 0), lineElement(x, y + 92, 230, 0));
    elements.push(text(x + 12, y + 9, "", "#345371", 14, "sans", true));
    elements.push(text(x + 12, y + 48, "", "#334453", 12, "mono"));
    elements.push(text(x + 12, y + 105, "", "#334453", 12, "mono"));
  } else if (kind === "uml-lifeline") {
    elements.push({ ...rect(x + 12, y, 130, 42, "#edf4ff", "#7e94ad", 8), label: { text: "", color: "#345371", fontSize: 13, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } });
    elements.push(lineElement(x + 77, y + 42, 0, 200, "#8497a8", true));
  } else if (kind === "uml-activation") {
    elements.push(rect(x + 5, y, 18, 82, "#d7e6f8", "#6887a6", 3));
  } else if (kind.startsWith("uml-") && ["uml-inheritance", "uml-realization", "uml-aggregation", "uml-composition"].includes(kind)) {
    const dashed = kind === "uml-realization"; const relation = lineElement(x + 24, y + 21, 148, 0, "#657b91", dashed); relation.endHead = kind === "uml-inheritance" || dashed ? "open" : "none"; elements.push(relation);
    if (kind === "uml-aggregation" || kind === "uml-composition") elements.push({ type: "diamond", x: x + 9, y: y + 15, w: 12, h: 12, color: "#657b91", thickness: 1.4, fillColor: kind === "uml-composition" ? "#657b91" : "#ffffff" });
  } else if (kind === "sequence-sync" || kind === "sequence-async") {
    const message = lineElement(x + 5, y + 25, 174, 0, "#617a92"); message.endHead = kind === "sequence-async" ? "open" : "solid"; message.label = { text: "", color: "#617a92", fontSize: 10, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" }; elements.push(message);
  } else if (kind === "er-table") {
    elements.push(rect(x, y, 220, 156, "#fbfcfe", "#879caf", 9), rect(x, y, 220, 32, "#e8f0f7", "#879caf", 9));
    elements.push(text(x + 12, y + 9, "", "#36556e", 13, "sans", true));
    elements.push(lineElement(x, y + 32, 220, 0), lineElement(x, y + 73, 220, 0), lineElement(x, y + 114, 220, 0));
    elements.push(text(x + 10, y + 43, "", "#536477", 11, "mono"), text(x + 10, y + 84, "", "#536477", 11, "mono"), text(x + 10, y + 125, "", "#536477", 11, "mono"));
  } else if (kind === "er-one-many" || kind === "er-many-many") {
    elements.push(lineElement(x + 8, y + 21, 174, 0, "#60788e"));
    const foot = (fx: number, fy: number, direction: number) => [lineElement(fx, fy, direction * 12, -10, "#60788e"), lineElement(fx, fy, direction * 12, 0, "#60788e"), lineElement(fx, fy, direction * 12, 10, "#60788e")];
    if (kind === "er-many-many") elements.push(...foot(x + 9, y + 21, 1), ...foot(x + 181, y + 21, -1));
    else { elements.push(lineElement(x + 174, y + 12, 0, 18, "#60788e"), ...foot(x + 182, y + 21, -1)); }
  } else if (kind === "c4-system" || kind === "c4-container" || kind === "c4-component") {
    const meta = LIBRARY_COMPONENTS.find(item => item.kind === kind)!;
    elements.push({ ...rect(x, y, meta.width, meta.height, "#eef4ff", "#6884a0", 13), lineStyle: "dashed", label: { text: "", color: "#496681", fontSize: 13, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "top" } });
  } else if (kind === "tech-database") {
    elements.push({ type: "flowchart", x, y, w: 150, h: 94, color: "#6f7997", thickness: 1.5, fillColor: "#f0edfb", flowchartShape: "database", label: { text: "", color: "#535c78", fontSize: 12, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } });
  } else if (kind === "tech-cloud") {
    elements.push({ type: "flowchart", x, y, w: 166, h: 92, color: "#6685a1", thickness: 1.5, fillColor: "#edf5fb", flowchartShape: "cloud", label: { text: "", color: "#48657f", fontSize: 12, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } });
  } else if (kind === "tech-service") {
    elements.push({ ...rect(x, y, 174, 92, "#edf5f0", "#759785", 11), label: { text: "", color: "#4c6a59", fontSize: 12, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } });
    const pipe: ShapeElement = { type: "arrow", x: x + 5, y: y + 24, w: 192, h: 0, color: "#2d83a4", thickness: 4, lineStyle: "dashed", startHead: "none", endHead: "solid", label: { text: "", color: "#367991", fontSize: 10, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" } }; elements.push(pipe);
  } else if (kind === "network-zone") {
    elements.push({ ...rect(x, y, 280, 168, "#daf0f1", "#68a2a3", 13), fillOpacity: .42, lineStyle: "dashed", label: { text: "", color: "#3d7477", fontSize: 12, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "top" } });
  }
  return { type: "group", elements };
}
