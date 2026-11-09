import { Show } from "solid-js";
import type { DocumentWorkspaceArea } from "./workspace-types";

type Props = { active: DocumentWorkspaceArea; documentTabs: boolean; onSelect: (area: DocumentWorkspaceArea) => void };
const APP_WORKSPACES = [
  { id: "canvas", label: "Canvas", compact: "Draw", hint: "Drawing, sketching, and modeling tools" },
  { id: "planning", label: "Planning", compact: "Plan", hint: "Projects, notes, and tasks" },
] as const;
const CANVAS_VIEWS = [
  { id: "canvas", label: "Canvas", compact: "Canvas", hint: "Freehand drawing and sketching" },
  { id: "design", label: "Diagram tools", compact: "Diagram", hint: "Database and architecture diagram tools" },
] as const;

export function WorkspaceAreaTabs(props: Props) {
  const activeWorkspace = () => props.active === "design" ? "canvas" : props.active;
  return <div class="workspace-switchers">
    <nav class="workspace-viewport-tabs" role="tablist" aria-label="SketchDraw workspaces">
      {APP_WORKSPACES.map(area => <button type="button" role="tab" aria-selected={activeWorkspace() === area.id} class={activeWorkspace() === area.id ? "active" : ""} onClick={() => props.onSelect(area.id)} title={area.hint}><span class="workspace-tab-label-wide">{area.label}</span><span class="workspace-tab-label-compact">{area.compact}</span></button>)}
    </nav>
    <Show when={props.documentTabs && (props.active === "canvas" || props.active === "design")}>
      <nav class="document-workspace-tabs" role="tablist" aria-label="Canvas views">
        {CANVAS_VIEWS.map(view => <button type="button" role="tab" aria-selected={props.active === view.id} class={props.active === view.id ? "active" : ""} onClick={() => props.onSelect(view.id)} title={view.hint}><span class="workspace-tab-label-wide">{view.label}</span><span class="workspace-tab-label-compact">{view.compact}</span></button>)}
      </nav>
    </Show>
  </div>;
}
