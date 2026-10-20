import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { CanvasGuide, CanvasState, Point } from "../../model";

const RULER_SIZE = 26;
type Measurement = { start: Point; end: Point };
type SnapFeedback = { x?: number; y?: number; equalSpacingX?: boolean; equalSpacingY?: boolean };
type RulerTick = { position: number; value: number; major: boolean; label?: string };
type DragGuide = { index: number; axis: CanvasGuide["axis"]; created: boolean };
type NodeHandle = { index: number; x: number; y: number; selected?: boolean };

type Props = {
  state: CanvasState;
  showRulers: boolean;
  showGuides: boolean;
  guides: CanvasGuide[];
  snapFeedback?: SnapFeedback;
  measurement?: Measurement;
  nodeHandles?: NodeHandle[];
  disabled: boolean;
  onAddGuide: (axis: CanvasGuide["axis"], position: number) => void;
  onMoveGuide: (index: number, position: number) => void;
  onRemoveGuide: (index: number) => void;
  onPathNodePointerDown?: (index: number, event: PointerEvent) => void;
  onPathNodePointerMove?: (event: PointerEvent) => void;
  onPathNodePointerUp?: (event: PointerEvent) => void;
  onPathNodePointerCancel?: (event: PointerEvent) => void;
};

function niceRulerStep(zoom: number) {
  const target = 64 / Math.max(0.02, zoom);
  const power = 10 ** Math.floor(Math.log10(target));
  const scaled = target / power;
  return (scaled <= 1.5 ? 1 : scaled <= 3.5 ? 2 : scaled <= 7.5 ? 5 : 10) * power;
}

function formatRulerValue(value: number, step: number) {
  const precision = step >= 1 ? 0 : Math.min(4, Math.max(1, Math.ceil(-Math.log10(step))));
  return Number(value.toFixed(precision)).toString();
}

function ticks(start: number, end: number, offset: number, zoom: number): RulerTick[] {
  const step = niceRulerStep(zoom);
  const minorStep = step / 5;
  const first = Math.ceil(((start - offset) / zoom) / minorStep);
  const last = Math.floor(((end - offset) / zoom) / minorStep);
  const result: RulerTick[] = [];
  for (let index = first; index <= last && result.length < 1200; index++) {
    const value = index * minorStep;
    const major = index % 5 === 0;
    result.push({ position: offset + value * zoom, value, major, ...(major ? { label: formatRulerValue(value, step) } : {}) });
  }
  return result;
}

