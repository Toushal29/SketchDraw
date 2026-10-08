import { createSignal, Show } from "solid-js";
import type { PersonalLibraryData } from "../../model";
import { LibraryJournal } from "./LibraryJournal";
import { LibraryMedia } from "./LibraryMedia";
import { LibraryResearch } from "./LibraryResearch";
import { LibraryStudy } from "./LibraryStudy";
import { LibraryWiki } from "./LibraryWiki";
import { LibraryWriting } from "./LibraryWriting";
import { QuickNotepad } from "./QuickNotepad";
import "./library-workspace.css";

type Section = keyof PersonalLibraryData;
type Props = { data: PersonalLibraryData; editable: boolean; onChange: (data: PersonalLibraryData) => void };
const SECTIONS: { id: Section; label: string; description: string }[] = [
  { id: "quickNotes", label: "Notepad", description: "Fast capture" },
  { id: "studyNotes", label: "Study", description: "Notes and flashcards" },
  { id: "wikiArticles", label: "Wiki", description: "Linked reference pages" },
  { id: "journalEntries", label: "Journal", description: "Dated reflections" },
  { id: "writingDrafts", label: "Writing", description: "Long-form drafts" },
  { id: "researchSources", label: "Research", description: "Sources and citations" },
  { id: "mediaEntries", label: "Media log", description: "Reading and reviews" },
];

export function PersonalLibrary(props: Props) {
  const [section, setSection] = createSignal<Section>("quickNotes");
  const update = (patch: Partial<PersonalLibraryData>) => props.onChange({ ...props.data, ...patch });
  const counts: Record<Section, number> = {
    quickNotes: props.data.quickNotes.length,
    studyNotes: props.data.studyNotes.length + props.data.studyCards.length,
    studyCards: props.data.studyCards.length,
    wikiArticles: props.data.wikiArticles.length,
    journalEntries: props.data.journalEntries.length,
    writingDrafts: props.data.writingDrafts.length,
    researchSources: props.data.researchSources.length,
    mediaEntries: props.data.mediaEntries.length,
  };
  return <section class="library-workspace-overlay" aria-label="Personal library">
    <nav class="personal-library-tabs" role="tablist" aria-label="Library tools">{SECTIONS.map(item => <button role="tab" aria-selected={section() === item.id} class={section() === item.id ? "active" : ""} onClick={() => setSection(item.id)}><span>{item.label}</span><small>{counts[item.id]}</small></button>)}</nav>
    <main class="library-workspace-content">
      <Show when={section() === "quickNotes"}><QuickNotepad notes={props.data.quickNotes} editable={props.editable} onChange={quickNotes => update({ quickNotes })} /></Show>
      <Show when={section() === "studyNotes"}><LibraryStudy notes={props.data.studyNotes} cards={props.data.studyCards} editable={props.editable} onNotesChange={studyNotes => update({ studyNotes })} onCardsChange={studyCards => update({ studyCards })} /></Show>
      <Show when={section() === "wikiArticles"}><LibraryWiki articles={props.data.wikiArticles} editable={props.editable} onChange={wikiArticles => update({ wikiArticles })} /></Show>
      <Show when={section() === "journalEntries"}><LibraryJournal entries={props.data.journalEntries} editable={props.editable} onChange={journalEntries => update({ journalEntries })} /></Show>
      <Show when={section() === "writingDrafts"}><LibraryWriting drafts={props.data.writingDrafts} editable={props.editable} onChange={writingDrafts => update({ writingDrafts })} /></Show>
      <Show when={section() === "researchSources"}><LibraryResearch sources={props.data.researchSources} editable={props.editable} onChange={researchSources => update({ researchSources })} /></Show>
      <Show when={section() === "mediaEntries"}><LibraryMedia entries={props.data.mediaEntries} editable={props.editable} onChange={mediaEntries => update({ mediaEntries })} /></Show>
    </main>
  </section>;
}
