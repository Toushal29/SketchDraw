import type { GroupElement, LibraryChartData, LibraryChartKind, Theme } from "../../model";
import { defaultLibraryChartData } from "../../notes";
import { elementBounds, unionBounds } from "../canvas/bounds";

type Point = { x: number; y: number };
type ChartNode =
  | { type: "rect"; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; lineWidth?: number; radius?: number; opacity?: number }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; lineWidth?: number; dash?: number[]; opacity?: number }
  | { type: "polyline"; points: Point[]; stroke?: string; fill?: string; lineWidth?: number; smooth?: boolean; closed?: boolean; opacity?: number }
  | { type: "polygon"; points: Point[]; fill?: string; stroke?: string; lineWidth?: number; opacity?: number }
  | { type: "circle"; x: number; y: number; r: number; fill?: string; stroke?: string; lineWidth?: number; opacity?: number }
  | { type: "sector"; x: number; y: number; r: number; inner: number; start: number; end: number; fill: string; stroke?: string; lineWidth?: number }
  | { type: "text"; x: number; y: number; value: string; size: number; fill: string; weight?: number; align?: CanvasTextAlign; baseline?: CanvasTextBaseline; maxWidth?: number; rotate?: number; family?: string; italic?: boolean; underline?: boolean };
type Series = { name: string; values: number[]; chartType?: "bar" | "line" | "area" | "scatter"; axis?: "primary" | "secondary" };
type ChartScene = { width: number; height: number; nodes: ChartNode[] };
type ChartPalette = { series: string[]; ink: string; muted: string; grid: string; edge: string; surface: string };

const palettes: Record<NonNullable<NonNullable<LibraryChartData["options"]>["palette"]>, string[]> = {
  blue: ["#3977c3", "#2e9a7a", "#eda33a", "#8966bd", "#d6676d", "#4d9ca9", "#9a8058", "#657997"],
  ocean: ["#176b87", "#2d9c9a", "#55bd95", "#78b8d0", "#436f9e", "#70a77b", "#3c879a", "#a2c7c7"],
  warm: ["#c65d45", "#df8b36", "#e5ba4a", "#8c694d", "#d87977", "#a85e3f", "#8b7a52", "#b88963"],
  violet: ["#6548b6", "#9b66c8", "#4b79c1", "#38a38b", "#d18b42", "#c65d75", "#7d87bd", "#56a4b3"],
  mono: ["#24292e", "#59636d", "#7a848d", "#a1a8ae", "#4b6578", "#697c8b", "#8d9aa5", "#bec4c9"],
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const finite = (value: number, fallback = 0) => Number.isFinite(value) ? clamp(value, -1_000_000_000, 1_000_000_000) : fallback;
const compactNumber = (value: number) => {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000) return (value / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m";
  if (magnitude >= 10_000) return (value / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(3)));
};
const niceStep = (range: number) => {
  const rough = Math.max(Number.EPSILON, range / 4);
  const power = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / power;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
};
const escapeXml = (value: string) => value.replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[char]!);
const familyFor = (family?: string) => family === "serif" ? "Georgia,serif" : family === "mono" ? "monospace" : family === "hand" ? "cursive" : family === "display" ? "Impact,sans-serif" : family === "rounded" ? "'Trebuchet MS',sans-serif" : "system-ui,sans-serif";

function fitLabel(value: string, width: number, size: number) {
  const maxCharacters = Math.max(1, Math.floor(width / Math.max(1, size * .56)));
  const clean = value.trim();
  return clean.length > maxCharacters ? clean.slice(0, Math.max(1, maxCharacters - 1)).trimEnd() + "…" : clean;
}

function contrastInk(color: string) {
  const channels = color.match(/[a-f\d]{2}/gi)?.slice(0, 3).map(value => parseInt(value, 16));
  if (!channels || channels.length !== 3) return "#ffffff";
  const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  return luminance > 155 ? "#1e2933" : "#ffffff";
}

function normalizeSeries(data: LibraryChartData, labels: string[]): Series[] {
  const supplied = data.series?.length
    ? data.series
    : [{ name: data.title || "Series 1", values: data.values }];
  return supplied.slice(0, 8).map((item, index) => ({
    name: (item.name || "Series " + (index + 1)).slice(0, 60),
    values: labels.map((_, valueIndex) => finite(item.values[valueIndex] ?? 0)),
    ...(item.chartType ? { chartType: item.chartType } : {}),
    ...(item.axis ? { axis: item.axis } : {}),
  }));
}

function pathData(points: Point[], smooth = false, closed = false) {
  if (!points.length) return "";
  let result = "M " + points[0].x + " " + points[0].y;
  if (smooth && points.length > 2) {
    for (let index = 0; index < points.length - 1; index++) {
      const p0 = points[Math.max(0, index - 1)];
      const p1 = points[index];
      const p2 = points[index + 1];
      const p3 = points[Math.min(points.length - 1, index + 2)];
      const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
      const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
      result += " C " + c1.x + " " + c1.y + " " + c2.x + " " + c2.y + " " + p2.x + " " + p2.y;
    }
  } else {
    for (const point of points.slice(1)) result += " L " + point.x + " " + point.y;
  }
  return closed ? result + " Z" : result;
}

function sectorPath(node: Extract<ChartNode, { type: "sector" }>) {
  const sweep = node.end - node.start;
  const pointAt = (radius: number, angle: number) => ({ x: node.x + Math.cos(angle) * radius, y: node.y + Math.sin(angle) * radius });
  const outerStart = pointAt(node.r, node.start);
  const outerEnd = pointAt(node.r, node.end);
  const large = Math.abs(sweep) > Math.PI ? 1 : 0;
  const sweepFlag = sweep >= 0 ? 1 : 0;
  if (Math.abs(sweep) >= Math.PI * 2 - 0.0001) {
    const outerMiddle = pointAt(node.r, node.start + sweep / 2);
    if (node.inner > 0) {
      const innerEnd = pointAt(node.inner, node.end);
      const innerMiddle = pointAt(node.inner, node.start + sweep / 2);
      const innerStart = pointAt(node.inner, node.start);
      return "M " + outerStart.x + " " + outerStart.y +
        " A " + node.r + " " + node.r + " 0 1 " + sweepFlag + " " + outerMiddle.x + " " + outerMiddle.y +
        " A " + node.r + " " + node.r + " 0 1 " + sweepFlag + " " + outerEnd.x + " " + outerEnd.y +
        " L " + innerEnd.x + " " + innerEnd.y +
        " A " + node.inner + " " + node.inner + " 0 1 " + (sweepFlag ? 0 : 1) + " " + innerMiddle.x + " " + innerMiddle.y +
        " A " + node.inner + " " + node.inner + " 0 1 " + (sweepFlag ? 0 : 1) + " " + innerStart.x + " " + innerStart.y + " Z";
    }
    const center = { x: node.x, y: node.y };
    return "M " + center.x + " " + center.y + " L " + outerStart.x + " " + outerStart.y +
      " A " + node.r + " " + node.r + " 0 1 " + sweepFlag + " " + outerMiddle.x + " " + outerMiddle.y +
      " A " + node.r + " " + node.r + " 0 1 " + sweepFlag + " " + outerEnd.x + " " + outerEnd.y + " Z";
  }
  if (node.inner > 0) {
    const innerEnd = pointAt(node.inner, node.end);
    const innerStart = pointAt(node.inner, node.start);
    return "M " + outerStart.x + " " + outerStart.y +
      " A " + node.r + " " + node.r + " 0 " + large + " " + sweepFlag + " " + outerEnd.x + " " + outerEnd.y +
      " L " + innerEnd.x + " " + innerEnd.y +
      " A " + node.inner + " " + node.inner + " 0 " + large + " " + (sweepFlag ? 0 : 1) + " " + innerStart.x + " " + innerStart.y + " Z";
  }
  return "M " + node.x + " " + node.y + " L " + outerStart.x + " " + outerStart.y +
    " A " + node.r + " " + node.r + " 0 " + large + " " + sweepFlag + " " + outerEnd.x + " " + outerEnd.y + " Z";
}

