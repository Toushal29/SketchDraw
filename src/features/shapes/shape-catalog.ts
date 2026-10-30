import type { FlowchartShape, ShapeElement, Tool } from "../../model";
import { shapePathData } from "./geometry";

export type ShapeDefinition = { value: FlowchartShape; label: string; path: string };
export type BasicShapeTool = Extract<Tool, "rectangle" | "circle" | "diamond" | "triangle">;
export type BasicShapeDefinition = { value: BasicShapeTool; label: string; path: string };

// Palette icons come from the same proportional geometry used by the canvas,
// hit testing and export. The catalog stores names, never a second set of paths.
function icon(type: ShapeElement["type"], flowchartShape?: FlowchartShape): string {
  return shapePathData({ type, flowchartShape, x: 3, y: 3, w: 18, h: 18, color: "#000", thickness: 1 }) ?? "";
}
function definitions<T extends FlowchartShape>(items: readonly (readonly [T, string])[]): ShapeDefinition[] {
  return items.map(([value, label]) => ({ value, label, path: icon("flowchart", value) }));
}

export const BASIC_SHAPES: BasicShapeDefinition[] = ([
  ["rectangle", "Rectangle"], ["circle", "Circle"], ["diamond", "Diamond"], ["triangle", "Triangle"],
] as const).map(([value, label]) => ({ value, label, path: icon(value) }));

/** Standard process symbols only. Keep general symbols in GENERAL_SHAPES. */
export const FLOWCHART_SHAPES = definitions([
  ["process", "Process"], ["terminator", "Terminator"], ["decision", "Decision"], ["data", "Input / output"],
  ["document", "Document"], ["multi-document", "Multiple documents"], ["database", "Database"],
  ["predefined-process", "Predefined process"], ["internal-storage", "Internal storage"], ["preparation", "Preparation"],
  ["manual-input", "Manual input"], ["manual-operation", "Manual operation"], ["connector", "On-page connector"],
  ["off-page", "Off-page connector"], ["delay", "Delay"], ["stored-data", "Stored data"], ["display", "Display"],
  ["merge", "Merge"], ["extract", "Extract"], ["collate", "Collate"], ["sort", "Sort"],
  ["summing-junction", "Summing junction"], ["or", "OR junction"], ["loop-limit", "Loop limit"],
  ["loop-start", "Loop start"], ["loop-end", "Loop end"], ["alternate-process", "Alternate process"],
  ["card", "Card"], ["punched-tape", "Punched tape"], ["sequential-data", "Sequential data"], ["direct-data", "Direct access storage"],
] as const);

export const GENERAL_SHAPES = definitions([
  ["cloud", "Cloud"], ["star", "Star"], ["lightning", "Lightning"], ["heart", "Heart"],
  ["callout", "Callout"], ["gear", "Gear"], ["hexagon", "Hexagon"], ["parallelogram", "Parallelogram"],
  ["trapezoid", "Trapezoid"], ["pentagon", "Pentagon"], ["octagon", "Octagon"], ["chevron", "Chevron"],
  ["cross", "Cross"], ["folder", "Folder"], ["note", "Note"], ["cube", "Cube"],
  ["rounded-rectangle", "Rounded rectangle"], ["shield", "Shield"],
  ["right-arrow", "Right arrow"], ["left-arrow", "Left arrow"], ["double-arrow", "Double arrow"],
  ["up-arrow", "Up arrow"], ["down-arrow", "Down arrow"], ["ring", "Ring"],
  ["pie-slice", "Pie slice"], ["wave", "Wave"], ["banner", "Banner"], ["teardrop", "Teardrop"],
  ["funnel", "Funnel"],
] as const);

/** Includes every serialized value so older .sketch files continue to load. */
export const ALL_FLOWCHART_SHAPES: ShapeDefinition[] = [...FLOWCHART_SHAPES, ...GENERAL_SHAPES];
export const FLOWCHART_MENU_SHAPES = FLOWCHART_SHAPES;
