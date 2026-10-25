import type { Element, FlowchartShape, GroupElement, ShapeElement } from "../../../model";
import { buildLibraryComponent, LIBRARY_COMPONENTS, type LibraryComponentKind } from "../../../notes";

export type DiagramGuideId = "order-flow" | "class-model" | "sequence" | "data-model" | "bpmn-process" | "c4-context" | "network-edge" | "cloud-service" | "state-machine" | "mind-map" | "user-journey" | "use-case" | "component-architecture" | "deployment" | "api-auth" | "data-flow" | "git-workflow" | "ci-cd" | "threat-model";
export type DiagramGuideCategory = "Flowchart" | "UML" | "Database" | "Data flow" | "API" | "BPMN" | "Architecture" | "Network" | "Brainstorming" | "UX" | "DevOps" | "Security";

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
  background?: boolean;
};
export type GuideEdge = { from: number; to: number; label?: string; dashed?: boolean; atY?: number; arrow?: boolean };
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

const flowNode = (title: string, x: number, y: number, shape: FlowchartShape, w = 150, h = 78, fill?: string): GuideNode => ({ title, x, y, w, h, shape: "flowchart", flowchartShape: shape, ...(fill ? { fill } : {}) });
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
  {
    id: "mind-map", category: "Brainstorming", title: "Idea map", summary: "Expand one topic into themes, questions, and next steps.", use: "Use a mind map to explore a topic before choosing a direction.", tip: "Keep one idea per branch; group related branches after the first pass.", source: { label: "Lucidchart use cases", href: "https://lucid.co/lucidchart" }, width: 980, height: 590,
    nodes: [{ title: "Project idea", x: 390, y: 220, w: 200, h: 130, shape: "circle", fill: "#e8f2ff" }, componentNode("Audience", 55, 35, "uml-use-case", 190, 85, "#fff6df"), componentNode("Needs", 55, 180, "uml-use-case", 190, 85, "#fff6df"), componentNode("Ideas", 55, 360, "uml-use-case", 190, 85, "#fff6df"), componentNode("Risks", 735, 35, "uml-use-case", 190, 85, "#fff0ee"), componentNode("Evidence", 735, 180, "uml-use-case", 190, 85, "#fff0ee"), componentNode("Next steps", 735, 360, "uml-use-case", 190, 85, "#fff0ee")],
    edges: [{ from: 0, to: 1, arrow: false }, { from: 0, to: 2, arrow: false }, { from: 0, to: 3, arrow: false }, { from: 0, to: 4, arrow: false }, { from: 0, to: 5, arrow: false }, { from: 0, to: 6, arrow: false }],
  },
  {
    id: "user-journey", category: "UX", title: "User journey map", summary: "Map a person's steps, friction, and improvement opportunities.", use: "Use this to align product, service, and support teams around one user goal.", tip: "Replace assumptions with observed user evidence and note the journey's context.", source: { label: "Lucidchart use cases", href: "https://lucid.co/lucidchart" }, width: 1120, height: 430,
    nodes: [flowNode("Discover", 20, 65, "process", 160), flowNode("Compare", 230, 65, "process", 160), flowNode("Sign up", 440, 65, "process", 160), flowNode("Get started", 650, 65, "process", 160), flowNode("Get help", 860, 65, "process", 160), componentNode("Find a trusted option", 20, 205, "uml-use-case", 160, 82), componentNode("Understand the fit", 230, 205, "uml-use-case", 160, 82), componentNode("Create an account", 440, 205, "uml-use-case", 160, 82), componentNode("Reach first success", 650, 205, "uml-use-case", 160, 82), componentNode("Resolve a blocker", 860, 205, "uml-use-case", 160, 82), flowNode("Opportunity: clearer proof", 275, 340, "manual-operation", 240, 65), flowNode("Opportunity: guided setup", 650, 340, "manual-operation", 240, 65)],
    edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }, { from: 3, to: 4 }, { from: 0, to: 5, arrow: false }, { from: 1, to: 6, arrow: false }, { from: 2, to: 7, arrow: false }, { from: 3, to: 8, arrow: false }, { from: 4, to: 9, arrow: false }, { from: 6, to: 10, dashed: true }, { from: 8, to: 11, dashed: true }],
  },
  {
    id: "use-case", category: "UML", title: "Order service use cases", summary: "Show who uses a system and which outcomes it provides.", use: "Use a UML use-case diagram to set system scope and actor goals.", tip: "Name use cases as outcomes; model detailed steps separately in a sequence or activity diagram.", source: { label: "OMG UML 2.5.1", href: "https://www.omg.org/spec/UML/2.5.1/PDF" }, width: 1020, height: 440,
    nodes: [{ ...componentNode("Order service", 270, 25, "c4-system", 700, 385, "#f6f9fd"), background: true }, componentNode("Customer", 40, 145, "uml-actor", 90, 145), componentNode("Place order", 400, 75, "uml-use-case", 210, 90, "#e8f2ff"), componentNode("Track order", 690, 75, "uml-use-case", 210, 90, "#e8f2ff"), componentNode("Request refund", 400, 250, "uml-use-case", 210, 90, "#fff6df"), componentNode("Payment service", 900, 145, "uml-actor", 90, 145)],
    edges: [{ from: 1, to: 2, arrow: false }, { from: 1, to: 3, arrow: false }, { from: 1, to: 4, arrow: false }, { from: 5, to: 2, arrow: false }, { from: 5, to: 4, arrow: false }],
  },
  {
    id: "component-architecture", category: "Architecture", title: "Component architecture", summary: "Group application components and show their dependencies.", use: "Use this view to communicate responsibilities and important interfaces between components.", tip: "Name provided and required interfaces in component details; keep runtime deployment in a separate view.", source: { label: "C4 component diagrams", href: "https://c4model.com/diagrams/component" }, width: 1090, height: 480,
    nodes: [{ ...componentNode("Order platform", 155, 25, "c4-container", 770, 400, "#f6f9fd"), background: true }, componentNode("Web client", 220, 95, "uml-component", 190, 125, "#e8f2ff"), componentNode("Order API", 490, 95, "uml-component", 190, 125, "#e8f2ff"), componentNode("Order domain", 350, 275, "uml-component", 190, 125, "#fff6df"), componentNode("Payment adapter", 720, 275, "uml-component", 190, 125, "#fff0ee")],
    edges: [{ from: 1, to: 2, label: "HTTPS / REST" }, { from: 2, to: 3, label: "Order port" }, { from: 3, to: 4, label: "Payment port" }],
  },
  {
    id: "deployment", category: "Architecture", title: "Service deployment", summary: "Map software artifacts onto their runtime environments.", use: "Use a deployment view to discuss where software runs and how nodes communicate.", tip: "Label environments and locations; add versions and artifact references in deployment details.", source: { label: "OMG UML 2.5.1", href: "https://www.omg.org/spec/UML/2.5.1/PDF" }, width: 1120, height: 460,
    nodes: [{ ...componentNode("Cloud region · production", 270, 30, "c4-container", 820, 390, "#f6f9fd"), background: true }, componentNode("Browser", 25, 155, "uml-artifact", 175, 110, "#fff6df"), componentNode("Web node", 330, 90, "uml-node", 220, 160, "#e8f2ff"), componentNode("API node", 650, 90, "uml-node", 220, 160, "#e8f2ff"), componentNode("Database node", 650, 280, "uml-node", 220, 110, "#eef8f3"), componentNode("Web bundle", 355, 155, "uml-artifact", 170, 70), componentNode("Order API", 675, 155, "uml-artifact", 170, 70)],
    edges: [{ from: 1, to: 2, label: "HTTPS" }, { from: 2, to: 3, label: "SQL" }],
  },
  {
    id: "api-auth", category: "API", title: "API authentication", summary: "Trace token acquisition, validation, and a protected request.", use: "Use a sequence view to explain the happy path and a useful failure response.", tip: "Add scopes, token lifetime, refresh behavior, and error cases that matter to your API contract.", source: { label: "OMG UML 2.5.1", href: "https://www.omg.org/spec/UML/2.5.1/PDF" }, width: 1200, height: 440,
    nodes: [componentNode("Client", 20, 25, "uml-lifeline", 150, 365), componentNode("Identity provider", 265, 25, "uml-lifeline", 165, 365), componentNode("API gateway", 520, 25, "uml-lifeline", 165, 365), componentNode("Order service", 775, 25, "uml-lifeline", 165, 365), componentNode("Database", 1030, 25, "uml-lifeline", 150, 365)],
    edges: [{ from: 0, to: 1, label: "1. Sign in", atY: 95 }, { from: 1, to: 0, label: "2. Access token", dashed: true, atY: 145 }, { from: 0, to: 2, label: "3. Request + bearer token", atY: 205 }, { from: 2, to: 1, label: "4. Validate token", atY: 255 }, { from: 2, to: 3, label: "5. Authorized request", atY: 305 }, { from: 3, to: 4, label: "6. Read order", atY: 355 }],
  },
  {
    id: "data-flow", category: "Data flow", title: "Customer data flow", summary: "Follow information from an external source through processing and storage.", use: "Use a data-flow diagram to discuss data movement, trust boundaries, and stores.", tip: "Name the data on each connector and mark sensitive information before choosing controls.", source: { label: "OWASP threat modeling", href: "https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html" }, width: 1060, height: 390,
    nodes: [componentNode("Customer", 20, 130, "network-client", 150, 110), flowNode("Web app", 270, 115, "process", 185, 115), flowNode("Validate input", 545, 35, "process", 190, 105), flowNode("Calculate order", 545, 220, "process", 190, 105), componentNode("Orders store", 840, 130, "software-database", 190, 110)],
    edges: [{ from: 0, to: 1, label: "Request data" }, { from: 1, to: 2, label: "Form input" }, { from: 2, to: 3, label: "Validated data" }, { from: 3, to: 4, label: "Order record" }, { from: 1, to: 4, label: "Read profile" }],
  },
  {
    id: "git-workflow", category: "DevOps", title: "Git feature workflow", summary: "Sketch a short-lived branch, review, checks, and merge path.", use: "Use this to agree on how a change moves from local work to a shared stable branch.", tip: "Tailor branch names and merge rules to your team; this is a discussion aid, not a required Git strategy.", source: { label: "Pro Git branching workflows", href: "https://git-scm.com/book/en/v2/Git-Branching-Branching-Workflows" }, width: 1080, height: 430,
    nodes: [flowNode("main", 35, 180, "terminator", 145, 72), flowNode("Feature branch", 275, 55, "process", 190, 85), flowNode("Commit changes", 535, 55, "process", 190, 85), flowNode("Pull request", 535, 270, "process", 190, 85), flowNode("Review + CI", 790, 270, "process", 190, 85), flowNode("Merge + release", 790, 105, "terminator", 210, 85)],
    edges: [{ from: 0, to: 1, label: "branch" }, { from: 1, to: 2 }, { from: 2, to: 3, label: "push" }, { from: 3, to: 4 }, { from: 4, to: 5, label: "approved" }, { from: 5, to: 0, label: "merge", dashed: true }],
  },
  {
    id: "ci-cd", category: "DevOps", title: "CI/CD pipeline", summary: "Model checks, parallel build work, release approval, and deployment.", use: "Use a pipeline view to make automation stages and release gates visible.", tip: "Name the trigger, artifacts, environments, and rollback point; split independent jobs into parallel paths.", source: { label: "GitHub Actions workflow concepts", href: "https://docs.github.com/en/actions/get-started/understanding-github-actions" }, width: 1150, height: 470,
    nodes: [flowNode("Push / pull request", 20, 180, "terminator", 180, 82), flowNode("Lint + typecheck", 270, 60, "process", 185, 82), flowNode("Test", 270, 280, "process", 185, 82), flowNode("Build artifact", 530, 180, "process", 185, 82), flowNode("Approve release", 790, 180, "manual-operation", 190, 82), flowNode("Deploy", 1030, 180, "terminator", 100, 82), flowNode("Rollback", 790, 345, "process", 190, 75)],
    edges: [{ from: 0, to: 1 }, { from: 0, to: 2 }, { from: 1, to: 3, label: "pass" }, { from: 2, to: 3, label: "pass" }, { from: 3, to: 4 }, { from: 4, to: 5, label: "approved" }, { from: 5, to: 6, label: "failure", dashed: true }, { from: 6, to: 3, label: "previous version", dashed: true }],
  },
  {
    id: "threat-model", category: "Security", title: "Threat model", summary: "Map a protected system, a data store, a trust boundary, and review prompts.", use: "Use this as a starting point for a threat-modeling discussion with the system owners.", tip: "Check each data flow and boundary against relevant threats; capture mitigations and owners before sign-off.", source: { label: "OWASP threat modeling", href: "https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html" }, width: 1120, height: 510,
    nodes: [componentNode("Attacker", 20, 170, "network-client", 145, 105), { ...componentNode("Trusted service boundary", 235, 35, "c4-container", 620, 340, "#f6f9fd"), background: true }, componentNode("Web API", 300, 100, "software-api", 185, 110, "#e8f2ff"), componentNode("Customer data", 590, 100, "software-database", 195, 110, "#eef8f3"), flowNode("Spoofing · fake identity", 20, 420, "manual-operation", 165, 75, "#fff0ee"), flowNode("Tampering · changed request", 205, 420, "manual-operation", 165, 75, "#fff6df"), flowNode("Repudiation · no audit trail", 390, 420, "manual-operation", 165, 75, "#fff6df"), flowNode("Disclosure · exposed data", 575, 420, "manual-operation", 165, 75, "#fff0ee"), flowNode("Denial · unavailable API", 760, 420, "manual-operation", 165, 75, "#fff0ee"), flowNode("Elevation · excess privilege", 945, 420, "manual-operation", 165, 75, "#fff6df")],
    edges: [{ from: 0, to: 2, label: "untrusted request" }, { from: 2, to: 3, label: "read / write" }],
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
