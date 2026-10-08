import { For } from "solid-js";

type Tick = { position: number; label?: string; major: boolean };
type Props = { width: number; height: number; zoom: number; panX: number; panY: number };

function niceStep(target: number) {
  const power = 10 ** Math.floor(Math.log10(Math.max(1, target)));
  const scaled = target / power;
  return (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10) * power;
}

function formatCoordinate(value: number) {
  const rounded = Math.round(value * 100) / 100;
  const text = String(rounded);
  return text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
}

function ticks(size: number, zoom: number, pan: number): Tick[] {
  const safeZoom = Math.max(.02, zoom);
  const majorStep = niceStep(96 / safeZoom);
  const minorStep = majorStep / 5;
  const screenStep = minorStep * safeZoom;
  const first = Math.floor((-pan / safeZoom) / minorStep);
  const count = Math.ceil(size / screenStep) + 2;
  return Array.from({ length: count }, (_, offset) => {
    const index = first + offset;
    const world = index * minorStep;
    const position = pan + world * safeZoom;
    const major = index % 5 === 0;
    return { position, major, ...(major ? { label: formatCoordinate(world) } : {}) };
  }).filter(tick => tick.position >= 0 && tick.position <= size);
}

export function CanvasRulers(props: Props) {
  const horizontal = () => ticks(props.width, props.zoom, props.panX);
  const vertical = () => ticks(props.height, props.zoom, props.panY);
  return <div class="canvas-rulers" aria-label="Canvas rulers in drawing units">
    <svg class="canvas-ruler-top" width={props.width} height="20" aria-hidden="true">
      <rect width="100%" height="100%" />
      <For each={horizontal()}>{tick => <><path d={`M${tick.position} 20V${tick.major ? 10 : 15}`} />{tick.label && <text x={tick.position + 3} y="9">{tick.label}</text>}</>}</For>
      <text class="ruler-unit" x="5" y="18">px</text>
    </svg>
    <svg class="canvas-ruler-left" width="20" height={props.height} aria-hidden="true">
      <rect width="100%" height="100%" />
      <For each={vertical()}>{tick => <><path d={`M20 ${tick.position}H${tick.major ? 10 : 15}`} />{tick.label && <text text-anchor="middle" transform={`rotate(-90 10 ${tick.position})`} x="10" y={tick.position + 3}>{tick.label}</text>}</>}</For>
    </svg>
    <i class="canvas-ruler-corner" />
  </div>;
}
