import type { Element, FlowchartShape, GroupElement, LibraryChartData, LibraryChartKind, NoteKind, ShapeElement, TextElement, Theme } from "./model";
export type { LibraryChartData } from "./model";
import { CLOUD_PROVIDER_COMPONENTS, cloudProviderComponent, type CloudProviderComponentKind } from "./features/diagrams/cloud-providers";

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
  let top = 58;
  return content.split(/\r?\n/).filter(line => line.trim()).map((line, index) => {
    const match = /^\s*(?:[-*]|\d+\.)\s+\[([ xX])\]\s*(.*)$/.exec(line);
    const indent = Math.min(6, Math.floor((line.match(/^\s*/)?.[0].replace(/\t/g, "  ").length ?? 0) / 2)) * 14;
    const lineHeight = Math.max(15, fontSize * 1.32);
    const boxX = 16 + indent; const textX = boxX + 23;
    const max = Math.max(6, Math.floor((width - textX - 16) / (fontSize * .54)));
    let rest = match?.[2] || "Untitled task"; const labelLines: string[] = [];
    while (rest.length > max) { const breakAt = rest.lastIndexOf(" ", max); const count = breakAt > 0 ? breakAt : max; labelLines.push(rest.slice(0, count)); rest = rest.slice(count).trimStart(); }
    labelLines.push(rest);
    const height = Math.max(24, labelLines.length * lineHeight + 4);
    const row = { index, top, height, lineHeight, boxX, textX, done: match?.[1].toLowerCase() === "x", labelLines };
    top += height + 2; return row;
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
  const fontSize = Math.round(Math.max(8, Math.min(32, dimensions.fontSize ?? 12)));
  const collapsed = dimensions.collapsed === true;
  const title = (dimensions.title ?? defaultNoteTitle(kind)).trim().slice(0, 120) || defaultNoteTitle(kind);
  const palette = noteCardPalette(kind, "light");
  const lines = content.split(/\r?\n/);
  let estimated = 58;
  if (kind === "checklist") {
    const rows = checklistRows(content, width, fontSize); const last = rows[rows.length - 1]; estimated = last ? last.top + last.height + 12 : 84;
  } else {
    const maxChars = Math.max(8, Math.floor((width - 38) / (fontSize * .56)));
    let inCode = false; let codeCount = 0;
    for (let lineIndex = 0; lineIndex < lines.length;) {
      const line = lines[lineIndex];
      if (/^\s*```/.test(line)) { if (inCode) { estimated += Math.max(48, codeCount * fontSize * 1.55 + 28) + 10; codeCount = 0; } inCode = !inCode; lineIndex++; continue; }
      if (inCode) { codeCount++; lineIndex++; continue; }
      if (lineIndex + 1 < lines.length && isMarkdownTableDivider(lines[lineIndex + 1])) {
        let rowIndex = lineIndex + 2; let rowCount = 1;
        while (rowIndex < lines.length && lines[rowIndex].includes("|")) { rowCount++; rowIndex++; }
        estimated += rowCount * Math.max(24, fontSize * 1.7) + 12; lineIndex = rowIndex; continue;
      }
      estimated += line.trim() ? Math.ceil(line.length / maxChars) * fontSize * 1.5 : 9;
      lineIndex++;
    }
    if (inCode) estimated += Math.max(48, codeCount * fontSize * 1.55 + 28);
    estimated += 12;
  }
  const fullHeight = dimensions.height === undefined ? Math.max(estimated, 84) : Math.max(84, Math.min(1_000_000, dimensions.height));
  const visibleHeight = collapsed ? 42 : fullHeight;
  const background: ShapeElement = { type: "rectangle", x, y, w: width, h: visibleHeight, color: palette.border, thickness: 1, fillColor: palette.surface, fillOpacity: 1, edgeStyle: "rounded", cornerRadius: 3 };
  return { type: "group", note: { kind, content, title, width, height: fullHeight, fontSize, collapsed }, elements: [background] };
}

/** Render a whole note card in one pass instead of adding a canvas element for every line or token. */
export function drawNoteCard(ctx: CanvasRenderingContext2D, group: GroupElement, theme: Theme, appearance: "modern" | "simple" = "modern") {
  const meta = group.note; const background = group.elements.find((item): item is ShapeElement => item.type === "rectangle");
  if (!meta || !background) return;
  const { x, y } = background; const width = Math.abs(background.w); const height = Math.abs(background.h);
  const palette = noteCardPalette(meta.kind, theme, appearance); const fontSize = Math.round(Math.max(8, Math.min(48, meta.fontSize ?? 12)));
  ctx.save(); ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x, y, width, height, 3); ctx.fillStyle = palette.surface; ctx.fill(); ctx.strokeStyle = palette.border; ctx.stroke();
  if (appearance !== "simple") { ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, width, height, 9); ctx.clip(); ctx.fillStyle = palette.accent; ctx.fillRect(x, y + 1, 3, Math.max(0, height - 2)); ctx.restore(); }
  const collapsed = meta.collapsed === true; const title = (meta.title || defaultNoteTitle(meta.kind)).slice(0, 120);
  ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.font = "600 11px system-ui, sans-serif"; ctx.fillStyle = palette.ink; ctx.fillText(title, x + 10, y + 9, Math.max(40, width - 52));
  const toggleX = x + width - 26; const toggleY = y + 7;
  ctx.beginPath(); ctx.roundRect(toggleX, toggleY, 18, 18, 2); ctx.fillStyle = palette.surface; ctx.fill(); ctx.strokeStyle = palette.border; ctx.stroke();
  ctx.strokeStyle = palette.muted; ctx.lineWidth = 1.3; ctx.beginPath();
  if (collapsed) { ctx.moveTo(toggleX + 5, toggleY + 7); ctx.lineTo(toggleX + 9, toggleY + 11); ctx.lineTo(toggleX + 13, toggleY + 7); }
  else { ctx.moveTo(toggleX + 5, toggleY + 11); ctx.lineTo(toggleX + 9, toggleY + 7); ctx.lineTo(toggleX + 13, toggleY + 11); }
  ctx.stroke();
  if (collapsed) {
    const rows = meta.kind === "checklist" ? checklistRows(meta.content, width, fontSize) : undefined;
    const completed = rows?.filter(row => row.done).length ?? 0;
    const summary = rows ? completed + " of " + rows.length + " tasks" : (meta.content.split(/\r?\n/).find(line => line.trim() && !/^\s*```/.test(line)) ?? "Empty card").trim();
    ctx.font = "400 9px system-ui, sans-serif"; ctx.fillStyle = palette.muted; ctx.fillText(summary, x + 10, y + 25, Math.max(40, width - 48));
  }
  if (!collapsed) { ctx.strokeStyle = palette.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 10, y + 33); ctx.lineTo(x + width - 10, y + 33); ctx.stroke(); }
  if (collapsed || height <= 38) { ctx.restore(); return; }
  ctx.save(); ctx.beginPath(); ctx.rect(x + 8, y + 37, width - 16, height - 45); ctx.clip();
  const drawText = (value: string, px: number, py: number, size = fontSize, color = palette.ink, weight = 400, family = "system-ui, sans-serif") => { ctx.font = `${weight} ${size}px ${family}`; ctx.fillStyle = color; ctx.textAlign = "left"; ctx.fillText(value, px, py, Math.max(1, x + width - 14 - px)); };
  const wrap = (value: string, max: number) => { const chunks: string[] = []; let remaining = value; while (remaining.length > max) { let cut = remaining.lastIndexOf(" ", max); if (cut < 1) cut = max; chunks.push(remaining.slice(0, cut)); remaining = remaining.slice(cut).trimStart(); } chunks.push(remaining); return chunks; };
  if (meta.kind === "checklist") {
    const rows = checklistRows(meta.content, width, fontSize); const completed = rows.filter(row => row.done).length;
    drawText(`${completed} of ${rows.length} complete`, x + 16, y + 40, 9, palette.muted, 500);
    ctx.fillStyle = palette.rule; ctx.fillRect(x + 16, y + 53, width - 32, 2);
    ctx.fillStyle = palette.check; ctx.fillRect(x + 16, y + 53, rows.length ? (width - 32) * completed / rows.length : 0, 2);
    for (const row of rows) {
      const boxX = x + row.boxX; const textX = x + row.textX; const textTop = y + row.top + (row.height - row.labelLines.length * row.lineHeight) / 2;
      const checkboxY = y + row.top + Math.max(0, (row.height - 14) / 2);
      ctx.beginPath(); ctx.roundRect(boxX, checkboxY, 14, 14, 1); ctx.fillStyle = row.done ? palette.check : palette.surface; ctx.fill(); ctx.strokeStyle = row.done ? palette.check : palette.border; ctx.stroke();
      if (row.done) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(boxX + 3, checkboxY + 7); ctx.lineTo(boxX + 6, checkboxY + 10); ctx.lineTo(boxX + 11, checkboxY + 4); ctx.stroke(); }
      row.labelLines.forEach((line, lineIndex) => {
        const baseline = textTop + lineIndex * row.lineHeight; drawText(line, textX, baseline, fontSize, row.done ? palette.muted : palette.ink);
        if (row.done) { const measured = ctx.measureText(line).width; ctx.strokeStyle = palette.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(textX, baseline + fontSize * .7); ctx.lineTo(textX + measured, baseline + fontSize * .7); ctx.stroke(); }
      });
    }
  } else {
    let cursor = y + 41; let inCode = false; let language = "text"; let codeLines: string[] = [];
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
  const x = background.x + background.w - 29; const y = background.y + 4;
  return point.x >= x && point.x <= x + 24 && point.y >= y && point.y <= y + 24;
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
  for (const row of checklistRows(group.note.content, Math.abs(background.w), group.note.fontSize ?? 12)) {
    const x = background.x + row.boxX; const y = background.y + row.top + Math.max(0, (row.height - 14) / 2);
    if (point.x >= x - 4 && point.x <= x + 22 && point.y >= y - 4 && point.y <= y + 18) return row.index;
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

export type LibraryComponentKind = "diagram-frame" | "diagram-swimlane" | "uml-class" | "uml-lifeline" | "uml-activation" | "uml-inheritance" | "uml-realization" | "uml-aggregation" | "uml-composition" | "uml-actor" | "uml-use-case" | "uml-package" | "uml-interface" | "sequence-sync" | "sequence-async" | "er-table" | "er-one-many" | "er-many-many" | "c4-system" | "c4-container" | "c4-component" | "tech-service" | "data-flow" | "diagram-legend" | "network-zone" | "bpmn-start" | "bpmn-event" | "bpmn-end" | "bpmn-boundary-event" | "bpmn-gateway" | "bpmn-parallel-gateway" | "bpmn-inclusive-gateway" | "bpmn-event-gateway" | "bpmn-task" | "bpmn-subprocess" | "bpmn-data" | "bpmn-pool" | "network-router" | "network-server" | "network-firewall" | "network-client" | "network-switch" | "network-hub" | "network-load-balancer" | "network-access-point" | "network-internet" | "network-vpn" | "network-dns" | "network-nat-gateway" | "network-modem" | LibraryChartKind | "form-button" | "form-input" | "form-select" | "form-checkbox" | "form-radio" | "form-toggle" | "software-client" | "software-api" | "software-service" | "software-database" | "software-queue" | "software-event-bus" | "software-cache" | "cloud-boundary" | "cloud-function" | "cloud-storage" | "cloud-database" | "cloud-queue" | CloudProviderComponentKind;
export const LIBRARY_COMPONENTS: { kind: LibraryComponentKind; section: string; label: string; description: string; width: number; height: number }[] = [
  { kind: "diagram-frame", section: "General | Layout", label: "Frame", description: "Resizable titled boundary for any diagram", width: 420, height: 280 },
  { kind: "diagram-swimlane", section: "General | Layout", label: "Swimlane", description: "Resizable lanes for organizing responsibilities or stages", width: 520, height: 320 },
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
  { kind: "diagram-legend", section: "Annotations & aids", label: "Legend", description: "Editable key for diagram colors and object types", width: 210, height: 120 },
  { kind: "cloud-boundary", section: "Cloud | Deployment", label: "Cloud boundary", description: "Provider-neutral deployment or region enclosure", width: 300, height: 190 },
  { kind: "cloud-function", section: "Cloud | Services", label: "Cloud function", description: "Serverless function service node", width: 152, height: 96 },
  { kind: "cloud-storage", section: "Cloud | Services", label: "Object storage", description: "Provider-neutral object storage component", width: 156, height: 104 },
  { kind: "cloud-database", section: "Cloud | Services", label: "Managed database", description: "Managed relational database component", width: 156, height: 108 },
  { kind: "cloud-queue", section: "Cloud | Services", label: "Cloud queue", description: "Managed asynchronous message queue", width: 156, height: 94 },
  ...CLOUD_PROVIDER_COMPONENTS.map(component => ({ kind: component.kind, section: `Cloud | ${component.provider}`, label: component.label, description: component.description, width: 176, height: 108 })),
  { kind: "network-zone", section: "Network | Devices & zones", label: "Network zone", description: "Infrastructure enclosure with connection points", width: 280, height: 168 },
  { kind: "network-router", section: "Network | Devices", label: "Router", description: "Network router with directional ports", width: 104, height: 86 },
  { kind: "network-switch", section: "Network | Devices", label: "Switch", description: "Ethernet switch with visible ports", width: 132, height: 78 },
  { kind: "network-hub", section: "Network | Devices", label: "Hub", description: "Central network hub with configurable connection ports", width: 144, height: 94 },
  { kind: "network-firewall", section: "Network | Devices", label: "Firewall", description: "Firewall device with segmented face", width: 116, height: 92 },
  { kind: "network-load-balancer", section: "Network | Devices", label: "Load balancer", description: "Traffic distributor with multiple outputs", width: 156, height: 98 },
  { kind: "network-server", section: "Network | Devices", label: "Server", description: "Stacked server node", width: 104, height: 118 },
  { kind: "network-client", section: "Network | Devices", label: "Client device", description: "Desktop client device", width: 118, height: 94 },
  { kind: "network-access-point", section: "Network | Devices", label: "Wireless access point", description: "Ceiling mounted access point puck with radio and status lights", width: 132, height: 98 },
  { kind: "viz-bar", section: "Data visualization | Charts", label: "Bar chart", description: "Compact comparison chart with sample series", width: 260, height: 176 },
  { kind: "viz-horizontal-bar", section: "Data visualization | Charts", label: "Horizontal bar chart", description: "Rank categories with long labels", width: 260, height: 176 },
  { kind: "viz-stacked-bar", section: "Data visualization | Charts", label: "Stacked bar chart", description: "Compare totals and their component series", width: 280, height: 190 },
  { kind: "viz-line", section: "Data visualization | Charts", label: "Line chart", description: "Trend chart with editable points and axis labels", width: 260, height: 176 },
  { kind: "viz-area", section: "Data visualization | Charts", label: "Area chart", description: "Filled trend bands for comparing totals", width: 260, height: 176 },
  { kind: "viz-scatter", section: "Data visualization | Charts", label: "Scatter plot", description: "Point cloud for comparing two measures", width: 260, height: 176 },
  { kind: "viz-pie", section: "Data visualization | Charts", label: "Pie chart", description: "Category proportions with an editable legend", width: 260, height: 176 },
  { kind: "viz-donut", section: "Data visualization | Charts", label: "Doughnut chart", description: "Category proportions with a central total", width: 260, height: 176 },
  { kind: "viz-radar", section: "Data visualization | Charts", label: "Radar chart", description: "Compare several profiles across shared measures", width: 280, height: 210 },
  { kind: "viz-gauge", section: "Data visualization | Charts", label: "Gauge chart", description: "Show progress against a chosen maximum", width: 220, height: 170 },
  { kind: "viz-funnel", section: "Data visualization | Charts", label: "Funnel chart", description: "Show stage values through a process", width: 260, height: 190 },
  { kind: "viz-heatmap", section: "Data visualization | Charts", label: "Heatmap", description: "Compare values across rows and categories", width: 300, height: 210 },
  { kind: "viz-treemap", section: "Data visualization | Charts", label: "Treemap", description: "Compare hierarchical category sizes", width: 280, height: 190 },
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
  { kind: "bpmn-boundary-event", section: "BPMN | Events & flow", label: "Boundary event", description: "Event marker to place on a task boundary", width: 62, height: 66 },
  { kind: "bpmn-gateway", section: "BPMN | Events & flow", label: "Exclusive gateway", description: "BPMN exclusive decision gateway", width: 58, height: 58 },
  { kind: "bpmn-parallel-gateway", section: "BPMN | Events & flow", label: "Parallel gateway", description: "BPMN parallel split or join gateway", width: 58, height: 58 },
  { kind: "bpmn-inclusive-gateway", section: "BPMN | Events & flow", label: "Inclusive gateway", description: "BPMN gateway for one or more selected paths", width: 58, height: 58 },
  { kind: "bpmn-event-gateway", section: "BPMN | Events & flow", label: "Event gateway", description: "BPMN event-based routing gateway", width: 58, height: 58 },
  { kind: "bpmn-task", section: "BPMN | Tasks & data", label: "Task", description: "BPMN activity task", width: 168, height: 82 },
  { kind: "bpmn-subprocess", section: "BPMN | Tasks & data", label: "Subprocess", description: "Collapsed BPMN subprocess with expand marker", width: 168, height: 90 },
  { kind: "bpmn-data", section: "BPMN | Tasks & data", label: "Data object", description: "BPMN document data object", width: 86, height: 112 },
  { kind: "bpmn-pool", section: "BPMN | Tasks & data", label: "Pool / lane", description: "BPMN participant pool with a lane divider", width: 300, height: 156 },
  { kind: "network-internet", section: "Network | Devices", label: "Internet", description: "External internet or public network cloud", width: 128, height: 92 },
  { kind: "network-vpn", section: "Network | Devices", label: "VPN tunnel", description: "Encrypted site-to-site or client VPN path", width: 164, height: 88 },
  { kind: "network-dns", section: "Network | Devices", label: "DNS server", description: "Name resolution service node", width: 120, height: 100 },
  { kind: "network-nat-gateway", section: "Network | Devices", label: "NAT gateway", description: "Address translation between private and public networks", width: 156, height: 100 },
  { kind: "network-modem", section: "Network | Devices", label: "Modem", description: "Network access modem with status and radio marks", width: 120, height: 88 },
];
const lineElement = (x: number, y: number, w: number, h: number, color = "#74889a", dashed = false): ShapeElement => ({ type: "line", x, y, w, h, color, thickness: 1.4, lineStyle: dashed ? "dashed" : "solid", startHead: "none", endHead: "none" });

export function buildLibraryRelationship(kind: LibraryComponentKind, x: number, y: number): ShapeElement | undefined {
  const width = LIBRARY_COMPONENTS.find(item => item.kind === kind)?.width;
  const height = LIBRARY_COMPONENTS.find(item => item.kind === kind)?.height;
  if (!width || !height) return undefined;
  const relationships: Partial<Record<LibraryComponentKind, { color: string; lineStyle: ShapeElement["lineStyle"]; startHead: ShapeElement["startHead"]; endHead: ShapeElement["endHead"] }>> = {
    "uml-inheritance": { color: "#7563ad", lineStyle: "solid", startHead: "none", endHead: "hollow" },
    "uml-realization": { color: "#7563ad", lineStyle: "dashed", startHead: "none", endHead: "hollow" },
    "uml-aggregation": { color: "#7563ad", lineStyle: "solid", startHead: "open-diamond", endHead: "none" },
    "uml-composition": { color: "#7563ad", lineStyle: "solid", startHead: "diamond", endHead: "none" },
    "er-one-many": { color: "#31877e", lineStyle: "solid", startHead: "bar", endHead: "crow" },
    "er-many-many": { color: "#31877e", lineStyle: "solid", startHead: "crow", endHead: "crow" },
    "sequence-sync": { color: "#7563ad", lineStyle: "solid", startHead: "none", endHead: "solid" },
    "sequence-async": { color: "#7563ad", lineStyle: "solid", startHead: "none", endHead: "open" },
    "data-flow": { color: "#333333", lineStyle: "solid", startHead: "none", endHead: "solid" },
  };
  const style = relationships[kind]; if (!style) return undefined;
  const line: ShapeElement = {
    type: "line", id: crypto.randomUUID(), x, y: y + height / 2, w: width, h: 0, thickness: 1.8, lineRoute: "straight", straightOnly: true,
    color: style.color, lineStyle: style.lineStyle, startHead: style.startHead, endHead: style.endHead,
  };
  if (kind === "sequence-sync" || kind === "sequence-async") line.label = { text: kind === "sequence-sync" ? "Sync message" : "Async message", color: style.color, fontSize: 12, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" };
  if (kind === "data-flow") line.label = { text: "DATA FLOW", color: "#333333", fontSize: 12, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "top" };
  return line;
}

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
  if (kind === "viz-bar" || kind === "viz-horizontal-bar") return { title: kind === "viz-horizontal-bar" ? "Top services" : "Quarterly sales", xAxisLabel: kind === "viz-horizontal-bar" ? "Requests" : "Month", yAxisLabel: kind === "viz-horizontal-bar" ? "Service" : "Units", labels: kind === "viz-horizontal-bar" ? ["API gateway", "Database", "Worker", "Cache"] : ["Jan", "Mar", "May", "Jul", "Sep"], values: kind === "viz-horizontal-bar" ? [92, 78, 54, 38] : [55, 80, 44, 70, 62] };
  if (kind === "viz-stacked-bar") return { title: "Usage by region", xAxisLabel: "Month", yAxisLabel: "Units", labels: ["Jan", "Feb", "Mar", "Apr"], values: [42, 56, 48, 65], series: [{ name: "North", values: [42, 56, 48, 65] }, { name: "Central", values: [30, 36, 42, 39] }, { name: "South", values: [18, 24, 31, 35] }], options: { legend: "bottom", showGrid: true, showValues: false } };
  if (kind === "viz-line" || kind === "viz-area") return { title: kind === "viz-area" ? "Monthly signups" : "Monthly trend", xAxisLabel: "Month", yAxisLabel: "Users", labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], values: [28, 48, 38, 77, 67, 88] };
  if (kind === "viz-scatter") return { title: "Response time", xAxisLabel: "Request", yAxisLabel: "Milliseconds", labels: ["1", "2", "3", "4", "5", "6", "7", "8", "9"], values: [72, 42, 81, 53, 68, 30, 57, 40, 66] };
  if (kind === "viz-pie" || kind === "viz-donut") return { title: "Device mix", labels: ["Desktop", "Tablet", "Phone"], values: [46, 35, 19] };
  if (kind === "viz-radar") return { title: "Service profile", labels: ["Latency", "Reliability", "Cost", "Security", "Scale"], values: [72, 84, 65, 91, 76], series: [{ name: "Current", values: [72, 84, 65, 91, 76] }, { name: "Target", values: [82, 90, 74, 95, 88] }], options: { legend: "bottom", showGrid: true } };
  if (kind === "viz-gauge") return { title: "Capacity used", labels: ["Used"], values: [72], options: { maxValue: 100, showValues: true } };
  if (kind === "viz-funnel") return { title: "Request conversion", labels: ["Visits", "Qualified", "Trial", "Active"], values: [960, 620, 310, 184], options: { legend: "hidden", showValues: true } };
  if (kind === "viz-heatmap") return { title: "Weekly activity", xAxisLabel: "Day", yAxisLabel: "Team", labels: ["Mon", "Tue", "Wed", "Thu", "Fri"], values: [2, 5, 3, 6, 4], series: [{ name: "Platform", values: [2, 5, 3, 6, 4] }, { name: "Product", values: [4, 3, 7, 5, 6] }, { name: "Data", values: [1, 2, 4, 3, 5] }], options: { legend: "hidden", showValues: false, palette: "ocean" } };
  if (kind === "viz-treemap") return { title: "Resource share", labels: ["Compute", "Storage", "Database", "Network", "Other"], values: [34, 22, 19, 14, 11], options: { legend: "hidden", showValues: true } };
  if (kind === "viz-kpi") return { title: "Active users", labels: ["Active users", "Monthly change"], values: [24800, 12.6] };
  return undefined;
}

function buildSupplementalLibraryComponent(kind: LibraryComponentKind, x: number, y: number, formOptions?: string[], selectedOption = 0, formStates?: boolean[], formTitle?: string, formState = true): Element[] | undefined {
  const stroke = (x1: number, y1: number, x2: number, y2: number, color: string, thickness = 1.4) => ({ ...lineElement(x1, y1, x2 - x1, y2 - y1, color), thickness });
  const dot = (cx: number, cy: number, radius: number, color: string) => ({ type: "circle" as const, x: cx - radius, y: cy - radius, w: radius * 2, h: radius * 2, color, thickness: 1, fillColor: color });
  const wrapFormText = (value: string, width: number, fontSize: number, maxLines = 1) => {
    const maxCharacters = Math.max(1, Math.floor(width / (fontSize * .58)));
    const lines: string[] = []; let line = "";
    for (const word of value.trim().replace(/\s+/g, " ").split(" ").filter(Boolean)) {
      if (line && `${line} ${word}`.length <= maxCharacters) { line += ` ${word}`; continue; }
      if (line) { lines.push(line); line = ""; }
      let remaining = word;
      while (remaining.length > maxCharacters) { lines.push(remaining.slice(0, maxCharacters)); remaining = remaining.slice(maxCharacters); }
      line = remaining;
    }
    if (line || !lines.length) lines.push(line);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      const last = lines.length - 1;
      lines[last] = `${lines[last].slice(0, Math.max(0, maxCharacters - 1)).trimEnd()}…`;
    }
    return lines.join("\n");
  };
  if (kind.startsWith("form-")) {
    const ink = "#40546a"; const muted = "#7b8998"; const edge = "#ced8e2"; const blue = "#4d78b8";
    if (kind === "form-button") {
      const fontSize = 14; const caption = wrapFormText(formOptions?.[selectedOption] ?? "Continue", 140, fontSize, 2); const lineCount = caption.split("\n").length;
      return [rect(x, y, 164, 54, "#4d78b8", "#426ba7", 11), { ...text(x + 82, y + (54 - lineCount * fontSize * 1.25) / 2, caption, "#ffffff", fontSize, "sans", true), textAlign: "center", componentRole: "form-button-caption" }];
    }
    if (kind === "form-input" || kind === "form-select") return [
      { ...text(x + 2, y + 2, wrapFormText(kind === "form-input" ? "Email address" : formTitle ?? defaultLibraryFormTitle(kind) ?? "Country", 224, 11), ink, 11, "sans", true), ...(kind === "form-select" ? { componentRole: "form-select-title" } : {}) },
      rect(x, y + 22, 228, 45, "#ffffff", edge, 9),
      { ...text(x + 13, y + 37, wrapFormText(kind === "form-input" ? "name@example.com" : (formOptions?.[selectedOption] ?? "Choose a country"), 174, 12), muted, 12), ...(kind === "form-select" ? { componentRole: "form-select-value" } : {}) },
      ...(kind === "form-select" ? [stroke(x + 202, y + 40, x + 207, y + 45, muted, 1.6), stroke(x + 207, y + 45, x + 212, y + 40, muted, 1.6)] : []),
    ];
    if (kind === "form-checkbox") {
      const options = (formOptions?.length ? formOptions : defaultLibraryFormOptions(kind)!).slice(0, 12);
      const rows = options.map(label => { const wrapped = wrapFormText(label, 165, 11, 3); const lineCount = wrapped.split("\n").length; return { wrapped, lineCount, height: Math.max(27, lineCount * 11 * 1.25 + 8) }; });
      const items: Element[] = [rect(x, y, 218, 33 + rows.reduce((sum, row) => sum + row.height, 0), "#ffffff", "#e1e7ed", 7), { ...text(x + 13, y + 9, wrapFormText(formTitle ?? defaultLibraryFormTitle(kind) ?? "Preferences", 192, 11), ink, 11, "sans", true), componentRole: "form-checkbox-title" }];
      let rowY = y + 27;
      rows.forEach(({ wrapped, lineCount, height }, index) => {
        const centerY = rowY + height / 2; const checked = formStates?.[index] ?? index === 0;
        items.push({ ...rect(x + 13, centerY - 9, 18, 18, checked ? "#edf4ff" : "#ffffff", blue, 4), componentRole: `form-checkbox-box-${index}` });
        items.push({ ...stroke(x + 17, centerY, x + 21, centerY + 4, blue, 1.8), opacity: checked ? 1 : 0, componentRole: `form-checkbox-check-a-${index}` });
        items.push({ ...stroke(x + 21, centerY + 4, x + 28, centerY - 5, blue, 1.8), opacity: checked ? 1 : 0, componentRole: `form-checkbox-check-b-${index}` });
        items.push({ ...text(x + 41, rowY + (height - lineCount * 11 * 1.25) / 2, wrapped, ink, 11), componentRole: `form-checkbox-label-${index}` });
        rowY += height;
      });
      return items;
    }
    if (kind === "form-radio") {
      const options = (formOptions?.length ? formOptions : defaultLibraryFormOptions(kind)!).slice(0, 12);
      const rows = options.map(label => { const wrapped = wrapFormText(label, 175, 10, 3); const lineCount = wrapped.split("\n").length; return { wrapped, lineCount, height: Math.max(26, lineCount * 10 * 1.25 + 8) }; });
      const items: Element[] = [rect(x, y, 228, 42 + rows.reduce((sum, row) => sum + row.height, 0), "#ffffff", "#e1e7ed", 10), { ...text(x + 14, y + 12, wrapFormText(formTitle ?? defaultLibraryFormTitle(kind) ?? "Choose a plan", 200, 11), ink, 11, "sans", true), componentRole: "form-radio-title" }];
      let rowY = y + 37;
      rows.forEach(({ wrapped, lineCount, height }, index) => {
        const centerY = rowY + height / 2;
        items.push({ type: "circle", x: x + 15, y: centerY - 8, w: 16, h: 16, color: index === selectedOption ? blue : edge, thickness: 1.5, fillColor: "#ffffff", componentRole: `form-radio-option-${index}` });
        if (index === selectedOption) items.push({ ...dot(x + 23, centerY, 4, blue), componentRole: `form-radio-dot-${index}` });
        items.push({ ...text(x + 41, rowY + (height - lineCount * 10 * 1.25) / 2, wrapped, ink, 10), componentRole: `form-radio-label-${index}` });
        rowY += height;
      });
      return items;
    }
    if (kind === "form-toggle") return [rect(x, y, 206, 60, "#ffffff", "#e1e7ed", 10), { ...text(x + 14, y + 20, wrapFormText(formTitle ?? defaultLibraryFormTitle(kind) ?? "Notifications", 120, 11), ink, 11, "sans", true), componentRole: "form-toggle-title" }, rect(x + 148, y + 16, 43, 26, formState ? "#dcece5" : "#e6e9ed", formState ? "#c7dfd4" : "#cbd1d8", 13), { ...dot(x + (formState ? 178 : 160), y + 29, 9, formState ? "#44a17f" : "#8b949e"), componentRole: "form-toggle-knob" }, { ...text(x + 14, y + 39, formState ? "Enabled" : "Disabled", formState ? "#628071" : "#7b838d", 9), componentRole: "form-toggle-state" }];
  }
  return undefined;
}

