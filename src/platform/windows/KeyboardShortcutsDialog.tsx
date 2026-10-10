import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { WINDOWS_SHORTCUTS, type WindowsShortcutId, type WindowsShortcutMap, type WindowsShortcutSlot, displayShortcut, formatShortcutBindings, shortcutFromEvent, shortcutFromMouseEvent } from "./shortcuts";

type Props = {
  shortcuts: WindowsShortcutMap;
  onChange: (id: WindowsShortcutId, slot: WindowsShortcutSlot, value: string) => boolean;
  onReset: () => void;
  onClose: () => void;
};

type CaptureTarget = { id: WindowsShortcutId; slot: WindowsShortcutSlot };

export function KeyboardShortcutsDialog(props: Props) {
  const [capturing, setCapturing] = createSignal<CaptureTarget>();
  const [filter, setFilter] = createSignal("");
  const [message, setMessage] = createSignal("");

  let lastCapturedMouse: { binding: string; at: number } | undefined;
  const stopCapture = (input: HTMLInputElement) => {
    setCapturing(undefined);
    input.blur();
  };

  const finishMouseCapture = (event: MouseEvent) => {
    const target = capturing();
    if (!target) return;
    const value = shortcutFromMouseEvent(event);
    if (!value) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    lastCapturedMouse = { binding: value, at: Date.now() };
    const changed = props.onChange(target.id, target.slot, value);
    const label = WINDOWS_SHORTCUTS.find(item => item.id === target.id)?.label ?? "Action";
    setMessage(changed ? `${label} shortcut updated.` : "That shortcut is already assigned. Choose another combination.");
    const input = document.activeElement;
    if (input instanceof HTMLInputElement) stopCapture(input);
    else setCapturing(undefined);
  };

  onMount(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") finishMouseCapture(event);
    };
    const onAuxClick = (event: MouseEvent) => {
      const binding = shortcutFromMouseEvent(event);
      if (binding && lastCapturedMouse?.binding === binding && Date.now() - lastCapturedMouse.at < 750) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      finishMouseCapture(event);
    };
    const onContextMenu = (event: MouseEvent) => {
      const binding = shortcutFromMouseEvent(event);
      const justCaptured = binding && lastCapturedMouse?.binding === binding && Date.now() - lastCapturedMouse.at < 750;
      if (binding && (capturing() || justCaptured)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("auxclick", onAuxClick, true);
    window.addEventListener("contextmenu", onContextMenu, true);
    onCleanup(() => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("auxclick", onAuxClick, true);
      window.removeEventListener("contextmenu", onContextMenu, true);
    });
  });

  const groups = createMemo(() => {
    const query = filter().trim().toLowerCase();
    const matching = WINDOWS_SHORTCUTS.filter(item =>
      !query || `${item.label} ${item.category} ${formatShortcutBindings(props.shortcuts[item.id])}`.toLowerCase().includes(query),
    );
    return [...new Set(matching.map(item => item.category))].map(category => ({
      category,
      items: matching.filter(item => item.category === category),
    }));
  });

  const captureValue = (id: WindowsShortcutId, slot: WindowsShortcutSlot, input: HTMLInputElement, event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setMessage("Shortcut recording cancelled.");
      stopCapture(input);
      return;
    }
    const label = WINDOWS_SHORTCUTS.find(item => item.id === id)?.label ?? "Action";
    if (event.key === "Backspace" || event.key === "Delete") {
      const changed = props.onChange(id, slot, "");
      setMessage(changed ? `${label} shortcut cleared.` : "That shortcut is already assigned.");
      stopCapture(input);
      return;
    }
    const value = shortcutFromEvent(event);
    if (!value || value === "Space") return;
    const changed = props.onChange(id, slot, value);
    setMessage(changed ? `${label} shortcut updated.` : "That shortcut is already assigned. Choose another combination.");
    stopCapture(input);
  };

  const renderBindingInput = (id: WindowsShortcutId, slot: WindowsShortcutSlot, label: string) => {
    const active = () => capturing()?.id === id && capturing()?.slot === slot;
    return <input
      classList={{ capturing: active() }}
      aria-label={`${label} ${slot === 0 ? "shortcut" : "additional shortcut"}`}
      title="Select, then press a keyboard combination or mouse button"
      readonly
      value={active() ? "Press shortcut..." : displayShortcut(props.shortcuts[id][slot] || "Not assigned")}
      onFocus={() => { setMessage(""); setCapturing({ id, slot }); }}
      onBlur={() => setCapturing(current => current?.id === id && current.slot === slot ? undefined : current)}
      onKeyDown={event => { if (active()) captureValue(id, slot, event.currentTarget, event); }}
    />;
  };

  return <div class="confirm-backdrop windows-dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) props.onClose(); }}>
    <section class="confirm-dialog windows-shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby="windows-shortcuts-title" onKeyDown={event => { event.stopPropagation(); if (event.key === "Escape" && !capturing()) { event.preventDefault(); props.onClose(); } }}>
      <header>
        <div>
          <h2 id="windows-shortcuts-title">Customize shortcuts</h2>
          <p>Each action can have a keyboard shortcut and an additional shortcut. Select a field, then press a key combination or mouse button. Backspace clears it; Escape cancels recording.</p>
        </div>
        <button type="button" class="windows-shortcut-close" autofocus aria-label="Close shortcuts" title="Close" onClick={props.onClose}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></button>
      </header>
      <label class="windows-shortcut-filter">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.4 4.4"/></svg>
        <input type="search" value={filter()} onInput={event => setFilter(event.currentTarget.value)} placeholder="Filter actions or shortcuts" aria-label="Filter shortcuts" />
        <span>{groups().reduce((count, group) => count + group.items.length, 0)} actions</span>
      </label>
      <div class="windows-shortcut-list">
        <div class="windows-shortcut-columns" aria-hidden="true"><span>Action</span><span>Shortcut</span><span>Additional shortcut</span></div>
        <Show when={groups().length > 0} fallback={<p class="windows-shortcut-empty">No actions match that filter.</p>}>
          <For each={groups()}>{group => <section class="windows-shortcut-group" aria-label={`${group.category} shortcuts`}>
            <h3>{group.category}</h3>
            <For each={group.items}>{item => <div class="windows-shortcut-row">
              <span class="windows-shortcut-action">{item.label}</span>
              {renderBindingInput(item.id, 0, item.label)}
              {renderBindingInput(item.id, 1, item.label)}
            </div>}</For>
          </section>}</For>
        </Show>
      </div>
      <footer>
        <span role="status" aria-live="polite">{message() || (capturing() ? "Press shortcut keys or a mouse button. Thumb buttons 4 and 5 are supported." : "Choose a field to record a shortcut.")}</span>
        <button type="button" class="quiet-button" onClick={() => { props.onReset(); setCapturing(undefined); setMessage("Default shortcuts restored."); }}>Restore defaults</button>
        <button type="button" class="save-button" onClick={props.onClose}>Done</button>
      </footer>
    </section>
  </div>;
}
