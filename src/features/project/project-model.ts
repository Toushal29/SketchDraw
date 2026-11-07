export type ProjectNote = { id: string; title: string; content: string; createdAt: number; updatedAt: number };
export type ProjectTaskStatus = string;
export type ProjectWorkflowColumn = { id: string; label: string; completed?: boolean };
export type ProjectTaskPriority = "low" | "medium" | "high";
export type ProjectChecklistItem = { id: string; text: string; done: boolean };
/** Legacy alias retained so older planning payloads can be migrated on read. */
export type ProjectTaskChecklistItem = ProjectChecklistItem;
export type ProjectTask = { id: string; title: string; description: string; status: ProjectTaskStatus; priority: ProjectTaskPriority; startDate?: string; dueDate?: string; baselineStartDate?: string; baselineDueDate?: string; estimateMinutes?: number; recurrence?: "daily" | "weekly" | "monthly"; dependsOn?: string[]; checklist?: ProjectTaskChecklistItem[]; completedAt?: number; createdAt: number; updatedAt: number };
export type ProjectMilestone = { id: string; title: string; description: string; date: string; completed: boolean; createdAt: number; updatedAt: number };
export type ProjectLogKind = "decision" | "question" | "risk";
export type ProjectLogEntry = { id: string; kind: ProjectLogKind; title: string; details: string; owner: string; nextStep: string; riskLevel?: ProjectTaskPriority; resolved: boolean; createdAt: number; updatedAt: number };
export type ProjectFileEntry =
  | { id: string; kind: "attachment"; name: string; mimeType: string; dataUrl: string; size: number; createdAt: number }
  | { id: string; kind: "link"; name: string; url: string; createdAt: number };
export type ProjectWorkspaceData = {
  name: string;
  description: string;
  notes: ProjectNote[];
  tasks: ProjectTask[];
  workflowColumns?: ProjectWorkflowColumn[];
  workingDays?: number[];
  checklist: ProjectChecklistItem[];
  milestones: ProjectMilestone[];
  logEntries: ProjectLogEntry[];
  files: ProjectFileEntry[];
};
export type SketchDrawPlanningFile = { format: "SketchDrawPlanning"; version: 1; project: ProjectWorkspaceData };