function paletteFor(group: GroupElement, theme: Theme): ChartPalette {
  const meta = group.libraryComponent!;
  const dark = theme === "dark";
  return {
    series: palettes[meta.chartData?.options?.palette ?? "blue"],
    ink: meta.styleOverrides?.color ?? (dark ? "#e8edf2" : "#283643"),
    muted: dark ? "#aeb9c4" : "#687887",
    grid: dark ? "#39444e" : "#e4eaf0",
    edge: dark ? "#4a5662" : "#d7dfe6",
    surface: meta.styleOverrides?.fillColor === null ? "transparent" : meta.styleOverrides?.fillColor ?? (dark ? "#20272e" : "#ffffff"),
  };
}

function buildScene(group: GroupElement, theme: Theme, width: number, height: number): ChartScene | undefined {
  const meta = group.libraryComponent;
  const kind = meta?.kind as LibraryChartKind | undefined;
  if (!meta || !kind?.startsWith("viz-")) return undefined;
  const defaults = defaultLibraryChartData(kind);
  const data = meta.chartData ?? defaults ?? { labels: ["Item 1", "Item 2", "Item 3"], values: [3, 5, 4] };
  const settings = data.options ?? {};
  const labels = (data.labels.length ? data.labels : ["Item 1"]).slice(0, 20).map(label => String(label).slice(0, 60));
  const values = labels.map((_, index) => finite(data.values[index] ?? 0));
  const series = normalizeSeries(data, labels);
  const colors = paletteFor(group, theme);
  const fontFamily = familyFor(meta.textStyle?.fontFamily);
  const fontSize = clamp(meta.textStyle?.fontSize ?? 12, 8, 18);
  const textStyle = meta.textStyle;
  const pad = clamp(Math.min(width, height) * .055, 9, 16);
  const title = (data.title ?? meta.label ?? "Chart").trim().slice(0, 80) || "Chart";
  const titleSize = clamp(fontSize, 10, 16);
  const legendPosition = settings.legend ?? "right";
  const nodes: ChartNode[] = [];
  const add = (node: ChartNode) => nodes.push(node);
  const addText = (value: string, x: number, y: number, size: number, fill = colors.ink, align: CanvasTextAlign = "left", baseline: CanvasTextBaseline = "middle", maxWidth?: number, weight = 400, rotate?: number) => {
    add({ type: "text", value, x, y, size, fill: textStyle?.color ?? fill, align, baseline, maxWidth, weight: textStyle?.bold === undefined ? weight : textStyle.bold ? 700 : 400, rotate, family: fontFamily, italic: textStyle?.italic, underline: textStyle?.underline });
  };
  const addLine = (x1: number, y1: number, x2: number, y2: number, stroke = colors.grid, lineWidth = 1, dash?: number[]) => add({ type: "line", x1, y1, x2, y2, stroke, lineWidth, dash });
  const addRect = (x: number, y: number, w: number, h: number, fill?: string, stroke?: string, lineWidth = 1, radius = 0, opacity?: number) => add({ type: "rect", x, y, w, h, fill, stroke, lineWidth, radius, opacity });
  const addCircle = (x: number, y: number, r: number, fill?: string, stroke?: string, lineWidth = 1) => add({ type: "circle", x, y, r, fill, stroke, lineWidth });
  const addPolygon = (points: Point[], fill?: string, stroke?: string, lineWidth = 1, opacity?: number) => add({ type: "polygon", points, fill, stroke, lineWidth, opacity });

  addRect(0, 0, width, height, colors.surface, colors.edge, 1, Math.min(10, width * .025));
  addText(title, pad, pad + titleSize * .55, titleSize, colors.ink, "left", "middle", width - pad * 2, 650);
  if (kind === "viz-kpi") {
    const amount = finite(values[0] ?? 0);
    const change = finite(values[1] ?? 0);
    const trend = meta.trendDirection ?? (change > 0 ? "up" : change < 0 ? "down" : "steady");
    const trendColor = trend === "up" ? colors.series[1] : trend === "down" ? colors.series[4] : colors.muted;
    addText(compactNumber(amount), pad, height * .53, Math.min(34, height * .28), colors.ink, "left", "middle", width - pad * 2, 700);
    const changeText = (trend === "up" ? "+" : trend === "down" ? "−" : "") + compactNumber(Math.abs(change)) + "%";
    addText(changeText, pad, height - pad - 6, 11, trendColor, "left", "middle", 58, 700);
    addText(labels[1] ?? "Change", pad + 56, height - pad - 6, 10, colors.muted, "left", "middle", width - pad * 3 - 56);
    const points = trend === "up"
      ? [{ x: width - pad - 48, y: height - pad - 3 }, { x: width - pad - 37, y: height - pad - 8 }, { x: width - pad - 27, y: height - pad - 6 }, { x: width - pad - 15, y: height - pad - 17 }, { x: width - pad, y: height - pad - 23 }]
      : trend === "down"
        ? [{ x: width - pad - 48, y: height - pad - 23 }, { x: width - pad - 37, y: height - pad - 18 }, { x: width - pad - 27, y: height - pad - 20 }, { x: width - pad - 15, y: height - pad - 9 }, { x: width - pad, y: height - pad - 3 }]
        : [{ x: width - pad - 48, y: height - pad - 12 }, { x: width - pad - 37, y: height - pad - 11 }, { x: width - pad - 27, y: height - pad - 13 }, { x: width - pad - 15, y: height - pad - 12 }, { x: width - pad, y: height - pad - 12 }];
    add({ type: "polyline", points, stroke: trendColor, lineWidth: 1.7, smooth: true });
    return { width, height, nodes };
  }

  const titleBottom = pad + titleSize + 7;
  const legendEntries = (entries: { name: string; color: string }[], x: number, y: number, availableWidth: number, position = legendPosition) => {
    if (position === "hidden" || !entries.length) return;
    if (position === "bottom") {
      const columns = Math.max(1, Math.min(3, Math.floor(availableWidth / 105)));
      entries.forEach((entry, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const itemX = x + column * (availableWidth / columns);
        const itemY = y + row * 16;
        addLine(itemX, itemY, itemX + 11, itemY, entry.color, 2);
        addText(entry.name, itemX + 16, itemY, 9, colors.muted, "left", "middle", Math.max(24, availableWidth / columns - 20));
      });
      return;
    }
    entries.forEach((entry, index) => {
      const itemY = y + index * 18;
      addRect(x, itemY - 4, 8, 8, entry.color, undefined, 0, 2);
      addText(entry.name, x + 13, itemY, 9, colors.muted, "left", "middle", Math.max(20, availableWidth - 15));
    });
  };

  if (kind === "viz-pie" || kind === "viz-donut") {
    const entries = labels.map((name, index) => ({ name, value: Math.max(0, values[index] ?? 0), color: colors.series[index % colors.series.length] })).filter(entry => entry.value > 0);
    const total = entries.reduce((sum, entry) => sum + entry.value, 0);
    const rightLegend = legendPosition === "right";
    const bottomLegend = legendPosition === "bottom";
    const legendWidth = rightLegend ? Math.min(width * .38, 112) : 0;
    const chartHeight = height - titleBottom - (bottomLegend ? 28 : pad);
    const radius = Math.max(5, Math.min((width - pad * 2 - legendWidth) * .34, chartHeight * .43));
    const cx = rightLegend ? pad + (width - pad * 2 - legendWidth) * .48 : width / 2;
    const cy = titleBottom + chartHeight * .52;
    let angle = -Math.PI / 2;
    entries.forEach(entry => {
      const next = total ? angle + Math.PI * 2 * entry.value / total : angle;
      if (next - angle > 0.0001) add({ type: "sector", x: cx, y: cy, r: radius, inner: kind === "viz-donut" ? radius * .54 : 0, start: angle, end: next, fill: entry.color, stroke: colors.surface === "transparent" ? "#ffffff" : colors.surface, lineWidth: 1.4 });
      angle = next;
    });
    if (kind === "viz-donut" && total) addText(compactNumber(total), cx, cy, Math.max(10, radius * .25), colors.ink, "center", "middle", radius * .9, 650);
    if (settings.showValues) entries.forEach(entry => {
      const midpoint = -Math.PI / 2 + Math.PI * entry.value / total;
      if (radius > 45) addText(Math.round(entry.value / total * 100) + "%", cx + Math.cos(midpoint) * radius * .76, cy + Math.sin(midpoint) * radius * .76, 9, contrastInk(entry.color), "center", "middle", 30, 650);
    });
    if (rightLegend) legendEntries(entries.map(entry => ({ name: fitLabel(entry.name + (settings.showValues ? "  " + Math.round(entry.value / total * 100) + "%" : ""), legendWidth - 12, 9), color: entry.color })), width - legendWidth + 5, titleBottom + 8, legendWidth - pad);
    if (bottomLegend) legendEntries(entries.map(entry => ({ name: fitLabel(entry.name, 90, 9), color: entry.color })), pad, height - pad - 7, width - pad * 2, "bottom");
    return { width, height, nodes };
  }

  if (kind === "viz-gauge") {
    const maxValue = Math.max(1, finite(settings.maxValue ?? 100, 100));
    const rawValue = finite(values[0] ?? 0);
    const value = clamp(rawValue, 0, maxValue);
    const cx = width / 2;
    const cy = height * .66;
    const radius = Math.max(12, Math.min(width * .37, height * .48));
    const start = Math.PI * .78;
    const end = Math.PI * 2.22;
    const colorsForGauge = [colors.series[0], colors.series[2], colors.series[4]];
    const limits = [.65, .85, 1];
    let from = start;
    limits.forEach((limit, index) => {
      const to = start + (end - start) * limit;
      add({ type: "sector", x: cx, y: cy, r: radius, inner: radius * .78, start: from, end: to, fill: colorsForGauge[index], stroke: colors.surface, lineWidth: 1 });
      from = to;
    });
    const progressEnd = start + (end - start) * (value / maxValue);
    add({ type: "sector", x: cx, y: cy, r: radius, inner: radius * .78, start, end: progressEnd, fill: colors.series[1], stroke: colors.surface, lineWidth: 1 });
    for (let index = 0; index <= 5; index++) {
      const angle = start + (end - start) * index / 5;
      const outer = radius * 1.08;
      const inner = radius * .96;
      addLine(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner, cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer, colors.muted, 1);
      addText(compactNumber(maxValue * index / 5), cx + Math.cos(angle) * radius * 1.25, cy + Math.sin(angle) * radius * 1.25, 8, colors.muted, "center", "middle", 34);
    }
    const needle = start + (end - start) * (value / maxValue);
    addLine(cx, cy, cx + Math.cos(needle) * radius * .7, cy + Math.sin(needle) * radius * .7, colors.ink, 2);
    addCircle(cx, cy, 4, colors.ink);
    addText(settings.showValues === false ? title : compactNumber(value), cx, cy - radius * .06, 20, colors.ink, "center", "middle", width - pad * 2, 700);
    addText(labels[0] ?? "Value", cx, height - pad, 9, colors.muted, "center", "middle", width - pad * 2);
    return { width, height, nodes };
  }

  if (kind === "viz-funnel") {
    const entries = labels.map((name, index) => ({ name, value: Math.max(0, values[index] ?? 0), color: colors.series[index % colors.series.length] }));
    const maxValue = Math.max(1, ...entries.map(entry => entry.value));
    const top = titleBottom + 4;
    const bottom = height - pad;
    const rowHeight = Math.max(10, (bottom - top) / Math.max(1, entries.length));
    const maxWidth = width * .76;
    const cx = width / 2;
    entries.forEach((entry, index) => {
      const next = entries[index + 1];
      const upperWidth = Math.max(maxWidth * .18, maxWidth * entry.value / maxValue);
      const lowerWidth = next ? Math.max(maxWidth * .18, maxWidth * next.value / maxValue) : Math.max(maxWidth * .18, upperWidth * .72);
      const y1 = top + index * rowHeight;
      const y2 = Math.min(bottom, y1 + rowHeight - 2);
      addPolygon([{ x: cx - upperWidth / 2, y: y1 }, { x: cx + upperWidth / 2, y: y1 }, { x: cx + lowerWidth / 2, y: y2 }, { x: cx - lowerWidth / 2, y: y2 }], entry.color, colors.surface, 1);
      const label = fitLabel(entry.name + (settings.showValues === false ? "" : " · " + compactNumber(entry.value)), upperWidth - 12, 9);
      addText(label, cx, (y1 + y2) / 2, 9, contrastInk(entry.color), "center", "middle", upperWidth - 12, 600);
    });
    return { width, height, nodes };
  }

  if (kind === "viz-treemap") {
    const entries = labels.map((name, index) => ({ name, value: Math.max(0, values[index] ?? 0), color: colors.series[index % colors.series.length] }))
      .filter(entry => entry.value > 0).sort((left, right) => right.value - left.value);
    const x = pad; const y = titleBottom + 3; const w = width - pad * 2; const h = height - y - pad;
    const totalArea = entries.reduce((sum, entry) => sum + entry.value, 0);
    const pending = entries.map(entry => ({ ...entry, area: totalArea ? w * h * entry.value / totalArea : 0 }));
    let remaining = { x, y, w, h };
    const worst = (row: typeof pending, side: number) => {
      const areas = row.map(entry => entry.area);
      const sum = areas.reduce((total, area) => total + area, 0);
      if (!sum || !areas.length) return Infinity;
      const max = Math.max(...areas); const min = Math.min(...areas);
      return Math.max(side * side * max / (sum * sum), (sum * sum) / (side * side * min));
    };
    while (pending.length) {
      const row: typeof pending = [];
      const side = Math.max(1, Math.min(remaining.w, remaining.h));
      while (pending.length && (!row.length || worst([...row, pending[0]], side) <= worst(row, side))) row.push(pending.shift()!);
      const rowArea = row.reduce((sum, entry) => sum + entry.area, 0);
      if (remaining.w >= remaining.h) {
        const stripWidth = remaining.h > 0 ? rowArea / remaining.h : 0;
        let cursorY = remaining.y;
        row.forEach(entry => {
          const cellHeight = stripWidth > 0 ? entry.area / stripWidth : 0;
          addRect(remaining.x, cursorY, stripWidth, cellHeight, entry.color, colors.surface, 2, 2);
          const room = Math.min(stripWidth - 10, cellHeight - 8);
          if (room > 24 && cellHeight > 23) {
            addText(fitLabel(entry.name, stripWidth - 12, 9), remaining.x + 6, cursorY + 7, 9, contrastInk(entry.color), "left", "top", stripWidth - 12, 650);
            if (settings.showValues !== false && cellHeight > 38) addText(compactNumber(entry.value), remaining.x + 6, cursorY + 22, 8, contrastInk(entry.color), "left", "top", stripWidth - 12);
          }
          cursorY += cellHeight;
        });
        remaining = { ...remaining, x: remaining.x + stripWidth, w: Math.max(0, remaining.w - stripWidth) };
      } else {
        const stripHeight = remaining.w > 0 ? rowArea / remaining.w : 0;
        let cursorX = remaining.x;
        row.forEach(entry => {
          const cellWidth = stripHeight > 0 ? entry.area / stripHeight : 0;
          addRect(cursorX, remaining.y, cellWidth, stripHeight, entry.color, colors.surface, 2, 2);
          const room = Math.min(cellWidth - 10, stripHeight - 8);
          if (room > 24 && cellWidth > 28) {
            addText(fitLabel(entry.name, cellWidth - 12, 9), cursorX + 6, remaining.y + 7, 9, contrastInk(entry.color), "left", "top", cellWidth - 12, 650);
            if (settings.showValues !== false && stripHeight > 38) addText(compactNumber(entry.value), cursorX + 6, remaining.y + 22, 8, contrastInk(entry.color), "left", "top", cellWidth - 12);
          }
          cursorX += cellWidth;
        });
        remaining = { ...remaining, y: remaining.y + stripHeight, h: Math.max(0, remaining.h - stripHeight) };
      }
      if (remaining.w < 1 || remaining.h < 1) break;
    }
    return { width, height, nodes };
  }

  if (kind === "viz-radar") {
    const count = labels.length;
    const rightLegend = legendPosition === "right" && series.length > 1;
    const bottomLegend = legendPosition === "bottom" && series.length > 1;
    const centerX = rightLegend ? width * .39 : width / 2;
    const centerY = titleBottom + (height - titleBottom - (bottomLegend ? 26 : pad)) * .52;
    const radius = Math.max(8, Math.min(rightLegend ? width * .27 : width * .34, height * .31));
    const maximum = Math.max(1, ...series.flatMap(item => item.values.map(value => Math.abs(value))));
    const axisPoints = (fraction: number) => labels.map((_, index) => {
      const angle = -Math.PI / 2 + Math.PI * 2 * index / Math.max(3, count);
      return { x: centerX + Math.cos(angle) * radius * fraction, y: centerY + Math.sin(angle) * radius * fraction };
    });
    for (let ring = 1; ring <= 4; ring++) addPolygon(axisPoints(ring / 4), "transparent", colors.grid, 1);
    const outer = axisPoints(1);
    labels.forEach((label, index) => {
      addLine(centerX, centerY, outer[index].x, outer[index].y, colors.grid, 1);
      const point = axisPoints(1.18)[index];
      addText(fitLabel(label, 72, 8), point.x, point.y, 8, colors.muted, point.x < centerX - 6 ? "right" : point.x > centerX + 6 ? "left" : "center", "middle", 72);
    });
    series.forEach((item, seriesIndex) => {
      const points = item.values.map((value, index) => {
        const angle = -Math.PI / 2 + Math.PI * 2 * index / Math.max(3, count);
        const distance = clamp(value / maximum, 0, 1) * radius;
        return { x: centerX + Math.cos(angle) * distance, y: centerY + Math.sin(angle) * distance };
      });
      add({ type: "polygon", points, fill: colors.series[seriesIndex % colors.series.length], stroke: colors.series[seriesIndex % colors.series.length], lineWidth: settings.lineWidth ?? 2, opacity: .18 });
      add({ type: "polyline", points, closed: true, stroke: colors.series[seriesIndex % colors.series.length], lineWidth: settings.lineWidth ?? 2 });
      points.forEach(point => addCircle(point.x, point.y, clamp(settings.pointSize ?? 5, 3, 8) / 2, colors.series[seriesIndex % colors.series.length]));
    });
    if (series.length > 1 && legendPosition !== "hidden") legendEntries(series.map((item, index) => ({ name: item.name, color: colors.series[index % colors.series.length] })), rightLegend ? width * .72 : pad, height - pad - 5, rightLegend ? width * .25 : width - pad * 2, bottomLegend ? "bottom" : legendPosition);
    return { width, height, nodes };
  }

  if (kind === "viz-heatmap") {
    const rows = series.length ? series : [{ name: "Series 1", values }];
    const left = pad + 48;
    const top = titleBottom + 18;
    const right = width - pad;
    const bottom = height - pad - (data.xAxisLabel ? 15 : 0);
    const plotWidth = Math.max(12, right - left);
    const plotHeight = Math.max(12, bottom - top);
    const cellWidth = plotWidth / Math.max(1, labels.length);
    const cellHeight = plotHeight / Math.max(1, rows.length);
    const allValues = rows.flatMap(row => row.values);
    const min = Math.min(0, ...allValues);
    const max = Math.max(1, ...allValues);
    const low = theme === "dark" ? "#26333d" : "#eef4f8";
    const middle = colors.series[0];
    const high = colors.series[1];
    const interpolate = (a: string, b: string, t: number) => {
      const x = a.match(/[a-f\d]{2}/gi)!.map(value => parseInt(value, 16));
      const y = b.match(/[a-f\d]{2}/gi)!.map(value => parseInt(value, 16));
      return "#" + x.map((value, index) => Math.round(value + (y[index] - value) * t).toString(16).padStart(2, "0")).join("");
    };
    labels.forEach((label, column) => addText(fitLabel(label, cellWidth - 2, 8), left + cellWidth * (column + .5), top - 9, 8, colors.muted, "center", "middle", cellWidth));
    rows.forEach((row, rowIndex) => {
      const y = top + cellHeight * rowIndex;
      addText(fitLabel(row.name, 43, 8), left - 5, y + cellHeight / 2, 8, colors.muted, "right", "middle", 43);
      row.values.forEach((value, column) => {
        const t = clamp((value - min) / Math.max(1, max - min), 0, 1);
        const fill = t < .5 ? interpolate(low, middle, t * 2) : interpolate(middle, high, (t - .5) * 2);
        addRect(left + cellWidth * column, y, cellWidth, cellHeight, fill, colors.surface, 2, 3);
        if (settings.showValues) addText(compactNumber(value), left + cellWidth * (column + .5), y + cellHeight / 2, 8, t > .58 ? "#ffffff" : colors.ink, "center", "middle", cellWidth - 4, 600);
      });
    });
    if (data.xAxisLabel) addText(data.xAxisLabel, (left + right) / 2, height - pad + 2, 8, colors.muted, "center", "middle", plotWidth);
    if (data.yAxisLabel) addText(data.yAxisLabel, pad, top + plotHeight / 2, 8, colors.muted, "center", "middle", 60, 400, -Math.PI / 2);
    return { width, height, nodes };
  }

  if (kind === "viz-scatter") {
    const rightLegend = legendPosition === "right" && series.length > 1;
    const bottomLegend = legendPosition === "bottom" && series.length > 1;
    const plot = {
      x: pad + Math.max(29, width * .13) + (data.yAxisLabel ? 12 : 0),
      y: titleBottom + 7,
      w: width - pad * 2 - Math.max(29, width * .13) - (rightLegend ? Math.min(width * .29, 96) : 0) - (data.yAxisLabel ? 12 : 0),
      h: height - titleBottom - pad - 22 - (bottomLegend ? 24 : 0) - (data.xAxisLabel ? 12 : 0),
    };
    plot.w = Math.max(12, plot.w);
    plot.h = Math.max(12, plot.h);
    const numericX = labels.every(label => Number.isFinite(Number(label)));
    const xValues = labels.map((label, index) => numericX ? Number(label) : index + 1);
    let xLow = Math.min(...xValues); let xHigh = Math.max(...xValues);
    let yLow = Math.min(...series.flatMap(item => item.values)); let yHigh = Math.max(...series.flatMap(item => item.values));
    if (xLow === xHigh) { xLow -= 1; xHigh += 1; }
    if (yLow === yHigh) { yLow -= 1; yHigh += 1; }
    const xPadding = (xHigh - xLow) * .08;
    const yPadding = (yHigh - yLow) * .08;
    xLow -= xPadding; xHigh += xPadding;
    yLow -= yPadding; yHigh += yPadding;
    const xStep = niceStep(xHigh - xLow); const yStep = niceStep(yHigh - yLow);
    xLow = Math.floor(xLow / xStep) * xStep; xHigh = Math.ceil(xHigh / xStep) * xStep;
    yLow = Math.floor(yLow / yStep) * yStep; yHigh = Math.ceil(yHigh / yStep) * yStep;
    for (let tick = xLow, count = 0; tick <= xHigh + xStep * .001 && count < 7; tick += xStep, count++) {
      const x = plot.x + (tick - xLow) / Math.max(Number.EPSILON, xHigh - xLow) * plot.w;
      if (settings.showGrid !== false) addLine(x, plot.y, x, plot.y + plot.h, colors.grid, 1);
      if (numericX) addText(compactNumber(tick), x, plot.y + plot.h + 7, 8, colors.muted, "center", "top", 40);
    }
    for (let tick = yLow, count = 0; tick <= yHigh + yStep * .001 && count < 7; tick += yStep, count++) {
      const y = plot.y + plot.h - (tick - yLow) / Math.max(Number.EPSILON, yHigh - yLow) * plot.h;
      if (settings.showGrid !== false) addLine(plot.x, y, plot.x + plot.w, y, colors.grid, 1);
      addText(compactNumber(tick), plot.x - 5, y, 8, colors.muted, "right", "middle", plot.x - pad - 4);
    }
    addLine(plot.x, plot.y, plot.x, plot.y + plot.h, colors.edge, 1);
    addLine(plot.x, plot.y + plot.h, plot.x + plot.w, plot.y + plot.h, colors.edge, 1);
    series.forEach((item, seriesIndex) => item.values.forEach((value, index) => {
      const x = plot.x + (xValues[index] - xLow) / Math.max(Number.EPSILON, xHigh - xLow) * plot.w;
      const y = plot.y + plot.h - (value - yLow) / Math.max(Number.EPSILON, yHigh - yLow) * plot.h;
      addCircle(x, y, clamp(settings.pointSize ?? 8, 3, 16) / 2, colors.series[seriesIndex % colors.series.length], colors.surface, 1);
      if (settings.showValues) addText(compactNumber(value), x, y - 8, 8, colors.ink, "center", "bottom", 42);
    }));
    if (!numericX) labels.forEach((label, index) => {
      const x = plot.x + (xValues[index] - xLow) / Math.max(Number.EPSILON, xHigh - xLow) * plot.w;
      addText(fitLabel(label, 54, 8), x, plot.y + plot.h + 18, 8, colors.muted, "center", "top", 54);
    });
    if (data.xAxisLabel) addText(fitLabel(data.xAxisLabel, plot.w, 8), plot.x + plot.w / 2, height - pad - 1, 8, colors.muted, "center", "middle", plot.w);
    if (data.yAxisLabel) addText(fitLabel(data.yAxisLabel, plot.h, 8), pad, plot.y + plot.h / 2, 8, colors.muted, "center", "middle", plot.h, 400, -Math.PI / 2);
    if (series.length > 1 && legendPosition !== "hidden") legendEntries(
      series.map((item, index) => ({ name: fitLabel(item.name, 90, 9), color: colors.series[index % colors.series.length] })),
      rightLegend ? width - Math.min(width * .29, 96) + 7 : pad,
      bottomLegend ? height - pad - 5 : titleBottom + 8,
      rightLegend ? Math.min(width * .29, 96) - 12 : width - pad * 2,
      bottomLegend ? "bottom" : legendPosition,
    );
    return { width, height, nodes };
  }

  const horizontal = kind === "viz-horizontal-bar";
  const rightLegend = legendPosition === "right" && series.length > 1;
  const bottomLegend = legendPosition === "bottom" && series.length > 1;
  const supportsMixed = kind === "viz-line" || kind === "viz-area";
  const hasSecondaryAxis = supportsMixed && series.some(item => item.axis === "secondary");
  const left = pad + (horizontal ? Math.min(width * .32, 74) : Math.max(28, width * .14)) + (data.yAxisLabel ? 12 : 0);
  const right = width - pad - (rightLegend ? Math.min(width * .29, 96) : 0) - (hasSecondaryAxis ? 28 + (data.secondaryYAxisLabel ? 12 : 0) : 0);
  const top = titleBottom + 7;
  const bottom = height - pad - (bottomLegend ? 24 : 0) - 17 - (data.xAxisLabel ? 12 : 0);
  const plot = { x: left, y: top, w: Math.max(12, right - left), h: Math.max(12, bottom - top) };
  const primarySeries = supportsMixed ? series.filter(item => item.axis !== "secondary") : series;
  const primaryValues = primarySeries.length ? primarySeries.flatMap(item => item.values) : [0, 1];
  const stacked = kind === "viz-stacked-bar";
  let dataMin = Math.min(0, ...primaryValues);
  let dataMax = Math.max(0, ...primaryValues);
  if (stacked) {
    dataMin = Math.min(0, ...labels.map((_, index) => series.reduce((sum, item) => sum + Math.min(0, item.values[index] ?? 0), 0)));
    dataMax = Math.max(0, ...labels.map((_, index) => series.reduce((sum, item) => sum + Math.max(0, item.values[index] ?? 0), 0)));
  }
  if (dataMin === dataMax) { dataMin -= 1; dataMax += 1; }
  const step = niceStep(dataMax - dataMin);
  const min = Math.floor(dataMin / step) * step;
  const max = Math.ceil(dataMax / step) * step || step;
  const secondaryValues = series.filter(item => item.axis === "secondary").flatMap(item => item.values);
  const secondaryMinRaw = secondaryValues.length ? Math.min(0, ...secondaryValues) : 0;
  const secondaryMaxRaw = secondaryValues.length ? Math.max(0, ...secondaryValues) : 1;
  const secondaryStep = niceStep(Math.max(Number.EPSILON, secondaryMaxRaw - secondaryMinRaw));
  const secondaryMin = Math.floor(secondaryMinRaw / secondaryStep) * secondaryStep;
  const secondaryMax = Math.ceil(secondaryMaxRaw / secondaryStep) * secondaryStep || secondaryStep;
  const yAt = (value: number, axis: "primary" | "secondary" = "primary") => {
    const low = axis === "secondary" ? secondaryMin : min;
    const high = axis === "secondary" ? secondaryMax : max;
    return plot.y + plot.h - (value - low) / Math.max(Number.EPSILON, high - low) * plot.h;
  };
  const xAt = (index: number) => plot.x + (labels.length <= 1 ? plot.w / 2 : index * plot.w / (labels.length - 1));
  for (let tick = min, count = 0; tick <= max + step * .001 && count < 7; tick += step, count++) {
    const point = plot.y + plot.h - (tick - min) / (max - min) * plot.h;
    if (settings.showGrid !== false) addLine(plot.x, point, plot.x + plot.w, point, colors.grid, 1);
    if (!horizontal) addText(compactNumber(tick), plot.x - 5, point, 8, colors.muted, "right", "middle", Math.max(20, plot.x - pad - 4));
    else addText(compactNumber(tick), plot.x + (tick - min) / (max - min) * plot.w, plot.y + plot.h + 8, 8, colors.muted, "center", "top", 36);
  }
  if (hasSecondaryAxis) {
    for (let tick = secondaryMin, count = 0; tick <= secondaryMax + secondaryStep * .001 && count < 7; tick += secondaryStep, count++) {
      const point = yAt(tick, "secondary");
      addText(compactNumber(tick), plot.x + plot.w + 5, point, 8, colors.muted, "left", "middle", 28);
    }
  }
  if (horizontal) {
    const rowHeight = plot.h / Math.max(1, labels.length);
    labels.forEach((label, index) => addText(fitLabel(label, plot.x - pad - 8, 8), plot.x - 7, plot.y + rowHeight * (index + .5), 8, colors.muted, "right", "middle", plot.x - pad - 8));
    const zero = plot.x + (0 - min) / (max - min) * plot.w;
    addLine(zero, plot.y, zero, plot.y + plot.h, colors.edge, 1);
    const groupHeight = rowHeight * .76;
    labels.forEach((_, index) => series.forEach((item, seriesIndex) => {
      const seriesHeight = stacked ? groupHeight : groupHeight / series.length;
      const y = plot.y + rowHeight * index + (stacked ? (rowHeight - groupHeight) / 2 : (rowHeight - groupHeight) / 2 + seriesIndex * seriesHeight);
      const before = stacked ? series.slice(0, seriesIndex).reduce((sum, current) => sum + Math.max(0, current.values[index] ?? 0), 0) : 0;
      const start = stacked ? before : 0;
      const end = start + Math.max(0, item.values[index] ?? 0);
      const x1 = plot.x + (start - min) / (max - min) * plot.w;
      const x2 = plot.x + (end - min) / (max - min) * plot.w;
      const fill = series.length === 1 ? colors.series[index % colors.series.length] : colors.series[seriesIndex % colors.series.length];
      addRect(Math.min(x1, x2), y, Math.max(1, Math.abs(x2 - x1)), Math.max(2, seriesHeight - 2), fill, undefined, 0, 3);
      if (settings.showValues) addText(compactNumber(item.values[index] ?? 0), x2 + 4, y + seriesHeight / 2, 8, colors.ink, "left", "middle", 42);
    }));
  } else {
      const xAxisY = yAt(0);
    addLine(plot.x, plot.y, plot.x, plot.y + plot.h, colors.edge, 1);
    addLine(plot.x, xAxisY, plot.x + plot.w, xAxisY, colors.edge, 1);
    const slot = plot.w / Math.max(1, labels.length);
    if (kind === "viz-bar" || stacked) {
      labels.forEach((_, index) => {
        const groupWidth = slot * .76;
        const barWidth = stacked ? groupWidth : groupWidth / series.length;
        let positive = 0;
        let negative = 0;
        series.forEach((item, seriesIndex) => {
          const value = item.values[index] ?? 0;
          const start = stacked ? (value >= 0 ? positive : negative) : 0;
          const end = start + value;
          if (stacked) { if (value >= 0) positive = end; else negative = end; }
          const x = plot.x + slot * index + (slot - groupWidth) / 2 + (stacked ? 0 : seriesIndex * barWidth);
          const y1 = yAt(start);
          const y2 = yAt(end);
          const fill = !stacked && series.length === 1 ? colors.series[index % colors.series.length] : colors.series[seriesIndex % colors.series.length];
          addRect(x, Math.min(y1, y2), Math.max(2, barWidth - (stacked ? 0 : 2)), Math.max(1, Math.abs(y2 - y1)), fill, undefined, 0, 3);
          if (settings.showValues) addText(compactNumber(value), x + barWidth / 2, y1 > y2 ? y2 - 7 : y2 + 7, 8, colors.ink, "center", y1 > y2 ? "bottom" : "top", barWidth + 16);
        });
      });
    } else {
      const chartTypes = series.map(item => item.chartType ?? (kind === "viz-area" ? "area" : "line"));
      const barSeries = series.map((item, index) => ({ item, index })).filter(entry => chartTypes[entry.index] === "bar");
      labels.forEach((_, index) => {
        const slotWidth = plot.w / Math.max(1, labels.length);
        const barWidth = Math.min(slotWidth * .68 / Math.max(1, barSeries.length), 30);
        barSeries.forEach(({ item, index: seriesIndex }, barIndex) => {
          const axis = item.axis === "secondary" ? "secondary" : "primary";
          const value = item.values[index] ?? 0;
          const zero = yAt(0, axis); const end = yAt(value, axis);
          const x = plot.x + slotWidth * (index + .5) - barWidth * barSeries.length / 2 + barIndex * barWidth;
          addRect(x, Math.min(zero, end), Math.max(2, barWidth - 2), Math.max(1, Math.abs(end - zero)), colors.series[seriesIndex % colors.series.length], undefined, 0, 3);
          if (settings.showValues) addText(compactNumber(value), x + barWidth / 2, end - 6, 8, colors.ink, "center", "bottom", barWidth + 10);
        });
      });
      series.forEach((item, seriesIndex) => {
        const chartType = chartTypes[seriesIndex];
        if (chartType === "bar") return;
        const axis = item.axis === "secondary" ? "secondary" : "primary";
        const points = item.values.map((value, index) => ({ x: xAt(index), y: yAt(value, axis) }));
        if (chartType === "area") {
          const base = yAt(0, axis);
          addPolygon([{ x: points[0]?.x ?? plot.x, y: base }, ...points, { x: points[points.length - 1]?.x ?? plot.x + plot.w, y: base }], colors.series[seriesIndex % colors.series.length], undefined, 0, .16);
        }
        if (chartType !== "scatter") add({ type: "polyline", points, stroke: colors.series[seriesIndex % colors.series.length], lineWidth: settings.lineWidth ?? 2, smooth: settings.smooth !== false });
        points.forEach((point, index) => {
          addCircle(point.x, point.y, clamp(settings.pointSize ?? 6, 3, 12) / 2, colors.series[seriesIndex % colors.series.length], colors.surface, 1);
          if (settings.showValues) addText(compactNumber(item.values[index] ?? 0), point.x, point.y - 9, 8, colors.ink, "center", "bottom", 42);
        });
      });
    }
    const stride = Math.max(1, Math.ceil(labels.length / 7));
    labels.forEach((label, index) => {
      if (index % stride !== 0 && index !== labels.length - 1) return;
      const x = kind === "viz-bar" || stacked ? plot.x + slot * (index + .5) : xAt(index);
      addText(fitLabel(label, Math.max(22, slot + 10), 8), x, plot.y + plot.h + 11, 8, colors.muted, "center", "top", Math.max(22, slot + 10));
    });
  }
  if (data.xAxisLabel) addText(fitLabel(data.xAxisLabel, plot.w, 8), plot.x + plot.w / 2, height - pad - 1, 8, colors.muted, "center", "middle", plot.w);
  if (data.yAxisLabel) addText(fitLabel(data.yAxisLabel, plot.h, 8), pad, plot.y + plot.h / 2, 8, colors.muted, "center", "middle", plot.h, 400, -Math.PI / 2);
  if (hasSecondaryAxis && data.secondaryYAxisLabel) addText(fitLabel(data.secondaryYAxisLabel, plot.h, 8), width - pad, plot.y + plot.h / 2, 8, colors.muted, "center", "middle", plot.h, 400, Math.PI / 2);
  for (const annotation of (data.annotations ?? []).slice(0, 32)) {
    if (!Number.isInteger(annotation.index) || annotation.index < 0 || annotation.index >= labels.length) continue;
    const x = xAt(annotation.index);
    addLine(x, plot.y, x, plot.y + plot.h, colors.edge, 1, [3, 3]);
    const associated = series.find(item => (item.axis ?? "primary") === (annotation.axis ?? "primary"));
    const value = annotation.value ?? associated?.values[annotation.index];
    const y = value === undefined ? plot.y + 9 : yAt(value, annotation.axis ?? "primary");
    addText(fitLabel(annotation.label, Math.min(120, plot.w / 2), 8), x + 4, clamp(y - 5, plot.y + 7, plot.y + plot.h - 7), 8, colors.ink, "left", "bottom", Math.min(120, plot.w / 2), 600);
  }
  if (series.length > 1 && legendPosition !== "hidden") legendEntries(
    series.map((item, index) => ({ name: fitLabel(item.name, 90, 9), color: colors.series[index % colors.series.length] })),
    rightLegend ? width - Math.min(width * .29, 96) + 7 : pad,
    bottomLegend ? height - pad - 5 : top + 8,
    rightLegend ? Math.min(width * .29, 96) - 12 : width - pad * 2,
    bottomLegend ? "bottom" : legendPosition,
  );
  return { width, height, nodes };
}

