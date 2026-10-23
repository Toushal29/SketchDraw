import type { ArrowHead, Element, Point, ShapeElement, Theme } from "../../model";
import { isConnector, isLabelShape } from "../../operations";
import { shapeDetailPathData, shapeFillRule, shapePathData } from "../shapes/geometry";
import { arrowHeadEntries, arrowHeadPoints, arrowHeadSvgPath, connectorSvgPath } from "../connectors/geometry";
import { elementBounds } from "../canvas/bounds";
import { fontCss, themeInk } from "../canvas/rendering";
import { freehandSvg } from "../canvas/freehand-rendering";
import { modelComponentSvg } from "../components/model-component-renderer";
import { renderLibraryChartSvg } from "../components/chart-engine";
import { relationshipDisplayElement } from "../diagrams/relationships";
import { fitSchemaTableText, schemaTableColors, schemaTableContentInset, schemaTableMetrics, schemaTableRowLayout } from "../diagrams/schema-table-layout";
import { checklistRows, defaultNoteTitle, noteCardPalette, syntaxTokenColor, syntaxTokens } from "../../notes";

type SvgRendererPorts = {
  theme: () => Theme;
  isHidden?: (element: Element) => boolean;
  simpleComponentElement: (element: Element) => Element;
  connectorForView: (element: ShapeElement, sourceItems?: Element[]) => ShapeElement;
  labelSvg: (shape: ShapeElement) => string;
};

