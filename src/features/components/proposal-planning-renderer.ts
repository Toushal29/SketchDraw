import type { Element, GroupElement, Theme } from "../../model";
import { proposalComponentForKind, proposalComponentScore } from "./proposal-components";

type Point = { x: number; y: number };
type Primitive =
  | { type: "rect"; x: number; y: number; w: number; h: number; fill: string; stroke: string; radius?: number; dash?: string }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; width?: number; dash?: string }
  | { type: "path"; points: Point[]; stroke: string; width?: number; fill?: string; close?: boolean }
  | { type: "circle"; x: number; y: number; r: number; fill: string; stroke?: string }
  | { type: "text"; value: string; x: number; y: number; w: number; size: number; weight: number; color: string; align?: "left" | "center" | "right"; maxLines?: number };

type PlanningFields = Record<string, string>;
type PlanningPalette = { ink: string; edge: string; fill: string; soft: string; muted: string; accent: string; green: string; yellow: string; red: string };

function fieldsFor(group: GroupElement): PlanningFields {
  return Object.fromEntries((group.libraryComponent?.componentFields ?? []).map(field => [field.key, field.value.trim()]));
}

function splitLines(value: string, limit = 6): string[] {
  return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, limit);
}

function listRating(value: string, min = 1, max = 5): number | undefined {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

/** Cached CPM analysis for the visible planning task nodes on one immutable canvas scene. */
const criticalPathCache = new WeakMap<readonly Element[], Map<string, number>>();

export function analyzePlanningCriticalPath(elements: readonly Element[]): Map<string, number> {
  const cached = criticalPathCache.get(elements);
  if (cached) return cached;
  const tasks = new Map<string, { duration: number; fields: PlanningFields }>();
  for (const item of elements) {
    if (item.type !== "group" || !item.id) continue;
    const kind = item.libraryComponent?.kind ?? "";
    if (!kind.endsWith("work-package") && !kind.endsWith("critical-path-task")) continue;
    const fields = fieldsFor(item);
    const duration = Number(fields.duration);
    if (Number.isFinite(duration) && duration >= 0) tasks.set(item.id, { duration, fields });
  }
  const edges: { from: string; to: string; weight: number }[] = [];
  for (const item of elements) {
    if ((item.type !== "line" && item.type !== "arrow") || item.componentRole !== "proposal-planning-dependency-connector") continue;
    const from = item.startBinding?.elementId; const to = item.endBinding?.elementId;
    if (!from || !to || !tasks.has(from) || !tasks.has(to)) continue;
    const relationship = item.relationshipFields?.find(field => field.key === "relationship")?.value.trim().toUpperCase() || "FS";
    const lagValue = Number(item.relationshipFields?.find(field => field.key === "lag")?.value ?? 0);
    const lag = Number.isFinite(lagValue) ? lagValue : 0;
    const predecessorDuration = tasks.get(from)!.duration; const successorDuration = tasks.get(to)!.duration;
    const offset = relationship === "SS" ? 0 : relationship === "FF" ? predecessorDuration - successorDuration : relationship === "SF" ? -successorDuration : predecessorDuration;
    edges.push({ from, to, weight: offset + lag });
  }
  const outgoing = new Map([...tasks.keys()].map(id => [id, [] as typeof edges]));
  const incoming = new Map([...tasks.keys()].map(id => [id, [] as typeof edges]));
  const indegree = new Map([...tasks.keys()].map(id => [id, 0]));
  for (const edge of edges) {
    outgoing.get(edge.from)!.push(edge); incoming.get(edge.to)!.push(edge);
    indegree.set(edge.to, indegree.get(edge.to)! + 1);
  }
  const queue = [...tasks.keys()].filter(id => indegree.get(id) === 0);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!; order.push(id);
    for (const edge of outgoing.get(id)!) {
      const next = indegree.get(edge.to)! - 1; indegree.set(edge.to, next);
      if (next === 0) queue.push(edge.to);
    }
  }
  if (order.length !== tasks.size || !tasks.size) {
    const empty = new Map<string, number>();
    criticalPathCache.set(elements, empty);
    return empty;
  }
  const earlyStart = new Map([...tasks.keys()].map(id => [id, 0]));
  for (const id of order) {
    const start = earlyStart.get(id)!; const finish = start + tasks.get(id)!.duration;
    for (const edge of outgoing.get(id)!) earlyStart.set(edge.to, Math.max(earlyStart.get(edge.to)!, start + edge.weight));
    void finish;
  }
  const projectDuration = Math.max(...[...tasks].map(([id, task]) => earlyStart.get(id)! + task.duration));
  const lateStart = new Map<string, number>();
  for (const id of [...order].reverse()) {
    const duration = tasks.get(id)!.duration; const nextEdges = outgoing.get(id)!;
    const latest = nextEdges.length
      ? Math.min(...nextEdges.map(edge => lateStart.get(edge.to)! - edge.weight))
      : projectDuration - duration;
    lateStart.set(id, latest);
  }
  const result = new Map<string, number>();
  for (const id of tasks.keys()) result.set(id, Math.max(0, lateStart.get(id)! - earlyStart.get(id)!));
  criticalPathCache.set(elements, result);
  return result;
}