function traceCanvasPolyline(ctx: CanvasRenderingContext2D, points: Point[], smooth = false) {
  if (!points.length) return;
  ctx.moveTo(points[0].x, points[0].y);
  if (smooth && points.length > 2) {
    for (let index = 0; index < points.length - 1; index++) {
      const p0 = points[Math.max(0, index - 1)];
      const p1 = points[index];
      const p2 = points[index + 1];
      const p3 = points[Math.min(points.length - 1, index + 2)];
      ctx.bezierCurveTo(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6, p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y);
    }
  } else {
    points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
  }
}

function renderNodeToCanvas(ctx: CanvasRenderingContext2D, node: ChartNode) {
  ctx.save();
  if ("opacity" in node && node.opacity !== undefined) ctx.globalAlpha = node.opacity;
  if (node.type === "rect") {
    ctx.beginPath();
    if (node.radius && typeof ctx.roundRect === "function") ctx.roundRect(node.x, node.y, node.w, node.h, Math.min(node.radius, node.w / 2, node.h / 2));
    else ctx.rect(node.x, node.y, node.w, node.h);
    if (node.fill && node.fill !== "transparent") { ctx.fillStyle = node.fill; ctx.fill(); }
    if (node.stroke) { ctx.strokeStyle = node.stroke; ctx.lineWidth = node.lineWidth ?? 1; ctx.stroke(); }
  } else if (node.type === "line") {
    ctx.beginPath(); ctx.moveTo(node.x1, node.y1); ctx.lineTo(node.x2, node.y2);
    ctx.strokeStyle = node.stroke; ctx.lineWidth = node.lineWidth ?? 1; ctx.setLineDash(node.dash ?? []); ctx.stroke();
  } else if (node.type === "polyline" || node.type === "polygon") {
    ctx.beginPath(); traceCanvasPolyline(ctx, node.points, node.type === "polyline" && node.smooth);
    if ((node.type === "polyline" && node.closed) || node.type === "polygon") ctx.closePath();
    if (node.fill && node.fill !== "transparent") { ctx.fillStyle = node.fill; ctx.fill(); }
    if (node.stroke) { ctx.strokeStyle = node.stroke; ctx.lineWidth = node.lineWidth ?? 1; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke(); }
  } else if (node.type === "circle") {
    ctx.beginPath(); ctx.arc(node.x, node.y, Math.max(0, node.r), 0, Math.PI * 2);
    if (node.fill && node.fill !== "transparent") { ctx.fillStyle = node.fill; ctx.fill(); }
    if (node.stroke) { ctx.strokeStyle = node.stroke; ctx.lineWidth = node.lineWidth ?? 1; ctx.stroke(); }
  } else if (node.type === "sector") {
    ctx.beginPath();
    ctx.moveTo(node.x + Math.cos(node.start) * node.r, node.y + Math.sin(node.start) * node.r);
    ctx.arc(node.x, node.y, node.r, node.start, node.end, node.end < node.start);
    if (node.inner > 0) {
      ctx.lineTo(node.x + Math.cos(node.end) * node.inner, node.y + Math.sin(node.end) * node.inner);
      ctx.arc(node.x, node.y, node.inner, node.end, node.start, node.end >= node.start);
    } else ctx.lineTo(node.x, node.y);
    ctx.closePath(); ctx.fillStyle = node.fill; ctx.fill();
    if (node.stroke) { ctx.strokeStyle = node.stroke; ctx.lineWidth = node.lineWidth ?? 1; ctx.stroke(); }
  } else {
    ctx.translate(node.x, node.y);
    if (node.rotate) ctx.rotate(node.rotate);
    ctx.fillStyle = node.fill; ctx.font = (node.italic ? "italic " : "") + (node.weight ?? 400) + " " + node.size + "px " + (node.family ?? "system-ui,sans-serif");
    ctx.textAlign = node.align ?? "left"; ctx.textBaseline = node.baseline ?? "middle";
    if (node.maxWidth) ctx.fillText(node.value, 0, 0, node.maxWidth); else ctx.fillText(node.value, 0, 0);
    if (node.underline) { const measured = Math.min(node.maxWidth ?? ctx.measureText(node.value).width, ctx.measureText(node.value).width); const start = node.align === "center" ? -measured / 2 : node.align === "right" ? -measured : 0; ctx.fillRect(start, node.size * .36, measured, Math.max(1, node.size / 14)); }
  }
  ctx.restore();
}

