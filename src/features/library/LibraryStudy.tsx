import { For, Show, createSignal } from "solid-js";
import type { ProjectNote, LibraryStudyCard } from "../../model";

type Props = {
  notes: ProjectNote[];
  cards: LibraryStudyCard[];
  editable: boolean;
  onNotesChange: (notes: ProjectNote[]) => void;
  onCardsChange: (cards: LibraryStudyCard[]) => void;
};

const DAY = 24 * 60 * 60 * 1000;

export function LibraryStudy(props: Props) {
  const [selectedNoteId, setSelectedNoteId] = createSignal(props.notes[0]?.id ?? "");
  const [noteTitle, setNoteTitle] = createSignal("");
  const [noteContent, setNoteContent] = createSignal("");
  const [front, setFront] = createSignal("");
  const [back, setBack] = createSignal("");
  const [revealed, setRevealed] = createSignal(false);
  const selectedNote = () => props.notes.find(note => note.id === selectedNoteId()) ?? props.notes[0];
  const dueCards = () => props.cards.filter(card => card.dueAt <= Date.now()).sort((a, b) => a.dueAt - b.dueAt);
  const reviewCard = () => dueCards()[0];

  const addNote = (event: SubmitEvent) => {
    event.preventDefault();
    if (!props.editable || !noteTitle().trim()) return;
    const now = Date.now();
    const note = { id: crypto.randomUUID(), title: noteTitle().trim().slice(0, 200), content: noteContent().slice(0, 100_000), createdAt: now, updatedAt: now };
    props.onNotesChange([note, ...props.notes]);
    setSelectedNoteId(note.id);
    setNoteTitle(""); setNoteContent("");
  };
  const updateNote = (id: string, patch: Partial<ProjectNote>) => props.onNotesChange(props.notes.map(note => note.id === id ? { ...note, ...patch, updatedAt: Date.now() } : note));
  const addCard = (event: SubmitEvent) => {
    event.preventDefault();
    if (!props.editable || !front().trim() || !back().trim()) return;
    const now = Date.now();
    props.onCardsChange([{ id: crypto.randomUUID(), front: front().trim().slice(0, 20_000), back: back().trim().slice(0, 20_000), dueAt: now, intervalDays: 0, easeFactor: 2.5, repetitions: 0, createdAt: now, updatedAt: now }, ...props.cards]);
    setFront(""); setBack(""); setRevealed(false);
  };
  const rateCard = (rating: "again" | "hard" | "good" | "easy") => {
    const card = reviewCard();
    if (!card || !props.editable) return;
    const now = Date.now();
    const ease = rating === "again" ? Math.max(1.3, card.easeFactor - .2) : rating === "hard" ? Math.max(1.3, card.easeFactor - .15) : rating === "easy" ? Math.min(3, card.easeFactor + .15) : card.easeFactor;
    const intervalDays = rating === "again" ? 10 / 1440 : rating === "hard" ? Math.max(1, card.intervalDays * 1.2) : rating === "good" ? (card.repetitions === 0 ? 1 : Math.max(1, card.intervalDays * ease)) : (card.repetitions === 0 ? 4 : Math.max(2, card.intervalDays * ease * 1.3));
    props.onCardsChange(props.cards.map(item => item.id === card.id ? { ...item, easeFactor: ease, intervalDays, repetitions: rating === "again" ? 0 : item.repetitions + 1, dueAt: now + intervalDays * DAY, lastReviewedAt: now, updatedAt: now } : item));
    setRevealed(false);
  };

  return <div class="library-content library-study-content">
    <div class="library-heading"><div><h2>Study workspace</h2><p>Keep learning notes and review flashcards when they come due.</p></div></div>
    <div class="library-study-grid">
      <section class="library-panel">
        <header class="library-panel-heading"><div><span class="library-eyebrow">REFERENCE NOTES</span><h3>Study notes</h3></div><span class="library-count">{props.notes.length}</span></header>
        <Show when={props.notes.length > 0}>
          <div class="library-study-note-list"><For each={props.notes.map(note => note.id)}>{id => { const note = () => props.notes.find(item => item.id === id)!; return <button class={selectedNote()?.id === id ? "active" : ""} onClick={() => setSelectedNoteId(id)}><strong>{note().title || "Untitled note"}</strong><span>{note().content || "No note content"}</span></button>; }}</For></div>
        </Show>
        <Show when={selectedNote()} fallback={<div class="library-study-note-empty">Select a note or add one to get started.</div>}>
          {note => <div class="library-study-note-editor"><input aria-label="Study note title" value={note().title} disabled={!props.editable} maxlength="200" onInput={event => updateNote(note().id, { title: event.currentTarget.value })} /><textarea aria-label="Study note content" value={note().content} disabled={!props.editable} maxlength="100000" placeholder="Write a study note..." onInput={event => updateNote(note().id, { content: event.currentTarget.value })} /><button class="library-secondary" disabled={!props.editable} onClick={() => { const remaining = props.notes.filter(item => item.id !== note().id); props.onNotesChange(remaining); setSelectedNoteId(remaining[0]?.id ?? ""); }}>Delete note</button></div>}
        </Show>
        <details class="library-study-add-note"><summary>Add a study note</summary><form class="library-form library-study-note-form" onSubmit={addNote}><label>Note title<input value={noteTitle()} disabled={!props.editable} maxlength="200" placeholder="e.g. Cell structure" onInput={event => setNoteTitle(event.currentTarget.value)} /></label><label>Notes<textarea value={noteContent()} disabled={!props.editable} maxlength="100000" rows="4" placeholder="Write a study note..." onInput={event => setNoteContent(event.currentTarget.value)} /></label><button disabled={!props.editable || !noteTitle().trim()}>Save study note</button></form></details>
      </section>

      <section class="library-panel">
        <header class="library-panel-heading"><div><span class="library-eyebrow">SPACED REPETITION</span><h3>Flashcards</h3></div><span class="library-count">{props.cards.length} cards</span></header>
        <Show when={reviewCard()} fallback={<div class="library-study-review-empty"><strong>{props.cards.length ? "You're caught up" : "Start a flashcard deck"}</strong><span>{props.cards.length ? `${props.cards.length} cards saved for future review.` : "Add a question and answer below. New cards are ready to review right away."}</span></div>}>
          {card => <div class="library-study-review"><span class="library-study-due-label">{dueCards().length} due to review</span><div class="library-study-flashcard"><span>{revealed() ? "ANSWER" : "QUESTION"}</span><p>{revealed() ? card().back : card().front}</p></div><Show when={!revealed()} fallback={<div class="library-study-ratings"><button onClick={() => rateCard("again")}>Again</button><button onClick={() => rateCard("hard")}>Hard</button><button onClick={() => rateCard("good")}>Good</button><button onClick={() => rateCard("easy")}>Easy</button></div>}><button class="library-primary" onClick={() => setRevealed(true)}>Show answer</button></Show></div>}
        </Show>
        <form class="library-form library-study-card-form" onSubmit={addCard}><label>Question<input value={front()} disabled={!props.editable} maxlength="20000" placeholder="What do you want to remember?" onInput={event => setFront(event.currentTarget.value)} /></label><label>Answer<textarea value={back()} disabled={!props.editable} maxlength="20000" rows="2" placeholder="Write the answer..." onInput={event => setBack(event.currentTarget.value)} /></label><button disabled={!props.editable || !front().trim() || !back().trim()}>Add flashcard</button></form>
      </section>
    </div>
  </div>;
}