export function CanvasRulers(props: Props) {
  const [size, setSize] = createSignal({ width: 0, height: 0 });
  const [dragGuide, setDragGuide] = createSignal<DragGuide>();
  const [draftPosition, setDraftPosition] = createSignal<number>();
  let root: HTMLDivElement | undefined;
  let svg: SVGSVGElement | undefined;
  let observer: ResizeObserver | undefined;
  const leftInset = () => props.showRulers ? RULER_SIZE : 0;
  const bottomInset = () => props.showRulers ? RULER_SIZE : 0;
  const xTicks = createMemo(() => ticks(leftInset(), size().width, leftInset() + props.state.panX, props.state.zoom));
  const yTicks = createMemo(() => ticks(0, Math.max(0, size().height - bottomInset()), props.state.panY, props.state.zoom));
  const guidePosition = (index: number, guide: CanvasGuide) => dragGuide()?.index === index ? draftPosition() ?? guide.position : guide.position;
  const pointForRuler = (event: PointerEvent, axis: CanvasGuide["axis"]) => {
    const bounds = root?.getBoundingClientRect();
    if (!bounds) return 0;
    const pixel = axis === "x" ? event.clientX - bounds.left - leftInset() : event.clientY - bounds.top;
    return (pixel - (axis === "x" ? props.state.panX : props.state.panY)) / props.state.zoom;
  };
  const pointForGuide = (event: PointerEvent, axis: CanvasGuide["axis"]) => pointForRuler(event, axis);
  const capturePointer = (event: PointerEvent) => {
    try { svg?.setPointerCapture(event.pointerId); } catch { /* The browser may cancel a touch before capture. */ }
  };
  const removeNearest = (event: PointerEvent, axis: CanvasGuide["axis"]) => {
    const requested = pointForRuler(event, axis);
    const threshold = 10 / props.state.zoom;
    let match = -1;
    let distance = threshold;
    props.guides.forEach((guide, index) => {
      if (guide.axis !== axis) return;
      const next = Math.abs(guide.position - requested);
      if (next <= distance) { match = index; distance = next; }
    });
    if (match >= 0) props.onRemoveGuide(match);
  };
  const rulerPointerDown = (event: PointerEvent, axis: CanvasGuide["axis"]) => {
    event.preventDefault();
    if (event.button === 2) { if (!props.disabled) removeNearest(event, axis); return; }
    if (event.button !== 0 || props.disabled) return;
    setDragGuide({ index: props.guides.length, axis, created: true });
    setDraftPosition(pointForRuler(event, axis));
    capturePointer(event);
  };
  const guidePointerDown = (event: PointerEvent, index: number, guide: CanvasGuide) => {
    event.preventDefault(); event.stopPropagation();
    if (event.button === 2) { if (!props.disabled) props.onRemoveGuide(index); return; }
    if (event.button !== 0 || props.disabled) return;
    setDragGuide({ index, axis: guide.axis, created: false });
    setDraftPosition(guide.position);
    capturePointer(event);
  };
  const pointerMove = (event: PointerEvent) => {
    props.onPathNodePointerMove?.(event);
    const drag = dragGuide();
    if (!drag) return;
    event.preventDefault();
    setDraftPosition(pointForGuide(event, drag.axis));
  };
  const pointerUp = (event: PointerEvent) => {
    props.onPathNodePointerUp?.(event);
    const drag = dragGuide();
    if (!drag) return;
    event.preventDefault();
    const position = draftPosition();
    if (position !== undefined && Number.isFinite(position) && !props.disabled) {
      if (drag.created) props.onAddGuide(drag.axis, position);
      else if (drag.index < props.guides.length && Math.abs(position - props.guides[drag.index].position) > 0.001) props.onMoveGuide(drag.index, position);
    }
    setDragGuide(undefined); setDraftPosition(undefined);
  };
  const pointerCancel = (event: PointerEvent) => {
    props.onPathNodePointerCancel?.(event);
    setDragGuide(undefined); setDraftPosition(undefined);
  };
  const contextMenu = (event: MouseEvent) => {
    const target = event.target;
    if (target instanceof SVGElement && target.closest(".canvas-guide-hit, .canvas-ruler-strip")) event.preventDefault();
  };

  onMount(() => {
    if (!root) return;
    const measure = () => { if (root) { const bounds = root.getBoundingClientRect(); setSize({ width: bounds.width, height: bounds.height }); } };
    measure();
    observer = new ResizeObserver(measure); observer.observe(root);
    window.addEventListener("resize", measure);
    onCleanup(() => { observer?.disconnect(); window.removeEventListener("resize", measure); });
  });
  onCleanup(() => { observer?.disconnect(); });

  return <div ref={element => { root = element; }} class="canvas-precision-overlay" aria-label="Canvas guides and measurement">
    <svg ref={element => { svg = element; }} viewBox={`0 0 ${Math.max(1, size().width)} ${Math.max(1, size().height)}`} preserveAspectRatio="none" onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel} onContextMenu={contextMenu}>
      <Show when={props.showGuides}>{props.guides.map((guide, index) => {
        const position = () => guidePosition(index, guide);
        const x = () => guide.axis === "x" ? leftInset() + props.state.panX + position() * props.state.zoom : leftInset();
        const y = () => guide.axis === "y" ? props.state.panY + position() * props.state.zoom : 0;
        const x2 = () => guide.axis === "x" ? x() : size().width;
        const y2 = () => guide.axis === "y" ? y() : Math.max(0, size().height - bottomInset());
        return <>
          <line class="canvas-guide-line" x1={x()} y1={y()} x2={x2()} y2={y2()} />
          <line class="canvas-guide-hit" x1={x()} y1={y()} x2={x2()} y2={y2()} onPointerDown={event => guidePointerDown(event, index, guide)} />
        </>;
      })}</Show>
      <Show when={dragGuide()?.created && draftPosition() !== undefined}>
        <line class="canvas-guide-line canvas-guide-draft" x1={dragGuide()?.axis === "x" ? leftInset() + props.state.panX + (draftPosition() ?? 0) * props.state.zoom : leftInset()} y1={dragGuide()?.axis === "y" ? props.state.panY + (draftPosition() ?? 0) * props.state.zoom : 0} x2={dragGuide()?.axis === "x" ? leftInset() + props.state.panX + (draftPosition() ?? 0) * props.state.zoom : size().width} y2={dragGuide()?.axis === "y" ? props.state.panY + (draftPosition() ?? 0) * props.state.zoom : Math.max(0, size().height - bottomInset())} />
      </Show>
      <Show when={props.snapFeedback?.x !== undefined}><line class="canvas-snap-line" x1={leftInset() + props.state.panX + props.snapFeedback!.x! * props.state.zoom} y1="0" x2={leftInset() + props.state.panX + props.snapFeedback!.x! * props.state.zoom} y2={Math.max(0, size().height - bottomInset())} /></Show>
      <Show when={props.snapFeedback?.y !== undefined}><line class="canvas-snap-line" x1={leftInset()} y1={props.state.panY + props.snapFeedback!.y! * props.state.zoom} x2={size().width} y2={props.state.panY + props.snapFeedback!.y! * props.state.zoom} /></Show>
      <Show when={props.snapFeedback?.equalSpacingX}><text class="canvas-snap-label" x={leftInset() + props.state.panX + (props.snapFeedback?.x ?? 0) * props.state.zoom + 5} y="18">Equal spacing</text></Show>
      <Show when={props.snapFeedback?.equalSpacingY}><text class="canvas-snap-label" x={leftInset() + 6} y={props.state.panY + (props.snapFeedback?.y ?? 0) * props.state.zoom - 5}>Equal spacing</text></Show>
      <For each={props.nodeHandles ?? []}>{node => <circle class="canvas-path-node-handle" classList={{ selected: !!node.selected }} cx={node.x} cy={node.y} r="6" onPointerDown={event => { if (props.disabled) return; event.preventDefault(); event.stopPropagation(); props.onPathNodePointerDown?.(node.index, event); }} />}</For>
      <Show when={props.measurement}>{measurement => {
        const x1 = () => leftInset() + props.state.panX + measurement().start.x * props.state.zoom;
        const y1 = () => props.state.panY + measurement().start.y * props.state.zoom;
        const x2 = () => leftInset() + props.state.panX + measurement().end.x * props.state.zoom;
        const y2 = () => props.state.panY + measurement().end.y * props.state.zoom;
        const dx = () => measurement().end.x - measurement().start.x;
        const dy = () => measurement().end.y - measurement().start.y;
        const distance = () => Math.hypot(dx(), dy());
        const label = () => `Δx ${formatRulerValue(dx(), 0.1)} · Δy ${formatRulerValue(dy(), 0.1)} · ${formatRulerValue(distance(), 0.1)} units`;
        return <g class="canvas-measurement" aria-label={label()}><line x1={x1()} y1={y1()} x2={x2()} y2={y2()} /><circle cx={x1()} cy={y1()} r="4" /><circle cx={x2()} cy={y2()} r="4" /><text x={(x1() + x2()) / 2 + 8} y={(y1() + y2()) / 2 - 8}>{label()}</text></g>;
      }}</Show>
      <Show when={props.showRulers}>
        <rect class="canvas-ruler-strip" x={RULER_SIZE} y={size().height - RULER_SIZE} width={Math.max(0, size().width - RULER_SIZE)} height={RULER_SIZE} onPointerDown={event => rulerPointerDown(event, "x")} />
        <rect class="canvas-ruler-strip" x="0" y="0" width={RULER_SIZE} height={Math.max(0, size().height - RULER_SIZE)} onPointerDown={event => rulerPointerDown(event, "y")} />
        <rect class="canvas-ruler-corner" x="0" y={size().height - RULER_SIZE} width={RULER_SIZE} height={RULER_SIZE} />
        <For each={xTicks()}>{tick => <>
          <line class={`canvas-ruler-tick ${tick.major ? "major" : ""}`} x1={tick.position} y1={size().height - (tick.major ? 12 : 6)} x2={tick.position} y2={size().height - 1} />
          {tick.label !== undefined && <text class="canvas-ruler-label" x={tick.position + 3} y={size().height - RULER_SIZE + 9}>{tick.label}</text>}
        </>}</For>
        <For each={yTicks()}>{tick => <>
          <line class={`canvas-ruler-tick ${tick.major ? "major" : ""}`} x1={RULER_SIZE - (tick.major ? 12 : 6)} y1={tick.position} x2={RULER_SIZE - 1} y2={tick.position} />
          {tick.label !== undefined && <text class="canvas-ruler-label vertical" x="7" y={tick.position - 3} transform={`rotate(-90 13 ${tick.position - 3})`}>{tick.label}</text>}
        </>}</For>
        <line class="canvas-ruler-edge" x1={RULER_SIZE} y1={size().height - RULER_SIZE} x2={size().width} y2={size().height - RULER_SIZE} />
        <line class="canvas-ruler-edge" x1={RULER_SIZE} y1="0" x2={RULER_SIZE} y2={size().height - RULER_SIZE} />
      </Show>
    </svg>
  </div>;
}