function renderNodeToSvg(node: ChartNode) {
  if (node.type === "rect") return "<rect x=\"" + node.x + "\" y=\"" + node.y + "\" width=\"" + node.w + "\" height=\"" + node.h + "\" rx=\"" + (node.radius ?? 0) + "\" fill=\"" + (node.fill ?? "none") + "\" stroke=\"" + (node.stroke ?? "none") + "\" stroke-width=\"" + (node.lineWidth ?? 1) + "\"" + (node.opacity === undefined ? "" : " opacity=\"" + node.opacity + "\"") + "/>";
  if (node.type === "line") return "<path d=\"M " + node.x1 + " " + node.y1 + " L " + node.x2 + " " + node.y2 + "\" fill=\"none\" stroke=\"" + node.stroke + "\" stroke-width=\"" + (node.lineWidth ?? 1) + "\"" + (node.dash ? " stroke-dasharray=\"" + node.dash.join(" ") + "\"" : "") + "/>";
  if (node.type === "polyline" || node.type === "polygon") return "<path d=\"" + pathData(node.points, node.type === "polyline" && node.smooth, (node.type === "polyline" && node.closed) || node.type === "polygon") + "\" fill=\"" + (node.fill ?? "none") + "\" stroke=\"" + (node.stroke ?? "none") + "\" stroke-width=\"" + (node.lineWidth ?? 1) + "\" stroke-linecap=\"round\" stroke-linejoin=\"round\"" + (node.opacity === undefined ? "" : " opacity=\"" + node.opacity + "\"") + "/>";
  if (node.type === "circle") return "<circle cx=\"" + node.x + "\" cy=\"" + node.y + "\" r=\"" + node.r + "\" fill=\"" + (node.fill ?? "none") + "\" stroke=\"" + (node.stroke ?? "none") + "\" stroke-width=\"" + (node.lineWidth ?? 1) + "\"/>";
  if (node.type === "sector") return "<path d=\"" + sectorPath(node) + "\" fill=\"" + node.fill + "\" stroke=\"" + (node.stroke ?? "none") + "\" stroke-width=\"" + (node.lineWidth ?? 1) + "\"/>";
  const baseline = node.baseline === "top" ? "hanging" : node.baseline === "bottom" ? "text-after-edge" : "middle";
  const transform = node.rotate ? " transform=\"rotate(" + (node.rotate * 180 / Math.PI) + " " + node.x + " " + node.y + ")\"" : "";
  const length = node.maxWidth && node.value.length * node.size * .58 > node.maxWidth ? " textLength=\"" + Math.max(1, node.maxWidth) + "\" lengthAdjust=\"spacingAndGlyphs\"" : "";
  return "<text x=\"" + node.x + "\" y=\"" + node.y + "\" text-anchor=\"" + (node.align === "center" ? "middle" : node.align === "right" ? "end" : "start") + "\" dominant-baseline=\"" + baseline + "\" fill=\"" + node.fill + "\" font-family=\"" + escapeXml(node.family ?? "system-ui,sans-serif") + "\" font-size=\"" + node.size + "\" font-weight=\"" + (node.weight ?? 400) + "\"" + (node.italic ? " font-style=\"italic\"" : "") + (node.underline ? " text-decoration=\"underline\"" : "") + length + transform + ">" + escapeXml(node.value) + "</text>";
}

