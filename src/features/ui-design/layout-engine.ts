import type { UIAutoLayout, UIElement, UIPage, UIValueToken } from "./model";

const px = (value: number) => Math.max(1, Math.round(Number.isFinite(value) ? value : 1));
const coord = (value: number) => Math.round(Number.isFinite(value) ? value : 0);
const childrenOf = (nodes: UIElement[], parentId: string) => nodes.filter(node => node.parentId === parentId).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

/** Reflows nested containers in local coordinates, starting with the deepest child layouts. */
export function applyAutoLayout(page: UIPage, spacingTokens: readonly UIValueToken[] = []): UIPage {
  const nodes = page.elements.map(node => ({ ...node }));
  const byId = new Map(nodes.map(node => [node.id, node]));
  const tokenValues = new Map(spacingTokens.map(token => [token.id, token.value * (token.unit === "rem" ? 16 : 1)]));
  const containers = nodes.filter(node => node.autoLayout.enabled).sort((a, b) => depth(b, byId) - depth(a, byId));
  for (const container of containers) {
    const children = childrenOf(nodes, container.id);
    if (!children.length) continue;
    const source = container.autoLayout;
    const resolve = (value: number, tokenId: string) => Math.max(0, tokenValues.get(tokenId) ?? value);
    const layout: UIAutoLayout = {
      ...source,
      gap: resolve(source.gap, source.gapTokenId),
      paddingTop: resolve(source.paddingTop, source.paddingTopTokenId),
      paddingRight: resolve(source.paddingRight, source.paddingRightTokenId),
      paddingBottom: resolve(source.paddingBottom, source.paddingBottomTokenId),
      paddingLeft: resolve(source.paddingLeft, source.paddingLeftTokenId),
    };
    const left = layout.paddingLeft, top = layout.paddingTop;
    const innerW = Math.max(1, container.width - left - layout.paddingRight);
    const innerH = Math.max(1, container.height - top - layout.paddingBottom);
    const placements = layout.direction === "grid"
      ? layoutGrid(children, layout, left, top, innerW, innerH)
      : layout.direction === "horizontal"
        ? layoutRows(children, layout, left, top, innerW, innerH)
        : layoutColumns(children, layout, left, top, innerW, innerH);
    for (const placement of placements) {
      const index = nodes.findIndex(node => node.id === placement.id);
      if (index >= 0) nodes[index] = { ...nodes[index], x: coord(placement.x), y: coord(placement.y), width: px(placement.width), height: px(placement.height) };
    }
    const laidOut = childrenOf(nodes, container.id);
    if (layout.widthMode === "hug") container.width = px(Math.max(1, ...laidOut.map(child => child.x + child.width + layout.paddingRight)));
    if (layout.heightMode === "hug") container.height = px(Math.max(1, ...laidOut.map(child => child.y + child.height + layout.paddingBottom)));
  }
  return { ...page, elements: nodes };
}

type Placement = { id: string; x: number; y: number; width: number; height: number };
const sizing = (node: UIElement, axis: "width" | "height") => node.autoLayout.enabled ? node.autoLayout[axis === "width" ? "widthMode" : "heightMode"] : node[axis === "width" ? "widthSizing" : "heightSizing"];

