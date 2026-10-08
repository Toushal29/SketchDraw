import { For, Show, createSignal } from "solid-js";
import type { ProjectFileEntry, ProjectLogEntry, ProjectMilestone, ProjectNote, ProjectTask, ProjectTaskStatus, ProjectWorkspaceData } from "../../model";
import { ProjectCalendar } from "./ProjectCalendar";
import { ProjectFiles } from "./ProjectFiles";
import { ProjectLog } from "./ProjectLog";
import { ProjectTimeline } from "./ProjectTimeline";
import { formatProjectDate, isProjectTaskOverdue, projectTaskWarnings, TASK_PRIORITY_LABELS } from "./project-utils";
import type { DocumentWorkspaceArea } from "../workspace/workspace-types";
import "./project-workspace.css";

export type ProjectWorkspaceView = "home" | "notes" | "tasks" | "kanban" | "timeline" | "calendar" | "log" | "files";
type Props = {
  data: ProjectWorkspaceData;
  editable: boolean;
  onChange: (data: ProjectWorkspaceData) => void;
  onNavigate: (area: DocumentWorkspaceArea) => void;
};

const TASK_COLUMNS: { value: ProjectTaskStatus; label: string }[] = [
  { value: "backlog", label: "To do" },
  { value: "inProgress", label: "In progress" },
  { value: "done", label: "Done" },
];
const VIEWS: { value: ProjectWorkspaceView; label: string }[] = [
  { value: "home", label: "Project Home" }, { value: "notes", label: "Notes" },
  { value: "tasks", label: "Tasks" }, { value: "kanban", label: "Kanban" },
  { value: "timeline", label: "Timeline" }, { value: "calendar", label: "Calendar" },
  { value: "log", label: "Decision log" }, { value: "files", label: "Files" },
];

