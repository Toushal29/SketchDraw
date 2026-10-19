export type DiagramTemplateId = "c4" | "uml" | "erd" | "bpmn" | "network";
export type DiagramTemplate = { id: DiagramTemplateId; name: string; category: string; description: string; width: number; height: number };

/** Read-only examples for the guide gallery. These are not canvas templates. */
export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
  { id: "c4", name: "C4 system context", category: "Architecture", description: "People, a software system, supporting services, and their relationships.", width: 940, height: 570 },
  { id: "uml", name: "UML class model", category: "Software design", description: "Classes, fields, operations, and inheritance relationships.", width: 1020, height: 500 },
  { id: "erd", name: "ER database model", category: "Data", description: "Linked tables with primary and foreign key fields.", width: 1040, height: 580 },
  { id: "bpmn", name: "BPMN process", category: "Process", description: "A simple order flow with events, tasks, and a decision gateway.", width: 1120, height: 520 },
  { id: "network", name: "Network topology", category: "Infrastructure", description: "A small office network with perimeter, switching, services, and storage.", width: 1060, height: 640 },
];