function layoutRows(children: UIElement[], layout: UIAutoLayout, left: number, top: number, innerW: number, innerH: number): Placement[] {
  const rows: UIElement[][] = [[]];
  for (const child of children) {
    const row = rows[rows.length - 1];
    const fixedWidth = row.filter(item => sizing(item, "width") !== "fill").reduce((sum, item) => sum + item.width, 0);
    const nextFixedWidth = sizing(child, "width") === "fill" ? 0 : child.width;
    const nextGaps = layout.gap * row.length;
    if (layout.wrap && row.length && fixedWidth + nextFixedWidth + nextGaps > innerW) rows.push([]);
    rows[rows.length - 1].push(child);
  }
  const rowHeights = rows.map(row => Math.max(1, ...row.map(child => child.height)));
  const naturalHeight = rowHeights.reduce((sum, height) => sum + height, 0) + layout.gap * Math.max(0, rows.length - 1);
  const flexibleRows = rows.map((row, index) => ({ row, index })).filter(({ row }) => layout.alignment === "stretch" || row.some(child => sizing(child, "height") === "fill"));
  if (flexibleRows.length && innerH > naturalHeight) {
    const extra = (innerH - naturalHeight) / flexibleRows.length;
    for (const { index } of flexibleRows) rowHeights[index] += extra;
  }
  let y = top; const result: Placement[] = [];
  rows.forEach((row, rowIndex) => {
    const gapTotal = layout.gap * Math.max(0, row.length - 1);
    const fixedTotal = row.filter(child => sizing(child, "width") !== "fill").reduce((sum, child) => sum + child.width, 0);
    const fillCount = row.filter(child => sizing(child, "width") === "fill").length;
    const fillWidth = fillCount ? Math.max(1, (innerW - fixedTotal - gapTotal) / fillCount) : 0;
    const naturalTotal = row.reduce((sum, child) => sum + (sizing(child, "width") === "fill" ? fillWidth : child.width), 0) + gapTotal;
    const extra = Math.max(0, innerW - naturalTotal);
    const between = layout.justification === "space-between" && !fillCount && row.length > 1 ? layout.gap + extra / (row.length - 1) : layout.gap;
    let x = left + (layout.justification === "center" && !fillCount ? extra / 2 : layout.justification === "end" && !fillCount ? extra : 0);
    const rowHeight = rowHeights[rowIndex];
    for (const child of row) {
      const width = sizing(child, "width") === "fill" ? fillWidth : child.width;
      let height = sizing(child, "height") === "fill" ? rowHeight : child.height;
      if (layout.alignment === "stretch") height = rowHeight;
      const yOffset = layout.alignment === "center" ? (rowHeight - height) / 2 : layout.alignment === "end" ? rowHeight - height : 0;
      result.push({ id: child.id, x, y: y + yOffset, width, height }); x += width + between;
    }
    y += rowHeight + layout.gap;
  });
  return result;
}

