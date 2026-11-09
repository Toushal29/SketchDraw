import { createSignal, For, Show, onMount, onCleanup, createMemo } from "solid-js";

export type RadialMenuSubItem = {
  id: string;
  label: string;
  color?: string;
  action: () => void;
};

export type RadialMenuItem = {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  action?: () => void;
  children?: RadialMenuSubItem[];
};

type Props = {
  x: number;
  y: number;
  items: RadialMenuItem[];
  onClose: () => void;
};

const HUB_R = 32;
const RING_INNER = 40;
const RING_OUTER = 115;
const SUB_INNER = 122;
const SUB_OUTER = 210;
const TOTAL_R = SUB_OUTER + 24;
const SIZE = TOTAL_R * 2;
const CX = SIZE / 2;
const CY = SIZE / 2;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function wedgePath(ir: number, or: number, startDeg: number, endDeg: number, gap = 1.5): string {
  const s = startDeg + gap;
  const e = endDeg - gap;
  if (e <= s) return "";
  const p1 = polar(CX, CY, ir, s);
  const p2 = polar(CX, CY, or, s);
  const p3 = polar(CX, CY, or, e);
  const p4 = polar(CX, CY, ir, e);
  const large = e - s > 180 ? 1 : 0;
  return `M${p1.x},${p1.y} L${p2.x},${p2.y} A${or},${or},0,${large},1,${p3.x},${p3.y} L${p4.x},${p4.y} A${ir},${ir},0,${large},0,${p1.x},${p1.y}Z`;
}

