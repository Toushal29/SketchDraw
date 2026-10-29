import { SKETCH_FORMAT_VERSION } from "../../model";
import type { ArchitectureMetadata, ArrowHead, ArrowRoute, Binding, CanvasLayer, CanvasLayerVisibilityPreset, ComponentMaster, ConnectionPoint, ContainerMetadata, EdgeStyle, Element, FlowchartShape, FontFamily, GroupElement, GuiComponentProperties, LayerFlags, LibraryChartData, LibraryComponentData, LineRoute, MermaidMetadata, NoteKind, Point, RelationshipDirection, RelationshipType, SchemaConstraint, SchemaField, SchemaIndex, ShapeElement, ShapeLabel, SketchFile, SketchPage, StrokeStyle, StrokePoint, StrideThreatCategory, TransportSecurity } from "../../model";
import { normalizeCanvasDataBinding, normalizeCanvasDataSources } from "../diagrams/canvas-data";
import { ensureCanvasLayerPath, normalizeCanvasLayers } from "../canvas/structure";
import { elementBounds, unionBounds } from "../canvas/bounds";
import { validReferences } from "../../operations";
import { defaultCurveControlPoints } from "../connectors/geometry";
import { ALL_FLOWCHART_SHAPES } from "../diagrams/config";
import { schemaTableMinimumHeight, schemaTableResizeMinimumWidth } from "../diagrams/schema-table-layout";
import { sanitizeIconSvg } from "./sanitize-svg";
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
export function isLibraryChartData(value: unknown): value is LibraryChartData {
  if (!isRecord(value)) return false;
  const labels = value.labels;
  const values = value.values;
  if (!Array.isArray(labels) || labels.length < 1 || labels.length > 20 || !labels.every(label => typeof label === "string" && label.length <= 60)
    || !Array.isArray(values) || values.length !== labels.length || !values.every(number => finite(number) && Math.abs(number) <= 1_000_000_000)) return false;
  if (!["title", "xAxisLabel", "yAxisLabel", "secondaryYAxisLabel"].every(key => value[key] === undefined || typeof value[key] === "string" && (value[key] as string).length <= 80)) return false;
  const series = value.series;
  if (series !== undefined && (!Array.isArray(series) || series.length > 8 || !series.every(item => {
    if (!isRecord(item) || typeof item.name !== "string" || item.name.length > 60 || !Array.isArray(item.values) || item.values.length !== labels.length || !item.values.every(number => finite(number) && Math.abs(number) <= 1_000_000_000)) return false;
    return (item.chartType === undefined || ["bar", "line", "area", "scatter"].includes(String(item.chartType))) && (item.axis === undefined || item.axis === "primary" || item.axis === "secondary") && (item.color === undefined || isColor(item.color));
  }))) return false;
  const annotations = value.annotations;
  if (annotations !== undefined && (!Array.isArray(annotations) || annotations.length > 32 || !annotations.every(item => {
    if (!isRecord(item) || !finite(item.index) || !Number.isInteger(item.index) || item.index < 0 || item.index >= labels.length || typeof item.label !== "string" || item.label.length > 80) return false;
    return (item.value === undefined || finite(item.value) && Math.abs(item.value) <= 1_000_000_000) && (item.axis === undefined || item.axis === "primary" || item.axis === "secondary");
  }))) return false;
  const options = value.options;
  if (options !== undefined) {
    if (!isRecord(options)) return false;
    if (options.palette !== undefined && !["blue", "ocean", "warm", "violet", "mono"].includes(String(options.palette))) return false;
    if (options.legend !== undefined && !["right", "bottom", "hidden"].includes(String(options.legend))) return false;
    if (options.sort !== undefined && !["original", "ascending", "descending"].includes(String(options.sort))) return false;
    if (!["showGrid", "showValues", "showPoints", "smooth"].every(key => options[key] === undefined || typeof options[key] === "boolean")) return false;
    if (!["maxValue", "pointSize", "lineWidth"].every(key => options[key] === undefined || finite(options[key]) && (key === "maxValue" ? options[key] > 0 && options[key] <= 1_000_000_000 : options[key] >= 1 && options[key] <= 32))) return false;
    if (options.categoryColors !== undefined && (!isRecord(options.categoryColors) || Object.keys(options.categoryColors).length > 20 || !Object.entries(options.categoryColors).every(([label, color]) => label.length <= 60 && isColor(color)))) return false;
  }
  return true;
}
function normalizeConnectionPoints(value: unknown): ConnectionPoint[] | undefined {
  if (!Array.isArray(value) || value.length > 32) return undefined;
  const points = value.flatMap((raw): ConnectionPoint[] => isRecord(raw) && typeof raw.id === "string" && /^[\w.-]{1,80}$/.test(raw.id) && typeof raw.name === "string" && raw.name.trim().length > 0 && raw.name.length <= 80 && isRecord(raw.anchor) && finite(raw.anchor.x) && finite(raw.anchor.y) && raw.anchor.x >= 0 && raw.anchor.x <= 1 && raw.anchor.y >= 0 && raw.anchor.y <= 1 ? [{ id: raw.id, name: raw.name, anchor: { x: raw.anchor.x, y: raw.anchor.y } }] : []);
  return points.length === value.length && new Set(points.map(point => point.id)).size === points.length ? points : undefined;
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

export function normalizeElement(value: unknown): Element | undefined {
  return normalizeElementWithinBudget(value, 0, { remaining: MAX_DOCUMENT_ELEMENT_NODES, remainingStrokePoints: MAX_DOCUMENT_STROKE_POINTS });
}

function normalizeElementWithinBudget(value: unknown, depth: number, budget: ElementParseBudget): Element | undefined {
  if (depth > MAX_ELEMENT_DEPTH || budget.remaining <= 0) return undefined;
  budget.remaining -= 1;
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.id !== "string" || !value.id || value.id.length > 100) return undefined;
  const dataBinding = normalizeCanvasDataBinding(value.dataBinding);
  const flags: LayerFlags = {
    id: value.id,
    hidden: typeof value.hidden === "boolean" ? value.hidden : false,
    locked: typeof value.locked === "boolean" ? value.locked : false,
    rotation: finite(value.rotation) ? value.rotation : 0,
    ...(value.aspectLocked === true ? { aspectLocked: true } : {}),
    ...(typeof value.layerId === "string" && /^[\w.-]{1,100}$/.test(value.layerId) ? { layerId: value.layerId } : {}),
    ...(typeof value.layerName === "string" && value.layerName.trim().length <= 80 ? { layerName: value.layerName.trim() } : {}),
    ...(typeof value.componentId === "string" ? { componentId: value.componentId } : {}),
    ...(typeof value.componentRole === "string" ? { componentRole: value.componentRole } : {}),
    ...(typeof value.catalogId === "string" && value.catalogId.length <= 100 ? { catalogId: value.catalogId } : {}),
    ...(typeof value.pageLinkId === "string" && value.pageLinkId.length <= 100 ? { pageLinkId: value.pageLinkId } : {}),
    ...(typeof value.prototypeTargetId === "string" && value.prototypeTargetId.length <= 100 ? { prototypeTargetId: value.prototypeTargetId } : {}),
    ...(typeof value.projectTaskId === "string" && /^[\w.-]{1,100}$/.test(value.projectTaskId) ? { projectTaskId: value.projectTaskId } : {}),
    ...(dataBinding ? { dataBinding } : {}),
    ...(typeof value.masterElementId === "string" && value.masterElementId.length <= 100 ? { masterElementId: value.masterElementId } : {}),
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
    const componentConnectionPoints = rawComponent?.connectionPoints === undefined ? undefined : normalizeConnectionPoints(rawComponent.connectionPoints);
    const iconSvg = rawComponent && typeof rawComponent.iconSvg === "string" ? sanitizeIconSvg(rawComponent.iconSvg) : undefined;
    const iconViewBox = rawComponent && typeof rawComponent.iconViewBox === "string" && /^-?[\d.]+\s+-?[\d.]+\s+[\d.]+\s+[\d.]+$/.test(rawComponent.iconViewBox) ? rawComponent.iconViewBox : undefined;
    const rawChartData = rawComponent && isRecord(rawComponent.chartData) ? rawComponent.chartData : undefined;
    const chartLabelsValid = rawChartData && Array.isArray(rawChartData.labels) && rawChartData.labels.length > 0 && rawChartData.labels.length <= 20 && rawChartData.labels.every(label => typeof label === "string" && label.length <= 60);
    const chartSeries = rawChartData && Array.isArray(rawChartData.series) && rawChartData.series.length <= 8 && rawChartData.series.every(series => isRecord(series) && typeof series.name === "string" && series.name.length <= 60 && Array.isArray(series.values) && series.values.length === (Array.isArray(rawChartData.labels) ? rawChartData.labels.length : -1) && series.values.every(number => finite(number) && Math.abs(number) <= 1_000_000_000)
      && (series.chartType === undefined || ["bar", "line", "area", "scatter"].includes(String(series.chartType))) && (series.axis === undefined || series.axis === "primary" || series.axis === "secondary") && (series.color === undefined || isColor(series.color)))
      ? rawChartData.series as LibraryChartData["series"] : undefined;
    const chartAnnotations = rawChartData && Array.isArray(rawChartData.annotations) && rawChartData.annotations.length <= 32 && rawChartData.annotations.every(annotation => isRecord(annotation) && finite(annotation.index) && Number.isInteger(annotation.index) && annotation.index >= 0 && annotation.index < (Array.isArray(rawChartData.labels) ? rawChartData.labels.length : 0) && typeof annotation.label === "string" && annotation.label.length <= 80 && (annotation.value === undefined || finite(annotation.value) && Math.abs(annotation.value) <= 1_000_000_000) && (annotation.axis === undefined || annotation.axis === "primary" || annotation.axis === "secondary"))
      ? rawChartData.annotations as LibraryChartData["annotations"] : undefined;
    const rawChartOptions = rawChartData && isRecord(rawChartData.options) ? rawChartData.options : undefined;
    const chartOptions: LibraryChartData["options"] | undefined = rawChartOptions
      && (rawChartOptions.palette === undefined || ["blue", "ocean", "warm", "violet", "mono"].includes(String(rawChartOptions.palette)))
      && (rawChartOptions.legend === undefined || ["right", "bottom", "hidden"].includes(String(rawChartOptions.legend)))
      && (rawChartOptions.sort === undefined || ["original", "ascending", "descending"].includes(String(rawChartOptions.sort)))
      && ["showGrid", "showValues", "showPoints", "smooth"].every(key => rawChartOptions[key] === undefined || typeof rawChartOptions[key] === "boolean")
      && ["maxValue", "pointSize", "lineWidth"].every(key => rawChartOptions[key] === undefined || finite(rawChartOptions[key]) && (key === "maxValue" ? rawChartOptions[key] > 0 && rawChartOptions[key] <= 1_000_000_000 : rawChartOptions[key] >= 1 && rawChartOptions[key] <= 32))
      && (rawChartOptions.categoryColors === undefined || isRecord(rawChartOptions.categoryColors) && Object.keys(rawChartOptions.categoryColors).length <= 20 && Object.entries(rawChartOptions.categoryColors).every(([label, color]) => label.length <= 60 && isColor(color)))
      ? { ...(rawChartOptions.palette ? { palette: rawChartOptions.palette as NonNullable<LibraryChartData["options"]>["palette"] } : {}), ...(rawChartOptions.legend ? { legend: rawChartOptions.legend as NonNullable<LibraryChartData["options"]>["legend"] } : {}), ...(rawChartOptions.sort ? { sort: rawChartOptions.sort as NonNullable<LibraryChartData["options"]>["sort"] } : {}), ...(typeof rawChartOptions.showGrid === "boolean" ? { showGrid: rawChartOptions.showGrid } : {}), ...(typeof rawChartOptions.showValues === "boolean" ? { showValues: rawChartOptions.showValues } : {}), ...(typeof rawChartOptions.showPoints === "boolean" ? { showPoints: rawChartOptions.showPoints } : {}), ...(typeof rawChartOptions.smooth === "boolean" ? { smooth: rawChartOptions.smooth } : {}), ...(finite(rawChartOptions.maxValue) ? { maxValue: rawChartOptions.maxValue } : {}), ...(finite(rawChartOptions.pointSize) ? { pointSize: rawChartOptions.pointSize } : {}), ...(finite(rawChartOptions.lineWidth) ? { lineWidth: rawChartOptions.lineWidth } : {}), ...(isRecord(rawChartOptions.categoryColors) ? { categoryColors: rawChartOptions.categoryColors as Record<string, string> } : {}) } : undefined;
    const chartData: LibraryChartData | undefined = rawChartData && chartLabelsValid && Array.isArray(rawChartData.values)
      && (rawChartData.labels as string[]).length > 0 && (rawChartData.labels as string[]).length <= 20 && rawChartData.values.length === (rawChartData.labels as string[]).length
      && rawChartData.values.every(number => finite(number) && Math.abs(number) <= 1_000_000_000)
      && ["title", "xAxisLabel", "yAxisLabel"].every(key => rawChartData[key] === undefined || typeof rawChartData[key] === "string" && (rawChartData[key] as string).length <= 80)
      && (rawChartData.series === undefined || chartSeries !== undefined)
      && (rawChartData.options === undefined || chartOptions !== undefined)
      && (rawChartData.annotations === undefined || chartAnnotations !== undefined)
      && (rawChartData.secondaryYAxisLabel === undefined || typeof rawChartData.secondaryYAxisLabel === "string" && rawChartData.secondaryYAxisLabel.length <= 80)
      ? { labels: rawChartData.labels as string[], values: rawChartData.values as number[], ...(typeof rawChartData.title === "string" ? { title: rawChartData.title } : {}), ...(typeof rawChartData.xAxisLabel === "string" ? { xAxisLabel: rawChartData.xAxisLabel } : {}), ...(typeof rawChartData.yAxisLabel === "string" ? { yAxisLabel: rawChartData.yAxisLabel } : {}), ...(typeof rawChartData.secondaryYAxisLabel === "string" ? { secondaryYAxisLabel: rawChartData.secondaryYAxisLabel } : {}), ...(chartSeries ? { series: chartSeries } : {}), ...(chartAnnotations ? { annotations: chartAnnotations } : {}), ...(chartOptions ? { options: chartOptions } : {}) } : undefined;
    const componentAppearance = rawComponent && (rawComponent.appearance === "simple" || rawComponent.appearance === "modern") ? rawComponent.appearance as "simple" | "modern" : undefined;
    const renderStyle = rawComponent?.renderStyle === "clean" ? "clean" as const : undefined;
    const rawComponentFields = rawComponent && Array.isArray(rawComponent.componentFields) ? rawComponent.componentFields : undefined;
    const componentFields = rawComponentFields && rawComponentFields.length <= 32 && rawComponentFields.every(field => isRecord(field) && typeof field.key === "string" && /^[\w.-]{1,80}$/.test(field.key) && typeof field.label === "string" && field.label.length <= 80 && typeof field.value === "string" && field.value.length <= 2000 && (field.hint === undefined || typeof field.hint === "string" && field.hint.length <= 240))
      ? rawComponentFields as LibraryComponentData["componentFields"] : undefined;
    const trendDirection = rawComponent && (rawComponent.trendDirection === "up" || rawComponent.trendDirection === "down" || rawComponent.trendDirection === "steady") ? rawComponent.trendDirection as "up" | "down" | "steady" : undefined;
    const formOptions = rawComponent && ["form-radio", "form-select", "form-button", "form-checkbox"].includes(String(rawComponent.kind)) && Array.isArray(rawComponent.formOptions)
      && rawComponent.formOptions.length > 0 && rawComponent.formOptions.length <= 12
      && rawComponent.formOptions.every(option => typeof option === "string" && option.length <= 120)
      ? rawComponent.formOptions as string[] : undefined;
    const formTitle = rawComponent && typeof rawComponent.formTitle === "string" && rawComponent.formTitle.length <= 80 ? rawComponent.formTitle : undefined;
    const formStates = rawComponent && Array.isArray(rawComponent.formStates) && rawComponent.formStates.length <= 12 && rawComponent.formStates.every(state => typeof state === "boolean") ? rawComponent.formStates as boolean[] : undefined;
    const rawGuiProperties = rawComponent && isRecord(rawComponent.guiProperties) ? rawComponent.guiProperties : undefined;
    const guiItems = rawGuiProperties && Array.isArray(rawGuiProperties.items) && rawGuiProperties.items.length > 0 && rawGuiProperties.items.length <= 12 && rawGuiProperties.items.every(item => typeof item === "string" && item.length <= 120) ? rawGuiProperties.items as string[] : undefined;
    const guiProperties: GuiComponentProperties | undefined = rawGuiProperties ? {
      ...(typeof rawGuiProperties.title === "string" && rawGuiProperties.title.length <= 120 ? { title: rawGuiProperties.title } : {}),
      ...(["top", "bottom", "left", "right"].includes(String(rawGuiProperties.titlePosition)) ? { titlePosition: rawGuiProperties.titlePosition as GuiComponentProperties["titlePosition"] } : {}),
      ...(typeof rawGuiProperties.placeholder === "string" && rawGuiProperties.placeholder.length <= 160 ? { placeholder: rawGuiProperties.placeholder } : {}),
      ...(["vertical", "horizontal", "grid"].includes(String(rawGuiProperties.optionLayout)) ? { optionLayout: rawGuiProperties.optionLayout as GuiComponentProperties["optionLayout"] } : {}),
      ...(finite(rawGuiProperties.optionColumns) && Number.isInteger(rawGuiProperties.optionColumns) && rawGuiProperties.optionColumns >= 1 && rawGuiProperties.optionColumns <= 12 ? { optionColumns: rawGuiProperties.optionColumns } : {}),
      ...(finite(rawGuiProperties.optionGap) && rawGuiProperties.optionGap >= 0 && rawGuiProperties.optionGap <= 40 ? { optionGap: rawGuiProperties.optionGap } : {}),
      ...(finite(rawGuiProperties.optionRowGap) && rawGuiProperties.optionRowGap >= 0 && rawGuiProperties.optionRowGap <= 40 ? { optionRowGap: rawGuiProperties.optionRowGap } : {}),
      ...(finite(rawGuiProperties.optionColumnGap) && rawGuiProperties.optionColumnGap >= 0 && rawGuiProperties.optionColumnGap <= 40 ? { optionColumnGap: rawGuiProperties.optionColumnGap } : {}),
      ...(typeof rawGuiProperties.bodyText === "string" && rawGuiProperties.bodyText.length <= 500 ? { bodyText: rawGuiProperties.bodyText } : {}),
      ...(typeof rawGuiProperties.actionLabel === "string" && rawGuiProperties.actionLabel.length <= 120 ? { actionLabel: rawGuiProperties.actionLabel } : {}),
      ...(guiItems ? { items: guiItems } : {}),
      ...(finite(rawGuiProperties.activeItem) && Number.isInteger(rawGuiProperties.activeItem) && rawGuiProperties.activeItem >= 0 && rawGuiProperties.activeItem < 12 ? { activeItem: rawGuiProperties.activeItem } : {}),
    } : undefined;
    const rawStyleOverrides = rawComponent && isRecord(rawComponent.styleOverrides) ? rawComponent.styleOverrides : undefined;
    const styleOverrides = rawStyleOverrides && (rawStyleOverrides.color === undefined || isColor(rawStyleOverrides.color)) && (rawStyleOverrides.fillColor === undefined || rawStyleOverrides.fillColor === null || isColor(rawStyleOverrides.fillColor)) && (rawStyleOverrides.fillOpacity === undefined || finite(rawStyleOverrides.fillOpacity) && rawStyleOverrides.fillOpacity >= 0 && rawStyleOverrides.fillOpacity <= 1) && (rawStyleOverrides.lineStyle === undefined || ["solid", "dashed", "dotted", "double"].includes(String(rawStyleOverrides.lineStyle)))
      ? { ...(typeof rawStyleOverrides.color === "string" ? { color: rawStyleOverrides.color } : {}), ...(rawStyleOverrides.fillColor === null || typeof rawStyleOverrides.fillColor === "string" ? { fillColor: rawStyleOverrides.fillColor as string | null } : {}), ...(finite(rawStyleOverrides.fillOpacity) ? { fillOpacity: rawStyleOverrides.fillOpacity } : {}), ...(typeof rawStyleOverrides.lineStyle === "string" ? { lineStyle: rawStyleOverrides.lineStyle as StrokeStyle } : {}) } : undefined;
    const rawTextStyle = rawComponent && isRecord(rawComponent.textStyle) ? rawComponent.textStyle : undefined;
    const validFontFamilies = ["sans", "hand", "serif", "mono", "rounded", "display"];
    const validTextAlignments = ["left", "center", "right", "justify"];
    const textStyle = rawTextStyle && (rawTextStyle.color === undefined || isColor(rawTextStyle.color))
      && (rawTextStyle.fontSize === undefined || finite(rawTextStyle.fontSize) && rawTextStyle.fontSize >= 8 && rawTextStyle.fontSize <= 160)
      && (rawTextStyle.fontFamily === undefined || typeof rawTextStyle.fontFamily === "string" && validFontFamilies.includes(rawTextStyle.fontFamily))
      && ["bold", "italic", "underline"].every(key => rawTextStyle[key] === undefined || typeof rawTextStyle[key] === "boolean")
      && (rawTextStyle.textAlign === undefined || typeof rawTextStyle.textAlign === "string" && validTextAlignments.includes(rawTextStyle.textAlign))
      ? { ...(typeof rawTextStyle.color === "string" ? { color: rawTextStyle.color } : {}), ...(finite(rawTextStyle.fontSize) ? { fontSize: rawTextStyle.fontSize } : {}), ...(typeof rawTextStyle.fontFamily === "string" ? { fontFamily: rawTextStyle.fontFamily as "sans" | "hand" | "serif" | "mono" | "rounded" | "display" } : {}), ...(typeof rawTextStyle.bold === "boolean" ? { bold: rawTextStyle.bold } : {}), ...(typeof rawTextStyle.italic === "boolean" ? { italic: rawTextStyle.italic } : {}), ...(typeof rawTextStyle.underline === "boolean" ? { underline: rawTextStyle.underline } : {}), ...(typeof rawTextStyle.textAlign === "string" ? { textAlign: rawTextStyle.textAlign as "left" | "center" | "right" | "justify" } : {}) } : undefined;
    const componentBoundsValue = isRecord(value.componentBounds) && finite(value.componentBounds.x) && finite(value.componentBounds.y) && finite(value.componentBounds.w) && value.componentBounds.w >= 2 && value.componentBounds.w <= 1_000_000 && finite(value.componentBounds.h) && value.componentBounds.h >= 2 && value.componentBounds.h <= 1_000_000
      ? { x: value.componentBounds.x, y: value.componentBounds.y, w: value.componentBounds.w, h: value.componentBounds.h } : undefined;
    const masterId = typeof value.masterId === "string" && value.masterId.length > 0 && value.masterId.length <= 100 ? value.masterId : undefined;
    const variantKey = typeof value.variantKey === "string" && /^[\p{L}\p{N}_.=-]{1,80}$/u.test(value.variantKey) ? value.variantKey : undefined;
    const rawOverrides = isRecord(value.componentOverrides) ? value.componentOverrides : undefined;
    const overrideChart = rawOverrides && isRecord(rawOverrides.chartData) ? rawOverrides.chartData : undefined;
    const overrideChartData = overrideChart && isLibraryChartData(overrideChart) ? overrideChart : undefined;
    const overrideFormOptions = rawOverrides && Array.isArray(rawOverrides.formOptions) && rawOverrides.formOptions.length <= 32 && rawOverrides.formOptions.every(option => typeof option === "string" && option.length <= 120) ? rawOverrides.formOptions as string[] : undefined;
    const overridePortLabels = rawOverrides && isRecord(rawOverrides.portLabels) && Object.keys(rawOverrides.portLabels).length <= 32 && Object.entries(rawOverrides.portLabels).every(([key, label]) => /^[\w.-]{1,80}$/.test(key) && typeof label === "string" && label.length <= 80) ? rawOverrides.portLabels as Record<string, string> : undefined;
    const componentOverrides = rawOverrides && (rawOverrides.label === undefined || typeof rawOverrides.label === "string" && rawOverrides.label.length <= 240) && (rawOverrides.color === undefined || isColor(rawOverrides.color)) && (rawOverrides.fillColor === undefined || rawOverrides.fillColor === null || isColor(rawOverrides.fillColor)) && (rawOverrides.fillOpacity === undefined || finite(rawOverrides.fillOpacity) && rawOverrides.fillOpacity >= 0 && rawOverrides.fillOpacity <= 1) && (rawOverrides.lineStyle === undefined || ["solid", "dashed", "dotted", "double"].includes(String(rawOverrides.lineStyle))) && (rawOverrides.chartData === undefined || overrideChartData !== undefined) && (rawOverrides.formOptions === undefined || overrideFormOptions !== undefined) && (rawOverrides.portLabels === undefined || overridePortLabels !== undefined)
      ? { ...(typeof rawOverrides.label === "string" ? { label: rawOverrides.label } : {}), ...(typeof rawOverrides.color === "string" ? { color: rawOverrides.color } : {}), ...(rawOverrides.fillColor === null || typeof rawOverrides.fillColor === "string" ? { fillColor: rawOverrides.fillColor as string | null } : {}), ...(finite(rawOverrides.fillOpacity) ? { fillOpacity: rawOverrides.fillOpacity } : {}), ...(typeof rawOverrides.lineStyle === "string" ? { lineStyle: rawOverrides.lineStyle as StrokeStyle } : {}), ...(overrideChartData ? { chartData: overrideChartData } : {}), ...(overrideFormOptions ? { formOptions: overrideFormOptions } : {}), ...(overridePortLabels ? { portLabels: overridePortLabels } : {}) } : undefined;
    const connectionPoints = value.connectionPoints === undefined ? undefined : normalizeConnectionPoints(value.connectionPoints);
    const rawStencilParameters = isRecord(value.stencilParameters) ? value.stencilParameters : undefined;
    const stencilParameterNames = rawStencilParameters && Array.isArray(rawStencilParameters.parameters) && rawStencilParameters.parameters.length <= 12 && rawStencilParameters.parameters.every(name => typeof name === "string" && /^[\p{L}\p{N}_ -]{1,40}$/u.test(name)) ? rawStencilParameters.parameters as string[] : undefined;
    const stencilParameterValues = rawStencilParameters && isRecord(rawStencilParameters.values) && Object.keys(rawStencilParameters.values).length <= 12 && Object.entries(rawStencilParameters.values).every(([key, entry]) => /^[\p{L}\p{N}_ -]{1,40}$/u.test(key) && typeof entry === "string" && entry.length <= 500) ? rawStencilParameters.values as Record<string, string> : undefined;
    const stencilTemplate = rawStencilParameters && Array.isArray(rawStencilParameters.template) && rawStencilParameters.template.length <= MAX_ELEMENTS_PER_PAGE && rawStencilParameters.template.length > 0 ? rawStencilParameters.template.map(item => normalizeElementWithinBudget(item, depth + 1, budget)) : undefined;
    const stencilParameters = stencilParameterNames && stencilParameterValues && stencilTemplate && !stencilTemplate.some(item => !item) && validReferences(stencilTemplate as Element[]) ? { parameters: stencilParameterNames, values: stencilParameterValues, template: stencilTemplate as Element[] } : undefined;
    const rawContainer = isRecord(value.container) ? value.container : undefined;
    const containerPorts = rawContainer?.connectionPoints === undefined ? undefined : normalizeConnectionPoints(rawContainer.connectionPoints);
    const container: ContainerMetadata | undefined = rawContainer && ["frame", "container", "swimlane"].includes(String(rawContainer.kind))
      && (rawContainer.name === undefined || typeof rawContainer.name === "string" && rawContainer.name.length <= 120)
      && (rawContainer.background === undefined || isColor(rawContainer.background))
      && (rawContainer.borderColor === undefined || isColor(rawContainer.borderColor))
      && (rawContainer.borderThickness === undefined || finite(rawContainer.borderThickness) && rawContainer.borderThickness >= 0.5 && rawContainer.borderThickness <= 24)
      && (rawContainer.borderStyle === undefined || ["solid", "dashed", "dotted", "double"].includes(String(rawContainer.borderStyle)))
      && ["showBorder", "showLabel", "clipChildren", "autoResize", "lockedSize"].every(key => rawContainer[key] === undefined || typeof rawContainer[key] === "boolean")
      && (rawContainer.padding === undefined || finite(rawContainer.padding) && rawContainer.padding >= 0 && rawContainer.padding <= 500)
      && (rawContainer.connectionPoints === undefined || containerPorts !== undefined)
      ? { kind: rawContainer.kind as ContainerMetadata["kind"], name: typeof rawContainer.name === "string" ? rawContainer.name.trim().slice(0, 120) || "Container" : "Container", ...(isColor(rawContainer.background) ? { background: rawContainer.background } : {}), ...(typeof rawContainer.showBorder === "boolean" ? { showBorder: rawContainer.showBorder } : {}), ...(typeof rawContainer.showLabel === "boolean" ? { showLabel: rawContainer.showLabel } : {}), ...(isColor(rawContainer.borderColor) ? { borderColor: rawContainer.borderColor } : {}), ...(finite(rawContainer.borderThickness) ? { borderThickness: rawContainer.borderThickness } : {}), ...(typeof rawContainer.borderStyle === "string" ? { borderStyle: rawContainer.borderStyle as ContainerMetadata["borderStyle"] } : {}), ...(typeof rawContainer.clipChildren === "boolean" ? { clipChildren: rawContainer.clipChildren } : {}), ...(typeof rawContainer.autoResize === "boolean" ? { autoResize: rawContainer.autoResize } : {}), ...(typeof rawContainer.lockedSize === "boolean" ? { lockedSize: rawContainer.lockedSize } : {}), ...(finite(rawContainer.padding) ? { padding: rawContainer.padding } : {}), ...(containerPorts?.length ? { connectionPoints: containerPorts } : {}) }
      : undefined;
    const libraryComponent = rawComponent && typeof rawComponent.kind === "string" && rawComponent.kind.length <= 100
      && (rawComponent.label === undefined || typeof rawComponent.label === "string" && rawComponent.label.length <= 120)
      && (rawComponent.iconViewBox === undefined || iconViewBox !== undefined)
      && (rawComponent.componentFields === undefined || componentFields !== undefined)
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
      && (rawComponent.connectionPoints === undefined || componentConnectionPoints !== undefined)
      ? { kind: rawComponent.kind, ...(typeof rawComponent.label === "string" ? { label: rawComponent.label } : {}), ...(componentFields ? { componentFields } : {}), ...(renderStyle ? { renderStyle } : {}), ...(iconSvg !== undefined ? { iconSvg, iconViewBox } : {}), ...(finite(rawComponent.portCount) ? { portCount: Math.round(rawComponent.portCount) } : {}), ...(componentConnectionPoints ? { connectionPoints: componentConnectionPoints } : {}), ...(finite(rawComponent.laneCount) ? { laneCount: Math.round(rawComponent.laneCount) } : {}), ...(finite(rawComponent.durationMinutes) && rawComponent.durationMinutes >= 0 && rawComponent.durationMinutes <= 100000 ? { durationMinutes: rawComponent.durationMinutes } : {}), ...(formTitle !== undefined ? { formTitle } : {}), ...(typeof rawComponent.formState === "boolean" ? { formState: rawComponent.formState } : {}), ...(formStates ? { formStates } : {}), ...(finite(rawComponent.selectedOption) ? { selectedOption: Math.floor(rawComponent.selectedOption) } : {}), ...(formOptions ? { formOptions } : {}), ...(guiProperties ? { guiProperties } : {}), ...(chartData ? { chartData } : {}), ...(trendDirection ? { trendDirection } : {}), ...(componentAppearance ? { appearance: componentAppearance } : {}), ...(styleOverrides ? { styleOverrides } : {}), ...(textStyle ? { textStyle } : {}) } : undefined;
    const roleContainer = libraryComponent?.kind === "diagram-frame" || libraryComponent?.kind === "diagram-swimlane"
      ? { kind: libraryComponent.kind === "diagram-frame" ? "frame" as const : "swimlane" as const, name: libraryComponent.label ?? "Frame", clipChildren: false, autoResize: false, padding: 20 }
      : undefined;
    const containerMetadata = container ?? roleContainer;
    const contentBounds = containerMetadata && !componentBoundsValue ? unionBounds((children as Element[]).filter(child => !child.hidden).map(elementBounds)) : undefined;
    const inferredBounds = containerMetadata && !componentBoundsValue
      ? contentBounds ? { x: contentBounds.x - (containerMetadata.padding ?? 24), y: contentBounds.y - (containerMetadata.padding ?? 24), w: Math.max(25, contentBounds.w + (containerMetadata.padding ?? 24) * 2), h: Math.max(25, contentBounds.h + (containerMetadata.padding ?? 24) * 2) } : { x: 0, y: 0, w: 160, h: 100 }
      : undefined;
    const resolvedComponentBounds = componentBoundsValue ?? inferredBounds;
    if ((value.note !== undefined && !note) || (value.mermaid !== undefined && !mermaid) || (value.libraryComponent !== undefined && !libraryComponent) || (value.componentBounds !== undefined && !componentBoundsValue) || (value.container !== undefined && !container) || (value.masterId !== undefined && !masterId) || (value.variantKey !== undefined && !variantKey) || (value.componentOverrides !== undefined && !componentOverrides) || (value.connectionPoints !== undefined && !connectionPoints) || (value.stencilParameters !== undefined && !stencilParameters) || (componentBoundsValue && !libraryComponent && !container && !masterId && !stencilParameters) || (containerMetadata?.kind === "frame" && !resolvedComponentBounds) || (note && mermaid) || (libraryComponent && (note || mermaid))) return undefined;
    return { type: "group", ...flags, elements: children as Element[], ...(resolvedComponentBounds ? { componentBounds: resolvedComponentBounds } : {}), ...(containerMetadata ? { container: containerMetadata } : {}), note, mermaid, libraryComponent, ...(masterId ? { masterId } : {}), ...(variantKey ? { variantKey } : {}), ...(componentOverrides ? { componentOverrides } : {}), ...(connectionPoints?.length ? { connectionPoints } : {}), ...(stencilParameters ? { stencilParameters } : {}) };
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
    // Refit saved cards to the shared compact row metrics while preserving their positions and widths.
    const fontSize = finite(value.fontSize) ? Math.max(8, Math.min(48, Math.round(value.fontSize))) : 14; const neededHeight = schemaTableMinimumHeight(columns.length, fontSize);
    const neededWidth = schemaTableResizeMinimumWidth();
    return { type: "schemaTable", ...flags, x: value.x, y: value.y, w: Math.max(value.w, neededWidth), h: neededHeight, name: value.name, columns, ...(indexes.length ? { indexes } : {}), ...(constraints.length ? { constraints } : {}), schemaDiagramId: value.schemaDiagramId, schemaSource: value.schemaSource, fontSize, opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1 };
  }
  if (value.type === "svgPath") {
    if (!finite(value.x) || !finite(value.y) || !finite(value.w) || value.w <= 0 || !finite(value.h) || value.h <= 0 || !isColor(value.color) || !finite(value.thickness) || value.thickness <= 0 || typeof value.pathData !== "string" || !value.pathData.trim() || value.pathData.length > 500_000 || !finite(value.pathWidth) || value.pathWidth <= 0 || value.pathWidth > 100_000 || !finite(value.pathHeight) || value.pathHeight <= 0 || value.pathHeight > 100_000 || (value.fillRule !== undefined && value.fillRule !== "nonzero" && value.fillRule !== "evenodd")) return undefined;
    if (!/^[\d\s.,+\-eEmlhvcsqtazMLHVCSQTAZ]+$/.test(value.pathData)) return undefined;
    return { type: "svgPath", ...flags, x: value.x, y: value.y, w: value.w, h: value.h, color: value.color, thickness: Math.max(1, Math.round(value.thickness)), pathData: value.pathData, pathWidth: value.pathWidth, pathHeight: value.pathHeight, fillRule: value.fillRule === "evenodd" ? "evenodd" : "nonzero", svgStroke: value.svgStroke !== false, svgNonScalingStroke: value.svgNonScalingStroke === true, ...(isColor(value.fillColor) ? { fillColor: value.fillColor, fillOpacity: finite(value.fillOpacity) ? Math.max(0, Math.min(1, value.fillOpacity)) : 1 } : {}), opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1 };
  }
  if (["rectangle", "circle", "diamond", "triangle", "flowchart", "line", "arrow"].includes(value.type)) {
    if (!finite(value.x) || !finite(value.y) || !finite(value.w) || !finite(value.h) || !isColor(value.color) || !finite(value.thickness) || value.thickness <= 0) return undefined;
    if (value.schemaDiagramId !== undefined && typeof value.schemaDiagramId !== "string") return undefined;
    const lineStyle: StrokeStyle = ["dashed", "dotted", "double"].includes(String(value.lineStyle)) ? value.lineStyle as StrokeStyle : "solid";
    const edgeStyle: EdgeStyle = ["rounded", "pill", "cut"].includes(String(value.edgeStyle)) ? value.edgeStyle as EdgeStyle : "sharp";
    const fillColor = isColor(value.fillColor) ? value.fillColor : undefined;
    const fillOpacity = finite(value.fillOpacity) ? Math.max(0, Math.min(1, value.fillOpacity)) : 0.2;
    const validHead = (head: unknown): head is ArrowHead => ["none", "open", "solid", "hollow", "thick", "dot", "diamond", "open-diamond", "bar", "crow"].includes(String(head));
    const flowchartShape: FlowchartShape = ALL_FLOWCHART_SHAPES.some(shape => shape.value === value.flowchartShape) ? value.flowchartShape as FlowchartShape : "process";
    const savedLineRoute = String(value.lineRoute);
    const lineRoute: LineRoute = savedLineRoute === "elbow" ? "elbow" : ["curve", "curve2", "curve3", "multi"].includes(savedLineRoute) ? "curve" : "straight";
    const oldCurveNodeCount = savedLineRoute === "curve2" ? 2 : savedLineRoute === "curve3" ? 3 : savedLineRoute === "multi" ? 4 : 1;
    const connectionPoints = value.connectionPoints === undefined ? undefined : normalizeConnectionPoints(value.connectionPoints);
    if (value.connectionPoints !== undefined && connectionPoints === undefined) return undefined;
    const thickness = Math.max(1, Math.round(value.thickness));
    const cornerRadius = finite(value.cornerRadius) ? Math.max(0, Math.min(100, value.cornerRadius)) : undefined;
    const arrowRoute: ArrowRoute = ["elbow", "curve", "forked", "loop", "jagged"].includes(String(value.arrowRoute)) ? value.arrowRoute as ArrowRoute : "straight";
    const binding = (raw: unknown): Binding | undefined => isRecord(raw) && typeof raw.elementId === "string" && isRecord(raw.anchor) && finite(raw.anchor.x) && finite(raw.anchor.y) && raw.anchor.x >= 0 && raw.anchor.x <= 1 && raw.anchor.y >= 0 && raw.anchor.y <= 1 && (raw.rowId === undefined || typeof raw.rowId === "string") && (raw.portId === undefined || typeof raw.portId === "string" && /^[\w.-]{1,80}$/.test(raw.portId)) ? { elementId: raw.elementId, anchor: { x: raw.anchor.x, y: raw.anchor.y }, ...(typeof raw.rowId === "string" ? { rowId: raw.rowId } : {}), ...(typeof raw.portId === "string" ? { portId: raw.portId } : {}) } : undefined;
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
      : lineRoute === "curve" ? storedRoutePoints ?? defaultCurveControlPoints({ ...controlBase, routePoints: undefined }, oldCurveNodeCount)
      : storedRoutePoints;
    const relationshipType: RelationshipType | undefined = ["association", "dependency", "data-flow", "inheritance", "aggregation", "composition", "sequence", "network", "other"].includes(String(value.relationshipType)) ? value.relationshipType as RelationshipType : undefined;
    const relationshipDirection: RelationshipDirection | undefined = ["forward", "both", "none"].includes(String(value.relationshipDirection)) ? value.relationshipDirection as RelationshipDirection : undefined;
    const transportSecurity: TransportSecurity | undefined = ["encrypted", "unencrypted", "unknown"].includes(String(value.transportSecurity)) ? value.transportSecurity as TransportSecurity : undefined;
    return { type: value.type as ShapeElement["type"], ...flags, ...(connectionPoints ? { connectionPoints } : {}), startBinding: binding(value.startBinding), endBinding: binding(value.endBinding), routePoints: normalizedRoutePoints, ...(autoRoute ? { autoRoute: true, routeWaypoints: value.routeWaypoints as Point[] | undefined } : {}), ...(straightOnly ? { straightOnly: true } : {}), forkUpper: straightOnly ? undefined : forkUpper ?? undefined, forkLower: straightOnly ? undefined : forkLower ?? undefined, label, x: value.x, y: value.y, w: value.w, h: value.h, color: value.color, thickness, fillColor, fillOpacity, lineStyle, edgeStyle, cornerRadius, flowchartShape: value.type === "flowchart" ? flowchartShape : undefined, lineRoute: value.type === "line" ? straightOnly ? "straight" : lineRoute : undefined, arrowRoute: value.type === "arrow" ? straightOnly ? "straight" : arrowRoute : undefined, startHead: value.type === "arrow" || value.type === "line" ? validHead(value.startHead) ? value.startHead : "none" : undefined, endHead: value.type === "arrow" || value.type === "line" ? validHead(value.endHead) ? value.endHead : value.type === "arrow" ? "open" : "none" : undefined, opacity: finite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1, ...(typeof value.cardinality === "string" && value.cardinality.length <= 40 ? { cardinality: value.cardinality } : {}), ...(typeof value.protocol === "string" && value.protocol.length <= 40 ? { protocol: value.protocol } : {}), ...(finite(value.portNumber) && value.portNumber >= 1 && value.portNumber <= 65535 ? { portNumber: Math.round(value.portNumber) } : {}), ...(typeof value.apiContract === "string" && value.apiContract.length <= 2000 ? { apiContract: value.apiContract } : {}), ...(typeof value.dataContract === "string" && value.dataContract.length <= 2000 ? { dataContract: value.dataContract } : {}), ...(typeof value.sequenceCondition === "string" && value.sequenceCondition.length <= 500 ? { sequenceCondition: value.sequenceCondition } : {}), ...(value.sequenceDefault === true ? { sequenceDefault: true } : {}), ...(relationshipType ? { relationshipType } : {}), ...(relationshipDirection ? { relationshipDirection } : {}), ...(transportSecurity ? { transportSecurity } : {}), ...(typeof value.schemaDiagramId === "string" ? { schemaDiagramId: value.schemaDiagramId } : {}) };
  }
  return undefined;
}

