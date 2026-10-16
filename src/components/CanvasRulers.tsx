import { createEffect, createSignal, For, onCleanup } from "solid-js";

type Tick = { position: number; label?: string; major: boolean };
type Props = { viewport: HTMLElement; zoom: number; panX: number; panY: number; interfaceScale: number; windows?: boolean };
type Size = { width: number; height: number };
const RULER_SIZE = 24;

function majorStep(target: number) {
  const exponent = Math.floor(Math.log10(Math.max(1, target)));
  const unit = 10 ** exponent;
  const ratio = target / unit;
  return (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10) * unit;
}

function formatUnit(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function buildTicks(length: number, zoom: number, pan: number, interfaceScale: number): Tick[] {
  const safeZoom = Math.max(.02, zoom);
  const safeScale = Math.max(.1, interfaceScale);
  const renderedLength = length * safeScale;
  const worldMajor = majorStep(96 / safeZoom);
  const divisions = worldMajor / 5;
  const first = Math.floor((-pan / safeZoom) / divisions);
  const last = Math.ceil((renderedLength - pan) / safeZoom / divisions);
  const result: Tick[] = [];
  for (let index = first; index <= last; index++) {
    const world = index * divisions;
    const renderedPosition = pan + world * safeZoom;
    if (renderedPosition < 0 || renderedPosition > renderedLength) continue;
    const major = index % 5 === 0;
    result.push({ position: renderedPosition / safeScale, major, ...(major ? { label: formatUnit(world) } : {}) });
  }
  return result;
}

export function CanvasRulers(props: Props) {
  const initialRect = props.viewport.getBoundingClientRect();
  const initialScale = Math.max(.1, props.interfaceScale);
  const [size, setSize] = createSignal<Size>({ width: Math.max(1, initialRect.width / initialScale), height: Math.max(1, initialRect.height / initialScale) });
  let scaleFrame = 0;
  const measure = () => {
    // Canvas pan and pointer coordinates use rendered CSS pixels. Convert the
    // canvas dimensions to the app's unscaled layout space with the exact scale
    // setting, then place rendered-coordinate ticks into that same SVG space.
    const rect = props.viewport.getBoundingClientRect();
    const scale = Math.max(.1, props.interfaceScale);
    setSize({ width: Math.max(1, rect.width / scale), height: Math.max(1, rect.height / scale) });
  };

  const observer = new ResizeObserver(measure);
  observer.observe(props.viewport);
  window.addEventListener("resize", measure);
  window.visualViewport?.addEventListener("resize", measure);
  createEffect(() => {
    void props.interfaceScale;
    cancelAnimationFrame(scaleFrame);
    scaleFrame = requestAnimationFrame(measure);
  });
  onCleanup(() => {
    observer.disconnect();
    window.removeEventListener("resize", measure);
    window.visualViewport?.removeEventListener("resize", measure);
    cancelAnimationFrame(scaleFrame);
  });

  const width = () => size().width;
  const height = () => size().height;
  const horizontal = () => buildTicks(width(), props.zoom, props.panX, props.interfaceScale);
  const vertical = () => buildTicks(height(), props.zoom, props.panY, props.interfaceScale);
  return <div class={`canvas-rulers ${props.windows ? "windows-rulers" : ""}`} aria-label="Canvas rulers in drawing units">
    <svg class="canvas-ruler-top" width={width()} height={RULER_SIZE} viewBox={`0 0 ${width()} ${RULER_SIZE}`} aria-hidden="true">
      <rect width="100%" height="100%" />
      <For each={horizontal()}>
        {tick => (
          <g>
            <path d={`M${tick.position} ${RULER_SIZE}V${tick.major ? RULER_SIZE - 11 : RULER_SIZE - 5}`} />
            {tick.label !== undefined ? <text x={tick.position + 3} y="9">{tick.label}</text> : null}
          </g>
        )}
      </For>
    </svg>
    <svg class="canvas-ruler-left" width={RULER_SIZE} height={height()} viewBox={`0 0 ${RULER_SIZE} ${height()}`} aria-hidden="true">
      <rect width="100%" height="100%" />
      <For each={vertical()}>
        {tick => (
          <g>
            <path d={`M${RULER_SIZE} ${tick.position}H${tick.major ? RULER_SIZE - 11 : RULER_SIZE - 5}`} />
            {tick.label !== undefined ? <text text-anchor="middle" transform={`rotate(-90 ${RULER_SIZE / 2} ${tick.position})`} x={RULER_SIZE / 2} y={tick.position + 3}>{tick.label}</text> : null}
          </g>
        )}
      </For>
    </svg>
    <i class="canvas-ruler-corner"><span>px</span></i>
  </div>;
}
