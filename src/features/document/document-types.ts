import type { SketchFile } from "../../model";

export type DocumentRecoveryPrompt = { path: string; snapshot: SketchFile; baselineRaw?: string };
export type DocumentConflict = { path: string; remote: string };
export type DocumentControllerStatus = "idle" | "opening" | "saving" | "saved" | "error" | "conflict";
