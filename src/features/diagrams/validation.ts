import type { Binding, Element, SchemaTableElement, ShapeElement, SketchPage } from "../../model";
import { elementBounds } from "../canvas/bounds";
import { flatten, isConnectable, isConnector } from "../../operations";

export type DiagramIssue = { code: string; severity: "error" | "warning"; message: string; elementId?: string; pageId?: string };

const textOf = (item: Element): string => {
  if (item.type === "schemaTable") return item.name;
  if (item.type === "text") return item.text;
  if (item.type === "group") return [item.libraryComponent?.label, item.libraryComponent?.kind, ...item.elements.map(textOf)].filter(Boolean).join(" ");
  return "label" in item ? item.label?.text ?? "" : "";
};

const libraryKind = (item: Element) => item.type === "group" ? item.libraryComponent?.kind ?? "" : "";
const boundNode = (binding: Binding | undefined, byId: Map<string, Element>) => binding ? byId.get(binding.elementId) : undefined;

/** Find broken references and common diagram inconsistencies. */
export function validateDiagram(elements: Element[], pages: SketchPage[] = []): DiagramIssue[] {
  const all = flatten(elements);
  const issues: DiagramIssue[] = [];
  const ids = new Map<string, Element[]>();
  for (const item of all) {
    if (!item.id) { issues.push({ code: "missing-id", severity: "error", message: "An object is missing its identifier." }); continue; }
    const entries = ids.get(item.id) ?? []; entries.push(item); ids.set(item.id, entries);
    if (item.pageLinkId && !pages.some(page => page.id === item.pageLinkId)) issues.push({ code: "missing-page", severity: "warning", message: "This object links to a page that no longer exists.", elementId: item.id });
  }
  for (const [id, entries] of ids) if (entries.length > 1) for (const item of entries) issues.push({ code: "duplicate-id", severity: "error", message: `Object identifier "${id}" is used more than once.`, elementId: item.id });
  const byId = new Map(all.flatMap(item => item.id ? [[item.id, item] as const] : []));
  const tables = all.filter((item): item is SchemaTableElement => item.type === "schemaTable");
  const tableByName = new Map<string, SchemaTableElement[]>();
  for (const table of tables) {
    const matches = tableByName.get(table.name.toLowerCase()) ?? []; matches.push(table); tableByName.set(table.name.toLowerCase(), matches);
    const columns = new Map<string, number>();
    for (const column of table.columns) {
      const key = column.name.trim().toLowerCase(); const count = (columns.get(key) ?? 0) + 1; columns.set(key, count);
      if (count > 1) issues.push({ code: "duplicate-column", severity: "warning", message: `Table "${table.name}" has duplicate column "${column.name}".`, elementId: table.id });
      if (column.foreignTable && !tables.some(target => target.name.toLowerCase() === column.foreignTable!.toLowerCase())) issues.push({ code: "missing-table", severity: "warning", message: `Column "${column.name}" refers to missing table "${column.foreignTable}".`, elementId: table.id });
      else if (column.foreignTable && column.foreignColumn) {
        const target = tables.find(candidate => candidate.name.toLowerCase() === column.foreignTable!.toLowerCase());
        if (target && !target.columns.some(candidate => candidate.name.toLowerCase() === column.foreignColumn!.toLowerCase())) issues.push({ code: "missing-column", severity: "warning", message: `Column "${column.name}" refers to missing column "${column.foreignTable}.${column.foreignColumn}".`, elementId: table.id });
      }
    }
  }
  for (const [name, matches] of tableByName) if (matches.length > 1) for (const table of matches) issues.push({ code: "duplicate-table", severity: "warning", message: `Schema table "${name}" appears more than once.`, elementId: table.id });

  const checkBinding = (binding: Binding, connectorId?: string, endpoint?: string) => {
    const target = byId.get(binding.elementId);
    if (!target) { issues.push({ code: "dangling-link", severity: "error", message: `A connector ${endpoint ?? "endpoint"} points to an object that no longer exists.`, elementId: connectorId }); return; }
    if (!isConnectable(target)) { issues.push({ code: "invalid-link-target", severity: "error", message: `A connector is attached to unsupported object type "${target.type}".`, elementId: connectorId }); return; }
    if (target.type === "schemaTable" && binding.rowId && !target.columns.some(column => column.id === binding.rowId)) issues.push({ code: "missing-row", severity: "error", message: `A connector points to a field that no longer exists in "${target.name}".`, elementId: connectorId });
  };
  const connectors = all.filter(isConnector);
  const links = new Map<string, ShapeElement[]>();
  const connectorPairs: Array<{ connector: ShapeElement; start?: Element; end?: Element }> = [];
  for (const item of connectors) {
    const bindings = [item.startBinding, item.endBinding, item.forkUpper?.endBinding, item.forkLower?.endBinding];
    bindings.forEach((binding, index) => { if (binding) checkBinding(binding, item.id, index === 0 ? "start" : index === 1 ? "end" : "branch"); });
    const activeEnds = Number(!!item.startBinding) + Number(!!item.endBinding);
    if (activeEnds === 1) issues.push({ code: "loose-end", severity: "warning", message: "This connector is attached at one end and has a free endpoint.", elementId: item.id });
    const start = boundNode(item.startBinding, byId); const end = boundNode(item.endBinding, byId);
    connectorPairs.push({ connector: item, start, end });
    if (start?.type === "schemaTable" && end?.type === "schemaTable" && start.schemaDiagramId !== end.schemaDiagramId) issues.push({ code: "cross-schema-link", severity: "warning", message: "This relationship connects tables from different schema imports.", elementId: item.id });
    if (item.startBinding && item.endBinding) {
      const key = `${item.startBinding.elementId}>${item.endBinding.elementId}`;
      const pair = links.get(key) ?? []; pair.push(item); links.set(key, pair);
    }

  }
  for (const pair of links.values()) if (pair.length > 1) {
    const first = pair[0];
    if (pair.some(connector => (connector.label?.text ?? "").trim() === (first.label?.text ?? "").trim() && connector.relationshipType === first.relationshipType)) {
      issues.push({ code: "ambiguous-link", severity: "warning", message: "Multiple matching relationships connect the same pair of objects.", elementId: first.id });
    }
  }

  const diagramNodes = (items: Element[]): Element[] => items.flatMap(item => {
    if (item.hidden) return [];
    if (item.type !== "group") return [item];
    return item.note || item.mermaid || item.componentBounds || item.libraryComponent ? [item] : diagramNodes(item.elements);
  });
  const nodes = diagramNodes(elements).filter(item => !isConnector(item));
  const bpmnNodes = nodes.filter(item => libraryKind(item).startsWith("bpmn-") && item.id);
  const bpmnIds = new Set(bpmnNodes.map(item => item.id!));
  const bpmnFlows = connectorPairs.filter(({ connector, start, end }) => !!start?.id && !!end?.id && bpmnIds.has(start.id) && bpmnIds.has(end.id)
    && (!connector.relationshipType || connector.relationshipType === "sequence"));
  for (const item of bpmnNodes) {
    const kind = libraryKind(item); const incoming = bpmnFlows.filter(flow => flow.end?.id === item.id); const outgoing = bpmnFlows.filter(flow => flow.start?.id === item.id);
    if (kind === "bpmn-start") {
      if (incoming.length) issues.push({ code: "bpmn-start-incoming", severity: "error", message: "A BPMN start event cannot have an incoming sequence flow.", elementId: item.id });
      if (!outgoing.length) issues.push({ code: "bpmn-start-unconnected", severity: "warning", message: "This BPMN start event has no outgoing sequence flow.", elementId: item.id });
    } else if (kind === "bpmn-end") {
      if (outgoing.length) issues.push({ code: "bpmn-end-outgoing", severity: "error", message: "A BPMN end event cannot have an outgoing sequence flow.", elementId: item.id });
      if (!incoming.length) issues.push({ code: "bpmn-end-unconnected", severity: "warning", message: "This BPMN end event has no incoming sequence flow.", elementId: item.id });
    } else if (kind === "bpmn-gateway" || kind === "bpmn-parallel-gateway") {
      if (incoming.length + outgoing.length < 3) issues.push({ code: "bpmn-gateway-flow-count", severity: "warning", message: "A BPMN gateway normally splits or joins at least two sequence flows.", elementId: item.id });
      if (kind === "bpmn-gateway" && outgoing.length > 1) {
        const defaults = outgoing.filter(flow => flow.connector.sequenceDefault);
        if (defaults.length !== 1) issues.push({ code: "bpmn-gateway-default", severity: "warning", message: "Give an exclusive gateway exactly one default outgoing sequence flow.", elementId: item.id });
        for (const flow of outgoing) if (!flow.connector.sequenceDefault && !flow.connector.sequenceCondition?.trim()) issues.push({ code: "bpmn-gateway-condition", severity: "warning", message: "Add a condition or mark this as the default path from its exclusive gateway.", elementId: flow.connector.id });
      }
    } else if (kind === "bpmn-task" && (!incoming.length || !outgoing.length)) {
      issues.push({ code: "bpmn-task-flow", severity: "warning", message: "This BPMN task needs an incoming and outgoing sequence flow.", elementId: item.id });
    }
  }
  for (const flow of bpmnFlows) if (flow.connector.sequenceDefault && flow.connector.sequenceCondition?.trim()) {
    issues.push({ code: "bpmn-default-condition", severity: "warning", message: "A default sequence flow should not also have a condition.", elementId: flow.connector.id });
  }
  for (let first = 0; first < nodes.length; first++) for (let second = first + 1; second < nodes.length; second++) {
    const a = elementBounds(nodes[first]); const b = elementBounds(nodes[second]);
    const width = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x); const height = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (width <= 8 || height <= 8 || width * height < Math.min(a.w * a.h, b.w * b.h) * .16) continue;
    const aContainsB = a.x <= b.x && a.y <= b.y && a.x + a.w >= b.x + b.w && a.y + a.h >= b.y + b.h;
    const bContainsA = b.x <= a.x && b.y <= a.y && b.x + b.w >= a.x + a.w && b.y + b.h >= a.y + a.h;
    if (!aContainsB && !bContainsA) issues.push({ code: "overlap", severity: "warning", message: `"${textOf(nodes[first]) || nodes[first].type}" overlaps "${textOf(nodes[second]) || nodes[second].type}".`, elementId: nodes[second].id });
  }
  return issues;
}

export type DiagramLintProfile = "all" | "bpmn" | "erd";
export const DIAGRAM_LINT_PROFILES: readonly { id: DiagramLintProfile; label: string }[] = [
  { id: "all", label: "All checks" }, { id: "bpmn", label: "BPMN" }, { id: "erd", label: "ERD" },
];
export function issuesForProfile(issues: DiagramIssue[], profile: DiagramLintProfile): DiagramIssue[] {
  if (profile === "all") return issues;
  const byProfile: Record<Exclude<DiagramLintProfile, "all">, (code: string) => boolean> = {
    bpmn: code => code.startsWith("bpmn-"),
    erd: code => ["duplicate-column", "missing-table", "missing-column", "duplicate-table", "cross-schema-link", "dangling-link", "invalid-link-target"].includes(code),
  };
  return issues.filter(issue => byProfile[profile](issue.code));
}
