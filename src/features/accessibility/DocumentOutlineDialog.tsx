import { For, Show } from "solid-js";
import type { OutlineEntry } from "./accessibility";

export type DocumentOutlineDialogProps = {
  pageName: string;
  entries: OutlineEntry[];
  selectedRoots: ReadonlySet<number>;
  onSelect: (entry: OutlineEntry) => void;
  onClose: () => void;
};

/** Keyboard-navigable list of everything on the page, in reading order, for screen-reader and keyboard users. */
export function DocumentOutlineDialog(props: DocumentOutlineDialogProps) {
  let list: HTMLUListElement | undefined;
  const move = (event: KeyboardEvent, direction: 1 | -1) => {
    const buttons = [...(list?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const at = buttons.indexOf(event.currentTarget as HTMLButtonElement);
    const next = buttons[Math.max(0, Math.min(buttons.length - 1, at + direction))];
    if (next) { event.preventDefault(); next.focus(); }
  };
  return <div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) props.onClose(); }}>
    <section class="confirm-dialog document-outline-dialog" role="dialog" aria-modal="true" aria-labelledby="document-outline-title">
      <header><div><span class="eyebrow">ACCESSIBILITY</span><h2 id="document-outline-title">Document outline</h2></div><button class="help-close" aria-label="Close document outline" onClick={props.onClose}>&times;</button></header>
      <p class="object-search-count">{props.pageName}: {props.entries.length} {props.entries.length === 1 ? "object" : "objects"} in reading order. Use the arrow keys to move and Enter to select an object on the canvas.</p>
      <Show when={props.entries.length} fallback={<p class="object-search-empty">This page has no visible objects.</p>}>
        <ul class="document-outline-list" ref={list} aria-label="Objects on this page">
          <For each={props.entries}>{(entry, position) => <li style={{ "padding-left": `${Math.min(entry.depth, 6) * 16}px` }}>
            <button type="button" autofocus={position() === 0} aria-current={props.selectedRoots.has(entry.indices[0]) ? "true" : undefined}
              onClick={() => props.onSelect(entry)}
              onKeyDown={event => { if (event.key === "ArrowDown") move(event, 1); else if (event.key === "ArrowUp") move(event, -1); else if (event.key === "Home") { event.preventDefault(); list?.querySelector("button")?.focus(); } }}>
              <span class="document-outline-role">{entry.role}</span>
              <span>{entry.name || "No label"}</span>
              <Show when={entry.element.type === "image"}><span class="document-outline-badge" classList={{ missing: !entry.hasAltText }}>{entry.hasAltText ? "alt text" : "no alt text"}</span></Show>
            </button>
          </li>}</For>
        </ul>
      </Show>
      <div><button class="quiet-button" onClick={props.onClose}>Close</button></div>
    </section>
  </div>;
}
