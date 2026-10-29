import type { ArrowHead, ArrowRoute, FontFamily, LineRoute, RelationshipType } from "../model";

export const FONT_FAMILY_CHOICES: ReadonlyArray<{ value: FontFamily; label: string }> = [
  { value: "sans", label: "Sans" },
  { value: "hand", label: "Handwritten" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Monospace" },
  { value: "rounded", label: "Rounded" },
  { value: "display", label: "Display" },
];
export type WhiteboardStyle = "plain" | "dots" | "lines" | "small-dots" | "ruled" | "small-grid" | "isometric";
export type DisplayMetrics = { physicalWidth: number; physicalHeight: number; viewportWidth: number; viewportHeight: number };
export const readDisplayMetrics = (): DisplayMetrics => {
  const ratio = window.devicePixelRatio || 1;
  return { physicalWidth: Math.round(window.screen.width * ratio), physicalHeight: Math.round(window.screen.height * ratio), viewportWidth: window.innerWidth, viewportHeight: window.innerHeight };
};

export const GRID_SIZE = 25;
export const TOUCH_DRAG_THRESHOLD = 8;
export const DEFAULT_UI_ACCENT = "#4f46e5";
export const BOARD_COLORS = ["#ffffff", "#fffdf7", "#f4f7fb", "#fbf2ed", "#f1f5ed", "#f3f0fa"];
export const UI_ACCENTS = [
  { label: "Indigo", value: DEFAULT_UI_ACCENT }, { label: "Ocean", value: "#3f78a5" }, { label: "Sage", value: "#547a5b" },
  { label: "Teal", value: "#39877f" }, { label: "Amber", value: "#b47b35" }, { label: "Rose", value: "#ad6475" },
];
export const TOOLBAR_COLORS = [
  { label: "Paper", value: "#f8faf7" }, { label: "Warm", value: "#f4efe4" },
  { label: "Slate", value: "#e8edf2" }, { label: "Sage", value: "#e8efe9" },
  { label: "Night", value: "#171717" },
];
export const BOARD_COLOR_NAMES: Record<string, string> = { "#ffffff": "White", "#fffdf7": "Ivory", "#f4f7fb": "Mist", "#fbf2ed": "Blush", "#f1f5ed": "Sage", "#f3f0fa": "Lilac" };
export const readPreference = (key: string, fallback: string) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
export const readWhiteboardStyle = (): WhiteboardStyle => {
  const stored = readPreference("sketchdraw-whiteboard-style", "dots");
  return stored === "plain" || stored === "lines" || stored === "dots" || stored === "small-dots" || stored === "ruled" || stored === "small-grid" || stored === "isometric" ? stored : "dots";
};
export const THICKNESS_PRESETS = [[1, "Ultra-thin"], [2, "Thin"], [4, "Default"], [5, "Medium"], [10, "Bold"]] as const;
export const ORIGINAL_INSPECTOR_THICKNESS_PRESETS = [[1, "Ultra-thin"], [2, "Thin"], [5, "Medium"], [10, "Bold"]] as const;
export const ERASER_SIZE_PRESETS = [[2, "2px"], [10, "10px"], [24, "24px"]] as const;
export const ARROW_ROUTES: { value: ArrowRoute; label: string; path: string }[] = [
  { value: "straight", label: "Straight", path: "M3 12h17m-6-6 6 6-6 6" }, { value: "elbow", label: "Elbow", path: "M4 5v14h15m-6-6 6 6-6 6" },
  { value: "curve", label: "Curve", path: "M3 18Q12 2 21 18" },
  { value: "forked", label: "Forked", path: "M3 12h8m0 0V5h9m-4-3 4 3-4 3m-5 4v7h9m-4-3 4 3-4 3" },
];
export const LINE_ROUTES: { value: LineRoute; label: string; path: string }[] = [
  { value: "straight", label: "Straight", path: "M4 19 20 5" }, { value: "elbow", label: "Elbow", path: "M4 5v14h15" }, { value: "curve", label: "Curve", path: "M3 18Q12 2 21 18" },
];
export const ARROW_HEADS: { value: ArrowHead; label: string }[] = [
  { value: "none", label: "None" }, { value: "open", label: "Open" }, { value: "solid", label: "Solid" }, { value: "hollow", label: "Hollow triangle" },
  { value: "thick", label: "Thick" }, { value: "dot", label: "Dot" }, { value: "diamond", label: "Diamond" }, { value: "open-diamond", label: "Open diamond" }, { value: "bar", label: "Bar" }, { value: "crow", label: "Crow's foot" },
];
export const RELATIONSHIP_TYPES: { value: RelationshipType; label: string }[] = [
  { value: "association", label: "Association" }, { value: "dependency", label: "Dependency" }, { value: "data-flow", label: "Data flow" },
  { value: "inheritance", label: "Inheritance" }, { value: "aggregation", label: "Aggregation" }, { value: "composition", label: "Composition" },
  { value: "sequence", label: "Sequence" }, { value: "network", label: "Network" }, { value: "other", label: "Other" },
];
