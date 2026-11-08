import type { UIAutoLayout, UIElement, UIPage } from "./model";

const px = (value: number) => Math.max(1, Math.round(Number.isFinite(value) ? value : 1));
const childrenOf = (nodes: UIElement[], parentId: string) => nodes.filter(node => node.parentId === parentId).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

/** Reflows nested containers in local coordinates, starting with the deepest child layouts. */
export function applyAutoLayout(page: UIPage): UIPage {
  const nodes = page.elements.map(node => ({ ...node }));
  const byId = new Map(nodes.map(node => [node.id, node]));
  const containers = nodes.filter(node => node.autoLayout.enabled).sort((a, b) => depth(b, byId) - depth(a, byId));
  for (const container of containers) {
    const children = childrenOf(nodes, container.id);
    if (!children.length) continue;
    const layout = container.autoLayout;
    const left = layout.paddingLeft, top = layout.paddingTop;
    const innerW = Math.max(1, container.width - left - layout.paddingRight);
    const innerH = Math.max(1, container.height - top - layout.paddingBottom);
    const placements = layout.direction === "grid"
      ? layoutGrid(children, layout, left, top, innerW, innerH)
      : layout.direction === "horizontal"
        ? layoutRows(children, layout, left, top, innerW)
        : layoutColumns(children, layout, left, top, innerH);
    for (const placement of placements) {
      const index = nodes.findIndex(node => node.id === placement.id);
      if (index >= 0) nodes[index] = { ...nodes[index], x: px(placement.x), y: px(placement.y), width: px(placement.width), height: px(placement.height) };
    }
    const laidOut = childrenOf(nodes, container.id);
    if (layout.widthMode === "hug") container.width = px(Math.max(1, ...laidOut.map(child => child.x + child.width + layout.paddingRight)));
    if (layout.heightMode === "hug") container.height = px(Math.max(1, ...laidOut.map(child => child.y + child.height + layout.paddingBottom)));
  }
  return { ...page, elements: nodes };
}

type Placement = { id: string; x: number; y: number; width: number; height: number };

function layoutRows(children: UIElement[], layout: UIAutoLayout, left: number, top: number, innerW: number): Placement[] {
  const rows: UIElement[][] = [[]]; let used = 0;
  for (const child of children) {
    const width = child.widthSizing === "fill" ? Math.min(child.width, innerW) : child.width;
    const nextWidth = (rows[rows.length - 1].length ? layout.gap : 0) + width;
    if (layout.wrap && rows[rows.length - 1].length && used + nextWidth > innerW) { rows.push([]); used = 0; }
    const row = rows[rows.length - 1]; used += (row.length ? layout.gap : 0) + width; row.push(child);
  }
  const rowHeights = rows.map(row => Math.max(1, ...row.map(child => child.heightSizing === "fill" ? child.height : child.height)));
  let y = top; const result: Placement[] = [];
  rows.forEach((row, rowIndex) => {
    const gapTotal = layout.gap * Math.max(0, row.length - 1);
    const fixedTotal = row.filter(child => child.widthSizing !== "fill").reduce((sum, child) => sum + child.width, 0);
    const fillCount = row.filter(child => child.widthSizing === "fill").length;
    const fillWidth = fillCount ? Math.max(1, (innerW - fixedTotal - gapTotal) / fillCount) : 0;
    const naturalTotal = row.reduce((sum, child) => sum + (child.widthSizing === "fill" ? fillWidth : child.width), 0) + gapTotal;
    const extra = Math.max(0, innerW - naturalTotal);
    const between = layout.justification === "space-between" && !fillCount && row.length > 1 ? layout.gap + extra / (row.length - 1) : layout.gap;
    let x = left + (layout.justification === "center" && !fillCount ? extra / 2 : layout.justification === "end" && !fillCount ? extra : 0);
    const rowHeight = rowHeights[rowIndex];
    for (const child of row) {
      const width = child.widthSizing === "fill" ? fillWidth : child.width;
      let height = child.heightSizing === "fill" ? rowHeight : child.height;
      if (layout.alignment === "stretch") height = rowHeight;
      const yOffset = layout.alignment === "center" ? (rowHeight - height) / 2 : layout.alignment === "end" ? rowHeight - height : 0;
      result.push({ id: child.id, x, y: y + yOffset, width, height }); x += width + between;
    }
    y += rowHeight + layout.gap;
  });
  return result;
}

