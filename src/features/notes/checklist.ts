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

export function checklistToText(items: ChecklistItem[]): string {
  return items.map(item => `${item.type === "task" ? "\t".repeat(Math.max(0, Math.min(6, item.level))) + (item.checked ? `${CHECKLIST_CHECKED_MARK} ` : "") : "**"}${item.text}${item.type === "heading" ? "**" : ""}`).join("\n");
}

export function parseChecklistText(source: string, previousItems: ChecklistItem[] = []): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  let itemIndex = 0;
  for (const line of source.split(/\r?\n/)) {
    const indent = /^\s*/.exec(line)?.[0] ?? "";
    const level = Math.min(6, Math.floor(indent.replace(/\t/g, "  ").length / 2));
    let text = line.slice(indent.length).trim();
    if (!text) continue;
    const boldTitleEnd = text.startsWith("**") ? text.lastIndexOf("**") : -1;
    const boldTitle = boldTitleEnd > 2 ? `${text.slice(2, boldTitleEnd)}${text.slice(boldTitleEnd + 2)}`.trim() : undefined;
    const heading = text.startsWith("# ") || boldTitle !== undefined;
    const checked = !heading && text.startsWith(`${CHECKLIST_CHECKED_MARK} `);
    if (heading) text = boldTitle ?? text.slice(2).trim();
    else if (checked) text = text.slice(CHECKLIST_CHECKED_MARK.length).trim();
    if (!text) continue;
    const previous = previousItems[itemIndex++];
    const id = previous?.type === (heading ? "heading" : "task") ? previous.id : crypto.randomUUID();
    items.push(heading
      ? { id, type: "heading", text }
      : { id, type: "task", text, checked, level });
  }
  return items;
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
