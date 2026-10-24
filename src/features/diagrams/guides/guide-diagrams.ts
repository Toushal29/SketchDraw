import type { Element, FlowchartShape, GroupElement, ShapeElement } from "../../../model";
import { buildLibraryComponent, LIBRARY_COMPONENTS, type LibraryComponentKind } from "../../../notes";

export type DiagramGuideId = "order-flow" | "class-model" | "sequence" | "data-model" | "bpmn-process" | "c4-context" | "network-edge" | "cloud-service" | "state-machine";
export type DiagramGuideCategory = "Flowchart" | "UML" | "Database" | "BPMN" | "Architecture" | "Network";

export type GuideNode = {
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape?: "rectangle" | "circle" | "diamond" | "flowchart";
  flowchartShape?: FlowchartShape;
  component?: LibraryComponentKind;
  fill?: string;
};
export type GuideEdge = { from: number; to: number; label?: string; dashed?: boolean; atY?: number };
export type DiagramGuide = {
  id: DiagramGuideId;
  category: DiagramGuideCategory;
  title: string;
  summary: string;
  use: string;
  tip: string;
  source: { label: string; href: string };
  width: number;
  height: number;
  nodes: GuideNode[];
  edges: GuideEdge[];
};

const flowNode = (title: string, x: number, y: number, shape: FlowchartShape, w = 150, h = 78): GuideNode => ({ title, x, y, w, h, shape: "flowchart", flowchartShape: shape });
const componentNode = (title: string, x: number, y: number, component: LibraryComponentKind, w: number, h: number, fill?: string): GuideNode => ({ title, x, y, w, h, component, fill });

