import { createSignal, For, Show, onMount } from "solid-js";
import { readClipboard, removeFromClipboard, clearClipboard, clipboardEntryLabel, type ClipboardEntry } from "../features/canvas/infinite-clipboard";
import type { Element } from "../model";

type Props = {
  onPaste: (elements: Element[]) => void;
  onClose: () => void;
};

export function InfiniteClipboardTray(props: Props) {
  const [entries, setEntries] = createSignal<ClipboardEntry[]>([]);

  onMount(() => setEntries(readClipboard()));

  function handlePaste(entry: ClipboardEntry) {
    props.onPaste(entry.elements);
  }

  function handleRemove(id: string) {
    removeFromClipboard(id);
    setEntries(readClipboard());
  }

  function handleClear() {
    clearClipboard();
    setEntries([]);
  }

  return <aside class="clipboard-tray" aria-label="Infinite clipboard">
    <header>
      <strong>Clipboard</strong>
      <div class="clipboard-tray-actions">
        <Show when={entries().length}>
          <button type="button" class="clipboard-clear" onClick={handleClear} title="Clear all">Clear</button>
        </Show>
        <button type="button" aria-label="Close" onClick={props.onClose}>×</button>
      </div>
    </header>
    <div class="clipboard-tray-list">
      <Show when={!entries().length}>
        <p class="clipboard-empty">Copy elements to see them here. Items persist across files.</p>
      </Show>
      <For each={entries()}>{entry =>
        <div class="clipboard-entry">
          <button type="button" class="clipboard-entry-paste" onClick={() => handlePaste(entry)}>
            <span class="clipboard-entry-count">{entry.elements.length}</span>
            <span class="clipboard-entry-label">{clipboardEntryLabel(entry)}</span>
          </button>
          <button type="button" class="clipboard-entry-remove" onClick={() => handleRemove(entry.id)} title="Remove">×</button>
        </div>
      }</For>
    </div>
  </aside>;
}
