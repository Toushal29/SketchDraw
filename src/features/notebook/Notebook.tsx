import { For, Show, createSignal } from "solid-js";
import { isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { ProjectNote } from "../../model";
import "./notebook.css";

type Props = { notes: ProjectNote[]; editable: boolean; onChange: (notes: ProjectNote[]) => void };

export function Notebook(props: Props) {
  const [selectedId, setSelectedId] = createSignal(props.notes[0]?.id ?? "");
  const [notesOpen, setNotesOpen] = createSignal(false);
  const [exportStatus, setExportStatus] = createSignal("");
  const note = () => props.notes.find(item => item.id === selectedId()) ?? props.notes[0];

  const fileBaseName = (value: string) => value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/g, "") || "Notes";
  const noteMarkdown = (item: ProjectNote) => `# ${(item.title.trim() || "Untitled note").replace(/[\r\n]+/g, " ")}\n\n${item.content}`;

  const exportNotes = async (items: ProjectNote[], suggestedName: string, title: string) => {
    if (!items.length) return;
    const markdown = items.map(noteMarkdown).join("\n\n---\n\n");
    const defaultPath = `${fileBaseName(suggestedName)}.md`;
    setExportStatus("");
    try {
      if (isTauri()) {
        const path = await save({ title, defaultPath, filters: [{ name: "Markdown", extensions: ["md"] }] });
        if (!path) return;
        await writeTextFile(/\.md$/i.test(path) ? path : `${path}.md`, markdown);
      } else {
        const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = defaultPath;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setExportStatus(items.length === 1 ? "Note exported as Markdown." : `${items.length} notes exported as Markdown.`);
    } catch (cause) {
      setExportStatus(`Could not export notes: ${String(cause)}`);
    }
  };

  const addNote = () => {
    if (!props.editable) return;
    const now = Date.now();
    const created: ProjectNote = { id: crypto.randomUUID(), title: "", content: "", createdAt: now, updatedAt: now };
    props.onChange([created, ...props.notes]);
    setSelectedId(created.id);
    setNotesOpen(false);
  };

  const updateNote = (id: string, patch: Partial<ProjectNote>) => {
    props.onChange(props.notes.map(item => item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item));
  };

  const removeNote = (id: string, event: MouseEvent) => {
    event.stopPropagation();
    if (!props.editable) return;
    const remaining = props.notes.filter(item => item.id !== id);
    props.onChange(remaining);
    if (selectedId() === id) setSelectedId(remaining[0]?.id ?? "");
  };

  return <section class="notebook-workspace" aria-label="Notebook"><div class="notebook-content"><div class="notebook-page-content">
    <div class="notebook-page-heading">
      <div><span class="notebook-eyebrow">FAST CAPTURE</span><h2>Notebook</h2><p>A focused space for notes saved with this sketch.</p></div>
      <div class="notebook-actions">
        <button type="button" class="notebook-secondary" onClick={() => setNotesOpen(true)} aria-haspopup="dialog">Notes <span>{props.notes.length}</span></button>
        <button type="button" class="notebook-primary" disabled={!props.editable} onClick={addNote}>New note</button>
      </div>
    </div>
    <Show when={exportStatus()}><p class="notebook-export-status" role="status" aria-live="polite">{exportStatus()}</p></Show>

    <Show when={note()} fallback={<article class="notebook-panel notebook-editor notebook-empty"><strong>No note is open</strong><span>Create a note to start writing. Your notes stay in this sketch's Notebook.</span><button type="button" class="notebook-primary" disabled={!props.editable} onClick={addNote}>Create first note</button></article>}>
      {item => <article class="notebook-panel notebook-editor">
        <header><span class="notebook-eyebrow">NOTE</span><div class="notebook-editor-actions"><small>Updated {new Date(item().updatedAt).toLocaleString()}</small><button type="button" class="notebook-export" onClick={() => void exportNotes([item()], item().title || "Note", "Export note as Markdown")}>Export note</button></div></header>
        <input value={item().title} disabled={!props.editable} maxlength="200" aria-label="Note title" placeholder="Untitled note" onInput={event => updateNote(item().id, { title: event.currentTarget.value })} />
        <textarea value={item().content} disabled={!props.editable} maxlength="100000" aria-label="Note content" placeholder="Write your note..." onInput={event => updateNote(item().id, { content: event.currentTarget.value })} />
      </article>}
    </Show>

    <Show when={notesOpen()}>
      <div class="notebook-backdrop" role="presentation" onPointerDown={event => { if (event.target === event.currentTarget) setNotesOpen(false); }}>
        <section class="notebook-modal" role="dialog" aria-modal="true" aria-labelledby="notebook-notes-title">
          <header><div><span class="notebook-eyebrow">THIS SKETCH</span><h3 id="notebook-notes-title">Your notes</h3><p>Open, export, or remove notes from this sketch.</p></div><button type="button" class="notebook-close" aria-label="Close notes" onClick={() => setNotesOpen(false)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></button></header>
          <Show when={props.notes.length > 0} fallback={<div class="notebook-modal-empty">No notes yet. Create one to get started.</div>}>
            <div class="notebook-modal-list"><For each={props.notes}>{item =>
              <article class="notebook-modal-row" classList={{ active: note()?.id === item.id }}>
                <button type="button" class="notebook-modal-item" aria-current={note()?.id === item.id ? "true" : undefined} onClick={() => { setSelectedId(item.id); setNotesOpen(false); }}>
                  <strong>{item.title.trim() || "Untitled note"}</strong>
                  <span>{item.content.split("\n").find(line => line.trim()) || "Empty note"}</span>
                  <time>{new Date(item.updatedAt).toLocaleDateString()}</time>
                </button>
                <button type="button" class="notebook-delete" disabled={!props.editable} aria-label={`Delete ${item.title.trim() || "untitled note"}`} title="Delete note" onClick={event => removeNote(item.id, event)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12m-10 0 .7 10h6.6L14 6M8 6V4h4v2m-3 3v4m2-4v4" /></svg></button>
              </article>
            }</For></div>
          </Show>
          <footer><span role="status" aria-live="polite">{exportStatus() || `${props.notes.length} ${props.notes.length === 1 ? "note" : "notes"}`}</span><div class="notebook-modal-actions"><button type="button" class="notebook-export" disabled={!props.notes.length} onClick={() => void exportNotes(props.notes, "SketchDraw notes", "Export all notes as Markdown")}>Export all</button><button type="button" class="notebook-primary" disabled={!props.editable} onClick={addNote}>New note</button></div></footer>
        </section>
      </div>
    </Show>
  </div></div></section>;
}
