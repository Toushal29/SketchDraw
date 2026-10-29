import type { GroupElement, Theme } from "../../model";

type ChartEngine = typeof import("./chart-engine");

let engine: ChartEngine | undefined;
let loading: Promise<void> | undefined;
const readyCallbacks = new Set<() => void>();

// echarts is large, so it loads on first use. Until then charts draw nothing and `onReady` requests a repaint.
export function drawLibraryChartLazy(ctx: CanvasRenderingContext2D, group: GroupElement, theme: Theme, onReady: () => void) {
  if (engine) { engine.drawLibraryChart(ctx, group, theme); return; }
  readyCallbacks.add(onReady);
  loading ??= import("./chart-engine").then(module => {
    engine = module;
    const callbacks = [...readyCallbacks];
    readyCallbacks.clear();
    for (const callback of callbacks) callback();
  }, () => { loading = undefined; readyCallbacks.clear(); });
}
