import { For, Match, Show, Switch, createSignal, onCleanup, onMount } from "solid-js";
import type { UIArtboard, UIDesignDocument, UIDesignNode, UIDesignNodeKind } from "./model";
import type { UIDesignSession } from "./session";
import "./ui-design.css";

type Props = { session: UIDesignSession };
type Gesture = { pointerId: number; nodeId: string; mode: "move" | "resize"; x: number; y: number; node: UIDesignNode; preview: UIDesignNode };
type SmartGuides = { x?: number; y?: number };

const PRESETS = [
  { label: "Desktop", width: 1440, height: 900 },
  { label: "Tablet", width: 768, height: 1024 },
  { label: "Mobile", width: 390, height: 844 },
] as const;

function selectedPage(document: UIDesignDocument) { return document.pages.find(page => page.id === document.activePageId) ?? document.pages[0]; }
function selectedBoard(document: UIDesignDocument): UIArtboard { const page = selectedPage(document); return page.artboards.find(board => board.id === document.activeArtboardId) ?? page.artboards[0]; }

function defaultNode(kind: UIDesignNodeKind, index: number): UIDesignNode {
  const text: Record<UIDesignNodeKind, string> = { text: "Heading", button: "Button", input: "Enter text", checkbox: "Checkbox", card: "Card content", image: "Image" };
  return {
    id: crypto.randomUUID(), kind, x: 32 + index % 5 * 18, y: 32 + index % 5 * 18,
    width: kind === "card" ? 260 : kind === "text" ? 260 : 180,
    height: kind === "card" ? 140 : kind === "text" ? 42 : kind === "checkbox" ? 38 : 48,
    text: text[kind], background: kind === "button" ? "#2563eb" : "#ffffff",
    foreground: kind === "button" ? "#ffffff" : "#172033", border: "#cbd5e1", fontSize: kind === "text" ? 24 : 16, radius: kind === "card" ? 12 : 8,
  };
}

