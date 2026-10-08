import { createEffect, createMemo, createSignal, For, Show } from "solid-js";

export type PaletteCommand = { id: string; label: string; category: string; keywords?: string; shortcut?: string; run: () => void };
type Props = { open: boolean; commands: PaletteCommand[]; onClose: () => void };
type Match = { command: PaletteCommand; id: string; score: number };

function scoreCommand(command: PaletteCommand, query: string): number | undefined {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return 0;
  const label = command.label.toLowerCase();
  const category = command.category.toLowerCase();
  const keywords = (command.keywords ?? "").toLowerCase();
  const all = `${label} ${category} ${keywords}`;
  let score = 0;
  for (const term of terms) {
    const labelAt = label.indexOf(term);
    const categoryAt = category.indexOf(term);
    const keywordsAt = keywords.indexOf(term);
    if (labelAt < 0 && categoryAt < 0 && keywordsAt < 0) return undefined;
    if (labelAt === 0) score += 12;
    else if (labelAt > 0) score += 8;
    else if (categoryAt >= 0) score += 5;
    else score += 2;
    if (all.startsWith(term)) score += 2;
  }
  return score;
}

export function CommandPalette(props: Props) {
  const [query, setQuery] = createSignal("");
  const [activeIndex, setActiveIndex] = createSignal(0);
  let input: HTMLInputElement | undefined;

  const filtered = createMemo<Match[]>(() => props.commands
    .map(command => ({ command, id: `windows-command-${command.id.replace(/[^a-z\d_-]/gi, "-")}`, score: scoreCommand(command, query()) }))
    .filter((match): match is Match => match.score !== undefined)
    .sort((left, right) => right.score - left.score || left.command.label.localeCompare(right.command.label))
    .slice(0, 50));

  createEffect(() => {
    if (!props.open) return;
    setQuery("");
    setActiveIndex(0);
    requestAnimationFrame(() => input?.focus());
  });
  createEffect(() => {
    const count = filtered().length;
    if (activeIndex() >= count) setActiveIndex(Math.max(0, count - 1));
  });

  const run = (match?: Match) => {
    if (!match) return;
    props.onClose();
    match.command.run();
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    const count = filtered().length;
    if (event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      input?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      props.onClose();
    } else if (event.key === "ArrowDown" && count) {
      event.preventDefault();
      event.stopPropagation();
      setActiveIndex(index => (index + 1) % count);
    } else if (event.key === "ArrowUp" && count) {
      event.preventDefault();
      event.stopPropagation();
      setActiveIndex(index => (index - 1 + count) % count);
    } else if (event.key === "Home" && count) {
      event.preventDefault();
      event.stopPropagation();
      setActiveIndex(0);
    } else if (event.key === "End" && count) {
      event.preventDefault();
      event.stopPropagation();
      setActiveIndex(count - 1);
    } else if (event.key === "Enter" && count) {
      event.preventDefault();
      event.stopPropagation();
      run(filtered()[activeIndex()]);
    }
  };

  return <Show when={props.open}><div class="windows-command-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) props.onClose(); }}>
    <section class="windows-command-palette" role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={handleKeyDown}>
      <div class="windows-command-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.4 4.4"/></svg><input ref={input} value={query()} onInput={event => { setQuery(event.currentTarget.value); setActiveIndex(0); }} placeholder="Search tools, actions, settings, and stencils" aria-label="Search commands" aria-controls="windows-command-list" aria-activedescendant={filtered()[activeIndex()]?.id} /><kbd>ESC</kbd></div>
      <div id="windows-command-list" class="windows-command-results" role="listbox" aria-label="Matching commands"><For each={filtered()}>{(match, index) => <button id={match.id} classList={{ active: activeIndex() === index() }} type="button" role="option" aria-selected={activeIndex() === index()} tabIndex={-1} onMouseMove={() => setActiveIndex(index())} onClick={() => run(match)}><span><small>{match.command.category}</small><strong>{match.command.label}</strong></span><kbd>{match.command.shortcut ?? "Enter"}</kbd></button>}</For>
        <Show when={!filtered().length}><p>No matching commands.</p></Show></div>
      <footer><span><kbd>↑</kbd><kbd>↓</kbd> browse</span><span><kbd>Enter</kbd> run</span><span><kbd>Esc</kbd> close</span><small>{filtered().length} actions</small></footer>
    </section>
  </div></Show>;
}