/** Fresh guide definitions: the card art and inserted examples share this source. */
export const DIAGRAM_GUIDES: DiagramGuide[] = [
  {
    id: "order-flow", category: "Flowchart", title: "Order approval", summary: "Trace a request through a decision and two outcomes.", use: "Use this when a process needs a clear start, decision, and named result paths.", tip: "Put the question inside the decision and label each outgoing path.", source: { label: "draw.io shape guide", href: "https://www.drawio.com/docs/manual/shapes/" }, width: 1040, height: 390,
    nodes: [flowNode("Start", 20, 130, "terminator", 125), flowNode("Record order", 190, 130, "process", 175), flowNode("Payment valid?", 420, 122, "decision", 170, 95), flowNode("Prepare shipment", 690, 35, "process", 190), flowNode("Dispatch", 925, 35, "terminator", 110), flowNode("Review payment", 690, 245, "manual-operation", 190)],
    edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3, label: "Yes" }, { from: 3, to: 4 }, { from: 2, to: 5, label: "No" }, { from: 5, to: 1, label: "Retry" }],
  },
  {
    id: "class-model", category: "UML", title: "Order domain classes", summary: "Show a small object model and its ownership relationships.", use: "Use class diagrams to explain the structure of software objects and their links.", tip: "Keep relationship direction and multiplicity close to the connector.", source: { label: "OMG UML 2.5.1", href: "https://www.omg.org/spec/UML/2.5.1/PDF" }, width: 940, height: 340,
    nodes: [componentNode("Customer", 25, 80, "uml-class", 230, 155, "#eef5ff"), componentNode("Order", 355, 80, "uml-class", 230, 155, "#eef5ff"), componentNode("Order line", 685, 80, "uml-class", 230, 155, "#eef5ff")],
    edges: [{ from: 0, to: 1, label: "places" }, { from: 1, to: 2, label: "contains" }],
  },
  {
    id: "sequence", category: "UML", title: "Checkout sequence", summary: "Follow messages between a person, app, and payment service.", use: "Use a sequence diagram to explain who sends each message and in what order.", tip: "Arrange participants left to right, then place messages from top to bottom.", source: { label: "OMG UML 2.5.1", href: "https://www.omg.org/spec/UML/2.5.1/PDF" }, width: 980, height: 390,
    nodes: [componentNode("Customer", 30, 25, "uml-lifeline", 150, 330), componentNode("Web app", 285, 25, "uml-lifeline", 150, 330), componentNode("Order API", 540, 25, "uml-lifeline", 150, 330), componentNode("Payment", 795, 25, "uml-lifeline", 150, 330)],
    edges: [{ from: 0, to: 1, label: "Submit order", atY: 95 }, { from: 1, to: 2, label: "Create order", atY: 155 }, { from: 2, to: 3, label: "Authorize", atY: 215 }, { from: 3, to: 2, label: "Approved", dashed: true, atY: 275 }],
  },
  {
    id: "data-model", category: "Database", title: "Customer and orders", summary: "Connect related records and make the key fields visible.", use: "Use an ER model to discuss table ownership, keys, and one-to-many relations.", tip: "Mark primary and foreign keys explicitly before adding optional fields.", source: { label: "draw.io database shapes", href: "https://www.drawio.com/docs/manual/shapes/" }, width: 950, height: 350,
    nodes: [componentNode("Customer", 35, 80, "er-table", 240, 175), componentNode("Order", 355, 80, "er-table", 240, 175), componentNode("Order line", 675, 80, "er-table", 240, 175)],
    edges: [{ from: 0, to: 1, label: "1 to many" }, { from: 1, to: 2, label: "1 to many" }],
  },
  {
    id: "bpmn-process", category: "BPMN", title: "Request handling", summary: "Model a service task, a decision, and a human review path.", use: "Use BPMN when business teams need a shared process with events and gateways.", tip: "Start and end events are circles; gateways show where the flow branches.", source: { label: "OMG BPMN 2.0.2", href: "https://www.omg.org/spec/BPMN/2.0.2/PDF/" }, width: 1100, height: 370,
    nodes: [componentNode("Start", 20, 130, "bpmn-start", 70, 70), componentNode("Register request", 135, 105, "bpmn-user-task", 190, 105), componentNode("Complete?", 390, 115, "bpmn-gateway", 90, 90), componentNode("Send confirmation", 555, 35, "bpmn-service-task", 195, 105), componentNode("Review manually", 555, 225, "bpmn-user-task", 195, 105), componentNode("End", 825, 130, "bpmn-end", 70, 70)],
    edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3, label: "Yes" }, { from: 2, to: 4, label: "No" }, { from: 3, to: 5 }, { from: 4, to: 5 }],
  },
  {
    id: "c4-context", category: "Architecture", title: "Customer portal context", summary: "Place people, your system, and external systems in one view.", use: "Use a C4 context diagram to show system scope and its users or neighbors.", tip: "Name every box by type and label each relationship with its purpose.", source: { label: "C4 model notation", href: "https://c4model.com/diagrams/notation" }, width: 1040, height: 340,
    nodes: [componentNode("Customer", 35, 110, "c4-person", 120, 125, "#fff6df"), componentNode("Customer portal", 390, 85, "c4-system", 260, 175, "#e8f2ff"), componentNode("Payment provider", 850, 110, "c4-external-system", 160, 125, "#fff0ee")],
    edges: [{ from: 0, to: 1, label: "Browses and places orders" }, { from: 1, to: 2, label: "Requests payment" }],
  },
  {
    id: "network-edge", category: "Network", title: "Public service edge", summary: "Show traffic passing through protection and distribution layers.", use: "Use this for a simple network topology and the main traffic direction.", tip: "Separate trust zones and put edge controls on the path they protect.", source: { label: "draw.io network libraries", href: "https://www.drawio.com/docs/manual/shapes/" }, width: 1140, height: 400,
    nodes: [componentNode("Internet", 25, 130, "network-internet", 140, 110), componentNode("Firewall", 245, 130, "network-firewall", 150, 110), componentNode("Load balancer", 475, 130, "network-load-balancer", 180, 110), componentNode("API servers", 755, 55, "network-server", 170, 110), componentNode("Web servers", 755, 230, "network-server", 170, 110)],
    edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3, label: "HTTPS" }, { from: 2, to: 4, label: "HTTPS" }],
  },
  {
    id: "cloud-service", category: "Architecture", title: "Cloud application", summary: "Group an API, worker, queue, and database around one request path.", use: "Use this to explain the main runtime pieces of a cloud-backed application.", tip: "Name the runtime boundary and keep data stores distinct from compute.", source: { label: "C4 deployment diagrams", href: "https://c4model.com/diagrams/deployment" }, width: 1100, height: 390,
    nodes: [componentNode("Web client", 25, 135, "software-client", 170, 115), componentNode("API service", 280, 135, "software-api", 175, 115), componentNode("Job queue", 535, 35, "software-queue", 170, 115), componentNode("Worker", 535, 235, "software-service", 170, 115), componentNode("Database", 805, 135, "software-database", 180, 115)],
    edges: [{ from: 0, to: 1, label: "HTTPS" }, { from: 1, to: 2, label: "Enqueue job" }, { from: 2, to: 3, label: "Consume" }, { from: 3, to: 4, label: "Write result" }],
  },
  {
    id: "state-machine", category: "UML", title: "Session state", summary: "Track a session from creation to active, paused, or closed.", use: "Use a state machine for lifecycle behavior and event-driven transitions.", tip: "Label each transition with the event that causes it.", source: { label: "OMG UML 2.5.1", href: "https://www.omg.org/spec/UML/2.5.1/PDF" }, width: 930, height: 350,
    nodes: [componentNode("Initial", 30, 145, "uml-initial-state", 55, 55), componentNode("Active", 190, 120, "uml-state", 165, 105, "#e8f2ff"), componentNode("Paused", 440, 35, "uml-state", 165, 105, "#fff6df"), componentNode("Closed", 690, 145, "uml-final-state", 65, 65)],
    edges: [{ from: 0, to: 1 }, { from: 1, to: 2, label: "pause" }, { from: 2, to: 1, label: "resume" }, { from: 1, to: 3, label: "close" }],
  },
];

