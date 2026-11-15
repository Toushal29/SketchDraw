import { createSignal, For, Show } from "solid-js";
import type { ToolbarItem } from "../model";
import { WINDOWS_TOOL_CATALOG } from "../platform/windows/windows-tool-catalog";

type Zone = "toolbar" | "excluded";
type DragState = { value: ToolbarItem; source: Zone; pointerId: number; startX: number; startY: number; active: boolean };

type Props = {
  toolbarItems: ToolbarItem[];
  excludedItems: ToolbarItem[];
  defaultToolbarItems: ToolbarItem[];
  defaultExcludedItems: ToolbarItem[];
  historyActionsVisible: boolean;
  onSave: (toolbar: ToolbarItem[], excluded: ToolbarItem[], historyActionsVisible: boolean) => void;
  onClose: () => void;
};

export function ToolbarOrderEditor(props: Props) {
  const [toolbar, setToolbar] = createSignal([...props.toolbarItems]);
  const [excluded, setExcluded] = createSignal([...props.excludedItems]);
  const [historyVisible, setHistoryVisible] = createSignal(props.historyActionsVisible);
  const [drag, setDrag] = createSignal<DragState>();
  const [dropTarget, setDropTarget] = createSignal<{ zone: Zone; value?: ToolbarItem }>();
  const list = (zone: Zone) => zone === "toolbar" ? toolbar() : excluded();
  const setList = (zone: Zone, values: ToolbarItem[]) => zone === "toolbar" ? setToolbar(values) : setExcluded(values);
  const clearDrag = () => { setDrag(undefined); setDropTarget(undefined); };

  function locateDropTarget(x: number, y: number) {
    const target = document.elementFromPoint(x, y);
    const item = target?.closest<HTMLElement>("[data-toolbar-item]");
    const zoneElement = item?.closest<HTMLElement>("[data-toolbar-zone]") ?? target?.closest<HTMLElement>("[data-toolbar-zone]");
    const zone = zoneElement?.dataset.toolbarZone as Zone | undefined;
    return zone ? { zone, value: item?.dataset.toolbarItem as ToolbarItem | undefined } : undefined;
  }

  function moveTool(value: ToolbarItem, source: Zone, destination: Zone, before?: ToolbarItem) {
    const sourceItems = list(source).filter(item => item !== value);
    if (source === destination) {
      const index = before ? sourceItems.indexOf(before) : -1;
      sourceItems.splice(index < 0 ? sourceItems.length : index, 0, value);
      setList(source, sourceItems);
      return;
    }
    const destinationItems = list(destination).filter(item => item !== value);
    const index = before ? destinationItems.indexOf(before) : -1;
    destinationItems.splice(index < 0 ? destinationItems.length : index, 0, value);
    setList(source, sourceItems);
    setList(destination, destinationItems);
  }

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
      if (destination && !(destination.zone === current.source && destination.value === current.value)) moveTool(current.value, current.source, destination.zone, destination.value);
    }
    clearDrag();
  };

  const renderZone = (zone: Zone, title: string, items: ToolbarItem[]) => <section
    class={`toolbar-config-zone toolbar-config-${zone}`}
    data-toolbar-zone={zone}
    classList={{ "toolbar-config-drop-target": dropTarget()?.zone === zone && dropTarget()?.value === undefined }}
  >
    <header class="toolbar-config-zone-heading"><strong>{title}</strong><span>{items.length}</span><Show when={zone === "toolbar"}><small>Drag the handle to reorder · − to hide</small></Show></header>
    <Show when={items.length} fallback={<div class="toolbar-config-empty">{zone === "toolbar" ? "Add tools from Excluded tools" : "All tools are in your toolbar"}</div>}>
      <ol class="toolbar-config-grid" aria-label={title}>
        <For each={items}>{value => {
          const definition = WINDOWS_TOOL_CATALOG[value];
          return <li
            data-toolbar-item={value}
            classList={{ "toolbar-config-dragging": drag()?.active && drag()?.value === value, "toolbar-config-item-drop-target": dropTarget()?.zone === zone && dropTarget()?.value === value && drag()?.value !== value }}
            onPointerDown={event => {
              if (!(event.target as HTMLElement).closest(".toolbar-config-grip") || event.button !== 0) return;
              event.preventDefault();
              setDrag({ value, source: zone, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false });
              try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* The pointer can be canceled before capture. */ }
            }}
            onPointerMove={moveDrag}
            onPointerUp={finishDrag}
            onPointerCancel={clearDrag}
          >
            <button type="button" class="toolbar-config-grip" aria-label={`Drag ${definition.label}`} title={`Drag ${definition.label}`} onKeyDown={event => {
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
              event.preventDefault();
              const values = list(zone);
              const index = values.indexOf(value);
              const target = values[index + (event.key === "ArrowUp" ? -1 : 1)];
              if (target) moveTool(value, zone, zone, event.key === "ArrowUp" ? target : values[index + 2]);
            }}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="6" r="1"/><circle cx="16" cy="6" r="1"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="18" r="1"/><circle cx="16" cy="18" r="1"/></svg></button>
            <svg class="toolbar-config-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={definition.iconPath} /></svg>
            <span class="toolbar-config-label">{definition.label}</span>
            <Show when={zone === "toolbar"} fallback={<button type="button" class="toolbar-config-add" aria-label={`Add ${definition.label} to toolbar`} onClick={() => moveTool(value, "excluded", "toolbar")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg><span>Add</span></button>}>
              <button type="button" class="toolbar-config-remove" aria-label={`Hide ${definition.label}`} title={`Hide ${definition.label}`} onClick={() => moveTool(value, "toolbar", "excluded")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg></button>
            </Show>
          </li>;
        }}</For>
      </ol>
    </Show>
  </section>;

  return <div class="toolbar-organizer-backdrop" role="presentation" onPointerDown={event => { if (event.target === event.currentTarget) props.onClose(); }}>
    <section class="toolbar-order-editor toolbar-customizer" role="dialog" aria-modal="true" aria-labelledby="toolbar-organizer-title">
      <header class="toolbar-customizer-heading">
        <div><h2 id="toolbar-organizer-title">Customize toolbar</h2><p>Drag to reorder. Hide tools you don’t use, and add them back anytime.</p></div>
        <button type="button" aria-label="Close toolbar customizer" onClick={props.onClose}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </header>
      {renderZone("toolbar", "In your toolbar", toolbar())}
      {renderZone("excluded", "Excluded tools", excluded())}
      <div class="toolbar-customizer-preferences"><label><input type="checkbox" checked={historyVisible()} onChange={event => setHistoryVisible(event.currentTarget.checked)} /><span>Show Undo and Redo in the toolbar</span></label><small>Changes apply only when you save.</small></div>
      <footer>
        <button type="button" class="toolbar-customizer-reset" onClick={() => { setToolbar([...props.defaultToolbarItems]); setExcluded([...props.defaultExcludedItems]); setHistoryVisible(true); }}>Reset to default</button>
        <div><button type="button" class="toolbar-customizer-cancel" onClick={props.onClose}>Cancel</button><button type="button" class="toolbar-customizer-save" onClick={() => props.onSave(toolbar(), excluded(), historyVisible())}>Save toolbar</button></div>
      </footer>
    </section>
  </div>;
}
