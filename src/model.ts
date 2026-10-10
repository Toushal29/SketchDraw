export type Point = { x: number; y: number };
export type StrokePoint = Point & { pressure?: number; tiltX?: number; tiltY?: number };
export type ArrowHead = "none" | "open" | "solid" | "thick" | "dot" | "diamond" | "bar";
export type FlowchartShape = "process" | "terminator" | "decision" | "data" | "document" | "database" | "predefined-process" | "preparation" | "manual-input" | "connector" | "off-page" | "delay" | "manual-operation" | "stored-data" | "cloud" | "star" | "lightning" | "heart" | "callout" | "gear";
export type ArrowRoute = "straight" | "elbow" | "forked" | "loop" | "jagged";
export type LineRoute = "straight" | "curve" | "curve2" | "curve3" | "multi";
export type StrokeStyle = "solid" | "dashed" | "dotted" | "double";
export type LayerFlags = { id?: string; hidden?: boolean; locked?: boolean; rotation?: number; componentId?: string; componentRole?: string };
export type FontFamily = "sans" | "hand" | "serif" | "mono";
export type EdgeStyle = "sharp" | "rounded" | "pill" | "cut";
export type FreehandElement = LayerFlags & { type: "freehand"; points: StrokePoint[]; color: string; thickness: number; opacity?: number };
export type ForkBranch = { end?: Point; routePoints?: Point[]; endHead?: ArrowHead; endBinding?: Binding };
export type ShapeElement = LayerFlags & { type: "rectangle" | "circle" | "diamond" | "triangle" | "flowchart" | "line" | "arrow"; x: number; y: number; w: number; h: number; color: string; thickness: number; fillColor?: string; fillOpacity?: number; opacity?: number; lineStyle?: StrokeStyle; edgeStyle?: EdgeStyle; cornerRadius?: number; flowchartShape?: FlowchartShape; lineRoute?: LineRoute; arrowRoute?: ArrowRoute; autoRoute?: boolean; routeWaypoints?: Point[]; startHead?: ArrowHead; endHead?: ArrowHead; startBinding?: Binding; endBinding?: Binding; routePoints?: Point[]; forkUpper?: ForkBranch; forkLower?: ForkBranch; label?: ShapeLabel; schemaDiagramId?: string };
export type TextElement = LayerFlags & { type: "text"; x: number; y: number; text: string; color: string; fontSize: number; fontFamily?: FontFamily; bold?: boolean; italic?: boolean; underline?: boolean; textAlign?: "left" | "center" | "right" | "justify"; listType?: "none" | "bullet" | "number"; opacity?: number };
export type ImageElement = LayerFlags & { type: "image"; x: number; y: number; w: number; h: number; dataUrl: string; sourceWidth?: number; sourceHeight?: number; cropX?: number; cropY?: number; cropW?: number; cropH?: number; opacity?: number };
export type SchemaField = { id: string; name: string; dataType: string; primaryKey?: boolean; foreignTable?: string; foreignColumn?: string; nullable?: boolean };
export type SchemaTableElement = LayerFlags & { type: "schemaTable"; x: number; y: number; w: number; h: number; name: string; columns: SchemaField[]; schemaDiagramId: string; schemaSource: string; fontSize?: number; opacity?: number };
export type NoteKind = "note" | "sticky" | "checklist";
export type NoteMetadata = { kind: NoteKind; content: string; title?: string; width?: number; height?: number; fontSize?: number; collapsed?: boolean };
export type MermaidMetadata = { source: string };
export type GroupElement = LayerFlags & { type: "group"; elements: Element[]; note?: NoteMetadata; mermaid?: MermaidMetadata };
export type Element = FreehandElement | ShapeElement | TextElement | ImageElement | SchemaTableElement | GroupElement;
export type Tool = "select" | "pan" | "pen" | "laser" | "rectangle" | "circle" | "diamond" | "triangle" | "flowchart" | "line" | "arrow" | "text" | "bucket" | "eraser" | "crop";
export type CanvasState = { zoom: number; panX: number; panY: number; backgroundColor: string; boardColorFollowsTheme?: boolean };
export type SketchPage = { id: string; name: string; canvasState: CanvasState; elements: Element[] };
export type ProjectNote = { id: string; title: string; content: string; createdAt: number; updatedAt: number };
export type ProjectTaskStatus = "backlog" | "inProgress" | "done";
export type ProjectTaskPriority = "low" | "medium" | "high";
export type ProjectTask = { id: string; title: string; description: string; status: ProjectTaskStatus; priority: ProjectTaskPriority; startDate?: string; dueDate?: string; dependsOn?: string[]; createdAt: number; updatedAt: number };
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
/** Version 8 storage payload retained for backward compatibility. Notebook edits quickNotes. */
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
  milestones: ProjectMilestone[];
  logEntries: ProjectLogEntry[];
  files: ProjectFileEntry[];
};
/** The v8 `library` section is kept intact while its former screens are retired. */
export type SketchDocumentSections = { canvas: { activePageId: string; pages: SketchPage[] }; planning: ProjectWorkspaceData; library: PersonalLibraryData };
export const SKETCH_FORMAT_VERSION = 8 as const;
export type WindowsSyncMetadata = { version: 1; updatedAt: number; deviceId: string; clocks: Record<string, number>; tombstones: Record<string, number> };
export type SketchFileDocumentV8 = { format: "SketchDraw"; version: typeof SKETCH_FORMAT_VERSION; sections: SketchDocumentSections; windowsSync?: WindowsSyncMetadata };
/** In-memory shape. Version 8 files serialize the three areas under `sections`. */
export type SketchFile = { format: "SketchDraw"; version: typeof SKETCH_FORMAT_VERSION; activePageId: string; pages: SketchPage[]; project?: ProjectWorkspaceData; library?: PersonalLibraryData; windowsSync?: WindowsSyncMetadata };
export type Preview = { type: Exclude<Tool, "select" | "pan" | "laser" | "text" | "bucket" | "eraser" | "crop">; start: Point; end: Point; color: string; thickness: number; opacity?: number; flowchartShape?: FlowchartShape; lineRoute?: LineRoute; arrowRoute?: ArrowRoute };
export type Bounds = { x: number; y: number; w: number; h: number };
export type TextDraft = { x: number; y: number; value: string; editingIndex?: number; shapeLabel?: boolean; width?: number; height?: number; verticalAlign?: "top" | "middle" | "bottom"; rotation?: number; color: string; opacity: number; fontSize: number; fontFamily: FontFamily; bold: boolean; italic: boolean; underline: boolean; textAlign: "left" | "center" | "right" | "justify"; listType: "none" | "bullet" | "number" };
export type Theme = "light" | "dark";
export type ThemeMode = Theme | "system";

export type Binding = { elementId: string; anchor: Point; rowId?: string };
export type ShapeLabel = Omit<TextElement, keyof LayerFlags | "type" | "x" | "y"> & { verticalAlign: "top" | "middle" | "bottom" };
