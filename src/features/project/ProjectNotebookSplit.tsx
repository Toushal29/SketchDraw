import { For, Show, createMemo, createSignal } from "solid-js";
import type { ProjectNote, ProjectWorkspaceData } from "../../model";

type Props = {
  data: ProjectWorkspaceData;
  editable: boolean;
  onChange: (data: ProjectWorkspaceData) => void;
  onOpen: () => void;
  onCreate: () => void;
  onHighlight: (line: string) => void;
};

export function ProjectNotebookSplit(props: Props) {
  const [selectedId, setSelectedId] = createSignal(props.data.notes[0]?.id ?? "");
  const note = createMemo(() => props.data.notes.find(item => item.id === selectedId()) ?? props.data.notes[0]);
  const updateNote = (patch: Partial<ProjectNote>) => {
    const current = note();
    if (!current || !props.editable) return;
    props.onChange({ ...props.data, notes: props.data.notes.map(item => item.id === current.id ? { ...item, ...patch, updatedAt: Date.now() } : item) });
  };
  const highlightLine = (event: Event) => {
    const input = event.currentTarget as HTMLTextAreaElement;
    const start = input.value.lastIndexOf("\n", Math.max(0, input.selectionStart - 1)) + 1;
    const end = input.value.indexOf("\n", input.selectionStart);
    props.onHighlight(input.value.slice(start, end < 0 ? undefined : end));
  };

  return <aside class="canvas-notebook-split" aria-label="Project notebook beside canvas">
    <header><div><span>PROJECT NOTEBOOK</span><strong>{props.data.name || "Planning"}</strong></div><button type="button" aria-label="Open full Planning workspace" title="Open Planning workspace" onClick={props.onOpen}>Planning</button></header>
    <Show when={props.data.notes.length} fallback={<div class="canvas-notebook-empty"><p>Add a project note to keep decisions and design context beside this canvas.</p><button type="button" disabled={!props.editable || props.data.notes.length >= 12_000} onClick={props.onCreate}>Create note</button></div>}>
      <label class="canvas-notebook-select">Note<select aria-label="Choose project note" value={note()?.id ?? ""} onChange={event => setSelectedId(event.currentTarget.value)}><For each={props.data.notes}>{item => <option value={item.id}>{item.title || "Untitled note"}</option>}</For></select></label>
      <input class="canvas-notebook-title" aria-label="Note title" maxlength="120" disabled={!props.editable} value={note()?.title ?? ""} onInput={event => updateNote({ title: event.currentTarget.value })} />
      <textarea class="canvas-notebook-editor" aria-label="Markdown project note" spellcheck={false} disabled={!props.editable} value={note()?.content ?? ""} placeholder={'Write project notes in Markdown.\nUse [[Component name]] on a line, then select the line to highlight that canvas object.'} onInput={event => updateNote({ content: event.currentTarget.value })} onSelect={highlightLine} onKeyUp={highlightLine} />
      <footer><span>Select a line with <code>[[object name]]</code> to highlight its canvas object.</span><button type="button" disabled={!props.editable || props.data.notes.length >= 12_000} onClick={props.onCreate}>New note</button></footer>
    </Show>
  </aside>;
}
