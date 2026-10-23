import type { DocumentWorkspaceArea } from "./workspace-types";

type Props = { active: DocumentWorkspaceArea; documentTabs: boolean; onSelect: (area: DocumentWorkspaceArea) => void };
const VIEWPORTS = [
  { id: "canvas", label: "Canvas", hint: "Drawing, sketching, and modeling tools" },
  { id: "planning", label: "Planning", hint: "Projects, notes, and tasks" },
] as const;
const DOCUMENT_VIEWS = [
  { id: "canvas", label: "Canvas", hint: "Drawing and sketching tools" },
  { id: "design", label: "Design", hint: "Database and architecture diagram tools" },
] as const;

export function WorkspaceAreaTabs(props: Props) {
  const areas = () => props.documentTabs ? DOCUMENT_VIEWS : VIEWPORTS;
  const activeArea = () => !props.documentTabs && props.active === "design" ? "canvas" : props.active;
  return <nav class={props.documentTabs ? "document-workspace-tabs" : "workspace-viewport-tabs"} role="tablist" aria-label={props.documentTabs ? "Canvas and Design views" : "Canvas and Planning viewports"}>
    {areas().map(area => <button type="button" role="tab" aria-selected={activeArea() === area.id} class={activeArea() === area.id ? "active" : ""} onClick={() => props.onSelect(area.id)} title={area.hint}>{area.label}</button>)}
  </nav>;
}
