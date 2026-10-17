import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";
import type { ProjectWorkspaceData } from "../../model";
import { displayPathName } from "../files/paths";
import { parsePlanningFile } from "./planning-file";
import { planningFileStore } from "./planning-file-store";

type PlanSummary = { path: string; name: string; description: string; taskCount: number; openTaskCount: number; milestoneCount: number; searchText: string; error?: string };
type Props = { paths: string[]; currentPath?: string; currentData: ProjectWorkspaceData; onOpen: (path: string) => void; onAddPlans: () => void };

export function ProjectPlansOverview(props: Props) {
  const [query, setQuery] = createSignal("");
  const [summaries, setSummaries] = createSignal<PlanSummary[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [refreshKey, setRefreshKey] = createSignal(0);
  createEffect(() => {
    const paths = [...new Set(props.paths)];
    const refresh = refreshKey();
    if (!paths.length) { setSummaries([]); setLoading(false); return; }
    let active = true;
    setLoading(true);
    void (async () => {
      const result: PlanSummary[] = [];
      for (const path of paths) {
        if (!active) return;
        try {
          const authorized = await planningFileStore.authorize(path);
          const parsed = parsePlanningFile(JSON.parse(await planningFileStore.read(authorized)) as unknown);
          if (!parsed) throw new Error("Unsupported Planning file format");
          const project = parsed.project;
          result.push({ path: authorized, name: project.name, description: project.description, taskCount: project.tasks.length, openTaskCount: project.tasks.filter(task => !project.workflowColumns?.find(column => column.id === task.status)?.completed).length, milestoneCount: project.milestones.length, searchText: [project.name, project.description, ...project.tasks.map(task => task.title), ...project.milestones.map(item => item.title)].join(" ").toLocaleLowerCase() });
        } catch (cause) {
          result.push({ path, name: displayPathName(path), description: "Could not read this plan. Open it to restore access.", taskCount: 0, openTaskCount: 0, milestoneCount: 0, searchText: displayPathName(path).toLocaleLowerCase(), error: String(cause) });
        }
        if (active && refresh === refreshKey()) setSummaries([...result]);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    })().finally(() => { if (active) setLoading(false); });
    onCleanup(() => { active = false; });
  });
  const visible = () => {
    const needle = query().trim().toLocaleLowerCase();
    return summaries().filter(plan => !needle || plan.searchText.includes(needle));
  };

  return <div class="project-page project-plans-page">
    <div class="project-page-heading"><div><span class="project-eyebrow">PLAN LIBRARY</span><h1>All plans</h1><p>Search the planning files you have recently opened or add more plans to this overview.</p></div><button class="project-primary-action" onClick={props.onAddPlans}>Add plan files</button></div>
    <div class="project-plan-library-toolbar"><label>Search plans<input type="search" value={query()} placeholder="Project, task, or milestone" onInput={event => setQuery(event.currentTarget.value)} /></label><button onClick={() => setRefreshKey(value => value + 1)} disabled={loading()}>{loading() ? "Refreshing…" : "Refresh"}</button><small>{visible().length} of {summaries().length} plans</small></div>
    <Show when={summaries().length} fallback={<div class="project-empty-state"><strong>No plans in the overview</strong><p>Add one or more .sdplan files to browse their summaries and find tasks across projects.</p><button onClick={props.onAddPlans}>Add plan files</button></div>}>
      <div class="project-plan-library-grid"><For each={visible()}>{plan => <article class={`project-plan-library-card ${plan.path === props.currentPath ? "is-current" : ""}`}>
        <header><span class="project-eyebrow">{plan.path === props.currentPath ? "OPEN PLAN" : "PLANNING FILE"}</span><button onClick={() => props.onOpen(plan.path)}>{plan.path === props.currentPath ? "Return to plan" : "Open plan"}</button></header>
        <h2>{plan.name}</h2><p>{plan.description || "No project summary yet."}</p>
        <div><span><strong>{plan.openTaskCount}</strong> open</span><span><strong>{plan.taskCount}</strong> tasks</span><span><strong>{plan.milestoneCount}</strong> milestones</span></div>
        <small title={plan.path}>{displayPathName(plan.path)}</small>
        <Show when={plan.error}><small class="project-plan-library-error">{plan.error}</small></Show>
      </article>}</For></div>
      <Show when={!visible().length}><div class="project-empty-inline"><span>No plans match “{query()}”.</span><button onClick={() => setQuery("")}>Clear search</button></div></Show>
    </Show>
    <Show when={props.currentPath && !summaries().some(plan => plan.path === props.currentPath)}><article class="project-plan-current-unsaved"><strong>{props.currentData.name}</strong><span>This open plan is not in the recent file list yet.</span></article></Show>
  </div>;
}
