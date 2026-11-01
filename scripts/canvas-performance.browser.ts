import { createFreehandRenderer } from "../src/features/canvas/freehand-rendering";
import { canvasPixelRatio, createCanvasRenderScheduler } from "../src/features/canvas/rendering";
import { SceneTileCache } from "../src/features/canvas/scene-tile-cache";
import { ElementSpatialIndex } from "../src/features/canvas/spatial-index";
import { createStrokeSampleGate } from "../src/features/canvas/stroke-input";
import { appendSimplifiedStrokePoint } from "../src/features/canvas/stroke-simplification";
import { canvasStateForTouchGesture, gridStepForStyle, gridSvgPattern, pointerToWorld, snapCanvasPoint, strokePointFromPointer, zoomCanvasStateAt } from "../src/features/canvas/input";
import { alignedTextStartX, anchorPoint, connectionAnchorsFor, flatten, isConnectable, labelBox, nearestBinding, textLayout, validReferences } from "../src/operations";
import { ALL_FLOWCHART_SHAPES } from "../src/features/diagrams/config";
import { adjustShapeAtPoint, shapeAdjustmentHandles, shapePathData } from "../src/features/shapes/geometry";
import { componentOutlinePath } from "../src/features/components/component-geometry";
import { drawShapeLabel } from "../src/features/canvas/rendering";
import { elementBounds, lockAspectResizeBounds } from "../src/features/canvas/bounds";
import { parseEditablePath, updateEditablePath } from "../src/features/canvas/path-editing";
import { recognizeStroke } from "../src/features/canvas/stroke-recognition";
import { autoRouteConnectorSet, autoRouteMayIntersect, autoRoutePoints, createAutoRouteContext } from "../src/features/diagrams/connector-routing";
import { autoLayoutElements } from "../src/features/diagrams/auto-layout";
import { relationshipDirectionHeads, relationshipDisplayElement } from "../src/features/diagrams/relationships";
import { LIBRARY_COMPONENTS, buildLibraryComponent, buildNoteGroup, drawNoteCard, noteCollapseHit } from "../src/notes";
import { markdownTableRows, serializeMarkdownTableRows } from "../src/app/markdown-table";
import { CLOUD_NEUTRAL_COMPONENTS } from "../src/features/diagrams/cloud-providers";
import { cloudNeutralIconPath } from "../src/features/components/cloud-neutral-icons";
import { renderPdfPages } from "../src/features/files/pdf-import";
import { buildInteractiveViewer } from "../src/features/export/interactive-viewer";
import { createSvgElementSerializer } from "../src/features/export/svg-renderer";
import { parseSketchFile } from "../src/features/files/parse-sketch";
import { cloudDiagramFromText, resolveCloudIcon } from "../src/features/diagrams/cloud-diagram";
import { findLineForElement, generateLiveDiagram, matchLineElements } from "../src/features/diagrams/live-diagram";
import { LiveDiagramPanel } from "../src/features/diagrams/LiveDiagramPanel";
import { SequencePlaybackPanel } from "../src/features/diagrams/SequencePlaybackPanel";
import { DataLinkPanel } from "../src/features/data/DataLinkPanel";
import { sequenceSteps } from "../src/features/diagrams/sequence-playback";
import { ViewSettingsPopover } from "../src/components/ViewSettingsPopover";
import { DEFAULT_TOOL_ORDER, defaultToolbarLayout } from "../src/app/toolbar-layout";
import { createSketchSnapshot, serializeSketchSnapshot } from "../src/features/files/document-codec";
import { PDFDocument, rgb } from "pdf-lib";
import { StyleLibraryPanel } from "../src/features/styles/StyleLibraryPanel";
import { DocumentOutlineDialog } from "../src/features/accessibility/DocumentOutlineDialog";
import { buildDocumentOutline } from "../src/features/accessibility/accessibility";
import { FONT_FAMILY_CHOICES } from "../src/app/canvas-options";
import { drawModelComponent, modelComponentSvg } from "../src/features/components/model-component-renderer";
import { fitComponentSpecimen } from "../src/features/components/component-specimen-sheet";
import { assignLibraryComponentIds, resizeLibraryGroup } from "../src/features/components/library-component-editor";
import { renderLibraryChartSvg } from "../src/features/components/chart-engine";
import { loadCloudProviderGlyph } from "../src/features/diagrams/cloud-providers";
import { normalizeElement } from "../src/features/files/parse-sketch";
import mobileToolbarCss from "../src/platform/mobile/touch-toolbar.css?inline";
import canvasToolsCss from "../src/styles/app/canvas-tools.css?inline";
import homeCss from "../src/styles/app/home.css?inline";
import popoverCss from "../src/styles/toolbar-and-view-popovers.css?inline";
import foundationCss from "../src/styles/app/foundation.css?inline";
import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { CanvasOptionsMenu } from "../src/components/CanvasOptionsMenu";
import { DocumentTabs } from "../src/platform/windows/DocumentTabs";
import { WindowsShapePalette } from "../src/platform/windows/WindowsShapePalette";
import { parseSchema } from "../src/schema";
import { layoutMermaidFlowchart, parseMermaidFlowchart } from "../src/mermaid";
import { exportDiagramCode, plantUmlToDiagram } from "../src/features/diagrams/code-formats";
import { d2ToDiagram } from "../src/features/diagrams/d2";
import complexArchitectureD2 from "./fixtures/complex-architecture.d2?raw";
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
  check(Math.abs((stylusPoint.pressure ?? 0) - .82) < .001 && stylusPoint.tiltX === 45 && stylusPoint.tiltY === -30 && stylusPoint.orientation === 5, "Pointer stylus pressure, tilt, and normalized rotation reach the stroke model");
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
  await importCheck("D2 complex group and style round trip fixture", () => {
    const imported = d2ToDiagram(complexArchitectureD2);
    const code = exportDiagramCode("d2", imported);
    const roundTrip = d2ToDiagram(code);
    const all = flatten(roundTrip);
    const groups = (items: Element[]): number => items.reduce((count, item) => count + (item.type === "group" ? 1 + groups(item.elements) : 0), 0);
    const connectors = all.filter(item => item.type === "line" || item.type === "arrow");
    const labels = all.flatMap(item => "label" in item && item.label ? [item.label.text] : []);
    return groups(roundTrip) >= 3 && connectors.length === 4 && labels.includes("Public gateway") && labels.includes("Primary store") && code.includes("#dbeafe") && code.includes("HTTPS request");
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
    const blockArrow: ShapeElement = { type: "flowchart", id: "block-arrow", flowchartShape: "right-arrow", x: 280, y: 30, w: 120, h: 60, color: "#26313b", thickness: 2, shapeAdjustments: { shaft: .62, head: .7 } };
    const restored = importExcalidraw(exportExcalidraw([...imported, vector, blockArrow])); const restoredVector = restored.find(item => item.type === "svgPath"); const restoredArrow = restored.find(item => item.type === "flowchart");
    return imported.length === 1 && restored.length === 3 && restoredVector?.type === "svgPath" && restoredVector.pathData === vector.pathData && restoredVector.fillRule === "evenodd" && restoredArrow?.type === "flowchart" && restoredArrow.shapeAdjustments?.shaft === .62 && restoredArrow.shapeAdjustments?.head === .7;
  });
  for (const zoom of [.2, .55, 1, 1.37, 2.2]) for (const ratio of [1, 1.25, 1.5, 2]) {
    const step = gridStepForStyle("small-grid", 50, zoom); const pitch = step * zoom * ratio;
    const snapped = snapCanvasPoint({ x: 137.4, y: -92.7 }, true, "small-grid", 50);
    const pattern = gridSvgPattern("small-grid", step * zoom);
    check(Number.isFinite(pitch) && pitch > 0, `Grid pitch is visible at zoom ${zoom} and pixel ratio ${ratio}`);
    check(Math.abs(snapped.x / 50 - Math.round(snapped.x / 50)) < 1e-8 && Math.abs(snapped.y / 50 - Math.round(snapped.y / 50)) < 1e-8, `Grid snapping uses the 50-unit document lattice at zoom ${zoom} and pixel ratio ${ratio}`);
    check(Math.abs(pattern.width - step * zoom) < 1e-8 && Math.abs(pattern.height - step * zoom) < 1e-8, `Paper pattern repeats at the snapped grid pitch at zoom ${zoom} and pixel ratio ${ratio}`);
  }
  const spatialElements: Element[] = Array.from({ length: 180 }, (_, index): ShapeElement => ({ type: "rectangle", id: `spatial-${index}`, x: (index % 18) * 900 - 7000, y: Math.floor(index / 18) * 900 - 3000, w: 100, h: 80, color: "#333", thickness: 1 }));
  spatialElements[0] = { type: "rectangle", id: "spatial-large", x: -3000, y: -3000, w: 11_000, h: 10_000, color: "#333", thickness: 1 };
  spatialElements[1] = { type: "rectangle", id: "spatial-global", x: -600_000, y: -600_000, w: 1_200_000, h: 1_200_000, color: "#333", thickness: 1 };
  const spatialIndex = new ElementSpatialIndex(spatialElements);
  const queryMatchesNaive = (bounds: { x: number; y: number; w: number; h: number }) => {
    const expected = spatialElements.flatMap((item, index) => {
      const box = elementBounds(item);
      return box.x <= bounds.x + bounds.w && box.x + box.w >= bounds.x && box.y <= bounds.y + bounds.h && box.y + box.h >= bounds.y ? [index] : [];
    });
    const actual = spatialIndex.query(bounds);
    return actual.length === expected.length && actual.every((index, position) => index === expected[position]);
  };
  const smallQueryMatches = queryMatchesNaive({ x: 100, y: 100, w: 250, h: 250 });
  const broadQueryMatches = queryMatchesNaive({ x: -5000, y: -5000, w: 50_000, h: 50_000 });
  const movedLarge = { ...spatialElements[0], x: 150_000, y: 150_000 };
  const changedSpatialElements = spatialElements.slice(); changedSpatialElements[0] = movedLarge;
  spatialIndex.updateChanged(changedSpatialElements, [0]); spatialElements[0] = movedLarge;
  const updatedBroadQueryMatches = queryMatchesNaive({ x: -5000, y: -5000, w: 50_000, h: 50_000 });
  check(smallQueryMatches && broadQueryMatches && updatedBroadQueryMatches,
    "Spatial-index fine, broad, oversized, and incremental queries match a full-scan reference");
  const renderShape: ShapeElement = { type: "rectangle", x: 32, y: 24, w: 180, h: 90, color: "#202124", thickness: 1.5 };
  const renderElements: Element[] = [renderShape]; const renderIndex = new ElementSpatialIndex(renderElements);
  const tileCanvas = canvas(500, 350); const vectorCanvas = canvas(500, 350);
  const paintTileElement = (ctx: CanvasRenderingContext2D, element: Element) => {
    if (element.type !== "rectangle") return;
    ctx.strokeStyle = element.color; ctx.lineWidth = element.thickness; ctx.strokeRect(element.x, element.y, element.w, element.h);
  };
  const tileContext = tileCanvas.getContext("2d")!; tileContext.setTransform(1.5, 0, 0, 1.5, 0, 0);
  const tileCache = new SceneTileCache();
  const tileCopiedOneToOne = tileCache.draw(tileContext, { x: 0, y: 0, w: 300, h: 200 }, 1.5, 1, renderElements, renderIndex, "pixel-aligned", paintTileElement);
  const vectorContext = vectorCanvas.getContext("2d")!; vectorContext.setTransform(1.5, 0, 0, 1.5, 0, 0); paintTileElement(vectorContext, renderShape);
  const tilePixels = tileContext.getImageData(0, 0, tileCanvas.width, tileCanvas.height).data;
  const vectorPixels = vectorContext.getImageData(0, 0, vectorCanvas.width, vectorCanvas.height).data;
  const tilePixelDifference = tilePixels.reduce((difference, value, index) => difference + Number(value !== vectorPixels[index]), 0);
  const fractionalContext = canvas(500, 350).getContext("2d")!; fractionalContext.setTransform(1.5, 0, 0, 1.5, .25, 0);
  const fractionalTileUsed = tileCache.draw(fractionalContext, { x: 0, y: 0, w: 300, h: 200 }, 1.5, 1, renderElements, new ElementSpatialIndex(renderElements), "pixel-aligned", paintTileElement);
  tileCache.clear();
  check(tileCopiedOneToOne && tilePixelDifference === 0, `Zoomed-out scene tiles match direct vector pixels when aligned (${tilePixelDifference} differing channel values)`);
  check(!fractionalTileUsed, "Subpixel-translated scenes bypass raster tiles and retain direct vector rendering");
  check(canvasPixelRatio(1200, 800, 2) === 2 && canvasPixelRatio(20_000, 2_000, 3) < 3,
    "Canvas backing resolution follows display pixel ratio within its dimension and memory limits");
  check(alignedTextStartX(100, 40, "left") === 100 && alignedTextStartX(100, 40, "center") === 80 && alignedTextStartX(100, 40, "right") === 60, "Text alignment shares its anchor calculation across canvas and exports");
  const originalResizeBounds = { x: 0, y: 0, w: 100, h: 50 };
  const horizontalResize = lockAspectResizeBounds(originalResizeBounds, { x: 0, y: 0, w: 160, h: 50 }, "e");
  const verticalResize = lockAspectResizeBounds(originalResizeBounds, { x: 0, y: 0, w: 100, h: 80 }, "s");
  const cornerResize = lockAspectResizeBounds(originalResizeBounds, { x: 0, y: 0, w: 160, h: 80 }, "se");
  const boundedCornerResize = lockAspectResizeBounds({ x: 0, y: 0, w: 1_000_000, h: 10 }, { x: 0, y: 0, w: 16_384, h: 1_000 }, "se", 25, 25, 16_384, 16_384);
  check(horizontalResize.x === 0 && horizontalResize.w === 160 && horizontalResize.y === 0 && horizontalResize.h === 50
    && verticalResize.x === 0 && verticalResize.w === 100 && verticalResize.y === 0 && verticalResize.h === 80
    && Math.abs(cornerResize.w / cornerResize.h - 2) < 1e-8 && cornerResize.x === 0 && cornerResize.y === 0,
  "Side resize changes only its axis while corner resize preserves the aspect ratio");
  check(boundedCornerResize.w <= 16_384 && boundedCornerResize.h <= 16_384,
    "Aspect-locked resize keeps extreme saved shapes within interactive bounds");
  const editablePath = parseEditablePath("M 0 0 L 100 0 L 100 100 Z");
  const movedPath = editablePath && updateEditablePath({ type: "svgPath", x: 0, y: 0, w: 100, h: 100, color: "#26313b", thickness: 2, pathData: "M 0 0 L 100 0 L 100 100 Z", pathWidth: 100, pathHeight: 100 }, editablePath.points.map((point, index) => index === 1 ? { x: 120, y: 0 } : point));
  const movedPathNodes = movedPath?.type === "svgPath" ? parseEditablePath(movedPath.pathData) : undefined;
  const movedNodeWorldX = movedPath?.type === "svgPath" && movedPathNodes ? movedPath.x + movedPathNodes.points[1].x / (movedPath.pathWidth ?? movedPath.w) * movedPath.w : undefined;
  check(!!(editablePath?.closed && movedPath?.type === "svgPath" && movedPath.pathData?.endsWith("Z") && movedNodeWorldX === 120 && !parseEditablePath("M 0 0 C 20 20 80 80 100 100")), "Simple SVG node editing preserves moved geometry and rejects unsupported curves");
  const rectangleStroke: FreehandElement = { type: "freehand", points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 100, y: 100 }, { x: 50, y: 100 }, { x: 0, y: 100 }, { x: 0, y: 50 }, { x: 0, y: 0 }], color: "#26313b", thickness: 2 };
  const horizontalStroke: FreehandElement = { type: "freehand", points: Array.from({ length: 9 }, (_, index) => ({ x: index * 15, y: 20 })), color: "#26313b", thickness: 2 };
  const ellipseStroke: FreehandElement = { type: "freehand", points: Array.from({ length: 33 }, (_, index) => ({ x: 50 + 40 * Math.cos(index / 32 * Math.PI * 2), y: 50 + 30 * Math.sin(index / 32 * Math.PI * 2) })), color: "#26313b", thickness: 2 };
  const arrowStroke: FreehandElement = { type: "freehand", points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 40, y: 0 }, { x: 60, y: 0 }, { x: 80, y: 0 }, { x: 100, y: 0 }, { x: 82, y: -14 }, { x: 100, y: 0 }, { x: 82, y: 14 }], color: "#26313b", thickness: 2 };
  check(recognizeStroke(rectangleStroke)?.type === "rectangle" && recognizeStroke(horizontalStroke)?.type === "line" && recognizeStroke(ellipseStroke)?.type === "circle" && recognizeStroke(arrowStroke)?.type === "arrow", "Stroke cleanup recognizes rectangles, ellipses, horizontal lines, and arrows");
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

  const connectorShapeSet: ShapeElement[] = [
    { type: "rectangle", x: 32, y: 25, w: 112, h: 66, color: "#26313b", thickness: 1, edgeStyle: "rounded" },
    { type: "circle", x: 32, y: 25, w: 112, h: 66, color: "#26313b", thickness: 1 },
    { type: "diamond", x: 32, y: 25, w: 112, h: 66, color: "#26313b", thickness: 1 },
    { type: "triangle", x: 32, y: 25, w: 112, h: 66, color: "#26313b", thickness: 1 },
    ...ALL_FLOWCHART_SHAPES.map(shape => ({ type: "flowchart" as const, x: 32, y: 25, w: 112, h: 66, color: "#26313b", thickness: 1, flowchartShape: shape.value })),
    { type: "svgPath", x: 32, y: 25, w: 112, h: 66, color: "#26313b", thickness: 1, pathData: "M 0 0 L 100 0 L 50 100 Z", pathWidth: 100, pathHeight: 100 },
  ];
  check(ALL_FLOWCHART_SHAPES.every(definition => definition.path === shapePathData({ type: "flowchart", flowchartShape: definition.value, x: 3, y: 3, w: 18, h: 18, color: "#000", thickness: 1 })), "Shape palette icons use the canvas geometry for every catalog shape");
  const tinyShapeContext = canvas(120, 120).getContext("2d")!;
  const tinyShapeFailures = ALL_FLOWCHART_SHAPES.flatMap(definition => [[2, 70], [70, 2], [8, 8], [10, 10]].flatMap(([w, h]) => {
    try {
      const data = shapePathData({ type: "flowchart", flowchartShape: definition.value, x: 10, y: 10, w, h, color: "#000000", thickness: 1 });
      if (!data || /NaN|Infinity/.test(data)) return [`${definition.value} ${w}×${h}`];
      const path = new Path2D(data); tinyShapeContext.fill(path); tinyShapeContext.stroke(path); return [];
    } catch { return [`${definition.value} ${w}×${h}`]; }
  }));
  check(tinyShapeFailures.length === 0, `All built-in shapes render at narrow dimensions${tinyShapeFailures.length ? `: ${tinyShapeFailures.join(", ")}` : ""}`);
  const adjustableArrow: ShapeElement = { type: "flowchart", id: "adjustable-arrow", flowchartShape: "right-arrow", x: 0, y: 0, w: 100, h: 80, color: "#000000", thickness: 1 };
  const longHead = adjustShapeAtPoint(adjustableArrow, "head", { x: 30, y: 40 });
  const wideShaft = adjustShapeAtPoint(longHead, "shaft", { x: 50, y: 10 });
  const restoredArrow = normalizeElement(JSON.parse(JSON.stringify(wideShaft)));
  check(shapeAdjustmentHandles(adjustableArrow).length === 2 && shapePathData(adjustableArrow) !== shapePathData(wideShaft), "Block arrow head and shaft handles change geometry");
  check(restoredArrow?.type === "flowchart" && restoredArrow.shapeAdjustments?.head === .7 && restoredArrow.shapeAdjustments?.shaft === .75,
  "Block arrow adjustments survive Sketch import");
  const adjustableStar: ShapeElement = { ...adjustableArrow, flowchartShape: "star" };
  const starHandle = shapeAdjustmentHandles(adjustableStar)[0];
  const narrowStar = adjustShapeAtPoint(adjustableStar, "inset", { x: starHandle.x + 12, y: starHandle.y });
  check(shapeAdjustmentHandles(adjustableStar).length === 1 && shapePathData(adjustableStar) !== shapePathData(narrowStar), "Other proportion-based shapes expose a contour adjustment handle");
  const connectorOutlineFailures: string[] = [];
  const connectorOutlinesFollowEveryShape = connectorShapeSet.every(shape => {
    const data = shape.type === "svgPath" ? shape.pathData : shapePathData(shape);
    if (!data) return false;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path"); path.setAttribute("d", data);
    const length = path.getTotalLength(); const anchors = connectionAnchorsFor(shape);
    if (!Number.isFinite(length) || length <= 0 || anchors.length < 6) return false;
    const outlinePoints = Array.from({ length: 257 }, (_, index) => {
      const point = path.getPointAtLength(length * index / 256);
      return { x: shape.type === "svgPath" ? shape.x + point.x / (shape.pathWidth ?? shape.w) * shape.w : point.x, y: shape.type === "svgPath" ? shape.y + point.y / (shape.pathHeight ?? shape.h) * shape.h : point.y };
    });
    const valid = anchors.every(anchor => {
      const world = anchorPoint(shape, anchor);
      const nearest = outlinePoints.reduce((distance, point) => Math.min(distance, Math.hypot(world.x - point.x, world.y - point.y)), Infinity);
      return nearest <= Math.max(1.5, length / 180);
    });
    if (!valid) connectorOutlineFailures.push(shape.flowchartShape ?? shape.type);
    return valid;
  });
  if (connectorOutlineFailures.length) console.info("Connector outline failures", connectorOutlineFailures.join(", "));
  const diamondAnchors = connectionAnchorsFor(connectorShapeSet[2]);
  const diamondVerticesAndEdges = [{ x: .5, y: 0 }, { x: .75, y: .25 }, { x: 1, y: .5 }, { x: .75, y: .75 }, { x: .5, y: 1 }, { x: .25, y: .75 }, { x: 0, y: .5 }, { x: .25, y: .25 }].every(expected => diamondAnchors.some(anchor => Math.abs(anchor.x - expected.x) < .002 && Math.abs(anchor.y - expected.y) < .002));
  const gear = connectorShapeSet.find(shape => shape.type === "flowchart" && shape.flowchartShape === "gear");
  const gearIgnoresInnerCutout = !!gear && connectionAnchorsFor(gear).every(anchor => Math.hypot(anchor.x - .5, anchor.y - .5) > .25);
  const ring = connectorShapeSet.find(shape => shape.type === "flowchart" && shape.flowchartShape === "ring");
  const ringIgnoresInnerCutout = !!ring && connectionAnchorsFor(ring).every(anchor => Math.hypot(anchor.x - .5, anchor.y - .5) > .35);
  check(connectorOutlinesFollowEveryShape && diamondVerticesAndEdges && gearIgnoresInnerCutout && ringIgnoresInnerCutout, "Connector snap points follow built-in and SVG outlines, include diamond vertices and edge centers, and avoid shape cutouts");
  const nearbyActor = buildLibraryComponent("uml-actor", 0, 0);
  const nearbyActorAnchor = connectionAnchorsFor(nearbyActor)[0];
  const nearbyActorPoint = anchorPoint(nearbyActor, nearbyActorAnchor);
  const distantActors = Array.from({ length: 300 }, (_, index) => buildLibraryComponent("uml-actor", 5000 + index * 300, 5000));
  const nearbyActorBinding = nearestBinding([...distantActors, nearbyActor], nearbyActorPoint, 1);
  check(nearbyActorBinding?.binding.elementId === nearbyActor.id && !!nearbyActorBinding && Math.hypot(nearbyActorBinding.point.x - nearbyActorPoint.x, nearbyActorBinding.point.y - nearbyActorPoint.y) <= 1,
    "Connector endpoint snapping finds a nearby component among 300 distant components");
  const actionComponent = buildLibraryComponent("uml-activity-action", 0, 0);
  const actionSvg = modelComponentSvg(actionComponent, "light");
  const actionOutline = document.createElementNS("http://www.w3.org/2000/svg", "path"); actionOutline.setAttribute("d", componentOutlinePath("uml-activity-action", 190, 100));
  const packageOutlineData = componentOutlinePath("uml-package", 190, 100);
  const packageOutline = document.createElementNS("http://www.w3.org/2000/svg", "path"); packageOutline.setAttribute("d", packageOutlineData);
  check(actionSvg.includes('rx="15"') && Number.isFinite(actionOutline.getTotalLength()) && actionOutline.getTotalLength() > 0
    && Number.isFinite(packageOutline.getTotalLength()) && packageOutlineData !== componentOutlinePath("uml-package", 100, 100),
  "UML action borders stay rounded in SVG and package ports use size-matched contours");

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
    const context = createAutoRouteContext([source, obstacle, target, connector]);
    const routePoints = autoRoutePoints(connector, context);
    const conservativeContext = createAutoRouteContext([source, obstacle, target, connector]);
    const routedPoints = [{ x: connector.x, y: connector.y }, ...routePoints, { x: connector.x + connector.w, y: connector.y + connector.h }];
    const visibleAlongRoute = routedPoints.slice(1).every((point, index) => {
      const previous = routedPoints[index];
      const viewport = { x: Math.min(previous.x, point.x) - 1, y: Math.min(previous.y, point.y) - 1, w: Math.abs(point.x - previous.x) + 2, h: Math.abs(point.y - previous.y) + 2 };
      return autoRouteMayIntersect(connector, conservativeContext, viewport);
    });
    return route.length > 0 && clear && optimized?.type === "arrow" && optimized.autoRoute === true && !!optimized.routePoints?.length && visibleAlongRoute;
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
  const legacyTable = buildNoteGroup(7600, 13600, "note", "| Name | Value |\n| --- | --- |\n| A | B |", { width: 340, height: 154, title: "Markdown table" });
  const fittedTable = normalizeElement(JSON.parse(JSON.stringify({ ...legacyTable, id: "legacy-table", elements: legacyTable.elements.map(child => ({ ...child, id: "legacy-table-surface" })) })));
  check(fittedTable?.type === "group" && fittedTable.note?.content === legacyTable.note?.content && (fittedTable.note?.height ?? 0) < 154
    && fittedTable.elements[0]?.type === "rectangle" && fittedTable.elements[0].h === fittedTable.note?.height,
  "Legacy default-sized Markdown tables fit content without losing the table data");
  const tableOnly = buildNoteGroup(0, 0, "note", "| Name | Value |\n| --- | --- |\n| A | B |", { width: 200, title: "Markdown table" });
  const tableCanvas = canvas(210, 100); const tableContext = tableCanvas.getContext("2d")!;
  drawNoteCard(tableContext, tableOnly, "light", "simple");
  check(tableOnly.note?.height === 44 && !noteCollapseHit(tableOnly, { x: 185, y: 10 }), "Standalone Markdown tables use compact bounds and have no collapse control");
  check(tableContext.getImageData(50, 30, 1, 1).data[3] === 0 && tableContext.getImageData(50, 10, 1, 1).data[3] > 0, "Standalone Markdown tables render without a card background");
  check(markdownTableRows(serializeMarkdownTableRows([["Name", "A|B"], ["Item", "Value"]]))[0][1] === "A|B", "Markdown table cells preserve escaped pipe characters");
  check(serializeMarkdownTableRows([["Name", "Value"], ["A", "B"]], "| Name | Value |\n| :--- | ---: |\n| A | B |").includes("| :--- | ---: |"), "Grid editing keeps Markdown table column alignment");
  const neutralIcons = CLOUD_NEUTRAL_COMPONENTS.every(component => !!cloudNeutralIconPath(component.kind));
  check(neutralIcons, "Every provider-neutral and integration component has an SVG icon path");
  const legacyCloud = buildLibraryComponent("cloud-kubernetes", 5800, 8600);
  const fittedCloud = normalizeElement(JSON.parse(JSON.stringify({ ...legacyCloud, componentBounds: { x: 5800, y: 8600, w: 176, h: 108 } })));
  check(fittedCloud?.type === "group" && fittedCloud.componentBounds?.h === 58 && fittedCloud.libraryComponent?.kind === "cloud-kubernetes",
  "Legacy default-sized neutral cloud cards become compact on import");
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
      const leaves = flatten([built]); const hasConnectableTarget = leaves.some(item => item.id !== built.id && isConnectable(item)) || isConnectable(built) || leaves.some(item => item.type === "line" || item.type === "arrow");
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
  const narrowComponentFailures: string[] = [];
  for (const definition of LIBRARY_COMPONENTS) {
    if (definition.kind.startsWith("viz-")) continue;
    const built = buildLibraryComponent(definition.kind, 20, 20);
    const bounds = built.componentBounds;
    if (!bounds) continue;
    for (const [width, height] of [[2, bounds.h], [8, bounds.h], [10, bounds.h], [bounds.w, 2], [bounds.w, 8], [10, 10]] as const) {
      const sample = resizeLibraryGroup(built, { ...bounds, w: width, h: height });
      try {
        drawModelComponent(canvas(320, 240).getContext("2d")!, sample, "light");
        const svg = modelComponentSvg(sample);
        if (/<(?:circle|ellipse|rect)\b[^>]*\b(?:r|rx|ry|width|height)="-(?:\d|\.)/i.test(svg)) narrowComponentFailures.push(`${definition.kind} ${width}×${height}: negative SVG geometry`);
      }
      catch (error) { narrowComponentFailures.push(`${definition.kind} ${width}×${height}: ${String(error)}`); }
    }
  }
  if (narrowComponentFailures.length) console.info("Narrow component failures", narrowComponentFailures.length, JSON.stringify(narrowComponentFailures));
  check(narrowComponentFailures.length === 0, "Every model component renders safely at narrow imported dimensions");
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
    const relation: ShapeElement = { type: "arrow", id: "relationship-label", x: 20, y: 20, w: 120, h: 0, color: "#333333", thickness: 1.5, relationshipType: "dependency", cardinality: "1..*", relationshipDirection: "both", label: { text: "calls", color: "#333333", fontSize: 12, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } };
    const display = relationshipDisplayElement(relation); const serialized = normalizeElement(JSON.parse(JSON.stringify(relation)));
    const both = relationshipDirectionHeads("both"); const forward = relationshipDirectionHeads("forward"); const none = relationshipDirectionHeads("none");
    const caption = display.label?.text ?? "";
    const passed = caption.includes("calls") && caption.includes("Dependency") && caption.includes("1..*") && serialized?.type === "arrow" && serialized.relationshipDirection === "both" && both.startHead === "solid" && both.endHead === "solid" && forward.startHead === "none" && forward.endHead === "solid" && none.startHead === "none" && none.endHead === "none";
    if (!passed) console.info("Audit relationship diagnostic:", JSON.stringify({ caption, serializedType: serialized?.type, serializedDirection: serialized?.type === "arrow" ? serialized.relationshipDirection : undefined, both, forward, none }));
    return passed;
  });
  console.info("Audit: mobile controls and performance workloads");
  const style = document.createElement("style"); style.textContent = `${foundationCss}\n${mobileToolbarCss}\n${canvasToolsCss}\n${homeCss}\n${popoverCss}`; document.head.append(style);
  const styleFixtureHost = document.createElement("div");
  styleFixtureHost.className = "app-shell platform-windows";
  styleFixtureHost.style.cssText = "--theme-primary:rgb(30,90,200);--theme-primary-border:rgb(60,110,200);--theme-primary-muted:rgb(220,230,255);--theme-info:rgb(20,140,200);--theme-warning:rgb(210,150,30);--theme-background:rgb(245,247,250);--theme-surface:rgb(250,250,252);--theme-surface-elevated:rgb(255,255,255);--theme-border:rgb(200,210,220);--theme-shadow:rgb(0 0 0 / 0.2);--theme-text-primary:rgb(20,25,35);--theme-text-secondary:rgb(70,80,90);--theme-text-tertiary:rgb(100,110,120)";
  document.body.append(styleFixtureHost);
  const shapePaletteHost = document.createElement("div");
  shapePaletteHost.className = "tool-family options-open";
  styleFixtureHost.append(shapePaletteHost);
  let spawnAllShapeClicks = 0;
  const disposeShapePalette = render(() => createComponent(WindowsShapePalette, { activeTool: "rectangle", activeFlowchartShape: "process", canSpawnAll: true, busy: false, onSelect: () => {}, onSpawnAll: () => { spawnAllShapeClicks++; } }), shapePaletteHost);
  const shapeFooterButton = shapePaletteHost.querySelector<HTMLButtonElement>(".windows-shape-footer button");
  shapeFooterButton?.click();
  check(!!shapeFooterButton && !shapeFooterButton.disabled && spawnAllShapeClicks === 1,
    "Windows Shapes panel exposes a working spawn-all footer action");
  disposeShapePalette();
  const moreToolsFixture = document.createElement("div");
  moreToolsFixture.className = "tool-family more-tools-family options-open";
  moreToolsFixture.style.position = "relative";
  moreToolsFixture.innerHTML = `<div class="tool-options more-tools-options"><div class="more-tools-paint-entry"><button>Paint brushes</button><div class="more-tools-brush-options"><button><span>Extra long soft brush name</span></button><button><span>Another long brush name</span></button></div></div></div>`;
  styleFixtureHost.append(moreToolsFixture);
  const moreToolsPanel = moreToolsFixture.querySelector<HTMLElement>(".more-tools-options")!;
  const moreToolsWidth = moreToolsPanel.getBoundingClientRect().width;
  if (Math.abs(moreToolsWidth - 228) >= 1 || moreToolsPanel.scrollWidth > moreToolsPanel.clientWidth + 1) console.info("More Tools width diagnostic", JSON.stringify({ width: moreToolsWidth, scrollWidth: moreToolsPanel.scrollWidth, clientWidth: moreToolsPanel.clientWidth, children: [...moreToolsPanel.querySelectorAll(".more-tools-paint-entry, .more-tools-brush-options, .more-tools-brush-options button")].map(item => ({ class: item.className, width: item.getBoundingClientRect().width, scroll: item.scrollWidth, client: item.clientWidth })) }));
  check(Math.abs(moreToolsWidth - 228) < 1 && moreToolsPanel.scrollWidth <= moreToolsPanel.clientWidth + 1,
    "Expanding nested brushes keeps the More Tools panel at its standard width");
  const quickStyleFixture = document.createElement("aside");
  quickStyleFixture.className = "style-pane quick-style-mode";
  quickStyleFixture.innerHTML = `<div class="quick-style-heading"><button><svg></svg></button></div><div class="quick-style-controls"><button class="quick-style-icon"><svg></svg></button></div>`;
  styleFixtureHost.append(quickStyleFixture);
  const quickStyleButton = quickStyleFixture.querySelector<HTMLElement>(".quick-style-icon")!;
  const quickStyleGlyph = quickStyleButton.querySelector<SVGElement>("svg")!;
  const quickStyleDimensions = { pane: getComputedStyle(quickStyleFixture).width, button: getComputedStyle(quickStyleButton).width, glyph: getComputedStyle(quickStyleGlyph).width };
  const quickStyleSizePass = quickStyleDimensions.pane === "50px" && quickStyleDimensions.button === "38px" && quickStyleDimensions.glyph === "20px";
  if (!quickStyleSizePass) console.info("Quick-style size diagnostic:", JSON.stringify(quickStyleDimensions));
  check(quickStyleSizePass, "Quick-style rail uses the requested 50px pane and preserves its touch target and icon dimensions");
  const welcomeFixture = document.createElement("section");
  welcomeFixture.className = "home-screen home-screen-desktop";
  welcomeFixture.style.cssText = "width:1200px;height:760px";
  welcomeFixture.innerHTML = `<div class="home-desktop-layout"><section class="home-hero"></section><section class="home-library"></section><nav class="workspace-viewport-tabs"><button>Canvas</button><button>Planning</button></nav></div>`;
  styleFixtureHost.append(welcomeFixture);
  const welcomeHero = welcomeFixture.querySelector<HTMLElement>(".home-hero")!;
  const welcomeLayout = welcomeFixture.querySelector<HTMLElement>(".home-desktop-layout")!;
  const welcomeTabs = welcomeFixture.querySelector<HTMLElement>(".workspace-viewport-tabs")!;
  const welcomeStyle = getComputedStyle(welcomeFixture);
  const welcomeLayoutBounds = welcomeLayout.getBoundingClientRect();
  const welcomeTabsBounds = welcomeTabs.getBoundingClientRect();
  const welcomePass = welcomeStyle.display === "block" && getComputedStyle(welcomeHero).backgroundImage.includes("linear-gradient") && welcomeTabsBounds.bottom <= welcomeLayoutBounds.bottom + 1;
  if (!welcomePass) console.info("Welcome screen style diagnostic:", JSON.stringify({ display: welcomeStyle.display, background: getComputedStyle(welcomeHero).backgroundImage, layoutBottom: welcomeLayoutBounds.bottom, tabsBottom: welcomeTabsBounds.bottom }));
  check(welcomePass, "Desktop welcome viewport keeps its layered hero and fits its canvas/planning tabs at the layout bottom");
  const flowchartFixture = document.createElement("div");
  flowchartFixture.className = "tool-family options-open flowchart-family";
  flowchartFixture.innerHTML = `<button class="tool-icon-button has-options"></button><div class="tool-options flowchart-options"><header class="flowchart-palette-heading"></header><label class="flowchart-palette-search"></label><div class="flowchart-palette-tabs"></div><div class="flowchart-shape-grid"></div><button class="flowchart-spawn-all"></button></div>`;
  styleFixtureHost.append(flowchartFixture);
  const flowchartPanel = flowchartFixture.querySelector<HTMLElement>(".flowchart-options")!;
  const flowchartGrid = flowchartFixture.querySelector<HTMLElement>(".flowchart-shape-grid")!;
  flowchartGrid.innerHTML = Array.from({ length: 40 }, (_, index) => `<button type="button">Shape ${index + 1}</button>`).join("");
  flowchartGrid.scrollTop = flowchartGrid.scrollHeight;
  const popoverScrollState = {
    panelOverflow: getComputedStyle(flowchartPanel).overflowY,
    gridOverflow: getComputedStyle(flowchartGrid).overflowY,
    gridHasOverflow: flowchartGrid.scrollHeight > flowchartGrid.clientHeight,
    gridReachedBottom: flowchartGrid.scrollTop + flowchartGrid.clientHeight >= flowchartGrid.scrollHeight - 1,
    panelScrolls: flowchartPanel.scrollHeight > flowchartPanel.clientHeight,
  };
  const popoverScrollPass = popoverScrollState.panelOverflow === "hidden" && popoverScrollState.gridOverflow === "auto" && popoverScrollState.gridHasOverflow && popoverScrollState.gridReachedBottom && !popoverScrollState.panelScrolls;
  if (!popoverScrollPass) console.info("Flowchart popover scroll diagnostic:", JSON.stringify(popoverScrollState));
  check(popoverScrollPass, "Flowchart palette routes bottom scrolling through one shape-grid viewport");
  flowchartFixture.remove();
  const planningTabHost = document.createElement("div"); document.body.append(planningTabHost);
  let closedPlanningPath = "";
  const disposePlanningTabs = render(() => createComponent(DocumentTabs, {
    paths: ["C:/SketchDraw/Launch.sdplan"], activePath: "C:/SketchDraw/Launch.sdplan", ariaLabel: "Open Planning files",
    displayName: path => path.split("/").pop() ?? path, onSelect() {}, onClose: path => { closedPlanningPath = path; },
  }), planningTabHost);
  const planningTab = planningTabHost.querySelector<HTMLElement>(".windows-document-tabs");
  planningTabHost.querySelector<HTMLButtonElement>(".windows-document-tab-close")?.click();
  check(planningTab?.getAttribute("aria-label") === "Open Planning files" && closedPlanningPath === "C:/SketchDraw/Launch.sdplan", "Planning document tabs expose an accessible label and close the selected file");
  disposePlanningTabs(); planningTabHost.remove();
  let styleLibraryOpened = false;
  const menuHost = document.createElement("div"); menuHost.className = "app-shell"; document.body.append(menuHost);
  const disposeMenu = render(() => createComponent(CanvasOptionsMenu, {
    open: true, showGrid: true, snapToGrid: true, snapToObjects: true, snapMovesToTen: true, hasElements: true, hasSelection: true, canGroup: true, grouped: false, boardLocked: false,
    onToggle() {}, onCloseOtherTools() {}, onFitDrawing() {}, onFitSelection() {}, onToggleGrid() {}, onToggleSnapToGrid() {}, onToggleSnapToObjects() {}, onToggleSnapMovesToTen() {}, onGroupSelection() {},
    penInput: { pressureWidth: false, tiltShaping: false, stylusEraserEnd: false, disabled: false, onPressureWidthChange() {}, onTiltShapingChange() {}, onStylusEraserEndChange() {} },
    styleLibrary: { onOpen() { styleLibraryOpened = true; } },
    canvasTools: { showMinimap: true, onToggleMinimap() {}, onAutoLayout() {} },
  }), menuHost);
  const controls = [...menuHost.querySelectorAll<HTMLElement>("button,input,select,textarea,[role=button]")];
  const viewMenu = menuHost.querySelector<HTMLElement>(".canvas-options-family");
  const sections = [...menuHost.querySelectorAll<HTMLElement>(".workspace-view-section")];
  const canvasAidsSection = sections.find(section => section.querySelector("h2")?.textContent?.includes("Canvas aids"));
  check(!!viewMenu && !viewMenu.classList.contains("mobile-simple-mode") && sections.length > 0 && sections.every(section => section.tagName === "SECTION"), "Canvas settings use plain, always-visible sections");
  check(!!canvasAidsSection && sections[0] === canvasAidsSection && !menuHost.querySelector("details.workspace-view-section, .workspace-view-section > summary, .workspace-view-header button"), "Canvas aids appear first with no expand or close controls");
  check(!!menuHost.querySelector(".workspace-view-section h2") && controls.some(control => control.textContent?.includes("Pressure width")), "Canvas and pen settings remain available in the panel");
  const unlabeledControls = controls.filter(control => !(control.getAttribute("aria-label") || control.getAttribute("title") || control.textContent?.trim() || control.closest("label")?.textContent?.trim()));
  check(unlabeledControls.length === 0, `Canvas view controls expose accessible names (${unlabeledControls.length} missing)`);
  const firstEnabled = controls.find(control => control instanceof HTMLButtonElement && !control.disabled);
  firstEnabled?.focus(); check(!firstEnabled || document.activeElement === firstEnabled, "Canvas view controls can receive keyboard focus");
  const styleLibraryButton = [...menuHost.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.includes("Style library"));
  styleLibraryButton?.click();
  check(styleLibraryOpened, "Canvas settings open the style library");
  check(!menuHost.querySelector('input[aria-label="Stroke smoothing"]') && !menuHost.querySelector('select[aria-label="Selection drag mode"]') && !menuHost.querySelector('select[aria-label="Color vision preview"]'), "Canvas settings no longer carry stroke smoothing, selection mode, or color vision controls");
  const viewHost = document.createElement("div"); document.body.append(viewHost);
  let chosenVision = ""; let openedOutline = false; let openedNavigator = false;
  const disposeView = render(() => createComponent(ViewSettingsPopover, {
    themeMode: "light", accentColor: "#3b82f6", toolbarColorChoice: "auto", accentOptions: [], toolbarColorOptions: [], boardColor: "#ffffff", renderedBoardColor: "#ffffff", boardColorFollowsTheme: true, boardLocked: false, boardColors: [], paperPattern: "plain", patterns: [], namedVersionsDisabled: false,
    onThemeChange() {}, onAccentChange() {}, onToolbarColorChange() {}, onBoardFollowTheme() {}, onBoardColorChange() {}, onPaperPatternChange() {}, onNamedVersions() {},
    accessibility: { colorVisionMode: "none", colorVisionModes: [{ id: "none", label: "Normal vision" }, { id: "deuteranopia", label: "Deuteranopia (no green)" }], safePalette: false, documentDisabled: false, onColorVisionModeChange(mode: string) { chosenVision = mode; }, onSafePaletteChange() {}, onOpenOutline() { openedOutline = true; }, onOpenNavigator() { openedNavigator = true; } },
  }), viewHost);
  const visionSelect = viewHost.querySelector<HTMLSelectElement>('select[aria-label="Color vision preview"]');
  if (visionSelect) { visionSelect.value = "deuteranopia"; visionSelect.dispatchEvent(new Event("change", { bubbles: true })); }
  const viewButtons = [...viewHost.querySelectorAll<HTMLButtonElement>("button")];
  viewButtons.find(button => button.textContent?.includes("Document outline"))?.click(); viewButtons.find(button => button.textContent?.includes("Frame navigator"))?.click();
  check(chosenVision === "deuteranopia" && openedOutline && openedNavigator && [...viewHost.querySelectorAll("input[type=checkbox]")].some(box => box.parentElement?.textContent?.includes("Color-blind-safe swatches")), "The View menu holds the color vision preview, safe swatches, document outline, and frame navigator");
  disposeView(); viewHost.remove();
  check(DEFAULT_TOOL_ORDER.indexOf("lasso") === DEFAULT_TOOL_ORDER.indexOf("select") + 1 && DEFAULT_TOOL_ORDER.indexOf("lasso") > 0, "Lasso is its own toolbar tool placed right after Select");
  const defaultLayout = defaultToolbarLayout();
  check([...defaultLayout.toolbar, ...defaultLayout.more].includes("lasso") && [...defaultLayout.toolbar, ...defaultLayout.more].includes("select"), "Both Select and Lasso are available in the default toolbar layout");
  disposeMenu(); menuHost.remove(); styleFixtureHost.remove(); style.remove();
  // PDF import: render a generated PDF with the bundled pdf.js build and check pixels, size, and extracted text.
  try {
    const pdf = await PDFDocument.create(); const sheet = pdf.addPage([300, 200]);
    sheet.drawRectangle({ x: 20, y: 20, width: 100, height: 60, color: rgb(1, 0, 0) }); sheet.drawText("Quarterly review", { x: 30, y: 150, size: 18 });
    const imported = await renderPdfPages(await pdf.save());
    const pageImage = imported.pages[0];
    const raster = new Image(); raster.src = pageImage?.dataUrl ?? ""; await raster.decode();
    const probe = document.createElement("canvas"); probe.width = raster.naturalWidth; probe.height = raster.naturalHeight;
    const probeContext = probe.getContext("2d")!; probeContext.drawImage(raster, 0, 0);
    const scaleX = raster.naturalWidth / 300; const red = probeContext.getImageData(Math.round(70 * scaleX), Math.round((200 - 50) * scaleX), 1, 1).data; const blank = probeContext.getImageData(Math.round(250 * scaleX), Math.round(20 * scaleX), 1, 1).data;
    check(imported.pages.length === 1 && !imported.truncated && pageImage.width === 300 && pageImage.height === 200 && pageImage.dataUrl.startsWith("data:image/jpeg;base64,") && raster.naturalWidth > 300, "PDF import renders each page to an embedded image at the page's point size");
    check(red[0] > 200 && red[1] < 70 && red[2] < 70 && blank[0] > 240 && blank[1] > 240 && blank[2] > 240, "PDF import draws page content on a white background");
    check(pageImage.text.includes("Quarterly review"), "PDF import extracts page text for alt text");
  } catch (cause) { check(false, `PDF import renders pages (${String(cause)})`); }
  let rejectedNonPdf = false; try { await renderPdfPages(new Uint8Array([1, 2, 3, 4])); } catch { rejectedNonPdf = true; }
  check(rejectedNonPdf, "PDF import rejects files that are not PDF documents");

  // Files keep alt text, style bindings, the style library, auto-layout frames, and bookmarks across save and reopen.
  {
    const library = { colors: [{ id: "brand", name: "Brand", value: "#2468a0", modeValues: { dark: "#9ec5ee" } }, { id: "accent", name: "Accent", value: "#ffffff", aliasOf: "brand" }], textStyles: [{ id: "title", name: "Title", fontSize: 28, fontFamily: "serif" as const, bold: true }], strokeStyles: [{ id: "heavy", name: "Heavy", thickness: 6, lineStyle: "dashed" as const }], modes: [{ id: "light", name: "Light" }, { id: "dark", name: "Dark" }], activeModeId: "dark", followTheme: true };
    const card = { type: "rectangle" as const, id: "card", x: 0, y: 0, w: 80, h: 40, color: "#2468a0", thickness: 6, lineStyle: "dashed" as const, altText: "Primary card", layoutFill: true, styleBindings: { stroke: { id: "brand", applied: "{\"color\":\"#2468a0\"}" } } };
    const frame = { type: "group" as const, id: "frame", elements: [card], componentBounds: { x: 0, y: 0, w: 200, h: 100 }, container: { kind: "frame" as const, name: "Screen", autoResize: true, padding: 12, autoLayout: { direction: "horizontal" as const, gap: 8, padding: 12, align: "center" as const } } };
    const page = { id: "page-1", name: "Page 1", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff", boardColorFollowsTheme: true }, elements: [frame], styleLibrary: library, bookmarks: [{ id: "view-1", name: "Overview", zoom: .5, panX: 40, panY: -20 }] };
    const saved = serializeSketchSnapshot(createSketchSnapshot({ pages: [page], activePageId: "page-1", activeElements: [frame], activeCanvasState: page.canvasState, activeRenderedBoardColor: "#ffffff", theme: "light", library: { quickNotes: [], studyNotes: [], studyCards: [], wikiArticles: [], journalEntries: [], writingDrafts: [], researchSources: [], mediaEntries: [] } }));
    const reopened = parseSketchFile(JSON.parse(saved));
    const reopenedPage = reopened?.pages[0]; const reopenedFrame = reopenedPage?.elements[0]; const reopenedCard = reopenedFrame?.type === "group" ? reopenedFrame.elements[0] : undefined;
    check(reopenedPage?.styleLibrary?.activeModeId === "dark" && reopenedPage.styleLibrary.followTheme === true && reopenedPage.styleLibrary.colors[1].aliasOf === "brand" && reopenedPage.styleLibrary.colors[0].modeValues?.dark === "#9ec5ee" && reopenedPage.styleLibrary.textStyles[0].name === "Title" && reopenedPage.styleLibrary.strokeStyles[0].thickness === 6, "Saved sketches keep the style library with modes, aliases, text styles, and stroke styles");
    check(reopenedCard?.altText === "Primary card" && reopenedCard.layoutFill === true && reopenedCard.styleBindings?.stroke?.id === "brand", "Saved sketches keep alt text, style bindings, and fill-space flags on objects");
    check(reopenedFrame?.type === "group" && reopenedFrame.container?.autoLayout?.direction === "horizontal" && reopenedFrame.container.autoLayout.gap === 8 && reopenedFrame.container.autoLayout.align === "center", "Saved sketches keep auto-layout frame settings");
    check(reopenedPage?.bookmarks?.length === 1 && reopenedPage.bookmarks[0].name === "Overview" && reopenedPage.bookmarks[0].zoom === .5, "Saved sketches keep saved views");
    const hostile = parseSketchFile(JSON.parse(saved.replace('"direction":"horizontal"', '"direction":"diagonal"')));
    check(hostile === undefined, "Invalid auto-layout settings are rejected instead of silently dropped");
  }

  // The interactive HTML viewer works as a standalone page: tabs, page links, layers, zoom, safe links, and no injected markup.
  {
    const serialize = createSvgElementSerializer({ theme: () => "light", isHidden: item => !!item.hidden, simpleComponentElement: item => item, connectorForView: item => item, labelSvg: () => "" });
    const hostile = "<script>window.__pwned=1</script><img src=x onerror=window.__pwned=1>";
    const pageA = [
      { type: "rectangle" as const, id: "go-b", x: 0, y: 0, w: 120, h: 60, color: "#2468a0", thickness: 2, pageLinkId: "page-b", pageLinkTransition: "fade" as const, label: { text: hostile, color: "#000000", fontSize: 14, verticalAlign: "middle" as const } },
      { type: "rectangle" as const, id: "docs", x: 200, y: 0, w: 120, h: 60, color: "#2468a0", thickness: 2, href: "https://example.com/docs?a=1&b=2", tooltip: 'Open "docs"' },
      { type: "rectangle" as const, id: "bad", x: 400, y: 0, w: 120, h: 60, color: "#2468a0", thickness: 2, href: "javascript:alert(1)" },
      { type: "rectangle" as const, id: "notes", x: 0, y: 120, w: 120, h: 60, color: "#a02424", thickness: 2, layerId: "layer-1" },
    ];
    const pageB = [{ type: "rectangle" as const, id: "back", x: 0, y: 0, w: 80, h: 40, color: "#2468a0", thickness: 2 }];
    const html = buildInteractiveViewer({ title: `Review "${hostile}"`, startPageId: "page-a", pages: [
      { id: "page-a", name: `Overview ${hostile}`, bounds: { x: 0, y: 0, w: 520, h: 180 }, background: "#ffffff", svg: pageA.map(serialize).join(""), layers: [{ id: "layer-1", name: "Notes", hidden: false }], frames: [] },
      { id: "page-b", name: "Details", bounds: { x: 0, y: 0, w: 80, h: 40 }, background: "#ffffff", svg: pageB.map(serialize).join(""), layers: [], frames: [{ id: "sketchdraw-back", name: "Back screen", x: 0, y: 0, w: 80, h: 40 }] },
    ] });
    const frame = document.createElement("iframe"); frame.style.cssText = "position:fixed;left:0;top:0;width:900px;height:600px;border:0"; document.body.append(frame);
    await new Promise<void>(resolve => { frame.onload = () => resolve(); frame.srcdoc = html; });
    const win = frame.contentWindow as Window & { __sketchdrawViewer?: { current: string | null }; __pwned?: number }; const doc = frame.contentDocument!;
    const viewer = () => win.__sketchdrawViewer!;
    check(!!win.__sketchdrawViewer && viewer().current === "page-a" && doc.querySelectorAll(".sd-tab").length === 2 && (win.__pwned ?? 0) === 0 && doc.querySelectorAll("script").length === 2 && doc.querySelectorAll("img").length === 0, "Interactive viewer loads standalone, starts on the chosen page, and ignores markup in names and labels");
    const docsLink = doc.querySelector<SVGAElement>('a[href="https://example.com/docs?a=1&b=2"]');
    check(!!docsLink && docsLink.getAttribute("target") === "_blank" && docsLink.getAttribute("rel") === "noopener noreferrer" && docsLink.querySelector("title")?.textContent === 'Open "docs"' && !doc.querySelector('a[href*="javascript"]'), "Viewer links open in a new tab safely, carry tooltips, and drop unsafe URLs");
    const svg = doc.querySelector<SVGSVGElement>('.sd-page[data-page-id="page-a"] svg')!; const widthBefore = svg.viewBox.baseVal.width;
    svg.dispatchEvent(new WheelEvent("wheel", { deltaY: -300, clientX: 450, clientY: 300, bubbles: true, cancelable: true }));
    check(svg.viewBox.baseVal.width < widthBefore, "Viewer zooms with the mouse wheel");
    const noteWrapper = doc.querySelector<SVGGElement>('[data-layer="layer-1"]')!; const layerBox = doc.querySelector<HTMLInputElement>('.sd-layers-list input[type=checkbox]')!;
    layerBox.checked = false; layerBox.dispatchEvent(new Event("change", { bubbles: true }));
    check(noteWrapper.style.display === "none", "Viewer layer toggles hide and show a layer");
    const target = doc.querySelector<SVGGElement>('[data-page-link="page-b"]')!;
    const down = (type: string, id: number) => target.dispatchEvent(new PointerEvent(type, { pointerId: id, button: 0, clientX: 100, clientY: 100, bubbles: true, cancelable: true }));
    down("pointerdown", 1); down("pointerup", 1);
    check(viewer().current === "page-b" && doc.querySelector('.sd-page[data-page-id="page-b"]')!.classList.contains("active") && !doc.querySelector<HTMLButtonElement>(".sd-back")!.disabled && doc.querySelectorAll(".sd-frames option").length === 1, "Clicking a page link navigates with history and lists the destination page's screens");
    doc.querySelector<HTMLButtonElement>(".sd-back")!.click();
    check(viewer().current === "page-a", "The viewer's Back button returns to the previous page");
    frame.remove();
  }

  // Org charts from CSV flow through the live editor; mermaid sequence diagrams play back message by message.
  {
    const org = generateLiveDiagram("org", "name,title,manager\nAda,CEO,\nBen,CTO,Ada\nCy,Eng,Ben", { x: 0, y: 0 }, "org-session");
    const adaNode = org.elements.find(item => item.liveKey === "Ada"); const cyNode = org.elements.find(item => item.liveKey === "Cy");
    check(org.elements.length === 5 && !!adaNode && !!cyNode && adaNode.type === "rectangle" && cyNode.type === "rectangle" && adaNode.y < cyNode.y && org.elements.filter(item => item.type === "arrow").every(item => item.type === "arrow" && Math.abs(item.h) > 10), "The live editor builds an org chart from CSV with bound reporting lines");
    check(matchLineElements(org.elements, "org-session", "Ben,CTO,Ada").length >= 2, "Org chart rows link to the people they name");
    const sequence = generateLiveDiagram("mermaid", "sequenceDiagram\n  Client->>API: GET /orders\n  API->>DB: query\n  DB-->>API: rows\n  API-->>Client: 200 OK", { x: 0, y: 0 }, "seq-session");
    const steps = sequenceSteps(sequence.elements);
    check(steps.length === 4 && steps[0].from === "Client" && steps[0].to === "API" && steps[0].label === "GET /orders" && steps[3].to === "Client", "Sequence playback orders messages top to bottom with their participants");
    const playHost = document.createElement("div"); document.body.append(playHost); const played: string[] = [];
    const disposePlay = render(() => createComponent(SequencePlaybackPanel, { steps, index: 1, playing: false, onPrevious() { played.push("prev"); }, onNext() { played.push("next"); }, onTogglePlay() { played.push("play"); }, onReset() { played.push("reset"); }, onClose() {} }), playHost);
    [...playHost.querySelectorAll<HTMLButtonElement>("button")].filter(button => ["Previous", "Next", "Play", "Reset"].includes(button.textContent ?? "")).forEach(button => button.click());
    check(played.join(",") === "prev,play,next,reset" && playHost.textContent?.includes("Step 2 of 4") === true && playHost.textContent.includes("API") && playHost.textContent.includes("query"), "The sequence playback panel shows the current step and responds to its controls");
    disposePlay(); playHost.remove();
  }

  // Linked data saves with the sketch and the panel links the selected shape to a row.
  {
    const source = { id: "ops", name: "ops.csv", headers: ["service", "status"], rows: [["API", "up"], ["DB", "down"]], updatedAt: 5 };
    const linkedShape = { type: "rectangle" as const, id: "api-box", x: 0, y: 0, w: 100, h: 50, color: "#000000", thickness: 2, dataLink: { source: "ops", key: "service", value: "DB", label: "status", rules: "status = down -> fill #d64545" } };
    const dataPage = { id: "p", name: "P", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff", boardColorFollowsTheme: true }, elements: [linkedShape], dataSources: [source] };
    const savedData = serializeSketchSnapshot(createSketchSnapshot({ pages: [dataPage], activePageId: "p", activeElements: [linkedShape], activeCanvasState: dataPage.canvasState, activeRenderedBoardColor: "#ffffff", theme: "light", library: { quickNotes: [], studyNotes: [], studyCards: [], wikiArticles: [], journalEntries: [], writingDrafts: [], researchSources: [], mediaEntries: [] } }));
    const reopenedData = parseSketchFile(JSON.parse(savedData))?.pages[0];
    check(reopenedData?.dataSources?.[0]?.rows[1][1] === "down" && reopenedData.elements[0].dataLink?.value === "DB" && reopenedData.elements[0].dataLink.rules?.includes("fill #d64545") === true, "Saved sketches keep linked data tables and the links on shapes");
    check(parseSketchFile(JSON.parse(savedData.replace('"headers":["service","status"]', '"headers":[]')))?.pages[0].dataSources === undefined, "Invalid linked data tables are dropped instead of breaking the file");
    const dataHost = document.createElement("div"); document.body.append(dataHost); let appliedLink: unknown; let addedFile = false;
    const disposeData = render(() => createComponent(DataLinkPanel, { sources: [source], canEdit: true, selection: { label: "Rectangle", canShowText: true }, onAddFile() { addedFile = true; }, onRefresh() {}, onRemove() {}, onLink: link => { appliedLink = link; }, onUnlink() {}, onClose() {} }), dataHost);
    const pick = (label: string, value: string) => { const select = dataHost.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!; select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); };
    pick("Match column", "service");
    const rowInput = dataHost.querySelector<HTMLInputElement>('input[aria-label="Row value"]')!; rowInput.value = "API"; rowInput.dispatchEvent(new Event("input", { bubbles: true }));
    pick("Text column", "status");
    const rulesBox = dataHost.querySelector<HTMLTextAreaElement>('textarea[aria-label="Color rules"]')!; rulesBox.value = "status = down -> fill #d64545"; rulesBox.dispatchEvent(new Event("input", { bubbles: true }));
    [...dataHost.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Link object")?.click();
    [...dataHost.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.includes("Add CSV"))?.click();
    check(JSON.stringify(appliedLink) === JSON.stringify({ source: "ops", key: "service", value: "API", label: "status", rules: "status = down -> fill #d64545" }) && addedFile && dataHost.querySelector('[role="dialog"][aria-label="Linked data"]') !== null, "The linked data panel links the selected shape to a row with a label column and color rules");
    rulesBox.value = "oops"; rulesBox.dispatchEvent(new Event("input", { bubbles: true }));
    check(!!dataHost.querySelector('[role="alert"]') && [...dataHost.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Link object")?.disabled === true, "The linked data panel blocks unreadable rules and explains the fix");
    disposeData(); dataHost.remove();
  }

  // Cloud architecture text builds real provider components; the live editor tags, links, and saves its shapes.
  {
    const cloud = cloudDiagramFromText(`Users [icon: user]\nVPC {\n  Gateway [icon: aws-api-gateway, label: "Public API"]\n  Orders [icon: lambda]\n  DB [icon: azure-sql]\n  Pods [icon: k8s]\n}\nMystery [icon: not-a-real-icon]\nUsers > Gateway: HTTPS\nGateway > Orders > DB\nOrders < Pods`, { x: 0, y: 0 });
    const flat = flatten(cloud.elements);
    const kinds = flat.flatMap(item => item.type === "group" && item.libraryComponent ? [item.libraryComponent.kind] : []);
    const vpc = cloud.elements.find(item => item.id === "cloud-group:VPC");
    const arrows = cloud.elements.filter(item => item.type === "arrow");
    check(kinds.includes("aws-api-gateway") && kinds.includes("aws-lambda") && kinds.includes("azure-sql") && kinds.includes("cloud-kubernetes") && kinds.includes("c4-person"), "Cloud text resolves exact kinds, short names, and aliases to real AWS, Azure, Kubernetes, and C4 components");
    check(vpc?.type === "group" && vpc.elements.length === 4 && !!vpc.componentBounds && vpc.componentBounds.w > 300 && cloud.warnings.some(warning => warning.includes("not-a-real-icon")), "Cloud text wraps grouped nodes in a frame and warns about unknown icons");
    check(arrows.length === 4 && arrows.every(arrow => arrow.type === "arrow" && !!arrow.startBinding && !!arrow.endBinding && (Math.abs(arrow.w) + Math.abs(arrow.h)) > 8) && arrows.some(arrow => arrow.type === "arrow" && arrow.label?.text === "HTTPS"), "Cloud text connectors are bound, resolved to real geometry, and keep labels");
    check(resolveCloudIcon("lambda") === "aws-lambda" && resolveCloudIcon("Load Balancer") === "cloud-load-balancer" && resolveCloudIcon("zzz-unknown") === undefined, "Cloud icon names match by suffix and spelling");
    const ids = new Set(flat.flatMap(item => item.id ? [item.id] : []));
    check(flat.length === ids.size, "Cloud text generates unique object ids");

    const live = generateLiveDiagram("mermaid", "flowchart TD\n  Start([Start]) --> Check{Ready?}\n  Check -->|Yes| Done[Finish]", { x: 100, y: 100 }, "session-one");
    const liveFlat = flatten(live.elements); const liveIds = new Set(liveFlat.flatMap(item => item.id ? [item.id] : []));
    check(live.elements.every(item => item.liveSourceId === "session-one") && live.elements[0].liveSource?.format === "mermaid" && live.elements.filter(item => item.liveSource).length === 1, "Live diagrams tag every shape with the session and keep the code on the first one");
    check(liveFlat.filter(item => item.type === "arrow" || item.type === "line").every(item => (!("startBinding" in item) || !item.startBinding || liveIds.has(item.startBinding.elementId)) && (!("endBinding" in item) || !item.endBinding || liveIds.has(item.endBinding.elementId))) && live.elements.some(item => item.liveKey === "Check"), "Live diagrams keep connector bindings valid after id prefixing and record source names");
    const source = "flowchart TD\n  Start([Start]) --> Check{Ready?}\n  Check -->|Yes| Done[Finish]";
    const lineTwo = matchLineElements(live.elements, "session-one", "  Check -->|Yes| Done[Finish]");
    const matchedKeys = lineTwo.map(index => live.elements[index]).filter(item => item.liveKey).map(item => item.liveKey).sort();
    check(matchedKeys.join(",") === "Check,Done" && lineTwo.some(index => live.elements[index].type === "arrow" || live.elements[index].type === "line"), "Clicking a code line selects its shapes and the connector between them");
    const doneShape = live.elements.find(item => item.liveKey === "Done")!;
    check(findLineForElement(source, doneShape) === 2 && findLineForElement(source, live.elements.find(item => item.liveKey === "Start")!) === 1 && matchLineElements(live.elements, "other", "Check").length === 0, "Selecting a shape finds the first source line that names it");
    let generated = 0;
    for (const [format, code] of [["plantuml", "@startuml\nclass User {\n  id: UUID\n}\nclass Order\nUser --> Order : places\n@enduml"], ["d2", "a: Alpha\nb: Beta\na -> b: link"], ["cloud", "A [icon: aws-s3]\nA > B"]] as const) { try { if (generateLiveDiagram(format, code, { x: 0, y: 0 }, "s").elements.length) generated++; } catch { /* counted below */ } }
    check(generated === 3, "The live editor builds PlantUML, D2, and cloud text");
    let emptyRejected = false; try { generateLiveDiagram("cloud", "   ", { x: 0, y: 0 }, "s"); } catch { emptyRejected = true; }
    check(emptyRejected, "Empty live code is rejected with a message instead of an empty diagram");
    const savedLive = serializeSketchSnapshot(createSketchSnapshot({ pages: [{ id: "p", name: "P", canvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff", boardColorFollowsTheme: true }, elements: live.elements }], activePageId: "p", activeElements: live.elements, activeCanvasState: { zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff", boardColorFollowsTheme: true }, activeRenderedBoardColor: "#ffffff", theme: "light", library: { quickNotes: [], studyNotes: [], studyCards: [], wikiArticles: [], journalEntries: [], writingDrafts: [], researchSources: [], mediaEntries: [] } }));
    const reopenedLive = parseSketchFile(JSON.parse(savedLive))?.pages[0].elements;
    check(!!reopenedLive && reopenedLive.every(item => item.liveSourceId === "session-one") && reopenedLive[0].liveSource?.source.includes("Check") === true && reopenedLive.some(item => item.liveKey === "Done"), "Saved sketches keep live diagram code and shape links");
  }
  const livePanelHost = document.createElement("div"); document.body.append(livePanelHost);
  let liveFormat = ""; let liveCaret = -1; let liveTyped = "";
  const disposeLivePanel = render(() => createComponent(LiveDiagramPanel, { format: "mermaid", source: "flowchart TD\n  A --> B", canEdit: true, status: { kind: "error", message: "Line 2: bad" }, linkedLine: 1, onFormat: format => { liveFormat = format; }, onSource: source => { liveTyped = source; }, onCaretLine: line => { liveCaret = line; }, onTextarea() {}, onExample() {}, onClose() {} }), livePanelHost);
  const liveArea = livePanelHost.querySelector<HTMLTextAreaElement>("textarea"); const liveSelect = livePanelHost.querySelector<HTMLSelectElement>('select[aria-label="Diagram language"]');
  if (liveArea) { liveArea.value = "flowchart TD\n  A --> B\n  B --> C"; liveArea.setSelectionRange(liveArea.value.length, liveArea.value.length); liveArea.dispatchEvent(new Event("input", { bubbles: true })); }
  if (liveSelect) { liveSelect.value = "cloud"; liveSelect.dispatchEvent(new Event("change", { bubbles: true })); }
  check(liveTyped.endsWith("B --> C") && liveCaret === 2 && liveFormat === "cloud" && [...(liveSelect?.options ?? [])].map(option => option.value).join(",") === "mermaid,plantuml,d2,org,cloud" && !!livePanelHost.querySelector('[role="alert"]') && livePanelHost.textContent?.includes("Linked to line 2") === true, "Live diagram panel reports typing, the caret line, the language, errors, and the linked line");
  disposeLivePanel(); livePanelHost.remove();

  // Style library panel and document outline expose labelled, operable controls.
  const panelHost = document.createElement("div"); document.body.append(panelHost);
  const appliedStyles: string[] = []; const removedStyles: string[] = []; let modesEnabled = false;
  const panelLibrary = { colors: [{ id: "brand", name: "Brand", value: "#2468a0" }], textStyles: [{ id: "title", name: "Title", fontSize: 28, fontFamily: "serif" as const, bold: true }], strokeStyles: [{ id: "heavy", name: "Heavy", thickness: 6, lineStyle: "dashed" as const }] };
  const disposePanel = render(() => createComponent(StyleLibraryPanel, {
    library: panelLibrary, canEdit: true, selection: { label: "Rectangle: API", slots: [{ slot: "stroke", state: "unbound" }, { slot: "fill", state: "bound", tokenId: "brand" }, { slot: "textStyle", state: "detached", tokenId: "title" }] },
    usage: (slot, id) => slot === "stroke" && id === "brand" ? 3 : 0, fontChoices: FONT_FAMILY_CHOICES,
    resolveColor: () => "#2468a0", onEnableModes() { modesEnabled = true; }, onAddMode() {}, onRenameMode() {}, onRemoveMode() {}, onSetMode() {}, onFollowTheme() {},
    onAddColor() {}, onUpdateColor() {}, onRemoveColor: id => removedStyles.push(id), onAddTextStyle() {}, onUpdateTextStyle() {}, onRemoveTextStyle() {}, onAddStrokeStyle() {}, onUpdateStrokeStyle() {}, onRemoveStrokeStyle() {},
    onApply: (slot, id) => appliedStyles.push(`${slot}:${id}`), onDetach() {}, onClose() {},
  }), panelHost);
  const panelControls = [...panelHost.querySelectorAll<HTMLElement>("button,input,select")];
  check(panelControls.length > 8 && panelControls.every(control => control.getAttribute("aria-label") || control.getAttribute("title") || control.textContent?.trim() || control.closest("label")?.textContent?.trim()), "Style library controls expose accessible names");
  panelHost.querySelector<HTMLButtonElement>('button[aria-label="Use Brand as stroke color"]')?.click();
  panelHost.querySelector<HTMLButtonElement>('button[aria-label="Delete Heavy"]')?.click();
  Array.from(panelHost.querySelectorAll<HTMLButtonElement>("button")).find(button => button.textContent?.includes("Light and Dark"))?.click();
  check(modesEnabled, "Style library offers Light and Dark variable modes");
  check(appliedStyles.includes("stroke:brand") && removedStyles.length === 0 && panelHost.textContent?.includes("3 in use") && panelHost.querySelector('[role="dialog"][aria-label="Style library"]') !== null, "Style library applies named colors and reports how many objects use them");
  disposePanel(); panelHost.remove();

  const outlineHost = document.createElement("div"); document.body.append(outlineHost);
  const outlineElements = [
    { type: "rectangle" as const, id: "r", x: 0, y: 0, w: 80, h: 40, color: "#000000", thickness: 2, label: { text: "Gateway", color: "#000000", fontSize: 14, verticalAlign: "middle" as const } },
    { type: "image" as const, id: "i", x: 0, y: 100, w: 60, h: 60, dataUrl: "data:image/png;base64,AAAA" },
  ];
  const picked: string[] = [];
  const disposeOutline = render(() => createComponent(DocumentOutlineDialog, { pageName: "Page 1", entries: buildDocumentOutline(outlineElements), selectedRoots: new Set<number>(), onSelect: entry => picked.push(entry.indices.join(".")), onClose() {} }), outlineHost);
  const outlineButtons = [...outlineHost.querySelectorAll<HTMLButtonElement>(".document-outline-list button")];
  outlineButtons[0]?.focus(); outlineButtons[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  const movedFocus = document.activeElement === outlineButtons[1];
  outlineButtons[1]?.click();
  check(outlineButtons.length === 2 && outlineButtons[0].textContent?.includes("Gateway") && outlineButtons[1].textContent?.includes("no alt text") && movedFocus && picked[0] === "1" && outlineHost.querySelector('[role="dialog"][aria-modal="true"]') !== null, "Document outline lists objects in reading order, flags images without alt text, and supports arrow-key navigation");
  disposeOutline(); outlineHost.remove();

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