function layoutColumns(children: UIElement[], layout: UIAutoLayout, left: number, top: number, innerH: number): Placement[] {
  const columns: UIElement[][] = [[]]; let used = 0;
  for (const child of children) {
    const height = child.heightSizing === "fill" ? Math.min(child.height, innerH) : child.height;
    const nextHeight = (columns[columns.length - 1].length ? layout.gap : 0) + height;
    if (layout.wrap && columns[columns.length - 1].length && used + nextHeight > innerH) { columns.push([]); used = 0; }
    const column = columns[columns.length - 1]; used += (column.length ? layout.gap : 0) + height; column.push(child);
  }
  const result: Placement[] = []; let x = left;
  columns.forEach(column => {
    const gapTotal = layout.gap * Math.max(0, column.length - 1);
    const fixedTotal = column.filter(child => child.heightSizing !== "fill").reduce((sum, child) => sum + child.height, 0);
    const fillCount = column.filter(child => child.heightSizing === "fill").length;
    const fillHeight = fillCount ? Math.max(1, (innerH - fixedTotal - gapTotal) / fillCount) : 0;
    const naturalTotal = column.reduce((sum, child) => sum + (child.heightSizing === "fill" ? fillHeight : child.height), 0) + gapTotal;
    const extra = Math.max(0, innerH - naturalTotal);
    const between = layout.justification === "space-between" && !fillCount && column.length > 1 ? layout.gap + extra / (column.length - 1) : layout.gap;
    let y = top + (layout.justification === "center" && !fillCount ? extra / 2 : layout.justification === "end" && !fillCount ? extra : 0);
    const columnWidth = Math.max(1, ...column.map(child => child.width));
    for (const child of column) {
      const height = child.heightSizing === "fill" ? fillHeight : child.height;
      let width = child.widthSizing === "fill" ? columnWidth : child.width;
      if (layout.alignment === "stretch") width = columnWidth;
      const xOffset = layout.alignment === "center" ? (columnWidth - width) / 2 : layout.alignment === "end" ? columnWidth - width : 0;
      result.push({ id: child.id, x: x + xOffset, y, width, height }); y += height + between;
    }
    x += columnWidth + layout.gap;
  });
  return result;
}

function layoutGrid(children: UIElement[], layout: UIAutoLayout, left: number, top: number, innerW: number, innerH: number): Placement[] {
  const columns = Math.max(1, Math.min(48, Math.round(layout.columns)));
  const rowCount = Math.ceil(children.length / columns);
  const cellW = Math.max(1, (innerW - layout.gap * (columns - 1)) / columns);
  const naturalRowHeights = Array.from({ length: rowCount }, (_, row) => Math.max(1, ...children.slice(row * columns, (row + 1) * columns).map(child => child.height)));
  const totalNatural = naturalRowHeights.reduce((sum, height) => sum + height, 0) + layout.gap * Math.max(0, rowCount - 1);
  const cellH = layout.heightMode === "fixed" && totalNatural < innerH ? Math.max(...naturalRowHeights, (innerH - layout.gap * Math.max(0, rowCount - 1)) / rowCount) : 0;
  let y = top; const result: Placement[] = [];
  for (let row = 0; row < rowCount; row++) {
    const rowChildren = children.slice(row * columns, (row + 1) * columns);
    const rowHeight = cellH || naturalRowHeights[row];
    rowChildren.forEach((child, col) => {
      const width = child.widthSizing === "fill" ? cellW : child.width;
      const height = child.heightSizing === "fill" ? rowHeight : child.height;
      const xOffset = layout.alignment === "center" ? (cellW - width) / 2 : layout.alignment === "end" ? cellW - width : 0;
      const yOffset = layout.alignment === "center" ? (rowHeight - height) / 2 : layout.alignment === "end" ? rowHeight - height : 0;
      result.push({ id: child.id, x: left + col * (cellW + layout.gap) + xOffset, y: y + yOffset, width, height: layout.alignment === "stretch" ? rowHeight : height });
    });
    y += rowHeight + layout.gap;
  }
  return result;
}

function depth(node: UIElement, byId: Map<string, UIElement>): number {
  let current: UIElement | undefined = node; let result = 0; const seen = new Set<string>();
  while (current?.parentId && byId.has(current.parentId) && !seen.has(current.parentId)) { seen.add(current.parentId); current = byId.get(current.parentId); result++; }
  return result;
}

/** Applies edge, center, scale, and min/max constraints to direct children during a frame resize. */
export function resizeFrameChildren(nodes: UIElement[], frameId: string, oldSize: { width: number; height: number }, nextSize: { width: number; height: number }): UIElement[] {
  const dx = nextSize.width - oldSize.width, dy = nextSize.height - oldSize.height;
  return nodes.map(node => {
    if (node.parentId !== frameId) return node;
    const horizontal = node.constraints.horizontal, vertical = node.constraints.vertical;
    let x = node.x, y = node.y, width = node.width, height = node.height;
    if (horizontal === "right") x += dx;
    else if (horizontal === "left-right") width += dx;
    else if (horizontal === "center") x += dx / 2;
    else if (horizontal === "scale" && oldSize.width) { x *= nextSize.width / oldSize.width; width *= nextSize.width / oldSize.width; }
    if (vertical === "bottom") y += dy;
    else if (vertical === "top-bottom") height += dy;
    else if (vertical === "center") y += dy / 2;
    else if (vertical === "scale" && oldSize.height) { y *= nextSize.height / oldSize.height; height *= nextSize.height / oldSize.height; }
    width = Math.max(node.constraints.minWidth ?? 1, Math.min(node.constraints.maxWidth ?? 1e6, width));
    height = Math.max(node.constraints.minHeight ?? 1, Math.min(node.constraints.maxHeight ?? 1e6, height));
    return { ...node, x: px(x), y: px(y), width: px(width), height: px(height) };
  });
}
