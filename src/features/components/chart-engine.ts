import * as echarts from "echarts/core";
import {
  BarChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
  TreemapChart,
} from "echarts/charts";
import {
  AriaComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  RadarComponent,
  TitleComponent,
  VisualMapComponent,
} from "echarts/components";
import type { EChartsOption } from "echarts";
import type { GroupElement, LibraryChartData, LibraryChartKind, Theme } from "../../model";
import { defaultLibraryChartData } from "../../notes";
import { elementBounds, unionBounds } from "../canvas/bounds";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";

echarts.use([
  AriaComponent,
  BarChart,
  FunnelChart,
  GaugeChart,
  GraphicComponent,
  GridComponent,
  HeatmapChart,
  LegendComponent,
  LineChart,
  PieChart,
  RadarChart,
  RadarComponent,
  ScatterChart,
  TitleComponent,
  TreemapChart,
  VisualMapComponent,
  CanvasRenderer,
  SVGRenderer,
]);

const colorSets: Record<NonNullable<NonNullable<LibraryChartData["options"]>["palette"]>, string[]> = {
  blue: ["#3977c3", "#2e9a7a", "#eda33a", "#8966bd", "#d6676d", "#4d9ca9", "#9a8058", "#657997"],
  ocean: ["#176b87", "#2d9c9a", "#55bd95", "#78b8d0", "#436f9e", "#70a77b", "#3c879a", "#a2c7c7"],
  warm: ["#c65d45", "#df8b36", "#e5ba4a", "#8c694d", "#d87977", "#a85e3f", "#8b7a52", "#b88963"],
  violet: ["#6548b6", "#9b66c8", "#4b79c1", "#38a38b", "#d18b42", "#c65d75", "#7d87bd", "#56a4b3"],
  mono: ["#24292e", "#59636d", "#7a848d", "#a1a8ae", "#4b6578", "#697c8b", "#8d9aa5", "#bec4c9"],
};

type DataSeries = { name: string; values: number[]; chartType?: "bar" | "line" | "area" | "scatter"; axis?: "primary" | "secondary"; color?: string };
type CachedChart = { canvas: HTMLCanvasElement; chart: ReturnType<typeof echarts.init>; signature: string; width: number; height: number; dpr: number; pixels: number; lastUsed: number };
const chartCache = new Map<string, CachedChart>();
const MAX_CACHED_CHARTS = 16;
const MAX_CACHED_PIXELS = 32_000_000;
const MAX_CHART_PIXELS = 12_000_000;
let cacheClock = 0;
let cachedPixels = 0;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const finite = (value: number) => Number.isFinite(value) ? clamp(value, -1_000_000_000, 1_000_000_000) : 0;
const familyFor = (family?: string) => family === "serif" ? "Georgia, serif" : family === "mono" ? "monospace" : family === "hand" ? "cursive" : family === "display" ? "Impact, sans-serif" : family === "rounded" ? "Trebuchet MS, sans-serif" : "system-ui, sans-serif";
const compactNumber = (value: number) => {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (magnitude >= 10_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(3)));
};

function chartIdentity(group: GroupElement) {
  return group.id ?? group.componentId ?? `${group.libraryComponent?.kind ?? "chart"}:${group.componentBounds?.x ?? 0}:${group.componentBounds?.y ?? 0}:${group.libraryComponent?.label ?? ""}`;
}

