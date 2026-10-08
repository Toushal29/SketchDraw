import type { ProjectFileEntry, ProjectLogEntry, ProjectMilestone, ProjectNote, ProjectTask, ProjectWorkspaceData } from "../../model";

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const validProjectDate = (value: unknown): value is string | undefined => {
  if (value === undefined) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
};

export function createProjectWorkspace(name = "Untitled project"): ProjectWorkspaceData {
  return { name: name.slice(0, 120), description: "", notes: [], tasks: [], milestones: [], logEntries: [], files: [] };
}

export function normalizeProjectWorkspace(value: unknown): ProjectWorkspaceData | undefined {
  if (!isRecord(value)) return undefined;
  const name = typeof value.name === "string" ? value.name.trim().slice(0, 120) || "Untitled project" : "";
  const description = typeof value.description === "string" ? value.description.slice(0, 4000) : "";
  const milestoneValues = value.milestones ?? [];
  const logValues = value.logEntries ?? [];
  const fileValues = value.files ?? [];
  if (typeof value.name !== "string" || value.name.length > 120 || typeof value.description !== "string" || value.description.length > 4000 || !Array.isArray(value.notes) || value.notes.length > 2000 || !Array.isArray(value.tasks) || value.tasks.length > 2000 || !Array.isArray(milestoneValues) || milestoneValues.length > 1000 || !Array.isArray(logValues) || logValues.length > 2000 || !Array.isArray(fileValues) || fileValues.length > 200) return undefined;
  const notes: ProjectNote[] = [];
  for (const item of value.notes) {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id || item.id.length > 100 || typeof item.title !== "string" || item.title.length > 200 || typeof item.content !== "string" || item.content.length > 100_000 || !finite(item.createdAt) || item.createdAt < 0 || !finite(item.updatedAt) || item.updatedAt < 0) return undefined;
    notes.push({ id: item.id, title: item.title, content: item.content, createdAt: item.createdAt, updatedAt: item.updatedAt });
  }
  const tasks: ProjectTask[] = [];
  for (const item of value.tasks) {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id || item.id.length > 100 || typeof item.title !== "string" || item.title.length > 300 || typeof item.description !== "string" || item.description.length > 20_000 || !["backlog", "inProgress", "done"].includes(String(item.status)) || !["low", "medium", "high"].includes(String(item.priority)) || !finite(item.createdAt) || item.createdAt < 0 || !finite(item.updatedAt) || item.updatedAt < 0 || !validProjectDate(item.startDate) || !validProjectDate(item.dueDate) || (item.dependsOn !== undefined && (!Array.isArray(item.dependsOn) || item.dependsOn.length > 500 || item.dependsOn.some(dependency => typeof dependency !== "string" || dependency.length > 100)))) return undefined;
    tasks.push({ id: item.id, title: item.title, description: item.description, status: item.status as ProjectTask["status"], priority: item.priority as ProjectTask["priority"], ...(typeof item.startDate === "string" ? { startDate: item.startDate } : {}), ...(typeof item.dueDate === "string" ? { dueDate: item.dueDate } : {}), ...(Array.isArray(item.dependsOn) ? { dependsOn: [...new Set(item.dependsOn as string[])] } : {}), createdAt: item.createdAt, updatedAt: item.updatedAt });
  }
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
  if (new Set(notes.map(item => item.id)).size !== notes.length || new Set(tasks.map(item => item.id)).size !== tasks.length || new Set(milestones.map(item => item.id)).size !== milestones.length || new Set(logEntries.map(item => item.id)).size !== logEntries.length || new Set(files.map(item => item.id)).size !== files.length) return undefined;
  return { name, description, notes, tasks, milestones, logEntries, files };
}
