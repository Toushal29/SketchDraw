import type { ProjectTask, ProjectTaskPriority, ProjectWorkflowColumn } from "../../model";

export const TASK_PRIORITY_LABELS: Record<ProjectTaskPriority, string> = { low: "Low", medium: "Medium", high: "High" };

export function dateValue(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function todayProjectDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseProjectDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) ? time : undefined;
}

export function formatProjectDate(value?: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  const time = parseProjectDate(value);
  return time === undefined ? "Unscheduled" : new Date(time).toLocaleDateString(undefined, { ...options, timeZone: options.timeZone ?? "UTC" });
}

export function projectTaskWarnings(task: ProjectTask, tasks: ProjectTask[]) {
  if (warningCache.tasks !== tasks) {
    const byId = new Map<string, ProjectTask>(tasks.map(item => [item.id, item] as const));
    const reachesCycle = new Map<string, boolean>();
    const visiting = new Set<string>();
    const cycleReachable = (id: string): boolean => {
      if (reachesCycle.has(id)) return reachesCycle.get(id)!;
      if (visiting.has(id)) return true;
      visiting.add(id);
      const found = (byId.get(id)?.dependsOn ?? []).some(next => byId.has(next) && cycleReachable(next));
      visiting.delete(id);
      reachesCycle.set(id, found);
      return found;
    };
    const computed = new Map<string, string[]>();
    for (const item of tasks) {
      const warnings: string[] = [];
      if (item.startDate && item.dueDate && item.startDate > item.dueDate) warnings.push("Starts after its due date");
      for (const dependencyId of item.dependsOn ?? []) {
        const dependency = byId.get(dependencyId);
        if (!dependency) continue;
        if (dependency.dueDate && item.startDate && dependency.dueDate > item.startDate) warnings.push(`Starts before ${dependency.title || "a dependency"} is due`);
        else if (dependency.dueDate && item.dueDate && dependency.dueDate > item.dueDate) warnings.push(`Due date is before ${dependency.title || "a dependency"}`);
      }
      computed.set(item.id, warnings);
    }
    for (const item of tasks) if (cycleReachable(item.id)) computed.get(item.id)!.push("Dependency cycle detected");
    warningCache = { tasks, byId: computed };
  }
  return warningCache.byId.get(task.id) ?? [];
}

let warningCache: { tasks: ProjectTask[]; byId: Map<string, string[]> } = { tasks: [], byId: new Map() };

export function isProjectTaskOverdue(task: ProjectTask, today = todayProjectDate()) {
  return task.status !== "done" && !!task.dueDate && task.dueDate < today;
}

export function isProjectTaskComplete(task: ProjectTask, columns: ProjectWorkflowColumn[]) {
  return columns.find(column => column.id === task.status)?.completed === true;
}

export function workingDayCount(from: string, to: string, workingDays: number[]) {
  const start = parseProjectDate(from);
  const end = parseProjectDate(to);
  if (start === undefined || end === undefined || end <= start) return 0;
  const allowed = new Set(workingDays);
  let count = 0;
  for (let time = start; time < end; time += 86_400_000) if (allowed.has(new Date(time).getUTCDay())) count++;
  return count;
}

export function addWorkingDays(value: string, offset: number, workingDays: number[]) {
  const start = parseProjectDate(value);
  if (start === undefined || !offset || !workingDays.length) return value;
  const allowed = new Set(workingDays);
  const direction = Math.sign(offset);
  let remaining = Math.abs(Math.round(offset));
  const date = new Date(start);
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + direction);
    if (allowed.has(date.getUTCDay())) remaining--;
  }
  return dateValue(date);
}

export function advanceRecurringDate(value: string | undefined, recurrence: ProjectTask["recurrence"]) {
  if (!value || !recurrence) return undefined;
  const time = parseProjectDate(value);
  if (time === undefined) return undefined;
  const date = new Date(time);
  if (recurrence === "daily") date.setUTCDate(date.getUTCDate() + 1);
  else if (recurrence === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  else {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
  }
  return dateValue(date);
}

export function criticalPathTaskIds(tasks: ProjectTask[], workingDays: number[]) {
  const taskById = new Map<string, ProjectTask>(tasks.map(task => [task.id, task] as const));
  const successors = new Map<string, string[]>();
  for (const task of tasks) for (const dependencyId of task.dependsOn ?? []) {
    if (!taskById.has(dependencyId)) continue;
    const list = successors.get(dependencyId) ?? [];
    list.push(task.id);
    successors.set(dependencyId, list);
  }
  const duration = (task: ProjectTask) => {
    if (task.estimateMinutes !== undefined) return Math.max(1, Math.ceil(task.estimateMinutes / 480));
    if (task.startDate && task.dueDate) return Math.max(1, workingDayCount(task.startDate, dateValue(new Date((parseProjectDate(task.dueDate) ?? 0) + 86_400_000)), workingDays));
    return 1;
  };
  const memo = new Map<string, number>();
  const active = new Set<string>();
  const longestFrom = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (active.has(id)) return 0;
    active.add(id);
    const score = duration(taskById.get(id)!) + Math.max(0, ...(successors.get(id) ?? []).map(longestFrom));
    active.delete(id);
    memo.set(id, score);
    return score;
  };
  let start = "";
  let longest = 0;
  for (const task of tasks) {
    const score = longestFrom(task.id);
    if (score > longest) { longest = score; start = task.id; }
  }
  const critical = new Set<string>();
  let cursor = start;
  while (cursor && !critical.has(cursor)) {
    critical.add(cursor);
    const next = (successors.get(cursor) ?? []).reduce<string | undefined>((best, id) => !best || longestFrom(id) > longestFrom(best) ? id : best, undefined);
    cursor = next ?? "";
  }
  return critical;
}
