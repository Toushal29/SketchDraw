import type { GroupElement, Theme } from "../../model";
import type { LibraryChartData } from "../../notes";
import { unionBounds, elementBounds } from "../canvas/bounds";

const COLORS = ["#477fbd", "#3c9a7d", "#d5963c", "#8b6db4", "#cf6c65", "#4b9ca8", "#a28352", "#64759c"];
const SIMPLE_COLORS = ["#48515b", "#6b7783", "#87919a", "#3b706d", "#777064", "#65728a"];
const numberText = (value: number) => Number.isInteger(value) ? `${value}` : `${Number(value.toPrecision(3))}`;
const niceStep = (range: number) => {
  const rough = Math.max(Number.EPSILON, range / 4); const power = 10 ** Math.floor(Math.log10(rough)); const fraction = rough / power;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
};

export function drawLibraryChart(ctx: CanvasRenderingContext2D, group: GroupElement, theme: Theme, appearance: "simple" | "modern") {
  const kind = group.libraryComponent?.kind;
  if (!kind?.startsWith("viz-")) return;
  const bounds = unionBounds(group.elements.filter(item => !item.hidden).map(elementBounds)); if (!bounds || bounds.w <= 0 || bounds.h <= 0) return;
  const x = bounds.x; const y = bounds.y; const width = bounds.w; const height = bounds.h;
  const chart: LibraryChartData = group.libraryComponent?.chartData ?? { labels: [], values: [] };
  const labels = chart.labels.slice(0, 12); const values = labels.map((_, index) => Number.isFinite(chart.values[index]) ? chart.values[index] : 0);
  const simple = (group.libraryComponent?.appearance ?? appearance) === "simple"; const dark = theme === "dark"; const textStyle = group.libraryComponent?.textStyle; const baseSize = kind === "viz-kpi" ? { w: 220, h: 126 } : { w: 260, h: 176 }; const geometryScale = Math.min(width / baseSize.w, height / baseSize.h); const scale = Math.max(.65, Math.min(2, (textStyle?.fontSize ?? 10) / 10 * geometryScale));
  const surface = simple ? (dark ? "#202020" : "#ffffff") : (dark ? "#242b33" : "#ffffff");
  const ink = group.libraryComponent?.styleOverrides?.color ?? (simple ? (dark ? "#f1f1f1" : "#242424") : (dark ? "#e2eaf2" : "#293a4e"));
  const muted = simple ? (dark ? "#bdbdbd" : "#686868") : (dark ? "#a6b4c2" : "#738195");
  const rule = simple ? (dark ? "#666666" : "#c7c7c7") : (dark ? "#3b4651" : "#e6ebf0");
  const stroke = simple ? (dark ? "#a4a4a4" : "#646464") : (dark ? "#45515d" : "#d9e1e8");
  const palette = simple ? SIMPLE_COLORS : COLORS;
  const title = (chart.title ?? labels[0] ?? "Chart").trim() || "Chart";
  const family = textStyle?.fontFamily === "serif" ? "Georgia,serif" : textStyle?.fontFamily === "mono" ? "monospace" : textStyle?.fontFamily === "hand" ? "cursive" : textStyle?.fontFamily === "display" ? "Impact,sans-serif" : textStyle?.fontFamily === "rounded" ? "'Trebuchet MS',sans-serif" : "sans-serif";
  const font = (size: number, weight = 400) => `${textStyle?.italic ? "italic " : ""}${textStyle?.bold ? Math.max(weight, 700) : weight} ${Math.round(size * scale)}px ${family}`;
  ctx.save(); ctx.lineWidth = 1; ctx.textBaseline = "top"; ctx.font = font(10);
  ctx.beginPath(); if (typeof ctx.roundRect === "function" && !simple) ctx.roundRect(x, y, width, height, 8); else ctx.rect(x, y, width, height);
  ctx.fillStyle = surface; ctx.fill(); ctx.strokeStyle = stroke; ctx.stroke();
  ctx.fillStyle = ink; ctx.font = font(10, 600); ctx.fillText(title.toUpperCase().slice(0, 48), x + 12, y + 10, Math.max(30, width - 24));

  if (kind === "viz-pie" || kind === "viz-donut") {
    const entries = labels.map((label, index) => ({ label, value: Math.max(0, values[index] ?? 0) })).filter(entry => entry.value > 0);
    const total = entries.reduce((sum, entry) => sum + entry.value, 0) || 1; const radius = Math.max(12, Math.min(height * .31, width * .2));
    const cx = x + width * .31; const cy = y + height * .58; let angle = -Math.PI / 2;
    for (const [index, entry] of entries.entries()) {
      const next = angle + Math.PI * 2 * entry.value / total; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, radius, angle, next); ctx.closePath(); ctx.fillStyle = palette[index % palette.length]; ctx.fill(); ctx.strokeStyle = surface; ctx.lineWidth = 1.5; ctx.stroke(); angle = next;
    }
    ctx.font = font(10); ctx.textBaseline = "middle";
    entries.slice(0, 6).forEach((entry, index) => { const yy = y + 39 + index * Math.min(21, (height - 46) / Math.max(1, Math.min(entries.length, 6))); const pct = Math.round(entry.value / total * 100); ctx.fillStyle = palette[index % palette.length]; ctx.fillRect(x + width * .58, yy + 2, 7, 7); ctx.fillStyle = ink; ctx.fillText(entry.label.slice(0, 12), x + width * .58 + 12, yy, width * .26); ctx.textAlign = "right"; ctx.fillStyle = muted; ctx.fillText(`${pct}%`, x + width - 10, yy, 28); ctx.textAlign = "left"; });
    ctx.restore(); return;
  }
  if (kind === "viz-kpi") {
    const amount = values[0] ?? 0; const change = values[1] ?? 0;
    const valueText = Math.abs(amount) >= 1_000_000 ? `${(amount / 1_000_000).toFixed(1)}m` : Math.abs(amount) >= 10_000 ? `${(amount / 1000).toFixed(1)}k` : numberText(amount);
    const trend = group.libraryComponent?.trendDirection ?? (change > 0 ? "up" : change < 0 ? "down" : "steady");
    const trendColor = trend === "up" ? (simple ? "#28764f" : "#32846f") : trend === "down" ? (simple ? "#ae3f3f" : "#bd5a55") : muted;
    const changeText = `${trend === "up" ? "+" : trend === "down" ? "−" : ""}${numberText(Math.abs(change))}%`;
    ctx.fillStyle = ink; ctx.font = font(28, 700); ctx.fillText(valueText, x + 14, y + 38, width - 28);
    ctx.fillStyle = trendColor; ctx.font = font(11, 700); ctx.fillText(changeText, x + 15, y + height - 26, 48);
    ctx.fillStyle = muted; ctx.font = font(9); ctx.fillText(labels[1] ?? "Change", x + 62, y + height - 26, Math.max(20, width - 126));
    const sx = x + width - 52; const sy = y + height - 31; const trendPoints = trend === "up"
      ? [{ x: sx, y: sy + 13 }, { x: sx + 9, y: sy + 9 }, { x: sx + 17, y: sy + 11 }, { x: sx + 27, y: sy + 3 }, { x: sx + 39, y: sy + 1 }]
      : trend === "down"
        ? [{ x: sx, y: sy + 1 }, { x: sx + 9, y: sy + 5 }, { x: sx + 17, y: sy + 3 }, { x: sx + 27, y: sy + 11 }, { x: sx + 39, y: sy + 13 }]
        : [{ x: sx, y: sy + 7 }, { x: sx + 10, y: sy + 6 }, { x: sx + 20, y: sy + 8 }, { x: sx + 30, y: sy + 7 }, { x: sx + 39, y: sy + 7 }];
    ctx.strokeStyle = trendColor; ctx.fillStyle = trendColor; ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(trendPoints[0].x, trendPoints[0].y); for (const point of trendPoints.slice(1)) ctx.lineTo(point.x, point.y); ctx.stroke();
    if (trend !== "steady") { const tip = trendPoints[trendPoints.length - 1]; const arm = trend === "up" ? 5 : -5; ctx.beginPath(); ctx.moveTo(tip.x - 5, tip.y + arm * .7); ctx.lineTo(tip.x, tip.y); ctx.lineTo(tip.x - 1, tip.y + arm); ctx.stroke(); }
    ctx.restore(); return;
  }

  const left = x + Math.max(42, width * .17); const right = x + width - 12; const top = y + 34; const bottom = y + height - 35;
  const dataMin = Math.min(0, ...values); const dataMax = Math.max(0, ...values); const step = niceStep(dataMax - dataMin || Math.abs(dataMax) || 1);
  const min = Math.floor(dataMin / step) * step; const max = Math.ceil(dataMax / step) * step || step;
  const yAt = (value: number) => bottom - (value - min) / (max - min) * (bottom - top);
  ctx.font = font(9); ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let tick = min; tick <= max + step * .001; tick += step) {
    const yy = yAt(tick); ctx.strokeStyle = rule; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(left, yy); ctx.lineTo(right, yy); ctx.stroke(); ctx.fillStyle = muted; ctx.fillText(numberText(tick), left - 5, yy, left - x - 8);
  }
  ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, bottom); ctx.lineTo(right, bottom); ctx.stroke();
  const slot = (right - left) / Math.max(1, values.length); const pointX = (index: number) => values.length <= 1 ? (left + right) / 2 : left + index * (right - left) / (values.length - 1);
  if (kind === "viz-bar") values.forEach((value, index) => { const center = left + slot * (index + .5); const zero = yAt(0); const yy = yAt(value); const barWidth = Math.max(3, Math.min(28, slot * .58)); ctx.fillStyle = palette[index % palette.length]; ctx.fillRect(center - barWidth / 2, Math.min(yy, zero), barWidth, Math.max(1, Math.abs(zero - yy))); });
  else if (kind === "viz-scatter") values.forEach((value, index) => { const numericX = Number(labels[index]); const px = Number.isFinite(numericX) && labels.every(label => Number.isFinite(Number(label))) ? left + ((numericX - Math.min(...labels.map(Number))) / (Math.max(...labels.map(Number)) - Math.min(...labels.map(Number)) || 1)) * (right - left) : left + (index + .5) * slot; const py = yAt(value); ctx.beginPath(); ctx.arc(px, py, 3.4, 0, Math.PI * 2); ctx.fillStyle = palette[index % palette.length]; ctx.fill(); });
  else if (values.length) {
    const points = values.map((value, index) => ({ x: pointX(index), y: yAt(value) }));
    if (kind === "viz-area") { const zero = yAt(0); ctx.beginPath(); ctx.moveTo(points[0].x, zero); for (const point of points) ctx.lineTo(point.x, point.y); ctx.lineTo(points[points.length - 1].x, zero); ctx.closePath(); ctx.globalAlpha = simple ? .18 : .22; ctx.fillStyle = palette[1]; ctx.fill(); ctx.globalAlpha = 1; }
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); for (const point of points.slice(1)) ctx.lineTo(point.x, point.y); ctx.strokeStyle = palette[0]; ctx.lineWidth = 2; ctx.stroke();
    points.forEach((point, index) => { ctx.beginPath(); ctx.arc(point.x, point.y, 3, 0, Math.PI * 2); ctx.fillStyle = palette[0]; ctx.fill(); if (values.length <= 7) { ctx.fillStyle = ink; ctx.font = font(9); ctx.textAlign = "center"; ctx.textBaseline = point.y < top + 12 ? "top" : "bottom"; ctx.fillText(numberText(values[index]), point.x, point.y + (point.y < top + 12 ? 5 : -5)); } });
  }
  ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = muted; ctx.font = font(9);
  const stride = Math.max(1, Math.ceil(labels.length / 6)); labels.forEach((label, index) => { if (index % stride !== 0 && index !== labels.length - 1) return; const px = kind === "viz-bar" ? left + slot * (index + .5) : pointX(index); ctx.fillText(label.slice(0, 7), px, bottom + 5, Math.max(20, slot + 6)); });
  if (chart.xAxisLabel) { ctx.fillStyle = muted; ctx.font = font(8); ctx.fillText(chart.xAxisLabel.slice(0, 32), (left + right) / 2, y + height - 12, width - 20); }
  if (chart.yAxisLabel) { ctx.save(); ctx.translate(x + 9, (top + bottom) / 2); ctx.rotate(-Math.PI / 2); ctx.fillStyle = muted; ctx.font = font(8); ctx.fillText(chart.yAxisLabel.slice(0, 28), 0, 0, bottom - top); ctx.restore(); }
  ctx.restore();
}
