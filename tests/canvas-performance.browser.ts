import { createFreehandRenderer } from "../src/features/canvas/freehand-rendering";
import { createCanvasRenderScheduler } from "../src/features/canvas/rendering";
import { createStrokeSampleGate } from "../src/features/canvas/stroke-input";
import type { FreehandElement, StrokePoint } from "../src/model";

type Renderer = ReturnType<typeof createFreehandRenderer>;
declare global {
  var __baselineRenderer: (() => Renderer) | undefined;
  var __canvasAudit: Promise<unknown>;
}

const failures: string[] = [];
const checks: string[] = [];
function check(condition: boolean, description: string) { (condition ? checks : failures).push(description); }
function canvas(width = 360, height = 200) { const value = document.createElement("canvas"); value.width = width; value.height = height; return value; }
function stroke(pressure: boolean, count = 180, thickness = 12, opacity = .28): FreehandElement {
  return { type: "freehand", color: "#202124", thickness, opacity, points: Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    return { x: 35 + 270 * t, y: 100 + 35 * Math.sin(t * Math.PI * 2), ...(pressure ? { pressure: .5 + .4 * Math.sin(t * 6), tiltX: 15, tiltY: 10 } : {}) };
  }) };
}
function draw(renderer: Renderer, target: HTMLCanvasElement, element: FreehandElement, cached = true, zoom = 1) {
  const ctx = target.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, target.width, target.height);
  ctx.setTransform(zoom, 0, 0, zoom, 0, 0); ctx.globalAlpha = element.opacity ?? 1;
  renderer.draw(ctx, element, element.color, cached);
  return ctx;
}
function alphaDifference(a: HTMLCanvasElement, b: HTMLCanvasElement) {
  const left = a.getContext("2d")!.getImageData(0, 0, a.width, a.height).data;
  const right = b.getContext("2d")!.getImageData(0, 0, b.width, b.height).data;
  let maximum = 0; let total = 0;
  for (let i = 3; i < left.length; i += 4) { const delta = Math.abs(left[i] - right[i]); maximum = Math.max(maximum, delta); total += delta; }
  return { maximum, mean: total / (left.length / 4) };
}
function maxAlpha(target: HTMLCanvasElement) {
  const data = target.getContext("2d")!.getImageData(0, 0, target.width, target.height).data;
  let maximum = 0; for (let i = 3; i < data.length; i += 4) maximum = Math.max(maximum, data[i]); return maximum;
}
function percentile(values: number[], fraction: number) { return [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * fraction))]; }

