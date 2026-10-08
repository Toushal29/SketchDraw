import { createEffect, createMemo, createSignal, For, lazy, onCleanup, onMount, Show, Suspense } from "solid-js";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, readTextFile, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { getVersion } from "@tauri-apps/api/app";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import "./styles/platform-responsive.css";
import "./styles/tools.css";
import "./platform/mobile/workspace.css";
import "./platform/mobile/overrides.css";
import "./platform/mobile/mobile.css";
import "./styles/app-settings.css";
import "./platform/mobile/ui-refresh.css";
import "./platform/mobile/home.css";
import "./platform/mobile/touch-bars.css";
import "./platform/mobile/touch-style.css";
import "./platform/mobile/orientation.css";
import "./platform/mobile/quick-style.css";
import "./styles/dark-theme-refresh.css";
import "./styles/view-menu.css";
import "./styles/menu-panels.css";
import "./platform/windows/windows.css";
import "./features/workspace/workspace-shell.css";
import sketchDrawMark from "../icons/sketchdraw-mark.svg";

import { SKETCH_FORMAT_VERSION } from "./model";
import type { Point, StrokePoint, ArrowHead, FlowchartShape, ArrowRoute, LineRoute, StrokeStyle, ShapeElement, TextElement, ImageElement, SchemaTableElement, SchemaField, Element, Tool, CanvasState, SketchPage, SketchFile, SketchFileDocumentV8, WindowsSyncMetadata, Preview, Bounds, TextDraft, Theme, ThemeMode, Binding, ShapeLabel, EdgeStyle, FontFamily, PersonalLibraryData } from "./model";
import { ensureIds, resolveBindings, copyElements, isConnector, isLabelShape, isConnectable, BOX_ANCHORS, anchorPoint, nearestBinding, validReferences, textLayout, labelBox, textFont } from "./operations";
import type { NoteKind } from "./model";
import { buildLibraryComponent, buildNoteGroup, checklistRows, checklistIndexAt, normalizeNoteContent, noteCollapseHit, drawNoteCard, syntaxTokens, syntaxTokenColor, noteCardPalette, defaultNoteTitle, EXTRA_FLOWCHART_SHAPES, LIBRARY_COMPONENTS, toggleChecklistContent, type LibraryComponentKind } from "./notes";
import { parseSchema } from "./schema";
import { layoutMermaidFlowchart, parseMermaidFlowchart } from "./mermaid";
import { GestureSettings, TOUCH_GESTURE_ACTIONS, TOUCH_TAP_ACTIONS, readTouchGestureAction, readTouchTapAction, type OneFingerDragAction, type TouchGestureAction, type TouchTapAction } from "./platform/mobile/GestureSettings";
import { TouchPageMenu } from "./platform/mobile/TouchPageMenu";
import { TouchFocusTools } from "./platform/mobile/TouchFocusTools";
import { TouchMenuBar } from "./platform/mobile/TouchMenuBar";
import { TouchToolBar } from "./platform/mobile/TouchToolBar";
import { TouchQuickStyleControls } from "./platform/mobile/TouchQuickStyleControls";
import { TouchStylePanel } from "./platform/mobile/TouchStylePanel";
import { MobileHomeScreen } from "./platform/mobile/MobileHomeScreen";
import { DesktopPageTabs } from "./platform/windows/DesktopPageTabs";
import { CanvasOptionsMenu } from "./components/CanvasOptionsMenu";
import { AppSettingsMenu, type DisplayMetrics } from "./components/AppSettingsMenu";
import { AdvancedPropertiesIcon, QuickPropertiesIcon } from "./components/PropertyPanelIcons";
import { FLOWCHART_SHAPES, FLOWCHART_MENU_SHAPES } from "./features/diagrams/config";
import { arrowHeadPoints, arrowHeadSvgPath, pointInPolygon, traceFlowchart, flowchartPathObject, traceFlowchartDetails, curveControlPoints, forkGeometry, jaggedVertices, connectorPolylines, doubleConnectorPolylines, arrowHeadEntries, traceConnector, connectorSvgPath, flowchartSvgPath, vectorFlowchartPath, flowchartSvgDetailPath, flowchartDatabaseRimPath } from "./features/canvas/geometry";
import { unionBounds, elementBounds, distanceToSegment } from "./features/canvas/bounds";
import { getToolLayers, reorderToolLayer, toggleToolLayer } from "./features/canvas/tool-layers";
import { isRecord, normalizeElement, parseSketchFile } from "./features/files/parse-sketch";
import { withSketchExtension, normalizeFileUri, isSketchPath, displayPathName } from "./features/files/paths";
import { indentTextarea } from "./components/textarea-indent";
import { ThicknessTuner } from "./components/ThicknessTuner";
import { isWindowsPlatform } from "./platform/runtime";
import type { PaletteCommand } from "./platform/windows/CommandPalette";
import { createWindowsSyncMetadata, getWindowsDeviceId, mergeLatestSnapshots } from "./platform/windows/sync";
import { DEFAULT_WINDOWS_SHORTCUTS, WINDOWS_SHORTCUTS, loadWindowsShortcuts, matchesWindowsShortcut, normalizeShortcut, type WindowsShortcutId, type WindowsShortcutMap } from "./platform/windows/shortcuts";
import { autoRoutePoints } from "./platform/windows/connector-routing";
import { ProjectWorkspace } from "./features/project/ProjectWorkspace";
import { createProjectWorkspace } from "./features/project/project-data";
import { createPersonalLibrary } from "./features/library/library-data";
import { PersonalLibrary } from "./features/library/PersonalLibrary";
import { WorkspaceChooser } from "./features/workspace/WorkspaceChooser";
import { WorkspaceAreaTabs } from "./features/workspace/WorkspaceAreaTabs";
import type { WorkspaceArea } from "./features/workspace/workspace-types";
import type { ProjectWorkspaceData } from "./model";

type PdfRasterPage = { jpeg: Uint8Array; imageWidth: number; imageHeight: number; pageWidth: number; pageHeight: number; x: number; y: number; drawWidth: number; drawHeight: number; bleedPt: number; grayscale: boolean };
type TouchGesture = { fingerCount: 2 | 3; action: TouchGestureAction; initialDistance: number; initialZoom: number; initialPanX: number; initialPanY: number; initialMidpoint: Point; worldAnchor: Point };
type TouchTapTracker = { startedAt: number; starts: Map<number, Point>; maxFingers: number; canceled: boolean; initialEvent: PointerEvent; deferredInteractionStarted?: boolean };
type WhiteboardStyle = "plain" | "dots" | "lines" | "small-dots" | "ruled" | "small-grid" | "isometric";
const readDisplayMetrics = (): DisplayMetrics => {
  const ratio = window.devicePixelRatio || 1;
  return { physicalWidth: Math.round(window.screen.width * ratio), physicalHeight: Math.round(window.screen.height * ratio), viewportWidth: window.innerWidth, viewportHeight: window.innerHeight };
};

const fontCss = (family?: FontFamily) => family === "hand" ? "cursive" : family === "serif" ? "Georgia, serif" : family === "mono" ? "'Cascadia Mono', Consolas, monospace" : "'DM Sans', sans-serif";

const RELEASES_API = "https://api.github.com/repos/Toushal29/SketchDraw/releases/latest";

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

function releaseVersionForPlatform(release: Record<string, unknown>): string {
  const tag = release.tag_name as string;
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent.toLowerCase();
  const platform = userAgent.includes("android") ? "Android" : isWindowsPlatform() ? "Windows" : undefined;
  if (!platform || typeof release.body !== "string") return tag;
  const marker = new RegExp(`^\\s*${platform}\\s*:\\s*(v?\\d+\\.\\d+\\.\\d+)\\s*$`, "im").exec(release.body);
  return marker?.[1] ?? tag;
}

const GRID_SIZE = 24;
const TOUCH_DRAG_THRESHOLD = 8;
const stylusStrokeWidth = (point: StrokePoint, thickness: number) => thickness * (point.pressure === undefined ? 1 : .2 + Math.max(0, Math.min(1, point.pressure)) * 1.6) * (1 + Math.min(1, Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0) / 90) * .28);
const BOARD_COLORS = ["#ffffff", "#fffdf7", "#f4f7fb", "#fbf2ed", "#f1f5ed", "#f3f0fa"];
const UI_ACCENTS = [
  { label: "Sage", value: "#547a5b" }, { label: "Ocean", value: "#3f78a5" }, { label: "Indigo", value: "#6d67aa" },
  { label: "Teal", value: "#39877f" }, { label: "Amber", value: "#b47b35" }, { label: "Rose", value: "#ad6475" },
];
const TOOLBAR_COLORS = [
  { label: "Paper", value: "#f8faf7" }, { label: "Warm", value: "#f4efe4" },
  { label: "Slate", value: "#e8edf2" }, { label: "Sage", value: "#e8efe9" },
  { label: "Night", value: "#252c31" },
];
const BOARD_COLOR_NAMES: Record<string, string> = { "#ffffff": "White", "#fffdf7": "Ivory", "#f4f7fb": "Mist", "#fbf2ed": "Blush", "#f1f5ed": "Sage", "#f3f0fa": "Lilac" };
const readPreference = (key: string, fallback: string) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const readWhiteboardStyle = (): WhiteboardStyle => {
  const stored = readPreference("sketchdraw-whiteboard-style", "dots");
  return stored === "plain" || stored === "lines" || stored === "dots" || stored === "small-dots" || stored === "ruled" || stored === "small-grid" || stored === "isometric" ? stored : "dots";
};
const FILL_SWATCHES = ["#f4a6a0", "#ffd166", "#b7e4c7", "#a8dadc", "#a0c4ff", "#cdb4db"];
const THICKNESS_PRESETS = [[1, "Ultra-thin"], [2, "Thin"], [4, "Default"], [5, "Medium"], [10, "Bold"]] as const;
const ORIGINAL_INSPECTOR_THICKNESS_PRESETS = [[1, "Ultra-thin"], [2, "Thin"], [5, "Medium"], [10, "Bold"]] as const;
const ARROW_ROUTES: { value: ArrowRoute; label: string; path: string }[] = [
  { value: "straight", label: "Straight", path: "M3 12h17m-6-6 6 6-6 6" }, { value: "elbow", label: "Elbow", path: "M4 5v14h15m-6-6 6 6-6 6" },
  { value: "forked", label: "Forked", path: "M3 12h8m0 0V5h9m-4-3 4 3-4 3m-5 4v7h9m-4-3 4 3-4 3" },
  { value: "loop", label: "Loop", path: "M4 17c0-10 16-10 16 0m-6-4 6 4-6 4" }, { value: "jagged", label: "Jagged", path: "M3 12h4l3-5 4 10 3-5h3m-4-4 4 4-4 4" },
];
const LINE_ROUTES: { value: LineRoute; label: string; path: string }[] = [
  { value: "straight", label: "Straight", path: "M4 19 20 5" }, { value: "curve", label: "Curve · 1 point", path: "M3 18Q12 2 21 18" },
  { value: "curve2", label: "Curve · 2 points", path: "M3 18C7 2 17 2 21 18" }, { value: "curve3", label: "Curve · 3 points", path: "M3 18C6 2 9 21 12 10S18 2 21 18" },
  { value: "multi", label: "Multi-point", path: "M3 18 7 6l4 12 4-12 3 9 3-6" },
];
const ARROW_HEADS: { value: ArrowHead; label: string }[] = [
  { value: "none", label: "None" }, { value: "open", label: "Open" }, { value: "solid", label: "Solid" },
  { value: "thick", label: "Thick" }, { value: "dot", label: "Dot" }, { value: "diamond", label: "Diamond" }, { value: "bar", label: "Bar" },
];
function themeInk(color: string, activeTheme: Theme): string {
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color);
  if (!match) return color;
  const hex = match[1].length === 3 ? [...match[1]].map((part) => part + part).join("") : match[1];
  const channels = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  const [red, green, blue] = channels;
  const isNeutral = Math.max(red, green, blue) - Math.min(red, green, blue) < 22;
  if (!isNeutral) return color;
  const luminance = red * .2126 + green * .7152 + blue * .0722;
  if (activeTheme === "dark" && luminance < 105) return "#f4f4f2";
  if (activeTheme === "light" && luminance > 235) return "#252525";
  return color;
}
function ArrowHeadIcon(props: { kind: ArrowHead }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h12" />{props.kind === "open" && <path d="m12 7 5 5-5 5" />}{props.kind === "solid" && <path d="m12 7 6 5-6 5z" fill="currentColor" />}{props.kind === "thick" && <path d="m10 5 9 7-9 7z" fill="currentColor" />}{props.kind === "dot" && <circle cx="17" cy="12" r="3" fill="currentColor" />}{props.kind === "diamond" && <path d="m17 7 5 5-5 5-5-5z" fill="currentColor" />}{props.kind === "bar" && <path d="M17 6v12" />}</svg>;
}
const emptyCanvas = (): CanvasState => ({ zoom: 1, panX: 0, panY: 0, backgroundColor: "#ffffff", boardColorFollowsTheme: true });
const cloneElements = (items: Element[]): Element[] => JSON.parse(JSON.stringify(items)) as Element[];
const WINDOWS_SHAPE_TYPES = ["rectangle", "circle", "diamond", "triangle", "flowchart", "line", "arrow"] as const;
const isShapeLike = (element: Element) => (WINDOWS_SHAPE_TYPES as readonly string[]).includes(element.type);
const isShapeLikeType = (type: Element["type"]) => (WINDOWS_SHAPE_TYPES as readonly string[]).includes(type);
let textMeasureContext: CanvasRenderingContext2D | null | undefined;
const MermaidPreview = lazy(async () => {
  const module = await import("./MermaidPreview");
  return { default: module.MermaidPreview };
});
const WindowsCommandPalette = lazy(async () => { const module = await import("./platform/windows/CommandPalette"); return { default: module.CommandPalette }; });
const WindowsDocumentTabs = lazy(async () => { const module = await import("./platform/windows/DocumentTabs"); return { default: module.DocumentTabs }; });
const WindowsKeyboardShortcutsDialog = lazy(async () => { const module = await import("./platform/windows/KeyboardShortcutsDialog"); return { default: module.KeyboardShortcutsDialog }; });
const CanvasMinimap = lazy(async () => { const module = await import("./components/CanvasMinimap"); return { default: module.CanvasMinimap }; });
const CanvasRulers = lazy(async () => { const module = await import("./components/CanvasRulers"); return { default: module.CanvasRulers }; });
const WindowsFocusTools = lazy(async () => { const module = await import("./platform/windows/WindowsFocusTools"); return { default: module.WindowsFocusTools }; });

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
  const [elements, setElementsSignal] = createSignal<Element[]>([]);
  const toolLayers = createMemo(() => getToolLayers(elements()));
  function withWindowsRouteSnapshots(items: Element[]): Element[] {
    if (!isWindowsPlatform()) return items;
    const refresh = (item: Element): Element => {
      if (item.type === "group") return { ...item, elements: item.elements.map(refresh) };
      if (!isConnector(item) || !item.autoRoute) return item;
      return { ...item, routePoints: autoRoutePoints(item, items) };
    };
    return items.map(refresh);
  }
  function setElements(next: Element[] | ((previous: Element[]) => Element[])) {
    return setElementsSignal(previous => withWindowsRouteSnapshots(resolveBindings(ensureIds(typeof next === "function" ? next(previous) : next))));
  }
  // Pointer drags run once per display frame. Keep their immutable preview
  // updates cheap, then validate identities and connector bindings on release.
  function setElementsTransient(next: Element[] | ((previous: Element[]) => Element[])) { return setElementsSignal(next); }
  const [canvasState, setCanvasState] = createSignal<CanvasState>(emptyCanvas());
  const [pages, setPages] = createSignal<SketchPage[]>([]);
  const [activePageId, setActivePageId] = createSignal("");
  const [activePath, setActivePath] = createSignal<string>();
  const [renameFileOpen, setRenameFileOpen] = createSignal(false);
  const [renameFileName, setRenameFileName] = createSignal("");
  const [renameFileError, setRenameFileError] = createSignal("");
  const [projectWorkspaceData, setProjectWorkspaceData] = createSignal<ProjectWorkspaceData>(createProjectWorkspace());
  const [personalLibraryData, setPersonalLibraryData] = createSignal<PersonalLibraryData>(createPersonalLibrary());
  const [workspaceArea, setWorkspaceArea] = createSignal<WorkspaceArea>("canvas");
  const [topbarHeight, setTopbarHeight] = createSignal(66);
  const navigateWorkspace = (area: WorkspaceArea) => setWorkspaceArea(area);
  const [readOnlyView, setReadOnlyView] = createSignal(false);
  const [tool, setTool] = createSignal<Tool>("pen");
  const [color, setColor] = createSignal("#252525");
  const [thickness, setThickness] = createSignal(2);
  const [thicknessPickerMode, setThicknessPickerMode] = createSignal<"presets" | "stepper">(readPreference("sketchdraw-thickness-picker", "presets") === "stepper" ? "stepper" : "presets");
  const [showAdvancedThickness, setShowAdvancedThickness] = createSignal(false);
  const [penPressure, setPenPressure] = createSignal(true);
  const [penTilt, setPenTilt] = createSignal(true);
  const [penEraser, setPenEraser] = createSignal(true);
  const [laserColor, setLaserColor] = createSignal((() => { const value = readPreference("sketchdraw-laser-color", "#ff3265"); return /^#[\da-f]{6}$/i.test(value) ? value : "#ff3265"; })());
  const [laserThickness, setLaserThickness] = createSignal(Math.max(1, Math.min(24, Number(readPreference("sketchdraw-laser-thickness", "5")) || 5)));
  const [laserFadeDuration, setLaserFadeDuration] = createSignal(Math.max(250, Math.min(5000, Number(readPreference("sketchdraw-laser-fade", "1100")) || 1100)));
  const [laserRainbow, setLaserRainbow] = createSignal(readPreference("sketchdraw-laser-rainbow", "false") === "true");
  const [dirty, setDirty] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [savedAt, setSavedAt] = createSignal("");
  const [error, setError] = createSignal("");
  const [preview, setPreview] = createSignal<Preview>();
  const [selectedIndices, setSelectedIndices] = createSignal<number[]>([]);
  const [copiedObjectStyle, setCopiedObjectStyle] = createSignal<{ type: Element["type"]; style: Record<string, unknown> }>();
  const [hoveredIndex, setHoveredIndex] = createSignal<number>();
  const [noteToggleHovered, setNoteToggleHovered] = createSignal(false);
  const [showGrid, setShowGrid] = createSignal(true);
  const [showMinimap, setShowMinimap] = createSignal(readPreference("sketchdraw-canvas-minimap", readPreference("sketchdraw-windows-minimap", isWindowsPlatform() ? "true" : "false")) !== "false");
  const [showRulers, setShowRulers] = createSignal(readPreference("sketchdraw-canvas-rulers", readPreference("sketchdraw-windows-rulers", "false")) === "true");
  const [showAlignmentGuides, setShowAlignmentGuides] = createSignal(readPreference("sketchdraw-canvas-guides", readPreference("sketchdraw-windows-guides", "true")) !== "false");
  const [commandPaletteOpen, setCommandPaletteOpen] = createSignal(false);
  const [shortcutDialogOpen, setShortcutDialogOpen] = createSignal(false);
  const [shortcuts, setShortcuts] = createSignal<WindowsShortcutMap>(isWindowsPlatform() ? loadWindowsShortcuts() : { ...DEFAULT_WINDOWS_SHORTCUTS });
  const [presentationMode, setPresentationMode] = createSignal(false);
  const [windowsSyncMetadata, setWindowsSyncMetadata] = createSignal<WindowsSyncMetadata>();
  const [openSketchPaths, setOpenSketchPaths] = createSignal<string[]>([]);
  const [whiteboardStyle, setWhiteboardStyle] = createSignal<WhiteboardStyle>(readWhiteboardStyle());
  const [snapToGrid, setSnapToGrid] = createSignal(false);
  const [snapToObjects, setSnapToObjects] = createSignal(true);
  const [alignmentGuides, setAlignmentGuides] = createSignal<{ x?: number; y?: number }>();
  const [fillEnabled, setFillEnabled] = createSignal(false);
  const [fillColor, setFillColor] = createSignal("#6b91c9");
  const [fillOpacity, setFillOpacity] = createSignal(0.2);
  const [lineStyle, setLineStyle] = createSignal<StrokeStyle>("solid");
  type BrushMode = "fine" | "pencil" | "brush" | "marker" | "highlighter" | "chalk";
  const [brushMode, setBrushMode] = createSignal<BrushMode>("fine");
  const [lineRoute, setLineRoute] = createSignal<LineRoute>("straight");
  const [arrowRoute, setArrowRoute] = createSignal<ArrowRoute>("straight");
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
  const [layerPanelOpen, setLayerPanelOpen] = createSignal(false);
  const [classCardDraft, setClassCardDraft] = createSignal<{ x: number; y: number; name: string; attributes: string; methods: string; fontSize: number; componentId?: string }>();
  const [styleMenuMode, setStyleMenuMode] = createSignal<"quick" | "full">("quick");
  const [quickStylePopover, setQuickStylePopover] = createSignal<"color" | "thickness" | "fill" | "route" | "lineStyle" | "heads" | "penInput" | "laser" | "brushes">();
  const [autosaveSeconds, setAutosaveSeconds] = createSignal<5 | 10>(readPreference("sketchdraw-autosave-seconds", "10") === "5" ? 5 : 10);
  const [interfaceScale, setInterfaceScale] = createSignal((() => { const value = Number(readPreference("sketchdraw-interface-scale", "1")); return [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4].includes(value) ? value : 1; })());
  const [mobileOrientation, setMobileOrientation] = createSignal(readPreference("sketchdraw-mobile-orientation", "landscape") === "portrait" ? "portrait" as const : "landscape" as const);
  const [orientationMessage, setOrientationMessage] = createSignal("");
  const [toolbarPosition, setToolbarPosition] = createSignal<"top" | "bottom" | "left" | "right">((() => {
    const saved = readPreference("sketchdraw-toolbar-position", "");
    if (saved === "top" || saved === "bottom" || saved === "left" || saved === "right") return saved;
    if (saved === "down") return "bottom";
    return mobileOrientation() === "portrait" ? "top" : "left";
  })());
  const [androidAllFilesAccessAvailable, setAndroidAllFilesAccessAvailable] = createSignal(false);
  const [androidAllFilesAccessGranted, setAndroidAllFilesAccessGranted] = createSignal(false);
  const [reduceMotion, setReduceMotion] = createSignal(readPreference("sketchdraw-reduce-motion", "false") === "true");
  const [displayMetrics, setDisplayMetrics] = createSignal<DisplayMetrics>(readDisplayMetrics());
  const [componentAppearance, setComponentAppearance] = createSignal<"modern" | "simple">(readPreference("sketchdraw-component-appearance", "modern") === "simple" ? "simple" : "modern");
  const [toolbarColorChoice, setToolbarColorChoice] = createSignal((() => { const value = readPreference("sketchdraw-toolbar-color", "auto"); return value === "auto" || /^#[\da-f]{6}$/i.test(value) ? value : "auto"; })());
  const [helpOpen, setHelpOpen] = createSignal(false);
  const [updateCheck, setUpdateCheck] = createSignal<"idle" | "checking" | "current" | "available" | "error">("idle");
  const [updateVersion, setUpdateVersion] = createSignal<string>();
  const [helpSection, setHelpSection] = createSignal<"guide" | "shortcuts">("guide");
  const [defaultFontSize, setDefaultFontSize] = createSignal(16);
  const [defaultFontFamily, setDefaultFontFamily] = createSignal<FontFamily>("sans");
  const [defaultBold, setDefaultBold] = createSignal(false);
  const [defaultItalic, setDefaultItalic] = createSignal(false);
  const [defaultUnderline, setDefaultUnderline] = createSignal(false);
  const [defaultTextAlign, setDefaultTextAlign] = createSignal<"left" | "center" | "right">("left");
  const [defaultListType, setDefaultListType] = createSignal<"none" | "bullet" | "number">("none");
  const [toolBarOpen, setToolBarOpen] = createSignal(true);
  const [touchFocusMode, setTouchFocusMode] = createSignal(false);
  const [windowsFullscreenMode, setWindowsFullscreenMode] = createSignal(false);
  const [mobileToolsExpanded, setMobileToolsExpanded] = createSignal(false);
  const [mobileQuickPropertiesOpen, setMobileQuickPropertiesOpen] = createSignal(false);
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
  const [syncConflict, setSyncConflict] = createSignal<{ path: string; remote: string }>();
  const [exportOptionsOpen, setExportOptionsOpen] = createSignal(false);
  const [canvasOptionsOpen, setCanvasOptionsOpen] = createSignal(false);
  const [exportFormat, setExportFormat] = createSignal<"png" | "svg" | "pdf">("png");
  const [exportWidth, setExportWidth] = createSignal(1600);
  const [exportHeight, setExportHeight] = createSignal(1000);
  const [exportTransparent, setExportTransparent] = createSignal(false);
  const [textDraft, setTextDraft] = createSignal<TextDraft>();
  const [textMode, setTextMode] = createSignal<"text" | "markdown" | "table" | NoteKind>("text");
  const [noteEditor, setNoteEditor] = createSignal<{ x: number; y: number; width: number; height: number; fontSize: number; kind: NoteKind; content: string; title: string; resized?: boolean; editingIndex?: number }>();
  const [noteEditorSession, setNoteEditorSession] = createSignal(0);
  let noteEditorTextarea: HTMLTextAreaElement | undefined;
  let textEditorElement: HTMLDivElement | undefined;
  let textEditorPendingPointerId: number | undefined;
  let textEditorFocusTimer: number | undefined;
  let textEditorFocusOnCanvasClick = false;
  let resizingNoteEditor = false;
  const [schemaDialog, setSchemaDialog] = createSignal(false);
  const [schemaInput, setSchemaInput] = createSignal("");
  const [schemaError, setSchemaError] = createSignal("");
  const [schemaEditingDiagram, setSchemaEditingDiagram] = createSignal<string>();
  const [mermaidDialog, setMermaidDialog] = createSignal(false);
  const [mermaidEditingDiagram, setMermaidEditingDiagram] = createSignal<string>();
  const [mermaidInput, setMermaidInput] = createSignal("flowchart TD\n  Start([Start]) --> Check{Ready?}\n  Check -->|Yes| Done[Finish]\n  Check -->|No| Wait[Wait]");
  const [mermaidError, setMermaidError] = createSignal("");
  const [isPanning, setIsPanning] = createSignal(false);
  const [spaceDown, setSpaceDown] = createSignal(false);
  const [historyVersion, setHistoryVersion] = createSignal(0);
  const imageCache = new Map<string, HTMLImageElement>();
  const textLinesCache = new WeakMap<TextElement, string[]>();
  const [themeMode, setThemeMode] = createSignal<ThemeMode>((() => {
    try { const saved = localStorage.getItem("sketchdraw-theme"); return saved === "light" || saved === "dark" ? saved : "system"; }
    catch { return "system"; }
  })());
  const [accentColor, setAccentColor] = createSignal((() => {
    try { const saved = localStorage.getItem("sketchdraw-accent"); return saved && /^#[\da-f]{6}$/i.test(saved) ? saved : UI_ACCENTS[1].value; }
    catch { return UI_ACCENTS[1].value; }
  })());
  const [systemDark, setSystemDark] = createSignal(window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
  const [recentFiles, setRecentFiles] = createSignal<string[]>((() => {
    try { const value: unknown = JSON.parse(localStorage.getItem("sketchdraw-v8-recent-files") ?? localStorage.getItem("sketchdraw-v6-recent-files") ?? "[]"); return Array.isArray(value) ? value.filter((path): path is string => typeof path === "string" && isSketchPath(path)).slice(0, 8) : []; }
    catch { return []; }
  })());
  createEffect(() => {
    selectedIndices();
    const currentTool = tool();
    if (currentTool === "select") setStyleMenuMode("quick");
    setQuickStylePopover(undefined);
  });
  const [marquee, setMarquee] = createSignal<{ start: Point; end: Point }>();
  const [laserTrail, setLaserTrail] = createSignal<{ points: Point[]; opacity: number }>();
  let undoStack: Element[][] = [];
  let redoStack: Element[][] = [];
  let canvas!: HTMLCanvasElement;
  let exportPreviewCanvas!: HTMLCanvasElement;
  let exportPreviewVersion = 0;
  let canvasWrap!: HTMLElement;
  let appTopbar!: HTMLElement;
  let menu!: HTMLDetailsElement;
  let viewMenu!: HTMLDetailsElement;
  let gestureMenu!: HTMLDetailsElement;
  let helpMenu!: HTMLDetailsElement;
  let portraitMenu!: HTMLDetailsElement;
  let appSettingsMenu!: HTMLDetailsElement;
  let drawing = false;
  let activeDrawingTool: Preview["type"] = "pen";
  let currentPoints: StrokePoint[] = [];
  type StrokePathCache = { length: number; pressureAware: boolean; path?: Path2D; pressurePaths: Map<number, Path2D> };
  const strokePathCache = new WeakMap<StrokePoint[], StrokePathCache>();
  let penEraserDrawing = false;
  let laserTimer: number | undefined;
  let saveInFlight = false;
  let restartAutosave: (() => void) | undefined;
  let lastSavedRaw: string | undefined;
  let syncObserved = new Map<string, string>();
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
  let moveOrigin: { indices: number[]; point: Point; before: Element[]; moved: boolean; dx: number; dy: number; snapTargets: { x: number[]; y: number[] }; targets: Map<string, Element> } | undefined;
  let marqueeOrigin: { point: Point; additive: boolean; moved: boolean; cropIndex?: number } | undefined;
  let resizeOrigin: { index: number; handle: string; start: Point; original: Element; before: Element[]; moved: boolean } | undefined;
  const [nativeBusy, setNativeBusy] = createSignal(false);
  const [documentBusy, setDocumentBusy] = createSignal(false);
  const [openToolOptions, setOpenToolOptions] = createSignal<Tool>();
  const [stencilMenuOpen, setStencilMenuOpen] = createSignal(false);
  const [paintBrushMenuOpen, setPaintBrushMenuOpen] = createSignal(false);
  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number; world: Point }>();
  const [pageDialog, setPageDialog] = createSignal<"rename" | "delete">();
  const [pageName, setPageName] = createSignal("");
  const [exportScope, setExportScope] = createSignal<"drawing" | "selection" | "viewport">("drawing");
  const [exportGrid, setExportGrid] = createSignal(false);
  const [pdfPaper, setPdfPaper] = createSignal<"a4" | "letter" | "a3" | "legal" | "tabloid" | "custom">("a4");
  const [pdfPageSet, setPdfPageSet] = createSignal<"current" | "all" | "range">("current");
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
  const pageHistories = new Map<string, { undo: Element[][]; redo: Element[][] }>();

  function rememberPageHistory() { pageHistories.set(activePageId(), { undo: undoStack, redo: redoStack }); }
  function restorePageHistory() { const history = pageHistories.get(activePageId()); undoStack = history?.undo ?? []; redoStack = history?.redo ?? []; setHistoryVersion(v => v + 1); }
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
  function precision(property: "x" | "y" | "w" | "h" | "rotation", value: number) {
    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000) return;
    changeSelected(item => {
      const bounds = elementBounds(item);
      if (property === "x" || property === "y") return moveElement(item, property === "x" ? value - bounds.x : 0, property === "y" ? value - bounds.y : 0);
      if (property === "rotation") return isConnector(item) || item.type === "group" ? item : { ...item, rotation: value % 360 };
      if (item.type === "text") return { ...item, fontSize: Math.round(Math.max(8, Math.min(160, item.fontSize * value / Math.max(1, bounds[property])))) };
      if (item.type === "group" || item.type === "freehand" || isConnector(item)) return item;
      return { ...item, [property]: Math.max(2, value) };
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
    if (!isWindowsPlatform() || !item.autoRoute || (item.type !== "line" && item.type !== "arrow")) return item;
    return { ...item, lineRoute: item.type === "line" ? "straight" : undefined, arrowRoute: item.type === "arrow" ? "straight" : undefined, routePoints: autoRoutePoints(item, sourceItems) };
  }
  function connectorHandles(item: ShapeElement) {
    const viewItem = connectorForView(item);
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
    const points = item.routePoints?.length ? item.routePoints : route === "multi" ? [0.2, 0.4, 0.6, 0.8].map((ratio) => ({ x: item.x + item.w * ratio, y: item.y + item.h * ratio })) : route === "straight" ? [{ x: item.x + item.w / 2, y: item.y + item.h / 2 }] : route === "elbow" ? [{ x: item.x + item.w, y: item.y }] : route === "jagged" ? jaggedVertices(item).slice(1, -1) : route === "curve" || route === "curve2" || route === "curve3" || route === "loop" ? curveControlPoints(item, route) : [forkGeometry(item).junction];
    return [{ id: "start", x: item.x, y: item.y }, { id: "end", x: item.x + item.w, y: item.y + item.h }, ...points.map((point, index) => ({ ...point, id: `route:${index}` }))];
  }
  function resizeConnector(item: ShapeElement, handle: string, point: Point): ShapeElement {
    const port = nearestBinding(elements(), point, 18 / canvasState().zoom); setAttachmentHint(port?.point);
    const target = port?.point ?? snap(point);
    if (handle === "start") return { ...item, x: target.x, y: target.y, w: item.x + item.w - target.x, h: item.y + item.h - target.y, startBinding: port?.binding, rotation: 0 };
    if (handle === "end") return { ...item, w: target.x - item.x, h: target.y - item.y, endBinding: port?.binding, rotation: 0 };
    const autoRouteMatch = /^auto-route:(\d+)$/.exec(handle);
    if (autoRouteMatch && item.autoRoute) {
      const route = connectorForView(item).routePoints ?? []; const routeIndex = Number(autoRouteMatch[1]);
      const pins = [...(item.routeWaypoints ?? [])];
      const existingPin = pins.findIndex(pin => Math.hypot(pin.x - route[routeIndex]?.x, pin.y - route[routeIndex]?.y) < .01);
      if (existingPin >= 0) pins[existingPin] = snap(point);
      else {
        const routePosition = (pin: Point) => route.reduce((best, current, index) => Math.hypot(current.x - pin.x, current.y - pin.y) < Math.hypot(route[best].x - pin.x, route[best].y - pin.y) ? index : best, 0);
        const insertAt = pins.findIndex(pin => routePosition(pin) > routeIndex);
        pins.splice(insertAt < 0 ? pins.length : insertAt, 0, snap(point));
      }
      return { ...item, routeWaypoints: pins };
    }
    const branchMatch = /^fork:(upper|lower):(end|route)(?::(\d+))?$/.exec(handle);
    if (branchMatch) {
      const name = branchMatch[1] as "upper" | "lower"; const branchKey = name === "upper" ? "forkUpper" : "forkLower";
      const branch = { ...(item[branchKey] ?? {}) };
      if (branchMatch[2] === "end") return { ...item, [branchKey]: { ...branch, end: target, endBinding: port?.binding } };
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
      return { ...item, x: start.x, y: start.y, w: finish.x - start.x, h: finish.y - start.y, [end === "start" ? "startBinding" : "endBinding"]: undefined };
    });
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
    const shape = elements()[index]; if (!shape || !isLabelShape(shape) || shape.locked || boardLocked()) return;
    commitTextDraft(); setSelectedIndices([index]); setTool("select");
    textEditorPendingPointerId = isWindowsPlatform() ? undefined : pointerId;
    const box = labelBox(shape); const label = shape.label;
    setTextDraft({ x: box.x, y: box.y, width: box.w, height: box.h, rotation: shape.rotation ?? 0, value: label?.text ?? "", editingIndex: index, shapeLabel: true, color: label?.color ?? color(), opacity: label?.opacity ?? 1, fontSize: label?.fontSize ?? defaultFontSize(), fontFamily: label?.fontFamily ?? defaultFontFamily(), bold: label?.bold ?? defaultBold(), italic: label?.italic ?? defaultItalic(), underline: label?.underline ?? defaultUnderline(), textAlign: label?.textAlign ?? "center", listType: label?.listType ?? "none", verticalAlign: label?.verticalAlign ?? "middle" });
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
    setTextDraft(draft => draft?.shapeLabel ? { ...draft, [property]: value } : draft);
    changeSelected(item => isLabelShape(item) ? { ...item, label: { text: "", color: color(), fontSize: 16, verticalAlign: "middle", ...item.label, [property]: value } } : item);
  }
  function drawLabel(ctx: CanvasRenderingContext2D, shape: ShapeElement) {
    const label = shape.label; if (!label?.text) return;
    ctx.save(); ctx.font = textFont(label); ctx.fillStyle = themeInk(label.color, theme()); ctx.globalAlpha = (shape.opacity ?? 1) * (label.opacity ?? 1); ctx.textBaseline = "top"; ctx.textAlign = "left";
    const box = labelBox(shape); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
    for (const run of textLayout(ctx, shape)) { ctx.fillText(run.text, run.x, run.y); if (label.underline) ctx.fillRect(run.x, run.y + label.fontSize * 1.06, ctx.measureText(run.text).width, Math.max(1, label.fontSize / 18)); }
    ctx.restore();
  }
  function labelSvg(shape: ShapeElement) {
    const label = shape.label; const ctx = canvas.getContext("2d"); if (!label?.text || !ctx) return "";
    return `<g fill="${escapeXml(themeInk(label.color, theme()))}" opacity="${(shape.opacity ?? 1) * (label.opacity ?? 1)}" font-size="${label.fontSize}" font-family="${label.fontFamily === "hand" ? "cursive" : "sans-serif"}" font-weight="${label.bold ? 700 : 400}" font-style="${label.italic ? "italic" : "normal"}" text-decoration="${label.underline ? "underline" : "none"}">${textLayout(ctx, shape).map(run => `<text x="${run.x}" y="${run.y + label.fontSize * .8}">${escapeXml(run.text)}</text>`).join("")}</g>`;
  }

  const fileName = () => activePath() ? displayPathName(activePath()!) : "Untitled sketch";
  const currentPage = () => pages().find((page) => page.id === activePageId());
  const theme = (): Theme => themeMode() === "system" ? systemDark() ? "dark" : "light" : themeMode() as Theme;
  const toolbarColor = () => toolbarColorChoice() === "auto" ? theme() === "dark" ? "#252c31" : "#f8faf7" : toolbarColorChoice();
  const selectedSet = createMemo(() => new Set(selectedIndices()));
  const selectedElements = () => selectedIndices().flatMap((index) => elements()[index] ? [elements()[index]] : []);
  const primarySelection = () => selectedIndices()[selectedIndices().length - 1];
  const groupSelected = () => { const selected = selectedElements(); return selected.length === 1 && selected[0]?.type === "group" && !selected[0].note; };
  const groupActionEnabled = () => { const selected = selectedElements(); if (selected.length === 1 && selected[0]?.type === "group" && selected[0].note) return false; return groupSelected() ? !selected[0]?.locked : selected.filter((element) => !element.locked).length >= 2; };
  const focusedElement = (): Element | undefined => {
    let element = primarySelection() === undefined ? undefined : elements()[primarySelection()!];
    while (element?.type === "group" && !element.note) element = element.elements[element.elements.length - 1];
    return element;
  };
  const selectedLabel = () => { const item = focusedElement(); return item && isLabelShape(item) ? item.label : undefined; };
  const selectedText = () => textDraft() ?? (() => { const item = focusedElement(); return item?.type === "text" ? item : selectedLabel(); })();
  const styleTargetElement = () => { const focused = focusedElement(); return tool() === "select" || focused?.type === tool() ? focused : undefined; };
  const hasStyleSelection = () => !!styleTargetElement() && selectedIndices().length > 0;
  const selectedColor = () => { const draft = textDraft(); if (draft) return draft.color; const element = styleTargetElement(); return element && "color" in element ? element.color : color(); };
  const selectedThickness = () => { const element = styleTargetElement(); return Math.round(element && "thickness" in element ? element.thickness : thickness()); };
  const selectedOpacity = () => { const element = focusedElement(); return element && "opacity" in element ? element.opacity ?? 1 : 1; };
  const selectedFillColor = () => { const element = styleTargetElement(); return element && "fillColor" in element ? element.fillColor : undefined; };
  const sidebarVisible = () => !!activePath();
  const showStrokeControls = () => { const focused = focusedElement(); return tool() !== "bucket" && (
    tool() === "pen" || tool() === "rectangle" || tool() === "circle" || tool() === "diamond" || tool() === "triangle" || tool() === "flowchart" || tool() === "line" || tool() === "arrow" || tool() === "text" ||
    (tool() === "select" && !!focused && "color" in focused)
  ); };
  const showThicknessControls = () => { const focused = focusedElement(); return tool() !== "bucket" && tool() !== "text" && (
    tool() === "pen" || tool() === "rectangle" || tool() === "circle" || tool() === "diamond" || tool() === "triangle" || tool() === "flowchart" || tool() === "line" || tool() === "arrow" || tool() === "eraser" ||
    (tool() === "select" && !!focused && "thickness" in focused)
  ); };
  const isPenBrushThicknessTarget = () => tool() === "pen" || (tool() === "select" && focusedElement()?.type === "freehand");
  const quickElementType = () => tool() === "select" ? focusedElement()?.type ?? "select" : tool();
  const quickShapeSelection = () => { const focused = focusedElement(); return focused && "thickness" in focused ? focused as ShapeElement : undefined; };
  const quickHasShapeFill = () => ["rectangle", "circle", "diamond", "triangle", "flowchart"].includes(quickElementType());
  const quickHasText = () => quickElementType() === "text" || !!(styleTargetElement() && (isLabelShape(styleTargetElement()!) || styleTargetElement()!.type === "schemaTable" || !!styleTargetElement()!.componentId));
  const selectedNoteCard = () => { const element = primarySelection() === undefined ? undefined : elements()[primarySelection()!]; return element?.type === "group" && element.note ? element : undefined; };
  const quickHasNoteCard = () => !!selectedNoteCard() && tool() === "select";
  const quickCardFontSize = () => {
    const focused = focusedElement();
    const componentText = focused?.componentId ? elements().find(item => item.componentId === focused.componentId && item.type === "text") : undefined;
    const size = noteEditor()?.fontSize ?? selectedNoteCard()?.note?.fontSize ?? (focused?.type === "schemaTable" ? focused.fontSize ?? 14 : undefined) ?? (componentText?.type === "text" ? componentText.fontSize : undefined) ?? selectedText()?.fontSize ?? defaultFontSize();
    return Math.round(size);
  };
  const quickIsConnector = () => quickElementType() === "line" || quickElementType() === "arrow";
  const quickRouteChoices = () => quickElementType() === "arrow" ? ARROW_ROUTES : LINE_ROUTES;
  const quickCurrentRoute = () => { const focused = styleTargetElement(); if (quickElementType() === "arrow") return focused?.type === "arrow" ? focused.arrowRoute ?? "straight" : arrowRoute(); return focused?.type === "line" ? focused.lineRoute ?? "straight" : lineRoute(); };
  const quickCurrentLineStyle = () => { const focused = styleTargetElement(); return focused && "lineStyle" in focused ? focused.lineStyle ?? "solid" : lineStyle(); };
  const quickFocusedHasLineStyle = () => { const focused = styleTargetElement(); return !!focused && "lineStyle" in focused; };
  const quickArrowHead = (end: "start" | "end") => { const focused = styleTargetElement(); if (focused && isConnector(focused)) return (end === "start" ? focused.startHead : focused.endHead) ?? (focused.type === "arrow" && end === "end" ? "open" : "none"); if (tool() === "line") return end === "start" ? defaultLineStartHead() : defaultLineEndHead(); return end === "start" ? defaultStartHead() : defaultEndHead(); };
  const renderedBoardColor = () => boardColorFollowsTheme() ? theme() === "dark" ? "#17191f" : "#ffffff" : boardColor();
  const updateStrokeColor = (value: string) => { const selected = styleTargetElement(); if (boardLocked() || selected?.locked) return; if (textDraft()?.shapeLabel) { updateLabel("color", value); return; } setColor(value); setTextDraft((draft) => draft ? { ...draft, color: value } : undefined); if (hasStyleSelection()) updateProperty("color", value); };
  const updateThickness = (value: number) => { const bounded = Math.max(1, Math.min(24, Math.round(value))); setThickness(bounded); if (hasStyleSelection()) updateProperty("thickness", bounded); };
  const setThicknessPickerPreference = (mode: "presets" | "stepper") => { setThicknessPickerMode(mode); try { localStorage.setItem("sketchdraw-thickness-picker", mode); } catch { /* The setting still applies for this session. */ } };
  const status = () => !activePath() ? "No file selected" : readOnlyView() ? "View only · changes are not saved" : saving() ? "Saving…" : (dirty() || textDraft()) ? "Unsaved changes" : savedAt() ? `Saved ${savedAt()}` : "Saved locally";
  function observeFileSync(serializedPages: SketchPage[], project: ProjectWorkspaceData, library: PersonalLibraryData) {
    if (!activePath()) return;
    const current = new Map<string, string>();
    for (const page of serializedPages) {
      current.set(`p:${page.id}`, JSON.stringify({ name: page.name, canvasState: page.canvasState }));
      for (const element of page.elements) if (element.id) current.set(`e:${page.id}:${element.id}`, JSON.stringify(element));
    }
    current.set("w:meta", JSON.stringify({ name: project.name, description: project.description }));
    for (const note of project.notes) current.set(`w:n:${note.id}`, JSON.stringify(note));
    for (const task of project.tasks) current.set(`w:t:${task.id}`, JSON.stringify(task));
    for (const milestone of project.milestones) current.set(`w:m:${milestone.id}`, JSON.stringify(milestone));
    for (const entry of project.logEntries) current.set(`w:l:${entry.id}`, JSON.stringify(entry));
    for (const file of project.files) current.set(`w:f:${file.id}`, JSON.stringify(file));
    for (const note of library.quickNotes) current.set(`w:quick-note:${note.id}`, JSON.stringify(note));
    for (const note of library.studyNotes) current.set(`w:sn:${note.id}`, JSON.stringify(note));
    for (const card of library.studyCards) current.set(`w:sc:${card.id}`, JSON.stringify(card));
    for (const article of library.wikiArticles) current.set(`w:wiki:${article.id}`, JSON.stringify(article));
    for (const entry of library.journalEntries) current.set(`w:journal:${entry.id}`, JSON.stringify(entry));
    for (const draft of library.writingDrafts) current.set(`w:writing:${draft.id}`, JSON.stringify(draft));
    for (const source of library.researchSources) current.set(`w:research:${source.id}`, JSON.stringify(source));
    for (const entry of library.mediaEntries) current.set(`w:media:${entry.id}`, JSON.stringify(entry));
    const now = Date.now();
    const previous = windowsSyncMetadata() ?? createWindowsSyncMetadata();
    const clocks = { ...previous.clocks };
    const tombstones = { ...previous.tombstones };
    let changed = false;
    for (const [key, value] of current) {
      const old = syncObserved.get(key);
      if (old !== undefined && old !== value) { clocks[key] = now; delete tombstones[key]; changed = true; }
      else if (old === undefined && !clocks[key] && !tombstones[key]) { clocks[key] = previous.updatedAt || now; changed = true; }
    }
    for (const key of syncObserved.keys()) if (!current.has(key)) { tombstones[key] = now; delete clocks[key]; changed = true; }
    syncObserved = current;
    if (changed) setWindowsSyncMetadata({ ...previous, updatedAt: now, deviceId: getWindowsDeviceId(), clocks, tombstones });
  }

  function documentSnapshot(): SketchFile {
    const sourcePages = pages().length ? pages() : [{ id: "page-1", name: "Page 1", canvasState: canvasState(), elements: elements() }];
    const serializedPages = sourcePages.map((page) => {
      const isCurrent = page.id === activePageId() || (!activePageId() && sourcePages.length === 1);
      const pageElements = isCurrent ? elements() : page.elements;
      const normalized = pageElements.map(normalizeElement);
      if (normalized.some((element) => !element)) throw new Error(`The drawing contains an element that cannot be saved in SketchDraw format v${SKETCH_FORMAT_VERSION}.`);
      const state = isCurrent ? canvasState() : page.canvasState;
      return { id: page.id, name: page.name, canvasState: { ...state, backgroundColor: isCurrent ? renderedBoardColor() : (state.boardColorFollowsTheme ? (theme() === "dark" ? "#17191f" : "#ffffff") : state.backgroundColor), boardColorFollowsTheme: state.boardColorFollowsTheme ?? true }, elements: normalized as Element[] };
    });
    const project = projectWorkspaceData();
    const library = personalLibraryData();
    observeFileSync(serializedPages, project, library);
    return { format: "SketchDraw", version: SKETCH_FORMAT_VERSION, activePageId: activePageId() || serializedPages[0].id, pages: serializedPages, project, library, ...(windowsSyncMetadata() ? { windowsSync: windowsSyncMetadata() } : {}) };
  }
  function snapshotRaw(snapshot: SketchFile) {
    const document: SketchFileDocumentV8 = {
      format: "SketchDraw",
      version: SKETCH_FORMAT_VERSION,
      sections: {
        canvas: { activePageId: snapshot.activePageId, pages: snapshot.pages },
        planning: snapshot.project ?? createProjectWorkspace(),
        library: snapshot.library ?? createPersonalLibrary(),
      },
      ...(snapshot.windowsSync ? { windowsSync: snapshot.windowsSync } : {}),
    };
    return JSON.stringify(document, null, 2);
  }
  createEffect(() => {
    const path = activePath(); const currentPages = pages(); const currentPageId = activePageId(); const currentElements = elements(); const currentState = canvasState(); const currentProject = projectWorkspaceData(); const currentLibrary = personalLibraryData();
    if (!path || !currentPages.length || !currentPageId) return;
    if (syncObservationTimer !== undefined) window.clearTimeout(syncObservationTimer);
    const observedPages = currentPages.map(page => page.id === currentPageId ? { ...page, elements: currentElements, canvasState: currentState } : page);
    syncObservationTimer = window.setTimeout(() => observeFileSync(observedPages, currentProject, currentLibrary), 250);
  });
  function storeCurrentPage() {
    const id = activePageId();
    if (!id) return;
    setPages((items) => items.map((page) => page.id === id ? { ...page, elements: cloneElements(elements()), canvasState: { ...canvasState(), backgroundColor: renderedBoardColor(), boardColorFollowsTheme: boardColorFollowsTheme() } } : page));
  }
  function switchPage(id: string) {
    if (id === activePageId()) return;
    const target = pages().find((page) => page.id === id);
    if (!target) return;
    commitTextDraft(); rememberPageHistory(); storeCurrentPage();
    setElements(cloneElements(target.elements)); setCanvasState({ ...target.canvasState }); setBoardColor(target.canvasState.backgroundColor); setBoardColorFollowsTheme(target.canvasState.boardColorFollowsTheme ?? false);
    setActivePageId(id); setSelectedIndices([]); setHoveredIndex(undefined); setTextDraft(undefined); setMarquee(undefined);
    restorePageHistory(); setDirty(!readOnlyView());
  }
  function addPage() {
    if (boardLocked()) return;
    if (pages().length >= 100) { setError("A sketch can contain up to 100 pages."); return; }
    commitTextDraft(); storeCurrentPage(); rememberPageHistory();
    const number = pages().length + 1; const page: SketchPage = { id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: `Page ${number}`, canvasState: emptyCanvas(), elements: [] };
    setPages((items) => [...items, page]); setActivePageId(page.id); setElements([]); setCanvasState(emptyCanvas()); setBoardColor("#ffffff"); setBoardColorFollowsTheme(true); setSelectedIndices([]); setDirty(true);
    undoStack = []; redoStack = []; setHistoryVersion((version) => version + 1);
  }
  function deleteCurrentPage() {
    if (boardLocked() || pages().length <= 1) return;
    const nextPages = pages().filter((page) => page.id !== activePageId()); const target = nextPages[Math.max(0, pages().findIndex((page) => page.id === activePageId()) - 1)] ?? nextPages[0];
    setPages(nextPages); setActivePageId(target.id); setElements(cloneElements(target.elements)); setCanvasState({ ...target.canvasState }); setBoardColor(target.canvasState.backgroundColor); setBoardColorFollowsTheme(target.canvasState.boardColorFollowsTheme ?? false); setSelectedIndices([]); setTextDraft(undefined); setHoveredIndex(undefined); setMarquee(undefined); restorePageHistory(); setDirty(true);
  }
  const canUndo = () => { historyVersion(); return undoStack.length > 0; };
  const canRedo = () => { historyVersion(); return redoStack.length > 0; };
  const toWorld = (event: PointerEvent): Point => {
    const rect = canvas.getBoundingClientRect(); const state = canvasState();
    return { x: (event.clientX - rect.left - state.panX) / state.zoom, y: (event.clientY - rect.top - state.panY) / state.zoom };
  };
  const strokePointFromPointer = (event: PointerEvent, point: Point): StrokePoint => event.pointerType !== "pen" ? point : {
    ...point,
    ...(penPressure() ? { pressure: Math.max(0, Math.min(1, event.pressure > 0 ? event.pressure : .5)) } : {}),
    ...(penTilt() ? { tiltX: Math.max(-90, Math.min(90, event.tiltX)), tiltY: Math.max(-90, Math.min(90, event.tiltY)) } : {}),
  };
  const snap = (point: Point): Point => {
    if (!snapToGrid()) return point;
    if (whiteboardStyle() === "isometric") {
      const rowStep = GRID_SIZE * Math.sqrt(3) / 2;
      const row = Math.round(point.y / rowStep);
      const phase = Math.abs(row % 2) === 1 ? GRID_SIZE / 2 : 0;
      return { x: Math.round((point.x - phase) / GRID_SIZE) * GRID_SIZE + phase, y: row * rowStep };
    }
    return { x: Math.round(point.x / GRID_SIZE) * GRID_SIZE, y: Math.round(point.y / GRID_SIZE) * GRID_SIZE };
  };

  function pushUndo(before: Element[]) {
    undoStack.push(before);
    if (undoStack.length > 100) undoStack.shift();
    redoStack = [];
    setHistoryVersion((version) => version + 1);
  }
  function undo() {
    if (boardLocked()) return;
    if (!undoStack.length) return;
    redoStack.push(cloneElements(elements()));
    setElements(undoStack.pop()!); setSelectedIndices([]); setDirty(true); setHistoryVersion((version) => version + 1);
  }
  function redo() {
    if (boardLocked()) return;
    if (!redoStack.length) return;
    undoStack.push(cloneElements(elements()));
    setElements(redoStack.pop()!); setSelectedIndices([]); setDirty(true); setHistoryVersion((version) => version + 1);
  }
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
  const deletableSelectionCount = () => selectedIndices().filter((index) => { const element = elements()[index]; return !!element && canMoveElement(element); }).length;

  function groupSelection() {
    if (boardLocked()) return;
    const indices = [...new Set(selectedIndices())].filter((index) => !!elements()[index] && !elements()[index].locked).sort((a, b) => a - b);
    const onlySelected = indices.length === 1 ? elements()[indices[0]] : undefined;
    if (onlySelected?.type === "group" && !onlySelected.note) { ungroupSelection(); return; }
    if (indices.length < 2) return;
    const before = cloneElements(elements()); const selected = new Set(indices); const first = indices[0];
    const children = indices.map((index) => elements()[index]); const grouped: Element[] = [];
    elements().forEach((element, index) => { if (index === first) grouped.push({ type: "group", elements: children }); if (!selected.has(index)) grouped.push(element); });
    setElements(grouped); pushUndo(before); setSelectedIndices([first]); setDirty(true);
  }

  function ungroupSelection() {
    if (boardLocked()) return;
    const indices = new Set(selectedIndices().filter(index => { const item = elements()[index]; return !!item && !item.locked && !(item.type === "group" && item.note); })); if (!indices.size) return;
    const before = cloneElements(elements()); const next: Element[] = []; const selectedAfter: number[] = []; let changed = false;
    elements().forEach((element, index) => {
      if (indices.has(index) && element.type === "group" && !element.note && !element.locked) {
        changed = true;
        const start = next.length; next.push(...element.elements);
        for (let offset = 0; offset < element.elements.length; offset++) selectedAfter.push(start + offset);
      } else next.push(element);
    });
    if (!changed) return;
    setElements(next); pushUndo(before); setSelectedIndices(selectedAfter); setDirty(true);
  }

  function updateProperty(property: "color" | "thickness" | "opacity" | "fontSize" | "fontFamily" | "fillColor" | "fillOpacity" | "bold" | "italic" | "underline" | "textAlign" | "listType" | "lineStyle" | "lineRoute" | "arrowRoute" | "flowchartShape" | "edgeStyle" | "cornerRadius" | "startHead" | "endHead" | "forkUpperHead" | "forkLowerHead", value: string | number | boolean | undefined) {
    if (boardLocked()) return;
    const indices = new Set(selectedIndices().filter((index) => !!elements()[index] && !elements()[index].locked)); if (!indices.size) return;
    const before = cloneElements(elements());
    const update = (element: Element): Element => {
      if (element.locked) return element;
      if (element.type === "group") return { ...element, elements: element.elements.map(update) };
      if (element.type === "schemaTable" && property === "fontSize") { const size = Math.max(8, Math.min(48, Math.round(Number(value)))); const headerHeight = Math.max(42, size * 2.8); const rowHeight = Math.max(30, size * 1.8); const neededWidth = Math.max(180, ...element.columns.map(column => (column.name.length + (column.dataType ?? "type").length) * size * .36 + 80)); return { ...element, fontSize: size, w: Math.max(element.w, neededWidth), h: Math.max(element.h, headerHeight + element.columns.length * rowHeight) }; }
      if (property === "color") return { ...element, color: String(value) } as Element;
      if (property === "opacity") return { ...element, opacity: Number(value) } as Element;
      if (property === "thickness" && "thickness" in element) return { ...element, thickness: Math.max(1, Math.round(Number(value))) } as Element;
      if (element.type === "text" && property === "fontSize") return { ...element, fontSize: Math.max(8, Math.round(Number(value))) };
      if (element.type === "text" && property === "fontFamily") return { ...element, fontFamily: value as TextElement["fontFamily"] };
      if (element.type === "text" && ["bold", "italic", "underline", "textAlign", "listType"].includes(property)) return { ...element, [property]: value } as Element;
      if (element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "triangle" || element.type === "flowchart") {
        if (property === "fillColor") return { ...element, fillColor: value ? String(value) : undefined };
        if (property === "fillOpacity") return { ...element, fillOpacity: Number(value) };
        if (property === "lineStyle") return { ...element, lineStyle: value as ShapeElement["lineStyle"] };
        if (property === "edgeStyle") return { ...element, edgeStyle: value as ShapeElement["edgeStyle"] };
        if (property === "cornerRadius") return { ...element, cornerRadius: Math.max(0, Math.min(100, Number(value))) };
      }
      if ((element.type === "line" || element.type === "arrow") && property === "lineStyle") return { ...element, lineStyle: value as ShapeElement["lineStyle"] };
      if (element.type === "line" && property === "lineRoute") {
        const route = value as LineRoute;
        const base = { ...element, routePoints: undefined };
        const points = route === "multi" ? [0.2, 0.4, 0.6, 0.8].map((ratio) => ({ x: element.x + element.w * ratio, y: element.y + element.h * ratio })) : ["curve", "curve2", "curve3"].includes(route) ? curveControlPoints(base, route) : undefined;
        return { ...element, lineRoute: route, routePoints: points, autoRoute: undefined, routeWaypoints: undefined };
      }
      if (element.type === "arrow" && property === "arrowRoute") return { ...element, arrowRoute: value as ArrowRoute, routePoints: undefined, autoRoute: undefined, routeWaypoints: undefined };
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
    changeSelected(item => {
      if (!isConnector(item)) return item;
      if (enabled) return { ...item, autoRoute: true, routePoints: undefined, routeWaypoints: [], ...(item.type === "line" ? { lineRoute: "straight" as const } : { arrowRoute: "straight" as const }) };
      const routePoints = connectorForView(item).routePoints;
      return { ...item, autoRoute: undefined, routeWaypoints: undefined, routePoints, ...(item.type === "line" ? { lineRoute: "straight" as const } : { arrowRoute: "straight" as const }) };
    });
  }

  function commitTextDraft() {
    textEditorPendingPointerId = undefined;
    textEditorFocusOnCanvasClick = false;
    if (textEditorFocusTimer !== undefined) { window.clearTimeout(textEditorFocusTimer); textEditorFocusTimer = undefined; }
    const draft = textDraft();
    if (draft?.shapeLabel && draft.editingIndex !== undefined) {
      const index = draft.editingIndex; const item = elements()[index];
      if (item && isLabelShape(item) && !item.locked && !boardLocked()) {
        const before = cloneElements(elements());
        const label: ShapeLabel = { text: draft.value, color: draft.color, opacity: draft.opacity, fontSize: draft.fontSize, fontFamily: draft.fontFamily, bold: draft.bold, italic: draft.italic, underline: draft.underline, textAlign: draft.textAlign, listType: draft.listType, verticalAlign: draft.verticalAlign ?? "middle" };
        setElements(items => items.map((element, i) => i === index ? { ...item, label: draft.value.trim() ? label : undefined } : element));
        if (JSON.stringify(before) !== JSON.stringify(elements())) { pushUndo(before); setDirty(true); }
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
    setNoteEditor({ x: bounds?.x ?? point.x, y: bounds?.y ?? point.y, width: group?.note?.width ?? bounds?.w ?? (kind === "sticky" ? 296 : 340), height: group?.note?.height ?? bounds?.h ?? 190, fontSize: group?.note?.fontSize ?? 14, kind, content: group?.note?.content ?? initial?.content ?? (kind === "checklist" ? "- [ ] New task" : ""), title: group?.note?.title ?? initial?.title ?? defaultNoteTitle(kind), editingIndex });
    setNoteEditorSession(session => session + 1);
  }

  function saveNoteEditor() {
    const draft = noteEditor();
    if (!draft || boardLocked()) return;
    if (draft.content.length > 50000) { setError("Notes and checklists are limited to 50,000 characters."); return; }
    const content = draft.kind === "checklist" && !draft.content.trim() ? "- [ ] New task" : draft.content;
    if (!content.trim() && !draft.title.trim()) { setNoteEditor(undefined); return; }
    if (normalizeNoteContent(content, draft.kind).length > 50000) {
      setError("Checklist task markers count toward the 50,000-character save limit. Shorten the checklist before saving it.");
      return;
    }
    const previous = draft.editingIndex === undefined ? undefined : elements()[draft.editingIndex];
    let group = buildNoteGroup(draft.x, draft.y, draft.kind, content, { width: draft.width, ...(draft.editingIndex !== undefined || draft.resized ? { height: draft.height } : {}), fontSize: draft.fontSize, title: draft.title });
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
    const textarea = noteEditorTextarea; const start = textarea.selectionStart; const end = textarea.selectionEnd;
    const table = "| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |\n| Cell | Cell |";
    const content = draft.content.slice(0, start) + table + draft.content.slice(end);
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
    if (readOnlyView() || boardLocked() || tool() === "text") return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect(); const view = canvasState();
    const point = { x: (event.clientX - rect.left - view.panX) / view.zoom, y: (event.clientY - rect.top - view.panY) / view.zoom };
    const hit = hitTest(point) ?? hitInterior(point); const target = hit === undefined ? undefined : elements()[hit];
    if (target?.type === "schemaTable") { openSchemaDialog(target.schemaDiagramId); return; }
    if (target?.type === "group" && target.mermaid) { openMermaidDialog(target.id); return; }
    if (target?.componentId?.startsWith("uml-class:")) { const shell = elements().find(item => item.componentId === target.componentId && item.componentRole === "class-shell"); const box = elementBounds(shell ?? target); openClassCardDialog(box.x, box.y, target.componentId); return; }
    if (target?.type === "group" && target.note) { if (!noteCollapseHit(target, point)) openNoteEditor(point, target.note.kind, hit); return; }
    if (hit !== undefined && isLabelShape(elements()[hit])) editShapeLabel(hit);
    else if (hit !== undefined && elements()[hit]?.type === "text") startTextDraft(point, hit);
    else if (isWindowsPlatform() || !isCompactTouchLayout()) startTextDraft(point);
  }

  function openClassCardDialog(x: number, y: number, componentId?: string) {
    const parts = componentId ? elements().filter(item => item.componentId === componentId) : [];
    const byRole = (role: string) => parts.find(item => item.componentRole === role);
    const name = byRole("class-name"); const attributes = byRole("class-attributes"); const methods = byRole("class-methods");
    setClassCardDraft({ x, y, name: name?.type === "text" ? name.text : "", attributes: attributes?.type === "text" ? attributes.text : "", methods: methods?.type === "text" ? methods.text : "", fontSize: name?.type === "text" ? name.fontSize : 13, componentId });
    setStencilMenuOpen(false);
  }

  function classCardElements(draft: NonNullable<ReturnType<typeof classCardDraft>>): Element[] {
        const fontSize = Math.max(8, Math.min(48, Math.round(draft.fontSize)));
    const longest = Math.max(12, ...[draft.name, draft.attributes, draft.methods].flatMap(text => text.split(/\r?\n/).map(line => line.length)));
    const width = Math.max(230, Math.min(640, longest * fontSize * .62 + 32));
    const wrap = (text: string) => text.split(/\r?\n/).flatMap(line => {
      const rows: string[] = []; let rest = line; const limit = Math.max(12, Math.floor((width - 28) / (fontSize * .62)));
      while (rest.length > limit) { let cut = rest.lastIndexOf(" ", limit); if (cut < 1) cut = limit; rows.push(rest.slice(0, cut)); rest = rest.slice(cut).trimStart(); }
      rows.push(rest); return rows;
    }).join("\n");
    const attrs = wrap(draft.attributes); const methods = wrap(draft.methods); const lineHeight = fontSize * 1.4;
    const attrHeight = Math.max(54, attrs.split("\n").length * lineHeight + 18); const methodHeight = Math.max(54, methods.split("\n").length * lineHeight + 18);
    const group = buildLibraryComponent("uml-class", draft.x, draft.y); const items = group.elements;
    const positions: { role: string; item: Element }[] = [
      { role: "class-shell", item: { ...items[0] as ShapeElement, w: width, h: 36 + attrHeight + methodHeight } },
      { role: "class-header", item: { ...items[1] as ShapeElement, w: width } },
      { role: "class-divider-name", item: { ...items[2] as ShapeElement, w: width, h: 0 } },
      { role: "class-divider-attributes", item: { ...items[3] as ShapeElement, y: draft.y + 36 + attrHeight, w: width, h: 0 } },
      { role: "class-name", item: { ...(items[4] as TextElement), text: draft.name, fontSize, x: draft.x + 12, y: draft.y + 10 } },
      { role: "class-attributes", item: { ...(items[5] as TextElement), text: attrs, fontSize, x: draft.x + 12, y: draft.y + 45 } },
      { role: "class-methods", item: { ...(items[6] as TextElement), text: methods, fontSize, x: draft.x + 12, y: draft.y + 45 + attrHeight } },
    ];
    const existing = draft.componentId ? elements().filter(item => item.componentId === draft.componentId) : [];
    const oldIds = new Map(existing.map(item => [item.componentRole, item.id]));
    const componentId = draft.componentId ?? `uml-class:${crypto.randomUUID()}`;
    return positions.map(({ role, item }) => ({ ...item, id: oldIds.get(role) ?? crypto.randomUUID(), componentId, componentRole: role } as Element));
  }

  function resizeClassCardFont(componentId: string, requestedSize: number) {
    const parts = elements().filter(item => item.componentId === componentId); const shell = parts.find(item => item.componentRole === "class-shell");
    if (!parts.length || !shell || shell.type !== "rectangle" || boardLocked() || parts.some(item => item.locked)) return false;
    const textFor = (role: string) => parts.find(item => item.componentRole === role);
    const name = textFor("class-name"); const attributes = textFor("class-attributes"); const methods = textFor("class-methods");
    const draft = { x: shell.x, y: shell.y, name: name?.type === "text" ? name.text : "", attributes: attributes?.type === "text" ? attributes.text : "", methods: methods?.type === "text" ? methods.text : "", fontSize: Math.max(8, Math.min(48, Math.round(requestedSize))), componentId };
    const before = cloneElements(elements()); const nextParts = classCardElements(draft); const indices = elements().flatMap((item, index) => item.componentId === componentId ? [index] : []);
    const insertAt = Math.min(...indices); const remove = new Set(indices); const next = elements().filter((_, index) => !remove.has(index)); next.splice(insertAt, 0, ...nextParts);
    setElements(next); setSelectedIndices(nextParts.map((_, offset) => insertAt + offset)); pushUndo(before); setDirty(true); return true;
  }

  function insertClassCard() {
    const draft = classCardDraft();
    if (!draft || !activePath() || boardLocked()) return;
    const parts = classCardElements(draft);
    const oldIndices = draft.componentId ? elements().flatMap((item, index) => item.componentId === draft.componentId ? [index] : []) : [];
    const insertion = oldIndices.length ? Math.min(...oldIndices) : elements().length; const remove = new Set(oldIndices);
    const next = elements().filter((_, index) => !remove.has(index)); next.splice(insertion, 0, ...parts);
    pushUndo(cloneElements(elements()));
    setElements(next);
    setSelectedIndices(parts.map((_, offset) => insertion + offset));
    setTool("select");
    setClassCardDraft(undefined);
    setDirty(true);
  }

  function insertLibraryComponent(kind: LibraryComponentKind) {
    if (!activePath() || boardLocked() || !canvas) return;
    const item = LIBRARY_COMPONENTS.find(component => component.kind === kind); if (!item) return;
    const rect = canvas.getBoundingClientRect(); const view = canvasState();
    const x = (rect.width / 2 - view.panX) / view.zoom - item.width / 2;
    const y = (rect.height / 2 - view.panY) / view.zoom - item.height / 2;
    const group = buildLibraryComponent(kind, x, y); const parts = group.elements; const index = elements().length;
    const moveAsUnit = new Set<LibraryComponentKind>(["uml-lifeline", "uml-inheritance", "uml-realization", "uml-aggregation", "uml-composition", "sequence-sync", "sequence-async", "er-one-many", "er-many-many", "tech-service", "data-flow"]).has(kind);
    const inserted: Element[] = moveAsUnit ? [{ ...group, id: crypto.randomUUID() }] : parts;
    pushUndo(cloneElements(elements())); setElements(items => [...items, ...inserted]); setSelectedIndices(inserted.map((_, offset) => index + offset)); setTool("select"); setStencilMenuOpen(false); setDirty(true);
  }

  function libraryIcon(kind: LibraryComponentKind) {
    const base = { viewBox: "0 0 32 32", "aria-hidden": true as const, focusable: false as const };
    if (kind === "uml-class") return <svg {...base}><rect x="5" y="4" width="22" height="24" rx="2"/><path d="M5 11h22M5 19h22M9 15h10M9 23h13"/></svg>;
    if (kind === "uml-lifeline") return <svg {...base}><rect x="8" y="3" width="16" height="7" rx="2"/><path d="M16 10v19" stroke-dasharray="2 2"/><circle cx="16" cy="6.5" r="1" fill="currentColor"/></svg>;
    if (kind === "uml-activation") return <svg {...base}><path d="M16 2v4m0 20v4"/><rect x="12" y="6" width="8" height="20" rx="1.5" fill="currentColor" fill-opacity=".16"/></svg>;
    if (kind === "sequence-sync" || kind === "sequence-async") return <svg {...base}><path d="M4 10h24M4 22h24"/>{kind === "sequence-sync" ? <path d="m22 18 6 4-6 4z" fill="currentColor"/> : <path d="m23 18 6 4-6 4"/>}<rect x="14" y="11" width="4" height="6" rx="1" fill="currentColor" fill-opacity=".18"/></svg>;
    if (kind === "uml-inheritance" || kind === "uml-realization") return <svg {...base}><path d="M4 16h21" stroke-dasharray={kind === "uml-realization" ? "3 2" : undefined}/><path d="m24 11 5 5-5 5z" fill="var(--stencil-icon-bg, #fff)"/></svg>;
    if (kind === "uml-aggregation" || kind === "uml-composition") return <svg {...base}><path d="M10 16h19"/><path d="m5 16 5-5 5 5-5 5z" fill={kind === "uml-composition" ? "currentColor" : "var(--stencil-icon-bg, #fff)"}/></svg>;
    if (kind === "er-table") return <svg {...base}><rect x="4" y="4" width="24" height="24" rx="2"/><path d="M4 11h24M14 11v17M14 17h14M14 23h14"/><path d="M7 15h4m-4 7h4" stroke-width="2"/></svg>;
    if (kind === "er-one-many") return <svg {...base}><path d="M3 16h20m0-6v12m0-12 6 6-6 6m0-6 6-6m-6 6 6 6"/><path d="M6 12v8" stroke-width="2"/></svg>;
    if (kind === "er-many-many") return <svg {...base}><path d="M9 10 3 16l6 6m0-12-6 6 6 6m14-12 6 6-6 6m0-12 6 6-6 6M9 16h14"/></svg>;
    if (kind === "c4-system") return <svg {...base}><circle cx="5" cy="16" r="2"/><circle cx="27" cy="16" r="2"/><rect x="8" y="5" width="16" height="22" rx="3" stroke-dasharray="3 2"/><rect x="11" y="11" width="10" height="10" rx="2"/><path d="M13 15h6m-6 3h4"/></svg>;
    if (kind === "c4-container") return <svg {...base}><rect x="4" y="4" width="24" height="24" rx="3" stroke-dasharray="3 2"/><rect x="7" y="9" width="8" height="12" rx="2"/><rect x="18" y="9" width="7" height="5" rx="1"/><rect x="18" y="17" width="7" height="5" rx="1"/></svg>;
    if (kind === "c4-component") return <svg {...base}><rect x="4" y="4" width="24" height="24" rx="3"/><rect x="8" y="9" width="7" height="6" rx="1"/><rect x="17" y="9" width="7" height="6" rx="1"/><rect x="8" y="17" width="16" height="6" rx="1"/></svg>;
    if (kind === "tech-database") return <svg {...base}><ellipse cx="16" cy="7" rx="10" ry="4"/><path d="M6 7v17c0 2.2 4.5 4 10 4s10-1.8 10-4V7M6 15c0 2.2 4.5 4 10 4s10-1.8 10-4"/></svg>;
    if (kind === "tech-cloud") return <svg {...base}><path d="M9 24h15a5 5 0 0 0 .7-10A8 8 0 0 0 9 11a6.5 6.5 0 0 0 0 13Z"/><path d="M13 18h6m-3-3v6"/></svg>;
    if (kind === "tech-service") return <svg {...base}><rect x="5" y="5" width="22" height="22" rx="5"/><path d="M16 10v3m0 6v3m-6-6h3m6 0h3m-10-4 2 2m4 4 2 2m0-8-2 2m-4 4-2 2"/><circle cx="16" cy="16" r="3"/></svg>;
    if (kind === "data-flow") return <svg {...base}><path d="M3 12h18M3 20h18" stroke-width="3" stroke-dasharray="3 2"/><path d="m20 7 8 9-8 9z" fill="currentColor"/></svg>;
    if (kind === "network-zone") return <svg {...base}><rect x="3" y="4" width="26" height="24" rx="4" stroke-dasharray="3 2"/><rect x="7" y="9" width="7" height="6" rx="1"/><rect x="18" y="17" width="7" height="6" rx="1"/><path d="m14 12 5 6"/></svg>;
    return <svg {...base}><path d="M5 5h22v22H5zM9 11h14M9 16h14M9 21h9"/></svg>;
  }

  function openSchemaDialog(diagramId?: string, initialSource?: string) {
    setSchemaError(""); setSchemaEditingDiagram(diagramId);
    const source = diagramId ? elements().find((item): item is SchemaTableElement => item.type === "schemaTable" && item.schemaDiagramId === diagramId)?.schemaSource : undefined;
    setSchemaInput(source ?? initialSource ?? ""); setSchemaDialog(true); setStencilMenuOpen(false);
  }

  function closeMermaidDialog() {
    setMermaidDialog(false); setMermaidEditingDiagram(undefined); setMermaidError("");
  }

  function openMermaidDialog(diagramId?: string) {
    const existing = diagramId ? elements().find((item): item is Extract<Element, { type: "group" }> => item.type === "group" && item.id === diagramId && !!item.mermaid) : undefined;
    if (diagramId && !existing) { setMermaidError("This Mermaid diagram is no longer available."); return; }
    setMermaidInput(existing?.mermaid?.source ?? "flowchart TD\n  Start([Start]) --> Check{Ready?}\n  Check -->|Yes| Done[Finish]\n  Check -->|No| Wait[Wait]");
    setMermaidError(""); setMermaidEditingDiagram(existing?.id); setMermaidDialog(true); setStencilMenuOpen(false);
  }

  function insertMermaidDiagram() {
    if (!activePath() || boardLocked() || !canvas) return;
    try {
      const source = mermaidInput().trim(); const parsed = parseMermaidFlowchart(source);
      const editingId = mermaidEditingDiagram(); const oldIndex = editingId ? elements().findIndex(item => item.type === "group" && item.id === editingId && !!item.mermaid) : -1;
      if (editingId && oldIndex < 0) throw new Error("This Mermaid diagram is no longer available.");
      const existing = oldIndex >= 0 ? elements()[oldIndex] as Extract<Element, { type: "group" }> : undefined;
      const rect = canvas.getBoundingClientRect(); const view = canvasState(); const bounds = existing ? elementBounds(existing) : undefined;
      const center = bounds ? { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 } : { x: (rect.width / 2 - view.panX) / view.zoom, y: (rect.height / 2 - view.panY) / view.zoom };
      const children = layoutMermaidFlowchart(parsed, center);
      const group: Extract<Element, { type: "group" }> = existing
        ? { ...existing, elements: children, mermaid: { source } }
        : { type: "group", id: crypto.randomUUID(), elements: children, mermaid: { source } };
      const groupIndex = oldIndex >= 0 ? oldIndex : elements().length; const before = cloneElements(elements());
      if (oldIndex >= 0) setElements(items => items.map((item, index) => index === oldIndex ? group : item));
      else setElements(items => [...items, group]);
      pushUndo(before); setSelectedIndices([groupIndex]); setTool("select"); setSidebarTab("properties"); closeMermaidDialog(); setDirty(true);
    } catch (cause) { setMermaidError(cause instanceof Error ? cause.message : String(cause)); }
  }

  function insertSchemaVisual() {
    if (!activePath() || boardLocked() || !canvas) return;
    try {
      const source = schemaInput().trim(); const parsedTables = parseSchema(source); const tableNames = new Set<string>();
      for (const table of parsedTables) {
        const tableName = table.name.toLowerCase(); if (tableNames.has(tableName)) throw new Error(`Table "${table.name}" appears more than once.`); tableNames.add(tableName);
        const columnNames = new Set<string>(); for (const column of table.columns) { const columnName = column.name.toLowerCase(); if (columnNames.has(columnName)) throw new Error(`Column "${column.name}" appears more than once in table "${table.name}".`); columnNames.add(columnName); }
      }
      const width = 268; const header = 42; const rowHeight = 30; const gapX = 88; const gapY = 64;
      const columnsPerRow = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(parsedTables.length))));
      const existing = schemaEditingDiagram() ? elements().filter((item): item is SchemaTableElement => item.type === "schemaTable" && item.schemaDiagramId === schemaEditingDiagram()) : [];
      const oldByName = new Map(existing.map(table => [table.name.toLowerCase(), table]));
      const cardFontSize = (table: (typeof parsedTables)[number]) => oldByName.get(table.name.toLowerCase())?.fontSize ?? 14;
      const cardWidth = (table: (typeof parsedTables)[number]) => Math.max(width, oldByName.get(table.name.toLowerCase())?.w ?? 0, ...table.columns.map(column => (column.name.length + column.type.length) * cardFontSize(table) * .36 + 80));
      const cardHeight = (table: (typeof parsedTables)[number]) => Math.max(oldByName.get(table.name.toLowerCase())?.h ?? 0, Math.max(header, cardFontSize(table) * 2.8) + table.columns.length * Math.max(rowHeight, cardFontSize(table) * 1.8));
      const columnWidths = Array.from({ length: columnsPerRow }, (_, col) => Math.max(...parsedTables.filter((_table, index) => index % columnsPerRow === col).map(cardWidth)));
      const rowHeights = Array.from({ length: Math.ceil(parsedTables.length / columnsPerRow) }, (_, row) => Math.max(...parsedTables.slice(row * columnsPerRow, (row + 1) * columnsPerRow).map(cardHeight)));
      const totalWidth = columnWidths.reduce((sum, item) => sum + item, 0) + (columnsPerRow - 1) * gapX; const totalHeight = rowHeights.reduce((sum, item) => sum + item, 0) + (rowHeights.length - 1) * gapY;
      const diagramId = schemaEditingDiagram() ?? crypto.randomUUID();
      const rect = canvas.getBoundingClientRect(); const view = canvasState(); const centerX = (rect.width / 2 - view.panX) / view.zoom; const centerY = (rect.height / 2 - view.panY) / view.zoom;
      const originX = existing.length ? Math.min(...existing.map(item => item.x)) : centerX - totalWidth / 2;
      const originY = existing.length ? Math.min(...existing.map(item => item.y)) : centerY - totalHeight / 2;
      const created: SchemaTableElement[] = parsedTables.map((table, tableIndex) => {
        const row = Math.floor(tableIndex / columnsPerRow); const col = tableIndex % columnsPerRow;
        const old = oldByName.get(table.name.toLowerCase()); const id = old?.id ?? crypto.randomUUID();
        const fieldsByName = new Map(old?.columns.map(field => [field.name.toLowerCase(), field]) ?? []);
        const fields: SchemaField[] = table.columns.map(column => ({ id: fieldsByName.get(column.name.toLowerCase())?.id ?? crypto.randomUUID(), name: column.name, dataType: column.type, primaryKey: column.primaryKey, foreignTable: column.foreignTable, foreignColumn: column.foreignColumn, nullable: column.nullable }));
        const fontSize = old?.fontSize ?? 14;
        return { type: "schemaTable", id, schemaDiagramId: diagramId, schemaSource: source, name: table.name, columns: fields, x: originX + columnWidths.slice(0, col).reduce((sum, current) => sum + current + gapX, 0), y: originY + rowHeights.slice(0, row).reduce((sum, current) => sum + current + gapY, 0), w: columnWidths[col], h: cardHeight(table), fontSize, rotation: 0, opacity: 1 };
      });
      const tableIds = new Set(existing.map(table => table.id));
      const removedRelations = new Set(elements().filter(item => isConnector(item) && item.schemaDiagramId === diagramId).map(item => item.id!));
      const byName = new Map(created.map(table => [table.name.toLowerCase(), table])); const relations: ShapeElement[] = [];
      for (const table of parsedTables) for (const field of table.columns) {
        if (!field.foreignTable) continue;
        const from = byName.get(table.name.toLowerCase()); const to = byName.get(field.foreignTable.toLowerCase()); if (!from || !to) continue;
        const sourceField = from.columns.find(value => value.name.toLowerCase() === field.name.toLowerCase());
        const targetField = field.foreignColumn ? to.columns.find(value => value.name.toLowerCase() === field.foreignColumn!.toLowerCase()) : to.columns.find(value => value.primaryKey) ?? to.columns[0];
        if (!sourceField || !targetField) continue;
        const forward = from.x <= to.x; const startBinding: Binding = { elementId: from.id!, rowId: sourceField.id, anchor: { x: forward ? 1 : 0, y: .5 } }; const endBinding: Binding = { elementId: to.id!, rowId: targetField.id, anchor: { x: forward ? 0 : 1, y: .5 } };
        const start = anchorPoint(from, startBinding.anchor, startBinding.rowId); const end = anchorPoint(to, endBinding.anchor, endBinding.rowId);
        relations.push({ type: "line", id: crypto.randomUUID(), schemaDiagramId: diagramId, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color: "#63859d", thickness: 1.6, lineStyle: "solid", startHead: "none", endHead: "open", startBinding, endBinding });
      }
      const before = cloneElements(elements()); const oldIds = new Set([...tableIds, ...removedRelations]);
      const kept = elements().filter(item => !oldIds.has(item.id ?? ""));
      const imported: Element[] = [...relations, ...created];
      pushUndo(before); setElements([...kept, ...imported]);
      const firstIndex = kept.length; setSelectedIndices(created.map((_item, index) => firstIndex + relations.length + index)); setTool("select"); setTextMode("text"); setDirty(true);
      setSchemaDialog(false); setSchemaInput(""); setSchemaError(""); setSchemaEditingDiagram(undefined);
    } catch (cause) { setSchemaError(cause instanceof Error ? cause.message : String(cause)); }
  }

  function fitDocumentToViewport(items: Element[]) {
    if (!canvas || items.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    const bounds = unionBounds(items.filter((element) => !element.hidden).map(elementBounds)); if (!bounds) return;
    const { x: left, y: top } = bounds; const right = left + bounds.w; const bottom = top + bounds.h;
    const width = Math.max(1, right - left); const height = Math.max(1, bottom - top);
    const inset = sidebarVisible() ? 330 : 40; const availableWidth = Math.max(100, rect.width - inset - 40); const availableHeight = Math.max(100, rect.height - 180);
    const zoom = Math.max(0.02, Math.min(4, availableWidth / width, availableHeight / height));
    setCanvasState({ zoom, panX: inset + (availableWidth - width * zoom) / 2 - left * zoom, panY: 90 + (availableHeight - height * zoom) / 2 - top * zoom, backgroundColor: renderedBoardColor(), boardColorFollowsTheme: boardColorFollowsTheme() });
    setDirty(!readOnlyView());
  }

  function resetZoomAndCenter() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); const current = canvasState();
    const centerWorld = { x: (rect.width / 2 - current.panX) / current.zoom, y: (rect.height / 2 - current.panY) / current.zoom };
    setCanvasState({ zoom: 1, panX: rect.width / 2 - centerWorld.x, panY: rect.height / 2 - centerWorld.y, backgroundColor: renderedBoardColor(), boardColorFollowsTheme: boardColorFollowsTheme() }); setDirty(!readOnlyView());
  }

  function rectanglePathPoints(element: ShapeElement): Point[] {
    const left = Math.min(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h);
    const width = Math.max(0, Math.abs(element.w)); const height = Math.max(0, Math.abs(element.h));
    const right = left + width; const bottom = top + height;
    return [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
  }

  function hitElement(element: Element, point: Point, zoom: number): boolean {
    if (element.hidden || element.locked) return false;
    if (element.type === "group") {
      if (element.elements.some((child) => hitElement(child, point, zoom))) return true;
      if (element.mermaid) { const box = elementBounds(element); const tolerance = 5 / zoom; return point.x >= box.x - tolerance && point.x <= box.x + box.w + tolerance && point.y >= box.y - tolerance && point.y <= box.y + box.h + tolerance; }
      return false;
    }
    const box = elementBounds(element); const center = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    if (element.rotation) { const angle = -element.rotation * Math.PI / 180; const dx = point.x - center.x; const dy = point.y - center.y; point = { x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle) }; }
    const tolerance = Math.max(5 / zoom, "thickness" in element ? element.thickness / 2 + 2 / zoom : 2 / zoom);
    if (element.type === "image") return point.x >= element.x - tolerance && point.x <= element.x + element.w + tolerance && point.y >= element.y - tolerance && point.y <= element.y + element.h + tolerance;
    if (element.type === "schemaTable") return point.x >= element.x - tolerance && point.x <= element.x + element.w + tolerance && point.y >= element.y - tolerance && point.y <= element.y + element.h + tolerance;
    if (element.type === "text") {
      const bounds = elementBounds(element);
      return point.x >= bounds.x - tolerance && point.x <= bounds.x + bounds.w + tolerance && point.y >= bounds.y - tolerance && point.y <= bounds.y + bounds.h + tolerance;
    }
    if (element.type === "line" || element.type === "arrow") {
      const routed = connectorForView(element);
      const route = routed.type === "arrow" ? routed.arrowRoute ?? "straight" : routed.lineRoute ?? "straight";
      for (const samples of connectorPolylines(routed, route, 33)) for (let index = 1; index < samples.length; index++) if (distanceToSegment(point, samples[index - 1], samples[index]) <= tolerance + (routed.lineStyle === "double" ? 3 : 0)) return true;
      for (const { tip, angle: direction, kind } of arrowHeadEntries(routed, route)) {
        if (kind === "dot" && Math.hypot(point.x - tip.x, point.y - tip.y) <= Math.max(4, routed.thickness * 1.5) + tolerance) return true;
        const points = arrowHeadPoints(tip, direction, kind, routed.thickness);
        if ((kind === "solid" || kind === "thick" || kind === "diamond") && pointInPolygon(point, points)) return true;
        for (let i = 0; i < points.length; i += kind === "open" ? 1 : 2) {
          const a = kind === "open" ? tip : points[i]; const b = kind === "open" ? points[i] : points[(i + 1) % points.length];
          if (distanceToSegment(point, a, b) <= tolerance) return true;
        }
      }
      return false;
    }
    if (isLabelShape(element) && element.label?.text) { const box = labelBox(element); if (point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h) return true; }
    if (element.type === "freehand") {
      for (let i = 1; i < element.points.length; i++) if (distanceToSegment(point, element.points[i - 1], element.points[i]) <= tolerance) return true;
      return element.points.length === 1 && Math.hypot(point.x - element.points[0].x, point.y - element.points[0].y) <= tolerance;
    }
    if (element.type === "rectangle") {
      const left = Math.min(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const width = Math.abs(element.w); const height = Math.abs(element.h);
      const radius = element.edgeStyle === "pill" ? Math.min(width, height) / 2 : element.edgeStyle === "rounded" ? Math.min(element.cornerRadius ?? 14, width / 2, height / 2) : 0;
      if (radius > 0 && canvas) { const context = canvas.getContext("2d"); if (context) { context.save(); context.setTransform(1, 0, 0, 1, 0, 0); context.beginPath(); context.roundRect(left, top, width, height, radius); const inside = !!element.fillColor && context.isPointInPath(point.x, point.y); context.lineWidth = tolerance * 2; const border = context.isPointInStroke(point.x, point.y); context.restore(); return inside || border; } }
      if (element.fillColor && point.x >= left && point.x <= left + width && point.y >= top && point.y <= top + height) return true;
      const points = rectanglePathPoints(element);
      for (let i = 0; i < points.length; i++) if (distanceToSegment(point, points[i], points[(i + 1) % points.length]) <= tolerance) return true;
      return false;
    }
    if (element.type === "diamond") {
      const left = Math.min(element.x, element.x + element.w); const right = Math.max(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const bottom = Math.max(element.y, element.y + element.h);
      const points = [{ x: (left + right) / 2, y: top }, { x: right, y: (top + bottom) / 2 }, { x: (left + right) / 2, y: bottom }, { x: left, y: (top + bottom) / 2 }];
      if (element.fillColor && pointInPolygon(point, points)) return true;
      for (let i = 0; i < points.length; i++) if (distanceToSegment(point, points[i], points[(i + 1) % points.length]) <= tolerance) return true;
      return false;
    }
    if (element.type === "triangle") {
      const left = Math.min(element.x, element.x + element.w); const right = Math.max(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const bottom = Math.max(element.y, element.y + element.h);
      const points = [{ x: (left + right) / 2, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
      if (element.fillColor && pointInPolygon(point, points)) return true;
      for (let i = 0; i < points.length; i++) if (distanceToSegment(point, points[i], points[(i + 1) % points.length]) <= tolerance) return true;
      return false;
    }
    if (element.type === "flowchart") {
      const context = canvas?.getContext("2d"); if (!context) return false;
      context.save(); context.setTransform(1, 0, 0, 1, 0, 0); const symbolPath = flowchartPathObject(element.flowchartShape ?? "process", element.x, element.y, element.w, element.h);
      if (!symbolPath) traceFlowchart(context, element.flowchartShape ?? "process", element.x, element.y, element.w, element.h);
      const inside = element.fillColor ? symbolPath ? context.isPointInPath(symbolPath, point.x, point.y) : context.isPointInPath(point.x, point.y) : false; context.lineWidth = tolerance * 2; let border = symbolPath ? context.isPointInStroke(symbolPath, point.x, point.y) : context.isPointInStroke(point.x, point.y);
      if ((element.flowchartShape ?? "process") === "database") {
        const left = Math.min(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const width = Math.abs(element.w); const height = Math.abs(element.h);
        if (width >= 1 && height >= 1) border ||= context.isPointInStroke(flowchartDatabaseRimPath(left, top, width, height), point.x, point.y);
      }
      context.restore();
      return inside || border;
    }
    const rx = Math.abs(element.w / 2); const ry = Math.abs(element.h / 2);
    if (rx < 0.01 || ry < 0.01) return false;
    const nx = (point.x - element.x - element.w / 2) / rx; const ny = (point.y - element.y - element.h / 2) / ry;
    if (element.fillColor && nx * nx + ny * ny <= 1) return true;
    const radialError = Math.abs(Math.hypot(nx, ny) - 1) * Math.min(rx, ry);
    return radialError <= tolerance;
  }

  function hitTest(point: Point): number | undefined {
    const zoom = canvasState().zoom;
    const tolerance = 12 / zoom;
    for (let index = elements().length - 1; index >= 0; index--) {
      const element = elements()[index]; const bounds = elementBounds(element);
      if (!intersectsBounds(point.x - tolerance, point.y - tolerance, point.x + tolerance, point.y + tolerance, bounds)) continue;
      if (hitElement(element, point, zoom)) return index;
    }
    return undefined;
  }

  function simpleComponentElement(element: Element): Element {
    if (componentAppearance() !== "simple" || !element.componentId?.startsWith("uml-class:")) return element;
    const ink = theme() === "dark" ? "#f0f0f0" : "#262626";
    if (element.type === "text") return { ...element, color: ink };
    if ("color" in element) return { ...element, color: ink, fillColor: undefined, fillOpacity: 0, edgeStyle: "sharp", cornerRadius: 0 } as Element;
    return element;
  }

  function strokePaths(points: StrokePoint[]): StrokePathCache | undefined {
    if (typeof Path2D === "undefined") return undefined;
    let cache = strokePathCache.get(points);
    if (cache && points.length < cache.length) cache = undefined;
    if (!cache) {
      cache = { length: 0, pressureAware: false, path: new Path2D(), pressurePaths: new Map() };
      strokePathCache.set(points, cache);
    }
    for (let index = cache.length; index < points.length; index++) {
      const point = points[index];
      const hasPressure = point.pressure !== undefined || point.tiltX !== undefined || point.tiltY !== undefined;
      if (hasPressure && !cache.pressureAware && index > 0) {
        cache = { length: 0, pressureAware: true, pressurePaths: new Map() };
        strokePathCache.set(points, cache);
        index = -1;
        continue;
      }
      cache.pressureAware ||= hasPressure;
      if (index === 0) {
        if (!cache.pressureAware) cache.path!.moveTo(point.x, point.y);
        cache.length = 1;
        continue;
      }
      const previous = points[index - 1];
      const from = index === 1 ? points[0] : { x: (points[index - 2].x + previous.x) / 2, y: (points[index - 2].y + previous.y) / 2 };
      const mid = { x: (previous.x + point.x) / 2, y: (previous.y + point.y) / 2 };
      if (cache.pressureAware) {
        const widthFactor = Math.max(.05, Math.round((stylusStrokeWidth(previous, 1) + stylusStrokeWidth(point, 1)) / 2 * 20) / 20);
        let path = cache.pressurePaths.get(widthFactor);
        if (!path) { path = new Path2D(); cache.pressurePaths.set(widthFactor, path); }
        path.moveTo(from.x, from.y); path.quadraticCurveTo(previous.x, previous.y, mid.x, mid.y);
      } else {
        cache.path!.quadraticCurveTo(previous.x, previous.y, mid.x, mid.y);
      }
      cache.length = index + 1;
    }
    return cache;
  }

  function intersectsBounds(left: number, top: number, right: number, bottom: number, bounds: Bounds) {
    return bounds.x <= right && bounds.x + bounds.w >= left && bounds.y <= bottom && bounds.y + bounds.h >= top;
  }

  function resolveDraggedConnector(element: Element, index: number, drag: NonNullable<typeof moveOrigin>): Element {
    if (!isConnector(element) || drag.indices.includes(index)) return element;
    const movedPoint = (binding?: Binding) => {
      const target = binding ? drag.targets.get(binding.elementId) : undefined;
      if (!binding || !target || !isConnectable(target)) return undefined;
      const point = anchorPoint(target, binding.anchor, binding.rowId);
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
    if (element.hidden) return;
    element = simpleComponentElement(element);
    if (element.type === "group") { if (element.note) { drawNoteCard(ctx, element, theme(), componentAppearance()); return; } for (const child of element.elements) if (!viewport || intersectsBounds(viewport.x, viewport.y, viewport.x + viewport.w, viewport.y + viewport.h, elementBounds(child))) drawElement(ctx, connectorForView(child as ShapeElement, sourceItems), viewport, sourceItems); return; }
    const elementBox = elementBounds(element); const centerX = elementBox.x + elementBox.w / 2; const centerY = elementBox.y + elementBox.h / 2;
    if (element.rotation) { ctx.save(); ctx.translate(centerX, centerY); ctx.rotate(element.rotation * Math.PI / 180); ctx.translate(-centerX, -centerY); }
    if (element.type === "image") {
      const image = imageCache.get(element.dataUrl);
      ctx.save(); ctx.globalAlpha = element.opacity ?? 1;
      if (image?.complete && image.naturalWidth) {
        const sx = element.cropX ?? 0; const sy = element.cropY ?? 0; const sw = element.cropW ?? image.naturalWidth; const sh = element.cropH ?? image.naturalHeight;
        ctx.drawImage(image, sx, sy, sw, sh, element.x, element.y, element.w, element.h);
      }
      ctx.restore(); if (element.rotation) ctx.restore(); return;
    }
    if (element.type === "text") {
      if (textDraft()?.editingIndex !== undefined && elements()[textDraft()!.editingIndex!]?.id === element.id) { if (element.rotation) ctx.restore(); return; }
      ctx.save(); ctx.globalAlpha = element.opacity ?? 1; ctx.fillStyle = themeInk(element.color, theme());
      ctx.font = (element.italic ? "italic " : "") + (element.bold ? "700 " : "400 ") + element.fontSize + "px " + fontCss(element.fontFamily); ctx.textBaseline = "top"; ctx.textAlign = element.textAlign === "justify" ? "left" : element.textAlign ?? "left";
      let lines = textLinesCache.get(element);
      if (!lines) { lines = element.text.split(/\r?\n/).map((line, index) => element.listType === "bullet" ? "• " + line : element.listType === "number" ? (index + 1) + ". " + line : line); textLinesCache.set(element, lines); }
      lines.forEach((line, index) => { const y = element.y + index * element.fontSize * 1.25; ctx.fillText(line, element.x, y); if (element.underline) { const measured = ctx.measureText(line).width; const startX = element.textAlign === "center" ? element.x - measured / 2 : element.textAlign === "right" ? element.x - measured : element.x; ctx.fillRect(startX, y + element.fontSize * 1.06, measured, Math.max(1, element.fontSize / 18)); } }); ctx.restore(); if (element.rotation) ctx.restore(); return;
    }
    if (element.type === "schemaTable") {
      const left = element.x; const top = element.y; const width = Math.abs(element.w); const height = Math.abs(element.h); const simple = componentAppearance() === "simple"; const fontSize = element.fontSize ?? 14; const rowHeight = Math.max(30, fontSize * 1.8); const headerHeight = Math.max(42, fontSize * 2.8); const dark = theme() === "dark";
      const surface = simple ? (dark ? "#202020" : "#ffffff") : (dark ? "#202a35" : "#fbfcfe"); const border = simple ? (dark ? "#b0b0b0" : "#555555") : (dark ? "#506174" : "#9badbf"); const header = simple ? surface : (dark ? "#30465b" : "#e8f0f7"); const rule = simple ? border : (dark ? "#394856" : "#e6ebf0");
      ctx.save(); ctx.globalAlpha = element.opacity ?? 1; ctx.fillStyle = surface; ctx.strokeStyle = border; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.roundRect(left, top, width, height, simple ? 0 : 10); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.roundRect(left, top, width, headerHeight + (simple ? 0 : 8), simple ? 0 : [10, 10, 0, 0]); ctx.clip(); ctx.fillStyle = header; ctx.fillRect(left, top, width, headerHeight); ctx.restore();
      ctx.beginPath(); ctx.moveTo(left, top + headerHeight); ctx.lineTo(left + width, top + headerHeight); ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.stroke();
      ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.fillStyle = simple ? (dark ? "#f3f3f3" : "#222222") : (dark ? "#d8e8f5" : "#36556e"); ctx.font = `600 ${fontSize}px ${fontCss("sans")}`;
      const fitText = (value: string, maxWidth: number) => {
        if (ctx.measureText(value).width <= maxWidth) return value;
        let low = 0; let high = value.length;
        while (low < high) { const middle = Math.ceil((low + high) / 2); if (ctx.measureText(value.slice(0, middle) + "…").width <= maxWidth) low = middle; else high = middle - 1; }
        return value.slice(0, low) + "…";
      };
      ctx.fillText(fitText(element.name, width - 26), left + 14, top + headerHeight / 2);
      element.columns.forEach((column, index) => {
        const rowTop = top + headerHeight + index * rowHeight; const middle = rowTop + rowHeight / 2;
        if (index) { ctx.beginPath(); ctx.moveTo(left + 10, rowTop); ctx.lineTo(left + width - 10, rowTop); ctx.strokeStyle = rule; ctx.lineWidth = .7; ctx.stroke(); }
        if (column.primaryKey || column.foreignTable) {
          const tag = column.primaryKey ? "PK" : "FK"; ctx.fillStyle = simple ? (dark ? "#3a3a3a" : "#eeeeee") : column.primaryKey ? (dark ? "#6a5930" : "#f4e9c7") : (dark ? "#31556b" : "#e1eff6"); ctx.beginPath(); ctx.roundRect(left + 11, middle - 8, 24, 16, simple ? 0 : 5); ctx.fill();
          ctx.fillStyle = simple ? (dark ? "#eeeeee" : "#333333") : column.primaryKey ? (dark ? "#f0d58c" : "#826b2f") : (dark ? "#aed9ed" : "#436e85"); ctx.font = "700 9px " + fontCss("sans"); ctx.textAlign = "center"; ctx.fillText(tag, left + 23, middle); ctx.textAlign = "left";
        }
        ctx.font = `${fontSize * .86}px ${fontCss("mono")}`; ctx.fillStyle = simple ? (dark ? "#eeeeee" : "#303030") : (dark ? "#dbe5ee" : "#354759"); ctx.fillText(fitText(column.name, width * .48), left + 44, middle);
        ctx.textAlign = "right"; ctx.font = `${fontSize * .78}px ${fontCss("mono")}`; ctx.fillStyle = simple ? (dark ? "#c8c8c8" : "#666666") : (dark ? "#a4b1bf" : "#768493"); ctx.fillText(fitText(column.dataType || "type", width * .37), left + width - 14, middle); ctx.textAlign = "left";
      });
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
        const firstPath = paths[0] ?? [];
        const lastPoint = firstPath[firstPath.length - 1];
        const dx = (lastPoint?.x ?? element.x + element.w) - (firstPath[0]?.x ?? element.x);
        const dy = (lastPoint?.y ?? element.y + element.h) - (firstPath[0]?.y ?? element.y);
        const angle = Math.atan2(dy, dx); const offset = Math.max(2.5, element.thickness * 1.2);
        for (const side of [-1, 1]) {
          ctx.save(); ctx.translate(-Math.sin(angle) * offset * side, Math.cos(angle) * offset * side); ctx.beginPath();
          for (const points of paths) { if (!points.length) continue; ctx.moveTo(points[0].x, points[0].y); for (const point of points.slice(1)) ctx.lineTo(point.x, point.y); }
          ctx.stroke(); ctx.restore();
        }
      } else { traceConnector(ctx, routeElement); ctx.stroke(); }
      if (element.type === "arrow" || element.type === "line") {
        for (const { tip, angle: direction, kind } of arrowHeadEntries(routeElement, route)) {
          if (kind === "none") continue;
          if (kind === "dot") { ctx.beginPath(); ctx.arc(tip.x, tip.y, Math.max(3, element.thickness * 1.15), 0, Math.PI * 2); ctx.fillStyle = renderedInk; ctx.fill(); continue; }
          const points = arrowHeadPoints(tip, direction, kind, element.thickness); ctx.beginPath();
          if (kind === "open") { ctx.moveTo(tip.x, tip.y); ctx.lineTo(points[0].x, points[0].y); ctx.moveTo(tip.x, tip.y); ctx.lineTo(points[1].x, points[1].y); }
          else { ctx.moveTo(points[0].x, points[0].y); for (let index = 1; index < points.length; index++) ctx.lineTo(points[index].x, points[index].y); if (["solid", "thick", "diamond"].includes(kind)) ctx.closePath(); }
          if (["solid", "thick", "diamond"].includes(kind)) { ctx.fillStyle = renderedInk; ctx.fill(); }
          ctx.stroke();
        }
      }
      ctx.restore(); if (element.rotation) ctx.restore(); return;
    }
    if (element.type === "freehand") {
      if (!element.points.length) { ctx.restore(); return; }
      const cache = strokePaths(element.points);
      const pressureAware = cache?.pressureAware ?? element.points.some(point => point.pressure !== undefined || point.tiltX !== undefined || point.tiltY !== undefined);
      if (pressureAware) {
        const pointWidth = (point: StrokePoint) => stylusStrokeWidth(point, element.thickness);
        ctx.fillStyle = renderedInk;
        const stamp = (point: StrokePoint) => {
          const tilt = Math.min(1, Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0) / 90); const width = pointWidth(point);
          ctx.beginPath(); ctx.ellipse(point.x, point.y, Math.max(.25, width * (.5 + tilt * .35)), Math.max(.25, width * .5), Math.atan2(point.tiltY ?? 0, point.tiltX ?? 0), 0, Math.PI * 2); ctx.fill();
        };
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        if (element.points.length === 1) stamp(element.points[0]);
        if (cache) for (const [widthFactor, path] of cache.pressurePaths) { ctx.lineWidth = Math.max(.75, widthFactor * element.thickness); ctx.stroke(path); }
        else {
          let from = element.points[0];
          for (let index = 1; index < element.points.length; index++) {
            const previous = element.points[index - 1]; const point = element.points[index];
            const mid = { x: (previous.x + point.x) / 2, y: (previous.y + point.y) / 2 };
            ctx.beginPath(); ctx.lineWidth = Math.max(.75, (pointWidth(previous) + pointWidth(point)) / 2); ctx.moveTo(from.x, from.y); ctx.quadraticCurveTo(previous.x, previous.y, mid.x, mid.y); ctx.stroke();
            from = mid;
          }
        }
        const lastPoint = element.points[element.points.length - 1];
        const previous = element.points.length > 1 ? element.points[element.points.length - 2] : lastPoint;
        const from = element.points.length > 1 ? { x: (previous.x + lastPoint.x) / 2, y: (previous.y + lastPoint.y) / 2 } : lastPoint;
        ctx.beginPath(); ctx.lineWidth = Math.max(.75, pointWidth(lastPoint)); ctx.moveTo(from.x, from.y); ctx.lineTo(lastPoint.x, lastPoint.y); ctx.stroke();
        if (element.points.length > 1) { stamp(element.points[0]); stamp(element.points[element.points.length - 1]); }
      } else {
        if (element.points.length === 1) {
          const point = element.points[0];
          ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(.5, element.thickness / 2), 0, Math.PI * 2); ctx.fillStyle = renderedInk; ctx.fill();
          ctx.restore(); if (element.rotation) ctx.restore(); return;
        }
        const last = element.points[element.points.length - 1];
        if (cache?.path) ctx.stroke(cache.path);
        else {
          ctx.beginPath(); ctx.moveTo(element.points[0].x, element.points[0].y);
          for (let i = 1; i < element.points.length; i++) {
            const previous = element.points[i - 1]; const point = element.points[i];
            const mid = { x: (previous.x + point.x) / 2, y: (previous.y + point.y) / 2 };
            ctx.quadraticCurveTo(previous.x, previous.y, mid.x, mid.y);
          }
          ctx.stroke();
        }
        const previous = element.points.length > 1 ? element.points[element.points.length - 2] : last;
        const from = element.points.length > 1 ? { x: (previous.x + last.x) / 2, y: (previous.y + last.y) / 2 } : last;
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(last.x, last.y); ctx.stroke();
      }
      ctx.restore(); if (element.rotation) ctx.restore(); return;
    } else if (element.type === "rectangle") {
      const left = Math.min(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const width = Math.abs(element.w); const height = Math.abs(element.h);
      if ((element.edgeStyle === "rounded" || element.edgeStyle === "pill") && typeof ctx.roundRect === "function") ctx.roundRect(left, top, width, height, element.edgeStyle === "pill" ? Math.min(width, height) / 2 : Math.min(element.cornerRadius ?? 14, width / 2, height / 2));
      else if (element.edgeStyle === "cut") { const c = Math.min(element.cornerRadius ?? 12, width / 2, height / 2); ctx.moveTo(left + c, top); ctx.lineTo(left + width - c, top); ctx.lineTo(left + width, top + c); ctx.lineTo(left + width, top + height - c); ctx.lineTo(left + width - c, top + height); ctx.lineTo(left + c, top + height); ctx.lineTo(left, top + height - c); ctx.lineTo(left, top + c); ctx.closePath(); }
      else ctx.rect(left, top, width, height);
    } else if (element.type === "triangle") {
      const left = Math.min(element.x, element.x + element.w); const right = Math.max(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const bottom = Math.max(element.y, element.y + element.h);
      ctx.moveTo((left + right) / 2, top); ctx.lineTo(right, bottom); ctx.lineTo(left, bottom); ctx.closePath();
    } else if (element.type === "diamond") {
      const left = Math.min(element.x, element.x + element.w); const right = Math.max(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const bottom = Math.max(element.y, element.y + element.h);
      ctx.moveTo((left + right) / 2, top); ctx.lineTo(right, (top + bottom) / 2); ctx.lineTo((left + right) / 2, bottom); ctx.lineTo(left, (top + bottom) / 2); ctx.closePath();
    } else if (element.type === "circle") {
      const rx = Math.abs(element.w / 2); const ry = Math.abs(element.h / 2); const cx = element.x + element.w / 2; const cy = element.y + element.h / 2;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    } else if (element.type === "flowchart") {
      const symbolPath = flowchartPathObject(element.flowchartShape ?? "process", element.x, element.y, element.w, element.h);
      if (symbolPath) {
        if (element.fillColor) { ctx.save(); ctx.globalAlpha = (element.opacity ?? 1) * (element.fillOpacity ?? fillOpacity()); ctx.fillStyle = element.fillColor; ctx.fill(symbolPath); ctx.restore(); }
        ctx.stroke(symbolPath); traceFlowchartDetails(ctx, element.flowchartShape ?? "process", element.x, element.y, element.w, element.h);
        ctx.restore(); if (isLabelShape(element) && !(textDraft()?.shapeLabel && elements()[textDraft()!.editingIndex!]?.id === element.id)) drawLabel(ctx, element); if (element.rotation) ctx.restore(); return;
      }
      traceFlowchart(ctx, element.flowchartShape ?? "process", element.x, element.y, element.w, element.h);
    }
    if ("fillColor" in element && element.fillColor) { ctx.fillStyle = element.fillColor; ctx.globalAlpha = (element.opacity ?? 1) * (element.fillOpacity ?? fillOpacity()); ctx.fill(); ctx.globalAlpha = element.opacity ?? 1; }
    ctx.stroke();
    if (element.type === "flowchart") traceFlowchartDetails(ctx, element.flowchartShape ?? "process", element.x, element.y, element.w, element.h);
    ctx.restore(); if (isLabelShape(element) && !(textDraft()?.shapeLabel && elements()[textDraft()!.editingIndex!]?.id === element.id)) drawLabel(ctx, element); if (element.rotation) ctx.restore();
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

  function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, state: CanvasState) {
    const style = whiteboardStyle();
    if (!showGrid() || style === "plain") return;
    const multiplier = Math.max(1, 2 ** Math.max(0, Math.ceil(Math.log2(0.65 / state.zoom))));
    const baseStep = style === "small-dots" || style === "small-grid" ? 12 : style === "ruled" ? 30 : GRID_SIZE;
    const step = baseStep * multiplier; const left = -state.panX / state.zoom; const top = -state.panY / state.zoom;
    const right = (width - state.panX) / state.zoom; const bottom = (height - state.panY) / state.zoom;
    const hex = renderedBoardColor().replace("#", ""); const rgb = Number.parseInt(hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex, 16); const luminance = (0.2126 * ((rgb >> 16) & 255)) + (0.7152 * ((rgb >> 8) & 255)) + (0.0722 * (rgb & 255));
    ctx.save(); ctx.translate(state.panX, state.panY); ctx.scale(state.zoom, state.zoom);
    const startX = Math.floor(left / step) * step; const startY = Math.floor(top / step) * step;
    ctx.strokeStyle = luminance < 130 ? "#353a45" : "#e4e5e2"; ctx.lineWidth = 0.75 / state.zoom; ctx.beginPath();
    if (style === "lines" || style === "small-grid") {
      for (let x = startX; x <= right; x += step) { ctx.moveTo(x, top); ctx.lineTo(x, bottom); }
      for (let y = startY; y <= bottom; y += step) { ctx.moveTo(left, y); ctx.lineTo(right, y); }
      ctx.stroke();
    } else if (style === "ruled") {
      for (let y = startY; y <= bottom; y += step) { ctx.moveTo(left, y); ctx.lineTo(right, y); }
      ctx.stroke();
    } else if (style === "isometric") {
      // Index both axes from the document origin so this pattern shares the fixed GRID_SIZE snap origin.
      const rowStep = step * Math.sqrt(3) / 2;
      const firstRow = Math.floor(top / rowStep) - 1;
      const lastRow = Math.ceil(bottom / rowStep) + 1;
      const firstX = left - step;
      const lastX = right + step;
      for (let row = firstRow; row <= lastRow; row++) {
        const y = row * rowStep;
        const phase = Math.abs(row % 2) === 1 ? step / 2 : 0;
        const firstColumn = Math.floor((firstX - phase) / step);
        const lastColumn = Math.ceil((lastX - phase) / step);
        for (let column = firstColumn; column <= lastColumn; column++) {
          const x = column * step + phase;
          ctx.moveTo(x, y); ctx.lineTo(x + step, y);
          if (row < lastRow) {
            ctx.moveTo(x, y); ctx.lineTo(x - step / 2, y + rowStep);
            ctx.moveTo(x, y); ctx.lineTo(x + step / 2, y + rowStep);
          }
        }
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = luminance < 130 ? "#414653" : "#deddd6"; const radius = (style === "small-dots" ? 0.65 : 0.85) / state.zoom;
      for (let x = startX; x <= right; x += step) for (let y = startY; y <= bottom; y += step) { ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }

  function transformHandlePoints(bounds: Bounds, includeRotate = true) {
    const midX = bounds.x + bounds.w / 2; const midY = bounds.y + bounds.h / 2; const offset = 24 / canvasState().zoom;
    const handles = [{ id: "nw", x: bounds.x, y: bounds.y }, { id: "n", x: midX, y: bounds.y }, { id: "ne", x: bounds.x + bounds.w, y: bounds.y }, { id: "e", x: bounds.x + bounds.w, y: midY }, { id: "se", x: bounds.x + bounds.w, y: bounds.y + bounds.h }, { id: "s", x: midX, y: bounds.y + bounds.h }, { id: "sw", x: bounds.x, y: bounds.y + bounds.h }, { id: "w", x: bounds.x, y: midY }];
    return includeRotate ? [...handles, { id: "rotate", x: midX, y: bounds.y - offset }] : handles;
  }

  function drawTransformHandles(ctx: CanvasRenderingContext2D, bounds: Bounds, zoom: number, includeRotate = true) {
    const handles = transformHandlePoints(bounds, includeRotate); const rotate = includeRotate ? handles.pop() : undefined; const top = { x: bounds.x + bounds.w / 2, y: bounds.y };
    ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = "#547bb1"; ctx.fillStyle = "#ffffff"; ctx.lineWidth = 1 / zoom;
    if (rotate) { ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(rotate.x, rotate.y); ctx.stroke(); }
    for (const handle of handles) { ctx.beginPath(); ctx.rect(handle.x - 4 / zoom, handle.y - 4 / zoom, 8 / zoom, 8 / zoom); ctx.fill(); ctx.stroke(); }
    if (rotate) { ctx.beginPath(); ctx.arc(rotate.x, rotate.y, 5 / zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } ctx.restore();
  }

  function findTransformHandle(point: Point): { index: number; handle: string } | undefined {
    if (selectedIndices().length !== 1) return undefined;
    const index = selectedIndices()[0]; const element = elements()[index]; if (!element || element.locked || element.type === "freehand" || element.type === "group" && (!element.note || element.note.collapsed)) return undefined;
    const canRotate = element.type !== "group";
    for (const handle of isConnector(element) ? connectorHandles(element) : transformHandlePoints(elementBounds(element), canRotate)) if (Math.hypot(point.x - handle.x, point.y - handle.y) <= 9 / canvasState().zoom) return { index, handle: handle.id };
    return undefined;
  }

  function resizeElement(element: Element, handle: string, start: Point, point: Point): Element {
    if (element.type === "freehand") return element;
    if (element.type === "line" || element.type === "arrow") return resizeConnector(element, handle, point);
    if (element.type === "group") {
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
    const bounds = { x: Math.min(element.x, element.x + element.w), y: Math.min(element.y, element.y + element.h), w: Math.abs(element.w), h: Math.abs(element.h) }; let { x, y, w, h } = bounds; const dx = point.x - start.x; const dy = point.y - start.y;
    if (handle.includes("w")) { x += dx; w -= dx; } if (handle.includes("e")) w += dx;
    if (handle.includes("n")) { y += dy; h -= dy; } if (handle.includes("s")) h += dy;
    const nextW = Math.max(2, w); const nextH = Math.max(2, h);
    if (element.type === "schemaTable") return { ...element, x, y, w: Math.max(190, nextW), h: Math.max(42 + element.columns.length * 30, nextH) };
    if (element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "triangle" || element.type === "flowchart") {
      return { ...element, x, y, w: nextW, h: nextH };
    }
    return { ...element, x, y, w: nextW, h: nextH };
  }

  function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number, includeSelection: boolean, transparent = false, viewOverride?: CanvasState, sourceItems = elements(), includeGrid = true) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    if (!transparent) { ctx.fillStyle = renderedBoardColor(); ctx.fillRect(0, 0, width, height); }
    const state = viewOverride ?? canvasState(); if (!transparent && includeGrid) drawGrid(ctx, width, height, state);
    ctx.save(); ctx.translate(state.panX, state.panY); ctx.scale(state.zoom, state.zoom);
    const padding = 16 / state.zoom;
    const viewport = { x: -state.panX / state.zoom - padding, y: -state.panY / state.zoom - padding, w: width / state.zoom + padding * 2, h: height / state.zoom + padding * 2 };
    const selected = selectedSet();
    const drag = includeSelection && sourceItems === elements() && moveOrigin?.moved ? moveOrigin : undefined;
    sourceItems.forEach((element, index) => {
      if (element.hidden) return;
      const moved = !!drag?.indices.includes(index);
      const resolvedElement = drag ? resolveDraggedConnector(element, index, drag) : element;
      const drawnElement = isConnector(resolvedElement) ? connectorForView(resolvedElement, sourceItems) : resolvedElement;
      const bounds = elementBounds(moved ? element : drawnElement);
      const visibleBounds = moved ? { ...bounds, x: bounds.x + drag!.dx, y: bounds.y + drag!.dy } : bounds;
      if (!intersectsBounds(viewport.x, viewport.y, viewport.x + viewport.w, viewport.y + viewport.h, visibleBounds)) return;
      ctx.save(); if (moved) ctx.translate(drag!.dx, drag!.dy);
      const drawViewport = moved ? { ...viewport, x: viewport.x - drag!.dx, y: viewport.y - drag!.dy } : viewport;
      drawElement(ctx, drawnElement, drawViewport);
      const isSelected = selected.has(index);
      if (includeSelection && (isSelected || hoveredIndex() === index) && isConnector(element)) {
        ctx.save(); ctx.strokeStyle = "#548ce8"; ctx.globalAlpha = .65; ctx.lineWidth = (isSelected ? 2 : 1) / state.zoom; traceConnector(ctx, drawnElement as ShapeElement); ctx.stroke();
        if (isSelected && selected.size === 1 && !element.locked && !boardLocked()) for (const handle of connectorHandles(element)) { const routeHandle = handle.id.startsWith("route") || handle.id.startsWith("auto-route:") || handle.id.includes(":route:"); ctx.beginPath(); ctx.fillStyle = routeHandle ? "#dbeafe" : "#ffffff"; ctx.arc(handle.x, handle.y, (routeHandle ? 4 : 6) / state.zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        ctx.restore();
      } else if (includeSelection && (isSelected || hoveredIndex() === index)) {
        const bounds = elementBounds(element); const padding = 5 / state.zoom;
        ctx.save(); ctx.strokeStyle = isSelected ? "#547bb1" : "#8298b8"; ctx.globalAlpha = isSelected ? 1 : 0.62; ctx.lineWidth = 1 / state.zoom; ctx.setLineDash([4 / state.zoom, 3 / state.zoom]);
        ctx.strokeRect(bounds.x - padding, bounds.y - padding, Math.max(bounds.w + padding * 2, 2 / state.zoom), Math.max(bounds.h + padding * 2, 2 / state.zoom)); ctx.restore();
        if (isSelected && !element.locked && selected.size === 1 && tool() === "select" && (element.type !== "group" || !!element.note && !element.note.collapsed) && element.type !== "freehand") drawTransformHandles(ctx, bounds, state.zoom, element.type !== "group");
      }
      ctx.restore();
    });
    if (includeSelection && (tool() === "arrow" || tool() === "line" || resizeOrigin && isConnector(resizeOrigin.original))) {
      const ports = (items: Element[]) => { for (const item of items) {
        const moved = !!drag?.targets.has(item.id ?? ""); const bounds = elementBounds(item);
        const visibleBounds = moved ? { ...bounds, x: bounds.x + drag!.dx, y: bounds.y + drag!.dy } : bounds;
        if (item.hidden || item.locked || !intersectsBounds(viewport.x, viewport.y, viewport.x + viewport.w, viewport.y + viewport.h, visibleBounds)) continue;
        if (item.type === "group") { ports(item.elements); continue; } if (!isConnectable(item)) continue;
        if (moved) { ctx.save(); ctx.translate(drag!.dx, drag!.dy); }
        const anchors: { anchor: Point; rowId?: string }[] = [
          ...BOX_ANCHORS.map(anchor => ({ anchor })),
          ...(item.type === "schemaTable" ? item.columns.flatMap(column => [{ anchor: { x: 0, y: .5 }, rowId: column.id }, { anchor: { x: 1, y: .5 }, rowId: column.id }]) : []),
        ];
        for (const { anchor, rowId } of anchors) { const point = anchorPoint(item, anchor, rowId); ctx.beginPath(); ctx.arc(point.x, point.y, 4 / state.zoom, 0, Math.PI * 2); ctx.fill(); }
        if (moved) ctx.restore();
      } }; ctx.save(); ctx.fillStyle = "#5d94e7"; ctx.globalAlpha = .7; ports(elements()); const hint = attachmentHint(); if (hint) { ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(hint.x, hint.y, 8 / state.zoom, 0, Math.PI * 2); ctx.strokeStyle = "#2675f5"; ctx.lineWidth = 2 / state.zoom; ctx.stroke(); } ctx.restore();
    }
    const guides = alignmentGuides();
    if (includeSelection && guides && showAlignmentGuides()) {
      const left = -state.panX / state.zoom; const top = -state.panY / state.zoom; const right = (width - state.panX) / state.zoom; const bottom = (height - state.panY) / state.zoom;
      ctx.save(); ctx.strokeStyle = "#668fd0"; ctx.globalAlpha = .85; ctx.lineWidth = 1 / state.zoom; ctx.setLineDash([5 / state.zoom, 4 / state.zoom]); ctx.beginPath();
      if (guides.x !== undefined) { ctx.moveTo(guides.x, top); ctx.lineTo(guides.x, bottom); }
      if (guides.y !== undefined) { ctx.moveTo(left, guides.y); ctx.lineTo(right, guides.y); }
      ctx.stroke(); ctx.restore();
    }
    const transientLaser = laserTrail();
    if (includeSelection && transientLaser) {
      drawLaserStroke(ctx, transientLaser.points, transientLaser.opacity, laserThickness() / state.zoom);
    }
    const activePreview = preview();
    if (includeSelection && activePreview) {
      const { start, end, type, color: stroke, thickness: widthPx, opacity } = activePreview;
      if (type === "pen") { if (tool() === "laser") drawLaserStroke(ctx, currentPoints, 1, laserThickness() / state.zoom); else drawElement(ctx, { type: "freehand", points: currentPoints, color: stroke, thickness: widthPx, opacity }); }
      else drawElement(ctx, { type, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color: stroke, thickness: widthPx, lineStyle: lineStyle(), flowchartShape: activePreview.flowchartShape, lineRoute: activePreview.lineRoute, arrowRoute: activePreview.arrowRoute, edgeStyle: edgeStyle(), cornerRadius: cornerRadius(), ...(fillEnabled() && (type === "rectangle" || type === "circle" || type === "diamond" || type === "triangle" || type === "flowchart") ? { fillColor: fillColor(), fillOpacity: fillOpacity() } : {}), ...(type === "line" ? { startHead: defaultLineStartHead(), endHead: defaultLineEndHead() } : {}), ...(type === "arrow" ? { startHead: defaultStartHead(), endHead: defaultEndHead(), ...(activePreview.arrowRoute === "forked" ? { forkUpper: { endHead: defaultForkUpperHead() }, forkLower: { endHead: defaultForkLowerHead() } } : {}) } : {}) });
    }
    ctx.restore();
    if (includeSelection && marquee()) {
      const { start, end } = marquee()!; const left = Math.min(start.x, end.x) * state.zoom + state.panX; const top = Math.min(start.y, end.y) * state.zoom + state.panY;
      const width = Math.abs(end.x - start.x) * state.zoom; const height = Math.abs(end.y - start.y) * state.zoom;
      ctx.save(); ctx.strokeStyle = "#5888c5"; ctx.fillStyle = "#76a7e51a"; ctx.lineWidth = 1; ctx.setLineDash([5, 4]); ctx.fillRect(left, top, width, height); ctx.strokeRect(left, top, width, height); ctx.restore();
    }
  }

  function renderCanvas() {
    if (!activePath() || !canvas?.isConnected) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 8192 / rect.width, 8192 / rect.height, Math.sqrt(16_000_000 / (rect.width * rect.height)));
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) { canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr); }
    const ctx = canvas.getContext("2d"); if (ctx) drawScene(ctx, rect.width, rect.height, dpr, true);
  }

  let canvasFrame: number | undefined;
  function scheduleCanvasRender() {
    if (canvasFrame !== undefined) return;
    canvasFrame = requestAnimationFrame(() => { canvasFrame = undefined; renderCanvas(); });
  }
  onCleanup(() => { if (canvasFrame !== undefined) cancelAnimationFrame(canvasFrame); });
  createEffect(() => { activePath(); elements(); canvasState(); preview(); laserTrail(); laserColor(); laserThickness(); laserRainbow(); laserFadeDuration(); componentAppearance(); attachmentHint(); tool(); textDraft(); selectedIndices(); hoveredIndex(); showGrid(); whiteboardStyle(); marquee(); alignmentGuides(); theme(); boardColor(); boardColorFollowsTheme(); fillOpacity(); fillEnabled(); fillColor(); lineStyle(); edgeStyle(); cornerRadius(); defaultLineStartHead(); defaultLineEndHead(); defaultStartHead(); defaultEndHead(); defaultForkUpperHead(); defaultForkLowerHead(); boardLocked(); scheduleCanvasRender(); });
  createEffect(() => { const session = noteEditorSession(); if (!session) return; requestAnimationFrame(() => { if (noteEditorTextarea?.isConnected) noteEditorTextarea.focus(); }); });
  createEffect(() => { exportOptionsOpen(); exportFormat(); exportScope(); exportGrid(); exportTransparent(); exportWidth(); exportHeight(); pdfPaper(); pdfPageSet(); pdfRangeStart(); pdfRangeEnd(); pdfOrientation(); pdfLayout(); pages(); pdfDpi(); pdfMarginMm(); pdfOverlapMm(); pdfCustomWidthMm(); pdfCustomHeightMm(); pdfPreviewPage(); pdfColorMode(); pdfBleedMm(); pdfCropMarks(); pdfHeader(); pdfFooter(); elements(); selectedIndices(); canvasState(); theme(); componentAppearance(); boardColor(); whiteboardStyle(); renderExportPreview(); });
  createEffect(() => {
    if (!activePath() || !canvas) return;
    const resize = new ResizeObserver(scheduleCanvasRender); resize.observe(canvas);
    const rawPen = (event: PointerEvent) => pointerRawUpdate(event);
    canvas.addEventListener("pointerrawupdate", rawPen as EventListener);
    window.addEventListener("resize", scheduleCanvasRender);
    window.visualViewport?.addEventListener("resize", scheduleCanvasRender);
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); const bounds = canvas.getBoundingClientRect(); const px = event.clientX - bounds.left; const py = event.clientY - bounds.top;
      const old = canvasState(); const nextZoom = Math.max(0.02, Math.min(8, old.zoom * Math.exp(-event.deltaY * 0.001)));
      const worldX = (px - old.panX) / old.zoom; const worldY = (py - old.panY) / old.zoom;
      setCanvasState({ zoom: nextZoom, panX: px - worldX * nextZoom, panY: py - worldY * nextZoom, backgroundColor: old.backgroundColor }); setDirty(!readOnlyView());
    };
    canvas.addEventListener("wheel", wheel, { passive: false });
    onCleanup(() => { resize.disconnect(); canvas.removeEventListener("wheel", wheel); canvas.removeEventListener("pointerrawupdate", rawPen as EventListener); window.removeEventListener("resize", scheduleCanvasRender); window.visualViewport?.removeEventListener("resize", scheduleCanvasRender); });
  });
  createEffect(() => {
    const items = elements();
    const retained = new Set<string>();
    const visit = (children: Element[]) => { for (const child of children) { if (child.type === "image") retained.add(child.dataUrl); else if (child.type === "group") visit(child.elements); } };
    visit(items);
    for (const key of imageCache.keys()) if (!retained.has(key)) imageCache.delete(key);
    for (const key of retained) if (!imageCache.has(key)) { const image = new Image(); image.onload = () => { if (imageCache.get(key) === image) scheduleCanvasRender(); }; image.src = key; imageCache.set(key, image); }
  });
  createEffect(() => {
    if (!activePath() || !canvasWrap) return;
    const resize = new ResizeObserver(() => { setHistoryVersion((version) => version + 1); });
    resize.observe(canvasWrap);
    onCleanup(() => resize.disconnect());
  });

  createEffect(() => {
    if (syncConflict() || recoveryPrompt()) { setExportOptionsOpen(false); setPageDialog(undefined); setRenameFileOpen(false); setSchemaDialog(false); setMermaidDialog(false); setShowClearConfirm(false); setContextMenu(undefined); closeToolOptions(); if (menu) menu.open = false; if (viewMenu) viewMenu.open = false; if (gestureMenu) gestureMenu.open = false; if (portraitMenu) portraitMenu.open = false; }
  });
  createEffect(() => {
    const open = pageDialog() || renameFileOpen() || schemaDialog() || mermaidDialog() || exportOptionsOpen() || showClearConfirm() || recoveryPrompt() || syncConflict() || helpOpen() || (isWindowsPlatform() && shortcutDialogOpen());
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
      void refreshAndroidAllFilesAccess();
      void invoke("set_mobile_orientation", { orientation: mobileOrientation() }).catch(() => setOrientationMessage("Rotate the device manually if its saved orientation is not applied."));
    }
    if (isTauri()) void invoke<string[]>("load_recent_sketches").then(paths => {
      const combined = [...recentFiles(), ...paths].filter((path, index, all): path is string => typeof path === "string" && isSketchPath(path) && all.indexOf(path) === index).slice(0, 8);
      setRecentFiles(combined);
      try { localStorage.setItem("sketchdraw-v8-recent-files", JSON.stringify(combined)); } catch { /* Native storage remains the durable copy. */ }
      if (combined.length) void invoke("save_recent_sketches", { paths: combined }).catch(() => undefined);
    }).catch(() => undefined);
    void invoke<string[]>("take_startup_files").then((paths) => {
      const path = paths.find((candidate) => candidate.toLowerCase().endsWith(".sketch"));
      if (path) void loadFile(path);
    }).catch((cause) => setError(`Could not check for a SketchDraw file to open: ${String(cause)}`));
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
        if (mermaidDialog()) { event.preventDefault(); setMermaidDialog(false); return; }
        if (renameFileOpen()) { event.preventDefault(); setRenameFileOpen(false); return; }
        if (pageDialog()) { event.preventDefault(); setPageDialog(undefined); return; }
        if (helpOpen()) { event.preventDefault(); setHelpOpen(false); return; }
        if (contextMenu()) { event.preventDefault(); setContextMenu(undefined); return; }
        if (paintBrushMenuOpen()) { event.preventDefault(); setPaintBrushMenuOpen(false); return; }
        if (stencilMenuOpen()) { event.preventDefault(); setStencilMenuOpen(false); return; }
        if (canvasOptionsOpen()) { setCanvasOptionsOpen(false); return; }
        if (openToolOptions()) { closeToolOptions(); return; }
        document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(detail => detail.open = false);
        if (showClearConfirm()) { event.preventDefault(); setShowClearConfirm(false); return; }
        if (exportOptionsOpen()) { event.preventDefault(); setExportOptionsOpen(false); return; }
        if (recoveryPrompt() || syncConflict()) return;
        if (textDraft()) commitTextDraft();
        event.preventDefault(); setTool(readOnlyView() ? "laser" : isWindowsPlatform() ? "select" : "pan"); if (isWindowsPlatform() && !readOnlyView()) setStyleMenuMode("quick"); setTouchStylePanel(false); setQuickStylePopover(undefined); setSelectedIndices([]); setHoveredIndex(undefined); setMarquee(undefined); marqueeOrigin = undefined; resizeOrigin = undefined; moveOrigin = undefined; setPreview(undefined); drawing = false; setSpaceDown(false); setIsPanning(false); panOrigin = undefined;
        if (menu) menu.open = false; if (viewMenu) viewMenu.open = false; if (gestureMenu) gestureMenu.open = false; return;
      }
      if (event.key === "F1") { event.preventDefault(); setHelpOpen(true); return; }
      if (recoveryPrompt() || syncConflict() || exportOptionsOpen() || showClearConfirm() || pageDialog() || renameFileOpen() || schemaDialog() || mermaidDialog() || noteEditor() || contextMenu()) return;
      if (event.target instanceof HTMLElement && event.target.closest("details[open], .tool-options")) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return;
      if (isWindowsPlatform()) {
        const matched = WINDOWS_SHORTCUTS.find(item => matchesWindowsShortcut(event, shortcuts()[item.id]));
        if (matched) { event.preventDefault(); runWindowsShortcut(matched.id); return; }
        const reassignedDefault = WINDOWS_SHORTCUTS.some(item => matchesWindowsShortcut(event, item.defaultKey) && normalizeShortcut(shortcuts()[item.id]) !== normalizeShortcut(item.defaultKey));
        if (reassignedDefault) { event.preventDefault(); return; }
        if (presentationMode() && (event.key === "ArrowRight" || event.key === "ArrowLeft")) { event.preventDefault(); changePresentationPage(event.key === "ArrowRight" ? 1 : -1); return; }
      }
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
      if ((event.ctrlKey || event.metaKey) && key === "s") { event.preventDefault(); if (activePath()) void saveToPath(activePath()!); else void saveAs(); return; }
      if ((event.ctrlKey || event.metaKey) && key === "g") { event.preventDefault(); if (event.shiftKey) ungroupSelection(); else groupSelection(); return; }
      if ((event.ctrlKey || event.metaKey) && key === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
      if ((event.ctrlKey || event.metaKey) && key === "y") { event.preventDefault(); redo(); return; }
      if ((event.ctrlKey || event.metaKey) && key === "d") { event.preventDefault(); insertCopies(selectedElements()); return; }
      if ((event.ctrlKey || event.metaKey) && key === "a") { event.preventDefault(); setSelectedIndices(elements().flatMap((item, index) => !item.hidden && !item.locked ? [index] : [])); return; }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
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
    const clipboardAllowed = (target: EventTarget | null) => !readOnlyView() && activePath() && !pageDialog() && !schemaDialog() && !mermaidDialog() && !exportOptionsOpen() && !showClearConfirm() && !recoveryPrompt() && !syncConflict() && !noteEditor() && !(target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea")));
    const copy = (event: ClipboardEvent) => { if (!clipboardAllowed(event.target) || !selectedElements().length) return; event.preventDefault(); event.clipboardData?.setData("text/plain", clipboardPayload()); clipboardItems = copyElements(selectedElements(), 0, 0); };
    const paste = (event: ClipboardEvent) => { if (!clipboardAllowed(event.target) || boardLocked()) return; const raw = event.clipboardData?.getData("text/plain"); if (raw) { event.preventDefault(); pastePayload(raw); } };
    const cut = (event: ClipboardEvent) => { if (!clipboardAllowed(event.target) || boardLocked()) return; copy(event); if (event.defaultPrevented) deleteSelected(); };
    document.addEventListener("copy", copy); document.addEventListener("paste", paste); document.addEventListener("cut", cut);
    onCleanup(() => { document.removeEventListener("copy", copy); document.removeEventListener("paste", paste); document.removeEventListener("cut", cut); });
    const keyUp = (event: KeyboardEvent) => { if (event.code === "Space") setSpaceDown(false); };
    const refreshStorageAccessOnReturn = () => { if (!document.hidden) void refreshAndroidAllFilesAccess(); };
    const blur = () => {
      setSpaceDown(false);
      activePenPointerId = undefined; ignoredTouchPointers.clear(); touchPointers.clear(); touchGesture = undefined; touchTapTracker = undefined;
      cancelCanvasInteraction();
    };
    const updateDisplayMetrics = () => setDisplayMetrics(readDisplayMetrics());
    const outsideClick = (event: PointerEvent) => { document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(detail => { if (!detail.contains(event.target as Node)) detail.open = false; }); if (!(event.target instanceof HTMLElement && event.target.closest(".tool-family"))) { closeToolOptions(); setStencilMenuOpen(false); } if (!(event.target instanceof HTMLElement && event.target.closest(".paint-brush-family"))) setPaintBrushMenuOpen(false); if (!(event.target instanceof HTMLElement && event.target.closest(".canvas-options-family"))) setCanvasOptionsOpen(false); if (!(event.target instanceof HTMLElement && event.target.closest(".quick-style-panel"))) setQuickStylePopover(undefined); if (!(event.target instanceof HTMLElement && event.target.closest(".touch-style-panel, .touch-style-open"))) setTouchStylePanel(false); if (!(event.target instanceof HTMLElement && event.target.closest(".canvas-context-menu"))) setContextMenu(undefined); if (textDraft() && event.target instanceof Element && !event.target.closest(".canvas-text-editor, .style-pane, .drawing-canvas")) commitTextDraft(); if (menu?.open && !menu.contains(event.target as Node)) menu.open = false; if (viewMenu?.open && !viewMenu.contains(event.target as Node)) viewMenu.open = false; if (gestureMenu?.open && !gestureMenu.contains(event.target as Node)) gestureMenu.open = false; };
    const closeMenuOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setQuickStylePopover(undefined); if (menu?.open) menu.open = false; if (viewMenu?.open) viewMenu.open = false; if (gestureMenu?.open) gestureMenu.open = false; if (helpMenu?.open) helpMenu.open = false; if (portraitMenu?.open) portraitMenu.open = false; if (appSettingsMenu?.open) appSettingsMenu.open = false; } };
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    setSystemDark(colorScheme.matches); colorScheme.addEventListener("change", updateSystemTheme);
    let closeInProgress = false;
    let unlistenClose: (() => void) | undefined;
    void getCurrentWindow().onCloseRequested(async (event) => {
      if (readOnlyView() || (!dirty() && !textDraft() && !saving())) return;
      event.preventDefault();
      if (closeInProgress) return;
      closeInProgress = true;
      try {
        if (textDraft()) commitTextDraft();
        persistRecovery();
        while (saveInFlight) await new Promise<void>((resolve) => window.setTimeout(resolve, 30));
        const path = activePath();
        if (path && dirty() && !syncConflict()) await saveToPath(path);
        // The original close request was prevented while the async save ran.
        // Remove this listener before requesting close again so it cannot
        // intercept its own retry. Recovery data has already been persisted
        // if the save failed or a cloud-sync conflict blocked it.
        unlistenClose?.();
        unlistenClose = undefined;
        await getCurrentWindow().destroy();
      } catch (cause) {
        setError(`Could not close SketchDraw: ${String(cause)}`);
        closeInProgress = false;
      }
    }).then((unlisten) => { unlistenClose = unlisten; }).catch((cause) => setError(`Could not prepare safe closing: ${String(cause)}`));
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp); window.addEventListener("blur", blur); window.addEventListener("focus", refreshStorageAccessOnReturn); document.addEventListener("visibilitychange", refreshStorageAccessOnReturn); window.addEventListener("resize", alignViewSettingsPopover); window.addEventListener("resize", alignOpenTouchMenus); window.addEventListener("resize", updateDisplayMetrics); window.addEventListener("orientationchange", alignOpenTouchMenus); window.addEventListener("orientationchange", updateDisplayMetrics);
    document.addEventListener("pointerdown", outsideClick); document.addEventListener("keydown", closeMenuOnEscape);
    let autosaveTimer: number | undefined;
    const scheduleAutosave = () => {
      autosaveTimer = window.setTimeout(() => {
        if (textDraft() && !recoveryPrompt() && !syncConflict()) persistRecovery();
        if (activePath() && dirty() && !recoveryPrompt() && !textDraft() && !drawing && !resizeOrigin && !moveOrigin) {
          persistRecovery();
          if (!syncConflict() && !saveInFlight) void saveToPath(activePath()!);
        }
        scheduleAutosave();
      }, autosaveSeconds() * 1000);
    };
    restartAutosave = () => { if (autosaveTimer !== undefined) window.clearTimeout(autosaveTimer); scheduleAutosave(); };
    scheduleAutosave();
    syncPollTimer = window.setInterval(() => void pollSharedSketch(), 1600);
    onCleanup(() => { restartAutosave = undefined; unlistenClose?.(); window.clearInterval(laserTimer); if (autosaveTimer !== undefined) window.clearTimeout(autosaveTimer); if (syncPollTimer !== undefined) window.clearInterval(syncPollTimer); if (syncObservationTimer !== undefined) window.clearTimeout(syncObservationTimer); window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", blur); window.removeEventListener("focus", refreshStorageAccessOnReturn); document.removeEventListener("visibilitychange", refreshStorageAccessOnReturn); window.removeEventListener("resize", alignViewSettingsPopover); window.removeEventListener("resize", alignOpenTouchMenus); window.removeEventListener("resize", updateDisplayMetrics); window.removeEventListener("orientationchange", alignOpenTouchMenus); window.removeEventListener("orientationchange", updateDisplayMetrics); document.removeEventListener("pointerdown", outsideClick); document.removeEventListener("keydown", closeMenuOnEscape); colorScheme.removeEventListener("change", updateSystemTheme); });
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
  function setReduceMotionPreference(enabled: boolean) {
    setReduceMotion(enabled);
    try { localStorage.setItem("sketchdraw-reduce-motion", String(enabled)); } catch { /* The motion preference still applies for this session. */ }
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
  function restoreAppSettings() {
    setThemePreference("system");
    setAccentPreference(UI_ACCENTS[1].value);
    setToolbarColorPreference("auto");
    setInterfaceScalePreference(1);
    setAutosavePreference(10);
    setThicknessPickerPreference("presets");
    setReduceMotionPreference(false);
    setToolbarPositionPreference("left");
    void setMobileOrientationPreference("landscape");
  }
  async function refreshAndroidAllFilesAccess() {
    if (!isAndroidPlatform()) return;
    try {
      const status = await invoke<{ available: boolean; granted: boolean }>("has_all_files_access");
      setAndroidAllFilesAccessAvailable(status.available);
      setAndroidAllFilesAccessGranted(status.granted);
    } catch { setAndroidAllFilesAccessAvailable(false); setAndroidAllFilesAccessGranted(false); }
  }
  async function requestAndroidAllFilesAccess() {
    if (!isAndroidPlatform()) return;
    try { await invoke("open_all_files_access_settings"); }
    catch (cause) { setError(String(cause)); }
  }
  function setComponentAppearancePreference(value: "modern" | "simple") {
    setComponentAppearance(value);
    try { localStorage.setItem("sketchdraw-component-appearance", value); } catch { /* Appearance still applies this session. */ }
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
    const value = toolbarColor().slice(1);
    const channels = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16) / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2] > .42 ? "#303832" : "#f0f3f1";
  };

  const recoveryKey = (path: string) => `sketchdraw-v6-recovery:${encodeURIComponent(path)}`;
  function recoverySnapshot(): SketchFile {
    const snapshot = documentSnapshot(); const draft = textDraft(); if (!draft) return snapshot;
    const page = snapshot.pages.find(p => p.id === snapshot.activePageId); if (!page) return snapshot;
    const style = { color: draft.color, opacity: draft.opacity, fontSize: draft.fontSize, fontFamily: draft.fontFamily, bold: draft.bold, italic: draft.italic, underline: draft.underline, textAlign: draft.textAlign, listType: draft.listType };
    if (draft.shapeLabel && draft.editingIndex !== undefined) { const item = page.elements[draft.editingIndex]; if (item && isLabelShape(item)) item.label = { ...style, text: draft.value, verticalAlign: draft.verticalAlign ?? "middle" }; }
    else { const item: TextElement = { ...style, type: "text", x: draft.x, y: draft.y, text: draft.value, id: draft.editingIndex !== undefined ? page.elements[draft.editingIndex]?.id : crypto.randomUUID() }; if (draft.editingIndex !== undefined) page.elements[draft.editingIndex] = item; else if (draft.value.trim()) page.elements.push(item); }
    return snapshot;
  }
  function persistRecovery() {
    if (readOnlyView() || !activePath() || (!dirty() && !textDraft())) return;
    try { localStorage.setItem(recoveryKey(activePath()!), JSON.stringify({ savedAt: Date.now(), baselineRaw: lastSavedRaw, snapshot: recoverySnapshot() })); } catch { /* Recovery is best-effort if browser storage is unavailable. */ }
  }

  function applySnapshot(snapshot: SketchFile, path: string, rawText: string, nextWorkspace: WorkspaceArea = "chooser") {
    pageHistories.clear(); setTextDraft(undefined); setNoteEditor(undefined); setContextMenu(undefined); setLayerPanelOpen(false); setTouchStylePanel(false); setQuickStylePopover(undefined); setCanvasOptionsOpen(false); setPaintBrushMenuOpen(false); setStencilMenuOpen(false); closeToolOptions(); setPreview(undefined); setMarquee(undefined); drawing = false; moveOrigin = undefined; resizeOrigin = undefined;
    const currentPage = snapshot.pages.find((page) => page.id === snapshot.activePageId) ?? snapshot.pages[0];
    setPages(snapshot.pages.map((page) => ({ ...page, elements: cloneElements(page.elements) })));
    setActivePageId(currentPage.id); setElements(cloneElements(currentPage.elements)); setCanvasState({ ...currentPage.canvasState });
    const project = snapshot.project ?? createProjectWorkspace(displayPathName(path).replace(/\.sketch$/i, ""));
    setProjectWorkspaceData(project);
    const library = snapshot.library ?? createPersonalLibrary();
    setPersonalLibraryData(library);
    setBoardColor(currentPage.canvasState.backgroundColor); setBoardColorFollowsTheme(currentPage.canvasState.boardColorFollowsTheme ?? false);
    const syncMeta = snapshot.windowsSync ?? createWindowsSyncMetadata();
    if (syncMeta && !snapshot.windowsSync) {
      const now = Date.now();
      for (const page of snapshot.pages) { syncMeta.clocks[`p:${page.id}`] = now; for (const element of page.elements) if (element.id) syncMeta.clocks[`e:${page.id}:${element.id}`] = now; }
      syncMeta.clocks["w:meta"] = now;
      for (const note of project.notes) syncMeta.clocks[`w:n:${note.id}`] = now;
      for (const task of project.tasks) syncMeta.clocks[`w:t:${task.id}`] = now;
      for (const milestone of project.milestones) syncMeta.clocks[`w:m:${milestone.id}`] = now;
      for (const entry of project.logEntries) syncMeta.clocks[`w:l:${entry.id}`] = now;
      for (const file of project.files) syncMeta.clocks[`w:f:${file.id}`] = now;
      for (const note of library.quickNotes) syncMeta.clocks[`w:quick-note:${note.id}`] = now;
      for (const note of library.studyNotes) syncMeta.clocks[`w:sn:${note.id}`] = now;
      for (const card of library.studyCards) syncMeta.clocks[`w:sc:${card.id}`] = now;
      for (const article of library.wikiArticles) syncMeta.clocks[`w:wiki:${article.id}`] = now;
      for (const entry of library.journalEntries) syncMeta.clocks[`w:journal:${entry.id}`] = now;
      for (const draft of library.writingDrafts) syncMeta.clocks[`w:writing:${draft.id}`] = now;
      for (const source of library.researchSources) syncMeta.clocks[`w:research:${source.id}`] = now;
      for (const entry of library.mediaEntries) syncMeta.clocks[`w:media:${entry.id}`] = now;
    }
    setWindowsSyncMetadata(syncMeta);
    const observedEntries: [string, string][] = [
      ...snapshot.pages.flatMap(page => [
        [`p:${page.id}`, JSON.stringify({ name: page.name, canvasState: page.canvasState })] as [string, string],
        ...page.elements.flatMap(element => element.id ? [[`e:${page.id}:${element.id}`, JSON.stringify(element)] as [string, string]] : []),
      ]),
      ["w:meta", JSON.stringify({ name: project.name, description: project.description })],
      ...project.notes.map(note => [`w:n:${note.id}`, JSON.stringify(note)] as [string, string]),
      ...project.tasks.map(task => [`w:t:${task.id}`, JSON.stringify(task)] as [string, string]),
      ...project.milestones.map(item => [`w:m:${item.id}`, JSON.stringify(item)] as [string, string]),
      ...project.logEntries.map(item => [`w:l:${item.id}`, JSON.stringify(item)] as [string, string]),
      ...project.files.map(item => [`w:f:${item.id}`, JSON.stringify(item)] as [string, string]),
      ...library.quickNotes.map(note => [`w:quick-note:${note.id}`, JSON.stringify(note)] as [string, string]),
      ...library.studyNotes.map(note => [`w:sn:${note.id}`, JSON.stringify(note)] as [string, string]),
      ...library.studyCards.map(card => [`w:sc:${card.id}`, JSON.stringify(card)] as [string, string]),
      ...library.wikiArticles.map(article => [`w:wiki:${article.id}`, JSON.stringify(article)] as [string, string]),
      ...library.journalEntries.map(item => [`w:journal:${item.id}`, JSON.stringify(item)] as [string, string]),
      ...library.writingDrafts.map(item => [`w:writing:${item.id}`, JSON.stringify(item)] as [string, string]),
      ...library.researchSources.map(item => [`w:research:${item.id}`, JSON.stringify(item)] as [string, string]),
      ...library.mediaEntries.map(item => [`w:media:${item.id}`, JSON.stringify(item)] as [string, string]),
    ];
    syncObserved = syncMeta ? new Map(observedEntries) : new Map();
    setActivePath(path); rememberFile(path); setDirty(!snapshot.windowsSync); setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })); setSelectedIndices([]); setHoveredIndex(undefined); setBoardLocked(false); lastSavedRaw = rawText;
    setWorkspaceArea(nextWorkspace);
    undoStack = []; redoStack = []; setHistoryVersion((version) => version + 1); setError("");
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
    const recovery = recoveryPrompt(); if (!recovery) return;
    const baseline = lastSavedRaw ?? "";
    applySnapshot(recovery.snapshot, recovery.path, baseline, workspaceArea());
    try { localStorage.removeItem(recoveryKey(recovery.path)); } catch { /* Best effort. */ }
    setDirty(true); setRecoveryPrompt(undefined);
    if (recovery.baselineRaw !== undefined && recovery.baselineRaw !== baseline) { setSyncConflict({ path: recovery.path, remote: baseline }); return; }
  }
  function discardRecovery() {
    const recovery = recoveryPrompt(); if (!recovery) return;
    try { localStorage.removeItem(recoveryKey(recovery.path)); } catch { /* Best effort. */ }
    setRecoveryPrompt(undefined);
  }
  async function reloadConflictingFile() {
    const conflict = syncConflict(); if (!conflict) return;
    try {
      const raw: unknown = JSON.parse(conflict.remote); const parsed = parseSketchFile(raw);
      if (!parsed) throw new Error("The updated file is not a valid SketchDraw document.");
      applySnapshot(parsed, conflict.path, conflict.remote, workspaceArea()); setSyncConflict(undefined);
      try { localStorage.removeItem(recoveryKey(conflict.path)); } catch { /* Best effort. */ }
      if (isRecord(raw) && raw.version !== SKETCH_FORMAT_VERSION) { setDirty(true); await saveToPath(conflict.path); }
    } catch (cause) { setError(`Could not reload the synchronized file: ${String(cause)}`); }
  }
  async function saveToPath(path: string) {
    if (readOnlyView() || saveInFlight || recoveryPrompt()) return;
    commitTextDraft(); saveInFlight = true; setSaving(true);
    try {
      const snapshot = documentSnapshot();
      const encodedSnapshot = snapshotRaw(snapshot);
      const isNewPath = activePath() !== path;
      if (!isNewPath && lastSavedRaw !== undefined) {
        const diskRaw = await readTextFile(path);
        if (diskRaw !== lastSavedRaw) { setSyncConflict({ path, remote: diskRaw }); return; }
      }
      if (/^content:\/\//i.test(path)) await writeTextFile(path, encodedSnapshot);
      else await invoke("atomic_save_sketch", { path: normalizeFileUri(path), contents: encodedSnapshot, expected: !isNewPath ? lastSavedRaw ?? null : null });
      setActivePath(path); if (isNewPath) rememberFile(path);
      lastSavedRaw = encodedSnapshot;
      setSyncConflict(undefined);
      try { localStorage.removeItem(recoveryKey(path)); } catch { /* Recovery cleanup is best-effort. */ }
      setDirty(snapshotRaw(documentSnapshot()) !== encodedSnapshot);
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })); setError("");
    } catch (cause) { if (String(cause).includes("CONFLICT:")) { try { setSyncConflict({ path, remote: await readTextFile(path) }); } catch { /* Preserve recovery if disk is unavailable. */ } } setError(`Could not save file: ${String(cause)}`); }
    finally { saveInFlight = false; setSaving(false); }
  }

  async function saveAs() {
    if (readOnlyView()) return;
    if (!activePath()) { await createFile(); return; }
    if (nativeBusy() || documentBusy()) return;
    setNativeBusy(true);
    try {
      const selected = await createSketchDocument("Untitled.sketch");
      if (selected) {
        const path = withSketchExtension(selected);
        if (/^content:\/\//i.test(path)) await invoke("authorize_sketch_file", { path });
        await saveToPath(path);
      }
    } catch (cause) { setError(`Could not choose save location: ${String(cause)}`); } finally { setNativeBusy(false); }
  }

  function rememberFile(path: string) {
    path = normalizeFileUri(path);
    const updated = [path, ...recentFiles().filter((recent) => recent !== path)].slice(0, 8);
    setRecentFiles(updated);
    try { localStorage.setItem("sketchdraw-v8-recent-files", JSON.stringify(updated)); } catch { /* Native storage remains the durable copy. */ }
    if (isTauri()) void invoke("save_recent_sketches", { paths: updated }).catch(() => undefined);
  }

  function replaceRecentFilePath(previousPath: string, nextPath: string) {
    const normalizedPrevious = normalizeFileUri(previousPath);
    const normalizedNext = normalizeFileUri(nextPath);
    const updated = [normalizedNext, ...recentFiles().filter(path => normalizeFileUri(path) !== normalizedPrevious && normalizeFileUri(path) !== normalizedNext)].slice(0, 8);
    setRecentFiles(updated);
    try { localStorage.setItem("sketchdraw-v8-recent-files", JSON.stringify(updated)); } catch { /* Native storage remains the durable copy. */ }
    if (isTauri()) void invoke("save_recent_sketches", { paths: updated }).catch(() => undefined);
  }

  function openRenameFileDialog() {
    const path = activePath();
    if (!path || readOnlyView() || documentBusy() || nativeBusy()) return;
    setRenameFileName(displayPathName(path).replace(/\.sketch$/i, ""));
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
      while (saveInFlight) await new Promise<void>(resolve => window.setTimeout(resolve, 30));
      if (activePath() !== path) return;
      commitTextDraft();
      if (syncConflict()) return;
      if (dirty()) {
        await saveToPath(path);
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
      setOpenSketchPaths(paths => paths.map(item => normalizeFileUri(item) === normalizeFileUri(path) ? renamedPath : item));
      replaceRecentFilePath(path, renamedPath);
      try { localStorage.removeItem(recoveryKey(path)); } catch { /* Best effort. */ }
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
    if (readOnlyView()) return true;
    commitTextDraft();
    const path = activePath();
    if (!path) return true;
    if (syncConflict()) return false;
    if (dirty()) {
      while (saveInFlight) await new Promise<void>((resolve) => window.setTimeout(resolve, 30));
      if (activePath() !== path || syncConflict()) return false;
      if (dirty()) await saveToPath(path);
      if (dirty() || syncConflict()) { setError("The current sketch could not be saved, so it was kept open."); return false; }
    }
    return true;
  }

  async function closeFile() {
    if (!activePath() || documentBusy()) return;
    if (isWindowsPlatform() && openSketchPaths().length > 1) { await closeSketchTab(activePath()!); return; }
    setDocumentBusy(true);
    try {
      if (!await saveBeforeReplacingDocument()) return;
      pageHistories.clear();
      undoStack = []; redoStack = [];
      setPages([]); setActivePageId(""); setElements([]); setCanvasState(emptyCanvas());
      setProjectWorkspaceData(createProjectWorkspace()); setPersonalLibraryData(createPersonalLibrary()); setWorkspaceArea("canvas");
      setBoardColor("#ffffff"); setBoardColorFollowsTheme(true); setActivePath(undefined);
      setReadOnlyView(false);
      setDirty(false); setSavedAt(""); setSelectedIndices([]); setHoveredIndex(undefined); setBoardLocked(false);
      setTextDraft(undefined); setPreview(undefined); setMarquee(undefined); setContextMenu(undefined); setLayerPanelOpen(false); setWindowsSyncMetadata(undefined); syncObserved = new Map(); setOpenSketchPaths([]);
      setHistoryVersion(version => version + 1); lastSavedRaw = undefined; setError("");
      setTool("pen"); setMobileToolsExpanded(false); setToolBarOpen(true);
    } finally { setDocumentBusy(false); }
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
    if (documentBusy()) return;
    setDocumentBusy(true);
    try {
      path = normalizeFileUri(path);
      if (!isSketchPath(path)) throw new Error("Only .sketch documents are supported.");
      if (!await saveBeforeReplacingDocument()) return;
      // Android content URIs carry a temporary picker grant; ordinary and iOS
      // file paths use the app's authorization and atomic-save flow.
      const authorizedPath = await invoke<string>("authorize_sketch_file", { path: normalizeFileUri(path) });
      const rawText = await readTextFile(authorizedPath);
      const raw: unknown = JSON.parse(rawText);
      const parsed = parseSketchFile(raw);
      if (!parsed) throw new Error("This file is invalid or uses an unsupported SketchDraw format.");
      const needsMigration = isRecord(raw) && raw.version !== SKETCH_FORMAT_VERSION;
      applySnapshot(parsed, authorizedPath, rawText);
      setReadOnlyView(viewOnly);
      if (isWindowsPlatform() && !viewOnly) setOpenSketchPaths(paths => paths.includes(authorizedPath) ? paths : [...paths, authorizedPath]);
      rememberFile(authorizedPath);
      if (viewOnly) { setTool("laser"); setSelectedIndices([]); setToolBarOpen(true); setMobileToolsExpanded(false); }
      else if (tool() === "laser") setTool("pen");
      restoreOpenedViewAt100(authorizedPath, parsed.activePageId);
      if (needsMigration && !viewOnly) setDirty(true);
      if (!viewOnly) try {
        const stored = localStorage.getItem(recoveryKey(authorizedPath));
        if (stored) {
          const entry: unknown = JSON.parse(stored);
          const recovered = isRecord(entry) ? parseSketchFile(entry.snapshot) : undefined;
          const baselineRaw = isRecord(entry) && typeof entry.baselineRaw === "string" ? entry.baselineRaw : undefined;
          if (recovered && snapshotRaw(recovered) !== snapshotRaw(parsed)) setRecoveryPrompt({ path: authorizedPath, snapshot: recovered, baselineRaw });
          else localStorage.removeItem(recoveryKey(authorizedPath));
        }
      } catch { /* Ignore malformed recovery data and leave the source file untouched. */ }
      if (needsMigration && !viewOnly && !recoveryPrompt()) await saveToPath(authorizedPath);
    } catch (cause) { setError(`Could not open file: ${String(cause)}`); } finally { setDocumentBusy(false); }
  }

  async function pollSharedSketch() {
    const path = activePath();
    const baselineRaw = lastSavedRaw;
    const wasReadOnly = readOnlyView();
    if (!path || !baselineRaw || document.hidden || documentBusy() || recoveryPrompt() || saveInFlight || drawing || moveOrigin || resizeOrigin || textDraft()) return;
    try {
      const remoteRaw = await readTextFile(path);
      if (activePath() !== path || lastSavedRaw !== baselineRaw || remoteRaw === baselineRaw) return;
      const remoteParsed = parseSketchFile(JSON.parse(remoteRaw) as unknown);
      if (!remoteParsed) return; // Cloud providers can briefly expose a partially synchronized file.
      const localParsed = documentSnapshot();
      const merged = mergeLatestSnapshots(localParsed, remoteParsed);
      applySnapshot(merged, path, remoteRaw, workspaceArea());
      setReadOnlyView(wasReadOnly);
      setSyncConflict(undefined);
      const hasMergedEdits = snapshotRaw(merged) !== snapshotRaw(remoteParsed);
      setDirty(!wasReadOnly && (hasMergedEdits || (isWindowsPlatform() && !remoteParsed.windowsSync)));
      if (hasMergedEdits) window.setTimeout(() => { if (activePath() === path && dirty() && !syncConflict()) void saveToPath(path); }, 80);
    } catch {
      // A disconnected cloud folder or provider lock is retried on the next poll.
    }
  }

  function setWindowsShortcut(id: WindowsShortcutId, value: string) {
    const normalized = value ? normalizeShortcut(value) : "";
    if (normalized && WINDOWS_SHORTCUTS.some(item => item.id !== id && shortcuts()[item.id] && normalizeShortcut(shortcuts()[item.id]) === normalized)) return false;
    const next = { ...shortcuts(), [id]: normalized };
    setShortcuts(next);
    try { localStorage.setItem("sketchdraw-windows-shortcuts", JSON.stringify(next)); } catch { /* The current session still uses the new shortcut. */ }
    return true;
  }

  function resetWindowsShortcuts() {
    setShortcuts({ ...DEFAULT_WINDOWS_SHORTCUTS });
    try { localStorage.removeItem("sketchdraw-windows-shortcuts"); } catch { /* Defaults still apply for this session. */ }
  }

  function runWindowsShortcut(id: WindowsShortcutId) {
    if (readOnlyView() && !["commandPalette", "openSketch", "fitDrawing", "fitSelection", "resetZoom", "presentation"].includes(id)) return;
    switch (id) {
      case "commandPalette": setCommandPaletteOpen(true); break;
      case "newSketch": void createFile(); break;
      case "openSketch": void openFile(); break;
      case "saveSketch": if (activePath()) void saveToPath(activePath()!); else void saveAs(); break;
      case "saveAs": void saveAs(); break;
      case "undo": undo(); break;
      case "redo": redo(); break;
      case "group": groupSelection(); break;
      case "ungroup": ungroupSelection(); break;
      case "duplicate": insertCopies(selectedElements()); break;
      case "selectAll": setSelectedIndices(elements().flatMap((item, index) => !item.hidden && !item.locked ? [index] : [])); break;
      case "fitDrawing": fitDocumentToViewport(elements()); break;
      case "fitSelection": fitDocumentToViewport(selectedElements()); break;
      case "resetZoom": resetZoomAndCenter(); break;
      case "toggleGrid": setShowGrid(value => !value); break;
      case "snapGrid": setSnapToGrid(value => !value); break;
      case "snapObjects": setSnapToObjects(value => !value); break;
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
      setCommandPaletteOpen(false); setPresentationMode(true);
      try {
        if (isTauri()) {
          const appWindow = getCurrentWindow(); presentationOwnsFullscreen = !(await appWindow.isFullscreen());
          if (presentationOwnsFullscreen) await appWindow.setFullscreen(true);
        } else if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          presentationOwnsFullscreen = true; await document.documentElement.requestFullscreen();
        }
      } catch { /* Presentation controls remain available if fullscreen is unavailable. */ }
    } else {
      setPresentationMode(false);
      if (!presentationOwnsFullscreen) return;
      presentationOwnsFullscreen = false;
      try { if (isTauri()) await getCurrentWindow().setFullscreen(false); else if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* The presentation layout still exits if fullscreen is unavailable. */ }
    }
  }

  function changePresentationPage(direction: -1 | 1) {
    const index = pages().findIndex(page => page.id === activePageId());
    const target = pages()[index + direction];
    if (target) switchPage(target.id);
  }

  async function openFile() {
    if (nativeBusy() || documentBusy()) return;
    setNativeBusy(true);
    try {
      const selected = await chooseSketchDocument();
      if (!selected) return;
      await loadFile(selected);
    } catch (cause) { setError(`Could not choose file: ${String(cause)}`); } finally { setNativeBusy(false); }
  }

  async function openFileAsView() {
    if (nativeBusy() || documentBusy()) return;
    setNativeBusy(true);
    try {
      const selected = await chooseSketchDocument();
      if (!selected) return;
      await loadFile(selected, true);
    } catch (cause) { setError(`Could not choose file: ${String(cause)}`); } finally { setNativeBusy(false); }
  }

  async function checkForUpdates() {
    if (updateCheck() === "checking") return;
    setUpdateCheck("checking"); setUpdateVersion(undefined); setError("");
    try {
      const response = await fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } });
      if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}.`);
      const release: unknown = await response.json();
      if (!isRecord(release) || typeof release.tag_name !== "string") throw new Error("GitHub returned an incomplete release record.");
      const currentVersion = await getVersion();
      const releaseVersion = releaseVersionForPlatform(release);
      setUpdateVersion(releaseVersion);
      setUpdateCheck(compareReleaseVersions(releaseVersion, currentVersion) > 0 ? "available" : "current");
    } catch (cause) { setUpdateCheck("error"); setError(`Update check failed: ${String(cause)}`); }
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
      const svgBlob = new Blob([new XMLSerializer().serializeToString(root)], { type: "image/svg+xml;charset=utf-8" });
      const objectUrl = URL.createObjectURL(svgBlob);
      try {
        const image = new Image(); image.src = objectUrl;
        await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("The SVG could not be rasterized.")); });
        const rasterScale = Math.min(1, Math.sqrt(16_000_000 / (width * height)));
        const raster = document.createElement("canvas"); raster.width = Math.max(1, Math.ceil(width * rasterScale)); raster.height = Math.max(1, Math.ceil(height * rasterScale));
        const context = raster.getContext("2d"); if (!context) throw new Error("Could not prepare the SVG image.");
        context.drawImage(image, 0, 0, raster.width, raster.height);
        addRasterImage(raster.toDataURL("image/png"), raster.width, raster.height);
      } finally { URL.revokeObjectURL(objectUrl); }
    } catch (cause) { setError(`Could not import SVG: ${String(cause)}`); } finally { setNativeBusy(false); }
  }

  function addRasterImage(dataUrl: string, sourceWidth: number, sourceHeight: number) {
    const width = Math.min(700, sourceWidth); const height = sourceHeight * width / sourceWidth; const rect = canvas.getBoundingClientRect(); const view = canvasState();
    const item: ImageElement = { type: "image", x: (rect.width / 2 - view.panX) / view.zoom - width / 2, y: (rect.height / 2 - view.panY) / view.zoom - height / 2, w: width, h: height, dataUrl, sourceWidth, sourceHeight };
    pushUndo(cloneElements(elements())); setElements(items => [...items, item]); imageCache.set(dataUrl, new Image()); imageCache.get(dataUrl)!.src = dataUrl; setSelectedIndices([elements().length - 1]); setDirty(true);
  }

  function toggleLayer(key: Element["type"], property: "hidden" | "locked") {
    if (boardLocked()) return;
    const before = cloneElements(elements());
    setElements(items => toggleToolLayer(items, key, property));
    pushUndo(before); setDirty(true);
  }

  function moveLayerTo(key: Element["type"], targetRow: number) {
    if (boardLocked()) return;
    const current = elements();
    const reordered = reorderToolLayer(current, key, targetRow);
    if (reordered === current) return;
    const selectedObjects = new Set(selectedIndices().map(index => current[index]).filter((item): item is Element => !!item));
    const nextIndices = reordered.flatMap((item, index) => selectedObjects.has(item) ? [index] : []);
    const before = cloneElements(current);
    setElements(reordered); setSelectedIndices(nextIndices); pushUndo(before); setDirty(true);
  }

  async function createFile() {
    if (nativeBusy() || documentBusy()) return;
    setNativeBusy(true);
    try {
      const selected = await createSketchDocument(nextUntitledFileName());
      if (!selected) return;
      if (!await saveBeforeReplacingDocument()) return;
      const path = withSketchExtension(selected);
      if (/^content:\/\//i.test(path)) await invoke("authorize_sketch_file", { path });
      const page: SketchPage = { id: "page-1", name: "Page 1", canvasState: emptyCanvas(), elements: [] };
      const project = createProjectWorkspace(displayPathName(path).replace(/\.sketch$/i, ""));
      const library = createPersonalLibrary();
      const windowsSync = createWindowsSyncMetadata();
      if (windowsSync) { windowsSync.clocks[`p:${page.id}`] = windowsSync.updatedAt; windowsSync.clocks["w:meta"] = windowsSync.updatedAt; }
      const document: SketchFile = { format: "SketchDraw", version: SKETCH_FORMAT_VERSION, activePageId: page.id, pages: [page], project, library, ...(windowsSync ? { windowsSync } : {}) };
      const contents = snapshotRaw(document);
      if (/^content:\/\//i.test(path)) await writeTextFile(path, contents);
      else await invoke("atomic_save_sketch", { path: normalizeFileUri(path), contents, expected: null });
      pageHistories.clear(); setPages([page]); setActivePageId(page.id); setElements([]); setCanvasState(emptyCanvas()); setProjectWorkspaceData(project); setPersonalLibraryData(library); setWorkspaceArea("chooser"); setBoardColor("#ffffff"); setBoardColorFollowsTheme(true); setSelectedIndices([]); setHoveredIndex(undefined); setActivePath(path); setReadOnlyView(false); setTool("pen"); rememberFile(path); if (isWindowsPlatform()) setOpenSketchPaths(paths => paths.includes(path) ? paths : [...paths, path]); setWindowsSyncMetadata(windowsSync); syncObserved = new Map([[`p:${page.id}`, JSON.stringify({ name: page.name, canvasState: page.canvasState })], ["w:meta", JSON.stringify({ name: project.name, description: project.description })]]); setDirty(false); setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })); setBoardLocked(false); setError(""); lastSavedRaw = contents;
      undoStack = []; redoStack = []; setHistoryVersion((version) => version + 1);
    } catch (cause) { setError(`Could not create SketchDraw file: ${String(cause)}`); } finally { setNativeBusy(false); }
  }

  async function createProjectFromHome() {
    const startingPath = activePath();
    await createFile();
    if (activePath() && activePath() !== startingPath) setWorkspaceArea("planning");
  }

  async function openRecentProject(path: string) {
    await loadFile(path);
    if (activePath() && normalizeFileUri(activePath()!) === normalizeFileUri(path)) setWorkspaceArea("planning");
  }

  function openExportOptions(format: "png" | "svg" | "pdf") {
    if (readOnlyView()) return;
    setExportFormat(format);
    setExportOptionsOpen(true);
    requestAnimationFrame(renderExportPreview);
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
    const pageCount = pdfPageSet() === "current" ? columns * rows : selectedPdfPages().length;
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
    const pdfPage = metrics && pdfPageSet() !== "current" ? selectedPdfPages()[Math.max(0, Math.min(selectedPdfPages().length - 1, pdfPreviewPage() - 1))] : undefined;
    const selected = pdfPage ? pdfPage.elements : exportScope() === "selection" ? selectedElements() : elements();
    const items = cloneElements(selected).filter(item => !item.hidden);
    const rect = canvas.getBoundingClientRect(); const view = { ...(pdfPage?.canvasState ?? canvasState()) };
    const rawBounds = !pdfPage && exportScope() === "viewport"
      ? { x: -view.panX / view.zoom, y: -view.panY / view.zoom, w: rect.width / view.zoom, h: rect.height / view.zoom }
      : unionBounds(items.map(elementBounds)) ?? { x: 0, y: 0, w: 800, h: 600 };
    const padding = !pdfPage && exportScope() === "viewport" ? 0 : 24;
    const bounds = { x: rawBounds.x - padding, y: rawBounds.y - padding, w: Math.max(1, rawBounds.w + padding * 2), h: Math.max(1, rawBounds.h + padding * 2) };
    const exportViewFor = (width: number, height: number) => { const zoom = Math.min(width / bounds.w, height / bounds.h); return { ...view, zoom, panX: (width - bounds.w * zoom) / 2 - bounds.x * zoom, panY: (height - bounds.h * zoom) / 2 - bounds.y * zoom }; };
    if (metrics) setPdfPreviewPage(value => Math.max(1, Math.min(metrics.pageCount, value)));
    void (async () => {
      const prepare = async (list: Element[]): Promise<void> => { await Promise.all(list.map(async item => { if (item.type === "group") await prepare(item.elements); else if (item.type === "image") { let image = imageCache.get(item.dataUrl); if (!image) { image = new Image(); image.src = item.dataUrl; imageCache.set(item.dataUrl, image); } try { await image.decode(); } catch { /* Keep a preview even if an image cannot be decoded. */ } } })); };
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

  function imagePdfPages(pages: PdfRasterPage[]): Uint8Array {
    const encoder = new TextEncoder(); const parts: Uint8Array[] = []; const offsets: number[] = []; let size = 0;
    const add = (part: Uint8Array) => { parts.push(part); size += part.length; };
    const ascii = (text: string) => encoder.encode(text);
    const object = (id: number, body: Uint8Array) => { offsets[id] = size; add(ascii(`${id} 0 obj\n`)); add(body); add(ascii("\nendobj\n")); };
    const pageIds = pages.map((_, index) => 4 + index * 3);
    const maxId = 3 + pages.length * 3;
    add(ascii("%PDF-1.4\n%SketchDraw\n"));
    object(1, ascii("<< /Type /Catalog /Pages 2 0 R >>"));
    object(2, ascii(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`));
    object(3, ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"));
    pages.forEach((page, index) => {
      const pageId = pageIds[index]; const imageId = pageId + 1; const contentId = pageId + 2; const imageName = `Im${index}`; const bleed = page.bleedPt;
      const width = page.pageWidth + bleed * 2; const height = page.pageHeight + bleed * 2;
      object(pageId, ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /TrimBox [${bleed} ${bleed} ${bleed + page.pageWidth} ${bleed + page.pageHeight}] /Resources << /Font << /F1 3 0 R >> /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`));
      offsets[imageId] = size; add(ascii(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.imageWidth} /Height ${page.imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Interpolate true /Length ${page.jpeg.length} >>\nstream\n`)); add(page.jpeg); add(ascii("\nendstream\nendobj\n"));
      const escapePdf = (value: string) => value.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7e]/g, "?");
      const header = pdfHeader().trim() ? `BT /F1 9 Tf ${bleed + 18} ${height - bleed - 16} Td (${escapePdf(pdfHeader())}) Tj ET\n` : "";
      const footer = pdfFooter().trim() ? `BT /F1 9 Tf ${bleed + 18} ${bleed + 8} Td (${escapePdf(pdfFooter())}) Tj ET\n` : "";
      const pageNo = `BT /F1 9 Tf ${width - bleed - 52} ${bleed + 8} Td (Page ${index + 1} of ${pages.length}) Tj ET\n`;
      const t = bleed; const marks = pdfCropMarks() ? `0 G .35 w ${t - 7} ${t} m ${t - 2} ${t} l S ${t} ${t - 7} m ${t} ${t - 2} l S ${width - t + 2} ${t} m ${width - t + 7} ${t} l S ${width - t} ${t - 7} m ${width - t} ${t - 2} l S ${t - 7} ${height - t} m ${t - 2} ${height - t} l S ${t} ${height - t + 2} m ${t} ${height - t + 7} l S ${width - t + 2} ${height - t} m ${width - t + 7} ${height - t} l S ${width - t} ${height - t + 2} m ${width - t} ${height - t + 7} l S\n` : "";
      const content = ascii(`q\n${page.drawWidth} 0 0 ${page.drawHeight} ${page.x + bleed} ${page.y + bleed} cm\n/${imageName} Do\nQ\n${header}${footer}${pageNo}${marks}`);
      object(contentId, new Uint8Array([...ascii(`<< /Length ${content.length} >>\nstream\n`), ...content, ...ascii("\nendstream")]));
    });
    const xrefStart = size; let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
    for (let id = 1; id <= maxId; id++) xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    add(ascii(`${xref}trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`));
    const output = new Uint8Array(size); let cursor = 0; for (const part of parts) { output.set(part, cursor); cursor += part.length; } return output;
  }

  async function makeVectorPdf(scenes: { items: Element[]; view: CanvasState }[], output: { widthPt: number; heightPt: number }, marginMm: number) {
    const { PDFDocument, StandardFonts, LineCapStyle, degrees, rgb, cmyk, pushGraphicsState, popGraphicsState, translate, rotateDegrees } = await import("pdf-lib");
    const pdfColor = (color: string, mode: "rgb" | "cmyk" | "grayscale") => { const match=/^#([\da-f]{6})$/i.exec(color);if(!match)return rgb(.12,.12,.12);const channels=[0,2,4].map(i=>parseInt(match[1].slice(i,i+2),16)/255);if(mode==="grayscale"){const gray=channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;return rgb(gray,gray,gray);}if(mode==="cmyk"){const black=1-Math.max(...channels);const divisor=1-black||1;return cmyk((1-channels[0]-black)/divisor,(1-channels[1]-black)/divisor,(1-channels[2]-black)/divisor,black);}return rgb(channels[0],channels[1],channels[2]);};
    const doc = await PDFDocument.create();
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica); const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique); const fontBoldItalic = await doc.embedFont(StandardFonts.HelveticaBoldOblique); const fontMono = await doc.embedFont(StandardFonts.Courier);
    const fontSerif = await doc.embedFont(StandardFonts.TimesRoman); const fontSerifBold = await doc.embedFont(StandardFonts.TimesRomanBold); const fontSerifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic); const fontSerifBoldItalic = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);
    const grayscale = pdfColorMode() === "grayscale"; const bleed = Math.max(0, Math.min(20, pdfBleedMm())) * 72 / 25.4; const margin = marginMm * 72 / 25.4; textMeasureContext ??= document.createElement("canvas").getContext("2d");
    const paperW = output.widthPt + bleed * 2; const paperH = output.heightPt + bleed * 2;
    const readImage = async (element: ImageElement) => {
      let image = imageCache.get(element.dataUrl);
      if (!image) { image = new Image(); image.src = element.dataUrl; imageCache.set(element.dataUrl, image); }
      await image.decode();
      const cropX=element.cropX??0,cropY=element.cropY??0,cropW=element.cropW??image.naturalWidth,cropH=element.cropH??image.naturalHeight; const cropped=cropX!==0||cropY!==0||cropW!==image.naturalWidth||cropH!==image.naturalHeight; if(grayscale||cropped){const gray=document.createElement("canvas");gray.width=Math.max(1,Math.round(cropW));gray.height=Math.max(1,Math.round(cropH));const context=gray.getContext("2d");if(context){context.drawImage(image,cropX,cropY,cropW,cropH,0,0,gray.width,gray.height);if(grayscale){const pixels=context.getImageData(0,0,gray.width,gray.height);for(let i=0;i<pixels.data.length;i+=4){const value=Math.round(pixels.data[i]*.2126+pixels.data[i+1]*.7152+pixels.data[i+2]*.0722);pixels.data[i]=value;pixels.data[i+1]=value;pixels.data[i+2]=value;}context.putImageData(pixels,0,0);}const blob=await new Promise<Blob>((resolve,reject)=>gray.toBlob(value=>value?resolve(value):reject(new Error("Could not prepare an imported image for PDF.")),"image/png"));return doc.embedPng(new Uint8Array(await blob.arrayBuffer()));}}
      const data = element.dataUrl.slice(0, element.dataUrl.indexOf(",")); const bytes = Uint8Array.from(atob(element.dataUrl.slice(element.dataUrl.indexOf(",") + 1)), char => char.charCodeAt(0));
      if (data.includes("image/png")) return doc.embedPng(bytes);
      if (data.includes("image/jpeg")) return doc.embedJpg(bytes);
      const temp = document.createElement("canvas"); temp.width = image.naturalWidth; temp.height = image.naturalHeight; temp.getContext("2d")!.drawImage(image, 0, 0); const blob = await new Promise<Blob>((resolve, reject) => temp.toBlob(value => value ? resolve(value) : reject(new Error("Could not encode an imported image for PDF.")), "image/png")); return doc.embedPng(new Uint8Array(await blob.arrayBuffer()));
    };
    const pathStyle = (page: import("pdf-lib").PDFPage, path: string, element: ShapeElement, scale: number, originX: number, originY: number, fill?: string, fillAlpha?: number) => {
      const dash = element.lineStyle === "dashed" ? [element.thickness * scale * 4, element.thickness * scale * 2.5] : element.lineStyle === "dotted" ? [element.thickness * scale, element.thickness * scale * 2.2] : undefined;
      const centerX=originX+(element.x+element.w/2)*scale; const centerY=originY-(element.y+element.h/2)*scale; const rotated=!!element.rotation;
      if(rotated)page.pushOperators(pushGraphicsState(),translate(centerX,centerY),rotateDegrees(-(element.rotation??0)),translate(-centerX,-centerY));
      page.drawSvgPath(path, { x: originX, y: originY, scale, color: fill ? pdfColor(fill, pdfColorMode()) : undefined, opacity: fill ? fillAlpha ?? (element.opacity ?? 1) * (element.fillOpacity ?? .2) : 1, borderColor: pdfColor(themeInk(element.color, theme()), pdfColorMode()), borderWidth: element.thickness * scale, borderOpacity: element.opacity ?? 1, borderDashArray: dash, borderLineCap: LineCapStyle.Round });
      if(rotated)page.pushOperators(popGraphicsState());
    };
    for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
      const scene = scenes[sceneIndex]; const visible = scene.items.filter(item => !item.hidden); const raw = unionBounds(visible.map(elementBounds)) ?? { x: 0, y: 0, w: 800, h: 600 }; const padding = 24; const bounds = { x: raw.x - padding, y: raw.y - padding, w: Math.max(1, raw.w + padding * 2), h: Math.max(1, raw.h + padding * 2) };
      const usableW = output.widthPt - margin * 2; const usableH = output.heightPt - margin * 2; const scale = Math.max(.001, Math.min(usableW / bounds.w, usableH / bounds.h)); const x0 = bleed + margin - bounds.x * scale; const yTop = paperH - bleed - margin + bounds.y * scale;
      const page = doc.addPage([paperW, paperH]); page.setTrimBox(bleed, bleed, output.widthPt, output.heightPt); page.setBleedBox(0, 0, paperW, paperH);
      const drawText = (text: string, x: number, y: number, color: string, size: number, family: FontFamily | undefined, bold: boolean, italic: boolean, opacity: number, rotation = 0, rotationCenter?: Point, align: TextElement["textAlign"] = "left") => {
        const font = family === "mono" ? fontMono : family === "serif" ? bold && italic ? fontSerifBoldItalic : bold ? fontSerifBold : italic ? fontSerifItalic : fontSerif : family === "hand" ? bold ? fontBoldItalic : fontItalic : bold && italic ? fontBoldItalic : bold ? fontBold : italic ? fontItalic : fontRegular;
        let tx=x,ty=y;const textWidth=font.widthOfTextAtSize(text,size*scale)/scale;if(align==="center")tx-=textWidth/2;else if(align==="right")tx-=textWidth;if(rotation&&rotationCenter){const angle=rotation*Math.PI/180,dx=tx-rotationCenter.x,dy=y-rotationCenter.y;tx=rotationCenter.x+dx*Math.cos(angle)-dy*Math.sin(angle);ty=rotationCenter.y+dx*Math.sin(angle)+dy*Math.cos(angle);}
        page.drawText(text.replace(/[^\x20-\xff]/g, "?"), { x: x0 + tx * scale, y: paperH - (bleed + margin + (ty - bounds.y) * scale) - size * scale, size: size * scale, font, color: pdfColor(themeInk(color, theme()), pdfColorMode()), opacity, rotate: degrees(-rotation) });
      };
      const drawItem = async (element: Element): Promise<void> => {
        if (element.hidden) return;
        element = simpleComponentElement(element);
        if (element.type === "group") {
          if (element.note) {
            try {
              const box = elementBounds(element); const width = Math.max(1, Math.abs(box.w)), height = Math.max(1, Math.abs(box.h));
              const ratio = Math.max(.01, Math.min(2, 8192 / width, 8192 / height, Math.sqrt(16_000_000 / (width * height))));
              const surface = document.createElement("canvas"); surface.width = Math.max(1, Math.ceil(width * ratio)); surface.height = Math.max(1, Math.ceil(height * ratio));
              const context = surface.getContext("2d"); if (!context) throw new Error("Canvas renderer unavailable");
              context.setTransform(ratio, 0, 0, ratio, -box.x * ratio, -box.y * ratio); drawNoteCard(context, element, theme(), componentAppearance());
              const encoded = surface.toDataURL("image/png").split(",")[1]; const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0)); const image = await doc.embedPng(bytes);
              const left = x0 + box.x * scale; const top = paperH - (bleed + margin + (box.y - bounds.y) * scale); const centerX = left + box.w * scale / 2; const centerY = top - box.h * scale / 2; const rotated = !!element.rotation;
              if (rotated) page.pushOperators(pushGraphicsState(), translate(centerX, centerY), rotateDegrees(-(element.rotation ?? 0)), translate(-centerX, -centerY));
              page.drawImage(image, { x: left, y: top - box.h * scale, width: box.w * scale, height: box.h * scale });
              if (rotated) page.pushOperators(popGraphicsState());
            } catch { for (const child of element.elements) await drawItem(child); }
            return;
          }
          for (const child of element.elements) await drawItem(child); return;
        }
        if (element.type === "image") { try { const embedded = await readImage(element); const centerX=x0+(element.x+element.w/2)*scale,centerY=paperH-(bleed+margin+(element.y+element.h/2-bounds.y)*scale),rotated=!!element.rotation;if(rotated)page.pushOperators(pushGraphicsState(),translate(centerX,centerY),rotateDegrees(-(element.rotation??0)),translate(-centerX,-centerY));page.drawImage(embedded, { x: x0 + element.x * scale, y: paperH - (bleed + margin + (element.y - bounds.y + element.h) * scale), width: element.w * scale, height: element.h * scale, opacity: element.opacity ?? 1 });if(rotated)page.pushOperators(popGraphicsState()); } catch { /* Keep other vector content even if an embedded image cannot be decoded. */ } return; }
        if (element.type === "text") { const lines = element.text.split(/\r?\n/).map((line,index)=>element.listType==="bullet"?`• ${line}`:element.listType==="number"?`${index+1}. ${line}`:line); const textBox=elementBounds(element); const center={x:textBox.x+textBox.w/2,y:textBox.y+textBox.h/2}; lines.forEach((line, index) => drawText(line, element.x, element.y + index * element.fontSize * 1.25, element.color, element.fontSize, element.fontFamily, !!element.bold, !!element.italic, element.opacity ?? 1, element.rotation ?? 0, center, element.textAlign)); if (element.underline) { const font = element.fontFamily === "mono" ? fontMono : element.fontFamily === "serif" ? fontSerif : element.fontFamily === "hand" || element.italic ? fontItalic : element.bold ? fontBold : fontRegular; const width = font.widthOfTextAtSize(lines[0] ?? "", element.fontSize) * scale; page.drawLine({ start: { x: x0 + element.x * scale, y: paperH - (bleed + margin + (element.y + element.fontSize) * scale) }, end: { x: x0 + element.x * scale + width, y: paperH - (bleed + margin + (element.y + element.fontSize) * scale) }, thickness: Math.max(.5, scale), color: pdfColor(themeInk(element.color, theme()), pdfColorMode()) }); } return; }
        if (element.type === "schemaTable") {
          const dark = theme() === "dark"; const simple = componentAppearance() === "simple"; const fontSize = element.fontSize ?? 14; const headerHeight = Math.max(42, fontSize * 2.8); const rowHeight = Math.max(30, fontSize * 1.8); const surface = simple ? (dark ? "#202020" : "#ffffff") : (dark ? "#202a35" : "#fbfcfe"); const border = simple ? (dark ? "#b0b0b0" : "#555555") : (dark ? "#506174" : "#9badbf"); const heading = simple ? surface : dark ? "#30465b" : "#e8f0f7"; const ink = simple ? (dark ? "#f0f0f0" : "#262626") : (dark ? "#d8e8f5" : "#36556e"); const left = x0 + element.x * scale; const top = paperH - (bleed + margin + (element.y - bounds.y) * scale); const width = element.w * scale; const height = element.h * scale; const opacity = element.opacity ?? 1;
          const centerX = left + width / 2; const centerY = top - height / 2; const rotated = !!element.rotation;
          if (rotated) page.pushOperators(pushGraphicsState(), translate(centerX, centerY), rotateDegrees(-(element.rotation ?? 0)), translate(-centerX, -centerY));
          page.drawRectangle({ x: left, y: top - height, width, height, color: pdfColor(surface, pdfColorMode()), opacity, borderColor: pdfColor(border, pdfColorMode()), borderWidth: 1.2 * scale, borderOpacity: opacity });
          page.drawRectangle({ x: left, y: top - headerHeight * scale, width, height: headerHeight * scale, color: pdfColor(heading, pdfColorMode()), opacity });
          drawText(element.name, element.x + 14, element.y + 13, ink, fontSize, "sans", true, false, opacity);
          element.columns.forEach((column, index) => {
            const rowY = element.y + headerHeight + index * rowHeight;
            if (index) page.drawLine({ start: { x: left + 10 * scale, y: top - rowY * scale }, end: { x: left + width - 10 * scale, y: top - rowY * scale }, thickness: .7 * scale, color: pdfColor(simple ? border : dark ? "#394856" : "#e6ebf0", pdfColorMode()), opacity });
            drawText(column.primaryKey ? "PK" : column.foreignTable ? "FK" : "", element.x + 13, rowY + 7, simple ? ink : column.primaryKey ? (dark ? "#f0d58c" : "#826b2f") : (dark ? "#aed9ed" : "#436e85"), 9, "sans", true, false, opacity);
            drawText(column.name, element.x + 44, rowY + 5, simple ? ink : dark ? "#dbe5ee" : "#354759", fontSize * .86, "mono", false, false, opacity);
            drawText(column.dataType || "type", element.x + element.w - 14, rowY + 5, simple ? ink : dark ? "#a4b1bf" : "#768493", fontSize * .78, "mono", false, false, opacity, 0, undefined, "right");
          });
          if (rotated) page.pushOperators(popGraphicsState());
          return;
        }
        if (element.type === "freehand") {
          if (!element.points.length) return;
          const points = element.points;
          if (points.length === 1) {
            const point = points[0]; const pressureAware = point.pressure !== undefined || point.tiltX !== undefined || point.tiltY !== undefined;
            const pressure = pressureAware ? stylusStrokeWidth(point, element.thickness) : element.thickness;
            const tilt = pressureAware ? Math.min(1, Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0) / 90) : 0;
            const radiusX = Math.max(.25, pressure * (pressureAware ? .5 + tilt * .35 : .5) * scale);
            const radiusY = Math.max(.25, pressure * .5 * scale);
            const centerX = x0 + point.x * scale; const centerY = yTop - point.y * scale;
            const rotated = !!element.rotation;
            if (rotated) page.pushOperators(pushGraphicsState(), translate(centerX, centerY), rotateDegrees(-(element.rotation ?? 0)), translate(-centerX, -centerY));
            page.drawEllipse({ x: centerX, y: centerY, xScale: radiusX, yScale: radiusY, color: pdfColor(themeInk(element.color, theme()), pdfColorMode()), opacity: element.opacity ?? 1 });
            if (rotated) page.pushOperators(popGraphicsState());
            return;
          }
          if (points.some(point => point.pressure !== undefined || point.tiltX !== undefined || point.tiltY !== undefined)) {
            const box = elementBounds(element); const centerX = x0 + (box.x + box.w / 2) * scale; const centerY = yTop - (box.y + box.h / 2) * scale; const rotated = !!element.rotation;
            if (rotated) page.pushOperators(pushGraphicsState(), translate(centerX, centerY), rotateDegrees(-(element.rotation ?? 0)), translate(-centerX, -centerY));
            const ink = pdfColor(themeInk(element.color, theme()), pdfColorMode());
            for (let index = 1; index < points.length; index++) { const a = points[index - 1]; const b = points[index]; const width = (stylusStrokeWidth(a, element.thickness) + stylusStrokeWidth(b, element.thickness)) / 2; page.drawSvgPath(`M ${a.x} ${a.y} L ${b.x} ${b.y}`, { x: x0, y: yTop, scale, borderColor: ink, borderWidth: width * scale, borderOpacity: element.opacity ?? 1, borderLineCap: LineCapStyle.Round }); }
            if (rotated) page.pushOperators(popGraphicsState()); return;
          }
          let d = `M ${points[0].x} ${points[0].y}`;
          for (let i=1;i<points.length;i++){const a=points[i-1],b=points[i];const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};d+=` Q ${a.x} ${a.y} ${mid.x} ${mid.y}`;} const last=points[points.length-1];d+=` L ${last.x} ${last.y}`;
          const box = elementBounds(element); const centerX = x0 + (box.x + box.w / 2) * scale; const centerY = yTop - (box.y + box.h / 2) * scale; const rotated = !!element.rotation;
          if (rotated) page.pushOperators(pushGraphicsState(), translate(centerX, centerY), rotateDegrees(-(element.rotation ?? 0)), translate(-centerX, -centerY));
          const ink = pdfColor(themeInk(element.color, theme()), pdfColorMode());
          page.drawSvgPath(d, { x: x0, y: yTop, scale, borderColor: ink, borderWidth: element.thickness * scale, borderOpacity: element.opacity ?? 1, borderLineCap: LineCapStyle.Round });
          if (rotated) page.pushOperators(popGraphicsState()); return;
        }
        const x=element.x,y=element.y,w=element.w,h=element.h; let path="";
        if(element.type==="rectangle") { const l=Math.min(x,x+w),t=Math.min(y,y+h),ww=Math.abs(w),hh=Math.abs(h); const r=element.edgeStyle==="pill"?Math.min(ww,hh)/2:element.edgeStyle==="rounded"?Math.min(element.cornerRadius??14,ww/2,hh/2):0; const c=Math.min(element.cornerRadius??12,ww/2,hh/2); path=element.edgeStyle==="cut"?`M ${l+c} ${t} H ${l+ww-c} L ${l+ww} ${t+c} V ${t+hh-c} L ${l+ww-c} ${t+hh} H ${l+c} L ${l} ${t+hh-c} V ${t+c} Z`:r?`M ${l+r} ${t} H ${l+ww-r} Q ${l+ww} ${t} ${l+ww} ${t+r} V ${t+hh-r} Q ${l+ww} ${t+hh} ${l+ww-r} ${t+hh} H ${l+r} Q ${l} ${t+hh} ${l} ${t+hh-r} V ${t+r} Q ${l} ${t} ${l+r} ${t} Z`:`M ${l} ${t} H ${l+ww} V ${t+hh} H ${l} Z`; }
        else if(element.type==="circle"){const cx=x+w/2,cy=y+h/2,rx=Math.abs(w)/2,ry=Math.abs(h)/2,k=.55228475;path=`M ${cx+rx} ${cy} C ${cx+rx} ${cy+k*ry} ${cx+k*rx} ${cy+ry} ${cx} ${cy+ry} C ${cx-k*rx} ${cy+ry} ${cx-rx} ${cy+k*ry} ${cx-rx} ${cy} C ${cx-rx} ${cy-k*ry} ${cx-k*rx} ${cy-ry} ${cx} ${cy-ry} C ${cx+k*rx} ${cy-ry} ${cx+rx} ${cy-k*ry} ${cx+rx} ${cy} Z`; }
        else if(element.type==="diamond")path=`M ${x+w/2} ${y} L ${x+w} ${y+h/2} L ${x+w/2} ${y+h} L ${x} ${y+h/2} Z`;
        else if(element.type==="triangle"){const l=Math.min(x,x+w),r=Math.max(x,x+w),t=Math.min(y,y+h),b=Math.max(y,y+h);path=`M ${(l+r)/2} ${t} L ${r} ${b} L ${l} ${b} Z`;}
        else if(element.type==="flowchart")path=vectorFlowchartPath(element);
        else {
          const route = element.type === "arrow" ? element.arrowRoute ?? "straight" : element.lineRoute ?? "straight";
          path = connectorSvgPath(element);
          if (element.lineStyle === "double") {
            const normal = { x: -h / Math.max(1, Math.hypot(w, h)), y: w / Math.max(1, Math.hypot(w, h)) };
            const offset = Math.max(2.5, element.thickness * 1.2);
            for (const side of [-1, 1]) {
              const shifted = path.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_match, a, b) => `${Number(a) + normal.x * offset * side} ${Number(b) + normal.y * offset * side}`);
              pathStyle(page, shifted, element, scale, x0, yTop);
            }
          } else pathStyle(page, path, element, scale, x0, yTop);
          if (element.type === "arrow" || element.type === "line") for (const head of arrowHeadEntries(element, route)) {
            const radius = Math.max(3, element.thickness * 1.15);
            if (head.kind === "dot") {
              page.drawEllipse({ x: bleed + margin + (head.tip.x - bounds.x) * scale, y: paperH - bleed - margin - (head.tip.y - bounds.y) * scale, xScale: radius * scale, yScale: radius * scale, color: pdfColor(themeInk(element.color, theme()), pdfColorMode()), opacity: element.opacity ?? 1 });
              continue;
            }
            const headPath = arrowHeadSvgPath(head.tip, head.angle, head.kind, element.thickness);
            if (!headPath) continue;
            const filled = ["solid", "thick", "diamond"].includes(head.kind);
            pathStyle(page, headPath, element, scale, x0, yTop, filled ? themeInk(element.color, theme()) : undefined, element.opacity ?? 1);
          }
          if (isLabelShape(element)) drawShapeLabel(element, drawText);
          return;
        }
        if(path)pathStyle(page,path,element,scale,x0,yTop,element.fillColor);
        if(element.type==="flowchart"&&element.flowchartShape==="database"){const detail=flowchartSvgDetailPath(element);if(detail)pathStyle(page,detail,element,scale,x0,yTop);}
        if(isLabelShape(element))drawShapeLabel(element,drawText);
      };
      const drawShapeLabel=(shape:ShapeElement,draw:(text:string,x:number,y:number,color:string,size:number,family:FontFamily|undefined,bold:boolean,italic:boolean,opacity:number,rotation?:number,rotationCenter?:Point)=>void)=>{if(!shape.label||!textMeasureContext)return;const bounds=elementBounds(shape),center={x:bounds.x+bounds.w/2,y:bounds.y+bounds.h/2};for(const run of textLayout(textMeasureContext,shape))draw(run.text,run.x,run.y,shape.label.color,shape.label.fontSize,shape.label.fontFamily,!!shape.label.bold,!!shape.label.italic,shape.label.opacity??1,shape.rotation??0,center);};
      for(const item of visible)await drawItem(item);
      if(pdfHeader().trim())page.drawText(pdfHeader(),{x:bleed+margin,y:paperH-bleed-margin+4,size:9,font:fontBold,color:pdfColor("#333333",pdfColorMode())});
      if(pdfFooter().trim())page.drawText(pdfFooter(),{x:bleed+margin,y:bleed+margin/2,size:9,font:fontRegular,color:pdfColor("#333333",pdfColorMode())});
      page.drawText(`Page ${sceneIndex+1} of ${scenes.length}`,{x:paperW-bleed-margin-56,y:bleed+margin/2,size:9,font:fontRegular,color:pdfColor("#333333",pdfColorMode())});
      if(pdfCropMarks()){const t=bleed;const marks:{start:{x:number;y:number};end:{x:number;y:number}}[]=[{start:{x:t-7,y:t},end:{x:t-2,y:t}},{start:{x:t,y:t-7},end:{x:t,y:t-2}},{start:{x:paperW-t+2,y:t},end:{x:paperW-t+7,y:t}},{start:{x:paperW-t,y:t-7},end:{x:paperW-t,y:t-2}},{start:{x:t-7,y:paperH-t},end:{x:t-2,y:paperH-t}},{start:{x:t,y:paperH-t+2},end:{x:t,y:paperH-t+7}},{start:{x:paperW-t+2,y:paperH-t},end:{x:paperW-t+7,y:paperH-t}},{start:{x:paperW-t,y:paperH-t+2},end:{x:paperW-t,y:paperH-t+7}}];for(const mark of marks)page.drawLine({...mark,thickness:.35,color:rgb(0,0,0)});}
    }
    return doc.save();
  }

  async function exportAs(format: "png" | "svg" | "pdf") {
    if (!canvas || nativeBusy() || documentBusy()) return;
    setNativeBusy(true);
    try {
      if ((!Number.isFinite(exportWidth()) || !Number.isFinite(exportHeight()) || exportWidth() < 1 || exportHeight() < 1 || exportWidth() > 12000 || exportHeight() > 12000 || exportWidth() * exportHeight() > 60_000_000)) throw new Error("Choose dimensions between 1 and 12,000 pixels, totaling no more than 60 megapixels.");
      commitTextDraft();
      const exportItems = cloneElements(exportScope() === "selection" ? selectedElements() : elements()).filter(item => !item.hidden);
      if (exportScope() === "selection" && !exportItems.length) throw new Error("Select one or more visible objects to export.");
      if (format === "pdf" && pdfPageSet() !== "current" && !selectedPdfPages().length) throw new Error("There are no sketch pages in the selected export range.");
      const rect = canvas.getBoundingClientRect(); const view = { ...canvasState() };
      const prepareImages = async (items: Element[]): Promise<void> => { await Promise.all(items.map(async item => { if (item.type === "group") await prepareImages(item.elements); else if (item.type === "image") { let bitmap = imageCache.get(item.dataUrl); if (!bitmap) { bitmap = new Image(); bitmap.src = item.dataUrl; imageCache.set(item.dataUrl, bitmap); } await bitmap.decode(); } })); };
      await prepareImages(format === "pdf" && pdfPageSet() !== "current" ? selectedPdfPages().flatMap(page => page.elements) : exportItems);
      const rawBounds = exportScope() === "viewport" ? { x: -view.panX / view.zoom, y: -view.panY / view.zoom, w: rect.width / view.zoom, h: rect.height / view.zoom } : unionBounds(exportItems.map(elementBounds)) ?? { x: 0, y: 0, w: 800, h: 600 };
      const padding = exportScope() === "viewport" ? 0 : 24;
      const bounds = { x: rawBounds.x - padding, y: rawBounds.y - padding, w: Math.max(1, rawBounds.w + padding * 2), h: Math.max(1, rawBounds.h + padding * 2) };
      const exportViewFor = (width: number, height: number) => { const zoom = Math.min(width / bounds.w, height / bounds.h); return { ...view, zoom, panX: (width - bounds.w * zoom) / 2 - bounds.x * zoom, panY: (height - bounds.h * zoom) / 2 - bounds.y * zoom }; };
      const path = await save({ title: `Export SketchDraw as ${format.toUpperCase()}`, defaultPath: `SketchDraw.${format}`, filters: [{ name: format.toUpperCase(), extensions: [format] }] });
      if (!path) return;
      const target = path.toLowerCase().endsWith(`.${format}`) ? path : `${path}.${format}`;

      if (format === "pdf") {
        const metrics = pdfMetrics();
        if (metrics.pageCount > 1000) throw new Error("This layout would create more than 1,000 PDF pages. Increase the page size, reduce the artwork dimensions, or lower the overlap.");
        if (metrics.innerWidthPx * metrics.innerHeightPx > 60_000_000 || (pdfLayout() === "tiled" && exportWidth() * exportHeight() > 60_000_000)) throw new Error("PDF raster dimensions exceed 60 megapixels. Reduce the page DPI or artwork size.");
        if (metrics.pageCount * metrics.innerWidthPx * metrics.innerHeightPx > 240_000_000) throw new Error("This PDF would exceed the 240-megapixel output budget. Lower print quality, reduce the page count, or use a smaller paper size.");
        if (pdfLayout() === "fit") {
          const scenes = pdfPageSet() === "current" ? [{ items: exportItems, view }] : selectedPdfPages().map(page => ({ items: cloneElements(page.elements).filter(item => !item.hidden), view: page.canvasState }));
          await writeFile(target, await makeVectorPdf(scenes, { widthPt: metrics.page.widthPt, heightPt: metrics.page.heightPt }, metrics.marginMm));
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
        await writeFile(target, imagePdfPages(rasterPages));
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
        const shapes = exportItems.map(elementToSvg).join("\n");
        const pattern = whiteboardStyle(); const svgGridColor = theme() === "dark" ? "#414653" : "#deddd6"; const patternBase = pattern === "small-dots" || pattern === "small-grid" ? 12 : pattern === "ruled" ? 30 : GRID_SIZE; const gridStep = patternBase * state.zoom;
        const isoHeight = gridStep * Math.sqrt(3);
        const gridMark = pattern === "lines" || pattern === "small-grid" ? `<path d="M ${gridStep} 0 H 0 V ${gridStep}" fill="none" stroke="${svgGridColor}" stroke-width="0.65"/>` : pattern === "ruled" ? `<path d="M 0 ${gridStep} H 8" fill="none" stroke="${svgGridColor}" stroke-width="0.65"/>` : pattern === "isometric" ? `<path d="M 0 0 H ${gridStep} M 0 ${isoHeight / 2} H ${gridStep} M 0 ${isoHeight} H ${gridStep} M 0 0 L ${gridStep} ${isoHeight} M 0 ${isoHeight} L ${gridStep} 0" fill="none" stroke="${svgGridColor}" stroke-width="0.65"/>` : `<circle cx="1" cy="1" r="${pattern === "small-dots" ? 0.65 : 0.85}" fill="${svgGridColor}"/>`;
        const gridWidth = pattern === "ruled" ? 8 : gridStep; const gridHeight = pattern === "isometric" ? isoHeight : gridStep;
        const grid = exportGrid() && showGrid() && pattern !== "plain" && !exportTransparent() ? `<pattern id="grid" width="${gridWidth}" height="${gridHeight}" patternUnits="userSpaceOnUse" x="${state.panX}" y="${state.panY}">${gridMark}</pattern><rect width="100%" height="100%" fill="url(#grid)"/>` : "";
        const svgBackground = renderedBoardColor();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${exportWidth()}" height="${exportHeight()}" viewBox="0 0 ${exportWidth()} ${exportHeight()}">${exportTransparent() ? "" : `<rect width="100%" height="100%" fill="${svgBackground}"/>`}${grid}<g transform="translate(${state.panX} ${state.panY}) scale(${state.zoom})">${shapes}</g></svg>`;
        await writeTextFile(target, svg);
      }
      setError("");
    } catch (cause) { setError(`Could not export image: ${String(cause)}`); } finally { setNativeBusy(false); }
  }

  function noteCardSvg(group: Extract<Element, { type: "group" }>): string {
    const meta = group.note; const background = group.elements.find((child): child is ShapeElement => child.type === "rectangle");
    if (!meta || !background) return "";
    const x = background.x, y = background.y, width = Math.abs(background.w), height = Math.abs(background.h), palette = noteCardPalette(meta.kind, theme(), componentAppearance()), simple = componentAppearance() === "simple";
    const title = escapeXml(meta.title || defaultNoteTitle(meta.kind)); const collapsed = meta.collapsed === true; const clipId = `note-${(group.id ?? crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "")}`;
    let body = "";
    if (!collapsed) {
      if (meta.kind === "checklist") {
        const rows = checklistRows(meta.content, width, meta.fontSize ?? 14); const done = rows.filter(row => row.done).length;
        body += `<text x="${x + 16}" y="${y + 53}" dominant-baseline="hanging" font-family="sans-serif" font-size="10" fill="${palette.muted}">${done} of ${rows.length} complete</text><rect x="${x + 16}" y="${y + 71}" width="${width - 32}" height="3" rx="${componentAppearance() === "simple" ? 0 : 2}" fill="${palette.rule}"/><rect x="${x + 16}" y="${y + 71}" width="${rows.length ? (width - 32) * done / rows.length : 0}" height="3" rx="${componentAppearance() === "simple" ? 0 : 2}" fill="${palette.check}"/>`;
        body += rows.map(row => { const boxX = x + row.boxX, boxY = y + row.top + Math.max(0, (row.height - 16) / 2), textY = y + row.top + (row.height - row.labelLines.length * row.lineHeight) / 2; return `<rect x="${boxX}" y="${boxY}" width="16" height="16" rx="${simple ? 0 : 4}" fill="${row.done ? palette.check : palette.surface}" stroke="${row.done ? palette.check : palette.border}"/>${row.done ? `<path d="M ${boxX + 4} ${boxY + 8} l3 3 5 -6" fill="none" stroke="${simple ? palette.ink : "#fff"}" stroke-width="1.8"/>` : ""}${row.labelLines.map((line, index) => `<text x="${x + row.textX}" y="${textY + index * row.lineHeight}" dominant-baseline="hanging" font-family="sans-serif" font-size="${meta.fontSize ?? 14}" fill="${row.done ? palette.muted : palette.ink}">${escapeXml(line)}</text>`).join("")}`; }).join("");
      } else {
        let cursor = y + 58, inCode = false, language = "text", codeLines: string[] = [];
        const addCode = () => { const fontSize = meta.fontSize ?? 14; const max = Math.max(8, Math.floor((width - 42) / (fontSize * .62))); const lines = codeLines.flatMap(line => { const chunks: string[] = []; for (let index = 0; index < Math.max(1, line.length); index += max) chunks.push(line.slice(index, index + max)); return chunks; }); const blockHeight = Math.max(45, lines.length * fontSize * 1.5 + 26); body += `<rect x="${x + 10}" y="${cursor}" width="${width - 20}" height="${blockHeight}" rx="${simple ? 0 : 7}" fill="${simple ? palette.surface : "#202936"}" stroke="${simple ? palette.rule : "#344154"}"/><text x="${x + 20}" y="${cursor + 7}" dominant-baseline="hanging" font-family="sans-serif" font-size="9" font-weight="600" fill="${simple ? palette.muted : "#91a1b5"}">${escapeXml(language.toUpperCase())}</text>${lines.map((line, index) => { let column = 0; return syntaxTokens(line, language).map(token => { const rendered = `<text x="${x + 20 + column * fontSize * .62}" y="${cursor + 22 + index * fontSize * 1.5}" dominant-baseline="hanging" font-family="monospace" font-size="${fontSize}" fill="${syntaxTokenColor(token.color, theme(), componentAppearance())}">${escapeXml(token.value)}</text>`; column += token.value.length; return rendered; }).join(""); }).join("")}`; cursor += blockHeight + 9; codeLines = []; inCode = false; };
        const maxChars = Math.max(8, Math.floor((width - 36) / ((meta.fontSize ?? 14) * .56)));
        for (const line of meta.content.split(/\r?\n/)) {
          const fence = /^\s*```\s*([\w+#.-]*)\s*$/.exec(line); if (fence) { if (!inCode) { inCode = true; language = fence[1] || "text"; } else addCode(); continue; }
          if (inCode) { codeLines.push(line); continue; } if (!line.trim()) { cursor += 8; continue; }
          const heading = /^(#{1,3})\s+(.*)$/.exec(line); const value = heading?.[2] ?? line; const size = heading ? (meta.fontSize ?? 14) + (4 - heading[1].length) * 2 : (meta.fontSize ?? 14);
          for (let index = 0; index < Math.max(1, value.length); index += maxChars) { body += `<text x="${x + 16}" y="${cursor}" dominant-baseline="hanging" font-family="sans-serif" font-size="${size}" font-weight="${heading ? 650 : 400}" fill="${palette.ink}">${escapeXml(value.slice(index, index + maxChars))}</text>`; cursor += size * 1.5; }
        }
        if (inCode) addCode();
      }
    }
    const summaryRows = collapsed && meta.kind === "checklist" ? checklistRows(meta.content, width, meta.fontSize ?? 14) : undefined;
    const summary = summaryRows ? `${summaryRows.filter(row => row.done).length} of ${summaryRows.length} tasks` : meta.content.split(/\r?\n/).find(line => line.trim() && !/^\s*```/.test(line))?.trim() || "Empty card";
    const chevron = collapsed ? `M ${x + width - 26} ${y + 30} l5 5 5 -5` : `M ${x + width - 26} ${y + 23} l5 -5 5 5`;
    const radius = simple ? 0 : 12; const accent = simple ? "" : `<path d="M ${x + 2} ${y + 13} v ${Math.max(0, height - 26)}" stroke="${palette.accent}" stroke-width="3" stroke-linecap="round"/>`;
    const toggleY = collapsed ? y + 6 : y + 11; const separator = collapsed ? "" : `<path d="M ${x + 14} ${y + 47} H ${x + width - 14}" stroke="${palette.rule}"/>`;
    return `<g><defs><clipPath id="${clipId}"><rect x="${x + 8}" y="${y + 49}" width="${Math.max(0, width - 16)}" height="${Math.max(0, height - 57)}"/></clipPath></defs><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${palette.surface}" stroke="${palette.border}"/>${accent}<text x="${x + 14}" y="${y + (collapsed ? 8 : 13)}" dominant-baseline="hanging" font-family="sans-serif" font-size="${collapsed ? 12 : 13}" font-weight="600" fill="${palette.ink}">${title}</text>${collapsed ? `<text x="${x + 14}" y="${y + 31}" dominant-baseline="hanging" font-family="sans-serif" font-size="9" fill="${palette.muted}">${escapeXml(summary.slice(0, 80))}</text>` : ""}<rect x="${x + width - 36}" y="${toggleY}" width="24" height="24" rx="${simple ? 0 : 7}" fill="${palette.soft}" stroke="${palette.rule}"/><path d="${chevron}" fill="none" stroke="${palette.muted}" stroke-width="1.5"/>${separator}${collapsed ? "" : `<g clip-path="url(#${clipId})">${body}</g>`}</g>`;
  }

  function elementToSvg(element: Element): string {
    if (element.hidden) return "";
    if (element.type === "group") return element.note ? noteCardSvg(element) : `<g>${element.elements.map(elementToSvg).join("")}</g>`;
    element = simpleComponentElement(element);
    const bounds = elementBounds(element); const cx = bounds.x + bounds.w / 2; const cy = bounds.y + bounds.h / 2;
    const content = elementSvgBody(element) + (isLabelShape(element) ? labelSvg(element) : "");
    return element.rotation ? `<g transform="rotate(${element.rotation} ${cx} ${cy})">${content}</g>` : content;
  }

  function elementSvgBody(element: Element): string {
    if (element.type === "group") return `<g>${element.elements.map(elementToSvg).join("")}</g>`;
    if (element.hidden) return "";
    if (element.type === "image") { const sx = element.cropX ?? 0; const sy = element.cropY ?? 0; const sw = element.cropW ?? element.sourceWidth ?? element.w; const sh = element.cropH ?? element.sourceHeight ?? element.h; return `<svg x="${element.x}" y="${element.y}" width="${element.w}" height="${element.h}" viewBox="${sx} ${sy} ${sw} ${sh}" preserveAspectRatio="none" opacity="${element.opacity ?? 1}"><image width="${element.sourceWidth ?? sw}" height="${element.sourceHeight ?? sh}" href="${element.dataUrl}"/></svg>`; }
    if (element.type === "schemaTable") {
      const simple = componentAppearance() === "simple"; const dark = theme() === "dark"; const size = element.fontSize ?? 14; const headerHeight = Math.max(42, size * 2.8); const rowHeight = Math.max(30, size * 1.8);
      const ink = simple ? (dark ? "#b0b0b0" : "#555555") : (dark ? "#506174" : "#9badbf"); const surface = simple ? (dark ? "#202020" : "#ffffff") : (dark ? "#202a35" : "#fbfcfe"); const header = simple ? surface : (dark ? "#30465b" : "#e8f0f7"); const mainText = simple ? (dark ? "#f0f0f0" : "#262626") : (dark ? "#d8e8f5" : "#36556e");
      const rows = element.columns.map((column, index) => {
        const y = element.y + headerHeight + index * rowHeight;
        const badge = column.primaryKey || column.foreignTable ? '<rect x="' + (element.x + 11) + '" y="' + (y + 7) + '" width="24" height="16" rx="' + (simple ? 0 : 5) + '" fill="' + (simple ? (dark ? "#3a3a3a" : "#eeeeee") : column.primaryKey ? (dark ? "#6a5930" : "#f4e9c7") : (dark ? "#31556b" : "#e1eff6")) + '"/><text x="' + (element.x + 23) + '" y="' + (y + 18.5) + '" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="700" fill="' + (simple ? mainText : column.primaryKey ? (dark ? "#f0d58c" : "#826b2f") : (dark ? "#aed9ed" : "#436e85")) + '">' + (column.primaryKey ? "PK" : "FK") + "</text>" : "";
        return (index ? '<path d="M ' + (element.x + 10) + " " + y + " H " + (element.x + element.w - 10) + '" stroke="' + (simple ? ink : dark ? "#394856" : "#e6ebf0") + '"/>' : "") + badge + '<text x="' + (element.x + 44) + '" y="' + (y + rowHeight * .64) + '" font-family="monospace" font-size="' + (size * .86) + '" fill="' + (simple ? mainText : dark ? "#dbe5ee" : "#354759") + '">' + escapeXml(column.name) + '</text><text x="' + (element.x + element.w - 14) + '" y="' + (y + rowHeight * .64) + '" text-anchor="end" font-family="monospace" font-size="' + (size * .78) + '" fill="' + (simple ? mainText : dark ? "#a4b1bf" : "#768493") + '">' + escapeXml(column.dataType || "type") + "</text>";
      }).join("");
      const headerShape = simple ? '<rect x="' + element.x + '" y="' + element.y + '" width="' + element.w + '" height="' + headerHeight + '" fill="' + header + '"/>' : '<path d="M ' + (element.x + 10) + " " + element.y + " H " + (element.x + element.w - 10) + " Q " + (element.x + element.w) + " " + element.y + " " + (element.x + element.w) + " " + (element.y + 10) + " V " + (element.y + headerHeight) + " H " + element.x + " V " + (element.y + 10) + " Q " + element.x + " " + element.y + " " + (element.x + 10) + " " + element.y + ' Z" fill="' + header + '"/>';
      return '<g opacity="' + (element.opacity ?? 1) + '"><rect x="' + element.x + '" y="' + element.y + '" width="' + element.w + '" height="' + element.h + '" rx="' + (simple ? 0 : 10) + '" fill="' + surface + '" stroke="' + ink + '" stroke-width="1.4"/>' + headerShape + '<path d="M ' + element.x + " " + (element.y + headerHeight) + " H " + (element.x + element.w) + '" stroke="' + ink + '"/><text x="' + (element.x + 14) + '" y="' + (element.y + headerHeight * .62) + '" font-family="sans-serif" font-size="' + size + '" font-weight="600" fill="' + mainText + '">' + escapeXml(element.name) + "</text>" + rows + "</g>";
    }
    if (element.type === "text") {
      const family = fontCss(element.fontFamily);
      const lines = element.text.split(/\r?\n/).map((line, index) => { const formatted = element.listType === "bullet" ? `• ${line}` : element.listType === "number" ? `${index + 1}. ${line}` : line; return `<tspan x="${element.x}" dy="${index === 0 ? 0 : element.fontSize * 1.25}">${escapeXml(formatted)}</tspan>`; }).join("");
      return `<text x="${element.x}" y="${element.y + element.fontSize}" fill="${escapeXml(themeInk(element.color, theme()))}" opacity="${element.opacity ?? 1}" font-size="${element.fontSize}" font-family="${family}" font-weight="${element.bold ? "700" : "400"}" font-style="${element.italic ? "italic" : "normal"}" text-decoration="${element.underline ? "underline" : "none"}" text-anchor="${element.textAlign === "center" ? "middle" : element.textAlign === "right" ? "end" : "start"}">${lines}</text>`;
    }
    const fillColor = "fillColor" in element ? element.fillColor : undefined;
    const dash = "lineStyle" in element && element.lineStyle === "dashed" ? `${element.thickness * 4} ${element.thickness * 2.5}` : "lineStyle" in element && element.lineStyle === "dotted" ? `${element.thickness} ${element.thickness * 2.2}` : "";
    const fillOpacity = "fillOpacity" in element ? element.fillOpacity ?? 0.2 : 0.2;
    const ink = themeInk(element.color, theme());
    const strokeWidth = element.thickness;
    const strokeOpacity = element.opacity ?? 1;
    const style = `fill="${fillColor ? escapeXml(fillColor) : "none"}"${fillColor ? ` fill-opacity="${fillOpacity}"` : ""} stroke="${escapeXml(ink)}" opacity="${strokeOpacity}" stroke-width="${strokeWidth}" stroke-dasharray="${dash}" stroke-linecap="round" stroke-linejoin="round"`;
    if (element.type === "freehand") {
      if (!element.points.length) return "";
      const points = element.points;
      if (points.some(point => point.pressure !== undefined || point.tiltX !== undefined || point.tiltY !== undefined)) {
        const ink = escapeXml(themeInk(element.color, theme())); const marks = points.map((point, index) => {
          const width = stylusStrokeWidth(point, element.thickness); const tilt = Math.min(1, Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0) / 90); const angle = Math.atan2(point.tiltY ?? 0, point.tiltX ?? 0) * 180 / Math.PI;
          const stamp = `<ellipse cx="${point.x}" cy="${point.y}" rx="${Math.max(.25, width * (.5 + tilt * .35))}" ry="${Math.max(.25, width * .5)}" transform="rotate(${angle} ${point.x} ${point.y})" fill="${ink}" opacity="${strokeOpacity}"/>`;
          if (index === 0) return stamp;
          const previous = points[index - 1]; const segmentWidth = (stylusStrokeWidth(previous, element.thickness) + width) / 2;
          return `<path d="M ${previous.x} ${previous.y} L ${point.x} ${point.y}" fill="none" stroke="${ink}" opacity="${strokeOpacity}" stroke-width="${segmentWidth}" stroke-linecap="round"/>${stamp}`;
        }).join("");
        return `<g>${marks}</g>`;
      }
      if (points.length === 1) return `<circle cx="${points[0].x}" cy="${points[0].y}" r="${Math.max(.5, element.thickness / 2)}" fill="${escapeXml(themeInk(element.color, theme()))}" opacity="${strokeOpacity}"/>`;
      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]; const b = points[i]; const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        d += ` Q ${a.x} ${a.y} ${mid.x} ${mid.y}`;
      }
      const last = points[points.length - 1]; d += ` L ${last.x} ${last.y}`;
      return `<path d="${d}" ${style}/>`;
    }
    if (element.type === "rectangle") { const width = Math.abs(element.w); const height = Math.abs(element.h); const radius = element.edgeStyle === "pill" ? Math.min(width, height) / 2 : element.edgeStyle === "rounded" ? Math.min(element.cornerRadius ?? 14, width / 2, height / 2) : 0; if (element.edgeStyle === "cut") { const x = Math.min(element.x, element.x + element.w); const y = Math.min(element.y, element.y + element.h); const c = Math.min(element.cornerRadius ?? 12, width / 2, height / 2); return `<path d="M ${x + c} ${y} H ${x + width - c} L ${x + width} ${y + c} V ${y + height - c} L ${x + width - c} ${y + height} H ${x + c} L ${x} ${y + height - c} V ${y + c} Z" ${style}/>`; } return `<rect x="${Math.min(element.x, element.x + element.w)}" y="${Math.min(element.y, element.y + element.h)}" width="${width}" height="${height}" rx="${radius}" ${style}/>`; }
    if (element.type === "diamond") return `<path d="M ${element.x + element.w / 2} ${element.y} L ${element.x + element.w} ${element.y + element.h / 2} L ${element.x + element.w / 2} ${element.y + element.h} L ${element.x} ${element.y + element.h / 2} Z" ${style}/>`;
    if (element.type === "triangle") { const left = Math.min(element.x, element.x + element.w); const right = Math.max(element.x, element.x + element.w); const top = Math.min(element.y, element.y + element.h); const bottom = Math.max(element.y, element.y + element.h); return `<path d="M ${(left + right) / 2} ${top} L ${right} ${bottom} L ${left} ${bottom} Z" ${style}/>`; }
    if (element.type === "circle") return `<ellipse cx="${element.x + element.w / 2}" cy="${element.y + element.h / 2}" rx="${Math.abs(element.w / 2)}" ry="${Math.abs(element.h / 2)}" ${style}/>`;
    if (element.type === "flowchart") {
      const detail = flowchartSvgDetailPath(element);
      const detailStyle = `fill="none" stroke="${escapeXml(ink)}" opacity="${element.opacity ?? 1}" stroke-width="${element.thickness}" stroke-dasharray="${dash}" stroke-linecap="round" stroke-linejoin="round"`;
      return `<path d="${flowchartSvgPath(element)}" ${style}/>${detail ? `<path d="${detail}" ${detailStyle}/>` : ""}`;
    }
    if (element.type === "line" || element.type === "arrow") {
      const routed = connectorForView(element); const path = connectorSvgPath(routed); const route = routed.type === "arrow" ? routed.arrowRoute ?? "straight" : routed.lineRoute ?? "straight";
      const shift = routed.lineStyle === "double" ? Math.max(2.5, routed.thickness * 1.2) : 0; const first = routed.routePoints?.[0] ?? { x: routed.x + routed.w, y: routed.y + routed.h }; const normal = { x: -(first.y - routed.y) / Math.max(1, Math.hypot(first.x - routed.x, first.y - routed.y)), y: (first.x - routed.x) / Math.max(1, Math.hypot(first.x - routed.x, first.y - routed.y)) };
      const paths = shift ? `<path d="${path}" transform="translate(${normal.x * shift} ${normal.y * shift})" ${style}/><path d="${path}" transform="translate(${-normal.x * shift} ${-normal.y * shift})" ${style}/>` : `<path d="${path}" ${style}/>`;
      const headSvg = (tip: Point, direction: number, kind: ArrowHead) => {
        if (kind === "none") return "";
        if (kind === "dot") return `<circle cx="${tip.x}" cy="${tip.y}" r="${Math.max(3, routed.thickness * 1.15)}" fill="${ink}" opacity="${routed.opacity ?? 1}"/>`;
        const points = arrowHeadPoints(tip, direction, kind, routed.thickness); const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");
        if (kind === "solid" || kind === "thick" || kind === "diamond") return `<polygon points="${polygon}" fill="${ink}" stroke="${ink}" stroke-width="${routed.thickness}" opacity="${routed.opacity ?? 1}"/>`;
        if (kind === "open") return `<path d="M ${tip.x} ${tip.y} L ${points[0].x} ${points[0].y} M ${tip.x} ${tip.y} L ${points[1].x} ${points[1].y}" ${style}/>`;
        return `<path d="M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}" ${style}/>`;
      };
      return `${paths}${arrowHeadEntries(routed, route).map(({ tip, angle: direction, kind }) => headSvg(tip, direction, kind)).join("")}`;
    }
    return "";
  }

  function escapeXml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" })[char]!); }

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
    const zoom = touchGesture.action === "pan" ? touchGesture.initialZoom : Math.max(.02, Math.min(8, touchGesture.initialZoom * distance / touchGesture.initialDistance));
    let panX: number; let panY: number;
    if (touchGesture.action === "pan") {
      panX = touchGesture.initialPanX + midpoint.x - touchGesture.initialMidpoint.x;
      panY = touchGesture.initialPanY + midpoint.y - touchGesture.initialMidpoint.y;
    } else {
      const anchor = touchGesture.action === "zoom" ? touchGesture.initialMidpoint : midpoint;
      panX = anchor.x - rect.left - touchGesture.worldAnchor.x * zoom;
      panY = anchor.y - rect.top - touchGesture.worldAnchor.y * zoom;
    }
    setCanvasState({ ...current, zoom, panX, panY });
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
    if (readOnlyView() && tool() === "laser") {
      const hit = hitTest(point); const target = hit === undefined ? undefined : elements()[hit];
      if (hit !== undefined && target?.type === "group" && target.note && noteCollapseHit(target, point)) {
        toggleNoteCollapsed(hit); canvas.setPointerCapture(event.pointerId); return;
      }
    }
    if (boardLocked() && tool() !== "laser") return;
    if (isPenEraser) { event.preventDefault(); penEraserDrawing = true; drawing = true; eraseAtPoint(point); canvas.setPointerCapture(event.pointerId); return; }
    if (tool() === "select") {
      const handle = findTransformHandle(point);
      if (handle) { const original = elements()[handle.index]; resizeOrigin = { ...handle, start: point, original, before: elements(), moved: false }; canvas.setPointerCapture(event.pointerId); return; }
      const hit = hitTest(point);
      if (hit !== undefined) {
        const target = elements()[hit];
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
      const hit = hitTest(point) ?? hitInterior(point); if (hit !== undefined && isLabelShape(elements()[hit])) editShapeLabel(hit, event.pointerId); else startTextDraft(point, hit !== undefined && elements()[hit]?.type === "text" ? hit : undefined, event.pointerId); return;
    }
    if (tool() === "bucket") { const hit = hitInterior(point); if (hit !== undefined) updatePropertyForIndex(hit, fillColor()); return; }
    if (tool() === "eraser") { eraseAtPoint(point); drawing = true; canvas.setPointerCapture(event.pointerId); return; }
    if (tool() === "crop") { const hit = hitTest(point); if (hit !== undefined && elements()[hit].type === "image") { setSelectedIndices([hit]); marqueeOrigin = { point, additive: false, moved: false, cropIndex: hit }; setMarquee({ start: point, end: point }); canvas.setPointerCapture(event.pointerId); } return; }
    drawing = true; canvas.setPointerCapture(event.pointerId);
    activeDrawingTool = tool() === "laser" ? "pen" : tool() as Preview["type"];
    const start = activeDrawingTool === "line" || activeDrawingTool === "arrow" ? nearestBinding(elements(), point, 18 / canvasState().zoom)?.point ?? snap(point) : activeDrawingTool === "pen" ? point : snap(point);
    if (activeDrawingTool === "pen") {
      const laser = tool() === "laser"; const mode = brushMode();
      const strokePoint = tool() === "pen" ? strokePointFromPointer(event, point) : point; currentPoints = [strokePoint];
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
    if (resizeOrigin) setElements(resizeOrigin.before);
    if (moveOrigin) { moveOrigin = undefined; scheduleCanvasRender(); }
    drawing = false; currentPoints = []; penEraserDrawing = false;
    setPreview(undefined); setMarquee(undefined); setAttachmentHint(undefined); setAlignmentGuides(undefined);
    resizeOrigin = undefined; moveOrigin = undefined; marqueeOrigin = undefined; panOrigin = undefined;
    setIsPanning(false);
  }

  function pointerDown(event: PointerEvent) {
    if (!activePath()) return;
    if (event.pointerType === "pen") event.preventDefault();
    if (event.pointerType === "touch" && activePenPointerId !== undefined && !drawing && !panOrigin && !resizeOrigin && !moveOrigin && !marqueeOrigin) activePenPointerId = undefined;
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
      (canvasOptionsOpen() || !!touchStylePanel() || !!openToolOptions() || stencilMenuOpen() || paintBrushMenuOpen() || !!quickStylePopover() || !!contextMenu() || !!document.querySelector("details[open]") || !!noteEditor() || !!textDraft())) {
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
      if (touchPointers.size === 1 && !readOnlyView() && (oneFingerTapAction() !== "none" || oneFingerDragAction() === "pan")) {
        event.preventDefault();
        try { canvas.setPointerCapture(event.pointerId); } catch { /* The pointer can be canceled before capture. */ }
        return;
      }
    }
    beginCanvasInteraction(event);
  }

  function appendStrokeSample(event: PointerEvent, point: Point) {
    const previous = currentPoints[currentPoints.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) * canvasState().zoom < .05) return;
    currentPoints.push(tool() === "pen" ? strokePointFromPointer(event, point) : point);
  }

  function appendPenSamples(event: PointerEvent, appendTerminal = true) {
    const bounds = canvas.getBoundingClientRect(); const state = canvasState();
    let samples: PointerEvent[] = [];
    try { samples = event.getCoalescedEvents?.() ?? []; } catch { /* Some Android WebViews expose this API without implementing it. */ }
    for (const sample of samples) appendStrokeSample(sample, { x: (sample.clientX - bounds.left - state.panX) / state.zoom, y: (sample.clientY - bounds.top - state.panY) / state.zoom });
    if (appendTerminal) appendStrokeSample(event, { x: (event.clientX - bounds.left - state.panX) / state.zoom, y: (event.clientY - bounds.top - state.panY) / state.zoom });
  }

  function pointerRawUpdate(event: PointerEvent) {
    if (event.pointerType !== "pen" || !drawing || activePenPointerId !== event.pointerId || activeDrawingTool !== "pen" || !preview()) return;
    const previousLength = currentPoints.length;
    appendPenSamples(event);
    if (currentPoints.length !== previousLength) scheduleCanvasRender();
  }

  function pointerMove(event: PointerEvent) {
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
    if (resizeOrigin) {
      const point = toWorld(event); if (Math.hypot(point.x - resizeOrigin.start.x, point.y - resizeOrigin.start.y) > 0.5) resizeOrigin.moved = true;
      const resized = resizeElement(resizeOrigin.original, resizeOrigin.handle, resizeOrigin.start, point);
      setElementsTransient(resizeOrigin.before.map((element, index) => index === resizeOrigin!.index ? resized : element)); setDirty(true); return;
    }
    if (moveOrigin) {
      const point = toWorld(event); const dx = point.x - moveOrigin.point.x; const dy = point.y - moveOrigin.point.y;
      if (Math.hypot(dx, dy) > 0.5) moveOrigin.moved = true;
      if (moveOrigin.moved) {
        const snapped = snapTranslation(moveOrigin.indices, moveOrigin.before, dx, dy, moveOrigin.snapTargets);
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
    const raw = toWorld(event); const port = activeDrawingTool === "line" || activeDrawingTool === "arrow" ? nearestBinding(elements(), raw, 18 / canvasState().zoom) : undefined; setAttachmentHint(port?.point); const point = port?.point ?? (activeDrawingTool === "pen" ? raw : snap(raw));
    if (activeDrawingTool === "pen") {
      if (event.pointerType === "pen") {
        event.preventDefault();
        appendPenSamples(event);
      } else appendStrokeSample(event, point);
    }
    setPreview((previous) => previous ? { ...previous, end: point } : undefined);
  }

  function moveElement(element: Element, dx: number, dy: number): Element {
    if (element.locked) return element;
    if (element.type === "group") return { ...element, elements: element.elements.map((child) => moveElement(child, dx, dy)) };
    if (element.type === "freehand") return { ...element, points: element.points.map((point) => ({ ...point, x: point.x + dx, y: point.y + dy })) };
    if (isConnector(element)) {
      const shiftBranch = (branch: ShapeElement["forkUpper"]) => branch ? { ...branch, end: branch.end ? { x: branch.end.x + dx, y: branch.end.y + dy } : undefined, routePoints: branch.routePoints?.map(point => ({ x: point.x + dx, y: point.y + dy })) } : undefined;
      return { ...element, x: element.x + dx, y: element.y + dy, routePoints: element.routePoints?.map(p => ({ x: p.x + dx, y: p.y + dy })), forkUpper: shiftBranch(element.forkUpper), forkLower: shiftBranch(element.forkLower) };
    }
    return { ...element, x: element.x + dx, y: element.y + dy };
  }

  function canMoveElement(element: Element): boolean {
    return !element.locked && (element.type !== "group" || element.elements.every(canMoveElement));
  }

  function collectSnapTargets(indices: number[], before: Element[]) {
    const selected = new Set(indices); const x: number[] = []; const y: number[] = [];
    for (let index = 0; index < before.length; index++) {
      const element = before[index]; if (selected.has(index) || element.hidden) continue;
      const box = elementBounds(element);
      x.push(box.x, box.x + box.w / 2, box.x + box.w); y.push(box.y, box.y + box.h / 2, box.y + box.h);
    }
    x.sort((left, right) => left - right); y.sort((left, right) => left - right);
    return { x, y };
  }

  function collectMoveTargets(indices: number[], before: Element[]) {
    const selected = new Set(indices); const targets = new Map<string, Element>();
    const visit = (element: Element) => { if (element.id) targets.set(element.id, element); if (element.type === "group") element.elements.forEach(visit); };
    for (let index = 0; index < before.length; index++) if (selected.has(index)) visit(before[index]);
    return targets;
  }

  function snapTranslation(indices: number[], before: Element[], dx: number, dy: number, snapTargets: { x: number[]; y: number[] }) {
    const selected = new Set(indices); const moving = unionBounds(before.flatMap((element, index) => selected.has(index) && !element.hidden ? [elementBounds(element)] : []));
    if (!moving) { setAlignmentGuides(undefined); return { dx, dy }; }
    if (snapToGrid()) { dx = Math.round((moving.x + dx) / GRID_SIZE) * GRID_SIZE - moving.x; dy = Math.round((moving.y + dy) / GRID_SIZE) * GRID_SIZE - moving.y; }
    if (!snapToObjects() || (!snapTargets.x.length && !snapTargets.y.length)) { setAlignmentGuides(undefined); return { dx, dy }; }
    const left = moving.x; const top = moving.y; const right = moving.x + moving.w; const bottom = moving.y + moving.h;
    const movingX = [left, (left + right) / 2, right]; const movingY = [top, (top + bottom) / 2, bottom];
    const threshold = 8 / canvasState().zoom;
    const closest = (targets: number[], movingValues: number[], delta: number) => {
      let best: { correction: number; guide: number } | undefined;
      for (const source of movingValues) {
        const value = source + delta; let low = 0; let high = targets.length;
        while (low < high) { const middle = (low + high) >>> 1; if (targets[middle] < value) low = middle + 1; else high = middle; }
        for (const index of [low - 1, low]) {
          if (index < 0 || index >= targets.length) continue;
          const target = targets[index];
          const correction = target - (source + delta);
          if (Math.abs(correction) <= threshold && (!best || Math.abs(correction) < Math.abs(best.correction))) best = { correction, guide: target };
        }
      }
      return best;
    };
    const x = closest(snapTargets.x, movingX, dx); const y = closest(snapTargets.y, movingY, dy);
    const nextGuides = x || y ? { x: x?.guide, y: y?.guide } : undefined;
    setAlignmentGuides(current => current?.x === nextGuides?.x && current?.y === nextGuides?.y ? current : nextGuides);
    return { dx: dx + (x?.correction ?? 0), dy: dy + (y?.correction ?? 0) };
  }

  function hitInterior(point: Point): number | undefined {
    const context = canvas?.getContext("2d"); if (!context) return undefined;
    for (let index = elements().length - 1; index >= 0; index--) {
      const shape = elements()[index]; if (!isLabelShape(shape) || shape.hidden || shape.locked) continue;
      const cx = shape.x + shape.w / 2; const cy = shape.y + shape.h / 2; const angle = -(shape.rotation ?? 0) * Math.PI / 180;
      const local = { x: cx + (point.x - cx) * Math.cos(angle) - (point.y - cy) * Math.sin(angle), y: cy + (point.x - cx) * Math.sin(angle) + (point.y - cy) * Math.cos(angle) };
      context.save(); context.setTransform(1, 0, 0, 1, 0, 0); context.beginPath();
      const left = Math.min(shape.x, shape.x + shape.w); const top = Math.min(shape.y, shape.y + shape.h); const width = Math.abs(shape.w); const height = Math.abs(shape.h);
      if (shape.type === "circle") context.ellipse(cx, cy, width / 2, height / 2, 0, 0, Math.PI * 2);
      else if (shape.type === "diamond") { context.moveTo(cx, top); context.lineTo(left + width, cy); context.lineTo(cx, top + height); context.lineTo(left, cy); context.closePath(); }
      else if (shape.type === "triangle") { context.moveTo(cx, top); context.lineTo(left + width, top + height); context.lineTo(left, top + height); context.closePath(); }
      else if (shape.type === "flowchart") traceFlowchart(context, shape.flowchartShape ?? "process", shape.x, shape.y, shape.w, shape.h);
      else if (shape.edgeStyle === "rounded" || shape.edgeStyle === "pill") context.roundRect(left, top, width, height, shape.edgeStyle === "pill" ? Math.min(width, height) / 2 : Math.min(shape.cornerRadius ?? 14, width / 2, height / 2));
      else if (shape.edgeStyle === "cut") { const c=Math.min(shape.cornerRadius ?? 12,width/2,height/2);context.moveTo(left+c,top);context.lineTo(left+width-c,top);context.lineTo(left+width,top+c);context.lineTo(left+width,top+height-c);context.lineTo(left+width-c,top+height);context.lineTo(left+c,top+height);context.lineTo(left,top+height-c);context.lineTo(left,top+c);context.closePath(); }
      else context.rect(left, top, width, height);
      const inside = context.isPointInPath(local.x, local.y); context.restore(); if (inside) return index;
    }
    return undefined;
  }

  function updatePropertyForIndex(index: number, value: string) {
    const before = cloneElements(elements()); setElements((items) => items.map((element, current) => current === index && (element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "triangle" || element.type === "flowchart") ? { ...element, fillColor: value, fillOpacity: 1 } : element)); pushUndo(before); setDirty(true);
  }

  function eraseAtPoint(point: Point) {
    const hit = hitTest(point); if (hit === undefined) return;
    const before = cloneElements(elements()); setElements((items) => items.filter((_, index) => index !== hit)); setSelectedIndices((indices) => indices.filter((index) => index !== hit).map((index) => index > hit ? index - 1 : index)); pushUndo(before); setDirty(true);
  }

  function pointerCancel(event: PointerEvent) {
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
      if (handledTapAction) return;
    }
    setAttachmentHint(undefined);
    if (panOrigin) { panOrigin = undefined; setIsPanning(false); return; }
    if (marqueeOrigin) {
      const activeMarquee = marquee();
      if (activeMarquee && marqueeOrigin.moved) {
        const box = { x: Math.min(activeMarquee.start.x, activeMarquee.end.x), y: Math.min(activeMarquee.start.y, activeMarquee.end.y), w: Math.abs(activeMarquee.end.x - activeMarquee.start.x), h: Math.abs(activeMarquee.end.y - activeMarquee.start.y) };
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
          if (element.hidden || element.locked) return;
          const bounds = elementBounds(element);
          if (bounds.x >= box.x && bounds.y >= box.y && bounds.x + bounds.w <= box.x + box.w && bounds.y + bounds.h <= box.y + box.h) overlaps.push(index);
        });
        setSelectedIndices(marqueeOrigin.additive ? [...new Set([...selectedIndices(), ...overlaps])] : overlaps);
        setSidebarTab("properties");
      }
      marqueeOrigin = undefined; setMarquee(undefined); return;
    }
    if (resizeOrigin) { const origin = resizeOrigin; if (origin.moved) { setElements(elements()); pushUndo(origin.before); } resizeOrigin = undefined; return; }
    if (moveOrigin) {
      const origin = moveOrigin;
      if (origin.moved) {
        const selected = new Set(origin.indices);
        setElements(origin.before.map((element, index) => selected.has(index) ? moveElement(element, origin.dx, origin.dy) : element));
        pushUndo(origin.before);
      }
      moveOrigin = undefined; setAlignmentGuides(undefined); scheduleCanvasRender(); return;
    }
    if (!drawing) return;
    if (penEraserDrawing) { penEraserDrawing = false; drawing = false; return; }
    if (tool() === "eraser") { drawing = false; return; }
    if (activeDrawingTool === "pen") {
      if (event.pointerType === "pen") event.preventDefault();
      if (event.pointerType === "pen") appendPenSamples(event, false);
      const end = toWorld(event); const last = currentPoints[currentPoints.length - 1];
      if (last && Math.hypot(end.x - last.x, end.y - last.y) * canvasState().zoom >= .05) {
        currentPoints.push(tool() === "pen" ? { ...end, pressure: last.pressure, tiltX: last.tiltX, tiltY: last.tiltY } : end);
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
      currentPoints = []; setPreview(undefined); return;
    }
    if (activePreview) {
      const item: Element = activePreview.type === "pen"
        ? { type: "freehand", points: [...currentPoints], color: activePreview.color, thickness: activePreview.thickness, opacity: activePreview.opacity }
        : { type: activePreview.type, x: activePreview.start.x, y: activePreview.start.y, w: activePreview.end.x - activePreview.start.x, h: activePreview.end.y - activePreview.start.y, color: activePreview.color, thickness: activePreview.thickness, lineStyle: lineStyle(), edgeStyle: edgeStyle(), cornerRadius: cornerRadius(), flowchartShape: activePreview.type === "flowchart" ? activePreview.flowchartShape : undefined, lineRoute: activePreview.type === "line" ? activePreview.lineRoute : undefined, routePoints: activePreview.type === "line" && activePreview.lineRoute === "multi" ? [0.2, 0.4, 0.6, 0.8].map((ratio) => ({ x: activePreview.start.x + (activePreview.end.x - activePreview.start.x) * ratio, y: activePreview.start.y + (activePreview.end.y - activePreview.start.y) * ratio })) : undefined, arrowRoute: activePreview.type === "arrow" ? activePreview.arrowRoute : undefined, ...(fillEnabled() && (activePreview.type === "rectangle" || activePreview.type === "circle" || activePreview.type === "diamond" || activePreview.type === "triangle" || activePreview.type === "flowchart") ? { fillColor: fillColor(), fillOpacity: fillOpacity() } : {}), ...(activePreview.type === "line" ? { startHead: defaultLineStartHead(), endHead: defaultLineEndHead() } : {}), ...(activePreview.type === "arrow" ? { startHead: defaultStartHead(), endHead: defaultEndHead(), ...(activePreview.arrowRoute === "forked" ? { forkUpper: { endHead: defaultForkUpperHead() }, forkLower: { endHead: defaultForkLowerHead() } } : {}) } : {}) } as ShapeElement;
      const valid = activePreview.type === "pen" ? currentPoints.length > 0 : Math.hypot(activePreview.end.x - activePreview.start.x, activePreview.end.y - activePreview.start.y) > 1;
      if (isConnector(item)) {
        item.startBinding = nearestBinding(elements(), activePreview.start, 18 / canvasState().zoom)?.binding;
        item.endBinding = nearestBinding(elements(), activePreview.end, 18 / canvasState().zoom)?.binding;
        if (item.type === "arrow" && item.arrowRoute === "forked") {
          const fork = forkGeometry(item); const upper = nearestBinding(elements(), fork.upper, 18 / canvasState().zoom); const lower = nearestBinding(elements(), fork.lower, 18 / canvasState().zoom);
          if (upper) item.forkUpper = { ...(item.forkUpper ?? {}), end: upper.point, endBinding: upper.binding };
          if (lower) item.forkLower = { ...(item.forkLower ?? {}), end: lower.point, endBinding: lower.binding };
        }
      }
      if (valid) {
        const newIndex = elements().length;
        pushUndo(cloneElements(elements())); setElements((items) => [...items, item]); setDirty(true);
        if (isConnector(item)) { setSelectedIndices([newIndex]); setSidebarTab("properties"); }
      }
    }
    currentPoints = []; setPreview(undefined);
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
  const toolGroups: { id: string; label: string; tools: Tool[] }[] = readOnlyView() ? [
    { id: "laser", label: "Laser pointer", tools: ["laser"] },
  ] : isWindowsPlatform() ? [
    { id: "navigation", label: "Navigation", tools: ["select", "pan"] },
    { id: "drawing", label: "Drawing", tools: ["pen", "eraser"] },
    { id: "laser", label: "Laser", tools: ["laser"] },
    { id: "connectors", label: "Connectors", tools: ["line", "arrow"] },
    { id: "shapes", label: "Shapes", tools: ["rectangle", "circle", "diamond", "triangle", "flowchart"] },
    { id: "content", label: "Text and image tools", tools: ["text", "bucket", "crop"] },
  ] : [
    { id: "navigation", label: "Navigation", tools: ["select", "pan"] },
    { id: "drawing", label: "Drawing", tools: ["pen", "laser"] },
    { id: "connectors", label: "Connectors", tools: ["line", "arrow"] },
    { id: "shapes", label: "Shapes", tools: ["rectangle", "circle", "diamond", "triangle", "flowchart"] },
    { id: "content", label: "Text and image tools", tools: ["text", "bucket", "eraser", "crop"] },
  ];
  const mobileEssentialTools = new Set<Tool>(["select", "pan", "pen", "eraser", "laser"]);
  const swatches = ["#252525", "#e76b62", "#6b91c9", "#74a582", "#d8a448", "#a581bb", "#e5915b"];
  const helpShortcuts: [string, string][] = [["V", "Select tool"], ["Space", "Hold to pan"], ["P", "Fine pen"], ["Y", "Laser pointer"], ["R", "Rectangle"], ["C / O", "Circle"], ["D", "Diamond"], ["N", "Triangle"], ["L", "Line"], ["A", "Arrow"], ["F", "Flowchart symbol"], ["T", "Text"], ["B", "Fill bucket"], ["E", "Eraser"], ["X", "Image crop"], ["Esc", "Pan tool and clear selection"], ["G", "Toggle grid"], ["Shift+G", "Snap to grid"], ["Shift+O", "Snap to objects"], ["K", "Lock canvas"], ["0", "Center view at 100%"], ["1 / 2", "Fit drawing / selection"], ["Ctrl / Cmd + N", "New sketch"], ["Ctrl / Cmd + O", "Open sketch"], ["Ctrl / Cmd + S", "Save"], ["Ctrl / Cmd + Z", "Undo"], ["Ctrl / Cmd + Y", "Redo"], ["Ctrl / Cmd + C / X / V", "Copy / cut / paste"], ["Ctrl / Cmd + D", "Duplicate selection"], ["Ctrl / Cmd + A", "Select all"], ["Ctrl / Cmd + G", "Group selection"], ["Ctrl / Cmd + Shift + G", "Ungroup"], ["Delete / Backspace", "Delete selection"], ["Arrow keys", "Nudge by 1 px"], ["Shift+Arrow", "Nudge by 10 px"], ["F1", "Open Help"]];
  const updateTextDraft = (value: string) => setTextDraft((draft) => draft ? { ...draft, value } : undefined);
  function setSelectedNoteFontSize(size: number) {
    const bounded = Math.max(8, Math.min(32, Math.round(size)));
    if (noteEditor()) { setNoteEditor(draft => draft ? { ...draft, fontSize: bounded } : draft); return; }
    const index = primarySelection(); const previous = index === undefined ? undefined : elements()[index];
    if (previous?.type !== "group" || !previous.note || previous.locked || boardLocked()) return;
    const bounds = elementBounds(previous); const before = cloneElements(elements());
    const rebuilt = buildNoteGroup(bounds.x, bounds.y, previous.note.kind, previous.note.content, { width: previous.note.width ?? bounds.w, height: previous.note.height ?? bounds.h, fontSize: bounded, title: previous.note.title, collapsed: previous.note.collapsed });
    const replacement: Element = { ...rebuilt, ...previous, note: rebuilt.note, elements: rebuilt.elements.map((child, childIndex) => previous.elements[childIndex]?.id ? { ...child, id: previous.elements[childIndex].id } as Element : child) };
    setElements(items => items.map((item, current) => current === index ? replacement : item)); pushUndo(before); setDirty(true);
  }
  function updateSelectedNoteCard(patch: Partial<Pick<NonNullable<Extract<Element, { type: "group" }>['note']>, "title">>) {
    const index = primarySelection(); const previous = index === undefined ? undefined : elements()[index];
    if (previous?.type !== "group" || !previous.note || previous.locked || boardLocked()) return;
    const bounds = elementBounds(previous); const before = cloneElements(elements());
    const rebuilt = buildNoteGroup(bounds.x, bounds.y, previous.note.kind, previous.note.content, { width: previous.note.width ?? bounds.w, height: previous.note.height ?? bounds.h, fontSize: previous.note.fontSize, title: patch.title ?? previous.note.title, collapsed: previous.note.collapsed });
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
    const plain: TextElement = { type: "text", id: previous.id, x: bounds.x + 14, y: bounds.y + 58, text: previous.note.content, color: theme() === "dark" ? "#f4f4f2" : "#252525", fontSize: previous.note.fontSize ?? 14, fontFamily: "sans", textAlign: "left", listType: "none", rotation: previous.rotation, locked: previous.locked, hidden: previous.hidden };
    setElements(items => items.map((item, current) => current === index ? plain : item)); pushUndo(before); setSelectedIndices([index]); setTool("select"); setDirty(true);
  }
  const adjustQuickFont = (delta: number) => {
    if (noteEditor() || quickHasNoteCard()) { setSelectedNoteFontSize(quickCardFontSize() + delta); return; }
    const focused = focusedElement();
    if (focused?.type === "schemaTable") { updateProperty("fontSize", Math.max(8, Math.min(48, (focused.fontSize ?? 14) + delta))); return; }
    if (focused?.componentId?.startsWith("uml-class:") && resizeClassCardFont(focused.componentId, quickCardFontSize() + delta)) return;
    setTextFormat("fontSize", Math.max(8, Math.min(160, (selectedText()?.fontSize ?? defaultFontSize()) + delta)));
  };
  const setTextFormat = (property: "bold" | "italic" | "underline" | "textAlign" | "listType" | "fontSize" | "fontFamily", value: boolean | string | number) => {
    if (boardLocked() || focusedElement()?.locked) return;
    if (property === "fontSize" && (!Number.isFinite(Number(value)) || Number(value) < 8 || Number(value) > 160)) return;
    if (property === "fontSize") value = Math.round(Number(value));
    if (property === "fontSize" && (noteEditor() || quickHasNoteCard())) { setSelectedNoteFontSize(Number(value)); return; }
    if (property === "fontSize" && focusedElement()?.componentId?.startsWith("uml-class:")) { resizeClassCardFont(focusedElement()!.componentId!, Number(value)); return; }
    if (property === "fontSize" && focusedElement()?.type === "schemaTable") { updateProperty("fontSize", Math.max(8, Math.min(48, Number(value)))); return; }
    if (focusedElement() && isLabelShape(focusedElement()!)) updateLabel(property, value);
    else if (selectedText() && !textDraft()) updateProperty(property, value);
    else {
      if (property === "bold") setDefaultBold(Boolean(value)); else if (property === "italic") setDefaultItalic(Boolean(value)); else if (property === "underline") setDefaultUnderline(Boolean(value));
      else if (property === "textAlign") setDefaultTextAlign(value as "left" | "center" | "right"); else if (property === "listType") setDefaultListType(value as "none" | "bullet" | "number");
      else if (property === "fontSize") setDefaultFontSize(Number(value)); else if (property === "fontFamily") setDefaultFontFamily(value as FontFamily);
    }
    setTextDraft((draft) => draft ? { ...draft, [property]: value } : undefined);
  };
  const rotateSelection = (delta: number) => { if (boardLocked()) return; const index = primarySelection(); const item = index === undefined ? undefined : elements()[index]; if (!item || item.locked || item.type === "group" || isConnector(item)) return; const before = cloneElements(elements()); setElements((items) => items.map((element, i) => i === index ? { ...element, rotation: (element.rotation ?? 0) + delta } as Element : element)); pushUndo(before); setDirty(true); };
  const resetSelectionRotation = () => { const index = primarySelection(); const item = index === undefined ? undefined : elements()[index]; if (boardLocked() || !item || item.locked || item.type === "group" || (item.rotation ?? 0) === 0) return; const before = cloneElements(elements()); setElements((items) => items.map((element, i) => i === index ? { ...element, rotation: 0 } as Element : element)); pushUndo(before); setDirty(true); };
  const closeSystemMenu = (action: () => void) => { if (menu) menu.open = false; if (viewMenu) viewMenu.open = false; if (gestureMenu) gestureMenu.open = false; if (helpMenu) helpMenu.open = false; if (portraitMenu) portraitMenu.open = false; action(); };
  const openPortraitMenuPanel = (target: HTMLDetailsElement) => {
    if (portraitMenu) portraitMenu.open = false;
    document.querySelectorAll<HTMLDetailsElement>(".app-menus details[open]").forEach(details => { if (details !== target) details.open = false; });
    target.open = true;
  };
  const toggleSidebar = () => {
    setQuickStylePopover(undefined);
    if (styleMenuMode() === "quick") { setStyleMenuMode("full"); }
    else setStyleMenuMode("quick");
  };
  const showToolOptions = (value: Tool) => setOpenToolOptions(value);
  const closeToolOptions = () => setOpenToolOptions(undefined);
  const isCompactTouchLayout = () => window.matchMedia("(max-width: 900px), (max-width: 1600px) and (pointer: coarse)").matches;
  const alignTouchMenuPopover = (details?: HTMLDetailsElement) => {
    if (!details || !isCompactTouchLayout() || isWindowsPlatform()) return;
    requestAnimationFrame(() => {
      if (!details.isConnected || !details.open) return;
      const anchor = details.querySelector<HTMLElement>("summary");
      const panel = details.querySelector<HTMLElement>(".system-menu-popover");
      if (!anchor || !panel) return;
      const anchorRect = anchor.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const inset = Math.max(8, window.visualViewport?.offsetLeft ?? 0);
      const maxLeft = Math.max(inset, window.innerWidth - panelRect.width - 8);
      const left = Math.max(inset, Math.min(anchorRect.left, maxLeft));
      const maxTop = window.innerHeight - panelRect.height - Math.max(8, window.visualViewport?.offsetTop ?? 0);
      const below = anchorRect.bottom + 6;
      const top = below <= maxTop ? below : Math.max(8, anchorRect.top - panelRect.height - 6);
      panel.style.left = `${left}px`;
      panel.style.right = "auto";
      panel.style.top = `${top}px`;
      panel.style.transform = "none";
    });
  };
  const alignViewSettingsPopover = () => {
    requestAnimationFrame(() => {
      const panel = viewMenu?.querySelector<HTMLElement>(".view-settings-popover");
      if (!panel || !viewMenu?.open) return;
      if (isCompactTouchLayout()) { alignTouchMenuPopover(viewMenu); return; }
      const menuBounds = viewMenu.getBoundingClientRect();
      const panelWidth = panel.getBoundingClientRect().width;
      const targetLeft = Math.max(8, Math.min(menuBounds.left, window.innerWidth - panelWidth - 8));
      panel.style.left = `${(targetLeft - menuBounds.left) / interfaceScale()}px`;
      panel.style.right = "auto";
    });
  };
  const alignOpenTouchMenus = () => {
    if (!isCompactTouchLayout() || isWindowsPlatform()) return;
    [menu, viewMenu, gestureMenu, helpMenu, portraitMenu, appSettingsMenu].forEach(details => { if (details?.open) alignTouchMenuPopover(details); });
  };
  const toggleWindowsFullscreen = async (enabled = !windowsFullscreenMode()) => {
    if (!isWindowsPlatform() || !activePath() || enabled === windowsFullscreenMode()) return;
    if (enabled) {
      if (presentationMode()) await togglePresentationMode(false);
      commitTextDraft(); closeToolOptions(); setCanvasOptionsOpen(false); setLayerPanelOpen(false); setQuickStylePopover(undefined); setTouchStylePanel(false);
      setPaintBrushMenuOpen(false); setStencilMenuOpen(false); setCommandPaletteOpen(false); setShortcutDialogOpen(false);
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
      setPaintBrushMenuOpen(false);
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
  const openAdvancedProperties = () => { setMobileQuickPropertiesOpen(true); setStyleMenuMode("full"); };
  const renderToolbarTool = ({ value, label, key, path }: typeof tools[number]) => {
    const active = (value === "pen" ? tool() === "pen" && brushMode() === "fine" : tool() === value) || (value === "pan" && spaceDown());
    const hasOptions = value === "flowchart" || value === "line" || value === "arrow" || value === "text";
    const mobileEssential = mobileEssentialTools.has(value);
    const button = <button class={`tool-icon-button ${active ? "selected" : ""} ${mobileEssential ? "mobile-tool-essential" : ""} ${tool() === value ? "mobile-tool-current" : ""} ${hasOptions ? "has-options" : ""}`} title={`${label} (${key})${hasOptions ? " · click or hover for options" : ""}`} aria-label={label} aria-haspopup={hasOptions ? "menu" : undefined} aria-pressed={active} aria-expanded={hasOptions ? openToolOptions() === value : undefined} onFocus={() => { if (hasOptions && !isCompactTouchLayout()) showToolOptions(value); }} onClick={() => { if (hasOptions) { if (!isWindowsPlatform() && tool() === value) { activateTool(value); closeToolOptions(); return; } if (tool() !== value) activateTool(value); else { commitTextDraft(); setQuickStylePopover(undefined); } if (isCompactTouchLayout() && openToolOptions() === value) closeToolOptions(); else showToolOptions(value); return; } closeToolOptions(); activateTool(value); }}><svg viewBox="0 0 24 24" aria-hidden="true">{value === "flowchart" ? <><g class="desktop-flowchart-icon"><path d={path} /></g><g class="touch-flowchart-icon"><path d="M12 6.5v3M6 10h12M6 10v3m12-3v3"/><rect x="9" y="2.5" width="6" height="4" rx="1"/><rect x="3.5" y="13" width="5" height="6" rx="1"/><rect x="15.5" y="13" width="5" height="6" rx="1"/></g></> : <path d={path} />}</svg><kbd>{key}</kbd>{hasOptions && <svg class="tool-family-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3"/></svg>}</button>;
    if (value === "flowchart") return <div class="tool-family flowchart-family" classList={{ "options-open": openToolOptions() === value, "mobile-tool-essential-family": mobileEssential, "mobile-tool-current-family": tool() === value }} onPointerEnter={event => { if (event.pointerType === "mouse") showToolOptions(value); }} onPointerLeave={event => { if (event.pointerType === "mouse") closeToolOptions(); }} onFocusOut={(event) => { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) closeToolOptions(); }}>{button}<div class="tool-options flowchart-options" role="menu" aria-label="Flowchart symbols">{FLOWCHART_MENU_SHAPES.map((shape) => <button class={flowchartShape() === shape.value ? "active" : ""} role="menuitem" title={shape.label} aria-label={shape.label} onClick={() => { closeToolOptions(); setFlowchartShape(shape.value); setTool("flowchart"); setSidebarTab("properties"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d={shape.path} /></svg><span>{shape.label}</span></button>)}</div></div>;
    if (value === "text") return <div class="tool-family text-family" classList={{ "options-open": openToolOptions() === value, "mobile-tool-essential-family": mobileEssential, "mobile-tool-current-family": tool() === value }} onPointerEnter={event => { if (event.pointerType === "mouse") showToolOptions(value); }} onPointerLeave={event => { if (event.pointerType === "mouse") closeToolOptions(); }} onFocusOut={(event) => { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) closeToolOptions(); }}>{button}<div class="tool-options text-options" role="menu" aria-label="Text and note tools">
      <button role="menuitem" title="Place plain text" onClick={() => { closeToolOptions(); setTextMode("text"); setTool("text"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d="M4 6h16M12 6v13m-4 0h8"/></svg><span>Text</span></button>
      <button role="menuitem" title="Write an editable, collapsible Markdown card" onClick={() => { closeToolOptions(); setTextMode("markdown"); setTool("text"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d="M3 6h18M5 11h4l3 4 3-4h4M5 19h14"/><path d="m18 2 3 3-3 3"/></svg><span>Markdown text</span></button>
      <button role="menuitem" title="Insert an editable Markdown table card" onClick={() => { closeToolOptions(); setTextMode("table"); setTool("text"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M3 15h18M10 4v16M16 4v16"/></svg><span>Table</span></button>
      <button role="menuitem" title="Add a note; supports fenced, syntax-highlighted code blocks" onClick={() => { closeToolOptions(); setTextMode("note"); setTool("text"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d="M5 4h14v13l-4 3H5zM8 9h8M8 13h6"/></svg><span>Note + code</span></button>
      <button role="menuitem" title="Add a sticky note" onClick={() => { closeToolOptions(); setTextMode("sticky"); setTool("text"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d="M5 4h14v12l-5 5H5zM14 16v5m-6-12h8m-8 4h6"/></svg><span>Sticky note</span></button>
      <button role="menuitem" title="Add an interactive checklist" onClick={() => { closeToolOptions(); setTextMode("checklist"); setTool("text"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d="m4 6 2 2 3-4M12 6h8M4 14l2 2 3-4m3 2h8"/></svg><span>Checklist</span></button>
      <button role="menuitem" title="Generate editable canvas shapes from Mermaid flowchart code" onClick={() => openMermaidDialog()}><svg viewBox="0 0 24 24"><rect x="2.5" y="4" width="7" height="5" rx="1"/><path d="M9.5 6.5H14a3 3 0 0 1 3 3v.5m0 0-2-2m2 2 2-2M17 10v3.5a3 3 0 0 1-3 3H10m0 0 2-2m-2 2 2 2M10 16.5H6a3 3 0 0 1-3-3V12m0 0 2 2m-2-2-2 2"/><rect x="15" y="15" width="7" height="5" rx="1"/></svg><span>Diagram as code</span></button>
    </div></div>;
    if (value === "line") return <div class="tool-family route-family" classList={{ "options-open": openToolOptions() === value, "mobile-tool-essential-family": mobileEssential, "mobile-tool-current-family": tool() === value }} onPointerEnter={event => { if (event.pointerType === "mouse") showToolOptions(value); }} onPointerLeave={event => { if (event.pointerType === "mouse") closeToolOptions(); }} onFocusOut={(event) => { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) closeToolOptions(); }}>{button}<div class="tool-options route-options" role="menu" aria-label="Line routes">{LINE_ROUTES.map((route) => <button class={lineRoute() === route.value ? "active" : ""} role="menuitem" title={route.label} aria-label={route.label} onClick={() => { closeToolOptions(); setLineRoute(route.value); setTool("line"); setSidebarTab("properties"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d={route.path} /></svg><span>{route.label}</span></button>)}</div></div>;
    if (value === "arrow") return <div class="tool-family route-family" classList={{ "options-open": openToolOptions() === value, "mobile-tool-essential-family": mobileEssential, "mobile-tool-current-family": tool() === value }} onPointerEnter={event => { if (event.pointerType === "mouse") showToolOptions(value); }} onPointerLeave={event => { if (event.pointerType === "mouse") closeToolOptions(); }} onFocusOut={(event) => { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) closeToolOptions(); }}>{button}<div class="tool-options route-options" role="menu" aria-label="Arrow routes">{ARROW_ROUTES.map((route) => <button class={arrowRoute() === route.value ? "active" : ""} role="menuitem" title={route.label} aria-label={route.label} onClick={() => { closeToolOptions(); setArrowRoute(route.value); setTool("arrow"); setSidebarTab("properties"); setSelectedIndices([]); }}><svg viewBox="0 0 24 24"><path d={route.path} /></svg><span>{route.label}</span></button>)}</div></div>;
    return button;
  };
  const windowsCommands = createMemo<PaletteCommand[]>(() => {
    const commands: PaletteCommand[] = [
      { id: "new", label: "New sketch", category: "File", shortcut: shortcuts().newSketch, run: () => void createFile() },
      { id: "open", label: "Open sketch", category: "File", shortcut: shortcuts().openSketch, run: () => void openFile() },
      { id: "save", label: "Save sketch", category: "File", shortcut: shortcuts().saveSketch, run: () => activePath() ? void saveToPath(activePath()!) : void saveAs() },
      { id: "save-as", label: "Save sketch as", category: "File", shortcut: shortcuts().saveAs, run: () => void saveAs() },
      { id: "undo", label: "Undo", category: "Edit", shortcut: shortcuts().undo, run: undo },
      { id: "redo", label: "Redo", category: "Edit", shortcut: shortcuts().redo, run: redo },
      { id: "duplicate", label: "Duplicate selection", category: "Edit", shortcut: shortcuts().duplicate, run: () => insertCopies(selectedElements()) },
      { id: "group", label: "Group selection", category: "Edit", shortcut: shortcuts().group, run: groupSelection },
      { id: "ungroup", label: "Ungroup selection", category: "Edit", shortcut: shortcuts().ungroup, run: ungroupSelection },
      { id: "select-all", label: "Select all objects", category: "Edit", shortcut: shortcuts().selectAll, run: () => setSelectedIndices(elements().flatMap((item, index) => !item.hidden && !item.locked ? [index] : [])) },
      { id: "import-image", label: "Import image", category: "Import", keywords: "png jpeg webp gif", run: () => void importImage() },
      { id: "import-svg", label: "Import SVG", category: "Import", keywords: "vector", run: () => void importSvg() },
      { id: "import-schema", label: "Import SQL or JSON schema", category: "Import", keywords: "database tables", run: () => openSchemaDialog() },
      { id: "mermaid", label: "Create Mermaid diagram", category: "Create", keywords: "flowchart code", run: () => openMermaidDialog() },
      { id: "export-svg", label: "Export SVG", category: "Export", keywords: "vector", run: () => openExportOptions("svg") },
      { id: "export-pdf", label: "Print preview and export PDF", category: "Export", keywords: "page breaks margins", run: () => openExportOptions("pdf") },
      { id: "export-png", label: "Export PNG", category: "Export", run: () => openExportOptions("png") },
      { id: "toggle-grid", label: "Toggle canvas grid", category: "View", shortcut: shortcuts().toggleGrid, run: () => setShowGrid(value => !value) },
      { id: "toggle-rulers", label: "Toggle canvas rulers", category: "View", run: () => { const value = !showRulers(); setShowRulers(value); try { localStorage.setItem("sketchdraw-canvas-rulers", String(value)); } catch { /* Applied for this session. */ } } },
      { id: "toggle-minimap", label: "Toggle minimap", category: "View", run: () => { const value = !showMinimap(); setShowMinimap(value); try { localStorage.setItem("sketchdraw-canvas-minimap", String(value)); } catch { /* Applied for this session. */ } } },
      { id: "toggle-guides", label: "Toggle alignment guides", category: "View", run: () => { const value = !showAlignmentGuides(); setShowAlignmentGuides(value); try { localStorage.setItem("sketchdraw-canvas-guides", String(value)); } catch { /* Applied for this session. */ } } },
      { id: "fullscreen", label: "Toggle full screen focus mode", category: "View", run: () => void toggleWindowsFullscreen() },
      { id: "snap-grid", label: "Toggle grid snapping", category: "View", shortcut: shortcuts().snapGrid, run: () => setSnapToGrid(value => !value) },
      { id: "snap-objects", label: "Toggle object snapping and alignment guides", category: "View", shortcut: shortcuts().snapObjects, run: () => setSnapToObjects(value => !value) },
      { id: "add-page", label: "Add page to sketch", category: "Pages", run: addPage },
      { id: "lock-canvas", label: "Toggle canvas lock", category: "Canvas", shortcut: shortcuts().lockCanvas, run: () => setBoardLocked(value => !value) },
      { id: "presentation", label: "Start presentation mode", category: "View", shortcut: shortcuts().presentation, run: () => void togglePresentationMode(true) },
      { id: "shortcuts", label: "Customize keyboard shortcuts", category: "Settings", run: () => setShortcutDialogOpen(true) },
      { id: "copy-style", label: "Copy object style", category: "Edit", shortcut: shortcuts().copyStyle, run: copyObjectStyle },
      { id: "paste-style", label: "Paste object style", category: "Edit", shortcut: shortcuts().pasteStyle, run: pasteObjectStyle },
      { id: "align-left", label: "Align selection left", category: "Arrange", run: () => alignSelection("left") },
      { id: "align-center", label: "Align selection center", category: "Arrange", run: () => alignSelection("center") },
      { id: "align-right", label: "Align selection right", category: "Arrange", run: () => alignSelection("right") },
      { id: "align-top", label: "Align selection top", category: "Arrange", run: () => alignSelection("top") },
      { id: "align-middle", label: "Align selection middle", category: "Arrange", run: () => alignSelection("middle") },
      { id: "align-bottom", label: "Align selection bottom", category: "Arrange", run: () => alignSelection("bottom") },
      { id: "distribute-horizontal", label: "Distribute horizontal spacing", category: "Arrange", run: () => alignSelection("horizontal") },
      { id: "distribute-vertical", label: "Distribute vertical spacing", category: "Arrange", run: () => alignSelection("vertical") },
      ...EXTRA_FLOWCHART_SHAPES.map(shape => ({ id: `flow-shape-${shape.value}`, label: shape.label, category: "Flowchart stencils", run: () => { setFlowchartShape(shape.value); activateTool("flowchart"); } })),
      ...LIBRARY_COMPONENTS.map(component => ({ id: `component-${component.kind}`, label: component.label, category: component.section, keywords: "stencil component library", run: () => component.kind === "er-table" ? openSchemaDialog() : component.kind === "uml-class" ? (() => { const rect = canvas.getBoundingClientRect(); const view = canvasState(); const item = LIBRARY_COMPONENTS.find(entry => entry.kind === component.kind)!; openClassCardDialog((rect.width / 2 - view.panX) / view.zoom - item.width / 2, (rect.height / 2 - view.panY) / view.zoom - item.height / 2); })() : insertLibraryComponent(component.kind) })),
      ...tools.map(item => ({ id: `tool-${item.value}`, label: `${item.label} tool`, category: "Tools", shortcut: item.key, run: () => activateTool(item.value) })),
    ];
    const availableWithoutDocument = new Set(["new", "open", "shortcuts", "toggle-grid", "toggle-rulers", "toggle-minimap", "snap-grid", "snap-objects"]);
    return activePath() ? commands : commands.filter(command => availableWithoutDocument.has(command.id));
  });

  return (
    <main class="app-shell" classList={{ "theme-light": theme() === "light", "theme-dark": theme() === "dark", "mobile-tools-expanded": mobileToolsExpanded(), "mobile-orientation-portrait": mobileOrientation() === "portrait", "mobile-toolbar-top": !isWindowsPlatform() && toolbarPosition() === "top", "mobile-toolbar-bottom": !isWindowsPlatform() && toolbarPosition() === "bottom", "mobile-toolbar-left": !isWindowsPlatform() && toolbarPosition() === "left", "mobile-toolbar-right": !isWindowsPlatform() && toolbarPosition() === "right", "mobile-toolbar-horizontal": !isWindowsPlatform() && (toolbarPosition() === "top" || toolbarPosition() === "bottom"), "mobile-toolbar-vertical": !isWindowsPlatform() && (toolbarPosition() === "left" || toolbarPosition() === "right"), "reduce-motion": reduceMotion(), "home-screen-active": !activePath(), "canvas-options-active": canvasOptionsOpen(), "noncanvas-workspace-active": workspaceArea() !== "canvas", "touch-focus-mode": touchFocusMode(), "platform-windows": isWindowsPlatform(), "windows-presentation-mode": isWindowsPlatform() && presentationMode(), "presentation-mode": presentationMode(), "windows-fullscreen-mode": isWindowsPlatform() && windowsFullscreenMode(), "read-only-view": readOnlyView() }} onPointerDown={event => { const target = event.target as HTMLElement | null; if (stencilMenuOpen() && !target?.closest(".stencil-family")) setStencilMenuOpen(false); }} style={`--ui-accent: ${accentColor()}; --toolbar-surface: ${toolbarColor()}; --toolbar-ink: ${toolbarInk()}; --workspace-accent: ${accentColor()}; --workspace-surface: ${toolbarColor()}; --workspace-raised: ${toolbarColor()}; --workspace-ink: ${toolbarInk()}; --workspace-muted: color-mix(in srgb, ${toolbarInk()} 62%, transparent); --workspace-line: color-mix(in srgb, ${toolbarInk()} 15%, transparent); --app-ui-scale: ${interfaceScale()}; --app-topbar-height: ${topbarHeight()}px;`}>
      <header class="topbar" ref={element => { appTopbar = element; }}>
        <div class="header-leading"><div class="brand"><img class="brand-mark-image" src={sketchDrawMark} alt="" /><span title={activePath() ? fileName() : "SketchDraw"}>{activePath() ? fileName() : "SketchDraw"}</span></div><Show when={readOnlyView()}><span class="view-only-badge">VIEW ONLY</span></Show></div>
        <nav class="app-menus" aria-label="Application menus">
          <TouchMenuBar settings={<AppSettingsMenu
            themeMode={themeMode()}
            accentColor={accentColor()}
            toolbarColorChoice={toolbarColorChoice()}
            accentOptions={UI_ACCENTS}
            toolbarColorOptions={TOOLBAR_COLORS}
            interfaceScale={interfaceScale()}
            mobileOrientation={mobileOrientation()}
            toolbarPosition={toolbarPosition()}
            orientationMessage={orientationMessage()}
            showMobileLayoutSettings={isCompactTouchLayout()}
            autosaveSeconds={autosaveSeconds()}
            thicknessPickerMode={thicknessPickerMode()}
            buttonChoices={isWindowsPlatform() || isCompactTouchLayout()}
            androidAllFilesAccessAvailable={androidAllFilesAccessAvailable()}
            androidAllFilesAccessGranted={androidAllFilesAccessGranted()}
            showAndroidAllFilesAccess={isAndroidPlatform() && isCompactTouchLayout()}
            reduceMotion={reduceMotion()}
            displayMetrics={displayMetrics()}
            onInterfaceScaleChange={setInterfaceScalePreference}
            onMobileOrientationChange={setMobileOrientationPreference}
            onToolbarPositionChange={setToolbarPositionPreference}
            onThemeChange={setThemePreference}
            onAccentChange={setAccentPreference}
            onToolbarColorChange={setToolbarColorPreference}
            onAutosaveChange={setAutosavePreference}
            onThicknessPickerModeChange={setThicknessPickerPreference}
            onRequestAndroidAllFilesAccess={() => void requestAndroidAllFilesAccess()}
            onReduceMotionChange={setReduceMotionPreference}
            onRestoreDefaults={restoreAppSettings}
            detailsRef={element => { appSettingsMenu = element; }}
            onToggle={() => alignTouchMenuPopover(appSettingsMenu)}
          />}>
          <details class="menu-dropdown file-menu-dropdown" ref={menu} onToggle={() => alignTouchMenuPopover(menu)}><summary><svg class="touch-menu-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2zM3.5 10h18" /></svg><span>File</span><svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg></summary><div class="system-menu-popover"><div class="menu-file-label">{activePath() ? fileName() : "No file open"}</div>
            <button onClick={() => closeSystemMenu(() => void createFile())}>New sketch <kbd>Ctrl+N</kbd></button><button onClick={() => closeSystemMenu(() => void openFile())}>Open sketch <kbd>Ctrl+O</kbd></button><button onClick={() => closeSystemMenu(() => void openFileAsView())}>Open as view only</button><button disabled={!activePath() || readOnlyView()} onClick={() => closeSystemMenu(() => { if (activePath()) void saveToPath(activePath()!); })}>Save <kbd>Ctrl+S</kbd></button><button disabled={!activePath() || readOnlyView()} onClick={() => closeSystemMenu(() => { if (activePath()) void saveAs(); })}>Save as...</button><button disabled={!activePath() || readOnlyView()} onClick={() => closeSystemMenu(openRenameFileDialog)}>Rename sketch...</button><button disabled={!activePath() || workspaceArea() !== "canvas" || readOnlyView()} onClick={() => closeSystemMenu(() => { if (activePath()) void importImage(); })}>Import image...</button><button disabled={!activePath() || workspaceArea() !== "canvas" || readOnlyView()} onClick={() => closeSystemMenu(() => void importSvg())}>Import SVG...</button><div class="menu-separator" /><button disabled={!activePath() || workspaceArea() !== "canvas" || readOnlyView()} onClick={() => closeSystemMenu(() => { if (activePath()) openExportOptions("png"); })}>Export PNG...</button><button disabled={!activePath() || workspaceArea() !== "canvas" || readOnlyView()} onClick={() => closeSystemMenu(() => { if (activePath()) openExportOptions("pdf"); })}>Print preview / PDF...</button><button disabled={!activePath() || workspaceArea() !== "canvas" || readOnlyView()} onClick={() => closeSystemMenu(() => { if (activePath()) openExportOptions("svg"); })}>Export SVG...</button><button disabled={!activePath() || workspaceArea() !== "canvas" || !elements().length || boardLocked() || readOnlyView()} onClick={() => closeSystemMenu(() => setShowClearConfirm(true))}>Clear canvas</button><div class="menu-separator" /><button disabled={!activePath() || documentBusy()} onClick={() => closeSystemMenu(() => void closeFile())}>Close file</button>
          </div></details>
          <Show when={activePath() && workspaceArea() === "canvas"}>
            <details class="menu-dropdown view-menu-dropdown" ref={viewMenu} onToggle={() => alignViewSettingsPopover()}>
              <summary><svg class="touch-menu-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg><span>Canvas</span><svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg></summary>
              <div class="system-menu-popover view-popover view-settings-popover">
                <header class="view-menu-heading"><div><strong>Canvas settings</strong><span>Whiteboard appearance and canvas aids</span></div></header>
                <div class="view-panel-page active canvas-page">
                  <section class="view-menu-section board-view-section"><div class="view-section-heading"><span class="menu-section-title">Whiteboard color</span><span>{boardLocked() ? "Board locked" : "Canvas background"}</span></div><div class="board-color-palette"><button class={`board-color-choice ${boardColorFollowsTheme() ? "active" : ""}`} aria-pressed={boardColorFollowsTheme()} disabled={boardLocked()} onClick={() => { if (!boardLocked()) { setBoardColorFollowsTheme(true); setCanvasState({ ...canvasState(), boardColorFollowsTheme: true }); setDirty(true); } }}><i class="board-auto-dot" /><span>Auto</span></button>{BOARD_COLORS.map(value => <button class={`board-color-choice ${!boardColorFollowsTheme() && boardColor() === value ? "active" : ""}`} aria-pressed={!boardColorFollowsTheme() && boardColor() === value} disabled={boardLocked()} onClick={() => { if (!boardLocked()) { setBoardColor(value); setBoardColorFollowsTheme(false); setCanvasState({ ...canvasState(), backgroundColor: value, boardColorFollowsTheme: false }); setDirty(true); } }}><i style={{ background: value }} /><span>{BOARD_COLOR_NAMES[value] ?? value}</span></button>)}</div><div class="board-custom-choice"><span>Custom color</span><label class="custom-color-swatch" title="Custom whiteboard color"><input aria-label="Custom whiteboard color" type="color" value={renderedBoardColor()} disabled={boardLocked()} onInput={event => { if (!boardLocked()) { setBoardColor(event.currentTarget.value); setBoardColorFollowsTheme(false); setCanvasState({ ...canvasState(), backgroundColor: event.currentTarget.value, boardColorFollowsTheme: false }); setDirty(true); } }} /></label></div></section>
                  <section class="view-menu-section pattern-setting-section"><div class="view-section-heading"><span class="menu-section-title">Paper pattern</span><span>Choose a writing surface</span></div><div class="whiteboard-style-options">{([{ value: "plain", label: "Plain" }, { value: "dots", label: "Dots" }, { value: "small-dots", label: "Fine dots" }, { value: "lines", label: "Grid" }, { value: "small-grid", label: "Fine grid" }, { value: "ruled", label: "Ruled" }, { value: "isometric", label: "Isometric" }] as const).map(option => <button class={`whiteboard-style-choice ${whiteboardStyle() === option.value ? "active" : ""}`} aria-pressed={whiteboardStyle() === option.value} onClick={() => setWhiteboardStylePreference(option.value)}><i class={`paper-pattern-swatch ${option.value}`} /><span>{option.label}</span></button>)}</div></section>
                  <section class="view-menu-section component-setting-section"><div class="view-section-heading"><span class="menu-section-title">Component style</span><span>Canvas note and diagram cards</span></div><div class="component-style-options"><button class={componentAppearance() === "modern" ? "active" : ""} aria-pressed={componentAppearance() === "modern"} onClick={() => setComponentAppearancePreference("modern")}>Modern</button><button class={componentAppearance() === "simple" ? "active" : ""} aria-pressed={componentAppearance() === "simple"} onClick={() => setComponentAppearancePreference("simple")}>Simple</button></div></section>
                  <section class="view-menu-section canvas-display-section"><div class="view-section-heading"><span class="menu-section-title">Canvas aids</span><span>Show tools while working on the board</span></div><div class="component-style-options"><button class={showRulers() ? "active" : ""} aria-pressed={showRulers()} onClick={() => { const value = !showRulers(); setShowRulers(value); try { localStorage.setItem("sketchdraw-canvas-rulers", String(value)); } catch { /* Applied for this session. */ } }}>Rulers</button><button class={showAlignmentGuides() ? "active" : ""} aria-pressed={showAlignmentGuides()} onClick={() => { const value = !showAlignmentGuides(); setShowAlignmentGuides(value); try { localStorage.setItem("sketchdraw-canvas-guides", String(value)); } catch { /* Applied for this session. */ } }}>Alignment guides</button><button class={showMinimap() ? "active" : ""} aria-pressed={showMinimap()} onClick={() => { const value = !showMinimap(); setShowMinimap(value); try { localStorage.setItem("sketchdraw-canvas-minimap", String(value)); } catch { /* Applied for this session. */ } }}>Minimap</button></div></section>
                </div>
              </div>
            </details>
          </Show>
          <GestureSettings section={gestureMenuSection()} onSectionChange={section => setGestureMenuSection(section)} oneFingerTapAction={oneFingerTapAction()} twoFingerTapAction={twoFingerTapAction()} threeFingerTapAction={threeFingerTapAction()} oneFingerDragAction={oneFingerDragAction()} twoFingerGestureAction={twoFingerGestureAction()} threeFingerGestureAction={threeFingerGestureAction()} onTapChange={(fingers, action) => setTouchTapPreference(fingers, action)} onGestureChange={(fingers, action) => setTouchGesturePreference(fingers, action)} detailsRef={element => { gestureMenu = element; }} onToggle={() => alignTouchMenuPopover(gestureMenu)} />
          <details class="menu-dropdown help-menu" ref={helpMenu} onToggle={() => alignTouchMenuPopover(helpMenu)}><summary><svg class="touch-menu-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 1 1 4.2 1.6c-1.3 1.1-1.9 1.4-1.9 3M12 17.4v.1" /></svg><span>Help</span><svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg></summary><div class="system-menu-popover"><button onClick={() => closeSystemMenu(() => { setHelpSection("guide"); setHelpOpen(true); })}>Guide</button><button onClick={() => closeSystemMenu(() => { setHelpSection("shortcuts"); setHelpOpen(true); })}>Keyboard shortcuts <kbd>F1</kbd></button><Show when={isWindowsPlatform()}><button onClick={() => closeSystemMenu(() => setShortcutDialogOpen(true))}>Customize shortcuts...</button><button onClick={() => closeSystemMenu(() => setCommandPaletteOpen(true))}>Command palette <kbd>Ctrl+K</kbd></button></Show><div class="menu-separator" /><button disabled={updateCheck() === "checking"} onClick={() => void checkForUpdates()}>{updateCheck() === "checking" ? "Checking for updates..." : "Check for updates"}</button><Show when={updateCheck() === "current"}><span class="update-menu-status current">No newer release is available.</span></Show><Show when={updateCheck() === "available"}><span class="update-menu-status available">New version {updateVersion()} is available.</span></Show><Show when={updateCheck() === "error"}><span class="update-menu-status error">Could not check for a newer version.</span></Show></div></details>
          <details class="menu-dropdown portrait-menu-dropdown" ref={portraitMenu} onToggle={() => alignTouchMenuPopover(portraitMenu)}><summary aria-label="More menus"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg><span>Menu</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></summary><div class="system-menu-popover portrait-menu-list" role="menu" aria-label="Other menus"><Show when={activePath() && workspaceArea() === "canvas"}><button role="menuitem" onClick={() => openPortraitMenuPanel(viewMenu)}>Canvas settings</button></Show><button role="menuitem" onClick={() => openPortraitMenuPanel(gestureMenu)}>Touch gestures</button><button role="menuitem" onClick={() => openPortraitMenuPanel(helpMenu)}>Help and updates</button></div></details>
          </TouchMenuBar>
        </nav>
        <Show when={activePath()}><WorkspaceAreaTabs active={workspaceArea() === "chooser" ? "canvas" : workspaceArea() as "canvas" | "planning" | "library"} onSelect={navigateWorkspace} /></Show>
        <Show when={activePath() && workspaceArea() === "canvas"}><TouchPageMenu pages={pages()} activePageId={activePageId()} boardLocked={boardLocked() || readOnlyView()} onSelectPage={switchPage} onAddPage={addPage} onRenamePage={() => openPageDialog("rename")} onDuplicatePage={duplicatePage} onReorderPage={direction => reorderPage(direction)} onDeletePage={() => openPageDialog("delete")} /></Show>
        <Show when={isWindowsPlatform() && activePath() && openSketchPaths().length > 0}><Suspense fallback={null}><WindowsDocumentTabs paths={openSketchPaths()} activePath={activePath()} displayName={path => displayPathName(path)} onSelect={path => { if (path !== activePath()) void loadFile(path); }} onClose={path => void closeSketchTab(path)} /></Suspense></Show>

        <Show when={activePath()}><div class="top-actions"><span class="live-sync-indicator" title="Checks this open .sketch file for changes from another device every 1.6 seconds. Changes are merged after your cloud folder syncs."><i />Live file updates</span><span class={`save-status ${saving() ? "is-saving" : (dirty() || textDraft()) ? "is-dirty" : "is-saved"}`} role="status" aria-live="polite" aria-label={status()} title={status()}><i /><time>{savedAt() || "—"}</time></span></div></Show>
      </header>
      <For each={activePath() ? [activePath()!] : []}>{filePath => <>
        <div class="workspace-area-layer" classList={{ active: workspaceArea() === "chooser" }}><WorkspaceChooser fileName={displayPathName(filePath)} onSelect={navigateWorkspace} /></div>
        <div class="workspace-area-layer" classList={{ active: workspaceArea() === "planning" }}><ProjectWorkspace
          data={projectWorkspaceData()}
          editable={!readOnlyView()}
          onChange={data => { if (!readOnlyView()) { setProjectWorkspaceData(data); setDirty(true); } }}
          onNavigate={navigateWorkspace}
        /></div>
        <div class="workspace-area-layer" classList={{ active: workspaceArea() === "library" }}><PersonalLibrary
          data={personalLibraryData()}
          editable={!readOnlyView()}
          onChange={data => { if (!readOnlyView()) { setPersonalLibraryData(data); setDirty(true); } }}
        /></div>
      </>}</For>
      <Show when={activePath()} fallback={<><MobileHomeScreen recentFiles={recentFiles()} displayPathName={displayPathName} onCreate={createFile} onNewProject={createProjectFromHome} onOpen={openFile} onOpenRecent={loadFile} onOpenRecentProject={openRecentProject} /><section class="welcome-screen">
  <div class="welcome-card">
    <div class="welcome-intro">
      <div class="welcome-symbol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" /></svg></div>
      <p class="eyebrow">YOUR IDEAS, ON ONE CANVAS</p>
      <h1>Think it through.<br /><em>Draw it out.</em></h1>
      <p class="welcome-copy">A calm, capable space for diagrams, plans, and the ideas in between. Start a sketch or pick up where you left off.</p>
      <div class="welcome-actions"><button class="save-button large" onClick={createFile}>Create a sketch <span aria-hidden="true">&rarr;</span></button><button class="quiet-button large" onClick={openFile}>Open a file</button></div>
      <div class="file-hint"><span class="file-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h5" /></svg></span><span><strong>Private by design</strong><br />Your portable .sketch files stay in folders you choose.</span></div>
      <small class="copyright-notice">&copy; 2026 Toushal Sampat. All rights reserved.</small>
    </div>
    <div class="welcome-visual" aria-hidden="true">
      <div class="welcome-visual-topline"><span><i></i> SKETCHDRAW CANVAS</span><b>FLOW 01</b></div>
      <svg viewBox="0 0 440 350" role="presentation">
        <defs><filter id="welcome-card-shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="7" stdDeviation="8" flood-color="#3b493f" flood-opacity=".12" /></filter></defs>
        <path class="welcome-wire" d="M116 111h53m62 0h46m-77 25v52m93-52v52m-93 0h-90m90 0h94m-184 0v32m184-32v32" />
        <path class="welcome-wire-arrow" d="m163 106 7 5-7 5m47 65 5 7 5-7m87-65 7 5-7 5m-200 63-5 7 5 7m99 15 5 7 5-7m85-29 5 7 5-7" />
        <g filter="url(#welcome-card-shadow)"><rect class="welcome-node welcome-node-lilac" x="26" y="78" width="90" height="66" rx="16" /><rect class="welcome-node welcome-node-sun" x="169" y="78" width="92" height="66" rx="16" /><rect class="welcome-node welcome-node-mint" x="277" y="78" width="104" height="66" rx="16" /><rect class="welcome-node welcome-node-paper" x="26" y="198" width="100" height="64" rx="16" /><rect class="welcome-node welcome-node-blue" x="169" y="198" width="92" height="64" rx="16" /><rect class="welcome-node welcome-node-paper" x="277" y="198" width="104" height="64" rx="16" /></g>
        <g class="welcome-node-icon"><circle cx="48" cy="101" r="7" /><path d="M62 99h38M62 106h27" /><circle cx="191" cy="101" r="7" /><path d="M205 99h40M205 106h28" /><circle cx="299" cy="101" r="7" /><path d="M313 99h52M313 106h35" /><circle cx="48" cy="220" r="7" /><path d="M62 218h42M62 225h30" /><circle cx="191" cy="220" r="7" /><path d="M205 218h40M205 225h28" /><circle cx="299" cy="220" r="7" /><path d="M313 218h52M313 225h35" /></g>
        <circle class="welcome-spark" cx="365" cy="53" r="13" /><path class="welcome-spark-line" d="M365 45v16m-8-8h16m-13-5 10 10m0-10-10 10" />
        <circle class="welcome-dot" cx="80" cy="290" r="4" /><circle class="welcome-dot" cx="96" cy="290" r="4" /><circle class="welcome-dot" cx="112" cy="290" r="4" />
      </svg>
      <div class="welcome-visual-caption"><span>&#10022;</span> A little clarity, one connection at a time.</div>
    </div>
  </div>
  <div class="recent-dashboard">
    <div class="recent-heading"><span class="eyebrow">YOUR WORKSPACE</span><div class="recent-heading-row"><h2>Recent sketches</h2><span class="recent-count">{recentFiles().length}</span></div><p>Pick up right where you left off.</p></div>
    <section class="home-project-hub" aria-labelledby="home-project-title">
      <span class="home-project-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7.5h6l2 2h8v9H4zM4 10h16M8 13h3m-3 2.5h7" /></svg></span>
      <div class="home-project-copy">
        <span class="eyebrow">PROJECT SPACE</span>
        <h2 id="home-project-title">A home for each project</h2>
        <p>Keep notes, tasks, schedules, decisions, and reference files beside the sketch.</p>
      </div>
      <div class="home-project-actions">
        <button class="save-button" onClick={() => void createProjectFromHome()}>New project <span aria-hidden="true">&rarr;</span></button>
        <Show when={recentFiles().length > 0}><button class="quiet-button" onClick={() => void openRecentProject(recentFiles()[0])}>Open recent <span aria-hidden="true">&rarr;</span></button></Show>
      </div>
    </section>
    <Show when={recentFiles().length > 0} fallback={<div class="recent-empty"><div class="recent-empty-icon"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h5" /></svg></div><strong>Your next idea starts here</strong><span>Open a sketch from your device to see it in this list.</span><button class="quiet-button" onClick={openFile}>Browse sketches <span aria-hidden="true">&rarr;</span></button></div>}>
      <div class="recent-list">{recentFiles().map((path) => <button class="recent-file" onClick={() => void loadFile(path)}><span class="recent-file-icon"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h5" /></svg></span><span class="recent-file-name">{displayPathName(path)}</span><span class="recent-file-path">{path}</span><span class="recent-open">Open <span aria-hidden="true">&rarr;</span></span></button>)}</div>
    </Show>
    <div class="recent-footnote"><span class="recent-footnote-dot"></span> Saved on this device</div>
  </div>
</section></>}>
        <>
          <section class="canvas-wrap" ref={canvasWrap} classList={{ "canvas-rulers-visible": showRulers(), "canvas-minimap-visible": showMinimap() }}>
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
              isFlowchart={quickElementType() === "flowchart"}
              color={selectedColor()}
              width={selectedThickness()}
              brushMode={brushMode()}
              supportsFill={quickHasShapeFill()}
              fillEnabled={fillEnabled() || !!selectedFillColor()}
              fillColor={selectedFillColor() ?? fillColor()}
              fillOpacity={(focusedElement() as ShapeElement | undefined)?.fillOpacity ?? fillOpacity()}
              supportsLineStyle={quickHasShapeFill() || quickIsConnector()}
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
              cornerRadius={quickShapeSelection()?.type === "rectangle" ? quickShapeSelection()?.cornerRadius ?? 14 : cornerRadius()}
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
              onClose={() => setTouchStylePanel(false)}
              onColorChange={value => { if (selectedLabel() && !textDraft()) updateLabel("color", value); else updateStrokeColor(value); }}
              onWidthChange={updateThickness}
              onBrushModeChange={mode => { setBrushMode(mode); setTool("pen"); }}
              onFillEnabledChange={enabled => { setFillEnabled(enabled); if (hasStyleSelection()) updateProperty("fillColor", enabled ? fillColor() : undefined); }}
              onFillColorChange={value => { setFillColor(value); setFillEnabled(true); if (hasStyleSelection()) updateProperty("fillColor", value); }}
              onFillOpacityChange={value => { setFillOpacity(value); if (selectedIndices().length) updateProperty("fillOpacity", value); }}
              onLineStyleChange={value => focusedElement() ? updateProperty("lineStyle", value) : setLineStyle(value)}
              onLineRouteChange={value => focusedElement()?.type === "line" ? updateProperty("lineRoute", value) : setLineRoute(value)}
              onArrowRouteChange={value => focusedElement()?.type === "arrow" ? updateProperty("arrowRoute", value) : setArrowRoute(value)}
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
            <Show when={noteEditor()}>{draft => <div class={`canvas-note-editor ${draft().kind} ${componentAppearance()}`} role="group" aria-label={`${draft().kind} canvas editor`} style={{ left: `${canvasState().panX + draft().x * canvasState().zoom}px`, top: `${canvasState().panY + draft().y * canvasState().zoom}px`, width: `${Math.max(220, draft().width * canvasState().zoom)}px`, height: `${Math.max(130, draft().height * canvasState().zoom)}px`, background: noteCardPalette(draft().kind, theme(), componentAppearance()).surface, "border-color": noteCardPalette(draft().kind, theme(), componentAppearance()).border, color: noteCardPalette(draft().kind, theme(), componentAppearance()).ink }} onPointerDown={event => { const rect = event.currentTarget.getBoundingClientRect(); resizingNoteEditor = event.clientX >= rect.right - 22 && event.clientY >= rect.bottom - 22; event.stopPropagation(); }} onPointerUp={event => { if (resizingNoteEditor) { const rect = event.currentTarget.getBoundingClientRect(); const zoom = canvasState().zoom; setNoteEditor(current => current ? { ...current, width: Math.max(180, Math.min(4000, rect.width / zoom)), height: Math.max(100, Math.min(1_000_000, rect.height / zoom)), resized: true } : current); } resizingNoteEditor = false; }}>
              <header><span>{draft().kind === "sticky" ? "STICKY NOTE" : draft().kind === "checklist" ? "CHECKLIST" : draft().title.toLowerCase().includes("markdown") ? "MARKDOWN" : "NOTE + CODE"}</span><small class="editor-key-hint">Tab indents</small><Show when={draft().kind === "note"}><button type="button" class="editor-insert-table" onClick={insertMarkdownTable} title="Insert an editable Markdown table">Insert table</button></Show><button type="button" onClick={saveNoteEditor} title="Save to canvas" aria-label="Save note to canvas">Done &#10003;</button></header>
              <div class="note-card-details"><label>Title<input aria-label="Card title" maxlength="120" value={draft().title} onInput={event => setNoteEditor(current => current ? { ...current, title: event.currentTarget.value } : undefined)} /></label></div>
              <textarea ref={element => { noteEditorTextarea = element; }} class="canvas-note-input" aria-label={draft().kind === "checklist" ? "Checklist items" : draft().kind === "sticky" ? "Sticky note text" : "Markdown and note content"} maxlength="50000" value={draft().content} placeholder={draft().kind === "checklist" ? "- [ ] Plan the next step" : "Write Markdown…\n\nUse # headings, **bold**, lists, tables, and fenced code blocks such as ```ts"} onInput={event => setNoteEditor(current => current ? { ...current, content: event.currentTarget.value } : undefined)} onBlur={event => { if (!(event.relatedTarget instanceof HTMLElement && event.relatedTarget.closest(".canvas-note-editor"))) saveNoteEditor(); }} onKeyDown={event => { event.stopPropagation(); if (event.key === "Tab") { indentTextarea(event, value => setNoteEditor(current => current ? { ...current, content: value } : current)); return; } if ((event.key === "Enter" && (event.ctrlKey || event.metaKey)) || event.key === "Escape") { event.preventDefault(); saveNoteEditor(); if (event.key === "Escape" && isWindowsPlatform()) { setTool("select"); setStyleMenuMode("quick"); } } }} />
            </div>}</Show>
            <canvas ref={canvas} class="drawing-canvas" style={{ cursor: isPanning() ? "grabbing" : spaceDown() || tool() === "pan" ? "grab" : boardLocked() && !readOnlyView() ? "not-allowed" : noteToggleHovered() ? "pointer" : tool() === "select" ? hoveredIndex() !== undefined ? "move" : "default" : tool() === "text" ? "text" : tool() === "eraser" ? "cell" : tool() === "bucket" ? "copy" : tool() === "crop" ? "crosshair" : "crosshair" }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel} onLostPointerCapture={pointerLostCapture} onClick={() => { if (!textEditorFocusOnCanvasClick) return; textEditorFocusOnCanvasClick = false; if (textEditorFocusTimer !== undefined) { window.clearTimeout(textEditorFocusTimer); textEditorFocusTimer = undefined; } focusTextEditor(); }} onPointerLeave={() => { if (!moveOrigin && !resizeOrigin) setHoveredIndex(undefined); setNoteToggleHovered(false); }} onDblClick={handleCanvasDoubleClick} onContextMenu={onContextMenu} /><button class="canvas-zoom-reset" title="Center view and reset zoom to 100% (0)" aria-label={`Center view and reset zoom, currently ${Math.round(canvasState().zoom * 100)} percent`} onClick={resetZoomAndCenter}><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M10.5 7v7m-3.5-3.5h7"/></svg><kbd>{Math.round(canvasState().zoom * 100)}%</kbd></button>
            <Show when={showRulers()}><Suspense fallback={null}><CanvasRulers width={canvasWrap.clientWidth} height={canvasWrap.clientHeight} zoom={canvasState().zoom} panX={canvasState().panX} panY={canvasState().panY} /></Suspense></Show>
            <Show when={showMinimap()}><Suspense fallback={null}><CanvasMinimap elements={elements()} zoom={canvasState().zoom} panX={canvasState().panX} panY={canvasState().panY} viewportWidth={canvas.clientWidth} viewportHeight={canvas.clientHeight} onNavigate={center => setCanvasState(current => ({ ...current, panX: canvas.clientWidth / 2 - center.x * current.zoom, panY: canvas.clientHeight / 2 - center.y * current.zoom }))} onClose={() => { setShowMinimap(false); try { localStorage.setItem("sketchdraw-canvas-minimap", "false"); } catch { /* The current view still updates. */ } }} /></Suspense></Show>
            <Show when={presentationMode()}><div class="canvas-presentation-controls"><button title="Previous page" aria-label="Previous page" disabled={pages().findIndex(page => page.id === activePageId()) <= 0} onClick={() => changePresentationPage(-1)}>‹</button><span>{currentPage()?.name ?? "Sketch"}</span><button title="Next page" aria-label="Next page" disabled={pages().findIndex(page => page.id === activePageId()) >= pages().length - 1} onClick={() => changePresentationPage(1)}>›</button><button title="Exit presentation mode" onClick={() => void togglePresentationMode(false)}>Exit</button></div></Show>
            <Show when={deletableSelectionCount() > 1}><button class="selection-delete-action" disabled={boardLocked()} title={`Delete ${deletableSelectionCount()} selected elements`} aria-label={`Delete ${deletableSelectionCount()} selected elements`} onClick={deleteSelected}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6"/></svg><span>Delete {deletableSelectionCount()}</span></button></Show>
            <DesktopPageTabs pages={pages()} activePageId={activePageId()} boardLocked={boardLocked() || readOnlyView()} onSelectPage={switchPage} onAddPage={addPage} onRenamePage={() => openPageDialog("rename")} onDuplicatePage={duplicatePage} onReorderPage={direction => reorderPage(direction)} onDeletePage={() => openPageDialog("delete")} />
            <TouchToolBar open={toolBarOpen()} expanded={mobileToolsExpanded()} styleOpen={touchStylePanel()} quickStyles={<Show when={!isWindowsPlatform() && isCompactTouchLayout()}><TouchQuickStyleControls
              orientation={toolbarPosition() === "top" || toolbarPosition() === "bottom" ? "portrait" : "landscape"}
              showColor={showStrokeControls() || tool() === "bucket" || tool() === "laser"}
              color={tool() === "laser" ? laserColor() : tool() === "bucket" ? fillColor() : selectedColor()}
              colorLabel={tool() === "laser" ? "Laser color" : tool() === "bucket" ? "Bucket fill color" : tool() === "text" ? "Text color" : "Stroke color"}
              colors={["#202124", "#e45454", "#ddb43c", "#5eaa72", "#3d91bd"]}
              showWidth={showThicknessControls() || tool() === "laser"}
              width={tool() === "laser" ? laserThickness() : selectedThickness()}
              widthLabel={tool() === "laser" ? "Laser thickness" : tool() === "eraser" ? "Eraser size" : "Stroke width"}
              previewColor={tool() === "laser" ? laserColor() : selectedColor()}
              widthMode={tool() === "laser" ? "slider" : isPenBrushThicknessTarget() && thicknessPickerMode() === "stepper" ? "fine" : "presets"}
              presets={(isPenBrushThicknessTarget() ? THICKNESS_PRESETS : ORIGINAL_INSPECTOR_THICKNESS_PRESETS).map(([value, label]) => ({ value, label }))}
              disabled={tool() !== "laser" && (boardLocked() || !!focusedElement()?.locked)}
              onColorChange={value => { if (tool() === "laser") { setLaserPreference("rainbow", "false"); setLaserPreference("color", value); } else if (tool() === "bucket") setFillColor(value); else if (selectedLabel() && !textDraft()) updateLabel("color", value); else updateStrokeColor(value); }}
              onWidthChange={value => { if (tool() === "laser") setLaserPreference("thickness", String(value)); else updateThickness(value); }}
            /></Show>} onShow={() => setToolBarOpen(true)} onHide={() => setToolBarOpen(false)} onToggleExpanded={() => setMobileToolsExpanded(value => !value)} onToggleStyle={toggleTouchStylePanel}><>
              <div class="tool-cluster tool-cluster-canvas mobile-cluster-has-essential" role="group" aria-label="Canvas view">
              <CanvasOptionsMenu
                open={canvasOptionsOpen()}
                showGrid={showGrid()}
                snapToGrid={snapToGrid()}
                snapToObjects={snapToObjects()}
                hasElements={elements().length > 0}
                hasSelection={selectedIndices().length > 0}
                canGroup={groupActionEnabled()}
                grouped={groupSelected()}
                boardLocked={boardLocked()}
                onToggle={() => setCanvasOptionsOpen(value => !value)}
                onCloseOtherTools={closeToolOptions}
                onFitDrawing={() => { setCanvasOptionsOpen(false); fitDocumentToViewport(elements()); }}
                onFitSelection={() => { setCanvasOptionsOpen(false); fitDocumentToViewport(selectedElements()); }}
                onToggleGrid={() => setShowGrid(value => !value)}
                onToggleSnapToGrid={() => setSnapToGrid(value => !value)}
                onToggleSnapToObjects={() => setSnapToObjects(value => !value)}
                onGroupSelection={() => { groupSelection(); setCanvasOptionsOpen(false); }}
                canvasTools={{
                  showRulers: showRulers(),
                  showAlignmentGuides: showAlignmentGuides(),
                  showMinimap: showMinimap(),
                  presentation: presentationMode(),
                  onTogglePresentation: () => void togglePresentationMode(),
                  ...(isWindowsPlatform() ? { fullscreen: windowsFullscreenMode(), onToggleFullscreen: () => void toggleWindowsFullscreen() } : {}),
                  onToggleRulers: () => { const value = !showRulers(); setShowRulers(value); try { localStorage.setItem("sketchdraw-canvas-rulers", String(value)); } catch { /* Current session still uses this setting. */ } },
                  onToggleAlignmentGuides: () => { const value = !showAlignmentGuides(); setShowAlignmentGuides(value); try { localStorage.setItem("sketchdraw-canvas-guides", String(value)); } catch { /* Current session still uses this setting. */ } },
                  onToggleMinimap: () => { const value = !showMinimap(); setShowMinimap(value); try { localStorage.setItem("sketchdraw-canvas-minimap", String(value)); } catch { /* Current session still uses this setting. */ } },
                }}
              />
              <button class="tool-icon-button mobile-tool-essential touch-focus-entry" aria-label={isWindowsPlatform() && windowsFullscreenMode() ? "Exit full screen focus mode" : "Enter full screen focus mode"} title={isWindowsPlatform() && windowsFullscreenMode() ? "Exit full screen focus mode" : "Full screen focus mode"} onClick={() => isWindowsPlatform() ? void toggleWindowsFullscreen() : void toggleTouchFocusMode(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/></svg></button>
              </div>
              {toolGroups.map((group) => <div class={`tool-cluster tool-cluster-${group.id}`} classList={{ "mobile-cluster-has-essential": group.tools.some(value => mobileEssentialTools.has(value)), "mobile-cluster-has-current": group.tools.includes(tool()) }} role="group" aria-label={group.label}>{tools.filter((item) => group.tools.includes(item.value)).map(renderToolbarTool)}</div>)}
              <div class="tool-family tool-extra-family paint-brush-family" classList={{ "options-open": paintBrushMenuOpen(), "mobile-tool-current": tool() === "pen" && brushMode() !== "fine" }}><button class={`tool-icon-button has-options ${tool() === "pen" && brushMode() !== "fine" ? "selected" : ""}`} title="Paint brushes" aria-label="Paint brushes" aria-haspopup="menu" aria-expanded={paintBrushMenuOpen()} onClick={() => setPaintBrushMenuOpen(value => !value)}><svg viewBox="0 0 24 24"><path d="m14 4 6 6M5 18c2-2 4-1 6-3l7-7-6-6-7 7c-2 2-1 4-3 6-.7.7-.4 2.4 1 3 1.2.5 2 .1 2-.4Z"/></svg><kbd>BR</kbd><svg class="tool-family-caret" viewBox="0 0 12 12"><path d="m2.5 4.5 3.5 3 3.5-3"/></svg></button><div class="tool-options paint-brush-options" role="menu" aria-label="Paint brush tools">{([ ["pencil", "Pencil"], ["brush", "Soft brush"], ["marker", "Marker"], ["highlighter", "Highlighter"], ["chalk", "Chalk"] ] as const).map(([mode, label]) => <button class={brushMode() === mode ? "active" : ""} role="menuitem" onClick={() => { setBrushMode(mode); setTool("pen"); setSelectedIndices([]); setPaintBrushMenuOpen(false); }}><svg viewBox="0 0 24 24"><path d={mode === "pencil" ? "m5 19 11-11 3 3L8 22H5zm10-13 2-2 4 4-2 2" : mode === "brush" ? "M5 18c4 0 3-8 8-8 4 0 4 4 7 4m-15 4h14M15 5l3 3" : mode === "marker" ? "M5 18 17 6l3 3L8 21H5zm9-9 3 3" : mode === "highlighter" ? "M4 16 15 5l5 5-11 11H4zm4-2 5 5" : "M5 18 17 6m-8 12 2 2M4 21h16"}/></svg><span>{label}</span></button>)}</div></div>
              <div class="tool-family tool-extra-family stencil-family" classList={{ "options-open": stencilMenuOpen() }} onFocusOut={event => { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) setStencilMenuOpen(false); }}>
                <button class="tool-icon-button has-options" title="Symbols and modeling components" aria-label="Symbols and modeling components" aria-haspopup="menu" aria-expanded={stencilMenuOpen()} onClick={() => setStencilMenuOpen(value => !value)}><svg viewBox="0 0 24 24"><path d="M3 5h7v7H3zM14 4l7 4-4 7-7-4zM4 16h7v5H4zM15 17h6v4h-6z"/></svg><kbd>LIB</kbd><svg class="tool-family-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3"/></svg></button>
                <div class="tool-options stencil-options" role="menu" aria-label="Symbols and diagram components">
                  <strong class="tool-options-heading">Symbols &amp; elements</strong>
                  {EXTRA_FLOWCHART_SHAPES.map(shape => <button type="button" role="menuitem" title={shape.label} onClick={() => { setFlowchartShape(shape.value); setTool("flowchart"); setSelectedIndices([]); setSidebarTab("properties"); setStencilMenuOpen(false); }}><svg viewBox="0 0 24 24"><path d={FLOWCHART_SHAPES.find(item => item.value === shape.value)?.path ?? "M4 4h16v16H4z"}/></svg><span>{shape.label}</span></button>)}
                  {[...new Set(LIBRARY_COMPONENTS.map(component => component.section))].map(section => <><strong class="tool-options-heading stencil-heading">{section}</strong>{LIBRARY_COMPONENTS.filter(component => component.section === section).map(component => <button type="button" class="stencil-template" role="menuitem" title={component.description} onClick={() => component.kind === "er-table" ? openSchemaDialog(undefined, "CREATE TABLE table_name (\n  id INTEGER PRIMARY KEY,\n  name TEXT\n);") : component.kind === "uml-class" ? (() => { const item = LIBRARY_COMPONENTS.find(entry => entry.kind === component.kind)!; const rect = canvas!.getBoundingClientRect(); const view = canvasState(); openClassCardDialog((rect.width / 2 - view.panX) / view.zoom - item.width / 2, (rect.height / 2 - view.panY) / view.zoom - item.height / 2); })() : insertLibraryComponent(component.kind)}>{libraryIcon(component.kind)}<span>{component.label}</span></button>)}</>)}
                  <strong class="tool-options-heading stencil-heading">Database schema</strong>
                  <button type="button" class="stencil-template" role="menuitem" title="Paste SQL or JSON schema to create linked table cards" onClick={() => openSchemaDialog()}><svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/><path d="M7 15h4m-4 5h4" stroke-width="2"/></svg><span>Visualize schema</span></button>
                </div>
              </div>              <div class="tool-cluster tool-cluster-history mobile-cluster-has-essential" role="group" aria-label="History, selection, and canvas state">
                <button class={layerPanelOpen() ? "tool-icon-button canvas-utility-button mobile-tool-extra selected" : "tool-icon-button canvas-utility-button mobile-tool-extra"} title="Layers" aria-label="Open layers panel" aria-pressed={layerPanelOpen()} onClick={() => setLayerPanelOpen(value => !value)}><svg viewBox="0 0 24 24"><path d="m4 7 8-4 8 4-8 4-8-4Zm0 5 8 4 8-4M4 17l8 4 8-4"/></svg></button>
                <Show when={deletableSelectionCount() > 0}><button class="tool-icon-button mobile-tool-essential touch-selection-delete" disabled={boardLocked()} title={`Erase ${deletableSelectionCount()} selected element${deletableSelectionCount() === 1 ? "" : "s"}`} aria-label={`Erase ${deletableSelectionCount()} selected element${deletableSelectionCount() === 1 ? "" : "s"}`} onClick={deleteSelected}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6" /></svg><small class="touch-selection-count">{deletableSelectionCount()}</small></button></Show>
                <button class="tool-icon-button canvas-utility-button mobile-tool-essential" disabled={!canUndo() || boardLocked()} title="Undo (Ctrl+Z)" aria-label="Undo" onClick={undo}><svg viewBox="0 0 24 24"><path d="M9 7 4 12l5 5M5 12h8a6 6 0 0 1 6 6"/></svg><kbd>Ctrl+Z</kbd></button>
                <button class="tool-icon-button canvas-utility-button mobile-tool-essential" disabled={!canRedo() || boardLocked()} title="Redo (Ctrl+Y)" aria-label="Redo" onClick={redo}><svg viewBox="0 0 24 24"><path d="m15 7 5 5-5 5m4-5h-8a6 6 0 0 0-6 6"/></svg><kbd>Ctrl+Y</kbd></button>
                <button class={`tool-icon-button canvas-utility-button mobile-tool-extra ${boardLocked() ? "selected" : ""}`} title={`Canvas ${boardLocked() ? "locked" : "unlocked"} (K)`} aria-label={boardLocked() ? "Unlock canvas" : "Lock canvas"} aria-pressed={boardLocked()} onClick={() => setBoardLocked(value => !value)}><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d={boardLocked() ? "M8 10V7a4 4 0 1 1 8 0v3" : "M8 10V7a4 4 0 0 1 8 0"}/></svg><kbd>K</kbd></button>
              </div>
            </></TouchToolBar>
            <Show when={layerPanelOpen()}>
              <aside class="floating-layer-panel" aria-label="Canvas layers">
                <header class="layer-panel-heading">
                  <div><strong>Layers</strong><p>One layer per tool. Objects stay together.</p></div>
                  <span class="layer-count-badge" aria-label={`${toolLayers().length} tool layers`}>{toolLayers().length}</span>
                  <button class="pane-close-icon" aria-label="Close layers" title="Close layers" onClick={() => setLayerPanelOpen(false)}>&times;</button>
                </header>
                <div class="layer-list" aria-label="Tool layers">
                  <For each={toolLayers()}>{(layer, rowIndex) => {
                    const count = () => layer.indices.length;
                    const selected = () => layer.indices.some(index => selectedSet().has(index));
                    return <article class="layer-row" classList={{ selected: selected(), hidden: layer.hidden, locked: layer.locked }}>
                      <button class="layer-name" type="button" title={`Select all ${count()} ${layer.label.toLowerCase()} objects`} onClick={() => setSelectedIndices(layer.indices)}>
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
              </aside>
            </Show>
            <Show when={sidebarVisible() && (isWindowsPlatform() || !isCompactTouchLayout())}><aside class="style-pane" classList={{ "quick-style-mode": styleMenuMode() === "quick", "full-style-mode": styleMenuMode() === "full", "mobile-properties-collapsed": !mobileQuickPropertiesOpen(), "mobile-properties-expanded": mobileQuickPropertiesOpen() }} aria-label="Properties">
              <div class="quick-style-panel">
                <div class="quick-style-heading"><button onClick={toggleQuickProperties} title={isCompactTouchLayout() && !isWindowsPlatform() ? mobileQuickPropertiesOpen() ? "Close quick properties" : "Open quick properties" : styleMenuMode() === "full" ? "Close properties" : "Open properties"} aria-label={isCompactTouchLayout() && !isWindowsPlatform() ? mobileQuickPropertiesOpen() ? "Close quick properties" : "Open quick properties" : styleMenuMode() === "full" ? "Close properties" : "Open properties"} aria-expanded={isCompactTouchLayout() && !isWindowsPlatform() ? mobileQuickPropertiesOpen() : styleMenuMode() === "full"}><QuickPropertiesIcon /></button><Show when={!isWindowsPlatform()}><button class="mobile-advanced-properties" aria-expanded={styleMenuMode() === "full"} onClick={openAdvancedProperties} title="Open advanced properties" aria-label="Open advanced properties"><AdvancedPropertiesIcon /></button></Show></div>
                <Show when={sidebarTab() === "properties"}>
                  <div class="quick-style-controls">
                    <Show when={tool() === "bucket"}>
                      <button class="quick-style-icon" onClick={() => setQuickStylePopover(quickStylePopover() === "fill" ? undefined : "fill")} aria-label="Bucket fill color" title="Fill color" aria-expanded={quickStylePopover() === "fill"}><i class="quick-color-mark" style={{ background: fillColor() }} /></button>
                    </Show>
                    <Show when={tool() !== "bucket" && showStrokeControls()}>
                      <button class="quick-style-icon" onClick={() => setQuickStylePopover(quickStylePopover() === "color" ? undefined : "color")} aria-label={quickElementType() === "text" ? "Text color" : "Stroke color"} title={quickElementType() === "text" ? "Text color" : "Stroke color"} aria-expanded={quickStylePopover() === "color"}><i class="quick-color-mark" style={{ background: themeInk(selectedColor(), theme()) }} /></button>
                    </Show>
                    <Show when={tool() !== "bucket" && showThicknessControls()}>
                      <button class="quick-style-icon quick-width-icon" onClick={() => setQuickStylePopover(quickStylePopover() === "thickness" ? undefined : "thickness")} aria-label={tool() === "eraser" ? "Eraser size" : "Stroke width"} title={tool() === "eraser" ? "Eraser size" : `Stroke width ${selectedThickness()}px`} aria-expanded={quickStylePopover() === "thickness"}><i style={{ height: `${Math.max(1, selectedThickness())}px`, background: themeInk(selectedColor(), theme()) }} /><small>{selectedThickness()}</small></button>
                    </Show>
                    <Show when={tool() === "pen"}><button class={`quick-style-icon ${quickStylePopover() === "penInput" ? "active" : ""}`} onClick={() => setQuickStylePopover(quickStylePopover() === "penInput" ? undefined : "penInput")} aria-label="Stylus input options" title="Stylus pressure, tilt, and eraser" aria-expanded={quickStylePopover() === "penInput"}><svg viewBox="0 0 24 24"><path d="m5 19 3.5-.8L19 7.7 16.3 5 5.8 15.5 5 19Zm9.8-12 2.7 2.7M4 22h16"/></svg></button></Show>
                    <Show when={tool() === "laser"}><button class={`quick-style-icon ${quickStylePopover() === "laser" ? "active" : ""}`} onClick={() => setQuickStylePopover(quickStylePopover() === "laser" ? undefined : "laser")} aria-label="Laser pointer settings" title="Laser pointer settings" aria-expanded={quickStylePopover() === "laser"}><svg viewBox="0 0 24 24"><path d="M4 20 16 8m-5-1 6 6M15 3v2m6 4h-2M20 3l-1 1M8 3l1 1M4 9H2"/><circle cx="17" cy="7" r="2"/></svg></button></Show>
                    <Show when={quickHasShapeFill()}>
                      <button class={`quick-style-icon ${fillEnabled() || !!selectedFillColor() ? "active" : ""}`} onClick={() => setQuickStylePopover(quickStylePopover() === "fill" ? undefined : "fill")} aria-label="Shape fill" title="Shape fill" aria-expanded={quickStylePopover() === "fill"}><svg class="quick-fill-preview-icon" viewBox="0 0 24 24"><path d="M4 4h16v16H4z" style={{ fill: selectedFillColor() ?? (fillEnabled() ? fillColor() : "#ffffff") }} /><path d="M4 4h16v16H4z" /></svg></button>
                    </Show>
                    <Show when={quickIsConnector()}>
                      <button class="quick-style-icon" onClick={() => setQuickStylePopover(quickStylePopover() === "lineStyle" ? undefined : "lineStyle")} aria-label="Line style" title="Line style" aria-expanded={quickStylePopover() === "lineStyle"}><svg viewBox="0 0 24 24" class={`line-preview ${quickCurrentLineStyle()}`}><path d="M3 12h18" /></svg></button>
                      <button class="quick-style-icon" onClick={() => setQuickStylePopover(quickStylePopover() === "route" ? undefined : "route")} aria-label="Connector route" title="Connector route" aria-expanded={quickStylePopover() === "route"}><svg viewBox="0 0 24 24"><path d={(quickRouteChoices().find(route => route.value === quickCurrentRoute()) ?? quickRouteChoices()[0]).path} /></svg></button>
                    </Show>
                    <Show when={quickIsConnector()}>
                      <button class="quick-style-icon" onClick={() => setQuickStylePopover(quickStylePopover() === "heads" ? undefined : "heads")} aria-label="Connector arrowheads" title="Connector arrowheads" aria-expanded={quickStylePopover() === "heads"}><ArrowHeadIcon kind={quickArrowHead("end")} /></button>
                    </Show>
                    <Show when={quickHasText() || quickHasNoteCard()}>
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
                          <div class="quick-thickness-presets">{THICKNESS_PRESETS.map(([value, label]) => <button class={selectedThickness() === value ? "active" : ""} aria-label={`${label} ${value} pixels`} title={`${label}, ${value}px`} onClick={() => { updateThickness(value); setQuickStylePopover(undefined); }}><i style={{ height: `${value}px` }} /></button>)}</div>
                          <input aria-label="Custom size" type="range" min="1" max="20" step="1" value={selectedThickness()} onInput={event => updateThickness(Number(event.currentTarget.value))} />
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
                      <div class="quick-style-popover quick-line-styles">{(["solid", "dashed", "dotted", "double"] as const).map(value => <button class={quickCurrentLineStyle() === value ? "active" : ""} aria-label={`${value} line`} title={`${value} line`} onClick={() => { if (quickFocusedHasLineStyle()) updateProperty("lineStyle", value); else setLineStyle(value); setQuickStylePopover(undefined); }}><svg viewBox="0 0 24 24" class={`line-preview ${value}`}><path d={value === "double" ? "M3 9h18M3 15h18" : "M3 12h18"} /></svg></button>)}</div>
                    </Show>
                    <Show when={quickStylePopover() === "route"}>
                      <div class="quick-style-popover quick-routes">{quickRouteChoices().map(route => <button class={quickCurrentRoute() === route.value ? "active" : ""} aria-label={route.label} title={route.label} onClick={() => { if (quickElementType() === "arrow") { if (styleTargetElement()?.type === "arrow") updateProperty("arrowRoute", route.value); else setArrowRoute(route.value as ArrowRoute); } else { if (styleTargetElement()?.type === "line") updateProperty("lineRoute", route.value); else setLineRoute(route.value as LineRoute); } setQuickStylePopover(undefined); }}><svg viewBox="0 0 24 24"><path d={route.path} /></svg></button>)}</div>
                    </Show>
                    <Show when={quickStylePopover() === "heads" && quickIsConnector()}>
                      <div class="quick-style-popover quick-arrow-heads" aria-label="Connector arrowhead styles">{(["start", "end"] as const).map(end => <div><span>{end}</span><div>{ARROW_HEADS.map(({ value, label }) => <button class={quickArrowHead(end) === value ? "active" : ""} title={`${label} ${end} head`} aria-label={`${label} ${end} arrowhead`} onClick={() => setConnectorHead(end, value)}><ArrowHeadIcon kind={value} /></button>)}</div></div>)}</div>
                    </Show>
                  </div>
                </Show>
              </div>
              <div class="full-inspector">
              <div class="full-style-heading"><strong>Properties</strong><button onClick={() => { setStyleMenuMode("quick"); setQuickStylePopover(undefined); }}>Quick style</button></div>

              <Show when={sidebarTab() === "properties"}>
                <Show when={selectedNoteCard()}>{card => <section class="pane-section note-card-properties"><div class="pane-heading">{card().note?.kind === "sticky" ? "Sticky note" : card().note?.kind === "checklist" ? "Checklist" : card().note?.title?.toLowerCase().includes("markdown") ? "Markdown" : "Note + code"}<button class="note-collapse-action" disabled={boardLocked() || card().locked} onClick={() => { const index = primarySelection(); if (index !== undefined) toggleNoteCollapsed(index); }}>{card().note?.collapsed ? "Expand" : "Collapse"}</button></div><label class="property-label">Title<input aria-label="Card title" maxlength="120" value={card().note?.title ?? defaultNoteTitle(card().note!.kind)} onChange={event => updateSelectedNoteCard({ title: event.currentTarget.value })} /></label><Show when={card().note?.kind === "note"}><button class="quiet-button" disabled={boardLocked() || card().locked} onClick={convertSelectedMarkdownToText}>Convert to plain text</button></Show><p class="bucket-help">Double-click to edit Markdown and notes. Resize to change the layout; text size stays fixed.</p></section>}</Show>
                <Show when={focusedElement()?.type === "text"}><section class="pane-section"><div class="pane-heading">Text</div><button class="quiet-button" disabled={boardLocked() || focusedElement()?.locked} onClick={convertSelectedTextToMarkdown}>Convert to Markdown card</button><p class="bucket-help">The text remains editable in a collapsible Markdown card.</p></section></Show>
      <Show when={focusedElement()?.type === "schemaTable"}><section class="pane-section"><div class="pane-heading">Table schema</div><label class="property-label">Font size<input type="number" min="8" max="48" step="1" value={(focusedElement() as SchemaTableElement | undefined)?.fontSize ?? 14} onChange={event => updateProperty("fontSize", Math.round(Number(event.currentTarget.value)))} /></label><p class="bucket-help">The table grows to keep every row legible.</p></section></Show>
                <Show when={showStrokeControls()}><section class="pane-section"><div class="pane-heading">{tool() === "text" || focusedElement()?.type === "text" ? "Text color" : "Stroke color"}</div><div class="swatch-list stroke-swatches">{swatches.map((swatch) => <button class={`color-swatch ${selectedColor() === swatch ? "active" : ""}`} style={{ background: swatch }} aria-label={`Set color ${swatch}`} title={swatch} onClick={() => updateStrokeColor(swatch)} />)}<label class="custom-color-swatch stroke-custom-swatch" title="Custom stroke color"><input aria-label="Custom stroke color" type="color" value={selectedColor()} onInput={(event) => updateStrokeColor(event.currentTarget.value)} /></label></div></section></Show>
                    <Show when={showThicknessControls()}>
                    <section class="pane-section">
                      <div class="pane-heading">Stroke width <span>{selectedThickness()} px</span></div>
                      <Show when={isPenBrushThicknessTarget()} fallback={<>
                        <div class="preset-list">{ORIGINAL_INSPECTOR_THICKNESS_PRESETS.map(([value, label]) => <button class={`preset-button ${selectedThickness() === value ? "active" : ""}`} onClick={() => updateThickness(value)} title={`${label}, ${value}px`}><span class="stroke-indicator" style={{ height: `${Math.max(1, value)}px` }} /><small>{label}</small><small>{value}px</small></button>)}</div>
                        <button class="advanced-toggle" aria-expanded={showAdvancedThickness()} onClick={() => setShowAdvancedThickness(visible => !visible)}>Custom width <span>{showAdvancedThickness() ? "−" : "+"}</span></button>
                        <Show when={showAdvancedThickness()}><input class="pane-slider" aria-label="Custom stroke thickness" type="range" min="1" max="24" value={selectedThickness()} onInput={event => updateThickness(Number(event.currentTarget.value))} /></Show>
                      </>}>
                        <Show when={thicknessPickerMode() === "presets"}>
                          <div class="preset-list">{THICKNESS_PRESETS.map(([value, label]) => <button class={`preset-button ${selectedThickness() === value ? "active" : ""}`} onClick={() => updateThickness(value)} title={`${label}, ${value}px`}><span class="stroke-indicator" style={{ height: `${Math.max(1, value)}px` }} /><small>{label}</small><small>{value}px</small></button>)}</div>
                        </Show>
                        <Show when={thicknessPickerMode() === "stepper"}>
                          <ThicknessTuner value={selectedThickness()} color={themeInk(selectedColor(), theme())} sliderClassName="pane-slider" onChange={updateThickness} />
                        </Show>
                      </Show>
                    </section>
                  </Show>
                <Show when={tool() === "text" || selectedText() || focusedElement() && isLabelShape(focusedElement()!)}><section class="pane-section"><div class="pane-heading">Text formatting</div><div class="format-row"><button class={(selectedText()?.bold ?? defaultBold()) ? "active" : ""} aria-label="Bold" title="Bold" onClick={() => setTextFormat("bold", !(selectedText()?.bold ?? defaultBold()))}><b>B</b></button><button class={(selectedText()?.italic ?? defaultItalic()) ? "active" : ""} aria-label="Italic" title="Italic" onClick={() => setTextFormat("italic", !(selectedText()?.italic ?? defaultItalic()))}><i>I</i></button><button class={(selectedText()?.underline ?? defaultUnderline()) ? "active" : ""} aria-label="Underline" title="Underline" onClick={() => setTextFormat("underline", !(selectedText()?.underline ?? defaultUnderline()))}><u>U</u></button></div><label class="property-label">Font size<input type="number" min="8" max="160" step="1" value={selectedText()?.fontSize ?? defaultFontSize()} onInput={(event) => setTextFormat("fontSize", Math.round(Number(event.currentTarget.value)))} /></label><div class="property-label">Font family<div class="choice-deck"><button class={(selectedText()?.fontFamily ?? defaultFontFamily()) === "sans" ? "active" : ""} title="Modern sans-serif" aria-label="Modern sans-serif font" onClick={() => setTextFormat("fontFamily", "sans")}><span class="font-sans-icon">Aa</span><small>Sans</small></button><button class={(selectedText()?.fontFamily ?? defaultFontFamily()) === "hand" ? "active" : ""} title="Handwritten" aria-label="Handwritten font" onClick={() => setTextFormat("fontFamily", "hand")}><span class="font-hand-icon">Aa</span><small>Hand</small></button><button class={(selectedText()?.fontFamily ?? defaultFontFamily()) === "serif" ? "active" : ""} title="Serif" aria-label="Serif font" onClick={() => setTextFormat("fontFamily", "serif")}><span style={{ "font-family": "Georgia,serif" }}>Aa</span><small>Serif</small></button><button class={(selectedText()?.fontFamily ?? defaultFontFamily()) === "mono" ? "active" : ""} title="Monospaced" aria-label="Monospaced font" onClick={() => setTextFormat("fontFamily", "mono")}><span style={{ "font-family": "monospace" }}>Aa</span><small>Mono</small></button></div></div><div class="property-label">Alignment<div class="choice-deck compact"><button class={(selectedText()?.textAlign ?? defaultTextAlign()) === "left" ? "active" : ""} title="Align left" aria-label="Align left" onClick={() => setTextFormat("textAlign", "left")}><svg viewBox="0 0 24 24"><path d="M4 5h16M4 10h11M4 15h16M4 20h11"/></svg></button><button class={(selectedText()?.textAlign ?? defaultTextAlign()) === "center" ? "active" : ""} title="Align center" aria-label="Align center" onClick={() => setTextFormat("textAlign", "center")}><svg viewBox="0 0 24 24"><path d="M4 5h16M7 10h10M4 15h16M7 20h10"/></svg></button><button class={(selectedText()?.textAlign ?? defaultTextAlign()) === "right" ? "active" : ""} title="Align right" aria-label="Align right" onClick={() => setTextFormat("textAlign", "right")}><svg viewBox="0 0 24 24"><path d="M4 5h16M9 10h11M4 15h16M9 20h11"/></svg></button></div></div><div class="property-label">Paragraphs<div class="choice-deck compact"><button class={(selectedText()?.listType ?? defaultListType()) === "none" ? "active" : ""} title="Plain paragraphs" aria-label="Plain paragraphs" onClick={() => setTextFormat("listType", "none")}><svg viewBox="0 0 24 24"><path d="M5 6h15M5 12h15M5 18h15"/></svg></button><button class={(selectedText()?.listType ?? defaultListType()) === "bullet" ? "active" : ""} title="Bulleted list" aria-label="Bulleted list" onClick={() => setTextFormat("listType", "bullet")}><svg viewBox="0 0 24 24"><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/><path d="M9 6h11M9 12h11M9 18h11"/></svg></button><button class={(selectedText()?.listType ?? defaultListType()) === "number" ? "active" : ""} title="Numbered list" aria-label="Numbered list" onClick={() => setTextFormat("listType", "number")}><svg viewBox="0 0 24 24"><path d="M4 5h2v3M4 8h3M4 12h3l-3 3h3M10 6h10M10 12h10M10 18h10"/></svg></button></div></div></section></Show>
                <Show when={focusedElement() && isLabelShape(focusedElement()!)}><section class="pane-section"><div class="pane-heading">Shape label</div>
                  <button class="quiet-button" disabled={boardLocked() || focusedElement()?.locked} onClick={() => { const index = primarySelection(); if (index !== undefined) editShapeLabel(index); }}>Edit label</button>
                  <label class="property-label">Font color<input type="color" value={textDraft()?.shapeLabel ? textDraft()!.color : selectedLabel()?.color ?? color()} onInput={event => updateLabel("color", event.currentTarget.value)} /></label>
                  <div class="property-label">Vertical alignment<div class="choice-deck">{(["top", "middle", "bottom"] as const).map((alignment, index) => <button title={`Align ${alignment}`} aria-label={`Align ${alignment}`} class={(textDraft()?.verticalAlign ?? selectedLabel()?.verticalAlign ?? "middle") === alignment ? "active" : ""} onClick={() => updateLabel("verticalAlign", alignment)}><svg viewBox="0 0 24 24"><path d={`M3 ${index === 0 ? 4 : index === 1 ? 12 : 20}h18M8 ${6 + index * 2}v6m8-6v6`}/></svg><small>{alignment}</small></button>)}</div></div>
                  <button class={`quiet-button ${selectedText()?.textAlign === "justify" ? "active" : ""}`} onClick={() => setTextFormat("textAlign", "justify")}>Justify text</button><p class="bucket-help">Double-click a shape to edit its label. Text wraps inside the shape.</p>
                </section></Show>
                <Show when={tool() === "line" || tool() === "arrow" || tool() === "rectangle" || tool() === "circle" || tool() === "diamond" || tool() === "triangle" || tool() === "flowchart" || ["line", "arrow", "rectangle", "circle", "diamond", "triangle", "flowchart"].includes(focusedElement()?.type ?? "")}><section class="pane-section"><div class="pane-heading">Line style</div><div class="choice-deck line-choices"><button class={((focusedElement() as ShapeElement | undefined)?.lineStyle ?? lineStyle()) === "solid" ? "active" : ""} title="Solid line" aria-label="Solid line" onClick={() => focusedElement() ? updateProperty("lineStyle", "solid") : setLineStyle("solid")}><svg viewBox="0 0 24 24"><path d="M3 12h18"/></svg><small>Solid</small></button><button class={((focusedElement() as ShapeElement | undefined)?.lineStyle ?? lineStyle()) === "dashed" ? "active" : ""} title="Dashed line" aria-label="Dashed line" onClick={() => focusedElement() ? updateProperty("lineStyle", "dashed") : setLineStyle("dashed")}><svg viewBox="0 0 24 24" class="dash-icon"><path d="M3 12h18"/></svg><small>Dash</small></button><button class={((focusedElement() as ShapeElement | undefined)?.lineStyle ?? lineStyle()) === "dotted" ? "active" : ""} title="Dotted line" aria-label="Dotted line" onClick={() => focusedElement() ? updateProperty("lineStyle", "dotted") : setLineStyle("dotted")}><svg viewBox="0 0 24 24" class="dot-icon"><path d="M3 12h18"/></svg><small>Dot</small></button><Show when={tool() === "line" || tool() === "arrow" || focusedElement()?.type === "line" || focusedElement()?.type === "arrow"}><button class={((focusedElement() as ShapeElement | undefined)?.lineStyle ?? lineStyle()) === "double" ? "active" : ""} title="Double line" aria-label="Double line" onClick={() => focusedElement() ? updateProperty("lineStyle", "double") : setLineStyle("double")}><svg viewBox="0 0 24 24"><path d="M3 9h18M3 15h18"/></svg><small>Double</small></button></Show></div><Show when={focusedElement()?.type === "rectangle" || tool() === "rectangle"}><div class="property-label">Corners<div class="choice-deck compact"><button class={((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "sharp" ? "active" : ""} title="Square corners" aria-label="Square corners" onClick={() => focusedElement() ? updateProperty("edgeStyle", "sharp") : setEdgeStyle("sharp")}><svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14"/></svg></button><button class={((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "rounded" ? "active" : ""} title="Rounded corners" aria-label="Rounded corners" onClick={() => focusedElement() ? updateProperty("edgeStyle", "rounded") : setEdgeStyle("rounded")}><svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="4"/></svg></button><button class={((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "pill" ? "active" : ""} title="Pill corners" aria-label="Pill corners" onClick={() => focusedElement() ? updateProperty("edgeStyle", "pill") : setEdgeStyle("pill")}><svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="8" rx="4"/></svg></button><button class={((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "cut" ? "active" : ""} title="Cut corners" aria-label="Cut corners" onClick={() => focusedElement() ? updateProperty("edgeStyle", "cut") : setEdgeStyle("cut")}><svg viewBox="0 0 24 24"><path d="m8 4h8l4 4v8l-4 4H8l-4-4V8z"/></svg></button></div></div></Show><Show when={tool() === "rectangle" || focusedElement()?.type === "rectangle"}><Show when={((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "rounded" || ((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "cut"}><label class="property-label">{((focusedElement() as ShapeElement | undefined)?.edgeStyle ?? edgeStyle()) === "cut" ? "Corner cut" : "Corner radius"}<input type="range" min="0" max="64" value={focusedElement()?.type === "rectangle" ? (focusedElement() as ShapeElement).cornerRadius ?? 14 : cornerRadius()} onInput={event => { const radius = Number(event.currentTarget.value); setCornerRadius(radius); if (focusedElement()?.type === "rectangle") updateProperty("cornerRadius", radius); }} /><span>{focusedElement()?.type === "rectangle" ? (focusedElement() as ShapeElement).cornerRadius ?? 14 : cornerRadius()} px</span></label></Show></Show><Show when={tool() === "arrow" || tool() === "line" || focusedElement()?.type === "arrow" || focusedElement()?.type === "line"}><div class="arrow-head-config"><span>Start head</span><div class="choice-deck arrow-head-choices">{ARROW_HEADS.map(({ value, label }) => <button class={quickArrowHead("start") === value ? "active" : ""} title={`${label} start`} aria-label={`${label} start head`} onClick={() => setConnectorHead("start", value)}><ArrowHeadIcon kind={value} /></button>)}</div><span>End head</span><div class="choice-deck arrow-head-choices">{ARROW_HEADS.map(({ value, label }) => <button class={quickArrowHead("end") === value ? "active" : ""} title={`${label} end`} aria-label={`${label} end head`} onClick={() => setConnectorHead("end", value)}><ArrowHeadIcon kind={value} /></button>)}</div></div></Show></section></Show>
                <Show when={focusedElement() && isConnector(focusedElement()!)}><section class="pane-section"><div class="pane-heading">Connector routing</div><label class="auto-route-toggle"><input type="checkbox" checked={!!(focusedElement() as ShapeElement).autoRoute} disabled={boardLocked() || !!focusedElement()?.locked} onChange={event => setSelectedAutoRoute(event.currentTarget.checked)} /><span><strong>Route around shapes</strong><small>Drag a bend to add or move a waypoint.</small></span></label></section></Show>
                <Show when={(tool() === "arrow" || focusedElement()?.type === "arrow") && (focusedElement()?.type === "arrow" ? (focusedElement() as ShapeElement).arrowRoute : arrowRoute()) === "forked"}><section class="pane-section"><div class="pane-heading">Fork branch heads</div><div class="fork-head-config"><span>Upper branch</span><div class="choice-deck arrow-head-choices">{ARROW_HEADS.map(({ value, label }) => <button class={((focusedElement()?.type === "arrow" ? (focusedElement() as ShapeElement).forkUpper?.endHead : undefined) ?? defaultForkUpperHead()) === value ? "active" : ""} title={`${label} upper branch head`} aria-label={`${label} upper branch head`} onClick={() => focusedElement()?.type === "arrow" ? updateProperty("forkUpperHead", value) : setDefaultForkUpperHead(value)}><ArrowHeadIcon kind={value} /></button>)}</div><span>Lower branch</span><div class="choice-deck arrow-head-choices">{ARROW_HEADS.map(({ value, label }) => <button class={((focusedElement()?.type === "arrow" ? (focusedElement() as ShapeElement).forkLower?.endHead : undefined) ?? defaultForkLowerHead()) === value ? "active" : ""} title={`${label} lower branch head`} aria-label={`${label} lower branch head`} onClick={() => focusedElement()?.type === "arrow" ? updateProperty("forkLowerHead", value) : setDefaultForkLowerHead(value)}><ArrowHeadIcon kind={value} /></button>)}</div></div><p class="bucket-help">Each branch has a separate endpoint handle. Drag either endpoint to move it or attach it to a shape.</p></section></Show>
            <Show when={tool() === "bucket"}><section class="pane-section"><div class="pane-heading">Bucket fill</div><p class="bucket-help">Click a closed shape to apply a solid color.</p><div class="fill-palette">{FILL_SWATCHES.map((swatch) => <button class={`color-swatch ${fillColor() === swatch ? "active" : ""}`} style={{ background: swatch }} aria-label={`Bucket color ${swatch}`} title={`Use ${swatch}`} onClick={() => setFillColor(swatch)} />)}<label class="custom-color-swatch" title="Choose custom bucket color"><input aria-label="Custom bucket color" type="color" value={fillColor()} onInput={(event) => setFillColor(event.currentTarget.value)} /></label></div></section></Show>
            <Show when={tool() === "line" || focusedElement()?.type === "line"}><section class="pane-section"><div class="pane-heading">Line route</div><div class="connector-route-buttons">{LINE_ROUTES.map((route) => <button class={(focusedElement()?.type === "line" ? (focusedElement() as ShapeElement).lineRoute : lineRoute()) === route.value ? "active" : ""} title={route.label} aria-label={`${route.label} line`} onClick={() => focusedElement()?.type === "line" ? updateProperty("lineRoute", route.value) : setLineRoute(route.value)}><svg viewBox="0 0 24 24"><path d={route.path} /></svg><small>{route.label}</small></button>)}</div></section></Show>
<Show when={tool() === "arrow" || focusedElement()?.type === "arrow"}><section class="pane-section"><div class="pane-heading">Arrow route</div><div class="connector-route-buttons">{ARROW_ROUTES.map((route) => <button class={(focusedElement()?.type === "arrow" ? (focusedElement() as ShapeElement).arrowRoute : arrowRoute()) === route.value ? "active" : ""} title={route.label} aria-label={`${route.label} arrow`} onClick={() => focusedElement()?.type === "arrow" ? updateProperty("arrowRoute", route.value) : setArrowRoute(route.value)}><svg viewBox="0 0 24 24"><path d={route.path} /></svg><small>{route.label}</small></button>)}</div></section></Show><Show when={tool() === "rectangle" || tool() === "circle" || tool() === "diamond" || tool() === "triangle" || tool() === "flowchart" || focusedElement()?.type === "rectangle" || focusedElement()?.type === "circle" || focusedElement()?.type === "diamond" || focusedElement()?.type === "triangle" || focusedElement()?.type === "flowchart"}><section class="pane-section"><div class="pane-heading">Fill</div><div class="fill-options"><button class={!(selectedFillColor()) && !fillEnabled() ? "active" : ""} onClick={() => { setFillEnabled(false); if (selectedIndices().length) updateProperty("fillColor", undefined); }}>None</button><button class={fillEnabled() || !!selectedFillColor() ? "active" : ""} onClick={() => { setFillEnabled(true); if (selectedIndices().length) updateProperty("fillColor", fillColor()); }}>Solid</button></div><div class="fill-style-row"><label class="fill-color-chip" title="Fill color"><input aria-label="Fill color" type="color" value={selectedFillColor() ?? fillColor()} onInput={(event) => { const value = event.currentTarget.value; setFillColor(value); if (hasStyleSelection()) updateProperty("fillColor", value); }} /></label><label class="fill-opacity-control">Opacity<input aria-label="Fill opacity" type="range" min="5" max="100" value={Math.round(((focusedElement() as ShapeElement | undefined)?.fillOpacity ?? fillOpacity()) * 100)} onInput={(event) => { const value = Number(event.currentTarget.value) / 100; setFillOpacity(value); if (selectedIndices().length) updateProperty("fillOpacity", value); }} /><span>{Math.round(((focusedElement() as ShapeElement | undefined)?.fillOpacity ?? fillOpacity()) * 100)}%</span></label></div></section></Show>
                <Show when={selectedIndices().length === 1 && !groupSelected() && !selectedNoteCard()}><section class="pane-section"><div class="pane-heading">Precision</div><div class="precision-grid">{(["x", "y", "w", "h", "rotation"] as const).map(property => <label>{property === "rotation" ? "Angle °" : property.toUpperCase()}<input aria-label={`Selection ${property}`} type="number" step="1" disabled={boardLocked() || focusedElement()?.locked || (!!focusedElement() && isConnector(focusedElement()!) && (property === "w" || property === "h" || property === "rotation"))} value={Math.round((property === "rotation" ? focusedElement()?.rotation ?? 0 : focusedElement() ? elementBounds(focusedElement()!)[property] : 0) * 100) / 100} onChange={event => precision(property, Number(event.currentTarget.value))} /></label>)}</div>
                  <Show when={focusedElement() && isConnector(focusedElement()!)}><div class="precision-grid">{(["start", "end"] as const).flatMap(end => (["x", "y"] as const).map(axis => <label>{end} {axis.toUpperCase()}<input type="number" disabled={boardLocked() || focusedElement()?.locked} value={Math.round(((focusedElement() as ShapeElement)[axis] + (end === "end" ? (focusedElement() as ShapeElement)[axis === "x" ? "w" : "h"] : 0)) * 100) / 100} onChange={event => setEndpoint(end, axis, Number(event.currentTarget.value))} /></label>))}</div><Show when={focusedElement()?.type === "arrow" && (focusedElement() as ShapeElement).arrowRoute === "forked"}><div class="precision-grid">{(["upper", "lower"] as const).flatMap(branch => (["x", "y"] as const).map(axis => <label>{branch} {axis.toUpperCase()}<input type="number" disabled={boardLocked() || focusedElement()?.locked} value={Math.round(forkGeometry(focusedElement() as ShapeElement)[branch] [axis] * 100) / 100} onChange={event => setForkEndpoint(branch, axis, Number(event.currentTarget.value))} /></label>))}</div></Show><p class="bucket-help">Drag the circular endpoints to resize or attach. Fork branches have separate endpoints and attachment points.</p><button class="quiet-button" onClick={() => changeSelected(item => isConnector(item) ? { ...item, startBinding: undefined, endBinding: undefined, forkUpper: item.forkUpper ? { ...item.forkUpper, endBinding: undefined } : undefined, forkLower: item.forkLower ? { ...item.forkLower, endBinding: undefined } : undefined } : item)}>Detach endpoints</button><button class="quiet-button" onClick={() => changeSelected(item => isConnector(item) ? { ...item, routePoints: undefined, routeWaypoints: item.autoRoute ? [] : undefined, forkUpper: item.forkUpper ? { ...item.forkUpper, routePoints: undefined } : undefined, forkLower: item.forkLower ? { ...item.forkLower, routePoints: undefined } : undefined } : item)}>Reset route</button></Show>
                </section></Show>
                <Show when={selectedIndices().length > 1}><section class="pane-section"><div class="pane-heading">Align & distribute</div><div class="alignment-grid">{(["left", "center", "right", "top", "middle", "bottom", "horizontal", "vertical"] as const).map(command => <button disabled={boardLocked() || ((command === "horizontal" || command === "vertical") && selectedIndices().length < 3)} title={command === "horizontal" || command === "vertical" ? `Distribute ${command} gaps` : `Align ${command}`} onClick={() => alignSelection(command)}>{command}</button>)}</div></section></Show>
                <Show when={!!selectedIndices().length && !selectedNoteCard()}><section class="pane-section"><div class="pane-heading">Selection</div><label class="property-label">Opacity <input disabled={selectedIndices().every((index) => !elements()[index] || elements()[index].locked)} type="range" min="10" max="100" value={Math.round(selectedOpacity() * 100)} onInput={(event) => updateProperty("opacity", Number(event.currentTarget.value) / 100)} /></label><div class="object-style-transfer"><button class="quiet-button" disabled={!selectedElements().length} onClick={copyObjectStyle} title={`Copy style (${shortcuts().copyStyle})`}>Copy style</button><button class="quiet-button" disabled={!copiedObjectStyle() || boardLocked()} onClick={pasteObjectStyle} title={`Paste style (${shortcuts().pasteStyle})`}>Paste style</button></div><Show when={!groupSelected() && !(focusedElement() && isConnector(focusedElement()!))}><div class="rotation-controls"><button disabled={focusedElement()?.locked} onClick={() => rotateSelection(-15)} title="Rotate counterclockwise by 15 degrees">−15°</button><button disabled={focusedElement()?.locked} onClick={resetSelectionRotation} title="Reset rotation to zero">Reset 0°</button><button disabled={focusedElement()?.locked} onClick={() => rotateSelection(15)} title="Rotate clockwise by 15 degrees">+15°</button></div></Show></section></Show>
                <Show when={selectedIndices().length > 1 && !groupSelected()}><div class="multi-selection-actions"><button class="pane-group-button" onClick={groupSelection}>Group {selectedIndices().length} elements <kbd>Ctrl+G</kbd></button><button class="pane-delete-button" disabled={boardLocked() || !deletableSelectionCount()} onClick={deleteSelected}>Delete {deletableSelectionCount()}</button></div></Show>
              </Show>

              </div>
            </aside></Show>
            <Show when={textDraft()}>{draft => <div class="text-editor-frame" style={{ left: `${canvasState().panX + editorLeft(draft()) * canvasState().zoom}px`, top: `${canvasState().panY + draft().y * canvasState().zoom}px`, width: `${editorWidth(draft()) * canvasState().zoom}px`, height: draft().height ? `${draft().height! * canvasState().zoom}px` : undefined, transform: `rotate(${draft().rotation ?? 0}deg)`, "justify-content": draft().verticalAlign === "bottom" ? "flex-end" : draft().verticalAlign === "middle" ? "center" : "flex-start", "font-size": `${draft().fontSize * canvasState().zoom}px`, "font-family": fontCss(draft().fontFamily), "font-weight": draft().bold ? 700 : 400, "font-style": draft().italic ? "italic" : "normal", "text-decoration": draft().underline ? "underline" : "none", "text-align": draft().textAlign, color: themeInk(draft().color, theme()), opacity: draft().opacity }}>
              <div ref={element => { textEditorElement = element; requestAnimationFrame(() => { if (element.isConnected && textDraft()) { element.innerText = draft().value; if (textEditorPendingPointerId === undefined) element.focus(); const range = document.createRange(); range.selectNodeContents(element); range.collapse(false); const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); } }); }} class="canvas-text-editor" contentEditable={true} role="textbox" aria-label="Canvas text" aria-multiline="true" data-placeholder="Type here…" onInput={event => updateTextDraft(event.currentTarget.innerText)} onBlur={event => { if (!isWindowsPlatform()) return; const next = event.relatedTarget; if (!(next instanceof HTMLElement && next.closest(".style-pane"))) commitTextDraft(); }} onPointerDown={event => event.stopPropagation()} onPaste={event => { event.preventDefault(); const text = event.clipboardData?.getData("text/plain") ?? ""; const selection = window.getSelection(); if (selection?.rangeCount) { const range = selection.getRangeAt(0); range.deleteContents(); const node = document.createTextNode(text); range.insertNode(node); range.setStartAfter(node); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); updateTextDraft(event.currentTarget.innerText); } }} onKeyDown={event => { event.stopPropagation(); if (event.key === "Escape" || (event.key === "Enter" && (event.ctrlKey || event.metaKey))) { event.preventDefault(); commitTextDraft(); if (event.key === "Escape") { setTool(isWindowsPlatform() ? "select" : "pan"); if (isWindowsPlatform()) setStyleMenuMode("quick"); setSelectedIndices([]); setHoveredIndex(undefined); } } }} />
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
      <Show when={classCardDraft()}>{draft => <div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setClassCardDraft(undefined); }}><section class="confirm-dialog class-card-dialog" role="dialog" aria-modal="true" aria-labelledby="class-card-title"><header><div><span class="eyebrow">UML CLASS CARD</span><h2 id="class-card-title">{draft().componentId ? "Edit class card" : "Create a class card"}</h2></div><button class="help-close" aria-label="Close class card editor" onClick={() => setClassCardDraft(undefined)}>&times;</button></header><p>Enter the class name, attributes, and methods. The card grows to fit its content; its sections stay independently editable on the canvas.</p><label>Class name<input autofocus value={draft().name} onInput={event => setClassCardDraft(value => value ? { ...value, name: event.currentTarget.value } : value)} /></label><label>Attributes<textarea rows="4" placeholder={"+ id: UUID\n- name: string"} value={draft().attributes} onInput={event => setClassCardDraft(value => value ? { ...value, attributes: event.currentTarget.value } : value)} onKeyDown={event => { if (event.key === "Tab") indentTextarea(event, value => setClassCardDraft(current => current ? { ...current, attributes: value } : current)); }} /></label><label>Methods<textarea rows="3" placeholder={"+ create()\n- validate()"} value={draft().methods} onInput={event => setClassCardDraft(value => value ? { ...value, methods: event.currentTarget.value } : value)} onKeyDown={event => { if (event.key === "Tab") indentTextarea(event, value => setClassCardDraft(current => current ? { ...current, methods: value } : current)); }} /></label><label>Font size<input type="number" min="8" max="48" step="1" value={draft().fontSize} onChange={event => setClassCardDraft(value => value ? { ...value, fontSize: Math.round(Number(event.currentTarget.value)) } : value)} /></label><div><button class="quiet-button" onClick={() => setClassCardDraft(undefined)}>Cancel</button><button class="save-button" onClick={insertClassCard}>{draft().componentId ? "Update card" : "Add to canvas"}</button></div></section></div>}</Show>
      <Show when={mermaidDialog()}>
        <div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) closeMermaidDialog(); }}>
          <section class="confirm-dialog schema-dialog mermaid-dialog" role="dialog" aria-modal="true" aria-labelledby="mermaid-title">
            <header><div><span class="eyebrow">DIAGRAM AS CODE</span><h2 id="mermaid-title">{mermaidEditingDiagram() ? "Update editable flowchart" : "Generate an editable flowchart"}</h2></div><button class="help-close" aria-label="Close diagram code editor" onClick={closeMermaidDialog}>&times;</button></header>
            <p>Paste Mermaid flowchart code. The preview updates as you type. SketchDraw stores the source in the .sketch file and creates native shapes and connectors. Double-click the diagram to edit its source. Subgraphs, node labels, decisions, solid, dashed, dotted, thick, bidirectional and endpoint-marked connectors are supported.</p>
            <div class="mermaid-editor-layout">
              <textarea autofocus class="mermaid-input" aria-label="Mermaid flowchart source" value={mermaidInput()} placeholder={'flowchart TD\n  subgraph Auth[Authentication]\n    Start([Start]) --> Check{Ready?}\n    Check -.->|retry| Start\n  end\n  Check ==> Done[Finish]'} onInput={event => { setMermaidInput(event.currentTarget.value); setMermaidError(""); }} onKeyDown={event => { if (event.key === "Tab") indentTextarea(event, setMermaidInput); }} />
              <Suspense fallback={<div class="mermaid-preview-loading" role="status">Loading live preview…</div>}>
                <MermaidPreview source={mermaidInput()} />
              </Suspense>
            </div>
            <Show when={mermaidError()}><p class="schema-error" role="alert">{mermaidError()}</p></Show>
            <div class="mermaid-dialog-footer"><span>Up to 200 nodes, 500 connectors and 50 subgraphs</span><div><button class="quiet-button" onClick={closeMermaidDialog}>Cancel</button><button class="save-button" disabled={boardLocked()} onClick={insertMermaidDiagram}>{mermaidEditingDiagram() ? "Update diagram" : "Generate canvas diagram"}</button></div></div>
          </section>
        </div>
      </Show>
      <Show when={schemaDialog()}><div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) { setSchemaDialog(false); setSchemaEditingDiagram(undefined); } }}><section class="confirm-dialog schema-dialog" role="dialog" aria-modal="true" aria-labelledby="schema-title"><header><div><span class="eyebrow">DATABASE SCHEMA VISUALIZER</span><h2 id="schema-title">{schemaEditingDiagram() ? "Update linked table cards" : "Generate linked table cards"}</h2></div><button class="help-close" aria-label="Close schema visualizer" onClick={() => { setSchemaDialog(false); setSchemaEditingDiagram(undefined); }}>&times;</button></header><p>Paste SQL <code>CREATE TABLE</code> statements or JSON with a <code>tables</code> array. Primary and foreign keys become labeled rows with connectors anchored to those rows. Double-click any generated table to edit this source and regenerate the diagram. Press Tab to indent and Shift+Tab to outdent.</p><textarea autofocus class="schema-input" aria-label="SQL or JSON schema" value={schemaInput()} placeholder={'CREATE TABLE users (\n  id INTEGER PRIMARY KEY,\n  name VARCHAR(80) NOT NULL\n);\n\nCREATE TABLE orders (\n  id INTEGER PRIMARY KEY,\n  user_id INTEGER REFERENCES users(id)\n);'} onInput={event => { setSchemaInput(event.currentTarget.value); setSchemaError(""); }} onKeyDown={event => { if (event.key === "Tab") indentTextarea(event, setSchemaInput); }} /><Show when={schemaError()}><p class="schema-error" role="alert">{schemaError()}</p></Show><div class="schema-dialog-footer"><span>Up to 50 tables per import</span><div><button class="quiet-button" onClick={() => { setSchemaDialog(false); setSchemaEditingDiagram(undefined); }}>Cancel</button><button class="save-button" disabled={boardLocked()} onClick={insertSchemaVisual}>{schemaEditingDiagram() ? "Update diagram" : "Add to canvas"}</button></div></div></section></div></Show>
      <Show when={pageDialog()}><div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setPageDialog(undefined); }}><section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="page-dialog-title"><h2 id="page-dialog-title">{pageDialog() === "rename" ? "Rename page" : "Delete page?"}</h2><Show when={pageDialog() === "rename"} fallback={<p>Delete “{currentPage()?.name}” and its contents? This page deletion cannot be undone.</p>}><label>Page name<input autofocus maxlength="80" value={pageName()} onInput={event => setPageName(event.currentTarget.value)} onKeyDown={event => { if (event.key === "Enter" && pageName().trim()) confirmPageDialog(); }} /></label></Show><div><button class="quiet-button" onClick={() => setPageDialog(undefined)}>Cancel</button><button class={pageDialog() === "delete" ? "danger-button" : "save-button"} disabled={boardLocked() || (pageDialog() === "rename" && !pageName().trim())} onClick={confirmPageDialog}>{pageDialog() === "rename" ? "Rename" : "Delete page"}</button></div></section></div></Show>
      <Show when={renameFileOpen()}><div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setRenameFileOpen(false); }}><section class="confirm-dialog rename-file-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-file-title"><h2 id="rename-file-title">Rename sketch file</h2><p>Choose a new name for <strong>{displayPathName(activePath() ?? "")}</strong>. The <code>.sketch</code> extension is kept automatically.</p><Show when={renameFileError()}><p class="rename-file-error" role="alert">{renameFileError()}</p></Show><label>File name<input autofocus maxlength="180" value={renameFileName()} onInput={event => setRenameFileName(event.currentTarget.value)} onKeyDown={event => { if (event.key === "Enter" && renameFileName().trim()) void confirmRenameFile(); }} /></label><div><button class="quiet-button" disabled={nativeBusy()} onClick={() => setRenameFileOpen(false)}>Cancel</button><button class="save-button" disabled={!renameFileName().trim() || nativeBusy() || documentBusy()} onClick={() => void confirmRenameFile()}>{nativeBusy() ? "Renaming…" : "Rename file"}</button></div></section></div></Show>
      <Show when={exportOptionsOpen()}><div class="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setExportOptionsOpen(false); }}><section class="confirm-dialog export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <header class="export-heading"><div><span class="eyebrow">EXPORT PREVIEW</span><h2 id="export-title">Export {exportFormat().toUpperCase()}</h2></div><button class="help-close" aria-label="Close export dialog" onClick={() => setExportOptionsOpen(false)}>&times;</button></header>
        <div class="export-layout"><div class="export-controls"><p>Choose what to export and review the result before saving.</p>
          <div class="export-scope">{(["drawing", "selection", "viewport"] as const).map(scope => <button class={exportScope() === scope ? "active" : ""} disabled={(scope === "selection" && !selectedIndices().length) || (exportFormat() === "pdf" && pdfPageSet() !== "current" && scope !== "drawing")} onClick={() => setExportScope(scope)}>{scope === "drawing" ? "Whole drawing" : scope === "selection" ? "Selection" : "Viewport"}</button>)}</div>
          <label class="export-transparent"><input type="checkbox" checked={exportGrid()} onChange={event => setExportGrid(event.currentTarget.checked)} /> Include visible grid</label>
          <Show when={exportFormat() === "pdf"}>
            <section class="pdf-settings"><div class="pdf-setting-heading">Sketch pages</div><div class="pdf-choice-row"><button class={pdfPageSet() === "current" ? "active" : ""} onClick={() => { setPdfPageSet("current"); setPdfPreviewPage(1); }}>Current page</button><button class={pdfPageSet() === "all" ? "active" : ""} onClick={() => { setPdfPageSet("all"); setExportScope("drawing"); setPdfLayout("fit"); setPdfPreviewPage(1); }}>All pages ({pages().length})</button><button class={pdfPageSet() === "range" ? "active" : ""} onClick={() => { setPdfPageSet("range"); setExportScope("drawing"); setPdfLayout("fit"); setPdfRangeStart(value => Math.min(value, pages().length)); setPdfRangeEnd(pages().length); setPdfPreviewPage(1); }}>Page range</button></div><Show when={pdfPageSet() === "range"}><div class="pdf-custom-size"><label>From page<input type="number" min="1" max={pages().length} value={pdfRangeStart()} onInput={event => setPdfRangeStart(Math.max(1, Math.min(pages().length, Number(event.currentTarget.value))))} /></label><label>To page<input type="number" min={pdfRangeStart()} max={pages().length} value={pdfRangeEnd()} onInput={event => setPdfRangeEnd(Math.max(pdfRangeStart(), Math.min(pages().length, Number(event.currentTarget.value))))} /></label></div></Show><div class="pdf-setting-heading">Paper size</div><div class="pdf-paper-grid">{([{ id: "a4", label: "A4" }, { id: "letter", label: "Letter" }, { id: "a3", label: "A3" }, { id: "legal", label: "Legal" }, { id: "tabloid", label: "Tabloid" }, { id: "custom", label: "Custom" }] as const).map(({ id, label }) => <button class={pdfPaper() === id ? "active" : ""} onClick={() => setPdfPaper(id)}>{label}</button>)}</div>
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
        </div><div class="export-preview-panel"><div class="export-preview-label"><strong>Preview</strong><Show when={exportFormat() === "pdf"} fallback={<span>{exportWidth()} &times; {exportHeight()} px</span>}><div class="pdf-preview-pages"><button disabled={pdfPreviewPage() <= 1} aria-label="Previous PDF page" onClick={() => setPdfPreviewPage(value => Math.max(1, value - 1))}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10 3-5 5 5 5"/></svg></button><span>Page {pdfPreviewPage()} of {pdfMetrics().pageCount}</span><button disabled={pdfPreviewPage() >= pdfMetrics().pageCount} aria-label="Next PDF page" onClick={() => setPdfPreviewPage(value => Math.min(pdfMetrics().pageCount, value + 1))}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg></button></div></Show></div><div class="export-preview-frame" classList={{ transparent: exportFormat() !== "pdf" && exportTransparent() }}><canvas ref={exportPreviewCanvas} aria-label={`${exportFormat().toUpperCase()} export preview`} /></div><small>{exportFormat() === "pdf" && pdfPageSet() === "all" ? `Sketch page ${pdfPreviewPage()} of ${pages().length}` : exportScope() === "drawing" ? "Whole drawing" : exportScope() === "selection" ? "Selected objects" : "Current viewport"}{exportFormat() === "pdf" ? ` / ${pdfPageSpec().widthMm.toFixed(0)} x ${pdfPageSpec().heightMm.toFixed(0)} mm / ${pdfDpi()} DPI` : exportTransparent() ? " / transparent" : " / whiteboard background"}</small></div></div>
      </section></div></Show>
      <Show when={recoveryPrompt()}>{(recovery) => <div class="confirm-backdrop"><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="recovery-title"><h2 id="recovery-title">Recover unsaved work?</h2><p>SketchDraw found a local recovery copy for <strong>{recovery().path.split(/[\\/]/).pop()}</strong>. Restore it or continue with the saved file.</p><div><button class="quiet-button" onClick={discardRecovery}>Use saved file</button><button class="save-button" onClick={restoreRecovery}>Restore recovery</button></div></section></div>}</Show>
      <Show when={syncConflict()}>{(conflict) => <div class="confirm-backdrop"><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="conflict-title"><h2 id="conflict-title">File changed elsewhere</h2><p><strong>{conflict().path.split(/[\\/]/).pop()}</strong> is being merged with the latest shared-folder version. If automatic merging cannot finish, save your work to another file or load the disk version.</p><div class="conflict-actions"><button class="quiet-button" onClick={() => void saveAs()}>Save my version as…</button><button class="quiet-button" onClick={reloadConflictingFile}>Load disk version</button></div></section></div>}</Show>
      <Show when={isWindowsPlatform()}><Suspense fallback={null}><WindowsCommandPalette open={commandPaletteOpen()} commands={windowsCommands()} onClose={() => setCommandPaletteOpen(false)} /></Suspense></Show>
      <Show when={isWindowsPlatform() && shortcutDialogOpen()}><Suspense fallback={null}><WindowsKeyboardShortcutsDialog shortcuts={shortcuts()} onChange={setWindowsShortcut} onReset={resetWindowsShortcuts} onClose={() => setShortcutDialogOpen(false)} /></Suspense></Show>
      <Show when={showClearConfirm()}><div class="confirm-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setShowClearConfirm(false); }}><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="clear-title"><h2 id="clear-title">Clear this canvas?</h2><p>This will remove all {elements().length} items from the open sketch. You can undo this action.</p><div><button class="quiet-button" onClick={() => setShowClearConfirm(false)}>Cancel</button><button class="danger-button" onClick={() => { if (elements().length && !boardLocked()) { pushUndo(cloneElements(elements())); setElements([]); setSelectedIndices([]); setDirty(true); } setShowClearConfirm(false); }}>Clear canvas</button></div></section></div></Show>
      <Show when={helpOpen()}><div class="confirm-backdrop help-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setHelpOpen(false); }}><section class="confirm-dialog help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title"><header><div><span class="eyebrow">{helpSection() === "guide" ? "SKETCHDRAW GUIDE" : "SHORTCUT REFERENCE"}</span><h2 id="help-title">{helpSection() === "guide" ? "Guide" : "Keyboard shortcuts"}</h2></div><button class="help-close" aria-label="Close help" onClick={() => setHelpOpen(false)}>&times;</button></header><div class="help-content"><Show when={helpSection() === "guide"} fallback={<section class="help-shortcuts-section"><h3>Keyboard shortcuts</h3><p>Use these shortcuts while the canvas is active. Text fields keep their standard editing shortcuts.</p><table class="shortcut-table"><thead><tr><th scope="col">Shortcut</th><th scope="col">Action</th></tr></thead><tbody>{helpShortcuts.map(([key, action]) => <tr><th scope="row"><kbd>{key}</kbd></th><td>{action}</td></tr>)}</tbody></table></section>}><div class="help-guide"><section><h3>Start a sketch</h3><p>Create a new file or open a version 8 <code>.sketch</code> document. SketchDraw saves edits to the active file automatically. The save dot and time show whether changes are saved or still being written.</p></section><section><h3>Draw and style</h3><p>Choose a tool from the toolbar, then click or drag on the canvas. Common style controls sit beside the canvas; open the properties button for the full settings panel. Line options include one-, two-, and three-control-point curves plus a four-point editable line; lines and arrows both support arrowheads. Hold Space or choose Hand to pan, or use the mouse wheel to zoom around the pointer.</p></section><section><h3>Select and edit</h3><p>Use Select to click an object or drag a marquee around objects. Drag selected items to move them. Use handles to resize or rotate, and double-click a shape to edit its label. Select Text and click once to place text. The bucket fills a closed shape without selecting it. Right-click the canvas for object commands.</p></section><section><h3>Files, pages, and export</h3><p>Use File to create, open, save, import images, export PNG/SVG/PDF, or clear the canvas. Add and manage pages from the page strip. Use View to change the theme and whiteboard color. Autosave watches for outside file changes and asks before resolving conflicts.</p></section><section class="touch-guide-section"><h3>Phone and tablet controls</h3><p>The compact tool dock stays on the left. Tap <strong>More</strong> to show the remaining tools, then tap it again to collapse the dock. The four-square button at the top of the dock opens canvas options such as grid, snapping, and fit-to-view.</p></section><section class="touch-guide-section"><h3>Properties and components</h3><p>Tap the Quick style or Advanced style button in the left dock. Quick style adjusts color and width; Advanced style adds tool-specific options. Close either panel with its top-corner button. Open Symbols and elements from the expanded tools and scroll its list vertically to browse components.</p></section><section class="touch-guide-section"><h3>Touch, stylus, and navigation</h3><p>Draw with a finger or stylus. Pinch with two fingers to zoom. Open Pages in the top bar to switch, add, rename, or organize pages. The zoom percentage button recenters the canvas and resets to 100%. Set tap-only actions under Gestures &gt; Tap actions. Configure one-finger drags and two- or three-finger movement separately under Gestures &gt; Finger movements. A compatible stylus uses the active tool. Tap a style button in the tool dock to change pen, brush, or shape settings.</p></section></div></Show></div><footer><span>&copy; 2026 Toushal Sampat. See the README and version 8 file format guide for details.</span><button class="save-button" onClick={() => setHelpOpen(false)}>Close</button></footer></section></div></Show>
      <Show when={error()}><div class="error-toast" role="alert">{error()}<button onClick={() => setError("")}>Dismiss</button></div></Show>
    </main>
  );
}

export default App;

