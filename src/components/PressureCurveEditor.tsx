import { createSignal, For, onMount } from "solid-js";
import type { PressureCurvePoint } from "../model";
import { DEFAULT_PRESSURE_CURVE, PRESSURE_PRESETS, readPressureCurve, writePressureCurve, evaluateCurve } from "../features/canvas/pressure-curve";

type Props = {
  onClose: () => void;
};

export function PressureCurveEditor(props: Props) {
  const [curve, setCurve] = createSignal<PressureCurvePoint[]>(readPressureCurve().points);
  const [dragging, setDragging] = createSignal<number | null>(null);
  let svgRef: SVGSVGElement | undefined;

  const W = 200;
  const H = 160;
  const PAD = 16;

  function save(points: PressureCurvePoint[]) {
    setCurve(points);
    writePressureCurve({ ...readPressureCurve(), points });
  }

  function toSvgX(input: number) { return PAD + input * (W - PAD * 2); }
  function toSvgY(output: number) { return H - PAD - output * (H - PAD * 2); }
  function fromSvg(clientX: number, clientY: number): { input: number; output: number } {
    if (!svgRef) return { input: 0, output: 0 };
    const rect = svgRef.getBoundingClientRect();
    const x = (clientX - rect.left) * W / rect.width;
    const y = (clientY - rect.top) * H / rect.height;
    return {
      input: Math.max(0, Math.min(1, (x - PAD) / (W - PAD * 2))),
      output: Math.max(0, Math.min(1, (H - PAD - y) / (H - PAD * 2))),
    };
  }

  function curvePath(): string {
    const steps = 50;
    const points = curve();
    const parts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = evaluateCurve(points, t);
      const sx = toSvgX(t);
      const sy = toSvgY(y);
      parts.push(i === 0 ? `M${sx},${sy}` : `L${sx},${sy}`);
    }
    return parts.join(" ");
  }

  function handlePointerDown(index: number, event: PointerEvent) {
    event.preventDefault();
    (event.target as Element).setPointerCapture(event.pointerId);
    setDragging(index);
  }

  function handlePointerMove(event: PointerEvent) {
    const idx = dragging();
    if (idx === null) return;
    const { input, output } = fromSvg(event.clientX, event.clientY);
    const points = [...curve()];
    if (idx === 0) points[idx] = { input: 0, output };
    else if (idx === points.length - 1) points[idx] = { input: 1, output };
    else points[idx] = { input, output };
    save(points);
  }

  function handlePointerUp() { setDragging(null); }

  function addPoint(event: MouseEvent) {
    if (dragging() !== null) return;
    const { input, output } = fromSvg(event.clientX, event.clientY);
    const points = [...curve(), { input, output }].sort((a, b) => a.input - b.input);
    save(points);
  }

  function removePoint(index: number) {
    if (curve().length <= 2) return;
    const points = curve().filter((_, i) => i !== index);
    save(points);
  }

  return <aside class="pressure-curve-editor" aria-label="Pressure curve editor">
    <header>
      <strong>Pressure Curve</strong>
      <button type="button" aria-label="Close" onClick={props.onClose}>×</button>
    </header>
    <div class="pressure-curve-presets">
      <For each={PRESSURE_PRESETS}>{preset =>
        <button type="button" onClick={() => save(preset.points)}>{preset.name}</button>
      }</For>
    </div>
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} class="pressure-curve-canvas"
      onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onClick={addPoint}>
      <rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} class="curve-bg" />
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={PAD} class="curve-diagonal" />
      <path d={curvePath()} class="curve-line" />
      <For each={curve()}>{(point, index) =>
        <circle cx={toSvgX(point.input)} cy={toSvgY(point.output)} r="5" class="curve-handle"
          onPointerDown={[handlePointerDown, index()]}
          onDblClick={() => removePoint(index())} />
      }</For>
    </svg>
    <small>Click to add points. Double-click to remove. Drag to adjust.</small>
  </aside>;
}
