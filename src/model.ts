export type Point = { x: number; y: number };
export type StrokePoint = Point & { pressure?: number; tiltX?: number; tiltY?: number; orientation?: number };
export type ArrowHead = "none" | "open" | "solid" | "hollow" | "thick" | "dot" | "diamond" | "open-diamond" | "bar" | "crow";
export type FlowchartShape = "process" | "terminator" | "decision" | "data" | "document" | "multi-document" | "database" | "predefined-process" | "internal-storage" | "preparation" | "manual-input" | "manual-operation" | "connector" | "off-page" | "delay" | "stored-data" | "display" | "merge" | "extract" | "collate" | "sort" | "summing-junction" | "or" | "loop-limit" | "loop-start" | "loop-end" | "alternate-process" | "card" | "punched-tape" | "sequential-data" | "direct-data" | "cloud" | "star" | "lightning" | "heart" | "callout" | "gear" | "hexagon" | "parallelogram" | "trapezoid" | "pentagon" | "octagon" | "chevron" | "cross" | "folder" | "note" | "cube" | "rounded-rectangle" | "shield";
export type ArrowRoute = "straight" | "elbow" | "curve" | "forked" | "loop" | "jagged";
export type LineRoute = "straight" | "elbow" | "curve";
export type StrokeStyle = "solid" | "dashed" | "dotted" | "double";
export type StrideThreatCategory = "spoofing" | "tampering" | "repudiation" | "information-disclosure" | "denial-of-service" | "elevation-of-privilege";
export type ArchitectureMetadata = { serviceKey?: string; owner?: string; criticality?: "low" | "medium" | "high" | "critical"; slo?: string; runbook?: string; environment?: string; region?: string; availabilityZone?: string; subnet?: string; cidr?: string; ipAddress?: string };
export type LayerFlags = { id?: string; hidden?: boolean; locked?: boolean; rotation?: number; aspectLocked?: boolean; layerId?: string; layerName?: string; componentId?: string; componentRole?: string; catalogId?: string; pageLinkId?: string; pageLinkTransition?: PageLinkTransition; masterElementId?: string; strideThreats?: StrideThreatCategory[]; architecture?: ArchitectureMetadata };
export type FontFamily = "sans" | "hand" | "serif" | "mono" | "rounded" | "display";
export type PageLinkTransition = "instant" | "fade" | "slide";
export type EdgeStyle = "sharp" | "rounded" | "pill" | "cut";
export type FreehandElement = LayerFlags & { type: "freehand"; points: StrokePoint[]; color: string; thickness: number; opacity?: number };
export type ConnectionPoint = { id: string; name: string; anchor: Point; accepts?: RelationshipType[] };
export type ContainerMetadata = { kind: "frame" | "container" | "swimlane"; name: string; background?: string; showBorder?: boolean; showLabel?: boolean; borderColor?: string; borderThickness?: number; borderStyle?: StrokeStyle; clipChildren?: boolean; autoResize?: boolean; lockedSize?: boolean; padding?: number; connectionPoints?: ConnectionPoint[] };
export type CanvasLayer = { id: string; name: string; parentId?: string; hidden?: boolean; locked?: boolean; order: number };
export type ForkBranch = { end?: Point; routePoints?: Point[]; endHead?: ArrowHead; endBinding?: Binding };
export type RelationshipType = "association" | "dependency" | "data-flow" | "inheritance" | "aggregation" | "composition" | "sequence" | "network" | "other";
export type RelationshipDirection = "forward" | "both" | "none";
export type TransportSecurity = "encrypted" | "unencrypted" | "unknown";
export type ShapeElement = LayerFlags & { type: "rectangle" | "circle" | "diamond" | "triangle" | "flowchart" | "line" | "arrow" | "svgPath"; x: number; y: number; w: number; h: number; color: string; thickness: number; fillColor?: string; fillOpacity?: number; opacity?: number; lineStyle?: StrokeStyle; edgeStyle?: EdgeStyle; cornerRadius?: number; flowchartShape?: FlowchartShape; pathData?: string; pathWidth?: number; pathHeight?: number; fillRule?: "nonzero" | "evenodd"; svgStroke?: boolean; svgNonScalingStroke?: boolean; connectionPoints?: ConnectionPoint[]; lineRoute?: LineRoute; arrowRoute?: ArrowRoute; autoRoute?: boolean; straightOnly?: boolean; routeWaypoints?: Point[]; startHead?: ArrowHead; endHead?: ArrowHead; startBinding?: Binding; endBinding?: Binding; routePoints?: Point[]; forkUpper?: ForkBranch; forkLower?: ForkBranch; label?: ShapeLabel; schemaDiagramId?: string; relationshipType?: RelationshipType; cardinality?: string; relationshipDirection?: RelationshipDirection; transportSecurity?: TransportSecurity; protocol?: string; portNumber?: number; apiContract?: string; dataContract?: string; sequenceCondition?: string; sequenceDefault?: boolean };
export type TextElement = LayerFlags & { type: "text"; x: number; y: number; text: string; color: string; fontSize: number; fontFamily?: FontFamily; bold?: boolean; italic?: boolean; underline?: boolean; textAlign?: "left" | "center" | "right" | "justify"; listType?: "none" | "bullet" | "number"; opacity?: number };
export type ImageElement = LayerFlags & { type: "image"; x: number; y: number; w: number; h: number; dataUrl: string; sourceWidth?: number; sourceHeight?: number; cropX?: number; cropY?: number; cropW?: number; cropH?: number; opacity?: number; previewUrl?: string };
export type SchemaField = { id: string; name: string; dataType: string; primaryKey?: boolean; foreignTable?: string; foreignColumn?: string; nullable?: boolean };
export type SchemaIndex = { name: string; columns: string[]; unique?: boolean; expression?: string };
export type SchemaConstraint = { name?: string; kind: "unique" | "check" | "foreign-key" | "primary-key"; columns?: string[]; expression?: string; referencedTable?: string; referencedColumns?: string[] };
export type SchemaTableElement = LayerFlags & { type: "schemaTable"; x: number; y: number; w: number; h: number; name: string; columns: SchemaField[]; indexes?: SchemaIndex[]; constraints?: SchemaConstraint[]; schemaDiagramId: string; schemaSource: string; fontSize?: number; opacity?: number };
export type NoteKind = "note" | "sticky" | "checklist";
export type NoteMetadata = { kind: NoteKind; content: string; title?: string; width?: number; height?: number; fontSize?: number; collapsed?: boolean };
export type MermaidMetadata = { source: string; format?: "mermaid" | "plantuml" };
export type LibraryChartKind = "viz-bar" | "viz-horizontal-bar" | "viz-stacked-bar" | "viz-line" | "viz-area" | "viz-scatter" | "viz-pie" | "viz-donut" | "viz-radar" | "viz-gauge" | "viz-funnel" | "viz-heatmap" | "viz-treemap" | "viz-kpi";
export type LibraryChartSeries = { name: string; values: number[]; chartType?: "bar" | "line" | "area" | "scatter"; axis?: "primary" | "secondary" };
export type LibraryChartAnnotation = { index: number; label: string; value?: number; axis?: "primary" | "secondary" };
export type LibraryChartData = {
  labels: string[]; values: number[]; title?: string; xAxisLabel?: string; yAxisLabel?: string; secondaryYAxisLabel?: string;
  series?: LibraryChartSeries[];
  annotations?: LibraryChartAnnotation[];
  options?: { palette?: "blue" | "ocean" | "warm" | "violet" | "mono"; legend?: "right" | "bottom" | "hidden"; showGrid?: boolean; showValues?: boolean; smooth?: boolean; maxValue?: number; pointSize?: number; lineWidth?: number };
};
export type GuiComponentProperties = {
  title?: string;
  titlePosition?: "top" | "bottom" | "left" | "right";
  placeholder?: string;
  optionLayout?: "vertical" | "horizontal" | "grid";
  optionColumns?: number;
  optionGap?: number;
  optionRowGap?: number;
  optionColumnGap?: number;
  bodyText?: string;
  actionLabel?: string;
  items?: string[];
  activeItem?: number;
};
export type LibraryComponentFieldValue = { key: string; label: string; value: string };
export type LibraryComponentData = { kind: string; label?: string; componentFields?: LibraryComponentFieldValue[]; portCount?: number; connectionPoints?: ConnectionPoint[]; laneCount?: number; durationMinutes?: number; renderStyle?: "clean"; iconSvg?: string; iconViewBox?: string; formTitle?: string; formState?: boolean; formStates?: boolean[]; selectedOption?: number; formOptions?: string[]; guiProperties?: GuiComponentProperties; chartData?: LibraryChartData; trendDirection?: "up" | "down" | "steady"; appearance?: "modern" | "simple"; styleOverrides?: { color?: string; fillColor?: string | null; fillOpacity?: number }; textStyle?: { color?: string; fontSize?: number; fontFamily?: FontFamily; bold?: boolean; italic?: boolean; underline?: boolean; textAlign?: "left" | "center" | "right" | "justify" } };
export type ComponentOverrides = { label?: string; color?: string; fillColor?: string | null; fillOpacity?: number; chartData?: LibraryChartData; formOptions?: string[]; portLabels?: Record<string, string> };
export type ComponentMaster = { id: string; name: string; template: Element[]; bounds: Bounds; variants?: Record<string, Element[]>; variantKey?: string; connectionPoints?: ConnectionPoint[]; createdAt?: number };
export type StencilParameterData = { template: Element[]; parameters: string[]; values: Record<string, string> };
export type GroupElement = LayerFlags & { type: "group"; elements: Element[]; componentBounds?: Bounds; container?: ContainerMetadata; note?: NoteMetadata; mermaid?: MermaidMetadata; libraryComponent?: LibraryComponentData; masterId?: string; componentOverrides?: ComponentOverrides; variantKey?: string; connectionPoints?: ConnectionPoint[]; stencilParameters?: StencilParameterData };
export type Element = FreehandElement | ShapeElement | TextElement | ImageElement | SchemaTableElement | GroupElement;
export type Tool = "select" | "pan" | "pen" | "laser" | "rectangle" | "circle" | "diamond" | "triangle" | "flowchart" | "line" | "arrow" | "text" | "bucket" | "eraser" | "crop";
export type ToolbarItem = Tool | "paintBrushes" | "measure" | "pathEdit" | "frame" | "codeData" | "moreTools";
// Retained only to round-trip this legacy .sketch field; the editor no longer exposes or applies guides.
export type CanvasGuide = { axis: "x" | "y"; position: number };
export type CanvasState = { zoom: number; panX: number; panY: number; backgroundColor: string; boardColorFollowsTheme?: boolean; guides?: CanvasGuide[] };
export type SketchPage = { id: string; name: string; canvasState: CanvasState; elements: Element[]; layers?: CanvasLayer[]; componentMasters?: ComponentMaster[] };
export type ProjectNote = { id: string; title: string; content: string; createdAt: number; updatedAt: number };
export type ProjectTaskStatus = string;
export type ProjectWorkflowColumn = { id: string; label: string; completed?: boolean };
export type ProjectTaskPriority = "low" | "medium" | "high";
export type ProjectChecklistItem = { id: string; text: string; done: boolean };
/** Legacy alias retained so older planning payloads can be migrated on read. */
export type ProjectTaskChecklistItem = ProjectChecklistItem;
export type ProjectTask = { id: string; title: string; description: string; status: ProjectTaskStatus; priority: ProjectTaskPriority; startDate?: string; dueDate?: string; baselineStartDate?: string; baselineDueDate?: string; estimateMinutes?: number; recurrence?: "daily" | "weekly" | "monthly"; dependsOn?: string[]; checklist?: ProjectTaskChecklistItem[]; createdAt: number; updatedAt: number };
export type ProjectMilestone = { id: string; title: string; description: string; date: string; completed: boolean; createdAt: number; updatedAt: number };
export type ProjectLogKind = "decision" | "question" | "risk";
export type ProjectLogEntry = { id: string; kind: ProjectLogKind; title: string; details: string; owner: string; nextStep: string; riskLevel?: ProjectTaskPriority; resolved: boolean; createdAt: number; updatedAt: number };
export type ProjectFileEntry =
  | { id: string; kind: "attachment"; name: string; mimeType: string; dataUrl: string; size: number; createdAt: number }
  | { id: string; kind: "link"; name: string; url: string; createdAt: number };
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
/** Version 8 storage payload retained for backward compatibility. Retired quick notes are imported into Planning. */
export type PersonalLibraryData = {
  quickNotes: ProjectNote[];
  studyNotes: ProjectNote[];
  studyCards: LibraryStudyCard[];
  wikiArticles: LibraryWikiArticle[];
  journalEntries: LibraryJournalEntry[];
  writingDrafts: LibraryWritingDraft[];
  researchSources: LibraryResearchSource[];
  mediaEntries: LibraryMediaEntry[];
};
export type ProjectWorkspaceData = {
  name: string;
  description: string;
  notes: ProjectNote[];
  tasks: ProjectTask[];
  workflowColumns?: ProjectWorkflowColumn[];
  workingDays?: number[];
  checklist: ProjectChecklistItem[];
  milestones: ProjectMilestone[];
  logEntries: ProjectLogEntry[];
  files: ProjectFileEntry[];
};
export type SketchDrawPlanningFile = { format: "SketchDrawPlanning"; version: 1; project: ProjectWorkspaceData };
/** V8 library records remain in memory for round-trip compatibility. */
export type SketchDocumentSectionsV8 = { canvas: { activePageId: string; pages: SketchPage[] }; planning: ProjectWorkspaceData; library: PersonalLibraryData };
export type WindowsSyncMetadata = { version: 1; updatedAt: number; deviceId: string; clocks: Record<string, number>; tombstones: Record<string, number> };
export type SketchFileDocumentV8 = { format: "SketchDraw"; version: 8; sections: SketchDocumentSectionsV8; windowsSync?: WindowsSyncMetadata };
export type SketchDocumentSectionsV9 = {
  canvas: { activePageId: string; pages: SketchPage[] };
  notebook: { notes: ProjectNote[] };
  retiredLibraryArchive: Omit<PersonalLibraryData, "quickNotes">;
};
export type SketchDocumentSectionsV10 = { canvas: { activePageId: string; pages: SketchPage[]; componentMasters?: ComponentMaster[] } };
export const SKETCH_FORMAT_VERSION = 10 as const;
export type SketchFileDocumentV9 = { format: "SketchDraw"; version: 9; sections: SketchDocumentSectionsV9; windowsSync?: WindowsSyncMetadata };
export type SketchFileDocumentV10 = { format: "SketchDraw"; version: typeof SKETCH_FORMAT_VERSION; sections: SketchDocumentSectionsV10; windowsSync?: WindowsSyncMetadata };
/** In-memory shape. `project` is read only from older sketch files for migration. */
export type SketchFile = { format: "SketchDraw"; version: typeof SKETCH_FORMAT_VERSION; activePageId: string; pages: SketchPage[]; project?: ProjectWorkspaceData; library?: PersonalLibraryData; windowsSync?: WindowsSyncMetadata };
export type Preview = { type: Exclude<Tool, "select" | "pan" | "laser" | "text" | "bucket" | "eraser" | "crop">; start: Point; end: Point; color: string; thickness: number; opacity?: number; flowchartShape?: FlowchartShape; lineRoute?: LineRoute; arrowRoute?: ArrowRoute };
export type Bounds = { x: number; y: number; w: number; h: number };
export type TextDraft = { x: number; y: number; value: string; editingIndex?: number; editingChildId?: string; shapeLabel?: boolean; width?: number; height?: number; verticalAlign?: "top" | "middle" | "bottom"; rotation?: number; color: string; opacity: number; fontSize: number; fontFamily: FontFamily; bold: boolean; italic: boolean; underline: boolean; textAlign: "left" | "center" | "right" | "justify"; listType: "none" | "bullet" | "number" };
export type Theme = "light" | "dark";
export type ThemeMode = Theme | "system";

export type Binding = { elementId: string; anchor: Point; rowId?: string; portId?: string };
export type ShapeLabel = Omit<TextElement, keyof LayerFlags | "type" | "x" | "y"> & { verticalAlign: "top" | "middle" | "bottom"; offsetX?: number; offsetY?: number };
