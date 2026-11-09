import type { UIAutoLayout, UIElement, UIGridMinmaxTrack, UIPage, UIValueToken } from "./model";
import { resolveValueToken } from "./tokens";

const px = (value: number) => Math.max(1, Math.round(Number.isFinite(value) ? value : 1));
const coord = (value: number) => Math.round(Number.isFinite(value) ? value : 0);
const childrenOf = (nodes: UIElement[], parentId: string) => nodes.filter(node => node.parentId === parentId).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

/** Reflows nested containers in local coordinates, starting with the deepest child layouts. */
export function applyAutoLayout(page: UIPage, spacingTokens: readonly UIValueToken[] = [], modeId = ""): UIPage {
  const nodes = page.elements.map(node => ({ ...node }));
  const byId = new Map(nodes.map(node => [node.id, node]));
  const tokenValues = new Map(spacingTokens.map(token => [token.id, resolveValueToken(token, modeId, spacingTokens)]).filter((entry): entry is [string, number] => entry[1] !== undefined));
  const containers = nodes.filter(node => node.autoLayout.enabled).sort((a, b) => depth(b, byId) - depth(a, byId));
  for (const container of containers) {
    const allChildren = childrenOf(nodes, container.id);
    const children = allChildren.filter(child => child.layoutPosition !== "absolute" && !child.hidden);
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
  const explicitColumns = children.reduce((max, child) => Math.max(max, child.gridColumn > 0 ? Math.min(48, child.gridColumn - 1 + child.gridColumnSpan) : 0), 1);
  const columns = Math.max(1, Math.min(48, Math.max(Math.round(layout.columns), explicitColumns)));
  const occupied = new Set<string>();
  const slots = new Map<string, { row: number; column: number }>();
  const occupy = (row: number, column: number, rowSpan: number, columnSpan: number) => {
    for (let y = row; y < row + rowSpan; y++) for (let x = column; x < column + columnSpan; x++) occupied.add(`${y}:${x}`);
  };
  for (const child of children) if (child.gridRow > 0 && child.gridColumn > 0) {
    const row = Math.min(9999, child.gridRow - 1), column = Math.min(columns - 1, child.gridColumn - 1);
    slots.set(child.id, { row, column });
    occupy(row, column, Math.min(child.gridRowSpan, 10000 - row), Math.min(child.gridColumnSpan, columns - column));
  }
  let cursor = 0;
  for (const child of children) if (!slots.has(child.id)) {
    const colSpan = Math.min(child.gridColumnSpan, columns);
    const rowSpan = child.gridRowSpan;
    let row = Math.floor(cursor / columns), column = cursor % columns;
    const fits = (r: number, c: number) => {
      if (c + colSpan > columns) return false;
      for (let dy = 0; dy < rowSpan && r + dy < 10000; dy++) for (let dx = 0; dx < colSpan; dx++) if (occupied.has(`${r + dy}:${c + dx}`)) return false;
      return true;
    };
    while (!fits(row, column)) { cursor++; row = Math.floor(cursor / columns); column = cursor % columns; }
    slots.set(child.id, { row, column });
    occupy(row, column, Math.min(rowSpan, 10000 - row), Math.min(colSpan, columns - column));
    cursor++;
  }
  const rowCount = Math.min(10000, Math.max(1, ...children.map(child => { const row = slots.get(child.id)!.row; return row + Math.min(child.gridRowSpan, 10000 - row); })));
  const columnMinimums = Array.from({ length: columns }, () => 0);
  for (const child of children) {
    const slot = slots.get(child.id)!;
    if (child.gridColumnSpan === 1) columnMinimums[slot.column] = Math.max(columnMinimums[slot.column], child.width);
  }
  for (const child of children) {
    if (child.gridColumnSpan <= 1) continue;
    const slot = slots.get(child.id)!; const span = Math.min(child.gridColumnSpan, columns - slot.column);
    const current = columnMinimums.slice(slot.column, slot.column + span).reduce((sum, value) => sum + value, 0) + layout.gap * (span - 1);
    if (current < child.width) columnMinimums[slot.column + span - 1] += child.width - current;
  }
  const columnWidths = resolveGridTracks(columns, innerW, layout.gap, columnMinimums, layout.gridColumnSizes, layout.gridColumnFr, layout.gridColumnMinmax, Array.from({ length: columns }, () => true));
  const columnOffsets: number[] = [];
  let x = left;
  for (const width of columnWidths) { columnOffsets.push(x); x += width + layout.gap; }
  const rowHeights = Array.from({ length: rowCount }, (_, index) => Math.max(0, layout.gridRowSizes[index] ?? 0));
  for (const child of children) {
    const slot = slots.get(child.id)!;
    if (child.gridRowSpan <= 1) rowHeights[slot.row] = Math.max(rowHeights[slot.row], child.height);
  }
  for (const child of children) {
    if (child.gridRowSpan <= 1) continue;
    const slot = slots.get(child.id)!;
    const rowSpan = Math.max(1, Math.min(child.gridRowSpan, rowCount - slot.row));
    const current = rowHeights.slice(slot.row, slot.row + rowSpan).reduce((sum, value) => sum + value, 0) + layout.gap * (rowSpan - 1);
    if (current < child.height) rowHeights[slot.row + rowSpan - 1] += child.height - current;
  }
  const expandableRows = rowHeights.map((_, index) => layout.alignment === "stretch" || children.some(child => slots.get(child.id)?.row === index && child.gridRowSpan === 1 && sizing(child, "height") === "fill"));
  const resolvedRows = resolveGridTracks(rowCount, innerH, layout.gap, rowHeights, layout.gridRowSizes, layout.gridRowFr, layout.gridRowMinmax, expandableRows);
  let y = top;
  const rowOffsets = resolvedRows.map(height => { const value = y; y += height + layout.gap; return value; });
  const result: Placement[] = [];
  for (const child of children) {
    const slot = slots.get(child.id)!;
    const span = Math.max(1, Math.min(child.gridColumnSpan, columns - slot.column));
    const cellW = columnWidths.slice(slot.column, slot.column + span).reduce((sum, width) => sum + width, 0) + layout.gap * (span - 1);
    const rowSpan = Math.max(1, Math.min(child.gridRowSpan, rowCount - slot.row));
    const cellH = resolvedRows.slice(slot.row, slot.row + rowSpan).reduce((sum, height) => sum + height, 0) + layout.gap * (rowSpan - 1);
    const width = sizing(child, "width") === "fill" || layout.alignment === "stretch" ? cellW : child.width;
    const height = sizing(child, "height") === "fill" || layout.alignment === "stretch" ? cellH : child.height;
    const xOffset = layout.alignment === "center" ? (cellW - width) / 2 : layout.alignment === "end" ? cellW - width : 0;
    const yOffset = layout.alignment === "center" ? (cellH - height) / 2 : layout.alignment === "end" ? cellH - height : 0;
    let rowOffset = rowOffsets[slot.row];
    if (layout.justification === "center" || layout.justification === "end") {
      const contentHeight = resolvedRows.reduce((sum, value) => sum + value, 0) + layout.gap * Math.max(0, rowCount - 1);
      const free = Math.max(0, innerH - contentHeight);
      rowOffset += layout.justification === "center" ? free / 2 : free;
    } else if (layout.justification === "space-between" && rowCount > 1) {
      const contentHeight = resolvedRows.reduce((sum, value) => sum + value, 0) + layout.gap * (rowCount - 1);
      const extraGap = Math.max(0, innerH - contentHeight) / (rowCount - 1);
      rowOffset += slot.row * extraGap;
    }
    result.push({ id: child.id, x: columnOffsets[slot.column] + xOffset, y: rowOffset + yOffset, width, height });
  }
  return result;
}

/** Resolve fixed, intrinsic, fractional, and minmax tracks with min/max clamping. */
function resolveGridTracks(count: number, available: number, gap: number, contentMinimums: number[], legacySizes: number[], legacyFractions: number[], minmax: Array<UIGridMinmaxTrack | undefined>, expandAuto: boolean[]): number[] {
  const tracks = Array.from({ length: count }, (_, index) => {
    const configured = minmax[index]; const content = Math.max(0, contentMinimums[index] ?? 0);
    if (configured) {
      const min = Math.max(configured.min, content);
      if (configured.maxUnit === "px") return { size: Math.max(configured.min, configured.max), weight: 0, max: Math.max(configured.min, configured.max), expandable: false };
      // In minmax(min, 1fr), the upper bound is a flex weight, not a pixel cap.
      if (configured.maxUnit === "fr") return { size: min, weight: Math.max(0.001, configured.max), max: 1e6, expandable: false };
      return { size: min, weight: 0, max: Math.max(min, 1e6), expandable: expandAuto[index] };
    }
    const fixed = Math.max(0, legacySizes[index] ?? 0);
    if (fixed > 0) return { size: fixed, weight: 0, max: fixed, expandable: false };
    const weight = Math.max(0, legacyFractions[index] ?? 0);
    return { size: content, weight, max: 1e6, expandable: weight === 0 && expandAuto[index] };
  });
  const free = () => Math.max(0, available - gap * Math.max(0, count - 1) - tracks.reduce((sum, track) => sum + track.size, 0));
  const distribute = (indices: number[], weightAt: (index: number) => number) => {
    let remaining = free(); let active = indices.filter(index => tracks[index].size < tracks[index].max && weightAt(index) > 0);
    while (remaining > 0.01 && active.length) {
      const weightTotal = active.reduce((sum, index) => sum + weightAt(index), 0);
      let consumed = 0;
      for (const index of active) {
        const track = tracks[index]; const share = remaining * weightAt(index) / weightTotal;
        const addition = Math.min(share, track.max - track.size); track.size += addition; consumed += addition;
      }
      if (consumed < 0.01) break;
      remaining -= consumed; active = active.filter(index => tracks[index].size < tracks[index].max);
    }
  };
  const weighted = tracks.map((track, index) => track.weight > 0 ? index : -1).filter(index => index >= 0);
  if (weighted.length) {
    // Fractional tracks divide the space remaining after fixed tracks and gaps.
    // Intrinsic content is a minimum constraint, not extra space to add after the
    // fraction has been calculated. Freeze tracks whose minimum exceeds their
    // fractional share, then recalculate the remaining shares like CSS Grid.
    let remaining = Math.max(0, available - gap * Math.max(0, count - 1) - tracks.reduce((sum, track) => sum + (track.weight > 0 ? 0 : track.size), 0));
    let active = weighted.filter(index => tracks[index].size < tracks[index].max);
    while (active.length) {
      const weightTotal = active.reduce((sum, index) => sum + tracks[index].weight, 0);
      if (weightTotal <= 0) break;
      const fraction = remaining / weightTotal;
      const frozen = active.filter(index => tracks[index].size > fraction * tracks[index].weight);
      if (!frozen.length) {
        for (const index of active) tracks[index].size = Math.min(tracks[index].max, Math.max(tracks[index].size, fraction * tracks[index].weight));
        break;
      }
      for (const index of frozen) {
        remaining = Math.max(0, remaining - tracks[index].size);
        active = active.filter(candidate => candidate !== index);
      }
    }
  } else {
    distribute(tracks.map((track, index) => track.expandable ? index : -1).filter(index => index >= 0), () => 1);
  }
  return tracks.map(track => track.size);
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