function boundaryPoint(node: GuideNode, target: GuideNode) {
  const cx = node.x + node.w / 2; const cy = node.y + node.h / 2;
  const dx = target.x + target.w / 2 - cx; const dy = target.y + target.h / 2 - cy;
  const sx = Math.max(Math.abs(dx) / Math.max(1, node.w / 2), Math.abs(dy) / Math.max(1, node.h / 2), 1);
  return { x: cx + dx / sx, y: cy + dy / sx };
}

export function guideEdgePoints(edge: GuideEdge, nodes: GuideNode[]) {
  const from = nodes[edge.from]; const to = nodes[edge.to];
  if (!from || !to) throw new Error("Guide diagram contains a relationship to a missing shape.");
  if (edge.atY !== undefined) return { start: { x: from.x + from.w / 2, y: edge.atY }, end: { x: to.x + to.w / 2, y: edge.atY } };
  return { start: boundaryPoint(from, to), end: boundaryPoint(to, from) };
}

function makeGuideElement(node: GuideNode): Element {
  if (node.component) {
    if (!LIBRARY_COMPONENTS.some(item => item.kind === node.component)) throw new Error(`Missing guide component: ${node.component}`);
    const group = buildLibraryComponent(node.component, node.x, node.y) as GroupElement;
    group.componentBounds = { x: node.x, y: node.y, w: node.w, h: node.h };
    group.libraryComponent = { ...group.libraryComponent!, label: node.title, ...(node.fill ? { styleOverrides: { fillColor: node.fill } } : {}) };
    return group;
  }
  const color = "#53677b";
  const shape: ShapeElement = { type: node.shape ?? "rectangle", id: crypto.randomUUID(), x: node.x, y: node.y, w: node.w, h: node.h, color, thickness: 2, fillColor: node.fill ?? "#f5f8fc", ...(node.flowchartShape ? { flowchartShape: node.flowchartShape } : {}), label: { text: node.title, color: "#263747", fontSize: 15, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } };
  return shape;
}

function makeGuideEdge(edge: GuideEdge, nodes: GuideNode[]): ShapeElement {
  const { start, end } = guideEdgePoints(edge, nodes);
  return {
    type: "arrow", id: crypto.randomUUID(), x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y,
    color: "#72859a", thickness: 2, lineStyle: edge.dashed ? "dashed" : "solid", arrowRoute: "straight", startHead: "none", endHead: "open",
    ...(edge.label ? { label: { text: edge.label, color: "#53677b", fontSize: 12, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "center" as const, listType: "none" as const, verticalAlign: "top" as const } } : {}),
  };
}

export function buildGuideDiagram(id: DiagramGuideId): Element[] {
  const guide = DIAGRAM_GUIDES.find(item => item.id === id);
  if (!guide) throw new Error("The selected diagram guide is unavailable.");
  return [...guide.edges.map(edge => makeGuideEdge(edge, guide.nodes)), ...guide.nodes.map(makeGuideElement)];
}
