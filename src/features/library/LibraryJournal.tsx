import { For, Show, createSignal } from "solid-js";
import type { LibraryJournalEntry, LibraryJournalMood } from "../../model";

type Props = { entries: LibraryJournalEntry[]; editable: boolean; onChange: (entries: LibraryJournalEntry[]) => void };
const PROMPTS = ["What felt meaningful today?", "What did you learn or notice?", "What would you like to let go of?", "What are you grateful for right now?", "What do you want tomorrow to feel like?"];
const MOODS: { value: LibraryJournalMood; label: string }[] = [{ value: "great", label: "Great" }, { value: "good", label: "Good" }, { value: "neutral", label: "Neutral" }, { value: "low", label: "Low" }, { value: "difficult", label: "Difficult" }];
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function LibraryJournal(props: Props) {
  const [selectedId, setSelectedId] = createSignal(props.entries[0]?.id ?? "");
  const [entryDate, setEntryDate] = createSignal(localDate());
  const [promptIndex, setPromptIndex] = createSignal(0);
  const [newPrompt, setNewPrompt] = createSignal("");
  const [newMood, setNewMood] = createSignal<LibraryJournalMood>("neutral");
  const [newContent, setNewContent] = createSignal("");
  const selected = () => props.entries.find(item => item.id === selectedId()) ?? props.entries[0];
  const update = (id: string, patch: Partial<LibraryJournalEntry>) => props.onChange(props.entries.map(item => item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item));
  const addEntry = (event: SubmitEvent) => {
    event.preventDefault();
    if (!props.editable) return;
    const now = Date.now();
    const entry: LibraryJournalEntry = { id: crypto.randomUUID(), date: entryDate(), prompt: newPrompt().slice(0, 1000), mood: newMood(), content: newContent().slice(0, 100_000), createdAt: now, updatedAt: now };
    props.onChange([entry, ...props.entries]); setSelectedId(entry.id); setNewContent(""); setNewPrompt("");
  };
  const removeEntry = (id: string) => {
    if (!props.editable) return;
    const remaining = props.entries.filter(item => item.id !== id); props.onChange(remaining); setSelectedId(remaining[0]?.id ?? "");
  };

  return <div class="library-content">
    <div class="library-heading"><div><h2>Private journal</h2><p>Keep dated reflections, prompts, and mood notes in this sketch file.</p></div></div>
    <div class="library-journal-layout">
      <section class="library-panel library-journal-new">
        <header class="library-panel-heading"><div><span class="library-eyebrow">NEW ENTRY</span><h3>Make a journal entry</h3></div></header>
        <form class="library-form" onSubmit={addEntry}>
          <label>Date<input type="date" value={entryDate()} disabled={!props.editable} onInput={event => setEntryDate(event.currentTarget.value)} /></label>
          <label>Prompt<div class="library-journal-prompt-row"><input value={newPrompt()} disabled={!props.editable} maxlength="1000" placeholder="Write your own prompt or choose one" onInput={event => setNewPrompt(event.currentTarget.value)} /><button type="button" class="library-secondary" disabled={!props.editable} onClick={() => { setNewPrompt(PROMPTS[promptIndex() % PROMPTS.length]); setPromptIndex(index => index + 1); }}>Prompt me</button></div></label>
          <label>Mood<select value={newMood()} disabled={!props.editable} onChange={event => setNewMood(event.currentTarget.value as LibraryJournalMood)}>{MOODS.map(mood => <option value={mood.value}>{mood.label}</option>)}</select></label>
          <label>Entry<textarea value={newContent()} disabled={!props.editable} maxlength="100000" rows="7" placeholder="Write freely..." onInput={event => setNewContent(event.currentTarget.value)} /></label>
          <button class="library-primary" disabled={!props.editable}>Save entry</button>
        </form>
      </section>
      <section class="library-panel library-journal-archive">
        <header class="library-panel-heading"><div><span class="library-eyebrow">YOUR JOURNAL</span><h3>Past entries</h3></div><span class="library-count">{props.entries.length}</span></header>
        <Show when={props.entries.length} fallback={<div class="library-empty-state">Saved entries will appear here.</div>}>
          <div class="library-journal-entry-list"><For each={[...props.entries].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt).map(item => item.id)}>{id => { const item = () => props.entries.find(entry => entry.id === id)!; return <button class={selected()?.id === id ? "active" : ""} onClick={() => setSelectedId(id)}><time>{new Date(`${item().date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time><span class={`library-journal-mood mood-${item().mood}`}>{MOODS.find(mood => mood.value === item().mood)?.label}</span><strong>{item().prompt || "Journal entry"}</strong></button>; }}</For></div>
        </Show>
      </section>
      <Show when={selected()}>{item => <article class="library-panel library-journal-editor"><header class="library-panel-heading"><div><span class="library-eyebrow">{MOODS.find(mood => mood.value === item().mood)?.label.toUpperCase()} DAY</span><h3>{new Date(`${item().date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h3></div><button class="library-secondary" disabled={!props.editable} onClick={() => removeEntry(item().id)}>Delete</button></header><input type="date" aria-label="Entry date" value={item().date} disabled={!props.editable} onInput={event => update(item().id, { date: event.currentTarget.value })} /><input aria-label="Journal prompt" value={item().prompt} disabled={!props.editable} maxlength="1000" placeholder="Add a prompt" onInput={event => update(item().id, { prompt: event.currentTarget.value })} /><div class="library-journal-mood-options" role="group" aria-label="Mood"><For each={MOODS}>{mood => <button class={item().mood === mood.value ? `active mood-${mood.value}` : ""} aria-pressed={item().mood === mood.value} disabled={!props.editable} onClick={() => update(item().id, { mood: mood.value })}>{mood.label}</button>}</For></div><textarea aria-label="Journal entry" value={item().content} disabled={!props.editable} maxlength="100000" placeholder="Write freely..." onInput={event => update(item().id, { content: event.currentTarget.value })} /></article>}</Show>
    </div>
  </div>;
}