const usesCleanModelRenderer = (kind: LibraryComponentKind) => kind.startsWith("diagram-") || kind.startsWith("software-") || kind.startsWith("c4-") || kind.startsWith("bpmn-") || kind.startsWith("network-") && kind !== "network-access-point" || kind.startsWith("cloud-") || !!cloudProviderComponent(kind) || kind === "tech-service" || kind === "data-flow";

export function buildLibraryComponent(kind: LibraryComponentKind, x: number, y: number, options?: { chartData?: LibraryChartData; formOptions?: string[]; selectedOption?: number; formStates?: boolean[]; formTitle?: string; formState?: boolean; portCount?: number }): GroupElement {
  if (kind.startsWith("viz-")) {
    const definition = LIBRARY_COMPONENTS.find(item => item.kind === kind)!;
    return { type: "group", id: crypto.randomUUID(), elements: [], componentBounds: { x, y, w: definition.width, h: definition.height }, libraryComponent: { kind, label: definition.label, chartData: options?.chartData ?? defaultLibraryChartData(kind) } };
  }
  // The legacy wireless access point renderer already supports component bounds;
  // keep its familiar symbol while making the whole device a connection target.
  if (kind === "network-access-point") {
    const definition = LIBRARY_COMPONENTS.find(item => item.kind === kind)!;
    return { type: "group", id: crypto.randomUUID(), elements: [], componentBounds: { x, y, w: definition.width, h: definition.height }, libraryComponent: { kind, label: definition.label } };
  }
  if (usesCleanModelRenderer(kind)) {
    const definition = LIBRARY_COMPONENTS.find(item => item.kind === kind)!;
    return {
      type: "group", id: crypto.randomUUID(), elements: [],
      componentBounds: { x, y, w: definition.width, h: definition.height },
      libraryComponent: { kind, label: definition.label, renderStyle: "clean", ...(kind === "diagram-swimlane" ? { laneCount: 3 } : {}), ...(kind === "network-hub" ? { portCount: options?.portCount ?? 8 } : kind === "network-switch" ? { portCount: options?.portCount ?? 6 } : {}) },
    };
  }
  const elements: Element[] = [];
  const titled = (color: string, fontSize = 12) => ({ text: "", color, fontSize, fontFamily: "sans" as const, bold: true, italic: false, underline: false, textAlign: "center" as const, listType: "none" as const, verticalAlign: "middle" as const });
  const supplemental = buildSupplementalLibraryComponent(kind, x, y, options?.formOptions, options?.selectedOption, options?.formStates, options?.formTitle, options?.formState);
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
  } else if (kind === "uml-class") {
    elements.push(rect(x, y, 230, 154, "#f8fbff", "#7e94ad", 9), rect(x, y, 230, 36, "#e8f0fb", "#7e94ad", 9));
    elements.push(lineElement(x, y + 36, 230, 0), lineElement(x, y + 92, 230, 0));
    elements.push(text(x + 12, y + 9, "", "#345371", 14, "sans", true));
    elements.push(text(x + 12, y + 48, "", "#334453", 12, "mono"));
    elements.push(text(x + 12, y + 105, "", "#334453", 12, "mono"));
  } else if (kind === "uml-lifeline") {
    elements.push({ ...rect(x + 12, y, 130, 42, "#edf4ff", "#7e94ad", 8), label: { text: "", color: "#345371", fontSize: 12, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } });
    elements.push({ ...lineElement(x + 77, y + 42, 0, 200, "#8497a8", true), componentRole: "lifeline-line" });
  } else if (kind === "uml-activation") {
    elements.push(rect(x + 5, y, 18, 82, "#d7e6f8", "#6887a6", 3));
  } else if (kind.startsWith("uml-") && ["uml-inheritance", "uml-realization", "uml-aggregation", "uml-composition"].includes(kind)) {
    const dashed = kind === "uml-realization"; const relation = lineElement(x + 24, y + 21, 148, 0, "#657b91", dashed); relation.endHead = kind === "uml-inheritance" || dashed ? "open" : "none"; elements.push(relation);
    if (kind === "uml-aggregation" || kind === "uml-composition") elements.push({ type: "diamond", x: x + 9, y: y + 15, w: 12, h: 12, color: "#657b91", thickness: 1.4, fillColor: kind === "uml-composition" ? "#657b91" : "#ffffff" });
  } else if (kind === "sequence-sync" || kind === "sequence-async") {
    const message = lineElement(x + 5, y + 25, 174, 0, "#617a92"); message.endHead = kind === "sequence-async" ? "open" : "solid"; message.label = { text: "", color: "#617a92", fontSize: 12, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" }; elements.push(message);
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
  }
  const defaultLabel = LIBRARY_COMPONENTS.find(item => item.kind === kind)?.label ?? kind;
  elements.forEach(element => { if ((element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "triangle" || element.type === "flowchart" || element.type === "line" || element.type === "arrow") && element.label && !element.label.text.trim()) element.label = { ...element.label, text: defaultLabel }; });
  const palette = kind.startsWith("uml-") || kind.startsWith("sequence-")
    ? { fill: "#f6f2ff", header: "#e9e3f7", edge: "#7563ad", ink: "#59488c" }
    : kind.startsWith("er-")
      ? { fill: "#eff9f6", header: "#dcefe9", edge: "#31877e", ink: "#28675f" }
      : { fill: "#eef5fa", header: "#dfeaf2", edge: "#527d9b", ink: "#3d6384" };
  if (!kind.startsWith("form-")) elements.forEach((element, index) => {
    if (element.type === "text") element.color = palette.ink;
    else if (element.type === "freehand") element.color = palette.edge;
    else if (element.type !== "image" && element.type !== "schemaTable" && element.type !== "group") {
      element.color = palette.edge;
      if ("fillColor" in element && element.fillColor) element.fillColor = kind === "uml-aggregation" && element.type === "diamond" ? "#ffffff" : index === 1 && ["uml-class", "er-table"].includes(kind) ? palette.header : palette.fill;
      if (element.label) element.label = { ...element.label, color: palette.ink };
    }
  });
  return { type: "group", elements };
}
