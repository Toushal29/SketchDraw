import type { DecisionCardMetadata, Element } from "../../model";
import { elementBounds, unionBounds } from "./bounds";
import { translateElement } from "./translate";

export function clusterStickyNotes(items: Element[], indices: number[], by: "color" | "tag", gap = 24): Element[] {
  const notes = [...new Set(indices)].flatMap(index => {
    const item = items[index]; if (!item || item.type !== "group" || !item.note || item.locked || item.hidden) return [];
    const surface = item.elements.find(child => child.type === "rectangle");
    const color = surface?.type === "rectangle" ? surface.fillColor ?? "#ffffff" : "#ffffff";
    const key = by === "color" ? color : item.note.tags?.[0]?.trim().toLowerCase() || "untagged";
    return [{ index, item, key, bounds: elementBounds(item) }];
  });
  if (notes.length < 2) return items;
  const region = unionBounds(notes.map(note => note.bounds))!;
  const categories = new Map<string, typeof notes>();
  for (const note of notes) categories.set(note.key, [...(categories.get(note.key) ?? []), note]);
  const groups = [...categories.values()]; const columnWidth = Math.max(...notes.map(note => note.bounds.w)); const rowGap = Math.max(12, Math.min(gap, 80));
  const next = [...items]; let x = region.x; let changed = false;
  for (const group of groups) {
    let y = region.y;
    for (const note of group.sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x)) {
      const dx = x + (columnWidth - note.bounds.w) / 2 - note.bounds.x; const dy = y - note.bounds.y;
      if (Math.abs(dx) > .01 || Math.abs(dy) > .01) { next[note.index] = translateElement(note.item, dx, dy); changed = true; }
      y += note.bounds.h + rowGap;
    }
    x += columnWidth + Math.max(20, Math.min(gap * 2, 96));
  }
  return changed ? next : items;
}

export function createPrioritizationBoard(x: number, y: number, title: string, boardId: string): Element {
  const width = 720; const height = 500; const header = 44; const axis = 34; const left = 42; const gap = 1;
  const cellW = (width - left - gap) / 2; const cellH = (height - header - axis - gap) / 2;
  const labels = [
    { quadrant: "low-low", x: left, y: header + cellH + gap, title: "Low value · low effort", color: "#f1f3f5" },
    { quadrant: "high-low", x: left, y: header, title: "High value · low effort", color: "#e8f5ec" },
    { quadrant: "low-high", x: left + cellW + gap, y: header + cellH + gap, title: "Low value · high effort", color: "#fff3e5" },
    { quadrant: "high-high", x: left + cellW + gap, y: header, title: "High value · high effort", color: "#eaf0ff" },
  ] as const;
  const children: Element[] = [
    { type: "rectangle", id: `${boardId}:surface`, x, y, w: width, h: height, color: "#c6ced8", thickness: 1, fillColor: "#ffffff", fillOpacity: 1, edgeStyle: "rounded", cornerRadius: 10, label: { text: title.slice(0, 80), color: "#243248", fontSize: 15, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "top", offsetX: 12, offsetY: 10 } },
    ...labels.map(cell => ({ type: "rectangle" as const, id: `${boardId}:${cell.quadrant}`, x: x + cell.x, y: y + cell.y, w: cellW, h: cellH, color: "#d8dee7", thickness: 1, fillColor: cell.color, fillOpacity: 1, label: { text: cell.title, color: "#45566d", fontSize: 11, fontFamily: "sans" as const, bold: true, italic: false, underline: false, textAlign: "left" as const, listType: "none" as const, verticalAlign: "top" as const, offsetX: 10, offsetY: 8 } })),
    { type: "text", id: `${boardId}:axis-x`, x: x + 235, y: y + height - 24, text: "Effort  →", color: "#536276", fontSize: 11, fontFamily: "sans", bold: true, textAlign: "center", listType: "none" },
    { type: "text", id: `${boardId}:axis-y`, x: x + 7, y: y + 236, text: "Value  →", color: "#536276", fontSize: 11, fontFamily: "sans", bold: true, textAlign: "center", listType: "none", rotation: -90 },
  ];
  return { type: "group", id: boardId, componentRole: "decision-board", componentBounds: { x, y, w: width, h: height }, elements: children, container: { kind: "frame", name: title, showLabel: false, clipChildren: false, autoResize: false, padding: 0 } };
}

export function placeSelectionInQuadrant(items: Element[], indices: number[], board: Element, quadrant: DecisionCardMetadata["quadrant"]): Element[] {
  if (board.type !== "group" || !board.componentBounds) return items;
  const selected = [...new Set(indices)].flatMap(index => {
    const item = items[index]; if (!item || item.id === board.id || item.type === "line" || item.type === "arrow" || item.type === "freehand" || item.locked || item.hidden) return [];
    return [{ index, item, bounds: elementBounds(item) }];
  });
  if (!selected.length) return items;
  selected.sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x);
  const frame = board.componentBounds; const halfW = (frame.w - 42 - 1) / 2; const halfH = (frame.h - 44 - 34 - 1) / 2;
  const right = quadrant.endsWith("high"); const top = quadrant.startsWith("high");
  const startX = frame.x + 42 + (right ? halfW + 1 : 0) + 12; const startY = frame.y + 44 + (top ? 0 : halfH + 1) + 38;
  const columnWidth = halfW - 24; const rowGap = 16; const widestCard = Math.max(...selected.map(entry => entry.bounds.w));
  const columns = Math.max(1, Math.floor(columnWidth / Math.max(100, widestCard + 18))); const columnSlot = columnWidth / columns;
  const rowHeights = new Map<number, number>(); selected.forEach((entry, position) => { const row = Math.floor(position / columns); rowHeights.set(row, Math.max(rowHeights.get(row) ?? 0, entry.bounds.h)); });
  const next = [...items];
  selected.forEach(({ index, item, bounds }, rank) => {
    const column = rank % columns; const row = Math.floor(rank / columns);
    let y = startY; for (let rowIndex = 0; rowIndex < row; rowIndex++) y += (rowHeights.get(rowIndex) ?? 0) + rowGap;
    const targetX = startX + column * columnSlot + Math.max(0, (columnSlot - bounds.w) / 2);
    const decisionCard: DecisionCardMetadata = { boardId: board.id!, quadrant, rank: rank + 1 };
    next[index] = { ...translateElement(item, targetX - bounds.x, y - bounds.y), decisionCard } as Element;
  });
  return next;
}
