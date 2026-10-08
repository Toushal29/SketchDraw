import { For, Show, createSignal } from "solid-js";
import type { LibraryResearchSource } from "../../model";

type Props = { sources: LibraryResearchSource[]; editable: boolean; onChange: (sources: LibraryResearchSource[]) => void };

export function LibraryResearch(props: Props) {
  const [selectedId, setSelectedId] = createSignal(props.sources[0]?.id ?? "");
  const [newTitle, setNewTitle] = createSignal("");
  const source = () => props.sources.find(item => item.id === selectedId()) ?? props.sources[0];
  const update = (id: string, patch: Partial<LibraryResearchSource>) => props.onChange(props.sources.map(item => item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item));
  const addSource = () => {
    if (!props.editable || !newTitle().trim()) return;
    const now = Date.now(); const item: LibraryResearchSource = { id: crypto.randomUUID(), title: newTitle().trim().slice(0, 500), url: "", author: "", year: "", citation: "", quote: "", notes: "", tags: [], createdAt: now, updatedAt: now };
    props.onChange([item, ...props.sources]); setSelectedId(item.id); setNewTitle("");
  };
  const removeSource = (id: string) => {
    if (!props.editable) return;
    const remaining = props.sources.filter(item => item.id !== id); props.onChange(remaining); setSelectedId(remaining[0]?.id ?? "");
  };
  const suggestedCitation = (item: LibraryResearchSource) => `${item.author ? `${item.author}. ` : ""}${item.year ? `(${item.year}). ` : ""}${item.title}.${item.url ? ` ${item.url}` : ""}`;
  const updateTags = (id: string, value: string) => update(id, { tags: [...new Set(value.split(",").map(tag => tag.trim().slice(0, 40)).filter(Boolean))].slice(0, 40) });

  return <div class="library-content">
    <div class="library-heading"><div><h2>Research library</h2><p>Save sources, quotes, citations, and the notes you make from them.</p></div></div>
    <div class="library-research-layout">
      <aside class="library-panel library-research-list" aria-label="Research sources">
        <form class="library-inline-form" onSubmit={event => { event.preventDefault(); addSource(); }}><input value={newTitle()} disabled={!props.editable} maxlength="500" placeholder="Add source title" aria-label="New source title" onInput={event => setNewTitle(event.currentTarget.value)} /><button disabled={!props.editable || !newTitle().trim()}>Add source</button></form>
        <div class="library-research-source-list"><For each={props.sources.map(item => item.id)}>{id => { const item = () => props.sources.find(entry => entry.id === id)!; return <button class={source()?.id === id ? "active" : ""} onClick={() => setSelectedId(id)}><strong>{item().title}</strong><span>{[item().author, item().year].filter(Boolean).join(" · ") || "Source details not added"}</span></button>; }}</For></div>
        <Show when={!props.sources.length}><p class="library-empty-copy">Your saved references will appear here.</p></Show>
      </aside>
      <Show when={source()} fallback={<div class="library-panel library-empty-state">Select or add a research source.</div>}>
        {item => <section class="library-panel library-research-editor">
          <header class="library-research-editor-heading"><div><span class="library-eyebrow">SOURCE RECORD</span><h3>{item().title}</h3></div><div><Show when={item().url}><a href={item().url} target="_blank" rel="noreferrer">Open source ↗</a></Show><button class="library-secondary" disabled={!props.editable} onClick={() => removeSource(item().id)}>Delete</button></div></header>
          <div class="library-research-fields">
            <label class="library-field"><span>Title</span><input value={item().title} disabled={!props.editable} maxlength="500" onInput={event => update(item().id, { title: event.currentTarget.value })} /></label>
            <label class="library-field"><span>Source link</span><input type="url" value={item().url} disabled={!props.editable} maxlength="2048" placeholder="https://" onInput={event => update(item().id, { url: event.currentTarget.value })} /></label>
            <label class="library-field"><span>Author or organization</span><input value={item().author} disabled={!props.editable} maxlength="300" onInput={event => update(item().id, { author: event.currentTarget.value })} /></label>
            <label class="library-field"><span>Year</span><input value={item().year} disabled={!props.editable} maxlength="20" placeholder="2026" onInput={event => update(item().id, { year: event.currentTarget.value })} /></label>
            <label class="library-field library-research-wide"><span>Citation</span><textarea value={item().citation} disabled={!props.editable} maxlength="3000" rows="2" placeholder={suggestedCitation(item())} onInput={event => update(item().id, { citation: event.currentTarget.value })} /><small>Suggested: {suggestedCitation(item())}</small></label>
            <label class="library-field library-research-wide"><span>Quote or excerpt</span><textarea value={item().quote} disabled={!props.editable} maxlength="50000" rows="4" placeholder="Save a short passage or key finding..." onInput={event => update(item().id, { quote: event.currentTarget.value })} /></label>
            <label class="library-field library-research-wide"><span>Your notes</span><textarea value={item().notes} disabled={!props.editable} maxlength="50000" rows="5" placeholder="Why is this source useful? What do you want to verify?" onInput={event => update(item().id, { notes: event.currentTarget.value })} /></label>
            <label class="library-field library-research-wide"><span>Tags</span><input value={item().tags.join(", ")} disabled={!props.editable} placeholder="comma, separated, tags" onInput={event => updateTags(item().id, event.currentTarget.value)} /></label>
          </div>
        </section>}
      </Show>
    </div>
  </div>;
}