export function drawLibraryChart(ctx: CanvasRenderingContext2D, group: GroupElement, theme: Theme) {
  const bounds = group.componentBounds ?? unionBounds(group.elements.filter(item => !item.hidden).map(elementBounds));
  if (!bounds || bounds.w <= 0 || bounds.h <= 0) return;
  const scene = buildScene(group, theme, bounds.w, bounds.h);
  if (!scene) return;
  ctx.save();
  ctx.translate(bounds.x, bounds.y);
  ctx.beginPath();
  ctx.rect(0, 0, bounds.w, bounds.h);
  ctx.clip();
  scene.nodes.forEach(node => renderNodeToCanvas(ctx, node));
  ctx.restore();
}

export function renderLibraryChartSvg(group: GroupElement, theme: Theme = "light", renderWidth?: number, renderHeight?: number) {
  const bounds = group.componentBounds ?? unionBounds(group.elements.filter(item => !item.hidden).map(elementBounds));
  if (!bounds || bounds.w <= 0 || bounds.h <= 0) return "";
  const width = Math.max(1, renderWidth ?? bounds.w);
  const height = Math.max(1, renderHeight ?? bounds.h);
  const scene = buildScene(group, theme, width, height);
  if (!scene) return "";
  return "<svg x=\"" + bounds.x + "\" y=\"" + bounds.y + "\" width=\"" + bounds.w + "\" height=\"" + bounds.h + "\" viewBox=\"0 0 " + width + " " + height + "\" xmlns=\"http://www.w3.org/2000/svg\">" + scene.nodes.map(renderNodeToSvg).join("") + "</svg>";
}
