import { createFreehandRenderer } from "../src/features/canvas/freehand-rendering";
import { createCanvasRenderScheduler } from "../src/features/canvas/rendering";
import { createStrokeSampleGate } from "../src/features/canvas/stroke-input";
import { appendSimplifiedStrokePoint } from "../src/features/canvas/stroke-simplification";
import { canvasStateForTouchGesture, gridStepForStyle, gridSvgPattern, pointerToWorld, snapCanvasPoint, strokePointFromPointer, zoomCanvasStateAt } from "../src/features/canvas/input";
import { alignedTextStartX, flatten, isConnectable, labelBox, textLayout, validReferences } from "../src/operations";
import { drawShapeLabel } from "../src/features/canvas/rendering";
import { elementBounds } from "../src/features/canvas/bounds";
import { autoRouteConnectorSet, autoRoutePoints } from "../src/features/diagrams/connector-routing";
import { autoLayoutElements } from "../src/features/diagrams/auto-layout";
import { relationshipDirectionHeads, relationshipDisplayElement } from "../src/features/diagrams/relationships";
import { LIBRARY_COMPONENTS, buildLibraryComponent } from "../src/notes";
import { drawModelComponent, modelComponentSvg } from "../src/features/components/model-component-renderer";
import { fitComponentSpecimen } from "../src/features/components/component-specimen-sheet";
import { assignLibraryComponentIds, resizeLibraryGroup } from "../src/features/components/library-component-editor";
import { renderLibraryChartSvg } from "../src/features/components/chart-engine";
import { loadCloudProviderGlyph } from "../src/features/diagrams/cloud-providers";
import { normalizeElement } from "../src/features/files/parse-sketch";
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
import type { CanvasState, Element, FreehandElement, GroupElement, ShapeElement, StrokePoint } from "../src/model";

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
  const mutable = stroke(true); const direct = canvas();
  for (const [label, change] of [["unchanged", () => {}], ["thickness", () => { mutable.thickness = 28; }], ["appended sample", () => { mutable.points.push({ x: 325, y: 120, pressure: .9 }); }]] as const) {
    change(); draw(renderer, actual, mutable); draw(reference, expected, mutable, false);
    draw(renderer, direct, mutable, false);
    const difference = alphaDifference(actual, expected); const directDifference = alphaDifference(actual, direct);
    // Cached rasters and direct vector draws use different browser antialias paths; allow only a tiny edge fringe.
    check(difference.maximum <= 12 && difference.changedPixels <= 12, `Pressure stroke updates after ${label} without a visible cache seam (max alpha delta ${difference.maximum}, ${difference.changedPixels} edge pixels)`);
    check(directDifference.maximum <= 12 && directDifference.changedPixels <= 12, `Pressure stroke matches its direct render after ${label} (max alpha delta ${directDifference.maximum}, ${directDifference.changedPixels} edge pixels)`);
  }
  const rasterized = stroke(false); const rasterRenderer = createFreehandRenderer(); const rasterReference = createFreehandRenderer();
  draw(rasterRenderer, actual, rasterized); draw(rasterReference, expected, rasterized, false);
  rasterized.thickness = 28; draw(rasterRenderer, actual, rasterized); draw(rasterReference, expected, rasterized, false);
  check(alphaDifference(actual, expected).maximum <= 2, "Raster invalidates after stroke thickness changes");
  rasterized.points.push({ x: 325, y: 120 }); draw(rasterRenderer, actual, rasterized); draw(rasterReference, expected, rasterized, false);
  check(alphaDifference(actual, expected).maximum <= 2, "Raster invalidates after an appended sample");
  rasterized.points[rasterized.points.length - 1] = { ...rasterized.points[rasterized.points.length - 1], x: 340, y: 115 };
  draw(rasterRenderer, actual, rasterized); draw(rasterReference, expected, rasterized, false);
  check(alphaDifference(actual, expected).maximum <= 2, "Raster invalidates after replacing a sample without changing stroke length");
  const beforeInPlaceEdit = canvas(); draw(rasterRenderer, beforeInPlaceEdit, rasterized);
  rasterized.points[rasterized.points.length - 1].x += 3;
  draw(rasterRenderer, actual, rasterized); draw(rasterReference, expected, rasterized, false);
  const inPlaceDifference = alphaDifference(actual, expected);
  const changedGeometry = alphaDifference(actual, beforeInPlaceEdit);
  check(changedGeometry.changedPixels > 0, "Raster invalidates after in-place edits to the final sample");
  check(inPlaceDifference.maximum <= 16 && inPlaceDifference.changedPixels <= 12, `Updated raster remains visually aligned after in-place sample edits (max alpha delta ${inPlaceDifference.maximum}, ${inPlaceDifference.changedPixels} edge pixels)`);
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
  const longStrokeAppendPointReads = reads;

  const gate = createStrokeSampleGate(); gate.reset(10);
  check(gate.accept("pointer", 11) && gate.accept("pointer", 12) && !gate.accept("pointer", 11) && !gate.accept("pointer", 12) && gate.accept("pointer", 13), "Raw and coalesced pointer samples cannot replay older points");
  check(!gate.accept("native", 90000), "Late Android batches cannot interleave another clock");
  gate.reset(20);
  check(gate.accept("native", 91000) && !gate.accept("pointer", 21) && gate.accept("native", 91004), "Native input owns the stroke when it arrives first");
  gate.reset(30); check(gate.accept("pointer", 31), "Next stroke resets input ownership");
  const stylusEvent = new PointerEvent("pointermove", { pointerType: "pen", pressure: .82, tiltX: 45, tiltY: -30, twist: 325 });
  Object.defineProperty(stylusEvent, "twist", { value: 725 });
  const stylusPoint = strokePointFromPointer(stylusEvent, { x: 12, y: 18 }, true, true);
  check(stylusPoint.pressure === .82 && stylusPoint.tiltX === 45 && stylusPoint.tiltY === -30 && stylusPoint.orientation === 5, "Pointer stylus pressure, tilt, and normalized rotation reach the stroke model");
  const touchPoint = strokePointFromPointer(new PointerEvent("pointermove", { pointerType: "touch", pressure: 1 }), { x: 14, y: 20 }, true, true);
  check(!("pressure" in touchPoint) && touchPoint.x === 14 && touchPoint.y === 20, "Touch drawing does not inherit synthetic stylus pressure");

  function capturedCurve(source: "pointer" | "native", stylus: boolean) {
    const samples: StrokePoint[] = []; const sampleGate = createStrokeSampleGate(); sampleGate.reset(1000);
    for (let index = 0; index < 320; index++) {
      const time = source === "pointer" ? 1001 + index : 1001 + index * 4;
      if (!sampleGate.accept(source, time)) continue;
      const phase = index / 319;
      appendSimplifiedStrokePoint(samples, {
        x: 35 + phase * 270,
        y: 100 + Math.sin(phase * Math.PI * 2) * 42,
        ...(stylus ? { pressure: .2 + .75 * (index % 40) / 39, tiltX: Math.sin(index / 21) * 28, tiltY: Math.cos(index / 19) * 22, orientation: index % 360 } : {}),
      }, .25, Math.min(.035, .25 / (12 * 1.15)), 1.25);
    }
    return samples;
  }
  const fullCurve = (count: number, stylus: boolean): StrokePoint[] => Array.from({ length: count }, (_, index) => ({
    x: 35 + (index / (count - 1)) * 270,
    y: 100 + Math.sin((index / (count - 1)) * Math.PI * 2) * 42,
    ...(stylus ? { pressure: .2 + .75 * (index % 40) / 39, tiltX: Math.sin(index / 21) * 28, tiltY: Math.cos(index / 19) * 22, orientation: index % 360 } : {}),
  }));
  for (const { source, stylus, label } of [
    { source: "pointer", stylus: false, label: "Mobile touch" },
    { source: "pointer", stylus: true, label: "Pointer pen" },
    { source: "native", stylus: true, label: "Android stylus batches" },
  ] as const) {
    const points = capturedCurve(source, stylus);
    const captured: FreehandElement = { type: "freehand", points, color: "#202124", thickness: 12, opacity: .7 };
    const curveCanvas = canvas(); const finishedCanvas = canvas(); const fullResolutionCanvas = canvas();
    const fullResolution: FreehandElement = { ...captured, points: fullCurve(320, stylus) };
    draw(renderer, curveCanvas, captured, false, 1, true); draw(renderer, finishedCanvas, captured, false, 1, false);
    draw(reference, fullResolutionCanvas, fullResolution, false);
    const previewDifference = alphaDifference(curveCanvas, finishedCanvas);
    const smoothnessDifference = alphaDifference(curveCanvas, fullResolutionCanvas);
    const minimumY = Math.min(...points.map(point => point.y)); const maximumY = Math.max(...points.map(point => point.y));
    check(points.length > 12 && minimumY < 62 && maximumY > 138 && smoothnessDifference.mean <= .2 && smoothnessDifference.changedPixels <= 1200, `${label} preserves the smooth full-resolution curve (${points.length} captured samples, mean alpha delta ${smoothnessDifference.mean.toFixed(3)}, ${smoothnessDifference.changedPixels} edge pixels)`);
    if (stylus) check(points.some(point => point.pressure !== undefined && point.tiltX !== undefined && point.orientation !== undefined), `${label} retain pressure and tilt data`);
    // The preview and pen-up outline use the same curve chunks, so a stroke should not jump at commit.
    check(previewDifference.maximum <= 2, `${label} curved preview remains stable at pen-up`);
  }

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
  const importCheck = async (label: string, action: () => boolean | Promise<boolean>) => {
    try { const passed = await action(); check(passed, label); if (!passed) importFailures.push(label); }
    catch (cause) { check(false, `${label}: ${cause instanceof Error ? cause.message : String(cause)}`); importFailures.push(label); }
  };
  console.info("Audit: diagram import and routing checks");
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
  const camera: CanvasState = { zoom: 1.4, panX: -73, panY: 41, backgroundColor: "#ffffff" };
  const viewport = { x: 174, y: 113 }; const viewportRect = DOMRect.fromRect({ x: 36, y: 22, width: 500, height: 340 });
  const worldBeforeZoom = pointerToWorld(viewportRect.left + viewport.x, viewportRect.top + viewport.y, viewportRect, camera);
  const zoomedCamera = zoomCanvasStateAt(camera, viewport, 2.15);
  const worldAfterZoom = pointerToWorld(viewportRect.left + viewport.x, viewportRect.top + viewport.y, viewportRect, zoomedCamera);
  check(Math.hypot(worldBeforeZoom.x - worldAfterZoom.x, worldBeforeZoom.y - worldAfterZoom.y) < 1e-8, "Wheel zoom keeps the canvas point beneath the cursor stationary");
  const initialMidpoint = { x: viewportRect.left + viewport.x, y: viewportRect.top + viewport.y };
  const touchSnapshot = { action: "panZoom" as const, initialDistance: 90, initialZoom: camera.zoom, initialPanX: camera.panX, initialPanY: camera.panY, initialMidpoint, worldAnchor: worldBeforeZoom };
  const movedMidpoint = { x: initialMidpoint.x + 32, y: initialMidpoint.y + 19 };
  const pinchedCamera = canvasStateForTouchGesture(camera, touchSnapshot, movedMidpoint, 144, { x: viewportRect.left, y: viewportRect.top });
  const pinchAnchor = pointerToWorld(movedMidpoint.x, movedMidpoint.y, viewportRect, pinchedCamera);
  check(Math.hypot(pinchAnchor.x - worldBeforeZoom.x, pinchAnchor.y - worldBeforeZoom.y) < 1e-8 && Math.abs(pinchedCamera.zoom - camera.zoom * 1.6) < 1e-8, "Two-finger pinch zoom follows the moving midpoint without camera drift");
  const touchPan = canvasStateForTouchGesture(camera, { ...touchSnapshot, action: "pan" }, movedMidpoint, 90, { x: viewportRect.left, y: viewportRect.top });
  check(touchPan.zoom === camera.zoom && touchPan.panX === camera.panX + 32 && touchPan.panY === camera.panY + 19, "Two-finger pan preserves zoom and moves by the gesture delta");
  check(zoomCanvasStateAt(camera, viewport, 0).zoom === .02 && zoomCanvasStateAt(camera, viewport, 20).zoom === 8, "Zoom remains within the supported minimum and maximum");

  const labelCanvas = canvas(200, 120); const labelContext = labelCanvas.getContext("2d")!;
  for (const type of ["rectangle", "circle", "diamond", "flowchart"] as const) {
    const shape: ShapeElement = { type, x: 38, y: 28, w: 108, h: 64, color: "#26313b", thickness: 1.5, ...(type === "flowchart" ? { flowchartShape: "decision" as const } : {}), label: { text: "LongUnbrokenComponentLabelThatMustWrap\nwith predictable padding", color: "#202124", fontSize: 13, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } };
    const box = labelBox(shape); const runs = textLayout(labelContext, shape);
    const withinBounds = runs.length > 2 && runs.every(run => run.x >= box.x - .01 && run.x + labelContext.measureText(run.text).width <= box.x + box.w + .01 && run.y >= box.y - .01 && run.y + shape.label!.fontSize <= box.y + box.h + .01);
    labelContext.clearRect(0, 0, labelCanvas.width, labelCanvas.height); drawShapeLabel(labelContext, shape, "light");
    let outside = 0; const pixels = labelContext.getImageData(0, 0, labelCanvas.width, labelCanvas.height).data;
    for (let py = 0; py < labelCanvas.height; py++) for (let px = 0; px < labelCanvas.width; px++) if ((px < shape.x || px >= shape.x + shape.w || py < shape.y || py >= shape.y + shape.h) && pixels[(py * labelCanvas.width + px) * 4 + 3] > 0) outside++;
    check(withinBounds && outside === 0, `${type} labels wrap and remain inside their shape after drawing`);
  }

  await importCheck("Connector routing clears intervening nodes with orthogonal bends", () => {
    const source: ShapeElement = { type: "rectangle", id: "route-source", x: 0, y: 45, w: 60, h: 70, color: "#333", thickness: 1 };
    const obstacle: ShapeElement = { type: "rectangle", id: "route-obstacle", x: 150, y: 40, w: 60, h: 80, color: "#333", thickness: 1 };
    const target: ShapeElement = { type: "rectangle", id: "route-target", x: 300, y: 45, w: 60, h: 70, color: "#333", thickness: 1 };
    const connector: ShapeElement = { type: "arrow", id: "route-edge", x: 60, y: 80, w: 240, h: 0, color: "#333", thickness: 2, startBinding: { elementId: source.id!, anchor: { x: 1, y: .5 } }, endBinding: { elementId: target.id!, anchor: { x: 0, y: .5 } } };
    const route = autoRoutePoints(connector, [source, obstacle, target, connector]);
    const points = [{ x: connector.x, y: connector.y }, ...route, { x: connector.x + connector.w, y: connector.y + connector.h }];
    const box = { left: obstacle.x - 10, right: obstacle.x + obstacle.w + 10, top: obstacle.y - 10, bottom: obstacle.y + obstacle.h + 10 };
    const clear = points.slice(1).every((point, index) => {
      const previous = points[index];
      if (Math.abs(previous.x - point.x) > 1e-6 && Math.abs(previous.y - point.y) > 1e-6) return false;
      if (Math.abs(previous.y - point.y) < 1e-6) return !(point.y > box.top && point.y < box.bottom && Math.max(Math.min(previous.x, point.x), box.left) < Math.min(Math.max(previous.x, point.x), box.right));
      return !(point.x > box.left && point.x < box.right && Math.max(Math.min(previous.y, point.y), box.top) < Math.min(Math.max(previous.y, point.y), box.bottom));
    });
    const optimized = autoRouteConnectorSet([source, obstacle, target, connector]).find(item => item.id === connector.id);
    return route.length > 0 && clear && optimized?.type === "arrow" && optimized.autoRoute === true && !!optimized.routePoints?.length;
  });
  await importCheck("Automatic layout preserves locked nodes and keeps geometry finite", async () => {
    const first: ShapeElement = { type: "rectangle", id: "layout-a", x: 0, y: 0, w: 92, h: 54, color: "#333", thickness: 1 };
    const second: ShapeElement = { type: "rectangle", id: "layout-b", x: 380, y: 20, w: 92, h: 54, color: "#333", thickness: 1 };
    const pinned: ShapeElement = { type: "rectangle", id: "layout-pinned", x: 185, y: 260, w: 92, h: 54, color: "#333", thickness: 1, locked: true };
    const edge: ShapeElement = { type: "arrow", id: "layout-edge", x: 92, y: 27, w: 288, h: 20, color: "#333", thickness: 1.5, startBinding: { elementId: first.id!, anchor: { x: 1, y: .5 } }, endBinding: { elementId: second.id!, anchor: { x: 0, y: .5 } } };
    const input: Element[] = [first, second, pinned, edge]; const output = await autoLayoutElements(input, [], "RIGHT", "network");
    const nextPinned = output.find(item => item.id === pinned.id); const positions = output.filter(item => item.id === first.id || item.id === second.id).map(elementBounds);
    return output.length === input.length && nextPinned?.type === "rectangle" && nextPinned.x === pinned.x && nextPinned.y === pinned.y && positions.every(bounds => [bounds.x, bounds.y, bounds.w, bounds.h].every(Number.isFinite)) && positions.length === 2;
  });

  const componentCanvas = canvas(600, 360); const componentContext = componentCanvas.getContext("2d")!;
  const componentDiagnostics: { kind: string; issues: string[] }[] = [];
  console.info("Audit: component library checks");
  for (const definition of LIBRARY_COMPONENTS) {
    await importCheck(`${definition.kind} component creates, resizes, connects, serializes, and renders`, async () => {
      const built = assignLibraryComponentIds(buildLibraryComponent(definition.kind, 20, 20), definition.kind);
      const issues: string[] = [];
      const bounds = elementBounds(built);
      const specimen = fitComponentSpecimen(built, { x: 0, y: 0, w: 250, h: 136 }, 12); const specimenBounds = elementBounds(specimen);
      const resized = resizeLibraryGroup(built, { x: 20, y: 20, w: bounds.w * 1.1, h: bounds.h * 1.1 });
      const restored = normalizeElement(JSON.parse(JSON.stringify(built)));
      const leaves = flatten([built]); const hasConnectableTarget = leaves.some(item => item.id !== built.id && isConnectable(item)) || isConnectable(built);
      const geometryIsValid = [bounds.x, bounds.y, bounds.w, bounds.h, specimenBounds.x, specimenBounds.y, specimenBounds.w, specimenBounds.h].every(Number.isFinite)
        && bounds.w > 0 && bounds.h > 0 && specimenBounds.w <= 226.01 && specimenBounds.h <= 112.01;
      const roundTripIsValid = restored?.type === "group" && restored.libraryComponent?.kind === definition.kind && !!restored.id && validReferences([restored]);
      if (!built.libraryComponent || !built.id) issues.push("missing component metadata or id");
      if (!hasConnectableTarget) issues.push("no selectable connection target");
      if (!geometryIsValid) issues.push(`invalid specimen geometry (${bounds.w}x${bounds.h} -> ${specimenBounds.w}x${specimenBounds.h})`);
      if (!roundTripIsValid) issues.push("serialization or nested id/reference validation failed");
      if (elementBounds(resized).w < bounds.w * 1.09) issues.push("resize did not grow geometry by 10%");
      if (built.componentBounds) {
        componentContext.clearRect(0, 0, componentCanvas.width, componentCanvas.height);
        drawModelComponent(componentContext, built, "light");
        const image = componentContext.getImageData(0, 0, componentCanvas.width, componentCanvas.height).data;
        let painted = 0; for (let offset = 3; offset < image.length; offset += 4) painted += image[offset] > 0 ? 1 : 0;
        if (!painted || !modelComponentSvg(built).includes("<")) issues.push("renderer produced no visible canvas or SVG output");
        if (definition.kind.startsWith("aws-") || definition.kind.startsWith("azure-") || definition.kind.startsWith("gcp-")) {
          try { const glyph = await loadCloudProviderGlyph(definition.kind); if (!glyph?.svg || !glyph.viewBox) issues.push("provider glyph pack returned no SVG glyph"); }
          catch { issues.push("provider glyph dynamic import failed in the audit bundle"); }
        }
      } else if (!built.elements.length) issues.push("component has no rendered geometry");
      if (issues.length) componentDiagnostics.push({ kind: definition.kind, issues });
      return issues.length === 0;
    });
  }
  for (const definition of LIBRARY_COMPONENTS.filter(item => item.kind.startsWith("viz-"))) {
    await importCheck(`${definition.kind} chart renders as vector and honors saved options`, () => {
      const group = assignLibraryComponentIds(buildLibraryComponent(definition.kind, 20, 20), definition.kind);
      const data = group.libraryComponent?.chartData;
      const metadata = group.libraryComponent;
      if (!data || !metadata) return false;
      const baseline = renderLibraryChartSvg(group, "light", 280, 180);
      const customized: GroupElement = {
        ...group,
        libraryComponent: {
          ...metadata,
          chartData: { ...data, options: { ...data.options, palette: "violet", showValues: true, legend: "bottom", smooth: true, lineWidth: 5, pointSize: 10 } },
        },
      };
      const modified = renderLibraryChartSvg(customized, "light", 280, 180);
      const restored = normalizeElement(JSON.parse(JSON.stringify(customized)));
      const restoredOptions = restored?.type === "group" ? restored.libraryComponent?.chartData?.options : undefined;
      return baseline.includes("<svg") && baseline.includes("viewBox") && !/NaN|Infinity|undefined/.test(baseline)
        && modified.includes("<svg") && modified !== baseline && !/NaN|Infinity|undefined/.test(modified)
        && restoredOptions?.palette === "violet" && restoredOptions.showValues === true && restoredOptions.legend === "bottom";
    });
  }
  await importCheck("Relationship labels retain type, cardinality, and direction metadata", () => {
    const relation: ShapeElement = { type: "arrow", id: "relationship-label", x: 20, y: 20, w: 120, h: 0, color: "#333", thickness: 1.5, relationshipType: "dependency", cardinality: "1..*", relationshipDirection: "both", label: { text: "calls", color: "#333", fontSize: 12, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } };
    const display = relationshipDisplayElement(relation); const serialized = normalizeElement(JSON.parse(JSON.stringify(relation)));
    const both = relationshipDirectionHeads("both"); const forward = relationshipDirectionHeads("forward"); const none = relationshipDirectionHeads("none");
    const caption = display.label?.text ?? "";
    const passed = caption.includes("calls") && caption.includes("Dependency") && caption.includes("1..*") && serialized?.type === "arrow" && serialized.relationshipDirection === "both" && both.startHead === "solid" && both.endHead === "solid" && forward.startHead === "none" && forward.endHead === "solid" && none.startHead === "none" && none.endHead === "none";
    if (!passed) console.info("Audit relationship diagnostic:", JSON.stringify({ caption, serializedType: serialized?.type, serializedDirection: serialized?.type === "arrow" ? serialized.relationshipDirection : undefined, both, forward, none }));
    return passed;
  });
  console.info("Audit: mobile controls and performance workloads");
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
  return { checks: checks.length, failures, importFailures, componentDiagnostics, longStrokeAppendPointReads, visualDifferences, performance: performanceResults };
}
globalThis.__canvasAudit = run();
