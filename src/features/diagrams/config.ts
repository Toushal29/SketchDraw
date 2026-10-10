import type { FlowchartShape } from "../../model";

export const FLOWCHART_SHAPES: { value: FlowchartShape; label: string; path: string }[] = [
  { value: "process", label: "Process", path: "M5 5h14v14H5z" }, { value: "terminator", label: "Terminator", path: "M8 5h8a7 7 0 0 1 0 14H8A7 7 0 0 1 8 5z" },
  { value: "decision", label: "Decision", path: "m12 3 9 9-9 9-9-9z" }, { value: "data", label: "Input / Output", path: "m8 5h13l-5 14H3z" },
  { value: "document", label: "Document", path: "M5 5h14v12q-4-4-7 0t-7 0z" }, { value: "database", label: "Database", path: "M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3v10c0 1.7-3.6 3-8 3s-8-1.3-8-3V7m0 0c0 1.7 3.6 3 8 3s8-1.3 8-3" },
  { value: "predefined-process", label: "Predefined process", path: "M6 5h12v14H6zM9 5v14m6-14v14" }, { value: "preparation", label: "Preparation", path: "M7 5h10l5 7-5 7H7l-5-7z" },
  { value: "manual-input", label: "Manual input", path: "m4 8 3-3h13v14H4z" },
];
FLOWCHART_SHAPES.push(
  { value: "connector", label: "On-page connector", path: "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0" },
  { value: "off-page", label: "Off-page connector", path: "M4 4h16v11l-8 6-8-6z" },
  { value: "delay", label: "Delay", path: "M4 4h8a8 8 0 0 1 0 16H4z" },
  { value: "manual-operation", label: "Manual operation", path: "M3 5h18l-4 14H7z" },
  { value: "stored-data", label: "Stored data", path: "M7 5h14q-5 7 0 14H7C1 19 1 5 7 5z" },
  { value: "cloud", label: "Cloud / external service", path: "M5 17a4 4 0 0 1 1-8 6 6 0 0 1 11-1 4.5 4.5 0 0 1 1 9z" },
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
  { value: "display", label: "Display", path: "M3 4h18v13H3zM8 21h8m-4-4v4" },
  { value: "cube", label: "Cube", path: "m12 3 8 4-8 4-8-4zM4 7v10l8 4 8-4V7m-8 4v10" },
  { value: "rounded-rectangle", label: "Rounded rectangle", path: "M8 4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z" },
  { value: "shield", label: "Shield", path: "m12 3 8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" },
);
// Shared shape menu used by touch and desktop tool panels.
export const FLOWCHART_MENU_SHAPES = FLOWCHART_SHAPES;
