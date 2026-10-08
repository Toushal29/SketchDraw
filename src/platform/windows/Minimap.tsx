import { For, createMemo } from "solid-js";
import type { Element, Point } from "../../model";
import { elementBounds, unionBounds } from "../../features/canvas/bounds";

const WIDTH = 224;
const HEIGHT = 144;
const PAD = 10;

type Props = {
  elements: Element[];
  zoom: number;
  panX: number;
  panY: number;
  viewportWidth: number;
  viewportHeight: number;
  onNavigate: (center: Point) => void;
  onClose: () => void;
};

export function Minimap(props: Props) {
  const bounds = createMemo(() => {
    const zoom = Math.max(.02, props.zoom);
    const viewport = { x: -props.panX / zoom, y: -props.panY / zoom, w: props.viewportWidth / zoom, h: props.viewportHeight / zoom };
    return unionBounds([...props.elements.filter(element => !element.hidden).map(elementBounds), viewport]) ?? viewport;
  });
  const scale = () => Math.min((WIDTH - PAD * 2) / Math.max(1, bounds().w), (HEIGHT - PAD * 2) / Math.max(1, bounds().h));
  const mapX = (x: number) => PAD + (x - bounds().x) * scale();
  const mapY = (y: number) => PAD + (y - bounds().y) * scale();
  const mapWidth = (w: number) => Math.max(1, w * scale());
  const mapHeight = (h: number) => Math.max(1, h * scale());
  let svg: SVGSVGElement | undefined;
  let pointerDown = false;

  function navigate(event: PointerEvent) {
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = (event.clientX - rect.left) * WIDTH / rect.width;
    const y = (event.clientY - rect.top) * HEIGHT / rect.height;
    props.onNavigate({ x: bounds().x + (x - PAD) / scale(), y: bounds().y + (y - PAD) / scale() });
  }

  return <aside class="windows-minimap" aria-label="Board minimap">
    <header><strong>Minimap</strong><button type="button" aria-label="Close minimap" title="Close minimap" onClick={props.onClose}>×</button></header>
    <svg ref={svg} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Click or drag to navigate the board"
      onPointerDown={event => { pointerDown = true; event.currentTarget.setPointerCapture(event.pointerId); navigate(event); }}
      onPointerMove={event => { if (pointerDown) navigate(event); }}
      onPointerUp={() => { pointerDown = false; }}
      onLostPointerCapture={() => { pointerDown = false; }}>
      <rect class="minimap-board" x="0.5" y="0.5" width={WIDTH - 1} height={HEIGHT - 1} rx="7" />
      <For each={props.elements.filter(element => !element.hidden)}>{element => {
        const box = elementBounds(element);
        return <rect class="minimap-object" classList={{ "minimap-image": element.type === "image", "minimap-freehand": element.type === "freehand" }}
          x={mapX(box.x)} y={mapY(box.y)} width={mapWidth(box.w)} height={mapHeight(box.h)} />;
      }}</For>
      <rect class="minimap-viewport" x={mapX(-props.panX / props.zoom)} y={mapY(-props.panY / props.zoom)}
        width={mapWidth(props.viewportWidth / props.zoom)} height={mapHeight(props.viewportHeight / props.zoom)} />
    </svg>
  </aside>;
}