function chartOption(group: GroupElement, theme: Theme, width: number, height: number): EChartsOption | undefined {
  const meta = group.libraryComponent;
  const kind = meta?.kind as LibraryChartKind | undefined;
  if (!meta || !kind?.startsWith("viz-")) return undefined;

  const defaults = defaultLibraryChartData(kind);
  const data = meta.chartData ?? defaults ?? { labels: ["Item 1", "Item 2", "Item 3"], values: [3, 5, 4] };
  const settings = data.options ?? {};
  const labels = (data.labels.length ? data.labels : ["Item 1"]).slice(0, 20).map(label => String(label).slice(0, 60));
  const values = labels.map((_, index) => finite(data.values[index] ?? 0));
  const rawSeries = data.series?.length ? data.series : [{ name: "Series 1", values }];
  const series: DataSeries[] = rawSeries.slice(0, 8).map((item, index) => ({
    name: (item.name || `Series ${index + 1}`).slice(0, 60),
    values: labels.map((_, valueIndex) => finite(item.values[valueIndex] ?? 0)),
    ...(item.chartType ? { chartType: item.chartType } : {}),
    ...(item.axis ? { axis: item.axis } : {}),
    ...(item.color ? { color: item.color } : {}),
  }));
  const palette = colorSets[settings.palette ?? "blue"] ?? colorSets.blue;
  const dark = theme === "dark";
  const ink = meta.textStyle?.color ?? (dark ? "#e8edf2" : "#283643");
  const muted = dark ? "#aeb9c4" : "#687887";
  const gridColor = dark ? "#39444e" : "#e4eaf0";
  const edge = dark ? "#4a5662" : "#d7dfe6";
  const surface = meta.styleOverrides?.fillColor === null ? "transparent" : meta.styleOverrides?.fillColor ?? (dark ? "#20272e" : "#ffffff");
  const fontFamily = familyFor(meta.textStyle?.fontFamily);
  const fontSize = clamp(meta.textStyle?.fontSize ?? 12, 8, 18);
  const title = (data.title ?? meta.label ?? "Chart").trim().slice(0, 80) || "Chart";
  const legendPosition = settings.legend ?? "right";
  const pieChart = kind === "viz-pie" || kind === "viz-donut";
  const legendItems = pieChart ? labels : series.map(item => item.name);
  const showLegend = legendPosition !== "hidden" && (pieChart || series.length > 1);
  const showValues = !!settings.showValues;
  const categoryColor = (label: string, index: number) => settings.categoryColors?.[label] ?? palette[index % palette.length];
  const seriesColor = (item: DataSeries, index: number) => item.color ?? palette[index % palette.length];
  const sortedIndexes = labels.map((_label, index) => index);
  if (settings.sort && settings.sort !== "original" && ["viz-bar", "viz-horizontal-bar", "viz-stacked-bar", "viz-pie", "viz-donut", "viz-funnel", "viz-treemap"].includes(kind)) {
    const direction = settings.sort === "ascending" ? 1 : -1;
    sortedIndexes.sort((a, b) => ((values[a] ?? 0) - (values[b] ?? 0)) * direction);
  }
  const sortedLabels = sortedIndexes.map(index => labels[index]);
  const sortedValues = sortedIndexes.map(index => values[index]);
  const sortedSeries = series.map(item => ({ ...item, values: sortedIndexes.map(index => item.values[index] ?? 0) }));
  const textStyle = { color: ink, fontFamily, fontSize: clamp(fontSize * .84, 8, 15), fontStyle: meta.textStyle?.italic ? "italic" : "normal", fontWeight: meta.textStyle?.bold ? 700 : 400, textDecoration: meta.textStyle?.underline ? "underline" : "none" };
  const titleSize = clamp(fontSize, 10, 16);
  const rightLegend = showLegend && legendPosition === "right";
  const bottomLegend = showLegend && legendPosition === "bottom";
  const baseOption: Record<string, unknown> = {
    animation: false,
    backgroundColor: surface,
    color: palette,
    textStyle,
    aria: { enabled: true },
    title: { text: title, left: 10, top: 5, textStyle: { ...textStyle, fontSize: titleSize, fontWeight: meta.textStyle?.bold === true ? 700 : meta.textStyle?.bold === false ? 400 : 600 } },
    legend: {
      show: showLegend,
      type: "scroll",
      orient: rightLegend ? "vertical" : "horizontal",
      data: legendItems,
      right: rightLegend ? 6 : undefined,
      top: rightLegend ? "middle" : undefined,
      left: bottomLegend ? "center" : undefined,
      bottom: bottomLegend ? 3 : undefined,
      textStyle: { ...textStyle, color: muted, fontSize: clamp(fontSize * .75, 8, 12) },
      itemWidth: 10,
      itemHeight: 8,
      pageIconColor: ink,
      pageTextStyle: { color: muted },
    },
    grid: {
      left: 12,
      right: rightLegend ? Math.min(104, width * .34) : 12,
      top: 34,
      bottom: bottomLegend ? Math.min(46, height * .3) : 26,
      containLabel: true,
    },
    axisPointer: { show: false },
  };

  if (kind === "viz-kpi") {
    const amount = values[0] ?? 0;
    const change = values[1] ?? 0;
    const trend = meta.trendDirection ?? (change > 0 ? "up" : change < 0 ? "down" : "steady");
    const trendColor = trend === "up" ? palette[1] : trend === "down" ? palette[4] : muted;
    baseOption.title = { show: false };
    baseOption.grid = { show: false };
    baseOption.graphic = [
      { type: "text", left: 14, top: "28%", style: { text: compactNumber(amount), fill: ink, font: `700 ${clamp(height * .3, 22, 36)}px ${fontFamily}` } },
      { type: "text", left: 14, top: "72%", style: { text: `${trend === "up" ? "+" : trend === "down" ? "−" : ""}${compactNumber(Math.abs(change))}%`, fill: trendColor, font: `700 12px ${fontFamily}` } },
      { type: "text", left: 66, top: "72%", style: { text: labels[1] ?? "Change", fill: muted, font: `10px ${fontFamily}` } },
    ];
    return baseOption as EChartsOption;
  }

  if (kind === "viz-pie" || kind === "viz-donut") {
    baseOption.series = [{
      type: "pie",
      name: title,
      radius: kind === "viz-donut" ? ["48%", "70%"] : [0, "70%"],
      center: rightLegend ? ["36%", "58%"] : ["50%", "57%"],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: surface === "transparent" ? (dark ? "#20272e" : "#ffffff") : surface, borderWidth: 2, borderRadius: 3 },
      label: { show: showValues, color: ink, fontFamily, fontSize: 9, formatter: "{b}: {c}" },
      labelLine: { show: showValues, length: 8, length2: 5 },
      data: sortedLabels.map((name, index) => ({ name, value: Math.max(0, sortedValues[index] ?? 0), itemStyle: { color: categoryColor(name, sortedIndexes[index]) } })),
    }];
  } else if (kind === "viz-gauge") {
    const maxValue = Math.max(1, finite(settings.maxValue ?? 100));
    baseOption.series = [{
      type: "gauge",
      min: 0,
      max: maxValue,
      center: ["50%", "58%"],
      radius: "82%",
      progress: { show: true, width: 13, roundCap: true, itemStyle: { color: palette[0] } },
      axisLine: { lineStyle: { width: 13, color: [[1, gridColor]] } },
      axisTick: { show: false },
      splitLine: { distance: -18, length: 5, lineStyle: { color: edge, width: 1 } },
      axisLabel: { distance: 17, color: muted, fontFamily, fontSize: 8 },
      pointer: { length: "58%", width: 3, itemStyle: { color: ink } },
      anchor: { show: true, size: 6, itemStyle: { color: ink } },
      title: { show: true, offsetCenter: [0, "64%"], color: muted, fontFamily, fontSize: 10 },
      detail: { valueAnimation: false, offsetCenter: [0, "38%"], color: ink, fontFamily, fontSize: 20, fontWeight: 700, formatter: "{value}" },
      data: [{ name: labels[0] ?? "Value", value: clamp(values[0] ?? 0, 0, maxValue) }],
    }];
  } else if (kind === "viz-funnel") {
    baseOption.series = [{
      type: "funnel",
      left: "8%",
      top: 34,
      bottom: bottomLegend ? 35 : 8,
      width: rightLegend ? "62%" : "84%",
      min: 0,
      max: Math.max(1, ...sortedValues),
      minSize: "8%",
      maxSize: "100%",
      sort: "none",
      gap: 3,
      label: { show: true, position: rightLegend ? "inside" : "inside", color: "#ffffff", fontFamily, fontSize: 9, formatter: showValues ? "{b}: {c}" : "{b}" },
      labelLine: { show: false },
      itemStyle: { borderColor: surface, borderWidth: 1, borderRadius: 2 },
      data: sortedLabels.map((name, index) => ({ name, value: Math.max(0, sortedValues[index] ?? 0), itemStyle: { color: categoryColor(name, sortedIndexes[index]) } })),
    }];
  } else if (kind === "viz-treemap") {
    baseOption.series = [{
      type: "treemap",
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      squareRatio: 1.2,
      top: 32,
      bottom: bottomLegend ? 30 : 8,
      right: rightLegend ? 100 : 8,
      left: 8,
      label: { show: true, color: "#ffffff", fontFamily, fontSize: 9, overflow: "truncate", formatter: showValues ? "{b}\n{c}" : "{b}" },
      upperLabel: { show: false },
      itemStyle: { borderColor: surface, borderWidth: 2, gapWidth: 2, borderRadius: 3 },
      data: sortedLabels.map((name, index) => ({ name, value: Math.max(0, sortedValues[index] ?? 0), itemStyle: { color: categoryColor(name, sortedIndexes[index]) } })),
    }];
  } else if (kind === "viz-radar") {
    const maxValue = Math.max(1, ...series.flatMap(item => item.values.map(value => Math.abs(value))));
    baseOption.radar = {
      center: [rightLegend ? "37%" : "50%", "58%"],
      radius: rightLegend ? "63%" : "67%",
      indicator: labels.map(name => ({ name, max: maxValue })),
      axisName: { color: muted, fontFamily, fontSize: 9 },
      axisLine: { lineStyle: { color: edge } },
      splitLine: { lineStyle: { color: gridColor } },
      splitArea: { areaStyle: { color: ["transparent", dark ? "rgba(255,255,255,.025)" : "rgba(40,60,80,.025)"] } },
    };
    baseOption.series = sortedSeries.map((item, index) => ({
      type: "radar",
      name: item.name,
      lineStyle: { color: seriesColor(item, index), width: settings.lineWidth ?? 2 },
      itemStyle: { color: seriesColor(item, index) },
      areaStyle: { color: seriesColor(item, index), opacity: series.length === 1 ? .2 : .12 },
      symbol: settings.showPoints === false ? "none" : "circle",
      symbolSize: settings.pointSize ?? 6,
      data: [{ name: item.name, value: item.values }],
    }));
  } else if (kind === "viz-heatmap") {
    const flatValues = series.flatMap(item => item.values);
    baseOption.grid = { left: 42, right: rightLegend ? 74 : 10, top: 34, bottom: bottomLegend ? 30 : 10, containLabel: true };
    baseOption.xAxis = { type: "category", data: labels, axisLine: { lineStyle: { color: edge } }, axisLabel: { color: muted, fontFamily, fontSize: 8, rotate: labels.length > 6 ? 25 : 0 }, splitArea: { show: true } };
    baseOption.yAxis = { type: "category", data: series.map(item => item.name), axisLine: { lineStyle: { color: edge } }, axisLabel: { color: muted, fontFamily, fontSize: 8 }, splitArea: { show: true } };
    baseOption.visualMap = { min: Math.min(0, ...flatValues), max: Math.max(1, ...flatValues), calculable: false, orient: rightLegend ? "vertical" : "horizontal", left: rightLegend ? "right" : "center", top: rightLegend ? "middle" : "bottom", inRange: { color: dark ? ["#293947", "#32738d", "#8bd6c5"] : ["#eff5fb", "#70a7d8", "#245c9a"] }, textStyle: { color: muted, fontFamily, fontSize: 8 } };
    baseOption.series = [{ type: "heatmap", data: series.flatMap((item, seriesIndex) => item.values.map((value, labelIndex) => [labelIndex, seriesIndex, value])), label: { show: showValues, color: ink, fontFamily, fontSize: 8 }, itemStyle: { borderColor: surface, borderWidth: 2, borderRadius: 2 }, emphasis: { itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,.25)" } } }];
  } else {
    const horizontal = kind === "viz-horizontal-bar";
    const stacked = kind === "viz-stacked-bar";
    const defaultType = kind === "viz-bar" || kind === "viz-horizontal-bar" || kind === "viz-stacked-bar" ? "bar" : kind === "viz-scatter" ? "scatter" : kind === "viz-area" ? "area" : "line";
    const hasSecondary = (kind === "viz-line" || kind === "viz-area") && series.some(item => item.axis === "secondary");
    const categoryAxis = { type: "category", data: sortedLabels, boundaryGap: defaultType === "bar", axisLine: { lineStyle: { color: edge } }, axisTick: { show: false }, axisLabel: { color: muted, fontFamily, fontSize: 8, hideOverlap: true, rotate: labels.length > 7 ? 25 : 0 }, name: horizontal ? data.yAxisLabel : data.xAxisLabel, nameLocation: "middle", nameGap: 24 };
    const valueAxis = { type: "value", axisLine: { show: true, lineStyle: { color: edge } }, axisTick: { show: false }, axisLabel: { color: muted, fontFamily, fontSize: 8, formatter: (value: number) => compactNumber(value) }, splitLine: { show: settings.showGrid !== false, lineStyle: { color: gridColor, type: "dashed" } }, name: horizontal ? data.xAxisLabel : data.yAxisLabel, nameLocation: "middle", nameGap: horizontal ? 28 : 34 };
    baseOption.xAxis = horizontal ? valueAxis : categoryAxis;
    baseOption.yAxis = horizontal ? { ...categoryAxis, data: sortedLabels, inverse: true } : valueAxis;
    if (hasSecondary) baseOption.yAxis = [valueAxis, { ...valueAxis, position: "right", name: data.secondaryYAxisLabel, splitLine: { show: false } }];
    baseOption.series = sortedSeries.map((item, index) => {
      const seriesMode = kind === "viz-line" || kind === "viz-area" ? item.chartType ?? defaultType : kind === "viz-scatter" ? "scatter" : "bar";
      const chartType = seriesMode === "area" ? "line" : seriesMode;
      const areaSeries = seriesMode === "area";
      const barSeries = chartType === "bar";
      const dataValues = chartType === "scatter"
        ? sortedLabels.map((label, pointIndex) => [label, item.values[pointIndex] ?? 0])
        : barSeries && series.length === 1
        ? item.values.map((value, pointIndex) => ({ value, itemStyle: { color: categoryColor(sortedLabels[pointIndex], sortedIndexes[pointIndex]) } }))
        : item.values;
      const annotations = data.annotations?.filter(annotation => Number.isInteger(annotation.index) && annotation.index >= 0 && annotation.index < labels.length).map(annotation => ({ name: annotation.label.slice(0, 80), value: annotation.label.slice(0, 80), coord: [labels[annotation.index], finite(annotation.value ?? item.values[annotation.index] ?? 0)] }));
      return {
        type: chartType,
        name: item.name,
        data: dataValues,
        ...(barSeries ? { stack: stacked ? "total" : undefined, barMaxWidth: 38, itemStyle: { color: series.length > 1 ? seriesColor(item, index) : undefined, borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] }, label: { show: showValues, position: horizontal ? "right" : "top", color: ink, fontFamily, fontSize: 8 } } : {}),
        ...(chartType === "line" ? { yAxisIndex: item.axis === "secondary" && hasSecondary ? 1 : 0, smooth: !!settings.smooth, showSymbol: settings.showPoints !== false, symbol: "circle", symbolSize: settings.pointSize ?? 7, lineStyle: { color: seriesColor(item, index), width: settings.lineWidth ?? 2, cap: "round" }, itemStyle: { color: seriesColor(item, index) }, ...(areaSeries ? { areaStyle: { color: seriesColor(item, index), opacity: .18 } } : {}), label: { show: showValues, position: "top", color: ink, fontFamily, fontSize: 8 }, ...(annotations?.length ? { markPoint: { symbol: "pin", symbolSize: 26, data: annotations, label: { show: true, formatter: "{b}", fontFamily, fontSize: 8 } } } : {}) } : {}),
        ...(chartType === "scatter" ? { yAxisIndex: item.axis === "secondary" && hasSecondary ? 1 : 0, symbolSize: settings.pointSize ?? 9, itemStyle: { color: seriesColor(item, index), opacity: .82 }, label: { show: showValues, position: "top", color: ink, fontFamily, fontSize: 8 } } : {}),
      };
    });
  }

  return baseOption as EChartsOption;
}

