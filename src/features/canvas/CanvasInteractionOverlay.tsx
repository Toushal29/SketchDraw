import { For, createSignal, onCleanup, onMount, Show } from "solid-js";
import type { CanvasState, Point } from "../../model";

type Measurement = { start: Point; end: Point };
type NodeHandle = { index: number; x: number; y: number; selected?: boolean };

type Props = {
  state: CanvasState;
  measurement?: Measurement;
  nodeHandles?: NodeHandle[];
  disabled: boolean;
  onPathNodePointerDown?: (index: number, event: PointerEvent) => void;
  onPathNodePointerMove?: (event: PointerEvent) => void;
  onPathNodePointerUp?: (event: PointerEvent) => void;
  onPathNodePointerCancel?: (event: PointerEvent) => void;
};

const formatMeasurement = (value: number) => Number(value.toFixed(1)).toString();

export function CanvasInteractionOverlay(props: Props) {
  const [size, setSize] = createSignal({ width: 0, height: 0 });
  let root: HTMLDivElement | undefined;

  const pointerMove = (event: PointerEvent) => props.onPathNodePointerMove?.(event);
  const pointerUp = (event: PointerEvent) => props.onPathNodePointerUp?.(event);
  const pointerCancel = (event: PointerEvent) => props.onPathNodePointerCancel?.(event);

  onMount(() => {
    if (!root) return;
    const measure = () => {
      if (!root) return;
      const bounds = root.getBoundingClientRect();
      setSize({ width: bounds.width, height: bounds.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    window.addEventListener("resize", measure);
    onCleanup(() => { observer.disconnect(); window.removeEventListener("resize", measure); });
  });

  return <div ref={element => { root = element; }} class="canvas-interaction-overlay" aria-label="Canvas edit controls">
    <svg viewBox={`0 0 ${Math.max(1, size().width)} ${Math.max(1, size().height)}`} preserveAspectRatio="none" onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel}>
      <For each={props.nodeHandles ?? []}>{node => <circle class="canvas-path-node-handle" classList={{ selected: !!node.selected }} cx={node.x} cy={node.y} r="6" onPointerDown={event => {
        if (props.disabled) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
        props.onPathNodePointerDown?.(node.index, event);
      }} />}</For>
      <Show when={props.measurement}>{measurement => {
        const x1 = () => props.state.panX + measurement().start.x * props.state.zoom;
        const y1 = () => props.state.panY + measurement().start.y * props.state.zoom;
        const x2 = () => props.state.panX + measurement().end.x * props.state.zoom;
        const y2 = () => props.state.panY + measurement().end.y * props.state.zoom;
        const dx = () => measurement().end.x - measurement().start.x;
        const dy = () => measurement().end.y - measurement().start.y;
        const distance = () => Math.hypot(dx(), dy());
        const label = () => `Δx ${formatMeasurement(dx())} · Δy ${formatMeasurement(dy())} · ${formatMeasurement(distance())} units`;
        return <g class="canvas-measurement" aria-label={label()}><line x1={x1()} y1={y1()} x2={x2()} y2={y2()} /><circle cx={x1()} cy={y1()} r="4" /><circle cx={x2()} cy={y2()} r="4" /><text x={(x1() + x2()) / 2 + 8} y={(y1() + y2()) / 2 - 8}>{label()}</text></g>;
      }}</Show>
    </svg>
  </div>;
}
