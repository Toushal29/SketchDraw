import { For, Show, createSignal } from "solid-js";
import type { LibraryMediaEntry, LibraryMediaKind, LibraryMediaStatus } from "../../model";

type Props = { entries: LibraryMediaEntry[]; editable: boolean; onChange: (entries: LibraryMediaEntry[]) => void };
const KINDS: { value: LibraryMediaKind; label: string }[] = [{ value: "book", label: "Book" }, { value: "film", label: "Film or show" }, { value: "game", label: "Game" }, { value: "podcast", label: "Podcast" }, { value: "article", label: "Article" }, { value: "other", label: "Other" }];
const STATUSES: { value: LibraryMediaStatus; label: string }[] = [{ value: "want", label: "Want to try" }, { value: "inProgress", label: "In progress" }, { value: "complete", label: "Finished" }];
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function LibraryMedia(props: Props) {
  const [title, setTitle] = createSignal("");
  const [kind, setKind] = createSignal<LibraryMediaKind>("book");
  const [filter, setFilter] = createSignal<LibraryMediaStatus | "all">("all");
  const addEntry = (event: SubmitEvent) => {
    event.preventDefault(); if (!props.editable || !title().trim()) return;
    const now = Date.now(); const entry: LibraryMediaEntry = { id: crypto.randomUUID(), title: title().trim().slice(0, 500), kind: kind(), status: "want", notes: "", createdAt: now, updatedAt: now };
    props.onChange([entry, ...props.entries]); setTitle("");
  };
  const update = (id: string, patch: Partial<LibraryMediaEntry>) => props.onChange(props.entries.map(item => item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item));
  const updateStatus = (item: LibraryMediaEntry, status: LibraryMediaStatus) => {
    const today = localDate();
    update(item.id, { status, ...(status === "inProgress" ? { startedAt: item.startedAt ?? today } : {}), ...(status === "complete" ? { completedAt: today, startedAt: item.startedAt ?? today } : {}), ...(status !== "complete" ? { completedAt: undefined } : {}) });
  };
  const remove = (id: string) => props.onChange(props.entries.filter(item => item.id !== id));
  const visible = () => props.entries.filter(item => filter() === "all" || item.status === filter());

  return <div class="library-content">
    <div class="library-heading"><div><h2>Reading and media log</h2><p>Keep a personal list of what you want to explore and what you have finished.</p></div></div>
    <form class="library-inline-form library-media-add-form" onSubmit={addEntry}><input value={title()} disabled={!props.editable} maxlength="500" placeholder="Title of a book, film, game, or podcast" aria-label="Media title" onInput={event => setTitle(event.currentTarget.value)} /><select aria-label="Media type" disabled={!props.editable} value={kind()} onChange={event => setKind(event.currentTarget.value as LibraryMediaKind)}>{KINDS.map(option => <option value={option.value}>{option.label}</option>)}</select><button class="library-primary" disabled={!props.editable || !title().trim()}>Add to log</button></form>
    <div class="library-media-toolbar"><div class="library-media-filter" role="group" aria-label="Filter log">{[{ value: "all", label: "All" }, ...STATUSES].map(option => <button class={filter() === option.value ? "active" : ""} aria-pressed={filter() === option.value} onClick={() => setFilter(option.value as LibraryMediaStatus | "all")}>{option.label}</button>)}</div><span>{props.entries.filter(item => item.status === "complete").length} finished · {props.entries.length} total</span></div>
    <Show when={visible().length} fallback={<div class="library-panel library-empty-state">{props.entries.length ? "Nothing in this view yet." : "Add a book, film, game, podcast, or article to start your log."}</div>}>
      <div class="library-media-grid"><For each={visible()}>{item => <article class="library-panel library-media-card">
        <header><div><span class={`library-media-kind kind-${item.kind}`}>{KINDS.find(option => option.value === item.kind)?.label}</span><h3>{item.title}</h3></div><button class="library-secondary" disabled={!props.editable} aria-label={`Remove ${item.title}`} onClick={() => remove(item.id)}>Delete</button></header>
        <label class="library-field"><span>Status</span><select disabled={!props.editable} value={item.status} onChange={event => updateStatus(item, event.currentTarget.value as LibraryMediaStatus)}>{STATUSES.map(option => <option value={option.value}>{option.label}</option>)}</select></label>
        <div class="library-media-dates"><label class="library-field"><span>Started</span><input type="date" disabled={!props.editable} value={item.startedAt ?? ""} onInput={event => update(item.id, { startedAt: event.currentTarget.value || undefined })} /></label><label class="library-field"><span>Finished</span><input type="date" disabled={!props.editable} value={item.completedAt ?? ""} onInput={event => update(item.id, { completedAt: event.currentTarget.value || undefined })} /></label></div>
        <label class="library-field"><span>Rating</span><select disabled={!props.editable} value={item.rating ?? ""} onChange={event => update(item.id, { rating: event.currentTarget.value ? Number(event.currentTarget.value) : undefined })}><option value="">Not rated</option>{[1, 2, 3, 4, 5].map(value => <option value={value}>{"★".repeat(value)} ({value}/5)</option>)}</select></label>
        <label class="library-field"><span>Notes</span><textarea disabled={!props.editable} maxlength="20000" rows="3" value={item.notes} placeholder="Add a review or a note..." onInput={event => update(item.id, { notes: event.currentTarget.value })} /></label>
      </article>}</For></div>
    </Show>
  </div>;
}
