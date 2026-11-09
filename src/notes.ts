import type { ChecklistItem, GroupElement, NoteKind, ShapeElement, Theme } from "./model";
import { standaloneMarkdownTableRows } from "./app/markdown-table";
import { checklistIndexAt, layoutChecklist, toggleChecklistItem, type ChecklistMeasureText } from "./features/notes/checklist";
import { noteInlineRuns, type NoteInlineRun, wrapNoteMarkup } from "./features/notes/inline-markup";
export type { LibraryChartData } from "./model";
export { noteInlineRuns, wrapNoteMarkup };
export type { NoteInlineRun };
export { checklistIndexAt, toggleChecklistItem };
export type NoteTextMeasurer = ChecklistMeasureText;

export function measureNoteInlineText(ctx: CanvasRenderingContext2D, text: string, size: number, forceBold = false): number {
  const previousFont = ctx.font;
  ctx.font = `${forceBold ? 650 : 400} ${size}px system-ui, sans-serif`;
  const width = ctx.measureText(text).width;
  ctx.font = previousFont;
  return width;
}

export function estimateNoteCardContentHeight(content: string, kind: NoteKind, width: number, fontSize: number, checklistItems: ChecklistItem[] = []): number {
  const lines = content.split(/\r?\n/);
  const tableRows = kind === "note" ? standaloneMarkdownTableRows(content) : undefined;
  let estimated = 30;
  if (tableRows) estimated = tableRows.length * Math.max(22, fontSize * 1.8);
  else if (kind === "checklist") {
    estimated = layoutChecklist(checklistItems, width, fontSize).contentHeight;
  } else {
    const codeMaxChars = Math.max(8, Math.floor((width - 32) / (fontSize * .62)));
    let inCode = false; let codeCount = 0; let trailingCodeGap = 0;
    for (let lineIndex = 0; lineIndex < lines.length;) {
      const line = lines[lineIndex];
      if (/^\s*```/.test(line)) { if (inCode) { estimated += Math.max(32, codeCount * fontSize * 1.55 + 20) + 5; trailingCodeGap = 5; codeCount = 0; } else trailingCodeGap = 0; inCode = !inCode; lineIndex++; continue; }
      if (inCode) { codeCount += Math.max(1, Math.ceil(line.length / codeMaxChars)); lineIndex++; continue; }
      if (lineIndex + 1 < lines.length && isMarkdownTableDivider(lines[lineIndex + 1])) {
        let rowIndex = lineIndex + 2; let rowCount = 1;
        while (rowIndex < lines.length && lines[rowIndex].includes("|")) { rowCount++; rowIndex++; }
        estimated += rowCount * Math.max(20, fontSize * 1.5) + 5; trailingCodeGap = 0; lineIndex = rowIndex; continue;
      }
      const heading = /^(#{1,3})\s+/.exec(line);
      const textSize = heading ? fontSize + (4 - heading[1].length) * 2 : fontSize;
      const maxChars = Math.max(8, Math.floor((width - 38) / (textSize * .56)));
      if (line.trim()) { estimated += Math.ceil(line.length / maxChars) * textSize * 1.5; trailingCodeGap = 0; }
      lineIndex++;
    }
    if (inCode) estimated += Math.max(32, codeCount * fontSize * 1.55 + 20);
    else estimated -= trailingCodeGap;
  }
  return Math.max(32, estimated + (tableRows ? 0 : 1));
}

export function noteCardMaxScroll(group: GroupElement, measureText?: ChecklistMeasureText): number {
  const meta = group.note;
  const background = group.elements.find((item): item is ShapeElement => item.type === "rectangle");
  if (!meta || !background || meta.collapsed || meta.kind === "note" && standaloneMarkdownTableRows(meta.content)) return 0;
  const width = Math.abs(background.w); const height = Math.abs(background.h);
  const fontSize = Math.round(Math.max(8, Math.min(48, meta.fontSize ?? 12)));
  const checklistLayout = meta.kind === "checklist" ? layoutChecklist(meta.checklist?.items ?? [], width, fontSize, measureText) : undefined;
  const contentHeight = checklistLayout ? checklistLayout.contentHeight + 1 : meta.contentHeight ?? estimateNoteCardContentHeight(meta.content, meta.kind, width, fontSize);
  return Math.max(0, contentHeight - height);
}

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
  get system() { return this.light; },
  get ai() { return this.dark; },
  get minimalist() { return this.light; },
  get custom() { return this.light; },
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

/** Store card content in metadata and one backing shape inside the Canvas section. */
export function buildNoteGroup(x: number, y: number, kind: NoteKind, source: string, dimensions: { width?: number; height?: number; fontSize?: number; collapsed?: boolean; title?: string; scrollY?: number; checklistItems?: ChecklistItem[] } = {}): GroupElement {
  const content = kind === "checklist" ? "" : source;
  const width = Math.max(180, Math.min(4000, dimensions.width ?? (kind === "sticky" ? 296 : 340)));
  const fontSize = Math.round(Math.max(8, Math.min(32, dimensions.fontSize ?? 12)));
  const collapsed = dimensions.collapsed === true;
  const title = (dimensions.title ?? defaultNoteTitle(kind)).trim().slice(0, 120) || defaultNoteTitle(kind);
  const palette = noteCardPalette(kind, "light");
  const tableRows = kind === "note" ? standaloneMarkdownTableRows(content) : undefined;
  const checklistItems = kind === "checklist" ? dimensions.checklistItems ?? [] : undefined;
  const estimated = estimateNoteCardContentHeight(content, kind, width, fontSize, checklistItems);
  const fullHeight = dimensions.height === undefined ? Math.max(34, estimated) : Math.max(34, Math.min(1_000_000, dimensions.height));
  const visibleHeight = collapsed && !tableRows ? 32 : fullHeight;
  const background: ShapeElement = { type: "rectangle", x, y, w: width, h: visibleHeight, color: palette.border, thickness: 1, fillColor: palette.surface, fillOpacity: 1, edgeStyle: "rounded", cornerRadius: 3 };
  const maxScroll = collapsed || tableRows ? 0 : Math.max(0, estimated - visibleHeight);
  const scrollY = Math.max(0, Math.min(maxScroll, dimensions.scrollY ?? 0));
  return { type: "group", note: { kind, content, ...(checklistItems ? { checklist: { items: checklistItems } } : {}), title, width, height: fullHeight, fontSize, collapsed: tableRows ? false : collapsed, contentHeight: estimated, ...(scrollY ? { scrollY } : {}) }, elements: [background] };
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
  const measureChecklist = (text: string, size: number, bold: boolean) => measureNoteInlineText(ctx, text, size, bold);
  const measureInline = (text: string, run: NoteInlineRun, size: number, forceBold = false) => {
    const previousFont = ctx.font;
    const family = run.code ? "ui-monospace, SFMono-Regular, Consolas, monospace" : "system-ui, sans-serif";
    ctx.font = `${run.italic ? "italic " : ""}${forceBold || run.bold ? 650 : 400} ${size}px ${family}`;
    const measured = ctx.measureText(text).width + (run.code ? 4 : 0);
    ctx.font = previousFont;
    return measured;
  };
  const maxScroll = noteCardMaxScroll(group, measureChecklist);
  const scrollY = Math.max(0, Math.min(maxScroll, meta.scrollY ?? 0));
  ctx.save(); ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x, y, width, height, 3); ctx.fillStyle = palette.surface; ctx.fill(); ctx.strokeStyle = palette.border; ctx.stroke();
  const collapsed = meta.collapsed === true; const title = (meta.title || defaultNoteTitle(meta.kind)).slice(0, 120);
  ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.font = "600 11px system-ui, sans-serif"; ctx.fillStyle = palette.ink; ctx.fillText(title, x + 10, y + 8, Math.max(40, width - 42));
  const toggleX = x + width - 24; const toggleY = y + 5;
  ctx.strokeStyle = palette.muted; ctx.lineWidth = 1.3; ctx.beginPath();
  if (collapsed) { ctx.moveTo(toggleX + 5, toggleY + 7); ctx.lineTo(toggleX + 9, toggleY + 11); ctx.lineTo(toggleX + 13, toggleY + 7); }
  else { ctx.moveTo(toggleX + 5, toggleY + 11); ctx.lineTo(toggleX + 9, toggleY + 7); ctx.lineTo(toggleX + 13, toggleY + 11); }
  ctx.stroke();
  if (collapsed || height <= 32) { ctx.restore(); return; }
  ctx.save(); ctx.beginPath(); ctx.rect(x + 8, y + 29, width - 16, Math.max(0, height - 30)); ctx.clip();
  ctx.translate(0, -scrollY);
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
  if (meta.kind === "checklist") {
    const rows = layoutChecklist(meta.checklist?.items ?? [], width, fontSize, measureChecklist).rows;
    for (const row of rows) {
      const textX = x + row.textX;
      const textTop = y + row.textTop;
      if (row.type === "task" && row.checkboxX !== undefined && row.checkboxY !== undefined) {
        const boxX = x + row.checkboxX; const checkboxY = y + row.checkboxY;
        ctx.beginPath(); ctx.roundRect(boxX, checkboxY, 14, 14, 1); ctx.fillStyle = row.checked ? palette.check : palette.surface; ctx.fill(); ctx.strokeStyle = row.checked ? palette.check : palette.border; ctx.stroke();
        if (row.checked) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(boxX + 3, checkboxY + 7); ctx.lineTo(boxX + 6, checkboxY + 10); ctx.lineTo(boxX + 11, checkboxY + 4); ctx.stroke(); }
      }
      row.labelLines.forEach((line, lineIndex) => {
        const baseline = textTop + lineIndex * row.lineHeight;
        drawInline(line, textX, baseline, row.textSize, row.type === "heading" ? 650 : 400, row.checked ? palette.muted : palette.ink, row.type === "heading", row.checked);
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
  ctx.restore();
  if (maxScroll > 0) {
    const trackY = y + 29; const trackHeight = Math.max(1, height - 30);
    const thumbHeight = Math.max(12, trackHeight * trackHeight / (trackHeight + maxScroll));
    const thumbY = trackY + (trackHeight - thumbHeight) * scrollY / maxScroll;
    ctx.save(); ctx.globalAlpha = .5; ctx.fillStyle = palette.muted; ctx.beginPath(); ctx.roundRect(x + width - 5, thumbY, 2, thumbHeight, 1); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}
export function noteCollapseHit(group: GroupElement, point: { x: number; y: number }): boolean {
  if (!group.note) return false;
  if (group.note.kind === "note" && standaloneMarkdownTableRows(group.note.content)) return false;
  const background = group.elements.find((item): item is ShapeElement => item.type === "rectangle");
  if (!background) return false;
  const x = background.x + background.w - 28; const y = background.y + 2;
  return point.x >= x && point.x <= x + 24 && point.y >= y && point.y <= y + 24;
}

export { LIBRARY_COMPONENTS, buildLibraryRelationship, defaultLibraryUiComponent, defaultLibraryChartData, defaultLibraryComponentFields, buildLibraryComponent } from "./features/components/library-components";
export type { LibraryComponentKind } from "./features/components/library-components";
