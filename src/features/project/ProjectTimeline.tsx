import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import type { ProjectMilestone, ProjectTask, ProjectWorkspaceData } from "../../model";
import { addWorkingDays, criticalPathTaskIds, formatProjectDate, parseProjectDate, projectTaskWarnings, todayProjectDate } from "./project-utils";

type Props = {
  data: ProjectWorkspaceData;
  planPath?: string;
  editable: boolean;
  onAddMilestone: (title: string, date: string) => void;
  onUpdateMilestone: (id: string, patch: Partial<ProjectMilestone>) => void;
  onDeleteMilestone: (id: string) => void;
  onUpdateTask: (id: string, patch: Partial<ProjectTask>) => void;
  onChangeWorkingDays: (day: number, enabled: boolean) => void;
  onSetBaseline: () => void;
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type TimelineDrag = { id: string; pointerId: number; mode: "move" | "start" | "end"; startX: number; trackWidth: number; initialStart: string; initialEnd: string; active: boolean };

export function ProjectTimeline(props: Props) {
  const [title, setTitle] = createSignal("");
  const [date, setDate] = createSignal("");
  const [showBaseline, setShowBaseline] = createSignal(true);
  const [timelineDrag, setTimelineDrag] = createSignal<TimelineDrag>();
  const [timelineTaskLimit, setTimelineTaskLimit] = createSignal(100);
  let previousPlanPath = props.planPath;
  createEffect(() => {
    const path = props.planPath;
    if (path === previousPlanPath) return;
    previousPlanPath = path;
    setTimelineTaskLimit(100);
  });
  const today = todayProjectDate();
  const workingDays = createMemo(() => props.data.workingDays?.length ? props.data.workingDays : [1, 2, 3, 4, 5]);
  const datedValues = createMemo(() => [
    ...props.data.tasks.flatMap(task => [task.startDate, task.dueDate, task.baselineStartDate, task.baselineDueDate].filter((value): value is string => !!value)),
    ...props.data.milestones.map(milestone => milestone.date),
  ].filter(value => parseProjectDate(value) !== undefined).sort());
  const startValue = createMemo(() => datedValues()[0] ?? today);
  const endValue = createMemo(() => { const values = datedValues(); return values[values.length - 1] ?? today; });
  const startTime = createMemo(() => parseProjectDate(startValue()) ?? Date.now());
  const dayCount = createMemo(() => Math.max(30, Math.floor(((parseProjectDate(endValue()) ?? startTime()) - startTime()) / 86_400_000) + 1));
  const position = (value?: string) => {
    const time = parseProjectDate(value) ?? startTime();
    return Math.max(0, Math.min(100, ((time - startTime()) / (dayCount() * 86_400_000)) * 100));
  };
  const width = (from?: string, to?: string) => {
    const first = parseProjectDate(from);
    const last = parseProjectDate(to);
    if (first === undefined || last === undefined) return "0%";
    return `${Math.max(1.1, Math.min(100 - position(from), ((last - first + 86_400_000) / (dayCount() * 86_400_000)) * 100))}%`;
  };
  const ticks = createMemo(() => Array.from({ length: Math.min(28, Math.ceil(dayCount() / 7) + 1) }, (_, index) => {
    const value = new Date(startTime() + index * 7 * 86_400_000);
    return { label: value.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }), position: Math.min(100, (index * 7 / dayCount()) * 100) };
  }));
  const tasks = () => props.data.tasks;
  const timelineTasks = createMemo(() => tasks().slice(0, timelineTaskLimit()));
  const tasksById = createMemo(() => new Map<string, ProjectTask>(tasks().map(task => [task.id, task] as const)));
  const critical = createMemo(() => criticalPathTaskIds(tasks(), workingDays()));
  const dependencyLines = createMemo(() => {
    const taskList = timelineTasks();
    const indices = new Map<string, number>(taskList.map((task, index) => [task.id, index] as const));
    const lines: { key: string; d: string }[] = [];
    for (let index = 0; index < taskList.length && lines.length < 3000; index++) {
      const task = taskList[index];
      for (const dependencyId of task.dependsOn ?? []) {
        const dependencyIndex = indices.get(dependencyId);
        const dependency = dependencyIndex === undefined ? undefined : taskList[dependencyIndex];
        if (dependencyIndex === undefined || !dependency || dependencyIndex === index || !(dependency.startDate || dependency.dueDate) || !(task.startDate || task.dueDate)) continue;
        const x1 = position(dependency.dueDate ?? dependency.startDate);
        const x2 = position(task.startDate ?? task.dueDate);
        const y1 = dependencyIndex * 64 + 32;
        const y2 = index * 64 + 32;
        const mid = (x1 + x2) / 2;
        lines.push({ key: `${dependencyId}-${task.id}`, d: `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}` });
        if (lines.length >= 3000) break;
      }
    }
    return lines;
  });
  const beginDrag = (event: PointerEvent, task: ProjectTask, mode: TimelineDrag["mode"]) => {
    if (!props.editable || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const track = (event.currentTarget as HTMLElement).closest<HTMLElement>(".project-timeline-track");
    if (!track) return;
    const start = task.startDate ?? task.dueDate;
    const end = task.dueDate ?? task.startDate;
    if (!start || !end) return;
    try { (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); } catch { /* Pointer capture can be missing on older WebViews. */ }
    setTimelineDrag({ id: task.id, pointerId: event.pointerId, mode, startX: event.clientX, trackWidth: Math.max(1, track.getBoundingClientRect().width), initialStart: start, initialEnd: end, active: false });
  };
  const moveDrag = (event: PointerEvent) => {
    const drag = timelineDrag();
    if (drag && drag.pointerId === event.pointerId && Math.abs(event.clientX - drag.startX) > 3) { drag.active = true; setTimelineDrag({ ...drag }); }
  };
  const finishDrag = (event: PointerEvent) => {
    const drag = timelineDrag();
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.active) {
      const movement = Math.round((event.clientX - drag.startX) / drag.trackWidth * dayCount());
      const movedDays = movement < 0 ? -Math.max(0, Math.round(Math.abs(movement) * workingDays().length / 7)) : Math.max(0, Math.round(movement * workingDays().length / 7));
      const nextStart = drag.mode === "end" ? drag.initialStart : addWorkingDays(drag.initialStart, movedDays, workingDays());
      const nextEnd = drag.mode === "start" ? drag.initialEnd : addWorkingDays(drag.initialEnd, movedDays, workingDays());
      if (drag.mode === "start") props.onUpdateTask(drag.id, { startDate: nextStart <= drag.initialEnd ? nextStart : drag.initialEnd });
      else if (drag.mode === "end") props.onUpdateTask(drag.id, { dueDate: nextEnd >= drag.initialStart ? nextEnd : drag.initialStart });
      else props.onUpdateTask(drag.id, { startDate: nextStart, dueDate: nextEnd });
    }
    try { (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId); } catch { /* The pointer may already have ended. */ }
    setTimelineDrag(undefined);
  };
  const cancelDrag = (event: PointerEvent) => { if (timelineDrag()?.pointerId === event.pointerId) setTimelineDrag(undefined); };
  const addMilestone = (event: SubmitEvent) => {
    event.preventDefault();
    if (!props.editable || !title().trim() || !date()) return;
    props.onAddMilestone(title().trim(), date());
    setTitle("");
  };
  const baselineCount = () => props.data.tasks.filter(task => task.baselineStartDate || task.baselineDueDate).length;

  return (
    <div class="project-page project-timeline-page">
      <div class="project-page-heading"><div><span class="project-eyebrow">PROJECT ROADMAP</span><h1>Timeline</h1><p>Drag task bars to shift dates. Dependencies and critical tasks are shown on the schedule.</p></div><div class="project-page-actions"><button disabled={!props.editable || !props.data.tasks.length} onClick={props.onSetBaseline}>{baselineCount() ? "Update baseline" : "Set baseline"}</button><button class={showBaseline() ? "is-selected" : ""} disabled={!baselineCount()} onClick={() => setShowBaseline(value => !value)}>{showBaseline() ? "Hide baseline" : "Compare baseline"}</button></div></div>
      <div class="project-schedule-settings"><strong>Working days</strong><For each={weekdayLabels}>{(label, index) => <label><input type="checkbox" checked={workingDays().includes(index())} disabled={!props.editable || workingDays().length === 1 && workingDays().includes(index())} onChange={event => props.onChangeWorkingDays(index(), event.currentTarget.checked)} />{label}</label>}</For><span>Used for timeline dragging and critical-path estimates.</span></div>
      <Show when={props.editable}>
        <form class="project-milestone-form" onSubmit={addMilestone}><input value={title()} maxlength="300" placeholder="Milestone name" aria-label="Milestone name" onInput={event => setTitle(event.currentTarget.value)} /><input type="date" value={date()} aria-label="Milestone date" onInput={event => setDate(event.currentTarget.value)} /><button disabled={!title().trim() || !date()}>Add milestone</button></form>
      </Show>
      <section class="project-timeline" aria-label="Project timeline">
        <div class="project-timeline-heading"><strong>Work item</strong><div class="project-timeline-scale"><span>{formatProjectDate(startValue(), { month: "short", day: "numeric" })}</span><span>{formatProjectDate(endValue(), { month: "short", day: "numeric" })}</span></div></div>
        <div class="project-timeline-ticks" aria-hidden="true"><For each={ticks()}>{tick => <span style={`left:${tick.position}%`}>{tick.label}</span>}</For></div>
        <Show when={props.data.tasks.length || props.data.milestones.length} fallback={<div class="project-empty-state"><strong>No dates on this roadmap yet</strong><p>Add task dates or create a milestone to begin.</p></div>}>
          <div class="project-timeline-rows">
            <svg class="project-dependency-lines" viewBox={`0 0 100 ${Math.max(64, timelineTasks().length * 64)}`} preserveAspectRatio="none" aria-label="Task dependency links"><defs><marker id="project-dependency-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0L5 2.5L0 5z" /></marker></defs><For each={dependencyLines()}>{line => <path d={line.d} marker-end="url(#project-dependency-arrow)" />}</For></svg>
            <For each={timelineTasks().map(task => task.id)}>{id => {
              const task = () => tasksById().get(id)!;
              const warnings = () => projectTaskWarnings(task(), tasks());
              const baselineStart = () => task().baselineStartDate ?? task().baselineDueDate;
              const baselineEnd = () => task().baselineDueDate ?? task().baselineStartDate;
              return <div class={`project-timeline-row ${props.data.workflowColumns?.find(column => column.id === task().status)?.completed ? "is-done" : ""} ${critical().has(id) ? "is-critical" : ""}`}>
                <div class="project-timeline-label"><strong>{task().title || "Untitled task"}</strong><small>{formatProjectDate(task().startDate, { month: "short", day: "numeric" })} – {formatProjectDate(task().dueDate, { month: "short", day: "numeric" })}{task().estimateMinutes !== undefined ? ` · ${((task().estimateMinutes ?? 0) / 60).toFixed(1)} h` : ""}</small><Show when={warnings().length}><span class="project-conflict-badge" title={warnings().join("; ")}>Schedule conflict</span></Show><Show when={critical().has(id)}><span class="project-critical-badge">Critical path</span></Show></div>
                <div class="project-timeline-track"><For each={ticks()}>{tick => <i style={`left:${tick.position}%`} />}</For><Show when={showBaseline() && baselineStart()}><div class="project-timeline-baseline" title="Baseline schedule" style={`left:${position(baselineStart())}%;width:${width(baselineStart(), baselineEnd())}`} /></Show><Show when={task().startDate || task().dueDate}><div class={`project-timeline-bar priority-${task().priority} ${timelineDrag()?.id === id ? "is-dragging" : ""}`} role={props.editable ? "group" : undefined} tabIndex={props.editable ? 0 : undefined} aria-label={`Schedule for ${task().title}`} title={`${task().title}: drag to change dates`} style={`left:${position(task().startDate ?? task().dueDate)}%;width:${width(task().startDate ?? task().dueDate, task().dueDate ?? task().startDate)}`} onKeyDown={event => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; const start = task().startDate ?? task().dueDate; const end = task().dueDate ?? task().startDate; if (!start || !end) return; event.preventDefault(); const offset = event.key === "ArrowLeft" ? -1 : 1; props.onUpdateTask(id, { startDate: addWorkingDays(start, offset, workingDays()), dueDate: addWorkingDays(end, offset, workingDays()) }); }} onPointerDown={event => beginDrag(event, task(), "move")} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={cancelDrag}><Show when={props.editable}><button type="button" class="project-timeline-resize start" aria-label={`Change start date for ${task().title}`} onPointerDown={event => beginDrag(event, task(), "start")} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={cancelDrag} /><button type="button" class="project-timeline-resize end" aria-label={`Change due date for ${task().title}`} onPointerDown={event => beginDrag(event, task(), "end")} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={cancelDrag} /></Show></div></Show></div>
              </div>;
            }}</For>
          </div>
          <Show when={tasks().length > timelineTasks().length}><button class="project-load-more" onClick={() => setTimelineTaskLimit(limit => limit + 100)}>Show next 100 timeline tasks ({tasks().length - timelineTasks().length} remaining)</button></Show>
          <For each={[...props.data.milestones].sort((left, right) => left.date.localeCompare(right.date))}>{milestone => <article class={`project-milestone-row ${milestone.completed ? "is-complete" : ""}`}>
            <div class="project-timeline-label"><strong>{milestone.title}</strong><small>Milestone · {formatProjectDate(milestone.date)}</small></div>
            <div class="project-timeline-track"><For each={ticks()}>{tick => <i style={`left:${tick.position}%`} />}</For><span class="project-milestone-marker" style={`left:${position(milestone.date)}%`} title={milestone.title} /></div>
            <label class="project-milestone-done"><input type="checkbox" disabled={!props.editable} checked={milestone.completed} onChange={event => props.onUpdateMilestone(milestone.id, { completed: event.currentTarget.checked })} />Complete</label>
            <Show when={props.editable}><button class="project-row-delete" aria-label={`Delete milestone ${milestone.title}`} onClick={() => props.onDeleteMilestone(milestone.id)}>Remove</button></Show>
          </article>}</For>
        </Show>
      </section>
      <Show when={props.data.tasks.some(task => !task.startDate && !task.dueDate)}><p class="project-timeline-unscheduled">{props.data.tasks.filter(task => !task.startDate && !task.dueDate).length} tasks have no dates.</p></Show>
    </div>
  );
}
