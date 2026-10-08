import { For, Show, createSignal } from "solid-js";
import type { ProjectLogEntry, ProjectLogKind, ProjectTaskPriority } from "../../model";

type Props = { entries: ProjectLogEntry[]; editable: boolean; onAdd: (entry: ProjectLogEntry) => void; onUpdate: (id: string, patch: Partial<ProjectLogEntry>) => void; onDelete: (id: string) => void };

const KIND_LABELS: Record<ProjectLogKind, string> = { decision: "Decision", question: "Open question", risk: "Risk" };

export function ProjectLog(props: Props) {
  const [kind, setKind] = createSignal<ProjectLogKind>("decision");
  const [title, setTitle] = createSignal("");
  const [details, setDetails] = createSignal("");
  const [owner, setOwner] = createSignal("");
  const [nextStep, setNextStep] = createSignal("");
  const [riskLevel, setRiskLevel] = createSignal<ProjectTaskPriority>("medium");
  const addEntry = (event: SubmitEvent) => {
    event.preventDefault();
    if (!props.editable || !title().trim()) return;
    const now = Date.now();
    props.onAdd({ id: crypto.randomUUID(), kind: kind(), title: title().trim().slice(0, 300), details: details().slice(0, 20_000), owner: owner().trim().slice(0, 200), nextStep: nextStep().trim().slice(0, 2000), ...(kind() === "risk" ? { riskLevel: riskLevel() } : {}), resolved: false, createdAt: now, updatedAt: now });
    setTitle(""); setDetails(""); setOwner(""); setNextStep("");
  };

  return (
    <div class="project-page project-log-page">
      <div class="project-page-heading"><div><span class="project-eyebrow">PROJECT RECORD</span><h1>Decisions &amp; risks</h1><p>Keep decisions, unanswered questions, risks, owners, and next steps in one log.</p></div></div>
      <Show when={props.editable}>
        <form class="project-log-form" onSubmit={addEntry}>
          <label><span>Record type</span><select value={kind()} onChange={event => setKind(event.currentTarget.value as ProjectLogKind)}><option value="decision">Decision</option><option value="question">Open question</option><option value="risk">Risk</option></select></label>
          <label class="project-log-title-field"><span>Title</span><input value={title()} maxlength="300" placeholder="What needs to be recorded?" onInput={event => setTitle(event.currentTarget.value)} /></label>
          <label><span>Owner</span><input value={owner()} maxlength="200" placeholder="Person or team" onInput={event => setOwner(event.currentTarget.value)} /></label>
          <Show when={kind() === "risk"}><label><span>Risk level</span><select value={riskLevel()} onChange={event => setRiskLevel(event.currentTarget.value as ProjectTaskPriority)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></Show>
          <label class="project-log-wide"><span>Details</span><textarea value={details()} maxlength="20000" rows="2" placeholder="Context, impact, or options considered" onInput={event => setDetails(event.currentTarget.value)} /></label>
          <label class="project-log-wide"><span>Next step</span><input value={nextStep()} maxlength="2000" placeholder="What happens next?" onInput={event => setNextStep(event.currentTarget.value)} /></label>
          <button class="project-primary-action" disabled={!title().trim()}>Add to log</button>
        </form>
      </Show>
      <section class="project-log-list" aria-label="Decisions and risks">
        <Show when={props.entries.length} fallback={<div class="project-empty-state"><strong>No decisions or risks recorded</strong><p>Capture why a choice was made or who owns the next step.</p></div>}>
          <For each={props.entries.map(entry => entry.id)}>{id => {
            const entry = () => props.entries.find(item => item.id === id)!;
            return <article class={`project-log-entry kind-${entry().kind} ${entry().resolved ? "is-resolved" : ""}`}>
              <header><span class="project-log-kind">{KIND_LABELS[entry().kind]}</span><Show when={entry().kind === "risk" && entry().riskLevel}><span class={`project-risk-level priority-${entry().riskLevel}`}>{entry().riskLevel} risk</span></Show><Show when={entry().resolved}><span class="project-log-resolved">Resolved</span></Show><time>{new Date(entry().updatedAt).toLocaleDateString()}</time></header>
              <Show when={props.editable} fallback={<h2>{entry().title}</h2>}><input class="project-log-entry-title" value={entry().title} aria-label="Log entry title" onInput={event => props.onUpdate(id, { title: event.currentTarget.value.slice(0, 300) })} /></Show>
              <Show when={props.editable} fallback={<p>{entry().details}</p>}><textarea class="project-log-entry-details" value={entry().details} aria-label={`Details for ${entry().title}`} placeholder="Add context" onInput={event => props.onUpdate(id, { details: event.currentTarget.value.slice(0, 20_000) })} /></Show>
              <div class="project-log-meta"><label><span>Owner</span><input disabled={!props.editable} value={entry().owner} placeholder="Unassigned" onInput={event => props.onUpdate(id, { owner: event.currentTarget.value.slice(0, 200) })} /></label><label><span>Next step</span><input disabled={!props.editable} value={entry().nextStep} placeholder="No next step" onInput={event => props.onUpdate(id, { nextStep: event.currentTarget.value.slice(0, 2000) })} /></label></div>
              <footer><button disabled={!props.editable} onClick={() => props.onUpdate(id, { resolved: !entry().resolved })}>{entry().resolved ? "Reopen" : "Mark resolved"}</button><button disabled={!props.editable} class="project-row-delete" onClick={() => props.onDelete(id)}>Delete</button></footer>
            </article>;
          }}</For>
        </Show>
      </section>
    </div>
  );
}
