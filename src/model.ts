export type Point = { x: number; y: number };
export type StrokePoint = Point & { pressure?: number; tiltX?: number; tiltY?: number; orientation?: number };
export type ArrowHead = "none" | "open" | "solid" | "hollow" | "thick" | "dot" | "diamond" | "open-diamond" | "bar" | "crow";
export type FlowchartShape = "process" | "terminator" | "decision" | "data" | "document" | "multi-document" | "database" | "predefined-process" | "internal-storage" | "preparation" | "manual-input" | "manual-operation" | "connector" | "off-page" | "delay" | "stored-data" | "display" | "merge" | "extract" | "collate" | "sort" | "summing-junction" | "or" | "loop-limit" | "loop-start" | "loop-end" | "alternate-process" | "card" | "punched-tape" | "sequential-data" | "direct-data" | "cloud" | "star" | "lightning" | "heart" | "callout" | "gear" | "hexagon" | "parallelogram" | "trapezoid" | "pentagon" | "octagon" | "chevron" | "cross" | "folder" | "note" | "cube" | "rounded-rectangle" | "shield" | "right-arrow" | "left-arrow" | "double-arrow" | "up-arrow" | "down-arrow" | "ring" | "pie-slice" | "wave" | "banner" | "teardrop" | "funnel";
export type ArrowRoute = "straight" | "elbow" | "curve" | "forked" | "loop" | "jagged";
export type LineRoute = "straight" | "elbow" | "curve";
export type StrokeStyle = "solid" | "dashed" | "dotted" | "double";
export type StrideThreatCategory = "spoofing" | "tampering" | "repudiation" | "information-disclosure" | "denial-of-service" | "elevation-of-privilege";
export type ArchitectureMetadata = { serviceKey?: string; owner?: string; criticality?: "low" | "medium" | "high" | "critical"; slo?: string; runbook?: string; environment?: string; region?: string; availabilityZone?: string; subnet?: string; cidr?: string; ipAddress?: string };
/** Legacy task reference kept only to round-trip old .sketch objects; current runtime does not link Canvas objects to Planning tasks. */
export type LayerFlags = { id?: string; hidden?: boolean; locked?: boolean; rotation?: number; aspectLocked?: boolean; layerId?: string; layerName?: string; componentId?: string; componentRole?: string; catalogId?: string; pageLinkId?: string; prototypeTargetId?: string; pageLinkTransition?: PageLinkTransition; prototypeAction?: PrototypeAction; prototypeOverlay?: boolean; prototypeFixed?: boolean; projectTaskId?: string; masterElementId?: string; altText?: string; href?: string; tooltip?: string; dataLink?: DataLink; metrics?: ElementMetrics; styleBindings?: StyleBindings; layoutFill?: boolean; liveSourceId?: string; liveKey?: string; liveSource?: { format: LiveDiagramFormat; source: string }; d2?: D2Metadata; strideThreats?: StrideThreatCategory[]; architecture?: ArchitectureMetadata; decisionCard?: DecisionCardMetadata };
/** `value` is the first mode's color; `modeValues` holds the others. `aliasOf` makes the token follow another color token. */
export type ColorToken = { id: string; name: string; value: string; modeValues?: Record<string, string>; aliasOf?: string };
export type StyleMode = { id: string; name: string };
export type TextStyleToken = { id: string; name: string; fontSize: number; fontFamily: FontFamily; bold?: boolean; italic?: boolean; underline?: boolean; textAlign?: "left" | "center" | "right" | "justify" };
export type StrokeStyleToken = { id: string; name: string; thickness: number; lineStyle: StrokeStyle };
/** Named design tokens shared by every page of a sketch. Components and masters keep their own overrides. */
export type StyleLibrary = { colors: ColorToken[]; textStyles: TextStyleToken[]; strokeStyles: StrokeStyleToken[]; modes?: StyleMode[]; activeModeId?: string };
export type StyleSlot = "stroke" | "fill" | "text" | "textStyle" | "strokeStyle";
/** `applied` records the literal values last written by the token, so a later manual edit detaches the binding. */
export type StyleBindings = Partial<Record<StyleSlot, { id: string; applied: string }>>;
/** Languages the live diagram editor turns into editable shapes. */
export type LiveDiagramFormat = "mermaid" | "plantuml" | "d2" | "cloud" | "org";
export type FontFamily = "sans" | "hand" | "serif" | "mono" | "rounded" | "display";
export type PageLinkTransition = "instant" | "fade" | "slide";
export type EdgeStyle = "sharp" | "rounded" | "pill" | "cut";
export type FreehandElement = LayerFlags & { type: "freehand"; points: StrokePoint[]; color: string; thickness: number; opacity?: number };
export type ConnectionPoint = { id: string; name: string; anchor: Point; accepts?: RelationshipType[] };
export type AutoLayoutConfig = { direction: "horizontal" | "vertical" | "grid"; gap: number; padding: number; align: "start" | "center" | "end" | "stretch"; wrap?: boolean; columns?: number };
export type ContainerMetadata = { kind: "frame" | "container" | "swimlane"; name: string; autoLayout?: AutoLayoutConfig; background?: string; showBorder?: boolean; showLabel?: boolean; borderColor?: string; borderThickness?: number; borderStyle?: StrokeStyle; clipChildren?: boolean; autoResize?: boolean; lockedSize?: boolean; collapsed?: boolean; expandedBounds?: Bounds; padding?: number; scrollDirection?: "vertical" | "horizontal" | "both"; connectionPoints?: ConnectionPoint[] };
export type CanvasLayer = { id: string; name: string; parentId?: string; hidden?: boolean; locked?: boolean; order: number };
export type CanvasLayerVisibilityPreset = { id: string; name: string; hiddenLayerIds: string[] };
export type ReviewCommentMessage = { id: string; author: string; text: string; createdAt: number };
/** Legacy local review metadata retained for backward-compatible document round trips. */
export type ReviewCommentThread = { id: string; elementId?: string; anchor: Point; messages: ReviewCommentMessage[]; resolved?: boolean };
export type ForkBranch = { end?: Point; routePoints?: Point[]; endHead?: ArrowHead; endBinding?: Binding };
export type RelationshipType = "association" | "dependency" | "data-flow" | "inheritance" | "aggregation" | "composition" | "sequence" | "network" | "other";
export type RelationshipDirection = "forward" | "both" | "none";
export type TransportSecurity = "encrypted" | "unencrypted" | "unknown";
export type ShapeElement = LayerFlags & { type: "rectangle" | "circle" | "diamond" | "triangle" | "flowchart" | "line" | "arrow" | "svgPath"; x: number; y: number; w: number; h: number; color: string; thickness: number; fillColor?: string; fillOpacity?: number; opacity?: number; lineStyle?: StrokeStyle; edgeStyle?: EdgeStyle; cornerRadius?: number; flowchartShape?: FlowchartShape; shapeAdjustments?: { shaft?: number; head?: number; inset?: number }; pathData?: string; pathWidth?: number; pathHeight?: number; fillRule?: "nonzero" | "evenodd"; svgStroke?: boolean; svgNonScalingStroke?: boolean; connectionPoints?: ConnectionPoint[]; lineRoute?: LineRoute; arrowRoute?: ArrowRoute; autoRoute?: boolean; straightOnly?: boolean; routeWaypoints?: Point[]; startHead?: ArrowHead; endHead?: ArrowHead; startBinding?: Binding; endBinding?: Binding; routePoints?: Point[]; forkUpper?: ForkBranch; forkLower?: ForkBranch; label?: ShapeLabel; connectorLabels?: ShapeLabel[]; relationshipFields?: LibraryComponentFieldValue[]; schemaDiagramId?: string; relationshipType?: RelationshipType; cardinality?: string; relationshipDirection?: RelationshipDirection; transportSecurity?: TransportSecurity; protocol?: string; portNumber?: number; apiContract?: string; dataContract?: string; sequenceCondition?: string; sequenceDefault?: boolean };
export type TextElement = LayerFlags & { type: "text"; x: number; y: number; text: string; color: string; fontSize: number; fontFamily?: FontFamily; bold?: boolean; italic?: boolean; underline?: boolean; textAlign?: "left" | "center" | "right" | "justify"; listType?: "none" | "bullet" | "number"; wrapWidth?: number; opacity?: number };
export type ImageElement = LayerFlags & { type: "image"; x: number; y: number; w: number; h: number; dataUrl: string; sourceWidth?: number; sourceHeight?: number; cropX?: number; cropY?: number; cropW?: number; cropH?: number; opacity?: number; previewUrl?: string };
export type SchemaField = { id: string; name: string; dataType: string; primaryKey?: boolean; foreignTable?: string; foreignColumn?: string; nullable?: boolean };
export type SchemaIndex = { name: string; columns: string[]; orders?: ("ASC" | "DESC")[]; method?: string; unique?: boolean; expression?: string };
export type SchemaConstraint = { name?: string; kind: "unique" | "check" | "foreign-key" | "primary-key"; columns?: string[]; expression?: string; referencedTable?: string; referencedColumns?: string[]; onDelete?: "NO ACTION" | "RESTRICT" | "CASCADE" | "SET NULL" | "SET DEFAULT"; onUpdate?: "NO ACTION" | "RESTRICT" | "CASCADE" | "SET NULL" | "SET DEFAULT" };
export type SchemaObjectKind = "table" | "view" | "enum";
export type SchemaTableElement = LayerFlags & { type: "schemaTable"; x: number; y: number; w: number; h: number; name: string; objectKind?: SchemaObjectKind; viewQuery?: string; enumValues?: string[]; columns: SchemaField[]; indexes?: SchemaIndex[]; constraints?: SchemaConstraint[]; schemaDiagramId: string; schemaSource: string; fontSize?: number; opacity?: number };
export type NoteKind = "note" | "sticky" | "checklist";
export type ChecklistItem = { id: string; type: "task"; text: string; checked: boolean; level: number } | { id: string; type: "heading"; text: string };
export type NoteMetadata = { kind: NoteKind; content: string; checklist?: { items: ChecklistItem[] }; title?: string; width?: number; height?: number; fontSize?: number; collapsed?: boolean; scrollY?: number; contentHeight?: number; tags?: string[] };
export type MermaidMetadata = { source: string; format?: "mermaid" | "plantuml"; diagramType?: "flowchart" | "sequence" | "class" | "er" | "state" | "journey" | "gantt" | "c4" | "mindmap" | "timeline" | "git" | "requirement" | "quadrant" | "kanban" | "sankey" | "block" | "pie" | "xychart" | "packet" | "architecture" | "radar" | "treemap" | "venn" | "usecase" | "ishikawa" | "treeview" | "swimlane" | "cynefin" | "wardley" | "eventmodeling" | "zenuml" | "activity" | "component" | "deployment" | "timing" | "wbs" | "network" | "json" | "yaml" | "archimate" };
export type PrototypeVariable = { id: string; name: string; type: "string" | "number" | "boolean"; value: string | number | boolean };
export type PrototypeCondition = { variableId: string; operator: "equals" | "not-equals" | "greater-than" | "less-than" | "truthy" | "falsy"; value?: string | number | boolean };
export type PrototypeAction = { trigger: "click" | "hover" | "press"; kind: "navigate" | "overlay" | "set-variable" | "set-state"; targetId?: string; variableId?: string; value?: string | number | boolean; condition?: PrototypeCondition };
export type DecisionCardMetadata = { boardId: string; quadrant: "high-high" | "high-low" | "low-high" | "low-low"; rank?: number };
export type D2LayoutDirection = "up" | "down" | "right" | "left";
/** D2 source attributes retained when their meaning cannot be represented by geometry alone. */
export type D2Metadata = { shape?: string; icon?: string; near?: string; fill?: string; stroke?: string; fontColor?: string; strokeWidth?: number; strokeDash?: string; fontSize?: number; gridRows?: number; gridColumns?: number; sequenceKind?: "participant" | "message"; sequenceOrder?: number; layout?: { direction?: D2LayoutDirection; gridGap?: number; horizontalGap?: number; verticalGap?: number; padding?: number } };
export type PrototypeComponentState = "hover" | "pressed" | "selected" | "disabled";
export type LibraryChartKind = "viz-bar" | "viz-horizontal-bar" | "viz-stacked-bar" | "viz-line" | "viz-area" | "viz-scatter" | "viz-pie" | "viz-donut" | "viz-radar" | "viz-gauge" | "viz-funnel" | "viz-heatmap" | "viz-treemap" | "viz-kpi";
export type LibraryChartSeries = { name: string; values: number[]; chartType?: "bar" | "line" | "area" | "scatter"; axis?: "primary" | "secondary"; color?: string };
export type LibraryChartAnnotation = { index: number; label: string; value?: number; axis?: "primary" | "secondary" };
export type LibraryChartOptions = {
  palette?: "blue" | "ocean" | "warm" | "violet" | "mono";
  legend?: "right" | "bottom" | "hidden";
  showGrid?: boolean;
  showValues?: boolean;
  showPoints?: boolean;
  smooth?: boolean;
  sort?: "original" | "ascending" | "descending";
  minValue?: number;
  maxValue?: number;
  radarTicks?: number;
  radarGraticule?: "circle" | "polygon";
  pointSize?: number;
  lineWidth?: number;
  categoryColors?: Record<string, string>;
};
export type LibraryChartData = {
  labels: string[]; values: number[]; title?: string; xAxisLabel?: string; yAxisLabel?: string; secondaryYAxisLabel?: string;
  axisIds?: string[];
  series?: LibraryChartSeries[];
  annotations?: LibraryChartAnnotation[];
  options?: LibraryChartOptions;
};
export type UiComponentKind =
  | "ui.button" | "ui.text-field" | "ui.select" | "ui.checkbox-group" | "ui.radio-group" | "ui.switch" | "ui.textarea" | "ui.search" | "ui.date-field" | "ui.slider" | "ui.password-field" | "ui.email-field" | "ui.file-upload"
  | "ui.card" | "ui.app-bar" | "ui.side-navigation" | "ui.tabs" | "ui.image" | "ui.alert" | "ui.dialog" | "ui.breadcrumbs" | "ui.avatar" | "ui.badge" | "ui.progress" | "ui.list" | "ui.table" | "ui.accordion" | "ui.menu" | "ui.toast" | "ui.pagination" | "ui.divider" | "ui.footer";
