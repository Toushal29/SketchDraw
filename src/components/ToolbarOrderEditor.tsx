import { createSignal, For, Show } from "solid-js";
import type { ToolbarItem } from "../model";

export type ToolbarOrderItem = { value: ToolbarItem; label: string };
export type ToolbarZone = "toolbar" | "more";

type Props = {
  toolbarItems: ToolbarOrderItem[];
  moreItems: ToolbarOrderItem[];
  onMove: (tool: ToolbarItem, zone: ToolbarZone, before?: ToolbarItem) => void;
  onReorder: (zone: ToolbarZone, from: ToolbarItem, to: ToolbarItem) => void;
  onReset: () => void;
  onClose: () => void;
};

type DragState = { value: ToolbarItem; source: ToolbarZone; pointerId: number; startX: number; startY: number; active: boolean };

export function ToolbarOrderEditor(props: Props) {
  const [drag, setDrag] = createSignal<DragState>();
  const [dropTarget, setDropTarget] = createSignal<{ zone: ToolbarZone; value?: ToolbarItem }>();
  const clearDrag = () => { setDrag(undefined); setDropTarget(undefined); };
  const locateDropTarget = (x: number, y: number) => {
    const target = document.elementFromPoint(x, y);
    const item = target?.closest<HTMLElement>("[data-toolbar-item]");
    const zoneElement = item?.closest<HTMLElement>("[data-toolbar-zone]") ?? target?.closest<HTMLElement>("[data-toolbar-zone]");
    const zone = zoneElement?.dataset.toolbarZone as ToolbarZone | undefined;
    return zone ? { zone, value: item?.dataset.toolbarItem as ToolbarItem | undefined } : undefined;
  };
  const moveDrag = (event: PointerEvent) => {
    const current = drag();
    if (!current || current.pointerId !== event.pointerId) return;
    const active = current.active || Math.hypot(event.clientX - current.startX, event.clientY - current.startY) >= 7;
    if (!active) return;
    event.preventDefault();
    if (!current.active) setDrag({ ...current, active: true });
    setDropTarget(locateDropTarget(event.clientX, event.clientY));
  };
  const finishDrag = (event: PointerEvent) => {
    const current = drag();
    if (!current || current.pointerId !== event.pointerId) return clearDrag();
    if (current.active) {
      const destination = locateDropTarget(event.clientX, event.clientY);
      if (destination) {
        if (destination.zone === current.source) {
          if (destination.value && destination.value !== current.value) props.onReorder(current.source, current.value, destination.value);
          else if (!destination.value) {
            props.onMove(current.value, current.source);
          }
        } else props.onMove(current.value, destination.zone, destination.value);
      }
    }
    clearDrag();
  };

  const renderZone = (zone: ToolbarZone, title: string, items: ToolbarOrderItem[]) => <section
    class="toolbar-organizer-zone"
    data-toolbar-zone={zone}
    classList={{ "toolbar-organizer-drop-target": dropTarget()?.zone === zone && dropTarget()?.value === undefined }}
  >
    <header><strong>{title}</strong><span>{items.length}</span></header>
    <ol aria-label={title}>
      <For each={items}>{(item, index) => <li
        data-toolbar-item={item.value}
        classList={{ "toolbar-order-dragging": drag()?.active && drag()?.value === item.value, "toolbar-order-drop-target": dropTarget()?.zone === zone && dropTarget()?.value === item.value && drag()?.value !== item.value }}
        onPointerDown={event => {
          if (!(event.target as HTMLElement).closest(".toolbar-organizer-grip") || event.button !== 0) return;
          event.preventDefault();
          setDrag({ value: item.value, source: zone, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false });
          try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* The pointer may be canceled before capture. */ }
        }}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={clearDrag}
      >
        <span class="toolbar-organizer-grip" aria-label={`Drag ${item.label}`} title={`Drag ${item.label}`} role="button" tabindex="0" onKeyDown={event => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          const target = items[index() + (event.key === "ArrowUp" ? -1 : 1)];
          if (target) props.onReorder(zone, event.key === "ArrowUp" ? item.value : target.value, event.key === "ArrowUp" ? target.value : item.value);
        }}>⠿</span>
        <span class="toolbar-order-label">{item.label}</span>
        <div class="toolbar-organizer-row-actions">
          <button type="button" aria-label={`Move ${item.label} up`} title="Move up" disabled={index() === 0} onClick={() => { const previous = items[index() - 1]; if (previous) props.onReorder(zone, item.value, previous.value); }}>↑</button>
          <button type="button" aria-label={`Move ${item.label} down`} title="Move down" disabled={index() === items.length - 1} onClick={() => { const next = items[index() + 1]; if (next) props.onReorder(zone, next.value, item.value); }}>↓</button>
          <button type="button" class="toolbar-organizer-transfer" aria-label={`Move ${item.label} to ${zone === "toolbar" ? "More Tools" : "toolbar"}`} title={`Move to ${zone === "toolbar" ? "More Tools" : "toolbar"}`} onClick={() => props.onMove(item.value, zone === "toolbar" ? "more" : "toolbar")}>{zone === "toolbar" ? "›" : "‹"}</button>
        </div>
      </li>}</For>
      <Show when={!items.length}><li class="toolbar-organizer-empty">Empty</li></Show>
    </ol>
  </section>;

  return <div class="toolbar-organizer-backdrop" role="presentation" onPointerDown={event => { if (event.target === event.currentTarget) props.onClose(); }}>
    <section class="toolbar-order-editor" role="dialog" aria-modal="true" aria-labelledby="toolbar-organizer-title">
      <header class="toolbar-organizer-heading"><strong id="toolbar-organizer-title">Customize tools</strong><button type="button" aria-label="Close toolbar organizer" onClick={props.onClose}>×</button></header>
      <div class="toolbar-organizer-columns">{renderZone("toolbar", "Toolbar", props.toolbarItems)}{renderZone("more", "More Tools", props.moreItems)}</div>
      <footer><button type="button" class="toolbar-organizer-reset" onClick={props.onReset}>Restore defaults</button><button type="button" class="toolbar-organizer-done" onClick={props.onClose}>Done</button></footer>
    </section>
  </div>;
}