function makePlanningScene(group: GroupElement, theme: Theme, allElements?: readonly Element[]): { primitives: Primitive[]; bounds: { x: number; y: number; w: number; h: number } } | undefined {
  const bounds = group.componentBounds; const kind = group.libraryComponent?.kind;
  const definition = kind ? proposalComponentForKind(kind) : undefined;
  if (!bounds || !kind || !definition?.section.startsWith("Visual planning") || definition.archetype === "connector") return undefined;
  const { x, y, w, h } = bounds; const fields = fieldsFor(group); const primitives: Primitive[] = [];
  const dark = theme === "dark";
  const palette: PlanningPalette = {
    ink: dark ? "#edf1f4" : "#252a2e", edge: group.libraryComponent?.styleOverrides?.color ?? (dark ? "#9ba8b3" : "#343a40"),
    fill: group.libraryComponent?.styleOverrides?.fillColor === null ? "none" : group.libraryComponent?.styleOverrides?.fillColor ?? group.container?.background ?? (dark ? "#252a32" : "#ffffff"),
    soft: dark ? "#343e49" : "#eef1f3", muted: dark ? "#aab4be" : "#66727b", accent: dark ? "#8fb5d2" : "#557d9c",
    green: dark ? "#315748" : "#e3f1e8", yellow: dark ? "#655a35" : "#fff1c9", red: dark ? "#653f40" : "#f7dfdc",
  };
  const { ink, edge, fill, soft, muted, accent } = palette;
  const value = (key: string, fallback = "") => fields[key]?.trim() || fallback;
  const rect = (rx: number, ry: number, rw: number, rh: number, color = fill, radius = 0, stroke = edge, dash?: string) => primitives.push({ type: "rect", x: rx, y: ry, w: rw, h: rh, fill: color, stroke, radius, dash });
  const line = (x1: number, y1: number, x2: number, y2: number, stroke = edge, width = 1, dash?: string) => primitives.push({ type: "line", x1, y1, x2, y2, stroke, width, dash });
  const path = (points: Point[], stroke = edge, width = 1, color?: string, close = false) => primitives.push({ type: "path", points, stroke, width, fill: color, close });
  const circle = (cx: number, cy: number, radius: number, color = accent, stroke = edge) => primitives.push({ type: "circle", x: cx, y: cy, r: radius, fill: color, stroke });
  const text = (copy: string, tx: number, ty: number, width: number, size = 9, weight = 400, color = ink, align: "left" | "center" | "right" = "left", maxLines = 2) => primitives.push({ type: "text", value: copy, x: tx, y: ty, w: width, size, weight, color, align, maxLines });
  const shell = (title = definition.label, radius = 6, subtitle?: string) => {
    rect(x + .75, y + .75, w - 1.5, h - 1.5, fill, radius, edge);
    text(title, x + 10, y + 7, w - 20, Math.min(13, h * .105), 650, ink, "left", 1);
    line(x + 1, y + 27, x + w - 1, y + 27, edge, 1);
    if (subtitle) text(subtitle, x + 10, y + 30, w - 20, 7, 500, muted, "left", 1);
  };
  const contentLines = (raw: string, max = 3) => splitLines(raw, max);
  const cellText = (raw: string, cx: number, cy: number, cw: number, ch: number, label?: string, tint = ink) => {
    if (label) text(label.toUpperCase(), cx + 6, cy + 5, cw - 12, Math.min(8, ch * .13), 700, tint, "left", 1);
    const lines = contentLines(raw, Math.max(1, Math.floor((ch - 21) / 12)));
    lines.forEach((item, index) => text(`• ${item}`, cx + 7, cy + 18 + index * 12, cw - 14, 8, 400, ink, "left", 1));
  };
  const topBar = (color = soft) => rect(x + 1, y + 1, w - 2, 27, color, 6, color);
  const marker = (mx: number, my: number, label: string, color = accent) => {
    circle(mx, my, 4, color, dark ? "#f8fafc" : "#ffffff");
    text(label, Math.min(x + w - 70, mx + 7), Math.max(y + 34, my - 7), 62, 7, 600, ink, "left", 1);
  };
  const score = proposalComponentScore(kind, group.libraryComponent?.componentFields ?? []);
  const scoreBadge = () => {
    if (!score) return;
    const badgeWidth = Math.min(w - 20, Math.max(52, score.value.length * 5 + 24)); const bx = x + w - badgeWidth - 9;
    rect(bx, y + h - 25, badgeWidth, 17, soft, 8, edge);
    text(`${score.label}: ${score.value}`, bx + 5, y + h - 23, badgeWidth - 10, 7, 700, ink, "center", 1);
  };
  const labelRows = (rows: [string, string][], top: number, rowHeight: number) => rows.forEach(([label, current], index) => {
    const yy = top + index * rowHeight;
    if (index) line(x + 8, yy, x + w - 8, yy, edge, .8);
    text(label, x + 10, yy + 2, w * .39, 8, 650, muted, "left", 1);
    text(current || "—", x + w * .42, yy + 2, w * .52, 8, 400, current ? ink : muted, "left", 2);
  });

  if (kind.endsWith("swot-quadrant")) {
    topBar(); text("SWOT analysis", x + 10, y + 7, w - 20, 11, 700);
    const top = y + 30; const halfW = w / 2; const halfH = (h - 31) / 2;
    const cells: [string, string, string][] = [["STRENGTHS", "strengths", "#4a8a66"], ["WEAKNESSES", "weaknesses", "#bb7655"], ["OPPORTUNITIES", "opportunities", "#5486a7"], ["THREATS", "threats", "#a75858"]];
    cells.forEach(([label, key, tint], index) => { const cx = x + index % 2 * halfW; const cy = top + Math.floor(index / 2) * halfH; rect(cx, cy, halfW, halfH, fill, 0, edge); cellText(value(key), cx, cy, halfW, halfH, label, tint); });
  } else if (kind.endsWith("pestle-map")) {
    topBar(); text("External environment", x + 10, y + 7, w - 20, 11, 700);
    const labels: [string, string][] = [["Political", "political"], ["Economic", "economic"], ["Social", "social"], ["Technology", "technology"], ["Legal", "legal"], ["Environmental", "environmental"]];
    const top = y + 29; const cellW = w / 3; const cellH = (h - 30) / 2;
    labels.forEach(([label, key], index) => { const cx = x + index % 3 * cellW; const cy = top + Math.floor(index / 3) * cellH; rect(cx, cy, cellW, cellH, fill, 0, edge); cellText(value(key), cx, cy, cellW, cellH, label, accent); });
  } else if (kind.endsWith("assumption-map") || kind.endsWith("stakeholder-map")) {
    const stakeholder = kind.endsWith("stakeholder-map"); topBar(); text(stakeholder ? "Influence / interest" : "Assumption validation", x + 10, y + 7, w - 20, 11, 700);
    const left = x + 28; const top = y + 37; const plotW = w - 40; const plotH = h - 72; const midX = left + plotW / 2; const midY = top + plotH / 2;
    rect(left, top, plotW, plotH, fill, 0, edge); line(midX, top, midX, top + plotH, edge, 1); line(left, midY, left + plotW, midY, edge, 1);
    const names = stakeholder ? ["Keep satisfied", "Manage closely", "Monitor", "Keep informed"] : ["Test first", "Act on it", "Deprioritize", "Research"];
    names.forEach((label, index) => { const col = index % 2; const row = Math.floor(index / 2); const cw = plotW / 2; const ch = plotH / 2; text(label, left + col * cw + 5, top + row * ch + 4, cw - 10, 7, 600, muted, "left", 1); });
    text(stakeholder ? "Interest →" : "Evidence →", left + plotW * .36, top + plotH + 3, plotW * .6, 7, 600, muted, "center", 1);
    text(stakeholder ? "Influence" : "Importance", x + 2, top + plotH * .42, 27, 7, 600, muted, "center", 1);
    const xs = stakeholder ? value("interest") : value("importance"); const ys = stakeholder ? value("influence") : value("confidence");
    const sx = listRating(xs); const sy = listRating(ys);
    if (sx !== undefined && sy !== undefined) marker(left + ((sx - 1) / 4) * plotW, top + plotH - ((sy - 1) / 4) * plotH, stakeholder ? splitLines(value("stakeholders"), 1)[0]?.split("|")[0]?.trim() ?? "Stakeholder" : value("assumption", "Assumption"));
    else if (!stakeholder && value("assumption")) marker(left + plotW * .66, top + plotH * .34, value("assumption"));
    else if (stakeholder) contentLines(value("stakeholders"), 4).forEach((item, index) => { const parts = item.split("|").map(part => part.trim()); const sxValue = listRating(parts[1] ?? ""); const syValue = listRating(parts[2] ?? ""); if (sxValue !== undefined && syValue !== undefined) marker(left + ((sxValue - 1) / 4) * plotW, top + plotH - ((syValue - 1) / 4) * plotH, parts[0]); else marker(left + plotW * (.28 + index * .12), top + plotH * (.68 - index * .1), parts[0]); });
    text(stakeholder ? `Engagement: ${value("engagement", "—")}` : `Test: ${value("test", "—")}`, x + 8, y + h - 15, w - 16, 7, 500, muted, "left", 1);
    text(stakeholder ? `Default influence: ${value("influence", "-")} | interest: ${value("interest", "-")}` : `Importance: ${value("importance", "-")} | Confidence: ${value("confidence", "-")}`, x + 8, y + h - 26, w - 16, 7, 500, muted, "left", 1);
  } else if (kind.endsWith("impact-effort-matrix")) {
    topBar(); text("Impact / effort", x + 10, y + 7, w - 20, 11, 700);
    const left = x + 30; const top = y + 35; const plotW = w - 43; const plotH = h - 70; const midX = left + plotW / 2; const midY = top + plotH / 2;
    rect(left, top, plotW, plotH, fill, 0, edge); line(midX, top, midX, top + plotH); line(left, midY, left + plotW, midY);
    text("Quick wins", left + 5, top + 5, plotW / 2 - 10, 8, 700, accent); text("Major projects", midX + 5, top + 5, plotW / 2 - 10, 8, 700, accent);
    text("Defer", left + 5, midY + 5, plotW / 2 - 10, 8, 700, muted); text("Avoid", midX + 5, midY + 5, plotW / 2 - 10, 8, 700, muted);
    text("Effort →", left + plotW * .4, top + plotH + 2, plotW * .5, 7, 600, muted, "center", 1); text("Impact", x + 2, top + plotH * .45, 26, 7, 600, muted, "center", 1);
    splitLines(value("items"), 8).forEach((item, index) => { const [label, impactRaw, effortRaw] = item.split("|").map(part => part.trim()); const impact = listRating(impactRaw ?? value("impact")) ?? 3; const effort = listRating(effortRaw ?? value("effort")) ?? 3; marker(left + ((effort - 1) / 4) * plotW, top + plotH - ((impact - 1) / 4) * plotH, label || `Idea ${index + 1}`); });
    text(`Default impact: ${value("impact", "-")} | effort: ${value("effort", "-")}`, x + 8, y + h - 25, w - 16, 7, 500, muted, "left", 1);
    text(`Owner: ${value("owner", "—")}`, x + 8, y + h - 14, w - 16, 7, 500, muted, "left", 1);
  } else if (kind.endsWith("risk-matrix")) {
    topBar(); text("Likelihood × impact", x + 10, y + 7, w - 20, 11, 700);
    const left = x + 31; const top = y + 35; const size = Math.min(w - 47, h - 74); const cell = size / 5;
    for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
      const level = (5 - row) * (col + 1); const color = level <= 5 ? palette.green : level <= 12 ? palette.yellow : palette.red;
      rect(left + col * cell, top + row * cell, cell, cell, color, 0, edge);
      text(String(level), left + col * cell, top + row * cell + cell * .32, cell, 7, 600, muted, "center", 1);
    }
    text("Impact →", left + size * .39, top + size + 2, size * .55, 7, 600, muted, "center", 1); text("Likelihood", x + 1, top + size * .42, 29, 7, 600, muted, "center", 1);
    const likelihood = listRating(value("likelihood")); const impact = listRating(value("impact"));
    if (likelihood !== undefined && impact !== undefined) marker(left + (impact - .5) * cell, top + (5 - likelihood + .5) * cell, value("risk", "Risk"), palette.red);
    else if (value("risk")) marker(left + 3.5 * cell, top + 1.5 * cell, value("risk"), palette.red);
    text(`Likelihood: ${value("likelihood", "-")} | Impact: ${value("impact", "-")}`, x + 8, y + h - 26, w - 16, 7, 500, muted, "left", 1);
    text(`Mitigation: ${value("mitigation", "—")}`, left, y + h - 15, w - 40, 7, 500, muted, "left", 1);
  } else if (kind.endsWith("rice-score-card") || kind.endsWith("ice-score-card")) {
    shell(); const keys = kind.endsWith("rice-score-card") ? [["Reach", "reach"], ["Impact", "impact"], ["Confidence", "confidence"], ["Effort", "effort"]] : [["Impact", "impact"], ["Confidence", "confidence"], ["Ease", "ease"], ["Owner", "owner"]];
    const top = y + 34; const cellW = (w - 18) / 2; const cellH = Math.min(32, (h - 67) / 2);
    keys.forEach(([label, key], index) => { const cx = x + 8 + index % 2 * cellW; const cy = top + Math.floor(index / 2) * cellH; rect(cx, cy, cellW - 3, cellH - 3, soft, 4, edge); text(label, cx + 6, cy + 3, cellW - 15, 7, 600, muted, "left", 1); text(value(key, "—"), cx + 6, cy + 13, cellW - 15, 11, 650, value(key) ? ink : muted, "left", 1); });
    scoreBadge();
  } else if (kind.endsWith("weighted-decision-matrix")) {
    topBar(); text("Compare options by weighted criteria", x + 10, y + 7, w - 20, 11, 700);
    const options = splitLines(value("options"), 4); const criteria = splitLines(value("criteria"), 4).map(item => item.split(/\s*\|\s*|\s*:\s*/)[0].trim());
    const visibleOptions = options.length ? options : ["Option A", "Option B", "Option C"]; const visibleCriteria = criteria.length ? criteria : ["Criterion 1", "Criterion 2", "Criterion 3"];
    const left = x + 8; const top = y + 32; const nameW = Math.min(82, w * .31); const colW = (w - nameW - 16) / visibleCriteria.length; const rowH = Math.min(25, (h - 40) / (visibleOptions.length + 1));
    rect(left, top, nameW, rowH, soft, 0, edge); text("Option", left + 4, top + 4, nameW - 8, 8, 700, ink);
    visibleCriteria.forEach((label, index) => { const cx = left + nameW + index * colW; rect(cx, top, colW, rowH, soft, 0, edge); text(label, cx + 3, top + 3, colW - 6, 7, 650, ink, "center", 2); });
    const rows = value("scores").split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    visibleOptions.forEach((option, row) => { const yy = top + (row + 1) * rowH; rect(left, yy, nameW, rowH, fill, 0, edge); text(option, left + 4, yy + 4, nameW - 8, 8, 600); const scoreRow = rows.find(item => item.split("|")[0].trim().toLowerCase() === option.toLowerCase())?.split("|")[1]?.split(/[,;\s]+/).filter(Boolean) ?? []; visibleCriteria.forEach((_label, col) => { const cx = left + nameW + col * colW; rect(cx, yy, colW, rowH, fill, 0, edge); text(scoreRow[col] ?? "—", cx + 2, yy + 4, colW - 4, 8, 500, scoreRow[col] ? ink : muted, "center", 1); }); });
    scoreBadge(); text(`Scores: ${value("scores", "-")}`, x + 8, y + h - 28, w - 16, 6, 500, muted, "left", 1); text(`Decision: ${value("result", "—")}`, x + 8, y + h - 17, w - 16, 7, 500, muted, "left", 1);
  } else if (kind.endsWith("moscow-group")) {
    topBar(); text("Prioritization", x + 10, y + 7, w - 20, 11, 700);
    const groups: [string, string, string][] = [["MUST", "must", "#b74c4c"], ["SHOULD", "should", "#bf7c29"], ["COULD", "could", "#4d80a8"], ["WON'T", "wont", "#697782"]];
    const top = y + 30; const cellW = w / 4; const cellH = h - 31;
    groups.forEach(([label, key, tint], index) => { const cx = x + index * cellW; rect(cx, top, cellW, cellH, fill, 0, edge); rect(cx + 1, top + 1, cellW - 2, 21, tint, 0, tint); text(label, cx + 3, top + 5, cellW - 6, 8, 700, "#ffffff", "center", 1); splitLines(value(key), 5).forEach((item, row) => text(`• ${item}`, cx + 5, top + 28 + row * 13, cellW - 10, 8, 400, ink, "left", 1)); });
  } else if (kind.endsWith("raci-matrix")) {
    topBar(); text("Responsibility assignment", x + 10, y + 7, w - 20, 11, 700);
    const roles = splitLines(value("roles").replace(/,/g, "\n"), 4); const work = splitLines(value("work-items"), 4);
    const visibleRoles = roles.length ? roles : ["Role A", "Role B", "Role C"]; const visibleWork = work.length ? work : ["Activity 1", "Activity 2", "Activity 3"];
    const left = x + 8; const top = y + 31; const nameW = Math.min(85, w * .34); const colW = (w - nameW - 16) / visibleRoles.length; const rowH = Math.min(25, (h - 38) / (visibleWork.length + 1));
    rect(left, top, nameW, rowH, soft, 0, edge); text("Work item", left + 4, top + 4, nameW - 8, 8, 700);
    visibleRoles.forEach((role, index) => { const cx = left + nameW + index * colW; rect(cx, top, colW, rowH, soft, 0, edge); text(role, cx + 3, top + 3, colW - 6, 7, 650, ink, "center", 2); });
    const assignmentRows = value("assignments").split(/\r?\n/).map(row => row.split("|").map(part => part.trim()));
    visibleWork.forEach((task, index) => { const yy = top + (index + 1) * rowH; rect(left, yy, nameW, rowH, fill, 0, edge); text(task, left + 4, yy + 4, nameW - 8, 8, 500); const assignments = assignmentRows.find(row => row[0]?.toLowerCase() === task.toLowerCase())?.[1]?.split(/[,\s]+/) ?? []; visibleRoles.forEach((_role, col) => { const cx = left + nameW + col * colW; rect(cx, yy, colW, rowH, fill, 0, edge); const code = (assignments[col] ?? "").toUpperCase(); text(code || "—", cx + 2, yy + 4, colW - 4, 8, code ? 700 : 400, code ? accent : muted, "center", 1); }); });
    if (!assignmentRows.some(row => row.length > 1)) text(`Assignments: ${value("assignments", "-")}`, x + 8, y + h - 25, w - 16, 6, 500, muted, "left", 1);
    text(`Matrix owner: ${value("owner", "—")}`, x + 8, y + h - 14, w - 16, 7, 500, muted, "left", 1);
  } else if (kind.endsWith("decision-tree-node")) {
    shell(); const cx = x + w / 2; const nodeW = Math.min(w * .66, 155); const nodeH = Math.min(42, h * .32); const nodeX = cx - nodeW / 2; const nodeY = y + 32;
    path([{ x: cx - nodeW / 2 + 10, y: nodeY }, { x: cx + nodeW / 2 - 10, y: nodeY }, { x: cx + nodeW / 2, y: nodeY + nodeH / 2 }, { x: cx + nodeW / 2 - 10, y: nodeY + nodeH }, { x: cx - nodeW / 2 + 10, y: nodeY + nodeH }, { x: cx - nodeW / 2, y: nodeY + nodeH / 2 }], edge, 1.3, soft, true);
    text(value("decision", "Decision?"), nodeX + 9, nodeY + 9, nodeW - 18, 9, 700, ink, "center", 2);
    const branches = splitLines(value("branches"), 3); const branchNames = branches.length ? branches : ["Yes", "No", "Other"]; const width = (w - 32) / branchNames.length; const by = y + h - 32;
    branchNames.forEach((raw, index) => { const parts = raw.split("|").map(part => part.trim()); const bx = x + 16 + index * width; const targetX = bx + width / 2; line(cx, nodeY + nodeH, cx + (targetX - cx) * .38, by - 5, edge, 1); line(cx + (targetX - cx) * .38, by - 5, targetX, by - 5, edge, 1); line(targetX, by - 5, targetX, by, edge, 1); rect(bx, by, width - 4, 20, fill, 5, edge); const branchText = [parts[0], parts[1] || (index === 0 ? value("outcomes") : ""), parts[2] ? `${parts[2]}%` : index === 0 && value("probability") ? `${value("probability")}%` : ""].filter(Boolean).join(" · "); text(branchText, bx + 3, by + 3, width - 10, 7, 650, ink, "center", 2); });
  } else if (kind.endsWith("raid-register-row")) {
    shell(); rect(x + 10, y + 34, Math.min(38, w * .23), 20, soft, 4, edge); text(value("identifier", "RAID"), x + 12, y + 37, Math.min(34, w * .21), 7, 700, accent, "center", 2);
    text(value("item", "Register item"), x + 56, y + 34, w - 66, 9, 650, ink, "left", 2);
    labelRows([["Owner", value("owner")], ["Due / status", value("due-date")], ["Response", value("response")]], y + 61, Math.max(15, (h - 67) / 3));
  } else if (kind.endsWith("stakeholder-map")) {
    // Handled by the influence/interest grid above.
  } else if (kind.endsWith("customer-journey-stage")) {
    shell(value("stage", "Journey stage")); const cols = [["GOAL", "user-goal", "#4f83a4"], ["ACTIONS", "actions", "#5d8b68"], ["PAIN / OPPORTUNITY", "pain-point", "#b66a51"]] as const; const top = y + 35; const cellW = (w - 20) / 3;
    cols.forEach(([label, key, tint], index) => { const cx = x + 10 + index * cellW; rect(cx, top, cellW - 3, h - 46, fill, 4, edge); text(label, cx + 5, top + 6, cellW - 13, 7, 700, tint, "left", 1); const body = index === 2 ? [value(key), value("opportunity") ? `Opportunity: ${value("opportunity")}` : ""].filter(Boolean).join("\n") : value(key); text(body, cx + 5, top + 19, cellW - 13, 8, 400, ink, "left", 4); });
  } else if (kind.endsWith("journey-touchpoint")) {
    shell(value("touchpoint", "Touchpoint")); const mid = y + 62; line(x + 19, mid, x + w - 19, mid, accent, 2);
    circle(x + w / 2, mid, 12, soft, accent); text(value("channel", "Channel"), x + w / 2 - 27, mid - 5, 54, 7, 700, accent, "center", 2);
    text(value("action", "Customer action"), x + 11, y + 82, w - 22, 8, 500, ink, "center", 2);
    rect(x + 10, y + h - 31, w - 20, 17, soft, 7, edge); text(`Emotion: ${value("emotion", "—")} | Owner: ${value("owner", "—")}`, x + 14, y + h - 28, w - 28, 7, 600, muted, "center", 1);
  } else if (kind.endsWith("journey-emotion-curve")) {
    shell("Customer emotion over time"); const left = x + 28; const top = y + 38; const plotW = w - 42; const plotH = h - 94;
    for (let index = 0; index < 5; index++) { const yy = top + (plotH / 4) * index; line(left, yy, left + plotW, yy, index === 2 ? edge : soft, index === 2 ? 1 : .8, index === 2 ? undefined : "3 3"); text(String(5 - index), x + 8, yy - 4, 14, 7, 500, muted, "right", 1); }
    const stages = splitLines(value("stages"), 6); const scores = splitLines(value("scores").replace(/,/g, "\n"), 6).map(Number);
    const labels = stages.length ? stages : Array.from({ length: Math.max(3, scores.length) }, (_, index) => `Stage ${index + 1}`);
    const points = labels.map((_stage, index) => {
      const score = scores[index];
      if (!Number.isFinite(score)) return undefined;
      return { x: left + (labels.length <= 1 ? plotW / 2 : plotW * index / (labels.length - 1)), y: top + plotH - (Math.max(1, Math.min(5, score)) - 1) / 4 * plotH };
    });
    const plotted = points.filter((point): point is Point => point !== undefined);
    if (plotted.length > 1) path(plotted, accent, 2);
    plotted.forEach(point => circle(point.x, point.y, 3.5, accent, fill === "none" ? ink : fill));
    const labelWidth = plotW / Math.max(1, labels.length - 1);
    labels.forEach((label, index) => {
      const center = left + (labels.length <= 1 ? plotW / 2 : plotW * index / (labels.length - 1));
      const labelX = index === 0 ? left : index === labels.length - 1 ? left + plotW - labelWidth : center - labelWidth / 2;
      text(label, labelX, y + h - 48, labelWidth, 6, 500, muted, "center", 1);
    });
    text("Negative", x + 2, top + plotH - 6, 24, 6, 500, muted, "center", 1); text("Positive", x + 2, top - 1, 24, 6, 500, muted, "center", 1);
    text(`Moments: ${value("moments", "-")} | Opportunities: ${value("opportunities", "-")}`, x + 8, y + h - 32, w - 16, 6, 500, muted, "left", 1);
    text(`Scores: ${value("scores", "-")}`, x + 8, y + h - 18, w - 16, 6, 500, muted, "left", 1);
  } else if (kind.endsWith("empathy-map")) {
    topBar(); text(value("persona", "Empathy map"), x + 10, y + 7, w - 20, 11, 700);
    const top = y + 30; const halfW = w / 2; const halfH = (h - 31) / 2; const cells: [string, string, string][] = [["SAYS", "says", "#4e7e9f"], ["THINKS", "thinks", "#76669b"], ["DOES", "does", "#568265"], ["FEELS", "feels", "#b9774d"]];
    cells.forEach(([label, key, tint], index) => { const cx = x + index % 2 * halfW; const cy = top + Math.floor(index / 2) * halfH; rect(cx, cy, halfW, halfH, fill, 0, edge); cellText(value(key), cx, cy, halfW, halfH, label, tint); });
  } else if (kind.endsWith("service-blueprint")) {
    topBar(); text("Service blueprint", x + 10, y + 7, w - 20, 11, 700);
    const stages = splitLines(value("stages"), 4); const columns = stages.length ? stages : ["Discover", "Use", "Resolve", "Follow up"];
    const lanes: [string, string][] = [["Customer", "customer-actions"], ["Frontstage", "frontstage"], ["Backstage", "backstage"], ["Support", "support-processes"], ["Evidence", "evidence"]];
    const left = x + 61; const top = y + 31; const laneW = 53; const colW = (w - laneW - 9) / columns.length; const rowH = Math.max(1, (y + h - 4 - top) / (lanes.length + 1));
    columns.forEach((stage, index) => { const cx = left + index * colW; rect(cx, top, colW, rowH, soft, 0, edge); text(stage, cx + 3, top + 3, colW - 6, 7, 650, ink, "center", 2); });
    lanes.forEach(([label, key], row) => { const yy = top + (row + 1) * rowH; rect(x + 7, yy, laneW, rowH, soft, 0, edge); text(label, x + 10, yy + 3, laneW - 6, 7, 650, muted, "left", 2); const entries = splitLines(value(key), columns.length); columns.forEach((_stage, col) => { const cx = left + col * colW; rect(cx, yy, colW, rowH, fill, 0, edge); text(entries[col] ?? "", cx + 3, yy + 3, colW - 6, 7, 400, ink, "left", 3); }); });
  } else if (/event-storming-/.test(kind)) {
    const variant = kind.endsWith("command") ? ["COMMAND", "command", "#547eb1"] : kind.endsWith("event") ? ["DOMAIN EVENT", "event", "#d87837"] : kind.endsWith("policy") ? ["POLICY", "policy", "#8c68a5"] : kind.endsWith("read-model") ? ["READ MODEL", "view", "#568a65"] : ["EXTERNAL SYSTEM", "system", "#697b87"];
    const [, lead, color] = variant; rect(x + 1, y + 1, w - 2, h - 2, fill, 8, edge); rect(x + 1, y + 1, 8, h - 2, color, 4, color);
    text(variant[0], x + 14, y + 8, w - 24, 7, 700, color, "left", 1); text(value(lead, definition.label), x + 14, y + 22, w - 24, 10, 700, ink, "left", 2);
    const rest = Object.entries(fields).filter(([key]) => key !== lead).map(([key, current]) => [key.replace(/-/g, " "), current] as [string, string]);
    labelRows(rest.slice(0, 3), y + 46, Math.max(14, (h - 51) / Math.min(3, rest.length || 3)));
  } else if (kind.endsWith("impact-mapping-goal") || kind.endsWith("impact-mapping-actor") || kind.endsWith("impact-mapping-impact") || kind.endsWith("impact-mapping-deliverable")) {
    const goal = kind.endsWith("goal"); const actor = kind.endsWith("actor"); const impact = kind.endsWith("impact");
    const label = goal ? "GOAL" : actor ? "ACTOR" : impact ? "IMPACT" : "DELIVERABLE"; const accentColor = goal ? "#b78635" : actor ? "#4e7e9f" : impact ? "#77649d" : "#52855e";
    rect(x + 1, y + 1, w - 2, h - 2, fill, goal ? 4 : actor ? h / 2 : 6, edge); rect(x + 1, y + 1, w - 2, 24, soft, goal ? 4 : actor ? h / 2 : 6, soft);
    text(label, x + 10, y + 6, w - 20, 8, 700, accentColor); const leadKey = goal ? "goal" : actor ? "actor" : impact ? "impact" : "deliverable"; text(value(leadKey, definition.label), x + 10, y + 30, w - 20, 10, 700, ink, "left", 2);
    const rest = Object.entries(fields).filter(([key]) => key !== leadKey).map(([key, current]) => [key.replace(/-/g, " "), current] as [string, string]); labelRows(rest.slice(0, 3), y + 53, Math.max(14, (h - 57) / Math.min(3, rest.length || 3)));
  } else if (kind.endsWith("story-map-activity")) {
    topBar(accent); text(value("activity", "User activity"), x + 10, y + 7, w - 20, 11, 700); text(`Persona: ${value("persona", "—")}`, x + 10, y + 36, w - 20, 8, 600, muted, "left", 1); line(x + 9, y + 57, x + w - 9, y + 57, accent, 1.2);
    const stepW = (w - 28) / 3; ["Task 1", "Task 2", "Task 3"].forEach((label, index) => { const bx = x + 9 + index * (stepW + 5); rect(bx, y + 64, stepW, 27, soft, 4, edge); text(label, bx + 3, y + 71, stepW - 6, 7, 600, muted, "center", 1); });
    text(`${value("outcome", "Outcome")} · Release: ${value("release", "—")}`, x + 10, y + h - 18, w - 20, 7, 500, muted, "left", 1);
  } else if (kind.endsWith("story-map-task")) {
    shell(value("task", "User task")); const priority = value("priority", "Priority"); rect(x + w - 68, y + 6, 57, 16, soft, 8, edge); text(priority, x + w - 65, y + 8, 51, 7, 700, accent, "center", 1);
    text(value("details", "Story and acceptance notes"), x + 12, y + 37, w - 24, 9, 400, ink, "left", 3);
    line(x + 10, y + h - 27, x + w - 10, y + h - 27, edge, .8); text(`Release slice: ${value("release", "—")}`, x + 11, y + h - 21, w - 22, 7, 600, muted, "left", 1);
  } else if (kind.endsWith("work-package")) {
    shell(value("wbs-code", "WBS")); const code = value("wbs-code", "1.0"); rect(x + 10, y + 35, 37, 21, soft, 3, edge); text(code, x + 12, y + 39, 33, 8, 700, accent, "center", 2);
    text(value("deliverable", "Deliverable"), x + 55, y + 35, w - 66, 9, 650, ink, "left", 2); line(x + 28, y + 57, x + 28, y + 70, edge); line(x + 28, y + 70, x + 10, y + 70, edge); line(x + 28, y + 70, x + w - 10, y + 70, edge);
    rect(x + 10, y + 74, w / 2 - 15, Math.max(20, h - 84), fill, 3, edge); rect(x + w / 2 + 5, y + 74, w / 2 - 15, Math.max(20, h - 84), fill, 3, edge);
    text(value("owner", "Owner"), x + 14, y + 79, w / 2 - 23, 7, 600, ink, "left", 2); text(`${value("duration", "Duration")} ${value("duration") ? "days" : ""}`.trim(), x + w / 2 + 9, y + 79, w / 2 - 23, 7, 600, ink, "left", 2); text(`Status: ${value("status", "Planned")}`, x + 12, y + h - 17, w - 24, 7, 600, muted, "left", 1);
  } else if (kind.endsWith("milestone-marker") || kind.endsWith("release-milestone")) {
    const release = kind.endsWith("release-milestone"); shell(value(release ? "release" : "milestone", release ? "Release milestone" : "Milestone"));
    const cy = y + h * .57; line(x + 14, cy, x + w - 14, cy, accent, 2); path([{ x: x + w / 2, y: cy - 10 }, { x: x + w / 2 + 10, y: cy }, { x: x + w / 2, y: cy + 10 }, { x: x + w / 2 - 10, y: cy }], edge, 1, soft, true);
    text(value(release ? "date" : "target-date", "Target date"), x + 10, y + h - 28, w - 20, 8, 650, muted, "center", 1);
    text(release ? `Theme: ${value("theme", "—")} · Ready: ${value("readiness", "—")}` : `Owner: ${value("owner", "—")} · Exit: ${value("exit-criteria", "—")}`, x + 10, y + h - 16, w - 20, 7, 400, ink, "center", 1);
  } else if (kind.endsWith("critical-path-task")) {
    const slackMap = allElements ? analyzePlanningCriticalPath(allElements) : new Map<string, number>();
    const calculatedFloat = group.id ? slackMap.get(group.id) : undefined; const manualFloat = Number(value("total-float")); const critical = calculatedFloat !== undefined ? calculatedFloat <= 1e-7 : Number.isFinite(manualFloat) && manualFloat <= 0;
    rect(x + 1, y + 1, w - 2, h - 2, fill, 5, edge); rect(x + 1, y + 1, 7, h - 2, critical ? "#c44747" : accent, 3, critical ? "#c44747" : accent);
    text(value("task", "Scheduled task"), x + 15, y + 8, w - 26, 10, 700, ink, "left", 2); rect(x + w - 66, y + 5, 54, 16, critical ? palette.red : soft, 7, critical ? "#c44747" : edge); text(critical ? "CRITICAL" : "SCHEDULED", x + w - 63, y + 8, 48, 7, 700, critical ? "#a52727" : muted, "center", 1);
    const float = calculatedFloat ?? (Number.isFinite(manualFloat) ? manualFloat : undefined); text(`Duration: ${value("duration", "—")} d`, x + 14, y + 37, w * .47, 8, 500, muted); text(`Float: ${float === undefined ? "—" : `${float} d`}`, x + w * .5, y + 37, w * .44, 8, 600, critical ? "#b12f2f" : muted, "right");
    text(`Start: ${value("start", "—")}  ·  ${value("owner", "Owner / status")}`, x + 14, y + 57, w - 28, 8, 500, ink, "left", 2);
  } else if (kind.endsWith("roadmap-lane")) {
    topBar(accent); text(value("lane", "Roadmap lane"), x + 10, y + 7, w - 20, 11, 700, "#ffffff"); const periods = ["period-1", "period-2", "period-3", "period-4"]; const labels = periods.map((key, index) => value(key.replace("period-", "label-"), `P${index + 1}`));
    const left = x + 8; const top = y + 31; const cellW = (w - 16) / 4;
    periods.forEach((key, index) => { const cx = left + index * cellW; rect(cx, top, cellW, h - 58, fill, 0, edge); text(labels[index], cx + 4, top + 4, cellW - 8, 7, 700, accent, "center", 1); text(value(key, ""), cx + 5, top + 18, cellW - 10, 8, 500, ink, "left", 4); });
    text(`Owner: ${value("owner", "—")}`, x + 8, y + h - 15, w - 16, 7, 500, muted, "left", 1);
  } else if (kind.endsWith("objective-card")) {
    shell(value("objective", "Objective")); const status = value("status", "PLANNED").toUpperCase(); rect(x + 10, y + 35, Math.min(73, w * .42), 18, soft, 9, edge); text(status, x + 14, y + 38, Math.min(65, w * .38), 7, 700, accent, "center", 1);
    text(`Timeframe: ${value("timeframe", "—")}`, x + 10, y + 62, w - 20, 8, 500, ink, "left", 1); text(`Owner: ${value("owner", "—")}`, x + 10, y + 78, w - 20, 8, 500, muted, "left", 1);
  } else if (kind.endsWith("key-result-card")) {
    shell(value("result", "Key result")); text(value("metric", "Metric"), x + 10, y + 34, w - 20, 8, 600, muted, "left", 1);
    const scoreText = score?.value; const progress = scoreText ? Math.max(0, Math.min(100, Number.parseFloat(scoreText))) : 0; const bx = x + 10; const by = y + 54; const bw = w - 20;
    rect(bx, by, bw, 12, soft, 6, soft); if (scoreText) rect(bx, by, bw * progress / 100, 12, accent, 6, accent);
    text(scoreText ? `${scoreText} complete` : "Progress —", bx, by + 15, bw, 8, 700, ink, "center", 1);
    text(`${value("current", "—")} / ${value("target", "—")} ${value("metric", "")}`.trim(), bx, by + 29, bw, 7, 500, muted, "center", 1);
    text(`Baseline ${value("baseline", "—")}  ·  Owner ${value("owner", "—")}`, bx, y + h - 18, bw, 7, 500, muted, "center", 1);
  } else if (kind.endsWith("user-persona")) {
    shell(value("persona", "User persona")); circle(x + 27, y + 51, 13, soft, accent); circle(x + 27, y + 47, 4, accent, accent); path([{ x: x + 19, y: y + 60 }, { x: x + 27, y: y + 54 }, { x: x + 35, y: y + 60 }], accent, 2);
    text(value("needs", "Needs"), x + 48, y + 38, w - 58, 9, 650, ink, "left", 2); text(value("goals", "Goals"), x + 10, y + 75, w - 20, 8, 500, muted, "left", 2); text(value("constraints", "Constraints"), x + 10, y + 96, w - 20, 8, 500, muted, "left", 2);
  } else {
    shell(); labelRows(Object.entries(fields).map(([key, current]) => [key.replace(/-/g, " "), current]), y + 34, Math.max(16, (h - 42) / Math.min(4, Object.keys(fields).length || 1)));
  }
  return { primitives, bounds };
}