function disposeEntry(entry: CachedChart) {
  try { entry.chart.dispose(); } catch { /* A disposed chart cannot affect the canvas renderer. */ }
}

function evictChart(key: string) {
  const entry = chartCache.get(key);
  if (!entry) return;
  disposeEntry(entry);
  cachedPixels = Math.max(0, cachedPixels - entry.pixels);
  chartCache.delete(key);
}

function cachedChart(group: GroupElement, theme: Theme, width: number, height: number, dpr: number) {
  const option = chartOption(group, theme, width, height);
  if (!option) return undefined;
  const key = chartIdentity(group);
  const signature = JSON.stringify(option);
  let entry = chartCache.get(key);
  if (entry && (entry.width !== width || entry.height !== height || entry.dpr !== dpr)) {
    evictChart(key);
    entry = undefined;
  }
  if (!entry) {
    const canvas = document.createElement("canvas");
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const chart = echarts.init(canvas, null, { renderer: "canvas", width, height, devicePixelRatio: dpr, useDirtyRect: true });
    chart.setOption(option, true);
    const pixels = Math.ceil(width * dpr) * Math.ceil(height * dpr);
    entry = { canvas, chart, signature, width, height, dpr, pixels, lastUsed: ++cacheClock };
    chartCache.set(key, entry);
    cachedPixels += pixels;
  } else if (entry.signature !== signature) {
    entry.chart.setOption(option, true);
    entry.signature = signature;
    entry.lastUsed = ++cacheClock;
  } else {
    entry.lastUsed = ++cacheClock;
  }
  while ((chartCache.size > MAX_CACHED_CHARTS || cachedPixels > MAX_CACHED_PIXELS) && chartCache.size > 1) {
    const oldestKey = [...chartCache.entries()].reduce((oldest, current) => current[1].lastUsed < oldest[1].lastUsed ? current : oldest)[0];
    evictChart(oldestKey);
  }
  return entry.canvas;
}

