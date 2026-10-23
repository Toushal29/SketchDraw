import { batch, createEffect, createMemo, createSignal, For, lazy, onCleanup, onMount, Show, Suspense } from "solid-js";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, readTextFile, watch, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { getVersion } from "@tauri-apps/api/app";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Update } from "@tauri-apps/plugin-updater";
import "./App.css";
import "/src/styles/app/web-preview.css";
import type { PdfRasterPage } from "./features/export/pdf-renderer";
import sketchDrawMark from "../icons/sketchdraw-mark.svg";

import { SKETCH_FORMAT_VERSION } from "./model";
import type { Point, StrokePoint, FreehandElement, ArrowHead, FlowchartShape, ArrowRoute, LineRoute, StrokeStyle, ShapeElement, TextElement, ImageElement, SchemaTableElement, SchemaField, Element, GroupElement, Tool, ToolbarItem, CanvasState, SketchPage, SketchFile, Preview, Bounds, TextDraft, Theme, ThemeMode, Binding, ShapeLabel, EdgeStyle, FontFamily, RelationshipType, RelationshipDirection, ConnectionPoint, CanvasLayer, ContainerMetadata, ComponentMaster, ComponentOverrides, LibraryChartKind, LibraryChartData, PageLinkTransition } from "./model";
import { ensureIds, resolveBindings, copyElements, flatten, isConnector, isLabelShape, isConnectable, anchorPoint, nearestBinding, validReferences, labelBox, alignedTextStartX, reattachDanglingConnectors } from "./operations";
import type { NoteKind } from "./model";
import { buildLibraryComponent, buildLibraryRelationship, buildNoteGroup, checklistIndexAt, normalizeNoteContent, noteCollapseHit, drawNoteCard, defaultNoteTitle, EXTRA_FLOWCHART_SHAPES, LIBRARY_COMPONENTS, defaultLibraryChartData, defaultLibraryFormOptions, defaultLibraryFormTitle, toggleChecklistContent, type LibraryComponentKind } from "./notes";
import { parseSchema } from "./schema";
import { schemaReferences } from "./features/diagrams/schema-visualizer";
import { importDrawioWithReport, importExcalidraw, exportDrawio, exportExcalidraw } from "./features/diagrams/interchange";
import { cloudProviderComponent, loadCloudProviderGlyph } from "./features/diagrams/cloud-providers";
import { TemplateGallery } from "./components/TemplateGallery";
import type { DiagramLayoutAlgorithm } from "./features/diagrams/auto-layout";
import { buildDiagramTemplate, type DiagramTemplateId } from "./features/diagrams/templates";
import { csvToDiagram, parseCsv } from "./features/diagrams/csv-diagram";
import { chartDataFromCsv, chartDataToCsv } from "./features/components/chart-import";
import { azureArmToDiagram, bicepToDiagram, cloudFormationToDiagram, jsonToDiagram, openApiToDiagram, structuredYamlToDiagram, terraformToDiagram } from "./features/diagrams/structured-data";
import { readCustomStencils, writeCustomStencils, readStencilFavorites, writeStencilFavorites, readRecentStencils, rememberRecentStencil, exportPortableStencilLibrary, parsePortableStencilLibrary, stencilPreviewText, substituteStencilParameters, updateStencilParameter, type CustomStencil } from "./features/components/custom-stencils";
import { applyInstanceOverrides, componentPrimaryLabel, createComponentMaster, instantiateComponentMaster, normalizeMasterVariant, refreshComponentInstances, setComponentMasterLabel } from "./features/components/component-masters";
import { DIAGRAM_LINT_PROFILES, issuesForProfile, validateDiagram, type DiagramIssue, type DiagramLintProfile } from "./features/diagrams/validation";
import { parseBpmnContext, simulateBpmn, type BpmnSimulationStep } from "./features/diagrams/bpmn-analysis";
import { relationshipDirectionHeads, relationshipDisplayElement } from "./features/diagrams/relationships";
import { dotToDiagram } from "./features/diagrams/dot";
import { d2ToDiagram } from "./features/diagrams/d2";
import { svgPrimitivesToElements } from "./features/diagrams/svg-vectors";
import { exportDiagramCode, plantUmlToDiagram, type DiagramCodeFormat } from "./features/diagrams/code-formats";
import { makeWebPreviewCard, webEmbedUrl } from "./features/canvas/web-preview";
import { assignLibraryComponentIds, libraryComponentFields, libraryComponentMinimum, libraryLifelineLength, rebuildLibraryFormOptions, resizeLibraryFont, resizeLibraryGroup, restoreDirectLibraryComponent, setLibraryCheckboxOption, setLibraryFormState, setLibraryLifelineLength, setLibraryRadioOption } from "./features/components/library-component-editor";
import { guiOptionIndexAtPoint } from "./features/components/gui-components";
import { layoutMermaidFlowchart, layoutMermaidSequence, parseMermaidFlowchart, parseMermaidSequence } from "./mermaid";
import { GestureSettings, TOUCH_GESTURE_ACTIONS, TOUCH_TAP_ACTIONS, readTouchGestureAction, readTouchTapAction, type OneFingerDragAction, type TouchGestureAction, type TouchTapAction } from "./platform/mobile/GestureSettings";
import { MobileWorkspaceHeader } from "./platform/mobile/MobileWorkspaceHeader";
import { TouchPageMenu } from "./platform/mobile/TouchPageMenu";
import { TouchFocusTools } from "./platform/mobile/TouchFocusTools";
import { TouchToolBar } from "./platform/mobile/TouchToolBar";
import { TouchQuickStyleControls } from "./platform/mobile/TouchQuickStyleControls";
import { TouchStylePanel } from "./platform/mobile/TouchStylePanel";
import { MobileHomeScreen } from "./platform/mobile/MobileHomeScreen";
import { DesktopPageTabs } from "./platform/windows/DesktopPageTabs";
import { WindowsShapePalette, type WindowsShapeChoice } from "./platform/windows/WindowsShapePalette";
import { WindowsMenuRail } from "./platform/windows/WindowsMenuRail";
import { CanvasOptionsMenu } from "./components/CanvasOptionsMenu";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { AppSettingsMenu } from "./components/AppSettingsMenu";
import { ToolbarOrderEditor, type ToolbarZone } from "./components/ToolbarOrderEditor";
import { DialogInfoTip } from "./components/DialogInfoTip";
import { ViewSettingsPopover } from "./components/ViewSettingsPopover";
import { AdvancedPropertiesIcon, QuickPropertiesIcon } from "./components/PropertyPanelIcons";
import { LibraryComponentIcon } from "./components/LibraryComponentIcon";
import { DesignShapePalette, type DesignPaletteItem } from "./features/workspace/DesignShapePalette";
import { FLOWCHART_MENU_SHAPES, FLOWCHART_SHAPES } from "./features/diagrams/config";
import { pointInPolygon } from "./features/canvas/geometry";
import { shapeDetailPathObject, shapeFillRule, shapePathObject } from "./features/shapes/geometry";
import { arrowHeadPoints, connectorControlPoints, defaultCurveControlPoints, forkGeometry, jaggedVertices, connectorPolylines, doubleConnectorPolylines, arrowHeadEntries, traceConnector } from "./features/connectors/geometry";
import { unionBounds, elementBounds, elementGridBounds, visibleElementBounds, distanceToSegment, lockAspectResizeBounds } from "./features/canvas/bounds";
import { ElementSpatialIndex } from "./features/canvas/spatial-index";
import { getToolLayers, reorderToolLayers, toggleToolLayer, type ToolLayerKind } from "./features/canvas/tool-layers";
import { changeCanvasLayerNesting, deleteCanvasLayers, ensureCanvasLayerPath, fitAutoResizeContainers, fitContainerToContent, layerHidden, layerLocked, moveCanvasLayer, moveElementsIntoContainer, orderCanvasLayers, removeContainer, resizeContainerWithChildren, selectConnectedIndices, selectSimilarIndices } from "./features/canvas/structure";
import { createCanvasHistory } from "./features/canvas/history";
import { canvasStateForTouchGesture, gridStepForStyle, gridSvgPattern, isometricRowHeight, isometricRowOffset, pointerToWorld, snapCanvasPoint, strokePointFromPointer as makeStrokePoint, zoomCanvasStateAt } from "./features/canvas/input";
import { canGroupSelection, deletableSelectionCount as countDeletableSelection, focusedSelectionElement, isGroupSelection, primarySelectionIndex, selectedElements as getSelectedElements } from "./features/canvas/selection";
import { createCanvasRenderScheduler, drawShapeLabel, fontCss, shapeLabelSvg, themeInk } from "./features/canvas/rendering";
import { createCanvasSceneRenderer, transformHandlePoints } from "./features/canvas/scene-renderer";
import { drawLibraryChart } from "./features/components/chart-engine";
import { fitComponentSpecimen } from "./features/components/component-specimen-sheet";
import { cacheComponentIconImage, drawModelComponent } from "./features/components/model-component-renderer";
import { createFreehandRenderer } from "./features/canvas/freehand-rendering";
import { CanvasInteractionOverlay } from "./features/canvas/CanvasInteractionOverlay";
import { parseEditablePath, updateEditablePath } from "./features/canvas/path-editing";
import { replaceElementText } from "./features/canvas/text-replace";
import { ObjectSearchDialog, type ObjectSearchResult } from "./features/canvas/ObjectSearchDialog";
import { recognizeStroke } from "./features/canvas/stroke-recognition";
import { createStrokeSampleGate } from "./features/canvas/stroke-input";
import { appendSimplifiedStrokePoint } from "./features/canvas/stroke-simplification";
import { MAX_STROKE_POINTS } from "./features/canvas/stroke-limits";
import { isLibraryChartData, isRecord, normalizeElement, parseSketchFile } from "./features/files/parse-sketch";
import { compareNamedDocumentSnapshot, parsePortableNamedSnapshots, readNamedDocumentSnapshots, serializePortableNamedSnapshots, writeNamedDocumentSnapshots, type NamedDocumentSnapshot } from "./features/document/named-snapshots";
import { withSketchExtension, normalizeFileUri, isSketchPath, displayPathName, filePathIdentity } from "./features/files/paths";
import { indentTextarea } from "./components/textarea-indent";
import { ThicknessTuner } from "./components/ThicknessTuner";
import { isWindowsPlatform } from "./platform/runtime";
import type { PaletteCommand } from "./platform/windows/CommandPalette";
import { createWindowsSyncMetadata } from "./platform/windows/sync";
import { DEFAULT_WINDOWS_SHORTCUTS, WINDOWS_SHORTCUTS, displayShortcut, formatShortcutBindings, loadWindowsShortcuts, matchesWindowsMouseShortcut, matchesWindowsShortcut, normalizeShortcut, shortcutFromMouseEvent, type WindowsShortcutId, type WindowsShortcutMap, type WindowsShortcutSlot } from "./platform/windows/shortcuts";
import { autoRouteConnectorSet, autoRoutePoints, createAutoRouteContext, type AutoRouteContext } from "./features/diagrams/connector-routing";
import { createPlanningSession } from "./features/project/planning-session";
import { fitSchemaTableText, schemaTableColors, schemaTableContentInset, schemaTableMetrics, schemaTableMinimumHeight, schemaTableMinimumWidth, schemaTableResizeMinimumWidth, schemaTableRowLayout } from "./features/diagrams/schema-table-layout";
import { clearRetiredLibraryData, createLegacyLibraryData, createRetiredLibraryArchive, hasRetiredLibraryData } from "./features/files/legacy-library-data";
import { WorkspaceAreaTabs } from "./features/workspace/WorkspaceAreaTabs";
import type { WorkspaceArea } from "./features/workspace/workspace-types";
import { createDocumentSession } from "./features/document/document-session";
import { createDocumentSnapshotCoordinator } from "./features/document/document-snapshot";
import { createDocumentController } from "./features/document/document-controller";
import type { DocumentControllerStatus } from "./features/document/document-types";
import { serializeSketchSnapshot } from "./features/files/document-codec";
import { sketchFileStore } from "./features/files/sketch-file-store";
import { sketchRecoveryStore } from "./features/files/sketch-recovery-store";

type AndroidStylusSample = { clientX: number; clientY: number; pressure: number; tiltX: number; tiltY: number; orientation: number; time: number; phase: "start" | "move" | "end" };

declare global {
  interface Window {
    __sketchDrawReceiveAndroidStylusSamples?: (samples: AndroidStylusSample[]) => void;
  }
}

type TouchGesture = { fingerCount: 2 | 3; action: TouchGestureAction; initialDistance: number; initialZoom: number; initialPanX: number; initialPanY: number; initialMidpoint: Point; worldAnchor: Point };
type TouchTapTracker = { startedAt: number; starts: Map<number, Point>; maxFingers: number; canceled: boolean; initialEvent: PointerEvent; deferredInteractionStarted?: boolean };
type WhiteboardStyle = "plain" | "dots" | "lines" | "small-dots" | "ruled" | "small-grid" | "isometric";
type DisplayMetrics = { physicalWidth: number; physicalHeight: number; viewportWidth: number; viewportHeight: number };
const DEFAULT_TOOL_ORDER: ToolbarItem[] = ["select", "pan", "pen", "laser", "line", "arrow", "rectangle", "circle", "diamond", "triangle", "flowchart", "text", "bucket", "eraser", "crop", "measure", "codeData", "pathEdit", "frame", "moreTools"];
const DEFAULT_MORE_TOOL_ORDER: ToolbarItem[] = ["bucket", "measure", "crop"];
const MOBILE_DEFAULT_TOOLBAR_ORDER: ToolbarItem[] = ["select", "pan", "pen", "line", "arrow", "rectangle", "text", "eraser", "moreTools"];
type ToolbarLayout = { toolbar: ToolbarItem[]; more: ToolbarItem[] };
type OrderedToolbarEntry = { kind: "cluster"; id: string; label: string; tools: ToolbarItem[] } | { kind: "more-tools" };
function toolbarItemsForCurrentPlatform(): ToolbarItem[] {
  return [...DEFAULT_TOOL_ORDER];
}
function defaultToolbarLayout(): ToolbarLayout {
  const available = toolbarItemsForCurrentPlatform();
  if (!isWindowsPlatform()) {
    const toolbar = MOBILE_DEFAULT_TOOLBAR_ORDER.filter(value => available.includes(value));
    const more = [
      ...DEFAULT_MORE_TOOL_ORDER.filter(value => available.includes(value)),
      ...available.filter(value => !toolbar.includes(value) && !DEFAULT_MORE_TOOL_ORDER.includes(value)),
    ];
    return { toolbar, more };
  }
  const more = DEFAULT_MORE_TOOL_ORDER.filter(value => available.includes(value));
  return { toolbar: available.filter(value => !more.includes(value)), more };
}
function readToolbarLayout(): ToolbarLayout {
  try {
    const available = toolbarItemsForCurrentPlatform();
    const defaults = defaultToolbarLayout();
    const saved: unknown = JSON.parse(localStorage.getItem("sketchdraw-toolbar-layout") ?? "null");
    const normalize = (values: unknown) => Array.isArray(values) ? [...new Set(values.filter((value): value is ToolbarItem => available.includes(value as ToolbarItem)))] : [];
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      const source = saved as { toolbar?: unknown; more?: unknown };
      const toolbar = normalize(source.toolbar);
      const more = normalize(source.more).filter(value => value !== "moreTools" && !toolbar.includes(value));
      for (const value of [...defaults.toolbar, ...defaults.more]) if (!toolbar.includes(value) && !more.includes(value)) (defaults.more.includes(value) ? more : toolbar).push(value);
      return { toolbar, more };
    }
    const legacy = JSON.parse(localStorage.getItem("sketchdraw-toolbar-order") ?? "null") as unknown;
    if (Array.isArray(legacy)) {
      const oldToolbar = normalize(legacy).filter(value => !DEFAULT_MORE_TOOL_ORDER.includes(value));
      const more = defaults.more.filter(value => !oldToolbar.includes(value));
      return { toolbar: [...oldToolbar, ...defaults.toolbar.filter(value => !oldToolbar.includes(value))], more };
    }
    return defaults;
  } catch { return defaultToolbarLayout(); }
}
type MarkdownTableBlock = { start: number; end: number; text: string };
function findMarkdownTableBlock(content: string): MarkdownTableBlock | undefined {
  const lines = content.split(/\r?\n/);
  const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map(value => value.trim());
  let fence: { marker: "`" | "~"; length: number } | undefined;
  for (let start = 0; start < lines.length - 1; start++) {
    const fenceLine = /^\s*(`{3,}|~{3,})/.exec(lines[start]);
    if (fenceLine) {
      const marker = fenceLine[1][0] as "`" | "~";
      if (!fence) fence = { marker, length: fenceLine[1].length };
      else if (marker === fence.marker && fenceLine[1].length >= fence.length) fence = undefined;
      continue;
    }
    if (fence) continue;
    const header = lines[start]; const divider = lines[start + 1];
    if (!header.includes("|") || !divider.includes("|")) continue;
    const headerCells = cells(header); const dividerCells = cells(divider);
    if (headerCells.length < 2 || dividerCells.length !== headerCells.length || !dividerCells.every(value => /^:?-{3,}:?$/.test(value))) continue;
    let end = start + 2;
    while (end < lines.length && lines[end].includes("|") && cells(lines[end]).length === headerCells.length) end++;
    return { start, end, text: lines.slice(start, end).join("\n") };
  }
  return undefined;
}
function replaceMarkdownTableBlock(content: string, block: MarkdownTableBlock, replacement: string): string {
  const lines = content.split(/\r?\n/); lines.splice(block.start, block.end - block.start, ...replacement.split(/\r?\n/)); return lines.join("\n");
}
const readDisplayMetrics = (): DisplayMetrics => {
  const ratio = window.devicePixelRatio || 1;
  return { physicalWidth: Math.round(window.screen.width * ratio), physicalHeight: Math.round(window.screen.height * ratio), viewportWidth: window.innerWidth, viewportHeight: window.innerHeight };
};

function rotateCanvasPoint(point: Point, center: Point, degrees: number): Point {
  if (!degrees) return point;
  const angle = degrees * Math.PI / 180; const dx = point.x - center.x; const dy = point.y - center.y;
  return { x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle) };
}

const RELEASES_API = "https://api.github.com/repos/Toushal29/SketchDraw/releases/latest";
const LibraryComponentEditor = lazy(() => import("./components/LibraryComponentEditor").then(module => ({ default: module.LibraryComponentEditor })));
const HelpDialog = lazy(() => import("./components/HelpDialog").then(module => ({ default: module.HelpDialog })));
const MobileCommandBar = lazy(() => import("./platform/mobile/MobileCommandBar").then(module => ({ default: module.MobileCommandBar })));

function compareReleaseVersions(left: string, right: string): number {
  const parse = (version: string) => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());
    return match ? match.slice(1, 4).map(Number) : undefined;
  };
  const a = parse(left); const b = parse(right);
  if (!a || !b) throw new Error("GitHub returned a release tag that is not a three-part version.");
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  return 0;
}

function androidReleaseApk(release: Record<string, unknown>): { version: string; url: string } | undefined {
  if (!Array.isArray(release.assets)) return undefined;
  for (const candidate of release.assets) {
    if (!isRecord(candidate) || typeof candidate.name !== "string" || typeof candidate.browser_download_url !== "string") continue;
    const match = /^SketchDraw-Android-v(\d+\.\d+\.\d+)-arm64\.apk$/i.exec(candidate.name);
    if (match && candidate.browser_download_url.startsWith("https://github.com/Toushal29/SketchDraw/releases/download/")) {
      return { version: match[1], url: candidate.browser_download_url };
    }
  }
  return undefined;
}

const GRID_SIZE = 25;
const TOUCH_DRAG_THRESHOLD = 8;
const DEFAULT_UI_ACCENT = "#4f46e5";
const BOARD_COLORS = ["#ffffff", "#fffdf7", "#f4f7fb", "#fbf2ed", "#f1f5ed", "#f3f0fa"];
const UI_ACCENTS = [
  { label: "Indigo", value: DEFAULT_UI_ACCENT }, { label: "Ocean", value: "#3f78a5" }, { label: "Sage", value: "#547a5b" },
  { label: "Teal", value: "#39877f" }, { label: "Amber", value: "#b47b35" }, { label: "Rose", value: "#ad6475" },
];
const TOOLBAR_COLORS = [
  { label: "Paper", value: "#f8faf7" }, { label: "Warm", value: "#f4efe4" },
  { label: "Slate", value: "#e8edf2" }, { label: "Sage", value: "#e8efe9" },
  { label: "Night", value: "#171717" },
];
const BOARD_COLOR_NAMES: Record<string, string> = { "#ffffff": "White", "#fffdf7": "Ivory", "#f4f7fb": "Mist", "#fbf2ed": "Blush", "#f1f5ed": "Sage", "#f3f0fa": "Lilac" };
const readPreference = (key: string, fallback: string) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const readWhiteboardStyle = (): WhiteboardStyle => {
  const stored = readPreference("sketchdraw-whiteboard-style", "dots");
  return stored === "plain" || stored === "lines" || stored === "dots" || stored === "small-dots" || stored === "ruled" || stored === "small-grid" || stored === "isometric" ? stored : "dots";
};
const THICKNESS_PRESETS = [[1, "Ultra-thin"], [2, "Thin"], [4, "Default"], [5, "Medium"], [10, "Bold"]] as const;
const ORIGINAL_INSPECTOR_THICKNESS_PRESETS = [[1, "Ultra-thin"], [2, "Thin"], [5, "Medium"], [10, "Bold"]] as const;
const ERASER_SIZE_PRESETS = [[2, "2px"], [10, "10px"], [24, "24px"]] as const;
const ARROW_ROUTES: { value: ArrowRoute; label: string; path: string }[] = [
  { value: "straight", label: "Straight", path: "M3 12h17m-6-6 6 6-6 6" }, { value: "elbow", label: "Elbow", path: "M4 5v14h15m-6-6 6 6-6 6" },
  { value: "curve", label: "Curve", path: "M3 18Q12 2 21 18" },
  { value: "forked", label: "Forked", path: "M3 12h8m0 0V5h9m-4-3 4 3-4 3m-5 4v7h9m-4-3 4 3-4 3" },
];
const LINE_ROUTES: { value: LineRoute; label: string; path: string }[] = [
  { value: "straight", label: "Straight", path: "M4 19 20 5" }, { value: "elbow", label: "Elbow", path: "M4 5v14h15" }, { value: "curve", label: "Curve", path: "M3 18Q12 2 21 18" },
];
const ARROW_HEADS: { value: ArrowHead; label: string }[] = [
  { value: "none", label: "None" }, { value: "open", label: "Open" }, { value: "solid", label: "Solid" }, { value: "hollow", label: "Hollow triangle" },
  { value: "thick", label: "Thick" }, { value: "dot", label: "Dot" }, { value: "diamond", label: "Diamond" }, { value: "open-diamond", label: "Open diamond" }, { value: "bar", label: "Bar" }, { value: "crow", label: "Crow's foot" },
];
const RELATIONSHIP_TYPES: { value: RelationshipType; label: string }[] = [
  { value: "association", label: "Association" }, { value: "dependency", label: "Dependency" }, { value: "data-flow", label: "Data flow" },
  { value: "inheritance", label: "Inheritance" }, { value: "aggregation", label: "Aggregation" }, { value: "composition", label: "Composition" },
  { value: "sequence", label: "Sequence" }, { value: "network", label: "Network" }, { value: "other", label: "Other" },
];
function ArrowHeadIcon(props: { kind: ArrowHead }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h12" />{props.kind === "open" && <path d="m12 7 5 5-5 5" />}{props.kind === "solid" && <path d="m12 7 6 5-6 5z" fill="currentColor" />}{props.kind === "hollow" && <path d="M17 12 10 6v12z" />}{props.kind === "thick" && <path d="m10 5 9 7-9 7z" fill="currentColor" />}{props.kind === "dot" && <circle cx="17" cy="12" r="3" fill="currentColor" />}{props.kind === "diamond" && <path d="m17 7 5 5-5 5-5-5z" fill="currentColor" />}{props.kind === "open-diamond" && <path d="M17 12 11 6 5 12l6 6z" />}{props.kind === "bar" && <path d="M17 6v12" />}{props.kind === "crow" && <path d="m17 6-5 6 5 6m0-12-5 6" />}</svg>;
}
const emptyCanvas = (): CanvasState => ({ zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff", boardColorFollowsTheme: true });
const cloneElements = (items: Element[]): Element[] => JSON.parse(JSON.stringify(items)) as Element[];
const sameCanvasPoints = (left: Point[] | undefined, right: Point[]) => !!left && left.length === right.length && left.every((point, index) => point.x === right[index].x && point.y === right[index].y);
const WINDOWS_SHAPE_TYPES = ["rectangle", "circle", "diamond", "triangle", "flowchart", "line", "arrow"] as const;
const isShapeLike = (element: Element) => (WINDOWS_SHAPE_TYPES as readonly string[]).includes(element.type);
const isShapeLikeType = (type: Element["type"]) => (WINDOWS_SHAPE_TYPES as readonly string[]).includes(type);
const MermaidPreview = lazy(async () => {
  const module = await import("./MermaidPreview");
  return { default: module.MermaidPreview };
});
const WindowsCommandPalette = lazy(async () => { const module = await import("./platform/windows/CommandPalette"); return { default: module.CommandPalette }; });
const WindowsDocumentTabs = lazy(async () => { const module = await import("./platform/windows/DocumentTabs"); return { default: module.DocumentTabs }; });
const WindowsKeyboardShortcutsDialog = lazy(async () => { const module = await import("./platform/windows/KeyboardShortcutsDialog"); return { default: module.KeyboardShortcutsDialog }; });
const CanvasMinimap = lazy(async () => { const module = await import("./components/CanvasMinimap"); return { default: module.CanvasMinimap }; });
const WindowsFocusTools = lazy(async () => { const module = await import("./platform/windows/WindowsFocusTools"); return { default: module.WindowsFocusTools }; });
const ProjectWorkspace = lazy(async () => { const module = await import("./features/project/ProjectWorkspace"); return { default: module.ProjectWorkspace }; });

function App() {
  const isAndroidPlatform = () => isTauri() && typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
  async function chooseSketchDocument() {
    if (isAndroidPlatform()) return invoke<string | null>("pick_sketch_document");
    const selected = await open({ title: "Open SketchDraw file", multiple: false, pickerMode: "document", filters: [{ name: "SketchDraw", extensions: ["sketch"] }] });
    return typeof selected === "string" ? selected : null;
  }
  async function createSketchDocument(fileName: string) {
    if (isAndroidPlatform()) return invoke<string | null>("create_sketch_document", { fileName });
    return save({ title: "Create SketchDraw file", defaultPath: fileName, filters: [{ name: "SketchDraw", extensions: ["sketch"] }] });
  }
  async function choosePlanningDocument() {
    if (isAndroidPlatform()) return invoke<string | null>("pick_planning_document");
    const selected = await open({ title: "Open Planning file", multiple: false, pickerMode: "document", filters: [{ name: "SketchDraw Planning", extensions: ["sdplan"] }] });
    return typeof selected === "string" ? selected : null;
  }
  async function choosePlanningDocuments() {
    if (isAndroidPlatform()) {
      const selected = await invoke<string | null>("pick_planning_document");
      return selected ? [selected] : [];
    }
    const selected = await open({ title: "Add Planning files to overview", multiple: true, pickerMode: "document", filters: [{ name: "SketchDraw Planning", extensions: ["sdplan"] }] });
    return Array.isArray(selected) ? selected : typeof selected === "string" ? [selected] : [];
  }
  async function createPlanningDocument(fileName: string) {
    if (isAndroidPlatform()) return invoke<string | null>("create_planning_document", { fileName });
    return save({ title: "Create Planning file", defaultPath: fileName, filters: [{ name: "SketchDraw Planning", extensions: ["sdplan"] }] });
  }
  async function exportPlanningText(fileName: string, extension: "html" | "csv" | "ics", contents: string): Promise<boolean> {
    try {
      const filters = [{ name: extension === "ics" ? "Calendar" : extension === "csv" ? "Comma-separated values" : "HTML report", extensions: [extension] }];
      if (isAndroidPlatform()) {
        const uri = await invoke<string | null>("create_planning_export", { fileName });
        if (!uri) return false;
        await invoke("write_sketch_document", { uri, contents });
        return true;
      }
      const target = await save({ title: `Export Planning ${extension.toUpperCase()}`, defaultPath: fileName, filters });
      if (!target) return false;
      await writeTextFile(target, contents);
      return true;
    } catch (cause) {
      setError(`Could not export Planning file: ${String(cause)}`);
      return false;
    }
  }
  async function exportTextDocument(fileName: string, extension: DiagramCodeFormat, contents: string): Promise<boolean> {
    try {
      if (isAndroidPlatform()) {
        const uri = await invoke<string | null>("create_text_export", { fileName });
        if (!uri) return false;
        await invoke("write_sketch_document", { uri, contents });
        return true;
      }
      const labels: Record<DiagramCodeFormat, string> = { mmd: "Mermaid flowchart", dot: "Graphviz DOT", d2: "D2 diagram", csv: "Diagram CSV", sql: "SQL schema", json: "JSON Schema", puml: "PlantUML" };
      const selected = await save({ title: `Export ${labels[extension]}`, defaultPath: fileName, filters: [{ name: labels[extension], extensions: [extension] }] });
      if (!selected) return false;
      const target = selected.toLowerCase().endsWith(`.${extension}`) ? selected : `${selected}.${extension}`;
      await writeTextFile(target, contents);
      return true;
    } catch (cause) {
      setError(`Could not export diagram code: ${String(cause)}`);
      return false;
    }
  }
  const [documentRevision, setDocumentRevision] = createSignal(0);
  const advanceDocumentRevision = () => setDocumentRevision(revision => revision + 1);
  const [elements, setElementsSignal] = createSignal<Element[]>([]);
  const activeElementSpatialIndex = new ElementSpatialIndex();
  function withWindowsRouteSnapshots(items: Element[]): Element[] {
    const routeContext = createAutoRouteContext(items, isElementHidden);
    const refresh = (item: Element): Element => {
      if (item.type === "group") {
        const elements = item.elements.map(refresh);
        return elements.every((child, index) => child === item.elements[index]) ? item : { ...item, elements };
      }
      if (!isConnector(item) || !item.autoRoute) return item;
      const routePoints = autoRoutePoints(item, routeContext);
      return sameCanvasPoints(item.routePoints, routePoints) ? item : { ...item, routePoints };
    };
    return items.map(refresh);
  }
  function setElements(next: Element[] | ((previous: Element[]) => Element[])) {
    advanceDocumentRevision();
    return setElementsSignal(previous => {
      const updated = withWindowsRouteSnapshots(fitAutoResizeContainers(resolveBindings(ensureIds(typeof next === "function" ? next(previous) : next))));
      activeElementSpatialIndex.update(updated);
      return updated;
    });
  }
  // Pointer drags run once per display frame. Keep their immutable preview
  // updates cheap, while the incremental index refreshes changed objects only.
  function setElementsTransient(next: Element[] | ((previous: Element[]) => Element[]), changedIndices?: readonly number[]) {
    advanceDocumentRevision();
    return setElementsSignal(previous => {
      const updated = fitAutoResizeContainers(typeof next === "function" ? next(previous) : next);
      if (changedIndices) activeElementSpatialIndex.updateChanged(updated, changedIndices);
      else activeElementSpatialIndex.update(updated);
      return updated;
    });
  }
  const [canvasState, setCanvasStateSignal] = createSignal<CanvasState>(emptyCanvas());
  const setCanvasState: typeof setCanvasStateSignal = next => { advanceDocumentRevision(); return setCanvasStateSignal(next); };
  const documentSession = createDocumentSession();
  const {
    pages, setPages: setPagesSignal,
    activePageId, setActivePageId: setActivePageIdSignal,
    activePath, setActivePath,
    legacyLibraryData, setLegacyLibraryData: setLegacyLibraryDataSignal,
    workspaceArea, setWorkspaceArea,
    readOnlyView, setReadOnlyView,
    dirty, setDirty: setDirtySignal,
    saving, setSaving,
    savedAt, setSavedAt,
    windowsSyncMetadata, setWindowsSyncMetadata,
  } = documentSession;
  const setPages: typeof setPagesSignal = next => { advanceDocumentRevision(); return setPagesSignal(next); };
  const setActivePageId: typeof setActivePageIdSignal = next => { advanceDocumentRevision(); return setActivePageIdSignal(next); };
  const setLegacyLibraryData: typeof setLegacyLibraryDataSignal = next => { advanceDocumentRevision(); return setLegacyLibraryDataSignal(next); };
  const setDirty = (value: boolean) => {
    if (value) advanceDocumentRevision();
    setDirtySignal(value);
  };
  const toolLayers = createMemo(() => getToolLayers(elements(), pages().find(page => page.id === activePageId())?.layers ?? []));
  const [renameFileOpen, setRenameFileOpen] = createSignal(false);
  const [renameFileName, setRenameFileName] = createSignal("");
  const [renameFileError, setRenameFileError] = createSignal("");
  const [topbarHeight, setTopbarHeight] = createSignal(66);
  const isCanvasWorkspace = () => workspaceArea() === "canvas" || workspaceArea() === "design";
  const showWelcomeScreen = () => isCanvasWorkspace() ? !activePath() : !planningPath();
  const [tool, setTool] = createSignal<Tool>("pen");
  const [color, setColor] = createSignal("#252525");
  const [thickness, setThickness] = createSignal(2);
  const [eraserSize, setEraserSize] = createSignal(2);
  const [thicknessPickerMode, setThicknessPickerMode] = createSignal<"presets" | "stepper">(readPreference("sketchdraw-thickness-picker", "presets") === "stepper" ? "stepper" : "presets");
  const [penPressure, setPenPressure] = createSignal(true);
  const [penTilt, setPenTilt] = createSignal(true);
  const [penEraser, setPenEraser] = createSignal(true);
  const [laserColor, setLaserColor] = createSignal((() => { const value = readPreference("sketchdraw-laser-color", "#ff3265"); return /^#[\da-f]{6}$/i.test(value) ? value : "#ff3265"; })());
  const [laserThickness, setLaserThickness] = createSignal(Math.max(1, Math.min(24, Number(readPreference("sketchdraw-laser-thickness", "5")) || 5)));
  const [laserFadeDuration, setLaserFadeDuration] = createSignal(Math.max(250, Math.min(5000, Number(readPreference("sketchdraw-laser-fade", "1100")) || 1100)));
  const [laserRainbow, setLaserRainbow] = createSignal(readPreference("sketchdraw-laser-rainbow", "false") === "true");
  const [error, setError] = createSignal("");
  const [preview, setPreview] = createSignal<Preview>();
  const [selectedIndices, setSelectedIndices] = createSignal<number[]>([]);
  const [copiedObjectStyle, setCopiedObjectStyle] = createSignal<{ type: Element["type"]; style: Record<string, unknown> }>();
  const [hoveredIndex, setHoveredIndex] = createSignal<number>();
  const [noteToggleHovered, setNoteToggleHovered] = createSignal(false);
  const [showGrid, setShowGrid] = createSignal(true);
  const [showMinimap, setShowMinimap] = createSignal(readPreference("sketchdraw-canvas-minimap", readPreference("sketchdraw-windows-minimap", isWindowsPlatform() ? "true" : "false")) !== "false");
  const [commandPaletteOpen, setCommandPaletteOpen] = createSignal(false);
  const [templateGalleryOpen, setTemplateGalleryOpen] = createSignal(false);
  const [shortcutDialogOpen, setShortcutDialogOpen] = createSignal(false);
  const [shortcuts, setShortcuts] = createSignal<WindowsShortcutMap>(isWindowsPlatform() ? loadWindowsShortcuts() : { ...DEFAULT_WINDOWS_SHORTCUTS });
  const [presentationMode, setPresentationMode] = createSignal(false);
  const [presentationTarget, setPresentationTarget] = createSignal<"pages" | "frames">("pages");
  const [presentationTransition, setPresentationTransition] = createSignal<PageLinkTransition>();
  let presentationTransitionOutTimer: number | undefined;
  let presentationTransitionClearTimer: number | undefined;
  const [presentationFrameIndex, setPresentationFrameIndex] = createSignal(-1);
  const [openSketchPaths, setOpenSketchPaths] = createSignal<string[]>([]);
  const [whiteboardStyle, setWhiteboardStyle] = createSignal<WhiteboardStyle>(readWhiteboardStyle());
  const [snapToGrid, setSnapToGrid] = createSignal(false);
  const [snapToObjects, setSnapToObjects] = createSignal(true);
  const [measureMode, setMeasureMode] = createSignal(false);
  const [measurement, setMeasurement] = createSignal<{ start: Point; end: Point }>();
  const [pathNodeEditMode, setPathNodeEditMode] = createSignal(false);
  const [selectedPathNodeIndex, setSelectedPathNodeIndex] = createSignal<number>();
  const [fillEnabled, setFillEnabled] = createSignal(false);
  const [fillColor, setFillColor] = createSignal("#6b91c9");
  const [fillOpacity, setFillOpacity] = createSignal(0.2);
  const [lineStyle, setLineStyle] = createSignal<StrokeStyle>("solid");
  type BrushMode = "fine" | "pencil" | "brush" | "marker" | "highlighter" | "chalk";
  const [brushMode, setBrushMode] = createSignal<BrushMode>("fine");
  const [lineRoute, setLineRouteValue] = createSignal<LineRoute>(readPreference("sketchdraw-orthogonal-connectors", "false") === "true" ? "elbow" : "straight");
  const setLineRoute = (value: LineRoute) => { if (orthogonalConnectors() && value !== "elbow") return; setLineRouteValue(value); };
  const [arrowRoute, setArrowRouteValue] = createSignal<ArrowRoute>(readPreference("sketchdraw-orthogonal-connectors", "false") === "true" ? "elbow" : "straight");
  const setArrowRoute = (value: ArrowRoute) => { if (orthogonalConnectors() && value !== "elbow") return; setArrowRouteValue(value); };
  const [orthogonalConnectors, setOrthogonalConnectors] = createSignal(readPreference("sketchdraw-orthogonal-connectors", "false") === "true");
  const [layoutAlgorithm, setLayoutAlgorithm] = createSignal<DiagramLayoutAlgorithm>((() => { const value = readPreference("sketchdraw-layout-algorithm", "layered"); return (["layered", "mrtree", "radial", "force", "stress"] as string[]).includes(value) ? value as DiagramLayoutAlgorithm : "layered"; })());
  const [layoutSelectionOnly, setLayoutSelectionOnly] = createSignal(false);
  const [layoutSpacing, setLayoutSpacing] = createSignal(48);
  const [flowchartShape, setFlowchartShape] = createSignal<FlowchartShape>("process");
  const [edgeStyle, setEdgeStyle] = createSignal<EdgeStyle>("sharp");
  const [cornerRadius, setCornerRadius] = createSignal(14);
  const [defaultStartHead, setDefaultStartHead] = createSignal<ArrowHead>("none");
  const [defaultEndHead, setDefaultEndHead] = createSignal<ArrowHead>("open");
  const [defaultLineStartHead, setDefaultLineStartHead] = createSignal<ArrowHead>("none");
  const [defaultLineEndHead, setDefaultLineEndHead] = createSignal<ArrowHead>("none");
  const [defaultForkUpperHead, setDefaultForkUpperHead] = createSignal<ArrowHead>("open");
  const [defaultForkLowerHead, setDefaultForkLowerHead] = createSignal<ArrowHead>("open");
  const [boardColor, setBoardColor] = createSignal("#ffffff");
  const [boardColorFollowsTheme, setBoardColorFollowsTheme] = createSignal(true);
  const [boardLocked, setBoardLocked] = createSignal(false);
  const [sidebarTab, setSidebarTab] = createSignal<"properties">("properties");
  const [inspectorPropertiesExpanded, setInspectorPropertiesExpanded] = createSignal(true);
  const [layerPanelOpen, setLayerPanelOpen] = createSignal(false);
  const [selectedLayerKeys, setSelectedLayerKeys] = createSignal<ToolLayerKind[]>([]);
  const [classCardDraft, setClassCardDraft] = createSignal<{ x: number; y: number; name: string; attributes: string; methods: string; fontSize: number; width?: number; height?: number; componentId?: string }>();
  const [libraryComponentDraft, setLibraryComponentDraft] = createSignal<GroupElement>();
  const [componentEditorCollapsed, setComponentEditorCollapsedValue] = createSignal(readPreference("sketchdraw-component-editor-collapsed", "true") === "true");
  const setComponentEditorCollapsed = (collapsed: boolean) => {
    setComponentEditorCollapsedValue(collapsed);
    try { localStorage.setItem("sketchdraw-component-editor-collapsed", String(collapsed)); } catch { /* Preference storage can be unavailable in embedded contexts. */ }
  };
  const [styleMenuMode, setStyleMenuMode] = createSignal<"quick" | "full">("quick");
  const [quickStylePopover, setQuickStylePopover] = createSignal<"color" | "thickness" | "fill" | "route" | "lineStyle" | "heads" | "penInput" | "laser" | "brushes">();
  const [autosaveSeconds, setAutosaveSeconds] = createSignal<5 | 10>(readPreference("sketchdraw-autosave-seconds", "10") === "5" ? 5 : 10);
  const [interfaceScale, setInterfaceScale] = createSignal((() => { const value = Number(readPreference("sketchdraw-interface-scale", "1")); return [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4].includes(value) ? value : 1; })());
  const initialToolbarLayout = readToolbarLayout();
  const [toolbarOrder, setToolbarOrder] = createSignal<ToolbarItem[]>(initialToolbarLayout.toolbar);
  const [moreToolsOrder, setMoreToolsOrder] = createSignal<ToolbarItem[]>(initialToolbarLayout.more);
  const [mobileOrientation, setMobileOrientation] = createSignal(readPreference("sketchdraw-mobile-orientation", "landscape") === "portrait" ? "portrait" as const : "landscape" as const);
  const [orientationMessage, setOrientationMessage] = createSignal("");
  const [toolbarPosition, setToolbarPosition] = createSignal<"top" | "bottom" | "left" | "right">((() => {
    const saved = readPreference("sketchdraw-toolbar-position", "");
    if (saved === "top" || saved === "bottom" || saved === "left" || saved === "right") return saved;
    if (saved === "down") return "bottom";
    return mobileOrientation() === "portrait" ? "top" : "left";
  })());
  const [displayMetrics, setDisplayMetrics] = createSignal<DisplayMetrics>(readDisplayMetrics());
  const [toolbarColorChoice, setToolbarColorChoice] = createSignal((() => { const value = readPreference("sketchdraw-toolbar-color", "auto"); if (value.toLowerCase() === "#252c31") return "#171717"; return value === "auto" || /^#[\da-f]{6}$/i.test(value) ? value : "auto"; })());
  const [helpOpen, setHelpOpen] = createSignal(false);
  const [appVersion, setAppVersion] = createSignal("...");
  const [updateCheck, setUpdateCheck] = createSignal<"idle" | "checking" | "current" | "available" | "permission" | "unavailable" | "installing" | "error">("idle");
  const [updateVersion, setUpdateVersion] = createSignal<string>();
  const [updateNoticeVersion, setUpdateNoticeVersion] = createSignal<string>();
  const [androidUpdateUrl, setAndroidUpdateUrl] = createSignal<string>();
  let pendingUpdate: Update | undefined;
  const [helpSection, setHelpSection] = createSignal<"guide" | "shortcuts">("guide");
  const storedDefaultFontSize = Number(readPreference("sketchdraw-default-font-size", "12"));
  const [defaultFontSize, setDefaultFontSize] = createSignal(Number.isFinite(storedDefaultFontSize) && storedDefaultFontSize >= 8 && storedDefaultFontSize <= 160 ? Math.round(storedDefaultFontSize) : 12);
  const rememberFontSize = (requestedSize: number) => {
    if (!Number.isFinite(requestedSize)) return defaultFontSize();
    const size = Math.round(Math.max(8, Math.min(160, requestedSize)));
    setDefaultFontSize(size);
    try { localStorage.setItem("sketchdraw-default-font-size", String(size)); } catch { /* The selected size remains active for this session. */ }
    return size;
  };
  const [defaultFontFamily, setDefaultFontFamily] = createSignal<FontFamily>("sans");
  const [defaultBold, setDefaultBold] = createSignal(false);
  const [defaultItalic, setDefaultItalic] = createSignal(false);
  const [defaultUnderline, setDefaultUnderline] = createSignal(false);
  const [defaultTextAlign, setDefaultTextAlign] = createSignal<"left" | "center" | "right">("left");
  const [defaultListType, setDefaultListType] = createSignal<"none" | "bullet" | "number">("none");
  const [toolBarOpen, setToolBarOpen] = createSignal(true);
  const [touchFocusMode, setTouchFocusMode] = createSignal(false);
  const [windowsFullscreenMode, setWindowsFullscreenMode] = createSignal(false);
  const [mobileQuickPropertiesOpen, setMobileQuickPropertiesOpen] = createSignal(false);
  const [designPanelCollapsed, setDesignPanelCollapsed] = createSignal(false);
  const [touchStylePanel, setTouchStylePanel] = createSignal(false);
  const [gestureMenuSection, setGestureMenuSection] = createSignal<"taps" | "gestures">("taps");
  const [oneFingerTapAction, setOneFingerTapAction] = createSignal<TouchTapAction>(readTouchTapAction("sketchdraw-one-finger-tap", "none"));
  const [twoFingerTapAction, setTwoFingerTapAction] = createSignal<TouchTapAction>(readTouchTapAction("sketchdraw-two-finger-tap", "undo"));
  const [threeFingerTapAction, setThreeFingerTapAction] = createSignal<TouchTapAction>(readTouchTapAction("sketchdraw-three-finger-tap", "redo"));
  const [oneFingerDragAction, setOneFingerDragAction] = createSignal<OneFingerDragAction>(readPreference("sketchdraw-one-finger-drag", "activeTool") === "pan" ? "pan" : "activeTool");
  const [twoFingerGestureAction, setTwoFingerGestureAction] = createSignal<TouchGestureAction>(readTouchGestureAction("sketchdraw-two-finger-gesture", "panZoom"));
  const [threeFingerGestureAction, setThreeFingerGestureAction] = createSignal<TouchGestureAction>(readTouchGestureAction("sketchdraw-three-finger-gesture", "panZoom"));
  const [showClearConfirm, setShowClearConfirm] = createSignal(false);
  const [recoveryPrompt, setRecoveryPrompt] = createSignal<{ path: string; snapshot: SketchFile; baselineRaw?: string }>();
  const [legacyMigrationPath, setLegacyMigrationPath] = createSignal<string>();
  const [syncConflict, setSyncConflict] = createSignal<{ path: string; remote: string }>();
  const [documentControllerStatus, setDocumentControllerStatus] = createSignal<DocumentControllerStatus>("idle");
  const [exportOptionsOpen, setExportOptionsOpen] = createSignal(false);
  const [canvasOptionsOpen, setCanvasOptionsOpen] = createSignal(false);
  const [toolbarOrganizerOpen, setToolbarOrganizerOpen] = createSignal(false);
  const [moreToolsOpen, setMoreToolsOpen] = createSignal(false);
  const [exportFormat, setExportFormat] = createSignal<"png" | "svg" | "pdf">("png");
  const [exportWidth, setExportWidth] = createSignal(1600);
  const [exportHeight, setExportHeight] = createSignal(1000);
  const [exportTransparent, setExportTransparent] = createSignal(false);
  const [textDraft, setTextDraft] = createSignal<TextDraft>();
  const [textMode, setTextMode] = createSignal<"text" | "markdown" | "table" | NoteKind>("text");
  const [noteEditor, setNoteEditor] = createSignal<{ x: number; y: number; width: number; height: number; fontSize: number; kind: NoteKind; content: string; title: string; resized?: boolean; editingIndex?: number }>();
  const [noteEditorSession, setNoteEditorSession] = createSignal(0);
  let noteEditorTextarea: HTMLTextAreaElement | undefined;
  let noteEditorTitleInput: HTMLInputElement | undefined;
  let textEditorElement: HTMLDivElement | undefined;
  let textEditorPendingPointerId: number | undefined;
  let textEditorFocusTimer: number | undefined;
  let textEditorFocusOnCanvasClick = false;
  const [schemaDialog, setSchemaDialog] = createSignal(false);
  const [schemaImporting, setSchemaImporting] = createSignal(false);
  const [schemaInput, setSchemaInput] = createSignal("");
  const [schemaError, setSchemaError] = createSignal("");
  const [schemaEditingDiagram, setSchemaEditingDiagram] = createSignal<string>();
  const [schemaPanelDiagramId, setSchemaPanelDiagramId] = createSignal<string>();
  let schemaPanelTextarea: HTMLTextAreaElement | undefined;
  let activeSchemaPanelDiagramId: string | undefined;
  let lastAppliedSchemaSource: string | undefined;
  let schemaLiveUndoDiagramId: string | undefined;
  let schemaLiveUndoBefore: Element[] | undefined;
  let schemaLiveTimer: number | undefined;
  let schemaLivePending: { value: string; diagramId: string } | undefined;
  let schemaLiveApplying = false;
  const [validationOpen, setValidationOpen] = createSignal(false);
  const [validationIssues, setValidationIssues] = createSignal<DiagramIssue[]>([]);
  const [validationProfile, setValidationProfile] = createSignal<DiagramLintProfile>("general");
  const [validationIncludeOverlaps, setValidationIncludeOverlaps] = createSignal(false);
  const [validationWarnEmptyLabels, setValidationWarnEmptyLabels] = createSignal(false);
  const [importSummary, setImportSummary] = createSignal<{ fileName: string; kept: number; simplified: number; skipped: number }>();
  const [bpmnSimulationOpen, setBpmnSimulationOpen] = createSignal(false);
  const [bpmnSimulationSteps, setBpmnSimulationSteps] = createSignal<BpmnSimulationStep[]>([]);
  const [bpmnSimulationIndex, setBpmnSimulationIndex] = createSignal(-1);
  const [bpmnContextText, setBpmnContextText] = createSignal("");
  let bpmnSimulationTimer: number | undefined;
  const [namedSnapshotsOpen, setNamedSnapshotsOpen] = createSignal(false);
  const [namedSnapshots, setNamedSnapshots] = createSignal<NamedDocumentSnapshot[]>([]);
  const [namedSnapshotTitle, setNamedSnapshotTitle] = createSignal("");
  const [snapshotComparison, setSnapshotComparison] = createSignal<string[]>([]);
  const [snapshotVisuals, setSnapshotVisuals] = createSignal<{ before: string; current: string }>();
  const [objectSearchOpen, setObjectSearchOpen] = createSignal(false);
  const [objectSearchQuery, setObjectSearchQuery] = createSignal("");
  const [objectReplaceText, setObjectReplaceText] = createSignal("");
  const [mermaidDialog, setMermaidDialog] = createSignal(false);
  const [mermaidEditingDiagram, setMermaidEditingDiagram] = createSignal<string>();
  const [mermaidFormat, setMermaidFormat] = createSignal<"mermaid" | "plantuml">("mermaid");
  const [mermaidInput, setMermaidInput] = createSignal("flowchart TD\n  Start([Start]) --> Check{Ready?}\n  Check -->|Yes| Done[Finish]\n  Check -->|No| Wait[Wait]");
  const [mermaidError, setMermaidError] = createSignal("");
  const [codeDataOpen, setCodeDataOpen] = createSignal(false);
  const [diagramSourceDraft, setDiagramSourceDraft] = createSignal("");
  const [diagramSourcePreviewOpen, setDiagramSourcePreviewOpen] = createSignal(false);
  const [diagramSourceMessage, setDiagramSourceMessage] = createSignal("");
  const [csvChartOpen, setCsvChartOpen] = createSignal(false);
  const [csvEditingChartId, setCsvEditingChartId] = createSignal<string>();
  const [csvChartInput, setCsvChartInput] = createSignal("Category,Sales,Costs\nNorth,42,18\nSouth,35,21\nWest,58,24");
  const [csvChartLabelColumn, setCsvChartLabelColumn] = createSignal(0);
  const [csvChartSeriesColumns, setCsvChartSeriesColumns] = createSignal<number[]>([1, 2]);
  const [csvChartKind, setCsvChartKind] = createSignal<LibraryChartKind>("viz-bar");
  const [csvChartError, setCsvChartError] = createSignal("");
  const [flowchartPaletteSearch, setFlowchartPaletteSearch] = createSignal("");
  const [flowchartPaletteCategory, setFlowchartPaletteCategory] = createSignal<"Common" | "Other" | "All">("Common");
  const [diagramCodeExportOpen, setDiagramCodeExportOpen] = createSignal(false);
  const [diagramCodeFormat, setDiagramCodeFormat] = createSignal<DiagramCodeFormat>("mmd");
  const [diagramCodeScope, setDiagramCodeScope] = createSignal<"page" | "selection">("page");
  const [webEmbedDialog, setWebEmbedDialog] = createSignal(false);
  const [webEmbedInput, setWebEmbedInput] = createSignal("");
  const [webEmbedError, setWebEmbedError] = createSignal("");
  const [activeWebPreview, setActiveWebPreview] = createSignal<{ id: string; url: string; embedUrl: string }>();
  createEffect(() => {
    const preview = activeWebPreview();
    if (preview && (!isCanvasWorkspace() || !activePath() || !elements().some(item => item.type === "image" && item.id === preview.id && !!item.previewUrl))) setActiveWebPreview(undefined);
  });
  const [isPanning, setIsPanning] = createSignal(false);
  const [spaceDown, setSpaceDown] = createSignal(false);
  const [historyVersion, setHistoryVersion] = createSignal(0);
  const imageCache = new Map<string, HTMLImageElement>();
  const [canvasAssetRevision, setCanvasAssetRevision] = createSignal(0);
  const textLinesCache = new WeakMap<TextElement, string[]>();
  const [themeMode, setThemeMode] = createSignal<ThemeMode>((() => {
    try { const saved = localStorage.getItem("sketchdraw-theme"); return saved === "light" || saved === "dark" ? saved : "system"; }
    catch { return "system"; }
  })());
  const [accentColor, setAccentColor] = createSignal((() => {
    try { const saved = localStorage.getItem("sketchdraw-accent"); return saved && /^#[\da-f]{6}$/i.test(saved) ? saved : DEFAULT_UI_ACCENT; }
    catch { return DEFAULT_UI_ACCENT; }
  })());
  const [systemDark, setSystemDark] = createSignal(window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
  const [recentFiles, setRecentFiles] = createSignal<string[]>((() => {
    try { const value: unknown = JSON.parse(localStorage.getItem("sketchdraw-v8-recent-files") ?? localStorage.getItem("sketchdraw-v6-recent-files") ?? "[]"); if (!Array.isArray(value)) return []; const seen = new Set<string>(); return value.flatMap((path): string[] => { if (typeof path !== "string" || !isSketchPath(path)) return []; const key = filePathIdentity(path); if (seen.has(key)) return []; seen.add(key); return [path]; }).slice(0, 8); }
    catch { return []; }
  })());
  const [providerDocumentNames, setProviderDocumentNames] = createSignal<Record<string, string>>({});
  const providerNameRequests = new Map<string, Promise<string | undefined>>();
  createEffect(() => {
    selectedIndices();
    const currentTool = tool();
    if (currentTool === "select") setStyleMenuMode("quick");
    setQuickStylePopover(undefined);
  });
  const [marquee, setMarquee] = createSignal<{ start: Point; end: Point }>();
  const [laserTrail, setLaserTrail] = createSignal<{ points: Point[]; opacity: number }>();
  let canvas!: HTMLCanvasElement;
  let exportPreviewCanvas!: HTMLCanvasElement;
  let exportPreviewVersion = 0;
  let canvasWrap!: HTMLElement;
  let appTopbar!: HTMLElement;
  let menu!: HTMLDetailsElement;
  let viewMenu!: HTMLDetailsElement;
  let gestureMenu!: HTMLDetailsElement;
  let helpMenu!: HTMLDetailsElement;
  let appSettingsMenu!: HTMLDetailsElement;
  let drawing = false;
  let activeDrawingTool: Preview["type"] = "pen";
  let currentPoints: StrokePoint[] = [];
  let currentPointsRevision = 0;
  const strokeSampleGate = createStrokeSampleGate();
  let strokePointLimitReached = false;
  let pendingAndroidStylusSamples: AndroidStylusSample[] = [];
  const freehandRenderer = createFreehandRenderer();
  onCleanup(freehandRenderer.dispose);
  createEffect(() => { activePath(); activePageId(); theme(); freehandRenderer.clearRasterCache(); });
  let penEraserDrawing = false;
  let laserTimer: number | undefined;
  let restartAutosave: (() => void) | undefined;
  let syncPollTimer: number | undefined;
  let syncObservationTimer: number | undefined;
  let panOrigin: { x: number; y: number; panX: number; panY: number } | undefined;
  const touchPointers = new Map<number, Point>();
  const ignoredTouchPointers = new Set<number>();
  let activePenPointerId: number | undefined;
  let touchGesture: TouchGesture | undefined;
  let touchTapTracker: TouchTapTracker | undefined;
  let focusModeWasFullscreen: boolean | undefined;
  let focusModeUsedDocumentFullscreen = false;
  let windowsFocusWasFullscreen = false;
  let windowsFocusUsedDocumentFullscreen = false;
  let presentationOwnsFullscreen = false;
  let moveOrigin: { indices: number[]; point: Point; before: Element[]; moved: boolean; dx: number; dy: number; axisLock?: "x" | "y"; snapTargets: { x: number[]; y: number[]; spacingBoxes?: Bounds[] }; targets: Map<string, Element> } | undefined;
  let libraryControlOrigin: { index: number } | undefined;
  let labelMoveOrigin: { index: number; point: Point; before: Element[]; offsetX: number; offsetY: number; rotation: number; moved: boolean } | undefined;
  let marqueeOrigin: { point: Point; additive: boolean; moved: boolean; cropIndex?: number } | undefined;
  let resizeOrigin: { index: number; handle: string; start: Point; original: Element; before: Element[]; moved: boolean } | undefined;
  let measureOrigin: Point | undefined;
  let pathNodeOrigin: { index: number; nodeIndex: number; before: Element[]; original: Element; moved: boolean } | undefined;
  const [nativeBusy, setNativeBusy] = createSignal(false);
  const planningSession = createPlanningSession({ busy: nativeBusy, setBusy: setNativeBusy, chooseDocument: choosePlanningDocument, createDocument: createPlanningDocument, activeSketchPath: activePath, displayNameForPath, setError });
  const { recentPlans, data: projectWorkspaceData, path: planningPath, dirty: planningDirty, saving: planningSaving, savedAt: planningSavedAt, legacyPending: legacyPlanningPending, needsExtraction: planningNeedsExtraction } = planningSession;
  const [documentBusy, setDocumentBusy] = createSignal(false);
  const [openToolOptions, setOpenToolOptions] = createSignal<Tool>();
  const [stencilMenuOpen, setStencilMenuOpen] = createSignal(false);
  const [stencilSearch, setStencilSearch] = createSignal("");
  const [stencilCategory, setStencilCategory] = createSignal("All");
  const [customStencils, setCustomStencils] = createSignal<CustomStencil[]>(readCustomStencils());
  const [stencilFavorites, setStencilFavorites] = createSignal<string[]>(readStencilFavorites());
  const [recentStencils, setRecentStencils] = createSignal<string[]>(readRecentStencils());
  const [componentCatalogBusy, setComponentCatalogBusy] = createSignal(false);
  const [shapeCatalogBusy, setShapeCatalogBusy] = createSignal(false);
  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number; world: Point }>();
  const [pageDialog, setPageDialog] = createSignal<"rename" | "delete">();
  const [pageName, setPageName] = createSignal("");
  const [exportScope, setExportScope] = createSignal<"drawing" | "selection" | "viewport" | "region" | "frame">("drawing");
  const [exportMarqueeRegion, setExportMarqueeRegion] = createSignal<Bounds>();
  const [exportPadding, setExportPadding] = createSignal(24);
  const [exportGrid, setExportGrid] = createSignal(false);
  const [pdfPaper, setPdfPaper] = createSignal<"a4" | "letter" | "a3" | "legal" | "tabloid" | "custom">("a4");
  const [pdfPageSet, setPdfPageSet] = createSignal<"current" | "all" | "range" | "frames">("current");
  const [pdfRangeStart, setPdfRangeStart] = createSignal(1);
  const [pdfRangeEnd, setPdfRangeEnd] = createSignal(1);
  const [pdfOrientation, setPdfOrientation] = createSignal<"portrait" | "landscape">("landscape");
  const [pdfLayout, setPdfLayout] = createSignal<"fit" | "tiled">("fit");
  const [pdfDpi, setPdfDpi] = createSignal<150 | 300>(150);
  const [pdfMarginMm, setPdfMarginMm] = createSignal(10);
  const [pdfOverlapMm, setPdfOverlapMm] = createSignal(5);
  const [pdfCustomWidthMm, setPdfCustomWidthMm] = createSignal(210);
  const [pdfCustomHeightMm, setPdfCustomHeightMm] = createSignal(297);
  const [pdfPreviewPage, setPdfPreviewPage] = createSignal(1);
  const [pdfColorMode, setPdfColorMode] = createSignal<"rgb" | "cmyk" | "grayscale">("rgb");
  const [pdfBleedMm, setPdfBleedMm] = createSignal(0);
  const [pdfCropMarks, setPdfCropMarks] = createSignal(false);
  const [pdfHeader, setPdfHeader] = createSignal("");
  const [pdfFooter, setPdfFooter] = createSignal("");
  const [attachmentHint, setAttachmentHint] = createSignal<Point>();
  let clipboardItems: Element[] = [];
  const canvasHistory = createCanvasHistory<Element[]>({
    getCurrent: elements,
    setCurrent: setElements,
    clone: cloneElements,
    canEdit: () => !boardLocked(),
    clearSelection: () => setSelectedIndices([]),
    markDirty: () => setDirty(true),
    changed: () => setHistoryVersion(version => version + 1),
  });
  const pushUndo = canvasHistory.push;
  const rememberPageHistory = () => canvasHistory.rememberPage(activePageId());
  const restorePageHistory = () => canvasHistory.restorePage(activePageId());
  function duplicatePage() {
    if (boardLocked() || pages().length >= 100) return;
    commitTextDraft(); storeCurrentPage(); rememberPageHistory();
    const source = pages().find(p => p.id === activePageId()); if (!source) return;
    const page = { ...source, id: crypto.randomUUID(), name: `${source.name} copy`.slice(0, 80), elements: copyElements(source.elements, 0, 0) };
    const index = pages().findIndex(p => p.id === source.id);
    setPages(items => [...items.slice(0, index + 1), page, ...items.slice(index + 1)]);
    switchPage(page.id); setDirty(true);
  }
  function reorderPage(direction: number) {
    if (boardLocked()) return;
    const index = pages().findIndex(p => p.id === activePageId()); const next = index + direction;
    if (next < 0 || next >= pages().length) return;
    const items = [...pages()]; [items[index], items[next]] = [items[next], items[index]]; setPages(items); setDirty(true);
  }
  function openPageDialog(action: "rename" | "delete") {
    commitTextDraft(); setPageName(currentPage()?.name ?? "Page"); setPageDialog(action);
  }
  function confirmPageDialog() {
    if (boardLocked()) return;
    if (pageDialog() === "rename" && pageName().trim()) { setPages(items => items.map(page => page.id === activePageId() ? { ...page, name: pageName().trim().slice(0, 80) } : page)); setDirty(true); }
    else if (pageDialog() === "delete") deleteCurrentPage();
    setPageDialog(undefined);
  }
  function changeSelected(operation: (element: Element) => Element) {
    if (boardLocked()) return;
    const selected = new Set(selectedIndices()); const before = cloneElements(elements());
    setElements(items => items.map((item, index) => selected.has(index) && canMoveElement(item) ? operation(item) : item));
    if (JSON.stringify(before) !== JSON.stringify(elements())) { pushUndo(before); setDirty(true); }
  }
  function geometryBounds(item: Element): Bounds | undefined {
    if (item.type === "group") return item.note ? undefined : item.componentBounds ?? elementBounds(item.libraryComponent ? { ...item, rotation: 0 } : item);
    if (item.type === "freehand" || isConnector(item)) return undefined;
    if ("x" in item && "y" in item) return { x: item.x, y: item.y, w: "w" in item ? Math.abs(item.w) : 0, h: "h" in item ? Math.abs(item.h) : 0 };
    return undefined;
  }
  function selectedGeometryElement(): Element | undefined {
    return selectedIndices().length === 1 ? elements()[selectedIndices()[0]] : undefined;
  }
  function selectedLifelineGroup(): GroupElement | undefined {
    const item = selectedGeometryElement();
    return item?.type === "group" && item.libraryComponent?.kind === "uml-lifeline" ? item : undefined;
  }
  function selectedGeometryBounds(): Bounds | undefined {
    const item = selectedGeometryElement();
    return item ? geometryBounds(item) : undefined;
  }
  function selectedGeometryCanResize(): boolean {
    const item = selectedGeometryElement();
    return !!item && (item.type === "group" ? !item.note : item.type !== "freehand" && !isConnector(item) && "w" in item);
  }
  function selectedGeometryCanRotate(): boolean {
    const item = selectedGeometryElement();
    return !!item && !isConnector(item) && (item.type !== "group" || !!item.libraryComponent);
  }
  function selectedAspectLockSupported(): boolean {
    const item = selectedGeometryElement();
    return !!item && (item.type === "image" || item.type === "schemaTable" || item.type === "svgPath" || item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "triangle" || item.type === "flowchart" || item.type === "group" && !item.note && (!!item.libraryComponent || !!item.container));
  }
  function cycleSelection(direction: -1 | 1) {
    const available = elements().flatMap((item, index) => !isElementHidden(item) && !isElementLocked(item) ? [index] : []);
    if (!available.length) return;
    const selected = selectedIndices()[0]; const at = available.indexOf(selected);
    const next = at < 0 ? direction > 0 ? 0 : available.length - 1 : (at + direction + available.length) % available.length;
    setSelectedIndices([available[next]]); setSidebarTab("properties");
  }
  const pathNodeHandles = (): { index: number; x: number; y: number; selected: boolean }[] => {
    if (!pathNodeEditMode() || boardLocked() || readOnlyView() || selectedIndices().length !== 1) return [];
    const item = selectedGeometryElement(); if (!item) return [];
    const zoom = canvasState().zoom; const state = canvasState();
    if (item.type === "freehand") {
      const stride = Math.max(1, Math.ceil(item.points.length / 256));
      return item.points.flatMap((point, index) => index % stride === 0 || index === item.points.length - 1 ? [{ index, x: state.panX + point.x * zoom, y: state.panY + point.y * zoom, selected: selectedPathNodeIndex() === index }] : []);
    }
    if (item.type !== "svgPath") return [];
    const path = parseEditablePath(item.pathData); if (!path) return [];
    const pathWidth = Math.max(0.001, item.pathWidth ?? item.w); const pathHeight = Math.max(0.001, item.pathHeight ?? item.h);
    const bounds = elementBounds(item); const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
    return path.points.map((point, index) => {
      const world = rotateCanvasPoint({ x: item.x + point.x / pathWidth * item.w, y: item.y + point.y / pathHeight * item.h }, center, item.rotation ?? 0);
      return { index, x: state.panX + world.x * zoom, y: state.panY + world.y * zoom, selected: selectedPathNodeIndex() === index };
    });
  };
  function selectedGeometryMin(axis: "w" | "h"): number {
    const item = selectedGeometryElement();
    if (!item) return 25;
    if (item.type === "group" && item.libraryComponent) return libraryComponentMinimum(item, axis);
    if (item.type === "schemaTable") return axis === "w" ? schemaTableResizeMinimumWidth() : schemaTableMinimumHeight(item.columns.length, item.fontSize ?? 12);
    return 25;
  }
  function precision(property: "x" | "y" | "w" | "h" | "rotation", value: number) {
    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000) return;
    changeSelected(item => {
      const bounds = geometryBounds(item) ?? elementBounds(item);
      if (property === "x" || property === "y") return moveElement(item, property === "x" ? value - bounds.x : 0, property === "y" ? value - bounds.y : 0);
      if (property === "rotation") return isConnector(item) || item.type === "group" && !item.libraryComponent ? item : { ...item, rotation: value % 360 };
      if (item.type === "text") return { ...item, fontSize: Math.round(Math.max(8, Math.min(160, item.fontSize * value / Math.max(1, bounds[property])))) };
      if (item.type === "group" && !item.note) {
        const minimum = item.libraryComponent ? libraryComponentMinimum(item, property) : 25;
        const target = { ...bounds, [property]: Math.max(minimum, Math.min(4000, value)) };
        return item.libraryComponent ? resizeLibraryGroup(item, target) : resizeContainerWithChildren(item, target);
      }
      if (item.type === "freehand" || isConnector(item) || !("w" in item)) return item;
      const minWidth = item.type === "schemaTable" ? schemaTableResizeMinimumWidth() : 25;
      const minHeight = item.type === "schemaTable" ? schemaTableMinimumHeight(item.columns.length, item.fontSize ?? 12) : 25;
      if (item.type === "schemaTable" && property === "h") return { ...item, h: minHeight };
      const size = Math.max(property === "w" ? minWidth : 25, property === "h" ? minHeight : 25, value);
      return { ...item, [property]: Math.sign(item[property]) * size };
    });
  }
  function alignSelection(command: "left" | "center" | "right" | "top" | "middle" | "bottom" | "horizontal" | "vertical") {
    if (boardLocked() || readOnlyView()) return;
    const selected = selectedIndices().filter(i => elements()[i] && canMoveElement(elements()[i]));
    if (selected.length < 2) return;
    const boxes = selected.map(index => ({ index, box: elementBounds(elements()[index]) })); const all = unionBounds(boxes.map(item => item.box))!;
    const translations = new Map<number, Point>();
    if (command === "horizontal" || command === "vertical") {
      if (selected.length < 3) return;
      const axis = command === "horizontal" ? "x" : "y"; const size = axis === "x" ? "w" : "h";
      boxes.sort((a, b) => a.box[axis] - b.box[axis]);
      const start = boxes[0].box[axis]; const last = boxes[boxes.length - 1].box;
      const gap = (last[axis] + last[size] - start - boxes.reduce((total, { box }) => total + box[size], 0)) / (boxes.length - 1);
      let position = start;
      for (const { index, box } of boxes) { translations.set(index, { x: axis === "x" ? position - box.x : 0, y: axis === "y" ? position - box.y : 0 }); position += box[size] + gap; }
    } else for (const { index, box } of boxes) translations.set(index, {
      x: command === "left" ? all.x - box.x : command === "center" ? all.x + all.w / 2 - box.x - box.w / 2 : command === "right" ? all.x + all.w - box.x - box.w : 0,
      y: command === "top" ? all.y - box.y : command === "middle" ? all.y + all.h / 2 - box.y - box.h / 2 : command === "bottom" ? all.y + all.h - box.y - box.h : 0,
    });
    const before = cloneElements(elements()); setElements(items => items.map((item, index) => { const delta = translations.get(index); return delta ? moveElement(item, delta.x, delta.y) : item; })); pushUndo(before); setDirty(true);
  }
  const selectedConnectorCount = () => flatten(selectedElements()).filter(item => isConnector(item) && !isElementHidden(item) && !isElementLocked(item)).length;
  function renumberSelectedSequenceMessages() {
    if (boardLocked() || readOnlyView()) return;
    const selected = new Set(selectedIndices()); const selectedRoots = elements().filter((_, index) => selected.has(index));
    const ordered = flatten(selectedRoots).filter((item): item is ShapeElement => isConnector(item) && !isElementHidden(item) && !isElementLocked(item)).sort((a, b) => a.y - b.y || a.x - b.x);
    if (ordered.length < 2) return;
    const sequence = new Map(ordered.flatMap((item, order) => item.id ? [[item.id, order + 1] as const] : []));
    const before = cloneElements(elements());
    const update = (item: Element): Element => {
      if (isElementLocked(item)) return item;
      if (item.type === "group") return { ...item, elements: item.elements.map(update) };
      const number = item.id ? sequence.get(item.id) : undefined; if (!number || !isConnector(item)) return item;
      const previous = item.label?.text.replace(/^\s*\d+[.)]\s*/, "").trim() || "Message";
      return { ...item, label: { text: `${number}. ${previous}`, color: item.label?.color ?? item.color, fontSize: item.label?.fontSize ?? 12, fontFamily: item.label?.fontFamily ?? "sans", bold: item.label?.bold ?? false, italic: item.label?.italic ?? false, underline: item.label?.underline ?? false, textAlign: item.label?.textAlign ?? "center", listType: item.label?.listType ?? "none", verticalAlign: item.label?.verticalAlign ?? "top", ...(item.label?.offsetX === undefined ? {} : { offsetX: item.label.offsetX }), ...(item.label?.offsetY === undefined ? {} : { offsetY: item.label.offsetY }) } };
    };
    setElements(items => items.map((item, index) => selected.has(index) ? update(item) : item));
    pushUndo(before); setDirty(true);
  }
  async function autoLayoutDiagram(direction: "RIGHT" | "DOWN" = "RIGHT", preset: "default" | "c4" | "sequence" | "erd" | "network" = "default", algorithm: DiagramLayoutAlgorithm = layoutAlgorithm(), scope: "page" | "selection" = layoutSelectionOnly() ? "selection" : "page") {
    const path = activePath();
    const source = elements();
    if (!path || boardLocked() || readOnlyView() || source.length < 2 || scope === "selection" && selectedIndices().length < 2) return;
    try {
      const { autoLayoutElements } = await import("./features/diagrams/auto-layout");
      const arranged = await autoLayoutElements(source, selectedIndices(), direction, preset, algorithm, scope, layoutSpacing(), isElementHidden, isElementLocked);
      if (activePath() !== path || elements() !== source || !arranged.some((item, index) => item !== source[index])) return;
      const connected = resolveBindings(arranged).map((item, index) => isElementLocked(source[index]) ? source[index] : item);
      pushUndo(cloneElements(source));
      setElements(connected);
      setDirty(true);
    } catch (cause) {
      setError(`Could not arrange the diagram: ${String(cause)}`);
    }
  }
  async function optimizeAllConnectorRoutes() {
    const path = activePath(); const source = elements();
    if (!path || boardLocked() || readOnlyView() || !flatten(source).some(isConnector)) return;
    try {
      const routed = autoRouteConnectorSet(source, isElementHidden, isElementLocked);
      if (activePath() !== path || elements() !== source || !routed.some((item, index) => item !== source[index])) return;
      pushUndo(cloneElements(source)); setElements(routed); setDirty(true);
    } catch (cause) {
      setError(`Could not optimize connector routes: ${String(cause)}`);
    }
  }
  function clipboardPayload() { return JSON.stringify({ format: "SketchDrawClipboard", version: SKETCH_FORMAT_VERSION, elements: copyElements(selectedElements(), 0, 0) }); }
  function pastePayload(raw: string, at?: Point) {
    if (!activePath() || boardLocked()) return;
    try {
      const payload: unknown = JSON.parse(raw);
      if (!isRecord(payload) || payload.format !== "SketchDrawClipboard" || ![6, SKETCH_FORMAT_VERSION].includes(Number(payload.version)) || !Array.isArray(payload.elements)) throw new Error("Copy objects from this version of SketchDraw first.");
      const items = payload.elements.map(normalizeElement);
      if (!items.length || items.some(item => !item) || !validReferences(items as Element[])) throw new Error("The clipboard objects are invalid.");
      insertCopies(items as Element[], at);
    } catch (cause) { setError(`Could not paste: ${String(cause)}`); }
  }
  function insertCopies(items: Element[], at?: Point) {
    if (!activePath() || boardLocked() || readOnlyView() || !items.length) return;
    const box = unionBounds(items.map(elementBounds));
    const copies = copyElements(items, at && box ? at.x - box.x : 24, at && box ? at.y - box.y : 24); const start = elements().length;
    pushUndo(cloneElements(elements())); setElements(current => [...current, ...copies]); setSelectedIndices(copies.map((_, index) => start + index)); setTool("select"); setDirty(true);
  }
  async function copySelection() {
    if (!selectedElements().length) return;
    clipboardItems = copyElements(selectedElements(), 0, 0);
    try { await navigator.clipboard.writeText(clipboardPayload()); } catch { /* The in-app clipboard remains available. */ }
  }
  async function pasteSelection(at?: Point) {
    try { const text = await navigator.clipboard.readText(); pastePayload(text, at); }
    catch { if (clipboardItems.length) insertCopies(clipboardItems, at); else setError("Press Ctrl/Cmd+V to grant clipboard access."); }
  }

  function copyObjectStyle() {
    const source = selectedElements()[0];
    if (!source) return;
    const common = ["opacity"];
    const allowed = source.type === "freehand" ? [...common, "color", "thickness"]
      : source.type === "text" ? [...common, "color", "fontSize", "fontFamily", "bold", "italic", "underline", "textAlign", "listType"]
      : source.type === "image" ? common
      : source.type === "schemaTable" ? [...common, "fontSize"]
      : source.type === "group" ? common
      : [...common, "color", "thickness", "fillColor", "fillOpacity", "lineStyle", "edgeStyle", "cornerRadius", "flowchartShape", "lineRoute", "arrowRoute", "startHead", "endHead"];
    const style = Object.fromEntries(allowed.flatMap(key => key in source ? [[key, (source as unknown as Record<string, unknown>)[key]]] : []));
    setCopiedObjectStyle({ type: source.type, style });
    try { localStorage.setItem("sketchdraw-copied-object-style", JSON.stringify({ type: source.type, style })); } catch { /* The in-memory copy stays available for this session. */ }
  }

  function pasteObjectStyle() {
    const copied = copiedObjectStyle();
    if (!copied || boardLocked() || readOnlyView()) return;
    const indices = selectedIndices().filter(index => elements()[index] && !elements()[index].locked);
    if (!indices.length) return;
    const before = cloneElements(elements());
    const compatible = (target: Element) => target.type === copied.type || (isShapeLike(target) && isShapeLikeType(copied.type));
    const next = elements().map((element, index) => indices.includes(index) && compatible(element) ? { ...element, ...copied.style } as Element : element);
    if (JSON.stringify(next) === JSON.stringify(before)) return;
    pushUndo(before); setElements(next); setDirty(true);
  }
  function onContextMenu(event: MouseEvent) {
    event.preventDefault(); if (!activePath() || readOnlyView()) return;
    commitTextDraft(); const rect = canvas.getBoundingClientRect(); const view = canvasState(); const point = { x: (event.clientX - rect.left - view.panX) / view.zoom, y: (event.clientY - rect.top - view.panY) / view.zoom };
    const hit = hitTest(point); if (hit !== undefined && !selectedIndices().includes(hit)) setSelectedIndices([hit]);
    if (menu) menu.open = false; if (viewMenu) viewMenu.open = false; if (gestureMenu) gestureMenu.open = false;
    setContextMenu({ x: Math.max(8, Math.min(event.clientX, window.innerWidth - 252)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - 510)), world: point });
  }
  function connectorForView(item: ShapeElement, sourceItems = elements()): ShapeElement {
    if (item.straightOnly || !item.autoRoute || (item.type !== "line" && item.type !== "arrow")) return item;
    return { ...item, lineRoute: item.type === "line" ? "straight" : undefined, arrowRoute: item.type === "arrow" ? "straight" : undefined, routePoints: autoRoutePoints(item, autoRouteContextFor(sourceItems)) };
  }
  function connectorIsStraight(item: Element | undefined): item is ShapeElement {
    if (!item || !isConnector(item)) return false;
    if (item.straightOnly) return true;
    const route = item.type === "arrow" ? item.arrowRoute ?? "straight" : item.lineRoute ?? "straight";
    return route === "straight" && !item.autoRoute && !item.routePoints?.length;
  }
  function connectorHandles(item: ShapeElement) {
    const viewItem = connectorForView(item);
    if (item.straightOnly) return [{ id: "start", x: item.x, y: item.y }, { id: "end", x: item.x + item.w, y: item.y + item.h }];
    if (item.autoRoute) {
      return [
        { id: "start", x: item.x, y: item.y },
        { id: "end", x: item.x + item.w, y: item.y + item.h },
        ...(viewItem.routePoints ?? []).map((point, index) => ({ ...point, id: `auto-route:${index}` })),
      ];
    }
    const route = item.type === "arrow" ? item.arrowRoute ?? "straight" : item.lineRoute ?? "straight";
    if (item.type === "arrow" && route === "forked") {
      const fork = forkGeometry(item);
      return [
        { id: "start", x: item.x, y: item.y },
        { id: "end", x: item.x + item.w, y: item.y + item.h },
        { id: "route:0", x: fork.junction.x, y: fork.junction.y },
        ...(item.forkUpper?.routePoints ?? []).map((point, index) => ({ ...point, id: `fork:upper:route:${index}` })),
        { id: "fork:upper:end", x: fork.upper.x, y: fork.upper.y },
        ...(item.forkLower?.routePoints ?? []).map((point, index) => ({ ...point, id: `fork:lower:route:${index}` })),
        { id: "fork:lower:end", x: fork.lower.x, y: fork.lower.y },
      ];
    }
    const points = item.routePoints !== undefined ? item.routePoints : route === "straight" ? [{ x: item.x + item.w / 2, y: item.y + item.h / 2 }] : route === "elbow" ? [{ x: item.x + item.w, y: item.y }] : route === "jagged" ? jaggedVertices(item).slice(1, -1) : route === "curve" || route === "loop" ? connectorControlPoints(item, route) : [forkGeometry(item).junction];
    return [{ id: "start", x: item.x, y: item.y }, { id: "end", x: item.x + item.w, y: item.y + item.h }, ...points.map((point, index) => ({ ...point, id: `route:${index}` }))];
  }
  function setCurvePointCount(delta: number) {
    if (boardLocked()) return;
    // Re-space curve nodes evenly when the count changes; each can then be dragged independently.
    changeSelected(item => {
      if (!isConnector(item) || item.straightOnly) return item;
      const route = item.type === "arrow" ? item.arrowRoute ?? "straight" : item.lineRoute ?? "straight";
      if (route !== "curve") return item;
      const count = Math.max(1, Math.min(12, connectorControlPoints(item, "curve").length + delta));
      return { ...item, routePoints: defaultCurveControlPoints({ ...item, routePoints: undefined }, count), autoRoute: undefined, routeWaypoints: undefined };
    });
  }
  function quickCurvePointCount() {
    const item = styleTargetElement();
    return item && isConnector(item) ? Math.max(1, connectorControlPoints(item, "curve").length) : 1;
  }
  function connectorEndpointMinimum(requested: Point, fixed: Point, item: ShapeElement, endpoint: "start" | "end", useGrid = true): Point {
    const dx = requested.x - fixed.x; const dy = requested.y - fixed.y; const length = Math.hypot(dx, dy);
    if (length >= 25) return requested;
    const oldDirection = endpoint === "start" ? { x: -item.w, y: -item.h } : { x: item.w, y: item.h };
    const directionLength = Math.hypot(oldDirection.x, oldDirection.y);
    const direction = length > 0.001 ? { x: dx / length, y: dy / length } : directionLength > 0.001 ? { x: oldDirection.x / directionLength, y: oldDirection.y / directionLength } : { x: endpoint === "start" ? -1 : 1, y: 0 };
    if (useGrid && snapToGrid()) {
      const style = whiteboardStyle(); const candidates: Point[] = [];
      if (style === "isometric") {
        const rowStep = isometricRowHeight(GRID_SIZE); const nearestRow = Math.round(fixed.y / rowStep);
        for (let row = nearestRow - 3; row <= nearestRow + 3; row++) {
          const phase = isometricRowOffset(row, GRID_SIZE); const column = Math.round((requested.x - phase) / GRID_SIZE);
          for (let index = column - 3; index <= column + 3; index++) candidates.push({ x: index * GRID_SIZE + phase, y: row * rowStep });
        }
      } else {
        const centerX = Math.round(fixed.x / GRID_SIZE); const centerY = Math.round(fixed.y / GRID_SIZE);
        for (let x = centerX - 3; x <= centerX + 3; x++) for (let y = centerY - 3; y <= centerY + 3; y++) candidates.push({ x: x * GRID_SIZE, y: y * GRID_SIZE });
      }
      const valid = candidates.filter(candidate => Math.hypot(candidate.x - fixed.x, candidate.y - fixed.y) >= 25);
      valid.sort((left, right) => Math.hypot(left.x - requested.x, left.y - requested.y) - Math.hypot(right.x - requested.x, right.y - requested.y));
      if (valid[0]) return valid[0];
    }
    return { x: fixed.x + direction.x * 25, y: fixed.y + direction.y * 25 };
  }

  function resizeConnector(item: ShapeElement, handle: string, point: Point): ShapeElement {
    const port = nearestBinding(elements(), point, 18 / canvasState().zoom, item => !isElementHidden(item) && !isElementLocked(item), item.relationshipType); setAttachmentHint(port?.point);
    const requested = port?.point ?? snap(point);
    if (handle === "start") {
      const fixed = { x: item.x + item.w, y: item.y + item.h }; const target = connectorEndpointMinimum(requested, fixed, item, "start");
      return { ...item, x: target.x, y: target.y, w: fixed.x - target.x, h: fixed.y - target.y, startBinding: target === requested ? port?.binding : undefined, rotation: 0 };
    }
    if (handle === "end") {
      const fixed = { x: item.x, y: item.y }; const target = connectorEndpointMinimum(requested, fixed, item, "end");
      return { ...item, w: target.x - fixed.x, h: target.y - fixed.y, endBinding: target === requested ? port?.binding : undefined, rotation: 0 };
    }
    const autoRouteMatch = /^auto-route:(\d+)$/.exec(handle);
    if (autoRouteMatch && item.autoRoute) {
      const route = connectorForView(item).routePoints ?? []; const routeIndex = Number(autoRouteMatch[1]);
      if (routeIndex < 0 || routeIndex >= route.length) return item;
      // Convert the displayed route to a fixed manual path, so dragging one bend never inserts a new pin.
      const points = route.map((routePoint, index) => index === routeIndex ? snap(point) : { ...routePoint });
      return { ...item, autoRoute: undefined, routeWaypoints: undefined, lineRoute: item.type === "line" ? "elbow" : undefined, arrowRoute: item.type === "arrow" ? "elbow" : undefined, routePoints: points };
    }
    const branchMatch = /^fork:(upper|lower):(end|route)(?::(\d+))?$/.exec(handle);
    if (branchMatch) {
      const name = branchMatch[1] as "upper" | "lower"; const branchKey = name === "upper" ? "forkUpper" : "forkLower";
      const branch = { ...(item[branchKey] ?? {}) };
      if (branchMatch[2] === "end") {
        const geometry = forkGeometry(item); const fixed = geometry.junction; const currentEnd = geometry[name];
        const branchItem = { ...item, w: currentEnd.x - fixed.x, h: currentEnd.y - fixed.y };
        const target = connectorEndpointMinimum(requested, fixed, branchItem, "end");
        return { ...item, [branchKey]: { ...branch, end: target, endBinding: target === requested ? port?.binding : undefined } };
      }
      const points = [...(branch.routePoints ?? [])]; points[Number(branchMatch[3])] = snap(point);
      return { ...item, [branchKey]: { ...branch, routePoints: points } };
    }
    if (item.type === "arrow" && item.arrowRoute === "forked" && handle === "route:0") return { ...item, routePoints: [snap(point)] };
    const points = item.routePoints?.length ? [...item.routePoints] : connectorHandles(item).slice(2).map(({ x, y }) => ({ x, y }));
    points[Number(handle.split(":")[1])] = snap(point); return { ...item, routePoints: points };
  }
  function setEndpoint(end: "start" | "end", axis: "x" | "y", value: number) {
    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000) return;
    changeSelected(item => {
      if (!isConnector(item)) return item;
      const start = { x: item.x, y: item.y }; const finish = { x: item.x + item.w, y: item.y + item.h };
      (end === "start" ? start : finish)[axis] = value;
      const fixed = end === "start" ? finish : start; const requested = connectorEndpointMinimum(end === "start" ? start : finish, fixed, item, end, false);
      if (end === "start") { start.x = requested.x; start.y = requested.y; } else { finish.x = requested.x; finish.y = requested.y; }
      return { ...item, x: start.x, y: start.y, w: finish.x - start.x, h: finish.y - start.y, [end === "start" ? "startBinding" : "endBinding"]: undefined };
    });
  }
  function setConnectorBoundsPosition(axis: "x" | "y", value: number) {
    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000) return;
    changeSelected(item => {
      if (!isConnector(item)) return item;
      const delta = axis === "x" ? item.w : item.h;
      const currentMin = Math.min(item[axis], item[axis] + delta);
      const offset = value - currentMin;
      return moveElement(item, axis === "x" ? offset : 0, axis === "y" ? offset : 0);
    });
  }
  function setStraightConnectorLength(requestedLength: number) {
    const focused = focusedElement();
    if (!Number.isFinite(requestedLength) || requestedLength < 1 || requestedLength > 1_000_000 || !connectorIsStraight(focused)) return;
    const currentLength = Math.hypot(focused.w, focused.h);
    const targetLength = Math.max(25, requestedLength);
    const direction = currentLength >= 1 ? { x: focused.w / currentLength, y: focused.h / currentLength } : { x: 1, y: 0 };
    changeSelected(item => connectorIsStraight(item)
      ? { ...item, w: direction.x * targetLength, h: direction.y * targetLength, endBinding: undefined }
      : item);
  }
  function setForkEndpoint(branchName: "upper" | "lower", axis: "x" | "y", value: number) {
    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000) return;
    changeSelected(item => {
      if (item.type !== "arrow" || item.arrowRoute !== "forked") return item;
      const geometry = forkGeometry(item); const current = branchName === "upper" ? geometry.upper : geometry.lower;
      const end = { ...current, [axis]: value };
      const key = branchName === "upper" ? "forkUpper" : "forkLower";
      return { ...item, [key]: { ...(item[key] ?? {}), end, endBinding: undefined } };
    });
  }
  function editShapeLabel(index: number, pointerId?: number) {
    const shape = elements()[index]; if (!shape || !(isLabelShape(shape) || isConnector(shape)) || shape.locked || boardLocked()) return;
    commitTextDraft(); setSelectedIndices([index]); setTool("select");
    textEditorPendingPointerId = isWindowsPlatform() ? undefined : pointerId;
    const box = labelBox(shape); const label = shape.label;
    setTextDraft({ x: box.x, y: box.y, width: box.w, height: box.h, rotation: shape.rotation ?? 0, value: label?.text ?? "", editingIndex: index, shapeLabel: true, color: label?.color ?? color(), opacity: label?.opacity ?? 1, fontSize: label?.fontSize ?? defaultFontSize(), fontFamily: label?.fontFamily ?? defaultFontFamily(), bold: label?.bold ?? defaultBold(), italic: label?.italic ?? defaultItalic(), underline: label?.underline ?? defaultUnderline(), textAlign: label?.textAlign ?? "center", listType: label?.listType ?? "none", verticalAlign: label?.verticalAlign ?? "middle" });
  }
  function editNestedText(index: number, group: GroupElement, child: Element, pointerId?: number) {
    if (!child.id || group.locked || child.locked || boardLocked()) return;
    const shapeLabel = (isLabelShape(child) || isConnector(child)) && !!child.label;
    if (!shapeLabel && child.type !== "text") return;
    commitTextDraft();
    const currentGroup = elements()[index]; if (currentGroup?.type !== "group") return;
    group = currentGroup;
    child = flatten(group.elements).find(item => item.id === child.id) ?? child;
    setSelectedIndices([index]); setTool("select");
    textEditorPendingPointerId = isWindowsPlatform() ? undefined : pointerId;
    const box = child.type === "text" ? elementBounds(child) : labelBox(child as ShapeElement);
    const unrotatedGroupBounds = elementBounds({ ...group, rotation: 0 });
    const groupCenter = { x: unrotatedGroupBounds.x + unrotatedGroupBounds.w / 2, y: unrotatedGroupBounds.y + unrotatedGroupBounds.h / 2 };
    const childCenter = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    const editorCenter = group.rotation ? rotateCanvasPoint(childCenter, groupCenter, group.rotation) : childCenter;
    const textStyle = child.type === "text" ? child : (child as ShapeElement).label!;
    const textAlign = textStyle.textAlign ?? defaultTextAlign();
    const anchorAlign = textAlign === "justify" ? "left" : textAlign;
    const x = child.type === "text"
      ? editorCenter.x + (anchorAlign === "center" ? 0 : anchorAlign === "right" ? box.w / 2 : -box.w / 2)
      : editorCenter.x - box.w / 2;
    setTextDraft({
      x, y: editorCenter.y - box.h / 2, width: box.w, height: box.h,
      rotation: (group.rotation ?? 0) + (child.rotation ?? 0), value: child.type === "text" ? child.text : textStyle.text,
      editingIndex: index, editingChildId: child.id, shapeLabel,
      color: textStyle.color ?? color(), opacity: textStyle.opacity ?? 1,
      fontSize: textStyle.fontSize ?? defaultFontSize(), fontFamily: textStyle.fontFamily ?? defaultFontFamily(),
      bold: textStyle.bold ?? defaultBold(), italic: textStyle.italic ?? defaultItalic(), underline: textStyle.underline ?? defaultUnderline(),
      textAlign, listType: textStyle.listType ?? "none", verticalAlign: shapeLabel ? (textStyle as ShapeLabel).verticalAlign ?? "middle" : "top",
    });
  }
  function editorWidth(draft: TextDraft) {
    if (draft.width !== undefined) return draft.width;
    const bounds = elementBounds({ type: "text", x: 0, y: 0, text: draft.value, color: draft.color, fontSize: draft.fontSize, fontFamily: draft.fontFamily, bold: draft.bold, italic: draft.italic });
    return Math.max(160, bounds.w + 16);
  }
  function editorLeft(draft: TextDraft) {
    return draft.x - (draft.shapeLabel ? 0 : draft.textAlign === "center" ? editorWidth(draft) / 2 : draft.textAlign === "right" ? editorWidth(draft) : 0);
  }
  function updateLabel(property: keyof ShapeLabel, value: string | number | boolean) {
    if (boardLocked() || focusedElement()?.locked) return;
    if (textDraft()?.shapeLabel && textDraft()?.editingChildId) { setTextDraft(draft => draft?.shapeLabel ? { ...draft, [property]: value } : draft); return; }
    setTextDraft(draft => draft?.shapeLabel ? { ...draft, [property]: value } : draft);
    changeSelected(item => isLabelShape(item) || isConnector(item) ? { ...item, label: { text: "", color: color(), fontSize: defaultFontSize(), verticalAlign: "middle", ...item.label, [property]: value } } : item);
  }
  function drawLabel(ctx: CanvasRenderingContext2D, shape: ShapeElement) {
    drawShapeLabel(ctx, shape, theme());
  }
  function labelSvg(shape: ShapeElement) {
    const label = shape.label; const ctx = canvas.getContext("2d"); if (!label?.text || !ctx) return "";
    return shapeLabelSvg(shape, ctx, theme());
  }

  function displayNameForPath(path: string) {
    return providerDocumentNames()[path] ?? (/^content:\/\//i.test(path) ? "Selected document" : displayPathName(path));
  }
  const openingAssociatedFiles = new Set<string>();
  const recentAssociatedFileOpens = new Map<string, number>();
  async function openAssociatedFile(candidate: string) {
    const path = normalizeFileUri(candidate);
    const key = path.toLowerCase();
    const lastOpened = recentAssociatedFileOpens.get(key) ?? 0;
    if (!path || openingAssociatedFiles.has(key) || Date.now() - lastOpened < 1500) return;
    openingAssociatedFiles.add(key);
    try {
      if (/^content:\/\//i.test(path)) await resolveAndroidDocumentName(path);
      const name = displayNameForPath(path).toLowerCase();
      if (name.endsWith(".sdplan")) {
        if (await planningSession.load(path)) { setWorkspaceArea("planning"); recentAssociatedFileOpens.set(key, Date.now()); }
      } else if (name.endsWith(".sketch")) {
        await loadFile(path);
        recentAssociatedFileOpens.set(key, Date.now());
      }
    } finally { openingAssociatedFiles.delete(key); }
  }
  async function openAssociatedFiles(paths: string[]) {
    for (const path of paths) await openAssociatedFile(path);
  }
  function resolveAndroidDocumentName(path: string): Promise<string | undefined> {
    if (!isAndroidPlatform() || !/^content:\/\//i.test(path)) return Promise.resolve(undefined);
    const existing = providerDocumentNames()[path];
    if (existing) return Promise.resolve(existing);
    const pending = providerNameRequests.get(path);
    if (pending) return pending;
    const request = invoke<string>("get_sketch_document_display_name", { uri: path }).then(name => {
      const trimmed = name.trim();
      if (!trimmed) return undefined;
      setProviderDocumentNames(names => ({ ...names, [path]: trimmed }));
      return trimmed;
    }).catch(() => undefined).finally(() => providerNameRequests.delete(path));
    providerNameRequests.set(path, request);
    return request;
  }
  createEffect(() => {
    if (!isAndroidPlatform()) return;
    for (const path of recentFiles()) if (/^content:\/\//i.test(path) && !providerDocumentNames()[path]) void resolveAndroidDocumentName(path);
  });
  const fileName = () => activePath() ? displayNameForPath(activePath()!) : "Untitled sketch";
  const currentPage = () => pages().find((page) => page.id === activePageId());
  const currentLayers = () => currentPage()?.layers ?? [];
  const isElementHidden = (item: Element) => item.hidden || layerHidden(currentLayers(), item.layerId);
  const isElementHiddenOnPage = (item: Element, page: SketchPage) => item.hidden || layerHidden(page.layers ?? [], item.layerId);
  function elementsForPagePreview(items: Element[], page: SketchPage, inheritedHidden = false): Element[] {
    return items.map(item => {
      const hidden = inheritedHidden || isElementHiddenOnPage(item, page);
      const copy = { ...item, hidden, layerId: undefined } as Element;
      return item.type === "group" ? { ...copy, elements: elementsForPagePreview(item.elements, page, hidden) } as GroupElement : copy;
    });
  }
  const isElementLocked = (item: Element) => item.locked || layerLocked(currentLayers(), item.layerId);
  const autoRouteContexts = new WeakMap<Element[], { layerVisibilityKey: string; context: AutoRouteContext }>();
  function autoRouteContextFor(items: Element[]) {
    const layerVisibilityKey = currentLayers().map(layer => `${layer.id}:${layer.parentId ?? ""}:${layer.hidden ? 1 : 0}`).join(",");
    const cached = autoRouteContexts.get(items);
    if (cached?.layerVisibilityKey === layerVisibilityKey) return cached.context;
    const context = createAutoRouteContext(items, isElementHidden);
    autoRouteContexts.set(items, { layerVisibilityKey, context });
    return context;
  }
  function updateCurrentLayers(operation: (layers: CanvasLayer[]) => CanvasLayer[]) {
    if (boardLocked() || readOnlyView()) return;
    const id = activePageId(); if (!id) return;
    setPages(items => items.map(page => {
      if (page.id !== id) return page;
      const layers = operation([...(page.layers ?? [])]);
      return { ...page, ...(layers.length ? { layers } : { layers: undefined }) };
    }));
    setDirty(true);
  }
  const theme = (): Theme => themeMode() === "system" ? systemDark() ? "dark" : "light" : themeMode() as Theme;
  const accentForTheme = () => accentColor() === DEFAULT_UI_ACCENT ? "var(--theme-primary)" : accentColor();
  const toolbarColor = () => toolbarColorChoice() === "auto" ? "var(--theme-surface)" : toolbarColorChoice();
  const selectedSet = createMemo(() => new Set(selectedIndices()));
  const selectedElements = () => getSelectedElements(elements(), selectedIndices());
  const selectedDiagramCodeGroup = (): GroupElement | undefined => {
    if (selectedIndices().length !== 1) return undefined;
    const item = elements()[selectedIndices()[0]];
    return item?.type === "group" && item.mermaid ? item : undefined;
  };
  const primarySelection = () => primarySelectionIndex(selectedIndices());
  const selectedRootElement = () => primarySelection() === undefined ? undefined : elements()[primarySelection()!];
  const selectedSchemaTable = () => {
    const selected = selectedRootElement();
    return selected?.type === "schemaTable" ? selected : undefined;
  };
  let wasInDesignWorkspace = workspaceArea() === "design";
  let lastDesignSchemaId = selectedSchemaTable()?.id;
  // Reopen the Design dock on workspace entry and when selecting a different schema card.
  // Reading only the schema ID keeps live edits from undoing an intentional collapse.
  createEffect(() => {
    const inDesignWorkspace = workspaceArea() === "design";
    const schemaId = inDesignWorkspace ? selectedSchemaTable()?.id : undefined;
    if (inDesignWorkspace && (!wasInDesignWorkspace || schemaId && schemaId !== lastDesignSchemaId)) {
      setDesignPanelCollapsed(false);
    }
    wasInDesignWorkspace = inDesignWorkspace;
    lastDesignSchemaId = schemaId;
  });
  // Keep the source editor tied to the selected schema diagram, while syncing source when undo or redo restores it.
  createEffect(() => {
    const selected = selectedSchemaTable();
    const diagramId = selected?.schemaDiagramId;
    const source = selected?.schemaSource ?? "";
    if (diagramId !== activeSchemaPanelDiagramId) {
      activeSchemaPanelDiagramId = diagramId;
      lastAppliedSchemaSource = source;
      schemaLiveUndoDiagramId = undefined;
      schemaLiveUndoBefore = undefined;
      setSchemaPanelDiagramId(diagramId);
      if (selected) { setSchemaInput(source); setSchemaError(""); }
      return;
    }
    if (selected && source !== lastAppliedSchemaSource) {
      lastAppliedSchemaSource = source;
      schemaLiveUndoDiagramId = undefined;
      schemaLiveUndoBefore = undefined;
      setSchemaInput(source);
      setSchemaError("");
    }
  });
  const currentFrameElements = () => elements().filter((item): item is GroupElement => item.type === "group" && item.container?.kind === "frame" && !item.hidden);
  const allFrameExportTargets = () => pages().flatMap(page => page.elements.filter((item): item is GroupElement => item.type === "group" && item.container?.kind === "frame" && !item.hidden).map(frame => ({ frame, page })));
  const selectedFrameElement = () => selectedElements().find((item): item is GroupElement => item.type === "group" && item.container?.kind === "frame");
  function exportItemsForScope(scope = exportScope()): Element[] {
    if (scope === "selection") return selectedElements();
    if (scope === "frame") { const frame = selectedFrameElement(); return frame ? [frame] : []; }
    if (scope === "region") {
      const region = exportMarqueeRegion(); if (!region) return [];
      return elements().filter(item => { const bounds = elementBounds(item); return bounds.x < region.x + region.w && bounds.x + bounds.w > region.x && bounds.y < region.y + region.h && bounds.y + bounds.h > region.y; });
    }
    return elements();
  }
  function exportSceneBounds(items: Element[], scope: ReturnType<typeof exportScope>, view = canvasState(), rect = canvas?.getBoundingClientRect()): Bounds {
    const visibleBounds = (source: Element[]) => source.flatMap(item => visibleElementBounds(item, isElementHidden));
    if (scope === "viewport" && rect) return { x: -view.panX / view.zoom, y: -view.panY / view.zoom, w: rect.width / view.zoom, h: rect.height / view.zoom };
    if (scope === "region") return exportMarqueeRegion() ?? unionBounds(visibleBounds(items)) ?? { x: 0, y: 0, w: 800, h: 600 };
    if (scope === "frame") { const frame = selectedFrameElement(); if (frame) return unionBounds(visibleElementBounds(frame, isElementHidden)) ?? elementBounds(frame); }
    return unionBounds(visibleBounds(items)) ?? { x: 0, y: 0, w: 800, h: 600 };
  }
  function paddedExportBounds(raw: Bounds, scope: ReturnType<typeof exportScope>) {
    const padding = scope === "viewport" || scope === "region" ? 0 : Math.max(0, Math.min(2000, Number(exportPadding()) || 0));
    return { x: raw.x - padding, y: raw.y - padding, w: Math.max(1, raw.w + padding * 2), h: Math.max(1, raw.h + padding * 2) };
  }
  let diagramSourceSelectionId: string | undefined;
  createEffect(() => {
    const group = selectedDiagramCodeGroup();
    if (group?.id === diagramSourceSelectionId) return;
    diagramSourceSelectionId = group?.id;
    setDiagramSourceDraft(group?.mermaid?.source ?? ""); setDiagramSourcePreviewOpen(false); setDiagramSourceMessage("");
  });
  const selectedContainer = (): GroupElement | undefined => { const item = selectedRootElement(); return item?.type === "group" && item.container ? item : undefined; };
  const styleContainerSelection = (): GroupElement | undefined => { const item = selectedIndices().length === 1 && tool() === "select" ? selectedContainer() : undefined; return item && !item.libraryComponent ? item : undefined; };
  const selectedDescendants = () => { const root = selectedRootElement(); return root?.type === "group" ? flatten(root.elements) : []; };
  const selectedLinkedPages = () => selectedDescendants().flatMap(item => {
    if (item.type === "group" && item.libraryComponent) return [];
    const page = item.pageLinkId ? pages().find(candidate => candidate.id === item.pageLinkId) : undefined;
    return page ? [{ item, page }] : [];
  });
  const selectedNestedComponents = () => selectedDescendants().filter((item): item is GroupElement => item.type === "group" && !!item.libraryComponent);
  const elementNavigationLabel = (item: Element) => item.type === "group" ? item.libraryComponent?.label ?? item.note?.title ?? "Group"
    : item.type === "text" ? item.text.trim().slice(0, 60) || "Text"
    : item.type === "schemaTable" ? item.name || "Database table"
    : "label" in item ? item.label?.text?.trim().slice(0, 60) || item.type : item.type;
  const groupSelected = () => isGroupSelection(selectedElements());
  const groupActionEnabled = () => canGroupSelection(selectedElements());
  const focusedElement = (): Element | undefined => { const selected = primarySelection() === undefined ? undefined : elements()[primarySelection()!]; return selected?.type === "group" && (selected.libraryComponent || selected.container || selected.masterId) ? selected : focusedSelectionElement(elements(), selectedIndices()); };
  const connectionPointsFor = (item: Element | undefined): ConnectionPoint[] => item?.type === "group" ? item.connectionPoints ?? item.libraryComponent?.connectionPoints ?? item.container?.connectionPoints ?? [] : item && "connectionPoints" in item ? item.connectionPoints ?? [] : [];
  const connectionTargetSupported = () => { const item = focusedElement(); return !!item && (item.type === "group" && (!!item.libraryComponent || !!item.container || !!item.masterId) || item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "triangle" || item.type === "flowchart" || item.type === "svgPath"); };
  function updateFocusedConnectionPoints(operation: (points: ConnectionPoint[]) => ConnectionPoint[]) {
    if (boardLocked() || readOnlyView()) return;
    const target = focusedElement();
    if (!target || !(target.type === "group" && (target.libraryComponent || target.container || target.masterId) || target.type === "rectangle" || target.type === "circle" || target.type === "diamond" || target.type === "triangle" || target.type === "flowchart" || target.type === "svgPath")) return;
    const knownRelationshipTypes = new Set(RELATIONSHIP_TYPES.map(type => type.value));
    const nextPoints = operation([...connectionPointsFor(target)]).slice(0, 32).map((point, index) => ({ ...point, id: point.id || crypto.randomUUID(), name: point.name.trim().slice(0, 80) || `Port ${index + 1}`, anchor: { x: Math.max(0, Math.min(1, point.anchor.x)), y: Math.max(0, Math.min(1, point.anchor.y)) }, ...(point.accepts?.length ? { accepts: [...new Set(point.accepts.filter(value => knownRelationshipTypes.has(value)))].slice(0, RELATIONSHIP_TYPES.length) } : { accepts: undefined }) }));
    if (target.type === "group" && target.masterId) { updateComponentMaster(target.masterId, master => ({ ...master, connectionPoints: nextPoints })); return; }
    const before = cloneElements(elements());
    const update = (items: Element[]): Element[] => items.map(item => {
      if (item.id === target.id) {
        const next = nextPoints;
        if (item.type === "group" && item.libraryComponent) return { ...item, libraryComponent: { ...item.libraryComponent, connectionPoints: next.length ? next : undefined } };
        if (item.type === "group" && item.container) return { ...item, container: { ...item.container, connectionPoints: next.length ? next : undefined } };
        if (item.type === "group" && item.masterId) return { ...item, connectionPoints: next.length ? next : undefined };
        if (item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "triangle" || item.type === "flowchart" || item.type === "svgPath") return { ...item, connectionPoints: next.length ? next : undefined };
      }
      return item.type === "group" ? { ...item, elements: update(item.elements) } : item;
    });
    const next = update(elements());
    if (JSON.stringify(before) === JSON.stringify(next)) return;
    setElements(next); pushUndo(before); setDirty(true);
  }
  function updateConnectorContract(key: "apiContract" | "dataContract" | "portNumber", value: string) {
    changeSelected(item => {
      if (!isConnector(item)) return item;
      if (key === "portNumber") { const port = Number(value); return { ...item, portNumber: Number.isInteger(port) && port >= 1 && port <= 65535 ? port : undefined }; }
      return { ...item, [key]: value.trim().slice(0, 2000) || undefined } as ShapeElement;
    });
  }
  function runProfileValidation(profile: DiagramLintProfile) { const issues = validateDiagram(elements(), pages().map(page => page.id === activePageId() ? { ...page, elements: elements() } : page), { includeOverlaps: validationIncludeOverlaps(), warnEmptyLabels: validationWarnEmptyLabels() }); setValidationIssues(issuesForProfile(issues, profile)); setValidationProfile(profile); setValidationOpen(true); setCanvasOptionsOpen(false); }
  function runDiagramValidation() { runProfileValidation("all"); }
  const visibleValidationIssues = () => issuesForProfile(validationIssues(), validationProfile());
  function stopBpmnSimulation() {
    if (bpmnSimulationTimer !== undefined) window.clearInterval(bpmnSimulationTimer);
    bpmnSimulationTimer = undefined; setBpmnSimulationIndex(-1); scheduleCanvasRender();
  }
  function openBpmnSimulation() {
    stopBpmnSimulation(); setBpmnContextText(""); setBpmnSimulationSteps(simulateBpmn(elements())); setBpmnSimulationOpen(true); setCanvasOptionsOpen(false);
  }
  function updateBpmnSimulationContext(value: string) {
    stopBpmnSimulation(); setBpmnContextText(value); setBpmnSimulationSteps(simulateBpmn(elements(), parseBpmnContext(value)));
  }
  function playBpmnSimulation() {
    stopBpmnSimulation(); const steps = bpmnSimulationSteps(); if (!steps.length) return;
    let index = 0; setBpmnSimulationIndex(index); scheduleCanvasRender();
    bpmnSimulationTimer = window.setInterval(() => {
      index++;
      if (index >= steps.length) { if (bpmnSimulationTimer !== undefined) window.clearInterval(bpmnSimulationTimer); bpmnSimulationTimer = undefined; setBpmnSimulationIndex(-1); }
      else setBpmnSimulationIndex(index);
      scheduleCanvasRender();
    }, 650);
  }
  function openNamedSnapshots() {
    const path = activePath(); if (!path) return;
    setNamedSnapshots(readNamedDocumentSnapshots(path)); setNamedSnapshotTitle(`Version ${new Date().toLocaleString()}`); setSnapshotComparison([]); setSnapshotVisuals(undefined); setNamedSnapshotsOpen(true);
  }
  function saveNamedSnapshot() {
    const path = activePath(); const name = namedSnapshotTitle().trim(); if (!path || !name) return;
    const record: NamedDocumentSnapshot = { id: crypto.randomUUID(), name: name.slice(0, 80), createdAt: Date.now(), contents: snapshotRaw(documentSnapshot()) };
    try {
      const records = [record, ...readNamedDocumentSnapshots(path)].slice(0, 10);
      writeNamedDocumentSnapshots(path, records); setNamedSnapshots(records); setSnapshotComparison([`Saved “${record.name}” with ${documentSnapshot().pages.length} page${documentSnapshot().pages.length === 1 ? "" : "s"}.`]);
    } catch (cause) { setError(`Could not save this named version in local app storage: ${String(cause)}`); }
  }
  function compareNamedSnapshot(record: NamedDocumentSnapshot) {
    setSnapshotComparison(compareNamedDocumentSnapshot(record.contents, snapshotRaw(documentSnapshot())));
    setSnapshotVisuals({ before: renderNamedSnapshotPreview(record.contents), current: renderNamedSnapshotPreview(snapshotRaw(documentSnapshot())) });
  }
  function renderNamedSnapshotPreview(raw: string): string {
    const file = parseSketchFile(raw); if (!file) return "";
    const page = file.pages.find(candidate => candidate.id === file.activePageId) ?? file.pages[0]; if (!page) return "";
    const width = 480; const height = 260; const output = document.createElement("canvas"); output.width = width; output.height = height;
    const context = output.getContext("2d"); if (!context) return "";
    const bounds = unionBounds(page.elements.filter(item => !item.hidden).map(elementBounds));
    const zoom = bounds ? Math.min((width - 32) / Math.max(1, bounds.w), (height - 32) / Math.max(1, bounds.h), 2) : 1;
    const panX = bounds ? (width - bounds.w * zoom) / 2 - bounds.x * zoom : width / 2;
    const panY = bounds ? (height - bounds.h * zoom) / 2 - bounds.y * zoom : height / 2;
    drawScene(context, width, height, 1, false, false, { ...page.canvasState, zoom, panX, panY }, page.elements, false, false);
    return output.toDataURL("image/png");
  }
  async function exportNamedSnapshots() {
    const path = activePath(); if (!path || !namedSnapshots().length || nativeBusy()) return;
    setNativeBusy(true);
    try {
      const target = await save({ title: "Export portable named versions", defaultPath: `${fileName().replace(/\.sketch$/i, "")}.versions.json`, filters: [{ name: "SketchDraw versions", extensions: ["json"] }] });
      if (!target) return;
      await writeTextFile(target.toLowerCase().endsWith(".json") ? target : `${target}.json`, serializePortableNamedSnapshots(namedSnapshots()));
      setError("");
    } catch (cause) { setError(`Could not export named versions: ${String(cause)}`); }
    finally { setNativeBusy(false); }
  }
  async function importNamedSnapshots() {
    const path = activePath(); if (!path || nativeBusy() || readOnlyView() || boardLocked()) return;
    setNativeBusy(true);
    try {
      const selected = await open({ title: "Import portable named versions", multiple: false, filters: [{ name: "SketchDraw versions", extensions: ["json"] }] });
      if (!selected || Array.isArray(selected)) return;
      const imported = parsePortableNamedSnapshots(await readTextFile(selected)).map(record => ({ ...record, id: crypto.randomUUID() }));
      const next = [...imported, ...namedSnapshots()].slice(0, 10);
      writeNamedDocumentSnapshots(path, next); setNamedSnapshots(next); setSnapshotComparison([]); setSnapshotVisuals(undefined); setError("");
    } catch (cause) { setError(`Could not import named versions: ${cause instanceof Error ? cause.message : String(cause)}`); }
    finally { setNativeBusy(false); }
  }
  function restoreNamedSnapshot(record: NamedDocumentSnapshot) {
    if (readOnlyView() || boardLocked()) return;
    const restored = parseSketchFile(record.contents); if (!restored) { setError("This named version could not be opened."); return; }
    const target = restored.pages.find(page => page.id === restored.activePageId) ?? restored.pages[0]; if (!target) return;
    canvasHistory.clearAll();
    batch(() => {
      setPages(restored.pages); setActivePageId(target.id); setElements(target.elements); setCanvasState({ ...target.canvasState });
      setBoardColor(target.canvasState.backgroundColor); setBoardColorFollowsTheme(target.canvasState.boardColorFollowsTheme ?? false);
      setSelectedIndices([]); setHoveredIndex(undefined); setDirty(true);
    });
    documentSnapshotCoordinator.invalidate(); canvasHistory.resetCurrent(); setNamedSnapshotsOpen(false); setSnapshotComparison([]);
  }
  function deleteNamedSnapshot(record: NamedDocumentSnapshot) {
    const path = activePath(); if (!path) return;
    const records = namedSnapshots().filter(item => item.id !== record.id);
    try { writeNamedDocumentSnapshots(path, records); setNamedSnapshots(records); setSnapshotComparison([]); }
    catch (cause) { setError(`Could not update named versions: ${String(cause)}`); }
  }
  function updateConnectorMetadata(property: "relationshipType" | "cardinality" | "relationshipDirection" | "transportSecurity" | "protocol", value: string | undefined) {
    changeSelected(item => {
      if (!isConnector(item)) return item;
      if (property === "relationshipDirection" && value) {
        const direction = value as RelationshipDirection;
        const { startHead, endHead } = relationshipDirectionHeads(direction);
        return { ...item, relationshipDirection: direction, startHead, endHead, ...(item.forkUpper ? { forkUpper: { ...item.forkUpper, endHead } } : {}), ...(item.forkLower ? { forkLower: { ...item.forkLower, endHead } } : {}) };
      }
      return { ...item, [property]: value || undefined } as ShapeElement;
    });
  }
  function connectorTouchesBpmn(item: Element | undefined) {
    if (!item || !isConnector(item)) return false;
    const ids = new Set([item.startBinding?.elementId, item.endBinding?.elementId].filter((id): id is string => !!id));
    return flatten(elements()).some(target => target.type === "group" && !!target.id && ids.has(target.id) && !!target.libraryComponent?.kind.startsWith("bpmn-"));
  }
  function updateBpmnSequenceField(key: "sequenceCondition" | "sequenceDefault", value: string | boolean) {
    changeSelected(item => isConnector(item) ? { ...item, [key]: key === "sequenceDefault" ? value === true : String(value).trim().slice(0, 500) || undefined } as ShapeElement : item);
  }
  function createComponentDrilldown(componentId?: string) {
    if (boardLocked() || readOnlyView() || pages().length >= 100) return;
    const index = primarySelection(); const selected = index === undefined ? undefined : elements()[index];
    if (!selected) return;
    const candidates = flatten([selected]);
    const target = componentId ? candidates.find((item): item is GroupElement => item.id === componentId && item.type === "group" && !!item.libraryComponent) : selected.type === "group" && selected.libraryComponent ? selected : undefined;
    if (!target || target.locked) return;
    const pageId = crypto.randomUUID(); const before = cloneElements(elements());
    const addLink = (item: Element): Element => {
      if (item.id === target.id) return { ...item, pageLinkId: pageId } as Element;
      return item.type === "group" ? { ...item, elements: item.elements.map(addLink) } : item;
    };
    setElements(items => items.map((item, current) => current === index ? addLink(item) : item));
    pushUndo(before); setDirty(true); storeCurrentPage(); rememberPageHistory();
    const title = target.libraryComponent!.label ?? target.libraryComponent!.kind.replace(/-/g, " ");
    const page: SketchPage = { id: pageId, name: `${title} details`.slice(0, 80), canvasState: emptyCanvas(), elements: [] };
    setPages(items => [...items, page]); setActivePageId(page.id); setElements([]); setCanvasState(emptyCanvas()); setBoardColor("#ffffff"); setBoardColorFollowsTheme(true); setSelectedIndices([]); setDirty(true); canvasHistory.resetCurrent();
  }
  function insertGeneratedLegend() {
    if (boardLocked() || readOnlyView()) return;
    const visible = elements().filter(item => !item.hidden);
    const componentNames = new Map<string, string>(); const relationshipNames = new Set<string>();
    for (const item of flatten(visible)) {
      if (item.type === "group" && item.libraryComponent) {
        const label = item.libraryComponent.label ?? item.libraryComponent.kind.replace(/-/g, " ");
        componentNames.set(item.libraryComponent.kind, label);
      }
      if (isConnector(item)) relationshipNames.add(`${item.relationshipType ? RELATIONSHIP_TYPES.find(type => type.value === item.relationshipType)?.label ?? item.relationshipType : "Connector"}${item.lineStyle && item.lineStyle !== "solid" ? ` (${item.lineStyle})` : ""}`);
    }
    for (const item of visible) {
      if (item.type === "schemaTable") componentNames.set("schemaTable", "Database table");
      else if (item.type === "flowchart") componentNames.set(item.flowchartShape ?? "flowchart", (item.flowchartShape ?? "process").replace(/-/g, " "));
      else if (["rectangle", "circle", "diamond", "triangle"].includes(item.type)) componentNames.set(item.type, item.type[0].toUpperCase() + item.type.slice(1));
    }
    const lines = ["## Components", ...[...componentNames.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([kind, label]) => `- **${label}** (${kind})`)];
    if (relationshipNames.size) lines.push("", "## Relationships", ...[...relationshipNames].sort().map(label => `- ${label}`));
    if (!componentNames.size && !relationshipNames.size) { setError("Add components or connectors before generating a legend."); return; }
    const bounds = unionBounds(visible.map(elementBounds));
    const x = bounds ? bounds.x + bounds.w + 32 : 80; const y = bounds?.y ?? 80;
    const legend = buildNoteGroup(x, y, "note", lines.join("\n"), { width: 280, title: "Diagram legend" });
    const before = cloneElements(elements()); setElements(items => [...items, legend]); pushUndo(before); setSelectedIndices([elements().length - 1]); setDirty(true); setError("");
  }
  function setSelectedPageLink(pageLinkId?: string) {
    if (boardLocked() || readOnlyView()) return;
    const index = primarySelection(); if (index === undefined || !elements()[index]) return;
    const before = cloneElements(elements());
    setElements(items => items.map((item, current) => current !== index ? item : { ...item, pageLinkId } as Element));
    pushUndo(before); setDirty(true);
  }
  function setSelectedPageLinkTransition(pageLinkTransition: PageLinkTransition) {
    if (boardLocked() || readOnlyView()) return;
    const index = primarySelection(); if (index === undefined || !elements()[index]?.pageLinkId) return;
    const before = cloneElements(elements());
    setElements(items => items.map((item, current) => current === index ? { ...item, pageLinkTransition: pageLinkTransition === "instant" ? undefined : pageLinkTransition } as Element : item));
    pushUndo(before); setDirty(true);
  }
  function createLinkedPageFromSelection() {
    if (boardLocked() || readOnlyView() || pages().length >= 100) return;
    const index = primarySelection(); const selected = index === undefined ? undefined : elements()[index];
    if (index === undefined || !selected) return;
    const pageId = crypto.randomUUID();
    const name = `${elementNavigationLabel(selected)} details`.slice(0, 80);
    const before = cloneElements(elements());
    setElements(items => items.map((item, current) => current === index ? { ...item, pageLinkId: pageId } as Element : item));
    pushUndo(before); setDirty(true); storeCurrentPage();
    setPages(items => [...items, { id: pageId, name, canvasState: emptyCanvas(), elements: [] }]);
  }
  function openLinkedPage(pageLinkId?: string, transition: PageLinkTransition = "instant") {
    if (!pageLinkId || pageLinkId === activePageId() || !pages().some(page => page.id === pageLinkId)) return;
    const selectedTransition = transition === "fade" || transition === "slide" ? transition : "instant";
    if (!presentationMode() || selectedTransition === "instant") { switchPage(pageLinkId); return; }
    if (presentationTransitionOutTimer !== undefined) window.clearTimeout(presentationTransitionOutTimer);
    if (presentationTransitionClearTimer !== undefined) window.clearTimeout(presentationTransitionClearTimer);
    setPresentationTransition(selectedTransition);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    presentationTransitionOutTimer = window.setTimeout(() => {
      presentationTransitionOutTimer = undefined;
      switchPage(pageLinkId);
      const hasFrames = currentFrameElements().length > 0;
      setPresentationTarget(hasFrames ? "frames" : "pages");
      if (hasFrames) requestAnimationFrame(() => focusPresentationFrame(0));
    }, reduceMotion ? 0 : 160);
    presentationTransitionClearTimer = window.setTimeout(() => { presentationTransitionClearTimer = undefined; setPresentationTransition(undefined); }, reduceMotion ? 0 : 340);
  }
  function selectValidationIssue(issue: DiagramIssue) {
    if (!issue.elementId) return;
    if (issue.pageId && issue.pageId !== activePageId()) switchPage(issue.pageId);
    const find = (item: Element): Element | undefined => item.id === issue.elementId ? item : item.type === "group" ? item.elements.map(find).find((child): child is Element => !!child) : undefined;
    const index = elements().findIndex(item => !!find(item));
    const target = index >= 0 ? find(elements()[index]) : undefined;
    if (index >= 0) { setSelectedIndices([index]); setTool("select"); setSidebarTab("properties"); setValidationOpen(false); if (target) fitDocumentToViewport([target]); }
  }
  function focusFirstValidationIssue() {
    const current = elements();
    const issues = validateDiagram(current, pages().map(page => page.id === activePageId() ? { ...page, elements: current } : page), { includeOverlaps: validationIncludeOverlaps(), warnEmptyLabels: validationWarnEmptyLabels() });
    setValidationIssues(issues); setValidationProfile("all"); setCanvasOptionsOpen(false);
    const issue = issues.find(candidate => !!candidate.elementId);
    if (issue) selectValidationIssue(issue);
    else {
      setValidationOpen(true);
      if (!issues.length) setError("No diagram validation issues were found.");
      else setError("The validation report has no issue linked to a canvas object.");
    }
  }
  function openObjectSearch() { setObjectSearchQuery(""); setObjectReplaceText(""); setObjectSearchOpen(true); setCanvasOptionsOpen(false); }
  function objectSearchMatches() {
    const query = objectSearchQuery().trim().toLowerCase(); if (!query) return [];
    const textOf = (item: Element): string => {
      const own = item.type === "text" ? item.text : item.type === "schemaTable" ? item.name : item.type === "group" ? [item.libraryComponent?.label, item.note?.title, item.note?.content, item.mermaid ? item.mermaid.format === "plantuml" ? "PlantUML diagram" : "Mermaid diagram" : "", ...item.elements.map(textOf)].filter(Boolean).join(" ") : "label" in item ? item.label?.text ?? "" : item.type === "image" ? item.previewUrl ?? "image" : item.type;
      return `${own} ${item.type === "group" ? item.libraryComponent?.kind ?? "" : ""}`;
    };
    const titleOf = (item: Element) => item.type === "schemaTable" ? item.name : item.type === "group" ? item.libraryComponent?.label ?? item.note?.title ?? (item.mermaid ? item.mermaid.format === "plantuml" ? "PlantUML diagram" : "Mermaid diagram" : "Group") : item.type === "text" ? item.text : "label" in item ? item.label?.text || item.type : item.type;
    return pages().flatMap(page => {
      const items = page.id === activePageId() ? elements() : page.elements;
      return items.flatMap((item, index) => textOf(item).toLowerCase().includes(query) ? [{ pageId: page.id, pageName: page.name, index, item, title: titleOf(item).replace(/\s+/g, " ").slice(0, 100) }] : []);
    }).slice(0, 100);
  }
  function selectObjectSearchResult(result: ObjectSearchResult) {
    if (result.pageId !== activePageId()) switchPage(result.pageId);
    const item = elements()[result.index]; if (!item) return;
    setSelectedIndices([result.index]); setTool("select"); setSidebarTab("properties"); setObjectSearchOpen(false); fitDocumentToViewport([item]);
  }
  function replaceObjectSearchResult(result: ObjectSearchResult) {
    if (boardLocked() || readOnlyView() || !objectSearchQuery().trim()) return;
    if (result.pageId !== activePageId()) switchPage(result.pageId);
    const current = elements(); const target = current[result.index]; if (!target || isElementLocked(target)) return;
    const replaced = replaceElementText(target, objectSearchQuery(), objectReplaceText(), item => !isElementLocked(item));
    if (!replaced.count) return;
    pushUndo(cloneElements(current));
    setElements(items => items.map((item, index) => index === result.index ? replaced.element : item));
    setSelectedIndices([result.index]); setTool("select"); setDirty(true);
  }
  const selectedLabel = () => { const item = focusedElement(); return item && (isLabelShape(item) || isConnector(item)) ? item.label : undefined; };
  const libraryChild = (group: GroupElement | undefined, predicate: (item: Element) => boolean): Element | undefined => {
    if (!group) return undefined;
    for (const item of group.elements) {
      if (predicate(item)) return item;
      if (item.type === "group") { const nested = libraryChild(item, predicate); if (nested) return nested; }
    }
    return undefined;
  };
  const firstElementText = (item: Element | undefined): TextElement | ShapeLabel | undefined => {
    if (!item) return undefined;
    if (item.type === "text") return item.text.trim() ? item : undefined;
    if ((isLabelShape(item) || isConnector(item)) && item.label?.text.trim()) return item.label;
    if (item.type === "group") {
      const child = libraryChild(item, candidate => (candidate.type === "text" && !!candidate.text.trim()) || ((isLabelShape(candidate) || isConnector(candidate)) && !!candidate.label?.text.trim()));
      if (child?.type === "text") return child;
      if (child && (isLabelShape(child) || isConnector(child))) return child.label;
    }
    return undefined;
  };
  const metadataComponentText = (item: Element | undefined): TextElement | undefined => {
    if (item?.type !== "group" || !item.componentBounds || !item.libraryComponent) return undefined;
    const metadata = item.libraryComponent;
    const textValue = [libraryComponentFields(item).find(field => field.value.trim())?.value, metadata.guiProperties?.title, metadata.chartData?.title, metadata.formTitle, metadata.label]
      .find((value): value is string => !!value?.trim())?.trim();
    if (!textValue) return undefined;
    const style = metadata.textStyle;
    return { type: "text", x: 0, y: 0, text: textValue, color: style?.color ?? metadata.styleOverrides?.color ?? (theme() === "dark" ? "#eeeeee" : "#292929"), fontSize: style?.fontSize ?? (metadata.kind.startsWith("form-") || metadata.kind.startsWith("gui-") ? 11 : 12), fontFamily: style?.fontFamily ?? "sans", bold: style?.bold ?? true, italic: style?.italic ?? false, underline: style?.underline ?? false, textAlign: style?.textAlign ?? "left", listType: "none" };
  };
  const selectedText = () => {
    const draft = textDraft();
    if (draft) return draft;
    const ordered = [...selectedIndices()].sort((a, b) => (a === primarySelection() ? -1 : b === primarySelection() ? 1 : 0));
    for (const index of ordered) {
      const item = elements()[index];
      const nested = firstElementText(item);
      if (nested) return nested;
      const metadata = metadataComponentText(item);
      if (metadata) return metadata;
    }
    return undefined;
  };
  const selectedTextValue = () => { const text = selectedText(); return text && "text" in text ? text.text : text && "value" in text ? text.value : ""; };
  const styleTargetElement = () => { const focused = focusedElement(); return tool() === "select" || focused?.type === tool() ? focused : undefined; };
  const hasStyleSelection = () => !!styleTargetElement() && selectedIndices().length > 0;
  const selectedColor = () => { const draft = textDraft(); if (draft) return draft.color; const container = styleContainerSelection(); if (container) return container.container?.borderColor ?? "#667085"; const element = styleTargetElement(); if (element?.type === "group" && element.libraryComponent) { const textElement = libraryChild(element, child => child.type === "text"); if (textElement && "color" in textElement) return textElement.color; return element.libraryComponent.styleOverrides?.color ?? color(); } return element && "color" in element ? element.color : color(); };
  const selectedThickness = () => { if (tool() === "eraser") return eraserSize(); const container = styleContainerSelection(); if (container) return Math.round(container.container?.borderThickness ?? 1.5); const element = styleTargetElement(); const target = element?.type === "group" && element.libraryComponent ? libraryChild(element, child => "thickness" in child) : element; return Math.round(target && "thickness" in target ? target.thickness : thickness()); };
  const selectedOpacity = () => { const element = focusedElement(); return element && "opacity" in element ? element.opacity ?? 1 : 1; };
  const selectedFillColor = () => {
    const element = styleTargetElement();
    if (element?.type === "group" && element.libraryComponent) {
      const override = element.libraryComponent.styleOverrides?.fillColor;
      if (typeof override === "string") return override;
      if (override === null) return undefined;
      const target = libraryChild(element, child => "fillColor" in child && !!child.fillColor);
      return target && "fillColor" in target ? target.fillColor : undefined;
    }
    return element && "fillColor" in element ? element.fillColor : undefined;
  };
  const selectedFillOpacity = () => {
    const element = styleTargetElement();
    if (element?.type === "group" && element.libraryComponent) {
      const override = element.libraryComponent.styleOverrides?.fillOpacity;
      if (override !== undefined) return override;
      const target = libraryChild(element, child => "fillColor" in child && !!child.fillColor);
      return target && "fillOpacity" in target ? target.fillOpacity ?? 1 : 1;
    }
    return element && "fillOpacity" in element ? element.fillOpacity ?? fillOpacity() : fillOpacity();
  };
  const sidebarVisible = () => !!activePath();
  const showStrokeControls = () => { const focused = focusedElement(); return tool() !== "bucket" && (
    tool() === "pen" || tool() === "rectangle" || tool() === "circle" || tool() === "diamond" || tool() === "triangle" || tool() === "flowchart" || tool() === "line" || tool() === "arrow" || (tool() === "text" && textMode() === "text") ||
    !!styleContainerSelection() || (tool() === "select" && !!focused && "color" in focused)
  ); };
  const showThicknessControls = () => { const focused = focusedElement(); return tool() !== "bucket" && tool() !== "text" && (
    tool() === "pen" || tool() === "rectangle" || tool() === "circle" || tool() === "diamond" || tool() === "triangle" || tool() === "flowchart" || tool() === "line" || tool() === "arrow" || tool() === "eraser" ||
    !!styleContainerSelection() || (tool() === "select" && !!focused && "thickness" in focused)
  ); };
  const isPenBrushThicknessTarget = () => tool() === "pen" || (tool() === "select" && focusedElement()?.type === "freehand");
  const quickElementType = () => tool() === "select" ? selectedText() ? "text" : focusedElement()?.type ?? "select" : tool();
  const quickShapeSelection = () => { const focused = focusedElement(); return focused && "thickness" in focused ? focused as ShapeElement : undefined; };
  const quickHasShapeFill = () => !!selectedLibraryComponent() || ["rectangle", "circle", "diamond", "triangle", "flowchart", "svgPath"].includes(quickElementType());
  const quickHasText = () => {
    const target = styleTargetElement();
    if (tool() === "text" && textMode() === "text" || !!textDraft() || !!selectedTextValue().trim()) return true;
    if (target?.type === "schemaTable") return !!target.name.trim() || target.columns.length > 0;
    if (target?.type === "group" && target.libraryComponent) return libraryComponentFields(target).some(field => field.value.trim()) || target.libraryComponent.kind.startsWith("viz-") || target.libraryComponent.kind.startsWith("form-");
    if (target && isLabelShape(target)) return !!target.label?.text.trim() || !!textDraft()?.shapeLabel;
    if (target?.componentId) return true;
    return false;
  };
  // Component selections expose formatting as soon as they contain visible text or a label.
  const designTextStyleAvailable = () => (tool() === "text" && textMode() === "text") || !!textDraft() || selectedIndices().some(index => !!firstElementText(elements()[index]) || !!metadataComponentText(elements()[index]));
  const designParagraphStyleAvailable = () => (tool() === "text" && textMode() === "text") || !!textDraft() || selectedIndices().some(index => !!firstElementText(elements()[index]));
  const selectedNoteCard = () => { const element = primarySelection() === undefined ? undefined : elements()[primarySelection()!]; return element?.type === "group" && element.note ? element : undefined; };
  const selectedLibraryComponent = (): GroupElement | undefined => { const element = primarySelection() === undefined ? undefined : elements()[primarySelection()!]; return element?.type === "group" && element.libraryComponent ? element : undefined; };
  // Definitions live once in the first page's additive metadata and are shared across every document page.
  const activeComponentMasters = () => [...new Map(pages().flatMap(page => page.componentMasters ?? []).map(master => [master.id, master] as const)).values()];
  const componentMasterInstanceCount = (masterId: string) => pages().reduce((total, page) => total + flatten(page.id === activePageId() ? elements() : page.elements).filter(item => item.type === "group" && item.masterId === masterId).length, 0);
  const selectedMasterInstance = (): GroupElement | undefined => { const element = primarySelection() === undefined ? undefined : elements()[primarySelection()!]; return element?.type === "group" && !!element.masterId ? element : undefined; };
  const selectedComponentMaster = () => { const id = selectedMasterInstance()?.masterId; return id ? activeComponentMasters().find(master => master.id === id) : undefined; };
  const selectedParameterizedStencil = (): GroupElement | undefined => { const item = selectedRootElement(); return item?.type === "group" && item.stencilParameters ? item : undefined; };
  function storeComponentMasters(masters: ComponentMaster[]) {
    setPages(items => items.map((page, index) => ({ ...page, componentMasters: index === 0 && masters.length ? masters : undefined })));
  }
  function updateComponentMaster(masterId: string, operation: (master: ComponentMaster) => ComponentMaster) {
    if (boardLocked() || readOnlyView()) return;
    const before = cloneElements(elements());
    const nextMasters = activeComponentMasters().map(master => master.id === masterId ? operation(master) : master);
    if (nextMasters.every((master, index) => master === activeComponentMasters()[index])) return;
    setPages(items => items.map((page, index) => {
      const source = page.id === activePageId() ? elements() : page.elements;
      return { ...page, componentMasters: index === 0 && nextMasters.length ? nextMasters : undefined, elements: resolveBindings(refreshComponentInstances(source, nextMasters)) };
    }));
    setElements(resolveBindings(refreshComponentInstances(elements(), nextMasters)));
    pushUndo(before); setDirty(true);
  }
  function updateMasterDefaultLabel(masterId: string, label: string) {
    updateComponentMaster(masterId, master => setComponentMasterLabel(master, label));
  }
  function updateSelectedMasterFromInstance() {
    const instance = selectedMasterInstance(); const master = selectedComponentMaster();
    if (!instance || !master || boardLocked() || readOnlyView() || instance.locked) return;
    const bounds = instance.componentBounds ?? elementBounds(instance);
    const template = normalizeMasterVariant(instance);
    updateComponentMaster(master.id, current => ({ ...current, template, bounds: { x: 0, y: 0, w: Math.max(25, bounds.w), h: Math.max(25, bounds.h) } }));
  }
  function editSelectedStencilParameter(parameter: string, value: string) {
    const index = primarySelection(); const item = index === undefined ? undefined : elements()[index];
    if (index === undefined || item?.type !== "group" || !item.stencilParameters || boardLocked() || readOnlyView() || item.locked) return;
    const updated = updateStencilParameter(item, parameter, value);
    if (updated === item || JSON.stringify(updated) === JSON.stringify(item)) return;
    const before = cloneElements(elements());
    setElements(items => items.map((current, currentIndex) => currentIndex === index ? updated : current));
    pushUndo(before); setDirty(true);
  }
  function updateInstanceOverride(key: keyof ComponentOverrides, value: ComponentOverrides[keyof ComponentOverrides] | undefined) {
    if (boardLocked() || readOnlyView()) return;
    if (key === "chartData" && value !== undefined && !isLibraryChartData(value)) { setError("Chart data overrides need valid labels, numeric values, and supported chart options."); return; }
    const index = primarySelection(); const instance = index === undefined ? undefined : elements()[index];
    if (index === undefined || instance?.type !== "group" || !instance.masterId || instance.locked) return;
    const before = cloneElements(elements()); const overrides: ComponentOverrides = { ...(instance.componentOverrides ?? {}) };
    if (value === undefined) delete overrides[key];
    else (overrides as Record<string, unknown>)[key] = value;
    setElements(items => items.map((item, current) => current === index && item.type === "group" ? applyInstanceOverrides(item, overrides) : item));
    pushUndo(before); setDirty(true);
  }
  function switchSelectedMasterVariant(variantKey: string) {
    const index = primarySelection(); const instance = index === undefined ? undefined : elements()[index]; const master = selectedComponentMaster();
    if (index === undefined || instance?.type !== "group" || !master || boardLocked() || readOnlyView()) return;
    const key = variantKey || undefined;
    if (key && !master.variants?.[key]) return;
    const before = cloneElements(elements());
    setElements(items => resolveBindings(items.map((item, current) => current === index ? instantiateComponentMaster(master, instance.componentBounds ?? elementBounds(instance), instance.componentOverrides, key, instance.id, instance) : item)));
    pushUndo(before); setDirty(true);
  }
  function saveSelectedMasterVariant() {
    const instance = selectedMasterInstance(); const master = selectedComponentMaster();
    if (!instance || !master || boardLocked() || readOnlyView()) return;
    const key = window.prompt("Variant key (for example state=active)", "state=active")?.trim().slice(0, 80);
    if (!key || !/^[\p{L}\p{N}_.=-]{1,80}$/u.test(key)) return;
    const template = normalizeMasterVariant(instance);
    updateComponentMaster(master.id, current => ({ ...current, variants: { ...current.variants, [key]: template } }));
  }
  function openGuiDesignLibrary() {
    closeTouchMenuBar(); setStencilSearch(""); setStencilCategory("gui"); setStencilMenuOpen(true); setCanvasOptionsOpen(false); closeToolOptions(); scheduleTouchPopoverPlacement();
  }
  function createComponentFromSelection() {
    if (boardLocked() || readOnlyView() || selectedIndices().length === 0) return;
    const name = window.prompt("Name this reusable component", "My component")?.trim().slice(0, 80);
    if (!name) return;
    const indices = [...new Set(selectedIndices())].sort((a, b) => a - b); const selection = indices.map(index => elements()[index]).filter((item): item is Element => !!item);
    const master = createComponentMaster(selection, name); if (!master) return;
    const bounds = unionBounds(selection.map(elementBounds)); if (!bounds) return;
    const instance = instantiateComponentMaster(master, bounds);
    const replacementIds = new Map(flatten(instance.elements).flatMap(item => item.masterElementId && item.id ? [[item.masterElementId, item.id] as const] : []));
    const remapBinding = (binding: Binding | undefined): Binding | undefined => binding && replacementIds.has(binding.elementId) ? { ...binding, elementId: replacementIds.get(binding.elementId)! } : binding;
    const remapConnectorTargets = (item: Element): Element => {
      if (item.type === "group") return { ...item, elements: item.elements.map(remapConnectorTargets) };
      if (!isConnector(item)) return item;
      return { ...item, startBinding: remapBinding(item.startBinding), endBinding: remapBinding(item.endBinding), ...(item.forkUpper ? { forkUpper: { ...item.forkUpper, endBinding: remapBinding(item.forkUpper.endBinding) } } : {}), ...(item.forkLower ? { forkLower: { ...item.forkLower, endBinding: remapBinding(item.forkLower.endBinding) } } : {}) };
    };
    const selected = new Set(indices); const next: Element[] = []; let instanceIndex = -1;
    elements().forEach((item, index) => {
      if (index === indices[0]) { instanceIndex = next.length; next.push(instance); }
      if (!selected.has(index)) next.push(remapConnectorTargets(item));
    });
    const before = cloneElements(elements()); storeComponentMasters([...activeComponentMasters(), master]); setElements(resolveBindings(next)); pushUndo(before); setSelectedIndices([instanceIndex]); setTool("select"); setDirty(true); setStencilMenuOpen(false);
  }
  function insertComponentMaster(master: ComponentMaster) {
    if (boardLocked() || readOnlyView()) return;
    const rect = canvas.getBoundingClientRect(); const view = canvasState(); const x = (rect.width / 2 - view.panX) / view.zoom; const y = (rect.height / 2 - view.panY) / view.zoom;
    const instance = instantiateComponentMaster(master, { x: x - master.bounds.w / 2, y: y - master.bounds.h / 2, w: master.bounds.w, h: master.bounds.h });
    const before = cloneElements(elements()); const index = elements().length; setElements(items => [...items, instance]); pushUndo(before); setSelectedIndices([index]); setTool("select"); setDirty(true);
  }
  function detachSelectedMasterInstance() {
    const index = primarySelection(); const instance = index === undefined ? undefined : elements()[index];
    if (index === undefined || instance?.type !== "group" || !instance.masterId || boardLocked() || readOnlyView()) return;
    const before = cloneElements(elements());
    setElements(items => items.map((item, current) => current === index && item.type === "group" ? { ...item, masterId: undefined, componentOverrides: undefined, variantKey: undefined } : item));
    pushUndo(before); setDirty(true);
  }
  const selectedClassComponentId = (): string | undefined => { const element = focusedElement(); return element?.componentId?.startsWith("uml-class:") ? element.componentId : undefined; };
  const componentEditorTitle = () => {
    const master = selectedComponentMaster(); if (master) return master.name;
    const kind = (libraryComponentDraft() ?? selectedLibraryComponent())?.libraryComponent?.kind;
    return kind ? LIBRARY_COMPONENTS.find(item => item.kind === kind)?.label ?? "Component" : selectedClassComponentId() || classCardDraft()?.componentId ? "UML class" : primarySelection() !== undefined ? "Object details" : "New UML class";
  };
  const notePanelTitle = () => {
    const draft = noteEditor(); const note = draft ?? selectedNoteCard()?.note;
    if (!note) return "Note";
    if (note.kind === "sticky") return "Sticky note";
    if (note.kind === "checklist") return "Checklist";
    if (findMarkdownTableBlock(note.content)) return "Markdown table";
    return note.title?.toLowerCase().includes("markdown") ? "Markdown text" : "Note + code";
  };
  const quickCardFontSize = () => {
    const focused = focusedElement();
    const componentText = focused?.componentId ? elements().find(item => item.componentId === focused.componentId && item.type === "text") : undefined;
    const size = noteEditor()?.fontSize ?? selectedNoteCard()?.note?.fontSize ?? (focused?.type === "schemaTable" ? focused.fontSize ?? 12 : undefined) ?? (componentText?.type === "text" ? componentText.fontSize : undefined) ?? selectedText()?.fontSize ?? defaultFontSize();
    return Math.round(size);
  };
  const quickIsConnector = () => quickElementType() === "line" || quickElementType() === "arrow";
  const quickRouteChoices = () => quickElementType() === "arrow" ? ARROW_ROUTES : LINE_ROUTES;
  const quickCurrentRoute = () => { const focused = styleTargetElement(); if (quickElementType() === "arrow") return focused?.type === "arrow" ? focused.arrowRoute ?? "straight" : arrowRoute(); return focused?.type === "line" ? focused.lineRoute ?? "straight" : lineRoute(); };
  const quickCurrentLineStyle = () => { const container = styleContainerSelection(); if (container) return container.container?.borderStyle ?? (container.container?.kind === "frame" ? "dashed" : "solid"); const focused = styleTargetElement(); return focused && "lineStyle" in focused ? focused.lineStyle ?? "solid" : lineStyle(); };
  const quickFocusedHasLineStyle = () => { const focused = styleTargetElement(); return !!styleContainerSelection() || !!focused && "lineStyle" in focused; };
  const updateQuickLineStyle = (value: StrokeStyle) => { if (styleContainerSelection()) updateSelectedContainer(container => ({ ...container, borderStyle: value })); else if (quickFocusedHasLineStyle()) updateProperty("lineStyle", value); else setLineStyle(value); };
  const quickArrowHead = (end: "start" | "end") => { const focused = styleTargetElement(); if (focused && isConnector(focused)) return (end === "start" ? focused.startHead : focused.endHead) ?? (focused.type === "arrow" && end === "end" ? "open" : "none"); if (tool() === "line") return end === "start" ? defaultLineStartHead() : defaultLineEndHead(); return end === "start" ? defaultStartHead() : defaultEndHead(); };
  const renderedBoardColor = () => boardColorFollowsTheme() ? theme() === "dark" ? "#17191f" : "#ffffff" : boardColor();
  createEffect(() => { if (boardColorFollowsTheme()) { theme(); advanceDocumentRevision(); } });
  const updateStrokeColor = (value: string) => { const selected = styleTargetElement(); if (boardLocked() || selected?.locked) return; if (textDraft()?.shapeLabel) { updateLabel("color", value); return; } setColor(value); setTextDraft((draft) => draft ? { ...draft, color: value } : undefined); if (styleContainerSelection()) updateSelectedContainer(container => ({ ...container, borderColor: value })); else if (hasStyleSelection()) updateProperty("color", value); };
  const updateThickness = (value: number) => { const bounded = Math.max(1, Math.min(24, Math.round(value))); if (tool() === "eraser") { setEraserSize(ERASER_SIZE_PRESETS.some(([size]) => size === bounded) ? bounded : 2); return; } setThickness(bounded); if (styleContainerSelection()) updateSelectedContainer(container => ({ ...container, borderThickness: bounded })); else if (hasStyleSelection()) updateProperty("thickness", bounded); };
  const setThicknessPickerPreference = (mode: "presets" | "stepper") => { setThicknessPickerMode(mode); try { localStorage.setItem("sketchdraw-thickness-picker", mode); } catch { /* The setting still applies for this session. */ } };
  const status = () => !activePath() ? "No file selected" : readOnlyView() ? "View only · changes are not saved" : documentControllerStatus() === "opening" ? "Opening sketch…" : (saving() || documentControllerStatus() === "saving") ? "Saving…" : (dirty() || textDraft()) ? "Unsaved changes" : savedAt() ? `Saved ${savedAt()}` : "Saved locally";
  const documentSnapshotCoordinator = createDocumentSnapshotCoordinator({
    readDocument: () => ({
      pages: pages(), activePageId: activePageId(), activeElements: elements(), activeCanvasState: canvasState(),
      activeRenderedBoardColor: renderedBoardColor(), theme: theme(), library: legacyLibraryData(),
    }),
    activePath,
    revision: documentRevision,
    windowsSyncMetadata,
    setWindowsSyncMetadata,
  });
  const documentSnapshot = () => documentSnapshotCoordinator.snapshot();
  const snapshotRaw = serializeSketchSnapshot;
  createEffect(() => {
    const path = activePath();
    pages(); activePageId(); elements(); canvasState(); renderedBoardColor(); theme(); legacyLibraryData(); windowsSyncMetadata();
    if (syncObservationTimer !== undefined) window.clearTimeout(syncObservationTimer);
    syncObservationTimer = undefined;
    if (!path || !pages().length || !activePageId()) return;
    const observeWhenIdle = () => {
      if (activePath() !== path) return;
      if (drawing || panOrigin || moveOrigin || resizeOrigin || labelMoveOrigin) { syncObservationTimer = window.setTimeout(observeWhenIdle, 250); return; }
      syncObservationTimer = undefined;
      documentSnapshotCoordinator.observeCurrent();
    };
    syncObservationTimer = window.setTimeout(observeWhenIdle, 250);
  });
  function storeCurrentPage() {
    const id = activePageId();
    if (!id) return;
    setPages((items) => items.map((page) => page.id === id ? { ...page, elements: elements(), canvasState: { ...canvasState(), backgroundColor: renderedBoardColor(), boardColorFollowsTheme: boardColorFollowsTheme() } } : page));
  }
  function switchPage(id: string) {
    if (id === activePageId()) return;
    const target = pages().find((page) => page.id === id);
    if (!target) return;
    commitTextDraft(); rememberPageHistory(); storeCurrentPage();
    setElements(target.elements); setCanvasState({ ...target.canvasState }); setBoardColor(target.canvasState.backgroundColor); setBoardColorFollowsTheme(target.canvasState.boardColorFollowsTheme ?? false);
    setActivePageId(id); setSelectedIndices([]); setHoveredIndex(undefined); setTextDraft(undefined); setMarquee(undefined);
    restorePageHistory(); setDirty(!readOnlyView());
  }
  function addPage() {
    if (boardLocked()) return;
    if (pages().length >= 100) { setError("A sketch can contain up to 100 pages."); return; }
    commitTextDraft(); storeCurrentPage(); rememberPageHistory();
    const number = pages().length + 1; const page: SketchPage = { id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: `Page ${number}`, canvasState: emptyCanvas(), elements: [] };
    setPages((items) => [...items, page]); setActivePageId(page.id); setElements([]); setCanvasState(emptyCanvas()); setBoardColor("#ffffff"); setBoardColorFollowsTheme(true); setSelectedIndices([]); setDirty(true);
    canvasHistory.resetCurrent();
  }
  function deleteCurrentPage() {
    if (boardLocked() || pages().length <= 1) return;
    const masters = activeComponentMasters(); const nextPages = pages().filter((page) => page.id !== activePageId());
    if (masters.length) nextPages[0] = { ...nextPages[0], componentMasters: masters };
    const target = nextPages[Math.max(0, pages().findIndex((page) => page.id === activePageId()) - 1)] ?? nextPages[0];
    setPages(nextPages); setActivePageId(target.id); setElements(target.elements); setCanvasState({ ...target.canvasState }); setBoardColor(target.canvasState.backgroundColor); setBoardColorFollowsTheme(target.canvasState.boardColorFollowsTheme ?? false); setSelectedIndices([]); setTextDraft(undefined); setHoveredIndex(undefined); setMarquee(undefined); restorePageHistory(); setDirty(true);
  }
  const canUndo = () => { historyVersion(); return canvasHistory.canUndo(); };
  const canRedo = () => { historyVersion(); return canvasHistory.canRedo(); };
  const toWorld = (event: PointerEvent): Point => pointerToWorld(event.clientX, event.clientY, canvas.getBoundingClientRect(), canvasState());
  const strokePointFromPointer = (event: PointerEvent, point: Point): StrokePoint => makeStrokePoint(event, point, penPressure(), penTilt());
  function appendStrokePoint(point: StrokePoint) {
    const simplifyInk = activeDrawingTool === "pen" && tool() === "pen";
    if (simplifyInk) {
      // Keep the maximum geometric error below a quarter screen pixel at the
      // capture zoom, while retaining bends and pressure/tilt transitions.
      const pixelTolerance = .25 / Math.max(.01, canvasState().zoom);
      const strokeThickness = Math.max(1, preview()?.thickness ?? thickness());
      const pressureTolerance = Math.min(.035, pixelTolerance / (strokeThickness * 1.15));
      appendSimplifiedStrokePoint(currentPoints, point, pixelTolerance, pressureTolerance, 1.25 / Math.max(.01, canvasState().zoom));
    } else currentPoints.push(point);
    if (currentPoints.length > MAX_STROKE_POINTS) {
      currentPoints.pop();
      if (!strokePointLimitReached) setError(`A stroke reached the ${MAX_STROKE_POINTS.toLocaleString()}-point limit. Its captured section was kept.`);
      strokePointLimitReached = true;
      return false;
    }
    currentPointsRevision++;
    return true;
  }
  function appendAndroidStylusSamples(samples: AndroidStylusSample[]) {
    if (!canvas || !samples.length || !drawing || activeDrawingTool !== "pen" || activePenPointerId === undefined) return;
    const bounds = canvas.getBoundingClientRect(); const state = canvasState(); let appended = false;
    for (const sample of samples) {
      if (!Number.isFinite(sample.clientX) || !Number.isFinite(sample.clientY)) continue;
      if (!strokeSampleGate.accept("native", sample.time)) continue;
      const point = pointerToWorld(sample.clientX, sample.clientY, bounds, state);
      const previous = currentPoints[currentPoints.length - 1];
      if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) * state.zoom < .01) continue;
      if (!appendStrokePoint({
        ...point,
        ...(penPressure() ? { pressure: sample.phase === "end" && sample.pressure <= 0 ? previous?.pressure ?? .5 : Math.max(0, Math.min(1, sample.pressure)) } : {}),
        ...(penTilt() ? { tiltX: Math.max(-90, Math.min(90, sample.tiltX)), tiltY: Math.max(-90, Math.min(90, sample.tiltY)), orientation: ((sample.orientation % 360) + 360) % 360 } : {}),
      })) break;
      appended = true;
    }
    if (appended) canvasRenderScheduler.schedulePreview();
  }
  function receiveAndroidStylusSamples(samples: AndroidStylusSample[]) {
    if (!isAndroidPlatform() || !Array.isArray(samples) || !samples.length || !activePath() || !isCanvasWorkspace() || tool() !== "pen") return;
    if (drawing && activePenPointerId !== undefined && activeDrawingTool === "pen") {
      appendAndroidStylusSamples(samples);
      return;
    }
    if (samples.some(sample => sample.phase === "end")) pendingAndroidStylusSamples = [];
    else if (samples.some(sample => sample.phase === "start")) pendingAndroidStylusSamples = samples.slice(-12);
  }
  const snap = (point: Point): Point => snapCanvasPoint(point, snapToGrid(), whiteboardStyle(), GRID_SIZE);
  const toggleMeasureMode = () => { const enabled = !measureMode(); setMeasureMode(enabled); if (!enabled) { measureOrigin = undefined; setMeasurement(undefined); } };
  function editPathNode(original: Element, nodeIndex: number, world: Point): Element {
    if (original.type === "freehand") return { ...original, points: original.points.map((point, index) => index === nodeIndex ? { ...point, x: world.x, y: world.y } : point) };
    if (original.type !== "svgPath") return original;
    const parsed = parseEditablePath(original.pathData); if (!parsed || nodeIndex < 0 || nodeIndex >= parsed.points.length) return original;
    const bounds = elementBounds(original); const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
    const localWorld = rotateCanvasPoint(world, center, -(original.rotation ?? 0));
    const pathWidth = Math.max(0.001, original.pathWidth ?? original.w); const pathHeight = Math.max(0.001, original.pathHeight ?? original.h);
    const nodes = parsed.points.map(point => ({ ...point }));
    nodes[nodeIndex] = { x: (localWorld.x - original.x) / original.w * pathWidth, y: (localWorld.y - original.y) / original.h * pathHeight };
    return updateEditablePath(original, nodes);
  }
  function beginPathNodeEdit(nodeIndex: number, event: PointerEvent) {
    if (boardLocked() || readOnlyView() || selectedIndices().length !== 1) return;
    const index = selectedIndices()[0]; const original = elements()[index];
    if (!original || !(original.type === "freehand" || original.type === "svgPath")) return;
    event.currentTarget instanceof SVGElement && event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    setSelectedPathNodeIndex(nodeIndex);
    pathNodeOrigin = { index, nodeIndex, before: cloneElements(elements()), original, moved: false };
  }
  function moveEditedPathNode(event: PointerEvent) {
    const origin = pathNodeOrigin; if (!origin) return;
    const point = toWorld(event);
    if (Math.hypot(point.x - pathNodeWorld(origin.original, origin.nodeIndex).x, point.y - pathNodeWorld(origin.original, origin.nodeIndex).y) > 0.25) origin.moved = true;
    if (!origin.moved) return;
    const edited = editPathNode(origin.original, origin.nodeIndex, point);
    setElementsTransient(origin.before.map((element, index) => index === origin.index ? edited : element), [origin.index]); setDirty(true);
  }
  function pathNodeWorld(element: Element, nodeIndex: number): Point {
    if (element.type === "freehand") return element.points[nodeIndex] ?? { x: 0, y: 0 };
    if (element.type !== "svgPath") return { x: 0, y: 0 };
    const parsed = parseEditablePath(element.pathData); const point = parsed?.points[nodeIndex]; if (!point) return { x: 0, y: 0 };
    const world = { x: element.x + point.x / Math.max(0.001, element.pathWidth ?? element.w) * element.w, y: element.y + point.y / Math.max(0.001, element.pathHeight ?? element.h) * element.h };
    const bounds = elementBounds(element); return rotateCanvasPoint(world, { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }, element.rotation ?? 0);
  }
  function finishPathNodeEdit() {
    const origin = pathNodeOrigin; if (!origin) return;
    if (origin.moved) { setElements(elements()); pushUndo(origin.before); }
    pathNodeOrigin = undefined;
  }
  function cancelPathNodeEdit() {
    const origin = pathNodeOrigin; if (!origin) return;
    if (origin.moved) setElements(origin.before);
    pathNodeOrigin = undefined;
  }
  function deleteSelectedPathNode() {
    const nodeIndex = selectedPathNodeIndex(); const index = selectedIndices().length === 1 ? selectedIndices()[0] : undefined;
    if (nodeIndex === undefined || index === undefined || boardLocked()) return;
    const item = elements()[index]; if (!item || !(item.type === "freehand" || item.type === "svgPath")) return;
    const before = cloneElements(elements());
    let updated: Element = item;
    if (item.type === "freehand" && item.points.length > 2) updated = { ...item, points: item.points.filter((_point, current) => current !== nodeIndex) };
    else if (item.type === "svgPath") {
      const parsed = parseEditablePath(item.pathData); const minimum = parsed?.closed ? 3 : 2;
      if (parsed && parsed.points.length > minimum) updated = updateEditablePath(item, parsed.points.filter((_point, current) => current !== nodeIndex));
    }
    if (updated === item) return;
    setElements(items => items.map((element, current) => current === index ? updated : element)); pushUndo(before); setDirty(true); setSelectedPathNodeIndex(undefined);
  }
  function convertSelectedStrokeToRectangle() {
    const index = selectedIndices().length === 1 ? selectedIndices()[0] : undefined;
    const item = index === undefined ? undefined : elements()[index];
    if (index === undefined || item?.type !== "freehand" || boardLocked() || item.locked) return;
    const recognized = recognizeStroke(item); if (!recognized) return;
    const convertedData: Record<string, unknown> = {
      ...item,
      type: recognized.type,
      ...recognized.bounds,
      ...(recognized.start && recognized.end ? { x: recognized.start.x, y: recognized.start.y, w: recognized.end.x - recognized.start.x, h: recognized.end.y - recognized.start.y } : {}),
      lineStyle: "solid", edgeStyle: "sharp", rotation: 0,
      ...(recognized.type === "arrow" ? { arrowRoute: "straight", startHead: "none", endHead: "open" } : {}),
    };
    delete convertedData.points;
    const converted = convertedData as unknown as ShapeElement;
    const before = cloneElements(elements()); setElements(items => items.map((element, current) => current === index ? converted : element)); pushUndo(before); setDirty(true);
  }
  const undo = canvasHistory.undo;
  const redo = canvasHistory.redo;
  function deleteSelected() {
    if (boardLocked()) return;
    const indices = selectedIndices().filter((index) => { const element = elements()[index]; return !!element && canMoveElement(element); });
    if (!indices.length) return;
    const before = cloneElements(elements());
    const selected = new Set(indices);
    const removed = [...selected].sort((a, b) => a - b);
    setElements((items) => items.filter((_, itemIndex) => !selected.has(itemIndex)));
    pushUndo(before); setSelectedIndices((current) => current.filter((index) => !selected.has(index)).map((index) => index - removed.filter((deleted) => deleted < index).length)); setDirty(true);
  }
  const deletableSelectionCount = () => countDeletableSelection(elements(), selectedIndices(), canMoveElement);

  function groupSelection() {
    if (boardLocked()) return;
    const indices = [...new Set(selectedIndices())].filter((index) => !!elements()[index] && canMoveElement(elements()[index])).sort((a, b) => a - b);
    const onlySelected = indices.length === 1 ? elements()[indices[0]] : undefined;
    if (onlySelected?.type === "group" && !onlySelected.note) { ungroupSelection(); return; }
    if (indices.length < 2) return;
    const before = cloneElements(elements()); const selected = new Set(indices); const first = indices[0];
    const children = indices.map((index) => elements()[index]); const grouped: Element[] = [];
    const content = unionBounds(children.map(elementBounds));
    // Keep the invisible group bounds close to its contents so grouping does not add a large blank frame.
    const groupInset = 3;
    elements().forEach((element, index) => { if (index === first) grouped.push({ type: "group", id: crypto.randomUUID(), elements: children, ...(content ? { componentBounds: { x: content.x - groupInset, y: content.y - groupInset, w: content.w + groupInset * 2, h: content.h + groupInset * 2 } } : {}), container: { kind: "container", name: "Group", showBorder: false, showLabel: false, clipChildren: false, autoResize: false, padding: groupInset } }); if (!selected.has(index)) grouped.push(element); });
    setElements(grouped); pushUndo(before); setSelectedIndices([first]); setDirty(true);
  }

  function createFrameFromSelection() {
    if (boardLocked() || readOnlyView()) return;
    const indices = [...new Set(selectedIndices())].filter(index => !!elements()[index] && canMoveElement(elements()[index])).sort((a, b) => a - b);
    if (!indices.length) return;
    const children = indices.map(index => elements()[index]); const content = unionBounds(children.map(elementBounds)); if (!content) return;
    const name = window.prompt("Name this frame", `Frame ${elements().filter(item => item.type === "group" && item.container?.kind === "frame").length + 1}`)?.trim().slice(0, 120);
    if (!name) return;
    const padding = 24; const frame: GroupElement = { type: "group", id: crypto.randomUUID(), elements: children, componentBounds: { x: content.x - padding, y: content.y - padding, w: Math.max(160, content.w + padding * 2), h: Math.max(100, content.h + padding * 2) }, container: { kind: "frame", name, clipChildren: false, autoResize: false, padding } };
    const before = cloneElements(elements()); const selected = new Set(indices); const first = indices[0];
    const next = elements().flatMap((item, index) => index === first ? [frame] : selected.has(index) ? [] : [item]);
    setElements(next); pushUndo(before); setSelectedIndices([first]); setDirty(true);
  }

  function updateSelectedContainer(operation: (container: ContainerMetadata) => ContainerMetadata) {
    const item = selectedRootElement(); if (!item || item.type !== "group" || !item.container || boardLocked() || readOnlyView() || isElementLocked(item)) return;
    const before = cloneElements(elements());
    setElements(items => items.map(candidate => candidate.id === item.id ? { ...candidate, container: operation({ ...item.container! }) } : candidate));
    pushUndo(before); setDirty(true);
  }

  function fitSelectedContainer() {
    const item = selectedRootElement(); if (!item || item.type !== "group" || !item.container || boardLocked() || readOnlyView()) return;
    const before = cloneElements(elements()); const next = fitContainerToContent(item);
    if (next === item || JSON.stringify(next.componentBounds) === JSON.stringify(item.componentBounds)) return;
    setElements(items => items.map(candidate => candidate.id === item.id ? next : candidate)); pushUndo(before); setDirty(true);
  }

  function reorderSelectedFrame(delta: number) {
    const item = selectedRootElement(); const index = primarySelection();
    if (!item || item.type !== "group" || item.container?.kind !== "frame" || index === undefined || boardLocked() || readOnlyView()) return;
    const target = Math.max(0, Math.min(elements().length - 1, index + delta)); if (target === index) return;
    const before = cloneElements(elements()); const next = [...elements()]; next.splice(index, 1); next.splice(target, 0, item);
    setElements(next); pushUndo(before); setSelectedIndices([target]); setDirty(true);
  }

  function moveSelectionIntoSelectedContainer() {
    const target = selectedRootElement(); if (!target || target.type !== "group" || (!target.container && !target.libraryComponent) || boardLocked() || readOnlyView()) return;
    const targetId = target.id; const sources = selectedIndices().map(index => elements()[index]).filter((item): item is Element => !!item && item.id !== targetId && canMoveElement(item));
    if (!sources.length || !targetId) return;
    const before = cloneElements(elements()); const next = moveElementsIntoContainer(elements(), sources.flatMap(item => item.id ? [item.id] : []), targetId);
    if (next === elements()) return;
    setElements(next); pushUndo(before); const index = next.findIndex(item => item.id === targetId); setSelectedIndices(index >= 0 ? [index] : []); setDirty(true);
  }

  function removeSelectedContainer() {
    const item = selectedRootElement(); if (!item || item.type !== "group" || !item.container || boardLocked() || readOnlyView()) return;
    const before = cloneElements(elements()); const next = removeContainer(elements(), item.id ?? "");
    if (next === elements()) return;
    setElements(next); pushUndo(before); setSelectedIndices([]); setDirty(true);
  }

  function selectConnectedObjects() { if (selectedIndices().length) setSelectedIndices(selectConnectedIndices(elements(), selectedIndices()).filter(index => { const item = elements()[index]; return !!item && !isElementHidden(item) && !isElementLocked(item); })); }
  function selectSimilarObjects() { if (selectedIndices().length) setSelectedIndices(selectSimilarIndices(elements(), selectedIndices()).filter(index => { const item = elements()[index]; return !!item && !isElementHidden(item) && !isElementLocked(item); })); }
  function orthogonalizeSelectedConnectors() {
    if (boardLocked() || readOnlyView()) return;
    const selected = new Set(selectedIndices()); if (!selected.size) return;
    const before = cloneElements(elements());
    const clean = (item: Element): Element => {
      if (isElementLocked(item)) return item;
      if (item.type === "group") return { ...item, elements: item.elements.map(clean) };
      if (!isConnector(item)) return item;
      return { ...item, lineRoute: item.type === "line" ? "elbow" : undefined, arrowRoute: item.type === "arrow" ? "elbow" : undefined, autoRoute: undefined, routePoints: undefined, routeWaypoints: undefined };
    };
    const next = elements().map((item, index) => selected.has(index) ? clean(item) : item);
    if (JSON.stringify(before) === JSON.stringify(next)) return;
    setElements(next); pushUndo(before); setDirty(true);
  }

  function ungroupSelection() {
    if (boardLocked()) return;
    const indices = new Set(selectedIndices().filter(index => { const item = elements()[index]; return !!item && canMoveElement(item) && !(item.type === "group" && item.note); })); if (!indices.size) return;
    const before = cloneElements(elements()); const next: Element[] = []; const selectedAfter: number[] = []; let changed = false;
    elements().forEach((element, index) => {
      if (indices.has(index) && element.type === "group" && !element.note && canMoveElement(element)) {
        const restored = restoreDirectLibraryComponent(element);
        if (!element.elements.length && !restored) { next.push(element); return; }
        changed = true;
        const expanded = restored ?? [element];
        const children = restored
          ? expanded.flatMap(item => item.type === "group" && !item.componentBounds ? item.elements : [item])
          : element.elements;
        const start = next.length; next.push(...children);
        for (let offset = 0; offset < children.length; offset++) selectedAfter.push(start + offset);
      } else next.push(element);
    });
    if (!changed) return;
    setElements(next); pushUndo(before); setSelectedIndices(selectedAfter); setDirty(true);
  }

  function saveSelectionAsStencil() {
    if (boardLocked() || !selectedElements().length) return;
    const name = window.prompt("Name this stencil", "My component")?.trim().slice(0, 80);
    if (!name) return;
    const tags = (window.prompt("Tags, separated by commas (optional)", "") ?? "").split(",").map(tag => tag.trim().toLowerCase()).filter(Boolean).slice(0, 12);
    const folder = (window.prompt("Folder (optional)", "") ?? "").trim().replace(/[\\/]+/g, " / ").slice(0, 80);
    const parameters = [...new Set((window.prompt("Optional fields, separated by commas. Use {{Field}} in object labels and text.", "") ?? "").split(",").map(value => value.trim().slice(0, 40)).filter(value => /^[\p{L}\p{N}_ -]{1,40}$/u.test(value)))].slice(0, 12);
    const source = copyElements(selectedElements(), 0, 0);
    const bounds = unionBounds(source.map(elementBounds));
    if (!bounds || !source.length) return;
    const normalized = source.map(item => moveElement(item, -bounds.x, -bounds.y));
    const next = [...customStencils().filter(item => item.name.toLowerCase() !== name.toLowerCase()), { id: crypto.randomUUID(), name, elements: normalized, tags, preview: stencilPreviewText(normalized), ...(folder ? { folder } : {}), ...(parameters.length ? { parameters } : {}) }];
    if (!writeCustomStencils(next)) { setError("Could not save this stencil. The local stencil library is full or unavailable."); return; }
    setCustomStencils(next); setError("");
  }

  function insertCustomStencil(stencil: CustomStencil) {
    if (boardLocked()) return;
    try {
      const values = new Map<string, string>();
      for (const parameter of stencil.parameters ?? []) {
        const value = window.prompt(`${parameter}`, "");
        if (value === null) return;
        values.set(parameter.toLowerCase(), value.slice(0, 500));
      }
      const parameterNames = stencil.parameters ?? [];
      const parameterValues = Object.fromEntries(values);
      const children = substituteStencilParameters(stencil.elements, parameterNames, parameterValues);
      const bounds = unionBounds(children.map(elementBounds)); if (!bounds) return;
      const component: GroupElement = { type: "group", id: crypto.randomUUID(), elements: children, componentBounds: bounds, stencilParameters: { template: stencil.elements, parameters: parameterNames, values: parameterValues } };
      placeImportedElements([component]); rememberRecentStencil(stencil.id); setRecentStencils(readRecentStencils()); setStencilMenuOpen(false); setError("");
    }
    catch (cause) { setError(`Could not add stencil: ${cause instanceof Error ? cause.message : String(cause)}`); }
  }

  function removeCustomStencil(id: string) {
    const next = customStencils().filter(item => item.id !== id);
    if (writeCustomStencils(next)) setCustomStencils(next);
    else setError("Could not update the local stencil library.");
  }

  function toggleStencilFavorite(id: string) {
    const next = stencilFavorites().includes(id) ? stencilFavorites().filter(value => value !== id) : [id, ...stencilFavorites()];
    setStencilFavorites(next); writeStencilFavorites(next);
  }

  async function importStencilLibraryFile() {
    if (nativeBusy() || documentBusy()) return;
    setNativeBusy(true);
    try {
      const selected = await open({ title: "Import portable stencil library", multiple: false, filters: [{ name: "SketchDraw stencil library", extensions: ["sdlibrary.json", "json"] }] });
      if (!selected || Array.isArray(selected)) return;
      const portable = parsePortableStencilLibrary(await readTextFile(selected));
      const importedMasters = (portable.masters ?? []).map(master => ({ ...master, id: crypto.randomUUID() }));
      const masterIdMap = new Map((portable.masters ?? []).map((master, index) => [master.id, importedMasters[index].id] as const));
      const availableMasterIds = new Set([...activeComponentMasters().map(master => master.id), ...importedMasters.map(master => master.id)]);
      const remapNestedMasters = (items: Element[]): Element[] => items.map(item => item.type === "group"
        ? { ...item, ...(item.masterId && masterIdMap.has(item.masterId) ? { masterId: masterIdMap.get(item.masterId) } : item.masterId && !availableMasterIds.has(item.masterId) ? { masterId: undefined, componentOverrides: undefined, variantKey: undefined } : {}), elements: remapNestedMasters(item.elements), ...(item.stencilParameters ? { stencilParameters: { ...item.stencilParameters, template: remapNestedMasters(item.stencilParameters.template) } } : {}) }
        : item);
      for (let index = 0; index < importedMasters.length; index++) {
        const master = importedMasters[index];
        importedMasters[index] = { ...master, template: remapNestedMasters(master.template), ...(master.variants ? { variants: Object.fromEntries(Object.entries(master.variants).map(([key, items]) => [key, remapNestedMasters(items)])) } : {}) };
      }
      const imported = portable.stencils.map(stencil => ({ ...stencil, id: crypto.randomUUID(), elements: remapNestedMasters(stencil.elements) }));
      const byName = new Map(customStencils().map(stencil => [stencil.name.toLowerCase(), stencil]));
      for (const stencil of imported) byName.set(stencil.name.toLowerCase(), stencil);
      const next = [...byName.values()].slice(0, 40);
      if (!writeCustomStencils(next)) throw new Error("The imported library exceeds local storage limits.");
      if (importedMasters.length) { storeComponentMasters([...activeComponentMasters(), ...importedMasters].slice(0, 100)); setDirty(true); }
      setCustomStencils(next); setError("");
    } catch (cause) { setError(`Could not import stencil library: ${cause instanceof Error ? cause.message : String(cause)}`); }
    finally { setNativeBusy(false); }
  }

  async function exportStencilLibraryFile() {
    if (nativeBusy() || documentBusy() || !customStencils().length && !activeComponentMasters().length) return;
    setNativeBusy(true);
    try {
      const selected = await save({ title: "Export portable stencil library", defaultPath: "SketchDraw.sdlibrary.json", filters: [{ name: "SketchDraw stencil library", extensions: ["json"] }] });
      if (!selected) return;
      const target = selected.toLowerCase().endsWith(".json") ? selected : `${selected}.sdlibrary.json`;
      await writeTextFile(target, exportPortableStencilLibrary(customStencils(), activeComponentMasters())); setError("");
    } catch (cause) { setError(`Could not export stencil library: ${cause instanceof Error ? cause.message : String(cause)}`); }
    finally { setNativeBusy(false); }
  }

  function updateProperty(property: "color" | "textColor" | "thickness" | "opacity" | "fontSize" | "fontFamily" | "fillColor" | "fillOpacity" | "bold" | "italic" | "underline" | "textAlign" | "listType" | "lineStyle" | "lineRoute" | "arrowRoute" | "flowchartShape" | "edgeStyle" | "cornerRadius" | "startHead" | "endHead" | "forkUpperHead" | "forkLowerHead" | "pathData" | "fillRule" | "svgNonScalingStroke", value: string | number | boolean | undefined) {
    if (boardLocked()) return;
    if (orthogonalConnectors() && (property === "lineRoute" || property === "arrowRoute")) return;
    if (property === "pathData" && (typeof value !== "string" || !value.trim() || value.length > 500_000 || !/^[\d\s.,+\-eEmlhvcsqtazMLHVCSQTAZ]+$/.test(value))) return;
    if (property === "fontSize") {
      if (!Number.isFinite(Number(value)) || Number(value) < 8 || Number(value) > 160) return;
      rememberFontSize(Number(value));
    }
    const indices = new Set(selectedIndices().filter((index) => !!elements()[index] && canMoveElement(elements()[index]))); if (!indices.size) return;
    const before = cloneElements(elements());
    const update = (element: Element): Element => {
      if (isElementLocked(element)) return element;
      if (element.type === "group") {
        if (!element.libraryComponent) return { ...element, elements: element.elements.map(update) };
        const styleOverrides = { ...element.libraryComponent.styleOverrides };
        if (property === "color") styleOverrides.color = String(value);
        if (property === "fillColor") styleOverrides.fillColor = value ? String(value) : null;
        if (property === "fillOpacity") styleOverrides.fillOpacity = Number(value);
        const textStyle = { ...element.libraryComponent.textStyle };
        if (property === "textColor") textStyle.color = String(value);
        if (property === "fontSize") textStyle.fontSize = Math.max(8, Math.min(160, Math.round(Number(value))));
        if (property === "fontFamily") textStyle.fontFamily = value as FontFamily;
        if (property === "bold" || property === "italic" || property === "underline" || property === "textAlign") textStyle[property] = value as never;
        const updatesChildText = ["textColor", "fontSize", "fontFamily", "bold", "italic", "underline", "textAlign", "listType"].includes(property);
        return { ...element, ...(updatesChildText ? { elements: element.elements.map(update) } : {}), libraryComponent: { ...element.libraryComponent, styleOverrides, textStyle } };
      }
      if (element.type === "schemaTable" && property === "fontSize") { const size = Math.max(8, Math.min(48, Math.round(Number(value)))); return { ...element, fontSize: size, w: Math.max(element.w, schemaTableResizeMinimumWidth()), h: schemaTableMinimumHeight(element.columns.length, size) }; }
      if (property === "color") return { ...element, color: String(value) } as Element;
      if (element.type === "text" && property === "textColor") return { ...element, color: String(value) };
      if (property === "opacity") return { ...element, opacity: Number(value) } as Element;
      if (property === "thickness" && "thickness" in element) return { ...element, thickness: Math.max(1, Math.round(Number(value))) } as Element;
      if (element.type === "text" && property === "fontSize") return { ...element, fontSize: Math.max(8, Math.round(Number(value))) };
      if (element.type === "text" && property === "fontFamily") return { ...element, fontFamily: value as TextElement["fontFamily"] };
      if (element.type === "text" && ["bold", "italic", "underline", "textAlign", "listType"].includes(property)) return { ...element, [property]: value } as Element;
      if ((isLabelShape(element) || isConnector(element)) && element.label && ["textColor", "fontSize", "fontFamily", "bold", "italic", "underline", "textAlign", "listType"].includes(property)) {
        const labelProperty = property === "textColor" ? "color" : property;
        return { ...element, label: { ...element.label, [labelProperty]: property === "fontSize" ? Math.max(8, Math.round(Number(value))) : value } } as Element;
      }
      if (element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "triangle" || element.type === "flowchart" || element.type === "svgPath") {
        if (element.type === "svgPath" && property === "pathData") return { ...element, pathData: String(value) };
        if (element.type === "svgPath" && property === "fillRule") return { ...element, fillRule: value as ShapeElement["fillRule"] };
        if (element.type === "svgPath" && property === "svgNonScalingStroke") return { ...element, svgNonScalingStroke: Boolean(value) };
        if (property === "fillColor") return { ...element, fillColor: value ? String(value) : undefined };
        if (property === "fillOpacity") return { ...element, fillOpacity: Number(value) };
        if (property === "lineStyle") return { ...element, lineStyle: value as ShapeElement["lineStyle"] };
        if (property === "edgeStyle") return { ...element, edgeStyle: value as ShapeElement["edgeStyle"] };
        if (property === "cornerRadius") return { ...element, cornerRadius: Math.max(0, Math.min(100, Number(value))) };
      }
      if ((element.type === "line" || element.type === "arrow") && property === "lineStyle") return { ...element, lineStyle: value as ShapeElement["lineStyle"] };
      if (element.type === "line" && property === "lineRoute") {
        const route = value as LineRoute;
        const points = route === "curve" ? defaultCurveControlPoints({ ...element, routePoints: undefined }, 1) : undefined;
        return { ...element, lineRoute: route, routePoints: points, autoRoute: undefined, routeWaypoints: undefined };
      }
      if (element.type === "arrow" && property === "arrowRoute") {
        const route = value as ArrowRoute;
        const points = route === "curve" ? defaultCurveControlPoints({ ...element, routePoints: undefined }, 1) : undefined;
        return { ...element, arrowRoute: route, routePoints: points, autoRoute: undefined, routeWaypoints: undefined };
      }
      if (element.type === "arrow" && property === "forkUpperHead") return { ...element, forkUpper: { ...(element.forkUpper ?? {}), endHead: value as ArrowHead } };
      if (element.type === "arrow" && property === "forkLowerHead") return { ...element, forkLower: { ...(element.forkLower ?? {}), endHead: value as ArrowHead } };
      if (element.type === "flowchart" && property === "flowchartShape") return { ...element, flowchartShape: value as FlowchartShape };
      if (isConnector(element) && (property === "startHead" || property === "endHead")) {
        const head = value as ArrowHead;
        return element.type === "arrow" && property === "endHead" && element.arrowRoute === "forked"
          ? { ...element, endHead: head, forkUpper: { ...(element.forkUpper ?? {}), endHead: head }, forkLower: { ...(element.forkLower ?? {}), endHead: head } }
          : { ...element, [property]: head };
      }
      return element;
    };
    setElements((items) => items.map((element, index) => indices.has(index) ? update(element) : element));
    pushUndo(before); setDirty(true);
  }

  function setConnectorHead(end: "start" | "end", value: ArrowHead) {
    const selected = focusedElement();
    if (selected && isConnector(selected)) { updateProperty(end === "start" ? "startHead" : "endHead", value); return; }
    if (tool() === "line") { (end === "start" ? setDefaultLineStartHead : setDefaultLineEndHead)(value); return; }
    (end === "start" ? setDefaultStartHead : setDefaultEndHead)(value);
  }

  function setSelectedAutoRoute(enabled: boolean) {
    if (orthogonalConnectors() && enabled) return;
    changeSelected(item => {
      if (!isConnector(item)) return item;
      if (enabled) return { ...item, autoRoute: true, routePoints: undefined, routeWaypoints: [], ...(item.type === "line" ? { lineRoute: "straight" as const } : { arrowRoute: "straight" as const }) };
      const routePoints = connectorForView(item).routePoints;
      return { ...item, autoRoute: undefined, routeWaypoints: undefined, routePoints, ...(item.type === "line" ? { lineRoute: "straight" as const } : { arrowRoute: "straight" as const }) };
    });
  }

  /** Replace one nested component child while preserving its enclosing group structure. */
  function updateNestedGroupChild(group: GroupElement, childId: string, update: (child: Element) => Element): GroupElement | undefined {
    let found = false;
    const visit = (items: Element[]): Element[] => items.map(child => {
      if (child.id === childId) { found = true; return update(child); }
      return child.type === "group" ? { ...child, elements: visit(child.elements) } : child;
    });
    const children = visit(group.elements);
    return found ? { ...group, elements: children } : undefined;
  }

  function commitTextDraft() {
    textEditorPendingPointerId = undefined;
    textEditorFocusOnCanvasClick = false;
    if (textEditorFocusTimer !== undefined) { window.clearTimeout(textEditorFocusTimer); textEditorFocusTimer = undefined; }
    const draft = textDraft();
    if (draft?.shapeLabel && draft.editingIndex !== undefined && !draft.editingChildId) {
      const index = draft.editingIndex; const item = elements()[index];
      if (item && (isLabelShape(item) || isConnector(item)) && !item.locked && !boardLocked()) {
        const before = cloneElements(elements());
        const label: ShapeLabel = { ...item.label, text: draft.value, color: draft.color, opacity: draft.opacity, fontSize: draft.fontSize, fontFamily: draft.fontFamily, bold: draft.bold, italic: draft.italic, underline: draft.underline, textAlign: draft.textAlign, listType: draft.listType, verticalAlign: draft.verticalAlign ?? "middle" };
        setElements(items => items.map((element, i) => i === index ? { ...item, label: draft.value.trim() ? label : undefined } : element));
        if (JSON.stringify(before) !== JSON.stringify(elements())) { pushUndo(before); setDirty(true); }
      }
      setTextDraft(undefined); return;
    }
    if (draft?.editingChildId && draft.editingIndex !== undefined) {
      const index = draft.editingIndex; const group = elements()[index];
      if (group?.type === "group" && !group.locked && !boardLocked()) {
        const before = cloneElements(elements());
        const updated = updateNestedGroupChild(group, draft.editingChildId, child => {
          if (draft.shapeLabel && (isLabelShape(child) || isConnector(child))) {
            const label: ShapeLabel = { ...child.label, text: draft.value, color: draft.color, opacity: draft.opacity, fontSize: draft.fontSize, fontFamily: draft.fontFamily, bold: draft.bold, italic: draft.italic, underline: draft.underline, textAlign: draft.textAlign, listType: draft.listType, verticalAlign: draft.verticalAlign ?? "middle" };
            return { ...child, label: draft.value.trim() ? label : undefined } as Element;
          }
          if (child.type === "text") return { ...child, text: draft.value, color: draft.color, opacity: draft.opacity, fontSize: draft.fontSize, fontFamily: draft.fontFamily, bold: draft.bold, italic: draft.italic, underline: draft.underline, textAlign: draft.textAlign, listType: draft.listType };
          return child;
        });
        if (updated) {
          setElements(items => items.map((item, current) => current === index ? updated : item));
          if (JSON.stringify(before) !== JSON.stringify(elements())) { pushUndo(before); setDirty(true); }
        }
      }
      setTextDraft(undefined); return;
    }
    if (draft && !boardLocked()) {
      const existing = draft.editingIndex === undefined ? undefined : elements()[draft.editingIndex];
      if (draft.editingIndex !== undefined && existing?.type === "text" && !draft.value.trim()) {
        pushUndo(cloneElements(elements()));
        const removedIndex = draft.editingIndex;
        setElements((items) => items.filter((_, index) => index !== removedIndex));
        setSelectedIndices((indices) => indices.filter((index) => index !== removedIndex).map((index) => index > removedIndex ? index - 1 : index));
        setDirty(true);
      } else if (draft.value.trim()) {
        const item: TextElement = { type: "text", x: draft.x, y: draft.y, text: draft.value, color: draft.color, opacity: draft.opacity, fontSize: draft.fontSize, fontFamily: draft.fontFamily, bold: draft.bold, italic: draft.italic, underline: draft.underline, textAlign: draft.textAlign, listType: draft.listType };
        const before = cloneElements(elements());
        if (draft.editingIndex !== undefined) setElements((items) => items.map((element, index) => index === draft.editingIndex && element.type === "text" ? { ...element, ...item } : element));
        else setElements((items) => [...items, item]);
        pushUndo(before); setDirty(true);
      }
    }
    setTextDraft(undefined);
  }

  function startTextDraft(point: Point, editingIndex?: number, pointerId?: number) {
    if (textDraft()) commitTextDraft();
    const existing = editingIndex === undefined ? undefined : elements()[editingIndex];
    if (existing?.locked) return;
    textEditorPendingPointerId = isWindowsPlatform() ? undefined : pointerId;
    setSelectedIndices(editingIndex === undefined ? [] : [editingIndex]);
    setTool("text");
    const text = existing?.type === "text" ? existing : undefined;
    setTextDraft({ x: text?.x ?? point.x, y: text?.y ?? point.y, value: text?.text ?? "", editingIndex, color: text?.color ?? color(), opacity: text?.opacity ?? 1, fontSize: text?.fontSize ?? defaultFontSize(), fontFamily: text?.fontFamily ?? defaultFontFamily(), bold: text?.bold ?? defaultBold(), italic: text?.italic ?? defaultItalic(), underline: text?.underline ?? defaultUnderline(), textAlign: text?.textAlign ?? defaultTextAlign(), listType: text?.listType ?? defaultListType() });
  }

  function focusTextEditor() {
    if (textDraft() && textEditorElement?.isConnected) textEditorElement.focus();
  }

  function openNoteEditor(point: Point, kind: NoteKind, editingIndex?: number, initial?: { content?: string; title?: string }) {
    if (boardLocked()) return;
    const existing = editingIndex === undefined ? undefined : elements()[editingIndex];
    if (existing?.locked) return;
    const group = existing?.type === "group" ? existing : undefined;
    const bounds = group ? elementBounds(group) : undefined;
    setNoteEditor({ x: bounds?.x ?? point.x, y: bounds?.y ?? point.y, width: group?.note?.width ?? bounds?.w ?? (kind === "sticky" ? 296 : 340), height: group?.note?.height ?? bounds?.h ?? 190, fontSize: group?.note?.fontSize ?? Math.min(32, defaultFontSize()), kind, content: group?.note?.content ?? initial?.content ?? (kind === "checklist" ? "- [ ] New task" : ""), title: group?.note?.title ?? initial?.title ?? defaultNoteTitle(kind), editingIndex });
    if (editingIndex !== undefined) setSelectedIndices([editingIndex]);
    setComponentEditorCollapsed(false); setSidebarTab("properties");
    setNoteEditorSession(session => session + 1);
  }

  function saveNoteEditor() {
    const draft = noteEditor();
    if (!draft || boardLocked()) return;
    const tableBlock = draft.kind === "note" ? findMarkdownTableBlock(draft.content) : undefined;
    const editedContent = noteEditorTextarea?.isConnected ? tableBlock ? replaceMarkdownTableBlock(draft.content, tableBlock, noteEditorTextarea.value) : noteEditorTextarea.value : draft.content;
    const title = noteEditorTitleInput?.isConnected ? noteEditorTitleInput.value : draft.title;
    if (editedContent.length > 50000) { setError("Notes and checklists are limited to 50,000 characters."); return; }
    const content = draft.kind === "checklist" && !editedContent.trim() ? "- [ ] New task" : editedContent;
    if (!content.trim() && !title.trim()) { setNoteEditor(undefined); return; }
    if (normalizeNoteContent(content, draft.kind).length > 50000) {
      setError("Checklist task markers count toward the 50,000-character save limit. Shorten the checklist before saving it.");
      return;
    }
    const previous = draft.editingIndex === undefined ? undefined : elements()[draft.editingIndex];
    let group = buildNoteGroup(draft.x, draft.y, draft.kind, content, { width: draft.width, ...(draft.editingIndex !== undefined || draft.resized ? { height: draft.height } : {}), fontSize: draft.fontSize, title });
    if (previous?.type === "group") {
      group = { ...group, ...previous, note: { ...group.note, kind: draft.kind, content: group.note?.content ?? content }, elements: group.elements.map((child, index) => previous.elements[index]?.id ? { ...child, id: previous.elements[index].id } as Element : child) };
    }
    const before = cloneElements(elements());
    let index = draft.editingIndex;
    if (index === undefined) { index = elements().length; setElements(items => [...items, group]); }
    else setElements(items => items.map((item, i) => i === index ? group : item));
    pushUndo(before); setSelectedIndices([index]); setTool("select"); setTextMode("text"); setDirty(true); setNoteEditor(undefined);
  }

  function insertMarkdownTable() {
    const draft = noteEditor(); if (!draft || draft.kind === "checklist" || !noteEditorTextarea) return;
    const textarea = noteEditorTextarea; const source = textarea.value; const start = textarea.selectionStart; const end = textarea.selectionEnd;
    const table = "| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |\n| Cell | Cell |";
    const content = source.slice(0, start) + table + source.slice(end);
    setNoteEditor(current => current ? { ...current, content } : current);
    requestAnimationFrame(() => { if (textarea.isConnected) { const caret = start + table.length; textarea.focus(); textarea.setSelectionRange(caret, caret); } });
  }

  function toggleChecklist(index: number, row: number) {
    const previous = elements()[index];
    if (previous?.type !== "group" || previous.note?.kind !== "checklist" || boardLocked() || previous.locked) return;
    const before = cloneElements(elements());
    const content = toggleChecklistContent(previous.note.content, row);
    const rebuilt = buildNoteGroup(elementBounds(previous).x, elementBounds(previous).y, "checklist", content, { width: previous.note.width, height: previous.note.height, fontSize: previous.note.fontSize, title: previous.note.title, collapsed: previous.note.collapsed });
    const replacement: Element = { ...rebuilt, ...previous, note: { ...rebuilt.note, kind: "checklist", content }, elements: rebuilt.elements.map((child, childIndex) => previous.elements[childIndex]?.id ? { ...child, id: previous.elements[childIndex].id } as Element : child) };
    setElements(items => items.map((item, current) => current === index ? replacement : item)); pushUndo(before); setDirty(true);
  }

  function toggleNoteCollapsed(index: number) {
    const previous = elements()[index];
    const viewOnly = readOnlyView();
    if (previous?.type !== "group" || !previous.note || !viewOnly && (boardLocked() || previous.locked)) return;
    const bounds = elementBounds(previous); const before = viewOnly ? undefined : cloneElements(elements());
    const next = buildNoteGroup(bounds.x, bounds.y, previous.note.kind, previous.note.content, {
      width: previous.note.width ?? bounds.w,
      height: previous.note.height ?? Math.max(100, bounds.h),
      fontSize: previous.note.fontSize,
      title: previous.note.title,
      collapsed: !previous.note.collapsed,
    });
    const replacement: Element = { ...next, ...previous, note: next.note, elements: next.elements.map((child, childIndex) => previous.elements[childIndex]?.id ? { ...child, id: previous.elements[childIndex].id } as Element : child) };
    setElements(items => items.map((item, current) => current === index ? replacement : item));
    if (!viewOnly) { pushUndo(before!); setSelectedIndices([index]); setDirty(true); }
  }

  function handleCanvasDoubleClick(event: MouseEvent) {
    const rect = canvas.getBoundingClientRect(); const view = canvasState();
    const point = { x: (event.clientX - rect.left - view.panX) / view.zoom, y: (event.clientY - rect.top - view.panY) / view.zoom };
    const hit = hitTest(point) ?? hitInterior(point); const target = hit === undefined ? undefined : elements()[hit];
    if (target?.type === "image" && target.previewUrl) { event.preventDefault(); setActiveWebPreview({ id: target.id!, url: target.previewUrl, embedUrl: webEmbedUrl(target.previewUrl) }); return; }
    if (target?.pageLinkId && pages().some(page => page.id === target.pageLinkId)) { event.preventDefault(); switchPage(target.pageLinkId); return; }
    if (readOnlyView() || boardLocked() || tool() === "text") return;
    event.preventDefault();
    // Selecting a schema card already opens its source editor in the left dock.
    if (target?.type === "schemaTable") return;
    if (target?.type === "group" && target.libraryComponent?.kind.startsWith("viz-")) { openCsvChartDialog(target.id); return; }
    if (target?.type === "group" && target.mermaid) { openMermaidDialog(target.id); return; }
    if (target?.type === "group" && !target.note && !target.mermaid && hit !== undefined) {
      const nearestEditableChild = (group: GroupElement) => flatten(group.elements)
        .filter((item): item is Element => item.type === "text" || (isLabelShape(item) || isConnector(item)) && !!item.label)
        .map(item => {
          const box = item.type === "text" ? elementBounds(item) : labelBox(item as ShapeElement);
          const dx = Math.max(box.x - point.x, 0, point.x - box.x - box.w);
          const dy = Math.max(box.y - point.y, 0, point.y - box.y - box.h);
          return { item, distance: dx * dx + dy * dy };
        })
        .sort((a, b) => a.distance - b.distance)[0]?.item;
      if (target.libraryComponent) {
        const child = nearestEditableChild(target);
        if (child) { editNestedText(hit, target, child); return; }
        setSelectedIndices([hit]);
        const fields = libraryComponentFields(target);
        const locate = (key: string): Element | undefined => {
          const shapeLabel = key.endsWith(":label"); const id = shapeLabel ? key.slice(0, -6) : key;
          const visit = (items: Element[]): Element | undefined => { for (const item of items) { if (item.id === id && (shapeLabel ? "label" in item && !!item.label : item.type === "text")) return item; if (item.type === "group") { const nested = visit(item.elements); if (nested) return nested; } } return undefined; };
          return visit(target.elements);
        };
        const nearest = fields.map(field => { const item = locate(field.key); if (!item) return { key: field.key, distance: Infinity }; const box = elementBounds(item); const dx = Math.max(box.x - point.x, 0, point.x - box.x - box.w); const dy = Math.max(box.y - point.y, 0, point.y - box.y - box.h); return { key: field.key, distance: dx * dx + dy * dy }; }).sort((a, b) => a.distance - b.distance)[0];
        requestAnimationFrame(() => {
          const input = nearest ? [...document.querySelectorAll<HTMLTextAreaElement>("[data-component-field-key]")].find(item => item.dataset.componentFieldKey === nearest.key) : undefined;
          if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
        });
        return;
      }
      if (!target.libraryComponent) {
        const before = cloneElements(elements()); const editable = assignLibraryComponentIds(target, "custom" as LibraryComponentKind, target);
        setElements(items => items.map((item, index) => index === hit ? editable : item)); pushUndo(before); setDirty(true);
        const child = nearestEditableChild(editable);
        if (child) { editNestedText(hit, editable, child); return; }
      }
      setSelectedIndices([hit]); setSidebarTab("properties"); setStyleMenuMode("full"); setMobileQuickPropertiesOpen(true); return;
    }
    if (target?.componentId?.startsWith("uml-class:")) { const shell = target.type === "group" ? target.elements.find(item => item.componentRole === "class-shell") : elements().find(item => item.componentId === target.componentId && item.componentRole === "class-shell"); const box = elementBounds(shell ?? target); openClassCardDialog(box.x, box.y, target.componentId); return; }
    if (target?.type === "group" && target.note) { if (!noteCollapseHit(target, point)) openNoteEditor(point, target.note.kind, hit); return; }
    if (hit !== undefined && (isLabelShape(elements()[hit]) || isConnector(elements()[hit]))) editShapeLabel(hit);
    else if (hit !== undefined && elements()[hit]?.type === "text") startTextDraft(point, hit);
    else if (isWindowsPlatform() || !isCompactTouchLayout()) startTextDraft(point);
  }

  function openClassCardDialog(x: number, y: number, componentId?: string) {
    const cardGroup = componentId ? elements().find((item): item is GroupElement => item.type === "group" && item.componentId === componentId) : undefined;
    const parts = componentId ? cardGroup?.elements ?? elements().filter(item => item.componentId === componentId) : [];
    const byRole = (role: string) => parts.find(item => item.componentRole === role);
    const shell = byRole("class-shell"); const name = byRole("class-name"); const attributes = byRole("class-attributes"); const methods = byRole("class-methods");
    setClassCardDraft({ x, y, name: name?.type === "text" ? name.text : "", attributes: attributes?.type === "text" ? attributes.text : "", methods: methods?.type === "text" ? methods.text : "", fontSize: name?.type === "text" ? name.fontSize : defaultFontSize(), ...(shell?.type === "rectangle" ? { width: shell.w, height: shell.h } : {}), componentId });
    setComponentEditorCollapsed(false); setSidebarTab("properties");
    setStencilMenuOpen(false);
  }

  function classCardLayout(draft: NonNullable<ReturnType<typeof classCardDraft>>) {
    const fontSize = Math.max(8, Math.min(48, Math.round(draft.fontSize)));
    const longest = Math.max(12, ...[draft.name, draft.attributes, draft.methods].flatMap(text => text.split(/\n?\n/).map(line => line.length)));
    const naturalWidth = Math.max(230, Math.min(640, longest * fontSize * .62 + 32));
    const width = Math.max(230, Math.min(640, draft.width ?? naturalWidth));
    const wrap = (text: string) => text.split(/\n?\n/).flatMap(line => {
      const rows: string[] = []; let rest = line; const limit = Math.max(12, Math.floor((width - 28) / (fontSize * .62)));
      while (rest.length > limit) { let cut = rest.lastIndexOf(" ", limit); if (cut < 1) cut = limit; rows.push(rest.slice(0, cut)); rest = rest.slice(cut).trimStart(); }
      rows.push(rest); return rows;
    }).join("\n");
    const attrs = wrap(draft.attributes); const methods = wrap(draft.methods); const lineHeight = fontSize * 1.4;
    const attrHeight = Math.max(54, attrs.split("\n").length * lineHeight + 18); const naturalMethodHeight = Math.max(54, methods.split("\n").length * lineHeight + 18);
    const methodHeight = Math.max(naturalMethodHeight, (draft.height ?? 0) - 36 - attrHeight);
    return { fontSize, width, height: 36 + attrHeight + methodHeight, attrs, methods, attrHeight };
  }

  function classCardElements(draft: NonNullable<ReturnType<typeof classCardDraft>>): GroupElement {
    const { fontSize, width, height, attrs, methods, attrHeight } = classCardLayout(draft);
    const group = buildLibraryComponent("uml-class", draft.x, draft.y); const items = group.elements;
    const positions: { role: string; item: Element }[] = [
      { role: "class-shell", item: { ...items[0] as ShapeElement, w: width, h: height } },
      { role: "class-header", item: { ...items[1] as ShapeElement, w: width } },
      { role: "class-divider-name", item: { ...items[2] as ShapeElement, w: width, h: 0 } },
      { role: "class-divider-attributes", item: { ...items[3] as ShapeElement, y: draft.y + 36 + attrHeight, w: width, h: 0 } },
      { role: "class-name", item: { ...(items[4] as TextElement), text: draft.name, fontSize, x: draft.x + 12, y: draft.y + 10 } },
      { role: "class-attributes", item: { ...(items[5] as TextElement), text: attrs, fontSize, x: draft.x + 12, y: draft.y + 45 } },
      { role: "class-methods", item: { ...(items[6] as TextElement), text: methods, fontSize, x: draft.x + 12, y: draft.y + 45 + attrHeight } },
    ];
    const existingGroup = draft.componentId ? elements().find((item): item is GroupElement => item.type === "group" && item.componentId === draft.componentId) : undefined;
    const existing = draft.componentId ? existingGroup?.elements ?? elements().filter(item => item.componentId === draft.componentId) : [];
    const oldIds = new Map(existing.map(item => [item.componentRole, item.id]));
    const componentId = draft.componentId ?? `uml-class:${crypto.randomUUID()}`;
    const children = positions.map(({ role, item }) => ({ ...item, id: oldIds.get(role) ?? crypto.randomUUID(), componentId, componentRole: role } as Element));
    return { type: "group", id: existingGroup?.id ?? componentId, componentId, elements: children, libraryComponent: { ...(existingGroup?.libraryComponent ?? {}), kind: "uml-class" } };
  }

  function resizeClassCardFont(componentId: string, requestedSize: number) {
    if (!Number.isFinite(requestedSize) || requestedSize < 8 || requestedSize > 48) return false;
    const cardIndex = elements().findIndex(item => item.type === "group" && item.componentId === componentId); const cardGroup = cardIndex >= 0 ? elements()[cardIndex] as GroupElement : undefined;
    const parts = cardGroup?.elements ?? elements().filter(item => item.componentId === componentId); const shell = parts.find(item => item.componentRole === "class-shell");
    if (!parts.length || !shell || shell.type !== "rectangle" || boardLocked() || parts.some(item => item.locked)) return false;
    const textFor = (role: string) => parts.find(item => item.componentRole === role);
    const name = textFor("class-name"); const attributes = textFor("class-attributes"); const methods = textFor("class-methods");
    const draft = { x: shell.x, y: shell.y, name: name?.type === "text" ? name.text : "", attributes: attributes?.type === "text" ? attributes.text : "", methods: methods?.type === "text" ? methods.text : "", fontSize: Math.max(8, Math.min(48, Math.round(requestedSize))), width: shell.w, height: shell.h, componentId };
    const before = cloneElements(elements()); const nextCard = classCardElements(draft);
    if (cardGroup && cardIndex >= 0) { setElements(items => items.map((item, index) => index === cardIndex ? nextCard : item)); setSelectedIndices([cardIndex]); }
    else { const indices = elements().flatMap((item, index) => item.componentId === componentId ? [index] : []); if (!indices.length) return false; const insertAt = Math.min(...indices); const remove = new Set(indices); const next = elements().filter((_, index) => !remove.has(index)); next.splice(insertAt, 0, nextCard); setElements(next); setSelectedIndices([insertAt]); }
    rememberFontSize(draft.fontSize); pushUndo(before); setDirty(true); return true;
  }

  function resizeClassCardSize(componentId: string, axis: "width" | "height", requestedSize: number) {
    const cardIndex = elements().findIndex(item => item.type === "group" && item.componentId === componentId); const cardGroup = cardIndex >= 0 ? elements()[cardIndex] as GroupElement : undefined;
    const parts = cardGroup?.elements ?? elements().filter(item => item.componentId === componentId); const shell = parts.find(item => item.componentRole === "class-shell");
    if (!parts.length || !shell || shell.type !== "rectangle" || boardLocked() || parts.some(item => item.locked) || !Number.isFinite(requestedSize)) return false;
    const textFor = (role: string) => parts.find(item => item.componentRole === role);
    const name = textFor("class-name"); const attributes = textFor("class-attributes"); const methods = textFor("class-methods");
    const current = { x: shell.x, y: shell.y, name: name?.type === "text" ? name.text : "", attributes: attributes?.type === "text" ? attributes.text : "", methods: methods?.type === "text" ? methods.text : "", fontSize: name?.type === "text" ? name.fontSize : defaultFontSize(), width: shell.w, height: shell.h, componentId };
    const bounded = Math.max(axis === "width" ? 180 : 110, Math.min(axis === "width" ? 900 : 1800, requestedSize));
    const draft = { ...current, [axis]: bounded };
    const nextCard = classCardElements(draft); const before = cloneElements(elements());
    if (cardGroup && cardIndex >= 0) { setElements(items => items.map((item, index) => index === cardIndex ? nextCard : item)); setSelectedIndices([cardIndex]); }
    else { const indices = elements().flatMap((item, index) => item.componentId === componentId ? [index] : []); if (!indices.length) return false; const insertAt = Math.min(...indices); const remove = new Set(indices); const next = elements().filter((_, index) => !remove.has(index)); next.splice(insertAt, 0, nextCard); setElements(next); setSelectedIndices([insertAt]); }
    pushUndo(before); setDirty(true); return true;
  }

  function updateClassCardDraftFont(requestedSize: number) {
    if (!Number.isFinite(requestedSize) || requestedSize < 8 || requestedSize > 48) return;
    const fontSize = rememberFontSize(requestedSize);
    setClassCardDraft(value => value ? { ...value, fontSize } : value);
  }

  function insertClassCard() {
    const draft = classCardDraft();
    if (!draft || !activePath() || boardLocked()) return;
    const card = classCardElements(draft);
    const oldIndices = draft.componentId ? elements().flatMap((item, index) => item.componentId === draft.componentId || item.type === "group" && item.componentId === draft.componentId ? [index] : []) : [];
    const insertion = oldIndices.length ? Math.min(...oldIndices) : elements().length; const remove = new Set(oldIndices);
    const next = elements().filter((_, index) => !remove.has(index)); next.splice(insertion, 0, card);
    pushUndo(cloneElements(elements()));
    setElements(next);
    setSelectedIndices([insertion]);
    setTool("select");
    setClassCardDraft(undefined);
    setDirty(true);
  }

  function classCardSize(draft: NonNullable<ReturnType<typeof classCardDraft>>) { const { width, height } = classCardLayout(draft); return { width, height }; }

  function selectedClassCardSize(componentId: string) {
    const group = elements().find((item): item is GroupElement => item.type === "group" && item.componentId === componentId);
    const shell = group?.elements.find(item => item.componentRole === "class-shell") ?? elements().find(item => item.componentId === componentId && item.componentRole === "class-shell");
    return shell?.type === "rectangle" ? { width: shell.w, height: shell.h } : { width: 230, height: 144 };
  }

  function updateSelectedLibraryComponent(operation: (group: GroupElement) => GroupElement) {
    if (boardLocked()) return;
    const index = primarySelection(); const group = index === undefined ? undefined : elements()[index];
    if (index === undefined || group?.type !== "group" || !group.libraryComponent || group.locked) return;
    const before = cloneElements(elements()); setElements(items => items.map((item, current) => current === index ? operation(item as GroupElement) : item)); pushUndo(before); setDirty(true);
  }

  function activateLibraryControl(index: number, point: Point): boolean {
    const group = elements()[index]; if (group?.type !== "group" || !group.libraryComponent) return false;
    const kind = group.libraryComponent.kind; const options = group.libraryComponent.formOptions ?? defaultLibraryFormOptions(kind as LibraryComponentKind) ?? [];
    const visitAll = (items: Element[], predicate: (item: Element) => boolean): Element[] => {
      const found: Element[] = [];
      for (const item of items) { if (predicate(item)) found.push(item); if (item.type === "group") found.push(...visitAll(item.elements, predicate)); }
      return found;
    };
    const optionIndexAtPoint = (prefix: string) => {
      if (group.componentBounds && (kind === "form-checkbox" || kind === "form-radio")) {
        return guiOptionIndexAtPoint(group, point);
      }
      for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
        const parts = visitAll(group.elements, item => !!item.componentRole?.startsWith(prefix) && item.componentRole.endsWith(`-${optionIndex}`));
        if (parts.some(part => { const bounds = elementBounds(part); return point.x >= bounds.x - 3 && point.x <= bounds.x + bounds.w + 3 && point.y >= bounds.y - 3 && point.y <= bounds.y + bounds.h + 3; })) return optionIndex;
      }
      return undefined;
    };
    let change: ((current: GroupElement) => GroupElement) | undefined;
    if (kind === "form-checkbox") {
      const optionIndex = optionIndexAtPoint("form-checkbox-"); if (optionIndex === undefined) return false;
      const current = group.libraryComponent.formStates?.[optionIndex] ?? optionIndex === 0;
      change = currentGroup => setLibraryCheckboxOption(currentGroup, optionIndex, !current);
    } else if (kind === "form-radio") {
      const optionIndex = optionIndexAtPoint("form-radio-"); if (optionIndex === undefined) return false;
      change = currentGroup => setLibraryRadioOption(currentGroup, optionIndex);
    } else if (kind === "form-toggle") {
      change = currentGroup => setLibraryFormState(currentGroup, !(currentGroup.libraryComponent?.formState ?? true));
    } else if (kind === "form-select" || kind === "form-button") {
      if (!options.length) return false;
      change = currentGroup => rebuildLibraryFormOptions(currentGroup, options, ((currentGroup.libraryComponent?.selectedOption ?? 0) + 1) % options.length);
    } else return false;
    const before = cloneElements(elements()); setElements(items => items.map((item, currentIndex) => currentIndex === index ? change!(item as GroupElement) : item)); pushUndo(before); setDirty(true);
    return true;
  }

  function commitLibraryComponentDraft() {
    const draft = libraryComponentDraft(); if (!draft || !activePath() || boardLocked()) return;
    const component = assignLibraryComponentIds(draft, draft.libraryComponent!.kind as LibraryComponentKind, draft);
    const index = elements().length; pushUndo(cloneElements(elements())); setElements(items => [...items, component]); setSelectedIndices([index]); setTool("select"); setLibraryComponentDraft(undefined); setDirty(true);
  }

  async function insertLibraryComponent(kind: LibraryComponentKind) {
    if (!activePath() || boardLocked() || !canvas) return;
    const item = LIBRARY_COMPONENTS.find(component => component.kind === kind); if (!item) return;
    const rect = canvas.getBoundingClientRect(); const view = canvasState();
    const x = (rect.width / 2 - view.panX) / view.zoom - item.width / 2;
    const y = (rect.height / 2 - view.panY) / view.zoom - item.height / 2;
    const relationship = buildLibraryRelationship(kind, x, y);
    if (relationship) {
      if (relationship.label) relationship.label = { ...relationship.label, fontSize: defaultFontSize() };
      const index = elements().length; pushUndo(cloneElements(elements())); setElements(items => [...items, relationship]);
      setSelectedIndices([index]); setTool("select"); setSidebarTab("properties"); setStencilMenuOpen(false); setDirty(true); return;
    }
    const definition = LIBRARY_COMPONENTS.find(item => item.kind === kind);
    if (!definition) return;
    const builtGroup = kind.startsWith("form-") || kind.startsWith("viz-")
      ? assignLibraryComponentIds({ type: "group", id: crypto.randomUUID(), elements: [], componentBounds: { x, y, w: definition.width, h: definition.height }, libraryComponent: { kind, label: definition.label, ...(defaultLibraryChartData(kind) ? { chartData: defaultLibraryChartData(kind) } : {}), ...(defaultLibraryFormOptions(kind) ? { formOptions: defaultLibraryFormOptions(kind) } : {}), ...(defaultLibraryFormTitle(kind) ? { formTitle: defaultLibraryFormTitle(kind) } : {}), ...(kind === "form-toggle" ? { formState: true } : {}) } }, kind)
      : assignLibraryComponentIds(buildLibraryComponent(kind, x, y, { chartData: defaultLibraryChartData(kind), formOptions: defaultLibraryFormOptions(kind), formTitle: defaultLibraryFormTitle(kind), ...(kind === "network-hub" ? { portCount: 8 } : kind === "network-switch" ? { portCount: 6 } : {}) }), kind);
    if (cloudProviderComponent(kind)) {
      const glyph = await loadCloudProviderGlyph(kind);
      if (!glyph || !activePath() || boardLocked()) return;
      builtGroup.libraryComponent = { ...builtGroup.libraryComponent!, iconSvg: glyph.svg, iconViewBox: glyph.viewBox };
    }
    const group = resizeLibraryFont(builtGroup, defaultFontSize());
    setStencilMenuOpen(false);
    if (kind.startsWith("form-") || kind.startsWith("viz-")) { setComponentEditorCollapsed(false); setLibraryComponentDraft(group); return; }
    const index = elements().length;
    pushUndo(cloneElements(elements())); setElements(items => [...items, group]); setSelectedIndices([index]); setTool("select"); setDirty(true);
  }

  async function spawnAllModelingComponents() {
    const targetPath = activePath(); const targetPage = activePageId();
    if (!targetPath || !canvas || readOnlyView() || boardLocked() || componentCatalogBusy()) return;
    setComponentCatalogBusy(true);
    try {
      const catalogSections = [
        { id: "uml-er", title: "UML & ER" }, { id: "software", title: "Software architecture" },
        { id: "cloud", title: "Cloud platforms" }, { id: "network", title: "Network" },
        { id: "annotations", title: "Annotations" }, { id: "viz", title: "Data visualization" },
        { id: "forms", title: "Forms & UI" }, { id: "bpmn", title: "BPMN" },
      ];
      const catalogGroup = (section: string) => section.startsWith("UML") || section.startsWith("ER") ? "uml-er" : section.startsWith("Software") || section.startsWith("Architecture") ? "software" : section.startsWith("Cloud") ? "cloud" : section.startsWith("Network") ? "network" : section.startsWith("Data visualization") ? "viz" : section.startsWith("Forms") ? "forms" : section.startsWith("BPMN") ? "bpmn" : section.startsWith("Annotations") ? "annotations" : "other";
      const cloudKinds = LIBRARY_COMPONENTS.filter(component => cloudProviderComponent(component.kind));
      const glyphPairs = await Promise.all(cloudKinds.map(async component => [component.kind, await loadCloudProviderGlyph(component.kind).catch(() => undefined)] as const));
      if (activePath() !== targetPath || activePageId() !== targetPage || !isCanvasWorkspace() || readOnlyView() || boardLocked() || !canvas) return;
      const glyphs = new Map<LibraryComponentKind, NonNullable<(typeof glyphPairs)[number][1]>>();
      for (const [kind, glyph] of glyphPairs) if (glyph) glyphs.set(kind, glyph);
      const catalog: Element[] = [];
      const addText = (text: string, x: number, y: number, fontSize: number, bold = false): TextElement => ({ type: "text", id: crypto.randomUUID(), x, y, text, color: "#353535", fontSize, fontFamily: "sans", bold, italic: false, underline: false, textAlign: "left", listType: "none" });
      catalog.push(addText(`Modeling component catalog · ${LIBRARY_COMPONENTS.length} components`, 0, 0, 26, true));
      const columns = 4; const cellWidth = 250; const rowHeight = 180; let sectionTop = 58;
      for (const section of catalogSections) {
        const items = LIBRARY_COMPONENTS.filter(component => catalogGroup(component.section) === section.id);
        if (!items.length) continue;
        catalog.push(addText(`${section.title} · ${items.length}`, 0, sectionTop, 18, true));
        const itemsTop = sectionTop + 34;
        for (const [index, item] of items.entries()) {
          const x = (index % columns) * cellWidth; const y = itemsTop + Math.floor(index / columns) * rowHeight;
          let visual: Element;
          const relationship = buildLibraryRelationship(item.kind, x, y);
          if (relationship) {
            if (relationship.label) relationship.label = { ...relationship.label, fontSize: defaultFontSize() };
            visual = relationship;
          } else if (item.kind === "er-table") {
            visual = { type: "schemaTable", id: crypto.randomUUID(), x, y, w: item.width, h: schemaTableMinimumHeight(3, defaultFontSize()), name: "SampleEntity", schemaDiagramId: crypto.randomUUID(), schemaSource: "CREATE TABLE SampleEntity (\n  id INTEGER PRIMARY KEY,\n  name VARCHAR(120) NOT NULL,\n  created_at TIMESTAMP\n);", columns: [{ id: crypto.randomUUID(), name: "id", dataType: "INTEGER", primaryKey: true, nullable: false }, { id: crypto.randomUUID(), name: "name", dataType: "VARCHAR(120)", nullable: false }, { id: crypto.randomUUID(), name: "created_at", dataType: "TIMESTAMP", nullable: true }], fontSize: defaultFontSize() };
          } else {
            const isCanvasRendered = item.kind.startsWith("form-") || item.kind.startsWith("viz-");
            const source: GroupElement = isCanvasRendered
              ? { type: "group", id: crypto.randomUUID(), elements: [], componentBounds: { x, y, w: item.width, h: item.height }, libraryComponent: { kind: item.kind, label: item.label, ...(defaultLibraryChartData(item.kind) ? { chartData: defaultLibraryChartData(item.kind) } : {}), ...(defaultLibraryFormOptions(item.kind) ? { formOptions: defaultLibraryFormOptions(item.kind) } : {}), ...(defaultLibraryFormTitle(item.kind) ? { formTitle: defaultLibraryFormTitle(item.kind) } : {}), ...(item.kind === "form-toggle" ? { formState: true } : {}) } }
              : buildLibraryComponent(item.kind, x, y, { chartData: defaultLibraryChartData(item.kind), formOptions: defaultLibraryFormOptions(item.kind), formTitle: defaultLibraryFormTitle(item.kind), ...(item.kind === "network-hub" ? { portCount: 8 } : item.kind === "network-switch" ? { portCount: 6 } : {}) });
            let group = resizeLibraryFont(assignLibraryComponentIds(source, item.kind), defaultFontSize());
            const glyph = glyphs.get(item.kind);
            if (glyph && group.libraryComponent) group = { ...group, libraryComponent: { ...group.libraryComponent, iconSvg: glyph.svg, iconViewBox: glyph.viewBox } };
            visual = group;
          }
          catalog.push(fitComponentSpecimen(visual, { x, y: y + 1, w: cellWidth, h: 136 }, 12), addText(item.label, x + 12, y + 144, 12, true));
        }
        sectionTop += 34 + Math.ceil(items.length / columns) * rowHeight + 34;
      }
      const bounds = unionBounds(catalog.map(elementBounds));
      if (!bounds) return;
      const rect = canvas.getBoundingClientRect(); const view = canvasState();
      const center = { x: (rect.width / 2 - view.panX) / view.zoom, y: (rect.height / 2 - view.panY) / view.zoom };
      const positioned = catalog.map(item => moveElement(item, center.x - bounds.x - bounds.w / 2, center.y - bounds.y - bounds.h / 2));
      pushUndo(cloneElements(elements())); setElements(current => [...current, ...positioned]); setSelectedIndices([]); setTool("select"); setStencilMenuOpen(false); setDirty(true); setError("");
      requestAnimationFrame(() => fitDocumentToViewport(positioned));
    } catch (cause) {
      setError(`Could not spawn the component catalog: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally { setComponentCatalogBusy(false); }
  }

  function spawnAllShapes() {
    if (!activePath() || !canvas || readOnlyView() || boardLocked() || shapeCatalogBusy()) return;
    setShapeCatalogBusy(true);
    try {
      const catalog: Element[] = [];
      const caption = (value: string, x: number, y: number, fontSize: number, bold = false): TextElement => ({ type: "text", id: crypto.randomUUID(), x, y, text: value, color: theme() === "dark" ? "#e7e9ec" : "#30363b", fontSize, fontFamily: "sans", bold, italic: false, underline: false, textAlign: "left", listType: "none" });
      const label = (value: string) => ({ text: value, color: theme() === "dark" ? "#e7e9ec" : "#30363b", fontSize: 12, fontFamily: "sans" as const, bold: false, italic: false, underline: false, textAlign: "center" as const, listType: "none" as const, verticalAlign: "middle" as const });
      const ink = theme() === "dark" ? "#aeb8c2" : "#52606d"; const fill = theme() === "dark" ? "#252a30" : "#ffffff";
      const columns = 5; const cellWidth = 190; const rowHeight = 142; let sectionTop = 38;
      catalog.push(caption(`Shape catalog · ${4 + FLOWCHART_SHAPES.length} shapes`, 0, 0, 25, true));
      const addSection = (title: string, items: { label: string; shape: ShapeElement }[]) => {
        catalog.push(caption(`${title} · ${items.length}`, 0, sectionTop, 16, true));
        const top = sectionTop + 30;
        items.forEach((item, index) => {
          const x = (index % columns) * cellWidth; const y = top + Math.floor(index / columns) * rowHeight;
          catalog.push({ ...item.shape, id: crypto.randomUUID(), x, y, label: label(item.label) });
        });
        sectionTop = top + Math.ceil(items.length / columns) * rowHeight + 28;
      };
      const basics: { type: "rectangle" | "circle" | "diamond" | "triangle"; label: string }[] = [
        { type: "rectangle", label: "Rectangle" }, { type: "circle", label: "Ellipse" }, { type: "diamond", label: "Diamond" }, { type: "triangle", label: "Triangle" },
      ];
      addSection("Basic shapes", basics.map(item => ({ label: item.label, shape: { type: item.type, x: 0, y: 0, w: 148, h: 88, color: ink, thickness: 1.5, fillColor: fill } as ShapeElement })));
      const groups: { title: string; values: FlowchartShape[] }[] = [
        { title: "Flowchart", values: ["process", "terminator", "decision", "data", "document", "database", "predefined-process", "preparation", "manual-input", "connector", "off-page", "delay", "manual-operation", "stored-data", "cloud"] },
        { title: "Block shapes", values: ["hexagon", "parallelogram", "trapezoid", "pentagon", "octagon", "chevron", "cross", "folder", "note", "display", "cube", "rounded-rectangle", "shield"] },
        { title: "Decorative", values: ["star", "lightning", "heart", "callout", "gear"] },
      ];
      for (const group of groups) {
        const items = FLOWCHART_SHAPES.filter(shape => group.values.includes(shape.value)).map(shape => ({ label: shape.label, shape: { type: "flowchart" as const, x: 0, y: 0, w: 148, h: 88, color: ink, thickness: 1.5, fillColor: fill, flowchartShape: shape.value } as ShapeElement }));
        addSection(group.title, items);
      }
      const bounds = unionBounds(catalog.map(elementBounds));
      if (!bounds) return;
      const rect = canvas.getBoundingClientRect(); const view = canvasState();
      const center = { x: (rect.width / 2 - view.panX) / view.zoom, y: (rect.height / 2 - view.panY) / view.zoom };
      const positioned = catalog.map(item => moveElement(item, center.x - bounds.x - bounds.w / 2, center.y - bounds.y - bounds.h / 2));
      pushUndo(cloneElements(elements())); setElements(current => [...current, ...positioned]); setSelectedIndices([]); setTool("select"); setSidebarTab("properties"); setOpenToolOptions(undefined); setDirty(true); setError("");
      requestAnimationFrame(() => fitDocumentToViewport(positioned));
    } catch (cause) {
      setError(`Could not spawn the shape catalog: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally { setShapeCatalogBusy(false); }
  }

  async function readSourceTextFile(title: string, name: string, extensions: string[]) {
    const selected = await open({ title, multiple: false, filters: [{ name, extensions }] });
    if (!selected || Array.isArray(selected)) return undefined;
    return readTextFile(selected);
  }

  async function loadSchemaSourceFile(updateSelectedSchema = false) {
    try {
      const source = await readSourceTextFile("Open SQL or JSON schema", "SQL or JSON schema", ["sql", "json", "txt"]);
      if (source !== undefined) {
        if (updateSelectedSchema) scheduleSchemaVisualUpdate(source);
        else { setSchemaInput(source); setSchemaError(""); }
      }
    }
    catch (cause) { setSchemaError(`Could not read schema file: ${cause instanceof Error ? cause.message : String(cause)}`); }
  }

  // Debounce source edits so the preview stays responsive without rebuilding the diagram for every keystroke.
  function scheduleSchemaVisualUpdate(value: string) {
    const diagramId = schemaPanelDiagramId();
    setSchemaInput(value);
    setSchemaError("");
    if (!diagramId || boardLocked() || readOnlyView()) return;
    if (schemaLiveTimer !== undefined) window.clearTimeout(schemaLiveTimer);
    schemaLivePending = { value, diagramId };
    schemaLiveTimer = window.setTimeout(() => {
      const pending = schemaLivePending;
      schemaLivePending = undefined;
      schemaLiveTimer = undefined;
      if (pending) void insertSchemaVisual(true, pending.value, pending.diagramId);
    }, 400);
  }

  // Apply a pending edit immediately when the user leaves the source field.
  function flushSchemaVisualUpdate() {
    if (schemaLiveTimer !== undefined) window.clearTimeout(schemaLiveTimer);
    schemaLiveTimer = undefined;
    const pending = schemaLivePending;
    schemaLivePending = undefined;
    if (pending) void insertSchemaVisual(true, pending.value, pending.diagramId);
  }
  onCleanup(() => { if (schemaLiveTimer !== undefined) window.clearTimeout(schemaLiveTimer); });

  function openSchemaDialog(diagramId?: string, initialSource?: string) {
    setSchemaError(""); setSchemaEditingDiagram(diagramId);
    const source = diagramId ? elements().find((item): item is SchemaTableElement => item.type === "schemaTable" && item.schemaDiagramId === diagramId)?.schemaSource : undefined;
    setSchemaInput(source ?? initialSource ?? ""); setSchemaDialog(true); setStencilMenuOpen(false);
  }

  // Add a SQL-backed table to the active schema when possible; otherwise begin a new schema diagram.
  async function addDatabaseTable() {
    if (!activePath() || boardLocked() || readOnlyView() || schemaImporting()) return;
    const schemaTables = elements().filter((item): item is SchemaTableElement => item.type === "schemaTable");
    const preferred = selectedSchemaTable();
    const target = preferred?.schemaSource.trim()
      ? preferred
      : schemaTables.find(table => table.schemaSource.trim());
    let source = "CREATE TABLE new_table (\n  id INTEGER PRIMARY KEY,\n  name TEXT\n);";

    if (target?.schemaSource.trim()) {
      try {
        const parsed = parseSchema(target.schemaSource);
        const names = new Set(parsed.map(table => table.name.toLowerCase()));
        let name = "new_table"; let suffix = 2;
        while (names.has(name.toLowerCase())) name = `new_table_${suffix++}`;
        source = `${target.schemaSource.trim()}\n\nCREATE TABLE ${name} (\n  id INTEGER PRIMARY KEY,\n  name TEXT\n);`;
        setSchemaInput(source); setSchemaError("");
        await insertSchemaVisual(true, source, target.schemaDiagramId);
        const index = elements().findIndex(item => item.type === "schemaTable" && item.schemaDiagramId === target.schemaDiagramId && item.name.toLowerCase() === name.toLowerCase());
        if (index >= 0) setSelectedIndices([index]);
        return;
      } catch {
        // A malformed current source should not prevent creating a separate valid table.
      }
    }

    setSchemaEditingDiagram(undefined); setSchemaInput(source); setSchemaError("");
    await insertSchemaVisual(false, source);
  }

  // Insert a chosen palette item through the same canvas and modeling helpers used elsewhere.
  function insertDesignPaletteItem(item: DesignPaletteItem) {
    if (!activePath() || readOnlyView() || boardLocked()) return;
    if (item.type === "schema-table") { if (!schemaImporting()) void addDatabaseTable(); return; }
    if (item.type === "component") {
      if (item.kind === "uml-class") {
        const definition = LIBRARY_COMPONENTS.find(component => component.kind === item.kind);
        if (definition && canvas) {
          const rect = canvas.getBoundingClientRect(); const view = canvasState();
          openClassCardDialog((rect.width / 2 - view.panX) / view.zoom - definition.width / 2, (rect.height / 2 - view.panY) / view.zoom - definition.height / 2);
        }
      } else void insertLibraryComponent(item.kind);
      return;
    }
    if (item.type === "custom-stencil") { insertCustomStencil(item.stencil); return; }
    if (item.type === "component-master") { insertComponentMaster(item.master); return; }
    if (item.type === "text") {
      const text: TextElement = { type: "text", x: 0, y: 0, text: "Text", color: color(), fontSize: defaultFontSize(), fontFamily: defaultFontFamily(), textAlign: "left" };
      placeImportedElements([text]); setSidebarTab("properties"); return;
    }
    if (item.type === "connector") {
      const w = 148; const h = 64;
      const shape: ShapeElement = item.connector === "line"
        ? { type: "line", x: 0, y: 0, w, h, color: color(), thickness: thickness(), lineStyle: item.lineStyle, lineRoute: item.route as LineRoute, startHead: item.startHead, endHead: item.endHead }
        : { type: "arrow", x: 0, y: 0, w, h, color: color(), thickness: thickness(), lineStyle: item.lineStyle, arrowRoute: item.route as ArrowRoute, startHead: item.startHead, endHead: item.endHead, ...(item.route === "forked" ? { forkUpper: { endHead: item.endHead }, forkLower: { endHead: item.endHead } } : {}) };
      placeImportedElements([shape]); setSidebarTab("properties"); return;
    }

    const isFilledShape = item.type === "flowchart" || ["rectangle", "circle", "diamond", "triangle"].includes(item.shape);
    const shape: ShapeElement = item.type === "flowchart"
      ? { type: "flowchart", x: 0, y: 0, w: 148, h: 88, color: color(), thickness: thickness(), flowchartShape: item.shape, ...(fillEnabled() ? { fillColor: fillColor(), fillOpacity: fillOpacity() } : {}) }
      : { type: item.shape, x: 0, y: 0, w: 148, h: 88, color: color(), thickness: thickness(), lineStyle: lineStyle(), edgeStyle: edgeStyle(), ...(isFilledShape && fillEnabled() ? { fillColor: fillColor(), fillOpacity: fillOpacity() } : {}) };
    placeImportedElements([shape]); setSidebarTab("properties");
  }

  function closeMermaidDialog() {
    setMermaidDialog(false); setMermaidEditingDiagram(undefined); setMermaidError(""); setMermaidFormat("mermaid");
  }

  function openMermaidDialog(diagramId?: string, requestedFormat: "mermaid" | "plantuml" = "mermaid") {
    const existing = diagramId ? elements().find((item): item is Extract<Element, { type: "group" }> => item.type === "group" && item.id === diagramId && !!item.mermaid) : undefined;
    if (diagramId && !existing) { setMermaidError("This Mermaid diagram is no longer available."); return; }
    const format = existing?.mermaid?.format ?? requestedFormat;
    setMermaidFormat(format);
    setMermaidInput(existing?.mermaid?.source ?? (format === "plantuml" ? "@startuml\nclass User {\n  id: UUID\n  name: string\n}\nclass Order {\n  id: UUID\n}\nUser \"1\" --> \"many\" Order : places\n@enduml" : "flowchart TD\n  Start([Start]) --> Check{Ready?}\n  Check -->|Yes| Done[Finish]\n  Check -->|No| Wait[Wait]"));
    setMermaidError(""); setMermaidEditingDiagram(existing?.id); setMermaidDialog(true); setStencilMenuOpen(false);
  }

  async function loadDiagramCodeSourceFile() {
    const plantUml = mermaidFormat() === "plantuml";
    try {
      const source = await readSourceTextFile(plantUml ? "Open PlantUML source" : "Open Mermaid source", plantUml ? "PlantUML source" : "Mermaid source", plantUml ? ["puml", "plantuml", "txt"] : ["mmd", "mermaid", "txt"]);
      if (source !== undefined) { setMermaidInput(source); setMermaidError(""); }
    } catch (cause) { setMermaidError(`Could not read source file: ${cause instanceof Error ? cause.message : String(cause)}`); }
  }

  function insertMermaidDiagram() {
    if (!activePath() || boardLocked() || !canvas) return;
    try {
      const source = mermaidInput().trim(); const format = mermaidFormat();
      const isSequence = format === "mermaid" && /^\s*sequenceDiagram\b/im.test(source);
      const parsed = format === "mermaid" && !isSequence ? parseMermaidFlowchart(source) : undefined;
      const parsedSequence = isSequence ? parseMermaidSequence(source) : undefined;
      const editingId = mermaidEditingDiagram(); const oldIndex = editingId ? elements().findIndex(item => item.type === "group" && item.id === editingId && !!item.mermaid) : -1;
      if (editingId && oldIndex < 0) throw new Error("This Mermaid diagram is no longer available.");
      const existing = oldIndex >= 0 ? elements()[oldIndex] as Extract<Element, { type: "group" }> : undefined;
      if (existing && !window.confirm("Replacing this generated diagram rebuilds its contents and can reset manual layout. Continue?")) return;
      const rect = canvas.getBoundingClientRect(); const view = canvasState(); const bounds = existing ? elementBounds(existing) : undefined;
      const center = bounds ? { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 } : { x: (rect.width / 2 - view.panX) / view.zoom, y: (rect.height / 2 - view.panY) / view.zoom };
      let children = format === "mermaid" ? isSequence ? layoutMermaidSequence(parsedSequence!, center) : layoutMermaidFlowchart(parsed!, center) : plantUmlToDiagram(source);
      if (format === "plantuml") { const sourceBounds = unionBounds(children.map(elementBounds)); if (sourceBounds) children = children.map(item => moveElement(item, center.x - sourceBounds.x - sourceBounds.w / 2, center.y - sourceBounds.y - sourceBounds.h / 2)); }
      const group: Extract<Element, { type: "group" }> = existing
        ? { ...existing, elements: children, mermaid: { source, format } }
        : { type: "group", id: crypto.randomUUID(), elements: children, mermaid: { source, format } };
      const groupIndex = oldIndex >= 0 ? oldIndex : elements().length; const before = cloneElements(elements());
      if (oldIndex >= 0) setElements(items => items.map((item, index) => index === oldIndex ? group : item));
      else setElements(items => [...items, group]);
      setDiagramSourceDraft(source); setDiagramSourceMessage("");
      pushUndo(before); setSelectedIndices([groupIndex]); setTool("select"); setSidebarTab("properties"); closeMermaidDialog(); setDirty(true);
    } catch (cause) { setMermaidError(cause instanceof Error ? cause.message : String(cause)); }
  }

  function editSelectedDiagramSource() {
    const group = selectedDiagramCodeGroup(); if (!group) return;
    openMermaidDialog(group.id, group.mermaid?.format ?? "mermaid");
    setMermaidInput(diagramSourceDraft());
  }

  function updateSelectedDiagramSourceFromCanvas() {
    const group = selectedDiagramCodeGroup(); if (!group) return;
    try {
      const format: DiagramCodeFormat = group.mermaid?.format === "plantuml" ? "puml" : "mmd";
      const source = exportDiagramCode(format, [group]);
      changeSelected(item => item.type === "group" && item.id === group.id && item.mermaid ? { ...item, mermaid: { ...item.mermaid, source } } : item);
      setDiagramSourceDraft(source); setDiagramSourceMessage("Source updated from the current canvas structure.");
    } catch (cause) { setDiagramSourceMessage(cause instanceof Error ? cause.message : String(cause)); }
  }

  async function copySelectedDiagramSource() {
    try { await navigator.clipboard.writeText(diagramSourceDraft()); setDiagramSourceMessage("Source copied to clipboard."); }
    catch { setDiagramSourceMessage("Clipboard access is unavailable. Select the source and copy it manually."); }
  }

  function insertChart(chartData: ReturnType<typeof chartDataFromCsv>, kind = csvChartKind()) {
    if (!activePath() || boardLocked() || !canvas) return;
    const rect = canvas.getBoundingClientRect(); const view = canvasState();
    const center = { x: (rect.width / 2 - view.panX) / view.zoom, y: (rect.height / 2 - view.panY) / view.zoom };
    const chart = buildLibraryComponent(kind, center.x - 190, center.y - 125, { chartData });
    const index = elements().length; pushUndo(cloneElements(elements())); setElements(items => [...items, chart]); setSelectedIndices([index]); setTool("select"); setSidebarTab("properties"); setDirty(true); setCsvChartOpen(false); setCsvChartError("");
  }

  function openCsvChartDialog(chartId?: string, source?: string) {
    const candidate = chartId ? elements().find((item): item is GroupElement => item.type === "group" && item.id === chartId) : selectedRootElement();
    const kind = candidate?.type === "group" ? candidate.libraryComponent?.kind : undefined;
    const chartData = candidate?.type === "group" && kind?.startsWith("viz-") ? candidate.componentOverrides?.chartData ?? candidate.libraryComponent?.chartData : undefined;
    setCsvChartError("");
    if (candidate?.type === "group" && kind?.startsWith("viz-") && chartData && candidate.id) {
      const csv = chartDataToCsv(chartData);
      const columns = parseCsv(csv).headers.length;
      setCsvEditingChartId(candidate.id); setCsvChartInput(csv); setCsvChartLabelColumn(0); setCsvChartSeriesColumns(Array.from({ length: Math.max(0, columns - 1) }, (_value, index) => index + 1)); setCsvChartKind(kind as LibraryChartKind);
    } else if (source !== undefined) {
      const columns = parseCsv(source).headers.length;
      setCsvEditingChartId(undefined); setCsvChartInput(source); setCsvChartLabelColumn(0); setCsvChartSeriesColumns(Array.from({ length: Math.max(0, columns - 1) }, (_value, index) => index + 1)); setCsvChartKind("viz-bar");
    } else {
      setCsvEditingChartId(undefined); setCsvChartInput("Category,Sales,Costs\nNorth,42,18\nSouth,35,21\nWest,58,24"); setCsvChartLabelColumn(0); setCsvChartSeriesColumns([1, 2]); setCsvChartKind("viz-bar");
    }
    setCsvChartOpen(true);
  }

  const csvEditingChart = () => { const item = elements().find(element => element.id === csvEditingChartId()); return item?.type === "group" ? item : undefined; };
  const closeCsvChartDialog = () => { setCsvChartOpen(false); setCsvEditingChartId(undefined); setCsvChartError(""); };

  async function loadCsvChartSourceFile() {
    try { const source = await readSourceTextFile("Open CSV chart data", "CSV data", ["csv", "txt"]); if (source !== undefined) updateCsvChartInput(source); }
    catch (cause) { setCsvChartError(`Could not read CSV file: ${cause instanceof Error ? cause.message : String(cause)}`); }
  }

  function createChartFromCsv() {
    try {
      const data = chartDataFromCsv(csvChartInput(), csvChartLabelColumn(), csvChartSeriesColumns());
      const editingId = csvEditingChartId();
      if (!editingId) { insertChart(data); return; }
      const index = elements().findIndex(item => item.id === editingId);
      const existing = elements()[index];
      if (index < 0 || existing?.type !== "group" || !existing.libraryComponent?.kind.startsWith("viz-")) throw new Error("This chart is no longer available to edit.");
      const previous = existing.componentOverrides?.chartData ?? existing.libraryComponent.chartData;
      const priorByName = new Map(previous?.series?.map(series => [series.name, series]));
      const series = (data.series ?? []).map(item => { const prior = priorByName.get(item.name); return { ...item, ...(prior?.chartType ? { chartType: prior.chartType } : {}), ...(prior?.axis ? { axis: prior.axis } : {}) }; });
      const annotations = previous?.annotations?.flatMap(annotation => { const oldLabel = previous.labels[annotation.index]; const nextIndex = data.labels.indexOf(oldLabel); return nextIndex < 0 ? [] : [{ ...annotation, index: nextIndex }]; });
      const chartData: LibraryChartData = { ...previous, ...data, values: series[0]?.values ?? data.values, series, ...(annotations ? { annotations } : {}) };
      const before = cloneElements(elements());
      setElements(items => items.map(item => item.id !== editingId || item.type !== "group" ? item : item.masterId
        ? { ...item, componentOverrides: { ...item.componentOverrides, chartData } }
        : { ...item, libraryComponent: { ...item.libraryComponent!, kind: csvChartKind(), chartData } }));
      pushUndo(before); setSelectedIndices([index]); setTool("select"); setSidebarTab("properties"); setDirty(true); setCsvChartOpen(false); setCsvEditingChartId(undefined); setCsvChartError("");
    } catch (cause) { setCsvChartError(cause instanceof Error ? cause.message : String(cause)); }
  }

  function csvChartColumns() { try { return parseCsv(csvChartInput()).headers; } catch { return []; } }

  function updateCsvChartInput(value: string) {
    setCsvChartInput(value); setCsvChartError("");
    try { const count = parseCsv(value).headers.length; setCsvChartSeriesColumns(columns => columns.filter(column => column < count && column !== csvChartLabelColumn())); } catch { /* The user may still be entering a quoted or incomplete row. */ }
  }

  function createChartFromSelectedTable() {
    const selected = selectedRootElement();
    try {
      if (selected?.type === "schemaTable") {
        if (!selected.columns.length) throw new Error("The selected schema table has no columns to chart.");
        const rows = [["Field", "Primary key", "Foreign key", "Nullable"], ...selected.columns.map(column => [column.name, column.primaryKey ? "1" : "0", column.foreignTable ? "1" : "0", column.nullable === false ? "0" : "1"])];
        const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
        openCsvChartDialog(undefined, csv); return;
      }
      if (selected?.type === "group" && selected.note) {
        const block = findMarkdownTableBlock(selected.note.content);
        if (!block) throw new Error("The selected note has no Markdown table.");
        const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map(value => value.trim().replace(/\\\|/g, "|"));
        const rows = block.text.split(/\r?\n/).map(cells).filter((_, index) => index !== 1);
        const csv = rows.map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n");
        openCsvChartDialog(undefined, csv); return;
      }
      throw new Error("Select a schema table or a note containing a numeric Markdown table first.");
    } catch (cause) { setCsvChartError(cause instanceof Error ? cause.message : String(cause)); setCsvChartOpen(true); }
  }

  function placePlantUmlDiagram(source: string) {
    if (!activePath() || boardLocked() || !canvas) return;
    const children = plantUmlToDiagram(source);
    const sourceBounds = unionBounds(children.map(elementBounds));
    if (!sourceBounds) throw new Error("The PlantUML diagram has no drawable objects.");
    const rect = canvas.getBoundingClientRect(); const view = canvasState();
    const center = { x: (rect.width / 2 - view.panX) / view.zoom, y: (rect.height / 2 - view.panY) / view.zoom };
    const positioned = children.map(item => moveElement(item, center.x - sourceBounds.x - sourceBounds.w / 2, center.y - sourceBounds.y - sourceBounds.h / 2));
    const group: GroupElement = { type: "group", id: crypto.randomUUID(), elements: positioned, mermaid: { source, format: "plantuml" } };
    const index = elements().length; pushUndo(cloneElements(elements())); setElements(items => [...items, group]); setSelectedIndices([index]); setTool("select"); setSidebarTab("properties"); setDirty(true);
  }

  function placeMermaidDiagram(source: string) {
    if (!activePath() || boardLocked() || !canvas) return;
    const parsed = parseMermaidFlowchart(source);
    const rect = canvas.getBoundingClientRect(); const view = canvasState();
    const center = { x: (rect.width / 2 - view.panX) / view.zoom, y: (rect.height / 2 - view.panY) / view.zoom };
    const group: GroupElement = { type: "group", id: crypto.randomUUID(), elements: layoutMermaidFlowchart(parsed, center), mermaid: { source, format: "mermaid" } };
    const index = elements().length; pushUndo(cloneElements(elements())); setElements(items => [...items, group]); setSelectedIndices([index]); setTool("select"); setSidebarTab("properties"); setDirty(true);
  }

  // Turn parsed schema definitions into editable cards; live edits reuse card positions and field anchors.
  async function insertSchemaVisual(liveUpdate = false, liveSource?: string, liveDiagramId?: string) {
    const path = activePath(); const beforeElements = elements();
    if (!path || boardLocked() || !canvas || (!liveUpdate && schemaImporting()) || (liveUpdate && schemaLiveApplying)) return;
    const editingId = liveUpdate ? liveDiagramId : schemaEditingDiagram();
    if (liveUpdate && !editingId) return;
    if (liveUpdate) schemaLiveApplying = true;
    else setSchemaImporting(true);
    try {
      const source = (liveUpdate ? liveSource : schemaInput())?.trim() ?? "";
      const parsedTables = parseSchema(source); const tableNames = new Set<string>();
      for (const table of parsedTables) {
        const tableName = table.name.toLowerCase(); if (tableNames.has(tableName)) throw new Error(`Table "${table.name}" appears more than once.`); tableNames.add(tableName);
        const columnNames = new Set<string>(); for (const column of table.columns) { const columnName = column.name.toLowerCase(); if (columnNames.has(columnName)) throw new Error(`Column "${column.name}" appears more than once in table "${table.name}".`); columnNames.add(columnName); }
      }

      const width = 170; const gapX = 64; const gapY = 42;
      const columnsPerRow = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(parsedTables.length))));
      const existing = editingId ? beforeElements.filter((item): item is SchemaTableElement => item.type === "schemaTable" && item.schemaDiagramId === editingId) : [];
      if (liveUpdate && !existing.length) throw new Error("Select a schema table before editing its source.");
      if (liveUpdate && existing.every(table => table.schemaSource === source)) return;
      const selectedTableIds = liveUpdate ? selectedElements().filter((item): item is SchemaTableElement => item.type === "schemaTable" && item.schemaDiagramId === editingId).flatMap(item => item.id ? [item.id] : []) : [];
      const selectedPrimaryId = liveUpdate ? selectedRootElement()?.id : undefined;
      const oldByName = new Map(existing.map(table => [table.name.toLowerCase(), table]));
      const cardFontSize = (table: (typeof parsedTables)[number]) => oldByName.get(table.name.toLowerCase())?.fontSize ?? defaultFontSize();
      const cardWidth = (table: (typeof parsedTables)[number]) => {
        const old = oldByName.get(table.name.toLowerCase());
        return old?.w ?? Math.max(width, schemaTableMinimumWidth(table.columns.map(column => ({ name: column.name, dataType: column.type })), cardFontSize(table), width, table.name));
      };
      const cardHeight = (table: (typeof parsedTables)[number]) => schemaTableMinimumHeight(table.columns.length, cardFontSize(table));
      const positions = new Map<string, Point>();
      if (!existing.length) {
        const columnWidths = Array.from({ length: columnsPerRow }, (_, col) => Math.max(...parsedTables.filter((_table, index) => index % columnsPerRow === col).map(cardWidth)));
        const rowHeights = Array.from({ length: Math.ceil(parsedTables.length / columnsPerRow) }, (_, row) => Math.max(...parsedTables.slice(row * columnsPerRow, (row + 1) * columnsPerRow).map(cardHeight)));
        const totalWidth = columnWidths.reduce((sum, item) => sum + item, 0) + (columnsPerRow - 1) * gapX;
        const totalHeight = rowHeights.reduce((sum, item) => sum + item, 0) + (rowHeights.length - 1) * gapY;
        const rect = canvas.getBoundingClientRect(); const view = canvasState();
        const originX = (rect.width / 2 - view.panX) / view.zoom - totalWidth / 2;
        const originY = (rect.height / 2 - view.panY) / view.zoom - totalHeight / 2;
        parsedTables.forEach((table, index) => {
          const row = Math.floor(index / columnsPerRow); const col = index % columnsPerRow;
          positions.set(table.name.toLowerCase(), { x: originX + columnWidths.slice(0, col).reduce((sum, current) => sum + current + gapX, 0), y: originY + rowHeights.slice(0, row).reduce((sum, current) => sum + current + gapY, 0) });
        });
      } else {
        const right = Math.max(...existing.map(table => table.x + table.w));
        let nextY = Math.min(...existing.map(table => table.y));
        for (const table of parsedTables) {
          const old = oldByName.get(table.name.toLowerCase());
          if (old) positions.set(table.name.toLowerCase(), { x: old.x, y: old.y });
          else { positions.set(table.name.toLowerCase(), { x: right + gapX, y: nextY }); nextY += cardHeight(table) + gapY; }
        }
      }

      const diagramId = editingId ?? crypto.randomUUID();
      const created: SchemaTableElement[] = parsedTables.map(table => {
        const old = oldByName.get(table.name.toLowerCase());
        const fieldsByName = new Map(old?.columns.map(field => [field.name.toLowerCase(), field]) ?? []);
        const fields: SchemaField[] = table.columns.map(column => ({ id: fieldsByName.get(column.name.toLowerCase())?.id ?? crypto.randomUUID(), name: column.name, dataType: column.type, primaryKey: column.primaryKey, foreignTable: column.foreignTable, foreignColumn: column.foreignColumn, nullable: column.nullable }));
        const fontSize = old?.fontSize ?? defaultFontSize(); const position = positions.get(table.name.toLowerCase())!;
        return { type: "schemaTable", id: old?.id ?? crypto.randomUUID(), schemaDiagramId: diagramId, schemaSource: source, name: table.name, columns: fields, ...(table.indexes?.length ? { indexes: table.indexes } : {}), ...(table.constraints?.length ? { constraints: table.constraints } : {}), ...position, w: cardWidth(table), h: cardHeight(table), fontSize, rotation: old?.rotation ?? 0, opacity: old?.opacity ?? 1 };
      });

      const byName = new Map(created.map(table => [table.name.toLowerCase(), table]));
      const relations: ShapeElement[] = schemaReferences(parsedTables).flatMap(reference => {
        const child = byName.get(reference.sourceTable.name.toLowerCase()); const parent = byName.get(reference.targetTable.name.toLowerCase());
        const childField = child?.columns.find(column => column.name.toLowerCase() === reference.sourceColumn.name.toLowerCase());
        const parentField = parent?.columns.find(column => column.name.toLowerCase() === reference.targetColumn.name.toLowerCase());
        if (!child?.id || !parent?.id || !childField || !parentField) return [];
        const parentIsLeft = parent.x + parent.w / 2 <= child.x + child.w / 2;
        const startBinding: Binding = { elementId: parent.id, rowId: parentField.id, anchor: { x: parentIsLeft ? 1 : 0, y: .5 } };
        const endBinding: Binding = { elementId: child.id, rowId: childField.id, anchor: { x: parentIsLeft ? 0 : 1, y: .5 } };
        const start = anchorPoint(parent, startBinding.anchor, startBinding.rowId); const end = anchorPoint(child, endBinding.anchor, endBinding.rowId);
        return [{ type: "line", id: crypto.randomUUID(), schemaDiagramId: diagramId, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color: "#63859d", thickness: 1.6, lineStyle: "solid", startHead: "bar", endHead: "crow", autoRoute: true, lineRoute: "straight", startBinding, endBinding }];
      });

      let imported: Element[] = [...relations, ...created];
      if (!liveUpdate && !existing.length && created.length > 1) {
        const { autoLayoutElements } = await import("./features/diagrams/auto-layout");
        imported = await autoLayoutElements(imported, [], "RIGHT", "erd", "layered", "page", 48, isElementHidden, isElementLocked);
        if (activePath() !== path || elements() !== beforeElements) return;
        const tableBounds = unionBounds(imported.filter((item): item is SchemaTableElement => item.type === "schemaTable").map(elementBounds));
        if (tableBounds) {
          const rect = canvas.getBoundingClientRect(); const view = canvasState();
          const centerX = (rect.width / 2 - view.panX) / view.zoom; const centerY = (rect.height / 2 - view.panY) / view.zoom;
          const dx = centerX - tableBounds.x - tableBounds.w / 2; const dy = centerY - tableBounds.y - tableBounds.h / 2;
          imported = imported.map(item => item.type === "schemaTable"
            ? { ...item, x: item.x + dx, y: item.y + dy }
            : isConnector(item) ? { ...item, x: item.x + dx, y: item.y + dy, routePoints: item.routePoints?.map(point => ({ x: point.x + dx, y: point.y + dy })), routeWaypoints: item.routeWaypoints?.map(point => ({ x: point.x + dx, y: point.y + dy })) } : item);
        }
      }
      if (activePath() !== path || elements() !== beforeElements) return;

      const existingIds = new Set(existing.flatMap(table => table.id ? [table.id] : []));
      const removedRelations = new Set(beforeElements.filter(item => isConnector(item) && item.schemaDiagramId === diagramId).flatMap(item => item.id ? [item.id] : []));
      const oldIds = new Set([...existingIds, ...removedRelations]);
      const kept = beforeElements.filter(item => !oldIds.has(item.id ?? ""));
      const updatedElements = resolveBindings([...kept, ...imported]);
      if (liveUpdate) {
        // One undo entry covers the full typing session, even though each valid edit redraws immediately.
        if (schemaLiveUndoDiagramId !== diagramId || !schemaLiveUndoBefore) {
          schemaLiveUndoDiagramId = diagramId;
          schemaLiveUndoBefore = cloneElements(beforeElements);
          pushUndo(schemaLiveUndoBefore);
        }
        if (activeSchemaPanelDiagramId === diagramId) lastAppliedSchemaSource = source;
        setElements(updatedElements);
        const selectedIndexes = selectedTableIds.map(id => updatedElements.findIndex(item => item.id === id)).filter(index => index >= 0);
        if (selectedIndexes.length) setSelectedIndices(selectedIndexes);
        else {
          const fallbackId = selectedPrimaryId && created.some(table => table.id === selectedPrimaryId) ? selectedPrimaryId : created[0]?.id;
          const fallbackIndex = fallbackId ? updatedElements.findIndex(item => item.id === fallbackId) : -1;
          setSelectedIndices(fallbackIndex >= 0 ? [fallbackIndex] : []);
        }
      } else {
        pushUndo(cloneElements(beforeElements)); setElements(updatedElements);
        const firstIndex = kept.length; setSelectedIndices(created.map((_item, index) => firstIndex + relations.length + index)); setTool("select"); setTextMode("text");
        setSchemaDialog(false); setSchemaInput(""); setSchemaError(""); setSchemaEditingDiagram(undefined);
      }
      setDirty(true);
    } catch (cause) {
      if (activePath() === path && (!liveUpdate || schemaPanelDiagramId() === editingId)) setSchemaError(cause instanceof Error ? cause.message : String(cause));
    }
    finally { if (liveUpdate) schemaLiveApplying = false; else setSchemaImporting(false); }
  }

  function fitDocumentToViewport(items: Element[]) {
    if (!canvas || items.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    const bounds = unionBounds(items.filter((element) => !isElementHidden(element)).map(elementBounds)); if (!bounds) return;
    const { x: left, y: top } = bounds; const right = left + bounds.w; const bottom = top + bounds.h;
    const width = Math.max(1, right - left); const height = Math.max(1, bottom - top);
    const inset = sidebarVisible() ? 330 : 40; const availableWidth = Math.max(100, rect.width - inset - 40); const availableHeight = Math.max(100, rect.height - 180);
    const zoom = Math.max(0.02, Math.min(4, availableWidth / width, availableHeight / height));
    setCanvasState(current => ({ ...current, zoom, panX: inset + (availableWidth - width * zoom) / 2 - left * zoom, panY: 90 + (availableHeight - height * zoom) / 2 - top * zoom, backgroundColor: renderedBoardColor(), boardColorFollowsTheme: boardColorFollowsTheme() }));
    setDirty(!readOnlyView());
  }

  function resetZoomAndCenter() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); const current = canvasState();
    const centerWorld = { x: (rect.width / 2 - current.panX) / current.zoom, y: (rect.height / 2 - current.panY) / current.zoom };
    setCanvasState(current => ({ ...current, zoom: 1, panX: rect.width / 2 - centerWorld.x, panY: rect.height / 2 - centerWorld.y, backgroundColor: renderedBoardColor(), boardColorFollowsTheme: boardColorFollowsTheme() })); setDirty(!readOnlyView());
  }

  function hitElement(element: Element, point: Point, zoom: number, eraserSizePx?: number): boolean {
    if (isElementHidden(element) || isElementLocked(element)) return false;
    const eraserTolerance = eraserSizePx === undefined ? undefined : Math.max(1, eraserSizePx / 2) / zoom;
    if (element.type === "group") {
      if (element.rotation && (element.libraryComponent || element.container)) {
        const bounds = elementBounds(element); const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }; const angle = -element.rotation * Math.PI / 180;
        const dx = point.x - center.x; const dy = point.y - center.y; point = { x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle) };
      }
      if (element.componentBounds && element.libraryComponent && !element.container) { const tolerance = Math.max(5 / zoom, eraserTolerance ?? 0); return point.x >= element.componentBounds.x - tolerance && point.x <= element.componentBounds.x + element.componentBounds.w + tolerance && point.y >= element.componentBounds.y - tolerance && point.y <= element.componentBounds.y + element.componentBounds.h + tolerance; }
      if (element.container?.clipChildren && element.componentBounds && !containsPoint(element.componentBounds, point)) return false;
      if (element.elements.some((child) => hitElement(child, point, zoom, eraserSizePx))) return true;
      if (element.container && element.componentBounds) { const tolerance = Math.max(5 / zoom, eraserTolerance ?? 0); return containsPoint({ x: element.componentBounds.x - tolerance, y: element.componentBounds.y - tolerance, w: element.componentBounds.w + tolerance * 2, h: element.componentBounds.h + tolerance * 2 }, point); }
      if (element.mermaid) { const box = elementBounds(element); const tolerance = Math.max(5 / zoom, eraserTolerance ?? 0); return point.x >= box.x - tolerance && point.x <= box.x + box.w + tolerance && point.y >= box.y - tolerance && point.y <= box.y + box.h + tolerance; }
      return false;
    }
    const box = elementBounds(element); const center = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    if (element.rotation) { const angle = -element.rotation * Math.PI / 180; const dx = point.x - center.x; const dy = point.y - center.y; point = { x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle) }; }
    const tolerance = eraserTolerance === undefined ? Math.max(5 / zoom, "thickness" in element ? element.thickness / 2 + 2 / zoom : 2 / zoom) : Math.max(eraserTolerance, "thickness" in element ? element.thickness / 2 : 0);
    if (element.type === "svgPath") {
      const context = canvas?.getContext("2d"); if (!context || !element.pathData || !element.pathWidth || !element.pathHeight) return false;
      try {
        const path = new Path2D(element.pathData); const local = { x: (point.x - element.x) * element.pathWidth / element.w, y: (point.y - element.y) * element.pathHeight / element.h };
        context.save(); context.setTransform(1, 0, 0, 1, 0, 0);
        const inside = !!element.fillColor && context.isPointInPath(path, local.x, local.y, element.fillRule ?? "nonzero");
        const scale = Math.min(element.w / element.pathWidth, element.h / element.pathHeight); context.lineWidth = Math.max(1, element.thickness / scale + tolerance * 2 / scale);
        const border = element.svgStroke !== false && context.isPointInStroke(path, local.x, local.y); context.restore(); return inside || border;
      } catch { return false; }
    }
    if (element.type === "image") return point.x >= element.x - tolerance && point.x <= element.x + element.w + tolerance && point.y >= element.y - tolerance && point.y <= element.y + element.h + tolerance;
    if (element.type === "schemaTable") return point.x >= element.x - tolerance && point.x <= element.x + element.w + tolerance && point.y >= element.y - tolerance && point.y <= element.y + element.h + tolerance;
    if (element.type === "text") {
      const bounds = elementBounds(element);
      return point.x >= bounds.x - tolerance && point.x <= bounds.x + bounds.w + tolerance && point.y >= bounds.y - tolerance && point.y <= bounds.y + bounds.h + tolerance;
    }
    if (element.type === "line" || element.type === "arrow") {
      if (element.label?.text || element.relationshipType || element.cardinality) { const textBox = labelBox(relationshipDisplayElement(element)); if (point.x >= textBox.x && point.x <= textBox.x + textBox.w && point.y >= textBox.y && point.y <= textBox.y + textBox.h) return true; }
      const routed = connectorForView(element);
      const route = routed.type === "arrow" ? routed.arrowRoute ?? "straight" : routed.lineRoute ?? "straight";
      for (const samples of connectorPolylines(routed, route, 33)) for (let index = 1; index < samples.length; index++) if (distanceToSegment(point, samples[index - 1], samples[index]) <= tolerance + (routed.lineStyle === "double" ? 3 : 0)) return true;
      for (const { tip, angle: direction, kind } of arrowHeadEntries(routed, route)) {
        if (kind === "dot" && Math.hypot(point.x - tip.x, point.y - tip.y) <= Math.max(4, routed.thickness * 1.5) + tolerance) return true;
        const points = arrowHeadPoints(tip, direction, kind, routed.thickness);
        if ((kind === "solid" || kind === "thick" || kind === "diamond") && pointInPolygon(point, points)) return true;
        if (kind === "open" || kind === "crow") { for (const endpoint of points) if (distanceToSegment(point, tip, endpoint) <= tolerance) return true; }
        else {
          const closed = ["solid", "hollow", "thick", "diamond", "open-diamond"].includes(kind);
          const edgeCount = closed ? points.length : points.length - 1;
          for (let i = 0; i < edgeCount; i++) if (distanceToSegment(point, points[i], points[(i + 1) % points.length]) <= tolerance) return true;
        }
      }
      return false;
    }
    if (isLabelShape(element) && element.label?.text) { const box = labelBox(element); if (point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h) return true; }
    if (element.type === "freehand") {
      for (let i = 1; i < element.points.length; i++) if (distanceToSegment(point, element.points[i - 1], element.points[i]) <= tolerance) return true;
      return element.points.length === 1 && Math.hypot(point.x - element.points[0].x, point.y - element.points[0].y) <= tolerance;
    }
    if (isLabelShape(element)) {
      const context = canvas?.getContext("2d"); const path = shapePathObject(element);
      if (!context || !path) return false;
      context.save(); context.setTransform(1, 0, 0, 1, 0, 0);
      const inside = !!element.fillColor && context.isPointInPath(path, point.x, point.y, shapeFillRule(element));
      context.lineWidth = tolerance * 2;
      let border = context.isPointInStroke(path, point.x, point.y);
      const detailPath = shapeDetailPathObject(element);
      if (detailPath) border ||= context.isPointInStroke(detailPath, point.x, point.y);
      context.restore();
      return inside || border;
    }
    return false;
  }

  function hitTest(point: Point, eraserSizePx?: number): number | undefined {
    const zoom = canvasState().zoom;
    const tolerance = Math.max(12, eraserSizePx === undefined ? 0 : eraserSizePx / 2 + 4) / zoom;
    const items = elements();
    const candidates = activeElementSpatialIndex.query({ x: point.x - tolerance, y: point.y - tolerance, w: tolerance * 2, h: tolerance * 2 });
    for (let candidateIndex = candidates.length - 1; candidateIndex >= 0; candidateIndex--) {
      const index = candidates[candidateIndex];
      const element = items[index]; const bounds = elementBounds(element);
      if (!intersectsBounds(point.x - tolerance, point.y - tolerance, point.x + tolerance, point.y + tolerance, bounds)) continue;
      if (hitElement(element, point, zoom, eraserSizePx)) return index;
    }
    return undefined;
  }

  const componentViewCache = new WeakMap<Element, { key: string; element: Element }>();
  function simpleComponentElement(element: Element): Element {
    const isGraph = element.type === "group" && !!element.libraryComponent?.kind.startsWith("viz-");
    const appearance = isGraph ? "modern" : "simple";
    const librarySimple = element.type === "group" && !!element.libraryComponent && !isGraph;
    const classSimple = !!element.componentId?.startsWith("uml-class:");
    if (!librarySimple && !classSimple) return element;
    const key = `${appearance}:${theme()}`; const cached = componentViewCache.get(element);
    if (cached?.key === key) return cached.element;
    const styleOverrides = element.type === "group" ? element.libraryComponent?.styleOverrides : undefined;
    const ink = styleOverrides?.color ?? (theme() === "dark" ? "#e5e7eb" : "#26313b"); const stroke = styleOverrides?.color ?? (theme() === "dark" ? "#aeb8c2" : "#52606d");
    const simplify = (item: Element): Element => {
      if (item.type === "group") return { ...item, elements: item.elements.map(simplify) };
      if (item.type === "text") return { ...item, color: ink };
      if (item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "triangle" || item.type === "flowchart" || item.type === "line" || item.type === "arrow") {
        const originalFill = item.fillColor;
        const fillColor = styleOverrides?.fillColor === null ? undefined : styleOverrides?.fillColor ?? (originalFill ? (originalFill.toLowerCase() === "#ffffff" ? (theme() === "dark" ? "#202428" : "#ffffff") : theme() === "dark" ? "#3a424a" : "#e9edf1") : undefined);
        const label = item.label ? { ...item.label, color: ink } : undefined;
        return { ...item, color: stroke, fillColor, fillOpacity: fillColor ? styleOverrides?.fillOpacity ?? item.fillOpacity ?? 1 : 0, edgeStyle: item.edgeStyle ? "sharp" : item.edgeStyle, cornerRadius: 0, ...(label ? { label } : {}) };
      }
      return item;
    };
    const styled = librarySimple && element.type === "group" ? { ...element, elements: element.elements.map(simplify) } : simplify(element);
    componentViewCache.set(element, { key, element: styled });
    return styled;
  }

  function intersectsBounds(left: number, top: number, right: number, bottom: number, bounds: Bounds) {
    return bounds.x <= right && bounds.x + bounds.w >= left && bounds.y <= bottom && bounds.y + bounds.h >= top;
  }

  function containsPoint(bounds: Bounds, point: Point) { return point.x >= bounds.x && point.x <= bounds.x + bounds.w && point.y >= bounds.y && point.y <= bounds.y + bounds.h; }

  function resolveDraggedConnector(element: Element, index: number, drag: NonNullable<typeof moveOrigin>): Element {
    if (!isConnector(element) || drag.indices.includes(index)) return element;
    const movedPoint = (binding?: Binding) => {
      const target = binding ? drag.targets.get(binding.elementId) : undefined;
      if (!binding || !target || !isConnectable(target)) return undefined;
      const point = anchorPoint(target, binding.anchor, binding.rowId, binding.portId);
      return { x: point.x + drag.dx, y: point.y + drag.dy };
    };
    const moveBranch = (branch: ShapeElement["forkUpper"]) => {
      if (!branch?.endBinding) return branch;
      const end = movedPoint(branch.endBinding);
      return end ? { ...branch, end } : branch;
    };
    const start = movedPoint(element.startBinding); const end = movedPoint(element.endBinding);
    const forkUpper = moveBranch(element.forkUpper); const forkLower = moveBranch(element.forkLower);
    if (!start && !end && forkUpper === element.forkUpper && forkLower === element.forkLower) return element;
    const x = start?.x ?? element.x; const y = start?.y ?? element.y;
    return { ...element, x, y, w: (end?.x ?? element.x + element.w) - x, h: (end?.y ?? element.y + element.h) - y, forkUpper, forkLower };
  }

  function drawElement(ctx: CanvasRenderingContext2D, element: Element, viewport?: Bounds, sourceItems = elements()) {
    if (isElementHidden(element)) return;
    element = simpleComponentElement(element);
    if (element.type === "group") {
      if (element.note) { drawNoteCard(ctx, element, theme(), "simple"); return; }
      if (element.componentBounds && element.libraryComponent) {
        if (element.rotation) { const bounds = element.componentBounds; const centerX = bounds.x + bounds.w / 2; const centerY = bounds.y + bounds.h / 2; ctx.save(); ctx.translate(centerX, centerY); ctx.rotate(element.rotation * Math.PI / 180); ctx.translate(-centerX, -centerY); }
        if (element.libraryComponent.kind.startsWith("viz-")) drawLibraryChart(ctx, element, theme());
        else drawModelComponent(ctx, element, theme());
        if (element.container) {
          if (element.container.clipChildren) { ctx.save(); ctx.beginPath(); ctx.rect(element.componentBounds.x, element.componentBounds.y, element.componentBounds.w, element.componentBounds.h); ctx.clip(); }
          for (const child of element.elements) if (element.rotation || !viewport || intersectsBounds(viewport.x, viewport.y, viewport.x + viewport.w, viewport.y + viewport.h, elementBounds(child))) drawElement(ctx, connectorForView(child as ShapeElement, sourceItems), viewport, sourceItems);
          if (element.container.clipChildren) ctx.restore();
        }
        if (element.rotation) ctx.restore(); return;
      }
      if (element.container && element.componentBounds) {
        const bounds = element.componentBounds;
        ctx.save();
        if (element.rotation) { const centerX = bounds.x + bounds.w / 2; const centerY = bounds.y + bounds.h / 2; ctx.translate(centerX, centerY); ctx.rotate(element.rotation * Math.PI / 180); ctx.translate(-centerX, -centerY); }
        ctx.globalAlpha = 1;
        if (element.container.background) { ctx.fillStyle = element.container.background; ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h); }
        if (element.container.clipChildren) { ctx.beginPath(); ctx.rect(bounds.x, bounds.y, bounds.w, bounds.h); ctx.clip(); }
        for (const child of element.elements) if (element.rotation || !viewport || intersectsBounds(viewport.x, viewport.y, viewport.x + viewport.w, viewport.y + viewport.h, elementBounds(child))) drawElement(ctx, connectorForView(child as ShapeElement, sourceItems), viewport, sourceItems);
        ctx.restore();
        ctx.save();
        if (element.rotation) { const centerX = bounds.x + bounds.w / 2; const centerY = bounds.y + bounds.h / 2; ctx.translate(centerX, centerY); ctx.rotate(element.rotation * Math.PI / 180); ctx.translate(-centerX, -centerY); }
        const frame = element.container.kind === "frame";
        if (element.container.showBorder !== false) {
          const borderStyle = element.container.borderStyle ?? (frame ? "dashed" : "solid"); const borderWidth = element.container.borderThickness ?? 1.5;
          ctx.strokeStyle = themeInk(element.container.borderColor ?? "#667085", theme()); ctx.lineWidth = borderWidth;
          ctx.setLineDash(borderStyle === "dashed" ? [borderWidth * 4, borderWidth * 2.5] : borderStyle === "dotted" ? [borderWidth, borderWidth * 2.2] : []);
          ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
          if (borderStyle === "double") { ctx.setLineDash([]); const inset = Math.max(2, borderWidth * 1.5); ctx.strokeRect(bounds.x + inset, bounds.y + inset, Math.max(0, bounds.w - inset * 2), Math.max(0, bounds.h - inset * 2)); }
          ctx.setLineDash([]);
        }
        if (element.container.showLabel !== false && element.container.name.trim()) { ctx.font = `600 14px ${fontCss("sans")}`; ctx.textBaseline = "bottom"; ctx.fillStyle = themeInk("#475467", theme()); ctx.fillText(element.container.name, bounds.x + 8, bounds.y - 5); }
        ctx.restore(); return;
      }
      if (element.rotation && element.libraryComponent) { const bounds = elementBounds(element); const centerX = bounds.x + bounds.w / 2; const centerY = bounds.y + bounds.h / 2; ctx.save(); ctx.translate(centerX, centerY); ctx.rotate(element.rotation * Math.PI / 180); ctx.translate(-centerX, -centerY); }
      if (element.libraryComponent?.kind.startsWith("viz-")) { drawLibraryChart(ctx, element, theme()); if (element.rotation) ctx.restore(); return; }
      for (const child of element.elements) if (element.rotation || !viewport || intersectsBounds(viewport.x, viewport.y, viewport.x + viewport.w, viewport.y + viewport.h, elementBounds(child))) drawElement(ctx, connectorForView(child as ShapeElement, sourceItems), viewport, sourceItems);
      if (element.rotation && element.libraryComponent) ctx.restore(); return;
    }
    if (element.rotation) { const elementBox = elementBounds(element); const centerX = elementBox.x + elementBox.w / 2; const centerY = elementBox.y + elementBox.h / 2; ctx.save(); ctx.translate(centerX, centerY); ctx.rotate(element.rotation * Math.PI / 180); ctx.translate(-centerX, -centerY); }
    if (element.type === "image") {
      const image = imageCache.get(element.dataUrl);
      ctx.save(); ctx.globalAlpha = element.opacity ?? 1;
      if (image?.complete && image.naturalWidth) {
        const sx = element.cropX ?? 0; const sy = element.cropY ?? 0; const sw = element.cropW ?? image.naturalWidth; const sh = element.cropH ?? image.naturalHeight;
        ctx.drawImage(image, sx, sy, sw, sh, element.x, element.y, element.w, element.h);
      }
      ctx.restore(); if (element.rotation) ctx.restore(); return;
    }
    if (element.type === "svgPath") {
      try {
        const path = new Path2D(element.pathData ?? ""); const sx = element.w / (element.pathWidth ?? element.w); const sy = element.h / (element.pathHeight ?? element.h);
        ctx.save(); ctx.globalAlpha = element.opacity ?? 1; ctx.translate(element.x, element.y); ctx.scale(sx, sy);
        if (element.fillColor) { ctx.fillStyle = element.fillColor; ctx.globalAlpha = (element.opacity ?? 1) * (element.fillOpacity ?? 1); ctx.fill(path, element.fillRule ?? "nonzero"); }
        if (element.svgStroke !== false) { ctx.globalAlpha = element.opacity ?? 1; ctx.strokeStyle = themeInk(element.color, theme()); const shapeScale = Math.max(0.001, Math.min(Math.abs(sx), Math.abs(sy))); ctx.lineWidth = element.thickness / (shapeScale * (element.svgNonScalingStroke ? canvasState().zoom : 1)); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(path); }
        ctx.restore();
      } catch { /* Malformed legacy vector paths remain selectable by their bounds. */ }
      if (element.rotation) ctx.restore(); return;
    }
    if (element.type === "text") {
      if (textDraft()?.editingChildId === element.id || textDraft()?.editingIndex !== undefined && elements()[textDraft()!.editingIndex!]?.id === element.id) { if (element.rotation) ctx.restore(); return; }
      ctx.save(); ctx.globalAlpha = element.opacity ?? 1; ctx.fillStyle = themeInk(element.color, theme());
      ctx.font = (element.italic ? "italic " : "") + (element.bold ? "700 " : "400 ") + element.fontSize + "px " + fontCss(element.fontFamily); ctx.textBaseline = "top"; ctx.textAlign = element.textAlign === "justify" ? "left" : element.textAlign ?? "left";
      let lines = textLinesCache.get(element);
      if (!lines) { lines = element.text.split(/\n?\n/).map((line, index) => element.listType === "bullet" ? "• " + line : element.listType === "number" ? (index + 1) + ". " + line : line); textLinesCache.set(element, lines); }
      lines.forEach((line, index) => { const y = element.y + index * element.fontSize * 1.25; ctx.fillText(line, element.x, y); if (element.underline) { const measured = ctx.measureText(line).width; const startX = alignedTextStartX(element.x, measured, element.textAlign); ctx.fillRect(startX, y + element.fontSize * 1.06, measured, Math.max(1, element.fontSize / 18)); } }); ctx.restore(); if (element.rotation) ctx.restore(); return;
    }
    // Draw cards from shared metrics so field-bound connectors and exports use matching row positions.
    if (element.type === "schemaTable") {
      const left = element.x; const top = element.y; const width = Math.abs(element.w); const height = Math.abs(element.h);
      const { fontSize, titleHeight, rowHeight } = schemaTableMetrics(element.fontSize ?? 12);
      const contentInset = schemaTableContentInset(fontSize);
      const colors = schemaTableColors(theme()); const right = left + width; const rowsTop = top + titleHeight;
      ctx.save(); ctx.globalAlpha = element.opacity ?? 1;
      ctx.beginPath(); if (typeof ctx.roundRect === "function") ctx.roundRect(left, top, width, height, 4); else ctx.rect(left, top, width, height);
      ctx.shadowColor = theme() === "dark" ? "rgba(0,0,0,.28)" : "rgba(33,43,54,.14)"; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1; ctx.fillStyle = colors.surface; ctx.fill();
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.beginPath(); if (typeof ctx.roundRect === "function") ctx.roundRect(left, top, width, titleHeight, 4); else ctx.rect(left, top, width, titleHeight);
      ctx.fillStyle = colors.header; ctx.fill(); ctx.fillRect(left, top + titleHeight - 4, width, 4);
      ctx.beginPath(); ctx.moveTo(left, rowsTop); ctx.lineTo(right, rowsTop); ctx.strokeStyle = colors.divider; ctx.stroke();
      ctx.fillStyle = colors.title; ctx.font = `600 ${fontSize * .96}px ${fontCss("sans")}`; ctx.textBaseline = "middle"; ctx.textAlign = "left";
      ctx.fillText(fitSchemaTableText(element.name, width - contentInset * 2, fontSize * .96), left + contentInset, top + titleHeight / 2);
      element.columns.forEach((column, index) => {
        const rowTop = rowsTop + index * rowHeight; const middle = rowTop + rowHeight / 2;
        const unique = element.constraints?.some(constraint => constraint.kind === "unique" && constraint.columns?.some(name => name.toLowerCase() === column.name.toLowerCase())) ?? false;
        const layout = schemaTableRowLayout(left, width, column, fontSize, unique);
        layout.markers.forEach(marker => {
          const ink = marker.kind === "primary" ? colors.primaryKey : marker.kind === "foreign" ? colors.foreignKey : colors.required;
          ctx.fillStyle = ink; ctx.font = `700 ${Math.max(6, fontSize * .58)}px ${fontCss("sans")}`; ctx.textAlign = "left";
          ctx.fillText(marker.label, marker.x, middle);
        });
        ctx.font = `600 ${fontSize * .82}px ${fontCss("mono")}`; ctx.textAlign = "left"; ctx.fillStyle = colors.text;
        ctx.fillText(fitSchemaTableText(column.name, layout.fieldWidth, fontSize * .82), layout.fieldX, middle);
        ctx.font = `${fontSize * .7}px ${fontCss("mono")}`; ctx.textAlign = "right"; ctx.fillStyle = colors.muted;
        ctx.fillText(fitSchemaTableText(column.dataType || "type", layout.typeWidth, fontSize * .7), layout.typeRight, middle); ctx.textAlign = "left";
      });
      ctx.beginPath(); if (typeof ctx.roundRect === "function") ctx.roundRect(left, top, width, height, 4); else ctx.rect(left, top, width, height); ctx.strokeStyle = colors.border; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore(); if (element.rotation) ctx.restore(); return;
    }
    ctx.save(); ctx.globalAlpha = element.opacity ?? 1;
    const renderedInk = themeInk(element.color, theme());
    ctx.strokeStyle = renderedInk; ctx.lineWidth = element.thickness; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
    if ("lineStyle" in element) ctx.setLineDash(element.lineStyle === "dashed" ? [element.thickness * 4, element.thickness * 2.5] : element.lineStyle === "dotted" ? [element.thickness, element.thickness * 2.2] : []);
      if (element.type === "line" || element.type === "arrow") {
      const routeElement = element;
      const route = routeElement.type === "arrow" ? routeElement.arrowRoute ?? "straight" : routeElement.lineRoute ?? "straight";
      if (element.lineStyle === "double") {
        const paths = doubleConnectorPolylines(routeElement);
        // The shared geometry already returns the two offset paths; draw each once.
        ctx.beginPath();
        for (const points of paths) { if (!points.length) continue; ctx.moveTo(points[0].x, points[0].y); for (const point of points.slice(1)) ctx.lineTo(point.x, point.y); }
        ctx.stroke();
      } else { traceConnector(ctx, routeElement); ctx.stroke(); }
      if (element.type === "arrow" || element.type === "line") {
        for (const { tip, angle: direction, kind } of arrowHeadEntries(routeElement, route)) {
          if (kind === "none") continue;
          if (kind === "dot") { ctx.beginPath(); ctx.arc(tip.x, tip.y, Math.max(3, element.thickness * 1.15), 0, Math.PI * 2); ctx.fillStyle = renderedInk; ctx.fill(); continue; }
          const points = arrowHeadPoints(tip, direction, kind, element.thickness); ctx.beginPath();
          if (kind === "open") { ctx.moveTo(tip.x, tip.y); ctx.lineTo(points[0].x, points[0].y); ctx.moveTo(tip.x, tip.y); ctx.lineTo(points[1].x, points[1].y); }
          else if (kind === "crow") { for (const point of points) { ctx.moveTo(tip.x, tip.y); ctx.lineTo(point.x, point.y); } }
          else { ctx.moveTo(points[0].x, points[0].y); for (let index = 1; index < points.length; index++) ctx.lineTo(points[index].x, points[index].y); if (["solid", "hollow", "thick", "diamond", "open-diamond"].includes(kind)) ctx.closePath(); }
          if (["solid", "thick", "diamond"].includes(kind)) { ctx.fillStyle = renderedInk; ctx.fill(); }
          ctx.stroke();
        }
      }
      ctx.restore(); if (isConnector(element) && (element.label || element.relationshipType || element.cardinality) && textDraft()?.editingChildId !== element.id && !(textDraft()?.shapeLabel && elements()[textDraft()!.editingIndex!]?.id === element.id)) drawLabel(ctx, relationshipDisplayElement(element)); if (element.rotation) ctx.restore(); return;
    }
    if (element.type === "freehand") {
      freehandRenderer.draw(ctx, element, renderedInk);
      ctx.restore(); if (element.rotation) ctx.restore(); return;
    }
    const shapePath = shapePathObject(element);
    if (!shapePath) { ctx.restore(); if (element.rotation) ctx.restore(); return; }
    if (element.fillColor) {
      ctx.save(); ctx.globalAlpha = (element.opacity ?? 1) * (element.fillOpacity ?? fillOpacity()); ctx.fillStyle = element.fillColor;
      ctx.fill(shapePath, shapeFillRule(element)); ctx.restore();
    }
    ctx.stroke(shapePath);
    const shapeDetails = shapeDetailPathObject(element);
    if (shapeDetails) ctx.stroke(shapeDetails);
    ctx.restore(); if (isLabelShape(element) && textDraft()?.editingChildId !== element.id && !(textDraft()?.shapeLabel && elements()[textDraft()!.editingIndex!]?.id === element.id)) drawLabel(ctx, element); if (element.rotation) ctx.restore();
  }

  function drawLaserStroke(ctx: CanvasRenderingContext2D, points: Point[], opacity: number, thickness: number) {
    if (!points.length) return;
    ctx.save(); ctx.globalAlpha = opacity; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = thickness; ctx.shadowBlur = thickness * 2.2;
    if (points.length === 1) {
      ctx.beginPath(); ctx.arc(points[0].x, points[0].y, thickness / 2, 0, Math.PI * 2);
      ctx.fillStyle = laserRainbow() ? `hsl(${Date.now() / 22 % 360} 100% 62%)` : laserColor(); ctx.shadowColor = ctx.fillStyle; ctx.fill();
    } else if (laserRainbow()) {
      for (let index = 1; index < points.length; index++) {
        const hue = (Date.now() / 22 + index * 8) % 360; ctx.strokeStyle = `hsl(${hue} 100% 62%)`; ctx.shadowColor = ctx.strokeStyle;
        ctx.beginPath(); ctx.moveTo(points[index - 1].x, points[index - 1].y); ctx.lineTo(points[index].x, points[index].y); ctx.stroke();
      }
    } else {
      ctx.strokeStyle = laserColor(); ctx.shadowColor = laserColor(); ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length; index++) ctx.lineTo(points[index].x, points[index].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function findTransformHandle(point: Point): { index: number; handle: string } | undefined {
    if (selectedIndices().length !== 1) return undefined;
    const index = selectedIndices()[0]; const element = elements()[index]; if (!element || isElementLocked(element) || element.type === "freehand" || element.type === "group" && (!element.note || element.note.collapsed) && !element.libraryComponent && !element.container) return undefined;
    const canRotate = element.type !== "group" || !!element.libraryComponent || !!element.container;
    const rotation = element.rotation ?? 0;
    const handleBounds = rotation ? elementBounds({ ...element, rotation: 0 } as Element) : elementBounds(element);
    for (const handle of isConnector(element) ? connectorHandles(element) : transformHandlePoints(handleBounds, canvasState().zoom, canRotate, rotation)) {
      if (element.type === "schemaTable" && (handle.id === "n" || handle.id === "s")) continue;
      if (Math.hypot(point.x - handle.x, point.y - handle.y) <= 9 / canvasState().zoom) return { index, handle: handle.id };
    }
    return undefined;
  }

  function resizeElement(element: Element, handle: string, start: Point, point: Point, lockAspect = false): Element {
    if (element.type === "freehand") return element;
    if (element.type === "line" || element.type === "arrow") return resizeConnector(element, handle, point);
    if (handle === "rotate" && element.type === "group" && (element.libraryComponent || element.container)) {
      const bounds = elementBounds(element); const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
      const a = Math.atan2(start.y - center.y, start.x - center.x); const b = Math.atan2(point.y - center.y, point.x - center.x);
      return { ...element, rotation: (element.rotation ?? 0) + (b - a) * 180 / Math.PI };
    }
    if (element.rotation && handle !== "rotate") {
      const unrotated = { ...element, rotation: 0 } as Element;
      const base = elementBounds(unrotated); const center = { x: base.x + base.w / 2, y: base.y + base.h / 2 };
      const localStart = rotateCanvasPoint(start, center, -element.rotation); const localPoint = rotateCanvasPoint(point, center, -element.rotation);
      const resized = resizeElement(unrotated, handle, localStart, localPoint, lockAspect); const next = elementBounds(resized);
      const anchor = (bounds: Bounds) => ({
        x: handle.includes("e") ? bounds.x : handle.includes("w") ? bounds.x + bounds.w : bounds.x + bounds.w / 2,
        y: handle.includes("s") ? bounds.y : handle.includes("n") ? bounds.y + bounds.h : bounds.y + bounds.h / 2,
      });
      const fixedBefore = rotateCanvasPoint(anchor(base), center, element.rotation);
      const nextCenter = { x: next.x + next.w / 2, y: next.y + next.h / 2 };
      const fixedAfter = rotateCanvasPoint(anchor(next), nextCenter, element.rotation);
      const anchored = moveElement(resized, fixedBefore.x - fixedAfter.x, fixedBefore.y - fixedAfter.y);
      return { ...anchored, rotation: element.rotation } as Element;
    }
    if (element.type === "group") {
      if (element.container && !element.libraryComponent) {
        if (element.container.lockedSize) return element;
        const before = elementBounds(element); const dx = point.x - start.x; const dy = point.y - start.y;
        const resizeAxis = (origin: number, size: number, delta: number, leading: boolean, minimum: number) => {
          const nextSize = Math.max(minimum, leading ? size - delta : size + delta);
          return { origin: leading ? origin + size - nextSize : origin, size: nextSize };
        };
        const horizontal = handle.includes("w") || handle.includes("e") ? resizeAxis(before.x, before.w, dx, handle.includes("w"), 25) : { origin: before.x, size: before.w };
        const vertical = handle.includes("n") || handle.includes("s") ? resizeAxis(before.y, before.h, dy, handle.includes("n"), 25) : { origin: before.y, size: before.h };
        const target = { x: horizontal.origin, y: vertical.origin, w: horizontal.size, h: vertical.size };
        return resizeContainerWithChildren(element, lockAspect ? lockAspectResizeBounds(before, target, handle, 25, 25) : target);
      }
      if (element.libraryComponent) {
        if (element.libraryComponent.kind === "uml-lifeline" && handle === "s") {
          const angle = (element.rotation ?? 0) * Math.PI / 180;
          const localLengthDelta = -(point.x - start.x) * Math.sin(angle) + (point.y - start.y) * Math.cos(angle);
          return setLibraryLifelineLength(element, libraryLifelineLength(element) + localLengthDelta);
        }
        const before = elementBounds(element); let { x, y, w, h } = before; const dx = point.x - start.x; const dy = point.y - start.y;
        if (handle.includes("w")) { x += dx; w -= dx; } if (handle.includes("e")) w += dx;
        if (handle.includes("n")) { y += dy; h -= dy; } if (handle.includes("s")) h += dy;
        const target = { x, y, w: Math.max(libraryComponentMinimum(element, "w"), w), h: Math.max(libraryComponentMinimum(element, "h"), h) };
        return resizeLibraryGroup(element, lockAspect ? lockAspectResizeBounds(before, target, handle, libraryComponentMinimum(element, "w"), libraryComponentMinimum(element, "h")) : target);
      }
      if (!element.note) return element;
      const before = elementBounds(element); let { x, y, w, h } = before; const dx = point.x - start.x; const dy = point.y - start.y;
      if (handle.includes("w")) { x += dx; w -= dx; } if (handle.includes("e")) w += dx;
      if (handle.includes("n")) { y += dy; h -= dy; } if (handle.includes("s")) h += dy;
      const next = { x, y, w: Math.max(180, Math.min(4000, w)), h: Math.max(100, Math.min(1_000_000, h)) };
      const rebuilt = buildNoteGroup(next.x, next.y, element.note.kind, element.note.content, { width: next.w, height: next.h, fontSize: element.note.fontSize, title: element.note.title, collapsed: element.note.collapsed });
      return { ...rebuilt, ...element, note: rebuilt.note, elements: rebuilt.elements.map((child, index) => element.elements[index]?.id ? { ...child, id: element.elements[index].id } as Element : child) };
    }
    if (handle === "rotate") {
      const bounds = elementBounds(element); const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
      const a = Math.atan2(start.y - center.y, start.x - center.x); const b = Math.atan2(point.y - center.y, point.x - center.x);
      return { ...element, rotation: (element.rotation ?? 0) + (b - a) * 180 / Math.PI };
    }
    if (element.type === "text") { const delta = handle.includes("e") || handle.includes("w") ? point.x - start.x : point.y - start.y; return { ...element, fontSize: Math.round(Math.max(8, Math.min(160, element.fontSize + delta * 0.3))) }; }
    const bounds = { x: Math.min(element.x, element.x + element.w), y: Math.min(element.y, element.y + element.h), w: Math.abs(element.w), h: Math.abs(element.h) };
    const dx = point.x - start.x; const dy = point.y - start.y;
    const minW = element.type === "schemaTable" ? schemaTableResizeMinimumWidth() : 25;
    const minH = element.type === "schemaTable" ? schemaTableMinimumHeight(element.columns.length, element.fontSize ?? 12) : 25;
    const resizeAxis = (origin: number, size: number, delta: number, fromLeadingEdge: boolean, minimum: number) => {
      const nextSize = Math.max(minimum, fromLeadingEdge ? size - delta : size + delta);
      return { origin: fromLeadingEdge ? origin + size - nextSize : origin, size: nextSize };
    };
    const horizontal = resizeAxis(bounds.x, bounds.w, dx, handle.includes("w"), minW);
    const vertical = element.type === "schemaTable"
      ? { origin: handle.includes("n") ? bounds.y + bounds.h - minH : bounds.y, size: minH }
      : resizeAxis(bounds.y, bounds.h, dy, handle.includes("n"), minH);
    const requested = { x: horizontal.origin, y: vertical.origin, w: horizontal.size, h: vertical.size };
    const next = lockAspect && element.type !== "schemaTable" ? lockAspectResizeBounds(bounds, requested, handle, minW, minH) : requested;
    return { ...element, ...next };
  }

  function snapResizePoint(element: Element, handle: string, start: Point, point: Point, bypass = false): { point: Point } {
    if (bypass || handle === "rotate" || element.type === "text") return { point };
    const rotation = element.rotation ?? 0;
    const resizeBounds = rotation ? elementBounds({ ...element, rotation: 0 } as Element) : element.type === "group" ? elementBounds(element) : elementGridBounds(element) ?? elementBounds(element);
    const movesX = handle.includes("e") || handle.includes("w");
    const movesY = handle.includes("n") || handle.includes("s");
    if (!movesX && !movesY) return { point };

    const center = { x: resizeBounds.x + resizeBounds.w / 2, y: resizeBounds.y + resizeBounds.h / 2 };
    const localStart = rotation ? rotateCanvasPoint(start, center, -rotation) : start;
    const localPoint = rotation ? rotateCanvasPoint(point, center, -rotation) : point;
    const dx = localPoint.x - localStart.x; const dy = localPoint.y - localStart.y;
    const edgeX = handle.includes("w") ? resizeBounds.x + dx : resizeBounds.x + resizeBounds.w + dx;
    const edgeY = handle.includes("n") ? resizeBounds.y + dy : resizeBounds.y + resizeBounds.h + dy;
    const threshold = 8 / canvasState().zoom;
    const nearest = (position: number, axis: "x" | "y") => {
      const candidates: { target: number; correction: number }[] = [];
      if (snapToGrid()) {
        const probe = axis === "x" ? snapCanvasPoint({ x: position, y: 0 }, true, whiteboardStyle(), GRID_SIZE).x : snapCanvasPoint({ x: 0, y: position }, true, whiteboardStyle(), GRID_SIZE).y;
        if (Math.abs(probe - position) <= threshold) candidates.push({ target: probe, correction: probe - position });
      }
      if (!rotation) {
        const margin = 32 / Math.max(.02, canvasState().zoom);
        const nearby = activeElementSpatialIndex.query({ x: resizeBounds.x - margin, y: resizeBounds.y - margin, w: resizeBounds.w + margin * 2, h: resizeBounds.h + margin * 2 });
        for (const index of nearby) {
          if (index === resizeOrigin?.index) continue;
          const target = elements()[index]; if (!target || isElementHidden(target)) continue;
          const bounds = elementBounds(target);
          const values = axis === "x" ? [bounds.x, bounds.x + bounds.w / 2, bounds.x + bounds.w] : [bounds.y, bounds.y + bounds.h / 2, bounds.y + bounds.h];
          for (const value of values) if (Math.abs(value - position) <= threshold) candidates.push({ target: value, correction: value - position });
        }
      }
      return candidates.sort((a, b) => Math.abs(a.correction) - Math.abs(b.correction))[0];
    };
    const correctionX = movesX ? nearest(edgeX, "x") : undefined;
    const correctionY = movesY ? nearest(edgeY, "y") : undefined;
    const corrected = { x: movesX ? localPoint.x + (correctionX?.correction ?? 0) : localPoint.x, y: movesY ? localPoint.y + (correctionY?.correction ?? 0) : localPoint.y };
    return { point: rotation ? rotateCanvasPoint(corrected, center, rotation) : corrected };
  }

  const sceneRenderer = createCanvasSceneRenderer({
    elements, isHidden: isElementHidden, isLocked: isElementLocked, spatialIndex: () => activeElementSpatialIndex, canvasState, renderedBoardColor, whiteboardStyle, showGrid, gridSize: GRID_SIZE, selectedSet,
    moveOrigin: () => moveOrigin, resizeOrigin: () => resizeOrigin,
    hoveredIndex, boardLocked, tool, attachmentHint, marquee,
    tileCacheKey: () => `${theme()}|${canvasAssetRevision()}|${currentLayers().map(layer => `${layer.id}:${layer.hidden ? 1 : 0}`).join(",")}`, tileCacheAllowed: () => !textDraft() && !noteEditor() && !resizeOrigin && !labelMoveOrigin,
    laserTrail, laserThickness, preview, simulationTokenId: () => bpmnSimulationIndex() >= 0 ? bpmnSimulationSteps()[bpmnSimulationIndex()]?.elementId : undefined, currentPoints: () => currentPoints,
    lineStyle, edgeStyle, cornerRadius, fillEnabled, fillColor, fillOpacity,
    defaultLineStartHead, defaultLineEndHead, defaultStartHead, defaultEndHead, defaultForkUpperHead, defaultForkLowerHead,
    drawElement, drawLaserStroke, connectorForView, connectorHandles, resolveDraggedConnector, intersectsBounds,
    drawFreehandPreview: (ctx, element) => { ctx.save(); ctx.globalAlpha = element.opacity ?? 1; freehandRenderer.draw(ctx, element, themeInk(element.color, theme()), false, true); ctx.restore(); },
  });
  onCleanup(sceneRenderer.dispose);
  const drawScene = sceneRenderer.drawScene;

  const canvasRenderScheduler = createCanvasRenderScheduler({
    canvas: () => canvas, hasDocument: () => !!activePath(),
    hasStrokePreview: () => preview()?.type === "pen" && tool() === "pen",
    drawStrokePreview: sceneRenderer.drawStrokePreview,
    drawScene: (ctx, width, height, dpr, selection, strokePreview = true) => drawScene(ctx, width, height, dpr, selection, false, undefined, undefined, true, strokePreview),
  });
  const scheduleCanvasRender = canvasRenderScheduler.schedule;
  onCleanup(canvasRenderScheduler.dispose);
  onCleanup(stopBpmnSimulation);
  createEffect(() => { workspaceArea(); activePath(); elements(); canvasState(); preview(); bpmnSimulationIndex(); bpmnSimulationSteps(); laserTrail(); laserColor(); laserThickness(); laserRainbow(); laserFadeDuration(); attachmentHint(); tool(); textDraft(); selectedIndices(); hoveredIndex(); showGrid(); whiteboardStyle(); marquee(); theme(); boardColor(); boardColorFollowsTheme(); fillOpacity(); fillEnabled(); fillColor(); lineStyle(); edgeStyle(); cornerRadius(); defaultLineStartHead(); defaultLineEndHead(); defaultStartHead(); defaultEndHead(); defaultForkUpperHead(); defaultForkLowerHead(); boardLocked(); scheduleCanvasRender(); });
  let lastAndroidStylusConfig = "";
  createEffect(() => {
    if (!isAndroidPlatform()) return;
    const area = workspaceArea(); const selectedTool = tool(); const state = canvasState(); const mode = brushMode();
    const metrics = displayMetrics(); const rect = canvas?.getBoundingClientRect();
    void metrics.viewportWidth; void metrics.viewportHeight;
    const style: Record<BrushMode, { width: number; opacity: number }> = { fine: { width: 1, opacity: 1 }, pencil: { width: .72, opacity: .62 }, brush: { width: 2.2, opacity: .9 }, marker: { width: 3, opacity: .78 }, highlighter: { width: 6, opacity: .28 }, chalk: { width: 1.7, opacity: .48 } };
    const brush = style[mode];
    const enabled = !!rect && rect.width > 0 && rect.height > 0 && !!activePath() && area === "canvas" && selectedTool === "pen" && !readOnlyView() && !boardLocked() && !documentBusy() && !noteEditor() && !textDraft() && !touchStylePanel() && !quickStylePopover() && !openToolOptions() && !stencilMenuOpen() && !canvasOptionsOpen() && !contextMenu() && !helpOpen() && !recoveryPrompt() && !syncConflict();
    const config = {
      enabled,
      canvasLeft: rect?.left ?? 0,
      canvasTop: rect?.top ?? 0,
      canvasWidth: rect?.width ?? 0,
      canvasHeight: rect?.height ?? 0,
      color: color(),
      thickness: Math.max(mode === "highlighter" ? 12 : mode === "marker" ? 6 : 1, thickness() * brush.width),
      opacity: brush.opacity,
      zoom: state.zoom,
      brushMode: mode,
      pressureEnabled: penPressure(),
      tiltEnabled: penTilt(),
    };
    const serialized = JSON.stringify(config);
    if (serialized === lastAndroidStylusConfig) return;
    lastAndroidStylusConfig = serialized;
    void invoke("set_android_stylus_preview", { config }).catch(() => undefined);
  });
  onCleanup(() => {
    if (isAndroidPlatform()) void invoke("set_android_stylus_preview", { config: { enabled: false, canvasLeft: 0, canvasTop: 0, canvasWidth: 0, canvasHeight: 0, color: "#202124", thickness: 1, opacity: 1, zoom: 1, brushMode: "fine", pressureEnabled: true, tiltEnabled: true } }).catch(() => undefined);
  });
  onMount(() => {
    const previousHandler = window.__sketchDrawReceiveAndroidStylusSamples;
    window.__sketchDrawReceiveAndroidStylusSamples = receiveAndroidStylusSamples;
    onCleanup(() => { if (window.__sketchDrawReceiveAndroidStylusSamples === receiveAndroidStylusSamples) window.__sketchDrawReceiveAndroidStylusSamples = previousHandler; });
  });
  onMount(() => {
    const onVisibilityChange = () => {
      if (isAndroidPlatform() && !document.hidden && updateCheck() === "installing") setUpdateCheck("available");
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    onCleanup(() => document.removeEventListener("visibilitychange", onVisibilityChange));
  });
  onMount(() => {
    void getVersion().then(setAppVersion).catch(() => setAppVersion("Unavailable"));
    const timer = window.setTimeout(() => void checkForUpdates(true), 4000);
    onCleanup(() => window.clearTimeout(timer));
  });
  createEffect(() => { const session = noteEditorSession(); if (!session) return; requestAnimationFrame(() => { if (noteEditorTextarea?.isConnected) noteEditorTextarea.focus(); }); });
  createEffect(() => { exportOptionsOpen(); exportFormat(); exportScope(); exportMarqueeRegion(); exportPadding(); exportGrid(); exportTransparent(); exportWidth(); exportHeight(); pdfPaper(); pdfPageSet(); pdfRangeStart(); pdfRangeEnd(); pdfOrientation(); pdfLayout(); pages(); pdfDpi(); pdfMarginMm(); pdfOverlapMm(); pdfCustomWidthMm(); pdfCustomHeightMm(); pdfPreviewPage(); pdfColorMode(); pdfBleedMm(); pdfCropMarks(); pdfHeader(); pdfFooter(); elements(); selectedIndices(); canvasState(); theme(); boardColor(); whiteboardStyle(); renderExportPreview(); });
  function handleCanvasWheel(event: WheelEvent) {
    event.preventDefault();
    const target = event.currentTarget as HTMLCanvasElement;
    const bounds = target.getBoundingClientRect(); const px = event.clientX - bounds.left; const py = event.clientY - bounds.top;
    const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? event.deltaY * target.clientHeight : event.deltaY;
    const old = canvasState(); const nextZoom = Math.max(0.02, Math.min(8, old.zoom * Math.exp(-delta * 0.001)));
    const next = zoomCanvasStateAt(old, { x: px, y: py }, nextZoom);
    setCanvasState(next);
    if (panOrigin) panOrigin = { x: event.clientX, y: event.clientY, panX: next.panX, panY: next.panY };
    setDirty(!readOnlyView());
  }
  createEffect(() => {
    if (!activePath() || !canvas) return;
    const resize = new ResizeObserver(scheduleCanvasRender); resize.observe(canvas);
    const rawPen = (event: PointerEvent) => pointerRawUpdate(event);
    canvas.addEventListener("pointerrawupdate", rawPen as EventListener);
    window.addEventListener("resize", scheduleCanvasRender);
    window.visualViewport?.addEventListener("resize", scheduleCanvasRender);
    onCleanup(() => { resize.disconnect(); canvas.removeEventListener("pointerrawupdate", rawPen as EventListener); window.removeEventListener("resize", scheduleCanvasRender); window.visualViewport?.removeEventListener("resize", scheduleCanvasRender); });
  });
  createEffect(() => {
    const items = elements();
    const retained = new Set<string>();
    const visit = (children: Element[]) => { for (const child of children) { if (child.type === "image") retained.add(child.dataUrl); else if (child.type === "group") { if (child.componentBounds && child.libraryComponent?.iconSvg) cacheComponentIconImage(child, () => { setCanvasAssetRevision(version => version + 1); scheduleCanvasRender(); }); visit(child.elements); } } };
    visit(items);
    for (const key of imageCache.keys()) if (!retained.has(key)) imageCache.delete(key);
    for (const key of retained) if (!imageCache.has(key)) { const image = new Image(); image.onload = () => { if (imageCache.get(key) === image) { setCanvasAssetRevision(version => version + 1); scheduleCanvasRender(); } }; image.src = key; imageCache.set(key, image); }
  });
  createEffect(() => {
    if (!activePath() || !canvasWrap) return;
    const resize = new ResizeObserver(() => { setHistoryVersion((version) => version + 1); });
    resize.observe(canvasWrap);
    onCleanup(() => resize.disconnect());
  });

  createEffect(() => {
    if (syncConflict() || recoveryPrompt()) { setExportOptionsOpen(false); setPageDialog(undefined); setRenameFileOpen(false); setSchemaDialog(false); setMermaidDialog(false); setWebEmbedDialog(false); setShowClearConfirm(false); setContextMenu(undefined); closeToolOptions(); if (menu) menu.open = false; if (viewMenu) viewMenu.open = false; if (gestureMenu) gestureMenu.open = false; }
  });
  createEffect(() => {
    const open = pageDialog() || renameFileOpen() || schemaDialog() || validationOpen() || objectSearchOpen() || mermaidDialog() || webEmbedDialog() || exportOptionsOpen() || showClearConfirm() || recoveryPrompt() || syncConflict() || helpOpen() || (isWindowsPlatform() && shortcutDialogOpen());
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => { const dialog = document.querySelector<HTMLElement>("[aria-modal='true']"); (dialog?.querySelector<HTMLElement>("[autofocus], input, button") ?? dialog)?.focus(); });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>("[aria-modal='true']"); const controls = [...dialog?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex='0']") ?? []];
      if (!controls.length) return; const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", trap, true);
    onCleanup(() => { cancelAnimationFrame(frame); document.removeEventListener("keydown", trap, true); if (previous?.isConnected) previous.focus(); });
  });

  onMount(() => {
    const updateTopbarHeight = () => { if (appTopbar) setTopbarHeight(appTopbar.offsetHeight); };
    const topbarResize = new ResizeObserver(updateTopbarHeight);
    if (appTopbar) topbarResize.observe(appTopbar);
    updateTopbarHeight();
    onCleanup(() => topbarResize.disconnect());
    if (isTauri() && /android/i.test(navigator.userAgent)) {
      void invoke("set_mobile_orientation", { orientation: mobileOrientation() }).catch(() => setOrientationMessage("Rotate the device manually if its saved orientation is not applied."));
    }
    if (isTauri()) void invoke<string[]>("load_recent_sketches").then(paths => {
      const seen = new Set<string>(); const combined = [...recentFiles(), ...paths].flatMap((path): string[] => { if (typeof path !== "string" || !isSketchPath(path)) return []; const key = filePathIdentity(path); if (seen.has(key)) return []; seen.add(key); return [path]; }).slice(0, 8);
      setRecentFiles(combined);
      try { localStorage.setItem("sketchdraw-v8-recent-files", JSON.stringify(combined)); } catch { /* Native storage remains the durable copy. */ }
      if (combined.length) void invoke("save_recent_sketches", { paths: combined }).catch(() => undefined);
    }).catch(() => undefined);
    let openFileEventsDisposed = false;
    let unlistenOpenFiles: (() => void) | undefined;
    onCleanup(() => { openFileEventsDisposed = true; unlistenOpenFiles?.(); });
    void (async () => {
      try {
        const unlisten = await listen<string[]>("open-files", event => { void openAssociatedFiles(event.payload); });
        if (openFileEventsDisposed) unlisten(); else unlistenOpenFiles = unlisten;
      } catch (cause) { setError(`Could not listen for files opened by the operating system: ${String(cause)}`); }
      try {
        const paths = await invoke<string[]>("take_startup_files");
        await openAssociatedFiles(paths);
      } catch (cause) { setError(`Could not check for a SketchDraw file to open: ${String(cause)}`); }
    })();
    const keyDown = (event: KeyboardEvent) => {
      if (isWindowsPlatform() && activePath() && event.key === "F11") { event.preventDefault(); void toggleWindowsFullscreen(); return; }
      if (event.key === "Escape") {
        if (commandPaletteOpen()) { event.preventDefault(); setCommandPaletteOpen(false); return; }
        if (shortcutDialogOpen()) { event.preventDefault(); setShortcutDialogOpen(false); return; }
        if (presentationMode()) { event.preventDefault(); void togglePresentationMode(false); return; }
        if (windowsFullscreenMode()) { event.preventDefault(); void toggleWindowsFullscreen(false); return; }
        if (touchFocusMode()) { event.preventDefault(); void toggleTouchFocusMode(false); return; }
        if (noteEditor()) { event.preventDefault(); saveNoteEditor(); if (isWindowsPlatform()) { setTool("select"); setStyleMenuMode("quick"); } return; }
        if (schemaDialog()) { event.preventDefault(); setSchemaDialog(false); return; }
        if (validationOpen()) { event.preventDefault(); setValidationOpen(false); return; }
        if (objectSearchOpen()) { event.preventDefault(); setObjectSearchOpen(false); return; }
        if (mermaidDialog()) { event.preventDefault(); setMermaidDialog(false); return; }
        if (diagramCodeExportOpen()) { event.preventDefault(); setDiagramCodeExportOpen(false); return; }
        if (webEmbedDialog()) { event.preventDefault(); setWebEmbedDialog(false); return; }
        if (renameFileOpen()) { event.preventDefault(); setRenameFileOpen(false); return; }
        if (pageDialog()) { event.preventDefault(); setPageDialog(undefined); return; }
        if (helpOpen()) { event.preventDefault(); setHelpOpen(false); return; }
        if (contextMenu()) { event.preventDefault(); setContextMenu(undefined); return; }
        if (stencilMenuOpen()) { event.preventDefault(); setStencilMenuOpen(false); return; }
        if (canvasOptionsOpen()) { setCanvasOptionsOpen(false); return; }
        if (openToolOptions()) { closeToolOptions(); return; }
        if (toolbarOrganizerOpen()) { event.preventDefault(); setToolbarOrganizerOpen(false); return; }
        if (measureMode()) { event.preventDefault(); toggleMeasureMode(); return; }
        document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(detail => detail.open = false);
        if (showClearConfirm()) { event.preventDefault(); setShowClearConfirm(false); return; }
        if (exportOptionsOpen()) { event.preventDefault(); setExportOptionsOpen(false); return; }
        if (recoveryPrompt() || syncConflict()) return;
        if (textDraft()) commitTextDraft();
        event.preventDefault(); setTool(readOnlyView() ? "laser" : isWindowsPlatform() ? "select" : "pan"); if (isWindowsPlatform() && !readOnlyView()) setStyleMenuMode("quick"); setTouchStylePanel(false); setQuickStylePopover(undefined); setSelectedIndices([]); setHoveredIndex(undefined); setMarquee(undefined); marqueeOrigin = undefined; resizeOrigin = undefined; moveOrigin = undefined; labelMoveOrigin = undefined; libraryControlOrigin = undefined; setPreview(undefined); drawing = false; setSpaceDown(false); setIsPanning(false); panOrigin = undefined;
        if (menu) menu.open = false; if (viewMenu) viewMenu.open = false; if (gestureMenu) gestureMenu.open = false; return;
      }
      if (event.key === "F1") { event.preventDefault(); setHelpOpen(true); return; }
      if (recoveryPrompt() || syncConflict() || exportOptionsOpen() || showClearConfirm() || pageDialog() || renameFileOpen() || schemaDialog() || validationOpen() || objectSearchOpen() || mermaidDialog() || webEmbedDialog() || noteEditor() || contextMenu()) return;
      if (event.target instanceof HTMLElement && event.target.closest("details[open], .tool-options")) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f" && activePath() && isCanvasWorkspace()) { event.preventDefault(); openObjectSearch(); return; }
      if (isWindowsPlatform()) {
        const matched = WINDOWS_SHORTCUTS.find(item => shortcuts()[item.id].some(binding => matchesWindowsShortcut(event, binding)));
        if (matched) { event.preventDefault(); runWindowsShortcut(matched.id); return; }
        const reassignedDefault = WINDOWS_SHORTCUTS.some(item => matchesWindowsShortcut(event, item.defaultKey) && !shortcuts()[item.id].some(binding => normalizeShortcut(binding) === normalizeShortcut(item.defaultKey)));
        if (reassignedDefault) { event.preventDefault(); return; }
        if (presentationMode() && (event.key === "ArrowRight" || event.key === "ArrowLeft")) { event.preventDefault(); changePresentationPage(event.key === "ArrowRight" ? 1 : -1); return; }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && workspaceArea() === "planning") { event.preventDefault(); void savePlanningDocument(); return; }
      if (!activePath()) return;
      if (readOnlyView()) {
        const key = event.key.toLowerCase();
        if ((event.ctrlKey || event.metaKey) && key === "o") { event.preventDefault(); void openFile(); }
        else if (key === "0") resetZoomAndCenter();
        else if (key === "1") fitDocumentToViewport(elements());
        return;
      }
      if (event.code === "Space" && event.target instanceof HTMLElement && event.target.closest("button, summary, select, [role='menuitem']")) return;
      if (event.code === "Space") { if (!event.repeat) { event.preventDefault(); setSpaceDown(true); } return; }
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "n") { event.preventDefault(); void createFile(); return; }
      if ((event.ctrlKey || event.metaKey) && key === "o") { event.preventDefault(); void openFile(); return; }
      if ((event.ctrlKey || event.metaKey) && key === "s") { event.preventDefault(); void saveCurrentWorkspace(); return; }
      if ((event.ctrlKey || event.metaKey) && key === "g") { event.preventDefault(); if (event.shiftKey) ungroupSelection(); else groupSelection(); return; }
      if ((event.ctrlKey || event.metaKey) && key === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
      if ((event.ctrlKey || event.metaKey) && key === "y") { event.preventDefault(); redo(); return; }
      if ((event.ctrlKey || event.metaKey) && key === "d") { event.preventDefault(); insertCopies(selectedElements()); return; }
      if ((event.ctrlKey || event.metaKey) && key === "a") { event.preventDefault(); setSelectedIndices(elements().flatMap((item, index) => !isElementHidden(item) && !isElementLocked(item) ? [index] : [])); return; }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (key === "m") { toggleMeasureMode(); return; }
      if (key === "[") { cycleSelection(-1); return; }
      if (key === "]") { cycleSelection(1); return; }
      if (key === "1") { fitDocumentToViewport(elements()); return; }
      if (key === "2") { fitDocumentToViewport(selectedElements()); return; }
      if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) { event.preventDefault(); const step = event.shiftKey ? 10 : 1; changeSelected(item => moveElement(item, key === "arrowleft" ? -step : key === "arrowright" ? step : 0, key === "arrowup" ? -step : key === "arrowdown" ? step : 0)); return; }
      if (key === "g" && event.shiftKey) { setSnapToGrid((enabled) => !enabled); return; }
      if (key === "o" && event.shiftKey) { setSnapToObjects((enabled) => !enabled); return; }
      if (key === "g") { setShowGrid((visible) => !visible); return; }
      if (key === "k") { setBoardLocked((locked) => !locked); return; }
      if (key === "0") { resetZoomAndCenter(); return; }
      if (key === "v") activateTool("select"); else if (key === "p") activateTool("pen"); else if (key === "y") activateTool("laser"); else if (key === "r") activateTool("rectangle"); else if (key === "c" || key === "o") activateTool("circle"); else if (key === "d") activateTool("diamond"); else if (key === "n") activateTool("triangle"); else if (key === "l") activateTool("line"); else if (key === "a") activateTool("arrow"); else if (key === "f") activateTool("flowchart"); else if (key === "t") activateTool("text"); else if (key === "b") activateTool("bucket"); else if (key === "e") activateTool("eraser"); else if (key === "x") activateTool("crop");
      else if (key === "delete" || key === "backspace") { event.preventDefault(); deleteSelected(); }
    };
    const clipboardAllowed = (target: EventTarget | null) => !readOnlyView() && activePath() && !pageDialog() && !schemaDialog() && !validationOpen() && !objectSearchOpen() && !mermaidDialog() && !webEmbedDialog() && !exportOptionsOpen() && !showClearConfirm() && !recoveryPrompt() && !syncConflict() && !noteEditor() && !(target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea")));
    const copy = (event: ClipboardEvent) => { if (!clipboardAllowed(event.target) || !selectedElements().length) return; event.preventDefault(); event.clipboardData?.setData("text/plain", clipboardPayload()); clipboardItems = copyElements(selectedElements(), 0, 0); };
    const paste = (event: ClipboardEvent) => { if (!clipboardAllowed(event.target) || boardLocked()) return; const raw = event.clipboardData?.getData("text/plain"); if (raw) { event.preventDefault(); pastePayload(raw); } };
    const cut = (event: ClipboardEvent) => { if (!clipboardAllowed(event.target) || boardLocked()) return; copy(event); if (event.defaultPrevented) deleteSelected(); };
    document.addEventListener("copy", copy); document.addEventListener("paste", paste); document.addEventListener("cut", cut);
    onCleanup(() => { document.removeEventListener("copy", copy); document.removeEventListener("paste", paste); document.removeEventListener("cut", cut); });
    const keyUp = (event: KeyboardEvent) => { if (event.code === "Space") setSpaceDown(false); };
    let lastMouseShortcut: { binding: string; at: number } | undefined;
    const runMouseShortcut = (event: MouseEvent, allowAction: boolean) => {
      if (!isWindowsPlatform() || shortcutDialogOpen() || recoveryPrompt() || syncConflict() || helpOpen() || pageDialog() || renameFileOpen() || schemaDialog() || validationOpen() || objectSearchOpen() || mermaidDialog() || webEmbedDialog() || exportOptionsOpen() || showClearConfirm() || noteEditor()) return;
      if (event instanceof PointerEvent && event.pointerType !== "mouse") return;
      const binding = shortcutFromMouseEvent(event);
      if (!binding) return;
      const matched = WINDOWS_SHORTCUTS.find(item => shortcuts()[item.id].some(binding => matchesWindowsMouseShortcut(event, binding)));
      if (!matched) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!allowAction) return;
      if (event.type === "auxclick" && lastMouseShortcut?.binding === binding && Date.now() - lastMouseShortcut.at < 750) return;
      lastMouseShortcut = { binding, at: Date.now() };
      runWindowsShortcut(matched.id);
    };
    const mouseShortcutPointerDown = (event: PointerEvent) => runMouseShortcut(event, true);
    const mouseShortcutAuxClick = (event: MouseEvent) => runMouseShortcut(event, true);
    const mouseShortcutContextMenu = (event: MouseEvent) => runMouseShortcut(event, false);
    const blur = () => {
      setSpaceDown(false);
      activePenPointerId = undefined; ignoredTouchPointers.clear(); touchPointers.clear(); touchGesture = undefined; touchTapTracker = undefined;
      cancelCanvasInteraction();
    };
    const updateDisplayMetrics = () => setDisplayMetrics(readDisplayMetrics());
    const outsideClick = (event: PointerEvent) => { document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(detail => { if (!detail.contains(event.target as Node)) detail.open = false; }); if (!(event.target instanceof HTMLElement && event.target.closest(".tool-family"))) { closeToolOptions(); setStencilMenuOpen(false); } if (!(event.target instanceof HTMLElement && event.target.closest(".more-tools-family"))) setMoreToolsOpen(false); if (!(event.target instanceof HTMLElement && event.target.closest(".canvas-options-family"))) setCanvasOptionsOpen(false); if (!(event.target instanceof HTMLElement && event.target.closest(".quick-style-panel"))) setQuickStylePopover(undefined); if (!(event.target instanceof HTMLElement && event.target.closest(".touch-style-panel, .touch-style-open"))) setTouchStylePanel(false); if (!(event.target instanceof HTMLElement && event.target.closest(".canvas-context-menu"))) setContextMenu(undefined); if (textDraft() && event.target instanceof Element && !event.target.closest(".canvas-text-editor, .style-pane, .design-toolbar, .drawing-canvas")) commitTextDraft(); if (menu?.open && !menu.contains(event.target as Node)) menu.open = false; if (viewMenu?.open && !viewMenu.contains(event.target as Node)) viewMenu.open = false; if (gestureMenu?.open && !gestureMenu.contains(event.target as Node)) gestureMenu.open = false; };
    const closeMenuOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setQuickStylePopover(undefined); setToolbarOrganizerOpen(false); setMoreToolsOpen(false); if (menu?.open) menu.open = false; if (viewMenu?.open) viewMenu.open = false; if (gestureMenu?.open) gestureMenu.open = false; if (helpMenu?.open) helpMenu.open = false; if (appSettingsMenu?.open) appSettingsMenu.open = false; } };
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    setSystemDark(colorScheme.matches); colorScheme.addEventListener("change", updateSystemTheme);
    let closeInProgress = false;
    let unlistenClose: (() => void) | undefined;
    if (isTauri()) {
      try {
        const nativeWindow = getCurrentWindow();
        void nativeWindow.onCloseRequested(async (event) => {
          if (readOnlyView() || (!dirty() && !textDraft() && !saving())) return;
          event.preventDefault();
          if (closeInProgress) return;
          closeInProgress = true;
          try {
            if (textDraft()) commitTextDraft();
            persistRecovery();
            while (docController.isSaveInFlight()) await new Promise<void>((resolve) => window.setTimeout(resolve, 30));
            const path = activePath();
            if (path && dirty() && !syncConflict()) await saveToPath(path);
            if (textDraft()) commitTextDraft();
            if (dirty() || syncConflict()) persistRecovery();
            // The original close request was prevented while the async save ran.
            // Remove this listener before requesting close again so it cannot
            // intercept its own retry. Recovery data has already been persisted
            // if the save failed or a cloud-sync conflict blocked it.
            unlistenClose?.();
            unlistenClose = undefined;
            await nativeWindow.destroy();
          } catch (cause) {
            setError(`Could not close SketchDraw: ${String(cause)}`);
            closeInProgress = false;
          }
        }).then((unlisten) => { unlistenClose = unlisten; }).catch((cause) => setError(`Could not prepare safe closing: ${String(cause)}`));
      } catch (cause) { setError(`Could not prepare safe closing: ${String(cause)}`); }
    }
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp); window.addEventListener("pointerdown", mouseShortcutPointerDown, true); window.addEventListener("auxclick", mouseShortcutAuxClick, true); window.addEventListener("contextmenu", mouseShortcutContextMenu, true); window.addEventListener("blur", blur); window.addEventListener("resize", alignViewSettingsPopover); window.addEventListener("resize", updateDisplayMetrics); window.addEventListener("orientationchange", updateDisplayMetrics);
    document.addEventListener("pointerdown", outsideClick); document.addEventListener("keydown", closeMenuOnEscape);
    let autosaveTimer: number | undefined;
    const scheduleAutosave = () => {
      autosaveTimer = window.setTimeout(() => {
        if (textDraft() && !recoveryPrompt() && !syncConflict()) persistRecovery();
        if (activePath() && dirty() && !documentBusy() && !recoveryPrompt() && !textDraft() && !drawing && !panOrigin && !resizeOrigin && !moveOrigin && !labelMoveOrigin) {
          persistRecovery();
          if (!syncConflict() && !docController.isSaveInFlight()) void saveToPath(activePath()!);
        }
        scheduleAutosave();
      }, autosaveSeconds() * 1000);
    };
    restartAutosave = () => { if (autosaveTimer !== undefined) window.clearTimeout(autosaveTimer); scheduleAutosave(); };
    scheduleAutosave();
    syncPollTimer = window.setInterval(() => void pollSharedSketch(), 30_000);
    onCleanup(() => { restartAutosave = undefined; unlistenClose?.(); window.clearInterval(laserTimer); if (autosaveTimer !== undefined) window.clearTimeout(autosaveTimer); if (syncPollTimer !== undefined) window.clearInterval(syncPollTimer); if (syncObservationTimer !== undefined) window.clearTimeout(syncObservationTimer); window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("pointerdown", mouseShortcutPointerDown, true); window.removeEventListener("auxclick", mouseShortcutAuxClick, true); window.removeEventListener("contextmenu", mouseShortcutContextMenu, true); window.removeEventListener("blur", blur); window.removeEventListener("resize", alignViewSettingsPopover); window.removeEventListener("resize", updateDisplayMetrics); window.removeEventListener("orientationchange", updateDisplayMetrics); document.removeEventListener("pointerdown", outsideClick); document.removeEventListener("keydown", closeMenuOnEscape); colorScheme.removeEventListener("change", updateSystemTheme); });
  });

  function setThemePreference(mode: ThemeMode) {
    setThemeMode(mode);
    try { if (mode === "system") localStorage.removeItem("sketchdraw-theme"); else localStorage.setItem("sketchdraw-theme", mode); } catch { /* Theme still applies for this session. */ }
  }

  function setAccentPreference(value: string) {
    if (!/^#[\da-f]{6}$/i.test(value)) return;
    setAccentColor(value);
    try { localStorage.setItem("sketchdraw-accent", value); } catch { /* Accent still applies for this session. */ }
  }

  function setAutosavePreference(seconds: 5 | 10) {
    setAutosaveSeconds(seconds);
    try { localStorage.setItem("sketchdraw-autosave-seconds", String(seconds)); } catch { /* This session still uses the selected interval. */ }
    restartAutosave?.();
  }
  function setInterfaceScalePreference(scale: number) {
    if (![0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4].includes(scale)) return;
    setInterfaceScale(scale);
    try { localStorage.setItem("sketchdraw-interface-scale", String(scale)); } catch { /* The scale still applies for this session. */ }
  }
  async function setMobileOrientationPreference(orientation: "landscape" | "portrait") {
    setMobileOrientation(orientation);
    setOrientationMessage("");
    try { localStorage.setItem("sketchdraw-mobile-orientation", orientation); } catch { /* Orientation still applies for this session. */ }
    if (isWindowsPlatform() || !isCompactTouchLayout()) return;
    try {
      if (isTauri() && /android/i.test(navigator.userAgent)) {
        await invoke("set_mobile_orientation", { orientation });
      } else if (window.screen.orientation?.lock) {
        await window.screen.orientation.lock(orientation);
      } else {
        throw new Error("Screen orientation control is not available.");
      }
    } catch {
      setOrientationMessage("This device could not switch orientation. Rotate it manually or check its rotation lock.");
    }
  }
  function setToolbarPositionPreference(position: "top" | "bottom" | "left" | "right") {
    setToolbarPosition(position);
    try { localStorage.setItem("sketchdraw-toolbar-position", position); } catch { /* Position still applies for this session. */ }
  }
  function saveToolbarLayout(toolbar: ToolbarItem[], more: ToolbarItem[]) {
    const available = toolbarItemsForCurrentPlatform();
    const nextToolbar = [...new Set(toolbar.filter(value => available.includes(value)))];
    const nextMore = [...new Set(more.filter(value => value !== "moreTools" && available.includes(value) && !nextToolbar.includes(value)))];
    for (const value of available) if (!nextToolbar.includes(value) && !nextMore.includes(value)) nextToolbar.push(value);
    setToolbarOrder(nextToolbar);
    setMoreToolsOrder(nextMore);
    try {
      localStorage.setItem("sketchdraw-toolbar-layout", JSON.stringify({ toolbar: nextToolbar, more: nextMore }));
      localStorage.removeItem("sketchdraw-toolbar-order");
    } catch { /* The selected layout remains active for this session. */ }
  }
  function reorderToolbarTool(zone: ToolbarZone, from: ToolbarItem, to: ToolbarItem) {
    const current = [...(zone === "toolbar" ? toolbarOrder() : moreToolsOrder())];
    const fromIndex = current.indexOf(from); const toIndex = current.indexOf(to);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    current.splice(fromIndex, 1);
    current.splice(fromIndex < toIndex ? toIndex - 1 : toIndex, 0, from);
    if (zone === "toolbar") saveToolbarLayout(current, moreToolsOrder());
    else saveToolbarLayout(toolbarOrder(), current);
  }
  function moveToolbarTool(value: ToolbarItem, destination: ToolbarZone, before?: ToolbarItem) {
    if (value === "moreTools" && destination === "more") return;
    const currentToolbar = toolbarOrder().filter(item => item !== value);
    const currentMore = moreToolsOrder().filter(item => item !== value);
    const destinationList = destination === "toolbar" ? currentToolbar : currentMore;
    const insertAt = before ? destinationList.indexOf(before) : -1;
    destinationList.splice(insertAt < 0 ? destinationList.length : insertAt, 0, value);
    saveToolbarLayout(currentToolbar, currentMore);
  }
  function resetToolbarOrder() {
    const defaults = defaultToolbarLayout();
    setToolbarOrder(defaults.toolbar);
    setMoreToolsOrder(defaults.more);
    try { localStorage.removeItem("sketchdraw-toolbar-layout"); localStorage.removeItem("sketchdraw-toolbar-order"); } catch { /* The default order remains active for this session. */ }
  }
  function restoreAppSettings() {
    setThemePreference("system");
    setAccentPreference(UI_ACCENTS[0].value);
    setToolbarColorPreference("auto");
    setInterfaceScalePreference(1);
    setAutosavePreference(10);
    setThicknessPickerPreference("presets");
    setToolbarPositionPreference("left");
    resetToolbarOrder();
    void setMobileOrientationPreference("landscape");
  }
  function setToolbarColorPreference(value: string) {
    if (value !== "auto" && !/^#[\da-f]{6}$/i.test(value)) return;
    setToolbarColorChoice(value);
    try { localStorage.setItem("sketchdraw-toolbar-color", value); } catch { /* Color still applies this session. */ }
  }
  function setTouchTapPreference(gesture: "one" | "two" | "three", action: TouchTapAction) {
    if (!TOUCH_TAP_ACTIONS.some(option => option.value === action)) return;
    if (gesture === "one") setOneFingerTapAction(action);
    else if (gesture === "two") setTwoFingerTapAction(action);
    else setThreeFingerTapAction(action);
    try { localStorage.setItem(`sketchdraw-${gesture}-finger-tap`, action); } catch { /* The choice remains active for this session. */ }
  }
  function setTouchGesturePreference(fingers: 1 | 2 | 3, action: string) {
    if (fingers === 1) {
      if (action !== "activeTool" && action !== "pan") return;
      setOneFingerDragAction(action);
      try { localStorage.setItem("sketchdraw-one-finger-drag", action); } catch { /* The choice remains active for this session. */ }
      return;
    }
    if (!TOUCH_GESTURE_ACTIONS.some(option => option.value === action)) return;
    if (fingers === 2) setTwoFingerGestureAction(action as TouchGestureAction);
    else setThreeFingerGestureAction(action as TouchGestureAction);
    try { localStorage.setItem(`sketchdraw-${fingers === 2 ? "two" : "three"}-finger-gesture`, action); } catch { /* The choice remains active for this session. */ }
  }
  function setWhiteboardStylePreference(style: WhiteboardStyle) {
    setWhiteboardStyle(style);
    try { localStorage.setItem("sketchdraw-whiteboard-style", style); } catch { /* The style remains active for this session. */ }
  }
  function runTouchTapAction(action: TouchTapAction) {
    if (action === "none") return;
    commitTextDraft();
    setQuickStylePopover(undefined);
    if (action === "undo") undo();
    else if (action === "redo") redo();
    else if (action === "select") { setTool("select"); setStyleMenuMode("quick"); }
    else if (action === "pan") setTool("pan");
    else if (action === "fit") fitDocumentToViewport(elements());
    else if (action === "resetZoom") resetZoomAndCenter();
    else if (action === "layers") setLayerPanelOpen(open => !open);
    else if (action === "grid") setShowGrid(value => !value);
    else if (action === "properties") { if (!isWindowsPlatform() && isCompactTouchLayout()) setTouchStylePanel(current => !current); else toggleSidebar(); }
    else if (action === "tools") setToolBarOpen(value => !value);
    else if (action === "clearSelection") { setSelectedIndices([]); setHoveredIndex(undefined); }
  }
  function setLaserPreference(key: string, value: string) {
    if (key === "color" && !/^#[\da-f]{6}$/i.test(value)) return;
    try { localStorage.setItem(`sketchdraw-laser-${key}`, value); } catch { /* Laser settings remain active for this session. */ }
    if (key === "color") setLaserColor(value);
    if (key === "thickness") setLaserThickness(Math.max(1, Math.min(24, Number(value) || 5)));
    if (key === "fade") setLaserFadeDuration(Math.max(250, Math.min(5000, Number(value) || 1100)));
    if (key === "rainbow") setLaserRainbow(value === "true");
  }
  const toolbarInk = () => {
    if (toolbarColorChoice() === "auto") return "var(--theme-text-primary)";
    const value = toolbarColor().slice(1);
    const channels = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16) / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2] > .42 ? "var(--theme-ink-on-light)" : "var(--theme-ink-on-dark)";
  };

  function recoverySnapshot(): SketchFile {
    const snapshot = documentSnapshot(); const draft = textDraft(); if (!draft) return snapshot;
    const pageIndex = snapshot.pages.findIndex(page => page.id === snapshot.activePageId); if (pageIndex < 0) return snapshot;
    const page = { ...snapshot.pages[pageIndex], elements: [...snapshot.pages[pageIndex].elements] };
    snapshot.pages = snapshot.pages.map((current, index) => index === pageIndex ? page : current);
    const style = { color: draft.color, opacity: draft.opacity, fontSize: draft.fontSize, fontFamily: draft.fontFamily, bold: draft.bold, italic: draft.italic, underline: draft.underline, textAlign: draft.textAlign, listType: draft.listType };
    if (draft.editingChildId && draft.editingIndex !== undefined) {
      const item = page.elements[draft.editingIndex];
      if (item?.type === "group") {
        const updated = updateNestedGroupChild(item, draft.editingChildId, child => {
          if (draft.shapeLabel && (isLabelShape(child) || isConnector(child))) return { ...child, label: draft.value.trim() ? { ...child.label, ...style, text: draft.value, verticalAlign: draft.verticalAlign ?? "middle" } : undefined } as Element;
          return child.type === "text" ? { ...child, ...style, text: draft.value } : child;
        });
        if (updated) page.elements[draft.editingIndex] = updated;
      }
    }
    else if (draft.shapeLabel && draft.editingIndex !== undefined) { const item = page.elements[draft.editingIndex]; if (item && (isLabelShape(item) || isConnector(item))) page.elements[draft.editingIndex] = { ...item, label: { ...item.label, ...style, text: draft.value, verticalAlign: draft.verticalAlign ?? "middle" } }; }
    else { const item: TextElement = { ...style, type: "text", x: draft.x, y: draft.y, text: draft.value, id: draft.editingIndex !== undefined ? page.elements[draft.editingIndex]?.id : crypto.randomUUID() }; if (draft.editingIndex !== undefined) page.elements[draft.editingIndex] = item; else if (draft.value.trim()) page.elements.push(item); }
    return snapshot;
  }
  function persistRecovery() {
    if (readOnlyView() || !activePath() || (!dirty() && !textDraft())) return;
    docController.persistRecovery({ savedAt: Date.now(), baselineRaw: docController.baselineRaw(), snapshot: recoverySnapshot() });
  }

  function applySnapshot(snapshot: SketchFile, path: string, rawText: string, nextWorkspace: WorkspaceArea = "canvas") {
    canvasHistory.clearAll(); setTextDraft(undefined); setNoteEditor(undefined); setContextMenu(undefined); setLayerPanelOpen(false); setTouchStylePanel(false); setQuickStylePopover(undefined); setCanvasOptionsOpen(false);  setStencilMenuOpen(false); closeToolOptions(); setPreview(undefined); setMarquee(undefined); drawing = false; moveOrigin = undefined; resizeOrigin = undefined;
    let restoredComponents = false;
    const pages = snapshot.pages.map(page => ({ ...page, elements: page.elements.flatMap(element => {
      if (element.type !== "group") return [element];
      const restored = restoreDirectLibraryComponent(element);
      if (!restored) return [element];
      restoredComponents = true;
      return restored;
    }) }));
    const migratedNotes = planningSession.importLegacyFromSketch({
      path,
      project: snapshot.project,
      quickNotes: snapshot.library?.quickNotes ?? [],
    });
    const planningCleanSync = planningSession.removeLegacySyncMetadata(snapshot.windowsSync);
    const library = snapshot.library ? { ...snapshot.library, quickNotes: [] } : snapshot.library;
    const migratedSnapshot = { ...snapshot, pages, project: undefined, windowsSync: planningCleanSync, ...(library ? { library } : {}) };
    const syncMeta = documentSnapshotCoordinator.initializeMetadata(migratedSnapshot, planningCleanSync ?? createWindowsSyncMetadata());
    const preparedSnapshot = { ...migratedSnapshot, windowsSync: syncMeta };
    const currentPage = documentSession.activate(preparedSnapshot, path, nextWorkspace);
    setElements(currentPage.elements); setCanvasState({ ...currentPage.canvasState });
    setBoardColor(currentPage.canvasState.backgroundColor); setBoardColorFollowsTheme(currentPage.canvasState.boardColorFollowsTheme ?? false);
    documentSnapshotCoordinator.seed(preparedSnapshot);
    rememberFile(path); setDirty(!snapshot.windowsSync || migratedNotes || restoredComponents || !!snapshot.project); setSelectedIndices([]); setHoveredIndex(undefined); setBoardLocked(false); docController.setBaselineRaw(rawText);
    setError("");
  }

  function restoreOpenedViewAt100(path: string, pageId: string) {
    requestAnimationFrame(() => {
      if (activePath() !== path || activePageId() !== pageId || !canvas) return;
      const viewport = canvas.getBoundingClientRect();
      const saved = canvasState();
      const focusX = (viewport.width / 2 - saved.panX) / saved.zoom;
      const focusY = (viewport.height / 2 - saved.panY) / saved.zoom;
      const restored = { ...saved, zoom: 1, panX: viewport.width / 2 - focusX, panY: viewport.height / 2 - focusY };
      setCanvasState(restored);
      setPages((items) => items.map((page) => page.id === pageId ? { ...page, canvasState: restored } : page));
    });
  }

  function restoreRecovery() {
    docController.restoreRecovery();
  }
  function discardRecovery() {
    docController.discardRecovery();
  }
  async function reloadConflictingFile() {
    await docController.reloadConflict();
  }
  async function saveToPath(path: string, duringDocumentTransition = false) {
    if (legacyMigrationPath()) return;
    if (documentBusy() && !duringDocumentTransition) return;
    if (planningNeedsExtraction()) {
      const migrated = legacyPlanningPending();
      if (migrated) {
        if (!await planningSession.saveLegacyCopy(migrated)) return;
      } else if (planningDirty() && !planningPath()) {
        if (!await savePlanningAs()) return;
      }
    }
    await docController.save(path);
  }

  async function acceptLegacyRefactor() {
    const path = legacyMigrationPath();
    if (!path || path !== activePath() || nativeBusy() || documentBusy() || recoveryPrompt() || syncConflict()) return;
    setNativeBusy(true);
    planningSession.discardLegacyFromSketch(path);
    setLegacyLibraryData(createLegacyLibraryData());
    setDirty(true);
    await docController.save(path);
    if (!dirty() && !syncConflict()) {
      setLegacyMigrationPath(undefined);
    } else if (syncConflict()) setLegacyMigrationPath(undefined);
    setNativeBusy(false);
  }

  async function declineLegacyRefactor() {
    const path = legacyMigrationPath();
    if (!path || path !== activePath() || documentBusy()) return;
    if (!await docController.closeWithoutSaving()) return;
    planningSession.discardLegacyFromSketch(path);
    setWorkspaceArea("canvas");
  }

  async function savePlanningAs() { return planningSession.saveAs(); }
  async function savePlanningDocument() { return planningSession.save(); }
  async function saveCurrentWorkspace() {
    if (workspaceArea() === "planning") return savePlanningDocument();
    if (activePath()) return saveToPath(activePath()!);
    return saveAs();
  }
  async function openPlanningFile() {
    if (documentBusy()) return;
    if (await planningSession.openPicker()) setWorkspaceArea("planning");
  }
  async function createPlanningFromHome() {
    if (documentBusy()) return;
    if (await planningSession.create()) setWorkspaceArea("planning");
  }
  async function openRecentPlan(path: string) {
    if (await planningSession.load(path)) setWorkspaceArea("planning");
  }
  async function addPlansToOverview() {
    try {
      const paths = await choosePlanningDocuments();
      for (const path of paths) planningSession.remember(path);
      if (!paths.length) return;
      setError("");
    } catch (cause) { setError(`Could not add Planning files: ${String(cause)}`); }
  }

  async function saveAs() {
    if (legacyMigrationPath()) return;
    if (workspaceArea() === "planning") { await savePlanningAs(); return; }
    if (!activePath()) { await createFile(); return; }
    if (nativeBusy() || documentBusy()) return;
    setNativeBusy(true);
    try {
      const selected = await createSketchDocument("Untitled.sketch");
      if (selected) {
        const path = withSketchExtension(selected);
        if (/^content:\/\//i.test(path)) await sketchFileStore.authorize(path);
        await saveToPath(path);
      }
    } catch (cause) { setError(`Could not choose save location: ${String(cause)}`); } finally { setNativeBusy(false); }
  }

  function rememberFile(path: string) {
    path = normalizeFileUri(path);
    const identity = filePathIdentity(path); const updated = [path, ...recentFiles().filter(recent => filePathIdentity(recent) !== identity)].slice(0, 8);
    setRecentFiles(updated);
    try { localStorage.setItem("sketchdraw-v8-recent-files", JSON.stringify(updated)); } catch { /* Native storage remains the durable copy. */ }
    if (isTauri()) void invoke("save_recent_sketches", { paths: updated }).catch(() => undefined);
  }

  function replaceRecentFilePath(previousPath: string, nextPath: string) {
    const normalizedPrevious = normalizeFileUri(previousPath);
    const normalizedNext = normalizeFileUri(nextPath);
    const previousIdentity = filePathIdentity(normalizedPrevious); const nextIdentity = filePathIdentity(normalizedNext);
    const updated = [normalizedNext, ...recentFiles().filter(path => filePathIdentity(path) !== previousIdentity && filePathIdentity(path) !== nextIdentity)].slice(0, 8);
    setRecentFiles(updated);
    try { localStorage.setItem("sketchdraw-v8-recent-files", JSON.stringify(updated)); } catch { /* Native storage remains the durable copy. */ }
    if (isTauri()) void invoke("save_recent_sketches", { paths: updated }).catch(() => undefined);
  }

  function openRenameFileDialog() {
    const path = activePath();
    if (!path || readOnlyView() || documentBusy() || nativeBusy()) return;
    setRenameFileName(displayNameForPath(path).replace(/\.sketch$/i, ""));
    setRenameFileError("");
    setRenameFileOpen(true);
  }

  async function confirmRenameFile() {
    const path = activePath();
    const name = renameFileName().trim();
    if (!path || !name || readOnlyView() || documentBusy() || nativeBusy()) return;
    if (/[<>:"/\\|?*\u0000-\u001f]/.test(name) || name.endsWith(".") || name.endsWith(" ")) {
      setRenameFileError("Use a file name without path separators, reserved characters, or a trailing dot or space.");
      return;
    }
    setRenameFileError("");
    setDocumentBusy(true);
    setNativeBusy(true);
    try {
      while (docController.isSaveInFlight()) await new Promise<void>(resolve => window.setTimeout(resolve, 30));
      if (activePath() !== path) return;
      commitTextDraft();
      if (syncConflict()) return;
      if (dirty()) {
        await saveToPath(path, true);
        if (dirty() || syncConflict()) {
          setRenameFileError(syncConflict() ? "This file changed in the shared folder. Resolve that update before renaming it." : error() || "The latest sketch changes could not be saved, so the file was not renamed.");
          return;
        }
      }
      const fileName = name.toLowerCase().endsWith(".sketch") ? name : `${name}.sketch`;
      const renamedPath = /^content:\/\//i.test(path)
        ? await invoke<string>("rename_sketch_document", { uri: path, fileName })
        : await invoke<string>("rename_sketch_file", { path: normalizeFileUri(path), fileName });
      setActivePath(renamedPath);
      if (/^content:\/\//i.test(renamedPath)) void resolveAndroidDocumentName(renamedPath);
      setOpenSketchPaths(paths => paths.map(item => normalizeFileUri(item) === normalizeFileUri(path) ? renamedPath : item));
      replaceRecentFilePath(path, renamedPath);
      sketchRecoveryStore.remove(path);
      setRenameFileOpen(false);
      setError("");
    } catch (cause) {
      setRenameFileError(String(cause));
    } finally {
      setNativeBusy(false);
      setDocumentBusy(false);
    }
  }

  function nextUntitledFileName() {
    let sequence = 1;
    try { sequence = Math.max(1, Number(localStorage.getItem("sketchdraw-untitled-sequence")) || 1); } catch { /* The system picker still supplies a unique copy name if browser storage is unavailable. */ }
    try { localStorage.setItem("sketchdraw-untitled-sequence", String(sequence + 1)); } catch { /* Best effort. */ }
    return sequence === 1 ? "Untitled.sketch" : `Untitled ${sequence}.sketch`;
  }

  async function saveBeforeReplacingDocument(): Promise<boolean> {
    while (docController.isSaveInFlight()) await new Promise<void>((resolve) => window.setTimeout(resolve, 30));
    if (readOnlyView()) return true;
    commitTextDraft();
    const path = activePath();
    if (!path) return true;
    if (syncConflict()) return false;
    if (dirty()) {
      if (activePath() !== path || syncConflict()) return false;
      if (dirty()) await saveToPath(path, true);
      if (dirty() || syncConflict()) { setError("The current sketch could not be saved, so it was kept open."); return false; }
    }
    return true;
  }

  function resetDocumentSession() {
    canvasHistory.clearAll();
    setElements([]); setCanvasState(emptyCanvas());
    documentSession.reset();
    setBoardColor("#ffffff"); setBoardColorFollowsTheme(true); setSelectedIndices([]); setHoveredIndex(undefined); setBoardLocked(false);
    setTextDraft(undefined); setPreview(undefined); setMarquee(undefined); setContextMenu(undefined); setLayerPanelOpen(false); documentSnapshotCoordinator.reset(); setOpenSketchPaths([]);
    setRecoveryPrompt(undefined); setLegacyMigrationPath(undefined); setSyncConflict(undefined);
    setTool("pen"); setToolBarOpen(true);
  }

  const docController = createDocumentController({
    activePath, setActivePath,
    dirty, setDirty,
    readOnly: readOnlyView, setReadOnly: setReadOnlyView,
    documentBusy, setDocumentBusy, setSaving, setSavedAt, setError,
    recoveryPrompt, setRecoveryPrompt, syncConflict, setSyncConflict,
    workspaceArea, snapshot: documentSnapshot, snapshotRaw, applySnapshot,
    setStatus: setDocumentControllerStatus,
    documentRevision,
    resetDocument: resetDocumentSession,
    beforeReplace: saveBeforeReplacingDocument,
    commitTextDraft,
    rememberFile,
    onOpened(path, viewOnly) {
      if (isWindowsPlatform() && !viewOnly) setOpenSketchPaths(paths => paths.includes(path) ? paths : [...paths, path]);
      if (viewOnly) { setTool("laser"); setSelectedIndices([]); setToolBarOpen(true); }
      else if (tool() === "laser") setTool("pen");
    },
    onMigrationRequired(path) { setLegacyMigrationPath(path); setDirty(false); },
    restoreOpenedView: restoreOpenedViewAt100,
    canCheckForUpdates: () => !document.hidden && !documentBusy() && !recoveryPrompt() && !legacyMigrationPath() && !docController.isSaveInFlight() && !drawing && !panOrigin && !moveOrigin && !resizeOrigin && !labelMoveOrigin && !textDraft(),
    shouldKeepDocumentDirtyAfterUpdate: remote => isWindowsPlatform() && !remote.windowsSync,
    normalizePath: normalizeFileUri,
    isSketchPath,
  });

  async function exportRetiredLibraryArchive() {
    const path = activePath();
    const library = legacyLibraryData();
    if (!path || readOnlyView() || !hasRetiredLibraryData(library)) return;
    setNativeBusy(true);
    setError("");
    try {
      const contents = createRetiredLibraryArchive(library);
      if (isAndroidPlatform()) {
        const uri = await invoke<string | null>("create_legacy_library_archive", { fileName: "SketchDraw-Library-Archive.json" });
        if (!uri) return;
        await invoke("write_sketch_document", { uri, contents });
      } else {
        const target = await save({
          title: "Export retired Library data",
          defaultPath: "SketchDraw-Library-Archive.json",
          filters: [{ name: "JSON archive", extensions: ["json"] }],
        });
        if (!target) return;
        await writeTextFile(target.toLowerCase().endsWith(".json") ? target : `${target}.json`, contents);
      }

      setLegacyLibraryData(current => clearRetiredLibraryData(current));
      setDirty(true);
      await docController.save(path);
      if (dirty()) {
        const saveError = error();
        setError(syncConflict()
          ? "The Library archive was exported. Resolve the sketch's sync conflict before removing its archived copy."
          : saveError
            ? `The Library archive was exported, but the sketch could not be updated. ${saveError}`
            : "The Library archive was exported. The sketch still needs to be saved to remove its archived copy.");
      } else {
        setError("");
      }
    } catch (cause) {
      setError(`Could not export retired Library data: ${String(cause)}`);
    } finally {
      setNativeBusy(false);
    }
  }

  async function closeFile() {
    if (!activePath() || documentBusy()) return;
    if (isWindowsPlatform() && openSketchPaths().length > 1) { await closeSketchTab(activePath()!); return; }
    await docController.close();
  }

  async function closeSketchTab(path: string) {
    if (!isWindowsPlatform()) return;
    const currentPath = activePath();
    if (path !== currentPath) { setOpenSketchPaths(paths => paths.filter(item => item !== path)); return; }
    const remaining = openSketchPaths().filter(item => item !== path);
    if (!remaining.length) { await closeFile(); return; }
    if (!await saveBeforeReplacingDocument()) return;
    await loadFile(remaining[0]);
    if (activePath() === remaining[0] || normalizeFileUri(activePath() ?? "") === normalizeFileUri(remaining[0])) setOpenSketchPaths(paths => paths.filter(item => item !== path));
  }

  async function loadFile(path: string, viewOnly = false) {
    if (legacyMigrationPath()) return;
    if (/^content:\/\//i.test(path)) await resolveAndroidDocumentName(path);
    let openReadOnly = viewOnly;
    if (!openReadOnly && isAndroidPlatform() && /^content:\/\//i.test(path)) {
      try {
        const writable = await invoke<boolean>("has_sketch_document_write_access", { uri: path });
        if (!writable) {
          openReadOnly = true;
          setError("Android's document provider granted read access only. The sketch is open read-only; use Save as to create an editable copy.");
        }
      } catch {
        openReadOnly = true;
        setError("Could not confirm write access from Android's document provider. The sketch is open read-only; use Save as to create an editable copy.");
      }
    }
    await docController.open(path, openReadOnly);
  }

  async function pollSharedSketch() {
    await docController.checkForUpdates();
  }

  createEffect(() => {
    const path = activePath();
    if (!isWindowsPlatform() || !path || !sketchFileStore.adapter(path).capabilities.supportsBackgroundUpdateCheck) return;
    let disposed = false;
    let unwatch: (() => void) | undefined;
    let changeTimer: number | undefined;
    void watch(path, () => {
      if (disposed) return;
      if (changeTimer !== undefined) window.clearTimeout(changeTimer);
      changeTimer = window.setTimeout(() => {
        changeTimer = undefined;
        if (!disposed && !document.hidden) void pollSharedSketch();
      }, 500);
    }, { delayMs: 350 }).then(stop => {
      if (disposed) stop();
      else unwatch = stop;
    }).catch(() => {
      // Cloud folders and removable volumes may not expose reliable watch events.
      // The 30-second check above remains active as a fallback.
    });
    onCleanup(() => {
      disposed = true;
      if (changeTimer !== undefined) window.clearTimeout(changeTimer);
      unwatch?.();
    });
  });

  function setWindowsShortcut(id: WindowsShortcutId, slot: WindowsShortcutSlot, value: string) {
    const normalized = value ? normalizeShortcut(value) : "";
    if (normalized && WINDOWS_SHORTCUTS.some(item => shortcuts()[item.id].some((binding, index) => (item.id !== id || index !== slot) && normalizeShortcut(binding) === normalized))) return false;
    const next = { ...shortcuts(), [id]: [...shortcuts()[id]] as [string, string] };
    next[id][slot] = normalized;
    setShortcuts(next);
    try { localStorage.setItem("sketchdraw-windows-shortcuts", JSON.stringify(next)); } catch { /* The current session still uses the new shortcut. */ }
    return true;
  }

  function resetWindowsShortcuts() {
    setShortcuts({ ...DEFAULT_WINDOWS_SHORTCUTS });
    try { localStorage.removeItem("sketchdraw-windows-shortcuts"); } catch { /* Defaults still apply for this session. */ }
  }

  function runWindowsShortcut(id: WindowsShortcutId) {
    if (isCanvasWorkspace() && readOnlyView() && !["commandPalette", "openSketch", "fitDrawing", "fitSelection", "resetZoom", "presentation", "measureTool", "cycleSelectionPrevious", "cycleSelectionNext"].includes(id)) return;
    switch (id) {
      case "commandPalette": setCommandPaletteOpen(true); break;
      case "newSketch": void createFile(); break;
      case "openSketch": void openFile(); break;
      case "saveSketch": void saveCurrentWorkspace(); break;
      case "saveAs": void saveAs(); break;
      case "undo": undo(); break;
      case "redo": redo(); break;
      case "group": groupSelection(); break;
      case "ungroup": ungroupSelection(); break;
      case "duplicate": insertCopies(selectedElements()); break;
      case "selectAll": setSelectedIndices(elements().flatMap((item, index) => !isElementHidden(item) && !isElementLocked(item) ? [index] : [])); break;
      case "fitDrawing": fitDocumentToViewport(elements()); break;
      case "fitSelection": fitDocumentToViewport(selectedElements()); break;
      case "resetZoom": resetZoomAndCenter(); break;
      case "toggleGrid": setShowGrid(value => !value); break;
      case "snapGrid": setSnapToGrid(value => !value); break;
      case "snapObjects": setSnapToObjects(value => !value); break;
      case "measureTool": toggleMeasureMode(); break;
      case "cycleSelectionPrevious": cycleSelection(-1); break;
      case "cycleSelectionNext": cycleSelection(1); break;
      case "lockCanvas": setBoardLocked(value => !value); break;
      case "selectTool": activateTool("select"); break;
      case "penTool": activateTool("pen"); break;
      case "laserTool": activateTool("laser"); break;
      case "rectangleTool": activateTool("rectangle"); break;
      case "circleTool": activateTool("circle"); break;
      case "diamondTool": activateTool("diamond"); break;
      case "triangleTool": activateTool("triangle"); break;
      case "lineTool": activateTool("line"); break;
      case "arrowTool": activateTool("arrow"); break;
      case "flowchartTool": activateTool("flowchart"); break;
      case "textTool": activateTool("text"); break;
      case "bucketTool": activateTool("bucket"); break;
      case "eraserTool": activateTool("eraser"); break;
      case "cropTool": activateTool("crop"); break;
      case "copyStyle": copyObjectStyle(); break;
      case "pasteStyle": pasteObjectStyle(); break;
      case "presentation": void togglePresentationMode(); break;
    }
  }

  async function togglePresentationMode(enabled = !presentationMode()) {
    if (enabled === presentationMode()) return;
    if (enabled) {
      if (windowsFullscreenMode()) await toggleWindowsFullscreen(false);
      commitTextDraft();
      document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(detail => detail.open = false);
      setCommandPaletteOpen(false); setPresentationTarget(currentFrameElements().length ? "frames" : "pages"); setPresentationFrameIndex(-1); setPresentationMode(true);
      try {
        if (isTauri()) {
          const appWindow = getCurrentWindow(); presentationOwnsFullscreen = !(await appWindow.isFullscreen());
          if (presentationOwnsFullscreen) await appWindow.setFullscreen(true);
        } else if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          presentationOwnsFullscreen = true; await document.documentElement.requestFullscreen();
        }
      } catch { /* Presentation controls remain available if fullscreen is unavailable. */ }
      if (currentFrameElements().length) requestAnimationFrame(() => focusPresentationFrame(0));
    } else {
      if (presentationTransitionOutTimer !== undefined) window.clearTimeout(presentationTransitionOutTimer);
      if (presentationTransitionClearTimer !== undefined) window.clearTimeout(presentationTransitionClearTimer);
      presentationTransitionOutTimer = undefined; presentationTransitionClearTimer = undefined; setPresentationTransition(undefined);
      setPresentationMode(false); setPresentationFrameIndex(-1);
      if (!presentationOwnsFullscreen) return;
      presentationOwnsFullscreen = false;
      try { if (isTauri()) await getCurrentWindow().setFullscreen(false); else if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* The presentation layout still exits if fullscreen is unavailable. */ }
    }
  }

  function focusPresentationFrame(index: number) {
    const frame = currentFrameElements()[index]; if (!frame || !canvas) { setPresentationFrameIndex(-1); return; }
    const rect = canvas.getBoundingClientRect(); const bounds = elementBounds(frame); const inset = 56;
    const zoom = Math.max(.02, Math.min(4, (rect.width - inset * 2) / Math.max(1, bounds.w), (rect.height - inset * 2) / Math.max(1, bounds.h)));
    setCanvasState(current => ({ ...current, zoom, panX: (rect.width - bounds.w * zoom) / 2 - bounds.x * zoom, panY: (rect.height - bounds.h * zoom) / 2 - bounds.y * zoom }));
    setPresentationFrameIndex(index);
  }

  function setPresentationModeTarget(target: "pages" | "frames") {
    setPresentationTarget(target);
    if (target === "frames" && currentFrameElements().length) focusPresentationFrame(0);
    else setPresentationFrameIndex(-1);
  }

  function changePresentationPage(direction: -1 | 1) {
    const index = pages().findIndex(page => page.id === activePageId());
    const target = pages()[index + direction];
    if (presentationMode() && presentationTarget() === "frames") {
      const frames = currentFrameElements(); const current = presentationFrameIndex(); const nextIndex = current + direction;
      if (current >= 0 && nextIndex >= 0 && nextIndex < frames.length) { focusPresentationFrame(nextIndex); return; }
      if (current < 0 && direction > 0 && frames.length) { focusPresentationFrame(0); return; }
      if (target) {
        switchPage(target.id); setPresentationFrameIndex(-1);
        requestAnimationFrame(() => { const nextFrames = currentFrameElements(); if (nextFrames.length) focusPresentationFrame(direction > 0 ? 0 : nextFrames.length - 1); });
        return;
      }
    }
    if (target) switchPage(target.id);
  }

  async function openFile() {
    if (legacyMigrationPath() || nativeBusy() || documentBusy()) return;
    setNativeBusy(true);
    try {
      const selected = await chooseSketchDocument();
      if (!selected) return;
      await loadFile(selected);
    } catch (cause) { setError(`Could not choose file: ${String(cause)}`); } finally { setNativeBusy(false); }
  }

  async function openFileAsView() {
    if (legacyMigrationPath() || nativeBusy() || documentBusy()) return;
    setNativeBusy(true);
    try {
      const selected = await chooseSketchDocument();
      if (!selected) return;
      await loadFile(selected, true);
    } catch (cause) { setError(`Could not choose file: ${String(cause)}`); } finally { setNativeBusy(false); }
  }

  function notifyAvailableUpdate(version: string) {
    let dismissed: string | null = null;
    try { dismissed = localStorage.getItem("sketchdraw-dismissed-update"); } catch { /* A fresh notice is still useful this session. */ }
    if (dismissed !== version) setUpdateNoticeVersion(version);
  }

  function dismissUpdateNotice() {
    const version = updateNoticeVersion();
    if (version) try { localStorage.setItem("sketchdraw-dismissed-update", version); } catch { /* The notice stays dismissed for this session. */ }
    setUpdateNoticeVersion(undefined);
  }

  async function checkForUpdates(automatic = false) {
    if (updateCheck() === "checking" || updateCheck() === "installing") return;
    setUpdateCheck("checking"); setUpdateVersion(undefined); setAndroidUpdateUrl(undefined); if (!automatic) setError("");
    if (pendingUpdate) { await pendingUpdate.close().catch(() => undefined); pendingUpdate = undefined; }
    try {
      if (isWindowsPlatform()) {
        const { check } = await import("@tauri-apps/plugin-updater");
        pendingUpdate = await check() ?? undefined;
        if (pendingUpdate) {
          setUpdateVersion(pendingUpdate.version);
          setUpdateCheck("available");
          notifyAvailableUpdate(pendingUpdate.version);
        } else setUpdateCheck("current");
        return;
      }
      const response = await fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } });
      if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}.`);
      const release: unknown = await response.json();
      if (!isRecord(release) || typeof release.tag_name !== "string") throw new Error("GitHub returned an incomplete release record.");
      const currentVersion = await getVersion();
      const androidRelease = androidReleaseApk(release);
      if (!androidRelease) { setUpdateCheck("unavailable"); return; }
      setUpdateVersion(androidRelease.version);
      setAndroidUpdateUrl(androidRelease.url);
      if (compareReleaseVersions(androidRelease.version, currentVersion) > 0) {
        setUpdateCheck("available");
        notifyAvailableUpdate(androidRelease.version);
      } else setUpdateCheck("current");
    } catch (cause) {
      if (automatic) setUpdateCheck("idle");
      else { setUpdateCheck("error"); setError(`Update check failed: ${String(cause)}`); }
    }
  }

  async function installUpdate() {
    if (isAndroidPlatform()) {
      const downloadUrl = androidUpdateUrl();
      if (!downloadUrl || (updateCheck() !== "available" && updateCheck() !== "permission")) return;
      setUpdateNoticeVersion(undefined); setUpdateCheck("installing"); setError("");
      try {
        const result = await invoke<{ status: string }>("install_android_release_apk", { downloadUrl });
        if (result.status === "permission_required") setUpdateCheck("permission");
        else if (result.status !== "installer_opened") throw new Error("Android did not open the package installer.");
      } catch (cause) {
        setUpdateCheck("error");
        setError(`Update installation failed: ${String(cause)}`);
      }
      return;
    }
    const update = pendingUpdate;
    if (!update || updateCheck() === "installing") return;
    setUpdateNoticeVersion(undefined); setUpdateCheck("installing"); setError("");
    try {
      await update.downloadAndInstall();
      pendingUpdate = undefined;
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (cause) {
      pendingUpdate = undefined;
      setUpdateCheck("error");
      setError(`Update installation failed: ${String(cause)}`);
    }
  }

  async function importImage() {
    if (!activePath() || readOnlyView()) return;
    if (nativeBusy() || documentBusy()) return;
    setNativeBusy(true);
    if (boardLocked()) { setNativeBusy(false); return; }
    try {
      const selected = await open({ title: "Import image", multiple: false, filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }] });
      if (!selected || Array.isArray(selected)) return;
      const bytes = await readFile(selected); let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
       const imagePath = normalizeFileUri(selected);
       const cleanPath = (() => { try { return decodeURIComponent(imagePath); } catch { return imagePath; } })().split(/[?#]/, 1)[0]; const extension = cleanPath.split(".").pop()?.toLowerCase();
       const mime = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : extension === "webp" ? "image/webp" : extension === "gif" ? "image/gif" : bytes[0] === 0x89 && bytes[1] === 0x50 ? "image/png" : bytes[0] === 0xff && bytes[1] === 0xd8 ? "image/jpeg" : String.fromCharCode(...bytes.subarray(0, 4)) === "GIF8" ? "image/gif" : String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP" ? "image/webp" : "image/png";
      const dataUrl = `data:${mime};base64,${btoa(binary)}`; const image = new Image(); image.src = dataUrl;
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Could not load image.")); });
      const width = Math.min(700, image.naturalWidth); const height = image.naturalHeight * width / image.naturalWidth; const rect = canvas.getBoundingClientRect(); const view = canvasState();
      const item: ImageElement = { type: "image", x: (rect.width / 2 - view.panX) / view.zoom - width / 2, y: (rect.height / 2 - view.panY) / view.zoom - height / 2, w: width, h: height, dataUrl, sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight };
      pushUndo(cloneElements(elements())); setElements((items) => [...items, item]); imageCache.set(dataUrl, image); setSelectedIndices([elements().length - 1]); setDirty(true);
    } catch (cause) { setError(`Could not import image: ${String(cause)}`); } finally { setNativeBusy(false); }
  }

  async function importSvg() {
    if (!activePath() || readOnlyView() || nativeBusy() || documentBusy() || boardLocked()) return;
    setNativeBusy(true);
    try {
      const selected = await open({ title: "Import SVG artwork", multiple: false, filters: [{ name: "SVG image", extensions: ["svg"] }] });
      if (!selected || Array.isArray(selected)) return;
      const source = await readTextFile(selected);
      if (source.length > 10_000_000) throw new Error("This SVG is larger than the 10 MB import limit.");
      const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
      const root = parsed.documentElement;
      if (root.localName.toLowerCase() !== "svg" || parsed.querySelector("parsererror")) throw new Error("The selected file is not a valid SVG image.");
      parsed.querySelectorAll("script,foreignObject,iframe,object,embed,audio,video").forEach(node => node.remove());
      const unsafeUrl = /url\s*\(\s*(?!['"]?#)[^)]*\)/i;
      parsed.querySelectorAll("style").forEach(node => { if (/@import|url\s*\(\s*(?!['"]?#)/i.test(node.textContent ?? "")) node.remove(); });
      for (const node of [root, ...root.querySelectorAll("*")]) for (const attribute of [...node.attributes]) {
        const name = attribute.name.toLowerCase(); const value = attribute.value.trim();
        const safeDataImage = /^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(value);
        if (name.startsWith("on") || ((name === "href" || name.endsWith(":href") || name === "src" || name === "srcset") && value && !value.startsWith("#") && !safeDataImage) || unsafeUrl.test(value) || /javascript:/i.test(value)) node.removeAttribute(attribute.name);
      }
      root.removeAttribute("onload"); root.removeAttribute("onerror");
      const viewBox = root.getAttribute("viewBox")?.trim().split(/[ ,]+/).map(Number);
      const width = Math.max(1, Math.min(6000, Number.parseFloat(root.getAttribute("width") ?? "") || (viewBox?.[2] ?? 800)));
      const height = Math.max(1, Math.min(6000, Number.parseFloat(root.getAttribute("height") ?? "") || (viewBox?.[3] ?? 600)));
      root.setAttribute("width", String(width)); root.setAttribute("height", String(height));
      const vectorWidth = Math.max(1, viewBox?.[2] ?? width); const vectorHeight = Math.max(1, viewBox?.[3] ?? height);
      const vectorScale = Math.min(1, 700 / vectorWidth, 700 / vectorHeight); const renderWidth = vectorWidth * vectorScale; const renderHeight = vectorHeight * vectorScale;
      const viewport = canvas.getBoundingClientRect(); const camera = canvasState();
      const center = { x: (viewport.width / 2 - camera.panX) / camera.zoom, y: (viewport.height / 2 - camera.panY) / camera.zoom };
      const worldOrigin = { x: center.x - renderWidth / 2 - (viewBox?.[0] ?? 0) * vectorScale, y: center.y - renderHeight / 2 - (viewBox?.[1] ?? 0) * vectorScale };
      const vectorItems = svgPrimitivesToElements(root as unknown as SVGSVGElement, worldOrigin, vectorScale);
      if (vectorItems) {
        const group: GroupElement = { type: "group", id: crypto.randomUUID(), elements: vectorItems };
        const index = elements().length; pushUndo(cloneElements(elements())); setElements(items => [...items, group]); setSelectedIndices([index]); setTool("select"); setSidebarTab("properties"); setDirty(true); return;
      }
      // Keep unsupported SVG features as embedded SVG artwork. The input has
      // already had scripts, event handlers, and external URLs removed above.
      const safeSvg = new XMLSerializer().serializeToString(root);
      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(safeSvg)}`;
      addRasterImage(svgDataUrl, width, height);
    } catch (cause) { setError(`Could not import SVG: ${String(cause)}`); } finally { setNativeBusy(false); }
  }

  function addRasterImage(dataUrl: string, sourceWidth: number, sourceHeight: number) {
    const width = Math.min(700, sourceWidth); const height = sourceHeight * width / sourceWidth; const rect = canvas.getBoundingClientRect(); const view = canvasState();
    const item: ImageElement = { type: "image", x: (rect.width / 2 - view.panX) / view.zoom - width / 2, y: (rect.height / 2 - view.panY) / view.zoom - height / 2, w: width, h: height, dataUrl, sourceWidth, sourceHeight };
    pushUndo(cloneElements(elements())); setElements(items => [...items, item]); imageCache.set(dataUrl, new Image()); imageCache.get(dataUrl)!.src = dataUrl; setSelectedIndices([elements().length - 1]); setDirty(true);
  }

  function remapImportedElementIds(imported: Element[]): Element[] {
    const remapped = new Map<string, string>();
    const collect = (items: Element[]) => { for (const item of items) { if (item.id && !remapped.has(item.id)) remapped.set(item.id, crypto.randomUUID()); if (item.type === "group") { collect(item.elements); if (item.stencilParameters) collect(item.stencilParameters.template); } } };
    collect(imported);
    const binding = (value?: Binding): Binding | undefined => value ? { ...value, elementId: remapped.get(value.elementId) ?? value.elementId } : undefined;
    const convert = (item: Element): Element => {
      const id = item.id ? remapped.get(item.id) ?? crypto.randomUUID() : crypto.randomUUID();
      if (item.type === "group") return { ...item, id, elements: item.elements.map(convert), ...(item.stencilParameters ? { stencilParameters: { ...item.stencilParameters, template: item.stencilParameters.template.map(convert) } } : {}) };
      if (item.type === "line" || item.type === "arrow") return { ...item, id, startBinding: binding(item.startBinding), endBinding: binding(item.endBinding), forkUpper: item.forkUpper ? { ...item.forkUpper, endBinding: binding(item.forkUpper.endBinding) } : undefined, forkLower: item.forkLower ? { ...item.forkLower, endBinding: binding(item.forkLower.endBinding) } : undefined };
      if (item.type === "schemaTable") return { ...item, id, columns: item.columns.map(column => ({ ...column, id: crypto.randomUUID() })) };
      return { ...item, id };
    };
    return imported.map(convert);
  }

  function placeImportedElements(source: Element[]) {
    if (!source.length) throw new Error("No editable objects were found in this file.");
    const unique = remapImportedElementIds(source);
    const bounds = unionBounds(unique.map(elementBounds));
    if (!bounds) throw new Error("The imported diagram has no drawable objects.");
    const view = canvasState(); const rect = canvas.getBoundingClientRect();
    const center = { x: (rect.width / 2 - view.panX) / view.zoom, y: (rect.height / 2 - view.panY) / view.zoom };
    const moved = unique.map(item => moveElement(item, center.x - bounds.x - bounds.w / 2, center.y - bounds.y - bounds.h / 2));
    const resolved = resolveBindings([...elements(), ...moved]).slice(elements().length);
    const offset = elements().length;
    pushUndo(cloneElements(elements())); setElements(current => [...current, ...resolved]);
    setSelectedIndices(resolved.map((_, index) => offset + index)); setTool("select"); setDirty(true);
  }

  function insertDiagramTemplate(id: DiagramTemplateId) {
    if (boardLocked() || readOnlyView()) return;
    try {
      placeImportedElements(buildDiagramTemplate(id));
      setTemplateGalleryOpen(false);
      setError("");
    } catch (cause) { setError(`Could not insert starter diagram: ${cause instanceof Error ? cause.message : String(cause)}`); }
  }

  async function importDiagramFile() {
    if (!activePath() || readOnlyView() || nativeBusy() || documentBusy() || boardLocked()) return;
    setNativeBusy(true);
    try {
      const selected = await open({ title: "Import editable diagram or diagram code", multiple: false, filters: [{ name: "Diagrams, schemas, and infrastructure", extensions: ["drawio", "xml", "excalidraw", "csv", "json", "yaml", "yml", "tf", "tf.json", "tfstate", "tfplan", "bicep", "openapi", "ansible", "dot", "d2", "mmd", "mermaid", "puml", "plantuml"] }] });
      if (!selected || Array.isArray(selected)) return;
      const path = normalizeFileUri(selected); const fileName = path.split(/[\\/]/).pop() ?? ""; const extension = fileName.split(".").pop()?.toLowerCase();
      const source = await readTextFile(selected);
      let imported: Element[]; let fidelityReport: { kept: number; simplified: number; skipped: number } | undefined;
      if (extension === "drawio" || extension === "xml") { const result = await importDrawioWithReport(source); imported = result.elements; fidelityReport = result.report; }
      else if (extension === "excalidraw") imported = importExcalidraw(source);
      else if (extension === "csv") imported = csvToDiagram(source);
      else if (extension === "json" && /\.tf\.json$/i.test(fileName)) imported = terraformToDiagram(source);
      else if (extension === "json" && /\.openapi\.json$/i.test(fileName)) imported = openApiToDiagram(source);
      else if (extension === "json") {
        const data = JSON.parse(source) as Record<string, unknown>;
        if (typeof data.openapi === "string" || typeof data.swagger === "string") imported = openApiToDiagram(source);
        else if (data.Resources && typeof data.Resources === "object") imported = cloudFormationToDiagram(source);
        else if (Array.isArray(data.resources) && (data.$schema || data.contentVersion || data.parameters)) imported = azureArmToDiagram(source);
        else if (Array.isArray(data.resource_changes) || Array.isArray(data.resource_drift) || data.values && typeof data.values === "object") imported = terraformToDiagram(source);
        else imported = jsonToDiagram(source);
      }
      else if (extension === "yaml" || extension === "yml" || extension === "openapi" || extension === "ansible") imported = structuredYamlToDiagram(source);
      else if (extension === "tf") imported = terraformToDiagram(source);
      else if (extension === "tfstate" || extension === "tfplan") imported = terraformToDiagram(source);
      else if (extension === "bicep") imported = bicepToDiagram(source);
      else if (extension === "dot") imported = dotToDiagram(source);
      else if (extension === "d2") imported = d2ToDiagram(source);
      else if (extension === "mmd" || extension === "mermaid") { placeMermaidDiagram(source); setError(""); return; }
      else if (extension === "puml" || extension === "plantuml") { placePlantUmlDiagram(source); setError(""); return; }
      else throw new Error("Choose a draw.io, Excalidraw, CSV/JSON data, OpenAPI, CloudFormation/CDK, Azure ARM/Bicep, Docker Compose, Ansible, Kubernetes, Terraform config/plan/state, DOT, D2, Mermaid, or PlantUML file.");
      placeImportedElements(imported); setError("");
      if (fidelityReport) setImportSummary({ fileName, ...fidelityReport });
    } catch (cause) { setError(`Could not import editable diagram: ${String(cause)}`); }
    finally { setNativeBusy(false); }
  }

  async function exportEditableDiagram(format: "drawio" | "excalidraw") {
    if (!activePath() || readOnlyView() || nativeBusy() || documentBusy()) return;
    setNativeBusy(true);
    try {
      commitTextDraft();
      const source = format === "drawio" ? exportDrawio(elements()) : exportExcalidraw(elements());
      const selected = await save({ title: `Export editable ${format === "drawio" ? "draw.io" : "Excalidraw"} diagram`, defaultPath: `SketchDraw.${format}`, filters: [{ name: format === "drawio" ? "draw.io diagram" : "Excalidraw scene", extensions: [format] }] });
      if (!selected) return;
      const target = selected.toLowerCase().endsWith(`.${format}`) ? selected : `${selected}.${format}`;
      await writeTextFile(target, source); setError("");
    } catch (cause) { setError(`Could not export editable diagram: ${String(cause)}`); }
    finally { setNativeBusy(false); }
  }

  async function exportDiagramAsCode() {
    if (!activePath() || readOnlyView() || nativeBusy() || documentBusy()) return;
    setNativeBusy(true);
    try {
      commitTextDraft();
      const format = diagramCodeFormat();
      const exportItems = diagramCodeScope() === "selection" ? selectedElements() : elements();
      if (!exportItems.length) throw new Error("Select one or more objects to export, or switch to the current page.");
      const contents = exportDiagramCode(format, exportItems);
      const baseName = displayNameForPath(activePath()!).replace(/\.sketch$/i, "") || "SketchDraw";
      const saved = await exportTextDocument(`${baseName}.${format}`, format, contents);
      if (saved) setError("");
      setDiagramCodeExportOpen(false);
    } catch (cause) {
      setError(`Could not export diagram code: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally { setNativeBusy(false); }
  }

  const diagramCodeLimitations = () => diagramCodeFormat() === "mmd"
    ? "Mermaid keeps supported node shapes, labels, subgraph frames, and common connector styles. Exact coordinates and advanced Mermaid directives are simplified."
    : diagramCodeFormat() === "dot"
      ? "DOT keeps common node shapes, colors, fills, widths, line styles, labels, and arrowheads. Nested subgraphs and exact coordinates are simplified."
      : diagramCodeFormat() === "puml"
        ? "PlantUML exports a class/object subset. Members and simple relationship labels are kept; layout, stereotypes, notes, and behavior are simplified."
        : diagramCodeFormat() === "csv"
          ? "CSV exports stable node IDs, labels, and simple relationships. Shape styling, layout, and routing are omitted."
          : diagramCodeFormat() === "d2"
            ? "D2 keeps common labels, shapes, groups, colors, and connectors. Unsupported styles and layout details are simplified."
            : "Schema exports preserve supported table, column, key, constraint, and index metadata.";

  function openWebEmbedDialog() {
    if (!activePath() || readOnlyView() || boardLocked() || nativeBusy() || documentBusy()) return;
    setWebEmbedInput(""); setWebEmbedError(""); setWebEmbedDialog(true);
  }

  function insertWebEmbed() {
    if (!activePath() || readOnlyView() || boardLocked()) return;
    try {
      const card = makeWebPreviewCard(webEmbedInput()); const view = canvasState(); const rect = canvas.getBoundingClientRect();
      const { width, height } = card;
      const item: ImageElement = { type: "image", id: crypto.randomUUID(), x: (rect.width / 2 - view.panX) / view.zoom - width / 2, y: (rect.height / 2 - view.panY) / view.zoom - height / 2, w: width, h: height, dataUrl: card.dataUrl, sourceWidth: card.width, sourceHeight: card.height, previewUrl: card.url };
      const index = elements().length; pushUndo(cloneElements(elements())); setElements(current => [...current, item]); setSelectedIndices([index]); setDirty(true); setWebEmbedDialog(false); setWebEmbedInput(""); setWebEmbedError(""); setError("");
    } catch (cause) { setWebEmbedError(cause instanceof Error ? cause.message : String(cause)); }
  }

  function toggleLayer(key: ToolLayerKind, property: "hidden" | "locked") {
    if (boardLocked() || readOnlyView()) return;
    if (key.startsWith("layer:")) {
      const requested = new Set(selectedLayerKeys().filter(item => item.startsWith("layer:")).map(item => item.slice(6)));
      requested.add(key.slice(6));
      const explicit = currentLayers().filter(layer => requested.has(layer.id));
      const nextValue = explicit.some(layer => !layer[property]);
      updateCurrentLayers(layers => layers.map(layer => requested.has(layer.id) ? { ...layer, [property]: nextValue } : layer));
      return;
    }
    const before = cloneElements(elements());
    setElements(items => toggleToolLayer(items, key, property));
    pushUndo(before); setDirty(true);
  }

  function moveLayerTo(key: ToolLayerKind, targetRow: number) {
    if (boardLocked() || readOnlyView()) return;
    if (key.startsWith("layer:")) {
      const currentRow = toolLayers().findIndex(layer => layer.key === key);
      const delta = targetRow < currentRow ? -1 : 1;
      updateCurrentLayers(layers => moveCanvasLayer(layers, key.slice(6), delta));
      return;
    }
    const current = elements();
    const selectedLayers = selectedLayerKeys().filter(item => !item.startsWith("layer:"));
    const moveKeys = selectedLayers.includes(key) ? selectedLayers : [key];
    const visibleImplicit = toolLayers().filter(layer => !layer.persistent);
    const implicitTargetRow = Math.max(0, Math.min(visibleImplicit.length - 1, targetRow - toolLayers().filter(layer => layer.persistent).length));
    const reordered = reorderToolLayers(current, moveKeys, implicitTargetRow);
    if (reordered === current) return;
    const selectedObjects = new Set(selectedIndices().map(index => current[index]).filter((item): item is Element => !!item));
    const nextIndices = reordered.flatMap((item, index) => selectedObjects.has(item) ? [index] : []);
    const before = cloneElements(current);
    setElements(reordered); setSelectedIndices(nextIndices); pushUndo(before); setDirty(true);
  }

  function createLayerFromSelection() {
    if (boardLocked() || readOnlyView() || !selectedIndices().length) return;
    const name = window.prompt("Name this layer. Use Parent / Child to nest it.");
    if (!name?.trim()) return;
    const layerPath = name.split("/").map(part => part.trim().replace(/\s+/g, " ")).filter(Boolean).slice(0, 8).join(" / ").slice(0, 400);
    if (!layerPath) return;
    const ensured = ensureCanvasLayerPath(currentLayers(), layerPath); if (!ensured.id) return;
    updateCurrentLayers(() => ensured.layers);
    const selected = new Set(selectedIndices()); const before = cloneElements(elements());
    setElements(items => items.map((item, index) => selected.has(index) ? { ...item, layerId: ensured.id, layerName: layerPath } as Element : item));
    pushUndo(before); setDirty(true);
  }

  function renameSelectedLayer() {
    const ids = selectedLayerKeys().filter(key => key.startsWith("layer:")).map(key => key.slice(6)); if (ids.length !== 1 || boardLocked() || readOnlyView()) return;
    const layer = currentLayers().find(item => item.id === ids[0]); if (!layer) return;
    const name = window.prompt("Rename layer", layer.name)?.trim().slice(0, 80); if (!name || name === layer.name) return;
    updateCurrentLayers(layers => layers.map(item => item.id === layer.id ? { ...item, name } : item));
  }

  function nestSelectedLayers(action: "nest" | "unnest") {
    const ids = selectedLayerKeys().filter(key => key.startsWith("layer:")).map(key => key.slice(6)); if (!ids.length || boardLocked() || readOnlyView()) return;
    updateCurrentLayers(layers => {
      let next = layers;
      const ordered = orderCanvasLayers(layers);
      const sequence = action === "nest" ? ids : [...ids].reverse();
      for (const id of sequence) next = changeCanvasLayerNesting(next, id, action);
      return next.length === ordered.length ? next : layers;
    });
  }

  function deleteSelectedLayers() {
    const ids = [...new Set(selectedLayerKeys().filter(key => key.startsWith("layer:")).map(key => key.slice(6)))]; if (!ids.length || boardLocked() || readOnlyView()) return;
    const result = deleteCanvasLayers(currentLayers(), ids);
    const layerPath = (id: string) => {
      const names: string[] = []; let current = result.layers.find(layer => layer.id === id); let guard = 0;
      while (current && guard++ < 32) { names.unshift(current.name); current = current.parentId ? result.layers.find(layer => layer.id === current!.parentId) : undefined; }
      return names.join(" / ");
    };
    const reassign = (items: Element[]): Element[] => items.map(item => {
      const newLayer = item.layerId && result.reassignment.has(item.layerId) ? result.reassignment.get(item.layerId) : item.layerId;
      const layerName = newLayer ? layerPath(newLayer) : item.layerId && result.reassignment.has(item.layerId) ? undefined : item.layerName;
      return item.type === "group" ? { ...item, layerId: newLayer, layerName, elements: reassign(item.elements) } : newLayer === item.layerId && layerName === item.layerName ? item : { ...item, layerId: newLayer, layerName } as Element;
    });
    updateCurrentLayers(() => result.layers); setElements(reassign(elements())); setDirty(true); setSelectedLayerKeys([]);
  }

  function moveSelectionToLayer(key: ToolLayerKind) {
    if (!key.startsWith("layer:") || !selectedIndices().length || boardLocked() || readOnlyView()) return;
    const layer = currentLayers().find(item => item.id === key.slice(6)); if (!layer) return;
    const row = toolLayers().find(item => item.key === key); const selected = new Set(selectedIndices()); const before = cloneElements(elements());
    setElements(items => items.map((item, index) => selected.has(index) ? { ...item, layerId: layer.id, layerName: row?.path ?? layer.name } as Element : item));
    pushUndo(before); setDirty(true);
  }

  function toggleOrthogonalConnectorPolicy() {
    if (boardLocked() || readOnlyView()) return;
    const enabled = !orthogonalConnectors();
    if (enabled) {
      const before = cloneElements(elements());
      const forceElbows = (items: Element[]): Element[] => items.map(item => {
        if (isElementLocked(item)) return item;
        if (item.type === "group") return { ...item, elements: forceElbows(item.elements) };
        if (!isConnector(item)) return item;
        return { ...item, lineRoute: item.type === "line" ? "elbow" : undefined, arrowRoute: item.type === "arrow" ? "elbow" : undefined, autoRoute: undefined, routePoints: undefined, routeWaypoints: undefined };
      });
      setElements(forceElbows(elements())); pushUndo(before); setDirty(true);
      setLineRoute("elbow"); setArrowRoute("elbow");
    }
    setOrthogonalConnectors(enabled);
    try { localStorage.setItem("sketchdraw-orthogonal-connectors", String(enabled)); } catch { /* The active session still uses this preference. */ }
  }

  function reattachNearbyConnectorEndpoints() {
    if (boardLocked() || readOnlyView()) return;
    const current = elements();
    const repaired = reattachDanglingConnectors(current, 36 / canvasState().zoom, item => !isElementHidden(item) && !isElementLocked(item));
    if (!repaired.count) { setError("No unbound connector endpoints are close enough to a shape."); return; }
    pushUndo(cloneElements(current)); setElements(repaired.elements); setDirty(true); setError("");
  }

  async function createFile() {
    if (legacyMigrationPath() || nativeBusy() || documentBusy()) return;
    setNativeBusy(true);
    try {
      const requestedName = nextUntitledFileName();
      const selected = await createSketchDocument(requestedName);
      if (!selected) return;
      if (!await saveBeforeReplacingDocument()) return;
      const path = withSketchExtension(selected);
      if (/^content:\/\//i.test(path)) await sketchFileStore.authorize(path);
      const initialElements: Element[] = [];
      const page: SketchPage = { id: "page-1", name: "Page 1", canvasState: emptyCanvas(), elements: initialElements };
      const library = createLegacyLibraryData();
      const windowsSync = createWindowsSyncMetadata();
      if (windowsSync) windowsSync.clocks[`p:${page.id}`] = windowsSync.updatedAt;
      const document: SketchFile = { format: "SketchDraw", version: SKETCH_FORMAT_VERSION, activePageId: page.id, pages: [page], library, ...(windowsSync ? { windowsSync } : {}) };
      const contents = snapshotRaw(document);
      await sketchFileStore.write(path, contents, null);
      canvasHistory.clearAll(); documentSession.activate(document, path, "canvas"); setElements(initialElements); setCanvasState(emptyCanvas()); setBoardColor("#ffffff"); setBoardColorFollowsTheme(true); setSelectedIndices([]); setTool("pen"); rememberFile(path); if (isWindowsPlatform()) setOpenSketchPaths(paths => paths.includes(path) ? paths : [...paths, path]); documentSnapshotCoordinator.seed(document); setDirty(false); setBoardLocked(false); setError(""); docController.setBaselineRaw(contents);
      setTemplateGalleryOpen(false);
    } catch (cause) { setError(`Could not create SketchDraw file: ${String(cause)}`); } finally { setNativeBusy(false); }
  }

  function openExportOptions(format: "png" | "svg" | "pdf") {
    if (readOnlyView()) return;
    setExportFormat(format);
    setExportOptionsOpen(true);
    requestAnimationFrame(renderExportPreview);
  }
  function openSelectionExportOptions(format: "png" | "svg" | "pdf") {
    if (!selectedIndices().length) { setError("Select one or more objects before exporting a selection."); return; }
    setPdfPageSet("current"); setExportScope("selection"); openExportOptions(format);
  }

  function pdfPageSpec() {
    const preset: Record<"a4" | "letter" | "a3" | "legal" | "tabloid", readonly [number, number]> = { a4: [210, 297], letter: [215.9, 279.4], a3: [297, 420], legal: [215.9, 355.6], tabloid: [279.4, 431.8] };
    const paper = pdfPaper();
    let [widthMm, heightMm] = paper === "custom"
      ? [pdfCustomWidthMm(), pdfCustomHeightMm()]
      : preset[paper];
    widthMm = Math.max(25, Math.min(1000, Number.isFinite(widthMm) ? widthMm : 210));
    heightMm = Math.max(25, Math.min(1000, Number.isFinite(heightMm) ? heightMm : 297));
    if (pdfOrientation() === "landscape" && heightMm > widthMm || pdfOrientation() === "portrait" && widthMm > heightMm) [widthMm, heightMm] = [heightMm, widthMm];
    return { widthMm, heightMm, widthPt: widthMm * 72 / 25.4, heightPt: heightMm * 72 / 25.4 };
  }

  function pdfMetrics() {
    const page = pdfPageSpec();
    const marginMm = Math.max(0, Math.min(50, Number.isFinite(pdfMarginMm()) ? pdfMarginMm() : 0));
    const dpi = pdfDpi();
    const innerWidthPx = Math.max(1, Math.floor((page.widthMm - marginMm * 2) * dpi / 25.4));
    const innerHeightPx = Math.max(1, Math.floor((page.heightMm - marginMm * 2) * dpi / 25.4));
    const overlapPx = pdfLayout() === "tiled" ? Math.max(0, Math.min(Math.floor(Math.min(innerWidthPx, innerHeightPx) / 3), Math.floor(Math.max(0, pdfOverlapMm()) * dpi / 25.4))) : 0;
    const stepX = Math.max(1, innerWidthPx - overlapPx); const stepY = Math.max(1, innerHeightPx - overlapPx);
    const columns = pdfLayout() === "fit" ? 1 : Math.max(1, Math.ceil(Math.max(1, exportWidth() - overlapPx) / stepX));
    const rows = pdfLayout() === "fit" ? 1 : Math.max(1, Math.ceil(Math.max(1, exportHeight() - overlapPx) / stepY));
    const pageCount = pdfPageSet() === "current" ? columns * rows : pdfPageSet() === "frames" ? allFrameExportTargets().length : selectedPdfPages().length;
    return { page, marginMm, dpi, innerWidthPx, innerHeightPx, overlapPx, stepX, stepY, columns, rows, pageCount };
  }

  function selectedPdfPages() {
    if (pdfPageSet() === "current") return currentPage() ? [currentPage()!] : [];
    if (pdfPageSet() === "all") return pages();
    const start = Math.max(1, Math.min(pages().length, Math.floor(pdfRangeStart())));
    const end = Math.max(start, Math.min(pages().length, Math.floor(pdfRangeEnd())));
    return pages().slice(start - 1, end);
  }

  function pageOffsets(length: number, tileSize: number, step: number) {
    const offsets: number[] = [];
    for (let offset = 0; offset < length; offset += step) {
      offsets.push(offset);
      if (offset + tileSize >= length) break;
      if (offsets.length > 1000) break;
    }
    return offsets.length ? offsets : [0];
  }

  function renderExportPreview() {
    const ticket = ++exportPreviewVersion;
    const target = exportPreviewCanvas;
    if (!target || !exportOptionsOpen() || !canvas) return;
    const format = exportFormat();
    const metrics = format === "pdf" ? pdfMetrics() : undefined;
    const aspect = metrics ? metrics.page.widthMm / metrics.page.heightMm : Math.max(0.05, exportWidth()) / Math.max(1, exportHeight());
    let previewWidth = 640; let previewHeight = previewWidth / aspect;
    if (previewHeight > 400) { previewHeight = 400; previewWidth = previewHeight * aspect; }
    target.width = Math.max(1, Math.round(previewWidth)); target.height = Math.max(1, Math.round(previewHeight));
    const ctx = target.getContext("2d"); if (!ctx) return;
    const pdfFrameTarget = metrics && pdfPageSet() === "frames" ? allFrameExportTargets()[Math.max(0, Math.min(allFrameExportTargets().length - 1, pdfPreviewPage() - 1))] : undefined;
    const pdfFrame = pdfFrameTarget?.frame;
    const pdfPage = metrics && pdfPageSet() !== "current" && pdfPageSet() !== "frames" ? selectedPdfPages()[Math.max(0, Math.min(selectedPdfPages().length - 1, pdfPreviewPage() - 1))] : undefined;
    const selected = pdfFrame ? [pdfFrame] : pdfPage ? pdfPage.elements : exportItemsForScope();
    const previewPage = pdfFrameTarget?.page ?? pdfPage;
    const previewItems = previewPage ? elementsForPagePreview(selected, previewPage) : selected;
    const items = cloneElements(previewItems).filter(item => !item.hidden);
    const rect = canvas.getBoundingClientRect(); const view = { ...(pdfPage?.canvasState ?? pdfFrameTarget?.page.canvasState ?? canvasState()) };
    const previewIsHidden = previewPage ? (item: Element) => isElementHiddenOnPage(item, previewPage) : isElementHidden;
    const rawBounds = pdfFrame ? unionBounds(visibleElementBounds(pdfFrame, previewIsHidden)) ?? elementBounds(pdfFrame) : pdfPage ? unionBounds(items.flatMap(item => visibleElementBounds(item, previewIsHidden))) ?? { x: 0, y: 0, w: 800, h: 600 } : exportSceneBounds(items, exportScope(), view, rect);
    const bounds = paddedExportBounds(rawBounds, pdfFrame ? "frame" : pdfPage ? "drawing" : exportScope());
    const exportViewFor = (width: number, height: number) => { const zoom = Math.min(width / bounds.w, height / bounds.h); return { ...view, zoom, panX: (width - bounds.w * zoom) / 2 - bounds.x * zoom, panY: (height - bounds.h * zoom) / 2 - bounds.y * zoom }; };
    if (metrics) setPdfPreviewPage(value => Math.max(1, Math.min(metrics.pageCount, value)));
    void (async () => {
      const prepare = async (list: Element[]): Promise<void> => { await Promise.all(list.map(async item => { if (item.type === "group") { if (item.componentBounds && item.libraryComponent?.iconSvg) { const icon = cacheComponentIconImage(item); try { await icon?.decode(); } catch { /* Keep the provider text if its icon cannot be decoded. */ } } await prepare(item.elements); } else if (item.type === "image") { let image = imageCache.get(item.dataUrl); if (!image) { image = new Image(); image.src = item.dataUrl; imageCache.set(item.dataUrl, image); } try { await image.decode(); } catch { /* Keep a preview even if an image cannot be decoded. */ } } })); };
      await prepare(items);
      if (ticket !== exportPreviewVersion || !exportOptionsOpen() || target !== exportPreviewCanvas) return;
      if (!metrics) { drawScene(ctx, target.width, target.height, 1, false, exportTransparent(), exportViewFor(target.width, target.height), items, exportGrid() && !exportTransparent()); return; }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, target.width, target.height); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, target.width, target.height);
      const marginX = target.width * metrics.marginMm / metrics.page.widthMm; const marginY = target.height * metrics.marginMm / metrics.page.heightMm;
      const innerW = Math.max(1, target.width - marginX * 2); const innerH = Math.max(1, target.height - marginY * 2);
      const pageNumber = pdfPreviewPage() - 1;
      if (pdfLayout() === "fit") {
        const content = document.createElement("canvas"); content.width = Math.max(1, Math.round(innerW)); content.height = Math.max(1, Math.round(innerH));
        const contentCtx = content.getContext("2d");
        if (contentCtx) drawScene(contentCtx, content.width, content.height, 1, false, false, exportViewFor(content.width, content.height), items, exportGrid());
        ctx.drawImage(content, marginX, marginY, innerW, innerH);
      } else {
        const source = document.createElement("canvas"); source.width = Math.max(1, Math.floor(exportWidth())); source.height = Math.max(1, Math.floor(exportHeight()));
        const sourceCtx = source.getContext("2d");
        if (sourceCtx) drawScene(sourceCtx, source.width, source.height, 1, false, false, exportViewFor(source.width, source.height), items, exportGrid());
        const xs = pageOffsets(source.width, metrics.innerWidthPx, metrics.stepX); const ys = pageOffsets(source.height, metrics.innerHeightPx, metrics.stepY);
        const column = pageNumber % xs.length; const row = Math.floor(pageNumber / xs.length);
        if (row < ys.length) {
          const sx = xs[column] ?? 0; const sy = ys[row] ?? 0; const cropW = Math.min(metrics.innerWidthPx, source.width - sx); const cropH = Math.min(metrics.innerHeightPx, source.height - sy);
          ctx.drawImage(source, sx, sy, cropW, cropH, marginX, marginY, cropW * innerW / metrics.innerWidthPx, cropH * innerH / metrics.innerHeightPx);
        }
      }
      ctx.strokeStyle = "#d8d8d3"; ctx.lineWidth = 1; ctx.strokeRect(.5, .5, target.width - 1, target.height - 1);
      if (pdfHeader().trim() || pdfFooter().trim()) { ctx.fillStyle = "#343434"; ctx.font = "10px sans-serif"; ctx.textAlign = "left"; if (pdfHeader().trim()) ctx.fillText(pdfHeader(), marginX + 6, Math.max(12, marginY / 2)); if (pdfFooter().trim()) ctx.fillText(pdfFooter(), marginX + 6, target.height - Math.max(6, marginY / 2)); }
      if (pdfCropMarks()) { ctx.strokeStyle = "#222"; ctx.lineWidth = 1; const x=marginX,y=marginY,w=innerW,h=innerH; ctx.beginPath(); [[x-7,y,x-2,y],[x,y-7,x,y-2],[x+w+2,y,x+w+7,y],[x+w,y-7,x+w,y-2],[x-7,y+h,x-2,y+h],[x,y+h+2,x,y+h+7],[x+w+2,y+h,x+w+7,y+h],[x+w,y+h+2,x+w,y+h+7]].forEach(([x1,y1,x2,y2])=>{ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);});ctx.stroke(); }
      if (pdfColorMode() === "grayscale") { const pixels=ctx.getImageData(0,0,target.width,target.height);for(let i=0;i<pixels.data.length;i+=4){const value=Math.round(pixels.data[i]*.2126+pixels.data[i+1]*.7152+pixels.data[i+2]*.0722);pixels.data[i]=value;pixels.data[i+1]=value;pixels.data[i+2]=value;}ctx.putImageData(pixels,0,0); }
    })();
  }

  async function exportAs(format: "png" | "svg" | "pdf") {
    if (!canvas || nativeBusy() || documentBusy()) return;
    setNativeBusy(true);
    try {
      if ((!Number.isFinite(exportWidth()) || !Number.isFinite(exportHeight()) || exportWidth() < 1 || exportHeight() < 1 || exportWidth() > 12000 || exportHeight() > 12000 || exportWidth() * exportHeight() > 60_000_000)) throw new Error("Choose dimensions between 1 and 12,000 pixels, totaling no more than 60 megapixels.");
      commitTextDraft();
      const scope = exportScope();
      const exportItems = cloneElements(exportItemsForScope(scope)).filter(item => !item.hidden);
      if ((scope === "selection" || scope === "frame") && !exportItems.length) throw new Error(scope === "frame" ? "Select a frame to export." : "Select one or more visible objects to export.");
      if (scope === "region" && !exportMarqueeRegion()) throw new Error("Draw a marquee region on the canvas before exporting a region.");
      if (format === "pdf" && pdfPageSet() !== "current" && (pdfPageSet() === "frames" ? !allFrameExportTargets().length : !selectedPdfPages().length)) throw new Error("There are no frames or sketch pages in the selected PDF export set.");
      const rect = canvas.getBoundingClientRect(); const view = { ...canvasState() };
      const prepareImages = async (items: Element[]): Promise<void> => { await Promise.all(items.map(async item => { if (item.type === "group") await prepareImages(item.elements); else if (item.type === "image") { let bitmap = imageCache.get(item.dataUrl); if (!bitmap) { bitmap = new Image(); bitmap.src = item.dataUrl; imageCache.set(item.dataUrl, bitmap); } await bitmap.decode(); } })); };
      const framePdfTargets = format === "pdf" && pdfPageSet() === "frames" ? allFrameExportTargets() : [];
      await prepareImages(format === "pdf" && pdfPageSet() !== "current" ? pdfPageSet() === "frames" ? framePdfTargets.map(target => target.frame) : selectedPdfPages().flatMap(page => page.elements) : exportItems);
      const rawBounds = exportSceneBounds(exportItems, scope, view, rect);
      const bounds = paddedExportBounds(rawBounds, scope);
      const exportViewFor = (width: number, height: number) => { const zoom = Math.min(width / bounds.w, height / bounds.h); return { ...view, zoom, panX: (width - bounds.w * zoom) / 2 - bounds.x * zoom, panY: (height - bounds.h * zoom) / 2 - bounds.y * zoom }; };
      const path = await save({ title: `Export SketchDraw as ${format.toUpperCase()}`, defaultPath: `SketchDraw.${format}`, filters: [{ name: format.toUpperCase(), extensions: [format] }] });
      if (!path) return;
      const target = path.toLowerCase().endsWith(`.${format}`) ? path : `${path}.${format}`;

      if (format === "pdf") {
        const metrics = pdfMetrics();
        if (metrics.pageCount > 1000) throw new Error("This layout would create more than 1,000 PDF pages. Increase the page size, reduce the artwork dimensions, or lower the overlap.");
        if (metrics.innerWidthPx * metrics.innerHeightPx > 60_000_000 || (pdfLayout() === "tiled" && exportWidth() * exportHeight() > 60_000_000)) throw new Error("PDF raster dimensions exceed 60 megapixels. Reduce the page DPI or artwork size.");
        if (metrics.pageCount * metrics.innerWidthPx * metrics.innerHeightPx > 240_000_000) throw new Error("This PDF would exceed the 240-megapixel output budget. Lower print quality, reduce the page count, or use a smaller paper size.");
        const pdfRenderer = await import("./features/export/pdf-renderer");
        if (pdfLayout() === "fit") {
          const scenes = pdfPageSet() === "current" ? [{ items: exportItems, view, bounds: rawBounds, padding: scope === "viewport" || scope === "region" ? 0 : exportPadding() }] : pdfPageSet() === "frames" ? framePdfTargets.map(({ frame, page }) => { const isHidden = (item: Element) => isElementHiddenOnPage(item, page); return { items: [frame], view: page.canvasState, bounds: unionBounds(visibleElementBounds(frame, isHidden)) ?? elementBounds(frame), padding: exportPadding(), isHidden }; }) : selectedPdfPages().map(page => ({ items: cloneElements(page.elements).filter(item => !item.hidden), view: page.canvasState, isHidden: (item: Element) => isElementHiddenOnPage(item, page) }));
          await writeFile(target, await pdfRenderer.makeVectorPdf(scenes, { widthPt: metrics.page.widthPt, heightPt: metrics.page.heightPt }, metrics.marginMm, { pdfColorMode, pdfBleedMm, pdfHeader, pdfFooter, pdfCropMarks, imageCache, theme, isHidden: isElementHidden, simpleComponentElement, drawElement, drawNoteCard }));
          setError("");
          return;
        }
        const marginPt = metrics.marginMm * 72 / 25.4;
        const toJpeg = async (source: HTMLCanvasElement): Promise<Uint8Array> => {
          if (pdfColorMode() === "grayscale") {
            const ctx = source.getContext("2d");
            if (ctx) { const image = ctx.getImageData(0, 0, source.width, source.height); for (let i = 0; i < image.data.length; i += 4) { const gray = Math.round(image.data[i] * .2126 + image.data[i + 1] * .7152 + image.data[i + 2] * .0722); image.data[i] = gray; image.data[i + 1] = gray; image.data[i + 2] = gray; } ctx.putImageData(image, 0, 0); }
          }
          const blob = await new Promise<Blob>((resolve, reject) => source.toBlob(value => value ? resolve(value) : reject(new Error("PDF page image encoding failed.")), "image/jpeg", .94));
          return new Uint8Array(await blob.arrayBuffer());
        };
        const rasterPages: PdfRasterPage[] = [];
        const source = document.createElement("canvas"); source.width = Math.floor(exportWidth()); source.height = Math.floor(exportHeight());
        const sourceCtx = source.getContext("2d"); if (!sourceCtx) throw new Error("Could not create the tiled PDF source image.");
        drawScene(sourceCtx, source.width, source.height, 1, false, false, exportViewFor(source.width, source.height), exportItems, exportGrid());
        const xs = pageOffsets(source.width, metrics.innerWidthPx, metrics.stepX); const ys = pageOffsets(source.height, metrics.innerHeightPx, metrics.stepY);
        for (const y of ys) for (const x of xs) {
          const width = Math.min(metrics.innerWidthPx, source.width - x); const height = Math.min(metrics.innerHeightPx, source.height - y);
          const tile = document.createElement("canvas"); tile.width = width; tile.height = height;
          const tileCtx = tile.getContext("2d"); if (!tileCtx) throw new Error("Could not create a tiled PDF page.");
          tileCtx.drawImage(source, x, y, width, height, 0, 0, width, height);
          rasterPages.push({ jpeg: await toJpeg(tile), imageWidth: width, imageHeight: height, pageWidth: metrics.page.widthPt, pageHeight: metrics.page.heightPt, x: marginPt, y: marginPt, drawWidth: width * 72 / metrics.dpi, drawHeight: height * 72 / metrics.dpi, bleedPt: pdfBleedMm() * 72 / 25.4, grayscale: pdfColorMode() === "grayscale" });
        }
        await writeFile(target, pdfRenderer.imagePdfPages(rasterPages, { pdfHeader, pdfFooter, pdfCropMarks }));
      } else if (format === "png") {
        const width = Math.max(1, Math.min(12000, Math.floor(exportWidth()))); const height = Math.max(1, Math.min(12000, Math.floor(exportHeight())));
        if (width * height > 60_000_000) throw new Error("Export is too large. Choose dimensions totaling no more than 60 megapixels.");
        const output = document.createElement("canvas"); output.width = width; output.height = height;
        const ctx = output.getContext("2d"); if (!ctx) throw new Error("Could not create PNG image.");
        drawScene(ctx, width, height, 1, false, exportTransparent(), exportViewFor(width, height), exportItems, exportGrid());
        const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(value => value ? resolve(value) : reject(new Error("PNG image encoding failed.")), "image/png"));
        await writeFile(target, new Uint8Array(await blob.arrayBuffer()));
      } else {
        const state = exportViewFor(exportWidth(), exportHeight());
        const { createSvgElementSerializer } = await import("./features/export/svg-renderer");
    const elementToSvg = createSvgElementSerializer({ theme, isHidden: isElementHidden, simpleComponentElement, connectorForView, labelSvg });
        const shapes = exportItems.map(elementToSvg).join("\n");
        const pattern = whiteboardStyle(); const svgGridColor = theme() === "dark" ? "#414653" : "#deddd6"; const gridStep = gridStepForStyle(pattern as "plain" | "dots" | "lines" | "small-dots" | "ruled" | "small-grid" | "isometric", GRID_SIZE, state.zoom) * state.zoom;
        const gridPattern = gridSvgPattern(pattern as "plain" | "dots" | "lines" | "small-dots" | "ruled" | "small-grid" | "isometric", gridStep);
        const gridMark = gridPattern.path !== undefined ? `<path d="${gridPattern.path}" fill="none" stroke="${svgGridColor}" stroke-width="0.65"/>` : `<circle cx="0" cy="0" r="${gridPattern.dotRadius}" fill="${svgGridColor}"/>`;
        const grid = exportGrid() && showGrid() && pattern !== "plain" && !exportTransparent() ? `<pattern id="grid" width="${gridPattern.width}" height="${gridPattern.height}" patternUnits="userSpaceOnUse" x="${state.panX}" y="${state.panY}">${gridMark}</pattern><rect width="100%" height="100%" fill="url(#grid)"/>` : "";
        const svgBackground = renderedBoardColor();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${exportWidth()}" height="${exportHeight()}" viewBox="0 0 ${exportWidth()} ${exportHeight()}">${exportTransparent() ? "" : `<rect width="100%" height="100%" fill="${svgBackground}"/>`}${grid}<g transform="translate(${state.panX} ${state.panY}) scale(${state.zoom})">${shapes}</g></svg>`;
        await writeTextFile(target, svg);
      }
      setError("");
    } catch (cause) { setError(`Could not export image: ${String(cause)}`); } finally { setNativeBusy(false); }
  }

  function touchGestureGeometry(points: Point[]) {
    const midpoint = points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
    let distanceTotal = 0; let distanceCount = 0;
    for (let first = 0; first < points.length; first++) for (let second = first + 1; second < points.length; second++) {
      distanceTotal += Math.hypot(points[second].x - points[first].x, points[second].y - points[first].y); distanceCount++;
    }
    return { midpoint, distance: Math.max(1, distanceTotal / Math.max(1, distanceCount)) };
  }

  function startTouchGesture(event: PointerEvent): boolean {
    if (touchPointers.size < 2) return false;
    const fingerCount = Math.min(touchPointers.size, 3) as 2 | 3;
    if (touchGesture?.fingerCount === fingerCount) {
      event.preventDefault();
      try { canvas.setPointerCapture(event.pointerId); } catch { /* The pointer can be canceled before capture. */ }
      return true;
    }
    const continuingGesture = touchGesture !== undefined;
    const points = [...touchPointers.values()].slice(0, fingerCount);
    const { midpoint, distance } = touchGestureGeometry(points);
    const rect = canvas.getBoundingClientRect(); const state = canvasState();
    const action = fingerCount === 2 ? twoFingerGestureAction() : threeFingerGestureAction();
    touchGesture = {
      fingerCount,
      action,
      initialDistance: distance,
      initialZoom: state.zoom,
      initialPanX: state.panX,
      initialPanY: state.panY,
      initialMidpoint: midpoint,
      worldAnchor: { x: (midpoint.x - rect.left - state.panX) / state.zoom, y: (midpoint.y - rect.top - state.panY) / state.zoom },
    };
    event.preventDefault();
    if (!continuingGesture) cancelCanvasInteraction();
    for (const pointerId of touchPointers.keys()) { try { canvas.setPointerCapture(pointerId); } catch { /* A pointer may have left the canvas. */ } }
    setIsPanning(action === "pan" || action === "panZoom");
    return true;
  }

  function updateTouchGesture() {
    if (!touchGesture || touchPointers.size < touchGesture.fingerCount || touchGesture.action === "none") return;
    const points = [...touchPointers.values()].slice(0, touchGesture.fingerCount);
    const { midpoint, distance } = touchGestureGeometry(points);
    const rect = canvas.getBoundingClientRect(); const current = canvasState();
    setCanvasState(canvasStateForTouchGesture(current, touchGesture, midpoint, distance, { x: rect.left, y: rect.top }));
    setDirty(!readOnlyView());
  }

  function beginCanvasInteraction(event: PointerEvent) {
    if (!activePath()) return;
    if (noteEditor()) saveNoteEditor();
    setContextMenu(undefined); penEraserDrawing = false;
    const isPenEraser = !readOnlyView() && penEraser() && event.pointerType === "pen" && (event.button === 5 || (event.buttons & 32) !== 0);
    if (textDraft()) { commitTextDraft(); if (tool() === "text" && !isPenEraser) return; }
    if (!isPenEraser && (event.button === 1 || spaceDown() || tool() === "pan")) {
      event.preventDefault(); setIsPanning(true); panOrigin = { x: event.clientX, y: event.clientY, panX: canvasState().panX, panY: canvasState().panY }; canvas.setPointerCapture(event.pointerId); return;
    }
    if (event.button !== 0 && !isPenEraser) return;
    const point = toWorld(event);
    if (presentationMode()) {
      const hit = hitTest(point); const target = hit === undefined ? undefined : elements()[hit];
      const findLinkedTarget = (item: Element): Element | undefined => {
        if (item.type === "group") for (let index = item.elements.length - 1; index >= 0; index--) {
          const child = item.elements[index];
          if (hitElement(child, point, canvasState().zoom)) { const nested = findLinkedTarget(child); if (nested) return nested; }
        }
        return item.pageLinkId ? item : undefined;
      };
      const linked = target && findLinkedTarget(target);
      if (linked?.pageLinkId) openLinkedPage(linked.pageLinkId, linked.pageLinkTransition ?? "instant");
      return;
    }
    if (readOnlyView() && tool() === "laser") {
      const hit = hitTest(point); const target = hit === undefined ? undefined : elements()[hit];
      if (hit !== undefined && target?.type === "group" && target.note && noteCollapseHit(target, point)) {
        toggleNoteCollapsed(hit); canvas.setPointerCapture(event.pointerId); return;
      }
    }
    if (boardLocked() && tool() !== "laser") return;
    if (isPenEraser) { event.preventDefault(); penEraserDrawing = true; drawing = true; eraseAtPoint(point); canvas.setPointerCapture(event.pointerId); return; }
    if (tool() === "select") {
      libraryControlOrigin = undefined; labelMoveOrigin = undefined;
      const labelHit = hitTest(point); const labelTarget = labelHit === undefined ? undefined : elements()[labelHit];
      if (labelHit !== undefined && labelTarget && isConnector(labelTarget) && labelTarget.label?.text) {
        const box = labelBox(labelTarget);
        if (point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h) {
          setSelectedIndices([labelHit]);
          labelMoveOrigin = { index: labelHit, point, before: elements(), offsetX: labelTarget.label.offsetX ?? 0, offsetY: labelTarget.label.offsetY ?? 0, rotation: labelTarget.rotation ?? 0, moved: false };
          canvas.setPointerCapture(event.pointerId); return;
        }
      }
      const handle = findTransformHandle(point);
      if (handle) { const original = elements()[handle.index]; resizeOrigin = { ...handle, start: point, original, before: elements(), moved: false }; canvas.setPointerCapture(event.pointerId); return; }
      const hit = hitTest(point);
      if (hit !== undefined) {
        const target = elements()[hit];
        if (target?.type === "group" && target.libraryComponent) libraryControlOrigin = { index: hit };
        if (target?.type === "group" && target.note && noteCollapseHit(target, point)) { toggleNoteCollapsed(hit); canvas.setPointerCapture(event.pointerId); return; }
        if (target?.type === "group" && target.note?.kind === "checklist") {
          const row = checklistIndexAt(target, point);
          if (row !== undefined) { toggleChecklist(hit, row); canvas.setPointerCapture(event.pointerId); return; }
        }
        const current = selectedIndices();
        const next = event.shiftKey
          ? current.includes(hit) ? current.filter((index) => index !== hit) : [...current, hit]
          : current.includes(hit) ? current : [hit];
        setSelectedIndices(next);
        setSidebarTab("properties");
        const movable = next.filter((index) => { const element = elements()[index]; return !!element && canMoveElement(element); });
        if (movable.includes(hit)) {
          const before = elements();
          moveOrigin = { indices: movable, point, before, moved: false, dx: 0, dy: 0, snapTargets: collectSnapTargets(movable, before), targets: collectMoveTargets(movable, before) };
        }
      } else {
        if (!event.shiftKey) setSelectedIndices([]);
        marqueeOrigin = { point, additive: event.shiftKey, moved: false };
        setMarquee({ start: point, end: point });
      }
      canvas.setPointerCapture(event.pointerId); return;
    }
    if (tool() === "line" || tool() === "arrow") {
      const handle = findTransformHandle(point);
      if (handle && isConnector(elements()[handle.index])) {
        const original = elements()[handle.index];
        resizeOrigin = { ...handle, start: point, original, before: elements(), moved: false };
        canvas.setPointerCapture(event.pointerId); return;
      }
    }
    if (tool() === "text") {
      const activeTextMode = textMode();
      if (activeTextMode !== "text") {
        const hit = hitTest(point); const element = hit === undefined ? undefined : elements()[hit];
        if (element?.type === "group" && element.note && (activeTextMode === "markdown" || activeTextMode === "table" || element.note.kind === activeTextMode)) openNoteEditor(point, element.note.kind, hit);
        else if (activeTextMode === "markdown") openNoteEditor(point, "note", undefined, { title: "Markdown" });
        else if (activeTextMode === "table") openNoteEditor(point, "note", undefined, { title: "Markdown table", content: "| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |\n| Cell | Cell |" });
        else openNoteEditor(point, activeTextMode);
        return;
      }
      const hit = hitTest(point) ?? hitInterior(point); if (hit !== undefined && (isLabelShape(elements()[hit]) || isConnector(elements()[hit]))) editShapeLabel(hit, event.pointerId); else startTextDraft(point, hit !== undefined && elements()[hit]?.type === "text" ? hit : undefined, event.pointerId); return;
    }
    if (tool() === "bucket") { const hit = hitInterior(point); if (hit !== undefined) updatePropertyForIndex(hit, fillColor()); return; }
    if (tool() === "eraser") { eraseAtPoint(point); drawing = true; canvas.setPointerCapture(event.pointerId); return; }
    if (tool() === "crop") { const hit = hitTest(point); if (hit !== undefined && elements()[hit].type === "image") { setSelectedIndices([hit]); marqueeOrigin = { point, additive: false, moved: false, cropIndex: hit }; setMarquee({ start: point, end: point }); canvas.setPointerCapture(event.pointerId); } return; }
    drawing = true; canvas.setPointerCapture(event.pointerId);
    activeDrawingTool = tool() === "laser" ? "pen" : tool() as Preview["type"];
    const start = activeDrawingTool === "line" || activeDrawingTool === "arrow" ? nearestBinding(elements(), point, 18 / canvasState().zoom, item => !isElementHidden(item) && !isElementLocked(item))?.point ?? snap(point) : activeDrawingTool === "pen" ? point : snap(point);
    if (activeDrawingTool === "pen") {
      const laser = tool() === "laser"; const mode = brushMode();
      const strokePoint = tool() === "pen" ? strokePointFromPointer(event, point) : point; currentPoints = [strokePoint]; strokePointLimitReached = false;
      strokeSampleGate.reset(event.timeStamp);
      const brushStyle: Record<BrushMode, { width: number; opacity: number }> = { fine: { width: 1, opacity: 1 }, pencil: { width: .72, opacity: .62 }, brush: { width: 2.2, opacity: .9 }, marker: { width: 3, opacity: .78 }, highlighter: { width: 6, opacity: .28 }, chalk: { width: 1.7, opacity: .48 } };
      const style = brushStyle[mode];
      setPreview({ type: "pen", start: point, end: point, color: laser ? laserColor() : color(), thickness: laser ? laserThickness() / canvasState().zoom : Math.max(mode === "highlighter" ? 12 : mode === "marker" ? 6 : 1, thickness() * style.width), opacity: laser ? 1 : style.opacity });
    }
    else setPreview({ type: activeDrawingTool, start, end: start, color: color(), thickness: thickness(), ...(activeDrawingTool === "flowchart" ? { flowchartShape: flowchartShape() } : {}), ...(activeDrawingTool === "line" ? { lineRoute: lineRoute() } : {}), ...(activeDrawingTool === "arrow" ? { arrowRoute: arrowRoute() } : {}) });
  }

  function beginTouchPan(event: PointerEvent) {
    event.preventDefault();
    if (noteEditor()) saveNoteEditor();
    if (textDraft()) commitTextDraft();
    setContextMenu(undefined);
    setIsPanning(true);
    panOrigin = { x: event.clientX, y: event.clientY, panX: canvasState().panX, panY: canvasState().panY };
    try { canvas.setPointerCapture(event.pointerId); } catch { /* The pointer can be canceled before capture. */ }
  }

  function cancelCanvasInteraction() {
    pendingAndroidStylusSamples = [];
    if (resizeOrigin) setElements(resizeOrigin.before);
    if (labelMoveOrigin) setElements(labelMoveOrigin.before);
    if (pathNodeOrigin) setElements(pathNodeOrigin.before);
    if (moveOrigin) { moveOrigin = undefined; scheduleCanvasRender(); }
    drawing = false; currentPoints = []; strokePointLimitReached = false; penEraserDrawing = false;
    setPreview(undefined); setMarquee(undefined); setAttachmentHint(undefined);
    resizeOrigin = undefined; moveOrigin = undefined; labelMoveOrigin = undefined; pathNodeOrigin = undefined; measureOrigin = undefined; marqueeOrigin = undefined; panOrigin = undefined;
    setMeasurement(undefined);
    setIsPanning(false);
  }

  function pointerDown(event: PointerEvent) {
    if (!activePath()) return;
    if (event.target === canvas && measureMode() && event.button === 0) {
      event.preventDefault(); measureOrigin = toWorld(event); setMeasurement({ start: measureOrigin, end: measureOrigin });
      try { canvas.setPointerCapture(event.pointerId); } catch { /* The pointer can be canceled before capture. */ }
      return;
    }
    if (event.pointerType === "pen") event.preventDefault();
    if (event.pointerType === "touch" && activePenPointerId !== undefined && !drawing && !panOrigin && !resizeOrigin && !moveOrigin && !labelMoveOrigin && !marqueeOrigin) activePenPointerId = undefined;
    if (activePenPointerId !== undefined && event.pointerType !== "touch" && event.pointerId !== activePenPointerId) return;
    if (event.pointerType === "pen") {
      activePenPointerId = event.pointerId;
      if (touchPointers.size) {
        touchPointers.clear(); touchGesture = undefined; touchTapTracker = undefined;
        cancelCanvasInteraction();
      }
    }
    if (event.pointerType === "touch" && activePenPointerId !== undefined) {
      ignoredTouchPointers.add(event.pointerId);
      event.preventDefault();
      return;
    }
    if (event.target === canvas && isCompactTouchLayout() && (event.pointerType !== "mouse" || !!touchStylePanel()) &&
      (canvasOptionsOpen() || !!touchStylePanel() || !!openToolOptions() || stencilMenuOpen() || !!quickStylePopover() || !!contextMenu() || !!document.querySelector("details[open]") || !!noteEditor() || !!textDraft())) {
      if (noteEditor()) saveNoteEditor();
      if (textDraft()) commitTextDraft();
      event.preventDefault();
      return;
    }
    if (event.pointerType === "touch") {
      const point = { x: event.clientX, y: event.clientY };
      touchPointers.set(event.pointerId, point);
      if (!touchTapTracker && touchPointers.size === 1) touchTapTracker = { startedAt: performance.now(), starts: new Map([[event.pointerId, point]]), maxFingers: 1, canceled: false, initialEvent: event };
      else if (touchTapTracker) {
        if (performance.now() - touchTapTracker.startedAt > 280 || touchPointers.size > 3) touchTapTracker.canceled = true;
        touchTapTracker.starts.set(event.pointerId, point);
        touchTapTracker.maxFingers = Math.max(touchTapTracker.maxFingers, Math.min(3, touchPointers.size));
      }
      if (startTouchGesture(event)) return;
      const touchHit = hitTest(toWorld(event)); const touchTarget = touchHit === undefined ? undefined : elements()[touchHit];
      const directLibraryControl = touchTarget?.type === "group" && !!touchTarget.libraryComponent?.kind.startsWith("form-");
      if (touchPointers.size === 1 && !readOnlyView() && !directLibraryControl && (oneFingerTapAction() !== "none" || oneFingerDragAction() === "pan")) {
        event.preventDefault();
        try { canvas.setPointerCapture(event.pointerId); } catch { /* The pointer can be canceled before capture. */ }
        return;
      }
    }
    beginCanvasInteraction(event);
    if (event.pointerType === "pen" && isAndroidPlatform() && activeDrawingTool === "pen" && pendingAndroidStylusSamples.length) {
      const queued = pendingAndroidStylusSamples;
      pendingAndroidStylusSamples = [];
      appendAndroidStylusSamples(queued);
    }
  }

  function appendStrokeSample(event: PointerEvent, point: Point) {
    if (event.pointerType === "pen" && event.pressure <= 0 && (event.buttons & 1) === 0) return;
    if (!strokeSampleGate.accept("pointer", event.timeStamp)) return;
    const previous = currentPoints[currentPoints.length - 1];
    const minDistance = event.pointerType === "pen" ? .01 : .05;
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) * canvasState().zoom < minDistance) return;
    appendStrokePoint(tool() === "pen" ? strokePointFromPointer(event, point) : point);
  }

  function appendPenSamples(event: PointerEvent, appendTerminal = true) {
    const bounds = canvas.getBoundingClientRect(); const state = canvasState();
    let samples: PointerEvent[] = [];
    try { samples = event.getCoalescedEvents?.() ?? []; } catch { /* Some Android WebViews expose this API without implementing it. */ }
    if (!samples.length) samples = [event];
    for (const sample of samples) appendStrokeSample(sample, { x: (sample.clientX - bounds.left - state.panX) / state.zoom, y: (sample.clientY - bounds.top - state.panY) / state.zoom });
    if (appendTerminal && samples[samples.length - 1] !== event) appendStrokeSample(event, { x: (event.clientX - bounds.left - state.panX) / state.zoom, y: (event.clientY - bounds.top - state.panY) / state.zoom });
  }

  function pointerRawUpdate(event: PointerEvent) {
    if (event.pointerType !== "pen" || activePenPointerId !== event.pointerId || activeDrawingTool !== "pen" || (!drawing && !preview())) return;
    const previousRevision = currentPointsRevision;
    appendPenSamples(event);
    if (currentPointsRevision !== previousRevision) canvasRenderScheduler.schedulePreview();
  }

  function pointerMove(event: PointerEvent) {
    if (measureOrigin) { event.preventDefault(); setMeasurement({ start: measureOrigin, end: toWorld(event) }); return; }
    if (pathNodeOrigin) { event.preventDefault(); moveEditedPathNode(event); return; }
    if (activePenPointerId !== undefined && event.pointerType !== "touch" && event.pointerId !== activePenPointerId) return;
    if (ignoredTouchPointers.has(event.pointerId) || event.pointerType === "touch" && !touchPointers.has(event.pointerId)) return;
    if (event.pointerType === "touch" && touchPointers.has(event.pointerId)) {
      touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const start = touchTapTracker?.starts.get(event.pointerId);
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > TOUCH_DRAG_THRESHOLD && touchTapTracker) {
        const tap = touchTapTracker;
        tap.canceled = true;
        if (!readOnlyView() && tap.maxFingers === 1 && !tap.deferredInteractionStarted && (oneFingerTapAction() !== "none" || oneFingerDragAction() === "pan")) {
          tap.deferredInteractionStarted = true;
          if (oneFingerDragAction() === "pan") beginTouchPan(tap.initialEvent);
          else beginCanvasInteraction(tap.initialEvent);
        }
      }
      if (touchGesture) { updateTouchGesture(); return; }
    }
    if (marqueeOrigin) {
      const end = toWorld(event);
      if (Math.hypot(end.x - marqueeOrigin.point.x, end.y - marqueeOrigin.point.y) > 2 / canvasState().zoom) marqueeOrigin.moved = true;
      setMarquee((current) => current ? { ...current, end } : undefined); return;
    }
    if (panOrigin) {
      setCanvasState({ ...canvasState(), panX: panOrigin.panX + event.clientX - panOrigin.x, panY: panOrigin.panY + event.clientY - panOrigin.y }); setDirty(!readOnlyView());
      return;
    }
    if (labelMoveOrigin) {
      const origin = labelMoveOrigin; const point = toWorld(event); const dx = point.x - origin.point.x; const dy = point.y - origin.point.y; const angle = -origin.rotation * Math.PI / 180; const localDx = dx * Math.cos(angle) - dy * Math.sin(angle); const localDy = dx * Math.sin(angle) + dy * Math.cos(angle);
      if (Math.hypot(dx, dy) > 0.5) origin.moved = true;
      if (origin.moved) {
        setElementsTransient(origin.before.map((element, index) => index === origin.index && isConnector(element) ? { ...element, label: { text: "", color: color(), fontSize: defaultFontSize(), verticalAlign: "middle", ...element.label, offsetX: origin.offsetX + localDx, offsetY: origin.offsetY + localDy } } : element), [origin.index]);
        setDirty(true);
      }
      return;
    }
    if (resizeOrigin) {
      const pointerPoint = toWorld(event); if (Math.hypot(pointerPoint.x - resizeOrigin.start.x, pointerPoint.y - resizeOrigin.start.y) > 0.5) resizeOrigin.moved = true;
      const snapped = isConnector(resizeOrigin.original) ? { point: pointerPoint } : snapResizePoint(resizeOrigin.original, resizeOrigin.handle, resizeOrigin.start, pointerPoint, event.ctrlKey || event.metaKey);
      const resized = resizeElement(resizeOrigin.original, resizeOrigin.handle, resizeOrigin.start, snapped.point, event.shiftKey || !!resizeOrigin.original.aspectLocked);
      setElementsTransient(resizeOrigin.before.map((element, index) => index === resizeOrigin!.index ? resized : element), [resizeOrigin.index]); setDirty(true); return;
    }
    if (moveOrigin) {
      const point = toWorld(event); let dx = point.x - moveOrigin.point.x; let dy = point.y - moveOrigin.point.y;
      if (event.shiftKey) {
        if (!moveOrigin.axisLock) moveOrigin.axisLock = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
        if (moveOrigin.axisLock === "x") dy = 0; else dx = 0;
      } else moveOrigin.axisLock = undefined;
      if (Math.hypot(dx, dy) > 0.5) moveOrigin.moved = true;
      if (moveOrigin.moved) {
        const snapped = snapTranslation(moveOrigin.indices, moveOrigin.before, dx, dy, moveOrigin.snapTargets, event.ctrlKey || event.metaKey);
        moveOrigin.dx = snapped.dx; moveOrigin.dy = snapped.dy; scheduleCanvasRender(); setDirty(true);
      }
      return;
    }
    if (!drawing) {
      const point = toWorld(event); const hit = tool() === "select" || readOnlyView() ? hitTest(point) : undefined;
      setHoveredIndex(hit);
      const target = hit === undefined ? undefined : elements()[hit];
      setNoteToggleHovered(target?.type === "group" && !!target.note && noteCollapseHit(target, point));
      return;
    }
    if (penEraserDrawing || tool() === "eraser") { eraseAtPoint(toWorld(event)); return; }
    if (activeDrawingTool === "pen") {
      const previousRevision = currentPointsRevision;
      if (event.pointerType === "pen") { event.preventDefault(); appendPenSamples(event); }
      else appendStrokeSample(event, toWorld(event));
      if (currentPointsRevision !== previousRevision) canvasRenderScheduler.schedulePreview();
      return;
    }
    const raw = toWorld(event); const port = activeDrawingTool === "line" || activeDrawingTool === "arrow" ? nearestBinding(elements(), raw, 18 / canvasState().zoom, item => !isElementHidden(item) && !isElementLocked(item)) : undefined;
    setAttachmentHint(port?.point); const point = port?.point ?? snap(raw);
    setPreview((previous) => previous ? { ...previous, end: point } : undefined);
  }

  function moveElement(element: Element, dx: number, dy: number): Element {
    if (isElementLocked(element)) return element;
    if (element.type === "group") return { ...element, ...(element.componentBounds ? { componentBounds: { ...element.componentBounds, x: element.componentBounds.x + dx, y: element.componentBounds.y + dy } } : {}), elements: element.elements.map((child) => moveElement(child, dx, dy)) };
    if (element.type === "freehand") return { ...element, points: element.points.map((point) => ({ ...point, x: point.x + dx, y: point.y + dy })) };
    if (isConnector(element)) {
      const shiftBranch = (branch: ShapeElement["forkUpper"]) => branch ? { ...branch, end: branch.end ? { x: branch.end.x + dx, y: branch.end.y + dy } : undefined, routePoints: branch.routePoints?.map(point => ({ x: point.x + dx, y: point.y + dy })) } : undefined;
      return { ...element, x: element.x + dx, y: element.y + dy, routePoints: element.routePoints?.map(p => ({ x: p.x + dx, y: p.y + dy })), forkUpper: shiftBranch(element.forkUpper), forkLower: shiftBranch(element.forkLower) };
    }
    return { ...element, x: element.x + dx, y: element.y + dy };
  }

  function canMoveElement(element: Element): boolean {
    return !isElementLocked(element) && (element.type !== "group" || element.elements.every(canMoveElement));
  }

  function collectSnapTargets(indices: number[], before: Element[]) {
    const selected = new Set(indices);
    const moving = unionBounds(before.flatMap((element, index) => {
      if (!selected.has(index) || isElementHidden(element)) return [];
      const bounds = elementGridBounds(element);
      return bounds ? [bounds] : [];
    }));
    const x: number[] = []; const y: number[] = []; const spacingBoxes: Bounds[] = [];
    if (moving) {
      const margin = 120 / Math.max(.02, canvasState().zoom);
      const nearby = activeElementSpatialIndex.query({ x: moving.x - margin, y: moving.y - margin, w: moving.w + margin * 2, h: moving.h + margin * 2 });
      const center = { x: moving.x + moving.w / 2, y: moving.y + moving.h / 2 };
      const candidates = nearby.flatMap(index => {
        const element = before[index]; if (!element || selected.has(index) || isElementHidden(element)) return [];
        const box = elementBounds(element); const distance = Math.hypot(box.x + box.w / 2 - center.x, box.y + box.h / 2 - center.y);
        return [{ box, distance }];
      }).sort((left, right) => left.distance - right.distance).slice(0, 48);
      for (const { box } of candidates) {
        spacingBoxes.push(box);
        x.push(box.x, box.x + box.w / 2, box.x + box.w); y.push(box.y, box.y + box.h / 2, box.y + box.h);
      }
    }
    x.sort((left, right) => left - right); y.sort((left, right) => left - right);
    return { x, y, spacingBoxes };
  }

  function collectMoveTargets(indices: number[], before: Element[]) {
    const selected = new Set(indices); const targets = new Map<string, Element>();
    const visit = (element: Element) => { if (element.id) targets.set(element.id, element); if (element.type === "group") element.elements.forEach(visit); };
    for (let index = 0; index < before.length; index++) if (selected.has(index)) visit(before[index]);
    return targets;
  }

  function snapTranslation(indices: number[], before: Element[], dx: number, dy: number, snapTargets: { x: number[]; y: number[]; spacingBoxes?: Bounds[] }, bypass = false) {
    const selected = new Set(indices); const moving = unionBounds(before.flatMap((element, index) => {
      if (!selected.has(index) || isElementHidden(element)) return [];
      const bounds = elementGridBounds(element);
      return bounds ? [bounds] : [];
    }));
    if (!moving) return { dx, dy };
    const left = moving.x; const top = moving.y; const right = moving.x + moving.w; const bottom = moving.y + moving.h;
    const movingX = [left, (left + right) / 2, right]; const movingY = [top, (top + bottom) / 2, bottom];
    const threshold = 8 / canvasState().zoom;
    const closest = (targets: number[], movingValues: number[], delta: number) => {
      let best: { correction: number; target: number } | undefined;
      for (const source of movingValues) {
        const value = source + delta; let low = 0; let high = targets.length;
        while (low < high) { const middle = (low + high) >>> 1; if (targets[middle] < value) low = middle + 1; else high = middle; }
        for (const index of [low - 1, low]) {
          if (index < 0 || index >= targets.length) continue;
          const target = targets[index];
          const correction = target - (source + delta);
          if (Math.abs(correction) <= threshold && (!best || Math.abs(correction) < Math.abs(best.correction))) best = { correction, target };
        }
      }
      return best;
    };
    if (bypass) return { dx, dy };
    const objectX = snapToObjects() ? closest(snapTargets.x, movingX, dx) : undefined;
    const objectY = snapToObjects() ? closest(snapTargets.y, movingY, dy) : undefined;
    const findEqualGap = (axis: "x" | "y") => {
      if (!snapToObjects()) return undefined;
      const boxes = [...(snapTargets.spacingBoxes ?? [])].sort((left, right) => (axis === "x" ? left.x : left.y) - (axis === "x" ? right.x : right.y));
      const length = axis === "x" ? moving.w : moving.h;
      const movingStart = (axis === "x" ? moving.x : moving.y) + (axis === "x" ? dx : dy);
      const movingCrossStart = axis === "x" ? moving.y : moving.x;
      const movingCrossLength = axis === "x" ? moving.h : moving.w;
      let best: { correction: number; target: number } | undefined;
      for (let leftIndex = 0; leftIndex < boxes.length; leftIndex++) for (let rightIndex = leftIndex + 1; rightIndex < boxes.length; rightIndex++) {
        const left = boxes[leftIndex]; const right = boxes[rightIndex];
        const leftStart = axis === "x" ? left.x : left.y; const leftLength = axis === "x" ? left.w : left.h;
        const rightStart = axis === "x" ? right.x : right.y;
        const leftCrossStart = axis === "x" ? left.y : left.x; const leftCrossLength = axis === "x" ? left.h : left.w;
        const rightCrossStart = axis === "x" ? right.y : right.x; const rightCrossLength = axis === "x" ? right.h : right.w;
        const crossAligned = Math.abs((leftCrossStart + leftCrossLength / 2) - (movingCrossStart + movingCrossLength / 2)) <= Math.max(16 / canvasState().zoom, Math.min(leftCrossLength, movingCrossLength) * .5)
          && Math.abs((rightCrossStart + rightCrossLength / 2) - (movingCrossStart + movingCrossLength / 2)) <= Math.max(16 / canvasState().zoom, Math.min(rightCrossLength, movingCrossLength) * .5);
        const gapStart = leftStart + leftLength; const gapEnd = rightStart;
        if (!crossAligned || gapEnd - gapStart < length) continue;
        const target = gapStart + (gapEnd - gapStart - length) / 2;
        const correction = target - movingStart;
        if (Math.abs(correction) <= threshold && (!best || Math.abs(correction) < Math.abs(best.correction))) best = { correction, target };
      }
      return best;
    };
    const spacingX = findEqualGap("x"); const spacingY = findEqualGap("y");
    let gridX: number | undefined; let gridY: number | undefined;
    if (snapToGrid()) {
      const style = whiteboardStyle();
      const snapped = snapCanvasPoint({ x: moving.x + dx, y: moving.y + dy }, true, style, GRID_SIZE);
      gridX = snapped.x - (moving.x + dx); gridY = snapped.y - (moving.y + dy);
    }
    // Keep object alignment when it also lands the moved bounds on the grid;
    // otherwise grid snapping takes priority and stays exact.
    const landsOnGrid = (position: number) => Math.abs(position / GRID_SIZE - Math.round(position / GRID_SIZE)) < 1e-7;
    const objectCorrectionX = objectX && (!snapToGrid() || landsOnGrid(objectX.target) && landsOnGrid(moving.x + dx + objectX.correction)) ? objectX.correction : undefined;
    const objectCorrectionY = objectY && (!snapToGrid() || landsOnGrid(objectY.target) && landsOnGrid(moving.y + dy + objectY.correction)) ? objectY.correction : undefined;
    const objectOrSpaceX = spacingX && (!objectCorrectionX || Math.abs(spacingX.correction) < Math.abs(objectCorrectionX)) ? spacingX : objectCorrectionX !== undefined ? { correction: objectCorrectionX, target: objectX!.target } : undefined;
    const objectOrSpaceY = spacingY && (!objectCorrectionY || Math.abs(spacingY.correction) < Math.abs(objectCorrectionY)) ? spacingY : objectCorrectionY !== undefined ? { correction: objectCorrectionY, target: objectY!.target } : undefined;
    const correctionX = objectOrSpaceX?.correction ?? gridX ?? 0;
    const correctionY = objectOrSpaceY?.correction ?? gridY ?? 0;
    return { dx: dx + correctionX, dy: dy + correctionY };
  }

  function hitInterior(point: Point): number | undefined {
    const context = canvas?.getContext("2d"); if (!context) return undefined;
    for (let index = elements().length - 1; index >= 0; index--) {
      const shape = elements()[index]; if (!isLabelShape(shape) || shape.hidden || shape.locked) continue;
      const cx = shape.x + shape.w / 2; const cy = shape.y + shape.h / 2; const angle = -(shape.rotation ?? 0) * Math.PI / 180;
      const local = { x: cx + (point.x - cx) * Math.cos(angle) - (point.y - cy) * Math.sin(angle), y: cy + (point.x - cx) * Math.sin(angle) + (point.y - cy) * Math.cos(angle) };
      context.save(); context.setTransform(1, 0, 0, 1, 0, 0); context.beginPath();
      if (shape.type === "svgPath") { try { const path = new Path2D(shape.pathData ?? ""); const px = (local.x - shape.x) * (shape.pathWidth ?? shape.w) / shape.w; const py = (local.y - shape.y) * (shape.pathHeight ?? shape.h) / shape.h; const inside = !!shape.fillColor && context.isPointInPath(path, px, py, shape.fillRule ?? "nonzero"); context.restore(); if (inside) return index; continue; } catch { context.restore(); continue; } }
      const shapePath = shapePathObject(shape);
      const inside = shapePath ? context.isPointInPath(shapePath, local.x, local.y, shapeFillRule(shape)) : false;
      context.restore(); if (inside) return index;
    }
    return undefined;
  }

  function updatePropertyForIndex(index: number, value: string) {
    const before = cloneElements(elements()); setElements((items) => items.map((element, current) => current === index && (element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "triangle" || element.type === "flowchart" || element.type === "svgPath") ? { ...element, fillColor: value, fillOpacity: 1 } : element)); pushUndo(before); setDirty(true);
  }

  function eraseAtPoint(point: Point) {
    const hit = hitTest(point, eraserSize()); if (hit === undefined) return;
    const before = cloneElements(elements()); setElements((items) => items.filter((_, index) => index !== hit)); setSelectedIndices((indices) => indices.filter((index) => index !== hit).map((index) => index > hit ? index - 1 : index)); pushUndo(before); setDirty(true);
  }

  function pointerCancel(event: PointerEvent) {
    if (event.pointerType === "pen") pendingAndroidStylusSamples = [];
    if (textEditorPendingPointerId === event.pointerId) textEditorPendingPointerId = undefined;
    if (activePenPointerId !== undefined && event.pointerType !== "touch" && event.pointerId !== activePenPointerId) return;
    if (ignoredTouchPointers.delete(event.pointerId) || event.pointerType === "touch" && !touchPointers.has(event.pointerId)) return;
    if (event.pointerType === "pen" && activePenPointerId === event.pointerId) activePenPointerId = undefined;
    touchPointers.clear(); touchGesture = undefined; touchTapTracker = undefined;
    cancelCanvasInteraction();
  }

  function pointerLostCapture(event: PointerEvent) {
    if (event.pointerType === "pen" && activePenPointerId === event.pointerId || event.pointerType === "touch" && touchPointers.has(event.pointerId)) pointerCancel(event);
  }

  function pointerUp(event: PointerEvent) {
    if (measureOrigin) { measureOrigin = undefined; return; }
    if (pathNodeOrigin) { finishPathNodeEdit(); return; }
    if (event.pointerType === "pen") pendingAndroidStylusSamples = [];
    if (activePenPointerId !== undefined && event.pointerType !== "touch" && event.pointerId !== activePenPointerId) return;
    if (ignoredTouchPointers.delete(event.pointerId) || event.pointerType === "touch" && !touchPointers.has(event.pointerId)) return;
    if (event.pointerType === "pen" && activePenPointerId === event.pointerId) activePenPointerId = undefined;
    if (textEditorPendingPointerId === event.pointerId) {
      textEditorPendingPointerId = undefined;
      textEditorFocusOnCanvasClick = true;
      focusTextEditor();
      textEditorFocusTimer = window.setTimeout(() => {
        textEditorFocusTimer = undefined;
        textEditorFocusOnCanvasClick = false;
        focusTextEditor();
      }, 0);
    }
    let handledTapAction = false;
    if (event.pointerType === "touch") {
      const start = touchTapTracker?.starts.get(event.pointerId);
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > TOUCH_DRAG_THRESHOLD && touchTapTracker) touchTapTracker.canceled = true;
      touchPointers.delete(event.pointerId);
      if (touchPointers.size === 0) {
        const tap = touchTapTracker;
        touchTapTracker = undefined;
        if (!readOnlyView() && tap && !tap.canceled && performance.now() - tap.startedAt <= 500) {
          if (tap.maxFingers === 1 && oneFingerTapAction() !== "none") { runTouchTapAction(oneFingerTapAction()); handledTapAction = true; }
          else if (tap.maxFingers === 2 && twoFingerTapAction() !== "none") { runTouchTapAction(twoFingerTapAction()); handledTapAction = true; }
          else if (tap.maxFingers === 3 && threeFingerTapAction() !== "none") { runTouchTapAction(threeFingerTapAction()); handledTapAction = true; }
        }
      }
      if (touchGesture) {
        if (touchPointers.size < 2) { touchGesture = undefined; setIsPanning(false); }
        else startTouchGesture(event);
        return;
      }
      if (handledTapAction) {
        if (libraryControlOrigin && moveOrigin && !moveOrigin.moved) activateLibraryControl(libraryControlOrigin.index, toWorld(event));
        libraryControlOrigin = undefined; moveOrigin = undefined;
        return;
      }
    }
    setAttachmentHint(undefined);
    if (panOrigin) { panOrigin = undefined; setIsPanning(false); return; }
    if (marqueeOrigin) {
      const activeMarquee = marquee();
      if (activeMarquee && marqueeOrigin.moved) {
        const box = { x: Math.min(activeMarquee.start.x, activeMarquee.end.x), y: Math.min(activeMarquee.start.y, activeMarquee.end.y), w: Math.abs(activeMarquee.end.x - activeMarquee.start.x), h: Math.abs(activeMarquee.end.y - activeMarquee.start.y) };
        setExportMarqueeRegion(box);
        if (marqueeOrigin.cropIndex !== undefined) {
          const index = marqueeOrigin.cropIndex; const image = elements()[index]; const bitmap = image?.type === "image" ? imageCache.get(image.dataUrl) : undefined;
          if (image?.type === "image" && bitmap?.naturalWidth && box.w > 2 && box.h > 2) {
            const sourceX = image.cropX ?? 0; const sourceY = image.cropY ?? 0; const sourceW = image.cropW ?? bitmap.naturalWidth; const sourceH = image.cropH ?? bitmap.naturalHeight;
            const left = Math.max(image.x, box.x); const top = Math.max(image.y, box.y); const right = Math.min(image.x + image.w, box.x + box.w); const bottom = Math.min(image.y + image.h, box.y + box.h);
            if (right > left && bottom > top) { const before = cloneElements(elements()); const sx = sourceX + (left - image.x) / image.w * sourceW; const sy = sourceY + (top - image.y) / image.h * sourceH; const sw = (right - left) / image.w * sourceW; const sh = (bottom - top) / image.h * sourceH; setElements((items) => items.map((element, current) => current === index && element.type === "image" ? { ...element, x: left, y: top, w: right - left, h: bottom - top, cropX: sx, cropY: sy, cropW: sw, cropH: sh } : element)); pushUndo(before); setDirty(true); }
          }
          marqueeOrigin = undefined; setMarquee(undefined); return;
        }
        const overlaps: number[] = [];
        elements().forEach((element, index) => {
          if (isElementHidden(element) || isElementLocked(element)) return;
          const bounds = elementBounds(element);
          if (bounds.x >= box.x && bounds.y >= box.y && bounds.x + bounds.w <= box.x + box.w && bounds.y + bounds.h <= box.y + box.h) overlaps.push(index);
        });
        setSelectedIndices(marqueeOrigin.additive ? [...new Set([...selectedIndices(), ...overlaps])] : overlaps);
        setSidebarTab("properties");
      }
      marqueeOrigin = undefined; setMarquee(undefined); return;
    }
    if (labelMoveOrigin) {
      const origin = labelMoveOrigin;
      if (origin.moved) { setElements(elements()); pushUndo(origin.before); }
      labelMoveOrigin = undefined; scheduleCanvasRender(); return;
    }
    if (resizeOrigin) { const origin = resizeOrigin; if (origin.moved) { setElements(elements()); pushUndo(origin.before); } resizeOrigin = undefined; return; }
    if (moveOrigin) {
      const origin = moveOrigin;
      if (origin.moved) {
        const selected = new Set(origin.indices);
        setElements(origin.before.map((element, index) => selected.has(index) ? moveElement(element, origin.dx, origin.dy) : element));
        pushUndo(origin.before);
      } else if (libraryControlOrigin) activateLibraryControl(libraryControlOrigin.index, toWorld(event));
      libraryControlOrigin = undefined;
      moveOrigin = undefined; scheduleCanvasRender(); return;
    }
    if (!drawing) return;
    if (penEraserDrawing) { penEraserDrawing = false; drawing = false; return; }
    if (tool() === "eraser") { drawing = false; return; }
    if (activeDrawingTool === "pen") {
      if (event.pointerType === "pen") event.preventDefault();
      if (event.pointerType === "pen") appendPenSamples(event, false);
      const end = toWorld(event); const last = currentPoints[currentPoints.length - 1];
      const minDistance = event.pointerType === "pen" ? .01 : .05;
      if (last && Math.hypot(end.x - last.x, end.y - last.y) * canvasState().zoom >= minDistance) {
        appendStrokePoint(tool() === "pen" ? { ...end, pressure: last.pressure, tiltX: last.tiltX, tiltY: last.tiltY, orientation: last.orientation } : end);
      }
    }
    drawing = false; const activePreview = preview();
    if (tool() === "laser") {
      if (activePreview && currentPoints.length) {
        setLaserTrail({ points: [...currentPoints], opacity: 1 });
        window.clearInterval(laserTimer);
        const startedAt = Date.now();
        laserTimer = window.setInterval(() => setLaserTrail((trail) => {
          if (!trail) return undefined;
          const opacity = 1 - (Date.now() - startedAt) / laserFadeDuration();
          if (opacity <= 0) { window.clearInterval(laserTimer); laserTimer = undefined; return undefined; }
          return { ...trail, opacity };
        }), 32);
      }
      currentPoints = []; strokePointLimitReached = false; setPreview(undefined); return;
    }
    if (activePreview) {
      const item: Element = activePreview.type === "pen"
        ? { type: "freehand", points: currentPoints, color: activePreview.color, thickness: activePreview.thickness, opacity: activePreview.opacity }
        : { type: activePreview.type, x: activePreview.start.x, y: activePreview.start.y, w: activePreview.end.x - activePreview.start.x, h: activePreview.end.y - activePreview.start.y, color: activePreview.color, thickness: activePreview.thickness, lineStyle: lineStyle(), edgeStyle: edgeStyle(), cornerRadius: cornerRadius(), flowchartShape: activePreview.type === "flowchart" ? activePreview.flowchartShape : undefined, lineRoute: activePreview.type === "line" ? activePreview.lineRoute : undefined, arrowRoute: activePreview.type === "arrow" ? activePreview.arrowRoute : undefined, ...(fillEnabled() && (activePreview.type === "rectangle" || activePreview.type === "circle" || activePreview.type === "diamond" || activePreview.type === "triangle" || activePreview.type === "flowchart") ? { fillColor: fillColor(), fillOpacity: fillOpacity() } : {}), ...(activePreview.type === "line" ? { startHead: defaultLineStartHead(), endHead: defaultLineEndHead() } : {}), ...(activePreview.type === "arrow" ? { startHead: defaultStartHead(), endHead: defaultEndHead(), ...(activePreview.arrowRoute === "forked" ? { forkUpper: { endHead: defaultForkUpperHead() }, forkLower: { endHead: defaultForkLowerHead() } } : {}) } : {}) } as ShapeElement;
      const valid = activePreview.type === "pen" ? currentPoints.length > 0 : Math.hypot(activePreview.end.x - activePreview.start.x, activePreview.end.y - activePreview.start.y) > 1;
      if (item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "triangle" || item.type === "flowchart" || item.type === "svgPath") {
        if (Math.abs(item.w) < 25) item.w = Math.sign(item.w || 1) * 25;
        if (Math.abs(item.h) < 25) item.h = Math.sign(item.h || 1) * 25;
      }
      if (isConnector(item)) {
        item.startBinding = nearestBinding(elements(), activePreview.start, 18 / canvasState().zoom, target => !isElementHidden(target) && !isElementLocked(target))?.binding;
        item.endBinding = nearestBinding(elements(), activePreview.end, 18 / canvasState().zoom, target => !isElementHidden(target) && !isElementLocked(target))?.binding;
        if (Math.hypot(item.w, item.h) < 25) {
          const finish = { x: item.x + item.w, y: item.y + item.h };
          const adjustedFinish = connectorEndpointMinimum(finish, { x: item.x, y: item.y }, item, "end");
          item.w = adjustedFinish.x - item.x; item.h = adjustedFinish.y - item.y;
          if (adjustedFinish !== finish) item.endBinding = undefined;
        }
        if (item.type === "arrow" && item.arrowRoute === "forked") {
          const fork = forkGeometry(item); const upper = nearestBinding(elements(), fork.upper, 18 / canvasState().zoom, target => !isElementHidden(target) && !isElementLocked(target)); const lower = nearestBinding(elements(), fork.lower, 18 / canvasState().zoom, target => !isElementHidden(target) && !isElementLocked(target));
          if (upper) item.forkUpper = { ...(item.forkUpper ?? {}), end: upper.point, endBinding: upper.binding };
          if (lower) item.forkLower = { ...(item.forkLower ?? {}), end: lower.point, endBinding: lower.binding };
        }
      }
      if (valid) {
        const newIndex = elements().length;
        // Appending a stroke preserves existing immutable elements. Reuse them
        // for undo instead of serializing every previous point on pen-up.
        pushUndo(item.type === "freehand" ? elements() : cloneElements(elements()));
        setElements((items) => [...items, item]); setDirty(true);
        if (isConnector(item)) { setSelectedIndices([newIndex]); setSidebarTab("properties"); }
      }
    }
    currentPoints = []; strokePointLimitReached = false; setPreview(undefined);
  }

  const tools: { value: Tool; label: string; key: string; path: string }[] = [
    { value: "select", label: "Select", key: "V", path: "M5 3l14 11-7 .8-3 6z" },
    { value: "pan", label: "Hand / Pan", key: "Space", path: "M8 11V5a1.5 1.5 0 0 1 3 0v5-6a1.5 1.5 0 0 1 3 0v6-5a1.5 1.5 0 0 1 3 0v7-3a1.5 1.5 0 0 1 3 0v5c0 5-3 8-8 8h-1c-3 0-5-2-6-4l-2-4a1.5 1.5 0 0 1 2.5-1.5L8 15" },
    { value: "pen", label: "Pen", key: "P", path: "M4 20l4.5-1 10.8-10.8a2.2 2.2 0 0 0-3.1-3.1L5.4 15.9 4 20zM14.8 6.3l3 3" },
    { value: "laser", label: "Laser pointer", key: "Y", path: "M5 19 17 7m-8 0 8 0 0 8M5 5l1 1M19 19l-1-1" },
    { value: "line", label: "Line", key: "L", path: "M4 20L20 4" },
    { value: "arrow", label: "Arrow", key: "A", path: "M4 20 20 4m-11 0h11v11" },
    { value: "rectangle", label: "Rectangle", key: "R", path: "M5 5h14v14H5z" },
    { value: "circle", label: "Circle", key: "C", path: "M19.5 12a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0z" },
    { value: "diamond", label: "Diamond", key: "D", path: "M12 3 21 12 12 21 3 12z" },
    { value: "triangle", label: "Triangle", key: "N", path: "M12 4 21 20H3z" },
    { value: "flowchart", label: "Flowchart shapes", key: "F", path: "M4 4h6v6H4zM14 4h6v6h-6zM9 14l4 0 3 3-3 3H9l-3-3z" },
    { value: "text", label: "Text", key: "T", path: "M5 6h14M12 6v13M8 19h8" },
    { value: "bucket", label: "Fill bucket", key: "B", path: "M4 14l6-6 8 8-6 6H4zM10 8l3-3 8 8-3 3M18 19h.01" },
    { value: "eraser", label: "Eraser", key: "E", path: "M3 14l9-10 9 9-8 8H7zM12 18l5-5" },
    { value: "crop", label: "Crop image", key: "X", path: "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 8h8v8H8z" },
  ];
  const shortcutIdByTool: Partial<Record<Tool, WindowsShortcutId>> = {
    select: "selectTool", pen: "penTool", laser: "laserTool", line: "lineTool", arrow: "arrowTool",
    rectangle: "rectangleTool", circle: "circleTool", diamond: "diamondTool", triangle: "triangleTool",
    flowchart: "flowchartTool", text: "textTool", bucket: "bucketTool", eraser: "eraserTool", crop: "cropTool",
  };
  const stencilCategories = [{ id: "All", label: "All" }, { id: "recent", label: "Recent" }, { id: "favorites", label: "Favorites" }, { id: "masters", label: "Document" }, { id: "custom", label: "My stencils" }, { id: "gui", label: "GUI Design" }, { id: "uml-er", label: "UML / ER" }, { id: "software", label: "Software" }, { id: "cloud", label: "Cloud" }, { id: "network", label: "Network" }, { id: "viz", label: "Data viz" }, { id: "bpmn", label: "BPMN" }, { id: "annotations", label: "Annotations" }];
  const stencilGroup = (section: string) => section.startsWith("UML") || section.startsWith("ER") ? "uml-er" : section.startsWith("Software") || section.startsWith("Architecture") ? "software" : section.startsWith("Cloud") ? "cloud" : section.startsWith("Network") ? "network" : section.startsWith("Data visualization") ? "viz" : section.startsWith("Forms") ? "gui" : section.startsWith("BPMN") ? "bpmn" : section.startsWith("Annotations") ? "annotations" : "other";
  const visibleStencilComponents = () => {
    const query = stencilSearch().trim().toLowerCase(); const category = stencilCategory();
    return LIBRARY_COMPONENTS.filter(item => (category === "All" || category !== "custom" && category !== "recent" && category !== "favorites" && stencilGroup(item.section) === category) && (!query || `${item.label} ${item.description} ${item.section}`.toLowerCase().includes(query)));
  };
  const visibleCustomStencils = () => {
    const query = stencilSearch().trim().toLowerCase();
    const category = stencilCategory(); const custom = customStencils();
    const available = category === "favorites" ? custom.filter(item => stencilFavorites().includes(item.id))
      : category === "recent" ? recentStencils().flatMap(id => { const item = custom.find(stencil => stencil.id === id); return item ? [item] : []; })
      : category === "All" || category === "custom" || category === "gui" ? custom : [];
    return available.filter(item => !query || `${item.name} ${item.tags.join(" ")} ${item.folder ?? ""} ${item.preview}`.toLowerCase().includes(query));
  };
  const visibleStencilSections = () => [...new Set(visibleStencilComponents().map(item => item.section))];
  const visibleComponentMasters = () => { const query = stencilSearch().trim().toLowerCase(); return (["All", "masters", "gui"].includes(stencilCategory())) ? activeComponentMasters().filter(master => !query || `${master.name} ${componentPrimaryLabel(master.template)}`.toLowerCase().includes(query)) : []; };
  const toolGroups: { id: string; label: string; tools: ToolbarItem[] }[] = readOnlyView() ? [
    { id: "laser", label: "Laser pointer", tools: ["laser"] },
  ] : isWindowsPlatform() ? [
    { id: "navigation", label: "Navigation", tools: ["select", "pan"] },
    { id: "drawing", label: "Drawing", tools: ["pen", "eraser"] },
    { id: "laser", label: "Laser", tools: ["laser"] },
    { id: "connectors", label: "Connectors", tools: ["line", "arrow"] },
    { id: "shapes", label: "Shapes", tools: ["rectangle", "circle", "diamond", "triangle", "flowchart"] },
    { id: "content", label: "Text and image tools", tools: ["text", "bucket", "crop"] },
    { id: "code-data", label: "Code and data", tools: ["codeData"] },
    { id: "precision", label: "Precision tools", tools: ["measure", "pathEdit", "frame"] },
  ] : [
    { id: "navigation", label: "Navigation", tools: ["select", "pan"] },
    { id: "drawing", label: "Drawing", tools: ["pen", "laser"] },
    { id: "connectors", label: "Connectors", tools: ["line", "arrow"] },
    { id: "shapes", label: "Shapes", tools: ["rectangle", "circle", "diamond", "triangle", "flowchart"] },
    { id: "content", label: "Text and image tools", tools: ["text", "bucket", "eraser", "crop"] },
    { id: "code-data", label: "Code and data", tools: ["codeData"] },
    { id: "precision", label: "Precision tools", tools: ["measure", "pathEdit", "frame"] },
  ];
  const organizerItems = (values: ToolbarItem[]) => values.map(value => ({ value, label: value === "moreTools" ? "More Tools menu" : tools.find(item => item.value === value)?.label ?? ({ measure: "Measure distance", pathEdit: "Edit selected path nodes", frame: "Create frame from selection", codeData: "Code & data" } as const)[value as "measure" | "pathEdit" | "frame" | "codeData"] ?? value, canTransfer: value !== "moreTools" }));
  const orderedToolbarEntries = (): OrderedToolbarEntry[] => {
    const entries: OrderedToolbarEntry[] = [];
    for (const value of toolbarOrder()) {
      if (value === "moreTools") {
        if (!readOnlyView()) entries.push({ kind: "more-tools" });
        continue;
      }
      const definition = toolGroups.find(group => group.tools.includes(value));
      if (!definition) continue;
      const previous = entries[entries.length - 1];
      if (previous?.kind === "cluster" && previous.id === definition.id) previous.tools.push(value);
      else entries.push({ kind: "cluster", ...definition, tools: [value] });
    }
    return entries;
  };
  const mobileShapeTools = new Set<Tool>(["rectangle", "circle", "diamond", "triangle"]);
  const mobileEssentialTools = new Set<ToolbarItem>(["select", "pan", "pen", "eraser", "laser", "line", "arrow", "rectangle", "text", "bucket"]);
  const commonFlowchartShapes = new Set<FlowchartShape>(["process", "terminator", "decision", "data", "document", "database", "predefined-process", "preparation", "manual-input", "connector", "off-page", "delay", "manual-operation", "stored-data", "cloud"]);
  const visibleFlowchartShapes = () => FLOWCHART_MENU_SHAPES.filter(shape => {
    const matchesCategory = flowchartPaletteCategory() === "All" || (flowchartPaletteCategory() === "Common" ? commonFlowchartShapes.has(shape.value) : !commonFlowchartShapes.has(shape.value));
    return matchesCategory && (!flowchartPaletteSearch().trim() || `${shape.label} ${shape.value}`.toLowerCase().includes(flowchartPaletteSearch().trim().toLowerCase()));
  });
  const swatches = ["#252525", "#e76b62", "#6b91c9", "#74a582", "#d8a448", "#a581bb", "#e5915b"];
  const helpShortcuts: [string, string][] = [["V", "Select tool"], ["Space", "Hold to pan"], ["P", "Fine pen"], ["Y", "Laser pointer"], ["R", "Rectangle"], ["C / O", "Circle"], ["D", "Diamond"], ["N", "Triangle"], ["L", "Line"], ["A", "Arrow"], ["F", "Flowchart symbol"], ["T", "Text"], ["B", "Fill bucket"], ["E", "Eraser"], ["X", "Image crop"], ["Esc", "Pan tool and clear selection"], ["G", "Toggle grid"], ["Shift+G", "Snap to grid"], ["Shift+O", "Snap to objects"], ["K", "Lock canvas"], ["0", "Center view at 100%"], ["1 / 2", "Fit drawing / selection"], ["Ctrl / Cmd + N", "New sketch"], ["Ctrl / Cmd + O", "Open sketch"], ["Ctrl / Cmd + S", "Save"], ["Ctrl / Cmd + Z", "Undo"], ["Ctrl / Cmd + Y", "Redo"], ["Ctrl / Cmd + C / X / V", "Copy / cut / paste"], ["Ctrl / Cmd + D", "Duplicate selection"], ["Ctrl / Cmd + A", "Select all"], ["Ctrl / Cmd + G", "Group selection"], ["Ctrl / Cmd + Shift + G", "Ungroup"], ["Delete / Backspace", "Delete selection"], ["Arrow keys", "Nudge by 1 px"], ["Shift+Arrow", "Nudge by 10 px"], ["F1", "Open Help"]];
  const updateTextDraft = (value: string) => setTextDraft((draft) => draft ? { ...draft, value } : undefined);
  function setSelectedNoteFontSize(size: number) {
    if (!Number.isFinite(size)) return;
    const bounded = Math.max(8, Math.min(32, Math.round(size)));
    if (noteEditor()) { rememberFontSize(bounded); setNoteEditor(draft => draft ? { ...draft, fontSize: bounded } : draft); return; }
    const index = primarySelection(); const previous = index === undefined ? undefined : elements()[index];
    if (previous?.type !== "group" || !previous.note || previous.locked || boardLocked()) return;
    rememberFontSize(bounded);
    const bounds = elementBounds(previous); const before = cloneElements(elements());
    const rebuilt = buildNoteGroup(bounds.x, bounds.y, previous.note.kind, previous.note.content, { width: previous.note.width ?? bounds.w, height: previous.note.height ?? bounds.h, fontSize: bounded, title: previous.note.title, collapsed: previous.note.collapsed });
    const replacement: Element = { ...rebuilt, ...previous, note: rebuilt.note, elements: rebuilt.elements.map((child, childIndex) => previous.elements[childIndex]?.id ? { ...child, id: previous.elements[childIndex].id } as Element : child) };
    setElements(items => items.map((item, current) => current === index ? replacement : item)); pushUndo(before); setDirty(true);
  }
  function updateSelectedNoteCard(patch: Partial<Pick<NonNullable<Extract<Element, { type: "group" }>['note']>, "title" | "content">>) {
    const index = primarySelection(); const previous = index === undefined ? undefined : elements()[index];
    if (previous?.type !== "group" || !previous.note || previous.locked || boardLocked()) return;
    const content = patch.content ?? previous.note.content;
    if (content.length > 50000 || normalizeNoteContent(content, previous.note.kind).length > 50000) { setError("Notes and checklists are limited to 50,000 characters."); return; }
    const bounds = elementBounds(previous); const before = cloneElements(elements());
    const rebuilt = buildNoteGroup(bounds.x, bounds.y, previous.note.kind, content, { width: previous.note.width ?? bounds.w, ...(patch.content === undefined ? { height: previous.note.height ?? bounds.h } : {}), fontSize: previous.note.fontSize, title: patch.title ?? previous.note.title, collapsed: previous.note.collapsed });
    const replacement: Element = { ...rebuilt, ...previous, note: rebuilt.note, elements: rebuilt.elements.map((child, childIndex) => previous.elements[childIndex]?.id ? { ...child, id: previous.elements[childIndex].id } as Element : child) };
    setElements(items => items.map((item, current) => current === index ? replacement : item)); pushUndo(before); setDirty(true);
  }
  function convertSelectedTextToMarkdown() {
    const index = primarySelection(); const previous = index === undefined ? undefined : elements()[index];
    if (index === undefined || previous?.type !== "text" || previous.locked || boardLocked()) return;
    const bounds = elementBounds(previous); const before = cloneElements(elements());
    const markdown = buildNoteGroup(previous.x, previous.y, "note", previous.text, { width: Math.max(260, Math.min(800, bounds.w + 32)), fontSize: Math.max(8, Math.min(32, previous.fontSize)), title: "Markdown" });
    const replacement: Element = { ...markdown, id: previous.id, rotation: previous.rotation, locked: previous.locked, hidden: previous.hidden };
    setElements(items => items.map((item, current) => current === index ? replacement : item)); pushUndo(before); setSelectedIndices([index]); setTool("select"); setDirty(true);
  }
  function convertSelectedMarkdownToText() {
    const index = primarySelection(); const previous = index === undefined ? undefined : elements()[index];
    if (index === undefined || previous?.type !== "group" || previous.note?.kind !== "note" || previous.locked || boardLocked()) return;
    const bounds = elementBounds(previous); const before = cloneElements(elements());
    const plain: TextElement = { type: "text", id: previous.id, x: bounds.x + 14, y: bounds.y + 58, text: previous.note.content, color: theme() === "dark" ? "#f4f4f2" : "#252525", fontSize: previous.note.fontSize ?? 12, fontFamily: "sans", textAlign: "left", listType: "none", rotation: previous.rotation, locked: previous.locked, hidden: previous.hidden };
    setElements(items => items.map((item, current) => current === index ? plain : item)); pushUndo(before); setSelectedIndices([index]); setTool("select"); setDirty(true);
  }
  const adjustQuickFont = (delta: number) => {
    if (noteEditor() || selectedNoteCard()) { setSelectedNoteFontSize(quickCardFontSize() + delta); return; }
    const focused = focusedElement();
    if (focused?.type === "schemaTable") { updateProperty("fontSize", Math.max(8, Math.min(48, (focused.fontSize ?? 12) + delta))); return; }
    if (focused?.componentId?.startsWith("uml-class:") && resizeClassCardFont(focused.componentId, quickCardFontSize() + delta)) return;
    setTextFormat("fontSize", Math.max(8, Math.min(160, (selectedText()?.fontSize ?? defaultFontSize()) + delta)));
  };
  const setTextFormat = (property: "bold" | "italic" | "underline" | "textAlign" | "listType" | "fontSize" | "fontFamily" | "color", value: boolean | string | number) => {
    if (boardLocked() || focusedElement()?.locked) return;
    if (property === "fontSize" && (!Number.isFinite(Number(value)) || Number(value) < 8 || Number(value) > 160)) return;
    if (property === "fontSize") value = Math.round(Number(value));
    if (property === "fontSize" && (noteEditor() || selectedNoteCard())) { setSelectedNoteFontSize(Number(value)); return; }
    if (property === "fontSize" && focusedElement()?.componentId?.startsWith("uml-class:")) { resizeClassCardFont(focusedElement()!.componentId!, Number(value)); return; }
    if (property === "fontSize" && focusedElement()?.type === "schemaTable") { const size = Math.max(8, Math.min(48, Number(value))); value = rememberFontSize(size); updateProperty("fontSize", size); return; }
    if (textDraft()) {
      if (property === "fontSize") value = rememberFontSize(Number(value));
      setTextDraft(draft => draft ? { ...draft, [property]: value } : draft);
      return;
    }
    if (property === "fontSize") value = rememberFontSize(Number(value));
    if (selectedText()) updateProperty(property === "color" ? "textColor" : property, value);
    else {
      if (property === "bold") setDefaultBold(Boolean(value)); else if (property === "italic") setDefaultItalic(Boolean(value)); else if (property === "underline") setDefaultUnderline(Boolean(value));
      else if (property === "textAlign") setDefaultTextAlign(value as "left" | "center" | "right"); else if (property === "listType") setDefaultListType(value as "none" | "bullet" | "number");
      else if (property === "fontSize") setDefaultFontSize(Number(value)); else if (property === "fontFamily") setDefaultFontFamily(value as FontFamily); else if (property === "color") setColor(String(value));
    }
    setTextDraft((draft) => draft ? { ...draft, [property]: value } : undefined);
  };
  const rotateSelection = (delta: number) => { if (boardLocked()) return; const index = primarySelection(); const item = index === undefined ? undefined : elements()[index]; if (!item || item.locked || item.type === "group" && !item.libraryComponent || isConnector(item)) return; const before = cloneElements(elements()); setElements((items) => items.map((element, i) => i === index ? { ...element, rotation: (element.rotation ?? 0) + delta } as Element : element)); pushUndo(before); setDirty(true); };
  const resetSelectionRotation = () => { const index = primarySelection(); const item = index === undefined ? undefined : elements()[index]; if (boardLocked() || !item || item.locked || item.type === "group" && !item.libraryComponent || (item.rotation ?? 0) === 0) return; const before = cloneElements(elements()); setElements((items) => items.map((element, i) => i === index ? { ...element, rotation: 0 } as Element : element)); pushUndo(before); setDirty(true); };
  const closeSystemMenu = (action: () => void) => { if (menu) menu.open = false; if (viewMenu) viewMenu.open = false; if (gestureMenu) gestureMenu.open = false; if (helpMenu) helpMenu.open = false; action(); };
  const toggleSidebar = () => {
    setQuickStylePopover(undefined);
    if (styleMenuMode() === "quick") { setStyleMenuMode("full"); }
    else setStyleMenuMode("quick");
  };
  const isCompactTouchLayout = () => window.matchMedia("(max-width: 900px), (max-width: 1600px) and (pointer: coarse)").matches;
  const placeTouchPopover = (anchor: HTMLElement | null, panel: HTMLElement | null) => {
    if (!anchor || !panel || !isCompactTouchLayout() || isWindowsPlatform()) return;
    const shell = document.querySelector<HTMLElement>(".app-shell:not(.platform-windows)");
    const anchorBounds = anchor.getBoundingClientRect();
    const visualViewport = window.visualViewport;
    const viewportWidth = visualViewport?.width ?? window.innerWidth;
    const viewportHeight = visualViewport?.height ?? window.innerHeight;
    const viewportLeft = visualViewport?.offsetLeft ?? 0;
    const viewportTop = visualViewport?.offsetTop ?? 0;
    const uiScale = Math.max(0.5, interfaceScale());
    const margin = 8;
    const gap = 6;
    panel.removeAttribute("data-positioned");
    panel.style.removeProperty("width");
    panel.style.removeProperty("max-width");
    panel.style.removeProperty("max-height");
    const panelBounds = panel.getBoundingClientRect();
    let panelWidth = Math.min(panelBounds.width || 300, viewportWidth - margin * 2);
    const horizontal = !!shell?.classList.contains("mobile-toolbar-horizontal");
    let left = anchorBounds.left;
    let top = anchorBounds.bottom + gap;

    if (horizontal) {
      const availableBelow = viewportTop + viewportHeight - anchorBounds.bottom - gap - margin;
      const availableAbove = anchorBounds.top - viewportTop - gap - margin;
      const opensBelow = availableBelow >= availableAbove;
      const availableHeight = Math.max(80, Math.min(viewportHeight - margin * 2, opensBelow ? availableBelow : availableAbove));
      panel.style.setProperty("max-width", `${(viewportWidth - margin * 2) / uiScale}px`);
      panel.style.setProperty("max-height", `${availableHeight / uiScale}px`);
      const measuredHeight = Math.min(panel.getBoundingClientRect().height || 280, availableHeight);
      left = Math.max(viewportLeft + margin, Math.min(anchorBounds.left, viewportLeft + viewportWidth - panelWidth - margin));
      top = opensBelow
        ? anchorBounds.bottom + gap
        : anchorBounds.top - measuredHeight - gap;
    } else {
      panel.style.setProperty("max-height", `${(viewportHeight - margin * 2) / uiScale}px`);
      const availableRight = viewportLeft + viewportWidth - anchorBounds.right - gap - margin;
      const availableLeft = anchorBounds.left - viewportLeft - gap - margin;
      const opensRight = availableRight >= availableLeft;
      panelWidth = Math.min(panelWidth, Math.max(160, opensRight ? availableRight : availableLeft));
      panel.style.setProperty("width", `${panelWidth / uiScale}px`);
      panel.style.setProperty("max-width", `${panelWidth / uiScale}px`);
      panel.style.setProperty("max-height", `${(viewportHeight - margin * 2) / uiScale}px`);
      left = opensRight
        ? anchorBounds.right + gap
        : anchorBounds.left - panelWidth - gap;
      if (left + panelWidth > viewportLeft + viewportWidth - margin) left = anchorBounds.left - panelWidth - gap;
      if (left < viewportLeft + margin) left = anchorBounds.right + gap;
      left = Math.max(viewportLeft + margin, Math.min(left, viewportLeft + viewportWidth - panelWidth - margin));
      top = anchorBounds.top;
    }

    const measuredHeight = Math.min(panel.getBoundingClientRect().height || 280, viewportHeight - margin * 2);
    top = Math.max(viewportTop + margin, Math.min(top, viewportTop + viewportHeight - measuredHeight - margin));
    panel.style.setProperty("position", "fixed");
    panel.style.setProperty("z-index", "2000");
    panel.style.setProperty("left", `${left / uiScale}px`);
    panel.style.setProperty("right", "auto");
    panel.style.setProperty("top", `${top / uiScale}px`);
    panel.style.setProperty("bottom", "auto");
    panel.style.setProperty("transform", "none");
    panel.setAttribute("data-positioned", "true");
  };
  const scheduleTouchPopoverPlacement = () => {
    if (!isCompactTouchLayout() || isWindowsPlatform()) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const tool = openToolOptions();
      if (tool) {
        const families = [...document.querySelectorAll<HTMLElement>("[data-touch-popover]")].filter(item => item.dataset.touchPopover === tool && item.getClientRects().length > 0);
        const family = families[0];
        placeTouchPopover(family?.querySelector<HTMLElement>(".tool-icon-button") ?? null, family?.querySelector<HTMLElement>(".tool-options") ?? null);
      }
      if (stencilMenuOpen()) {
        const family = document.querySelector<HTMLElement>(".stencil-family");
        const anchor = family?.querySelector<HTMLElement>(".tool-icon-button");
        const panel = family?.querySelector<HTMLElement>(".stencil-options");
        placeTouchPopover(anchor ?? null, panel ?? null);
      }
      if (moreToolsOpen()) {
        const family = document.querySelector<HTMLElement>(".more-tools-family");
        placeTouchPopover(family?.querySelector<HTMLElement>(".tool-icon-button") ?? null, family?.querySelector<HTMLElement>(".more-tools-options") ?? null);
      }
    if (canvasOptionsOpen()) {
        const family = document.querySelector<HTMLElement>(".canvas-options-family");
        placeTouchPopover(family?.querySelector<HTMLElement>(".canvas-options-trigger") ?? null, family?.querySelector<HTMLElement>(".workspace-view-panel") ?? null);
      }
    }));
  };
  const closeTouchMenuBar = () => {
    if (!isCompactTouchLayout() || isWindowsPlatform()) return;
    window.dispatchEvent(new Event("sketchdraw:close-touch-menu"));
    document.querySelectorAll<HTMLDetailsElement>(".app-menus details[open], .touch-page-control[open]").forEach(details => { details.open = false; });
    setQuickStylePopover(undefined);
    setTouchStylePanel(false);
    setMoreToolsOpen(false);
  };
  const showToolOptions = (value: Tool) => { if (isCompactTouchLayout() && !isWindowsPlatform()) { closeTouchMenuBar(); setCanvasOptionsOpen(false); setStencilMenuOpen(false); } setMoreToolsOpen(false); setOpenToolOptions(value); scheduleTouchPopoverPlacement(); };
  const closeToolOptions = () => setOpenToolOptions(undefined);

  createEffect(() => {
      const hasOpenPopover = !!openToolOptions() || stencilMenuOpen() || canvasOptionsOpen() || moreToolsOpen();
    mobileOrientation(); toolbarPosition(); interfaceScale();
    if (hasOpenPopover) scheduleTouchPopoverPlacement();
    requestAnimationFrame(() => {
      document.querySelectorAll<HTMLDetailsElement>(".app-menus details[open], .touch-page-control[open]").forEach(alignTouchMenuPopover);
    });
  });
  onMount(() => {
    const reposition = () => {
      scheduleTouchPopoverPlacement();
      document.querySelectorAll<HTMLDetailsElement>(".app-menus details[open], .touch-page-control[open]").forEach(alignTouchMenuPopover);
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("orientationchange", reposition);
    window.visualViewport?.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("scroll", reposition);
    onCleanup(() => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("orientationchange", reposition);
      window.visualViewport?.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("scroll", reposition);
    });
  });

  const alignTouchMenuPopover = (details?: HTMLDetailsElement) => {
    if (!details || !details.open) return;
    const shouldCoordinateTouch = isCompactTouchLayout() && !isWindowsPlatform();
    requestAnimationFrame(() => {
      if (!details.isConnected || !details.open) return;
      if (shouldCoordinateTouch) window.dispatchEvent(new Event("sketchdraw:close-touch-menu"));
      const anchor = details.querySelector<HTMLElement>("summary");
      const panel = details.querySelector<HTMLElement>(".system-menu-popover, .touch-pages-popover");
      if (!anchor || !panel) return;
      if (shouldCoordinateTouch) {
        document.querySelectorAll<HTMLDetailsElement>(".app-menus details[open], .touch-page-control[open]").forEach(openMenu => {
          if (openMenu !== details) openMenu.open = false;
        });
        setOpenToolOptions(undefined);

        setStencilMenuOpen(false);
        setCanvasOptionsOpen(false);
        setQuickStylePopover(undefined);
        setTouchStylePanel(false);
      }
      const visualViewport = window.visualViewport;
      const viewportLeft = visualViewport?.offsetLeft ?? 0;
      const viewportTop = visualViewport?.offsetTop ?? 0;
      const viewportWidth = visualViewport?.width ?? window.innerWidth;
      const viewportHeight = visualViewport?.height ?? window.innerHeight;
      const anchorRect = anchor.getBoundingClientRect();
      const uiScale = Math.max(0.5, interfaceScale());
      const edge = 8;
      const maxWidth = Math.max(0, viewportWidth - edge * 2);
      panel.style.setProperty("position", "fixed");
      panel.style.setProperty("z-index", "1800");
      panel.style.setProperty("box-sizing", "border-box");
      panel.style.setProperty("right", "auto");
      panel.style.setProperty("bottom", "auto");
      const preferredWidth = panel.classList.contains("touch-pages-popover") ? 300
        : panel.classList.contains("more-tools-options") ? 236
        : panel.classList.contains("view-settings-popover") ? 560
        : panel.classList.contains("gesture-settings-popover") ? 560
        : panel.classList.contains("app-settings-popover") ? 440
        : 300;
      const preferredHeight = panel.classList.contains("app-settings-popover") ? 560 : panel.classList.contains("touch-pages-popover") ? 620 : 720;
      panel.style.setProperty("width", `${Math.min(preferredWidth, maxWidth) / uiScale}px`);
      panel.style.setProperty("max-width", `${maxWidth / uiScale}px`);
      panel.style.setProperty("max-height", `${Math.min(preferredHeight, Math.max(0, viewportHeight - edge * 2)) / uiScale}px`);
      panel.style.setProperty("overflow-y", "auto");
      panel.style.setProperty("margin", "0");
      panel.style.setProperty("transform", "none");
      const panelWidth = Math.min(panel.getBoundingClientRect().width || Math.min(preferredWidth, maxWidth), maxWidth);
      const naturalHeight = Math.min(panel.getBoundingClientRect().height || preferredHeight, preferredHeight, viewportHeight - edge * 2);
      const availableBelow = Math.max(0, viewportTop + viewportHeight - anchorRect.bottom - 6 - edge);
      const availableAbove = Math.max(0, anchorRect.top - viewportTop - 6 - edge);
      const opensBelow = availableBelow >= naturalHeight || availableBelow >= availableAbove;
      const availableHeight = Math.max(80, Math.min(viewportHeight - edge * 2, opensBelow ? availableBelow : availableAbove));
      panel.style.setProperty("max-height", `${availableHeight / uiScale}px`);
      const panelHeight = Math.min(panel.getBoundingClientRect().height || availableHeight, availableHeight);
      const maxTop = Math.max(viewportTop + edge, viewportTop + viewportHeight - panelHeight - edge);
      const top = Math.max(viewportTop + edge, Math.min(opensBelow ? anchorRect.bottom + 6 : anchorRect.top - panelHeight - 6, maxTop));
      const inset = viewportLeft + edge;
      const maxLeft = Math.max(inset, viewportLeft + viewportWidth - panelWidth - edge);
      const left = Math.max(inset, Math.min(anchorRect.left, maxLeft));
      panel.style.setProperty("left", `${left / uiScale}px`);
      panel.style.setProperty("top", `${top / uiScale}px`);
    });
  };
  const alignViewSettingsPopover = () => {
    requestAnimationFrame(() => {
      const panel = viewMenu?.querySelector<HTMLElement>(".view-settings-popover");
      if (!panel || !viewMenu?.open) return;
      alignTouchMenuPopover(viewMenu);
    });
  };
  const toggleWindowsFullscreen = async (enabled = !windowsFullscreenMode()) => {
    if (!isWindowsPlatform() || !activePath() || enabled === windowsFullscreenMode()) return;
    if (enabled) {
      if (presentationMode()) await togglePresentationMode(false);
      commitTextDraft(); closeToolOptions(); setCanvasOptionsOpen(false); setLayerPanelOpen(false); setQuickStylePopover(undefined); setTouchStylePanel(false);
       setStencilMenuOpen(false); setCommandPaletteOpen(false); setShortcutDialogOpen(false);
      document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(detail => detail.open = false);
      setWindowsFullscreenMode(true);
      if (isTauri()) {
        try {
          const appWindow = getCurrentWindow();
          windowsFocusWasFullscreen = await appWindow.isFullscreen();
          if (!windowsFocusWasFullscreen) await appWindow.setFullscreen(true);
          return;
        } catch { windowsFocusWasFullscreen = false; }
      }
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        try { await document.documentElement.requestFullscreen(); windowsFocusUsedDocumentFullscreen = true; }
        catch { windowsFocusUsedDocumentFullscreen = false; }
      }
      return;
    }
    setWindowsFullscreenMode(false);
    if (windowsFocusUsedDocumentFullscreen && document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch { /* The canvas focus view still exits. */ }
    } else if (isTauri() && !windowsFocusWasFullscreen) {
      try { await getCurrentWindow().setFullscreen(false); } catch { /* The canvas focus view still exits. */ }
    }
    windowsFocusWasFullscreen = false; windowsFocusUsedDocumentFullscreen = false;
  };
  const toggleTouchFocusMode = async (enabled = !touchFocusMode()) => {
    if (!isCompactTouchLayout() || isWindowsPlatform()) return;
    if (enabled === touchFocusMode()) return;
    if (enabled) {
      commitTextDraft();
      closeToolOptions();
      setCanvasOptionsOpen(false);

      setStencilMenuOpen(false);
      setLayerPanelOpen(false);
      setQuickStylePopover(undefined);
      setTouchStylePanel(false);
      document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(detail => detail.open = false);
      setTouchFocusMode(true);
      if (isTauri()) {
        try {
          const appWindow = getCurrentWindow();
          focusModeWasFullscreen = await appWindow.isFullscreen();
          if (!focusModeWasFullscreen) await appWindow.setFullscreen(true);
          return;
        } catch {
          focusModeWasFullscreen = undefined;
        }
      }
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        try { await document.documentElement.requestFullscreen(); focusModeUsedDocumentFullscreen = true; }
        catch { focusModeUsedDocumentFullscreen = false; }
      }
      return;
    }
    setTouchFocusMode(false);
    if (isTauri() && focusModeWasFullscreen === false) {
      try { await getCurrentWindow().setFullscreen(false); } catch { /* The focus layout still exits if native fullscreen is unavailable. */ }
    } else if (focusModeUsedDocumentFullscreen && document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch { /* The focus layout still exits if browser fullscreen is unavailable. */ }
    }
    focusModeWasFullscreen = undefined;
    focusModeUsedDocumentFullscreen = false;
  };
  const chooseFocusTool = (value: "pen" | "laser" | "eraser") => {
    if (readOnlyView()) { setTool("laser"); return; }
    setQuickStylePopover(undefined);
    closeToolOptions();
    if (value === "pen") setBrushMode("fine");
    setTool(value);
  };
  const activateTool = (next: Tool) => { if (readOnlyView()) { setTool("laser"); return; } commitTextDraft(); setQuickStylePopover(undefined); setTouchStylePanel(false); closeToolOptions(); if (next === "text") setTextMode("text"); const switchFromBrush = next === "pen" && tool() === "pen" && brushMode() !== "fine"; const chosen = switchFromBrush ? "pen" : tool() === next ? (isWindowsPlatform() ? "pan" : "select") : next; if (next === "pen" && chosen === "pen") setBrushMode("fine"); setTool(chosen); if (chosen === "select") setStyleMenuMode("quick"); if (chosen !== "select" && chosen !== "pan") { setSelectedIndices([]); setSidebarTab("properties"); } };
  const toggleTouchStylePanel = () => setTouchStylePanel(open => !open);
  const toggleQuickProperties = () => {
    if (isWindowsPlatform() || !isCompactTouchLayout()) { toggleSidebar(); return; }
    if (styleMenuMode() === "full") { setStyleMenuMode("quick"); setMobileQuickPropertiesOpen(false); }
    else setMobileQuickPropertiesOpen(value => !value);
  };
  const toggleDesignPanel = () => setDesignPanelCollapsed(value => !value);
  const openAdvancedProperties = () => { setMobileQuickPropertiesOpen(true); setStyleMenuMode("full"); };
  const penBrushChoices: { value: BrushMode; label: string; path: string }[] = [
    { value: "fine", label: "Pen", path: "m5 19 13-14M4 21h16" },
    { value: "pencil", label: "Pencil", path: "m5 19 11-11 3 3L8 22H5zm10-13 2-2 4 4-2 2" },
    { value: "brush", label: "Soft brush", path: "M5 18c4 0 3-8 8-8 4 0 4 4 7 4m-15 4h14M15 5l3 3" },
    { value: "marker", label: "Marker", path: "M5 18 17 6l3 3L8 21H5zm9-9 3 3" },
    { value: "highlighter", label: "Highlighter", path: "M4 16 15 5l5 5-11 11H4zm4-2 5 5" },
    { value: "chalk", label: "Chalk", path: "M5 18 17 6m-8 12 2 2M4 21h16" },
  ];
  const openCodeDataTool = () => { setCodeDataOpen(true); setMoreToolsOpen(false); setCanvasOptionsOpen(false); closeToolOptions(); setStencilMenuOpen(false); };
  const renderToolbarTool = (definition: typeof tools[number]) => {
    const { value, label, key } = definition;
    const mobileShapeFamily = !isWindowsPlatform() && isCompactTouchLayout() && value === "rectangle";
    const windowsShapeFamily = isWindowsPlatform() && value === "flowchart";
    const path = definition.path;
    const active = (value === "pen" ? tool() === "pen" && brushMode() === "fine" : mobileShapeFamily ? mobileShapeTools.has(tool()) : windowsShapeFamily ? mobileShapeTools.has(tool()) || tool() === "flowchart" : tool() === value) || (value === "pan" && spaceDown());
    const hasOptions = mobileShapeFamily || value === "flowchart" || value === "line" || value === "arrow" || value === "text";
    const displayLabel = mobileShapeFamily ? "Basic shapes" : isWindowsPlatform() && value === "flowchart" ? "Shapes" : label;
    const mobileEssential = mobileEssentialTools.has(value);
    const shortcutId = shortcutIdByTool[value];
    const bindings = shortcutId ? shortcuts()[shortcutId] : undefined;
    const displayedKey = displayShortcut(bindings?.find(Boolean) ?? key);
    const shortcutLabel = bindings ? formatShortcutBindings(bindings) || key : key;
    if (value === "pen") {
      const selectedBrush = penBrushChoices.find(item => item.value === brushMode()) ?? penBrushChoices[0];
      const menuOpen = openToolOptions() === "pen";
      const choosePen = () => {
        commitTextDraft(); setQuickStylePopover(undefined); setTouchStylePanel(false);
        if (tool() !== "pen") { setTool("pen"); setSelectedIndices([]); setSidebarTab("properties"); }
      };
      return <div class="tool-family pen-family" data-touch-popover="pen" classList={{ "options-open": menuOpen, "mobile-tool-essential-family": mobileEssential, "mobile-tool-current-family": tool() === "pen" }} onPointerEnter={event => { if (event.pointerType === "mouse" && !isCompactTouchLayout()) showToolOptions("pen"); }} onPointerLeave={event => { if (event.pointerType === "mouse" && !isCompactTouchLayout()) closeToolOptions(); }} onFocusOut={event => { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) closeToolOptions(); }}>
        <button type="button" class={`tool-icon-button pen-tool-button has-options ${tool() === "pen" ? "selected mobile-tool-current" : ""} ${mobileEssential ? "mobile-tool-essential" : ""}`} title={`${selectedBrush.label} (${shortcutLabel})`} aria-label={`Pen tool, ${selectedBrush.label} selected`} aria-pressed={tool() === "pen"} aria-haspopup="menu" aria-expanded={menuOpen} onFocus={() => { if (!isCompactTouchLayout()) showToolOptions("pen"); }} onClick={() => { choosePen(); if (isCompactTouchLayout() && openToolOptions() === "pen") closeToolOptions(); else showToolOptions("pen"); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={selectedBrush.path} /></svg><kbd>{displayedKey}</kbd><svg class="tool-family-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3" /></svg></button>
        <div class="tool-options pen-options" role="menu" aria-label="Pen and brush tools">{penBrushChoices.map(brush => <button type="button" class={brushMode() === brush.value ? "active" : ""} role="menuitemradio" aria-checked={brushMode() === brush.value} title={brush.label} onClick={() => { setBrushMode(brush.value); setTool("pen"); setSelectedIndices([]); closeToolOptions(); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={brush.path} /></svg><span>{brush.label}</span></button>)}</div>
      </div>;
    }
    const button = <button class={`tool-icon-button ${active ? "selected" : ""} ${mobileEssential ? "mobile-tool-essential" : ""} ${tool() === value || mobileShapeFamily && mobileShapeTools.has(tool()) ? "mobile-tool-current" : ""} ${hasOptions ? "has-options" : ""}`} title={`${displayLabel} (${shortcutLabel})`} aria-label={mobileShapeFamily ? `Shapes: ${displayLabel}` : displayLabel} aria-haspopup={hasOptions ? "menu" : undefined} aria-pressed={active} aria-expanded={hasOptions ? openToolOptions() === value : undefined} onFocus={() => { if (hasOptions && !isCompactTouchLayout()) showToolOptions(value); }} onClick={() => { if (mobileShapeFamily) { commitTextDraft(); setQuickStylePopover(undefined); if (openToolOptions() === value) closeToolOptions(); else showToolOptions(value); return; } if (hasOptions) { if (!isWindowsPlatform() && isCompactTouchLayout()) { if (tool() !== value) activateTool(value); else { commitTextDraft(); setQuickStylePopover(undefined); } if (openToolOptions() === value) closeToolOptions(); else showToolOptions(value); return; } if (!isWindowsPlatform() && tool() === value) { activateTool(value); closeToolOptions(); return; } if (tool() !== value) activateTool(value); else { commitTextDraft(); setQuickStylePopover(undefined); } if (isCompactTouchLayout() && openToolOptions() === value) closeToolOptions(); else showToolOptions(value); return; } closeToolOptions(); activateTool(value); }}><svg viewBox="0 0 24 24" aria-hidden="true">{mobileShapeFamily || windowsShapeFamily ? <><rect x="3.25" y="3.25" width="7.5" height="7.5" rx="1.2"/><circle cx="17" cy="7" r="3.75"/><path d="m7 13.25 4.25 4.25L7 21.75l-4.25-4.25zM17 13.5l4.5 7.5h-9z"/></> : value === "flowchart" ? <><path d="M12 6.5v3M6 10h12M6 10v3m12-3v3"/><rect x="9" y="2.5" width="6" height="4" rx="1"/><rect x="3.5" y="13" width="5" height="6" rx="1"/><rect x="15.5" y="13" width="5" height="6" rx="1"/></> : <path d={path} />}</svg><kbd>{displayedKey}</kbd>{hasOptions && <svg class="tool-family-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3"/></svg>}</button>;
    if (mobileShapeFamily) return <div class="tool-family shape-family" data-touch-popover={value} classList={{ "options-open": openToolOptions() === value, "mobile-tool-essential-family": true, "mobile-tool-current-family": mobileShapeTools.has(tool()) }} onFocusOut={(event) => { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) closeToolOptions(); }}>{button}<div class="tool-options shape-options" role="menu" aria-label="Basic shapes">{tools.filter(item => mobileShapeTools.has(item.value)).map(shape => <button class={tool() === shape.value ? "active" : ""} role="menuitemradio" aria-checked={tool() === shape.value} title={shape.label} aria-label={shape.label} onClick={() => { closeToolOptions(); setTool(shape.value); setSidebarTab("properties"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d={shape.path} /></svg><span>{shape.label}</span></button>)}<button type="button" class="palette-spawn-all" role="menuitem" disabled={!activePath() || readOnlyView() || boardLocked() || shapeCatalogBusy()} onClick={spawnAllShapes}>{shapeCatalogBusy() ? "Preparing shape catalog…" : `Spawn all ${4 + FLOWCHART_SHAPES.length} shapes`}</button></div></div>;
    if (value === "flowchart") return <div class="tool-family flowchart-family" data-touch-popover={value} classList={{ "options-open": openToolOptions() === value, "mobile-tool-essential-family": mobileEssential, "mobile-tool-current-family": tool() === value }} onPointerEnter={event => { if (event.pointerType === "mouse" && !isCompactTouchLayout()) showToolOptions(value); }} onPointerLeave={event => { if (event.pointerType === "mouse" && !isCompactTouchLayout()) closeToolOptions(); }} onFocusOut={(event) => { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) closeToolOptions(); }}>{button}{isWindowsPlatform()
      ? <WindowsShapePalette activeTool={tool()} activeFlowchartShape={flowchartShape()} onSpawnAll={spawnAllShapes} spawnAllDisabled={!activePath() || readOnlyView() || boardLocked() || shapeCatalogBusy()} spawnAllLabel={shapeCatalogBusy() ? "Preparing shape catalog…" : `Spawn all ${4 + FLOWCHART_SHAPES.length} shapes`} onSelect={(choice: WindowsShapeChoice) => { closeToolOptions(); if (choice.kind === "flowchart") { setFlowchartShape(choice.shape); setTool("flowchart"); } else setTool(choice.tool); setSidebarTab("properties"); setSelectedIndices([]); }} />
      : <div class="tool-options flowchart-options" role="dialog" aria-label="Flowchart symbols">
        <header class="flowchart-palette-heading"><div><strong>Flowchart shapes</strong><small>{visibleFlowchartShapes().length} symbols</small></div><button type="button" aria-label="Close shape panel" onClick={closeToolOptions}>×</button></header>
        <label class="flowchart-palette-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg><input type="search" aria-label="Search flowchart shapes" placeholder="Search shapes" value={flowchartPaletteSearch()} onInput={event => setFlowchartPaletteSearch(event.currentTarget.value)} /></label>
        <div class="flowchart-palette-tabs" role="group" aria-label="Shape categories">{(["Common", "Other", "All"] as const).map(category => <button type="button" class={flowchartPaletteCategory() === category ? "active" : ""} aria-pressed={flowchartPaletteCategory() === category} onClick={() => setFlowchartPaletteCategory(category)}>{category}</button>)}</div>
        <div class="flowchart-shape-grid" role="group" aria-label="Flowchart shapes">{visibleFlowchartShapes().map(shape => <button type="button" class={flowchartShape() === shape.value ? "active" : ""} aria-pressed={flowchartShape() === shape.value} title={shape.label} onClick={() => { closeToolOptions(); setFlowchartShape(shape.value); setTool("flowchart"); setSidebarTab("properties"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={shape.path} /></svg><span>{shape.label}</span></button>)}<Show when={!visibleFlowchartShapes().length}><p class="flowchart-palette-empty">No shapes found.</p></Show></div>
        <button type="button" class="palette-spawn-all flowchart-spawn-all" disabled={!activePath() || readOnlyView() || boardLocked() || shapeCatalogBusy()} onClick={spawnAllShapes}>{shapeCatalogBusy() ? "Preparing shape catalog…" : `Add all ${4 + FLOWCHART_SHAPES.length} shapes to canvas`}</button>
      </div>}</div>;
    if (value === "text") return <div class="tool-family text-family" data-touch-popover={value} classList={{ "options-open": openToolOptions() === value, "mobile-tool-essential-family": mobileEssential, "mobile-tool-current-family": tool() === value }} onPointerEnter={event => { if (event.pointerType === "mouse" && !isCompactTouchLayout()) showToolOptions(value); }} onPointerLeave={event => { if (event.pointerType === "mouse" && !isCompactTouchLayout()) closeToolOptions(); }} onFocusOut={(event) => { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) closeToolOptions(); }}>{button}<div class="tool-options text-options" role="menu" aria-label="Text and note tools">
      <button role="menuitem" title="Place plain text" onClick={() => { closeToolOptions(); setTextMode("text"); setTool("text"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d="M4 6h16M12 6v13m-4 0h8"/></svg><span>Text</span></button>
      <button role="menuitem" title="Write an editable, collapsible Markdown card" onClick={() => { closeToolOptions(); setTextMode("markdown"); setTool("text"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d="M3 6h18M5 11h4l3 4 3-4h4M5 19h14"/><path d="m18 2 3 3-3 3"/></svg><span>Markdown text</span></button>
      <button role="menuitem" title="Insert an editable Markdown table card" onClick={() => { closeToolOptions(); setTextMode("table"); setTool("text"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M3 15h18M10 4v16M16 4v16"/></svg><span>Table</span></button>
      <button role="menuitem" title="Add a note; supports fenced, syntax-highlighted code blocks" onClick={() => { closeToolOptions(); setTextMode("note"); setTool("text"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d="M5 4h14v13l-4 3H5zM8 9h8M8 13h6"/></svg><span>Note + code</span></button>
      <button role="menuitem" title="Add a sticky note" onClick={() => { closeToolOptions(); setTextMode("sticky"); setTool("text"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d="M5 4h14v12l-5 5H5zM14 16v5m-6-12h8m-8 4h6"/></svg><span>Sticky note</span></button>
      <button role="menuitem" title="Add an interactive checklist" onClick={() => { closeToolOptions(); setTextMode("checklist"); setTool("text"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d="m4 6 2 2 3-4M12 6h8M4 14l2 2 3-4m3 2h8"/></svg><span>Checklist</span></button>
    </div></div>;
    if (value === "line") return <div class="tool-family route-family" data-touch-popover={value} classList={{ "options-open": openToolOptions() === value, "mobile-tool-essential-family": mobileEssential, "mobile-tool-current-family": tool() === value }} onPointerEnter={event => { if (event.pointerType === "mouse" && !isCompactTouchLayout()) showToolOptions(value); }} onPointerLeave={event => { if (event.pointerType === "mouse" && !isCompactTouchLayout()) closeToolOptions(); }} onFocusOut={(event) => { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) closeToolOptions(); }}>{button}<div class="tool-options route-options" role="menu" aria-label="Line routes">{LINE_ROUTES.map((route) => <button disabled={orthogonalConnectors() && route.value !== "elbow"} class={lineRoute() === route.value ? "active" : ""} role="menuitem" title={orthogonalConnectors() ? "Orthogonal-only policy is active" : route.label} aria-label={route.label} onClick={() => { if (orthogonalConnectors()) return; closeToolOptions(); setLineRoute(route.value); setTool("line"); setSidebarTab("properties"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d={route.path} /></svg><span>{route.label}</span></button>)}</div></div>;
    if (value === "arrow") return <div class="tool-family route-family" data-touch-popover={value} classList={{ "options-open": openToolOptions() === value, "mobile-tool-essential-family": mobileEssential, "mobile-tool-current-family": tool() === value }} onPointerEnter={event => { if (event.pointerType === "mouse" && !isCompactTouchLayout()) showToolOptions(value); }} onPointerLeave={event => { if (event.pointerType === "mouse" && !isCompactTouchLayout()) closeToolOptions(); }} onFocusOut={(event) => { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) closeToolOptions(); }}>{button}<div class="tool-options route-options" role="menu" aria-label="Arrow routes">{ARROW_ROUTES.map((route) => <button disabled={orthogonalConnectors() && route.value !== "elbow"} class={arrowRoute() === route.value ? "active" : ""} role="menuitem" title={orthogonalConnectors() ? "Orthogonal-only policy is active" : route.label} aria-label={route.label} onClick={() => { if (orthogonalConnectors()) return; closeToolOptions(); setArrowRoute(route.value); setTool("arrow"); setSidebarTab("properties"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d={route.path} /></svg><span>{route.label}</span></button>)}</div></div>;
    return button;
  };
  const renderToolbarItem = (value: ToolbarItem) => {
    if (value === "codeData") return <button type="button" class="tool-icon-button code-data-tool" aria-label="Code and data tools" title="Code & data" onClick={openCodeDataTool}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="8" height="7" rx="1"/><rect x="13" y="4" width="8" height="7" rx="1"/><rect x="3" y="13" width="8" height="7" rx="1"/><rect x="13" y="13" width="8" height="7" rx="1"/><path d="M5 8h4m6-1h4m-4 3h4M5 16h4m6 0h4"/></svg></button>;
    if (value === "measure") return <button type="button" class={`tool-icon-button ${measureMode() ? "selected" : ""}`} aria-label={measureMode() ? "Exit measure tool" : "Measure distance"} aria-pressed={measureMode()} title="Measure distance (M)" onClick={toggleMeasureMode}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19 19 4l2 2L6 21H4zM8 15l2 2m1-5 2 2m1-5 2 2" /></svg></button>;
    if (value === "pathEdit") {
      const target = focusedElement(); const canEdit = target?.type === "freehand" || target?.type === "svgPath" && !!parseEditablePath(target.pathData);
      return <button type="button" class={`tool-icon-button ${pathNodeEditMode() ? "selected" : ""}`} disabled={!canEdit || boardLocked() || readOnlyView()} aria-label={pathNodeEditMode() ? "Finish path editing" : "Edit selected path nodes"} aria-pressed={pathNodeEditMode()} title="Edit selected path nodes" onClick={() => { setPathNodeEditMode(mode => !mode); setSelectedPathNodeIndex(undefined); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5v14h14M5 5l14 14M5 12h7m0-7v7" /><circle cx="5" cy="5" r="1.7" /><circle cx="19" cy="19" r="1.7" /><circle cx="12" cy="12" r="1.7" /></svg></button>;
    }
    if (value === "frame") return <button type="button" class="tool-icon-button" disabled={!selectedIndices().length || boardLocked() || readOnlyView()} aria-label="Create frame from selection" title="Create frame from selection" onClick={createFrameFromSelection}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1" /><path d="M7 8h10v8H7z" /></svg></button>;
    const definition = tools.find(item => item.value === value);
    return definition ? renderToolbarTool(definition) : null;
  };
  const moreToolPath = (value: ToolbarItem) => value === "measure"
    ? "M4 19 19 4l2 2L6 21H4zM8 15l2 2m1-5 2 2m1-5 2 2"
    : value === "codeData" ? "M3 4h8v7H3zM13 4h8v7h-8zM3 13h8v7H3zM13 13h8v7h-8z"
    : value === "pathEdit" ? "M5 5v14h14M5 5l14 14M5 12h7m0-7v7"
    : value === "frame" ? "M3 4h18v16H3zM7 8h10v8H7z"
    : tools.find(item => item.value === value)?.path ?? "M4 4h16v16H4z";
  const runMoreTool = (value: ToolbarItem) => {
    setMoreToolsOpen(false);
    if (value === "moreTools") return;
    if (value === "codeData") { openCodeDataTool(); return; }
    if (value === "measure") { toggleMeasureMode(); return; }
    if (value === "pathEdit") { setPathNodeEditMode(mode => !mode); setSelectedPathNodeIndex(undefined); return; }
    if (value === "frame") { createFrameFromSelection(); return; }
    activateTool(value);
  };
  const renderMoreToolChoice = (value: ToolbarItem) => {
    const item = organizerItems([value])[0];
    const definition = tools.find(toolDefinition => toolDefinition.value === value);
    const active = value === "measure" ? measureMode() : value === "pathEdit" ? pathNodeEditMode() : value === "frame" ? false : tool() === value;
    const selected = focusedElement();
    const canEditPath = selected?.type === "freehand" || selected?.type === "svgPath" && !!parseEditablePath(selected.pathData);
    const disabled = value === "codeData" ? readOnlyView()
      : value === "frame" ? !selectedIndices().length || boardLocked() || readOnlyView()
      : value === "pathEdit" ? !canEditPath || boardLocked() || readOnlyView()
      : value === "measure" ? readOnlyView() : !definition || readOnlyView();
    return <button type="button" role="menuitem" class={active ? "active" : ""} aria-pressed={active} disabled={disabled} title={item.label} onClick={() => runMoreTool(value)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={moreToolPath(value)} /></svg><span>{item.label}</span><Show when={definition?.key}><kbd>{definition?.key}</kbd></Show></button>;
  };
  const renderMoreToolsFamily = () => <Show when={!readOnlyView()}><div class="tool-family more-tools-family tool-extra-family" classList={{ "options-open": moreToolsOpen() }} onFocusOut={event => { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) setMoreToolsOpen(false); }}>
    <button type="button" class="tool-icon-button has-options mobile-tool-essential" title="More Tools" aria-label="More Tools" aria-haspopup="menu" aria-expanded={moreToolsOpen()} onClick={() => { const opening = !moreToolsOpen(); if (!isWindowsPlatform() && isCompactTouchLayout()) closeTouchMenuBar(); setMoreToolsOpen(opening); setCanvasOptionsOpen(false); closeToolOptions(); setStencilMenuOpen(false); scheduleTouchPopoverPlacement(); }}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg><svg class="tool-family-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3"/></svg></button>
    <div class="tool-options more-tools-options" role="menu" aria-label="More Tools">
      <For each={moreToolsOrder()}>{renderMoreToolChoice}</For>
      <div class="more-tools-divider" />
      <button type="button" role="menuitem" class="more-tools-customize" onClick={() => { setMoreToolsOpen(false); setToolbarOrganizerOpen(true); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h7v14H4zM13 5h7v14h-7zM7 9h1m-1 4h1m8-4h2m-2 4h2"/></svg><span>Customize toolbar…</span></button>
    </div>
  </div></Show>;
  function runPaletteSelectionAction(label: string, minimum: number, action: () => void) {
    if (selectedIndices().length < minimum) { setError(`Select ${minimum === 1 ? "an object" : `at least ${minimum} objects`} before ${label}.`); return; }
    action();
  }
  const windowsCommands = createMemo<PaletteCommand[]>(() => {
    const commands: PaletteCommand[] = [
      { id: "new", label: "New sketch", category: "File", shortcut: formatShortcutBindings(shortcuts().newSketch), run: () => void createFile() },
      { id: "open", label: "Open sketch", category: "File", shortcut: formatShortcutBindings(shortcuts().openSketch), run: () => void openFile() },
      { id: "save", label: workspaceArea() === "planning" ? "Save plan" : "Save sketch", category: "File", shortcut: formatShortcutBindings(shortcuts().saveSketch), run: () => void saveCurrentWorkspace() },
      { id: "save-as", label: "Save sketch as", category: "File", shortcut: formatShortcutBindings(shortcuts().saveAs), run: () => void saveAs() },
      { id: "rename-file", label: "Rename sketch", category: "File", keywords: "document title filename", run: openRenameFileDialog },
      { id: "close-file", label: "Close sketch", category: "File", run: () => void closeFile() },
      { id: "open-as-view", label: "Open sketch as view-only", category: "File", keywords: "read only", run: () => void openFileAsView() },
      { id: "undo", label: "Undo", category: "Edit", shortcut: formatShortcutBindings(shortcuts().undo), run: undo },
      { id: "redo", label: "Redo", category: "Edit", shortcut: formatShortcutBindings(shortcuts().redo), run: redo },
      { id: "duplicate", label: "Duplicate selection", category: "Edit", shortcut: formatShortcutBindings(shortcuts().duplicate), run: () => runPaletteSelectionAction("duplicating", 1, () => insertCopies(selectedElements())) },
      { id: "group", label: "Group selection", category: "Edit", shortcut: formatShortcutBindings(shortcuts().group), run: () => runPaletteSelectionAction("grouping", 2, groupSelection) },
      { id: "ungroup", label: "Ungroup selection", category: "Edit", shortcut: formatShortcutBindings(shortcuts().ungroup), run: () => runPaletteSelectionAction("ungrouping", 1, ungroupSelection) },
      { id: "create-frame", label: "Create frame from selection", category: "Structure", keywords: "artboard container group frame", run: () => runPaletteSelectionAction("creating a frame", 1, createFrameFromSelection) },
      { id: "select-connected", label: "Select connected objects", category: "Structure", keywords: "graph relationships bindings", run: () => runPaletteSelectionAction("selecting connected objects", 1, selectConnectedObjects) },
      { id: "select-similar", label: "Select similar objects", category: "Structure", keywords: "same type component symbol", run: () => runPaletteSelectionAction("selecting similar objects", 1, selectSimilarObjects) },
      { id: "reattach-dangling", label: "Reattach dangling connector endpoints", category: "Structure", keywords: "ports nearest anchor repair reconnect", run: reattachNearbyConnectorEndpoints },
      { id: "orthogonalize-selected", label: "Orthogonalize selected connectors", category: "Structure", keywords: "elbow right angle routes", run: () => runPaletteSelectionAction("orthogonalizing connectors", 1, orthogonalizeSelectedConnectors) },
      { id: "select-all", label: "Select all objects", category: "Edit", shortcut: formatShortcutBindings(shortcuts().selectAll), run: () => setSelectedIndices(elements().flatMap((item, index) => !isElementHidden(item) && !isElementLocked(item) ? [index] : [])) },
      { id: "find-objects", label: "Find objects on canvas", category: "Edit", shortcut: "Ctrl+F", keywords: "search navigate nodes labels text table", run: openObjectSearch },
      { id: "open-component-browser", label: "Open component and stencil browser", category: "Insert", keywords: "symbols library search categories shapes", run: () => { closeToolOptions(); setStencilMenuOpen(true); setCanvasOptionsOpen(false); } },
      { id: "open-templates", label: "Browse editable diagram templates", category: "Insert", keywords: "starter UML ER BPMN C4 examples", run: () => setTemplateGalleryOpen(true) },
      { id: "open-layer-panel", label: "Open layers panel", category: "Layers", keywords: "show hide lock nested page layer", run: () => setLayerPanelOpen(true) },
      { id: "create-layer-from-selection", label: "Create layer from selection", category: "Layers", keywords: "organize objects structure", run: () => { if (!selectedIndices().length) setError("Select objects before creating a layer."); else createLayerFromSelection(); } },
      { id: "move-selection-to-layer", label: "Move selection to selected layer", category: "Layers", keywords: "organize objects", run: () => { const layer = selectedLayerKeys().find(key => key.startsWith("layer:")); if (!selectedIndices().length || !layer) { setLayerPanelOpen(true); setError("Select objects and a named layer in the Layers panel first."); } else moveSelectionToLayer(layer); } },
      { id: "toggle-selected-layer-visibility", label: "Toggle selected layer visibility", category: "Layers", keywords: "hide show", run: () => { const layer = selectedLayerKeys().find(key => key.startsWith("layer:")); if (!layer) { setLayerPanelOpen(true); setError("Select a named layer in the Layers panel first."); } else toggleLayer(layer, "hidden"); } },
      { id: "toggle-selected-layer-lock", label: "Toggle selected layer lock", category: "Layers", keywords: "lock unlock protect edit", run: () => { const layer = selectedLayerKeys().find(key => key.startsWith("layer:")); if (!layer) { setLayerPanelOpen(true); setError("Select a named layer in the Layers panel first."); } else toggleLayer(layer, "locked"); } },
      { id: "nest-selected-layers", label: "Nest selected layers", category: "Layers", keywords: "hierarchy parent child", run: () => { if (!selectedLayerKeys().some(key => key.startsWith("layer:"))) { setLayerPanelOpen(true); setError("Select named layers in the Layers panel first."); } else nestSelectedLayers("nest"); } },
      { id: "unnest-selected-layers", label: "Unnest selected layers", category: "Layers", keywords: "hierarchy parent child", run: () => { if (!selectedLayerKeys().some(key => key.startsWith("layer:"))) { setLayerPanelOpen(true); setError("Select named layers in the Layers panel first."); } else nestSelectedLayers("unnest"); } },
      { id: "rename-selected-layer", label: "Rename selected layer", category: "Layers", run: () => { if (!selectedLayerKeys().some(key => key.startsWith("layer:"))) { setLayerPanelOpen(true); setError("Select a named layer in the Layers panel first."); } else renameSelectedLayer(); } },
      { id: "delete-selected-layers", label: "Delete selected layers", category: "Layers", keywords: "remove reassign objects", run: () => { if (!selectedLayerKeys().some(key => key.startsWith("layer:"))) { setLayerPanelOpen(true); setError("Select named layers in the Layers panel first."); } else deleteSelectedLayers(); } },
      { id: "select-by-layer", label: "Select objects in selected layer", category: "Layers", keywords: "select all contents", run: () => { const key = selectedLayerKeys().find(value => value.startsWith("layer:")); const layer = key ? toolLayers().find(value => value.key === key) : undefined; if (!layer) { setLayerPanelOpen(true); setError("Select a layer in the Layers panel first."); } else setSelectedIndices(layer.indices.filter(index => !isElementHidden(elements()[index]) && !isElementLocked(elements()[index]))); } },
      { id: "import-image", label: "Import image", category: "Import", keywords: "png jpeg webp gif", run: () => void importImage() },
      { id: "import-svg", label: "Import SVG", category: "Import", keywords: "vector", run: () => void importSvg() },
      { id: "import-editable-diagram", label: "Import diagram or diagram code", category: "Import", keywords: "diagram graphviz csv dot d2 mermaid plantuml drawio excalidraw", run: () => void importDiagramFile() },
      { id: "embed-web-page", label: "Embed web page on canvas", category: "Import", keywords: "website document link preview iframe", run: openWebEmbedDialog },
      { id: "import-schema", label: "Import SQL or JSON schema", category: "Import", keywords: "database tables", run: () => openSchemaDialog() },
      { id: "validate-diagram", label: "Validate diagram links and relationships", category: "Diagram", keywords: "errors dangling links foreign keys schema consistency", run: runDiagramValidation },
      { id: "focus-first-validation-issue", label: "Focus first validation issue", category: "Diagram", keywords: "select zoom problem error warning lint", run: focusFirstValidationIssue },
      ...DIAGRAM_LINT_PROFILES.filter(profile => profile.id !== "all").map(profile => ({ id: `validate-${profile.id}`, label: `Run ${profile.label} lint checks`, category: "Diagram", keywords: `${profile.label} validation lint rules`, run: () => runProfileValidation(profile.id) })),
      { id: "simulate-bpmn", label: "Simulate BPMN process", category: "Diagram", keywords: "token flow duration bottleneck", run: openBpmnSimulation },
      { id: "optimize-connectors", label: "Optimize all connector routes", category: "Diagram", keywords: "route avoid crossings bends orthogonal connectors", run: () => void optimizeAllConnectorRoutes() },
      { id: "generate-legend", label: "Generate diagram legend", category: "Diagram", keywords: "symbols relationship line styles key", run: insertGeneratedLegend },
      { id: "number-selected-messages", label: "Number selected messages", category: "Diagram", keywords: "sequence UML order numbers", run: renumberSelectedSequenceMessages },
      { id: "open-gui-design-library", label: "Open GUI design library", category: "GUI Design", keywords: "wireframe UI forms buttons fields components", run: openGuiDesignLibrary },
      { id: "create-screen-frame", label: "Create screen frame from selection", category: "GUI Design", keywords: "artboard screen mockup", run: () => runPaletteSelectionAction("creating a screen frame", 1, createFrameFromSelection) },
      { id: "create-ui-component", label: "Create reusable UI component", category: "GUI Design", keywords: "master instance reusable design system", run: () => runPaletteSelectionAction("creating a reusable component", 1, createComponentFromSelection) },
      { id: "present-screens", label: "Present screen frames", category: "GUI Design", keywords: "preview prototype screens", run: () => { if (!currentFrameElements().length) setError("Create a screen frame before presenting screens."); else { setPresentationTarget("frames"); void togglePresentationMode(true); } } },
      { id: "export-selected-frame", label: "Export selected screen frame", category: "GUI Design", keywords: "PNG SVG PDF mockup artboard", run: () => { if (!selectedFrameElement()) setError("Select a screen frame before exporting it."); else { setPdfPageSet("current"); setExportScope("frame"); openExportOptions("png"); } } },
      { id: "mermaid", label: "Create Mermaid diagram", category: "Create", keywords: "flowchart code", run: () => openMermaidDialog() },
      { id: "plantuml", label: "Create PlantUML diagram", category: "Create", keywords: "UML class sequence code", run: () => openMermaidDialog(undefined, "plantuml") },
      { id: "chart-from-csv", label: "Create chart from pasted CSV", category: "Create", keywords: "data chart table series", run: () => { setCsvChartError(""); setCsvChartOpen(true); } },
      { id: "chart-from-table", label: "Create chart from selected table", category: "Create", keywords: "schema markdown note data", run: () => runPaletteSelectionAction("creating a chart", 1, createChartFromSelectedTable) },
      { id: "open-diagram-source", label: "Open selected diagram source", category: "Diagram", keywords: "mermaid plantuml editor code", run: () => { if (selectedDiagramCodeGroup()) { setComponentEditorCollapsed(false); setSidebarTab("properties"); requestAnimationFrame(() => { const disclosure = document.querySelector<HTMLDetailsElement>(".diagram-source-disclosure"); if (disclosure) disclosure.open = true; }); } else setError("Select a generated Mermaid or PlantUML diagram first."); } },
      { id: "export-svg", label: "Export SVG", category: "Export", keywords: "vector", run: () => openExportOptions("svg") },
      { id: "export-selection-png", label: "Export selection as PNG", category: "Export", keywords: "selected objects transparent crop image", run: () => openSelectionExportOptions("png") },
      { id: "export-selection-svg", label: "Export selection as SVG", category: "Export", keywords: "selected objects vector", run: () => openSelectionExportOptions("svg") },
      { id: "export-selection-pdf", label: "Export selection as PDF", category: "Export", keywords: "selected objects print", run: () => openSelectionExportOptions("pdf") },
      { id: "export-drawio", label: "Export editable draw.io diagram", category: "Export", keywords: "mxgraph interchange", run: () => void exportEditableDiagram("drawio") },
      { id: "export-excalidraw", label: "Export editable Excalidraw scene", category: "Export", keywords: "json interchange", run: () => void exportEditableDiagram("excalidraw") },
      { id: "export-diagram-code", label: "Export diagram as code", category: "Export", keywords: "mermaid dot csv sql json schema plantuml", run: () => setDiagramCodeExportOpen(true) },
      { id: "export-pdf", label: "Print preview and export PDF", category: "Export", keywords: "page breaks margins", run: () => openExportOptions("pdf") },
      { id: "export-png", label: "Export PNG", category: "Export", run: () => openExportOptions("png") },
      { id: "toggle-grid", label: "Toggle canvas grid", category: "View", shortcut: formatShortcutBindings(shortcuts().toggleGrid), run: () => setShowGrid(value => !value) },
      { id: "toggle-minimap", label: "Toggle minimap", category: "View", run: () => { const value = !showMinimap(); setShowMinimap(value); try { localStorage.setItem("sketchdraw-canvas-minimap", String(value)); } catch { /* Applied for this session. */ } } },
      { id: "fullscreen", label: "Toggle full screen focus mode", category: "View", run: () => void toggleWindowsFullscreen() },
      { id: "snap-grid", label: "Toggle grid snapping", category: "View", shortcut: formatShortcutBindings(shortcuts().snapGrid), run: () => setSnapToGrid(value => !value) },
      { id: "snap-objects", label: "Toggle object snapping", category: "View", shortcut: formatShortcutBindings(shortcuts().snapObjects), run: () => setSnapToObjects(value => !value) },
      { id: "theme-system", label: "Use system theme", category: "View", keywords: "appearance light dark", run: () => setThemePreference("system") },
      { id: "theme-light", label: "Use light theme", category: "View", keywords: "appearance system dark", run: () => setThemePreference("light") },
      { id: "theme-dark", label: "Use dark theme", category: "View", keywords: "appearance system light", run: () => setThemePreference("dark") },
      { id: "measure-distance", label: "Measure distance on canvas", category: "Tools", shortcut: formatShortcutBindings(shortcuts().measureTool), run: toggleMeasureMode },
      { id: "select-previous-object", label: "Select previous object", category: "Selection", shortcut: formatShortcutBindings(shortcuts().cycleSelectionPrevious), run: () => cycleSelection(-1) },
      { id: "select-next-object", label: "Select next object", category: "Selection", shortcut: formatShortcutBindings(shortcuts().cycleSelectionNext), run: () => cycleSelection(1) },
      { id: "toggle-path-node-edit", label: "Toggle path node editing", category: "Edit", keywords: "vector points freehand nodes", run: () => runPaletteSelectionAction("editing path nodes", 1, () => { if (focusedElement()?.type === "freehand" || focusedElement()?.type === "svgPath") setPathNodeEditMode(value => !value); else setError("Select a freehand stroke or editable SVG path first."); }) },
      { id: "convert-stroke-rectangle", label: "Convert selected stroke to rectangle", category: "Edit", keywords: "recognize clean up sketch", run: () => runPaletteSelectionAction("converting a stroke", 1, convertSelectedStrokeToRectangle) },
      { id: "add-page", label: "Add page to sketch", category: "Pages", run: addPage },
      { id: "lock-canvas", label: "Toggle canvas lock", category: "Canvas", shortcut: formatShortcutBindings(shortcuts().lockCanvas), run: () => setBoardLocked(value => !value) },
      { id: "presentation", label: "Start presentation mode", category: "View", shortcut: formatShortcutBindings(shortcuts().presentation), run: () => void togglePresentationMode(true) },
      { id: "shortcuts", label: "Customize keyboard shortcuts", category: "Settings", run: () => setShortcutDialogOpen(true) },
      { id: "copy-style", label: "Copy object style", category: "Edit", shortcut: formatShortcutBindings(shortcuts().copyStyle), run: copyObjectStyle },
      { id: "paste-style", label: "Paste object style", category: "Edit", shortcut: formatShortcutBindings(shortcuts().pasteStyle), run: pasteObjectStyle },
      { id: "align-left", label: "Align selection left", category: "Arrange", run: () => runPaletteSelectionAction("aligning objects", 2, () => alignSelection("left")) },
      { id: "align-center", label: "Align selection center", category: "Arrange", run: () => runPaletteSelectionAction("aligning objects", 2, () => alignSelection("center")) },
      { id: "align-right", label: "Align selection right", category: "Arrange", run: () => runPaletteSelectionAction("aligning objects", 2, () => alignSelection("right")) },
      { id: "align-top", label: "Align selection top", category: "Arrange", run: () => runPaletteSelectionAction("aligning objects", 2, () => alignSelection("top")) },
      { id: "align-middle", label: "Align selection middle", category: "Arrange", run: () => runPaletteSelectionAction("aligning objects", 2, () => alignSelection("middle")) },
      { id: "align-bottom", label: "Align selection bottom", category: "Arrange", run: () => runPaletteSelectionAction("aligning objects", 2, () => alignSelection("bottom")) },
      { id: "distribute-horizontal", label: "Distribute horizontal spacing", category: "Arrange", run: () => runPaletteSelectionAction("distributing objects", 3, () => alignSelection("horizontal")) },
      { id: "distribute-vertical", label: "Distribute vertical spacing", category: "Arrange", run: () => runPaletteSelectionAction("distributing objects", 3, () => alignSelection("vertical")) },
      { id: "auto-layout", label: "Auto arrange left to right", category: "Arrange", keywords: "automatic layout graph flowchart nodes edges hierarchy", run: () => void autoLayoutDiagram("RIGHT") },
      { id: "auto-layout-down", label: "Auto arrange top to bottom", category: "Arrange", keywords: "automatic layout graph flowchart nodes edges hierarchy", run: () => void autoLayoutDiagram("DOWN") },
      { id: "auto-layout-selection", label: "Auto arrange selection left to right", category: "Arrange", keywords: "automatic layout selected objects graph flowchart nodes edges", run: () => { if (selectedIndices().length < 2) setError("Select at least two objects to arrange a selection."); else void autoLayoutDiagram("RIGHT", "default", layoutAlgorithm(), "selection"); } },
      { id: "auto-layout-selection-down", label: "Auto arrange selection top to bottom", category: "Arrange", keywords: "automatic layout selected objects graph flowchart nodes edges", run: () => { if (selectedIndices().length < 2) setError("Select at least two objects to arrange a selection."); else void autoLayoutDiagram("DOWN", "default", layoutAlgorithm(), "selection"); } },
      { id: "auto-layout-c4", label: "C4 layout preset", category: "Arrange", keywords: "architecture context container service layered", run: () => void autoLayoutDiagram("RIGHT", "c4") },
      { id: "auto-layout-sequence", label: "Sequence layout preset", category: "Arrange", keywords: "UML lifeline messages vertical", run: () => void autoLayoutDiagram("DOWN", "sequence") },
      { id: "auto-layout-erd", label: "ERD layout preset", category: "Arrange", keywords: "database schema tables relationships", run: () => void autoLayoutDiagram("RIGHT", "erd") },
      { id: "auto-layout-network", label: "Network layout preset", category: "Arrange", keywords: "topology routers switches connectivity", run: () => void autoLayoutDiagram("RIGHT", "network") },
      ...EXTRA_FLOWCHART_SHAPES.map(shape => ({ id: `flow-shape-${shape.value}`, label: shape.label, category: "Flowchart stencils", run: () => { setFlowchartShape(shape.value); activateTool("flowchart"); } })),
      ...LIBRARY_COMPONENTS.map(component => ({ id: `component-${component.kind}`, label: component.label, category: component.section, keywords: "stencil component library", run: () => component.kind === "er-table" ? openSchemaDialog() : component.kind === "uml-class" ? (() => { const rect = canvas.getBoundingClientRect(); const view = canvasState(); const item = LIBRARY_COMPONENTS.find(entry => entry.kind === component.kind)!; openClassCardDialog((rect.width / 2 - view.panX) / view.zoom - item.width / 2, (rect.height / 2 - view.panY) / view.zoom - item.height / 2); })() : insertLibraryComponent(component.kind) })),
      ...tools.map(item => {
        const shortcutId = shortcutIdByTool[item.value];
        return { id: `tool-${item.value}`, label: `${item.label} tool`, category: "Tools", shortcut: shortcutId ? formatShortcutBindings(shortcuts()[shortcutId]) : item.key, run: () => activateTool(item.value) };
      }),
    ];
    const availableWithoutDocument = new Set(["new", "open", "shortcuts", "toggle-grid", "toggle-minimap", "snap-grid", "snap-objects"]);
    return activePath() ? commands : commands.filter(command => availableWithoutDocument.has(command.id));
  });

  const mobileCommandBar = () => <Suspense fallback={null}><MobileCommandBar
    fileName={workspaceArea() === "planning" ? planningPath() ? displayNameForPath(planningPath()!) : "Planning" : activePath() ? fileName() : "No file open"}
    hasFile={workspaceArea() === "planning" ? !!planningPath() : !!activePath()}
    planning={workspaceArea() === "planning"}
    canSave={workspaceArea() === "planning" || !!activePath() && !readOnlyView()}
    canSaveAs={workspaceArea() === "planning" || !!activePath() && !documentBusy()}
    canRename={isCanvasWorkspace() && !!activePath() && !readOnlyView()}
    canImport={!!activePath() && isCanvasWorkspace() && !readOnlyView() && !boardLocked() && !documentBusy() && !nativeBusy()}
    canExport={!!activePath() && isCanvasWorkspace() && !readOnlyView() && !documentBusy() && !nativeBusy()}
    canExportRetiredArchive={!!activePath() && hasRetiredLibraryData(legacyLibraryData()) && !readOnlyView() && !documentBusy() && !nativeBusy()}
    canClear={!!activePath() && isCanvasWorkspace() && elements().length > 0 && !boardLocked() && !readOnlyView()}
    canClose={isCanvasWorkspace() && !!activePath() && !documentBusy()}
    shortcuts={{ newSketch: formatShortcutBindings(shortcuts().newSketch), openSketch: formatShortcutBindings(shortcuts().openSketch), saveSketch: formatShortcutBindings(shortcuts().saveSketch) }}
    onNewSketch={() => void createFile()}
    onOpenSketch={() => void openFile()}
    onNewPlan={() => void createPlanningFromHome()}
    onOpenPlan={() => void openPlanningFile()}
    onOpenAsView={() => void openFileAsView()}
    onSave={() => void saveCurrentWorkspace()}
    onSaveAs={() => { if (workspaceArea() === "planning") void savePlanningAs(); else if (activePath()) void saveAs(); }}
    onRename={openRenameFileDialog}
    onImportImage={() => { if (activePath()) void importImage(); }}
    onImportSvg={() => { if (activePath()) void importSvg(); }}
    onImportDiagram={() => { if (activePath()) void importDiagramFile(); }}
    onEmbedWeb={openWebEmbedDialog}
    onExportPng={() => { if (activePath()) openExportOptions("png"); }}
    onExportPdf={() => { if (activePath()) openExportOptions("pdf"); }}
    onExportSvg={() => { if (activePath()) openExportOptions("svg"); }}
    onExportDrawio={() => { if (activePath()) void exportEditableDiagram("drawio"); }}
    onExportExcalidraw={() => { if (activePath()) void exportEditableDiagram("excalidraw"); }}
    onExportRetiredArchive={() => void exportRetiredLibraryArchive()}
    onClearCanvas={() => setShowClearConfirm(true)}
    onCloseFile={() => void closeFile()}
    interfaceScale={interfaceScale()}
    mobileOrientation={mobileOrientation()}
    toolbarPosition={toolbarPosition()}
    orientationMessage={orientationMessage()}
    showMobileLayoutSettings={isCompactTouchLayout()}
    autosaveSeconds={autosaveSeconds()}
    thicknessPickerMode={thicknessPickerMode()}
    onInterfaceScaleChange={setInterfaceScalePreference}
    onMobileOrientationChange={setMobileOrientationPreference}
    onToolbarPositionChange={setToolbarPositionPreference}
    onAutosaveChange={setAutosavePreference}
    onThicknessPickerModeChange={setThicknessPickerPreference}
    appAppearance={{ themeMode: themeMode(), accentColor: accentColor(), toolbarColorChoice: toolbarColorChoice(), accentOptions: UI_ACCENTS, toolbarColorOptions: TOOLBAR_COLORS, onThemeChange: setThemePreference, onAccentChange: setAccentPreference, onToolbarColorChange: setToolbarColorPreference }}
    onRestoreDefaults={restoreAppSettings}
    gestureSection={gestureMenuSection()}
    onGestureSectionChange={setGestureMenuSection}
    oneFingerTapAction={oneFingerTapAction()}
    twoFingerTapAction={twoFingerTapAction()}
    threeFingerTapAction={threeFingerTapAction()}
    oneFingerDragAction={oneFingerDragAction()}
    twoFingerGestureAction={twoFingerGestureAction()}
    threeFingerGestureAction={threeFingerGestureAction()}
    onTapChange={(fingers, action) => setTouchTapPreference(fingers, action)}
    onGestureChange={(fingers, action) => setTouchGesturePreference(fingers, action)}
    onOpenGuide={() => { setHelpSection("guide"); setHelpOpen(true); }}
    onOpenDiagramGuides={() => setTemplateGalleryOpen(true)}
    onOpenShortcuts={() => { setHelpSection("shortcuts"); setHelpOpen(true); }}
    onCheckForUpdates={() => void checkForUpdates()}
    onInstallUpdate={() => void installUpdate()}
    updateStatus={updateCheck()}
    appVersion={appVersion()}
    updateVersion={updateVersion() ?? "—"}
    updateError={error()}
    canInstallUpdate={isAndroidPlatform() && !!androidUpdateUrl()}
  /></Suspense>;

  return (
    <main class="app-shell" classList={{ "theme-light": theme() === "light", "theme-dark": theme() === "dark", "mobile-orientation-portrait": mobileOrientation() === "portrait", "mobile-toolbar-top": !isWindowsPlatform() && toolbarPosition() === "top", "mobile-toolbar-bottom": !isWindowsPlatform() && toolbarPosition() === "bottom", "mobile-toolbar-left": !isWindowsPlatform() && toolbarPosition() === "left", "mobile-toolbar-right": !isWindowsPlatform() && toolbarPosition() === "right", "mobile-toolbar-horizontal": !isWindowsPlatform() && (toolbarPosition() === "top" || toolbarPosition() === "bottom"), "mobile-toolbar-vertical": !isWindowsPlatform() && (toolbarPosition() === "left" || toolbarPosition() === "right"), "home-screen-active": showWelcomeScreen(), "design-workspace-active": workspaceArea() === "design", "canvas-options-active": canvasOptionsOpen(), "noncanvas-workspace-active": workspaceArea() === "planning", "touch-focus-mode": touchFocusMode(), "platform-windows": isWindowsPlatform(), "windows-presentation-mode": isWindowsPlatform() && presentationMode(), "presentation-mode": presentationMode(), "windows-fullscreen-mode": isWindowsPlatform() && windowsFullscreenMode(), "read-only-view": readOnlyView() }} onPointerDown={event => { const target = event.target as HTMLElement | null; if (stencilMenuOpen() && !target?.closest(".stencil-family, .stencil-options")) setStencilMenuOpen(false); }} style={`--ui-accent: ${accentForTheme()}; --toolbar-surface: ${toolbarColor()}; --toolbar-ink: ${toolbarInk()}; --workspace-accent: ${accentForTheme()}; --workspace-surface: ${toolbarColor()}; --workspace-raised: ${toolbarColor()}; --workspace-ink: ${toolbarInk()}; --workspace-muted: color-mix(in srgb, ${toolbarInk()} 88%, transparent); --workspace-line: color-mix(in srgb, ${toolbarInk()} 15%, transparent); --app-ui-scale: ${interfaceScale()}; --app-topbar-height: ${topbarHeight()}px;`}>
      <Show when={toolbarOrganizerOpen()}><ToolbarOrderEditor toolbarItems={organizerItems(toolbarOrder())} moreItems={organizerItems(moreToolsOrder())} onMove={moveToolbarTool} onReorder={reorderToolbarTool} onReset={resetToolbarOrder} onClose={() => setToolbarOrganizerOpen(false)} /></Show>
      <Show when={legacyMigrationPath() && !recoveryPrompt() && !syncConflict()}>
        <div class="confirm-backdrop legacy-refactor-backdrop"><section class="confirm-dialog legacy-refactor-dialog" role="alertdialog" aria-modal="true" aria-labelledby="legacy-refactor-title">
          <span class="eyebrow">OLDER SKETCH FORMAT</span><h2 id="legacy-refactor-title">Refactor this sketch?</h2>
          <p><strong>{displayNameForPath(legacyMigrationPath()!)}</strong> uses an older file format. Saving it as the current version replaces this file.</p>
          <p>Canvas pages and drawings stay. Planning data, notebook notes, and retired Library records are removed from the new file. Refactoring runs only after you accept.</p>
          <Show when={error()}><p class="legacy-refactor-error" role="alert">{error()}</p></Show>
          <div><button type="button" class="quiet-button" disabled={nativeBusy()} onClick={() => void declineLegacyRefactor()}>Decline and close</button><button type="button" class="save-button" disabled={nativeBusy()} onClick={() => void acceptLegacyRefactor()}>{nativeBusy() ? "Saving…" : "Refactor and save"}</button></div>
        </section></div>
      </Show>
      <Show when={updateNoticeVersion()}>{version => <aside class="update-notice" role="alert" aria-live="polite"><span><strong>SketchDraw {version()} is available.</strong><small>Update now or choose Later to keep working.</small></span><div>{isWindowsPlatform() || isAndroidPlatform() ? <button type="button" class="save-button" onClick={() => void installUpdate()}>Update</button> : <a href="https://github.com/Toushal29/SketchDraw/releases/latest" target="_blank" rel="noreferrer">View release</a>}<button type="button" class="quiet-button" onClick={dismissUpdateNotice}>Later</button></div></aside>}</Show>
      <Show when={!isWindowsPlatform()}>
        <MobileWorkspaceHeader
          brandName={workspaceArea() === "planning" ? planningPath() ? displayNameForPath(planningPath()!) : "Planning" : activePath() ? fileName() : "SketchDraw"}
          hasFile={workspaceArea() === "planning" ? !!planningPath() : !!activePath()}
          readOnly={readOnlyView()}
          planning={workspaceArea() === "planning"}
          headerRef={element => { appTopbar = element; }}
          commands={<nav class="mobile-command-host" aria-label="File and application settings">{mobileCommandBar()}</nav>}
          workspaceTabs={<WorkspaceAreaTabs active={workspaceArea()} documentTabs={!!activePath() && isCanvasWorkspace()} onSelect={area => setWorkspaceArea(area)} />}
          pageMenu={<Show when={activePath() && isCanvasWorkspace()}><TouchPageMenu pages={pages()} activePageId={activePageId()} boardLocked={boardLocked() || readOnlyView()} onSelectPage={switchPage} onAddPage={addPage} onRenamePage={() => openPageDialog("rename")} onDuplicatePage={duplicatePage} onReorderPage={direction => reorderPage(direction)} onDeletePage={() => openPageDialog("delete")} onToggle={alignTouchMenuPopover} /></Show>}
          status={<Show when={workspaceArea() === "planning" ? planningPath() : activePath()}><div class="mobile-header-status"><span class={`save-status ${workspaceArea() === "planning" ? planningSaving() ? "is-saving" : planningDirty() ? "is-dirty" : "is-saved" : saving() ? "is-saving" : (dirty() || textDraft()) ? "is-dirty" : "is-saved"}`} role="status" aria-live="polite" aria-label={workspaceArea() === "planning" ? planningSaving() ? "Saving Planning file" : planningDirty() ? "Unsaved Planning changes" : "Planning file saved" : status()} title={workspaceArea() === "planning" ? planningSavedAt() ? `Planning saved ${planningSavedAt()}` : "Planning file status" : status()}><i /></span></div></Show>}
        />
      </Show>
      <Show when={isWindowsPlatform()}>
      <header class="topbar" ref={element => { appTopbar = element; }}>
        <div class="header-leading"><div class="brand"><img class="brand-mark-image" src={sketchDrawMark} alt="" /><span title={workspaceArea() === "planning" ? planningPath() ? displayNameForPath(planningPath()!) : "Planning" : activePath() ? fileName() : "SketchDraw"}>{workspaceArea() === "planning" ? planningPath() ? displayNameForPath(planningPath()!) : "Planning" : activePath() ? fileName() : "SketchDraw"}</span></div><Show when={readOnlyView() && isCanvasWorkspace()}><span class="view-only-badge">VIEW ONLY</span></Show></div>
        <nav class="app-menus" aria-label="Application menus">
          <Show when={isWindowsPlatform()}>
          <WindowsMenuRail settings={<AppSettingsMenu
            interfaceScale={interfaceScale()}
            mobileOrientation={mobileOrientation()}
            toolbarPosition={toolbarPosition()}
            orientationMessage={orientationMessage()}
            showMobileLayoutSettings={isCompactTouchLayout()}
            autosaveSeconds={autosaveSeconds()}
            thicknessPickerMode={thicknessPickerMode()}
            onInterfaceScaleChange={setInterfaceScalePreference}
            onMobileOrientationChange={setMobileOrientationPreference}
            onToolbarPositionChange={setToolbarPositionPreference}
            onAutosaveChange={setAutosavePreference}
            onThicknessPickerModeChange={setThicknessPickerPreference}
            onRestoreDefaults={restoreAppSettings}
            detailsRef={element => { appSettingsMenu = element; }}
            onToggle={() => alignTouchMenuPopover(appSettingsMenu)}
          />}>
          <details class="menu-dropdown file-menu-dropdown" ref={menu} onToggle={() => alignTouchMenuPopover(menu)}><summary><svg class="touch-menu-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2zM3.5 10h18" /></svg><span>File</span><svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg></summary><div class="system-menu-popover"><div class="menu-file-label">{workspaceArea() === "planning" ? planningPath() ? displayNameForPath(planningPath()!) : "Planning" : activePath() ? fileName() : "No file open"}</div>
            <Show when={workspaceArea() === "planning"}><button onClick={() => closeSystemMenu(() => void createPlanningFromHome())}>New plan</button><button onClick={() => closeSystemMenu(() => void openPlanningFile())}>Open plan...</button><button disabled={planningSaving() || !planningDirty() && !!planningPath()} onClick={() => closeSystemMenu(() => void savePlanningDocument())}>Save plan <kbd>{formatShortcutBindings(shortcuts().saveSketch)}</kbd></button><button disabled={planningSaving()} onClick={() => closeSystemMenu(() => void savePlanningAs())}>Save plan as...</button><div class="menu-separator" /></Show><Show when={workspaceArea() !== "planning"}>
            <button onClick={() => closeSystemMenu(() => void createFile())}>New sketch <kbd>{formatShortcutBindings(shortcuts().newSketch)}</kbd></button><button onClick={() => closeSystemMenu(() => void openFile())}>Open sketch <kbd>{formatShortcutBindings(shortcuts().openSketch)}</kbd></button><button onClick={() => closeSystemMenu(() => void openFileAsView())}>Open sketch as view only</button><button disabled={!activePath() || readOnlyView()} onClick={() => closeSystemMenu(() => { if (activePath()) void saveToPath(activePath()!); })}>Save sketch <kbd>{formatShortcutBindings(shortcuts().saveSketch)}</kbd></button><button disabled={!activePath() || documentBusy()} onClick={() => closeSystemMenu(() => { if (activePath()) void saveAs(); })}>Save sketch as...</button><button disabled={!activePath() || readOnlyView()} onClick={() => closeSystemMenu(openRenameFileDialog)}>Rename sketch...</button><button disabled={!activePath() || !isCanvasWorkspace() || readOnlyView()} onClick={() => closeSystemMenu(() => { if (activePath()) void importImage(); })}>Import image...</button><button disabled={!activePath() || !isCanvasWorkspace() || readOnlyView()} onClick={() => closeSystemMenu(() => void importSvg())}>Import SVG...</button><button disabled={!activePath() || !isCanvasWorkspace() || readOnlyView() || boardLocked() || nativeBusy() || documentBusy()} onClick={() => closeSystemMenu(() => void importDiagramFile())}>Import editable diagram/code...</button><button disabled={!activePath() || !isCanvasWorkspace() || readOnlyView() || boardLocked()} onClick={() => closeSystemMenu(openWebEmbedDialog)}>Embed web page...</button><div class="menu-separator" /><button disabled={!activePath() || !isCanvasWorkspace() || readOnlyView()} onClick={() => closeSystemMenu(() => { if (activePath()) openExportOptions("png"); })}>Export PNG...</button><button disabled={!activePath() || !isCanvasWorkspace() || readOnlyView()} onClick={() => closeSystemMenu(() => { if (activePath()) openExportOptions("pdf"); })}>Print preview / PDF...</button><button disabled={!activePath() || !isCanvasWorkspace() || readOnlyView()} onClick={() => closeSystemMenu(() => { if (activePath()) openExportOptions("svg"); })}>Export SVG...</button><button disabled={!activePath() || !isCanvasWorkspace() || readOnlyView() || !elements().length || nativeBusy() || documentBusy()} onClick={() => closeSystemMenu(() => void exportEditableDiagram("drawio"))}>Export draw.io...</button><button disabled={!activePath() || !isCanvasWorkspace() || readOnlyView() || !elements().length || nativeBusy() || documentBusy()} onClick={() => closeSystemMenu(() => void exportEditableDiagram("excalidraw"))}>Export Excalidraw...</button><button disabled={!activePath() || !isCanvasWorkspace() || readOnlyView() || !elements().length || nativeBusy() || documentBusy()} onClick={() => closeSystemMenu(() => setDiagramCodeExportOpen(true))}>Export diagram code...</button><button disabled={!activePath() || !isCanvasWorkspace() || !elements().length || boardLocked() || readOnlyView()} onClick={() => closeSystemMenu(() => setShowClearConfirm(true))}>Clear canvas</button><div class="menu-separator" /><button disabled={!activePath() || documentBusy()} onClick={() => closeSystemMenu(() => void closeFile())}>Close sketch</button>
            <Show when={hasRetiredLibraryData(legacyLibraryData())}><button disabled={!activePath() || readOnlyView() || documentBusy() || nativeBusy()} onClick={() => closeSystemMenu(() => void exportRetiredLibraryArchive())}>Export retired Library data...</button></Show></Show>
          </div></details>
            <details class="menu-dropdown view-menu-dropdown" ref={viewMenu} onToggle={() => alignViewSettingsPopover()}>
              <summary><svg class="touch-menu-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg><span>View</span><svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg></summary>
              <ViewSettingsPopover
                themeMode={themeMode()}
                accentColor={accentColor()}
                toolbarColorChoice={toolbarColorChoice()}
                accentOptions={UI_ACCENTS}
                toolbarColorOptions={TOOLBAR_COLORS}
                boardColor={boardColor()}
                renderedBoardColor={renderedBoardColor()}
                boardColorFollowsTheme={boardColorFollowsTheme()}
                boardLocked={boardLocked()}
                boardColors={BOARD_COLORS.map(value => ({ value, label: BOARD_COLOR_NAMES[value] ?? value }))}
                paperPattern={whiteboardStyle()}
                patterns={[{ value: "plain", label: "Plain" }, { value: "dots", label: "Dots" }, { value: "small-dots", label: "Fine dots" }, { value: "lines", label: "Grid" }, { value: "small-grid", label: "Fine grid" }, { value: "ruled", label: "Ruled" }, { value: "isometric", label: "Isometric" }]}
                namedVersionsDisabled={!activePath() || !isCanvasWorkspace()}
                onThemeChange={setThemePreference}
                onAccentChange={setAccentPreference}
                onToolbarColorChange={setToolbarColorPreference}
                onBoardFollowTheme={() => { if (!boardLocked()) { setBoardColorFollowsTheme(true); setCanvasState({ ...canvasState(), boardColorFollowsTheme: true }); setDirty(true); } }}
                onBoardColorChange={value => { if (!boardLocked()) { setBoardColor(value); setBoardColorFollowsTheme(false); setCanvasState({ ...canvasState(), backgroundColor: value, boardColorFollowsTheme: false }); setDirty(true); } }}
                onPaperPatternChange={setWhiteboardStylePreference}
                onNamedVersions={openNamedSnapshots}
                onCustomizeToolbar={() => { if (viewMenu) viewMenu.open = false; setToolbarOrganizerOpen(true); }}
              />
            </details>
          <GestureSettings section={gestureMenuSection()} onSectionChange={section => setGestureMenuSection(section)} oneFingerTapAction={oneFingerTapAction()} twoFingerTapAction={twoFingerTapAction()} threeFingerTapAction={threeFingerTapAction()} oneFingerDragAction={oneFingerDragAction()} twoFingerGestureAction={twoFingerGestureAction()} threeFingerGestureAction={threeFingerGestureAction()} onTapChange={(fingers, action) => setTouchTapPreference(fingers, action)} onGestureChange={(fingers, action) => setTouchGesturePreference(fingers, action)} detailsRef={element => { gestureMenu = element; }} onToggle={() => alignTouchMenuPopover(gestureMenu)} />
          <details class="menu-dropdown help-menu" ref={helpMenu} onToggle={() => alignTouchMenuPopover(helpMenu)}><summary><svg class="touch-menu-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 1 1 4.2 1.6c-1.3 1.1-1.9 1.4-1.9 3M12 17.4v.1" /></svg><span>Help</span><svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg></summary><div class="system-menu-popover"><button onClick={() => closeSystemMenu(() => { setHelpSection("guide"); setHelpOpen(true); })}>Guide</button><button onClick={() => closeSystemMenu(() => setTemplateGalleryOpen(true))}>Diagram guides</button><button onClick={() => closeSystemMenu(() => { setHelpSection("shortcuts"); setHelpOpen(true); })}>Keyboard shortcuts <kbd>F1</kbd></button><Show when={isWindowsPlatform()}><button onClick={() => closeSystemMenu(() => setShortcutDialogOpen(true))}>Customize shortcuts...</button><button onClick={() => closeSystemMenu(() => setCommandPaletteOpen(true))}>Command palette <kbd>{formatShortcutBindings(shortcuts().commandPalette)}</kbd></button></Show><div class="menu-separator" /><button disabled={updateCheck() === "checking" || updateCheck() === "installing"} onClick={() => void checkForUpdates()}>{updateCheck() === "checking" ? "Checking for updates..." : "Check for updates"}</button><span class="update-menu-version">Installed version {appVersion()}</span><Show when={updateCheck() === "installing"}><span class="update-menu-status available">Installing update {updateVersion()}…</span></Show><Show when={updateCheck() === "current"}><span class="update-menu-status current">No newer release is available.</span></Show><Show when={updateCheck() === "available"}><span class="update-menu-status available">New version {updateVersion()} is available.</span><Show when={isWindowsPlatform()}><button onClick={() => void installUpdate()}>Download and install</button></Show></Show><Show when={updateCheck() === "error"}><span class="update-menu-status error">Update check or installation failed.</span></Show></div></details>
          </WindowsMenuRail>
          </Show>
        </nav>
        <WorkspaceAreaTabs active={workspaceArea()} documentTabs={!!activePath() && isCanvasWorkspace()} onSelect={area => setWorkspaceArea(area)} />
        <Show when={isWindowsPlatform() && activePath() && openSketchPaths().length > 0}><Suspense fallback={null}><WindowsDocumentTabs paths={openSketchPaths()} activePath={activePath()} displayName={displayNameForPath} onSelect={path => { if (path !== activePath()) void loadFile(path); }} onClose={path => void closeSketchTab(path)} /></Suspense></Show>

          <Show when={workspaceArea() === "planning" && planningPath()}><div class="top-actions"><span class={`save-status ${planningSaving() ? "is-saving" : planningDirty() ? "is-dirty" : "is-saved"}`} role="status" aria-live="polite" aria-label={planningSaving() ? "Saving Planning file" : planningDirty() ? "Unsaved Planning changes" : "Planning file saved"} title={planningSavedAt() ? `Planning saved ${planningSavedAt()}` : "Planning file status"}><i /><time>{planningSavedAt() || "—"}</time></span></div></Show>
          <Show when={isCanvasWorkspace() && activePath()}><div class="top-actions"><span class="live-sync-indicator" title="Watches this open .sketch file for changes from another app, with a 30 second polling fallback for cloud folders."><i />Live file updates</span><span class={`save-status ${saving() ? "is-saving" : (dirty() || textDraft()) ? "is-dirty" : "is-saved"}`} role="status" aria-live="polite" aria-label={status()} title={status()}><i /><time>{savedAt() || "—"}</time></span></div></Show>
      </header>
      </Show>
      <Show when={workspaceArea() === "planning" && planningPath()}><Suspense fallback={null}><ProjectWorkspace
          data={projectWorkspaceData()}
          editable
          fileName={planningPath() ? displayNameForPath(planningPath()!) : "Unsaved plan"}
          recentPlans={recentPlans()}
          planningPath={planningPath()}
          dirty={planningDirty()}
          saving={planningSaving()}
          onChange={planningSession.update}
          onNew={() => void createPlanningFromHome()}
          onOpen={() => void openPlanningFile()}
          onSave={() => void savePlanningDocument()}
          onSaveAs={() => void savePlanningAs()}
          onAddPlans={() => void addPlansToOverview()}
          onOpenPlan={openRecentPlan}
          onExport={exportPlanningText}
        /></Suspense></Show>
      <Show when={showWelcomeScreen()}>
        <MobileHomeScreen planningViewport={workspaceArea() === "planning"} recentFiles={recentFiles()} recentPlans={recentPlans()} displayPathName={displayNameForPath} onCreate={createFile} onNewPlan={createPlanningFromHome} onOpenPlan={openPlanningFile} onOpen={openFile} onOpenRecent={loadFile} onOpenRecentPlan={openRecentPlan} />
        <WelcomeScreen planningViewport={workspaceArea() === "planning"} recentFiles={recentFiles} recentPlans={recentPlans} displayNameForPath={displayNameForPath} onCreateFile={createFile} onOpenFile={openFile} onCreatePlan={createPlanningFromHome} onOpenPlan={openPlanningFile} onOpenRecentPlan={openRecentPlan} onOpenRecentFile={loadFile} />
      </Show>
      <Show when={isCanvasWorkspace()}>
      <Show when={activePath()}>
        <>
          <section class="canvas-wrap" ref={canvasWrap} classList={{ "canvas-minimap-visible": showMinimap() }}>
            <Show when={touchFocusMode()}><TouchFocusTools tool={tool()} readOnly={readOnlyView()} onSelect={chooseFocusTool} onExit={() => void toggleTouchFocusMode(false)} /></Show>
            <Show when={isWindowsPlatform() && windowsFullscreenMode()}><WindowsFocusTools tool={tool()} readOnly={readOnlyView()} onSelect={selectedTool => { if (readOnlyView() && selectedTool !== "select" && selectedTool !== "laser") { setTool("laser"); return; } if (selectedTool === "select") { setTool("select"); setStyleMenuMode("quick"); } else activateTool(selectedTool); }} onExit={() => void toggleWindowsFullscreen(false)} /></Show>
            <Show when={touchStylePanel() && !isWindowsPlatform() && isCompactTouchLayout()}><TouchStylePanel
              tool={tool()}
              styleName={quickElementType()}
              supportsStroke={showStrokeControls()}
              supportsWidth={showThicknessControls()}
              thicknessPickerMode={thicknessPickerMode()}
              isLine={quickElementType() === "line"}
              isArrow={quickElementType() === "arrow"}
              straightOnly={quickShapeSelection()?.straightOnly ?? false}
              isFlowchart={quickElementType() === "flowchart"}
              color={selectedColor()}
              width={selectedThickness()}
              brushMode={brushMode()}
              supportsFill={quickHasShapeFill()}
              fillEnabled={fillEnabled() || !!selectedFillColor()}
              fillColor={selectedFillColor() ?? fillColor()}
              fillOpacity={selectedFillOpacity()}
              supportsLineStyle={quickHasShapeFill() || quickIsConnector() || !!styleContainerSelection()}
              supportsContainerAppearance={!!styleContainerSelection()}
              showContainerBorder={styleContainerSelection()?.container?.showBorder !== false}
              showContainerLabel={styleContainerSelection()?.container?.showLabel !== false}
              lineStyle={quickCurrentLineStyle()}
              lineRoute={quickShapeSelection()?.type === "line" ? quickShapeSelection()?.lineRoute ?? "straight" : lineRoute()}
              lineRoutes={LINE_ROUTES}
              arrowRoute={quickShapeSelection()?.type === "arrow" ? quickShapeSelection()?.arrowRoute ?? "straight" : arrowRoute()}
              arrowRoutes={ARROW_ROUTES}
              flowchartShape={quickShapeSelection()?.type === "flowchart" ? quickShapeSelection()?.flowchartShape ?? "process" : flowchartShape()}
              flowchartShapes={FLOWCHART_MENU_SHAPES}
              arrowHeads={ARROW_HEADS}
              startHead={quickArrowHead("start")}
              endHead={quickArrowHead("end")}
              forkUpperHead={quickShapeSelection()?.type === "arrow" ? quickShapeSelection()?.forkUpper?.endHead ?? defaultForkUpperHead() : defaultForkUpperHead()}
              forkLowerHead={quickShapeSelection()?.type === "arrow" ? quickShapeSelection()?.forkLower?.endHead ?? defaultForkLowerHead() : defaultForkLowerHead()}
              supportsCorners={quickElementType() === "rectangle"}
              edgeStyle={quickShapeSelection()?.type === "rectangle" ? quickShapeSelection()?.edgeStyle ?? "sharp" : edgeStyle()}
              cornerRadius={quickShapeSelection()?.type === "rectangle" ? quickShapeSelection()?.cornerRadius ?? 12 : cornerRadius()}
              supportsText={quickHasText()}
              fontSize={quickCardFontSize()}
              fontFamily={selectedText()?.fontFamily ?? defaultFontFamily()}
              bold={selectedText()?.bold ?? defaultBold()}
              italic={selectedText()?.italic ?? defaultItalic()}
              underline={selectedText()?.underline ?? defaultUnderline()}
              textAlign={selectedText()?.textAlign ?? defaultTextAlign()}
              listType={selectedText()?.listType ?? defaultListType()}
              hasSelection={!!selectedIndices().length && !selectedNoteCard()}
              selectionOpacity={selectedOpacity()}
              canRotate={!!selectedIndices().length && !selectedNoteCard() && !groupSelected() && !!focusedElement() && !isConnector(focusedElement()!)}
              penPressure={penPressure()}
              penTilt={penTilt()}
              penEraser={penEraser()}
              isLaser={tool() === "laser"}
              laserColor={laserColor()}
              laserThickness={laserThickness()}
              laserFadeDuration={laserFadeDuration()}
              laserRainbow={laserRainbow()}
              isBucket={tool() === "bucket"}
              locked={boardLocked() || !!focusedElement()?.locked}
              routesLocked={orthogonalConnectors()}
              onClose={() => setTouchStylePanel(false)}
              onColorChange={value => { if (selectedLabel() && !textDraft()) updateLabel("color", value); else updateStrokeColor(value); }}
              onWidthChange={updateThickness}
              onBrushModeChange={mode => { setBrushMode(mode); setTool("pen"); }}
              onFillEnabledChange={enabled => { setFillEnabled(enabled); if (hasStyleSelection()) updateProperty("fillColor", enabled ? fillColor() : undefined); }}
              onFillColorChange={value => { setFillColor(value); setFillEnabled(true); if (hasStyleSelection()) updateProperty("fillColor", value); }}
              onFillOpacityChange={value => { setFillOpacity(value); if (selectedIndices().length) updateProperty("fillOpacity", value); }}
              onLineStyleChange={updateQuickLineStyle}
              onContainerBorderChange={visible => updateSelectedContainer(container => ({ ...container, showBorder: visible }))}
              onContainerLabelChange={visible => updateSelectedContainer(container => ({ ...container, showLabel: visible }))}
              onLineRouteChange={value => { if (orthogonalConnectors()) return; focusedElement()?.type === "line" ? updateProperty("lineRoute", value) : setLineRoute(value); }}
              onArrowRouteChange={value => { if (orthogonalConnectors()) return; focusedElement()?.type === "arrow" ? updateProperty("arrowRoute", value) : setArrowRoute(value); }}
              onFlowchartShapeChange={value => focusedElement()?.type === "flowchart" ? updateProperty("flowchartShape", value) : setFlowchartShape(value)}
              onConnectorHeadChange={setConnectorHead}
              onForkHeadChange={(branch, value) => { if (focusedElement()?.type === "arrow") updateProperty(branch === "upper" ? "forkUpperHead" : "forkLowerHead", value); else (branch === "upper" ? setDefaultForkUpperHead : setDefaultForkLowerHead)(value); }}
              onEdgeStyleChange={value => focusedElement()?.type === "rectangle" ? updateProperty("edgeStyle", value) : setEdgeStyle(value)}
              onCornerRadiusChange={value => { setCornerRadius(value); if (focusedElement()?.type === "rectangle") updateProperty("cornerRadius", value); }}
              onTextChange={setTextFormat}
              onSelectionOpacityChange={value => updateProperty("opacity", value)}
              onRotate={rotateSelection}
              onResetRotation={resetSelectionRotation}
              onPenPressureChange={setPenPressure}
              onPenTiltChange={setPenTilt}
              onPenEraserChange={setPenEraser}
              onLaserChange={(key, value) => setLaserPreference(key, value)}
              onBucketColorChange={setFillColor}
            /></Show>
            <canvas ref={canvas} class="drawing-canvas" style={{ cursor: isPanning() ? "grabbing" : spaceDown() || tool() === "pan" ? "grab" : boardLocked() && !readOnlyView() ? "not-allowed" : noteToggleHovered() ? "pointer" : tool() === "select" ? hoveredIndex() !== undefined ? "move" : "default" : tool() === "text" ? "text" : tool() === "eraser" ? "cell" : tool() === "bucket" ? "copy" : tool() === "crop" ? "crosshair" : "crosshair" }} onWheel={handleCanvasWheel} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel} onLostPointerCapture={pointerLostCapture} onClick={() => { if (!textEditorFocusOnCanvasClick) return; textEditorFocusOnCanvasClick = false; if (textEditorFocusTimer !== undefined) { window.clearTimeout(textEditorFocusTimer); textEditorFocusTimer = undefined; } focusTextEditor(); }} onPointerLeave={() => { if (!moveOrigin && !resizeOrigin) setHoveredIndex(undefined); setNoteToggleHovered(false); }} onDblClick={handleCanvasDoubleClick} onContextMenu={onContextMenu} />
            <Show when={presentationMode() && presentationTransition()}><div class="canvas-presentation-transition" classList={{ "canvas-presentation-transition-fade": presentationTransition() === "fade", "canvas-presentation-transition-slide": presentationTransition() === "slide" }} aria-hidden="true" /></Show>
            <CanvasInteractionOverlay state={canvasState()} measurement={measurement()} nodeHandles={pathNodeHandles()} disabled={boardLocked() || readOnlyView()} onPathNodePointerDown={beginPathNodeEdit} onPathNodePointerMove={moveEditedPathNode} onPathNodePointerUp={finishPathNodeEdit} onPathNodePointerCancel={cancelPathNodeEdit} />
            <Show when={activeWebPreview()}>{preview => <Show when={elements().find((item): item is ImageElement => item.type === "image" && item.id === preview().id)}>{item => {
              const zoom = canvasState().zoom; const width = Math.min(Math.max(320, item().w * zoom), Math.max(280, canvasWrap.clientWidth - 16)); const height = Math.min(Math.max(260, item().h * zoom), Math.max(220, canvasWrap.clientHeight - 16));
              const left = Math.max(8, Math.min(canvasWrap.clientWidth - width - 8, canvasState().panX + item().x * zoom)); const top = Math.max(8, Math.min(canvasWrap.clientHeight - height - 8, canvasState().panY + item().y * zoom));
              return <section class="canvas-web-preview" role="dialog" aria-label={`Web preview for ${new URL(preview().url).hostname}`} style={{ left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`, transform: `rotate(${item().rotation ?? 0}deg)` }} onPointerDown={event => event.stopPropagation()}>
                <header><strong>{new URL(preview().url).hostname}</strong><a href={preview().url} target="_blank" rel="noreferrer">Open in browser</a><button type="button" aria-label="Close web preview" title="Close preview" onClick={() => setActiveWebPreview(undefined)}>&times;</button></header>
                 <iframe title={`Web preview of ${new URL(preview().url).hostname}`} src={preview().embedUrl} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
              </section>;
            }}</Show>}</Show>
            <button class="canvas-zoom-reset" title="Center view and reset zoom to 100% (0)" aria-label={`Center view and reset zoom, currently ${Math.round(canvasState().zoom * 100)} percent`} onClick={resetZoomAndCenter}><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M10.5 7v7m-3.5-3.5h7"/></svg><kbd>{Math.round(canvasState().zoom * 100)}%</kbd></button>
            <Show when={showMinimap()}><Suspense fallback={null}><CanvasMinimap elements={elements()} zoom={canvasState().zoom} panX={canvasState().panX} panY={canvasState().panY} viewportWidth={canvas.clientWidth} viewportHeight={canvas.clientHeight} onNavigate={center => setCanvasState(current => ({ ...current, panX: canvas.clientWidth / 2 - center.x * current.zoom, panY: canvas.clientHeight / 2 - center.y * current.zoom }))} onClose={() => { setShowMinimap(false); try { localStorage.setItem("sketchdraw-canvas-minimap", "false"); } catch { /* The current view still updates. */ } }} /></Suspense></Show>
            <Show when={presentationMode()}><div class="canvas-presentation-controls"><button title="Previous frame or page" aria-label="Previous frame or page" onClick={() => changePresentationPage(-1)}>‹</button><span>{presentationTarget() === "frames" && presentationFrameIndex() >= 0 ? (currentFrameElements()[presentationFrameIndex()]?.container?.name ?? "Frame") + " · " + (presentationFrameIndex() + 1) + "/" + currentFrameElements().length : currentPage()?.name ?? "Sketch"}</span><button title="Next frame or page" aria-label="Next frame or page" onClick={() => changePresentationPage(1)}>›</button><button class={presentationTarget() === "pages" ? "active" : ""} title="Present pages" onClick={() => setPresentationModeTarget("pages")}>Pages</button><button class={presentationTarget() === "frames" ? "active" : ""} disabled={!currentFrameElements().length} title="Present frames on this page" onClick={() => setPresentationModeTarget("frames")}>Frames</button><button title="Exit presentation mode" onClick={() => void togglePresentationMode(false)}>Exit</button></div></Show>
            <DesktopPageTabs pages={pages()} activePageId={activePageId()} boardLocked={boardLocked() || readOnlyView()} onSelectPage={switchPage} onAddPage={addPage} onRenamePage={() => openPageDialog("rename")} onDuplicatePage={duplicatePage} onReorderPage={direction => reorderPage(direction)} onDeletePage={() => openPageDialog("delete")} />
            <TouchToolBar mobile={!isWindowsPlatform() && isCompactTouchLayout()} open={toolBarOpen()} styleOpen={touchStylePanel()} label={workspaceArea() === "design" ? "Design tools" : "Canvas tools"} showStyleToggle={workspaceArea() !== "design"} quickStyles={workspaceArea() === "design" ? undefined : <Show when={!isWindowsPlatform() && isCompactTouchLayout()}><TouchQuickStyleControls
              showColor={showStrokeControls() || tool() === "bucket" || tool() === "laser"}
              color={tool() === "laser" ? laserColor() : tool() === "bucket" ? fillColor() : selectedColor()}
              colorLabel={tool() === "laser" ? "Laser color" : tool() === "bucket" ? "Bucket fill color" : styleContainerSelection() ? "Group border color" : tool() === "text" ? "Text color" : "Stroke color"}
              colors={["#202124", "#e45454", "#ddb43c", "#5eaa72", "#3d91bd"]}
              showWidth={showThicknessControls() || tool() === "laser"}
              width={tool() === "laser" ? laserThickness() : selectedThickness()}
              widthLabel={tool() === "laser" ? "Laser thickness" : tool() === "eraser" ? "Eraser size" : styleContainerSelection() ? "Group border thickness" : "Stroke width"}
              previewColor={tool() === "laser" ? laserColor() : selectedColor()}
              widthMode={tool() === "laser" ? "slider" : isPenBrushThicknessTarget() && thicknessPickerMode() === "stepper" ? "fine" : "presets"}
              presets={(tool() === "eraser" ? ERASER_SIZE_PRESETS : isPenBrushThicknessTarget() ? THICKNESS_PRESETS : ORIGINAL_INSPECTOR_THICKNESS_PRESETS).map(([value, label]) => ({ value, label }))}
              disabled={tool() !== "laser" && (boardLocked() || !!focusedElement()?.locked)}
              showAppearance={!!styleContainerSelection()}
              borderVisible={styleContainerSelection()?.container?.showBorder !== false}
              labelVisible={styleContainerSelection()?.container?.showLabel !== false}
              lineStyle={quickCurrentLineStyle()}
              onColorChange={value => { if (tool() === "laser") { setLaserPreference("rainbow", "false"); setLaserPreference("color", value); } else if (tool() === "bucket") setFillColor(value); else if (selectedLabel() && !textDraft()) updateLabel("color", value); else updateStrokeColor(value); }}
              onWidthChange={value => { if (tool() === "laser") setLaserPreference("thickness", String(value)); else updateThickness(value); }}
              onToggleBorder={() => updateSelectedContainer(container => ({ ...container, showBorder: container.showBorder === false }))}
              onToggleLabel={() => updateSelectedContainer(container => ({ ...container, showLabel: container.showLabel === false }))}
              onLineStyleChange={updateQuickLineStyle}
            /></Show>} layers={<button type="button" class={`touch-layers-toggle ${layerPanelOpen() ? "active" : ""}`} title={layerPanelOpen() ? "Close layers" : "Open layers"} aria-label={layerPanelOpen() ? "Close layers" : "Open layers"} aria-pressed={layerPanelOpen()} onClick={() => setLayerPanelOpen(value => !value)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 7 8-4 8 4-8 4-8-4Zm0 5 8 4 8-4M4 17l8 4 8-4"/></svg></button>} onShow={() => setToolBarOpen(true)} onHide={() => setToolBarOpen(false)} onToggleStyle={toggleTouchStylePanel}>
              <Show when={workspaceArea() === "design"} fallback={<>
              <div class="tool-cluster tool-cluster-canvas mobile-cluster-has-essential" role="group" aria-label="Canvas view">
              <CanvasOptionsMenu
                open={canvasOptionsOpen()}
                showGrid={showGrid()}
                snapToGrid={snapToGrid()}
                snapToObjects={snapToObjects()}
                hasElements={elements().length > 0}
                hasSelection={selectedIndices().length >= 2}
                canGroup={groupActionEnabled()}
                grouped={groupSelected()}
                boardLocked={boardLocked()}
                onToggle={() => { closeTouchMenuBar(); setCanvasOptionsOpen(value => !value); closeToolOptions(); setStencilMenuOpen(false); scheduleTouchPopoverPlacement(); }}
                onCloseOtherTools={closeToolOptions}
                mobileSimple={!isWindowsPlatform()}
                onFitDrawing={() => { setCanvasOptionsOpen(false); fitDocumentToViewport(elements()); }}
                onFitSelection={() => { setCanvasOptionsOpen(false); fitDocumentToViewport(selectedElements()); }}
                onToggleGrid={() => setShowGrid(value => !value)}
                onToggleSnapToGrid={() => setSnapToGrid(value => !value)}
                onToggleSnapToObjects={() => setSnapToObjects(value => !value)}
                onGroupSelection={() => { groupSelection(); setCanvasOptionsOpen(false); }}
                onCreateFrame={() => { createFrameFromSelection(); setCanvasOptionsOpen(false); }}
                guiDesign={{
                  canCreateFrame: selectedIndices().some(index => !!elements()[index] && canMoveElement(elements()[index])) && !readOnlyView(),
                  canCreateComponent: selectedIndices().length > 0 && !readOnlyView(),
                  canArrange: selectedIndices().length > 1 && !!activePath() && !readOnlyView(),
                  hasSelectedFrame: !!selectedFrameElement() && !readOnlyView(),
                  hasFrames: currentFrameElements().length > 0,
                  onOpenLibrary: openGuiDesignLibrary,
                  onCreateComponent: () => { setCanvasOptionsOpen(false); createComponentFromSelection(); },
                  onArrangeSelection: () => { setCanvasOptionsOpen(false); void autoLayoutDiagram("RIGHT", "default", layoutAlgorithm(), "selection"); },
                  onPresentFrames: () => { setCanvasOptionsOpen(false); setPresentationTarget("frames"); void togglePresentationMode(true); },
                  onExportFrame: () => { setCanvasOptionsOpen(false); setPdfPageSet("current"); setExportScope("frame"); openExportOptions("png"); },
                }}
                onSelectConnected={() => { selectConnectedObjects(); setCanvasOptionsOpen(false); }}
                onSelectSimilar={() => { selectSimilarObjects(); setCanvasOptionsOpen(false); }}
                onOrthogonalizeSelected={() => { orthogonalizeSelectedConnectors(); setCanvasOptionsOpen(false); }}
                structureSelectionDisabled={!selectedIndices().length || readOnlyView()}
                orthogonalizeDisabled={!selectedConnectorCount() || readOnlyView()}
                appAppearance={undefined}
                canvasAppearance={isWindowsPlatform() ? undefined : {
                  backgroundColor: boardColor(),
                  renderedBackgroundColor: renderedBoardColor(),
                  followsTheme: boardColorFollowsTheme(),
                  boardLocked: boardLocked(),
                  boardColors: BOARD_COLORS.map(value => ({ value, label: BOARD_COLOR_NAMES[value] ?? value })),
                  paperPattern: whiteboardStyle(),
                  onFollowTheme: () => { if (!boardLocked()) { setBoardColorFollowsTheme(true); setCanvasState({ ...canvasState(), boardColorFollowsTheme: true }); setDirty(true); } },
                  onBackgroundColorChange: value => { if (!boardLocked()) { setBoardColor(value); setBoardColorFollowsTheme(false); setCanvasState({ ...canvasState(), backgroundColor: value, boardColorFollowsTheme: false }); setDirty(true); } },
                  onPaperPatternChange: setWhiteboardStylePreference,
                }}
                canvasTools={{
                  showMinimap: showMinimap(),
                  orthogonalOnly: orthogonalConnectors(),
                  onToggleOrthogonal: toggleOrthogonalConnectorPolicy,
                  onReattachDangling: reattachNearbyConnectorEndpoints,
                  reattachDisabled: !flatten(elements()).some(isConnector),
                  autoLayoutDisabled: !activePath() || boardLocked() || readOnlyView() || elements().length < 2,
                  layoutAlgorithm: layoutAlgorithm(),
                  layoutSelectionOnly: layoutSelectionOnly(),
                  layoutSpacing: layoutSpacing(),
                  presentation: presentationMode(),
                  onAutoLayout: () => { setCanvasOptionsOpen(false); void autoLayoutDiagram(); },
                  onLayoutAlgorithmChange: value => { setLayoutAlgorithm(value); try { localStorage.setItem("sketchdraw-layout-algorithm", value); } catch { /* Current session still uses the selected algorithm. */ } },
                  onLayoutSelectionOnlyChange: setLayoutSelectionOnly,
                  onLayoutSpacingChange: value => setLayoutSpacing(Math.max(20, Math.min(120, Math.round(value)))),
                  onValidateDiagram: runDiagramValidation,
                  validationDisabled: !activePath() || !elements().length,
                  onSearchObjects: openObjectSearch,
                  onRenumberSequenceMessages: renumberSelectedSequenceMessages,
                  sequenceNumberingDisabled: selectedConnectorCount() < 2 || readOnlyView(),
                  onTogglePresentation: () => void togglePresentationMode(),
                  ...(isWindowsPlatform() ? { fullscreen: windowsFullscreenMode(), onToggleFullscreen: () => void toggleWindowsFullscreen() } : {}),
                  onToggleMinimap: () => { const value = !showMinimap(); setShowMinimap(value); try { localStorage.setItem("sketchdraw-canvas-minimap", String(value)); } catch { /* Current session still uses this setting. */ } },
                }}
              />
              <button class="tool-icon-button mobile-tool-essential touch-focus-entry" aria-label={isWindowsPlatform() && windowsFullscreenMode() ? "Exit full screen focus mode" : "Enter full screen focus mode"} title={isWindowsPlatform() && windowsFullscreenMode() ? "Exit full screen focus mode" : "Full screen focus mode"} onClick={() => isWindowsPlatform() ? void toggleWindowsFullscreen() : void toggleTouchFocusMode(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/></svg></button>
              </div>
              {orderedToolbarEntries().map(entry => entry.kind === "more-tools" ? renderMoreToolsFamily() : <div class={`tool-cluster tool-cluster-${entry.id}`} classList={{ "mobile-cluster-has-essential": entry.tools.some(value => mobileEssentialTools.has(value)), "mobile-cluster-has-current": entry.tools.includes(tool()) }} role="group" aria-label={entry.label}>{entry.tools.map(renderToolbarItem)}</div>)}

              <div class="tool-family tool-extra-family stencil-family" classList={{ "options-open": stencilMenuOpen() }} onFocusOut={event => { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) setStencilMenuOpen(false); }}>
                <button class="tool-icon-button has-options" title="GUI design and diagram components" aria-label="GUI design and diagram components" aria-haspopup="menu" aria-expanded={stencilMenuOpen()} onClick={() => { closeTouchMenuBar(); setStencilMenuOpen(value => !value); setCanvasOptionsOpen(false); closeToolOptions(); scheduleTouchPopoverPlacement(); }}><svg viewBox="0 0 24 24"><path d="M3 5h7v7H3zM14 4l7 4-4 7-7-4zM4 16h7v5H4zM15 17h6v4h-6z"/></svg><kbd>MOD</kbd><svg class="tool-family-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3"/></svg></button>
                <div class="tool-options stencil-options" role="dialog" aria-label="Modeling components">
                  <div class="stencil-picker-heading"><div><strong>Component & stencil library</strong><small>GUI controls and diagram symbols</small></div><label class="stencil-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg><input type="search" aria-label="Search modeling components" placeholder="Search library" value={stencilSearch()} onInput={event => setStencilSearch(event.currentTarget.value)} /></label></div>
                  <div class="stencil-featured-actions"><button type="button" class="stencil-save-action" disabled={!selectedIndices().length || boardLocked()} title="Save the current selection to My stencils" onClick={saveSelectionAsStencil}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h13l3 3v11H4zM8 5v6h8V5M8 19v-5h8v5"/></svg><span><strong>Save selection as stencil</strong><small>Reuse a grouped component on any page</small></span></button><button type="button" class="stencil-save-action" disabled={!selectedIndices().length || boardLocked()} title="Create a linked master component from the selection" onClick={createComponentFromSelection}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="12" height="12" rx="2"/><path d="M9 7h3m-3 4h3M16 8h5v12H9v-3"/></svg><span><strong>Create component master</strong><small>Replace this selection with a reusable instance</small></span></button></div>
                  <div class="stencil-library-actions"><button type="button" onClick={() => void importStencilLibraryFile()} disabled={nativeBusy()}>Import library…</button><button type="button" onClick={() => void exportStencilLibraryFile()} disabled={nativeBusy() || !customStencils().length && !activeComponentMasters().length}>Export library…</button></div>
                  <div class="stencil-category-filter" role="group" aria-label="Filter diagram library">{stencilCategories.map(category => <button type="button" class={stencilCategory() === category.id ? "active" : ""} aria-pressed={stencilCategory() === category.id} onClick={() => setStencilCategory(category.id)}>{category.label}</button>)}</div>
                  <Show when={visibleCustomStencils().length > 0 || stencilCategory() === "custom" || stencilCategory() === "favorites" || stencilCategory() === "recent" || stencilCategory() === "gui"}><strong class="tool-options-heading stencil-heading">{stencilCategory() === "favorites" ? "Favorites" : stencilCategory() === "recent" ? "Recently used" : "My stencils"}</strong><div class="custom-stencil-list">{visibleCustomStencils().map(stencil => <div class="custom-stencil-row"><button type="button" class="custom-stencil-insert" title={`Insert ${stencil.name}: ${stencil.preview}`} onClick={() => insertCustomStencil(stencil)}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><path d="M11 7h3a3 3 0 0 1 3 3v3"/></svg><span>{stencil.name}</span><small>{stencil.folder ? `${stencil.folder} · ` : ""}{stencil.preview}</small><small>{stencil.tags.length ? `#${stencil.tags.join(" #")}` : `${stencil.elements.length} objects`}</small></button><button type="button" class="custom-stencil-favorite" aria-label={`${stencilFavorites().includes(stencil.id) ? "Remove" : "Add"} ${stencil.name} ${stencilFavorites().includes(stencil.id) ? "from" : "to"} favorites`} aria-pressed={stencilFavorites().includes(stencil.id)} title={stencilFavorites().includes(stencil.id) ? "Remove from favorites" : "Add to favorites"} onClick={() => toggleStencilFavorite(stencil.id)}>{stencilFavorites().includes(stencil.id) ? "★" : "☆"}</button><button type="button" class="custom-stencil-remove" aria-label={`Delete stencil ${stencil.name}`} title={`Delete ${stencil.name}`} onClick={() => removeCustomStencil(stencil.id)}>&times;</button></div>)}</div><Show when={!visibleCustomStencils().length}><p class="stencil-empty">{stencilCategory() === "favorites" ? "No favorites yet. Star a stencil to keep it close." : stencilCategory() === "recent" ? "No recently used stencils yet." : "No saved stencils yet. Select objects and choose ‘Save selection as stencil’."}</p></Show></Show>
                  <Show when={visibleComponentMasters().length || stencilCategory() === "masters" || stencilCategory() === "gui"}><strong class="tool-options-heading stencil-heading">Document masters</strong><div class="custom-stencil-list">{visibleComponentMasters().map(master => <button type="button" class="stencil-template" title={`Insert an instance of ${master.name}`} onClick={() => insertComponentMaster(master)}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="12" height="12" rx="2"/><path d="M9 7h3m-3 4h3M16 8h5v12H9v-3"/></svg><span class="stencil-template-copy"><strong>{master.name}</strong><small>{componentPrimaryLabel(master.template) || "Reusable master"} · {componentMasterInstanceCount(master.id)} instance(s)</small></span></button>)}</div><Show when={!visibleComponentMasters().length}><p class="stencil-empty">No document masters yet. Select objects and choose “Create component master”.</p></Show></Show>
                  {visibleStencilSections().map(section => <><strong class="tool-options-heading stencil-heading">{section}</strong>{visibleStencilComponents().filter(component => component.section === section).map(component => <button type="button" class="stencil-template" title={component.description} aria-label={component.label + ". " + component.description} onClick={() => component.kind === "er-table" ? openSchemaDialog(undefined, "CREATE TABLE table_name (\n  id INTEGER PRIMARY KEY,\n  name TEXT\n);") : component.kind === "uml-class" ? (() => { const item = LIBRARY_COMPONENTS.find(entry => entry.kind === component.kind)!; const rect = canvas!.getBoundingClientRect(); const view = canvasState(); openClassCardDialog((rect.width / 2 - view.panX) / view.zoom - item.width / 2, (rect.height / 2 - view.panY) / view.zoom - item.height / 2); })() : insertLibraryComponent(component.kind)}><LibraryComponentIcon kind={component.kind} /><span class="stencil-template-copy"><strong>{component.label}</strong><small>{component.description}</small></span></button>)}</>)}
                  {stencilCategory() !== "custom" && visibleStencilComponents().length === 0 && <p class="stencil-empty">No matches. Try another search or category.</p>}
                  <div class="palette-spawn-footer"><button type="button" class="palette-spawn-all stencil-catalog-action" disabled={!activePath() || readOnlyView() || boardLocked() || componentCatalogBusy()} title={`Add all ${LIBRARY_COMPONENTS.length} built-in modeling components to the current canvas`} onClick={() => void spawnAllModelingComponents()}>{componentCatalogBusy() ? "Preparing component catalog…" : `Spawn all ${LIBRARY_COMPONENTS.length} components`}<small>Add all modeling symbols to the canvas in category order.</small></button></div>
                </div></div>              <div class="tool-cluster tool-cluster-history mobile-cluster-has-essential" role="group" aria-label="History, selection, and canvas state">
                <button class={layerPanelOpen() ? "tool-icon-button canvas-utility-button selected" : "tool-icon-button canvas-utility-button"} title="Layers" aria-label="Open layers panel" aria-pressed={layerPanelOpen()} onClick={() => setLayerPanelOpen(value => !value)}><svg viewBox="0 0 24 24"><path d="m4 7 8-4 8 4-8 4-8-4Zm0 5 8 4 8-4M4 17l8 4 8-4"/></svg></button>
                <Show when={deletableSelectionCount() > 0}><button class="tool-icon-button mobile-tool-essential touch-selection-delete" disabled={boardLocked()} title={`Erase ${deletableSelectionCount()} selected element${deletableSelectionCount() === 1 ? "" : "s"}`} aria-label={`Erase ${deletableSelectionCount()} selected element${deletableSelectionCount() === 1 ? "" : "s"}`} onClick={deleteSelected}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6" /></svg><small class="touch-selection-count">{deletableSelectionCount()}</small></button></Show>
                <button class="tool-icon-button canvas-utility-button mobile-tool-essential" disabled={!canUndo() || boardLocked()} title={`Undo (${formatShortcutBindings(shortcuts().undo)})`} aria-label="Undo" onClick={undo}><svg viewBox="0 0 24 24"><path d="M9 7 4 12l5 5M5 12h8a6 6 0 0 1 6 6"/></svg><kbd>{displayShortcut(shortcuts().undo.find(Boolean) || "Ctrl+Z")}</kbd></button>
                <button class="tool-icon-button canvas-utility-button mobile-tool-essential" disabled={!canRedo() || boardLocked()} title={`Redo (${formatShortcutBindings(shortcuts().redo)})`} aria-label="Redo" onClick={redo}><svg viewBox="0 0 24 24"><path d="m15 7 5 5-5 5m4-5h-8a6 6 0 0 0-6 6"/></svg><kbd>{displayShortcut(shortcuts().redo.find(Boolean) || "Ctrl+Y")}</kbd></button>
                <button class={`tool-icon-button canvas-utility-button mobile-tool-essential ${boardLocked() ? "selected" : ""}`} title={`Canvas ${boardLocked() ? "locked" : "unlocked"} (K)`} aria-label={boardLocked() ? "Unlock canvas" : "Lock canvas"} aria-pressed={boardLocked()} onClick={() => setBoardLocked(value => !value)}><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d={boardLocked() ? "M8 10V7a4 4 0 1 1 8 0v3" : "M8 10V7a4 4 0 0 1 8 0"}/></svg><kbd>K</kbd></button>
              </div>
              </>}>
                <div class="design-toolbar" role="toolbar" aria-label="Design text formatting">
                  <div class="design-toolbar-group design-text-tools" role="group" aria-label="Text formatting" onPointerDown={event => event.stopPropagation()}>
                    <label class="design-text-size" title="Font size"><span>Size</span><input aria-label="Font size" type="number" min="8" max="160" step="1" value={selectedText()?.fontSize ?? defaultFontSize()} disabled={boardLocked() || readOnlyView() || !!focusedElement()?.locked || !designTextStyleAvailable()} onChange={event => setTextFormat("fontSize", Number(event.currentTarget.value))} /></label>
                    <label class="design-text-choice design-text-family-choice" title="Font family"><span>Font</span><select class="design-text-family" aria-label="Font family" value={selectedText()?.fontFamily ?? defaultFontFamily()} disabled={boardLocked() || readOnlyView() || !!focusedElement()?.locked || !designTextStyleAvailable()} onChange={event => setTextFormat("fontFamily", event.currentTarget.value)}>
                      <option value="sans">Sans</option><option value="hand">Handwritten</option><option value="serif">Serif</option><option value="mono">Monospace</option><option value="rounded">Rounded</option><option value="display">Display</option>
                    </select></label>
                    <label class="design-text-choice design-text-alignment-choice" title="Text alignment"><span>Align</span><select class="design-text-alignment" aria-label="Text alignment" value={selectedText()?.textAlign ?? defaultTextAlign()} disabled={boardLocked() || readOnlyView() || !!focusedElement()?.locked || !designTextStyleAvailable()} onChange={event => setTextFormat("textAlign", event.currentTarget.value)}>
                      <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option>
                    </select></label>
                    <label class="design-text-choice design-text-paragraph-choice" title="Paragraph style"><span>List</span><select class="design-text-paragraph" aria-label="Paragraph style" value={selectedText()?.listType ?? defaultListType()} disabled={boardLocked() || readOnlyView() || !!focusedElement()?.locked || !designParagraphStyleAvailable()} onChange={event => setTextFormat("listType", event.currentTarget.value)}>
                      <option value="none">Paragraph</option><option value="bullet">Bullets</option><option value="number">Numbered</option>
                    </select></label>
                    <div class="design-text-emphasis" role="group" aria-label="Font style">
                      <button type="button" class={(selectedText()?.bold ?? defaultBold()) ? "active" : ""} aria-label="Bold" title="Bold" disabled={boardLocked() || readOnlyView() || !!focusedElement()?.locked || !designTextStyleAvailable()} onClick={() => setTextFormat("bold", !(selectedText()?.bold ?? defaultBold()))}><b>B</b></button>
                      <button type="button" class={(selectedText()?.italic ?? defaultItalic()) ? "active" : ""} aria-label="Italic" title="Italic" disabled={boardLocked() || readOnlyView() || !!focusedElement()?.locked || !designTextStyleAvailable()} onClick={() => setTextFormat("italic", !(selectedText()?.italic ?? defaultItalic()))}><i>I</i></button>
                      <button type="button" class={(selectedText()?.underline ?? defaultUnderline()) ? "active" : ""} aria-label="Underline" title="Underline" disabled={boardLocked() || readOnlyView() || !!focusedElement()?.locked || !designTextStyleAvailable()} onClick={() => setTextFormat("underline", !(selectedText()?.underline ?? defaultUnderline()))}><u>U</u></button>
                    </div>
                    <label class="design-text-color" title="Font color"><span>Color</span><input aria-label="Font color" type="color" value={selectedText()?.color ?? selectedLabel()?.color ?? color()} disabled={boardLocked() || readOnlyView() || !!focusedElement()?.locked || !designTextStyleAvailable()} onInput={event => setTextFormat("color", event.currentTarget.value)} /></label>
                  </div>
                </div>
              </Show>
            </TouchToolBar>
            <Show when={layerPanelOpen()}>
              <aside class="floating-layer-panel" aria-label="Canvas layers">
                <header class="layer-panel-heading">
                  <div><strong>Layers</strong><p>Group, order, hide, and lock objects.</p></div>
                  <span class="layer-count-badge" aria-label={`${toolLayers().length} tool layers`}>{toolLayers().length}</span>
                  <button class="pane-close-icon" aria-label="Close layers" title="Close layers" onClick={() => setLayerPanelOpen(false)}>&times;</button>
                </header>
                <div class="layer-list" aria-label="Tool layers">
                  <For each={toolLayers()}>{(layer, rowIndex) => {
                    const count = () => layer.indices.length;
                    const selected = () => selectedLayerKeys().includes(layer.key) || layer.indices.some(index => selectedSet().has(index));
                    return <article class="layer-row" style={{ "margin-left": `${layer.depth * 14}px` }} classList={{ selected: selected(), "layer-multi-selected": selectedLayerKeys().includes(layer.key), hidden: layer.hidden, locked: layer.locked }}>
                      <button class="layer-name" type="button" title={`Select all ${count()} ${layer.path || layer.label.toLowerCase()} objects. Shift-click layers to move them together. Double-click to rename.`} onDblClick={() => { if (layer.key.startsWith("layer:")) { setSelectedLayerKeys([layer.key]); renameSelectedLayer(); } }} onClick={event => { setSelectedLayerKeys(event.shiftKey ? [...new Set([...selectedLayerKeys(), layer.key])] : [layer.key]); setSelectedIndices(event.shiftKey ? [...new Set([...selectedIndices(), ...layer.indices])] : layer.indices); }}>
                        <span class="layer-type-icon" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m10 2 7 3.5-7 3.5-7-3.5L10 2Zm-7 7 7 3.5L17 9M3 12.5 10 16l7-3.5" /></svg></span>
                        <span class="layer-copy"><strong>{layer.label}</strong><small>{count()} {count() === 1 ? "object" : "objects"}{layer.hidden ? " · Hidden" : ""}{layer.locked ? " · Locked" : ""}</small></span>
                      </button>
                      <div class="layer-actions">
                        <div class="layer-order-controls" aria-label={`Reorder ${layer.label}`}>
                          <button type="button" title="Move layer up" aria-label={`Move ${layer.label} up`} disabled={boardLocked() || rowIndex() === 0} onClick={() => moveLayerTo(layer.key, rowIndex() - 1)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 10 5-5 5 5" /></svg></button>
                          <button type="button" title="Move layer down" aria-label={`Move ${layer.label} down`} disabled={boardLocked() || rowIndex() === toolLayers().length - 1} onClick={() => moveLayerTo(layer.key, rowIndex() + 1)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 6 5 5 5-5" /></svg></button>
                        </div>
                        <button class="layer-action" type="button" title={`${layer.hidden ? "Show" : "Hide"} ${layer.label}`} aria-label={`${layer.hidden ? "Show" : "Hide"} ${layer.label}`} aria-pressed={layer.hidden} onClick={() => toggleLayer(layer.key, "hidden")}><svg viewBox="0 0 20 20" aria-hidden="true"><path d={layer.hidden ? "M3 3l14 14M8.6 8.6a2 2 0 0 0 2.8 2.8M7.1 5.2A9.3 9.3 0 0 1 10 4.7c4.2 0 7.2 4.1 8 5.3a8.6 8.6 0 0 1-2.1 2.7M5.2 6.3A13.7 13.7 0 0 0 2 10c.8 1.2 3.8 5.3 8 5.3 1 0 1.9-.2 2.7-.6" : "M2 10s3-5.3 8-5.3 8 5.3 8 5.3-3 5.3-8 5.3S2 10 2 10Z M10 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"} /></svg></button>
                        <button class="layer-action" type="button" title={`${layer.locked ? "Unlock" : "Lock"} ${layer.label}`} aria-label={`${layer.locked ? "Unlock" : "Lock"} ${layer.label}`} aria-pressed={layer.locked} onClick={() => toggleLayer(layer.key, "locked")}><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3.5" y="8.5" width="13" height="9" rx="2"/><path d={layer.locked ? "M6.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5" : "M6.5 8.5V6a3.5 3.5 0 0 1 6.1-2.3"} /></svg></button>
                      </div>
                    </article>;
                  }}</For>
                  <Show when={!elements().length}><div class="layer-empty-state"><span class="layer-type-icon"><svg viewBox="0 0 20 20"><path d="m10 2 7 3.5-7 3.5-7-3.5L10 2Zm-7 7 7 3.5L17 9M3 12.5 10 16l7-3.5" /></svg></span><strong>No layers yet</strong><small>Draw with a tool to create its layer.</small></div></Show>
                </div>
                <Show when={selectedLayerKeys().some(key => key.startsWith("layer:"))}><div class="layer-create-button layer-structure-actions">
                  <button class="quiet-button" type="button" disabled={boardLocked() || selectedLayerKeys().filter(key => key.startsWith("layer:")).length !== 1} onClick={renameSelectedLayer}>Rename</button>
                  <button class="quiet-button" type="button" disabled={boardLocked()} onClick={() => nestSelectedLayers("nest")}>Nest</button>
                  <button class="quiet-button" type="button" disabled={boardLocked()} onClick={() => nestSelectedLayers("unnest")}>Unnest</button>
                  <button class="quiet-button" type="button" disabled={boardLocked()} onClick={deleteSelectedLayers}>Delete</button>
                  <button class="quiet-button" type="button" disabled={boardLocked() || !selectedIndices().length || selectedLayerKeys().filter(key => key.startsWith("layer:")).length !== 1} onClick={() => moveSelectionToLayer(selectedLayerKeys().find(key => key.startsWith("layer:"))!)}>Move selection here</button>
                </div></Show>
                <button class="quiet-button layer-create-button" type="button" disabled={boardLocked() || !selectedIndices().length} onClick={createLayerFromSelection}>Create layer from selection</button>
              </aside>
            </Show>
            <Show when={sidebarVisible() && (workspaceArea() === "design" || isWindowsPlatform() || !isCompactTouchLayout() || !!selectedSchemaTable())}><aside class="style-pane" classList={{ "quick-style-mode": workspaceArea() !== "design" && styleMenuMode() === "quick", "full-style-mode": workspaceArea() !== "design" && styleMenuMode() === "full", "schema-editor-active": !!selectedSchemaTable(), "design-palette-active": workspaceArea() === "design" && !selectedSchemaTable(), "design-panel-collapsed": workspaceArea() === "design" && designPanelCollapsed(), "mobile-properties-collapsed": workspaceArea() !== "design" && !mobileQuickPropertiesOpen() && !selectedSchemaTable(), "mobile-properties-expanded": workspaceArea() === "design" ? !designPanelCollapsed() : mobileQuickPropertiesOpen() || !!selectedSchemaTable(), "quick-style-idle-hidden": workspaceArea() !== "design" && !selectedIndices().length && (tool() === "select" || tool() === "pan" || tool() === "crop") }} aria-label={workspaceArea() === "design" ? selectedSchemaTable() ? "Schema editor" : "Design shape library" : selectedSchemaTable() ? "Schema editor" : "Properties"}>
              <Show when={workspaceArea() === "design" && !selectedSchemaTable()}>
                <DesignShapePalette collapsed={designPanelCollapsed()} disabled={!activePath() || readOnlyView() || boardLocked()} stencils={customStencils()} masters={activeComponentMasters()} onToggle={toggleDesignPanel} onInsert={insertDesignPaletteItem} />
              </Show>
              <Show when={selectedSchemaTable()}>{table => <div class="quick-style-panel schema-editor-panel">
                <header class="schema-editor-heading"><div><span>DATABASE SCHEMA VISUALIZER</span><strong>{table().name}</strong></div><small>LIVE</small><Show when={workspaceArea() === "design"}><button type="button" class="design-library-back" onClick={() => setSelectedIndices([])}>Library</button><button type="button" class="design-panel-toggle" aria-label={designPanelCollapsed() ? "Expand schema editor" : "Collapse schema editor"} title={designPanelCollapsed() ? "Expand panel" : "Collapse panel"} aria-expanded={!designPanelCollapsed()} onClick={toggleDesignPanel}><svg viewBox="0 0 20 20" aria-hidden="true"><path d={designPanelCollapsed() ? "M4 10h12m-5-5 5 5-5 5" : "M16 10H4m5-5-5 5 5 5"} /></svg></button></Show></header>
                <div class="schema-editor-actions"><button class="quiet-button" type="button" disabled={boardLocked() || readOnlyView()} onClick={() => void loadSchemaSourceFile(true)}>Load SQL or JSON file</button><small>Changes redraw the linked cards on the canvas.</small></div>
                <textarea ref={element => { schemaPanelTextarea = element; }} class="schema-side-input" aria-label="Edit selected schema source" aria-invalid={!!schemaError()} spellcheck={false} rows="12" disabled={boardLocked() || readOnlyView()} value={schemaInput()} onInput={event => scheduleSchemaVisualUpdate(event.currentTarget.value)} onBlur={flushSchemaVisualUpdate} onKeyDown={event => { if (event.key === "Tab") indentTextarea(event, scheduleSchemaVisualUpdate); }} />
                <Show when={schemaError()}><small class="schema-editor-error" role="alert">{schemaError()}</small></Show>
                <label class="schema-editor-font">Card font size<input type="number" min="8" max="48" step="1" value={table().fontSize ?? 12} disabled={boardLocked() || !!table().locked} onChange={event => updateProperty("fontSize", Math.round(Number(event.currentTarget.value)))} /></label>
              </div>}</Show>
              <Show when={!selectedSchemaTable() && workspaceArea() !== "design"}>
              <div class="quick-style-panel">
                <div class="quick-style-heading"><button onClick={toggleQuickProperties} title={isCompactTouchLayout() && !isWindowsPlatform() ? mobileQuickPropertiesOpen() ? "Close quick properties" : "Open quick properties" : styleMenuMode() === "full" ? "Close properties" : "Open properties"} aria-label={isCompactTouchLayout() && !isWindowsPlatform() ? mobileQuickPropertiesOpen() ? "Close quick properties" : "Open quick properties" : styleMenuMode() === "full" ? "Close properties" : "Open properties"} aria-expanded={isCompactTouchLayout() && !isWindowsPlatform() ? mobileQuickPropertiesOpen() : styleMenuMode() === "full"}><QuickPropertiesIcon /></button><Show when={!isWindowsPlatform()}><button class="mobile-advanced-properties" aria-expanded={styleMenuMode() === "full"} onClick={openAdvancedProperties} title="Open advanced properties" aria-label="Open advanced properties"><AdvancedPropertiesIcon /></button></Show></div>
                <Show when={sidebarTab() === "properties"}>
                  <div class="quick-style-controls">
                    <Show when={tool() === "bucket"}>
                      <button class="quick-style-icon" onClick={() => setQuickStylePopover(quickStylePopover() === "fill" ? undefined : "fill")} aria-label="Bucket fill color" title="Fill color" aria-expanded={quickStylePopover() === "fill"}><i class="quick-color-mark" style={{ background: fillColor() }} /></button>
                    </Show>
                <Show when={tool() !== "bucket" && showStrokeControls()}>
                      <button class="quick-style-icon" onClick={() => setQuickStylePopover(quickStylePopover() === "color" ? undefined : "color")} aria-label={styleContainerSelection() ? "Group border color" : quickElementType() === "text" ? "Text color" : "Stroke color"} title={styleContainerSelection() ? "Group border color" : quickElementType() === "text" ? "Text color" : "Stroke color"} aria-expanded={quickStylePopover() === "color"}><i class="quick-color-mark" style={{ background: themeInk(selectedColor(), theme()) }} /></button>
                    </Show>
                    <Show when={tool() !== "bucket" && showThicknessControls()}>
                      <button class="quick-style-icon quick-width-icon" onClick={() => setQuickStylePopover(quickStylePopover() === "thickness" ? undefined : "thickness")} aria-label={styleContainerSelection() ? "Group border thickness" : tool() === "eraser" ? "Eraser size" : "Stroke width"} title={styleContainerSelection() ? `Group border thickness ${selectedThickness()}px` : tool() === "eraser" ? "Eraser size" : `Stroke width ${selectedThickness()}px`} aria-expanded={quickStylePopover() === "thickness"}><i style={{ height: `${Math.max(1, selectedThickness())}px`, background: themeInk(selectedColor(), theme()) }} /><small>{selectedThickness()}</small></button>
                    </Show>
                    <Show when={styleContainerSelection()}>{container => <>
                      <button type="button" class={`quick-style-icon ${container().container?.showBorder !== false ? "active" : ""}`} aria-label={container().container?.showBorder !== false ? "Hide group border" : "Show group border"} aria-pressed={container().container?.showBorder !== false} title={container().container?.showBorder !== false ? "Hide group border" : "Show group border"} disabled={boardLocked() || isElementLocked(container())} onClick={() => updateSelectedContainer(metadata => ({ ...metadata, showBorder: metadata.showBorder === false }))}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1" /></svg></button>
                      <button type="button" class={`quick-style-icon ${container().container?.showLabel !== false ? "active" : ""}`} aria-label={container().container?.showLabel !== false ? "Hide group label" : "Show group label"} aria-pressed={container().container?.showLabel !== false} title={container().container?.showLabel !== false ? "Hide group label" : "Show group label"} disabled={boardLocked() || isElementLocked(container())} onClick={() => updateSelectedContainer(metadata => ({ ...metadata, showLabel: metadata.showLabel === false }))}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M5 18l5-12 5 12m-8-4h6m2-2h5m-5 4h5" /></svg></button>
                    </>}</Show>
                    <Show when={tool() === "pen"}><button class={`quick-style-icon ${quickStylePopover() === "penInput" ? "active" : ""}`} onClick={() => setQuickStylePopover(quickStylePopover() === "penInput" ? undefined : "penInput")} aria-label="Stylus input options" title="Stylus pressure, tilt, and eraser" aria-expanded={quickStylePopover() === "penInput"}><svg viewBox="0 0 24 24"><path d="m5 19 3.5-.8L19 7.7 16.3 5 5.8 15.5 5 19Zm9.8-12 2.7 2.7M4 22h16"/></svg></button></Show>
                    <Show when={tool() === "laser"}><button class={`quick-style-icon ${quickStylePopover() === "laser" ? "active" : ""}`} onClick={() => setQuickStylePopover(quickStylePopover() === "laser" ? undefined : "laser")} aria-label="Laser pointer settings" title="Laser pointer settings" aria-expanded={quickStylePopover() === "laser"}><svg viewBox="0 0 24 24"><path d="M4 20 16 8m-5-1 6 6M15 3v2m6 4h-2M20 3l-1 1M8 3l1 1M4 9H2"/><circle cx="17" cy="7" r="2"/></svg></button></Show>
                    <Show when={quickHasShapeFill()}>
                      <button class={`quick-style-icon ${fillEnabled() || !!selectedFillColor() ? "active" : ""}`} onClick={() => setQuickStylePopover(quickStylePopover() === "fill" ? undefined : "fill")} aria-label="Shape fill" title="Shape fill" aria-expanded={quickStylePopover() === "fill"}><svg class="quick-fill-preview-icon" viewBox="0 0 24 24"><path d="M4 4h16v16H4z" style={{ fill: selectedFillColor() ?? (fillEnabled() ? fillColor() : "#ffffff") }} /><path d="M4 4h16v16H4z" /></svg></button>
                    </Show>
                    <Show when={quickIsConnector() || styleContainerSelection()}>
                      <button class="quick-style-icon" onClick={() => setQuickStylePopover(quickStylePopover() === "lineStyle" ? undefined : "lineStyle")} aria-label={styleContainerSelection() ? "Group border style" : "Line style"} title={styleContainerSelection() ? "Group border style" : "Line style"} aria-expanded={quickStylePopover() === "lineStyle"}><svg class={`line-preview ${quickCurrentLineStyle()}`} viewBox="0 0 24 24"><path d={quickCurrentLineStyle() === "double" ? "M3 9h18M3 15h18" : "M3 12h18"} /></svg></button>
                    </Show>
                    <Show when={quickIsConnector()}>
                      <Show when={!quickShapeSelection()?.straightOnly}><button class="quick-style-icon" onClick={() => setQuickStylePopover(quickStylePopover() === "route" ? undefined : "route")} aria-label="Connector route" title="Connector route" aria-expanded={quickStylePopover() === "route"}><svg viewBox="0 0 24 24"><path d={(quickRouteChoices().find(route => route.value === quickCurrentRoute()) ?? quickRouteChoices()[0]).path} /></svg></button></Show>
                    </Show>
                    <Show when={quickIsConnector()}>
                      <button class="quick-style-icon" onClick={() => setQuickStylePopover(quickStylePopover() === "heads" ? undefined : "heads")} aria-label="Connector arrowheads" title="Connector arrowheads" aria-expanded={quickStylePopover() === "heads"}><ArrowHeadIcon kind={quickArrowHead("end")} /></button>
                    </Show>
                    <Show when={quickHasText()}>
                      <div class="quick-text-size"><button aria-label="Decrease font size" title="Decrease font size" onClick={() => adjustQuickFont(-1)}>-</button><span>{quickCardFontSize()}</span><button aria-label="Increase font size" title="Increase font size" onClick={() => adjustQuickFont(1)}>+</button></div>
                      <Show when={quickHasText()}>
                      <div class="quick-text-format"><button class={(selectedText()?.bold ?? defaultBold()) ? "active" : ""} aria-label="Bold" title="Bold" onClick={() => setTextFormat("bold", !(selectedText()?.bold ?? defaultBold()))}><b>B</b></button><button class={(selectedText()?.italic ?? defaultItalic()) ? "active" : ""} aria-label="Italic" title="Italic" onClick={() => setTextFormat("italic", !(selectedText()?.italic ?? defaultItalic()))}><i>I</i></button><button class={(selectedText()?.underline ?? defaultUnderline()) ? "active" : ""} aria-label="Underline" title="Underline" onClick={() => setTextFormat("underline", !(selectedText()?.underline ?? defaultUnderline()))}><u>U</u></button><button class={`quick-font-toggle ${(selectedText()?.fontFamily ?? defaultFontFamily()) === "hand" ? "active" : ""}`} aria-label="Toggle text font family" title="Toggle text font family" onClick={() => setTextFormat("fontFamily", (selectedText()?.fontFamily ?? defaultFontFamily()) === "hand" ? "sans" : "hand")}>Aa</button></div>
                      </Show>
                    </Show>
                    <Show when={quickStylePopover() === "color" || quickStylePopover() === "fill"}>
                      <div class="quick-style-popover quick-color-popover" aria-label={quickStylePopover() === "fill" ? "Fill colors" : "Stroke colors"}>
                        <div class="quick-style-swatches">{swatches.map((swatch) => <button class={`color-swatch ${((quickStylePopover() === "fill" ? (quickHasShapeFill() ? selectedFillColor() ?? (fillEnabled() ? fillColor() : "") : fillColor()) : selectedColor()) === swatch) ? "active" : ""}`} style={{ background: swatch }} aria-label={`Choose ${swatch}`} title={swatch} onClick={() => { if (quickStylePopover() === "fill" && tool() === "bucket") setFillColor(swatch); else if (quickStylePopover() === "fill") { setFillColor(swatch); setFillEnabled(true); if (hasStyleSelection()) updateProperty("fillColor", swatch); } else updateStrokeColor(swatch); setQuickStylePopover(undefined); }} />)}
                          <label class="custom-color-swatch" title="Custom color"><input aria-label="Custom color" type="color" value={quickStylePopover() === "fill" ? fillColor() : selectedColor()} onInput={(event) => { const value = event.currentTarget.value; if (quickStylePopover() === "fill" && tool() === "bucket") setFillColor(value); else if (quickStylePopover() === "fill") { setFillColor(value); setFillEnabled(true); if (hasStyleSelection()) updateProperty("fillColor", value); } else updateStrokeColor(value); }} /></label>
                        </div>
                        <Show when={quickStylePopover() === "fill" && quickHasShapeFill()}><button class="quick-fill-toggle" onClick={() => { const enabled = !fillEnabled() && !selectedFillColor(); setFillEnabled(enabled); if (hasStyleSelection()) updateProperty("fillColor", enabled ? fillColor() : undefined); }}>{fillEnabled() || !!selectedFillColor() ? "Remove fill" : "Enable fill"}</button></Show>
                      </div>
                    </Show>
                    <Show when={quickStylePopover() === "brushes" && tool() === "pen"}>
                      <div class="quick-style-popover quick-brush-picker" role="group" aria-label="Pen and brush styles">{([ ["fine", "Pen"], ["pencil", "Pencil"], ["brush", "Soft brush"], ["marker", "Marker"], ["highlighter", "Highlighter"], ["chalk", "Chalk"] ] as const).map(([mode, label]) => <button class={brushMode() === mode ? "active" : ""} aria-pressed={brushMode() === mode} title={label} onClick={() => { setBrushMode(mode); setTool("pen"); setQuickStylePopover(undefined); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={mode === "fine" ? "m5 19 13-14M4 21h16" : mode === "pencil" ? "m5 19 11-11 3 3L8 22H5zm10-13 2-2 4 4-2 2" : mode === "brush" ? "M5 18c4 0 3-8 8-8 4 0 4 4 7 4m-15 4h14M15 5l3 3" : mode === "marker" ? "M5 18 17 6l3 3L8 21H5zm9-9 3 3" : mode === "highlighter" ? "M4 16 15 5l5 5-11 11H4zm4-2 5 5" : "M5 18 17 6m-8 12 2 2M4 21h16"}/></svg><span>{label}</span></button>)}</div>
                    </Show>
                    <Show when={quickStylePopover() === "thickness"}>
                      <div class="quick-style-popover thickness-popover" aria-label={tool() === "eraser" ? "Eraser size" : "Stroke width"}>
                        <Show when={isPenBrushThicknessTarget()} fallback={<>
                          <Show when={tool() === "eraser"} fallback={<><div class="quick-thickness-presets">{THICKNESS_PRESETS.map(([value, label]) => <button class={selectedThickness() === value ? "active" : ""} aria-label={`${label} ${value} pixels`} title={`${label}, ${value}px`} onClick={() => { updateThickness(value); setQuickStylePopover(undefined); }}><i style={{ height: `${value}px` }} /></button>)}</div><input aria-label="Custom size" type="range" min="1" max="20" step="1" value={selectedThickness()} onInput={event => updateThickness(Number(event.currentTarget.value))} /></>}>
                            <div class="quick-eraser-sizes" role="group" aria-label="Eraser size">{ERASER_SIZE_PRESETS.map(([value, label]) => <button type="button" class={selectedThickness() === value ? "active" : ""} aria-pressed={selectedThickness() === value} onClick={() => { updateThickness(value); setQuickStylePopover(undefined); }}>{label}</button>)}</div>
                          </Show>
                        </>}>
                          <Show when={thicknessPickerMode() === "presets"}>
                            <div class="quick-thickness-presets">{THICKNESS_PRESETS.map(([value, label]) => <button class={selectedThickness() === value ? "active" : ""} aria-label={`${label} ${value} pixels`} title={`${label}, ${value}px`} onClick={() => updateThickness(value)}><i style={{ height: `${value}px` }} /><small>{value}</small></button>)}</div>
                          </Show>
                          <Show when={thicknessPickerMode() === "stepper"}>
                            <ThicknessTuner value={selectedThickness()} color={themeInk(selectedColor(), theme())} onChange={updateThickness} />
                          </Show>
                        </Show>
                      </div>
                    </Show>
                    <Show when={quickStylePopover() === "penInput" && tool() === "pen"}><div class="quick-style-popover pen-input-popover" aria-label="Stylus input options"><strong>Pen options</strong><label><input type="checkbox" checked={penPressure()} onChange={event => setPenPressure(event.currentTarget.checked)} /> Pressure width</label><label><input type="checkbox" checked={penTilt()} onChange={event => setPenTilt(event.currentTarget.checked)} /> Tilt shaping</label><label><input type="checkbox" checked={penEraser()} onChange={event => setPenEraser(event.currentTarget.checked)} /> Eraser end</label><small>Uses pressure, tilt, and eraser data reported by a compatible stylus.</small></div></Show>
                    <Show when={quickStylePopover() === "laser" && tool() === "laser"}><div class="quick-style-popover laser-settings-popover" aria-label="Laser pointer settings"><strong>Laser pointer</strong><label>Thickness <output>{laserThickness()} px</output><input aria-label="Laser pointer thickness" type="range" min="1" max="24" value={laserThickness()} onInput={event => setLaserPreference("thickness", event.currentTarget.value)} /></label><label>Fade duration <output>{(laserFadeDuration() / 1000).toFixed(1)} s</output><input aria-label="Laser pointer fade duration" type="range" min="250" max="5000" step="250" value={laserFadeDuration()} onInput={event => setLaserPreference("fade", event.currentTarget.value)} /></label><div class="laser-colors" aria-label="Laser pointer colors">{["#ff3265", "#ff8a32", "#ffd52e", "#29c66f", "#28b9ef", "#8c63ff"].map(value => <button class={`color-swatch ${laserColor() === value && !laserRainbow() ? "active" : ""}`} style={{ background: value }} title={value} aria-label={`Laser color ${value}`} onClick={() => { setLaserPreference("rainbow", "false"); setLaserPreference("color", value); }} />)}<label class="custom-color-swatch" title="Custom laser color"><input type="color" aria-label="Custom laser color" value={laserColor()} onInput={event => { setLaserPreference("rainbow", "false"); setLaserPreference("color", event.currentTarget.value); }} /></label></div><label class="laser-rainbow"><input type="checkbox" checked={laserRainbow()} onChange={event => setLaserPreference("rainbow", String(event.currentTarget.checked))} /> Rainbow color</label></div></Show>
                    <Show when={quickStylePopover() === "lineStyle"}>
                      <div class="quick-style-popover quick-line-styles">{(["solid", "dashed", "dotted", "double"] as const).map(value => <button class={quickCurrentLineStyle() === value ? "active" : ""} aria-label={`${value} ${styleContainerSelection() ? "border" : "line"}`} title={`${value} ${styleContainerSelection() ? "border" : "line"}`} onClick={() => { updateQuickLineStyle(value); setQuickStylePopover(undefined); }}><svg viewBox="0 0 24 24" class={`line-preview ${value}`}><path d={value === "double" ? "M3 9h18M3 15h18" : "M3 12h18"} /></svg></button>)}</div>
                    </Show>
                    <Show when={quickStylePopover() === "route" && !quickShapeSelection()?.straightOnly}>
                      <div class="quick-style-popover quick-routes">{quickRouteChoices().map(route => <button class={quickCurrentRoute() === route.value ? "active" : ""} aria-label={route.label} title={route.label} onClick={() => { if (quickElementType() === "arrow") { if (styleTargetElement()?.type === "arrow") updateProperty("arrowRoute", route.value); else setArrowRoute(route.value as ArrowRoute); } else { if (styleTargetElement()?.type === "line") updateProperty("lineRoute", route.value); else setLineRoute(route.value as LineRoute); } setQuickStylePopover(undefined); }}><svg viewBox="0 0 24 24"><path d={route.path} /></svg></button>)}
                        <Show when={quickCurrentRoute() === "curve" && styleTargetElement() && isConnector(styleTargetElement()!)}>
                          <div class="quick-curve-point-count" role="group" aria-label="Curve control points">
                            <span>Points</span><button type="button" aria-label="Remove curve point" title="Remove a curve point" disabled={quickCurvePointCount() <= 1 || boardLocked()} onClick={() => setCurvePointCount(-1)}>-</button><output>{quickCurvePointCount()}</output><button type="button" aria-label="Add curve point" title="Add a curve point" disabled={quickCurvePointCount() >= 12 || boardLocked()} onClick={() => setCurvePointCount(1)}>+</button>
                          </div>
                        </Show>
                      </div>
                    </Show>
                    <Show when={quickStylePopover() === "heads" && quickIsConnector()}>
                      <div class="quick-style-popover quick-arrow-heads" aria-label="Connector arrowhead styles">{(["start", "end"] as const).map(end => <div><span>{end}</span><div>{ARROW_HEADS.map(({ value, label }) => <button class={quickArrowHead(end) === value ? "active" : ""} title={`${label} ${end} head`} aria-label={`${label} ${end} arrowhead`} onClick={() => setConnectorHead(end, value)}><ArrowHeadIcon kind={value} /></button>)}</div></div>)}</div>
                    </Show>
                  </div>
                </Show>
              </div>
              </Show>
              {/* Shared appearance controls stay in quick style; this inspector keeps font and object-specific settings. */}
              <Show when={workspaceArea() !== "design"}>
              <div class="full-inspector" classList={{ "connector-properties": selectedIndices().length === 1 && !!focusedElement() && isConnector(focusedElement()!) }}>

                <Show when={sidebarTab() === "properties"}>
                  <section class="pane-section inspector-properties-disclosure">
                    <button type="button" class="pane-heading inspector-properties-toggle" aria-label={inspectorPropertiesExpanded() ? "Collapse object properties" : "Expand object properties"} title={inspectorPropertiesExpanded() ? "Collapse object properties" : "Expand object properties"} aria-expanded={inspectorPropertiesExpanded()} aria-controls="inspector-properties-content" onClick={() => setInspectorPropertiesExpanded(value => !value)}>
                      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 5 5-5 5" /></svg>
                    </button>
                    <Show when={inspectorPropertiesExpanded()}><div class="inspector-properties-content" id="inspector-properties-content">
                  <Show when={focusedElement()?.type === "text"}><section class="pane-section"><div class="pane-heading">Text</div><button class="quiet-button" disabled={boardLocked() || focusedElement()?.locked} onClick={convertSelectedTextToMarkdown}>Convert to Markdown card</button></section></Show>
      <Show when={focusedElement()?.type === "schemaTable"}><section class="pane-section"><div class="pane-heading">Table schema</div><label class="property-label">Font size<input type="number" min="8" max="48" step="1" value={(focusedElement() as SchemaTableElement | undefined)?.fontSize ?? 12} onChange={event => updateProperty("fontSize", Math.round(Number(event.currentTarget.value)))} /></label></section></Show>
                <Show when={tool() === "text" || !!textDraft()?.shapeLabel || !!textDraft()?.value.trim() || !!selectedTextValue().trim() || !!selectedLabel()?.text.trim()}><section class="pane-section"><div class="pane-heading">Text formatting</div><div class="format-row"><button class={(selectedText()?.bold ?? defaultBold()) ? "active" : ""} aria-label="Bold" title="Bold" onClick={() => setTextFormat("bold", !(selectedText()?.bold ?? defaultBold()))}><b>B</b></button><button class={(selectedText()?.italic ?? defaultItalic()) ? "active" : ""} aria-label="Italic" title="Italic" onClick={() => setTextFormat("italic", !(selectedText()?.italic ?? defaultItalic()))}><i>I</i></button><button class={(selectedText()?.underline ?? defaultUnderline()) ? "active" : ""} aria-label="Underline" title="Underline" onClick={() => setTextFormat("underline", !(selectedText()?.underline ?? defaultUnderline()))}><u>U</u></button></div><label class="property-label">Font size<input type="number" min="8" max="160" step="1" value={selectedText()?.fontSize ?? defaultFontSize()} onInput={(event) => setTextFormat("fontSize", Math.round(Number(event.currentTarget.value)))} /></label><div class="property-label">Font family<div class="choice-deck font-choice-deck"><button class={(selectedText()?.fontFamily ?? defaultFontFamily()) === "sans" ? "active" : ""} title="Modern sans-serif" aria-label="Modern sans-serif font" onClick={() => setTextFormat("fontFamily", "sans")}><span class="font-sans-icon">Aa</span><small>Sans</small></button><button class={(selectedText()?.fontFamily ?? defaultFontFamily()) === "hand" ? "active" : ""} title="Handwritten" aria-label="Handwritten font" onClick={() => setTextFormat("fontFamily", "hand")}><span class="font-hand-icon">Aa</span><small>Hand</small></button><button class={(selectedText()?.fontFamily ?? defaultFontFamily()) === "serif" ? "active" : ""} title="Serif" aria-label="Serif font" onClick={() => setTextFormat("fontFamily", "serif")}><span style={{ "font-family": "Georgia,serif" }}>Aa</span><small>Serif</small></button><button class={(selectedText()?.fontFamily ?? defaultFontFamily()) === "mono" ? "active" : ""} title="Monospaced" aria-label="Monospaced font" onClick={() => setTextFormat("fontFamily", "mono")}><span style={{ "font-family": "monospace" }}>Aa</span><small>Mono</small></button><button class={(selectedText()?.fontFamily ?? defaultFontFamily()) === "rounded" ? "active" : ""} title="Rounded" aria-label="Rounded font" onClick={() => setTextFormat("fontFamily", "rounded")}><span style={{ "font-family": "'Arial Rounded MT Bold','Trebuchet MS',sans-serif" }}>Aa</span><small>Round</small></button><button class={(selectedText()?.fontFamily ?? defaultFontFamily()) === "display" ? "active" : ""} title="Display" aria-label="Display font" onClick={() => setTextFormat("fontFamily", "display")}><span style={{ "font-family": "'Arial Black',Impact,sans-serif" }}>Aa</span><small>Display</small></button></div></div><div class="property-label">Alignment<div class="choice-deck compact"><button class={(selectedText()?.textAlign ?? defaultTextAlign()) === "left" ? "active" : ""} title="Align left" aria-label="Align left" onClick={() => setTextFormat("textAlign", "left")}><svg viewBox="0 0 24 24"><path d="M4 5h16M4 10h11M4 15h16M4 20h11"/></svg></button><button class={(selectedText()?.textAlign ?? defaultTextAlign()) === "center" ? "active" : ""} title="Align center" aria-label="Align center" onClick={() => setTextFormat("textAlign", "center")}><svg viewBox="0 0 24 24"><path d="M4 5h16M7 10h10M4 15h16M7 20h10"/></svg></button><button class={(selectedText()?.textAlign ?? defaultTextAlign()) === "right" ? "active" : ""} title="Align right" aria-label="Align right" onClick={() => setTextFormat("textAlign", "right")}><svg viewBox="0 0 24 24"><path d="M4 5h16M9 10h11M4 15h16M9 20h11"/></svg></button></div></div><div class="property-label">Paragraphs<div class="choice-deck compact"><button class={(selectedText()?.listType ?? defaultListType()) === "none" ? "active" : ""} title="Plain paragraphs" aria-label="Plain paragraphs" onClick={() => setTextFormat("listType", "none")}><svg viewBox="0 0 24 24"><path d="M5 6h15M5 12h15M5 18h15"/></svg></button><button class={(selectedText()?.listType ?? defaultListType()) === "bullet" ? "active" : ""} title="Bulleted list" aria-label="Bulleted list" onClick={() => setTextFormat("listType", "bullet")}><svg viewBox="0 0 24 24"><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/><path d="M9 6h11M9 12h11M9 18h11"/></svg></button><button class={(selectedText()?.listType ?? defaultListType()) === "number" ? "active" : ""} title="Numbered list" aria-label="Numbered list" onClick={() => setTextFormat("listType", "number")}><svg viewBox="0 0 24 24"><path d="M4 5h2v3M4 8h3M4 12h3l-3 3h3M10 6h10M10 12h10M10 18h10"/></svg></button></div></div></section></Show>
                <Show when={focusedElement() && (isLabelShape(focusedElement()!) || isConnector(focusedElement()!))}><section class="pane-section"><div class="pane-heading">Shape label</div>
                  <button class="quiet-button" disabled={boardLocked() || focusedElement()?.locked} onClick={() => { const index = primarySelection(); if (index !== undefined) editShapeLabel(index); }}>Edit label</button>
                  <label class="property-label">Font color<input type="color" value={textDraft()?.shapeLabel ? textDraft()!.color : selectedLabel()?.color ?? color()} onInput={event => updateLabel("color", event.currentTarget.value)} /></label>
                  <div class="property-label">Vertical alignment<div class="choice-deck">{(["top", "middle", "bottom"] as const).map((alignment, index) => <button title={`Align ${alignment}`} aria-label={`Align ${alignment}`} class={(textDraft()?.verticalAlign ?? selectedLabel()?.verticalAlign ?? "middle") === alignment ? "active" : ""} onClick={() => updateLabel("verticalAlign", alignment)}><svg viewBox="0 0 24 24"><path d={`M3 ${index === 0 ? 4 : index === 1 ? 12 : 20}h18M8 ${6 + index * 2}v6m8-6v6`}/></svg><small>{alignment}</small></button>)}</div></div>
                  <button class={`quiet-button ${selectedText()?.textAlign === "justify" ? "active" : ""}`} onClick={() => setTextFormat("textAlign", "justify")}>Justify text</button>
                </section></Show>
                <Show when={tool() === "rectangle" || focusedElement()?.type === "rectangle"}><section class="pane-section"><div class="pane-heading">Corners</div><div class="choice-deck compact"><button class={((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "sharp" ? "active" : ""} title="Square corners" aria-label="Square corners" onClick={() => focusedElement()?.type === "rectangle" ? updateProperty("edgeStyle", "sharp") : setEdgeStyle("sharp")}><svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14"/></svg></button><button class={((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "rounded" ? "active" : ""} title="Rounded corners" aria-label="Rounded corners" onClick={() => focusedElement()?.type === "rectangle" ? updateProperty("edgeStyle", "rounded") : setEdgeStyle("rounded")}><svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="4"/></svg></button><button class={((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "pill" ? "active" : ""} title="Pill corners" aria-label="Pill corners" onClick={() => focusedElement()?.type === "rectangle" ? updateProperty("edgeStyle", "pill") : setEdgeStyle("pill")}><svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="8" rx="4"/></svg></button><button class={((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "cut" ? "active" : ""} title="Cut corners" aria-label="Cut corners" onClick={() => focusedElement()?.type === "rectangle" ? updateProperty("edgeStyle", "cut") : setEdgeStyle("cut")}><svg viewBox="0 0 24 24"><path d="m8 4h8l4 4v8l-4 4H8l-4-4V8z"/></svg></button></div><Show when={((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "rounded" || ((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "cut"}><label class="property-label">{((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "cut" ? "Corner cut" : "Corner radius"}<input type="range" min="0" max="64" value={focusedElement()?.type === "rectangle" ? (focusedElement() as ShapeElement).cornerRadius ?? 12 : cornerRadius()} onInput={event => { const radius = Number(event.currentTarget.value); setCornerRadius(radius); if (focusedElement()?.type === "rectangle") updateProperty("cornerRadius", radius); }} /><span>{focusedElement()?.type === "rectangle" ? (focusedElement() as ShapeElement).cornerRadius ?? 12 : cornerRadius()} px</span></label></Show></section></Show><Show when={focusedElement() && isConnector(focusedElement()!) && !(focusedElement() as ShapeElement | undefined)?.straightOnly}><section class="pane-section"><div class="pane-heading">Connector routing</div><label class="auto-route-toggle"><input type="checkbox" checked={!!(focusedElement() as ShapeElement).autoRoute} disabled={boardLocked() || !!focusedElement()?.locked || orthogonalConnectors()} onChange={event => setSelectedAutoRoute(event.currentTarget.checked)} /><span><strong>Route around shapes</strong><small>Drag a bend to add or move a waypoint.</small></span></label><button class="quiet-button" disabled={boardLocked()} onClick={() => void optimizeAllConnectorRoutes()}>Optimize all connector routes</button></section></Show>
                <Show when={(tool() === "arrow" || focusedElement()?.type === "arrow") && (focusedElement()?.type === "arrow" ? (focusedElement() as ShapeElement).arrowRoute : arrowRoute()) === "forked"}><section class="pane-section"><div class="pane-heading">Fork branch heads</div><div class="fork-head-config"><span>Upper branch</span><div class="choice-deck arrow-head-choices">{ARROW_HEADS.map(({ value, label }) => <button class={((focusedElement()?.type === "arrow" ? (focusedElement() as ShapeElement).forkUpper?.endHead : undefined) ?? defaultForkUpperHead()) === value ? "active" : ""} title={`${label} upper branch head`} aria-label={`${label} upper branch head`} onClick={() => focusedElement()?.type === "arrow" ? updateProperty("forkUpperHead", value) : setDefaultForkUpperHead(value)}><ArrowHeadIcon kind={value} /></button>)}</div><span>Lower branch</span><div class="choice-deck arrow-head-choices">{ARROW_HEADS.map(({ value, label }) => <button class={((focusedElement()?.type === "arrow" ? (focusedElement() as ShapeElement).forkLower?.endHead : undefined) ?? defaultForkLowerHead()) === value ? "active" : ""} title={`${label} lower branch head`} aria-label={`${label} lower branch head`} onClick={() => focusedElement()?.type === "arrow" ? updateProperty("forkLowerHead", value) : setDefaultForkLowerHead(value)}><ArrowHeadIcon kind={value} /></button>)}</div></div></section></Show>
            <Show when={focusedElement()?.type === "svgPath"}><section class="pane-section svg-path-editor"><div class="pane-heading">SVG path</div><label class="property-label">Path data<textarea rows="5" maxlength="500000" spellcheck="false" value={(focusedElement() as ShapeElement).pathData ?? ""} disabled={boardLocked() || !!focusedElement()?.locked} onChange={event => updateProperty("pathData", event.currentTarget.value)} /></label><label class="auto-route-toggle"><input type="checkbox" checked={(focusedElement() as ShapeElement).svgNonScalingStroke === true} disabled={boardLocked() || !!focusedElement()?.locked} onChange={event => updateProperty("svgNonScalingStroke", event.currentTarget.checked)} /><span><strong>Keep stroke width while zooming</strong><small>Useful for imported icon paths.</small></span></label><label class="property-label">Fill rule<select value={(focusedElement() as ShapeElement).fillRule ?? "nonzero"} disabled={boardLocked() || !!focusedElement()?.locked} onChange={event => updateProperty("fillRule", event.currentTarget.value)}><option value="nonzero">Nonzero</option><option value="evenodd">Even odd</option></select></label></section></Show><Show when={quickHasShapeFill()}><section class="pane-section"><div class="pane-heading">Fill opacity</div><label class="property-label">Opacity<input aria-label="Fill opacity" type="range" min="5" max="100" value={Math.round(selectedFillOpacity() * 100)} disabled={boardLocked()} onInput={event => { const value = Number(event.currentTarget.value) / 100; setFillOpacity(value); if (selectedIndices().length) updateProperty("fillOpacity", value); }} /><span>{Math.round(selectedFillOpacity() * 100)}%</span></label></section></Show><Show when={selectedIndices().length > 1}><section class="pane-section"><div class="pane-heading">Align & distribute</div><div class="alignment-grid">{(["left", "center", "right", "top", "middle", "bottom", "horizontal", "vertical"] as const).map(command => <button disabled={boardLocked() || ((command === "horizontal" || command === "vertical") && selectedIndices().length < 3)} title={command === "horizontal" || command === "vertical" ? `Distribute ${command} gaps` : `Align ${command}`} onClick={() => alignSelection(command)}>{command}</button>)}</div></section></Show>

                <Show when={selectedIndices().length > 1 && !groupSelected()}><div class="multi-selection-actions"><button class="pane-group-button" onClick={groupSelection}>Group {selectedIndices().length} elements <kbd>Ctrl+G</kbd></button><button class="pane-group-button" disabled={boardLocked() || readOnlyView()} onClick={createFrameFromSelection}>Create frame</button></div></Show>
                <Show when={focusedElement()?.type === "freehand" && recognizeStroke(focusedElement() as FreehandElement)}>{recognized => <section class="pane-section stroke-cleanup-tools"><div class="pane-heading">Stroke cleanup</div><p>This stroke is close to {recognized().type === "circle" ? "an ellipse" : `a ${recognized().type}`}.</p><button class="quiet-button" type="button" disabled={boardLocked() || !!(focusedElement() as FreehandElement | undefined)?.locked} onClick={convertSelectedStrokeToRectangle}>Convert to {recognized().type === "circle" ? "ellipse" : recognized().type}</button></section>}</Show>
                <Show when={focusedElement()?.type === "freehand" || focusedElement()?.type === "svgPath"}><section class="pane-section path-node-tools"><div class="pane-heading">Path editing</div><button class={`quiet-button ${pathNodeEditMode() ? "active" : ""}`} type="button" aria-pressed={pathNodeEditMode()} disabled={boardLocked() || !!focusedElement()?.locked || focusedElement()?.type === "svgPath" && !parseEditablePath((focusedElement() as ShapeElement | undefined)?.pathData)} onClick={() => { setPathNodeEditMode(value => !value); setSelectedPathNodeIndex(undefined); }}>{pathNodeEditMode() ? "Done editing nodes" : focusedElement()?.type === "freehand" ? "Edit stroke points" : "Edit path nodes"}</button><Show when={pathNodeEditMode() && selectedPathNodeIndex() !== undefined}><button class="quiet-button" type="button" disabled={boardLocked()} onClick={deleteSelectedPathNode}>Delete selected node</button></Show><Show when={focusedElement()?.type === "svgPath" && !parseEditablePath((focusedElement() as ShapeElement | undefined)?.pathData)}><small>Node editing supports simple paths made from move, line, and close commands.</small></Show></section></Show>
                <Show when={connectorTouchesBpmn(focusedElement())}><section class="pane-section bpmn-flow-properties"><div class="pane-heading">BPMN sequence flow</div><label class="property-label">Condition<input maxlength="500" placeholder="e.g. approved = true" value={(focusedElement() as ShapeElement).sequenceCondition ?? ""} disabled={boardLocked() || !!focusedElement()?.locked || (focusedElement() as ShapeElement).sequenceDefault} onChange={event => updateBpmnSequenceField("sequenceCondition", event.currentTarget.value)} /></label><label class="component-state-control"><input type="checkbox" checked={!!(focusedElement() as ShapeElement).sequenceDefault} disabled={boardLocked() || !!focusedElement()?.locked} onChange={event => updateBpmnSequenceField("sequenceDefault", event.currentTarget.checked)} /><span class="component-switch" aria-hidden="true" /><strong>Default path</strong></label><small>Use one default path when an exclusive gateway has multiple outgoing flows.</small></section></Show>
                    </div></Show>
                  </section>
                </Show>

              </div></Show>
            </aside></Show>
            <Show when={noteEditor() || selectedNoteCard() || libraryComponentDraft() || selectedLibraryComponent() || selectedClassComponentId() || classCardDraft() || primarySelection() !== undefined}>
              <aside class="component-editor-dock" classList={{ collapsed: componentEditorCollapsed(), "note-editor-dock": !!(noteEditor() || selectedNoteCard()) }} aria-label={noteEditor() || selectedNoteCard() ? "Note editor" : primarySelection() !== undefined && !selectedLibraryComponent() && !selectedClassComponentId() && !libraryComponentDraft() && !classCardDraft() ? "Object details" : "Component editor"}>
                <Show when={componentEditorCollapsed()} fallback={<>
                  <header class="component-editor-heading" classList={{ "note-editor-heading": !!(noteEditor() || selectedNoteCard()) }}>
                    <strong>{noteEditor() || selectedNoteCard() ? notePanelTitle() : componentEditorTitle()}</strong>
                    <Show when={noteEditor()}><button type="button" class="note-editor-action" title="Discard note" aria-label="Discard note" onClick={() => setNoteEditor(undefined)}>&times;</button></Show>
                    <Show when={noteEditor()}><button type="button" class="note-editor-action" title="Add to canvas" aria-label="Add to canvas" onClick={saveNoteEditor}>Add</button></Show>
                    <Show when={!noteEditor() && selectedNoteCard()}>{card => <button type="button" class="note-editor-action" title={card().note?.collapsed ? "Expand card" : "Collapse card"} aria-label={card().note?.collapsed ? "Expand card" : "Collapse card"} disabled={boardLocked() || card().locked} onClick={() => { const index = primarySelection(); if (index !== undefined) toggleNoteCollapsed(index); }}><svg viewBox="0 0 16 16" aria-hidden="true"><path d={card().note?.collapsed ? "m3 6 5 5 5-5" : "m3 10 5-5 5 5"} /></svg></button>}</Show>
                    <button type="button" class="note-editor-action dock-collapse-action" aria-label="Collapse editor panel" title="Collapse panel" aria-expanded="true" onClick={() => setComponentEditorCollapsed(true)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 4-6 6 6 6" /></svg></button>
                  </header>
                  <div class="component-editor-scroll">

                <Show when={selectedGeometryBounds() || selectedIndices().length === 1 && !!focusedElement() && isConnector(focusedElement()!)}>
                  <section class="pane-section geometry-properties">
                    <div class="pane-heading">Position &amp; size</div>
                    <Show when={selectedGeometryBounds()}>{bounds => <div class="geometry-property-grid">
                      <label>X<input aria-label="Position X" type="number" step="0.1" value={Math.round(bounds().x * 10) / 10} disabled={boardLocked() || !!selectedGeometryElement()?.locked} onChange={event => precision("x", Number(event.currentTarget.value))} /></label>
                      <label>Y<input aria-label="Position Y" type="number" step="0.1" value={Math.round(bounds().y * 10) / 10} disabled={boardLocked() || !!selectedGeometryElement()?.locked} onChange={event => precision("y", Number(event.currentTarget.value))} /></label>
                      <Show when={selectedGeometryCanResize()}><label>Width<input aria-label="Object width" type="number" min={selectedGeometryMin("w")} max="4000" step="0.1" value={Math.round(bounds().w * 10) / 10} disabled={boardLocked() || !!selectedGeometryElement()?.locked} onChange={event => precision("w", Number(event.currentTarget.value))} /></label><label>Height<input aria-label="Object height" type="number" min={selectedGeometryMin("h")} max="4000" step="0.1" value={Math.round(bounds().h * 10) / 10} disabled={boardLocked() || !!selectedGeometryElement()?.locked} onChange={event => precision("h", Number(event.currentTarget.value))} /></label></Show>
                      <Show when={selectedAspectLockSupported()}><label class="component-state-control geometry-aspect-lock"><input type="checkbox" checked={!!selectedGeometryElement()?.aspectLocked} disabled={boardLocked() || !!selectedGeometryElement()?.locked} onChange={event => changeSelected(item => ({ ...item, aspectLocked: event.currentTarget.checked || undefined }))} /><span class="component-switch" aria-hidden="true" /><strong>Lock aspect ratio</strong></label></Show>
                      <Show when={selectedLifelineGroup()}>{lifeline => <label>Length<input aria-label="Lifeline length" type="number" min="24" max="4000" step="1" value={libraryLifelineLength(lifeline())} disabled={boardLocked() || !!lifeline().locked} onChange={event => changeSelected(item => item.type === "group" ? setLibraryLifelineLength(item, Number(event.currentTarget.value)) : item)} /></label>}</Show>
                      <Show when={selectedGeometryCanRotate()}><label>Rotation<input aria-label="Rotation degrees" type="number" step="1" value={Math.round((selectedGeometryElement()?.rotation ?? 0) * 10) / 10} disabled={boardLocked() || !!selectedGeometryElement()?.locked} onChange={event => precision("rotation", Number(event.currentTarget.value))} /></label></Show>
                    </div>}</Show>
                    <Show when={focusedElement() && isConnector(focusedElement()!)}>
                      <div class="geometry-property-grid connector-position-grid">
                        <label>X<input aria-label="Connector position X" type="number" step="0.1" value={Math.round(Math.min((focusedElement() as ShapeElement).x, (focusedElement() as ShapeElement).x + (focusedElement() as ShapeElement).w) * 10) / 10} disabled={boardLocked() || !!focusedElement()?.locked} onChange={event => setConnectorBoundsPosition("x", Number(event.currentTarget.value))} /></label>
                        <label>Y<input aria-label="Connector position Y" type="number" step="0.1" value={Math.round(Math.min((focusedElement() as ShapeElement).y, (focusedElement() as ShapeElement).y + (focusedElement() as ShapeElement).h) * 10) / 10} disabled={boardLocked() || !!focusedElement()?.locked} onChange={event => setConnectorBoundsPosition("y", Number(event.currentTarget.value))} /></label>
                      </div>
                      <Show when={connectorIsStraight(focusedElement())}>
                        <div class="geometry-property-grid connector-dimension-grid">
                          <label>Width<input aria-label="Connector width" type="number" min="0" max="1000000" step="0.1" value={Math.round(Math.abs((focusedElement() as ShapeElement).w) * 10) / 10} disabled={boardLocked() || !!focusedElement()?.locked} onChange={event => { const item = focusedElement() as ShapeElement; const width = Number(event.currentTarget.value); setEndpoint("end", "x", item.x + Math.sign(item.w || 1) * width); }} /></label>
                          <label>Height<input aria-label="Connector height" type="number" min="0" max="1000000" step="0.1" value={Math.round(Math.abs((focusedElement() as ShapeElement).h) * 10) / 10} disabled={boardLocked() || !!focusedElement()?.locked} onChange={event => { const item = focusedElement() as ShapeElement; const height = Number(event.currentTarget.value); setEndpoint("end", "y", item.y + Math.sign(item.h || 1) * height); }} /></label>
                          <label>Length<input aria-label="Connector length" type="number" min="25" max="1000000" step="0.1" value={Math.round(Math.hypot((focusedElement() as ShapeElement).w, (focusedElement() as ShapeElement).h) * 10) / 10} disabled={boardLocked() || !!focusedElement()?.locked} onChange={event => setStraightConnectorLength(Number(event.currentTarget.value))} /></label>
                        </div>
                      </Show>
                      <div class="geometry-property-grid">{(["start", "end"] as const).flatMap(end => (["x", "y"] as const).map(axis => <label>{end} {axis.toUpperCase()}<input type="number" step="0.1" disabled={boardLocked() || focusedElement()?.locked} value={Math.round(((focusedElement() as ShapeElement)[axis] + (end === "end" ? (focusedElement() as ShapeElement)[axis === "x" ? "w" : "h"] : 0)) * 10) / 10} onChange={event => setEndpoint(end, axis, Number(event.currentTarget.value))} /></label>))}</div>
                      <Show when={focusedElement()?.type === "arrow" && (focusedElement() as ShapeElement).arrowRoute === "forked"}><div class="geometry-property-grid">{(["upper", "lower"] as const).flatMap(branch => (["x", "y"] as const).map(axis => <label>{branch} {axis.toUpperCase()}<input type="number" step="0.1" disabled={boardLocked() || focusedElement()?.locked} value={Math.round(forkGeometry(focusedElement() as ShapeElement)[branch][axis] * 10) / 10} onChange={event => setForkEndpoint(branch, axis, Number(event.currentTarget.value))} /></label>))}</div></Show>
                      <button class="quiet-button" disabled={boardLocked() || !!focusedElement()?.locked} onClick={() => changeSelected(item => isConnector(item) ? { ...item, startBinding: undefined, endBinding: undefined, forkUpper: item.forkUpper ? { ...item.forkUpper, endBinding: undefined } : undefined, forkLower: item.forkLower ? { ...item.forkLower, endBinding: undefined } : undefined } : item)}>Detach endpoints</button>
                      <Show when={!(focusedElement() as ShapeElement | undefined)?.straightOnly}><button class="quiet-button" disabled={boardLocked() || !!focusedElement()?.locked} onClick={() => changeSelected(item => isConnector(item) ? { ...item, routePoints: undefined, routeWaypoints: item.autoRoute ? [] : undefined, forkUpper: item.forkUpper ? { ...item.forkUpper, routePoints: undefined } : undefined, forkLower: item.forkLower ? { ...item.forkLower, routePoints: undefined } : undefined } : item)}>Reset route</button></Show>
                    </Show>
                  </section>
                </Show>

                <Show when={selectedDiagramCodeGroup()}>{group => <details class="pane-section component-navigation-details inspector-advanced-section diagram-source-disclosure">
                  <summary><span>Diagram as code</span></summary>
                  <section class="component-editor-content diagram-source-editor">
                  <div class="pane-heading">Diagram as code</div>
                  <small>{group().mermaid?.format === "plantuml" ? "PlantUML class and object subset" : /^\s*sequenceDiagram\b/im.test(diagramSourceDraft()) ? "Mermaid sequence diagram" : "Mermaid flowchart"}</small>
                  <textarea aria-label="Diagram source" spellcheck="false" rows="9" value={diagramSourceDraft()} onInput={event => { setDiagramSourceDraft(event.currentTarget.value); setDiagramSourceMessage(""); }} />
                  <div class="container-structure-actions">
                    <button class="quiet-button" type="button" onClick={() => setDiagramSourcePreviewOpen(value => !value)}>{diagramSourcePreviewOpen() ? "Hide preview" : "Preview"}</button>
                    <button class="quiet-button" type="button" disabled={boardLocked()} onClick={editSelectedDiagramSource}>Generate / Replace…</button>
                    <button class="quiet-button" type="button" disabled={boardLocked()} onClick={updateSelectedDiagramSourceFromCanvas}>Update source from canvas</button>
                    <button class="quiet-button" type="button" onClick={() => void copySelectedDiagramSource()}>Copy source</button>
                  </div>
                  <Show when={diagramSourcePreviewOpen()}>
                    <Show when={group().mermaid?.format !== "plantuml"} fallback={<pre class="diagram-source-preview">{diagramSourceDraft()}</pre>}><MermaidPreview source={diagramSourceDraft()} /></Show>
                  </Show>
                  <Show when={diagramSourceMessage()}><small role="status">{diagramSourceMessage()}</small></Show>
                  </section>
                </details>}</Show>
                <Show when={primarySelection() !== undefined}>
                  <Show when={selectedRootElement()?.type === "group" && !!(selectedRootElement() as GroupElement).libraryComponent?.kind.startsWith("viz-")}><section class="component-editor-content chart-data-actions"><div class="pane-heading">Chart data</div><button class="quiet-button" type="button" disabled={boardLocked()} onClick={() => { const chart = selectedRootElement(); if (chart?.type === "group" && chart.id) openCsvChartDialog(chart.id); }}>Edit chart from CSV…</button></section></Show>
                  <Show when={selectedIndices().length > 0 && !selectedContainer()}><section class="component-editor-content structure-container-editor"><div class="pane-heading">Structure</div><button class="quiet-button" type="button" disabled={boardLocked() || readOnlyView()} onClick={createFrameFromSelection}>Create frame from selection</button></section></Show>
                  <Show when={selectedContainer()}><section class="component-editor-content structure-container-editor"><div class="pane-heading">{selectedRootElement()?.type === "group" ? selectedContainer()?.container?.kind === "frame" ? "Frame" : "Container" : "Structure"}</div><label class="property-label">Name<input maxlength="120" value={selectedRootElement()?.type === "group" ? selectedContainer()?.container?.name ?? "" : ""} disabled={boardLocked() || isElementLocked(selectedRootElement()!)} onChange={event => updateSelectedContainer(container => ({ ...container, name: event.currentTarget.value.trim().slice(0, 120) || container.name }))} /></label><label class="property-label">Background<div class="container-background-control"><input aria-label="Container background" type="color" value={selectedContainer()?.container?.background ?? "#ffffff"} disabled={boardLocked() || isElementLocked(selectedRootElement()!)} onInput={event => updateSelectedContainer(container => ({ ...container, background: event.currentTarget.value }))} /><button class="quiet-button" type="button" disabled={boardLocked() || !selectedContainer()?.container?.background} onClick={() => updateSelectedContainer(container => ({ ...container, background: undefined }))}>Clear</button></div></label><Show when={selectedRootElement()?.type === "group" && selectedContainer()?.container?.kind === "frame"}><div class="container-structure-actions"><button class="quiet-button" type="button" disabled={boardLocked() || isElementLocked(selectedRootElement()!)} onClick={fitSelectedContainer}>Fit to content</button><button class="quiet-button" type="button" disabled={boardLocked()} onClick={() => reorderSelectedFrame(-1)}>Move frame backward</button><button class="quiet-button" type="button" disabled={boardLocked()} onClick={() => reorderSelectedFrame(1)}>Move frame forward</button></div></Show><label class="component-state-control"><input type="checkbox" checked={selectedRootElement()?.type === "group" && selectedContainer()?.container?.clipChildren === true} disabled={boardLocked() || isElementLocked(selectedRootElement()!)} onChange={event => updateSelectedContainer(container => ({ ...container, clipChildren: event.currentTarget.checked }))} /><span class="component-switch" aria-hidden="true"/><strong>Clip children</strong></label><label class="component-state-control"><input type="checkbox" checked={selectedRootElement()?.type === "group" && selectedContainer()?.container?.autoResize === true} disabled={boardLocked() || isElementLocked(selectedRootElement()!)} onChange={event => updateSelectedContainer(container => ({ ...container, autoResize: event.currentTarget.checked }))} /><span class="component-switch" aria-hidden="true"/><strong>Auto-resize to children</strong></label><label class="component-state-control"><input type="checkbox" checked={selectedRootElement()?.type === "group" && selectedContainer()?.container?.lockedSize === true} disabled={boardLocked() || isElementLocked(selectedRootElement()!)} onChange={event => updateSelectedContainer(container => ({ ...container, lockedSize: event.currentTarget.checked }))} /><span class="component-switch" aria-hidden="true"/><strong>Lock size</strong></label><div class="container-structure-actions"><Show when={selectedIndices().length > 1}><button class="quiet-button" type="button" disabled={boardLocked()} onClick={moveSelectionIntoSelectedContainer}>Move selection into container</button></Show><button class="quiet-button" type="button" disabled={boardLocked()} onClick={removeSelectedContainer}>Remove container</button></div></section></Show>
                  <Show when={selectedParameterizedStencil()}>{stencil => <section class="component-editor-content stencil-parameter-editor"><div class="pane-heading">Stencil fields</div><p>Edit named fields while keeping this grouped component intact.</p>{stencil().stencilParameters?.parameters.map(parameter => <label class="property-label">{parameter}<input maxlength="500" value={stencil().stencilParameters?.values[parameter.toLowerCase()] ?? ""} disabled={boardLocked() || !!stencil().locked} onChange={event => editSelectedStencilParameter(parameter, event.currentTarget.value)} /></label>)}</section>}</Show>
                  <Show when={selectedComponentMaster()}>{master => { const instance = () => selectedMasterInstance(); const overrides = () => instance()?.componentOverrides ?? {}; const variants = () => Object.keys(master().variants ?? {}); const instanceCount = () => componentMasterInstanceCount(master().id); const chartDefaults = () => flatten(master().template).find((item): item is GroupElement => item.type === "group" && !!item.libraryComponent?.chartData)?.libraryComponent?.chartData; const formDefaults = () => flatten(master().template).find((item): item is GroupElement => item.type === "group" && !!item.libraryComponent?.formOptions)?.libraryComponent?.formOptions; return <details class="pane-section component-navigation-details inspector-advanced-section"><summary><span>Component master and instance</span><small>{instanceCount()} instance{instanceCount() === 1 ? "" : "s"}</small></summary><section class="component-editor-content component-master-editor"><div class="pane-heading">Component master <small>{instanceCount()} instance{instanceCount() === 1 ? "" : "s"}</small></div><label class="property-label">Master name<input maxlength="80" value={master().name} disabled={boardLocked()} onChange={event => updateComponentMaster(master().id, current => ({ ...current, name: event.currentTarget.value.trim().slice(0, 80) || current.name }))} /></label><label class="property-label">Default label<input maxlength="240" value={componentPrimaryLabel(master().template)} disabled={boardLocked()} onChange={event => updateMasterDefaultLabel(master().id, event.currentTarget.value)} /></label><div class="component-port-preview" role="img" aria-label={`${master().connectionPoints?.length ?? 0} component connection points`}>{master().connectionPoints?.map(port => <span title={port.name} style={{ left: `${port.anchor.x * 100}%`, top: `${port.anchor.y * 100}%` }} />)}</div><label class="component-state-control"><input type="checkbox" checked={overrides().label !== undefined} disabled={boardLocked()} onChange={event => updateInstanceOverride("label", event.currentTarget.checked ? componentPrimaryLabel(master().template) : undefined)} /><span class="component-switch" aria-hidden="true"/><strong>Override this instance label</strong></label><Show when={overrides().label !== undefined}><label class="property-label">Instance label<input maxlength="240" value={overrides().label ?? ""} disabled={boardLocked()} onChange={event => updateInstanceOverride("label", event.currentTarget.value)} /></label></Show><label class="property-label">Instance color override<input type="color" value={overrides().color ?? "#566579"} disabled={boardLocked()} onInput={event => updateInstanceOverride("color", event.currentTarget.value)} /></label><button class="quiet-button" type="button" disabled={boardLocked() || !overrides().color} onClick={() => updateInstanceOverride("color", undefined)}>Clear color override</button><label class="property-label">Instance fill override<input type="color" value={overrides().fillColor ?? "#ffffff"} disabled={boardLocked()} onInput={event => updateInstanceOverride("fillColor", event.currentTarget.value)} /></label><button class="quiet-button" type="button" disabled={boardLocked() || overrides().fillColor === undefined} onClick={() => updateInstanceOverride("fillColor", undefined)}>Clear fill override</button><Show when={chartDefaults()}><label class="property-label">Chart data override<textarea rows="5" spellcheck="false" value={JSON.stringify(overrides().chartData ?? chartDefaults(), null, 2)} disabled={boardLocked()} onChange={event => { try { const parsed = JSON.parse(event.currentTarget.value) as ComponentOverrides["chartData"]; if (parsed && Array.isArray(parsed.labels) && Array.isArray(parsed.values)) updateInstanceOverride("chartData", parsed); } catch { setError("Chart data override must be valid JSON with labels and values arrays."); } }} /></label><button class="quiet-button" type="button" disabled={boardLocked() || !overrides().chartData} onClick={() => updateInstanceOverride("chartData", undefined)}>Clear chart data override</button></Show><Show when={formDefaults()}><label class="property-label">Form options override<input value={(overrides().formOptions ?? formDefaults() ?? []).join(", ")} disabled={boardLocked()} onChange={event => updateInstanceOverride("formOptions", event.currentTarget.value.split(",").map(value => value.trim()).filter(Boolean).slice(0, 32))} /></label></Show><Show when={master().connectionPoints?.length}><div class="pane-heading">Port label overrides</div>{master().connectionPoints?.map(port => <label class="property-label">{port.name}<input value={overrides().portLabels?.[port.id] ?? port.name} disabled={boardLocked()} onChange={event => updateInstanceOverride("portLabels", { ...overrides().portLabels, [port.id]: event.currentTarget.value.slice(0, 80) })} /></label>)}</Show><Show when={variants().length > 0}><label class="property-label">Variant<select value={instance()?.variantKey ?? "default"} disabled={boardLocked()} onChange={event => switchSelectedMasterVariant(event.currentTarget.value === "default" ? "" : event.currentTarget.value)}><option value="default">Default</option>{variants().map(key => <option value={key}>{key}</option>)}</select></label></Show><div class="container-structure-actions"><button class="quiet-button" type="button" disabled={boardLocked()} onClick={saveSelectedMasterVariant}>Save current as variant…</button><button class="quiet-button" type="button" disabled={boardLocked()} onClick={updateSelectedMasterFromInstance}>Use this instance as the master default</button><button class="quiet-button" type="button" disabled={boardLocked()} onClick={detachSelectedMasterInstance}>Detach instance</button></div></section></details>; }}</Show>
                  <Show when={focusedElement() && isConnector(focusedElement()!)}><details class="pane-section relationship-properties"><summary class="pane-heading">Connection</summary><div class="property-label">Relationship type<div class="choice-deck relationship-type-choices">{RELATIONSHIP_TYPES.map(type => <button type="button" class={(focusedElement() as ShapeElement).relationshipType === type.value ? "active" : ""} aria-pressed={(focusedElement() as ShapeElement).relationshipType === type.value} disabled={boardLocked() || !!focusedElement()?.locked} onClick={() => updateConnectorMetadata("relationshipType", type.value)}>{type.label}</button>)}</div></div><label class="property-label">Cardinality<input maxlength="24" placeholder="1, 0..*, etc." value={(focusedElement() as ShapeElement).cardinality ?? ""} disabled={boardLocked() || !!focusedElement()?.locked} onChange={event => updateConnectorMetadata("cardinality", event.currentTarget.value)} /></label><div class="property-label">Direction<div class="choice-deck compact">{([{ value: "forward", label: "Forward" }, { value: "both", label: "Both" }, { value: "none", label: "None" }] as const).map(direction => <button type="button" class={(focusedElement() as ShapeElement).relationshipDirection === direction.value || !(focusedElement() as ShapeElement).relationshipDirection && direction.value === "forward" ? "active" : ""} aria-pressed={(focusedElement() as ShapeElement).relationshipDirection === direction.value} disabled={boardLocked() || !!focusedElement()?.locked} onClick={() => updateConnectorMetadata("relationshipDirection", direction.value)}>{direction.label}</button>)}</div></div><label class="property-label">Protocol<input maxlength="48" placeholder="HTTPS, gRPC, SQL" value={(focusedElement() as ShapeElement).protocol ?? ""} disabled={boardLocked() || !!focusedElement()?.locked} onChange={event => updateConnectorMetadata("protocol", event.currentTarget.value)} /></label><label class="property-label">Port number<input type="number" min="1" max="65535" placeholder="443" value={(focusedElement() as ShapeElement).portNumber ?? ""} disabled={boardLocked() || !!focusedElement()?.locked} onChange={event => updateConnectorContract("portNumber", event.currentTarget.value)} /></label><div class="property-label">Transport security<div class="choice-deck compact">{([{ value: "unknown", label: "Unknown" }, { value: "encrypted", label: "Encrypted" }, { value: "unencrypted", label: "Unencrypted" }] as const).map(option => <button type="button" class={(focusedElement() as ShapeElement).transportSecurity === option.value || !(focusedElement() as ShapeElement).transportSecurity && option.value === "unknown" ? "active" : ""} aria-pressed={(focusedElement() as ShapeElement).transportSecurity === option.value} disabled={boardLocked() || !!focusedElement()?.locked} onClick={() => updateConnectorMetadata("transportSecurity", option.value)}>{option.label}</button>)}</div></div><label class="property-label">API contract<input maxlength="2000" placeholder="Endpoint or operation" value={(focusedElement() as ShapeElement).apiContract ?? ""} disabled={boardLocked() || !!focusedElement()?.locked} onChange={event => updateConnectorContract("apiContract", event.currentTarget.value)} /></label><label class="property-label">Data contract<input maxlength="2000" placeholder="Schema, topic, or payload" value={(focusedElement() as ShapeElement).dataContract ?? ""} disabled={boardLocked() || !!focusedElement()?.locked} onChange={event => updateConnectorContract("dataContract", event.currentTarget.value)} /></label></details></Show>
                </Show>
                    <Show when={noteEditor()}>{draft => {
                      const tableBlock = () => draft().kind === "note" ? findMarkdownTableBlock(draft().content) : undefined;
                      return <section class="note-editor-fields" aria-label={notePanelTitle()} onPointerDown={event => event.stopPropagation()}>
                        <Show when={tableBlock()}>{table => <details class="note-editor-table" open><summary>Markdown table</summary><div class="note-editor-table-boundary"><textarea ref={element => { noteEditorTextarea = element; }} aria-label="Markdown table" maxlength="50000" value={table().text} onBlur={event => setNoteEditor(current => current ? { ...current, content: replaceMarkdownTableBlock(current.content, table(), event.currentTarget.value) } : current)} onKeyDown={event => { event.stopPropagation(); if (event.key === "Tab") indentTextarea(event, value => setNoteEditor(current => current ? { ...current, content: replaceMarkdownTableBlock(current.content, table(), value) } : current)); if ((event.key === "Enter" && (event.ctrlKey || event.metaKey)) || event.key === "Escape") { event.preventDefault(); saveNoteEditor(); } }} /></div></details>}</Show>
                        <Show when={!tableBlock()}>
                          <label class="note-editor-label">Title<input ref={element => { noteEditorTitleInput = element; }} aria-label="Card title" maxlength="120" value={draft().title} onChange={event => setNoteEditor(current => current ? { ...current, title: event.currentTarget.value } : current)} /></label>
                          <label class="note-editor-label"><span>Content<Show when={draft().kind === "note"}><button type="button" class="note-editor-inline-action" onMouseDown={event => event.preventDefault()} onClick={insertMarkdownTable}>Insert table</button></Show></span><textarea ref={element => { noteEditorTextarea = element; }} aria-label={draft().kind === "checklist" ? "Checklist items" : draft().kind === "sticky" ? "Sticky note text" : "Markdown text and code"} maxlength="50000" value={draft().content} placeholder={draft().kind === "checklist" ? "- [ ] First task" : draft().kind === "sticky" ? "Write a short note" : "Write Markdown or fenced code"} onBlur={event => setNoteEditor(current => current ? { ...current, content: event.currentTarget.value } : current)} onKeyDown={event => { event.stopPropagation(); if (event.key === "Tab") { indentTextarea(event, value => setNoteEditor(current => current ? { ...current, content: value } : current)); return; } if ((event.key === "Enter" && (event.ctrlKey || event.metaKey)) || event.key === "Escape") { event.preventDefault(); saveNoteEditor(); } }} /></label>
                        </Show>
                        <Show when={!tableBlock()}><label class="note-editor-size">Text size<input aria-label="Note text size" type="number" min="8" max="32" step="1" value={draft().fontSize} onChange={event => { const size = Math.max(8, Math.min(32, Math.round(Number(event.currentTarget.value) || 12))); rememberFontSize(size); setNoteEditor(current => current ? { ...current, fontSize: size } : current); }} /></label></Show>
                      </section>;
                    }}</Show>
                    <Show when={!noteEditor() && selectedNoteCard()}>{card => {
                      const note = () => card().note!;
                      const tableBlock = () => note().kind === "note" ? findMarkdownTableBlock(note().content) : undefined;
                      return <section class="note-editor-fields" aria-label={notePanelTitle()} onPointerDown={event => event.stopPropagation()}>
                        <Show when={tableBlock()}>{table => <details class="note-editor-table" open><summary>Markdown table</summary><div class="note-editor-table-boundary"><textarea aria-label="Markdown table" value={table().text} disabled={boardLocked() || card().locked} onChange={event => updateSelectedNoteCard({ content: replaceMarkdownTableBlock(note().content, table(), event.currentTarget.value) })} /></div></details>}</Show>
                        <Show when={!tableBlock()}>
                          <label class="note-editor-label">Title<input aria-label="Card title" maxlength="120" value={note().title ?? defaultNoteTitle(note().kind)} disabled={boardLocked() || card().locked} onChange={event => updateSelectedNoteCard({ title: event.currentTarget.value })} /></label>
                          <label class="note-editor-label">{note().kind === "checklist" ? "Tasks" : note().kind === "sticky" ? "Text" : "Content"}<textarea aria-label={note().kind === "checklist" ? "Checklist items" : note().kind === "sticky" ? "Sticky note text" : "Markdown text and code"} value={note().content} placeholder={note().kind === "checklist" ? "- [ ] First task" : note().kind === "sticky" ? "Write a short note" : "Write Markdown or fenced code"} disabled={boardLocked() || card().locked} onChange={event => updateSelectedNoteCard({ content: event.currentTarget.value })} onKeyDown={event => { if (event.key === "Tab") indentTextarea(event, value => updateSelectedNoteCard({ content: value })); }} /></label>
                        </Show>
                        <Show when={!tableBlock()}><label class="note-editor-size">Text size<input aria-label="Note text size" type="number" min="8" max="32" step="1" value={note().fontSize ?? 12} disabled={boardLocked() || card().locked} onChange={event => setSelectedNoteFontSize(Number(event.currentTarget.value))} /></label></Show>
                        <Show when={note().kind === "note" && !tableBlock()}><button type="button" class="note-editor-inline-action note-editor-convert" disabled={boardLocked() || card().locked} onClick={convertSelectedMarkdownToText}>Convert to plain text</button></Show>
                      </section>;
                    }}</Show>
                    <Show when={libraryComponentDraft()}>{draft => <Suspense fallback={null}><LibraryComponentEditor group={() => libraryComponentDraft() ?? draft()} isDraft boardLocked={boardLocked} onChangeGroup={operation => setLibraryComponentDraft(current => current ? operation(current) : current)} onRememberFontSize={rememberFontSize} onCancelDraft={() => setLibraryComponentDraft(undefined)} onCommitDraft={commitLibraryComponentDraft} /></Suspense>}</Show>
                    <Show when={!libraryComponentDraft() && selectedLibraryComponent()}>{component => <Suspense fallback={null}><LibraryComponentEditor group={() => selectedLibraryComponent() ?? component()} isDraft={false} boardLocked={boardLocked} onChangeGroup={updateSelectedLibraryComponent} onRememberFontSize={rememberFontSize} onCancelDraft={() => setLibraryComponentDraft(undefined)} onCommitDraft={commitLibraryComponentDraft} /></Suspense>}</Show>
                    <Show when={selectedClassComponentId() && !selectedLibraryComponent() && !classCardDraft() ? selectedClassComponentId() : undefined}>{componentId => <section class="component-editor-content"><div class="precision-grid component-size-grid"><label>Width<input type="number" min="180" max="900" value={Math.round(selectedClassCardSize(componentId()).width)} disabled={boardLocked()} onChange={event => resizeClassCardSize(componentId(), "width", Number(event.currentTarget.value))} /></label><label>Height<input type="number" min="110" max="1800" value={Math.round(selectedClassCardSize(componentId()).height)} disabled={boardLocked()} onChange={event => resizeClassCardSize(componentId(), "height", Number(event.currentTarget.value))} /></label><label>Font<input aria-label="Component font size" type="number" min="8" max="48" step="1" value={quickCardFontSize()} disabled={boardLocked()} onChange={event => resizeClassCardFont(componentId(), Number(event.currentTarget.value))} /></label></div></section>}</Show>
                    <Show when={classCardDraft()}>{draft => <div class="component-editor-content class-card-editor"><label class="property-label">Class name<input value={draft().name} disabled={boardLocked()} onInput={event => setClassCardDraft(value => value ? { ...value, name: event.currentTarget.value } : value)} /></label><label class="property-label">Attributes<textarea rows="5" value={draft().attributes} disabled={boardLocked()} onInput={event => setClassCardDraft(value => value ? { ...value, attributes: event.currentTarget.value } : value)} onKeyDown={event => { if (event.key === "Tab") indentTextarea(event, value => setClassCardDraft(current => current ? { ...current, attributes: value } : current)); }} /></label><label class="property-label">Methods<textarea rows="5" value={draft().methods} disabled={boardLocked()} onInput={event => setClassCardDraft(value => value ? { ...value, methods: event.currentTarget.value } : value)} onKeyDown={event => { if (event.key === "Tab") indentTextarea(event, value => setClassCardDraft(current => current ? { ...current, methods: value } : current)); }} /></label><div class="precision-grid component-size-grid"><label>Width<input type="number" min="180" max="900" value={Math.round(classCardSize(draft()).width)} disabled={boardLocked()} onChange={event => setClassCardDraft(current => current ? { ...current, width: Math.round(Number(event.currentTarget.value)) } : current)} /></label><label>Height<input type="number" min="110" max="1800" value={Math.round(classCardSize(draft()).height)} disabled={boardLocked()} onChange={event => setClassCardDraft(current => current ? { ...current, height: Math.round(Number(event.currentTarget.value)) } : current)} /></label><label>Font<input aria-label="Component font size" type="number" min="8" max="48" step="1" value={draft().fontSize} disabled={boardLocked()} onChange={event => updateClassCardDraftFont(Number(event.currentTarget.value))} /></label></div><div class="component-draft-actions"><button type="button" class="quiet-button" onClick={() => setClassCardDraft(undefined)}>Cancel</button><button type="button" class="save-button" disabled={boardLocked()} onClick={insertClassCard}>{draft().componentId ? "Update card" : "Add to canvas"}</button></div></div>}</Show>
                <Show when={connectionTargetSupported()}><details class="pane-section component-navigation-details inspector-advanced-section"><summary><span>Connection points</span><small>{connectionPointsFor(focusedElement()).length}/32</small></summary><section class="pane-section connection-point-editor"><div class="pane-heading">Connection points <small>{connectionPointsFor(focusedElement()).length}/32</small></div><p>Connectors can snap to these named positions on the shape.</p><For each={connectionPointsFor(focusedElement()).map((_, index) => index)}>{index => { const point = () => connectionPointsFor(focusedElement())[index]; return <div class="connection-point-row"><input aria-label={`Connection point ${index + 1} name`} maxlength="80" value={point()?.name ?? ""} disabled={boardLocked() || !!focusedElement()?.locked} onInput={event => updateFocusedConnectionPoints(points => points.map((item, current) => current === index ? { ...item, name: event.currentTarget.value } : item))} /><label>X<input aria-label={`Connection point ${index + 1} horizontal position`} type="number" min="0" max="1" step="0.05" value={point()?.anchor.x ?? 0.5} disabled={boardLocked() || !!focusedElement()?.locked} onChange={event => updateFocusedConnectionPoints(points => points.map((item, current) => current === index ? { ...item, anchor: { ...item.anchor, x: Number(event.currentTarget.value) } } : item))} /></label><label>Y<input aria-label={`Connection point ${index + 1} vertical position`} type="number" min="0" max="1" step="0.05" value={point()?.anchor.y ?? 0.5} disabled={boardLocked() || !!focusedElement()?.locked} onChange={event => updateFocusedConnectionPoints(points => points.map((item, current) => current === index ? { ...item, anchor: { ...item.anchor, y: Number(event.currentTarget.value) } } : item))} /></label><button type="button" aria-label={`Remove connection point ${index + 1}`} disabled={boardLocked() || !!focusedElement()?.locked} onClick={() => updateFocusedConnectionPoints(points => points.filter((_, current) => current !== index))}>×</button></div>; }}</For><button class="quiet-button" type="button" disabled={boardLocked() || !!focusedElement()?.locked || connectionPointsFor(focusedElement()).length >= 32} onClick={() => updateFocusedConnectionPoints(points => [...points, { id: crypto.randomUUID(), name: `Port ${points.length + 1}`, anchor: { x: 0.5, y: 0.5 } }])}>Add connection point</button></section></details></Show>
                  <Show when={connectionTargetSupported() && connectionPointsFor(focusedElement()).length > 0}><details class="pane-section component-navigation-details inspector-advanced-section"><summary><span>Port connection rules</span></summary><p class="connection-rules-help">Each custom port accepts any relationship by default. Choose accepted types to restrict it.</p><For each={connectionPointsFor(focusedElement())}>{point => <div class="connection-rule-editor"><strong>{point.name || "Connection point"}</strong><div class="connection-point-rules"><button type="button" class={!point.accepts?.length ? "active" : ""} aria-pressed={!point.accepts?.length} disabled={boardLocked() || !!focusedElement()?.locked} onClick={() => updateFocusedConnectionPoints(points => points.map(item => item.id === point.id ? { ...item, accepts: undefined } : item))}>Any</button><For each={RELATIONSHIP_TYPES}>{type => <button type="button" class={point.accepts?.includes(type.value) ? "active" : ""} aria-pressed={point.accepts?.includes(type.value) ?? false} disabled={boardLocked() || !!focusedElement()?.locked} onClick={() => updateFocusedConnectionPoints(points => points.map(item => { if (item.id !== point.id) return item; const accepts = item.accepts ?? []; const next = accepts.includes(type.value) ? accepts.filter(value => value !== type.value) : [...accepts, type.value]; return { ...item, accepts: next.length ? next : undefined }; }))}>{type.label}</button>}</For></div></div>}</For></details></Show>
                  <details class="pane-section component-navigation-details">
                    <summary><span>Page links and nested diagrams</span></summary>
                    <Show when={primarySelection() !== undefined}>
                      <section class="pane-section page-link-properties">
                        <div class="pane-heading">Page link</div>
                        <Show when={pages().length > 1} fallback={<div class="page-link-empty"><p>Create another page to link this object to a separate view.</p><button type="button" class="quiet-button" disabled={boardLocked() || readOnlyView() || pages().length >= 100} onClick={createLinkedPageFromSelection}>Create linked page</button></div>}>
                          <label class="property-label">Link this object to a page<select aria-label="Link selected object to page" value={selectedRootElement()?.pageLinkId ?? ""} disabled={boardLocked() || !!selectedRootElement()?.locked} onChange={event => setSelectedPageLink(event.currentTarget.value || undefined)}><option value="">No link</option>{pages().filter(page => page.id !== activePageId()).map(page => <option value={page.id}>{page.name}</option>)}</select></label>
                          <Show when={selectedRootElement()?.pageLinkId}><div class="property-label">Prototype transition<div class="choice-deck compact">{([{ value: "instant", label: "Instant" }, { value: "fade", label: "Fade" }, { value: "slide", label: "Slide" }] as const).map(option => <button type="button" class={(!selectedRootElement()?.pageLinkTransition && option.value === "instant" || selectedRootElement()?.pageLinkTransition === option.value) ? "active" : ""} aria-pressed={!selectedRootElement()?.pageLinkTransition && option.value === "instant" || selectedRootElement()?.pageLinkTransition === option.value} disabled={boardLocked() || !!selectedRootElement()?.locked} onClick={() => setSelectedPageLinkTransition(option.value)}>{option.label}</button>)}</div></div></Show>
                          <Show when={selectedRootElement()?.pageLinkId && pages().some(page => page.id === selectedRootElement()?.pageLinkId)}>
                            <button type="button" class="quiet-button" onClick={() => openLinkedPage(selectedRootElement()?.pageLinkId)}>Open linked page</button>
                          </Show>
                          <For each={selectedLinkedPages()}>{target => <div class="nested-page-link"><span>{elementNavigationLabel(target.item)} → {target.page.name}</span><button type="button" class="quiet-button" onClick={() => openLinkedPage(target.page.id)}>Open</button></div>}</For>
                        </Show>
                      </section>
                    </Show>
                    <Show when={selectedLibraryComponent() || selectedNestedComponents().length > 0}>
                      <section class="pane-section">
                        <div class="pane-heading">Nested diagrams</div>
                        <Show when={selectedLibraryComponent()}>
                          <Show when={!selectedRootElement()?.pageLinkId || !pages().some(page => page.id === selectedRootElement()?.pageLinkId)}><button type="button" class="quiet-button" disabled={boardLocked() || pages().length >= 100} onClick={() => createComponentDrilldown()}>Create drill-down page</button></Show>
                        </Show>
                        <For each={selectedNestedComponents()}>{component => {
                          const linkedPage = () => component.pageLinkId ? pages().find(page => page.id === component.pageLinkId) : undefined;
                          return <div class="nested-page-link"><span>{elementNavigationLabel(component)}</span>{linkedPage() ? <button type="button" class="quiet-button" onClick={() => openLinkedPage(linkedPage()?.id)}>Open</button> : <button type="button" class="quiet-button" disabled={boardLocked() || component.locked || pages().length >= 100} onClick={() => createComponentDrilldown(component.id)}>Create page</button>}</div>;
                        }}</For>
                      </section>
                    </Show>
                  </details>
                  </div>
                </>}>
                  <button type="button" class="component-editor-expand" aria-label="Expand editor panel" title="Expand editor panel" aria-expanded="false" onClick={() => setComponentEditorCollapsed(false)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 4 6 6-6 6" /></svg></button>
                </Show>
              </aside>
            </Show>
            <Show when={textDraft()}>{draft => <div class="text-editor-frame" style={{ left: `${canvasState().panX + editorLeft(draft()) * canvasState().zoom}px`, top: `${canvasState().panY + draft().y * canvasState().zoom}px`, width: `${editorWidth(draft()) * canvasState().zoom}px`, height: draft().height ? `${draft().height! * canvasState().zoom}px` : undefined, transform: `rotate(${draft().rotation ?? 0}deg)`, "justify-content": draft().verticalAlign === "bottom" ? "flex-end" : draft().verticalAlign === "middle" ? "center" : "flex-start", "font-size": `${draft().fontSize * canvasState().zoom}px`, "font-family": fontCss(draft().fontFamily), "font-weight": draft().bold ? 700 : 400, "font-style": draft().italic ? "italic" : "normal", "text-decoration": draft().underline ? "underline" : "none", "text-align": draft().textAlign, color: themeInk(draft().color, theme()), opacity: draft().opacity }}>
              <div ref={element => { textEditorElement = element; requestAnimationFrame(() => { if (element.isConnected && textDraft()) { element.innerText = draft().value; if (textEditorPendingPointerId === undefined) element.focus(); const range = document.createRange(); range.selectNodeContents(element); range.collapse(false); const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); } }); }} class="canvas-text-editor" contentEditable={true} role="textbox" aria-label="Canvas text" aria-multiline="true" data-placeholder="Type here…" onInput={event => updateTextDraft(event.currentTarget.innerText)} onBlur={event => { if (!isWindowsPlatform()) return; const next = event.relatedTarget; if (!(next instanceof HTMLElement && next.closest(".style-pane, .component-editor-dock, .design-toolbar"))) commitTextDraft(); }} onPointerDown={event => event.stopPropagation()} onPaste={event => { event.preventDefault(); const text = event.clipboardData?.getData("text/plain") ?? ""; const selection = window.getSelection(); if (selection?.rangeCount) { const range = selection.getRangeAt(0); range.deleteContents(); const node = document.createTextNode(text); range.insertNode(node); range.setStartAfter(node); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); updateTextDraft(event.currentTarget.innerText); } }} onKeyDown={event => { event.stopPropagation(); if (event.key === "Escape" || (event.key === "Enter" && (event.ctrlKey || event.metaKey))) { event.preventDefault(); commitTextDraft(); if (event.key === "Escape") { setTool(isWindowsPlatform() ? "select" : "pan"); if (isWindowsPlatform()) setStyleMenuMode("quick"); setSelectedIndices([]); setHoveredIndex(undefined); } } }} />
            </div>}</Show>
            <div class="canvas-help">Wheel to zoom <span>|</span> Hold Space or select the hand tool to pan <span>|</span> Use Gestures to set touch actions <span>|</span> V to select and drag to move</div>
          </section>
        </>
      </Show>
      <Show when={contextMenu()}>{position => <div class="canvas-context-menu" role="menu" aria-label="Canvas context menu" style={{ left: `${position().x}px`, top: `${position().y}px` }} onClick={() => setContextMenu(undefined)} onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")]; const index = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus(); } }} ref={element => requestAnimationFrame(() => element.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus())}>
        <button role="menuitem" disabled={!selectedIndices().length} onClick={() => void copySelection()}>Copy <kbd>Ctrl C</kbd></button>
        <button role="menuitem" disabled={boardLocked()} onClick={() => void pasteSelection(position().world)}>Paste here <kbd>Ctrl V</kbd></button>
        <button role="menuitem" disabled={boardLocked() || !selectedIndices().length} onClick={() => insertCopies(selectedElements())}>Duplicate <kbd>Ctrl D</kbd></button>
        <button role="menuitem" disabled={boardLocked() || !groupActionEnabled()} onClick={groupSelection}>{groupSelected() ? "Ungroup" : "Group"} <kbd>Ctrl G</kbd></button>
        <button role="menuitem" disabled={!selectedIndices().length} onClick={() => fitDocumentToViewport(selectedElements())}>Zoom to selection <kbd>2</kbd></button>
        <button role="menuitem" onClick={() => fitDocumentToViewport(elements())}>Fit drawing <kbd>1</kbd></button>
        <button role="menuitem" disabled={!selectedIndices().length} onClick={() => { setExportScope("selection"); openExportOptions("png"); }}>Export selection…</button>
        <button role="menuitem" disabled={boardLocked() || !selectedIndices().length} onClick={deleteSelected}>Delete <kbd>Del</kbd></button>
      </div>}</Show>
      <Show when={objectSearchOpen()}><ObjectSearchDialog query={objectSearchQuery()} replacement={objectReplaceText()} results={objectSearchMatches()} canReplace={!boardLocked() && !readOnlyView()} onQuery={setObjectSearchQuery} onReplacement={setObjectReplaceText} onSelect={selectObjectSearchResult} onReplace={replaceObjectSearchResult} onClose={() => setObjectSearchOpen(false)} /></Show>
      <Show when={validationOpen()}><div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setValidationOpen(false); }}><section class="confirm-dialog validation-dialog" role="dialog" aria-modal="true" aria-labelledby="validation-title"><header><div><span class="eyebrow">DIAGRAM CHECK</span><h2 id="validation-title">Diagram validation</h2></div><button class="help-close" aria-label="Close validation report" onClick={() => setValidationOpen(false)}>&times;</button></header><div class="validation-profile-options" role="group" aria-label="Diagram lint profile">{DIAGRAM_LINT_PROFILES.map(profile => <button type="button" class={validationProfile() === profile.id ? "active" : ""} aria-pressed={validationProfile() === profile.id} onClick={() => runProfileValidation(profile.id)}>{profile.label}</button>)}</div><div class="validation-optional-checks"><label><input type="checkbox" checked={validationIncludeOverlaps()} onChange={event => { setValidationIncludeOverlaps(event.currentTarget.checked); runProfileValidation(validationProfile()); }} />Check overlaps</label><label><input type="checkbox" checked={validationWarnEmptyLabels()} onChange={event => { setValidationWarnEmptyLabels(event.currentTarget.checked); runProfileValidation(validationProfile()); }} />Warn about empty labels</label></div><p>{visibleValidationIssues().length ? `${visibleValidationIssues().length} possible issue${visibleValidationIssues().length === 1 ? "" : "s"} found. Select an item to select and zoom to it on the canvas.` : `No ${validationProfile() === "all" ? "common diagram" : validationProfile().toUpperCase()} issues were found.`}</p><Show when={visibleValidationIssues().length > 0}><ul class="validation-issue-list">{visibleValidationIssues().map(issue => <li><button type="button" disabled={!issue.elementId} onClick={() => selectValidationIssue(issue)}><span class={`validation-severity ${issue.severity}`}>{issue.severity}</span><span>{issue.message}</span></button></li>)}</ul></Show><div><button class="save-button" onClick={() => setValidationOpen(false)}>Done</button></div></section></div></Show>
      <Show when={namedSnapshotsOpen()}><div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setNamedSnapshotsOpen(false); }}><section class="confirm-dialog named-snapshots-dialog" role="dialog" aria-modal="true" aria-labelledby="named-snapshots-title"><header><div><span class="eyebrow">DOCUMENT HISTORY</span><h2 id="named-snapshots-title">Named versions</h2></div><button class="help-close" aria-label="Close named versions" onClick={() => setNamedSnapshotsOpen(false)}>&times;</button></header><p>Save up to ten local versions of this sketch. You can compare each with the open document and restore it as an unsaved change.</p><div class="named-snapshot-create"><label>Version name<input maxlength="80" value={namedSnapshotTitle()} onInput={event => setNamedSnapshotTitle(event.currentTarget.value)} /></label><button class="save-button" disabled={readOnlyView() || boardLocked() || !namedSnapshotTitle().trim()} onClick={saveNamedSnapshot}>Save current version</button></div><div class="named-snapshot-portability"><button class="quiet-button" disabled={!namedSnapshots().length || nativeBusy()} onClick={() => void exportNamedSnapshots()}>Export portable versions</button><button class="quiet-button" disabled={readOnlyView() || boardLocked() || nativeBusy()} onClick={() => void importNamedSnapshots()}>Import versions</button></div><Show when={namedSnapshots().length} fallback={<p>No named versions saved for this file yet.</p>}><ul class="named-snapshot-list">{namedSnapshots().map(record => <li><div><strong>{record.name}</strong><small>{new Date(record.createdAt).toLocaleString()}</small></div><button class="quiet-button" onClick={() => compareNamedSnapshot(record)}>Compare</button><button class="quiet-button" disabled={readOnlyView() || boardLocked()} onClick={() => restoreNamedSnapshot(record)}>Restore</button><button class="quiet-button" onClick={() => deleteNamedSnapshot(record)}>Delete</button></li>)}</ul></Show><Show when={snapshotVisuals()}>{visuals => <section class="named-snapshot-visual-compare"><figure><figcaption>Saved version</figcaption><img src={visuals().before} alt="Canvas preview of the saved version" /></figure><figure><figcaption>Current sketch</figcaption><img src={visuals().current} alt="Canvas preview of the current sketch" /></figure></section>}</Show><Show when={snapshotComparison().length}><section class="named-snapshot-diff"><strong>Comparison with current document</strong><ul>{snapshotComparison().map(change => <li>{change}</li>)}</ul></section></Show><div><button class="quiet-button" onClick={() => setNamedSnapshotsOpen(false)}>Done</button></div></section></div></Show>
      <Show when={bpmnSimulationOpen()}><div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) { stopBpmnSimulation(); setBpmnSimulationOpen(false); } }}><section class="confirm-dialog bpmn-simulation-dialog" role="dialog" aria-modal="true" aria-labelledby="bpmn-simulation-title"><header><div><span class="eyebrow">PROCESS MODEL</span><h2 id="bpmn-simulation-title">BPMN token simulation</h2></div><button class="help-close" aria-label="Close BPMN simulation" onClick={() => { stopBpmnSimulation(); setBpmnSimulationOpen(false); }}>&times;</button></header><p>Exclusive gateways evaluate simple conditions against the values below. Parallel gateways create concurrent branches and wait for every modeled incoming branch at joins. Task durations are estimates.</p><label class="property-label bpmn-context-editor">Condition values<textarea rows="2" placeholder="approved=true, amount=500" value={bpmnContextText()} onInput={event => updateBpmnSimulationContext(event.currentTarget.value)} /></label><Show when={bpmnSimulationSteps().length} fallback={<p>Add connected BPMN start, flow, and end components to simulate a path.</p>}><ol class="bpmn-simulation-steps">{bpmnSimulationSteps().map((step, index) => <li classList={{ active: bpmnSimulationIndex() === index }}><span>{step.kind === "flow" ? "→" : "●"}</span><strong>{step.label}</strong><small>Branch {step.branch ?? 1} ? {step.kind === "node" && step.durationMinutes ? `${step.durationMinutes} min` : `${step.elapsedMinutes} min elapsed`}</small></li>)}</ol><p>Total modeled process time: {Math.max(0, ...bpmnSimulationSteps().map(step => step.elapsedMinutes + (step.durationMinutes ?? 0)))} minutes</p></Show><div><button class="quiet-button" onClick={() => { stopBpmnSimulation(); setBpmnSimulationOpen(false); }}>Close</button><button class="save-button" disabled={!bpmnSimulationSteps().length} onClick={playBpmnSimulation}>{bpmnSimulationIndex() >= 0 ? "Restart simulation" : "Run simulation"}</button></div></section></div></Show>
      <Show when={codeDataOpen()}><div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setCodeDataOpen(false); }}><section class="confirm-dialog code-data-dialog" role="dialog" aria-modal="true" aria-labelledby="code-data-title">
        <header><div><span class="eyebrow">TOOLS</span><h2 id="code-data-title">Code & data</h2></div><button class="help-close" aria-label="Close Code and data tools" onClick={() => setCodeDataOpen(false)}>&times;</button></header>
        <div class="code-data-actions">
          <h3>Create</h3>
          <button type="button" onClick={() => { setCodeDataOpen(false); openMermaidDialog(); }}><i class="code-data-action-icon"><svg viewBox="0 0 24 24"><path d="m8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18"/></svg></i><span><strong>Diagram as code</strong><small>Generate editable shapes from Mermaid</small></span></button>
          <button type="button" onClick={() => { setCodeDataOpen(false); openMermaidDialog(undefined, "plantuml"); }}><i class="code-data-action-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="6" rx="1"/><rect x="14" y="15" width="7" height="6" rx="1"/><path d="M10 6h4a2 2 0 0 1 2 2v7M7 9v6a2 2 0 0 0 2 2h5"/></svg></i><span><strong>PlantUML source</strong><small>Generate editable UML diagrams</small></span></button>
          <button type="button" onClick={() => { setCodeDataOpen(false); openCsvChartDialog(); }}><i class="code-data-action-icon"><svg viewBox="0 0 24 24"><path d="M4 20V11m5 9V5m5 15v-7m5 7V8"/><path d="M2 20h20"/></svg></i><span><strong>Chart from CSV</strong><small>Map columns to labels and data series</small></span></button>
          <button type="button" onClick={() => { setCodeDataOpen(false); openSchemaDialog(); }}><i class="code-data-action-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M9 3v18m6-12v12"/></svg></i><span><strong>Database schema visualizer</strong><small>Generate linked cards from SQL or JSON</small></span></button>
          <h3>Files</h3>
          <button type="button" onClick={() => { setCodeDataOpen(false); void importDiagramFile(); }}><i class="code-data-action-icon"><svg viewBox="0 0 24 24"><path d="M12 15V3m-5 5 5-5 5 5M4 14v6h16v-6"/></svg></i><span><strong>Import code or data</strong><small>Open Mermaid, PlantUML, CSV, DOT, D2, or schema files</small></span></button>
          <button type="button" onClick={() => { setCodeDataOpen(false); setDiagramCodeExportOpen(true); }}><i class="code-data-action-icon"><svg viewBox="0 0 24 24"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg></i><span><strong>Export diagram code</strong><small>Write Mermaid, DOT, D2, CSV, PlantUML, SQL, or JSON Schema</small></span></button>
          <Show when={selectedRootElement()?.type === "schemaTable" || selectedRootElement()?.type === "group" && (!!(selectedRootElement() as GroupElement).note || !!(selectedRootElement() as GroupElement).libraryComponent?.kind.startsWith("viz-")) || !!selectedDiagramCodeGroup()}><h3>Selected content</h3></Show>
          <Show when={selectedRootElement()?.type === "schemaTable" || selectedRootElement()?.type === "group" && !!(selectedRootElement() as GroupElement).note}><button type="button" disabled={boardLocked()} onClick={() => { setCodeDataOpen(false); createChartFromSelectedTable(); }}><i class="code-data-action-icon"><svg viewBox="0 0 24 24"><path d="M4 20V11m5 9V5m5 15v-7m5 7V8M2 20h20"/></svg></i><span><strong>Chart selected table</strong><small>Turn selected table data into an editable chart</small></span></button></Show>
          <Show when={selectedRootElement()?.type === "group" && !!(selectedRootElement() as GroupElement).libraryComponent?.kind.startsWith("viz-")}><button type="button" disabled={boardLocked()} onClick={() => { const chart = selectedRootElement(); if (chart?.type === "group" && chart.id) { setCodeDataOpen(false); openCsvChartDialog(chart.id); } }}><i class="code-data-action-icon"><svg viewBox="0 0 24 24"><path d="M4 20V11m5 9V5m5 15v-7m5 7V8M2 20h20"/><path d="M16 4h5v5"/></svg></i><span><strong>Edit selected chart data</strong><small>Update its CSV while keeping the chart object</small></span></button></Show>
          <Show when={selectedDiagramCodeGroup()}><button type="button" disabled={boardLocked()} onClick={() => { const group = selectedDiagramCodeGroup(); if (group) { setCodeDataOpen(false); openMermaidDialog(group.id); } }}><i class="code-data-action-icon"><svg viewBox="0 0 24 24"><path d="m8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18"/></svg></i><span><strong>Edit selected diagram source</strong><small>Reopen its saved Mermaid or PlantUML source</small></span></button></Show>
      <Show when={selectedRootElement()?.type === "schemaTable"}><button type="button" onClick={() => { setCodeDataOpen(false); schemaPanelTextarea?.focus(); }}><i class="code-data-action-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M9 3v18m6-12v12"/></svg></i><span><strong>Focus schema editor</strong><small>Edit source in the left panel and see the canvas update</small></span></button></Show>
        </div>
      </section></div></Show>
      <Show when={csvChartOpen()}><div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) closeCsvChartDialog(); }}><section class="confirm-dialog csv-chart-dialog" role="dialog" aria-modal="true" aria-labelledby="csv-chart-title">
        <header><div><span class="eyebrow">DATA TO VISUAL</span><h2 id="csv-chart-title">{csvEditingChartId() ? "Edit chart from CSV" : "Create chart from CSV"}</h2></div><button class="help-close" aria-label="Close CSV chart wizard" onClick={closeCsvChartDialog}>&times;</button></header>
        <p>Paste or load a header row with up to 20 data rows. Choose one label column and up to eight numeric series.</p>
        <button type="button" class="quiet-button code-data-load-file" onClick={() => void loadCsvChartSourceFile()}>Load CSV file…</button>
        <label>CSV data<textarea aria-label="CSV chart data" rows="9" spellcheck="false" value={csvChartInput()} onInput={event => updateCsvChartInput(event.currentTarget.value)} /></label>
        <div class="csv-chart-mapping"><label>Labels<select value={csvChartLabelColumn()} onChange={event => { const label = Number(event.currentTarget.value); setCsvChartLabelColumn(label); setCsvChartSeriesColumns(values => values.filter(value => value !== label)); }}>{csvChartColumns().map((name, index) => <option value={index}>{name || `Column ${index + 1}`}</option>)}</select></label><fieldset><legend>Numeric series</legend><For each={csvChartColumns()}>{(name, index) => <label class="csv-chart-series"><input type="checkbox" checked={csvChartSeriesColumns().includes(index())} disabled={index() === csvChartLabelColumn()} onChange={event => setCsvChartSeriesColumns(values => event.currentTarget.checked ? [...values, index()] : values.filter(value => value !== index()))} />{name || `Column ${index() + 1}`}</label>}</For></fieldset></div>
        <label>Chart type<select value={csvChartKind()} disabled={!!csvEditingChart()?.masterId} onChange={event => setCsvChartKind(event.currentTarget.value as LibraryChartKind)}>{LIBRARY_COMPONENTS.filter(component => component.kind.startsWith("viz-")).map(component => <option value={component.kind}>{component.label}</option>)}</select></label>
        <Show when={csvChartError()}><p class="mermaid-preview-error" role="alert">{csvChartError()}</p></Show>
        <div><button class="quiet-button" onClick={closeCsvChartDialog}>Cancel</button><button class="save-button" disabled={boardLocked()} onClick={createChartFromCsv}>{csvEditingChartId() ? "Update chart" : "Create editable chart"}</button></div>
      </section></div></Show>
      <Show when={diagramCodeExportOpen()}><div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setDiagramCodeExportOpen(false); }}><section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="diagram-code-export-title"><header><div><span class="eyebrow">DIAGRAM CODE</span><h2 id="diagram-code-export-title">Export editable diagram data</h2></div><button class="help-close" aria-label="Close code export" onClick={() => setDiagramCodeExportOpen(false)}>&times;</button></header><p>Mermaid, DOT, D2, CSV, and PlantUML export shape labels and simple connector relationships. D2 preserves basic shape types and colors. SQL and JSON Schema export editable database table cards; JSON Schema uses SketchDraw extensions to preserve SQL types and key metadata. Unsupported details are simplified to the format's supported subset.</p><div class="export-scope"><button class={diagramCodeScope() === "page" ? "active" : ""} onClick={() => setDiagramCodeScope("page")}>Current page</button><button class={diagramCodeScope() === "selection" ? "active" : ""} disabled={!selectedIndices().length} onClick={() => setDiagramCodeScope("selection")}>Selection</button></div><p class="diagram-code-limitations">{diagramCodeLimitations()}</p><label>Format<select value={diagramCodeFormat()} onChange={event => setDiagramCodeFormat(event.currentTarget.value as DiagramCodeFormat)}><option value="mmd">Mermaid flowchart / sequence (.mmd)</option><option value="dot">Graphviz DOT (.dot)</option><option value="d2">D2 diagram (.d2)</option><option value="csv">Nodes and relationships (.csv)</option><option value="puml">PlantUML class/object diagram (.puml)</option><option value="sql">SQL schema (.sql)</option><option value="json">JSON Schema (.json)</option></select></label><div><button class="quiet-button" disabled={nativeBusy()} onClick={() => setDiagramCodeExportOpen(false)}>Cancel</button><button class="save-button" disabled={nativeBusy() || documentBusy() || !elements().length} onClick={() => void exportDiagramAsCode()}>{nativeBusy() ? "Exporting…" : "Export file"}</button></div></section></div></Show>
      <Show when={importSummary()}>{summary => <div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setImportSummary(undefined); }}><section class="confirm-dialog import-fidelity-dialog" role="dialog" aria-modal="true" aria-labelledby="import-fidelity-title"><header><div><span class="eyebrow">DRAW.IO IMPORT</span><h2 id="import-fidelity-title">Import fidelity</h2></div><button class="help-close" aria-label="Close import report" onClick={() => setImportSummary(undefined)}>&times;</button></header><p>{summary().fileName} was added as editable SketchDraw objects. The import supports common shapes, text, styles, connectors, and waypoints.</p><dl><div><dt>Kept</dt><dd>{summary().kept}</dd></div><div><dt>Simplified</dt><dd>{summary().simplified}</dd></div><div><dt>Skipped</dt><dd>{summary().skipped}</dd></div></dl><footer><button class="save-button" onClick={() => setImportSummary(undefined)}>Done</button></footer></section></div>}</Show>
      <Show when={mermaidDialog()}>
        <div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) closeMermaidDialog(); }}>
          <section class="confirm-dialog schema-dialog mermaid-dialog" role="dialog" aria-modal="true" aria-labelledby="mermaid-title">
            <header><div class="schema-dialog-title"><span class="eyebrow">DIAGRAM AS CODE</span><div class="schema-dialog-title-row"><h2 id="mermaid-title">{mermaidEditingDiagram() ? `Update editable ${mermaidFormat() === "plantuml" ? "PlantUML" : "Mermaid"} diagram` : `Generate an editable ${mermaidFormat() === "plantuml" ? "PlantUML" : "Mermaid"} diagram`}</h2><DialogInfoTip label={`${mermaidFormat() === "plantuml" ? "PlantUML" : "Mermaid"} diagram help`}>
              {mermaidFormat() === "plantuml" ? <p>Paste PlantUML class or object source. SketchDraw stores the source inside the .sketch file and creates editable canvas objects. Double-click the generated diagram to revise its code. Class fields and common relationship operators are supported.</p> : <p>Paste Mermaid flowchart or sequence code. The preview updates as you type. SketchDraw stores source in the .sketch file and creates native editable shapes, lifelines, and connectors. Replacing an existing diagram asks before rebuilding its layout. Flowcharts support subgraphs, common node/link styles, and connector types; sequence diagrams support participants and common message arrows.</p>}
            </DialogInfoTip></div></div><button class="help-close" aria-label="Close diagram code editor" onClick={closeMermaidDialog}>&times;</button></header>
            <button type="button" class="quiet-button code-data-load-file" onClick={() => void loadDiagramCodeSourceFile()}>Load source file…</button>
            <div class="mermaid-editor-layout" classList={{ "plantuml-editor-layout": mermaidFormat() === "plantuml" }}>
              <textarea autofocus class="mermaid-input" aria-label={mermaidFormat() === "plantuml" ? "PlantUML source" : "Mermaid flowchart or sequence source"} value={mermaidInput()} placeholder={mermaidFormat() === "plantuml" ? "@startuml\nclass User {\n  id: UUID\n}\n@enduml" : "flowchart TD\n  Start([Start]) --> Check{Ready?}\n  Check -.->|retry| Start\n  Check ==> Done[Finish]"} onInput={event => { setMermaidInput(event.currentTarget.value); setMermaidError(""); }} onKeyDown={event => { if (event.key === "Tab") indentTextarea(event, setMermaidInput); }} />
              <Show when={mermaidFormat() === "mermaid"} fallback={<div class="mermaid-preview-loading" role="note">PlantUML source is checked when you generate the diagram.</div>}><Suspense fallback={<div class="mermaid-preview-loading" role="status">Loading live preview…</div>}><MermaidPreview source={mermaidInput()} /></Suspense></Show>
            </div>
            <Show when={mermaidError()}><p class="schema-error" role="alert">{mermaidError()}</p></Show>
            <div class="mermaid-dialog-footer"><span>{mermaidFormat() === "plantuml" ? "Supports common class, object, component, and relationship syntax" : "Flowcharts: up to 200 nodes, 500 links, 50 subgraphs; sequences: 100 participants and 500 messages"}</span><div><button class="quiet-button" onClick={closeMermaidDialog}>Cancel</button><button class="save-button" disabled={boardLocked()} onClick={insertMermaidDiagram}>{mermaidEditingDiagram() ? "Update diagram" : "Generate canvas diagram"}</button></div></div>
          </section>
        </div>
      </Show>
      <Show when={webEmbedDialog()}><div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setWebEmbedDialog(false); }}><section class="confirm-dialog web-embed-dialog" role="dialog" aria-modal="true" aria-labelledby="web-embed-title"><header><div><span class="eyebrow">CANVAS CONTENT</span><h2 id="web-embed-title">Embed a web page</h2></div><button class="help-close" aria-label="Close web embed dialog" onClick={() => setWebEmbedDialog(false)}>&times;</button></header><p>Add a lightweight card to the canvas. Double-click it to load the live page. YouTube, Vimeo, Google Drive, Google Docs, and websites that allow embedded views can preview here; others can still open in your browser.</p><label>HTTPS address<input autofocus type="url" maxlength="2048" value={webEmbedInput()} placeholder="https://example.com" onInput={event => { setWebEmbedInput(event.currentTarget.value); setWebEmbedError(""); }} onKeyDown={event => { if (event.key === "Enter") insertWebEmbed(); }} /></label><Show when={webEmbedError()}><p class="schema-error" role="alert">{webEmbedError()}</p></Show><div><button class="quiet-button" onClick={() => setWebEmbedDialog(false)}>Cancel</button><button class="save-button" disabled={boardLocked() || !webEmbedInput().trim()} onClick={insertWebEmbed}>Add to canvas</button></div></section></div></Show>
      <Show when={schemaDialog()}>
        <div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) { setSchemaDialog(false); setSchemaEditingDiagram(undefined); } }}>
          <section class="confirm-dialog schema-dialog database-schema-dialog" role="dialog" aria-modal="true" aria-labelledby="schema-title">
            <header class="schema-dialog-header">
              <div class="schema-dialog-heading">
                <span class="eyebrow">DATABASE SCHEMA VISUALIZER</span>
                <div class="schema-dialog-title-row">
                  <h2 id="schema-title">{schemaEditingDiagram() ? "Update linked table cards" : "Generate linked table cards"}</h2>
                  <DialogInfoTip label="Database schema visualizer help">
                    <p>Paste common SQL <code>CREATE TABLE</code> statements, JSON with a <code>tables</code> array, or Draft 2020-12 JSON Schema objects with <code>properties</code> or <code>$defs</code>.</p>
                    <p>Backtick, double-quoted, and bracketed SQL identifiers are accepted. Declared SQL types are kept as written; primary and foreign keys and common constraints are shown on each table.</p>
                    <p>New imports are arranged around their foreign-key relationships. Links attach to the matching fields; drag and resize the cards on the canvas to refine the layout.</p>
                    <p>The visualizer reads schema definitions only; vendor migration commands are not executed. Select a generated table to edit its source in the left panel.</p>
                    <p>Press Tab to indent and Shift+Tab to outdent. Imports support up to 50 tables.</p>
                  </DialogInfoTip>
                </div>
              </div>
              <button class="help-close" aria-label="Close schema visualizer" onClick={() => { setSchemaDialog(false); setSchemaEditingDiagram(undefined); }}>&times;</button>
            </header>
            <button type="button" class="quiet-button code-data-load-file" onClick={() => void loadSchemaSourceFile()}>Load SQL or JSON file…</button>
            <textarea autofocus class="schema-input" rows="16" disabled={schemaImporting()} aria-label="SQL or JSON schema" value={schemaInput()} placeholder={'CREATE TABLE users (\n  id INTEGER PRIMARY KEY,\n  name VARCHAR(80) NOT NULL\n);\n\nCREATE TABLE orders (\n  id INTEGER PRIMARY KEY,\n  user_id INTEGER REFERENCES users(id)\n);'} onInput={event => { setSchemaInput(event.currentTarget.value); setSchemaError(""); }} onKeyDown={event => { if (event.key === "Tab") indentTextarea(event, setSchemaInput); }} />
            <Show when={schemaError()}><p class="schema-error" role="alert">{schemaError()}</p></Show>
            <div class="schema-dialog-footer">
              <span>Up to 50 tables per import</span>
              <div><button class="quiet-button" disabled={schemaImporting()} onClick={() => { setSchemaDialog(false); setSchemaEditingDiagram(undefined); }}>Cancel</button><button class="save-button" disabled={boardLocked() || schemaImporting()} onClick={() => void insertSchemaVisual()}>{schemaImporting() ? "Arranging tables…" : schemaEditingDiagram() ? "Update diagram" : "Add to canvas"}</button></div>
            </div>
          </section>
        </div>
      </Show>
      <Show when={pageDialog()}><div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setPageDialog(undefined); }}><section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="page-dialog-title"><h2 id="page-dialog-title">{pageDialog() === "rename" ? "Rename page" : "Delete page?"}</h2><Show when={pageDialog() === "rename"} fallback={<p>Delete “{currentPage()?.name}” and its contents? This page deletion cannot be undone.</p>}><label>Page name<input autofocus maxlength="80" value={pageName()} onInput={event => setPageName(event.currentTarget.value)} onKeyDown={event => { if (event.key === "Enter" && pageName().trim()) confirmPageDialog(); }} /></label></Show><div><button class="quiet-button" onClick={() => setPageDialog(undefined)}>Cancel</button><button class={pageDialog() === "delete" ? "danger-button" : "save-button"} disabled={boardLocked() || (pageDialog() === "rename" && !pageName().trim())} onClick={confirmPageDialog}>{pageDialog() === "rename" ? "Rename" : "Delete page"}</button></div></section></div></Show>
      <Show when={renameFileOpen()}><div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setRenameFileOpen(false); }}><section class="confirm-dialog rename-file-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-file-title"><h2 id="rename-file-title">Rename sketch file</h2><p>Choose a new name for <strong>{displayNameForPath(activePath() ?? "")}</strong>. The <code>.sketch</code> extension is kept automatically.</p><Show when={renameFileError()}><p class="rename-file-error" role="alert">{renameFileError()}</p></Show><label>File name<input autofocus maxlength="180" value={renameFileName()} onInput={event => setRenameFileName(event.currentTarget.value)} onKeyDown={event => { if (event.key === "Enter" && renameFileName().trim()) void confirmRenameFile(); }} /></label><div><button class="quiet-button" disabled={nativeBusy()} onClick={() => setRenameFileOpen(false)}>Cancel</button><button class="save-button" disabled={!renameFileName().trim() || nativeBusy() || documentBusy()} onClick={() => void confirmRenameFile()}>{nativeBusy() ? "Renaming…" : "Rename file"}</button></div></section></div></Show>
      <Show when={exportOptionsOpen()}><div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setExportOptionsOpen(false); }}><section class="confirm-dialog export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <header class="export-heading"><div><span class="eyebrow">EXPORT PREVIEW</span><h2 id="export-title">Export {exportFormat().toUpperCase()}</h2></div><button class="help-close" aria-label="Close export dialog" onClick={() => setExportOptionsOpen(false)}>&times;</button></header>
        <div class="export-layout"><div class="export-controls"><p>Choose what to export and review the result before saving.</p>
          <div class="export-scope">{(["drawing", "selection", "viewport", "region", "frame"] as const).map(scope => <button class={exportScope() === scope ? "active" : ""} disabled={(scope === "selection" && !selectedIndices().length) || (scope === "region" && !exportMarqueeRegion()) || (scope === "frame" && !selectedFrameElement()) || (exportFormat() === "pdf" && pdfPageSet() !== "current" && scope !== "drawing")} onClick={() => setExportScope(scope)}>{scope === "drawing" ? "Whole drawing" : scope === "selection" ? "Selection" : scope === "viewport" ? "Viewport" : scope === "region" ? "Marquee region" : "Frame"}</button>)}</div>
          <Show when={exportScope() !== "viewport" && exportScope() !== "region"}><label class="export-padding-control">Padding (canvas units)<input type="number" min="0" max="2000" step="1" value={exportPadding()} onInput={event => setExportPadding(Math.max(0, Math.min(2000, Number(event.currentTarget.value) || 0)))} /></label></Show>
          <label class="export-transparent"><input type="checkbox" checked={exportGrid()} onChange={event => setExportGrid(event.currentTarget.checked)} /> Include visible grid</label>
          <Show when={exportFormat() === "pdf"}>
            <section class="pdf-settings"><div class="pdf-setting-heading">Sketch pages</div><div class="pdf-choice-row"><button class={pdfPageSet() === "current" ? "active" : ""} onClick={() => { setPdfPageSet("current"); setPdfPreviewPage(1); }}>Current page</button><button disabled={!allFrameExportTargets().length} class={pdfPageSet() === "frames" ? "active" : ""} onClick={() => { setPdfPageSet("frames"); setExportScope("drawing"); setPdfLayout("fit"); setPdfPreviewPage(1); }}>Each frame ({allFrameExportTargets().length})</button><button class={pdfPageSet() === "all" ? "active" : ""} onClick={() => { setPdfPageSet("all"); setExportScope("drawing"); setPdfLayout("fit"); setPdfPreviewPage(1); }}>All pages ({pages().length})</button><button class={pdfPageSet() === "range" ? "active" : ""} onClick={() => { setPdfPageSet("range"); setExportScope("drawing"); setPdfLayout("fit"); setPdfRangeStart(value => Math.min(value, pages().length)); setPdfRangeEnd(pages().length); setPdfPreviewPage(1); }}>Page range</button></div><Show when={pdfPageSet() === "range"}><div class="pdf-custom-size"><label>From page<input type="number" min="1" max={pages().length} value={pdfRangeStart()} onInput={event => setPdfRangeStart(Math.max(1, Math.min(pages().length, Number(event.currentTarget.value))))} /></label><label>To page<input type="number" min={pdfRangeStart()} max={pages().length} value={pdfRangeEnd()} onInput={event => setPdfRangeEnd(Math.max(pdfRangeStart(), Math.min(pages().length, Number(event.currentTarget.value))))} /></label></div></Show><div class="pdf-setting-heading">Paper size</div><div class="pdf-paper-grid">{([{ id: "a4", label: "A4" }, { id: "letter", label: "Letter" }, { id: "a3", label: "A3" }, { id: "legal", label: "Legal" }, { id: "tabloid", label: "Tabloid" }, { id: "custom", label: "Custom" }] as const).map(({ id, label }) => <button class={pdfPaper() === id ? "active" : ""} onClick={() => setPdfPaper(id)}>{label}</button>)}</div>
              <Show when={pdfPaper() === "custom"}><div class="pdf-custom-size"><label>Width (mm)<input type="number" min="25" max="1000" value={pdfCustomWidthMm()} onInput={event => setPdfCustomWidthMm(Number(event.currentTarget.value))} /></label><label>Height (mm)<input type="number" min="25" max="1000" value={pdfCustomHeightMm()} onInput={event => setPdfCustomHeightMm(Number(event.currentTarget.value))} /></label></div></Show>
              <div class="pdf-setting-heading">Orientation</div><div class="pdf-choice-row"><button class={pdfOrientation() === "portrait" ? "active" : ""} onClick={() => setPdfOrientation("portrait")}><svg viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="1"/></svg><span>Portrait</span></button><button class={pdfOrientation() === "landscape" ? "active" : ""} onClick={() => setPdfOrientation("landscape")}><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="1"/></svg><span>Landscape</span></button></div>
              <div class="pdf-setting-heading">Page layout</div><div class="pdf-choice-row"><button class={pdfLayout() === "fit" ? "active" : ""} onClick={() => { setPdfLayout("fit"); setPdfPreviewPage(1); }}><svg viewBox="0 0 24 24"><path d="M6 4h12v16H6zM9 8h6m-6 4h6m-6 4h4"/></svg><span>Fit on one page</span></button><button disabled={pdfPageSet() !== "current" || pdfColorMode() === "cmyk"} class={pdfLayout() === "tiled" ? "active" : ""} onClick={() => { setPdfLayout("tiled"); setPdfPreviewPage(1); }}><svg viewBox="0 0 24 24"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></svg><span>Multiple pages</span></button></div>
              <div class="pdf-custom-size pdf-output-settings"><label>Print quality<select value={pdfDpi()} onChange={event => setPdfDpi(Number(event.currentTarget.value) as 150 | 300)}><option value="150">150 DPI - standard</option><option value="300">300 DPI - high quality</option></select></label><label>Margins (mm)<input type="number" min="0" max="50" value={pdfMarginMm()} onInput={event => setPdfMarginMm(Number(event.currentTarget.value))} /></label></div>
              <Show when={pdfLayout() === "tiled"}><div class="pdf-custom-size pdf-output-settings"><label>Artwork width (px)<input type="number" min="1" max="12000" value={exportWidth()} onInput={event => setExportWidth(Number(event.currentTarget.value))} /></label><label>Artwork height (px)<input type="number" min="1" max="12000" value={exportHeight()} onInput={event => setExportHeight(Number(event.currentTarget.value))} /></label></div><label class="pdf-overlap-control">Page overlap <input type="range" min="0" max="20" value={pdfOverlapMm()} onInput={event => setPdfOverlapMm(Number(event.currentTarget.value))} /><span>{pdfOverlapMm()} mm</span></label></Show>
              <div class="pdf-custom-size pdf-output-settings"><label>Print color mode<select value={pdfColorMode()} disabled={pdfLayout() === "tiled"} onChange={event => setPdfColorMode(event.currentTarget.value as "rgb" | "cmyk" | "grayscale")}><option value="rgb">RGB color</option><option value="cmyk">CMYK press colors</option><option value="grayscale">Grayscale</option></select></label><label>Bleed (mm)<input type="number" min="0" max="20" value={pdfBleedMm()} onInput={event => setPdfBleedMm(Math.max(0, Math.min(20, Number(event.currentTarget.value))))} /></label></div><div class="pdf-custom-size pdf-output-settings"><label>PDF header<input maxlength="100" value={pdfHeader()} onInput={event => setPdfHeader(event.currentTarget.value)} placeholder="Optional header" /></label><label>PDF footer<input maxlength="100" value={pdfFooter()} onInput={event => setPdfFooter(event.currentTarget.value)} placeholder="Optional footer" /></label></div><label class="export-transparent"><input type="checkbox" checked={pdfCropMarks()} onChange={event => setPdfCropMarks(event.currentTarget.checked)} /> Add crop marks</label><div class="pdf-page-count"><strong>{pdfMetrics().pageCount} {pdfMetrics().pageCount === 1 ? "page" : "pages"}</strong><span>{pdfLayout() === "fit" ? "Vector shapes, selectable text, and images fit the printable area." : `${pdfMetrics().columns} columns by ${pdfMetrics().rows} rows, with matching edges overlapping.`}</span></div>
            </section>
          </Show>
          <Show when={exportFormat() !== "pdf"}><div class="export-dimensions"><label>Width<input type="number" min="1" max="12000" value={exportWidth()} onInput={event => setExportWidth(Number(event.currentTarget.value))} /></label><span>&times;</span><label>Height<input type="number" min="1" max="12000" value={exportHeight()} onInput={event => setExportHeight(Number(event.currentTarget.value))} /></label></div><label class="export-transparent"><input type="checkbox" checked={exportTransparent()} onChange={event => setExportTransparent(event.currentTarget.checked)} /> Transparent background</label></Show>
          <div class="export-actions"><button class="quiet-button" onClick={() => setExportOptionsOpen(false)}>Cancel</button><button class="save-button" onClick={() => { const format = exportFormat(); setExportOptionsOpen(false); void exportAs(format); }}>Export {exportFormat().toUpperCase()}{exportFormat() === "pdf" ? ` (${pdfMetrics().pageCount} pages)` : ""}</button></div>
        </div><div class="export-preview-panel"><div class="export-preview-label"><strong>Preview</strong><Show when={exportFormat() === "pdf"} fallback={<span>{exportWidth()} &times; {exportHeight()} px</span>}><div class="pdf-preview-pages"><button disabled={pdfPreviewPage() <= 1} aria-label="Previous PDF page" onClick={() => setPdfPreviewPage(value => Math.max(1, value - 1))}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10 3-5 5 5 5"/></svg></button><span>Page {pdfPreviewPage()} of {pdfMetrics().pageCount}</span><button disabled={pdfPreviewPage() >= pdfMetrics().pageCount} aria-label="Next PDF page" onClick={() => setPdfPreviewPage(value => Math.min(pdfMetrics().pageCount, value + 1))}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg></button></div></Show></div><div class="export-preview-frame" classList={{ transparent: exportFormat() !== "pdf" && exportTransparent() }}><canvas ref={exportPreviewCanvas} aria-label={`${exportFormat().toUpperCase()} export preview`} /></div><small>{exportFormat() === "pdf" && pdfPageSet() === "frames" ? `Frame ${allFrameExportTargets()[pdfPreviewPage() - 1]?.frame.container?.name ?? ""} · ${allFrameExportTargets()[pdfPreviewPage() - 1]?.page.name ?? ""} · ${pdfPreviewPage()} of ${allFrameExportTargets().length}` : exportFormat() === "pdf" && pdfPageSet() === "all" ? `Sketch page ${pdfPreviewPage()} of ${pages().length}` : exportScope() === "drawing" ? "Whole drawing" : exportScope() === "selection" ? "Selected objects" : exportScope() === "region" ? "Marquee region" : exportScope() === "frame" ? "Selected frame" : "Current viewport"}{exportFormat() === "pdf" ? ` / ${pdfPageSpec().widthMm.toFixed(0)} x ${pdfPageSpec().heightMm.toFixed(0)} mm / ${pdfDpi()} DPI` : exportTransparent() ? " / transparent" : " / whiteboard background"}</small></div></div>
      </section></div></Show>
      <Show when={recoveryPrompt()}>{(recovery) => <div class="confirm-backdrop"><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="recovery-title"><h2 id="recovery-title">Recover unsaved work?</h2><p>SketchDraw found a local recovery copy for <strong>{recovery().path.split(/[\\/]/).pop()}</strong>. Restore it or continue with the saved file.</p><div><button class="quiet-button" onClick={discardRecovery}>Use saved file</button><button class="save-button" onClick={restoreRecovery}>Restore recovery</button></div></section></div>}</Show>
      <Show when={syncConflict()}>{(conflict) => <div class="confirm-backdrop"><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="conflict-title"><h2 id="conflict-title">File changed elsewhere</h2><p><strong>{displayPathName(conflict().path)}</strong> changed after you opened it, so SketchDraw paused this save to protect the newer copy. Your current work is still open. Save it as a separate file or load the disk version, which replaces your current work.</p><div class="conflict-actions"><button class="quiet-button" onClick={() => void saveAs()}>Save my version as…</button><button class="quiet-button" onClick={reloadConflictingFile}>Load disk version</button></div></section></div>}</Show>
      <Show when={showClearConfirm()}><div class="confirm-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setShowClearConfirm(false); }}><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="clear-title"><h2 id="clear-title">Clear this canvas?</h2><p>This will remove all {elements().length} items from the open sketch. You can undo this action.</p><div><button class="quiet-button" onClick={() => setShowClearConfirm(false)}>Cancel</button><button class="danger-button" onClick={() => { if (elements().length && !boardLocked()) { pushUndo(cloneElements(elements())); setElements([]); setSelectedIndices([]); setDirty(true); } setShowClearConfirm(false); }}>Clear canvas</button></div></section></div></Show>
      </Show>
      <Show when={templateGalleryOpen()}><TemplateGallery onClose={() => setTemplateGalleryOpen(false)} onInsert={insertDiagramTemplate} /></Show>
      <Show when={isWindowsPlatform()}><Suspense fallback={null}><WindowsCommandPalette open={commandPaletteOpen()} commands={windowsCommands()} onClose={() => setCommandPaletteOpen(false)} /></Suspense></Show>
      <Show when={isWindowsPlatform() && shortcutDialogOpen()}><Suspense fallback={null}><WindowsKeyboardShortcutsDialog shortcuts={shortcuts()} onChange={setWindowsShortcut} onReset={resetWindowsShortcuts} onClose={() => setShortcutDialogOpen(false)} /></Suspense></Show>
      <Show when={helpOpen()}><Suspense fallback={null}><HelpDialog open section={helpSection()} shortcuts={helpShortcuts} onClose={() => setHelpOpen(false)} /></Suspense></Show>
      <Show when={error()}><div class="error-toast" role="alert">{error()}<button onClick={() => setError("")}>Dismiss</button></div></Show>
    </main>
  );
}

export default App;

