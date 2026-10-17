import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import type { ProjectChecklistItem, ProjectFileEntry, ProjectLogEntry, ProjectMilestone, ProjectNote, ProjectTask, ProjectTaskStatus, ProjectWorkspaceData, ProjectWorkflowColumn } from "../../model";
import { ProjectCalendar } from "./ProjectCalendar";
import { ProjectFiles } from "./ProjectFiles";
import { ProjectLog } from "./ProjectLog";
import { ProjectPlansOverview } from "./ProjectPlansOverview";
import { ProjectTimeline } from "./ProjectTimeline";
import { DEFAULT_WORKFLOW_COLUMNS } from "./project-data";
import { advanceRecurringDate, formatProjectDate, isProjectTaskComplete, isProjectTaskOverdue, projectTaskWarnings, TASK_PRIORITY_LABELS } from "./project-utils";
import { buildProjectReportHtml, exportPlanningCalendar, exportPlanningCsv, importPlanningCalendar, importPlanningCsv } from "./planning-exchange";
import type { DocumentWorkspaceArea } from "../workspace/workspace-types";

export type ProjectWorkspaceView = "home" | "plans" | "notes" | "tasks" | "checklist" | "kanban" | "timeline" | "calendar" | "log" | "files" | "exchange" | "report";
type Props = {
  data: ProjectWorkspaceData;
  editable: boolean;
  fileName: string;
  recentPlans: string[];
  planningPath?: string;
  canvasFileName?: string;
  dirty: boolean;
  saving: boolean;
  onChange: (data: ProjectWorkspaceData) => void;
  onNavigate: (area: DocumentWorkspaceArea) => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onAddPlans: () => void;
  onOpenPlan: (path: string) => void;
  onExport: (fileName: string, extension: "html" | "csv" | "ics", contents: string) => Promise<boolean>;
};

const VIEWS: { value: ProjectWorkspaceView; label: string }[] = [
  { value: "home", label: "Project Home" }, { value: "plans", label: "All plans" }, { value: "notes", label: "Notes" },
  { value: "tasks", label: "Tasks" }, { value: "checklist", label: "Checklist" }, { value: "kanban", label: "Kanban" },
  { value: "timeline", label: "Timeline" }, { value: "calendar", label: "Calendar" }, { value: "exchange", label: "Import / export" }, { value: "report", label: "Reports" },
  { value: "log", label: "Decision log" }, { value: "files", label: "Files" },
];

