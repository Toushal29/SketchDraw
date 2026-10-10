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
    note: { surface: "#252b26", border: "#424d44", accent: "#83c49a", ink: "#edf3ed", muted: "#b0bdb2", rule: "#3a453c", soft: "#303a32", check: "#76bc8e" },
    sticky: { surface: "#332d20", border: "#55472b", accent: "#e2b95e", ink: "#f3ead1", muted: "#caba95", rule: "#4a402c", soft: "#403821", check: "#d9ad49" },
    checklist: { surface: "#223329", border: "#3e5747", accent: "#85c99a", ink: "#e4f1e6", muted: "#a8c0ac", rule: "#354a3b", soft: "#2a3d31", check: "#7cc392" },
  },
};
export const defaultNoteTitle = (kind: NoteKind) => kind === "sticky" ? "Sticky note" : kind === "checklist" ? "Checklist" : "Note + code";
export const noteCardPalette = (kind: NoteKind, theme: Theme, appearance: "modern" | "simple" = "modern") => appearance === "simple"
  ? { surface: theme === "dark" ? "#202020" : "#ffffff", border: theme === "dark" ? "#b8b8b8" : "#777777", accent: theme === "dark" ? "#c8c8c8" : "#666666", ink: theme === "dark" ? "#f0f0f0" : "#202020", muted: theme === "dark" ? "#c5c5c5" : "#606060", rule: theme === "dark" ? "#555555" : "#c6c6c6", soft: theme === "dark" ? "#333333" : "#eeeeee", check: theme === "dark" ? "#dedede" : "#555555" }
  : NOTE_CARD_PALETTES[theme][kind];

function markdownCells(line: string): string[] {
  let source = line.trim();
  if (source.startsWith("|")) source = source.slice(1);
  if (source.endsWith("|")) source = source.slice(0, -1);
  return source.split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, "|"));
}
function isMarkdownTableDivider(line: string): boolean {
  const cells = markdownCells(line);
  return cells.length > 1 && cells.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

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

/** Store card content in metadata and one backing shape inside the Canvas section. */
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
  const visibleHeight = collapsed ? 52 : fullHeight;
  const background: ShapeElement = { type: "rectangle", x, y, w: width, h: visibleHeight, color: palette.border, thickness: 1, fillColor: palette.surface, fillOpacity: 1, edgeStyle: "rounded", cornerRadius: 12 };
  return { type: "group", note: { kind, content, title, width, height: fullHeight, fontSize, collapsed }, elements: [background] };
}

