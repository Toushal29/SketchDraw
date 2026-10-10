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
);
export const FLOWCHART_MENU_SHAPES = FLOWCHART_SHAPES.filter(shape => !["star", "lightning", "heart", "callout"].includes(shape.value));