export type UiComponentItem = { id: string; label: string; detail?: string };
export type UiComponentProperties = {
  title?: string;
  body?: string;
  placeholder?: string;
  action?: string;
  secondaryAction?: string;
  items?: UiComponentItem[];
  selectedItemId?: string;
  selectedItemIds?: string[];
  checked?: boolean;
  progress?: number;
  tone?: "brand" | "neutral" | "positive" | "warning" | "critical";
  titlePlacement?: "above" | "below" | "leading" | "trailing";
  arrangement?: "stack" | "inline" | "grid";
  columns?: number;
  gap?: number;
  columnGap?: number;
};
export type UiComponentRecord = { schema: 1; properties: UiComponentProperties };
export type LibraryComponentFieldValue = { key: string; label: string; value: string; hint?: string };
export type LibraryComponentData = { kind: string; label?: string; componentFields?: LibraryComponentFieldValue[]; portCount?: number; connectionPoints?: ConnectionPoint[]; laneCount?: number; laneWeights?: number[]; durationMinutes?: number; renderStyle?: "clean"; iconSvg?: string; iconViewBox?: string; uiComponent?: UiComponentRecord; chartData?: LibraryChartData; trendDirection?: "up" | "down" | "steady"; appearance?: "modern" | "simple"; styleOverrides?: { color?: string; fillColor?: string | null; fillOpacity?: number; lineStyle?: StrokeStyle }; textStyle?: { color?: string; fontSize?: number; fontFamily?: FontFamily; bold?: boolean; italic?: boolean; underline?: boolean; textAlign?: "left" | "center" | "right" | "justify" } };
export type ComponentOverrides = { label?: string; color?: string; fillColor?: string | null; fillOpacity?: number; lineStyle?: StrokeStyle; chartData?: LibraryChartData; uiProperties?: Partial<UiComponentProperties>; portLabels?: Record<string, string> };
export type ComponentMaster = { id: string; name: string; template: Element[]; bounds: Bounds; variants?: Record<string, Element[]>; variantKey?: string; states?: Partial<Record<PrototypeComponentState, string>>; connectionPoints?: ConnectionPoint[]; createdAt?: number };
export type StencilParameterData = { template: Element[]; parameters: string[]; values: Record<string, string> };
export type GroupElement = LayerFlags & { type: "group"; elements: Element[]; componentBounds?: Bounds; container?: ContainerMetadata; note?: NoteMetadata; mermaid?: MermaidMetadata; libraryComponent?: LibraryComponentData; masterId?: string; componentOverrides?: ComponentOverrides; variantKey?: string; connectionPoints?: ConnectionPoint[]; stencilParameters?: StencilParameterData };
export type Element = FreehandElement | ShapeElement | TextElement | ImageElement | SchemaTableElement | GroupElement;
export type Tool = "select" | "pan" | "pen" | "laser" | "rectangle" | "circle" | "diamond" | "triangle" | "flowchart" | "line" | "arrow" | "text" | "bucket" | "eraser" | "crop";
export type ToolbarItem = Tool | "lasso" | "paintBrushes" | "measure" | "pathEdit" | "frame" | "codeData" | "componentLibrary";
// Retained only to round-trip this legacy .sketch field; the editor no longer exposes or applies guides.
export type CanvasGuide = { axis: "x" | "y"; position: number };
export type CanvasState = { zoom: number; panX: number; panY: number; backgroundColor: string; boardColorFollowsTheme?: boolean; guides?: CanvasGuide[] };
export type CanvasBookmark = { id: string; name: string; zoom: number; panX: number; panY: number };
/** A CSV or JSON table saved inside the sketch. `path` is where it was loaded from, used by Refresh. */
export type DataSource = { id: string; name: string; headers: string[]; rows: string[][]; path?: string; updatedAt: number };
/** Links one object to a row of a data source: `key` column equals `value`. Text comes from `label`; `rules` color it. */
export type DataLink = { source: string; key: string; value: string; label?: string; rules?: string };
/** Optional cost and capacity numbers on an object. Totals roll up through frames and containers. */
export type ElementMetrics = { cost?: number; capacity?: number; unit?: string };
export type SketchPage = { id: string; dataSources?: DataSource[]; bookmarks?: CanvasBookmark[]; name: string; canvasState: CanvasState; elements: Element[]; layers?: CanvasLayer[]; visibilityPresets?: CanvasLayerVisibilityPreset[]; componentMasters?: ComponentMaster[] ; styleLibrary?: StyleLibrary; prototypeVariables?: PrototypeVariable[]; comments?: ReviewCommentThread[] };
export type LegacyLibraryNote = { id: string; title: string; content: string; createdAt: number; updatedAt: number };
export type LibraryStudyCard = { id: string; front: string; back: string; dueAt: number; intervalDays: number; easeFactor: number; repetitions: number; lastReviewedAt?: number; createdAt: number; updatedAt: number };
export type LibraryWikiArticle = { id: string; title: string; content: string; tags: string[]; createdAt: number; updatedAt: number };
export type LibraryJournalMood = "great" | "good" | "neutral" | "low" | "difficult";
export type LibraryJournalEntry = { id: string; date: string; prompt: string; mood: LibraryJournalMood; content: string; createdAt: number; updatedAt: number };
export type LibraryWritingRevision = { id: string; title: string; outline: string; content: string; createdAt: number };
export type LibraryWritingDraft = { id: string; title: string; outline: string; content: string; revisions: LibraryWritingRevision[]; createdAt: number; updatedAt: number };
export type LibraryResearchSource = { id: string; title: string; url: string; author: string; year: string; citation: string; quote: string; notes: string; tags: string[]; createdAt: number; updatedAt: number };
export type LibraryMediaKind = "book" | "film" | "game" | "podcast" | "article" | "other";
export type LibraryMediaStatus = "want" | "inProgress" | "complete";
export type LibraryMediaEntry = { id: string; title: string; kind: LibraryMediaKind; status: LibraryMediaStatus; rating?: number; notes: string; startedAt?: string; completedAt?: string; createdAt: number; updatedAt: number };
/** Version 8 storage payload retained for backward compatibility. Legacy notes stay opaque to the Canvas editor. */
export type PersonalLibraryData = {
  quickNotes: LegacyLibraryNote[];
  studyNotes: LegacyLibraryNote[];
  studyCards: LibraryStudyCard[];
  wikiArticles: LibraryWikiArticle[];
  journalEntries: LibraryJournalEntry[];
  writingDrafts: LibraryWritingDraft[];
  researchSources: LibraryResearchSource[];
  mediaEntries: LibraryMediaEntry[];
};
export type WindowsSyncMetadata = { version: 1; updatedAt: number; deviceId: string; clocks: Record<string, number>; tombstones: Record<string, number> };
export const SKETCH_FORMAT_VERSION = 3 as const;
/** Clipboard payloads retain their separate v10 protocol while files move to v3. */
export const SKETCH_CLIPBOARD_VERSION = 10 as const;
export type SketchFileDocumentV3 = { format: "SketchDraw"; version: typeof SKETCH_FORMAT_VERSION; canvas: { activePageId: string; pages: SketchPage[]; componentMasters?: ComponentMaster[] }; windowsSync?: WindowsSyncMetadata };
/** In-memory snapshot. `library` is retained only while importing legacy v9 data. */
export type SketchFile = { format: "SketchDraw"; version: typeof SKETCH_FORMAT_VERSION; activePageId: string; pages: SketchPage[]; library?: PersonalLibraryData; windowsSync?: WindowsSyncMetadata };
export type Preview = { type: Exclude<Tool, "select" | "pan" | "laser" | "text" | "bucket" | "eraser" | "crop">; start: Point; end: Point; color: string; thickness: number; opacity?: number; flowchartShape?: FlowchartShape; lineRoute?: LineRoute; arrowRoute?: ArrowRoute; alignmentGuide?: { axis: "x" | "y"; coordinate: number } };
export type Bounds = { x: number; y: number; w: number; h: number };
export type CanvasSnapTarget = { coordinate: number; bounds: Bounds; anchor: 0 | 1 | 2 };
export type SnapGuideLine = { coordinate: number; moving: Bounds; reference: Bounds };
export type CanvasSnapGuides = { x?: SnapGuideLine; y?: SnapGuideLine };
export type TextDraft = { x: number; y: number; value: string; editingIndex?: number; editingChildId?: string; shapeLabel?: boolean; shapeLabelIndex?: number; width?: number; height?: number; verticalAlign?: "top" | "middle" | "bottom"; rotation?: number; color: string; opacity: number; fontSize: number; fontFamily: FontFamily; bold: boolean; italic: boolean; underline: boolean; textAlign: "left" | "center" | "right" | "justify"; listType: "none" | "bullet" | "number" };
export type Theme = "light" | "dark";

export type Binding = { elementId: string; anchor: Point; rowId?: string; portId?: string };
export type ShapeLabel = Omit<TextElement, keyof LayerFlags | "type" | "x" | "y"> & { verticalAlign: "top" | "middle" | "bottom"; offsetX?: number; offsetY?: number; routePosition?: number };
