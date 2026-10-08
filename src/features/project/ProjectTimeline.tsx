import { For, Show, createSignal } from "solid-js";
import type { ProjectMilestone, ProjectTask, ProjectWorkspaceData } from "../../model";
import { formatProjectDate, parseProjectDate, projectTaskWarnings, todayProjectDate } from "./project-utils";

type Props = {
  data: ProjectWorkspaceData;
  editable: boolean;
  onAddMilestone: (title: string, date: string) => void;
  onUpdateMilestone: (id: string, patch: Partial<ProjectMilestone>) => void;
  onDeleteMilestone: (id: string) => void;
};

export function ProjectTimeline(props: Props) {
  const [title, setTitle] = createSignal("");
  const [date, setDate] = createSignal("");
  const today = todayProjectDate();
  const datedValues = () => [
    ...props.data.tasks.flatMap(task => [task.startDate, task.dueDate].filter((value): value is string => !!value)),
    ...props.data.milestones.map(milestone => milestone.date),
  ].filter(value => parseProjectDate(value) !== undefined).sort();
  const startValue = () => datedValues()[0] ?? today;
  const endValue = () => { const values = datedValues(); return values[values.length - 1] ?? today; };
  const startTime = () => parseProjectDate(startValue()) ?? Date.now();
  const dayCount = () => Math.max(30, Math.floor(((parseProjectDate(endValue()) ?? startTime()) - startTime()) / 86_400_000) + 1);
  const position = (value?: string) => {
    const time = parseProjectDate(value) ?? startTime();
    return Math.max(0, Math.min(100, ((time - startTime()) / (dayCount() * 86_400_000)) * 100));
  };
  const width = (task: ProjectTask) => {
    const from = parseProjectDate(task.startDate ?? task.dueDate);
    const to = parseProjectDate(task.dueDate ?? task.startDate);
    if (from === undefined || to === undefined) return "0%";
    return `${Math.max(1.2, Math.min(100 - position(task.startDate ?? task.dueDate), ((to - from + 86_400_000) / (dayCount() * 86_400_000)) * 100))}%`;
  };
  const ticks = () => Array.from({ length: Math.min(14, Math.ceil(dayCount() / 7) + 1) }, (_, index) => {
    const value = new Date(startTime() + index * 7 * 86_400_000);
    return { label: value.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }), position: Math.min(100, (index * 7 / dayCount()) * 100) };
  });
  const addMilestone = (event: SubmitEvent) => {
    event.preventDefault();
    if (!props.editable || !title().trim() || !date()) return;
    props.onAddMilestone(title().trim(), date());
    setTitle("");
  };

  return (
    <div class="project-page project-timeline-page">
      <div class="project-page-heading"><div><span class="project-eyebrow">PROJECT ROADMAP</span><h1>Timeline</h1><p>See task ranges, milestones, and date conflicts together.</p></div></div>
      <Show when={props.editable}>
        <form class="project-milestone-form" onSubmit={addMilestone}>
          <input value={title()} maxlength="300" placeholder="Milestone name" aria-label="Milestone name" onInput={event => setTitle(event.currentTarget.value)} />
          <input type="date" value={date()} aria-label="Milestone date" onInput={event => setDate(event.currentTarget.value)} />
          <button disabled={!title().trim() || !date()}>Add milestone</button>
        </form>
      </Show>
      <section class="project-timeline" aria-label="Project timeline">
        <div class="project-timeline-heading"><strong>Work item</strong><div class="project-timeline-scale"><span>{formatProjectDate(startValue(), { month: "short", day: "numeric" })}</span><span>{formatProjectDate(endValue(), { month: "short", day: "numeric" })}</span></div></div>
        <div class="project-timeline-ticks" aria-hidden="true"><For each={ticks()}>{tick => <span style={`left:${tick.position}%`}>{tick.label}</span>}</For></div>
        <Show when={props.data.tasks.length || props.data.milestones.length} fallback={<div class="project-empty-state"><strong>No dates on this roadmap yet</strong><p>Add task start and due dates, or add a milestone above.</p></div>}>
          <For each={props.data.tasks.map(task => task.id)}>{id => {
            const task = () => props.data.tasks.find(item => item.id === id)!;
            const warnings = () => projectTaskWarnings(task(), props.data.tasks);
            const dependencies = () => (task().dependsOn ?? []).map(dependencyId => props.data.tasks.find(item => item.id === dependencyId)?.title || "Untitled task");
            return <div class={`project-timeline-row ${task().status === "done" ? "is-done" : ""}`}>
              <div class="project-timeline-label"><strong>{task().title || "Untitled task"}</strong><small>{formatProjectDate(task().startDate, { month: "short", day: "numeric" })} - {formatProjectDate(task().dueDate, { month: "short", day: "numeric" })}</small><Show when={dependencies().length}><small class="project-timeline-dependencies">Depends on: {dependencies().join(", ")}</small></Show><Show when={warnings().length}><span class="project-conflict-badge" title={warnings().join("; ")}>Schedule conflict</span></Show></div>
              <div class="project-timeline-track"><For each={ticks()}>{tick => <i style={`left:${tick.position}%`} />}</For><Show when={task().startDate || task().dueDate}><div class={`project-timeline-bar priority-${task().priority}`} title={`${task().title}: ${formatProjectDate(task().startDate)} - ${formatProjectDate(task().dueDate)}`} style={`left:${position(task().startDate ?? task().dueDate)}%;width:${width(task())}`} /></Show></div>
            </div>;
          }}</For>
          <For each={[...props.data.milestones].sort((left, right) => left.date.localeCompare(right.date))}>{milestone => <article class={`project-milestone-row ${milestone.completed ? "is-complete" : ""}`}>
            <div class="project-timeline-label"><strong>{milestone.title}</strong><small>Milestone - {formatProjectDate(milestone.date)}</small></div>
            <div class="project-timeline-track"><For each={ticks()}>{tick => <i style={`left:${tick.position}%`} />}</For><span class="project-milestone-marker" style={`left:${position(milestone.date)}%`} title={milestone.title} /></div>
            <label class="project-milestone-done"><input type="checkbox" disabled={!props.editable} checked={milestone.completed} onChange={event => props.onUpdateMilestone(milestone.id, { completed: event.currentTarget.checked })} />Complete</label>
            <Show when={props.editable}><button class="project-row-delete" aria-label={`Delete milestone ${milestone.title}`} onClick={() => props.onDeleteMilestone(milestone.id)}>Remove</button></Show>
          </article>}</For>
        </Show>
      </section>
      <Show when={props.data.tasks.some(task => !task.startDate && !task.dueDate)}>
        <p class="project-timeline-unscheduled">{props.data.tasks.filter(task => !task.startDate && !task.dueDate).length} task(s) have no dates yet.</p>
      </Show>
    </div>
  );
}
