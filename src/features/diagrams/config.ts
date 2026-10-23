import type { FlowchartShape } from "../../model";

export type ShapeDefinition = { value: FlowchartShape; label: string; path: string };

/** Standard process symbols only. Keep legacy/general symbols in GENERAL_SHAPES. */
export const FLOWCHART_SHAPES: ShapeDefinition[] = [
  { value: "process", label: "Process", path: "M5 5h14v14H5z" },
  { value: "terminator", label: "Terminator", path: "M8 5h8a7 7 0 0 1 0 14H8A7 7 0 0 1 8 5z" },
  { value: "decision", label: "Decision", path: "m12 3 9 9-9 9-9-9z" },
  { value: "data", label: "Input / output", path: "m8 5h13l-5 14H3z" },
  { value: "document", label: "Document", path: "M5 5h14v12q-4-4-7 0t-7 0z" },
  { value: "multi-document", label: "Multiple documents", path: "M8 4h11v13M5 7h14v13H5z" },
  { value: "database", label: "Database", path: "M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3v10c0 1.7-3.6 3-8 3s-8-1.3-8-3V7m0 0c0 1.7 3.6 3 8 3s8-1.3 8-3" },
  { value: "predefined-process", label: "Predefined process", path: "M6 5h12v14H6zM9 5v14m6-14v14" },
  { value: "internal-storage", label: "Internal storage", path: "M5 5h14v14H5zM9 5v14M9 9h10" },
  { value: "preparation", label: "Preparation", path: "M7 5h10l5 7-5 7H7l-5-7z" },
  { value: "manual-input", label: "Manual input", path: "m4 8 3-3h13v14H4z" },
  { value: "manual-operation", label: "Manual operation", path: "M3 5h18l-4 14H7z" },
  { value: "connector", label: "On-page connector", path: "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0" },
  { value: "off-page", label: "Off-page connector", path: "M4 4h16v11l-8 6-8-6z" },
  { value: "delay", label: "Delay", path: "M4 4h8a8 8 0 0 1 0 16H4z" },
  { value: "stored-data", label: "Stored data", path: "M7 5h14q-5 7 0 14H7C1 19 1 5 7 5z" },
  { value: "display", label: "Display", path: "M3 4h18v13H3zM8 21h8m-4-4v4" },
  { value: "merge", label: "Merge", path: "M4 5h16L12 20zM7 9h10" },
  { value: "extract", label: "Extract", path: "M4 19h16L12 4zM7 15h10" },
  { value: "collate", label: "Collate", path: "M4 5h16v14H4zM7 8l10 8m0-8L7 16" },
  { value: "sort", label: "Sort", path: "m12 3 9 9-9 9-9-9zM5 12h14" },
  { value: "summing-junction", label: "Summing junction", path: "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0M12 7v10m-5-5h10" },
  { value: "or", label: "OR junction", path: "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0M8.5 8.5l7 7m0-7-7 7" },
  { value: "loop-limit", label: "Loop limit", path: "M5 6h14v13H5zM7 6q5-5 10 0" },
  { value: "loop-start", label: "Loop start", path: "M5 5h14v14H5zM12 5v14m-4-9 4-4 4 4" },
  { value: "loop-end", label: "Loop end", path: "M5 5h14v14H5zM12 5v14m-4 0 4-4 4 4" },
  { value: "alternate-process", label: "Alternate process", path: "M8 5h8a7 7 0 0 1 0 14H8a7 7 0 0 1 0-14z" },
  { value: "card", label: "Card", path: "M4 5h16v14H4zM4 8h16" },
  { value: "punched-tape", label: "Punched tape", path: "M4 6q4-4 8 0t8 0v12q-4 4-8 0t-8 0zM4 6q4 4 8 0t8 0" },
  { value: "sequential-data", label: "Sequential data", path: "M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3v10c0 1.7-3.6 3-8 3s-8-1.3-8-3V7m0 0c0 1.7 3.6 3 8 3s8-1.3 8-3m-16 5c0 1.7 3.6 3 8 3s8-1.3 8-3" },
  { value: "direct-data", label: "Direct access storage", path: "M5 5h14v14H5zM8 8h8v8H8z" },
];

/** General-purpose shapes stay available, without being presented as flowchart notation. */
export const GENERAL_SHAPES: ShapeDefinition[] = [
  { value: "cloud", label: "Cloud", path: "M5 17a4 4 0 0 1 1-8 6 6 0 0 1 11-1 4.5 4.5 0 0 1 1 9z" },
  { value: "star", label: "Star", path: "m12 2 3 7h7l-5.5 4.5 2 8L12 17l-6.5 4.5 2-8L2 9h7z" },
  { value: "lightning", label: "Lightning", path: "m14 2-9 12h6l-1 8 9-12h-6z" },
  { value: "heart", label: "Heart", path: "M12 21S3 15 3 8a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 7-9 13-9 13z" },
  { value: "callout", label: "Callout", path: "M3 4h18v13H12l-5 4v-4H3z" },
  { value: "gear", label: "Gear", path: "M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" },
  { value: "hexagon", label: "Hexagon", path: "M7 4h10l5 8-5 8H7l-5-8z" },
  { value: "parallelogram", label: "Parallelogram", path: "m7 4h15l-5 16H2z" },
  { value: "trapezoid", label: "Trapezoid", path: "m6 4h12l4 16H2z" },
  { value: "pentagon", label: "Pentagon", path: "m12 3 9 7-3.5 11h-11L3 10z" },
  { value: "octagon", label: "Octagon", path: "m8 3h8l5 5v8l-5 5H8l-5-5V8z" },
  { value: "chevron", label: "Chevron", path: "m3 4 9 0 9 8-9 8H3l9-8z" },
  { value: "cross", label: "Cross", path: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" },
  { value: "folder", label: "Folder", path: "M3 6h7l2 2h9v12H3z" },
  { value: "note", label: "Note", path: "M5 3h10l4 4v14H5zM14 3v5h5" },
  { value: "cube", label: "Cube", path: "m12 3 8 4-8 4-8-4zM4 7v10l8 4 8-4V7m-8 4v10" },
  { value: "rounded-rectangle", label: "Rounded rectangle", path: "M8 4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z" },
  { value: "shield", label: "Shield", path: "m12 3 8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" },
];

/** Includes every serialized value so older .sketch files continue to load. */
export const ALL_FLOWCHART_SHAPES: ShapeDefinition[] = [...FLOWCHART_SHAPES, ...GENERAL_SHAPES];
export const FLOWCHART_MENU_SHAPES = FLOWCHART_SHAPES;