export function createSvgElementSerializer(ports: SvgRendererPorts) {
  const { theme, simpleComponentElement, connectorForView, labelSvg } = ports;
  const hidden = (element: Element) => ports.isHidden?.(element) ?? element.hidden === true;
  let modelClipSequence = 0;
  const emittedIds = new Map<string, number>();
function noteCardSvg(group: Extract<Element, { type: "group" }>): string {
    const meta = group.note; const background = group.elements.find((child): child is ShapeElement => child.type === "rectangle");
    if (!meta || !background) return "";
    const x = background.x, y = background.y, width = Math.abs(background.w), height = Math.abs(background.h), simple = true, palette = noteCardPalette(meta.kind, theme(), "simple");
    const title = escapeXml(meta.title || defaultNoteTitle(meta.kind)); const collapsed = meta.collapsed === true; const clipId = `note-${(group.id ?? crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "")}`;
    let body = "";
    if (!collapsed) {
      if (meta.kind === "checklist") {
        const rows = checklistRows(meta.content, width, meta.fontSize ?? 12); const done = rows.filter(row => row.done).length;
        body += `<text x="${x + 16}" y="${y + 40}" dominant-baseline="hanging" font-family="sans-serif" font-size="9" fill="${palette.muted}">${done} of ${rows.length} complete</text><rect x="${x + 16}" y="${y + 53}" width="${width - 32}" height="2" fill="${palette.rule}"/><rect x="${x + 16}" y="${y + 53}" width="${rows.length ? (width - 32) * done / rows.length : 0}" height="2" fill="${palette.check}"/>`;
        body += rows.map(row => { const boxX = x + row.boxX, boxY = y + row.top + Math.max(0, (row.height - 14) / 2), textY = y + row.top + (row.height - row.labelLines.length * row.lineHeight) / 2; return `<rect x="${boxX}" y="${boxY}" width="14" height="14" rx="1" fill="${row.done ? palette.check : palette.surface}" stroke="${row.done ? palette.check : palette.border}"/>${row.done ? `<path d="M ${boxX + 3} ${boxY + 7} l3 3 5 -6" fill="none" stroke="${simple ? palette.ink : "#fff"}" stroke-width="1.6"/>` : ""}${row.labelLines.map((line, index) => `<text x="${x + row.textX}" y="${textY + index * row.lineHeight}" dominant-baseline="hanging" font-family="sans-serif" font-size="${meta.fontSize ?? 12}" fill="${row.done ? palette.muted : palette.ink}">${escapeXml(line)}</text>`).join("")}`; }).join("");
      } else {
        let cursor = y + 41, inCode = false, language = "text", codeLines: string[] = [];
        const addCode = () => { const fontSize = meta.fontSize ?? 12; const max = Math.max(8, Math.floor((width - 42) / (fontSize * .62))); const lines = codeLines.flatMap(line => { const chunks: string[] = []; for (let index = 0; index < Math.max(1, line.length); index += max) chunks.push(line.slice(index, index + max)); return chunks; }); const blockHeight = Math.max(45, lines.length * fontSize * 1.5 + 26); body += `<rect x="${x + 10}" y="${cursor}" width="${width - 20}" height="${blockHeight}" rx="${simple ? 0 : 7}" fill="${simple ? palette.surface : "#202936"}" stroke="${simple ? palette.rule : "#344154"}"/><text x="${x + 20}" y="${cursor + 7}" dominant-baseline="hanging" font-family="sans-serif" font-size="9" font-weight="600" fill="${simple ? palette.muted : "#91a1b5"}">${escapeXml(language.toUpperCase())}</text>${lines.map((line, index) => { let column = 0; return syntaxTokens(line, language).map(token => { const rendered = `<text x="${x + 20 + column * fontSize * .62}" y="${cursor + 22 + index * fontSize * 1.5}" dominant-baseline="hanging" font-family="monospace" font-size="${fontSize}" fill="${syntaxTokenColor(token.color, theme(), "simple")}">${escapeXml(token.value)}</text>`; column += token.value.length; return rendered; }).join(""); }).join("")}`; cursor += blockHeight + 9; codeLines = []; inCode = false; };
        const maxChars = Math.max(8, Math.floor((width - 36) / ((meta.fontSize ?? 12) * .56)));
        for (const line of meta.content.split(/\r?\n/)) {
          const fence = /^\s*```\s*([\w+#.-]*)\s*$/.exec(line); if (fence) { if (!inCode) { inCode = true; language = fence[1] || "text"; } else addCode(); continue; }
          if (inCode) { codeLines.push(line); continue; } if (!line.trim()) { cursor += 8; continue; }
          const heading = /^(#{1,3})\s+(.*)$/.exec(line); const value = heading?.[2] ?? line; const size = heading ? (meta.fontSize ?? 12) + (4 - heading[1].length) * 2 : (meta.fontSize ?? 12);
          for (let index = 0; index < Math.max(1, value.length); index += maxChars) { body += `<text x="${x + 16}" y="${cursor}" dominant-baseline="hanging" font-family="sans-serif" font-size="${size}" font-weight="${heading ? 650 : 400}" fill="${palette.ink}">${escapeXml(value.slice(index, index + maxChars))}</text>`; cursor += size * 1.5; }
        }
        if (inCode) addCode();
      }
    }
    const summaryRows = collapsed && meta.kind === "checklist" ? checklistRows(meta.content, width, meta.fontSize ?? 12) : undefined;
    const summary = summaryRows ? `${summaryRows.filter(row => row.done).length} of ${summaryRows.length} tasks` : meta.content.split(/\r?\n/).find(line => line.trim() && !/^\s*```/.test(line))?.trim() || "Empty card";
    const toggleX = x + width - 26, toggleY = y + 7;
    const chevron = collapsed ? `M ${toggleX + 5} ${toggleY + 7} l4 4 4 -4` : `M ${toggleX + 5} ${toggleY + 11} l4 -4 4 4`;
    const separator = collapsed ? "" : `<path d="M ${x + 10} ${y + 33} H ${x + width - 10}" stroke="${palette.rule}"/>`;
    return `<g><defs><clipPath id="${clipId}"><rect x="${x + 8}" y="${y + 37}" width="${Math.max(0, width - 16)}" height="${Math.max(0, height - 45)}"/></clipPath></defs><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="3" fill="${palette.surface}" stroke="${palette.border}"/><text x="${x + 10}" y="${y + 9}" dominant-baseline="hanging" font-family="sans-serif" font-size="11" font-weight="600" fill="${palette.ink}">${title}</text>${collapsed ? `<text x="${x + 10}" y="${y + 25}" dominant-baseline="hanging" font-family="sans-serif" font-size="9" fill="${palette.muted}">${escapeXml(summary.slice(0, 80))}</text>` : ""}<rect x="${toggleX}" y="${toggleY}" width="18" height="18" rx="2" fill="${palette.surface}" stroke="${palette.border}"/><path d="${chevron}" fill="none" stroke="${palette.muted}" stroke-width="1.3"/>${separator}${collapsed ? "" : `<g clip-path="url(#${clipId})">${body}</g>`}</g>`;
  }

  function elementToSvg(element: Element): string {
    if (hidden(element)) return "";
    const content = serializeElement(element);
    if (!content || !element.id) return content;
    const base = `sketchdraw-${element.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`; const count = emittedIds.get(base) ?? 0; emittedIds.set(base, count + 1);
    return `<g id="${base}${count ? `-${count + 1}` : ""}" data-sketchdraw-type="${element.type}">${content}</g>`;
  }

  function serializeElement(element: Element): string {
    if (hidden(element)) return "";
    element = simpleComponentElement(element);
    if (element.type === "group") {
      if (element.note) return noteCardSvg(element);
      if (element.componentBounds) {
        const bounds = element.componentBounds; const cx = bounds.x + bounds.w / 2; const cy = bounds.y + bounds.h / 2;
        const component = element.libraryComponent?.kind.startsWith("viz-")
          ? renderLibraryChartSvg(element, theme())
          : element.libraryComponent ? modelComponentSvg(element) : "";
        const clipId = `model-${(element.id ?? "component").replace(/[^a-zA-Z0-9_-]/g, "")}-${++modelClipSequence}`;
        const clippedComponent = component ? `<defs><clipPath id="${clipId}"><rect x="${bounds.x}" y="${bounds.y}" width="${Math.max(0, bounds.w)}" height="${Math.max(0, bounds.h)}"/></clipPath></defs><g clip-path="url(#${clipId})">${component}</g>` : "";
        const children = element.container ? element.elements.map(elementToSvg).join("") : "";
        const borderStyle = element.container?.borderStyle ?? (element.container?.kind === "frame" ? "dashed" : "solid"); const borderWidth = element.container?.borderThickness ?? 1.5;
        const borderDash = borderStyle === "dashed" ? ` stroke-dasharray="${borderWidth * 4} ${borderWidth * 2.5}"` : borderStyle === "dotted" ? ` stroke-dasharray="${borderWidth} ${borderWidth * 2.2}"` : "";
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
          <text x="${layout.typeRight}" y="${middle + fontSize * .24}" text-anchor="end" font-family="monospace" font-size="${fontSize * .7}" fill="${colors.muted}">${escapeXml(fitSchemaTableText(column.dataType || "type", layout.typeWidth, fontSize * .7))}</text>`;
      }).join("");
      return `<g opacity="${element.opacity ?? 1}">
        <rect x="${left + 1}" y="${top + 2}" width="${element.w}" height="${element.h}" rx="4" fill="${theme() === "dark" ? "rgba(0,0,0,.28)" : "rgba(33,43,54,.14)"}"/>
        <rect x="${left}" y="${top}" width="${element.w}" height="${element.h}" rx="4" fill="${colors.surface}"/>
        <path d="M ${left + 4} ${top} H ${right - 4} Q ${right} ${top} ${right} ${top + 4} V ${top + titleHeight} H ${left} V ${top + 4} Q ${left} ${top} ${left + 4} ${top} Z" fill="${colors.header}"/>
        <line x1="${left}" y1="${top + titleHeight}" x2="${right}" y2="${top + titleHeight}" stroke="${colors.divider}"/>
        <text x="${left + contentInset}" y="${top + titleHeight * .68}" font-family="sans-serif" font-size="${fontSize * .96}" font-weight="600" fill="${colors.title}">${escapeXml(fitSchemaTableText(element.name, element.w - contentInset * 2, fontSize * .96))}</text>
        ${rows}
        <rect x="${left}" y="${top}" width="${element.w}" height="${element.h}" rx="4" fill="none" stroke="${colors.border}" stroke-width="1"/>
      </g>`;
    }
    if (element.type === "text") {
      const family = fontCss(element.fontFamily);
      const lines = element.text.split(/\r?\n/).map((line, index) => { const formatted = element.listType === "bullet" ? `• ${line}` : element.listType === "number" ? `${index + 1}. ${line}` : line; return `<tspan x="${element.x}" dy="${index === 0 ? 0 : element.fontSize * 1.25}">${escapeXml(formatted)}</tspan>`; }).join("");
      return `<text x="${element.x}" y="${element.y + element.fontSize}" fill="${escapeXml(themeInk(element.color, theme()))}" opacity="${element.opacity ?? 1}" font-size="${element.fontSize}" font-family="${family}" font-weight="${element.bold ? "700" : "400"}" font-style="${element.italic ? "italic" : "normal"}" text-decoration="${element.underline ? "underline" : "none"}" text-anchor="${element.textAlign === "center" ? "middle" : element.textAlign === "right" ? "end" : "start"}">${lines}</text>`;
    }
    const fillColor = "fillColor" in element ? element.fillColor : undefined;
    const dash = "lineStyle" in element && element.lineStyle === "dashed" ? `${element.thickness * 4} ${element.thickness * 2.5}` : "lineStyle" in element && element.lineStyle === "dotted" ? `${element.thickness} ${element.thickness * 2.2}` : "";
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
      return `<path d="${path}" transform="translate(${element.x} ${element.y}) scale(${sx} ${sy})" fill="${fill}" fill-opacity="${element.fillOpacity ?? 1}" fill-rule="${element.fillRule ?? "nonzero"}" stroke="${stroke}" stroke-width="${element.thickness}"${element.svgNonScalingStroke ? ` vector-effect="non-scaling-stroke"` : ""} opacity="${element.opacity ?? 1}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    if (element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "triangle" || element.type === "flowchart") {
      const outline = shapePathData(element);
      if (!outline) return "";
      const details = shapeDetailPathData(element);
      const detailStyle = `fill="none" stroke="${escapeXml(ink)}" opacity="${element.opacity ?? 1}" stroke-width="${element.thickness}" stroke-dasharray="${dash}" stroke-linecap="round" stroke-linejoin="round"`;
      return `<path d="${outline}" fill-rule="${shapeFillRule(element)}" ${style}/>${details ? `<path d="${details}" ${detailStyle}/>` : ""}`;
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
