import { For, Show, createSignal } from "solid-js";
import type { ProjectWorkspaceData } from "../../model";
import { dateValue, formatProjectDate, parseProjectDate, todayProjectDate } from "./project-utils";

type Mode = "month" | "week" | "day";
type Props = { data: ProjectWorkspaceData; onOpenTasks: () => void };

function shiftDays(value: string, amount: number) {
  const time = parseProjectDate(value) ?? Date.now();
  return dateValue(new Date(time + amount * 86_400_000));
}

export function ProjectCalendar(props: Props) {
  const [mode, setMode] = createSignal<Mode>("month");
  const [selectedDate, setSelectedDate] = createSignal(todayProjectDate());
  const monthLabel = () => formatProjectDate(`${selectedDate().slice(0, 7)}-01`, { month: "long", year: "numeric" });
  const visibleDates = () => {
    const time = parseProjectDate(selectedDate()) ?? Date.now();
    if (mode() === "day") return [selectedDate()];
    if (mode() === "week") {
      const offset = new Date(time).getUTCDay();
      const start = shiftDays(selectedDate(), -offset);
      return Array.from({ length: 7 }, (_, index) => shiftDays(start, index));
    }
    const first = new Date(Date.UTC(new Date(time).getUTCFullYear(), new Date(time).getUTCMonth(), 1));
    const start = dateValue(new Date(first.getTime() - first.getUTCDay() * 86_400_000));
    return Array.from({ length: 42 }, (_, index) => shiftDays(start, index));
  };
  const changeCursor = (direction: -1 | 1) => {
    if (mode() === "day") setSelectedDate(shiftDays(selectedDate(), direction));
    else if (mode() === "week") setSelectedDate(shiftDays(selectedDate(), direction * 7));
    else {
      const time = parseProjectDate(selectedDate()) ?? Date.now();
      setSelectedDate(dateValue(new Date(Date.UTC(new Date(time).getUTCFullYear(), new Date(time).getUTCMonth() + direction, 1))));
    }
  };

  return (
    <div class="project-page project-calendar-page">
      <div class="project-page-heading"><div><span class="project-eyebrow">PROJECT SCHEDULE</span><h1>Calendar</h1><p>Review task deadlines and milestones by day, week, or month.</p></div></div>
      <div class="project-calendar-toolbar">
        <div class="project-calendar-nav"><button aria-label="Previous period" onClick={() => changeCursor(-1)}>&lsaquo;</button><strong>{mode() === "day" ? formatProjectDate(selectedDate(), { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : monthLabel()}</strong><button aria-label="Next period" onClick={() => changeCursor(1)}>&rsaquo;</button><button class="project-calendar-today" onClick={() => setSelectedDate(todayProjectDate())}>Today</button></div>
        <div class="project-calendar-modes" role="group" aria-label="Calendar view">{(["day", "week", "month"] as const).map(option => <button class={mode() === option ? "active" : ""} aria-pressed={mode() === option} onClick={() => setMode(option)}>{option[0].toUpperCase() + option.slice(1)}</button>)}</div>
      </div>
      <Show when={mode() !== "day"}><div class="project-calendar-weekdays" aria-hidden="true"><For each={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]}>{day => <span>{day}</span>}</For></div></Show>
      <div class={`project-calendar-grid mode-${mode()}`}>
        <For each={visibleDates()}>{day => {
          const tasks = () => props.data.tasks.filter(task => task.dueDate === day);
          const milestones = () => props.data.milestones.filter(item => item.date === day);
          const isCurrentMonth = () => day.slice(0, 7) === selectedDate().slice(0, 7);
          return <section class={`project-calendar-day ${day === selectedDate() ? "is-selected" : ""} ${day === todayProjectDate() ? "is-today" : ""} ${!isCurrentMonth() && mode() === "month" ? "is-outside-month" : ""}`}>
            <button class="project-calendar-day-number" aria-label={`Select ${formatProjectDate(day)}`} onClick={() => { setSelectedDate(day); if (mode() === "month") setMode("day"); }}>{new Date(`${day}T00:00:00Z`).getUTCDate()}</button>
            <div class="project-calendar-events">
              <For each={milestones()}>{milestone => <button class="project-calendar-event milestone-event" title={`Milestone: ${milestone.title}`} onClick={() => setSelectedDate(day)}><i />{milestone.title}</button>}</For>
              <For each={tasks()}>{task => <button class={`project-calendar-event task-event priority-${task.priority} ${task.status === "done" ? "is-done" : ""}`} title={`${task.title} - ${task.priority} priority`} onClick={props.onOpenTasks}><i />{task.title}</button>}</For>
              <Show when={!tasks().length && !milestones().length && mode() === "day"}><span class="project-calendar-no-events">No scheduled items</span></Show>
            </div>
          </section>;
        }}</For>
      </div>
      <Show when={!props.data.tasks.some(task => task.dueDate) && !props.data.milestones.length}>
        <p class="project-calendar-empty-hint">Add due dates to tasks or create a milestone to see it here.</p>
      </Show>
      <div class="project-calendar-legend"><span><i class="priority-high" /> High priority</span><span><i class="priority-medium" /> Medium priority</span><span><i class="milestone-legend" /> Milestone</span></div>
    </div>
  );
}