type SupportedSketchEnvelope = { kind: "remastered-v2" | "legacy-v10"; canvas: Record<string, unknown>; legacyLibrary?: never }
  | { kind: "legacy-v9"; canvas: Record<string, unknown>; legacyLibrary: unknown };

/** Keep accepted file versions and their envelope migrations explicit. */
function supportedSketchEnvelope(value: Record<string, unknown>): SupportedSketchEnvelope | undefined {
  if (value.format !== "SketchDraw") return undefined;
  if (value.version === SKETCH_FORMAT_VERSION && isRecord(value.canvas) && !("sections" in value) && !("project" in value) && !("library" in value)) {
    return { kind: "remastered-v2", canvas: value.canvas };
  }
  if ((value.version !== 9 && value.version !== 10) || !isRecord(value.sections)) return undefined;
  const sections = value.sections;
  if (!isRecord(sections.canvas)) return undefined;
  const canvas = sections.canvas;
  if (value.version === 9) {
    const notebook = sections.notebook;
    const retiredLibraryArchive = sections.retiredLibraryArchive;
    if (!isRecord(notebook) || !Array.isArray(notebook.notes) || !isRecord(retiredLibraryArchive)) return undefined;
    return {
      kind: "legacy-v9",
      canvas,
      legacyLibrary: { ...retiredLibraryArchive, quickNotes: notebook.notes },
    };
  }
  return { kind: "legacy-v10", canvas };
}

