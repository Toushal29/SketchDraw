import type { DocumentWorkspaceArea } from "./workspace-types";

type Props = { active: DocumentWorkspaceArea; onSelect: (area: DocumentWorkspaceArea) => void };
const AREAS: { id: DocumentWorkspaceArea; label: string; hint: string }[] = [
  { id: "canvas", label: "Canvas", hint: "Draw and diagram" },
  { id: "planning", label: "Planning", hint: "Projects and tasks" },
  { id: "notebook", label: "Notebook", hint: "Personal notes" },
];

export function WorkspaceAreaTabs(props: Props) {
  return <nav class="document-workspace-tabs" role="tablist" aria-label="Document workspaces">
    {AREAS.map(area => <button type="button" role="tab" aria-selected={props.active === area.id} class={props.active === area.id ? "active" : ""} onClick={() => props.onSelect(area.id)} title={area.hint}>{area.label}</button>)}
  </nav>;
}
