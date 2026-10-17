import type { ProjectLogEntry, ProjectMilestone, ProjectTask, ProjectWorkspaceData } from "../../model";
import { formatProjectDate, parseProjectDate } from "./project-utils";

const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csvRow = (values: unknown[]) => values.map(csvCell).join(",");
const escapeCalendar = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const unescapeCalendar = (value: string) => value.replace(/\\\\|\\[nN,;]/g, escape => escape === "\\\\" ? "\\" : escape.toLowerCase() === "\\n" ? "\n" : escape.slice(1));
const calendarDate = (value?: string) => value ? value.replace(/-/g, "") : "";
const parseCalendarDate = (value?: string) => {
  if (!value) return undefined;
  const match = value.match(/^(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
};

export function exportPlanningCsv(project: ProjectWorkspaceData) {
  const rows: string[] = [csvRow(["type", "id", "title", "description", "status", "priority", "start", "due", "date", "estimate_minutes", "recurrence", "depends_on", "completed"])];
  for (const task of project.tasks) rows.push(csvRow(["task", task.id, task.title, task.description, task.status, task.priority, task.startDate, task.dueDate, "", task.estimateMinutes, task.recurrence, (task.dependsOn ?? []).join(";"), ""]));
  for (const milestone of project.milestones) rows.push(csvRow(["milestone", milestone.id, milestone.title, milestone.description, "", "", "", "", milestone.date, "", "", "", milestone.completed]));
  return rows.join("\r\n");
}

function parseCsv(source: string) {
  if (source.length > 5_000_000) throw new Error("The planning CSV is larger than 5 MB.");
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { value += '"'; index++; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"' && !value) quoted = true;
    else if (char === ",") { row.push(value); value = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(value); value = "";
      if (row.some(cell => cell.trim())) rows.push(row);
      row = [];
      if (rows.length > 10_001) throw new Error("The planning CSV contains more than 10,000 records.");
    } else value += char;
    if (value.length > 100_000) throw new Error("A planning CSV cell exceeds 100,000 characters.");
  }
  if (quoted) throw new Error("The planning CSV contains an unclosed quoted field.");
  row.push(value);
  if (row.some(cell => cell.trim())) rows.push(row);
  if (rows.length > 10_001) throw new Error("The planning CSV contains more than 10,000 records.");
  if (!rows.length || rows[0].length > 40) throw new Error("The planning CSV needs a header row with at most 40 columns.");
  return rows;
}

function parseImportDate(value?: string) {
  const text = value?.trim();
  if (!text) return undefined;
  const date = /^\d{8}$/.test(text) ? parseCalendarDate(text) : text.slice(0, 10);
  return date && parseProjectDate(date) !== undefined ? date : undefined;
}

function ensurePlanningCapacity(project: ProjectWorkspaceData, tasks: ProjectTask[], milestones: ProjectMilestone[]) {
  if (project.tasks.length + tasks.length > 2000) throw new Error("This import would exceed the plan limit of 2,000 tasks.");
  if (project.milestones.length + milestones.length > 1000) throw new Error("This import would exceed the plan limit of 1,000 milestones.");
}

export function importPlanningCsv(source: string, project: ProjectWorkspaceData): ProjectWorkspaceData {
  const rows = parseCsv(source.replace(/^\uFEFF/, ""));
  const headers = rows[0].map(header => header.trim().toLowerCase().replace(/[ -]+/g, "_"));
  const index = (...names: string[]) => headers.findIndex(header => names.includes(header));
  const value = (row: string[], ...names: string[]) => { const at = index(...names); return at >= 0 ? (row[at] ?? "").trim() : ""; };
  if (index("title", "task", "name", "summary") < 0) throw new Error("Add a title, task, name, or summary column to the CSV header.");
  const importedTasks: ProjectTask[] = [];
  const importedMilestones: ProjectMilestone[] = [];
  const sourceIdMap = new Map<string, string>();
  const dependencyReferences: { taskId: string; references: string[] }[] = [];
  const now = Date.now();
  for (const row of rows.slice(1)) {
    if (row.length > 40) throw new Error("A planning CSV row contains too many columns.");
    const title = value(row, "title", "task", "name", "summary").slice(0, 300);
    if (!title) continue;
    const type = value(row, "type", "record_type").toLowerCase();
    const date = parseImportDate(value(row, "date", "milestone_date", "due", "due_date", "dtstart"));
    if (type === "milestone" || type === "event") {
      if (!date) continue;
      importedMilestones.push({ id: crypto.randomUUID(), title, description: value(row, "description", "details").slice(0, 20_000), date, completed: /^(1|true|yes|complete|completed)$/i.test(value(row, "completed", "status")), createdAt: now, updatedAt: now });
      continue;
    }
    const rawStatus = value(row, "status", "state").toLowerCase();
    const matchingStatus = project.workflowColumns?.find(column => column.id.toLowerCase() === rawStatus || column.label.toLowerCase() === rawStatus);
    const completedStatus = project.workflowColumns?.find(column => column.completed);
    const progressStatus = project.workflowColumns?.find(column => /progress/i.test(column.label));
    const status = matchingStatus?.id ?? (/^(done|complete|completed)$/i.test(rawStatus) ? completedStatus?.id : /^(in[ -]?progress|in-process)$/i.test(rawStatus) ? progressStatus?.id : undefined) ?? project.workflowColumns?.[0]?.id ?? "backlog";
    const priorityRaw = value(row, "priority").toLowerCase();
    const priority = (["low", "medium", "high"].includes(priorityRaw) ? priorityRaw : "medium") as ProjectTask["priority"];
    const startDate = parseImportDate(value(row, "start", "start_date", "dtstart"));
    const dueDate = parseImportDate(value(row, "due", "due_date", "end", "dtend"));
    const estimateRaw = value(row, "estimate_minutes", "estimate", "duration_minutes");
    const estimate = Number(estimateRaw);
    const recurrenceRaw = value(row, "recurrence", "repeat").toLowerCase();
    const id = crypto.randomUUID();
    const sourceId = value(row, "id", "task_id");
    if (sourceId) sourceIdMap.set(sourceId, id);
    dependencyReferences.push({ taskId: id, references: value(row, "depends_on", "dependencies").split(";").map(reference => reference.trim()).filter(Boolean) });
    importedTasks.push({ id, title, description: value(row, "description", "details").slice(0, 20_000), status, priority, ...(startDate ? { startDate } : {}), ...(dueDate ? { dueDate } : {}), ...(estimateRaw && Number.isFinite(estimate) && estimate >= 0 ? { estimateMinutes: Math.min(1_000_000, estimate) } : {}), ...(recurrenceRaw === "daily" || recurrenceRaw === "weekly" || recurrenceRaw === "monthly" ? { recurrence: recurrenceRaw } : {}), dependsOn: [], createdAt: now, updatedAt: now });
  }
  if (!importedTasks.length && !importedMilestones.length) throw new Error("No task or dated milestone records were found in this CSV.");
  const importedTaskById = new Map(importedTasks.map(task => [task.id, task]));
  for (const reference of dependencyReferences) {
    const task = importedTaskById.get(reference.taskId);
    if (task) task.dependsOn = [...new Set(reference.references.map(id => sourceIdMap.get(id)).filter((id): id is string => !!id && id !== task.id))].slice(0, 500);
  }
  ensurePlanningCapacity(project, importedTasks, importedMilestones);
  return { ...project, tasks: [...project.tasks, ...importedTasks], milestones: [...project.milestones, ...importedMilestones] };
}

function foldCalendarLines(lines: string[]) {
  const encoder = new TextEncoder();
  return lines.map(line => {
    const folded: string[] = [];
    let current = "";
    let bytes = 0;
    for (const character of line) {
      const size = encoder.encode(character).length;
      if (bytes + size > 75 && current) {
        folded.push(current);
        current = ` ${character}`;
        bytes = 1 + size;
      } else {
        current += character;
        bytes += size;
      }
    }
    folded.push(current);
    return folded.join("\r\n");
  }).join("\r\n");
}

export function exportPlanningCalendar(project: ProjectWorkspaceData) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SketchDraw//Planning//EN", "CALSCALE:GREGORIAN"];
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  for (const task of project.tasks) {
    lines.push("BEGIN:VTODO", `UID:${task.id}@sketchdraw`, `DTSTAMP:${timestamp}`, `SUMMARY:${escapeCalendar(task.title)}`, `DESCRIPTION:${escapeCalendar(task.description)}`);
    if (task.startDate) lines.push(`DTSTART;VALUE=DATE:${calendarDate(task.startDate)}`);
    if (task.dueDate) lines.push(`DUE;VALUE=DATE:${calendarDate(task.dueDate)}`);
    const status = project.workflowColumns?.find(column => column.id === task.status);
    lines.push(`STATUS:${status?.completed ? "COMPLETED" : /progress/i.test(status?.label ?? task.status) ? "IN-PROCESS" : "NEEDS-ACTION"}`);
    lines.push(`X-SKETCHDRAW-STATUS:${escapeCalendar(task.status)}`);
    lines.push(`PRIORITY:${task.priority === "high" ? 1 : task.priority === "low" ? 9 : 5}`);
    if (task.recurrence) lines.push(`RRULE:FREQ=${task.recurrence.toUpperCase()}`);
    lines.push("END:VTODO");
  }
  for (const milestone of project.milestones) lines.push("BEGIN:VEVENT", `UID:${milestone.id}@sketchdraw`, `DTSTAMP:${timestamp}`, `DTSTART;VALUE=DATE:${calendarDate(milestone.date)}`, `SUMMARY:${escapeCalendar(milestone.title)}`, `DESCRIPTION:${escapeCalendar(milestone.description)}`, "END:VEVENT");
  lines.push("END:VCALENDAR");
  return foldCalendarLines(lines);
}

export function importPlanningCalendar(source: string, project: ProjectWorkspaceData): ProjectWorkspaceData {
  if (source.length > 5_000_000) throw new Error("The calendar file is larger than 5 MB.");
  const lines = source.replace(/\r\n|\r|\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const tasks: ProjectTask[] = [];
  const milestones: ProjectMilestone[] = [];
  let component: "VTODO" | "VEVENT" | undefined;
  let fields = new Map<string, string>();
  const now = Date.now();
  const finish = () => {
    if (!component) return;
    const title = unescapeCalendar(fields.get("SUMMARY") ?? "").slice(0, 300);
    if (!title) return;
    const description = unescapeCalendar(fields.get("DESCRIPTION") ?? "").slice(0, 20_000);
    if (component === "VEVENT") {
      const date = parseCalendarDate(fields.get("DTSTART"));
      if (date && parseProjectDate(date) !== undefined) {
        milestones.push({ id: crypto.randomUUID(), title, description, date, completed: false, createdAt: now, updatedAt: now });
        if (milestones.length + project.milestones.length > 1000) throw new Error("This import would exceed the plan limit of 1,000 milestones.");
      }
    } else {
      const startDate = parseCalendarDate(fields.get("DTSTART"));
      const dueDate = parseCalendarDate(fields.get("DUE") ?? fields.get("DTEND"));
      const frequency = fields.get("RRULE")?.match(/(?:^|;)FREQ=(DAILY|WEEKLY|MONTHLY)(?:;|$)/i)?.[1]?.toLowerCase();
      const statusValue = fields.get("X-SKETCHDRAW-STATUS");
      const importedStatus = statusValue ? unescapeCalendar(statusValue) : undefined;
       const existingColumn = importedStatus ? project.workflowColumns?.find(column => column.id === importedStatus) : undefined;
      const completed = fields.get("STATUS")?.toUpperCase() === "COMPLETED";
      const completedColumn = project.workflowColumns?.find(column => column.completed);
      const initialColumn = project.workflowColumns?.find(column => !column.completed) ?? project.workflowColumns?.[0];
      const inProgressColumn = project.workflowColumns?.find(column => /progress/i.test(column.label));
      const calendarPriority = Number(fields.get("PRIORITY"));
      const priority: ProjectTask["priority"] = calendarPriority > 0 && calendarPriority <= 3 ? "high" : calendarPriority >= 7 && calendarPriority <= 9 ? "low" : "medium";
      const importedInProgress = fields.get("STATUS")?.toUpperCase() === "IN-PROCESS";
      tasks.push({ id: crypto.randomUUID(), title, description, status: existingColumn?.id ?? (completed ? completedColumn?.id ?? "done" : importedInProgress ? inProgressColumn?.id ?? initialColumn?.id ?? "backlog" : initialColumn?.id ?? "backlog"), priority, ...(startDate && parseProjectDate(startDate) !== undefined ? { startDate } : {}), ...(dueDate && parseProjectDate(dueDate) !== undefined ? { dueDate } : {}), ...(frequency ? { recurrence: frequency as ProjectTask["recurrence"] } : {}), dependsOn: [], createdAt: now, updatedAt: now });
      if (tasks.length + project.tasks.length > 2000) throw new Error("This import would exceed the plan limit of 2,000 tasks.");
    }
  };
  for (const line of lines) {
    const componentMatch = line.match(/^BEGIN:(VTODO|VEVENT)$/i);
    if (componentMatch) { finish(); component = componentMatch[1].toUpperCase() as "VTODO" | "VEVENT"; fields = new Map(); continue; }
    if (/^END:(VTODO|VEVENT)$/i.test(line)) { finish(); component = undefined; fields = new Map(); continue; }
    if (!component) continue;
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    const key = line.slice(0, separator).split(";", 1)[0].toUpperCase();
    if (["SUMMARY", "DESCRIPTION", "DTSTART", "DUE", "DTEND", "STATUS", "RRULE", "PRIORITY", "X-SKETCHDRAW-STATUS"].includes(key)) fields.set(key, line.slice(separator + 1));
  }
  finish();
  if (!tasks.length && !milestones.length) throw new Error("No supported VTODO tasks or VEVENT milestones were found in this calendar file.");
  ensurePlanningCapacity(project, tasks, milestones);
  return { ...project, tasks: [...project.tasks, ...tasks], milestones: [...project.milestones, ...milestones] };
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const reportDate = (value?: string) => escapeHtml(formatProjectDate(value));

export function buildProjectReportHtml(project: ProjectWorkspaceData) {
  const columns = project.workflowColumns ?? [];
  const tasks = project.tasks.map(task => `<tr><td>${escapeHtml(task.title)}</td><td>${escapeHtml(columns.find(column => column.id === task.status)?.label ?? task.status)}</td><td>${escapeHtml(task.priority)}</td><td>${reportDate(task.startDate)}</td><td>${reportDate(task.dueDate)}</td><td>${task.estimateMinutes ?? ""}</td></tr>`).join("");
  const milestones = project.milestones.map(item => `<li><time>${reportDate(item.date)}</time> <strong>${escapeHtml(item.title)}</strong>${item.completed ? " (complete)" : ""}${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}</li>`).join("");
  const decisions = project.logEntries.filter((entry: ProjectLogEntry) => entry.kind === "decision").map(entry => `<li><strong>${escapeHtml(entry.title)}</strong><p>${escapeHtml(entry.details)}</p>${entry.owner ? `<small>Owner: ${escapeHtml(entry.owner)}</small>` : ""}</li>`).join("");
  const risks = project.logEntries.filter(entry => entry.kind === "risk" || entry.kind === "question").map(entry => `<li><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.kind)}${entry.resolved ? " · resolved" : " · open"}</small><p>${escapeHtml(entry.details)}</p></li>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(project.name)} — Project report</title><style>body{font:14px/1.5 system-ui,sans-serif;max-width:980px;margin:40px auto;padding:0 24px;color:#18202b}h1{margin:0 0 8px}h2{margin:30px 0 10px;border-bottom:1px solid #d8dde5;padding-bottom:7px}p{white-space:pre-wrap}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px;border-bottom:1px solid #e2e6eb;vertical-align:top}th{background:#f4f6f8}li{margin:10px 0}time,small{color:#596475}@media print{body{margin:0;max-width:none;padding:0 12mm}}</style></head><body><header><small>SKETCHDRAW PROJECT REPORT</small><h1>${escapeHtml(project.name)}</h1><p>${escapeHtml(project.description)}</p><small>Generated ${new Date().toLocaleString()}</small></header><h2>Summary</h2><p>${project.tasks.length} tasks · ${project.milestones.length} milestones · ${project.logEntries.filter(entry => entry.kind === "decision").length} decisions · ${project.notes.length} notes</p><h2>Tasks</h2><table><thead><tr><th>Task</th><th>Status</th><th>Priority</th><th>Start</th><th>Due</th><th>Estimate (min)</th></tr></thead><tbody>${tasks || "<tr><td colspan=6>No tasks</td></tr>"}</tbody></table><h2>Milestones</h2><ul>${milestones || "<li>No milestones</li>"}</ul><h2>Decisions</h2><ul>${decisions || "<li>No decisions recorded</li>"}</ul><h2>Risks and questions</h2><ul>${risks || "<li>No open risks or questions</li>"}</ul></body></html>`;
}