export function UiDesignWorkspace(props: Props) {
  const [selectedId, setSelectedId] = createSignal<string>();
  const [preview, setPreview] = createSignal(false);
  const [scale, setScale] = createSignal(0.72);
  const [gesture, setGesture] = createSignal<Gesture>();
  const [smartGuides, setSmartGuides] = createSignal<SmartGuides>({});
  let stageScroller: HTMLDivElement | undefined;
  let artboardElement: HTMLDivElement | undefined;
  const document = () => props.session.document();
  const page = () => selectedPage(document());
  const board = () => selectedBoard(document());
  const selected = () => board().nodes.find(node => node.id === selectedId());
  const gridColumns = () => {
    const layout = board().layoutGrid;
    const columnWidth = (board().width - layout.margin * 2 - layout.gutter * (layout.columns - 1)) / layout.columns;
    return columnWidth > 0 ? Array.from({ length: layout.columns }, (_, index) => ({ x: layout.margin + index * (columnWidth + layout.gutter), width: columnWidth })) : [];
  };

  function commitDocument(next: UIDesignDocument) { props.session.update(next); }
  function updateBoard(update: (current: UIArtboard) => UIArtboard) {
    const current = document();
    const currentPage = selectedPage(current);
    const nextBoard = update(board());
    commitDocument({ ...current, pages: current.pages.map(item => item.id === currentPage.id ? { ...item, artboards: item.artboards.map(candidate => candidate.id === nextBoard.id ? nextBoard : candidate) } : item) });
  }
  function updateGrid(patch: Partial<UIArtboard["layoutGrid"]>) {
    updateBoard(current => ({ ...current, layoutGrid: { ...current.layoutGrid, ...patch } }));
  }
  function boundedInteger(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, Number.isFinite(value) ? Math.round(value) : min));
  }
  function addNode(kind: UIDesignNodeKind) {
    const node = defaultNode(kind, board().nodes.length);
    updateBoard(current => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedId(node.id);
    setPreview(false);
  }
  function updateSelected(patch: Partial<UIDesignNode>) {
    const id = selectedId();
    if (!id) return;
    updateBoard(current => ({ ...current, nodes: current.nodes.map(node => node.id === id ? { ...node, ...patch } : node) }));
  }
  function deleteSelected() {
    const id = selectedId();
    if (!id || preview()) return;
    updateBoard(current => ({ ...current, nodes: current.nodes.filter(node => node.id !== id) }));
    setSelectedId(undefined);
  }
  function duplicateSelected() {
    const current = selected();
    if (!current || preview()) return;
    const copy = { ...current, id: crypto.randomUUID(), x: current.x + 16, y: current.y + 16 };
    updateBoard(value => ({ ...value, nodes: [...value.nodes, copy] }));
    setSelectedId(copy.id);
  }
  function addArtboard(preset: typeof PRESETS[number] = PRESETS[0]) {
    const current = document();
    const currentPage = selectedPage(current);
    const index = currentPage.artboards.length + 1;
    const artboard: UIArtboard = { id: crypto.randomUUID(), name: `${preset.label} ${index}`, width: preset.width, height: preset.height, background: "#ffffff", layoutGrid: { visible: false, snap: false, columns: 12, gutter: 16, margin: 24 }, nodes: [] };
    commitDocument({ ...current, activeArtboardId: artboard.id, pages: current.pages.map(item => item.id === currentPage.id ? { ...item, artboards: [...item.artboards, artboard] } : item) });
    setSelectedId(undefined);
    setPreview(false);
  }
  function removeArtboard() {
    const current = document();
    const currentPage = selectedPage(current);
    if (currentPage.artboards.length <= 1) return;
    const boards = currentPage.artboards.filter(item => item.id !== current.activeArtboardId);
    const active = boards[0];
    commitDocument({ ...current, activeArtboardId: active.id, pages: current.pages.map(item => item.id === currentPage.id ? { ...item, artboards: boards } : item) });
    setSelectedId(undefined);
  }
  function beginGesture(event: PointerEvent, node: UIDesignNode, mode: Gesture["mode"]) {
    if (preview() || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(node.id);
    const origin = { pointerId: event.pointerId, nodeId: node.id, mode, x: event.clientX, y: event.clientY, node, preview: node } satisfies Gesture;
    setGesture(origin);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  function updateGesture(event: PointerEvent) {
    const active = gesture();
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = (event.clientX - active.x) / scale();
    const dy = (event.clientY - active.y) / scale();
    let next: UIDesignNode;
    if (active.mode === "move") {
      let x = Math.round(active.node.x + dx);
      let y = Math.round(active.node.y + dy);
      if (board().layoutGrid.snap) { x = Math.round(x / 8) * 8; y = Math.round(y / 8) * 8; }
      const peers = board().nodes.filter(item => item.id !== active.nodeId);
      const threshold = 7 / scale();
      const baseX = x;
      const baseY = y;
      let adjustX = 0;
      let adjustY = 0;
      let bestX = threshold;
      let bestY = threshold;
      let guideX: number | undefined;
      let guideY: number | undefined;
      const xTargets = [0, board().width / 2, board().width, ...peers.flatMap(item => [item.x, item.x + item.width / 2, item.x + item.width])];
      const yTargets = [0, board().height / 2, board().height, ...peers.flatMap(item => [item.y, item.y + item.height / 2, item.y + item.height])];
      for (const anchor of [0, active.node.width / 2, active.node.width]) for (const target of xTargets) {
        const difference = target - (baseX + anchor);
        if (Math.abs(difference) < bestX) { bestX = Math.abs(difference); adjustX = difference; guideX = target; }
      }
      for (const anchor of [0, active.node.height / 2, active.node.height]) for (const target of yTargets) {
        const difference = target - (baseY + anchor);
        if (Math.abs(difference) < bestY) { bestY = Math.abs(difference); adjustY = difference; guideY = target; }
      }
      x += adjustX;
      y += adjustY;
      setSmartGuides({ x: guideX, y: guideY });
      next = { ...active.node, x, y };
    } else {
      setSmartGuides({});
      next = { ...active.node, width: Math.max(24, Math.round(active.node.width + dx)), height: Math.max(24, Math.round(active.node.height + dy)) };
    }
    setGesture({ ...active, preview: next });
  }
  function finishGesture(event: PointerEvent) {
    const active = gesture();
    if (!active || active.pointerId !== event.pointerId) return;
    const next = active.preview;
    setGesture(undefined);
    setSmartGuides({});
    if (next.x !== active.node.x || next.y !== active.node.y || next.width !== active.node.width || next.height !== active.node.height) {
      updateBoard(current => ({ ...current, nodes: current.nodes.map(node => node.id === active.nodeId ? next : node) }));
    }
  }
  function nodeForDisplay(node: UIDesignNode) { const active = gesture(); return active?.nodeId === node.id ? active.preview : node; }
  function addPage() {
    const current = document();
    const id = crypto.randomUUID();
    const pageNo = current.pages.length + 1;
    const newBoard = { id: crypto.randomUUID(), name: "Desktop 1", width: 1440, height: 900, background: "#ffffff", layoutGrid: { visible: false, snap: false, columns: 12, gutter: 16, margin: 24 }, nodes: [] } satisfies UIArtboard;
    commitDocument({ ...current, activePageId: id, activeArtboardId: newBoard.id, pages: [...current.pages, { id, name: `Page ${pageNo}`, artboards: [newBoard] }] });
    setSelectedId(undefined);
  }
  function changePage(id: string) {
    const current = document();
    const nextPage = current.pages.find(item => item.id === id);
    if (!nextPage) return;
    commitDocument({ ...current, activePageId: id, activeArtboardId: nextPage.artboards[0].id });
    setSelectedId(undefined);
  }

  function zoomFromWheel(event: WheelEvent) {
    if (!stageScroller || !artboardElement) return;
    event.preventDefault();
    const oldScale = scale();
    const delta = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 400 : 1);
    const nextScale = Math.min(2.5, Math.max(0.15, oldScale * Math.exp(-delta * 0.0012)));
    if (nextScale === oldScale) return;
    const scrollerRect = stageScroller.getBoundingClientRect();
    const boardRect = artboardElement.getBoundingClientRect();
    const pointerX = event.clientX - scrollerRect.left;
    const pointerY = event.clientY - scrollerRect.top;
    const worldX = (event.clientX - boardRect.left) / oldScale;
    const worldY = (event.clientY - boardRect.top) / oldScale;
    setScale(nextScale);
    requestAnimationFrame(() => {
      if (!stageScroller || !artboardElement) return;
      const nextRect = artboardElement.getBoundingClientRect();
      stageScroller.scrollLeft = nextRect.left - scrollerRect.left + stageScroller.scrollLeft + worldX * nextScale - pointerX;
      stageScroller.scrollTop = nextRect.top - scrollerRect.top + stageScroller.scrollTop + worldY * nextScale - pointerY;
    });
  }

  function fitArtboard() {
    if (!stageScroller) return;
    const availableWidth = Math.max(120, stageScroller.clientWidth - 60);
    const availableHeight = Math.max(120, stageScroller.clientHeight - 60);
    setScale(Math.max(0.15, Math.min(1, availableWidth / board().width, availableHeight / board().height)));
    stageScroller.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  }

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const editing = target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if (editing || event.altKey) return;
      if (!event.ctrlKey && !event.metaKey) {
        if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); deleteSelected(); return; }
        if (!preview() && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) && selectedId()) {
          event.preventDefault();
          const amount = event.shiftKey ? 10 : 1;
          updateSelected({ x: (selected()?.x ?? 0) + (event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0), y: (selected()?.y ?? 0) + (event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0) });
        }
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "z") { event.preventDefault(); event.shiftKey ? props.session.redo() : props.session.undo(); }
      else if (key === "y") { event.preventDefault(); props.session.redo(); }
      else if (key === "d") { event.preventDefault(); duplicateSelected(); }
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  return <section class="ui-design-workspace" aria-label="UI Design workspace">
    <header class="ui-design-toolbar">
      <div class="ui-design-brand"><span class="ui-design-mark" aria-hidden="true">UI</span><div><strong>UI Design</strong><span title={props.session.fileName()}>{props.session.fileName()}{props.session.dirty() ? " •" : ""}</span></div></div>
      <nav aria-label="UI Design file actions">
        <button type="button" disabled={props.session.opening() || props.session.saving()} onClick={() => { if (props.session.create()) { setSelectedId(undefined); setPreview(false); } }}>New</button>
        <button type="button" disabled={props.session.opening() || props.session.saving()} onClick={() => void props.session.open()}>Open</button>
        <button type="button" disabled={props.session.opening() || props.session.saving() || !props.session.dirty() && !!props.session.path()} onClick={() => void props.session.save()}>Save</button>
        <button type="button" disabled={props.session.opening() || props.session.saving()} onClick={() => void props.session.saveAs()}>Save as</button>
      </nav>
      <div class="ui-design-toolbar-end">
        <button type="button" title="Undo (Ctrl/⌘+Z)" disabled={!props.session.canUndo()} onClick={props.session.undo}>Undo</button>
        <button type="button" title="Redo (Ctrl/⌘+Y)" disabled={!props.session.canRedo()} onClick={props.session.redo}>Redo</button>
        <button type="button" classList={{ active: preview() }} aria-pressed={preview()} onClick={() => setPreview(value => !value)}>{preview() ? "Edit" : "Preview"}</button>
      </div>
    </header>
    <Show when={props.session.error()}>{message => <div class="ui-design-error" role="alert">{message()}</div>}</Show>
    <div class="ui-design-body">
      <aside class="ui-design-sidebar" aria-label="UI Design pages and elements">
        <div class="ui-design-section-heading"><strong>Pages</strong><button type="button" onClick={addPage} aria-label="Add page" title="Add page">+</button></div>
        <For each={document().pages}>{item => <button type="button" class="ui-design-page-item" classList={{ active: item.id === document().activePageId }} onClick={() => changePage(item.id)}>{item.name}</button>}</For>
        <div class="ui-design-section-heading"><strong>Artboards</strong><button type="button" onClick={() => addArtboard()} aria-label="Add artboard" title="Add desktop artboard">+</button></div>
        <For each={page().artboards}>{item => <button type="button" class="ui-design-page-item" classList={{ active: item.id === board().id }} onClick={() => { commitDocument({ ...document(), activeArtboardId: item.id }); setSelectedId(undefined); }}>{item.name}<small>{item.width} × {item.height}</small></button>}</For>
        <div class="ui-design-section-heading"><strong>Elements</strong><span>{board().nodes.length}</span></div>
        <For each={[...board().nodes].reverse()}>{node => <button type="button" class="ui-design-layer-item" classList={{ active: node.id === selectedId() }} onClick={() => { setSelectedId(node.id); setPreview(false); }}><span class={`ui-design-layer-icon ${node.kind}`} aria-hidden="true" />{node.text || node.kind}</button>}</For>
        <Show when={!preview()}><div class="ui-design-section-heading"><strong>Insert</strong></div><div class="ui-design-insert-grid">
          <button type="button" onClick={() => addNode("text")}>Text</button><button type="button" onClick={() => addNode("button")}>Button</button>
          <button type="button" onClick={() => addNode("input")}>Input</button><button type="button" onClick={() => addNode("checkbox")}>Checkbox</button>
          <button type="button" onClick={() => addNode("card")}>Card</button><button type="button" onClick={() => addNode("image")}>Image</button>
        </div></Show>
        <Show when={props.session.recentPaths().length > 0}><div class="ui-design-section-heading"><strong>Recent files</strong></div><For each={props.session.recentPaths()}>{path => <button type="button" class="ui-design-recent-item" title={path} onClick={() => void props.session.openRecent(path)}>{props.session.fileName() === path ? path : path.split(/[\\/]/).pop()}</button>}</For></Show>
      </aside>
      <main class="ui-design-stage-wrap">
        <div class="ui-design-stage-toolbar">
          <span>{board().name} <small>{board().width} × {board().height}</small></span>
          <div>
            <button type="button" classList={{ active: board().layoutGrid.visible }} aria-pressed={board().layoutGrid.visible} disabled={preview()} onClick={() => updateGrid({ visible: !board().layoutGrid.visible })}>Grid</button>
            <button type="button" classList={{ active: board().layoutGrid.snap }} aria-pressed={board().layoutGrid.snap} disabled={preview()} onClick={() => updateGrid({ snap: !board().layoutGrid.snap })}>Snap</button>
            <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => setScale(value => Math.max(0.15, value - 0.1))}>−</button>
            <label>Zoom <input aria-label="Zoom" type="range" min="0.15" max="2.5" step="0.05" value={scale()} onInput={event => setScale(Number(event.currentTarget.value))} /></label>
            <span class="ui-design-zoom-level">{Math.round(scale() * 100)}%</span>
            <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => setScale(value => Math.min(2.5, value + 0.1))}>+</button>
            <button type="button" onClick={fitArtboard}>Fit</button>
            <button type="button" onClick={removeArtboard} disabled={page().artboards.length <= 1 || preview()}>Remove artboard</button>
            <select aria-label="New artboard size" onChange={event => { const preset = PRESETS.find(item => item.label === event.currentTarget.value); if (preset) addArtboard(preset); event.currentTarget.value = ""; }} disabled={preview()}><option value="">Add size…</option>{PRESETS.map(preset => <option value={preset.label}>{preset.label} {preset.width} × {preset.height}</option>)}</select>
          </div>
        </div>
        <div class="ui-design-stage-scroll" ref={element => { stageScroller = element; }} onWheel={zoomFromWheel}>
          <div class="ui-design-artboard" ref={element => { artboardElement = element; }} style={{ width: `${board().width * scale()}px`, height: `${board().height * scale()}px` }} onPointerDown={event => { if (event.target === event.currentTarget) setSelectedId(undefined); }}>
            <div class="ui-design-artboard-content" style={{ width: `${board().width}px`, height: `${board().height}px`, transform: `scale(${scale()})`, "transform-origin": "top left", background: board().background }}>
              <Show when={!preview() && board().layoutGrid.visible && gridColumns().length}><svg class="ui-design-guides ui-design-layout-guides" viewBox={`0 0 ${board().width} ${board().height}`} aria-hidden="true"><For each={gridColumns()}>{column => <rect x={column.x} y="0" width={column.width} height={board().height} />}</For></svg></Show>
              <Show when={!preview() && (smartGuides().x !== undefined || smartGuides().y !== undefined)}><svg class="ui-design-guides ui-design-smart-guides" viewBox={`0 0 ${board().width} ${board().height}`} aria-hidden="true"><Show when={smartGuides().x !== undefined}><line x1={smartGuides().x} x2={smartGuides().x} y1="0" y2={board().height} /></Show><Show when={smartGuides().y !== undefined}><line x1="0" x2={board().width} y1={smartGuides().y} y2={smartGuides().y} /></Show></svg></Show>
              <For each={board().nodes}>{node => { const visual = () => nodeForDisplay(node); return <div class="ui-design-node" classList={{ selected: !preview() && selectedId() === node.id, [`kind-${node.kind}`]: true }} style={{ left: `${visual().x}px`, top: `${visual().y}px`, width: `${visual().width}px`, height: `${visual().height}px`, color: visual().foreground, background: visual().background, border: `1px solid ${visual().border}`, "border-radius": `${visual().radius}px`, "font-size": `${visual().fontSize}px` }} onPointerDown={event => beginGesture(event, node, "move")} onPointerMove={updateGesture} onPointerUp={finishGesture} onPointerCancel={finishGesture} onClick={event => { if (!preview()) { event.stopPropagation(); setSelectedId(node.id); } }}>
                <Show when={!preview()}><div class="ui-design-node-label" aria-hidden="true">{node.text || node.kind}</div></Show>
                <SwitchNode node={visual()} preview={preview()} />
                <Show when={!preview() && selectedId() === node.id}><button class="ui-design-resize-handle" type="button" aria-label={`Resize ${node.kind}`} onPointerDown={event => beginGesture(event, node, "resize")} onPointerMove={updateGesture} onPointerUp={finishGesture} onPointerCancel={finishGesture} /></Show>
              </div>; }}</For>
            </div>
          </div>
        </div>
      </main>
      <aside class="ui-design-inspector" aria-label="UI Design properties">
        <Show when={selected()} fallback={<div class="ui-design-inspector-empty">
          <strong>Artboard properties</strong>
          <label>Background<input type="color" value={board().background} disabled={preview()} onInput={event => updateBoard(current => ({ ...current, background: event.currentTarget.value }))} /></label>
          <label>Artboard name<input value={board().name} disabled={preview()} onInput={event => updateBoard(current => ({ ...current, name: event.currentTarget.value.slice(0, 120) }))} /></label>
          <fieldset class="ui-design-grid-settings" disabled={preview()}>
            <legend>Layout guides</legend>
            <label class="ui-design-grid-visibility"><input type="checkbox" checked={board().layoutGrid.visible} onChange={event => updateGrid({ visible: event.currentTarget.checked })} />Show columns</label>
            <label class="ui-design-grid-visibility"><input type="checkbox" checked={board().layoutGrid.snap} onChange={event => updateGrid({ snap: event.currentTarget.checked })} />Snap to 8 px grid</label>
            <div class="ui-design-property-pair">
              <label>Columns<input type="number" min="1" max="24" value={board().layoutGrid.columns} onChange={event => updateGrid({ columns: boundedInteger(Number(event.currentTarget.value), 1, 24) })} /></label>
              <label>Gutter<input type="number" min="0" max="120" value={board().layoutGrid.gutter} onChange={event => updateGrid({ gutter: boundedInteger(Number(event.currentTarget.value), 0, 120) })} /></label>
            </div>
            <label>Margin<input type="number" min="0" max="400" value={board().layoutGrid.margin} onChange={event => updateGrid({ margin: boundedInteger(Number(event.currentTarget.value), 0, 400) })} /></label>
          </fieldset>
        </div>}>{node => <div class="ui-design-inspector-fields">
          <header><strong>{node().kind}</strong><div><button type="button" disabled={preview()} onClick={duplicateSelected}>Duplicate</button><button type="button" disabled={preview()} onClick={deleteSelected}>Delete</button></div></header>
          <label>Text<input value={node().text} disabled={preview()} onInput={event => updateSelected({ text: event.currentTarget.value.slice(0, 240) })} /></label>
          <div class="ui-design-property-pair"><label>X<input type="number" value={node().x} disabled={preview()} onChange={event => updateSelected({ x: Number(event.currentTarget.value) })} /></label><label>Y<input type="number" value={node().y} disabled={preview()} onChange={event => updateSelected({ y: Number(event.currentTarget.value) })} /></label></div>
          <div class="ui-design-property-pair"><label>Width<input type="number" min="24" value={node().width} disabled={preview()} onChange={event => updateSelected({ width: Math.max(24, Number(event.currentTarget.value)) })} /></label><label>Height<input type="number" min="24" value={node().height} disabled={preview()} onChange={event => updateSelected({ height: Math.max(24, Number(event.currentTarget.value)) })} /></label></div>
          <label>Font size<input type="number" min="8" max="96" value={node().fontSize} disabled={preview()} onChange={event => updateSelected({ fontSize: Math.min(96, Math.max(8, Number(event.currentTarget.value))) })} /></label>
          <label>Corner radius<input type="number" min="0" max="100" value={node().radius} disabled={preview()} onChange={event => updateSelected({ radius: Math.min(100, Math.max(0, Number(event.currentTarget.value))) })} /></label>
          <label>Text color<input type="color" value={node().foreground} disabled={preview()} onInput={event => updateSelected({ foreground: event.currentTarget.value })} /></label>
          <label>Fill<input type="color" value={node().background} disabled={preview()} onInput={event => updateSelected({ background: event.currentTarget.value })} /></label>
          <label>Border<input type="color" value={node().border} disabled={preview()} onInput={event => updateSelected({ border: event.currentTarget.value })} /></label>
        </div>}</Show>
      </aside>
    </div>
  </section>;
}

function SwitchNode(props: { node: UIDesignNode; preview: boolean }) {
  const node = () => props.node;
  return <div class="ui-design-rendered-node" classList={{ [`rendered-${node().kind}`]: true }}>
    <Switch>
      <Match when={node().kind === "text"}><span>{node().text}</span></Match>
      <Match when={node().kind === "button"}><button type="button" disabled={!props.preview}>{node().text}</button></Match>
      <Match when={node().kind === "input"}><input aria-label={node().text} placeholder={node().text} disabled={!props.preview} /></Match>
      <Match when={node().kind === "checkbox"}><label><input type="checkbox" disabled={!props.preview} />{node().text}</label></Match>
      <Match when={node().kind === "card"}><article><strong>{node().text}</strong><p>Card description</p></article></Match>
      <Match when={node().kind === "image"}><div role="img" aria-label={node().text}><span>{node().text}</span></div></Match>
    </Switch>
  </div>;
}
