import type { DocumentWorkspaceArea } from "./workspace-types";

type Props = { fileName: string; onSelect: (area: DocumentWorkspaceArea) => void };

export function WorkspaceChooser(props: Props) {
  return <section class="document-workspace-chooser" aria-label="Choose a workspace">
    <header><div><span class="document-workspace-kicker">OPEN DOCUMENT</span><h1>{props.fileName}</h1><p>Choose a section. Canvas, project planning, and your personal library stay together in this file.</p></div></header>
    <div class="document-workspace-choice-grid">
      <button class="document-workspace-choice canvas" onClick={() => props.onSelect("canvas")}><span class="document-workspace-choice-icon">C</span><strong>Canvas</strong><small>Open the whiteboard, pages, diagrams, and drawing tools.</small><span>Open canvas <b aria-hidden="true">&rarr;</b></span></button>
      <button class="document-workspace-choice planning" onClick={() => props.onSelect("planning")}><span class="document-workspace-choice-icon">P</span><strong>Project planning</strong><small>Open tasks, Kanban, milestones, decisions, and project files.</small><span>Open planning <b aria-hidden="true">&rarr;</b></span></button>
      <button class="document-workspace-choice library" onClick={() => props.onSelect("library")}><span class="document-workspace-choice-icon">L</span><strong>Personal library</strong><small>Open quick notes, study tools, writing, research, and your media log.</small><span>Open library <b aria-hidden="true">&rarr;</b></span></button>
    </div>
    <footer>Switch between these workspaces at any time. The document remains open.</footer>
  </section>;
}
