import type { Element, ElementMetrics } from "../../model";

export const MAX_METRIC_VALUE = 1e12;

export type MetricsTotals = { cost: number; capacity: Record<string, number>; counted: number };
export type GroupMetrics = { id?: string; name: string; depth: number; totals: MetricsTotals };
export type MetricsSummary = { page: MetricsTotals; groups: GroupMetrics[] };

const empty = (): MetricsTotals => ({ cost: 0, capacity: {}, counted: 0 });
function add(target: MetricsTotals, source: MetricsTotals) {
  target.cost += source.cost; target.counted += source.counted;
  for (const [unit, amount] of Object.entries(source.capacity)) target.capacity[unit] = (target.capacity[unit] ?? 0) + amount;
}
function own(metrics: ElementMetrics | undefined): MetricsTotals {
  const totals = empty(); if (!metrics) return totals;
  if (metrics.cost !== undefined) totals.cost = metrics.cost;
  if (metrics.capacity !== undefined) totals.capacity[metrics.unit?.trim() || "units"] = metrics.capacity;
  totals.counted = metrics.cost !== undefined || metrics.capacity !== undefined ? 1 : 0;
  return totals;
}

export function normalizeMetrics(value: unknown): ElementMetrics | undefined {
  const item = value as Record<string, unknown> | null;
  if (!item || typeof item !== "object") return undefined;
  const number = (input: unknown) => typeof input === "number" && Number.isFinite(input) && Math.abs(input) <= MAX_METRIC_VALUE ? input : undefined;
  const cost = number(item.cost); const capacity = number(item.capacity);
  const unit = typeof item.unit === "string" && item.unit.trim() ? item.unit.trim().slice(0, 24) : undefined;
  return cost === undefined && capacity === undefined ? undefined : { ...(cost !== undefined ? { cost } : {}), ...(capacity !== undefined ? { capacity } : {}), ...(unit ? { unit } : {}) };
}

/** Totals for the page and for every named frame, container, or swimlane, counting everything inside them. */
export function summarizeMetrics(elements: Element[]): MetricsSummary {
  const groups: GroupMetrics[] = [];
  const visit = (item: Element, depth: number): MetricsTotals => {
    const totals = own(item.metrics);
    if (item.type === "group") {
      const index = item.container ? groups.length : -1;
      if (item.container) groups.push({ id: item.id, name: item.container.name || "Container", depth, totals });
      const inner = empty(); for (const child of item.elements) add(inner, visit(child, depth + 1));
      add(totals, inner);
      if (index >= 0) groups[index].totals = totals;
    }
    return totals;
  };
  const page = empty(); for (const item of elements) add(page, visit(item, 0));
  return { page, groups: groups.filter(group => group.totals.counted > 0) };
}

const formatNumber = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
export function formatTotals(totals: MetricsTotals): string {
  const parts: string[] = [];
  if (totals.cost) parts.push(`$${formatNumber(totals.cost)}`);
  for (const [unit, amount] of Object.entries(totals.capacity)) parts.push(`${formatNumber(amount)} ${unit}`);
  return parts.join(" · ") || "no values";
}

/** Plain text for a note on the canvas: page total first, then one line per group, indented by nesting. */
export function metricsSummaryText(summary: MetricsSummary): string {
  const lines = ["Cost and capacity", `Total: ${formatTotals(summary.page)} (${summary.page.counted} object${summary.page.counted === 1 ? "" : "s"})`];
  for (const group of summary.groups) lines.push(`${"  ".repeat(Math.min(3, group.depth))}${group.name}: ${formatTotals(group.totals)}`);
  return lines.join("\n");
}
