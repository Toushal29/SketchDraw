import { createSignal, For, Show, onMount } from "solid-js";
import { readSpatialLayout, writeSpatialLayout, moveFileCard, removeFileCard, autoArrangeCards, type SpatialFileCard } from "../features/canvas/spatial-file-browser";

type Props = {
  onOpenFile: (path: string) => void;
  onClose: () => void;
};

export function SpatialFileBrowser(props: Props) {
  const [cards, setCards] = createSignal<SpatialFileCard[]>([]);
  const [dragging, setDragging] = createSignal<string | null>(null);
  const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 });
  const [zoom, setZoom] = createSignal(1);
  const [pan, setPan] = createSignal({ x: 0, y: 0 });
  let containerRef: HTMLDivElement | undefined;

  onMount(() => setCards(readSpatialLayout()));

  function save(updated: SpatialFileCard[]) {
    setCards(updated);
    writeSpatialLayout(updated);
  }

  function handleDragStart(id: string, event: PointerEvent) {
    const card = cards().find(c => c.id === id);
    if (!card) return;
    event.preventDefault();
    (event.target as Element).setPointerCapture(event.pointerId);
    setDragging(id);
    setDragOffset({ x: event.clientX - card.x * zoom() - pan().x, y: event.clientY - card.y * zoom() - pan().y });
  }

  function handleDragMove(event: PointerEvent) {
    const id = dragging();
    if (!id) return;
    const x = (event.clientX - dragOffset().x - pan().x) / zoom();
    const y = (event.clientY - dragOffset().y - pan().y) / zoom();
    save(moveFileCard(cards(), id, Math.round(x), Math.round(y)));
  }

  function handleDragEnd() { setDragging(null); }

  function handleRemove(id: string) { save(removeFileCard(cards(), id)); }

  function handleAutoArrange() { save(autoArrangeCards(cards())); }

  function handleWheel(event: WheelEvent) {
    event.preventDefault();
    if (event.ctrlKey) {
      const delta = event.deltaY > 0 ? 0.9 : 1.1;
      setZoom(z => Math.max(0.3, Math.min(2, z * delta)));
    } else {
      setPan(p => ({ x: p.x - event.deltaX, y: p.y - event.deltaY }));
    }
  }

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return <div class="spatial-browser-backdrop" onClick={props.onClose}>
    <div class="spatial-browser" onClick={e => e.stopPropagation()}>
      <header class="spatial-browser-header">
        <strong>Recent Sketches</strong>
        <div class="spatial-browser-actions">
          <button type="button" onClick={handleAutoArrange}>Auto-arrange</button>
          <button type="button" onClick={props.onClose}>×</button>
        </div>
      </header>
      <div ref={containerRef} class="spatial-browser-canvas"
        onWheel={handleWheel} onPointerMove={handleDragMove} onPointerUp={handleDragEnd}>
        <div class="spatial-browser-content"
          style={{ transform: `translate(${pan().x}px, ${pan().y}px) scale(${zoom()})`, "transform-origin": "0 0" }}>
          <Show when={!cards().length}>
            <p class="spatial-browser-empty">No recent sketches yet. Open files to see them as cards here.</p>
          </Show>
          <For each={cards()}>{card =>
            <div class="spatial-file-card" classList={{ "spatial-file-dragging": dragging() === card.id }}
              style={{ left: `${card.x}px`, top: `${card.y}px`, width: `${card.w}px`, height: `${card.h}px` }}
              onPointerDown={[handleDragStart, card.id]}>
              <Show when={card.thumbnail}>
                <div class="spatial-file-thumb" style={{ "background-image": `url(${card.thumbnail})` }} />
              </Show>
              <Show when={!card.thumbnail}>
                <div class="spatial-file-thumb spatial-file-thumb-empty">
                  <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M12 18v-6M9 15l3-3 3 3" /></svg>
                </div>
              </Show>
              <div class="spatial-file-info">
                <strong>{card.name}</strong>
                <small>{timeAgo(card.lastModified)}</small>
              </div>
              <div class="spatial-file-actions">
                <button type="button" onClick={(e) => { e.stopPropagation(); props.onOpenFile(card.path); }} title="Open">Open</button>
                <button type="button" onClick={(e) => { e.stopPropagation(); handleRemove(card.id); }} title="Remove">×</button>
              </div>
              <Show when={card.group}>
                <span class="spatial-file-group">{card.group}</span>
              </Show>
            </div>
          }</For>
        </div>
      </div>
    </div>
  </div>;
}
