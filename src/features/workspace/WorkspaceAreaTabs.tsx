import type { DocumentWorkspaceArea } from "./workspace-types";

type Props = { active: DocumentWorkspaceArea; onSelect: (area: DocumentWorkspaceArea) => void; includeDesign?: boolean };
const AREAS: { id: DocumentWorkspaceArea; label: string; hint: string }[] = [
  { id: "canvas", label: "Canvas", hint: "Drawing, sketching, and modeling tools" },
  { id: "design", label: "Design", hint: "A browsable palette for diagrams, models, and components" },
  { id: "planning", label: "Planning", hint: "Projects and tasks" },
];

export function WorkspaceAreaTabs(props: Props) {
  const areas = () => AREAS.filter(area => area.id !== "design" || props.includeDesign);
  return <nav class="document-workspace-tabs" role="tablist" aria-label="Document workspaces">
    {areas().map(area => <button type="button" role="tab" aria-selected={props.active === area.id} class={props.active === area.id ? "active" : ""} onClick={() => props.onSelect(area.id)} title={area.hint}>{area.label}</button>)}
  </nav>;
}
