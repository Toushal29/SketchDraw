import type { ArrowHead, Element, Point, ShapeElement, Theme } from "../../model";
import { isConnector, isLabelShape, textElementLines } from "../../operations";
import { shapeDetailPathData, shapeFillRule, shapePathData } from "../shapes/geometry";
import { arrowHeadEntries, arrowHeadPoints, arrowHeadSvgPath, connectorSvgPath } from "../connectors/geometry";
import { elementBounds } from "../canvas/bounds";
import { normalizeExternalHref } from "../links/links";
import { fontCss, themeInk } from "../canvas/rendering";
import { freehandSvg } from "../canvas/freehand-rendering";
import { strokeDashPattern } from "../canvas/stroke-style";
import { modelComponentSvg } from "../components/model-component-renderer";
import { renderLibraryChartSvg } from "../components/chart-engine";
import { relationshipDisplayElement } from "../diagrams/relationships";
import { fitSchemaTableText, schemaTableColors, schemaTableContentInset, schemaTableMetrics, schemaTableRowLayout } from "../diagrams/schema-table-layout";
import { checklistRows, defaultNoteTitle, isMarkdownTableDivider, markdownCells, noteCardPalette } from "../../notes";
import { standaloneMarkdownTableRows } from "../../app/markdown-table";

type SvgRendererPorts = {
  theme: () => Theme;
  isHidden?: (element: Element) => boolean;
  sourceItems?: readonly Element[];
  simpleComponentElement: (element: Element) => Element;
  connectorForView: (element: ShapeElement, sourceItems?: Element[]) => ShapeElement;
  labelSvg: (shape: ShapeElement) => string;
};

export function createSvgElementSerializer(ports: SvgRendererPorts) {
  const { theme, simpleComponentElement, connectorForView, labelSvg } = ports;
  const hidden = (element: Element) => ports.isHidden?.(element) ?? element.hidden === true;
  const componentSymbolIds = new Map<string, string>();
  const emittedComponentSymbols = new Set<string>();
  const usedComponentSymbolIds = new Set<string>();
  const emittedIds = new Map<string, number>();
  const stableHash = (value: string) => { let hash = 2166136261; for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619); return (hash >>> 0).toString(36); };
  function componentUseSvg(element: Extract<Element, { type: "group" }>, bounds: NonNullable<Extract<Element, { type: "group" }>["componentBounds"]>) {
    const local = { ...element, rotation: 0, componentBounds: { x: 0, y: 0, w: bounds.w, h: bounds.h } };
    const vector = modelComponentSvg(local, theme(), ports.sourceItems);
    const key = `${bounds.w}x${bounds.h}:${vector}`;
    let id = componentSymbolIds.get(key);
    if (!id) {
      const base = `component-${stableHash(key)}`; id = base; let suffix = 2;
      while (usedComponentSymbolIds.has(id)) id = `${base}-${suffix++}`;
      componentSymbolIds.set(key, id); usedComponentSymbolIds.add(id);
    }
    const definition = emittedComponentSymbols.has(id) ? "" : `<defs><symbol id="${id}" viewBox="0 0 ${bounds.w} ${bounds.h}">${vector}</symbol></defs>`;
    emittedComponentSymbols.add(id);
    return `${definition}<use href="#${id}" x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}"/>`;
  }
