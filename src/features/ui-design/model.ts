export const UI_DESIGN_FORMAT = "SketchDrawUIDesign" as const;
export const UI_DESIGN_VERSION = 1 as const;
export const UI_DESIGN_MAX_BYTES = 20 * 1024 * 1024;
export const UI_DESIGN_MAX_ARTBOARDS = 250;
export const UI_DESIGN_MAX_NODES = 10_000;

export type UIDesignNodeKind = "text" | "button" | "input" | "checkbox" | "card" | "image";

export type UIDesignNode = {
  id: string;
  kind: UIDesignNodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  background: string;
  foreground: string;
  border: string;
  fontSize: number;
  radius: number;
};

export type UIArtboard = {
  id: string;
  name: string;
  width: number;
  height: number;
  background: string;
  layoutGrid: { visible: boolean; snap: boolean; columns: number; gutter: number; margin: number };
  nodes: UIDesignNode[];
};

export type UIPage = { id: string; name: string; artboards: UIArtboard[] };

export type UIDesignDocument = {
  format: typeof UI_DESIGN_FORMAT;
  version: typeof UI_DESIGN_VERSION;
  name: string;
  activePageId: string;
  activeArtboardId: string;
  pages: UIPage[];
};

const nodeKinds = new Set<UIDesignNodeKind>(["text", "button", "input", "checkbox", "card", "image"]);
const safeColor = /^#[\da-f]{6}$/i;
const finiteNumber = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const safeText = (value: unknown, fallback: string, max = 240) =>
  typeof value === "string" ? value.slice(0, max) : fallback;
const safeId = (value: unknown) => typeof value === "string" && value.length <= 100 && value ? value : crypto.randomUUID();
const safeColorValue = (value: unknown, fallback: string) => typeof value === "string" && safeColor.test(value) ? value : fallback;

export function createUIDesignDocument(name = "Untitled UI design"): UIDesignDocument {
  const pageId = crypto.randomUUID();
  const artboardId = crypto.randomUUID();
  return {
    format: UI_DESIGN_FORMAT,
    version: UI_DESIGN_VERSION,
    name: name.slice(0, 120),
    activePageId: pageId,
    activeArtboardId: artboardId,
    pages: [{
      id: pageId,
      name: "Page 1",
      artboards: [{ id: artboardId, name: "Desktop", width: 1440, height: 900, background: "#ffffff", layoutGrid: { visible: false, snap: false, columns: 12, gutter: 16, margin: 24 }, nodes: [] }],
    }],
  };
}

function normalizeNode(value: unknown): UIDesignNode | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  if (!nodeKinds.has(item.kind as UIDesignNodeKind)) return undefined;
  return {
    id: safeId(item.id),
    kind: item.kind as UIDesignNodeKind,
    x: finiteNumber(item.x, 24, -100_000, 100_000),
    y: finiteNumber(item.y, 24, -100_000, 100_000),
    width: finiteNumber(item.width, 160, 24, 10_000),
    height: finiteNumber(item.height, 48, 24, 10_000),
    text: safeText(item.text, item.kind === "button" ? "Button" : item.kind === "input" ? "Enter text" : "Text"),
    background: safeColorValue(item.background, item.kind === "button" ? "#2563eb" : "#ffffff"),
    foreground: safeColorValue(item.foreground, item.kind === "button" ? "#ffffff" : "#172033"),
    border: safeColorValue(item.border, "#cbd5e1"),
    fontSize: finiteNumber(item.fontSize, 16, 8, 96),
    radius: finiteNumber(item.radius, 8, 0, 100),
  };
}

function normalizeLayoutGrid(value: unknown): UIArtboard["layoutGrid"] {
  const grid = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    visible: grid.visible === true,
    snap: grid.snap === true,
    columns: Math.round(finiteNumber(grid.columns, 12, 1, 24)),
    gutter: Math.round(finiteNumber(grid.gutter, 16, 0, 120)),
    margin: Math.round(finiteNumber(grid.margin, 24, 0, 400)),
  };
}

export function normalizeUIDesignDocument(value: unknown): UIDesignDocument | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const file = value as Record<string, unknown>;
  if (file.format !== UI_DESIGN_FORMAT || file.version !== UI_DESIGN_VERSION || !Array.isArray(file.pages) || !file.pages.length || file.pages.length > 100) return undefined;
  const pages: UIPage[] = [];
  let boardCount = 0;
  let nodeCount = 0;
  const ids = new Set<string>();
  const registerId = (value: unknown) => {
    const id = safeId(value);
    if (ids.has(id)) return undefined;
    ids.add(id);
    return id;
  };
  for (const candidate of file.pages) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return undefined;
    const page = candidate as Record<string, unknown>;
    if (!Array.isArray(page.artboards) || !page.artboards.length) return undefined;
    const artboards: UIArtboard[] = [];
    for (const boardCandidate of page.artboards) {
      if (++boardCount > UI_DESIGN_MAX_ARTBOARDS || !boardCandidate || typeof boardCandidate !== "object" || Array.isArray(boardCandidate)) return undefined;
      const board = boardCandidate as Record<string, unknown>;
      if (!Array.isArray(board.nodes)) return undefined;
      const nodes = board.nodes.map(normalizeNode);
      if (nodes.some(node => !node) || (nodeCount += nodes.length) > UI_DESIGN_MAX_NODES) return undefined;
      const boardId = registerId(board.id);
      if (!boardId) return undefined;
      artboards.push({
        id: boardId,
        name: safeText(board.name, "Artboard", 120),
        width: finiteNumber(board.width, 1440, 120, 10_000),
        height: finiteNumber(board.height, 900, 120, 10_000),
        background: safeColorValue(board.background, "#ffffff"),
        layoutGrid: normalizeLayoutGrid(board.layoutGrid),
        nodes: nodes as UIDesignNode[],
      });
    }
    const pageId = registerId(page.id);
    if (!pageId) return undefined;
    for (const artboard of artboards) {
      for (const node of artboard.nodes) {
        if (ids.has(node.id)) return undefined;
        ids.add(node.id);
      }
    }
    pages.push({ id: pageId, name: safeText(page.name, "Page", 120), artboards });
  }
  const activePageId = pages.some(page => page.id === file.activePageId) ? file.activePageId as string : pages[0].id;
  const activePage = pages.find(page => page.id === activePageId)!;
  const activeArtboardId = activePage.artboards.some(board => board.id === file.activeArtboardId) ? file.activeArtboardId as string : activePage.artboards[0].id;
  return { format: UI_DESIGN_FORMAT, version: UI_DESIGN_VERSION, name: safeText(file.name, "Untitled UI design", 120), activePageId, activeArtboardId, pages };
}

export function parseUIDesignDocument(contents: string): UIDesignDocument {
  if (new TextEncoder().encode(contents).byteLength > UI_DESIGN_MAX_BYTES) throw new Error("This UI Design file is larger than the supported 20 MB limit.");
  const parsed = normalizeUIDesignDocument(JSON.parse(contents) as unknown);
  if (!parsed) throw new Error("The document content does not match the .sdui file format.");
  return parsed;
}

export function serializeUIDesignDocument(document: UIDesignDocument): string {
  const normalized = normalizeUIDesignDocument(document);
  if (!normalized) throw new Error("The UI Design document is invalid and cannot be saved.");
  const contents = JSON.stringify(normalized, null, 2);
  if (new TextEncoder().encode(contents).byteLength > UI_DESIGN_MAX_BYTES) throw new Error("This UI Design file is larger than the supported 20 MB limit.");
  return contents;
}