function layoutColumns(children: UIElement[], layout: UIAutoLayout, left: number, top: number, innerW: number, innerH: number): Placement[] {
  const columns: UIElement[][] = [[]];
  for (const child of children) {
    const column = columns[columns.length - 1];
    const fixedHeight = column.filter(item => sizing(item, "height") !== "fill").reduce((sum, item) => sum + item.height, 0);
    const nextFixedHeight = sizing(child, "height") === "fill" ? 0 : child.height;
    const nextGaps = layout.gap * column.length;
    if (layout.wrap && column.length && fixedHeight + nextFixedHeight + nextGaps > innerH) columns.push([]);
    columns[columns.length - 1].push(child);
  }
  const naturalWidths = columns.map(column => Math.max(1, ...column.map(child => child.width)));
  const flexColumns = columns.some(column => layout.alignment === "stretch" || column.some(child => sizing(child, "width") === "fill"));
  const availableColumnWidth = flexColumns ? Math.max(1, (innerW - layout.gap * (columns.length - 1)) / columns.length) : 0;
  const columnWidths = naturalWidths.map(width => flexColumns ? availableColumnWidth : width);
  const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0) + layout.gap * Math.max(0, columns.length - 1);
  const extraWidth = Math.max(0, innerW - totalWidth);
  const startX = left + (layout.justification === "center" ? extraWidth / 2 : layout.justification === "end" ? extraWidth : 0);
  const result: Placement[] = []; let x = startX;
  columns.forEach((column, columnIndex) => {
    const gapTotal = layout.gap * Math.max(0, column.length - 1);
    const fixedTotal = column.filter(child => sizing(child, "height") !== "fill").reduce((sum, child) => sum + child.height, 0);
    const fillCount = column.filter(child => sizing(child, "height") === "fill").length;
    const fillHeight = fillCount ? Math.max(1, (innerH - fixedTotal - gapTotal) / fillCount) : 0;
    const naturalTotal = column.reduce((sum, child) => sum + (sizing(child, "height") === "fill" ? fillHeight : child.height), 0) + gapTotal;
    const extra = Math.max(0, innerH - naturalTotal);
    const between = layout.justification === "space-between" && !fillCount && column.length > 1 ? layout.gap + extra / (column.length - 1) : layout.gap;
    let y = top + (layout.justification === "center" && !fillCount ? extra / 2 : layout.justification === "end" && !fillCount ? extra : 0);
    const columnWidth = columnWidths[columnIndex];
    for (const child of column) {
      const height = sizing(child, "height") === "fill" ? fillHeight : child.height;
      let width = sizing(child, "width") === "fill" ? columnWidth : child.width;
      if (layout.alignment === "stretch") width = columnWidth;
      const xOffset = layout.alignment === "center" ? (columnWidth - width) / 2 : layout.alignment === "end" ? columnWidth - width : 0;
      result.push({ id: child.id, x: x + xOffset, y, width, height }); y += height + between;
    }
    // Justification distributes children along the column's main axis (Y).
    // Columns themselves stay separated by the configured cross-axis gap.
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
      const width = sizing(child, "width") === "fill" || layout.alignment === "stretch" ? cellW : child.width;
      const height = sizing(child, "height") === "fill" || layout.alignment === "stretch" ? rowHeight : child.height;
      const xOffset = layout.alignment === "center" ? (cellW - width) / 2 : layout.alignment === "end" ? cellW - width : 0;
      const yOffset = layout.alignment === "center" ? (rowHeight - height) / 2 : layout.alignment === "end" ? rowHeight - height : 0;
      result.push({ id: child.id, x: left + col * (cellW + layout.gap) + xOffset, y: y + yOffset, width, height });
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
  const result = nodes.map(node => ({ ...node }));
  const pending = [{ frameId, oldSize, nextSize }];
  const visited = new Set<string>();
  while (pending.length) {
    const current = pending.shift()!;
    if (visited.has(current.frameId)) continue;
    visited.add(current.frameId);
    const dx = current.nextSize.width - current.oldSize.width;
    const dy = current.nextSize.height - current.oldSize.height;
    if (!dx && !dy) continue;
    for (let index = 0; index < result.length; index++) {
      const node = result[index];
      if (node.parentId !== current.frameId) continue;
      const horizontal = node.constraints.horizontal, vertical = node.constraints.vertical;
      let x = node.x, y = node.y, width = node.width, height = node.height;
      if (horizontal === "right") x += dx;
      else if (horizontal === "left-right") width += dx;
      else if (horizontal === "center") x += dx / 2;
      else if (horizontal === "scale" && current.oldSize.width) { x *= current.nextSize.width / current.oldSize.width; width *= current.nextSize.width / current.oldSize.width; }
      if (vertical === "bottom") y += dy;
      else if (vertical === "top-bottom") height += dy;
      else if (vertical === "center") y += dy / 2;
      else if (vertical === "scale" && current.oldSize.height) { y *= current.nextSize.height / current.oldSize.height; height *= current.nextSize.height / current.oldSize.height; }
      width = Math.max(node.constraints.minWidth ?? 1, Math.min(node.constraints.maxWidth ?? 1e6, width));
      height = Math.max(node.constraints.minHeight ?? 1, Math.min(node.constraints.maxHeight ?? 1e6, height));
      const updated = { ...node, x: coord(x), y: coord(y), width: px(width), height: px(height) };
      result[index] = updated;
      if (updated.kind === "frame" && (updated.width !== node.width || updated.height !== node.height)) {
        pending.push({ frameId: updated.id, oldSize: { width: node.width, height: node.height }, nextSize: { width: updated.width, height: updated.height } });
      }
    }
  }
  return result;
}
