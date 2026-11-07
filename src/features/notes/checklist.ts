import type { ChecklistItem, GroupElement, ShapeElement } from "../../model";
import { wrapNoteMarkup } from "./inline-markup";

export type ChecklistMeasureText = (text: string, size: number, bold: boolean) => number;
export type ChecklistRow = {
  id: string;
  type: ChecklistItem["type"];
  top: number;
  height: number;
  lineHeight: number;
  checkboxX?: number;
  checkboxY?: number;
  textX: number;
  textTop: number;
  textSize: number;
  checked: boolean;
  labelLines: string[];
};
export type ChecklistLayout = { rows: ChecklistRow[]; contentHeight: number };
const CHECKLIST_CHECKED_MARK = String.fromCharCode(0x2713);
const isLegacyChecklistHeading = (text: string) => text.startsWith("**") && text.endsWith("**") && !text.slice(2, -2).includes("**");

export function checklistToText(items: ChecklistItem[]): string {
  return items.map(item => item.type === "heading"
    ? `# ${item.text}`
    : `${"\t".repeat(Math.max(0, Math.min(6, item.level)))}- [${item.checked ? "x" : " "}] ${item.text}`).join("\n");
}

export function parseChecklistText(source: string, previousItems: ChecklistItem[] = []): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  let itemIndex = 0;
  for (const line of source.split(/\r?\n/)) {
    const indent = /^[\t ]*/.exec(line)?.[0] ?? "";
    const level = Math.min(6, Math.floor(indent.replace(/\t/g, "  ").length / 2));
    let text = line.slice(indent.length).trim();
    if (!text) continue;
    const headingPrefix = /^#{1,3}\s+(.*)$/.exec(text);
    const taskPrefix = /^[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(text);
    const checkedPrefix = text.startsWith(`${CHECKLIST_CHECKED_MARK} `);
    const legacyBullet = !taskPrefix && /^[-*+]\s+/.exec(text);
    const legacyHeading = !taskPrefix && !checkedPrefix && !legacyBullet && isLegacyChecklistHeading(text) ? text.slice(2, -2) : undefined;
    const heading = !!headingPrefix || legacyHeading !== undefined;
    const checked = !heading && (taskPrefix ? taskPrefix[1].toLowerCase() === "x" : checkedPrefix);
    if (heading) text = headingPrefix?.[1] ?? legacyHeading ?? text;
    else if (taskPrefix) text = taskPrefix[2];
    else if (checkedPrefix) text = text.slice(CHECKLIST_CHECKED_MARK.length).trim();
    else if (legacyBullet) text = text.slice(legacyBullet[0].length).trim();
    if (!text) continue;
    const previous = previousItems[itemIndex++];
    const id = previous?.type === (heading ? "heading" : "task") ? previous.id : crypto.randomUUID();
    items.push(heading
      ? { id, type: "heading", text }
      : { id, type: "task", text, checked, level });
  }
  return items;
}

type ChecklistTextLine = { oldBodyStart: number; oldEnd: number; oldLineEnd: number; newBodyStart: number; newBodyEnd: number; newLineEnd: number };
export type ChecklistFormatResult = { text: string; selectionStart: number; selectionEnd: number };

