export type DiagramTemplateId = "c4" | "uml" | "erd" | "bpmn" | "network";
import type { Element, GroupElement, SchemaTableElement, ShapeElement } from "../../model";
import { buildLibraryComponent, buildLibraryRelationship, type LibraryComponentKind } from "../../notes";
import { elementBounds } from "../canvas/bounds";

export type DiagramTemplate = { id: DiagramTemplateId; name: string; category: string; description: string; width: number; height: number };

/** Starter diagrams are editable canvas objects; they are intentionally small and portable. */
export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
  { id: "c4", name: "C4 system context", category: "Architecture", description: "People, a software system, supporting services, and their relationships.", width: 940, height: 570 },
  { id: "uml", name: "UML class model", category: "Software design", description: "Classes, fields, operations, and inheritance relationships.", width: 1020, height: 500 },
  { id: "erd", name: "ER database model", category: "Data", description: "Linked tables with primary and foreign key fields.", width: 1040, height: 580 },
  { id: "bpmn", name: "BPMN process", category: "Process", description: "A simple order flow with events, tasks, and a decision gateway.", width: 1120, height: 520 },
  { id: "network", name: "Network topology", category: "Infrastructure", description: "A small office network with perimeter, switching, services, and storage.", width: 1060, height: 640 },
];

function component(kind: LibraryComponentKind, x: number, y: number, label: string): GroupElement {
  const item = buildLibraryComponent(kind, x, y);
  if (item.libraryComponent) item.libraryComponent = { ...item.libraryComponent, label };
  return item;
}

function relation(from: Element, to: Element, label = "", sequenceCondition?: string, sequenceDefault = false): ShapeElement {
  const a = elementBounds(from); const b = elementBounds(to);
  const start = { x: a.x + a.w, y: a.y + a.h / 2 }; const end = { x: b.x, y: b.y + b.h / 2 };
  return { type: "arrow", id: crypto.randomUUID(), x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, color: "#64748b", thickness: 1.8, lineRoute: "elbow", autoRoute: true, startHead: "none", endHead: "solid", startBinding: { elementId: from.id!, anchor: { x: 1, y: .5 } }, endBinding: { elementId: to.id!, anchor: { x: 0, y: .5 } }, ...(sequenceCondition ? { relationshipType: "sequence" as const, sequenceCondition } : {}), ...(sequenceDefault ? { relationshipType: "sequence" as const, sequenceDefault: true } : {}), ...(label ? { label: { text: label, color: "#475569", fontSize: 12, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" } } : {}) };
}

export function buildDiagramTemplate(id: DiagramTemplateId, origin = { x: 0, y: 0 }): Element[] {
  const x = origin.x; const y = origin.y;
  if (id === "c4") {
    const actor = component("uml-actor", x + 20, y + 130, "Customer");
    const system = component("c4-system", x + 210, y + 70, "Order system");
    const service = component("c4-container", x + 600, y + 95, "Order API");
    const store = component("software-database", x + 620, y + 330, "Orders database");
    return [actor, system, service, store, relation(actor, system, "places orders"), relation(system, service, "HTTP / JSON"), relation(service, store, "reads and writes")];
  }
  if (id === "uml") {
    const order = component("uml-class", x + 40, y + 90, "Order");
    const item = component("uml-class", x + 400, y + 90, "OrderItem");
    const payment = component("uml-class", x + 400, y + 330, "Payment");
    const links = [buildLibraryRelationship("uml-composition", x + 250, y + 150)!, buildLibraryRelationship("uml-inheritance", x + 245, y + 375)!];
    links[0] = { ...links[0], id: crypto.randomUUID(), startBinding: { elementId: order.id!, anchor: { x: 1, y: .5 } }, endBinding: { elementId: item.id!, anchor: { x: 0, y: .5 } } };
    links[1] = { ...links[1], id: crypto.randomUUID(), startBinding: { elementId: order.id!, anchor: { x: 1, y: .78 } }, endBinding: { elementId: payment.id!, anchor: { x: 0, y: .5 } } };
    return [order, item, payment, ...links];
  }
  if (id === "erd") {
    const diagramId = crypto.randomUUID();
    const users: SchemaTableElement = { type: "schemaTable", id: crypto.randomUUID(), x: x + 40, y: y + 70, w: 250, h: 150, name: "users", schemaDiagramId: diagramId, schemaSource: "", columns: [{ id: crypto.randomUUID(), name: "id", dataType: "INTEGER", primaryKey: true }, { id: crypto.randomUUID(), name: "email", dataType: "TEXT" }] };
    const orders: SchemaTableElement = { type: "schemaTable", id: crypto.randomUUID(), x: x + 430, y: y + 70, w: 260, h: 176, name: "orders", schemaDiagramId: diagramId, schemaSource: "", columns: [{ id: crypto.randomUUID(), name: "id", dataType: "INTEGER", primaryKey: true }, { id: crypto.randomUUID(), name: "user_id", dataType: "INTEGER", foreignTable: "users", foreignColumn: "id" }, { id: crypto.randomUUID(), name: "created_at", dataType: "TIMESTAMP" }] };
    const orderItems: SchemaTableElement = { type: "schemaTable", id: crypto.randomUUID(), x: x + 430, y: y + 355, w: 270, h: 180, name: "order_items", schemaDiagramId: diagramId, schemaSource: "", columns: [{ id: crypto.randomUUID(), name: "order_id", dataType: "INTEGER", primaryKey: true, foreignTable: "orders", foreignColumn: "id" }, { id: crypto.randomUUID(), name: "product_id", dataType: "INTEGER", primaryKey: true }, { id: crypto.randomUUID(), name: "quantity", dataType: "INTEGER" }] };
    return [users, orders, orderItems, relation(users, orders, "1 to many"), relation(orders, orderItems, "1 to many")];
  }
  if (id === "bpmn") {
    const start = component("bpmn-start", x + 20, y + 170, "Order received");
    const validate = component("bpmn-task", x + 190, y + 145, "Validate order");
    const gateway = component("bpmn-gateway", x + 435, y + 155, "In stock?");
    const ship = component("bpmn-task", x + 660, y + 75, "Ship order");
    const reject = component("bpmn-task", x + 660, y + 280, "Notify customer");
    const end = component("bpmn-end", x + 925, y + 170, "Complete");
    return [start, validate, gateway, ship, reject, end, relation(start, validate), relation(validate, gateway), relation(gateway, ship, "yes", "in stock"), relation(gateway, reject, "no", undefined, true), relation(ship, end), relation(reject, end)];
  }
  const client = component("network-client", x + 20, y + 180, "Office clients");
  const router = component("network-router", x + 260, y + 180, "Edge router");
  const firewall = component("network-firewall", x + 490, y + 180, "Firewall");
  const app = component("network-server", x + 740, y + 80, "Application server");
  const database = component("software-database", x + 740, y + 320, "Database");
  return [client, router, firewall, app, database, relation(client, router), relation(router, firewall), relation(firewall, app, "HTTPS"), relation(app, database, "SQL")];
}
