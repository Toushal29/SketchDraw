import { createFreehandRenderer } from "../src/features/canvas/freehand-rendering";
import { createCanvasRenderScheduler } from "../src/features/canvas/rendering";
import { createStrokeSampleGate } from "../src/features/canvas/stroke-input";
import { gridStepForStyle, gridSvgPattern, snapCanvasPoint } from "../src/features/canvas/input";
import { alignedTextStartX } from "../src/operations";
import mobileToolbarCss from "../src/platform/mobile/touch-toolbar.css?inline";
import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { CanvasOptionsMenu } from "../src/components/CanvasOptionsMenu";
import { parseSchema } from "../src/schema";
import { layoutMermaidFlowchart, parseMermaidFlowchart } from "../src/mermaid";
import { exportDiagramCode, plantUmlToDiagram } from "../src/features/diagrams/code-formats";
import { importDrawio, exportDrawio, importExcalidraw, exportExcalidraw } from "../src/features/diagrams/interchange";
import { structuredYamlToDiagram, bicepToDiagram, kubernetesToDiagram } from "../src/features/diagrams/structured-data";
import { svgPrimitivesToElements } from "../src/features/diagrams/svg-vectors";
import type { FreehandElement, ShapeElement, StrokePoint } from "../src/model";

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
function draw(renderer: Renderer, target: HTMLCanvasElement, element: FreehandElement, cached = true, zoom = 1, preview = false) {
  const ctx = target.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, target.width, target.height);
  ctx.setTransform(zoom, 0, 0, zoom, 0, 0); ctx.globalAlpha = element.opacity ?? 1;
  renderer.draw(ctx, element, element.color, cached, preview);
  return ctx;
}
function alphaDifference(a: HTMLCanvasElement, b: HTMLCanvasElement) {
  const left = a.getContext("2d")!.getImageData(0, 0, a.width, a.height).data;
  const right = b.getContext("2d")!.getImageData(0, 0, b.width, b.height).data;
  let maximum = 0; let total = 0; let changedPixels = 0; let maxAt: { x: number; y: number; actual: number; reference: number } | undefined;
  for (let i = 3; i < left.length; i += 4) {
    const delta = Math.abs(left[i] - right[i]); total += delta;
    if (delta > 2) changedPixels++;
    if (delta > maximum) { maximum = delta; const pixel = (i - 3) / 4; maxAt = { x: pixel % a.width, y: Math.floor(pixel / a.width), actual: left[i], reference: right[i] }; }
  }
  return { maximum, mean: total / (left.length / 4), changedPixels, maxAt };
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
      const start = performance.now(); const context = draw(painter, output, element, false, 1, true);
      context.getImageData(0, 0, 1, 1); if (i >= 1600) times.push(performance.now() - start);
    }
    painter.dispose?.();
    return { medianMs: +percentile(times, .5).toFixed(2), p95Ms: +percentile(times, .95).toFixed(2) };
  }
  function previewToFinal() {
    const painter = createFreehandRenderer(); const previewCanvas = canvas(); const finalCanvas = canvas();
    const comparisons = [];
    for (const pressure of [false, true]) for (const opacity of [.28, .62]) {
      const element = stroke(pressure, 180, 12, opacity);
      draw(painter, previewCanvas, element, false, 1, true);
      draw(painter, finalCanvas, element, false, 1, false);
      comparisons.push({ pressure, opacity, ...alphaDifference(previewCanvas, finalCanvas) });
    }
    painter.dispose();
    return comparisons;
  }
  function penUpFinalize(factory: () => Renderer, count: number) {
    const painter = factory(); const output = canvas(1200, 800); const context = output.getContext("2d")!; const times: number[] = [];
    for (let attempt = 0; attempt < 12; attempt++) {
      const element = stroke(true, count, 18, .62);
      const points = element.points.map((point, index) => ({ ...point, x: 20 + index * (1160 / Math.max(1, count - 1)), y: 400 + 150 * Math.sin(index / 25) }));
      element.points = points;
      context.clearRect(0, 0, output.width, output.height); context.globalAlpha = element.opacity!;
      painter.draw(context, element, element.color, true, true);
      context.clearRect(0, 0, output.width, output.height);
      const start = performance.now(); painter.draw(context, element, element.color, true, false); context.getImageData(0, 0, 1, 1);
      if (attempt > 1) times.push(performance.now() - start);
    }
    painter.dispose?.();
    return { samples: count, medianMs: +percentile(times, .5).toFixed(2), p95Ms: +percentile(times, .95).toFixed(2) };
  }
  const importFailures: string[] = [];
  const importCheck = async (label: string, action: () => boolean | Promise<boolean>) => { try { const passed = await action(); check(passed, label); if (!passed) importFailures.push(label); } catch (cause) { check(false, `${label}: ${cause instanceof Error ? cause.message : String(cause)}`); importFailures.push(label); } };
  await importCheck("SQL table and index import", () => { const tables = parseSchema("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL); CREATE INDEX users_name ON users(name);"); return tables.length === 1 && tables[0].columns.length === 2 && tables[0].indexes?.length === 1; });
  await importCheck("Mermaid flowchart round trip", () => {
    const source = "flowchart LR\n  API[API] --> DB[(Database)]"; const items = layoutMermaidFlowchart(parseMermaidFlowchart(source), { x: 0, y: 0 });
    return parseMermaidFlowchart(exportDiagramCode("mmd", items)).links.length === 1;
  });
  await importCheck("PlantUML class round trip", () => {
    const items = plantUmlToDiagram("@startuml\nclass User {\n id: UUID\n}\n@enduml"); const code = exportDiagramCode("puml", items);
    return plantUmlToDiagram(code).length > 0;
  });
  await importCheck("CloudFormation and Kubernetes policy, ingress, and storage import", () => {
    const cloud = structuredYamlToDiagram(JSON.stringify({ Resources: { Role: { Type: "AWS::IAM::Role" }, Worker: { Type: "AWS::Lambda::Function", Properties: { Role: { Ref: "Role" } } } } }));
    const kubernetes = kubernetesToDiagram(`apiVersion: v1
kind: Namespace
metadata:
  name: default
  labels:
    zone: app
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: default
spec:
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: example/api
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: data
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: default
spec:
  selector:
    app: api
  ports:
    - port: 80
---
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: public
spec:
  controller: example/controller
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api
  namespace: default
spec:
  ingressClassName: public
  rules:
    - host: api.example.test
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: standard
provisioner: example.csi
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
  namespace: default
spec:
  storageClassName: standard
  resources:
    requests:
      storage: 1Gi
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-policy
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: api
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              zone: app
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: api
`);
    const cloudLinks = cloud.flatMap(item => item.type === "arrow" ? [item.label?.text ?? ""] : []);
    const kubernetesLinks = kubernetes.flatMap(item => item.type === "arrow" ? [item.label?.text ?? ""] : []);
    return cloudLinks.includes("references") && ["routes to", "uses ingress class", "uses storage class", "applies to"].every(label => kubernetesLinks.includes(label));
  });
  await importCheck("Bicep resource import", () => bicepToDiagram("resource store 'Microsoft.Storage/storageAccounts@2023-01-01' = {\n name: 'store'\n}").length > 0);
  await importCheck("Editable SVG paths with group transforms and gradient fills", () => {
    const doc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="paint"><stop stop-color="#224466"/><stop offset="1" stop-color="#88aacc"/></linearGradient></defs><g transform="translate(10 20) scale(2)"><path d="M0 0 C0 20 10 20 10 0 Z" fill="url(#paint)" stroke="#112233"/></g></svg>', "image/svg+xml");
    const converted = svgPrimitivesToElements(doc.documentElement as unknown as SVGSVGElement, { x: 100, y: 200 }, 2);
    return converted?.some(item => item.type === "svgPath" && item.pathData?.includes("L") && !!item.fillColor && item.x > 100 && item.y > 200) ?? false;
  });
  await importCheck("draw.io import/export round trip", async () => {
    const xml = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="api" value="API" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#26313b" vertex="1" parent="1"><mxGeometry x="20" y="30" width="120" height="60" as="geometry"/></mxCell></root></mxGraphModel>';
    const imported = await importDrawio(xml); const restored = await importDrawio(exportDrawio(imported)); return imported.length === 1 && restored.length === 1;
  });
  await importCheck("Excalidraw import/export round trip", () => {
    const source = JSON.stringify({ type: "excalidraw", version: 2, source: "SketchDraw", elements: [{ id: "api", type: "rectangle", x: 20, y: 30, width: 120, height: 60, strokeColor: "#26313b", backgroundColor: "#ffffff", strokeWidth: 2, opacity: 100, roughness: 0, seed: 1, version: 1, isDeleted: false, groupIds: [], link: null, locked: false }] });
    const imported = importExcalidraw(source); const vector: ShapeElement = { type: "svgPath", id: "vector", x: 180, y: 30, w: 80, h: 60, color: "#26313b", thickness: 2, pathData: "M0 0 L40 30 L0 60 Z", pathWidth: 40, pathHeight: 60, fillRule: "evenodd", svgStroke: true, fillColor: "#99bbdd", fillOpacity: .7 };
    const restored = importExcalidraw(exportExcalidraw([...imported, vector])); const restoredVector = restored.find(item => item.type === "svgPath");
    return imported.length === 1 && restored.length === 2 && restoredVector?.type === "svgPath" && restoredVector.pathData === vector.pathData && restoredVector.fillRule === "evenodd";
  });
  for (const zoom of [.2, .55, 1, 1.37, 2.2]) for (const ratio of [1, 1.25, 1.5, 2]) {
    const step = gridStepForStyle("small-grid", 50, zoom, ratio); const pitch = step * zoom * ratio;
    const snapped = snapCanvasPoint({ x: 137.4, y: -92.7 }, true, "small-grid", 50, zoom, ratio);
    const pattern = gridSvgPattern("small-grid", step * zoom);
    check(Math.abs(pitch - Math.round(pitch)) < 1e-8, `Grid pitch is evenly spaced at zoom ${zoom} and pixel ratio ${ratio}`);
    check(Math.abs(snapped.x / step - Math.round(snapped.x / step)) < 1e-8 && Math.abs(snapped.y / step - Math.round(snapped.y / step)) < 1e-8, `Grid snapping uses the displayed lattice at zoom ${zoom} and pixel ratio ${ratio}`);
    check(Math.abs(pattern.width - step * zoom) < 1e-8 && Math.abs(pattern.height - step * zoom) < 1e-8, `Paper pattern repeats at the snapped grid pitch at zoom ${zoom} and pixel ratio ${ratio}`);
  }
  check(alignedTextStartX(100, 40, "left") === 100 && alignedTextStartX(100, 40, "center") === 80 && alignedTextStartX(100, 40, "right") === 60, "Text alignment shares its anchor calculation across canvas and exports");
  const style = document.createElement("style"); style.textContent = mobileToolbarCss; document.head.append(style);
  const menuHost = document.createElement("div"); menuHost.className = "app-shell"; document.body.append(menuHost);
  const disposeMenu = render(() => createComponent(CanvasOptionsMenu, {
    open: true, showGrid: true, snapToGrid: true, snapToObjects: true, hasElements: true, hasSelection: true, canGroup: true, grouped: false, boardLocked: false, mobileSimple: true,
    onToggle() {}, onCloseOtherTools() {}, onFitDrawing() {}, onFitSelection() {}, onToggleGrid() {}, onToggleSnapToGrid() {}, onToggleSnapToObjects() {}, onGroupSelection() {},
    canvasTools: { showAlignmentGuides: true, showMinimap: true, onToggleAlignmentGuides() {}, onToggleMinimap() {}, onAutoLayout() {} },
  }), menuHost);
  const controls = [...menuHost.querySelectorAll<HTMLElement>("button,input,select,textarea,[role=button]")];
  const moreTools = menuHost.querySelector<HTMLButtonElement>(".mobile-more-canvas-tools");
  const advancedTools = [...menuHost.querySelectorAll<HTMLElement>(".mobile-advanced-canvas-tools")];
  check(!!moreTools && moreTools.getAttribute("aria-expanded") === "false" && advancedTools.length > 0 && advancedTools.every(section => getComputedStyle(section).display === "none"), "Mobile advanced canvas tools start collapsed and hidden");
  moreTools?.click();
  check(moreTools?.getAttribute("aria-expanded") === "true" && advancedTools.every(section => getComputedStyle(section).display !== "none"), "Mobile More canvas tools opens advanced controls");
  moreTools?.click();
  check(moreTools?.getAttribute("aria-expanded") === "false" && advancedTools.every(section => getComputedStyle(section).display === "none"), "Mobile advanced canvas tools collapse again after use");
  const unlabeledControls = controls.filter(control => !(control.getAttribute("aria-label") || control.getAttribute("title") || control.textContent?.trim() || control.closest("label")?.textContent?.trim()));
  check(unlabeledControls.length === 0, `Canvas view controls expose accessible names (${unlabeledControls.length} missing)`);
  const firstEnabled = controls.find(control => control instanceof HTMLButtonElement && !control.disabled);
  firstEnabled?.focus(); check(!firstEnabled || document.activeElement === firstEnabled, "Canvas view controls can receive keyboard focus");
  disposeMenu(); menuHost.remove(); style.remove();
  const performanceResults = {
    workload: "160 pressure strokes, 240 samples each, 1200x800 canvas, software-rendered panning",
    baseline: globalThis.__baselineRenderer ? crowded(globalThis.__baselineRenderer) : undefined, updated: crowded(createFreehandRenderer),
    liveStroke: { samples: 3200, baseline: globalThis.__baselineRenderer ? live(globalThis.__baselineRenderer) : undefined, updated: live(createFreehandRenderer) },
    previewToFinal: previewToFinal(),
    penUpFinalize: [180, 800, 3200].map(count => penUpFinalize(createFreehandRenderer, count)),
  };
  renderer.dispose(); reference.dispose?.();
  return { checks: checks.length, failures, importFailures, visualDifferences, performance: performanceResults };
}
globalThis.__canvasAudit = run();