/** Render a whole note card in one pass instead of adding a canvas element for every line or token. */
export function drawNoteCard(ctx: CanvasRenderingContext2D, group: GroupElement, theme: Theme, appearance: "modern" | "simple" = "modern") {
  const meta = group.note; const background = group.elements.find((item): item is ShapeElement => item.type === "rectangle");
  if (!meta || !background) return;
  const { x, y } = background; const width = Math.abs(background.w); const height = Math.abs(background.h);
  const palette = noteCardPalette(meta.kind, theme, appearance); const fontSize = Math.round(Math.max(8, Math.min(48, meta.fontSize ?? 14)));
  ctx.save(); ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x, y, width, height, appearance === "simple" ? 0 : 9); ctx.fillStyle = palette.surface; ctx.fill(); ctx.strokeStyle = palette.border; ctx.stroke();
  if (appearance !== "simple") { ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, width, height, 9); ctx.clip(); ctx.fillStyle = palette.accent; ctx.fillRect(x, y + 1, 3, Math.max(0, height - 2)); ctx.restore(); }
  const collapsed = meta.collapsed === true; const title = (meta.title || defaultNoteTitle(meta.kind)).slice(0, 120);
  ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.font = "600 12px system-ui, sans-serif"; ctx.fillStyle = palette.ink; ctx.fillText(title, x + 14, y + (collapsed ? 8 : 13), Math.max(40, width - 88));
  const toggleX = x + width - 36; const toggleY = collapsed ? y + 6 : y + 11;
  ctx.beginPath(); ctx.roundRect(toggleX, toggleY, 24, 24, appearance === "simple" ? 0 : 7); ctx.fillStyle = palette.soft; ctx.fill(); ctx.strokeStyle = palette.rule; ctx.stroke();
  ctx.strokeStyle = palette.muted; ctx.lineWidth = 1.5; ctx.beginPath();
  if (collapsed) { ctx.moveTo(toggleX + 8, toggleY + 9); ctx.lineTo(toggleX + 12, toggleY + 13); ctx.lineTo(toggleX + 16, toggleY + 9); }
  else { ctx.moveTo(toggleX + 8, toggleY + 15); ctx.lineTo(toggleX + 12, toggleY + 11); ctx.lineTo(toggleX + 16, toggleY + 15); }
  ctx.stroke();
  if (collapsed) {
    const rows = meta.kind === "checklist" ? checklistRows(meta.content, width, fontSize) : undefined;
    const completed = rows?.filter(row => row.done).length ?? 0;
    const summary = rows ? completed + " of " + rows.length + " tasks" : (meta.content.split(/\r?\n/).find(line => line.trim() && !/^\s*```/.test(line)) ?? "Empty card").trim();
    ctx.font = "500 9px system-ui, sans-serif"; ctx.fillStyle = palette.muted; ctx.fillText(summary, x + 14, y + 31, Math.max(40, width - 62));
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
    const sourceLines = meta.content.split(/\r?\n/);
    const drawMarkdownInline = (value: string, px: number, py: number, size: number, baseWeight: number, baseColor = palette.ink) => {
      const pattern = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;
      let cursorX = px; let cursorIndex = 0;
      const drawRun = (text: string, bold: boolean, italic: boolean, code: boolean, strike: boolean) => {
        ctx.font = `${italic ? "italic " : ""}${bold ? 650 : baseWeight} ${size}px ${code ? "ui-monospace, SFMono-Regular, Consolas, monospace" : "system-ui, sans-serif"}`;
        const runWidth = ctx.measureText(text).width;
        if (code) { ctx.fillStyle = appearance === "simple" ? palette.soft : "#e9eef4"; ctx.fillRect(cursorX - 2, py + 1, runWidth + 4, size + 3); }
        ctx.fillStyle = code ? (theme === "dark" ? "#e4edf6" : "#34465a") : baseColor;
        ctx.textBaseline = "top"; ctx.fillText(text, cursorX, py, Math.max(1, x + width - 16 - cursorX));
        if (strike) { ctx.strokeStyle = baseColor; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cursorX, py + size * .55); ctx.lineTo(cursorX + runWidth, py + size * .55); ctx.stroke(); }
        cursorX += runWidth + (code ? 4 : 0);
      };
      for (const match of value.matchAll(pattern)) {
        const token = match[0]; const start = match.index ?? 0;
        if (start > cursorIndex) drawRun(value.slice(cursorIndex, start), false, false, false, false);
        const double = token.startsWith("**") || token.startsWith("__"); const strike = token.startsWith("~~"); const code = token.startsWith("`");
        const italic = !double && !strike && !code; const trim = double || strike ? 2 : 1;
        drawRun(token.slice(trim, -trim), double, italic, code, strike); cursorIndex = start + token.length;
      }
      if (cursorIndex < value.length) drawRun(value.slice(cursorIndex), false, false, false, false);
    };
    for (let lineIndex = 0; lineIndex < sourceLines.length;) {
      const line = sourceLines[lineIndex];
      const fence = /^\s*```\s*([\w+#.-]*)\s*$/.exec(line);
      if (fence) { if (!inCode) { inCode = true; language = fence[1] || "text"; } else flushCode(); lineIndex++; continue; }
      if (inCode) { codeLines.push(line); lineIndex++; continue; }
      if (!line.trim()) { cursor += 8; lineIndex++; continue; }
      if (lineIndex + 1 < sourceLines.length && isMarkdownTableDivider(sourceLines[lineIndex + 1])) {
        const header = markdownCells(line); const rows: string[][] = [header]; let rowIndex = lineIndex + 2;
        while (rowIndex < sourceLines.length && sourceLines[rowIndex].includes("|")) { rows.push(markdownCells(sourceLines[rowIndex])); rowIndex++; }
        const columns = Math.max(1, ...rows.map(row => row.length)); const tableWidth = width - 32; const cellWidth = tableWidth / columns; const rowHeight = Math.max(24, fontSize * 1.7); const tableHeight = rows.length * rowHeight;
        ctx.save(); ctx.beginPath(); ctx.rect(x + 16, cursor, tableWidth, tableHeight); ctx.clip();
        rows.forEach((row, r) => {
          const rowY = cursor + r * rowHeight;
          if (r === 0) { ctx.fillStyle = palette.soft; ctx.fillRect(x + 16, rowY, tableWidth, rowHeight); }
          for (let c = 0; c < columns; c++) {
            const left = x + 16 + c * cellWidth; const value = row[c] ?? ""; ctx.font = `${r === 0 ? "600" : "400"} ${Math.max(9, fontSize * .86)}px system-ui, sans-serif`; ctx.fillStyle = palette.ink; ctx.textBaseline = "middle"; ctx.textAlign = "left";
            ctx.fillText(value, left + 6, rowY + rowHeight / 2, Math.max(1, cellWidth - 12));
            if (c) { ctx.strokeStyle = palette.rule; ctx.lineWidth = .75; ctx.beginPath(); ctx.moveTo(left, rowY); ctx.lineTo(left, rowY + rowHeight); ctx.stroke(); }
          }
          ctx.strokeStyle = palette.rule; ctx.lineWidth = .75; ctx.beginPath(); ctx.moveTo(x + 16, rowY + rowHeight); ctx.lineTo(x + 16 + tableWidth, rowY + rowHeight); ctx.stroke();
        });
        ctx.restore(); ctx.strokeStyle = palette.rule; ctx.lineWidth = 1; ctx.strokeRect(x + 16, cursor, tableWidth, tableHeight);
        cursor += tableHeight + 12; lineIndex = rowIndex; continue;
      }
      const heading = /^(#{1,3})\s+(.*)$/.exec(line); const quote = /^>\s?(.*)$/.exec(line); const bullet = /^\s*([-*+])\s+(.*)$/.exec(line); const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
      const value = heading?.[2] ?? quote?.[1] ?? bullet?.[2] ?? numbered?.[2] ?? line; const size = heading ? fontSize + (4 - heading[1].length) * 2 : fontSize;
      const prefix = bullet ? "• " : numbered ? `${numbered[1]}. ` : quote ? "“ " : ""; const indent = bullet || numbered ? 12 : quote ? 8 : 0;
      const parts = wrap(prefix + value, Math.max(4, maxChars - Math.ceil(indent / (fontSize * .56))));
      for (const part of parts) {
        if (quote) { ctx.strokeStyle = palette.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 12, cursor + 1); ctx.lineTo(x + 12, cursor + size); ctx.stroke(); }
        drawMarkdownInline(part, x + 16 + indent, cursor, size, heading ? 650 : quote ? 400 : 400, quote ? palette.muted : palette.ink); cursor += size * 1.5;
      }
      lineIndex++;
    }
    if (inCode) flushCode();
  }
  ctx.restore(); ctx.restore();
}
export function noteCollapseHit(group: GroupElement, point: { x: number; y: number }): boolean {
  if (!group.note) return false;
  const background = group.elements.find((item): item is ShapeElement => item.type === "rectangle");
  if (!background) return false;
  const x = background.x + background.w - 39; const y = background.y + (group.note.collapsed ? 3 : 8);
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

export type LibraryComponentKind = "uml-class" | "uml-lifeline" | "uml-activation" | "uml-inheritance" | "uml-realization" | "uml-aggregation" | "uml-composition" | "uml-actor" | "uml-use-case" | "uml-package" | "uml-interface" | "sequence-sync" | "sequence-async" | "er-table" | "er-one-many" | "er-many-many" | "c4-system" | "c4-container" | "c4-component" | "tech-service" | "data-flow" | "network-zone" | "bpmn-start" | "bpmn-event" | "bpmn-end" | "bpmn-gateway" | "bpmn-parallel-gateway" | "bpmn-task" | "bpmn-data" | "bpmn-pool" | "network-router" | "network-server" | "network-firewall" | "network-client" | "network-switch" | "network-load-balancer" | "network-access-point" | "viz-bar" | "viz-line" | "viz-area" | "viz-scatter" | "viz-pie" | "viz-donut" | "viz-kpi" | "form-button" | "form-input" | "form-select" | "form-checkbox" | "form-radio" | "form-toggle" | "software-client" | "software-api" | "software-service" | "software-database" | "software-queue" | "software-event-bus" | "software-cache" | "cloud-boundary" | "cloud-function" | "cloud-storage" | "cloud-database" | "cloud-queue";
export const LIBRARY_COMPONENTS: { kind: LibraryComponentKind; section: string; label: string; description: string; width: number; height: number }[] = [
  { kind: "uml-class", section: "UML | Classes & sequence", label: "Class card", description: "Name, attributes, and methods compartments", width: 230, height: 154 },
  { kind: "uml-lifeline", section: "UML | Classes & sequence", label: "Lifeline", description: "Participant header and dashed lifeline", width: 154, height: 250 },
  { kind: "uml-activation", section: "UML | Classes & sequence", label: "Activation bar", description: "Sequence activation marker", width: 28, height: 82 },
  { kind: "sequence-sync", section: "UML | Classes & sequence", label: "Sync message", description: "Solid synchronous message arrow", width: 184, height: 50 },
  { kind: "sequence-async", section: "UML | Classes & sequence", label: "Async message", description: "Open asynchronous message arrow", width: 184, height: 50 },
  { kind: "uml-interface", section: "UML | Classes & sequence", label: "Interface", description: "Interface with operations compartment", width: 190, height: 124 },
  { kind: "uml-inheritance", section: "UML | Relationships", label: "Inheritance", description: "Straight connector with a hollow arrowhead", width: 184, height: 42 },
  { kind: "uml-realization", section: "UML | Relationships", label: "Realization", description: "Straight dashed connector with a hollow arrowhead", width: 184, height: 42 },
  { kind: "uml-aggregation", section: "UML | Relationships", label: "Aggregation", description: "Straight connector with an open diamond endpoint", width: 184, height: 42 },
  { kind: "uml-composition", section: "UML | Relationships", label: "Composition", description: "Straight connector with a filled diamond endpoint", width: 184, height: 42 },
  { kind: "uml-actor", section: "UML | Use cases", label: "Actor", description: "Use case actor symbol", width: 64, height: 106 },
  { kind: "uml-use-case", section: "UML | Use cases", label: "Use case", description: "Use case ellipse with editable label", width: 174, height: 90 },
  { kind: "uml-package", section: "UML | Use cases", label: "Package", description: "Package boundary for grouped model elements", width: 190, height: 132 },
  { kind: "er-table", section: "ER | Entities & relations", label: "Table schema card", description: "Table with key, field, and type rows", width: 220, height: 156 },
  { kind: "er-one-many", section: "ER | Entities & relations", label: "One to many", description: "Straight connector with one and crow's foot endpoints", width: 190, height: 42 },
  { kind: "er-many-many", section: "ER | Entities & relations", label: "Many to many", description: "Straight connector with crow's foot endpoints", width: 190, height: 42 },
  { kind: "c4-system", section: "Software | C4 boundaries", label: "System boundary", description: "C4 system context enclosure", width: 300, height: 190 },
  { kind: "c4-container", section: "Software | C4 boundaries", label: "Container boundary", description: "C4 container enclosure", width: 250, height: 156 },
  { kind: "c4-component", section: "Software | C4 boundaries", label: "Component boundary", description: "C4 component enclosure", width: 210, height: 132 },
  { kind: "software-client", section: "Software | Application components", label: "Web client", description: "Browser client with editable interface panels", width: 176, height: 112 },
  { kind: "software-api", section: "Software | Application components", label: "API endpoint", description: "Service boundary for an HTTP or RPC API", width: 176, height: 88 },
  { kind: "software-service", section: "Software | Application components", label: "Application service", description: "Service node with a clear module badge", width: 176, height: 92 },
  { kind: "software-database", section: "Software | Data components", label: "Database", description: "Editable application database node", width: 152, height: 118 },
  { kind: "software-queue", section: "Software | Messaging & cache", label: "Message queue", description: "Queue with message slots and flow direction", width: 172, height: 88 },
  { kind: "software-event-bus", section: "Software | Messaging & cache", label: "Event bus", description: "Shared event channel with publisher and subscriber ports", width: 196, height: 96 },
  { kind: "software-cache", section: "Software | Messaging & cache", label: "Cache", description: "Fast key-value cache component", width: 156, height: 88 },
  { kind: "tech-service", section: "Software | Application components", label: "Technology service", description: "Service with technology tag and data flow", width: 174, height: 92 },
  { kind: "data-flow", section: "Software | Connectors & boundaries", label: "Data flow", description: "Directional data pipeline arrow", width: 202, height: 46 },
  { kind: "cloud-boundary", section: "Cloud | Deployment", label: "Cloud boundary", description: "Provider-neutral deployment or region enclosure", width: 300, height: 190 },
  { kind: "cloud-function", section: "Cloud | Services", label: "Cloud function", description: "Serverless function service node", width: 152, height: 96 },
  { kind: "cloud-storage", section: "Cloud | Services", label: "Object storage", description: "Provider-neutral object storage component", width: 156, height: 104 },
  { kind: "cloud-database", section: "Cloud | Services", label: "Managed database", description: "Managed relational database component", width: 156, height: 108 },
  { kind: "cloud-queue", section: "Cloud | Services", label: "Cloud queue", description: "Managed asynchronous message queue", width: 156, height: 94 },
  { kind: "network-zone", section: "Network | Devices & zones", label: "Network zone", description: "Infrastructure enclosure with connection points", width: 280, height: 168 },
  { kind: "network-router", section: "Network | Devices", label: "Router", description: "Network router with directional ports", width: 104, height: 86 },
  { kind: "network-switch", section: "Network | Devices", label: "Switch", description: "Ethernet switch with visible ports", width: 132, height: 78 },
  { kind: "network-firewall", section: "Network | Devices", label: "Firewall", description: "Firewall device with segmented face", width: 116, height: 92 },
  { kind: "network-load-balancer", section: "Network | Devices", label: "Load balancer", description: "Traffic distributor with multiple outputs", width: 156, height: 98 },
  { kind: "network-server", section: "Network | Devices", label: "Server", description: "Stacked server node", width: 104, height: 118 },
  { kind: "network-client", section: "Network | Devices", label: "Client device", description: "Desktop client device", width: 118, height: 94 },
  { kind: "network-access-point", section: "Network | Devices", label: "Wireless access point", description: "Access point with radio signal marks", width: 132, height: 98 },
  { kind: "viz-bar", section: "Data visualization | Charts", label: "Bar chart", description: "Compact comparison chart with sample series", width: 260, height: 176 },
  { kind: "viz-line", section: "Data visualization | Charts", label: "Line chart", description: "Trend chart with editable points and axis labels", width: 260, height: 176 },
  { kind: "viz-area", section: "Data visualization | Charts", label: "Area chart", description: "Filled trend bands for comparing totals", width: 260, height: 176 },
  { kind: "viz-scatter", section: "Data visualization | Charts", label: "Scatter plot", description: "Point cloud for comparing two measures", width: 260, height: 176 },
  { kind: "viz-pie", section: "Data visualization | Charts", label: "Pie chart", description: "Category proportions with an editable legend", width: 260, height: 176 },
  { kind: "viz-kpi", section: "Data visualization | Metrics", label: "Metric card", description: "Headline value, trend, and supporting caption", width: 220, height: 126 },
  { kind: "form-button", section: "Forms & UI | Controls", label: "Button", description: "Primary action button", width: 164, height: 54 },
  { kind: "form-input", section: "Forms & UI | Fields", label: "Text field", description: "Labeled text input with placeholder", width: 228, height: 78 },
  { kind: "form-select", section: "Forms & UI | Fields", label: "Select field", description: "Labeled selection field with menu indicator", width: 228, height: 78 },
  { kind: "form-checkbox", section: "Forms & UI | Choices", label: "Checkbox row", description: "Selectable option with supporting label", width: 218, height: 56 },
  { kind: "form-radio", section: "Forms & UI | Choices", label: "Radio group", description: "Single-choice options in a compact group", width: 228, height: 98 },
  { kind: "form-toggle", section: "Forms & UI | Choices", label: "Toggle switch", description: "Settings switch with status text", width: 206, height: 60 },
  { kind: "bpmn-start", section: "BPMN | Events & flow", label: "Start event", description: "BPMN start event", width: 52, height: 52 },
  { kind: "bpmn-event", section: "BPMN | Events & flow", label: "Intermediate event", description: "BPMN intermediate event", width: 52, height: 52 },
  { kind: "bpmn-end", section: "BPMN | Events & flow", label: "End event", description: "BPMN end event", width: 52, height: 52 },
  { kind: "bpmn-gateway", section: "BPMN | Events & flow", label: "Exclusive gateway", description: "BPMN exclusive decision gateway", width: 58, height: 58 },
  { kind: "bpmn-parallel-gateway", section: "BPMN | Events & flow", label: "Parallel gateway", description: "BPMN parallel split or join gateway", width: 58, height: 58 },
  { kind: "bpmn-task", section: "BPMN | Tasks & data", label: "Task", description: "BPMN activity task", width: 168, height: 82 },
  { kind: "bpmn-data", section: "BPMN | Tasks & data", label: "Data object", description: "BPMN document data object", width: 86, height: 112 },
  { kind: "bpmn-pool", section: "BPMN | Tasks & data", label: "Pool / lane", description: "BPMN participant pool with a lane divider", width: 300, height: 156 },
];
const lineElement = (x: number, y: number, w: number, h: number, color = "#74889a", dashed = false): ShapeElement => ({ type: "line", x, y, w, h, color, thickness: 1.4, lineStyle: dashed ? "dashed" : "solid", startHead: "none", endHead: "none" });

export function buildLibraryRelationship(kind: LibraryComponentKind, x: number, y: number): ShapeElement | undefined {
  const width = LIBRARY_COMPONENTS.find(item => item.kind === kind)?.width;
  if (!width) return undefined;
  const relationships: Partial<Record<LibraryComponentKind, { color: string; lineStyle: ShapeElement["lineStyle"]; startHead: ShapeElement["startHead"]; endHead: ShapeElement["endHead"] }>> = {
    "uml-inheritance": { color: "#7563ad", lineStyle: "solid", startHead: "none", endHead: "hollow" },
    "uml-realization": { color: "#7563ad", lineStyle: "dashed", startHead: "none", endHead: "hollow" },
    "uml-aggregation": { color: "#7563ad", lineStyle: "solid", startHead: "open-diamond", endHead: "none" },
    "uml-composition": { color: "#7563ad", lineStyle: "solid", startHead: "diamond", endHead: "none" },
    "er-one-many": { color: "#31877e", lineStyle: "solid", startHead: "bar", endHead: "crow" },
    "er-many-many": { color: "#31877e", lineStyle: "solid", startHead: "crow", endHead: "crow" },
  };
  const style = relationships[kind]; if (!style) return undefined;
  return {
    type: "line", id: crypto.randomUUID(), x, y: y + 21, w: width, h: 0, thickness: 1.8, lineRoute: "straight", straightOnly: true,
    color: style.color, lineStyle: style.lineStyle, startHead: style.startHead, endHead: style.endHead,
  };
}

export type LibraryChartData = { labels: string[]; values: number[]; title?: string; xAxisLabel?: string; yAxisLabel?: string };
export function defaultLibraryFormOptions(kind: LibraryComponentKind): string[] | undefined {
  if (kind === "form-radio") return ["Monthly", "Annual"];
  if (kind === "form-select") return ["Canada", "France", "Japan"];
  if (kind === "form-checkbox") return ["Email updates", "Product news", "Monthly report"];
  if (kind === "form-button") return ["Continue", "Save draft", "Cancel"];
  return undefined;
}
export function defaultLibraryFormTitle(kind: LibraryComponentKind): string | undefined {
  if (kind === "form-checkbox") return "Preferences";
  if (kind === "form-radio") return "Choose a plan";
  if (kind === "form-select") return "Country";
  if (kind === "form-toggle") return "Notifications";
  return undefined;
}

export function defaultLibraryChartData(kind: LibraryComponentKind): LibraryChartData | undefined {
  if (kind === "viz-bar") return { title: "Quarterly sales", xAxisLabel: "Month", yAxisLabel: "Units", labels: ["Jan", "Mar", "May", "Jul", "Sep"], values: [55, 80, 44, 70, 62] };
  if (kind === "viz-line" || kind === "viz-area") return { title: kind === "viz-area" ? "Monthly signups" : "Monthly trend", xAxisLabel: "Month", yAxisLabel: "Users", labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], values: [28, 48, 38, 77, 67, 88] };
  if (kind === "viz-scatter") return { title: "Response time", xAxisLabel: "Request", yAxisLabel: "Milliseconds", labels: ["1", "2", "3", "4", "5", "6", "7", "8", "9"], values: [72, 42, 81, 53, 68, 30, 57, 40, 66] };
  if (kind === "viz-pie" || kind === "viz-donut") return { title: "Device mix", labels: ["Desktop", "Tablet", "Phone"], values: [46, 35, 19] };
  if (kind === "viz-kpi") return { title: "Active users", labels: ["Active users", "Monthly change"], values: [24800, 12.6] };
  return undefined;
}

function buildSupplementalLibraryComponent(kind: LibraryComponentKind, x: number, y: number, chartData?: LibraryChartData, formOptions?: string[], selectedOption = 0, formStates?: boolean[], formTitle?: string): Element[] | undefined {
  const stroke = (x1: number, y1: number, x2: number, y2: number, color: string, thickness = 1.4) => ({ ...lineElement(x1, y1, x2 - x1, y2 - y1, color), thickness });
  const dot = (cx: number, cy: number, radius: number, color: string) => ({ type: "circle" as const, x: cx - radius, y: cy - radius, w: radius * 2, h: radius * 2, color, thickness: 1, fillColor: color });
  if (kind.startsWith("viz-")) {
    const data = chartData ?? defaultLibraryChartData(kind)!;
    const palette = ["#4b78c2", "#40a48f", "#e5a24a", "#9b79cc"];
    if (kind === "viz-donut" || kind === "viz-pie") {
      return [rect(x, y, 260, 176, "#ffffff", "#dde4eb", 8), text(x + 16, y + 13, data.title ?? "CATEGORY MIX", "#34465a", 10, "sans", true)];
    }
    if (kind === "viz-kpi") {
      const amount = Math.abs(data.values[0] ?? 0); const formatted = amount >= 1000 ? `${(amount / 1000).toFixed(amount >= 10000 ? 1 : 0)}k` : `${amount}`; const change = data.values[1] ?? 0;
      return [rect(x, y, 220, 126, "#ffffff", "#dfe6eb", 14), text(x + 16, y + 13, (data.labels[0] ?? "Metric").toUpperCase(), "#6b7b8d", 10, "sans", true), text(x + 16, y + 37, formatted, "#263b55", 30, "sans", true), stroke(x + 17, y + 87, x + 77, y + 74, "#40a48f", 2.5), stroke(x + 77, y + 74, x + 117, y + 79, "#40a48f", 2.5), stroke(x + 117, y + 79, x + 166, y + 56, "#40a48f", 2.5), text(x + 16, y + 101, `${change >= 0 ? "+" : ""}${change}% ${data.labels[1] ?? "change"}`, "#2d8a70", 10, "sans", true)];
    }
    const elements: Element[] = [rect(x, y, 260, 176, "#ffffff", "#dfe6eb", 14), text(x + 16, y + 12, kind === "viz-bar" ? "QUARTERLY SALES" : kind === "viz-scatter" ? "RESPONSE TIME" : "MONTHLY TREND", "#34465a", 10, "sans", true)];
    const left = x + 40; const right = x + 244; const top = y + 43; const bottom = y + 142;
    for (let row = 0; row < 4; row++) elements.push(stroke(left, top + row * 30, right, top + row * 30, "#e9eef2", .8));
    elements.push(stroke(left, bottom, right, bottom, "#9daab6", 1.2), stroke(left, top, left, bottom, "#9daab6", 1.2));
    if (kind === "viz-bar") {
      const values = data.values.slice(0, 8); const min = Math.min(0, ...values); const max = Math.max(1, ...values); const baseline = bottom - (0 - min) / (max - min) * 92; const slot = (right - left) / Math.max(1, values.length);
      values.forEach((value, index) => { const height = Math.max(2, Math.abs(value / (max - min) * 92)); const leftX = left + slot * index + slot * .22; elements.push(rect(leftX, value >= 0 ? baseline - height : baseline, slot * .56, height, palette[index % palette.length], palette[index % palette.length], 3)); elements.push(text(leftX - 2, bottom + 7, (data.labels[index] ?? `${index + 1}`).slice(0, 5), "#778697", 8)); });
    } else if (kind === "viz-scatter") {
      const values = data.values.slice(0, 12); const min = Math.min(...values); const span = Math.max(1, Math.max(...values) - min);
      values.forEach((value, index) => { const dx = 10 + index * (184 / Math.max(1, values.length - 1)); const dy = 16 + (value - min) / span * 72; elements.push(dot(left + dx, bottom - dy, index % 3 === 0 ? 4.2 : 3.2, palette[index % palette.length])); });
    } else {
      const values = data.values.slice(0, 12); const min = Math.min(0, ...values); const max = Math.max(1, ...values); const span = Math.max(1, max - min);
      const samples = values.map((value, index) => [left + 6 + index * ((right - left - 12) / Math.max(1, values.length - 1)), bottom - 8 - ((value - min) / span) * 78]);
      for (let index = 1; index < samples.length; index++) elements.push(stroke(samples[index - 1][0], samples[index - 1][1], samples[index][0], samples[index][1], kind === "viz-area" ? "#40a48f" : "#4b78c2", 2.6));
      samples.forEach(([sx, sy], index) => { elements.push(dot(sx, sy, 3.7, index % 2 ? "#40a48f" : "#4b78c2")); if (values.length <= 8) elements.push(text(sx - 7, bottom + 7, (data.labels[index] ?? `${index + 1}`).slice(0, 5), "#778697", 8)); });
      if (kind === "viz-area") samples.slice(0, -1).forEach(([sx], index) => elements.push(rect(sx, bottom - 4, Math.max(2, (samples[index + 1][0] - sx) - 2), 4, index % 2 ? "#d7eee7" : "#e4f1ed", "#d7eee7", 1)));
    }
    return elements;
  }
  if (kind.startsWith("form-")) {
    const ink = "#40546a"; const muted = "#7b8998"; const edge = "#ced8e2"; const blue = "#4d78b8";
    if (kind === "form-button") return [rect(x, y, 164, 54, "#4d78b8", "#426ba7", 11), { ...text(x + 82, y + 17, formOptions?.[selectedOption] ?? "Continue", "#ffffff", 14, "sans", true), componentRole: "form-button-caption" }];
    if (kind === "form-input" || kind === "form-select") return [
      { ...text(x + 2, y + 2, kind === "form-input" ? "Email address" : formTitle ?? defaultLibraryFormTitle(kind) ?? "Country", ink, 11, "sans", true), ...(kind === "form-select" ? { componentRole: "form-select-title" } : {}) },
      rect(x, y + 22, 228, 45, "#ffffff", edge, 9),
      { ...text(x + 13, y + 37, kind === "form-input" ? "name@example.com" : (formOptions?.[selectedOption] ?? "Choose a country"), muted, 12), ...(kind === "form-select" ? { componentRole: "form-select-value" } : {}) },
      ...(kind === "form-select" ? [stroke(x + 202, y + 40, x + 207, y + 45, muted, 1.6), stroke(x + 207, y + 45, x + 212, y + 40, muted, 1.6)] : []),
    ];
    if (kind === "form-checkbox") {
      const options = (formOptions?.length ? formOptions : defaultLibraryFormOptions(kind)!).slice(0, 12); const rowHeight = 27;
      const items: Element[] = [rect(x, y, 218, 33 + options.length * rowHeight, "#ffffff", "#e1e7ed", 7), { ...text(x + 13, y + 9, formTitle ?? defaultLibraryFormTitle(kind) ?? "Preferences", ink, 11, "sans", true), componentRole: "form-checkbox-title" }];
      options.forEach((label, index) => {
        const yy = y + 27 + index * rowHeight; const checked = formStates?.[index] ?? index === 0;
        items.push({ ...rect(x + 13, yy + 3, 18, 18, checked ? "#edf4ff" : "#ffffff", blue, 4), componentRole: `form-checkbox-box-${index}` });
        items.push({ ...stroke(x + 17, yy + 12, x + 21, yy + 16, blue, 1.8), opacity: checked ? 1 : 0, componentRole: `form-checkbox-check-a-${index}` });
        items.push({ ...stroke(x + 21, yy + 16, x + 28, yy + 7, blue, 1.8), opacity: checked ? 1 : 0, componentRole: `form-checkbox-check-b-${index}` });
        items.push({ ...text(x + 41, yy + 4, label, ink, 11), componentRole: `form-checkbox-label-${index}` });
      });
      return items;
    }
    if (kind === "form-radio") {
      const options = (formOptions?.length ? formOptions : defaultLibraryFormOptions(kind)!).slice(0, 12);
      const items: Element[] = [rect(x, y, 228, 42 + options.length * 26, "#ffffff", "#e1e7ed", 10), { ...text(x + 14, y + 12, formTitle ?? defaultLibraryFormTitle(kind) ?? "Choose a plan", ink, 11, "sans", true), componentRole: "form-radio-title" }];
      options.forEach((label, index) => { const yy = y + 37 + index * 26; items.push({ type: "circle", x: x + 15, y: yy, w: 16, h: 16, color: index === selectedOption ? blue : edge, thickness: 1.5, fillColor: "#ffffff", componentRole: `form-radio-option-${index}` }); if (index === selectedOption) items.push({ ...dot(x + 23, yy + 8, 4, blue), componentRole: `form-radio-dot-${index}` }); items.push({ ...text(x + 41, yy + 2, label, ink, 10), componentRole: `form-radio-label-${index}` }); });
      return items;
    }
    if (kind === "form-toggle") return [rect(x, y, 206, 60, "#ffffff", "#e1e7ed", 10), { ...text(x + 14, y + 20, formTitle ?? defaultLibraryFormTitle(kind) ?? "Notifications", ink, 11, "sans", true), componentRole: "form-toggle-title" }, rect(x + 148, y + 16, 43, 26, "#dcece5", "#c7dfd4", 13), dot(x + 178, y + 29, 9, "#44a17f"), { ...text(x + 14, y + 39, "Enabled", "#628071", 9), componentRole: "form-toggle-state" }];
  }
  if (kind === "data-flow") return [
    { type: "arrow", x, y: y + 28, w: 202, h: 0, color: "#476c88", thickness: 2, lineRoute: "straight", startHead: "none", endHead: "solid" },
    text(x + 3, y + 3, "DATA FLOW", "#315a7a", 9, "sans", true),
    text(x + 82, y + 7, "source → transform → target", "#71859a", 8, "mono"),
  ];
  if (kind.startsWith("software-")) {
    const ink = "#315a7a"; const muted = "#71859a"; const edge = "#7297b4"; const pale = "#edf5fb"; const dark = "#284b68";
    if (kind === "software-client") return [rect(x, y, 176, 112, "#ffffff", edge, 12), rect(x, y, 176, 22, pale, edge, 12), dot(x + 13, y + 11, 2, "#e88970"), dot(x + 21, y + 11, 2, "#e6bd55"), dot(x + 29, y + 11, 2, "#65ad8b"), rect(x + 11, y + 33, 58, 66, "#eff5fb", "#d9e4ed", 7), rect(x + 78, y + 33, 86, 17, "#eff5fb", "#e3eaf0", 5), rect(x + 78, y + 57, 86, 42, "#f7f9fb", "#e3eaf0", 5), text(x + 11, y + 24, "BROWSER CLIENT", ink, 8, "sans", true)];
    if (kind === "software-api") return [rect(x, y, 176, 88, pale, edge, 13), rect(x + 14, y + 13, 39, 24, "#d8e8f5", "#bfd5e6", 7), text(x + 33, y + 18, "API", dark, 11, "mono", true), text(x + 64, y + 16, "HTTP / RPC", ink, 10, "sans", true), text(x + 15, y + 51, "GET  /v1/items", "#71859a", 9, "mono"), stroke(x + 144, y + 44, x + 160, y + 44, edge, 1.5), stroke(x + 152, y + 37, x + 160, y + 44, edge, 1.5), stroke(x + 152, y + 51, x + 160, y + 44, edge, 1.5)];
    if (kind === "software-service") return [rect(x, y, 176, 92, pale, edge, 13), rect(x + 14, y + 14, 34, 34, "#d9e9f5", "#bfd5e6", 10), text(x + 31, y + 20, "S", dark, 18, "sans", true), text(x + 59, y + 15, "SERVICE", ink, 9, "sans", true), text(x + 59, y + 31, "module / worker", muted, 9), stroke(x + 15, y + 65, x + 161, y + 65, "#d2e0e9", 1), text(x + 15, y + 73, "health  ·  ready", "#4c8b71", 9)];
    if (kind === "software-database") return [{ type: "flowchart", x: x + 16, y: y + 8, w: 120, h: 94, color: edge, thickness: 1.7, fillColor: pale, flowchartShape: "database" }, text(x + 42, y + 47, "SQL", dark, 12, "mono", true), text(x + 28, y + 106, "DATABASE", ink, 9, "sans", true)];
    if (kind === "software-queue") return [rect(x, y, 172, 88, pale, edge, 13), text(x + 14, y + 11, "QUEUE", ink, 9, "sans", true), ...[0,1,2].map(index => rect(x + 15 + index * 36, y + 35, 27, 27, "#ffffff", "#b9cfdf", 6)), stroke(x + 15, y + 72, x + 153, y + 72, edge, 1.5), stroke(x + 145, y + 66, x + 153, y + 72, edge, 1.5), stroke(x + 145, y + 78, x + 153, y + 72, edge, 1.5)];
    if (kind === "software-event-bus") return [rect(x, y + 31, 196, 38, "#e9f2f8", edge, 11), text(x + 98, y + 43, "EVENT BUS", dark, 11, "sans", true), stroke(x + 28, y + 16, x + 28, y + 31, edge), stroke(x + 98, y + 16, x + 98, y + 31, edge), stroke(x + 168, y + 16, x + 168, y + 31, edge), stroke(x + 28, y + 69, x + 28, y + 84, edge), stroke(x + 98, y + 69, x + 98, y + 84, edge), stroke(x + 168, y + 69, x + 168, y + 84, edge), dot(x + 28, y + 14, 4, "#4d91a9"), dot(x + 98, y + 14, 4, "#4d91a9"), dot(x + 168, y + 14, 4, "#4d91a9"), dot(x + 28, y + 86, 4, "#72a58a"), dot(x + 98, y + 86, 4, "#72a58a"), dot(x + 168, y + 86, 4, "#72a58a")];
    if (kind === "software-cache") return [rect(x, y, 156, 88, "#edf8f2", "#79a38a", 13), rect(x + 12, y + 14, 37, 37, "#d8eee2", "#a7c8b3", 10), text(x + 30, y + 18, "K", "#3b7858", 18, "mono", true), text(x + 60, y + 17, "CACHE", "#3b7858", 9, "sans", true), text(x + 60, y + 34, "key / value", "#668675", 9), stroke(x + 14, y + 67, x + 142, y + 67, "#bad5c4", 1)];
  }
  if (kind.startsWith("cloud-")) {
    const ink = "#93643d"; const edge = "#bd9262"; const pale = "#fbf4e9";
    if (kind === "cloud-boundary") return [{ ...rect(x, y, 300, 190, "#fbf4e9", edge, 14), fillOpacity: .52, lineStyle: "dashed", label: { text: "", color: ink, fontSize: 13, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "top" } }, text(x + 15, y + 13, "CLOUD REGION", ink, 10, "sans", true), stroke(x + 18, y + 44, x + 48, y + 44, "#cfaa7c", 1), stroke(x + 48, y + 44, x + 48, y + 68, "#cfaa7c", 1)];
    if (kind === "cloud-database") return [rect(x, y, 156, 108, pale, edge, 9), text(x + 12, y + 9, "MANAGED DATABASE", ink, 9, "sans", true), { type: "flowchart", x: x + 47, y: y + 28, w: 62, h: 52, color: edge, thickness: 1.6, fillColor: "#ffffff", flowchartShape: "database" }, text(x + 12, y + 88, "SQL · BACKUP · REPLICAS", ink, 8, "mono")];
    if (kind === "cloud-queue") return [rect(x, y, 156, 94, pale, edge, 9), text(x + 13, y + 9, "CLOUD QUEUE", ink, 9, "sans", true), ...[0, 1, 2].map(index => rect(x + 14 + index * 34, y + 31, 26, 25, "#ffffff", "#c7a57f", 4)), stroke(x + 14, y + 72, x + 142, y + 72, edge, 1.3), stroke(x + 134, y + 66, x + 142, y + 72, edge, 1.3), stroke(x + 134, y + 78, x + 142, y + 72, edge, 1.3), text(x + 13, y + 81, "MESSAGES · RETRIES", ink, 8, "mono")];
    if (kind === "cloud-function") return [rect(x, y, 152, 96, pale, edge, 13), rect(x + 14, y + 14, 39, 39, "#f5e4ca", "#dec49c", 10), text(x + 33, y + 19, "ƒ", ink, 21, "serif", true), text(x + 61, y + 20, "FUNCTION", ink, 9, "sans", true), text(x + 61, y + 37, "on demand", "#a58360", 9), text(x + 15, y + 69, "event  →  compute", "#8c7155", 9, "mono")];
    if (kind === "cloud-storage") return [rect(x, y, 156, 104, pale, edge, 13), rect(x + 14, y + 18, 54, 52, "#f5e4ca", "#dec49c", 9), stroke(x + 20, y + 34, x + 61, y + 34, "#c49762", 2), stroke(x + 20, y + 45, x + 61, y + 45, "#c49762", 2), stroke(x + 20, y + 56, x + 61, y + 56, "#c49762", 2), text(x + 77, y + 27, "OBJECT", ink, 9, "sans", true), text(x + 77, y + 43, "STORAGE", ink, 9, "sans", true), text(x + 14, y + 82, "bucket  ·  blobs  ·  files", "#8c7155", 8, "mono")];
  }
  if (kind.startsWith("network-")) {
    const ink = "#287a84"; const edge = "#5da3a9"; const pale = "#eaf7f7";
    if (kind === "network-switch") return [rect(x, y, 132, 62, pale, edge, 10), text(x + 12, y + 10, "SWITCH", ink, 9, "sans", true), ...[0,1,2,3,4,5].map(index => rect(x + 13 + index * 17, y + 31, 11, 14, "#ffffff", "#7fb4b8", 3)), ...[0,1,2,3,4,5].map(index => dot(x + 18 + index * 17, y + 52, 1.5, "#56a585") )];
    if (kind === "network-load-balancer") return [rect(x, y, 156, 54, pale, edge, 12), text(x + 78, y + 10, "LOAD BALANCER", ink, 9, "sans", true), stroke(x + 78, y + 22, x + 78, y + 35, edge), stroke(x + 31, y + 35, x + 125, y + 35, edge), stroke(x + 31, y + 35, x + 31, y + 49, edge), stroke(x + 78, y + 35, x + 78, y + 49, edge), stroke(x + 125, y + 35, x + 125, y + 49, edge), dot(x + 78, y + 20, 5, "#4c95a0"), dot(x + 31, y + 53, 3, "#56a585"), dot(x + 78, y + 53, 3, "#56a585"), dot(x + 125, y + 53, 3, "#56a585")];
    if (kind === "network-access-point") return [rect(x + 18, y + 47, 96, 35, pale, edge, 10), text(x + 66, y + 57, "ACCESS POINT", ink, 8, "sans", true), stroke(x + 66, y + 47, x + 66, y + 38, edge, 1.8), stroke(x + 45, y + 33, x + 87, y + 33, edge, 1.8), stroke(x + 52, y + 26, x + 80, y + 26, edge, 1.8), stroke(x + 59, y + 19, x + 73, y + 19, edge, 1.8), dot(x + 66, y + 15, 2.5, edge)];
  }
  return undefined;
}

export function buildLibraryComponent(kind: LibraryComponentKind, x: number, y: number, options?: { chartData?: LibraryChartData; formOptions?: string[]; selectedOption?: number; formStates?: boolean[]; formTitle?: string }): GroupElement {
  const elements: Element[] = [];
  const titled = (color: string, fontSize = 12) => ({ text: "", color, fontSize, fontFamily: "sans" as const, bold: true, italic: false, underline: false, textAlign: "center" as const, listType: "none" as const, verticalAlign: "middle" as const });
  const supplemental = buildSupplementalLibraryComponent(kind, x, y, options?.chartData, options?.formOptions, options?.selectedOption, options?.formStates, options?.formTitle);
  if (supplemental) elements.push(...supplemental);
  else if (kind === "uml-actor") {
    const color = "#7563ad";
    elements.push({ type: "circle", x: x + 22, y: y + 2, w: 20, h: 20, color, thickness: 1.8, fillColor: "#f6f2ff" });
    elements.push(lineElement(x + 32, y + 22, 0, 42, color), lineElement(x + 13, y + 39, 38, 0, color), lineElement(x + 32, y + 64, -18, 28, color), lineElement(x + 32, y + 64, 18, 28, color));
  } else if (kind === "uml-use-case") {
    elements.push({ type: "circle", x, y, w: 174, h: 90, color: "#7563ad", thickness: 1.7, fillColor: "#f6f2ff", label: titled("#59488c") });
  } else if (kind === "uml-package") {
    elements.push({ type: "flowchart", x, y, w: 190, h: 132, color: "#7563ad", thickness: 1.6, fillColor: "#f6f2ff", flowchartShape: "folder", label: titled("#59488c") });
  } else if (kind === "uml-interface") {
    elements.push(rect(x, y, 190, 124, "#f6f2ff", "#7563ad", 8));
    elements.push(text(x + 12, y + 8, "<<interface>>", "#7563ad", 10, "sans", true), text(x + 12, y + 29, "", "#59488c", 13, "sans", true));
    elements.push(lineElement(x, y + 52, 190, 0, "#9c8bc9"), text(x + 12, y + 65, "", "#59488c", 12, "mono"));
  } else if (kind === "bpmn-start" || kind === "bpmn-event" || kind === "bpmn-end") {
    const end = kind === "bpmn-end"; const event = kind === "bpmn-event"; const color = "#b58436";
    elements.push({ type: "circle", x, y, w: 52, h: 52, color, thickness: end ? 3 : 1.5, fillColor: "#fff8e9" });
    if (event) elements.push({ type: "circle", x: x + 5, y: y + 5, w: 42, h: 42, color, thickness: 1.2, fillColor: "#fff8e9" });
  } else if (kind === "bpmn-gateway" || kind === "bpmn-parallel-gateway") {
    const color = "#b58436";
    elements.push({ type: "diamond", x, y, w: 58, h: 58, color, thickness: 1.6, fillColor: "#fff8e9" });
    if (kind === "bpmn-parallel-gateway") elements.push(lineElement(x + 29, y + 16, 0, 26, color), lineElement(x + 16, y + 29, 26, 0, color));
    else { elements.push(lineElement(x + 20, y + 20, 18, 18, color), lineElement(x + 38, y + 20, -18, 18, color)); }
  } else if (kind === "bpmn-task") {
    elements.push({ ...rect(x, y, 168, 82, "#fff8e9", "#b58436", 12), label: titled("#78551d") });
  } else if (kind === "bpmn-data") {
    elements.push({ type: "flowchart", x, y, w: 86, h: 112, color: "#b58436", thickness: 1.5, fillColor: "#fff8e9", flowchartShape: "document", label: titled("#78551d") });
  } else if (kind === "bpmn-pool") {
    elements.push(rect(x, y, 300, 156, "#fff8e9", "#b58436", 4), rect(x, y, 34, 156, "#f5e7c8", "#b58436", 4));
    elements.push(lineElement(x + 34, y, 0, 156, "#b58436"), text(x + 7, y + 73, "", "#78551d", 11, "sans", true));
  } else if (kind === "network-router") {
    const color = "#318391";
    elements.push({ type: "flowchart", x, y, w: 104, h: 70, color, thickness: 1.6, fillColor: "#eaf7f8", flowchartShape: "hexagon", label: titled("#246570") });
    elements.push(lineElement(x + 24, y + 74, 0, 10, color), lineElement(x + 52, y + 74, 0, 10, color), lineElement(x + 80, y + 74, 0, 10, color));
  } else if (kind === "network-server") {
    const color = "#318391";
    for (let row = 0; row < 3; row++) { const top = y + row * 37; elements.push(rect(x + 5, top + 3, 94, 31, "#eaf7f8", color, 5), { type: "circle", x: x + 13, y: top + 13, w: 7, h: 7, color, thickness: 1, fillColor: "#69b5a8" }, lineElement(x + 28, top + 18, 54, 0, color)); }
  } else if (kind === "network-firewall") {
    const color = "#318391";
    elements.push(rect(x, y, 116, 92, "#eaf7f8", color, 6));
    elements.push(lineElement(x + 3, y + 31, 110, 0, color), lineElement(x + 3, y + 61, 110, 0, color), lineElement(x + 29, y + 3, 0, 28, color), lineElement(x + 87, y + 3, 0, 28, color), lineElement(x + 58, y + 32, 0, 28, color), lineElement(x + 29, y + 62, 0, 27, color), lineElement(x + 87, y + 62, 0, 27, color));
  } else if (kind === "network-client") {
    const color = "#318391";
    elements.push({ type: "flowchart", x: x + 5, y, w: 108, h: 72, color, thickness: 1.6, fillColor: "#eaf7f8", flowchartShape: "display", label: titled("#246570") });
    elements.push(lineElement(x + 35, y + 78, 48, 0, color));
  } else if (kind === "uml-class") {
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
  } else if (kind === "tech-service") {
    elements.push({ ...rect(x, y, 174, 92, "#edf5f0", "#759785", 11), label: { text: "", color: "#4c6a59", fontSize: 12, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } });
    const pipe: ShapeElement = { type: "arrow", x: x + 5, y: y + 24, w: 192, h: 0, color: "#2d83a4", thickness: 4, lineStyle: "dashed", startHead: "none", endHead: "solid", label: { text: "", color: "#367991", fontSize: 10, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" } }; elements.push(pipe);
  } else if (kind === "network-zone") {
    elements.push({ ...rect(x, y, 280, 168, "#daf0f1", "#68a2a3", 13), fillOpacity: .42, lineStyle: "dashed", label: { text: "", color: "#3d7477", fontSize: 12, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "top" } });
  }
  const defaultLabel = LIBRARY_COMPONENTS.find(item => item.kind === kind)?.label ?? kind;
  elements.forEach(element => { if ((element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "triangle" || element.type === "flowchart" || element.type === "line" || element.type === "arrow") && element.label && !element.label.text.trim()) element.label = { ...element.label, text: defaultLabel }; });
  const palette = kind.startsWith("uml-") || kind.startsWith("sequence-")
    ? { fill: "#f6f2ff", header: "#e9e3f7", edge: "#7563ad", ink: "#59488c" }
    : kind.startsWith("er-")
      ? { fill: "#eff9f6", header: "#dcefe9", edge: "#31877e", ink: "#28675f" }
      : kind.startsWith("bpmn-")
        ? { fill: "#fff8e9", header: "#f5e7c8", edge: "#b58436", ink: "#78551d" }
        : kind.startsWith("network-")
          ? { fill: "#eaf7f8", header: "#d9eff0", edge: "#318391", ink: "#246570" }
          : kind.startsWith("cloud-")
            ? { fill: "#fbf4e9", header: "#f3e4cf", edge: "#bd9262", ink: "#93643d" }
            : kind.startsWith("form-")
              ? { fill: "#f5f8fc", header: "#e5edf6", edge: "#6c86a7", ink: "#40546a" }
              : { fill: "#eef5fa", header: "#dfeaf2", edge: "#527d9b", ink: "#3d6384" };
  if (!kind.startsWith("viz-") && !kind.startsWith("form-") && !kind.startsWith("software-") && !kind.startsWith("cloud-") && kind !== "network-switch" && kind !== "network-load-balancer" && kind !== "network-access-point") elements.forEach((element, index) => {
    if (element.type === "text") element.color = palette.ink;
    else if (element.type === "freehand") element.color = palette.edge;
    else if (element.type !== "image" && element.type !== "schemaTable" && element.type !== "group") {
      element.color = palette.edge;
      if ("fillColor" in element && element.fillColor) element.fillColor = kind === "uml-aggregation" && element.type === "diamond" ? "#ffffff" : kind === "network-server" && element.type === "circle" ? "#69b5a8" : index === 1 && ["uml-class", "er-table", "bpmn-pool"].includes(kind) ? palette.header : palette.fill;
      if (element.label) element.label = { ...element.label, color: palette.ink };
    }
  });
  return { type: "group", elements };
}
