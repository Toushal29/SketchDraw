export type WorkspaceArea = "chooser" | "canvas" | "planning" | "library";
export type DocumentWorkspaceArea = Exclude<WorkspaceArea, "chooser">;