function noteCardSvg(group: Extract<Element, { type: "group" }>): string {
    const meta = group.note; const background = group.elements.find((child): child is ShapeElement => child.type === "rectangle");
    if (!meta || !background) return "";
    const x = background.x, y = background.y, width = Math.abs(background.w), height = Math.abs(background.h), simple = true, palette = noteCardPalette(meta.kind, theme(), "simple");
    const standaloneTable = meta.kind === "note" ? standaloneMarkdownTableRows(meta.content) : undefined;
    if (standaloneTable) {
      const columns = standaloneTable[0].length; const cellWidth = width / columns; const rowHeight = height / standaloneTable.length;
      const clipId = `table-${(group.id ?? crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "")}`;
      const lines = Array.from({ length: columns - 1 }, (_, index) => `<path d="M ${x + (index + 1) * cellWidth} ${y} V ${y + height}" stroke="${palette.rule}" stroke-width=".75"/>`).join("")
        + Array.from({ length: standaloneTable.length - 1 }, (_, index) => `<path d="M ${x} ${y + (index + 1) * rowHeight} H ${x + width}" stroke="${palette.rule}" stroke-width=".75"/>`).join("");
      const cells = standaloneTable.map((row, rowIndex) => row.map((cell, column) => `<text x="${x + column * cellWidth + 6}" y="${y + (rowIndex + .5) * rowHeight}" dominant-baseline="middle" font-family="sans-serif" font-size="${Math.min(meta.fontSize ?? 12, Math.max(8, rowHeight - 6))}" font-weight="${rowIndex === 0 ? 600 : 400}" fill="${palette.ink}" textLength="${Math.min(cell.length * (meta.fontSize ?? 12) * .55, Math.max(1, cellWidth - 12))}" lengthAdjust="spacingAndGlyphs">${escapeXml(cell)}</text>`).join("")).join("");
      return `<g><defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${width}" height="${height}"/></clipPath></defs><g clip-path="url(#${clipId})"><rect x="${x}" y="${y}" width="${width}" height="${rowHeight}" fill="${palette.soft}"/><rect x="${x + .5}" y="${y + .5}" width="${Math.max(0, width - 1)}" height="${Math.max(0, height - 1)}" fill="none" stroke="${palette.border}"/>${lines}${cells}</g></g>`;
    }
    const title = escapeXml(meta.title || defaultNoteTitle(meta.kind)); const collapsed = meta.collapsed === true; const clipId = `note-${(group.id ?? crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "")}`;
    let body = "";
    if (!collapsed) {
      if (meta.kind === "checklist") {
        const rows = checklistRows(meta.content, width, meta.fontSize ?? 12);
        body += rows.map(row => { const boxX = x + row.boxX, boxY = y + row.top + Math.max(0, (row.height - 14) / 2), textY = y + row.top + (row.height - row.labelLines.length * row.lineHeight) / 2; return `<rect x="${boxX}" y="${boxY}" width="14" height="14" rx="1" fill="${row.done ? palette.check : palette.surface}" stroke="${row.done ? palette.check : palette.border}"/>${row.done ? `<path d="M ${boxX + 3} ${boxY + 7} l3 3 5 -6" fill="none" stroke="${simple ? palette.ink : "#fff"}" stroke-width="1.6"/>` : ""}${row.labelLines.map((line, index) => `<text x="${x + row.textX}" y="${textY + index * row.lineHeight}" dominant-baseline="hanging" font-family="sans-serif" font-size="${meta.fontSize ?? 12}" fill="${row.done ? palette.muted : palette.ink}">${escapeXml(line)}</text>`).join("")}`; }).join("");
      } else {
        let cursor = y + 30, inCode = false, language = "text", codeLines: string[] = [];
        const addCode = () => { const fontSize = meta.fontSize ?? 12; const max = Math.max(8, Math.floor((width - 42) / (fontSize * .62))); const lines = codeLines.flatMap(line => { const chunks: string[] = []; for (let index = 0; index < Math.max(1, line.length); index += max) chunks.push(line.slice(index, index + max)); return chunks; }); const blockHeight = Math.max(32, lines.length * fontSize * 1.5 + 20); body += `<rect x="${x + 10}" y="${cursor}" width="${width - 20}" height="${blockHeight}" rx="${simple ? 0 : 7}" fill="${simple ? palette.surface : "#202936"}" stroke="${simple ? palette.rule : "#344154"}"/><text x="${x + 20}" y="${cursor + 7}" dominant-baseline="hanging" font-family="sans-serif" font-size="9" font-weight="600" fill="${simple ? palette.muted : "#91a1b5"}">${escapeXml(language.toUpperCase())}</text>${lines.map((line, index) => `<text x="${x + 20}" y="${cursor + 22 + index * fontSize * 1.5}" dominant-baseline="hanging" font-family="monospace" font-size="${fontSize}" fill="${palette.ink}">${escapeXml(line)}</text>`).join("")}`; cursor += blockHeight + 5; codeLines = []; inCode = false; };
        const maxChars = Math.max(8, Math.floor((width - 36) / ((meta.fontSize ?? 12) * .56)));
        const sourceLines = meta.content.split(/\r?\n/);
        for (let lineIndex = 0; lineIndex < sourceLines.length;) {
          const line = sourceLines[lineIndex];
          const fence = /^\s*```\s*([\w+#.-]*)\s*$/.exec(line); if (fence) { if (!inCode) { inCode = true; language = fence[1] || "text"; } else addCode(); lineIndex++; continue; }
          if (inCode) { codeLines.push(line); lineIndex++; continue; } if (!line.trim()) { lineIndex++; continue; }
          if (lineIndex + 1 < sourceLines.length && isMarkdownTableDivider(sourceLines[lineIndex + 1])) {
            const rows = [markdownCells(line)]; let rowIndex = lineIndex + 2;
            while (rowIndex < sourceLines.length && sourceLines[rowIndex].includes("|")) rows.push(markdownCells(sourceLines[rowIndex++]));
            const columns = Math.max(1, ...rows.map(row => row.length)); const tableWidth = width - 22;
            const cellWidth = tableWidth / columns; const rowHeight = Math.max(20, (meta.fontSize ?? 12) * 1.5); const tableHeight = rowHeight * rows.length;
            body += `<rect x="${x + 11}" y="${cursor}" width="${tableWidth}" height="${tableHeight}" fill="none" stroke="${palette.rule}"/><rect x="${x + 11}" y="${cursor}" width="${tableWidth}" height="${rowHeight}" fill="${palette.soft}"/>`;
            rows.forEach((row, rowIndex) => {
              if (rowIndex) body += `<path d="M ${x + 11} ${cursor + rowIndex * rowHeight} H ${x + 11 + tableWidth}" stroke="${palette.rule}"/>`;
              row.forEach((cell, column) => { body += `<text x="${x + 17 + column * cellWidth}" y="${cursor + rowIndex * rowHeight + rowHeight / 2}" dominant-baseline="middle" font-family="sans-serif" font-size="${Math.max(9, (meta.fontSize ?? 12) * .86)}" font-weight="${rowIndex ? 400 : 600}" fill="${palette.ink}">${escapeXml(cell)}</text>`; });
            });
            for (let column = 1; column < columns; column++) body += `<path d="M ${x + 11 + column * cellWidth} ${cursor} V ${cursor + tableHeight}" stroke="${palette.rule}"/>`;
            cursor += tableHeight + 5; lineIndex = rowIndex; continue;
          }
          const heading = /^(#{1,3})\s+(.*)$/.exec(line); const value = heading?.[2] ?? line; const size = heading ? (meta.fontSize ?? 12) + (4 - heading[1].length) * 2 : (meta.fontSize ?? 12);
          for (let index = 0; index < Math.max(1, value.length); index += maxChars) { body += `<text x="${x + 16}" y="${cursor}" dominant-baseline="hanging" font-family="sans-serif" font-size="${size}" font-weight="${heading ? 650 : 400}" fill="${palette.ink}">${escapeXml(value.slice(index, index + maxChars))}</text>`; cursor += size * 1.5; }
          lineIndex++;
        }
        if (inCode) addCode();
      }
    }
    const toggleX = x + width - 24, toggleY = y + 5;
    const chevron = collapsed ? `M ${toggleX + 5} ${toggleY + 7} l4 4 4 -4` : `M ${toggleX + 5} ${toggleY + 11} l4 -4 4 4`;
    return `<g><defs><clipPath id="${clipId}"><rect x="${x + 8}" y="${y + 29}" width="${Math.max(0, width - 16)}" height="${Math.max(0, height - 32)}"/></clipPath></defs><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="3" fill="${palette.surface}" stroke="${palette.border}"/><text x="${x + 10}" y="${y + 8}" dominant-baseline="hanging" font-family="sans-serif" font-size="11" font-weight="600" fill="${palette.ink}">${title}</text><path d="${chevron}" fill="none" stroke="${palette.muted}" stroke-width="1.3"/>${collapsed ? "" : `<g clip-path="url(#${clipId})">${body}</g>`}</g>`;
  }

  function elementToSvg(element: Element): string {
    if (hidden(element)) return "";
    const content = serializeElement(element);
    if (!content || !element.id) return content;
    const base = `sketchdraw-${element.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`; const count = emittedIds.get(base) ?? 0; emittedIds.set(base, count + 1);
    // Alt text becomes the object's accessible name and tooltip in exported SVG.
    const alt = element.altText?.trim(); const title = element.tooltip?.trim() || alt; const link = normalizeExternalHref(element.href);
    const targetId = element.prototypeTargetId ? `sketchdraw-${element.prototypeTargetId.replace(/[^a-zA-Z0-9_-]/g, "-")}` : undefined;
    const data = `${element.layerId ? ` data-layer="${escapeXml(element.layerId)}"` : ""}${element.pageLinkId ? ` data-page-link="${escapeXml(element.pageLinkId)}" data-transition="${element.pageLinkTransition ?? "instant"}"` : ""}${targetId ? ` data-prototype-target="${escapeXml(targetId)}"` : ""}`;
    const group = `<g id="${base}${count ? `-${count + 1}` : ""}" data-sketchdraw-type="${element.type}"${data}${alt ? ` role="img" aria-label="${escapeXml(alt)}"` : ""}>${title ? `<title>${escapeXml(title)}</title>` : ""}${content}</g>`;
    return link ? `<a href="${escapeXml(link)}" target="_blank" rel="noopener noreferrer">${group}</a>` : group;
  }

  function serializeElement(element: Element): string {
    if (hidden(element)) return "";
    element = simpleComponentElement(element);
    if (element.type === "group") {
      if (element.note) return noteCardSvg(element);
      if (element.container?.collapsed && element.componentBounds) {
        const box = element.componentBounds; const countChildren = (items: Element[]): number => items.reduce((total, item) => total + 1 + (item.type === "group" ? countChildren(item.elements) : 0), 0); const count = countChildren(element.elements);
        const fill = element.container.background ?? (theme() === "dark" ? "#242a35" : "#f7f9fc"); const border = element.container.borderColor ?? "#77859a";
        const content = `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="8" fill="${escapeXml(fill)}" stroke="${escapeXml(border)}" stroke-width="${element.container.borderThickness ?? 1.5}"/><text x="${box.x + 14}" y="${box.y + box.h / 2}" dominant-baseline="middle" font-family="sans-serif" font-size="13" font-weight="600" fill="${theme() === "dark" ? "#f2f4f8" : "#253044"}">${escapeXml(`${element.container.name || "Group"} · ${count} items`)}</text>`;
        return element.rotation ? `<g transform="rotate(${element.rotation} ${box.x + box.w / 2} ${box.y + box.h / 2})">${content}</g>` : content;
      }
      if (element.componentBounds) {
        const bounds = element.componentBounds; const cx = bounds.x + bounds.w / 2; const cy = bounds.y + bounds.h / 2;
        const component = element.libraryComponent?.kind?.startsWith("viz-")
          ? renderLibraryChartSvg(element, theme())
          : element.libraryComponent ? componentUseSvg(element, bounds) : "";
        const clipId = `model-${(element.id ?? `component-${stableHash(JSON.stringify([bounds.x, bounds.y, bounds.w, bounds.h]))}`).replace(/[^a-zA-Z0-9_-]/g, "")}`;
        const clippedComponent = component ? `<defs><clipPath id="${clipId}"><rect x="${bounds.x}" y="${bounds.y}" width="${Math.max(0, bounds.w)}" height="${Math.max(0, bounds.h)}"/></clipPath></defs><g clip-path="url(#${clipId})">${component}</g>` : "";
        const children = element.container ? element.elements.map(elementToSvg).join("") : "";
        const borderStyle = element.container?.borderStyle ?? (element.container?.kind === "frame" ? "dashed" : "solid"); const borderWidth = element.container?.borderThickness ?? 1.5;
        const borderDashValues = strokeDashPattern(borderStyle, borderWidth); const borderDash = borderDashValues.length ? ` stroke-dasharray="${borderDashValues.join(" ")}"` : "";
        const containerRect = element.container && !element.libraryComponent && (element.container.showBorder !== false || !!element.container.background)
          ? `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}" fill="${element.container.background ?? "none"}"${element.container.showBorder === false ? ' stroke="none"' : ` stroke="${element.container.borderColor ?? "#667085"}" stroke-width="${borderWidth}"${borderDash}`}/>${element.container.showBorder !== false && borderStyle === "double" ? `<rect x="${bounds.x + Math.max(2, borderWidth * 1.5)}" y="${bounds.y + Math.max(2, borderWidth * 1.5)}" width="${Math.max(0, bounds.w - Math.max(2, borderWidth * 1.5) * 2)}" height="${Math.max(0, bounds.h - Math.max(2, borderWidth * 1.5) * 2)}" fill="none" stroke="${element.container.borderColor ?? "#667085"}" stroke-width="${borderWidth}"/>` : ""}` : "";
        const containerLabel = element.container && !element.libraryComponent && element.container.showLabel !== false && element.container.name.trim()
          ? `<text x="${bounds.x + 8}" y="${bounds.y - 5}" font-family="sans-serif" font-size="14" font-weight="600" fill="#475467">${escapeXml(element.container.name)}</text>` : "";
        const container = `${containerRect}${containerLabel}`;
        const content = `${container}${clippedComponent}${children}`;
        const clipped = element.container?.clipChildren ? `<defs><clipPath id="${clipId}-children"><rect x="${bounds.x}" y="${bounds.y}" width="${Math.max(0, bounds.w)}" height="${Math.max(0, bounds.h)}"/></clipPath></defs><g clip-path="url(#${clipId}-children)">${content}</g>` : content;
        return element.rotation ? `<g transform="rotate(${element.rotation} ${cx} ${cy})">${clipped}</g>` : clipped;
      }
      return `<g>${element.elements.map(elementToSvg).join("")}</g>`;
    }
    const bounds = elementBounds(element); const cx = bounds.x + bounds.w / 2; const cy = bounds.y + bounds.h / 2;
    const labelTarget = isConnector(element) ? relationshipDisplayElement(element) : element;
    const content = elementSvgBody(element) + (isLabelShape(element) || isConnector(element) ? labelSvg(labelTarget as ShapeElement) : "");
    return element.rotation ? `<g transform="rotate(${element.rotation} ${cx} ${cy})">${content}</g>` : content;
  }

  function elementSvgBody(element: Element): string {
    if (element.type === "group") return `<g>${element.elements.map(elementToSvg).join("")}</g>`;
    if (hidden(element)) return "";
    if (element.type === "image") { const sx = element.cropX ?? 0; const sy = element.cropY ?? 0; const sw = element.cropW ?? element.sourceWidth ?? element.w; const sh = element.cropH ?? element.sourceHeight ?? element.h; return `<svg x="${element.x}" y="${element.y}" width="${element.w}" height="${element.h}" viewBox="${sx} ${sy} ${sw} ${sh}" preserveAspectRatio="none" opacity="${element.opacity ?? 1}"><image width="${element.sourceWidth ?? sw}" height="${element.sourceHeight ?? sh}" href="${element.dataUrl}"/></svg>`; }
    // Keep the vector card layout in step with canvas sizing and field-bound connector anchors.
    if (element.type === "schemaTable") {
      const { fontSize, titleHeight, rowHeight } = schemaTableMetrics(element.fontSize ?? 12);
      const contentInset = schemaTableContentInset(fontSize);
      const colors = schemaTableColors(theme()); const left = element.x; const top = element.y; const right = left + element.w;
      const rowsTop = top + titleHeight;
      const rows = element.columns.map((column, index) => {
        const rowTop = rowsTop + index * rowHeight; const middle = rowTop + rowHeight / 2;
        const unique = element.constraints?.some(constraint => constraint.kind === "unique" && constraint.columns?.some(name => name.toLowerCase() === column.name.toLowerCase())) ?? false;
        const layout = schemaTableRowLayout(left, element.w, column, fontSize, unique);
        const markers = layout.markers.map(marker => {
          const ink = marker.kind === "primary" ? colors.primaryKey : marker.kind === "foreign" ? colors.foreignKey : colors.required;
          return `<text x="${marker.x}" y="${middle + fontSize * .2}" font-family="sans-serif" font-size="${Math.max(6, fontSize * .58)}" font-weight="700" fill="${ink}">${marker.label}</text>`;
        }).join("");
          return `${markers}
          <text x="${layout.fieldX}" y="${middle + fontSize * .29}" font-family="monospace" font-size="${fontSize * .82}" font-weight="600" fill="${colors.text}">${escapeXml(fitSchemaTableText(column.name, layout.fieldWidth, fontSize * .82))}</text>
            ${column.dataType ? `<text x="${layout.typeRight}" y="${middle + fontSize * .24}" text-anchor="end" font-family="monospace" font-size="${fontSize * .7}" fill="${colors.muted}">${escapeXml(fitSchemaTableText(column.dataType, layout.typeWidth, fontSize * .7))}</text>` : ""}`;
      }).join("");
        const objectBadge = element.objectKind === "view" ? "VIEW" : element.objectKind === "enum" ? "ENUM" : "";
      return `<g opacity="${element.opacity ?? 1}">
        <rect x="${left + 1}" y="${top + 2}" width="${element.w}" height="${element.h}" rx="4" fill="${theme() === "dark" ? "rgba(0,0,0,.28)" : "rgba(33,43,54,.14)"}"/>
        <rect x="${left}" y="${top}" width="${element.w}" height="${element.h}" rx="4" fill="${colors.surface}"/>
        <path d="M ${left + 4} ${top} H ${right - 4} Q ${right} ${top} ${right} ${top + 4} V ${top + titleHeight} H ${left} V ${top + 4} Q ${left} ${top} ${left + 4} ${top} Z" fill="${colors.header}"/>
        <line x1="${left}" y1="${top + titleHeight}" x2="${right}" y2="${top + titleHeight}" stroke="${colors.divider}"/>
          <text x="${left + contentInset}" y="${top + titleHeight * .68}" font-family="sans-serif" font-size="${fontSize * .96}" font-weight="600" fill="${colors.title}">${escapeXml(fitSchemaTableText(element.name, element.w - contentInset * 2 - (objectBadge ? 38 : 0), fontSize * .96))}</text>
          ${objectBadge ? `<text x="${right - contentInset}" y="${top + titleHeight * .65}" text-anchor="end" font-family="sans-serif" font-size="${fontSize * .58}" font-weight="700" fill="${colors.muted}">${objectBadge}</text>` : ""}
        ${rows}
        <rect x="${left}" y="${top}" width="${element.w}" height="${element.h}" rx="4" fill="none" stroke="${colors.border}" stroke-width="1"/>
      </g>`;
    }
    if (element.type === "text") {
      const family = fontCss(element.fontFamily);
      const lines = textElementLines(element).map((line, index) => `<tspan x="${element.x}" dy="${index === 0 ? 0 : element.fontSize * 1.25}">${escapeXml(line)}</tspan>`).join("");
      return `<text x="${element.x}" y="${element.y + element.fontSize}" fill="${escapeXml(themeInk(element.color, theme()))}" opacity="${element.opacity ?? 1}" font-size="${element.fontSize}" font-family="${family}" font-weight="${element.bold ? "700" : "400"}" font-style="${element.italic ? "italic" : "normal"}" text-decoration="${element.underline ? "underline" : "none"}" text-anchor="${element.textAlign === "center" ? "middle" : element.textAlign === "right" ? "end" : "start"}">${lines}</text>`;
    }
    const fillColor = "fillColor" in element ? element.fillColor : undefined;
    const dash = "lineStyle" in element ? strokeDashPattern(element.lineStyle, element.thickness).join(" ") : "";
    const fillOpacity = "fillOpacity" in element ? element.fillOpacity ?? 0.2 : 0.2;
    const ink = themeInk(element.color, theme());
    const strokeWidth = element.thickness;
    const strokeOpacity = element.opacity ?? 1;
    const style = `fill="${fillColor ? escapeXml(fillColor) : "none"}"${fillColor ? ` fill-opacity="${fillOpacity}"` : ""} stroke="${escapeXml(ink)}" opacity="${strokeOpacity}" stroke-width="${strokeWidth}" stroke-dasharray="${dash}" stroke-linecap="round" stroke-linejoin="round"`;
    if (element.type === "freehand") return freehandSvg(element, ink);
    if (element.type === "svgPath") {
      const path = escapeXml(element.pathData ?? ""); const sx = element.w / Math.max(1, element.pathWidth ?? element.w); const sy = element.h / Math.max(1, element.pathHeight ?? element.h);
      const fill = element.fillColor ? escapeXml(element.fillColor) : "none";
      const stroke = element.svgStroke === false ? "none" : escapeXml(themeInk(element.color, theme()));
      const svgStyle = `fill="${fill}" fill-opacity="${element.fillOpacity ?? 1}" fill-rule="${element.fillRule ?? "nonzero"}" stroke="${stroke}" stroke-width="${element.thickness}"${element.lineStyle === "double" ? "" : dash ? ` stroke-dasharray="${dash}"` : ""}${element.svgNonScalingStroke ? ` vector-effect="non-scaling-stroke"` : ""} opacity="${element.opacity ?? 1}" stroke-linecap="round" stroke-linejoin="round"`;
      const base = `<path d="${path}" transform="translate(${element.x} ${element.y}) scale(${sx} ${sy})" ${svgStyle}/>`;
      if (element.lineStyle !== "double" || element.svgStroke === false) return base;
      return `${base}<path d="${path}" transform="translate(${element.x + element.w * .03} ${element.y + element.h * .03}) scale(${sx * .94} ${sy * .94})" fill="none" stroke="${stroke}" stroke-width="${element.thickness}"${element.svgNonScalingStroke ? ` vector-effect="non-scaling-stroke"` : ""} opacity="${element.opacity ?? 1}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    if (element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "triangle" || element.type === "flowchart") {
      const outline = shapePathData(element);
      if (!outline) return "";
      const details = shapeDetailPathData(element);
      const detailStyle = `fill="none" stroke="${escapeXml(ink)}" opacity="${element.opacity ?? 1}" stroke-width="${element.thickness}" stroke-dasharray="${dash}" stroke-linecap="round" stroke-linejoin="round"`;
      const inner = element.lineStyle === "double" ? `<path d="${outline}" transform="translate(${element.x + element.w / 2} ${element.y + element.h / 2}) scale(.94) translate(${-element.x - element.w / 2} ${-element.y - element.h / 2})" fill="none" stroke="${escapeXml(ink)}" opacity="${strokeOpacity}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>` : "";
      return `<path d="${outline}" fill-rule="${shapeFillRule(element)}" ${style}/>${inner}${details ? `<path d="${details}" ${detailStyle}/>` : ""}`;
    }
    if (element.type === "line" || element.type === "arrow") {
      const routed = connectorForView(element); const path = connectorSvgPath(routed); const route = routed.type === "arrow" ? routed.arrowRoute ?? "straight" : routed.lineRoute ?? "straight";
      const headSvg = (tip: Point, direction: number, kind: ArrowHead) => {
        if (kind === "none") return "";
        if (kind === "dot") return `<circle cx="${tip.x}" cy="${tip.y}" r="${Math.max(3, routed.thickness * 1.15)}" fill="${ink}" opacity="${routed.opacity ?? 1}"/>`;
        const points = arrowHeadPoints(tip, direction, kind, routed.thickness); const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");
        if (kind === "solid" || kind === "thick" || kind === "diamond") return `<polygon points="${polygon}" fill="${ink}" stroke="${ink}" stroke-width="${routed.thickness}" opacity="${routed.opacity ?? 1}"/>`;
         if (kind === "open" || kind === "hollow" || kind === "open-diamond" || kind === "crow") return `<path d="${arrowHeadSvgPath(tip, direction, kind, routed.thickness)}" ${style}/>`;
        return `<path d="M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}" ${style}/>`;
      };
      return `<path d="${path}" ${style}/>${arrowHeadEntries(routed, route).map(({ tip, angle: direction, kind }) => headSvg(tip, direction, kind)).join("")}`;
    }
    return "";
  }

  function escapeXml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" })[char]!); }
  return elementToSvg;
}
