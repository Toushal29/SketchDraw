import type { ToolbarItem } from "../../model";
import { ARROW_HEADS, ARROW_ROUTES, FONT_FAMILY_CHOICES, LINE_ROUTES } from "../../app/canvas-options";
import { BASIC_SHAPES, FLOWCHART_SHAPES, GENERAL_SHAPES, type BasicShapeTool } from "../../features/shapes/shape-catalog";

/**
 * Windows toolbar inventory and the properties each tool can expose.
 */
export type ToolPropertyId =
  | "selectionMode" | "brush" | "strokeColor" | "strokeWidth" | "opacity"
  | "pressureWidth" | "tiltShaping" | "stylusEraserEnd" | "eraserSize"
  | "laserColor" | "laserWidth" | "laserFade" | "laserRainbow"
  | "lineStyle" | "lineRoute" | "arrowRoute" | "arrowHeads"
  | "fillColor" | "fillOpacity" | "cornerStyle" | "cornerRadius"
  | "shape" | "fontSize" | "fontFamily" | "bold" | "italic"
  | "underline" | "textAlign" | "listType";

type ToolProperty = {
  label: string;
  control: "color" | "number" | "toggle" | "choices";
  choices?: readonly string[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
};

export const WINDOWS_TOOL_PROPERTIES = {
  selectionMode: { label: "Selection mode", control: "choices", choices: ["Box", "Lasso"] },
  brush: { label: "Brush", control: "choices", choices: ["Fine pen", "Pencil", "Soft brush", "Marker", "Highlighter", "Chalk"] },
  strokeColor: { label: "Stroke and text color", control: "color" },
  strokeWidth: { label: "Stroke width", control: "number", min: 1, max: 24, step: 1, unit: "px" },
  opacity: { label: "Opacity", control: "number", min: 0, max: 100, step: 1, unit: "%" },
  pressureWidth: { label: "Pressure width", control: "toggle" },
  tiltShaping: { label: "Tilt shaping", control: "toggle" },
  stylusEraserEnd: { label: "Stylus eraser end", control: "toggle" },
  eraserSize: { label: "Eraser size", control: "choices", choices: ["2 px", "10 px", "24 px"] },
  laserColor: { label: "Laser color", control: "color" },
  laserWidth: { label: "Laser thickness", control: "number", min: 1, max: 24, step: 1, unit: "px" },
  laserFade: { label: "Fade duration", control: "number", min: 250, max: 5000, step: 250, unit: "ms" },
  laserRainbow: { label: "Rainbow color", control: "toggle" },
  lineStyle: { label: "Line style", control: "choices", choices: ["Solid", "Dashed", "Dotted", "Double"] },
  lineRoute: { label: "Line route", control: "choices", choices: LINE_ROUTES.map(item => item.label) },
  arrowRoute: { label: "Arrow route", control: "choices", choices: ARROW_ROUTES.map(item => item.label) },
  arrowHeads: { label: "Start and end heads", control: "choices", choices: ARROW_HEADS.map(item => item.label) },
  fillColor: { label: "Fill color", control: "color" },
  fillOpacity: { label: "Fill opacity", control: "number", min: 5, max: 100, step: 1, unit: "%" },
  cornerStyle: { label: "Corner style", control: "choices", choices: ["Sharp", "Rounded", "Pill", "Cut"] },
  cornerRadius: { label: "Corner radius", control: "number", min: 0, max: 64, step: 1, unit: "px" },
  shape: { label: "Shape", control: "choices", choices: [...BASIC_SHAPES, ...FLOWCHART_SHAPES, ...GENERAL_SHAPES].map(item => item.label) },
  fontSize: { label: "Font size", control: "number", min: 8, max: 160, step: 1, unit: "px" },
  fontFamily: { label: "Font family", control: "choices", choices: FONT_FAMILY_CHOICES.map(item => item.label) },
  bold: { label: "Bold", control: "toggle" },
  italic: { label: "Italic", control: "toggle" },
  underline: { label: "Underline", control: "toggle" },
  textAlign: { label: "Text alignment", control: "choices", choices: ["Left", "Center", "Right"] },
  listType: { label: "Paragraph style", control: "choices", choices: ["Plain", "Bullets", "Numbers"] },
} as const satisfies Record<ToolPropertyId, ToolProperty>;

export const WINDOWS_BRUSH_VARIANTS = [
  { id: "fine", label: "Pen", iconPath: "m5 19 13-14M4 21h16" },
  { id: "pencil", label: "Pencil", iconPath: "m5 19 11-11 3 3L8 22H5zm10-13 2-2 4 4-2 2" },
  { id: "brush", label: "Soft brush", iconPath: "M5 18c4 0 3-8 8-8 4 0 4 4 7 4m-15 4h14M15 5l3 3" },
  { id: "marker", label: "Marker", iconPath: "M5 18 17 6l3 3L8 21H5zm9-9 3 3" },
  { id: "highlighter", label: "Highlighter", iconPath: "M4 16 15 5l5 5-11 11H4zm4-2 5 5" },
  { id: "chalk", label: "Chalk", iconPath: "M5 18 17 6m-8 12 2 2M4 21h16" },
] as const;

export type WindowsToolDefinition = {
  label: string;
  group: "navigation" | "ink" | "connectors" | "shapes" | "content" | "components" | "precision";
  kind: "tool" | "mode" | "action" | "panel";
  defaultPlacement: "toolbar" | "more" | "shapePalette";
  iconPath: string;
  shortcut?: string;
  properties: readonly ToolPropertyId[];
  contextualProperties?: boolean;
  requiresSelection?: boolean;
  canTransfer?: boolean;
};

const shapeIcon = (tool: BasicShapeTool) => BASIC_SHAPES.find(shape => shape.value === tool)!.path;
const inkProperties = ["brush", "strokeColor", "strokeWidth", "opacity", "pressureWidth", "tiltShaping", "stylusEraserEnd"] as const;
const shapeProperties = ["strokeColor", "strokeWidth", "opacity", "fillColor", "fillOpacity", "lineStyle"] as const;
const connectorProperties = ["strokeColor", "strokeWidth", "opacity", "lineStyle", "arrowHeads"] as const;

/** Includes every ToolbarItem, including Triangle in the Shapes palette. */
export const WINDOWS_TOOL_CATALOG = {
  select: { label: "Select", group: "navigation", kind: "tool", defaultPlacement: "toolbar", iconPath: "M5 3l14 11-7 .8-3 6z", shortcut: "V", properties: ["selectionMode", "strokeColor", "strokeWidth", "opacity", "fillColor", "fillOpacity", "lineStyle", "lineRoute", "arrowRoute", "arrowHeads", "cornerStyle", "cornerRadius", "fontSize", "fontFamily", "bold", "italic", "underline", "textAlign", "listType"], contextualProperties: true },
  lasso: { label: "Lasso select", group: "navigation", kind: "mode", defaultPlacement: "toolbar", iconPath: "M12 4c-4.4 0-8 2.2-8 5s3.6 5 8 5c.9 0 1.7-.1 2.5-.3M20 9c0 1.6-1.2 3-3 4M12 14l-1 3.5c-.3 1.2.4 2.5 1.5 3", properties: ["selectionMode"] },
  pan: { label: "Hand / Pan", group: "navigation", kind: "tool", defaultPlacement: "toolbar", iconPath: "M8 11V5a1.5 1.5 0 0 1 3 0v5-6a1.5 1.5 0 0 1 3 0v6-5a1.5 1.5 0 0 1 3 0v7-3a1.5 1.5 0 0 1 3 0v5c0 5-3 8-8 8h-1c-3 0-5-2-6-4l-2-4a1.5 1.5 0 0 1 2.5-1.5L8 15", shortcut: "Space", properties: [] },
  pen: { label: "Pen", group: "ink", kind: "tool", defaultPlacement: "toolbar", iconPath: "M4 20l4.5-1 10.8-10.8a2.2 2.2 0 0 0-3.1-3.1L5.4 15.9 4 20zM14.8 6.3l3 3", shortcut: "P", properties: inkProperties },
  paintBrushes: { label: "Brushes", group: "ink", kind: "mode", defaultPlacement: "toolbar", iconPath: "M5 18c4 0 3-8 8-8 4 0 4 4 7 4m-15 4h14M15 5l3 3", properties: inkProperties },
  eraser: { label: "Eraser", group: "ink", kind: "tool", defaultPlacement: "toolbar", iconPath: "M3 14l9-10 9 9-8 8H7zM12 18l5-5", shortcut: "E", properties: ["eraserSize"] },
  laser: { label: "Laser pointer", group: "ink", kind: "tool", defaultPlacement: "toolbar", iconPath: "M5 19 17 7m-8 0 8 0 0 8M5 5l1 1M19 19l-1-1", shortcut: "Y", properties: ["laserColor", "laserWidth", "laserFade", "laserRainbow"] },
  line: { label: "Line", group: "connectors", kind: "tool", defaultPlacement: "toolbar", iconPath: "M4 20L20 4", shortcut: "L", properties: [...connectorProperties, "lineRoute"] },
  arrow: { label: "Arrow", group: "connectors", kind: "tool", defaultPlacement: "toolbar", iconPath: "M4 20 20 4m-11 0h11v11", shortcut: "A", properties: [...connectorProperties, "arrowRoute"] },
  rectangle: { label: "Rectangle", group: "shapes", kind: "tool", defaultPlacement: "toolbar", iconPath: shapeIcon("rectangle"), shortcut: "R", properties: [...shapeProperties, "cornerStyle", "cornerRadius"] },
  circle: { label: "Circle", group: "shapes", kind: "tool", defaultPlacement: "toolbar", iconPath: shapeIcon("circle"), shortcut: "C", properties: shapeProperties },
  diamond: { label: "Diamond", group: "shapes", kind: "tool", defaultPlacement: "toolbar", iconPath: shapeIcon("diamond"), shortcut: "D", properties: shapeProperties },
  triangle: { label: "Triangle", group: "shapes", kind: "tool", defaultPlacement: "shapePalette", iconPath: shapeIcon("triangle"), shortcut: "N", properties: shapeProperties },
  flowchart: { label: "Flowchart shapes", group: "shapes", kind: "tool", defaultPlacement: "toolbar", iconPath: "M4 4h6v6H4zM14 4h6v6h-6zM9 14l4 0 3 3-3 3H9l-3-3z", shortcut: "F", properties: [...shapeProperties, "shape"] },
  text: { label: "Text", group: "content", kind: "tool", defaultPlacement: "toolbar", iconPath: "M5 6h14M12 6v13M8 19h8", shortcut: "T", properties: ["strokeColor", "opacity", "fontSize", "fontFamily", "bold", "italic", "underline", "textAlign", "listType"] },
  image: { label: "Image", group: "content", kind: "action", defaultPlacement: "toolbar", iconPath: "M4 5h16v14H4zM8 14l3-3 5 5m-4-2 2-2 4 4M9 9h.01", properties: [] },
  componentLibrary: { label: "Components", group: "components", kind: "panel", defaultPlacement: "toolbar", iconPath: "M3 4h8v8H3zM14 4h7v6h-7zM3 15h8v5H3zM14 13h7v7h-7z", properties: [] },
  bucket: { label: "Fill bucket", group: "content", kind: "tool", defaultPlacement: "more", iconPath: "M4 14l6-6 8 8-6 6H4zM10 8l3-3 8 8-3 3M18 19h.01", shortcut: "B", properties: ["fillColor"] },
  crop: { label: "Crop image", group: "content", kind: "tool", defaultPlacement: "more", iconPath: "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 8h8v8H8z", shortcut: "X", properties: [] },
  measure: { label: "Measure distance", group: "precision", kind: "mode", defaultPlacement: "more", iconPath: "M4 19 19 4l2 2L6 21H4zM8 15l2 2m1-5 2 2m1-5 2 2", shortcut: "M", properties: [] },
  codeData: { label: "Code & data", group: "precision", kind: "panel", defaultPlacement: "toolbar", iconPath: "M3 4h8v7H3zM13 4h8v7h-8zM3 13h8v7H3zM13 13h8v7h-8z", properties: [] },
  pathEdit: { label: "Edit selected path nodes", group: "precision", kind: "mode", defaultPlacement: "toolbar", iconPath: "M5 5v14h14M5 5l14 14M5 12h7m0-7v7", properties: [], requiresSelection: true },
  frame: { label: "Create frame from selection", group: "precision", kind: "action", defaultPlacement: "toolbar", iconPath: "M3 4h18v16H3zM7 8h10v8H7z", properties: [], requiresSelection: true },
} as const satisfies Record<ToolbarItem, WindowsToolDefinition>;