async function run() {
  const renderer = createFreehandRenderer();
  const reference = globalThis.__baselineRenderer?.() ?? createFreehandRenderer();
  const actual = canvas(); const expected = canvas(); const visualDifferences = [];
  for (const pressure of [false, true]) for (const opacity of [1, .62, .9, .78, .28, .48]) {
    const element = stroke(pressure, 180, opacity === .28 ? 30 : 8, opacity);
    draw(renderer, actual, element); draw(reference, expected, element, false);
    const difference = alphaDifference(actual, expected); visualDifferences.push({ pressure, opacity, ...difference });
    check(difference.maximum <= 2, `${pressure ? "Pressure" : "Mouse/touch"} stroke appearance retained at opacity ${opacity}`);
    check(maxAlpha(actual) <= Math.ceil(opacity * 255) + 1, `No dark overlap at opacity ${opacity}, pressure ${pressure}`);
  }
  const straight: FreehandElement = { type: "freehand", points: [{ x: 60, y: 80 }, { x: 240, y: 80 }], color: "#202124", thickness: 30, opacity: .28 };
  const ctx = draw(renderer, actual, straight);
  const alpha = (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data[3];
  check(Math.abs(alpha(245, 80) - alpha(150, 80)) <= 1 && alpha(252, 80) > 0 && alpha(256, 80) === 0, "Round terminal cap has uniform opacity and expected radius");
  const mutable = stroke(true);
  for (const change of [() => {}, () => { mutable.thickness = 28; }, () => { mutable.points.push({ x: 325, y: 120, pressure: .9 }); }]) {
    change(); draw(renderer, actual, mutable); draw(reference, expected, mutable, false);
    check(alphaDifference(actual, expected).maximum <= 2, "Raster invalidates after thickness/sample changes");
  }
  draw(renderer, actual, { ...mutable, color: "#cc2200" });
  const color = actual.getContext("2d")!.getImageData(100, 135, 1, 1).data;
  check(color[0] > color[1], "Raster invalidates after ink color changes");
  draw(renderer, actual, mutable, true, .8); draw(reference, expected, mutable, false, .8);
  check(alphaDifference(actual, expected).maximum <= 2, "Raster invalidates at changed zoom");
  let reads = 0;
  const long = stroke(true, 4000);
  long.points = new Proxy(long.points, { get(target, property, receiver) { if (typeof property === "string" && /^\d+$/.test(property)) reads++; return Reflect.get(target, property, receiver); } });
  draw(renderer, actual, long, false); reads = 0;
  long.points.push({ x: 307, y: 101, pressure: .6 }); draw(renderer, actual, long, false);
  check(reads < 50, `Appending one point does bounded JS path work (${reads} point reads)`);

  const gate = createStrokeSampleGate(); gate.reset(10);
  check(gate.accept("pointer", 11) && gate.accept("pointer", 12) && !gate.accept("pointer", 11) && !gate.accept("pointer", 12) && gate.accept("pointer", 13), "Raw and coalesced pointer samples cannot replay older points");
  check(!gate.accept("native", 90000), "Late Android batches cannot interleave another clock");
  gate.reset(20);
  check(gate.accept("native", 91000) && !gate.accept("pointer", 21) && gate.accept("native", 91004), "Native input owns the stroke when it arrives first");
  gate.reset(30); check(gate.accept("pointer", 31), "Next stroke resets input ownership");

  const target = canvas(120, 80); target.style.cssText = "width:120px;height:80px"; document.body.append(target);
  let active = true; let scenes = 0; let previews = 0; let red = false;
  const scheduler = createCanvasRenderScheduler({
    canvas: () => target, hasDocument: () => true, hasStrokePreview: () => active,
    drawScene: (context, width, height, dpr) => { scenes++; context.setTransform(dpr, 0, 0, dpr, 0, 0); context.fillStyle = red ? "#ff0000" : "#ffffff"; context.fillRect(0, 0, width, height); },
    drawStrokePreview: (context, dpr) => { previews++; context.setTransform(dpr, 0, 0, dpr, 0, 0); context.fillStyle = "#000000"; context.fillRect(previews * 10, 20, 5, 5); },
  });
  scheduler.render(); scheduler.render(); scheduler.render();
  check(scenes === 1 && previews === 3, "Live stroke frames reuse the static scene");
  check(target.getContext("2d")!.getImageData(11, 21, 1, 1).data[0] === 255, "Previous live tip is erased before the next frame");
  red = true; scheduler.schedule();
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  check(scenes === 2, "Scene changes invalidate the drawing background");
  target.style.width = "140px"; scheduler.render();
  check(scenes === 3, "Canvas resizing invalidates the drawing background");
  active = false; scheduler.render(); check(scenes === 4, "Pen-up returns to normal scene rendering");
  scheduler.dispose(); target.remove();

  // Force the cache past its count budget and ensure hot strokes aren't rebuilt
  // in a loop when the visible working set is larger than the cache.
  const saturated = createFreehandRenderer(); const many = Array.from({ length: 280 }, () => stroke(true, 70));
  const originalCreate = document.createElement.bind(document); let allocations = 0;
  document.createElement = ((name: string, options?: ElementCreationOptions) => { if (name === "canvas") allocations++; return originalCreate(name, options); }) as typeof document.createElement;
  try {
    for (const element of many) draw(saturated, actual, element);
    allocations = 0;
    for (const element of many) draw(saturated, actual, element);
    check(allocations < 5, `Oversized working set avoids raster-cache churn (${allocations} allocations)`);
  } finally { document.createElement = originalCreate; saturated.dispose(); }

  function crowded(factory: () => Renderer) {
    const painter = factory(); const output = canvas(1200, 800); const context = output.getContext("2d")!;
    const elements = Array.from({ length: 160 }, (_, index) => {
      const element = stroke(true, 240, 3 + index % 3, .28 + index % 4 * .2);
      element.points = element.points.map(point => ({ ...point, x: (index % 10) * 120 + point.x / 3, y: Math.floor(index / 10) * 48 + (point.y - 50) / 3 }));
      return element;
    });
    const times: number[] = [];
    for (let frame = 0; frame < 24; frame++) {
      const start = performance.now();
      context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, output.width, output.height);
      context.translate(frame % 6, frame % 4);
      for (const element of elements) { context.globalAlpha = element.opacity!; painter.draw(context, element, element.color); }
      // Force deferred Canvas work to finish, so the measurements include painting.
      context.getImageData(0, 0, 1, 1);
      if (frame > 3) times.push(performance.now() - start);
    }
    painter.dispose?.();
    return { medianMs: +percentile(times, .5).toFixed(2), p95Ms: +percentile(times, .95).toFixed(2) };
  }
  function live(factory: () => Renderer) {
    const painter = factory(); const output = canvas(1200, 800);
    const allPoints: StrokePoint[] = Array.from({ length: 3200 }, (_, i) => ({ x: 30 + i * .32, y: 350 + Math.sin(i / 70) * 140, pressure: .55 + Math.sin(i / 48) * .35 }));
    const element: FreehandElement = { type: "freehand", points: [], thickness: 18, color: "#202124", opacity: .28 };
    const times: number[] = [];
    for (let i = 0; i < allPoints.length; i += 40) {
      element.points.push(...allPoints.slice(i, i + 40));
      const start = performance.now(); const context = draw(painter, output, element, false);
      context.getImageData(0, 0, 1, 1); if (i >= 1600) times.push(performance.now() - start);
    }
    painter.dispose?.();
    return { medianMs: +percentile(times, .5).toFixed(2), p95Ms: +percentile(times, .95).toFixed(2) };
  }
  const performanceResults = {
    workload: "160 pressure strokes, 240 samples each, 1200x800 canvas, software-rendered panning",
    baseline: globalThis.__baselineRenderer ? crowded(globalThis.__baselineRenderer) : undefined, updated: crowded(createFreehandRenderer),
    liveStroke: { samples: 3200, baseline: globalThis.__baselineRenderer ? live(globalThis.__baselineRenderer) : undefined, updated: live(createFreehandRenderer) },
  };
  renderer.dispose(); reference.dispose?.();
  return { checks: checks.length, failures, visualDifferences, performance: performanceResults };
}
globalThis.__canvasAudit = run();
