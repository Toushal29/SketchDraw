import type { ProjectTask, ProjectTaskPriority } from "../../model";

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
  const warnings: string[] = [];
  if (task.startDate && task.dueDate && task.startDate > task.dueDate) warnings.push("Starts after its due date");
  const byId = new Map(tasks.map(item => [item.id, item]));
  for (const dependencyId of task.dependsOn ?? []) {
    const dependency = byId.get(dependencyId);
    if (!dependency) continue;
    if (dependency.dueDate && task.startDate && dependency.dueDate > task.startDate) warnings.push(`Starts before ${dependency.title || "a dependency"} is due`);
    else if (dependency.dueDate && task.dueDate && dependency.dueDate > task.dueDate) warnings.push(`Due date is before ${dependency.title || "a dependency"}`);
  }
  const visits = new Set<string>();
  const path = new Set<string>();
  const hasCycle = (id: string): boolean => {
    if (path.has(id)) return true;
    if (visits.has(id)) return false;
    visits.add(id); path.add(id);
    const found = (byId.get(id)?.dependsOn ?? []).some(next => hasCycle(next));
    path.delete(id);
    return found;
  };
  if (hasCycle(task.id)) warnings.push("Dependency cycle detected");
  return [...new Set(warnings)];
}

export function isProjectTaskOverdue(task: ProjectTask, today = todayProjectDate()) {
  return task.status !== "done" && !!task.dueDate && task.dueDate < today;
}
