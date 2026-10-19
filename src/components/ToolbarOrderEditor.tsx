import { createSignal } from "solid-js";
import type { Tool } from "../model";

export type ToolbarOrderItem = { value: Tool; label: string };

type Props = {
  items: ToolbarOrderItem[];
  onMove: (tool: Tool, direction: -1 | 1) => void;
  onReorder: (from: Tool, to: Tool) => void;
  onReset: () => void;
};

export function ToolbarOrderEditor(props: Props) {
  const [dragged, setDragged] = createSignal<Tool>();
  const [dropTarget, setDropTarget] = createSignal<Tool>();
  let dragPointer: number | undefined;
  const clearDrag = (pointerId?: number) => {
    if (pointerId !== undefined && dragPointer !== pointerId) return;
    dragPointer = undefined;
    setDragged(undefined);
    setDropTarget(undefined);
  };
  const finishDrag = (event: PointerEvent) => {
    if (dragPointer !== event.pointerId) return;
    const from = dragged();
    const to = dropTarget();
    const handle = event.currentTarget as HTMLButtonElement;
    clearDrag(event.pointerId);
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    if (from && to && from !== to) props.onReorder(from, to);
  };
  return <section class="toolbar-order-editor">
    <header><div><strong>Toolbar order</strong><small>Drag tools or use the arrows</small></div><button type="button" onClick={props.onReset}>Reset</button></header>
    <ol>{props.items.map((item, index) => <li
      data-toolbar-tool={item.value}
      classList={{ "toolbar-order-dragging": dragged() === item.value, "toolbar-order-drop-target": dropTarget() === item.value && dragged() !== item.value }}
    >
      <button
        type="button"
        class="toolbar-order-grip"
        aria-label={`Reorder ${item.label}; use the up and down arrow keys or drag`}
        aria-pressed={dragged() === item.value}
        title="Drag to reorder, or focus and use the up/down arrow keys"
        onPointerDown={event => {
          if (event.button !== 0) return;
          event.preventDefault();
          dragPointer = event.pointerId;
          setDragged(item.value);
          setDropTarget(item.value);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          if (dragPointer !== event.pointerId) return;
          const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-toolbar-tool]")?.dataset.toolbarTool as Tool | undefined;
          if (target) setDropTarget(target);
        }}
        onPointerUp={finishDrag}
        onPointerCancel={event => clearDrag(event.pointerId)}
        onLostPointerCapture={event => clearDrag(event.pointerId)}
        onKeyDown={event => {
          if (event.key === "ArrowUp") { event.preventDefault(); props.onMove(item.value, -1); }
          else if (event.key === "ArrowDown") { event.preventDefault(); props.onMove(item.value, 1); }
        }}
      ><i /><i /><i /></button><span class="toolbar-order-label">{item.label}</span>
      <div><button type="button" aria-label={`Move ${item.label} up`} title="Move up" disabled={index === 0} onClick={() => props.onMove(item.value, -1)}>Up</button><button type="button" aria-label={`Move ${item.label} down`} title="Move down" disabled={index === props.items.length - 1} onClick={() => props.onMove(item.value, 1)}>Down</button></div>
    </li>)}</ol>
  </section>;
}
