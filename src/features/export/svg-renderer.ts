import type { ArrowHead, Element, Point, ShapeElement, Theme } from "../../model";
import { isConnector, isLabelShape } from "../../operations";
import { arrowHeadEntries, arrowHeadPoints, arrowHeadSvgPath, connectorSvgPath, flowchartSvgDetailPath, flowchartSvgPath } from "../canvas/geometry";
import { elementBounds } from "../canvas/bounds";
import { fontCss, themeInk } from "../canvas/rendering";
import { freehandSvg } from "../canvas/freehand-rendering";
import { modelComponentSvg } from "../components/model-component-renderer";
import { renderLibraryChartSvg } from "../components/chart-engine";
import { relationshipDisplayElement } from "../diagrams/relationships";
import { checklistRows, defaultNoteTitle, noteCardPalette, syntaxTokenColor, syntaxTokens } from "../../notes";

type SvgRendererPorts = {
  theme: () => Theme;
  simpleComponentElement: (element: Element) => Element;
  connectorForView: (element: ShapeElement, sourceItems?: Element[]) => ShapeElement;
  labelSvg: (shape: ShapeElement) => string;
};

export function createSvgElementSerializer(ports: SvgRendererPorts) {
  const { theme, simpleComponentElement, connectorForView, labelSvg } = ports;
  let modelClipSequence = 0;
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
    if (element.hidden) return "";
    element = simpleComponentElement(element);
    if (element.type === "group") {
      if (element.note) return noteCardSvg(element);
      if (element.componentBounds) {
        const bounds = element.componentBounds; const cx = bounds.x + bounds.w / 2; const cy = bounds.y + bounds.h / 2;
        const content = element.libraryComponent?.kind.startsWith("viz-")
          ? renderLibraryChartSvg(element, theme())
          : modelComponentSvg(element);
        const clipId = `model-${(element.id ?? "component").replace(/[^a-zA-Z0-9_-]/g, "")}-${++modelClipSequence}`;
        const clipped = `<defs><clipPath id="${clipId}"><rect x="${bounds.x}" y="${bounds.y}" width="${Math.max(0, bounds.w)}" height="${Math.max(0, bounds.h)}"/></clipPath></defs><g clip-path="url(#${clipId})">${content}</g>`;
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
    if (element.hidden) return "";
    if (element.type === "image") { const sx = element.cropX ?? 0; const sy = element.cropY ?? 0; const sw = element.cropW ?? element.sourceWidth ?? element.w; const sh = element.cropH ?? element.sourceHeight ?? element.h; return `<svg x="${element.x}" y="${element.y}" width="${element.w}" height="${element.h}" viewBox="${sx} ${sy} ${sw} ${sh}" preserveAspectRatio="none" opacity="${element.opacity ?? 1}"><image width="${element.sourceWidth ?? sw}" height="${element.sourceHeight ?? sh}" href="${element.dataUrl}"/></svg>`; }
    if (element.type === "schemaTable") {
      const simple = true; const dark = theme() === "dark"; const size = element.fontSize ?? 12; const headerHeight = Math.max(42, size * 2.8); const rowHeight = Math.max(30, size * 1.8);
      const ink = simple ? (dark ? "#b0b0b0" : "#555555") : (dark ? "#506174" : "#9badbf"); const surface = simple ? (dark ? "#202020" : "#ffffff") : (dark ? "#202a35" : "#fbfcfe"); const header = simple ? surface : (dark ? "#30465b" : "#e8f0f7"); const mainText = simple ? (dark ? "#f0f0f0" : "#262626") : (dark ? "#d8e8f5" : "#36556e");
      const rows = element.columns.map((column, index) => {
        const y = element.y + headerHeight + index * rowHeight;
        const badge = column.primaryKey || column.foreignTable ? '<rect x="' + (element.x + 11) + '" y="' + (y + 7) + '" width="24" height="16" rx="' + (simple ? 0 : 5) + '" fill="' + (simple ? (dark ? "#3a3a3a" : "#eeeeee") : column.primaryKey ? (dark ? "#6a5930" : "#f4e9c7") : (dark ? "#31556b" : "#e1eff6")) + '"/><text x="' + (element.x + 23) + '" y="' + (y + 18.5) + '" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="700" fill="' + (simple ? mainText : column.primaryKey ? (dark ? "#f0d58c" : "#826b2f") : (dark ? "#aed9ed" : "#436e85")) + '">' + (column.primaryKey ? "PK" : "FK") + "</text>" : "";
        return (index ? '<path d="M ' + (element.x + 10) + " " + y + " H " + (element.x + element.w - 10) + '" stroke="' + (simple ? ink : dark ? "#394856" : "#e6ebf0") + '"/>' : "") + badge + '<text x="' + (element.x + 44) + '" y="' + (y + rowHeight * .64) + '" font-family="monospace" font-size="' + (size * .86) + '" fill="' + (simple ? mainText : dark ? "#dbe5ee" : "#354759") + '">' + escapeXml(column.name) + '</text><text x="' + (element.x + element.w - 14) + '" y="' + (y + rowHeight * .64) + '" text-anchor="end" font-family="monospace" font-size="' + (size * .78) + '" fill="' + (simple ? mainText : dark ? "#a4b1bf" : "#768493") + '">' + escapeXml(column.dataType || "type") + "</text>";
      }).join("");
      const headerShape = simple ? '<rect x="' + element.x + '" y="' + element.y + '" width="' + element.w + '" height="' + headerHeight + '" fill="' + header + '"/>' : '<path d="M ' + (element.x + 10) + " " + element.y + " H " + (element.x + element.w - 10) + " Q " + (element.x + element.w) + " " + element.y + " " + (element.x + element.w) + " " + (element.y + 10) + " V " + (element.y + headerHeight) + " H " + element.x + " V " + (element.y + 10) + " Q " + element.x + " " + element.y + " " + (element.x + 10) + " " + element.y + ' Z" fill="' + header + '"/>';
      const schemaDetails = [element.indexes?.length ? `${element.indexes.length} idx` : "", element.constraints?.length ? `${element.constraints.length} constraints` : ""].filter(Boolean).join(" · ");
      const headingText = schemaDetails ? `${element.name} · ${schemaDetails}` : element.name;
      return '<g opacity="' + (element.opacity ?? 1) + '"><rect x="' + element.x + '" y="' + element.y + '" width="' + element.w + '" height="' + element.h + '" rx="' + (simple ? 0 : 10) + '" fill="' + surface + '" stroke="' + ink + '" stroke-width="1.4"/>' + headerShape + '<path d="M ' + element.x + " " + (element.y + headerHeight) + " H " + (element.x + element.w) + '" stroke="' + ink + '"/><text x="' + (element.x + 14) + '" y="' + (element.y + headerHeight * .62) + '" font-family="sans-serif" font-size="' + size + '" font-weight="600" fill="' + mainText + '">' + escapeXml(headingText) + "</text>" + rows + "</g>";
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
      return `<path d="${path}" transform="translate(${element.x} ${element.y}) scale(${sx} ${sy})" fill="${fill}" fill-opacity="${element.fillOpacity ?? 1}" fill-rule="${element.fillRule ?? "nonzero"}" stroke="${stroke}" stroke-width="${element.thickness}" vector-effect="non-scaling-stroke" opacity="${element.opacity ?? 1}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    if (element.type === "rectangle") { const width = Math.abs(element.w); const height = Math.abs(element.h); const radius = element.edgeStyle === "pill" ? Math.min(width, height) / 2 : element.edgeStyle === "rounded" ? Math.min(element.cornerRadius ?? 12, width / 2, height / 2) : 0; if (element.edgeStyle === "cut") { const x = Math.min(element.x, element.x + element.w); const y = Math.min(element.y, element.y + element.h); const c = Math.min(element.cornerRadius ?? 12, width / 2, height / 2); return `<path d="M ${x + c} ${y} H ${x + width - c} L ${x + width} ${y + c} V ${y + height - c} L ${x + width - c} ${y + height} H ${x + c} L ${x} ${y + height - c} V ${y + c} Z" ${style}/>`; } return `<rect x="${Math.min(element.x, element.x + element.w)}" y="${Math.min(element.y, element.y + element.h)}" width="${width}" height="${height}" rx="${radius}" ${style}/>`; }
    if (element.type === "diamond") return `<path d="M ${element.x + element.w / 2} ${element.y} L ${element.x + element.w} ${element.y + element.h / 2} L ${element.x + element.w / 2} ${element.y + element.h} L ${element.x} ${element.y + element.h / 2} Z" ${style}/>`;
    if (element.type === "triangle") { const left = Math.min(element.x, element.x + element.w); const right = Math.max(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const bottom = Math.max(element.y, element.y + element.h); return `<path d="M ${(left + right) / 2} ${top} L ${right} ${bottom} L ${left} ${bottom} Z" ${style}/>`; }
    if (element.type === "circle") return `<ellipse cx="${element.x + element.w / 2}" cy="${element.y + element.h / 2}" rx="${Math.abs(element.w / 2)}" ry="${Math.abs(element.h / 2)}" ${style}/>`;
    if (element.type === "flowchart") {
      const detail = flowchartSvgDetailPath(element);
      const detailStyle = `fill="none" stroke="${escapeXml(ink)}" opacity="${element.opacity ?? 1}" stroke-width="${element.thickness}" stroke-dasharray="${dash}" stroke-linecap="round" stroke-linejoin="round"`;
      return `<path d="${flowchartSvgPath(element)}" fill-rule="evenodd" ${style}/>${detail ? `<path d="${detail}" ${detailStyle}/>` : ""}`;
    }
    if (element.type === "line" || element.type === "arrow") {
      const routed = connectorForView(element); const path = connectorSvgPath(routed); const route = routed.type === "arrow" ? routed.arrowRoute ?? "straight" : routed.lineRoute ?? "straight";
      const shift = routed.lineStyle === "double" ? Math.max(2.5, routed.thickness * 1.2) : 0; const first = routed.routePoints?.[0] ?? { x: routed.x + routed.w, y: routed.y + routed.h }; const normal = { x: -(first.y - routed.y) / Math.max(1, Math.hypot(first.x - routed.x, first.y - routed.y)), y: (first.x - routed.x) / Math.max(1, Math.hypot(first.x - routed.x, first.y - routed.y)) };
      const paths = shift ? `<path d="${path}" transform="translate(${normal.x * shift} ${normal.y * shift})" ${style}/><path d="${path}" transform="translate(${-normal.x * shift} ${-normal.y * shift})" ${style}/>` : `<path d="${path}" ${style}/>`;
      const headSvg = (tip: Point, direction: number, kind: ArrowHead) => {
        if (kind === "none") return "";
        if (kind === "dot") return `<circle cx="${tip.x}" cy="${tip.y}" r="${Math.max(3, routed.thickness * 1.15)}" fill="${ink}" opacity="${routed.opacity ?? 1}"/>`;
        const points = arrowHeadPoints(tip, direction, kind, routed.thickness); const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");
        if (kind === "solid" || kind === "thick" || kind === "diamond") return `<polygon points="${polygon}" fill="${ink}" stroke="${ink}" stroke-width="${routed.thickness}" opacity="${routed.opacity ?? 1}"/>`;
         if (kind === "open" || kind === "hollow" || kind === "open-diamond" || kind === "crow") return `<path d="${arrowHeadSvgPath(tip, direction, kind, routed.thickness)}" ${style}/>`;
        return `<path d="M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}" ${style}/>`;
      };
      return `${paths}${arrowHeadEntries(routed, route).map(({ tip, angle: direction, kind }) => headSvg(tip, direction, kind)).join("")}`;
    }
    return "";
  }

  function escapeXml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" })[char]!); }
  return elementToSvg;
}
