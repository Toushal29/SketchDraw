import { SKETCH_FORMAT_VERSION } from "../../model";
import type { ArchitectureMetadata, ArrowHead, ArrowRoute, Binding, EdgeStyle, Element, FlowchartShape, FontFamily, GroupElement, LayerFlags, LineRoute, MermaidMetadata, NoteKind, Point, RelationshipDirection, RelationshipType, SchemaConstraint, SchemaField, SchemaIndex, ShapeElement, ShapeLabel, SketchFile, SketchPage, StrokeStyle, StrokePoint, StrideThreatCategory, TransportSecurity } from "../../model";
import { validReferences } from "../../operations";
import { curveControlPoints } from "../canvas/geometry";
import { FLOWCHART_SHAPES } from "../diagrams/config";
import { normalizeProjectWorkspace } from "../project/project-data";
import { normalizeLegacyLibraryData } from "./legacy-library-data";
import { MAX_DOCUMENT_STROKE_POINTS, MAX_STROKE_POINTS } from "../canvas/stroke-limits";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isColor(value: unknown): value is string {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value);
}

export function isEmbeddedRasterImage(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z\d+/]+={0,2}$/i.test(value);
}

export function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function normalizeArchitectureMetadata(value: unknown): ArchitectureMetadata | undefined {
  if (!isRecord(value)) return undefined;
  const text = (key: string, max: number) => typeof value[key] === "string" && value[key].trim() ? value[key].trim().slice(0, max) : undefined;
  const criticality = ["low", "medium", "high", "critical"].includes(String(value.criticality)) ? value.criticality as ArchitectureMetadata["criticality"] : undefined;
  const normalized: ArchitectureMetadata = {
    ...(text("serviceKey", 120) ? { serviceKey: text("serviceKey", 120) } : {}),
    ...(text("owner", 120) ? { owner: text("owner", 120) } : {}),
    ...(criticality ? { criticality } : {}),
    ...(text("slo", 120) ? { slo: text("slo", 120) } : {}),
    ...(text("runbook", 500) ? { runbook: text("runbook", 500) } : {}),
    ...(text("environment", 80) ? { environment: text("environment", 80) } : {}),
    ...(text("region", 100) ? { region: text("region", 100) } : {}),
    ...(text("availabilityZone", 100) ? { availabilityZone: text("availabilityZone", 100) } : {}),
    ...(text("subnet", 120) ? { subnet: text("subnet", 120) } : {}),
    ...(text("cidr", 64) ? { cidr: text("cidr", 64) } : {}),
    ...(text("ipAddress", 64) ? { ipAddress: text("ipAddress", 64) } : {}),
  };
  return Object.keys(normalized).length ? normalized : undefined;
}
const MAX_ELEMENT_DEPTH = 64;
const MAX_ELEMENTS_PER_PAGE = 20_000;
const MAX_DOCUMENT_ELEMENT_NODES = 100_000;
export const MAX_CANVAS_TEXT_LENGTH = 100_000;
type ElementParseBudget = { remaining: number; remainingStrokePoints: number };
type ElementNodeBudget = { remaining: number };

export function normalizeElement(value: unknown): Element | undefined {
  return normalizeElementWithinBudget(value, 0, { remaining: MAX_DOCUMENT_ELEMENT_NODES, remainingStrokePoints: MAX_DOCUMENT_STROKE_POINTS });
}