export function drawLibraryChart(ctx: CanvasRenderingContext2D, group: GroupElement, theme: Theme) {
  const bounds = group.componentBounds ?? unionBounds(group.elements.filter(item => !item.hidden).map(elementBounds));
  if (!bounds || bounds.w <= 0 || bounds.h <= 0) return;
  const width = Math.max(1, bounds.w);
  const height = Math.max(1, bounds.h);
  const transform = ctx.getTransform();
  const zoomScale = Math.max(1, Math.hypot(transform.a, transform.b));
  const dprLimit = Math.min(4, Math.sqrt(MAX_CHART_PIXELS / (width * height)));
  const dpr = clamp(zoomScale, 1, Math.max(1, dprLimit));
  const canvas = cachedChart(group, theme, width, height, dpr);
  if (!canvas) return;
  ctx.save();
  ctx.translate(bounds.x, bounds.y);
  ctx.beginPath();
  ctx.rect(0, 0, bounds.w, bounds.h);
  ctx.clip();
  ctx.drawImage(canvas, 0, 0, bounds.w, bounds.h);
  ctx.restore();
}

export function renderLibraryChartSvg(group: GroupElement, theme: Theme = "light", renderWidth?: number, renderHeight?: number) {
  const bounds = group.componentBounds ?? unionBounds(group.elements.filter(item => !item.hidden).map(elementBounds));
  if (!bounds || bounds.w <= 0 || bounds.h <= 0) return "";
  const width = Math.max(1, renderWidth ?? bounds.w);
  const height = Math.max(1, renderHeight ?? bounds.h);
  const option = chartOption(group, theme, width, height);
  if (!option) return "";
  const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width, height });
  try {
    chart.setOption(option, true);
    const rendered = chart.renderToSVGString();
    const body = rendered.match(/^<svg[^>]*>([\s\S]*)<\/svg>$/)?.[1];
    if (!body) return "";
    return `<svg x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  } finally {
    chart.dispose();
  }
}
