import type { GroupElement, NoteKind, ShapeElement, Theme } from "./model";
import { standaloneMarkdownTableRows } from "./app/markdown-table";
export type { LibraryChartData } from "./model";

export type NoteInlineRun = { text: string; bold: boolean; italic: boolean; underline: boolean; highlight: boolean; strike: boolean; code: boolean };

export function noteInlineRuns(value: string): NoteInlineRun[] {
  const pattern = /(<u>[^<]+<\/u>|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|==[^=]+==|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;
  const runs: NoteInlineRun[] = [];
  let cursor = 0;
  const plain = (text: string) => { if (text) runs.push({ text, bold: false, italic: false, underline: false, highlight: false, strike: false, code: false }); };
  for (const match of value.matchAll(pattern)) {
    const token = match[0]; const start = match.index ?? 0;
    plain(value.slice(cursor, start));
    const underline = token.startsWith("<u>");
    const bold = token.startsWith("**") || token.startsWith("__");
    const strike = token.startsWith("~~");
    const highlight = token.startsWith("==");
    const code = token.startsWith("`");
    const trim = underline ? 3 : bold || strike || highlight ? 2 : 1;
    runs.push({ text: token.slice(trim, -trim), bold, italic: !underline && !bold && !strike && !highlight && !code, underline, highlight, strike, code });
    cursor = start + token.length;
  }
  plain(value.slice(cursor));
  return runs;
}

export function wrapNoteMarkup(value: string, maxWidth: number, measure: (text: string, run: NoteInlineRun) => number): string[] {
  const lines = [""];
  let lineWidth = 0;
  const encode = (run: NoteInlineRun, text: string) => run.code ? `\`${text}\``
    : run.underline ? `<u>${text}</u>`
    : run.highlight ? `==${text}==`
    : run.strike ? `~~${text}~~`
    : run.bold ? `**${text}**`
    : run.italic ? `*${text}*` : text;
  const append = (run: NoteInlineRun, text: string) => { lines[lines.length - 1] += encode(run, text); lineWidth += measure(text, run); };
  for (const run of noteInlineRuns(value)) {
    const chunks = run.text.match(/[^\s]+\s*|\s+/gu) ?? [];
    for (const chunk of chunks) {
      const width = measure(chunk, run);
      if (!/^\s+$/u.test(chunk) && lineWidth > 0 && lineWidth + width > maxWidth) { lines.push(""); lineWidth = 0; }
      if (width <= maxWidth || /^\s+$/u.test(chunk)) { append(run, chunk); continue; }
      for (const character of Array.from(chunk)) {
        const characterWidth = measure(character, run);
        if (lineWidth > 0 && lineWidth + characterWidth > maxWidth) { lines.push(""); lineWidth = 0; }
        append(run, character);
      }
    }
  }
  return lines;
}

function checklistTitle(line: string): string | undefined {
  return /^\s*\*\*(.+)\*\*\s*$/.exec(line)?.[1]?.trim();
}

export type ChecklistRow = {
  kind: "title" | "task";
  index?: number;
  top: number;
  height: number;
  lineHeight: number;
  boxX: number;
  textX: number;
  done: boolean;
  labelLines: string[];
};

export const normalizeNoteContent = (content: string, kind: NoteKind) => {
  const hasContent = content.trim();
  if (kind !== "checklist") return content;
  return (hasContent ? content.split(/\r?\n/) : [""]).map(line => {
    if (!line.trim()) return "";
    const indent = /^\s*/.exec(line)?.[0].replace(/\t/g, "  ") ?? "";
    if (checklistTitle(line) !== undefined) return line;
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
  ? { surface: theme === "dark" ? kind === "sticky" ? "#30291e" : "#202428" : kind === "sticky" ? "#fffaf0" : "#ffffff", border: theme === "dark" ? "#58636b" : kind === "sticky" ? "#ddd4bd" : "#cbd5df", accent: theme === "dark" ? "#b7c2cb" : "#65758a", ink: theme === "dark" ? "#f0f0f0" : "#263445", muted: theme === "dark" ? "#b4bec8" : "#677588", rule: theme === "dark" ? "#49525a" : "#dfe5eb", soft: theme === "dark" ? "#2d3339" : "#f4f6f8", check: theme === "dark" ? "#84bc98" : "#4d8965" }
  : NOTE_CARD_PALETTES[theme][kind];

export function markdownCells(line: string): string[] {
  let source = line.trim();
  if (source.startsWith("|")) source = source.slice(1);
  if (source.endsWith("|")) source = source.slice(0, -1);
  return source.split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, "|"));
}
export function isMarkdownTableDivider(line: string): boolean {
  const cells = markdownCells(line);
  return cells.length > 1 && cells.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

export function checklistRows(content: string, width: number, fontSize: number, measureText?: (text: string, run: NoteInlineRun, size: number, forceBold: boolean) => number) {
  let top = 32;
  let taskIndex = 0;
  return content.split(/\r?\n/).filter(line => line.trim()).map(line => {
    const title = checklistTitle(line);
    const match = /^\s*(?:[-*]|\d+\.)\s+\[([ xX])\]\s*(.*)$/.exec(line);
    const indent = Math.min(6, Math.floor((line.match(/^\s*/)?.[0].replace(/\t/g, "  ").length ?? 0) / 2)) * 14;
    const titleSize = fontSize * 1.12;
    const lineHeight = Math.max(14, (title ? titleSize : fontSize) * 1.25);
    const boxX = title ? 11 : 11 + indent; const textX = title ? 11 : boxX + 21;
    const textSize = title ? titleSize : fontSize;
    const maxWidth = Math.max(12, width - textX - 8);
    const rest = title ?? match?.[2] ?? line.trim();
    const labelLines = wrapNoteMarkup(rest, maxWidth, (text, run) => measureText?.(text, run, textSize, title !== undefined) ?? Array.from(text).length * textSize * (run.code ? .6 : run.bold || title ? .52 : .5));
    const height = Math.max(22, labelLines.length * lineHeight + 3);
    const row: ChecklistRow = { kind: title === undefined ? "task" : "title", ...(title === undefined ? { index: taskIndex++ } : {}), top, height, lineHeight, boxX, textX, done: match?.[1].toLowerCase() === "x", labelLines };
    top += height + 2; return row;
  });
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
  const tableRows = kind === "note" ? standaloneMarkdownTableRows(content) : undefined;
  let estimated = 32;
  if (tableRows) estimated = tableRows.length * Math.max(22, fontSize * 1.8);
  else if (kind === "checklist") {
    const rows = checklistRows(content, width, fontSize); const last = rows[rows.length - 1]; estimated = last ? last.top + last.height + 6 : 34;
  } else {
    const maxChars = Math.max(8, Math.floor((width - 38) / (fontSize * .56)));
    let inCode = false; let codeCount = 0;
    for (let lineIndex = 0; lineIndex < lines.length;) {
      const line = lines[lineIndex];
      if (/^\s*```/.test(line)) { if (inCode) { estimated += Math.max(32, codeCount * fontSize * 1.55 + 20) + 5; codeCount = 0; } inCode = !inCode; lineIndex++; continue; }
      if (inCode) { codeCount++; lineIndex++; continue; }
      if (lineIndex + 1 < lines.length && isMarkdownTableDivider(lines[lineIndex + 1])) {
        let rowIndex = lineIndex + 2; let rowCount = 1;
        while (rowIndex < lines.length && lines[rowIndex].includes("|")) { rowCount++; rowIndex++; }
        estimated += rowCount * Math.max(20, fontSize * 1.5) + 5; lineIndex = rowIndex; continue;
      }
      estimated += line.trim() ? Math.ceil(line.length / maxChars) * fontSize * 1.5 : 0;
      lineIndex++;
    }
    if (inCode) estimated += Math.max(32, codeCount * fontSize * 1.55 + 20);
    estimated += 6;
  }
  const fullHeight = dimensions.height === undefined ? Math.max(34, estimated) : Math.max(34, Math.min(1_000_000, dimensions.height));
  const visibleHeight = collapsed && !tableRows ? 32 : fullHeight;
  const background: ShapeElement = { type: "rectangle", x, y, w: width, h: visibleHeight, color: palette.border, thickness: 1, fillColor: palette.surface, fillOpacity: 1, edgeStyle: "rounded", cornerRadius: 3 };
  return { type: "group", note: { kind, content, title, width, height: fullHeight, fontSize, collapsed: tableRows ? false : collapsed }, elements: [background] };
}

/** Render a whole note card in one pass instead of adding a canvas element for every line or token. */
export function drawNoteCard(ctx: CanvasRenderingContext2D, group: GroupElement, theme: Theme, appearance: "modern" | "simple" = "modern") {
  const meta = group.note; const background = group.elements.find((item): item is ShapeElement => item.type === "rectangle");
  if (!meta || !background) return;
  const { x, y } = background; const width = Math.abs(background.w); const height = Math.abs(background.h);
  const palette = noteCardPalette(meta.kind, theme, appearance); const fontSize = Math.round(Math.max(8, Math.min(48, meta.fontSize ?? 12)));
  const standaloneTable = meta.kind === "note" ? standaloneMarkdownTableRows(meta.content) : undefined;
  if (standaloneTable) {
    const columns = standaloneTable[0].length; const cellWidth = width / columns; const rowHeight = height / standaloneTable.length;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip();
    ctx.fillStyle = palette.soft; ctx.fillRect(x, y, width, rowHeight);
    ctx.strokeStyle = palette.border; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, Math.max(0, width - 1), Math.max(0, height - 1));
    ctx.strokeStyle = palette.rule; ctx.lineWidth = .75;
    for (let column = 1; column < columns; column++) { const lineX = x + column * cellWidth; ctx.beginPath(); ctx.moveTo(lineX, y); ctx.lineTo(lineX, y + height); ctx.stroke(); }
    for (let row = 1; row < standaloneTable.length; row++) { const lineY = y + row * rowHeight; ctx.beginPath(); ctx.moveTo(x, lineY); ctx.lineTo(x + width, lineY); ctx.stroke(); }
    ctx.textBaseline = "middle"; ctx.textAlign = "left";
    standaloneTable.forEach((row, rowIndex) => row.forEach((cell, column) => { ctx.font = `${rowIndex === 0 ? 600 : 400} ${Math.min(fontSize, Math.max(8, rowHeight - 6))}px system-ui, sans-serif`; ctx.fillStyle = palette.ink; ctx.fillText(cell, x + column * cellWidth + 6, y + (rowIndex + .5) * rowHeight, Math.max(1, cellWidth - 12)); }));
    ctx.restore(); return;
  }
  ctx.save(); ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x, y, width, height, 3); ctx.fillStyle = palette.surface; ctx.fill(); ctx.strokeStyle = palette.border; ctx.stroke();
  const collapsed = meta.collapsed === true; const title = (meta.title || defaultNoteTitle(meta.kind)).slice(0, 120);
  ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.font = "600 11px system-ui, sans-serif"; ctx.fillStyle = palette.ink; ctx.fillText(title, x + 10, y + 8, Math.max(40, width - 42));
  const toggleX = x + width - 24; const toggleY = y + 5;
  ctx.strokeStyle = palette.muted; ctx.lineWidth = 1.3; ctx.beginPath();
  if (collapsed) { ctx.moveTo(toggleX + 5, toggleY + 7); ctx.lineTo(toggleX + 9, toggleY + 11); ctx.lineTo(toggleX + 13, toggleY + 7); }
  else { ctx.moveTo(toggleX + 5, toggleY + 11); ctx.lineTo(toggleX + 9, toggleY + 7); ctx.lineTo(toggleX + 13, toggleY + 11); }
  ctx.stroke();
  if (collapsed || height <= 32) { ctx.restore(); return; }
  ctx.save(); ctx.beginPath(); ctx.rect(x + 8, y + 29, width - 16, Math.max(0, height - 32)); ctx.clip();
  const wrap = (value: string, max: number) => { const chunks: string[] = []; let remaining = value; while (remaining.length > max) { let cut = remaining.lastIndexOf(" ", max); if (cut < 1) cut = max; chunks.push(remaining.slice(0, cut)); remaining = remaining.slice(cut).trimStart(); } chunks.push(remaining); return chunks; };
  const drawInline = (value: string, px: number, py: number, size: number, baseWeight: number, baseColor = palette.ink, forceBold = false, forceStrike = false) => {
    let cursorX = px;
    for (const run of noteInlineRuns(value)) {
      const weight = forceBold || run.bold ? 650 : baseWeight;
      const family = run.code ? "ui-monospace, SFMono-Regular, Consolas, monospace" : "system-ui, sans-serif";
      ctx.font = `${run.italic ? "italic " : ""}${weight} ${size}px ${family}`;
      const runWidth = ctx.measureText(run.text).width;
      if (run.highlight) { ctx.fillStyle = theme === "dark" ? "#6b5a24" : "#fff0a8"; ctx.fillRect(cursorX - 1, py, runWidth + 2, size + 3); }
      if (run.code) { ctx.fillStyle = appearance === "simple" ? palette.soft : "#e9eef4"; ctx.fillRect(cursorX - 2, py + 1, runWidth + 4, size + 3); }
      ctx.fillStyle = run.code ? (theme === "dark" ? "#e4edf6" : "#34465a") : baseColor;
      ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.fillText(run.text, cursorX, py, Math.max(1, x + width - 8 - cursorX));
      if (run.underline || run.strike || forceStrike) {
        ctx.strokeStyle = baseColor; ctx.lineWidth = 1; ctx.beginPath();
        const lineY = run.underline ? py + size + 1 : py + size * .55;
        ctx.moveTo(cursorX, lineY); ctx.lineTo(cursorX + runWidth, lineY); ctx.stroke();
      }
      cursorX += runWidth + (run.code ? 4 : 0);
    }
  };
  const measureInline = (text: string, run: NoteInlineRun, size: number, forceBold = false) => {
    const family = run.code ? "ui-monospace, SFMono-Regular, Consolas, monospace" : "system-ui, sans-serif";
    ctx.font = `${run.italic ? "italic " : ""}${forceBold || run.bold ? 650 : 400} ${size}px ${family}`;
    return ctx.measureText(text).width + (run.code ? 4 : 0);
  };
  if (meta.kind === "checklist") {
    const rows = checklistRows(meta.content, width, fontSize, (text, run, size, forceBold) => measureInline(text, run, size, forceBold));
    for (const row of rows) {
      const boxX = x + row.boxX; const textX = x + row.textX; const textTop = y + row.top + (row.height - row.labelLines.length * row.lineHeight) / 2;
      const checkboxY = y + row.top + Math.max(0, (row.height - 14) / 2);
      if (row.kind === "task") {
        ctx.beginPath(); ctx.roundRect(boxX, checkboxY, 14, 14, 1); ctx.fillStyle = row.done ? palette.check : palette.surface; ctx.fill(); ctx.strokeStyle = row.done ? palette.check : palette.border; ctx.stroke();
        if (row.done) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(boxX + 3, checkboxY + 7); ctx.lineTo(boxX + 6, checkboxY + 10); ctx.lineTo(boxX + 11, checkboxY + 4); ctx.stroke(); }
      }
      row.labelLines.forEach((line, lineIndex) => {
        const baseline = textTop + lineIndex * row.lineHeight;
        drawInline(line, textX, baseline, row.kind === "title" ? fontSize * 1.12 : fontSize, row.kind === "title" ? 650 : 400, row.done ? palette.muted : palette.ink, row.kind === "title", row.done);
      });
    }
  } else {
    let cursor = y + 30; let inCode = false; let language = "text"; let codeLines: string[] = [];
    const flushCode = () => {
      const max = Math.max(8, Math.floor((width - 32) / (fontSize * .62))); const lines = codeLines.flatMap(line => wrap(line, max)); const blockHeight = Math.max(32, lines.length * fontSize * 1.5 + 20);
      ctx.beginPath(); ctx.roundRect(x + 10, cursor, width - 20, blockHeight, appearance === "simple" ? 0 : 7); ctx.fillStyle = appearance === "simple" ? palette.surface : "#202936"; ctx.fill(); ctx.strokeStyle = appearance === "simple" ? palette.rule : "#344154"; ctx.stroke();
      ctx.font = "600 9px system-ui, sans-serif"; ctx.fillStyle = appearance === "simple" ? palette.muted : "#91a1b5"; ctx.fillText(language.toUpperCase(), x + 20, cursor + 7);
      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Consolas, monospace`; ctx.fillStyle = appearance === "simple" ? palette.ink : "#dce5f4";
      lines.forEach((line, index) => ctx.fillText(line, x + 20, cursor + 22 + index * fontSize * 1.5));
      cursor += blockHeight + 5; codeLines = []; inCode = false;
    };
    const sourceLines = meta.content.split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < sourceLines.length;) {
      const line = sourceLines[lineIndex];
      const fence = /^\s*```\s*([\w+#.-]*)\s*$/.exec(line);
      if (fence) { if (!inCode) { inCode = true; language = fence[1] || "text"; } else flushCode(); lineIndex++; continue; }
      if (inCode) { codeLines.push(line); lineIndex++; continue; }
      if (!line.trim()) { cursor += 8; lineIndex++; continue; }
      if (lineIndex + 1 < sourceLines.length && isMarkdownTableDivider(sourceLines[lineIndex + 1])) {
        const header = markdownCells(line); const rows: string[][] = [header]; let rowIndex = lineIndex + 2;
        while (rowIndex < sourceLines.length && sourceLines[rowIndex].includes("|")) { rows.push(markdownCells(sourceLines[rowIndex])); rowIndex++; }
        const columns = Math.max(1, ...rows.map(row => row.length)); const tableWidth = width - 22; const cellWidth = tableWidth / columns; const rowHeight = Math.max(20, fontSize * 1.5); const tableHeight = rows.length * rowHeight;
        ctx.save(); ctx.beginPath(); ctx.rect(x + 11, cursor, tableWidth, tableHeight); ctx.clip();
        rows.forEach((row, r) => {
          const rowY = cursor + r * rowHeight;
          if (r === 0) { ctx.fillStyle = palette.soft; ctx.fillRect(x + 11, rowY, tableWidth, rowHeight); }
          for (let c = 0; c < columns; c++) {
            const left = x + 11 + c * cellWidth; const value = row[c] ?? ""; ctx.font = `${r === 0 ? "600" : "400"} ${Math.max(9, fontSize * .86)}px system-ui, sans-serif`; ctx.fillStyle = palette.ink; ctx.textBaseline = "middle"; ctx.textAlign = "left";
            ctx.fillText(value, left + 6, rowY + rowHeight / 2, Math.max(1, cellWidth - 12));
            if (c) { ctx.strokeStyle = palette.rule; ctx.lineWidth = .75; ctx.beginPath(); ctx.moveTo(left, rowY); ctx.lineTo(left, rowY + rowHeight); ctx.stroke(); }
          }
          ctx.strokeStyle = palette.rule; ctx.lineWidth = .75; ctx.beginPath(); ctx.moveTo(x + 11, rowY + rowHeight); ctx.lineTo(x + 11 + tableWidth, rowY + rowHeight); ctx.stroke();
        });
        ctx.restore(); ctx.strokeStyle = palette.rule; ctx.lineWidth = 1; ctx.strokeRect(x + 11, cursor, tableWidth, tableHeight);
        cursor += tableHeight + 5; lineIndex = rowIndex; continue;
      }
      const heading = /^(#{1,3})\s+(.*)$/.exec(line); const quote = /^>\s?(.*)$/.exec(line); const bullet = /^\s*([-*+])\s+(.*)$/.exec(line); const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
      const value = heading?.[2] ?? quote?.[1] ?? bullet?.[2] ?? numbered?.[2] ?? line; const size = heading ? fontSize + (4 - heading[1].length) * 2 : fontSize;
      const prefix = bullet ? "• " : numbered ? `${numbered[1]}. ` : quote ? "“ " : ""; const indent = bullet || numbered ? 12 : quote ? 8 : 0;
      const textX = x + 16 + indent;
      const parts = wrapNoteMarkup(prefix + value, Math.max(12, x + width - 8 - textX), (text, run) => measureInline(text, run, size, !!heading));
      for (const part of parts) {
        if (quote) { ctx.strokeStyle = palette.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 12, cursor + 1); ctx.lineTo(x + 12, cursor + size); ctx.stroke(); }
        drawInline(part, textX, cursor, size, heading ? 650 : quote ? 400 : 400, quote ? palette.muted : palette.ink, !!heading); cursor += size * 1.5;
      }
      lineIndex++;
    }
    if (inCode) flushCode();
  }
  ctx.restore(); ctx.restore();
}
export function noteCollapseHit(group: GroupElement, point: { x: number; y: number }): boolean {
  if (!group.note) return false;
  if (group.note.kind === "note" && standaloneMarkdownTableRows(group.note.content)) return false;
  const background = group.elements.find((item): item is ShapeElement => item.type === "rectangle");
  if (!background) return false;
  const x = background.x + background.w - 28; const y = background.y + 2;
  return point.x >= x && point.x <= x + 24 && point.y >= y && point.y <= y + 24;
}

export function checklistIndexAt(group: GroupElement, point: { x: number; y: number }): number | undefined {
  if (group.note?.kind !== "checklist" || group.note.collapsed) return undefined;
  const background = group.elements.find((item): item is ShapeElement => item.type === "rectangle");
  if (!background) return undefined;
  for (const row of checklistRows(group.note.content, Math.abs(background.w), group.note.fontSize ?? 12)) {
    if (row.kind === "title") continue;
    const x = background.x + row.boxX; const y = background.y + row.top + Math.max(0, (row.height - 14) / 2);
    if (point.x >= x - 4 && point.x <= x + 22 && point.y >= y - 4 && point.y <= y + 18) return row.index;
  }
  return undefined;
}

export function toggleChecklistContent(content: string, target: number): string {
  let taskIndex = -1;
  return content.split(/\r?\n/).map(line => {
    if (!line.trim()) return line;
    if (checklistTitle(line) !== undefined) return line;
    if (taskIndex++ !== target) return line;
    return line.replace(/\[([ xX])\]/, (_match, value: string) => `[${value.trim() ? " " : "x"}]`);
  }).join("\n");
}
export { LIBRARY_COMPONENTS, buildLibraryRelationship, defaultLibraryFormOptions, defaultLibraryFormTitle, defaultLibraryChartData, defaultLibraryComponentFields, buildLibraryComponent } from "./features/components/library-components";
export type { LibraryComponentKind } from "./features/components/library-components";