function normalizeElementWithinBudget(value: unknown, depth: number, budget: ElementParseBudget): Element | undefined {
  if (depth > MAX_ELEMENT_DEPTH || budget.remaining <= 0) return undefined;
  budget.remaining -= 1;
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.id !== "string" || !value.id || value.id.length > 100) return undefined;
  const flags: LayerFlags = {
    id: value.id,
    hidden: typeof value.hidden === "boolean" ? value.hidden : false,
    locked: typeof value.locked === "boolean" ? value.locked : false,
    rotation: finite(value.rotation) ? value.rotation : 0,
    ...(typeof value.layerName === "string" && value.layerName.trim().length <= 80 ? { layerName: value.layerName.trim() } : {}),
    ...(typeof value.componentId === "string" ? { componentId: value.componentId } : {}),
    ...(typeof value.componentRole === "string" ? { componentRole: value.componentRole } : {}),
    ...(typeof value.catalogId === "string" && value.catalogId.length <= 100 ? { catalogId: value.catalogId } : {}),
    ...(typeof value.pageLinkId === "string" && value.pageLinkId.length <= 100 ? { pageLinkId: value.pageLinkId } : {}),
    ...(Array.isArray(value.strideThreats) ? { strideThreats: [...new Set(value.strideThreats.filter((threat): threat is StrideThreatCategory => ["spoofing", "tampering", "repudiation", "information-disclosure", "denial-of-service", "elevation-of-privilege"].includes(String(threat))))].slice(0, 6) } : {}),
    ...(normalizeArchitectureMetadata(value.architecture) ? { architecture: normalizeArchitectureMetadata(value.architecture) } : {}),
  };
  if (value.type === "group") {
    if (!Array.isArray(value.elements) || value.elements.length > MAX_ELEMENTS_PER_PAGE) return undefined;
    const children = value.elements.map(child => normalizeElementWithinBudget(child, depth + 1, budget));
    if (children.some((child) => !child)) return undefined;
    const note = isRecord(value.note) && ["note", "sticky", "checklist"].includes(String(value.note.kind)) && typeof value.note.content === "string" && value.note.content.length <= 50000
      && (value.note.title === undefined || typeof value.note.title === "string" && value.note.title.length <= 120)
      && (value.note.width === undefined || finite(value.note.width) && value.note.width >= 180 && value.note.width <= 4000)
      && (value.note.height === undefined || finite(value.note.height) && value.note.height >= 100 && value.note.height <= 1_000_000)
      && (value.note.fontSize === undefined || finite(value.note.fontSize) && value.note.fontSize >= 8 && value.note.fontSize <= 32)
      && (value.note.collapsed === undefined || typeof value.note.collapsed === "boolean")
      ? { kind: value.note.kind as NoteKind, content: value.note.content, ...(typeof value.note.title === "string" ? { title: value.note.title } : {}), ...(finite(value.note.width) ? { width: value.note.width } : {}), ...(finite(value.note.height) ? { height: value.note.height } : {}), ...(finite(value.note.fontSize) ? { fontSize: Math.round(value.note.fontSize) } : {}), ...(typeof value.note.collapsed === "boolean" ? { collapsed: value.note.collapsed } : {}) } : undefined;
    const mermaid: MermaidMetadata | undefined = isRecord(value.mermaid) && typeof value.mermaid.source === "string" && value.mermaid.source.length <= 100_000
      && (value.mermaid.format === undefined || value.mermaid.format === "mermaid" || value.mermaid.format === "plantuml")
      ? { source: value.mermaid.source, ...(value.mermaid.format ? { format: value.mermaid.format } : {}) } : undefined;
    const rawComponent = isRecord(value.libraryComponent) ? value.libraryComponent : undefined;
    const iconSvg = rawComponent && typeof rawComponent.iconSvg === "string" && rawComponent.iconSvg.length <= 100_000 && !/<script\b|\son[a-z]+\s*=|javascript:/i.test(rawComponent.iconSvg) ? rawComponent.iconSvg : undefined;
    const iconViewBox = rawComponent && typeof rawComponent.iconViewBox === "string" && /^-?[\d.]+\s+-?[\d.]+\s+[\d.]+\s+[\d.]+$/.test(rawComponent.iconViewBox) ? rawComponent.iconViewBox : undefined;
    const rawChartData = rawComponent && isRecord(rawComponent.chartData) ? rawComponent.chartData : undefined;
    const chartData = rawChartData && Array.isArray(rawChartData.labels) && Array.isArray(rawChartData.values)
      && rawChartData.labels.length > 0 && rawChartData.labels.length <= 20 && rawChartData.values.length === rawChartData.labels.length
      && rawChartData.labels.every(label => typeof label === "string" && label.length <= 60)
      && rawChartData.values.every(number => finite(number) && Math.abs(number) <= 1_000_000_000)
      && ["title", "xAxisLabel", "yAxisLabel"].every(key => rawChartData[key] === undefined || typeof rawChartData[key] === "string" && (rawChartData[key] as string).length <= 80)
      ? { labels: rawChartData.labels as string[], values: rawChartData.values as number[], ...(typeof rawChartData.title === "string" ? { title: rawChartData.title } : {}), ...(typeof rawChartData.xAxisLabel === "string" ? { xAxisLabel: rawChartData.xAxisLabel } : {}), ...(typeof rawChartData.yAxisLabel === "string" ? { yAxisLabel: rawChartData.yAxisLabel } : {}) } : undefined;
    const componentAppearance = rawComponent && (rawComponent.appearance === "simple" || rawComponent.appearance === "modern") ? rawComponent.appearance as "simple" | "modern" : undefined;
    const renderStyle = rawComponent?.renderStyle === "clean" ? "clean" as const : undefined;
    const trendDirection = rawComponent && (rawComponent.trendDirection === "up" || rawComponent.trendDirection === "down" || rawComponent.trendDirection === "steady") ? rawComponent.trendDirection as "up" | "down" | "steady" : undefined;
    const formOptions = rawComponent && ["form-radio", "form-select", "form-button", "form-checkbox"].includes(String(rawComponent.kind)) && Array.isArray(rawComponent.formOptions)
      && rawComponent.formOptions.length > 0 && rawComponent.formOptions.length <= 12
      && rawComponent.formOptions.every(option => typeof option === "string" && option.length <= 120)
      ? rawComponent.formOptions as string[] : undefined;
    const formTitle = rawComponent && typeof rawComponent.formTitle === "string" && rawComponent.formTitle.length <= 80 ? rawComponent.formTitle : undefined;
    const formStates = rawComponent && Array.isArray(rawComponent.formStates) && rawComponent.formStates.length <= 12 && rawComponent.formStates.every(state => typeof state === "boolean") ? rawComponent.formStates as boolean[] : undefined;
    const rawStyleOverrides = rawComponent && isRecord(rawComponent.styleOverrides) ? rawComponent.styleOverrides : undefined;
    const styleOverrides = rawStyleOverrides && (rawStyleOverrides.color === undefined || isColor(rawStyleOverrides.color)) && (rawStyleOverrides.fillColor === undefined || rawStyleOverrides.fillColor === null || isColor(rawStyleOverrides.fillColor)) && (rawStyleOverrides.fillOpacity === undefined || finite(rawStyleOverrides.fillOpacity) && rawStyleOverrides.fillOpacity >= 0 && rawStyleOverrides.fillOpacity <= 1)
      ? { ...(typeof rawStyleOverrides.color === "string" ? { color: rawStyleOverrides.color } : {}), ...(rawStyleOverrides.fillColor === null || typeof rawStyleOverrides.fillColor === "string" ? { fillColor: rawStyleOverrides.fillColor as string | null } : {}), ...(finite(rawStyleOverrides.fillOpacity) ? { fillOpacity: rawStyleOverrides.fillOpacity } : {}) } : undefined;
    const rawTextStyle = rawComponent && isRecord(rawComponent.textStyle) ? rawComponent.textStyle : undefined;
    const validFontFamilies = ["sans", "hand", "serif", "mono", "rounded", "display"];
    const validTextAlignments = ["left", "center", "right", "justify"];
    const textStyle = rawTextStyle && (rawTextStyle.fontSize === undefined || finite(rawTextStyle.fontSize) && rawTextStyle.fontSize >= 8 && rawTextStyle.fontSize <= 160)
      && (rawTextStyle.fontFamily === undefined || typeof rawTextStyle.fontFamily === "string" && validFontFamilies.includes(rawTextStyle.fontFamily))
      && ["bold", "italic", "underline"].every(key => rawTextStyle[key] === undefined || typeof rawTextStyle[key] === "boolean")
      && (rawTextStyle.textAlign === undefined || typeof rawTextStyle.textAlign === "string" && validTextAlignments.includes(rawTextStyle.textAlign))
      ? { ...(finite(rawTextStyle.fontSize) ? { fontSize: rawTextStyle.fontSize } : {}), ...(typeof rawTextStyle.fontFamily === "string" ? { fontFamily: rawTextStyle.fontFamily as "sans" | "hand" | "serif" | "mono" | "rounded" | "display" } : {}), ...(typeof rawTextStyle.bold === "boolean" ? { bold: rawTextStyle.bold } : {}), ...(typeof rawTextStyle.italic === "boolean" ? { italic: rawTextStyle.italic } : {}), ...(typeof rawTextStyle.underline === "boolean" ? { underline: rawTextStyle.underline } : {}), ...(typeof rawTextStyle.textAlign === "string" ? { textAlign: rawTextStyle.textAlign as "left" | "center" | "right" | "justify" } : {}) } : undefined;
    const componentBoundsValue = isRecord(value.componentBounds) && finite(value.componentBounds.x) && finite(value.componentBounds.y) && finite(value.componentBounds.w) && value.componentBounds.w >= 2 && value.componentBounds.w <= 1_000_000 && finite(value.componentBounds.h) && value.componentBounds.h >= 2 && value.componentBounds.h <= 1_000_000
      ? { x: value.componentBounds.x, y: value.componentBounds.y, w: value.componentBounds.w, h: value.componentBounds.h } : undefined;
    const libraryComponent = rawComponent && typeof rawComponent.kind === "string" && rawComponent.kind.length <= 100
      && (rawComponent.label === undefined || typeof rawComponent.label === "string" && rawComponent.label.length <= 120)
      && (rawComponent.iconSvg === undefined || iconSvg !== undefined)
      && (rawComponent.iconViewBox === undefined || iconViewBox !== undefined)
      && (iconSvg === undefined || iconViewBox !== undefined)
      && (rawComponent.portCount === undefined || finite(rawComponent.portCount) && rawComponent.portCount >= 1 && rawComponent.portCount <= 32)
      && (rawComponent.laneCount === undefined || finite(rawComponent.laneCount) && rawComponent.laneCount >= 2 && rawComponent.laneCount <= 8)
      && (rawComponent.formState === undefined || typeof rawComponent.formState === "boolean")
      && (rawComponent.formStates === undefined || formStates !== undefined)
      && (rawComponent.styleOverrides === undefined || styleOverrides !== undefined)
      && (rawComponent.textStyle === undefined || textStyle !== undefined)
      && (rawComponent.selectedOption === undefined || finite(rawComponent.selectedOption) && rawComponent.selectedOption >= 0 && rawComponent.selectedOption < 20)
      && (rawComponent.chartData === undefined || chartData)
      && (rawComponent.appearance === undefined || componentAppearance !== undefined)
      && (rawComponent.formOptions === undefined || formOptions !== undefined)
      && (rawComponent.formTitle === undefined || formTitle !== undefined)
      && (rawComponent.trendDirection === undefined || trendDirection !== undefined)
      && (rawComponent.renderStyle === undefined || renderStyle !== undefined)
      ? { kind: rawComponent.kind, ...(typeof rawComponent.label === "string" ? { label: rawComponent.label } : {}), ...(renderStyle ? { renderStyle } : {}), ...(iconSvg !== undefined ? { iconSvg, iconViewBox } : {}), ...(finite(rawComponent.portCount) ? { portCount: Math.round(rawComponent.portCount) } : {}), ...(finite(rawComponent.laneCount) ? { laneCount: Math.round(rawComponent.laneCount) } : {}), ...(finite(rawComponent.durationMinutes) && rawComponent.durationMinutes >= 0 && rawComponent.durationMinutes <= 100000 ? { durationMinutes: rawComponent.durationMinutes } : {}), ...(formTitle !== undefined ? { formTitle } : {}), ...(typeof rawComponent.formState === "boolean" ? { formState: rawComponent.formState } : {}), ...(formStates ? { formStates } : {}), ...(finite(rawComponent.selectedOption) ? { selectedOption: Math.floor(rawComponent.selectedOption) } : {}), ...(formOptions ? { formOptions } : {}), ...(chartData ? { chartData } : {}), ...(trendDirection ? { trendDirection } : {}), ...(componentAppearance ? { appearance: componentAppearance } : {}), ...(styleOverrides ? { styleOverrides } : {}), ...(textStyle ? { textStyle } : {}) } : undefined;
    if ((value.note !== undefined && !note) || (value.mermaid !== undefined && !mermaid) || (value.libraryComponent !== undefined && !libraryComponent) || (value.componentBounds !== undefined && !componentBoundsValue) || (componentBoundsValue && !libraryComponent) || (note && mermaid) || (libraryComponent && (note || mermaid))) return undefined;
    return { type: "group", ...flags, elements: children as Element[], ...(componentBoundsValue ? { componentBounds: componentBoundsValue } : {}), note, mermaid, libraryComponent };
  }
  if (value.type === "freehand") {
    if (!Array.isArray(value.points) || value.points.length > MAX_STROKE_POINTS || value.points.length > budget.remainingStrokePoints || !isColor(value.color) || !finite(value.thickness) || value.thickness <= 0 || !value.points.every((point) => isRecord(point) && finite(point.x) && finite(point.y))) return undefined;
    budget.remainingStrokePoints -= value.points.length;
    const thickness = Math.max(1, Math.round(value.thickness));
    const points: StrokePoint[] = value.points.map((point) => ({ x: (point as Record<string, unknown>).x as number, y: (point as Record<string, unknown>).y as number, ...(finite((point as Record<string, unknown>).pressure) ? { pressure: Math.max(0, Math.min(1, (point as Record<string, unknown>).pressure as number)) } : {}), ...(finite((point as Record<string, unknown>).tiltX) ? { tiltX: Math.max(-90, Math.min(90, (point as Record<string, unknown>).tiltX as number)) } : {}), ...(finite((point as Record<string, unknown>).tiltY) ? { tiltY: Math.max(-90, Math.min(90, (point as Record<string, unknown>).tiltY as number)) } : {}), ...(finite((point as Record<string, unknown>).orientation) ? { orientation: ((point as Record<string, unknown>).orientation as number % 360 + 360) % 360 } : {}) }));
    return { type: "freehand", ...flags, points, color: value.color, thickness, opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1 };
  }
  if (value.type === "text") {
    if (!finite(value.x) || !finite(value.y) || typeof value.text !== "string" || value.text.length > MAX_CANVAS_TEXT_LENGTH || !isColor(value.color) || !finite(value.fontSize) || value.fontSize < 8) return undefined;
    const fontFamily: FontFamily = ["hand", "serif", "mono", "rounded", "display"].includes(String(value.fontFamily)) ? value.fontFamily as FontFamily : "sans";
    const textAlign = value.textAlign === "center" || value.textAlign === "right" || value.textAlign === "justify" ? value.textAlign : "left";
    const listType = value.listType === "bullet" || value.listType === "number" ? value.listType : "none";
    return { type: "text", ...flags, x: value.x, y: value.y, text: value.text, color: value.color, fontSize: Math.round(value.fontSize), fontFamily, bold: value.bold === true, italic: value.italic === true, underline: value.underline === true, textAlign, listType, opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1 };
  }
  if (value.type === "image") {
    if (!finite(value.x) || !finite(value.y) || !finite(value.w) || value.w <= 0 || !finite(value.h) || value.h <= 0 || !isEmbeddedRasterImage(value.dataUrl)) return undefined;
    const sourceWidth = finite(value.sourceWidth) && value.sourceWidth > 0 ? value.sourceWidth : value.w;
    const sourceHeight = finite(value.sourceHeight) && value.sourceHeight > 0 ? value.sourceHeight : value.h;
    const cropX = finite(value.cropX) ? value.cropX : 0; const cropY = finite(value.cropY) ? value.cropY : 0;
    const cropW = finite(value.cropW) ? value.cropW : sourceWidth; const cropH = finite(value.cropH) ? value.cropH : sourceHeight;
    if (cropX < 0 || cropY < 0 || cropW <= 0 || cropH <= 0 || cropX + cropW > sourceWidth || cropY + cropH > sourceHeight) return undefined;
    let previewUrl: string | undefined;
    if (typeof value.previewUrl === "string" && value.previewUrl.length <= 2048) {
      try { const url = new URL(value.previewUrl); if (url.protocol === "https:" && !url.username && !url.password) previewUrl = url.toString(); } catch { /* Ignore malformed or non-HTTPS preview links. */ }
    }
    return { type: "image", ...flags, x: value.x, y: value.y, w: value.w, h: value.h, dataUrl: value.dataUrl, sourceWidth, sourceHeight, cropX, cropY, cropW, cropH, opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1, ...(previewUrl ? { previewUrl } : {}) };
  }
  if (value.type === "schemaTable") {
    if (!finite(value.x) || !finite(value.y) || !finite(value.w) || value.w < 120 || !finite(value.h) || value.h < 45 || typeof value.name !== "string" || !value.name.trim() || value.name.length > 200 || typeof value.schemaDiagramId !== "string" || !value.schemaDiagramId || typeof value.schemaSource !== "string" || value.schemaSource.length > 500_000 || !Array.isArray(value.columns) || !value.columns.length || value.columns.length > 500) return undefined;
    const columns: SchemaField[] = [];
    for (let index = 0; index < value.columns.length; index++) {
      const raw = value.columns[index];
      if (!isRecord(raw) || typeof raw.name !== "string" || !raw.name.trim() || raw.name.length > 200 || typeof raw.dataType !== "string" || raw.dataType.length > 200) return undefined;
      const id = typeof raw.id === "string" && raw.id.length <= 100 ? raw.id : `${value.id}:column:${index}`;
      columns.push({ id, name: raw.name, dataType: raw.dataType, primaryKey: raw.primaryKey === true, foreignTable: typeof raw.foreignTable === "string" ? raw.foreignTable.slice(0, 200) : undefined, foreignColumn: typeof raw.foreignColumn === "string" ? raw.foreignColumn.slice(0, 200) : undefined, nullable: raw.nullable !== false });
    }
    const indexes: SchemaIndex[] = Array.isArray(value.indexes) ? value.indexes.slice(0, 200).flatMap(raw => {
      if (!isRecord(raw) || typeof raw.name !== "string" || raw.name.length > 200 || !Array.isArray(raw.columns) || raw.columns.length > 100 || !raw.columns.every(column => typeof column === "string" && column.length <= 200)) return [];
      return [{ name: raw.name, columns: raw.columns as string[], unique: raw.unique === true, ...(typeof raw.expression === "string" && raw.expression.length <= 2000 ? { expression: raw.expression } : {}) }];
    }) : [];
    const constraints: SchemaConstraint[] = Array.isArray(value.constraints) ? value.constraints.slice(0, 200).flatMap(raw => {
      if (!isRecord(raw) || !["unique", "check", "foreign-key", "primary-key"].includes(String(raw.kind))) return [];
      const columns = Array.isArray(raw.columns) && raw.columns.length <= 100 && raw.columns.every(column => typeof column === "string" && column.length <= 200) ? raw.columns as string[] : undefined;
      return [{ kind: raw.kind as SchemaConstraint["kind"], ...(typeof raw.name === "string" ? { name: raw.name.slice(0, 200) } : {}), ...(columns ? { columns } : {}), ...(typeof raw.expression === "string" && raw.expression.length <= 2000 ? { expression: raw.expression } : {}), ...(typeof raw.referencedTable === "string" ? { referencedTable: raw.referencedTable.slice(0, 200) } : {}), ...(Array.isArray(raw.referencedColumns) && raw.referencedColumns.length <= 100 && raw.referencedColumns.every(column => typeof column === "string" && column.length <= 200) ? { referencedColumns: raw.referencedColumns as string[] } : {}) }];
    }) : [];
    const fontSize = finite(value.fontSize) ? Math.max(8, Math.min(48, Math.round(value.fontSize))) : 14; const neededHeight = Math.max(42, fontSize * 2.8) + columns.length * Math.max(30, fontSize * 1.8);
    const neededWidth = Math.max(180, ...columns.map(column => (column.name.length + (column.dataType ?? "type").length) * fontSize * .36 + 80));
    return { type: "schemaTable", ...flags, x: value.x, y: value.y, w: Math.max(value.w, neededWidth), h: Math.max(value.h, neededHeight), name: value.name, columns, ...(indexes.length ? { indexes } : {}), ...(constraints.length ? { constraints } : {}), schemaDiagramId: value.schemaDiagramId, schemaSource: value.schemaSource, fontSize, opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1 };
  }
  if (value.type === "svgPath") {
    if (!finite(value.x) || !finite(value.y) || !finite(value.w) || value.w <= 0 || !finite(value.h) || value.h <= 0 || !isColor(value.color) || !finite(value.thickness) || value.thickness <= 0 || typeof value.pathData !== "string" || !value.pathData.trim() || value.pathData.length > 500_000 || !finite(value.pathWidth) || value.pathWidth <= 0 || value.pathWidth > 100_000 || !finite(value.pathHeight) || value.pathHeight <= 0 || value.pathHeight > 100_000 || (value.fillRule !== undefined && value.fillRule !== "nonzero" && value.fillRule !== "evenodd")) return undefined;
    if (!/^[\d\s.,+\-eEmlhvcsqtazMLHVCSQTAZ]+$/.test(value.pathData)) return undefined;
    return { type: "svgPath", ...flags, x: value.x, y: value.y, w: value.w, h: value.h, color: value.color, thickness: Math.max(1, Math.round(value.thickness)), pathData: value.pathData, pathWidth: value.pathWidth, pathHeight: value.pathHeight, fillRule: value.fillRule === "evenodd" ? "evenodd" : "nonzero", svgStroke: value.svgStroke !== false, ...(isColor(value.fillColor) ? { fillColor: value.fillColor, fillOpacity: finite(value.fillOpacity) ? Math.max(0, Math.min(1, value.fillOpacity)) : 1 } : {}), opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1 };
  }
  if (["rectangle", "circle", "diamond", "triangle", "flowchart", "line", "arrow"].includes(value.type)) {
    if (!finite(value.x) || !finite(value.y) || !finite(value.w) || !finite(value.h) || !isColor(value.color) || !finite(value.thickness) || value.thickness <= 0) return undefined;
    if (value.schemaDiagramId !== undefined && typeof value.schemaDiagramId !== "string") return undefined;
    const lineStyle: StrokeStyle = ["dashed", "dotted", "double"].includes(String(value.lineStyle)) ? value.lineStyle as StrokeStyle : "solid";
    const edgeStyle: EdgeStyle = ["rounded", "pill", "cut"].includes(String(value.edgeStyle)) ? value.edgeStyle as EdgeStyle : "sharp";
    const fillColor = isColor(value.fillColor) ? value.fillColor : undefined;
    const fillOpacity = finite(value.fillOpacity) ? Math.max(0, Math.min(1, value.fillOpacity)) : 0.2;
    const validHead = (head: unknown): head is ArrowHead => ["none", "open", "solid", "hollow", "thick", "dot", "diamond", "open-diamond", "bar", "crow"].includes(String(head));
    const flowchartShape: FlowchartShape = FLOWCHART_SHAPES.some(shape => shape.value === value.flowchartShape) ? value.flowchartShape as FlowchartShape : "process";
    const lineRoute: LineRoute = ["curve", "curve2", "curve3", "multi"].includes(String(value.lineRoute)) ? value.lineRoute as LineRoute : "straight";
    const thickness = Math.max(1, Math.round(value.thickness));
    const cornerRadius = finite(value.cornerRadius) ? Math.max(0, Math.min(100, value.cornerRadius)) : undefined;
    const arrowRoute: ArrowRoute = ["elbow", "forked", "loop", "jagged"].includes(String(value.arrowRoute)) ? value.arrowRoute as ArrowRoute : "straight";
    const binding = (raw: unknown): Binding | undefined => isRecord(raw) && typeof raw.elementId === "string" && isRecord(raw.anchor) && finite(raw.anchor.x) && finite(raw.anchor.y) && raw.anchor.x >= 0 && raw.anchor.x <= 1 && raw.anchor.y >= 0 && raw.anchor.y <= 1 && (raw.rowId === undefined || typeof raw.rowId === "string") ? { elementId: raw.elementId, anchor: { x: raw.anchor.x, y: raw.anchor.y }, ...(typeof raw.rowId === "string" ? { rowId: raw.rowId } : {}) } : undefined;
    if ((value.startBinding && !binding(value.startBinding)) || (value.endBinding && !binding(value.endBinding))) return undefined;
    const forkBranch = (raw: unknown) => {
      if (raw === undefined) return undefined;
      if (!isRecord(raw)) return null;
      const end = raw.end === undefined ? undefined : isRecord(raw.end) && finite(raw.end.x) && finite(raw.end.y) ? { x: raw.end.x, y: raw.end.y } : null;
      const routePoints = raw.routePoints === undefined ? undefined : Array.isArray(raw.routePoints) && raw.routePoints.length <= 100 && raw.routePoints.every(p => isRecord(p) && finite(p.x) && finite(p.y)) ? raw.routePoints as Point[] : null;
      const endBinding = raw.endBinding === undefined ? undefined : binding(raw.endBinding) ?? null;
      if (end === null || routePoints === null || endBinding === null) return null;
      if (raw.endHead !== undefined && !validHead(raw.endHead)) return null;
      return { end, routePoints, endHead: raw.endHead as ArrowHead | undefined, endBinding: endBinding as Binding | undefined };
    };
    const forkUpper = forkBranch(value.forkUpper); const forkLower = forkBranch(value.forkLower);
    if (forkUpper === null || forkLower === null) return undefined;
    if (value.routePoints !== undefined && (!Array.isArray(value.routePoints) || value.routePoints.length > 100 || !value.routePoints.every(p => isRecord(p) && finite(p.x) && finite(p.y)))) return undefined;
    if (value.routeWaypoints !== undefined && (!Array.isArray(value.routeWaypoints) || value.routeWaypoints.length > 100 || !value.routeWaypoints.every(p => isRecord(p) && finite(p.x) && finite(p.y)))) return undefined;
    const labelText = value.label === undefined ? undefined : normalizeElementWithinBudget({ ...(isRecord(value.label) ? value.label : {}), type: "text", id: "label", x: 0, y: 0 }, depth + 1, budget);
    if (value.label !== undefined && labelText?.type !== "text") return undefined;
    const label: ShapeLabel | undefined = labelText?.type === "text" ? { ...labelText, verticalAlign: isRecord(value.label) && (value.label.verticalAlign === "top" || value.label.verticalAlign === "bottom") ? value.label.verticalAlign : "middle" } : undefined;
    const storedRoutePoints = value.routePoints as Point[] | undefined;
    const straightOnly = (value.type === "line" || value.type === "arrow") && value.straightOnly === true;
    const autoRoute = !straightOnly && (value.type === "line" || value.type === "arrow") && value.autoRoute === true;
    const x = value.x as number; const y = value.y as number; const w = value.w as number; const h = value.h as number;
    const controlBase: ShapeElement = { type: "line", x, y, w, h, color: value.color as string, thickness, lineRoute };
    const normalizedRoutePoints = straightOnly ? undefined : autoRoute ? storedRoutePoints : value.type !== "line" ? storedRoutePoints
      : lineRoute === "multi" ? [0.2, 0.4, 0.6, 0.8].map((ratio, index) => storedRoutePoints?.[index] ?? { x: x + w * ratio, y: y + h * ratio })
      : ["curve", "curve2", "curve3"].includes(lineRoute) ? curveControlPoints(controlBase, lineRoute).map((point, index) => storedRoutePoints?.[index] ?? point)
      : storedRoutePoints;
    const relationshipType: RelationshipType | undefined = ["association", "dependency", "data-flow", "inheritance", "aggregation", "composition", "sequence", "network", "other"].includes(String(value.relationshipType)) ? value.relationshipType as RelationshipType : undefined;
    const relationshipDirection: RelationshipDirection | undefined = ["forward", "both", "none"].includes(String(value.relationshipDirection)) ? value.relationshipDirection as RelationshipDirection : undefined;
    const transportSecurity: TransportSecurity | undefined = ["encrypted", "unencrypted", "unknown"].includes(String(value.transportSecurity)) ? value.transportSecurity as TransportSecurity : undefined;
    return { type: value.type as ShapeElement["type"], ...flags, startBinding: binding(value.startBinding), endBinding: binding(value.endBinding), routePoints: normalizedRoutePoints, ...(autoRoute ? { autoRoute: true, routeWaypoints: value.routeWaypoints as Point[] | undefined } : {}), ...(straightOnly ? { straightOnly: true } : {}), forkUpper: straightOnly ? undefined : forkUpper ?? undefined, forkLower: straightOnly ? undefined : forkLower ?? undefined, label, x: value.x, y: value.y, w: value.w, h: value.h, color: value.color, thickness, fillColor, fillOpacity, lineStyle, edgeStyle, cornerRadius, flowchartShape: value.type === "flowchart" ? flowchartShape : undefined, lineRoute: value.type === "line" ? straightOnly ? "straight" : lineRoute : undefined, arrowRoute: value.type === "arrow" ? straightOnly ? "straight" : arrowRoute : undefined, startHead: value.type === "arrow" || value.type === "line" ? validHead(value.startHead) ? value.startHead : "none" : undefined, endHead: value.type === "arrow" || value.type === "line" ? validHead(value.endHead) ? value.endHead : value.type === "arrow" ? "open" : "none" : undefined, opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1, ...(typeof value.cardinality === "string" && value.cardinality.length <= 40 ? { cardinality: value.cardinality } : {}), ...(typeof value.protocol === "string" && value.protocol.length <= 40 ? { protocol: value.protocol } : {}), ...(finite(value.portNumber) && value.portNumber >= 1 && value.portNumber <= 65535 ? { portNumber: Math.round(value.portNumber) } : {}), ...(typeof value.apiContract === "string" && value.apiContract.length <= 2000 ? { apiContract: value.apiContract } : {}), ...(typeof value.dataContract === "string" && value.dataContract.length <= 2000 ? { dataContract: value.dataContract } : {}), ...(typeof value.sequenceCondition === "string" && value.sequenceCondition.length <= 500 ? { sequenceCondition: value.sequenceCondition } : {}), ...(value.sequenceDefault === true ? { sequenceDefault: true } : {}), ...(relationshipType ? { relationshipType } : {}), ...(relationshipDirection ? { relationshipDirection } : {}), ...(transportSecurity ? { transportSecurity } : {}), ...(typeof value.schemaDiagramId === "string" ? { schemaDiagramId: value.schemaDiagramId } : {}) };
  }
  return undefined;
}