function wrappedLines(ctx: CanvasRenderingContext2D, value: string, width: number, maxLines: number): string[] {
  const lines: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    let current = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const next = current ? `${current} ${word}` : word;
      if (!current || ctx.measureText(next).width <= width) current = next;
      else { lines.push(current); current = word; }
    }
    if (current) lines.push(current);
  }
  if (!lines.length) return [""];
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, -1).trimEnd()}…`; }
  return lines;
}

export function drawProposalPlanningComponent(ctx: CanvasRenderingContext2D, group: GroupElement, theme: Theme, allElements?: readonly Element[]): boolean {
  const scene = makePlanningScene(group, theme, allElements);
  if (!scene) return false;
  const { primitives, bounds } = scene;
  ctx.save(); ctx.beginPath(); ctx.rect(bounds.x, bounds.y, bounds.w, bounds.h); ctx.clip(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const item of primitives) {
    if (item.type === "rect") {
      ctx.beginPath(); if (typeof ctx.roundRect === "function") ctx.roundRect(item.x, item.y, item.w, item.h, item.radius ?? 0); else ctx.rect(item.x, item.y, item.w, item.h);
      if (item.fill !== "none") { ctx.fillStyle = item.fill; ctx.fill(); }
      ctx.strokeStyle = item.stroke; ctx.lineWidth = 1; ctx.setLineDash(item.dash ? item.dash.split(" ").map(Number) : []); ctx.stroke(); ctx.setLineDash([]);
    } else if (item.type === "line") {
      ctx.beginPath(); ctx.moveTo(item.x1, item.y1); ctx.lineTo(item.x2, item.y2); ctx.strokeStyle = item.stroke; ctx.lineWidth = item.width ?? 1; ctx.setLineDash(item.dash ? item.dash.split(" ").map(Number) : []); ctx.stroke(); ctx.setLineDash([]);
    } else if (item.type === "path") {
      if (!item.points.length) continue; ctx.beginPath(); ctx.moveTo(item.points[0].x, item.points[0].y); item.points.slice(1).forEach(point => ctx.lineTo(point.x, point.y)); if (item.close) ctx.closePath();
      if (item.fill) { ctx.fillStyle = item.fill; ctx.fill(); } ctx.strokeStyle = item.stroke; ctx.lineWidth = item.width ?? 1; ctx.stroke();
    } else if (item.type === "circle") {
      ctx.beginPath(); ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2); ctx.fillStyle = item.fill; ctx.fill(); if (item.stroke) { ctx.strokeStyle = item.stroke; ctx.lineWidth = 1; ctx.stroke(); }
    } else {
      const size = Math.max(6, item.size); ctx.font = `${item.weight} ${size}px sans-serif`; ctx.fillStyle = item.color; ctx.textAlign = item.align ?? "left"; ctx.textBaseline = "top";
      const available = item.align === "center" ? item.w : item.align === "right" ? item.w : item.w;
      const lines = wrappedLines(ctx, item.value, Math.max(1, available), item.maxLines ?? 2);
      const tx = item.align === "center" ? item.x + item.w / 2 : item.align === "right" ? item.x + item.w : item.x;
      lines.forEach((line, index) => ctx.fillText(line, tx, item.y + index * size * 1.16, Math.max(1, available)));
    }
  }
  ctx.restore();
  return true;
}

function xml(value: string): string { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" })[char]!); }

function wrappedApprox(value: string, width: number, size: number, maxLines: number): string[] {
  const limit = Math.max(1, Math.floor(width / (size * .58))); const result: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      if (!line) line = word;
      else if (`${line} ${word}`.length <= limit) line += ` ${word}`;
      else { result.push(line); line = word; }
    }
    if (line) result.push(line);
  }
  if (!result.length) return [""];
  if (result.length > maxLines) { result.length = maxLines; result[maxLines - 1] = `${result[maxLines - 1].slice(0, -1).trimEnd()}…`; }
  return result;
}

export function proposalPlanningComponentSvg(group: GroupElement, theme: Theme = "light", allElements?: readonly Element[]): string | undefined {
  const scene = makePlanningScene(group, theme, allElements);
  if (!scene) return undefined;
  return scene.primitives.map(item => {
    if (item.type === "rect") return `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" rx="${item.radius ?? 0}" fill="${item.fill}" stroke="${item.stroke}" stroke-width="1"${item.dash ? ` stroke-dasharray="${item.dash}"` : ""}/>`;
    if (item.type === "line") return `<path d="M ${item.x1} ${item.y1} L ${item.x2} ${item.y2}" fill="none" stroke="${item.stroke}" stroke-width="${item.width ?? 1}"${item.dash ? ` stroke-dasharray="${item.dash}"` : ""}/>`;
    if (item.type === "path") return `<path d="M ${item.points.map(point => `${point.x} ${point.y}`).join(" L ")}${item.close ? " Z" : ""}" fill="${item.fill ?? "none"}" stroke="${item.stroke}" stroke-width="${item.width ?? 1}"/>`;
    if (item.type === "circle") return `<circle cx="${item.x}" cy="${item.y}" r="${item.r}" fill="${item.fill}"${item.stroke ? ` stroke="${item.stroke}" stroke-width="1"` : ""}/>`;
    const size = Math.max(6, item.size); const lines = wrappedApprox(item.value, item.w, size, item.maxLines ?? 2); const anchor = item.align === "center" ? "middle" : item.align === "right" ? "end" : "start";
    const tx = item.align === "center" ? item.x + item.w / 2 : item.align === "right" ? item.x + item.w : item.x;
    return `<text x="${tx}" y="${item.y + size}" text-anchor="${anchor}" fill="${item.color}" font-family="sans-serif" font-size="${size}" font-weight="${item.weight}">${lines.map((line, index) => `<tspan x="${tx}" y="${item.y + size + index * size * 1.16}">${xml(line)}</tspan>`).join("")}</text>`;
  }).join("");
}
