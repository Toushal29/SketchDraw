import { For, Show } from "solid-js";
import type { Element } from "../../model";

export type ObjectSearchResult = { pageId: string; pageName: string; index: number; item: Element; title: string };

export function ObjectSearchDialog(props: {
  query: string;
  replacement: string;
  results: ObjectSearchResult[];
  canReplace: boolean;
  onQuery(value: string): void;
  onReplacement(value: string): void;
  onSelect(result: ObjectSearchResult): void;
  onReplace(result: ObjectSearchResult): void;
  onClose(): void;
}) {
  return <div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) props.onClose(); }}>
    <section class="confirm-dialog object-search-dialog" role="dialog" aria-modal="true" aria-labelledby="object-search-title">
      <header><div><span class="eyebrow">DOCUMENT SEARCH</span><h2 id="object-search-title">Find and replace</h2></div><button class="help-close" aria-label="Close object search" onClick={props.onClose}>&times;</button></header>
      <label class="object-search-field"><span>Find in all pages</span><input class="object-search-input" autofocus type="search" value={props.query} onInput={event => props.onQuery(event.currentTarget.value)} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); event.currentTarget.parentElement?.parentElement?.querySelector<HTMLButtonElement>(".object-search-results .object-search-select")?.focus(); } if (event.key === "Enter" && props.results[0]) props.onSelect(props.results[0]); }} /></label>
      <label class="object-search-field"><span>Replace with</span><input class="object-search-input" type="text" value={props.replacement} onInput={event => props.onReplacement(event.currentTarget.value)} onKeyDown={event => { if (event.key === "Enter" && props.results[0] && props.canReplace) { event.preventDefault(); props.onReplace(props.results[0]); } }} /></label>
      <Show when={props.query.trim()} fallback={<p class="object-search-empty">Type a label, name, or text to search every page.</p>}>
        <Show when={props.results.length} fallback={<p class="object-search-empty">No objects match “{props.query}”.</p>}>
          <p class="object-search-count">{props.results.length === 100 ? "Showing first 100 matches" : `${props.results.length} matching objects`}</p>
          <ul class="object-search-results"><For each={props.results}>{result => <li>
            <button type="button" class="object-search-select" onClick={() => props.onSelect(result)}><span>{result.title}</span><small>{result.pageName} · {result.item.type}</small></button>
            <button type="button" class="object-search-replace" disabled={!props.canReplace || !!result.item.locked} aria-label={`Replace text in ${result.title} on ${result.pageName}`} onClick={() => props.onReplace(result)}>Replace</button>
          </li>}</For></ul>
        </Show>
      </Show>
      <div><button class="quiet-button" onClick={props.onClose}>Close</button></div>
    </section>
  </div>;
}