export function parseSketchFile(value: unknown): SketchFile | undefined {
  if (!isRecord(value) || value.format !== "SketchDraw") return undefined;
  const version = Number(value.version);
  if (!Number.isInteger(version) || version < 1 || version > SKETCH_FORMAT_VERSION) return undefined;
  const sections = isRecord(value.sections) ? value.sections : undefined;
  if (sections && !isRecord(sections.canvas)) return undefined;
  if (sections && version === 8 && (!isRecord(sections.planning) || !isRecord(sections.library))) return undefined;
  if (sections && version === 9 && (!isRecord(sections.notebook) || !Array.isArray(sections.notebook.notes) || !isRecord(sections.retiredLibraryArchive))) return undefined;
  if (sections && version < 8) return undefined;
  const canvasSection = sections ? sections.canvas as Record<string, unknown> : value;
  const planningValue = sections ? sections.planning : value.project;
  const libraryValue = sections && version === 9
    ? { ...(sections.retiredLibraryArchive as Record<string, unknown>), quickNotes: (sections.notebook as Record<string, unknown>).notes }
    : sections && version === 8 ? sections.library : sections ? undefined : value.library;
  const addLegacyElementIds = (item: unknown, depth = 0, budget: ElementNodeBudget = { remaining: MAX_DOCUMENT_ELEMENT_NODES }): unknown => {
    if (!isRecord(item)) return item;
    if (depth > MAX_ELEMENT_DEPTH || budget.remaining <= 0) return {};
    budget.remaining -= 1;
    const next: Record<string, unknown> = { ...item, id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID() };
    if (Array.isArray(item.elements)) {
      if (item.elements.length > MAX_ELEMENTS_PER_PAGE) return {};
      next.elements = item.elements.map(child => addLegacyElementIds(child, depth + 1, budget));
    }
    return next;
  };
  const groupLegacyClassCards = (items: Element[]): Element[] => {
    const classRoles = new Set(["class-shell", "class-header", "class-divider-name", "class-divider-attributes", "class-name", "class-attributes", "class-methods"]);
    const partsById = new Map<string, Element[]>();
    for (const item of items) {
      if (item.type === "group" || !item.componentId?.startsWith("uml-class:") || !item.componentRole || !classRoles.has(item.componentRole)) continue;
      const parts = partsById.get(item.componentId) ?? []; parts.push(item); partsById.set(item.componentId, parts);
    }
    const emitted = new Set<string>();
    return items.flatMap(item => {
      const componentId = item.type === "group" ? undefined : item.componentId;
      const parts = componentId ? partsById.get(componentId) : undefined;
      if (!componentId || !parts?.includes(item) || !parts.some(part => part.componentRole === "class-shell")) return [item];
      if (emitted.has(componentId)) return [];
      emitted.add(componentId);
      const group: GroupElement = { type: "group", id: crypto.randomUUID(), componentId, elements: parts, libraryComponent: { kind: "uml-class", appearance: "simple" } };
      return [group];
    });
  };
  const normalizePage = (id: unknown, name: unknown, stateValue: unknown, elementsValue: unknown, legacy: boolean, budget: ElementParseBudget): SketchPage | undefined => {
    if (typeof id !== "string" || typeof name !== "string" || !isRecord(stateValue) || !Array.isArray(elementsValue) || elementsValue.length > MAX_ELEMENTS_PER_PAGE) return undefined;
    const state = stateValue;
    if (!finite(state.zoom) || state.zoom <= 0 || !finite(state.panX) || !finite(state.panY) || !isColor(state.backgroundColor)) return undefined;
    const legacyBudget = { remaining: MAX_DOCUMENT_ELEMENT_NODES };
    const elements = elementsValue.map(element => normalizeElementWithinBudget(legacy ? addLegacyElementIds(element, 0, legacyBudget) : element, 0, budget));
    if (elements.some((element) => !element)) return undefined;
    const normalizedElements = groupLegacyClassCards(elements as Element[]);
    if (!validReferences(normalizedElements)) return undefined;
    return { id, name: name.slice(0, 80), canvasState: { zoom: state.zoom, panX: state.panX, panY: state.panY, backgroundColor: state.backgroundColor, boardColorFollowsTheme: typeof state.boardColorFollowsTheme === "boolean" ? state.boardColorFollowsTheme : state.backgroundColor === "#ffffff" }, elements: normalizedElements };
  };
  const sourcePages = Array.isArray(canvasSection.pages) ? canvasSection.pages : Array.isArray(canvasSection.elements) ? [{ id: crypto.randomUUID(), name: "Page 1", canvasState: canvasSection.canvasState, elements: canvasSection.elements }] : undefined;
  if (!sourcePages || sourcePages.length < 1 || sourcePages.length > 100) return undefined;
  const elementBudget = { remaining: MAX_DOCUMENT_ELEMENT_NODES, remainingStrokePoints: MAX_DOCUMENT_STROKE_POINTS };
  const pages = sourcePages.map((page, index) => {
    if (!isRecord(page)) return undefined;
    const state = isRecord(page.canvasState) ? page.canvasState : {};
    const migratedState = version < SKETCH_FORMAT_VERSION ? { zoom: finite(state.zoom) && state.zoom > 0 ? state.zoom : 1, panX: finite(state.panX) ? state.panX : 0, panY: finite(state.panY) ? state.panY : 0, backgroundColor: isColor(state.backgroundColor) ? state.backgroundColor : "#ffffff", ...(typeof state.boardColorFollowsTheme === "boolean" ? { boardColorFollowsTheme: state.boardColorFollowsTheme } : {}) } : state;
    return normalizePage(typeof page.id === "string" ? page.id : crypto.randomUUID(), typeof page.name === "string" ? page.name : "Page " + (index + 1), migratedState, page.elements, version < 6, elementBudget);
  });
  if (pages.some((page) => !page)) return undefined;
  const normalized = pages as SketchPage[];
  if (new Set(normalized.map((page) => page.id)).size !== normalized.length) return undefined;
  const requestedPageId = canvasSection.activePageId;
  const activePageId = normalized.some((page) => page.id === requestedPageId) ? String(requestedPageId) : normalized[0].id;
  const sync = isRecord(value.windowsSync) ? value.windowsSync : undefined;
  const validClockMap = (raw: unknown) => {
    if (!isRecord(raw) || Object.keys(raw).length > 100_000) return {};
    return Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, number] => entry[0].length <= 240 && finite(entry[1]) && entry[1] >= 0));
  };
  const windowsSync = sync?.version === 1 && finite(sync.updatedAt) && sync.updatedAt >= 0 && typeof sync.deviceId === "string" && sync.deviceId.length <= 100
    ? { version: 1 as const, updatedAt: sync.updatedAt, deviceId: sync.deviceId, clocks: validClockMap(sync.clocks), tombstones: validClockMap(sync.tombstones) }
    : undefined;
  const project = planningValue === undefined ? undefined : normalizeProjectWorkspace(planningValue);
  if (planningValue !== undefined && !project) return undefined;
  const library = normalizeLegacyLibraryData(libraryValue, sections ? undefined : value.project);
  if (!library) return undefined;
  return { format: "SketchDraw", version: SKETCH_FORMAT_VERSION, activePageId, pages: normalized, ...(project ? { project } : {}), library, ...(windowsSync ? { windowsSync } : {}) };
}

