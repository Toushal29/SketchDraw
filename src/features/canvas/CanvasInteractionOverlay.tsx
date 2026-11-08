import { For, createSignal, onCleanup, onMount, Show } from "solid-js";
import type { CanvasState, Point } from "../../model";

type Measurement = { start: Point; end: Point; detail?: { gapX: number; gapY: number; distance: number; alignment: string; equalSpacing?: { axis: "x" | "y"; gap: number } } };
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
        const detail = () => measurement().detail;
        const distance = () => detail()?.distance ?? Math.hypot(dx(), dy());
        const label = () => `Δx ${formatMeasurement(detail()?.gapX ?? Math.abs(dx()))} · Δy ${formatMeasurement(detail()?.gapY ?? Math.abs(dy()))} · distance ${formatMeasurement(distance())} units`;
        return <g class="canvas-measurement" aria-label={label()}>
          <line class="measurement-projection" x1={x1()} y1={y1()} x2={x2()} y2={y1()} />
          <line class="measurement-projection" x1={x2()} y1={y1()} x2={x2()} y2={y2()} />
          <line class="measurement-distance" x1={x1()} y1={y1()} x2={x2()} y2={y2()} />
          <circle cx={x1()} cy={y1()} r="4" /><circle cx={x2()} cy={y2()} r="4" />
          <text class="measurement-x" x={(x1() + x2()) / 2} y={y1() - 8} text-anchor="middle">Δx {formatMeasurement(detail()?.gapX ?? Math.abs(dx()))}</text>
          <text class="measurement-y" x={x2() + 8} y={(y1() + y2()) / 2} dominant-baseline="middle">Δy {formatMeasurement(detail()?.gapY ?? Math.abs(dy()))}</text>
          <text class="measurement-total" x={(x1() + x2()) / 2 + 8} y={(y1() + y2()) / 2 - 8}>distance {formatMeasurement(distance())}</text>
          <Show when={detail()?.alignment}><text class="measurement-note" x={(x1() + x2()) / 2 + 8} y={(y1() + y2()) / 2 + 10}>Aligned: {detail()!.alignment}</text></Show>
          <Show when={detail()?.equalSpacing}><text class="measurement-note" x={(x1() + x2()) / 2 + 8} y={(y1() + y2()) / 2 + 24}>Equal {detail()!.equalSpacing!.axis === "x" ? "horizontal" : "vertical"} gaps · {formatMeasurement(detail()!.equalSpacing!.gap)}</text></Show>
        </g>;
      }}</Show>
    </svg>
  </div>;
}