export function ProjectWorkspace(props: Props) {
  const [view, setView] = createSignal<ProjectWorkspaceView>("home");
  const [selectedNoteId, setSelectedNoteId] = createSignal(props.data.notes[0]?.id ?? "");
  const [taskDraft, setTaskDraft] = createSignal("");
  const [draggedTaskId, setDraggedTaskId] = createSignal<string>();
  const [dragOverTaskId, setDragOverTaskId] = createSignal<string>();
  const [dragOverColumn, setDragOverColumn] = createSignal<ProjectTaskStatus>();
  let taskDragPointer: { id: string; pointerId: number; startX: number; startY: number; active: boolean } | undefined;
  const update = (patch: Partial<ProjectWorkspaceData>) => props.onChange({ ...props.data, ...patch });
  const selectedNote = () => props.data.notes.find(note => note.id === selectedNoteId()) ?? props.data.notes[0];
  const updateNote = (id: string, patch: Partial<ProjectNote>) => {
    const now = Date.now();
    update({ notes: props.data.notes.map(note => note.id === id ? { ...note, ...patch, updatedAt: now } : note) });
  };
  const updateTask = (id: string, patch: Partial<ProjectTask>) => {
    const now = Date.now();
    update({ tasks: props.data.tasks.map(task => task.id === id ? { ...task, ...patch, updatedAt: now } : task) });
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
    const task: ProjectTask = { id: crypto.randomUUID(), title: title.slice(0, 300), description: "", status: "backlog", priority: "medium", dependsOn: [], createdAt: now, updatedAt: now };
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
    const index = TASK_COLUMNS.findIndex(column => column.value === task.status);
    const next = TASK_COLUMNS[Math.max(0, Math.min(TASK_COLUMNS.length - 1, index + direction))];
    if (next && next.value !== task.status) reorderTask(task.id, next.value, "bottom");
  };
  const openView = (next: ProjectWorkspaceView) => setView(next);

  return (
    <section class="project-workspace-overlay" aria-label="Project workspace">
      <nav class="project-workspace-nav" aria-label="Project sections">
        <For each={VIEWS}>{item => <button class={view() === item.value ? "active" : ""} aria-current={view() === item.value ? "page" : undefined} onClick={() => openView(item.value)}>{item.label}{item.value === "tasks" && <span>{props.data.tasks.length}</span>}</button>}</For>
      </nav>

      <main class="project-workspace-content">
        <Show when={view() === "home"}>
          <div class="project-page project-home-page">
            <div class="project-page-heading"><div><span class="project-eyebrow">PROJECT HOME</span><h1>{props.data.name}</h1><p>Your project space for decisions, tasks, notes, dates, and the sketch.</p></div><div class="project-home-actions"><button disabled={!props.editable} onClick={createNote}>New note</button><button disabled={!props.editable} onClick={() => setView("tasks")}>Add task</button><button disabled={!props.editable} onClick={() => setView("files")}>Add project file</button></div></div>
            <section class="project-summary-card"><label><span>Project name</span><input disabled={!props.editable} maxlength="120" value={props.data.name} onInput={event => update({ name: event.currentTarget.value.slice(0, 120) })} /></label><label><span>What is this project about?</span><textarea disabled={!props.editable} maxlength="4000" rows="3" value={props.data.description} placeholder="Add a short project overview..." onInput={event => update({ description: event.currentTarget.value })} /></label></section>
            <div class="project-metrics" aria-label="Project summary">
              <button onClick={() => setView("notes")}><span class="project-metric-icon notes-icon">N</span><span><strong>{props.data.notes.length}</strong><small>Project notes</small></span></button>
              <button onClick={() => setView("tasks")}><span class="project-metric-icon tasks-icon">T</span><span><strong>{props.data.tasks.filter(task => task.status !== "done").length}</strong><small>Open tasks</small></span></button>
              <button onClick={() => setView("timeline")}><span class="project-metric-icon milestone-icon">M</span><span><strong>{props.data.milestones.length}</strong><small>Milestones</small></span></button>
              <button onClick={() => setView("log")}><span class="project-metric-icon risk-icon">!</span><span><strong>{props.data.logEntries.filter(entry => !entry.resolved).length}</strong><small>Open decisions &amp; risks</small></span></button>
            </div>
            <div class="project-home-columns">
              <section class="project-home-card"><header><div><span class="project-eyebrow">NEXT ACTIONS</span><h2>Tasks to watch</h2></div><button onClick={() => setView("kanban")}>Open board &rarr;</button></header>
                <Show when={props.data.tasks.some(task => task.status !== "done")} fallback={<div class="project-empty-inline"><span>No open tasks yet.</span><button disabled={!props.editable} onClick={() => setView("tasks")}>Create a task</button></div>}>
                  <div class="project-home-task-list"><For each={props.data.tasks.filter(task => task.status !== "done").slice(0, 5).map(task => task.id)}>{id => { const task = () => props.data.tasks.find(item => item.id === id)!; return <button class="project-home-task" onClick={() => setView("tasks")}><span class={`project-task-priority ${task().priority}`} /><span>{task().title || "Untitled task"}</span><small class={`project-task-due ${isProjectTaskOverdue(task()) ? "is-overdue" : ""}`}>{isProjectTaskOverdue(task()) ? "Overdue" : task().dueDate ? formatProjectDate(task().dueDate, { month: "short", day: "numeric" }) : TASK_PRIORITY_LABELS[task().priority]}</small></button>; }}</For></div>
                </Show>
              </section>
              <section class="project-home-card"><header><div><span class="project-eyebrow">IDEAS &amp; DETAILS</span><h2>Recent notes</h2></div><button onClick={() => setView("notes")}>All notes &rarr;</button></header>
                <Show when={props.data.notes.length} fallback={<div class="project-empty-inline"><span>Keep decisions and context alongside the sketch.</span><button disabled={!props.editable} onClick={createNote}>Create a note</button></div>}>
                  <div class="project-home-note-list"><For each={props.data.notes.slice(0, 3).map(note => note.id)}>{id => { const note = () => props.data.notes.find(item => item.id === id)!; return <button onClick={() => { setSelectedNoteId(id); setView("notes"); }}><strong>{note().title || "Untitled note"}</strong><span>{note().content || "No note text yet"}</span></button>; }}</For></div>
                </Show>
              </section>
            </div>
            <nav class="project-home-shortcuts" aria-label="Project tools">
              <button onClick={() => setView("timeline")}><strong>Timeline</strong><span>{props.data.milestones.length} milestones</span></button>
              <button onClick={() => setView("calendar")}><strong>Calendar</strong><span>Deadlines &amp; dates</span></button>
              <button onClick={() => setView("log")}><strong>Decisions &amp; risks</strong><span>{props.data.logEntries.length} records</span></button>
              <button onClick={() => setView("files")}><strong>Project files</strong><span>{props.data.files.length} items</span></button>
            </nav>
            <button class="project-open-canvas-card" onClick={() => props.onNavigate("canvas")}><span><strong>Open the sketch canvas</strong><small>Continue drawing in this document</small></span><span aria-hidden="true">&rarr;</span></button>
          </div>
        </Show>

        <Show when={view() === "notes"}>
          <div class="project-page project-notes-page">
            <div class="project-page-heading"><div><span class="project-eyebrow">PROJECT NOTES</span><h1>Notes</h1><p>Keep decisions, context, and ideas with this project.</p></div><button disabled={!props.editable} class="project-primary-action" onClick={createNote}>New note</button></div>
            <div class="project-notes-layout">
              <aside class="project-notes-list" aria-label="Notes list"><Show when={props.data.notes.length} fallback={<div class="project-empty-state"><strong>No notes yet</strong><p>Create a note to keep project context here.</p><button disabled={!props.editable} onClick={createNote}>Create a note</button></div>}>
                <For each={props.data.notes.map(note => note.id)}>{id => { const note = () => props.data.notes.find(item => item.id === id)!; return <button class={selectedNote()?.id === id ? "active" : ""} onClick={() => setSelectedNoteId(id)}><strong>{note().title || "Untitled note"}</strong><span>{note().content.split("\n").find(line => line.trim()) || "No text yet"}</span><small>{new Date(note().updatedAt).toLocaleDateString()}</small></button>; }}</For>
              </Show></aside>
              <Show when={selectedNote()} fallback={<div class="project-note-editor project-empty-state"><strong>Select a note</strong><p>Choose a note or create one to get started.</p></div>}>
                <article class="project-note-editor"><div class="project-note-editor-heading"><span>NOTE</span><button disabled={!props.editable} aria-label="Delete note" title="Delete note" onClick={() => { const note = selectedNote(); if (note) deleteNote(note.id); }}>Delete</button></div><input class="project-note-title" disabled={!props.editable} maxlength="200" value={selectedNote()?.title ?? ""} aria-label="Note title" onInput={event => { const note = selectedNote(); if (note) updateNote(note.id, { title: event.currentTarget.value }); }} /><textarea disabled={!props.editable} maxlength="100000" value={selectedNote()?.content ?? ""} placeholder="Write a note..." aria-label="Note content" onInput={event => { const note = selectedNote(); if (note) updateNote(note.id, { content: event.currentTarget.value }); }} /><small>Saved inside this .sketch project</small></article>
              </Show>
            </div>
          </div>
        </Show>

        <Show when={view() === "tasks"}>
          <div class="project-page project-tasks-page">
            <div class="project-page-heading"><div><span class="project-eyebrow">PROJECT TASKS</span><h1>Tasks</h1><p>Set priority, dates, and dependencies for each next step.</p></div><button onClick={() => setView("timeline")}>View timeline &rarr;</button></div>
            <form class="project-add-task" onSubmit={createTask}><input value={taskDraft()} disabled={!props.editable} maxlength="300" placeholder="Add a task..." aria-label="New task title" onInput={event => setTaskDraft(event.currentTarget.value)} /><button disabled={!props.editable || !taskDraft().trim()}>Add task</button></form>
            <section class="project-task-list" aria-label="Project task list"><Show when={props.data.tasks.length} fallback={<div class="project-empty-state"><strong>No tasks yet</strong><p>Add one above to start a lightweight project plan.</p></div>}>
              <For each={props.data.tasks.map(task => task.id)}>{id => { const task = () => props.data.tasks.find(item => item.id === id)!; const warnings = () => projectTaskWarnings(task(), props.data.tasks); return <article class={`project-task-row ${task().status === "done" ? "is-done" : ""}`}>
                <button class="project-task-check" disabled={!props.editable} aria-label={task().status === "done" ? `Mark ${task().title} as to do` : `Complete ${task().title}`} onClick={() => updateTask(id, { status: task().status === "done" ? "backlog" : "done" })}>{task().status === "done" ? "\u2713" : ""}</button>
                <div class="project-task-main"><input disabled={!props.editable} value={task().title} maxlength="300" aria-label="Task title" onInput={event => updateTask(id, { title: event.currentTarget.value })} /><Show when={props.editable} fallback={<p>{task().description}</p>}><textarea value={task().description} maxlength="20000" placeholder="Add details" aria-label={`Details for ${task().title}`} onInput={event => updateTask(id, { description: event.currentTarget.value })} /></Show><Show when={warnings().length}><span class="project-task-warning" title={warnings().join("; ")}>{warnings()[0]}</span></Show></div>
                <label class="project-task-field"><span>Status</span><select disabled={!props.editable} value={task().status} onChange={event => updateTask(id, { status: event.currentTarget.value as ProjectTaskStatus })}>{TASK_COLUMNS.map(column => <option value={column.value}>{column.label}</option>)}</select></label>
                <label class={`project-task-field project-priority-field priority-${task().priority}`}><span>Priority</span><select disabled={!props.editable} value={task().priority} onChange={event => updateTask(id, { priority: event.currentTarget.value as ProjectTask["priority"] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
                <label class="project-task-field"><span>Start</span><input type="date" disabled={!props.editable} value={task().startDate ?? ""} onInput={event => updateTask(id, { startDate: event.currentTarget.value || undefined })} /></label>
                <label class="project-task-field project-due-date"><span>Due</span><input type="date" disabled={!props.editable} value={task().dueDate ?? ""} onInput={event => updateTask(id, { dueDate: event.currentTarget.value || undefined })} /><Show when={isProjectTaskOverdue(task())}><small class="project-overdue-label">Overdue</small></Show></label>
                <details class="project-dependency-picker"><summary>Dependencies ({(task().dependsOn ?? []).length})</summary><Show when={props.data.tasks.some(item => item.id !== id)} fallback={<small>Add another task first.</small>}><div>{props.data.tasks.filter(item => item.id !== id).map(dependency => <label><input type="checkbox" disabled={!props.editable} checked={(task().dependsOn ?? []).includes(dependency.id)} onChange={event => updateTask(id, { dependsOn: event.currentTarget.checked ? [...new Set([...(task().dependsOn ?? []), dependency.id])] : (task().dependsOn ?? []).filter(item => item !== dependency.id) })} /><span>{dependency.title || "Untitled task"}</span></label>)}</div></Show></details>
                <div class="project-task-row-actions"><button disabled={!props.editable} title="Move task to the top" onClick={() => reorderTask(id, task().status, "top")}>Top</button><button disabled={!props.editable} title="Move task to the bottom" onClick={() => reorderTask(id, task().status, "bottom")}>Bottom</button><button class="project-task-delete" disabled={!props.editable} aria-label={`Delete ${task().title}`} title="Delete task" onClick={() => deleteTask(id)}>&times;</button></div>
              </article>; }}</For>
            </Show></section>
          </div>
        </Show>

        <Show when={view() === "kanban"}>
          <div class="project-page project-kanban-page">
            <div class="project-page-heading"><div><span class="project-eyebrow">PROJECT BOARD</span><h1>Kanban</h1><p>Drag tasks between stages or move a card to the top or bottom of its column.</p></div><button onClick={() => setView("tasks")}>Task details &rarr;</button></div>
            <form class="project-add-task" onSubmit={createTask}><input value={taskDraft()} disabled={!props.editable} maxlength="300" placeholder="Add a task to To do..." aria-label="New task title" onInput={event => setTaskDraft(event.currentTarget.value)} /><button disabled={!props.editable || !taskDraft().trim()}>Add task</button></form>
            <div class="project-kanban-columns">{TASK_COLUMNS.map((column, columnIndex) => <section class={`project-kanban-column column-${column.value} ${dragOverColumn() === column.value ? "is-drop-target" : ""}`} data-status={column.value} aria-label={column.label} onDragOver={event => { event.preventDefault(); setDragOverColumn(column.value); }} onDragLeave={() => setDragOverColumn(undefined)} onDrop={event => dropOnColumn(event, column.value)}>
              <header><span><i />{column.label}</span><small>{props.data.tasks.filter(task => task.status === column.value).length}</small></header>
              <Show when={props.data.tasks.some(task => task.status === column.value)} fallback={<div class={`project-kanban-empty ${draggedTaskId() ? "is-drop-target" : ""}`}>Drop a task here</div>}>
                <div class="project-kanban-cards"><For each={props.data.tasks.filter(task => task.status === column.value).map(task => task.id)}>{id => { const task = () => props.data.tasks.find(item => item.id === id)!; const warnings = () => projectTaskWarnings(task(), props.data.tasks); return <article data-task-id={id} class={`project-kanban-card priority-${task().priority} ${task().status === "done" ? "is-done" : ""} ${draggedTaskId() === id ? "is-dragging" : ""} ${dragOverTaskId() === id ? "is-drop-target" : ""}`} draggable={props.editable} onDragStart={event => { setDraggedTaskId(id); event.dataTransfer?.setData("text/plain", id); if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"; }} onDragEnd={clearTaskDrag} onDragOver={event => { event.preventDefault(); setDragOverTaskId(id); setDragOverColumn(task().status); }} onDragLeave={() => setDragOverTaskId(undefined)} onDrop={event => { event.preventDefault(); event.stopPropagation(); const source = event.dataTransfer?.getData("text/plain") || draggedTaskId(); const rect = event.currentTarget.getBoundingClientRect(); const edge = event.clientY < rect.top + rect.height / 2 ? "before" : "after"; if (source && source !== id) reorderTask(source, task().status, edge, id); clearTaskDrag(); }}>
                  <div class="project-kanban-card-meta"><span class={`project-priority-badge priority-${task().priority}`}><i />{TASK_PRIORITY_LABELS[task().priority]}</span><Show when={task().dueDate}><time class={isProjectTaskOverdue(task()) ? "is-overdue" : ""}>{isProjectTaskOverdue(task()) ? "Overdue" : formatProjectDate(task().dueDate, { month: "short", day: "numeric" })}</time></Show><button class="project-kanban-drag-handle" type="button" aria-label={`Drag ${task().title || "untitled task"}`} title="Drag to reorder or change stage" onPointerDown={event => beginTaskDrag(event, id)} onPointerMove={updateTaskDrag} onPointerUp={finishTaskDrag} onPointerCancel={clearTaskDrag}><svg viewBox="0 0 12 16" aria-hidden="true"><circle cx="3" cy="3" r="1"/><circle cx="9" cy="3" r="1"/><circle cx="3" cy="8" r="1"/><circle cx="9" cy="8" r="1"/><circle cx="3" cy="13" r="1"/><circle cx="9" cy="13" r="1"/></svg></button></div>
                  <strong>{task().title || "Untitled task"}</strong><Show when={task().description}><p>{task().description}</p></Show>
                  <Show when={warnings().length}><span class="project-kanban-warning" title={warnings().join("; ")}>Schedule conflict</span></Show>
                  <Show when={(task().dependsOn ?? []).length}><small class="project-dependency-count">Depends on {(task().dependsOn ?? []).length} task(s)</small></Show>
                  <footer><button disabled={!props.editable} title="Move to top" onClick={() => reorderTask(id, task().status, "top")}>Top</button><button disabled={!props.editable || columnIndex === 0} aria-label={`Move ${task().title} back`} onClick={() => moveTask(task(), -1)}>&larr;</button><button disabled={!props.editable} onClick={() => setView("tasks")}>Edit</button><button disabled={!props.editable || columnIndex === TASK_COLUMNS.length - 1} aria-label={`Move ${task().title} forward`} onClick={() => moveTask(task(), 1)}>&rarr;</button><button disabled={!props.editable} title="Move to bottom" onClick={() => reorderTask(id, task().status, "bottom")}>Bottom</button></footer>
                </article>; }}</For></div>
              </Show>
            </section>)}</div>
          </div>
        </Show>

        <Show when={view() === "timeline"}><ProjectTimeline data={props.data} editable={props.editable} onAddMilestone={addMilestone} onUpdateMilestone={updateMilestone} onDeleteMilestone={deleteMilestone} /></Show>
        <Show when={view() === "calendar"}><ProjectCalendar data={props.data} onOpenTasks={() => setView("tasks")} /></Show>
        <Show when={view() === "log"}><ProjectLog entries={props.data.logEntries} editable={props.editable} onAdd={addLogEntry} onUpdate={updateLogEntry} onDelete={deleteLogEntry} /></Show>
        <Show when={view() === "files"}><ProjectFiles files={props.data.files} editable={props.editable} onAdd={addProjectFile} onUpdate={updateProjectFile} onDelete={deleteProjectFile} /></Show>
        <footer class="project-workspace-footer"><span>Planning data is stored in this document.</span><span>{props.editable ? "Available offline" : "View only"}</span></footer>
      </main>
    </section>
  );
}