/** Canonicalizes row type markers before formatting, keeping headings and tasks stable. */
export function formatChecklistTextSelection(source: string, selectionStart: number, selectionEnd: number, open: string, close: string): ChecklistFormatResult {
  const parts = source.split(/(\r\n|\n|\r)/);
  const canonicalParts: string[] = [];
  const lines: ChecklistTextLine[] = [];
  let oldCursor = 0;
  let newCursor = 0;

  for (let index = 0; index < parts.length; index += 2) {
    const line = parts[index] ?? "";
    const ending = parts[index + 1] ?? "";
    const indent = /^[\t ]*/.exec(line)?.[0] ?? "";
    const body = line.slice(indent.length);
    const trimmed = body.trim();
    let prefix = indent;
    let content = body;
    let oldBodyStart = oldCursor + indent.length;
    if (trimmed) {
      const heading = /^(#{1,3}\s+)(.*)$/.exec(trimmed);
      const legacyHeading = isLegacyChecklistHeading(trimmed);
      const task = /^[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(trimmed);
      const checked = trimmed.startsWith(`${CHECKLIST_CHECKED_MARK} `);
      const bullet = !task && !checked ? /^[-*+]\s+/.exec(trimmed) : undefined;
      if (heading) { prefix += heading[1]; content = heading[2]; oldBodyStart += heading[1].length; }
      else if (legacyHeading) { prefix += "# "; content = trimmed; }
      else if (task) { prefix += `- [${task[1].toLowerCase()}] `; content = task[2]; oldBodyStart += task[0].length; }
      else if (checked) { prefix += "- [x] "; content = trimmed.slice(CHECKLIST_CHECKED_MARK.length).trim(); oldBodyStart += CHECKLIST_CHECKED_MARK.length + 1; }
      else if (bullet) { prefix += "- [ ] "; content = trimmed.slice(bullet[0].length).trim(); oldBodyStart += bullet[0].length; }
      else { prefix += "- [ ] "; content = trimmed; }
    }
    const canonical = prefix + content;
    canonicalParts.push(canonical, ending);
    lines.push({
      oldBodyStart,
      oldEnd: oldCursor + line.length,
      oldLineEnd: oldCursor + line.length + ending.length,
      newBodyStart: newCursor + prefix.length,
      newBodyEnd: newCursor + canonical.length,
      newLineEnd: newCursor + canonical.length + ending.length,
    });
    oldCursor += line.length + ending.length;
    newCursor += canonical.length + ending.length;
  }

  const canonicalText = canonicalParts.join("");
  const mapOffset = (offset: number) => {
    const bounded = Math.max(0, Math.min(source.length, offset));
    const line = lines.find(item => bounded <= item.oldLineEnd) ?? lines[lines.length - 1];
    if (!line) return 0;
    if (bounded <= line.oldBodyStart) return line.newBodyStart;
    if (bounded <= line.oldEnd) return Math.min(line.newBodyEnd, line.newBodyStart + bounded - line.oldBodyStart);
    return Math.min(line.newLineEnd, line.newBodyEnd + bounded - line.oldEnd);
  };
  const start = mapOffset(selectionStart);
  const end = mapOffset(selectionEnd);
  if (start === end) {
    const line = lines.find(item => start >= item.newBodyStart && start <= item.newBodyEnd) ?? lines[lines.length - 1];
    if (!line) return { text: canonicalText, selectionStart: start, selectionEnd: end };
    if (line.newBodyStart === line.newBodyEnd) {
      const marker = "- [ ] ";
      const replacement = `${marker}${open}text${close}`;
      const at = line.newBodyStart;
      const text = canonicalText.slice(0, at) + replacement + canonicalText.slice(at);
      return { text, selectionStart: at + marker.length + open.length, selectionEnd: at + marker.length + open.length + 4 };
    }
    const at = Math.max(line.newBodyStart, Math.min(start, line.newBodyEnd));
    const replacement = `${open}text${close}`;
    const text = canonicalText.slice(0, at) + replacement + canonicalText.slice(at);
    return { text, selectionStart: at + open.length, selectionEnd: at + open.length + 4 };
  }

  const edits: Array<{ start: number; end: number; replacement: string; innerStart: number; innerEnd: number }> = [];
  for (const line of lines) {
    const from = Math.max(start, line.newBodyStart);
    const to = Math.min(end, line.newBodyEnd);
    if (to <= from) continue;
    const selected = canonicalText.slice(from, to);
    const wrapped = selected.length >= open.length + close.length && selected.startsWith(open) && selected.endsWith(close);
    const inner = wrapped ? selected.slice(open.length, -close.length) : selected;
    edits.push({ start: from, end: to, replacement: wrapped ? inner : `${open}${inner}${close}`, innerStart: wrapped ? 0 : open.length, innerEnd: wrapped ? inner.length : open.length + inner.length });
  }
  if (!edits.length) return { text: canonicalText, selectionStart: start, selectionEnd: end };

  let output = "";
  let cursor = 0;
  let formattedStart = start;
  let formattedEnd = end;
  edits.forEach((edit, index) => {
    output += canonicalText.slice(cursor, edit.start);
    const replacementStart = output.length;
    if (index === 0) formattedStart = replacementStart + edit.innerStart;
    output += edit.replacement;
    if (index === edits.length - 1) formattedEnd = replacementStart + edit.innerEnd;
    cursor = edit.end;
  });
  output += canonicalText.slice(cursor);
  return { text: output, selectionStart: formattedStart, selectionEnd: formattedEnd };
}

export function checklistTextLength(items: ChecklistItem[]): number {
  return items.reduce((total, item) => total + item.text.length, 0);
}

export function layoutChecklist(items: ChecklistItem[], width: number, fontSize: number, measureText?: ChecklistMeasureText): ChecklistLayout {
  const rows: ChecklistRow[] = [];
  let top = 32;
  for (const item of items) {
    const heading = item.type === "heading";
    const textSize = heading ? fontSize * 1.12 : fontSize;
    const lineHeight = Math.max(14, textSize * 1.25);
    const checkboxX = heading ? undefined : 11 + Math.max(0, Math.min(6, Math.floor(item.level))) * 14;
    const textX = heading ? 11 : checkboxX! + 21;
    const labelLines = wrapNoteMarkup(item.text, Math.max(12, width - textX - 8), (text, run) => measureText?.(text, textSize, heading || run.bold) ?? Array.from(text).length * textSize * (run.code ? .6 : heading || run.bold ? .52 : .5));
    const height = Math.max(22, labelLines.length * lineHeight + 3);
    const checkboxY = heading ? undefined : top + Math.max(0, (height - 14) / 2);
    rows.push({
      id: item.id,
      type: item.type,
      top,
      height,
      lineHeight,
      textX,
      textTop: top + (height - labelLines.length * lineHeight) / 2,
      textSize,
      checked: !heading && item.checked,
      labelLines,
      ...(checkboxX === undefined ? {} : { checkboxX, checkboxY }),
    });
    top += height + 2;
  }
  const last = rows[rows.length - 1];
  return { rows, contentHeight: last ? last.top + last.height : 32 };
}

export function checklistMaxScroll(layout: ChecklistLayout, cardHeight: number): number {
  return Math.max(0, layout.contentHeight + 1 - cardHeight);
}

export function checklistIndexAt(group: GroupElement, point: { x: number; y: number }, measureText?: ChecklistMeasureText): string | undefined {
  const meta = group.note;
  if (meta?.kind !== "checklist" || meta.collapsed) return undefined;
  const background = group.elements.find((item): item is ShapeElement => item.type === "rectangle");
  if (!background) return undefined;
  const width = Math.abs(background.w);
  const height = Math.abs(background.h);
  const fontSize = Math.round(Math.max(8, Math.min(48, meta.fontSize ?? 12)));
  const layout = layoutChecklist(meta.checklist?.items ?? [], width, fontSize, measureText);
  const scrollY = Math.max(0, Math.min(checklistMaxScroll(layout, height), meta.scrollY ?? 0));
  const localX = point.x - background.x;
  const localY = point.y - background.y;
  if (localY < 29 || localY > height - 3) return undefined;
  for (const row of layout.rows) {
    if (row.type !== "task" || row.checkboxX === undefined || row.checkboxY === undefined) continue;
    const hitX = row.checkboxX - 5;
    const hitY = row.checkboxY - scrollY - 5;
    if (localX >= hitX && localX <= hitX + 24 && localY >= hitY && localY <= hitY + 24) return row.id;
  }
  return undefined;
}

export function toggleChecklistItem(items: ChecklistItem[], id: string): ChecklistItem[] {
  return items.map(item => item.id === id && item.type === "task" ? { ...item, checked: !item.checked } : item);
}
