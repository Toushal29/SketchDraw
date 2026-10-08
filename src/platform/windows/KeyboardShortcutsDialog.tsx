import { createMemo, createSignal, For, Show } from "solid-js";
import { WINDOWS_SHORTCUTS, type WindowsShortcutId, type WindowsShortcutMap, shortcutFromEvent } from "./shortcuts";

type Props = {
  shortcuts: WindowsShortcutMap;
  onChange: (id: WindowsShortcutId, value: string) => boolean;
  onReset: () => void;
  onClose: () => void;
};

export function KeyboardShortcutsDialog(props: Props) {
  const [capturing, setCapturing] = createSignal<WindowsShortcutId>();
  const [filter, setFilter] = createSignal("");
  const [message, setMessage] = createSignal("");

  const groups = createMemo(() => {
    const query = filter().trim().toLowerCase();
    const matching = WINDOWS_SHORTCUTS.filter(item =>
      !query || `${item.label} ${item.category} ${props.shortcuts[item.id]}`.toLowerCase().includes(query),
    );
    return [...new Set(matching.map(item => item.category))].map(category => ({
      category,
      items: matching.filter(item => item.category === category),
    }));
  });

  const stopCapture = (input: HTMLInputElement) => {
    setCapturing(undefined);
    input.blur();
  };

  return <div class="confirm-backdrop windows-dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) props.onClose(); }}>
    <section class="confirm-dialog windows-shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby="windows-shortcuts-title" onKeyDown={event => { event.stopPropagation(); if (event.key === "Escape" && !capturing()) { event.preventDefault(); props.onClose(); } }}>
      <header>
        <div>
          <h2 id="windows-shortcuts-title">Customize keyboard shortcuts</h2>
          <p>Find an action, select its shortcut, then press the new key combination. Backspace clears it; Escape cancels recording.</p>
        </div>
        <button type="button" class="windows-shortcut-close" autofocus aria-label="Close shortcuts" title="Close" onClick={props.onClose}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></button>
      </header>
      <label class="windows-shortcut-filter">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.4 4.4"/></svg>
        <input type="search" value={filter()} onInput={event => setFilter(event.currentTarget.value)} placeholder="Filter actions or shortcuts" aria-label="Filter keyboard shortcuts" />
        <span>{groups().reduce((count, group) => count + group.items.length, 0)} actions</span>
      </label>
      <div class="windows-shortcut-list">
        <Show when={groups().length > 0} fallback={<p class="windows-shortcut-empty">No actions match that filter.</p>}>
          <For each={groups()}>{group => <section class="windows-shortcut-group" aria-label={`${group.category} shortcuts`}>
            <h3>{group.category}</h3>
            <For each={group.items}>{item => <label class="windows-shortcut-row">
              <span>{item.label}</span>
              <input
                classList={{ capturing: capturing() === item.id }}
                aria-label={`${item.label} shortcut`}
                title="Select, then press the shortcut keys"
                readonly
                value={capturing() === item.id ? "Press shortcut…" : props.shortcuts[item.id] || "Not assigned"}
                onFocus={() => { setMessage(""); setCapturing(item.id); }}
                onBlur={() => setCapturing(current => current === item.id ? undefined : current)}
                onKeyDown={event => {
                  if (capturing() !== item.id) return;
                  event.preventDefault();
                  event.stopPropagation();
                  if (event.key === "Escape") {
                    setMessage("Shortcut recording cancelled.");
                    stopCapture(event.currentTarget);
                    return;
                  }
                  if (event.key === "Backspace" || event.key === "Delete") {
                    const changed = props.onChange(item.id, "");
                    setMessage(changed ? `${item.label} shortcut cleared.` : "That shortcut is already assigned.");
                    stopCapture(event.currentTarget);
                    return;
                  }
                  const value = shortcutFromEvent(event);
                  if (!value || value === "Space") return;
                  const changed = props.onChange(item.id, value);
                  setMessage(changed ? `${item.label} shortcut updated.` : "That shortcut is already assigned. Choose another combination.");
                  stopCapture(event.currentTarget);
                }}
              />
            </label>}</For>
          </section>}</For>
        </Show>
      </div>
      <footer>
        <span role="status" aria-live="polite">{message() || (capturing() ? "Press the shortcut keys now." : "Choose an action to record a shortcut.")}</span>
        <button type="button" class="quiet-button" onClick={() => { props.onReset(); setCapturing(undefined); setMessage("Default shortcuts restored."); }}>Restore defaults</button>
        <button type="button" class="save-button" onClick={props.onClose}>Done</button>
      </footer>
    </section>
  </div>;
}
