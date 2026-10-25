import type { ProjectChecklistItem, ProjectFileEntry, ProjectLogEntry, ProjectMilestone, ProjectNote, ProjectTask, ProjectTaskChecklistItem, ProjectWorkspaceData, ProjectWorkflowColumn } from "../../model";

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const legacyChecklistId = (taskId: string, itemId: string) => {
  let hash = 2166136261;
  for (const char of `${taskId}\0${itemId}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `legacy-${taskId.slice(0, 28)}-${itemId.slice(0, 48)}-${(hash >>> 0).toString(36)}`;
};
export const DEFAULT_WORKFLOW_COLUMNS: ProjectWorkflowColumn[] = [
  { id: "backlog", label: "To do" },
  { id: "inProgress", label: "In progress" },
  { id: "done", label: "Done", completed: true },
];
export const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];
const validProjectDate = (value: unknown): value is string | undefined => {
  if (value === undefined) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
};

export function createProjectWorkspace(name = "Untitled project"): ProjectWorkspaceData {
  return { name: name.slice(0, 120), description: "", notes: [], tasks: [], workflowColumns: DEFAULT_WORKFLOW_COLUMNS.map(column => ({ ...column })), workingDays: [...DEFAULT_WORKING_DAYS], checklist: [], milestones: [], logEntries: [], files: [] };
}

export function normalizeProjectWorkspace(value: unknown): ProjectWorkspaceData | undefined {
  if (!isRecord(value)) return undefined;
  const name = typeof value.name === "string" ? value.name.trim().slice(0, 120) || "Untitled project" : "";
  const description = typeof value.description === "string" ? value.description.slice(0, 4000) : "";
  const milestoneValues = value.milestones ?? [];
  const logValues = value.logEntries ?? [];
  const fileValues = value.files ?? [];
  const checklistValues = value.checklist ?? [];
  const columnValues = value.workflowColumns ?? DEFAULT_WORKFLOW_COLUMNS;
  const workingDayValues = value.workingDays ?? DEFAULT_WORKING_DAYS;
  if (typeof value.name !== "string" || value.name.length > 120 || typeof value.description !== "string" || value.description.length > 4000 || !Array.isArray(value.notes) || value.notes.length > 12_000 || !Array.isArray(value.tasks) || value.tasks.length > 2000 || !Array.isArray(checklistValues) || checklistValues.length > 5000 || !Array.isArray(milestoneValues) || milestoneValues.length > 1000 || !Array.isArray(logValues) || logValues.length > 2000 || !Array.isArray(fileValues) || fileValues.length > 200) return undefined;
  if (!Array.isArray(columnValues) || columnValues.length < 2 || columnValues.length > 12 || !Array.isArray(workingDayValues) || !workingDayValues.length || workingDayValues.length > 7 || workingDayValues.some(day => !Number.isInteger(day) || Number(day) < 0 || Number(day) > 6)) return undefined;
  const workflowColumns: ProjectWorkflowColumn[] = [];
  for (const column of columnValues) {
    if (!isRecord(column) || typeof column.id !== "string" || !/^[a-zA-Z0-9_-]{1,50}$/.test(column.id) || typeof column.label !== "string" || !column.label.trim() || column.label.length > 60 || (column.completed !== undefined && typeof column.completed !== "boolean")) return undefined;
    workflowColumns.push({ id: column.id, label: column.label.trim(), ...(column.completed ? { completed: true } : {}) });
  }
  if (new Set(workflowColumns.map(column => column.id)).size !== workflowColumns.length || !workflowColumns.some(column => column.completed)) return undefined;
  const workflowIds = new Set(workflowColumns.map(column => column.id));
  const workingDays = [...new Set(workingDayValues as number[])].sort();
  const notes: ProjectNote[] = [];
  for (const item of value.notes) {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id || item.id.length > 100 || typeof item.title !== "string" || item.title.length > 200 || typeof item.content !== "string" || item.content.length > 100_000 || !finite(item.createdAt) || item.createdAt < 0 || !finite(item.updatedAt) || item.updatedAt < 0) return undefined;
    notes.push({ id: item.id, title: item.title, content: item.content, createdAt: item.createdAt, updatedAt: item.updatedAt });
  }
  const tasks: ProjectTask[] = [];
  const migratedTaskChecklist: { taskId: string; items: ProjectTaskChecklistItem[] }[] = [];
  let migratedChecklistCount = 0;
  for (const item of value.tasks) {
    if (!isRecord(item)) return undefined;
    if (typeof item.id !== "string" || !item.id || item.id.length > 100 || typeof item.title !== "string" || item.title.length > 300 || typeof item.description !== "string" || item.description.length > 20_000 || typeof item.status !== "string" || !workflowIds.has(item.status) || !["low", "medium", "high"].includes(String(item.priority)) || !finite(item.createdAt) || item.createdAt < 0 || !finite(item.updatedAt) || item.updatedAt < 0 || (item.completedAt !== undefined && (!finite(item.completedAt) || item.completedAt < 0)) || !validProjectDate(item.startDate) || !validProjectDate(item.dueDate) || !validProjectDate(item.baselineStartDate) || !validProjectDate(item.baselineDueDate) || (item.estimateMinutes !== undefined && (!finite(item.estimateMinutes) || item.estimateMinutes < 0 || item.estimateMinutes > 1_000_000)) || (item.recurrence !== undefined && !["daily", "weekly", "monthly"].includes(String(item.recurrence)))) return undefined;
    if (item.dependsOn !== undefined && (!Array.isArray(item.dependsOn) || item.dependsOn.length > 500 || item.dependsOn.some(dependency => typeof dependency !== "string" || dependency.length > 100))) return undefined;
    if (item.checklist !== undefined && (!Array.isArray(item.checklist) || item.checklist.length > 500)) return undefined;
    const checklist: ProjectTaskChecklistItem[] = [];
    for (const entry of Array.isArray(item.checklist) ? item.checklist : []) {
      if (!isRecord(entry) || typeof entry.id !== "string" || !entry.id || entry.id.length > 100 || typeof entry.text !== "string" || entry.text.length > 2000 || typeof entry.done !== "boolean") return undefined;
      checklist.push({ id: entry.id, text: entry.text, done: entry.done });
    }
    if (new Set(checklist.map(entry => entry.id)).size !== checklist.length) return undefined;
    if (checklist.length && value.checklist === undefined) {
      migratedChecklistCount += checklist.length;
      if (migratedChecklistCount > 5000) return undefined;
      migratedTaskChecklist.push({ taskId: item.id, items: checklist });
    }
    const completedAt = finite(item.completedAt) ? item.completedAt : workflowColumns.find(column => column.id === item.status)?.completed ? item.updatedAt : undefined;
    tasks.push({ id: item.id, title: item.title, description: item.description, status: item.status, priority: item.priority as ProjectTask["priority"], ...(typeof item.startDate === "string" ? { startDate: item.startDate } : {}), ...(typeof item.dueDate === "string" ? { dueDate: item.dueDate } : {}), ...(typeof item.baselineStartDate === "string" ? { baselineStartDate: item.baselineStartDate } : {}), ...(typeof item.baselineDueDate === "string" ? { baselineDueDate: item.baselineDueDate } : {}), ...(typeof item.estimateMinutes === "number" ? { estimateMinutes: item.estimateMinutes } : {}), ...(item.recurrence ? { recurrence: item.recurrence as ProjectTask["recurrence"] } : {}), ...(Array.isArray(item.dependsOn) ? { dependsOn: [...new Set(item.dependsOn as string[])] } : {}), ...(completedAt !== undefined ? { completedAt } : {}), createdAt: item.createdAt, updatedAt: item.updatedAt });
  }
  const checklist: ProjectChecklistItem[] = [];
  for (const item of checklistValues) {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id || item.id.length > 100 || typeof item.text !== "string" || item.text.length > 2000 || typeof item.done !== "boolean") return undefined;
    checklist.push({ id: item.id, text: item.text, done: item.done });
  }
  if (value.checklist === undefined) {
    for (const legacy of migratedTaskChecklist) for (const item of legacy.items) checklist.push({ ...item, id: legacyChecklistId(legacy.taskId, item.id) });
  }
  if (checklist.length > 5000) return undefined;
  const milestones: ProjectMilestone[] = [];
  for (const item of milestoneValues) {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id || item.id.length > 100 || typeof item.title !== "string" || item.title.length > 300 || typeof item.description !== "string" || item.description.length > 20_000 || !validProjectDate(item.date) || typeof item.date !== "string" || typeof item.completed !== "boolean" || !finite(item.createdAt) || item.createdAt < 0 || !finite(item.updatedAt) || item.updatedAt < 0) return undefined;
    milestones.push({ id: item.id, title: item.title, description: item.description, date: item.date, completed: item.completed, createdAt: item.createdAt, updatedAt: item.updatedAt });
  }
  const logEntries: ProjectLogEntry[] = [];
  for (const item of logValues) {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id || item.id.length > 100 || !["decision", "question", "risk"].includes(String(item.kind)) || typeof item.title !== "string" || item.title.length > 300 || typeof item.details !== "string" || item.details.length > 20_000 || typeof item.owner !== "string" || item.owner.length > 200 || typeof item.nextStep !== "string" || item.nextStep.length > 2000 || typeof item.resolved !== "boolean" || (item.riskLevel !== undefined && !["low", "medium", "high"].includes(String(item.riskLevel))) || !finite(item.createdAt) || item.createdAt < 0 || !finite(item.updatedAt) || item.updatedAt < 0) return undefined;
    logEntries.push({ id: item.id, kind: item.kind as ProjectLogEntry["kind"], title: item.title, details: item.details, owner: item.owner, nextStep: item.nextStep, ...(item.riskLevel ? { riskLevel: item.riskLevel as ProjectLogEntry["riskLevel"] } : {}), resolved: item.resolved, createdAt: item.createdAt, updatedAt: item.updatedAt });
  }
  const files: ProjectFileEntry[] = [];
  let totalAttachmentBytes = 0;
  for (const item of fileValues) {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id || item.id.length > 100 || typeof item.name !== "string" || item.name.length > 500 || !finite(item.createdAt) || item.createdAt < 0) return undefined;
    if (item.kind === "link") {
      if (typeof item.url !== "string" || item.url.length > 2048 || !/^https?:\/\//i.test(item.url)) return undefined;
      files.push({ id: item.id, kind: "link", name: item.name, url: item.url, createdAt: item.createdAt });
    } else if (item.kind === "attachment") {
      const prefix = typeof item.mimeType === "string" ? `data:${item.mimeType};base64,` : "";
      const payload = typeof item.dataUrl === "string" && item.dataUrl.startsWith(prefix) ? item.dataUrl.slice(prefix.length) : "!";
      const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
      const encodedSize = Math.floor(payload.length * 3 / 4) - padding;
      if (typeof item.mimeType !== "string" || item.mimeType.length > 200 || typeof item.dataUrl !== "string" || item.dataUrl.length > 11_200_000 || payload === "!" || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload) || payload.length % 4 !== 0 || !finite(item.size) || item.size !== encodedSize || item.size < 0 || item.size > 8 * 1024 * 1024) return undefined;
      totalAttachmentBytes += item.size;
      if (totalAttachmentBytes > 32 * 1024 * 1024) return undefined;
      files.push({ id: item.id, kind: "attachment", name: item.name, mimeType: item.mimeType, dataUrl: item.dataUrl, size: item.size, createdAt: item.createdAt });
    } else return undefined;
  }
  const taskIds = new Set(tasks.map(task => task.id));
  for (const task of tasks) task.dependsOn = (task.dependsOn ?? []).filter(id => id !== task.id && taskIds.has(id));
  if (new Set(notes.map(item => item.id)).size !== notes.length || new Set(tasks.map(item => item.id)).size !== tasks.length || new Set(checklist.map(item => item.id)).size !== checklist.length || new Set(milestones.map(item => item.id)).size !== milestones.length || new Set(logEntries.map(item => item.id)).size !== logEntries.length || new Set(files.map(item => item.id)).size !== files.length) return undefined;
  return { name, description, notes, tasks, workflowColumns, workingDays, checklist, milestones, logEntries, files };
}