export function parseSketchFile(value: unknown): SketchFile | undefined {
  if (!isRecord(value)) return undefined;
  const envelope = supportedSketchEnvelope(value);
  if (!envelope) return undefined;
  const isLegacyV9 = envelope.kind === "legacy-v9";
  const canvasSection = envelope.canvas;
  const libraryValue = envelope.kind === "legacy-v9" ? envelope.legacyLibrary : undefined;
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
      const group: GroupElement = { type: "group", id: crypto.randomUUID(), componentId, elements: parts, libraryComponent: { kind: "uml-class" } };
      return [group];
    });
  };
  const normalizePage = (id: unknown, name: unknown, stateValue: unknown, elementsValue: unknown, budget: ElementParseBudget, rawLayers?: unknown, rawMasters?: unknown, rawVisibilityPresets?: unknown, rawDataSources?: unknown): SketchPage | undefined => {
    if (typeof id !== "string" || typeof name !== "string" || !isRecord(stateValue) || !Array.isArray(elementsValue) || elementsValue.length > MAX_ELEMENTS_PER_PAGE) return undefined;
    const state = stateValue;
    if (!finite(state.zoom) || state.zoom <= 0 || !finite(state.panX) || !finite(state.panY) || !isColor(state.backgroundColor)) return undefined;
    const elements = elementsValue.map(element => normalizeElementWithinBudget(element, 0, budget));
    if (elements.some((element) => !element)) return undefined;
    let normalizedElements = groupLegacyClassCards(elements as Element[]);
    if (!validReferences(normalizedElements)) return undefined;
    const normalizedLayers = normalizeCanvasLayers(rawLayers);
    if (!normalizedLayers) return undefined;
    let layers: CanvasLayer[] = normalizedLayers;
    const layerIds = new Set(layers.map(layer => layer.id));
    const presetIds = new Set<string>();
    const visibilityPresets: CanvasLayerVisibilityPreset[] = Array.isArray(rawVisibilityPresets) && rawVisibilityPresets.length <= 24
      ? rawVisibilityPresets.flatMap(raw => {
        if (!isRecord(raw) || typeof raw.id !== "string" || !/^[\w.-]{1,100}$/.test(raw.id) || presetIds.has(raw.id) || typeof raw.name !== "string" || !raw.name.trim() || raw.name.length > 80 || !Array.isArray(raw.hiddenLayerIds) || raw.hiddenLayerIds.length > 500) return [];
        presetIds.add(raw.id);
        return [{ id: raw.id, name: raw.name.trim().slice(0, 80), hiddenLayerIds: [...new Set(raw.hiddenLayerIds.filter((value): value is string => typeof value === "string" && layerIds.has(value)))].slice(0, 500) }];
      })
      : [];
    const dataSources = rawDataSources === undefined ? [] : normalizeCanvasDataSources(rawDataSources);
    if (!dataSources) return undefined;
    const dataSourceIds = new Set(dataSources.map(source => source.id));
    const validateDataBindings = (items: Element[]): Element[] => items.map(item => {
      const { dataBinding, ...rest } = item;
      const binding = dataBinding && dataSourceIds.has(dataBinding.sourceId) ? dataBinding : undefined;
      if (item.type !== "group") return binding ? { ...rest, dataBinding: binding } as Element : rest as Element;
      const children = validateDataBindings(item.elements);
      return { ...rest, ...(binding ? { dataBinding: binding } : {}), elements: children } as Element;
    });
    const layerPaths = new Map<string, string>();
    const assignLayerIds = (items: Element[]): Element[] => items.map(item => {
      let layerId = item.layerId;
      if (!layerId && item.layerName) {
        const path = item.layerName.split("/").map(part => part.trim()).filter(Boolean).join(" / ");
        let resolved = layerPaths.get(path);
        if (!resolved) { const result = ensureCanvasLayerPath(layers, path); layers = result.layers; resolved = result.id; if (resolved) layerPaths.set(path, resolved); }
        layerId = resolved;
      }
      if (layerId && !layers.some(layer => layer.id === layerId)) layers = [...layers, { id: layerId, name: item.layerName?.split("/").pop()?.trim() || "Recovered layer", order: layers.length }];
      if (item.type !== "group") return layerId === item.layerId ? item : { ...item, layerId } as Element;
      const children = assignLayerIds(item.elements);
      return layerId === item.layerId && children.every((child, index) => child === item.elements[index]) ? item : { ...item, layerId, elements: children };
    });
    normalizedElements = assignLayerIds(validateDataBindings(normalizedElements));
    const guides = Array.isArray(state.guides) && state.guides.length <= 200 && state.guides.every(guide => isRecord(guide) && (guide.axis === "x" || guide.axis === "y") && finite(guide.position) && Math.abs(guide.position) <= 1_000_000_000)
      ? state.guides.map(guide => ({ axis: guide.axis as "x" | "y", position: guide.position as number })) : undefined;
    const componentMasters = Array.isArray(rawMasters) && rawMasters.length <= 100 ? rawMasters.flatMap(raw => {
      if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.name !== "string" || !Array.isArray(raw.template) || !raw.template.length || raw.template.length > MAX_ELEMENTS_PER_PAGE || !isRecord(raw.bounds) || !finite(raw.bounds.x) || !finite(raw.bounds.y) || !finite(raw.bounds.w) || !finite(raw.bounds.h) || raw.bounds.w <= 0 || raw.bounds.h <= 0) return [];
      const template = raw.template.map(item => normalizeElementWithinBudget(item, 0, budget));
      if (template.some(item => !item) || !validReferences(template as Element[])) return [];
      const connectionPoints = Array.isArray(raw.connectionPoints) && raw.connectionPoints.length <= 32 ? raw.connectionPoints.flatMap(point => isRecord(point) && typeof point.id === "string" && typeof point.name === "string" && isRecord(point.anchor) && finite(point.anchor.x) && finite(point.anchor.y) && point.anchor.x >= 0 && point.anchor.x <= 1 && point.anchor.y >= 0 && point.anchor.y <= 1 ? [{ id: point.id.slice(0, 80), name: point.name.slice(0, 80), anchor: { x: point.anchor.x, y: point.anchor.y } }] : []) : undefined;
      const variants = isRecord(raw.variants) ? Object.entries(raw.variants).slice(0, 24).flatMap(([key, value]) => {
        if (!/^[\p{L}\p{N}_.=-]{1,80}$/u.test(key) || !Array.isArray(value) || !value.length || value.length > MAX_ELEMENTS_PER_PAGE) return [];
        const normalizedVariant = value.map(item => normalizeElementWithinBudget(item, 0, budget));
        return normalizedVariant.some(item => !item) || !validReferences(normalizedVariant as Element[]) ? [] : [[key, normalizedVariant as Element[]] as const];
      }) : [];
      return [{ id: raw.id.slice(0, 80), name: raw.name.trim().slice(0, 80) || "Component", template: template as Element[], bounds: { x: raw.bounds.x, y: raw.bounds.y, w: raw.bounds.w, h: raw.bounds.h }, ...(variants.length ? { variants: Object.fromEntries(variants) } : {}), ...(typeof raw.variantKey === "string" ? { variantKey: raw.variantKey.slice(0, 80) } : {}), ...(connectionPoints?.length ? { connectionPoints } : {}), ...(finite(raw.createdAt) ? { createdAt: raw.createdAt } : {}) }];
    }) : [];
    return { id, name: name.slice(0, 80), canvasState: { zoom: state.zoom, panX: state.panX, panY: state.panY, backgroundColor: state.backgroundColor, boardColorFollowsTheme: typeof state.boardColorFollowsTheme === "boolean" ? state.boardColorFollowsTheme : state.backgroundColor === "#ffffff", ...(guides?.length ? { guides } : {}) }, elements: normalizedElements, ...(layers.length ? { layers } : {}), ...(visibilityPresets.length ? { visibilityPresets } : {}), ...(dataSources.length ? { dataSources } : {}), ...(componentMasters.length ? { componentMasters } : {}) };
  };
  const sourcePages = Array.isArray(canvasSection.pages) ? canvasSection.pages : undefined;
  if (!sourcePages || sourcePages.length < 1 || sourcePages.length > 100) return undefined;
  const elementBudget = { remaining: MAX_DOCUMENT_ELEMENT_NODES, remainingStrokePoints: MAX_DOCUMENT_STROKE_POINTS };
  const pages = sourcePages.map((page, index) => {
    if (!isRecord(page)) return undefined;
    const state = isRecord(page.canvasState) ? page.canvasState : {};
    const migratedState = isLegacyV9 ? { zoom: finite(state.zoom) && state.zoom > 0 ? state.zoom : 1, panX: finite(state.panX) ? state.panX : 0, panY: finite(state.panY) ? state.panY : 0, backgroundColor: isColor(state.backgroundColor) ? state.backgroundColor : "#ffffff", ...(typeof state.boardColorFollowsTheme === "boolean" ? { boardColorFollowsTheme: state.boardColorFollowsTheme } : {}) } : state;
    return normalizePage(typeof page.id === "string" ? page.id : crypto.randomUUID(), typeof page.name === "string" ? page.name : "Page " + (index + 1), migratedState, page.elements, elementBudget, page.layers, page.componentMasters ?? (index === 0 ? canvasSection.componentMasters : undefined), page.visibilityPresets, page.dataSources);
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
  const library = normalizeLegacyLibraryData(libraryValue);
  if (!library) return undefined;
  return { format: "SketchDraw", version: SKETCH_FORMAT_VERSION, activePageId, pages: normalized, library, ...(windowsSync ? { windowsSync } : {}) };
}

/** Keeps files written by the app inside the same resource limits as files it can reopen. */
export function sketchFileResourceError(file: SketchFile): string | undefined {
  let nodeCount = 0;
  let strokePointCount = 0;
  let dataSourceCharacters = 0;
  const componentMasters = new Map<string, ComponentMaster>();
  const visit = (elements: Element[], depth: number): string | undefined => {
    if (depth > MAX_ELEMENT_DEPTH) return "This sketch contains groups nested too deeply to save safely.";
    for (const element of elements) {
      nodeCount += 1;
      if (nodeCount > MAX_DOCUMENT_ELEMENT_NODES) return "This sketch contains too many canvas objects to save safely.";
      if (element.type === "group") {
        if (element.elements.length > MAX_ELEMENTS_PER_PAGE) return "A group contains too many canvas objects to save safely.";
        const error = visit(element.elements, depth + 1);
        if (error) return error;
        if (element.stencilParameters) {
          const parameterError = visit(element.stencilParameters.template, depth + 1);
          if (parameterError) return parameterError;
        }
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
    const dataSources = normalizeCanvasDataSources(page.dataSources ?? []);
    if (!dataSources) return "This sketch contains invalid or oversized linked data.";
    for (const source of dataSources) dataSourceCharacters += source.name.length + source.headers.reduce((sum, header) => sum + header.length, 0) + source.rows.reduce((sum, row) => sum + row.reduce((rowSum, cell) => rowSum + cell.length, 0), 0);
    if (dataSourceCharacters > 20_000_000) return "CSV-linked data exceeds the 20 MB per-sketch save limit.";
    const error = visit(page.elements, 0);
    if (error) return error;
    for (const master of page.componentMasters ?? []) {
      const existing = componentMasters.get(master.id);
      if (existing && existing !== master && JSON.stringify(existing) !== JSON.stringify(master)) return `Component master “${master.name}” has a conflicting duplicate ID and cannot be saved safely.`;
      componentMasters.set(master.id, master);
    }
  }
  if (componentMasters.size > 100) return "A sketch can contain up to 100 component masters.";
  for (const master of componentMasters.values()) {
    if (!master.id || master.id.length > 80 || !master.name.trim() || master.name.length > 80) return "A component master has invalid identifying details and cannot be saved safely.";
    if (!finite(master.bounds.x) || !finite(master.bounds.y) || !finite(master.bounds.w) || !finite(master.bounds.h) || master.bounds.w <= 0 || master.bounds.h <= 0) return `Component master “${master.name}” has invalid bounds and cannot be saved safely.`;
    if (!master.template.length || master.template.length > MAX_ELEMENTS_PER_PAGE) return `Component master “${master.name}” has an invalid template size.`;
    const masterError = visit(master.template, 0);
    if (masterError) return masterError;
    const variants = Object.entries(master.variants ?? {});
    if (variants.length > 24) return `Component master “${master.name}” has too many variants to save safely.`;
    for (const [key, variant] of variants) {
      if (!/^[\p{L}\p{N}_.=-]{1,80}$/u.test(key) || !variant.length || variant.length > MAX_ELEMENTS_PER_PAGE) return `Component master “${master.name}” has an invalid variant.`;
      const variantError = visit(variant, 0);
      if (variantError) return variantError;
    }
    if ((master.connectionPoints?.length ?? 0) > 32) return `Component master “${master.name}” has too many connection points to save safely.`;
  }
  return undefined;
}
