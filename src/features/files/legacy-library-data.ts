import type { PersonalLibraryData, LibraryJournalEntry, LibraryMediaEntry, ProjectNote, LibraryResearchSource, LibraryStudyCard, LibraryWikiArticle, LibraryWritingDraft, LibraryWritingRevision } from "../../model";

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const validDate = (value: unknown): value is string | undefined => {
  if (value === undefined) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
};

export function createLegacyLibraryData(): PersonalLibraryData {
  return { quickNotes: [], studyNotes: [], studyCards: [], wikiArticles: [], journalEntries: [], writingDrafts: [], researchSources: [], mediaEntries: [] };
}

export function normalizeLegacyLibraryData(value: unknown, legacyProject?: unknown): PersonalLibraryData | undefined {
  const source = isRecord(value) ? value : isRecord(legacyProject) ? legacyProject : undefined;
  if (!source) return value === undefined ? createLegacyLibraryData() : undefined;
  const records = (key: string) => source[key] ?? [];
  const quickNoteValues = records("quickNotes");
  const noteValues = records("studyNotes");
  const cardValues = records("studyCards");
  const wikiValues = records("wikiArticles");
  const journalValues = records("journalEntries");
  const writingValues = records("writingDrafts");
  const researchValues = records("researchSources");
  const mediaValues = records("mediaEntries");
  if (!Array.isArray(quickNoteValues) || quickNoteValues.length > 10000 || !Array.isArray(noteValues) || noteValues.length > 2000 || !Array.isArray(cardValues) || cardValues.length > 5000 || !Array.isArray(wikiValues) || wikiValues.length > 2000 || !Array.isArray(journalValues) || journalValues.length > 10000 || !Array.isArray(writingValues) || writingValues.length > 200 || !Array.isArray(researchValues) || researchValues.length > 5000 || !Array.isArray(mediaValues) || mediaValues.length > 10000) return undefined;

  const parseNotes = (values: unknown[]): ProjectNote[] | undefined => {
    const result: ProjectNote[] = [];
    for (const item of values) {
      if (!isRecord(item) || typeof item.id !== "string" || !item.id || item.id.length > 100 || typeof item.title !== "string" || item.title.length > 200 || typeof item.content !== "string" || item.content.length > 100_000 || !finite(item.createdAt) || item.createdAt < 0 || !finite(item.updatedAt) || item.updatedAt < 0) return undefined;
      result.push({ id: item.id, title: item.title, content: item.content, createdAt: item.createdAt, updatedAt: item.updatedAt });
    }
    return new Set(result.map(item => item.id)).size === result.length ? result : undefined;
  };
  const quickNotes = parseNotes(quickNoteValues); const studyNotes = parseNotes(noteValues);
  if (!quickNotes || !studyNotes) return undefined;

  const studyCards: LibraryStudyCard[] = [];
  for (const item of cardValues) {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id || item.id.length > 100 || typeof item.front !== "string" || !item.front.trim() || item.front.length > 20_000 || typeof item.back !== "string" || !item.back.trim() || item.back.length > 20_000 || !finite(item.dueAt) || item.dueAt < 0 || !finite(item.intervalDays) || item.intervalDays < 0 || item.intervalDays > 36500 || !finite(item.easeFactor) || item.easeFactor < 1.3 || item.easeFactor > 3 || !Number.isInteger(item.repetitions) || (item.repetitions as number) < 0 || (item.lastReviewedAt !== undefined && (!finite(item.lastReviewedAt) || item.lastReviewedAt < 0)) || !finite(item.createdAt) || item.createdAt < 0 || !finite(item.updatedAt) || item.updatedAt < 0) return undefined;
    studyCards.push({ id: item.id, front: item.front, back: item.back, dueAt: item.dueAt, intervalDays: item.intervalDays, easeFactor: item.easeFactor, repetitions: item.repetitions as number, ...(finite(item.lastReviewedAt) ? { lastReviewedAt: item.lastReviewedAt } : {}), createdAt: item.createdAt, updatedAt: item.updatedAt });
  }

  const wikiArticles: LibraryWikiArticle[] = [];
  for (const item of wikiValues) {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id || item.id.length > 100 || typeof item.title !== "string" || !item.title.trim() || item.title.length > 200 || typeof item.content !== "string" || item.content.length > 100_000 || !Array.isArray(item.tags) || item.tags.length > 40 || item.tags.some(tag => typeof tag !== "string" || tag.length > 40) || !finite(item.createdAt) || item.createdAt < 0 || !finite(item.updatedAt) || item.updatedAt < 0) return undefined;
    wikiArticles.push({ id: item.id, title: item.title, content: item.content, tags: [...new Set(item.tags as string[])], createdAt: item.createdAt, updatedAt: item.updatedAt });
  }

  const journalEntries: LibraryJournalEntry[] = [];
  for (const item of journalValues) {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id || item.id.length > 100 || typeof item.date !== "string" || !validDate(item.date) || typeof item.prompt !== "string" || item.prompt.length > 1000 || !["great", "good", "neutral", "low", "difficult"].includes(String(item.mood)) || typeof item.content !== "string" || item.content.length > 100_000 || !finite(item.createdAt) || item.createdAt < 0 || !finite(item.updatedAt) || item.updatedAt < 0) return undefined;
    journalEntries.push({ id: item.id, date: item.date, prompt: item.prompt, mood: item.mood as LibraryJournalEntry["mood"], content: item.content, createdAt: item.createdAt, updatedAt: item.updatedAt });
  }

  const writingDrafts: LibraryWritingDraft[] = [];
  for (const item of writingValues) {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id || item.id.length > 100 || typeof item.title !== "string" || item.title.length > 200 || typeof item.outline !== "string" || item.outline.length > 50_000 || typeof item.content !== "string" || item.content.length > 300_000 || !Array.isArray(item.revisions) || item.revisions.length > 20 || !finite(item.createdAt) || item.createdAt < 0 || !finite(item.updatedAt) || item.updatedAt < 0) return undefined;
    const revisions: LibraryWritingRevision[] = [];
    for (const revision of item.revisions) {
      if (!isRecord(revision) || typeof revision.id !== "string" || !revision.id || revision.id.length > 100 || typeof revision.title !== "string" || revision.title.length > 200 || typeof revision.outline !== "string" || revision.outline.length > 50_000 || typeof revision.content !== "string" || revision.content.length > 300_000 || !finite(revision.createdAt) || revision.createdAt < 0) return undefined;
      revisions.push({ id: revision.id, title: revision.title, outline: revision.outline, content: revision.content, createdAt: revision.createdAt });
    }
    writingDrafts.push({ id: item.id, title: item.title, outline: item.outline, content: item.content, revisions, createdAt: item.createdAt, updatedAt: item.updatedAt });
  }

  const researchSources: LibraryResearchSource[] = [];
  for (const item of researchValues) {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id || item.id.length > 100 || typeof item.title !== "string" || !item.title.trim() || item.title.length > 500 || typeof item.url !== "string" || item.url.length > 2048 || (item.url !== "" && !/^https?:\/\//i.test(item.url)) || typeof item.author !== "string" || item.author.length > 300 || typeof item.year !== "string" || item.year.length > 20 || typeof item.citation !== "string" || item.citation.length > 3000 || typeof item.quote !== "string" || item.quote.length > 50_000 || typeof item.notes !== "string" || item.notes.length > 50_000 || !Array.isArray(item.tags) || item.tags.length > 40 || item.tags.some(tag => typeof tag !== "string" || tag.length > 40) || !finite(item.createdAt) || item.createdAt < 0 || !finite(item.updatedAt) || item.updatedAt < 0) return undefined;
    researchSources.push({ id: item.id, title: item.title, url: item.url, author: item.author, year: item.year, citation: item.citation, quote: item.quote, notes: item.notes, tags: [...new Set(item.tags as string[])], createdAt: item.createdAt, updatedAt: item.updatedAt });
  }

  const mediaEntries: LibraryMediaEntry[] = [];
  for (const item of mediaValues) {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id || item.id.length > 100 || typeof item.title !== "string" || !item.title.trim() || item.title.length > 500 || !["book", "film", "game", "podcast", "article", "other"].includes(String(item.kind)) || !["want", "inProgress", "complete"].includes(String(item.status)) || (item.rating !== undefined && (!Number.isInteger(item.rating) || (item.rating as number) < 1 || (item.rating as number) > 5)) || typeof item.notes !== "string" || item.notes.length > 20_000 || !validDate(item.startedAt) || !validDate(item.completedAt) || !finite(item.createdAt) || item.createdAt < 0 || !finite(item.updatedAt) || item.updatedAt < 0) return undefined;
    mediaEntries.push({ id: item.id, title: item.title, kind: item.kind as LibraryMediaEntry["kind"], status: item.status as LibraryMediaEntry["status"], ...(typeof item.rating === "number" ? { rating: item.rating } : {}), notes: item.notes, ...(typeof item.startedAt === "string" ? { startedAt: item.startedAt } : {}), ...(typeof item.completedAt === "string" ? { completedAt: item.completedAt } : {}), createdAt: item.createdAt, updatedAt: item.updatedAt });
  }

  const hasUniqueIds = (items: { id: string }[]) => new Set(items.map(item => item.id)).size === items.length;
  if (!hasUniqueIds(studyCards) || !hasUniqueIds(wikiArticles) || !hasUniqueIds(journalEntries) || !hasUniqueIds(writingDrafts) || !hasUniqueIds(researchSources) || !hasUniqueIds(mediaEntries)) return undefined;
  return { quickNotes, studyNotes, studyCards, wikiArticles, journalEntries, writingDrafts, researchSources, mediaEntries };
}

