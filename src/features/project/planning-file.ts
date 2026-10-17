import type { ProjectWorkspaceData, SketchDrawPlanningFile } from "../../model";
import { normalizeProjectWorkspace } from "./project-data";

export function createPlanningFile(project: ProjectWorkspaceData): SketchDrawPlanningFile {
  return { format: "SketchDrawPlanning", version: 1, project };
}

export function serializePlanningFile(project: ProjectWorkspaceData): string {
  return JSON.stringify(createPlanningFile(project), null, 2);
}

export function parsePlanningFile(value: unknown): SketchDrawPlanningFile | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const document = value as Record<string, unknown>;
  if (document.format !== "SketchDrawPlanning" || document.version !== 1) return undefined;
  const project = normalizeProjectWorkspace(document.project);
  return project ? { format: "SketchDrawPlanning", version: 1, project } : undefined;
}

export function hasPlanningContent(project: ProjectWorkspaceData, defaultNames: readonly string[] = []): boolean {
  const name = project.name.trim();
  const defaults = new Set(defaultNames.map(value => value.trim().toLowerCase()));
  return (!!name && !defaults.has(name.toLowerCase())) || !!project.description.trim() || project.notes.length > 0 || project.tasks.length > 0 || project.checklist.length > 0
    || project.milestones.length > 0 || project.logEntries.length > 0 || project.files.length > 0;
}