/** Keeps files written by the app inside the same resource limits as files it can reopen. */
export function sketchFileResourceError(file: SketchFile): string | undefined {
  let nodeCount = 0;
  let strokePointCount = 0;
  const visit = (elements: Element[], depth: number): string | undefined => {
    if (depth > MAX_ELEMENT_DEPTH) return "This sketch contains groups nested too deeply to save safely.";
    for (const element of elements) {
      nodeCount += 1;
      if (nodeCount > MAX_DOCUMENT_ELEMENT_NODES) return "This sketch contains too many canvas objects to save safely.";
      if (element.type === "group") {
        if (element.elements.length > MAX_ELEMENTS_PER_PAGE) return "A group contains too many canvas objects to save safely.";
        const error = visit(element.elements, depth + 1);
        if (error) return error;
      } else if ("label" in element && element.label) {
        if (depth + 1 > MAX_ELEMENT_DEPTH) return "This sketch contains labels nested too deeply to save safely.";
        nodeCount += 1;
        if (nodeCount > MAX_DOCUMENT_ELEMENT_NODES) return "This sketch contains too many canvas objects to save safely.";
        if (element.label.text.length > MAX_CANVAS_TEXT_LENGTH) return `Canvas text exceeds the ${MAX_CANVAS_TEXT_LENGTH.toLocaleString()}-character save limit.`;
      } else if (element.type === "freehand") {
        if (element.points.length > MAX_STROKE_POINTS) return `A stroke exceeds the ${MAX_STROKE_POINTS.toLocaleString()}-point save limit.`;
        strokePointCount += element.points.length;
        if (strokePointCount > MAX_DOCUMENT_STROKE_POINTS) return `This sketch exceeds the ${MAX_DOCUMENT_STROKE_POINTS.toLocaleString()}-point save limit.`;
      } else if (element.type === "text" && element.text.length > MAX_CANVAS_TEXT_LENGTH) {
        return `Canvas text exceeds the ${MAX_CANVAS_TEXT_LENGTH.toLocaleString()}-character save limit.`;
      }
    }
    return undefined;
  };
  if (file.pages.length > 100) return "A sketch can contain up to 100 pages.";
  if (!file.pages.length) return "A sketch must contain at least one page.";
  for (const page of file.pages) {
    if (page.elements.length > MAX_ELEMENTS_PER_PAGE) return "A page contains too many canvas objects to save safely.";
    const error = visit(page.elements, 0);
    if (error) return error;
  }
  return undefined;
}
