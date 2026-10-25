import { createMemo } from "solid-js";
import type { ProjectTask } from "../../model";

type Props = { tasks: ProjectTask[] };
type Sample = { time: number; remaining: number };

const DAY = 86_400_000;

export function ProjectBurndownChart(props: Props) {
  const samples = createMemo<Sample[]>(() => {
    const now = Date.now();
    const firstTaskAt = props.tasks.length ? Math.min(...props.tasks.map(task => task.createdAt)) : now - 7 * DAY;
    const start = Math.max(firstTaskAt, now - 56 * DAY);
    const range = Math.max(DAY, now - start);
    return Array.from({ length: 8 }, (_, index) => {
      const time = start + range * index / 7;
      const opened = props.tasks.filter(task => task.createdAt <= time);
      const completed = opened.filter(task => {
        const completedAt = task.completedAt ?? (task.status === "done" ? task.updatedAt : undefined);
        return completedAt !== undefined && completedAt <= time;
      }).length;
      return { time, remaining: Math.max(0, opened.length - completed) };
    });
  });
  const maximum = createMemo(() => Math.max(1, ...samples().map(sample => sample.remaining)));
  const points = (values: number[]) => values.map((value, index) => `${52 + index * 60},${150 - value / maximum() * 112}`).join(" ");
  const actualPoints = () => points(samples().map(sample => sample.remaining));
  const idealPoints = () => points([samples()[0]?.remaining ?? 0, ...Array.from({ length: 6 }, (_, index) => (samples()[0]?.remaining ?? 0) * (5 - index) / 7), 0]);
  const lastWeek = () => props.tasks.filter(task => {
    const completedAt = task.completedAt ?? (task.status === "done" ? task.updatedAt : undefined);
    return completedAt !== undefined && completedAt >= Date.now() - 7 * DAY;
  }).length;
  const labels = () => samples().filter((_, index) => index % 2 === 0).map(sample => new Date(sample.time).toLocaleDateString(undefined, { month: "short", day: "numeric" }));

  return <section class="project-home-card project-burndown-card">
    <header><div><span class="project-eyebrow">PROJECT HEALTH</span><h2>Task burndown</h2></div><span class="project-burndown-velocity">{lastWeek()} completed this week</span></header>
    {props.tasks.length ? <svg class="project-burndown-chart" viewBox="0 0 500 184" role="img" aria-label="Task burndown showing open tasks over the last eight weeks">
      <title>Task burndown</title><desc>Solid line shows remaining tasks derived from their creation and completion dates. Dashed line shows a steady pace.</desc>
      {[0, 1, 2, 3].map(index => <g><line x1="52" x2="472" y1={38 + index * 37} y2={38 + index * 37} /><text x="42" y={42 + index * 37} text-anchor="end">{Math.round(maximum() * (3 - index) / 3)}</text></g>)}
      <polyline class="project-burndown-ideal" points={idealPoints()} />
      <polyline class="project-burndown-actual" points={actualPoints()} />
      {labels().map((label, index) => <text x={52 + index * 120} y="174" text-anchor={index === 0 ? "start" : "middle"}>{label}</text>)}
    </svg> : <p class="project-burndown-empty">Add tasks to build a burndown trend.</p>}
    <footer><span>Open tasks</span><strong>{samples()[samples().length - 1]?.remaining ?? 0}</strong><span>Solid: actual · dashed: steady pace</span></footer>
  </section>;
}
