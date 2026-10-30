/**
 * Backwards-compatible exports for the shape catalog, now owned by features/shapes.
 * New code should import directly from ../shapes/shape-catalog.
 */
export {
  ALL_FLOWCHART_SHAPES,
  BASIC_SHAPES,
  FLOWCHART_MENU_SHAPES,
  FLOWCHART_SHAPES,
  GENERAL_SHAPES,
} from "../shapes/shape-catalog";
export type { BasicShapeDefinition, BasicShapeTool, ShapeDefinition } from "../shapes/shape-catalog";