function bridgePath(innerR: number, outerR: number, startDeg: number, endDeg: number): string {
  const p1 = polar(CX, CY, innerR, startDeg);
  const p2 = polar(CX, CY, outerR, startDeg);
  const p3 = polar(CX, CY, outerR, endDeg);
  const p4 = polar(CX, CY, innerR, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M${p1.x},${p1.y} L${p2.x},${p2.y} A${outerR},${outerR},0,${large},1,${p3.x},${p3.y} L${p4.x},${p4.y} A${innerR},${innerR},0,${large},0,${p1.x},${p1.y}Z`;
}

export function RadialContextMenu(props: Props) {
  const [visible, setVisible] = createSignal(false);
  const [activeParent, setActiveParent] = createSignal<string | null>(null);
  const [hoveredItem, setHoveredItem] = createSignal<string | null>(null);
  const [hoveredSub, setHoveredSub] = createSignal<string | null>(null);

  let closeTimer: number | undefined;

  function scheduleClose(delay = 400) {
    clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      setActiveParent(null);
      setHoveredSub(null);
    }, delay);
  }

  function cancelClose() {
    clearTimeout(closeTimer);
  }

  onMount(() => {
    requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", onKey);
    onCleanup(() => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(closeTimer);
    });
  });

  const count = createMemo(() => props.items.length);
  const slice = createMemo(() => 360 / count());

  function startDeg(i: number) { return i * slice(); }
  function endDeg(i: number) { return (i + 1) * slice(); }
  function midDeg(i: number) { return startDeg(i) + slice() / 2; }

  const clampX = () => Math.max(TOTAL_R, Math.min(window.innerWidth - TOTAL_R, props.x));
  const clampY = () => Math.max(TOTAL_R, Math.min(window.innerHeight - TOTAL_R, props.y));

  return (
    <div class="radial-menu-backdrop" onPointerDown={props.onClose}>
      <div
        class="radial-menu-wheel"
        classList={{ "radial-menu-visible": visible() }}
        style={{
          left: `${clampX()}px`,
          top: `${clampY()}px`,
          width: `${SIZE}px`,
          height: `${SIZE}px`,
          "margin-left": `${-SIZE / 2}px`,
          "margin-top": `${-SIZE / 2}px`,
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} class="radial-svg">
          {/* Main ring wedges */}
          <For each={props.items}>
            {(item, index) => {
              const i = index;
              const hasKids = () => !!item.children?.length;
              const isActive = () => hoveredItem() === item.id || activeParent() === item.id;
              const labelPos = () => polar(CX, CY, (RING_INNER + RING_OUTER) / 2, midDeg(i()));
              return (
                <g
                  class="radial-wedge-g"
                  classList={{ "radial-wedge-active": isActive() }}
                  onPointerEnter={() => {
                    setHoveredItem(item.id);
                    if (hasKids()) {
                      cancelClose();
                      setActiveParent(item.id);
                    }
                  }}
                  onPointerLeave={() => {
                    setHoveredItem(null);
                    if (hasKids()) scheduleClose();
                  }}
                  onClick={() => {
                    if (item.action && !hasKids()) {
                      item.action();
                      props.onClose();
                    }
                  }}
                  style={{ cursor: item.action || hasKids() ? "pointer" : "default" }}
                >
                  <path class="radial-wedge-path" d={wedgePath(RING_INNER, RING_OUTER, startDeg(i()), endDeg(i()))} />
                  <text x={labelPos().x} y={labelPos().y - 8} class="radial-icon" text-anchor="middle" dominant-baseline="central">
                    {item.icon ?? item.label.slice(0, 2)}
                  </text>
                  <text x={labelPos().x} y={labelPos().y + 10} class="radial-label" text-anchor="middle" dominant-baseline="central">
                    {item.label}
                  </text>
                  <Show when={hasKids()}>
                    {(() => {
                      const tip = polar(CX, CY, RING_OUTER - 10, midDeg(i()));
                      return <text x={tip.x} y={tip.y} class="radial-expand-hint" text-anchor="middle" dominant-baseline="central">···</text>;
                    })()}
                  </Show>
                </g>
              );
            }}
          </For>

          {/* Invisible bridge + sub-ring for expanded parent */}
          <For each={props.items}>
            {(item, index) => {
              const i = index;
              const isExpanded = () => activeParent() === item.id && !!item.children?.length;
              return (
                <Show when={isExpanded()}>
                  <path
                    class="radial-bridge"
                    d={bridgePath(RING_OUTER - 2, SUB_INNER + 2, startDeg(i()), endDeg(i()))}
                    onPointerEnter={() => { cancelClose(); setActiveParent(item.id); }}
                    onPointerLeave={() => scheduleClose()}
                  />

                  <g class="radial-sub-ring" onPointerEnter={cancelClose} onPointerLeave={() => scheduleClose()}>
                    <For each={item.children!}>
                      {(sub, si) => {
                        const sCount = item.children!.length;
                        const parentStart = startDeg(i());
                        const parentSpan = endDeg(i()) - startDeg(i());
                        const subSlice = parentSpan / sCount;
                        const sStart = () => parentStart + si() * subSlice;
                        const sEnd = () => sStart() + subSlice;
                        const sMid = () => (sStart() + sEnd()) / 2;
                        const labelP = () => polar(CX, CY, (SUB_INNER + SUB_OUTER) / 2, sMid());
                        const isSubActive = () => hoveredSub() === sub.id;
                        return (
                          <g
                            class="radial-sub-g"
                            classList={{ "radial-sub-active": isSubActive() }}
                            onPointerEnter={() => { cancelClose(); setHoveredSub(sub.id); }}
                            onPointerLeave={() => setHoveredSub(null)}
                            onClick={() => { sub.action(); props.onClose(); }}
                            style={{ cursor: "pointer" }}
                          >
                            <path
                              class="radial-sub-path"
                              d={wedgePath(SUB_INNER, SUB_OUTER, sStart(), sEnd(), 1)}
                              style={sub.color && isSubActive() ? { fill: sub.color, opacity: 0.85 } : undefined}
                            />
                            <Show when={sub.color}>
                              {(() => {
                                const dot = polar(CX, CY, (SUB_INNER + SUB_OUTER) / 2, sMid());
                                return <circle cx={dot.x} cy={dot.y} r="12" fill={sub.color} stroke="var(--theme-surface-elevated)" stroke-width="2.5" style={{ "pointer-events": "none" }} />;
                              })()}
                            </Show>
                            <Show when={!sub.color}>
                              <text x={labelP().x} y={labelP().y} class="radial-sub-text" text-anchor="middle" dominant-baseline="central">
                                {sub.label}
                              </text>
                            </Show>
                          </g>
                        );
                      }}
                    </For>
                  </g>
                </Show>
              );
            }}
          </For>

          {/* Center hub */}
          <circle cx={CX} cy={CY} r={HUB_R} class="radial-hub-bg" />
          <g class="radial-hub-close" onClick={props.onClose} style={{ cursor: "pointer" }}>
            <circle cx={CX} cy={CY} r={HUB_R - 2} class="radial-hub-hit" />
            <line x1={CX - 7} y1={CY - 7} x2={CX + 7} y2={CY + 7} class="radial-hub-x" />
            <line x1={CX + 7} y1={CY - 7} x2={CX - 7} y2={CY + 7} class="radial-hub-x" />
          </g>
        </svg>
      </div>
    </div>
  );
}
