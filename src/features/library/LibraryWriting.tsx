import { For, Show, createSignal } from "solid-js";
import type { LibraryWritingDraft, LibraryWritingRevision } from "../../model";

type Props = { drafts: LibraryWritingDraft[]; editable: boolean; onChange: (drafts: LibraryWritingDraft[]) => void };

export function LibraryWriting(props: Props) {
  const [selectedId, setSelectedId] = createSignal(props.drafts[0]?.id ?? "");
  const [newTitle, setNewTitle] = createSignal("");
  const [focusMode, setFocusMode] = createSignal(false);
  const draft = () => props.drafts.find(item => item.id === selectedId()) ?? props.drafts[0];
  const update = (id: string, patch: Partial<LibraryWritingDraft>) => props.onChange(props.drafts.map(item => item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item));
  const addDraft = () => {
    if (!props.editable || !newTitle().trim()) return;
    const now = Date.now(); const item: LibraryWritingDraft = { id: crypto.randomUUID(), title: newTitle().trim().slice(0, 200), outline: "", content: "", revisions: [], createdAt: now, updatedAt: now };
    props.onChange([item, ...props.drafts]); setSelectedId(item.id); setNewTitle("");
  };
  const removeDraft = (id: string) => {
    if (!props.editable) return;
    const remaining = props.drafts.filter(item => item.id !== id); props.onChange(remaining); setSelectedId(remaining[0]?.id ?? "");
  };
  const snapshot = (item: LibraryWritingDraft): LibraryWritingRevision => ({ id: crypto.randomUUID(), title: item.title, outline: item.outline, content: item.content, createdAt: Date.now() });
  const saveRevision = (item: LibraryWritingDraft) => {
    if (!props.editable || !item.content.trim() && !item.outline.trim()) return;
    const last = item.revisions[0];
    if (last && last.title === item.title && last.outline === item.outline && last.content === item.content) return;
    update(item.id, { revisions: [snapshot(item), ...item.revisions].slice(0, 20) });
  };
  const restoreRevision = (item: LibraryWritingDraft, revision: LibraryWritingRevision) => {
    if (!props.editable) return;
    const current = snapshot(item);
    const history = [current, ...item.revisions.filter(entry => entry.id !== revision.id)].slice(0, 20);
    update(item.id, { title: revision.title, outline: revision.outline, content: revision.content, revisions: history });
  };
  const wordCount = (text: string) => text.trim() ? text.trim().split(/\s+/).length : 0;
  const readTime = (text: string) => Math.max(1, Math.ceil(wordCount(text) / 220));

  return <div class="library-content">
    <div class="library-heading"><div><h2>Writing studio</h2><p>Draft longer work, keep an outline, and save named revision points.</p></div></div>
    <div class="library-writing-layout" classList={{ "is-focus-mode": focusMode() }}>
      <aside class="library-panel library-writing-list" aria-label="Writing drafts">
        <form class="library-inline-form" onSubmit={event => { event.preventDefault(); addDraft(); }}><input value={newTitle()} disabled={!props.editable} maxlength="200" placeholder="New draft title" aria-label="New draft title" onInput={event => setNewTitle(event.currentTarget.value)} /><button disabled={!props.editable || !newTitle().trim()}>Create</button></form>
        <For each={props.drafts.map(item => item.id)}>{id => { const item = () => props.drafts.find(entry => entry.id === id)!; return <button class={draft()?.id === id ? "active" : ""} onClick={() => setSelectedId(id)}><strong>{item().title || "Untitled draft"}</strong><span>{wordCount(item().content)} words · {item().revisions.length} revisions</span></button>; }}</For>
        <Show when={!props.drafts.length}><p class="library-empty-copy">Create a draft to start writing.</p></Show>
      </aside>
      <Show when={draft()} fallback={<div class="library-panel library-empty-state">Select or create a writing draft.</div>}>
        {item => <section class="library-panel library-writing-editor">
          <header class="library-writing-editor-heading"><input value={item().title} disabled={!props.editable} maxlength="200" aria-label="Draft title" onInput={event => update(item().id, { title: event.currentTarget.value })} /><div><span>{wordCount(item().content)} words · {item().content.length.toLocaleString()} characters · {readTime(item().content)} min read</span><button class="library-secondary" onClick={() => setFocusMode(mode => !mode)}>{focusMode() ? "Exit focus" : "Focus writing"}</button><button class="library-secondary" disabled={!props.editable} onClick={() => saveRevision(item())}>Save revision</button><button class="library-secondary" disabled={!props.editable} onClick={() => removeDraft(item().id)}>Delete draft</button></div></header>
          <label class="library-field library-writing-outline-field"><span>Outline</span><textarea class="library-writing-outline" value={item().outline} disabled={!props.editable} maxlength="50000" placeholder="Add headings or a rough outline..." onInput={event => update(item().id, { outline: event.currentTarget.value })} /></label>
          <label class="library-field library-writing-body"><span>Draft</span><textarea value={item().content} disabled={!props.editable} maxlength="300000" placeholder="Start writing..." onInput={event => update(item().id, { content: event.currentTarget.value })} /></label>
          <details class="library-writing-history"><summary>Revision history <span>{item().revisions.length}</span></summary><Show when={item().revisions.length} fallback={<p>No saved revisions yet. Save a revision point before a major rewrite.</p>}><div><For each={item().revisions}>{revision => <article><div><strong>{revision.title || "Untitled draft"}</strong><time>{new Date(revision.createdAt).toLocaleString()}</time><small>{wordCount(revision.content)} words</small></div><button disabled={!props.editable} onClick={() => restoreRevision(item(), revision)}>Restore</button></article>}</For></div></Show></details>
        </section>}
      </Show>
    </div>
  </div>;
}