export function ProjectWorkspace(props: Props) {
  const [view, setView] = createSignal<ProjectWorkspaceView>("home");
  const [selectedNoteId, setSelectedNoteId] = createSignal(props.data.notes[0]?.id ?? "");
  const [taskDraft, setTaskDraft] = createSignal("");
  const [taskQuery, setTaskQuery] = createSignal("");
  const [taskStatusFilter, setTaskStatusFilter] = createSignal("all");
  const [taskPriorityFilter, setTaskPriorityFilter] = createSignal("all");
  const [taskDateFilter, setTaskDateFilter] = createSignal("all");
  const [taskListLimit, setTaskListLimit] = createSignal(100);
  const [kanbanLimits, setKanbanLimits] = createSignal<Record<string, number>>({});
  const [workflowDraft, setWorkflowDraft] = createSignal("");
  const [exchangeMessage, setExchangeMessage] = createSignal("");
  const [exchangeFormat, setExchangeFormat] = createSignal<"csv" | "ics">("csv");
  let exchangeInput: HTMLInputElement | undefined;
  const [checklistDraft, setChecklistDraft] = createSignal("");
  const [draggedTaskId, setDraggedTaskId] = createSignal<string>();
  const [dragOverTaskId, setDragOverTaskId] = createSignal<string>();
  const [dragOverColumn, setDragOverColumn] = createSignal<ProjectTaskStatus>();
  let taskDragPointer: { id: string; pointerId: number; startX: number; startY: number; active: boolean } | undefined;
  let previousPlanningPath = props.planningPath;
  createEffect(() => {
    const path = props.planningPath;
    if (path === previousPlanningPath) return;
    previousPlanningPath = path;
    setTaskListLimit(100);
    setKanbanLimits({});
  });
  const update = (patch: Partial<ProjectWorkspaceData>) => props.onChange({ ...props.data, ...patch });
  const workflowColumns = () => props.data.workflowColumns?.length ? props.data.workflowColumns : DEFAULT_WORKFLOW_COLUMNS;
  const tasksById = createMemo(() => new Map<string, ProjectTask>(props.data.tasks.map(task => [task.id, task] as const)));
  const isComplete = (task: ProjectTask) => isProjectTaskComplete(task, workflowColumns());
  const visibleTasks = createMemo(() => props.data.tasks.filter(task => {
    const query = taskQuery().trim().toLocaleLowerCase();
    return (!query || `${task.title} ${task.description}`.toLocaleLowerCase().includes(query))
      && (taskStatusFilter() === "all" || task.status === taskStatusFilter())
      && (taskPriorityFilter() === "all" || task.priority === taskPriorityFilter())
      && (taskDateFilter() === "all" || taskDateFilter() === "overdue" && isProjectTaskOverdue(task) && !isComplete(task) || taskDateFilter() === "scheduled" && !!(task.startDate || task.dueDate));
  }));
  const taskListItems = createMemo(() => visibleTasks().slice(0, taskListLimit()));
  const visibleTasksByColumn = createMemo(() => new Map<ProjectTaskStatus, ProjectTask[]>(workflowColumns().map(column => [column.id, visibleTasks().filter(task => task.status === column.id)] as const)));
  const tasksForColumn = (id: ProjectTaskStatus) => visibleTasksByColumn().get(id) ?? [];
  const shownTasksForColumn = (id: ProjectTaskStatus) => tasksForColumn(id).slice(0, kanbanLimits()[id] ?? 40);
  const nextRecurringTask = (task: ProjectTask, now = Date.now()): ProjectTask => ({ ...task, id: crypto.randomUUID(), status: workflowColumns().find(column => !column.completed)?.id ?? workflowColumns()[0].id, startDate: advanceRecurringDate(task.startDate, task.recurrence), dueDate: advanceRecurringDate(task.dueDate, task.recurrence), createdAt: now, updatedAt: now, dependsOn: [], checklist: task.checklist?.map(item => ({ ...item, id: crypto.randomUUID(), done: false })) });
  const selectedNote = () => props.data.notes.find(note => note.id === selectedNoteId()) ?? props.data.notes[0];
  const updateNote = (id: string, patch: Partial<ProjectNote>) => {
    const now = Date.now();
    update({ notes: props.data.notes.map(note => note.id === id ? { ...note, ...patch, updatedAt: now } : note) });
  };
  const updateTask = (id: string, patch: Partial<ProjectTask>) => {
    const now = Date.now();
    const before = props.data.tasks.find(task => task.id === id);
    const changed = props.data.tasks.map(task => task.id === id ? { ...task, ...patch, updatedAt: now } : task);
    const after = changed.find(task => task.id === id);
    if (before && after && !isComplete(before) && isComplete(after) && after.recurrence) changed.push(nextRecurringTask(after, now));
    update({ tasks: changed });
  };
  const updateChecklistItem = (id: string, patch: Partial<ProjectChecklistItem>) => {
    if (!props.editable) return;
    update({ checklist: props.data.checklist.map(item => item.id === id ? { ...item, ...patch } : item) });
  };
  const addChecklistItem = (event?: SubmitEvent) => {
    event?.preventDefault();
    const text = checklistDraft().trim();
    if (!text || !props.editable) return;
    const item: ProjectChecklistItem = { id: crypto.randomUUID(), text: text.slice(0, 2000), done: false };
    update({ checklist: [...props.data.checklist, item] });
    setChecklistDraft("");
  };
  const createNote = () => {
    if (!props.editable) return;
    const now = Date.now();
    const note: ProjectNote = { id: crypto.randomUUID(), title: "Untitled note", content: "", createdAt: now, updatedAt: now };
    update({ notes: [note, ...props.data.notes] });
    setSelectedNoteId(note.id);
    setView("notes");
  };
  const createTask = (event: SubmitEvent) => {
    event.preventDefault();
    const title = taskDraft().trim();
    if (!title || !props.editable) return;
    const now = Date.now();
    const task: ProjectTask = { id: crypto.randomUUID(), title: title.slice(0, 300), description: "", status: workflowColumns().find(column => !column.completed)?.id ?? workflowColumns()[0].id, priority: "medium", dependsOn: [], createdAt: now, updatedAt: now };
    update({ tasks: [...props.data.tasks, task] });
    setTaskDraft("");
  };
  const deleteNote = (id: string) => {
    if (!props.editable) return;
    const notes = props.data.notes.filter(note => note.id !== id);
    update({ notes });
    if (selectedNoteId() === id) setSelectedNoteId(notes[0]?.id ?? "");
  };
  const deleteTask = (id: string) => {
    if (!props.editable) return;
    update({ tasks: props.data.tasks.filter(task => task.id !== id).map(task => ({ ...task, dependsOn: (task.dependsOn ?? []).filter(dependency => dependency !== id) })) });
  };
  const deleteMilestone = (id: string) => update({ milestones: props.data.milestones.filter(item => item.id !== id) });
  const deleteLogEntry = (id: string) => update({ logEntries: props.data.logEntries.filter(item => item.id !== id) });
  const deleteProjectFile = (id: string) => update({ files: props.data.files.filter(item => item.id !== id) });
  const updateMilestone = (id: string, patch: Partial<ProjectMilestone>) => update({ milestones: props.data.milestones.map(item => item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item) });
  const updateLogEntry = (id: string, patch: Partial<ProjectLogEntry>) => update({ logEntries: props.data.logEntries.map(item => item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item) });
  const updateProjectFile = (id: string, patch: Partial<ProjectFileEntry>) => update({ files: props.data.files.map(item => item.id === id ? { ...item, ...patch } as ProjectFileEntry : item) });
  const addMilestone = (title: string, date: string) => {
    const now = Date.now();
    update({ milestones: [...props.data.milestones, { id: crypto.randomUUID(), title, description: "", date, completed: false, createdAt: now, updatedAt: now }] });
  };
  const addLogEntry = (entry: ProjectLogEntry) => update({ logEntries: [entry, ...props.data.logEntries] });
  const addProjectFile = (file: ProjectFileEntry) => update({ files: [...props.data.files, file] });
  const addWorkflowColumn = (event: SubmitEvent) => {
    event.preventDefault();
    const label = workflowDraft().trim().slice(0, 60);
    if (!props.editable || !label || workflowColumns().length >= 12) return;
    const base = label.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "stage";
    let id = base;
    let suffix = 2;
    while (workflowColumns().some(column => column.id === id)) id = `${base}-${suffix++}`;
    update({ workflowColumns: [...workflowColumns(), { id, label }] });
    setWorkflowDraft("");
  };
  const updateWorkflowColumn = (id: string, patch: Partial<ProjectWorkflowColumn>) => {
    if (!props.editable) return;
    let columns = workflowColumns().map(column => column.id === id ? { ...column, ...patch } : column);
    if (patch.completed) columns = columns.map(column => ({ ...column, completed: column.id === id }));
    if (!columns.some(column => column.completed)) return;
    update({ workflowColumns: columns });
  };
  const deleteWorkflowColumn = (id: string) => {
    if (!props.editable || workflowColumns().length <= 2) return;
    const removed = workflowColumns().find(column => column.id === id);
    const columns = workflowColumns().filter(column => column.id !== id);
    if (removed?.completed && !columns.some(column => column.completed)) return;
    const fallback = columns.find(column => !column.completed)?.id ?? columns[0].id;
    update({ workflowColumns: columns, tasks: props.data.tasks.map(task => task.status === id ? { ...task, status: fallback, updatedAt: Date.now() } : task) });
  };
  const importExchangeFile = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const source = await file.text();
      const imported = exchangeFormat() === "csv" ? importPlanningCsv(source, { ...props.data, workflowColumns: workflowColumns() }) : importPlanningCalendar(source, { ...props.data, workflowColumns: workflowColumns() });
      update(imported);
      setExchangeMessage(`Imported ${imported.tasks.length - props.data.tasks.length} tasks and ${imported.milestones.length - props.data.milestones.length} milestones.`);
    } catch (cause) { setExchangeMessage(String(cause)); }
  };
  const exportFileName = (extension: string) => `${(props.data.name || "Planning").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim() || "Planning"}.${extension}`;
  const exportPlanningFile = async (extension: "html" | "csv" | "ics", contents: string) => {
    setExchangeMessage("");
    if (await props.onExport(exportFileName(extension), extension, contents)) setExchangeMessage(`${extension.toUpperCase()} export saved.`);
  };
  const exportReport = () => void exportPlanningFile("html", buildProjectReportHtml({ ...props.data, workflowColumns: workflowColumns() }));
  const exportCsv = () => void exportPlanningFile("csv", exportPlanningCsv({ ...props.data, workflowColumns: workflowColumns() }));
  const exportCalendar = () => void exportPlanningFile("ics", exportPlanningCalendar({ ...props.data, workflowColumns: workflowColumns() }));
  const captureBaseline = () => update({ tasks: props.data.tasks.map(task => ({ ...task, baselineStartDate: task.startDate, baselineDueDate: task.dueDate, updatedAt: Date.now() })) });
  const setWorkingDays = (day: number, enabled: boolean) => {
    const current = props.data.workingDays?.length ? props.data.workingDays : [1, 2, 3, 4, 5];
    const next = enabled ? [...new Set([...current, day])].sort() : current.filter(value => value !== day);
    if (!next.length) return;
    update({ workingDays: next });
  };
  const reorderTask = (id: string, status: ProjectTaskStatus, edge: "top" | "bottom" | "before" | "after", targetId?: string) => {
    if (!props.editable) return;
    const tasks = [...props.data.tasks];
    const sourceIndex = tasks.findIndex(task => task.id === id);
    if (sourceIndex < 0) return;
    const [source] = tasks.splice(sourceIndex, 1);
    const moved = source.status === status ? source : { ...source, status, updatedAt: Date.now() };
    let targetIndex = -1;
    if (targetId && targetId !== id) {
      targetIndex = tasks.findIndex(task => task.id === targetId);
      if (targetIndex >= 0 && edge === "after") targetIndex++;
    }
    if (targetIndex < 0) {
      if (edge === "top") targetIndex = tasks.findIndex(task => task.status === status);
      else {
        const matching = tasks.map((task, index) => task.status === status ? index : -1).filter(index => index >= 0);
        const last = matching[matching.length - 1];
        targetIndex = last === undefined ? tasks.length : last + 1;
      }
    }
    tasks.splice(Math.max(0, targetIndex), 0, moved);
    if (!isComplete(source) && isComplete(moved) && moved.recurrence) tasks.push(nextRecurringTask(moved));
    update({ tasks });
  };
  const dropOnColumn = (event: DragEvent, status: ProjectTaskStatus) => {
    event.preventDefault();
    const id = event.dataTransfer?.getData("text/plain") || draggedTaskId();
    if (id) reorderTask(id, status, "bottom");
    clearTaskDrag();
  };
  const clearTaskDrag = () => {
    taskDragPointer = undefined;
    setDraggedTaskId(undefined);
    setDragOverTaskId(undefined);
    setDragOverColumn(undefined);
  };
  const beginTaskDrag = (event: PointerEvent, id: string) => {
    if (!props.editable || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    try { (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); } catch { /* Pointer capture may be unavailable in older WebViews. */ }
    taskDragPointer = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false };
  };
  const updateTaskDrag = (event: PointerEvent) => {
    const drag = taskDragPointer;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
    if (!drag.active) {
      drag.active = true;
      setDraggedTaskId(drag.id);
    }
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const card = target?.closest<HTMLElement>(".project-kanban-card");
    const column = target?.closest<HTMLElement>(".project-kanban-column");
    const targetId = card?.dataset.taskId;
    setDragOverTaskId(targetId === drag.id ? undefined : targetId);
    setDragOverColumn(column?.dataset.status as ProjectTaskStatus | undefined);
  };
  const finishTaskDrag = (event: PointerEvent) => {
    const drag = taskDragPointer;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.active) {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const card = target?.closest<HTMLElement>(".project-kanban-card");
      const column = target?.closest<HTMLElement>(".project-kanban-column");
      const targetId = card?.dataset.taskId;
      const status = (card?.closest<HTMLElement>(".project-kanban-column")?.dataset.status ?? column?.dataset.status) as ProjectTaskStatus | undefined;
      if (status && targetId && targetId !== drag.id) {
        const rect = card!.getBoundingClientRect();
        reorderTask(drag.id, status, event.clientY < rect.top + rect.height / 2 ? "before" : "after", targetId);
      } else if (status && !targetId) {
        reorderTask(drag.id, status, "bottom");
      }
    }
    try { (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId); } catch { /* The pointer may already have been released. */ }
    clearTaskDrag();
  };
  const moveTask = (task: ProjectTask, direction: -1 | 1) => {
    const columns = workflowColumns();
    const index = columns.findIndex(column => column.id === task.status);
    const next = columns[Math.max(0, Math.min(columns.length - 1, index + direction))];
    if (next && next.id !== task.status) reorderTask(task.id, next.id, "bottom");
  };
  const openView = (next: ProjectWorkspaceView) => setView(next);

  return (
    <section class="project-workspace-overlay" classList={{ "is-print-report": view() === "report" }} aria-label="Planning workspace">
      <header class="project-file-toolbar"><div><span class="project-eyebrow">PLANNING FILE</span><strong title={props.fileName}>{props.fileName}</strong><small>{props.saving ? "Saving…" : props.dirty ? "Unsaved changes" : "Saved"}</small></div><nav aria-label="Planning file actions"><button onClick={props.onNew}>New</button><button onClick={props.onOpen}>Open</button><button class="primary" disabled={props.saving || !props.dirty && !!props.fileName} onClick={props.onSave}>Save</button><button disabled={props.saving} onClick={props.onSaveAs}>Save as…</button></nav></header>
      <nav class="project-workspace-nav" aria-label="Project sections">
        <For each={VIEWS}>{item => <button class={view() === item.value ? "active" : ""} aria-current={view() === item.value ? "page" : undefined} onClick={() => openView(item.value)}>{item.label}{item.value === "tasks" && <span>{props.data.tasks.length}</span>}{item.value === "plans" && <span>{props.recentPlans.length}</span>}{item.value === "checklist" && <span>{props.data.checklist.filter(entry => entry.done).length}/{props.data.checklist.length}</span>}</button>}</For>
      </nav>

      <main class="project-workspace-content">
        <Show when={view() === "home"}>
          <div class="project-page project-home-page">
            <div class="project-page-heading"><div><span class="project-eyebrow">PLANNING HOME</span><h1>{props.data.name}</h1><p>Your .sdplan file holds notes, tasks, milestones, and reference files.</p></div><div class="project-home-actions"><button disabled={!props.editable} onClick={createNote}>New note</button><button disabled={!props.editable} onClick={() => setView("tasks")}>Add task</button><button disabled={!props.editable} onClick={() => setView("files")}>Add plan file</button></div></div>
            <section class="project-summary-card"><label><span>Project name</span><input disabled={!props.editable} maxlength="120" value={props.data.name} onInput={event => update({ name: event.currentTarget.value.slice(0, 120) })} /></label><label><span>What is this project about?</span><textarea disabled={!props.editable} maxlength="4000" rows="3" value={props.data.description} placeholder="Add a short project overview..." onInput={event => update({ description: event.currentTarget.value })} /></label></section>
            <div class="project-metrics" aria-label="Project summary">
              <button onClick={() => setView("notes")}><span class="project-metric-icon notes-icon">N</span><span><strong>{props.data.notes.length}</strong><small>Project notes</small></span></button>
              <button onClick={() => setView("tasks")}><span class="project-metric-icon tasks-icon">T</span><span><strong>{props.data.tasks.filter(task => !isComplete(task)).length}</strong><small>Open tasks</small></span></button>
              <button onClick={() => setView("timeline")}><span class="project-metric-icon milestone-icon">M</span><span><strong>{props.data.milestones.length}</strong><small>Milestones</small></span></button>
              <button onClick={() => setView("log")}><span class="project-metric-icon risk-icon">!</span><span><strong>{props.data.logEntries.filter(entry => !entry.resolved).length}</strong><small>Open decisions &amp; risks</small></span></button>
            </div>
            <div class="project-home-columns">
              <section class="project-home-card"><header><div><span class="project-eyebrow">NEXT ACTIONS</span><h2>Tasks to watch</h2></div><button onClick={() => setView("kanban")}>Open board &rarr;</button></header>
                <Show when={props.data.tasks.some(task => !isComplete(task))} fallback={<div class="project-empty-inline"><span>No open tasks yet.</span><button disabled={!props.editable} onClick={() => setView("tasks")}>Create a task</button></div>}>
                  <div class="project-home-task-list"><For each={props.data.tasks.filter(task => !isComplete(task)).slice(0, 5).map(task => task.id)}>{id => { const task = () => tasksById().get(id)!; return <button class="project-home-task" onClick={() => setView("tasks")}><span class={`project-task-priority ${task().priority}`} /><span>{task().title || "Untitled task"}</span><small class={`project-task-due ${isProjectTaskOverdue(task()) && !isComplete(task()) ? "is-overdue" : ""}`}>{isProjectTaskOverdue(task()) && !isComplete(task()) ? "Overdue" : task().dueDate ? formatProjectDate(task().dueDate, { month: "short", day: "numeric" }) : TASK_PRIORITY_LABELS[task().priority]}</small></button>; }}</For></div>
                </Show>
              </section>
              <section class="project-home-card"><header><div><span class="project-eyebrow">IDEAS &amp; DETAILS</span><h2>Recent notes</h2></div><button onClick={() => setView("notes")}>All notes &rarr;</button></header>
                <Show when={props.data.notes.length} fallback={<div class="project-empty-inline"><span>Keep decisions and context with your tasks.</span><button disabled={!props.editable} onClick={createNote}>Create a note</button></div>}>
                  <div class="project-home-note-list"><For each={props.data.notes.slice(0, 3).map(note => note.id)}>{id => { const note = () => props.data.notes.find(item => item.id === id)!; return <button onClick={() => { setSelectedNoteId(id); setView("notes"); }}><strong>{note().title || "Untitled note"}</strong><span>{note().content || "No note text yet"}</span></button>; }}</For></div>
                </Show>
              </section>
            </div>
            <nav class="project-home-shortcuts" aria-label="Project tools">
              <button onClick={() => setView("timeline")}><strong>Timeline</strong><span>{props.data.milestones.length} milestones</span></button>
              <button onClick={() => setView("calendar")}><strong>Calendar</strong><span>Deadlines &amp; dates</span></button>
              <button onClick={() => setView("checklist")}><strong>Checklist</strong><span>{props.data.checklist.filter(item => item.done).length}/{props.data.checklist.length} complete</span></button>
              <button onClick={() => setView("log")}><strong>Decisions &amp; risks</strong><span>{props.data.logEntries.length} records</span></button>
              <button onClick={() => setView("files")}><strong>Planning files</strong><span>{props.data.files.length} items</span></button>
              <button onClick={() => setView("report")}><strong>Project report</strong><span>Summary &amp; decisions</span></button>
            </nav>
            <button class="project-open-canvas-card" onClick={() => props.onNavigate("canvas")}><span><strong>Return to canvas</strong><small>{props.canvasFileName ? `Continue in ${props.canvasFileName}` : "Create or open a whiteboard"}</small></span><span aria-hidden="true">&rarr;</span></button>
          </div>
        </Show>

        <Show when={view() === "plans"}><ProjectPlansOverview paths={props.recentPlans} currentPath={props.planningPath} currentData={props.data} onOpen={props.onOpenPlan} onAddPlans={props.onAddPlans} /></Show>

        <Show when={view() === "notes"}>
          <div class="project-page project-notes-page">
            <div class="project-page-heading"><div><span class="project-eyebrow">PROJECT NOTES</span><h1>Notes</h1><p>Keep decisions, context, and ideas with this project.</p></div><button disabled={!props.editable} class="project-primary-action" onClick={createNote}>New note</button></div>
            <div class="project-notes-layout">
              <aside class="project-notes-list" aria-label="Notes list"><Show when={props.data.notes.length} fallback={<div class="project-empty-state"><strong>No notes yet</strong><p>Create a note to keep project context here.</p><button disabled={!props.editable} onClick={createNote}>Create a note</button></div>}>
                <For each={props.data.notes.map(note => note.id)}>{id => { const note = () => props.data.notes.find(item => item.id === id)!; return <button class={selectedNote()?.id === id ? "active" : ""} onClick={() => setSelectedNoteId(id)}><strong>{note().title || "Untitled note"}</strong><span>{note().content.split("\n").find(line => line.trim()) || "No text yet"}</span><small>{new Date(note().updatedAt).toLocaleDateString()}</small></button>; }}</For>
              </Show></aside>
              <Show when={selectedNote()} fallback={<div class="project-note-editor project-empty-state"><strong>Select a note</strong><p>Choose a note or create one to get started.</p></div>}>
                <article class="project-note-editor"><div class="project-note-editor-heading"><span>NOTE</span><button disabled={!props.editable} aria-label="Delete note" title="Delete note" onClick={() => { const note = selectedNote(); if (note) deleteNote(note.id); }}>Delete</button></div><input class="project-note-title" disabled={!props.editable} maxlength="200" value={selectedNote()?.title ?? ""} aria-label="Note title" onInput={event => { const note = selectedNote(); if (note) updateNote(note.id, { title: event.currentTarget.value }); }} /><textarea disabled={!props.editable} maxlength="100000" value={selectedNote()?.content ?? ""} placeholder="Write a note..." aria-label="Note content" onInput={event => { const note = selectedNote(); if (note) updateNote(note.id, { content: event.currentTarget.value }); }} /><small>Saved inside this .sdplan file</small></article>
              </Show>
            </div>
          </div>
        </Show>

        <Show when={view() === "tasks"}>
          <div class="project-page project-tasks-page">
            <div class="project-page-heading"><div><span class="project-eyebrow">PROJECT TASKS</span><h1>Tasks</h1><p>Track work, schedules, effort, and dependencies.</p></div><div class="project-page-actions"><button onClick={() => setView("timeline")}>Timeline</button><button onClick={() => setView("kanban")}>Board</button></div></div>
            <form class="project-add-task" onSubmit={createTask}><input value={taskDraft()} disabled={!props.editable} maxlength="300" placeholder="Add a task..." aria-label="New task title" onInput={event => setTaskDraft(event.currentTarget.value)} /><button disabled={!props.editable || !taskDraft().trim()}>Add task</button></form>
            <div class="project-task-filters"><label>Search<input type="search" value={taskQuery()} placeholder="Task or detail" onInput={event => setTaskQuery(event.currentTarget.value)} /></label><label>Status<select value={taskStatusFilter()} onChange={event => setTaskStatusFilter(event.currentTarget.value)}><option value="all">All statuses</option>{workflowColumns().map(column => <option value={column.id}>{column.label}</option>)}</select></label><label>Priority<select value={taskPriorityFilter()} onChange={event => setTaskPriorityFilter(event.currentTarget.value)}><option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label><label>Schedule<select value={taskDateFilter()} onChange={event => setTaskDateFilter(event.currentTarget.value)}><option value="all">All tasks</option><option value="scheduled">Scheduled</option><option value="overdue">Overdue</option></select></label><span>Showing {taskListItems().length} of {visibleTasks().length}</span></div>
            <section class="project-task-list" aria-label="Project task list"><Show when={props.data.tasks.length} fallback={<div class="project-empty-state"><strong>No tasks yet</strong><p>Add one above to start a lightweight project plan.</p></div>}>
              <Show when={visibleTasks().length} fallback={<div class="project-empty-inline"><span>No tasks match the current filters.</span><button onClick={() => { setTaskQuery(""); setTaskStatusFilter("all"); setTaskPriorityFilter("all"); setTaskDateFilter("all"); }}>Clear filters</button></div>}>
              <For each={taskListItems().map(task => task.id)}>{id => { const task = () => tasksById().get(id)!; const warnings = () => projectTaskWarnings(task(), props.data.tasks); const [dependencyPickerOpen, setDependencyPickerOpen] = createSignal(false); const [dependencyQuery, setDependencyQuery] = createSignal(""); const dependencyOptions = () => props.data.tasks.filter(candidate => candidate.id !== id && `${candidate.title} ${candidate.description}`.toLocaleLowerCase().includes(dependencyQuery().trim().toLocaleLowerCase())).slice(0, 50); return <article class={`project-task-row ${isComplete(task()) ? "is-done" : ""}`}>
                <header class="project-task-row-heading"><button class="project-task-check" disabled={!props.editable} aria-label={isComplete(task()) ? `Reopen ${task().title}` : `Complete ${task().title}`} onClick={() => updateTask(id, { status: isComplete(task()) ? workflowColumns().find(column => !column.completed)?.id ?? workflowColumns()[0].id : workflowColumns().find(column => column.completed)?.id ?? workflowColumns()[workflowColumns().length - 1].id })}>{isComplete(task()) ? "\u2713" : ""}</button>
                <div class="project-task-main"><input disabled={!props.editable} value={task().title} maxlength="300" aria-label="Task title" onInput={event => updateTask(id, { title: event.currentTarget.value })} /><Show when={props.editable} fallback={<p>{task().description}</p>}><textarea value={task().description} maxlength="20000" placeholder="Add details" aria-label={`Details for ${task().title}`} onInput={event => updateTask(id, { description: event.currentTarget.value })} /></Show>
                  <Show when={warnings().length}><span class="project-task-warning" title={warnings().join("; ")}>{warnings()[0]}</span></Show></div><button class="project-task-delete" disabled={!props.editable} aria-label={`Delete ${task().title}`} title="Delete task" onClick={() => deleteTask(id)}>&times;</button></header>
                <div class="project-task-controls">
                <label class="project-task-field"><span>Status</span><select disabled={!props.editable} value={task().status} onChange={event => updateTask(id, { status: event.currentTarget.value as ProjectTaskStatus })}>{workflowColumns().map(column => <option value={column.id}>{column.label}</option>)}</select></label>
                <label class={`project-task-field project-priority-field priority-${task().priority}`}><span>Priority</span><select disabled={!props.editable} value={task().priority} onChange={event => updateTask(id, { priority: event.currentTarget.value as ProjectTask["priority"] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
                <label class="project-task-field"><span>Start</span><input type="date" disabled={!props.editable} value={task().startDate ?? ""} onInput={event => updateTask(id, { startDate: event.currentTarget.value || undefined })} /></label>
                <label class="project-task-field project-due-date"><span>Due</span><input type="date" disabled={!props.editable} value={task().dueDate ?? ""} onInput={event => updateTask(id, { dueDate: event.currentTarget.value || undefined })} /><Show when={isProjectTaskOverdue(task()) && !isComplete(task())}><small class="project-overdue-label">Overdue</small></Show></label>
                <label class="project-task-field"><span>Estimate (hours)</span><input type="number" min="0" max="16666.65" step="0.25" disabled={!props.editable} value={task().estimateMinutes === undefined ? "" : String((task().estimateMinutes ?? 0) / 60)} onInput={event => { const hours = Number(event.currentTarget.value); updateTask(id, { estimateMinutes: event.currentTarget.value === "" ? undefined : Number.isFinite(hours) ? Math.round(Math.max(0, Math.min(16666.65, hours)) * 60) : undefined }); }} /></label>
                <label class="project-task-field"><span>Repeat</span><select disabled={!props.editable} value={task().recurrence ?? ""} onChange={event => updateTask(id, { recurrence: (event.currentTarget.value || undefined) as ProjectTask["recurrence"] })}><option value="">Never</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
                </div>
                <footer class="project-task-row-bottom"><details class="project-dependency-picker" onToggle={event => setDependencyPickerOpen(event.currentTarget.open)}><summary>Dependencies ({(task().dependsOn ?? []).length})</summary><Show when={dependencyPickerOpen()}><div><label class="project-dependency-search"><span>Find a task</span><input type="search" value={dependencyQuery()} placeholder="Search tasks" onInput={event => setDependencyQuery(event.currentTarget.value)} /></label><div class="project-dependency-options"><Show when={dependencyOptions().length} fallback={<small>No matching tasks.</small>}>{dependencyOptions().map(dependency => <label><input type="checkbox" disabled={!props.editable} checked={(task().dependsOn ?? []).includes(dependency.id)} onChange={event => updateTask(id, { dependsOn: event.currentTarget.checked ? [...new Set([...(task().dependsOn ?? []), dependency.id])] : (task().dependsOn ?? []).filter(item => item !== dependency.id) })} /><span>{dependency.title || "Untitled task"}</span></label>)}</Show></div><small>Showing up to 50 matches. Search to find other tasks.</small></div></Show></details>
                <Show when={task().recurrence}><small>Creates the next task when this one is completed.</small></Show><div class="project-task-row-actions"><button disabled={!props.editable} title="Move task to the top" onClick={() => reorderTask(id, task().status, "top")}>Move up</button><button disabled={!props.editable} title="Move task to the bottom" onClick={() => reorderTask(id, task().status, "bottom")}>Move down</button></div></footer>
              </article>; }}</For>
              <Show when={visibleTasks().length > taskListItems().length}><button class="project-load-more" onClick={() => setTaskListLimit(value => value + 100)}>Show next 100 tasks ({visibleTasks().length - taskListItems().length} remaining)</button></Show>
              </Show>
            </Show></section>
          </div>
        </Show>

        <Show when={view() === "checklist"}>
          <div class="project-page project-checklist-page">
            <div class="project-page-heading"><div><span class="project-eyebrow">PROJECT CHECKLIST</span><h1>Checklist</h1><p>Keep a standalone list of steps alongside the task board.</p></div><small class="project-checklist-progress">{props.data.checklist.filter(item => item.done).length} of {props.data.checklist.length} complete</small></div>
            <form class="project-add-task project-add-checklist-item" onSubmit={addChecklistItem}><input value={checklistDraft()} disabled={!props.editable} maxlength="2000" placeholder="Add a checklist item..." aria-label="New checklist item" onInput={event => setChecklistDraft(event.currentTarget.value)} /><button disabled={!props.editable || !checklistDraft().trim()}>Add item</button></form>
            <section class="project-checklist-list" aria-label="Project checklist items"><Show when={props.data.checklist.length} fallback={<div class="project-empty-state"><strong>No checklist items yet</strong><p>Add a few steps to track small pieces of work that do not need their own task.</p></div>}>
              <For each={props.data.checklist.map(item => item.id)}>{id => { const item = () => props.data.checklist.find(entry => entry.id === id)!; return <div class={`project-checklist-row ${item().done ? "is-done" : ""}`}>
                <input type="checkbox" checked={item().done} disabled={!props.editable} aria-label={`${item().done ? "Reopen" : "Complete"} ${item().text || "checklist item"}`} onChange={event => updateChecklistItem(id, { done: event.currentTarget.checked })} />
                <Show when={props.editable} fallback={<span>{item().text}</span>}><input class="project-checklist-text" value={item().text} maxlength="2000" aria-label="Checklist item text" onInput={event => updateChecklistItem(id, { text: event.currentTarget.value })} /></Show>
                <Show when={props.editable}><button type="button" aria-label={`Remove ${item().text || "checklist item"}`} title="Remove checklist item" onClick={() => update({ checklist: props.data.checklist.filter(entry => entry.id !== id) })}>&times;</button></Show>
              </div>; }}</For>
            </Show></section>
          </div>
        </Show>

        <Show when={view() === "kanban"}>
          <div class="project-page project-kanban-page">
            <div class="project-page-heading"><div><span class="project-eyebrow">PROJECT BOARD</span><h1>Kanban</h1><p>Move work through your project’s own workflow.</p></div><button onClick={() => setView("tasks")}>Task details</button></div>
            <form class="project-add-task" onSubmit={createTask}><input value={taskDraft()} disabled={!props.editable} maxlength="300" placeholder="Add a task to To do..." aria-label="New task title" onInput={event => setTaskDraft(event.currentTarget.value)} /><button disabled={!props.editable || !taskDraft().trim()}>Add task</button></form>
            <div class="project-workflow-settings"><strong>Workflow columns</strong><For each={workflowColumns()}>{column => <label><input value={column.label} maxlength="60" disabled={!props.editable} aria-label={`${column.label} column name`} onChange={event => updateWorkflowColumn(column.id, { label: event.currentTarget.value.trim().slice(0, 60) || column.label })} /><span><input type="radio" name="project-complete-column" checked={!!column.completed} disabled={!props.editable} onChange={() => updateWorkflowColumn(column.id, { completed: true })} />Done</span><button type="button" disabled={!props.editable || workflowColumns().length <= 2 || !!column.completed && workflowColumns().filter(item => item.completed).length <= 1} aria-label={`Remove ${column.label} column`} onClick={() => deleteWorkflowColumn(column.id)}>&times;</button></label>}</For><form class="project-add-column" onSubmit={addWorkflowColumn}><input value={workflowDraft()} disabled={!props.editable || workflowColumns().length >= 12} maxlength="60" placeholder="Add a workflow stage" aria-label="New workflow column" onInput={event => setWorkflowDraft(event.currentTarget.value)} /><button disabled={!props.editable || !workflowDraft().trim() || workflowColumns().length >= 12}>Add column</button></form></div>
            <div class="project-task-filters"><label>Search<input type="search" value={taskQuery()} placeholder="Task or detail" onInput={event => setTaskQuery(event.currentTarget.value)} /></label><label>Priority<select value={taskPriorityFilter()} onChange={event => setTaskPriorityFilter(event.currentTarget.value)}><option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label><label>Schedule<select value={taskDateFilter()} onChange={event => setTaskDateFilter(event.currentTarget.value)}><option value="all">All tasks</option><option value="scheduled">Scheduled</option><option value="overdue">Overdue</option></select></label></div>
            <div class="project-kanban-columns" style={{ "--project-column-count": workflowColumns().length }}>{workflowColumns().map((column, columnIndex) => <section class={`project-kanban-column column-${column.id} ${dragOverColumn() === column.id ? "is-drop-target" : ""}`} data-status={column.id} aria-label={column.label} onDragOver={event => { event.preventDefault(); setDragOverColumn(column.id); }} onDragLeave={() => setDragOverColumn(undefined)} onDrop={event => dropOnColumn(event, column.id)}>
              <header><span><i />{column.label}</span><small>{tasksForColumn(column.id).length}</small></header>
              <Show when={tasksForColumn(column.id).length} fallback={<div class={`project-kanban-empty ${draggedTaskId() ? "is-drop-target" : ""}`}>Drop a task here</div>}>
                <div class="project-kanban-cards"><For each={shownTasksForColumn(column.id).map(task => task.id)}>{id => { const task = () => tasksById().get(id)!; const warnings = () => projectTaskWarnings(task(), props.data.tasks); return <article data-task-id={id} class={`project-kanban-card priority-${task().priority} ${isComplete(task()) ? "is-done" : ""} ${draggedTaskId() === id ? "is-dragging" : ""} ${dragOverTaskId() === id ? "is-drop-target" : ""}`} draggable={props.editable} onDragStart={event => { setDraggedTaskId(id); event.dataTransfer?.setData("text/plain", id); if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"; }} onDragEnd={clearTaskDrag} onDragOver={event => { event.preventDefault(); setDragOverTaskId(id); setDragOverColumn(task().status); }} onDragLeave={() => setDragOverTaskId(undefined)} onDrop={event => { event.preventDefault(); event.stopPropagation(); const source = event.dataTransfer?.getData("text/plain") || draggedTaskId(); const rect = event.currentTarget.getBoundingClientRect(); const edge = event.clientY < rect.top + rect.height / 2 ? "before" : "after"; if (source && source !== id) reorderTask(source, task().status, edge, id); clearTaskDrag(); }}>
                  <div class="project-kanban-card-meta"><span class={`project-priority-badge priority-${task().priority}`}><i />{TASK_PRIORITY_LABELS[task().priority]}</span><Show when={task().estimateMinutes !== undefined}><small>{(task().estimateMinutes! / 60).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} h</small></Show><Show when={task().dueDate}><time class={isProjectTaskOverdue(task()) && !isComplete(task()) ? "is-overdue" : ""}>{isProjectTaskOverdue(task()) && !isComplete(task()) ? "Overdue" : formatProjectDate(task().dueDate, { month: "short", day: "numeric" })}</time></Show><button class="project-kanban-drag-handle" type="button" aria-label={`Drag ${task().title || "untitled task"}`} title="Drag to reorder or change stage" onPointerDown={event => beginTaskDrag(event, id)} onPointerMove={updateTaskDrag} onPointerUp={finishTaskDrag} onPointerCancel={clearTaskDrag}><svg viewBox="0 0 12 16" aria-hidden="true"><circle cx="3" cy="3" r="1"/><circle cx="9" cy="3" r="1"/><circle cx="3" cy="8" r="1"/><circle cx="9" cy="8" r="1"/><circle cx="3" cy="13" r="1"/><circle cx="9" cy="13" r="1"/></svg></button></div>
                  <strong>{task().title || "Untitled task"}</strong><Show when={task().description}><p>{task().description}</p></Show>
                  <Show when={warnings().length}><span class="project-kanban-warning" title={warnings().join("; ")}>Schedule conflict</span></Show>
                  <Show when={(task().dependsOn ?? []).length}><small class="project-dependency-count">Depends on {(task().dependsOn ?? []).length} task(s)</small></Show>
                  <footer><button disabled={!props.editable} title="Move to top" onClick={() => reorderTask(id, task().status, "top")}>Top</button><button disabled={!props.editable || columnIndex === 0} aria-label={`Move ${task().title} back`} onClick={() => moveTask(task(), -1)}>&larr;</button><button disabled={!props.editable} onClick={() => setView("tasks")}>Edit</button><button disabled={!props.editable || columnIndex === workflowColumns().length - 1} aria-label={`Move ${task().title} forward`} onClick={() => moveTask(task(), 1)}>&rarr;</button><button disabled={!props.editable} title="Move to bottom" onClick={() => reorderTask(id, task().status, "bottom")}>Bottom</button></footer>
                </article>; }}</For><Show when={tasksForColumn(column.id).length > shownTasksForColumn(column.id).length}><button class="project-load-more" onClick={() => setKanbanLimits(current => ({ ...current, [column.id]: (current[column.id] ?? 40) + 40 }))}>Show next 40 ({tasksForColumn(column.id).length - shownTasksForColumn(column.id).length} remaining)</button></Show></div>
              </Show>
            </section>)}</div>
          </div>
        </Show>

        <Show when={view() === "timeline"}><ProjectTimeline data={{ ...props.data, workflowColumns: workflowColumns() }} planPath={props.planningPath} editable={props.editable} onAddMilestone={addMilestone} onUpdateMilestone={updateMilestone} onDeleteMilestone={deleteMilestone} onUpdateTask={updateTask} onChangeWorkingDays={setWorkingDays} onSetBaseline={captureBaseline} /></Show>
        <Show when={view() === "calendar"}><ProjectCalendar data={props.data} onOpenTasks={() => setView("tasks")} /></Show>
        <Show when={view() === "exchange"}>
          <div class="project-page project-exchange-page">
            <div class="project-page-heading"><div><span class="project-eyebrow">PLANNING DATA</span><h1>Import and export</h1><p>Exchange tasks and milestones with spreadsheets and calendar apps.</p></div></div>
            <input ref={exchangeInput} class="project-hidden-input" type="file" accept={exchangeFormat() === "csv" ? ".csv,text/csv" : ".ics,.ical,text/calendar"} onChange={importExchangeFile} />
            <div class="project-exchange-grid">
              <section><span class="project-eyebrow">CSV</span><h2>Spreadsheet</h2><p>Import or export tasks and milestones with dates, status, priority, estimates, dependencies, and recurrence.</p><div class="project-page-actions"><button onClick={exportCsv}>Export CSV</button><button class="project-primary-action" onClick={() => { setExchangeFormat("csv"); exchangeInput?.click(); }}>Import CSV</button></div></section>
              <section><span class="project-eyebrow">ICS CALENDAR</span><h2>Calendar events</h2><p>Tasks are exchanged as to-dos; milestones are calendar events. Recurring tasks keep their daily, weekly, or monthly rule.</p><div class="project-page-actions"><button onClick={exportCalendar}>Export calendar</button><button class="project-primary-action" onClick={() => { setExchangeFormat("ics"); exchangeInput?.click(); }}>Import calendar</button></div></section>
            </div>
            <Show when={exchangeMessage()}><p class="project-exchange-message" role="status">{exchangeMessage()}</p></Show>
          </div>
        </Show>
        <Show when={view() === "report"}>
          <div class="project-page project-report-page">
            <div class="project-page-heading project-report-actions"><div><span class="project-eyebrow">PROJECT REPORT</span><h1>{props.data.name}</h1><p>{props.data.description || "Project summary, task status, milestones, decisions, and risks."}</p></div><div class="project-page-actions"><button onClick={exportReport}>Export report</button><button class="project-primary-action" onClick={() => window.print()}>Print report</button></div></div>
            <Show when={exchangeMessage()}><p class="project-exchange-message" role="status">{exchangeMessage()}</p></Show>
            <section class="project-report-summary"><div><strong>{props.data.tasks.length}</strong><span>Tasks</span></div><div><strong>{props.data.tasks.filter(task => !isComplete(task)).length}</strong><span>Open</span></div><div><strong>{props.data.milestones.length}</strong><span>Milestones</span></div><div><strong>{props.data.logEntries.filter(entry => entry.kind === "decision").length}</strong><span>Decisions</span></div></section>
            <section class="project-report-section"><h2>Tasks</h2><div class="project-report-table-wrap"><table><thead><tr><th>Task</th><th>Status</th><th>Priority</th><th>Start</th><th>Due</th><th>Estimate</th></tr></thead><tbody><For each={props.data.tasks}>{task => <tr><td>{task.title || "Untitled task"}</td><td>{workflowColumns().find(column => column.id === task.status)?.label ?? task.status}</td><td>{TASK_PRIORITY_LABELS[task.priority]}</td><td>{formatProjectDate(task.startDate)}</td><td>{formatProjectDate(task.dueDate)}</td><td>{task.estimateMinutes === undefined ? "—" : `${(task.estimateMinutes / 60).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} h`}</td></tr>}</For></tbody></table><Show when={!props.data.tasks.length}><p>No tasks recorded.</p></Show></div></section>
            <section class="project-report-section"><h2>Milestones</h2><For each={props.data.milestones}>{item => <article><time>{formatProjectDate(item.date)}</time><strong>{item.title}</strong><span>{item.completed ? "Complete" : "Open"}</span><p>{item.description}</p></article>}</For><Show when={!props.data.milestones.length}><p>No milestones recorded.</p></Show></section>
            <section class="project-report-section"><h2>Decisions</h2><For each={props.data.logEntries.filter(entry => entry.kind === "decision")}>{entry => <article><strong>{entry.title}</strong><span>{entry.owner ? `Owner: ${entry.owner}` : "Decision"}</span><p>{entry.details}</p></article>}</For><Show when={!props.data.logEntries.some(entry => entry.kind === "decision")}><p>No decisions recorded.</p></Show></section>
            <section class="project-report-section"><h2>Questions and risks</h2><For each={props.data.logEntries.filter(entry => entry.kind !== "decision")}>{entry => <article><strong>{entry.title}</strong><span>{entry.kind} · {entry.resolved ? "Resolved" : "Open"}</span><p>{entry.details}</p></article>}</For><Show when={!props.data.logEntries.some(entry => entry.kind !== "decision")}><p>No open questions or risks recorded.</p></Show></section>
          </div>
        </Show>
        <Show when={view() === "log"}><ProjectLog entries={props.data.logEntries} editable={props.editable} onAdd={addLogEntry} onUpdate={updateLogEntry} onDelete={deleteLogEntry} /></Show>
        <Show when={view() === "files"}><ProjectFiles files={props.data.files} editable={props.editable} onAdd={addProjectFile} onUpdate={updateProjectFile} onDelete={deleteProjectFile} /></Show>
        <footer class="project-workspace-footer"><span>Planning data is stored separately in this .sdplan file.</span><span>{props.editable ? "Available offline" : "View only"}</span></footer>
      </main>
    </section>
  );
}
