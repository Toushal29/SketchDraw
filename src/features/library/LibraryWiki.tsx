import { For, Show, createSignal } from "solid-js";
import type { LibraryWikiArticle } from "../../model";

type Props = { articles: LibraryWikiArticle[]; editable: boolean; onChange: (articles: LibraryWikiArticle[]) => void };

function linkedTitles(content: string) {
  return [...new Set([...content.matchAll(/\[\[([^\[\]]{1,100})\]\]/g)].map(match => match[1].trim()).filter(Boolean))];
}

export function LibraryWiki(props: Props) {
  const [selectedId, setSelectedId] = createSignal(props.articles[0]?.id ?? "");
  const [newTitle, setNewTitle] = createSignal("");
  const article = () => props.articles.find(item => item.id === selectedId()) ?? props.articles[0];
  const update = (id: string, patch: Partial<LibraryWikiArticle>) => props.onChange(props.articles.map(item => item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item));
  const addArticle = () => {
    if (!props.editable || !newTitle().trim()) return;
    const now = Date.now(); const item = { id: crypto.randomUUID(), title: newTitle().trim().slice(0, 200), content: "", tags: [], createdAt: now, updatedAt: now };
    props.onChange([item, ...props.articles]); setSelectedId(item.id); setNewTitle("");
  };
  const deleteArticle = (id: string) => {
    if (!props.editable) return;
    const remaining = props.articles.filter(item => item.id !== id);
    props.onChange(remaining); setSelectedId(remaining[0]?.id ?? "");
  };
  const links = () => article() ? linkedTitles(article()!.content) : [];
  const backlinkArticles = () => article() ? props.articles.filter(item => item.id !== article()!.id && linkedTitles(item.content).some(title => title.toLocaleLowerCase() === article()!.title.toLocaleLowerCase())) : [];

  return <div class="library-content">
    <div class="library-heading"><div><h2>Personal wiki</h2><p>Connect related pages with [[double-bracket links]].</p></div></div>
    <div class="library-wiki-layout">
      <aside class="library-panel library-wiki-list" aria-label="Wiki pages">
        <form class="library-inline-form" onSubmit={event => { event.preventDefault(); addArticle(); }}><input value={newTitle()} disabled={!props.editable} maxlength="200" placeholder="New page title" aria-label="New wiki page title" onInput={event => setNewTitle(event.currentTarget.value)} /><button disabled={!props.editable || !newTitle().trim()}>Add</button></form>
        <div class="library-wiki-articles"><For each={props.articles.map(item => item.id)}>{id => { const item = () => props.articles.find(entry => entry.id === id)!; return <button class={article()?.id === id ? "active" : ""} onClick={() => setSelectedId(id)}><strong>{item().title}</strong><span>{item().content || "Empty page"}</span></button>; }}</For></div>
        <Show when={!props.articles.length}><p class="library-empty-copy">Create your first page to start linking ideas.</p></Show>
      </aside>
      <Show when={article()} fallback={<div class="library-panel library-empty-state">Select or create a wiki page.</div>}>
        {item => <section class="library-panel library-wiki-editor">
          <div class="library-wiki-title-row"><input value={item().title} disabled={!props.editable} maxlength="200" aria-label="Wiki page title" onInput={event => update(item().id, { title: event.currentTarget.value })} /><button class="library-secondary" disabled={!props.editable} onClick={() => deleteArticle(item().id)}>Delete page</button></div>
          <label class="library-field"><span>Page content <small>Link a page by writing [[its title]].</small></span><textarea value={item().content} disabled={!props.editable} maxlength="100000" placeholder="Write a reference page..." onInput={event => update(item().id, { content: event.currentTarget.value })} /></label>
          <label class="library-field"><span>Tags</span><input value={item().tags.join(", ")} disabled={!props.editable} placeholder="comma, separated, tags" onInput={event => update(item().id, { tags: [...new Set(event.currentTarget.value.split(",").map(tag => tag.trim().slice(0, 40)).filter(Boolean))].slice(0, 40) })} /></label>
          <div class="library-wiki-links"><section><strong>Links from this page</strong><div>{links().length ? links().map(title => { const target = () => props.articles.find(other => other.id !== item().id && other.title.toLocaleLowerCase() === title.toLocaleLowerCase()); return <Show when={target()} fallback={<span class="library-wiki-unresolved">{title} · page not found</span>}><button onClick={() => setSelectedId(target()!.id)}>{target()!.title}</button></Show>; }) : <span>No linked pages yet.</span>}</div></section><section><strong>Backlinks</strong><div>{backlinkArticles().length ? backlinkArticles().map(other => <button onClick={() => setSelectedId(other.id)}>{other.title}</button>) : <span>No pages link here yet.</span>}</div></section></div>
        </section>}
      </Show>
    </div>
  </div>;
}
